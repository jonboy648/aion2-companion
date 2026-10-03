"""P3 acceptance: candidates, optimizer, facade. Unit tests patch simulate with fake_simulate."""
import dataclasses
import itertools

import pytest

from aion2c.engine import search as search_mod
from aion2c.engine.facade import Engine
from aion2c.engine.search import candidate_skills, optimize
from aion2c.interfaces import EngineFacade
from aion2c.models import (
    CharacterBuild,
    Priority,
    PriorityEntry,
    Scenario,
    SearchBudget,
    SimConfig,
    SkillKind,
    Stats,
)
from aion2c.testing.fakes import fake_simulate

NON_CASTABLE = (SkillKind.CHAIN, SkillKind.PROC, SkillKind.CHARGE_TIER, SkillKind.PASSIVE)


def _patch(monkeypatch):
    monkeypatch.setattr("aion2c.engine.search.simulate", fake_simulate)
    monkeypatch.setattr("aion2c.engine.community.simulate", fake_simulate)


def test_candidates_level_gate(sorc_gd):
    b1 = CharacterBuild("t", "global", 1)
    keys1 = {e.skill_key for e in candidate_skills(sorc_gd, b1)}
    assert "flame-arrow" in keys1
    assert not keys1 & {"blaze", "hellfire", "element-enhancement"}
    keys45 = {e.skill_key for e in candidate_skills(sorc_gd, CharacterBuild("t", "global", 45))}
    assert {"blaze", "hellfire"} <= keys45 and "element-enhancement" not in keys45  # stigma: not slotted
    slotted = CharacterBuild("t", "global", 45, stigmas=("element-enhancement",))
    assert "element-enhancement" in {e.skill_key for e in candidate_skills(sorc_gd, slotted)}


def test_candidates_no_chain_children(sorc_gd, mini_gd, default_build):
    for gd in (sorc_gd, mini_gd):
        for e in candidate_skills(gd, default_build):
            assert gd.skills[e.skill_key].kind not in NON_CASTABLE
    assert not {e.skill_key for e in candidate_skills(mini_gd, default_build)} & {"chain2", "chain3"}
    assert not {e.skill_key for e in candidate_skills(sorc_gd, default_build)} & {"burst", "pyroclasm", "fire-mark"}


def test_candidates_charge_levels(sorc_gd, default_build):
    levels = [e.charge_level for e in candidate_skills(sorc_gd, default_build) if e.skill_key == "hellfire"]
    assert levels == [1, 2, 3]


def test_candidates_show_kr(sorc_gd, default_build):
    kr = dataclasses.replace(
        sorc_gd,
        skills={
            **sorc_gd.skills,
            "firebomb": dataclasses.replace(sorc_gd.skills["flame-arrow"], key="firebomb", regions=frozenset({"korea"})),
        },
    )
    assert "firebomb" not in {e.skill_key for e in candidate_skills(kr, default_build)}
    shown = dataclasses.replace(default_build, show_kr=True)
    assert "firebomb" in {e.skill_key for e in candidate_skills(kr, shown)}


def test_budget_respected(monkeypatch, mini_gd, default_build, scen10):
    calls = []

    def spy(*a, **k):
        calls.append(1)
        return fake_simulate(*a, **k)

    monkeypatch.setattr("aion2c.engine.search.simulate", spy)
    monkeypatch.setattr("aion2c.engine.community.simulate", fake_simulate)
    optimize(mini_gd, default_build, scen10)
    assert 0 < len(calls) <= 400
    calls.clear()
    optimize(mini_gd, default_build, scen10, budget=SearchBudget(max_candidates=25))
    assert 0 < len(calls) <= 25


def test_deterministic_seed(monkeypatch, sorc_gd, default_build, scen10):
    _patch(monkeypatch)
    b = SearchBudget(max_candidates=120, seed=3)
    r1 = optimize(sorc_gd, default_build, scen10, budget=b)
    r2 = optimize(sorc_gd, default_build, scen10, budget=b)
    assert [o.priority for o in r1.options] == [o.priority for o in r2.options]
    assert [o.result.dps for o in r1.options] == [o.result.dps for o in r2.options]


