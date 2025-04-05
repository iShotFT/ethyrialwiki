# GitHub Actions Workflow for K3s and Nginx Proxy Manager Deployment

Below is a GitHub Actions workflow file that automates the deployment of your application to a K3s cluster with proper Nginx Proxy Manager configuration.

## `.github/workflows/deploy.yml`

```yaml
name: Deploy to K3s Server

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up SSH key
        uses: webfactory/ssh-agent@v0.7.0
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}

      - name: Setup kubectl
        uses: azure/setup-kubectl@v3

      - name: Setup Helm
        uses: azure/setup-helm@v3
        with:
          version: "latest"

      - name: Deploy k3s and ingress if needed
        run: |
          # Check if K3s is already installed
          ssh -o StrictHostKeyChecking=no ${{ secrets.SSH_USER }}@${{ secrets.SERVER_IP }} "which k3s || echo 'needs-install'" > k3s-check.txt

          if grep -q "needs-install" k3s-check.txt; then
            echo "Installing K3s and Nginx Ingress Controller..."
            # Upload the installation script
            scp -o StrictHostKeyChecking=no ./findings/k3s-setup.sh ${{ secrets.SSH_USER }}@${{ secrets.SERVER_IP }}:/tmp/
            
            # Make it executable and run it
            ssh -o StrictHostKeyChecking=no ${{ secrets.SSH_USER }}@${{ secrets.SERVER_IP }} "chmod +x /tmp/k3s-setup.sh && sudo /tmp/k3s-setup.sh"
          else
            echo "K3s already installed, skipping installation"
          fi

      - name: Get kubeconfig
        run: |
          # Get kubeconfig from the server
          ssh -o StrictHostKeyChecking=no ${{ secrets.SSH_USER }}@${{ secrets.SERVER_IP }} "sudo cat /etc/rancher/k3s/k3s.yaml" > kubeconfig.yaml
          # Update server IP in kubeconfig
          sed -i "s/127.0.0.1/${{ secrets.SERVER_IP }}/g" kubeconfig.yaml
          echo "KUBECONFIG=kubeconfig.yaml" >> $GITHUB_ENV

      - name: Deploy Helm Charts
        run: |
          # Deploy/upgrade staging environment
          helm upgrade --install ethyrial-staging ./deploy/helm/outline -f ./deploy/helm/outline/values-staging.yaml -n ethyrial-staging --create-namespace

          # Deploy/upgrade production environment
          helm upgrade --install ethyrial-prod ./deploy/helm/outline -f ./deploy/helm/outline/values-production.yaml -n ethyrial-prod --create-namespace

      - name: Wait for deployments to be ready
        run: |
          kubectl -n ethyrial-staging rollout status deployment/outline-web
          kubectl -n ethyrial-staging rollout status deployment/outline-worker
          kubectl -n ethyrial-staging rollout status deployment/outline-collaboration

          kubectl -n ethyrial-prod rollout status deployment/outline-web
          kubectl -n ethyrial-prod rollout status deployment/outline-worker
          kubectl -n ethyrial-prod rollout status deployment/outline-collaboration

      - name: Update Nginx Proxy Manager Configuration
        run: |
          # Upload the NPM configuration script
          scp -o StrictHostKeyChecking=no ./findings/update-npm-config.sh ${{ secrets.SSH_USER }}@${{ secrets.SERVER_IP }}:/tmp/

          # Make it executable and run it with the appropriate credentials
          ssh -o StrictHostKeyChecking=no ${{ secrets.SSH_USER }}@${{ secrets.SERVER_IP }} "chmod +x /tmp/update-npm-config.sh && sudo NPM_EMAIL='${{ secrets.NPM_EMAIL }}' NPM_PASSWORD='${{ secrets.NPM_PASSWORD }}' NPM_API_URL='${{ secrets.NPM_API_URL }}' /tmp/update-npm-config.sh"

      - name: Verify deployment
        run: |
          # Get ingress pod IP
          INGRESS_POD_IP=$(kubectl get pods -n ingress-nginx -o jsonpath='{.items[0].status.podIP}')
          echo "Ingress controller pod IP: $INGRESS_POD_IP"

          # Check if web services are running
          kubectl get pods -n ethyrial-staging
          kubectl get pods -n ethyrial-prod

          echo "Deployment complete! Verify access at your domains."
```

## Required GitHub Secrets

You need to add the following secrets to your GitHub repository:

1. `SSH_PRIVATE_KEY` - The private SSH key to access your server
2. `SSH_USER` - The SSH username for the server
3. `SERVER_IP` - The IP address of your server
4. `NPM_EMAIL` - The email used to log into Nginx Proxy Manager
5. `NPM_PASSWORD` - The password for Nginx Proxy Manager
6. `NPM_API_URL` - The API URL for Nginx Proxy Manager (usually http://localhost:81/api or http://your-server-ip:81/api)

## How This Works

This workflow:

1. Checks if K3s is already installed on the server
2. If not, installs K3s and sets up the Nginx ingress controller
3. Gets the kubeconfig file from the server to access the K3s cluster
4. Deploys/upgrades both staging and production environments using Helm
5. Waits for all deployments to be ready
6. Updates the Nginx Proxy Manager configuration to point to the current ingress controller pod IP
7. Verifies the deployment by checking the pod statuses

## Setting Up GitHub Actions

1. Create the `.github/workflows` directory in your repository if it doesn't exist
2. Add the `deploy.yml` file with the content above
3. Add all required secrets to your GitHub repository
4. Push to the main branch or manually trigger the workflow

This workflow can be further customized based on your specific requirements, such as adding testing steps before deployment or setting up notifications.
