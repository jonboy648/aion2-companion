"""Generates mechanics.json + chains.json for the Chanter (hand-authored values live here, with sources)."""
import json

DUMP = "aion2.app client dump 2026-09-18"
MR = "Metaroad Chanter page 2026-10-03"
KR = "aion2hub Aug 26 2026 patch notes (Korea)"


def N(v, c, s):
    return {"value": v, "confidence": c, "source": s}


def status(key, name, on, dur, mult=None, tick_s=None, tick_ratio=None, src_skill=None, mp_min=None):
    return {
        "key": key, "name": name, "on": on, "duration_s": dur,
        "dmg_mult": mult or N(1.0, "estimated", "no damage amplification modelled; enabling/gating status"),
        "elements": [], "mp_min_pct": mp_min, "source_skill": src_skill,
        "tick_ratio_pct": tick_ratio or N(0.0, "unknown", "no damage tick"),
        "tick_s": tick_s or N(1.0, "unknown", "no tick"),
    }


def rule(key, applies=(), chance=1.0, requires=(), consumes=(), chain_next=None, window=3.0,
         charge=(), mp=0.0, conf="estimated", note=""):
    return {"skill_key": key, "applies": list(applies), "apply_chance": chance, "requires": list(requires),
            "consumes": list(consumes), "chain_next": chain_next, "chain_window_s": window,
            "charge_levels": list(charge), "mp_restore": mp, "confidence": conf, "note": note}


WIN = "chain window unknown; 3.0 s placeholder (same as Sorcerer default), calibrate in app"
ST = {}


def add(s):
    ST[s["key"]] = s


add(status("stun", "Stun", "target", N(3.0, "confirmed", f"Impactful Crush 'inflict Stun for 3s' ({DUMP}); Crushing Strike, Assault Shock also 3s"),
           mult=N(1.0, "estimated", "no multiplier; gate for Wave Blow, Crushing Blow multi-hit, Surging Strike airborne"), src_skill="impactful-crush"))
add(status("knockdown", "Knockdown", "target", N(3.0, "confirmed", f"Wave Blow 'inflicts Knockdown for 3s' ({DUMP}); +1s with spec rank 8"), src_skill="wave-blow"))
add(status("seal", "Seal", "target", N(3.0, "confirmed", f"Heat Wave Blow / Spinning Strike spec: Seal 3s ({DUMP}); Ensnaring Mark 5s"), src_skill="heat-wave-blow"))
add(status("staggered", "Staggered", "target", N(None, "unknown", "stagger break window and gauge size not published; skills only list 'Stagger Gauge Damage' 2-50"),
           mult=N(1.0, "estimated", "no multiplier itself; Raging Spell extra damage and Gust Rampage need it")))
add(status("impact_status", "Impact-type status", "target", N(None, "unknown", "umbrella flag; which statuses count as Impact-type is not documented (Stun/Knockdown likely)"),
           mult=N(1.2, "estimated", f"Fracturing Blow: +20% damage to Impact-type targets (+30% more at spec rank 20) ({DUMP}); other skills have their own bonus"), src_skill="impact-hit"))
add(status("dark_crush_ready", "Dark Crush ready (2 s)", "self", N(2.0, "confirmed", f"Impactful Crush and Spinning Strike: '[Dark Crush] becomes available for 2s on skill use' ({DUMP}, Metaroad)")))
add(status("dark_crush_ready_3s", "Dark Crush ready (3 s)", "self", N(3.0, "confirmed", f"Ensnaring Mark and Marchutan's Wrath: '[Dark Crush] becomes available for 3s' ({DUMP}); KR patch lowered Marchutan's from 7s to 3s ({KR})")))
add(status("spinning_strike_crit", "Spinning Strike Crit Damage", "self", N(30.0, "confirmed", f"+15% Critical Damage Boost for 30s, stacks 2 ({DUMP})"),
           mult=N(None, "unknown", "+15% crit damage boost per stack (x2 stacks = +30%); converts to damage only with crit chance, not a flat multiplier"), src_skill="spinning-strike"))
