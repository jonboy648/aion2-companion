"""Spiritmaster structured mechanics (research/classes/spiritmaster/mechanics.json): specialties decoded, the Four
Elements counter, Dimensional Control proc, Spirit-skill / hidden-skill gating, stat-mod statuses, auras, Flame
Blessing tick, optimizer picks specialties.

Hand-checked values: the arithmetic is written out in each test from datamine numbers (ratio + flat from the skill
tables, rank 1) on Stats(attack 1000, 0% crit); the Spirit Strike passive adds +15% damage boost to everything."""
import time
from dataclasses import replace

import pytest

from aion2c.data import loader
from aion2c.engine import build_optimizer as bo
from aion2c.engine.simulator import simulate
from aion2c.models import SCENARIOS, CharacterBuild, Priority, PriorityEntry, Scenario, SkillKind, Stats
from aion2c.specparse import spec_coverage

KEY = "spiritmaster"
BOSS = next(s for s in SCENARIOS if s.key == "boss_180")
S15 = Scenario("t15", "15 s", 15, 1, True)
AURA = 1.15  # spirit_strike_aura: +15% PvE damage boost (rank 10 value, see its source string)
SUMMONS4 = ("summon-fire-spirit", "summon-water-spirit", "summon-earth-spirit", "summon-wind-spirit")

# options with no value in any source: kind "unknown", or Multi-Hit (chance known, damage per proc not)
UNKNOWN = {
    ("cold-shock", 2), ("souls-cry", 0), ("jointstrike-curse", 1), ("elemental-fusion", 0), ("elemental-fusion", 1),
    ("elemental-fusion", 2), ("dimensional-control", 1), ("dimensional-control", 2), ("rapid-scattershot", 3),
}
# decoded, number known, but needs a state the simulator does not track (Spirit auto-attacks, charge time, stacks)
UNMODELED = {
    ("cold-shock", 3), ("summon-fire-spirit", 1), ("summon-fire-spirit", 2), ("summon-fire-spirit", 4),
    ("summon-water-spirit", 1), ("summon-water-spirit", 2), ("summon-water-spirit", 4), ("summon-wind-spirit", 1),
    ("summon-wind-spirit", 2), ("summon-wind-spirit", 4), ("summon-earth-spirit", 2), ("summon-earth-spirit", 4),
    ("jointstrike-destructive-attack", 0), ("summon-ancient-spirit", 0), ("summon-ancient-spirit", 1),
    ("summon-ancient-spirit", 2), ("summon-ancient-spirit", 3), ("elemental-fusion", 3), ("elemental-fusion", 4),
    ("flame-blessing", 3),
}


@pytest.fixture(scope="module")
def gd():
    return loader.load_gamedata(class_key=KEY)


def P(*keys):
    return Priority(tuple(PriorityEntry(k) for k in keys))


def build(**kw):
    kw.setdefault("stats", Stats(crit_chance_pct=0))
    return CharacterBuild("t", "global", 45, class_key=KEY, **kw)


def tally(res, key):
    t = res.per_skill[key]
    return t.casts, t.damage


def _kind(e):
    return "unknown" if e.kind == "unknown" or (e.kind == "extra_hits" and e.value.value is None) else None


# ---- specialties ---------------------------------------------------------------------------------------------
def test_every_specialty_is_decoded_and_unknowns_are_listed(gd):
    assert gd.specs_parsed
    total, unknown, unmodeled = 0, set(), set()
    for k, s in gd.skills.items():
        for i, sp in enumerate(s.specializations):
            total += 1
            assert sp.effects, f"{k} option {i + 1} has no effects"
            if any(_kind(e) for e in sp.effects):
                unknown.add((k, i))
            elif any(e.cond == "unmodeled" for e in sp.effects) and all(
                    e.cond == "unmodeled" or e.kind in ("no_dps", "mobile") for e in sp.effects):
                unmodeled.add((k, i))
    assert total == 112
    assert unknown == UNKNOWN and unmodeled == UNMODELED
    assert len(unknown) / total < 0.10


def test_option_counts_and_unlock_ranks(gd):
    core = [s for s in gd.skills.values() if s.specializations and s.kind != SkillKind.STIGMA]  # incl. Dimensional Control (now a proc)
    stig = [s for s in gd.skills.values() if s.specializations and s.kind == SkillKind.STIGMA]
    assert len(core) == 12 and len(stig) == 13
    assert all([sp.rank_required for sp in s.specializations] == [8, 8, 8, 12, 16] for s in core)
    assert all([sp.rank_required for sp in s.specializations] == [5, 10, 15, 20] for s in stig)


def test_spec_coverage_counts(gd):
    cov = spec_coverage(gd)
    assert cov["adds_status"] == 7 and cov["reset_skill"] == 2 and cov["force_crit"] == 2
    assert cov["mp_cost_mult"] == 5 and cov["cast_speed_pct"] == 3 and cov["duration_add_s"] == 3
    assert cov["cooldown_add_s"] == 3 and cov["cdr_all_s"] == 1


