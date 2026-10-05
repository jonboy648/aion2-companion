"""Regenerate web/public/data/enhance.json (the /enhance calculator's inputs) from the PRIVATE client table export.

    set AION2_EXPORT_DIR=<path to the exported Table directory>
    python -m aion2c.data.enhance_export            (from app/)       write the file
    python -m aion2c.data.enhance_export --check    (no export)       compare it with items.json (drift check)

Same rules as client_export.py (docs/adr/0001): the export is read only from AION2_EXPORT_DIR, no raw row, row id or table
dump is copied. Written: OUR compact per-step numbers for the upgrade groups that equipment actually references, keyed
by the client's group names (the same names items.json already carries), plus an item index and English material names.

Tables: Item (EnchantGroup, ExceedEnchantGroup, SurpassGroup, SoulbindCostName, SoulAddGroup), Enchant, ExceedEnchant,
ItemSurpass, SoulBindCost, ItemSoulAdd, L10N/en-US/L10NString (item and material names).

Per upgrade step (enchant / exceed / surpass) one row  [success, pity, drop, kinah, [[material, count], ...]]:
  success  the client's SuccessProb, in 1/10,000
  pity     FailCorrectionProb, 1/10,000 ADDED to success for each consecutive failure (the front-end's reading; there is
           no cap field in the tables, so the only cap is a total of 100%)
  drop     levels lost on a failure: |FailPenalty| (the client stores -1); 0 = the item stays where it is
  kinah    CostGold (every row is currency GoldCombined, asserted)
  material index into `materials`, count per ATTEMPT
The terminal row of a group (success 0, nothing to pay: the maximum level) is not stored; row i is the step i -> i+1.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from aion2c.data import build_items as bi

REPO = Path(__file__).resolve().parents[3]
OUT = REPO / "web" / "public" / "data" / "enhance.json"
ENV_VAR = bi.ENV_VAR
SOURCE = "client export 2026-10-04"
TABLES = ("Item", "Enchant", "ExceedEnchant", "ItemSurpass", "SoulBindCost", "ItemSoulAdd")
KINAH = "ECurrencyCategory::GoldCombined"
ITEM_FIELDS = ["id", "name", "il", "grade", "slot", "enchant", "exceed", "surpass", "soulbind", "souladd"]
STEP_FIELDS = ["success", "pity", "drop", "kinah", "materials"]


def export_dir() -> Path:
    raw = os.environ.get(ENV_VAR)
    if not raw:
        raise SystemExit(f"{ENV_VAR} is not set. Point it at the private client export's Table directory "
                         f"(it is never stored in this repo), then re-run `enhance_export`.")
    p = Path(raw)
    missing = [t for t in TABLES if not (p / f"{t}.json").is_file()]
    if missing:
        raise SystemExit(f"{ENV_VAR}={raw!r} is missing {', '.join(t + '.json' for t in missing)}")
    return p


class _Materials:
    """Interns material item names into `materials` and resolves their English names from Item + L10N."""

    def __init__(self, items_by_name: dict[str, dict], l10n: dict[str, str]):
        self._by_name, self._l10n = items_by_name, l10n
        self.names: list[str] = []
        self.ids: dict[str, int] = {}

    def __call__(self, name: str) -> int:
        if name not in self.ids:
            it = self._by_name.get(name)
            en = self._l10n.get(f"String_{it['Desc']['Key']}_body") if it else None
            if not en:
                raise ValueError(f"material {name!r} has no English name in Item/L10N")
            self.ids[name] = len(self.names)
            self.names.append(en)
        return self.ids[name]


def _steps(rows: list[dict], mat: _Materials, group: str) -> list[list]:
    """The step rows of one group (levels 0..N, N the terminal row) -> [success, pity, drop, kinah, [[mat, n], ...]]."""
    rows = sorted(rows, key=lambda r: r["CurrentLevel"])
    if [r["CurrentLevel"] for r in rows] != list(range(len(rows))):
        raise ValueError(f"{group}: levels are not 0..N")
    out = []
    for r in rows[:-1]:
        if r["CostGold"] and r["CostCurrencyType"] != KINAH:
            raise ValueError(f"{group}: kinah cost in an unexpected currency {r['CostCurrencyType']}")
        pen = r.get("FailPenalty", 0)
        if pen > 0:
            raise ValueError(f"{group}: positive FailPenalty {pen}")
        out.append([r["SuccessProb"], r["FailCorrectionProb"], -pen, r["CostGold"],
                    [[mat(c["Item"]), c["Count"]] for c in r["CostItems"]]])
    return out


def _by_group(rows: list[dict]) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for r in rows:
        out.setdefault(r["Group"], []).append(r)
    return out


def build(table_dir: Path) -> dict:
    rows = lambda n: bi._rows(table_dir, n)  # noqa: E731
    l10n = json.loads((table_dir / "L10N" / "en-US" / "L10NString.json").read_text(encoding="utf-8"))["Entries"]
    all_items = rows("Item")
    mat = _Materials({r["Name"]: r for r in all_items}, l10n)
    enchant, exceed, surpass = (_by_group(rows(t)) for t in ("Enchant", "ExceedEnchant", "ItemSurpass"))
    soulbind = {r["Name"]: r for r in rows("SoulBindCost")}
    souladd = {r["Group"]: r for r in rows("ItemSoulAdd")}

    def has_steps(table, g):
        return g != "None" and len(table.get(g, [])) > 1

    items, used = [], {"enchant": set(), "exceed": set(), "surpass": set(), "soulbind": set(), "souladd": set()}
    for it in all_items:
        if it["ItemType"] != "EItemType::Equip":
            continue
        e, x, s = it["EnchantGroup"], it["ExceedEnchantGroup"], it["SurpassGroup"]
        sb, sa = it.get("SoulbindCostName", "None"), it.get("SoulAddGroup", "None")
        e = e if has_steps(enchant, e) else None
        x = x if has_steps(exceed, x) else None
        s = s if has_steps(surpass, s) else None
        sb = sb if sb in soulbind else None
        sa = sa if sa in souladd else None
        if not (e or x or s or sb or sa):
            continue
        for key, g in (("enchant", e), ("exceed", x), ("surpass", s), ("soulbind", sb), ("souladd", sa)):
            if g:
                used[key].add(g)
        grade = bi._sid(it["ItemGrade"])
        items.append([it["ID"]["Value"], l10n[f"String_{it['Desc']['Key']}_body"], it["ItemLevel"],
                      bi.GRADE_NAME.get(grade, grade), bi.CATEGORY_SLOT[bi._sid(it["EquipCategory"])], e, x, s, sb, sa])
    items.sort(key=lambda r: r[0])

    sb_out = {}
    for g in sorted(used["soulbind"]):
        r = soulbind[g]
        sb_out[g] = {
            "steps": [[c["CostA_Amount"], [[mat(c["CostB_Id"]), c["CostB_Amount"]]]] for c in r["CostDatas"]],
            "reroll": [r["RerollCostCount"], [[mat(r["RerollCostItem"]), r["RerollCostItemCount"]]]],
        }
    sa_out = {g: [souladd[g]["SuccessProb"], souladd[g]["CostGold"],
                  [[mat(souladd[g]["CostItem"]), souladd[g]["CostItemCount"]]]] for g in sorted(used["souladd"])}
    return {
        "schema": 1, "source": SOURCE,
        "fields": {"item": ITEM_FIELDS, "step": STEP_FIELDS,
                   "soulbind": "steps [[kinah, [[material, count]]]] per level, reroll [kinah, [[material, count]]]",
                   "souladd": "[success 1/10000, kinah, [[material, count]]] for the one step"},
        "materials": mat.names,
        "items": items,
        "enchant": {g: _steps(enchant[g], mat, g) for g in sorted(used["enchant"])},
        "exceed": {g: _steps(exceed[g], mat, g) for g in sorted(used["exceed"])},
        "surpass": {g: _steps(surpass[g], mat, g) for g in sorted(used["surpass"])},
        "soulbind": sb_out,
        "souladd": sa_out,
    }


def dump(doc: dict) -> str:
    return json.dumps(doc, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def check(doc: dict, items_doc: dict) -> list[str]:
    """Drift between enhance.json and items.json (both committed; no export needed): every item they share must carry the
    same name, level, grade, slot and upgrade groups, and the success odds must equal the odds items.json stores."""
    problems = []
    ours = {r[0]: dict(zip(ITEM_FIELDS, r)) for r in doc["items"]}
    for it in items_doc["items"]:
        o = ours.get(it["id"])
        if o is None:
            if it.get("odds_group") or it.get("exceed_group"):
                problems.append(f"{it['id']}: in items.json with upgrade groups, missing from enhance.json")
            continue
        for k, v in (("name", it["name"]), ("il", it["il"]), ("grade", it["grade"]), ("slot", it["slot"]),
                     ("enchant", it.get("odds_group")), ("exceed", it.get("exceed_group"))):
            if o[k] != v:
                problems.append(f"{it['id']} {k}: enhance.json {o[k]!r} != items.json {v!r}")
    for g, steps in doc["enchant"].items():
        want = items_doc["enchant_odds"].get(g)
        if want is not None and [s[0] / 100 for s in steps] != want:
            problems.append(f"enchant {g}: odds {[s[0] / 100 for s in steps]} != items.json {want}")
    for g, steps in doc["exceed"].items():
        want = items_doc["exceed"].get(g, {}).get("odds")
        if want is not None and [s[0] / 100 for s in steps] != want:
            problems.append(f"exceed {g}: odds {[s[0] / 100 for s in steps]} != items.json {want}")
    return problems


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", action="store_true", help="drift check against items.json (no export needed)")
    a = ap.parse_args()
    if a.check:
        probs = check(json.loads(OUT.read_text(encoding="utf-8")),
                      json.loads(bi.OUT.read_text(encoding="utf-8")))
        for p in probs:
            print("MISMATCH", p)
        print(f"{len(probs)} mismatches")
        sys.exit(1 if probs else 0)
    doc = build(export_dir())
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(dump(doc), encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KiB): {len(doc['items'])} items, "
          f"{len(doc['enchant'])} enchant / {len(doc['exceed'])} exceed / {len(doc['surpass'])} surpass groups, "
          f"{len(doc['soulbind'])} soulbind, {len(doc['souladd'])} soul add", file=sys.stderr)


if __name__ == "__main__":
    main()
