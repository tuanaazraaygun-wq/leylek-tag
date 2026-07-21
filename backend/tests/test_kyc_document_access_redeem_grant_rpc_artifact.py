"""Phase D7-B1 — static SQL contract tests for KYC document access redeem-grant RPC artifact."""
from __future__ import annotations

import re
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from contracts import kyc_document_access_rpc_contract as rpc  # noqa: E402

RPC_PATH = BACKEND_DIR / "migrations" / "create_kyc_document_access_redeem_grant_rpc.sql"
GRANTS_PATH = BACKEND_DIR / "migrations" / "create_kyc_document_access_redeem_grant_rpc_grants.sql"
FORWARD_FIX_PATH = (
    BACKEND_DIR / "migrations" / "forward_fix_kyc_document_access_redeem_grant_pgcrypto_qualification.sql"
)

FORBIDDEN_SQL_FRAGMENTS = (
    "create_signed_url",
    "get_public_url",
    "storage.from_",
    "preview_handle",
    "preview_capability",
    "EXECUTE format",
    "EXECUTE IMMEDIATE",
    "server.py",
    "/api/",
    "fastapi",
)


def _rpc_sql() -> str:
    assert RPC_PATH.is_file(), f"missing rpc artifact: {RPC_PATH}"
    return RPC_PATH.read_text(encoding="utf-8")


def _grants_sql() -> str:
    assert GRANTS_PATH.is_file(), f"missing rpc grants artifact: {GRANTS_PATH}"
    return GRANTS_PATH.read_text(encoding="utf-8")


def _forward_fix_sql() -> str:
    assert FORWARD_FIX_PATH.is_file(), f"missing forward-fix artifact: {FORWARD_FIX_PATH}"
    return FORWARD_FIX_PATH.read_text(encoding="utf-8")


def _function_body(sql: str) -> str:
    match = re.search(r"AS \$\$(.*)\$\$;", sql, flags=re.DOTALL)
    assert match is not None, "expected plpgsql function body"
    return match.group(1)


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
        r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.kyc_document_access_redeem_grant\s*\(",
        sql,
        flags=re.IGNORECASE,
    )
    assert len(matches) == 1
    assert rpc.KYC_DOCUMENT_ACCESS_REDEEM_RPC_NAME == "kyc_document_access_redeem_grant"


def test_exact_six_input_signature() -> None:
    sql = _rpc_sql()
    for input_name in rpc.KYC_DOCUMENT_ACCESS_REDEEM_RPC_INPUT_NAMES:
        assert input_name in sql
    assert "p_observed_source_binding_hash" in sql
    assert "p_observed_application_record_version timestamptz" in sql


def test_exact_output_fields() -> None:
    sql = _rpc_sql()
    for field in rpc.KYC_DOCUMENT_ACCESS_REDEEM_RPC_OUTPUT_FIELDS:
        assert re.search(rf"\b{re.escape(field)}\b", sql)


def test_security_definer_posture() -> None:
    sql = _rpc_sql()
    assert re.search(r"SECURITY\s+DEFINER", sql, flags=re.IGNORECASE)
    assert "public.kyc_document_access_grants" in sql
    assert "public.kyc_document_access_events" in sql
    assert "public.kyc_document_access_redemption_commands" in sql
    assert "public.users" in sql


def test_fixed_search_path_exists() -> None:
    sql = _rpc_sql()
    assert re.search(r"SET\s+search_path\s*=\s*public\s*,\s*pg_temp", sql, flags=re.IGNORECASE)


def test_row_security_disabled() -> None:
    sql = _rpc_sql()
    assert re.search(r"SET\s+row_security\s*=\s*off", sql, flags=re.IGNORECASE)


def test_function_owned_by_postgres() -> None:
    sql = _rpc_sql()
    assert re.search(
        r"ALTER\s+FUNCTION\s+public\.kyc_document_access_redeem_grant\s*\(",
        sql,
        flags=re.IGNORECASE,
    )
    assert re.search(r"OWNER\s+TO\s+postgres", sql, flags=re.IGNORECASE)


def test_revoke_public_in_rpc_artifact() -> None:
    sql = _rpc_sql()
    assert "REVOKE ALL ON FUNCTION public.kyc_document_access_redeem_grant" in sql


def test_no_dynamic_sql() -> None:
    sql = _executable(_rpc_sql()).lower()
    assert "execute format" not in sql
    assert "execute immediate" not in sql
    assert "execute (" not in sql


