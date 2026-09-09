# ai-triage — Support Ticket Triage Service

**What this does:** when a client submits a support ticket, this service classifies it (`bug` / `feature` / `billing` / `urgent` / `general`), assigns a priority (`low`/`normal`/`high`), and drafts an empathetic first response. **The draft is never auto-sent** — it lands in the platform as `isAiDraft=true` and a human must click "Approve & send"; that approval is recorded in the AI governance log. An optional LLM (any OpenAI-compatible API) refines classification; a keyword heuristic guarantees the service always answers.

## Files in this service

| Path | What it is |
|---|---|
| `app/main.py` | FastAPI app: `/triage`, `/health`, keyword rules, LLM call, heuristic fallback |
| `tests/test_triage.py` | Evaluation suite CI gates on (≥80% classification accuracy on the fixed eval set) |
| `requirements.txt` / `Dockerfile` | Pinned deps / Python 3.12-slim non-root image |

## Quick start

```bash
# Local
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8102

# Or from the repo root
docker compose up --build ai-triage        # → http://localhost:8102
```

### Try it

```bash
curl -X POST http://localhost:8102/triage -H "Content-Type: application/json" -d '{
  "subject": "Site is completely down",
  "body": "Production is returning 500 for all users since 10am."
}'
# → {"category":"urgent","priority":"high","confidence":0.7,"draftReply":"Thanks for flagging — ..."}
```

Interactive docs: http://localhost:8102/docs · Health: `GET /health`.

**Env (all optional):** `OPENAI_API_KEY` + `OPENAI_BASE_URL` + `AI_MODEL` enable LLM classification with JSON-mode responses; without them the keyword heuristic runs (urgent keywords outrank bug/billing/feature; unknown → `general` at 0.4 confidence).

## Evaluation tests (CI gate)

```bash
pip install -r requirements.txt && pytest tests -q
```

The fixed evaluation set (5 labeled tickets) must classify at **≥80% accuracy**; urgent tickets must map to high priority; every draft reply must be non-trivial and empathetic. Spec Section 21: prompts/rules may not ship if the score drops.

## How to work on it

1. Adjust classification by editing `KEYWORD_RULES` / `heuristic_classify` or the LLM prompt — always keep the response schema `{category, priority, confidence, draftReply}` intact (backend stores these columns directly).
2. Re-run the evaluation suite; add new labeled examples to `EVAL_SET` when you see misclassifications in production.
3. Never auto-send: the contract is that everything this service produces is a **draft**. The platform's "Approve & send" flow depends on it.
