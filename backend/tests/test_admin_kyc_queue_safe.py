"""Phase 3A — hardened KYC queue-safe API tests (no live DB)."""
from __future__ import annotations

import json
from typing import Any, Optional
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient


@pytest.fixture()
def queue_mod():
    import routes.admin_kyc_queue_safe as mod

    return mod


def _sample_pending_row(**overrides: Any) -> dict[str, Any]:
    dd = {
        "kyc_status": "pending",
        "kyc_submitted_at": "2026-07-14T12:00:00+00:00",
        "vehicle_kind": "car",
        "plate_number": "34ABC123",
        "license_photo_url": "https://example.invalid/license.jpg",
        "vehicle_photo_url": "https://example.invalid/vehicle.jpg",
        "selfie_url": None,
        "city": None,
    }
    user_id = overrides.pop("id", "11111111-2222-3333-4444-555555555555")
    name = overrides.pop("name", "Ayşe Yılmaz")
    dd.update(overrides)
    return {
        "id": user_id,
        "name": name,
        "driver_details": dd,
    }


def test_mask_name_and_empty(queue_mod) -> None:
    assert queue_mod.mask_kyc_display_name("Ayşe Yılmaz") == "A*** Y***"
    assert queue_mod.mask_kyc_display_name("") == "Unknown"
    assert queue_mod.mask_kyc_display_name(None) == "Unknown"


def test_map_pending_drops_pii_and_urls(queue_mod) -> None:
    row = _sample_pending_row()
    item = queue_mod.map_driver_row_to_queue_safe_item(
        row["id"], row["name"], row["driver_details"]
    )
    assert item is not None
    assert item["status"] == "pending"
    assert item["masked_name"] == "A*** Y***"
    assert item["city"] is None
    assert item["vehicle_type"] == "car"
    assert item["documents"]["license_present"] is True
    assert item["documents"]["selfie_present"] is False
    blob = json.dumps(item)
    assert "532" not in blob
    assert "34ABC123" not in blob
    assert "example.invalid" not in blob
    assert "Ayşe" not in blob
    assert "phone" not in item
    assert "plate" not in blob
    assert "url" not in blob.lower()


def test_non_pending_excluded(queue_mod) -> None:
    row = _sample_pending_row(kyc_status="approved")
    item = queue_mod.map_driver_row_to_queue_safe_item(
        row["id"], row["name"], row["driver_details"]
    )
    assert item is None


def test_city_null_until_present(queue_mod) -> None:
    row = _sample_pending_row()
    item = queue_mod.map_driver_row_to_queue_safe_item(
        row["id"], row["name"], row["driver_details"]
    )
    assert item["city"] is None
    row2 = _sample_pending_row(city="Kadıköy")
    item2 = queue_mod.map_driver_row_to_queue_safe_item(
        row2["id"], row2["name"], row2["driver_details"]
    )
    assert item2["city"] == "Kadıköy"


def test_build_payload_ordering_and_limit(queue_mod) -> None:
    rows = [
        _sample_pending_row(
            id="a",
            name="A",
            kyc_submitted_at="2026-07-10T00:00:00+00:00",
        ),
        _sample_pending_row(
            id="b",
            name="B",
            kyc_submitted_at="2026-07-14T00:00:00+00:00",
        ),
        {
            "id": "c",
            "name": "C",
            "driver_details": {"kyc_status": "rejected"},
        },
    ]
    payload = queue_mod.build_queue_safe_payload(rows, limit=1)
    assert payload["count"] == 1
    assert payload["items"][0]["id"] == "b"


def test_clamp_limit(queue_mod) -> None:
    assert queue_mod.clamp_queue_safe_limit(0) == 1
    assert queue_mod.clamp_queue_safe_limit(999) == 50
    assert queue_mod.clamp_queue_safe_limit("nope") == 50


def _mount_client(queue_mod, monkeypatch: pytest.MonkeyPatch, *, admin: bool = True):
    import server as srv

    class _Exec:
        def __init__(self, data):
            self.data = data

    class _Query:
        def __init__(self, data):
            self._data = data

        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def limit(self, *_a, **_k):
            return self

        @property
        def not_(self):
            return self

        def is_(self, *_a, **_k):
            return self

        def execute(self):
            return _Exec(self._data)

    class _Table:
        def __init__(self, name: str, users_data, auth_data):
            self.name = name
            self._users = users_data
            self._auth = auth_data

        def select(self, *_a, **_k):
            data = self._auth if self.name == "users" and "is_admin" in str(_a) else self._users
            # First select for auth uses is_admin; list uses driver_details
            cols = _a[0] if _a else ""
            if "is_admin" in cols:
                return _Query(self._auth)
            return _Query(self._users)

    class _SB:
        def __init__(self, users_data, auth_row):
            self._users = users_data
            self._auth = auth_row

        def table(self, name: str):
            return _Table(name, self._users, self._auth)

    auth_row = [{"id": "admin-1", "is_admin": admin}]
    users_data = [
        _sample_pending_row(),
        _sample_pending_row(
            id="22222222-2222-2222-2222-222222222222",
            name="Can Demir",
            kyc_status="approved",
            plate_number="06XYZ99",
            phone="555",
        ),
    ]

    monkeypatch.setattr(srv, "verify_access_token", lambda token: "admin-1" if token == "good" else None)
    monkeypatch.setattr(srv, "supabase", _SB(users_data, auth_row))

    app = FastAPI()
    app.include_router(queue_mod.router, prefix="/api")
    return TestClient(app)


