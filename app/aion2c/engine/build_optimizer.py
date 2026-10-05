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
from aion2c.engine.specialties import SpecPick, _matters, choose_specs, spec_picks
from aion2c.engine.simulator import simulate
from aion2c.models import (
    SCENARIOS,
    STIGMA_POINT_COST,
    CharacterBuild,
    GameData,
    Priority,
    Region,
    Scenario,
    SearchBudget,
    SimConfig,
    SimResult,
    MAX_DAEVANION_RANK_BONUS,
    SkillKind,
    StatGain,
    daevanion_rank_bonus,
    total_rank,
)
from aion2c.specs import available_options

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
    spec_picks: tuple[SpecPick, ...] = ()  # equipped specialty options with the DPS each adds (best first)


def _heuristic_priority(gd, build, scenario, budget, guide: Priority | None = None) -> Priority:
    """Greedy seed priority from search (buffs first, then damage per lock-second).

    With a `guide` (a rotation already searched for this character), the guide's entries that this build can cast go
    first, in the guide's order, and the seed fills in the rest: casts gated on a status (`require_status`) exist only
    in searched rotations, so a stigma or rank whose value comes from such a cast is invisible to the plain seed."""
    seeds = _seeds(gd, build, scenario, candidate_skills(gd, build), 64)  # untruncated: stigmas must not fall off the end
    base = Priority(seeds[0][1]) if seeds else Priority(())
    if guide is None:
        return base
    ok = {e.skill_key for e in candidate_skills(gd, build)}
    keep = tuple(e for e in guide.entries if e.skill_key in ok)
    have = {e.skill_key for e in keep}
    return Priority(keep + tuple(e for e in base.entries if e.skill_key not in have))


def _stigma_pool(gd, build) -> list[str]:
    """Stigmas this build can equip. One without an unlock level (and no tiers) is not in Global: the guides list
    exactly 13 stigmas per class without them, so it is never offered."""
    return [
        s.key for s in allowed_skills(gd, build.region, build.show_kr)
        if s.kind == SkillKind.STIGMA and s.unlock_level is not None and s.unlock_level <= build.level
    ]


def _front_variants(gd, build, scenario, budget, skip=frozenset(), base=None):
    """The heuristic priority plus, for each equipped stigma not in `skip`, that priority with the stigma moved to
    the front. A stigma whose value is indirect (a buff, a window opener) can sit late in the greedy order and
    never fire against always-ready fillers; the front variant guarantees the candidate is actually cast."""
    base = base or _heuristic_priority(gd, build, scenario, budget)
    out = [base]
    for k in build.stigmas:
        front = tuple(e for e in base.entries if e.skill_key == k)
        if front and k not in skip:
            out.append(Priority(front + tuple(e for e in base.entries if e.skill_key != k)))
    return out


def _best_stigma_dps(gd, build, scenario, cfg, budget, guide=None) -> float:
    """DPS of the best of: the greedy priority, and (for every equipped stigma the greedy priority never casts)
    that priority with the stigma forced to the front. Keeps the better, so a stigma is never judged by a
    priority that did not cast it."""
    pri = _heuristic_priority(gd, build, scenario, budget, guide)
    base = simulate(gd, build, pri, scenario, cfg)
    cast = {k for k, t in base.per_skill.items() if t.casts}
    best = base.dps
    for p in _front_variants(gd, build, scenario, budget, skip=frozenset(cast), base=pri)[1:]:
        best = max(best, simulate(gd, build, p, scenario, cfg).dps)
    # Never worse than leaving a stigma uncast: an equipped stigma the greedy order casts badly (it costs lock time
    # for little) must not make the set look worse than the same set without it, or the chooser skips real picks.
    for k in cast & set(build.stigmas):
        rest = Priority(tuple(e for e in pri.entries if e.skill_key != k))
        if rest.entries:
            best = max(best, simulate(gd, build, rest, scenario, cfg).dps)
    return best


