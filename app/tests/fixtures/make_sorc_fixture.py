"""Second half of the fixture generator: the real-data sorcerer fixture + main().

Run from D:\\Aion2\\app:  python tests/fixtures/make_sorc_fixture.py
"""
import json
import re
import sys
from dataclasses import replace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_fixtures import *  # noqa: E402,F401,F403
from make_fixtures import BOTH, CAPS, C, E_, ICONS, RESEARCH, ROOT, build_mini  # noqa: E402
from aion2c.models import *  # noqa: E402,F403
from aion2c.serde import to_dict  # noqa: E402

SORC = {  # key -> skill_id
    "flame-arrow": 15210000, "burst": 15030000, "pyroclasm": 15250000, "firestorm": 15040000,
    "blaze": 15050000, "fire-mark": 15710000, "hellfire": 15060000, "element-enhancement": 15400000,
    "defiance": 15240000, "steel-barrier": 15160000, "bittercold-wind": 15280000,
    "frost-burst": 15220000, "winters-shackles": 15110000,
}
LONG_ANIM = {"firestorm": 1.5}


def real_skill(key, raw):
    cat = raw["category"]
    kind = {"stigma": SkillKind.STIGMA, "passive": SkillKind.PASSIVE,
            "chain_or_hidden_active": SkillKind.CHAIN}.get(cat, SkillKind.ACTIVE)
    tag = raw.get("metaroad_tag") or ""
    element = "fire" if "Fire" in tag else "water" if "Water" in tag else "none"

    def n(v):
        if v is None:
            return Num(None, "unknown", "no client value")
        return C(v, "aion2.app client dump 2026-09-18")

    ranks = tuple(
        RankData(p["level"], n(p["dmg_min"]), n(p["dmg_max"]), C(p["cooldown_s"], "client dump"),
                 C(p["cost_mp"], "client dump"))
        for p in raw["per_level"]
    )
    desc = raw["description"] or ""
    m_hits = re.search(r"\((\d+) hits\)", desc)
    m_aoe = re.search(r"up to (\d+) enemies", desc)
    ratio = (raw.get("coefficients") or {}).get("atk_ratio_pct_rank1")
    unlock = raw["unlock_level"]
    if unlock is None and kind == SkillKind.CHAIN:
        unlock = 1  # chain children inherit the parent's level (Flame Arrow = 1)
    icon = f"{key}.png" if (ICONS / f"{key}.png").exists() else None
    specs = tuple(Specialization(s.get("unlock_level"), s["text"]) for s in raw.get("specializations") or [])
    atk = Num(ratio, "estimated", "rank-1 ratio (metaroad)") if ratio is not None else Num(0.0, "unknown", "none")
    return Skill(
        key=key, skill_id=raw["skill_id"], name=raw["name"], name_kr=raw["name_kr"], kind=kind,
        element=element, unlock_level=unlock, max_rank=raw["max_skill_level"], regions=BOTH,
        atk_ratio_pct=atk, ranks=ranks, range_m=raw["range_m"],
        aoe_targets=int(m_aoe.group(1)) if m_aoe else 1, hits=int(m_hits.group(1)) if m_hits else 1,
        anim_lock_s=E_(LONG_ANIM.get(key, 1.0), "default, uncalibrated"), icon=icon, description=desc,
        tags=tuple(t.strip() for t in tag.split("\u00b7") if t.strip()), specializations=specs,
    )


def real_daevanion():
    d = json.load(open(RESEARCH / "daevanion_sorcerer.json", encoding="utf-8"))
    b = next(x for x in d["boards"] if x["key"] == "nezekan")
    nodes = {}
    for n in b["nodes"]:
        sk = n["skill_key"]
        if sk:
            sk = "winters-shackles" if sk == "winter_s_shackles" else sk.replace("_", "-")
        nodes[n["id"]] = DaevanionNode(
            n["id"], n["name"], n["rarity"], n["cost"], n["node_type"],
            tuple(DaevanionEffect(e["stat"], e["value"], e["unit"]) for e in n["effects"]),
            sk, tuple(n["adjacent"]), n["x"], n["y"])
    return {"nezekan": DaevanionBoard("nezekan", b["name"], b["unlock_level"], nodes, b["start_node_id"])}


def real_recipes(count=3):
    c = json.load(open(RESEARCH / "crafting.json", encoding="utf-8"))

    def mats(xs):
        return tuple(RecipeMaterial(x["item"], x["qty"], x.get("source")) for x in xs)

    out = []
    for r in c["recipes"]:
        if r.get("sorc_relevant") is not True:
            continue
        o = r["output"]
        out.append(Recipe(r["id"], r["name"], r["profession"], r["level"], o["item"], o["qty"],
                          o["item_level"], o["grade"], mats(r["materials"]),
                          mats(r["base_materials_expanded"]), True, r["source_url"]))
        if len(out) == count:
            break
    return tuple(out)


