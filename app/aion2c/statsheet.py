"""Character stat sheet with a per-source breakdown. Qt-free; the only caller is webapi.stat_sheet.

Pipeline (the order the game's own sheet uses, as read from a competitor's published client code, see
research/questlog_comparison_2026-10-05.md section 6.3 F1; the numbers come from our client export):
  1. collect every source into {stat: [entries]}: base level stats, gear (main, enchant, Exceed, fixed lines, random
     lines at their expected value), Daevanion boards, wings, equipped titles, arcana pieces;
  2. derived pass: each primary stat (six attributes and the deity stats) is floored, clamped to the table's 1000 rows and
     turned into secondary stats (`PcStatSecond`: exactly linear, 1 point = 0.1% for the percent lines);
  3. ratio pass (Amp Ratio): `extra = base_total * ratio_% / 100`, once, onto the target stats of RATIO_TARGETS.
Values are display units (a percent stat is in percent points). Nothing here changes the DPS engine.

What the public armory does NOT give us (so the sheet is a reconstruction, not the game's own sheet): the real random
sub-stat lines, magic and god stones, soulbind lines, pets, skin and pantheon/monolith/collection stats, and the deity
points that come from them. See NOT_INCLUDED, which the result repeats to the UI.
"""
from __future__ import annotations

import json
import math
import re
from functools import lru_cache
from pathlib import Path

from aion2c import gear

DATA_PATH = Path(__file__).parent / "data" / "stat_sheet.json"

ATTRIBUTES = ("STR", "DEX", "INT", "CON", "AGI", "WIS")
DEITIES = ("Justice", "Freedom", "Illusion", "Life", "Time", "Light", "Destruction", "Death", "Wisdom", "Destiny",
           "Space", "Dark")
PRIMARY = ATTRIBUTES + DEITIES
# Amp Ratio stat -> the stats whose all-source total it scales (research doc F1 step 5; not derivable from the export).
RATIO_TARGETS = {
    "DamageRatio": ("WeaponDamage", "WeaponMinDamage"),
    "DefenseRatio": ("ArmorDefense",),
    "MaxHPRatio": ("HPMax",),
    "MaxMPRatio": ("MPMax",),
    "AccuracyRatio": ("WeaponAccuracy", "Accuracy"),
    "EvasionRatio": ("ArmorEvasion", "Evasion"),
    "CriticalRatio": ("Critical",),
    "CriticalResistRatio": ("CriticalResist",),
    "BlockRatio": ("Block",),
}
COOLDOWN_CAP = 60.0  # client UI text: "Cooldown reduction is capped at 60%"
GROUP_ORDER = ("base", "gear", "arcana", "daevanion", "wings", "titles", "armory", "derived", "ratio")
GROUP_NAMES = {"base": "Base (level)", "gear": "Gear", "arcana": "Arcana", "daevanion": "Daevanion", "wings": "Wings",
               "titles": "Titles", "armory": "Not exposed (armory total)", "derived": "Derived from attributes", "ratio": "Amp Ratio"}
NOT_INCLUDED = (
    "Random sub-stat lines are not public: each is scored at its expected value (marked estimated).",
    "Magic stones, god stones, soulbind and Philosopher's Stone lines are not in the armory data.",
    "Pets, skin collections, monolith, pantheon and title collections are not exposed, so the deity points they give "
    "are missing. This is the main reason the Conqueror (deity) stats differ from the armory.",
    "Arcana cards are only counted when the armory lists them as equipment.",
)

