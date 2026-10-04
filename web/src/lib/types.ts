/**
 * TypeScript mirror of the JSON that `aion2c.webapi` returns (the serde.to_dict form of app/aion2c/models.py).
 * Rules of the wire format: dataclass -> object, Enum -> its string value, tuple/set/frozenset -> array
 * (sets sorted), dict keys -> strings, None -> null.
 * Checked against real CPython output by src/lib/types.test.ts (fixtures from web/scripts/make_fixtures.py).
 */

export type Confidence = "confirmed" | "estimated" | "unknown";
export type Region = "global" | "korea";
export type Element = "fire" | "water" | "earth" | "none";
export type SkillKind = "active" | "passive" | "stigma" | "chain" | "proc" | "charge_tier" | "system" | "dodge";
export type ClassRole = "melee_dps" | "ranged_dps" | "tank" | "healer" | "support";

/** Armory region codes the proxy accepts. */
export type ArmoryRegion = "nae" | "naw" | "eu" | "la" | "as";

export interface Num {
  value: number | null;
  confidence: Confidence;
  source: string;
}

export interface RankData {
  rank: number;
  flat_min: Num;
  flat_max: Num;
  cooldown_s: Num;
  mp_cost: Num;
}

export interface Specialization {
  rank_required: number | null;
  text: string;
  /** parsed spec effects (engine SpecEffect), see models.py */
  effects: Record<string, unknown>[];
}

export interface Skill {
  key: string;
  skill_id: number | null;
  name: string;
  name_kr: string | null;
  kind: SkillKind;
  element: Element;
  unlock_level: number | null;
  max_rank: number;
  regions: Region[];
  atk_ratio_pct: Num;
  ranks: RankData[];
  range_m: number | null;
  aoe_targets: number;
  hits: number;
  anim_lock_s: Num;
  /** Legacy local file name from the desktop app. Never used on the web: use IconUrls instead. */
  icon: string | null;
  description: string;
  tags: string[];
  specializations: Specialization[];
  /** 0 = deals no HP damage (the simulator values it at zero); default 1 */
  hp_dmg_coeff: number;
  /** datamine stagger gauge damage, information only */
  stagger_gauge: number | null;
}

export interface Status {
  key: string;
  name: string;
  on: "self" | "target";
  duration_s: Num;
  dmg_mult: Num;
  elements: Element[];
  mp_min_pct: number | null;
  source_skill: string | null;
  tick_ratio_pct: Num;
  tick_s: Num;
  /** live-stat changes while the status is active (self statuses) */
  stat_mods: { stat: string; value: Num }[];
  /** explicit aura flag; duration 0 behaves the same */
  permanent: boolean;
}

export interface StatusTrigger {
  status_key: string;
  on_element: Element;
  chance: number;
  source_skill: string;
  confidence: Confidence;
  event: string;
  on_skills: string[];
  on_status: string | null;
  proc_skill: string | null;
  reset_skill: string | null;
  window_s: number;
  /** fires only while this status is active */
  requires_status: string | null;
}

export interface ChargeLevel {
  level: number;
  charge_s: Num;
  dmg_mult: Num;
}

export interface SkillRule {
  skill_key: string;
  applies: string[];
  apply_chance: number;
  requires: string[];
  consumes: string[];
  chain_next: string | null;
  chain_window_s: number;
  charge_levels: ChargeLevel[];
  mp_restore: number;
  confidence: Confidence;
  note: string;
  /** [owner skill key, 0-based option]: this skill only exists while that specialty option is chosen */
  requires_spec: [string, number] | null;
}

export interface Link {
  parent_key: string;
  child_key: string;
  kind: "chain" | "proc" | "charge" | "condition" | "upgrade" | "cancel";
  confidence: Confidence;
}

export interface CommunityRotation {
  key: string;
  source: string;
  scenario_key: string;
  priority: string[];
  note: string;
}

export interface RoadmapItem {
  level: number;
  kind: "skill" | "zone" | "system" | "stigma" | "gear" | "daevanion";
  text: string;
  regions: Region[];
}

