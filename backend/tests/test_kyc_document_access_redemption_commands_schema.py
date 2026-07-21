"""Phase D7-B1 — static SQL contract tests for KYC redemption command ledger."""
from __future__ import annotations

import re
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from contracts import kyc_document_access_rpc_contract as rpc  # noqa: E402

MIGRATION_PATH = BACKEND_DIR / "migrations" / "create_kyc_document_access_redemption_commands.sql"
GRANTS_MIGRATION_PATH = BACKEND_DIR / "migrations" / "create_kyc_document_access_grants.sql"

REQUIRED_COLUMNS = frozenset(
    {
        "id",
        "grant_id",
        "actor_admin_id",
        "request_id",
        "source_channel",
        "request_fingerprint",
        "status",
        "terminal_outcome_code",
        "result_grant_id",
        "result_application_id",
        "result_document_type",
        "result_state",
        "result_redeemed_at",
        "result_source_binding_hash",
        "result_application_record_version",
        "failure_reason_code",
        "created_at",
        "completed_at",
    }
)

PROHIBITED_COLUMN_NAMES = frozenset(
    {
        "grant_token",
        "raw_token",
        "access_token",
        "signed_url",
        "public_url",
        "document_url",
        "source_url",
        "provider_url",
        "bucket",
        "bucket_name",
        "object_path",
        "storage_path",
        "file_path",
        "document_bytes",
        "raw_document",
        "metadata",
        "payload",
        "snapshot_json",
    }
)

DESTRUCTIVE_SQL_PATTERNS = (
    r"\bDROP\s+TABLE\b",
    r"\bDROP\s+COLUMN\b",
    r"\bTRUNCATE\b",
    r"\bDELETE\s+FROM\b",
)


def _migration_sql() -> str:
    assert MIGRATION_PATH.is_file(), f"migration missing: {MIGRATION_PATH}"
    return MIGRATION_PATH.read_text(encoding="utf-8")


def _grants_sql() -> str:
    assert GRANTS_MIGRATION_PATH.is_file(), f"migration missing: {GRANTS_MIGRATION_PATH}"
    return GRANTS_MIGRATION_PATH.read_text(encoding="utf-8")


