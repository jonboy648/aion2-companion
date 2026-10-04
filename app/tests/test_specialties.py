"""Specialties: parser, slot gating, every effect kind in the simulator (hand-computed on mini_gd), the optimizer's
choice, serde back-compat. mini_gd: strike 100% / lock 1 s / cd 0; nuke 300% (aoe 4) / cd 4; scen10 = 10 s, 1 target."""
from dataclasses import replace

import pytest

from aion2c.data.loader import load_gamedata
from aion2c.engine.simulator import simulate
from aion2c.engine.specialties import choose_specs, spec_picks
from aion2c.models import (
    CharacterBuild, Num, Priority, PriorityEntry, SpecEffect, Specialization, Stats,
)
from aion2c.serde import from_dict, to_dict
from aion2c.specparse import finalize_gamedata, parse_spec_text, spec_coverage
from aion2c.specs import active_options, slots_at

C = lambda v: Num(v, "confirmed", "test")  # noqa: E731


def P(*keys):
    return Priority(tuple(PriorityEntry(k) for k in keys))


def with_specs(gd, key, *effect_groups, slot_ranks=None):
    """gd where skill `key` has one specialty option per effect group (all unlock at rank 1)."""
    sk = gd.skills[key]
    sps = tuple(Specialization(1, f"opt{i}", tuple(g)) for i, g in enumerate(effect_groups))
    g = replace(gd, skills={**gd.skills, key: replace(sk, specializations=sps)}, specs_parsed=True)
    if slot_ranks:
        g = replace(g, spec_slot_ranks=tuple(C(r) for r in slot_ranks))
    return g


def run(gd, specs, *keys, sc, **kw):
    b = CharacterBuild("t", "global", 45, specs=specs, **kw)
    return simulate(gd, b, P(*keys), sc)


# ---- slots -------------------------------------------------------------------------------------
def test_default_slots_and_option_gating(sorc_gd):
    assert [n.value for n in sorc_gd.spec_slot_ranks] == [8, 12, 20]
    assert all(n.confidence == "estimated" and n.source for n in sorc_gd.spec_slot_ranks)
    assert [slots_at(sorc_gd, r) for r in (1, 7, 8, 11, 12, 19, 20)] == [0, 0, 1, 1, 2, 2, 3]
    hf = sorc_gd.skills["hellfire"]
    assert [sp.rank_required for sp in hf.specializations] == [8, 8, 8, 12, 16]
    b = CharacterBuild("t", "global", 45, specs={"hellfire": (0, 3, 4, 9, 0)})
    assert active_options(sorc_gd, b, hf, 8) == ((0,), [
        "Hellfire: specialty option 4 needs rank 12 (rank 8)",
        "Hellfire: specialty option 5 needs rank 16 (rank 8)",
        "Hellfire: specialty option 10 does not exist"])
    ok, why = active_options(sorc_gd, b, hf, 12)  # 2 slots: option 1 and 4 apply, option 5 not unlocked
    assert ok == (0, 3) and len(why) == 2
    ok, why = active_options(sorc_gd, replace(b, specs={"hellfire": (0, 1, 2)}), hf, 12)
    assert ok == (0, 1) and "only 2 slot(s)" in why[0]


# ---- parser ------------------------------------------------------------------------------------
@pytest.mark.parametrize("text,kind,value", [
    ("-15s cooldown", "cooldown_add_s", -15.0),
    ("-20% cooldown", "cooldown_mult", 0.8),
    ("+30% Skill Speed", "cast_speed_pct", 30.0),
    ("Restores 120 MP", "resource_restore", 120.0),
    ("-1s all skill cooldowns on hit", "cdr_all_s", 1.0),
    ("-10s all skill cooldowns", "cdr_all_s", 10.0),
    ("Remove cooldown", "removes_cooldown", 1.0),
    ("Changes to mobile skill", "mobile", 0.0),
    ("Up to +20% damage when more targets hit", "dmg_mult", 1.2),
    ("+2 max targets hit", "aoe_targets_add", 2.0),
    ("-10% MP Cost", "mp_cost_mult", 0.9),
    ("Removes MP consumed", "mp_cost_mult", 0.0),
    ("+1 consecutive use", "charges", 1.0),
    ("Resets cooldown on landing a Critical Hit", "reset_skill", 1.0),
    ("+4% Stun Chance", "no_dps", 0.0),
    ("Multi-Hit on hit", "extra_hits", None),
    ("Enhanced Embers - Grants extra damage when landing an attack", "unknown", None),
])
def test_parse_text(sorc_gd, text, kind, value):
    names = {"hellfire": "hellfire", "blaze": "blaze"}
    effs, _ = parse_spec_text(text, "hellfire", "Hellfire", 0, names)
    assert effs[0].kind == kind and effs[0].value.value == value, effs
    assert kind == "unknown" or effs[0].value.source or kind == "no_dps"


