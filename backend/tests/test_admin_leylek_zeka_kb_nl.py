"""admin_kb nl-turn — DB yok; helper'lar mock."""
from __future__ import annotations

import pytest


@pytest.fixture()
def kb_mod(monkeypatch: pytest.MonkeyPatch):
    import routes.admin_leylek_zeka_kb as mod

    monkeypatch.setattr(
        mod,
        "_kb_list",
        lambda active_only, limit, offset: {"items": [{"id": "a1"}], "limit": limit, "offset": offset},
    )
    monkeypatch.setattr(mod, "_kb_rows_for_search", lambda limit=250: [])
    monkeypatch.setattr(
        mod,
        "_kb_insert",
        lambda admin_uid, phrases, body, priority=0: {
            "id": "new1",
            "trigger_phrases": phrases,
            "body": body,
            "is_active": True,
        },
    )
    monkeypatch.setattr(
        mod,
        "_kb_deactivate",
        lambda admin_uid, item_id: {"id": item_id, "is_active": False},
    )
    return mod


def test_nl_listele(kb_mod) -> None:
    r = kb_mod._handle_nl_turn("listele", "u1")
    assert r["kind"] == "list_result"
    assert len(r["items"]) == 1


def test_nl_ara_empty_clarify(kb_mod) -> None:
    r = kb_mod._handle_nl_turn("ara x", "u1")
    assert r["kind"] == "clarify"


def test_nl_learn_clarify_short(kb_mod) -> None:
    r = kb_mod._handle_nl_turn("öğren", "u1")
    assert r["kind"] == "clarify"


def test_nl_learn_execute(kb_mod) -> None:
    r = kb_mod._handle_nl_turn("öğren a, b >>> gövde metin", "u1")
    assert r["kind"] == "executed"
    assert r["item"]["id"] == "new1"


def test_nl_unknown(kb_mod) -> None:
    r = kb_mod._handle_nl_turn("rastgele metin", "u1")
    assert r["kind"] == "clarify"
