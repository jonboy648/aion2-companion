"""Gladiator procs and gates reviewed against the client text (Murderous Burst, Overhead Slam, Rending Blow MP on
crit, Lunge Stance cooldown cut). One non-strict xfail pins the engine gap: per-hit damage of multi-hit skills."""
from dataclasses import replace

import pytest

from aion2c.data import loader
from aion2c.engine import build_optimizer as bo
from aion2c.engine.simulator import simulate
from aion2c.models import CharacterBuild, Priority, PriorityEntry, Scenario, Stats

KEY = "gladiator"


@pytest.fixture(scope="module")
def gd():
    if not loader.default_path(KEY).is_file():
        pytest.skip("gladiator gamedata not built")
    return loader.load_gamedata(class_key=KEY)


def _b(**kw):
    kw.setdefault("stats", Stats(attack=3000, crit_chance_pct=0))
    return CharacterBuild("t", "global", 45, class_key=KEY, **kw)


def _sim(gd, b, keys, secs):
    return simulate(gd, b, Priority(tuple(PriorityEntry(k) for k in keys)), Scenario("t", "t", secs, 1, True))


def test_murderous_burst_chance_is_hits_over_five_for_every_skill(gd):
    """Menace stacks per landed hit, burst at 5: per-cast chance = hits / 5, and every damaging skill is covered."""
    covered = {}
    for t in gd.triggers:
        if t.source_skill == "murderous-burst":
            for s in t.on_skills:
                covered[s] = t.chance
    for s, ch in covered.items():
        assert ch == pytest.approx(gd.skills[s].hits / 5), s
    for k, sk in gd.skills.items():
        if sk.kind.name in ("ACTIVE", "CHAIN") and sk.ranks and sk.ranks[0].flat_min.value:
            assert k in covered, f"{k} lands hits but feeds no Menace stack"


def test_murderous_burst_data_matches_client_text(gd):
    sk = gd.skills["murderous-burst"]
    assert sk.atk_ratio_pct.value == 78.0 and sk.ranks[0].flat_min.value == 539.0  # r1 client dump
    assert gd.statuses["murderous_burst_crit"].duration_s.value == 3.0


def test_overhead_slam_gate_and_real_boss_run(gd):
    """Gate: only inside Rage Burst's 10 s window (client: Knockdown target; bosses immune bar a 7% base chance,
    which is NOT modelled and needs an OR in `requires`: engine). The boss optimizer still casts it with Rage Burst."""
    assert gd.rules["overhead-slam"].requires == ("overhead_slam_open",)
    assert "overhead_slam_open" in gd.rules["rage-burst"].applies
    fb = bo.optimize_full_build(gd, CharacterBuild("t", "global", 45, class_key=KEY), "boss")
    picks = {k for k, _ in fb.stigma_picks}
    casts = {c.skill_key for c in fb.result.casts}
    if "rage-burst" in picks:
        assert "overhead-slam" in casts


def test_rending_blow_crit_restores_50_mp(gd):
    """Spec rank 16: 'Restores 50 MP on landing a Critical Hit'. Rending Blow is MP-bound (120 MP), so at 100% crit the
    option raises its casts; at 0% crit it changes nothing."""
    base = _b(skill_ranks={"rending-blow": 16})
    spec = replace(base, specs={"rending-blow": (4,)})
    crit = Stats(attack=3000, crit_chance_pct=100)
    n = lambda b: _sim(gd, b, ["rending-blow"], 30).per_skill["rending-blow"].casts
    assert n(replace(spec, stats=crit)) > n(replace(base, stats=crit))
    assert n(spec) == n(base)


def test_lunge_stance_spec20_cuts_cooldowns_only_on_crit(gd):
    """Spec rank 20: 50% on crit, while the buff is up, to cut all cooldowns by 1 s: more Lunge Stance casts at the 50%
    crit cap (client max crit rate), none extra at 0% crit."""
    rk = {"lunge-stance": 20, "rage-burst": 20}

    def casts(crit, specs):
        b = _b(skill_ranks=rk, stigmas=("lunge-stance", "rage-burst"), specs=specs,
               stats=Stats(attack=3000, crit_chance_pct=crit))
        return _sim(gd, b, ["lunge-stance", "rage-burst", "keen-strike"], 360).per_skill["lunge-stance"].casts
    assert casts(50, {"lunge-stance": (3,)}) > casts(50, {})
    assert casts(0, {"lunge-stance": (3,)}) == casts(0, {})


@pytest.mark.xfail(strict=False, reason="ENGINE: damage.hit_damage_ex counts one hit per cast; client text is "
                   "'74.25% ATK + 70 per hit (2 hits)'. Same gap hits Overhead Slam (2), Rage Burst (5), Mocking Blade. "
                   "Fix: multiply raw by max(1, skill.hits).")
def test_multi_hit_skills_count_every_hit(gd):
    res = _sim(gd, _b(), ["rending-blow"], 2)
    assert res.casts[0].damage == pytest.approx(2 * (3000 * 0.7425 + 70), rel=1e-6)
