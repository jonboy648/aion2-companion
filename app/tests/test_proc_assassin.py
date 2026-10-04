"""Assassin Heart Gore: a crit-triggered PROC. It casts only when crit events exist (crit_chance_pct > 0)."""
import pytest

from aion2c.data import loader
from aion2c.engine import build_optimizer as bo
from aion2c.models import CharacterBuild, SkillKind, Stats

KEY = "assassin"


@pytest.fixture(scope="module")
def gd():
    if not loader.default_path(KEY).is_file():
        pytest.skip("assassin gamedata not built")
    return loader.load_gamedata(class_key=KEY)


def _boss(gd, crit):
    b = CharacterBuild("t", "global", 45, stats=Stats(crit_chance_pct=crit), class_key=KEY)
    return bo.optimize_full_build(gd, b, "boss").result


def test_heart_gore_wiring(gd):
    hg = gd.skills["heart-gore"]
    assert hg.kind == SkillKind.PROC and hg.unlock_level <= 45 and "global" in hg.regions
    trig = [t for t in gd.triggers if t.event == "crit" and t.proc_skill == "heart-gore"]
    assert len(trig) == 1 and trig[0].source_skill == "heart-gore" and trig[0].chance == 1.0


def test_heart_gore_needs_crit_events(gd):
    # default Stats() has crit 0, so no crit event ever accrues (the cause of the 0 casts in build_validation_v2)
    assert "heart-gore" not in _boss(gd, 0).per_skill


@pytest.mark.parametrize("crit", [10, 30, 60])
def test_heart_gore_casts_with_crit_in_boss_run(gd, crit):
    ps = _boss(gd, crit).per_skill
    assert "heart-gore" in ps and ps["heart-gore"].casts > 0 and ps["heart-gore"].damage > 0
    assert ps["heart-gore"].casts <= 60  # 5 s cooldown over a 300 s fight
