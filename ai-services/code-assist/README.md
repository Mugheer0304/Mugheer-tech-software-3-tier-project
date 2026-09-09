# ai-codeassist — Internal Code Assistant (staff only)

**What this does:** a retrieval-augmented assistant for Mugheer engineers. The caller (`backend-core` `AiService.codeAssist`, reachable only by SUPER_ADMIN/ADMIN/ENGINEER roles) sends the engineer's question plus project context — concatenated file snippets separated by `=== path/to/file ===` markers. This service splits the context, ranks snippets by token overlap with the question, and grounds the answer in the top matches (LLM if configured, otherwise a heuristic excerpt answer). It **suggests only** — nothing is ever auto-applied to a codebase.

## Files in this service

| Path | What it is |
|---|---|
| `app/main.py` | FastAPI app: `/assist`, `/health`, snippet splitter, TF-IDF-style retriever, context-hash helper |
| `tests/test_assist.py` | Evaluation suite: file splitting, relevance ranking, empty-context behavior, no-match handling |
| `requirements.txt` / `Dockerfile` | Pinned deps / Python 3.12-slim non-root image |

## Quick start

```bash
# Local
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8104

# Or from the repo root
docker compose up --build ai-codeassist    # → http://localhost:8104
```

### Try it

```bash
curl -X POST http://localhost:8104/assist -H "Content-Type: application/json" -d '{
  "context": "=== src/auth/service.ts ===\nexport async function loginUser() { ... }\n\n=== src/billing/invoice.ts ===\nexport async function createInvoice() { ... }",
  "question": "how does user login work with bcrypt"
}'
# → {"suggestion":"Based on the indexed project context...","sources":["src/auth/service.ts"],"aiGenerated":true}
```

Interactive docs: http://localhost:8104/docs · Health: `GET /health`.

**Env (all optional):** `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `AI_MODEL`. Without a key the retrieval still works — the answer is built from the top-ranked excerpts with a "verify before applying" warning.

## Evaluation tests (CI gate)

```bash
pip install -r requirements.txt && pytest tests -q
```

Asserts the `=== path ===` splitting finds all files, the auth question ranks the auth snippet first, irrelevant questions return no snippets (no hallucinated grounding), and empty-context answers say so explicitly.

## How to work on it

1. The retrieval is deliberately simple (token overlap). Upgrade path: replace `_retrieve` with pgvector similarity against indexed project files, keeping the same signature — call it out in the PR and keep tests passing with richer fixtures.
2. The caller enforces RBAC; if you ever expose this beyond internal roles you must add auth **in this service too** (it currently trusts the network boundary).
3. Keep answers suggestion-only; any "apply changes" ambition needs a full human-approval flow like the triage draft system.
