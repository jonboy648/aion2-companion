"""Optimizer fixes found by comparing recommended builds with the published community builds
(research/community_builds_vs_engine_2026-10-04.md): every specialty-bearing skill gets its options, stigma ranks run
past 10 and are bought as blocks, PROC skills get ranks, buffs follow the build's own ranks, stigmas that are not in
Global are never offered, and planning can be steered by a searched rotation."""
from dataclasses import replace

import pytest

from aion2c.engine import budget as budget_mod
from aion2c.engine import specialties as spec_mod
from aion2c.engine.budget import allocate_points
from aion2c.engine.build_optimizer import _heuristic_priority, _stigma_pool
from aion2c.engine.rank_values import interp, rank_valued
from aion2c.engine.specialties import choose_specs
from aion2c.models import (
    STIGMA_POINT_COST, CharacterBuild, Num, Priority, PriorityEntry, SearchBudget, SimResult, SkillKind,
    SpecEffect, Specialization,
)

C = lambda v: Num(v, "confirmed", "test")  # noqa: E731


def P(*keys):
    return Priority(tuple(PriorityEntry(k) for k in keys))


def with_options(gd, key, *groups, rank_required=1):
    sk = gd.skills[key]
    sps = tuple(Specialization(rank_required, f"opt{i}", tuple(g)) for i, g in enumerate(groups))
    return replace(gd, skills={**gd.skills, key: replace(sk, specializations=sps)}, specs_parsed=True)


def fake_result(dps):
    return SimResult(dps, dps, 10.0, (), {}, {}, (), "estimated")


# ---- (1) specialties on every eligible skill -----------------------------------------------------
def test_choose_specs_equips_every_skill_not_only_the_first(mini_gd, scen10):
    plus50 = (SpecEffect("dmg_mult", C(1.5)),)
    gd = with_options(with_options(mini_gd, "strike", plus50), "nuke", plus50)
    chosen = choose_specs(gd, CharacterBuild("t", "global", 45), P("nuke", "strike"), scen10)
    assert chosen == {"nuke": (0,), "strike": (0,)}


# ---- (6) options that pay only together ----------------------------------------------------------
def test_choose_specs_finds_enabler_consumer_pair(mini_gd, scen10, monkeypatch):
    """Alone each half is worth nothing (Earth Punishment 'Condemnation crits' + Condemnation 'resets on crit');
    together they are worth +50%. The fake simulator prices them that way; the one-at-a-time greedy takes neither."""
    gd = with_options(mini_gd, "strike", (SpecEffect("force_crit"),))
    gd = with_options(gd, "nuke", (SpecEffect("reset_skill", C(1.0), skill_key="nuke", trigger="crit"),))

    def fake(gd_, build, priority, scenario, cfg=None, initial=None):
        both = build.specs.get("strike") == (0,) and build.specs.get("nuke") == (0,)
        return fake_result(150.0 if both else 100.0)

    monkeypatch.setattr(spec_mod, "simulate", fake)
    chosen = choose_specs(gd, CharacterBuild("t", "global", 45), P("nuke", "strike"), scen10)
    assert chosen == {"strike": (0,), "nuke": (0,)}


def test_pair_search_is_bounded(mini_gd, scen10, monkeypatch):
    gd = with_options(mini_gd, "strike", *[(SpecEffect("force_crit"),)] * 4)
    gd = with_options(gd, "nuke", *[(SpecEffect("reset_skill", C(1.0), skill_key="nuke", trigger="crit"),)] * 4)
    calls = []

    def fake(gd_, build, priority, scenario, cfg=None, initial=None):
        calls.append(1)
        return fake_result(100.0)

    monkeypatch.setattr(spec_mod, "simulate", fake)
    assert choose_specs(gd, CharacterBuild("t", "global", 45), P("nuke", "strike"), scen10) == {}
    assert len(calls) < 400


