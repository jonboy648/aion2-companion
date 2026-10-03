"""Daevanion planner logic (P8).

Rule (orthogonal-adjacency, from the aion2t planner code, medium-high confidence): a node is
selectable iff any id in its `adjacent` is the board's start node or an already selected node.

CIRCULAR IMPORT RULE: see aion2c/engine/simulator.py. The `simulate` import stays at the BOTTOM
of this file, after `apply_stats` is defined.
"""
import dataclasses
import heapq

from aion2c.models import (
    STAT_MAP,
    CharacterBuild,
    DaevanionBoard,
    DaevanionNode,
    GameData,
    Priority,
    Scenario,
    SimConfig,
    Stats,
)

SKILL_BONUS_CAP = 4  # Daevanion adds at most +4 ranks per skill (mastery_stigma.md)


def selectable(board: DaevanionBoard, selected: frozenset[int]) -> set[int]:
    """Unselected, non-start nodes with at least one neighbour that is the start or selected."""
    out: set[int] = set()
    for nid, node in board.nodes.items():
        if nid == board.start_id or nid in selected:
            continue
        if any(a == board.start_id or a in selected for a in node.adjacent):
            out.add(nid)
    return out


def valid(board: DaevanionBoard, selected: frozenset[int]) -> bool:
    """True iff every selected node (of this board) is connected to the start via selected nodes."""
    mine = {n for n in selected if n != board.start_id}
    if any(n not in board.nodes for n in mine):
        return False
    reached: set[int] = set()
    grew = True
    while grew:
        grew = False
        for n in mine - reached:
            if any(a == board.start_id or a in reached for a in board.nodes[n].adjacent):
                reached.add(n)
                grew = True
    return reached == mine


def _node_index(gd: GameData) -> dict[int, DaevanionNode]:
    idx: dict[int, DaevanionNode] = {}
    for b in gd.daevanion.values():
        idx.update(b.nodes)
    return idx


def points_spent(gd: GameData, selected: frozenset[int]) -> int:
    idx = _node_index(gd)
    return sum(idx[n].cost for n in selected if n in idx)


def apply_stats(gd: GameData, build: CharacterBuild) -> Stats:
    """build.stats plus every selected node's mapped effects. Unknown-mapped stats add nothing."""
    idx = _node_index(gd)
    add: dict[str, float] = {}
    for n in build.daevanion_nodes:
        node = idx.get(n)
        if node is None:
            continue
        for e in node.effects:
            field, mult, _conf = STAT_MAP.get(e.stat, ("", 0.0, "unknown"))
            if field:
                add[field] = add.get(field, 0.0) + e.value * mult
    if not add:
        return build.stats
    return dataclasses.replace(build.stats, **{k: getattr(build.stats, k) + v for k, v in add.items()})


def skill_bonus(gd: GameData, selected: frozenset[int]) -> dict[str, int]:
    """Selected skill nodes per skill key, capped at +4."""
    idx = _node_index(gd)
    out: dict[str, int] = {}
    for n in selected:
        node = idx.get(n)
        if node and node.skill_key:
            out[node.skill_key] = min(SKILL_BONUS_CAP, out.get(node.skill_key, 0) + 1)
    return out


def is_pvp_only(node: DaevanionNode) -> bool:
    return bool(node.effects) and all(e.stat.startswith("PvP") for e in node.effects)


def _relevant(node: DaevanionNode) -> bool:
    """Can this node change simulated DPS at all?"""
    return bool(node.skill_key) or any(STAT_MAP.get(e.stat, ("",))[0] for e in node.effects)


