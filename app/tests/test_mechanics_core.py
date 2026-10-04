"""Engine core mechanics: crit procs, status stat mods, auras, stagger, Smite, Daevanion map, stigma gating,
advisor monotonicity. Hand-computed on mini_gd (strike 100% / lock 1 s; nuke 300% aoe 4 cd 4; scen10)."""
from dataclasses import replace

import pytest

from aion2c.data.loader import available_classes, load_gamedata
from aion2c.engine import damage
from aion2c.engine.advisor import marginal_stats
from aion2c.engine.search import candidate_skills
from aion2c.engine.simulator import simulate
from aion2c.models import (
    STAT_MAP, STAT_MAP_NOTES, CharacterBuild, Num, Priority, PriorityEntry, SkillKind, SkillRule, StatMod, Stats,
    Status, StatusTrigger,
)

C = lambda v: Num(v, "confirmed", "test")  # noqa: E731


def P(*keys):
    return Priority(tuple(PriorityEntry(k) for k in keys))


def status(key, dur, mult=1.0, mods=(), **kw):
    return Status(key, key, kw.pop("on", "self"), C(dur), C(mult), stat_mods=tuple(StatMod(s, C(v)) for s, v in mods), **kw)


def add(gd, statuses=(), skills=(), rules=None, triggers=()):
    return replace(
        gd, statuses={**gd.statuses, **{s.key: s for s in statuses}}, skills={**gd.skills, **{s.key: s for s in skills}},
        rules={**gd.rules, **(rules or {})}, triggers=gd.triggers + tuple(triggers))


def clone(gd, src, key, **kw):
    return replace(gd.skills[src], key=key, name=key, **kw)


def run(gd, sc, *keys, stats=None, **kw):
    b = CharacterBuild("t", "global", 45, stats=stats or Stats(), **kw)
    return simulate(gd, b, P(*keys), sc)


def cd5(sk):
    return (replace(sk.ranks[0], cooldown_s=C(5.0)),)


# ---- crit-triggered procs ---------------------------------------------------------------------------------------
def gore_gd(mini_gd, rule_requires=(), cd=0.0):
    gore = clone(mini_gd, "strike", "gore", kind=SkillKind.PROC, atk_ratio_pct=C(200.0),
                 ranks=(replace(mini_gd.skills["strike"].ranks[0], cooldown_s=C(cd)),))
    return add(mini_gd, skills=[gore], rules={"gore": SkillRule("gore", requires=rule_requires)})


CRIT50 = Stats(crit_chance_pct=50, crit_dmg_pct=50)  # crit factor 1.25, one crit event every 2nd single-hit cast


def test_crit_window_makes_proc_skill_castable(mini_gd, scen10):
    gd = gore_gd(mini_gd, ("window",))
    gd = add(gd, statuses=[status("window", 3)], triggers=[
        StatusTrigger("window", "none", 1.0, "strike", event="crit", window_s=3.0)])
    r = run(gd, scen10, "gore", "strike", stats=CRIT50)
    # strike t0 (acc .5), strike t1 (acc 1.0 -> window to 4.0), gore t2, gore t3, strike t4, t5 (window to 8), gore 6, 7, ...
    assert [c.skill_key for c in r.casts] == ["strike", "strike", "gore", "gore"] * 2 + ["strike", "strike"]
    assert r.total_damage == pytest.approx(6 * 1000 * 1.25 + 4 * 2000 * 1.25)
    # without the trigger the PROC skill is never castable (old behaviour)
    plain = run(gore_gd(mini_gd, ("window",)), scen10, "gore", "strike", stats=CRIT50)
    assert "gore" not in {c.skill_key for c in plain.casts}


def test_crit_auto_proc_with_own_cooldown(mini_gd, scen10):
    gd = add(gore_gd(mini_gd, cd=5.0), triggers=[StatusTrigger("", "none", 1.0, "strike", event="crit", proc_skill="gore")])
    r = run(gd, scen10, "strike", stats=CRIT50)
    # crit events at t=1,3,5,7,9; gore cd 5 s: fires at 1 and 7 only
    assert r.per_skill["gore"].casts == 2
    assert r.total_damage == pytest.approx(10 * 1000 * 1.25 + 2 * 2000 * 1.25)
    assert "gore" not in {c.skill_key for c in r.casts}  # a proc is not a button press