# ---- (2) stigma ranks past 10, bought as a block --------------------------------------------------
def _stigma_gd(mini_gd, kind=SkillKind.STIGMA, n_ranks=20, spec_rank=15):
    sk = mini_gd.skills["strike"]
    ranks = tuple(replace(sk.ranks[0], rank=i + 1) for i in range(n_ranks))
    opt = Specialization(spec_rank, "tier", (SpecEffect("dmg_mult", C(1.5)),))
    sk = replace(sk, kind=kind, max_rank=n_ranks, ranks=ranks, specializations=(opt,))
    return replace(mini_gd, skills={**mini_gd.skills, "strike": sk}, specs_parsed=True)


def _tier_sim(spec_rank):
    def sim(gd, build, priority, scenario, cfg=None, initial=None):
        r = build.skill_ranks.get("strike", 1)
        return fake_result(100.0 + (1000.0 if r >= spec_rank and build.specs.get("strike") == (0,) else 0.0))
    return sim


def test_stigma_tier_behind_flat_ranks_is_reached_and_ranks_pass_ten(mini_gd, scen10, monkeypatch):
    monkeypatch.setattr(budget_mod, "simulate", _tier_sim(15))
    gd = _stigma_gd(mini_gd)
    need = sum(STIGMA_POINT_COST[:15])  # nothing -> rank 15 (rank 1 is paid too)
    b = CharacterBuild("t", "global", 45, stigmas=("strike",), stigma_points=need)
    ranks, log = allocate_points(gd, b, P("strike"), scen10)
    assert ranks["strike"] == 15 and log[-1][0] == "strike" and log[-1][2] > 0
    ranks, _ = allocate_points(gd, replace(b, stigma_points=need - 1), P("strike"), scen10)
    assert ranks.get("strike", 1) == 1  # one point short of the tier: nothing is worth buying


def test_stigma_rank_cap_is_the_real_cap(mini_gd, scen10, monkeypatch):
    monkeypatch.setattr(budget_mod, "simulate", lambda gd, b, p, s, c=None, initial=None:
                        fake_result(100.0 * b.skill_ranks.get("strike", 1)))
    gd = _stigma_gd(mini_gd)
    b = CharacterBuild("t", "global", 45, stigmas=("strike",), stigma_points=10_000)
    ranks, _ = allocate_points(gd, b, P("strike"), scen10)
    assert ranks["strike"] == 20  # Global stigma cap, not 10 and not the 25 of the Korean client
    gd2 = _stigma_gd(mini_gd, n_ranks=12)
    ranks, _ = allocate_points(gd2, b, P("strike"), scen10)
    assert ranks["strike"] == 12  # the skill's own rank table ends first


def test_skill_points_still_stop_at_ten(mini_gd, scen10, monkeypatch):
    monkeypatch.setattr(budget_mod, "simulate", lambda gd, b, p, s, c=None, initial=None:
                        fake_result(100.0 * b.skill_ranks.get("strike", 1)))
    gd = _stigma_gd(mini_gd, kind=SkillKind.ACTIVE)
    b = CharacterBuild("t", "global", 45, skill_points=10_000)
    ranks, _ = allocate_points(gd, b, P("strike"), scen10)
    assert ranks["strike"] == 10


def test_block_that_does_not_fit_falls_back_to_a_shorter_one(mini_gd, scen10, monkeypatch):
    """With 6 points the tier block (34) is out of reach, but ranks that each pay still get bought."""
    monkeypatch.setattr(budget_mod, "simulate", lambda gd, b, p, s, c=None, initial=None:
                        fake_result(100.0 * b.skill_ranks.get("strike", 1)))
    gd = _stigma_gd(mini_gd)
    b = CharacterBuild("t", "global", 45, stigmas=("strike",), stigma_points=6)
    ranks, _ = allocate_points(gd, b, P("strike"), scen10)
    assert ranks["strike"] == 5  # five 1-point ranks (5 points; rank 1 is paid); the 2-point rank 6 no longer fits


