"""Full-build optimizer: stigmas -> skill/stigma points -> Daevanion -> priority -> stat gains.

simulate/optimize/marginal_stats/allocate_points/suggest_path are imported at module level so
tests can monkeypatch them on this module.
"""
import heapq
from dataclasses import dataclass, replace

from aion2c.daevanion import _relevant, is_pvp_only, selectable
from aion2c.data.loader import allowed_skills
from aion2c.engine.advisor import marginal_stats
from aion2c.engine.budget import allocate_points
from aion2c.engine.search import _seeds, candidate_skills, optimize
from aion2c.engine.simulator import simulate
from aion2c.models import (
    SCENARIOS,
    CharacterBuild,
    GameData,
    Priority,
    Region,
    Scenario,
    SearchBudget,
    SimConfig,
    SimResult,
    SkillKind,
    StatGain,
)

_BY_KEY = {s.key: s for s in SCENARIOS}


@dataclass(frozen=True)
class Playstyle:
    key: str
    name: str
    description: str
    scenario: Scenario


PLAYSTYLES: tuple[Playstyle, ...] = (
    Playstyle("boss", "Boss DPS", "Raids and dungeon bosses: sustained single-target damage.", _BY_KEY["boss_180"]),
    Playstyle("aoe", "AoE farming", "Packs of 4 mobs: area damage.", _BY_KEY["aoe_pack"]),
    Playstyle("leveling", "Leveling", "Short pulls of 3 mobs while questing.", _BY_KEY["level_pull"]),
    Playstyle(
        "burst", "Burst opener", "First 15 s on one target: everything off cooldown.",
        Scenario("burst_15", "Burst opener (15 s)", 15, 1, True),
    ),
)

STIGMA_UNLOCK_LEVELS = (22, 27, 32, 37)
TOP_STAT_GAINS = 5


def stigma_slots_at(gd: GameData, region: Region, level: int) -> int:
    """Stigma slots open at `level`: roadmap stigma items for the region (else the 22/27/32/37
    table), capped by gd.stigma_slots[region]."""
    items = [r for r in gd.roadmap if r.kind == "stigma" and region in r.regions]
    levels = sorted(r.level for r in items) if items else list(STIGMA_UNLOCK_LEVELS)
    n = sum(1 for lv in levels if lv <= level)
    return min(n, gd.stigma_slots.get(region, len(STIGMA_UNLOCK_LEVELS)))


@dataclass(frozen=True)
class FullBuild:
    playstyle: Playstyle
    build: CharacterBuild
    stigma_picks: tuple[tuple[str, float], ...]
    rank_log: tuple[tuple[str, int, float], ...]
    daevanion_path: tuple[int, ...]
    daevanion_gain_pct: float
    priority: Priority
    result: SimResult
    stat_gains: tuple[StatGain, ...]
    warnings: tuple[str, ...]
    variants: tuple["BuildVariant", ...] = ()


def _heuristic_priority(gd, build, scenario, budget) -> Priority:
    """Greedy seed priority from search (buffs first, then damage per lock-second)."""
    seeds = _seeds(gd, build, scenario, candidate_skills(gd, build), 64)  # untruncated: stigmas must not fall off the end
    return Priority(seeds[0][1]) if seeds else Priority(())


def _optimize_stigmas(gd, build, scenario, cfg, budget, slots, progress):
    """Greedy forward selection plus one swap pass. Returns [(key, gain_pct)] in pick order."""
    pool = [
        s.key for s in allowed_skills(gd, build.region, build.show_kr)
        if s.kind == SkillKind.STIGMA and (s.unlock_level is None or s.unlock_level <= build.level)
    ]
    cache: dict[tuple[str, ...], float] = {}

    def score(picks: tuple[str, ...]) -> float:
        key = tuple(sorted(picks))
        if key not in cache:
            b = replace(build, stigmas=key)
            cache[key] = simulate(gd, b, _heuristic_priority(gd, b, scenario, budget), scenario, cfg).dps
        return cache[key]

    picks: list[str] = []
    gains: list[float] = []
    cur = score(())
    for slot in range(min(slots, len(pool))):
        if progress:
            progress(f"Choosing stigma {slot + 1} of {slots}")
        rest = [k for k in pool if k not in picks]
        best = max(rest, key=lambda k: score(tuple(picks) + (k,)))  # first max wins ties
        new = score(tuple(picks) + (best,))
        gains.append((new / cur - 1) * 100 if cur > 0 else 0.0)
        picks.append(best)
        cur = new
    if progress and picks:
        progress("Trying stigma swaps")
    improved = True
    while improved and picks:
        improved = False
        for i in range(len(picks)):
            for k in pool:
                if k in picks:
                    continue
                trial = tuple(picks[:i]) + (k,) + tuple(picks[i + 1:])
                s = score(trial)
                if s > cur * (1 + 1e-9):
                    picks[i], cur, improved = k, s, True
    # recompute gains in final pick order
    out, prev = [], score(())
    for n in range(1, len(picks) + 1):
        s = score(tuple(picks[:n]))
        out.append((picks[n - 1], (s / prev - 1) * 100 if prev > 0 else 0.0))
        prev = s
    return out


