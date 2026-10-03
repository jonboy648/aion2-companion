"""Offline sanity check for the Cleric research files. Run: python validate.py  (exit 1 on any failure)."""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ICONS = HERE.parents[2] / "assets" / "icons" / "cleric"
load = lambda p: json.loads(Path(p).read_text(encoding="utf-8"))
errs = []


def check(cond, msg):
    if not cond:
        errs.append(msg)


skills = load(HERE / "skills.json")
idx = load(ICONS / "index.json")
mech, chains = load(HERE / "mechanics.json"), load(HERE / "chains.json")
rots, road, dv = load(HERE / "community_rotations.json"), load(HERE / "roadmap.json"), load(HERE / "daevanion.json")

ids = [s["skill_id"] for s in skills if s["skill_id"] is not None]
check(len(skills) == 44 and len(ids) == 40 and len(set(ids)) == 40, "expected 44 entries, 40 unique ids")
check({s["category"] for s in skills} >= {"active", "passive", "stigma", "basic_dodge"}, "categories")
check(sum(s["category"] == "stigma" for s in skills) == 13, "13 stigmas")
check(all(len(s["per_level"]) == s["max_skill_level"] for s in skills if s["skill_id"]), "per_level length == max rank")
check(set(int(v["skill_id"]) for v in idx.values()) == set(ids), "icon index covers every id")
check(all((ICONS / f"{k}.png").is_file() for k in idx), "icon files exist")
names = {s["name"] for s in skills}
by_id = {s["skill_id"] for s in skills if s["skill_id"]}
for ln in chains["links"]:
    check(ln["parent"] in by_id, f"chain parent {ln['parent']}")
    check(ln["child"] in by_id or ln["child"] in names, f"chain child {ln['child']}")
keys = set(idx) | {"bolt-level-1", "bolt-level-2", "bolt-max", "earths-blessing"}
for r in mech["rules"].values():
    check(r["skill_key"] in keys, f"rule skill {r['skill_key']}")
    check(all(x in mech["statuses"] for x in r["applies"] + r["requires"]), f"rule statuses {r['skill_key']}")
for k in mech["skill_tags"]:
    check(k in keys, f"tag key {k}")
check("manual" in {t for v in mech["skill_tags"].values() for t in v}, "manual tag present")


def walk_num(o, path=""):
    if isinstance(o, dict):
        if "confidence" in o and "source" in o and "value" in o:
            check(o["confidence"] in ("confirmed", "estimated", "unknown"), f"confidence at {path}")
            check(o["value"] is not None or o["confidence"] == "unknown", f"null value must be unknown at {path}")
        for k, v in o.items():
            walk_num(v, f"{path}/{k}")
    elif isinstance(o, list):
        for i, v in enumerate(o):
            walk_num(v, f"{path}[{i}]")


walk_num(mech["statuses"], "statuses")
walk_num(mech["rules"], "rules")
for r in rots:
    check(all(k in keys for k in r["priority"]), f"rotation {r['key']} keys")
check(len(dv["boards"]) == 5 and sum(len(b["nodes"]) for b in dv["boards"]) == 537, "5 boards, 537 nodes")
for b in dv["boards"]:
    n = {x["id"]: x for x in b["nodes"]}
    check(all(a in n and x["id"] in n[a]["adjacent"] for x in n.values() for a in x["adjacent"]), f"{b['key']} adjacency symmetric")
    check(all(int(x["skill_id"]) in by_id for x in n.values() if x["skill_id"]), f"{b['key']} skill ids known")
check(dv["board_total_points"] == 802, "802 points")
check(len(road) > 20, "roadmap populated")
print("FAIL" if errs else "OK", len(skills), "skills,", len(idx), "icons,", len(dv["boards"]), "boards")
for e in errs:
    print(" -", e)
sys.exit(1 if errs else 0)