# ---- (4) a rank is valued by all its open slots ---------------------------------------------------
def test_rank_valued_by_every_slot_it_opens(mini_gd, scen10, monkeypatch):
    """Rank 12 opens the second slot. Two options worth +10% each: a one-option valuation sees +10% at rank 8 and
    nothing at rank 12, so the allocator stops at 8; valuing every open slot sees +10% again at rank 12."""
    effs = (SpecEffect("dmg_mult", C(1.1)),)
    gd = with_options(mini_gd, "strike", effs, effs)
    sk = gd.skills["strike"]
    gd = replace(gd, skills={**gd.skills, "strike": replace(
        sk, max_rank=12, ranks=tuple(replace(sk.ranks[0], rank=i + 1) for i in range(12)),
        specializations=tuple(replace(sp, rank_required=8) for sp in sk.specializations))})

    def sim(gd_, build, priority, scenario, cfg=None, initial=None):
        n = len(build.specs.get("strike", ()))
        slots = 1 if build.skill_ranks.get("strike", 1) >= 8 else 0
        slots += 1 if build.skill_ranks.get("strike", 1) >= 12 else 0
        return fake_result(100.0 * 1.1 ** min(n, slots))

    monkeypatch.setattr(budget_mod, "simulate", sim)
    b = CharacterBuild("t", "global", 45, skill_points=10_000)
    gd = replace(gd, rank_caps={**gd.rank_caps, "global": {"core": 20, "stigma": 20}})
    monkeypatch.setattr(budget_mod, "BASE_RANK_CAP", 12)
    ranks, log = allocate_points(gd, b, P("strike"), scen10)
    assert ranks["strike"] == 12


# ---- (7) PROC skills and stigmas without an unlock level -----------------------------------------
def test_proc_skills_receive_ranks(mini_gd, scen10, monkeypatch):
    monkeypatch.setattr(budget_mod, "simulate", lambda gd, b, p, s, c=None, initial=None:
                        fake_result(100.0 * b.skill_ranks.get("strike", 1)))
    gd = _stigma_gd(mini_gd, kind=SkillKind.PROC, n_ranks=10)
    ranks, _ = allocate_points(gd, CharacterBuild("t", "global", 45, skill_points=10_000), P("strike"), scen10)
    assert ranks["strike"] == 10


def test_stigma_without_unlock_level_is_not_offered(mini_gd):
    st = replace(mini_gd.skills["strike"], kind=SkillKind.STIGMA, unlock_level=None)
    st2 = replace(mini_gd.skills["nuke"], kind=SkillKind.STIGMA, unlock_level=22)
    gd = replace(mini_gd, skills={**mini_gd.skills, "strike": st, "nuke": st2})
    assert _stigma_pool(gd, CharacterBuild("t", "global", 45)) == ["nuke"]


# ---- (3) planning against a searched rotation ----------------------------------------------------
def test_guide_rotation_goes_first_and_only_castable_entries(mini_gd, scen10):
    b = CharacterBuild("t", "global", 45)
    guide = Priority((PriorityEntry("nuke"), PriorityEntry("not_a_skill"), PriorityEntry("strike")))
    pri = _heuristic_priority(mini_gd, b, scen10, SearchBudget(max_candidates=20), guide)
    keys = [e.skill_key for e in pri.entries]
    assert keys[:2] == ["nuke", "strike"] and "not_a_skill" not in keys
    assert len(keys) == len(set(keys))


# ---- (5) rank-aware buffs -------------------------------------------------------------------------
def test_anchor_interpolation():
    assert interp(((1, 10.0), (10, 14.5)), 1) == 10.0
    assert interp(((1, 10.0), (10, 14.5)), 5.5) == pytest.approx(12.25)
    assert interp(((1, 10.0), (10, 14.5)), 99) == 14.5
    assert interp(((5, 1.0), (10, 2.0)), 1) == 1.0


CLASSES = ("assassin", "chanter", "cleric", "gladiator", "ranger", "sorcerer", "spiritmaster", "templar")


