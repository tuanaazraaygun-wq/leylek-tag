"""Phase 5B2 — static SQL contract tests for KYC document access audit persistence."""
from __future__ import annotations

import re
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from contracts import (  # noqa: E402
    enterprise_kyc_document_access_contract as access_5a,
    kyc_document_access_audit_persistence_contract as audit,
)

AUDIT_MIGRATION_PATH = BACKEND_DIR / "migrations" / "create_kyc_document_access_events.sql"
GRANTS_MIGRATION_PATH = BACKEND_DIR / "migrations" / "create_kyc_document_access_grants.sql"

PROHIBITED_COLUMN_NAMES = frozenset(
    {
        "raw_grant_id",
        "grant_token",
        "raw_token",
        "access_token",
        "signed_url",
        "public_url",
        "document_url",
        "source_url",
        "provider_url",
        "redemption_url",
        "bucket",
        "bucket_name",
        "object_path",
        "storage_path",
        "storage_key",
        "file_path",
        "document_bytes",
        "raw_document",
        "authorization",
        "bearer",
        "jwt",
        "metadata",
        "payload",
        "raw_row",
        "driver_details",
        "full_name",
        "name",
        "phone",
        "plate",
        "email",
        "national_id",
        "ip_address",
        "raw_ip",
    }
)

PROHIBITED_PII_COLUMN_NAMES = frozenset(
    {"full_name", "name", "phone", "plate", "email", "national_id", "ip_address", "raw_ip"}
)

DESTRUCTIVE_SQL_PATTERNS = (
    r"\bDROP\s+TABLE\b",
    r"\bDROP\s+COLUMN\b",
    r"\bTRUNCATE\b",
    r"\bDELETE\s+FROM\b",
    r"\bALTER\s+TABLE\s+(?!public\.kyc_document_access_events\b)[\w.]+\b",
)


def _audit_sql() -> str:
    assert AUDIT_MIGRATION_PATH.is_file(), f"migration missing: {AUDIT_MIGRATION_PATH}"
    return AUDIT_MIGRATION_PATH.read_text(encoding="utf-8")


def _grants_sql() -> str:
    assert GRANTS_MIGRATION_PATH.is_file(), f"migration missing: {GRANTS_MIGRATION_PATH}"
    return GRANTS_MIGRATION_PATH.read_text(encoding="utf-8")


