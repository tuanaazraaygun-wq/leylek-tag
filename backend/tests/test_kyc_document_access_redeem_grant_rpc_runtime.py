"""D7-B1B1 — gated disposable-PostgreSQL runtime proof for redeem-grant RPC."""
from __future__ import annotations

import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = BACKEND_DIR / "migrations"
PG_BIN = Path(r"C:\Program Files\PostgreSQL\17\bin")
PSQL = PG_BIN / "psql.exe"
INITDB = PG_BIN / "initdb.exe"
PG_CTL = PG_BIN / "pg_ctl.exe"
PG_ISREADY = PG_BIN / "pg_isready.exe"
CREATEDB = PG_BIN / "createdb.exe"

REQUIRED_HOST = "127.0.0.1"
REQUIRED_PORT = 54329
REQUIRED_CONFIRM = "I_UNDERSTAND_THIS_USES_A_DISPOSABLE_LOCAL_POSTGRES"
DB_NAME_PREFIX = "leylek_kyc_redeem_runtime_"

MIGRATION_MANIFEST = (
    "create_kyc_staging_minimal_baseline.sql",
    "create_kyc_document_access_grants.sql",
    "create_kyc_document_access_events.sql",
    "create_kyc_document_access_redemption_commands.sql",
    "create_kyc_document_access_redeem_grant_rpc.sql",
    "create_kyc_document_access_redeem_grant_rpc_grants.sql",
)

ROLE_BOOTSTRAP_SQL = """
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;
"""

SUPABASE_PGCrypto_PARITY_SQL = """
CREATE SCHEMA IF NOT EXISTS extensions;
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
"""

FORBIDDEN_OUTPUT_PATTERNS = re.compile(
    r"(https?://|signed_url|storage/|bucket|grant_token|raw_token|document_bytes|supabase\.co)",
    re.IGNORECASE,
)

# Synthetic fixture constants — test-only, never logged in full.
ACTOR = "admin-redeem-runtime-001"
WRONG_ACTOR = "admin-redeem-runtime-WRONG"
CHANNEL = "enterprise_bff"
ALT_CHANNEL = "leylek_internal"
BINDING_OK = "abababababababababababababababababababababababababababababababab"
BINDING_BAD = "bcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbc"
APP_OK = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01"
APP_STALE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02"
GRANT_ISSUED = "0101010101010101010101010101010101010101010101010101010101010101"
GRANT_EXPIRED_ISSUED = "0202020202020202020202020202020202020202020202020202020202020202"
GRANT_ALREADY_EXPIRED = "0303030303030303030303030303030303030303030303030303030303030303"
GRANT_REVOKED = "0404040404040404040404040404040404040404040404040404040404040404"
GRANT_REDEEMED = "0505050505050505050505050505050505050505050505050505050505050505"
GRANT_CONCURRENT = "0606060606060606060606060606060606060606060606060606060606060606"
GRANT_AUDIT_FAIL = "0707070707070707070707070707070707070707070707070707070707070707"
GRANT_BINDING_BAD = "0808080808080808080808080808080808080808080808080808080808080808"
GRANT_VERSION_BAD = "0909090909090909090909090909090909090909090909090909090909090909"
GRANT_FUTURE = "0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a"
GRANT_FINGERPRINT = "0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b"
GRANT_PRIV = "0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c"
UNKNOWN_HASH = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"


class ConfirmedImplementationDefect(RuntimeError):
    """Raised when runtime proof confirms an RPC implementation defect."""


@dataclass
class RedeemResult:
    outcome_code: str | None
    grant_id: str | None
    application_id: str | None
    document_type: str | None
    state: str | None
    redeemed_at: str | None
    source_binding_hash: str | None
    application_record_version: str | None

    def as_text(self) -> str:
        return "|".join(
            str(v) if v is not None else ""
            for v in (
                self.outcome_code,
                self.grant_id,
                self.application_id,
                self.document_type,
                self.state,
                self.redeemed_at,
                self.source_binding_hash,
                self.application_record_version,
            )
        )


@dataclass
class RuntimeContext:
    pgdata: Path
    db_name: str
    host: str
    port: int
    log_path: Path

    def psql(
        self,
        sql: str,
        *,
        db: str | None = None,
        role: str | None = None,
        tuples_only: bool = True,
    ) -> subprocess.CompletedProcess[str]:
        cmd = [
            str(PSQL),
            "-w",
            "-h",
            self.host,
            "-p",
            str(self.port),
            "-U",
            "postgres",
            "-d",
            db or self.db_name,
            "-v",
            "ON_ERROR_STOP=1",
        ]
        if tuples_only:
            cmd.extend(["-t", "-A"])
        if role:
            wrapped = f"SET ROLE {role}; {sql}"
            cmd.extend(["-c", wrapped])
        else:
            cmd.extend(["-c", sql])
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=30)
        if proc.returncode != 0:
            raise RuntimeError(f"psql failed: {proc.stderr.strip() or proc.stdout.strip()}")
        return proc

    def psql_file(self, path: Path, *, db: str | None = None) -> None:
        cmd = [
            str(PSQL),
            "-w",
            "-h",
            self.host,
            "-p",
            str(self.port),
            "-U",
            "postgres",
            "-d",
            db or self.db_name,
            "-v",
            "ON_ERROR_STOP=1",
            "-f",
            str(path),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=120)
        if proc.returncode != 0:
            raise RuntimeError(f"psql file failed ({path.name}): {proc.stderr.strip()}")

    def fetchval(self, sql: str) -> str:
        proc = self.psql(sql)
        lines = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
        return lines[-1] if lines else ""

    def fetchrow(self, sql: str) -> list[str]:
        proc = self.psql(sql)
        line = next((ln.strip() for ln in proc.stdout.splitlines() if ln.strip()), "")
        return line.split("|") if line else []

    def redeem(
        self,
        *,
        grant_hash: str,
        actor: str,
        request_id: str,
        channel: str = CHANNEL,
        binding: str = BINDING_OK,
        record_version: str | None,
        role: str = "postgres",
    ) -> RedeemResult:
        version_sql = "NULL::timestamptz" if record_version is None else f"{_sql_literal(record_version)}::timestamptz"
        inner = (
            "SELECT outcome_code, grant_id::text, application_id::text, document_type, state, "
            "redeemed_at::text, source_binding_hash, application_record_version::text "
            "FROM public.kyc_document_access_redeem_grant("
            f"{_sql_literal(grant_hash)}, "
            f"{_sql_literal(actor)}, "
            f"{_sql_literal(request_id)}, "
            f"{_sql_literal(channel)}, "
            f"{_sql_literal(binding)}, "
            f"{version_sql}) AS redeem_result"
        )
        sql = inner if role == "postgres" else f"SET ROLE {role}; {inner}"
        proc = self.psql(sql)
        line = next(
            (ln.strip() for ln in proc.stdout.splitlines() if ln.strip() and "|" in ln),
            "",
        )
        cols = line.split("|") if line else []
        return RedeemResult(
            outcome_code=cols[0] if len(cols) > 0 else None,
            grant_id=cols[1] if len(cols) > 1 and cols[1] else None,
            application_id=cols[2] if len(cols) > 2 and cols[2] else None,
            document_type=cols[3] if len(cols) > 3 and cols[3] else None,
            state=cols[4] if len(cols) > 4 and cols[4] else None,
            redeemed_at=cols[5] if len(cols) > 5 and cols[5] else None,
            source_binding_hash=cols[6] if len(cols) > 6 and cols[6] else None,
            application_record_version=cols[7] if len(cols) > 7 and cols[7] else None,
        )

    def assert_output_safe(self, result: RedeemResult) -> None:
        blob = result.as_text()
        assert not FORBIDDEN_OUTPUT_PATTERNS.search(blob)