def _create_table_blocks(sql: str) -> list[tuple[str, str]]:
    return re.findall(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\((.*?)\);",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )


def _ledger_table_body(sql: str) -> str:
    blocks = _create_table_blocks(sql)
    ledger_blocks = [
        body for name, body in blocks if name.lower() == "kyc_document_access_redemption_commands"
    ]
    assert len(ledger_blocks) == 1, "expected exactly one redemption commands CREATE TABLE"
    return ledger_blocks[0]


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


def test_exactly_one_redemption_commands_table() -> None:
    sql = _migration_sql()
    blocks = _create_table_blocks(sql)
    kyc_tables = [name for name, _ in blocks if "kyc_document_access" in name.lower()]
    assert kyc_tables == ["kyc_document_access_redemption_commands"]


def test_table_name_is_kyc_document_access_redemption_commands() -> None:
    sql = _migration_sql()
    assert re.search(
        r"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.kyc_document_access_redemption_commands\s*\(",
        sql,
        flags=re.IGNORECASE,
    )


def test_required_columns_present() -> None:
    columns = _column_names(_ledger_table_body(_migration_sql()))
    assert REQUIRED_COLUMNS <= columns


def test_grant_fk_on_delete_restrict() -> None:
    body = _ledger_table_body(_migration_sql())
    assert re.search(
        r"grant_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+public\.kyc_document_access_grants\s*\(\s*id\s*\)\s+ON\s+DELETE\s+RESTRICT",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_unique_grant_actor_request_index() -> None:
    body = _ledger_table_body(_migration_sql())
    assert re.search(
        r"CONSTRAINT\s+uq_kdarc_grant_actor_request\s+UNIQUE\s*\(\s*grant_id\s*,\s*actor_admin_id\s*,\s*request_id\s*\)",
        body,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_operational_status_index_exists() -> None:
    sql = _migration_sql()
    assert re.search(
        r"CREATE\s+INDEX\b.*?ON\s+public\.kyc_document_access_redemption_commands\s*\(\s*grant_id\s*,\s*status\s*,\s*completed_at\s+DESC\s*\)",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_source_channel_closed_set() -> None:
    body = _ledger_table_body(_migration_sql())
    assert re.search(
        r"source_channel\s+IN\s*\(\s*'enterprise_bff'\s*,\s*'leylek_internal'\s*\)",
        body,
        flags=re.IGNORECASE,
    )


def test_status_closed_set() -> None:
    body = _ledger_table_body(_migration_sql())
    assert re.search(
        r"status\s+IN\s*\(\s*'pending'\s*,\s*'completed'\s*,\s*'failed'\s*\)",
        body,
        flags=re.IGNORECASE,
    )


def test_request_fingerprint_64_lowercase_hex() -> None:
    body = _ledger_table_body(_migration_sql())
    assert re.search(
        r"request_fingerprint\s+~\s*'\^\[0-9a-f\]\{64\}\$'",
        body,
        flags=re.IGNORECASE,
    )


def test_terminal_outcome_matches_rpc_contract() -> None:
    body = _ledger_table_body(_migration_sql())
    for outcome in rpc.KYC_DOCUMENT_ACCESS_REDEEM_OUTCOMES:
        assert f"'{outcome}'" in body


def test_completed_at_required_for_terminal_status() -> None:
    body = _ledger_table_body(_migration_sql())
    assert re.search(
        r"status\s*=\s*'pending'\s+OR\s+completed_at\s+IS\s+NOT\s+NULL",
        body,
        flags=re.IGNORECASE,
    )
    assert re.search(
        r"status\s*<>\s*'pending'\s+OR\s+completed_at\s+IS\s+NULL",
        body,
        flags=re.IGNORECASE,
    )


def test_redeemed_snapshot_consistency_check() -> None:
    body = _ledger_table_body(_migration_sql())
    assert re.search(
        r"terminal_outcome_code\s*<>\s*'redeemed'",
        body,
        flags=re.IGNORECASE,
    )
    assert "result_state = 'redeemed'" in body.replace("\n", " ")
    assert "result_redeemed_at IS NOT NULL" in body


def test_no_raw_token_columns() -> None:
    columns = _column_names(_ledger_table_body(_migration_sql()))
    assert "grant_token" not in columns
    assert "raw_token" not in columns
    assert "access_token" not in columns


def test_no_storage_path_or_url_columns() -> None:
    columns = _column_names(_ledger_table_body(_migration_sql()))
    forbidden = columns & PROHIBITED_COLUMN_NAMES
    assert not forbidden


def test_no_json_snapshot_columns() -> None:
    body = _ledger_table_body(_migration_sql())
    assert not re.search(r"\bjsonb\b", body, flags=re.IGNORECASE)
    columns = _column_names(body)
    assert "metadata" not in columns
    assert "payload" not in columns


def test_no_destructive_drop_table() -> None:
    executable = _executable_declarations(_migration_sql())
    for pattern in DESTRUCTIVE_SQL_PATTERNS:
        assert not re.search(pattern, executable, flags=re.IGNORECASE)


def test_rls_enabled() -> None:
    sql = _migration_sql()
    assert re.search(
        r"ALTER\s+TABLE\s+public\.kyc_document_access_redemption_commands\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY",
        sql,
        flags=re.IGNORECASE,
    )


def test_public_privilege_revoked() -> None:
    sql = _migration_sql()
    assert re.search(
        r"REVOKE\s+ALL\s+ON\s+public\.kyc_document_access_redemption_commands\s+FROM\s+PUBLIC",
        sql,
        flags=re.IGNORECASE,
    )


def test_anon_privilege_revoked() -> None:
    sql = _migration_sql()
    assert re.search(
        r"REVOKE\s+ALL\s+ON\s+public\.kyc_document_access_redemption_commands\s+FROM\s+anon",
        sql,
        flags=re.IGNORECASE,
    )


def test_authenticated_privilege_revoked() -> None:
    sql = _migration_sql()
    assert re.search(
        r"REVOKE\s+ALL\s+ON\s+public\.kyc_document_access_redemption_commands\s+FROM\s+authenticated",
        sql,
        flags=re.IGNORECASE,
    )


def test_comments_document_no_bearer_persistence() -> None:
    sql = _migration_sql().lower()
    assert "raw bearer" in sql or "never stored" in sql
    assert "idempotency" in sql


def test_grants_migration_not_altered() -> None:
    grants = _grants_sql()
    assert "kyc_document_access_grants" in grants
    assert "kyc_document_access_redemption_commands" not in grants
