from dataclasses import replace

import pytest

from aion2c.engine.advisor import DEFAULT_DELTAS, marginal_stats
from aion2c.models import CharacterBuild, Priority, PriorityEntry, Stats

PRIO = Priority((PriorityEntry("strike"),))


@pytest.fixture
def build():
    return CharacterBuild("T", "global", 45, stats=Stats(attack=1000))


@pytest.fixture(autouse=True)
def _fake(fake_sim):
    fake_sim("aion2c.engine.advisor.simulate")


def gain(gains, stat):
    return next(g for g in gains if g.stat == stat)


def test_attack_10(mini_gd, build, scen10):
    g = gain(marginal_stats(mini_gd, build, PRIO, scen10), "attack")
    assert g.dps_gain_pct == pytest.approx(1.0, abs=1e-6)
    assert g.delta == 10 and g.confidence == "estimated"


def test_dmg_boost_1(mini_gd, build, scen10):
    g = gain(marginal_stats(mini_gd, build, PRIO, scen10), "dmg_boost_pct")
    assert g.dps_gain_pct == pytest.approx(1.0, abs=1e-6)


def test_sorted_desc(mini_gd, build, scen10):
    gains = marginal_stats(mini_gd, build, PRIO, scen10)
    vals = [g.dps_gain_pct for g in gains]
    assert vals == sorted(vals, reverse=True)
    assert {g.stat for g in gains} == set(DEFAULT_DELTAS)


def test_combat_speed_positive(mini_gd, build, scen10):
    assert gain(marginal_stats(mini_gd, build, PRIO, scen10), "combat_speed_pct").dps_gain_pct > 0


def test_custom_deltas_and_unknown_stat(mini_gd, build, scen10):
    gains = marginal_stats(mini_gd, build, PRIO, scen10, deltas={"attack": 100, "bogus": 1})
    assert [g.stat for g in gains] == ["attack"]
    assert gains[0].dps_gain_pct == pytest.approx(10.0, abs=1e-6)


def test_zero_baseline_is_zero_gain(mini_gd, build, scen10):
    gains = marginal_stats(mini_gd, build, Priority(()), scen10)
    assert all(g.dps_gain_pct == 0.0 for g in gains)
