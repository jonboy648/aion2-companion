"""Skill / stigma point allocation. P4 owns this file."""
from dataclasses import replace

from aion2c.data.loader import allowed_skills
from aion2c.engine.simulator import simulate  # noqa: F401  (patch target)
from aion2c.progression import max_rank_at_level, stigma_unlock
from aion2c.specs import available_options, slot_room
from aion2c.engine.specialties import MIN_GAIN, _matters
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
    rank_owner,
)

BASE_RANK_CAP = 10  # skill-point ranks stop at 10 (Daevanion adds more on top, not bought here)
_SKIP = (SkillKind.CHARGE_TIER, SkillKind.PASSIVE, SkillKind.SYSTEM, SkillKind.DODGE)


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
        if rank_owner(gd, s) is not None:
            continue  # a chain follow-up plays at its owner's rank: never a separate purchase (models.rank_owner)
        out.append(s)
    return out


def _breakpoints(gd: GameData, skill: Skill) -> set[int]:
    """Ranks at which something new unlocks: every specialty option's rank requirement and every slot rank."""
    out = {sp.rank_required for sp in skill.specializations if sp.rank_required}
    out |= {int(n.value) for n in gd.spec_slot_ranks if n.value is not None}
    return out


def _pool(gd, build, skills, costs, region_cap_key, points, ranks, base, priority, scenario, cfg, log):
    """Greedy spend of `points` over `skills`. Mutates `ranks` and `log`; returns nothing.

    Each candidate's value is its best DPS gain per point over the next 1..k ranks bought as one block, where the
    block ends at a rank that unlocks something (a specialty option or slot): a tier that sits
    behind ranks which are worth nothing on their own (stigma tiers at 5/10/15/20, Corrode r1-20) is reachable that
    way, while a one-rank-at-a-time greedy never sees it. Values are cached and only the skill just upgraded is
    re-simulated, which is an approximation when skills interact (buffs, chains) but keeps the cost near one
    candidate evaluation per step instead of one per candidate per step.
    """
    if not points or points <= 0 or not skills:
        return
    # Skill-point ranks stop at BASE_RANK_CAP (Daevanion adds more on top); stigma ranks run to the region stigma cap.
    base_cap = BASE_RANK_CAP if region_cap_key == "core" else 10**6
    cap_of = {}
    for s in skills:
        cap = min(base_cap, s.max_rank, len(s.ranks), gd.rank_caps[build.region][region_cap_key])
        # a rank can only be bought once the character level meets its SkillAcquireData gate (ranks already held
        # above the gate stay as they are: they are flagged by progression.legality_issues, not capped here)
        cap_of[s.key] = max_rank_at_level(s, build.level, cap)
    cur = {s.key: effective_rank(gd, replace(build, skill_ranks=ranks), s) for s in skills}
    cur_dps = base

    by_key = {s.key: s for s in skills}
    stops = {s.key: sorted(_breakpoints(gd, s)) for s in skills}
    memo: dict[tuple, float] = {}

    def dps_at(key: str, rank: int) -> float:
        """DPS with `key` at `rank`, equipping its specialty options greedily into EVERY slot that rank has open (so
        the rank 8/12/20 slot openings carry their value; the optimizer re-chooses every option properly later)."""
        rk = {**ranks, key: rank}
        # Memo: after a purchase, the "old" side of the next step is exactly the "new" side just simulated.
        mk = (key, tuple(sorted(rk.items())))
        hit = memo.get(mk)
        if hit is not None:
            return hit
        b = replace(build, skill_ranks=rk)
        sk = by_key[key]
        best = simulate(gd, b, priority, scenario, cfg).dps
        opts = [i for i in available_options(gd, sk, rank) if _matters(sk, i)]
        slots = slot_room(gd, sk, rank)
        if opts:
            # price each option alone, then fill the open slots best-first, keeping an option only if it still adds
            # DPS next to the ones already taken (n + slots simulations instead of n x slots)
            alone = {i: simulate(gd, replace(b, specs={**b.specs, key: (i,)}), priority, scenario, cfg).dps for i in opts}
            chosen: tuple[int, ...] = ()
            bare = best
            for i in sorted(opts, key=lambda o: -alone[o]):
                if len(chosen) >= slots or alone[i] <= bare * (1 + MIN_GAIN):
                    break
                d = alone[i] if not chosen else simulate(
                    gd, replace(b, specs={**b.specs, key: chosen + (i,)}), priority, scenario, cfg).dps
                if d > best * (1 + MIN_GAIN):
                    best, chosen = d, chosen + (i,)
        memo[mk] = best
        return best

    def value(key: str, limit: int | None = None) -> tuple[float, float, int, int] | None:
        """(DPS gain per point, DPS after, ranks to buy, points) of the best block starting at the next rank
        that costs at most `limit` points."""
        r = cur[key]
        cap = cap_of[key]
        if r >= cap:
            return None
        ends = [r + 1] + [b for b in stops[key] if r + 1 < b <= cap]  # one rank, or up to the next unlock
        old = dps_at(key, r)  # same specialty convention on both sides
        best = None
        for end in sorted(set(ends)):
            cost = sum(costs[r:end])  # costs[i] = price of rank i+1
            if limit is not None and cost > limit:
                break
            new = dps_at(key, end)
            ratio = (new - old) / cost
            if best is None or ratio > best[0] + 1e-15:
                best = (ratio, cur_dps + (new - old), end - r, cost)
        return best

    cache = {s.key: value(s.key) for s in skills}
    fresh = set(cache)  # keys whose cached value was computed against the current ranks/cur_dps
    left = points
    while True:
        best_key, best = None, None
        for s in skills:  # list order = tie-break
            v = cache[s.key]
            if v is not None and v[3] > left:  # the best block is out of reach: price the longest block that fits
                v = cache[s.key] = value(s.key, left)
                fresh.add(s.key)
            if v is None or v[0] <= 1e-12:
                continue
            if best is None or v[0] > best[0]:
                best_key, best = s.key, v
        if best_key is None:
            return
        if best_key not in fresh:
            # Lazy greedy: a cached value predates later upgrades (buffs/chains interact), so
            # re-simulate the leader before buying; buying on a stale value could lose DPS.
            cache[best_key] = value(best_key)
            fresh.add(best_key)
            continue
        left -= best[3]
        cur[best_key] += best[2]
        ranks[best_key] = cur[best_key]
        gain_pct = (best[1] / cur_dps - 1) * 100 if cur_dps > 0 else 0.0
        log.append((best_key, cur[best_key], gain_pct))
        cur_dps = best[1]
        cache[best_key] = value(best_key)
        fresh = {best_key}  # every other cached value is now stale


