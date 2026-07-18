"""KYC migration dry-run contract and optional local disposable-DB integration (OPS-C)."""
from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = BACKEND_DIR / "migrations"

MANIFEST_ORDER = (
    "create_kyc_staging_minimal_baseline.sql",
    "seed_kyc_staging_synthetic.sql",
    "create_kyc_document_access_grants.sql",
    "create_kyc_document_access_events.sql",
)

PSQL_DEFAULT = Path(r"C:\Program Files\PostgreSQL\17\bin\psql.exe")


def _read(name: str) -> str:
    path = MIGRATIONS_DIR / name
    assert path.is_file(), f"missing migration: {path}"
    return path.read_text(encoding="utf-8")


def test_manifest_order_documented_in_baseline() -> None:
    baseline = _read("create_kyc_staging_minimal_baseline.sql")
    for idx, name in enumerate(MANIFEST_ORDER, start=1):
        assert f"{idx}. {name}" in baseline


def test_grants_fk_targets_public_users() -> None:
    grants = _read("create_kyc_document_access_grants.sql")
    assert re.search(
        r"application_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+public\.users\s*\(\s*id\s*\)",
        grants,
        flags=re.IGNORECASE | re.DOTALL,
    )


def test_events_require_grants_table() -> None:
    events = _read("create_kyc_document_access_events.sql")
    assert "REFERENCES public.kyc_document_access_grants" in events


def test_append_only_trigger_contract_in_events_migration() -> None:
    events = _read("create_kyc_document_access_events.sql")
    assert "append_only_violation" in events
    assert "BEFORE UPDATE OR DELETE" in events.upper().replace("\n", " ")


def test_baseline_must_precede_grants_for_fk() -> None:
    baseline = _read("create_kyc_staging_minimal_baseline.sql")
    assert "public.users" in baseline
    grants = _read("create_kyc_document_access_grants.sql")
    assert "public.users" in grants


def _resolve_psql() -> Path:
    env_path = os.environ.get("LEYLEK_KYC_PSQL_PATH")
    if env_path:
        return Path(env_path)
    return PSQL_DEFAULT


def _dryrun_port() -> int:
    return int(os.environ.get("LEYLEK_KYC_PG_DRYRUN_PORT", "54329"))


def _psql_base_args(db: str) -> list[str]:
    port = _dryrun_port()
    return [
        str(_resolve_psql()),
        "-w",
        "-h",
        "127.0.0.1",
        "-p",
        str(port),
        "-U",
        "postgres",
        "-d",
        db,
    ]


def _run_psql_file(db: str, sql_file: Path) -> subprocess.CompletedProcess[str]:
    cmd = [*_psql_base_args(db), "-v", "ON_ERROR_STOP=1", "-f", str(sql_file)]
    return subprocess.run(cmd, capture_output=True, text=True, check=False)


def _run_psql_sql(db: str, sql: str) -> subprocess.CompletedProcess[str]:
    cmd = [*_psql_base_args(db), "-v", "ON_ERROR_STOP=1", "-c", sql]
    return subprocess.run(cmd, capture_output=True, text=True, check=False)


@pytest.mark.integration
def test_local_disposable_db_identity_safe() -> None:
    if os.environ.get("LEYLEK_KYC_SQL_DRYRUN") != "1":
        pytest.skip("set LEYLEK_KYC_SQL_DRYRUN=1 to run local disposable DB integration")

    assert _resolve_psql().is_file(), "psql not found for dry-run integration"

    result = _run_psql_sql(
        "postgres",
        "SELECT coalesce(inet_server_addr()::text, 'local') AS host, "
        "inet_server_port() AS port, current_database() AS db, current_user AS usr, "
        "split_part(version(), ' ', 2) AS server_version;",
    )
    assert result.returncode == 0, result.stderr

    host_match = re.search(r"local|127\.0\.0\.1|::1", result.stdout, re.I)
    assert host_match is not None, f"unsafe host identity: {result.stdout}"
    assert str(_dryrun_port()) in result.stdout


@pytest.mark.integration
def test_local_clean_apply_and_assertions() -> None:
    if os.environ.get("LEYLEK_KYC_SQL_DRYRUN") != "1":
        pytest.skip("set LEYLEK_KYC_SQL_DRYRUN=1 to run local disposable DB integration")

    db = os.environ.get("LEYLEK_KYC_PG_DRYRUN_DB", "leylek_kyc_staging_dryrun")

    for name in MANIFEST_ORDER:
        proc = _run_psql_file(db, MIGRATIONS_DIR / name)
        assert proc.returncode == 0, f"{name} failed: {proc.stderr}"

    assertions = _run_psql_file(db, MIGRATIONS_DIR / "_kyc_staging_dryrun_assertions.sql")
    assert assertions.returncode == 0, assertions.stderr
    assert "kyc_staging_dryrun_assertions_ok" in assertions.stdout


@pytest.mark.integration
def test_local_reapply_idempotent() -> None:
    if os.environ.get("LEYLEK_KYC_SQL_DRYRUN") != "1":
        pytest.skip("set LEYLEK_KYC_SQL_DRYRUN=1 to run local disposable DB integration")

    db = os.environ.get("LEYLEK_KYC_PG_DRYRUN_DB", "leylek_kyc_staging_dryrun")

    before = _run_psql_sql(db, "SELECT count(*) FROM public.users WHERE driver_details->>'synthetic' = 'true';")
    assert before.returncode == 0
    before_count = int(before.stdout.strip().split("\n")[-2])

    for name in MANIFEST_ORDER:
        proc = _run_psql_file(db, MIGRATIONS_DIR / name)
        assert proc.returncode == 0, f"reapply {name} failed: {proc.stderr}"

    after = _run_psql_sql(db, "SELECT count(*) FROM public.users WHERE driver_details->>'synthetic' = 'true';")
    assert after.returncode == 0
    after_count = int(after.stdout.strip().split("\n")[-2])
    assert before_count == after_count

    triggers = _run_psql_sql(
        db,
        "SELECT count(*) FROM pg_trigger WHERE tgname = 'kyc_document_access_events_deny_mutation';",
    )
    assert triggers.returncode == 0
    assert int(triggers.stdout.strip().split("\n")[-2]) == 1


@pytest.mark.integration
def test_local_partial_apply_events_without_grants_fails() -> None:
    if os.environ.get("LEYLEK_KYC_SQL_DRYRUN") != "1":
        pytest.skip("set LEYLEK_KYC_SQL_DRYRUN=1 to run local disposable DB integration")

    db = os.environ.get("LEYLEK_KYC_PG_DRYRUN_PARTIAL_DB", "leylek_kyc_partial_events")
    create_db = _run_psql_sql("postgres", f"CREATE DATABASE {db};")
    if create_db.returncode != 0 and "already exists" not in create_db.stderr.lower():
        pytest.skip(f"cannot create partial DB: {create_db.stderr}")

    _run_psql_file(db, MIGRATIONS_DIR / "create_kyc_staging_minimal_baseline.sql")
    events_only = _run_psql_file(db, MIGRATIONS_DIR / "create_kyc_document_access_events.sql")
    assert events_only.returncode != 0
