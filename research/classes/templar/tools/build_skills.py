"""Merge parsed aion2.app + Metaroad data into skills.json (Sorcerer schema, data_contract.md section 1).

Run after parse_sources.py. Also prints source discrepancies (cooldown / MP / flat / spec text).
"""
import json
import re

R = "D:/Aion2/research/classes/templar"
APP_DATE = "aion2.app game client dump 2026-09-18 (page fetched 2026-10-03)"
MR_DATE = "Metaroad Templar datamine page retrieved 2026-10-03"
MR_URL = "https://metaroad.gg/aion2/database/skills/templar"

STIGMA_IDS = {12070000, 12110000, 12120000, 12190000, 12200000, 12220000, 12230000, 12250000,
              12310000, 12320000, 12410000, 12450000, 12700000}
CHAIN_ACTIVE_IDS = {12020000, 12030000, 12060000, 12330000, 12420000, 12440000}
# 12000000 is an unnamed "null" Bare Hands passive with no icon; excluded (see NOTES.md).
SKIP_IDS = {12000000}


def slug_dummy(s):
    return s


def num(x):
    if x is None:
        return None
    v = float(x)
    return int(v) if v == int(v) else v


def category(a):
    sid = a["skill_id"]
    if sid in STIGMA_IDS:
        return "stigma"
    if sid == 12000100:
        return "basic_dodge"
    if sid in CHAIN_ACTIVE_IDS:
        return "chain_or_hidden_active"
    return "passive" if a["client_type"] == "Passive" else "active"


def flat(s):
    return re.sub(r"\s+", " ", s or "").strip()


def stagger_from(desc):
    m = re.search(r"([\d]+(?:-[\d]+)?) Stagger Gauge Damage", desc or "")
    return m.group(1) if m else None


