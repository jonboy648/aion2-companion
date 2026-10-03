"""Hit formula (PLAN section 3, P2). P2 owns this file.

All constants are community fits; confidence noted per constant.
"""
from aion2c.models import ChargeLevel, Skill, Stats

SMITE_BONUS = 0.5  # estimated: expected bonus of a smite proc relative to smite_pct
BOSS_SMITE_FACTOR = 0.7  # estimated: smite is weaker against bosses
CRIT_CHANCE_CAP_PCT = 80.0  # estimated: crit chance is capped
BOSS_CRIT_FACTOR = 0.75  # estimated: crit damage is weaker against bosses
DEFENSE_FACTOR = 0.1  # estimated: flat damage removed per point of effective defense


def hit_damage_ex(
    skill: Skill,
    rank: int,
    stats: Stats,
    mult: float,
    boss: bool,
    charge: ChargeLevel | None = None,
    n_levels: int = 1,
) -> tuple[float, list[str]]:
    """Damage of ONE cast on ONE target plus warnings. Unknown flat -> 0 + warning, never raises."""
    warns: list[str] = []
    base = stats.attack * (1 + stats.attack_increase_pct / 100) * (1 + stats.weapon_dmg_pct / 100)

    ratio = skill.atk_ratio_pct.value
    if ratio is None:
        warns.append(f"unknown value: {skill.key} atk ratio")
        ratio = 0.0

    flat = 0.0
    cmult = 1.0
    if skill.ranks:
        rd = skill.ranks[max(1, min(rank, len(skill.ranks))) - 1]
        lo, hi = rd.flat_min.value, rd.flat_max.value
        if lo is None or hi is None:
            warns.append(f"unknown value: {skill.key} flat damage")
        elif charge is None:
            flat = (lo + hi) / 2
        elif n_levels > 1:
            flat = lo + (hi - lo) * (charge.level - 1) / (n_levels - 1)
        else:
            flat = lo
    if charge is not None:
        cm = charge.dmg_mult.value
        cmult = 1.0 if cm is None else cm

    raw = base * ratio / 100 * cmult + flat
    raw -= max(0.0, stats.target_defense - stats.penetration) * DEFENSE_FACTOR
    raw = max(0.0, raw)
    boost = 1 + (stats.dmg_boost_pct + stats.pve_dmg_pct + (stats.boss_dmg_pct if boss else 0.0)) / 100
    crit_exp = 1 + min(stats.crit_chance_pct, CRIT_CHANCE_CAP_PCT) / 100 * stats.crit_dmg_pct / 100 * (
        BOSS_CRIT_FACTOR if boss else 1.0
    )
    smite_exp = 1 + stats.smite_pct / 100 * SMITE_BONUS * (BOSS_SMITE_FACTOR if boss else 1.0)
    return raw * boost * crit_exp * smite_exp * mult, warns


def hit_damage(
    skill: Skill,
    rank: int,
    stats: Stats,
    mult: float,
    boss: bool,
    charge: ChargeLevel | None = None,
    n_levels: int = 1,
) -> float:
    return hit_damage_ex(skill, rank, stats, mult, boss, charge, n_levels)[0]
