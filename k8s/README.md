# k8s — Kubernetes Manifests (kustomize)

**What this does:** declares how every Mugheer service runs in Kubernetes — deployments with resource limits, probes and non-root security contexts, services, autoscaling, TLS ingress, and **NetworkPolicies that enforce the three-tier rule at the network level** (frontend pods can never reach database pods, period). Two overlays (staging/production) tune replicas and image tags over the shared base.

## Files

| Path | What it is |
|---|---|
| `base/backend-core/` | `deployment.yaml` (3 replicas, readiness/liveness probes, readOnlyRootFilesystem), `service.yaml`, `hpa.yaml` (CPU 70%, 3→12 pods), `configmap.yaml` (non-secret config) |
| `base/frontend/` | Presentation-tier deployment + service |
| `base/worker/` | Deployment sharing `backend-config` ConfigMap + `backend-secrets` |
| `base/ai-services/deployment.yaml` | All 4 AI services (anomaly/triage/scoping/codeassist) + their ClusterIP services |
| `base/ingress.yaml` | TLS via cert-manager; `app.mugheer.com` → frontend, `api.mugheer.com` → backend; long timeouts for WebSockets |
| `base/networkpolicy.yaml` | Default-deny + explicit allows: presentation→application(:3000), application→data(:5432/:6379), application→AI(:8101-8104) |
| `overlays/staging/kustomization.yaml` | `mugheer-staging` namespace, `:staging` tags, 1 replica |
| `overlays/production/kustomization.yaml` | `mugheer-production` namespace, `:production` tags, full replicas |

## Prerequisites (one-time per cluster)

```bash
# 1. Ingress controller (NGINX)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

# 2. cert-manager (TLS certificates)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
#    then a ClusterIssuer named letsencrypt-prod (see docs/RUNBOOK.md)

# 3. Namespaces
kubectl create namespace mugheer-staging
kubectl create namespace mugheer-production

# 4. Secrets — NEVER commit real values. Create them per namespace:
kubectl -n mugheer-staging create secret generic backend-secrets \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=JWT_ACCESS_SECRET="..." \
  --from-literal=JWT_REFRESH_SECRET="..." \
  --from-literal=INTERNAL_SERVICE_TOKEN="..." \
  --from-literal=STRIPE_SECRET_KEY="..." \
  --from-literal=STRIPE_WEBHOOK_SECRET="..."
#    (production: prefer the external-secrets operator reading from AWS Secrets Manager)
```

## Apply / verify — step by step

```bash
# Staging (what CD does automatically on develop)
kubectl apply -k k8s/overlays/staging
kubectl -n mugheer-staging rollout status deployment/backend-core --timeout=180s

# Production
kubectl apply -k k8s/overlays/production

# Preview exactly what will be applied (renders the overlay)
kubectl kustomize k8s/overlays/staging | less

# Debug a pod that isn't coming up
kubectl -n mugheer-staging get pods
kubectl -n mugheer-staging describe pod <pod>      # events: ImagePullBackOff? CrashLoopBackOff?
kubectl -n mugheer-staging logs deploy/backend-core --tail=100
```

## How to work on it

### Adding a new service — step by step
1. Create `base/<service>/deployment.yaml` — copy `backend-core/deployment.yaml` and change the image, port, and probes. Always set resource requests/limits and `securityContext` (non-root, drop capabilities).
2. Add `service.yaml`, then list the new directory under `resources:` in both overlay `kustomization.yaml` files (the base isn't applied directly — kustomize needs each resource reachable; add a `kustomization.yaml` in the base dir if you split it).
3. **Networking:** if it belongs to a tier, label pods with `tier:` so the NetworkPolicies admit traffic; if it needs a new port between tiers, add it to the relevant `allow-*` policy — never remove default-deny.
4. If it's user-facing, extend `base/ingress.yaml` (host or path) and point DNS at the load balancer.
5. Set an image tag mapping in both overlays. Validate locally with `kubectl kustomize k8s/overlays/staging > /dev/null && echo OK` before committing.

### Rules
- Image tags are pinned per overlay — `latest` never appears here.
- Liveness probes must not depend on the database (that's what readiness is for).
- Any change here that affects capacity (replicas, resources) should be mirrored in the corresponding Terraform node-group sizing if it's structural.
