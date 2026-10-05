"""Frozen data contracts for aion2c (PLAN section 2.1 + 3b). Wave 0 owns this file.

Hashing: only dict-free classes are hashable. GameData, CharacterBuild, SimConfig, SimResult,
SkillBar, KeybindPlan, LiveState hold dicts: never use them as lru_cache args or dict keys.
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Literal

Confidence = Literal["confirmed", "estimated", "unknown"]
Region = Literal["global", "korea"]
Element = Literal["fire", "water", "earth", "none"]


class SkillKind(str, Enum):
    ACTIVE = "active"
    PASSIVE = "passive"
    STIGMA = "stigma"
    CHAIN = "chain"
    PROC = "proc"
    CHARGE_TIER = "charge_tier"
    SYSTEM = "system"
    DODGE = "dodge"


@dataclass(frozen=True)
class Num:
    value: float | None
    confidence: Confidence = "unknown"
    source: str = ""


# Mastery specialty slots open at these skill ranks: client SpecializedSkillSlot UnlockSkillLv 8/12/20 (the three
# user-editable Mastery slots; docs/adr/0003). Options unlock per Specialization.rank_required (8/8/8/12/16 on
# Sorcerer), a different table (SpecializedSkillParts). Overridable per class with mechanics.json "spec_slot_ranks".
SPEC_SLOT_RANKS = tuple(
    Num(float(r), "confirmed", "client SpecializedSkillSlot UnlockSkillLv 8/12/20 (Mastery, bUserEditSlot); "
        "docs/adr/0003")
    for r in (8, 12, 20)
)


@dataclass(frozen=True)
class RankData:
    rank: int
    flat_min: Num
    flat_max: Num
    cooldown_s: Num
    mp_cost: Num


# Specialty effect kinds (engine/simulator.py applies them; specs.py parses text into them).
#   cooldown_add_s     value = seconds added to the skill's own cooldown (negative = shorter)
#   cooldown_mult      value = multiplier on the skill's own cooldown (0.8 = -20%)
#   cast_speed_pct     value = +% Skill Speed: this skill's animation lock and charge time shrink by 1/(1+v/100)
#   anim_add_s         value = seconds added to the skill's animation lock (negative = faster)
#   dmg_mult           value = multiplier on this skill's damage (see `cond`)
#   extra_hits         value = additional hits per cast, each worth one more hit of the skill's damage
#   adds_status        status_key = Status applied by this skill (on every cast, `chance` accumulator)
#   resource_restore   value = MP restored per cast (or per crit event when trigger == "crit")
#   removes_cooldown   the skill's own cooldown becomes 0 (optionally only while `requires_status` is active)
#   cdr_skill_s        value = seconds taken off skill_key's remaining cooldown per event
#   cdr_all_s          value = seconds taken off every other skill's remaining cooldown per event
#   reset_skill        skill_key's cooldown is reset per event
#   aoe_targets_add    value = extra targets hit
#   duration_add_s     value = seconds added to every status this skill applies
#   mp_cost_mult       value = multiplier on the skill's MP cost (0 = free)
#   force_crit         every hit of this skill crits (effective crit chance 100%)
#   crit_chance_add    value = +% crit chance on this skill's hits only
#   charges            value = extra consecutive uses before the cooldown starts
#   charge             value = charge-time multiplier (0.5 = half the charge time)
#   mobile             skill can be cast while moving: no DPS effect
#   ignore_block       ignores Block/Evasion: no effect against a PvE dummy (modelled as 0)
#   no_dps             anything else with no damage-race effect (heal, shield, CC chance ...)
#   unknown            text the parser could not turn into numbers: warned about, never applied silently
SPEC_EFFECT_KINDS = (
    "cooldown_add_s", "cooldown_mult", "cast_speed_pct", "anim_add_s", "dmg_mult", "extra_hits", "adds_status",
    "resource_restore", "removes_cooldown", "cdr_skill_s", "cdr_all_s", "reset_skill", "aoe_targets_add",
    "duration_add_s", "mp_cost_mult", "force_crit", "crit_chance_add", "charges", "charge", "mobile", "ignore_block", "no_dps",
    "unknown",
)


@dataclass(frozen=True)
class SpecEffect:
    kind: str
    value: Num = Num(None, "unknown")
    chance: float = 1.0  # probability the effect fires per event (accumulator, never random)
    trigger: str = "cast"  # "cast" (every cast / on hit) | "crit" (per crit event) | "kill" (not modelled)
    cond: str = ""  # "" | "more_targets" | "less_targets" | "unmodeled" (listed but not simulated)
    skill_key: str | None = None  # target skill for cdr_skill_s / reset_skill (or a cooldown effect on ANOTHER skill)
    on_skill: str | None = None  # trigger "cast" fires on a cast of this skill instead of the owner
    status_key: str | None = None  # Status for adds_status
    requires_status: str | None = None  # effect only applies while this status is active
    note: str = ""


@dataclass(frozen=True)
class Specialization:
    rank_required: int | None
    text: str
    effects: tuple[SpecEffect, ...] = ()


@dataclass(frozen=True)
class Skill:
    key: str
    skill_id: int | None
    name: str
    name_kr: str | None
    kind: SkillKind
    element: Element
    unlock_level: int | None
    max_rank: int
    regions: frozenset[Region]
    atk_ratio_pct: Num
    ranks: tuple[RankData, ...]
    range_m: float | None
    aoe_targets: int
    hits: int
    anim_lock_s: Num
    # trailing fields default (additive deviation from PLAN: all were required)
    icon: str | None = None
    description: str = ""
    tags: tuple[str, ...] = ()
    specializations: tuple[Specialization, ...] = ()
    # Stagger-only skills (damage is stagger gauge, not HP): tag "stagger_only" (or "stagger") or
    # hp_dmg_coeff 0.0 makes the simulator value them at zero HP damage. A coefficient between 0 and 1
    # scales the listed damage (e.g. a hit that is partly stagger gauge).
    hp_dmg_coeff: float = 1.0
    stagger_gauge: float | None = None  # datamine "Stagger Gauge Damage" (range -> upper bound), information only


STATUS_STAT_FIELDS = (
    "combat_speed_pct", "cdr_pct", "crit_chance_pct", "crit_dmg_pct", "attack_increase_pct", "dmg_boost_pct",
)  # Stats fields a Status may modify while active


@dataclass(frozen=True)
class StatMod:
    stat: str  # one of STATUS_STAT_FIELDS
    value: Num  # added to the live stat while the status is active


@dataclass(frozen=True)
class RankScale:
    """A status value that follows the rank of the skill that applies it (client anchor points, linear between).

    `target` is "duration" or a StatMod stat; `anchors` are (rank, value) pairs in ascending rank order, clamped
    outside; `at_rank` is the rank the status's own (single) value in the data is stated at."""
    skill: str
    target: str
    anchors: tuple[tuple[float, float], ...]
    at_rank: int


