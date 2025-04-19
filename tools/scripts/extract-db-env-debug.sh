#!/bin/bash

# Debugging Script to extract database connection variables from Kubernetes pods
# With added troubleshooting for connection issues
# Usage: ./extract-db-env-debug.sh [environment]
# Example: ./extract-db-env-debug.sh staging

set -e

# Get environment from command line argument
ENV=${1:-staging}
if [[ "$ENV" != "staging" && "$ENV" != "production" ]]; then
  echo "Error: Environment must be 'staging' or 'production'"
  echo "Usage: ./extract-db-env-debug.sh [environment]"
  exit 1
fi

NAMESPACE="ethyrial-$ENV"
echo "🔍 Extracting database connection info from $ENV environment (namespace: $NAMESPACE)"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
  echo "❌ kubectl not found. Please install kubectl first."
  exit 1
fi

# Test kubectl connectivity
echo "🔧 Testing kubectl connectivity..."
if ! kubectl version --client &> /dev/null; then
  echo "❌ kubectl client version check failed. Please check your kubectl installation."
  exit 1
fi

echo "🔧 Checking current context..."
CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "none")
if [[ "$CURRENT_CONTEXT" == "none" ]]; then
  echo "❌ No Kubernetes context is set. Please configure kubectl with a valid context."
  echo "   Run: kubectl config get-contexts"
  echo "   Then: kubectl config use-context <context-name>"
  exit 1
fi
echo "✅ Using Kubernetes context: $CURRENT_CONTEXT"

# List all namespaces to check access
echo "🔧 Checking namespace access..."
if ! NAMESPACES=$(kubectl get namespaces -o name 2>/dev/null); then
  echo "❌ Cannot list namespaces. You may not have proper permissions or connectivity."
  echo "   Please check your Kubernetes configuration and credentials."
  exit 1
fi

echo "Available namespaces:"
echo "$NAMESPACES" | sed 's/namespace\//  - /'

# Check if the target namespace exists
if ! kubectl get namespace $NAMESPACE &>/dev/null; then
  echo "❌ Target namespace '$NAMESPACE' not found in the cluster."
  echo "   Available namespaces are listed above."
  exit 1
fi
echo "✅ Target namespace '$NAMESPACE' exists"

# List pods in the namespace to check access
echo "🔧 Checking pod access in namespace '$NAMESPACE'..."
if ! PODS=$(kubectl get pods -n $NAMESPACE -o wide 2>/dev/null); then
  echo "❌ Cannot list pods in namespace '$NAMESPACE'. You may not have proper permissions."
  exit 1
fi

echo "Pods in namespace '$NAMESPACE':"
echo "$PODS"

# Get web pod name with more specific search and verbosity
echo "🔍 Finding web pod in namespace $NAMESPACE..."

# First check: find running web pods (most reliable)
WEB_POD=$(kubectl get pods -n $NAMESPACE --field-selector=status.phase=Running -o jsonpath="{.items[?(@.metadata.name contains 'web')].metadata.name}" 2>/dev/null | tr ' ' '\n' | head -1)

if [ -n "$WEB_POD" ]; then
  echo "✅ Found RUNNING pod with 'web' in the name: $WEB_POD"
else
  echo "❌ No RUNNING pods with 'web' in the name found in namespace $NAMESPACE"
  
  # Second check: try outline-worker pod as an alternative
  WORKER_POD=$(kubectl get pods -n $NAMESPACE --field-selector=status.phase=Running -o jsonpath="{.items[?(@.metadata.name contains 'worker')].metadata.name}" 2>/dev/null | tr ' ' '\n' | head -1)
  
  if [ -n "$WORKER_POD" ]; then
    echo "✅ Found RUNNING worker pod to use instead: $WORKER_POD"
    WEB_POD=$WORKER_POD
  else
    # Third check: try any running pod as a fallback
    echo "🔍 Looking for any running pod as a fallback..."
    WEB_POD=$(kubectl get pods -n $NAMESPACE --field-selector=status.phase=Running -o jsonpath="{.items[0].metadata.name}" 2>/dev/null || echo "")
    
    if [ -n "$WEB_POD" ]; then
      echo "✅ Found a running pod to use: $WEB_POD"
      echo "⚠️ Note: This is not a web pod, but it's running and may have database info."
    else
      # Last resort: manual selection
      echo "❌ Could not identify any running pods automatically."
      echo "🔧 Available pods:"
      kubectl get pods -n $NAMESPACE -o wide
      echo ""
      echo "   Please specify a RUNNING pod name from the list above:"
      read -p "Enter pod name: " WEB_POD
      
      if [ -z "$WEB_POD" ]; then
        echo "❌ No pod name provided. Exiting."
        exit 1
      fi
    fi
  fi
