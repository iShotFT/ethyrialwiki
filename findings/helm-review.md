# Helm Chart Analysis for Reliable CI/CD Deployment

After carefully reviewing the Helm chart files, I've identified several areas that need attention to ensure reliable automated deployments through CI/CD when moving to a new server. Below is a comprehensive analysis with recommendations.

## Critical Issues

### 1. Ingress Configuration

The ingress setup is currently using NodePorts that do not appear to bind properly to the host network:

```yaml
ingress:
  enabled: true
  className: "nginx"
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    kubernetes.io/tls-acme: "true"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
```

**Recommendation:** Update the ingress configuration to ensure it works with the Nginx ingress controller deployed by our setup script. The current setup relies on an external Nginx Proxy Manager to route traffic to the pod IPs, which is not ideal for a portable solution.

### 2. Storage Configuration

The storage class configuration is set to:

```yaml
storageClasses:
  create: false # Don't create new storage classes, they should exist already
  adoptExisting: false # Don't try to adopt existing storage classes
```

This assumes that `local-path` storage classes already exist, which may not be true on a new server.

**Recommendation:** Set `storageClasses.create: true` in your values files to ensure the required storage classes are created automatically during deployment.

### 3. Hardcoded Node IP References

The current working configuration relies on direct pod IP communication:

```yaml
# In Nginx Proxy Manager (not in Helm values)
Forward Hostname/IP: 10.42.0.15 # Direct pod IP
```

**Recommendation:** Instead of relying on direct pod IPs, use the Kubernetes service DNS names within the cluster. If external access is required, ensure services are properly exposed through NodePorts or LoadBalancer services.

## Necessary Changes

### 1. Update `values-staging.yaml` and `values-production.yaml`

The following changes are needed:

1. **Storage Classes:**

```yaml
storageClasses:
  create: true # Changed from false
  adoptExisting: true # Changed from false
```

2. **Host Network Option:**
   If you want to use NodePorts properly, consider:

```yaml
hostNetwork: true # For pods that need direct host network access
```

3. **Service Type Configuration:**
   Add explicit service type configuration:

```yaml
service:
  type: NodePort # Or ClusterIP if using ingress properly
  port: 3000
  nodePort: 30080 # Only if type is NodePort
```

### 2. Ingress Configuration Improvements

The ingress.yaml template should be updated to better handle TLS and host rules:

```yaml
spec:
  {{- if .Values.ingress.className }}
  ingressClassName: {{ .Values.ingress.className }}
  {{- end }}
  {{- if .Values.ingress.tls.enabled }}
  tls:
    - hosts:
        - {{ .Values.ingress.host | quote }}
      secretName: {{ .Values.ingress.tls.secretName }}
  {{- end }}
```

**Recommendation:** Ensure that TLS is properly configured and that the ingress controller has access to certificates (either through cert-manager or manually created secrets).

### 3. Environment Variables Management

The FORCE_HTTPS environment variable is correctly set to false, but we should make it more explicit:

```yaml
env:
  # URLs and Networking
  URL: "https://staging.ethyrial.wiki"
  COLLABORATION_URL: "wss://staging.ethyrial.wiki/collaboration"
  PORT: 3000
  FORCE_HTTPS: false # SSL termination handled by Nginx Proxy Manager
```

**Recommendation:** Add comments to clarify that SSL termination is handled externally, and ensure this setup is consistent across environments.

## Additional Recommendations

### 1. Create a ConfigMap for Nginx Proxy Manager

Add a template to generate a ConfigMap with Nginx Proxy Manager configurations:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "outline.fullname" . }}-npm-config
  labels:
    {{- include "outline.labels" . | nindent 4 }}
data:
  domains: "staging.ethyrial.wiki ethyrial.wiki"
  npm-proxy-settings.json: |
    {
      "domains": ["{{ .Values.ingress.host }}"],
      "forward_scheme": "https",
      "forward_port": 443,
      "use_ssl": true
    }
```

### 2. Add Health Check Endpoints to Service

The health check endpoints are already configured in the deployment, but ensure they're also accessible through the service:

```yaml
service:
  # ...
  ports:
    - name: http
      port: 3000
      targetPort: http
      protocol: TCP
  # ...
```

### 3. Add Init Container for Storage Preparation

Add an init container to ensure storage permissions are properly set:

```yaml
initContainers:
  - name: volume-permissions
    image: busybox
    command: ["sh", "-c", "chown -R 1000:1000 /data"]
    volumeMounts:
      - name: data
        mountPath: /data
```

## Action Items for CI/CD Deployment

1. **Update Storage Class Configuration:**

   - Set `storageClasses.create: true` in values files
   - Ensure persistent volume paths exist on the host

2. **Fix Ingress Configuration:**

   - Use NodePort or create a LoadBalancer service for the ingress controller
   - Configure ingress resource with proper TLS settings

3. **Improve Service Discovery:**

   - Use Kubernetes DNS for internal communication
   - Setup a mechanism to discover and configure the ingress pod IP for Nginx Proxy Manager

4. **Automate Nginx Proxy Manager Configuration:**

   - Use the provided API script to update NPM to point to the current ingress pod IP

5. **Add Validation Steps to CI/CD Pipeline:**
   - Test service connectivity after deployment
   - Verify health check endpoints
   - Test full request path from ingress to services

By implementing these changes, your Helm chart will be more robust and portable, allowing for reliable CI/CD deployments to new servers without requiring manual intervention.
