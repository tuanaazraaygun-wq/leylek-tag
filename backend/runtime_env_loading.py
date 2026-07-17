"""
Product runtime env-file loading gate (staging isolation).

When APP_ENV is exactly ``staging``, the production fallback file
``/etc/leylektag.env`` must not be loaded. Staging relies on process
EnvironmentFile (and optional local backend ``.env`` only).

Exact match only — no strip, no case-fold, no truthy coercion.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Callable, List, Union

PRODUCT_RUNTIME_ENV_FILE = "/etc/leylektag.env"
STAGING_APP_ENV = "staging"

PathLike = Union[str, Path]
LoadDotenvFn = Callable[..., object]


def should_load_product_runtime_env() -> bool:
    """False only when APP_ENV is exactly ``staging``."""
    return os.getenv("APP_ENV") != STAGING_APP_ENV


def load_backend_dotenv_files(
    load_dotenv_fn: LoadDotenvFn,
    *,
    local_env_path: PathLike,
    override: bool = True,
) -> List[str]:
    """
    Load production fallback env file when allowed, then local backend ``.env``.

    Returns the list of paths for which a load was *attempted* (assert/test hook).
    Never returns env values.
    """
    attempted: List[str] = []
    if should_load_product_runtime_env():
        attempted.append(PRODUCT_RUNTIME_ENV_FILE)
        try:
            load_dotenv_fn(PRODUCT_RUNTIME_ENV_FILE, override=override)
        except Exception:
            pass
    local = str(local_env_path)
    attempted.append(local)
    try:
        load_dotenv_fn(local_env_path, override=override)
    except Exception:
        pass
    return attempted
