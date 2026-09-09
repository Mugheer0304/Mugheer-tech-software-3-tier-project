"""Mugheer AI — support ticket triage.

Classifies tickets (bug/feature/billing/urgent/general), assigns priority,
and drafts a first-response reply. Drafts are ALWAYS returned for human
approval — the platform never auto-sends without a human click (Section 12.3),
except for clients who explicitly opt into low-risk automation.
"""
from __future__ import annotations

import os
import re
from datetime import datetime, timezone

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Mugheer AI — Support Triage", version="1.0.0")

MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")
OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

CATEGORIES = ["bug", "feature", "billing", "urgent", "general"]


class TriageRequest(BaseModel):
    subject: str
    body: str


class TriageResponse(BaseModel):
    category: str
    priority: str
    confidence: float
    draftReply: str
    model: str = MODEL


KEYWORD_RULES: list[tuple[str, list[str]]] = [
    ("urgent", ["down", "outage", "production", "asap", "emergency", "critical", "data loss", "breach"]),
    ("bug", ["error", "bug", "broken", "crash", "fails", "failing", "exception", "stack trace", "500", "stuck", "stale", "incorrect"]),
    ("billing", ["invoice", "payment", "charge", "refund", "card", "subscription", "billing", "price", "receipt"]),
    ("feature", ["feature", "request", "add", "improve", "enhancement", "would be nice", "integration with", "export"]),
]


def heuristic_classify(subject: str, body: str) -> tuple[str, str, float]:
    text = f"{subject} {body}".lower()
    scores: dict[str, int] = {cat: 0 for cat in CATEGORIES}
    for cat, keywords in KEYWORD_RULES:
        for kw in keywords:
            if kw in text:
                scores[cat] += 1
    best = max(scores, key=lambda c: scores[c])
    if scores[best] == 0:
        return "general", "normal", 0.4
    confidence = min(0.92, 0.5 + 0.12 * scores[best])
    priority = "high" if best == "urgent" else ("normal" if best in ("bug", "billing") else "low")
    return best, priority, confidence


def heuristic_reply(category: str, subject: str) -> str:
    templates = {
        "urgent": (
            "Thanks for flagging this — we're treating it as urgent. "
            "Our on-call engineer has been paged and is investigating now. "
            "We'll post updates here every 30 minutes until service is restored."
        ),
        "bug": (
            "Thanks for the report — we've reproduced the issue and it's now with our engineering team. "
            "Could you share the approximate time it occurred and any error text you saw? "
            "That will help us trace it in the logs."
        ),
        "billing": (
            "Thanks for reaching out about billing. We're reviewing your account now. "
            "You can view and download all invoices from Dashboard → Billing. "
            "If a charge looks wrong, we'll correct it and issue any refund within 5–10 business days."
        ),
        "feature": (
            "Great suggestion — thank you. We've logged this as a feature request and shared it with the product team. "
            "We'll let you know if it's picked up for an upcoming sprint."
        ),
        "general": (
            "Thanks for contacting Mugheer support. We're looking into your question and will follow up "
            "with a full answer shortly. In the meantime, our docs cover most common workflows."
        ),
    }
    return templates.get(category, templates["general"])


async def llm_classify(subject: str, body: str) -> dict | None:
    if not OPENAI_KEY:
        return None
    try:
        import httpx

        prompt = (
            "You triage support tickets for a software house platform. Respond with JSON only: "
            '{"category": one of bug|feature|billing|urgent|general, "priority": one of low|normal|high, '
            '"confidence": 0..1, "draftReply": "a concise empathetic first response"}.\n\n'
            f"Subject: {subject}\nBody: {body[:2000]}"
        )
        async with httpx.AsyncClient(timeout=12) as client:
            res = await client.post(
                f"{OPENAI_BASE}/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_KEY}"},
                json={
                    "model": MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                },
            )
            if res.status_code != 200:
                return None
            import json

            return json.loads(res.json()["choices"][0]["message"]["content"])
    except Exception:
        return None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-triage", "time": datetime.now(timezone.utc).isoformat()}


@app.post("/triage", response_model=TriageResponse)
async def triage(req: TriageRequest) -> TriageResponse:
    llm = await llm_classify(req.subject, req.body)
    if llm and llm.get("category") in CATEGORIES:
        return TriageResponse(
            category=llm["category"],
            priority=llm.get("priority", "normal"),
            confidence=float(llm.get("confidence", 0.8)),
            draftReply=str(llm.get("draftReply", ""))[:2000],
        )
    category, priority, confidence = heuristic_classify(req.subject, req.body)
    return TriageResponse(
        category=category,
        priority=priority,
        confidence=confidence,
        draftReply=heuristic_reply(category, req.subject),
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8102)
