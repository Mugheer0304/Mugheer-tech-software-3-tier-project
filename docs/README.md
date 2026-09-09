# docs — Engineering Documentation

**What this is:** the four reference documents that keep the platform operable and auditable. Start here before changing architecture, adding endpoints, going on-call, or handling anything security-related.

## Files

| File | What it covers | Read it when… |
|---|---|---|
| `ARCHITECTURE.md` | Three-tier diagram (Mermaid), tier rules and where each is enforced, service map with ports/responsibilities, key flows (metric ingestion, ticket triage, runbook execution) | designing a feature, onboarding, deciding where new code belongs |
| `API.md` | Full endpoint reference for `/api/v1`: auth (incl. 2FA + API keys), projects/quotes/designs, monitoring, automation, billing, tickets, AI, webhooks, admin — with role requirements and the error envelope | wiring a frontend call, integrating a client's CI, writing integration tests |
| `RUNBOOK.md` | Deploy pipelines (what triggers what), manual rollback commands, DB restore procedure (RTO ≤ 4h / RPO ≤ 15min), incident playbooks per scenario, escalation chain, how to add alert rules | you are on call, a deploy went sideways, an alarm fired |
| `SECURITY.md` | Controls matrix (sessions, RBAC, tenant isolation, webhooks, AI governance, automation safety), data-retention policy, vulnerability disclosure process | handling user data, reviewing a security-sensitive PR, reporting/responding to a vuln |

## How these stay true

The rule this repo follows: **a change isn't done until these docs match reality** (root README, "Definition of Done").

- New endpoint? → add a row to `API.md` (and it's auto-documented in Swagger at `/api/docs` too).
- New service or tier change? → update `ARCHITECTURE.md` diagram + service map **and** `k8s/` + NetworkPolicies.
- New alert/severity/escalation? → `RUNBOOK.md` monitoring section.
- New auth surface, secret, or data flow? → `SECURITY.md` controls matrix.

## Working on the docs

- Diagrams are Mermaid fenced blocks — GitHub renders them; keep nodes/terms identical to code names (`backend-core`, not "the API").
- Keep commands copy-pasteable: every block starts at a predictable cwd (`repo root` or the stated directory) and uses real env-var names.
- When you fix an incident, add its playbook to `RUNBOOK.md` — postmortems that don't become runbooks get repeated.
