#!/bin/bash

# Script to set up kubectl configuration on Windows with Git Bash
# This will configure kubectl to connect to your Kubernetes cluster

# Ensure the .kube directory exists in the user's home directory
mkdir -p "$HOME/.kube"

# Check if config file already exists and back it up if needed
if [ -f "$HOME/.kube/config" ]; then
  echo "Existing kubectl config found at $HOME/.kube/config"
  echo "Creating backup..."
  cp "$HOME/.kube/config" "$HOME/.kube/config.backup.$(date +%Y%m%d-%H%M%S)"
  echo "Backup created!"
fi

# Create the config file with the proper content
cat > "$HOME/.kube/config" << 'EOL'
apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUJkekNDQVIyZ0F3SUJBZ0lCQURBS0JnZ3Foa2pPUFFRREFqQWpNU0V3SHdZRFZRUUREQmhyTTNNdGMyVnkKZG1WeUxXTmhRREUzTkRNNE5EVXlNRGt3SGhjTk1qVXdOREExTURreU5qUTVXaGNOTXpVd05EQXpNRGt5TmpRNQpXakFqTVNFd0h3WURWUVFEREJock0zTXRjMlZ5ZG1WeUxXTmhRREUzTkRNNE5EVXlNRGt3V1RBVEJnY3Foa2pPClBRSUJCZ2dxaGtqT1BRTUJCd05DQUFUc3VaeWFBdjlzTVZlRWE2R0xrbncvaGJNNnRBeFpjK3A1bXBVTHpFS3EKN0x3QlU3bXQ2cUlrTXB0WEg0YUxTbWt5bmgrUk5uT2svUWhBWlVqWVIxTVRvMEl3UURBT0JnTlZIUThCQWY4RQpCQU1DQXFRd0R3WURWUjBUQVFIL0JBVXdBd0VCL3pBZEJnTlZIUTRFRmdRVUdkdUJGNUkyTmFLNU9HYU82QUZzCkJkNW82UXN3Q2dZSUtvWkl6ajBFQXdJRFNBQXdSUUloQU1hUXVFbFRESkIrUlo4WFBYYWtmSHlqanhwdjBIRWsKOG44QUNQcmZXdnlBQWlBUVFQd01DRUk1UFRlRTF2WWRnUFZCU0h3dHU5bGJjN1FpdXdxTzJFUzVZQT09Ci0tLS0tRU5EIENFUlRJRklDQVRFLS0tLS0K
    server: https://49.12.174.134:6443
  name: default
contexts:
- context:
    cluster: default
    user: default
  name: default
