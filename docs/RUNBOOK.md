# Mugheer — Operations Runbook

## Deploy

### Staging (automatic on merge to `develop`)
1. GitHub Actions `CD — Staging` builds images, plans Terraform, applies `k8s/overlays/staging`, runs smoke tests.
2. If smoke tests fail, the job fails — investigate with `kubectl logs -n mugheer-staging deploy/backend-core`.

### Production (tagged releases `v*`, manual approval in GitHub environment)
1. `CD — Production` runs Terraform apply, applies `k8s/overlays/production`, sets image tags.
2. Health checks run 12 attempts × 10s against `https://api.mugheer.com`.
3. On failure the workflow **automatically rolls back** `backend-core` and `frontend` via `kubectl rollout undo`.

### Manual rollback
```bash
aws eks update-kubeconfig --name mugheer-production
kubectl rollout history deployment/backend-core -n mugheer-production
kubectl rollout undo deployment/backend-core -n mugheer-production [--to-revision=N]
```

### Database restore (RTO ≤ 4h / RPO ≤ 15min)
1. Pick latest snapshot: `aws rds describe-db-snapshots --db-instance-identifier mugheer-production`
2. Restore to a new instance, verify, then repoint the app (or use RDS point-in-time recovery for RPO ≤ 5 min).
3. Nightly logical dumps additionally land in `s3://mugheer-production-backups/db/` (see `scripts/backup-db.sh`).

## Incidents

| Scenario | First actions |
|---|---|
| Platform down (ALB 5xx) | Check `kubectl get pods -n mugheer-production`, Prometheus `BackendCoreDown`, roll back last deploy |
| Client product down | Uptime probe auto-opens CRITICAL alert → check the client's runbooks → execute RESTART_SERVICE (bounded) |
| DB CPU saturation | Check pg_stat_statements for slow queries, scale RDS instance class, enable read replica |
| AI service down | Platform degrades to heuristics (by design). Restart the AI deployment; no data loss |
| Runbook runaway loop | Kill-switch: `PATCH /automation/runbooks/:id { enabled: false }`; bounded retries already cap damage |

## Escalation
1. Critical → PagerDuty (auto via Alertmanager) + `#mugheer-incidents`
2. On-call confirms within 15 min; incident commander assigned if client-impacting
3. Affected clients notified through in-app notifications + email (templates in `NotificationsService`)

## Monitoring
- Dashboards: Grafana → "Mugheer" folder (`/monitoring/grafana/dashboards`)
- Add an alert: append to `monitoring/prometheus/alerts.yml`, then route in `monitoring/alertmanager/alertmanager.yml`
- Log aggregation: structured JSON logs with `correlationId` on every request (see `LoggingInterceptor`)
