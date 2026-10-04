"""Generic engine interactions the class data needs (mini_gd: strike 100% / 1 s / cd 0, nuke 300% / cd 4, chain1->2->3,
Stats() = attack 1000, 0% crit, scen10 = 10 s on one target):

- a PROC owner's own specialties run (reset-on-crit, on-hit statuses) but it never re-triggers itself
- force-crit + reset-on-crit makes a cooldown skill castable every time
- StatusTrigger.requires_status: a proc that only fires while a (target) status is up
- SkillRule.requires_spec: a chain follow-up that exists only with its specialty option chosen
"""
from dataclasses import replace

from aion2c.engine.simulator import simulate
from aion2c.models import (
    BASELINE_L45_STATS, CharacterBuild, Num, Priority, PriorityEntry, SkillKind, SkillRule, SpecEffect,
    Specialization, Stats, StatusTrigger,
)

C = lambda v: Num(v, "confirmed", "test")  # noqa: E731
# Crit chance is capped at 50% (damage.CRIT_CHANCE_CAP_PCT): 50% x crit-trigger chance 2.0 = exactly one trigger per hit.
CRIT = Stats(crit_chance_pct=50)
CHANCE = 1.25
CRIT_TRIGGER_CHANCE = 2.0


def P(*keys):
    return Priority(tuple(PriorityEntry(k) for k in keys))


def with_opts(gd, key, *groups):
    sk = gd.skills[key]
    sps = tuple(Specialization(1, f"opt{i}", tuple(g)) for i, g in enumerate(groups))
    return replace(gd, skills={**gd.skills, key: replace(sk, specializations=sps)}, specs_parsed=True)


def casts(res, key):
    t = res.per_skill.get(key)
    return t.casts if t else 0


def proc_gd(mini_gd, requires_status=None, on="crit"):
    gore = replace(mini_gd.skills["strike"], key="gore", kind=SkillKind.PROC,
                   ranks=(replace(mini_gd.skills["strike"].ranks[0], cooldown_s=C(5)),))
    trig = StatusTrigger("", "none", CRIT_TRIGGER_CHANCE if on == "crit" else CHANCE, "gore", "confirmed", event=on, on_skills=("strike",) if on == "cast" else (),
                         proc_skill="gore", requires_status=requires_status)
    return replace(mini_gd, skills={**mini_gd.skills, "gore": gore}, triggers=(trig,))


# ---- proc owner specialties --------------------------------------------------------------------
def test_proc_owner_reset_on_crit_specialty_runs(mini_gd, scen10):
    """Every strike is a crit event. Gore (cd 5) fires at t=0 and t=5 => 2. With 'resets its cooldown
    on landing a Critical Hit' it re-arms after each proc and fires on every strike => 10."""
    g = proc_gd(mini_gd)
    b = CharacterBuild("t", "global", 45, stats=CRIT)
    assert casts(simulate(g, b, P("strike"), scen10), "gore") == 2
    reset = SpecEffect("reset_skill", C(1.0), trigger="crit", skill_key="gore")
    g2 = with_opts(g, "gore", [reset, SpecEffect("force_crit", C(1.0))])  # force: the proc's own crit chance is 1
    r = simulate(g2, replace(b, specs={"gore": (0,)}), P("strike"), scen10)
    assert casts(r, "gore") == 10 and casts(r, "strike") == 10  # a proc never feeds itself: strikes still 10


def test_proc_owner_on_hit_status_specialty_runs(mini_gd, scen10):
    g = with_opts(proc_gd(mini_gd), "gore", [SpecEffect("adds_status", C(10.0), status_key="mark")])
    b = CharacterBuild("t", "global", 45, stats=CRIT)
    assert "mark" not in simulate(g, b, P("strike"), scen10).status_uptime
    up = simulate(g, replace(b, specs={"gore": (0,)}), P("strike"), scen10).status_uptime["mark"]
    assert up == 1.0  # proc at t=0 lasts 10 s, refreshed at t=5


# ---- force crit + reset on crit ----------------------------------------------------------------
def test_forced_crit_plus_reset_on_crit_removes_the_cooldown(mini_gd, scen10):
    force = SpecEffect("force_crit", C(1.0))
    reset = SpecEffect("reset_skill", C(1.0), trigger="crit", skill_key="nuke")
    b = CharacterBuild("t", "global", 45, stats=Stats())  # 0% crit
    only_force = with_opts(mini_gd, "nuke", [force])
    both = with_opts(mini_gd, "nuke", [force, reset])
    pri = P("nuke", "strike")
    assert casts(simulate(only_force, replace(b, specs={"nuke": (0,)}), pri, scen10), "nuke") == 3  # t=0,4,8
    assert casts(simulate(both, replace(b, specs={"nuke": (0,)}), pri, scen10), "nuke") == 10
    assert casts(simulate(mini_gd, b, pri, scen10), "nuke") == 3  # no spec: no reset, no crit


