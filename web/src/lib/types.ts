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
}

export interface StatusTrigger {
  status_key: string;
  on_element: Element;
  chance: number;
  source_skill: string;
  confidence: Confidence;
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
