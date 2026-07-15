"""Phase 2 — internal Enterprise KYC safe-detail route tests (no live DB/secrets)."""
from __future__ import annotations

import inspect
import json
import sys
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

_TEST_REVIEW_TOKEN = "phase2-test-review-token-not-for-production"
_TEST_QUEUE_TOKEN = "phase3c-test-service-token-not-for-production"
_APP_ID = "11111111-2222-3333-4444-555555555555"
_DETAIL_PATH = f"/api/internal/enterprise/kyc/applications/{_APP_ID}/safe-detail"


@pytest.fixture()
def auth_mod():
    import services.enterprise_kyc_read_auth as mod

    return mod


@pytest.fixture()
def detail_svc():
    import services.kyc_application_safe_detail_service as mod

    return mod


@pytest.fixture()
def detail_route_mod():
    import routes.internal_enterprise_kyc_detail as mod

    return mod


def _sample_row(**dd_overrides: Any) -> dict[str, Any]:
    dd: dict[str, Any] = {
        "kyc_status": "pending",
        "kyc_submitted_at": "2026-07-14T12:00:00+00:00",
        "vehicle_kind": "car",
        "plate_number": "34ABC123",
        "license_photo_url": "https://example.invalid/license.jpg",
        "vehicle_photo_url": "https://example.invalid/vehicle.jpg",
        "selfie_url": None,
        "phone": "5326497412",
        "email": "secret@example.invalid",
    }
    dd.update(dd_overrides)
    return {
        "id": _APP_ID,
        "name": "Ayşe Yılmaz",
        "city": "Istanbul",
        "updated_at": "2026-07-14T13:00:00+00:00",
        "driver_details": dd,
    }


class _TrackedQuery:
    def __init__(self, data: list[dict[str, Any]] | None):
        self._data = data or []
        self.select_args: tuple[Any, ...] = ()
        self.eq_calls: list[tuple[str, str]] = []
        self.limit_value: int | None = None
        self.insert_called = False
        self.update_called = False
        self.upsert_called = False
        self.delete_called = False

    def select(self, *args, **kwargs):
        self.select_args = args
        return self

    def eq(self, column: str, value: str):
        self.eq_calls.append((column, value))
        return self

    def limit(self, n: int):
        self.limit_value = n
        return self

    def insert(self, *_a, **_k):
        self.insert_called = True
        return self

    def update(self, *_a, **_k):
        self.update_called = True
        return self

    def upsert(self, *_a, **_k):
        self.upsert_called = True
        return self

    def delete(self, *_a, **_k):
        self.delete_called = True
        return self

    def execute(self):
        if getattr(self, "_db_error", False):
            raise RuntimeError("db_boom")
        filtered = self._data
        for col, val in self.eq_calls:
            if col == "id":
                filtered = [r for r in filtered if str(r.get("id")).lower() == str(val).lower()]
        if self.limit_value is not None:
            filtered = filtered[: self.limit_value]
        return MagicMock(data=filtered)


class _TrackedTable:
    def __init__(self, data: list[dict[str, Any]] | None, *, db_error: bool = False):
        self._data = data or []
        self._db_error = db_error
        self.last_query: _TrackedQuery | None = None

    def select(self, *args, **kwargs):
        self.last_query = _TrackedQuery(self._data)
        self.last_query._db_error = self._db_error
        self.last_query.select_args = args
        return self.last_query


class _TrackedSB:
    def __init__(self, rows: list[dict[str, Any]] | None = None, *, db_error: bool = False):
        self._rows = rows if rows is not None else []
        self._db_error = db_error
        self.last_table: _TrackedTable | None = None

    def table(self, name: str):
        self.last_table = _TrackedTable(self._rows, db_error=self._db_error)
        return self.last_table