def test_auth_missing_header(queue_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client = _mount_client(queue_mod, monkeypatch)
    r = client.get("/api/admin/kyc/queue-safe")
    assert r.status_code == 401


def test_auth_invalid_token(queue_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client = _mount_client(queue_mod, monkeypatch)
    r = client.get(
        "/api/admin/kyc/queue-safe",
        headers={"Authorization": "Bearer bad"},
    )
    assert r.status_code == 401


def test_auth_non_admin_forbidden(queue_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client = _mount_client(queue_mod, monkeypatch, admin=False)
    r = client.get(
        "/api/admin/kyc/queue-safe",
        headers={"Authorization": "Bearer good"},
    )
    assert r.status_code == 403


def test_valid_admin_masked_queue(queue_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client = _mount_client(queue_mod, monkeypatch, admin=True)
    r = client.get(
        "/api/admin/kyc/queue-safe",
        headers={"Authorization": "Bearer good"},
    )
    assert r.status_code == 200
    assert r.headers.get("cache-control") == "no-store"
    body = r.json()
    assert body["success"] is True
    assert body["count"] == 1
    item = body["items"][0]
    blob = json.dumps(body)
    assert "34ABC123" not in blob
    assert "example.invalid" not in blob
    assert "Ayşe" not in blob
    assert item["masked_name"].startswith("A***")
    assert "phone" not in blob
    assert "admin_phone" not in blob


def test_admin_phone_query_rejected(queue_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    client = _mount_client(queue_mod, monkeypatch)
    r = client.get(
        "/api/admin/kyc/queue-safe?admin_phone=5326497412",
        headers={"Authorization": "Bearer good"},
    )
    assert r.status_code == 400
    assert r.json()["error"] == "admin_phone_not_accepted"


def test_db_failure_safe(queue_mod, monkeypatch: pytest.MonkeyPatch) -> None:
    import server as srv

    monkeypatch.setattr(srv, "verify_access_token", lambda token: "admin-1")

    class Flaky:
        def table(self, name: str):
            class Q:
                def select(self, *a, **k):
                    self.cols = a[0] if a else ""
                    return self

                def eq(self, *a, **k):
                    return self

                def limit(self, *a, **k):
                    return self

                @property
                def not_(self):
                    return self

                def is_(self, *a, **k):
                    return self

                def execute(self):
                    if "is_admin" in getattr(self, "cols", ""):
                        class R:
                            data = [{"id": "admin-1", "is_admin": True}]

                        return R()
                    raise RuntimeError("db_fail phone=5326497412 url=https://secret")

            return Q()

    monkeypatch.setattr(srv, "supabase", Flaky())
    app = FastAPI()
    app.include_router(queue_mod.router, prefix="/api")
    client = TestClient(app)
    r = client.get(
        "/api/admin/kyc/queue-safe",
        headers={"Authorization": "Bearer good"},
    )
    assert r.status_code == 503
    body = r.json()
    assert body["error"] == "upstream_unavailable"
    assert "5326497412" not in json.dumps(body)
    assert "secret" not in json.dumps(body)


def test_source_has_no_response_pii_fields(queue_mod) -> None:
    sample = queue_mod.map_driver_row_to_queue_safe_item(
        "id1",
        "Ali Veli",
        {
            "kyc_status": "pending",
            "license_photo_url": "http://x/y",
            "plate_number": "01ABC01",
            "phone": "500",
        },
    )
    assert sample is not None
    assert set(sample.keys()) == {
        "id",
        "masked_name",
        "city",
        "vehicle_type",
        "submitted_at",
        "status",
        "documents",
    }
    blob = json.dumps(sample)
    for needle in ("phone", "plate", "http://", "500", "01ABC01", "Ali"):
        assert needle not in blob



def test_router_path_registered(queue_mod) -> None:
    paths = [getattr(r, "path", None) for r in queue_mod.router.routes]
    assert "/queue-safe" in paths or any(
        (getattr(r, "path", "") or "").endswith("queue-safe") for r in queue_mod.router.routes
    )
