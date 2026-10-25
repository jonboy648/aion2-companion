"""Goal selection through real simulator, optimizer and JSON API boundaries."""
from copy import deepcopy
from dataclasses import replace

import pytest

from aion2c import serde, webapi
from aion2c.engine import build_optimizer as bo
from aion2c.engine.search import optimize
from aion2c.engine.simulator import simulate
from aion2c.models import (
    CharacterBuild, DaevanionBoard, DaevanionEffect, DaevanionNode, Num,
    Priority, PriorityEntry, Scenario, SearchBudget, SkillKind, SkillRule, Specialization, SpecEffect,
    SKILL_POINT_COST, STIGMA_POINT_COST,
)


def known(value):
    return Num(value, "confirmed", "synthetic objective witness")


@pytest.fixture
def goal_gd(mini_gd):
    source = mini_gd.skills["strike"]

    def skill(key, *, ratio, gauge, kind=SkillKind.ACTIVE, cd=0, hp=1):
        return replace(source, key=key, name=key, kind=kind, atk_ratio_pct=known(ratio),
                       stagger_gauge=gauge, hp_dmg_coeff=hp,
                       ranks=(replace(source.ranks[0], cooldown_s=known(cd)),))

    skills = {
        "strike": skill("strike", ratio=300, gauge=1),
        "gauge": skill("gauge", ratio=0, gauge=40, hp=0),
    }
    return replace(mini_gd, skills=skills, rules={}, statuses={}, triggers=(), links=(), community=(),
                   daevanion={}, specs_parsed=True)


def test_rotation_goal_changes_real_winner_and_preserves_hp_damage(goal_gd):
    build = CharacterBuild("goal", "global", 45)
    sc = Scenario("goal", "goal", 10, 1, True)
    budget = SearchBudget(max_candidates=40)
    damage = optimize(goal_gd, build, sc, budget=budget).options[0]
    stagger_options = optimize(goal_gd, build, replace(sc, objective="stagger"), budget=budget)
    stagger = stagger_options.options[0]
    assert damage.priority.entries[0].skill_key == "strike"
    assert stagger.priority.entries[0].skill_key == "gauge"
    assert damage.result.dps == 3000
    assert stagger.result.dps == 0
    assert stagger.result.stagger_per_s == 40
    assert stagger.result.total_stagger == 400
    assert "gauge/s" in stagger.explanation
    assert not stagger_options.disagreements
    # A subsequent default call must not inherit another request's goal.
    assert optimize(goal_gd, build, sc, budget=budget).options[0].result.dps == damage.result.dps


def test_gauge_only_build_is_searchable_without_hp_damage(goal_gd):
    gd = replace(goal_gd, skills={"gauge": goal_gd.skills["gauge"]})
    sc = Scenario("goal", "goal", 5, 1, True, objective="stagger")
    result = optimize(gd, CharacterBuild("goal", "global", 45), sc)
    assert result.options
    assert result.options[0].result.stagger_per_s == 40
    assert result.options[0].result.dps == 0


def test_unknown_eligible_gauge_remains_visible_when_the_winner_does_not_cast_it(goal_gd):
    gd = replace(goal_gd, skills={**goal_gd.skills, "strike": replace(goal_gd.skills["strike"], stagger_gauge=None)})
    b = CharacterBuild("coverage", "global", 45)
    sc = Scenario("goal", "goal", 10, 1, True, objective="stagger")
    searched = optimize(gd, b, sc).options[0].result
    planned = bo.optimize_full_build(gd, b, "boss", 0, objective="stagger")

    for result in (searched, planned.result):
        assert result.stagger_per_s == 40
        assert "strike" not in {cast.skill_key for cast in result.casts}
        assert any("Stagger amount unavailable: strike" in message for message in result.warnings)
        assert result.confidence == "unknown"
    assert any("Stagger amount unavailable: strike" in message for message in planned.warnings)


