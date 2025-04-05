# Outline Memory Requirements Analysis

## Problem Summary

We encountered persistent OOMKilled errors in our production environment while the staging environment was stable. This document captures our findings and the solution to prevent these issues in the future.

## Memory Usage Patterns

Through investigation, we observed the following memory consumption patterns for Outline:

| Component     | Observed Memory Usage | Required Limit |
| ------------- | --------------------- | -------------- |
| Web           | 4-7GB                 | 8GB            |
| Worker        | 4-6GB                 | 8GB            |
| Collaboration | 300-350MB             | 2GB            |

## Root Cause Analysis

The default memory limits were insufficient for the Outline application:

- Initially set to 2GB for web and worker pods in production
- Staging was already configured with 8GB limits, explaining why it worked
- The high memory usage is associated with JavaScript/Node.js app initialization and database migrations

## Solution Implemented

We've made the following changes to our Helm charts:

1. Increased memory limits:

   ```yaml
   resources:
     web:
       limits:
         memory: 8Gi
     worker:
       limits:
         memory: 8Gi
   ```

2. Reduced the replica count to 1 for both web and worker pods

   ```yaml
   replicaCount:
     web: 1
     worker: 1
   ```

3. Adjusted autoscaling to start with only 1 replica
   ```yaml
   autoscaling:
     minReplicas: 1
   ```

## Symptoms to Watch For

If you notice any of these symptoms, it may indicate memory pressure:

1. Pods repeatedly showing `CrashLoopBackOff` with previous state as `OOMKilled`
2. Output from `kubectl describe pod` showing:
   ```
   Last State: Terminated
   Reason: OOMKilled
   Exit Code: 137
   ```
3. Memory usage approaching limits in `kubectl top pods` output

## Future Considerations

1. **Monitoring**: Set up memory usage alerts for pods approaching 80% of their limits
2. **Scaling Strategy**: Consider horizontal scaling only after ensuring vertical scaling is properly configured
3. **Node Size**: Ensure your K3s nodes have enough available memory for these larger containers
4. **Resource Quotas**: Consider setting namespace resource quotas to prevent overallocation

## Appendix: Testing Commands

To check memory usage:

```bash
kubectl top pods -n <namespace>
```

To view pod status and find OOMKilled events:

```bash
kubectl describe pod -n <namespace> <pod-name>
```