# ---- Four Elements counter and Dimensional Control proc ---------------------------------------------------
def test_four_elements_needs_four_summon_casts(gd):
    """12 casts of each of the four summons in 180 s (cd 15 s) = 48 Spirit skill uses = 12 sets of 4 elements =
    12 Elemental Fusion casts. Before the fix the status was re-applied by every 'element none' cast."""
    r = simulate(gd, build(), P(*SUMMONS4, "elemental-fusion"), BOSS)
    n = sum(r.per_skill[k].casts for k in SUMMONS4)
    assert n == 48
    assert r.per_skill["elemental-fusion"].casts == n // 4 == 12
    assert r.status_uptime["four_elements"] < 0.1
    assert "elemental-fusion" not in simulate(gd, build(), P("elemental-fusion"), S15).per_skill


def test_fusion_is_not_an_unconditional_charge_skill(gd):
    """No charge tiers in the base rule: one cast = 331.8% x 1000 + 1075 = 4393, x1.15 aura = 5052."""
    assert gd.rules["elemental-fusion"].charge_levels == ()
    assert gd.rules["jointstrike-destructive-attack"].charge_levels == ()
    r = simulate(gd, build(), P(*SUMMONS4, "elemental-fusion"), BOSS)
    c, d = tally(r, "elemental-fusion")
    assert d / c == pytest.approx((3.318 * 1000 + 1075) * AURA, rel=1e-6)


def test_dimensional_control_is_a_proc_per_summon_cast(gd):
    sk = gd.skills["dimensional-control"]
    assert sk.kind == SkillKind.PROC
    r = simulate(gd, build(), P(*SUMMONS4), BOSS)
    c, d = tally(r, "dimensional-control")
    assert c == sum(r.per_skill[k].casts for k in SUMMONS4) == 48
    assert d / c == pytest.approx((0.86 * 1000 + 157) * AURA, rel=1e-6)  # 86% ATK + 157 (rank 1)
    r2 = simulate(gd, build(), P("dimensional-control"), S15)  # never player-castable
    assert "dimensional-control" not in r2.per_skill


def test_spirit_and_hidden_skills_are_not_castable(gd):
    spirit = [k for k, s in gd.skills.items() if "spirit" in s.tags]  # skills cast BY a Spirit
    assert len(spirit) >= 37
    assert all(gd.skills[k].kind == SkillKind.PROC for k in spirit)
    for k in ("spirit-momentum", "extract-vitality", "magic-backflow", "elemental-replenishment"):
        assert gd.skills[k].kind == SkillKind.PROC
    r = simulate(gd, build(), P("water-spirit-ice-chain-16152200", "extract-vitality", "cold-shock"), S15)
    assert set(r.per_skill) <= {"cold-shock", "vacuum-explosion", "earth-tremor"}


def test_stagger_only_skills_are_gated(gd):
    for k in ("rapid-scattershot", "continuous-impact", "soul-decimation"):
        assert "needs_stagger" in gd.skills[k].tags
    r = simulate(gd, build(), P("rapid-scattershot", "continuous-impact", "soul-decimation", "cold-shock"), BOSS)
    assert not {"rapid-scattershot", "continuous-impact", "soul-decimation"} & set(r.per_skill)


# ---- stat-mod statuses and auras ---------------------------------------------------------------------------
def test_stat_mod_statuses(gd):
    mods = {k: {m.stat: m.value.value for m in s.stat_mods} for k, s in gd.statuses.items() if s.stat_mods}
    assert mods == {
        "spirit_strike_aura": {"dmg_boost_pct": 15.0}, "spirit_strike_extra": {"dmg_boost_pct": 7.5},
        "benediction_spec20": {"dmg_boost_pct": 25.0}, "spirits_benediction": {"dmg_boost_pct": 20.0},
        "spirit_momentum_buff": {"combat_speed_pct": 30.0}, "assault_terror_attack": {"attack_increase_pct": 20.0},
        "flame_blessing_crit": {"crit_chance_pct": 6.667}, "flame_blessing_critdmg": {"crit_dmg_pct": 10.0},
    }
    assert all(m.value.source for s in gd.statuses.values() for m in s.stat_mods)


def test_passive_aura_and_cold_shock_hand_value(gd):
    """Spirit Strike is always on (duration 0 passive): cold-shock = (51.5% x 1000 + 54) x 1.15 per cast."""
    r = simulate(gd, build(), P("cold-shock"), S15)
    assert r.status_uptime["spirit_strike_aura"] == pytest.approx(1.0)
    c, d = tally(r, "cold-shock")
    assert c == 5 and d / c == pytest.approx((515 + 54) * AURA, rel=1e-6)


