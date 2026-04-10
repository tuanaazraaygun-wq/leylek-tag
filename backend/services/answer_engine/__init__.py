"""
LeylekTag Answer Engine — kural tabanlı deterministic yardım yanıtları.
"""
from __future__ import annotations

from .coverage import get_coverage_payload
from .matcher import ResolvedAnswer, try_resolve
from .telemetry import (
    get_answer_engine_telemetry_admin_summary,
    get_answer_engine_telemetry_counters,
    is_answer_engine_telemetry_enabled,
)

__all__ = [
    "try_resolve",
    "ResolvedAnswer",
    "get_coverage_payload",
    "get_answer_engine_telemetry_counters",
    "get_answer_engine_telemetry_admin_summary",
    "is_answer_engine_telemetry_enabled",
]
