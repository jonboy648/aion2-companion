import { describe, expect, it } from "vitest";
import classesFx from "@/fixtures/list_classes.json";
import compareFx from "@/fixtures/compare.json";
import daevanionFx from "@/fixtures/daevanion_suggest.json";
import gamedataFx from "@/fixtures/gamedata_sorcerer.json";
import importFx from "@/fixtures/import_character.json";
import keybindsFx from "@/fixtures/keybinds.json";
import marginalFx from "@/fixtures/marginal.json";
import roadmapFx from "@/fixtures/roadmap.json";
import shoppingFx from "@/fixtures/shopping.json";
import type * as T from "./types";

/** `Keys<X>` must list EVERY key of X (compile-time), and the runtime check compares it with the real CPython output. */
type Keys<X> = { [K in keyof X]-?: true };
const keysOf = <X,>(k: Keys<X>) => Object.keys(k).sort();
const same = (obj: object, k: string[]) => expect(Object.keys(obj).sort()).toEqual(k);

const K = {
  build: keysOf<T.CharacterBuild>({
    name: true, region: true, level: true, skill_ranks: true, stigmas: true, specs: true, stats: true,
    show_kr: true, daevanion_nodes: true, skill_points: true, stigma_points: true, class_key: true,
  }),
  stats: keysOf<T.Stats>({
    attack: true, attack_increase_pct: true, weapon_dmg_pct: true, dmg_boost_pct: true, pve_dmg_pct: true,
    boss_dmg_pct: true, crit_chance_pct: true, crit_dmg_pct: true, smite_pct: true, combat_speed_pct: true,
    cdr_pct: true, max_mp: true, mp_regen_per_s: true, target_defense: true, penetration: true,
  }),
  fullBuild: keysOf<T.FullBuild>({
    playstyle: true, build: true, stigma_picks: true, rank_log: true, daevanion_path: true,
    daevanion_gain_pct: true, priority: true, result: true, stat_gains: true, warnings: true, variants: true,
  }),
  playstyle: keysOf<T.Playstyle>({ key: true, name: true, description: true, scenario: true }),
  scenario: keysOf<T.Scenario>({ key: true, name: true, duration_s: true, n_targets: true, boss: true }),
  sim: keysOf<T.SimResult>({
    total_damage: true, dps: true, duration_s: true, casts: true, per_skill: true, status_uptime: true,
    warnings: true, confidence: true,
  }),
  cast: keysOf<T.CastEvent>({ t_s: true, skill_key: true, charge_level: true, damage: true, mp_after: true, active_statuses: true }),
  priority: keysOf<T.Priority>({ entries: true, label: true }),
  entry: keysOf<T.PriorityEntry>({ skill_key: true, charge_level: true, require_status: true }),
  gain: keysOf<T.StatGain>({ stat: true, delta: true, dps_gain_pct: true, confidence: true }),
  variant: keysOf<T.BuildVariant>({ key: true, label: true, gives: true, build: true, stigma_picks: true, dps: true, dps_delta_pct: true }),
  plan: keysOf<T.KeybindPlan>({
    stacks: true, macros: true, gkeys: true, macro_dps: true, ideal_dps: true, manual_every_s: true, warnings: true,
  }),
  stack: keysOf<T.SlotStack>({ key_label: true, stack: true }),
  macro: keysOf<T.MacroPlan>({ name: true, hotkey: true, entries: true }),
  macroEntry: keysOf<T.MacroEntry>({ index: true, key_label: true, delay_ms: true }),
  gkey: keysOf<T.GKeyAssignment>({ gkey: true, mstate: true, sends: true, purpose: true, risk: true }),
  roadmap: keysOf<T.RoadmapItem>({ level: true, kind: true, text: true, regions: true }),
  material: keysOf<T.RecipeMaterial>({ item: true, qty: true, source: true }),
  clazz: keysOf<T.ClassInfo>({ key: true, name: true, role: true }),
  imp: keysOf<T.ImportResult>({ build: true, notes: true, profile: true, gear: true, stigmas: true, daevanion_summary: true }),
  profile: keysOf<T.ArmoryProfile>({
    name: true, server: true, level: true, combat_power: true, class_name: true, class_key: true, item_level: true,
    profile_image: true, race: true,
  }),
  gear: keysOf<T.GearItem>({ slot: true, name: true, enchant: true, exceed: true, grade: true }),
  suggest: keysOf<T.DaevanionSuggestion>({ path: true, spent: true, gain_pct: true, nodes: true }),
  gamedata: keysOf<T.GameData>({
    schema_version: true, data_version: true, built_at: true, level_caps: true, rank_caps: true, stigma_slots: true,
    skills: true, statuses: true, rules: true, triggers: true, links: true, community: true, roadmap: true,
    daevanion: true, recipes: true, class_key: true,
  }),
  skill: keysOf<T.Skill>({
    key: true, skill_id: true, name: true, name_kr: true, kind: true, element: true, unlock_level: true,
    max_rank: true, regions: true, atk_ratio_pct: true, ranks: true, range_m: true, aoe_targets: true, hits: true,
    anim_lock_s: true, icon: true, description: true, tags: true, specializations: true,
  }),
  rank: keysOf<T.RankData>({ rank: true, flat_min: true, flat_max: true, cooldown_s: true, mp_cost: true }),
  num: keysOf<T.Num>({ value: true, confidence: true, source: true }),
  status: keysOf<T.Status>({
    key: true, name: true, on: true, duration_s: true, dmg_mult: true, elements: true, mp_min_pct: true,
    source_skill: true, tick_ratio_pct: true, tick_s: true,
  }),
  rule: keysOf<T.SkillRule>({
    skill_key: true, applies: true, apply_chance: true, requires: true, consumes: true, chain_next: true,
    chain_window_s: true, charge_levels: true, mp_restore: true, confidence: true, note: true,
  }),
  link: keysOf<T.Link>({ parent_key: true, child_key: true, kind: true, confidence: true }),
  community: keysOf<T.CommunityRotation>({ key: true, source: true, scenario_key: true, priority: true, note: true }),
  board: keysOf<T.DaevanionBoard>({ key: true, name: true, unlock_level: true, nodes: true, start_id: true }),
  node: keysOf<T.DaevanionNode>({
    id: true, name: true, rarity: true, cost: true, node_type: true, effects: true, skill_key: true, adjacent: true, x: true, y: true,
  }),
  recipe: keysOf<T.Recipe>({
    id: true, name: true, profession: true, level: true, output_item: true, output_qty: true, item_level: true,
    grade: true, materials: true, base_materials: true, sorc_relevant: true, source_url: true,
  }),
};

