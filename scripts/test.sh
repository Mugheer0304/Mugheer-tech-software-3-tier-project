#!/usr/bin/env bash
# =============================================================================
# Mugheer — shared TEST script.
# Called by BOTH GitHub Actions (ci.yml) and Jenkins (Jenkinsfile) — identical
# gates on both CI vendors (spec Sections 20.4 and 23).
#
# Usage: ./scripts/test.sh [unit|integration|ai|all]
# =============================================================================
set -euo pipefail

MODE="${1:-unit}"

run_backend_unit() {
  echo "==> Backend unit tests + typecheck"
  (cd backend-core && npx prisma generate && npx tsc -p tsconfig.build.json --noEmit --incremental false && npm run test:unit)
}

run_frontend_tests() {
  echo "==> Frontend typecheck + build + tests"
  (cd frontend && npm run build && npm test)
}

run_worker_tests() {
  echo "==> Worker tests"
  (cd worker && npm test)
}

run_integration() {
  echo "==> Backend integration tests (requires Postgres+Redis; CI provides service containers)"
  local DB_URL="${DATABASE_URL:-postgresql://mugheer:mugheer@localhost:5432/mugheer?schema=public}"
  (cd backend-core && npx prisma db push --skip-generate)
  (cd backend-core && node dist/main.js & echo $! > /tmp/mugheer-api.pid; for i in $(seq 1 30); do curl -sf http://localhost:3000/api/v1/health >/dev/null && break; sleep 1; done)
  (cd backend-core && DATABASE_URL="$DB_URL" npm run test:integration)
  kill "$(cat /tmp/mugheer-api.pid)" 2>/dev/null || true
}

run_ai_evals() {
  echo "==> AI evaluation suites (fixed eval sets, minimum scores enforced)"
  local SERVICES=(anomaly-detection support-triage scoping-assistant code-assist)
  for svc in "${SERVICES[@]}"; do
    echo "  -- $svc"
    (cd "ai-services/$svc" && pip install -q -r requirements.txt && pytest tests -q)
  done
}

case "$MODE" in
  unit)        run_backend_unit; run_frontend_tests; run_worker_tests ;;
  integration) run_integration ;;
  ai)          run_ai_evals ;;
  all)         run_backend_unit; run_frontend_tests; run_worker_tests; run_integration; run_ai_evals ;;
  *) echo "Usage: $0 [unit|integration|ai|all]"; exit 1 ;;
esac

echo "==> Tests OK ($MODE)"