def test_parse_targets_triggers_and_statuses():
    names = {"hellfire": "hellfire", "blaze": "blaze", "pyroclasm": "pyroclasm"}
    e, _ = parse_spec_text("-3s [Blaze] cooldown on hit", "hellfire", "Hellfire", 0, names)
    assert (e[0].kind, e[0].skill_key, e[0].value.value) == ("cdr_skill_s", "blaze", 3.0)
    e, _ = parse_spec_text("Reset [Blaze] cooldown on landing [Pyroclasm]", "hellfire", "Hellfire", 0, names)
    assert (e[0].kind, e[0].skill_key, e[0].on_skill) == ("reset_skill", "blaze", "pyroclasm")
    e, _ = parse_spec_text("Restores 100 MP on landing a Critical Hit", "hellfire", "Hellfire", 0, names)
    assert (e[0].kind, e[0].trigger) == ("resource_restore", "crit")
    e, st = parse_spec_text("Fire Damage over Time for 10s on hit", "hellfire", "Hellfire", 1, names)
    s = st[e[0].status_key]
    assert (e[0].kind, s.on, s.duration_s.value, s.tick_ratio_pct.value, s.elements) == (
        "adds_status", "target", 10.0, None, frozenset({"fire"}))  # tick damage is NOT in the text: unknown
    e, st = parse_spec_text("+20% Attack for 5s on hit", "hellfire", "Hellfire", 0, names)
    (m,) = st[e[0].status_key].stat_mods
    assert (m.stat, m.value.value, st[e[0].status_key].duration_s.value) == ("attack_increase_pct", 20.0, 5.0)


def test_sorcerer_hellfire_parses_from_rebuilt_data(sorc_gd):
    """The shipped sorcerer gamedata.json (rebuilt) carries structured Hellfire specialties."""
    gd = load_gamedata()
    assert gd.specs_parsed
    kinds = [[(e.kind, e.value.value) for e in sp.effects] for sp in gd.skills["hellfire"].specializations]
    assert kinds[0] == [("cast_speed_pct", 30.0)]
    assert kinds[1] == [("adds_status", 10.0)]
    assert kinds[2] == [("mobile", 0.0)]
    assert kinds[3] == [("ignore_block", 0.0), ("extra_hits", None)]
    assert kinds[4] == [("cooldown_add_s", -15.0)]
    assert gd.skills["hellfire"].specializations[4].effects[0].value.confidence == "confirmed"


def test_every_class_parses_and_nothing_is_silent():
    from aion2c.data.loader import available_classes
    for c in available_classes():
        gd = load_gamedata(class_key=c)
        cov = spec_coverage(gd)
        assert "unparsed" not in cov, c
        for s in gd.skills.values():
            for sp in s.specializations:
                assert sp.effects, (c, s.key, sp.text)  # every option has at least an "unknown" effect
                assert all(e.kind != "unknown" or e.note for e in sp.effects)


# ---- simulator: each effect kind, hand computed -----------------------------------------------
def test_baseline_nuke_strike(mini_gd, scen10):
    assert run(mini_gd, {}, "nuke", "strike", sc=scen10).total_damage == 16000  # nuke at 0,4,8 + 7 strikes


@pytest.mark.parametrize("effect,total", [
    (SpecEffect("cooldown_add_s", C(-2.0)), 20000),   # cd 2: nuke at 0,2,4,6,8 + 5 strikes
    (SpecEffect("cooldown_mult", C(0.5)), 20000),
    (SpecEffect("removes_cooldown", C(1.0)), 30000),  # cd 0: ten nukes
    (SpecEffect("dmg_mult", C(1.5)), 16000 + 0.5 * 9000),  # nuke damage x1.5 on 3 casts
    (SpecEffect("extra_hits", C(1.0)), 16000 + 9000),     # hits 1 + 1 extra = x2 on the nuke
    (SpecEffect("aoe_targets_add", C(3.0)), 16000),       # scen10 has one target: no gain
    (SpecEffect("mobile", C(0.0)), 16000),
    (SpecEffect("ignore_block", C(0.0)), 16000),
])
def test_effect_on_nuke(mini_gd, scen10, effect, total):
    gd = with_specs(mini_gd, "nuke", [effect])
    assert run(gd, {"nuke": (0,)}, "nuke", "strike", sc=scen10).total_damage == pytest.approx(total)