add(status("protection_circle", "Protection Circle stack", "self", N(5.0, "confirmed", f"lasts 5s per attack landed, 10 stacks then Divine Barrier, 0.5s internal cooldown ({DUMP})"), src_skill="protection-circle"))
add(status("divine_barrier", "Divine Barrier", "self", N(10.0, "confirmed", f"shield 3.1% Max HP (rank 1) to 7% (rank 40) for 10s on 10 stacks, caster and party ({DUMP}); KR 4/5/6% ({KR})"), src_skill="protection-circle"))
add(status("noble_protective_shield", "Noble Protective Shield", "self", N(5.0, "confirmed", f"blocks 21% damage (rank 1) to 60% (rank 40) for 5s when HP < 50%, cooldown 60s ({DUMP})"), src_skill="protection-circle"))
add(status("tenacity", "Tenacity", "self", N(5.0, "confirmed", f"Defiance: removes CC, Status Effect Immunity 5s (+2s spec rank 12) ({DUMP})"), src_skill="defiance"))
add(status("recuperation_hot", "Recuperation HoT", "self", N(8.0, "confirmed", f"'Restores 183 HP every 2s for 8s' rank 1 ({DUMP}); +4s spec rank 8"),
           tick_s=N(2.0, "confirmed", f"every 2s ({DUMP})"),
           tick_ratio=N(0.0, "unknown", "flat heal 183/tick at rank 1 to 2032 at rank 40 (client per-level heal); Status only models ATK-ratio ticks"), src_skill="recuperation"))
add(status("focused_defense", "Focused Defense (guaranteed Block)", "self", N(None, "unknown", f"sustained skill, duration not shown; 20s cooldown, block DR +100% ({DUMP})"), src_skill="focused-defense"))
add(status("sprint_mantra", "Sprint Mantra", "self", N(0.0, "estimated", "toggle skill, no duration"),
           src_skill="sprint-mantra"))
add(status("undefeated_mantra", "Undefeated Mantra", "self", N(0.0, "estimated", "toggle skill, no duration (party aura)"),
           mult=N(1.105, "estimated", f"+10.5% PvE Damage Boost at rank 1 (22.5% at rank 25) ({DUMP}); treated as a damage multiplier, real bucket unknown; party-wide"), src_skill="undefeated-mantra"))
add(status("power_of_the_storm", "Power of the Storm", "self", N(10.0, "confirmed", f"+20% Combat Speed and -20% cooldowns for 10s at rank 1, 22.5s at rank 25 ({DUMP}); party gets +20% speed and -10% cooldowns"),
           mult=N(1.0, "estimated", "speed/cooldown buff: feed Stats combat_speed_pct and cdr_pct (+20% each) instead of a multiplier; spec rank 20 adds +20% caster Attack"), src_skill="power-of-the-storm"))
add(status("impeding_authority", "Protective Shield (Impeding Authority)", "self", N(20.0, "confirmed", f"shield 16% Max HP (rank 1) to 40% (rank 25) for 20s, party within 40m ({DUMP}); KR 20/30/40% ({KR})"), src_skill="impeding-authority"))
add(status("barrier_spell", "Barrier Spell", "self", N(3.0, "confirmed", f"HP cannot fall below 10% for 3s, party within 40m; 180s cooldown ({DUMP})"), src_skill="barrier-spell"))
add(status("guardian_blessing", "Guardian Blessing", "self", N(300.0, "confirmed", f"+5.4% Max HP (rank 1) to 15% (rank 25) for 300s ({DUMP})"), src_skill="guardian-blessing"))
add(status("attack_preparation", "Attack Preparation", "self", N(0.0, "estimated", "passive, no duration"),
           mult=N(1.055, "estimated", f"+5.5% PvE Damage Boost at rank 1 (25% at rank 40), also +2% Defense, +100 Accuracy ({DUMP}); rank scaling is large, app should pick by rank"), src_skill="attack-preparation"))
add(status("earths_promise_debuff", "Earth's Promise (target PvE Tolerance down)", "target", N(5.0, "confirmed", f"-5.4% PvE Damage Tolerance (rank 1) to -21% (rank 40) for 5s per hit, internal cooldown 10s ({DUMP})"),
           mult=N(1.054, "estimated", "tolerance reduction treated as +damage taken; real bucket unknown; KR patch cut the effect to 9/13/17% (Aug 26)"), src_skill="earths-promise"))
add(status("wave_blow_debuff", "Wave Blow damage-boost debuff", "target", N(10.0, "confirmed", f"spec rank 12: -15% target PvE Damage Boost, -7.5% PvP for 10s ({DUMP})"),
           mult=N(1.0, "estimated", "reduces target outgoing damage: defensive only"), src_skill="wave-blow"))