current-context: default
kind: Config
preferences: {}
users:
- name: default
  user:
    client-certificate-data: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUJrVENDQVRlZ0F3SUJBZ0lJSk5mRjZwN1UrRTh3Q2dZSUtvWkl6ajBFQXdJd0l6RWhNQjhHQTFVRUF3d1kKYXpOekxXTnNhV1Z1ZEMxallVQXhOelF6T0RRMU1qQTVNQjRYRFRJMU1EUXdOVEE1TWpZME9Wb1hEVEkyTURRdwpOVEE1TWpZME9Wb3dNREVYTUJVR0ExVUVDaE1PYzNsemRHVnRPbTFoYzNSbGNuTXhGVEFUQmdOVkJBTVRESE41CmMzUmxiVHBoWkcxcGJqQlpNQk1HQnlxR1NNNDlBZ0VHQ0NxR1NNNDlBd0VIQTBJQUJKSmxENVVtcTZvQzc2WTcKZmhKRVovRzNLbHhMYmU1VHk0SkJOckg4TldxOHAvdXJIcmw3SGpNaVlqWUJsSmFqQUd4YXJKazZsdGtaMHpLcwozWXdwUDVTalNEQkdNQTRHQTFVZER3RUIvd1FFQXdJRm9EQVRCZ05WSFNVRUREQUtCZ2dyQmdFRkJRY0RBakFmCkJnTlZIU01FR0RBV2dCUm1Hc3h3cUxVYUJtQVBLT3BYdVFtZkpJY3g2VEFLQmdncWhrak9QUVFEQWdOSUFEQkYKQWlCVWZQb1Z2UjRIQ3N2aWZQZHJ0NDcyT2pRcHNLTitpZmJEVFo4eDJsbGlGQUloQU9WekhzTEYyNjNjbTJZcAp4M3ZZN2V2V2FVVWpWK0k1S05zR2t6am5IM0ZwCi0tLS0tRU5EIENFUlRJRklDQVRFLS0tLS0KLS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUJkVENDQVIyZ0F3SUJBZ0lCQURBS0JnZ3Foa2pPUFFRREFqQWpNU0V3SHdZRFZRUUREQmhyTTNNdFkyeHAKWlc1MExXTmhRREUzTkRNNE5EVXlNRGt3SGhjTk1qVXdOREExTURreU5qUTVXaGNOTXpVd05EQXpNRGt5TmpRNQpXakFqTVNFd0h3WURWUVFEREJock0zTXRZMnhwWlc1MExXTmhRREUzTkRNNE5EVXlNRGt3V1RBVEJnY3Foa2pPClBRSUJCZ2dxaGtqT1BRTUJCd05DQUFSREVKUkt6dllOTmI0UVNMazRhRTJkWlFFYWN2Z3Q1Wkc3TzhJU3FqeXYKVGJDdTVrUmRENnpIR1M3eDdESHJwMElYeEwxSnorMXpCSkN5MjBzbTZOS1pvMEl3UURBT0JnTlZIUThCQWY4RQpCQU1DQXFRd0R3WURWUjBUQVFIL0JBVXdBd0VCL3pBZEJnTlZIUTRFRmdRVVpock1jS2kxR2daZ0R5anFWN2tKCm55U0hNZWt3Q2dZSUtvWkl6ajBFQXdJRFJnQXdRd0lnY1I3YklBSHd0bDB0a2RuUk56QkNodk83K0dFbk43NUMKU3Y0cmFhRnZjZklDSHlUY1RRNm0rYkd3OWswclF5anpXdlRERTRONXdkODErekQySUhHcDF4WT0KLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo=
    client-key-data: LS0tLS1CRUdJTiBFQyBQUklWQVRFIEtFWS0tLS0tCk1IY0NBUUVFSUZIUy9UK3k5Zk9VY1NkSExYSDBtSkNjaElDQTZIMGlxQzJudFI3SzBJempvQW9HQ0NxR1NNNDkKQXdFSG9VUURRZ0FFa21VUGxTYXJxZ0x2cGp0K0VrUm44YmNxWEV0dDdsUExna0Uyc2Z3MWFyeW4rNnNldVhzZQpNeUppTmdHVWxxTUFiRnFzbVRxVzJSblRNcXpkakNrL2xBPT0KLS0tLS1FTkQgRUMgUFJJVkFURSBLRVktLS0tLQo=
EOL

# Set appropriate permissions (as much as Git Bash on Windows allows)
chmod 600 "$HOME/.kube/config"

echo "Kubernetes config has been saved to $HOME/.kube/config"
echo "Testing the configuration..."

# Test the configuration
if kubectl cluster-info &>/dev/null; then
  echo "✅ Successfully connected to the Kubernetes cluster!"
  
  # Show available namespaces
  echo "Available namespaces:"
  kubectl get namespaces
  
  # Show available contexts
  echo "Available contexts:"
  kubectl config get-contexts
  
  # Print instructions for using the database scripts
  echo ""
  echo "You can now use the database extraction scripts:"
  echo "./tools/scripts/extract-db-env.sh staging"
  echo "or"
  echo "./tools/scripts/extract-db-env.sh production"
  
  # Print port-forwarding instructions
  echo ""
  echo "To connect to database services, use:"
  echo "./tools/scripts/db-port-forward.sh staging <service-name>"
  echo "Example: ./tools/scripts/db-port-forward.sh staging postgres"
else
  echo "❌ Failed to connect to the Kubernetes cluster."
  echo "Error details:"
  kubectl cluster-info 2>&1 | head -n 10
  
  echo ""
  echo "Troubleshooting steps:"
  echo "1. Check if your network blocks the connection to the Kubernetes API server (https://49.12.174.134:6443)"
  echo "2. Try accessing the server with curl to see the response:"
  echo "   curl -k https://49.12.174.134:6443/api"
  echo "3. Make sure you're not behind a proxy that interferes with the connection"
  echo "4. If you're using a VPN, try disconnecting it temporarily"
fi 