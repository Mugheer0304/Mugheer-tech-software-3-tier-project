# monitoring — Prometheus + Alertmanager + Grafana

**What this does:** the observability stack for the platform itself and (as a template) for client products. Prometheus scrapes the services, evaluates alert rules, and routes firing alerts through Alertmanager (critical → PagerDuty + `#mugheer-incidents`, warning → `#mugheer-alerts`); Grafana renders dashboards from the same data. Client-product metrics flow into PostgreSQL via the ingestion API and get their own in-app dashboards — this stack covers the infrastructure layer and provides the signed-embed target for client Grafana views.

## Files

| Path | What it is |
|---|---|
| `prometheus/prometheus.yml` | Scrape config: `backend-core:3000`, AI services, self; wires Alertmanager + `alerts.yml` |
| `prometheus/alerts.yml` | Alert rules: `BackendCoreDown` (critical, 2m), `HighErrorRate` (warning, 5m, 5xx > 5%), `AiServiceDown` (warning — the platform degrades gracefully but you should know) |
| `alertmanager/alertmanager.yml` | Routing tree + receivers; webhook/PagerDuty credentials come from `/etc/alertmanager/secrets` (never committed) |
| `grafana/provisioning/datasources/datasource.yml` | Auto-configures the Prometheus datasource |
| `grafana/provisioning/dashboards/dashboards.yml` | Loads every JSON in `grafana/dashboards/` into the "Mugheer" folder |
| `grafana/dashboards/product-overview.json` | Per-product overview: response time, error rate, uptime, CPU (product selected by variable) |

## Quick start

```bash
# From the repo root — included in the compose stack
docker compose up -d prometheus grafana alertmanager
```

| UI | URL | Login |
|---|---|---|
| Prometheus | http://localhost:9090 | — (targets: Status → Targets) |
| Grafana | http://localhost:3001 | admin / admin |
| Alertmanager | http://localhost:9093 | — |

Verify it works: in Prometheus run `up` — all scrape targets should be `1`. In Grafana open **Dashboards → Mugheer → Product Overview**.

## How to work on it

### Add an alert rule — step by step
1. Append to `prometheus/prometheus/alerts.yml`:
   ```yaml
   - alert: MyNewAlert
     expr: <promql>            # e.g. cpu_percent > 90
     for: 5m                   # must hold this long before firing
     labels: { severity: critical | warning }
     annotations:
       summary: "one line"
       runbook: "link to docs/RUNBOOK.md section"
   ```
2. Decide routing: the severity label picks the Alertmanager route. Add a route/receiver in `alertmanager/alertmanager.yml` only if it's genuinely new behavior.
3. Secrets (Slack webhook, PagerDuty key) go in `/etc/alertmanager/secrets/` files referenced by `*_file:` — **never inline**.
4. `docker compose restart prometheus alertmanager` (or let config-reload pick it up) and check http://localhost:9090/alerts — new rule should appear as `inactive` (green), not `pending`/`firing` immediately.
5. Test the expr in the Prometheus query pane first; a typo'd expr fails silently at load — watch the `/rules` page for errors.

### Add a Grafana dashboard
1. Build it in the UI, then **JSON model → save the file** to `grafana/dashboards/<name>.json` (dashboards-as-code — the provisioner reloads them).
2. Datasource must be the provisioned `Prometheus`; avoid dashboard-level IDs that clash with `product-overview.json` (`uid` must be unique).

### Adding metrics from a service
Expose a Prometheus-format endpoint (or reuse the structured logs) and add a scrape job in `prometheus.yml`. For client-product business metrics, prefer the platform ingestion API (`POST /api/v1/monitoring/ingest`) — they then get retention policy and AI anomaly detection for free.
