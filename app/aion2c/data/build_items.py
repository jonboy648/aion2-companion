"""Build app/aion2c/data/items.json.

Primary source: the private client table export (`export`, see the section below). Legacy source: the official open
gameconst item endpoint (`fetch` / `build` / `all`), kept working:

    python -m aion2c.data.build_items fetch    # polite, resumable; cache under research/items_cache/
    python -m aion2c.data.build_items build    # cache -> items.json (no network)
    python -m aion2c.data.build_items all

Per item we need the +0 definition and the definition at max enchant (the endpoint clamps
enchantLevel to max). Only Attack/Defense/HP-type main stats move with enchant, roughly
linearly, so slope = (extra at max) / max. The +0 request can be seeded from the research scan
(--seed-scan), which came from the same endpoint; the max-enchant request is always live.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

URL = "https://aion2.plaync.com/en-us/api/gameconst/item?id={id}&enchantLevel={ench}&lang=en-US&region=nae"
UA = "Mozilla/5.0 (aion2c item builder)"
ROOT = Path(__file__).resolve().parents[3]  # D:\Aion2
CACHE = ROOT / "research" / "items_cache"
SCAN = ROOT / "research" / "gear_samples" / "_scan_equip.json"
OUT = Path(__file__).with_name("items.json")
SPACING_S = 0.3

# Slot from the id family (first 4 digits). Armor/jewelry are class-free.
FAMILY_SLOT = {
    "1101": "weapon", "1102": "weapon", "1103": "weapon", "1104": "weapon", "1105": "weapon",
    "1106": "weapon", "1107": "weapon", "1108": "weapon", "1150": "offhand",
    "2101": "torso", "2102": "legs", "2103": "helmet", "2104": "shoulder", "2105": "gloves",
    "2106": "boots", "2107": "cape", "2152": "belt",
    "3101": "necklace", "3102": "earring", "3103": "ring", "3104": "bracelet", "3110": "amulet",
}


def slot_of(item_id: int) -> str | None:
    return FAMILY_SLOT.get(str(item_id)[:4])


def _cache_path(item_id: int, ench: int, cache: Path = CACHE) -> Path:
    return cache / f"{item_id}_{ench}.json"


def _get(item_id: int, ench: int) -> dict:
    req = urllib.request.Request(URL.format(id=item_id, ench=ench), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def fetch_one(item_id: int, ench: int, cache: Path = CACHE, getter=_get) -> tuple[dict, bool]:
    """(json, was_live). Cached results are never refetched."""
    p = _cache_path(item_id, ench, cache)
    if p.exists():
        return json.loads(p.read_text(encoding="utf8")), False
    for attempt in range(4):
        try:
            data = getter(item_id, ench)
            break
        except Exception as e:  # network/HTTP: back off and retry
            if attempt == 3:
                print(f"  FAIL {item_id}@{ench}: {e}", file=sys.stderr)
                return {}, True
            time.sleep(2 * (attempt + 1))
    p.write_text(json.dumps(data), encoding="utf8")
    return data, True


def candidate_ids(scan: Path = SCAN) -> list[int]:
    d = json.load(open(scan, encoding="utf8"))
    return sorted(int(k) for k, v in d.items() if v.get("name") and slot_of(int(k)))


def fetch_all(ids: list[int], cache: Path = CACHE, seed_scan: bool = True, getter=_get,
              spacing: float = SPACING_S) -> None:
    cache.mkdir(parents=True, exist_ok=True)
    scan = json.load(open(SCAN, encoding="utf8")) if seed_scan and SCAN.exists() else {}
    t0, live = time.time(), 0
    for n, i in enumerate(ids, 1):
        p0 = _cache_path(i, 0, cache)
        if not p0.exists() and str(i) in scan and scan[str(i)].get("name"):
            p0.write_text(json.dumps(scan[str(i)]), encoding="utf8")
        d0, was_live = fetch_one(i, 0, cache, getter)
        if was_live:
            time.sleep(spacing)
        mx = int(d0.get("maxEnchantLevel") or 0)
        if mx > 0 and d0.get("name"):
            _, was_live = fetch_one(i, mx, cache, getter)
            if was_live:
                live += 1
                time.sleep(spacing)
        if n % 100 == 0:
            print(f"{n}/{len(ids)} done, {live} live max-enchant calls, {time.time() - t0:.0f}s", flush=True)


def _num(s) -> float:
    return float(str(s).replace("%", "").replace(",", ""))


def _stat(s: dict) -> dict:
    out = {"id": s["id"], "v": _num(s["value"])}
    if "minValue" in s:
        out["min"] = _num(s["minValue"])
    return out


def compact(d0: dict, dmax: dict | None) -> dict | None:
    """Compact one item. Enchant slope per main stat = extra at max / max (0 if unchanged)."""
    if not d0.get("name"):
        return None
    iid = int(d0["id"])
    slot = slot_of(iid)
    if slot is None:
        return None
    mx = int(d0.get("maxEnchantLevel") or 0)
    extra_max = {}
    if dmax and mx:
        extra_max = {s["id"]: _num(s.get("extra", 0)) for s in dmax.get("mainStats", [])}
    main = []
    for s in d0.get("mainStats", []):
        st = _stat(s)
        ex = extra_max.get(s["id"], 0.0)
        if ex:
            st["slope"] = round(ex / mx, 4)
        main.append(st)
    it = {
        "id": iid, "name": d0["name"], "slot": slot, "grade": d0.get("gradeName") or d0.get("grade"),
        "il": int(d0.get("level") or 0), "equip_level": int(d0.get("equipLevel") or 0),
        "class_lock": list(d0.get("classNames") or []),
        "max_enchant": mx, "main": main,
        "subs": [_stat(s) for s in d0.get("subStats", [])],
        "sub_random": bool(d0.get("subStatRandom")), "sub_count": int(d0.get("subStatCount") or 0),
        "mana_slots": int(d0.get("magicStoneSlotCount") or 0),
        "god_slots": int(d0.get("godStoneSlotCount") or 0),
        "sources": list(d0.get("sources") or []),
    }
    icon = str(d0.get("icon") or "").rsplit("/", 1)[-1].removesuffix(".png")
    if icon:
        it["icon"] = icon  # CDN resource name; webapi builds the URL
    if d0.get("maxExceedEnchantLevel"):
        it["max_exceed"] = int(d0["maxExceedEnchantLevel"])
    if d0.get("set"):
        it["set"] = d0["set"].get("id")
    return it


def build(cache: Path = CACHE, out: Path = OUT) -> int:
    items = []
    for p in sorted(cache.glob("*_0.json")):
        d0 = json.loads(p.read_text(encoding="utf8"))
        mx = int(d0.get("maxEnchantLevel") or 0)
        pm = _cache_path(int(p.stem.split("_")[0]), mx, cache)
        dmax = json.loads(pm.read_text(encoding="utf8")) if mx and pm.exists() else None
        it = compact(d0, dmax)
        if it:
            it["slope_known"] = bool(dmax) or not mx
            items.append(it)
    items.sort(key=lambda x: x["id"])
    out.write_text(json.dumps({"schema": 1, "items": items}, separators=(",", ":"), ensure_ascii=False),
                   encoding="utf8")
    return len(items)


# ---- client export (primary source) -----------------------------------------------------------------------------
#
#     set AION2_EXPORT_DIR=<the private export's Table directory>      (never stored in this repo)
#     python -m aion2c.data.build_items export                          (from app/)
#
# Reads Item, Enchant, EnchantEffect, ExceedEnchant, AdditionalStat, StatCorrectionNumber and L10N/en-US/L10NString
# and writes only OUR derived fields. Same per-item schema as the endpoint build, plus:
#   sub lines    "w"            client RandomWeight of the pool line (0 on fixed lines)
#   item         "enchant_group" / "odds_group" / "exceed_group"   keys into the three top-level tables below
#   top level    "enchant_series": {group: {stat: [bonus at +1, +2, ... +max]}}   (cumulative, per-level, from the client)
#                "enchant_odds":   {group: [success % of going +0->+1, +1->+2, ...]}
#                "exceed":         {group: {"odds": [success % per step], "levels": [{stat: value at level 1, 2, ...}]}}
# `slope` (series[-1] / max, the old linear fit) is kept so older consumers still work. `icon` and `sources` are not in
# the client tables: they are carried over by id from the previous items.json; the 199 items the endpoint never listed
# have neither.
ENV_VAR = "AION2_EXPORT_DIR"
EXPORT_SOURCE = "client export 2026-10-04"
EXPORT_TABLES = ("Item", "Enchant", "EnchantEffect", "ExceedEnchant", "AdditionalStat", "StatCorrectionNumber")
CATEGORY_SLOT = {
    "Greatsword": "weapon", "Sword": "weapon", "Dagger": "weapon", "Bow": "weapon", "Magicbook": "weapon",
    "Orb": "weapon", "Mace": "weapon", "Staff": "weapon", "Gauntlet": "weapon", "Guarder": "offhand",
    "Torso": "torso", "Pants": "legs", "Helmet": "helmet", "Shoulder": "shoulder", "Gloves": "gloves",
    "Boots": "boots", "Cape": "cape", "Belt": "belt", "Necklace": "necklace", "Earring": "earring",
    "Ring": "ring", "Bracelet": "bracelet", "Amulet": "amulet", "Rune": "rune",
    "ArcanaGrail": "arcana", "ArcanaParchment": "arcana", "ArcanaCompass": "arcana", "ArcanaBell": "arcana",
    "ArcanaMirror": "arcana",
}
CATEGORY_CLASS = {
    "Greatsword": "Gladiator", "Sword": "Templar", "Dagger": "Assassin", "Bow": "Ranger", "Magicbook": "Sorcerer",
    "Orb": "Spiritmaster", "Mace": "Cleric", "Staff": "Chanter", "Gauntlet": "Fighter",
}
GRADE_NAME = {"Legend": "Epic"}  # the client calls our Epic "Legend"
NOT_MAIN = {"DecreaseWeaponBlock", "MaxWeaponBlock", "DecreaseShieldBlock", "MaxShieldBlock"}  # block caps, not stats a player reads


def export_dir() -> Path:
    raw = os.environ.get(ENV_VAR)
    if not raw:
        raise SystemExit(f"{ENV_VAR} is not set. Point it at the private client export's Table directory "
                         f"(it is never stored in this repo), then re-run `build_items export`.")
    p = Path(raw)
    missing = [t for t in EXPORT_TABLES if not (p / f"{t}.json").is_file()]
    if missing:
        raise SystemExit(f"{ENV_VAR}={raw!r} is missing {', '.join(t + '.json' for t in missing)}; "
                         f"it must be the exported Table directory.")
    return p


def _rows(table_dir: Path, name: str) -> list[dict]:
    return json.loads((table_dir / f"{name}.json").read_text(encoding="utf-8"))["Properties"]["Data"]


def _sid(key: str) -> str:
    return key.split("::", 1)[-1]


def _clean(x: float):
    x = round(x, 4)
    return int(x) if x == int(x) else x


class _Scale:
    """client raw -> displayed number. Percent stats (DivideNumber 1) and FP-type stats (StatUnit 100) are raw / 100."""

    def __init__(self, rows: list[dict]):
        self.div = {_sid(r["StatName"]): 100 if (r["DivideNumber"] == 1 or r["StatUnit"] == 100) else 1 for r in rows}

    def __call__(self, sid: str, raw) -> float:
        if sid not in self.div:
            raise KeyError(f"stat {sid} has no StatCorrectionNumber row")
        return _clean(raw / self.div[sid])


def _by_group(rows: list[dict], level_key: str) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for r in rows:
        out.setdefault(r["Group"], []).append(r)
    for g in out.values():
        g.sort(key=lambda r: r[level_key])
    return out


def _main_stats(it: dict, sc: _Scale) -> list[dict]:
    vals = {_sid(s["Key"]): s["Value"] for s in it["MainStats"] if _sid(s["Key"]) not in NOT_MAIN}
    out = []
    if "WeaponDamage" in vals:  # weapons: WeaponMinDamage..WeaponDamage is our WeaponFixingDamage min..v
        mx, mn = vals.pop("WeaponDamage"), vals.pop("WeaponMinDamage", None)
        out.append({"id": "WeaponFixingDamage", "v": sc("WeaponDamage", mx), "min": sc("WeaponMinDamage", mn if mn is not None else mx)})
    for sid, raw in vals.items():
        if raw:  # a zero main stat (Block on a bow) is not a line
            out.append({"id": sid, "v": sc(sid, raw)})
    return out


def _sub_stats(it: dict, sc: _Scale) -> list[dict]:
    out = []
    for s in it["SubStats"]:
        sid, v = _sid(s["Key"]), s["Value"]
        out.append({"id": sid, "v": sc(sid, v["MaxValue"]), "min": sc(sid, v["MinValue"]), "w": v["RandomWeight"]})
    return out


def _series_table(groups: dict[str, list[dict]], sc: _Scale, wanted: set[str]) -> dict[str, dict[str, list]]:
    out: dict[str, dict[str, list]] = {}
    for g in sorted(wanted):
        rows = groups[g]
        per: dict[str, list] = {}
        for lv, r in enumerate(rows, 1):
            if r["Level"] != lv:
                raise ValueError(f"EnchantEffect group {g}: levels are not 1..N")
            for s in r["StatList"]:
                per.setdefault(_sid(s["StatType"]), [0] * len(rows))[lv - 1] = s["StatValue"]
        if "WeaponDamage" in per:  # fold Min/Max attack into one WeaponFixingDamage series (client: identical)
            mn, mx = per.pop("WeaponMinDamage", per["WeaponDamage"]), per.pop("WeaponDamage")
            per["WeaponFixingDamage"] = [(a + b) / 2 for a, b in zip(mn, mx)]
        out[g] = {sid: [sc(sid, v) for v in vals]
                  for sid, vals in sorted(per.items())}
    return out


def build_from_export(table_dir: Path, previous: dict[int, dict] | None = None) -> dict:
    """The whole items.json document from the client tables. `previous` supplies icon/sources by id."""
    sc = _Scale(_rows(table_dir, "StatCorrectionNumber"))
    l10n = json.loads((table_dir / "L10N" / "en-US" / "L10NString.json").read_text(encoding="utf-8"))["Entries"]
    enchant = _by_group(_rows(table_dir, "Enchant"), "CurrentLevel")
    effect = _by_group(_rows(table_dir, "EnchantEffect"), "Level")
    exceed = _by_group(_rows(table_dir, "ExceedEnchant"), "CurrentLevel")
    extra = {r["Name"]: r["AdditionalStats"] for r in _rows(table_dir, "AdditionalStat")}
    previous = previous or {}
    items, used_effect, used_odds, used_exceed = [], set(), set(), set()
    set_ids: dict[str, list[int]] = {}
    from aion2c.data.build_item_extras import build_sets, equip_icon  # sibling module imports this one at top level
    for it in _rows(table_dir, "Item"):
        if it["ItemType"] != "EItemType::Equip":
            continue
        cat = _sid(it["EquipCategory"])
        iid = it["ID"]["Value"]
        grade = _sid(it["ItemGrade"])
        og, eg, xg = it["EnchantGroup"], it["EnchantEffectGroup"], it["ExceedEnchantGroup"]
        mx = max(0, len(enchant.get(og, [])) - 1)
        out = {
            "id": iid, "name": l10n[f"String_{it['Desc']['Key']}_body"], "slot": CATEGORY_SLOT[cat],
            "grade": GRADE_NAME.get(grade, grade), "il": it["ItemLevel"], "equip_level": it["PermitLevelMin"],
            "class_lock": [CATEGORY_CLASS[cat]] if cat in CATEGORY_CLASS else [],
            "max_enchant": mx, "main": _main_stats(it, sc), "subs": _sub_stats(it, sc),
            "sub_random": bool(it["SoulbindRandomStat"]), "sub_count": it["SoulbindRandomStatCount"],
            "mana_slots": it["MagicStoneSlotCount"], "god_slots": it["GodStoneSlotCount"],
        }
        old = previous.get(iid, {})
        out["sources"] = list(old.get("sources") or [])
        icon = old.get("icon") or equip_icon(it.get("IconRes", ""))  # the endpoint's name wins; the client's fills the gaps
        if icon:
            out["icon"] = icon
            raw = it.get("IconRes", "")
            if not old.get("icon") and raw not in ("", "None", icon):
                out["icon_alt"] = raw  # the CDN names some of these Icon_Equip_*, some as the client table does; the page tries both
        if it.get("SetNames"):
            out["set"] = it["SetNames"][0]
            set_ids.setdefault(it["SetNames"][0], []).append(iid)
        if xg != "None" and len(exceed.get(xg, [])) > 1:
            out["max_exceed"] = len(exceed[xg]) - 1
            out["exceed_group"] = xg
            used_exceed.add(xg)
        if mx and og != "None":
            out["odds_group"] = og
            used_odds.add(og)
        if mx and eg != "None" and len(effect.get(eg, [])) == mx:
            out["enchant_group"] = eg
            used_effect.add(eg)
        out["slope_known"] = True
        items.append(out)
    series = _series_table(effect, sc, used_effect)
    for out in items:  # old linear fit, now read off the real series
        g = out.get("enchant_group")
        for m in out["main"]:
            top = series[g].get(m["id"], [0])[-1] if g else 0
            if top:
                m["slope"] = round(top / out["max_enchant"], 4)
    odds = {g: [_clean(r["SuccessProb"] / 100) for r in enchant[g][:-1]] for g in sorted(used_odds)}
    ex_table = {}
    for g in sorted(used_exceed):
        rows = exceed[g]
        ex_table[g] = {
            "odds": [_clean(r["SuccessProb"] / 100) for r in rows[:-1]],
            "levels": [{_sid(s["Type"]): sc(_sid(s["Type"]), s["Value"]) for s in extra[r["AdditionalStatName"]]}
                       for r in rows[1:]],
        }
    items.sort(key=lambda x: x["id"])
    doc = {"schema": 1, "source": EXPORT_SOURCE, "items": items, "enchant_series": series, "enchant_odds": odds,
           "exceed": ex_table}
    if (table_dir / "ItemSet.json").is_file() and (table_dir / "ItemSetEffect.json").is_file():
        doc["sets"] = build_sets(table_dir, l10n, _rows(table_dir, "ItemSet"), set_ids)
    return doc


def write_items(doc: dict, out: Path = OUT) -> None:
    out.write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False), encoding="utf8")


def main(argv=None) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["fetch", "build", "all", "export", "itemdb"])
    ap.add_argument("--no-seed-scan", action="store_true")
    a = ap.parse_args(argv)
    if a.cmd == "export":
        prev = {it["id"]: it for it in json.loads(OUT.read_text(encoding="utf8"))["items"]} if OUT.exists() else {}
        doc = build_from_export(export_dir(), prev)
        write_items(doc)
        print("items:", len(doc["items"]))
        from aion2c.data import build_item_extras
        build_item_extras.main()  # items_other.json, then web/public/items/ in step with both files
        return
    if a.cmd == "itemdb":
        from aion2c.data import build_itemdb
        build_itemdb.main()
        return
    if a.cmd in ("fetch", "all"):
        fetch_all(candidate_ids(), seed_scan=not a.no_seed_scan)
    if a.cmd in ("build", "all"):
        print("items:", build())


if __name__ == "__main__":
    main()