def test_heart_gore_style_crit_reset_engine(mini_gd, scen10):
    trig = [StatusTrigger("", "none", 1.0, "strike", event="crit", proc_skill="gore"),
            StatusTrigger("", "none", 1.0, "strike", event="crit", reset_skill="gore")]
    gd = add(gore_gd(mini_gd, cd=5.0), triggers=trig)
    r = run(gd, scen10, "strike", stats=CRIT50)
    assert r.per_skill["gore"].casts == 5  # every crit event resets the 5 s cooldown, so it fires on all five
    assert r.total_damage == pytest.approx(10 * 1250 + 5 * 2500)
    # the crit chance feeds it: no crit, no proc
    assert "gore" not in run(gd, scen10, "strike", stats=Stats(crit_chance_pct=0)).per_skill


def test_crit_events_scale_with_hits_and_crit_chance(mini_gd, scen10):
    gd = add(gore_gd(mini_gd), triggers=[StatusTrigger("", "none", 1.0, "strike", event="crit", proc_skill="gore")])
    four = replace(gd, skills={**gd.skills, "strike": replace(gd.skills["strike"], hits=4)})
    assert run(four, scen10, "strike", stats=Stats(crit_chance_pct=25)).per_skill["gore"].casts == 10  # 4 x .25 = 1/cast
    assert run(gd, scen10, "strike", stats=Stats(crit_chance_pct=25)).per_skill["gore"].casts == 2  # 10 x .25 = 2.5


def test_status_event_trigger(mini_gd, scen10):
    gd = add(gore_gd(mini_gd), triggers=[
        StatusTrigger("", "none", 1.0, "amp", event="status", on_status="amp_buff", proc_skill="gore")])
    r = run(gd, scen10, "amp", "strike")
    # the proc lands after the buff is applied, so it is boosted: gore 2000 x1.5
    assert r.per_skill["gore"].casts == 1 and r.total_damage == pytest.approx(3000 + 4 * 1500 + 5 * 1000)


def test_cast_trigger_on_specific_skills(mini_gd, scen10):
    gd = add(gore_gd(mini_gd), triggers=[
        StatusTrigger("", "none", 1.0, "nuke", event="cast", on_skills=("nuke",), proc_skill="gore")])
    r = run(gd, scen10, "nuke", "strike")
    assert r.per_skill["gore"].casts == 3  # nuke casts at 0, 4, 8


# ---- status stat mods -------------------------------------------------------------------------------------------
def buff_gd(mini_gd, stat, value):
    """amp now applies `haste` (5 s, +value to `stat`) instead of amp_buff."""
    return add(mini_gd, statuses=[status("haste", 5, mods=[(stat, value)])],
               rules={"amp": replace(mini_gd.rules["amp"], applies=("haste",))})


@pytest.mark.parametrize("stat,value,stats,total", [
    ("combat_speed_pct", 100, Stats(), 13000),           # strikes at 1,1.5..4.5 (8) then 5..9 (5)
    ("attack_increase_pct", 100, Stats(), 4 * 2000 + 5 * 1000),
    ("dmg_boost_pct", 50, Stats(), 4 * 1500 + 5 * 1000),
    ("crit_chance_pct", 50, Stats(crit_chance_pct=0, crit_dmg_pct=100), 4 * 1500 + 5 * 1000),
    ("crit_dmg_pct", 50, Stats(crit_chance_pct=50, crit_dmg_pct=50), 4 * 1500 + 5 * 1250),
])
def test_status_stat_mods_apply_while_active(mini_gd, scen10, stat, value, stats, total):
    r = run(buff_gd(mini_gd, stat, value), scen10, "amp", "strike", stats=stats)
    assert r.total_damage == pytest.approx(total)
    assert r.status_uptime["haste"] == pytest.approx(0.5)


def test_cdr_status_mod_shortens_cooldowns(mini_gd, scen10):
    gd = buff_gd(mini_gd, "cdr_pct", 50)
    r = run(gd, scen10, "amp", "nuke", "strike")
    assert [c.t_s for c in r.casts if c.skill_key == "nuke"] == [1.0, 3.0, 5.0, 9.0]  # 4 s cooldown x 0.5 = 2 s while the buff lasts


