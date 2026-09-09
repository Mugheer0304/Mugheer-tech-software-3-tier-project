# THE MUGHEER MASTER BUILD PROMPT
### A Full-Stack, AI-Augmented, Cloud-Native Software House Platform
**Prepared in the style of a senior prompt-engineering agency (20+ years combined experience)**
**Document Type:** Master Engineering Prompt / Product & Architecture Specification
**Version:** 1.0
**Classification:** Internal Build Directive — Feed this entire document to an AI coding agent (or a human engineering team) as the single source of truth.

---

## HOW TO USE THIS DOCUMENT

This is not a casual instruction. This is a **master prompt** — a complete brief you can hand, section by section or in full, to an AI system (Claude, GPT, or an autonomous coding agent) or to a human engineering team, and expect a production-grade result. It is written the way a veteran prompt engineer would write it after 20 years of watching vague briefs produce mediocre software: **explicit, structured, unambiguous, and exhaustive.**

If you are an AI agent reading this: you are being asked to act as the **Lead Architect + Full-Stack Engineering Team + DevOps Lead + AI/ML Engineer + Security Engineer** for a company called **Mugheer**. Do not ask the human to fill in gaps that are already specified below. Where something is genuinely open (e.g., final brand colors), make a sensible professional decision and state your assumption. Everything else — architecture, folder structure, file list, tech stack, deployment target — is fixed by this document.

---

## TABLE OF CONTENTS

1. Executive Summary & Persona
2. Company Overview — What "Mugheer" Is
3. Product Vision & Core Value Proposition
4. Services Catalog (What Mugheer Sells)
5. User Roles & Personas
6. High-Level System Architecture (Three-Tier)
7. Technology Stack (Complete)
8. Functional Requirements
9. Non-Functional Requirements
10. Authentication, Authorization & Login Methods
11. Payments & Billing
12. AI Systems, Libraries & Agents
13. Monitoring, Observability & Automation
14. Database Design
15. API Design
16. Frontend Architecture
17. Backend Architecture
18. DevOps & Infrastructure (Docker, Kubernetes, Terraform, CI/CD)
19. AWS EC2 Deployment Plan
20. Security Requirements
21. Testing Strategy
22. Complete Repository / File Structure
23. README.md — Required Content & Template
24. Development Roadmap & Milestones
25. Acceptance Criteria & Definition of Done
26. Appendix — Reference Snippets

---

## 1. EXECUTIVE SUMMARY & PERSONA

**Persona to adopt while executing this prompt:**

> "You are the Principal Architect at a senior software consultancy. You have shipped over 40 production platforms across fintech, SaaS, and agency tooling. You do not write throwaway code. You do not leave TODOs in production paths. You document as you build. You think in terms of three-tier separation, least privilege, observability-first, and infrastructure-as-code. You never say 'this is out of scope' when the client has already specified it — and in this document, almost nothing is out of scope."

**One-paragraph summary of the product:**

Mugheer is a software house platform — a single web application (with supporting backend services) that lets Mugheer's team and its clients do four things end-to-end: **build** software products (design + coding, front end and back end), **monitor** those products once live (uptime, performance, logs, AI-driven anomaly detection), **automate** recurring operational work (deployments, reports, alerts, ticket triage), and **manage the business** around all of it (client onboarding, project tracking, invoicing, payments, and team collaboration). The platform is built on a three-tier architecture, containerized with Docker, orchestrated with Kubernetes, provisioned with Terraform, deployed to AWS EC2, and shipped through a CI/CD pipeline with a companion automation/monitoring pipeline.

---

## 2. COMPANY OVERVIEW — WHAT "MUGHEER" IS

- **Brand name:** Mugheer
- **Tagline (proposed, adjust as needed):** *"Build. Monitor. Automate. Everything, in one place."*
- **Nature of business:** A software house / digital agency that (a) builds custom software products for clients, and (b) offers its own platform (this one) as a productized SaaS layer so clients can watch their projects being built, see live status of their deployed products, and interact with Mugheer's automation and AI systems without needing to email a project manager.
- **Primary buyer personas:** Startup founders needing an MVP, SMEs needing a product modernized, and enterprise clients needing a dedicated monitored environment with SLAs.
- **Primary business model:** Project-based development contracts + recurring managed-service subscriptions (monitoring, automation, maintenance) sold through the platform itself.

---

## 3. PRODUCT VISION & CORE VALUE PROPOSITION

Mugheer's platform must let a client, in one dashboard:

1. **Request a product** — describe what they want built (a website, an app, an internal tool), attach specs/assets, and get a quote and timeline.
2. **Watch it get built** — see design mockups, sprint boards, commits/build status, and staging previews as the Mugheer team works.
3. **Launch and monitor it** — once live, see uptime, response times, error rates, resource usage, and AI-flagged anomalies for their product, in real time.
4. **Automate operations** — configure automated deployments, scheduled reports, alert rules, and AI-assisted incident triage without needing DevOps knowledge themselves.
5. **Pay and manage billing** — see invoices, pay via card or other supported methods, manage subscriptions for ongoing monitoring/maintenance retainers.
6. **Collaborate** — chat/comment threads per project, shared files, role-based access for their own team members.

The platform's internal (Mugheer staff-facing) side must let engineers, designers, and admins manage all of the above: assign work, track velocity, configure client environments, respond to monitoring alerts, and manage the AI systems that assist with code generation, anomaly detection, and support automation.

---

## 4. SERVICES CATALOG (WHAT MUGHEER SELLS — MUST BE MODELED IN THE DATA LAYER AND UI)

The platform's data model, UI, and billing system must represent the following service lines as first-class entities (each with its own pricing model, deliverables, and status pipeline):

| Service Line | Description | Deliverable Type |
|---|---|---|
| Website / Web App Development | Custom marketing sites, web apps, portals | Codebase + staging + production deployment |
| Product Design (UI/UX) | Wireframes, prototypes, design systems | Figma-style design artifacts, exported assets |
| Backend / API Development | Custom services, integrations, data pipelines | API + docs + deployed service |
| Mobile App Development | iOS/Android or cross-platform apps | Build artifacts + store listing support |
| Managed Monitoring | Uptime, performance, log, and security monitoring for a client's live product | Dashboards + alerting + monthly report |
| Automation Engineering | CI/CD setup, scheduled jobs, workflow automation, chatbots | Automation scripts/pipelines + docs |
| AI Integration | Chatbots, recommendation engines, anomaly detection, code-assist tooling | Deployed AI service + evaluation report |
| Maintenance Retainer | Bug fixes, dependency upgrades, minor feature work on a subscription basis | Ticket-based delivery |

Each service line must map to: a **Product** entity in the DB, a **Pricing Plan**, a **Status Pipeline** (e.g., Requested → Scoped → In Design → In Development → In QA → Staged → Launched → Monitored), and a **Client-visible timeline view.**

---

## 5. USER ROLES & PERSONAS

The system must implement role-based access control (RBAC) with at least the following roles:

1. **Super Admin** — full control over the platform, billing configuration, user management, infrastructure settings.
2. **Admin / Project Manager (internal)** — manages clients, projects, assigns team members, views all monitoring dashboards, approves invoices.
3. **Engineer (internal)** — frontend, backend, DevOps, or AI engineer; sees assigned tasks, project repos/status, and monitoring data for products they maintain.
4. **Designer (internal)** — manages design artifacts and design-stage tickets.
5. **Client Owner** — the primary contact for a client account; can request new products, approve quotes, manage billing, invite client team members.
6. **Client Team Member** — limited client-side user; can view project status and comment, cannot manage billing.
7. **AI Agent (system role)** — a non-human actor with scoped permissions to read monitoring data, open/triage tickets, post automated comments, and trigger pre-approved automation runbooks. AI Agent actions must always be logged and attributed as "AI Agent" in the audit trail — never silently merged into a human's history.
8. **Support/Success Rep (internal)** — handles client communication, escalations, and retainer renewals.

Every role's permission matrix must be enforced **server-side**, not just hidden in the UI.

---

## 6. HIGH-LEVEL SYSTEM ARCHITECTURE (THREE-TIER)

The system must be explicitly structured into three tiers, physically and logically separated:

### Tier 1 — Presentation Layer (Frontend)
- Single-page application (React) served as static assets via CDN/Nginx.
- Talks only to the Application Layer via REST/GraphQL over HTTPS — never talks to the database directly, never talks to infrastructure APIs directly.
- Responsible for: rendering, client-side state, form validation (mirrored server-side), and websocket subscriptions for live monitoring data.

### Tier 2 — Application / Logic Layer (Backend)
- A set of backend services (can start as a modular monolith, structured so it can be split into microservices later — see Section 17) exposing REST + GraphQL APIs.
- Owns: authentication, business logic, payment orchestration, project/task management, monitoring ingestion, automation orchestration, AI orchestration (calls out to AI/ML services), notification dispatch.
- The only tier permitted to talk to the Data Layer.

### Tier 3 — Data Layer
- Relational database (PostgreSQL) for transactional data (users, projects, invoices, tickets).
- Object storage (S3) for files, design assets, build artifacts, logs archives.
- Time-series store (e.g., Prometheus/Timescale) for monitoring metrics.
- Cache/session store (Redis) sitting logically between Tier 2 and Tier 3 for performance — still governed by the same access rules as the Data Layer (no direct frontend access, ever).

**Diagram description (render as an architecture diagram in the actual project README):**

