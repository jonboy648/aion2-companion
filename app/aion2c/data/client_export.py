"""Regenerate app/aion2c/data/src/client_skill_numbers.json from the PRIVATE client table export.

The export is NOT part of this repo and must never be copied into it. Point the environment variable
AION2_EXPORT_DIR at the exported `Table` directory (the one holding SkillEffectLv.json, SkillList.json, L10N/...):

    set AION2_EXPORT_DIR=<path to the exported Table directory>
    python -m aion2c.data.client_export            (from app/)

Only OUR derived numbers are written, keyed by our own skill keys (flat damage per rank, ATK ratio, hit counts,
charge tiers/timing, DoT tick data). No raw tables, row ids or strings are copied; skill names are used only to
cross-check a match and are not stored.

How a skill of ours is tied to client rows (the real skill -> effect link lives in tables that did not decode):
  1. name rule: skill id 1CNNxxxx -> effect groups `<Class>_Skill0NN_...` (spec-variant groups `_A3_`, `_B_` ... skipped);
  2. fallback: a class-wide damage group whose flat-per-rank sequence equals ours exactly (and whose ratio equals
     ours when ours is non-zero) - accepted only when every such group belongs to ONE client skill number;
  3. a skill whose flat damage in the client table disagrees with ours at any rank is NOT matched (reported).
The first group found in step 1/2 supplies ratio, hits and flats; siblings (`_01.._05` parts) are not summed.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

from aion2c.data import build_gamedata as bg

ENV_VAR = "AION2_EXPORT_DIR"
OUT_PATH = bg.SRC_DIR / "client_skill_numbers.json"
SOURCE = "client export 2026-10-04"
# our class key -> client class prefix / L10N class token
CLIENT_CLASS = {
    "sorcerer": "Sorcerer", "gladiator": "Gladiator", "cleric": "Cleric", "chanter": "Chanter",
    "ranger": "Ranger", "assassin": "Assassin", "templar": "Templar", "spiritmaster": "Elementalist",
}
# DoT groups the name rule cannot find. Cold Storm's Frostbite (client text token se_abe_dmg:1520000211) sits in a group
# named after Glacial Smite's animation number (012); Glacial Smite itself has no DoT in its text, and the top-rank flat
# 1497 equals the one our dump carries for Frostbite. Claimed groups are not offered to the name rule.
DOT_GROUP_OVERRIDES = {("sorcerer", "cold-storm"): "Sorcerer_Skill012_LvUp_AB01"}
_VARIANT_TOKEN = re.compile(r"^(?:A\d+(?:A\d+)*|[A-E]{1,5})$")


def export_dir() -> Path:
    raw = os.environ.get(ENV_VAR)
    if not raw:
        raise SystemExit(f"{ENV_VAR} is not set. Point it at the private client export's Table directory "
                         f"(it is never stored in this repo), then re-run.")
    p = Path(raw)
    if not (p / "SkillEffectLv.json").is_file():
        raise SystemExit(f"{ENV_VAR}={raw!r} has no SkillEffectLv.json; it must be the exported Table directory.")
    return p


def _f(x) -> float | None:
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def _rows(table_dir: Path, name: str) -> list[dict]:
    return json.loads((table_dir / f"{name}.json").read_text(encoding="utf-8"))["Properties"]["Data"]


class Tables:
    """The few client tables this script reads, regrouped. `eff[group][level] -> EffectValueList` (damage-shaped
    groups only), `abn[group][level] -> Values` (all), `charge[skill_id] -> (min_ms, [tier_ms])`."""

    def __init__(self, table_dir: Path):
        self.eff: dict[str, dict[int, list[str]]] = defaultdict(dict)
        for r in _rows(table_dir, "SkillEffectLv"):
            v = r["EffectValueList"]
            if len(v) == 28 and all(_f(x) is not None for x in v[:5]):
                self.eff[r["SkillEffectLvGroupId"]][r["SkillEffectLv"]] = v
        self.abn: dict[str, dict[int, list[str]]] = defaultdict(dict)
        for r in _rows(table_dir, "SkillAbnormalEffectLv"):
            self.abn[r["AbnormalEffectLevelGroupId"]][r["AbnormalEffectLevel"]] = r["Values"]
        self.charge: dict[int, tuple[int, list[int]]] = {}
        for r in _rows(table_dir, "SkillCharge"):
            self.charge[r["ID"]["Value"]] = (
                r["ChargeMinTime"], [x["ChargeTime"] for x in r["SkillChargeDataList"]])
        self.hud_ids = {i for r in _rows(table_dir, "SkillList") for i in r["SkillIdList"]}
        l10n = table_dir / "L10N" / "en-US" / "L10NString.json"
        entries = json.loads(l10n.read_text(encoding="utf-8"))["Entries"] if l10n.is_file() else {}
        self.names = {k: v for k, v in entries.items() if k.startswith("SkillString_STR_SKILL_PC_") and k.endswith("_skill_name")}


def _flat_seq(group: dict[int, list[str]], idx: int = 0) -> list[float]:
    return [float(group[lv][idx]) for lv in sorted(group)]


def _name_candidates(t: Tables, cp: str, sid: int) -> list[str]:
    nn = sid // 10000 % 100
    pre = f"{cp}_Skill{nn:03d}_"
    out = []
    for g in t.eff:
        if not g.startswith(pre):
            continue
        tok = g[len(pre):].split("_", 1)[0]
        if _VARIANT_TOKEN.match(tok) and tok != "LvUp":
            continue
        out.append(g)
    return sorted(out, key=lambda g: (len(g), g))


def _eq_prefix(ours: list[float], seq: list[float]) -> bool:
    """Our ranks 2..N equal the client's levels 2..N over their common span (>= 3 levels)."""
    n = min(len(ours), len(seq))
    return n >= 3 and ours[:n] == seq[:n]