def test_cooldown_scale_is_capped_at_60_percent():
    from aion2c.models import CDR_CAP_PCT, cooldown_scale
    assert CDR_CAP_PCT == 60.0
    assert cooldown_scale(0) == 1.0 and cooldown_scale(30) == pytest.approx(0.7)
    assert cooldown_scale(60) == pytest.approx(0.4) and cooldown_scale(100) == pytest.approx(0.4)
    assert cooldown_scale(-5) == 1.0  # a negative total never lengthens a cooldown


def test_cdr_above_the_cap_changes_nothing(mini_gd, scen10):
    """The cap is on the TOTAL: build CDR 100 and a status +100 give the same casts as exactly 60."""
    def nukes(stats, mod):
        r = run(buff_gd(mini_gd, "cdr_pct", mod), scen10, "amp", "nuke", "strike", stats=stats)
        return [c.t_s for c in r.casts if c.skill_key == "nuke"], r.total_damage
    capped = nukes(Stats(), 60)
    assert nukes(Stats(), 100) == capped
    assert nukes(Stats(cdr_pct=100), 0) == nukes(Stats(cdr_pct=60), 0)  # build CDR alone
    assert nukes(Stats(cdr_pct=40), 40) == nukes(Stats(cdr_pct=40), 20)  # build 40 + status 40 = 80, capped to 60
    assert nukes(Stats(), 20) != capped  # below the cap the extra CDR still counts


def test_stat_mod_read_confidence_counts(mini_gd, scen10):
    gd = add(mini_gd, statuses=[replace(status("haste", 5), stat_mods=(StatMod("cdr_pct", Num(None, "unknown", "?")),))],
             rules={"amp": replace(mini_gd.rules["amp"], applies=("haste",))})
    r = run(gd, scen10, "amp", "strike")
    assert r.confidence == "unknown" and any("haste cdr_pct" in w for w in r.warnings)


# ---- auras: duration 0 = permanent ------------------------------------------------------------------------------
def test_zero_duration_status_is_a_permanent_aura(mini_gd, scen):
    gd = add(mini_gd, statuses=[status("aura", 0.0, 2.0)], rules={"amp": replace(mini_gd.rules["amp"], applies=("aura",))})
    r = run(gd, scen(25), "amp", "strike")
    assert r.per_skill["amp"].casts == 1  # cast once, never re-cast while the aura is up
    assert r.total_damage == pytest.approx(24 * 2000)
    assert r.status_uptime["aura"] == pytest.approx(1.0)


def test_passive_aura_needs_no_cast(mini_gd, scen10):
    pas = clone(mini_gd, "amp", "pas", kind=SkillKind.PASSIVE)
    gd = add(mini_gd, statuses=[status("pas_aura", 0.0, 2.0, source_skill="pas")], skills=[pas])
    r = run(gd, scen10, "strike")
    assert r.total_damage == pytest.approx(20000) and r.status_uptime["pas_aura"] == pytest.approx(1.0)
    locked = replace(gd, skills={**gd.skills, "pas": replace(gd.skills["pas"], unlock_level=99)})
    assert run(locked, scen10, "strike").total_damage == 10000  # a passive you have not unlocked gives nothing


def test_uncast_zero_duration_flag_status_stays_inactive(mini_gd, scen10):
    """`staggered`-style condition flags have duration 0 and nothing applies them: still inactive."""
    gd = add(mini_gd, statuses=[status("flag", 0.0, 3.0, on="target")])
    assert run(gd, scen10, "strike").total_damage == 10000 and "flag" not in run(gd, scen10, "strike").status_uptime


# ---- stagger ----------------------------------------------------------------------------------------------------
def test_stagger_only_skill_deals_no_hp_damage(mini_gd, scen10):
    gd = add(mini_gd, skills=[replace(mini_gd.skills["strike"], tags=("stagger_only",)),
                              replace(mini_gd.skills["nuke"], key="half", name="half", hp_dmg_coeff=0.5)])
    assert run(gd, scen10, "strike").total_damage == 0
    assert run(gd, scen10, "half").total_damage == pytest.approx(0.5 * 3000 * 3)
    b = CharacterBuild("t", "global", 45)
    assert "strike" not in {e.skill_key for e in candidate_skills(gd, b)}


