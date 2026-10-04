"""Ranger procs and DoTs: Hunter's Soul is crit-triggered; Bleed / Crimson Flames carry a (derived, estimated) tick ratio."""
import pytest

from aion2c.data import loader
from aion2c.engine import build_optimizer as bo
from aion2c.engine.advisor import marginal_stats
from aion2c.models import CharacterBuild, Stats

KEY = "ranger"


@pytest.fixture(scope="module")
def gd():
    if not loader.default_path(KEY).is_file():
        pytest.skip("ranger gamedata not built")
    return loader.load_gamedata(class_key=KEY)


@pytest.fixture(scope="module")
def boss(gd):
    b = CharacterBuild("t", "global", 45, stats=Stats(), class_key=KEY)
    return bo.optimize_full_build(gd, b, "boss")


def test_hunters_soul_is_crit_trigger(gd):
    trig = [t for t in gd.triggers if t.proc_skill == "hunters-soul"]
    assert len(trig) == 1 and trig[0].event == "crit" and trig[0].chance == 0.5


@pytest.mark.parametrize("status,ratio", [("crimson_flames", 85.5), ("bleed", 45.0)])
def test_dot_tick_ratio_is_derived_not_unknown(gd, status, ratio):
    n = gd.statuses[status].tick_ratio_pct
    assert n.value == ratio and n.confidence == "estimated" and "DERIVED" in n.source
    assert gd.statuses[status].tick_s.value == 1.0


def test_no_unknown_dot_warning_in_boss_run(boss):
    assert not [w for w in boss.result.warnings if "tick damage" in w]


def test_griffon_arrow_is_a_boss_pick(boss):
    assert "griffon-arrow" in {k for k, _ in boss.stigma_picks}


def test_cdr_is_not_the_top_stat(gd, boss):
    gains = marginal_stats(gd, boss.build, boss.priority, bo.PLAYSTYLES[0].scenario, bo.SimConfig())
    cdr = next(g for g in gains if g.stat == "cdr_pct")
    assert cdr.dps_gain_pct < 1.0 and gains[0].stat != "cdr_pct"
