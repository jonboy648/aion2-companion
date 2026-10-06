"""Split items.json into the small files the item database pages load (web/public/items/).

    python -m aion2c.data.build_itemdb          (from app/; also run by web/scripts/bundle_engine.py)

Output, all minified JSON of our own derived numbers:
  index.json            categories (group / key / label / count), id -> category runs, source. Small: the web app bundles it.
  cat/<key>.json        {"cat", "items": [slim rows]}: what lists, the gear viewer and compare need (main stats, roll maxima).
  detail/<key>.json     {"cat", "items": {id: full item}, "enchant": {series, odds, exceed}}: one fetch per detail page,
                        with only the enchant / exceed tables that category's items use.
Slim row keys: id, n name, g grade, il item level, el equip level, i icon resource name, c class lock, m main stats
{stat: value}, mn min attack (weapons), p {stat: max roll} for the few random-line stats worth a table column.
"""
from __future__ import annotations

import json
from pathlib import Path

DATA = Path(__file__).parent
ROOT = DATA.parents[2]
OUT = ROOT / "web" / "public" / "items"

# group, key, label, slot, class_lock (None = any). Order is display order.
CATEGORIES = [
    ("weapons", "sword", "Sword", "weapon", "Templar"),
    ("weapons", "dagger", "Dagger", "weapon", "Assassin"),
    ("weapons", "mace", "Mace", "weapon", "Cleric"),
    ("weapons", "greatsword", "Greatsword", "weapon", "Gladiator"),
    ("weapons", "staff", "Staff", "weapon", "Chanter"),
    ("weapons", "bow", "Bow", "weapon", "Ranger"),
    ("weapons", "spellbook", "Spellbook", "weapon", "Sorcerer"),
    ("weapons", "orb", "Orb", "weapon", "Spiritmaster"),
    ("weapons", "gauntlet", "Gauntlet", "weapon", "Fighter"),
    ("weapons", "guard", "Guard", "offhand", None),
    ("armor", "helmet", "Helmet", "helmet", None),
    ("armor", "shoulder", "Shoulder", "shoulder", None),
    ("armor", "torso", "Torso", "torso", None),
    ("armor", "pants", "Pants", "legs", None),
    ("armor", "gloves", "Gloves", "gloves", None),
    ("armor", "cape", "Cape", "cape", None),
    ("armor", "boots", "Boots", "boots", None),
    ("accessories", "ring", "Ring", "ring", None),
    ("accessories", "earring", "Earring", "earring", None),
    ("accessories", "necklace", "Necklace", "necklace", None),
    ("accessories", "bracelet", "Bracelet", "bracelet", None),
    ("equipment", "belt", "Belt", "belt", None),
    ("equipment", "amulet", "Amulet", "amulet", None),
    ("equipment", "rune", "Rune", "rune", None),
    ("arcana", "arcana", "Arcana", "arcana", None),
]
GROUPS = {"weapons": "Weapons", "armor": "Armor", "accessories": "Accessories", "equipment": "Equipment", "arcana": "Arcana"}
# Random-line stats that get a gear viewer column (value = the best the line can roll on that item).
ROLL_STATS = ("AmplifyAllDamage", "AmplifyWeaponDamage", "CombatSpeed", "CriticalAddDamage", "AdditionalHitRate", "AbnormalAccuracy")

_BY_SLOT = {}
for _g, _k, _l, _slot, _cls in CATEGORIES:
    _BY_SLOT.setdefault(_slot, []).append((_k, _cls))


def category_of(item: dict) -> str | None:
    """Category key of an items.json item: its slot, split by class lock for weapons."""
    options = _BY_SLOT.get(item["slot"], [])
    if len(options) == 1:
        return options[0][0]
    lock = (item.get("class_lock") or [None])[0]
    return next((k for k, cls in options if cls == lock), None)


def slim(item: dict) -> dict:
    m = {s["id"]: s["v"] for s in item["main"]}
    row = {"id": item["id"], "n": item["name"], "g": item["grade"], "il": item["il"], "el": item["equip_level"]}
    if item.get("icon"):
        row["i"] = item["icon"]
        if item.get("icon_alt"):
            row["i2"] = item["icon_alt"]
    if item.get("class_lock"):
        row["c"] = item["class_lock"][0]
    row["m"] = m
    atk = next((s for s in item["main"] if s["id"] == "WeaponFixingDamage"), None)
    if atk and "min" in atk:
        row["mn"] = atk["min"]
    pool = {}
    for s in item["subs"]:
        if s["id"] in ROLL_STATS:
            pool[s["id"]] = max(s["v"], pool.get(s["id"], 0))
    if pool:
        row["p"] = pool
    return row




