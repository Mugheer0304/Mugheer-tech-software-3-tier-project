"""Mugheer AI — code assist (internal-only).

Retrieval-augmented: matches the engineer's question against indexed project
context (file snippets keyed by simple TF-IDF similarity — swap in pgvector
retrieval in production) and generates a suggestion grounded in that context.
Never auto-applies changes; returns suggestions only.
"""
from __future__ import annotations

import hashlib
import os
import re
from datetime import datetime, timezone

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Mugheer AI — Code Assist (internal)", version="1.0.0")

MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")
OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")


class AssistRequest(BaseModel):
    context: str = Field(default="", max_length=60000)  # concatenated code snippets
    question: str = Field(min_length=3, max_length=2000)


class AssistResponse(BaseModel):
    suggestion: str
    sources: list[str] = []
    aiGenerated: bool = True
    model: str = MODEL


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{2,}", text.lower()))


def _split_snippets(context: str) -> list[str]:
    # snippets separated by our convention: lines like "=== path/to/file.ts ==="
    parts = re.split(r"^===\s*(.+?)\s*===$", context, flags=re.MULTILINE)
    snippets: list[str] = []
    if len(parts) >= 3:
        for i in range(1, len(parts), 2):
            path, body = parts[i], parts[i + 1] if i + 1 < len(parts) else ""
            snippets.append(f"{path}\n{body[:3000]}")
    else:
        if context.strip():
            snippets.append(context[:3000])
    return snippets


def _retrieve(question: str, context: str, k: int = 3) -> list[str]:
    snippets = _split_snippets(context)
    if not snippets:
        return []
    q_tokens = _tokenize(question)
    scored: list[tuple[float, str]] = []
    for snip in snippets:
        s_tokens = _tokenize(snip)
        if not s_tokens:
            continue
        overlap = len(q_tokens & s_tokens) / max(1, len(q_tokens))
        scored.append((overlap, snip))
    scored.sort(key=lambda pair: -pair[0])
    return [s for _, s in scored[:k] if _ > 0]


def context_hash(context: str, question: str) -> str:
    return hashlib.sha256(f"{context[:5000]}::{question}".encode()).hexdigest()


async def llm_answer(question: str, retrieved: list[str]) -> str | None:
    if not OPENAI_KEY:
        return None
    try:
        import httpx

        grounded = "\n\n---\n\n".join(retrieved)[:12000]
        prompt = (
            "You are an expert engineer assisting a colleague. Answer using ONLY the "
            "provided project context when relevant; say clearly when the context is "
            "insufficient. Be concise and include a code snippet when useful.\n\n"
            f"Project context:\n{grounded}\n\nQuestion: {question}"
        )
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                f"{OPENAI_BASE}/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_KEY}"},
                json={
                    "model": MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                },
            )
            if res.status_code != 200:
                return None
            return res.json()["choices"][0]["message"]["content"]
    except Exception:
        return None


def heuristic_answer(question: str, retrieved: list[str]) -> str:
    lines = question.lower().split()
    topic = next((w for w in lines if len(w) > 4), "this")
    base = (
        f"Based on the indexed project context, here's what's relevant to '{topic}':\n\n"
        if retrieved
        else "No matching project context was indexed for this question.\n\n"
    )
    if retrieved:
        base += "\n\n".join(f"```\n{r[:600]}\n```" for r in retrieved)
    base += "\n\n(Heuristic retrieval only — LLM suggestion unavailable. Verify before applying.)"
    return base


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-codeassist", "time": datetime.now(timezone.utc).isoformat()}


@app.post("/assist", response_model=AssistResponse)
async def assist(req: AssistRequest) -> AssistResponse:
    retrieved = _retrieve(req.question, req.context)
    answer = await llm_answer(req.question, retrieved)
    if answer is None:
        answer = heuristic_answer(req.question, retrieved)
    sources = [snip.split("\n", 1)[0] for snip in retrieved]
    return AssistResponse(suggestion=answer[:4000], sources=sources)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8104)
