import { describe, expect, it } from "vitest";
import gdFixture from "@/fixtures/gamedata_sorcerer.json";
import compareFixture from "@/fixtures/compare.json";
import type { CharacterBuild, GameData, Priority, QuickUseAction } from "@/lib/types";
import { hashBuild, type PlannedBuild } from "./activeBuild";
import { initialNativeConfig, normalizeNativeConfig } from "./nativeConfig";
import { suggestNativeSetup } from "./nativeSuggestion";

const source = gdFixture as unknown as GameData;
const skill = (key: string, kind = "active", tags: string[] = []) => ({
  ...source.skills.frost, key, name: key, kind, tags, unlock_level: 1,
}) as GameData["skills"][string];
const gd: GameData = { ...source, skills: {
  arrow: skill("arrow"), filler: skill("filler"), conditional: skill("conditional"),
  cooldown: skill("cooldown"), charge: skill("charge", "active", ["charge"]),
  chain: skill("chain", "chain"), proc: skill("proc", "proc"), unowned: skill("unowned"),
  stigma: skill("stigma", "stigma"),
}, rules: { conditional: { ...source.rules.frost, requires: ["frost"] } }, links: [] };
const build = { ...compareFixture.leveling.build, level: 45, stigma_unlocked: false,
  stigmas: ["stigma"], skill_ranks: { arrow: 1, filler: 1, conditional: 1, cooldown: 1,
    charge: 1, chain: 1, proc: 1, unowned: 0, stigma: 1 },
} as unknown as CharacterBuild;
const actions: QuickUseAction[] = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1, slot_id: index + 100, binding: `F${index + 1}`, alternate_bindings: [],
  default_skill: ["arrow", "filler", "conditional", "cooldown", "charge"][index] ?? null,
  context_skills: [], slot_editable: true, context_editable: index !== 0,
}));
const priority = (...keys: string[]): Priority => ({ label: "Chosen test priority", entries:
  keys.map(skill_key => ({ skill_key, charge_level: 0, require_status: null })) });
const chosen = (p = priority("conditional", "cooldown", "filler", "charge", "chain", "proc", "unowned", "stigma", "filler")): PlannedBuild => ({
  buildHash: hashBuild(build), playstyle: "leveling", scenario: "level_pull", priority: p, objective: "stagger",
});

describe("native configuration suggestions", () => {
  it("uses the chosen goal and root priority without mutating saved rows, bindings or authored recipes", () => {
    const saved = initialNativeConfig(actions, gd, build);
    saved.activationBinding = "F8";
    saved.bindings["3"] = "Mouse 4";
    saved.alternateBindings["3"] = ["Q"];
    saved.columns["2"][1] = "conditional";
    saved.recipes = [{ id: "raid", name: "My Raid", entries: [
      { id: "a", quickUseId: 3, delayMs: 777 }, { id: "b", quickUseId: 2, delayMs: 25 },
    ] }, { id: "spare", name: "Spare", entries: [] }];
    saved.selectedRecipe = "raid";
    const original = structuredClone(saved);
    const result = suggestNativeSetup(saved, actions, gd, build, chosen());
    expect(saved).toEqual(original);
    expect(result.errors).toEqual([]);
    expect(result.objective).toBe("stagger");
    expect(result.config!.columns["1"]).toEqual(["arrow", null, null, null]);
    expect(result.config!.columns["2"]).toEqual(["filler", null, null, null]);
    expect(result.config!.columns["3"]).toEqual(["conditional", null, null, null]);
    expect(result.config!.columns["4"]).toEqual(["cooldown", null, null, null]);
    expect(Object.values(result.config!.columns).flat().filter(Boolean).sort()).toEqual(["arrow", "conditional", "cooldown", "filler"]);
    expect(result.config!.bindings).toEqual(saved.bindings);
    expect(result.config!.alternateBindings).toEqual(saved.alternateBindings);
    expect(result.config!.activationBinding).toBe("F8");
    expect(result.config!.recipes.slice(0, 2)).toEqual(saved.recipes);
    const recipe = result.config!.recipes.at(-1)!;
    expect(recipe.entries.map(entry => [entry.quickUseId, entry.delayMs])).toEqual([[3, 777], [4, 10], [2, 25]]);
    expect(result.manual.map(item => item.key)).toEqual(["charge"]);
    expect(result.unplaced.map(item => item.key)).toEqual(["chain", "proc", "unowned", "stigma"]);
    expect(normalizeNativeConfig(result.config).config).toEqual(result.config);
  });

  it("chooses scarce columns from the selected priority and reports the remainder", () => {
    const limited = actions.map(action => ({ ...action, context_editable: action.id === 2 || action.id === 3,
      default_skill: action.id === 1 ? "arrow" : null }));
    const saved = initialNativeConfig(limited, gd, build);
    const first = suggestNativeSetup(saved, limited, gd, build, chosen(priority("conditional", "cooldown", "filler")));
    const second = suggestNativeSetup(saved, limited, gd, build, chosen(priority("filler", "cooldown", "conditional")));
    expect(first.config!.columns["2"][0]).toBe("conditional");
    expect(second.config!.columns["2"][0]).toBe("filler");
    expect(first.unplaced).toEqual([{ key: "filler", reason: expect.stringMatching(/column/i) }]);
    for (const id of [1, 4, 5, 6, 7, 8, 9, 10, 11, 12]) expect(first.config!.columns[String(id)]).toEqual(saved.columns[String(id)]);
  });

  it("keeps a fixed root in place and includes its stable action ID only once", () => {
    const result = suggestNativeSetup(initialNativeConfig(actions, gd, build), [...actions].reverse(), gd, build,
      chosen(priority("arrow", "conditional", "arrow")));
    expect(result.config!.recipes.at(-1)!.entries.map(entry => entry.quickUseId)).toEqual([1, 3]);
    expect(result.changedColumns).not.toContain(1);
  });

  it("declines unsupported identities, stale handoffs, class mismatches and website storage overflow", () => {
    const saved = initialNativeConfig(actions, gd, build);
    expect(suggestNativeSetup(saved, actions.slice(1), gd, build, chosen()).config).toBeNull();
    expect(suggestNativeSetup(saved, actions, gd, build, { ...chosen(), buildHash: "stale" }).config).toBeNull();
    expect(suggestNativeSetup(saved, actions, { ...gd, class_key: "chanter" }, build, chosen()).config).toBeNull();
    saved.recipes = Array.from({ length: 20 }, (_, i) => ({ id: `saved-${i}`, name: `Saved ${i}`, entries: [] }));
    saved.selectedRecipe = "saved-0";
    const result = suggestNativeSetup(saved, actions, gd, build, chosen());
    expect(result.config).toBeNull();
    expect(result.errors.join(" ")).toMatch(/website storage/i);
    expect(saved.recipes).toHaveLength(20);
  });

  it("does not repair a corrupt fixed context or populate locked actions", () => {
    const saved = initialNativeConfig(actions, gd, build);
    saved.columns["1"] = ["proc", null, null, null];
    expect(suggestNativeSetup(saved, actions, gd, build, chosen()).config).toBeNull();
    expect(saved.columns["1"][0]).toBe("proc");
  });
});
