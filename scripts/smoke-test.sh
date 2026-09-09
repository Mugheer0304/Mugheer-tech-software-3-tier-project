#!/usr/bin/env bash
# Post-deploy smoke tests. Exits non-zero if any check fails (CD gates on this).
# Optional env: SMOKE_TOKEN (JWT of a seeded client user) for authenticated checks.
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
API="$BASE_URL/api/v1"
FAILURES=0

check() {
  local name="$1" url="$2" expected="$3"
  shift 3
  local status
  if [ "$#" -gt 0 ]; then
    status=$(curl -s -o /dev/null -w "%{http_code}" "$@" "$url" || echo "000")
  else
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
  fi
  if [ "$status" = "$expected" ]; then
    echo "PASS  $name ($status)"
  else
    echo "FAIL  $name (got $status, want $expected)"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "Smoke testing $BASE_URL ..."

# 1. Liveness + readiness (DB connectivity)
check "health endpoint"        "$API/health"       "200"
check "readiness (DB up)"      "$API/health/ready" "200"

# 2. OpenAPI contract is published and served
DOCS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/docs" || echo "000")
if [ "$DOCS_STATUS" = "200" ]; then
  echo "PASS  OpenAPI docs ($DOCS_STATUS)"
else
  echo "FAIL  OpenAPI docs (got $DOCS_STATUS, want 200)"
  FAILURES=$((FAILURES + 1))
fi

# 3. Security: bad login rejected, protected route requires auth
check "auth rejects bad login" "$API/auth/login"   "401" -H "Content-Type: application/json" -d '{"email":"smoke@invalid","password":"WrongWrong1234!"}'
check "protected route 401"    "$API/projects"     "401"

# 4. Authenticated checks (require a seeded account token)
if [ -n "${SMOKE_TOKEN:-}" ]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $SMOKE_TOKEN" "$API/projects")
  [ "$code" = "200" ] && echo "PASS  projects list (authed)" || { echo "FAIL  projects list ($code)"; FAILURES=$((FAILURES+1)); }

  code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $SMOKE_TOKEN" "$API/admin/stats")
  [ "$code" = "403" ] && echo "PASS  RBAC: client denied admin stats" || { echo "FAIL  RBAC denial ($code)"; FAILURES=$((FAILURES+1)); }
else
  echo "SKIP  authed checks (set SMOKE_TOKEN to enable)"
fi

if [ "$FAILURES" -gt 0 ]; then
  echo "Smoke tests FAILED: $FAILURES"
  exit 1
fi
echo "All smoke tests passed."