add(status("fracturing_defense_down", "Fracturing Blow Defense Down", "target", N(5.0, "confirmed", f"-30% Defense for 5s ({DUMP})"),
           mult=N(None, "unknown", "defense reduction; impact depends on target defense (damage formula uses (def - pen) * 0.1)"), src_skill="fracturing-blow"))
add(status("rushing_smash_resist_down", "Impact Resist Down", "target", N(5.0, "confirmed", f"Rushing Smash spec rank 8: -20% Impact-type Resist for 5s ({DUMP})"), src_skill="rushing-smash"))
add(status("winds_promise_crit", "Wind's Promise", "self", N(0.0, "estimated", "passive, no duration"),
           mult=N(None, "unknown", f"+5.7% Crit Damage Boost (rank 1) to 33% (rank 40) plus 50% chance on crit for 554 flat extra damage, 1s cooldown ({DUMP}); crit conversion needed"), src_skill="winds-promise"))

R = {}


def addr(r):
    R[r["skill_key"]] = r


addr(rule("onslaught", chain_next="resonance-crush", window=3.0, mp=100.0, conf="confirmed", note=f"chain 1/3 (client), restores 100 MP; 2 hits; spec rank 12 -1s Spinning Strike cooldown on hit; spec rank 16 adds Storm Chain. {WIN}"))
addr(rule("resonance-crush", chain_next="bolt-crush", mp=100.0, conf="confirmed", note=f"chain 2/3 (client), restores 100 MP, 5 hits. {WIN}"))
addr(rule("bolt-crush", mp=120.0, conf="confirmed", note="chain 3/3 (client), restores 120 MP"))
addr(rule("storm-chain", mp=180.0, conf="estimated", note="added by Onslaught spec rank 16 (Metaroad: 'Adds Storm Chain Chain Skill'); restores 180 MP; position in the chain unknown"))
addr(rule("incandescent-blow", chain_next="bursting-blow", conf="confirmed", note=f"chain 1/2 (client), MP cost 120, 2 hits, 2 stagger. {WIN}"))
addr(rule("bursting-blow", conf="confirmed", note="chain 2/2 (client), MP cost 120, 2 hits, 2 stagger"))
addr(rule("impactful-crush", applies=["stun", "dark_crush_ready"], chance=0.6, conf="estimated",
          note=f"60% Stun 3s on players, 100% on NPC targets (so use chance 1.0 vs mobs/bosses unless immune), {DUMP}. Opens Dark Crush for 2s. apply_chance covers Stun only; dark_crush_ready is always applied"))
addr(rule("crushing-blow", conf="estimated", note="Multi-Hit on Stunned targets; chain child of Impactful Crush in KR before Aug 26 patch (replaced by +30% Skill Speed spec); global client lists no parent"))
addr(rule("wave-blow", requires=["stun"], applies=["knockdown"], conf="estimated",
          note="needs a Stunned target (description). 7% chance to change motion vs Incapacitated-Immune targets: boss CC immunity makes the Stun gate uncertain. Knockdown 3s. Spec rank 12 applies wave_blow_debuff (not auto-applied here)"))
addr(rule("wave-blow-18080037", conf="unknown", note="hidden passive-type variant (Required level 4, Max 1) with identical text to Wave Blow; probably the motion-change variant. Not rotation relevant"))
addr(rule("rushing-smash", mp=100.0, conf="estimated",
          charge=[{"level": 1, "charge_s": N(None, "unknown", "no source"), "dmg_mult": N(1.0, "estimated", "base hit")},
                  {"level": 2, "charge_s": N(None, "unknown", "no source"), "dmg_mult": N(None, "unknown", "Metaroad has Level 1/2/Max rows without ratios")},
                  {"level": 3, "charge_s": N(None, "unknown", "no source"), "dmg_mult": N(3.0, "estimated", "spec rank 8 'Changes to Charge Skill, dealing up to 200% more damage' = up to 3.0x")}],
          note="Charge Skill only with the rank 8 specialty; without it a plain 15 s rush. Restores 100 MP. Community: remove from macro, press by hand (aoeah 2026-09-10)"))
