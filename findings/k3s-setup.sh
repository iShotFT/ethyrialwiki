#!/bin/bash
# K3s Installation and Setup Script for Ethyrial Wiki
# This script automates the setup process for K3s with Nginx ingress controller

# Exit on error
set -e

# Configuration
SERVER_IP=${1:-$(hostname -I | awk '{print $1}')}
HTTP_NODEPORT=32080
HTTPS_NODEPORT=32443

echo "Starting K3s installation on server with IP: $SERVER_IP"

# Install K3s without Traefik (we'll use Nginx ingress)
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--tls-san $SERVER_IP --node-external-ip $SERVER_IP --disable=traefik --kube-proxy-arg=metrics-bind-address=0.0.0.0 --advertise-address=$SERVER_IP" sh -

# Wait for K3s to be ready
echo "Waiting for K3s to be ready..."
sleep 10

# Set up kubeconfig for the current user
mkdir -p $HOME/.kube
sudo cp /etc/rancher/k3s/k3s.yaml $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
export KUBECONFIG=$HOME/.kube/config

# Install Helm if not present
if ! command -v helm &> /dev/null; then
    echo "Installing Helm..."
    curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
    chmod 700 get_helm.sh
    ./get_helm.sh
    rm get_helm.sh
fi

# Add and update the Nginx ingress controller repository
echo "Setting up Nginx ingress controller..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install the Nginx ingress controller with NodePort configuration
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=NodePort \
  --set controller.service.nodePorts.http=$HTTP_NODEPORT \
  --set controller.service.nodePorts.https=$HTTPS_NODEPORT \
  --set controller.hostNetwork=true

# Wait for the ingress controller to be ready
echo "Waiting for ingress controller to be ready..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s

# Get the ingress controller pod IP
INGRESS_POD_IP=$(kubectl get pods -n ingress-nginx -o jsonpath='{.items[0].status.podIP}')
echo "Ingress controller pod IP: $INGRESS_POD_IP"

# Create a ConfigMap for Nginx Proxy Manager configuration
cat > npm-config.txt << EOF
=== Nginx Proxy Manager Configuration for K3s ===

For each domain (staging.ethyrial.wiki, ethyrial.wiki, etc.):
- Scheme: https
- Forward Hostname/IP: $INGRESS_POD_IP
- Forward Port: 443
- SSL: Enabled (handled by Nginx Proxy Manager)
- WebSockets Support: Enabled

Current NodePorts:
- HTTP: $HTTP_NODEPORT
- HTTPS: $HTTPS_NODEPORT

Note: This configuration uses direct pod IP communication. If the pod is recreated, 
you will need to update the Forward Hostname/IP in Nginx Proxy Manager.
EOF

echo "Configuration saved to npm-config.txt"
echo "K3s setup completed successfully!"

# Instructions for next steps
echo ""
echo "Next steps:"
echo "1. Install Docker and Nginx Proxy Manager"
echo "2. Configure Nginx Proxy Manager according to npm-config.txt"
echo "3. Deploy your applications using Helm"
echo "" 