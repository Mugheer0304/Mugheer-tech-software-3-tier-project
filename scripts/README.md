# scripts — Operations Scripts

**What these do:** the three scripts every environment depends on — seeding demo data, backing up the database, and the post-deploy smoke gate used by the CD pipelines. All are idempotent and safe to re-run (except `backup-db.sh`, which creates a new file each run — that's the point).

## Files

| File | What it is |
|---|---|
| `seed-db.sh` | Runs Prisma migrations + the demo-data seed (internal staff, Acme Corp client, product, runbooks, 48h of metrics, sample ticket + invoice). Idempotent — safe on every `docker compose up`. |
| `backup-db.sh` | `pg_dump` → gzip → upload to `s3://$BACKUP_BUCKET/db/` with SSE. Used manually and by cron/automation; retention handled by the bucket lifecycle policy (365 days). |
| `smoke-test.sh` | The **CD gate**: health, readiness (DB), OpenAPI docs, bad-login rejection, protected-route 401, plus optional authenticated checks (projects list, RBAC denial) when `SMOKE_TOKEN` is set. Exits non-zero on any failure — that's what stops a bad deploy. |

## How to run each

```bash
# 1. Seed (from repo root; needs backend-core deps + a running Postgres)
./scripts/seed-db.sh
# Demo logins are printed when it finishes (see root README table).

# 2. Backup (needs: pg_dump client, AWS CLI, DATABASE_URL, BACKUP_BUCKET or default naming)
DATABASE_URL="postgresql://user:pass@host:5432/mugheer" \
BACKUP_BUCKET="mugheer-production-backups" \
./scripts/backup-db.sh
# Schedule it daily in production:
#   0 3 * * *  . /etc/mugheer/env && /opt/mugheer/scripts/backup-db.sh >> /var/log/mugheer-backup.log 2>&1

# 3. Smoke tests (against any environment)
./scripts/smoke-test.sh http://localhost:3000
./scripts/smoke-test.sh https://api.staging.mugheer.com
SMOKE_TOKEN="<jwt-of-seeded-client-user>" ./scripts/smoke-test.sh https://api.mugheer.com
# Getting a token for the authed checks:
#   curl -s -X POST <api>/api/v1/auth/login -H 'Content-Type: application/json' \
#     -d '{"email":"owner@acme.test","password":"ClientPass123!"}' | jq -r .accessToken
```

## How to work on them

### Adding a smoke check — step by step
1. Copy the `check "name" "$API/..." "200"` pattern (extra args are passed to curl, e.g. `-H`, `-d`).
2. Anything environment-specific goes behind the existing `SMOKE_TOKEN` gate or a new opt-in env — the unauthenticated baseline must pass on a pristine install.
3. Every failure increments `FAILURES`; keep the final exit-code block untouched so CD keeps gating.
4. Test locally against docker compose **before** wiring it into `.github/workflows/cd-*.yml`.

### Conventions
- `set -euo pipefail` in every script — fail loudly, never half-run.
- Scripts must be executable in git (`chmod +x`); CI checks out without preserving modes.
- Prefer reading config from env vars with a printed "required" error over silent defaults — except `smoke-test.sh`'s URL argument which defaults to localhost for developer convenience.
- Shell style: POSIX-compatible bash, `shellcheck` clean (run it before committing changes).
