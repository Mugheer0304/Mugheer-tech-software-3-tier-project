from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import heuristic_scope  # noqa: E402


def test_mobile_request_maps_to_mobile():
    brief = heuristic_scope("We need an iOS and Android app for our field technicians with offline mode.")
    assert brief.serviceLine == "MOBILE_APP_DEVELOPMENT"


def test_complexity_detection():
    brief = heuristic_scope("A simple landing page for our bakery with a contact form.")
    assert brief.complexity == "simple"
    assert brief.serviceLine == "WEB_APP_DEVELOPMENT"


def test_estimate_within_reasonable_bounds():
    brief = heuristic_scope("Enterprise multi-tenant SaaS dashboard with real-time analytics and SSO integration.")
    assert brief.roughEstimateUsd > 0
    assert brief.complexity == "complex"


def test_brief_always_marked_ai_generated():
    brief = heuristic_scope("A portal for managing invoices with PDF export.")
    assert brief.aiGenerated is True
    assert "PM must review" in brief.note
