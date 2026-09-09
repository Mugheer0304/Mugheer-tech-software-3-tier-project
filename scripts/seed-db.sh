#!/usr/bin/env bash
# Seed the database with demo data (idempotent).
set -euo pipefail
cd "$(dirname "$0")/../backend-core"
echo "Running migrations..."
npx prisma migrate deploy
echo "Seeding demo data..."
npx prisma db seed
echo "Done. Demo logins are printed above."