@pytest.mark.parametrize("child_level,missing", [(1, True), (99, False)])
def test_coverage_follows_only_unlocked_chain_children_even_if_root_is_unused(goal_gd, monkeypatch, child_level, missing):
    source = goal_gd.skills["strike"]
    skills = {
        "known": replace(source, key="known", name="known", stagger_gauge=7),
        "root": replace(source, key="root", name="root", stagger_gauge=0),
        "child": replace(source, key="child", name="child", kind=SkillKind.CHAIN,
                         unlock_level=child_level, stagger_gauge=None),
    }
    gd = replace(goal_gd, skills=skills, rules={"root": SkillRule("root", chain_next="child")})
    b = CharacterBuild("coverage", "global", 10)
    monkeypatch.setitem(webapi._GD, "sorcerer", gd)
    sc = Scenario("goal", "goal", 10, 1, True, objective="stagger")
    searched = optimize(gd, b, sc).options[0].result
    planned = bo.optimize_full_build(gd, b, "burst", 0, objective="stagger")
    api = webapi.optimize(serde.to_dict(b), "burst", 0, objective="stagger")

    for messages in (searched.warnings, planned.warnings, api["warnings"]):
        assert any("Stagger amount unavailable: child" in message for message in messages) is missing
    assert searched.stagger_per_s == planned.result.stagger_per_s == api["objective_score"] == 7


@pytest.fixture
def planner_gd(goal_gd):
    skills = {}
    for key, sk in goal_gd.skills.items():
        ranks = tuple(replace(sk.ranks[0], rank=r, cooldown_s=known(4 if r == 1 else 0),
                              flat_min=known(1000 * (r - 1) if key == "strike" else 0),
                              flat_max=known(1000 * (r - 1) if key == "strike" else 0)) for r in (1, 2, 3))
        skills[key] = replace(sk, max_rank=3, ranks=ranks, specializations=(
            Specialization(2, "HP damage", (SpecEffect("dmg_mult", known(10)),)),
            Specialization(2, "Speed", (SpecEffect("cast_speed_pct", known(100)),)),
        ))
    for key, source, ratio, gauge in (
        ("damage-stigma", "strike", 2000, 0), ("gauge-stigma", "gauge", 0, 500),
    ):
        sk = skills[source]
        skills[key] = replace(sk, key=key, name=key, kind=SkillKind.STIGMA, atk_ratio_pct=known(ratio),
                              stagger_gauge=gauge, max_rank=2, specializations=(),
                              ranks=tuple(replace(sk.ranks[0], rank=r, cooldown_s=known(60 if r == 1 else 10),
                                                  flat_min=known(0), flat_max=known(0)) for r in (1, 2)))

    def board(key, start, currency):
        # Both currencies independently choose between HP attack and cast speed; an opened inert node stays held.
        nodes = {
            start: DaevanionNode(start, "start", "Common", 0, "start", (), None, (start+1, start+2, start+3), 0, 0),
            start+1: DaevanionNode(start+1, "HP attack", "Common", 1, "stat",
                                  (DaevanionEffect("Attack Bonus", 10000, "flat"),), None, (start,), 1, 0),
            start+2: DaevanionNode(start+2, "speed", "Common", 1, "stat",
                                  (DaevanionEffect("Combat Speed", 100, "%"),), None, (start,), 0, 1),
            start+3: DaevanionNode(start+3, "held", "Common", 1, "stat", (), None, (start,), 0, -1),
        }
        return DaevanionBoard(key, key, 1, nodes, start, currency)

    return replace(goal_gd, skills=skills, stigma_slots={"global": 1, "korea": 1},
                   spec_slot_ranks=(known(2),),
                   daevanion={"ordinary": board("ordinary", 100, "daevanion"),
                              "battle": board("battle", 200, "battle")})