def _planned_stigma_rank(gd, build, slots) -> int:
    """The rank each equipped stigma reaches if the unspent stigma points are shared equally over all `slots`
    (0 when there are none to spend). The stigma search values candidates at this rank."""
    pts = build.stigma_points or 0
    if pts <= 0 or slots <= 0:
        return 0
    share, rank, spent = pts / slots, 1, 0
    cap = min(gd.rank_caps[build.region]["stigma"], len(STIGMA_POINT_COST) + 1)
    for cost in STIGMA_POINT_COST[:cap - 1]:
        if spent + cost > share:
            break
        spent += cost
        rank += 1
    return rank


def _community_sets(gd, scenario, pool, slots) -> list[tuple[str, ...]]:
    """Stigma sets the community rotations for this scenario name (their stigmas that can be equipped here)."""
    out = []
    for cr in gd.community:
        if cr.scenario_key == scenario.key:
            ks = tuple(dict.fromkeys(k for k in cr.priority if k in pool))[:slots]
            if len(ks) == slots:
                out.append(ks)
    return out


JUDGE_CANDIDATES = 30  # rotation-search candidates in a set comparison (the final search uses 200)


def _judge_sets(gd, build, scenario, cfg, budget, guide, sets, daevanion_points) -> tuple[str, ...]:
    """The best of `sets` by a short version of the whole plan (ranks bought, Daevanion planned, specialties chosen,
    a short rotation search): the quick score behind the stigma search cannot see what ranks, the Daevanion path and
    specialties add to a set, and a set can win the quick score and lose the plan. The first set wins ties."""
    jb = replace(budget, max_candidates=JUDGE_CANDIDATES, max_len=max(budget.max_len, 15))

    def plan(key: tuple[str, ...]):
        b = replace(build, stigmas=key)
        heur = _heuristic_priority(gd, b, scenario, budget, guide)
        if b.skill_points or b.stigma_points:
            b = replace(b, skill_ranks=allocate_points(gd, b, heur, scenario, cfg, skip_core=True)[0])  # core ranks do not differ by set
        cost = {n.id: n.cost for br in gd.daevanion.values() for n in br.nodes.values()}
        take, spent = [], 0
        for nid in plan_daevanion(gd, b, heur, scenario, cfg):
            if daevanion_points is not None and spent + cost[nid] > daevanion_points:
                break
            take.append(nid)
            spent += cost[nid]
        b = replace(b, daevanion_nodes=frozenset(b.daevanion_nodes) | frozenset(take))
        b = replace(b, specs=choose_specs(gd, b, heur, scenario, cfg))
        return b, _fast_eval(gd, b, scenario, cfg, jb, (heur,))

    planned = [plan(key) for key in sets]
    # The short search is noisy (a few %), so each set is also scored under every other set's rotation (what is
    # castable of it): the better of its own and borrowed rotations removes most of the search luck.
    pris = [p for _b, (_d, p, _r) in planned if p is not None]
    best = []
    for b, (d, _p, _r) in planned:
        castable = {e.skill_key for e in candidate_skills(gd, b)}
        for p in pris:
            q = Priority(tuple(e for e in p.entries if e.skill_key in castable), p.label)
            if q.entries:
                d = max(d, simulate(gd, b, q, scenario, cfg).dps)
        best.append(d)
    return sets[max(range(len(sets)), key=lambda i: (best[i], -i))]


