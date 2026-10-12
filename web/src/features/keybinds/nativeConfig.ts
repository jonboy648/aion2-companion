import type { CharacterBuild, GameData, QuickUseAction } from "@/lib/types";
import { levelBudget } from "@/features/progression/progression";

export type NativeRows = [string | null, string | null, string | null, string | null];
export interface NativeEntry { id: string; quickUseId: number; delayMs: number }
export interface NativeRecipe { id: string; name: string; entries: NativeEntry[] }
export interface NativeConfig {
  schema: 1;
  activationBinding: string;
  controlMode: "unknown" | "aion1" | "aion2";
  columns: Record<string, NativeRows>;
  bindings: Record<string, string>;
  alternateBindings: Record<string, string[]>;
  recipes: NativeRecipe[];
  selectedRecipe: string;
}

export const NATIVE_DELAY_MIN = 10;
export const NATIVE_DELAY_MAX = 9900;

export function normalizeNativeDelay(value: unknown): number {
  return Math.max(NATIVE_DELAY_MIN, Math.min(NATIVE_DELAY_MAX,
    typeof value === "number" && Number.isFinite(value) ? Math.round(value) : NATIVE_DELAY_MIN));
}

export function acquiredSkill(key: string, gd: GameData, build: CharacterBuild): boolean {
  const skill = gd.skills[key];
  return gd.class_key === build.class_key && !!skill && ["active", "stigma", "dodge"].includes(skill.kind)
    && skill.regions.includes(build.region) && (skill.unlock_level ?? 0) <= build.level
    && Number.isInteger(build.skill_ranks[key]) && build.skill_ranks[key] > 0
    && (skill.kind !== "stigma" || (build.stigma_unlocked !== false && build.stigmas.includes(key)));
}

export function actionLocked(action: QuickUseAction, build: CharacterBuild, gd: GameData): boolean {
  if (action.id < 9) return false;
  if (build.stigma_unlocked === false) return true;
  const budget = levelBudget(build.level, build.region);
  // Match progression.py: non-Global regions use roadmap gates, not Global Exp data.
  const slots = budget?.stigmaSlots ?? gd.roadmap.filter(item => item.kind === "stigma"
    && item.regions.includes(build.region) && item.level <= build.level && /stigma slot \d/i.test(item.text)).length;
  return action.id - 8 > Math.min(slots, gd.stigma_slots[build.region] ?? 4);
}

export function initialNativeConfig(actions: readonly QuickUseAction[], gd: GameData, build: CharacterBuild): NativeConfig {
  const stigmas = [...new Set(build.stigmas)].filter(key => acquiredSkill(key, gd, build)).sort();
  return {
    schema: 1, activationBinding: "", controlMode: "unknown",
    columns: Object.fromEntries(actions.map(action => {
      const key = action.id >= 9 ? stigmas[action.id - 9] : action.default_skill;
      return [String(action.id), [!actionLocked(action, build, gd) && key && acquiredSkill(key, gd, build) ? key : null, null, null, null] as NativeRows];
    })),
    bindings: Object.fromEntries(actions.map(action => [String(action.id), action.binding])),
    alternateBindings: Object.fromEntries(actions.map(action => [String(action.id), [...action.alternate_bindings]])),
    recipes: [{ id: "macro-1", name: "Macro 1", entries: [] }], selectedRecipe: "macro-1",
  };
}

export function selectedRecipe(config: NativeConfig): NativeRecipe {
  return config.recipes.find(recipe => recipe.id === config.selectedRecipe) ?? config.recipes[0];
}

export function resolveNativeColumn(config: NativeConfig, id: number, eligible: (key: string, row: number) => boolean): { key: string; row: number } | null {
  const rows = config.columns[String(id)];
  for (let row = 0; rows && row < 4; row++) {
    const key = rows[row];
    if (key && eligible(key, row)) return { key, row };
  }
  return null;
}

export function nativeBindingIssues(config: NativeConfig): string[] {
  const uses = new Map<string, Set<string>>();
  const add = (binding: string, owner: string) => {
    const normalized = binding.trim().replace(/\s+/g, " ").toUpperCase();
    const mouseAliases: Record<string, string> = { M1: "LEFT MOUSE", MB1: "LEFT MOUSE", LMB: "LEFT MOUSE",
      M2: "RIGHT MOUSE", MB2: "RIGHT MOUSE", RMB: "RIGHT MOUSE", M3: "MIDDLE MOUSE", MB3: "MIDDLE MOUSE", MMB: "MIDDLE MOUSE" };
    const key = mouseAliases[normalized] ?? normalized;
    if (!key) return;
    if (!uses.has(key)) uses.set(key, new Set());
    uses.get(key)!.add(owner);
  };
  add(config.activationBinding, "Macro activation");
  for (const id of Object.keys(config.columns)) {
    add(config.bindings[id], `Quick Use ${id}`);
    for (const binding of config.alternateBindings[id]) add(binding, `Quick Use ${id}`);
  }
  return [...uses].filter(([, owners]) => owners.size > 1)
    .map(([key, owners]) => `${key} is assigned to ${[...owners].join(" and ")}.`);
}

export function nativeActivationWarning(config: NativeConfig): string | null {
  return config.controlMode === "aion1" && /mouse|\b[LRM]MB\b|\bM(?:B)?[1-5]\b/i.test(config.activationBinding)
    ? "Mouse-related Macro activation bindings do not function in AION 1 Control Mode." : null;
}

