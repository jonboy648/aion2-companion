"""Real character stats in the damage engine: the stat sheet's `engine_stats` -> Stats plumbing, no double counting of
Daevanion, and the DarthThot regression band for the imported build's DPS."""
import json
from dataclasses import replace

import pytest

from aion2c import daevanion, gear, statsheet, webapi
from aion2c.engine import build_optimizer as bo
from aion2c.models import BASELINE_L45_STATS, Stats

import test_statsheet as ts  # fixtures: the three real armory downloads

ITEMS = gear.load_items()


@pytest.fixture(scope="module", params=list(ts.CHARS))
def sheet(request):
    raw = ts.CHARS[request.param]()
    return request.param, raw, statsheet.compute(raw, ITEMS)


def rows(sh):
    return {r["key"]: r for c in sh["categories"] for r in c["stats"]}


def test_engine_stats_cover_exactly_the_stats_fields(sheet):
    _n, _raw, sh = sheet
    assert set(sh["engine_stats"]) <= {f for f in Stats.__dataclass_fields__}
    assert {"attack", "max_mp", "attack_increase_pct", "crit_chance_pct"} <= set(sh["engine_stats"])


def test_attack_is_weapon_midpoint_before_amp_ratio(sheet):
    """`attack` = midpoint of Max/Min Attack with the Amp Ratio addition taken back out (damage.py applies
    attack_increase_pct itself); Attack Bonus (FixingDamage) is not in it."""
    _n, _raw, sh = sheet
    r = rows(sh)
    ratio_add = sum(e["value"] for k in ("WeaponDamage", "WeaponMinDamage") for e in r[k]["sources"] if e["group"] == "ratio") / 2
    mid_after = (r["WeaponDamage"]["value"] + r["WeaponMinDamage"]["value"]) / 2
    assert sh["engine_stats"]["attack"] == pytest.approx(mid_after - ratio_add, abs=1e-3)
    assert sh["engine_stats"]["attack"] < mid_after


def test_darththot_values_pinned():
    sh = statsheet.compute(ts._darth(), ITEMS)["engine_stats"]
    assert sh["attack"] == pytest.approx(552.52, abs=0.01)  # research note: "about 553"
    assert sh["max_mp"] == pytest.approx(978.06, abs=0.01)  # sheet MP 978 (Daevanion MP included: the engine has no MP node)
    assert sh["attack_increase_pct"] == pytest.approx(1.64, abs=0.01)
    assert sh["weapon_dmg_pct"] == 5.0 and sh["crit_dmg_pct"] == 50.0 and sh["penetration"] == 420.0


def test_daevanion_is_not_counted_twice():
    """The engine adds opened Daevanion nodes itself (daevanion.apply_stats), so the sheet-derived stats must not
    include that share: engine_stats + the nodes' effects == the sheet's own total for the mapped fields."""
    raw = ts._darth()
    sh = statsheet.compute(raw, ITEMS)
    imp = webapi.import_character(raw, None)
    build = webapi._build(imp["build"])
    gd = webapi._gd("sorcerer")
    with_nodes = daevanion.apply_stats(gd, build)
    sheet_speed = rows(sh)["CombatSpeed"]["value"]
    dae_speed = sum(e["value"] for e in rows(sh)["CombatSpeed"]["sources"] if e["group"] == "daevanion")
    assert dae_speed > 0
    assert build.stats.combat_speed_pct == pytest.approx(sheet_speed - dae_speed, abs=1e-3)
    assert with_nodes.combat_speed_pct == pytest.approx(sheet_speed, abs=0.5)  # nodes matched by the importer


def test_apply_to_build_replaces_placeholders_and_keeps_unset_fields():
    raw = ts._darth()
    base = webapi._build({"name": "x", "region": "global", "level": 44, "class_key": "sorcerer",
                          "stats": {"mp_regen_per_s": 33, "pve_dmg_pct": 2, "attack": 1000, "max_mp": 2000}})
    b, notes = statsheet.apply_to_build(base, raw, [statsheet.STALE_NOTE + "; they keep your entered values.", "other"], ITEMS)
    assert b.stats.attack == pytest.approx(552.52, abs=0.01) and b.stats.max_mp == pytest.approx(978.06, abs=0.01)
    assert b.stats.mp_regen_per_s == 33 and b.stats.pve_dmg_pct == 2
    assert "other" in notes and not any(n.startswith(statsheet.STALE_NOTE) for n in notes)


def test_import_never_leaves_placeholder_attack_or_mp(sheet):
    name, raw, _sh = sheet
    s = webapi.import_character(raw, None)["build"]["stats"]
    assert s["attack"] != 1000 and s["max_mp"] != 2000, name
    assert 300 < s["attack"] < 1500 and 300 < s["max_mp"] < 5000, name


def test_manual_build_defaults_are_not_the_placeholders():
    assert BASELINE_L45_STATS.attack == 550 and BASELINE_L45_STATS.max_mp == 1000
    assert Stats().attack == 1000 and Stats().max_mp == 2000  # the all-default contract is unchanged (tests depend on it)


# ---- DarthThot regression: the imported build's DPS ---------------------------------------------------------------
# Band, with the reasons. In-game measurement: about 7,000 boss-dummy DPS. The engine on the imported build with real
# stats and the heuristic (one fixed) priority gave 7,678; the research note measured 6.6-8.7k for the same thing, so the
# band for that number is 6,600-8,800. With a searched rotation (what the site shows as "Current build") the engine
# plays a better rotation than the heuristic, 9,389, so its band is 8,000-10,800. Both stay above the measured 7k: boss
# defense, Damage Tolerance, accuracy and Perfect are not modelled. The old placeholder stats gave 8,769 (heuristic) and
# 21,190 for the plan, so a drop back toward those numbers (attack 1000 / MP 2000 creeping back in) fails this test.
DARTH_HEURISTIC_BAND = (6_600, 8_800)
DARTH_CURRENT_BAND = (8_000, 10_800)


@pytest.fixture(scope="module")
def darth_import():
    raw = ts._darth()
    return raw, json.loads(json.dumps(webapi.import_character(raw, None)))


def test_darththot_current_build_dps_band(darth_import):
    raw, imp = darth_import
    b = imp["build"]
    heuristic = webapi.max_potential("sorcerer", "boss", True, b, raw)["current_dps"]
    assert DARTH_HEURISTIC_BAND[0] <= heuristic <= DARTH_HEURISTIC_BAND[1], heuristic
    gd = webapi._gd("sorcerer")
    cur = bo.current_build_dps(gd, webapi._build(b), bo._BY_KEY["boss_180"])
    assert DARTH_CURRENT_BAND[0] <= cur <= DARTH_CURRENT_BAND[1], cur
    assert cur >= heuristic * 0.98  # a searched rotation is at least as good as the seed


def test_plan_is_not_wildly_above_current_build(darth_import):
    """Before: plan 21,190 vs as-imported 8,769 (2.4x) with the placeholder attack. With real stats and no new Daevanion
    points the plan only re-picks stigmas, ranks and specialties, so it stays within a modest multiple of the current."""
    _raw, imp = darth_import
    fb = webapi.optimize(imp["build"], "boss", 0)
    assert fb["current_dps"] > 0
    assert 0.95 <= fb["result"]["dps"] / fb["current_dps"] <= 1.6, (fb["result"]["dps"], fb["current_dps"])
