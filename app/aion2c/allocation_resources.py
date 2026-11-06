"""Allocation purchase-cost inventory, distinct from a verified refund wallet."""
from aion2c.models import STIGMA_POINT_COST, SKILL_POINT_COST, CharacterBuild, GameData, SkillKind, rank_owner
from aion2c.progression import rank_gate, rank_levels, stigma_unlock


def inspect_allocations(gd: GameData, build: CharacterBuild) -> dict:
    rank_cost = {"skill": 0, "stigma": 0}
    issues = []
    for key, rank in build.skill_ranks.items():
        if rank == 0:
            continue
        skill = gd.skills.get(key)
        if skill is None:
            rank_cost = {"skill": None, "stigma": None}
            issues.append(f"{key}: skill and point currency are unknown.")
            continue
        if rank_owner(gd, skill) is not None:
            continue
        stigma = skill.kind == SkillKind.STIGMA
        pool, costs = ("stigma", STIGMA_POINT_COST) if stigma else ("skill", SKILL_POINT_COST)
        gate = rank_gate(skill, rank)
        if rank < 0:
            rank_cost[pool] = None
            issues.append(f"{key}: a negative rank is not purchased investment.")
        elif stigma and not stigma_unlock(gd, build).unlocked:
            rank_cost[pool] = None
            issues.append(f"{key}: stigma system is not unlocked.")
        elif build.region != "global":
            rank_cost[pool] = None
            issues.append(f"{key}: Global acquisition data does not establish costs for {build.region}.")
        elif rank_levels(skill) is None or gate is None:
            rank_cost[pool] = None
            issues.append(f"{key}: no paid acquisition evidence is available.")
        elif gate is not None and gate > build.level:
            rank_cost[pool] = None
            issues.append(f"{key}: rank {rank} is above the character's acquisition level.")
        elif rank > len(costs):
            rank_cost[pool] = None
            issues.append(f"{key}: paid rank cost is unknown for rank {rank}; reported bonuses are not purchases.")
        elif rank_cost[pool] is not None:
            rank_cost[pool] += sum(costs[:rank])
    node_cost = {"daevanion": 0, "battle": 0}
    node_index = {node.id: (node, board.currency)
                  for board in gd.daevanion.values() for node in board.nodes.values()}
    for node_id in build.daevanion_nodes:
        info = node_index.get(node_id)
        if info is None:
            node_cost = {"daevanion": None, "battle": None}
            issues.append(f"Daevanion node {node_id}: cost and currency are unknown.")
            continue
        node, currency = info
        if node_cost[currency] is not None:
            node_cost[currency] += node.cost
    from aion2c.daevanion import valid
    for board in gd.daevanion.values():
        selected = build.daevanion_nodes.intersection(board.nodes)
        if selected and build.region != "global":
            node_cost[board.currency] = None
            issues.append(f"{board.key}: Global board data does not establish costs for {build.region}.")
        if selected and board.unlock_level > build.level:
            node_cost[board.currency] = None
            issues.append(f"{board.key}: nodes need character level {board.unlock_level}.")
        if not valid(board, selected):
            node_cost[board.currency] = None
            issues.append(f"{board.key}: selected nodes are not connected to the start.")
    unspent = {}
    for pool, value in (("skill", build.skill_points), ("stigma", build.stigma_points)):
        if value is None or (type(value) is int and value >= 0):
            unspent[pool] = value
        else:
            unspent[pool] = None
            issues.append(f"Unspent {pool} points are invalid; their amount is unknown.")
    return {
        "rank_cost": rank_cost,
        "node_cost": node_cost,
        "unspent": unspent,
        "refunds": {"status": "unverified", "skill": None, "stigma": None,
                    "daevanion": None, "battle": None},
        "reset_cost": {"amount": None, "currency": None, "basis": "unverified"},
        "issues": issues,
    }
