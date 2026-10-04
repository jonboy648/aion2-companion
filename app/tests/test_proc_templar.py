"""Templar Pummel / chain procs (build_validation_v2.md, Templar section).

v2 saw Pummel missing from the boss priority. With the current engine and unchanged Templar data it is cast; these
tests pin that, and pin the one remaining engine gap (per-hit damage of multi-hit skills) as a non-strict xfail.
"""
import collections

import pytest

from aion2c.data import loader
from aion2c.engine import build_optimizer as bo
from aion2c.engine.simulator import simulate
from aion2c.models import CharacterBuild, Priority, PriorityEntry, Scenario, Stats

KEY = "templar"


@pytest.fixture(scope="module")
def gd():
    if not loader.default_path(KEY).is_file():
        pytest.skip("templar gamedata not built")
    return loader.load_gamedata(class_key=KEY)


def P(*keys):
    return Priority(tuple(PriorityEntry(k) for k in keys))


def _sim(gd, keys, secs=30, **stats):
    b = CharacterBuild("t", "global", 45, class_key=KEY, stats=Stats(**stats))
    return simulate(gd, b, P(*keys), Scenario("t", "t", secs, 1, True))


def test_pummel_casts_and_chains_with_mp(gd):
    """Enabling condition: 120 MP. Pummel casts, Punishing Strike follows inside the 3 s chain window."""
    res = _sim(gd, ["pummel", "vicious-strike"])
    assert res.per_skill["pummel"].casts > 0
    assert res.per_skill["punishing-strike"].casts > 0
    first = [c.skill_key for c in res.casts[:2]]
    assert first == ["pummel", "punishing-strike"]


def test_vicious_strike_funds_pummel(gd):
    """Pummel and Punishing Strike spend 120 MP each; the Vicious chain restores it, so the mix out-casts Pummel alone."""
    alone = _sim(gd, ["pummel"], 60).per_skill["pummel"].casts
    mixed = _sim(gd, ["pummel", "vicious-strike"], 60).per_skill["pummel"].casts
    assert mixed > alone


def test_pummel_chain_data_is_confirmed_and_per_hit(gd):
    assert gd.skills["pummel"].hits == 3
    assert gd.rules["pummel"].chain_next == "punishing-strike"
    assert gd.skills["pummel"].ranks[0].flat_min.confidence == "confirmed"


@pytest.fixture(scope="module")
def boss_run(gd):
    return bo.optimize_full_build(gd, CharacterBuild("t", "global", 45, class_key=KEY), "boss")


def test_real_data_boss_run_casts_pummel_when_it_adds_dps(gd, boss_run):
    fb = boss_run
    keys = [e.skill_key for e in fb.priority.entries]
    without = Priority(tuple(e for e in fb.priority.entries if e.skill_key != "pummel"))
    dps_without = simulate(gd, fb.build, without, fb.playstyle.scenario).dps
    if fb.result.dps > dps_without * 1.001:  # it adds DPS, so the optimizer must keep it
        assert "pummel" in keys
        assert collections.Counter(c.skill_key for c in fb.result.casts)["pummel"] > 0
    assert fb.result.dps >= dps_without - 1e-6  # and it is never a net loss


@pytest.mark.xfail(strict=False, reason="ENGINE: damage.hit_damage_ex counts one hit per cast; client text for Pummel "
                   "is '119.5% ATK + 93 per hit (3 hits)'. Fix: multiply raw by max(1, skill.hits) there.")
def test_pummel_damage_counts_all_three_hits(gd):
    res = _sim(gd, ["pummel"], 2, attack=3000, crit_chance_pct=0, crit_dmg_pct=0)
    one_hit = 3000 * 1.195 + gd.skills["pummel"].ranks[0].flat_min.value
    assert res.casts[0].damage == pytest.approx(3 * one_hit, rel=1e-6)
