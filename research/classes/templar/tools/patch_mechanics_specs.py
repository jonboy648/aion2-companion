"""Templar specialty/aura layer for mechanics.json (run AFTER build_mechanics_rules.py; idempotent).

    python research/classes/templar/tools/patch_mechanics_specs.py

Adds: specialization_effects (datamine-first decode of every active/stigma skill option), spec_slot_ranks,
stat_mods on the timed buffs (Executor, Insulting Roar, Fury ...), the permanent Fury aura, the 3 s Doom Shield
Judgment window and the unknown-value Punishment DoT status. Split in parts: part_statuses / part_rules /
part_specs (specs.py-like data lives in patch_specs_data.py).
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
MECH = HERE.parent / "mechanics.json"
DUMP = "aion2.app client dump 2026-09-18"


def num(v, conf, src):
    return {"value": v, "confidence": conf, "source": src}


def mod(stat, v, conf, src):
    return {"stat": stat, "value": num(v, conf, src)}


def status(key, name, on, dur, dmg_mult=None, mods=(), source_skill=None, permanent=False,
           tick=None, tick_s=None):
    return {
        "key": key, "name": name, "on": on, "duration_s": dur,
        "dmg_mult": dmg_mult or num(1.0, "confirmed", "damage effect carried by stat_mods (additive bucket), not a multiplier"),
        "elements": [], "mp_min_pct": None, "source_skill": source_skill,
        "tick_ratio_pct": tick or num(0.0, "confirmed", "not a damage-over-time status"),
        "tick_s": tick_s or num(1.0, "unknown", "not a damage-over-time status"),
        "stat_mods": list(mods), "permanent": permanent,
    }


def part_statuses(m: dict) -> None:
    st = m["statuses"]
    # Executor: +20% PvE Damage Boost (Punishment token abe:1209000012 = 20, 20 s) -> additive bucket
    st["executor"].update(
        dmg_mult=num(1.0, "confirmed", "damage effect carried by stat_mods"),
        stat_mods=[mod("dmg_boost_pct", 20.0, "confirmed",
                       f"Punishment token abe:1209000012:value02:divide100 = 20 (PvE Damage Boost, all ranks), {DUMP}")])
    # Insulting Roar: +Attack% 5 s (rank 20 = 15%) -> attack bucket
    st["insulting_roar_buff"].update(
        dmg_mult=num(1.0, "confirmed", "damage effect carried by stat_mods"),
        stat_mods=[mod("attack_increase_pct", 15.0, "estimated",
                       f"token abe:1277000711:value02:divide100 rank 1 = 5.5, rank 20 = 15.0, rank 40 = 25 ({DUMP}); "
                       "rank 20 used (Global cap); needs a Front Attack, assumed")])
    # Fury: PvE Damage Boost on Block, 20 s (rank 20 = 15%). Permanent aura: a tank Blocks at least once per 20 s
    st["fury_buff"].update(
        name="Fury (Block buff, permanent aura)",
        duration_s=num(0.0, "estimated",
                       "0 = permanent aura. Real: 20 s after each Block (token se:1278000111:effect_value02:time = 20, "
                       "1 s ICD). Assumes the Templar is tanking and Blocks at least once every 20 s"),
        dmg_mult=num(1.0, "confirmed", "damage effect carried by stat_mods"),
        source_skill="fury", permanent=True,
        stat_mods=[mod("dmg_boost_pct", 15.0, "estimated",
                       f"token abe:1278000111:value02:divide100 rank 1 = 5.5, rank 20 = 15.0, rank 40 = 25 ({DUMP}); "
                       "rank 20 used; uptime assumed 100% (Block events are not simulated)")])
    st["empyrean_spec_boost"].update(
        dmg_mult=num(1.0, "confirmed", "damage effect carried by stat_mods"),
        stat_mods=[mod("dmg_boost_pct", 10.0, "confirmed",
                       f"Empyrean Lord's spec rank 15 token abe:1231003711:value02:divide100 = 10 (PvE Damage Boost), {DUMP}")])
    st["empyrean_spec_boost"]["source_skill"] = "empyrean-lords-punishment"
    # specialty-owned statuses
    st["banner_weapon_dmg"] = status(
        "banner_weapon_dmg", "Battlefield Banner spec: +10% Weapon Damage Boost", "self",
        num(20.0, "estimated", "'for duration' = Banner duration, rank 20 value (se:1245000011 time 20)"),
        dmg_mult=num(1.10, "estimated",
                     "token abe:1245001013 = 10 (Weapon Damage Boost); its own multiplicative bucket "
                     "(attack x (1+weapon%)), read as x1.10 (exact only if gear Weapon Damage Boost = 0)"),
        source_skill="battlefield-banner")
    st["noble_roar_x15"] = status(
        "noble_roar_x15", "Noble Armor spec 10: x1.5 Insulting Roar", "self",
        num(300.0, "estimated", f"'for the duration' = Noble Armor duration (dump token 300 s; Metaroad text 120 s), {DUMP}"),
        mods=[mod("attack_increase_pct", 7.5, "estimated",
                  "x1.5 of Insulting Roar's rank-20 +15% Attack = +7.5 extra points, while Roar is up (assumed 100%)")],
        source_skill="noble-armor")
    st["noble_fury_x15"] = status(
        "noble_fury_x15", "Noble Armor spec 15: x1.5 Fury", "self",
        num(300.0, "estimated", f"'for the duration' = Noble Armor duration (dump token 300 s; Metaroad text 120 s), {DUMP}"),
        mods=[mod("dmg_boost_pct", 7.5, "estimated", "x1.5 of Fury's rank-20 +15% PvE Damage Boost = +7.5 extra points")],
        source_skill="noble-armor")
    st["punishment_dot"] = status(
        "punishment_dot", "Punishment spec: Damage over Time", "target",
        num(None, "unknown", "spec text 'Inflicts Damage over Time to target on hit' gives no duration; the 20 s token "
                             "(se:1209000021) is the Executor buff, not the DoT"),
        tick=num(None, "unknown", "no tick damage in any source (client dump, Metaroad, guides)"),
        tick_s=num(1.0, "unknown", "tick interval not published"),
        source_skill="punishment")


def part_rules(m: dict) -> None:
    # Shield of Protection no longer manufactures Fury: Fury is a permanent aura now (see part_statuses)
    r = m["rules"]["shield-of-protection"]
    r["applies"] = ["shield_of_protection"]
    r["note"] = ("guaranteed Block + 100% Block damage reduction (defensive); restores 110 MP and Stamina once on Block "
                 "(MP not modelled: no Block events). Fury is no longer applied here: it is a permanent aura "
                 "(build_validation templar item 1: this assumption made the stigma the top pick)")
    # Doom Shield opens Judgment for 3 s (token se:1224000811 = 3), the other openers for 2 s
    ds = m["rules"]["doom-shield"]
    ds["applies"] = [s for s in ds["applies"] if s != "judgment_ready"]
    trig = {"status_key": "judgment_ready", "on_element": "none", "chance": 1.0, "source_skill": "doom-shield",
            "confidence": "confirmed", "event": "cast", "on_skills": ["doom-shield"], "window_s": 3.0}
    m["triggers"] = [t for t in m["triggers"] if not (t.get("source_skill") == "doom-shield")] + [trig]
    m["statuses"]["judgment_ready"]["duration_s"]["source"] += (
        "; Doom Shield's 3 s window is a separate trigger (window_s 3.0)")
    m["rules"]["flash-rampage"]["note"] += (
        ". The build now also tags it needs_stagger (description 'afflicted with Stagger'); the `staggered` "
        "requirement stays as a second gate")


def main() -> None:
    from patch_specs_data import SLOT_RANKS, SPEC_EFFECTS
    m = json.loads(MECH.read_text(encoding="utf-8"))
    part_statuses(m)
    part_rules(m)
    m["specialization_effects"] = SPEC_EFFECTS
    m["spec_slot_ranks"] = SLOT_RANKS
    m["_comment"] = m["_comment"].split(" Specialty layer")[0] + (
        " Specialty layer (specialization_effects, stat_mods, Fury aura, Doom Shield window) is applied by "
        "tools/patch_mechanics_specs.py after build_mechanics_rules.py.")
    MECH.write_text(json.dumps(m, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print("patched", MECH, "specs:", sum(len(v) for v in SPEC_EFFECTS.values()))


if __name__ == "__main__":
    main()
