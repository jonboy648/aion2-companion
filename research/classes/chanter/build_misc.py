"""chains.json, community_rotations.json, roadmap.json for the Chanter."""
import json

SRC = "D:/Aion2/app/aion2c/data/src/roadmap.json"
sk = json.load(open("skills.json", encoding="utf-8"))
ID = {s["name"]: s["skill_id"] for s in sk if s["skill_id"] and s["skill_id"] != 18080037}


def L(parent, child, kind, conf, note):
    return {"parent": ID.get(parent, parent) if isinstance(parent, str) else parent,
            "child": ID.get(child, child) if isinstance(child, str) else child,
            "kind": kind, "confidence": conf, "note": note}


links = [
    L("Onslaught", "Resonance Crush", "chain", "confirmed", "client Chain panel: Onslaught 1/3 > Resonance Crush 2/3 > Bolt Crush 3/3"),
    L("Resonance Crush", "Bolt Crush", "chain", "confirmed", "client Chain panel 3/3; Resonance Crush page also shows 1/2 > 2/2"),
    L("Onslaught", "Storm Chain", "chain", "confirmed", "Onslaught specialty rank 16 'Adds [Storm Chain] Chain Skill' (aion2.app + Metaroad)"),
    L("Incandescent Blow", "Bursting Blow", "chain", "confirmed", "client Chain panel: Incandescent Blow 1/2 > Bursting Blow 2/2"),
    L("Impactful Crush", "Crushing Blow", "chain", "estimated", "KR patch 2026-08-26 says Impactful Crush spec 4 used to be a 'Crushing Blow follow-up'; global client lists no parent"),
    L("Dark Crush", "Piercing Strike", "chain", "confirmed", "Dark Crush specialty rank 12 'Adds [Piercing Strike] Chain Skill'"),
    L("Defiance", "Crushing Strike", "chain", "confirmed", "Defiance specialty rank 8 'Adds [Crushing Strike] Chain Skill'"),
    L("Tremor Crush", "Surging Strike", "chain", "confirmed", "Tremor Crush specialty rank 12 'Adds [Surging Strike] Chain Skill'"),
    L("Wave Blow", 18080037, "proc", "estimated", "same name and text as Wave Blow, Max 1, id suffix 37 (proc-child pattern like Sorcerer Frost Burst 15220037); 'changing the skill motion'"),
    L("Rushing Smash", "Rushing Smash - Level 1", "charge", "estimated", "Metaroad charge tier row (no client id)"),
    L("Rushing Smash", "Rushing Smash - Level 2", "charge", "estimated", "Metaroad charge tier row (no client id)"),
    L("Rushing Smash", "Rushing Smash - Max", "charge", "estimated", "Metaroad charge tier row (no client id)"),
    L("Rushing Smash", "Heat Wave Blow", "proc", "estimated", "Rushing Smash specialty rank 8: 50% chance to trigger [Heat Wave Blow] on hit"),
    L("Impactful Crush", "Dark Crush", "condition", "confirmed", "'[Dark Crush] becomes available for 2s on skill use'"),
    L("Spinning Strike", "Dark Crush", "condition", "confirmed", "'[Dark Crush] becomes available for 2s on skill use'"),
    L("Ensnaring Mark", "Dark Crush", "condition", "confirmed", "'[Dark Crush] becomes available for 3s on skill use'"),
    L("Marchutan's Wrath", "Dark Crush", "condition", "confirmed", "'[Dark Crush] becomes available for 3s on skill use'; KR patch lowered 7s to 3s"),
]
chains = {
    "_comment": "Same shape as aion2c/data/src/chains.json. 'confirmed' = stated in client text; 'estimated' = inferred.",
    "links": links,
    "unlinked": [ID["Dodge"]],
    "stagger_condition_only": [ID["Gust Rampage"], ID["Raging Spell"]],
}
json.dump(chains, open("chains.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)

com = [
    {"key": "aoeah-macro", "source": "https://www.aoeah.com/news/4806--best-aion-2-chanter-builds-skills--macro-setup-2026-pvp--pve",
     "scenario_key": "boss_180",
     "priority": ["spinning-strike", "impactful-crush", "marchutans-wrath", "ensnaring-mark", "bursting-blow", "incandescent-blow", "onslaught"],
     "note": "aoeah, 2026-09-10 (opinion): macro order 'Spinning Strike > Impactful Crush > Marchutan's Wrath > Ensnaring Mark > Bursting Blow > Incandescent Blow > auto-attack cycle'; Rushing Smash left out of the macro and pressed by hand; Dark Crush fired on its window. Onslaught stands in for the auto-attack cycle."},
    {"key": "pixelnitro-pve", "source": "https://pixelnitro.com/?p=20617", "scenario_key": "boss_180",
     "priority": ["incandescent-blow", "dark-crush", "wave-blow", "heat-wave-blow", "spinning-strike"],
     "note": "pixelnitro, 2026-09-27 (opinion): Incandescent Blow opens, Dark Crush the moment it triggers, Wave Blow for the heavy phase, Heat Wave Blow in vulnerability windows, Spinning Strike fills cooldown gaps."},
    {"key": "couga54-global", "source": "https://couga54.github.io/aion2-guides/en/chanter/", "scenario_key": "boss_180",
     "priority": ["dark-crush", "spinning-strike", "impactful-crush", "incandescent-blow", "onslaught"],
     "note": "couga54 guides, 2026-10-03 (opinion, Global S1): hotbar priority Dark Crush > Spinning Strike > Impactful Crush > Incandescent Blow, Onslaught spammed between; Marchutan's Wrath by hand when Dark Crush is unavailable."},
    {"key": "gegebase-sustained", "source": "https://gegebase.com/games/aion2/chanter_pve_guide", "scenario_key": "boss_180",
     "priority": ["spinning-strike", "dark-crush", "incandescent-blow", "bursting-blow", "impactful-crush", "onslaught"],
     "note": "gegebase (opinion, date not shown): sustained loop Spinning Strike > Dark Crush > Incandescent/Bursting Blow > Impactful Crush > Onslaught chain; opener starts with Undefeated Mantra (toggle, not in list)."},
    {"key": "aoeah-trash", "source": "https://www.aoeah.com/news/4806--best-aion-2-chanter-builds-skills--macro-setup-2026-pvp--pve",
     "scenario_key": "aoe_pack",
     "priority": ["fracturing-blow", "tremor-crush", "incandescent-blow", "bursting-blow", "onslaught"],
     "note": "aoeah, 2026-09-10 (opinion): Fracturing Blow / Tremor Crush for trash packs; the AoE basics after them are our fill, not from the source."},
]
json.dump(com, open("community_rotations.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)

base = [r for r in json.load(open(SRC, encoding="utf-8")) if not r["text"].startswith("Sorcerer skill unlock")]
UNLOCK = [(1, "Onslaught, Incandescent Blow, Rushing Smash, Blessing of Life"), (3, "Impactful Crush"), (4, "Dark Crush"),
          (5, "Gust Rampage"), (6, "Crossguard"), (7, "Heat Wave Blow"), (8, "Recuperation"), (9, "Protection Circle"),
          (10, "Tremor Crush"), (11, "Inspiring Spell"), (12, "Wave Blow"), (13, "Attack Preparation"),
          (14, "Spinning Strike"), (15, "Impact Hit"), (16, "Defiance"), (17, "Raging Spell"), (21, "Earth's Promise"),
          (23, "Survival Willpower"), (25, "Wind's Promise")]
new = [{"level": lv, "kind": "skill", "text": f"Chanter skill unlock: {t}", "regions": ["global", "korea"]} for lv, t in UNLOCK]
out = base + new
out.sort(key=lambda r: r["level"])  # stable: shared rows keep their order within a level
json.dump(out, open("roadmap.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(len(links), "links", len(com), "rotations", len(out), "roadmap rows")
