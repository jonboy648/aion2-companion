"""Item 1 (stat-mod buffs are buffs for seeds and the stigma chooser) and item 2 (total rank = skill points +
Daevanion skill nodes + user bonus_ranks, which is what unlocks specialty slots 12/16/20).

Mini fixture: strike = 100% ATK, 1 s lock, no cooldown; Stats() has attack 1000, 0% crit => 1000 per strike.
"""
from dataclasses import replace

import pytest

from aion2c.data.loader import load_gamedata
from aion2c.engine import build_optimizer as bo
from aion2c.engine.search import _is_buff, _seeds, candidate_skills
from aion2c.engine.simulator import simulate
from aion2c.engine.specialties import choose_specs, skill_rank
from aion2c.models import (
    SCENARIOS, CharacterBuild, DaevanionBoard, DaevanionNode, Num, Priority, PriorityEntry, RankData, SearchBudget,
    SimConfig, SkillKind, SkillRule, SpecEffect, Specialization, Stats, StatMod, Status, daevanion_rank_bonus,
    total_rank,
)
from aion2c.serde import from_dict, to_dict
from aion2c.specs import active_options, slots_at

C = lambda v: Num(v, "confirmed", "test")  # noqa: E731


def P(*keys):
    return Priority(tuple(PriorityEntry(k) for k in keys))


def _ranked(sk, n=20):
    return replace(sk, max_rank=n, ranks=tuple(RankData(i + 1, C(0), C(0), sk.ranks[0].cooldown_s, C(0)) for i in range(n)))


def _board(unlock=1, n=6):
    nodes = {i: DaevanionNode(i, f"Strike +{i}", "Rare", 1, "skill", (), "strike", (), i, 0) for i in range(1, n + 1)}
    return DaevanionBoard("b", "B", unlock, nodes, 99)


@pytest.fixture
def gd(mini_gd):
    """strike has 20 ranks; option 0 unlocks at rank 12 (x2 damage), option 1 at rank 16 (x3 damage)."""
    sk = _ranked(mini_gd.skills["strike"])
    sk = replace(sk, specializations=(
        Specialization(12, "x2", (SpecEffect("dmg_mult", C(2.0)),)),
        Specialization(16, "x3", (SpecEffect("dmg_mult", C(3.0)),)),
    ))
    return replace(mini_gd, skills={**mini_gd.skills, "strike": sk}, daevanion={"b": _board()}, specs_parsed=True)


def build(**kw):
    return CharacterBuild("t", "global", 45, stats=Stats(), **kw)


# ---- item 2: bonus ranks -----------------------------------------------------------------------
def test_skill_point_rank_alone_does_not_unlock_rank_12_option(gd, scen10):
    b = build(skill_ranks={"strike": 10}, specs={"strike": (0,)})
    assert total_rank(gd, b, gd.skills["strike"]) == 10
    r = simulate(gd, b, P("strike"), scen10)
    assert r.total_damage == 10_000 and any("needs rank 12" in w for w in r.warnings)


def test_daevanion_skill_nodes_add_rank_and_unlock_specialty(gd, scen10):
    b = build(skill_ranks={"strike": 10}, specs={"strike": (0,)}, daevanion_nodes=frozenset({1, 2}))
    assert daevanion_rank_bonus(gd, b, "strike") == 2
    assert total_rank(gd, b, gd.skills["strike"]) == 12 and skill_rank(gd, b, "strike") == 12
    assert simulate(gd, b, P("strike"), scen10).total_damage == 20_000  # 10 strikes x 1000 x 2


def test_daevanion_bonus_caps_at_four_and_respects_board_level(gd):
    sk = gd.skills["strike"]
    b6 = build(skill_ranks={"strike": 10}, daevanion_nodes=frozenset(range(1, 7)))
    assert daevanion_rank_bonus(gd, b6, "strike") == 4 and total_rank(gd, b6, sk) == 14
    locked = replace(gd, daevanion={"b": _board(unlock=50)})  # board opens above the build's level 45
    assert total_rank(locked, b6, sk) == 10


