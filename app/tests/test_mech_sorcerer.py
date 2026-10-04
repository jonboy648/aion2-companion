"""Sorcerer structured mechanics: specialty decoding, statuses, procs, hand-checked values, optimizer smoke.
Data: aion2c/data/src/mechanics.json + chains.json -> aion2c/data/classes/sorcerer/gamedata.json."""
import json
import time
from dataclasses import replace
from pathlib import Path

import pytest

from aion2c.data import loader
from aion2c.engine import build_optimizer as bo
from aion2c.engine.simulator import simulate
from aion2c.models import SCENARIOS, CharacterBuild, Priority, PriorityEntry, SkillKind, Stats

RESEARCH = Path(r"D:\Aion2\research\sorcerer_skills.json")
BOSS = SCENARIOS[0]

# Options whose value is in no source: kept as `unknown` / extra_hits None and warned about when chosen.
EXPECTED_UNKNOWN = {
    ("flame-scattershot", 3), ("blaze", 2), ("blaze", 3), ("hellfire", 3), ("glacial-smite", 3),
    ("cold-storm", 0), ("flame-arrow", 2), ("fire-wall", 0),
}
# chain members share the root's specialty set; modelled on the root
CHAIN_CHILDREN = ("burst", "pyroclasm", "cold-wave", "winters-illusion", "curse-old-tree", "the-depths")


@pytest.fixture(scope="module")
def gd():
    return loader.load_gamedata(class_key="sorcerer")


def P(*keys):
    return Priority(tuple(PriorityEntry(k) for k in keys))


def run(gd, *keys, ranks=None, specs=None, sc=BOSS):
    b = CharacterBuild("t", "global", 45, stats=Stats(), skill_ranks=ranks or {}, specs=specs or {})
    return simulate(gd, b, P(*keys), sc)


def unquantified(sp):
    return any(e.kind == "unknown" or (e.value.value is None and e.kind not in
               ("adds_status", "reset_skill", "removes_cooldown", "force_crit")) for e in sp.effects)


# ---- specialty decoding -----------------------------------------------------------------------
def test_every_option_decoded_and_unknowns_listed(gd):
    options = [(k, i, sp) for k, s in gd.skills.items() for i, sp in enumerate(s.specializations)]
    assert len(options) == 142
    assert all(sp.effects for _, _, sp in options), "an option has no effect entry at all"
    unknown = {(k, i) for k, i, sp in options if unquantified(sp)}
    assert unknown == EXPECTED_UNKNOWN  # 8 of 142, each listed
    assert len(unknown) / len(options) < 0.06


def test_all_five_options_of_every_active_and_stigma(gd):
    for k, s in gd.skills.items():
        if s.kind == SkillKind.ACTIVE and s.specializations:
            assert len(s.specializations) == 5, k
        if s.kind == SkillKind.STIGMA and s.specializations:
            assert len(s.specializations) == 4, k


def test_unlock_ranks_match_datamine(gd):
    raw = {r["skill_id"]: r for r in json.loads(RESEARCH.read_text(encoding="utf-8")) if r.get("skill_id")}
    n = 0
    for s in gd.skills.values():
        if s.skill_id in raw and s.specializations and s.kind in (SkillKind.ACTIVE, SkillKind.STIGMA):
            want = [o["unlock_level"] for o in raw[s.skill_id]["specializations"]]
            if None in want:
                continue
            assert [sp.rank_required for sp in s.specializations] == want, s.key
            n += 1
    assert n >= 20
    assert [sp.rank_required for sp in gd.skills["hellfire"].specializations] == [8, 8, 8, 12, 16]
    assert [sp.rank_required for sp in gd.skills["cold-storm"].specializations] == [5, 10, 15, 20]


def test_chain_children_do_not_double_count(gd):
    for k in CHAIN_CHILDREN:
        for sp in gd.skills[k].specializations:
            assert all(e.kind == "no_dps" for e in sp.effects), k


