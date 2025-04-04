# Outline Helm Chart

This Helm chart deploys Outline, a wiki and knowledge base for growing teams. Outline is a knowledge base that stores documents, tasks, and other information.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.2.0+
- PV provisioner support in the underlying infrastructure
- An external OAuth provider (Google, Slack, or OIDC)

## Installing the Chart

To install the chart with the release name `outline`:

```bash
# Add Bitnami repo for dependencies
helm repo add bitnami https://charts.bitnami.com/bitnami

# Install the chart with custom values
helm install outline . -f values.yaml
```

## Configuration

The following table lists the configurable parameters of the Outline chart and their default values.

| Parameter                    | Description                            | Default               |
| ---------------------------- | -------------------------------------- | --------------------- |
| `replicaCount.web`           | Number of Outline web pods             | `1`                   |
| `replicaCount.worker`        | Number of Outline worker pods          | `1`                   |
| `replicaCount.collaboration` | Number of Outline collaboration pods   | `1`                   |
| `image.repository`           | Outline image repository               | `outlinewiki/outline` |
| `image.tag`                  | Outline image tag                      | `latest`              |
| `image.pullPolicy`           | Image pull policy                      | `IfNotPresent`        |
| `service.type`               | Kubernetes service type                | `ClusterIP`           |
| `service.port`               | Kubernetes service port                | `80`                  |
| `ingress.enabled`            | Enable ingress controller resource     | `false`               |
| `ingress.host`               | Hostname to your Outline installation  | `outline.local`       |
| `persistence.enabled`        | Enable persistence using PVC           | `true`                |
| `persistence.size`           | PVC Storage Request for Outline volume | `8Gi`                 |
| `autoscaling.enabled`        | Enable autoscaling for Outline         | `false`               |
| `autoscaling.minReplicas`    | Minimum number of replicas             | `1`                   |
| `autoscaling.maxReplicas`    | Maximum number of replicas             | `5`                   |
| `postgresql.enabled`         | Deploy PostgreSQL container(s)         | `true`                |
| `redis.enabled`              | Deploy Redis container(s)              | `true`                |

## Environment Variables

Outline requires several environment variables to be set for proper operation. The most important ones are:

| Variable       | Description                                           |
| -------------- | ----------------------------------------------------- |
| `URL`          | The fully qualified URL for your Outline installation |
| `SECRET_KEY`   | Secret key for sessions                               |
| `UTILS_SECRET` | Secret key for utils                                  |

## Authentication

Outline requires at least one of the following authentication providers:

### Google

```yaml
auth:
  google:
    enabled: true
    clientId: "your-client-id"
    clientSecret: "your-client-secret"
```

### Slack

```yaml
auth:
  slack:
    enabled: true
    clientId: "your-client-id"
    clientSecret: "your-client-secret"
```

### OIDC

```yaml
auth:
  oidc:
    enabled: true
    clientId: "your-client-id"
    clientSecret: "your-client-secret"
    authUri: "https://example.com/auth"
    tokenUri: "https://example.com/token"
    userInfoUri: "https://example.com/userinfo"
    usernameClaim: "email"
```

## Storage

By default, Outline uses the local file system for storage. You can configure it to use AWS S3 or other S3-compatible storage:

```yaml
env:
  FILE_STORAGE: "s3"
  AWS_S3_UPLOAD_BUCKET_NAME: "your-bucket"
  AWS_S3_UPLOAD_BUCKET_URL: "https://your-bucket.s3.amazonaws.com"
  AWS_REGION: "us-east-1"
```

## Multiple environments

You can use different values files for different environments:

- values-staging.yaml: For staging environment
- values-production.yaml: For production environment

Example:

```bash
helm install outline-staging . -f values-staging.yaml
helm install outline-production . -f values-production.yaml
```
