"""Optimizer (PLAN P3): seeded local search over priority lists, scored by the simulator.

`simulate` is imported at module level so tests patch `aion2c.engine.search.simulate`.
The cache is scoped to one `optimize` call and keyed on `priority.entries` only (GameData,
CharacterBuild and SimConfig are unhashable, so they must never be part of a cache key).
"""
import dataclasses
import random

from aion2c.data.loader import allowed_skills
from aion2c.engine.community import compare
from aion2c.engine.explain import explain_ranked
from aion2c.engine.simulator import simulate  # noqa: F401  (patch target)
from aion2c.models import (
    CharacterBuild,
    GameData,
    OptimizeResult,
    Priority,
    PriorityEntry,
    RankedOption,
    Scenario,
    SearchBudget,
    SimConfig,
    SimResult,
    Skill,
    SkillKind,
    effective_rank,
)

_CASTABLE_KINDS = (SkillKind.ACTIVE, SkillKind.STIGMA)


def _deals_damage_or_applies(gd: GameData, s: Skill) -> bool:
    if (s.atk_ratio_pct.value or 0) > 0:
        return True
    if any((r.flat_min.value or 0) > 0 or (r.flat_max.value or 0) > 0 for r in s.ranks):
        return True
    rule = gd.rules.get(s.key)
    return bool(rule and rule.applies)


def candidate_skills(gd: GameData, build: CharacterBuild) -> list[PriorityEntry]:
    """Castable skills for this build; charge skills get one entry per level."""
    out: list[PriorityEntry] = []
    for s in allowed_skills(gd, build.region, build.show_kr):
        if s.kind not in _CASTABLE_KINDS:
            continue
        if s.kind == SkillKind.STIGMA and s.key not in build.stigmas:
            continue
        if s.unlock_level is not None and s.unlock_level > build.level:
            continue
        if not _deals_damage_or_applies(gd, s):
            continue
        rule = gd.rules.get(s.key)
        if rule and rule.charge_levels:
            out.extend(PriorityEntry(s.key, lv.level) for lv in rule.charge_levels)
        else:
            out.append(PriorityEntry(s.key))
    return out


# ---- seed construction ----------------------------------------------------------------------


def _num(n) -> float:
    return float(n.value) if n is not None and n.value is not None else 0.0


def _is_buff(gd: GameData, key: str) -> float:
    """Best self-buff multiplier a skill applies (0.0 when it applies none)."""
    rule = gd.rules.get(key)
    best = 0.0
    if rule:
        for sk in rule.applies:
            st = gd.statuses.get(sk)
            if st and st.on == "self" and _num(st.dmg_mult) > 1.0:
                best = max(best, _num(st.dmg_mult))
    return best


def _skill_numbers(gd: GameData, build: CharacterBuild, scenario: Scenario, e: PriorityEntry):
    """(damage per cast estimate, lock_s incl. charge, cooldown_s) for a candidate entry."""
    s = gd.skills[e.skill_key]
    rank = effective_rank(gd, build, s)
    rd = s.ranks[rank - 1] if s.ranks else None
    fmin, fmax = (_num(rd.flat_min), _num(rd.flat_max)) if rd else (0.0, 0.0)
    cd = _num(rd.cooldown_s) if rd else 0.0
    cmult, charge_s, flat = 1.0, 0.0, (fmin + fmax) / 2
    rule = gd.rules.get(s.key)
    if rule and rule.charge_levels:
        lv = next((x for x in rule.charge_levels if x.level == e.charge_level), rule.charge_levels[-1])
        n = len(rule.charge_levels)
        flat = fmin + (fmax - fmin) * (lv.level - 1) / (n - 1) if n > 1 else fmin
        cmult, charge_s = _num(lv.dmg_mult) or 1.0, _num(lv.charge_s)
    st = build.stats
    base = st.attack * (1 + st.attack_increase_pct / 100) * (1 + st.weapon_dmg_pct / 100)
    dmg = (base * _num(s.atk_ratio_pct) / 100 * cmult + flat) * min(scenario.n_targets, s.aoe_targets)
    lock = (_num(s.anim_lock_s) or 1.0) / (1 + st.combat_speed_pct / 100) + charge_s
    return dmg, max(lock, 0.05), cd


def _highest_level_entries(cands: list[PriorityEntry]) -> list[PriorityEntry]:
    best: dict[str, PriorityEntry] = {}
    for e in cands:
        if e.skill_key not in best or e.charge_level > best[e.skill_key].charge_level:
            best[e.skill_key] = e
    return list(best.values())


def _seeds(gd, build, scenario, cands, max_len) -> list[tuple[str, tuple[PriorityEntry, ...]]]:
    top = _highest_level_entries(cands)
    info = {e.skill_key: _skill_numbers(gd, build, scenario, e) for e in top}
    buffs = sorted((e for e in top if _is_buff(gd, e.skill_key)), key=lambda e: -_is_buff(gd, e.skill_key))
    others = [e for e in top if e not in buffs]
    by_rate = sorted(others, key=lambda e: -(info[e.skill_key][0] / info[e.skill_key][1]))
    by_cd = sorted(others, key=lambda e: (-info[e.skill_key][2], -(info[e.skill_key][0] / info[e.skill_key][1])))
    seeds = [
        ("greedy", tuple((buffs + by_rate)[:max_len])),
        ("buffs+cooldown", tuple((buffs + by_cd)[:max_len])),
    ]
    avail = {e.skill_key: e for e in top}
    for cr in gd.community:
        if cr.scenario_key != scenario.key:
            continue
        ents, seen = [], set()
        for k in cr.priority:
            if k in avail and k not in seen:
                ents.append(avail[k])
                seen.add(k)
        if ents:
            seeds.append((f"community:{cr.key}", tuple(ents[:max_len])))
    return [(n, e) for n, e in seeds if e]