export interface DaevanionEffect {
  stat: string;
  value: number;
  unit: string;
}

export interface DaevanionNode {
  id: number;
  name: string;
  rarity: string;
  cost: number;
  node_type: string;
  effects: DaevanionEffect[];
  skill_key: string | null;
  adjacent: number[];
  x: number;
  y: number;
}

export interface DaevanionBoard {
  key: string;
  name: string;
  unlock_level: number;
  /** node id (as a string) -> node */
  nodes: Record<string, DaevanionNode>;
  start_id: number;
}

export interface RecipeMaterial {
  item: string;
  qty: number;
  source: string | null;
}

export interface Recipe {
  id: number;
  name: string;
  profession: string;
  level: number | null;
  output_item: string;
  output_qty: number;
  item_level: number | null;
  grade: string | null;
  materials: RecipeMaterial[];
  base_materials: RecipeMaterial[];
  sorc_relevant: boolean | null;
  source_url: string;
}

export interface GameData {
  schema_version: number;
  data_version: string;
  built_at: string;
  level_caps: Record<Region, number>;
  rank_caps: Record<Region, Record<string, number>>;
  stigma_slots: Record<Region, number>;
  skills: Record<string, Skill>;
  statuses: Record<string, Status>;
  rules: Record<string, SkillRule>;
  triggers: StatusTrigger[];
  links: Link[];
  community: CommunityRotation[];
  roadmap: RoadmapItem[];
  daevanion: Record<string, DaevanionBoard>;
  recipes: Recipe[];
  class_key: string;
  /** rank each specialization slot unlocks at */
  spec_slot_ranks: Num[];
  specs_parsed: boolean;
}

export interface Stats {
  attack: number;
  attack_increase_pct: number;
  weapon_dmg_pct: number;
  dmg_boost_pct: number;
  pve_dmg_pct: number;
  boss_dmg_pct: number;
  crit_chance_pct: number;
  crit_dmg_pct: number;
  smite_pct: number;
  combat_speed_pct: number;
  cdr_pct: number;
  max_mp: number;
  mp_regen_per_s: number;
  target_defense: number;
  penetration: number;
}

export interface CharacterBuild {
  name: string;
  region: Region;
  level: number;
  skill_ranks: Record<string, number>;
  stigmas: string[];
  specs: Record<string, number[]>;
  stats: Stats;
  show_kr: boolean;
  daevanion_nodes: number[];
  skill_points: number | null;
  stigma_points: number | null;
  class_key: string;
  /** Arcana / Soul Binding rank bonuses entered by the user (skill key -> +ranks); Daevanion nodes are separate. */
  bonus_ranks: Record<string, number>;
}

export interface Scenario {
  key: string;
  name: string;
  duration_s: number;
  n_targets: number;
  boss: boolean;
}

export interface PriorityEntry {
  skill_key: string;
  charge_level: number;
  require_status: string | null;
}

export interface Priority {
  entries: PriorityEntry[];
  label: string;
}

export interface CastEvent {
  t_s: number;
  skill_key: string;
  charge_level: number;
  damage: number;
  mp_after: number;
  active_statuses: string[];
}

export interface SkillTally {
  casts: number;
  damage: number;
}

export interface SimResult {
  total_damage: number;
  dps: number;
  duration_s: number;
  casts: CastEvent[];
  per_skill: Record<string, SkillTally>;
  status_uptime: Record<string, number>;
  warnings: string[];
  confidence: Confidence;
}

export interface StatGain {
  stat: keyof Stats | string;
  delta: number;
  dps_gain_pct: number;
  confidence: Confidence;
}

export type PlaystyleKey = "boss" | "aoe" | "leveling" | "burst";

export interface Playstyle {
  key: PlaystyleKey;
  name: string;
  description: string;
  scenario: Scenario;
}