def roadmap():
    kr = frozenset({"korea"})

    def R(lv, k, t, rg=BOTH):
        return RoadmapItem(lv, k, t, rg)

    return (
        R(1, "zone", "Starting zone (Poeta / Ishalgen), levels 1-9"),
        R(5, "system", "Wings and Daeva ascension (Elyos 5 / Asmodian 6)"),
        R(10, "zone", "Verteron / Altgard; Crafting and Sealed Dungeon tier 1 unlock"),
        R(12, "daevanion", "Daevanion board 1: Nezekan"),
        R(20, "daevanion", "Daevanion board 2: Zikel"),
        R(20, "zone", "Krao Cave Exploration (IL 200)"),
        R(22, "stigma", "Stigma skills (13 per class) and stigma slot 1"),
        R(27, "stigma", "Stigma slot 2"),
        R(28, "zone", "Urugugu Canyon Exploration (IL 300)"),
        R(30, "daevanion", "Daevanion board 3: Vaizel"),
        R(30, "system", "Daily Dungeon"),
        R(32, "stigma", "Stigma slot 3"),
        R(35, "zone", "Fire Temple Exploration (IL 500)"),
        R(37, "stigma", "Stigma slot 4"),
        R(40, "daevanion", "Daevanion board 4: Triniel"),
        R(45, "daevanion", "Daevanion board 5: Azphel"),
        R(45, "system", "Story end, Conquest modes, Draupnir"),
        R(46, "zone", "Eltnen / Morheim (KR only)", kr),
        R(47, "system", "Chapter 1 / 2 content (KR only)", kr),
        R(50, "system", "KR level cap 50", kr),
    )


def build_sorc():
    skills_raw = json.load(open(RESEARCH / "sorcerer_skills.json", encoding="utf-8"))
    raws = {s["skill_id"]: s for s in skills_raw
            if s["skill_id"] in SORC.values() and s["category"] != "passive_proc"}
    skills = {k: real_skill(k, raws[i]) for k, i in SORC.items()}
    # data-driven tags (manual / role / gkey / thumb) come from the shipped mechanics file
    mech_tags = json.load(open(ROOT / "aion2c" / "data" / "src" / "mechanics.json", encoding="utf-8"))["skill_tags"]
    skills = {k: replace(s, tags=s.tags + tuple(mech_tags.get(k, ()))) for k, s in skills.items()}
    fire = frozenset({"fire"})
    statuses = {
        "fire_mark": Status("fire_mark", "Fire Mark", "target", E_(10, "default"), E_(1.0, "default"), fire),
        "element_enhancement": Status(
            "element_enhancement", "Element Enhancement", "self",
            Num(15.0, "unknown", "duration unknown, default 15 s"), E_(1.2, "+20% fire/water"),
            frozenset({"fire", "water"})),
        "grace_of_enhancement": Status(
            "grace_of_enhancement", "Grace of Enhancement", "self", E_(0, "passive"),
            E_(1.2, "+20% PvE; MP threshold 25 vs 50 conflicts"), frozenset(),
            mp_min_pct=25.0, source_skill="element-enhancement"),  # stand-in gate
    }
    rules = {r.skill_key: r for r in (
        SkillRule("flame-arrow", chain_next="burst", mp_restore=100),
        SkillRule("burst", chain_next="pyroclasm", mp_restore=100),
        SkillRule("pyroclasm", mp_restore=120),
        SkillRule("blaze", requires=("fire_mark",), mp_restore=100),
        SkillRule("element-enhancement", applies=("element_enhancement",)),
        SkillRule("hellfire", charge_levels=(
            ChargeLevel(1, E_(0), E_(1.0)), ChargeLevel(2, E_(1.0), E_(1.5)), ChargeLevel(3, E_(2.0), E_(2.0)))),
    )}
    links = (Link("flame-arrow", "burst", "chain", "confirmed"), Link("burst", "pyroclasm", "chain", "confirmed"),
             Link("fire-mark", "blaze", "condition", "confirmed"))
    comm = (CommunityRotation("s5-boss", "fixture", "boss_180",
                              ("element-enhancement", "hellfire", "blaze", "firestorm", "flame-arrow"), "fixture"),)
    return GameData(
        schema_version=1, data_version="sorc-fixture", built_at="2026-10-03T00:00:00Z", **CAPS,
        skills=skills, statuses=statuses, rules=rules,
        triggers=(StatusTrigger("fire_mark", "fire", 0.2, "fire-mark"),), links=links, community=comm,
        roadmap=roadmap(), daevanion=real_daevanion(), recipes=real_recipes(),
    )


def dump(gd, path, indent=None):
    text = json.dumps(to_dict(gd), indent=indent, separators=None if indent else (",", ":"))
    Path(path).write_text(text, encoding="utf-8")


if __name__ == "__main__":
    fx = ROOT / "tests" / "fixtures"
    dump(build_mini(), fx / "mini_gamedata.json", indent=1)
    sorc = build_sorc()
    dump(sorc, fx / "sorc_gamedata_small.json")
    dump(sorc, ROOT / "aion2c" / "data" / "fallback_gamedata.json")
    print("fixtures written")
