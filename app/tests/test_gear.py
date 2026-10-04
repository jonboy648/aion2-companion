"""gear: stats math, BIS ranking (simulator patched), upgrade-path ordering, reachable filter, armory mapping."""
import json
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import pytest

from aion2c import gear
from aion2c.models import CharacterBuild, Stats

FIX = Path(__file__).parent / "fixtures" / "items_small.json"
EQUIP_SAMPLE = Path(__file__).parents[2] / "research" / "armory_samples" / "equipment.json"

LIBERATOR, LUNATIC, LUDRA, GLAD_BLADE = 110540035, 110540053, 110520003, 110120003


@pytest.fixture(scope="module")
def items():
    return gear.load_items(FIX)


def fake_dps(stats: Stats) -> float:
    crit = min(stats.crit_chance_pct, 80) / 100 * stats.crit_dmg_pct / 100
    return (stats.attack * (1 + stats.attack_increase_pct / 100) * (1 + stats.weapon_dmg_pct / 100)
            * (1 + stats.dmg_boost_pct / 100) * (1 + crit))


@pytest.fixture
def patched(monkeypatch):
    monkeypatch.setattr(gear, "simulate", lambda gd, b, pr, sc, cfg=None: SimpleNamespace(dps=fake_dps(b.stats)))
    monkeypatch.setattr(gear, "_heuristic_priority", lambda *a, **k: None)


def build(**kw) -> CharacterBuild:
    return CharacterBuild("t", "global", 45, class_key="sorcerer", stats=Stats(**kw))


# ---- stats math ------------------------------------------------------------------------------------------

def test_item_lines_enchant_linear_and_clamped(items):
    lib = items[LIBERATOR]  # attack 178-198, slope 4.4, max +10
    assert gear.item_lines(lib, 0)["WeaponFixingDamage"] == pytest.approx(188)
    assert gear.item_lines(lib, 10)["WeaponFixingDamage"] == pytest.approx(188 + 44)
    assert gear.item_lines(lib, 99) == gear.item_lines(lib, 10)  # clamped at max enchant
    assert gear.item_lines(lib, 10)["WeaponAccuracy"] == 100  # accuracy does not scale


def test_random_pool_expected_value(items):
    lun = items[LUNATIC]
    assert lun["sub_random"] and lun["sub_count"] == 3
    exp = gear.item_lines(lun, 0, "expected")
    none = gear.item_lines(lun, 0, "none")
    pool_attack = [s for s in lun["subs"] if s["id"] == "WeaponFixingDamage"][0]
    want = 3 * (pool_attack["min"] + pool_attack["v"]) / 2 / len(lun["subs"])
    assert exp["WeaponFixingDamage"] - none["WeaponFixingDamage"] == pytest.approx(want)


def test_best_rolls_pick_weighted_lines(items):
    lun = items[LUNATIC]
    w = {"CombatSpeed": 1000.0}  # make combat speed the only valued line
    best = gear.item_lines(lun, 0, "best", w)
    cs = [s for s in lun["subs"] if s["id"] == "CombatSpeed"][0]["v"]
    assert best["CombatSpeed"] == pytest.approx(cs)


def test_stats_from_gear_delta_and_notes(items):
    delta, notes = gear.stats_from_gear([{"id": LIBERATOR, "enchant": 10}], items)
    assert delta.attack == pytest.approx(232)  # delta has zero base, not the 1000 default
    assert delta.crit_dmg_pct == 0
    assert any("assumed" in n for n in notes)
    d2, n2 = gear.stats_from_gear([{"id": 999999999, "enchant": 0}], items)
    assert d2.attack == 0 and any("not in the item table" in n for n in n2)


def test_stats_sum_over_slots(items):
    both = gear.stats_from_gear([{"id": LIBERATOR, "enchant": 0}, {"id": 310140024, "enchant": 0}], items)[0]
    a = gear.stats_from_gear([{"id": LIBERATOR, "enchant": 0}], items)[0]
    b = gear.stats_from_gear([{"id": 310140024, "enchant": 0}], items)[0]
    assert both.attack == pytest.approx(a.attack + b.attack)


def test_base_stats_roundtrip(items):
    eq = [{"id": LIBERATOR, "enchant": 10}]
    b = build(attack=2000)
    base = gear.base_stats(b, eq, items)
    assert base.attack == pytest.approx(2000 - 232)
    assert gear.add_stats(base, gear.stats_from_gear(eq, items)[0]).attack == pytest.approx(2000)


def test_normalize_pairs_and_slots(items):
    eq = gear.normalize_equipped([{"id": 310140024, "enchant": 0}, {"id": 310460006, "enchant": 0},
                                  {"id": 310460006, "enchant": 1}], items)
    assert [e["slot"] for e in eq] == ["necklace", "bracelet1", "bracelet2"]


# ---- reachable / class filters ---------------------------------------------------------------------------

def test_reachable_filter_and_class_lock(items):
    reach = {i["id"] for i in gear.candidates(items, "weapon", "sorcerer")}
    assert LIBERATOR in reach and LUNATIC in reach
    assert LUDRA not in reach  # IL 102
    assert GLAD_BLADE not in reach  # class locked
    allw = {i["id"] for i in gear.candidates(items, "weapon", "sorcerer", reachable_only=False)}
    assert LUDRA in allw and GLAD_BLADE not in allw
    assert gear.reachable(items[LUNATIC]) and not gear.reachable(items[LUDRA])


def test_equip_level_filter(items):
    low = {i["id"] for i in gear.candidates(items, "weapon", "sorcerer", level=1)}
    assert low == {LIBERATOR}  # quest weapon has equip level 1; Lunatic needs 45