@pytest.mark.parametrize("objective,core,stigma,option,nodes", [
    ("damage", "strike", "damage-stigma", 0, {101, 103, 201}),
    ("stagger", "gauge", "gauge-stigma", 1, {102, 103, 202}),
])
def test_full_build_selects_goal_for_stigmas_ranks_specs_and_both_node_currencies(
    planner_gd, objective, core, stigma, option, nodes,
):
    build = CharacterBuild("goal", "global", 45, skill_points=1, stigma_points=2,
                           skill_ranks={"strike": 1, "gauge": 1}, daevanion_nodes=frozenset({103}),
                           stigma_unlocked=True)
    before, gd_before = deepcopy(build), deepcopy(planner_gd)
    fb = bo.optimize_full_build(planner_gd, build, "boss", 1, battle_points=1, objective=objective)
    assert fb.build.stigmas == (stigma,)
    assert fb.build.skill_ranks[core] == 2
    assert fb.build.skill_ranks[stigma] == 2
    assert fb.build.specs[core] == (option,)
    assert set(fb.build.daevanion_nodes) == nodes
    assert sum(sum(SKILL_POINT_COST[build.skill_ranks.get(k, 1):r])
               for k, r in fb.build.skill_ranks.items() if k in ("strike", "gauge")) <= 1
    assert sum(sum(STIGMA_POINT_COST[:fb.build.skill_ranks[k]]) for k in fb.build.stigmas) <= 2
    assert build == before and planner_gd == gd_before
    sc = replace(bo.PLAYSTYLES[0].scenario, objective=objective)
    actual = simulate(planner_gd, fb.build, fb.priority, sc)
    assert fb.result.dps == actual.dps
    assert fb.objective_score == (actual.dps if objective == "damage" else actual.stagger_per_s)
    assert fb.objective == objective
    assert fb.playstyle.scenario.objective == objective
    assert fb.spec_picks and all(p.goal_gain_pct > 0 for p in fb.spec_picks)
    if objective == "stagger":
        assert not fb.variants and not fb.stat_gains
        assert all(p.dps_gain_pct == 0 for p in fb.spec_picks)
        assert any("not predicted breaks" in w for w in fb.warnings)


@pytest.mark.parametrize("objective,unit", [("damage", "DPS"), ("stagger", "gauge/s")])
def test_webapi_objective_baseline_and_compare_use_same_goal(goal_gd, monkeypatch, objective, unit):
    monkeypatch.setitem(webapi._GD, "sorcerer", goal_gd)
    build = serde.to_dict(CharacterBuild("goal", "global", 10))
    before = deepcopy(build)
    progress = []
    result = webapi.optimize(build, "burst", 0, progress.append, 0, objective)
    assert progress
    assert result["objective"] == objective
    assert result["objective_unit"] == unit
    assert result["objective_score"] == (3000 if objective == "damage" else 40)
    assert result["current_objective_score"] == result["objective_score"]
    assert result["current_dps"] == (3000 if objective == "damage" else 0)
    assert result["result"]["dps"] == result["current_dps"]
    compared = webapi.compare(build, 0, progress.append, 0, objective)
    assert set(compared) == {"boss", "aoe", "leveling", "burst"}
    assert all(row["objective"] == objective and row["objective_unit"] == unit for row in compared.values())
    assert build == before


def test_default_api_damage_matches_explicit_damage(goal_gd, monkeypatch):
    monkeypatch.setitem(webapi._GD, "sorcerer", goal_gd)
    build = serde.to_dict(CharacterBuild("goal", "global", 10))
    assert webapi.optimize(build, "burst", 0) == webapi.optimize(build, "burst", 0, objective="damage")


@pytest.mark.parametrize("objective,current_score,current_dps", [("damage", 750, 750), ("stagger", 10.25, 750)])
def test_webapi_baseline_scores_entered_build_before_any_planning(
    planner_gd, monkeypatch, objective, current_score, current_dps,
):
    monkeypatch.setitem(webapi._GD, "sorcerer", planner_gd)
    build = CharacterBuild("goal", "global", 45, skill_points=1, stigma_points=2, stigma_unlocked=True,
                           skill_ranks={"strike": 1, "gauge": 1}, daevanion_nodes=frozenset({103}))
    payload = serde.to_dict(build)
    result = webapi.optimize(payload, "boss", 1, battle_points=1, objective=objective)
    # At rank 1 each skill is ready every four seconds: 45 Strike casts (3000 HP and 1 gauge each),
    # plus 45 gauge casts (40 gauge each) when pursuing Stagger, over the unchanged 180-second fight.
    assert result["current_objective_score"] == current_score
    assert result["current_dps"] == current_dps
    assert result["objective_score"] > current_score
    assert result["build"]["skill_ranks"] != payload["skill_ranks"]
    assert payload == serde.to_dict(build)


