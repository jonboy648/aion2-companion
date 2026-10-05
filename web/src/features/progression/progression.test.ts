import { describe, expect, it } from "vitest";
import { levelBudget, prepareLevelBuild, validateLevelPlan, validateLevelPriority } from "./progression";
import { buildFromForm, initialForm } from "@/features/build/manualBuild";
import gdFx from "@/fixtures/gamedata_sorcerer.json";
import type { GameData } from "@/lib/types";

const gd = gdFx as unknown as GameData;
const buildAt = (level: number) => {
  const form = { ...initialForm("sorcerer"), level: String(level) };
  const built = buildFromForm(form, 45);
  if ("errors" in built) throw new Error(built.errors.join(", "));
  return built.build;
};

describe("Global progression", () => {
  it("uses cumulative level totals, including explicit zero", () => {
    expect(levelBudget(1)).toMatchObject({ skill: 0, stigma: 0, stigmaSlots: 0, daevanion: 0 });
    expect(levelBudget(30)).toMatchObject({ skill: 111, stigma: 8, stigmaSlots: 2, daevanion: 76 });
    expect(levelBudget(45)).toMatchObject({ skill: 203, stigma: 29, stigmaSlots: 4, daevanion: 136 });
    expect(levelBudget(46)).toBeNull();
    expect(levelBudget(22.5)).toBeNull();
  });

  it("does not infer a Korea budget from Global data", () => {
    expect(levelBudget(45, "korea")).toBeNull();
  });

  it("makes a fresh plan without mutating an existing character", () => {
    const input = { ...buildAt(12), skill_ranks: { hellfire: 9 }, bonus_ranks: { hellfire: 4 }, daevanion_nodes: [6101], skill_points: null };
    const snapshot = structuredClone(input);
    const prepared = prepareLevelBuild(input, gd, { skill: 2, stigma: 0, daevanion: 3 }, false, true);
    expect(prepared.build.skill_points).toBe(26);
    expect(prepared.build.stigma_points).toBe(0);
    expect(prepared.daevanionPoints).toBe(7);
    expect(prepared.build.skill_ranks.hellfire).not.toBe(9);
    expect(prepared.build.bonus_ranks).toEqual({});
    expect(prepared.build.daevanion_nodes).toEqual([]);
    expect(input).toEqual(snapshot);
  });

  it("does not spend Daevanion currency before the unlock quest", () => {
    const prepared = prepareLevelBuild(buildAt(30), gd, { skill: 0, stigma: 0, daevanion: 0 }, false);
    expect(prepared.daevanionPoints).toBe(0);
    expect(prepared.build.stigma_unlocked).toBe(false);
  });

  it("rejects negative, fractional and nonfinite earned rewards", () => {
    for (const n of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => prepareLevelBuild(buildAt(30), gd, { skill: n, stigma: 0, daevanion: 0 }, false)).toThrow();
    }
  });

  it("charges the first stigma rank and enforces the unlock", () => {
    const build = { ...buildAt(22), stigmas: ["doom-shield"], skill_ranks: { "doom-shield": 1 } };
    expect(validateLevelPlan(build, { skill: 71, stigma: 0, daevanion: 44 }, false, gd).join(" ")).toMatch(/stigma|unlock/i);
  });

  it("rejects an acquisition above the level-specific paid cap", () => {
    const build = { ...buildAt(12), skill_ranks: { "flame-arrow": 10 } };
    expect(validateLevelPlan(build, { skill: 24, stigma: 0, daevanion: 4 }, false, gd).join(" ")).toMatch(/level|rank/i);
  });

  it("rejects assumed bonus ranks and duplicate equipped stigmas", () => {
    const build = { ...buildAt(30), bonus_ranks: { hellfire: 999 }, stigmas: ["steel-barrier", "steel-barrier"] };
    expect(validateLevelPlan(build, { skill: 111, stigma: 8, daevanion: 0 }, true, gd).join(" ")).toMatch(/unprovided/);
    expect(validateLevelPlan(build, { skill: 111, stigma: 8, daevanion: 0 }, true, gd).join(" ")).toMatch(/Duplicate/);
  });

  it("rejects a core skill masquerading as an equipped stigma", () => {
    const build = { ...buildAt(30), stigmas: ["flame-arrow"] };
    expect(validateLevelPlan(build, { skill: 111, stigma: 0, daevanion: 0 }, true, gd).join(" "))
      .toMatch(/not a stigma/);
  });

  it("requires all automatic stigma tiers, not just a chosen unlocked tier", () => {
    const cold = gd.skills["cold-storm"];
    const fullGd = { ...gd, skills: { ...gd.skills, "cold-storm": { ...cold,
      ranks: Array.from({ length: 20 }, (_, i) => ({ ...cold.ranks[0], rank: i + 1 })) } } };
    const build = { ...buildAt(45), stigmas: ["cold-storm"], skill_ranks: { "cold-storm": 10 }, specs: { "cold-storm": [1] } };
    const budget = { skill: 203, stigma: 100, daevanion: 0 };
    expect(validateLevelPlan(build, budget, true, fullGd).join(" ")).toMatch(/automatic stigma tiers/);
    expect(validateLevelPlan({ ...build, specs: {} }, budget, true, fullGd).join(" ")).toMatch(/automatic stigma tiers/);
    expect(validateLevelPlan({ ...build, specs: { "cold-storm": [0, 1] } }, budget, true, fullGd)).toEqual([]);
  });

  it("does not mix Battle Crystals into the ordinary Daevanion budget", () => {
    const board = { ...gd.daevanion.nezekan, key: "azphel" };
    const mixed = { ...gd, daevanion: { azphel: board } };
    const build = { ...buildAt(45), skill_ranks: {}, daevanion_nodes: [board.start_id] };
    expect(validateLevelPlan(build, { skill: 203, stigma: 29, daevanion: 136 }, true, mixed).join(" ")).toMatch(/Battle Crystal/);
  });

  it("requires a connected Daevanion path and respects the spendable budget", () => {
    const board = gd.daevanion.nezekan;
    const paid = Object.values(board.nodes).find((node) => node.cost > 0 && node.id !== board.start_id)!;
    const build = { ...buildAt(45), skill_ranks: {}, daevanion_nodes: [paid.id] };
    expect(validateLevelPlan(build, { skill: 203, stigma: 29, daevanion: 0 }, false, gd).join(" ")).toMatch(/Daevanion plan costs/);
  });

  it("checks rotation availability separately from legal rank spending", () => {
    const prepared = prepareLevelBuild(buildAt(1), gd, { skill: 0, stigma: 0, daevanion: 0 }, false);
    expect(validateLevelPlan(prepared.build, prepared.budget, false, gd)).toEqual([]);
    expect(validateLevelPriority(prepared.build, { label: "locked", entries: [{ skill_key: "hellfire", charge_level: 0, require_status: null }] }, gd).join(" ")).toMatch(/unavailable/);
    expect(validateLevelPriority(prepared.build, { label: "available", entries: [{ skill_key: "flame-arrow", charge_level: 0, require_status: null }] }, gd)).toEqual([]);
  });

  it("requires an explicit owner link for a child rotation skill", () => {
    const prepared = prepareLevelBuild(buildAt(1), gd, { skill: 0, stigma: 0, daevanion: 0 }, false);
    const priority = { label: "chain", entries: [{ skill_key: "burst", charge_level: 0, require_status: null }] };
    expect(validateLevelPriority(prepared.build, priority, gd)).toEqual([]);
    expect(validateLevelPriority(prepared.build, priority, { ...gd, links: [] }).join(" ")).toMatch(/ownership unresolved/);
  });

  it("preserves the engine's implicit first rank for an equipped, unlocked stigma", () => {
    const build = { ...buildAt(30), stigmas: ["cold-storm"], skill_ranks: {}, stigma_unlocked: true };
    expect(validateLevelPlan(build, { skill: 111, stigma: 8, daevanion: 0 }, true, gd)).toEqual([]);
    expect(validateLevelPriority(build, { label: "stigma", entries: [{ skill_key: "cold-storm", charge_level: 0, require_status: null }] }, gd)).toEqual([]);
  });
});
