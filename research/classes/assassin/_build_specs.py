"""Idempotent patch of mechanics.json: structured specialty effects, stat-mod statuses, crit procs, aura fixes.

Run: python research/classes/assassin/_build_specs.py   (then python -m aion2c.data.build_gamedata --class assassin)
Sources: datamine tokens in skills.json per_level[].tokens (rank 1..40) first; spec texts second; community last.
Buff durations and passive percentages scale with skill rank (e.g. se:1331000011:effect_value02:time = 10, 12, 14.5,
17, 20, 25, 30 at ranks 1, 5, 10, 15, 20, 30, 40); the engine holds one number per status, so the GLOBAL rank cap
(20) value is stored and the full scale is named in the source string.
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
MECH = HERE / "mechanics.json"


from _build_specs_lib import DUMP, eff, num, tok  # noqa: E402
from _build_specs_fx import spec_effects  # noqa: E402

DUR_SCALE = "duration scale 10/12/14.5/17/20/25/30 s at ranks 1/5/10/15/20/30/40"


def patch_statuses(m: dict) -> None:
    st = m["statuses"]
    # --- buff windows: the rank-1 10 s was stored, the datamine value at the Global cap (rank 20) is 20 s
    st["illusive_clone"]["duration_s"] = num(20.0, "confirmed", tok("se:1331000011:effect_value02:time", "20 s", DUR_SCALE))
    st["illusive_clone"]["dmg_mult"] = num(1.2, "confirmed", tok("abe:1331000011:value01:divide100", "20%", "20% of damage dealt as extra damage, all ranks"))
    st["swift_contract"]["duration_s"] = num(20.0, "confirmed", tok("se:1339000011:effect_value02:time", "20 s", DUR_SCALE))
    st["swift_contract"]["stat_mods"] = [{"stat": "combat_speed_pct", "value": num(
        20.0, "confirmed", tok("abe:1339000011:value02:divide100", "20%", "+20% Combat Speed, all ranks"))}]
    st["evasion_up"]["duration_s"] = num(20.0, "confirmed", tok("se:1337000011:effect_value02:time", "20 s", DUR_SCALE))
    # --- Exploit Weakness: 25% on attack -> Attack +5.5% (rank 1) .. +15% (rank 20), 10 s. An Attack-bucket stat mod,
    # not a flat damage multiplier.
    ew = st["exploit_weakness_atk"]
    ew["dmg_mult"] = num(1.0, "confirmed", "damage carried by the stat mod (Attack bucket)")
    ew["stat_mods"] = [{"stat": "attack_increase_pct", "value": num(
        15.0, "confirmed", tok("abe:1372001011:value02:divide100", "15%", "rank 1 5.5, 5 7.5, 10 10, 15 12.5, 20 15, 30 20, 40 25"))}]
    ew["duration_s"] = num(10.0, "confirmed", tok("se:1372001011:effect_value02:time", "10 s", "all ranks"))
    # --- hidden Frenzied Accord: PvE Damage Boost bucket (+20%), 10..30 s; Surging Bloodlust boosts ONE skill only
    fa = st["frenzied_accord"]
    fa["dmg_mult"] = num(1.0, "confirmed", "damage carried by the stat mod (PvE Damage Boost bucket)")
    fa["duration_s"] = num(20.0, "confirmed", tok("se:1315000011:effect_value02:time", "20 s", DUR_SCALE))
    fa["stat_mods"] = [{"stat": "dmg_boost_pct", "value": num(
        20.0, "confirmed", tok("abe:1315000011:value02:divide100", "20%", "PvE Damage Boost +20%, all ranks; hidden skill, availability unknown"))}]
    sb = st["surging_bloodlust"]
    sb["dmg_mult"] = num(None, "unknown", "text: 'Increases damage of 1 skill by 120%' (token abe:1317000011:value01 = 120): ONE skill, "
                         "not every cast for 10 s; the engine has no next-cast bonus (old 2.2x multiplier applied it to every cast)")
    # --- Poison passive: flat tick (not a ratio) - the engine DoT takes ratios only, so the value stays unknown
    st["poison"]["tick_ratio_pct"] = num(None, "unknown", tok(
        "se_abe_dmg:1373000711:1373000712:SkillUIDotMaxDmg:tick", "1809 per 1 s tick for 10 s",
        "rank 1 233, rank 40 2885; FLAT damage, the engine DoT only takes an ATK ratio"))
    st["poison"]["tick_s"] = num(1.0, "confirmed", tok("abe:1373000011:value03:time", "cooldown 1 s", "tick every 1 s per text"))
    # --- new: bonus statuses referenced by specialties
    st["illusive_ew_boost"] = {
        "key": "illusive_ew_boost", "name": "Illusive Clone x1.5 Exploit Weakness", "on": "self",
        "duration_s": num(20.0, "estimated", "same window as Illusive Clone (" + tok("se:1331000011:effect_value02:time", "20 s") + ")"),
        "dmg_mult": num(1.0, "confirmed", "damage carried by the stat mod"), "elements": [], "mp_min_pct": None,
        "source_skill": "illusive-clone", "tick_ratio_pct": num(0.0, "confirmed", "no tick"), "tick_s": num(1.0, "unknown", ""),
        "stat_mods": [{"stat": "attack_increase_pct", "value": num(
            7.5, "estimated", "specialty 'x1.5 [Exploit Weakness] effect': +50% of the rank-20 Attack bonus (15% -> 22.5%); "
            "assumes the Exploit Weakness buff is up (25% per attack, 10 s window: practically always)")}],
        "permanent": False}
    st["swift_rear_smite"] = {
        "key": "swift_rear_smite", "name": "Swift Contract x1.5 Rear Smite", "on": "self",
        "duration_s": num(20.0, "estimated", "same window as Swift Contract (" + tok("se:1339000011:effect_value02:time", "20 s") + ")"),
        "dmg_mult": num(1.0, "confirmed", "damage carried by the stat mod"), "elements": [], "mp_min_pct": None,
        "source_skill": "swift-contract", "tick_ratio_pct": num(0.0, "confirmed", "no tick"), "tick_s": num(1.0, "unknown", ""),
        "stat_mods": [{"stat": "dmg_boost_pct", "value": num(
            6.25, "estimated", "specialty 'x1.5 [Rear Smite] effect': +50% of Rear Smite's rank-20 PvE Damage Boost 12.5% "
            "(token abe:1374000013:value02:divide100). The Back Attack Damage Boost half (12.5%) has no Stats field: not modelled")}],
        "permanent": False}
    st["swift_assault_stance"] = {
        "key": "swift_assault_stance", "name": "Swift Contract x1.5 Assault Stance", "on": "self",
        "duration_s": num(20.0, "estimated", "same window as Swift Contract"),
        "dmg_mult": num(1.0, "confirmed", "damage carried by the stat mod"), "elements": [], "mp_min_pct": None,
        "source_skill": "swift-contract", "tick_ratio_pct": num(0.0, "confirmed", "no tick"), "tick_s": num(1.0, "unknown", ""),
        "stat_mods": [{"stat": "crit_dmg_pct", "value": num(
            12.5, "estimated", "specialty 'x1.5 [Assault Stance] effect': +50% of Assault Stance's rank-20 Critical Damage Boost 25% "
            "(token abe:1375000011:value02:divide100)")}],
        "permanent": False}


def patch_rules_triggers(m: dict) -> None:
    r = m["rules"]
    # Insignia is only engraved with the matching specialty, never by the base skill (the specialty adds the status)
    for k in ("ambush", "heart-gore", "shadow-fall"):
        r[k]["applies"] = [] if k != "shadow-fall" else ["knockdown"]
    r["ambush"]["note"] = "base: +30% damage on a Back attack (positional, not modelled). Insignia only via specialty 1 (see specialization_effects)"
    r["heart-gore"]["note"] = ("auto proc: fires on landing a Critical Hit (crit trigger below), cd 5 s, restores 100 MP; "
                               "Illusive Clone removing the cd and spec 16 reset-on-crit are NOT simulated (engine: proc owners do not feed crit specialties)")
    trig = m["triggers"]
    trig[:] = [t for t in trig if not (t.get("source_skill") == "exploit-weakness" and t["status_key"] == "insignia")]
    ev = tok("abe:1372000013:value02:divide100", "7%", "7% on landing a Critical Hit, cd 1 s; all ranks")
    trig.append({"status_key": "insignia", "on_element": "none", "chance": 0.07, "source_skill": "exploit-weakness",
                 "confidence": "confirmed", "event": "crit", "note": ev})
    # the Heart Gore engine: a crit fires the proc (own 5 s cooldown applies)
    if not any(t.get("proc_skill") == "heart-gore" for t in trig):
        trig.append({"status_key": "", "on_element": "none", "chance": 1.0, "source_skill": "heart-gore",
                     "confidence": "confirmed", "event": "crit", "proc_skill": "heart-gore",
                     "note": "Heart Gore text: 'Triggers on landing a Critical Hit'; cd 5 s (datamine cooldown_s)"})


def patch_specs(m: dict) -> None:
    skills = {e["slug"]: e for e in json.load(open(HERE / "skills.json", encoding="utf-8"))}
    m["specialization_effects"] = spec_effects(skills)


def main() -> None:
    m = json.loads(MECH.read_text(encoding="utf-8"))
    patch_statuses(m)
    patch_rules_triggers(m)
    patch_specs(m)
    m["spec_slot_ranks_note"] = "Assassin uses the default 8/12/20 slot ranks (option unlock ranks 8/8/8/12/16 actives, 5/10/15/20 stigmas)"
    MECH.write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")
    print("patched", MECH)


if __name__ == "__main__":
    main()
