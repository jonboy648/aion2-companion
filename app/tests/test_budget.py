from dataclasses import replace

import pytest

from aion2c.engine.budget import allocate_points
from aion2c.models import (
    SKILL_POINT_COST,
    STIGMA_POINT_COST,
    CharacterBuild,
    Priority,
    PriorityEntry,
    SimResult,
    Skill,
)


def _sim(gd, build, priority, scenario, cfg=None, initial=None):
    """Rank-sensitive stand-in: DPS = sum over entries of 100 * rank (strike counts double)."""
    total = 0.0
    for e in priority.entries:
        sk = gd.skills[e.skill_key]
        r = build.skill_ranks.get(e.skill_key, 1)
        total += 100.0 * r * (2 if e.skill_key == "strike" else 1)
    return SimResult(total, total, 10.0, (), {}, {}, (), "estimated")


@pytest.fixture(autouse=True)
def _patch(monkeypatch):
    monkeypatch.setattr("aion2c.engine.budget.simulate", _sim)


@pytest.fixture
def gd10(mini_gd):
    """mini_gd with strike/nuke given 10 ranks and strike marked as a stigma-free active."""
    def ext(s: Skill) -> Skill:
        return replace(s, max_rank=10, ranks=tuple(replace(s.ranks[0], rank=i + 1) for i in range(10)))

    skills = dict(mini_gd.skills)
    for k in ("strike", "nuke"):
        skills[k] = ext(skills[k])
    return replace(mini_gd, skills=skills)


def build_with(points, **kw):
    return CharacterBuild("t", "global", 45, skill_points=points, **kw)


def spent(ranks):
    return sum(SKILL_POINT_COST[r] for r in range(1, ranks))


def test_budget_cost_table(gd10, scen10):
    assert sum(SKILL_POINT_COST) == 21
    prio = Priority((PriorityEntry("strike"),))
    ranks, log = allocate_points(gd10, build_with(21), prio, scen10)
    assert ranks["strike"] == 10 and len(log) == 9
    ranks, _ = allocate_points(gd10, build_with(20), prio, scen10)
    assert ranks["strike"] == 9  # rank 10 costs 4 more than the 17 left after rank 9


def test_budget_never_overspends(gd10, scen10):
    prio = Priority((PriorityEntry("strike"), PriorityEntry("nuke")))
    for pts in (0, 1, 5, 13, 30, 100):
        ranks, log = allocate_points(gd10, build_with(pts), prio, scen10)
        used = sum(spent(r) for r in ranks.values())
        assert used <= pts
        assert all(1 <= r <= 10 for r in ranks.values())
    ranks, _ = allocate_points(gd10, build_with(100), prio, scen10)
    assert ranks == {"strike": 10, "nuke": 10}


def test_budget_prefers_damage(gd10, scen10):
    prio = Priority((PriorityEntry("strike"), PriorityEntry("nuke")))
    ranks, log = allocate_points(gd10, build_with(3), prio, scen10)
    assert ranks.get("strike") == 4 and "nuke" not in ranks
    assert [k for k, _, _ in log] == ["strike"] * 3
    assert all(g > 0 for _, _, g in log)


def test_budget_no_points_or_none(gd10, scen10):
    prio = Priority((PriorityEntry("strike"),))
    b = CharacterBuild("t", "global", 45, skill_ranks={"strike": 3})
    ranks, log = allocate_points(gd10, b, prio, scen10)
    assert ranks == {"strike": 3} and log == []


def test_budget_respects_existing_ranks(gd10, scen10):
    prio = Priority((PriorityEntry("strike"),))
    b = build_with(4, skill_ranks={"strike": 8})
    ranks, _ = allocate_points(gd10, b, prio, scen10)
    assert ranks["strike"] == 9  # 8->9 costs 4


def test_stigma_pool_separate(gd10, scen10):
    stig = replace(gd10.skills["nuke"], kind=gd10.skills["nuke"].kind.__class__.STIGMA)
    gd = replace(gd10, skills={**gd10.skills, "nuke": stig})
    prio = Priority((PriorityEntry("strike"), PriorityEntry("nuke")))
    b = CharacterBuild("t", "global", 45, skill_points=0, stigma_points=3, stigmas=("nuke",))
    ranks, log = allocate_points(gd, b, prio, scen10)
    assert ranks == {"nuke": 4}
    assert sum(STIGMA_POINT_COST[r] for r in range(1, 4)) == 3
    # stigma not in build.stigmas gets nothing
    b2 = CharacterBuild("t", "global", 45, stigma_points=10)
    assert allocate_points(gd, b2, prio, scen10)[0] == {}