def test_cast_speed_pct_shortens_lock(mini_gd, scen10):
    gd = with_specs(mini_gd, "strike", [SpecEffect("cast_speed_pct", C(100.0))])
    assert run(gd, {"strike": (0,)}, "strike", sc=scen10).total_damage == 20000  # lock 0.5 s: 20 casts


def test_anim_add_and_mp_cost(mini_gd, scen10):
    gd = with_specs(mini_gd, "strike", [SpecEffect("anim_add_s", C(-0.5))])
    assert run(gd, {"strike": (0,)}, "strike", sc=scen10).total_damage == 20000
    base = replace(mini_gd.skills["strike"].ranks[0], mp_cost=C(100.0))
    gd = with_specs(mini_gd, "strike", [SpecEffect("mp_cost_mult", C(0.0))])
    gd = replace(gd, skills={**gd.skills, "strike": replace(gd.skills["strike"], ranks=(base,))})
    st = Stats(max_mp=300, mp_regen_per_s=0)
    assert run(gd, {}, "strike", sc=scen10, stats=st).total_damage == 3000  # 300 MP / 100
    assert run(gd, {"strike": (0,)}, "strike", sc=scen10, stats=st).total_damage == 10000


def test_resource_restore_keeps_a_costly_skill_going(mini_gd, scen10):
    base = replace(mini_gd.skills["strike"].ranks[0], mp_cost=C(100.0))
    gd = with_specs(mini_gd, "strike", [SpecEffect("resource_restore", C(100.0))])
    gd = replace(gd, skills={**gd.skills, "strike": replace(gd.skills["strike"], ranks=(base,))})
    st = Stats(max_mp=300, mp_regen_per_s=0)
    assert run(gd, {}, "strike", sc=scen10, stats=st).total_damage == 3000
    assert run(gd, {"strike": (0,)}, "strike", sc=scen10, stats=st).total_damage == 10000


def test_cdr_all_s_on_cast(mini_gd, scen10):
    gd = with_specs(mini_gd, "strike", [SpecEffect("cdr_all_s", C(1.0))])
    r = run(gd, {"strike": (0,)}, "nuke", "strike", sc=scen10)
    # nuke at 0,3,6,9: every strike takes 1 s off the nuke cooldown (hand-walked in the commit notes)
    assert [c.t_s for c in r.casts if c.skill_key == "nuke"] == [0.0, 3.0, 6.0, 9.0]
    assert r.total_damage == 18000


def test_cdr_skill_s_hits_only_its_target(mini_gd, scen10):
    on_nuke = with_specs(mini_gd, "strike", [SpecEffect("cdr_skill_s", C(1.0), skill_key="nuke")])
    assert run(on_nuke, {"strike": (0,)}, "nuke", "strike", sc=scen10).total_damage == 18000
    on_amp = with_specs(mini_gd, "strike", [SpecEffect("cdr_skill_s", C(1.0), skill_key="amp")])
    assert run(on_amp, {"strike": (0,)}, "nuke", "strike", sc=scen10).total_damage == 16000


def test_reset_skill_on_cast(mini_gd, scen10):
    gd = with_specs(mini_gd, "strike", [SpecEffect("reset_skill", C(1.0), skill_key="nuke")])
    r = run(gd, {"strike": (0,)}, "nuke", "strike", sc=scen10)
    assert [c.skill_key for c in r.casts] == ["nuke", "strike"] * 5 and r.total_damage == 20000


def test_adds_status_with_chance_accumulator(mini_gd, scen10):
    # strike applies amp_buff (x1.5 for 5 s) on every 2nd cast (chance 0.5)
    gd = with_specs(mini_gd, "strike", [SpecEffect("adds_status", C(5.0), chance=0.5, status_key="amp_buff")])
    r = run(gd, {"strike": (0,)}, "strike", sc=scen10)
    # casts at 0..9; buff applied by cast 2 (t=1, to 6.0) and cast 4 (t=3, to 8.0), cast 6 (t=5, to 10.0),
    # cast 8 (t=7, to 12.0), cast 10 (t=9): damage of cast k uses the buff active at its own time.
    # active: t=2..5 (from cast 2) -> casts at 2,3,4,5; cast 4 extends to 8 -> 6,7; cast 8 -> 8,9. So casts 0,1 plain.
    assert r.total_damage == 2 * 1000 + 8 * 1500


