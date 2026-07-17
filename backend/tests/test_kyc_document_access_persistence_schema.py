"""Phase 5B1 — static SQL contract tests for KYC document access grant persistence."""
from __future__ import annotations

import re
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from contracts import (  # noqa: E402
    enterprise_kyc_document_access_contract as access_5a,
    kyc_document_access_persistence_contract as persistence,
)

MIGRATION_PATH = BACKEND_DIR / "migrations" / "create_kyc_document_access_grants.sql"

PROHIBITED_COLUMN_NAMES = frozenset(
    {
        "grant_token",
        "raw_token",
        "access_token",
        "signed_url",
        "public_url",
        "document_url",
        "source_url",
        "bucket",
        "bucket_name",
        "object_path",
        "storage_path",
        "file_path",
        "document_bytes",
        "raw_document",
        "driver_details",
        "metadata",
        "full_name",
        "phone",
        "plate",
        "national_id",
        "email",
    }
)

PROHIBITED_PII_COLUMN_NAMES = frozenset(
    {"full_name", "phone", "plate", "national_id", "email"}
)

DESTRUCTIVE_SQL_PATTERNS = (
    r"\bDROP\s+TABLE\b",
    r"\bDROP\s+COLUMN\b",
    r"\bTRUNCATE\b",
    r"\bDELETE\s+FROM\b",
    r"\bALTER\s+TABLE\s+(?!public\.kyc_document_access_grants\b)[\w.]+\b",
)


def _migration_sql() -> str:
    assert MIGRATION_PATH.is_file(), f"migration missing: {MIGRATION_PATH}"
    return MIGRATION_PATH.read_text(encoding="utf-8")


