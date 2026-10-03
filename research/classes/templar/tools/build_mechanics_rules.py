"""Part 2 of the mechanics build: rules, triggers, tags, anim lock; writes mechanics.json and chains.json."""
import json

from build_mechanics import APP, DUMP, MR, N, R, build_statuses

SRC_SPEC = "description text of the skill and its aion2.app Chain panel"
WINDOW = 3.0  # chain window, same assumption the Sorcerer file makes


def rule(key, applies=(), chance=1.0, requires=(), consumes=(), chain_next=None, charge=(), mp=0.0,
         conf="estimated", note=""):
    return {"skill_key": key, "applies": list(applies), "apply_chance": chance, "requires": list(requires),
            "consumes": list(consumes), "chain_next": chain_next, "chain_window_s": WINDOW,
            "charge_levels": list(charge), "mp_restore": mp, "confidence": conf, "note": note}


NPC = "100% on NPC targets per description (player chance lower); bosses may be immune to CC (Annihilate text: 'Has a 5% chance to trigger when attacking a target with Incapacitated Immunity'), not modelled"


def build_rules():
    r = {}
    r["vicious-strike"] = rule("vicious-strike", chain_next="decisive-strike", mp=100.0,
        note="chain 1/3 (client Chain panel), restores 100 MP (description); chain window assumed 3 s")
    r["decisive-strike"] = rule("decisive-strike", chain_next="desperate-strike", mp=100.0,
        note="chain 2/3, restores 100 MP (description)")
    r["desperate-strike"] = rule("desperate-strike", mp=120.0, note="chain 3/3, restores 120 MP (description). Threatening Blow (restores 150 MP) is added as an extra chain step by Vicious Strike spec rank 16; not auto-chained here")
    r["threatening-blow"] = rule("threatening-blow", mp=150.0, note="restores 150 MP (description); only exists as a chain skill after Vicious Strike spec rank 16")
    r["pummel"] = rule("pummel", chain_next="punishing-strike",
        note="chain 1/2 (client Chain panel); Pummel costs 120 MP, Vicious Strike refills it. Spec rank 16 fires Punishing Strike one extra time (not modelled)")
    levels = []
    for lvl, mult, conf, src in (
        (1, 1.0, "confirmed", f"Metaroad ratio range 430.5-1291.5% and dump flat 1268-3805: level 1 is the minimum ({MR}, {DUMP})"),
        (2, 2.0, "estimated", "linear midpoint between the confirmed endpoints; no source gives the middle level"),
        (3, 3.0, "confirmed", f"max/min = 3.0 for both ratio (1291.5/430.5) and flat (3805/1268) ({MR}, {DUMP})")):
        levels.append({"level": lvl, "charge_s": N(None, "unknown", "charge time per level is not published; record a full charge in game to fill in"),
                       "dmg_mult": N(mult, conf, src)})
    r["punishment"] = rule("punishment", applies=["executor"], charge=levels,
        note="Max 3 charge levels; Executor +20% PvE Damage Boost for 20 s on hit. Spec rank 8 'Damage over Time on hit' has no published tick values (not modelled)")
    r["doom-shield"] = rule("doom-shield", applies=["judgment_ready", "incapacitated"],
        note="rush + 75% Knockdown 3 s (" + NPC + "); grants Judgment for 3 s (2 s modelled); spec rank 5 resets Annihilate")
    r["shield-smite"] = rule("shield-smite", applies=["judgment_ready", "incapacitated"],
        note="60% Stun 3 s (" + NPC + "); Judgment for 2 s. Spec rank 8: removes MP cost and restores 200 MP, or 50% to trigger Debilitating Smash (not modelled)")
    r["shield-rush"] = rule("shield-rush", applies=["judgment_ready", "incapacitated"], requires=["evaded"],
        note="usable 'after using Dodge or while flying'; 30% Stun 3 s (" + NPC + "); Judgment for 2 s. Dodge window length unknown, so the sim falls back to the default status duration with a warning")
    r["warding-strike"] = rule("warding-strike", applies=["warding", "judgment_ready"],
        note="restores HP (rank 1: 180-198) and grants Warding 10 s (defensive); Judgment for 2 s; cooldown 30 s in dump (25 s before Sep 4 per gegebase)")
    r["judgment"] = rule("judgment", requires=["judgment_ready"],
        note="castable only inside the 2-3 s window opened by Doom Shield / Shield Smite / Shield Rush / Warding Strike; whether casting consumes the window is unknown (not consumed here). Spec rank 16 removes its 5 s cooldown")
    r["annihilate"] = rule("annihilate", requires=["incapacitated"],
        note="needs a Stun/Knockdown target; Annihilate itself has 30% to Knockdown (not chained). Spec rank 8: +100% damage to Incapacitated-Immune targets (bosses)")
    r["empyrean-lords-punishment"] = rule("empyrean-lords-punishment", applies=["incapacitated"],
        note="50% Stun 3 s (" + NPC + "); 50 Stagger Gauge Damage. Spec rank 15 +10% PvE Damage Boost for 10 s is spec-gated and not applied")
    r["assault-fury"] = rule("assault-fury", applies=["incapacitated"], note="30% Stun 3 s (" + NPC + ")")
    r["capture"] = rule("capture", applies=["incapacitated"],
        note="Root 3 s + 75% Stun 3 s (" + NPC + "); a chain skill added by Defiance spec rank 8, cooldown falls 120 -> 42 s over ranks")
    r["executing-blade"] = rule("executing-blade", applies=["executing_blade_debuff"],
        note="-30% Defense for 5 s; +20% damage vs Impact-type status targets (not modelled)")
    r["taunt"] = rule("taunt", applies=["shrink"], note="Enmity +20000 (39000 at rank 20), Shrink 15 s, 50% Taunt 3 s vs players")
    r["battlefield-banner"] = rule("battlefield-banner", applies=["battlefield_banner"],
        note="Attack scales with Defense; formula unpublished so the status multiplier is unknown")
    r["second-skin"] = rule("second-skin", applies=["second_skin"], note="defensive window")
    r["armor-of-balance"] = rule("armor-of-balance", applies=["armor_of_balance"], note="defensive window")
    r["noble-armor"] = rule("noble-armor", applies=["noble_armor"], note="defensive; dump cooldown 300 s vs Metaroad 120 s")
    r["comrade-in-arms"] = rule("comrade-in-arms", applies=["comrade_in_arms"], note="defensive window")
    r["nezekans-shield"] = rule("nezekans-shield", applies=["nezekan_shield"], note="party shield window")
    r["shield-of-protection"] = rule("shield-of-protection", applies=["shield_of_protection", "fury_buff"],
        note="guaranteed Block; applies Fury on the assumption the boss hits the tank while Block is guaranteed (Fury needs a Block event). Remove fury_buff from applies for a no-incoming-damage dummy")
    r["defiance"] = rule("defiance", applies=["tenacity"],
        note="cleanse + Tenacity 5 s; spec rank 8 adds Capture as a chain skill (not auto-chained: spec unknown to the engine)")
    r["dodge"] = rule("dodge", applies=["evaded"], note="opens the Shield Rush window; window length unknown")
    r["flash-rampage"] = rule("flash-rampage", requires=["staggered"],
        note="client: only hits a Staggered target and has 0 cooldown / 0 MP; nothing applies 'staggered' (gauge size unknown) so the sim never casts it rather than spamming it. 4 hits per cast. Spec rank 16: -1 s to all cooldowns on hit")
    return r


