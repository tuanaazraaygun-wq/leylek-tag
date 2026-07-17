"""Phase 3G — staging must not load production /etc/leylektag.env fallback."""

from __future__ import annotations

import importlib
import sys
from pathlib import Path
from typing import Any, List

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PRODUCT_ENV = "/etc/leylektag.env"
PRODUCT_REF = "ujvploftywsxprlzejgc"
FAKE_PRODUCT_URL = f"https://{PRODUCT_REF}.supabase.co"


@pytest.fixture()
def env_loading_mod():
    if str(BACKEND_ROOT) not in sys.path:
        sys.path.insert(0, str(BACKEND_ROOT))
    import runtime_env_loading as mod

    return importlib.reload(mod)


def test_should_load_false_only_for_exact_staging(
    env_loading_mod, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("APP_ENV", "staging")
    assert env_loading_mod.should_load_product_runtime_env() is False


@pytest.mark.parametrize(
    "value",
    ["production", "development", "test", "Staging", " staging", "staging ", "STAGING", ""],
)
def test_should_load_true_for_non_exact_staging(
    env_loading_mod, monkeypatch: pytest.MonkeyPatch, value: str
) -> None:
    if value == "":
        monkeypatch.delenv("APP_ENV", raising=False)
    else:
        monkeypatch.setenv("APP_ENV", value)
    assert env_loading_mod.should_load_product_runtime_env() is True


def test_staging_never_calls_product_env_loader(
    env_loading_mod, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("APP_ENV", "staging")
    local = tmp_path / ".env"
    local.write_text("PLACEHOLDER=1\n", encoding="utf-8")
    calls: List[str] = []

    def fake_load(path: Any, override: bool = False) -> None:
        calls.append(str(path))
        assert str(path) != PRODUCT_ENV

    attempted = env_loading_mod.load_backend_dotenv_files(
        fake_load, local_env_path=local, override=True
    )
    assert PRODUCT_ENV not in attempted
    assert PRODUCT_ENV not in calls
    assert str(local) in attempted
    assert calls == [str(local)]


def test_production_still_loads_product_then_local(
    env_loading_mod, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    local = tmp_path / ".env"
    local.write_text("LOCAL_ONLY=1\n", encoding="utf-8")
    calls: List[str] = []

    def fake_load(path: Any, override: bool = False) -> None:
        calls.append(str(path))

    attempted = env_loading_mod.load_backend_dotenv_files(
        fake_load, local_env_path=local, override=True
    )
    assert attempted == [PRODUCT_ENV, str(local)]
    assert calls == [PRODUCT_ENV, str(local)]


def test_missing_app_env_preserves_product_fallback(
    env_loading_mod, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("APP_ENV", raising=False)
    local = tmp_path / ".env"
    local.write_text("LOCAL_ONLY=1\n", encoding="utf-8")
    calls: List[str] = []

    def fake_load(path: Any, override: bool = False) -> None:
        calls.append(str(path))

    env_loading_mod.load_backend_dotenv_files(fake_load, local_env_path=local, override=True)
    assert calls[0] == PRODUCT_ENV
    assert calls[1] == str(local)


def test_staging_process_values_not_overwritten_by_product_file(
    env_loading_mod, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Staging keeps EnvironmentFile values; product path is never loaded."""
    import os

    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.setenv("SUPABASE_URL", "https://example-staging.invalid")
    monkeypatch.setenv("CUSTOM_STAGING_FLAG", "keep-me")
    local = tmp_path / ".env"
    local.write_text("", encoding="utf-8")

    def boom_if_product(path: Any, override: bool = False) -> None:
        if str(path) == PRODUCT_ENV:
            raise AssertionError("product env must not load in staging")
        return None

    env_loading_mod.load_backend_dotenv_files(
        boom_if_product, local_env_path=local, override=True
    )
    assert os.getenv("SUPABASE_URL") == "https://example-staging.invalid"
    assert os.getenv("CUSTOM_STAGING_FLAG") == "keep-me"
    assert PRODUCT_REF not in (os.getenv("SUPABASE_URL") or "")


def test_product_supabase_url_cannot_leak_via_product_file_in_staging(
    env_loading_mod, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    import os

    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.setenv("SUPABASE_URL", "https://example-staging.invalid")
    local = tmp_path / ".env"
    local.write_text("", encoding="utf-8")

    def product_polluter(path: Any, override: bool = False) -> None:
        # If product file were loaded, it would stamp the product ref into env.
        if str(path) == PRODUCT_ENV:
            monkeypatch.setenv("SUPABASE_URL", FAKE_PRODUCT_URL)

    env_loading_mod.load_backend_dotenv_files(
        product_polluter, local_env_path=local, override=True
    )
    assert os.getenv("SUPABASE_URL") == "https://example-staging.invalid"
    assert PRODUCT_REF not in (os.getenv("SUPABASE_URL") or "")


def test_call_site_sources_use_helper_not_raw_product_load() -> None:
    for name in ("server.py", "supabase_client.py", "api_session_jwt.py"):
        src = (BACKEND_ROOT / name).read_text(encoding="utf-8")
        assert "load_backend_dotenv_files" in src, name
        assert 'load_dotenv("/etc/leylektag.env"' not in src, name


def test_real_product_env_file_not_opened_by_helper(
    env_loading_mod, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("APP_ENV", "staging")
    opened: List[str] = []
    real_open = open

    def tracking_open(file, *args, **kwargs):  # type: ignore[no-untyped-def]
        opened.append(str(file))
        if str(file) == PRODUCT_ENV:
            raise AssertionError("must not open real product env file in tests")
        return real_open(file, *args, **kwargs)

    monkeypatch.setattr("builtins.open", tracking_open)
    local = tmp_path / ".env"
    local.write_text("X=1\n", encoding="utf-8")
    from dotenv import load_dotenv

    env_loading_mod.load_backend_dotenv_files(
        load_dotenv, local_env_path=local, override=True
    )
    assert PRODUCT_ENV not in opened


def test_three_call_sites_consistent_behavior(
    env_loading_mod, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Same helper outcome for the three historical load sites."""
    local = tmp_path / ".env"
    local.write_text("", encoding="utf-8")

    for app_env, expect_product in (("staging", False), ("production", True), (None, True)):
        if app_env is None:
            monkeypatch.delenv("APP_ENV", raising=False)
        else:
            monkeypatch.setenv("APP_ENV", app_env)
        for _site in ("server", "supabase_client", "api_session_jwt"):
            calls: List[str] = []

            def fake_load(path: Any, override: bool = False, _c=calls) -> None:
                _c.append(str(path))

            env_loading_mod.load_backend_dotenv_files(
                fake_load, local_env_path=local, override=True
            )
            if expect_product:
                assert calls[0] == PRODUCT_ENV
            else:
                assert PRODUCT_ENV not in calls


def test_import_smoke_api_session_jwt_and_supabase_client_under_staging(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """
    Import api_session_jwt + supabase_client with APP_ENV=staging while mocking
    load_dotenv so /etc/leylektag.env is never consulted. Does not import server.py.
    """
    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if str(BACKEND_ROOT) not in sys.path:
        sys.path.insert(0, str(BACKEND_ROOT))

    calls: List[str] = []

    def fake_load(path: Any, override: bool = False) -> bool:
        p = str(path)
        calls.append(p)
        assert p != PRODUCT_ENV
        return False

    monkeypatch.setattr("dotenv.load_dotenv", fake_load)

    # Drop cached modules so import-time dotenv runs again under our mock.
    for name in (
        "runtime_env_loading",
        "api_session_jwt",
        "supabase_client",
    ):
        sys.modules.pop(name, None)

    import api_session_jwt  # noqa: F401
    import supabase_client  # noqa: F401

    assert PRODUCT_ENV not in calls
    assert any(c.endswith(".env") for c in calls)