def suggest_path(
    gd: GameData,
    build: CharacterBuild,
    priority: Priority,
    scenario: Scenario,
    points: int,
    board_keys: list[str] | None = None,
    cfg: SimConfig = SimConfig(),
) -> tuple[list[int], float]:
    """Greedy: add the selectable node with best DPS gain per point; ties by lower id.

    When no directly selectable node helps (e.g. only HP/MP next to the start), fall back to the
    best valuable node reachable through bridge nodes and add the whole path.
    Returns (new node ids in pick order, total DPS gain %).
    """
    boards = [
        b for k, b in gd.daevanion.items()
        if b.unlock_level <= build.level and (board_keys is None or k in board_keys)
    ]
    idx = _node_index(gd)
    selected = set(build.daevanion_nodes)

    def dps(nodes: set[int]) -> float:
        # Stat effects are baked into Stats here and only skill nodes stay on the build, so the
        # real simulator (which calls apply_stats itself) never counts a stat node twice.
        fs = frozenset(nodes)
        skill_only = frozenset(n for n in fs if n in idx and idx[n].skill_key)
        stats = apply_stats(gd, dataclasses.replace(build, daevanion_nodes=fs))
        return simulate(gd, dataclasses.replace(build, stats=stats, daevanion_nodes=skill_only),
                        priority, scenario, cfg).dps

    def ok(node: DaevanionNode, cur: set[int]) -> bool:
        if is_pvp_only(node):
            return False
        if node.skill_key and skill_bonus(gd, frozenset(cur)).get(node.skill_key, 0) >= SKILL_BONUS_CAP:
            return False
        return True

    base = cur_dps = dps(selected)
    remaining = points
    path: list[int] = []
    while remaining > 0:
        best = None  # (gain per point, -id, node ids to add, new dps)
        for b in boards:
            for nid in sorted(selectable(b, frozenset(selected))):
                n = b.nodes[nid]
                if n.cost > remaining or not _relevant(n) or not ok(n, selected):
                    continue
                d = dps(selected | {nid})
                gain = d - cur_dps
                if gain > 1e-12:
                    cand = (gain / max(n.cost, 1), -nid, [nid], d)
                    if best is None or cand[:2] > best[:2]:
                        best = cand
        if best is None:
            best = _bridge(boards, selected, remaining, cur_dps, dps, ok)
        if best is None:
            break
        for i in best[2]:
            selected.add(i)
            path.append(i)
            remaining -= idx[i].cost
        cur_dps = best[3]
    gain_pct = (cur_dps / base - 1.0) * 100.0 if base > 0 else 0.0
    return path, gain_pct


def _bridge(boards, selected, remaining, cur_dps, dps, ok):
    """Best valuable target (gain per path point) reached through unselected nodes (Dijkstra)."""
    best = None
    for b in boards:
        dist: dict[int, int] = {}
        prev: dict[int, int | None] = {}
        heap: list[tuple[int, int]] = []
        for nid in selectable(b, frozenset(selected)):
            n = b.nodes[nid]
            if not is_pvp_only(n):
                dist[nid], prev[nid] = n.cost, None
                heapq.heappush(heap, (n.cost, nid))
        while heap:
            d, u = heapq.heappop(heap)
            if d > dist.get(u, 1 << 30) or d > remaining:
                continue
            for v in b.nodes[u].adjacent:
                nv = b.nodes.get(v)
                if nv is None or v in selected or v == b.start_id or is_pvp_only(nv):
                    continue
                if d + nv.cost < dist.get(v, 1 << 30):
                    dist[v], prev[v] = d + nv.cost, u
                    heapq.heappush(heap, (d + nv.cost, v))
        for tid, cost in sorted(dist.items()):
            t = b.nodes[tid]
            if cost > remaining or not _relevant(t) or not ok(t, selected):
                continue
            chain: list[int] = []
            u: int | None = tid
            while u is not None:
                chain.append(u)
                u = prev[u]
            chain.reverse()
            d_new = dps(selected | set(chain))
            gain = d_new - cur_dps
            if gain > 1e-12:
                cand = (gain / max(cost, 1), -tid, chain, d_new)
                if best is None or cand[:2] > best[:2]:
                    best = cand
    return best


from aion2c.engine.simulator import simulate  # noqa: E402,F401  (bottom on purpose, patch target)
