"""Skill / stigma point allocation. P4 owns this file."""
from dataclasses import replace

from aion2c.data.loader import allowed_skills
from aion2c.engine.simulator import simulate  # noqa: F401  (patch target)
from aion2c.models import (
    SKILL_POINT_COST,
    STIGMA_POINT_COST,
    CharacterBuild,
    GameData,
    Priority,
    Scenario,
    SimConfig,
    Skill,
    SkillKind,
    effective_rank,
)

BASE_RANK_CAP = 10  # skill-point ranks stop at 10 (Daevanion adds more on top, not bought here)
_SKIP = (SkillKind.PROC, SkillKind.CHARGE_TIER, SkillKind.PASSIVE, SkillKind.SYSTEM, SkillKind.DODGE)


def _castable(gd: GameData, build: CharacterBuild, priority: Priority) -> list[Skill]:
    """Skills a priority can cast: its entries plus chain children reached via rules, level/region gated."""
    allowed = {s.key for s in allowed_skills(gd, build.region, build.show_kr)}
    seen: list[str] = []
    for e in priority.entries:
        k: str | None = e.skill_key
        while k is not None and k not in seen:
            seen.append(k)
            rule = gd.rules.get(k)
            k = rule.chain_next if rule else None
    out = []
    for k in seen:
        s = gd.skills.get(k)
        if s is None or s.kind in _SKIP or k not in allowed:
            continue
        if s.unlock_level is not None and s.unlock_level > build.level:
            continue
        out.append(s)
    return out


def _pool(gd, build, skills, costs, region_cap_key, points, ranks, base, priority, scenario, cfg, log):
    """Greedy spend of `points` over `skills`. Mutates `ranks` and `log`; returns nothing.

    Each candidate's value (DPS gain per point of its next rank) is cached and only the skill just
    upgraded is re-simulated. That is an approximation when skills interact (buffs, chains) but keeps
    the cost near one simulation per step instead of one per candidate per step.
    """
    if not points or points <= 0 or not skills:
        return
    cap_of = {
        s.key: min(BASE_RANK_CAP, s.max_rank, len(s.ranks), gd.rank_caps[build.region][region_cap_key])
        for s in skills
    }
    cur = {s.key: effective_rank(gd, replace(build, skill_ranks=ranks), s) for s in skills}
    cur_dps = base

    def dps_at(key: str, rank: int) -> float:
        b = replace(build, skill_ranks={**ranks, key: rank})
        return simulate(gd, b, priority, scenario, cfg).dps

    def value(key: str) -> tuple[float, float] | None:
        r = cur[key]
        if r >= cap_of[key]:
            return None
        cost = costs[r]  # costs[i] = price of rank i+1
        new = dps_at(key, r + 1)
        return (new - cur_dps) / cost, new

    cache = {s.key: value(s.key) for s in skills}
    left = points
    while True:
        best_key, best = None, None
        for s in skills:  # list order = tie-break
            v = cache[s.key]
            if v is None or v[0] <= 1e-12 or costs[cur[s.key]] > left:
                continue
            if best is None or v[0] > best[0]:
                best_key, best = s.key, v
        if best_key is None:
            return
        left -= costs[cur[best_key]]
        cur[best_key] += 1
        ranks[best_key] = cur[best_key]
        gain_pct = (best[1] / cur_dps - 1) * 100 if cur_dps > 0 else 0.0
        log.append((best_key, cur[best_key], gain_pct))
        cur_dps = best[1]
        cache[best_key] = value(best_key)


def allocate_points(
    gd: GameData,
    build: CharacterBuild,
    priority: Priority,
    scenario: Scenario,
    cfg: SimConfig = SimConfig(),
) -> tuple[dict[str, int], list[tuple[str, int, float]]]:
    """Spend `build.skill_points` / `build.stigma_points` (unspent points, on top of current ranks).

    Skill points go to castable non-stigma skills of `priority` (cap rank 10), stigma points to
    `build.stigmas` that the priority casts (cap = region stigma cap). Only upgrades with a positive
    simulated DPS gain are bought, so unknown/flat-less skills get nothing. Returns the new
    `skill_ranks` (copy) and a log of (skill, new rank, DPS gain %) in purchase order.
    """
    ranks = dict(build.skill_ranks)
    log: list[tuple[str, int, float]] = []
    castable = _castable(gd, build, priority)
    base = simulate(gd, build, priority, scenario, cfg).dps
    plain = [s for s in castable if s.kind != SkillKind.STIGMA]
    stig = [s for s in castable if s.kind == SkillKind.STIGMA and s.key in build.stigmas]
    _pool(gd, build, plain, SKILL_POINT_COST, "core", build.skill_points, ranks, base, priority, scenario, cfg, log)
    base2 = simulate(gd, replace(build, skill_ranks=ranks), priority, scenario, cfg).dps if log else base
    _pool(gd, build, stig, STIGMA_POINT_COST, "stigma", build.stigma_points, ranks, base2, priority, scenario, cfg, log)
    return ranks, log