def match_skill(t: Tables, cp: str, sid: int | None, flats: list[float], ratio: float) -> tuple[str | None, str]:
    """(group, how) for one of our skills with flat data; (None, reason) when not matched."""
    if sid is None:
        return None, "no skill id"
    ours = flats[1:]  # ranks 2..N: the client table has no level 1
    for g in _name_candidates(t, cp, sid):
        if _eq_prefix(ours, _flat_seq(t.eff[g])):
            return g, "name"
    pool = [g for g in t.eff if g.startswith(cp + "_") and not re.search(r"_(?:A\d+(?:A\d+)*|[A-E]{1,5})_", g)]
    hits = [g for g in pool if _eq_prefix(ours, _flat_seq(t.eff[g]))]
    if ratio:
        hits = [g for g in hits if abs(float(t.eff[g][min(t.eff[g])][2]) / 100 - ratio) < 1e-6] or hits
    owners = {"_".join(g.split("_")[:2]) for g in hits}
    if len(owners) == 1:
        return sorted(hits, key=lambda g: (len(g), g))[0], "sequence"
    if not hits:
        near = [g for g in _name_candidates(t, cp, sid)
                if ratio and abs(float(t.eff[g][min(t.eff[g])][2]) / 100 - ratio) < 1e-6]
        return None, ("name-rule group %s has the same ratio but different flat damage" % near[0] if near
                      else "no client group with this flat sequence")
    return None, f"ambiguous: {len(owners)} client skills share this flat sequence"


def _group_numbers(group: dict[int, list[str]]) -> dict:
    lv0 = min(group)
    ratios = {float(v[2]) / 100 for v in group.values()}
    return {
        "ratio_pct": float(group[lv0][2]) / 100,
        "ratio_constant": len(ratios) == 1,
        "hits": int(float(group[lv0][4])),
        "from_rank": lv0,
        "flat_min": [int(float(group[lv][0])) for lv in sorted(group)],
        "flat_max": [int(float(group[lv][1])) for lv in sorted(group)],
    }


def _charge(t: Tables, cp: str, sid: int, group: str) -> dict | None:
    """Charge timing (SkillCharge) and per-tier damage groups (`<base>`, `<base>_0`, `_1`, ... or Ranger-style
    `Charge01..` siblings) for a base skill that has a SkillCharge row."""
    row = t.charge.get(sid)
    if row is None:
        return None
    min_ms, tier_ms = row
    out: dict = {"min_ms": min_ms, "tier_ms": tier_ms}
    fast = sorted({tuple(v[1]) for k, v in t.charge.items() if k // 10000 == sid // 10000 and k != sid and v[1]
                   and v[1] != tier_ms and len(v[1]) == len(tier_ms)})
    if fast:
        out["alt_tier_ms"] = [list(f) for f in fast]
    n = len(tier_ms) + 1
    names = [group] + [f"{group}_{i}" for i in range(n - 1)]
    if not all(g in t.eff for g in names):
        ch = group.replace("_LvUp", "")
        names = [group] + [g for i in range(1, n) for g in (f"{ch}_Charge{i:02d}_LvUp",) if g in t.eff]
    if len(names) == n and all(g in t.eff for g in names):
        out["tiers"] = [{k: v for k, v in _group_numbers(t.eff[g]).items() if k in ("ratio_pct", "hits", "flat_min")}
                        for g in names]
    return out


def _dot_shape(rows: dict[int, list[str]]) -> bool:
    v = rows[min(rows)]
    return len(v) >= 7 and _f(v[0]) is not None and v[1] in ("TRUE", "FALSE") and _f(v[3]) is not None and _f(v[5]) is not None