@dataclass(frozen=True)
class Status:
    key: str
    name: str
    on: Literal["self", "target"]
    duration_s: Num  # value 0.0 = permanent aura/toggle: active from the first cast (passive: always)
    dmg_mult: Num
    elements: frozenset[Element] = frozenset()
    mp_min_pct: float | None = None
    source_skill: str | None = None
    tick_ratio_pct: Num = Num(0.0, "unknown")
    tick_s: Num = Num(1.0, "unknown")
    stat_mods: tuple[StatMod, ...] = ()  # live-stat changes while active (self statuses)
    permanent: bool = False  # explicit aura flag; duration_s.value == 0 behaves the same
    tick_flat_ranks: tuple[Num, ...] = ()  # flat damage added to each tick, per rank (index 0 = rank 1) of the skill that applies it
    rank_scales: tuple[RankScale, ...] = ()  # the value above re-valued at the build's own skill rank (engine/rank_values.py)


@dataclass(frozen=True)
class StatusTrigger:
    """Fires on an event and (a) applies `status_key`, (b) auto-fires `proc_skill`, (c) resets `reset_skill`.

    event "cast": a cast of a skill whose element is `on_element` (any skill in `on_skills` if given) - the
        original behaviour. event "crit": expected crit events (accumulator over hits x effective crit
        chance). event "status": `on_status` was just applied. For "crit"/"status", on_element "none" = any.
    chance is per event. `window_s` > 0 makes the applied status last that long (a trigger window that
    PROC-kind skills with SkillRule.requires=(status_key,) can be cast in). proc_skill (kind PROC) deals its
    own damage for free each time the trigger fires, subject to its own cooldown.
    """
    status_key: str
    on_element: Element
    chance: float
    source_skill: str
    confidence: Confidence = "estimated"
    event: Literal["cast", "crit", "status"] = "cast"
    on_skills: tuple[str, ...] = ()
    on_status: str | None = None
    proc_skill: str | None = None
    reset_skill: str | None = None
    window_s: float = 0.0
    requires_status: str | None = None  # fires only while this status (e.g. a target debuff) is active