export function nativeColumnNotes(config: NativeConfig, id: number, gd: GameData): string[] {
  return [...new Set((config.columns[String(id)] ?? []).filter((key): key is string => !!key && !!gd.skills[key]?.tags.some(tag => tag === "charge skill" || tag === "charge")))]
    .map(key => `${gd.skills[key].name}: native macro charge handling is unverified.`);
}

export function nativePlacementIssues(config: NativeConfig, actions: readonly QuickUseAction[], gd: GameData, build: CharacterBuild): string[] {
  const issues: string[] = [];
  for (const [id, rows] of Object.entries(config.columns)) {
    const action = actions.find(action => String(action.id) === id);
    if (!action) { issues.push(`Quick Use ${id} is missing from the current client mappings.`); continue; }
    if (actionLocked(action, build, gd) && rows.some(Boolean)) issues.push(`Quick Use ${id} is locked at this level or quest state.`);
    if (!action.context_editable && ((rows[0] && rows[0] !== action.default_skill) || rows.slice(1).some(Boolean))) issues.push(`Quick Use ${id} has a fixed client context.`);
    if (!rows[0] && rows.slice(1).some(Boolean)) issues.push(`Quick Use ${id} requires a row 0 assignment.`);
    rows.forEach((key, row) => {
      if (key && !acquiredSkill(key, gd, build)) issues.push(`${gd.skills[key]?.name ?? key} in Quick Use ${id} / row ${row} is unavailable for this build.`);
    });
  }
  for (const recipe of config.recipes) for (const entry of recipe.entries) {
    const action = actions.find(action => action.id === entry.quickUseId);
    const key = config.columns[String(entry.quickUseId)]?.[0];
    if (!action || actionLocked(action, build, gd) || !key || !acquiredSkill(key, gd, build)) issues.push(`${recipe.name} has an unavailable entry for Quick Use ${entry.quickUseId}.`);
  }
  return [...new Set(issues)];
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const validActionId = (value: string) => /^(?:[1-9]|1[0-2])$/.test(value);
const text = (value: unknown, limit: number, empty = false): string => {
  if (typeof value !== "string" || value.length > limit || (!empty && !value.trim())) throw new Error("Invalid saved text.");
  return value.trim();
};

/** Defensive website storage bounds, not claims about native set/entry capacity. */
export function normalizeNativeConfig(value: unknown): { config: NativeConfig; issues: string[] } {
  if (!record(value) || value.schema !== 1 || !record(value.columns) || !record(value.bindings) || !record(value.alternateBindings)
    || !["unknown", "aion1", "aion2"].includes(String(value.controlMode))
    || !Array.isArray(value.recipes) || value.recipes.length < 1 || value.recipes.length > 20) throw new Error("Unsupported saved setup.");
  const ids = Object.keys(value.columns);
  if (ids.length !== 12 || ids.some(id => !validActionId(id))) throw new Error("Invalid saved action identity.");
  const columns: Record<string, NativeRows> = {};
  const bindings: Record<string, string> = {};
  const alternateBindings: Record<string, string[]> = {};
  for (const id of ids) {
    const rows = value.columns[id];
    const alternates = value.alternateBindings[id];
    if (!Array.isArray(rows) || rows.length !== 4 || !Array.isArray(alternates) || alternates.length > 4) throw new Error("Invalid saved column.");
    columns[id] = rows.map(key => key === null ? null : text(key, 100)) as NativeRows;
    bindings[id] = text(value.bindings[id], 24, true);
    alternateBindings[id] = alternates.map(binding => text(binding, 24)).filter(Boolean);
  }
  if (Object.keys(value.bindings).some(id => !ids.includes(id)) || Object.keys(value.alternateBindings).some(id => !ids.includes(id))) throw new Error("Unknown saved binding identity.");
  const issues: string[] = [];
  const recipeIds = new Set<string>();
  const recipes: NativeRecipe[] = value.recipes.map(input => {
    if (!record(input) || !Array.isArray(input.entries) || input.entries.length > 100) throw new Error("Invalid saved configuration.");
    const id = text(input.id, 80);
    if (recipeIds.has(id)) throw new Error("Duplicate saved configuration identity.");
    recipeIds.add(id);
    const entryIds = new Set<string>();
    const entries: NativeEntry[] = input.entries.map(item => {
      if (!record(item) || typeof item.quickUseId !== "number" || !Number.isInteger(item.quickUseId) || !ids.includes(String(item.quickUseId))
        || typeof item.delayMs !== "number" || !Number.isFinite(item.delayMs)) throw new Error("Invalid saved entry.");
      const entryId = text(item.id, 80);
      if (entryIds.has(entryId)) throw new Error("Duplicate saved entry identity.");
      entryIds.add(entryId);
      const delayMs = normalizeNativeDelay(item.delayMs);
      if (delayMs !== item.delayMs) issues.push("A saved delay was adjusted to the 10-9900 ms range.");
      return { id: entryId, quickUseId: item.quickUseId, delayMs };
    });
    return { id, name: text(input.name, 60), entries };
  });
  const selectedRecipe = text(value.selectedRecipe, 80);
  if (!recipeIds.has(selectedRecipe)) throw new Error("Unknown saved configuration.");
  return { config: { schema: 1, activationBinding: text(value.activationBinding, 24, true),
    controlMode: value.controlMode as NativeConfig["controlMode"], columns, bindings, alternateBindings, recipes, selectedRecipe }, issues };
}