def allocate_points(
    gd: GameData,
    build: CharacterBuild,
    priority: Priority,
    scenario: Scenario,
    cfg: SimConfig = SimConfig(),
    skip_core: bool = False,
) -> tuple[dict[str, int], list[tuple[str, int, float]]]:
    """Spend `build.skill_points` / `build.stigma_points` (unspent points, on top of current ranks).
    `skip_core` leaves the skill-point pool alone (its ranks already come with `build.skill_ranks`).

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
    if not skip_core:
        _pool(gd, build, plain, SKILL_POINT_COST, "core", build.skill_points, ranks, base, priority, scenario, cfg, log)
    base2 = simulate(gd, replace(build, skill_ranks=ranks), priority, scenario, cfg).dps if log else base
    points = build.stigma_points
    if points and not stigma_unlock(gd, build).unlocked:
        points = 0  # stigmas cannot be bought before the unlock (Ascension grade 3 + faction quest)
    if points:
        # Rank 1 of a stigma is a paid purchase (1 point), not a free default: every equipped stigma without a bought
        # rank takes its point first, in equip order; the rest is spent on ranks.
        for s in (gd.skills[k] for k in build.stigmas if k in gd.skills):
            if points > 0 and ranks.get(s.key, 0) < 1 and max_rank_at_level(s, build.level, 1) >= 1:
                ranks[s.key] = 1
                points -= STIGMA_POINT_COST[0]
    _pool(gd, build, stig, STIGMA_POINT_COST, "stigma", max(points or 0, 0), ranks, base2, priority, scenario, cfg, log)
    return ranks, log
