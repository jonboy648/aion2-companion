"""Cleric structured mechanics: every specialty option decoded (unknowns listed), the proc, buff stat mods and
status-gated specialty effects hand-checked on the shipped gamedata, and the full-build optimizer at level 45.

Hand numbers (Stats(attack=1000), boss_180 = 180 s, 1 target, rank 1 unless a rank is passed):
  Empyrean Lord's Grace proc = 42% ATK + 71 flat = 491, 1 s internal cooldown -> 180 procs in 180 s
  Earth's Retribution hit = 48.3% ATK + 50 flat = 533; with Prayer of Amplification (+20% Attack) = 629.6
  Bolt crit multiplier: 1 + 1.0 * 50% * boss crit factor 0.75 = 1.375 over a no-crit hit
"""
import json
import time
from dataclasses import replace
from pathlib import Path

import pytest

from aion2c.data import loader
from aion2c.engine import build_optimizer as bo
from aion2c.engine.simulator import simulate
from aion2c.models import SCENARIOS, CharacterBuild, Priority, PriorityEntry, SkillKind, Stats

KEY = "cleric"
MECH = Path(r"D:\Aion2\research\classes\cleric\mechanics.json")
BOSS = SCENARIOS[0]
CHAIN_CHILDREN = {"thunder-and-lightning", "discharge", "divine-punishment"}  # options live on the parent skills

# Options whose value no source gives. Multi-Hit has no definition/number in any source; the DoT interval and the
# Divine Aura options need the tick ATK ratio / attack interval, which are not published (only flat ticks are).
EXPECTED_UNKNOWN = {
    ("earths-retribution", 2), ("condemnation", 4), ("lightning-strike-scattershot", 3),  # Multi-Hit
    ("chain-of-torment", 4), ("debilitating-mark", 4), ("voice-of-doom", 3), ("root", 3),  # DoT interval / x2 DoT
    ("divine-aura", 1), ("divine-aura", 2),  # AoE target count / attack speed (tick unknown)
}


@pytest.fixture(scope="module")
def gd():
    if not loader.default_path(KEY).is_file():
        pytest.skip("cleric gamedata not built")
    return loader.load_gamedata(class_key=KEY)


def run(gd, keys, specs=None, ranks=None, stigmas=(), stats=None, sc=BOSS):
    b = CharacterBuild("t", "global", 45, stats=stats or Stats(attack=1000), stigmas=stigmas, class_key=KEY,
                       specs=specs or {}, skill_ranks=ranks or {})
    return simulate(gd, b, Priority(tuple(PriorityEntry(k) for k in keys)), sc)


def _unknown(sp):
    return any(e.kind == "unknown" or (e.value.value is None and e.kind not in
               ("no_dps", "adds_status", "reset_skill", "removes_cooldown", "force_crit")) for e in sp.effects)


# ---- decoding coverage ---------------------------------------------------------------------------
def test_shipped_data_has_parsed_specs(gd):
    assert gd.specs_parsed
    assert KEY == gd.class_key


def test_every_option_decoded_unknowns_listed(gd):
    withspec = {k: s for k, s in gd.skills.items() if s.specializations and k not in CHAIN_CHILDREN}
    assert len(withspec) >= 25
    total, unknown = 0, set()
    for k, s in withspec.items():
        assert len(s.specializations) in (4, 5), k
        for i, sp in enumerate(s.specializations):
            total += 1
            assert sp.effects, (k, i, sp.text)  # nothing left unparsed
            assert sp.rank_required is not None, (k, i)  # unlock rank decoded
            if _unknown(sp):
                unknown.add((k, i))
    assert total >= 100
    assert unknown == EXPECTED_UNKNOWN
    assert len(unknown) <= 10  # < 10% of the options


def test_unlock_ranks_core_and_stigma(gd):
    assert [sp.rank_required for sp in gd.skills["condemnation"].specializations] == [8, 8, 8, 12, 16]
    assert [sp.rank_required for sp in gd.skills["earth-punishment"].specializations] == [5, 10, 15, 20]


def test_chain_children_carry_no_duplicate_options(gd):
    """The client lists the parent's options on every chain skill; equipping them there would triple count."""
    for k in CHAIN_CHILDREN:
        for sp in gd.skills[k].specializations:
            assert all(e.kind == "no_dps" for e in sp.effects), k


def test_every_override_references_real_keys(gd):
    mech = json.loads(MECH.read_text(encoding="utf-8"))
    for sk, opts in mech["specialization_effects"].items():
        assert sk in gd.skills
        assert set(opts) <= {"0", "1", "2", "3", "4"}
        for effs in opts.values():
            for e in effs:
                assert e.get("source") and e.get("confidence") in ("confirmed", "estimated", "unknown")
                if e["kind"] not in ("unknown",):
                    assert e["value"] is not None or e["kind"] in ("adds_status", "reset_skill")


def test_stat_mod_statuses(gd):
    mods = {k: {m.stat: m.value.value for m in s.stat_mods} for k, s in gd.statuses.items() if s.stat_mods}
    assert mods["prayer_of_amplification"] == {"attack_increase_pct": 20.0}
    assert mods["light_of_protection"] == {"dmg_boost_pct": 18.0}
    assert mods["prayer_pve_boost"] == {"dmg_boost_pct": 20.0}
    assert mods["prayer_earths_grace"] == {"crit_dmg_pct": 5.25}
    assert mods["ep_attack_def"] == {"attack_increase_pct": 10.0}
    assert mods["vod_crit_resist"] == {"crit_chance_pct": pytest.approx(13.33)}
    assert len(mods) >= 8
    for k in ("prayer_of_amplification", "light_of_protection"):
        assert gd.statuses[k].dmg_mult.value == 1.0  # no double counting with the multiplier