# (category key, title, always-shown stats, extra stats shown when non-zero)
LAYOUT = (
    ("attributes", "Attributes", ATTRIBUTES, ()),
    ("deity", "Deity (Conqueror) points", DEITIES[:5] + DEITIES[6:11], ("Light", "Dark")),
    ("attack", "Attack", ("FixingDamage", "WeaponFixingDamage", "WeaponDamage", "WeaponMinDamage", "DefensePierce",
                          "IgnoreDefense", "CriticalAddDamage"),
     ("BackAttackDamage", "FrontAttackDamage", "SealStoneAddDamage", "PhysicDamage", "MagicDamage")),
    ("boost", "Damage boosts", ("AmplifyAllDamage", "AmplifyWeaponDamage", "AmplifyCriticalDamage"),
     ("AmplifyAllDamageRatio", "AmplifyBackAttack", "AmplifyFrontAttack", "AmplifySkillDamage", "AmplifyBasicAtkDamage")),
    ("hits", "Critical and special hits", ("Critical", "AdditionalHitRate", "Perfect", "HardHit"), ("IronWall",)),
    ("pve", "PvE and boss", ("PvEAddDamage", "PvEAmplifyDamage", "BossNpcAddDamage", "BossNpcDefense",
                             "BossNpcAmplifyDamage", "BossNpcDecreaseDamage"),
     ("PvEDamageDefense", "PvEDecreaseDamage", "PvEDefensePierce", "AbyssAmplifyDamage", "AbyssDecreaseDamage")),
    ("speed", "Speed and cooldown", ("CombatSpeed", "CooldownTotal", "CoolTimeDecrease", "CoolTimeIncrease",
                                      "MPUseIncrease"),
     ("AttackSpeed", "SkillSpeed", "CastingSpeed", "ChargeSpeed", "CoolTimeDecreaseRatio", "CombatSpeedRatio",
      "MPUseDecrease")),
    ("defense", "Defense and tolerance", ("ArmorDefense", "Defense", "DecreaseDamage", "DecreaseCriticalDamage",
                                          "CriticalDamageDefense", "BackAttackDefense", "FrontAttackDefense"),
     ("DecreaseWeaponDamage", "DecreaseBackAttack", "DecreaseFrontAttack", "DecreaseDamageRatio", "PerfectResist",
      "HardHitResist", "AdditionalHitResistRate", "IgnoreIronWall", "IgnoreRestoration")),
    ("avoid", "Accuracy, evasion and block", ("WeaponAccuracy", "Accuracy", "ArmorEvasion", "Evasion", "Block",
                                              "CriticalResist"),
     ("BlockPierce", "WeaponBlock", "ShieldBlock", "Immune", "IgnoreImmune")),
    ("amp", "Amp Ratio", tuple(RATIO_TARGETS), ()),
    ("resource", "HP, MP and recovery", ("HPMax", "MPMax"), ("HPRegen", "MPRegen", "BattleHPRegen", "BattleMPRegen",
                                                            "SPMax", "FPMax", "HpPotionRegen", "Restoration")),
    ("move", "Movement", ("MoveSpeed",), ("FlySpeed", "SprintSpeed", "WalkSpeed", "VehicleSpeed")),
)
_PLACED = {k for _c, _t, a, e in LAYOUT for k in (*a, *e)}
_PRIMARY_SET = set(PRIMARY)


@lru_cache(maxsize=1)
def load_data() -> dict:
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _name_index() -> dict[str, str]:
    """lower-case English stat name -> key (first row wins where the client reuses a name)."""
    idx: dict[str, str] = {}
    for k, v in load_data()["stats"].items():
        idx.setdefault(v[0].lower(), k)
        if k in _PRIMARY_SET and " [" in v[0]:  # "Death [Triniel]" is also written "Death"
            idx.setdefault(v[0].split(" [")[0].lower(), k)
    return idx


_LINE = re.compile(r"^\s*(.*?)\s*([+-]?\d[\d,]*(?:\.\d+)?)\s*(%?)\s*$")


def parse_line(text: str) -> tuple[str, float] | None:
    """Armory text like "Attack Bonus +18" or "Cooldown Reduction +3%" -> (stat key, value in display units)."""
    m = _LINE.match(text or "")
    if not m:
        return None
    key = _name_index().get(m.group(1).lower())
    return (key, float(m.group(2).replace(",", ""))) if key else None


class _Book:
    """{stat: [entry]} plus helpers; an entry is {group, label, value, est?}."""

    def __init__(self) -> None:
        self.by: dict[str, list[dict]] = {}
        self.unparsed: list[str] = []

    def add(self, stat: str, value: float, group: str, label: str, est: bool = False) -> None:
        if not value:
            return
        e = {"group": group, "label": label, "value": value}
        if est:
            e["est"] = True
        self.by.setdefault(stat, []).append(e)

    def total(self, stat: str) -> float:
        return sum(e["value"] for e in self.by.get(stat, ()))

    def text(self, line: str, group: str, label: str) -> None:
        got = parse_line(line)
        if got is None:
            self.unparsed.append(f"{label}: {line}")
        else:
            self.add(got[0], got[1], group, label)