def _create_table_blocks(sql: str) -> list[str]:
    return re.findall(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\((.*?)\);",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )


def _grants_table_body(sql: str) -> str:
    blocks = _create_table_blocks(sql)
    grants_blocks = [body for name, body in blocks if name.lower() == "kyc_document_access_grants"]
    assert len(grants_blocks) == 1, "expected exactly one kyc_document_access_grants CREATE TABLE"
    return grants_blocks[0]


def _column_names(table_body: str) -> set[str]:
    names: set[str] = set()
    for line in table_body.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("--"):
            continue
        if stripped.upper().startswith("CONSTRAINT "):
            continue
        match = re.match(r"^(\w+)\s+", stripped, flags=re.IGNORECASE)
        if match:
            names.add(match.group(1).lower())
    return names


def _executable_declarations(sql: str) -> str:
    """Strip line comments; keep executable DDL for semantic checks."""
    lines: list[str] = []
    for line in sql.splitlines():
        if "--" in line:
            line = line[: line.index("--")]
        lines.append(line)
    return "\n".join(lines)


def _index_predicates(sql: str) -> list[str]:
    return re.findall(
        r"CREATE\s+(?:UNIQUE\s+)?INDEX\b.*?WHERE\s+(.*?);",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_exactly_one_kyc_document_access_table() -> None:
    sql = _migration_sql()
    blocks = _create_table_blocks(sql)
    kyc_tables = [name for name, _ in blocks if "kyc_document_access" in name.lower()]
    assert kyc_tables == ["kyc_document_access_grants"]


def test_table_name_is_kyc_document_access_grants() -> None:
    sql = _migration_sql()
    assert re.search(
        r"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.kyc_document_access_grants\s*\(",
        sql,
        flags=re.IGNORECASE,
    )


def test_no_audit_or_event_table() -> None:
    sql = _migration_sql()
    assert "kyc_document_access_events" not in sql.lower()
    blocks = _create_table_blocks(sql)
    table_names = {name.lower() for name, _ in blocks}
    assert "kyc_document_access_events" not in table_names


def test_uuid_primary_key_exists() -> None:
    body = _grants_table_body(_migration_sql())
    assert re.search(
        r"\bid\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\s*\(\s*\)",
        body,
        flags=re.IGNORECASE,
    )


def test_grant_reference_hash_column_exists() -> None:
    assert "grant_reference_hash" in _column_names(_grants_table_body(_migration_sql()))


def test_no_raw_grant_token_column() -> None:
    columns = _column_names(_grants_table_body(_migration_sql()))
    assert "grant_token" not in columns
    assert "raw_token" not in columns
    assert "access_token" not in columns


def test_token_version_column_exists() -> None:
    assert "token_version" in _column_names(_grants_table_body(_migration_sql()))


def test_application_id_column_exists() -> None:
    assert "application_id" in _column_names(_grants_table_body(_migration_sql()))


def test_closed_document_type_check() -> None:
    body = _grants_table_body(_migration_sql())
    assert re.search(
        r"document_type\s+IN\s*\(\s*'license'\s*,\s*'vehicle_registration'\s*,\s*'selfie'\s*\)",
        body,
        flags=re.IGNORECASE,
    )


def test_closed_review_reason_check() -> None:
    body = _grants_table_body(_migration_sql())
    assert re.search(
        r"review_reason\s+IN\s*\(\s*'initial_review'\s*,\s*'recheck'\s*\)",
        body,
        flags=re.IGNORECASE,
    )


def test_closed_state_check() -> None:
    body = _grants_table_body(_migration_sql())
    assert re.search(
        r"state\s+IN\s*\(\s*'issued'\s*,\s*'redeemed'\s*,\s*'expired'\s*,\s*'revoked'\s*\)",
        body,
        flags=re.IGNORECASE,
    )


def test_ttl_check_bounds_60_to_120() -> None:
    body = _grants_table_body(_migration_sql())
    assert re.search(
        r"ttl_seconds\s*>=\s*60\s+AND\s+ttl_seconds\s*<=\s*120",
        body,
        flags=re.IGNORECASE,
    )


def test_actor_id_length_bounded_128() -> None:
    body = _grants_table_body(_migration_sql())
    assert re.search(
        r"char_length\s*\(\s*actor_admin_id\s*\)\s*<=\s*128",
        body,
        flags=re.IGNORECASE,
    )


def test_request_id_length_bounded_128() -> None:
    body = _grants_table_body(_migration_sql())
    assert re.search(
        r"char_length\s*\(\s*request_id\s*\)\s*<=\s*128",
        body,
        flags=re.IGNORECASE,
    )


def test_timestamp_consistency_checks_exist() -> None:
    body = _grants_table_body(_migration_sql())
    assert re.search(r"expires_at\s*>\s*issued_at", body, flags=re.IGNORECASE)
    assert re.search(
        r"state\s*<>\s*'redeemed'\s+OR\s+redeemed_at\s+IS\s+NOT\s+NULL",
        body,
        flags=re.IGNORECASE,
    )
    assert re.search(
        r"state\s*<>\s*'revoked'\s+OR\s+revoked_at\s+IS\s+NOT\s+NULL",
        body,
        flags=re.IGNORECASE,
    )
    assert re.search(
        r"NOT\s*\(\s*redeemed_at\s+IS\s+NOT\s+NULL\s+AND\s+revoked_at\s+IS\s+NOT\s+NULL\s*\)",
        body,
        flags=re.IGNORECASE,
    )
    assert re.search(
        r"state\s*<>\s*'issued'\s+OR\s*\(\s*redeemed_at\s+IS\s+NULL\s+AND\s+revoked_at\s+IS\s+NULL\s*\)",
        body,
        flags=re.IGNORECASE,
    )
    assert re.search(
        r"state\s*<>\s*'expired'\s+OR\s*\(\s*redeemed_at\s+IS\s+NULL\s+AND\s+revoked_at\s+NULL\s*\)",
        body,
        flags=re.IGNORECASE,
    ) or re.search(
        r"state\s*<>\s*'expired'\s+OR\s*\(\s*redeemed_at\s+IS\s+NULL\s+AND\s+revoked_at\s+IS\s+NULL\s*\)",
        body,
        flags=re.IGNORECASE,
    )


def test_unique_grant_hash_index_exists() -> None:
    sql = _migration_sql()
    assert re.search(
        r"CREATE\s+UNIQUE\s+INDEX\b.*?ON\s+public\.kyc_document_access_grants\s*\(\s*grant_reference_hash\s*\)",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_actor_request_idempotency_unique_index_exists() -> None:
    sql = _migration_sql()
    assert re.search(
        r"CREATE\s+UNIQUE\s+INDEX\b.*?ON\s+public\.kyc_document_access_grants\s*\(\s*actor_admin_id\s*,\s*request_id\s*\)",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_application_document_lookup_index_exists() -> None:
    sql = _migration_sql()
    assert re.search(
        r"CREATE\s+INDEX\b.*?ON\s+public\.kyc_document_access_grants\s*\(\s*application_id\s*,\s*document_type\s*,\s*issued_at\s+DESC\s*\)",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_actor_activity_index_exists() -> None:
    sql = _migration_sql()
    assert re.search(
        r"CREATE\s+INDEX\b.*?ON\s+public\.kyc_document_access_grants\s*\(\s*actor_admin_id\s*,\s*issued_at\s+DESC\s*\)",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_expiration_cleanup_index_exists() -> None:
    sql = _migration_sql()
    assert re.search(
        r"CREATE\s+INDEX\b.*?ON\s+public\.kyc_document_access_grants\s*\(\s*state\s*,\s*expires_at\s*\)",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_no_index_predicate_contains_now() -> None:
    sql = _migration_sql()
    for predicate in _index_predicates(sql):
        assert "now()" not in predicate.lower()


def test_no_partial_unique_active_grant_index_uses_time() -> None:
    sql = _migration_sql()
    partial_uniques = re.findall(
        r"CREATE\s+UNIQUE\s+INDEX\b.*?WHERE\s+(.*?);",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )
    for predicate in partial_uniques:
        lowered = predicate.lower()
        assert "expires_at" not in lowered
        assert "now()" not in lowered


def test_rls_enabled() -> None:
    sql = _migration_sql()
    assert re.search(
        r"ALTER\s+TABLE\s+public\.kyc_document_access_grants\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY",
        sql,
        flags=re.IGNORECASE,
    )


def test_no_anon_policy() -> None:
    sql = _migration_sql().lower()
    assert "create policy" not in sql or "to anon" not in sql
    assert not re.search(r"policy\b.*\bfor\s+anon\b", sql)


def test_no_authenticated_policy() -> None:
    sql = _migration_sql().lower()
    assert not re.search(r"policy\b.*\bfor\s+authenticated\b", sql)
    assert "to authenticated" not in sql


def test_no_rpc_or_function_created() -> None:
    sql = _migration_sql()
    assert not re.search(r"\bCREATE\s+(OR\s+REPLACE\s+)?FUNCTION\b", sql, flags=re.IGNORECASE)
    assert not re.search(r"\bCREATE\s+PROCEDURE\b", sql, flags=re.IGNORECASE)


def test_no_trigger_created() -> None:
    sql = _migration_sql()
    assert not re.search(r"\bCREATE\s+TRIGGER\b", sql, flags=re.IGNORECASE)


def test_no_route_or_runtime_code_referenced() -> None:
    sql = _migration_sql().lower()
    assert "server.py" not in sql
    assert "/api/" not in sql
    assert "fastapi" not in sql


def test_no_url_column_in_executable_ddl() -> None:
    columns = _column_names(_grants_table_body(_migration_sql()))
    url_like = {name for name in columns if "url" in name}
    assert not url_like


def test_no_bucket_or_path_column_in_executable_ddl() -> None:
    columns = _column_names(_grants_table_body(_migration_sql()))
    forbidden = columns & {"bucket", "bucket_name", "object_path", "storage_path", "file_path"}
    assert not forbidden


def test_no_bytes_or_blob_column_in_executable_ddl() -> None:
    columns = _column_names(_grants_table_body(_migration_sql()))
    forbidden = columns & {"document_bytes", "raw_document"}
    assert not forbidden


def test_no_json_or_jsonb_metadata_column() -> None:
    body = _grants_table_body(_migration_sql())
    assert not re.search(r"\bjsonb\b", body, flags=re.IGNORECASE)
    assert not re.search(r"\bjson\b", body, flags=re.IGNORECASE)
    assert "metadata" not in _column_names(body)


def test_no_pii_columns_in_executable_ddl() -> None:
    columns = _column_names(_grants_table_body(_migration_sql()))
    assert not (columns & PROHIBITED_PII_COLUMN_NAMES)


def test_no_destructive_sql() -> None:
    executable = _executable_declarations(_migration_sql())
    for pattern in DESTRUCTIVE_SQL_PATTERNS:
        assert not re.search(pattern, executable, flags=re.IGNORECASE)


def test_python_constants_mirror_sql_enums() -> None:
    assert persistence.KYC_DOCUMENT_ACCESS_GRANTS_TABLE == "kyc_document_access_grants"
    assert persistence.KYC_DOCUMENT_ACCESS_GRANT_STATES == access_5a.KYC_DOCUMENT_ACCESS_GRANT_STATES
    assert persistence.KYC_DOCUMENT_ACCESS_DOCUMENT_TYPES == access_5a.KYC_DOCUMENT_TYPES
    assert persistence.KYC_DOCUMENT_ACCESS_MIN_TTL_SECONDS == access_5a.KYC_DOCUMENT_ACCESS_MIN_TTL_SECONDS
    assert persistence.KYC_DOCUMENT_ACCESS_MAX_TTL_SECONDS == access_5a.KYC_DOCUMENT_ACCESS_MAX_TTL_SECONDS


def test_all_readiness_flags_remain_false() -> None:
    assert persistence.KYC_DOCUMENT_ACCESS_GRANT_PERSISTENCE_CONTRACT_DEFINED is True
    assert persistence.KYC_DOCUMENT_ACCESS_SCHEMA_READY is False
    assert persistence.KYC_DOCUMENT_ACCESS_AUDIT_READY is False
    assert persistence.KYC_DOCUMENT_ACCESS_RPC_READY is False
    assert persistence.KYC_DOCUMENT_ACCESS_RUNTIME_READY is False


def test_forbidden_persistence_columns_closed_set() -> None:
    assert persistence.KYC_DOCUMENT_ACCESS_FORBIDDEN_PERSISTENCE_COLUMNS == PROHIBITED_COLUMN_NAMES


def test_phase_5a_contract_tests_remain_importable() -> None:
    assert access_5a.document_access_runtime_ready() is False
    assert access_5a.KYC_DOCUMENT_ACCESS_MODE == "inline_preview"


def test_prohibited_terms_not_in_column_declarations() -> None:
    columns = _column_names(_grants_table_body(_migration_sql()))
    for forbidden in PROHIBITED_COLUMN_NAMES:
        assert forbidden not in columns
