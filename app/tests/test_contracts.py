import dataclasses
import importlib
import json
from dataclasses import replace

import pytest

from aion2c import models
from aion2c.data.loader import allowed_skills, load_gamedata
from aion2c.interfaces import EngineFacade, LiveStateSource
from aion2c.models import (
    CharacterBuild,
    GameData,
    Num,
    Priority,
    PriorityEntry,
    SimConfig,
    Stats,
    effective_rank,
)
from aion2c.serde import from_dict, to_dict
from aion2c.settings import DEFAULT_USER, load_user, save_user, user_path
from aion2c.testing.fakes import FakeEngine, NullStateSource, fake_sim_result, fake_simulate
from aion2c.ui.hotkey import parse_hotkey


# ---------------------------------------------------------------- serde / fixtures
@pytest.mark.parametrize("name", ["mini_gd", "sorc_gd"])
def test_serde_roundtrip(name, request):
    gd = request.getfixturevalue(name)
    d = json.loads(json.dumps(to_dict(gd)))
    assert from_dict(GameData, d) == gd


def test_roundtrip_small_models():
    b = CharacterBuild("x", "korea", 50, skill_ranks={"a": 3}, specs={"a": (8, 12)}, daevanion_nodes=frozenset({3, 1}))
    d = json.loads(json.dumps(to_dict(b)))
    assert from_dict(CharacterBuild, d) == b
    n = Num(1.5, "estimated", "s")
    assert from_dict(Num, to_dict(n)) == n
    assert hash(n) == hash(Num(1.5, "estimated", "s"))


def test_fixture_contents(mini_gd, sorc_gd):
    assert set(mini_gd.skills) == {"strike", "nuke", "amp", "mark_hit", "blaze", "chain1", "chain2", "chain3", "charge"}
    assert mini_gd.rules["mark_hit"].apply_chance == 0.5
    assert [c.charge_s.value for c in mini_gd.rules["charge"].charge_levels] == [0, 1, 2]
    assert set(mini_gd.daevanion["tiny"].nodes) == {1, 2, 3, 4}
    assert len(mini_gd.recipes) == 2
    assert len(sorc_gd.skills) == 13
    assert len(sorc_gd.skills["flame-arrow"].ranks) == 40
    hf = sorc_gd.skills["hellfire"].ranks[0]
    assert (hf.flat_min.value, hf.flat_max.value) == (1137, 3412)
    assert sorc_gd.statuses["grace_of_enhancement"].mp_min_pct == 25
    assert len(sorc_gd.daevanion["nezekan"].nodes) == 89
    assert len(sorc_gd.recipes) == 3
    levels = {r.level: r.kind for r in sorc_gd.roadmap}
    assert levels[22] == "stigma" and {27, 32, 37} <= set(levels)
    assert any(r.level > 45 for r in sorc_gd.roadmap)


def test_fallback_matches_sorc_fixture(sorc_gd):
    from aion2c.data import loader

    fb = load_gamedata(loader.CLASSES_DIR.parent / "fallback_gamedata.json")
    assert fb == sorc_gd


def test_mini_gd_unhashable_dicts(mini_gd):
    with pytest.raises(TypeError):
        hash(mini_gd)
    hash(PriorityEntry("x"))
    hash(Priority((PriorityEntry("x"),)))


# ---------------------------------------------------------------- engine-facing contracts
def test_fake_engine_is_facade():
    assert isinstance(FakeEngine(), EngineFacade)
    assert isinstance(NullStateSource(), LiveStateSource)
    e = FakeEngine()
    assert [o.result.dps for o in e.optimize(None, None).options] == [1800.0, 1600.0, 1500.0]
    e.simulate(None, None, None)
    e.marginal(None, None, None)
    assert e.next_skills(None, None, None, None, 2) == ["flame-arrow", "burst"]
    cfg = SimConfig(tick_ms=50)
    e.set_config(cfg)
    assert e.cfg is cfg
    assert e.calls == ["optimize", "simulate", "marginal", "next_skills", "set_config"]
    assert NullStateSource().snapshot() is None
    assert fake_sim_result(1234.0).dps == 1234.0