# Non-equipment items (items_other.json): group, key, label, client type, client categories (None = every other category of that type)
OTHER_CATEGORIES = [
    ("consumables", "potion", "Potions", "Usable", ("Potion",)),
    ("consumables", "food", "Food and drink", "Usable", ("Food", "Drink")),
    ("consumables", "scroll", "Scrolls", "Usable", ("Scroll", "TeleportScroll", "QuestScroll", "Polymorph", "PetPolymorph", "SetupKisk")),
    ("consumables", "enhancement", "Stones and upgrades", "Usable",
     ("MagicStone", "GetGodstone", "SealStone", "SoulAdd", "Surpass", "Succession", "Extension", "Rebirth")),
    ("consumables", "box", "Boxes and packs", "Usable", ("RewardBox", "KinaBox", "GetArcana")),
    ("consumables", "ticket", "Tickets and passes", "Usable",
     ("AddContentsTicketCount", "AddContentsTicketTime", "BattlePass", "Subscribe", "MonolithAllClear", "SealAllClear",
      "OccupationTerritoryAllClear", "GetPoint", "GetGameCash", "AscensionGrade", "CharacterSlotUnlock")),
    ("consumables", "cosmetic", "Cosmetics and mounts", "Usable",
     ("SkinShop", "GetWing", "Deco", "Customize", "VehicleSoul", "VehicleSoulCrystal", "GetSocialAction", "SkinExtraction")),
    ("consumables", "title", "Titles", "Usable", ("GetTitle",)),
    ("consumables", "usable-other", "Other consumables", "Usable", None),
    ("misc", "material", "Crafting materials", "Misc", ("CraftResource", "GatherResource", "Material", "ArcanaMaterial", "CreateArcanaMaterial")),
    ("misc", "conversion", "Conversion materials", "Misc", ("ConversionResource", "ConversionResource_Special", "Elevate", "SkinCombine")),
    ("misc", "misc-other", "Other misc items", "Misc", None),
    ("misc", "currency", "Currency", "Currency", None),
]
OTHER_KEYS = [k for _, k, *_ in OTHER_CATEGORIES]
GROUPS = {**GROUPS, "consumables": "Consumables", "misc": "Misc", "sets": "Item sets"}
OTHER_GROUPS = ("consumables", "misc")


def other_category_of(item: dict) -> str:
    fallback = None
    for _, key, _, typ, cats in OTHER_CATEGORIES:
        if typ != item["type"]:
            continue
        if cats is None:
            fallback = key
        elif item["cat"] in cats:
            return key
    if fallback is None:
        raise ValueError(f"item {item['id']} ({item['type']}/{item['cat']}) has no category")
    return fallback


def slim_other(item: dict) -> dict:
    row = {"id": item["id"], "n": item["n"], "g": item["g"], "el": item["lv"]}
    if item.get("i"):
        row["i"] = item["i"]
    if item.get("d"):
        row["d"] = item["d"]
    return row


def build_sets(doc: dict, categories: dict[int, str]) -> dict:
    """sets.json: every set with its bonuses and member items (id, name, grade, icon, category)."""
    items = {i["id"]: i for i in doc["items"]}
    out = []
    for key, s in doc.get("sets", {}).items():
        members = []
        for iid in s["items"]:
            it = items[iid]
            m = {"id": iid, "n": it["name"], "g": it["grade"], "cat": categories[iid]}
            if it.get("icon"):
                m["i"] = it["icon"]
            members.append(m)
        out.append({"key": key, "name": s["name"], "icon": s["icon"], "type": s["type"], "bonuses": s["bonuses"], "items": members})
    return {"sets": out}


