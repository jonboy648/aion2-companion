"""Ranger structured mechanics: every specialty decoded, passive procs, double-count fixes, hand-checked numbers.

Sources for the hand checks: research/classes/ranger/skills.json tokens (Hunter's Soul 53.8% ATK + 344 flat, 50% on crit, 1 s
cooldown; Gale Arrow rank-16 cooldown; Vaizel's Authority +20% Attack). Needs the built ranger gamedata.json.
"""
import math
import time
from dataclasses import replace

import pytest

from aion2c.data import loader
from aion2c.engine import build_optimizer as bo
from aion2c.engine.simulator import simulate
from aion2c.models import (
    CharacterBuild, Priority, PriorityEntry, Scenario, SimConfig, SkillKind, Stats,
)

KEY = "ranger"
OPEN = ("adds_status", "reset_skill", "removes_cooldown", "force_crit")  # kinds that carry no number


@pytest.fixture(scope="module")
def gd():
    if not loader.default_path(KEY).is_file():
        pytest.skip("ranger gamedata not built")
    return loader.load_gamedata(class_key=KEY)


def P(*keys):
    return Priority(tuple(PriorityEntry(k) for k in keys))


def scen(seconds, targets=1, boss=False):
    return Scenario("t", "t", seconds, targets, boss)


def _unknown(sp):
    return (not sp.effects) or any(
        e.kind == "unknown" or e.cond == "unmodeled" or (e.value.value is None and e.kind not in OPEN)
        for e in sp.effects)


# Options whose text carries no amount (Multi-Hit damage, Perfect Chance, "extra damage", AoE target count ...) or whose
# trigger the engine cannot express. Listed so a new unknown cannot appear silently. Each is warned about when chosen.
EXPECTED_UNKNOWN = {
    ("deadshot", 3), ("deadshot", 4), ("snipe", 2), ("rapid-fire", 2), ("spiral-arrow", 2), ("drill-dart", 3),
    ("griffon-arrow", 2), ("griffon-arrow", 3), ("suppressing-arrow", 0), ("burst-arrow", 1),
    ("marking-shot", 0), ("gale-arrow", 3), ("illusory-arrow", 1), ("explosion-trap", 2),
    ("bow-of-blessing", 0), ("bow-of-blessing", 1), ("explosive-arrow-14360000", 2),
    ("vaizels-authority", 0), ("vaizels-authority", 3), ("arrow-scattershot", 3), ("supporting-fire", 3),
}
HIDDEN_TWIN = "explosive-arrow"  # free hidden copy of the stigma: never castable, its options do not count


def test_every_specialty_is_decoded(gd):
    owners = [s for s in gd.skills.values() if s.specializations and s.key != HIDDEN_TWIN]
    options = [(s.key, i) for s in owners for i in range(len(s.specializations))]
    assert len(options) >= 120
    # all 5 options per core active (rank 8/8/8/12/16), 4 per stigma (5/10/15/20)
    for s in owners:
        if s.kind == SkillKind.STIGMA:
            assert [sp.rank_required for sp in s.specializations] == [5, 10, 15, 20], s.key
        elif s.kind == SkillKind.ACTIVE and s.unlock_level is not None:
            assert [sp.rank_required for sp in s.specializations] == [8, 8, 8, 12, 16], s.key
    assert all(sp.effects for s in owners for sp in s.specializations)
    unknown = {(s.key, i) for s in owners for i, sp in enumerate(s.specializations) if _unknown(sp)}
    assert unknown == EXPECTED_UNKNOWN
    assert len(unknown) / len(options) < 0.18


def test_overrides_carry_confidence_and_source(gd):
    for k in ("snare-shot", "drill-dart", "bow-of-blessing", "supporting-fire", "vaizels-authority"):
        for sp in gd.skills[k].specializations:
            for e in sp.effects:
                if e.value.value is not None:
                    assert e.value.confidence in ("confirmed", "estimated") and e.value.source


def test_unknown_specialty_warns_when_chosen(gd):
    b = CharacterBuild("t", "global", 45, skill_ranks={"vaizels-authority": 20}, stigmas=("vaizels-authority",),
                       specs={"vaizels-authority": (3,)}, stats=Stats(crit_chance_pct=50))
    r = simulate(gd, b, P("vaizels-authority", "snipe"), scen(10))
    assert any("not modelled" in w and "Vaizel" in w for w in r.warnings), r.warnings


# ---- hand-checked mechanics ----------------------------------------------------------------------
def test_gale_arrow_minus_10s_cooldown_doubles_casts(gd):
    """Rank 16, option 5 (-10s cooldown): casts in 60 s go from ceil(60/cd) to ceil(60/(cd-10))."""
    sk = gd.skills["gale-arrow"]
    cd = sk.ranks[15].cooldown_s.value
    assert cd is not None and 15 < cd <= 20, cd
    base = CharacterBuild("t", "global", 45, skill_ranks={"gale-arrow": 16})
    n0 = simulate(gd, base, P("gale-arrow"), scen(60)).per_skill["gale-arrow"].casts
    n1 = simulate(gd, replace(base, specs={"gale-arrow": (4,)}), P("gale-arrow"), scen(60)).per_skill["gale-arrow"].casts
    assert n0 == math.ceil(60 / cd) and n1 == math.ceil(60 / (cd - 10))