def test_fake_simulate_linear(mini_gd, scen10):
    pr = Priority((PriorityEntry("strike"),))
    r1 = fake_simulate(mini_gd, CharacterBuild("a", "global", 45, stats=Stats(attack=1000)), pr, scen10)
    r2 = fake_simulate(mini_gd, CharacterBuild("a", "global", 45, stats=Stats(attack=2000)), pr, scen10)
    assert r1.total_damage == pytest.approx(10 * 1000)  # 10 casts x 1000
    assert r2.dps == pytest.approx(2 * r1.dps)
    fast = fake_simulate(mini_gd, CharacterBuild("a", "global", 45, stats=Stats(combat_speed_pct=100)), pr, scen10)
    assert len(fast.casts) == 20
    # cooldowns honored: nuke (cd 4 s) first, strike fills the gaps
    pr2 = Priority((PriorityEntry("nuke"), PriorityEntry("strike")))
    r = fake_simulate(mini_gd, CharacterBuild("a", "global", 45), pr2, scen10)
    assert [c.skill_key for c in r.casts][:5] == ["nuke", "strike", "strike", "strike", "nuke"]


def test_fake_simulate_sorc_boss(sorc_gd, default_build, boss_scenario, sorc_priority):
    r = fake_simulate(sorc_gd, default_build, sorc_priority, boss_scenario)
    assert r.dps > 0 and r.duration_s == 180


def test_effective_rank_clamps(sorc_gd):
    fa = sorc_gd.skills["flame-arrow"]
    sb = sorc_gd.skills["steel-barrier"]
    g = CharacterBuild("a", "global", 45, skill_ranks={"flame-arrow": 40, "steel-barrier": 40})
    k = replace(g, region="korea")
    assert effective_rank(sorc_gd, g, fa) == 20
    assert effective_rank(sorc_gd, k, fa) == 40
    assert effective_rank(sorc_gd, g, sb) == 20
    assert effective_rank(sorc_gd, k, sb) == 25
    assert effective_rank(sorc_gd, CharacterBuild("a", "global", 45), fa) == 1
    assert effective_rank(sorc_gd, replace(g, skill_ranks={"flame-arrow": 0}), fa) == 1
    assert effective_rank(sorc_gd, replace(g, skill_ranks={"flame-arrow": 7}), fa) == 7


def test_allowed_skills(mini_gd):
    skills = dict(mini_gd.skills)
    skills["kr_only"] = replace(skills["strike"], key="kr_only", regions=frozenset({"korea"}))
    gd = replace(mini_gd, skills=skills)
    glob = {s.key for s in allowed_skills(gd, "global", False)}
    assert "kr_only" not in glob and "strike" in glob
    assert "kr_only" in {s.key for s in allowed_skills(gd, "global", True)}
    assert "kr_only" in {s.key for s in allowed_skills(gd, "korea", False)}


# ---------------------------------------------------------------- constants / settings
def test_constants():
    assert len(models.KEY_LABELS) == 38 and len(set(models.KEY_LABELS)) == 38
    assert sum(models.SKILL_POINT_COST) == 21
    assert sum(models.STIGMA_POINT_COST) == 75
    assert models.STAT_MAP["Attack Bonus"] == ("attack", 1.0, "estimated")
    assert models.STAT_MAP["Critical Hit"][2] == "unknown"
    assert tuple(s.key for s in models.SCENARIOS) == ("boss_180", "aoe_pack", "level_pull")
    for f in dataclasses.fields(Stats):
        assert hasattr(Stats(), f.name)


def test_default_user_and_settings(tmp_path, monkeypatch):
    assert set(DEFAULT_USER) == {
        "builds", "active_build", "skill_bar", "macro_keys", "macro_delay_ms", "auto_chain", "anim_overrides",
        "roadmap_checks", "panel", "hotkey", "show_kr", "craft_list", "craft_checks", "armory",
    }
    p = tmp_path / "u.json"
    monkeypatch.setenv("AION2C_USER_PATH", str(p))
    assert user_path() == p
    assert load_user() == DEFAULT_USER  # missing file
    p.write_text('{"hotkey": "F8"}', encoding="utf-8")
    u = load_user()
    assert u["hotkey"] == "F8" and u["macro_keys"] == {"boss": "F9", "aoe": "F10"}
    u["macro_delay_ms"] = 40
    save_user(u)
    assert load_user()["macro_delay_ms"] == 40
    monkeypatch.delenv("AION2C_USER_PATH")
    assert user_path().name == "user.json" and user_path().parent.name == "aion2c"


