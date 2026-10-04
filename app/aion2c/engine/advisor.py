"""Marginal stat value: finite difference of simulated DPS per stat. P4 owns this file."""
from dataclasses import replace

from aion2c.engine.search import optimize
from aion2c.engine.simulator import simulate  # noqa: F401  (patch target)
from aion2c.models import CharacterBuild, GameData, Priority, Scenario, SearchBudget, SimConfig, StatGain, Stats

SEARCH_CANDIDATES = 40  # simulations per rotation search used to re-optimise for a stat change

DEFAULT_DELTAS: dict[str, float] = {
    "smite_pct": 1,
    "crit_dmg_pct": 1,
    "crit_chance_pct": 1,
    "dmg_boost_pct": 1,
    "weapon_dmg_pct": 1,
    "attack_increase_pct": 1,
    "combat_speed_pct": 1,
    "cdr_pct": 1,
    "attack": 10,
}
TIMING_STATS = frozenset({"combat_speed_pct", "cdr_pct"})
# Speed/CDR are measured over a wider step and divided back down: with 1 s animation locks a +1 step often moves
# no cooldown past a decision point (0%) or reorders the list by luck (+/- several %), while the average slope
# over +5 is stable. The reported StatGain still says "per `delta`".
MEASURE_STEPS = {"combat_speed_pct": 5.0, "cdr_pct": 5.0}
FLOOR_AT_ZERO = frozenset(DEFAULT_DELTAS)  # stats that can only help: never reported as a loss
# The damage formula is a community fit, so every gain is an estimate.
_CONFIDENCE = "estimated"


def _best_dps(gd, build, priorities, scenario, cfg) -> tuple[float, "Priority"]:
    best = (-1.0, priorities[0])
    for p in priorities:
        d = simulate(gd, build, p, scenario, cfg).dps
        if d > best[0]:
            best = (d, p)
    return best


def marginal_stats(
    gd: GameData,
    build: CharacterBuild,
    priority: Priority,
    scenario: Scenario,
    cfg: SimConfig = SimConfig(),
    deltas: dict[str, float] | None = None,
) -> list[StatGain]:
    """DPS gain in percent for `stats + delta`, per stat, sorted descending.

    Each side is scored best-of a small set of priorities, not the single `priority` passed in: a first-ready
    priority list can get WORSE with more speed/CDR because skills reorder (a stale-priority artefact, not a
    real loss). The set is `priority` plus the top options of one search at the baseline stats; if a stat
    still reads negative, a short search at the changed stats is added before the number is reported. Stats
    that can only help (every default delta) are floored at 0 after that. Unknown stat names (not a `Stats`
    field) are skipped. A zero baseline DPS gives 0% gains.
    """
    deltas = DEFAULT_DELTAS if deltas is None else deltas
    fields = Stats.__dataclass_fields__
    todo = {st: d for st, d in deltas.items() if st in fields}
    if simulate(gd, build, priority, scenario, cfg).dps <= 0:
        return [StatGain(st, float(d), 0.0, _CONFIDENCE) for st, d in todo.items()]

    step = {st: MEASURE_STEPS.get(st, 1.0) if d > 0 else 1.0 for st, d in todo.items()}

    def delta_build(stat: str, delta: float) -> CharacterBuild:
        d = delta * step.get(stat, 1.0)
        return replace(build, stats=replace(build.stats, **{stat: getattr(build.stats, stat) + d}))

    pool: list[Priority] = [priority]

    def search(b: CharacterBuild, k: int) -> None:
        """Add the top-k priorities of a short rotation search at build `b` to the shared pool."""
        try:
            for opt in optimize(gd, b, scenario, cfg, SearchBudget(max_candidates=SEARCH_CANDIDATES), k).options:
                if opt.priority.entries not in {p.entries for p in pool}:
                    pool.append(opt.priority)
        except Exception:  # a search failure must not hide the plain finite difference
            pass

    search(build, 4)
    for stat, delta in todo.items():  # speed/CDR re-time every cast: let the search see the changed stats
        if delta > 0 and stat in TIMING_STATS:
            search(delta_build(stat, delta), 1)

    def evaluate() -> list[tuple[str, float, float, float]]:
        base = _best_dps(gd, build, pool, scenario, cfg)[0]
        return [(st, d, base, _best_dps(gd, delta_build(st, d), pool, scenario, cfg)[0]) for st, d in todo.items()]

    rows = evaluate()
    lost = [(st, d) for st, d, base, dps in rows if d > 0 and dps < base]
    if lost:  # a stat that reads as a loss gets its own rotation search, then everything is re-scored together
        for st, d in lost:
            search(delta_build(st, d), 1)
        rows = evaluate()
    gains = []
    for st, d, base, dps in rows:
        pct = (dps / base - 1) * 100 / step[st] if base > 0 else 0.0
        if d > 0 and st in FLOOR_AT_ZERO:
            pct = max(pct, 0.0)  # a stat that cannot hurt never reports a loss (what is left is search noise)
        gains.append(StatGain(st, float(d), pct, _CONFIDENCE))
    gains.sort(key=lambda g: -g.dps_gain_pct)
    return gains
