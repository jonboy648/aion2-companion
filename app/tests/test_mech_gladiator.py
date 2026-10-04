"""Gladiator structured mechanics: specialties decoded, Murderous Burst proc, Overhead Slam gate, stat-mod buffs.

Hand-checked numbers come from the datamine text in research/classes/gladiator/skills.json (see mechanics.json
`source` strings). The optimizer test gives explicit ranks because allocate_points does not rank gated skills.
"""
import time
from dataclasses import replace

import pytest

from aion2c.data import loader
from aion2c.engine import build_optimizer as bo
from aion2c.engine.simulator import simulate
from aion2c.models import CharacterBuild, Priority, PriorityEntry, Scenario, SkillKind, Stats

KEY = "gladiator"

# Options whose text has no value in any source (Multi-Hit damage, "Critical Hit on hit", AoE target counts,
# chain additions, x1.5 passive effects). They parse to kind "unknown" and warn when chosen.
KNOWN_UNKNOWN = {
    ("keen-strike", 2), ("keen-strike", 4), ("ruinous-blow", 3), ("ruinous-blow", 4), ("overhead-slam", 1),
    ("overhead-slam", 3), ("leaping-slam", 1), ("leaping-slam", 4), ("ankle-slice", 3), ("zikels-blessing", 2),
    ("sword-aura-rampage", 3), ("mocking-blade", 1), ("mocking-blade", 4), ("aerial-snare", 0),
    ("rush-strike", 2), ("rage-burst", 2), ("wave-armor", 1), ("wave-armor", 2),
}
RANKS = {"overhead-slam": 20, "rending-blow": 16, "ruinous-blow": 16, "keen-strike": 12, "crushing-wave": 12,
         "rage-burst": 20, "lunge-stance": 20, "zikels-blessing": 15, "blade-toss": 10, "assault-strike": 10,
         "lifestealing-blade": 15, "focused-block": 5}


@pytest.fixture(scope="module")
def gd():
    if not loader.default_path(KEY).is_file():
        pytest.skip("gladiator gamedata not built")
    return loader.load_gamedata(class_key=KEY)


def _build(**kw):
    kw.setdefault("stats", Stats(attack=3000, crit_chance_pct=0))
    return CharacterBuild("t", kw.pop("region", "global"), 45, class_key=KEY, **kw)


def _sim(gd, build, keys, secs, boss=True):
    pr = Priority(tuple(PriorityEntry(k) for k in keys))
    return simulate(gd, build, pr, Scenario("t", "t", secs, 1, boss))


def _is_unknown(e):
    return e.kind == "unknown" or (e.value.value is None and e.kind not in (
        "adds_status", "reset_skill", "removes_cooldown", "force_crit", "no_dps", "mobile"))


# ---- specialties decoded ---------------------------------------------------------------------


def test_every_option_is_decoded_and_unknowns_are_listed(gd):
    """5 options per active skill, 4 per stigma; every one has effects; the unknown set is exactly the listed one."""
    unknown, total = set(), 0
    for k, s in gd.skills.items():
        if s.kind == SkillKind.ACTIVE and s.specializations:
            assert len(s.specializations) == 5, k
        if s.kind == SkillKind.STIGMA:
            assert len(s.specializations) == 4, k
        for i, sp in enumerate(s.specializations):
            total += 1
            assert sp.effects, f"{k} option {i} not decoded: {sp.text}"
            assert sp.rank_required is not None
            if any(_is_unknown(e) for e in sp.effects):
                unknown.add((k, i))
    assert total == 112
    assert unknown == KNOWN_UNKNOWN
    assert len(unknown) / total < 0.2


def test_option_unlock_ranks_match_datamine(gd):
    assert [sp.rank_required for sp in gd.skills["overhead-slam"].specializations] == [8, 8, 8, 12, 16]
    assert [sp.rank_required for sp in gd.skills["lunge-stance"].specializations] == [5, 10, 15, 20]


def test_stagger_only_skills_are_gated(gd):
    for k in ("sword-aura-rampage", "madness-blow"):
        assert "needs_stagger" in gd.skills[k].tags
    res = _sim(gd, _build(skill_ranks={"sword-aura-rampage": 10}), ["sword-aura-rampage"], 20)
    assert res.per_skill.get("sword-aura-rampage") is None


# ---- hand-checked mechanics ------------------------------------------------------------------


def test_murderous_burst_fires_every_five_hits(gd):
    """Rending Blow is 2 hits: 10 casts in 10 s = 20 hits = 4 bursts (text: burst at 5 Menace stacks)."""
    res = _sim(gd, _build(), ["rending-blow"], 10)
    casts = res.per_skill["rending-blow"].casts
    assert casts == 10
    assert res.per_skill["murderous-burst"].casts == casts * 2 // 5 == 4
    # burst = 78% ATK + 539 at rank 1 (datamine), 1 target, no crit/boost/defense: 3000*0.78 + 539
    assert res.per_skill["murderous-burst"].damage / 4 == pytest.approx(3000 * 0.78 + 539, rel=1e-6)
    assert res.status_uptime["murderous_burst_crit"] > 0.5