def test_stagger_only_skill_gated(gd):
    sk = gd.skills["lightning-strike-scattershot"]
    assert "needs_stagger" in sk.tags
    r = run(gd, ["lightning-strike-scattershot", "earths-retribution"])
    assert "lightning-strike-scattershot" not in r.per_skill


def test_proc_skill_and_trigger(gd):
    elg = gd.skills["empyrean-lords-grace"]
    assert elg.kind == SkillKind.PROC
    assert any(t.proc_skill == "empyrean-lords-grace" and t.event == "cast" for t in gd.triggers)


# ---- hand-checked mechanics ------------------------------------------------------------------------
def test_hand_empyrean_lords_grace_proc(gd):
    """42% x 1000 + 71 = 491 per proc, one per second (1 s ICD) while something else is cast every second."""
    r = run(gd, ["earths-retribution"])
    elg = r.per_skill["empyrean-lords-grace"]
    assert elg.casts == 180
    assert elg.damage / elg.casts == pytest.approx(491.0)
    assert "empyrean-lords-grace" not in {c.skill_key for c in r.casts}  # a proc, never a player cast


def test_hand_prayer_is_attack_increase_stat(gd):
    """Earth's Retribution 48.3% x ATK + 50: 533 base, (1200 x 0.483 + 50) = 629.6 under Prayer's +20% Attack."""
    base = run(gd, ["earths-retribution"])
    buffed = run(gd, ["prayer-of-amplification", "earths-retribution"], stigmas=("prayer-of-amplification",),
                 ranks={"prayer-of-amplification": 16})  # 17.5 s is its rank-16 duration
    assert base.casts[0].damage == pytest.approx(533.0)
    er = next(c for c in buffed.casts if c.skill_key == "earths-retribution")
    assert er.damage == pytest.approx(1200 * 0.483 + 50)
    assert buffed.status_uptime["prayer_of_amplification"] == pytest.approx(17.5 / 60)


def test_hand_bolt_forced_crit_and_judgment_extra_activation(gd):
    st = Stats(attack=1000, crit_chance_pct=0, crit_dmg_pct=50)
    plain = run(gd, ["bolt"], ranks={"bolt": 16}, stats=st)
    crit = run(gd, ["bolt"], specs={"bolt": (4,)}, ranks={"bolt": 16}, stats=st)
    assert crit.casts[0].damage / plain.casts[0].damage == pytest.approx(1 + 0.5 * 0.75)
    # Judgment Thunder option 5: Divine Punishment activates one extra time -> exactly double per Divine Punishment cast
    a = run(gd, ["judgment-thunder"], ranks={"judgment-thunder": 16})
    b = run(gd, ["judgment-thunder"], specs={"judgment-thunder": (4,)}, ranks={"judgment-thunder": 16})
    pa, pb = a.per_skill["divine-punishment"], b.per_skill["divine-punishment"]
    assert pb.damage / pb.casts == pytest.approx(2 * pa.damage / pa.casts)


def test_hand_earth_punishment_window_and_condemnation_reset(gd):
    """Earth Punishment option 1 opens a 10 s forced-crit window every 30 s (cd) -> 1/3 uptime; with Condemnation's
    reset-on-crit every Condemnation cast in the window is free to repeat, so it is cast far more often."""
    st = Stats(attack=1000, crit_chance_pct=30)
    keys = ["earth-punishment", "chain-of-torment", "condemnation"]
    ranks = {"condemnation": 12, "earth-punishment": 5, "chain-of-torment": 1}
    kw = dict(ranks=ranks, stigmas=("earth-punishment",), stats=st)
    none = run(gd, keys, **kw)
    crit_reset_only = run(gd, keys, specs={"condemnation": (3,)}, **kw)
    both = run(gd, keys, specs={"earth-punishment": (0,), "condemnation": (3,)}, **kw)
    assert both.status_uptime["ep_forced_crit"] == pytest.approx(10 / 30)
    c = lambda r: r.per_skill["condemnation"].casts  # noqa: E731
    assert c(none) < c(crit_reset_only) < c(both)
    assert both.dps > crit_reset_only.dps > none.dps


# ---- optimizer -------------------------------------------------------------------------------------
LEVEL45_RANKS = {"condemnation": 12, "bolt": 16, "judgment-thunder": 16, "chain-of-torment": 12,
                 "debilitating-mark": 8, "earths-retribution": 12, "earth-punishment": 15,
                 "prayer-of-amplification": 15, "noble-aura": 15, "light-of-protection": 10,
                 "voice-of-doom": 10, "assault-mark": 10}


@pytest.mark.parametrize("style", ["boss", "aoe"])
def test_optimize_full_build_picks_specialties(gd, style):
    build = CharacterBuild("t", "global", 45, stats=Stats(crit_chance_pct=30), class_key=KEY, skill_ranks=LEVEL45_RANKS)
    t0 = time.perf_counter()
    fb = bo.optimize_full_build(gd, build, style)
    assert time.perf_counter() - t0 < 60
    assert fb.result.dps > 0
    assert fb.spec_picks, "no specialty chosen although ranks 8+ are set"
    assert all(p.dps_gain_pct is not None for p in fb.spec_picks)
    for k, opts in fb.build.specs.items():
        assert k not in CHAIN_CHILDREN
        assert all(gd.skills[k].specializations[i].rank_required <= LEVEL45_RANKS.get(k, 1) for i in opts)
    assert "lightning-strike-scattershot" not in fb.result.per_skill  # stagger-only: never spammed
    assert "empyrean-lords-grace" in fb.result.per_skill  # the passive proc is part of the damage
