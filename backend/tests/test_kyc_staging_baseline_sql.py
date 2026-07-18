"""KYC staging minimal baseline SQL contract tests (OPS-C)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

BASELINE_PATH = BACKEND_DIR / "migrations" / "create_kyc_staging_minimal_baseline.sql"

REQUIRED_COLUMNS = frozenset(
    {
        "id",
        "phone",
        "name",
        "city",
        "push_token",
        "driver_details",
        "driver_active_until",
        "created_at",
        "updated_at",
    }
)

PRODUCTION_REFS = frozenset(
    {
        "ujvploftywsxprlzejgc",
        "iqxckvhfvwlolbqzvutz",
    }
)

DESTRUCTIVE_PATTERNS = (
    r"\bDROP\s+TABLE\b",
    r"\bDROP\s+COLUMN\b",
    r"\bTRUNCATE\b",
    r"\bDELETE\s+FROM\b",
)


def _sql() -> str:
    assert BASELINE_PATH.is_file(), f"missing baseline manifest: {BASELINE_PATH}"
    return BASELINE_PATH.read_text(encoding="utf-8")


def _users_body(sql: str) -> str:
    match = re.search(
        r"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.users\s*\((.*?)\);",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )
    assert match is not None, "public.users CREATE TABLE block missing"
    return match.group(1)


def _column_names(table_body: str) -> set[str]:
    names: set[str] = set()
    for line in table_body.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("--"):
            continue
        if stripped.upper().startswith("CONSTRAINT "):
            continue
        col_match = re.match(r"^(\w+)\s+", stripped, flags=re.IGNORECASE)
        if col_match:
            names.add(col_match.group(1).lower())
    return names


def test_staging_only_banner_present() -> None:
    sql = _sql().lower()
    assert "not for production" in sql
    assert "synthetic" in sql or "staging" in sql
    assert "kyc-only minimum" in sql or "kyc-only" in sql


def test_manifest_apply_order_documented() -> None:
    sql = _sql()
    assert "create_kyc_staging_minimal_baseline.sql" in sql
    assert "seed_kyc_staging_synthetic.sql" in sql
    assert "create_kyc_document_access_grants.sql" in sql
    assert "create_kyc_document_access_events.sql" in sql


def test_required_extensions_present() -> None:
    sql = _sql()
    assert re.search(r'CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"uuid-ossp"', sql, re.I)
    assert re.search(r'CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"pgcrypto"', sql, re.I)


def test_users_uuid_primary_key() -> None:
    body = _users_body(_sql())
    assert re.search(
        r"\bid\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+uuid_generate_v4\s*\(\s*\)",
        body,
        flags=re.IGNORECASE,
    )


def test_required_columns_present() -> None:
    columns = _column_names(_users_body(_sql()))
    missing = REQUIRED_COLUMNS - columns
    assert not missing, f"missing columns: {sorted(missing)}"


def test_driver_details_is_jsonb() -> None:
    body = _users_body(_sql())
    assert re.search(r"\bdriver_details\s+jsonb\b", body, flags=re.IGNORECASE)


def test_driver_active_until_is_timestamptz() -> None:
    body = _users_body(_sql())
    assert re.search(r"\bdriver_active_until\s+timestamptz\b", body, flags=re.IGNORECASE)


def test_phone_unique_constraint() -> None:
    sql = _sql()
    assert "users_phone_unique" in sql
    assert re.search(r"UNIQUE\s*\(\s*phone\s*\)", sql, flags=re.IGNORECASE)


def test_schema_mismatch_detection_blocks_present() -> None:
    sql = _sql()
    assert "kyc_staging_baseline_invalid" in sql
    assert sql.count("RAISE EXCEPTION") >= 5


def test_no_production_refs() -> None:
    sql = _sql().lower()
    for ref in PRODUCTION_REFS:
        assert ref not in sql


def test_no_destructive_sql() -> None:
    executable = re.sub(r"--.*$", "", _sql(), flags=re.MULTILINE)
    for pattern in DESTRUCTIVE_PATTERNS:
        assert not re.search(pattern, executable, flags=re.IGNORECASE)


def test_no_unrelated_product_tables() -> None:
    sql = _sql().lower()
    for forbidden in ("tags", "offers", "dispatch_queue", "auth.users"):
        assert f"create table" not in sql or forbidden not in re.findall(
            r"create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)",
            sql,
            flags=re.IGNORECASE,
        )


def test_no_browser_rls_policies() -> None:
    sql = _sql().lower()
    assert "create policy" not in sql
    assert "enable row level security" not in sql


def test_supabase_stub_roles_for_local_dryrun() -> None:
    sql = _sql()
    assert "CREATE ROLE anon NOLOGIN" in sql
    assert "CREATE ROLE authenticated NOLOGIN" in sql


def test_no_secret_literals() -> None:
    sql = _sql()
    assert "service_role" not in sql.lower()
    assert "eyJ" not in sql
    assert "supabase.co" not in sql.lower()