def _gear(book: _Book, raw: dict, items: dict[int, dict], notes: list[str]) -> None:
    missing = []
    for e in ((raw.get("equipment") or {}).get("equipment") or {}).get("equipmentList") or []:
        it = items.get(int(e.get("id") or 0))
        slot = e.get("slotPosName") or "Item"
        if it is None:
            missing.append(e.get("name") or str(e.get("id")))
            continue
        ench, exc = int(e.get("enchantLevel") or 0), int(e.get("exceedLevel") or 0)
        parts = gear.item_parts(it, ench, exc)
        group = "arcana" if it["slot"] == "arcana" else "gear"
        who = f"{slot}: {it['name']}"
        for stat, v in parts["main"].items():
            book.add(stat, v, group, who)
        for stat, v in parts["fixed"].items():
            book.add(stat, v, group, who)
        for stat, v in parts["enchant"].items():
            book.add(stat, v, group, f"{slot}: enchant +{ench}")
        for stat, v in parts["exceed"].items():
            book.add(stat, v, group, f"{slot}: Exceed {exc}")
        for stat, v in parts["rolled"].items():
            book.add(stat, v, group, f"{slot}: random lines", est=True)
    if missing:
        notes.append(f"{len(missing)} equipped item(s) are not in our item table and add nothing: {', '.join(missing)}.")


def _daevanion(book: _Book, raw: dict) -> None:
    names = {b.get("id"): b.get("name") for b in ((raw.get("info") or {}).get("daevanion") or {}).get("boardList") or []}
    for bid, detail in sorted((raw.get("daevanion") or {}).items(), key=lambda kv: int(kv[0])):
        label = f"Daevanion: {names.get(int(bid), bid)}"
        for eff in (detail or {}).get("openStatEffectList") or []:
            book.text(eff.get("desc", ""), "daevanion", label)


def _wings(book: _Book, raw: dict, data: dict) -> None:
    wing = ((raw.get("equipment") or {}).get("petwing") or {}).get("wing") or {}
    row = data["wings"].get(str(wing.get("id")))
    if not row:
        return
    lv = int(wing.get("enchantLevel") or 0)
    label = f"Wings: {wing.get('name', 'wings')}" + (f" +{lv}" if lv else "")
    for stat, v in row["s"].items():
        book.add(stat, v, "wings", label)
    fx = data["wing_fx"].get(row["g"] or "", {})
    if fx:
        for stat, v in fx.get(str(min(lv, max(int(k) for k in fx))), {}).items():
            book.add(stat, v, "wings", label)


def _titles(book: _Book, raw: dict) -> None:
    for t in ((raw.get("info") or {}).get("title") or {}).get("titleList") or []:
        cat = t.get("equipCategory") or "Title"
        for s in t.get("equipStatList") or []:
            book.text(s.get("desc", ""), "titles", f"Title ({cat}): {t.get('name', '')}")
        for s in t.get("statList") or []:
            book.text(s.get("desc", ""), "titles", f"Title collection: {t.get('name', '')}")


def _derived(book: _Book, data: dict) -> dict[str, int]:
    """Primary stat totals -> secondary lines. Returns the point count used per primary stat."""
    pts: dict[str, int] = {}
    for p in PRIMARY:
        n = min(int(math.floor(book.total(p) + 1e-9)), data["second_max"])
        if n > 0:
            pts[p] = n
    for p, n in pts.items():
        name = data["stats"][p][0]
        for stat, per in data["second"][p]:
            book.add(stat, round(n * per, 6), "derived", f"{name} {n}")
    return pts


def _ratio(book: _Book, data: dict) -> dict[str, list[dict]]:
    """Amp Ratio pass. Returns {ratio stat: [{key, base, add}]} for the UI."""
    applied: dict[str, list[dict]] = {}
    for r, targets in RATIO_TARGETS.items():
        pct = book.total(r)
        if not pct:
            continue
        rows = []
        for t in targets:
            base = book.total(t)
            add = base * pct / 100
            book.add(t, round(add, 6), "ratio", f"{data['stats'][r][0]} {pct:g}% of {base:g}")
            rows.append({"key": t, "base": round(base, 4), "add": round(add, 4)})
        applied[r] = rows
    return applied


