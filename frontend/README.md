# frontend — Mugheer Dashboard SPA (Tier 1: Presentation Layer)

**What this does:** the React 18 + TypeScript single-page app served to browsers. It contains **two shells over the same components**: the client-facing dashboard (request products, watch the build pipeline, review designs, see live monitoring, pay invoices, open tickets) and the internal staff console (KPIs, alert triage, runbooks, billing management, audit log). It talks **only** to `backend-core` over REST + WebSocket — it never touches the database or infrastructure APIs.

## Files / folders in this service

| Path | What it is |
|---|---|
| `index.html` | SPA entry document |
| `src/main.tsx` | Bootstrap: React Query + Router providers |
| `src/app/App.tsx` | Role-aware routing: no session → landing/login/signup; client role → `ClientShell`; internal roles → `InternalShell` |
| `src/app/ClientShell.tsx` | Client sidebar + notification bell + logout |
| `src/app/InternalShell.tsx` | Dark staff console sidebar |
| `src/lib/api.ts` | Fetch wrapper: auto-attaches JWT, **auto-refreshes once on 401** then retries, throws typed `ApiError` |
| `src/lib/auth.store.ts` | Zustand session store (access token in memory only — refresh token stays in HttpOnly cookie) + `isInternal()` role helper |
| `src/lib/ws.ts` | `useLiveProduct()` WebSocket hook — subscribes to live metrics/alerts with exponential-backoff reconnect |
| `src/components/ui/` | Design system: `Button`, `Card`, `Badge`, `Input/Field/Select/Textarea`, `Stat`, **`AiTag`** (mandatory label for AI-generated content) |
| `src/features/landing/` | Marketing page with the 8 service lines |
| `src/features/auth/` | `Login` (email/password + TOTP + OAuth buttons), `Signup` (2-step onboarding with first product request) |
| `src/features/projects/` | `ClientDashboard`, `ProductDetail` (pipeline timeline, tasks, design review, deployments, comments), `NewProductRequest` (with AI-drafted brief preview) |
| `src/features/monitoring/` | Live dashboard: Recharts panels, uptime stat, AI-insights banner, realtime alert feed |
| `src/features/automation/` | Runbook list/creation — trigger → condition → action with **no YAML** |
| `src/features/billing/` | Invoices + pay-now, plans, subscriptions (client view) |
| `src/features/tickets/` | Ticket list/thread; staff see the **AI draft reply** with "Approve & send" |
| `src/features/admin/` | `AdminDashboard` (KPIs + alert triage), `AdminProducts` (all clients, status pipeline, task assignment), `AdminBilling` (invoice creation, refunds), `AdminAudit` (actor-typed audit viewer) |
| `tests/ui.spec.tsx` | Component + auth-helper unit tests (Vitest + Testing Library) |
| `Dockerfile` | Multi-stage: Vite build → runtime preview server |
| `tailwind.config.js` | Brand design tokens (indigo primary, teal accent) |

## Quick start

```bash
npm install
npm run dev          # → http://localhost:5173 (proxies /api → localhost:3000)
```

The dev server expects `backend-core` running on :3000 (see `vite.config.ts` proxy). Log in with a seeded account, e.g. `owner@acme.test / ClientPass123!` (client view) or `admin@mugheer.com / AdminPass123!` (internal view).

```bash
npm test             # unit tests (Vitest + Testing Library, jsdom)
npm run build        # typecheck (tsc --noEmit) + production build → dist/
npm run preview      # serve the production build locally
```

Build-time env (see `../.env.example`): `VITE_API_URL`, `VITE_WS_URL`.

## How to work on it

### Adding a feature — step by step
1. Create `src/features/<name>/` with the page component(s).
2. Register the route in `src/app/App.tsx` inside the correct shell, and add nav in the matching shell's `NAV` array.
3. Fetch server data with **React Query** (`useQuery`/`useMutation` + `get/post/patch/del` from `lib/api`) — never `useEffect`+`fetch`. UI-only state goes in Zustand.
4. Reuse the UI kit; add new primitives to `src/components/ui/` and export them from `index.ts`.
5. Validate forms with the same rules the backend enforces (e.g. password ≥ 12 chars).
6. Anything AI-generated shown to a user **must** be wrapped with `<AiTag />`.
7. Add/extend tests in `tests/` and run `npm test` + `npm run build` before the PR.

### Conventions
- Access tokens live in memory only — after a page reload `loadSession()` silently rotates the refresh cookie.
- All interactive elements need labels (WCAG 2.1 AA): every input has a `Field` label, charts have `aria-label`s.
- Keep pages tenant-agnostic: the backend scopes data; the frontend just renders 403s gracefully.