def test_bonus_ranks_unlock_like_arcana(gd, scen10):
    sk = gd.skills["strike"]
    b = build(skill_ranks={"strike": 10}, specs={"strike": (0,)}, bonus_ranks={"strike": 2})
    assert total_rank(gd, b, sk) == 12
    assert simulate(gd, b, P("strike"), scen10).total_damage == 20_000
    # Daevanion +2 and Arcana +2 stack: 10 + 2 + 2 = 14, still below the rank-16 option; Arcana +4 reaches 16
    b14 = replace(b, daevanion_nodes=frozenset({1, 2}), bonus_ranks={"strike": 2}, specs={"strike": (1,)})
    assert total_rank(gd, b14, sk) == 14
    assert simulate(gd, b14, P("strike"), scen10).total_damage == 10_000
    b16 = replace(b14, bonus_ranks={"strike": 4})
    assert total_rank(gd, b16, sk) == 16 and simulate(gd, b16, P("strike"), scen10).total_damage == 30_000


def test_total_rank_is_capped_and_negative_bonus_ignored(gd):
    sk = gd.skills["strike"]
    assert total_rank(gd, build(bonus_ranks={"strike": 99}), sk) == 20  # global core cap
    assert total_rank(gd, build(skill_ranks={"strike": 5}, bonus_ranks={"strike": -3}), sk) == 5


def test_choose_specs_sees_bonus_rank(gd, scen10):
    b = build(skill_ranks={"strike": 10})
    assert choose_specs(gd, b, P("strike"), scen10) == {}
    got = choose_specs(gd, replace(b, bonus_ranks={"strike": 2}), P("strike"), scen10)
    assert got == {"strike": (0,)}


def test_bonus_ranks_serde_back_compat():
    old = to_dict(build())
    del old["bonus_ranks"]
    assert from_dict(CharacterBuild, old).bonus_ranks == {}
    b = build(bonus_ranks={"hellfire": 3})
    assert from_dict(CharacterBuild, to_dict(b)) == b


def test_real_data_daevanion_nodes_unlock_hellfire_specialty():
    sorc_gd = load_gamedata(class_key="sorcerer")  # the small fixture holds one hellfire node, the real data four
    nodes = [n.id for br in sorc_gd.daevanion.values() if br.unlock_level <= 45 for n in br.nodes.values()
             if n.skill_key == "hellfire"]
    assert len(nodes) >= 2
    hf = sorc_gd.skills["hellfire"]
    b = CharacterBuild("t", "global", 45, skill_ranks={"hellfire": 10}, daevanion_nodes=frozenset(nodes[:2]))
    assert skill_rank(sorc_gd, b, "hellfire") == 12 and slots_at(sorc_gd, 12) == 2
    assert hf.specializations[3].rank_required == 12  # option 4 needs rank 12
    assert active_options(sorc_gd, replace(b, specs={"hellfire": (3,)}), hf, 12)[0] == (3,)
    assert skill_rank(sorc_gd, replace(b, daevanion_nodes=frozenset()), "hellfire") == 10
    four = replace(b, daevanion_nodes=frozenset(nodes[:4]))  # 10 + 4 = 14: rank-12 option yes, rank-16 option no
    assert skill_rank(sorc_gd, four, "hellfire") == 14 and hf.specializations[4].rank_required == 16
    assert active_options(sorc_gd, replace(four, specs={"hellfire": (3, 4)}), hf, 14)[0] == (3,)


# ---- item 1: stat-mod buffs ---------------------------------------------------------------------
def _buff_gd(mini_gd):
    """strike + a stigma `boost` (no damage; self status +100% attack_increase for 8 s, cd 10)."""
    base = mini_gd.skills["strike"]
    boost = replace(mini_gd.skills["amp"], key="boost", kind=SkillKind.STIGMA,
                    ranks=(RankData(1, C(0), C(0), C(10), C(0)),))
    status = Status("boost_buff", "Boost", "self", C(8), C(1.0), stat_mods=(StatMod("attack_increase_pct", C(100)),))
    return replace(
        mini_gd, skills={"strike": base, "boost": boost}, statuses={"boost_buff": status},
        rules={"boost": SkillRule("boost", applies=("boost_buff",), confidence="confirmed")}, community=())


