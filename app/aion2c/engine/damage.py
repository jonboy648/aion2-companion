"""Hit formula (PLAN section 3, P2). P2 owns this file.

All constants are community fits; confidence noted per constant.
"""
from aion2c.models import ChargeLevel, Skill, Stats

# Smite ("Double") = chance to deal DOUBLE damage, so a smite proc is worth +100% of one hit: bonus 1.0.
# Derivation (estimated): +1% smite adds 0.01*B*f / (1 + s*B*f) to total damage (s = smite fraction, f = boss
# factor). Community fits (research/sorcerer_builds_and_dps.md): S2 +0.80% per 1% on a 25% smite line
# (non-boss): B=1.0 -> 0.01/1.25 = 0.80%. S1 0.60-0.65% on KR endgame boss builds: B=1.0, f=0.7 ->
# 0.007/1.175 = 0.60%. The old 0.5 gave 0.32% (boss). tests/test_mechanics_core.py pins both numbers.
SMITE_BONUS = 1.0
BOSS_SMITE_FACTOR = 0.7  # estimated: smite is weaker against bosses
# Client UI text (String_UI_desc_Critical): "Max Critical Hit Rate is 50%, and this is reduced by target's Critical Hit
# Resist". The boss's resist is server-side and not modelled, so the flat 50% cap is applied. (Was an 80% guess.)
CRIT_CHANCE_CAP_PCT = 50.0
BOSS_CRIT_FACTOR = 0.75  # estimated: crit damage is weaker against bosses
DEFENSE_FACTOR = 0.1  # estimated: flat damage removed per point of effective defense


def per_hit_multiplier(skill: Skill, charge: ChargeLevel | None = None) -> int:
    """Hits a cast multiplies its listed damage by. Metaroad words every multi-hit skill "X% ATK + Y per hit
    (N hits)" and Y equals our Dmgsum flat token (research/multihit_rule.md, ~85% confidence, no in-game dummy
    test), so ratio AND flat are per hit and a cast deals N x one hit. Some local descriptions (Assassin, Chanter,
    Cleric: the aion2.app wording) drop "per hit", so this is data-driven on `hits` alone. A skill whose listed
    number is the whole cast carries the tag "damage_total" (mechanics.json skill_tags) and is not multiplied."""
    if "damage_total" in skill.tags:
        return 1
    if charge is not None and charge.hits is not None:  # per-tier hit count (client data: only the top tier hits twice)
        return max(1, charge.hits)
    return max(1, skill.hits)


def hit_damage_ex(
    skill: Skill,
    rank: int,
    stats: Stats,
    mult: float,
    boss: bool,
    charge: ChargeLevel | None = None,
    n_levels: int = 1,
    force_crit: bool = False,
) -> tuple[float, list[str]]:
    """Damage of ONE cast on ONE target plus warnings. Unknown flat -> 0 + warning, never raises.
    `force_crit`: every hit crits (a specialty that lands as a Critical Hit): chance 100%, no cap."""
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
        elif charge.flat_frac is not None:
            flat = lo + (hi - lo) * charge.flat_frac
        elif n_levels > 1:
            flat = lo + (hi - lo) * (charge.level - 1) / (n_levels - 1)
        else:
            flat = lo
    if charge is not None:
        cm = charge.dmg_mult.value
        cmult = 1.0 if cm is None else cm

    raw = base * ratio / 100 * cmult + flat
    raw -= max(0.0, stats.target_defense - stats.penetration) * DEFENSE_FACTOR
    raw = max(0.0, raw) * per_hit_multiplier(skill, charge)
    boost = 1 + (stats.dmg_boost_pct + stats.pve_dmg_pct + (stats.boss_dmg_pct if boss else 0.0)) / 100
    crit_p = 100.0 if force_crit else min(stats.crit_chance_pct, CRIT_CHANCE_CAP_PCT)
    crit_exp = 1 + crit_p / 100 * stats.crit_dmg_pct / 100 * (
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
    force_crit: bool = False,
) -> float:
    return hit_damage_ex(skill, rank, stats, mult, boss, charge, n_levels, force_crit)[0]


def hp_damage_coeff(skill: Skill) -> float:
    """Share of the listed damage that is HP damage: 0 for stagger-only skills (tag "stagger_only"/"stagger"),
    else Skill.hp_dmg_coeff (1.0 normally)."""
    if "stagger_only" in skill.tags or "stagger" in skill.tags:
        return 0.0
    return skill.hp_dmg_coeff


def crit_chance_frac(stats: Stats, force: bool = False) -> float:
    """Effective crit chance as a fraction (cap applied), used for crit-triggered procs."""
    return 1.0 if force else min(stats.crit_chance_pct, CRIT_CHANCE_CAP_PCT) / 100