def test_needs_stagger_is_gated_on_a_staggered_status(mini_gd, scen10):
    scat = clone(mini_gd, "strike", "scat", tags=("needs_stagger",))
    stag = clone(mini_gd, "amp", "stagger_maker")
    gd = add(mini_gd, skills=[scat, stag], statuses=[status("staggered", 5, on="target")],
             rules={"stagger_maker": SkillRule("stagger_maker", applies=("staggered",))})
    assert run(gd, scen10, "scat").total_damage == 0  # no stagger window source cast
    assert run(gd, scen10, "stagger_maker", "scat").total_damage == 4000  # t=1..4 inside the 5 s window
    b = CharacterBuild("t", "global", 45)
    assert "scat" in {e.skill_key for e in candidate_skills(gd, b)}  # a stagger source exists
    lone = add(mini_gd, skills=[scat])
    assert "scat" not in {e.skill_key for e in candidate_skills(lone, b)}


def test_flame_scattershot_datamine_is_hp_damage_gated_on_stagger():
    """Datamine: stagger_gauge_damage is null for Flame Scattershot and its text lists ATK% damage, so it is
    real HP damage - but only usable on a Staggered target. Hellfire's 20-35 is the gauge it deals."""
    gd = load_gamedata()
    fs, hf = gd.skills["flame-scattershot"], gd.skills["hellfire"]
    assert fs.stagger_gauge is None and fs.atk_ratio_pct.value == 82.5 and "stagger_only" not in fs.tags
    assert "needs_stagger" in fs.tags and hf.stagger_gauge == 35.0
    b = CharacterBuild("t", "global", 45)
    assert "flame-scattershot" not in {e.skill_key for e in candidate_skills(gd, b)}


# ---- Smite ------------------------------------------------------------------------------------------------------
def test_smite_matches_community_marginals(mini_gd):
    """+1% smite on a 25% smite line: 0.80% off-boss (S2), ~0.60% on a boss (S1: x0.7 boss resist)."""
    s = mini_gd.skills["strike"]

    def gain(boss):
        a = damage.hit_damage(s, 1, Stats(smite_pct=25), 1.0, boss)
        b = damage.hit_damage(s, 1, Stats(smite_pct=26), 1.0, boss)
        return (b / a - 1) * 100

    assert damage.SMITE_BONUS == 1.0
    assert gain(False) == pytest.approx(0.8, abs=0.005)
    assert gain(True) == pytest.approx(0.5957, abs=0.005) and 0.55 <= gain(True) <= 0.65


# ---- Daevanion map ----------------------------------------------------------------------------------------------
def test_stat_map_has_orange_node_stats_with_labels():
    for stat, field in (("Combat Speed", "combat_speed_pct"), ("Cooldown Reduction", "cdr_pct"),
                        ("Critical Damage Boost", "crit_dmg_pct"), ("Damage Boost", "dmg_boost_pct")):
        assert STAT_MAP[stat][0] == field and STAT_MAP[stat][1] == 1.0 and STAT_MAP[stat][2] == "estimated"
    assert set(STAT_MAP) == set(STAT_MAP_NOTES) and all(STAT_MAP_NOTES.values())


def test_every_orange_node_stat_in_every_class_is_simulated():
    seen = set()
    for c in available_classes():
        for b in load_gamedata(class_key=c).daevanion.values():
            for n in b.nodes.values():
                if n.rarity == "Unique":
                    for e in n.effects:
                        if e.unit == "%" and e.stat in ("Combat Speed", "Cooldown Reduction", "Critical Damage Boost",
                                                        "Damage Boost"):
                            seen.add(e.stat)
                            assert STAT_MAP[e.stat][0]
    assert seen == {"Combat Speed", "Cooldown Reduction", "Critical Damage Boost", "Damage Boost"}


# ---- stigma gating, every class ---------------------------------------------------------------------------------
@pytest.mark.parametrize("cls", available_classes())
def test_no_stigma_or_hidden_twin_castable_without_the_stigma(cls):
    gd = load_gamedata(class_key=cls)
    stig_names = {s.name for s in gd.skills.values() if s.kind == SkillKind.STIGMA}
    banned = {k for k, s in gd.skills.items() if s.kind == SkillKind.STIGMA or s.name in stig_names}
    b = CharacterBuild("t", "global", 45, class_key=cls)
    assert not banned & {e.skill_key for e in candidate_skills(gd, b)}
    every = Priority(tuple(PriorityEntry(k) for k in gd.skills))
    sc = next(s for s in __import__("aion2c.models", fromlist=["SCENARIOS"]).SCENARIOS if s.key == "boss_180")
    cast = {c.skill_key for c in simulate(gd, b, every, sc).casts}
    assert not banned & cast, sorted(banned & cast)
    # equipping every stigma makes the real stigmas castable, the hidden twins stay dead
    full = replace(b, stigmas=tuple(k for k, s in gd.skills.items() if s.kind == SkillKind.STIGMA))
    twins = {k for k in banned if gd.skills[k].kind != SkillKind.STIGMA}
    assert not twins & {c.skill_key for c in simulate(gd, full, every, sc).casts}