def test_stat_mod_status_counts_as_buff_and_heads_the_seed(mini_gd):
    g = _buff_gd(mini_gd)
    assert _is_buff(g, "boost") == pytest.approx(2.0)  # 1 + 100/100 x weight 1.0
    b = build(stigmas=("boost",))
    seeds = _seeds(g, b, SCENARIOS[0], candidate_skills(g, b), 64)
    assert [e.skill_key for e in seeds[0][1]] == ["boost", "strike"]


def test_stigma_chooser_values_a_stat_mod_buff(mini_gd, scen10):
    """boost cast at t=0 (1 s lock) lasts to t=8: strikes starting 1..7 s hit x2, 8 and 9 s hit x1:
    7 x 2000 + 2 x 1000 = 16000 vs 10 x 1000 = 10000 without it => +60%."""
    g = _buff_gd(mini_gd)
    picks = bo._optimize_stigmas(g, build(), scen10, SimConfig(), SearchBudget(), 1, None)
    assert [k for k, _ in picks] == ["boost"]
    assert picks[0][1] == pytest.approx(60.0)
    pr = bo._heuristic_priority(g, build(stigmas=("boost",)), scen10, SearchBudget())
    assert simulate(g, build(stigmas=("boost",)), pr, scen10).total_damage == 16_000


def test_front_variants_put_each_stigma_first(mini_gd, scen10):
    g = _buff_gd(mini_gd)
    variants = bo._front_variants(g, build(stigmas=("boost",)), scen10, SearchBudget())
    assert len(variants) == 2 and variants[1].entries[0].skill_key == "boost"
    assert sorted(e.skill_key for e in variants[1].entries) == sorted(e.skill_key for e in variants[0].entries)


@pytest.mark.parametrize("cls,names", [
    ("gladiator", ["lunge-stance", "zikels-blessing"]),
    ("ranger", ["vaizels-authority", "bow-of-blessing"]),
    ("chanter", ["undefeated-mantra", "power-of-the-storm"]),
    ("assassin", ["swift-contract"]),
    ("spiritmaster", ["enhance-spirits-benediction", "flame-blessing"]),
    ("cleric", ["prayer-of-amplification"]),
])
def test_real_community_buffs_are_recognised(cls, names):
    g = load_gamedata(class_key=cls)
    for k in names:
        assert _is_buff(g, k) > 0, k


def test_real_data_chooser_picks_community_buffs():
    """Before the fix these picks scored exactly 0 and never entered the set."""
    for cls, want in (("chanter", {"undefeated-mantra", "power-of-the-storm"}), ("cleric", {"prayer-of-amplification"})):
        g = load_gamedata(class_key=cls)
        b = CharacterBuild("t", "global", 45, stats=Stats(), class_key=cls)
        picks = bo._optimize_stigmas(g, b, SCENARIOS[0], SimConfig(), SearchBudget(), 4, None)
        assert want <= {k for k, _ in picks}, (cls, picks)


def test_front_variant_skipped_for_stigmas_already_cast(mini_gd, scen10):
    g = _buff_gd(mini_gd)
    assert len(bo._front_variants(g, build(stigmas=("boost",)), scen10, SearchBudget(), skip=frozenset({"boost"}))) == 1


def test_stigma_score_is_never_below_leaving_it_uncast(mini_gd, scen10):
    """A stat-mod buff worth +0% is still 'a buff' for ordering, so the greedy priority casts it first and wastes
    1 s of lock every 2 s (boost at 0, 2, 4, 6, 8; strikes in between): 5 x 1000 = 5000 vs 10000 uncast.
    The score keeps the better of the two."""
    g = _buff_gd(mini_gd)
    g = replace(g, statuses={"boost_buff": replace(g.statuses["boost_buff"], stat_mods=(StatMod("attack_increase_pct", C(0)),))},
                skills={**g.skills, "boost": replace(g.skills["boost"], ranks=(RankData(1, C(0), C(0), C(2), C(0)),))})
    b = build(stigmas=("boost",))
    pr = bo._heuristic_priority(g, b, scen10, SearchBudget())
    assert simulate(g, b, pr, scen10).total_damage == 5_000  # boost at 0,2,4,6,8 (1 s each) leaves 5 strike slots
    assert bo._best_stigma_dps(g, b, scen10, SimConfig(), SearchBudget()) == 1000.0  # 10000 / 10 s
