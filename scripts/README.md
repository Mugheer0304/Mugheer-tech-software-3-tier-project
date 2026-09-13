# scripts — Operations & CI Scripts

**What these do:** operations utilities (seed, backup, smoke gate) **plus the shared CI/CD logic** that both GitHub Actions and Jenkins execute — the single implementation of "build", "test" and "deploy" for this platform (spec Sections 7.5 and 20.4).

## Files

| File | What it is |
|---|---|
| `seed-db.sh` | Runs Prisma migrations + the demo-data seed (internal staff, Acme Corp client, product, runbooks, 48h of metrics, sample ticket + invoice). Idempotent — safe on every `docker compose up`. |
| `backup-db.sh` | `pg_dump` → gzip → upload to `s3://$BACKUP_BUCKET/db/` with SSE. Used manually and by cron/automation; retention handled by the bucket lifecycle policy (365 days). |
| `smoke-test.sh` | The **CD gate**: health, readiness (DB), OpenAPI docs, bad-login rejection, protected-route 401, plus optional authenticated checks (projects list, RBAC denial) when `SMOKE_TOKEN` is set. Exits non-zero on any failure — that's what stops a bad deploy. |
| `build.sh` | **Shared CI build** — called by GitHub Actions *and* Jenkins. `build.sh [all\|backend\|frontend\|worker\|images]`; `images` mode builds all 7 container images and pushes them when `REGISTRY` is set. |
| `test.sh` | **Shared CI tests** — `test.sh [unit\|integration\|ai\|all]`. Same gates on both CI vendors: backend unit, frontend build+test, worker, integration (real Postgres/Redis), AI evaluation suites. |
| `deploy.sh` | **Shared CI deploy** — `deploy.sh [staging\|production]`. Terraform plan → kubectl apply overlay → pinned image tags → rollout gates → smoke-test gate, with automatic `rollout undo` on failure. This is the *only* path by which code reaches staging/production, regardless of which CI vendor triggered it. |

## How to run each

```bash
# 1. Seed (from repo root; needs backend-core deps + a running Postgres)
./scripts/seed-db.sh
# Demo logins are printed when it finishes (see root README table).

# 1b. Shared CI scripts (what the pipelines run)
./scripts/build.sh all            # build backend, frontend, worker packages
REGISTRY="123456.dkr.ecr.us-east-1.amazonaws.com" IMAGE_TAG=staging ./scripts/build.sh images
./scripts/test.sh unit            # same gates as CI's 'Lint & Test' stage
./scripts/deploy.sh staging       # what cd-staging.yml / Jenkins 'Deploy Staging' run

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

### Editing the shared CI logic

`build.sh`, `test.sh` and `deploy.sh` are the **single source of truth** — GitHub Actions workflows and the `jenkins/Jenkinsfile` both shell into them. Never inline deploy logic in a workflow; change the script and both CI systems pick it up. Any behavior change must keep both callers working (no vendor-specific flags inside the scripts; vendor differences live in the caller via env vars like `REGISTRY` / `IMAGE_TAG`).

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