addr(rule("dark-crush", conf="confirmed",
          note=f"usable only inside a Dark Crush window: dark_crush_ready (2 s, from Impactful Crush / Spinning Strike) OR dark_crush_ready_3s (3 s, from Ensnaring Mark / Marchutan's Wrath). Schema has AND-only 'requires', so no requires is listed: engine must treat the two statuses as OR. 5 s cooldown, removed at spec rank 16. Chain spec rank 12 adds Piercing Strike. KR rework 2026-08-26: usable 'when using a ranged skill' ({KR})"))
addr(rule("piercing-strike", conf="estimated", note="added by Dark Crush spec rank 12; shares the Dark Crush window logic (KR patch note groups them)"))
addr(rule("recuperation", applies=["recuperation_hot"], conf="confirmed", note=f"heal + HoT, removes 1 debuff, party within 40m, cooldown 15s ({DUMP}); defensive/heal, not in damage rotation"))
addr(rule("fracturing-blow", applies=["fracturing_defense_down"], conf="confirmed", note="rush 20m, -30% Defense 5s; +20% damage vs Impact-type targets"))
addr(rule("focused-defense", applies=["focused_defense"], conf="estimated", note="guaranteed Block, restores 110 MP and Stamina once on Block (rank 1), sustained skill"))
addr(rule("heat-wave-blow", conf="confirmed", note="40% Seal 3s on Block, 100% on NPC; spec rank 8: 40% Stun; reset chance on Block with spec rank 16"))
addr(rule("sprint-mantra", applies=["sprint_mantra"], conf="confirmed", note="toggle: +10.5% Move Speed, 15% on-hit heal (1s cooldown) for caster and party"))
addr(rule("healing-touch", conf="confirmed", note="party heal 927-1020 at rank 1, cooldown 30s"))
addr(rule("undefeated-mantra", applies=["undefeated_mantra"], conf="confirmed", note="toggle party aura; does not stack with Cleric Light of Protection (higher rank wins, ties go to Undefeated Mantra)"))
addr(rule("defiance", applies=["tenacity"], conf="confirmed", note="removes Stun/Knockdown/Airborne/Grab/Frost/Fear; unaffected by cooldown reduction; spec rank 8 adds Crushing Strike chain"))
addr(rule("crushing-strike", applies=["stun"], conf="estimated", note="added by Defiance spec rank 8; Stun 3s; 120 s cooldown (Metaroad)"))
addr(rule("tremor-crush", applies=["stun"], chance=0.5, conf="estimated", note="50% Stun 3s after Dodge or while flying, 100% on NPC; spec rank 12 adds Surging Strike"))
addr(rule("surging-strike", conf="estimated", note="added by Tremor Crush spec rank 12; 30% Airborne 3s on Stunned targets"))
addr(rule("obliterate", chance=0.5, conf="confirmed", note="50% Knockdown (100% on NPC), 50 stagger"))
addr(rule("ensnaring-mark", applies=["seal", "dark_crush_ready_3s"], chance=0.5, conf="confirmed", note="50% Seal 5s (100% on NPC); Dark Crush ready 3s always applied"))
addr(rule("impeding-authority", applies=["impeding_authority"], conf="confirmed", note="party shield 16% Max HP 20s"))
addr(rule("power-of-the-storm", applies=["power_of_the_storm"], conf="confirmed", note="+20% Combat Speed, -20% cooldowns 10s (party half)"))
addr(rule("spinning-strike", applies=["spinning_strike_crit", "dark_crush_ready"], conf="confirmed",
          note=f"20 m AoE, MP 250, cd 30 s in global dump. KR Aug 26 patch: cd 15 s, MP 100, +30% speed ({KR}); global client not updated. Opens Dark Crush 2 s; crit damage +15% x2 stacks 30 s"))