def _sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _gates_enabled() -> bool:
    return all(
        (
            os.environ.get("LEYLEK_KYC_REDEEM_SQL_RUNTIME") == "1",
            os.environ.get("LEYLEK_KYC_REDEEM_SQL_RUNTIME_CONFIRM") == REQUIRED_CONFIRM,
            os.environ.get("LEYLEK_KYC_REDEEM_SQL_RUNTIME_HOST") == REQUIRED_HOST,
            os.environ.get("LEYLEK_KYC_REDEEM_SQL_RUNTIME_PORT") == str(REQUIRED_PORT),
            os.environ.get("LEYLEK_KYC_REDEEM_SQL_RUNTIME_ALLOW_DROP") == "1",
        )
    )


def _skip_reason() -> str | None:
    if not _gates_enabled():
        return "LEYLEK_KYC_REDEEM_SQL_RUNTIME gates not enabled"
    if not PSQL.is_file() or not INITDB.is_file() or not PG_CTL.is_file():
        return "PostgreSQL 17 binaries unavailable"
    return None


def _port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1)
        return sock.connect_ex((REQUIRED_HOST, port)) != 0


def _write_cluster_config(pgdata: Path) -> None:
    conf = pgdata / "postgresql.conf"
    hba = pgdata / "pg_hba.conf"
    conf.write_text(
        conf.read_text(encoding="utf-8")
        + f"\nlisten_addresses = '{REQUIRED_HOST}'\nport = {REQUIRED_PORT}\n",
        encoding="utf-8",
    )
    hba.write_text(
        "# TYPE  DATABASE        USER            ADDRESS                 METHOD\n"
        "local   all             all                                     trust\n"
        "host    all             all             127.0.0.1/32            trust\n"
        "host    all             all             ::1/128                 trust\n",
        encoding="utf-8",
    )


