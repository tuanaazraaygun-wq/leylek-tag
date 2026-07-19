"""Phase 5B4 — static SQL contract tests for KYC document access issue-grant RPC artifact."""
from __future__ import annotations

import re
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from contracts import kyc_document_access_rpc_contract as rpc  # noqa: E402

RPC_PATH = BACKEND_DIR / "migrations" / "create_kyc_document_access_issue_grant_rpc.sql"
GRANTS_PATH = BACKEND_DIR / "migrations" / "create_kyc_document_access_issue_grant_rpc_grants.sql"

FORBIDDEN_SQL_FRAGMENTS = (
    "create_signed_url",
    "get_public_url",
    "storage.from_",
    "returning v_document_url",
    "EXECUTE format",
    "EXECUTE IMMEDIATE",
)


def _rpc_sql() -> str:
    assert RPC_PATH.is_file(), f"missing rpc artifact: {RPC_PATH}"
    return RPC_PATH.read_text(encoding="utf-8")


def _grants_sql() -> str:
    assert GRANTS_PATH.is_file(), f"missing rpc grants artifact: {GRANTS_PATH}"
    return GRANTS_PATH.read_text(encoding="utf-8")


def _executable(sql: str) -> str:
    lines = []
    for line in sql.splitlines():
        if "--" in line:
            line = line[: line.index("--")]
        lines.append(line)
    return "\n".join(lines)


def test_exact_rpc_identity_exists_once() -> None:
    sql = _rpc_sql()
    matches = re.findall(
        r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.kyc_document_access_issue_grant\s*\(",
        sql,
        flags=re.IGNORECASE,
    )
    assert len(matches) == 1
    assert rpc.KYC_DOCUMENT_ACCESS_ISSUE_RPC_NAME == "kyc_document_access_issue_grant"


def test_fixed_search_path_exists() -> None:
    sql = _rpc_sql()
    assert re.search(r"SET\s+search_path\s*=\s*public\s*,\s*pg_temp", sql, flags=re.IGNORECASE)


def test_row_security_disabled() -> None:
    sql = _rpc_sql()
    assert re.search(r"SET\s+row_security\s*=\s*off", sql, flags=re.IGNORECASE)


def test_function_owned_by_postgres() -> None:
    sql = _rpc_sql()
    assert re.search(
        r"ALTER\s+FUNCTION\s+public\.kyc_document_access_issue_grant\s*\(",
        sql,
        flags=re.IGNORECASE,
    )
    assert re.search(r"OWNER\s+TO\s+postgres", sql, flags=re.IGNORECASE)


def test_insert_returning_uses_target_table_alias() -> None:
    sql = _rpc_sql()
    assert "INSERT INTO public.kyc_document_access_grants AS g" in sql
    assert re.search(
        r"RETURNING\s+g\.id\s*,\s*g\.issued_at\s*,\s*g\.state",
        sql,
        flags=re.IGNORECASE,
    )
    assert "RETURNING id, issued_at, state" not in sql


def test_staging_diagnostics_on_unhandled_exception() -> None:
    sql = _rpc_sql()
    assert "GET STACKED DIAGNOSTICS" in sql
    assert "RETURNED_SQLSTATE" in sql
    assert "MESSAGE_TEXT" in sql
    assert re.search(r"RAISE\s+LOG", sql, flags=re.IGNORECASE)
    assert "outcome_code := 'audit_unavailable'" in sql


def test_security_definer_posture() -> None:
    sql = _rpc_sql()
    assert re.search(r"SECURITY\s+DEFINER", sql, flags=re.IGNORECASE)
    assert "public.kyc_document_access_grants" in sql
    assert "public.kyc_document_access_events" in sql
    assert "public.users" in sql


def test_no_dynamic_sql() -> None:
    sql = _executable(_rpc_sql()).lower()
    assert "execute format" not in sql
    assert "execute immediate" not in sql
    assert "execute (" not in sql


def test_no_public_execute_grant_in_rpc_artifact() -> None:
    sql = _grants_sql()
    assert "GRANT EXECUTE" in sql
    assert "TO service_role" in sql
    assert "TO anon" not in sql.upper().replace("REVOKE", "")
    assert "TO authenticated" not in sql.upper().replace("REVOKE", "")


def test_service_role_only_documented() -> None:
    sql = _grants_sql()
    assert "service_role" in sql
    assert "service_role only" in sql.lower() or "service_role EXECUTE" in sql


def test_required_outcomes_present() -> None:
    sql = _rpc_sql()
    rpc_outcomes = tuple(
        outcome for outcome in rpc.KYC_DOCUMENT_ACCESS_ISSUE_OUTCOMES if outcome != "rate_limited"
    )
    for outcome in rpc_outcomes:
        assert f"'{outcome}'" in sql
    for legacy in ("validation_failed", "invalid_transition", "rate_limited"):
        assert legacy not in sql
    assert "outcome_code := 'unavailable'" not in sql


def test_record_version_stale_guard() -> None:
    sql = _rpc_sql()
    assert "record_version_stale" in sql
    assert "IS DISTINCT FROM p_application_record_version" in sql


def test_ttl_server_controlled() -> None:
    sql = _rpc_sql()
    assert re.search(r"p_ttl_seconds\s*<\s*60", sql)
    assert re.search(r"p_ttl_seconds\s*>\s*120", sql)


def test_atomic_grant_and_audit_insertion() -> None:
    sql = _rpc_sql()
    assert "INSERT INTO public.kyc_document_access_grants" in sql
    assert "INSERT INTO public.kyc_document_access_events" in sql
    assert sql.count("INSERT INTO public.kyc_document_access_events") >= 2
    assert "audit_unavailable" in sql


def test_idempotency_actor_request_lookup() -> None:
    sql = _rpc_sql()
    assert "actor_admin_id = trim(p_actor_admin_id)" in sql
    assert "request_id = trim(p_request_id)" in sql
    assert "duplicate_request" in sql
    assert "request_conflict" in sql


def test_no_raw_url_or_source_emitted() -> None:
    sql = _executable(_rpc_sql()).lower()
    for fragment in FORBIDDEN_SQL_FRAGMENTS:
        assert fragment.lower() not in sql


def test_no_plaintext_grant_token_persisted() -> None:
    sql = _rpc_sql().lower()
    assert "grant_token" not in sql
    assert "raw_token" not in sql
    assert "p_grant_reference_hash" in sql


def test_no_production_ref_or_credential() -> None:
    combined = (_rpc_sql() + _grants_sql()).lower()
    assert "supabase.co" not in combined
    assert "service_role_key" not in combined
    assert "eyj" not in combined


def test_revoke_public_in_rpc_artifact() -> None:
    sql = _rpc_sql()
    assert "REVOKE ALL ON FUNCTION public.kyc_document_access_issue_grant" in sql