# ---- utility tags / variants -------------------------------------------------------------------

# Hand-checked role tags live in the class data as Skill.tags "role:<tag>" (see _derive_tags for the
# keyword rules used when a skill carries none).
_TAG_KEYWORDS = {
    "defense": ("shield", "barrier", "damage reduction", "damage tolerance", "immune"),
    "cc": ("root", "stun", "freeze", "shackle", "slow", "seal", "polymorph", "airborne"),
    "mobility": ("dash", "speed", "teleport", "blink"),
    "sustain": ("mp restore", "restores", "heal", "absorb"),
}
_VARIANT_TAGS = ("defense", "cc", "mobility", "sustain")
_GIVES = {
    "defense": "damage protection for safer solo play",
    "cc": "crowd control to hold enemies down",
    "mobility": "extra mobility",
    "sustain": "healing or resource sustain",
}
_LABELS = {"defense": "Survivable", "cc": "Crowd control", "mobility": "Mobile", "sustain": "Sustain"}
VARIANT_BUDGET = SearchBudget(max_candidates=60)


def _derive_tags(skill) -> tuple[str, ...]:
    text = skill.description.lower()
    return tuple(t for t, kws in _TAG_KEYWORDS.items() if any(k in text for k in kws))


def utility_tags(gd: GameData, key: str) -> tuple[str, ...]:
    """Hand table first, keyword derivation from the description as the fallback."""
    sk = gd.skills.get(key)
    if sk is None:
        return ()
    hand = tuple(t[5:] for t in sk.tags if t.startswith("role:"))
    return hand or _derive_tags(sk)


@dataclass(frozen=True)
class BuildVariant:
    key: str
    label: str
    gives: str
    build: CharacterBuild
    stigma_picks: tuple[tuple[str, float], ...]
    dps: float
    dps_delta_pct: float  # vs the max-DPS build; negative = weaker


def _fast_eval(gd, build, sc, cfg, budget=VARIANT_BUDGET, extra: tuple[Priority, ...] = ()):
    """Best (dps, priority, result) for `build`: its own search plus any `extra` priorities.
    The search is stochastic, so trying the other builds' priorities removes most of the noise."""
    opt = optimize(gd, build, sc, cfg, budget)
    best = (opt.options[0].result.dps, opt.options[0].priority, opt.options[0].result) if opt.options else (0.0, None, None)
    for p in extra:
        r = simulate(gd, build, p, sc, cfg)
        if r.dps > best[0]:
            best = (r.dps, p, r)
    return best


