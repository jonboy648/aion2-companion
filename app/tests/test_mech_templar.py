"""Templar structured mechanics: specialty decode coverage, stat-mod statuses, permanent Fury, Doom Shield's 3 s
Judgment window, hand-checked specialty maths, and optimize_full_build at level 45 (boss / aoe) picking specialties."""
import json
import time
from dataclasses import replace
from pathlib import Path

import pytest

from aion2c.data import loader
from aion2c.engine import build_optimizer as bo
from aion2c.engine.simulator import simulate
from aion2c.models import CharacterBuild, Priority, PriorityEntry, Scenario, Stats
from aion2c.specs import slots_at

KEY = "templar"
MECH = Path(r"D:\Aion2\research\classes\templar\mechanics.json")
SC1 = Scenario("t1", "one target 20 s", 20, 1, False)

# chain steps carry no specialties of their own (dump tokens exist only on the chain's first skill)
MIRRORS = {"decisive-strike", "desperate-strike", "punishing-strike", "threatening-blow"}
# options whose value is not in any source: the full, listed set of unknown effects
UNKNOWN = {
    ("vicious-strike", 4), ("shield-smite", 2), ("judgment", 1), ("judgment", 2), ("debilitating-smash", 4),
    ("executing-blade", 1), ("shield-rush", 2), ("battlefield-banner", 0), ("battlefield-banner", 2),
}
# decoded but not simulated: needs a target state / kill events / DoT numbers nobody publishes
NOT_SIMULATED = {
    ("annihilate", 2), ("executing-blade", 3), ("punishment", 1), ("doom-shield", 2), ("poach", 2),
}


@pytest.fixture(scope="module")
def gd():
    if not loader.default_path(KEY).is_file():
        pytest.skip("templar gamedata not built")
    return loader.load_gamedata(class_key=KEY)


def P(*keys):
    return Priority(tuple(PriorityEntry(k) for k in keys))


def cast_dmg(res, key, n=0):
    return [c for c in res.casts if c.skill_key == key][n].damage


def run(gd, keys, specs=None, level=45, **stats):
    b = CharacterBuild("t", "global", level, class_key=KEY, specs=specs or {}, stats=Stats(**stats),
                       skill_ranks={k: 20 for k in ("pummel", "judgment", "punishment", "annihilate")},
                       stigmas=("doom-shield",))
    return simulate(gd, b, P(*keys), SC1)


# ---- coverage ----------------------------------------------------------------------------------
def test_every_option_decoded_and_unknowns_listed(gd):
    total, unknown, parsed_kinds = 0, set(), {}
    for k, s in gd.skills.items():
        for i, sp in enumerate(s.specializations):
            total += 1
            assert sp.effects, f"{k} option {i} has no decoded effects"
            if k in MIRRORS:
                assert all(e.kind == "no_dps" for e in sp.effects)
                continue
            for e in sp.effects:
                parsed_kinds[e.kind] = parsed_kinds.get(e.kind, 0) + 1
                if e.kind == "unknown":
                    unknown.add((k, i))
    assert gd.specs_parsed
    assert total >= 130
    assert unknown == UNKNOWN
    own = total - sum(len(gd.skills[m].specializations) for m in MIRRORS if m in gd.skills)
    assert len(unknown) / own < 0.10


def test_decoded_values_carry_source_and_confidence(gd):
    for k, s in gd.skills.items():
        for sp in s.specializations:
            for e in sp.effects:
                assert e.value.confidence in ("confirmed", "estimated", "unknown")
                if e.value.value is not None:
                    assert e.value.source


def test_slot_ranks(gd):
    assert [n.value for n in gd.spec_slot_ranks] == [8, 12, 20]
    assert (slots_at(gd, 7), slots_at(gd, 8), slots_at(gd, 16), slots_at(gd, 20)) == (0, 1, 2, 3)


def test_not_simulated_options_are_flagged(gd):
    for k, i in NOT_SIMULATED:
        effs = gd.skills[k].specializations[i].effects
        assert any(e.cond == "unmodeled" or e.trigger == "kill" or e.value.value is None for e in effs), (k, i)


def test_flash_rampage_is_stagger_gated(gd):
    assert "needs_stagger" in gd.skills["flash-rampage"].tags


def test_mechanics_json_keys_resolve():
    m = json.loads(MECH.read_text(encoding="utf-8"))
    assert set(m["specialization_effects"]) >= {"judgment", "pummel", "annihilate", "punishment", "vicious-strike"}