def test_expected_option_values(gd):
    def eff(k, i, kind):
        return next(e for e in gd.skills[k].specializations[i].effects if e.kind == kind)
    assert eff("hellfire", 4, "cooldown_add_s").value.value == -15
    assert eff("hellfire", 0, "cast_speed_pct").value.value == 30
    assert eff("hellfire", 1, "adds_status").status_key == "spec_hellfire_1_dot"
    fs = eff("firestorm", 3, "cdr_skill_s")
    assert (fs.skill_key, fs.value.value) == ("hellfire", 10.0)  # -2 s per fireball x 5
    assert eff("firestorm", 4, "dmg_mult").value.value == 1.45
    assert eff("frost", 4, "duration_add_s").value.value == 1
    assert eff("cold-storm", 3, "duration_add_s").value.value == 10
    assert eff("wish-of-concentration", 3, "adds_status").status_key == "wish_combat_speed"
    assert eff("flame-arrow", 4, "reset_skill").on_skill == "pyroclasm"


# ---- statuses, auras, procs, gates --------------------------------------------------------------
def test_stat_mod_statuses(gd):
    mods = {k: {m.stat: m.value.value for m in s.stat_mods} for k, s in gd.statuses.items() if s.stat_mods}
    assert mods["wish_of_concentration"] == {"attack_increase_pct": 10.0}
    assert mods["wish_combat_speed"] == {"combat_speed_pct": 10.0}
    assert mods["grace_of_enhancement"] == {"dmg_boost_pct": 20.0}
    assert mods["robe_of_flame"] == {"dmg_boost_pct": 20.0}
    assert mods["robe_of_earth"]["crit_chance_pct"] == pytest.approx(200 * 80 / 1200)
    assert len(mods) >= 9


def test_auras_are_permanent_and_cited(gd):
    for k in ("robe_of_flame", "robe_of_earth", "grace_of_enhancement"):
        st = gd.statuses[k]
        assert st.duration_s.value == 0.0 and st.source_skill in gd.skills
        assert gd.skills[st.source_skill].kind == SkillKind.PASSIVE
    assert gd.statuses["robe_of_earth"].mp_min_pct == 50
    for st in gd.statuses.values():
        for m in st.stat_mods:
            assert m.value.source and m.value.confidence in ("confirmed", "estimated")


def test_fire_mark_proc(gd):
    assert gd.skills["fire-mark"].kind == SkillKind.PROC
    procs = [t for t in gd.triggers if t.proc_skill]
    assert [(t.source_skill, t.proc_skill, t.chance, t.on_element) for t in procs] == [("fire-mark", "fire-mark", 0.2, "fire")]
    res = run(gd, "flame-arrow", "frost")
    assert res.per_skill["fire-mark"].casts > 0 and res.per_skill["fire-mark"].damage > 0


def test_stagger_gates(gd):
    for k in ("flame-scattershot", "cold-snap", "magic-energy-blast"):
        assert "needs_stagger" in gd.skills[k].tags
    res = run(gd, "flame-scattershot", "flame-arrow")
    assert "flame-scattershot" not in res.per_skill


def test_flat_dot_ticks_are_recorded_not_invented(gd):
    for k in ("fire_wall_dot", "cold_storm_dot"):
        t = gd.statuses[k].tick_ratio_pct
        assert t.confidence == "unknown" and "FLAT" in t.source


# ---- hand-checked mechanics ----------------------------------------------------------------------
def test_fire_mark_lets_blaze_follow_the_first_fire_cast(gd):
    """Flame Arrow (lock 1.0 s) inflicts Fire Mark on landing; Blaze (requires it) opens at t = 1.0."""
    res = run(gd, "blaze", "flame-arrow")
    blaze = [c for c in res.casts if c.skill_key == "blaze"]
    assert blaze and blaze[0].t_s == pytest.approx(1.0)
    assert res.casts[0].skill_key == "flame-arrow"


