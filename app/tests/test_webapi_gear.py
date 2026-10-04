"""webapi gear surface: JSON round trip, armory icons, upgrade ordering, max-potential shape (real items.json)."""
import json
import time
from pathlib import Path

import pytest

from aion2c import webapi

FX = Path(__file__).parent / "fixtures" / "armory"


def load(name):
    return json.loads((FX / name).read_text(encoding="utf-8"))


def js(x):
    return json.loads(json.dumps(x))  # the Pyodide boundary


@pytest.fixture(scope="module")
def raw():
    return js({"info": load("info.json"), "equipment": load("equipment.json"),
               "daevanion": {str(b): load(f"daevanion_{b}.json") for b in (61, 63, 64)}})


@pytest.fixture(scope="module")
def build(raw):
    return js(webapi.import_character(raw, None))["build"]


def test_register_items_overrides_disk(monkeypatch):
    monkeypatch.setattr(webapi, "_ITEMS", None)
    webapi.register_items({"schema": 1, "items": [{"id": "7", "name": "x"}]})
    assert webapi._items() == {7: {"id": "7", "name": "x"}}


def test_gear_upgrades_shape(raw, build):
    out = js(webapi.gear_upgrades(raw, build, "boss", steps=5))
    assert set(out) == {"equipped", "upgrades", "notes", "assumptions"}
    assert out["assumptions"] and len(out["equipped"]) >= 15
    weapon = next(e for e in out["equipped"] if e["slot"] == "weapon")
    assert weapon["name"] == "Liberator Spellbook" and weapon["enchant"] == 10
    assert weapon["icon"].endswith("Icon_WP_MB_0067_T05.png")  # the armory's own icon wins
    ups = out["upgrades"]
    assert 1 <= len(ups) <= 5
    assert ups[0]["dps_gain_pct"] == max(u["dps_gain_pct"] for u in ups)
    for u in ups:
        assert u["kind"] in ("item", "enchant") and u["dps_gain_pct"] > 0 and u["reachable"] is True
        assert u["to"]["name"] and u["source"] and u["icon"].startswith("https://")
        if u["kind"] == "enchant":
            assert u["from"]["id"] == u["to"]["id"] and u["to"]["enchant"] == u["to"]["max_enchant"]


def test_gear_upgrades_unknown_items_noted(raw, build):
    bad = json.loads(json.dumps(raw))
    bad["equipment"]["equipment"]["equipmentList"] = [{"id": 1, "name": "?", "slotPos": 1, "enchantLevel": 0}]
    out = webapi.gear_upgrades(bad, build, "boss")
    assert out["equipped"] == [] and out["upgrades"] == [] and any("not in the item table" in n for n in out["notes"])


def test_gear_upgrades_bad_playstyle(raw, build):
    with pytest.raises(KeyError):
        webapi.gear_upgrades(raw, build, "nope")


def test_max_potential_shape_and_gap(raw, build):
    t = time.time()
    out = js(webapi.max_potential("sorcerer", "boss", True, build, raw))
    assert time.time() - t < 120
    assert out["gear"] and all(g["reachable"] and g["enchant"] == g["max_enchant"] for g in out["gear"])
    assert {"weapon", "torso"} <= {g["slot"] for g in out["gear"]}
    assert out["dps"] > 0 and out["gear_gain_pct"] > 0
    assert out["current_dps"] > 0 and out["gain_vs_current_pct"] is not None
    assert out["build"]["daevanion_nodes"] >= 84 and "stigmas" in out["build"]
    assert out["assumptions"] and out["notes"]
    # the realistic tier: current gear + only the Daevanion nodes already opened, so below the all-points ceiling
    now = out["with_current_gear"]
    assert now["daevanion_nodes"] == len(build["daevanion_nodes"]) == 84
    assert out["build"]["daevanion_nodes"] > now["daevanion_nodes"]  # the ceiling opens far more
    assert 0 < now["dps"] < out["dps"]
    assert len(now["stigmas"]) == 4 and all(k["name"] for k in now["stigmas"])


def test_max_potential_without_build():
    out = js(webapi.max_potential("sorcerer", "boss"))
    assert out["gain_vs_current_pct"] is None and out["current_dps"] is None and out["gear"]
    assert out["with_current_gear"] is None  # no character: nothing "current" to report