def _mount_client(
    detail_route_mod,
    monkeypatch: pytest.MonkeyPatch,
    *,
    review_token: str | None = _TEST_REVIEW_TOKEN,
    queue_token: str | None = _TEST_QUEUE_TOKEN,
    rows: list[dict[str, Any]] | None = None,
    db_error: bool = False,
    supabase_none: bool = False,
):
    import server as srv
    import services.enterprise_kyc_read_auth as auth

    if review_token is None:
        monkeypatch.delenv(auth.ENTERPRISE_KYC_REVIEW_TOKEN_ENV, raising=False)
    else:
        monkeypatch.setenv(auth.ENTERPRISE_KYC_REVIEW_TOKEN_ENV, review_token)

    if queue_token is None:
        monkeypatch.delenv(auth.ENTERPRISE_KYC_READ_TOKEN_ENV, raising=False)
    else:
        monkeypatch.setenv(auth.ENTERPRISE_KYC_READ_TOKEN_ENV, queue_token)

    if supabase_none:
        monkeypatch.setattr(srv, "supabase", None, raising=False)
    else:
        sb = _TrackedSB(rows, db_error=db_error)
        monkeypatch.setattr(srv, "supabase", sb, raising=False)

    app = FastAPI()
    app.include_router(detail_route_mod.router, prefix="/api")
    client = TestClient(app)
    return client, getattr(srv, "supabase", None)


def _auth_headers(
    token: str = _TEST_REVIEW_TOKEN,
    *,
    actor: str | None = "enterprise-actor-1",
    request_id: str | None = None,
) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {token}"}
    if actor is not None:
        headers["X-Karekod-Actor-Id"] = actor
    if request_id is not None:
        headers["X-Karekod-Request-Id"] = request_id
    return headers


def _flatten_keys(value: object, prefix: str = "") -> set[str]:
    keys: set[str] = set()
    if isinstance(value, dict):
        for k, v in value.items():
            keys.add(k)
            keys.update(_flatten_keys(v, f"{prefix}.{k}"))
    elif isinstance(value, list):
        for item in value:
            keys.update(_flatten_keys(item, prefix))
    return keys


# --- Auth / audit (1-10) ---


def test_review_token_env_missing_503(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, review_token=None)
    r = client.get(_DETAIL_PATH, headers=_auth_headers())
    assert r.status_code == 503
    assert r.json().get("detail") == "service_auth_disabled"


def test_bearer_missing_401(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch)
    r = client.get(_DETAIL_PATH, headers={"X-Karekod-Actor-Id": "actor-1"})
    assert r.status_code == 401
    assert r.json().get("detail") == "unauthorized"


def test_bearer_malformed_401(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch)
    r = client.get(
        _DETAIL_PATH,
        headers={"Authorization": "Token not-bearer", "X-Karekod-Actor-Id": "actor-1"},
    )
    assert r.status_code == 401


def test_review_token_invalid_403(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch)
    r = client.get(_DETAIL_PATH, headers=_auth_headers(token="wrong-review-token"))
    assert r.status_code == 403
    assert r.json().get("detail") == "forbidden"


def test_queue_read_token_not_accepted_as_review_token(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch)
    r = client.get(_DETAIL_PATH, headers=_auth_headers(token=_TEST_QUEUE_TOKEN))
    assert r.status_code == 403


