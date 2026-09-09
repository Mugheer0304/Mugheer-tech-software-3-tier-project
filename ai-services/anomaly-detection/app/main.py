"""Mugheer AI — anomaly detection service.

Hybrid detector:
1. Robust z-score (median/MAD) for point anomalies on the most recent window.
2. EWMA (exponentially weighted mean) drift detection for sustained shifts.
3. IsolationForest across multivariate feature vectors when enough history.

All responses include a confidence in [0,1]; the caller (backend AI orchestrator
or worker) converts anomalies into alerts with governance logging.
"""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Mugheer AI — Anomaly Detection", version="1.0.0")


class Point(BaseModel):
    metricName: str
    value: float
    timestamp: str | None = None


class SeriesRequest(BaseModel):
    series: list[Point] = Field(default_factory=list)


class Anomaly(BaseModel):
    metricName: str
    value: float
    confidence: float
    explanation: str
    timestamp: str | None = None


class DetectResponse(BaseModel):
    anomalies: list[Anomaly]
    evaluatedPoints: int
    modelVersion: str = "ewma+robust-z+iforest-1.0"


def _robust_z(values: np.ndarray) -> float:
    median = np.median(values)
    mad = np.median(np.abs(values - median))
    if mad == 0:
        return 0.0
    return float(0.6745 * (values[-1] - median) / mad)


def _ewma_drift(values: np.ndarray, alpha: float = 0.3) -> float:
    """Z-like score comparing the recent window mean against the EWMA baseline
    built from the earlier half of the series. Catches sustained level shifts,
    not just point spikes (a shifted series converges into a naive EWMA)."""
    if len(values) < 10:
        return 0.0
    half = len(values) // 2
    baseline = float(values[0])
    for v in values[:half]:
        baseline = alpha * float(v) + (1 - alpha) * baseline
    recent_mean = float(np.mean(values[half:]))
    baseline_var = float(np.var(values[:half])) or 1e-9
    n_recent = len(values) - half
    sem = math.sqrt(baseline_var / max(1, n_recent))
    return abs((recent_mean - baseline) / sem) if sem > 0 else 0.0


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-anomaly", "time": datetime.now(timezone.utc).isoformat()}


@app.post("/detect", response_model=DetectResponse)
def detect(req: SeriesRequest) -> DetectResponse:
    by_metric: dict[str, list[float]] = defaultdict(list)
    ts_by_metric: dict[str, list[str | None]] = defaultdict(list)
    for p in req.series:
        by_metric[p.metricName].append(float(p.value))
        ts_by_metric[p.metricName].append(p.timestamp)

    anomalies: list[Anomaly] = []
    total = 0
    for metric, values in by_metric.items():
        arr = np.array(values, dtype=float)
        total += len(arr)
        if len(arr) < 10:
            continue  # not enough history — static thresholds cover this case

        window = arr[-60:]
        z = _robust_z(window)
        drift = _ewma_drift(window)

        # IsolationForest on shape features when enough data
        if len(arr) >= 50:
            try:
                from sklearn.ensemble import IsolationForest

                feats = np.column_stack(
                    [
                        arr[-50:],
                        np.diff(arr[-51:], prepend=arr[-50]),
                        np.abs(np.diff(arr[-51:], prepend=arr[-50])),
                    ]
                )
                model = IsolationForest(contamination=0.03, random_state=42)
                labels = model.fit_predict(feats)
                iso_flag = labels[-1] == -1
            except Exception:
                iso_flag = False
        else:
            iso_flag = False

        score = max(abs(z) / 6.0, drift / 6.0, 0.85 if iso_flag else 0.0)
        if score >= 0.75:
            direction = "spike" if z > 0 else "drop"
            confidence = min(0.99, score)
            anomalies.append(
                Anomaly(
                    metricName=metric,
                    value=float(arr[-1]),
                    confidence=round(confidence, 3),
                    explanation=(
                        f"{metric} {direction} to {arr[-1]:.2f} "
                        f"(robust-z={z:.2f}, ewma-drift={drift:.2f}"
                        f"{', isolation-forest flagged' if iso_flag else ''})"
                    ),
                    timestamp=ts_by_metric[metric][-1],
                )
            )

    anomalies.sort(key=lambda a: -a.confidence)
    return DetectResponse(anomalies=anomalies, evaluatedPoints=total)


@app.post("/summarize")
def summarize(req: dict[str, Any]) -> dict[str, str]:
    product = str(req.get("product", "product"))
    metrics = req.get("metrics", {})
    parts = []
    for name, stats in sorted(metrics.items()):
        if isinstance(stats, dict) and "avg" in stats:
            parts.append(f"{name} averaged {stats['avg']:.1f} (range {stats.get('min', 0):.1f}–{stats.get('max', 0):.1f})")
    body = "; ".join(parts) if parts else "insufficient data"
    summary = f"Weekly health for {product}: {body}. " "No sustained anomalies beyond normal variance were detected." if not _any_breaches(metrics) else f"Weekly health for {product}: {body}. Some metrics deviated from baseline — review the alerts panel."
    return {"summary": summary, "aiGenerated": True}


def _any_breaches(metrics: dict[str, Any]) -> bool:
    # A simple rule: response_time avg above 800ms or error_rate avg above 5%
    rt = metrics.get("response_time_ms", {})
    er = metrics.get("error_rate", {})
    rt_avg = rt.get("avg", 0) if isinstance(rt, dict) else 0
    er_avg = er.get("avg", 0) if isinstance(er, dict) else 0
    return (isinstance(rt_avg, (int, float)) and rt_avg > 800) or (isinstance(er_avg, (int, float)) and er_avg > 0.05)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8101)
