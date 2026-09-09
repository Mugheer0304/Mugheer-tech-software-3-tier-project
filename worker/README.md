# worker — Mugheer Background Jobs (queues + schedules)

**What this does:** the standalone Node process that runs everything the API shouldn't block on. It consumes BullMQ queues (Redis) and fires cron schedules: uptime probes for every monitored product, AI anomaly scans, weekly health reports, dunning retries for failed subscription payments, and daily metric downsampling + retention cleanup. It authenticates to `backend-core` with the shared `INTERNAL_SERVICE_TOKEN` (never with a user JWT).

## Files in this service

| Path | What it is |
|---|---|
| `src/index.ts` | Entrypoint: queue definitions, all Workers, all cron schedules, graceful shutdown |
| `test/schedules.spec.ts` | Unit tests for report aggregation math |
| `prisma/.gitkeep` | Placeholder — the build copies `backend-core/prisma/schema.prisma` here to generate the client (the CD pipelines do this automatically) |
| `Dockerfile` | Multi-stage, non-root runtime |

## Jobs and schedules

| Queue / schedule | Cadence | What it does |
|---|---|---|
| `uptime-checks` | cron `* * * * *` (every minute) | `GET {productionUrl}{healthCheckPath}` per monitored product → ingests `uptime` + `response_time_ms` metrics; failures raise a CRITICAL alert via the internal API |
| `anomaly-scans` | cron `*/15 * * * *` | Pulls the last 3h of metrics per product → `ai-anomaly` `/detect` → anomalies become alerts with `aiConfidence` |
| `runbook-jobs` | on demand | Executes automation runbooks through `POST /automation/internal/runbooks/:id/execute` |
| `weekly-reports` | cron `0 8 * * 1` (Mon 08:00 UTC) | Aggregates 7-day metric stats → stores an AI insight → notifies the org |
| `dunning` | cron `0 9 * * *` | Retries failed subscriptions (max 4 attempts) + emails customers |
| `metric-downsample` | cron `0 2 * * *` | Rolls raw metrics into daily aggregates; deletes raw points older than 30 days (retention policy) |

## Quick start

```bash
# 1. Install (Prisma client comes from the backend schema)
cp ../backend-core/prisma/schema.prisma prisma/schema.prisma
npm install
npx prisma generate

# 2. Start Postgres/Redis/backend-core if not already running (repo root)
cd .. && docker compose up -d postgres redis && cd worker

# 3. Run it
npm run start:dev          # ts-node, watch
npm run build && npm start # production
```

Required env: `REDIS_URL`, `DATABASE_URL`, `INTERNAL_SERVICE_TOKEN` (must match backend-core), `BACKEND_INTERNAL_URL` (default `http://localhost:3000`), `AI_ANOMALY_URL` (default `http://localhost:8101`). In docker-compose all of these are pre-wired.

```bash
npm test   # unit tests
```

## How to work on it

### Adding a new scheduled job — step by step
1. Define a queue in the `queues` object: `new Queue('my-jobs', { connection })`.
2. Create a `new Worker('my-jobs', async (job) => {...}, { connection, concurrency })` next to the others.
3. Register the cron with `cron.schedule('0 3 * * *', async () => { await queues.myJobs.add('task', payload) })` — keep schedules together at the bottom of `src/index.ts`.
4. Call the backend through the `core()` helper (it already sends the internal service token) — do **not** open direct DB-write paths for business logic if an API endpoint exists; DB access here is for reads and metric rollups.
5. Add a unit test in `test/` for any aggregation/decision math, and run `npm test`.

### Operational notes
- The worker is stateless and horizontally scalable; BullMQ handles job distribution.
- Shutdown is graceful: SIGTERM drains queues, closes Redis and Prisma (this matters in Kubernetes rollouts).
- If you change anything touching metrics retention, keep the 30-day full-resolution / 1-year daily-rollup contract documented in `docs/SECURITY.md`.
