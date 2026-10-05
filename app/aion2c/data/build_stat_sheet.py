"""Regenerate app/aion2c/data/stat_sheet.json from the PRIVATE client table export (ADR 0001: only derived numbers).

    set AION2_EXPORT_DIR=<path to the exported Table directory>
    python -m aion2c.data.build_stat_sheet            (from app/)

What is derived (small tables of our own, no raw rows, row ids or descriptions):
  stats        key -> [English name, percent flag, display divisor, min, max]. The English name is the label the official
               armory API itself prints ("Attack Bonus +18"), so it doubles as the key for reading armory text lines.
  second       primary stat (STR, Justice, ...) -> [[derived stat, value per point], ...]. `PcStatSecond` has 1000 rows;
               they are checked here to be exactly linear in the point count, so one value per point is stored.
  level_base   level -> [Attack Bonus, Defense Bonus, HP]; `PcStatLevel` is identical for every class (checked).
  wings        wing id -> {"g": enchant-effect group, "s": base stats}; wing_fx: group -> {level: stats}. A level row is
               the absolute stat set at that level (FPMax 50000, 51000, ...), not an increment.
All values are in display units: a percent stat is stored as percent points (raw / 100), stamina-like stats raw / 100.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

from aion2c.data import client_export as ce

OUT_PATH = Path(__file__).parent / "stat_sheet.json"
SOURCE = "client export 2026-10-04 (derived)"
PRIMARY = ("STR", "DEX", "INT", "CON", "AGI", "WIS", "Justice", "Freedom", "Illusion", "Life", "Time", "Light",
           "Destruction", "Death", "Wisdom", "Destiny", "Space", "Dark")
SECOND_KEYS = {  # PcStatSecond column -> primary stat
    "Str": "STR", "Dex": "DEX", "Int": "INT", "Con": "CON", "Agi": "AGI", "Wis": "WIS", "Justice": "Justice",
    "Destruction": "Destruction", "Freedom": "Freedom", "Death": "Death", "Illusion": "Illusion", "Wisdom": "Wisdom",
    "Life": "Life", "Destiny": "Destiny", "Time": "Time", "Space": "Space",
}


def _num(x: float):
    x = round(float(x), 6)
    return int(x) if x == int(x) else x


def _short(k: str) -> str:
    return k.split("::")[-1]


def build(table_dir: Path) -> dict:
    ent = json.loads((table_dir / "L10N" / "en-US" / "L10NString.json").read_text(encoding="utf-8"))["Entries"]
    stats: dict[str, list] = {}
    div: dict[str, float] = {}
    for r in ce._rows(table_dir, "StatCorrectionNumber"):
        key = _short(r["StatName"])
        k = r["Desc"]["Key"]
        name = ent.get(k + "_body") or ent.get("String_" + k + "_body") or key
        d = 100 if (r["DivideNumber"] == 1 or r["StatUnit"] == 100) else 1
        div[key] = d
        stats[key] = [name, 1 if r["DivideNumber"] == 1 else 0, d, _num(r["MinValue"] / d), _num(r["MaxValue"] / d)]

    second: dict[str, list] = {p: [] for p in PRIMARY}
    rows = ce._rows(table_dir, "PcStatSecond")
    first = next(r for r in rows if r["Stat"] == 1)
    for col, prim in SECOND_KEYS.items():
        second[prim] = [[_short(s["StatType"]), _num(s["StatValue"] / div[_short(s["StatType"])])]
                        for s in first[col + "StatList"]]
    for r in rows:  # linearity check: every row is `points` times the first row
        for col, prim in SECOND_KEYS.items():
            for s, s1 in zip(r[col + "StatList"], first[col + "StatList"]):
                if s["StatValue"] != s1["StatValue"] * r["Stat"]:
                    raise SystemExit(f"PcStatSecond is not linear at {prim} point {r['Stat']}")
    second_max = max(r["Stat"] for r in rows)

    by_level: dict[int, dict[str, list]] = defaultdict(dict)
    for r in ce._rows(table_dir, "PcStatLevel"):
        by_level[r["Level"]][r["Class"]] = [s["Value"] for s in r["StatList"]]
        assert [s["Key"] for s in r["StatList"]] == ["EStat::FixingDamage", "EStat::Defense", "EStat::HPMax"]
    level_base = {}
    for lv, per in sorted(by_level.items()):
        if len({json.dumps(v) for v in per.values()}) != 1:
            raise SystemExit(f"PcStatLevel differs between classes at level {lv}")
        level_base[str(lv)] = next(iter(per.values()))

    wings, wing_fx = {}, defaultdict(dict)
    for r in ce._rows(table_dir, "WingEnchantEffect"):
        wing_fx[r["EffectGroup"]][str(r["Level"])] = {
            _short(s["Key"]): _num(s["Value"] / div.get(_short(s["Key"]), 1)) for s in r["Stats"]}
    for r in ce._rows(table_dir, "Wing"):
        if not r["EquipStatList"] and r["EffectGroup"] not in wing_fx:
            continue
        wings[str(r["ID"]["Value"])] = {
            "g": r["EffectGroup"] if r["EffectGroup"] in wing_fx else None,
            "s": {_short(s["Stat"]): _num(s["Value"] / div.get(_short(s["Stat"]), 1)) for s in r["EquipStatList"]}}
    used = {w["g"] for w in wings.values() if w["g"]}
    return {"schema": 1, "source": SOURCE, "stats": stats, "second": second, "second_max": second_max,
            "level_base": level_base, "wings": wings, "wing_fx": {g: wing_fx[g] for g in sorted(used)}}


def main() -> None:
    doc = build(ce.export_dir())
    OUT_PATH.write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH} ({OUT_PATH.stat().st_size / 1024:.0f} KiB): {len(doc['stats'])} stats, "
          f"{len(doc['wings'])} wings, {len(doc['level_base'])} levels")


if __name__ == "__main__":
    sys.exit(main())
