"""Gear built from the client tables: per-level enchant series, Exceed as a gear dimension, success odds as data."""
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import pytest

from aion2c import gear
from aion2c.models import CharacterBuild, Stats

FIX = Path(__file__).parent / "fixtures" / "items_small.json"
LUDRA, NECK94, NECK102 = 110520003, 310130023, 310130040  # IL102 Unique grimoire (+15 / Exceed 5), IL94 and IL102 necklaces
real = pytest.mark.skipif(not gear.ITEMS_PATH.exists(), reason="items.json not built")


@pytest.fixture(scope="module")
def items():
    return gear.load_items(FIX)


def attack(item, enchant=0, exceed=0):
    return gear.item_lines(item, enchant, "none", None, exceed)["WeaponFixingDamage"]


# ---- enchant: the client's per-level series, not a straight line -----------------------------------------------

def test_enchant_uses_the_per_level_series(items):
    ludra = items[LUDRA]
    base = attack(ludra, 0)
    series = [11, 22, 33, 44, 55, 66, 78, 90, 102, 114, 126, 138, 150, 162, 174]  # client EnchantEffect, IL102 weapon
    assert [attack(ludra, e) - base for e in range(1, 16)] == series
    assert attack(ludra, 7) - base == 78 != pytest.approx(ludra["main"][0]["slope"] * 7)  # a line would say 81.2
    assert attack(ludra, 15) - base == pytest.approx(ludra["main"][0]["slope"] * 15)  # the top still matches the old fit
    assert attack(ludra, 99) == attack(ludra, 15) and attack(ludra, -3) == base  # clamped both ways


def test_enchant_falls_back_to_the_linear_slope_without_a_series(items):
    legacy = {k: v for k, v in items[LUDRA].items() if k != "enchant_series"}
    slope = legacy["main"][0]["slope"]
    assert attack(legacy, 5) - attack(legacy, 0) == pytest.approx(5 * slope)


def test_series_also_moves_armor_stats(items):
    torso = items[210130040]
    lines0, lines15 = gear.item_lines(torso, 0, "none"), gear.item_lines(torso, 15, "none")
    assert lines15["ArmorDefense"] > lines0["ArmorDefense"] and lines15["HPMax"] > lines0["HPMax"]


# ---- success odds are plain data -------------------------------------------------------------------------------

def test_enchant_and_exceed_success_odds(items):
    assert gear.enchant_odds(items[LUDRA]) == [100] * 10 + [65, 50, 35, 25, 20]  # Unique: +10..+14 can fail
    assert gear.enchant_odds(items[110540035]) == [100] * 10  # Epic +10
    assert gear.enchant_odds(items[310460006]) == [100] * 5  # Common +5
    assert gear.exceed_odds(items[LUDRA]) == [66, 50, 33, 25, 20]
    assert gear.exceed_odds(items[110540035]) == []  # no Exceed on Epic
    assert len(gear.enchant_odds(items[LUDRA])) == items[LUDRA]["max_enchant"]
    assert len(gear.exceed_odds(items[LUDRA])) == items[LUDRA]["max_exceed"]


# ---- Exceed ------------------------------------------------------------------------------------------------------

def test_exceed_level_replaces_the_previous_level(items):
    neck = items[NECK94]
    assert neck["max_exceed"] == 5
    assert gear.exceed_lines(neck, 0) == {}
    l3, l5 = gear.exceed_lines(neck, 3), gear.exceed_lines(neck, 5)
    assert l3 == {"WeaponFixingDamage": 19, "ArmorDefense": 39, "AmplifyAllDamage": 1.5}
    assert l5["AmplifyAllDamage"] == 2.5 and gear.exceed_lines(neck, 99) == l5  # clamped at the item's max
    # in the totals a level is added once on top of the +0 item (not 1+2+3)
    assert attack(neck, 0, 3) - attack(neck, 0) == 19
    assert attack(neck, 0, 5) - attack(neck, 0, 3) == 33 - 19
    assert gear.item_lines(neck, 0, "none", None, 5)["AmplifyAllDamage"] == 2.5


