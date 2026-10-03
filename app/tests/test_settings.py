import json

import pytest

import aion2c.settings as settings
from aion2c.ui.hotkey import parse_hotkey


def test_parse_hotkey():
    assert parse_hotkey("Ctrl+Alt+P") == (0x0002 | 0x0001, 0x50)
    assert parse_hotkey("Shift+F9") == (0x0004, 0x78)


def test_parse_hotkey_bad():
    with pytest.raises(ValueError):
        parse_hotkey("Ctrl+Alt")


def test_settings_roundtrip(tmp_path):
    p = tmp_path / "sub" / "user.json"
    d = settings.load_user(p)  # missing file -> defaults
    assert d == settings.DEFAULT_USER and d is not settings.DEFAULT_USER
    d["anim_overrides"] = {"strike": 1.4}
    d["macro_keys"]["boss"] = "F8"
    settings.save_user(d, p)
    assert settings.load_user(p) == d
    assert settings.last_saved_hash(p) == settings.content_hash(p)


def test_settings_fills_missing_keys(tmp_path):
    p = tmp_path / "user.json"
    p.write_text(json.dumps({"hotkey": "Ctrl+Shift+Q", "panel": {"opacity": 0.5}}), encoding="utf-8")
    d = settings.load_user(p)
    assert d["hotkey"] == "Ctrl+Shift+Q"
    assert d["panel"] == {"opacity": 0.5, "click_through": False, "x": None, "y": None}
    assert d["macro_keys"] == {"boss": "F9", "aoe": "F10"}


def test_settings_corrupt_file_gives_defaults(tmp_path):
    p = tmp_path / "user.json"
    p.write_text("{not json", encoding="utf-8")
    assert settings.load_user(p) == settings.DEFAULT_USER


def test_user_path_env(user_path):
    assert settings.user_path() == user_path