def test_frost_gates_frost_burst(gd):
    """Frost (cd 30 s, 3 s window) is the only Frost source here: 180 s -> 6 Frosts, one Frost Burst after each."""
    res = run(gd, "frost-burst", "frost")
    n = {k: v.casts for k, v in res.per_skill.items()}
    assert n["frost"] == 6 and n["frost-burst"] == 6
    solo = run(gd, "frost-burst", "flame-arrow")
    assert "frost-burst" not in solo.per_skill
    frost_t = [c.t_s for c in res.casts if c.skill_key == "frost"]
    for c in res.casts:
        if c.skill_key == "frost-burst":
            assert any(0 <= c.t_s - t <= 3.0 for t in frost_t)


def test_robe_of_earth_and_flame_scale_damage_exactly(gd):
    """Single-target damage is linear in the boost bucket and the expected crit factor:
    robes = boost bucket 1.40 vs 1.20 (Grace already +20) and crit +13.33% at 50% crit damage with the 0.75 boss factor (MP stays full on Flame Arrow)."""
    bare = replace(gd, statuses={k: v for k, v in gd.statuses.items() if k not in ("robe_of_flame", "robe_of_earth")})
    with_ = run(gd, "flame-arrow")
    without = run(bare, "flame-arrow")
    assert BOSS.boss
    want = (1.4 / 1.2) * (1 + (200 * 80 / 1200) / 100 * 0.5 * 0.75)  # Grace's +20% is already in both runs
    assert with_.dps / without.dps == pytest.approx(want, rel=1e-6)
    assert with_.status_uptime["robe_of_earth"] == pytest.approx(1.0, abs=0.02)


def test_firestorm_specialty_pulls_hellfire_forward(gd):
    """Option 4 (-2 s Hellfire cooldown per fireball, 5 fireballs): a Firestorm cast takes 10 s off a 45 s cooldown."""
    ranks = {"firestorm": 16, "hellfire": 16}
    base = run(gd, "hellfire", "firestorm", ranks=ranks)
    fast = run(gd, "hellfire", "firestorm", ranks=ranks, specs={"firestorm": (3,)})
    assert fast.per_skill["hellfire"].casts > base.per_skill["hellfire"].casts
    assert base.per_skill["hellfire"].casts <= 5


def test_winters_illusion_equals_1_3_shackles_hits(gd):
    ws, wi = gd.skills["winters-shackles"], gd.skills["winters-illusion"]
    assert wi.atk_ratio_pct.value / ws.atk_ratio_pct.value == pytest.approx(1.3, abs=0.001)
    assert wi.ranks[0].flat_min.value / ws.ranks[0].flat_min.value == pytest.approx(1.3, abs=0.005)


def test_wish_of_concentration_buff_is_simulated(gd):
    res = run(gd, "wish-of-concentration", "flame-arrow")
    assert res.status_uptime["wish_of_concentration"] == pytest.approx(20 / 60, abs=0.02)
    no_wish = run(gd, "flame-arrow")
    assert res.dps / no_wish.dps > 1.0


# ---- optimizer smoke -------------------------------------------------------------------------------
@pytest.mark.parametrize("style", [p.key for p in bo.PLAYSTYLES])
def test_full_build_picks_specialties_fast(gd, style):
    ranks = {k: 16 for k, sk in gd.skills.items() if sk.ranks}  # specialty options unlock at skill rank 8/12/16
    build = CharacterBuild("t", "global", 45, stats=Stats(), skill_ranks=ranks)
    t0 = time.perf_counter()
    fb = bo.optimize_full_build(gd, build, style)
    assert time.perf_counter() - t0 < 30
    assert fb.result.dps > 0
    assert fb.build.specs, "optimizer picked no specialties"
    assert fb.spec_picks
    for k, opts in fb.build.specs.items():
        assert all(0 <= i < len(gd.skills[k].specializations) for i in opts)