@pytest.mark.parametrize("cls", CLASSES)
def test_rank_scales_match_shipped_values(cls):
    """Every rank scale names a real skill and a stat the status has, and its curve returns the shipped value at the
    rank the data says it is stated at (so a data rebuild that moves an anchor fails here)."""
    from aion2c import webapi
    gd = webapi._gd(cls)
    for key, st in gd.statuses.items():
        for rs in st.rank_scales:
            assert rs.skill in gd.skills, (cls, key, rs.skill)
            assert list(rs.anchors) == sorted(rs.anchors), (cls, key)
            have = (st.duration_s.value if rs.target == "duration"
                    else next(m.value.value for m in st.stat_mods if m.stat == rs.target))
            assert interp(rs.anchors, rs.at_rank) == pytest.approx(have, abs=0.01), (cls, key)


def test_thirty_statuses_are_rank_aware():
    from aion2c import webapi
    n = sum(1 for c in CLASSES for st in webapi._gd(c).statuses.values() if st.rank_scales)
    assert n == 30


def test_buff_value_follows_the_build_rank():
    from aion2c import webapi
    gd = webapi._gd("cleric")
    lo = rank_valued(gd, CharacterBuild("t", "global", 45, skill_ranks={"light-of-protection": 1}))
    hi = rank_valued(gd, CharacterBuild("t", "global", 45, skill_ranks={"light-of-protection": 20}))
    val = lambda g: next(m.value.value for m in g.statuses["light_of_protection"].stat_mods if m.stat == "dmg_boost_pct")  # noqa: E731
    assert val(lo) == pytest.approx(10.5) and val(hi) == pytest.approx(20.0)
    assert gd.statuses["light_of_protection"].stat_mods[0].value.value == 18.0  # the shipped data is untouched
    sorc = webapi._gd("sorcerer")
    ee = lambda r: rank_valued(sorc, CharacterBuild("t", "global", 45, skill_ranks={"element-enhancement": r})  # noqa: E731
                               ).statuses["element_enhancement"].duration_s.value
    assert ee(1) == 10.0 and ee(20) == 20.0 and ee(10) == pytest.approx(14.5)
    assert rank_valued(sorc, CharacterBuild("t", "global", 45, skill_ranks={"element-enhancement": 7})) is \
        rank_valued(sorc, CharacterBuild("t", "global", 45, skill_ranks={"element-enhancement": 7}))  # cached


# ---- (7) stigma set search: planned ranks, tier options, community sets ------------------------------
from aion2c.engine import build_optimizer as bo_mod  # noqa: E402
from aion2c.models import CommunityRotation  # noqa: E402


def _many_stigmas(mini_gd, keys, tier_on=()):
    """`keys` as stigmas (copies of 'strike'); those in `tier_on` get a rank-15 specialty option."""
    sk = mini_gd.skills["strike"]
    ranks = tuple(replace(sk.ranks[0], rank=i + 1) for i in range(20))
    opt = Specialization(15, "tier", (SpecEffect("dmg_mult", C(1.5)),))
    skills = dict(mini_gd.skills)
    for k in keys:
        skills[k] = replace(sk, key=k, name=k, kind=SkillKind.STIGMA, unlock_level=22, max_rank=20, ranks=ranks,
                            specializations=(opt,) if k in tier_on else ())
    return replace(mini_gd, skills=skills, specs_parsed=True)


def test_planned_stigma_rank(mini_gd):
    b = CharacterBuild("t", "global", 45)
    assert bo_mod._planned_stigma_rank(mini_gd, b, 4) == 0  # no points to spend: ranks as entered
    to10 = 4 * sum(STIGMA_POINT_COST[:10])
    assert bo_mod._planned_stigma_rank(mini_gd, replace(b, stigma_points=to10), 4) == 10
    assert bo_mod._planned_stigma_rank(mini_gd, replace(b, stigma_points=to10 - 1), 4) == 9
    assert bo_mod._planned_stigma_rank(mini_gd, replace(b, stigma_points=10**6), 4) == 20  # the Global cap


def _stigma_sim(bonus):
    """100 flat plus `bonus(build)`. Patched into every module the stigma search simulates through."""
    return lambda gd, build, priority, scenario, cfg=None, initial=None: fake_result(100.0 + bonus(build))