def test_exceed_flows_into_stats(items):
    plain = gear.stats_from_gear([{"id": NECK94, "enchant": 15}], items)[0]
    ex = gear.stats_from_gear([{"id": NECK94, "enchant": 15, "exceed": 5}], items)[0]
    assert ex.attack - plain.attack == pytest.approx(33)
    assert ex.dmg_boost_pct - plain.dmg_boost_pct == pytest.approx(2.5)
    assert gear.normalize_equipped([{"id": NECK94, "enchant": 1, "exceed": 2}], items)[0]["exceed"] == 2
    assert gear.normalize_equipped([{"id": NECK94, "enchant": 1}], items)[0]["exceed"] == 0


@real
def test_full_il102_kit_exceed_matches_the_client_note():
    """weapon + necklace + 2 earrings + 2 rings, all Unique IL102 at Exceed +5: +253 attack, +17.5% Damage Boost."""
    items = gear.load_items()
    pick = lambda slot: next(i for i in items.values() if i["slot"] == slot and i["il"] == 102  # noqa: E731
                             and i["grade"] == "Unique" and i.get("max_exceed") == 5
                             and gear.fits_class(i, "sorcerer"))
    kit = [pick("weapon"), pick("necklace"), pick("earring"), pick("earring"), pick("ring"), pick("ring")]
    atk = sum(gear.exceed_lines(i, 5).get("WeaponFixingDamage", 0) for i in kit)
    boost = sum(gear.exceed_lines(i, 5).get("AmplifyAllDamage", 0) for i in kit)
    assert atk == 73 + 5 * 36 == 253 and boost == pytest.approx(5 + 5 * 2.5)


# ---- Exceed in the rankings and the upgrade path ----------------------------------------------------------------

def fake_dps(stats: Stats) -> float:
    return stats.attack * (1 + stats.dmg_boost_pct / 100)


@pytest.fixture
def patched(monkeypatch):
    monkeypatch.setattr(gear, "simulate", lambda gd, b, pr, sc, cfg=None: SimpleNamespace(dps=fake_dps(b.stats)))
    monkeypatch.setattr(gear, "_heuristic_priority", lambda *a, **k: None)


@pytest.fixture
def reachable_items(items):
    """The IL94 necklace made reachable (IL 80) so it competes in the default reachable-only ranking."""
    return {**items, NECK94: {**items[NECK94], "il": 80}}


def build(**kw) -> CharacterBuild:
    return CharacterBuild("t", "global", 45, class_key="sorcerer", stats=Stats(**kw))


def test_upgrade_path_offers_exceed_to_the_max(reachable_items, patched):
    only = {NECK94: reachable_items[NECK94]}  # one item in the table: the only move left is its Exceed
    eq = [{"id": NECK94, "enchant": 15, "exceed": 0}]
    stats = gear.stats_from_gear(eq, only)[0]
    path = gear.upgrade_path(None, build(attack=1000 + stats.attack, dmg_boost_pct=stats.dmg_boost_pct), eq, "boss", 3,
                             items=only)
    assert len(path) == 1
    step = path[0]
    assert step["from"] == {"id": NECK94, "name": "Wise Dragon Lord Necklace", "enchant": 15, "exceed": 0}
    assert step["to"]["id"] == NECK94 and step["to"]["exceed"] == 5 and step["to"]["enchant"] == 15
    assert step["source"] == "Exceed" and step["dps_gain_pct"] > 0
    # dps after = attack + 33 and +2.5% damage boost, computed from the item's own Exceed level 5
    assert step["dps_after"] == pytest.approx((1000 + stats.attack + 33) * (1 + (stats.dmg_boost_pct + 2.5) / 100))


def test_no_exceed_step_once_maxed(reachable_items, patched):
    eq = [{"id": NECK94, "enchant": 15, "exceed": 5}]
    stats = gear.stats_from_gear(eq, reachable_items)[0]
    path = gear.upgrade_path(None, build(attack=1000 + stats.attack, dmg_boost_pct=stats.dmg_boost_pct), eq, "boss", 5,
                             items=reachable_items)
    assert all(p["kind"] != "exceed" for p in path)


