# Mugheer — API Reference (v1 summary)

Base URL: `/api/v1`. All responses use the error envelope `{ "error": { "code", "message", "details" } }` on failure.
Auth: `Authorization: Bearer <accessToken>` (access JWT, 15 min) + HttpOnly refresh cookie for renewal.

## Auth — `/auth`
| Method | Path | Description |
|---|---|---|
| POST | /auth/signup | Register (name, email, password ≥12 chars, orgName?) — breach-checked |
| POST | /auth/login | Login (email, password, totp?) — returns access token, sets refresh cookie |
| POST | /auth/refresh | Rotate refresh token (reuse detection revokes family) |
| POST | /auth/logout | Revoke refresh token |
| GET | /auth/me | Current user |
| POST | /auth/2fa/setup | Generate TOTP secret + QR |
| POST | /auth/2fa/confirm | Enable TOTP |
| POST | /auth/2fa/disable | Disable TOTP |
| POST | /auth/api-keys | Create machine API key (raw key shown once) |
| GET | /auth/google, /auth/github (+ /callback) | OAuth2 flows |

## Projects — `/projects`
| Method | Path | Roles |
|---|---|---|
| GET | /projects | all (tenant-scoped) |
| GET | /projects/:id | all (tenant-scoped) |
| POST | /projects | SUPER_ADMIN, ADMIN, CLIENT_OWNER |
| PATCH | /projects/:id/status | SUPER_ADMIN, ADMIN, ENGINEER |
| POST | /projects/:id/quote | SUPER_ADMIN, ADMIN |
| POST | /projects/quotes/:quoteId/approve | + CLIENT_OWNER |
| POST | /projects/:id/designs | SUPER_ADMIN, ADMIN, DESIGNER, ENGINEER |
| POST | /projects/designs/:artifactId/review | SUPER_ADMIN, ADMIN, CLIENT_OWNER |
| POST | /projects/:id/deployments | SUPER_ADMIN, ADMIN, ENGINEER |

## Monitoring — `/monitoring`
| Method | Path | Notes |
|---|---|---|
| GET | /monitoring/products/:id/dashboard | Panels, uptime 30d, AI insight, open alerts |
| GET | /monitoring/products/:id/series?metric=&from=&to= | Cursor-safe series |
| GET | /monitoring/alerts?status=&productId= | Tenant-scoped |
| POST | /monitoring/alerts/:id/acknowledge | staff |
| POST | /monitoring/alerts/:id/resolve | staff |
| POST | /monitoring/ingest | client API-key ingestion |
| POST | /monitoring/internal/ingest-batch | internal token (worker) |

## Automation — `/automation`
CRUD under `/automation/runbooks` (staff roles) + `POST /automation/runbooks/:id/execute`.

## Billing — `/billing`
Plans, invoices (create/pay/refund), subscriptions (create/cancel). Stripe webhooks at `POST /webhooks/stripe` (signature-verified, idempotent via external event id).

## Tickets — `/tickets`
CRUD + `POST /tickets/:id/reply` (accepts `isAiDraft` for human-approved AI replies) + `POST /tickets/:id/status`.

## AI — `/ai`
| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | /ai/scope | staff + CLIENT_OWNER | Returns AI-drafted brief (`aiGenerated: true`) |
| POST | /ai/code-assist | staff only | Internal RAG assistant |
| GET | /ai/action-logs | SUPER_ADMIN, ADMIN | Governance log |

## Misc
- `GET /health`, `GET /health/ready` — liveness/readiness
- `GET /notifications`, `PATCH /notifications/:id/read`
- `GET /audit` — audit log (AI Agent actions attributed distinctly)
- `GET /admin/stats`, `GET|POST /admin/pricing`