def test_top_k_distinct(monkeypatch, sorc_gd, default_build, scen10):
    _patch(monkeypatch)
    res = optimize(sorc_gd, default_build, scen10, top_k=5)
    assert 1 < len(res.options) <= 5
    sigs = [(round(o.result.total_damage, 6), tuple((c.skill_key, c.charge_level) for c in o.result.casts)) for o in res.options]
    assert len(set(sigs)) == len(sigs)
    dps = [o.result.dps for o in res.options]
    assert dps == sorted(dps, reverse=True)
    assert [o.rank for o in res.options] == list(range(1, len(res.options) + 1))
    assert any("distinct priorities simulated" in w for w in res.options[0].result.warnings)
    assert all(o.explanation for o in res.options)


def test_empty_candidates(monkeypatch, sorc_gd, scen10):
    _patch(monkeypatch)
    res = optimize(sorc_gd, CharacterBuild("t", "global", 0), scen10)
    assert res.options == ()


def _mini_build():
    return CharacterBuild("t", "global", 45, stats=Stats(crit_chance_pct=0))


@pytest.mark.needs_sim
def test_mini_optimum(mini_gd, scen10):
    res = optimize(mini_gd, _mini_build(), scen10)
    best = res.options[0]
    assert best.result.dps >= 1800
    keys = [e.skill_key for e in best.priority.entries]
    assert not {"chain2", "chain3"} & set(keys)
    if "amp" in keys and "nuke" in keys:
        assert keys.index("amp") < keys.index("nuke")


@pytest.mark.needs_sim
def test_finds_known_optimum(mini_gd, scen10):
    from aion2c.engine.simulator import simulate

    build = _mini_build()
    cands = candidate_skills(mini_gd, build)
    brute = 0.0
    for n in (1, 2, 3):
        for combo in itertools.permutations(cands, n):
            r = simulate(mini_gd, build, Priority(tuple(combo)), scen10, SimConfig())
            brute = max(brute, r.dps)
    assert optimize(mini_gd, build, scen10).options[0].result.dps >= brute - 1e-9


def test_facade_methods(monkeypatch, mini_gd, default_build, scen10):
    eng = Engine(mini_gd)
    assert isinstance(eng, EngineFacade)
    seen = []

    def spy(gd, build, priority, scenario, cfg=SimConfig(), initial=None):
        seen.append(cfg)
        return fake_simulate(gd, build, priority, scenario, cfg, initial)

    monkeypatch.setattr("aion2c.engine.facade.simulate", spy)
    prio = Priority((PriorityEntry("strike"),))
    eng.simulate(default_build, prio, scen10)
    new = SimConfig(tick_ms=50, anim_overrides={"strike": 2.0})
    eng.set_config(new)
    r = eng.simulate(default_build, prio, scen10)
    assert seen[0] == SimConfig() and seen[1] is new
    assert r.total_damage == pytest.approx(5000.0)  # 2 s lock -> 5 casts of 1000 in 10 s


def test_facade_delegates(monkeypatch, mini_gd, default_build, scen10):
    import aion2c.engine.facade as fac

    calls = {}
    monkeypatch.setattr(fac, "marginal_stats", lambda gd, b, p, s, cfg: calls.setdefault("m", cfg) and [])
    monkeypatch.setattr(fac, "next_skills", lambda gd, b, p, s, live, n: ["x"] * n)
    monkeypatch.setattr(fac, "optimize", lambda gd, b, s, cfg: calls.setdefault("o", cfg) and "ok")
    eng = Engine(mini_gd)
    new = SimConfig(tick_ms=25)
    eng.set_config(new)
    prio = Priority((PriorityEntry("strike"),))
    assert eng.marginal(default_build, prio, scen10) == []
    assert eng.next_skills(default_build, prio, scen10, None, 2) == ["x", "x"]
    assert eng.optimize(default_build, scen10) == "ok"
    assert calls["m"] is new and calls["o"] is new


def test_search_module_has_no_gd_cache():
    # cache must be per-call: nothing hashable-state is kept on the module
    assert not any(isinstance(v, dict) and v for k, v in vars(search_mod).items() if k.startswith("_cache"))