def build(doc: dict, other: dict | None = None) -> dict[str, object]:
    """{relative path: JSON-able object} for the whole item database. `other` is items_other.json (optional)."""
    by_cat: dict[str, list[dict]] = {k: [] for _, k, *_ in CATEGORIES}
    cat_of_id: dict[int, str] = {}
    for it in sorted(doc["items"], key=lambda x: x["id"]):
        cat = category_of(it)
        if cat is None:
            raise ValueError(f"item {it['id']} ({it['slot']}, {it.get('class_lock')}) has no category")
        by_cat[cat].append(it)
        cat_of_id[it["id"]] = cat
    by_other: dict[str, list[dict]] = {k: [] for k in OTHER_KEYS}
    for it in sorted((other or {}).get("items", []), key=lambda x: x["id"]):
        if it["id"] in cat_of_id:
            raise ValueError(f"item id {it['id']} is both gear and non-gear")
        key = other_category_of(it)
        by_other[key].append(it)
        cat_of_id[it["id"]] = key
    files: dict[str, object] = {}
    runs: list[list] = []  # [first id, last id, category] over every id, sorted
    for iid in sorted(cat_of_id):
        cat = cat_of_id[iid]
        if runs and runs[-1][2] == cat:
            runs[-1][1] = iid
        else:
            runs.append([iid, iid, cat])
    for _, key, *_ in CATEGORIES:
        items = by_cat[key]
        files[f"cat/{key}.json"] = {"cat": key, "items": [slim(i) for i in items]}
        series, odds, exceed = {}, {}, {}
        for i in items:
            if i.get("enchant_group"):
                series[i["enchant_group"]] = doc["enchant_series"][i["enchant_group"]]
            if i.get("odds_group"):
                odds[i["odds_group"]] = doc["enchant_odds"][i["odds_group"]]
            if i.get("exceed_group"):
                exceed[i["exceed_group"]] = doc["exceed"][i["exceed_group"]]
        files[f"detail/{key}.json"] = {
            "cat": key,
            "items": {str(i["id"]): {k: v for k, v in i.items() if k != "slope_known"} for i in items},
            "enchant": {"series": series, "odds": odds, "exceed": exceed},
        }
    for key in OTHER_KEYS:  # no detail file: the rows already carry everything a non-gear item has
        files[f"cat/{key}.json"] = {"cat": key, "kind": "misc", "items": [slim_other(i) for i in by_other[key]]}
    groups = [{"key": g, "label": GROUPS[g], "kind": "gear", "cats": [
        {"key": k, "label": label, "count": len(by_cat[k])} for gg, k, label, *_ in CATEGORIES if gg == g]} for g in GROUPS if g in
        {c[0] for c in CATEGORIES}]
    if other:
        groups += [{"key": g, "label": GROUPS[g], "kind": "misc", "cats": [
            {"key": k, "label": label, "count": len(by_other[k])} for gg, k, label, *_ in OTHER_CATEGORIES if gg == g]} for g in OTHER_GROUPS]
    sets = build_sets(doc, cat_of_id)
    if sets["sets"]:
        files["sets.json"] = sets
        groups.append({"key": "sets", "label": GROUPS["sets"], "kind": "sets", "cats": [], "count": len(sets["sets"])})
    files["index.json"] = {"schema": 1, "source": doc.get("source", ""), "groups": groups, "runs": runs}
    return files


def write(doc: dict, out: Path = OUT, other: dict | None = None) -> dict[str, int]:
    """Write every file under `out` (stale files removed); returns {path: bytes}."""
    files = build(doc, other)
    sizes = {}
    for rel, obj in files.items():
        p = out / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
        sizes[rel] = p.stat().st_size
    for p in out.rglob("*.json"):
        if p.relative_to(out).as_posix() not in files:
            p.unlink()
    return sizes


def main() -> None:
    doc = json.loads((DATA / "items.json").read_text(encoding="utf-8"))
    other_path = DATA / "items_other.json"
    other = json.loads(other_path.read_text(encoding="utf-8")) if other_path.is_file() else None
    sizes = write(doc, other=other)
    total = lambda prefix: sum(v for k, v in sizes.items() if k.startswith(prefix))  # noqa: E731
    n_other = len(other["items"]) if other else 0
    print(f"itemdb: {len(doc['items'])} gear + {n_other} other items, index {sizes['index.json']} B, sets {sizes.get('sets.json', 0)} B, "
          f"cat/ {total('cat/')} B, detail/ {total('detail/')} B -> {OUT}")


if __name__ == "__main__":
    main()