export interface BuildVariant {
  key: string;
  label: string;
  gives: string;
  build: CharacterBuild;
  /** [skill_key, score] pairs, as the optimizer ranked them */
  stigma_picks: [string, number][];
  dps: number;
  /** vs the max-DPS build; negative = weaker */
  dps_delta_pct: number;
}

export interface FullBuild {
  playstyle: Playstyle;
  build: CharacterBuild;
  stigma_picks: [string, number][];
  /** [skill_key, new_rank, dps_gain] */
  rank_log: [string, number, number][];
  daevanion_path: number[];
  daevanion_gain_pct: number;
  priority: Priority;
  result: SimResult;
  stat_gains: StatGain[];
  warnings: string[];
  variants: BuildVariant[];
  /** engine/rotation.py explain_rotation of `result`: plain-English opener, core, chains, filler, skip. */
  rotation_explained: RotationExplained;
  /** equipped specialty options with the DPS each adds (leave-one-out), best first */
  spec_picks: SpecPick[];
}

export interface SpecPick {
  skill_key: string;
  option: number;
  text: string;
  dps_gain_pct: number;
  confidence: string;
}

export interface RotationSkill {
  skill_key: string;
  name: string;
  /** same as skill_key: the icon_urls() key */
  icon_key: string;
  charge_level: number;
}

export interface RotationOpenerStep extends RotationSkill {
  t_s: number;
}

export interface RotationPriorityEntry extends RotationSkill {
  require_status: string | null;
  casts: number;
  damage_share_pct: number;
}

export interface RotationCore extends RotationSkill {
  cooldown_s: number;
  casts: number;
  cast_every_s: number | null;
  damage_share_pct: number;
  rule: "on_cooldown" | "when_status" | "hold_for_buff";
  status: string | null;
  text: string;
}

export interface RotationChain {
  skills: string[];
  names: string[];
  icon_keys: string[];
  completed: number;
  text: string;
}

export interface RotationFiller {
  skills: (RotationSkill & { casts: number; damage_share_pct: number; role: "main" | "mana" | "backup" })[];
  text: string;
}

export interface RotationSkip extends RotationSkill {
  casts: number;
  reason: string;
}

export interface RotationExplained {
  scenario: string;
  scenario_name: string;
  duration_s: number;
  dps: number;
  /** the priority list with never-cast entries dropped */
  priority: RotationPriorityEntry[];
  opener: RotationOpenerStep[];
  core: RotationCore[];
  chains: RotationChain[];
  filler: RotationFiller;
  skip: RotationSkip[];
}

/** webapi.compare() result. */
export type CompareResult = Record<PlaystyleKey, FullBuild>;

// ---- keybinds ----
export interface SlotStack {
  key_label: string;
  /** <= 4 skill keys, index 0 fires first */
  stack: string[];
}

export interface MacroEntry {
  index: number;
  key_label: string;
  delay_ms: number;
}

export interface MacroPlan {
  name: string;
  hotkey: string;
  entries: MacroEntry[];
}

export interface GKeyAssignment {
  gkey: "G1" | "G2" | "G3" | "G4" | "G5";
  mstate: "M1" | "M2" | "M3";
  sends: string;
  purpose: string;
  risk: "lowest_known" | "caution";
}

export interface KeybindPlan {
  stacks: SlotStack[];
  macros: MacroPlan[];
  gkeys: GKeyAssignment[];
  macro_dps: Record<string, number>;
  ideal_dps: Record<string, number>;
  manual_every_s: Record<string, number>;
  warnings: string[];
  /** macro name -> DPS of the macro plus hand-pressed manual skills */
  hybrid_dps: Record<string, number>;
  /** slot label -> why that stack is ordered the way it is */
  slot_notes: Record<string, string>;
  /** macro name -> plain-English verdict (hybrid advice when the macro is under 85% of ideal) */
  macro_advice: Record<string, string>;
  /** scenario key -> explain_rotation output */
  rotation: Record<string, RotationExplained>;
  /** G900 side buttons: [button, sends, description] */
  thumbs: [string, string, string][];
}

