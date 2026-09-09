# Mugheer — Security

## Controls summary

| Area | Control |
|---|---|
| Passwords | Argon-class hashing (bcrypt cost 12), ≥12 chars, HaveIBeenPwned k-anonymity breach check |
| Sessions | 15-min access JWT + rotating refresh token (7–30d) in HttpOnly, Secure, SameSite cookie; reuse detection revokes the token family |
| 2FA | TOTP mandatory for internal staff, optional for clients |
| OAuth | Google + GitHub; SAML/OIDC stub ready for enterprise SSO |
| RBAC | Deny-by-default server-side guard (`RolesGuard`) on every route; negative tests required (Section 25) |
| Tenant isolation | All client-scoped queries filter by `organization_id` |
| Transport | HTTPS-only, HSTS, TLS at ALB/ingress (cert-manager) |
| Headers | Helmet (CSP, nosniff, frameguard, referrer-policy) |
| CSRF | SameSite cookies + CORS allowlist; state-changing webhooks signature-verified |
| Injection | Prisma parameterized queries; no raw string SQL in app paths |
| Secrets | Never in git; AWS Secrets Manager via external-secrets operator; `.env.example` only in repo |
| Webhooks | Stripe timestamp+HMAC verification, GitHub HMAC-SHA256, idempotent by external event id |
| Audit | Append-only `audit_logs`; AI Agent actions attributed distinctly (`actorType=AI_AGENT`) |
| AI governance | Every AI output logged (model, input hash, confidence, approval status); client-visible AI content always labeled "AI-suggested"; monthly spend budget enforced |
| Automation safety | Runbooks bounded by `maxRetries`; kill-switch (`enabled=false`); automation never auto-escalates past retry limits without a human |
| Dependencies | Trivy scans in CI on every PR; Dependabot recommended at repo level |

## Data protection
- RDS storage encrypted, backups retained 14 days, deletion protection in production
- S3 versioning + SSE + lifecycle policies
- Metrics: full resolution 30 days → daily rollups 1 year
- Audit logs: ≥ 1 year

## Reporting a vulnerability
Email **security@mugheer.com**. We aim to acknowledge within 48 hours. Please do not open public issues for security reports. We practice coordinated disclosure and will credit reporters who wish to be named.