```
[ Browser / Mobile Client ]
        |
        |  HTTPS (REST/GraphQL, WebSocket)
        v
[ Tier 1: Frontend — React SPA behind CloudFront/Nginx ]
        |
        |  HTTPS (internal ALB)
        v
[ Tier 2: Application Layer ]
   - Auth Service
   - Project/Product Service
   - Billing/Payments Service
   - Monitoring Ingestion Service
   - Automation Orchestrator
   - AI Orchestration Service
        |
        v
[ Tier 3: Data Layer ]
   - PostgreSQL (primary transactional DB)
   - Redis (cache/sessions/queues)
   - S3 (object storage)
   - Prometheus/Timescale (metrics)
   - Elasticsearch/OpenSearch (logs, optional)
```

All cross-tier traffic must be authenticated (mTLS or signed internal JWTs between services). No tier may skip a layer.

---

## 7. TECHNOLOGY STACK (COMPLETE)

| Layer | Technology |
|---|---|
| Frontend framework | React 18+ with TypeScript |
| State management | Redux Toolkit or Zustand |
| Styling | Tailwind CSS + a design token system |
| Frontend build | Vite |
| Backend framework | Node.js (NestJS) **or** Python (FastAPI) — pick one and be consistent; this document defaults to **Node.js/NestJS** for the core app and **Python/FastAPI** for AI microservices |
| API style | REST (public/client-facing) + GraphQL (internal dashboards/aggregation) |
| Database | PostgreSQL 15+ |
| ORM | Prisma (Node) / SQLAlchemy (Python) |
| Cache/Queue | Redis (cache) + BullMQ or RabbitMQ (job queues) |
| Object storage | AWS S3 |
| Search/logs | OpenSearch (optional, for log aggregation) |
| Metrics | Prometheus + Grafana |
| AI/ML | Python, LangChain (agent orchestration), OpenAI/Anthropic API SDKs, scikit-learn (anomaly detection baseline models), PyTorch (custom models if needed) |
| Auth | JWT (access + refresh tokens), OAuth2 (Google, GitHub), optional SSO (SAML) for enterprise clients, TOTP-based 2FA |
| Payments | Stripe (primary), PayPal (secondary) |
| Containerization | Docker, Docker Compose (local dev) |
| Orchestration | Kubernetes (EKS or self-managed on EC2) |
| IaC | Terraform |
| CI/CD | GitHub Actions (build/test/deploy pipeline) |
| Automation/runbooks | Argo Workflows or a custom automation service + cron-based schedulers |
| Cloud provider | AWS (EC2 as the deployment target per requirement; VPC, S3, RDS, ALB, IAM, CloudWatch as supporting services) |
| Secrets management | AWS Secrets Manager / HashiCorp Vault |
| Monitoring/alerting | Prometheus, Grafana, Alertmanager, PagerDuty/Slack integration |

---

## 8. FUNCTIONAL REQUIREMENTS

The platform **must** implement the following capabilities. Nothing in this list is optional.