def test_hunters_soul_fires_half_of_crit_events_with_1s_cooldown(gd):
    """Tempest Shot = 2 hits, crit 50% (the cap): 1.0 crit events per cast, 50% -> 0.5 procs per cast, 10 casts -> 5."""
    b = CharacterBuild("t", "global", 45, stats=Stats(attack=1000, crit_chance_pct=50, crit_dmg_pct=0))
    r = simulate(gd, b, P("tempest-shot"), scen(10))
    assert r.per_skill["tempest-shot"].casts == 10
    hs = r.per_skill["hunters-soul"]
    assert hs.casts == 5
    # 53.8% ATK + 344 flat at rank 1, crit damage 0 so the proc's own crit adds nothing
    assert hs.damage / hs.casts == pytest.approx(1000 * 0.538 + 344, rel=1e-6)
    assert "melee-fire" not in r.per_skill


def test_vaizel_attack_buff_counted_once(gd):
    """+20% Attack is one stat mod, not also a x1.2 multiplier: Tempest damage goes (1200r+f)/(1000r+f)."""
    v = gd.statuses["vaizels_authority"]
    assert v.dmg_mult.value == 1.0
    assert [(m.stat, m.value.value) for m in v.stat_mods] == [("attack_increase_pct", 20.0)]
    st = Stats(attack=1000, crit_chance_pct=0)
    base = CharacterBuild("t", "global", 45, stats=st)
    r0 = simulate(gd, base, P("tempest-shot"), scen(5))
    b1 = replace(base, stigmas=("vaizels-authority",))
    r1 = simulate(gd, b1, P("vaizels-authority", "tempest-shot"), scen(5))
    d0 = r0.casts[0].damage
    d1 = next(c.damage for c in r1.casts if c.skill_key == "tempest-shot")
    rk = gd.skills["tempest-shot"].ranks[0]
    ratio, flat = gd.skills["tempest-shot"].atk_ratio_pct.value / 100, (rk.flat_min.value + rk.flat_max.value) / 2
    assert d1 / d0 == pytest.approx((1200 * ratio + flat) / (1000 * ratio + flat), rel=1e-9)


def test_buff_statuses_have_no_double_counted_multiplier(gd):
    g = gd.statuses["gale"]
    assert g.dmg_mult.value == 1.0
    assert {(m.stat, m.value.value) for m in g.stat_mods} == {("combat_speed_pct", 7.0), ("dmg_boost_pct", 7.0)}
    bow = gd.statuses["bow_of_blessing"]
    assert [m.stat for m in bow.stat_mods] == ["crit_chance_pct"]  # +20% crit damage is specialty option 3 only
    assert bow.stat_mods[0].value.value == pytest.approx(200 * 80 / 1200)
    opt = gd.skills["bow-of-blessing"].specializations[2].effects[0]
    assert opt.kind == "adds_status" and gd.statuses[opt.status_key].stat_mods[0].stat == "crit_dmg_pct"
    dbl = gd.skills["bow-of-blessing"].specializations[3].effects[0]
    assert gd.statuses[dbl.status_key].dmg_mult.value == pytest.approx(1.07)


def test_passive_proc_triggers_and_cooldowns(gd):
    procs = {t.proc_skill: t for t in gd.triggers}
    assert procs["hunters-soul"].event == "crit" and procs["hunters-soul"].chance == 0.5
    assert "melee-fire" not in procs  # deferred in mechanics.json (runtime budget), kept under "deferred_triggers"
    for k in ("hunters-soul", "melee-fire", "concentrated-fire", "rooting-eye"):
        assert all(r.cooldown_s.value == 1 for r in gd.skills[k].ranks), k  # "Cooldown: 1s" in the text
    h = gd.skills["vaizels-authority"].specializations[2].effects[0]  # x1.5 Hunter's Soul while the buff is up
    assert (h.kind, h.skill_key, h.requires_status, h.value.value) == ("dmg_mult", "hunters-soul", "vaizels_authority", 1.5)


def test_stagger_only_and_hidden_skills_are_gated(gd):
    assert "needs_stagger" in gd.skills["arrow-scattershot"].tags
    for k in ("dust-arrow", "impact-kick", "arrow-of-space-time", "eye-of-rapid-burst", "afterimage", "hunters-resolve-active"):
        assert gd.skills[k].regions == frozenset({"korea"}), k
    assert gd.skills["rapid-fire"].regions == frozenset({"global", "korea"})


@pytest.mark.parametrize("style", ["boss", "aoe"])
def test_full_build_picks_specialties_under_30s(gd, style):
    build = CharacterBuild("t", "global", 45, stats=Stats(attack=3000, crit_chance_pct=60, crit_dmg_pct=60),
                           class_key=KEY, skill_points=60, stigma_points=60)
    t0 = time.perf_counter()
    fb = bo.optimize_full_build(gd, build, style)
    assert time.perf_counter() - t0 < 30
    assert fb.build.specs and fb.spec_picks and all(p.dps_gain_pct > 0 for p in fb.spec_picks)
    keys = {e.skill_key for e in fb.priority.entries}
    assert not keys & {"dust-arrow", "impact-kick", "afterimage", "eye-of-rapid-burst", "hunters-resolve-active",
                       "arrow-of-space-time", "arrow-scattershot", "explosive-arrow"}
    assert fb.result.per_skill["hunters-soul"].casts > 0 and fb.result.dps > 0