def test_full_build_keeps_specialty_that_enables_gauge_from_zero(goal_gd):
    owner = replace(goal_gd.skills["strike"], stagger_gauge=0, specializations=(
        Specialization(1, "unlock gauge chain", (SpecEffect("cooldown_add_s", known(-1)),)),
    ))
    child = replace(goal_gd.skills["gauge"], kind=SkillKind.CHAIN)
    gd = replace(goal_gd, skills={"strike": owner, "gauge": child}, rules={
        "strike": SkillRule("strike", chain_next="gauge"),
        "gauge": SkillRule("gauge", requires_spec=("strike", 0)),
    })
    fb = bo.optimize_full_build(gd, CharacterBuild("goal", "global", 10), "burst", 0, objective="stagger")
    assert fb.build.specs == {"strike": (0,)}
    actual = simulate(gd, fb.build, fb.priority, fb.playstyle.scenario)
    assert fb.result.stagger_per_s == actual.stagger_per_s > 0
    assert fb.result.dps == actual.dps
    assert fb.spec_picks[0].goal_gain_pct is None  # a percentage over a zero baseline is undefined


@pytest.mark.parametrize("objective,node,core,option", [
    ("damage", 101, "strike", 0), ("stagger", 102, "gauge", 1),
])
def test_full_build_scores_skill_nodes_and_the_specialties_they_unlock(planner_gd, objective, node, core, option):
    board = planner_gd.daevanion["ordinary"]
    nodes = dict(board.nodes)
    nodes[101] = replace(nodes[101], node_type="skill", skill_key="strike", effects=())
    nodes[102] = replace(nodes[102], node_type="skill", skill_key="gauge", effects=())
    gd = replace(planner_gd, skills={k: sk for k, sk in planner_gd.skills.items() if sk.kind == SkillKind.ACTIVE},
                 daevanion={"ordinary": replace(board, nodes=nodes)})
    build = CharacterBuild("goal", "global", 10, skill_points=0, stigma_points=0)
    fb = bo.optimize_full_build(gd, build, "boss", 1, objective=objective)
    assert fb.build.daevanion_nodes == frozenset({node})
    assert fb.build.specs[core] == (option,)
    assert fb.build.skill_ranks == {}  # node ranks spend no skill or stigma points
    actual = simulate(gd, fb.build, fb.priority, fb.playstyle.scenario)
    assert actual.dps == fb.result.dps
    assert actual.stagger_per_s == fb.result.stagger_per_s


@pytest.mark.parametrize("objective", ["damage", "stagger"])
def test_full_build_exposes_sorcerer_conditional_and_projectile_limits(goal_gd, objective):
    skills = {"frost-burst": replace(goal_gd.skills["strike"], key="frost-burst"),
              "firestorm": replace(goal_gd.skills["gauge"], key="firestorm")}
    gd = replace(goal_gd, skills=skills)
    fb = bo.optimize_full_build(gd, CharacterBuild("goal", "global", 10), "burst", 0, objective=objective)
    warnings = " ".join(fb.warnings).lower()
    assert "frost burst" in warnings and "immunity" in warnings and "not modeled" in warnings
    assert "firestorm" in warnings and "five-fireball" in warnings and "aggregate" in warnings
    assert "native" in warnings and "timing" in warnings


@pytest.mark.parametrize("objective", ["breaks", "", None])
def test_invalid_goals_fail_clearly_at_optimizer_and_api_boundaries(goal_gd, monkeypatch, objective):
    monkeypatch.setitem(webapi._GD, "sorcerer", goal_gd)
    build = CharacterBuild("goal", "global", 10)
    with pytest.raises(ValueError, match="objective"):
        optimize(goal_gd, build, Scenario("goal", "goal", 5, 1, True, objective=objective))
    with pytest.raises(ValueError, match="objective"):
        bo.optimize_full_build(goal_gd, build, "burst", objective=objective)
    with pytest.raises(ValueError, match="objective"):
        webapi.optimize(serde.to_dict(build), "burst", objective=objective)
    with pytest.raises(ValueError, match="objective"):
        webapi.compare(serde.to_dict(build), objective=objective)
