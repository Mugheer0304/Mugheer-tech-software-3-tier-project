#!/usr/bin/env bash
# Starts a disposable backend server for integration tests.
# Usage: scripts/start-test-server.sh (env: DATABASE_URL, JWT secrets, INTERNAL_SERVICE_TOKEN)
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DATABASE_URL:=postgresql://mugheer:mugheer@localhost:5432/mugheer_test?schema=public}"
: "${JWT_ACCESS_SECRET:=test-access-secret-32-characters-min!!}"
: "${JWT_REFRESH_SECRET:=test-refresh-secret-32-characters-min}"
: "${INTERNAL_SERVICE_TOKEN:=dev-internal-token-change-me-please-32ch}"
: "${PORT:=3000}"
export NODE_ENV=test

node dist/main.js &
APP_PID=$!
trap 'kill $APP_PID 2>/dev/null || true' EXIT

for i in $(seq 1 30); do
  if curl -sf "http://localhost:${PORT}/api/v1/health" > /dev/null 2>&1; then
    echo "test server ready (pid $APP_PID)"
    exit 0
  fi
  sleep 1
done
echo "test server failed to become ready" >&2
exit 1
