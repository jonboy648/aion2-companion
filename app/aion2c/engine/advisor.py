"""Marginal stat value: finite difference of simulated DPS per stat. P4 owns this file."""
from dataclasses import replace

from aion2c.engine.simulator import simulate  # noqa: F401  (patch target)
from aion2c.models import CharacterBuild, GameData, Priority, Scenario, SimConfig, StatGain, Stats

DEFAULT_DELTAS: dict[str, float] = {
    "smite_pct": 1,
    "crit_dmg_pct": 1,
    "crit_chance_pct": 1,
    "dmg_boost_pct": 1,
    "weapon_dmg_pct": 1,
    "attack_increase_pct": 1,
    "combat_speed_pct": 1,
    "attack": 10,
}
# The damage formula is a community fit, so every gain is an estimate.
_CONFIDENCE = "estimated"


def marginal_stats(
    gd: GameData,
    build: CharacterBuild,
    priority: Priority,
    scenario: Scenario,
    cfg: SimConfig = SimConfig(),
    deltas: dict[str, float] | None = None,
) -> list[StatGain]:
    """DPS gain in percent for `stats + delta`, per stat, sorted descending.

    Unknown stat names (not a `Stats` field) are skipped. A zero baseline DPS gives 0% gains.
    """
    deltas = DEFAULT_DELTAS if deltas is None else deltas
    base = simulate(gd, build, priority, scenario, cfg).dps
    fields = Stats.__dataclass_fields__
    gains: list[StatGain] = []
    for stat, delta in deltas.items():
        if stat not in fields:
            continue
        stats = replace(build.stats, **{stat: getattr(build.stats, stat) + delta})
        dps = simulate(gd, replace(build, stats=stats), priority, scenario, cfg).dps
        pct = (dps / base - 1) * 100 if base > 0 else 0.0
        gains.append(StatGain(stat, float(delta), pct, _CONFIDENCE))
    gains.sort(key=lambda g: -g.dps_gain_pct)
    return gains
