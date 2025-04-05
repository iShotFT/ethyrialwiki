#!/bin/bash
# Pre-deployment script to ensure storage classes and provisioners exist
# This script is run before helm deployment to avoid issues with Helm adoption

set -e

echo "=== Pre-deployment setup ==="

# Check if kubectl is configured
kubectl get nodes > /dev/null || {
  echo "Error: kubectl not configured properly"
  exit 1
}

# Delete existing storage classes if they have potential Helm ownership issues
delete_if_helm_ownership() {
  local name=$1
  if kubectl get storageclass $name -o yaml 2>/dev/null | grep -q "app.kubernetes.io/managed-by: Helm"; then
    echo "Storage class $name has Helm ownership labels. Deleting to avoid conflicts..."
    kubectl delete storageclass $name
    return 0  # Indicates deletion was needed
  fi
  return 1  # Indicates no deletion was needed
}

# Check and set up storage classes
handle_storage_class() {
  local name=$1
  local is_default=$2
  local deleted=false
  
  # Try to delete if it has helm ownership
  delete_if_helm_ownership $name && deleted=true
  
  # If it still exists (and wasn't deleted), don't recreate it
  if ! $deleted && kubectl get storageclass $name &> /dev/null; then
    echo "Storage class $name already exists"
    return
  fi
  
  echo "Creating $name storage class..."
  cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: $name
  $([ "$is_default" = "true" ] && echo 'annotations:
    storageclass.kubernetes.io/is-default-class: "true"')
provisioner: rancher.io/local-path
volumeBindingMode: WaitForFirstConsumer
reclaimPolicy: Delete
EOF
}

# Handle storage classes
handle_storage_class "local-path" "true"
handle_storage_class "microk8s-hostpath" "false"

# Check if local-path-provisioner is running
if ! kubectl get namespace local-path-storage &> /dev/null || \
   ! kubectl get pods -n local-path-storage --selector=app=local-path-provisioner -o jsonpath='{.items[*].status.phase}' 2>/dev/null | grep -q "Running"; then
  echo "Installing local-path provisioner..."
  kubectl apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/v0.0.26/deploy/local-path-storage.yaml
  
  # Wait for local-path-provisioner to be ready
  echo "Waiting for local-path-provisioner to be ready..."
  for i in {1..10}; do
    if kubectl wait --namespace local-path-storage \
       --for=condition=ready pod \
       --selector=app=local-path-provisioner \
       --timeout=10s &> /dev/null; then
      echo "local-path-provisioner is ready"
      break
    fi
    echo "Waiting for local-path-provisioner (attempt $i/10)..."
    [ $i -eq 10 ] && echo "Warning: local-path-provisioner not ready after 10 attempts"
    sleep 3
  done
else
  echo "local-path-provisioner is already running"
fi

echo "=== Pre-deployment setup completed successfully ==="
exit 0 