# ---- statuses ----------------------------------------------------------------------------------
def test_stat_mod_statuses(gd):
    mods = {k: {m.stat: m.value.value for m in s.stat_mods} for k, s in gd.statuses.items() if s.stat_mods}
    assert mods["executor"] == {"dmg_boost_pct": 20.0}
    assert mods["fury_buff"] == {"dmg_boost_pct": 15.0}
    assert mods["insulting_roar_buff"] == {"attack_increase_pct": 15.0}
    assert mods["empyrean_spec_boost"] == {"dmg_boost_pct": 10.0}
    assert mods["noble_fury_x15"] == {"dmg_boost_pct": 7.5}
    assert len(mods) == 7  # + Assault Fury parser buff, Noble Roar x1.5; Banner weapon bucket is a multiplier
    for k in ("executor", "fury_buff", "insulting_roar_buff", "empyrean_spec_boost"):
        assert gd.statuses[k].dmg_mult.value == 1.0  # no double count with the stat mod


def test_fury_is_permanent_and_no_longer_applied_by_shield_of_protection(gd):
    f = gd.statuses["fury_buff"]
    assert f.permanent and f.duration_s.value == 0.0 and f.source_skill == "fury"
    assert "fury_buff" not in gd.rules["shield-of-protection"].applies


def test_punishment_dot_is_unknown_not_invented(gd):
    d = gd.statuses["punishment_dot"]
    assert d.duration_s.value is None and d.tick_ratio_pct.value is None


# ---- hand-checked mechanics --------------------------------------------------------------------
def test_fury_aura_adds_15_points_to_the_damage_bucket(gd):
    """Vicious Strike cast 1: damage ratio with/without the Fury stat mod = (1+(40+15)/100)/(1+40/100)."""
    no_fury = replace(gd, statuses={**gd.statuses, "fury_buff": replace(gd.statuses["fury_buff"], stat_mods=())})
    a = run(gd, ["vicious-strike"], dmg_boost_pct=40)
    b = run(no_fury, ["vicious-strike"], dmg_boost_pct=40)
    assert cast_dmg(a, "vicious-strike") / cast_dmg(b, "vicious-strike") == pytest.approx(1.55 / 1.40, rel=1e-9)
    assert a.status_uptime["fury_buff"] == pytest.approx(1.0)


def test_pummel_option5_doubles_punishing_strike(gd):
    """'Activates [Punishing Strike] 1 extra time' = one more full activation: x2 on the chain step (hits = 1)."""
    base = run(gd, ["pummel"])
    spec = run(gd, ["pummel"], {"pummel": (4,)})
    assert [c.skill_key for c in spec.casts[:2]] == ["pummel", "punishing-strike"]
    assert cast_dmg(spec, "punishing-strike") / cast_dmg(base, "punishing-strike") == pytest.approx(2.0, rel=1e-9)
    assert cast_dmg(spec, "pummel") == pytest.approx(cast_dmg(base, "pummel"))


def test_judgment_critical_hit_option_multiplies_by_crit_damage(gd):
    """Judgment must be opened by Doom Shield. 'Critical Hit on hit' = forced crit: x(1 + crit_dmg/100) at 0% crit."""
    base = run(gd, ["doom-shield", "judgment"], crit_chance_pct=0, crit_dmg_pct=50)
    spec = run(gd, ["doom-shield", "judgment"], {"judgment": (3,)}, crit_chance_pct=0, crit_dmg_pct=50)
    assert cast_dmg(spec, "judgment") / cast_dmg(base, "judgment") == pytest.approx(1.5, rel=1e-9)


def test_doom_shield_opens_judgment_for_three_seconds(gd):
    trig = [t for t in gd.triggers if t.source_skill == "doom-shield"]
    assert len(trig) == 1 and trig[0].window_s == 3.0 and trig[0].status_key == "judgment_ready"
    assert "judgment_ready" not in gd.rules["doom-shield"].applies
    res = run(gd, ["doom-shield"])
    assert res.status_uptime["judgment_ready"] == pytest.approx(3.0 / 20.0, rel=0.02)  # one 3 s window in 20 s


def test_noble_armor_fury_option_adds_status(gd):
    sp = gd.skills["noble-armor"].specializations[2].effects[0]
    assert sp.kind == "adds_status" and sp.status_key == "noble_fury_x15"
    assert gd.statuses["noble_fury_x15"].duration_s.value == 300.0


# ---- optimizer ---------------------------------------------------------------------------------
@pytest.mark.parametrize("style", ["boss", "aoe"])
def test_optimize_full_build_level45_picks_specialties(gd, style):
    ranks = {"judgment": 20, "pummel": 20, "punishment": 20, "annihilate": 16, "shield-smite": 16}
    build = CharacterBuild("t", "global", 45, stats=Stats(crit_chance_pct=30), class_key=KEY, skill_ranks=ranks)
    t0 = time.perf_counter()
    fb = bo.optimize_full_build(gd, build, style)
    assert time.perf_counter() - t0 < 30
    assert fb.result.dps > 0
    assert fb.build.specs, "no specialties chosen"
    assert fb.spec_picks and all(p.dps_gain_pct >= 0 for p in fb.spec_picks)
    for k, opts in fb.build.specs.items():
        assert k not in MIRRORS
        assert all(gd.skills[k].specializations[i].effects for i in opts)
