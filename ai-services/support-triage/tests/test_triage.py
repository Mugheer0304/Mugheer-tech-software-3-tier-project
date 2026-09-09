"""Fixed evaluation set for triage classification — CI requires min accuracy."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import heuristic_classify, heuristic_reply  # noqa: E402

EVAL_SET = [
    ("Site is completely down", "Production is returning 500 for all users since 10am, this is critical.", "urgent"),
    ("We were double charged", "The invoice shows two charges of $499 this month, please refund one.", "billing"),
    ("Export button broken", "Clicking export throws an unhandled exception and nothing downloads.", "bug"),
    ("Can we add Slack alerts", "Feature request: it would be nice to get alerts in our Slack channel.", "feature"),
    ("Question about plans", "What is included in the monitoring plan exactly?", "general"),
]


def test_eval_set_accuracy():
    correct = 0
    for subject, body, expected in EVAL_SET:
        category, _, _ = heuristic_classify(subject, body)
        if category == expected:
            correct += 1
    accuracy = correct / len(EVAL_SET)
    assert accuracy >= 0.8, f"triage accuracy {accuracy:.0%} below required 80%"


def test_urgent_gets_high_priority():
    category, priority, confidence = heuristic_classify("DB outage", "production database is down, data loss possible")
    assert category == "urgent"
    assert priority == "high"
    assert confidence >= 0.5


def test_replies_are_non_empty_and_empathetic():
    for cat in ["urgent", "bug", "billing", "feature", "general"]:
        reply = heuristic_reply(cat, "anything")
        assert len(reply) > 40
        assert "thanks" in reply.lower() or "thank" in reply.lower()
