"""Chanter structured mechanics (research/classes/chanter/mechanics.json): specialties decoded, Dark Crush window,
stat-mod buffs, Wind's Promise crit proc, chain-adding specialties, optimizer picks specialties.

Hand-checked values come from the datamine tokens cited in the data `source` strings."""
import time
from dataclasses import replace

import pytest

from aion2c.data import loader
from aion2c.engine import build_optimizer as bo
from aion2c.engine.simulator import simulate
from aion2c.models import SCENARIOS, CharacterBuild, Priority, PriorityEntry, SkillKind, Stats
from aion2c.specparse import spec_coverage

BOSS = next(s for s in SCENARIOS if s.key == "boss_180")
RANKS = {"dark-crush": 16}
# options whose value is in no source: they carry kind "unknown" (or Multi-Hit with value None) and warn when chosen
UNKNOWN_TEXT = {
    ("impactful-crush", 0), ("rushing-smash", 1), ("dark-crush", 1), ("fracturing-blow", 1),
}
MULTI_HIT_UNVALUED = {
    ("onslaught", 2), ("incandescent-blow", 4), ("wave-blow", 0), ("rushing-smash", 4), ("heat-wave-blow", 3),
    ("tremor-crush", 2), ("gust-rampage", 3),
}


@pytest.fixture(scope="module")
def gd():
    return loader.load_gamedata(class_key="chanter")


def P(*keys):
    return Priority(tuple(PriorityEntry(k) for k in keys))


def build(gd, **kw):
    kw.setdefault("stats", Stats(crit_chance_pct=0))
    return CharacterBuild("t", "global", 45, class_key="chanter", **kw)


def test_every_specialty_is_decoded(gd):
    assert gd.specs_parsed
    total = unknown = unvalued = 0
    for k, s in gd.skills.items():
        for i, sp in enumerate(s.specializations):
            total += 1
            assert sp.effects, f"{k} option {i + 1} has no effects"
            if any(e.kind == "unknown" for e in sp.effects):
                unknown += 1
                assert (k, i) in UNKNOWN_TEXT, f"unexpected unknown specialty {k} {i + 1}: {sp.text}"
            elif any(e.kind == "extra_hits" and e.value.value is None for e in sp.effects):
                unvalued += 1
                assert (k, i) in MULTI_HIT_UNVALUED, f"unexpected valueless Multi-Hit {k} {i + 1}: {sp.text}"
    assert total == 112
    assert unknown == len(UNKNOWN_TEXT) and unvalued == len(MULTI_HIT_UNVALUED)
    assert (unknown + unvalued) / total < 0.12


def test_active_and_stigma_skills_have_all_options(gd):
    for k, s in gd.skills.items():
        if s.kind == SkillKind.STIGMA:
            assert len(s.specializations) == 4, k
        elif s.kind in (SkillKind.ACTIVE, SkillKind.PROC) and s.specializations:
            assert len(s.specializations) == 5, k
            assert [sp.rank_required for sp in s.specializations][-1] == 16, k  # unlock ranks 8/8/8/12/16


def test_guaranteed_crit_options_are_force_crit(gd):
    # KO text "적중 시 확정 치명타" = guaranteed Critical Hit; the English "Critical Hit on hit" hid that
    for k, i in (("dark-crush", 2), ("fracturing-blow", 2), ("obliterate", 2), ("spinning-strike", 4)):
        assert any(e.kind == "force_crit" for e in gd.skills[k].specializations[i].effects), (k, i)


def test_stat_mod_statuses(gd):
    mods = {k: {m.stat: m.value.value for m in s.stat_mods} for k, s in gd.statuses.items() if s.stat_mods}
    assert mods["power_of_the_storm"] == {"combat_speed_pct": 20.0, "cdr_pct": 20.0}
    assert mods["undefeated_mantra"] == {"dmg_boost_pct": 18.0}
    assert mods["spinning_strike_crit"] == {"crit_dmg_pct": 30.0}
    assert mods["winds_promise_crit"] == {"crit_dmg_pct": 12.0}
    assert mods["inspiring_spell_crit"]["crit_chance_pct"] == pytest.approx(190 * 80 / 1200, abs=1e-3)
    assert len(mods) >= 11
    # these used to be multipliers / zero-uptime placeholders
    assert gd.statuses["undefeated_mantra"].dmg_mult.value == 1.0


def test_dark_crush_only_inside_opener_window(gd):
    b = build(gd, skill_ranks=RANKS, stigmas=("marchutans-wrath",))
    r = simulate(gd, b, P("impactful-crush", "marchutans-wrath", "spinning-strike", "dark-crush", "onslaught"), BOSS)
    t_open = {"impactful-crush": 2.0, "spinning-strike": 2.0, "marchutans-wrath": 3.0}
    dark = [c.t_s for c in r.casts if c.skill_key == "dark-crush"]
    assert dark
    for t in dark:
        assert any(0 <= t - c.t_s <= t_open[c.skill_key] + 1e-6 for c in r.casts if c.skill_key in t_open), t
    # without any opener it is never cast (before: ungated, a cast every 5 s)
    r2 = simulate(gd, b, P("dark-crush", "onslaught"), BOSS)
    assert r2.per_skill.get("dark-crush") is None


