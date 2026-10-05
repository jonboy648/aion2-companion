/**
 * The character the tools pages (Keybinds, Crafting, Road Map) work on.
 * Contract: whichever page imports/optimizes a character should store its CharacterBuild JSON under
 * ACTIVE_BUILD_KEY (localStorage). Until a shared store exists this is the hand-off point.
 * In mock mode with nothing stored, the DarthThot fixture build is used so the pages are explorable.
 */
import { useEffect, useState } from "react";
import { isMockEngine } from "@/engine/api";
import type { CharacterBuild, FullBuild, PlaystyleKey, Priority } from "@/lib/types";

export const ACTIVE_BUILD_KEY = "aion2c.activeBuild.v1";
const PLAN_KEY = "aion2c.activeKeybindPlan.v1";
export const MACRO_SCENARIOS = ["boss_180", "aoe_pack", "level_pull"] as const;
export type MacroScenario = typeof MACRO_SCENARIOS[number];
export interface PlannedBuild {
  buildHash: string;
  playstyle: PlaystyleKey;
  scenario: MacroScenario;
  priority: Priority;
}

export function readActiveBuild(): CharacterBuild | null {
  try {
    const raw = localStorage.getItem(ACTIVE_BUILD_KEY);
    if (!raw) return null;
    const b = JSON.parse(raw) as CharacterBuild;
    return b && typeof b.class_key === "string" && typeof b.level === "number" ? b : null;
  } catch {
    return null;
  }
}

export function storeActiveBuild(b: CharacterBuild): void {
  try {
    localStorage.setItem(ACTIVE_BUILD_KEY, JSON.stringify(b));
    localStorage.removeItem(PLAN_KEY);
  } catch {
    /* storage blocked: the page still works for this visit */
  }
}

/** Carry the chosen plan's priority; a later import must not inherit it. */
export function storePlannedBuild(plan: FullBuild): void {
  const scenario = plan.playstyle.scenario.key;
  if (!MACRO_SCENARIOS.includes(scenario as MacroScenario)) throw new Error("This scenario has no supported macro model yet.");
  const build = { ...plan.build, skill_points: 0, stigma_points: 0 };
  storeActiveBuild(build);
  saveJson(PLAN_KEY, { buildHash: hashBuild(build), playstyle: plan.playstyle.key, scenario, priority: plan.priority });
}

export function readPlannedBuild(build: CharacterBuild | null): PlannedBuild | null {
  if (!build) return null;
  const plan = loadJson<PlannedBuild | null>(PLAN_KEY, null);
  if (!plan || plan.buildHash !== hashBuild(build) || !MACRO_SCENARIOS.includes(plan.scenario)
    || !["boss", "aoe", "leveling"].includes(plan.playstyle)
    || !Array.isArray(plan.priority?.entries) || typeof plan.priority.label !== "string"
    || plan.priority.entries.some((entry) => !entry || typeof entry.skill_key !== "string" || !Number.isInteger(entry.charge_level)
      || !(entry.require_status === null || typeof entry.require_status === "string"))) return null;
  return plan;
}

export interface ActiveBuild {
  loading: boolean;
  build: CharacterBuild | null;
  /** "stored" = from an import/optimize on another page; "demo" = mock fixture; null = none. */
  source: "stored" | "demo" | null;
}

export function useActiveBuild(): ActiveBuild {
  const [state, setState] = useState<ActiveBuild>(() => {
    const b = readActiveBuild();
    return b ? { loading: false, build: b, source: "stored" } : { loading: isMockEngine, build: null, source: null };
  });
  useEffect(() => {
    if (state.build || !isMockEngine) return;
    let live = true;
    import("@/fixtures/import_character.json").then((m) => {
      if (live) setState({ loading: false, build: structuredClone(m.default.build) as unknown as CharacterBuild, source: "demo" });
    });
    return () => {
      live = false;
    };
  }, [state.build]);
  return state;
}

/** Stable short hash of a build, for cache keys. */
export function hashBuild(b: unknown): string {
  const s = JSON.stringify(b);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** localStorage JSON helpers that never throw. */
export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