def _row(key: str, name: str, unit: str, value: float, entries: list[dict], lo=None, hi=None) -> dict:
    capped = False
    if lo is not None and value < lo:
        value, capped = lo, True
    if hi is not None and value > hi:
        value, capped = hi, True
    order = {g: i for i, g in enumerate(GROUP_ORDER)}
    src = sorted(entries, key=lambda e: (order.get(e["group"], 99), -abs(e["value"])))
    row = {"key": key, "name": name, "unit": unit, "value": round(value, 4),
           "sources": [{**e, "value": round(e["value"], 4)} for e in src]}
    if capped:
        row["capped"] = True
    return row


def _calibrate(book: _Book, raw: dict) -> None:
    """The armory prints the true total of every attribute and deity stat, hidden sources included (pantheon, real
    rolls, collections). Add the gap as its own estimated source so the derived pass starts from the real points."""
    for s in ((raw.get("info") or {}).get("stat") or {}).get("statList") or []:
        p = s.get("type")
        if p in _PRIMARY_SET:
            book.add(p, float(s.get("value") or 0) - book.total(p), "armory",
                     "Armory total minus the sources above (hidden sources and roll error)", est=True)


def compare_armory(raw: dict, book: _Book, data: dict) -> dict:
    """Our totals against what the armory's own stat list says. Two checks:
    attributes: our summed primary stat vs the armory value (gear rolls and hidden sources make these differ);
    derived: the armory's own points pushed through our PcStatSecond vs the percent lines it prints (should be exact)."""
    arm = {s.get("type"): s for s in ((raw.get("info") or {}).get("stat") or {}).get("statList") or []}
    attrs, lines = [], []
    for p in PRIMARY:
        a = arm.get(p)
        if a is None:
            continue
        theirs, ours = float(a.get("value") or 0), book.total(p)
        d = ours - theirs
        attrs.append({"key": p, "name": data["stats"][p][0], "armory": theirs, "ours": round(ours, 4),
                      "diff": round(d, 4), "ok": abs(d) < 0.5})
        for text in a.get("statSecondList") or []:
            got = parse_line(text)
            if got is None:
                continue
            key, val = got
            per = dict(data["second"][p]).get(key)
            mine = None if per is None else round(min(int(theirs), data["second_max"]) * per, 6)
            lines.append({"primary": p, "key": key, "name": data["stats"][key][0], "text": text, "armory": val,
                          "from_armory_points": mine, "ok": mine is not None and abs(mine - val) < 1e-6})
    return {"attributes": attrs, "derived": lines,
            "summary": {
                "attributes": len(attrs), "attributes_ok": sum(a["ok"] for a in attrs),
                "attributes_nonzero": sum(1 for a in attrs if a["armory"] or a["ours"]),
                "attributes_nonzero_ok": sum(a["ok"] for a in attrs if a["armory"] or a["ours"]),
                "derived": len(lines), "derived_ok": sum(x["ok"] for x in lines)}}


