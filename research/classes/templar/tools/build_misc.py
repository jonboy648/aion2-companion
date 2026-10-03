"""chains.json, community_rotations.json, roadmap.json for the Templar."""
import json
from collections import defaultdict

R = "D:/Aion2/research/classes/templar"
SORC_ROADMAP = "D:/Aion2/app/aion2c/data/src/roadmap.json"


def L(parent, child, kind, conf, note):
    return {"parent": parent, "child": child, "kind": kind, "confidence": conf, "note": note}


def chains():
    links = [
        L(12010000, 12020000, "chain", "confirmed", "Vicious Strike > Decisive Strike, 1/3 2/3 in the aion2.app Chain panel"),
        L(12020000, 12030000, "chain", "confirmed", "Decisive Strike > Desperate Strike, 2/3 3/3 (its own page also shows 1/2 2/2)"),
        L(12040000, 12060000, "chain", "confirmed", "Pummel > Punishing Strike, 1/2 2/2 in the Chain panel"),
        L(12010000, 12440000, "chain", "estimated", "Vicious Strike spec rank 16: 'Adds [Threatening Blow] Chain Skill' (gegebase calls it the chain finisher; step position unknown)"),
        L(12260000, 12330000, "chain", "estimated", "Defiance spec rank 8: 'Adds [Capture] Chain Skill'; Capture cooldown 120 -> 42 s over ranks"),
        L(12090000, "Punishment - Level 1", "charge", "estimated", "charge tier of one skill (Metaroad id-less row)"),
        L(12090000, "Punishment - Level 2", "charge", "estimated", "charge tier of one skill (Metaroad id-less row)"),
        L(12090000, "Punishment - Max", "charge", "estimated", "charge tier of one skill (Metaroad id-less row)"),
        L(12430000, "Shield Rush - Max", "charge", "estimated", "Shield Rush spec rank 8 'Changes to Charge Skill'; Metaroad id-less row"),
        L(12070000, 12240000, "condition", "confirmed", "Doom Shield 'Triggers [Judgment] for 3s'"),
        L(12100000, 12240000, "condition", "confirmed", "Shield Smite 'Triggers [Judgment] for 2s'"),
        L(12430000, 12240000, "condition", "confirmed", "Shield Rush 'Triggers [Judgment] for 2s'"),
        L(12350000, 12240000, "condition", "confirmed", "Warding Strike 'Triggers [Judgment] for 2s'"),
        L(12070000, 12300000, "condition", "estimated", "Annihilate needs a Stun/Knockdown target; Doom Shield knocks down and spec rank 5 resets Annihilate (text-based)"),
        L(12100000, 12300000, "condition", "estimated", "Annihilate needs a Stun/Knockdown target; Shield Smite stuns (text-based)"),
    ]
    return {"_comment": "data_contract.md section 2 for the Templar. 'confirmed' = client Chain panel or explicit description text; 'estimated' = inferred from spec text. Debilitating Smash is also a spec proc of Shield Smite (50% on hit) but is a normal castable skill, so it is not linked as a child (that would make the app treat it as never castable).",
            "links": links, "unlinked": [12420000],
            "stagger_condition_only": [12340000]}


def rotations():
    couga = "https://couga54.github.io/aion2-guides/en/templar/"
    gege = "https://gegebase.com/games/aion2/templar_pve_guide"
    return [
        {"key": "s6-global-boss", "source": couga, "scenario_key": "boss_180",
         "priority": ["battlefield-banner", "punishment", "empyrean-lords-punishment", "judgment", "shield-smite",
                      "doom-shield", "warding-strike", "annihilate", "debilitating-smash", "pummel", "vicious-strike"],
         "note": "S6 (2026-10-03, Global S1, opinion; SolAshur build via couga54). Source gives three inputs: side-button Judgment line (Judgment > Shield Smite > Warding Strike > Doom Shield, 'Judgment always wins'), RMB Pummel macro line (Annihilate > Debilitating Smash > Flash Rampage > Pummel), LMB Vicious Strike, and by hand charged Punishment, Battlefield Banner, Empyrean Lord's Punishment, Taunt. Merging them into one list, with the hand-cast items first, is my reading. Flash Rampage left out (Staggered targets only), Taunt left out (aggro tool)."},
        {"key": "s6-global-pvx-aoe", "source": couga, "scenario_key": "aoe_pack",
         "priority": ["battlefield-banner", "punishment", "doom-shield", "judgment", "shield-smite", "empyrean-lords-punishment",
                      "annihilate", "debilitating-smash", "warding-strike", "pummel", "vicious-strike"],
         "note": "Same guide's PvX preset: Doom Shield takes the top priority of the RMB line (rush + guaranteed knockdown on NPCs unlocks Annihilate, resets on a kill at spec 15). Mapping PvX to the aoe_pack scenario is my assumption."},
        {"key": "s6-global-level-pull", "source": couga, "scenario_key": "level_pull",
         "priority": ["punishment", "shield-smite", "judgment", "annihilate", "warding-strike", "poach", "pummel", "vicious-strike"],
         "note": "Leveling section of the same guide (opinion): packs 'Poach one in, Warding Strike, hold Vicious Strike + Pummel macro'; elites 'charged Punishment, Shield Smite (stun), Judgment, Annihilate'. Combined order is my reading."},
        {"key": "gegebase-sep-tank-boss", "source": gege, "scenario_key": "boss_180",
         "priority": ["taunt", "punishment", "judgment", "shield-smite", "warding-strike", "vicious-strike", "pummel"],
         "note": "Beginner tank rotation, September 2026 (opinion, KR-derived, written before Global): Taunt > Punishment > Vicious Strike chain > Judgment > Shield Smite > Pummel > Punishing Strike > Judgment, Warding Strike for big hits. Advanced loop adds the CDR links (Vicious Strike reduces Warding Strike cooldown, Pummel chain reduces Punishment cooldown); those specs are not modelled."},
        {"key": "trueeevil-solo-boss", "source": couga, "scenario_key": "boss_180",
         "priority": ["executing-blade", "punishment", "judgment", "doom-shield", "shield-smite", "annihilate", "pummel", "vicious-strike"],
         "note": "Day-two solo PvE pick quoted by couga54 from trueeevil (opinion): open with Executing Blade, then Punishment; stigmas Executing Blade, Empyrean Lord's, Doom Shield, Nezekan's Shield. Remainder of the order follows the S6 Judgment line."},
    ]


def roadmap():
    skills = json.load(open(f"{R}/skills.json", encoding="utf-8"))
    by_level = defaultdict(list)
    for s in skills:
        if s["unlock_level"] is not None and s["category"] in ("active", "passive", "basic_dodge"):
            by_level[s["unlock_level"]].append(s["name"] + (" (passive)" if s["category"] == "passive" else ""))
    out = [r for r in json.load(open(SORC_ROADMAP, encoding="utf-8")) if r["kind"] != "skill"]
    for lvl, names in by_level.items():
        out.append({"level": lvl, "kind": "skill", "text": "Templar skill unlock: " + ", ".join(sorted(names)),
                    "regions": ["global", "korea"]})
    order = {"zone": 0, "skill": 1, "system": 2, "stigma": 3, "gear": 4, "daevanion": 5}
    out.sort(key=lambda r: (r["level"], order[r["kind"]]))
    return out


if __name__ == "__main__":
    json.dump(chains(), open(f"{R}/chains.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    json.dump(rotations(), open(f"{R}/community_rotations.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    rm = roadmap()
    json.dump(rm, open(f"{R}/roadmap.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(len(rm), "roadmap items")
