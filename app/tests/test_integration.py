"""End-to-end checks on the real shipped gamedata.json and the real engine."""
import time
from dataclasses import replace

import pytest

from aion2c import crafting
from aion2c import daevanion
from aion2c.data.loader import load_gamedata
import aion2c.keybinds.export as kb_export
from aion2c.engine.community import compare
from aion2c.engine.facade import Engine
from aion2c.models import SCENARIOS, CharacterBuild, SimConfig, SkillBar, Stats


@pytest.fixture(scope="module")
def gd():
    return load_gamedata()


@pytest.fixture(scope="module")
def engine(gd):
    return Engine(gd)


@pytest.fixture(scope="module")
def build():
    return CharacterBuild("Test", "global", 45, stats=Stats())


@pytest.fixture(scope="module")
def results(engine, build):
    out = {}
    for sc in SCENARIOS:
        t0 = time.time()
        out[sc.key] = engine.optimize(build, sc)
        out[sc.key + "_t"] = time.time() - t0
    return out


INT_BAR = SkillBar(slots={
    "1": "flame-arrow", "2": "firestorm", "3": "blaze", "4": "hellfire", "5": "element-enhancement",
    "6": "defiance", "7": "steel-barrier", "8": "bittercold-wind", "9": "frost-burst",
    "0": "winters-shackles",
})


def test_real_gamedata_loads(gd):
    assert len(gd.skills) == 56
    assert gd.level_caps == {"global": 45, "korea": 50}


@pytest.mark.parametrize("sc", SCENARIOS, ids=lambda s: s.key)
def test_optimize_each_scenario(results, sc):
    r = results[sc.key]
    assert results[sc.key + "_t"] < 20
    assert len(r.options) >= 1
    assert r.options[0].result.dps > 0


def test_community_compare(gd, build, results):
    sc = SCENARIOS[0]
    out = compare(gd, build, sc, results[sc.key].options[0], SimConfig())
    assert isinstance(out, tuple)


def test_plan_and_gkeys(gd, build, results):
    pri = {"boss_180": results["boss_180"].options[0].priority, "aoe_pack": results["aoe_pack"].options[0].priority}
    p = kb_export.plan(gd, build, pri, INT_BAR)
    assert len(p.gkeys) == 10
    assert sum(1 for g in p.gkeys if g.mstate == "M1") == 5
    assert sum(1 for g in p.gkeys if g.mstate == "M2") == 5
    assert p.macro_dps["Boss loop"] <= p.ideal_dps["boss_180"] + 1e-6
    assert "Task Manager" in kb_export.instructions_markdown(p, gd)


def test_marginal_rows(engine, build, results):
    sc = SCENARIOS[0]
    rows = engine.marginal(build, results["boss_180"].options[0].priority, sc)
    assert len(rows) >= 8


def test_level_14_vs_45(engine, build, results):
    sc = SCENARIOS[0]
    b14 = replace(build, level=14)
    r14 = engine.optimize(b14, sc)
    best45, best14 = results["boss_180"].options[0], r14.options[0]
    # level 45 adds no better skill than level 14 once Wish/Frost Burst/Blaze are up, so compare outcomes, not lists
    assert best14.result.dps < best45.result.dps
    assert any(e.skill_key == "hellfire" for e in best14.priority.entries)
    assert "grace_of_enhancement" not in best14.result.status_uptime
    assert "grace_of_enhancement" in best45.result.status_uptime


def test_daevanion_suggest_path_real(gd, build, results):
    sc = SCENARIOS[0]
    pri = results["boss_180"].options[0].priority
    path, gain = daevanion.suggest_path(gd, build, pri, sc, 10, board_keys=["nezekan"])
    assert isinstance(path, list)
    board = gd.daevanion["nezekan"]
    assert len(set(path)) == len(path)
    assert daevanion.valid(board, frozenset(path))
    assert daevanion.points_spent(gd, frozenset(path)) <= 10
    assert gain >= 0


def test_crafting_shopping_list_real(gd):
    recipes = crafting.sorc_recipes(gd)
    assert len(recipes) >= 18
    picks = {r.id: 2 for r in recipes[:3]}
    for expand in (True, False):
        lst = crafting.shopping_list(gd, picks, expand=expand)
        assert lst
        assert all(m.qty > 0 for m in lst)
        names = [m.item for m in lst]
        assert names == sorted(names) and len(set(names)) == len(names)
