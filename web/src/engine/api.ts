/**
 * The typed async API the UI uses. One function per `aion2c.webapi` function (snake_case -> camelCase),
 * plus `onProgress` where the engine reports progress.
 *
 * Wave 0: mock mode only (VITE_ENGINE=mock, the default). It returns the CPython-generated fixtures in
 * src/fixtures after a short delay, ignoring most inputs, so pages can be built without Pyodide.
 * VITE_ENGINE=real uses the Pyodide worker client (same interface, same JSON shapes).
 */
import { createPyodideClient } from "@/engine/pyodide-client";
import classesFx from "@/fixtures/list_classes.json";
import compareFx from "@/fixtures/compare.json";
import daevanionFx from "@/fixtures/daevanion_suggest.json";
import gamedataFx from "@/fixtures/gamedata_sorcerer.json";
import iconsFx from "@/fixtures/icon_urls_sorcerer.json";
import gearUpgradesFx from "@/fixtures/gear_upgrades.json";
import maxPotentialFx from "@/fixtures/max_potential.json";
import importFx from "@/fixtures/import_character.json";
import keybindsFx from "@/fixtures/keybinds.json";
import marginalFx from "@/fixtures/marginal.json";
import roadmapFx from "@/fixtures/roadmap.json";
import shoppingFx from "@/fixtures/shopping.json";
import statSheetFx from "@/fixtures/stat_sheet.json";
import type {
  ArmoryRaw,
  CharacterBuild,
  ClassInfo,
  CompareResult,
  DaevanionSuggestion,
  FullBuild,
  GameData,
  GearUpgradesResult,
  IconUrls,
  ImportResult,
  KeybindsResult,
  MaxPotentialResult,
  PlaystyleKey,
  Priority,
  ProgressFn,
  Region,
  RecipeMaterial,
  RoadmapItem,
  SkillBar,
  StatGain,
  StatSheet,
} from "@/lib/types";

export interface EngineApi {
  /** Start booting the engine now (idempotent, never throws), so it is ready when the first real call arrives. */
  warm(): void;
  listClasses(): Promise<ClassInfo[]>;
  gamedata(classKey: string): Promise<GameData>;
  /** raw = what lib/armory.ts fetchCharacter returns. Class comes from the armory profile. */
  importCharacter(raw: ArmoryRaw, baseBuild?: CharacterBuild | null): Promise<ImportResult>;
  /** All four playstyles. Slow in the real engine: pass onProgress. */
  compare(build: CharacterBuild, daevanionPoints?: number | null, onProgress?: ProgressFn): Promise<CompareResult>;
  optimize(build: CharacterBuild, playstyleKey: PlaystyleKey, daevanionPoints?: number | null, onProgress?: ProgressFn): Promise<FullBuild>;
  marginal(build: CharacterBuild, priority: Priority, scenarioKey: string): Promise<StatGain[]>;
  /** priorities: {scenario_key: Priority} (boss_180, aoe_pack, level_pull). hotkeys may include leveling. */
  keybinds(
    build: CharacterBuild,
    priorities: Record<string, Priority>,
    bar: SkillBar | Record<string, string | null>,
    hotkeys?: Record<string, string> | null,
    delayMs?: number,
  ): Promise<KeybindsResult>;
  daevanionSuggest(build: CharacterBuild, points?: number | null): Promise<DaevanionSuggestion>;
  shopping(classKey: string, recipeQty: Record<string, number>, expand?: boolean): Promise<RecipeMaterial[]>;
  roadmap(classKey: string, region: Region, build?: CharacterBuild | null): Promise<RoadmapItem[]>;
  /** {skill_key: official CDN url | null}. Hotlinked from NCSoft's CDN; never host the art. */
  iconUrls(classKey: string): Promise<IconUrls>;
  /** Ranked gear upgrades (items.json is fetched lazily on the first call). rawArmory = what fetchCharacter returned. */
  gearUpgrades(rawArmory: ArmoryRaw, build: CharacterBuild, playstyle: PlaystyleKey, steps?: number, reachableOnly?: boolean): Promise<GearUpgradesResult>;
  /** BIS gear + full build for the class; pass build (+rawArmory) to get the gap to you. Slow: full optimizer. */
  maxPotential(classKey: string, playstyle: PlaystyleKey, reachableOnly?: boolean, build?: CharacterBuild | null, rawArmory?: ArmoryRaw | null): Promise<MaxPotentialResult>;
  /** Full stat sheet with a per-source breakdown, rebuilt from the armory download (items.json is fetched lazily). */
  statSheet(rawArmory: ArmoryRaw, calibrate?: boolean): Promise<StatSheet>;
}