def test_overhead_slam_needs_the_rage_burst_window(gd):
    """Overhead Slam only lands on a Knockdown target; Rage Burst opens it for 10 s (client text)."""
    b = _build(skill_ranks=RANKS, stigmas=("rage-burst",))
    assert "overhead_slam_open" not in {s for s in gd.rules["overhead-slam"].requires} ^ {"overhead_slam_open"}
    assert _sim(gd, b, ["overhead-slam"], 30).per_skill.get("overhead-slam") is None
    res = _sim(gd, b, ["rage-burst", "overhead-slam"], 30)
    # Rage Burst t=0, window 0-10 s, Overhead Slam cd 5 s: casts at 1 s and 6 s, none after 10 s
    times = [c.t_s for c in res.casts if c.skill_key == "overhead-slam"]
    assert times == [1.0, 6.0]
    assert res.status_uptime["overhead_slam_open"] == pytest.approx(10 / 30, abs=0.01)


def test_remove_cooldown_spec_spams_overhead_slam_in_the_window(gd):
    b = _build(skill_ranks=RANKS, stigmas=("rage-burst",), specs={"overhead-slam": (4,)})
    res = _sim(gd, b, ["rage-burst", "overhead-slam"], 30)
    times = [c.t_s for c in res.casts if c.skill_key == "overhead-slam"]
    assert times == [float(t) for t in range(1, 10)]  # one per 1 s lock until the window closes at 10 s


def test_lunge_stance_is_a_combat_speed_status(gd):
    st = gd.statuses["lunge_stance"]
    assert [(m.stat, m.value.value) for m in st.stat_mods] == [("combat_speed_pct", 20)]
    assert st.dmg_mult.value == 1.0  # no double count with the stat mod
    b = _build(skill_ranks={"lunge-stance": 10}, stigmas=("lunge-stance",))
    base = _sim(gd, replace(b, stigmas=()), ["rending-blow"], 10).per_skill["rending-blow"].casts
    buffed = _sim(gd, b, ["lunge-stance", "rending-blow"], 10).per_skill["rending-blow"].casts
    # lock 1.0 s -> round(1000/1.2) = 833 ms once the buff is up; casts at 1.0 + 0.833k < 10
    assert base == 10 and buffed == 11


def test_buffs_use_additive_buckets_not_multipliers(gd):
    pb = gd.statuses["prepare_for_battle"]
    assert {m.stat: m.value.value for m in pb.stat_mods}["dmg_boost_pct"] == 20
    assert pb.dmg_mult.value == 1.0
    assert gd.statuses["zikels_blessing"].stat_mods[0].stat == "attack_increase_pct"
    assert gd.statuses["murderous_burst_crit"].stat_mods[0].stat == "crit_dmg_pct"
    for k in ("spec_zikels_pve", "spec_rage_burst_pve", "spec_leaping_prepare"):
        assert gd.statuses[k].stat_mods[0].stat == "dmg_boost_pct"


def test_upward_strike_chain_needs_the_spec(gd):
    """Upward Strike is Korea-only in the data; on the Korea region it appears only with the rank-8 option."""
    kr = dict(region="korea", skill_ranks=RANKS, stigmas=("rage-burst",))
    no = _sim(gd, _build(**kr), ["rage-burst", "overhead-slam"], 12)
    yes = _sim(gd, _build(specs={"overhead-slam": (2,)}, **kr), ["rage-burst", "overhead-slam"], 12)
    assert no.per_skill.get("upward-strike") is None
    assert yes.per_skill["upward-strike"].casts == yes.per_skill["overhead-slam"].casts >= 1


def test_crit_spec_effects_decoded(gd):
    ls = gd.skills["lunge-stance"].specializations[3].effects[0]
    assert (ls.kind, ls.value.value, ls.chance, ls.trigger, ls.requires_status) == ("cdr_all_s", 1.0, 0.5, "crit", "@own")
    rb = gd.skills["rending-blow"].specializations[4].effects[0]
    assert (rb.kind, rb.value.value, rb.trigger) == ("resource_restore", 50.0, "crit")


# ---- optimizer -------------------------------------------------------------------------------


@pytest.mark.parametrize("style", ["boss", "aoe"])
def test_optimize_full_build_picks_specialties_fast(gd, style):
    build = _build(skill_ranks=RANKS, stats=Stats(attack=3000, crit_chance_pct=30, crit_dmg_pct=60))
    t0 = time.perf_counter()
    fb = bo.optimize_full_build(gd, build, style)
    assert time.perf_counter() - t0 < 30
    assert fb.result.dps > 0
    assert fb.build.specs, "no specialty chosen"
    assert fb.spec_picks and all(p.dps_gain_pct > 0 for p in fb.spec_picks)
    if style == "boss":
        assert (4,) == fb.build.specs["overhead-slam"] and "rage-burst" in {k for k, _ in fb.stigma_picks}
    assert fb.result.per_skill["murderous-burst"].casts > 0
    assert "sword-aura-rampage" not in fb.result.per_skill