@dataclass(frozen=True)
class ChargeLevel:
    level: int
    charge_s: Num
    dmg_mult: Num
    hits: int | None = None  # hits of a cast released at this level; None = the skill's own `hits`
    flat_frac: float | None = None  # share of (flat_max - flat_min) this level deals; None = linear in the level


@dataclass(frozen=True)
class SkillRule:
    skill_key: str
    applies: tuple[str, ...] = ()
    apply_chance: float = 1.0
    requires: tuple[str, ...] = ()
    consumes: tuple[str, ...] = ()
    chain_next: str | None = None
    chain_window_s: float = 3.0
    charge_levels: tuple[ChargeLevel, ...] = ()
    mp_restore: float = 0.0
    confidence: Confidence = "estimated"
    note: str = ""
    # (owner skill key, 0-based option index): this skill (a chain follow-up or proc) only exists while that
    # specialty option is chosen AND unlocked at the owner's rank. None = always available.
    requires_spec: tuple[str, int] | None = None


@dataclass(frozen=True)
class Link:
    parent_key: str
    child_key: str
    kind: Literal["chain", "proc", "charge", "condition", "upgrade", "cancel"]
    confidence: Confidence


@dataclass(frozen=True)
class CommunityRotation:
    key: str
    source: str
    scenario_key: str
    priority: tuple[str, ...]
    note: str = ""


@dataclass(frozen=True)
class RoadmapItem:
    level: int
    kind: Literal["skill", "zone", "system", "stigma", "gear", "daevanion"]
    text: str
    regions: frozenset[Region]


# ---- Daevanion + crafting (PLAN 3b) ----
@dataclass(frozen=True)
class DaevanionEffect:
    stat: str
    value: float
    unit: str


@dataclass(frozen=True)
class DaevanionNode:
    id: int
    name: str
    rarity: str
    cost: int
    node_type: str  # "start" | "stat" | "skill" | other raw
    effects: tuple[DaevanionEffect, ...]
    skill_key: str | None
    adjacent: tuple[int, ...]
    x: int
    y: int


@dataclass(frozen=True)
class DaevanionBoard:
    key: str
    name: str
    unlock_level: int
    nodes: dict[int, DaevanionNode]
    start_id: int
    # Point type the board is paid in (client DaevanionBoard.CostPointType): "daevanion" (DaevanionCrystal) or
    # "battle" (BattleCrystal, the Azphel board). daevanion_points never pays for a "battle" board.
    currency: str = "daevanion"


@dataclass(frozen=True)
class RecipeMaterial:
    item: str
    qty: int
    source: str | None = None


@dataclass(frozen=True)
class Recipe:
    id: int
    name: str
    profession: str
    level: int | None
    output_item: str
    output_qty: int
    item_level: int | None
    grade: str | None
    materials: tuple[RecipeMaterial, ...]
    base_materials: tuple[RecipeMaterial, ...]
    sorc_relevant: bool | None
    source_url: str


@dataclass(frozen=True)
class GameData:
    schema_version: int
    data_version: str
    built_at: str
    level_caps: dict[Region, int]
    rank_caps: dict[Region, dict[str, int]]
    stigma_slots: dict[Region, int]
    skills: dict[str, Skill]
    statuses: dict[str, Status]
    rules: dict[str, SkillRule]
    triggers: tuple[StatusTrigger, ...]
    links: tuple[Link, ...]
    community: tuple[CommunityRotation, ...]
    roadmap: tuple[RoadmapItem, ...]
    daevanion: dict[str, DaevanionBoard] = field(default_factory=dict)
    recipes: tuple[Recipe, ...] = ()
    class_key: str = "sorcerer"
    # skill rank at which each specialty SLOT opens (a skill equips as many options as it has open slots)
    spec_slot_ranks: tuple[Num, ...] = field(default_factory=lambda: SPEC_SLOT_RANKS)
    specs_parsed: bool = False  # True once every Specialization.effects was filled (build or load time)


