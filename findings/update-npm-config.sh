#!/bin/bash
# Script to update Nginx Proxy Manager proxy hosts via API
# This script finds the ingress controller pod IP and updates NPM configurations

# Exit on error
set -e

# Configuration
NPM_EMAIL=${NPM_EMAIL:-"admin@example.com"}
NPM_PASSWORD=${NPM_PASSWORD:-"changeme"}
NPM_API_URL=${NPM_API_URL:-"http://localhost:81/api"}
KUBECONFIG=${KUBECONFIG:-"/etc/rancher/k3s/k3s.yaml"}

# Domains to configure (space-separated)
DOMAINS=${DOMAINS:-"staging.ethyrial.wiki ethyrial.wiki"}

# Get the current ingress controller pod IP
echo "Getting current ingress controller pod IP..."
INGRESS_POD_IP=$(kubectl --kubeconfig=$KUBECONFIG get pods -n ingress-nginx -o jsonpath='{.items[0].status.podIP}')

if [ -z "$INGRESS_POD_IP" ]; then
    echo "Error: Could not get ingress controller pod IP"
    exit 1
fi

echo "Ingress controller pod IP: $INGRESS_POD_IP"

# Function to authenticate with NPM API
npm_authenticate() {
    echo "Authenticating with Nginx Proxy Manager API..."
    TOKEN=$(curl -s -X POST "$NPM_API_URL/tokens" \
        -H "Content-Type: application/json" \
        -d "{\"identity\":\"$NPM_EMAIL\",\"secret\":\"$NPM_PASSWORD\"}" | jq -r '.token')
    
    if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
        echo "Error: Authentication failed"
        exit 1
    fi
    
    echo "Authentication successful"
}

# Function to get proxy hosts
get_proxy_hosts() {
    echo "Getting list of proxy hosts..."
    PROXY_HOSTS=$(curl -s -X GET "$NPM_API_URL/nginx/proxy-hosts" \
        -H "Authorization: Bearer $TOKEN")
    
    echo "Retrieved proxy hosts"
}

# Function to update a proxy host
update_proxy_host() {
    local id=$1
    local domain=$2
    local current_config=$(echo $PROXY_HOSTS | jq ".[] | select(.id == $id)")
    
    echo "Updating proxy host for $domain (ID: $id) to forward to $INGRESS_POD_IP:443..."
    
    # Create updated configuration
    local updated_config=$(echo $current_config | jq ".forward_host = \"$INGRESS_POD_IP\"")
    
    # Update the proxy host
    curl -s -X PUT "$NPM_API_URL/nginx/proxy-hosts/$id" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "$updated_config" > /dev/null
    
    echo "Updated proxy host for $domain"
}

# Main execution
npm_authenticate
get_proxy_hosts

# Update each domain
for DOMAIN in $DOMAINS; do
    echo "Processing $DOMAIN..."
    PROXY_ID=$(echo $PROXY_HOSTS | jq ".[] | select(.domain_names | contains([\"$DOMAIN\"])) | .id")
    
    if [ -z "$PROXY_ID" ] || [ "$PROXY_ID" == "null" ]; then
        echo "Warning: No proxy host found for $DOMAIN"
        continue
    fi
    
    update_proxy_host $PROXY_ID $DOMAIN
done

echo "All proxy hosts updated successfully!"
echo "Current ingress controller pod IP: $INGRESS_POD_IP"

# Add this script to cron to run periodically
cat > /tmp/npm-update-cron << EOF
#!/bin/bash
# Add this to crontab to run every hour:
# 0 * * * * /path/to/update-npm-config.sh > /var/log/npm-update.log 2>&1

# Instructions to add to crontab:
# crontab -e
# Add the line: 0 * * * * /path/to/update-npm-config.sh > /var/log/npm-update.log 2>&1
EOF

echo ""
echo "Note: This script requires jq to be installed."
echo "Install jq with: apt-get install -y jq"
echo ""
echo "To run this script automatically when the ingress pod IP changes,"
echo "add it to crontab to run periodically."
echo "" 