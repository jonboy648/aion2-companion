from dataclasses import replace

from aion2c.engine.damage import crit_chance_frac, hit_damage, hit_damage_ex
from aion2c.models import ChargeLevel, Num, Stats


def test_hit_basic(mini_gd):
    s = mini_gd.skills["strike"]
    assert hit_damage(s, 1, Stats(), 1.0, False) == 1000.0
    assert hit_damage(s, 1, Stats(dmg_boost_pct=10), 1.0, False) == 1100.0
    assert hit_damage(s, 1, Stats(target_defense=500), 1.0, False) == 950.0


def test_penetration_offsets_defense(mini_gd):
    s = mini_gd.skills["strike"]
    assert hit_damage(s, 1, Stats(target_defense=500, penetration=500), 1.0, False) == 1000.0


def test_boss_dmg_only_on_boss(mini_gd):
    s = mini_gd.skills["strike"]
    st = Stats(boss_dmg_pct=20, pve_dmg_pct=5)
    assert hit_damage(s, 1, st, 1.0, False) == 1050.0
    assert hit_damage(s, 1, st, 1.0, True) == 1250.0


def test_crit_and_smite_expectation(mini_gd):
    s = mini_gd.skills["strike"]
    st = Stats(crit_chance_pct=50, crit_dmg_pct=100, smite_pct=20)
    assert abs(hit_damage(s, 1, st, 1.0, False) - 1000 * 1.5 * 1.2) < 1e-9  # smite = double chance: bonus 1.0
    # boss: crit x0.75, smite x0.7; crit chance capped at 50 (client: "Max Critical Hit Rate is 50%")
    st2 = Stats(crit_chance_pct=200, crit_dmg_pct=100, smite_pct=20)
    assert abs(hit_damage(s, 1, st2, 1.0, True) - 1000 * (1 + 0.5 * 0.75) * (1 + 0.2 * 1.0 * 0.7)) < 1e-9


def test_crit_chance_cap_is_50_percent(mini_gd):
    # client UI text: "Max Critical Hit Rate is 50%": anything above 50 adds nothing, 50 itself counts in full
    s = mini_gd.skills["strike"]
    at50 = hit_damage(s, 1, Stats(crit_chance_pct=50, crit_dmg_pct=100), 1.0, False)
    assert at50 == 1000 * 1.5
    assert hit_damage(s, 1, Stats(crit_chance_pct=80, crit_dmg_pct=100), 1.0, False) == at50
    assert crit_chance_frac(Stats(crit_chance_pct=80)) == 0.5 and crit_chance_frac(Stats(crit_chance_pct=30)) == 0.3


def test_attack_multipliers(mini_gd):
    s = mini_gd.skills["strike"]
    st = Stats(attack_increase_pct=10, weapon_dmg_pct=10)
    assert abs(hit_damage(s, 1, st, 1.0, False) - 1000 * 1.1 * 1.1) < 1e-9


def test_mult_and_floor(mini_gd):
    s = mini_gd.skills["strike"]
    assert hit_damage(s, 1, Stats(), 1.5, False) == 1500.0
    assert hit_damage(s, 1, Stats(target_defense=1e9), 1.0, False) == 0.0


def _flat_skill(mini_gd, lo, hi):
    s = mini_gd.skills["strike"]
    r = replace(s.ranks[0], flat_min=Num(lo, "confirmed"), flat_max=Num(hi, "confirmed"))
    return replace(s, atk_ratio_pct=Num(100.0, "confirmed"), ranks=(r,))


def test_flat_mean_non_charge(mini_gd):
    assert hit_damage(_flat_skill(mini_gd, 100, 300), 1, Stats(), 1.0, False) == 1200.0


def test_charge_flat_interpolates_ratio_scales(mini_gd):
    s = _flat_skill(mini_gd, 100, 300)
    lv = [ChargeLevel(i, Num(0.0, "confirmed"), Num(float(i), "confirmed")) for i in (1, 2, 3)]
    # L2 of 3: flat 200, ratio part 1000 * 2
    assert hit_damage(s, 1, Stats(), 1.0, False, lv[1], 3) == 2200.0
    assert hit_damage(s, 1, Stats(), 1.0, False, lv[0], 3) == 1100.0
    assert hit_damage(s, 1, Stats(), 1.0, False, lv[2], 3) == 3300.0


def test_unknown_flat_is_zero_with_warning(mini_gd):
    s = mini_gd.skills["strike"]
    r = replace(s.ranks[0], flat_min=Num(None), flat_max=Num(None))
    dmg, warns = hit_damage_ex(replace(s, ranks=(r,)), 1, Stats(), 1.0, False)
    assert dmg == 1000.0 and warns and "strike" in warns[0]