@dataclass(frozen=True)
class Stats:
    # `attack` = weapon attack BEFORE Amp Ratio: the midpoint of the sheet's Max/Min Attack (weapon range + flat Attack
    # lines), without Attack Bonus (the engine adds opened Daevanion nodes' Attack Bonus itself) and without the
    # `attack_increase_pct` / `weapon_dmg_pct` multipliers, which damage.py applies. The default 1000 is a placeholder.
    attack: float = 1000
    attack_increase_pct: float = 0
    weapon_dmg_pct: float = 0
    dmg_boost_pct: float = 0
    pve_dmg_pct: float = 0
    boss_dmg_pct: float = 0
    crit_chance_pct: float = 0
    crit_dmg_pct: float = 50
    smite_pct: float = 0
    combat_speed_pct: float = 0
    cdr_pct: float = 0
    max_mp: float = 2000
    mp_regen_per_s: float = 20
    target_defense: float = 0
    penetration: float = 0


# Client UI text (UI_desc_CoolTimeIncrease: "Cooldown reduction is capped at 60%"; StatCorrectionNumber.CoolTimeIncrease
# min -6000 = -60%). The cap applies to the total of every source (gear, Illusion, Daevanion, buffs), so it is applied
# where a cooldown is turned into a ready time, never to one source on its own.
CDR_CAP_PCT = 60.0


def cooldown_scale(cdr_pct: float) -> float:
    """Multiplier on a base cooldown for a total cooldown reduction of `cdr_pct` percent, capped at CDR_CAP_PCT."""
    return 1.0 - min(max(cdr_pct, 0.0), CDR_CAP_PCT) / 100


# Explicit "typical level-45 character" profile for validation runs and manual-build defaults, applied identically to
# every class. Stats() stays the all-zero contract default (tests depend on it). Sources: attack +1.6%, combat speed
# +3.8%, cooldown 0.1% come from the DarthThot armory sample (tests/fixtures/armory/info.json, level 44, attribute
# bonuses only); crit chance 15% is an ESTIMATE (the same sample shows only +2.8% from attributes, gear adds the
# rest; 10-20% is typical at 45), needed because crit-triggered procs (Heart Gore) never fire at 0% crit.
# Attack 550 and MP 1000 replace the Stats() placeholders (1000 / 2000) for manual builds: the three real level 44-45
# stat sheets (tests/fixtures) have weapon attack 553 / 791 / 811 (midpoint of Max/Min Attack before Amp Ratio) and MP
# 978 / 1861 / 1337, so 550 and 1000 are the low end of what a level-45 character has.
BASELINE_L45_STATS = Stats(attack=550, attack_increase_pct=1.6, combat_speed_pct=3.8, cdr_pct=0.1, crit_chance_pct=15.0,
                           max_mp=1000)


@dataclass(frozen=True)
class CharacterBuild:
    name: str
    region: Region
    level: int
    skill_ranks: dict[str, int] = field(default_factory=dict)
    stigmas: tuple[str, ...] = ()
    specs: dict[str, tuple[int, ...]] = field(default_factory=dict)
    stats: Stats = field(default_factory=Stats)
    show_kr: bool = False
    daevanion_nodes: frozenset[int] = frozenset()
    skill_points: int | None = None
    stigma_points: int | None = None
    class_key: str = "sorcerer"
    # Rank bonuses entered by the user for sources the data cannot compute (Arcana / Soul Binding), skill key -> +ranks.
    # Added on top of skill-point ranks and Daevanion skill nodes, then clamped to the region cap (see total_rank).
    bonus_ranks: dict[str, int] = field(default_factory=dict)
    # Stigma unlock (Ascension grade 3 + faction quest): True = unlocked, False = no stigma ranks bought, None = infer
    # (progression.stigma_unlock: a held stigma rank proves it, otherwise the level gate, reported as inferred).
    stigma_unlocked: bool | None = None


@dataclass(frozen=True)
class Scenario:
    key: str
    name: str
    duration_s: float
    n_targets: int
    boss: bool


SCENARIOS = (
    Scenario("boss_180", "Single-target boss", 180, 1, True),
    Scenario("aoe_pack", "AoE pack (4)", 30, 4, False),
    Scenario("level_pull", "Leveling pull (3)", 15, 3, False),
)


@dataclass(frozen=True)
class PriorityEntry:
    skill_key: str
    charge_level: int = 0  # 0 = not a charge skill; on a charge skill 0 = highest level
    require_status: str | None = None


@dataclass(frozen=True)
class Priority:
    entries: tuple[PriorityEntry, ...]
    label: str = ""


@dataclass(frozen=True)
class SimConfig:
    tick_ms: int = 100
    anim_overrides: dict[str, float] = field(default_factory=dict)
    start_mp_pct: float = 100.0
    auto_chain: bool = True


@dataclass(frozen=True)
class CastEvent:
    t_s: float
    skill_key: str
    charge_level: int
    damage: float
    mp_after: float
    active_statuses: tuple[str, ...]


