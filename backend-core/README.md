# backend-core — Mugheer API Server (Tier 2: Application Layer)

**What this does:** the NestJS 10 modular monolith that is the brain of Mugheer. It is the **only** tier allowed to touch PostgreSQL. It exposes the versioned REST API (`/api/v1/...` + Swagger UI), authenticates users (JWT + rotating refresh tokens, TOTP 2FA, Google/GitHub OAuth, API keys), enforces server-side RBAC and tenant isolation, talks to the Python AI microservices, receives Stripe/GitHub webhooks, and pushes live events over WebSocket.

## Files / folders in this service

| Path | What it is |
|---|---|
| `src/main.ts` | Bootstrap: security (helmet), CORS, validation, global prefix, Swagger at `/api/docs` |
| `src/app.module.ts` | Root module wiring all feature modules |
| `src/common/config.ts` + `config.module.ts` | Typed, validated environment configuration |
| `src/common/prisma.service.ts` / `prisma.module.ts` | Database client lifecycle (global) |
| `src/common/audit.service.ts` | Global append-only audit logging (human **and** AI-agent actions) |
| `src/common/guards/` | `jwt-auth.guard` (global auth), `roles.guard` (deny-by-default RBAC), `internal-service.guard` (timing-safe worker/AI→core token) |
| `src/common/decorators/roles.decorator.ts` | `@Roles(...)`, `@Public()`, `@Permissions(...)` |
| `src/common/filters/json-rpc-exception.filter.ts` | The single JSON error envelope `{ error: { code, message, ... } }` |
| `src/common/interceptors/logging.interceptor.ts` | Structured JSON logs + `correlationId` on every request |
| `src/common/pipes/zod.pipe.ts` | Zod validation (mirrors frontend schemas) |
| `src/modules/auth/` | Signup/login, refresh rotation **with family reuse detection**, 2FA setup/confirm/disable, OAuth callbacks, API keys |
| `src/modules/users/` | Listing, invites, role changes, deactivation |
| `src/modules/orgs/` | Client organizations (tenant root) |
| `src/modules/projects/` | Products, stage pipeline, quotes, design review, deployments + `tasks` (sprint board) |
| `src/modules/billing/` | Invoices (create/pay/refund with tax), subscriptions, usage metering, dunning; `stripe.service.ts` wrapper (mock mode without keys) |
| `src/modules/monitoring/` | Metric ingestion, dashboards, series, alert evaluation + `alerts.service.ts` threshold rules with dedupe windows |
| `src/modules/automation/` | Runbook CRUD + execution engine (trigger → condition → action, bounded retries) |
| `src/modules/tickets/` | Support tickets, threaded messages, AI-triage draft handling |
| `src/modules/notifications/` | In-app notifications + email (SMTP) |
| `src/modules/ai/` | Orchestration of the 4 Python AI services + governance log + budget cap |
| `src/modules/webhooks/` | Signature-verified, idempotent Stripe & GitHub event processing |
| `src/modules/realtime/` | Socket.IO gateway (`/live`) — JWT-authenticated metric/alert channels |
| `src/modules/health/` | `/health` (liveness) and `/health/ready` (readiness, checks DB) |
| `prisma/schema.prisma` | Complete data model — 25 entities, enums, indices, explicit FK behavior |
| `prisma/seed.ts` | Idempotent demo data (internal staff, Acme Corp, product, runbooks, metrics, ticket, invoice) |
| `test/unit/` | Fast unit tests (no DB) |
| `test/integration/` | Full HTTP integration tests against real Postgres |
| `scripts/start-test-server.sh` | Boots a disposable API server for integration tests |
| `Dockerfile` | Multi-stage build, non-root runtime user, healthcheck |

## Quick start

```bash
# 1. Install + generate the Prisma client
npm install
npx prisma generate

# 2. Start the database (from the repo root)
cd ..
docker compose up -d postgres redis
cd backend-core

# 3. Create schema + demo data
npx prisma db push
npx ts-node prisma/seed.ts

# 4. Run it
npm run start:dev          # dev with watch  → http://localhost:3000/api/v1
npm run build && npm start # production build
```

Open **http://localhost:3000/api/docs** for interactive API docs. Log in with any seeded account (see root README) and click **Authorize** in Swagger to try authenticated endpoints.

Minimum env vars (defaults exist for local dev — see `../.env.example` for all):
`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `INTERNAL_SERVICE_TOKEN`.

## How to work on it

```bash
npm run start:dev          # watch mode
npm run lint               # ESLint
npm run format             # Prettier
npm run build              # tsc → dist/ (CI runs this with --noEmit first)
npm run test:unit          # fast tests, no services needed
npm run test:integration   # needs Postgres + built dist + running server (see root README)
```

### Adding a new feature module — step by step

1. `nest g module modules/<name>` (or copy a small existing module like `orgs`).
2. Create `<name>.service.ts` (inject `PrismaService`; call `AuditService.log()` for every privileged action) and `<name>.controller.ts`.
3. Protect it: add `@Roles('SUPER_ADMIN', 'ADMIN')` (or the roles that apply) — routes are **deny-by-default**; use `@Public()` only for genuinely public endpoints.
4. **Tenant-scope every query**: for client-facing reads filter by `user.orgId` (available on `req.user` — the JWT strategy populates it); write a negative test proving another org gets `403`.
5. If other modules need this service, make the module `@Global()` or export the provider explicitly.
6. If it introduces new tables: edit `prisma/schema.prisma` → `npx prisma migrate dev --name <change>` (commit the generated SQL).
7. Add tests to `test/unit/` and/or `test/integration/`, then open a PR — CI runs everything.

### Conventions you must keep

- Every response error uses the global envelope — don't hand-roll error shapes.
- Every privileged action gets an audit entry; AI-triggered ones use `actorType: 'AI_AGENT'`.
- Refresh tokens are **never** stored client-side; they live in the HttpOnly cookie.
- Raw SQL must stay parameterized (`prisma.$queryRaw` with tags) — never string-built.
