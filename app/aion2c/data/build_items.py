"""Build app/aion2c/data/items.json from the official open gameconst item endpoint.

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


def main(argv=None) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["fetch", "build", "all"])
    ap.add_argument("--no-seed-scan", action="store_true")
    a = ap.parse_args(argv)
    if a.cmd in ("fetch", "all"):
        fetch_all(candidate_ids(), seed_scan=not a.no_seed_scan)
    if a.cmd in ("build", "all"):
        print("items:", build())


if __name__ == "__main__":
    main()