@dataclass(frozen=True)
class SkillTally:
    casts: int
    damage: float


@dataclass(frozen=True)
class SimResult:
    total_damage: float
    dps: float
    duration_s: float
    casts: tuple[CastEvent, ...]
    per_skill: dict[str, SkillTally]
    status_uptime: dict[str, float]
    warnings: tuple[str, ...]
    confidence: Confidence


@dataclass(frozen=True)
class SearchBudget:
    max_candidates: int = 400
    max_len: int = 10
    seed: int = 0


@dataclass(frozen=True)
class RankedOption:
    rank: int
    priority: Priority
    result: SimResult
    explanation: str


@dataclass(frozen=True)
class Disagreement:
    community_key: str
    skill_key: str
    community_pos: int
    ours_pos: int
    dps_delta_pct: float
    text: str


@dataclass(frozen=True)
class OptimizeResult:
    scenario: Scenario
    options: tuple[RankedOption, ...]
    disagreements: tuple[Disagreement, ...]


@dataclass(frozen=True)
class StatGain:
    stat: str
    delta: float
    dps_gain_pct: float
    confidence: Confidence


@dataclass(frozen=True)
class LiveState:
    t_s: float
    cooldowns_s: dict[str, float]
    statuses: dict[str, float]
    mp: float | None
    target_hp_pct: float | None
    confidence: Confidence


KEY_LABELS = ("1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=") + tuple(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
)  # the ONLY valid bar labels


@dataclass(frozen=True)
class SkillBar:
    slots: dict[str, str | None] = field(default_factory=dict)


@dataclass(frozen=True)
class SlotStack:
    key_label: str
    stack: tuple[str, ...]  # <= 4, index 0 fires first = the BOTTOM cell in game (priority 0)


@dataclass(frozen=True)
class MacroEntry:
    index: int
    key_label: str
    delay_ms: int = 10


@dataclass(frozen=True)
class MacroPlan:
    name: str
    hotkey: str
    entries: tuple[MacroEntry, ...]  # <= 20


@dataclass(frozen=True)
class GKeyAssignment:
    gkey: Literal["G1", "G2", "G3", "G4", "G5"]
    mstate: Literal["M1", "M2", "M3"]
    sends: str
    purpose: str
    risk: Literal["lowest_known", "caution"]  # no official statement exists; never "safe"


@dataclass(frozen=True)
class KeybindPlan:
    stacks: tuple[SlotStack, ...] = ()
    macros: tuple[MacroPlan, ...] = ()
    gkeys: tuple[GKeyAssignment, ...] = ()
    macro_dps: dict[str, float] = field(default_factory=dict)
    ideal_dps: dict[str, float] = field(default_factory=dict)
    manual_every_s: dict[str, float] = field(default_factory=dict)
    warnings: tuple[str, ...] = ()
    # additive fields (macro redesign): all optional, old callers never set them
    hybrid_dps: dict[str, float] = field(default_factory=dict)  # macro name -> macro + hand-pressed manual skills
    slot_notes: dict[str, str] = field(default_factory=dict)  # slot label -> why this stack is ordered that way
    macro_advice: dict[str, str] = field(default_factory=dict)  # macro name -> plain-English verdict
    rotation: dict[str, dict] = field(default_factory=dict)  # scenario key -> engine.rotation.explain_rotation output
    thumbs: tuple[tuple[str, str, str], ...] = ()  # G900 (button, sends, description)