const wait = (ms = 150) => new Promise<void>((r) => setTimeout(r, ms));
const clone = <T,>(x: unknown): T => structuredClone(x) as T;

/** Fixtures only cover Sorcerer; every class key returns it (class_key rewritten) so class pickers work in mock mode. */
const mockEngine: EngineApi = {
  warm() {},
  async listClasses() {
    await wait();
    return clone<ClassInfo[]>(classesFx);
  },
  async gamedata(classKey) {
    await wait();
    const gd = clone<GameData>(gamedataFx);
    gd.class_key = classKey;
    return gd;
  },
  async importCharacter() {
    await wait(300);
    return clone<ImportResult>(importFx);
  },
  async compare(_build, _points, onProgress) {
    for (const m of ["Boss DPS...", "AoE farming...", "Leveling...", "Burst opener..."]) {
      onProgress?.(m);
      await wait(120);
    }
    return clone<CompareResult>(compareFx);
  },
  async optimize(_build, playstyleKey, _points, onProgress) {
    onProgress?.("Searching rotation");
    await wait(200);
    return clone<FullBuild>((compareFx as unknown as CompareResult)[playstyleKey]);
  },
  async marginal() {
    await wait();
    return clone<StatGain[]>(marginalFx);
  },
  async keybinds() {
    await wait();
    return clone<KeybindsResult>(keybindsFx);
  },
  async daevanionSuggest() {
    await wait();
    return clone<DaevanionSuggestion>(daevanionFx);
  },
  async shopping() {
    await wait();
    return clone<RecipeMaterial[]>(shoppingFx);
  },
  async roadmap() {
    await wait();
    return clone<RoadmapItem[]>(roadmapFx);
  },
  async iconUrls() {
    await wait();
    return clone<IconUrls>(iconsFx);
  },
  async gearUpgrades() {
    await wait(200);
    return clone<GearUpgradesResult>(gearUpgradesFx);
  },
  async maxPotential(_classKey, _playstyle, _reachable, build) {
    await wait(300);
    const r = clone<MaxPotentialResult>(maxPotentialFx);
    if (!build) {
      r.current_dps = null;
      r.gain_vs_current_pct = null;
    }
    return r;
  },
  async statSheet() {
    await wait(200);
    return clone<StatSheet>(statSheetFx);
  },
};

/** Real engine: Pyodide in a Web Worker (see pyodide-client.ts). The worker is only spawned on the first call. */
const pyodide = createPyodideClient();
const realEngine: EngineApi = {
  ...pyodide,
  // The class list (key, name, role) is tiny and fixed (make_fixtures.py regenerates it from the engine), so serve it
  // directly: asking the engine would download and boot the whole ~6 MB Python runtime just to show eight names on the
  // landing page, Codex, Keybinds and the manual build page.
  listClasses: async () => structuredClone(classesFx) as ClassInfo[],
};

export const isMockEngine = import.meta.env.VITE_ENGINE === "mock";
export const engine: EngineApi = isMockEngine ? mockEngine : realEngine;

export const {
  warm: warmEngine,
  listClasses,
  gamedata,
  importCharacter,
  compare,
  optimize,
  marginal,
  keybinds,
  daevanionSuggest,
  shopping,
  roadmap,
  iconUrls,
  gearUpgrades,
  maxPotential,
  statSheet,
} = engine;
