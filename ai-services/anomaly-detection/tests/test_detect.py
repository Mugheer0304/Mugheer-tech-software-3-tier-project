"""AI evaluation tests — fixed evaluation set for anomaly detection.
Run in CI: a minimum detection score is required before merge (Section 21).
"""
from __future__ import annotations

import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import _ewma_drift, _robust_z, detect, SeriesRequest, Point  # noqa: E402


def _series(values, metric="response_time_ms"):
    return SeriesRequest(series=[Point(metricName=metric, value=float(v)) for v in values])


def test_robust_z_flags_spike():
    normal = list(np.random.normal(120, 10, 60))
    spiked = normal + [400.0]
    z = _robust_z(np.array(spiked[-60:]))
    assert abs(z) > 3, f"expected spike to produce |z|>3, got {z}"


def test_robust_z_quiet_on_normal():
    normal = list(np.random.normal(120, 10, 60))
    z = _robust_z(np.array(normal[-60:]))
    assert abs(z) < 3, f"expected normal data to be quiet, got {z}"


def test_ewma_flags_sustained_shift():
    baseline = list(np.random.normal(100, 5, 30))
    shifted = list(np.random.normal(160, 5, 30))
    drift = _ewma_drift(np.array(baseline + shifted))
    assert drift > 2, f"expected sustained shift to produce drift>2, got {drift}"


def test_detect_ignores_short_series():
    resp = detect(_series([1.0, 2.0, 3.0]))
    assert resp.anomalies == []
    assert resp.evaluatedPoints == 3


def test_detect_finds_injected_anomaly():
    rng = np.random.default_rng(42)
    normal = list(rng.normal(100, 8, 80))
    injected = normal[:-1] + [500.0]
    resp = detect(_series(injected))
    assert len(resp.anomalies) >= 1, "expected at least one anomaly for injected spike"
    top = resp.anomalies[0]
    assert top.confidence >= 0.75
    assert "response_time_ms" in top.metricName


def test_detect_precision_on_clean_data():
    """Fixed evaluation set: clean data should produce very few false positives."""
    rng = np.random.default_rng(7)
    clean = list(rng.normal(120, 10, 200))
    resp = detect(_series(clean))
    assert len(resp.anomalies) <= 2, f"too many false positives: {len(resp.anomalies)}"
