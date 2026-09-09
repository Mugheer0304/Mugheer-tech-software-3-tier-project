# .github — CI/CD Workflows (GitHub Actions)

**What these do:** the automated quality gate and delivery system. On every PR: typecheck, build, unit tests, **integration tests against real Postgres+Redis**, AI evaluation suites with minimum-score gates, and Trivy vulnerability scans. On merge to `develop`: build → push images → Terraform plan → deploy staging → smoke tests. On a version tag (with manual approval): production deploy with health checks and **automatic rollback**.

## Files

| File | Trigger | Jobs |
|---|---|---|
| `workflows/ci.yml` | every PR; pushes to `main`/`develop` | `backend-unit` (typecheck, build, unit tests, Trivy) · `frontend` (build + Vitest/Testing Library + Trivy) · `worker` (unit tests) · `backend-integration` (**needs backend-unit**; spins up Postgres 16 + Redis 7 service containers, `prisma db push`, boots the API, runs the integration suite) · `ai-services` (matrix over the 4 services; pip install; pytest evaluation suites; Trivy) |
| `workflows/cd-staging.yml` | push to `develop` (or manual) | Builds/pushes all 6 images to ECR (copies `backend-core/prisma/schema.prisma` into `worker/` first — the worker image needs it to generate its Prisma client) · Terraform plan · `kubectl apply -k k8s/overlays/staging` · rollout status · **smoke-test gate** |
| `workflows/cd-production.yml` | tag `v*` (or manual) | Same build matrix with versioned tags · Terraform apply (production env — requires manual approval in GitHub Environment settings) · deploy overlay · 12× health-check loop · **`kubectl rollout undo` on failure** |

## Required repository secrets / settings

| Secret | Used for |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | OIDC role both CD workflows assume (`aws-actions/configure-aws-credentials` with `id-token: write`) — no static AWS keys |
| Environment `staging` / `production` | Production must have **required reviewers** enabled (Settings → Environments → production) — that's the manual approval gate |
| `GITHUB_WEBHOOK_SECRET` (optional) | If you wire GitHub push events into `/api/v1/webhooks/github` for deploy status |

Nothing else is needed for CI — it's self-contained (services are provisioned by the workflow itself).

## How to work on it

### Adding a CI check — step by step
1. Put it in the **existing job** that owns that service (e.g. a new lint in `backend-unit`) so failures are grouped correctly.
2. If it needs infrastructure (a new database, a message broker), add a `services:` block to `backend-integration` with a health check — copy the Postgres stanza and change image/port/env.
3. Keep the pipeline fast: unit tier has no services on purpose; anything slower than ~2 min belongs in the integration job, which already pays the container cost.
4. Verify locally what you can before pushing (`npm run test:unit`, `act` if you use it, or at least `docker run` the service bits).
5. A PR is only green when **every** matrix job passes — the integration job won't even start unless `backend-unit` is green (`needs:`).

### Changing CD behavior
1. Both CD workflows assume **ECR + EKS exist** (created by `terraform/environments/*`). If you rename the cluster in Terraform, update `aws eks update-kubeconfig --name` and the `-k k8s/overlays/...` namespace to match.
2. The smoke-test step is the deploy gate — tighten it via `scripts/smoke-test.sh` (see `scripts/README.md`), never by removing checks from the workflow.
3. Production rollback is automatic after 12 failed health attempts (~2 min); if you change the loop, keep the `kubectl rollout undo` paired with a failing exit code.
4. Never add plaintext secrets to workflows — OIDC + GitHub Environment secrets only.

### Conventions
- Pin action versions (`@v4` style is fine; avoid `@main`).
- Every job name is human-readable (`name:`) — workflow logs are documentation.
- One workflow per environment; shared logic lives in scripts (`scripts/`), not duplicated YAML.