export interface SkillBar {
  /** key label ("1".."0","-","=","A".."Z") -> skill key | null */
  slots: Record<string, string | null>;
}

export interface KeybindsResult {
  plan: KeybindPlan;
  instructions_markdown: string;
}

// ---- webapi outputs ----
export interface ClassInfo {
  key: string;
  name: string;
  role: ClassRole;
}

export interface ArmoryProfile {
  name: string;
  server: string;
  level: number | null;
  combat_power: number | null;
  class_name: string;
  class_key: string;
  item_level: number | null;
  /** NCSoft-hosted profile image URL (hotlinked, never copied). */
  profile_image: string | null;
  race: string | null;
}

export interface GearItem {
  slot: string;
  name: string;
  enchant: number;
  exceed: number;
  grade: string;
}

export interface ImportedStigma {
  key: string | null;
  name: string;
  rank: number;
}

export interface DaevanionBoardSummary {
  board: string;
  open: number;
  matched: number;
}

export interface ImportResult {
  build: CharacterBuild;
  notes: string[];
  profile: ArmoryProfile;
  gear: GearItem[];
  stigmas: ImportedStigma[];
  daevanion_summary: { boards: DaevanionBoardSummary[]; open: number; matched: number };
}

export interface DaevanionSuggestion {
  /** node ids, best first, cut at the point budget */
  path: number[];
  spent: number;
  gain_pct: number;
  nodes: { id: number; board: string; name: string; cost: number }[];
}

/** {skill_key: official CDN url | null} */
export type IconUrls = Record<string, string | null>;

// ---- armory (raw JSON fetched by the browser through the proxy; passed untouched to webapi.import_character) ----
export interface ArmorySearchHit {
  /** URL-decoded; re-encode when used in a URL */
  characterId: string;
  /** <strong> tags already stripped */
  name: string;
  level: number | null;
  serverId: number | null;
  serverName: string;
  pcId: number | null;
  race: number | null;
  region: string;
}

/** Shape webapi.import_character expects. Inner payloads are NCSoft's JSON, kept opaque. */
export interface ArmoryRaw {
  info: Record<string, unknown>;
  equipment: Record<string, unknown>;
  /** board id (string) -> daevanion/detail payload; only boards with open nodes */
  daevanion: Record<string, Record<string, unknown>>;
}

export type ProgressFn = (message: string) => void;

// ---- gear (aion2c.webapi.gear_upgrades / max_potential) ----

/** A resolved item from engine/items.json. `icon` is a CDN url (hotlinked) or null. */
export interface GearPiece {
  slot: string;
  id: number;
  name: string;
  grade: string;
  il: number;
  enchant: number;
  max_enchant: number;
  icon: string | null;
  source: string | null;
  reachable: boolean;
}

export interface GearUpgrade {
  slot: string;
  /** null when the slot is empty */
  from: GearPiece | null;
  to: GearPiece;
  kind: "item" | "enchant";
  dps_gain_pct: number;
  dps_after: number;
  source: string;
  reachable: boolean;
  icon: string | null;
}

export interface GearUpgradesResult {
  equipped: GearPiece[];
  upgrades: GearUpgrade[];
  notes: string[];
  assumptions: string[];
}

export interface MaxPotentialResult {
  class_key: string;
  playstyle: PlaystyleKey;
  gear: (GearPiece & { gain_pct: number })[];
  build: {
    stigmas: { key: string; name: string }[];
    specialties: { skill: string; text: string; dps_gain_pct: number }[];
    daevanion_nodes: number;
    ranks: { key: string; name: string; rank: number }[];
  };
  dps: number;
  dps_without_gear: number;
  gear_gain_pct: number;
  /** null when no build was passed */
  current_dps: number | null;
  gain_vs_current_pct: number | null;
  /** best for the character's CURRENT gear and already-opened Daevanion nodes; null when no build was passed */
  with_current_gear: { dps: number; stigmas: { key: string; name: string }[]; daevanion_nodes: number } | null;
  notes: string[];
  assumptions: string[];
}