def _optimize_stigmas(gd, build, scenario, cfg, budget, slots, progress, guide=None, start=(), rank_aware=True):
    """Greedy forward selection plus swap passes. Returns [(key, gain_pct)] in pick order. With `start` (the picks of an
    earlier pass) the forward selection is skipped and only the swaps run, scored against the `guide` rotation.
    A community set that scores better than the search's result replaces it. `rank_aware=False` is the plain search:
    candidates are scored at the build's own ranks with no specialty options, and no community set is tried."""
    pool = _stigma_pool(gd, build)
    cache: dict[tuple[str, ...], float] = {}
    plan_rank = _planned_stigma_rank(gd, build, slots) if rank_aware else 0

    option_memo: dict[tuple[str, int], tuple[int, ...]] = {}

    def tier_options(k: str, rank: int) -> tuple[int, ...]:
        """Best specialty options of stigma `k` at `rank`, chosen once with the stigma alone equipped (it is the
        stigma's own options that matter here, and choosing them per candidate set cost 4x the whole search)."""
        if (k, rank) not in option_memo:
            b1 = replace(build, stigmas=(k,), skill_ranks={**build.skill_ranks, k: rank})
            heur = _heuristic_priority(gd, b1, scenario, budget, guide)
            option_memo[(k, rank)] = choose_specs(gd, b1, heur, scenario, cfg, only={k}).get(k, ())
        return option_memo[(k, rank)]

    def score(picks: tuple[str, ...]) -> float:
        key = tuple(sorted(picks))
        if key not in cache:
            # Each candidate is valued at the rank its share of the stigma points would buy: a buff stigma left at
            # rank 1 is worth little, so scoring at the build's own ranks hid every stigma whose value is its rank.
            ranks = {**build.skill_ranks, **{k: max(plan_rank, build.skill_ranks.get(k, 1)) for k in key if plan_rank > 1}}
            b = replace(build, stigmas=key, skill_ranks=ranks)
            # ... with the specialty options its tiers open: a stigma's value is often a tier option (Corrode r20's
            # +15% damage taken), invisible to a score that equips none.
            specs = {k: o for k in key for o in [tier_options(k, ranks.get(k, 1))] if o} if rank_aware else {}
            cache[key] = _best_stigma_dps(gd, replace(b, specs={**b.specs, **specs}), scenario, cfg, budget, guide)
        return cache[key]

    picks: list[str] = list(start)
    gains: list[float] = []
    cur = score(tuple(picks)) if picks else score(())
    for slot in range(0 if picks else min(slots, len(pool))):
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
    for ks in _community_sets(gd, scenario, pool, slots) if rank_aware and len(picks) == slots else []:
        if score(ks) > cur * (1 + 1e-9):
            picks, cur = list(ks), score(ks)
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
VARIANT_BUDGET = SearchBudget(max_candidates=30)  # was 60: same picks on DarthThot; the main search stays 200 (100 cost Ranger 4% DPS)


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
    castable = {e.skill_key for e in candidate_skills(gd, build)}
    for p in extra:
        # another build's priority may name its own swapped-in stigma: drop what this build cannot cast, so the
        # priority we return only lists castable skills
        p = Priority(tuple(e for e in p.entries if e.skill_key in castable), p.label)
        if not p.entries:
            continue
        r = simulate(gd, build, p, sc, cfg)
        if r.dps > best[0]:
            best = (r.dps, p, r)
    return best


def _variants(gd, base_in, fb_build, picks, sc, cfg, max_dps, final_budget=VARIANT_BUDGET,
              max_priority: Priority | None = None):
    """Returns (variants, improved_max) where improved_max is (dps, priority, result) or None."""
    pool = _stigma_pool(gd, fb_build)
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
        return _best_stigma_dps(gd, b, sc, cfg, VARIANT_BUDGET)

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
        if vb.stigma_points:
            # Core ranks stay as the max build bought them; only the stigma points are spent again, on what is left
            # after the stigmas that stay keep what they were given (re-buying everything doubled the cost).
            kept = {k: v for k, v in fb_build.skill_ranks.items() if k != drop}
            if drop in base_in.skill_ranks:
                kept[drop] = base_in.skill_ranks[drop]
            left = vb.stigma_points - sum(
                sum(STIGMA_POINT_COST[base_in.skill_ranks.get(k, 1):fb_build.skill_ranks.get(k, 1)])
                for k in chosen if k != drop)
            ranks, _log = allocate_points(gd, replace(vb, skill_ranks=kept, skill_points=0, stigma_points=max(left, 0)),
                                          _heuristic_priority(gd, vb, sc, VARIANT_BUDGET), sc, cfg)
            vb = replace(vb, skill_ranks=ranks)
        elif vb.skill_points:
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