def _variants(gd, base_in, fb_build, picks, sc, cfg, max_dps, final_budget=VARIANT_BUDGET,
              max_priority: Priority | None = None):
    """Returns (variants, improved_max) where improved_max is (dps, priority, result) or None."""
    pool = [
        s.key for s in allowed_skills(gd, fb_build.region, fb_build.show_kr)
        if s.kind == SkillKind.STIGMA and (s.unlock_level is None or s.unlock_level <= fb_build.level)
    ]
    chosen = [k for k, _ in picks]
    out = [BuildVariant("max", "Max DPS", "The highest simulated damage for this playstyle.",
                        fb_build, tuple(picks), max_dps, 0.0)]
    if not chosen:
        return tuple(out), None
    improved = None
    pending = []

    def swapped(new, drop):
        return tuple(new if k == drop else k for k in chosen)

    def heur_dps(stigmas):
        b = replace(fb_build, stigmas=stigmas)
        return simulate(gd, b, _heuristic_priority(gd, b, sc, VARIANT_BUDGET), sc, cfg).dps

    for tag in _VARIANT_TAGS:
        if any(tag in utility_tags(gd, k) for k in chosen):
            continue
        cands = [k for k in pool if k not in chosen and tag in utility_tags(gd, k)]
        if not cands:
            continue
        # best tagged stigma, replacing whichever pick costs the least to lose
        best = None
        for c in cands:
            for drop in chosen:
                d = heur_dps(swapped(c, drop))
                if best is None or d > best[0]:
                    best = (d, c, drop)
        _, new, drop = best
        vb = replace(fb_build, stigmas=swapped(new, drop))
        if vb.skill_points or vb.stigma_points:
            ranks, _log = allocate_points(gd, replace(vb, skill_ranks=dict(base_in.skill_ranks)),
                                          _heuristic_priority(gd, vb, sc, VARIANT_BUDGET), sc, cfg)
            vb = replace(vb, skill_ranks=ranks)
        # Same search as the max build, so the delta compares like with like (no clamping).
        _d, pri, _r = _fast_eval(gd, vb, sc, cfg, final_budget)
        pending.append((tag, new, drop, vb, pri))

    # Cross-check: every build also tries every other build's best priority, then deltas are taken
    # against the (possibly improved) max. A swapped-out stigma the rotation never cast costs ~0.
    pris = tuple(p for p in [max_priority] + [x[4] for x in pending] if p is not None)
    best_max = _fast_eval(gd, fb_build, sc, cfg, VARIANT_BUDGET, pris)
    if best_max[0] > max_dps:
        improved, max_dps = best_max, best_max[0]
        out[0] = replace(out[0], dps=max_dps)
    for tag, new, drop, vb, _p in pending:
        dps = max(simulate(gd, vb, p, sc, cfg).dps for p in pris) if pris else 0.0
        delta = (dps / max_dps - 1) * 100 if max_dps > 0 else 0.0
        name = gd.skills[new].name
        cost = f"costs {-delta:.1f}% DPS" if delta < -0.05 else "costs no DPS"
        vpicks = tuple((k, g) for k, g in picks if k != drop) + ((new, 0.0),)
        out.append(BuildVariant(tag, f"{_LABELS[tag]} ({name})", f"Adds {name}: {_GIVES[tag]}, {cost}",
                                vb, vpicks, dps, min(delta, 0.0)))
    return tuple(out), improved


# ---- Daevanion ------------------------------------------------------------------------------


def plan_daevanion(gd, build, priority, sc, cfg) -> list[int]:
    """Full ordered node path over boards unlocked at build.level (PvP-only nodes skipped).

    Gains are measured once per distinct effect signature (nodes with identical effects share one
    simulation), then nodes are ordered best gain-per-point first, reaching valuable nodes through
    their connecting path; zero-gain nodes follow, cheapest first, so the whole board is ordered.
    """
    boards = [b for b in gd.daevanion.values() if b.unlock_level <= build.level]
    sel = set(build.daevanion_nodes)
    base = simulate(gd, build, priority, sc, cfg).dps
    sig_gain: dict[tuple, float] = {}
    gain: dict[int, float] = {}
    for b in boards:
        for nid, n in b.nodes.items():
            if nid == b.start_id or nid in sel or is_pvp_only(n) or not _relevant(n):
                continue
            sig = (tuple((e.stat, e.value) for e in n.effects), n.skill_key)
            if sig not in sig_gain:
                d = simulate(gd, replace(build, daevanion_nodes=frozenset(sel | {nid})), priority, sc, cfg).dps
                sig_gain[sig] = max(0.0, d - base)
            gain[nid] = sig_gain[sig]
    skill_n: dict[str, int] = {}

    def count(nid: int) -> None:
        for b in boards:
            nd = b.nodes.get(nid)
            if nd and nd.skill_key:
                skill_n[nd.skill_key] = skill_n.get(nd.skill_key, 0) + 1

    for n in sel:
        count(n)

    def g(n) -> float:
        if n.skill_key and skill_n.get(n.skill_key, 0) >= 4:  # SKILL_BONUS_CAP
            return 0.0
        return gain.get(n.id, 0.0)

    path: list[int] = []
    while True:
        best = None  # (ratio, -id, chain)
        cheapest = None  # (cost, id, chain)
        fs = frozenset(sel)
        for b in boards:
            dist, gsum, prev, heap = {}, {}, {}, []
            for nid in selectable(b, fs):
                n = b.nodes[nid]
                if is_pvp_only(n):
                    continue
                dist[nid], gsum[nid], prev[nid] = n.cost, g(n), None
                heapq.heappush(heap, (n.cost, nid))
                if cheapest is None or (n.cost, nid) < cheapest[:2]:
                    cheapest = (n.cost, nid, [nid])
            while heap:
                d, u = heapq.heappop(heap)
                if d > dist[u]:
                    continue
                for v in b.nodes[u].adjacent:
                    nv = b.nodes.get(v)
                    if nv is None or v in sel or v == b.start_id or is_pvp_only(nv):
                        continue
                    if d + nv.cost < dist.get(v, 1 << 30):
                        dist[v], gsum[v], prev[v] = d + nv.cost, gsum[u] + g(nv), u
                        heapq.heappush(heap, (d + nv.cost, v))
            for t, c in dist.items():
                r = gsum[t] / max(c, 1)
                if r > 1e-12 and (best is None or (r, -t) > best[:2]):
                    chain, u = [], t
                    while u is not None:
                        chain.append(u)
                        u = prev[u]
                    best = (r, -t, chain[::-1])
        pick = best[2] if best else (cheapest[2] if cheapest else None)
        if pick is None:
            break
        for nid in pick:
            sel.add(nid)
            path.append(nid)
            count(nid)
    return path


