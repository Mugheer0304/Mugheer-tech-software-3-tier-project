#!/usr/bin/env bash
# =============================================================================
# Mugheer — shared BUILD script.
# Called by BOTH GitHub Actions (ci.yml / cd-*.yml) and Jenkins (Jenkinsfile),
# so the two CI systems can never drift apart on what "build" means
# (spec Section 20.4: shared scripts/ directory holds the actual logic).
# =============================================================================
set -euo pipefail

MODE="${1:-all}" # all | backend | frontend | worker | images

# --- build application packages ---------------------------------------------
build_backend() {
  echo "==> Building backend-core"
  (cd backend-core && npm ci --no-audit --no-fund && npx prisma generate && npm run build)
}

build_frontend() {
  echo "==> Building frontend"
  (cd frontend && npm ci --no-audit --no-fund && npm run build)
}

build_worker() {
  echo "==> Building worker"
  # worker generates its Prisma client from the backend schema (single source of truth)
  cp backend-core/prisma/schema.prisma worker/prisma/schema.prisma
  (cd worker && npm ci --no-audit --no-fund && npx prisma generate && npm run build)
}

# --- build & (optionally) push container images ------------------------------
build_images() {
  local REGISTRY="${REGISTRY:-}"
  local TAG="${IMAGE_TAG:-local}"

  echo "==> Building Docker images (tag=$TAG)"
  docker build -t "mugheer-backend-core:$TAG" ./backend-core
  docker build -t "mugheer-frontend:$TAG" ./frontend
  docker build -t "mugheer-worker:$TAG" ./worker
  docker build -t "mugheer-ai-anomaly:$TAG" ./ai-services/anomaly-detection
  docker build -t "mugheer-ai-triage:$TAG" ./ai-services/support-triage
  docker build -t "mugheer-ai-scoping:$TAG" ./ai-services/scoping-assistant
  docker build -t "mugheer-ai-codeassist:$TAG" ./ai-services/code-assist

  if [[ -n "$REGISTRY" ]]; then
    echo "==> Pushing images to $REGISTRY"
    for svc in backend-core frontend worker ai-anomaly ai-triage ai-scoping ai-codeassist; do
      docker tag "mugheer-$svc:$TAG" "$REGISTRY/mugheer-$svc:$TAG"
      docker push "$REGISTRY/mugheer-$svc:$TAG"
    done
  fi
}

case "$MODE" in
  backend)  build_backend ;;
  frontend) build_frontend ;;
  worker)   build_worker ;;
  images)   build_images ;;
  all)      build_backend; build_frontend; build_worker ;;
  *) echo "Usage: $0 [all|backend|frontend|worker|images]"; exit 1 ;;
esac

echo "==> Build OK"