def compute(raw: dict, items: dict[int, dict] | None = None, data: dict | None = None, calibrate: bool = True) -> dict:
    """raw = {"info", "equipment", "daevanion": {boardId: detail}} as import_character takes it."""
    data = data or load_data()
    items = items if items is not None else gear.load_items()
    prof = (raw.get("info") or {}).get("profile") or {}
    levels = sorted(int(k) for k in data["level_base"])
    level = max(levels[0], min(int(prof.get("characterLevel") or levels[0]), 45 if 45 in levels else levels[-1]))
    book, notes = _Book(), []
    for stat, v in zip(("FixingDamage", "Defense", "HPMax"), data["level_base"][str(level)]):
        book.add(stat, v, "base", f"Base stats, level {level}")
    _gear(book, raw, items, notes)
    _daevanion(book, raw)
    _wings(book, raw, data)
    _titles(book, raw)
    # A weapon range is Max/Min Attack; every flat Attack line (accessory attack, exceed on rings, sub lines) adds to
    # both ends. Assumed fold: the client does not say whether the sheet's Max/Min include the flat lines.
    flat = book.by.get("WeaponFixingDamage", [])
    for stat in ("WeaponDamage", "WeaponMinDamage"):
        for e in flat:
            book.add(stat, e["value"], e["group"], e["label"], e.get("est", False))
    check = compare_armory(raw, book, data)  # before calibration: this is the honest known-sources vs armory diff
    if calibrate:
        _calibrate(book, raw)
    pts = _derived(book, data)
    applied = _ratio(book, data)
    for e in book.by.get("CoolTimeIncrease", ()):
        book.add("CooldownTotal", -e["value"], e["group"], e["label"], e.get("est", False))
    for e in book.by.get("CoolTimeDecrease", ()):
        book.add("CooldownTotal", e["value"], e["group"], e["label"], e.get("est", False))
    stats = data["stats"]
    arm_attr = {a["key"]: a for a in check["attributes"]}
    derived_by_key: dict[str, list[dict]] = {}
    for x in check["derived"]:
        derived_by_key.setdefault(x["key"], []).append(x)

    def build_row(key: str) -> dict:
        if key == "CooldownTotal":
            tot = book.total(key)
            r = _row(key, "Cooldown reduction (total)", "%", min(tot, COOLDOWN_CAP), book.by.get(key, []))
            if tot > COOLDOWN_CAP:
                r["capped"] = True
            return r
        name, pct, _div, lo, hi = stats[key]
        r = _row(key, name, "%" if pct else "", book.total(key), book.by.get(key, []), lo, hi)
        if key in arm_attr:
            # `known` = what our sources add up to before the armory total is used to fill the gap
            r["armory"] = {"value": arm_attr[key]["armory"], "known": arm_attr[key]["ours"],
                           "diff": arm_attr[key]["diff"], "ok": arm_attr[key]["ok"], "basis": "attribute total"}
        elif key in derived_by_key:
            ours = sum(e["value"] for e in book.by.get(key, ()) if e["group"] == "derived")
            theirs = sum(x["armory"] for x in derived_by_key[key])
            r["armory"] = {"value": round(theirs, 4), "diff": round(ours - theirs, 4),
                           "ok": abs(ours - theirs) < 0.05, "basis": "derived part only"}
        if key in applied:
            r["applies_to"] = [{**t, "name": stats[t["key"]][0]} for t in applied[key]]
        return r

    cats = []
    for ckey, title, always, extra in LAYOUT:
        keys = [k for k in always if k in stats or k == "CooldownTotal"]
        keys += [k for k in extra if k in stats and (book.total(k) or k in book.by) and k not in keys]
        if ckey == "deity":
            keys = [k for k in keys if k not in ("Light", "Dark") or book.total(k)]
        cats.append({"key": ckey, "name": title, "stats": [build_row(k) for k in keys]})
    rest = sorted(k for k in book.by if k not in _PLACED and k in stats and book.total(k))
    other = {"pvp": [k for k in rest if k.startswith("PvP")]}
    other["status"] = [k for k in rest if k not in other["pvp"] and re.search(
        r"(Abnormal|Stun|Hold|Aerial|Taunt|Fear|Silence|Slow|Snare|Sleep|Stone|Paralysis|Poison|Bleed|Blind|Frozen|"
        r"Knockdown|Polymorph|Blockade|Bind|BlockActive|Property|Resist(?!ance)|Accuracy$)", k)]
    other["other"] = [k for k in rest if k not in other["pvp"] and k not in other["status"]]
    for ckey, title in (("pvp", "PvP"), ("status", "Status effects and other resists"), ("other", "Other")):
        if other[ckey]:
            cats.append({"key": ckey, "name": title, "stats": [build_row(k) for k in other[ckey]]})
    return {
        "class_name": prof.get("className"), "level": level, "categories": cats,
        "groups": [{"key": g, "name": GROUP_NAMES[g]} for g in GROUP_ORDER],
        "armory_check": check, "points": pts, "notes": notes, "unparsed": book.unparsed,
        "not_included": list(NOT_INCLUDED),
    }
