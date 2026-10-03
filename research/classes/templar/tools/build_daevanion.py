"""Build daevanion.json (Sorcerer schema) from raw/aion2t_boards.json (aion2t.com/daevanion?job=3 embedded data)."""
import collections, json, re
R = "D:/Aion2/research/classes/templar"
boards = json.load(open(f"{R}/raw/aion2t_boards.json", encoding="utf-8"))
RAR = {1: "Common", 2: "Rare", 3: "Epic", 4: "Unique"}
COST = {"Common": 1, "Rare": 2, "Epic": 3, "Unique": 4}
TYPE = {1: "start", 2: "stat", 3: "skill"}
out_boards = []
for b in boards:
    cells = {(n["pos_x"], n["pos_y"]): n for n in b["nodes"]}
    xs = [p[0] for p in cells]; ys = [p[1] for p in cells]
    nodes, stat_sum, skill_sum = [], collections.OrderedDict(), collections.OrderedDict()
    start_id = None
    for n in b["nodes"]:
        t = TYPE[n["node_type"]]
        rar = RAR.get(n["grade"]) if t != "start" else None
        effs = []
        for e in n["effects"]:
            pct = e.get("isPercent")
            effs.append({"stat": e["name"], "value": (e["value"] / 100 if pct else e["value"]),
                         "unit": "%" if pct else "flat", "raw_value": e["value"]})
        if t == "skill":
            effs = [{"stat": n["skill_name"], "value": 1, "unit": "flat", "raw_value": 1}]
        adj = [cells[(n["pos_x"] + dx, n["pos_y"] + dy)]["id"]
               for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)) if (n["pos_x"] + dx, n["pos_y"] + dy) in cells]
        cost = COST[rar] if rar else 0
        if t == "start":
            start_id = n["id"]
        if t == "stat":
            for e in effs:
                k = f"{e['stat']} [{e['unit']}]"
                stat_sum[k] = round(stat_sum.get(k, 0) + e["value"], 4)
        if t == "skill":
            skill_sum[n["skill_name"]] = skill_sum.get(n["skill_name"], 0) + 1
        nodes.append({
            "id": n["id"], "name": n["name"] if t != "start" else f"{b['name']} - Start", "node_type": t,
            "rarity": rar, "cost": cost, "description": n["description"], "effects": effs,
            "skill_key": re.sub(r"[^a-z0-9]+", "_", n["skill_name"].lower()).strip("_") if t == "skill" else None,
            "skill_name": n["skill_name"] if t == "skill" else None,
            "skill_id": n["skill_id"] if t == "skill" else None,
            "adjacent": adj, "x": n["pos_x"], "y": n["pos_y"], "code": n["code"]})
    out_boards.append({
        "key": b["name"].lower(), "name": b["name"], "unlock_level": b["required_level"], "board_id": b["id"],
        "grid": {"min_x": min(xs), "max_x": max(xs), "min_y": min(ys), "max_y": max(ys)},
        "selectable_nodes": len(nodes) - 1, "total_cost": sum(n["cost"] for n in nodes),
        "start_node_id": start_id, "sum_of_stat_nodes": dict(stat_sum),
        "skill_levels_granted_if_all": dict(skill_sum),
        "completion_buff": {"name": f"Daevanion {b['name']} Effects", "effects": None,
                            "note": "name only (metaroad); numeric values not captured"},
        "nodes": nodes})
doc = {
    "game": "Aion 2", "class": "templar", "boards": out_boards,
    "rules": {
        "adjacency": "Orthogonal 4-neighbour on (x,y) grid; a node is selectable iff a neighbour is the start node or already selected. Deselecting must not orphan selected nodes. Source: aion2t.com planner logic as read for the Sorcerer file (same site, same engine); not re-verified for Templar.",
        "start_node": "Centre of each grid; free, cost 0, not selectable.",
        "cost_by_rarity": COST,
        "board_unlock_levels": {b["name"].lower(): b["required_level"] for b in boards},
        "reset_cost": {"value": 500, "unit": "kinah per node", "region": "Korea (launch notes 2025-11-19)",
                       "confidence": "low: copied from the Sorcerer file (one-line patch note), Global unverified"},
        "skill_level_note": "Daevanion adds up to +4 skill levels per prior notes; per-board grant above is sum of skill nodes."},
    "board_total_points": sum(b["total_cost"] for b in out_boards),
    "point_sources": [
        {"source": "Daevanion Crystal pool (Metaroad)",
         "detail": "Metaroad: boards Nezekan..Triniel ask 570 of 840 DaevanionCrystal; Azphel asks 232 of 232 BattleCrystal (separate pool; aion2t marks Azphel board_type 3 vs 1)",
         "region": "KR/TW datamine as shown by Metaroad 2026-10-03", "confidence": "medium (single source, pool sizes unverified in game)"},
        {"source": "Sealed Dungeons",
         "detail": "2 Daevanion Crystals per clear; 61 per faction map = 122 points per full clear (copied from the Sorcerer file)",
         "region": "Global (metabot via game_ui_and_progression.md)", "confidence": "medium, secondhand"}],
    "global_vs_korea": {
        "templar_boards_in_data": len(out_boards),
        "note": "aion2t returns 5 Templar boards (display_order 1,2,3,4,6; order 5 absent, board id 5 absent), same as Sorcerer. Metaroad also shows 5. Unresolved whether more boards exist or are KR-only.",
        "data_region": "aion2t.com says data from the official NCSOFT API (likely Korea); Global launch 2026-10-05 not yet verified."},
    "source_urls": ["https://aion2t.com/daevanion?job=3", "https://metaroad.gg/aion2/database/daevanion/templar"],
    "fetched_at": "2026-10-03"}
json.dump(doc, open(f"{R}/daevanion.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
tot = sum(len(b["nodes"]) for b in out_boards)
print(len(out_boards), "boards", tot, "nodes", doc["board_total_points"], "points")
for b in out_boards:
    print(b["key"], b["board_id"], b["unlock_level"], len(b["nodes"]), b["total_cost"], b["sum_of_stat_nodes"], b["skill_levels_granted_if_all"])
