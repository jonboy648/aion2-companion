"""Generate mechanics.json for the Templar (schema of aion2c/data/src/mechanics.json).

Every Num carries confidence + source. Client-scaled values (rank dependent) are taken at RANK 20
(the Global core/stigma rank cap) from raw/parsed_app.json tokens, and the source string says so.
"""
import json

R = "D:/Aion2/research/classes/templar"
APP = {a["name"]: a for a in json.load(open(f"{R}/raw/parsed_app.json", encoding="utf-8"))}
DUMP = "aion2.app client dump 2026-09-18"
MR = "Metaroad Templar page 2026-10-03"
NOTICK = {"value": 0.0, "confidence": "unknown", "source": "not a damage-over-time status, or tick unknown"}
NOTICK_S = {"value": 1.0, "confidence": "unknown", "source": "not a damage-over-time status, or tick unknown"}


def N(value, conf, source):
    return {"value": value, "confidence": conf, "source": source}


def tok(skill, level, suffix):
    """Token value (float) of `skill` at `level` whose key ends with suffix."""
    pl = APP[skill]["per_level"][level - 1]
    for k, v in pl["tokens"].items():
        if k.endswith(suffix):
            return float(v)
    raise KeyError((skill, level, suffix))


def status(key, name, on, dur, mult, source_skill=None, elements=(), tick_ratio=None, tick_s=None):
    return {"key": key, "name": name, "on": on, "duration_s": dur, "dmg_mult": mult,
            "elements": list(elements), "mp_min_pct": None, "source_skill": source_skill,
            "tick_ratio_pct": tick_ratio or dict(NOTICK), "tick_s": tick_s or dict(NOTICK_S)}


UNK = lambda why: N(None, "unknown", why)
ONE = lambda why: N(1.0, "estimated", why)