def _skill_node_gain(gd, build, priority, sc, cfg, key: str, base: float) -> float:
    """Per-node DPS gain of a Daevanion skill node for `key`: +1 rank each, so the value is the best average over
    taking 1..4 more nodes, counting the best newly unlocked specialty (rank 12/16/20 breakpoints are two to four
    nodes away, so a one-node look would see nothing)."""
    sk = gd.skills[key]
    have = daevanion_rank_bonus(gd, build, key)
    best = 0.0
    r0 = total_rank(gd, build, sk)
    for m in range(1, MAX_DAEVANION_RANK_BONUS - have + 1):
        b = replace(build, bonus_ranks={**build.bonus_ranks, key: build.bonus_ranks.get(key, 0) + m})
        r = total_rank(gd, b, sk)
        if r == r0:
            break  # at the region cap
        d = simulate(gd, b, priority, sc, cfg).dps
        for i in available_options(gd, sk, r):
            if i not in available_options(gd, sk, r0) and _matters(sk, i):
                d = max(d, simulate(gd, replace(b, specs={**b.specs, key: (i,)}), priority, sc, cfg).dps)
        best = max(best, (d - base) / m)
    return max(0.0, best)


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
                if n.skill_key and n.skill_key in gd.skills:
                    sig_gain[sig] = _skill_node_gain(gd, build, priority, sc, cfg, n.skill_key, base)
                else:
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


PLAN_ROUNDS = 2  # planning passes: the seed rotation, then once more against the searched rotation


