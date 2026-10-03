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


@dataclass(frozen=True)
class RankData:
    rank: int
    flat_min: Num
    flat_max: Num
    cooldown_s: Num
    mp_cost: Num


@dataclass(frozen=True)
class Specialization:
    rank_required: int | None
    text: str


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


@dataclass(frozen=True)
class Status:
    key: str
    name: str
    on: Literal["self", "target"]
    duration_s: Num
    dmg_mult: Num
    elements: frozenset[Element] = frozenset()
    mp_min_pct: float | None = None
    source_skill: str | None = None
    tick_ratio_pct: Num = Num(0.0, "unknown")
    tick_s: Num = Num(1.0, "unknown")


@dataclass(frozen=True)
class StatusTrigger:
    status_key: str
    on_element: Element
    chance: float
    source_skill: str
    confidence: Confidence = "estimated"


@dataclass(frozen=True)
class ChargeLevel:
    level: int
    charge_s: Num
    dmg_mult: Num


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


@dataclass(frozen=True)
class Stats:
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
    stack: tuple[str, ...]  # <= 4, index 0 fires first


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


# ---- constants (PLAN 3b), all `estimated` ----
# Raw Daevanion stat -> (Stats field, multiplier, confidence). Ratings whose %-conversion is
# unknown map to ("", 0, "unknown"): counted and shown, NOT simulated (warning).
STAT_MAP: dict[str, tuple[str, float, Confidence]] = {
    "Attack Bonus": ("attack", 1.0, "estimated"),
    "Combat Speed": ("combat_speed_pct", 1.0, "estimated"),
    "Cooldown Reduction": ("cdr_pct", 1.0, "estimated"),
    "Damage Boost": ("dmg_boost_pct", 1.0, "estimated"),
    "Penetration": ("penetration", 1.0, "estimated"),
    "Critical Hit": ("", 0.0, "unknown"),
    "Critical Damage Boost": ("", 0.0, "unknown"),
    "Multi-hit Chance": ("", 0.0, "unknown"),
    "Status Effect Chance": ("", 0.0, "unknown"),
    "MP": ("", 0.0, "unknown"),
    "HP": ("", 0.0, "unknown"),
}
SKILL_POINT_COST = (0, 1, 1, 1, 2, 2, 2, 4, 4, 4)  # index 0 = rank 1 (free)
# index i = cost of stigma level i+1 (levels 1-20, sum 75 per mastery_stigma.md; PLAN's [8]*4 summed to 67)
STIGMA_POINT_COST = tuple([1] * 5 + [2] * 5 + [4] * 5 + [8] * 5)


def effective_rank(gd: "GameData", build: "CharacterBuild", skill: Skill) -> int:
    """clamp(build rank, 1, min(len(skill.ranks), region cap for core/stigma))."""
    cap_key = "stigma" if skill.kind == SkillKind.STIGMA else "core"
    cap = min(len(skill.ranks), gd.rank_caps[build.region][cap_key])
    return max(1, min(build.skill_ranks.get(skill.key, 1), cap))