def test_dark_crush_cooldown_removed_at_rank_16(gd):
    """Hand check: Impactful Crush (cd 15) opens a 2 s window; Dark Crush cd 5 s -> one cast per window.
    Spec option 5 (rank 16, cooldown removed) cannot add casts beyond one lock (1 s) per cast in that window."""
    b = build(gd, skill_ranks=RANKS)
    base = simulate(gd, b, P("impactful-crush", "dark-crush", "onslaught"), BOSS)
    spec = simulate(gd, replace(b, specs={"dark-crush": (4,)}), P("impactful-crush", "dark-crush", "onslaught"), BOSS)
    n0, n1 = base.per_skill["dark-crush"].casts, spec.per_skill["dark-crush"].casts
    assert n0 >= 11 and n1 >= n0  # one window per Impactful Crush cast (12 casts in 180 s)
    assert n1 <= 2 * base.per_skill["impactful-crush"].casts


def test_piercing_strike_chain_proc(gd):
    b = build(gd, skill_ranks=RANKS, specs={"dark-crush": (3,)})
    pri = P("impactful-crush", "dark-crush", "onslaught")
    r = simulate(gd, b, pri, BOSS)
    # option 4 (Adds [Piercing Strike]): one free proc per Dark Crush cast (Piercing Strike has no cooldown)
    assert r.per_skill["piercing-strike"].casts == r.per_skill["dark-crush"].casts
    none = simulate(gd, replace(b, specs={}), pri, BOSS)
    assert "piercing-strike" not in none.per_skill
    assert r.total_damage > none.total_damage


def test_power_of_the_storm_speeds_casts(gd):
    """Hand check: cast at t=0 (lock 1 s, buff not up yet), then +20% Combat Speed for 17.5 s: Onslaught lock
    1/1.2 = 0.8333 s; after expiry the lock is 1 s again."""
    b = build(gd, skill_ranks={"power-of-the-storm": 16}, stigmas=("power-of-the-storm",))
    r = simulate(gd, b, P("power-of-the-storm", "onslaught"), BOSS)
    ts = [c.t_s for c in r.casts if c.t_s < 120]
    assert ts[0] == 0.0 and ts[1] == pytest.approx(1.0, abs=1e-3)
    gaps = [round(b2 - a, 3) for a, b2 in zip(ts[1:], ts[2:]) if a > 1.0 and b2 < 17.0]
    assert gaps and all(g == pytest.approx(1 / 1.2, abs=2e-3) for g in gaps)
    assert r.status_uptime["power_of_the_storm"] > 0.08  # 17.5 s every 120 s


def test_undefeated_mantra_adds_damage_boost(gd):
    """+18% PvE Damage Boost (rank 16) with 0 base boost: the whole fight except the one cast lock -> x1.18."""
    b = build(gd, stigmas=("undefeated-mantra",), skill_ranks={"undefeated-mantra": 16})
    base = simulate(gd, b, P("onslaught"), BOSS)
    buffed = simulate(gd, b, P("undefeated-mantra", "onslaught"), BOSS)
    assert buffed.per_skill["undefeated-mantra"].casts == 1  # a toggle is cast once
    assert buffed.total_damage / base.total_damage == pytest.approx(1.18 * (1 - 1.0 / 180), rel=0.02)


def test_winds_promise_crit_proc(gd):
    b = build(gd, stats=Stats(crit_chance_pct=100))
    r = simulate(gd, b, P("onslaught"), BOSS)
    n = r.per_skill["winds-promise"].casts
    # crit capped at 80%; Onslaught (2 hits) -> 1.6 crit events per chain cast x 50% chance; 1 s internal cooldown
    assert 0 < n <= 180
    # Inspiring Spell (+190 rating = 12.7% crit) alone still feeds it, but far less than the 80% cap
    off = simulate(gd, build(gd, stats=Stats(crit_chance_pct=0)), P("onslaught"), BOSS)
    assert 0 < off.per_skill["winds-promise"].casts < n
    lvl = simulate(gd, replace(build(gd, stats=Stats(crit_chance_pct=0)), level=20), P("onslaught"), BOSS)
    assert "winds-promise" not in lvl.per_skill  # locked below level 25


def test_force_crit_option_ratio(gd):
    """Dark Crush option 3 (guaranteed crit). Stats: 0% crit + Inspiring Spell 190 rating (+12.667%), crit damage
    50 + Wind's Promise 12 = 62%, boss crit factor 0.75: per-cast ratio (1 + .62*.75)/(1 + .12667*.62*.75)."""
    b = build(gd, skill_ranks={**RANKS, "winds-promise": 10})  # the 12 crit damage below is its rank-10 value
    pri = P("impactful-crush", "dark-crush", "onslaught")
    a = simulate(gd, b, pri, BOSS).per_skill["dark-crush"]
    f = simulate(gd, replace(b, specs={"dark-crush": (2,)}), pri, BOSS).per_skill["dark-crush"]
    p = 190 * 80 / 1200 / 100
    want = (1 + 0.62 * 0.75) / (1 + p * 0.62 * 0.75)
    assert (f.damage / f.casts) / (a.damage / a.casts) == pytest.approx(want, rel=0.01)


def test_spec_coverage_counts(gd):
    cov = spec_coverage(gd)
    assert cov.get("unknown", 0) == len(UNKNOWN_TEXT)
    assert cov["force_crit"] >= 4 and cov["adds_status"] >= 11


@pytest.mark.parametrize("style", ["boss", "aoe"])
def test_optimizer_picks_specialties_under_30s(gd, style):
    b = build(gd, stats=Stats(crit_chance_pct=20), skill_points=200, stigma_points=30)
    t0 = time.time()
    fb = bo.optimize_full_build(gd, b, style)
    assert time.time() - t0 < 60
    assert fb.result.dps > 0
    assert fb.build.specs, "no specialty chosen"
    assert fb.spec_picks and all(p.dps_gain_pct > 0 for p in fb.spec_picks)
