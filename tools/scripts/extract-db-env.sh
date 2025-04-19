#!/bin/bash

# Script to extract database connection variables from Kubernetes pods
# Usage: ./tools/scripts/extract-db-env.sh [environment]
# Example: ./tools/scripts/extract-db-env.sh staging

set -e

# Get environment from command line argument
ENV=${1:-staging}
if [[ "$ENV" != "staging" && "$ENV" != "production" ]]; then
  echo "Error: Environment must be 'staging' or 'production'"
  echo "Usage: ./tools/scripts/extract-db-env.sh [environment]"
  exit 1
fi

NAMESPACE="ethyrial-$ENV"
echo "🔍 Extracting database connection info from $ENV environment (namespace: $NAMESPACE)"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
  echo "❌ kubectl not found. Please install kubectl first."
  exit 1
fi

# Get web pod name
echo "🔍 Finding web pod in namespace $NAMESPACE..."
WEB_POD=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/component=web -o jsonpath="{.items[0].metadata.name}" 2>/dev/null)

if [ -z "$WEB_POD" ]; then
  echo "❌ No web pod found in namespace $NAMESPACE"
  echo "   Running the troubleshooting script to check connectivity..."
  ./tools/scripts/kubectl-troubleshoot.sh
  exit 1
fi

echo "✅ Found web pod: $WEB_POD"

# Extract environment variables related to database connections
echo "🔍 Extracting database connection variables from pod $WEB_POD..."
DB_VARS=$(kubectl exec -n $NAMESPACE $WEB_POD -- bash -c "env | grep -E 'DATABASE_|POSTGRES_|PG_|REDIS_|DB_|OPENSEARCH_'" 2>/dev/null)

if [ -z "$DB_VARS" ]; then
  echo "⚠️ No database variables found. Extracting all environment variables instead..."
  ENV_VARS=$(kubectl exec -n $NAMESPACE $WEB_POD -- bash -c "env | sort" 2>/dev/null)
  
  # Create a directory for output files
  mkdir -p .env
  
  # Write all environment variables to a file
  echo "$ENV_VARS" > ".env/$ENV.all"
  echo "✅ All environment variables written to .env/$ENV.all"
  
  # Try to extract just what looks like database connection strings
  DB_VARS=$(echo "$ENV_VARS" | grep -E 'postgres://|redis://|mongodb://|http.*opensearch' || echo "")
  
  if [ -z "$DB_VARS" ]; then
    echo "❌ Could not find any database connection strings"
    echo "📝 Please check .env/$ENV.all for all environment variables"
    exit 1
  fi
fi

# Write database variables to a file
mkdir -p .env
echo "$DB_VARS" > ".env/$ENV.db"
echo "✅ Database connection variables written to .env/$ENV.db"

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
    echo "📝 For local access, set up port forwarding:"
    echo "./tools/scripts/db-port-forward.sh $ENV postgres 5432"
    echo "Then connect with: psql -h localhost -p 5432 -U $PG_USER $PG_DB"
  else
    echo "⚠️ Could not parse PostgreSQL connection string: $PG_URL"
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
    echo "📝 For local access, set up port forwarding:"
    echo "./tools/scripts/db-port-forward.sh $ENV redis 6379"
    echo "Then connect with: redis-cli -h localhost -p 6379"
  else
    echo "⚠️ Could not parse Redis connection string: $REDIS_URL"
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
    echo "./tools/scripts/db-port-forward.sh $ENV opensearch 9200"
    echo "Then access via: curl http://localhost:9200"
    if [ -n "$OPENSEARCH_USERNAME" ] && [ -n "$OPENSEARCH_PASSWORD" ]; then
      echo "With authentication: curl -u ${OPENSEARCH_USERNAME}:${OPENSEARCH_PASSWORD} http://localhost:9200"
    fi
    echo ""
    
    # Get OpenSearch Dashboard information if available
    DASHBOARD_POD=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/component=opensearch-dashboards -o jsonpath="{.items[0].metadata.name}" 2>/dev/null)
    if [ -n "$DASHBOARD_POD" ]; then
      echo "==== OpenSearch Dashboard Access ===="
      echo "🔸 Dashboard pod: $DASHBOARD_POD"
      
      # Check for ingress
      DASHBOARD_INGRESS=$(kubectl get ingress -n $NAMESPACE -l app.kubernetes.io/component=opensearch-dashboards -o jsonpath="{.items[0].spec.rules[0].host}" 2>/dev/null)
      if [ -n "$DASHBOARD_INGRESS" ]; then
        echo "🔸 Dashboard URL: https://$DASHBOARD_INGRESS"
        echo "🔸 Admin username: admin (default)"
        echo "🔸 Admin password: [same as OPENSEARCH_PASSWORD]"
      else
        echo "📝 For local dashboard access, set up port forwarding:"
        echo "./tools/scripts/db-port-forward.sh $ENV opensearch-dashboards 5601"
        echo "Then access via browser: http://localhost:5601"
      fi
    fi
  else
    echo "⚠️ Could not parse OpenSearch URL: $OPENSEARCH_URL"
  fi
fi

echo "✅ Done! You can now use the connection information to connect to your databases."
echo "📁 Check .env/$ENV.db for all database variables"
echo ""
echo "Need to run a SQL query directly? Try:"
echo "./tools/scripts/run-sql.sh $ENV \"SELECT NOW();\"" 