# ---- BIS ---------------------------------------------------------------------------------------------------

def test_bis_ranks_by_simulated_dps(items, patched):
    r = gear.bis(None, "sorcerer", "boss", build(attack=100), items=items)
    w = r["weapon"]
    assert w[0].item["id"] == LUNATIC  # 229 base beats the 198 Liberator, both reachable
    assert [x.dps for x in w] == sorted((x.dps for x in w), reverse=True)
    assert all(x.reachable for x in w)
    assert w[0].enchant == items[LUNATIC]["max_enchant"]
    assert gear.bis(None, "sorcerer", "boss", build(attack=100), items=items)["torso"][0].gain_pct >= 0


def test_bis_all_items_prefers_unreachable(items, patched):
    r = gear.bis(None, "sorcerer", "boss", build(attack=100), reachable_only=False, items=items)
    top = r["weapon"][0]
    assert top.item["id"] in (LUDRA, 110530045) and not top.reachable


def test_bis_uses_naked_base_when_equipped_given(items, patched):
    eq = [{"id": LIBERATOR, "enchant": 10}]
    b = build(attack=1000)
    seen = []
    orig = gear.simulate
    gear.simulate = lambda gd, bb, pr, sc, cfg=None: (seen.append(bb.stats.attack), orig(gd, bb, pr, sc, cfg))[1]
    try:
        gear.bis(None, "sorcerer", "boss", b, equipped=eq, items=items, passes=1)
    finally:
        gear.simulate = orig
    assert min(seen) == pytest.approx(1000 - 232, abs=1)  # probe at the equipped-gear-free base


# ---- upgrade path ------------------------------------------------------------------------------------------

def test_upgrade_path_ordered_and_filtered(items, patched):
    eq = [{"id": LIBERATOR, "enchant": 0}, {"id": 310140024, "enchant": 0}, {"id": 115040035, "enchant": 0}]
    b = build(attack=1500, crit_chance_pct=20, crit_dmg_pct=50)
    path = gear.upgrade_path(None, b, eq, "boss", budget_steps=6, items=items)
    assert 1 <= len(path) <= 6
    assert path[0]["dps_gain_pct"] == max(p["dps_gain_pct"] for p in path)  # greedy: biggest first
    assert all(p["dps_gain_pct"] > 0 for p in path)
    dps = [p["dps_after"] for p in path]
    assert dps == sorted(dps)
    assert all(p["reachable"] for p in path)
    assert any(p["slot"] == "weapon" for p in path)  # Liberator -> Lunatic/enchant is among the top moves
    for p in path:
        assert p["kind"] in ("enchant", "swap") and p["to"]["enchant"] >= 0
        assert p["source"]
    # the weapon is never swapped to the same item, and an enchant step goes to max
    ench = [p for p in path if p["kind"] == "enchant"]
    assert all(p["to"]["enchant"] == items[p["to"]["id"]]["max_enchant"] for p in ench)


def test_upgrade_path_include_unreachable(items, patched):
    eq = [{"id": LIBERATOR, "enchant": 10}]
    path = gear.upgrade_path(None, build(attack=1500), eq, "boss", 3, reachable_only=False, items=items)
    assert path[0]["to"]["id"] in (LUDRA, 110530045) and path[0]["reachable"] is False
    only = gear.upgrade_path(None, build(attack=1500), eq, "boss", 3, reachable_only=True, items=items)
    assert all(p["reachable"] for p in only)


def test_upgrade_path_stops_when_nothing_helps(items, patched):
    best = [{"id": LUNATIC, "enchant": 10}]
    path = gear.upgrade_path(None, build(attack=1500), best, "boss", 50, items=items)
    assert len(path) < 50  # runs out of positive moves


# ---- max potential -----------------------------------------------------------------------------------------

def test_max_potential_uses_bis_and_optimizer(items, patched, monkeypatch):
    got = {}

    def fake_full(gd, b, style, dp, cfg, budget, progress):
        got["build"], got["style"] = b, style
        return "FULL"

    monkeypatch.setattr(gear, "optimize_full_build", fake_full)
    mp = gear.max_potential(None, "sorcerer", "boss", build(attack=100), items=items)
    assert mp.full == "FULL" and got["style"] == "boss"
    assert mp.gear["weapon"].item["id"] == LUNATIC
    assert mp.dps_with_gear > mp.dps_without_gear
    assert got["build"].stats.attack == pytest.approx(100 + mp.gear_stats.attack)
    assert all(r.reachable for r in mp.gear.values())
    assert mp.notes


# ---- armory ------------------------------------------------------------------------------------------------

@pytest.mark.skipif(not EQUIP_SAMPLE.exists(), reason="research armory sample not present")
def test_equipped_from_armory_sample(items):
    raw = json.loads(EQUIP_SAMPLE.read_text(encoding="utf8"))
    eq = gear.equipped_from_armory(raw)
    assert len(eq) == 17 and {e["slot"] for e in eq} <= set(gear.SLOTS)
    assert next(e for e in eq if e["id"] == LIBERATOR) == {"id": LIBERATOR, "enchant": 10, "slot": "weapon",
                                                         "name": "Liberator Spellbook"}
    ok, tot = gear.resolution(eq, items)  # the small fixture only holds a few of them
    assert tot == 17 and 3 <= ok < tot


@pytest.mark.skipif(not gear.ITEMS_PATH.exists() or not EQUIP_SAMPLE.exists(), reason="items.json not built")
def test_real_items_resolve_darththot():
    raw = json.loads(EQUIP_SAMPLE.read_text(encoding="utf8"))
    ok, tot = gear.resolution(gear.equipped_from_armory(raw), gear.load_items())
    assert ok / tot >= 0.9