# ---- constants (PLAN 3b), all `estimated` ----
# Raw Daevanion stat -> (Stats field, multiplier, confidence). Ratings whose %-conversion is
# unknown map to ("", 0, "unknown"): counted and shown, NOT simulated (warning).
STAT_MAP: dict[str, tuple[str, float, Confidence]] = {
    "Attack Bonus": ("attack", 1.0, "estimated"),
    "Combat Speed": ("combat_speed_pct", 1.0, "estimated"),
    "Cooldown Reduction": ("cdr_pct", 1.0, "estimated"),
    "Damage Boost": ("dmg_boost_pct", 1.0, "estimated"),
    "Critical Damage Boost": ("crit_dmg_pct", 1.0, "estimated"),
    "Penetration": ("penetration", 1.0, "estimated"),
    "Critical Hit": ("", 0.0, "unknown"),
    "Multi-hit Chance": ("", 0.0, "unknown"),
    "Status Effect Chance": ("", 0.0, "unknown"),
    "MP": ("", 0.0, "unknown"),
    "HP": ("", 0.0, "unknown"),
}
# How each conversion was reached (shown next to the node; "unknown" rows are counted but not simulated).
STAT_MAP_NOTES: dict[str, str] = {
    "Attack Bonus": "flat Attack, added 1:1 (datamine node value, e.g. +3)",
    "Combat Speed": "orange (Unique) node, value is already a % (1.5): added to combat_speed_pct 1:1",
    "Cooldown Reduction": "orange (Unique) node, value is already a % (1.5): added to cdr_pct 1:1",
    "Damage Boost": "orange (Unique) node, value is already a % (1.5): added to dmg_boost_pct 1:1",
    "Critical Damage Boost": "orange (Unique) node, value is already a % (1.5): added to crit_dmg_pct 1:1 (same bucket)",
    "Penetration": "flat Penetration, added 1:1",
    "Critical Hit": "flat rating (+5); %-conversion depends on the target's crit resist gap (crit chance caps at 50%): not simulated",
    "Multi-hit Chance": "orange node (%), Multi-Hit damage per proc is unverified: not simulated",
    "Status Effect Chance": "no damage effect modelled: not simulated",
    "MP": "flat MP, no DPS conversion modelled",
    "HP": "flat HP, no DPS conversion modelled",
}
SKILL_POINT_COST = (0, 1, 1, 1, 2, 2, 2, 4, 4, 4)  # index 0 = rank 1 (free)
# index i = cost of stigma level i+1 (levels 1-20, sum 75 per mastery_stigma.md; PLAN's [8]*4 summed to 67)
STIGMA_POINT_COST = tuple([1] * 5 + [2] * 5 + [4] * 5 + [8] * 5)


def effective_rank(gd: "GameData", build: "CharacterBuild", skill: Skill) -> int:
    """clamp(build rank, 1, min(len(skill.ranks), region cap for core/stigma))."""
    cap_key = "stigma" if skill.kind == SkillKind.STIGMA else "core"
    cap = min(len(skill.ranks), gd.rank_caps[build.region][cap_key])
    return max(1, min(build.skill_ranks.get(skill.key, 1), cap))


MAX_DAEVANION_RANK_BONUS = 4  # each Daevanion skill node of a skill is +1 rank, at most +4 (mastery_stigma.md)


_BONUS_CACHE: dict[tuple, tuple] = {}  # (id(gd), level, nodes) -> (gd, {skill key: +ranks}); gd kept alive so ids stay unique


def _daevanion_bonus_map(gd: "GameData", build: "CharacterBuild") -> dict[str, int]:
    ck = (id(gd), build.level, build.daevanion_nodes)
    hit = _BONUS_CACHE.get(ck)
    if hit is None or hit[0] is not gd:
        counts: dict[str, int] = {}
        for board in gd.daevanion.values():
            if board.unlock_level > build.level:
                continue
            for i in build.daevanion_nodes:
                nd = board.nodes.get(i)
                if nd is not None and nd.skill_key:
                    counts[nd.skill_key] = counts.get(nd.skill_key, 0) + 1
        hit = (gd, {k: min(v, MAX_DAEVANION_RANK_BONUS) for k, v in counts.items()})
        if len(_BONUS_CACHE) > 256:
            _BONUS_CACHE.clear()
        _BONUS_CACHE[ck] = hit
    return hit[1]


def daevanion_rank_bonus(gd: "GameData", build: "CharacterBuild", key: str) -> int:
    """Selected Daevanion skill nodes of `key` on boards unlocked at the build's level, capped at +4."""
    if not build.daevanion_nodes:
        return 0
    return _daevanion_bonus_map(gd, build).get(key, 0)


def total_rank(gd: "GameData", build: "CharacterBuild", skill: Skill) -> int:
    """The rank a skill really plays at: skill-point rank (<= 10 bought) + Daevanion skill nodes (+1 each, <= +4)
    + the user's `bonus_ranks` entry (Arcana / Soul Binding), clamped to the region cap. Specialty slots and
    options (rank 8/12/16/20) unlock on this rank, not on the skill-point rank."""
    cap_key = "stigma" if skill.kind == SkillKind.STIGMA else "core"
    cap = min(len(skill.ranks), gd.rank_caps[build.region][cap_key])
    bonus = daevanion_rank_bonus(gd, build, skill.key) + max(0, build.bonus_ranks.get(skill.key, 0))
    return max(1, min(effective_rank(gd, build, skill) + bonus, cap)) if cap >= 1 else 1