addr(rule("gust-rampage", requires=["staggered"], mp=0.0, conf="estimated", note="needs a Staggered target; spec rank 8 restores 120 MP and -1s all cooldowns at rank 16"))
addr(rule("marchutans-wrath", applies=["dark_crush_ready_3s"], chance=1.0, conf="confirmed", note="Dark Crush ready 3s; spec rank 10 50% Stun, rank 15 -70% Incoming Heal and Potion Recovery on target (PvP)"))
addr(rule("guardian-blessing", applies=["guardian_blessing"], conf="confirmed", note="+5.4% Max HP 300s, immediate 5.4% heal, not dispellable"))
addr(rule("barrier-spell", applies=["barrier_spell"], conf="confirmed", note="HP floor 10% for 3s; 180s cooldown not reduced by cooldown increase effects"))
addr(rule("assault-shock", applies=["stun"], chance=0.3, conf="confirmed", note="30% Stun 3s (100% on NPC); +defense up to 20% by targets hit; spec 5: +20% Attack 5s"))
addr(rule("protection-circle", applies=["protection_circle", "divine_barrier", "noble_protective_shield"], conf="confirmed", note="passive: stacks on each landed attack (0.5 s ICD), 10 stacks pop Divine Barrier; Noble shield below 50% HP, 60 s cooldown"))
addr(rule("earths-promise", applies=["earths_promise_debuff"], conf="confirmed", note="passive: debuff on each landed attack, 10 s cooldown; does not apply together with Cleric Chain of Torment"))
addr(rule("raging-spell", requires=["staggered"], conf="estimated", note="passive proc: 146 flat extra damage (rank 1) vs targets Staggered OR Impact-type, 1 s cooldown; AND-only requires lists staggered only"))
addr(rule("winds-promise", applies=["winds_promise_crit"], conf="estimated", note="passive proc on crit, see status"))
addr(rule("attack-preparation", applies=["attack_preparation"], conf="confirmed", note="passive buff"))
addr(rule("rushing-smash-level-1", conf="unknown", note="Metaroad charge tier row, no ratios"))
addr(rule("rushing-smash-level-2", conf="unknown", note="Metaroad charge tier row, no ratios"))
addr(rule("rushing-smash-max", conf="unknown", note="Metaroad charge tier row, no ratios"))

TRIG = [
    {"status_key": "protection_circle", "on_element": "none", "chance": 1.0, "source_skill": "protection-circle", "confidence": "confirmed"},
    {"status_key": "earths_promise_debuff", "on_element": "none", "chance": 1.0, "source_skill": "earths-promise", "confidence": "confirmed"},
]
SKILL_TAGS = {}
tags = json.load(open("tags.json", encoding="utf-8"))
sk = json.load(open("skills.json", encoding="utf-8"))
idx = json.load(open("D:/Aion2/assets/icons/chanter/index.json", encoding="utf-8"))
by_id = {int(v["skill_id"]): s for s, v in idx.items()}
import re


def slugify(n):
    return re.sub(r"[^a-z0-9]+", "-", n.lower().replace("'", "")).strip("-")


for s in sk:
    key = by_id[s["skill_id"]] if s["skill_id"] else slugify(s["name"])
    SKILL_TAGS[key] = s["tags"]
KEYS = set(SKILL_TAGS)
bad = [k for k in R if k not in KEYS]
print("rules with unknown skill key:", bad)
out = {
    "_comment": "Chanter hand-authored sim mechanics, same schema as aion2c/data/src/mechanics.json. Every Num carries confidence + source. Values at RANK 1 unless stated. Global client dump 2026-09-18; KR patch differences listed in NOTES.md.",
    "anim_lock": {
        "default": N(1.0, "estimated", "default 1.0 s; client cast_time is 0 everywhere; calibrate in app"),
        "long": N(1.5, "estimated", "charge animation per community (aoeah 2026-09-10); calibrate in app"),
        "long_skills": ["rushing-smash"],
    },
    "element_overrides": {},
    "kind_overrides": {"raging-spell": "proc", "winds-promise": "proc"},
    "icon_prefix_aliases": {"rushing-smash-": "rushing-smash.png"},
    "skill_tags": SKILL_TAGS,
    "resources": {
        "mp": N(None, "unknown", "Pool size not published. Chain basics restore MP: Onslaught 100, Resonance Crush 100, Bolt Crush 120, Storm Chain 180, Rushing Smash 100; Incandescent/Bursting Blow cost 120, Impactful Crush 100, Spinning Strike 250 (global dump), Fracturing Blow 100, Obliterate/Ensnaring Mark 200"),
        "stamina": N(None, "unknown", "Dodge, Tremor Crush, Defiance and several specs restore/consume Stamina (e.g. +1000 Stamina on Defiance spec, -1000 Max Stamina on Ensnaring Mark spec); costs not published"),
    },
    "statuses": ST, "triggers": TRIG, "rules": R,
}
json.dump(out, open("mechanics.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(len(ST), "statuses", len(R), "rules", len(SKILL_TAGS), "tagged skills")
