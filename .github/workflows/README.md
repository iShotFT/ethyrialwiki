# Ethyrial Wiki CI/CD Workflows

This directory contains the GitHub Actions workflows for building, testing, and deploying the Ethyrial Wiki (Outline) project.

## Workflows Overview

1. **build-and-publish.yaml**: Builds and publishes Docker images to GitHub Container Registry
2. **deploy.yaml**: Deploys the application to Kubernetes using Helm
3. **pr-checks.yaml**: Runs linting and tests on pull requests
4. **pr-reminder.yaml**: Sends reminders for open pull requests

## Setup Instructions

### 1. GitHub Repository Setup

#### Required Secrets

Add these secrets in your GitHub repository (Settings → Secrets and variables → Actions):

- **KUBE_CONFIG**: Your Kubernetes configuration file (base64 encoded)

  ```bash
  cat ~/.kube/config | base64 -w 0
  ```

- **Optional Cluster-Specific Secrets**:
  - For EKS: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
  - For AKS: `AZURE_CREDENTIALS`
  - For GKE: `GCP_CREDENTIALS`

#### Repository Permissions

Ensure GitHub Actions have permissions to:

- Create and push packages (for Docker images)
- Use the GitHub token for authentication

### 2. Kubernetes Cluster Setup

#### Create Namespaces

```bash
kubectl create namespace ethyrial-staging
kubectl create namespace ethyrial-production
```

#### Create Secrets

For both staging and production environments:

```bash
# Create secret for Discord authentication
kubectl create secret generic outline-auth -n ethyrial-production \
  --from-literal=DISCORD_CLIENT_ID="client_id" \
  --from-literal=DISCORD_CLIENT_SECRET="client_secret" \
  --from-literal=DISCORD_SERVER_ID="server_id"

# Create secret for encryption keys
kubectl create secret generic outline-keys -n ethyrial-production \
  --from-literal=SECRET_KEY="$(openssl rand -hex 32)" \
  --from-literal=UTILS_SECRET="$(openssl rand -hex 32)"

# Create secret for AWS S3 (if using S3 for storage)
kubectl create secret generic outline-s3 -n ethyrial-staging \
  --from-literal=AWS_ACCESS_KEY_ID="your_aws_key" \
  --from-literal=AWS_SECRET_ACCESS_KEY="your_aws_secret"

# Create secret for SMTP (if using email notifications)
kubectl create secret generic outline-smtp -n ethyrial-staging \
  --from-literal=SMTP_USERNAME="your_smtp_username" \
  --from-literal=SMTP_PASSWORD="your_smtp_password"
```

Repeat the same commands for the `ethyrial-production` namespace with appropriate values.

#### Updating Existing Secrets

If you need to update/overwrite existing secrets, use this pattern:

```bash
# Overwrite existing secret for Discord authentication
kubectl create secret generic outline-auth -n ethyrial-staging \
  --from-literal=DISCORD_CLIENT_ID="xxx" \
  --from-literal=DISCORD_CLIENT_SECRET="xxx" \
  --from-literal=DISCORD_SERVER_ID="xxx" \
  --save-config --dry-run=client -o yaml | kubectl apply -f -

# Overwrite existing secret for encryption keys
kubectl create secret generic outline-keys -n ethyrial-staging \
  --from-literal=SECRET_KEY="$(openssl rand -hex 32)" \
  --from-literal=UTILS_SECRET="$(openssl rand -hex 32)" \
  --save-config --dry-run=client -o yaml | kubectl apply -f -
```

This pattern works by:

1. Creating the secret manifest without actually applying it (dry-run)
2. Outputting the manifest as YAML
3. Piping it to `kubectl apply`, which updates existing resources

### 3. External Services Setup

#### Database

Set up a PostgreSQL database for each environment:

- **Staging**: `ethyrial-outline-staging-db`
- **Production**: `ethyrial-outline-production-db`

You can either:

- Use the PostgreSQL subchart (enable in values files)
- Connect to external managed databases (provide connection string in values files)

#### Redis

Set up Redis for each environment:

- **Staging**: `ethyrial-outline-staging-redis`
- **Production**: `ethyrial-outline-production-redis`

You can either:

- Use the Redis subchart (enable in values files)
- Connect to external managed Redis (provide connection string in values files)

#### S3 Bucket (Optional)

If using S3 for file storage:

- **Staging**: `ethyrial-outline-staging-files`
- **Production**: `ethyrial-outline-production-files`

### 4. Helm Values Configuration

The Helm values files reference these secrets and external services:

- **values-staging.yaml**: Configuration for staging environment
- **values-production.yaml**: Configuration for production environment

