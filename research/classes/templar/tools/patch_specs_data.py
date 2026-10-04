"""Templar specialization_effects overrides (option index as string). Anything not listed here uses the
generic text parser in aion2c/specparse.py (listed in tests/test_mech_templar.py as PARSED_OK)."""

DUMP = "aion2.app client dump 2026-09-18"
GUIDE = "couga54 Templar guide (Oct 2026, SolAshur build)"
MH_SRC = ("text '+N% Multi-Hit' = N% chance of one additional hit (client stat id AdditionalHitRate); the extra hit's "
          "damage is not published, modelled as one full regular hit")
NOTE_MIRROR = "chain step: the specialty belongs to the chain's first skill (tokens exist only there); modelled there"


def E(kind, value, conf="estimated", src="", **kw):
    d = {"kind": kind, "value": value, "confidence": conf, "source": src or "mechanics.json specialization_effects"}
    d.update(kw)
    return d


def U(note):
    """Value not published anywhere: unknown, the simulator warns when it is picked."""
    return [{"kind": "unknown", "value": None, "note": note}]


def NO(note):
    return [{"kind": "no_dps", "value": 0.0, "confidence": "estimated", "source": note, "note": note}]


KILL = "kill trigger: the simulator has no kill events (single dummy / pack), so this is recorded but never fires"

# chain children: their option lists mirror the parent's (dump tokens exist only on the parent)
MIRROR = {str(i): NO(NOTE_MIRROR) for i in range(5)}

SPEC_EFFECTS = {
    "decisive-strike": dict(MIRROR),
    "desperate-strike": dict(MIRROR),
    "punishing-strike": dict(MIRROR),
    "threatening-blow": {str(i): NO(NOTE_MIRROR) for i in range(4)},
    "vicious-strike": {
        # 0 (+20% MP restored), 1 (absorb), 3 (-2s Warding Strike, token se:1201004711 time = 2): generic parser
        "2": [E("extra_hits", 0.5, "estimated", MH_SRC),
              E("extra_hits", 0.5, "estimated", MH_SRC + "; applies to the whole chain", skill_key="decisive-strike"),
              E("extra_hits", 0.5, "estimated", MH_SRC + "; applies to the whole chain", skill_key="desperate-strike")],
        "4": U("adds Threatening Blow (266.4% ATK x2 hits, +150 MP) as a 4th chain step; the engine cannot extend a "
               "chain from a specialty"),
    },
    "pummel": {
        # 0 (-20% MP), 1 (absorb), 3 (-1s Punishment on landing Punishing Strike, token se:1206004711 time = 1)
        # use the generic parser
        "0": [E("mp_cost_mult", 0.8, "confirmed", "text '-20% MP consumed'"),
              E("mp_cost_mult", 0.8, "confirmed", "Punishing Strike costs MP too (120); same specialty, chain step",
                skill_key="punishing-strike")],
        "2": [E("dmg_mult", 1.12, "estimated", "'up to' 12%: scaled linearly with the targets hit", cond="less_targets"),
              E("dmg_mult", 1.12, "estimated", "same specialty on the chain step", cond="less_targets",
                skill_key="punishing-strike")],
        "4": [E("extra_hits", 1.0, "confirmed", "text 'Activates [Punishing Strike] 1 extra time': one more full "
                "Punishing Strike activation", skill_key="punishing-strike")],
    },
}