def test_stigma_search_sees_a_tier_option_at_the_planned_rank(mini_gd, scen10, monkeypatch):
    """Stigma 'tier' is worth +1000 only at rank 15 with its option equipped. Scored at the build's own rank 1 with
    no options it is worth nothing and loses to a stigma worth +10; scored at its planned rank with the option it wins."""
    gd = _many_stigmas(mini_gd, ["tier", "plain"], tier_on=("tier",))

    def bonus(b):
        r = b.skill_ranks.get("tier", 1)
        tier = "tier" in b.stigmas and r >= 15 and b.specs.get("tier") == (0,)
        return (10.0 if "plain" in b.stigmas else 0.0) + (1000.0 if tier else 0.0)

    for mod in (bo_mod, spec_mod):
        monkeypatch.setattr(mod, "simulate", _stigma_sim(bonus))
    rest = (scen10, bo_mod.SimConfig(), SearchBudget(max_candidates=10), 1, None)
    with_points = CharacterBuild("t", "global", 45, stigma_points=sum(STIGMA_POINT_COST[:15]))
    assert [k for k, _ in bo_mod._optimize_stigmas(gd, with_points, *rest)] == ["tier"]
    # nothing to spend: nothing is planned, so the stigma worth +10 right now stays the pick
    assert [k for k, _ in bo_mod._optimize_stigmas(gd, CharacterBuild("t", "global", 45), *rest)] == ["plain"]


def test_community_stigma_set_replaces_a_worse_search_result(mini_gd, scen10, monkeypatch):
    """Worth +1000 only with a, b and c together: forward selection and single swaps starting from d and e cannot
    get there, but the community set (a, b, c) scores it and replaces the search's result."""
    gd = _many_stigmas(mini_gd, ["d", "e", "a", "b", "c"])
    sim = _stigma_sim(lambda b: 1000.0 if {"a", "b", "c"} <= set(b.stigmas) else 0.0)
    for mod in (bo_mod, spec_mod):
        monkeypatch.setattr(mod, "simulate", sim)
    monkeypatch.setattr(bo_mod, "_stigma_pool", lambda gd_, b: ["d", "e", "a", "b", "c"])
    rest = (scen10, bo_mod.SimConfig(), SearchBudget(max_candidates=10), 3, None)
    build = CharacterBuild("t", "global", 45)
    alone = bo_mod._optimize_stigmas(gd, build, *rest)
    assert sorted(k for k, _ in alone) != ["a", "b", "c"]  # the search alone is stuck
    seeded = replace(gd, community=(CommunityRotation("r", "t", scen10.key, ("a", "b", "c"), ""),))
    assert sorted(k for k, _ in bo_mod._optimize_stigmas(seeded, build, *rest)) == ["a", "b", "c"]


def test_judge_sets_prefers_the_better_plan_and_the_first_on_ties(mini_gd, scen10, monkeypatch):
    gd = _many_stigmas(mini_gd, ["a", "b"])
    worth = {("a",): 100.0, ("b",): 150.0}
    monkeypatch.setattr(bo_mod, "_fast_eval", lambda gd_, b, sc, cfg, bud, extra=(): (worth[b.stigmas], P("strike"), None))
    monkeypatch.setattr(bo_mod, "allocate_points", lambda gd_, b, *a, **k: (dict(b.skill_ranks), []))
    monkeypatch.setattr(bo_mod, "plan_daevanion", lambda *a, **k: [])
    monkeypatch.setattr(bo_mod, "choose_specs", lambda *a, **k: {})
    monkeypatch.setattr(bo_mod, "simulate", lambda gd_, b, p, s, c=None, initial=None: fake_result(worth[b.stigmas]))
    build = CharacterBuild("t", "global", 45, stigma_points=10)
    judge = lambda sets: bo_mod._judge_sets(gd, build, scen10, bo_mod.SimConfig(), SearchBudget(max_candidates=10),
                                            None, sets, 0)
    assert judge([("a",), ("b",)]) == ("b",)
    assert judge([("b",), ("a",)]) == ("b",)
    worth[("a",)] = 150.0
    assert judge([("a",), ("b",)]) == ("a",) and judge([("b",), ("a",)]) == ("b",)