def test_hash_validations_present() -> None:
    sql = _rpc_sql()
    assert re.search(r"p_grant_reference_hash\s*!~\s*'\^\[0-9a-f\]\{64\}\$'", sql)
    assert re.search(r"p_observed_source_binding_hash\s*!~\s*'\^\[0-9a-f\]\{64\}\$'", sql)


def test_actor_request_source_validation() -> None:
    sql = _rpc_sql()
    assert "char_length(trim(p_actor_admin_id))" in sql
    assert "char_length(trim(p_request_id))" in sql
    assert "p_source_channel NOT IN ('enterprise_bff', 'leylek_internal')" in sql
    assert "p_observed_application_record_version IS NULL" in sql


def test_grant_for_update_lock() -> None:
    sql = _rpc_sql()
    assert re.search(
        r"FROM\s+public\.kyc_document_access_grants\s+AS\s+g\s+.*?FOR\s+UPDATE",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_users_for_update_lock() -> None:
    sql = _rpc_sql()
    assert re.search(
        r"FROM\s+public\.users\s+AS\s+u\s+.*?FOR\s+UPDATE",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_ledger_for_update_and_uniqueness() -> None:
    sql = _rpc_sql()
    assert (
        "ON CONFLICT ON CONSTRAINT uq_kdarc_grant_actor_request DO NOTHING" in sql
    )
    ledger_insert = re.search(
        r"INSERT\s+INTO\s+public\.kyc_document_access_redemption_commands\s*\((.*?)\)\s*SELECT\s+(.*?)\s*ON\s+CONFLICT",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )
    assert ledger_insert is not None
    columns = [part.strip() for part in ledger_insert.group(1).split(",")]
    assert columns == [
        "grant_id",
        "actor_admin_id",
        "request_id",
        "source_channel",
        "request_fingerprint",
        "status",
    ]
    values_block = ledger_insert.group(2)
    assert "v_grant.id" in values_block
    assert "trim(p_actor_admin_id)" in values_block
    assert "trim(p_request_id)" in values_block
    assert "p_source_channel" in values_block
    assert "v_fingerprint" in values_block
    assert "'pending'" in values_block
    assert re.search(
        r"FROM\s+public\.kyc_document_access_redemption_commands\s+AS\s+cmd\s+.*?FOR\s+UPDATE",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )
    assert "request_fingerprint" in sql
    assert "extensions.digest(" in sql
    assert not re.search(r"(?<!extensions\.)digest\s*\(", sql)


def test_forward_fix_artifact_exists_and_is_function_only() -> None:
    sql = _forward_fix_sql()
    preamble = _executable(sql.split("AS $$", 1)[0])
    assert re.search(
        r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.kyc_document_access_redeem_grant\s*\(",
        sql,
        flags=re.IGNORECASE,
    )
    assert "extensions.digest(" in sql
    assert not re.search(r"(?<!extensions\.)digest\s*\(", sql)
    assert re.search(r"SET\s+search_path\s*=\s*public\s*,\s*pg_temp", sql, flags=re.IGNORECASE)
    assert "row_security = off" in sql
    assert "SECURITY DEFINER" in sql
    assert "#variable_conflict use_column" in sql
    assert "p_observed_application_record_version timestamptz" in sql
    assert sql.rstrip().endswith("$$;")
    for forbidden in (
        r"\bCREATE\s+TABLE\b",
        r"\bALTER\s+TABLE\b",
        r"\bDROP\s+TABLE\b",
        r"\bCREATE\s+EXTENSION\b",
        r"\bALTER\s+EXTENSION\b",
        r"\bGRANT\b",
        r"\bREVOKE\b",
        r"\bINSERT\b",
        r"\bUPDATE\b",
        r"\bDELETE\b",
        r"\bTRUNCATE\b",
    ):
        assert not re.search(forbidden, preamble, flags=re.IGNORECASE), forbidden


def test_forward_fix_body_matches_canonical_rpc_body() -> None:
    canonical_body = _function_body(_rpc_sql())
    forward_body = _function_body(_forward_fix_sql())
    assert canonical_body == forward_body


def test_expiry_uses_greater_than_or_equal_now() -> None:
    sql = _rpc_sql()
    assert "v_now >= v_grant.expires_at" in sql


def test_completed_ledger_replay_without_second_audit() -> None:
    sql = _rpc_sql()
    assert "IF v_ledger.status = 'completed' THEN" in sql
    completed_block = re.search(
        r"IF v_ledger.status = 'completed' THEN.*?RETURN;\s*END IF;",
        sql,
        flags=re.DOTALL,
    )
    assert completed_block is not None
    assert "INSERT INTO public.kyc_document_access_events" not in completed_block.group(0)


def test_exactly_one_success_transition_and_audit() -> None:
    sql = _rpc_sql()
    assert "SET state = 'redeemed'" in sql
    assert "'kyc.document.redeemed'" in sql
    assert sql.count("'kyc.document.redeemed'") == 1


def test_required_outcomes_present() -> None:
    sql = _rpc_sql()
    for outcome in rpc.KYC_DOCUMENT_ACCESS_REDEEM_OUTCOMES:
        assert f"'{outcome}'" in sql


def test_source_binding_mismatch_collapsed() -> None:
    sql = _rpc_sql()
    assert "source_binding_mismatch" in sql
    assert "v_outcome_code := 'not_found_or_unauthorized'" in sql
    assert "invalid_source_reference" in sql


def test_audit_failure_rolls_back_via_exception() -> None:
    sql = _rpc_sql()
    assert "v_outcome_code := 'audit_unavailable'" in sql
    assert "outcome_code := v_outcome_code" in sql
    assert "GET STACKED DIAGNOSTICS" in sql


def _function_body(sql: str) -> str:
    match = re.search(r"AS\s+\$\$(.*)\$\$\s*;", sql, flags=re.IGNORECASE | re.DOTALL)
    assert match is not None, "missing plpgsql function body"
    return match.group(1)


def test_ambiguity_safety_internal_result_buffers() -> None:
    body = _function_body(_rpc_sql())
    for name in (
        "v_outcome_code",
        "v_out_grant_id",
        "v_out_application_id",
        "v_out_document_type",
        "v_out_state",
        "v_out_redeemed_at",
        "v_out_source_binding_hash",
        "v_out_application_record_version",
    ):
        assert re.search(rf"\b{name}\b", body)


def test_ambiguity_safety_no_returning_into_public_outputs() -> None:
    body = _function_body(_rpc_sql())
    assert not re.search(
        r"RETURNING\s+.*?INTO\s+(?:grant_id|application_id|document_type|state|"
        r"redeemed_at|source_binding_hash|application_record_version)\b",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_ambiguity_safety_function_level_variable_conflict_directive() -> None:
    body = _function_body(_rpc_sql())
    assert body.lstrip().lower().startswith("#variable_conflict use_column")
    main_block = body.split("BEGIN", 1)[1] if "BEGIN" in body else body
    assert not main_block.lstrip().lower().startswith("#variable_conflict")
    assert body.lower().count("#variable_conflict") == 1


def test_explicit_event_insert_target_columns() -> None:
    body = _function_body(_rpc_sql())
    event_inserts = re.findall(
        r"INSERT\s+INTO\s+public\.kyc_document_access_events\s*\((.*?)\)\s*SELECT",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )
    assert len(event_inserts) == 3
    expected_columns = [
        "event_type",
        "actor_admin_id",
        "application_id",
        "document_type",
        "request_id",
        "grant_id",
        "grant_reference_hash",
        "review_reason",
        "result",
        "reason_code",
        "source_channel",
    ]
    for column_block in event_inserts:
        columns = [part.strip() for part in column_block.split(",")]
        assert columns == expected_columns
        assert "id" not in columns
        assert "occurred_at" not in columns

    assert "'kyc.document.view_failed'" in body
    assert "'kyc.document.grant_expired'" in body
    assert body.count("'kyc.document.redeemed'") == 1


def test_ambiguity_safety_ledger_and_audit_use_internal_buffers() -> None:
    body = _function_body(_rpc_sql())
    ledger_sets = re.findall(
        r"UPDATE\s+public\.kyc_document_access_redemption_commands\s+AS\s+cmd\s+SET\s+(.*?)\s+WHERE",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )
    assert ledger_sets
    for block in ledger_sets:
        assert not re.search(
            r"=\s*(?:grant_id|application_id|document_type|state|redeemed_at|"
            r"source_binding_hash|application_record_version)\b",
            block,
        )
        if "result_grant_id" in block:
            assert "v_out_grant_id" in block or "v_grant.id" in block

    audit_values = re.findall(
        r"INSERT\s+INTO\s+public\.kyc_document_access_events\s*\((.*?)\)\s*SELECT\s+(.*?)\s*;",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )
    assert audit_values
    for _cols, values in audit_values:
        assert not re.search(
            r"(?<![.\w])(?:grant_id|application_id|document_type|state|redeemed_at|"
            r"source_binding_hash|application_record_version)(?![\w])",
            values,
        )


def test_ambiguity_safety_colliding_columns_alias_qualified() -> None:
    body = _function_body(_rpc_sql())
    assert "AS g" in body
    assert "AS cmd" in body
    assert "AS u" in body
    assert re.search(r"\bg\.state\b", body)
    assert re.search(r"\bg\.application_id\b", body)
    assert re.search(r"\bg\.document_type\b", body)
    assert re.search(r"\bg\.source_binding_hash\b", body)
    assert re.search(r"\bg\.application_record_version\b", body)
    assert re.search(r"\bg\.redeemed_at\b", body)
    assert re.search(r"\bcmd\.grant_id\b", body)
    assert re.search(r"\bcmd\.status\b", body)


def test_fingerprint_completed_guard_before_destructive_mismatch() -> None:
    body = _function_body(_rpc_sql())
    mismatch = body.find("v_ledger.request_fingerprint <> v_fingerprint")
    completed_guard = body.find("v_ledger.status = 'completed'", mismatch)
    destructive = body.find("failure_reason_code = 'idempotency_mismatch'", mismatch)
    assert mismatch != -1
    assert completed_guard != -1
    assert destructive != -1
    assert completed_guard < destructive
    assert "AND cmd.status <> 'completed'" in body


def test_audit_atomicity_success_and_expiry_units() -> None:
    body = _function_body(_rpc_sql())
    assert "SET state = 'redeemed'" in body
    assert "'kyc.document.redeemed'" in body
    assert "terminal_outcome_code = 'audit_unavailable'" in body
    assert "failure_reason_code = 'audit_unavailable'" not in body
    assert "failure_reason_code = NULL" in body
    assert "AND cmd.status = 'pending'" in body
    success_unit = re.search(
        r"SET\s+state\s*=\s*'redeemed'.*?EXCEPTION\s+WHEN\s+OTHERS\s+THEN.*?audit_unavailable",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )
    assert success_unit is not None
    assert "INSERT INTO public.kyc_document_access_events" in success_unit.group(0)
    assert "terminal_outcome_code = 'redeemed'" in success_unit.group(0)
    expiry_unit = re.search(
        r"SET\s+state\s*=\s*'expired'.*?EXCEPTION\s+WHEN\s+OTHERS\s+THEN.*?audit_unavailable",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )
    assert expiry_unit is not None
    assert "'kyc.document.grant_expired'" in expiry_unit.group(0)


def test_no_raw_bearer_output() -> None:
    sql = _executable(_rpc_sql()).lower()
    assert "grant_token" not in sql
    assert "raw_token" not in sql
    assert "access_grant_id" not in sql


def test_no_storage_url_path_bytes_output() -> None:
    combined = (_rpc_sql() + _grants_sql()).lower()
    for fragment in FORBIDDEN_SQL_FRAGMENTS:
        assert fragment.lower() not in combined


def test_no_preview_handling() -> None:
    sql = _executable(_rpc_sql()).lower()
    assert "preview" not in sql


def test_no_staging_production_identifiers() -> None:
    combined = (_rpc_sql() + _grants_sql()).lower()
    assert "supabase.co" not in combined
    assert "service_role_key" not in combined
    assert "eyj" not in combined


def test_no_destructive_sql() -> None:
    executable = _executable(_rpc_sql() + _grants_sql())
    assert not re.search(r"\bDROP\s+TABLE\b", executable, flags=re.IGNORECASE)
    assert not re.search(r"\bTRUNCATE\b", executable, flags=re.IGNORECASE)


def test_service_role_only_execute_grant() -> None:
    sql = _grants_sql()
    assert "GRANT EXECUTE" in sql
    assert "TO service_role" in sql
    assert re.search(
        r"REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.kyc_document_access_redeem_grant",
        sql,
        flags=re.IGNORECASE,
    )


def test_grants_use_exact_six_input_signature() -> None:
    sql = _grants_sql()
    assert "text,\n  text,\n  text,\n  text,\n  text,\n  timestamptz" in sql