def test_unknown_and_unparsed_specialties_warn(mini_gd, scen10):
    gd = with_specs(mini_gd, "strike", [SpecEffect("unknown", note="no value in the text")],
                    [SpecEffect("extra_hits", Num(None, "unknown", "no source"))])
    for opt in (0, 1):
        r = run(gd, {"strike": (opt,)}, "strike", sc=scen10)
        assert r.total_damage == 10000 and r.confidence == "unknown"
        assert any(w.startswith("specialty not modelled: Strike option") for w in r.warnings)


def test_slots_limit_applies_in_sim(mini_gd, scen10):
    gd = with_specs(mini_gd, "nuke", [SpecEffect("cooldown_add_s", C(-2.0))], [SpecEffect("removes_cooldown", C(1.0))])
    r = run(gd, {"nuke": (0, 1)}, "nuke", "strike", sc=scen10)  # rank 1: one slot -> only option 0
    assert r.total_damage == 20000 and any("only 1 slot(s)" in w for w in r.warnings)
    gd2 = replace(gd, spec_slot_ranks=(C(1.0), C(1.0)))
    assert run(gd2, {"nuke": (0, 1)}, "nuke", "strike", sc=scen10).total_damage == 30000  # both apply


def test_conditional_dmg_mult(mini_gd, scen):
    nuke = mini_gd.skills["nuke"]  # aoe_targets 4
    more = SpecEffect("dmg_mult", C(1.4), cond="more_targets")
    less = SpecEffect("dmg_mult", C(1.4), cond="less_targets")
    gd = with_specs(mini_gd, "nuke", [more], [less])
    assert nuke.aoe_targets == 4
    for n, f_more, f_less in ((1, 0.0, 1.0), (4, 1.0, 0.0), (2, 1 / 3, 2 / 3)):
        sc = scen(1, n)
        base = run(gd, {}, "nuke", sc=sc).total_damage
        assert run(gd, {"nuke": (0,)}, "nuke", sc=sc).total_damage == pytest.approx(base * (1 + 0.4 * f_more))
        assert run(gd, {"nuke": (1,)}, "nuke", sc=sc).total_damage == pytest.approx(base * (1 + 0.4 * f_less))


def test_unmodeled_condition_is_listed_not_applied(mini_gd, scen10):
    gd = with_specs(mini_gd, "strike", [SpecEffect("dmg_mult", C(2.0), cond="unmodeled")])
    r = run(gd, {"strike": (0,)}, "strike", sc=scen10)
    assert r.total_damage == 10000 and any("condition not modelled" in w for w in r.warnings)


def test_force_crit_and_crit_chance_add(mini_gd, scen10):
    st = Stats(crit_chance_pct=0, crit_dmg_pct=100)
    gd = with_specs(mini_gd, "strike", [SpecEffect("force_crit", C(1.0))], [SpecEffect("crit_chance_add", C(50.0))])
    assert run(gd, {"strike": (0,)}, "strike", sc=scen10, stats=st).total_damage == 20000
    assert run(gd, {"strike": (1,)}, "strike", sc=scen10, stats=st).total_damage == 15000


def test_charges_consecutive_use(mini_gd, scen10):
    gd = with_specs(mini_gd, "nuke", [SpecEffect("charges", C(1.0))])
    r = run(gd, {"nuke": (0,)}, "nuke", sc=scen10)  # 2 uses back to back, then cd 4: t=0,1 | 5,6 | 10 -> 4 in 10 s
    assert [c.t_s for c in r.casts] == [0.0, 1.0, 5.0, 6.0]


def test_duration_add_extends_status(mini_gd, scen10):
    gd = with_specs(mini_gd, "amp", [SpecEffect("duration_add_s", C(5.0))])
    plain = run(gd, {}, "amp", "strike", sc=scen10)
    longer = run(gd, {"amp": (0,)}, "amp", "strike", sc=scen10)
    assert plain.status_uptime["amp_buff"] == pytest.approx(0.5)
    assert longer.status_uptime["amp_buff"] == pytest.approx(1.0)  # 10 s of the 10 s fight
    assert longer.total_damage == 1500 * 9 and plain.total_damage == 1500 * 4 + 1000 * 5


