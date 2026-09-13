# INTEGRATION — How Every Layer Connects to Every Other Layer

This document mirrors Sections 7 and 24 of the master spec (`MUGHEER-SPEC.md`). It is the living map of every cross-tier dependency in the platform and the automated checks that fail loudly when any of them breaks.

**The non-negotiable rule:** nothing exists in isolation. Every UI element traces to an endpoint; every endpoint traces to a table; every deploy traces to a pipeline that builds the exact code it deploys.

---

## 7.1 Frontend ↔ Backend

| Frontend feature folder | Backend module | Contract surface |
|---|---|---|
| `features/auth` | `modules/auth` | `/api/v1/auth/*` (JWT access + rotating refresh cookie, OAuth, 2FA, API keys) |
| `features/services` (Service Boxes) | `modules/service-catalog` | `GET /service-catalog`, `GET /service-catalog/:slug`, admin CRUD under `/service-catalog/admin` |
| `features/projects` | `modules/projects` | `/projects`, tasks, design review, deployments |
| `features/monitoring` | `modules/monitoring` | metrics, alerts, live dashboard + WebSocket channel |
| `features/automation` | `modules/automation` | runbooks CRUD + execution status |
| `features/billing` | `modules/billing` | invoices (+ `/invoices/:id/download`), plans, subscriptions, refunds |
| `features/contact` | `modules/contact` | `POST /contact` (public), admin lead review |
| `features/tickets` | `modules/tickets` | tickets, replies, AI-draft approval |
| `features/admin` | `modules/admin` (+ service-catalog admin) | console aggregates |
| `features/landing` | composes `service-catalog` | public Service Boxes |

**Drift protection:** the API contract is generated from the backend (Swagger at `/api/docs`). The integration verification suite (`backend-core/test/verify/integration-contract.spec.ts`, `npm run test:verify`) walks every feature folder and fails CI if a folder has no matching module.

## 7.2 Backend ↔ Database

Every Prisma model has a named owning module — verified automatically:

| Table (model) | Owning module |
|---|---|
| User, Organization, OrganizationMember | `modules/users`, `modules/orgs` |
| RefreshToken | `modules/auth` (session machinery) |
| ApiKey | `modules/auth` |
| **ServiceLineCatalog** (`service_lines`) | **`modules/service-catalog`** |
| Product, ProductStage, Task, DesignArtifact, ProjectFile, Deployment, Comment, Message, Quote | `modules/projects` |
| MonitoringMetric, MonitoringMetricDaily, Alert, AiInsight | `modules/monitoring` |
| AutomationRunbook | `modules/automation` |
| Ticket, TicketMessage | `modules/tickets` |
| Invoice, Payment, Subscription, PricingPlan | `modules/billing` |
| Notification | `modules/notifications` |
| AuditLog, AiActionLog | `modules/audit` / `common/audit.service` |
| **ContactRequest** (`contact_requests`) | **`modules/contact`** |
| WebhookEvent | `modules/webhooks` |
| UsageRecord | `modules/billing` (metering) |

**Drift protection:** the verification suite extracts every `model` from `schema.prisma` and fails if no backend source reads/writes it (`prisma.<model>.` access). CI blocks merge on failure.

## 7.3 Backend ↔ AI services

- The frontend never calls AI services directly. `modules/ai` (AIOrchestration) mediates every call to the four FastAPI microservices (anomaly `:8101`, triage `:8102`, scoping `:8103`, code-assist `:8104`).
- Every AI action is logged to `ai_action_logs` (model, version, input hash, confidence, human-approval) and shown with an **"AI-suggested"** tag until approved.
- Internal calls authenticate with `INTERNAL_SERVICE_TOKEN` (timing-safe compared).

## 7.4 Application ↔ Infrastructure

| App artifact | Dockerfile | K8s manifests | Terraform target |
|---|---|---|---|
| `frontend` | `frontend/Dockerfile` | `k8s/base/frontend/` | `modules/compute` (EKS node groups on EC2) |
| `backend-core` | `backend-core/Dockerfile` | `k8s/base/backend-core/` (+ HPA, ConfigMap, secret template) | `modules/compute` + `modules/database` (RDS) |
| `worker` | `worker/Dockerfile` | `k8s/base/worker/` (+ HPA with queue-depth metric) | `modules/compute` |
| 4 AI services | `ai-services/*/Dockerfile` | `k8s/base/ai-services/` | `modules/compute` |

**Environment variables match name-for-name** across `.env.example` → `k8s/base/backend-core/{configmap,secret-template}.yaml` → Terraform outputs (the RDS endpoint Terraform produces is the exact `DATABASE_URL` value injected into the cluster secret — see `terraform/modules/database/main.tf` Secrets Manager resource).

## 7.5 CI/CD ↔ everything

- `scripts/build.sh`, `scripts/test.sh`, `scripts/deploy.sh` hold the actual build/test/deploy logic.
- GitHub Actions (`ci.yml`, `cd-staging.yml`, `cd-production.yml`) **and** Jenkins (`jenkins/Jenkinsfile`) both call these same scripts — the two CI systems cannot drift apart on what "deploy" means.
- One commit → one integrated release: images, Terraform plan/apply, k8s overlay, smoke-test gate.

## 7.6 Monitoring ↔ Automation ↔ client UI

One metric write (`POST /monitoring/ingest` from the worker's probes) fans out to:
1. the client-facing live dashboard (WebSocket broadcast from `modules/realtime`),
2. the alert engine (`modules/monitoring` + Alertmanager routes),
3. the automation runbook evaluator (`worker` reads the same metrics against `automation_runbooks` thresholds).

There is exactly one source of truth per metric — `monitoring_metrics` — never three drifting copies.

---

## Section 24 checklist — automated where possible

| Checklist item | Automated check |
|---|---|
| Every frontend feature has a backend module, and vice versa | `npm run test:verify` (CI) |
| Every table has a named owning module | `npm run test:verify` (CI) |
| Service Boxes rendered from `service_lines`, not hardcoded | `npm run test:verify` + E2E `e2e/journeys.spec.ts` |
| Every backend service has Dockerfile + K8s manifest + Terraform target | table above (manual review on PRs touching deploy targets) |
| Env vars match `.env.example` ↔ K8s ↔ Terraform | `secret-template.yaml` key list mirrors `.env.example`; verification suite asserts presence |
| GH Actions and Jenkins build/test/deploy identically | both call `scripts/{build,test,deploy}.sh` |
| One metric write drives dashboard + alert + runbook | `modules/realtime` + `modules/monitoring` + worker runbook evaluator share the same ingestion write |
| Company email/phone on Contact page, footer, invoice template | `npm run test:verify` asserts `mughammugheer@gmail.com` / `+92 304 0405194` in `lib/company.ts`, landing footer, contact page, `invoice-template.ts` |
| Design tokens are the only colors | Tailwind palette in `tailwind.config.js`; no ad-hoc hex in components |
| Full stack starts with `docker-compose up` + real signup-to-dashboard flow | E2E suite runs against the compose stack |
