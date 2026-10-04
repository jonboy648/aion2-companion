"""webapi round trips on real game data. Every output must survive json.dumps (the Pyodide boundary)."""
import json
from pathlib import Path

import pytest

from aion2c import webapi

FX = Path(__file__).parent / "fixtures" / "armory"


def load(name):
    return json.loads((FX / name).read_text(encoding="utf-8"))


def js(x):
    """JSON round trip: what the browser sees / sends back."""
    return json.loads(json.dumps(x))


@pytest.fixture(scope="module")
def raw():
    r = {"info": load("info.json"), "equipment": load("equipment.json"),
         "daevanion": {str(b): load(f"daevanion_{b}.json") for b in (61, 63, 64)}}
    return js(r)


@pytest.fixture(scope="module")
def imported(raw):
    return js(webapi.import_character(raw, None))


def test_list_classes():
    cl = js(webapi.list_classes())
    keys = {c["key"] for c in cl}
    assert "sorcerer" in keys and len(keys) >= 2
    assert all(set(c) == {"key", "name", "role"} for c in cl)


@pytest.mark.parametrize("key", ["sorcerer", "assassin"])
def test_gamedata_round_trip(key):
    d = js(webapi.gamedata(key))
    assert d["class_key"] == key and d["skills"] and d["rank_caps"]["global"]
    # the browser can hand it back and get the same data
    webapi.register_gamedata(key, d)
    assert js(webapi.gamedata(key)) == d


def test_import_character_sorcerer(imported):
    assert set(imported) == {"build", "notes", "profile", "gear", "stigmas", "daevanion_summary"}
    b = imported["build"]
    assert b["name"] == "DarthThot" and b["level"] == 44 and b["class_key"] == "sorcerer"
    assert len(b["stigmas"]) == 4 and len(b["daevanion_nodes"]) == 84
    assert imported["profile"]["class_key"] == "sorcerer" and imported["profile"]["server"] == "Triniel"
    ds = imported["daevanion_summary"]
    assert ds["open"] == 84 and ds["matched"] == 84
    assert imported["gear"] and all("slot" in g for g in imported["gear"])
    assert any("Imported level 44" in n for n in imported["notes"])


def test_import_character_keeps_base_stats(raw):
    base = {"name": "Me", "region": "global", "level": 10, "stats": {"attack": 1234, "crit_dmg_pct": 77}}
    b = js(webapi.import_character(raw, base))["build"]
    assert b["stats"]["attack"] == 1234 and b["stats"]["crit_dmg_pct"] == 77


def test_compare_and_follow_ups(imported):
    build = imported["build"]
    cmp_ = js(webapi.compare(build, None))
    assert set(cmp_) == {"boss", "aoe", "leveling", "burst"}
    fb = cmp_["boss"]
    assert fb["result"]["dps"] > 0 and fb["variants"] and fb["priority"]["entries"]
    # optimize one playstyle agrees on shape
    one = js(webapi.optimize(build, "boss", None))
    assert set(one) == set(fb) and one["result"]["dps"] > 0
    # marginal
    gains = js(webapi.marginal(build, fb["priority"], "boss_180"))
    assert gains and {"stat", "delta", "dps_gain_pct", "confidence"} <= set(gains[0])
    # keybinds
    kb = js(webapi.keybinds(build, {"boss_180": fb["priority"], "aoe_pack": cmp_["aoe"]["priority"]}, {}, None, 10))
    assert kb["plan"]["stacks"] and "# Aion 2 keybind setup sheet" in kb["instructions_markdown"]
    plan = kb["plan"]
    assert {"hybrid_dps", "slot_notes", "macro_advice", "rotation", "thumbs"} <= set(plan)
    assert set(plan["slot_notes"]) == {s["key_label"] for s in plan["stacks"]}
    # rotation_explained rides on every FullBuild and matches that build's own sim
    for f in (fb, one):
        rx = f["rotation_explained"]
        assert rx["scenario"] == f["playstyle"]["scenario"]["key"] and rx["opener"] and rx["core"]
        cast = {k for k, v in f["result"]["per_skill"].items() if v["casts"]}
        assert {e["skill_key"] for e in rx["priority"]} <= cast
    # daevanion suggest (points-limited)
    sug = js(webapi.daevanion_suggest(build, 5))
    assert sug["spent"] <= 5 and len(sug["path"]) == len(sug["nodes"])


def test_progress_callback(imported):
    seen = []
    webapi.optimize(imported["build"], "leveling", None, progress=seen.append)
    assert seen


def test_second_class_flow():
    build = js({"name": "Stab", "region": "global", "level": 30, "class_key": "assassin"})
    fb = js(webapi.optimize(build, "boss", None))
    assert fb["result"]["dps"] > 0 and fb["build"]["class_key"] == "assassin"
    kb = js(webapi.keybinds(build, {"boss_180": fb["priority"]}, {}, None, 10))
    assert kb["plan"]["stacks"] and fb["rotation_explained"]["opener"]


@pytest.mark.parametrize("key", ["sorcerer", "assassin"])
def test_roadmap_shopping_icons(key):
    rm = js(webapi.roadmap(key, "global", None))
    assert rm and {"level", "kind", "text", "regions"} <= set(rm[0])
    assert [i["level"] for i in rm] == sorted(i["level"] for i in rm)
    icons = js(webapi.icon_urls(key))
    gd = webapi.gamedata(key)
    assert set(icons) == set(gd["skills"])
    urls = [u for u in icons.values() if u]
    assert urls and all(u.startswith("https://assets.playnccdn.com/static-aion2-gamedata/resources/ICON_") for u in urls)
    assert len(urls) / len(icons) > 0.6


def test_shopping_list():
    recipes = webapi.gamedata("sorcerer")["recipes"]
    if not recipes:
        pytest.skip("no recipes in data")
    rid = recipes[0]["id"]
    one = js(webapi.shopping("sorcerer", {str(rid): 1}, True))  # JSON keys are strings
    two = js(webapi.shopping("sorcerer", {str(rid): 2}, True))
    assert one and {"item", "qty", "source"} <= set(one[0])
    assert {m["item"]: m["qty"] * 2 for m in one} == {m["item"]: m["qty"] for m in two}


def test_unknown_class_and_scenario():
    with pytest.raises(KeyError):
        webapi.gamedata("nope")
    with pytest.raises(KeyError):
        webapi.marginal({"name": "x", "region": "global", "level": 5}, {"entries": []}, "bogus")
