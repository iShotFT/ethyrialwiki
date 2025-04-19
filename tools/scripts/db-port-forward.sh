#!/bin/bash

# Script to set up port forwarding to database services in Kubernetes
# Usage: ./db-port-forward.sh [environment] [service] [local-port] [remote-port]
# Example: ./db-port-forward.sh staging postgres 5432 5432

# Function to print colored output
print_info() {
  echo -e "\e[36m$1\e[0m"  # Cyan text
}

print_success() {
  echo -e "\e[32m$1\e[0m"  # Green text
}

print_error() {
  echo -e "\e[31m$1\e[0m"  # Red text
}

# Check parameters
ENV=${1:-}
SERVICE=${2:-}
LOCAL_PORT=${3:-}
REMOTE_PORT=${4:-}

# Show usage if missing required params
if [ -z "$ENV" ] || [ -z "$SERVICE" ]; then
  print_info "==== Database Port Forwarding ===="
  echo "Usage: ./db-port-forward.sh [environment] [service] [local-port] [remote-port]"
  echo "Example: ./db-port-forward.sh staging postgres 5432 5432"
  echo "Example: ./db-port-forward.sh production redis 6379 6379"
  echo
  print_info "Available environments:"
  echo "  - staging"
  echo "  - production"
  echo
  print_info "Common service names:"
  echo "  - postgres"
  echo "  - postgresql"
  echo "  - redis"
  echo "  - outline-postgres"
  echo "  - outline-redis"
  echo
  
  # Check if kubectl is configured
  if ! kubectl config current-context &>/dev/null; then
    print_error "No Kubernetes context configured."
    print_info "Run ./setup-kube-config.sh first to configure kubectl."
    exit 1
  fi
  
  print_info "Available services in staging:"
  kubectl get svc -n ethyrial-staging 2>/dev/null | grep -v NAME | awk '{print "  - " $1}'
  
  print_info "Available services in production:"
  kubectl get svc -n ethyrial-production 2>/dev/null | grep -v NAME | awk '{print "  - " $1}'
  
  exit 1
fi

# Validate environment
if [[ "$ENV" != "staging" && "$ENV" != "production" ]]; then
  print_error "Error: Environment must be 'staging' or 'production'"
  exit 1
fi

NAMESPACE="ethyrial-$ENV"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
  print_error "kubectl not found. Please install kubectl first."
  exit 1
fi

# Test kubectl connectivity
if ! kubectl version --client &> /dev/null; then
  print_error "kubectl client version check failed. Please check your kubectl installation."
  exit 1
fi

# Check current context
if ! CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null); then
  print_error "No Kubernetes context is set. Please run ./setup-kube-config.sh first."
  exit 1
fi
print_success "Using Kubernetes context: $CURRENT_CONTEXT"

# Check if the service exists
if ! kubectl get svc -n $NAMESPACE $SERVICE &>/dev/null; then
  print_error "Service '$SERVICE' not found in namespace '$NAMESPACE'."
  print_info "Available services in $NAMESPACE:"
  kubectl get svc -n $NAMESPACE | grep -v NAME | awk '{print "  - " $1}'
  exit 1
fi

# Set default ports if not provided
if [ -z "$LOCAL_PORT" ]; then
  # Try to guess the port based on service name
  if [[ "$SERVICE" == *"postgres"* || "$SERVICE" == *"postgresql"* || "$SERVICE" == *"pg"* ]]; then
    LOCAL_PORT=5432
  elif [[ "$SERVICE" == *"redis"* ]]; then
    LOCAL_PORT=6379
  elif [[ "$SERVICE" == *"mongo"* ]]; then
    LOCAL_PORT=27017
  else
    # Use the service's port if we can detect it
    SVC_PORT=$(kubectl get svc -n $NAMESPACE $SERVICE -o jsonpath="{.spec.ports[0].port}" 2>/dev/null)
    if [ -n "$SVC_PORT" ]; then
      LOCAL_PORT=$SVC_PORT
    else
      print_error "Could not determine port for service '$SERVICE'. Please specify a port."
      exit 1
    fi
  fi
  print_info "No local port specified. Using port $LOCAL_PORT."
fi

# Set remote port to match local port if not provided
if [ -z "$REMOTE_PORT" ]; then
  REMOTE_PORT=$LOCAL_PORT
  print_info "No remote port specified. Using same as local port: $REMOTE_PORT."
fi

print_info "==== Setting up port forwarding ===="
print_info "Environment: $ENV"
print_info "Namespace: $NAMESPACE"
print_info "Service: $SERVICE"
print_info "Local port: $LOCAL_PORT"
print_info "Remote port: $REMOTE_PORT"
echo

print_info "Starting port forwarding..."
print_info "Press Ctrl+C to stop the port forwarding when done."
echo

# Start port forwarding in the foreground
kubectl port-forward -n $NAMESPACE svc/$SERVICE $LOCAL_PORT:$REMOTE_PORT

# This point is reached only when port forwarding is interrupted
print_info "Port forwarding stopped." 