def _create_table_blocks(sql: str) -> list[tuple[str, str]]:
    return re.findall(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\((.*?)\);",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )


def _events_table_body(sql: str) -> str:
    blocks = _create_table_blocks(sql)
    event_blocks = [body for name, body in blocks if name.lower() == "kyc_document_access_events"]
    assert len(event_blocks) == 1, "expected exactly one kyc_document_access_events CREATE TABLE"
    return event_blocks[0]


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


def test_exactly_one_audit_table_created() -> None:
    sql = _audit_sql()
    blocks = _create_table_blocks(sql)
    kyc_tables = [name for name, _ in blocks if "kyc_document_access" in name.lower()]
    assert kyc_tables == ["kyc_document_access_events"]


def test_table_name_is_kyc_document_access_events() -> None:
    sql = _audit_sql()
    assert re.search(
        r"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.kyc_document_access_events\s*\(",
        sql,
        flags=re.IGNORECASE,
    )


def test_grant_table_not_recreated() -> None:
    sql = _audit_sql()
    blocks = _create_table_blocks(sql)
    table_names = {name.lower() for name, _ in blocks}
    assert "kyc_document_access_grants" not in table_names


def test_grant_migration_not_altered() -> None:
    grants = _grants_sql()
    assert "kyc_document_access_grants" in grants
    assert "kyc_document_access_events" not in grants


def test_closed_seven_value_event_type_check() -> None:
    body = _events_table_body(_audit_sql())
    for event in audit.KYC_DOCUMENT_ACCESS_AUDIT_EVENT_TYPES:
        assert event in body
    assert body.count("kyc.document.access_requested") >= 1


def test_closed_three_value_document_type_check() -> None:
    body = _events_table_body(_audit_sql())
    assert re.search(
        r"document_type\s+IN\s*\(\s*'license'\s*,\s*'vehicle_registration'\s*,\s*'selfie'\s*\)",
        body,
        flags=re.IGNORECASE,
    )


def test_closed_review_reason_check() -> None:
    body = _events_table_body(_audit_sql())
    assert re.search(
        r"review_reason\s+IS\s+NULL\s+OR\s+review_reason\s+IN\s*\(\s*'initial_review'\s*,\s*'recheck'\s*\)",
        body,
        flags=re.IGNORECASE,
    )


def test_closed_four_value_result_check() -> None:
    body = _events_table_body(_audit_sql())
    assert re.search(
        r"result\s+IN\s*\(\s*'allowed'\s*,\s*'denied'\s*,\s*'viewed'\s*,\s*'unavailable'\s*\)",
        body,
        flags=re.IGNORECASE,
    )


def test_closed_reason_code_union_exists() -> None:
    body = _events_table_body(_audit_sql())
    for code in audit.KYC_DOCUMENT_ACCESS_AUDIT_REASON_CODES:
        assert f"'{code}'" in body
    for code in access_5a.KYC_DOCUMENT_ACCESS_DENIED_REASONS:
        assert f"'{code}'" in body
    for code in access_5a.KYC_DOCUMENT_ACCESS_UNAVAILABLE_REASONS:
        assert f"'{code}'" in body


def test_closed_source_channel_check() -> None:
    body = _events_table_body(_audit_sql())
    assert re.search(
        r"source_channel\s+IN\s*\(\s*'enterprise_bff'\s*,\s*'leylek_internal'\s*\)",
        body,
        flags=re.IGNORECASE,
    )


def test_actor_admin_id_bounded_1_to_128() -> None:
    body = _events_table_body(_audit_sql())
    assert re.search(
        r"char_length\s*\(\s*actor_admin_id\s*\)\s*>\s*0",
        body,
        flags=re.IGNORECASE,
    )
    assert re.search(
        r"char_length\s*\(\s*actor_admin_id\s*\)\s*<=\s*128",
        body,
        flags=re.IGNORECASE,
    )


def test_request_id_bounded_1_to_128() -> None:
    body = _events_table_body(_audit_sql())
    assert re.search(
        r"char_length\s*\(\s*request_id\s*\)\s*>\s*0",
        body,
        flags=re.IGNORECASE,
    )
    assert re.search(
        r"char_length\s*\(\s*request_id\s*\)\s*<=\s*128",
        body,
        flags=re.IGNORECASE,
    )


def test_application_id_is_uuid() -> None:
    body = _events_table_body(_audit_sql())
    assert re.search(r"\bapplication_id\s+uuid\s+NOT\s+NULL\b", body, flags=re.IGNORECASE)


def test_application_fk_on_delete_restrict() -> None:
    body = _events_table_body(_audit_sql())
    assert re.search(
        r"application_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+public\.users\s*\(\s*id\s*\)\s+ON\s+DELETE\s+RESTRICT",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_grant_id_nullable_uuid() -> None:
    body = _events_table_body(_audit_sql())
    assert re.search(r"\bgrant_id\s+uuid\s+NULL\b", body, flags=re.IGNORECASE)


def test_grant_id_fk_on_delete_set_null() -> None:
    body = _events_table_body(_audit_sql())
    assert re.search(
        r"grant_id\s+uuid\s+NULL\s+REFERENCES\s+public\.kyc_document_access_grants\s*\(\s*id\s*\)\s+ON\s+DELETE\s+SET\s+NULL",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_grant_reference_hash_nullable() -> None:
    body = _events_table_body(_audit_sql())
    assert re.search(r"\bgrant_reference_hash\s+text\s+NULL\b", body, flags=re.IGNORECASE)


def test_grant_lifecycle_events_require_grant_hash() -> None:
    body = _events_table_body(_audit_sql())
    assert re.search(
        r"event_type\s+NOT\s+IN\s*\(\s*"
        r"'kyc\.document\.grant_issued'\s*,\s*"
        r"'kyc\.document\.redeemed'\s*,\s*"
        r"'kyc\.document\.grant_expired'\s*,\s*"
        r"'kyc\.document\.grant_revoked'\s*\)\s+"
        r"OR\s+grant_reference_hash\s+IS\s+NOT\s+NULL",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_requested_and_issued_require_review_reason() -> None:
    body = _events_table_body(_audit_sql())
    assert re.search(
        r"event_type\s+NOT\s+IN\s*\(\s*'kyc\.document\.access_requested'\s*,\s*'kyc\.document\.grant_issued'\s*\)\s+"
        r"OR\s+review_reason\s+IS\s+NOT\s+NULL",
        body,
        flags=re.IGNORECASE,
    )


def test_denied_result_requires_reason_code() -> None:
    body = _events_table_body(_audit_sql())
    assert re.search(
        r"result\s*<>\s*'denied'\s+OR\s+reason_code\s+IS\s+NOT\s+NULL",
        body,
        flags=re.IGNORECASE,
    )


def test_unavailable_result_requires_reason_code() -> None:
    body = _events_table_body(_audit_sql())
    assert re.search(
        r"result\s*<>\s*'unavailable'\s+OR\s+reason_code\s+IS\s+NOT\s+NULL",
        body,
        flags=re.IGNORECASE,
    )


def test_allowed_and_viewed_forbid_reason_code() -> None:
    body = _events_table_body(_audit_sql())
    assert re.search(
        r"result\s+NOT\s+IN\s*\(\s*'allowed'\s*,\s*'viewed'\s*\)\s+OR\s+reason_code\s+IS\s+NULL",
        body,
        flags=re.IGNORECASE,
    )


def test_occurred_at_timestamptz_default_now() -> None:
    body = _events_table_body(_audit_sql())
    assert re.search(
        r"\boccurred_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\s*\(\s*\)",
        body,
        flags=re.IGNORECASE,
    )


def test_no_separate_created_at() -> None:
    columns = _column_names(_events_table_body(_audit_sql()))
    assert "created_at" not in columns


def test_rls_enabled() -> None:
    sql = _audit_sql()
    assert re.search(
        r"ALTER\s+TABLE\s+public\.kyc_document_access_events\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY",
        sql,
        flags=re.IGNORECASE,
    )


def test_no_anon_policy() -> None:
    sql = _audit_sql().lower()
    assert not re.search(r"create\s+policy\b.*\bfor\s+anon\b", sql)
    assert "to anon" not in sql


def test_no_authenticated_policy() -> None:
    sql = _audit_sql().lower()
    assert not re.search(r"create\s+policy\b.*\bfor\s+authenticated\b", sql)
    assert "to authenticated" not in sql


def test_public_privilege_revoked() -> None:
    sql = _audit_sql()
    assert re.search(
        r"REVOKE\s+ALL\s+ON\s+public\.kyc_document_access_events\s+FROM\s+PUBLIC",
        sql,
        flags=re.IGNORECASE,
    )


def test_anon_privilege_revoked() -> None:
    sql = _audit_sql()
    assert re.search(
        r"REVOKE\s+ALL\s+ON\s+public\.kyc_document_access_events\s+FROM\s+anon",
        sql,
        flags=re.IGNORECASE,
    )


def test_authenticated_privilege_revoked() -> None:
    sql = _audit_sql()
    assert re.search(
        r"REVOKE\s+ALL\s+ON\s+public\.kyc_document_access_events\s+FROM\s+authenticated",
        sql,
        flags=re.IGNORECASE,
    )


def test_append_only_trigger_function_exists() -> None:
    sql = _audit_sql()
    assert re.search(
        r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.kyc_document_access_events_deny_mutation\s*\(\s*\)",
        sql,
        flags=re.IGNORECASE,
    )


def test_trigger_blocks_update() -> None:
    sql = _audit_sql()
    assert re.search(
        r"CREATE\s+TRIGGER\s+kyc_document_access_events_deny_mutation\s+"
        r"BEFORE\s+UPDATE\s+OR\s+DELETE",
        sql,
        flags=re.IGNORECASE,
    )


def test_trigger_blocks_delete() -> None:
    sql = _audit_sql()
    assert re.search(
        r"BEFORE\s+UPDATE\s+OR\s+DELETE\s+ON\s+public\.kyc_document_access_events",
        sql,
        flags=re.IGNORECASE,
    )


def test_function_raises_append_only_violation() -> None:
    sql = _audit_sql()
    assert re.search(
        r"RAISE\s+EXCEPTION\s+'append_only_violation'",
        sql,
        flags=re.IGNORECASE,
    )


def test_sqlstate_p0001_used() -> None:
    sql = _audit_sql()
    assert re.search(r"USING\s+ERRCODE\s*=\s*'P0001'", sql, flags=re.IGNORECASE)


def test_no_role_based_bypass_in_trigger_function() -> None:
    fn_body = re.search(
        r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.kyc_document_access_events_deny_mutation.*?END;\s*\$\$;",
        _audit_sql(),
        flags=re.IGNORECASE | re.DOTALL,
    )
    assert fn_body is not None
    body = fn_body.group(0).lower()
    assert "current_user" not in body
    assert "session_user" not in body
    assert "service_role" not in body
    assert "if " not in body.replace("raise exception", "")


def test_trigger_applies_regardless_of_service_role() -> None:
    sql = _audit_sql()
    assert "BEFORE UPDATE OR DELETE" in sql.upper().replace("\n", " ")
    fn = re.search(
        r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.kyc_document_access_events_deny_mutation.*?END;\s*\$\$;",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )
    assert fn is not None
    assert "service_role" not in fn.group(0).lower()


def test_no_rpc_other_than_append_only_function() -> None:
    sql = _executable_declarations(_audit_sql())
    functions = re.findall(
        r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.(\w+)",
        sql,
        flags=re.IGNORECASE,
    )
    assert functions == ["kyc_document_access_events_deny_mutation"]


def test_no_runtime_writer_referenced() -> None:
    sql = _audit_sql().lower()
    assert "server.py" not in sql
    assert "/api/" not in sql
    assert "fastapi" not in sql
    assert "supabase" not in sql


def test_application_timeline_index_exists() -> None:
    sql = _audit_sql()
    assert re.search(
        r"CREATE\s+INDEX\b.*?ON\s+public\.kyc_document_access_events\s*\(\s*application_id\s*,\s*occurred_at\s+DESC\s*\)",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_actor_timeline_index_exists() -> None:
    sql = _audit_sql()
    assert re.search(
        r"CREATE\s+INDEX\b.*?ON\s+public\.kyc_document_access_events\s*\(\s*actor_admin_id\s*,\s*occurred_at\s+DESC\s*\)",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_grant_hash_timeline_index_exists() -> None:
    sql = _audit_sql()
    assert re.search(
        r"CREATE\s+INDEX\b.*?ON\s+public\.kyc_document_access_events\s*\(\s*grant_reference_hash\s*,\s*occurred_at\s+DESC\s*\)\s+"
        r"WHERE\s+grant_reference_hash\s+IS\s+NOT\s+NULL",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_event_timeline_index_exists() -> None:
    sql = _audit_sql()
    assert re.search(
        r"CREATE\s+INDEX\b.*?ON\s+public\.kyc_document_access_events\s*\(\s*event_type\s*,\s*occurred_at\s+DESC\s*\)",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_request_correlation_index_exists() -> None:
    sql = _audit_sql()
    assert re.search(
        r"CREATE\s+INDEX\b.*?ON\s+public\.kyc_document_access_events\s*\(\s*request_id\s*\)",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_no_index_predicate_contains_now() -> None:
    for predicate in _index_predicates(_audit_sql()):
        assert "now()" not in predicate.lower()


def test_no_raw_grant_token_column() -> None:
    columns = _column_names(_events_table_body(_audit_sql()))
    assert "grant_token" not in columns
    assert "raw_token" not in columns


def test_no_url_column_in_executable_ddl() -> None:
    columns = _column_names(_events_table_body(_audit_sql()))
    url_like = {name for name in columns if "url" in name}
    assert not url_like


def test_no_bucket_or_path_column() -> None:
    columns = _column_names(_events_table_body(_audit_sql()))
    forbidden = columns & {
        "bucket",
        "bucket_name",
        "object_path",
        "storage_path",
        "storage_key",
        "file_path",
    }
    assert not forbidden


def test_no_bytes_or_blob_column() -> None:
    columns = _column_names(_events_table_body(_audit_sql()))
    assert "document_bytes" not in columns
    assert "raw_document" not in columns


def test_no_json_or_metadata_column() -> None:
    body = _events_table_body(_audit_sql())
    assert not re.search(r"\bjsonb\b", body, flags=re.IGNORECASE)
    assert not re.search(r"\bjson\b", body, flags=re.IGNORECASE)
    columns = _column_names(body)
    assert "metadata" not in columns
    assert "payload" not in columns


def test_no_product_pii_column() -> None:
    columns = _column_names(_events_table_body(_audit_sql()))
    assert not (columns & PROHIBITED_PII_COLUMN_NAMES)


def test_no_destructive_sql_against_unrelated_tables() -> None:
    executable = _executable_declarations(_audit_sql())
    for pattern in DESTRUCTIVE_SQL_PATTERNS:
        assert not re.search(pattern, executable, flags=re.IGNORECASE)


def test_python_event_constants_mirror_sql() -> None:
    assert audit.KYC_DOCUMENT_ACCESS_AUDIT_EVENT_TYPES == access_5a.KYC_DOCUMENT_ACCESS_AUDIT_EVENT_TYPES


def test_python_result_constants_mirror_sql() -> None:
    assert audit.KYC_DOCUMENT_ACCESS_AUDIT_RESULTS == (
        "allowed",
        "denied",
        "viewed",
        "unavailable",
    )


def test_python_source_channel_constants_mirror_sql() -> None:
    assert audit.KYC_DOCUMENT_ACCESS_SOURCE_CHANNELS == ("enterprise_bff", "leylek_internal")


def test_python_reason_code_set_mirrors_phase_5a() -> None:
    expected = tuple(
        dict.fromkeys(
            (
                *access_5a.KYC_DOCUMENT_ACCESS_DENIED_REASONS,
                *access_5a.KYC_DOCUMENT_ACCESS_UNAVAILABLE_REASONS,
            )
        )
    )
    assert audit.KYC_DOCUMENT_ACCESS_AUDIT_REASON_CODES == expected


def test_all_readiness_flags_remain_false() -> None:
    assert audit.KYC_DOCUMENT_ACCESS_AUDIT_SCHEMA_READY is False
    assert audit.KYC_DOCUMENT_ACCESS_APPEND_ONLY_READY is False
    assert audit.KYC_DOCUMENT_ACCESS_AUDIT_RUNTIME_READY is False


def test_forbidden_audit_persistence_columns_closed_set() -> None:
    assert audit.KYC_DOCUMENT_ACCESS_AUDIT_FORBIDDEN_PERSISTENCE_COLUMNS == PROHIBITED_COLUMN_NAMES


def test_prohibited_terms_not_in_column_declarations() -> None:
    columns = _column_names(_events_table_body(_audit_sql()))
    for forbidden in PROHIBITED_COLUMN_NAMES:
        assert forbidden not in columns


def test_phase_5b1_static_tests_remain_importable() -> None:
    # Load sibling module by path so repo-root pytest cannot resolve the empty
    # top-level `tests` package instead of backend/tests.
    import importlib.util

    sibling = Path(__file__).resolve().with_name(
        "test_kyc_document_access_persistence_schema.py"
    )
    spec = importlib.util.spec_from_file_location(
        "kyc_document_access_persistence_schema_sibling",
        sibling,
    )
    assert spec is not None and spec.loader is not None
    grants_tests = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(grants_tests)

    assert grants_tests.MIGRATION_PATH.is_file()


def test_phase_5a_contract_remains_importable() -> None:
    assert access_5a.document_access_runtime_ready() is False
    assert len(access_5a.KYC_DOCUMENT_ACCESS_AUDIT_EVENT_TYPES) == 7