def build_entry(a, m, notes):
    sid = a["skill_id"]
    pl = a["per_level"]
    cat = category(a)
    r1, rN = pl[0], pl[-1]
    raw_det = a.get("details_raw", "")
    rng = None
    if m and m["fields"].get("Range"):
        rng = float(re.sub(r"[^\d.]", "", m["fields"]["Range"]))
    else:
        dm = re.search(r"Range([\d.]+) m", raw_det)
        if dm:
            rng = float(dm.group(1))
    desc = (m or {}).get("description") or flat(a["description_rank1"])
    if m is None:
        notes.append(f"{a['name']}: no Metaroad row")
    f = (m or {}).get("fields", {})
    coeff = None
    if f.get("Attack ratio"):
        ratio = float(f["Attack ratio"].rstrip("%"))
        mflat = float(f["Flat"]) if f.get("Flat") else None
        note = "Metaroad shows rank-1 ratio/flat; per-rank resolved damage in per_level"
        if mflat is not None and r1["dmg_min"] is not None and abs(mflat - r1["dmg_min"]) > 0.5:
            note += (f". SOURCE CONFLICT: aion2.app dump rank-1 flat = {num(r1['dmg_min'])}"
                     f"{'' if r1['dmg_max'] == r1['dmg_min'] else '-' + str(num(r1['dmg_max']))}, "
                     f"Metaroad = {num(mflat)} (Metaroad possibly newer patch)")
            notes.append(f"{a['name']}: flat conflict app {num(r1['dmg_min'])} vs metaroad {num(mflat)}")
        coeff = {"atk_ratio_pct_rank1": ratio, "flat_rank1": mflat,
                 "hits": int(f["Hits"]) if f.get("Hits") else None,
                 "stagger_gauge_damage": stagger_from(desc), "note": note}
    effects = []
    if m and m.get("variants"):
        effects.append(f"Metaroad variants (ranks): {m['variants']}")
    sg = stagger_from(desc)
    if sg:
        effects.append(f"Stagger gauge damage: {sg}")
    cd_max = rN["cooldown_s"]
    if cd_max != r1["cooldown_s"]:
        effects.append(f"Cooldown falls from {r1['cooldown_s']}s (rank 1) to {cd_max}s (rank {rN['level']}) per client")
    if r1["heal_min"] is not None:
        effects.append(f"Client heal per rank: rank 1 {num(r1['heal_min'])}-{num(r1['heal_max'])}, "
                       f"rank {rN['level']} {num(rN['heal_min'])}-{num(rN['heal_max'])}")
    # specs: prefer aion2.app (has levels and numbers); Metaroad hides some values as an em dash
    specs = a["specializations"] or (m or {}).get("specs") or []
    if m and a["specializations"] and len(m["specs"]) != len(a["specializations"]):
        notes.append(f"{a['name']}: spec count app {len(a['specializations'])} vs metaroad {len(m['specs'])}")
    per_level = []
    for p in pl:
        tok = dict(p["tokens"])
        if p["heal_min"] is not None:
            tok["client:heal_min"] = str(num(p["heal_min"]))
            tok["client:heal_max"] = str(num(p["heal_max"]))
        per_level.append({"level": p["level"], "dmg_min": p["dmg_min"], "dmg_max": p["dmg_max"],
                          "cooldown_s": p["cooldown_s"], "cost_mp": p["cost_mp"],
                          "cast_time_s": p["cast_time_s"], "tokens": tok})
    # cross-checks against Metaroad
    if m:
        if f.get("MP") and float(f["MP"]) != r1["cost_mp"]:
            notes.append(f"{a['name']}: MP app {r1['cost_mp']} vs metaroad {f['MP']}")
            effects.append(f"SOURCE CONFLICT: MP cost aion2.app {r1['cost_mp']} vs Metaroad {f['MP']}")
        if f.get("Cooldown") and float(f["Cooldown"].rstrip("s")) != r1["cooldown_s"]:
            notes.append(f"{a['name']}: CD app {r1['cooldown_s']} vs metaroad {f['Cooldown']}")
            effects.append(f"SOURCE CONFLICT: cooldown aion2.app dump {r1['cooldown_s']}s (all ranks) vs Metaroad/description {f['Cooldown']}")
    e = {
        "name": a["name"], "name_kr": a["name_kr"], "skill_id": sid, "category": cat,
        "client_type": None if cat == "basic_dodge" else (
            "Passive" if cat == "passive" else "Active"),
        "unlock_level": a["unlock_level"] if a["unlock_level"] is not None else None,
        "max_skill_level": a["max_skill_level"] or len(pl),
        "cooldown_s": float(r1["cooldown_s"]),
        "cooldown_s_at_max_level": num(cd_max) if cd_max != r1["cooldown_s"] else None,
        "cast_time_s": r1["cast_time_s"],
        "cost": {"mp": float(r1["cost_mp"]), "hp": r1["cost_hp"] or 0, "dp": r1["cost_dp"] or 0},
        "range_m": rng, "description": desc, "coefficients": coeff, "effects": effects,
        "specializations": specs, "properties": a["properties"],
        "damage_type_or_weapon": None, "per_level": per_level,
        "icon_url": f"https://aion2.app/db-item-icons/{a['icon']}.webp",
        "source_url": f"https://aion2.app/db/skills/{sid}",
        "source_url_secondary": MR_URL if m else None,
        "source_date": f"{APP_DATE}; {MR_DATE}" if m else APP_DATE,
    }
    if m and m["tag"]:
        e["metaroad_tag"] = m["tag"]
    return e


def build_idless(m):
    f = m["fields"]
    return {
        "name": m["name"], "name_kr": None, "skill_id": None, "category": "chain_or_system",
        "client_type": m["tag"], "unlock_level": None, "max_skill_level": None,
        "cooldown_s": float(f["Cooldown"].rstrip("s")) if f.get("Cooldown") else None,
        "cast_time_s": None,
        "cost": {"mp": float(f["MP"]) if f.get("MP") else None, "hp": None, "dp": None},
        "range_m": float(re.sub(r"[^\d.]", "", f["Range"])) if f.get("Range") else None,
        "description": None, "coefficients": None, "effects": [], "specializations": [],
        "icon_url": None, "source_url": MR_URL, "source_date": f"{MR_DATE}", "per_level": [],
    }


def main():
    app = {a["name"]: a for a in json.load(open(f"{R}/raw/parsed_app.json", encoding="utf-8"))
           if a["skill_id"] not in SKIP_IDS}
    mr = {m["name"]: m for m in json.load(open(f"{R}/raw/parsed_metaroad.json", encoding="utf-8"))}
    notes, out = [], []
    for a in sorted(app.values(), key=lambda x: x["skill_id"]):
        out.append(build_entry(a, mr.get(a["name"]), notes))
    for name, m in mr.items():
        if name not in app and name != "Basic Attack":
            out.append(build_idless(m))
    json.dump(out, open(f"{R}/skills.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(out), "entries written")
    print("\n".join(notes))


if __name__ == "__main__":
    main()
