"""Specialty effect overrides for the Assassin (imported by _build_specs.py). Datamine tokens first, then spec text."""
from _build_specs_lib import eff, tok

MULTI = "text '+50% Multi-Hit on hit' read as a 50% chance of one extra full hit (Multi-Hit damage is in no source)"
CRIT_RD = "text 'Critical Hit on hit' read as the hit landing as a Critical Hit (same wording family as 'lands as a Critical Hit')"
KILL = "kill-triggered effect: the simulator has no kills (trigger 'kill' is not applied)"


def chain_ratio(child, parent, skills):
    """Child chain skill damage as a multiple of the parent's (atk ratio AND flat agree, so it holds at every attack stat)."""
    c, p = skills[child]["coefficients"], skills[parent]["coefficients"]
    rr = c["atk_ratio_pct_rank1"] / p["atk_ratio_pct_rank1"]
    ff = c["flat_rank1"] / p["flat_rank1"]
    assert abs(rr - ff) < 0.01, (child, rr, ff)
    return round(rr, 4)


def unk(note):
    return eff("unknown", None, note=note)


def spec_effects(skills: dict) -> dict:
    def cr(c, p):
        return chain_ratio(c, p, skills)

    def chain_src(c, p):
        return (f"datamine: {c} atk ratio and flat are both x{cr(c, p)} of {p} (rank 1; flat at rank 20 agrees). "
                "Assumes the chain skill lands after every cast (its own MP and lock are ignored)")

    return {
        "quick-slice": {
            "2": [eff("extra_hits", 0.5, "estimated", MULTI)],
            "3": [eff("cdr_skill_s", 2.0, "estimated", "text '-1s [Insignia Explosion] cooldown on hit' x 2 hits per cast "
                      "(Metaroad hits=2); community S1: 'per hit'", skill_key="insignia-explosion")],
        },
        "throw-shadowblade": {
            "0": [eff("extra_hits", cr("shadowblade-pursuit", "throw-shadowblade"), "estimated",
                      chain_src("shadowblade-pursuit", "throw-shadowblade"))],
            "1": [eff("reset_skill", 1.0, "confirmed", "text 'Resets cooldown on defeating an enemy'",
                      skill_key="throw-shadowblade", trigger="kill", note=KILL)],
            "2": [eff("force_crit", 1.0, "estimated", CRIT_RD)],
            "3": [unk("'Changes to AoE Skill': target count not in any source")],
        },
        "ambush": {
            "0": [eff("adds_status", 10.0, "confirmed", tok("se:1306001711:effect_value02:time", "10 s"), status_key="insignia",
                      note="2 Insignias on a back attack (stack count is not tracked by the engine; presence only)")],
            "3": [unk("'50% chance to trigger [Whirlwind Slice]': Whirlwind Slice atk ratio and flat do not scale together vs Ambush")],
        },
        "insignia-explosion": {
            "1": [eff("extra_hits", 0.5, "estimated", MULTI)],
            "2": [unk("keeps 2 Insignia stacks: Insignia Explosion damage by stack (604..967 at rank 1) is not modelled (no stack counter)")],
        },
        "shadowstep": {
            "1": [eff("adds_status", 10.0, "confirmed", tok("se:1314002024:effect_value02:time", "10 s"), status_key="insignia",
                      note="5 Insignias on hit (stack count is not tracked; presence only)")],
        },
        "shadow-walk": {
            "0": [eff("no_dps", 0.0, "estimated", "stealth-only crit: out of the combat rotation")],
            "3": [eff("no_dps", 0.0, "estimated", "PvP kill-assist reset")],
        },
        "whirlwind-slice": {"0": [eff("extra_hits", 0.5, "estimated", MULTI)], "1": [unk("'Changes to AoE damage': target count not in any source")]},
        "shadow-fall": {
            "1": [eff("adds_status", 10.0, "confirmed", tok("se:1322002043:effect_value02:time", "10 s"), status_key="insignia",
                      note="3 Insignias on hit (stack count is not tracked; presence only)")],
        },
        "aerial-bind": {
            "1": [eff("extra_hits", cr("aerial-slaughter", "aerial-bind"), "estimated", chain_src("aerial-slaughter", "aerial-bind"))],
            "2": [unk("'x1.5 [Ambush Stance] effect': Ambush Stance flat proc (152..861) is not modelled")],
        },
        "smoke-bomb": {"1": [unk("'Changes to AoE Skill': target count not in any source")]},
        "shadowstrike": {"4": [unk("'Changes to AoE Skill': target count not in any source")]},
        "defiance": {
            "0": [unk("adds the Storm Slice chain (133% + 518 flat at rank 1, own cd 120 s); the engine cannot chain it without chain_next on Defiance")],
        },
        "infiltrate": {
            "3": [eff("extra_hits", cr("dark-strike", "infiltrate"), "estimated", chain_src("dark-strike", "infiltrate"))],
        },
        "savage-fang": {"3": [eff("force_crit", 1.0, "estimated", CRIT_RD)]},
        "triniels-dagger": {
            "1": [unk("'-10% all skill cooldowns on hit' (token se:1330002711:effect_value02:divide100 = 10): a % of REMAINING cooldown, "
                      "the engine only removes seconds")],
            "2": [eff("reset_skill", 1.0, "confirmed", "text 'Resets cooldown on defeating an enemy with [Triniel's Dagger]'",
                      skill_key="triniels-dagger", trigger="kill", note=KILL)],
            "3": [eff("no_dps", 0.0, "estimated", "raises the TARGET's skill cooldowns (base text: +5% of their duration): no effect on your damage")],
        },
        "illusive-clone": {
            "0": [eff("no_dps", 0.0, "estimated", tok("abe:1331001012:value02:divide100", "10%") + "; Status Effect Chance: CC only")],
            "2": [eff("adds_status", 20.0, "estimated", tok("se:1331000011:effect_value02:time", "20 s"), status_key="illusive_ew_boost",
                      note="x1.5 Exploit Weakness while the clone lasts")],
            "3": [unk("'50% chance to deal extra damage on Critical Hit': the extra damage amount is in no source "
                      "(token abe:1331004014:value02:divide100 = 50 is the chance only)")],
        },
        "swift-contract": {
            "0": [unk("'-20% MP Cost for the duration' (token abe:1339001012 = 20): needs a status-gated global MP-cost modifier")],
            "1": [eff("adds_status", 20.0, "estimated", tok("se:1339000011:effect_value02:time", "20 s"), status_key="swift_rear_smite",
                      note="x1.5 Rear Smite")],
            "2": [eff("adds_status", 20.0, "estimated", tok("se:1339000011:effect_value02:time", "20 s"), status_key="swift_assault_stance",
                      note="x1.5 Assault Stance")],
        },
        "storm-rampage": {
            "3": [unk("'Multi-Hit on hit' (no percentage in the text)")],
            "4": [eff("cdr_all_s", 4.0, "estimated", "text '-1s all skill cooldowns on hit' x 4 hits (Metaroad hits=4); Storm Rampage is "
                      "stagger-gated, so it never casts in the sim")],
        },
        "heart-gore": {
            "1": [eff("adds_status", 10.0, "confirmed", tok("se:1335002012:effect_value02:time", "10 s"), status_key="insignia",
                      note="1 Insignia on hit (presence only); Heart Gore is a proc, its cast effects are not run by the engine")],
            "2": [eff("crit_chance_add", 20.0, "estimated", "text 'Up to +20% Critical Hit when less targets hit': full value on one target "
                      "(boss); the simulator applies it at every target count")],
            "3": [unk("'Multi-Hit on hit' (no percentage in the text)")],
            "4": [eff("reset_skill", 1.0, "confirmed", "text 'Resets [Heart Gore] cooldown on landing a Critical Hit'", skill_key="heart-gore",
                      trigger="crit", note="ENGINE GAP: a PROC owner never feeds crit specialties, so this is inert until the core handles it")],
        },
    }
