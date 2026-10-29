"""Source-grounded combo behavior, observed only through the public simulator."""
from dataclasses import replace

import pytest

from aion2c.engine.simulator import simulate
from aion2c.models import CharacterBuild, Num, Priority, PriorityEntry, SpecEffect, Specialization, Stats


def build(**kwargs):
    return CharacterBuild("Combo test", "global", 45, stats=Stats(crit_chance_pct=0), **kwargs)


def priority(key, level=0):
    return Priority((PriorityEntry(key, level),))


@pytest.mark.parametrize("duration", [0.1, 2.0])
def test_charge_landing_at_or_after_fight_end_adds_no_damage_or_status(mini_gd, scen, duration):
    # The miniature dataset's third charge lands at 2s. Applying the buff on
    # release also checks that unfinished casts don't silently open future windows.
    rule = replace(mini_gd.rules["charge"], applies=("amp_buff",))
    gd = replace(mini_gd, rules={**mini_gd.rules, "charge": rule})
    result = simulate(gd, build(), priority("charge", 3), scen(duration))

    assert result.total_damage == 0
    assert result.dps == 0
    assert not result.status_uptime
    assert sum(c.damage for c in result.casts) == 0


def test_stagger_contribution_is_per_release_not_hp_hit_count(mini_gd, scen):
    skill = replace(mini_gd.skills["strike"], stagger_gauge=7, hits=5)
    gd = replace(mini_gd, skills={**mini_gd.skills, "strike": skill})
    result = simulate(gd, build(), priority("strike"), replace(scen(2), objective="stagger"))

    assert result.total_stagger == 14
    assert result.stagger_per_s == 7
    assert result.per_skill["strike"].stagger == 14
    assert [cast.stagger for cast in result.casts] == [7, 7]


@pytest.mark.parametrize("tier,gauge", [(1, 20), (2, 25), (3, 35)])
def test_charge_uses_its_release_gauge_instead_of_scalar_maximum(mini_gd, scen, tier, gauge):
    levels = tuple(replace(level, stagger_gauge=amount)
                   for level, amount in zip(mini_gd.rules["charge"].charge_levels, (20, 25, 35)))
    rule = replace(mini_gd.rules["charge"], charge_levels=levels)
    skill = replace(mini_gd.skills["charge"], stagger_gauge=999, hits=8)
    gd = replace(mini_gd, rules={**mini_gd.rules, "charge": rule}, skills={**mini_gd.skills, "charge": skill})
    result = simulate(gd, build(), priority("charge", tier), replace(scen(2.1), objective="stagger"))

    assert result.total_stagger == gauge
    assert result.casts[0].stagger == gauge


@pytest.mark.parametrize("selected,rank,lands", [(False, 8, False), (True, 1, False), (True, 8, True)])
def test_exact_alternate_charge_time_needs_its_unlocked_specialty(mini_gd, scen, selected, rank, lands):
    # Normal maximum takes2s, the source-derived variant .7s. Multiplying by
    # the legacy .8 approximation would miss the1s deadline even when unlocked.
    levels = tuple(replace(level, fast_charge_s=Num(.7)) for level in mini_gd.rules["charge"].charge_levels)
    rule = replace(mini_gd.rules["charge"], charge_levels=levels, fast_charge_spec=("charge", 0))
    option = Specialization(8, "Faster charge", (SpecEffect("charge", Num(.8)),))
    base = mini_gd.skills["charge"]
    skill = replace(base, specializations=(option,), max_rank=8,
                    ranks=tuple(replace(base.ranks[0], rank=n) for n in range(1, 9)))
    gd = replace(mini_gd, rules={**mini_gd.rules, "charge": rule}, skills={**mini_gd.skills, "charge": skill})
    b = build(skill_ranks={"charge": rank}, specs={"charge": (0,)} if selected else {})
    result = simulate(gd, b, priority("charge", 3), scen(1))

    assert (result.total_damage > 0) is lands


def test_unfinished_charge_never_opens_its_free_proc(mini_gd, scen):
    from aion2c.models import StatusTrigger

    trigger = StatusTrigger("", "none", 1, "charge", on_skills=("charge",), proc_skill="nuke")
    gd = replace(mini_gd, triggers=(trigger,))
    result = simulate(gd, build(), priority("charge", 3), scen(.1))

    assert result.total_damage == 0
    assert "nuke" not in result.per_skill


def test_missing_charge_gauge_is_reported_not_replaced_with_top_end(mini_gd, scen):
    skill = replace(mini_gd.skills["charge"], stagger_gauge=999)
    gd = replace(mini_gd, skills={**mini_gd.skills, "charge": skill})
    result = simulate(gd, build(), priority("charge", 1), replace(scen(3), objective="stagger"))

    assert result.total_stagger == 0
    assert any("Stagger amount unavailable: Charge" in warning for warning in result.warnings)
    assert result.confidence == "unknown"


def test_unfinished_charge_adds_no_gauge(mini_gd, scen):
    rule = mini_gd.rules["charge"]
    levels = tuple(replace(level, stagger_gauge=35) for level in rule.charge_levels)
    gd = replace(mini_gd, rules={**mini_gd.rules, "charge": replace(rule, charge_levels=levels)})
    result = simulate(gd, build(), priority("charge", 3), replace(scen(.1), objective="stagger"))

    assert result.total_stagger == 0
    assert all(cast.stagger == 0 for cast in result.casts)


@pytest.mark.parametrize("duration,lands", [(.81, False), (1.05, False), (1.06, True)])
def test_shipped_hellfire_speed_option_does_not_shorten_exact_threshold_twice(scen, duration, lands):
    from aion2c.data.loader import load_gamedata

    gd = load_gamedata(class_key="sorcerer")
    b = build(skill_ranks={"hellfire": 8}, specs={"hellfire": (0,)})
    result = simulate(gd, b, priority("hellfire", 4), scen(duration))

    # The real specialty is cast_speed_pct=30, not the legacy 'charge' effect.
    # SkillCharge's alternate threshold already includes that same modifier.
    assert (result.total_damage > 0) is lands
    assert result.total_stagger == (35 if lands else 0)