def test_cross_skill_cooldown_effect(mini_gd, scen10):
    gd = with_specs(mini_gd, "strike", [SpecEffect("cooldown_add_s", C(-2.0), skill_key="nuke")])
    assert run(gd, {"strike": (0,)}, "nuke", "strike", sc=scen10).total_damage == 20000


# ---- optimizer -----------------------------------------------------------------------------------
def test_choose_specs_greedy_respects_slots(mini_gd, scen10):
    gd = with_specs(mini_gd, "nuke", [SpecEffect("cooldown_add_s", C(-2.0))], [SpecEffect("removes_cooldown", C(1.0))],
                    [SpecEffect("mobile", C(0.0))], [SpecEffect("unknown", note="x")])
    b = CharacterBuild("t", "global", 45, stats=Stats(crit_chance_pct=0))
    pr = P("nuke", "strike")
    one = choose_specs(gd, b, pr, scen10)
    assert one == {"nuke": (1,)}  # one slot at rank 1: removes_cooldown (30000) beats -2s (20000); inert options skipped
    two = choose_specs(replace(gd, spec_slot_ranks=(C(1.0), C(1.0))), b, pr, scen10)
    assert two == {"nuke": (1,)}  # the second option adds nothing once the cooldown is gone: not equipped
    picks = spec_picks(gd, replace(b, specs=one), pr, scen10)
    assert [(p.skill_key, p.option, round(p.dps_gain_pct, 3), p.confidence) for p in picks] == [
        ("nuke", 1, round((30000 / 16000 - 1) * 100, 3), "confirmed")]


def test_full_build_reports_specialties(mini_gd):
    from aion2c.engine import build_optimizer as bo
    gd = with_specs(mini_gd, "nuke", [SpecEffect("cooldown_add_s", C(-2.0))])
    fb = bo.optimize_full_build(gd, CharacterBuild("t", "global", 45), "boss")
    assert fb.build.specs == {"nuke": (0,)}
    assert fb.spec_picks and fb.spec_picks[0].skill_key == "nuke" and fb.spec_picks[0].dps_gain_pct > 0


def test_real_sorcerer_full_build_picks_a_confirmed_cooldown_option():
    from aion2c.engine import build_optimizer as bo
    gd = load_gamedata()
    b = CharacterBuild("t", "global", 45, skill_points=60, stigma_points=75,
                       stats=Stats(attack=1800, crit_chance_pct=50, crit_dmg_pct=100))
    fb = bo.optimize_full_build(gd, b, "boss")
    assert fb.spec_picks, "no specialty chosen on a rank-10 sorcerer"
    assert all(p.dps_gain_pct > 0 for p in fb.spec_picks)
    for k, opts in fb.build.specs.items():
        from aion2c.engine.specialties import skill_rank
        assert len(opts) <= max(slots_at(gd, skill_rank(gd, fb.build, k)), 1)


# ---- serde ---------------------------------------------------------------------------------------
def test_specs_round_trip_and_old_saves():
    b = CharacterBuild("t", "global", 45, specs={"hellfire": (0, 4), "blaze": (2,)})
    assert from_dict(CharacterBuild, to_dict(b)).specs == {"hellfire": (0, 4), "blaze": (2,)}
    old = to_dict(b)
    old["specs"] = {"hellfire": 3, "blaze": [1, 1, 2], "bad": "x", "none": None, "flt": [2.0]}
    assert from_dict(CharacterBuild, old).specs == {"hellfire": (3,), "blaze": (1, 2), "flt": (2,)}
    old["specs"] = ["junk"]
    assert from_dict(CharacterBuild, old).specs == {}


def test_finalize_is_idempotent_and_overrides_win(sorc_gd):
    raw = replace(sorc_gd, specs_parsed=False)
    a = finalize_gamedata(raw)
    assert finalize_gamedata(a) is a
    ov = {"hellfire": {"4": [{"kind": "cooldown_add_s", "value": -30, "confidence": "confirmed", "source": "test"}]}}
    b = finalize_gamedata(raw, ov)
    e = b.skills["hellfire"].specializations[4].effects[0]
    assert (e.kind, e.value.value, e.value.source) == ("cooldown_add_s", -30.0, "test")