fi

echo "🔧 Testing connection to pod $WEB_POD..."
if ! kubectl exec -n $NAMESPACE $WEB_POD -- echo "Connection successful" &>/dev/null; then
  echo "❌ Cannot execute commands in pod $WEB_POD."
  echo "   You may not have proper permissions or the pod might not be ready."
  exit 1
fi

echo "✅ Successfully connected to pod: $WEB_POD"

# Extract environment variables related to database connections
echo "🔍 Extracting database connection variables from pod $WEB_POD..."
DB_VARS=$(kubectl exec -n $NAMESPACE $WEB_POD -- bash -c "env | grep -E 'DATABASE_|POSTGRES_|PG_|REDIS_|DB_|OPENSEARCH_'" 2>/dev/null || echo "")

if [ -z "$DB_VARS" ]; then
  echo "⚠️ No database variables found with standard pattern. Trying alternative patterns..."
  DB_VARS=$(kubectl exec -n $NAMESPACE $WEB_POD -- bash -c "env | grep -i -E 'database|postgres|redis|mongo|sql|opensearch'" 2>/dev/null || echo "")
  
  if [ -z "$DB_VARS" ]; then
    echo "⚠️ Still no database variables found. Extracting all environment variables instead..."
    ENV_VARS=$(kubectl exec -n $NAMESPACE $WEB_POD -- bash -c "env | sort" 2>/dev/null || echo "")
    
    if [ -z "$ENV_VARS" ]; then
      echo "❌ Failed to extract any environment variables from the pod."
      echo "   Please check that the pod is running and has a bash shell available."
      exit 1
    fi
    
    # Write all environment variables to a file
    echo "$ENV_VARS" > ".env.$ENV.all"
    echo "✅ All environment variables written to .env.$ENV.all"
    
    # Try to extract just what looks like database connection strings
    DB_VARS=$(echo "$ENV_VARS" | grep -E 'postgres://|redis://|mongodb://|jdbc:|mysql://|http.*opensearch' || echo "")
    
    if [ -z "$DB_VARS" ]; then
      echo "❌ Could not find any database connection strings in the environment variables"
      echo "📝 Please check .env.$ENV.all manually to find database connection information"
      exit 1
    fi
  fi
fi

# Write database variables to a file
echo "$DB_VARS" > ".env.$ENV.db"
echo "✅ Database connection variables written to .env.$ENV.db"

# Extract and format the PostgreSQL connection string
PG_URL=$(echo "$DB_VARS" | grep -E 'DATABASE_URL|POSTGRES_URL|PG_URL' | cut -d '=' -f2- | head -n 1)