### 8.1 Client-Facing
- Client registration & onboarding wizard (company info, first product request).
- Product/service request form with file attachments and requirement templates per service line (Section 4).
- Live project timeline view (kanban + Gantt-style) per product, with stage-by-stage status.
- Design review interface (comment on mockups, approve/reject).
- Staging environment preview links per project.
- Live monitoring dashboard per launched product: uptime %, response time graph, error rate, resource usage, and an "AI Insights" panel summarizing anomalies in plain language.
- Automation configuration panel: toggle scheduled deploys, alert thresholds, report frequency — without needing to write YAML.
- Billing dashboard: current plan, invoices, payment methods, usage-based add-ons.
- Support/ticketing thread per project, with AI-suggested responses visible to the (human) support rep before sending.
- Notification center (in-app, email, optional Slack webhook for the client's own team).

### 8.2 Internal (Mugheer Staff)
- Admin console: manage clients, users, roles, service catalog, pricing.
- Project management board: assign engineers/designers, track sprints, link tasks to Git commits/PRs.
- Global monitoring console aggregating all client products.
- Alert triage console with AI-suggested root cause and AI-suggested runbook.
- Automation runbook builder (trigger → condition → action, e.g., "if CPU > 85% for 5 min → scale pod → notify Slack").
- Invoice generation, approval, and payment reconciliation view.
- Audit log viewer (who/what/when, including AI Agent actions).
- Reporting module: generate PDF/CSV reports per client per period.

### 8.3 AI-Specific Functional Requirements (see Section 12 for depth)
- AI code-assist for internal engineers (suggests code within IDE-adjacent tooling or platform code editor).
- AI anomaly detection on monitoring metrics (flags abnormal patterns, not just static thresholds).
- AI support-ticket triage (classifies, prioritizes, and drafts responses for human approval).
- AI project-scoping assistant (turns a client's plain-language request into a structured requirement + rough estimate, for a human to review before quoting).

---

## 9. NON-FUNCTIONAL REQUIREMENTS

- **Availability:** 99.9% uptime target for the platform itself; per-client SLA configurable for monitored products.
- **Performance:** API p95 latency under 300ms for standard CRUD endpoints; dashboard initial load under 2.5s on broadband.
- **Scalability:** Horizontal scaling of stateless backend services via Kubernetes HPA (CPU/memory + custom metric triggers from queue depth).
- **Security:** OWASP Top 10 mitigations mandatory (see Section 20).
- **Data retention:** Monitoring metrics retained at full resolution for 30 days, downsampled for 1 year; audit logs retained 1 year minimum (adjust to any regulatory requirement the client base needs).
- **Accessibility:** WCAG 2.1 AA compliance for the client-facing dashboard.
- **Internationalization:** UI text externalized for future localization even if only English ships first.
- **Backup/DR:** Automated daily DB snapshots, cross-AZ RDS replication, documented restore runbook with an RTO/RPO target (propose RTO ≤ 4h, RPO ≤ 15min unless the business specifies otherwise).

---

## 10. AUTHENTICATION, AUTHORIZATION & LOGIN METHODS

- **Primary login:** email + password (bcrypt/argon2 hashed, never plaintext, never reversible encryption).
- **OAuth2 social login:** Google and GitHub (GitHub especially relevant since engineers/clients may already use it).
- **Enterprise SSO:** SAML 2.0 / OIDC support for larger clients (stub the integration point even if only one enterprise client needs it at launch).
- **Two-factor authentication (2FA):** TOTP (Google Authenticator-compatible) mandatory for all internal staff accounts; optional but encouraged for clients.
- **Session model:** short-lived JWT access token (15 min) + rotating refresh token (7–30 days) stored in an HttpOnly, Secure, SameSite cookie — never in localStorage.
- **Password policy:** minimum 12 characters, breach-list checked (e.g., via HaveIBeenPwned range API) at signup/reset.
- **Account recovery:** email-based reset with single-use, time-limited token; rate-limited to prevent abuse.
- **RBAC enforcement:** every API route decorated with a required-role/permission check; deny-by-default.
- **API keys:** separate long-lived API key mechanism for machine-to-machine access (e.g., a client's CI pipeline reporting deploy status back to Mugheer) — distinct from user session tokens, individually revocable.

---

## 11. PAYMENTS & BILLING

- **Payment processors:** Stripe as primary (cards, ACH where available), PayPal as secondary option.
- **Billing models supported:**
  - One-time project invoices (milestone-based, e.g., 30% deposit / 40% mid / 30% delivery).
  - Recurring subscriptions for Managed Monitoring, Automation, and Maintenance Retainer service lines (monthly/annual).
  - Usage-based add-ons (e.g., extra monitored endpoints beyond plan quota) metered and billed via Stripe usage records.
- **Invoicing:** auto-generated PDF invoices, tax-line support (configurable tax rate/region), downloadable from client dashboard.
- **Webhooks:** Stripe webhook listener (payment succeeded/failed, subscription updated/canceled) updating the platform's billing state — must be idempotent and signature-verified.
- **PCI compliance posture:** never store raw card data; use Stripe Elements/Checkout so card data never touches Mugheer's own servers (SAQ-A scope).
- **Dunning:** automated retry + email sequence for failed recurring payments before service suspension.
- **Refunds/credits:** admin-triggered partial/full refund flow, logged in audit trail.

---

## 12. AI SYSTEMS, LIBRARIES & AGENTS

### 12.1 AI Services to Build
1. **Anomaly Detection Service** — ingests time-series metrics (response time, error rate, CPU/mem) per client product; baseline statistical model (e.g., seasonal ESD or isolation forest) flags deviations; escalates to alerting pipeline.
2. **Support Triage Agent** — classifies incoming tickets (bug/feature/billing/urgent), suggests priority, and drafts a first-response reply for human approval (never auto-sends without a human click, unless the client explicitly opts into full automation for low-risk categories).
3. **Scoping Assistant** — takes a client's free-text product request and returns a structured brief (features list, rough complexity estimate, suggested service lines) for a human PM to refine into a quote.
4. **Code-Assist Service** — internal-only tool giving engineers inline suggestions/snippets scoped to the project's own codebase context (retrieval-augmented, not blind generation).
5. **Automated Report Generator** — assembles a natural-language monthly summary of a client's product health from raw metrics.

### 12.2 Libraries / Frameworks
- **LangChain** or a lightweight custom orchestration layer for agent workflows (tool-calling, retrieval).
- **OpenAI/Anthropic SDKs** for LLM calls (model choice configurable; do not hardcode a single vendor).
- **scikit-learn** for classical anomaly detection baselines.
- **PyTorch** reserved for any custom model training if classical methods prove insufficient.
- **Vector store** (e.g., pgvector extension on the existing PostgreSQL, or a dedicated vector DB) for retrieval-augmented features (code-assist, scoping assistant referencing past projects).

### 12.3 AI Governance ("AI Maintainers")
- Every AI-generated action affecting a client (draft reply, suggested runbook, anomaly alert) is logged with: model/version used, input context hash, confidence score, and human-approval status.
- A designated internal role ("AI Maintainer") reviews a sample of AI outputs weekly and can disable/retrain any AI feature independently of a full deploy.
- Rate limits and cost budgets per AI feature to prevent runaway API spend.
- Clear UI labeling: anything AI-generated shown to a client or engineer is visibly marked "AI-suggested" until a human approves it.

---

## 13. MONITORING, OBSERVABILITY & AUTOMATION

- **Metrics collection:** each deployed client product exposes a `/metrics` endpoint (Prometheus format) or is monitored via synthetic checks (HTTP uptime probes) if instrumentation isn't possible.
- **Dashboards:** Grafana dashboards per client, embedded (via signed iframe or re-built in-platform using the same data) into the client-facing UI.
- **Alerting:** Alertmanager routes: critical → PagerDuty/SMS, warning → Slack/email, info → in-app notification only.
- **Log aggregation:** structured JSON logs shipped to OpenSearch/CloudWatch Logs; per-client log views scoped by IAM/tenant filtering so clients only ever see their own logs.
- **Automation runbooks:** trigger → condition → action model (see 8.2); initial built-in runbooks:
  - Auto-restart a crashed service (bounded retry count, then escalate to human).
  - Auto-scale on sustained load.
  - Auto-generate and email a weekly health report.
  - Auto-open a ticket when error rate crosses threshold, tagged and pre-triaged by the Support Triage Agent.
- **Automation pipeline vs. CI/CD pipeline:** kept distinct — CI/CD (Section 18) ships *code*; the automation pipeline (this section) operates *running systems*. Both are auditable and both support manual override/kill-switch.

---

## 14. DATABASE DESIGN (CORE ENTITIES)

Minimum required tables/entities (design full schema with proper keys, indices, and constraints from these):

- `users` (id, email, password_hash, role, mfa_secret, created_at, ...)
- `organizations` (id, name, type[internal/client], billing_customer_id, ...)
- `organization_members` (org_id, user_id, role)
- `products` (id, org_id, service_line, name, status, created_at, ...)
- `product_stages` (id, product_id, stage_name, entered_at, exited_at)
- `tasks` (id, product_id, assignee_id, title, status, sprint_id, ...)
- `design_artifacts` (id, product_id, file_url, version, approved_by, ...)
- `deployments` (id, product_id, environment, commit_sha, status, deployed_at)
- `monitoring_metrics` (time-series table: product_id, metric_name, value, timestamp)
- `alerts` (id, product_id, severity, message, ai_confidence, status, created_at)
- `automation_runbooks` (id, product_id, trigger, condition, action, enabled)
- `tickets` (id, product_id, org_id, subject, status, priority, ai_suggested_reply)
- `invoices` (id, org_id, amount, status, stripe_invoice_id, due_date)
- `subscriptions` (id, org_id, plan_id, status, stripe_subscription_id)
- `audit_logs` (id, actor_type[user/ai_agent], actor_id, action, target, timestamp)
- `api_keys` (id, org_id, key_hash, scopes, last_used_at, revoked_at)

All tables: `created_at`/`updated_at` timestamps, soft-delete (`deleted_at`) where appropriate, and foreign keys with `ON DELETE` behavior explicitly chosen (not left default).

---

## 15. API DESIGN

- **Public/client API:** REST, versioned (`/api/v1/...`), OpenAPI/Swagger spec generated and published.
- **Internal dashboard API:** GraphQL for flexible aggregation (e.g., a single query pulling a client's products + latest metrics + open tickets for the PM dashboard).
- **Webhook endpoints:** `/webhooks/stripe`, `/webhooks/github` (for CI status), `/webhooks/monitoring` — all signature-verified.
- **WebSocket channel:** for live monitoring updates and live chat/comments, authenticated on connect via the same JWT.
- **Rate limiting:** per-user and per-API-key, sliding window, 429 responses with `Retry-After`.
- **Pagination:** cursor-based for large lists (metrics, logs, audit entries).
- **Error format:** consistent JSON error envelope (`{ "error": { "code", "message", "details" } }`) across every endpoint.

---

## 16. FRONTEND ARCHITECTURE

- React + TypeScript SPA, feature-folder structure (not type-folder), e.g. `/features/projects`, `/features/monitoring`, `/features/billing`.
- Shared design system in `/components/ui` built on Tailwind, documented via Storybook.
- Route-based code splitting; role-aware routing (client vs internal shells share components but differ in navigation/permissions).
- Real-time data via WebSocket hook (`useLiveMetrics`, `useLiveTickets`).
- Form handling via React Hook Form + schema validation (Zod), mirrored on the backend.
- State: server state via React Query (or equivalent), client/UI state via Zustand/Redux Toolkit — kept clearly separate, not mixed.
- Accessibility baked in: semantic HTML, focus management, ARIA labels on all interactive/monitoring widgets.

---

## 17. BACKEND ARCHITECTURE

- Start as a **modular monolith** (NestJS modules: `AuthModule`, `ProjectsModule`, `BillingModule`, `MonitoringModule`, `AutomationModule`, `AIOrchestrationModule`, `NotificationsModule`) with clear internal boundaries so any module can be extracted into its own microservice later without a rewrite.
- `AIOrchestrationModule` calls out to separate Python/FastAPI AI microservices (anomaly detection, triage, scoping, code-assist) over internal REST/gRPC — keeping AI runtime dependencies isolated from the Node core.
- Background jobs (report generation, dunning retries, automation runbook execution) run via a queue worker (BullMQ + Redis), separate from the request-handling web process, independently scalable in Kubernetes.
- All inter-service calls authenticated with short-lived internal service tokens.
- Centralized structured logging (JSON), correlation ID propagated through every request/job.

---

## 18. DEVOPS & INFRASTRUCTURE (DOCKER, KUBERNETES, TERRAFORM, CI/CD)

### 18.1 Docker
- One `Dockerfile` per deployable service (`frontend`, `backend-core`, `ai-anomaly-service`, `ai-triage-service`, `worker`), multi-stage builds (build stage → slim runtime stage), non-root user in the final image, `.dockerignore` per service.
- `docker-compose.yml` for local development spinning up: frontend, backend, Postgres, Redis, and the AI services, with hot-reload volumes.

### 18.2 Kubernetes
Required manifests (per service, organized under `/k8s`):
- `deployment.yaml` (resource requests/limits set explicitly, readiness + liveness probes).
- `service.yaml`.
- `ingress.yaml` (TLS via cert-manager, host-based routing for `app.mugheer.com` and `api.mugheer.com`).
- `configmap.yaml` for non-secret config.
- `secret.yaml` references (actual secret values sourced from AWS Secrets Manager via an external-secrets operator — never committed in plaintext).
- `hpa.yaml` (Horizontal Pod Autoscaler, CPU + custom metrics from Prometheus adapter for queue-depth-based scaling of workers).
- `networkpolicy.yaml` restricting which pods can talk to which (frontend cannot reach the database pods directly, enforcing the three-tier rule at the network level too).
- Helm chart (optional but recommended) wrapping the above for environment-specific value overrides (`values-staging.yaml`, `values-production.yaml`).

### 18.3 Terraform
Organized under `/terraform` with remote state (S3 backend + DynamoDB lock table), modules for:
- `network` — VPC, public/private subnets across ≥2 AZs, NAT gateway, route tables.
- `compute` — EC2 launch templates/Auto Scaling Group (or EKS node group if running Kubernetes on managed control plane), security groups scoped per tier (frontend SG, backend SG, DB SG — only backend SG can reach DB SG on the Postgres port).
- `database` — RDS PostgreSQL (Multi-AZ), parameter group, automated backups.
- `storage` — S3 buckets (assets, backups, logs) with versioning and lifecycle policies.
- `iam` — least-privilege roles per service (EC2 instance role, CI/CD deploy role, app service role).
- `dns_cert` — Route53 records + ACM certificates.
- `monitoring` — CloudWatch alarms as a baseline layer beneath Prometheus/Grafana.

Each module: `main.tf`, `variables.tf`, `outputs.tf`, and a root `environments/staging` and `environments/production` composition.

### 18.4 CI/CD Pipeline (GitHub Actions example, `/​.github/workflows`)
- `ci.yml`: on PR — lint, type-check, unit test, build, container image scan (Trivy), upload coverage.
- `cd-staging.yml`: on merge to `develop` — build & push image, `terraform plan`/`apply` for staging (if infra changed), `kubectl apply`/Helm upgrade to staging namespace, run smoke tests.
- `cd-production.yml`: on tagged release — same as above targeting production namespace, gated by required manual approval, with automated rollback on failed health checks post-deploy.
- Secrets (AWS credentials, Docker registry creds) stored in GitHub Actions encrypted secrets, scoped per environment.

### 18.5 Automation Pipeline (distinct from CI/CD — see Section 13)
- Implemented via a scheduler/worker (e.g., cron-triggered jobs in the `worker` service, or Argo Workflows if the team wants a dedicated engine) executing the `automation_runbooks` table's logic against live client environments.

---

## 19. AWS EC2 DEPLOYMENT PLAN

- **Target:** the application tiers run on EC2 instances (per the explicit requirement), either directly (Auto Scaling Group behind an Application Load Balancer) or as Kubernetes worker nodes (self-managed `kubeadm` cluster on EC2, or EKS with EC2-backed node groups — recommended: **EKS with EC2 node groups**, giving Kubernetes orchestration while satisfying the EC2 requirement).
- **Network layout:** public subnets host only the ALB/bastion; all EC2 instances (frontend pods' nodes, backend nodes, worker nodes) sit in private subnets; RDS in isolated private subnets with no route to the internet.
- **Scaling:** ASG/node group scales EC2 count based on aggregate pod resource pressure; Kubernetes HPA scales pods within that capacity.
- **Access:** no direct SSH from the internet — access via SSM Session Manager or a bastion host behind a VPN/IP allowlist.
- **TLS termination:** at the ALB (ACM certificate), internal traffic to nodes over the private network, optionally re-encrypted pod-to-pod via a service mesh (Linkerd/Istio) if the team wants mTLS between microservices.
- **Cost control:** mix of On-Demand for baseline capacity and Spot for stateless worker/CI runner capacity where interruption is tolerable.

---

## 20. SECURITY REQUIREMENTS

- OWASP Top 10 mitigations: parameterized queries (ORM handles this by default — verify no raw string SQL), output encoding against XSS, CSRF tokens on state-changing form submissions not covered by SameSite cookies alone, strict CSP headers, dependency vulnerability scanning in CI (Trivy/Snyk/Dependabot).
- Secrets never committed to git; `.env.example` only, real secrets in AWS Secrets Manager/Vault.
- All traffic HTTPS-only, HSTS enabled.
- Tenant isolation: every DB query scoped by `organization_id`; add automated tests specifically asserting cross-tenant data cannot leak.
- Audit logging for all privileged actions (Section 14, `audit_logs` table), immutable (append-only, no update/delete permission granted to application role).
- Regular automated dependency and container image scanning as part of CI (Section 18.4).
- Incident response runbook documented in the README (who to page, how to roll back, how to notify affected clients).

---

## 21. TESTING STRATEGY

- **Unit tests:** every service module, ≥80% line coverage target on business logic (not a vanity metric on generated code).
- **Integration tests:** API endpoints against a real (containerized) Postgres/Redis in CI.
- **Contract tests:** frontend/backend API contract validated against the OpenAPI/GraphQL schema to catch drift.
- **End-to-end tests:** Playwright/Cypress covering core client journeys (signup → request product → view monitoring → pay invoice) and core internal journeys (assign task → deploy → resolve alert).
- **Load testing:** k6 or Locust scripts for the monitoring ingestion endpoint and the dashboard API, run before major releases.
- **AI evaluation tests:** a fixed evaluation set for each AI feature (anomaly detection precision/recall on labeled historical incidents; triage classification accuracy) run in CI whenever prompts/models change, with a required minimum score before merge.

---

## 22. COMPLETE REPOSITORY / FILE STRUCTURE

```
mugheer/
├── README.md
├── LICENSE
├── .env.example
├── docker-compose.yml
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── cd-staging.yml
│       └── cd-production.yml
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── app/
│   │   ├── components/ui/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── projects/
│   │   │   ├── monitoring/
│   │   │   ├── automation/
│   │   │   ├── billing/
│   │   │   └── admin/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── styles/
│   └── tests/
├── backend-core/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── main.ts
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── projects/
│   │   │   ├── billing/
│   │   │   ├── monitoring/
│   │   │   ├── automation/
│   │   │   ├── ai-orchestration/
│   │   │   └── notifications/
│   │   ├── common/ (guards, interceptors, decorators)
│   │   └── prisma/
│   │       └── schema.prisma
│   └── test/
├── ai-services/
│   ├── anomaly-detection/
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── app/
│   ├── support-triage/
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── app/
│   ├── scoping-assistant/
│   └── code-assist/
├── worker/
│   ├── Dockerfile
│   └── src/
├── k8s/
│   ├── base/
│   │   ├── frontend/
│   │   ├── backend-core/
│   │   ├── ai-services/
│   │   └── worker/
│   └── overlays/
│       ├── staging/
│       └── production/
├── terraform/
│   ├── modules/
│   │   ├── network/
│   │   ├── compute/
│   │   ├── database/
│   │   ├── storage/
│   │   ├── iam/
│   │   ├── dns_cert/
│   │   └── monitoring/
│   └── environments/
│       ├── staging/
│       └── production/
├── monitoring/
│   ├── prometheus/
│   ├── grafana/
│   │   └── dashboards/
│   └── alertmanager/
├── scripts/
│   ├── seed-db.sh
│   ├── backup-db.sh
│   └── smoke-test.sh
└── docs/
    ├── ARCHITECTURE.md
    ├── API.md
    ├── RUNBOOK.md
    └── SECURITY.md
```

---

## 23. README.md — REQUIRED CONTENT & TEMPLATE

The root `README.md` must contain, in this order:

1. **Project name & one-line description** ("Mugheer — the platform our software house runs on.")
2. **Purpose** — why this exists (Section 3 of this document, condensed).
3. **Architecture overview** — the three-tier diagram (Section 6), embedded as an image or Mermaid diagram.
4. **Tech stack table** (Section 7, condensed).
5. **Getting started locally** — prerequisites, `docker-compose up`, seed data script, default local URLs/ports.
6. **Environment variables** — table of every required var with description (mirrors `.env.example`).
7. **Running tests** — exact commands per test type (Section 21).
8. **Deployment** — how staging/production deploys are triggered (Section 18.4), and how to roll back.
9. **Infrastructure** — how to run Terraform (`terraform init/plan/apply` per environment), and how to apply Kubernetes manifests/Helm charts.
10. **Monitoring & alerts** — where dashboards live, how to add a new alert rule.
11. **AI systems** — list of AI services, what each does, how to evaluate/retrain (Section 12).
12. **Security** — link to `docs/SECURITY.md`, how to report a vulnerability.
13. **Contributing** — branch naming, PR checklist, code style/lint commands.
14. **License & contact.**

---

## 24. DEVELOPMENT ROADMAP & MILESTONES

| Phase | Scope | Suggested Duration |
|---|---|---|
| Phase 0 — Foundations | Repo scaffolding, CI skeleton, Docker/Compose, base auth, base DB schema | 2–3 weeks |
| Phase 1 — Core Platform | Projects/products module, client dashboard MVP, internal admin console, RBAC | 4–6 weeks |
| Phase 2 — Billing | Stripe/PayPal integration, invoicing, subscriptions | 2–3 weeks |
| Phase 3 — Monitoring | Metrics ingestion, Grafana/Prometheus wiring, client-facing monitoring dashboard | 3–4 weeks |
| Phase 4 — Automation | Runbook engine, alerting integrations, scheduled reports | 3 weeks |
| Phase 5 — AI Systems | Anomaly detection, support triage, scoping assistant, code-assist (internal) | 4–6 weeks |
| Phase 6 — Infra Hardening | Terraform for production, Kubernetes production overlays, security review, load testing | 3 weeks |
| Phase 7 — Launch | Production deploy on AWS EC2/EKS, DNS cutover, post-launch monitoring | 1 week |

---

## 25. ACCEPTANCE CRITERIA & DEFINITION OF DONE

A feature/module is only "done" when:
- Code is merged behind CI (Section 18.4) with all checks green.
- Unit + integration tests exist and pass (Section 21).
- The feature is documented (README and/or `docs/`).
- RBAC rules for the feature are enforced server-side and covered by a negative test (unauthorized access denied).
- Relevant Kubernetes manifests and Terraform (if new infra is needed) are updated in the same PR or a linked follow-up.
- Monitoring/alerting is wired for any new user-facing service (no feature ships silent).
- If the feature involves AI, it has an evaluation baseline recorded (Section 21, AI evaluation tests).

---

## 26. APPENDIX — REFERENCE SNIPPETS

**Example minimal `Dockerfile` (backend-core, multi-stage):**
```dockerfile
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
RUN useradd --uid 1001 --create-home appuser
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
USER appuser
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

**Example Kubernetes `deployment.yaml` skeleton:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-core
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend-core
  template:
    metadata:
      labels:
        app: backend-core
    spec:
      containers:
        - name: backend-core
          image: <registry>/mugheer-backend-core:<tag>
          resources:
            requests: { cpu: "250m", memory: "256Mi" }
            limits: { cpu: "500m", memory: "512Mi" }
          readinessProbe:
            httpGet: { path: /health, port: 3000 }
            initialDelaySeconds: 5
          livenessProbe:
            httpGet: { path: /health, port: 3000 }
            initialDelaySeconds: 15
```

**Example Terraform network module call:**
```hcl
module "network" {
  source              = "../../modules/network"
  environment         = "production"
  vpc_cidr            = "10.0.0.0/16"
  availability_zones  = ["us-east-1a", "us-east-1b"]
}
```

---

### CLOSING INSTRUCTION TO THE BUILDING AGENT

Execute this brief top to bottom. Where a decision is required and this document has already made it (stack choices, folder layout, entity list), **do not re-litigate it — build it.** Where something is genuinely undecided (exact brand colors, final copywriting, specific alert thresholds), make a professional default choice, note it clearly as an assumption in the delivered README, and move forward. The end deliverable is a working, documented, deployable, three-tier, AI-augmented software house platform named **Mugheer** — not a partial scaffold and not a design document alone.

**— End of Master Prompt —**
