import type { CharacterBuild, GameData, QuickUseAction } from "@/lib/types";
import { guideRanks } from "@/features/progression/guideRanks";
import { nativeActivationWarning, nativeBindingIssues, nativeColumnNotes, nativePlacementIssues, selectedRecipe, type NativeConfig } from "./nativeConfig";

const cell = (text: string) => text.replace(/[\r\n|]/g, " ");

export function nativeSetup(config: NativeConfig, actions: readonly QuickUseAction[], gd: GameData, build: CharacterBuild): string {
  const recipe = selectedRecipe(config);
  const ranks = guideRanks(gd, build);
  const name = (key: string | null) => key ? `${gd.skills[key]?.name ?? key}` : "Empty";
  const issues = [...nativeBindingIssues(config), ...nativePlacementIssues(config, actions, gd, build)];
  const activationWarning = nativeActivationWarning(config);
  if (activationWarning) issues.push(activationWarning);
  issues.push(...new Set(recipe.entries.flatMap(entry => nativeColumnNotes(config, entry.quickUseId, gd))));
  const lines = [
    `# Native setup: ${cell(build.name || build.class_key)}`, "",
    "Client defaults plus local edits; this is not an imported player hotbar.",
    `Macro activation: ${cell(config.activationBinding.trim() || "Unassigned")}`,
    `Control mode: ${config.controlMode === "unknown" ? "Not specified" : config.controlMode === "aion1" ? "AION 1" : "AION 2"}`, "",
    `## ${cell(recipe.name)}`, "",
    "| Entry | Column | Binding | Bottom-row skill | Delay (ms) |", "| --- | --- | --- | --- | --- |",
    ...recipe.entries.map((entry, index) => `| ${index + 1} | Quick Use ${entry.quickUseId} | ${cell(config.bindings[String(entry.quickUseId)] || "Unassigned")} | ${cell(name(config.columns[String(entry.quickUseId)]?.[0] ?? null))} | ${entry.delayMs} |`), "",
    ...(recipe.entries.length ? [] : ["No macro entries.", ""]),
    "Entry numbering is not runtime execution order.",
    "Readiness, retry behavior and native set/entry capacity need an in-game check. Delays are user inputs, not optimized timing.", "",
    "## Skill placement", "",
    "| Column | Primary | Alternates | Row 0 | Row 1 | Row 2 | Row 3 |", "| --- | --- | --- | --- | --- | --- | --- |",
    ...actions.map(action => {
      const id = String(action.id);
      return `| Quick Use ${id} | ${cell(config.bindings[id] || "Unassigned")} | ${cell((config.alternateBindings[id] ?? []).join(", ") || "None")} | ${[0, 1, 2, 3].map(row => {
        const key = config.columns[id]?.[row] ?? null;
        return cell(key ? `${name(key)} (Lv. ${ranks[key] ?? "?"})` : "Empty");
      }).join(" | ")} |`;
    }), "",
    ...(issues.length ? ["## Needs attention", "", ...issues.map(issue => `- ${cell(issue)}`), ""] : []),
    "Nothing is sent to the game. This sheet records one selected configuration and its linked columns.",
  ];
  return lines.join("\n");
}
