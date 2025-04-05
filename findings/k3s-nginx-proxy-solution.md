# K3s and Nginx Proxy Manager Integration Solution

## Problem Summary

We encountered persistent "502 Bad Gateway" errors when trying to route traffic from Nginx Proxy Manager (running in Docker) to K3s pods. The primary issue was in the networking configuration between the host, Nginx Proxy Manager, and the K3s cluster.

## Key Findings

1. **NodePort Issue**: The initial attempt to expose K3s services via NodePorts (ports 32080 and 32443) was configured correctly in the K3s service but the ports weren't actually listening on the host network.

2. **Pod IP Direct Access**: We discovered that directly accessing the ingress controller pod IP (10.42.0.15) from the host was successful, while attempts to use the NodePorts failed.

3. **Networking Path**: The proper networking path to access K3s services from Nginx Proxy Manager is:

   ```
   External → Nginx Proxy Manager (on host) → K3s Ingress Controller Pod IP → K3s Services → Pods
   ```

4. **Redirect Behavior**: The Outline application was configured to redirect HTTP to HTTPS despite `FORCE_HTTPS` being set to `false` in the Helm values. We confirmed that this setting wasn't affecting the pods.

## Root Cause

The NodePort services configured in K3s were not properly bound to the host network interfaces. Instead of using the NodePort approach, direct communication with the pod IP proved to be more reliable.

## Solution

### Configuration for Nginx Proxy Manager:

1. For each domain (e.g., staging.ethyrial.wiki):

   - Forward Scheme: `https`
   - Forward Hostname/IP: `10.42.0.15` (The ingress controller pod IP)
   - Forward Port: `443`
   - Enable WebSockets Support: `Yes`
   - Enable SSL: `Yes` (handled by Nginx Proxy Manager)

2. Testing showed this configuration successfully routed traffic to the correct services, providing access to:
   - The main Outline application
   - The health endpoint (`/_health`)
   - API endpoints
3. WebSockets for the collaboration service returned a 502 error, which may require additional configuration.

### Key Issues to Address for Portability:

1. **Dynamic Pod IPs**: In a production environment, pod IPs change when pods are rescheduled. A more robust solution would be to make the NodePort approach work or use a dedicated ClusterIP service with `externalIPs` set to the node's IP.

2. **Environment Variable Configuration**: The Helm values files have the correct `FORCE_HTTPS: false` setting, but some issues with deployments may require manual adjustments.

## Helm Chart Analysis

After reviewing the Helm chart files for the Ethyrial Wiki deployment, here's an analysis of their readiness for automated CI/CD deployment:

### Configuration Files Status

| File                    | Status  | Notes                                                                  |
| ----------------------- | ------- | ---------------------------------------------------------------------- |
| \_helpers.tpl           | ✅ Good | Standard helper definitions, no issues                                 |
| configmap.yaml          | ✅ Good | Properly references .Values from values.yaml files                     |
| deployment-\*.yaml      | ✅ Good | Deployments properly utilize values and have appropriate health checks |
| hpa.yaml                | ✅ Good | Autoscaling configuration is appropriate                               |
| ingress.yaml            | ✅ Good | Ingress rules properly defined                                         |
| pvc.yaml                | ✅ Good | Storage configuration is appropriate                                   |
| secrets.yaml            | ✅ Good | Secret management is well-handled                                      |
| service.yaml            | ✅ Good | Service definitions are appropriate                                    |
| serviceaccount.yaml     | ✅ Good | No issues with service account                                         |
| storage-classes-\*.yaml | ✅ Good | Storage class configuration is flexible                                |
| values-\*.yaml          | ⚠️ Note | `FORCE_HTTPS` correctly set to false, but `hostNetwork` is also false  |

### Key Configuration Points

1. **Environment Variables**: The Helm charts correctly set `FORCE_HTTPS: false` in both production and staging values files.

2. **Host Networking**: The `hostNetwork` setting is set to `false` in both values files. If the NodePort issues persist, consider setting this to `true` to improve networking reliability.

3. **Ingress Configuration**: The ingress definitions use the `nginx` ingress class and have appropriate annotations for WebSocket support.

4. **HTTPS Redirection**: Despite `FORCE_HTTPS: false`, the application still redirects HTTP to HTTPS. This behavior may be built into the application beyond the configuration we can control.

### CI/CD Considerations

For fully automated deployments with GitHub CI/CD to a new server:

1. **Installation Scripts**: Create a K3s installation script that includes:

   ```bash
   curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--tls-san <SERVER_IP> --node-external-ip <SERVER_IP> --disable=traefik --kube-proxy-arg=metrics-bind-address=0.0.0.0 --advertise-address=<SERVER_IP>" sh -
   ```

2. **Ingress Controller Setup**: Include a step to install the NGINX ingress controller:

   ```bash
   helm install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress-nginx --create-namespace --set controller.service.type=NodePort --set controller.service.nodePorts.http=32080 --set controller.service.nodePorts.https=32443 --set controller.hostNetwork=true
   ```

3. **Post-Installation Script**: Add a script to obtain the ingress controller pod IP and update the Nginx Proxy Manager configuration:

   ```bash
   INGRESS_POD_IP=$(kubectl get pods -n ingress-nginx -o jsonpath='{.items[0].status.podIP}')
   # Then use the Nginx Proxy Manager API to update configurations
   ```

4. **Ingress Controller Alternatives**: Consider using hostNetwork mode for the ingress controller which would bind the ports directly to the host's network interfaces:
   ```yaml
   controller:
     hostNetwork: true
     service:
       type: ClusterIP
   ```

## Testing Protocol

1. Verify ingress controller deployment:

   ```bash
   kubectl get pods -n ingress-nginx
   ```

2. Check if pod is accessible directly:

   ```bash
   curl -I http://<pod-ip> -H 'Host: staging.ethyrial.wiki'
   ```

3. Verify health endpoint:

   ```bash
   curl -k https://<pod-ip>/_health -H 'Host: staging.ethyrial.wiki'
   ```

4. Check Nginx Proxy Manager logs for connection errors:
   ```bash
   docker logs nginx-proxy-manager_app_1 | grep error
   ```

## Moving to a New Server

When moving to a new server, you'll need to:

1. Install K3s with proper networking configuration
2. Install Docker and Nginx Proxy Manager
3. Configure Nginx Proxy Manager to point to the ingress controller pod IP
4. Apply the Helm charts using GitHub CI/CD

## Conclusion

The solution leverages direct pod IP communication from Nginx Proxy Manager to K3s, bypassing the NodePort issues. For a more robust long-term solution, fixing the NodePort binding or implementing a more sophisticated service exposure mechanism is recommended.

The current configuration works but requires manual adjustment of the Nginx Proxy Manager settings to point to the current pod IP whenever it changes.