def build_triggers():
    return [
        {"status_key": "punishing_benediction_proc", "on_element": "none", "chance": 0.5,
         "source_skill": "punishing-benediction", "confidence": "estimated"},
        {"status_key": "insulting_roar_buff", "on_element": "none", "chance": 1.0,
         "source_skill": "insulting-roar", "confidence": "estimated"},
    ]


def build_tags():
    t = {}
    manual = ["dodge", "punishment", "shield-rush", "defiance", "shield-of-protection", "taunt", "poach", "grapple",
              "capture", "second-skin", "armor-of-balance", "noble-armor", "comrade-in-arms", "nezekans-shield"]
    for k in manual:
        t[k] = ["manual"]

    def add(k, *tags):
        t.setdefault(k, [])
        for x in tags:
            if x not in t[k]:
                t[k].append(x)
    for k in ("dodge",):
        add(k, "role:mobility", "role:defense")
    add("punishment", "role:burst")
    add("shield-rush", "role:cc", "role:mobility")
    add("defiance", "role:defense")
    add("shield-of-protection", "role:defense", "role:sustain")
    add("taunt", "role:aggro", "role:cc")
    add("poach", "role:cc")
    add("grapple", "role:cc")
    add("capture", "role:cc")
    for k in ("second-skin", "armor-of-balance"):
        add(k, "role:defense")
    add("noble-armor", "role:defense", "role:sustain")
    add("comrade-in-arms", "role:defense", "role:support")
    add("nezekans-shield", "role:defense", "role:support")
    add("warding-strike", "role:defense", "role:heal")
    add("doom-shield", "role:cc", "role:mobility", "role:defense")
    add("shield-smite", "role:cc")
    add("empyrean-lords-punishment", "role:cc", "role:burst")
    add("assault-fury", "role:cc", "role:burst")
    add("blade-storm", "role:cc", "role:mobility")
    add("executing-blade", "role:burst")
    add("battlefield-banner", "role:burst")
    add("annihilate", "role:cc")
    add("debilitating-smash", "role:defense")
    add("judgment", "trigger:judgment")
    add("flash-rampage", "trigger:stagger")
    for k in ("warding-shield",):
        add(k, "role:defense", "role:heal")
    for k in ("enhance-health", "ironclad-defense", "guarding-seal", "survival-willpower", "block-pain"):
        add(k, "role:defense")
    add("fury", "role:support")
    return t


def main():
    doc = {
        "_comment": "Hand-authored Templar sim mechanics. Every Num carries confidence. Keys are validated against built skills at build time. Rank-scaled client values use rank 20 (Global cap). Generated by tools/build_mechanics_rules.py.",
        "icon_prefix_aliases": {"punishment-": "punishment.png", "shield-rush-": "shield-rush.png"},
        "skill_tags": build_tags(),
        "anim_lock": {
            "default": {"value": 1.0, "confidence": "estimated", "source": "default 1.0 s; client cast_time is 0 everywhere; calibrate in app"},
            "long": {"value": 1.5, "confidence": "estimated", "source": "no Templar skill is reported as long; value kept for schema parity"},
            "long_skills": []},
        "element_overrides": {},
        "kind_overrides": {},
        "statuses": build_statuses(),
        "triggers": build_triggers(),
        "rules": build_rules(),
    }
    json.dump(doc, open(f"{R}/mechanics.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(len(doc["statuses"]), "statuses", len(doc["rules"]), "rules", len(doc["triggers"]), "triggers", len(doc["skill_tags"]), "tagged skills")


if __name__ == "__main__":
    main()