def test_parse_hotkey():
    assert parse_hotkey("Ctrl+Alt+P") == (0x0002 | 0x0001, 0x50)
    assert parse_hotkey("F9") == (0, 0x78)


# ---------------------------------------------------------------- stubs
STUB_MODULES = [
    "aion2c.app", "aion2c.state", "aion2c.settings", "aion2c.daevanion", "aion2c.crafting", "aion2c.roadmap",
    "aion2c.data.build_gamedata", "aion2c.data.update", "aion2c.data.loader",
    "aion2c.engine.damage", "aion2c.engine.simulator", "aion2c.engine.next_skills", "aion2c.engine.search",
    "aion2c.engine.explain", "aion2c.engine.community", "aion2c.engine.facade", "aion2c.engine.advisor",
    "aion2c.engine.budget", "aion2c.keybinds.layout", "aion2c.keybinds.gkeys", "aion2c.keybinds.macro",
    "aion2c.keybinds.export", "aion2c.ui.confidence", "aion2c.ui.icons", "aion2c.ui.hotkey", "aion2c.ui.panel",
    "aion2c.ui.main_window", "aion2c.ui.codex", "aion2c.ui.build_planner", "aion2c.ui.upgrade",
    "aion2c.ui.roadmap_view", "aion2c.ui.keybinds_view", "aion2c.ui.daevanion_view", "aion2c.ui.crafting_view",
    "aion2c.testing.fakes", "aion2c.interfaces", "aion2c.serde", "aion2c.__main__",
]


@pytest.mark.parametrize("mod", STUB_MODULES)
def test_stub_imports(mod):
    importlib.import_module(mod)


def test_import_cycle_both_orders():
    import subprocess
    import sys

    for first, second in (("aion2c.daevanion", "aion2c.engine.simulator"), ("aion2c.engine.simulator", "aion2c.daevanion")):
        code = f"import {first}, {second}; import aion2c.engine.simulator as s, aion2c.daevanion as d; assert s.apply_stats is d.apply_stats; assert d.simulate is s.simulate"
        subprocess.run([sys.executable, "-c", code], check=True)


def test_patch_targets_exist():
    import aion2c.daevanion as dv
    import aion2c.engine.advisor as adv
    import aion2c.engine.budget as bud
    import aion2c.engine.community as com
    import aion2c.engine.search as se
    import aion2c.engine.simulator as sim
    import aion2c.keybinds.export as ex

    for m in (dv, adv, bud, com, se, ex):
        assert hasattr(m, "simulate")
    assert hasattr(ex, "simulate_macro") and hasattr(sim, "apply_stats")


def test_ui_stubs_construct(qapp, fake_engine, sorc_gd, default_build):
    from aion2c.state import AppState
    from aion2c.ui.confidence import confidence_color, fmt_num
    from aion2c.ui.icons import pixmap
    from aion2c.ui.main_window import MainWindow
    from aion2c.ui.panel import Panel

    state = AppState(fake_engine, sorc_gd, default_build)
    win = MainWindow(state, sorc_gd, fake_engine)
    assert win.tabs.count() == 8
    assert [win.tabs.tabText(i) for i in range(8)] == [
        "My Build", "Codex", "Build", "Upgrade", "Daevanion", "Crafting", "Road Map", "Keybinds"]
    panel = Panel(state, sorc_gd, fake_engine, NullStateSource())
    assert panel.windowFlags()
    assert not pixmap(sorc_gd, "flame-arrow", 32).isNull()
    assert fmt_num(Num(5, "confirmed"))[0] == "5"
    assert fmt_num(Num(5, "estimated", "src")) == ("~5", "estimated: src")
    assert fmt_num(Num(None, "unknown"))[0] == "?"
    assert confidence_color("estimated").isValid()
    got = []
    state.resultsReady.connect(got.append)
    state.refresh()
    assert len(got) == 1 and state.best_priority() is not None
    state.set_show_kr(True)
    assert state.show_kr() and state.build().show_kr


def test_smoke_cli_fake_engine():
    import os
    import subprocess
    import sys

    env = dict(os.environ, QT_QPA_PLATFORM="offscreen", AION2C_USER_PATH=os.path.join(os.environ.get("TEMP", "."), "aion2c_contract_user.json"))
    r = subprocess.run([sys.executable, "-m", "aion2c", "--smoke"], env=env,
                       capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, r.stderr