# ---- search ---------------------------------------------------------------------------------


def _neighbors(entries, cands, statuses, max_len, rng):
    """All single-edit neighbours of `entries`, shuffled by `rng` (deterministic per seed)."""
    n = len(entries)
    keys = {e.skill_key for e in entries}
    out: list[tuple[PriorityEntry, ...]] = []
    for i in range(n):
        if n > 1:
            out.append(entries[:i] + entries[i + 1 :])
        for j in range(i + 1, n):
            sw = list(entries)
            sw[i], sw[j] = sw[j], sw[i]
            out.append(tuple(sw))
        for j in range(n):
            if j != i:
                mv = list(entries)
                mv.insert(j, mv.pop(i))
                out.append(tuple(mv))
        e = entries[i]
        if e.require_status is not None:
            out.append(entries[:i] + (dataclasses.replace(e, require_status=None),) + entries[i + 1 :])
        for st in statuses:
            if st != e.require_status:
                out.append(entries[:i] + (dataclasses.replace(e, require_status=st),) + entries[i + 1 :])
        # change charge level of a charge entry
        for c in cands:
            if c.skill_key == e.skill_key and c.charge_level != e.charge_level:
                out.append(entries[:i] + (dataclasses.replace(e, charge_level=c.charge_level),) + entries[i + 1 :])
    if n < max_len:
        for c in cands:
            if c.skill_key in keys:
                continue
            for pos in range(n + 1):
                out.append(entries[:pos] + (c,) + entries[pos:])
    seen, uniq = {entries}, []
    for o in out:
        if o not in seen:
            seen.add(o)
            uniq.append(o)
    rng.shuffle(uniq)
    return uniq


def _signature(r: SimResult):
    return (round(r.total_damage, 6), tuple((c.skill_key, c.charge_level) for c in r.casts))


def optimize(
    gd: GameData,
    build: CharacterBuild,
    scenario: Scenario,
    cfg: SimConfig = SimConfig(),
    budget: SearchBudget = SearchBudget(),
    top_k: int = 5,
) -> OptimizeResult:
    cands = candidate_skills(gd, build)
    if not cands:
        return OptimizeResult(scenario, (), ())
    rng = random.Random(budget.seed)
    cache: dict[tuple[PriorityEntry, ...], SimResult] = {}
    order: list[tuple[PriorityEntry, ...]] = []
    sims = 0
    applied = {sk for e in cands for sk in (gd.rules.get(e.skill_key).applies if gd.rules.get(e.skill_key) else ())}
    statuses = sorted(applied)

    def evaluate(entries, limit):
        """Return the result, or None when a new simulation would exceed `limit` (or the cap)."""
        nonlocal sims
        hit = cache.get(entries)
        if hit is not None:
            return hit
        if sims >= limit or sims >= budget.max_candidates:
            return None
        sims += 1
        res = simulate(gd, build, Priority(entries), scenario, cfg)
        cache[entries] = res
        order.append(entries)
        return res

    seeds = _seeds(gd, build, scenario, cands, budget.max_len)
    share = max(1, budget.max_candidates // max(1, len(seeds)))
    for idx, (_name, start) in enumerate(seeds):
        limit = min(budget.max_candidates, share * (idx + 1))  # unspent budget rolls forward
        cur = start
        cur_res = evaluate(cur, limit)
        if cur_res is None:
            continue
        improved = True
        while improved:
            improved = False
            for nb in _neighbors(cur, cands, statuses, budget.max_len, rng):
                r = evaluate(nb, limit)
                if r is None:
                    if sims >= limit:
                        break
                    continue
                if r.dps > cur_res.dps * (1 + 1e-9):
                    cur, cur_res, improved = nb, r, True
                    break
            if sims >= limit:
                break

    pos = {e: i for i, e in enumerate(order)}
    ranked = sorted(order, key=lambda e: (-cache[e].dps, len(e), pos[e]))
    picked: list[tuple[PriorityEntry, ...]] = []
    sigs = set()
    for e in ranked:
        sig = _signature(cache[e])
        if sig in sigs:
            continue
        sigs.add(sig)
        picked.append(e)
        if len(picked) >= top_k:
            break

    results = [cache[e] for e in picked]
    note = f"{len(cache)} distinct priorities simulated"
    results[0] = dataclasses.replace(results[0], warnings=results[0].warnings + (note,))
    options = []
    for i, (e, res) in enumerate(zip(picked, results)):
        if i + 1 < len(results):
            text = explain_ranked(res, results[i + 1], gd, f"Option {i + 1}", f"{i + 2}")
        else:
            text = f"Option {i + 1}: lowest of the {len(results)} kept, {res.dps:.1f} DPS."
        options.append(RankedOption(i + 1, Priority(e, label=f"Option {i + 1}"), res, text))
    disagreements = compare(gd, build, scenario, options[0], cfg)
    return OptimizeResult(scenario, tuple(options), disagreements)
