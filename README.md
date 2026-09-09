# Mugheer

**The platform our software house runs on.** Build. Monitor. Automate. Everything, in one place.

Mugheer is a production-grade, three-tier, AI-augmented software house platform: clients request products, watch them get built (sprint boards, design reviews, staging previews), monitor them live (uptime, performance, AI anomaly detection), automate operations (runbooks, scheduled reports, alerting), and manage billing (milestone invoices, subscriptions, usage add-ons) — from one dashboard. Internally, Mugheer's team gets a full admin console: project management, global monitoring, alert triage with AI suggestions, runbook orchestration, invoicing, and an audit log where AI-agent actions are always attributed distinctly.

> The complete product/engineering brief this implementation satisfies lives in `MUGHEER-SPEC.md`.

---

## Table of contents

1. [Purpose](#1-purpose)
2. [Architecture overview](#2-architecture-overview)
3. [Tech stack](#3-tech-stack)
4. [Quick start — run everything with Docker Compose](#4-quick-start--run-everything-with-docker-compose)
5. [Environment variables](#5-environment-variables)
6. [Running tests](#6-running-tests)
7. [Deployment](#7-deployment)
8. [CI/CD pipelines](#8-cicd-pipelines)
9. [Infrastructure — Terraform](#9-infrastructure--terraform)
10. [Kubernetes — run with kubectl/kustomize](#10-kubernetes--run-with-kubectlkustomize)
11. [Monitoring & alerts](#11-monitoring--alerts)
12. [AI systems](#12-ai-systems)
13. [Security](#13-security)
14. [Contributing](#14-contributing)
15. [License & contact](#15-license--contact)

---

## 1. Purpose

Mugheer exists so a client can, in one place: **request a product**, **watch it get built**, **launch and monitor it**, **automate operations**, **pay and manage billing**, and **collaborate** — while Mugheer's team runs delivery, monitoring, and automation on the same platform.

## 2. Architecture overview

Three physically and logically separated tiers; no tier may skip a layer. The rule is enforced in code (no DB access from frontend, tenant-scoped queries) *and* at the network layer (`k8s/base/networkpolicy.yaml`).

```mermaid
flowchart TB
    subgraph T1["Tier 1 — Presentation"]
        SPA["React SPA (Vite)"]
    end
    subgraph T2["Tier 2 — Application (NestJS modular monolith)"]
        AUTH["Auth + RBAC"] --- PROJ["Projects"] --- BILL["Billing"]
        MON["Monitoring"] --- AUTO["Automation"] --- AIO["AI Orchestration"]
        NOTIF["Notifications"] --- WS["Realtime Gateway"] --- WORKER["Worker (BullMQ)"]
    end
    subgraph T3["Tier 3 — Data"]
        PG[("PostgreSQL")] --- RD[("Redis")] --- S3[("S3")] --- PROM[("Prometheus")]
    end
    subgraph AI["AI Microservices (FastAPI)"]
        ANOM["anomaly-detection"] --- TRI["support-triage"] --- SCOPE["scoping-assistant"] --- CODE["code-assist"]
    end
    Browser["Browser"] -->|HTTPS REST + WS| SPA --> T2 --> T3
    AIO --> AI
    WORKER -->|internal token| T2
```

| Service | Language | Port | Responsibility |
|---|---|---|---|
| `frontend` | React 18 / TS / Vite | 5173 | Client + internal dashboards, live charts |
| `backend-core` | NestJS / TS | 3000 | REST API v1, business logic, RBAC, webhooks, WS gateway, Swagger |
| `worker` | Node / TS (BullMQ) | — | Uptime probes (1 min), anomaly scans (15 min), weekly reports, dunning (daily), metric downsampling + retention |
| `ai-services/anomaly-detection` | Python / FastAPI | 8101 | Robust-z + EWMA + IsolationForest anomaly detection |
| `ai-services/support-triage` | Python / FastAPI | 8102 | Ticket classification + draft replies (human-approved, never auto-sent) |
| `ai-services/scoping-assistant` | Python / FastAPI | 8103 | Free-text request → structured brief + rough estimate |
| `ai-services/code-assist` | Python / FastAPI | 8104 | Retrieval-augmented internal code assistant |

Full details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 3. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, React Query, Recharts, Vitest + Testing Library |
| Backend | NestJS 10, TypeScript, Prisma ORM, Passport JWT, Socket.IO, class-validator |
| Data | PostgreSQL 16, Redis 7 (cache/queues), S3 |
| AI | FastAPI, NumPy, scikit-learn, provider-agnostic LLM calls (OpenAI-compatible, optional) |
| Payments | Stripe (primary), PayPal (secondary), webhook-driven, SAQ-A scope |
| Auth | JWT access (15 min) + rotating refresh (HttpOnly cookie), TOTP 2FA, Google/GitHub OAuth, API keys |
| Infra | Docker + Compose, Kubernetes (kustomize overlays), Terraform (EKS + EC2 node groups, RDS Multi-AZ, S3), GitHub Actions |
| Monitoring | Prometheus, Alertmanager, Grafana, structured JSON logs with correlation IDs |

## 4. Quick start — run everything with Docker Compose

The fastest way to see the whole platform running. One command brings up **every** service: PostgreSQL, Redis, Mailhog, MinIO, all app services, all 4 AI microservices, and the full monitoring stack (Prometheus, Grafana, Alertmanager).

**Prerequisites:** Docker Engine 24+ with the Compose v2 plugin (`docker compose version` should work). On a fresh Ubuntu EC2 box, [`all.sh`](all.sh) installs this for you (see [Toolchain installer](#toolchain-installer-allsh)).

### Step 1 — Configure the environment

```bash
cp .env.example .env                # fill in what you have; everything runs with sane local defaults
```

### Step 2 — Build and start the stack

```bash
docker compose up --build -d        # builds all images, starts postgres, redis, mailhog, minio,
                                    # backend-core, worker, frontend, 4 AI services,
                                    # prometheus, grafana, alertmanager
```

Useful variations:

```bash
docker compose up -d                # skip rebuilds (reuses existing images)
docker compose up -d postgres redis # start only what you need for backend dev
docker compose logs -f backend-core # follow a service's logs
docker compose ps                   # see what's running and healthy
docker compose down                 # stop everything (keep data volumes)
docker compose down -v              # stop and wipe data volumes (fresh start)
```

### Step 3 — Migrate and seed the database

```bash
docker compose exec backend-core npx prisma migrate deploy
docker compose exec backend-core npx prisma db seed
# or, from the host (needs backend-core deps installed locally):
./scripts/seed-db.sh
```

### Step 4 — Open the app

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:3000/api/v1 |
| **API docs (Swagger)** | http://localhost:3000/api/docs |
| Mailhog (emails) | http://localhost:8025 |
| MinIO console | http://localhost:9001 |
| Grafana | http://localhost:3001 (admin/admin) |
| Prometheus | http://localhost:9090 |
| Alertmanager | http://localhost:9093 |

### Step 5 — Log in with the seeded demo accounts

(from `backend-core/prisma/seed.ts`)

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@mugheer.com` | `AdminPass123!` |
| Admin / PM | `pm@mugheer.com` | `AdminPass123!` |
| Engineer | `engineer@mugheer.com` | `AdminPass123!` |
| Client Owner | `owner@acme.test` | `ClientPass123!` |
| Client Member | `member@acme.test` | `ClientPass123!` |

### Step 6 — Verify with smoke tests

```bash
./scripts/smoke-test.sh http://localhost:3000
SMOKE_TOKEN="<jwt-of-seeded-client-user>" ./scripts/smoke-test.sh http://localhost:3000   # + authed checks
```

### Day-to-day cheat sheet

```bash
docker compose restart backend-core                 # restart one service
docker compose exec backend-core sh                 # shell into the API container
docker compose exec postgres psql -U mugheer mugheer # psql shell
docker compose build frontend && docker compose up -d frontend   # rebuild one service after code changes
```

## 5. Environment variables

All variables live in [`.env.example`](.env.example). Production values come from AWS Secrets Manager (never committed). Required in production:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis (queues + cache) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | JWT signing secrets (32+ chars) |
| `INTERNAL_SERVICE_TOKEN` | Shared token for worker/AI→core calls (timing-safe compared) |
| `CORS_ORIGIN` | Allowed frontend origin(s), comma-separated |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Payments + webhook signature verification |
| `STRIPE_PRICE_*` | Price IDs for monitoring/automation/retainer plans |
| `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` | OAuth2 login |
| `S3_*` | Object storage (assets, backups) |
| `SMTP_*` | Email notification transport |
| `AI_*` | AI service URLs, model, monthly budget cap |
| `VITE_API_URL`, `VITE_WS_URL` | Frontend build-time API/WS endpoints |

## 6. Running tests

The project has a **three-tier testing strategy** mirroring the spec (Section 21). All suites are green at time of writing; exact commands:

```bash
# ---- Backend unit tests (fast, no external services) ----
cd backend-core
npm run test:unit                       # 13 tests: auth primitives, RBAC guard, metric math

# ---- Backend integration tests (REAL Postgres + Redis, full HTTP round-trips) ----
docker compose up -d postgres redis     # or CI spins up service containers
npx prisma db push --skip-generate
npm run build
node dist/main.js &                     # API under test
DATABASE_URL="postgresql://mugheer:mugheer@localhost:5432/mugheer?schema=public" \
JWT_ACCESS_SECRET="test-access-secret-32-characters-min!!" \
JWT_REFRESH_SECRET="test-refresh-secret-32-characters-min" \
INTERNAL_SERVICE_TOKEN="dev-internal-token-change-me-please-32ch" \
npm run test:integration                # 14 tests: signup→login→refresh rotation (reuse detection),
                                        # RBAC denials, tenant isolation, monitoring ingestion,
                                        # cross-tenant rejection, internal-token guard, tickets

# ---- Frontend unit tests ----
cd ../frontend && npm test              # 8 tests: UI kit, AI-tag governance, auth/role helpers

# ---- Worker tests ----
cd ../worker && npm test                # report aggregation + scheduling math

# ---- AI evaluation suites (fixed evaluation sets; minimum scores required) ----
cd ../ai-services/anomaly-detection  && pytest tests -q   # 6 tests: spike/shift detection, false-positive ceiling
cd ../support-triage                 && pytest tests -q   # 3 tests: ≥80% classification accuracy, priority, empathy
cd ../scoping-assistant              && pytest tests -q   # 4 tests: service-line mapping, complexity, bounds
cd ../code-assist                    && pytest tests -q   # 4 tests: snippet retrieval ranking, empty-context handling

# ---- Post-deploy smoke tests (used as a CD gate) ----
./scripts/smoke-test.sh https://api.staging.mugheer.com
SMOKE_TOKEN="<jwt>" ./scripts/smoke-test.sh http://localhost:3000   # + authed checks
```

**AI governance tests are part of CI:** triage accuracy has a required minimum (80% on the fixed eval set), and anomaly detection has a false-positive ceiling on clean data. These run whenever prompts/models change.

## 7. Deployment

How the pieces fit together: **Terraform provisions the cloud**, **Kubernetes runs the workloads**, and **GitHub Actions automates both**. Each subsection below is copy-pasteable.

| Pipeline | Trigger | What it does |
|---|---|---|
| `ci.yml` | every PR / push | Typecheck, build, unit tests, **integration tests against real Postgres+Redis**, AI evaluation suites, Trivy scans |
| `cd-staging.yml` | merge to `develop` | Build & push images (incl. worker with backend Prisma schema), Terraform plan, `kubectl apply -k k8s/overlays/staging`, rollout status, **smoke tests gate** |
| `cd-production.yml` | tag `v*` (manual approval) | Terraform apply, deploy production overlay, health checks ×12, **automatic `kubectl rollout undo` on failure** |

**Rollback** (automatic in CD, manual here):

```bash
aws eks update-kubeconfig --name mugheer-production
kubectl rollout undo deployment/backend-core -n mugheer-production
```

## 8. CI/CD pipelines

Workflows live in [`.github/workflows/`](.github/workflows/). They are triggered automatically — here is how to run and observe them.

### How a change flows from PR to production

```
git push → PR opened ──▶ CI (ci.yml) ──▶ merge to develop ──▶ CD Staging (cd-staging.yml)
                                                                      │ smoke tests pass ✓
git tag v1.2.3 ──▶ CD Production (cd-production.yml) ◀── manual approval in GitHub UI
```

### CI — `ci.yml` (runs automatically on every PR and push to `main`/`develop`)

You normally don't run anything; the pipeline runs on GitHub. To reproduce it locally:

```bash
# The same checks CI performs, run by hand:
cd backend-core  && npm install && npx prisma generate && npx tsc -p tsconfig.build.json --noEmit \
                  && npm run build && npm run test:unit
cd ../frontend   && npm install && npm run build && npm test
cd ../worker     && npm install && npm test
cd ../ai-services/anomaly-detection && pip install -r requirements.txt && pytest tests -q
# (repeat pytest for support-triage, scoping-assistant, code-assist)
```

### CD — Staging (`cd-staging.yml`, automatic on push/merge to `develop`)

```bash
git checkout develop
git merge feature/my-feature && git push     # pipeline fires automatically:
#   1. builds & pushes images to ECR (backend-core, frontend, worker + 4 AI services)
#   2. terraform plan (staging)
#   3. kubectl apply -k k8s/overlays/staging && kubectl rollout status
#   4. ./scripts/smoke-test.sh https://api.staging.mugheer.com   ← deploy fails if this fails
```

Trigger it manually from the GitHub UI: **Actions → CD — Staging → Run workflow** (`workflow_dispatch` is enabled).

### CD — Production (`cd-production.yml`, automatic on tags `v*`, requires manual approval)

```bash
# Cut a release — that's all it takes:
git tag v1.0.0 && git push origin v1.0.0
```

Then, in the GitHub UI, approve under **Actions → CD — Production → deploy → Review deployments** (the `production` environment has required reviewers). The pipeline:

1. Builds & pushes versioned images (`mugheer-backend-core:v1.0.0`, …) to ECR.
2. `terraform apply` on the production environment.
3. `kubectl apply -k k8s/overlays/production` + pins the tagged image.
4. Runs `scripts/smoke-test.sh` up to 12 times; on failure it **automatically runs `kubectl rollout undo`** for backend and frontend.

### Required GitHub secrets (set once per repository)

| Secret | Purpose |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | IAM role assumed via OIDC for ECR/EKS/Terraform (`id-token: write`) |
| `production` environment | Must have **required reviewers** configured — that is the manual approval gate |

## 9. Infrastructure — Terraform

Terraform provisions everything in AWS: VPC + subnets, EKS cluster + node groups, RDS Postgres, S3, IAM. State lives in S3 with DynamoDB locking (configured in `terraform/environments/<env>/`).

### First-time setup (per environment)

```bash
cd terraform/environments/staging     # or production
terraform init                        # remote state: S3 backend + DynamoDB locks
terraform plan                        # review every change before it happens
terraform apply                       # provision. Production: do this via the CD pipeline, not by hand.
```

### Ongoing usage

```bash
terraform plan -out=tfplan            # preview and save a plan
terraform apply tfplan                # apply exactly what was reviewed
terraform output                      # cluster endpoint, ECR registry, RDS host, bucket names
terraform destroy                     # ⚠ tears down everything — staging only, never in prod
```

### After `apply`, point kubectl at the new cluster

```bash
aws eks update-kubeconfig --name mugheer-staging     # or mugheer-production
kubectl get nodes                                     # node groups ready?
```

**Modules:** `network` (VPC, public/private/DB subnets across ≥2 AZs, NAT), `compute` (EKS with EC2 node groups — Spot on staging, On-Demand in prod — per-tier security groups), `database` (RDS Postgres Multi-AZ, encrypted, deletion protection, credentials to Secrets Manager), `storage` (versioned S3 + lifecycle), `iam` (least-privilege). Kubernetes manifests live in `k8s/base` with `staging`/`production` kustomize overlays (probes, HPA, NetworkPolicies enforcing the three-tier rule).

## 10. Kubernetes — run with kubectl/kustomize

Manifests live in [`k8s/base`](k8s/base) with per-environment overlays in `k8s/overlays/{staging,production}`. You can run them **against any cluster** — EKS from Terraform, or a local cluster (minikube/kind) for experimentation. Deep-dive: [`k8s/README.md`](k8s/README.md).

### Option A — against the EKS cluster created by Terraform

```bash
aws eks update-kubeconfig --name mugheer-staging
kubectl get nodes                                            # confirm the cluster is reachable
```

### Option B — against a local cluster (minikube/kind)

```bash
kind create cluster --name mugheer-dev        # or: minikube start
kubectl create namespace mugheer-staging
```

### One-time cluster prerequisites (both options)

```bash
# 1. NGINX ingress controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

# 2. cert-manager (TLS certificates)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml

# 3. Secrets — NEVER commit real values. Create them per namespace:
kubectl -n mugheer-staging create secret generic backend-secrets \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=JWT_ACCESS_SECRET="$(openssl rand -hex 32)" \
  --from-literal=JWT_REFRESH_SECRET="$(openssl rand -hex 32)" \
  --from-literal=INTERNAL_SERVICE_TOKEN="$(openssl rand -hex 32)" \
  --from-literal=STRIPE_SECRET_KEY="sk_test_..." \
  --from-literal=STRIPE_WEBHOOK_SECRET="whsec_..."

# 4. Migrate the database (run the migrate job from the backend image)
kubectl -n mugheer-staging run prisma-migrate --rm -it --restart=Never \
  --image=registry.example.com/mugheer/backend-core:staging -- \
  npx prisma migrate deploy
```

### Deploy an environment

```bash
# Preview exactly what will be applied (renders the overlay):
kubectl kustomize k8s/overlays/staging | less

# Staging (what CD does automatically on develop):
kubectl apply -k k8s/overlays/staging
kubectl -n mugheer-staging rollout status deployment/backend-core --timeout=180s

# Production:
kubectl apply -k k8s/overlays/production
kubectl -n mugheer-production rollout status deployment/backend-core --timeout=180s
```

### Verify it's running

```bash
kubectl -n mugheer-staging get pods                    # all Running/Ready?
kubectl -n mugheer-staging get ingress                 # external URLs (cloud LB)
kubectl -n mugheer-staging port-forward svc/backend-core 3000:3000
# → then http://localhost:3000/api/docs (Ctrl-C to stop)
```

### Debug a pod that isn't coming up

```bash
kubectl -n mugheer-staging get pods
kubectl -n mugheer-staging describe pod <pod>          # events: ImagePullBackOff? CrashLoopBackOff?
kubectl -n mugheer-staging logs deploy/backend-core --tail=100 -f
```

**Rules of the road:** image tags are pinned per overlay (`latest` never appears); liveness probes never depend on the database; anything user-facing must be wired into `base/ingress.yaml` and monitoring ("no feature ships silent").

## 11. Monitoring & alerts

- **Dashboards:** Grafana → "Mugheer" folder (`monitoring/grafana/dashboards/`), provisioned automatically; per-product embeddable overview.
- **Alert routing** (`monitoring/alertmanager/alertmanager.yml`): critical → PagerDuty + `#mugheer-incidents`, warning → `#mugheer-alerts`, info → in-app only.
- **Add an alert rule:** append to `monitoring/prometheus/alerts.yml` (expression, duration, severity, runbook link), then route the severity in Alertmanager. Restart with `docker compose restart prometheus alertmanager`.
- **Platform health:** `GET /api/v1/health` (liveness), `GET /api/v1/health/ready` (readiness, checks DB).
- Every request carries a `correlationId` (structured JSON logs) propagated through services and jobs.

## 12. AI systems

| Feature | What it does | Governance |
|---|---|---|
| **Anomaly detection** (`:8101`) | Robust z-score + EWMA level-shift + IsolationForest over per-product metric series; escalates to alerts with confidence | Logged with model + input hash + confidence |
| **Support triage** (`:8102`) | Classifies tickets (bug/feature/billing/urgent/general), sets priority, drafts first response | Draft is `isAiDraft=true`; **a human must click "Approve & send"**; approval recorded in `ai_action_logs` |
| **Scoping assistant** (`:8103`) | Turns plain-language requests into a structured brief (service line, features, complexity, rough estimate) | Always marked `aiGenerated: true`; a PM refines before quoting |
| **Code assist** (`:8104`, internal) | Retrieval-augmented suggestions scoped to the project's own codebase | Internal roles only |
| **Report generator** | Weekly natural-language health summary per product | Stored as `AiInsight`, pushed to client + staff |

**Governance (Section 12.3 of the spec):** every AI action is logged (`model`, `modelVersion`, input hash, confidence, human-approval status, token cost) and budget-capped (`AI_MONTHLY_BUDGET_USD`). Anything AI-generated shown in the UI carries a visible **"AI-suggested"** tag until approved. All AI calls degrade gracefully to heuristics when a service is down — the platform never blocks on AI. Evaluation baselines live in each service's `tests/` and run in CI.

## 13. Security

Full posture: [`docs/SECURITY.md`](docs/SECURITY.md). Highlights: bcrypt(12) + HaveIBeenPwned breach checks, rotating refresh tokens with family-reuse detection, TOTP 2FA, deny-by-default server-side RBAC with negative tests, tenant isolation on every query, signature-verified idempotent webhooks, append-only audit log with distinct AI-agent attribution, timing-safe internal service tokens, Trivy dependency/container scanning in CI.

**Report a vulnerability:** security@mugheer.com (48h acknowledgment, coordinated disclosure — no public issues).

## 14. Contributing

- **Branches:** `feat/<scope>`, `fix/<scope>`, `chore/<scope>`; PRs target `develop`; releases tag `main`.
- **PR checklist:** CI green (unit + integration + AI evals + scans) · docs updated · server-side RBAC for new routes with a negative test · K8s/Terraform updated if infra changed · monitoring wired for new user-facing services ("no feature ships silent").
- **Style:** TypeScript strict; Python formatted to PEP 8; conventional, imperative commit subjects.

```bash
cd backend-core && npm run lint && npm run format
```

## 15. License & contact

MIT — see [`LICENSE`](LICENSE). Mugheer Engineering · engineering@mugheer.com

---

### Toolchain installer (`all.sh`)

Provisioning a fresh Ubuntu EC2 box? [`all.sh`](all.sh) installs the whole toolchain from official upstream repos — Docker + Compose (with the no-sudo group fix), Terraform, kubectl (tracking the latest stable K8s minor), AWS CLI v2, latest Temurin LTS Java, Jenkins LTS, Node LTS, NestJS CLI:

```bash
chmod +x all.sh && ./all.sh
# then log out/in (or `newgrp docker`) so docker works without sudo
```

### Operations quick reference

| Need | Go to |
|---|---|
| Deploy / rollback / DB restore / incident playbooks | [`docs/RUNBOOK.md`](docs/RUNBOOK.md) |
| Endpoint reference | [`docs/API.md`](docs/API.md) + live Swagger at `/api/docs` |
| Architecture deep-dive | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Security controls & disclosure | [`docs/SECURITY.md`](docs/SECURITY.md) |
| Kubernetes manifests deep-dive | [`k8s/README.md`](k8s/README.md) |
| Operations scripts (seed / backup / smoke) | [`scripts/README.md`](scripts/README.md) |

### Documented assumptions

Made where the spec left a decision open: brand palette (deep indigo + teal accent), alert thresholds (CPU 85%, error rate 5%/10%), Stripe price IDs are config-provided, SAML/SSO is stubbed at the integration point (OIDC-ready), and the demo seed data (Acme Corp) exists purely for local development.