SPEC_EFFECTS.update({
    "doom-shield": {
        "0": [E("reset_skill", 1, "confirmed", "text 'Resets [Annihilate] cooldown on hit'", skill_key="annihilate")],
        "2": [E("reset_skill", 1, "confirmed", "text 'Resets cooldown on defeating an enemy'", skill_key="doom-shield",
                trigger="kill", note=KILL)],
    },
    "punishment": {
        # 0 absorb, 2 (+30% Skill Speed), 3 mobile, 4 (ignore Block + lands as Critical Hit): generic parser
        "1": [E("adds_status", None, "unknown", "DoT duration and tick are not published", status_key="punishment_dot",
                note="Inflicts Damage over Time to target on hit")],
    },
    "shield-smite": {
        "2": U("50% chance to trigger [Debilitating Smash] on hit: a free cast of another skill; the engine cannot "
               "gate a proc skill on a picked specialty"),
    },
    "poach": {
        "2": [E("reset_skill", 1, "confirmed", "text 'Resets cooldown on defeating an enemy'", skill_key="poach",
                trigger="kill", note=KILL)],
    },
    "second-skin": {"2": NO("x1.5 Ironclad Defense (Defense stat): no damage effect")},
    "armor-of-balance": {"2": NO("x1.5 Warding Shield (Block heal): no damage effect")},
    "comrade-in-arms": {
        "1": NO("x1.5 Guarding Seal shield: defensive"),
        "2": NO("x1.5 Block Pain (damage tolerance): defensive"),
    },
    "noble-armor": {
        "1": [E("adds_status", 300.0, "estimated", "x1.5 Insulting Roar (+7.5 attack points at rank 20)",
                status_key="noble_roar_x15", note="x1.5 [Insulting Roar] effect for the duration")],
        "2": [E("adds_status", 300.0, "estimated", "x1.5 Fury (+7.5 PvE Damage Boost points at rank 20)",
                status_key="noble_fury_x15", note="x1.5 [Fury] effect for the duration")],
    },
    "judgment": {
        # 4 (Remove cooldown): generic parser removes_cooldown
        "1": U("extra damage vs a target with an Impact-type status: no value in any source (Impact Hit passive "
               "gives the chance; the bonus is not published)"),
        "2": U("'Extra damage on hit': no value in any source (the dump page lists no token for it)"),
        "3": [E("force_crit", 1, "estimated", "text 'Critical Hit on hit' read as a guaranteed critical hit, like "
                "'lands as a Critical Hit' (Punishment spec 16); couga54 guide: SolAshur takes it at 12")],
    },
    "debilitating-smash": {
        "1": NO("+3s Debilitate (-25% target Defense): Defense is a user stat in the simulator, no honest multiplier"),
        "3": [E("ignore_block", 0, "estimated", "Block/Evasion do not matter against a PvE dummy", note="PvE: no effect"),
              E("extra_hits", 1.0, "estimated", "'lands as Multi-Hit' = the additional hit is guaranteed; extra hit "
                "damage unpublished, modelled as one full hit")],
        "4": U("25% chance to reset cooldown on Block: needs Block events, which the simulator does not generate"),
    },
    "annihilate": {
        "0": [E("extra_hits", 0.5, "estimated", MH_SRC)],
        # 2 (+100% vs Incapacitated-Immune): generic parser, cond unmodeled (no immunity state), 3 (-10s) parser
        "4": [E("aoe_targets_add", 3, "estimated", f"'Changes to AoE Skill': {GUIDE} says it then hits up to 4 "
                "enemies (base 1)")],
    },
    "empyrean-lords-punishment": {
        "2": [E("adds_status", 10.0, "confirmed", f"+10% PvE Damage Boost for 10 s: tokens abe:1231003711 = 10, "
                f"se:1231003711 time = 10 ({DUMP})", status_key="empyrean_spec_boost",
                note="+10% PvE Damage Boost and +5% PvP Damage Boost for 10s on hit")],
    },
    "flash-rampage": {
        "3": [E("extra_hits", 0.5, "estimated", MH_SRC)],
    },
    "executing-blade": {
        "1": U("'Inflict Exposed for 5s': what Exposed does is not published (token se:1241002016 time = 5 only)"),
        "2": [E("force_crit", 1, "estimated", "text 'Critical Hit on hit' read as a guaranteed critical hit")],
    },
    "shield-rush": {
        "2": U("'Changes to Charge Skill and deals AoE damage': target count and charge time not published"),
    },
    "battlefield-banner": {
        "0": U("+10% Multi-Hit Chance for the duration is a stat bonus on every skill; Stats has no Multi-Hit field"),
        "1": [E("adds_status", 20.0, "estimated", "+10% Weapon Damage Boost for the duration (token abe:1245001013 = 10)",
                status_key="banner_weapon_dmg", note="+10% Weapon Damage Boost for duration")],
        "2": U("+20% Attack increase proportional to Defense: the Defense-to-Attack ratio is not published"),
    },
})

SLOT_RANKS = [
    {"value": 8, "confidence": "estimated", "source": f"{GUIDE}: first slot at rank 8 (all actives list 8 as first tier)"},
    {"value": 12, "confidence": "estimated", "source": f"{GUIDE}: Shield Rush/Debilitating Smash at 12 equip two options"},
    {"value": 20, "confidence": "estimated", "source": f"{GUIDE}: 'the third slot opens at 20' (Annihilate). Stigmas "
     "show one pick per tier 5/10/15 instead; one list per class cannot express both"},
]
