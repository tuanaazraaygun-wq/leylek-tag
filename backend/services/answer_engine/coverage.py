"""
Answer Engine — salt okunur katalog özeti (admin coverage).
"""
from __future__ import annotations

from typing import Any

from .catalog import INTENT_DEFINITIONS


def get_coverage_payload() -> dict[str, Any]:
    intents: list[dict[str, Any]] = []
    for intent in INTENT_DEFINITIONS:
        has_body = bool(
            (intent.default_template and intent.default_template.strip())
            or intent.role_specific_templates
        )
        intents.append(
            {
                "id": intent.id,
                "title": intent.title,
                "roles": list(intent.supported_roles),
                "has_body": has_body,
                "example_queries": list(intent.example_queries),
            }
        )
    return {"total_intents": len(intents), "intents": intents}
