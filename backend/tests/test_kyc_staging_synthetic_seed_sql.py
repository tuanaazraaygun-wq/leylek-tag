"""KYC staging synthetic seed SQL contract tests (OPS-C)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

SEED_PATH = BACKEND_DIR / "migrations" / "seed_kyc_staging_synthetic.sql"

REQUIRED_FIXTURE_KEYS = frozenset(
    {
        "pending_car",
        "pending_motorcycle",
        "approved_user",
        "stale_pending",
        "approve_target",
        "reject_target",
    }
)

PRODUCTION_REFS = frozenset(
    {
        "ujvploftywsxprlzejgc",
        "iqxckvhfvwlolbqzvutz",
    }
)


def _sql() -> str:
    assert SEED_PATH.is_file(), f"missing seed manifest: {SEED_PATH}"
    return SEED_PATH.read_text(encoding="utf-8")


def test_staging_only_banner_present() -> None:
    sql = _sql().lower()
    assert "not for production" in sql
    assert "synthetic" in sql


def test_on_conflict_idempotent_reapply() -> None:
    sql = _sql()
    assert re.search(r"ON\s+CONFLICT\s*\(\s*id\s*\)\s+DO\s+NOTHING", sql, re.I)


def test_no_destructive_delete() -> None:
    executable = re.sub(r"--.*$", "", _sql(), flags=re.MULTILINE)
    assert not re.search(r"\bDELETE\s+FROM\b", executable, flags=re.IGNORECASE)
    assert not re.search(r"\bTRUNCATE\b", executable, flags=re.IGNORECASE)
    assert not re.search(r"\bDROP\s+TABLE\b", executable, flags=re.IGNORECASE)


def test_all_required_fixture_keys_present() -> None:
    sql = _sql()
    for key in REQUIRED_FIXTURE_KEYS:
        assert f"'fixture_key', '{key}'" in sql or f'"fixture_key", "{key}"' in sql


def test_synthetic_marker_on_every_fixture() -> None:
    sql = _sql()
    assert sql.count("'synthetic', true") >= len(REQUIRED_FIXTURE_KEYS)


def test_deterministic_uuid_namespace() -> None:
    sql = _sql()
    assert "11111111-1111-4111-8111-111111111101" in sql
    assert "11111111-1111-4111-8111-111111111106" in sql
    assert sql.count("11111111-1111-4111-8111-1111111111") >= 6


def test_fake_phone_convention() -> None:
    sql = _sql()
    assert "+90555000101" in sql
    assert "+90555000106" in sql
    assert re.search(r"\+905550001\d{2}", sql)


def test_no_production_urls() -> None:
    sql = _sql().lower()
    assert "api.leylektag.com" not in sql
    assert "api.karekodteknoloji.com" not in sql
    assert "ujvploftywsxprlzejgc" not in sql
    assert "supabase.co" not in sql


def test_no_production_refs() -> None:
    sql = _sql().lower()
    for ref in PRODUCTION_REFS:
        assert ref not in sql


def test_no_real_pii_patterns() -> None:
    sql = _sql().lower()
    assert "iban" not in sql
    assert "national_id" not in sql
    assert "plate" not in sql


def test_no_auth_users_dependency() -> None:
    executable = re.sub(r"--.*$", "", _sql(), flags=re.MULTILINE).lower()
    assert "auth.users" not in executable


def test_pending_and_approved_states_seeded() -> None:
    sql = _sql()
    assert "'kyc_status', 'pending'" in sql or "'kyc_status', 'pending'" in sql.replace('"', "'")
    assert "'kyc_status', 'approved'" in sql


def test_stale_fixture_has_fixed_updated_at() -> None:
    sql = _sql()
    assert "'fixture_key', 'stale_pending'" in sql
    assert "2026-07-10T08:00:00+00:00" in sql


def test_no_grant_or_event_seed_rows() -> None:
    sql = _sql().lower()
    assert "kyc_document_access_grants" not in sql
    assert "kyc_document_access_events" not in sql
