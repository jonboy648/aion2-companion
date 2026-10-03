"""P1 acceptance tests: update.parse_skill_page and diff_gamedata. Offline (fixture HTML only)."""
import dataclasses
from pathlib import Path

import pytest

from aion2c.data.loader import load_gamedata
from aion2c.data.update import diff_gamedata, parse_skill_page

FIXTURE = Path(__file__).parent / "fixtures" / "aion2app_skill_page.html"


@pytest.fixture(scope="module")
def page():
    return parse_skill_page(FIXTURE.read_text(encoding="utf-8"))


def test_parse_skill_page(page):
    assert page["name"] == "Firestorm"
    assert page["skill_id"] == 15040000
    assert page["icon"] == "ICON_SO_SKILL_004"
    assert page["class"] == "Sorcerer"
    assert page["required_level"] == 1 and page["max_level"] == 40
    assert page["cooldown_s"] == 5.0 and page["range_m"] == 20.0
    assert "Fire damage" in page["description"]
    assert page["date_modified"] == "2026-09-18"


def test_parse_per_level(page):
    pl = page["per_level"]
    assert [p["level"] for p in pl] == list(range(1, 41))
    assert pl[0] == {"level": 1, "cooldown_s": 5.0, "cost_mp": 250.0, "dmg_min": 114.0, "dmg_max": 114.0}
    assert pl[1]["dmg_min"] == 197.0 and pl[-1]["dmg_max"] == 4189.0


def test_parse_matches_shipped_data(page):
    """The fixture page is the source of the shipped Firestorm numbers."""
    gd = load_gamedata()
    sk = gd.skills["firestorm"]
    for p, r in zip(page["per_level"], sk.ranks):
        assert (p["dmg_min"], p["dmg_max"], p["cooldown_s"], p["cost_mp"]) == (
            r.flat_min.value, r.flat_max.value, r.cooldown_s.value, r.mp_cost.value)


def test_diff_no_change():
    gd = load_gamedata()
    assert diff_gamedata(gd, gd) == []


def test_diff_detects_change():
    old = load_gamedata()
    sk = old.skills["firestorm"]
    r0 = dataclasses.replace(sk.ranks[0], cooldown_s=dataclasses.replace(sk.ranks[0].cooldown_s, value=6.0))
    new = dataclasses.replace(old, skills={**old.skills, "firestorm": dataclasses.replace(sk, ranks=(r0, *sk.ranks[1:]))})
    lines = diff_gamedata(old, new)
    assert len(lines) == 1
    assert "firestorm" in lines[0] and "cooldown_s" in lines[0] and "5.0 -> 6.0" in lines[0]


def test_diff_added_removed_skill():
    old = load_gamedata()
    new = dataclasses.replace(old, skills={k: v for k, v in old.skills.items() if k != "dodge"})
    assert diff_gamedata(old, new) == ["skill 'dodge' (Dodge): removed"]
    assert diff_gamedata(new, old) == ["skill 'dodge' (Dodge): added"]