def optimize_full_build(
    gd: GameData,
    build: CharacterBuild,
    playstyle_key: str,
    daevanion_points: int | None = None,
    cfg: SimConfig = SimConfig(),
    budget: SearchBudget = SearchBudget(max_candidates=200),
    progress=None,
) -> FullBuild:
    style = next((p for p in PLAYSTYLES if p.key == playstyle_key), None)
    if style is None:
        raise KeyError(f"unknown playstyle: {playstyle_key}")
    sc = style.scenario
    say = progress or (lambda _m: None)

    # 1. stigmas
    slots = stigma_slots_at(gd, build.region, build.level)
    picks = _optimize_stigmas(gd, build, sc, cfg, budget, slots, progress) if slots else []
    b = replace(build, stigmas=tuple(k for k, _ in picks))
    heur = _heuristic_priority(gd, b, sc, budget)

    # 2. skill / stigma points
    rank_log: list[tuple[str, int, float]] = []
    if b.skill_points or b.stigma_points:
        say("Spending skill points")
        ranks, rank_log = allocate_points(gd, b, heur, sc, cfg)
        b = replace(b, skill_ranks=ranks)

    # 3. Daevanion: full ordered path; None = assume every point is spent (max power)
    say("Planning Daevanion")
    path = plan_daevanion(gd, b, heur, sc, cfg)
    cost = {n.id: n.cost for br in gd.daevanion.values() for n in br.nodes.values()}
    take, spent = [], 0
    for nid in path:
        if daevanion_points is not None and spent + cost[nid] > daevanion_points:
            break
        take.append(nid)
        spent += cost[nid]
    dgain = 0.0
    if take:
        d0 = simulate(gd, b, heur, sc, cfg).dps
        b = replace(b, daevanion_nodes=frozenset(b.daevanion_nodes) | frozenset(take))
        dgain = (simulate(gd, b, heur, sc, cfg).dps / d0 - 1) * 100 if d0 > 0 else 0.0

    # 4. final priority search
    say("Searching rotation")
    # Room for every castable skill: a 10-entry cap silently dropped picked stigmas from the rotation.
    budget = replace(budget, max_len=max(budget.max_len, len(candidate_skills(gd, b))))
    opt = optimize(gd, b, sc, cfg, budget)
    if opt.options:
        best = opt.options[0]
        priority, result = best.priority, best.result
    else:
        priority = heur
        result = simulate(gd, b, priority, sc, cfg)

    # 5. stats
    say("Ranking stat gains")
    gains = tuple(marginal_stats(gd, b, priority, sc, cfg)[:TOP_STAT_GAINS])

    # 6. warnings
    warnings = list(dict.fromkeys(result.warnings))
    if build.skill_points is None:
        warnings.append("Skill points not set: ranks as entered.")
    if daevanion_points is None and take:
        warnings.append("assumes all Daevanion points")
    warnings.append("PvP is not modeled.")
    warnings.append("Utility value (defense, crowd control) is not simulated; variants only show the DPS cost.")
    say("Comparing trade-offs")
    variants, improved = _variants(gd, build, b, picks, sc, cfg, result.dps, budget, priority)
    if improved:
        _d, priority, result = improved
        gains = tuple(marginal_stats(gd, b, priority, sc, cfg)[:TOP_STAT_GAINS])
    unused = [gd.skills[k].name for k, _ in picks if k not in {e.skill_key for e in priority.entries}]
    if unused:
        warnings.append(f"{', '.join(unused)}: equipped but the best rotation never casts it, "
                        "so that slot is free for a utility stigma (see Trade-offs).")
    return FullBuild(
        style, b, tuple(picks), tuple(rank_log), tuple(path), dgain, priority, result, gains,
        tuple(dict.fromkeys(warnings)), variants,
    )


def compare_playstyles(gd, build, daevanion_points=None, cfg=SimConfig(), progress=None) -> dict[str, FullBuild]:
    out = {}
    for p in PLAYSTYLES:
        if progress:
            progress(f"{p.name}...")
        out[p.key] = optimize_full_build(gd, build, p.key, daevanion_points, cfg, progress=progress)
    return out