def _dots(t: Tables, cp: str, sid: int, ck: str, key: str) -> dict:
    """DoT tick data of abnormal groups `<Class>_Skill0NN_LvUp_AB0x` (interval ms, flat per rank, ATK ratio)."""
    nn = sid // 10000 % 100
    pre = f"{cp}_Skill{nn:03d}_LvUp_AB"
    claimed = set(DOT_GROUP_OVERRIDES.values())
    names = sorted(g for g in t.abn if g.startswith(pre) and g not in claimed and _dot_shape(t.abn[g]))
    if (ck, key) in DOT_GROUP_OVERRIDES:
        names = [DOT_GROUP_OVERRIDES[(ck, key)]]
    out = {}
    for g in names:
        rows = t.abn[g]
        if not _dot_shape(rows):
            continue
        lv0 = min(rows)
        out[g.rsplit("_", 1)[1]] = {
            "interval_ms": int(float(rows[lv0][0])),
            "ratio_pct": float(rows[lv0][5]) / 100,
            "from_rank": lv0,
            "flat": [int(float(rows[lv][3])) for lv in sorted(rows)],
        }
    return out


def class_skills(ck: str, research_dir: Path, icons_dir: Path) -> list[dict]:
    """Our skills for one class from the research pack (same inputs and key rule as build_gamedata.build)."""
    srcs = bg.ClassSources(research_dir, icons_dir, ck)
    raw = json.loads(srcs.skills.read_text(encoding="utf-8"))
    index = json.loads(srcs.index.read_text(encoding="utf-8"))
    keys = bg.assign_keys(raw, index, lenient=ck != "sorcerer")
    out = []
    for r, k in zip(raw, keys):
        per = r.get("per_level") or []
        out.append({
            "key": k, "skill_id": r.get("skill_id"), "name": r["name"],
            "flats": [float(p["dmg_min"] or 0) for p in per],
            "ratio": float((r.get("coefficients") or {}).get("atk_ratio_pct_rank1") or 0.0),
        })
    return out


def extract_class(t: Tables, ck: str, research_dir: Path, icons_dir: Path) -> dict:
    cp = CLIENT_CLASS[ck]
    token = cp.upper()
    skills, unmatched, mismatch, name_diff = {}, {}, [], []
    for s in class_skills(ck, research_dir, icons_dir):
        sid = s["skill_id"]
        has_flat = any(s["flats"])
        entry: dict = {}
        if has_flat or (s["ratio"] and sid):
            g, how = match_skill(t, cp, sid, s["flats"], s["ratio"]) if has_flat else (None, "no flat data to match on")
            if g is None and not has_flat and sid:  # ratio-only skill: name rule on ratio equality, flat-less
                for cand in _name_candidates(t, cp, sid):
                    if abs(float(t.eff[cand][min(t.eff[cand])][2]) / 100 - s["ratio"]) < 1e-6:
                        g, how = cand, "name+ratio"
                        break
            if g is None:
                unmatched[s["key"]] = how
            else:
                entry.update(_group_numbers(t.eff[g]))
                entry["how"] = how
                ch = _charge(t, cp, sid, g)
                if ch:
                    entry["charge"] = ch
                    if "tiers" in ch:
                        entry["hits"] = max(x["hits"] for x in ch["tiers"])
                if not entry["ratio_constant"]:
                    mismatch.append(s["key"])
        dots = _dots(t, cp, sid, ck, s["key"]) if sid else {}
        if dots:
            entry["dots"] = dots
        if sid:
            nm = t.names.get(f"SkillString_STR_SKILL_PC_{token}_{sid}_skill_name")
            if nm is not None and nm.lower().replace("'", "") != s["name"].lower().replace("'", ""):
                name_diff.append(f"{s['key']}: ours {s['name']!r} vs client {nm!r}")
        if entry:
            skills[s["key"]] = entry
    return {"skills": skills, "unmatched": unmatched, "ratio_varies": mismatch, "name_differs": name_diff}


def build(table_dir: Path, research_dir: Path, icons_dir: Path) -> dict:
    t = Tables(table_dir)
    return {"schema": 1, "source": SOURCE,
            "note": "derived numbers keyed by our skill keys; ranks start at from_rank (client has no level 1)",
            "classes": {ck: extract_class(t, ck, research_dir, icons_dir) for ck in CLIENT_CLASS}}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--research", type=Path, default=bg.REPO / "research")
    ap.add_argument("--icons", type=Path, default=bg.REPO / "assets" / "icons")
    ap.add_argument("--out", type=Path, default=OUT_PATH)
    a = ap.parse_args()
    data = build(export_dir(), a.research, a.icons)
    a.out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":"), sort_keys=True), encoding="utf-8")
    for ck, c in data["classes"].items():
        print(f"[{ck}] {len(c['skills'])} skills with client numbers, {len(c['unmatched'])} unmatched: "
              f"{', '.join(c['unmatched']) or '-'}", file=sys.stderr)
    print(f"wrote {a.out} ({a.out.stat().st_size // 1024} KiB)", file=sys.stderr)


if __name__ == "__main__":
    main()