def _plan_and_search(gd, build, sc, cfg, budget, slots, daevanion_points, progress, guide, say, prev=None) -> dict:
    """One planning pass: stigmas, skill/stigma points, Daevanion, specialties, then the rotation search and a final
    specialty re-choice. `guide` is the searched rotation of the previous pass and `prev` that pass's plan (None for
    the first pass); a repeat pass keeps the core skill ranks and, while the stigma set is unchanged, the Daevanion
    path of `prev`, so it only redoes what a status-gated rotation can change."""
    # 1. stigmas
    start = prev["b"].stigmas if prev else ()
    picks = _optimize_stigmas(gd, build, sc, cfg, budget, slots, progress, guide, start) if slots else []
    if picks and build.stigma_points and prev is None:  # first pass only: a repeat pass just swaps from these picks
        # The rank-aware search can lose a set the plain one finds (its planned ranks are an equal share, the real
        # purchase is not); when the two disagree the better of them by a short plan is used.
        plain = _optimize_stigmas(gd, build, sc, cfg, budget, slots, None, guide, start, rank_aware=False)
        mine, theirs = (tuple(sorted(k for k, _ in x)) for x in (picks, plain))
        if mine == theirs:
            picks = plain  # same set: keep the plain search's pick order, which breaks ties between equal ranks
        else:
            if progress:
                progress("Comparing stigma sets")
            if _judge_sets(gd, build, sc, cfg, budget, guide, [mine, theirs], daevanion_points) == theirs:
                picks = plain
    b = replace(build, stigmas=tuple(k for k, _ in picks))
    heur = _heuristic_priority(gd, b, sc, budget, guide)

    # 2. skill / stigma points
    rank_log: list[tuple[str, int, float]] = []
    if b.skill_points or b.stigma_points:
        say("Spending skill points")
        if prev:
            core = {k: r for k, r in prev["b"].skill_ranks.items()
                    if k in gd.skills and gd.skills[k].kind != SkillKind.STIGMA}
            ranks, rank_log = allocate_points(gd, replace(b, skill_ranks={**b.skill_ranks, **core}), heur, sc, cfg,
                                              skip_core=True)
            rank_log = [e for e in prev["rank_log"] if e[0] in core] + rank_log
        else:
            ranks, rank_log = allocate_points(gd, b, heur, sc, cfg)
        b = replace(b, skill_ranks=ranks)

    # 3. Daevanion: full ordered path; None = assume every point is spent (max power)
    say("Planning Daevanion")
    if prev and b.stigmas == prev["b"].stigmas:
        path = prev["path"]
    else:
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

    # 3b. specialties for the final ranks (Daevanion skill nodes raise ranks, which unlocks options)
    say("Choosing specialties")
    b = replace(b, specs=choose_specs(gd, b, heur, sc, cfg, progress))

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

    # 4b. re-choose specialties against the final rotation (step 3b used the seed priority, which can differ)
    chosen = choose_specs(gd, b, priority, sc, cfg)
    if chosen != b.specs:
        b = replace(b, specs=chosen)
        result = simulate(gd, b, priority, sc, cfg)
    return dict(b=b, picks=picks, rank_log=rank_log, path=path, take=take, dgain=dgain, priority=priority,
                result=result, budget=budget)


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

    # Steps 1-4b plan the build against a rotation. The first pass can only use the greedy seed rotation, but the
    # final rotation is searched, and casts gated on a status exist only there (a Corrode rank is worth 0% against the
    # seed and +9% against the searched rotation). When the searched rotation has such a cast, the plan is redone once
    # against it (PLAN_ROUNDS passes at most: every pass repeats the rotation search); the better pass is kept.
    slots = stigma_slots_at(gd, build.region, build.level)
    guide: Priority | None = None
    best_pass = None
    prev_sig = None
    for rnd in range(PLAN_ROUNDS):
        plan = _plan_and_search(gd, build, sc, cfg, budget, slots, daevanion_points, progress if rnd == 0 else None,
                                guide, say if rnd == 0 else (lambda _m: None), best_pass if rnd else None)
        if best_pass is None or plan["result"].dps > best_pass["result"].dps * (1 + 1e-9):
            best_pass = plan
        sig = (plan["b"].stigmas, tuple(sorted(plan["b"].skill_ranks.items())),
               tuple(sorted(plan["b"].specs.items())))
        if sig == prev_sig or not any(e.require_status for e in plan["priority"].entries):
            break  # stable, or the searched rotation has no status-gated cast the seed rotation could not see
        prev_sig, guide = sig, plan["priority"]
    plan = best_pass
    b, picks, rank_log, path, take, dgain = plan["b"], plan["picks"], plan["rank_log"], plan["path"], plan["take"], plan["dgain"]
    priority, result, budget = plan["priority"], plan["result"], plan["budget"]

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
    sp = spec_picks(gd, b, priority, sc, cfg)
    if any(p.dps_gain_pct <= 1e-9 for p in sp):
        # specialties were chosen against the seed priority; drop options the final rotation gets nothing from
        useful = {(p.skill_key, p.option) for p in sp if p.dps_gain_pct > 1e-9}
        kept = {k: tuple(i for i in opts if (k, i) in useful) for k, opts in b.specs.items()}
        b = replace(b, specs={k: v for k, v in kept.items() if v})
        sp = spec_picks(gd, b, priority, sc, cfg)
    if any(p.confidence == "unknown" for p in sp):
        warnings.append("A chosen specialty has an unknown value.")
    return FullBuild(
        style, b, tuple(picks), tuple(rank_log), tuple(path), dgain, priority, result, gains,
        tuple(dict.fromkeys(warnings)), variants, sp,
    )


def compare_playstyles(gd, build, daevanion_points=None, cfg=SimConfig(), progress=None) -> dict[str, FullBuild]:
    out = {}
    for p in PLAYSTYLES:
        if progress:
            progress(f"{p.name}...")
        out[p.key] = optimize_full_build(gd, build, p.key, daevanion_points, cfg, progress=progress)
    return out