# ---- advisor ----------------------------------------------------------------------------------------------------
def test_marginal_gains_are_never_negative_from_a_stale_priority(sorc_gd, scen):
    b = CharacterBuild("t", "global", 45, stigmas=("element-enhancement",),
                       stats=Stats(attack=1800, crit_chance_pct=50, crit_dmg_pct=100, smite_pct=20))
    pr = P("element-enhancement", "hellfire", "blaze", "firestorm", "flame-arrow")
    gains = {g.stat: g for g in marginal_stats(sorc_gd, b, pr, scen(60))}
    assert "cdr_pct" in gains
    assert all(g.dps_gain_pct >= 0 for g in gains.values()), {k: v.dps_gain_pct for k, v in gains.items()}
    assert gains["combat_speed_pct"].dps_gain_pct > 0
    # speed and CDR are measured over a +5 step but reported per 1 (delta), smoothing rotation-timing noise
    assert gains["combat_speed_pct"].delta == 1 and gains["cdr_pct"].delta == 1
    naive = simulate(sorc_gd, b, pr, scen(60)).dps
    plus = simulate(sorc_gd, replace(b, stats=replace(b.stats, combat_speed_pct=1)), pr, scen(60)).dps
    assert plus / naive - 1 < 0.05  # sanity: the per-1% number is a small percentage, not a +5% step


@pytest.mark.parametrize("cls", ["gladiator", "ranger", "cleric", "chanter", "templar", "spiritmaster"])
def test_no_class_reports_a_negative_stat_gain(cls):
    """A fixed first-ready priority makes +1% combat speed read -0.7..-4.6% on these classes (stale rotation)."""
    from aion2c.engine.search import optimize
    from aion2c.models import SCENARIOS, SearchBudget, SimConfig
    gd = load_gamedata(class_key=cls)
    sc = SCENARIOS[0]
    b = CharacterBuild("t", "global", 45, class_key=cls,
                       stigmas=tuple(k for k, s in gd.skills.items() if s.kind == SkillKind.STIGMA)[:4],
                       stats=Stats(attack=1800, crit_chance_pct=70, crit_dmg_pct=100, smite_pct=25, max_mp=3000,
                                   mp_regen_per_s=30))
    pr = optimize(gd, b, sc, SimConfig(), SearchBudget(max_candidates=60), 1).options[0].priority
    gains = marginal_stats(gd, b, pr, sc)
    assert all(g.dps_gain_pct >= 0 for g in gains), [(g.stat, g.dps_gain_pct) for g in gains if g.dps_gain_pct < 0]


# ---- per-class data schema: mechanics.json additions ---------------------------------------------------------------
def _fake_class_tree(tmp_path, mutate):
    import json
    import shutil

    from aion2c.data import build_gamedata as bg

    if not (bg.REPO / "research" / "sorcerer_skills.json").is_file() or not (bg.REPO / "assets" / "icons").is_dir():
        pytest.skip("research/ or assets/icons not present")
    res, icons = tmp_path / "research", tmp_path / "icons"
    cdir = res / "classes" / "templar"
    cdir.mkdir(parents=True)
    shutil.copy(bg.REPO / "research" / "sorcerer_skills.json", cdir / "skills.json")
    shutil.copy(bg.REPO / "research" / "daevanion_sorcerer.json", cdir / "daevanion.json")
    shutil.copy(bg.REPO / "research" / "crafting.json", res / "crafting.json")
    for n in ("chains", "community_rotations", "roadmap"):
        shutil.copy(bg.SRC_DIR / f"{n}.json", cdir / f"{n}.json")
    mech = json.loads((bg.SRC_DIR / "mechanics.json").read_text(encoding="utf-8"))
    mutate(mech)
    (cdir / "mechanics.json").write_text(json.dumps(mech), encoding="utf-8")
    shutil.copytree(bg.REPO / "assets" / "icons" / "sorcerer", icons / "templar")
    shutil.copy(bg.REPO / "assets" / "icons" / "index.json", icons / "templar" / "index.json")
    return bg, res, icons


