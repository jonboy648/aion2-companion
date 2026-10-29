import type { CharacterBuild, GameData, QuickUseAction } from "@/lib/types";
import { hashBuild, type PlannedBuild } from "./activeBuild";
import { acquiredSkill, actionLocked, nativePlacementIssues, normalizeNativeConfig, selectedRecipe,
  type NativeConfig } from "./nativeConfig";

export interface NativeSuggestion {
  config: NativeConfig | null;
  objective: "damage" | "stagger";
  changedColumns: number[];
  placements: { id: number; key: string; reason: string }[];
  manual: { key: string; reason: string }[];
  unplaced: { key: string; reason: string }[];
  errors: string[];
}

/** A configuration proposal only. Priority selects membership, never native execution order. */
export function suggestNativeSetup(config: NativeConfig, actions: readonly QuickUseAction[], gd: GameData,
  build: CharacterBuild, planned: PlannedBuild): NativeSuggestion {
  const result: NativeSuggestion = { config: null, objective: planned.objective ?? "damage",
    changedColumns: [], placements: [], manual: [], unplaced: [], errors: [] };
  const ids = actions.map(action => action.id);
  if (ids.length !== 12 || new Set(ids).size !== 12 || ids.some(id => !Number.isInteger(id) || id < 1 || id > 12)) {
    result.errors.push("Twelve stable client Quick Use action IDs are required.");
  }
  if (gd.class_key !== build.class_key || planned.buildHash !== hashBuild(build)) {
    result.errors.push("The chosen plan does not match this character build.");
  }
  if (result.objective !== "damage" && result.objective !== "stagger") result.errors.push("Unsupported plan goal.");
  if (config.recipes.length >= 20) result.errors.push("Website storage is full; export and remove a saved configuration before adding one. This is not a native capacity limit.");
  try { normalizeNativeConfig(config); } catch { result.errors.push("The current configuration needs repair before suggesting changes."); }
  if (result.errors.length) return result;

  const next = structuredClone(config);
  const sorted = [...actions].sort((a, b) => a.id - b.id);
  const editable = sorted.filter(action => action.context_editable && !actionLocked(action, build, gd));
  for (const action of editable) next.columns[String(action.id)] = [null, null, null, null];
  // A fixed or locked context cannot be repaired by this action.
  result.errors.push(...nativePlacementIssues({ ...next, recipes: [] }, actions, gd, build));
  const childKeys = new Set(gd.links.filter(link => ["chain", "proc", "charge"].includes(link.kind)).map(link => link.child_key));
  const root = (key: string) => acquiredSkill(key, gd, build) && !childKeys.has(key);
  const retained = new Map<string, number>();
  for (const action of sorted) for (const key of next.columns[String(action.id)]) if (key) {
    if (!root(key) || retained.has(key)) result.errors.push(`Quick Use ${action.id} has an unavailable or repeated fixed root skill; review it manually.`);
    retained.set(key, action.id);
  }
  if (result.errors.length) return result;

  const seen = new Set<string>();
  const used = new Set<number>(retained.values());
  const recipeEntries: { id: string; quickUseId: number; delayMs: number }[] = [];
  const priorEntries = [...selectedRecipe(config).entries, ...config.recipes.flatMap(recipe => recipe.entries)];
  for (const entry of planned.priority.entries) {
    const key = entry.skill_key;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!root(key)) {
      result.unplaced.push({ key, reason: "Not an acquired root skill for this build (level, region, stigma, chain or proc gate)." });
      continue;
    }
    const rule = gd.rules[key];
    if (entry.charge_level > 0 || gd.skills[key].tags.some(tag => tag === "charge" || tag === "charge skill" || tag === "manual") || rule?.charge_levels.length) {
      result.manual.push({ key, reason: "Keep manual: native charge hold/release and macro handling are unverified." });
      continue;
    }
    const available = editable.filter(action => !used.has(action.id));
    const id = retained.get(key) ?? (available.find(action => config.columns[String(action.id)][0] === key) ?? available[0])?.id;
    if (id === undefined) {
      result.unplaced.push({ key, reason: "No editable, unlocked column remains; keep manual or revise placement." });
      continue;
    }
    if (!retained.has(key)) next.columns[String(id)] = [key, null, null, null];
    used.add(id);
    const requirements = [...new Set([...(rule?.requires ?? []), ...(entry.require_status ? [entry.require_status] : [])])];
    result.placements.push({ id, key, reason: requirements.length
      ? `Own column; conditional on ${requirements.join(", ")}. Readiness is not guaranteed.`
      : "Own column; selected by the chosen priority. Cooldown and readiness still apply." });
    recipeEntries.push({ id: `suggested-entry-${id}`, quickUseId: id,
      delayMs: priorEntries.find(previous => previous.quickUseId === id)?.delayMs ?? 10 });
  }
  if (!recipeEntries.length) {
    result.errors.push("No acquired root skills can be included in a suggested macro configuration.");
    return result;
  }
  let number = 1;
  while (config.recipes.some(recipe => recipe.id === `suggestion-${number}`)) number++;
  const id = `suggestion-${number}`;
  next.recipes.push({ id, name: `Suggested ${planned.playstyle} ${result.objective}`, entries: recipeEntries });
  next.selectedRecipe = id;
  result.changedColumns = sorted.filter(action => next.columns[String(action.id)].some((key, row) => key !== config.columns[String(action.id)][row])).map(action => action.id);
  // Existing recipes are deliberately retained, including their authored delays and names.
  // Their linked columns may change; the preview and complete pre-apply copy make that explicit.
  result.config = next;
  return result;
}
