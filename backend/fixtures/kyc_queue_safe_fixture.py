"""
Synthetic PII-safe KYC queue items for staging-only fixture mode (Phase 3E).

Only fictional masked display strings and boolean document presence flags.
"""
from __future__ import annotations

from typing import Any

# Deterministic ISO timestamps (newest first when sorted desc).
KYC_QUEUE_SAFE_FIXTURE_ITEMS: list[dict[str, Any]] = [
    {
        "id": "fixture-kyc-001",
        "masked_name": "Um*** K***",
        "city": "İstanbul",
        "vehicle_type": "car",
        "submitted_at": "2026-07-14T10:00:00+00:00",
        "status": "pending",
        "documents": {
            "identity_present": True,
            "license_present": True,
            "vehicle_registration_present": True,
            "selfie_present": True,
        },
    },
    {
        "id": "fixture-kyc-002",
        "masked_name": "Ay*** D***",
        "city": "İzmir",
        "vehicle_type": "motorcycle",
        "submitted_at": "2026-07-13T09:00:00+00:00",
        "status": "pending",
        "documents": {
            "identity_present": True,
            "license_present": True,
            "vehicle_registration_present": False,
            "selfie_present": False,
        },
    },
    {
        "id": "fixture-kyc-003",
        "masked_name": "Me*** Y***",
        "city": None,
        "vehicle_type": "car",
        "submitted_at": "2026-07-12T08:00:00+00:00",
        "status": "pending",
        "documents": {
            "identity_present": False,
            "license_present": True,
            "vehicle_registration_present": True,
            "selfie_present": False,
        },
    },
]
