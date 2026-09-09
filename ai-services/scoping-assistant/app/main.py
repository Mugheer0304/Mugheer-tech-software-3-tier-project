"""Mugheer AI — project scoping assistant.

Turns a client's plain-language request into a structured brief:
service line, feature list, complexity, rough estimate. Output is always
marked aiGenerated — a human PM refines it into the actual quote.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Mugheer AI — Scoping Assistant", version="1.0.0")

MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")
OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

SERVICE_LINES = [
    "WEB_APP_DEVELOPMENT",
    "PRODUCT_DESIGN",
    "BACKEND_API_DEVELOPMENT",
    "MOBILE_APP_DEVELOPMENT",
    "MANAGED_MONITORING",
    "AUTOMATION_ENGINEERING",
    "AI_INTEGRATION",
    "MAINTENANCE_RETAINER",
]

BASE_RATES = {
    "WEB_APP_DEVELOPMENT": 12000,
    "PRODUCT_DESIGN": 6000,
    "BACKEND_API_DEVELOPMENT": 15000,
    "MOBILE_APP_DEVELOPMENT": 20000,
    "MANAGED_MONITORING": 499,
    "AUTOMATION_ENGINEERING": 899,
    "AI_INTEGRATION": 18000,
    "MAINTENANCE_RETAINER": 1999,
}

COMPLEXITY_MULTIPLIER = {"simple": 0.7, "medium": 1.0, "complex": 1.8}

KEYWORD_SERVICE: list[tuple[str, list[str]]] = [
    ("MOBILE_APP_DEVELOPMENT", ["mobile", "ios", "android", "app store", "flutter", "react native"]),
    ("PRODUCT_DESIGN", ["design", "ux", "ui", "wireframe", "prototype", "figma", "branding"]),
    ("BACKEND_API_DEVELOPMENT", ["api", "backend", "integration", "pipeline", "database", "microservice"]),
    ("AI_INTEGRATION", ["ai", "chatbot", "llm", "recommendation", "ml", "machine learning", "anomaly"]),
    ("AUTOMATION_ENGINEERING", ["automate", "ci/cd", "workflow", "deploy automatically", "scheduled"]),
    ("MANAGED_MONITORING", ["monitor", "uptime", "observability", "alerts", "sla"]),
    ("MAINTENANCE_RETAINER", ["maintenance", "retainer", "ongoing support", "bug fixes"]),
    ("WEB_APP_DEVELOPMENT", ["website", "web app", "portal", "dashboard", "ecommerce", "e-commerce", "saas"]),
]

COMPLEXITY_SIGNALS = [
    ("complex", ["multi-tenant", "enterprise", "integration with", "migration", "real-time", "machine learning", "high traffic", "sso", "compliance"]),
    ("simple", ["landing page", "simple", "brochure", "small", "basic", "mvp", "prototype"]),
]


class ScopeRequest(BaseModel):
    description: str = Field(min_length=10, max_length=8000)
    budgetHintUsd: float | None = None


class ScopeResponse(BaseModel):
    title: str
    serviceLine: str
    features: list[str]
    complexity: str
    roughEstimateUsd: float
    suggestedPlan: str
    aiGenerated: bool = True
    model: str = MODEL
    note: str = "AI-generated draft brief — a human PM must review before quoting."


def heuristic_scope(description: str) -> ScopeResponse:
    text = description.lower()
    scores: dict[str, int] = {}
    for service, keywords in KEYWORD_SERVICE:
        scores[service] = sum(1 for kw in keywords if kw in text)
    best = max(scores, key=lambda s: scores[s])
    if scores[best] == 0:
        best = "WEB_APP_DEVELOPMENT"

    complexity = "medium"
    for level, signals in COMPLEXITY_SIGNALS:
        if any(sig in text for sig in signals):
            complexity = level
            break

    # naive feature extraction: sentence fragments mentioning actions/nouns
    sentences = [s.strip() for s in description.replace(";", ".").split(".") if len(s.strip()) > 8]
    features = [s[:80] for s in sentences[:6]]

    title = description.strip().split(".")[0][:60] or "New product request"
    estimate = BASE_RATES[best] * COMPLEXITY_MULTIPLIER[complexity]
    return ScopeResponse(
        title=title,
        serviceLine=best,
        features=features,
        complexity=complexity,
        roughEstimateUsd=round(estimate, 2),
        suggestedPlan=best,
    )


async def llm_scope(description: str) -> dict | None:
    if not OPENAI_KEY:
        return None
    try:
        import httpx
        import json

        prompt = (
            "You are a senior software house PM. Turn this client request into a structured brief. "
            'Respond with JSON only: {"title": str, "serviceLine": one of '
            f"{SERVICE_LINES}, "
            '"features": [str, ...], "complexity": simple|medium|complex, '
            '"roughEstimateUsd": number}.\n\n'
            f"Request: {description[:4000]}"
        )
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                f"{OPENAI_BASE}/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_KEY}"},
                json={
                    "model": MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "response_format": {"type": "json_object"},
                },
            )
            if res.status_code != 200:
                return None
            return json.loads(res.json()["choices"][0]["message"]["content"])
    except Exception:
        return None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-scoping", "time": datetime.now(timezone.utc).isoformat()}


@app.post("/scope", response_model=ScopeResponse)
async def scope(req: ScopeRequest) -> ScopeResponse:
    llm = await llm_scope(req.description)
    if llm and llm.get("serviceLine") in SERVICE_LINES:
        complexity = llm.get("complexity", "medium")
        estimate = float(llm.get("roughEstimateUsd", BASE_RATES[llm["serviceLine"]]))
        return ScopeResponse(
            title=str(llm.get("title", "Product request"))[:80],
            serviceLine=llm["serviceLine"],
            features=[str(f) for f in llm.get("features", [])][:10],
            complexity=complexity,
            roughEstimateUsd=round(estimate, 2),
            suggestedPlan=llm["serviceLine"],
        )
    return heuristic_scope(req.description)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8103)
