#!/usr/bin/env bash
# =============================================================================
# Mugheer — shared DEPLOY script.
# The ONLY path by which code reaches staging or production, executed
# identically by GitHub Actions (cd-*.yml) and Jenkins (Jenkinsfile)
# (spec Sections 7.5 and 20.4).
#
# Usage: ./scripts/deploy.sh [staging|production]
#
# Required environment:
#   AWS configured (OIDC role in GH Actions / Jenkins credentials binding)
#   REGISTRY       ECR registry host (optional for kubectl-only redeploy)
#   IMAGE_TAG      image tag to deploy (defaults to "staging"/"production")
# =============================================================================
set -euo pipefail

ENVIRONMENT="${1:-staging}"
NAMESPACE="mugheer-$ENVIRONMENT"
CLUSTER="mugheer-$ENVIRONMENT"
TAG="${IMAGE_TAG:-$ENVIRONMENT}"

echo "==> Deploying to $ENVIRONMENT (namespace=$NAMESPACE, tag=$TAG)"

# --- 1. Terraform (plan for staging, apply where infra changed) --------------
if [[ -d "terraform/environments/$ENVIRONMENT" ]]; then
  echo "==> Terraform plan ($ENVIRONMENT)"
  (cd "terraform/environments/$ENVIRONMENT" && terraform init -input=false && terraform plan -input=false -no-color)
fi

# --- 2. Point kubectl at the cluster -----------------------------------------
aws eks update-kubeconfig --name "$CLUSTER"

# --- 3. Apply the environment overlay ----------------------------------------
echo "==> kubectl apply -k k8s/overlays/$ENVIRONMENT"
kubectl apply -k "k8s/overlays/$ENVIRONMENT"

# Pin the exact image tag that was built in this run (no "latest", ever).
if [[ -n "${REGISTRY:-}" ]]; then
  kubectl -n "$NAMESPACE" set image \
    deployment/backend-core "backend-core=$REGISTRY/mugheer-backend-core:$TAG" || true
  kubectl -n "$NAMESPACE" set image \
    deployment/frontend "frontend=$REGISTRY/mugheer-frontend:$TAG" || true
fi

# --- 4. Rollout gates --------------------------------------------------------
echo "==> Waiting for rollouts"
for dep in backend-core frontend worker; do
  kubectl -n "$NAMESPACE" rollout status "deployment/$dep" --timeout=180s || {
    echo "::error::Rollout failed for $dep — rolling back"
    kubectl -n "$NAMESPACE" rollout undo "deployment/$dep" || true
    exit 1
  }
done

# --- 5. Smoke tests as the final deploy gate ----------------------------------
API_HOST="https://api.$ENVIRONMENT.mugheer.com"
[[ "$ENVIRONMENT" == "production" ]] && API_HOST="https://api.mugheer.com"

if ./scripts/smoke-test.sh "$API_HOST"; then
  echo "==> Deploy to $ENVIRONMENT complete and healthy."
else
  echo "::error::Smoke tests failed against $API_HOST — rolling back"
  kubectl -n "$NAMESPACE" rollout undo deployment/backend-core || true
  kubectl -n "$NAMESPACE" rollout undo deployment/frontend || true
  exit 1
fi
