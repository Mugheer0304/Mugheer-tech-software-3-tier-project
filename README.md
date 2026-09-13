# Mugheer

**The platform our software house runs on.** Build. Monitor. Automate. Everything, in one place.

Mugheer is a production-grade, three-tier, AI-augmented software house platform: clients request products, watch them get built (sprint boards, design reviews, staging previews), monitor them live (uptime, performance, AI anomaly detection), automate operations (runbooks, scheduled reports, alerting), and manage billing (milestone invoices, subscriptions, usage add-ons) — from one dashboard. Internally, Mugheer's team gets a full admin console: project management, global monitoring, alert triage with AI suggestions, runbook orchestration, invoicing, and an audit log where AI-agent actions are always attributed distinctly.

> The complete product/engineering brief this implementation satisfies lives in `MUGHEER-SPEC.md`.

---

## Table of contents

1. [Purpose](#1-purpose)
2. [Architecture overview](#2-architecture-overview)
3. [Tech stack](#3-tech-stack)
4. [Repository map — every directory & file explained](#4-repository-map--every-directory--file-explained)
5. [Quick start — run everything with Docker Compose](#5-quick-start--run-everything-with-docker-compose)
6. [Environment variables](#6-environment-variables)
7. [Running tests](#7-running-tests)
8. [Deployment](#8-deployment)
9. [CI/CD pipelines](#9-cicd-pipelines)
10. [Infrastructure — Terraform](#10-infrastructure--terraform)
11. [Kubernetes — run with kubectl/kustomize](#11-kubernetes--run-with-kubectlkustomize)
12. [Monitoring & alerts — how to use it](#12-monitoring--alerts--how-to-use-it)
13. [AI systems](#13-ai-systems)
14. [Security](#14-security)
15. [Repository tooling — all.sh, git-auto, loadtest.js](#15-repository-tooling--allsh-git-auto-loadtestjs)
16. [Contributing](#16-contributing)
17. [License & contact](#17-license--contact)

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

## 4. Repository map — every directory & file explained

Everything lives in its own folder with a README where it helps. Here is what each piece is and where its docs are:

```
Mugheer-tech-software-3-tier-project/
├── README.md                  ← you are here: run everything
├── MUGHEER-SPEC.md            ← the full product/engineering brief (source of truth)
├── docker-compose.yml         ← local dev stack (Postgres, Redis, app, AI, monitoring)
├── .env.example               ← every environment variable, documented
├── all.sh                     ← one-shot DevOps toolchain installer for a fresh Ubuntu EC2 box
├── git-auto                   ← repo bootstrap script (recreates scaffold, commits, pushes)
├── loadtest.js                ← standalone k6 load test (ramp to 20k VUs; edit TARGET_URL)
├── LICENSE                    ← MIT
│
├── frontend/                  ← Tier 1: React 18 + Vite SPA (client + internal dashboards)
├── backend-core/              ← Tier 2: NestJS modular monolith (REST API v1, Swagger, WS)
│   └── prisma/                ← schema, migrations, seed.ts (demo users/orgs)
├── worker/                    ← BullMQ background jobs (probes, scans, reports, dunning)
├── ai-services/               ← Tier 2.5: four FastAI microservices (see §13)
│   ├── anomaly-detection/     ←   :8101 robust-z + EWMA + IsolationForest
│   ├── support-triage/        ←   :8102 classify + draft replies (human-approved)
│   ├── scoping-assistant/     ←   :8103 free text → structured brief
│   └── code-assist/           ←   :8104 RAG code assistant (internal only)
│
├── k8s/                       ← Kubernetes manifests (see §11) — k8s/README.md
│   ├── base/                  ←   deployments, services, ingress, HPA, NetworkPolicy
│   └── overlays/              ←   staging/ and production/ kustomize overlays
├── terraform/                 ← AWS IaC (see §10) — terraform/README.md
│   ├── modules/               ←   network, compute (EKS), database (RDS), storage, iam
│   └── environments/          ←   staging/ and production/ compositions
├── .github/workflows/         ← CI/CD (see §9): ci.yml, cd-staging.yml, cd-production.yml
├── jenkins/Jenkinsfile        ← the same pipeline on Jenkins (dual-track CI, see §9)
│
├── monitoring/                ← Prometheus + Alertmanager + Grafana (see §12) — monitoring/README.md
│   ├── prometheus/            ←   prometheus.yml (scrape config) + alerts.yml (alert rules)
│   ├── alertmanager/          ←   alertmanager.yml (routing: critical/warning/info)
│   └── grafana/               ←   provisioning/ + dashboards/product-overview.json
│
├── scripts/                   ← shared ops scripts — scripts/README.md
│   ├── build.sh               ←   build backend/frontend/worker/images (used by BOTH CI vendors)
│   ├── test.sh                ←   unit | integration | ai | all test gates (same on GH + Jenkins)
│   ├── deploy.sh              ←   the ONLY path to staging/production (kubectl + gates + rollback)
│   ├── smoke-test.sh          ←   post-deploy health gate (CD fails if this fails)
│   ├── seed-db.sh             ←   migrate + seed the database
│   └── backup-db.sh           ←   pg_dump backup helper
│
├── e2e/                       ← Playwright end-to-end journeys (client + internal)
│   └── load/                  ← k6 load test for the monitoring-ingest endpoint
└── docs/                      ← ARCHITECTURE, API, RUNBOOK, INTEGRATION, SECURITY
```

## 5. Quick start — run everything with Docker Compose

The fastest way to see the platform running. The compose file uses **profiles** so you only run what you need — the default brings up the minimal dev stack, and you opt into the rest.

**Prerequisites:** Docker Engine 24+ with the Compose v2 plugin (`docker compose version` should work). On a fresh Ubuntu EC2 box, [`all.sh`](all.sh) installs this for you (see [§15](#15-repository-tooling--allsh-git-auto-loadtestjs)).

### Step 1 — Configure the environment

```bash
cp .env.example .env                # fill in what you have; everything runs with sane local defaults
```

### Step 2 — Pick your stack size and start it

```bash
# Minimal dev stack (default): postgres + redis + backend-core only
docker compose up --build -d

# Add the full application: worker + frontend
docker compose --profile app up --build -d

# Add email + object storage tooling: mailhog + minio
docker compose --profile tools up -d

# Add the 4 AI microservices
docker compose --profile ai up --build -d

# Add the monitoring stack: prometheus + grafana + alertmanager
docker compose --profile monitoring up -d

# ── OR: everything at once ──
docker compose --profile app --profile tools --profile ai --profile monitoring up --build -d
```

Profile cheat sheet:

| Profile | Services it starts |
|---|---|
| *(default)* | `postgres`, `redis`, `backend-core` |
| `app` | + `worker`, `frontend` |
| `tools` | + `mailhog` (email), `minio` (S3-compatible storage) |
| `ai` | + `ai-anomaly` (:8101), `ai-triage` (:8102), `ai-scoping` (:8103), `ai-codeassist` (:8104) |
| `monitoring` | + `prometheus` (:9090), `grafana` (:3001), `alertmanager` (:9093) |

Useful variations:

```bash
docker compose --profile app up -d  # skip rebuilds (reuses existing images)
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
| MinIO console | http://localhost:9001 (`mugheer` / `mugheer-secret`) |
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

## 6. Environment variables

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

## 7. Running tests

The project has a **three-tier testing strategy** mirroring the spec (Section 21). All suites are green at time of writing; exact commands:

```bash
# ---- Backend unit tests (fast, no external services) ----
cd backend-core
npm run test:unit                       # 13 tests: auth primitives, RBAC guard, metric math

# ---- Integration verification suite (spec Sections 7 + 24 contracts) ----
npm run test:verify                     # walks every Prisma table → owning module,
                                        # every frontend feature → backend module,
                                        # Service Box data-driven rendering, contact
                                        # details on every required surface

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

**End-to-end journeys (Playwright, against the running compose stack):**

```bash
cd e2e && npm install && npx playwright install chromium
docker compose --profile app up -d --build && docker compose exec backend-core npx prisma migrate deploy && docker compose exec backend-core npx prisma db seed
npm test                                # signup → Service Box → request product → contact form →
                                        # company contact details visible (spec Section 23)
```

**Load testing (k6):**

```bash
# Platform-specific ingest/dashboard load test (run before major releases):
k6 run -e BASE_URL=http://localhost:3000/api/v1 -e TOKEN=<jwt> -e INTERNAL_TOKEN=<token> e2e/load/monitoring-ingest.js
# thresholds: dashboard p95 < 300ms, ingest p95 < 500ms, error rate < 1%

# Standalone site load test (root loadtest.js — edit TARGET_URL at the top first):
k6 run loadtest.js
# ramp: 0 → 8,000 VUs (2m) → 20,000 VUs (5m) → hold 20,000 (10m) → down (2m)
# thresholds: p95 < 1s, error rate < 5%
```

**Run everything CI runs, in one command** (shared script used by both GitHub Actions and Jenkins):

```bash
./scripts/test.sh all      # unit + integration + AI evals
./scripts/test.sh unit     # just the fast suites
./scripts/test.sh ai       # just the AI evaluation suites
```

## 8. Deployment

How the pieces fit together: **Terraform provisions the cloud**, **Kubernetes runs the workloads**, and **GitHub Actions automates both**. Each subsection below is copy-pasteable.

| Pipeline | Trigger | What it does |
|---|---|---|
| `ci.yml` (GH) / Jenkins `Lint & Test` | every PR / push | Typecheck, build, unit tests, **integration tests against real Postgres+Redis**, **integration verification suite**, AI evaluation suites, Trivy scans |
| `cd-staging.yml` (GH) / Jenkins `Deploy Staging` | merge to `develop` | Build & push images via `scripts/build.sh images`, Terraform plan, `scripts/deploy.sh staging` (kubectl apply + rollout gates + **smoke-test gate**) |
| `cd-production.yml` (GH) / Jenkins `Deploy Production` | tag `v*` (manual approval in both systems) | Terraform apply, `scripts/deploy.sh production` with **automatic `kubectl rollout undo` on failed health checks** |

**Rollback** (automatic in CD, manual here):

```bash
aws eks update-kubeconfig --name mugheer-production
kubectl rollout undo deployment/backend-core -n mugheer-production
```

## 9. CI/CD pipelines — dual track (GitHub Actions **and** Jenkins)

Workflows live in [`.github/workflows/`](.github/workflows/) and the Jenkins pipeline in [`jenkins/Jenkinsfile`](jenkins/Jenkinsfile). Both execute the **same integrated build-test-deploy sequence** by calling the same shared scripts — `scripts/build.sh`, `scripts/test.sh`, `scripts/deploy.sh` — so the two CI vendors can never drift apart on what "deploy" means (spec Sections 7.5 and 20.4). Either can run alone; running both gives redundancy.

### How a change flows from PR to production

```
git push → PR opened ──▶ CI (ci.yml) ──▶ merge to develop ──▶ CD Staging (cd-staging.yml)
                                                                      │ smoke tests pass ✓
git tag v1.2.3 ──▶ CD Production (cd-production.yml) ◀── manual approval in GitHub UI
```

### CI — `ci.yml` (runs automatically on every PR and push to `main`/`develop`)

You normally don't run anything; the pipeline runs on GitHub. To reproduce it locally:

```bash
# The same checks CI performs, run by hand (or just: ./scripts/test.sh unit):
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

### Jenkins pipeline

The declarative [`jenkins/Jenkinsfile`](jenkins/Jenkinsfile) mirrors the GitHub Actions stages stage-for-stage — Checkout → Lint & Test (parallel backend unit + AI evals) → Integration tests → Build & Scan (with Trivy) → Deploy Staging (branch `develop`) → Deploy Production (tag or `main`, gated by a Jenkins `input` approval step). It requires two credential bindings: `aws-deploy-creds` (AWS) and `container-registry-creds` (registry auth). On any failure it attempts automatic rollout undo before escalating — see the `post { failure }` block.

## 10. Infrastructure — Terraform

Terraform provisions everything in AWS: VPC + subnets, EKS cluster + node groups, RDS Postgres, S3, IAM. State lives in S3 with DynamoDB locking (configured in `terraform/environments/<env>/`). Step-by-step: [`terraform/README.md`](terraform/README.md).

### One-time setup (per AWS account, before the first apply)

```bash
aws s3 mb s3://mugheer-terraform-state --region us-east-1
aws s3api put-bucket-versioning --bucket mugheer-terraform-state --versioning-configuration Status=Enabled
aws dynamodb create-table --table-name mugheer-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region us-east-1
aws sts get-caller-identity              # sanity check: you're authed as the right account
```

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
terraform fmt -recursive && terraform validate   # before committing infra changes
```

### After `apply`, point kubectl at the new cluster

```bash
aws eks update-kubeconfig --name mugheer-staging     # or mugheer-production
kubectl get nodes                                     # node groups ready?
```

**Modules:** `network` (VPC, public/private/DB subnets across ≥2 AZs, NAT), `compute` (EKS with EC2 node groups — Spot on staging, On-Demand in prod — per-tier security groups), `database` (RDS Postgres Multi-AZ, encrypted, deletion protection, credentials to Secrets Manager), `storage` (versioned S3 + lifecycle), `iam` (least-privilege). Kubernetes manifests live in `k8s/base` with `staging`/`production` kustomize overlays (probes, HPA, NetworkPolicies enforcing the three-tier rule).

## 11. Kubernetes — run with kubectl/kustomize

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

Or let the shared deploy script do all of it (apply → pin image tag → rollout gates → smoke tests → auto-rollback):

```bash
REGISTRY=<ecr-registry> IMAGE_TAG=staging ./scripts/deploy.sh staging
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

## 12. Monitoring & alerts — how to use it

The stack is Prometheus (metrics + alert rules) → Alertmanager (routing) → Grafana (dashboards). Everything is config-as-code under [`monitoring/`](monitoring/). Deep-dive: [`monitoring/README.md`](monitoring/README.md).

### Using it day-to-day

```bash
docker compose --profile monitoring up -d        # start the stack (see §5)
```

| UI | URL | What to do there |
|---|---|---|
| **Grafana** | http://localhost:3001 (admin/admin) | Dashboards → **Mugheer** folder → **Product Overview** (response time, error rate, uptime, CPU per product via the product variable) |
| **Prometheus** | http://localhost:9090 | Status → Targets: every scrape target should be `up == 1`. Run PromQL queries and test alert expressions here first |
| **Alertmanager** | http://localhost:9093 | See which alerts are firing/pending/silenced and how they're routed |

- **Alert routing** (`monitoring/alertmanager/alertmanager.yml`): critical → PagerDuty + `#mugheer-incidents`, warning → `#mugheer-alerts`, info → in-app only.
- **Platform health endpoints:** `GET /api/v1/health` (liveness), `GET /api/v1/health/ready` (readiness, checks DB).
- Every request carries a `correlationId` (structured JSON logs) propagated through services and jobs.
- **Client-product business metrics** don't go to Prometheus directly — they flow through the ingestion API (`POST /api/v1/monitoring/ingest`), which gives them retention policy and AI anomaly detection for free.

### Add an alert rule — step by step

1. Append to `monitoring/prometheus/alerts.yml`:
   ```yaml
   - alert: MyNewAlert
     expr: <promql>            # test the expression in the Prometheus UI first
     for: 5m                   # must hold this long before firing
     labels: { severity: critical | warning | info }
     annotations:
       summary: "one line"
       runbook: "link to docs/RUNBOOK.md section"
   ```
2. The `severity` label picks the Alertmanager route — only touch `alertmanager.yml` if it's genuinely new behavior.
3. Secrets (Slack webhook, PagerDuty key) go in `/etc/alertmanager/secrets/` referenced by `*_file:` — **never inline**.
4. `docker compose restart prometheus alertmanager`, then check http://localhost:9090/alerts — the new rule should appear as `inactive` (green), not immediately firing.

### Add a Grafana dashboard

Build it in the UI, then **JSON model → save the file** to `monitoring/grafana/dashboards/<name>.json` (dashboards-as-code — the provisioner auto-loads it; keep `uid` unique vs. `product-overview.json`).

## 13. AI systems

| Feature | What it does | Governance |
|---|---|---|
| **Anomaly detection** (`:8101`) | Robust z-score + EWMA level-shift + IsolationForest over per-product metric series; escalates to alerts with confidence | Logged with model + input hash + confidence |
| **Support triage** (`:8102`) | Classifies tickets (bug/feature/billing/urgent/general), sets priority, drafts first response | Draft is `isAiDraft=true`; **a human must click "Approve & send"**; approval recorded in `ai_action_logs` |
| **Scoping assistant** (`:8103`) | Turns plain-language requests into a structured brief (service line, features, complexity, rough estimate) | Always marked `aiGenerated: true`; a PM refines before quoting |
| **Code assist** (`:8104`, internal) | Retrieval-augmented suggestions scoped to the project's own codebase | Internal roles only |
| **Report generator** | Weekly natural-language health summary per product | Stored as `AiInsight`, pushed to client + staff |

**Running them locally:** `docker compose --profile ai up --build -d` (or start a single one: `docker compose up -d ai-anomaly`). Each service exposes `/health`; the backend reaches them via `AI_ANOMALY_URL` / `AI_TRIAGE_URL` / `AI_SCOPING_URL` / `AI_CODEASSIST_URL` (pre-wired in compose).

**Governance (Section 12.3 of the spec):** every AI action is logged (`model`, `modelVersion`, input hash, confidence, human-approval status, token cost) and budget-capped (`AI_MONTHLY_BUDGET_USD`). Anything AI-generated shown in the UI carries a visible **"AI-suggested"** tag until approved. All AI calls degrade gracefully to heuristics when a service is down — the platform never blocks on AI. Evaluation baselines live in each service's `tests/` and run in CI (minimum scores enforced — see §7).

## 14. Security

Full posture: [`docs/SECURITY.md`](docs/SECURITY.md). Highlights: bcrypt(12) + HaveIBeenPwned breach checks, rotating refresh tokens with family-reuse detection, TOTP 2FA, deny-by-default server-side RBAC with negative tests, tenant isolation on every query, signature-verified idempotent webhooks, append-only audit log with distinct AI-agent attribution, timing-safe internal service tokens, Trivy dependency/container scanning in CI.

**Report a vulnerability:** security@mugheer.com (48h acknowledgment, coordinated disclosure — no public issues).

## 15. Repository tooling — all.sh, git-auto, loadtest.js

Three standalone helpers live at the repo root, next to the main codebase:

### `all.sh` — one-shot DevOps toolchain installer (fresh Ubuntu EC2)

Installs, from official upstream repos, always the latest versions: Docker Engine + Compose plugin (with the no-sudo group fix), Terraform, kubectl (tracks the latest stable K8s minor), AWS CLI v2, Eclipse Temurin LTS Java, Jenkins LTS, Node.js LTS (+ npm@latest), and the NestJS CLI.

```bash
chmod +x all.sh && ./all.sh
# then log out/in (or `newgrp docker`) so docker works without sudo
```

After it finishes you have everything needed to run §5 (compose), §10 (terraform), §11 (kubectl), §9 (Jenkins) on that box.

### `git-auto` — full repository bootstrap script

Recreates the entire project scaffold from scratch, commits it in 12 logical conventional-commit stages, and pushes to GitHub. Useful for standing the repo up on a fresh machine (it never embeds credentials — authenticate with SSH, a PAT, or `gh auth login` first).

```bash
chmod +x git-auto
./git-auto                    # clone-or-create + push to main
./git-auto --dir myfolder     # custom local folder name
./git-auto --branch develop   # push to a different branch
./git-auto --no-push          # build + commit locally only
./git-auto --force-push       # overwrite remote history (use with care)
```

If push is rejected as non-fast-forward (remote already has commits), the script prints the exact fix — either `--force-push` or a merge.

### `loadtest.js` — standalone k6 load test

A generic ramping load test for any site (up to 20,000 virtual users). **Edit `TARGET_URL` at the top** to point only at a system you own, then:

```bash
k6 run loadtest.js
# stages: 2m → 8k VUs, 5m → 20k VUs, 10m hold, 2m ramp-down
# thresholds: p95 < 1s, error rate < 5% (test fails if breached)
```

For platform-specific load testing (monitoring ingest + dashboard endpoints), use `e2e/load/monitoring-ingest.js` instead — see §7.

## 16. Contributing

- **Branches:** `feat/<scope>`, `fix/<scope>`, `chore/<scope>`; PRs target `develop`; releases tag `main`.
- **PR checklist:** CI green (unit + integration + AI evals + scans) · docs updated · server-side RBAC for new routes with a negative test · K8s/Terraform updated if infra changed · monitoring wired for new user-facing services ("no feature ships silent").
- **Style:** TypeScript strict; Python formatted to PEP 8; conventional, imperative commit subjects.

```bash
cd backend-core && npm run lint && npm run format
```

## 17. License & contact

MIT — see [`LICENSE`](LICENSE).

**Mugheer-Tech** — Build. Monitor. Automate. Everything, connected.
- Email: **mughammugheer@gmail.com**
- Phone: **+92 304 0405194**

These contact details are the single source of truth (`backend-core/src/common/company.ts` on the backend, `frontend/src/lib/company.ts` on the frontend) and are wired into the public footer, the Contact page, the client dashboard footer, and every generated invoice — not just documented here (spec Section 27).

The integration contract and the automated Section 24 verification checklist live in [`docs/INTEGRATION.md`](docs/INTEGRATION.md).

---

### Operations quick reference

| Need | Go to |
|---|---|
| Deploy / rollback / DB restore / incident playbooks | [`docs/RUNBOOK.md`](docs/RUNBOOK.md) |
| Endpoint reference | [`docs/API.md`](docs/API.md) + live Swagger at `/api/docs` |
| Architecture deep-dive | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Cross-tier integration contract + checklist | [`docs/INTEGRATION.md`](docs/INTEGRATION.md) |
| Security controls & disclosure | [`docs/SECURITY.md`](docs/SECURITY.md) |
| Kubernetes manifests deep-dive | [`k8s/README.md`](k8s/README.md) |
| Terraform / AWS infrastructure deep-dive | [`terraform/README.md`](terraform/README.md) |
| Monitoring stack deep-dive (alerts, dashboards) | [`monitoring/README.md`](monitoring/README.md) |
| Operations scripts (seed / backup / smoke / shared CI) | [`scripts/README.md`](scripts/README.md) |

### Documented assumptions

Made where the spec left a decision open: brand palette (deep indigo + teal accent), alert thresholds (CPU 85%, error rate 5%/10%), Stripe price IDs are config-provided, SAML/SSO is stubbed at the integration point (OIDC-ready), and the demo seed data (Acme Corp) exists purely for local development.
