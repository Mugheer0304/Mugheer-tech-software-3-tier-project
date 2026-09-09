# ai-anomaly — Anomaly Detection Service

**What this does:** watches per-product metric time series (response time, error rate, CPU, uptime — anything the platform ingests) and flags abnormal behavior before static thresholds would. Called by `worker` (scheduled scans every 15 min) and by `backend-core`'s AI orchestrator; results become alerts with an `aiConfidence` score. Down also exposes `/summarize` for the weekly report generator.

## The model (hybrid, three detectors)

| Detector | Catches | Method |
|---|---|---|
| Robust z-score | Point spikes/drops | Median + MAD (immune to outlier pollution) on the last 60 points |
| EWMA level-shift | **Sustained** shifts (a slow ramp that never "spikes") | Recent-window mean vs EWMA baseline built from the earlier half, normalized by standard error |
| IsolationForest | Multivariate weirdness (when ≥50 points) | Contamination 3%, flags the latest point |

A combined score ≥ 0.75 produces an anomaly with confidence up to 0.99. If no LLM is configured nothing changes — this service is fully statistical and works offline.

## Files in this service

| Path | What it is |
|---|---|
| `app/main.py` | FastAPI app: `/detect`, `/summarize`, `/health` + all detection logic |
| `tests/test_detect.py` | The evaluation suite CI gates on (see below) |
| `requirements.txt` | Pinned dependencies |
| `Dockerfile` | Python 3.12-slim, non-root, healthcheck |

## Quick start

```bash
# Local (virtualenv recommended)
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8101

# Or from the repo root
docker compose up --build ai-anomaly        # → http://localhost:8101
```

### Try it

```bash
curl -X POST http://localhost:8101/detect -H "Content-Type: application/json" -d '{
  "series": [
    {"metricName":"response_time_ms","value":120},
    {"metricName":"response_time_ms","value":118},
    {"metricName":"response_time_ms","value":500},
    {"metricName":"response_time_ms","value":121}
  ]
}'
# → {"anomalies":[{"metricName":"response_time_ms","confidence":0.99,"explanation":"..."}], ...}
```

Interactive docs: http://localhost:8101/docs · Health: `GET /health`.

**Env:** none required. `AI_MODEL` is only cosmetic metadata. Needs ≥10 points per metric before it judges (fewer → skipped; static threshold alerts cover that gap).

## Evaluation tests (CI gate)

```bash
pip install -r requirements.txt && pytest tests -q
```

The fixed evaluation set asserts: spikes get robust-z > 3 · normal data stays quiet · sustained shifts trigger the EWMA detector · short series are ignored · an injected 500ms spike in clean data is found with confidence ≥ 0.75 · clean data yields ≤ 2 false positives in 200 points. These are the "AI evaluation tests" required by spec Section 21 — **a failure blocks merge.**

## How to work on it

1. Tune detectors by editing `_robust_z` / `_ewma_drift` / the IsolationForest block in `app/main.py` — keep the confidence scale 0–1 and the 0.75 alerting threshold in sync with `backend-core`'s `AiService`.
2. Any change to detection logic must keep the evaluation suite passing; add a case to `tests/test_detect.py` for every new behavior (e.g. seasonality, new metric types).
3. Keep the API contract stable — `worker/src/index.ts` and `backend-core/src/modules/ai/ai.service.ts` consume these exact shapes.