if [ -n "$PG_URL" ]; then
  echo "📊 PostgreSQL connection string found"
  
  # Extract components from the URL
  if [[ $PG_URL =~ postgres://([^:]+):([^@]+)@([^:/]+):([0-9]+)/(.+) ]]; then
    PG_USER="${BASH_REMATCH[1]}"
    PG_PASS="${BASH_REMATCH[2]}"
    PG_HOST="${BASH_REMATCH[3]}"
    PG_PORT="${BASH_REMATCH[4]}"
    PG_DB="${BASH_REMATCH[5]}"
    
    echo ""
    echo "==== PostgreSQL Connection Info ===="
    echo "🔸 Host: $PG_HOST"
    echo "🔸 Port: $PG_PORT"
    echo "🔸 Database: $PG_DB"
    echo "🔸 Username: $PG_USER"
    echo "🔸 Password: $PG_PASS"
    echo ""
    echo "📝 Connection command:"
    echo "psql postgres://$PG_USER:$PG_PASS@$PG_HOST:$PG_PORT/$PG_DB"
    echo ""
    
    echo "📝 For external access, you may need to set up port forwarding:"
    echo "kubectl port-forward -n $NAMESPACE svc/postgres 5432:5432"
    echo "Then connect with: psql -h localhost -p 5432 -U $PG_USER $PG_DB"
  else
    echo "⚠️ Could not parse PostgreSQL connection string: $PG_URL"
  fi
else
  echo "⚠️ No PostgreSQL connection string found with standard format."
  echo "   Checking for PostgreSQL service in the namespace..."
  
  # Try to find PostgreSQL service
  PG_SVC=$(kubectl get svc -n $NAMESPACE | grep -i -E 'postgres|pg|postgresql' || echo "")
  if [ -n "$PG_SVC" ]; then
    echo "✅ Found potential PostgreSQL service:"
    echo "$PG_SVC"
    echo ""
    echo "📝 Try setting up port forwarding to access the database:"
    echo "kubectl port-forward -n $NAMESPACE svc/$(echo "$PG_SVC" | awk '{print $1}' | head -1) 5432:5432"
  fi
fi

# Extract Redis connection if available
REDIS_URL=$(echo "$DB_VARS" | grep -E 'REDIS_URL' | cut -d '=' -f2- | head -n 1)

if [ -n "$REDIS_URL" ]; then
  echo "📊 Redis connection string found"
  
  # Extract components from the URL
  if [[ $REDIS_URL =~ redis://([^:]*):?([^@]*)@?([^:/]+):([0-9]+) ]]; then
    REDIS_USER="${BASH_REMATCH[1]}"
    REDIS_PASS="${BASH_REMATCH[2]}"
    REDIS_HOST="${BASH_REMATCH[3]}"
    REDIS_PORT="${BASH_REMATCH[4]}"
    
    echo ""
    echo "==== Redis Connection Info ===="
    echo "🔸 Host: $REDIS_HOST"
    echo "🔸 Port: $REDIS_PORT"
    if [ -n "$REDIS_USER" ]; then echo "🔸 Username: $REDIS_USER"; fi
    if [ -n "$REDIS_PASS" ]; then echo "🔸 Password: $REDIS_PASS"; fi
    echo ""
    echo "📝 Connection command:"
    if [ -n "$REDIS_PASS" ]; then
      echo "redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASS"
    else
      echo "redis-cli -h $REDIS_HOST -p $REDIS_PORT"
    fi
    echo ""
    
    echo "📝 For external access, you may need to set up port forwarding:"
    echo "kubectl port-forward -n $NAMESPACE svc/redis 6379:6379"
    echo "Then connect with: redis-cli -h localhost -p 6379"
  else
    echo "⚠️ Could not parse Redis connection string: $REDIS_URL"
  fi
else
  echo "⚠️ No Redis connection string found with standard format."
  echo "   Checking for Redis service in the namespace..."
  
  # Try to find Redis service
  REDIS_SVC=$(kubectl get svc -n $NAMESPACE | grep -i 'redis' || echo "")
  if [ -n "$REDIS_SVC" ]; then
    echo "✅ Found potential Redis service:"
    echo "$REDIS_SVC"
    echo ""
    echo "📝 Try setting up port forwarding to access Redis:"
    echo "kubectl port-forward -n $NAMESPACE svc/$(echo "$REDIS_SVC" | awk '{print $1}' | head -1) 6379:6379"
  fi
fi

# Extract OpenSearch connection if available
OPENSEARCH_URL=$(echo "$DB_VARS" | grep -E 'OPENSEARCH_URL' | cut -d '=' -f2- | head -n 1)
OPENSEARCH_USERNAME=$(echo "$DB_VARS" | grep -E 'OPENSEARCH_USERNAME' | cut -d '=' -f2- | head -n 1)
OPENSEARCH_PASSWORD=$(echo "$DB_VARS" | grep -E 'OPENSEARCH_PASSWORD' | cut -d '=' -f2- | head -n 1)
OPENSEARCH_SSL_VERIFY=$(echo "$DB_VARS" | grep -E 'OPENSEARCH_SSL_VERIFY' | cut -d '=' -f2- | head -n 1)

if [ -n "$OPENSEARCH_URL" ]; then
  echo "📊 OpenSearch connection found"
  
  # Extract components from the URL
  if [[ $OPENSEARCH_URL =~ (https?://)?([^:/]+):?([0-9]*) ]]; then
    OPENSEARCH_PROTOCOL="${BASH_REMATCH[1]:-http://}"
    OPENSEARCH_HOST="${BASH_REMATCH[2]}"
    OPENSEARCH_PORT="${BASH_REMATCH[3]:-9200}"
    
    echo ""
    echo "==== OpenSearch Connection Info ===="
    echo "🔸 URL: $OPENSEARCH_URL"
    echo "🔸 Host: $OPENSEARCH_HOST"
    echo "🔸 Port: $OPENSEARCH_PORT"
    echo "🔸 Protocol: $OPENSEARCH_PROTOCOL"
    echo "🔸 SSL Verify: ${OPENSEARCH_SSL_VERIFY:-false}"
    if [ -n "$OPENSEARCH_USERNAME" ]; then echo "🔸 Username: $OPENSEARCH_USERNAME"; fi
    if [ -n "$OPENSEARCH_PASSWORD" ]; then echo "🔸 Password: $OPENSEARCH_PASSWORD"; fi
    echo ""
    echo "📝 For local access, set up port forwarding:"
    echo "kubectl port-forward -n $NAMESPACE svc/outline-opensearch 9200:9200"
    echo "Then access via: curl http://localhost:9200"
    if [ -n "$OPENSEARCH_USERNAME" ] && [ -n "$OPENSEARCH_PASSWORD" ]; then
      echo "With authentication: curl -u ${OPENSEARCH_USERNAME}:${OPENSEARCH_PASSWORD} http://localhost:9200"
    fi
    echo ""
    
    # Check for OpenSearch Dashboard
    echo "🔍 Checking for OpenSearch Dashboard..."
    DASHBOARD_SVC=$(kubectl get svc -n $NAMESPACE | grep -i 'opensearch-dashboards' || echo "")
    if [ -n "$DASHBOARD_SVC" ]; then
      echo "✅ Found OpenSearch Dashboard service:"
      echo "$DASHBOARD_SVC"
      
      # Check for dashboard ingress
      DASHBOARD_INGRESS=$(kubectl get ingress -n $NAMESPACE -l app.kubernetes.io/component=opensearch-dashboards -o jsonpath="{.items[0].spec.rules[0].host}" 2>/dev/null || echo "")
      if [ -n "$DASHBOARD_INGRESS" ]; then
        echo "🔸 Dashboard URL: https://$DASHBOARD_INGRESS"
        echo "🔸 Dashboard has basic auth protection with user: admin"
        echo "🔸 Dashboard basic auth password is generated and stored in the cluster"
      else
        echo "📝 For dashboard access, set up port forwarding:"
        echo "kubectl port-forward -n $NAMESPACE svc/$(echo "$DASHBOARD_SVC" | awk '{print $1}' | head -1) 5601:5601"
        echo "Then access via browser: http://localhost:5601"
      fi
    fi
  else
    echo "⚠️ Could not parse OpenSearch URL: $OPENSEARCH_URL"
  fi
else
  echo "⚠️ No OpenSearch connection info found."
  echo "   Checking for OpenSearch service in the namespace..."
  
  # Try to find OpenSearch service
  OS_SVC=$(kubectl get svc -n $NAMESPACE | grep -i 'opensearch' | grep -v 'dashboards' || echo "")
  if [ -n "$OS_SVC" ]; then
    echo "✅ Found potential OpenSearch service:"
    echo "$OS_SVC"
    echo ""
    echo "📝 Try setting up port forwarding to access OpenSearch:"
    echo "kubectl port-forward -n $NAMESPACE svc/$(echo "$OS_SVC" | awk '{print $1}' | head -1) 9200:9200"
    echo "Then access via: curl http://localhost:9200"
    
    # Check for credentials
    echo "🔍 Looking for an OpenSearch secret that might contain credentials..."
    OS_SECRET=$(kubectl get secret -n $NAMESPACE | grep -i 'opensearch' | grep -v 'dashboards' | head -1 || echo "")
    if [ -n "$OS_SECRET" ]; then
      echo "✅ Found potential OpenSearch secret: $(echo "$OS_SECRET" | awk '{print $1}')"
      echo "   You might be able to extract credentials with:"
      echo "kubectl get secret -n $NAMESPACE $(echo "$OS_SECRET" | awk '{print $1}') -o yaml"
    fi
  fi
  
  # Check for OpenSearch Dashboard service
  OS_DASH_SVC=$(kubectl get svc -n $NAMESPACE | grep -i 'opensearch-dashboards' || echo "")
  if [ -n "$OS_DASH_SVC" ]; then
    echo "✅ Found OpenSearch Dashboard service:"
    echo "$OS_DASH_SVC"
    echo ""
    echo "📝 Try setting up port forwarding to access the dashboard:"
    echo "kubectl port-forward -n $NAMESPACE svc/$(echo "$OS_DASH_SVC" | awk '{print $1}' | head -1) 5601:5601"
    echo "Then access via browser: http://localhost:5601"
  fi
fi

echo ""
echo "📋 TROUBLESHOOTING TIPS 📋"
echo "1. If you need to specify a different Kubernetes context:"
echo "   kubectl config use-context <context-name>"
echo ""
echo "2. To list available services in the namespace:"
echo "   kubectl get svc -n $NAMESPACE"
echo ""
echo "3. To port-forward to a database service:"
echo "   kubectl port-forward -n $NAMESPACE svc/<service-name> <local-port>:<remote-port>"
echo ""
echo "4. To check pod logs for connection information:"
echo "   kubectl logs -n $NAMESPACE $WEB_POD | grep -i 'database\|connection'"
echo ""
echo "✅ Done! Check .env.$ENV.db for extracted database variables." 