def _start_cluster() -> RuntimeContext:
    if not _port_free(REQUIRED_PORT):
        raise RuntimeError(f"port {REQUIRED_PORT} is already in use")

    pgdata = Path(tempfile.gettempdir()) / f"leylek_kyc_pg17_runtime_{secrets.token_hex(4)}"
    if pgdata.exists():
        raise RuntimeError("ephemeral pgdata path already exists")
    log_path = pgdata / "server.log"
    db_name = f"{DB_NAME_PREFIX}{secrets.token_hex(4)}"

    init = subprocess.run(
        [
            str(INITDB),
            "-D",
            str(pgdata),
            "-U",
            "postgres",
            "-E",
            "UTF8",
            "--locale=C",
            "--lc-collate=C",
            "--lc-ctype=C",
            "--auth-local=trust",
            "--auth-host=trust",
        ],
        capture_output=True,
        text=True,
        check=False,
        timeout=120,
        env={**os.environ, "LC_ALL": "C"},
    )
    if init.returncode != 0:
        raise RuntimeError(f"initdb failed: {init.stderr}")

    _write_cluster_config(pgdata)
    subprocess.Popen(
        [str(PG_CTL), "-D", str(pgdata), "-l", str(log_path), "start"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    for _ in range(120):
        ready = subprocess.run(
            [str(PG_ISREADY), "-h", REQUIRED_HOST, "-p", str(REQUIRED_PORT), "-U", "postgres"],
            capture_output=True,
            text=True,
            check=False,
            timeout=5,
        )
        if ready.returncode == 0:
            break
        time.sleep(0.5)
    else:
        raise RuntimeError("ephemeral cluster did not become ready")

    ctx = RuntimeContext(pgdata=pgdata, db_name=db_name, host=REQUIRED_HOST, port=REQUIRED_PORT, log_path=log_path)
    ctx.psql(f"CREATE DATABASE {db_name};", db="postgres", tuples_only=False)

    identity = ctx.fetchrow(
        "SELECT current_database(), current_user, split_part(version(), ' ', 2), "
        "coalesce(inet_server_addr()::text, 'local'), inet_server_port()::text"
    )
    assert identity[0] == db_name
    assert db_name.startswith(DB_NAME_PREFIX)
    assert identity[2].startswith("17.")
    host_addr = identity[3].split("/")[0]
    assert host_addr in {"127.0.0.1", "local", "::1"}
    assert identity[4] == str(REQUIRED_PORT)

    ctx.psql(ROLE_BOOTSTRAP_SQL, tuples_only=False)
    ctx.psql_file(MIGRATIONS_DIR / "create_kyc_staging_minimal_baseline.sql")
    ctx.psql(SUPABASE_PGCrypto_PARITY_SQL, tuples_only=False)
    for migration in MIGRATION_MANIFEST[1:]:
        ctx.psql_file(MIGRATIONS_DIR / migration)

    return ctx


def _stop_cluster(ctx: RuntimeContext) -> None:
    drop_allowed = os.environ.get("LEYLEK_KYC_REDEEM_SQL_RUNTIME_ALLOW_DROP") == "1"
    if drop_allowed:
        subprocess.run(
            [
                str(PSQL),
                "-w",
                "-h",
                ctx.host,
                "-p",
                str(ctx.port),
                "-U",
                "postgres",
                "-d",
                "postgres",
                "-c",
                f"DROP DATABASE IF EXISTS {ctx.db_name};",
            ],
            capture_output=True,
            text=True,
            check=False,
            timeout=60,
        )
    subprocess.run(
        [str(PG_CTL), "-D", str(ctx.pgdata), "stop", "-m", "fast"],
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    if ctx.pgdata.exists():
        shutil.rmtree(ctx.pgdata, ignore_errors=False)
    for _ in range(20):
        if _port_free(REQUIRED_PORT):
            break
        time.sleep(0.25)


def _insert_user(ctx: RuntimeContext, user_id: str, *, updated_at_sql: str = "now()") -> str:
    ctx.psql(
        "INSERT INTO public.users (id, phone, name, driver_details, updated_at) VALUES ("
        f"{_sql_literal(user_id)}::uuid, "
        f"{_sql_literal('+9055500' + user_id[-4:])}, "
        "'Synthetic Runtime User', "
        "jsonb_build_object('synthetic', true, 'kyc_status', 'pending'), "
        f"{updated_at_sql}) "
        "ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at;",
        tuples_only=False,
    )
    return ctx.fetchval(f"SELECT updated_at::text FROM public.users WHERE id = {_sql_literal(user_id)}::uuid")


def _insert_grant(
    ctx: RuntimeContext,
    *,
    grant_hash: str,
    application_id: str,
    actor: str,
    issue_request_id: str,
    binding: str,
    record_version: str,
    state: str = "issued",
    expires_sql: str = "now() + interval '90 seconds'",
    issued_at_sql: str = "now()",
    redeemed_at_sql: str | None = None,
    revoked_at_sql: str | None = None,
) -> str:
    redeemed = "NULL" if redeemed_at_sql is None else redeemed_at_sql
    revoked = "NULL" if revoked_at_sql is None else revoked_at_sql
    ctx.psql(
        "INSERT INTO public.kyc_document_access_grants ("
        "grant_reference_hash, application_id, document_type, actor_admin_id, request_id, "
        "review_reason, ttl_seconds, issued_at, expires_at, source_binding_hash, application_record_version, "
        "state, redeemed_at, revoked_at"
        ") VALUES ("
        f"{_sql_literal(grant_hash)}, {_sql_literal(application_id)}::uuid, 'license', "
        f"{_sql_literal(actor)}, {_sql_literal(issue_request_id)}, 'initial_review', 90, "
        f"{issued_at_sql}, {expires_sql}, {_sql_literal(binding)}, {_sql_literal(record_version)}::timestamptz, "
        f"{_sql_literal(state)}, {redeemed}, {revoked}"
        ");",
        tuples_only=False,
    )
    return ctx.fetchval(
        "SELECT id::text FROM public.kyc_document_access_grants "
        f"WHERE grant_reference_hash = {_sql_literal(grant_hash)}"
    )


def _seed_fixtures(ctx: RuntimeContext) -> dict[str, str]:
    versions: dict[str, str] = {}
    versions["ok"] = _insert_user(ctx, APP_OK)
    versions["stale"] = _insert_user(ctx, APP_STALE)
    _insert_grant(
        ctx,
        grant_hash=GRANT_ISSUED,
        application_id=APP_OK,
        actor=ACTOR,
        issue_request_id="req-issue-issued-001",
        binding=BINDING_OK,
        record_version=versions["ok"],
    )
    _insert_grant(
        ctx,
        grant_hash=GRANT_EXPIRED_ISSUED,
        application_id=APP_OK,
        actor=ACTOR,
        issue_request_id="req-issue-expired-001",
        binding=BINDING_OK,
        record_version=versions["ok"],
        issued_at_sql="now() - interval '5 minutes'",
        expires_sql="now() - interval '1 second'",
    )
    _insert_grant(
        ctx,
        grant_hash=GRANT_ALREADY_EXPIRED,
        application_id=APP_OK,
        actor=ACTOR,
        issue_request_id="req-issue-already-expired-001",
        binding=BINDING_OK,
        record_version=versions["ok"],
        state="expired",
        issued_at_sql="now() - interval '2 hours'",
        expires_sql="now() - interval '1 hour'",
    )
    _insert_grant(
        ctx,
        grant_hash=GRANT_REVOKED,
        application_id=APP_OK,
        actor=ACTOR,
        issue_request_id="req-issue-revoked-001",
        binding=BINDING_OK,
        record_version=versions["ok"],
        state="revoked",
        revoked_at_sql="now()",
    )
    _insert_grant(
        ctx,
        grant_hash=GRANT_REDEEMED,
        application_id=APP_OK,
        actor=ACTOR,
        issue_request_id="req-issue-redeemed-001",
        binding=BINDING_OK,
        record_version=versions["ok"],
        state="redeemed",
        redeemed_at_sql="now() - interval '1 minute'",
    )
    _insert_grant(
        ctx,
        grant_hash=GRANT_CONCURRENT,
        application_id=APP_OK,
        actor=ACTOR,
        issue_request_id="req-issue-concurrent-001",
        binding=BINDING_OK,
        record_version=versions["ok"],
    )
    _insert_grant(
        ctx,
        grant_hash=GRANT_AUDIT_FAIL,
        application_id=APP_OK,
        actor=ACTOR,
        issue_request_id="req-issue-audit-fail-001",
        binding=BINDING_OK,
        record_version=versions["ok"],
    )
    _insert_grant(
        ctx,
        grant_hash=GRANT_BINDING_BAD,
        application_id=APP_OK,
        actor=ACTOR,
        issue_request_id="req-issue-binding-bad-001",
        binding=BINDING_OK,
        record_version=versions["ok"],
    )
    _insert_grant(
        ctx,
        grant_hash=GRANT_VERSION_BAD,
        application_id=APP_OK,
        actor=ACTOR,
        issue_request_id="req-issue-version-bad-001",
        binding=BINDING_OK,
        record_version=(versions["stale"]),
    )
    ctx.psql(
        f"UPDATE public.users SET updated_at = now() WHERE id = {_sql_literal(APP_STALE)}::uuid;",
        tuples_only=False,
    )
    versions["stale_current"] = ctx.fetchval(
        f"SELECT updated_at::text FROM public.users WHERE id = {_sql_literal(APP_STALE)}::uuid"
    )
    _insert_grant(
        ctx,
        grant_hash=GRANT_FUTURE,
        application_id=APP_OK,
        actor=ACTOR,
        issue_request_id="req-issue-future-001",
        binding=BINDING_OK,
        record_version=versions["ok"],
        expires_sql="now() + interval '1 hour'",
    )
    _insert_grant(
        ctx,
        grant_hash=GRANT_FINGERPRINT,
        application_id=APP_OK,
        actor=ACTOR,
        issue_request_id="req-issue-fingerprint-001",
        binding=BINDING_OK,
        record_version=versions["ok"],
    )
    _insert_grant(
        ctx,
        grant_hash=GRANT_PRIV,
        application_id=APP_OK,
        actor=ACTOR,
        issue_request_id="req-issue-priv-001",
        binding=BINDING_OK,
        record_version=versions["ok"],
    )
    return versions


@pytest.fixture(scope="module")
def runtime_ctx() -> RuntimeContext:
    reason = _skip_reason()
    if reason:
        pytest.skip(reason)
    if not _port_free(REQUIRED_PORT):
        pytest.fail(f"port {REQUIRED_PORT} occupied before cluster start")
    ctx: RuntimeContext | None = None
    try:
        ctx = _start_cluster()
        _seed_fixtures(ctx)
        yield ctx
    finally:
        if ctx is not None:
            _stop_cluster(ctx)


@pytest.fixture(scope="module")
def fixture_versions(runtime_ctx: RuntimeContext) -> dict[str, str]:
    return {
        "ok": runtime_ctx.fetchval(
            f"SELECT updated_at::text FROM public.users WHERE id = {_sql_literal(APP_OK)}::uuid"
        ),
        "stale_current": runtime_ctx.fetchval(
            f"SELECT updated_at::text FROM public.users WHERE id = {_sql_literal(APP_STALE)}::uuid"
        ),
    }


def test_runtime_skipped_without_gates() -> None:
    if _gates_enabled():
        pytest.skip("gates enabled — covered by runtime proof module")
    assert _skip_reason() is not None


@pytest.mark.integration
def test_catalog_posture(runtime_ctx: RuntimeContext) -> None:
    table = runtime_ctx.fetchval(
        "SELECT relrowsecurity::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
        "WHERE n.nspname = 'public' AND c.relname = 'kyc_document_access_redemption_commands'"
    )
    assert table in {"t", "true"}
    fn = runtime_ctx.fetchrow(
        "SELECT prosecdef::text, pg_get_userbyid(proowner), array_to_string(proconfig, ',') "
        "FROM pg_proc WHERE proname = 'kyc_document_access_redeem_grant'"
    )
    assert fn[0] in {"t", "true"}
    assert fn[1] == "postgres"
    assert "search_path=public, pg_temp" in fn[2]
    assert "row_security=off" in fn[2]
    privs = runtime_ctx.fetchval(
        "SELECT string_agg(grantee || ':' || privilege_type, ',' ORDER BY grantee) "
        "FROM information_schema.routine_privileges "
        "WHERE routine_schema = 'public' AND routine_name = 'kyc_document_access_redeem_grant' "
        "AND privilege_type = 'EXECUTE'"
    )
    assert "service_role:EXECUTE" in privs
    assert "PUBLIC:EXECUTE" not in privs
    assert "anon:EXECUTE" not in privs
    assert "authenticated:EXECUTE" not in privs
    trigger_count = runtime_ctx.fetchval(
        "SELECT count(*)::text FROM pg_trigger WHERE tgname = 'kyc_document_access_events_deny_mutation'"
    )
    assert trigger_count == "1"
    pgcrypto_schema = runtime_ctx.fetchval(
        "SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace "
        "WHERE e.extname = 'pgcrypto'"
    )
    assert pgcrypto_schema == "extensions"
    public_digest_count = runtime_ctx.fetchval(
        "SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
        "WHERE n.nspname = 'public' AND p.proname = 'digest'"
    )
    assert public_digest_count == "0"
    extensions_digest = runtime_ctx.fetchval(
        "SELECT to_regprocedure('extensions.digest(bytea, text)') IS NOT NULL"
    )
    assert extensions_digest in {"t", "true"}


@pytest.mark.integration
def test_successful_redemption_and_replay(runtime_ctx: RuntimeContext, fixture_versions: dict[str, str]) -> None:
    rv = fixture_versions["ok"]
    before_attempts = runtime_ctx.fetchval(
        f"SELECT redemption_attempt_count::text FROM public.kyc_document_access_grants "
        f"WHERE grant_reference_hash = {_sql_literal(GRANT_ISSUED)}"
    )
    first = runtime_ctx.redeem(
        grant_hash=GRANT_ISSUED,
        actor=ACTOR,
        request_id="req-redeem-success-001",
        binding=BINDING_OK,
        record_version=rv,
    )
    runtime_ctx.assert_output_safe(first)
    assert first.outcome_code == "redeemed"
    assert first.state == "redeemed"
    assert first.redeemed_at
    after_attempts = runtime_ctx.fetchval(
        f"SELECT redemption_attempt_count::text FROM public.kyc_document_access_grants "
        f"WHERE grant_reference_hash = {_sql_literal(GRANT_ISSUED)}"
    )
    assert int(after_attempts) == int(before_attempts) + 1
    ledger_count = runtime_ctx.fetchval(
        "SELECT count(*)::text FROM public.kyc_document_access_redemption_commands "
        "WHERE request_id = 'req-redeem-success-001'"
    )
    audit_count = runtime_ctx.fetchval(
        "SELECT count(*)::text FROM public.kyc_document_access_events "
        "WHERE event_type = 'kyc.document.redeemed' AND request_id = 'req-redeem-success-001'"
    )
    assert ledger_count == "1"
    assert audit_count == "1"
    redeemed_at = first.redeemed_at
    replay = runtime_ctx.redeem(
        grant_hash=GRANT_ISSUED,
        actor=ACTOR,
        request_id="req-redeem-success-001",
        binding=BINDING_OK,
        record_version=rv,
    )
    assert replay.outcome_code == "redeemed"
    assert replay.redeemed_at == redeemed_at
    attempts_after_replay = runtime_ctx.fetchval(
        f"SELECT redemption_attempt_count::text FROM public.kyc_document_access_grants "
        f"WHERE grant_reference_hash = {_sql_literal(GRANT_ISSUED)}"
    )
    assert attempts_after_replay == after_attempts
    assert runtime_ctx.fetchval(
        "SELECT count(*)::text FROM public.kyc_document_access_events "
        "WHERE event_type = 'kyc.document.redeemed' AND request_id = 'req-redeem-success-001'"
    ) == "1"
    different = runtime_ctx.redeem(
        grant_hash=GRANT_ISSUED,
        actor=ACTOR,
        request_id="req-redeem-different-002",
        binding=BINDING_OK,
        record_version=rv,
    )
    assert different.outcome_code == "grant_redeemed"
    runtime_ctx.assert_output_safe(different)


@pytest.mark.integration
def test_fingerprint_mismatch_behavior(runtime_ctx: RuntimeContext, fixture_versions: dict[str, str]) -> None:
    rv = fixture_versions["ok"]
    first = runtime_ctx.redeem(
        grant_hash=GRANT_FINGERPRINT,
        actor=ACTOR,
        request_id="req-fp-pending-001",
        channel=CHANNEL,
        binding=BINDING_OK,
        record_version=rv,
    )
    assert first.outcome_code == "redeemed"
    before = runtime_ctx.fetchrow(
        "SELECT status, terminal_outcome_code, completed_at::text, "
        "result_grant_id::text, result_state, result_redeemed_at::text, "
        "coalesce(result_source_binding_hash, ''), "
        "coalesce(result_application_record_version::text, '') "
        "FROM public.kyc_document_access_redemption_commands "
        "WHERE request_id = 'req-fp-pending-001'"
    )
    assert before and before[0] == "completed" and before[1] == "redeemed"
    before_grant = runtime_ctx.fetchrow(
        f"SELECT state, redemption_attempt_count::text, redeemed_at::text "
        f"FROM public.kyc_document_access_grants WHERE grant_reference_hash = "
        f"{_sql_literal(GRANT_FINGERPRINT)}"
    )
    before_audits = runtime_ctx.fetchval(
        "SELECT count(*)::text FROM public.kyc_document_access_events "
        "WHERE event_type = 'kyc.document.redeemed' AND request_id = 'req-fp-pending-001'"
    )
    changed = runtime_ctx.redeem(
        grant_hash=GRANT_FINGERPRINT,
        actor=ACTOR,
        request_id="req-fp-pending-001",
        channel=ALT_CHANNEL,
        binding=BINDING_OK,
        record_version=rv,
    )
    assert changed.outcome_code == "invalid_input"
    assert changed.grant_id is None
    assert changed.application_id is None
    assert changed.state is None
    assert changed.redeemed_at is None
    after = runtime_ctx.fetchrow(
        "SELECT status, terminal_outcome_code, completed_at::text, "
        "result_grant_id::text, result_state, result_redeemed_at::text, "
        "coalesce(result_source_binding_hash, ''), "
        "coalesce(result_application_record_version::text, '') "
        "FROM public.kyc_document_access_redemption_commands "
        "WHERE request_id = 'req-fp-pending-001'"
    )
    after_grant = runtime_ctx.fetchrow(
        f"SELECT state, redemption_attempt_count::text, redeemed_at::text "
        f"FROM public.kyc_document_access_grants WHERE grant_reference_hash = "
        f"{_sql_literal(GRANT_FINGERPRINT)}"
    )
    after_audits = runtime_ctx.fetchval(
        "SELECT count(*)::text FROM public.kyc_document_access_events "
        "WHERE event_type = 'kyc.document.redeemed' AND request_id = 'req-fp-pending-001'"
    )
    if after[0] != "completed" or after[1] != "redeemed" or after != before:
        raise ConfirmedImplementationDefect(
            "CONFIRMED IMPLEMENTATION DEFECT — TERMINAL LEDGER OVERWRITE"
        )
    assert after_grant == before_grant
    assert after_audits == before_audits == "1"


@pytest.mark.integration
def test_concurrent_single_winner(runtime_ctx: RuntimeContext, fixture_versions: dict[str, str]) -> None:
    rv = fixture_versions["ok"]

    def call(request_id: str) -> RedeemResult:
        local = RuntimeContext(
            pgdata=runtime_ctx.pgdata,
            db_name=runtime_ctx.db_name,
            host=runtime_ctx.host,
            port=runtime_ctx.port,
            log_path=runtime_ctx.log_path,
        )
        return local.redeem(
            grant_hash=GRANT_CONCURRENT,
            actor=ACTOR,
            request_id=request_id,
            binding=BINDING_OK,
            record_version=rv,
        )

    barrier = threading.Barrier(2)

    def worker(request_id: str) -> RedeemResult:
        barrier.wait(timeout=10)
        return call(request_id)

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [
            pool.submit(worker, "req-concurrent-a"),
            pool.submit(worker, "req-concurrent-b"),
        ]
        results = [future.result(timeout=30) for future in as_completed(futures)]

    outcomes = sorted(r.outcome_code or "" for r in results)
    assert outcomes.count("redeemed") == 1
    assert outcomes.count("grant_redeemed") == 1
    success_audits = runtime_ctx.fetchval(
        "SELECT count(*)::text FROM public.kyc_document_access_events "
        "WHERE event_type = 'kyc.document.redeemed' AND grant_reference_hash = "
        f"{_sql_literal(GRANT_CONCURRENT)}"
    )
    assert success_audits == "1"
    state = runtime_ctx.fetchval(
        f"SELECT state FROM public.kyc_document_access_grants WHERE grant_reference_hash = "
        f"{_sql_literal(GRANT_CONCURRENT)}"
    )
    assert state == "redeemed"


@pytest.mark.integration
def test_expiry_behavior(runtime_ctx: RuntimeContext, fixture_versions: dict[str, str]) -> None:
    rv = fixture_versions["ok"]
    future = runtime_ctx.redeem(
        grant_hash=GRANT_FUTURE,
        actor=ACTOR,
        request_id="req-expiry-future-001",
        binding=BINDING_OK,
        record_version=rv,
    )
    assert future.outcome_code == "redeemed"
    past = runtime_ctx.redeem(
        grant_hash=GRANT_EXPIRED_ISSUED,
        actor=ACTOR,
        request_id="req-expiry-past-001",
        binding=BINDING_OK,
        record_version=rv,
    )
    assert past.outcome_code == "grant_expired"
    state = runtime_ctx.fetchval(
        f"SELECT state FROM public.kyc_document_access_grants WHERE grant_reference_hash = "
        f"{_sql_literal(GRANT_EXPIRED_ISSUED)}"
    )
    assert state == "expired"
    already = runtime_ctx.redeem(
        grant_hash=GRANT_ALREADY_EXPIRED,
        actor=ACTOR,
        request_id="req-expiry-already-001",
        binding=BINDING_OK,
        record_version=rv,
    )
    assert already.outcome_code == "grant_expired"


@pytest.mark.integration
def test_actor_mismatch(runtime_ctx: RuntimeContext, fixture_versions: dict[str, str]) -> None:
    rv = fixture_versions["ok"]
    result = runtime_ctx.redeem(
        grant_hash=GRANT_BINDING_BAD,
        actor=WRONG_ACTOR,
        request_id="req-actor-mismatch-001",
        binding=BINDING_OK,
        record_version=rv,
    )
    assert result.outcome_code == "not_found_or_unauthorized"
    assert result.grant_id is None
    assert result.application_id is None
    ledger = runtime_ctx.fetchval(
        "SELECT count(*)::text FROM public.kyc_document_access_redemption_commands "
        "WHERE request_id = 'req-actor-mismatch-001'"
    )
    assert ledger == "0"


@pytest.mark.integration
def test_binding_and_version_mismatch(runtime_ctx: RuntimeContext, fixture_versions: dict[str, str]) -> None:
    rv = fixture_versions["ok"]
    binding_bad = runtime_ctx.redeem(
        grant_hash=GRANT_BINDING_BAD,
        actor=ACTOR,
        request_id="req-binding-bad-001",
        binding=BINDING_BAD,
        record_version=rv,
    )
    assert binding_bad.outcome_code == "not_found_or_unauthorized"
    state = runtime_ctx.fetchval(
        f"SELECT state FROM public.kyc_document_access_grants WHERE grant_reference_hash = "
        f"{_sql_literal(GRANT_BINDING_BAD)}"
    )
    assert state == "issued"
    version_bad = runtime_ctx.redeem(
        grant_hash=GRANT_VERSION_BAD,
        actor=ACTOR,
        request_id="req-version-bad-001",
        binding=BINDING_OK,
        record_version=fixture_versions["stale_current"],
    )
    assert version_bad.outcome_code == "not_found_or_unauthorized"
    null_version = runtime_ctx.redeem(
        grant_hash=GRANT_BINDING_BAD,
        actor=ACTOR,
        request_id="req-null-version-001",
        binding=BINDING_OK,
        record_version=None,
    )
    assert null_version.outcome_code == "invalid_input"


@pytest.mark.integration
def test_terminal_states(runtime_ctx: RuntimeContext, fixture_versions: dict[str, str]) -> None:
    rv = fixture_versions["ok"]
    revoked = runtime_ctx.redeem(
        grant_hash=GRANT_REVOKED,
        actor=ACTOR,
        request_id="req-terminal-revoked-001",
        binding=BINDING_OK,
        record_version=rv,
    )
    assert revoked.outcome_code == "grant_revoked"
    redeemed = runtime_ctx.redeem(
        grant_hash=GRANT_REDEEMED,
        actor=ACTOR,
        request_id="req-terminal-redeemed-001",
        binding=BINDING_OK,
        record_version=rv,
    )
    assert redeemed.outcome_code == "grant_redeemed"


@pytest.mark.integration
def test_grant_revoked_replay_persists_exact_result_snapshot(
    runtime_ctx: RuntimeContext, fixture_versions: dict[str, str]
) -> None:
    rv = fixture_versions["ok"]
    request_id = "req-revoked-replay-001"
    expected_grant_id = runtime_ctx.fetchval(
        f"SELECT id::text FROM public.kyc_document_access_grants "
        f"WHERE grant_reference_hash = {_sql_literal(GRANT_REVOKED)}"
    )
    assert expected_grant_id
    expected_meta = runtime_ctx.fetchrow(
        "SELECT application_id::text, document_type, source_binding_hash, "
        "application_record_version::text "
        f"FROM public.kyc_document_access_grants WHERE id = {_sql_literal(expected_grant_id)}::uuid"
    )
    assert expected_meta and len(expected_meta) == 4
    before_attempts = runtime_ctx.fetchval(
        f"SELECT redemption_attempt_count::text FROM public.kyc_document_access_grants "
        f"WHERE grant_reference_hash = {_sql_literal(GRANT_REVOKED)}"
    )
    first = runtime_ctx.redeem(
        grant_hash=GRANT_REVOKED,
        actor=ACTOR,
        request_id=request_id,
        binding=BINDING_OK,
        record_version=rv,
    )
    runtime_ctx.assert_output_safe(first)
    assert first.outcome_code == "grant_revoked"
    assert first.grant_id == expected_grant_id
    assert first.application_id == expected_meta[0] == APP_OK
    assert first.document_type == expected_meta[1] == "license"
    assert first.state == "revoked"
    assert first.redeemed_at is None
    assert first.source_binding_hash == expected_meta[2] == BINDING_OK
    assert first.application_record_version == expected_meta[3]

    after_first_attempts = runtime_ctx.fetchval(
        f"SELECT redemption_attempt_count::text FROM public.kyc_document_access_grants "
        f"WHERE grant_reference_hash = {_sql_literal(GRANT_REVOKED)}"
    )
    assert int(after_first_attempts) == int(before_attempts) + 1

    ledger = runtime_ctx.fetchrow(
        "SELECT status, terminal_outcome_code, coalesce(failure_reason_code, ''), "
        "result_grant_id::text, result_application_id::text, coalesce(result_document_type, ''), "
        "coalesce(result_state, ''), coalesce(result_redeemed_at::text, ''), "
        "coalesce(result_source_binding_hash, ''), "
        "coalesce(result_application_record_version::text, '') "
        f"FROM public.kyc_document_access_redemption_commands "
        f"WHERE grant_id = {_sql_literal(expected_grant_id)}::uuid "
        f"AND actor_admin_id = {_sql_literal(ACTOR)} "
        f"AND request_id = {_sql_literal(request_id)}"
    )
    assert ledger
    assert ledger[0] == "completed"
    assert ledger[1] == "grant_revoked"
    assert ledger[2] == "terminal_state_block"
    assert ledger[3] == first.grant_id
    assert ledger[4] == first.application_id
    assert ledger[5] == first.document_type
    assert ledger[6] == "revoked"
    assert ledger[7] == ""
    assert ledger[8] == first.source_binding_hash
    assert ledger[9] == first.application_record_version

    ledger_count = runtime_ctx.fetchval(
        "SELECT count(*)::text FROM public.kyc_document_access_redemption_commands "
        f"WHERE request_id = {_sql_literal(request_id)}"
    )
    assert ledger_count == "1"

    audit_before = runtime_ctx.fetchval(
        "SELECT count(*)::text FROM public.kyc_document_access_events "
        f"WHERE request_id = {_sql_literal(request_id)}"
    )

    replay = runtime_ctx.redeem(
        grant_hash=GRANT_REVOKED,
        actor=ACTOR,
        request_id=request_id,
        binding=BINDING_OK,
        record_version=rv,
    )
    runtime_ctx.assert_output_safe(replay)
    assert replay.outcome_code == first.outcome_code
    assert replay.grant_id == first.grant_id
    assert replay.application_id == first.application_id
    assert replay.document_type == first.document_type
    assert replay.state == first.state
    assert replay.redeemed_at == first.redeemed_at
    assert replay.source_binding_hash == first.source_binding_hash
    assert replay.application_record_version == first.application_record_version
    assert replay.as_text() == first.as_text()

    attempts_after_replay = runtime_ctx.fetchval(
        f"SELECT redemption_attempt_count::text FROM public.kyc_document_access_grants "
        f"WHERE grant_reference_hash = {_sql_literal(GRANT_REVOKED)}"
    )
    assert attempts_after_replay == after_first_attempts
    assert runtime_ctx.fetchval(
        "SELECT count(*)::text FROM public.kyc_document_access_redemption_commands "
        f"WHERE request_id = {_sql_literal(request_id)}"
    ) == "1"
    assert runtime_ctx.fetchval(
        "SELECT count(*)::text FROM public.kyc_document_access_events "
        f"WHERE request_id = {_sql_literal(request_id)}"
    ) == audit_before

    ledger_blob = runtime_ctx.fetchval(
        "SELECT string_agg(coalesce(result_grant_id::text, '') || '|' || "
        "coalesce(result_application_id::text, '') || '|' || "
        "coalesce(result_document_type, '') || '|' || "
        "coalesce(result_state, '') || '|' || "
        "coalesce(result_source_binding_hash, '') || '|' || "
        "coalesce(result_application_record_version::text, ''), '||') "
        "FROM public.kyc_document_access_redemption_commands "
        f"WHERE request_id = {_sql_literal(request_id)}"
    )
    assert not FORBIDDEN_OUTPUT_PATTERNS.search(ledger_blob or "")


@pytest.mark.integration
def test_unknown_and_malformed_hash(runtime_ctx: RuntimeContext, fixture_versions: dict[str, str]) -> None:
    rv = fixture_versions["ok"]
    unknown = runtime_ctx.redeem(
        grant_hash=UNKNOWN_HASH,
        actor=ACTOR,
        request_id="req-unknown-001",
        binding=BINDING_OK,
        record_version=rv,
    )
    assert unknown.outcome_code == "not_found_or_unauthorized"
    assert unknown.grant_id is None
    malformed = runtime_ctx.redeem(
        grant_hash="not-a-valid-hash",
        actor=ACTOR,
        request_id="req-malformed-001",
        binding=BINDING_OK,
        record_version=rv,
    )
    assert malformed.outcome_code == "invalid_input"


@pytest.mark.integration
def test_audit_failure_injection(runtime_ctx: RuntimeContext, fixture_versions: dict[str, str]) -> None:
    rv = fixture_versions["ok"]
    runtime_ctx.psql(
        """
        CREATE OR REPLACE FUNCTION public._d7_test_block_redeemed_audit()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.event_type = 'kyc.document.redeemed'
             AND NEW.request_id = 'req-audit-fail-001' THEN
            RAISE EXCEPTION 'd7_test_audit_injection' USING ERRCODE = 'P0001';
          END IF;
          RETURN NEW;
        END;
        $$;
        DROP TRIGGER IF EXISTS d7_test_block_redeemed_audit ON public.kyc_document_access_events;
        CREATE TRIGGER d7_test_block_redeemed_audit
          BEFORE INSERT ON public.kyc_document_access_events
          FOR EACH ROW EXECUTE FUNCTION public._d7_test_block_redeemed_audit();
        """,
        tuples_only=False,
    )
    try:
        trigger_count = runtime_ctx.fetchval(
            "SELECT count(*)::text FROM pg_trigger WHERE tgname = 'd7_test_block_redeemed_audit'"
        )
        assert trigger_count == "1"
        before_state = runtime_ctx.fetchval(
            f"SELECT state FROM public.kyc_document_access_grants WHERE grant_reference_hash = "
            f"{_sql_literal(GRANT_AUDIT_FAIL)}"
        )
        before_attempts = runtime_ctx.fetchval(
            f"SELECT redemption_attempt_count::text FROM public.kyc_document_access_grants "
            f"WHERE grant_reference_hash = {_sql_literal(GRANT_AUDIT_FAIL)}"
        )
        result = runtime_ctx.redeem(
            grant_hash=GRANT_AUDIT_FAIL,
            actor=ACTOR,
            request_id="req-audit-fail-001",
            binding=BINDING_OK,
            record_version=rv,
        )
        assert result.outcome_code == "audit_unavailable"
        assert result.grant_id is None
        assert result.application_id is None
        assert result.state is None
        assert result.redeemed_at is None
        after_state = runtime_ctx.fetchval(
            f"SELECT state FROM public.kyc_document_access_grants WHERE grant_reference_hash = "
            f"{_sql_literal(GRANT_AUDIT_FAIL)}"
        )
        after_redeemed_at = runtime_ctx.fetchval(
            f"SELECT coalesce(redeemed_at::text, 'null') FROM public.kyc_document_access_grants "
            f"WHERE grant_reference_hash = {_sql_literal(GRANT_AUDIT_FAIL)}"
        )
        assert after_state == before_state == "issued"
        assert after_redeemed_at == "null"
        success_audits = runtime_ctx.fetchval(
            "SELECT count(*)::text FROM public.kyc_document_access_events "
            "WHERE event_type = 'kyc.document.redeemed' AND request_id = 'req-audit-fail-001'"
        )
        assert success_audits == "0"
        ledger_row = runtime_ctx.fetchrow(
            "SELECT coalesce(status, 'missing'), coalesce(terminal_outcome_code, ''), "
            "coalesce(failure_reason_code, '') "
            "FROM public.kyc_document_access_redemption_commands "
            "WHERE request_id = 'req-audit-fail-001'"
        )
        after_attempts = runtime_ctx.fetchval(
            f"SELECT redemption_attempt_count::text FROM public.kyc_document_access_grants "
            f"WHERE grant_reference_hash = {_sql_literal(GRANT_AUDIT_FAIL)}"
        )
        assert after_attempts == before_attempts
        ledger_status = ledger_row[0] if ledger_row else "missing"
        atomicity_violations: list[str] = []
        if after_state != "issued":
            atomicity_violations.append("grant state changed from issued")
        if after_redeemed_at != "null":
            atomicity_violations.append("redeemed_at became non-null")
        if after_attempts != before_attempts:
            atomicity_violations.append("redemption_attempt_count changed after audit failure")
        if success_audits != "0":
            atomicity_violations.append("redeemed audit event persisted")
        if ledger_status == "pending":
            atomicity_violations.append("ledger remains pending")
        if ledger_status == "completed":
            atomicity_violations.append("ledger incorrectly reports completed success")
        if atomicity_violations:
            raise ConfirmedImplementationDefect(
                "CONFIRMED IMPLEMENTATION DEFECT — AUDIT FAILURE ATOMICITY: "
                + "; ".join(atomicity_violations)
            )
        assert ledger_row is not None
        assert ledger_row[0] == "failed"
        assert ledger_row[1] == "audit_unavailable"
        assert ledger_row[2] == ""
    finally:
        runtime_ctx.psql(
            """
            DROP TRIGGER IF EXISTS d7_test_block_redeemed_audit ON public.kyc_document_access_events;
            DROP FUNCTION IF EXISTS public._d7_test_block_redeemed_audit();
            """,
            tuples_only=False,
        )
        assert runtime_ctx.fetchval(
            "SELECT count(*)::text FROM pg_trigger WHERE tgname = 'd7_test_block_redeemed_audit'"
        ) == "0"


@pytest.mark.integration
def test_ledger_hardening_gap(runtime_ctx: RuntimeContext, fixture_versions: dict[str, str]) -> None:
    rv = fixture_versions["ok"]
    runtime_ctx.redeem(
        grant_hash=GRANT_BINDING_BAD,
        actor=ACTOR,
        request_id="req-ledger-hard-001",
        binding=BINDING_OK,
        record_version=rv,
    )
    runtime_ctx.psql(
        "UPDATE public.kyc_document_access_redemption_commands SET status = 'pending', "
        "terminal_outcome_code = NULL, completed_at = NULL "
        "WHERE request_id = 'req-ledger-hard-001';",
        tuples_only=False,
    )
    status = runtime_ctx.fetchval(
        "SELECT status FROM public.kyc_document_access_redemption_commands WHERE request_id = 'req-ledger-hard-001'"
    )
    assert status == "pending"


@pytest.mark.integration
def test_privileges(runtime_ctx: RuntimeContext, fixture_versions: dict[str, str]) -> None:
    rv = fixture_versions["ok"]
    for role in ("anon", "authenticated"):
        with pytest.raises(RuntimeError):
            runtime_ctx.psql(
                "SELECT outcome_code FROM public.kyc_document_access_redeem_grant("
                f"{_sql_literal(GRANT_PRIV)}, {_sql_literal(ACTOR)}, 'req-priv-deny', "
                f"{_sql_literal(CHANNEL)}, {_sql_literal(BINDING_OK)}, {_sql_literal(rv)}::timestamptz)",
                role=role,
            )
    allowed = runtime_ctx.redeem(
        grant_hash=GRANT_PRIV,
        actor=ACTOR,
        request_id="req-priv-allow-001",
        binding=BINDING_OK,
        record_version=rv,
        role="service_role",
    )
    assert allowed.outcome_code == "redeemed"


@pytest.mark.integration
def test_output_safety_all_outcomes(runtime_ctx: RuntimeContext, fixture_versions: dict[str, str]) -> None:
    rv = fixture_versions["ok"]
    samples = [
        runtime_ctx.redeem(
            grant_hash=UNKNOWN_HASH,
            actor=ACTOR,
            request_id="req-out-unknown",
            binding=BINDING_OK,
            record_version=rv,
        ),
        runtime_ctx.redeem(
            grant_hash="zzzz",
            actor=ACTOR,
            request_id="req-out-malformed",
            binding=BINDING_OK,
            record_version=rv,
        ),
    ]
    for sample in samples:
        runtime_ctx.assert_output_safe(sample)