Example configuration:

```yaml
# values-staging.yaml example
env:
  URL: "https://staging.ethyrial.wiki"
  # Set DATABASE_URL if using external database
  # DATABASE_URL: "postgres://user:password@postgres-host:5432/outline"
  # Set REDIS_URL if using external Redis
  # REDIS_URL: "redis://redis-host:6379"

# Set to false if using external PostgreSQL
postgresql:
  enabled: true

# Set to false if using external Redis
redis:
  enabled: true

# Discord authentication settings
auth:
  discord:
    enabled: true
    # Discord credentials come from the outline-auth secret

# Reference existing secrets (created in step 2)
existingSecrets:
  auth: "outline-auth"
  keys: "outline-keys"
  s3: "outline-s3"
  smtp: "outline-smtp"
```

### 5. DNS Setup

Configure your DNS provider to point:

- `staging.ethyrial.wiki` → Your staging ingress IP
- `ethyrial.wiki` → Your production ingress IP

### 6. CI/CD Workflow Process

#### Build and Publish Workflow

Triggered automatically on:

- Push to main branch
- Manual workflow dispatch

Process:

1. Builds Docker images (base and app)
2. Tags images with commit SHA and branch name
3. Pushes images to GitHub Container Registry (ghcr.io)

#### Deploy Workflow

Triggered manually with parameters:

Parameters:

- **Environment**: staging or production
- **Version**: latest (or specific SHA/tag)
- **Services**: all (or specific services like "web,worker")

Process:

1. Sets up kubectl and Helm
2. Deploys using Helm with environment-specific values
3. Verifies the deployment

### 7. Running Deployments

To deploy:

1. Go to GitHub Actions → Workflows → Deploy
2. Click "Run workflow"
3. Select:
   - **Environment**: staging or production
   - **Version**: latest (or specific SHA/tag)
   - **Services**: all (or specific services like "web,worker")
4. Click "Run workflow"

The workflow will automatically prefix the environment name with "ethyrial-" when creating the namespace.

### 8. Environment Variables Source

The environment variables come from multiple sources:

1. **Secret values** (from Kubernetes secrets created in step 2)
2. **ConfigMap values** (from the Helm chart templates)
3. **Values files** (from `values-staging.yaml` and `values-production.yaml`)
4. **Default values** (embedded in the Helm chart)

The deployment hierarchy is:

1. Kubernetes secret (highest priority)
2. `values-{environment}.yaml` file
3. `values.yaml` (defaults)

### 9. First-Time Deployment

For the first deployment:

1. Push code to the main branch to trigger image build
2. Run the deploy workflow manually, selecting "staging"
3. Verify everything is working in staging
4. When ready, run the deploy workflow for "production"

## Troubleshooting

### Common Issues

1. **Image not found**: Verify that the build workflow completed successfully
2. **Deployment failed**: Check Kubernetes logs:
   ```bash
   kubectl logs -n ethyrial-<environment> -l app.kubernetes.io/name=outline -c <container>
   ```
3. **Secret not found**: Verify that you created all required secrets in the Kubernetes namespace
4. **Database connection error**: Check database credentials and network connectivity
5. **Redis connection error**: Check Redis credentials and network connectivity
6. **PostgreSQL SSL connection error**: By default, the chart is configured to use `sslmode=disable` for PostgreSQL connections. If you need SSL, update the connection strings accordingly.
7. **Pod communication issues**: If running on MicroK8s or other clusters where pod-to-pod communication is restricted, the chart will use `hostNetwork: true` by default in staging and production. If this is not desired, set `hostNetwork: false` in your values file.
8. **DNS resolution issues**: MicroK8s sometimes has DNS resolution problems. The chart includes a custom `dnsConfig` that points to the CoreDNS service IP and adds the appropriate search domains. If you encounter DNS-related issues, check if the CoreDNS service IP matches the one configured in the deployment templates.

### MicroK8s Specific Setup

If deploying to MicroK8s, make sure:

1. The CoreDNS addon is enabled: `microk8s enable dns`
2. The DNS service IP (usually 10.152.183.10) matches the one in the deployment templates
3. Network policies allow traffic between pods (if CNI is enabled)

### Viewing Deployment Status

```bash
# Check deployment status
kubectl get deployments -n ethyrial-<environment>

# Check pods status
kubectl get pods -n ethyrial-<environment>

# Check services
kubectl get services -n ethyrial-<environment>

# Check ingress
kubectl get ingress -n ethyrial-<environment>
```

### Rolling Back a Deployment

If a deployment fails:

```bash
# Roll back to the previous release
helm rollback outline -n ethyrial-<environment>
```