describe("types.ts matches real webapi output (fixtures)", () => {
  it("list_classes", () => {
    expect(classesFx.length).toBe(8);
    for (const c of classesFx) same(c, K.clazz);
  });

  it("import_character", () => {
    same(importFx, K.imp);
    same(importFx.build, K.build);
    same(importFx.build.stats, K.stats);
    same(importFx.profile, K.profile);
    same(importFx.gear[0], K.gear);
    expect(importFx.stigmas[0]).toHaveProperty("key");
    expect(importFx.daevanion_summary).toHaveProperty("boards");
  });

  it("compare", () => {
    expect(Object.keys(compareFx).sort()).toEqual(["aoe", "boss", "burst", "leveling"]);
    const fb = compareFx.boss;
    same(fb, K.fullBuild);
    same(fb.playstyle, K.playstyle);
    same(fb.playstyle.scenario, K.scenario);
    same(fb.result, K.sim);
    same(fb.result.casts[0], K.cast);
    same(fb.priority, K.priority);
    same(fb.priority.entries[0], K.entry);
    same(fb.stat_gains[0], K.gain);
    same(fb.variants[0], K.variant);
    same(fb.variants[0].build, K.build);
    expect(fb.stigma_picks[0]).toHaveLength(2);
  });

  it("marginal, daevanion_suggest, shopping, roadmap", () => {
    same(marginalFx[0], K.gain);
    same(daevanionFx, K.suggest);
    same(shoppingFx[0], K.material);
    same(roadmapFx[0], K.roadmap);
  });

  it("keybinds", () => {
    expect(Object.keys(keybindsFx).sort()).toEqual(["instructions_markdown", "plan"]);
    same(keybindsFx.plan, K.plan);
    same(keybindsFx.plan.stacks[0], K.stack);
    same(keybindsFx.plan.macros[0], K.macro);
    same(keybindsFx.plan.macros[0].entries[0], K.macroEntry);
    same(keybindsFx.plan.gkeys[0], K.gkey);
  });

  it("gamedata", () => {
    same(gamedataFx, K.gamedata);
    const sk = Object.values(gamedataFx.skills);
    for (const s of sk) same(s, K.skill);
    same(sk[0].ranks[0], K.rank);
    same(sk[0].atk_ratio_pct, K.num);
    same(Object.values(gamedataFx.statuses)[0], K.status);
    same(Object.values(gamedataFx.rules)[0], K.rule);
    same(gamedataFx.links[0], K.link);
    same(gamedataFx.community[0], K.community);
    same(gamedataFx.roadmap[0], K.roadmap);
    const board = Object.values(gamedataFx.daevanion)[0];
    same(board, K.board);
    same(Object.values(board.nodes)[0], K.node);
    same(gamedataFx.recipes[0], K.recipe);
  });
});