def test_benediction_is_an_additive_damage_boost_window(gd):
    """+20% PvE Damage Boost for 10 s adds to the 15% aura: casts inside the window x(1.35), outside x1.15.
    t = 0 cast, then cold-shock at 1..5 s; window ends at 10 s => the first 3 cold-shock casts are inside."""
    b = build(stigmas=("enhance-spirits-benediction",))
    r = simulate(gd, b, P("enhance-spirits-benediction", "cold-shock"), S15)
    _, d = tally(r, "cold-shock")
    assert d == pytest.approx(3 * 569 * 1.35 + 2 * 569 * AURA, rel=1e-6)
    assert r.status_uptime["spirits_benediction"] == pytest.approx(10 / 15)


def test_corrode_specialty_amplifier(gd):
    """Specialty 1 (+15% damage taken from Spirit) on top of the base +10%: x1.25 / x1.10 on cold-shock hits."""
    b = build(stigmas=("jointstrike-corrode",), skill_ranks={"jointstrike-corrode": 5})
    pri = P("jointstrike-corrode", "cold-shock")
    a = simulate(gd, b, pri, S15)
    s = simulate(gd, replace(b, specs={"jointstrike-corrode": (0,)}), pri, S15)
    assert tally(s, "cold-shock")[1] / tally(a, "cold-shock")[1] == pytest.approx(1.25 / 1.1, rel=1e-3)
    assert s.status_uptime["corrode_spec_amp"] == pytest.approx(1.0)


def test_corrode_duration_specialty(gd):
    b = build(stigmas=("jointstrike-corrode",), skill_ranks={"jointstrike-corrode": 20})
    pri = P("jointstrike-corrode")
    sc = Scenario("t60", "60 s", 60, 1, True)
    base = simulate(gd, b, pri, sc).status_uptime["corrode_debuff"]
    longer = simulate(gd, replace(b, specs={"jointstrike-corrode": (3,)}), pri, sc).status_uptime["corrode_debuff"]
    # Corrode lasts 20 s, cd 45 s: casts at 0 s and 45 s => 20 + 15 s covered of 60; with +10 s: 30 + 15
    assert base == pytest.approx(35 / 60, abs=0.01) and longer == pytest.approx(45 / 60, abs=0.01)


def test_flame_blessing_is_a_proc_tick_not_a_multiplier(gd):
    """Cast hit (41% x 1000 + 234) x 1.15 plus 9 ticks (t = 1..9 s inside the 10 s buff) of 50% x 41% ATK x 1.15."""
    r = simulate(gd, build(stigmas=("flame-blessing",)), P("flame-blessing"), S15)
    _, d = tally(r, "flame-blessing")
    assert d == pytest.approx(((410 + 234) + 9 * 0.5 * 410) * AURA, rel=1e-6)
    assert r.status_uptime["flame_blessing_buff"] == pytest.approx(10 / 15)


def test_destructive_attack_specialties(gd):
    """Option 3 resets Corrode (and Curse) on each cast: more Corrode casts. Option 2 = every hit crits:
    boss crit factor 1 + 0.5 x 0.75 = 1.375 at 0% crit."""
    b = build(stigmas=("jointstrike-destructive-attack", "jointstrike-corrode"),
              skill_ranks={"jointstrike-destructive-attack": 20})
    pri = P("jointstrike-destructive-attack", "jointstrike-corrode", "jointstrike-curse")
    a = simulate(gd, b, pri, BOSS)
    rs = simulate(gd, replace(b, specs={"jointstrike-destructive-attack": (3,)}), pri, BOSS)
    assert tally(a, "jointstrike-corrode")[0] == 4 and tally(rs, "jointstrike-corrode")[0] == 6
    one = P("jointstrike-destructive-attack")
    base = tally(simulate(gd, b, one, S15), "jointstrike-destructive-attack")[1]
    crit = tally(simulate(gd, replace(b, specs={"jointstrike-destructive-attack": (2,)}), one, S15),
                 "jointstrike-destructive-attack")[1]
    assert crit / base == pytest.approx(1.375, rel=1e-6)


def test_remaining_unknown_dot_ticks_are_flagged(gd):
    """The client gives flat per-tick DoT values only (tick_ratio unknown): the simulator must say so."""
    for k in ("curse", "corrode_debuff", "cursed_cloud_dot", "magic_backflow_dot"):
        assert gd.statuses[k].tick_ratio_pct.confidence == "unknown"
    r = simulate(gd, build(stigmas=("jointstrike-corrode",)), P("jointstrike-curse", "jointstrike-corrode"), S15)
    assert any("tick damage" in w for w in r.warnings)


# ---- optimizer -----------------------------------------------------------------------------------------------
@pytest.mark.parametrize("style", ["boss", "aoe"])
def test_optimizer_picks_specialties_under_30s(gd, style):
    b = build(stats=Stats(crit_chance_pct=20), skill_points=200, stigma_points=30)
    t0 = time.time()
    fb = bo.optimize_full_build(gd, b, style)
    assert time.time() - t0 < 30
    assert fb.result.dps > 0
    assert fb.build.specs, "no specialty chosen"
    assert fb.spec_picks and all(p.dps_gain_pct > 0 for p in fb.spec_picks)
    if style == "boss":
        assert fb.result.per_skill["elemental-fusion"].casts <= 15  # was 93 per 180 s before the trigger fix
