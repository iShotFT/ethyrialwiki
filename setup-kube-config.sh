#!/bin/bash

# Script to set up Kubernetes configuration for connecting to your cluster
# This script will help you create the necessary kubeconfig file from your GitHub secret

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

print_info "==== Kubernetes Configuration Setup ===="
print_info "This script will help you set up your kubeconfig to connect to your cluster."
echo

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
  print_error "kubectl not found. Please install kubectl first."
  exit 1
fi

# Ensure config directory exists
mkdir -p ~/.kube

# Check if a config file already exists
if [ -f ~/.kube/config ]; then
  print_info "An existing kubectl config file was found at ~/.kube/config"
  read -p "Do you want to backup the existing file? (y/n): " backup_choice
  
  if [[ "$backup_choice" == "y" || "$backup_choice" == "Y" ]]; then
    backup_file=~/.kube/config.backup.$(date +%Y%m%d-%H%M%S)
    cp ~/.kube/config "$backup_file"
    print_success "Existing config backed up to $backup_file"
  fi
fi

echo
print_info "To connect to your cluster, you need the KUBE_CONFIG secret from your GitHub repository."
print_info "The KUBE_CONFIG value is used in your deploy.yaml GitHub workflow."
echo

read -p "Do you have the base64-encoded KUBE_CONFIG value? (y/n): " has_config

if [[ "$has_config" != "y" && "$has_config" != "Y" ]]; then
  print_info "You need to retrieve the KUBE_CONFIG value from your GitHub repository settings."
  print_info "Follow these steps:"
  echo
  echo "1. Go to your GitHub repository"
  echo "2. Go to Settings > Secrets and variables > Actions"
  echo "3. Find the 'KUBE_CONFIG' secret"
  echo "4. Copy the value (it's base64 encoded)"
  echo
  print_info "If you don't have access to the secret, you need to contact your repository administrator."
  exit 1
fi

echo
echo "Please paste the base64-encoded KUBE_CONFIG value:"
read -p "> " encoded_config

if [ -z "$encoded_config" ]; then
  print_error "No config provided. Exiting."
  exit 1
fi

# Create a temporary file for the decoded config
temp_file=$(mktemp)

# Try to decode the input
echo "$encoded_config" | base64 -d > "$temp_file" 2>/dev/null

# Check if the decode was successful
if [ ! -s "$temp_file" ]; then
  print_error "Failed to decode the provided value. Make sure it's valid base64."
  rm "$temp_file"
  exit 1
fi

# Check if the decoded content is valid YAML
if ! grep -q "apiVersion: v1" "$temp_file" || ! grep -q "kind: Config" "$temp_file"; then
  print_error "The decoded content doesn't appear to be a valid kubeconfig file."
  rm "$temp_file"
  exit 1
fi

# Move the decoded config to the proper location
mv "$temp_file" ~/.kube/config
chmod 600 ~/.kube/config

print_success "✅ Kubernetes config has been saved to ~/.kube/config"
echo

# Test the configuration
print_info "Testing the configuration..."
if kubectl cluster-info &>/dev/null; then
  print_success "✅ Successfully connected to the Kubernetes cluster!"
  
  echo
  echo "Current contexts:"
  kubectl config get-contexts
  
  echo
  print_info "To use your new configuration, run the following command:"
  context_name=$(kubectl config current-context 2>/dev/null || echo "")
  if [ -n "$context_name" ]; then
    echo "kubectl config use-context $context_name"
  else
    print_error "No context found in the config. Please check the file manually."
  fi
  
  echo
  print_info "You can now run the database extraction script:"
  echo "./extract-db-env.sh staging"
  echo "or"
  echo "./extract-db-env.sh production"
else
  print_error "Failed to connect to the Kubernetes cluster."
  print_error "The config file has been saved, but there might be connectivity issues."
  print_info "You may need to:"
  echo "1. Check your network connection"
  echo "2. Verify the cluster is accessible from your location"
  echo "3. Check that any required VPN is connected"
  echo "4. Verify the credentials in the config file are still valid"
fi 