# ai-scoping — Project Scoping Assistant

**What this does:** turns a client's free-text product request into a structured brief: suggested service line (from the 8 lines Mugheer sells), feature list extracted from the text, complexity (`simple`/`medium`/`complex`), and a rough USD estimate (base rate × complexity multiplier: 0.7 / 1.0 / 1.8). The brief is **always marked AI-generated** — a human PM reviews it in the "New product request" page before any quote is sent. With `OPENAI_API_KEY` set, an LLM produces sharper briefs; a keyword heuristic guarantees an answer without it.

## Files in this service

| Path | What it is |
|---|---|
| `app/main.py` | FastAPI app: `/scope`, `/health`, service-line keyword table, complexity signals, estimate math |
| `tests/test_scope.py` | Evaluation suite: mobile→mobile, "simple landing page"→simple+web, enterprise signals→complex, always `aiGenerated: true` |
| `requirements.txt` / `Dockerfile` | Pinned deps / Python 3.12-slim non-root image |

## Quick start

```bash
# Local
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8103

# Or from the repo root
docker compose up --build ai-scoping       # → http://localhost:8103
```

### Try it

```bash
curl -X POST http://localhost:8103/scope -H "Content-Type: application/json" -d '{
  "description": "We need an iOS and Android app for our field technicians with offline mode."
}'
# → {"serviceLine":"MOBILE_APP_DEVELOPMENT","complexity":"medium","roughEstimateUsd":20000.0,...}
```

Interactive docs: http://localhost:8103/docs · Health: `GET /health`.

**Env (all optional):** `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `AI_MODEL`. The LLM must return a `serviceLine` from the known list or the response is discarded and the heuristic runs instead.

## Evaluation tests (CI gate)

```bash
pip install -r requirements.txt && pytest tests -q
```

Asserts service-line mapping (mobile keywords → mobile), complexity detection (simple/complex signals), sane estimates (> 0, complex multiplier applied), and that **every brief is marked AI-generated with a "PM must review" note**.

## How to work on it

1. Update `BASE_RATES` when Mugheer pricing changes — keep it consistent with `backend-core/prisma/seed.ts` plan prices and `monitoring` of pricing in the admin console.
2. Extend `KEYWORD_SERVICE` / `COMPLEXITY_SIGNALS` as you learn from real requests; add a regression test per fix.
3. The response contract (`title, serviceLine, features[], complexity, roughEstimateUsd, aiGenerated`) is consumed by `NewProductRequest.tsx` — change both sides together.