def test_actor_missing_after_valid_auth_400(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    r = client.get(
        _DETAIL_PATH,
        headers={"Authorization": f"Bearer {_TEST_REVIEW_TOKEN}"},
    )
    assert r.status_code == 400
    assert r.json().get("detail") == "invalid_audit_metadata"


def test_actor_malformed_400(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch)
    r = client.get(_DETAIL_PATH, headers=_auth_headers(actor="bad\nactor"))
    assert r.status_code == 400
    assert r.json().get("detail") == "invalid_audit_metadata"


def test_request_id_absent_generated(detail_route_mod, monkeypatch, auth_mod) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    generated: list[str] = []

    original = auth_mod._generate_kyc_request_id

    def _capture():
        rid = original()
        generated.append(rid)
        return rid

    monkeypatch.setattr(auth_mod, "_generate_kyc_request_id", _capture)
    r = client.get(_DETAIL_PATH, headers=_auth_headers(request_id=None))
    assert r.status_code == 200
    assert len(generated) == 1
    assert generated[0].startswith("kycd-")


def test_supplied_request_id_malformed_400(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch)
    r = client.get(_DETAIL_PATH, headers=_auth_headers(request_id="bad\x01id"))
    assert r.status_code == 400


def test_actor_without_bearer_401(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch)
    r = client.get(_DETAIL_PATH, headers={"X-Karekod-Actor-Id": "actor-only"})
    assert r.status_code == 401


# --- UUID / not found (11-12) ---


def test_malformed_application_uuid_rejected_before_db(detail_route_mod, monkeypatch) -> None:
    client, sb = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    r = client.get(
        "/api/internal/enterprise/kyc/applications/not-a-uuid/safe-detail",
        headers=_auth_headers(),
    )
    assert r.status_code == 422
    assert sb is None or sb.last_table is None


def test_application_not_found_200(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[])
    r = client.get(_DETAIL_PATH, headers=_auth_headers())
    assert r.status_code == 200
    body = r.json()
    assert body["result"]["availability"] == "not_found"
    assert body["result"]["reason_code"] == "application_not_found"
    assert r.headers.get("Cache-Control") == "no-store"


# --- Status ready paths (13-17) ---


@pytest.mark.parametrize(
    "status",
    ["pending", "needs_documents", "approved", "rejected"],
)
def test_supported_statuses_ready(detail_route_mod, monkeypatch, status: str) -> None:
    client, _ = _mount_client(
        detail_route_mod, monkeypatch, rows=[_sample_row(kyc_status=status)]
    )
    r = client.get(_DETAIL_PATH, headers=_auth_headers())
    assert r.status_code == 200
    assert r.json()["result"]["availability"] == "ready"
    assert r.json()["result"]["detail"]["status"] == status


def test_pending_car_ready(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(
        detail_route_mod,
        monkeypatch,
        rows=[_sample_row(vehicle_kind="car")],
    )
    r = client.get(_DETAIL_PATH, headers=_auth_headers())
    body = r.json()
    assert body["result"]["detail"]["vehicle"]["vehicle_type"] == "car"


def test_pending_motorcycle_ready(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(
        detail_route_mod,
        monkeypatch,
        rows=[
            _sample_row(
                vehicle_kind="motorcycle",
                motorcycle_photo_url="https://example.invalid/moto.jpg",
                selfie_url="https://example.invalid/selfie.jpg",
            )
        ],
    )
    r = client.get(_DETAIL_PATH, headers=_auth_headers())
    body = r.json()
    assert body["result"]["detail"]["vehicle"]["vehicle_type"] == "motorcycle"


# --- Unsupported / malformed (18-20) ---


def test_missing_status_unsupported(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(
        detail_route_mod, monkeypatch, rows=[_sample_row(kyc_status=None)]
    )
    r = client.get(_DETAIL_PATH, headers=_auth_headers())
    assert r.json()["result"]["reason_code"] == "unsupported_status"


def test_unknown_status_unsupported(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(
        detail_route_mod, monkeypatch, rows=[_sample_row(kyc_status="unknown")]
    )
    r = client.get(_DETAIL_PATH, headers=_auth_headers())
    assert r.json()["result"]["reason_code"] == "unsupported_status"


def test_malformed_driver_details_invalid_source(detail_route_mod, monkeypatch) -> None:
    row = _sample_row()
    row["driver_details"] = "not-a-dict"
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[row])
    r = client.get(_DETAIL_PATH, headers=_auth_headers())
    assert r.json()["result"]["reason_code"] == "invalid_source_data"


# --- Documents (21-29) ---


def test_license_url_not_in_output(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    r = client.get(_DETAIL_PATH, headers=_auth_headers())
    text = r.text.lower()
    assert "license_photo_url" not in text
    assert "example.invalid" not in text
    docs = r.json()["result"]["detail"]["documents"]
    license_doc = docs[0]
    assert license_doc["document_type"] == "license"
    assert license_doc["presence"] == "present"


def test_car_registration_uses_vehicle_photo_url(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(
        detail_route_mod,
        monkeypatch,
        rows=[
            _sample_row(
                vehicle_kind="car",
                vehicle_photo_url="https://example.invalid/v.jpg",
                motorcycle_photo_url=None,
            )
        ],
    )
    docs = client.get(_DETAIL_PATH, headers=_auth_headers()).json()["result"]["detail"]["documents"]
    reg = docs[1]
    assert reg["presence"] == "present"


def test_motorcycle_registration_uses_motorcycle_photo_url(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(
        detail_route_mod,
        monkeypatch,
        rows=[
            _sample_row(
                vehicle_kind="motorcycle",
                vehicle_photo_url="https://example.invalid/car-only.jpg",
                motorcycle_photo_url="https://example.invalid/m.jpg",
            )
        ],
    )
    docs = client.get(_DETAIL_PATH, headers=_auth_headers()).json()["result"]["detail"]["documents"]
    reg = docs[1]
    assert reg["presence"] == "present"


def test_car_selfie_required_false(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    r = client.get(_DETAIL_PATH, headers=_auth_headers())
    selfie = r.json()["result"]["detail"]["documents"][2]
    assert selfie["required"] is False


def test_motorcycle_selfie_required_true(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(
        detail_route_mod,
        monkeypatch,
        rows=[_sample_row(vehicle_kind="motorcycle", selfie_url="https://x/s.jpg")],
    )
    selfie = client.get(_DETAIL_PATH, headers=_auth_headers()).json()["result"]["detail"]["documents"][2]
    assert selfie["required"] is True


def test_no_identity_document_emitted(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    types = [d["document_type"] for d in client.get(_DETAIL_PATH, headers=_auth_headers()).json()["result"]["detail"]["documents"]]
    assert "identity" not in types


def test_fixed_document_order(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    types = [d["document_type"] for d in client.get(_DETAIL_PATH, headers=_auth_headers()).json()["result"]["detail"]["documents"]]
    assert types == ["license", "vehicle_registration", "selfie"]


def test_fixed_display_labels(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    labels = [d["display_label"] for d in client.get(_DETAIL_PATH, headers=_auth_headers()).json()["result"]["detail"]["documents"]]
    assert labels == ["Ehliyet", "Araç ruhsatı", "Selfie"]


def test_jpeg_only_mime(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    for doc in client.get(_DETAIL_PATH, headers=_auth_headers()).json()["result"]["detail"]["documents"]:
        assert doc["allowed_mime_types"] == ["image/jpeg"]


# --- PII / redaction (30-38) ---


def test_full_name_masked(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    masked = client.get(_DETAIL_PATH, headers=_auth_headers()).json()["result"]["detail"]["applicant"]["masked_name"]
    assert "Yılmaz" not in masked
    assert "Ayşe" not in masked
    assert "***" in masked


def test_city_fallback_deterministic(detail_route_mod, monkeypatch) -> None:
    row = _sample_row(city=None, registration_city="Ankara")
    row["city"] = "Istanbul"
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[row])
    city = client.get(_DETAIL_PATH, headers=_auth_headers()).json()["result"]["detail"]["applicant"]["city"]
    assert city == "Ankara"


def test_phone_absent(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    assert "phone" not in client.get(_DETAIL_PATH, headers=_auth_headers()).text.lower()


def test_plate_absent(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    assert "plate" not in _flatten_keys(client.get(_DETAIL_PATH, headers=_auth_headers()).json())


def test_email_absent(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    assert "email" not in client.get(_DETAIL_PATH, headers=_auth_headers()).text.lower()


def test_raw_product_row_absent(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    keys = _flatten_keys(client.get(_DETAIL_PATH, headers=_auth_headers()).json())
    assert "driver_details" not in keys
    assert "raw_row" not in keys


def test_raw_driver_details_absent(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    text = client.get(_DETAIL_PATH, headers=_auth_headers()).text
    assert "license_photo_url" not in text
    assert "driver_details" not in text


def test_forbidden_keys_absent_recursively(detail_route_mod, monkeypatch, detail_svc) -> None:
    from contracts import enterprise_kyc_detail_contract as contract

    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    payload = client.get(_DETAIL_PATH, headers=_auth_headers()).json()
    assert not contract.kyc_detail_contract_contains_forbidden_keys(payload)


def test_redaction_markers_not_false_positives(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    redaction = client.get(_DETAIL_PATH, headers=_auth_headers()).json()["result"]["detail"]["redaction"]
    assert redaction["persistent_document_urls_excluded"] is True


# --- Cache / upstream (39-43) ---


def test_cache_control_no_store_ready(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    assert client.get(_DETAIL_PATH, headers=_auth_headers()).headers.get("Cache-Control") == "no-store"


def test_cache_control_no_store_not_found(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[])
    assert client.get(_DETAIL_PATH, headers=_auth_headers()).headers.get("Cache-Control") == "no-store"


def test_cache_control_no_store_unavailable(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(
        detail_route_mod, monkeypatch, rows=[_sample_row(kyc_status="weird")]
    )
    assert client.get(_DETAIL_PATH, headers=_auth_headers()).headers.get("Cache-Control") == "no-store"


def test_product_source_failure_503(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()], db_error=True)
    r = client.get(_DETAIL_PATH, headers=_auth_headers())
    assert r.status_code == 503
    assert r.json().get("error") == "upstream_unavailable"
    assert "db_boom" not in r.text


def test_raw_exception_not_leaked(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()], db_error=True)
    r = client.get(_DETAIL_PATH, headers=_auth_headers())
    assert "RuntimeError" not in r.text
    assert "Traceback" not in r.text


# --- Query posture (44-50) ---


def test_query_selects_exact_columns(detail_route_mod, monkeypatch, detail_svc) -> None:
    client, sb = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    client.get(_DETAIL_PATH, headers=_auth_headers())
    assert sb.last_table is not None
    q = sb.last_table.last_query
    assert q is not None
    assert q.select_args == (detail_svc.DETAIL_SELECT_COLUMNS,)


def test_query_scoped_by_application_id(detail_route_mod, monkeypatch) -> None:
    client, sb = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    client.get(_DETAIL_PATH, headers=_auth_headers())
    q = sb.last_table.last_query
    assert q.eq_calls == [("id", _APP_ID)]


def test_query_limit_one(detail_route_mod, monkeypatch) -> None:
    client, sb = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    client.get(_DETAIL_PATH, headers=_auth_headers())
    assert sb.last_table.last_query.limit_value == 1


def test_no_insert_update_upsert_delete(detail_route_mod, monkeypatch) -> None:
    client, sb = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    client.get(_DETAIL_PATH, headers=_auth_headers())
    q = sb.last_table.last_query
    assert q.insert_called is False
    assert q.update_called is False
    assert q.upsert_called is False
    assert q.delete_called is False


def test_review_auth_uses_compare_digest(auth_mod) -> None:
    src = inspect.getsource(auth_mod.require_enterprise_kyc_review_service)
    assert "compare_digest" in inspect.getsource(auth_mod.service_tokens_equal)
    assert auth_mod.service_tokens_equal(_TEST_REVIEW_TOKEN, _TEST_REVIEW_TOKEN)


def test_unknown_vehicle_registration_unavailable(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(
        detail_route_mod,
        monkeypatch,
        rows=[_sample_row(vehicle_kind="spaceship")],
    )
    docs = client.get(_DETAIL_PATH, headers=_auth_headers()).json()["result"]["detail"]["documents"]
    reg = docs[1]
    assert reg["presence"] == "unavailable"
    assert reg["review_state"] == "unavailable"
    assert reg["required"] is True


def test_ready_review_block(detail_route_mod, monkeypatch) -> None:
    client, _ = _mount_client(detail_route_mod, monkeypatch, rows=[_sample_row()])
    review = client.get(_DETAIL_PATH, headers=_auth_headers()).json()["result"]["detail"]["review"]
    assert review["required_permission"] == "kyc.review"
    assert review["may_request_document_access"] is True
    assert review["may_decide"] is False
