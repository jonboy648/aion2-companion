"""Item sets, and every non-equipment item (consumables, materials, currency), from the private client export.

Same rule as build_items.py / ADR 0001: the export is read only through AION2_EXPORT_DIR and only our derived fields are
written: names and descriptions as the English client shows them, grade, category, level, icon resource name.

    set AION2_EXPORT_DIR=<the private export's Table directory>
    python -m aion2c.data.build_item_extras         (from app/; also regenerates web/public/items/)

Writes data/items_other.json: {"items": [{id, n name, g grade, type, cat, lv required level, i icon, d description}]}.
`type` is the client item type (Usable / Misc / Currency) and `cat` its client category; build_itemdb.py groups those
into the categories the site shows. Item sets are part of items.json (`sets`, plus `set` on each member), written by
build_items.py through `build_sets` below.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from aion2c.data import build_items as bi

DATA = Path(__file__).parent
OUT = DATA / "items_other.json"
OTHER_TYPES = ("Usable", "Misc", "Currency")
CATEGORY_KEY = {"Usable": "UsableCategory", "Misc": "MiscCategory", "Currency": "CurrencyCategory"}


def l10n_entries(table_dir: Path) -> dict[str, str]:
    return json.loads((table_dir / "L10N" / "en-US" / "L10NString.json").read_text(encoding="utf-8"))["Entries"]


def clean_text(s: str) -> str:
    """Client UI text -> plain text. Colour tags go; `{se:...}`-style placeholders (numbers the client computes from skill
    tables, which we do not resolve) become an ellipsis."""
    s = re.sub(r"\{[^{}]*\}", "…", s)
    s = re.sub(r"</?[A-Za-z_]*>", "", s)
    s = s.replace("\r\n", "\n")
    return re.sub(r" *\n *", "\n", re.sub(r"[ \t]+", " ", s)).strip()


def grade_name(l10n: dict[str, str], grade: str) -> str:
    """The grade as the client displays it ("Legend" shows as Epic)."""
    return l10n.get(f"String_Tooltip_Grade_{grade}_body") or grade


def equip_icon(res: str) -> str | None:
    """CDN resource name for an equipment IconRes. The CDN names gear icons Icon_Equip_AR_L_* / Icon_Equip_WP_L_* where the
    client table says Icon_GM_* / Icon_WP_* (true for all 3,356 items that already had an icon from the official endpoint)."""
    if not res or res == "None":
        return None
    return re.sub(r"^Icon_WP_", "Icon_Equip_WP_L_", re.sub(r"^Icon_GM_", "Icon_Equip_AR_L_", res))


def build_others(table_dir: Path) -> dict:
    l10n = l10n_entries(table_dir)
    out = []
    for it in bi._rows(table_dir, "Item"):
        typ = bi._sid(it["ItemType"])
        if typ not in OTHER_TYPES:
            continue
        row = {"id": it["ID"]["Value"], "n": l10n[f"String_{it['Desc']['Key']}_body"],
               "g": grade_name(l10n, bi._sid(it["ItemGrade"])), "type": typ, "cat": bi._sid(it[CATEGORY_KEY[typ]]),
               "lv": it["PermitLevelMin"]}
        if it["IconRes"] not in ("None", ""):
            row["i"] = it["IconRes"]
        desc = l10n.get(f"String_{it['DescLong']['Key']}_body", "")
        if desc:
            row["d"] = clean_text(desc)
        out.append(row)
    out.sort(key=lambda r: r["id"])
    return {"schema": 1, "source": bi.EXPORT_SOURCE, "items": out}


def build_sets(table_dir: Path, l10n: dict[str, str], item_rows: list[dict], ids: dict[str, list[int]]) -> dict:
    """{set key: {name, icon, type, items: [item ids], bonuses: [{pieces, name, text}]}}.

    `ids` maps a set key to its member item ids (from each Item row's SetNames). A bonus is one ItemSetEffect row; its text
    is the client's own summary of the passive it grants (OptAbnormalId -> SkillAbnormalString), plus plain stat lines if the
    row lists OptStats."""
    strings = {r["Name"]: r for r in bi._rows(table_dir, "SkillAbnormalString")} if (table_dir / "SkillAbnormalString.json").is_file() else {}
    effects: dict[str, list[dict]] = {}
    for r in bi._rows(table_dir, "ItemSetEffect"):
        effects.setdefault(r["SetName"], []).append(r)
    sets: dict[str, dict] = {}
    for r in item_rows:
        key = r["SetName"]
        if key in sets:
            continue
        sets[key] = {"name": l10n.get(f"String_{r['SetNameDesc']['Key']}_body", key), "icon": r["SetIconRes"],
                     "type": bi._sid(r["SetType"]), "items": sorted(ids.get(key, [])), "bonuses": []}
    for key, s in sets.items():
        for e in sorted(effects.get(key, []), key=lambda e: e["SetEquipCount"]):
            row = strings.get(f"SkillAbnormalString_{e['OptAbnormalId']['Value']}")
            text = clean_text(l10n.get(row["DescSummary"]["Key"], "")) if row else ""
            bonus = {"pieces": e["SetEquipCount"], "name": clean_text(l10n.get(row["DescName"]["Key"], "")) if row else "", "text": text}
            if e["OptStats"]:
                bonus["stats"] = {bi._sid(s2["Key"]): s2["Value"] for s2 in e["OptStats"]}
            s["bonuses"].append(bonus)
    return sets


def write_others(doc: dict, out: Path = OUT) -> None:
    out.write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")


def main() -> None:
    table = bi.export_dir()
    doc = build_others(table)
    write_others(doc)
    print(f"items_other: {len(doc['items'])} items, {OUT.stat().st_size} B")
    from aion2c.data import build_itemdb
    build_itemdb.main()


if __name__ == "__main__":
    main()