def build_statuses():
    s = {}
    ir20 = tok("Insulting Roar", 20, "abe:1277000711:value02:divide100")
    fy20 = tok("Fury", 20, "abe:1278000111:value02:divide100")
    bb20 = tok("Battlefield Banner", 20, "se:1245000011:effect_value02:time")
    ss20 = tok("Second Skin", 20, "effect_value02:time")
    ab20 = tok("Armor of Balance", 20, "effect_value02:time")
    s["executor"] = status(
        "executor", "Executor (Punishment)", "self",
        N(20.0, "confirmed", f"Punishment token se:1209000021:effect_value02:time = 20 at every rank, description 'for 20s' ({DUMP}); gegebase 2026-09: Executor 10s -> 20s on Sep 4"),
        N(1.2, "estimated", "+20% PvE Damage Boost (and +10% PvP, +200 Accuracy) per description; treated as a damage multiplier like Sorcerer's Grace of Enhancement, real bucket is additive with other Damage Boost"))
    s["punishing_benediction_proc"] = status(
        "punishing_benediction_proc", "Punishing Benediction proc", "target",
        N(1.0, "estimated", "modelling device: a 1 s status that ticks once, to stand in for one proc hit"),
        N(1.0, "estimated", "no damage amplification; proc damage is carried by tick_ratio_pct"),
        source_skill="punishing-benediction",
        tick_ratio=N(38.0, "estimated", f"38% ATK + flat (rank 1, {MR}); the engine tick uses the ratio only, the flat part (69 at rank 1, larger at higher ranks) is not modelled. Proc chance 50%, 1 s internal cooldown (description)"),
        tick_s=N(0.5, "estimated", "modelling device so exactly one tick lands inside the 1 s status"))
    s["insulting_roar_buff"] = status(
        "insulting_roar_buff", "Insulting Roar (Attack buff)", "self",
        N(5.0, "confirmed", f"description 'for 5s', token se:1277000711:effect_value02:time = 5 ({DUMP}); internal cooldown 5s"),
        N(round(1 + ir20 / 100, 4), "estimated", f"+Attack% on landing a Front Attack; client value rank 1 = 5.5%, rank 20 = {ir20}%, rank 40 = 25% ({DUMP}); rank 20 used, treated as a damage multiplier (attack bucket vs flat unknown)"),
        source_skill="insulting-roar")
    s["fury_buff"] = status(
        "fury_buff", "Fury (Block buff, party)", "self",
        N(20.0, "confirmed", f"token se:1278000111:effect_value02:time = 20 ({DUMP}); applies to caster and party on Block, 1 s internal cooldown"),
        N(round(1 + fy20 / 100, 4), "estimated", f"PvE Damage Boost on Block: rank 1 = 5.5%, rank 20 = {fy20}%, rank 40 = 25% ({DUMP}); rank 20 used. Needs a Block event, which the sim does not generate: applied by Shield of Protection (guaranteed Block) on the assumption the boss hits the tank"),
        source_skill="fury")
    s["battlefield_banner"] = status(
        "battlefield_banner", "Battlefield Banner", "self",
        N(bb20, "estimated", f"token se:1245000011:effect_value02:time: rank 1 = 10 s, rank 13 = 16 s, rank 20 = {bb20} s, rank 25 = 22.5 s ({DUMP}); rank 20 (Global stigma cap) used"),
        UNK("'Increases Attack proportional to Defense' - the Defense-to-Attack ratio is not published; specs add +10% Multi-Hit chance (rank 5), +10% Weapon Damage Boost (10), +20% Attack increase (15)"))
    s["executing_blade_debuff"] = status(
        "executing_blade_debuff", "Defense reduction (Executing Blade)", "target",
        N(5.0, "confirmed", f"tokens se:1241000015:effect_value02:time = 5 ({DUMP})"),
        UNK("-30% target Defense (token abe:1241000011 = 30); the sim's defense term uses a stat the user sets, so no honest multiplier. Also +20% damage vs Impact-type status targets (not modelled)"))
    s["incapacitated"] = status(
        "incapacitated", "Stunned or Knocked Down", "target",
        N(3.0, "confirmed", f"Stun 3s (Shield Smite, Empyrean Lord's, Assault Fury, Capture) and Knockdown 3s (Doom Shield, Annihilate) in descriptions/tokens ({DUMP}); Blade Storm stun is only 2s (not applied here)"),
        ONE("CC state only, no damage amplification; Annihilate requires it"))
    s["judgment_ready"] = status(
        "judgment_ready", "Judgment ready", "self",
        N(2.0, "estimated", f"'Triggers [Judgment] for 2s' on Shield Smite, Shield Rush and Warding Strike (tokens se:1224000711 = 2); Doom Shield grants 3s (token se:1224000811 = 3). One status key cannot carry per-source durations, so 2 s is used"),
        ONE("window flag only, no damage amplification"))
    s["warding"] = status(
        "warding", "Warding (Warding Strike)", "self",
        N(10.0, "confirmed", f"'grants Warding for 10s', token se:1235000022:effect_value02:time = 10 ({DUMP})"),
        ONE("defensive: +20% PvE / +10% PvP Damage Tolerance, no damage output change"))
    s["shrink"] = status(
        "shrink", "Shrink (Taunt)", "target",
        N(15.0, "confirmed", f"'Inflict Shrink for 15s', token effect_value02:time = 15 ({DUMP})"),
        ONE("target debuff: -200 Accuracy, -10% Attack; no change to the Templar's output"))
    s["evaded"] = status(
        "evaded", "Recently dodged", "self",
        UNK("Shield Rush works 'after using [Dodge] or while flying'; the window length after a Dodge is not published"),
        ONE("window flag only"))
    s["tenacity"] = status(
        "tenacity", "Tenacity (Defiance)", "self",
        N(5.0, "confirmed", f"'grants Tenacity for 5s' ({DUMP}); spec rank 12 adds +2s"),
        ONE("Status Effect Immunity, no damage change"))
    s["second_skin"] = status(
        "second_skin", "Second Skin", "self",
        N(ss20, "estimated", f"duration rank 1 = 10 s, rank 20 = {ss20} s, rank 25 = 22.5 s ({DUMP}); rank 20 used"),
        ONE("defensive: +30% PvE / +15% PvP Damage Tolerance"))
    s["armor_of_balance"] = status(
        "armor_of_balance", "Armor of Balance", "self",
        N(ab20, "estimated", f"duration rank 1 = 10 s, rank 20 = {ab20} s ({DUMP}); rank 20 used"),
        ONE("defensive: +50% Impact-type Resist"))
    s["noble_armor"] = status(
        "noble_armor", "Noble Armor", "self",
        N(300.0, "estimated", f"dump: 'for 300s', cooldown 300 s; Metaroad says 120 s / 120 s cooldown ({MR}) - sources conflict, dump value used"),
        ONE("defensive: +Max HP (5.4% rank 1, 13% rank 20) and a heal"))
    s["comrade_in_arms"] = status(
        "comrade_in_arms", "Comrade in Arms", "self",
        N(6.0, "confirmed", f"token effect_value02:time = 6 on Comrade in Arms ({DUMP}), description 'for 6s'"),
        ONE("defensive: caster +20% PvE Damage Tolerance, shares party damage 50/50 (value falls with rank)"))
    s["nezekan_shield"] = status(
        "nezekan_shield", "Nezekan's Shield", "self",
        N(3.0, "confirmed", f"description 'for 3s' ({DUMP}); spec rank 10 adds +2s"),
        ONE("defensive: Protective Shield of 41% Max HP at rank 1, 60% at rank 20, to caster and party within 40 m"))
    s["shield_of_protection"] = status(
        "shield_of_protection", "Shield of Protection (guaranteed Block)", "self",
        UNK("'Temporarily' guarantees Block and +100% Block Damage Reduction; duration is not in the client tokens (property: Sustained Skill)"),
        ONE("defensive: restores 110 MP and Stamina once on Block (350 at rank 25)"))
    s["debilitate"] = status(
        "debilitate", "Debilitate (Debilitating Smash)", "target",
        N(5.0, "confirmed", f"'inflicts Debilitate for 5s on Block' ({DUMP}); spec +3s"),
        UNK("-25% target Defense; condition is a Block event the sim does not generate, so no rule applies it"))
    s["guarding_seal"] = status(
        "guarding_seal", "Guarding Seal", "self",
        N(30.0, "confirmed", f"'blocks damage equaling 21% of Max HP for 30s when HP is 50% or less', cooldown 60 s ({DUMP})"),
        ONE("defensive shield, HP-gated passive"), source_skill="guarding-seal")
    s["block_pain_buff"] = status(
        "block_pain_buff", "Block Pain", "self",
        N(10.0, "confirmed", f"'Grants Block Pain for 10s when struck', cooldown 20 s ({DUMP})"),
        ONE("defensive: PvE Damage Tolerance 11% rank 1, 30% rank 20"), source_skill="block-pain")
    s["empyrean_spec_boost"] = status(
        "empyrean_spec_boost", "Empyrean Lord's spec (+10% PvE Damage Boost)", "self",
        N(10.0, "confirmed", f"spec rank 15: '+10% PvE Damage Boost and +5% PvP for 10s on hit' (token effect_value02:time = 10 on Empyrean Lord's Punishment, {DUMP})"),
        N(1.1, "estimated", "spec-gated (rank 15 slot); NOT applied by any rule because the engine does not know which specs are picked"))
    s["staggered"] = status(
        "staggered", "Staggered", "target",
        UNK("Stagger gauge size and the Staggered duration are not published; skills only list 'Stagger Gauge Damage' per hit"),
        ONE("window flag only; Flash Rampage needs it"))
    return s
