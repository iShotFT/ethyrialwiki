# Storage Class Helm Integration Issue

## Problem

When attempting to deploy or upgrade the Helm chart in production, we encountered the following error:

```
Error: UPGRADE FAILED: Unable to continue with update: StorageClass "local-path" in namespace "" exists and cannot be imported into the current release: invalid ownership metadata; label validation error: missing key "app.kubernetes.io/managed-by": must be set to "Helm"; annotation validation error: missing key "meta.helm.sh/release-name": must be set to "outline"; annotation validation error: missing key "meta.helm.sh/release-namespace": must be set to "ethyrial-production"
```

This occurs because:

1. The storage class `local-path` already exists on the K3s cluster
2. Helm is trying to adopt this existing storage class into its release
3. The existing storage class lacks the required Helm labels and annotations

## Solution

We implemented a two-part solution:

### 1. Disable Storage Class Creation/Adoption in Helm Values

In `values-production.yaml`:

```yaml
# Storage class configuration
storageClasses:
  create: false # Don't create new storage classes
  adoptExisting: false # Don't try to adopt existing storage classes
```

This prevents Helm from trying to create or adopt the storage class during the initial release.

### 2. Add a Pre-Install/Pre-Upgrade Job

Created a new template `storage-init-job.yaml` that runs before Helm installs or upgrades the release:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "outline.fullname" . }}-storage-init
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  # Job configuration...
  template:
    spec:
      containers:
        - name: kubectl
          image: bitnami/kubectl:latest
          command:
            - /bin/sh
            - -c
            - |
              # Add required labels and annotations for Helm to manage the storage class
              kubectl annotate storageclass local-path meta.helm.sh/release-name={{ .Release.Name }} meta.helm.sh/release-namespace={{ .Release.Namespace }} --overwrite
              kubectl label storageclass local-path app.kubernetes.io/managed-by=Helm --overwrite
```

This job adds the required labels and annotations to the existing storage class before Helm tries to manage it.

## When to Use This Solution

Enable this solution in environments where:

1. The storage class already exists
2. You're running into Helm adoption errors
3. You need to deploy without modifying the existing storage infrastructure

For new environments where you're creating the storage class as part of the deployment, you can use the standard approach with `storageClasses.create: true`.

## Implementation

To use this solution:

1. Add the `storage-init-job.yaml` template to your Helm chart
2. Configure your values file:

```yaml
storageInit:
  enabled: true # Enable in environments with existing storage classes
```

This approach allows for more flexible deployments across different environments while maintaining Helm's release management capabilities.