# ---- trigger gated on a status -----------------------------------------------------------------
def test_trigger_requires_target_status(mini_gd, scen10):
    """marker applies `mark` (10 s) at t=0; strikes start at t=1..9 (9 strikes), each fires gore (cd 5 is
    overridden to 0 here) while the mark is up. Without the mark requirement the 10 strikes would fire 10."""
    g = proc_gd(mini_gd, requires_status="mark", on="cast")
    gore = g.skills["gore"]
    g = replace(g, skills={**g.skills, "gore": replace(gore, ranks=(replace(gore.ranks[0], cooldown_s=C(0)),)),
                           "marker": replace(mini_gd.skills["amp"], key="marker")},
                rules={**g.rules, "marker": SkillRule("marker", applies=("mark",), confidence="confirmed")})
    b = CharacterBuild("t", "global", 45, stats=Stats())
    assert casts(simulate(g, b, P("marker", "strike"), scen10), "gore") == 9
    assert casts(simulate(g, b, P("strike"), scen10), "gore") == 0  # no mark, no proc
    free = replace(g, triggers=(replace(g.triggers[0], requires_status=None),))
    assert casts(simulate(free, b, P("strike"), scen10), "gore") == 10


# ---- spec-granted chain ------------------------------------------------------------------------
def test_spec_granted_chain_needs_the_option(mini_gd, scen10):
    """chain2 is only a follow-up of chain1 while option 0 of chain1 is chosen. Without it chain1 repeats
    (10 x 1000); with it c1,c2,c3 cycle: 4 x 1000 + 3 x 1500 + 3 x 2000 = 14500."""
    g = with_opts(mini_gd, "chain1", [SpecEffect("no_dps", C(0.0))])
    g = replace(g, rules={**g.rules, "chain2": replace(g.rules["chain2"], requires_spec=("chain1", 0))})
    b = CharacterBuild("t", "global", 45, stats=Stats())
    off = simulate(g, b, P("chain1"), scen10)
    assert casts(off, "chain2") == 0 and off.total_damage == 10_000
    on = simulate(g, replace(b, specs={"chain1": (0,)}), P("chain1"), scen10)
    assert (casts(on, "chain1"), casts(on, "chain2"), casts(on, "chain3")) == (4, 3, 3) and on.total_damage == 14_500


def test_baseline_profile_has_crit():
    """Validation and manual defaults use one explicit L45 profile so crit-triggered procs can fire."""
    assert BASELINE_L45_STATS.crit_chance_pct > 0
    assert Stats().crit_chance_pct == 0  # the contract default is unchanged


# ---- per-hit damage ----------------------------------------------------------------------------
def test_hits_multiply_the_cast_unless_tagged_total(mini_gd, scen10):
    """strike = 100% ATK = 1000 per hit: 3 hits => 3000 per cast (any description wording); the tag
    'damage_total' marks a number that is already the whole cast; a single hit is unchanged."""
    sk = mini_gd.skills["strike"]
    b = CharacterBuild("t", "global", 45, stats=Stats())
    one = Priority((PriorityEntry("strike"),))

    def total(**kw):
        g = replace(mini_gd, skills={**mini_gd.skills, "strike": replace(sk, **kw)})
        return simulate(g, b, one, scen10).total_damage

    assert total() == 10_000
    assert total(hits=3, description="Deals 100% ATK + 0 per hit (3 hits) damage") == 30_000
    assert total(hits=3, description="Deals 100% ATK damage (3 hits)") == 30_000
    assert total(hits=3, tags=("damage_total",)) == 10_000


def test_real_data_hits_multiply_for_every_class():
    """Hand-computed at Attack 1000, 0% crit, rank 1, one target: (ratio x 1000 + flat) x hits, one skill per class
    (ratio and flat are the rank-1 numbers in the class data)."""
    from aion2c.data.loader import load_gamedata
    from aion2c.engine.damage import hit_damage
    st = Stats()
    cases = [("templar", "pummel", 3), ("gladiator", "rending-blow", 2), ("gladiator", "rage-burst", 5),
             ("ranger", "rapid-fire", 3), ("assassin", "quick-slice", 2), ("assassin", "storm-rampage", 4),
             ("chanter", "onslaught", 2), ("chanter", "resonance-crush", 5), ("sorcerer", "firestorm", 5),
             ("spiritmaster", "summon-ancient-spirit", 4)]
    for cls, key, hits in cases:
        g = load_gamedata(class_key=cls)
        sk = g.skills[key]
        assert sk.hits == hits, key
        ratio, flat = sk.atk_ratio_pct.value * 10, (sk.ranks[0].flat_min.value + sk.ranks[0].flat_max.value) / 2
        assert abs(hit_damage(sk, 1, st, 1.0, False) - (ratio + flat) * hits) < 1e-6, key
    g = load_gamedata(class_key="templar")
    assert abs(hit_damage(g.skills["pummel"], 1, st, 1.0, False) - 3 * (1195 + 93)) < 1e-6  # 3864, by hand
    # Cleric Lightning Strike Scattershot is 4 hits per Metaroad but its local text has no hit count (hits=1): data gap