def test_swapping_away_from_an_exceeded_item_loses_its_exceed(reachable_items, patched):
    """A swap lands at Exceed 0: a necklace with +20 attack must not replace one that has +33 attack and +2.5% from Exceed."""
    mine = {**reachable_items[NECK94], "id": 1, "il": 80}
    better = {**mine, "id": 2, "main": [{**mine["main"][0], "v": mine["main"][0]["v"] + 20}, *mine["main"][1:]]}
    pool = {1: mine, 2: better}
    stats = gear.stats_from_gear([{"id": 1, "enchant": 15, "exceed": 5}], pool)[0]
    b = build(attack=1000 + stats.attack, dmg_boost_pct=stats.dmg_boost_pct)
    assert gear.upgrade_path(None, b, [{"id": 1, "enchant": 15, "exceed": 5}], "boss", 5, items=pool) == []


def test_bis_and_max_potential_assume_max_exceed(reachable_items, patched, monkeypatch):
    r = gear.bis(None, "sorcerer", "boss", build(attack=100), items=reachable_items)
    pick = r["necklace"][0]
    assert pick.item["id"] == NECK94 and pick.exceed == 5 and pick.enchant == 15
    monkeypatch.setattr(gear, "optimize_full_build", lambda gd, b, style, dp, cfg, budget, progress, battle_points=None: "FULL")
    mp = gear.max_potential(None, "sorcerer", "boss", build(attack=100), items=reachable_items)
    base = gear.item_delta(reachable_items[NECK94], 15, "best", None, 0)
    assert mp.gear["necklace"].exceed == 5
    assert mp.gear_stats.attack >= gear.item_delta(reachable_items[NECK94], 15, "best", None, 5).attack
    assert gear.item_delta(reachable_items[NECK94], 15, "best", None, 5).attack - base.attack == pytest.approx(33)
    assert any("max Exceed" in n for n in mp.notes)


# ---- the shipped items.json ---------------------------------------------------------------------------------------

@real
def test_items_json_tables_are_consistent():
    items = gear.load_items()
    assert len(items) >= 3555  # the endpoint's 3356 plus the 199 client-only items
    n_series = n_exceed = 0
    for it in items.values():
        mx = it["max_enchant"]
        if "enchant_series" in it:
            n_series += 1
            assert all(len(v) == mx for v in it["enchant_series"].values())
            for m in it["main"]:  # slope is the series' last value / max
                top = it["enchant_series"].get(m["id"], [0])[-1]
                assert m.get("slope", 0) == pytest.approx(top / mx, abs=1e-3)
        if mx:
            assert len(gear.enchant_odds(it)) == mx and gear.enchant_odds(it)[0] == 100
        if it.get("max_exceed"):
            n_exceed += 1
            assert len(it["exceed_levels"]) == len(gear.exceed_odds(it)) == it["max_exceed"]
        else:
            assert "exceed_levels" not in it
        if it["sub_random"]:
            assert all(s["w"] > 0 for s in it["subs"])
        else:
            assert all(s["w"] == 0 for s in it["subs"])
    assert n_series > 3000 and n_exceed == 678


@real
def test_items_json_has_the_client_only_items():
    items = gear.load_items()
    by_slot = {}
    for it in items.values():
        by_slot.setdefault(it["slot"], []).append(it)
    assert len(by_slot["arcana"]) == 40 and len(by_slot["rune"]) == 1
    rune = by_slot["rune"][0]
    assert rune["max_enchant"] == 10 and gear.enchant_odds(rune)[:3] == [100, 80, 66]  # the one gear group that can fail early
    fighters = [i for i in items.values() if i["class_lock"] == ["Fighter"]]
    assert len(fighters) == 2 and all(i["slot"] == "weapon" for i in fighters)
    # unreleased-to-us slots never compete as candidates for a class
    assert not any(i["slot"] in ("arcana", "rune") for s in gear.SLOTS for i in gear.candidates(items, s, "sorcerer"))
    assert not any(i["class_lock"] == ["Fighter"] for i in gear.candidates(items, "weapon", "gladiator"))


@real
def test_unique_enchant_odds_by_grade():
    items = gear.load_items()
    for it in items.values():
        odds = gear.enchant_odds(it)
        if it["slot"] in ("arcana", "rune") or not odds:
            continue
        if it["grade"] in ("Common", "Rare") and it["max_enchant"] == 5:
            assert odds == [100] * 5
        if it["grade"] == "Epic" and it["max_enchant"] == 10:
            assert odds == [100] * 10
        if it["grade"] == "Unique" and it["max_enchant"] == 15:
            assert odds[:10] == [100] * 10 and odds[10:] == [65, 50, 35, 25, 20]