def test_mechanics_json_carries_specialty_overrides_triggers_and_stat_effects(tmp_path):
    def mutate(m):
        m["spec_slot_ranks"] = [5, 10, 15]
        m["specialization_effects"] = {"hellfire": {
            "1": [{"kind": "adds_status", "status_key": "fire_wall_dot", "value": 10, "confidence": "confirmed",
                   "source": "datamine token se:1506002711:effect_value02:time"}],
            "2": []}}  # an explicit empty list = "no effect", not "unknown"
        m["statuses"]["haste"] = {**m["statuses"]["fire_mark"], "key": "haste", "name": "Haste"}
        m["stat_effects"] = [
            {"status": "haste", "stat": "Combat Speed", "value": 7, "unit": "%", "applies_to": "all",
             "confidence": "confirmed", "source": "token"},
            {"status": "haste", "stat": "Critical Hit", "value": 300, "unit": "flat", "applies_to": "all",
             "confidence": "confirmed", "source": "token"},
            {"status": "haste", "stat": "Skill damage", "value": 35, "unit": "%", "applies_to": ["hellfire"],
             "confidence": "confirmed", "source": "text"}]
        m["triggers"].append({"status_key": "", "on_element": "none", "chance": 1.0, "source_skill": "flame-arrow",
                              "confidence": "estimated", "event": "crit", "proc_skill": "magic-energy-blast"})

    bg, res, icons = _fake_class_tree(tmp_path, mutate)
    gd = bg.build(res, icons, tmp_path / "gd.json", built_at="2026-10-03T00:00:00+00:00", class_key="templar",
                  icons_dest=tmp_path / "dest")
    assert [n.value for n in gd.spec_slot_ranks] == [5.0, 10.0, 15.0]
    hf = gd.skills["hellfire"].specializations
    assert [(e.kind, e.status_key, e.value.source[:10]) for e in hf[1].effects] == [("adds_status", "fire_wall_dot", "datamine t")]
    assert [e.kind for e in hf[2].effects] == ["no_dps"] and hf[4].effects[0].kind == "cooldown_add_s"  # others still parsed from text
    mods = {m.stat: m.value for m in gd.statuses["haste"].stat_mods}
    assert mods["combat_speed_pct"].value == 7 and mods["crit_chance_pct"].value == pytest.approx(20.0)
    assert mods["crit_chance_pct"].confidence == "estimated"  # rating -> % conversion is an estimate
    assert len(mods) == 2  # the hellfire-only "Skill damage" entry is skipped, not applied to everything
    tr = gd.triggers[-1]
    assert (tr.event, tr.proc_skill, tr.status_key) == ("crit", "magic-energy-blast", "")
    skipped = bg.stat_effects_to_mods({"stat_effects": [
        {"status": "x", "stat": "Skill damage", "value": 35, "unit": "%", "applies_to": ["hellfire"]}]})[1]
    assert skipped and "skill-specific" in skipped[0]


def test_build_rejects_bad_references_in_new_fields(tmp_path):
    def mutate(m):
        m["triggers"].append({"status_key": "", "on_element": "none", "chance": 1.0, "source_skill": "flame-arrow",
                              "event": "crit", "proc_skill": "no-such-skill"})

    bg, res, icons = _fake_class_tree(tmp_path, mutate)
    with pytest.raises(ValueError, match="unknown keys"):
        bg.build(res, icons, tmp_path / "gd.json", built_at="2026-10-03T00:00:00+00:00", class_key="templar",
                 icons_dest=tmp_path / "dest")

    def mutate2(m):
        m["specialization_effects"] = {"hellfire": {"0": [{"kind": "reset_skill", "skill_key": "nope", "value": 1}]}}

    bg, res, icons = _fake_class_tree(tmp_path / "b", mutate2)
    with pytest.raises(ValueError, match="specialty effect"):
        bg.build(res, icons, tmp_path / "gd2.json", built_at="2026-10-03T00:00:00+00:00", class_key="templar",
                 icons_dest=tmp_path / "dest2")
