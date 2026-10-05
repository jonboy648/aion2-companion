// @vitest-environment node
import assert from "node:assert/strict";
import { beforeAll, describe, it } from "vitest";
import { checkCase, checkResponses, generateCases, loadHelpers, loadShippedData, classKeys, levels } from "./planner_acceptance.mjs";

let helpers;
let gdByClass;
let cases;
beforeAll(async () => {
  helpers = await loadHelpers();
  ({ gdByClass } = await loadShippedData());
  cases = generateCases(gdByClass, helpers);
});

function responseFor(request) {
  const gd = gdByClass[request.args.build.class_key];
  return {
    id: request.id, request: structuredClone(request),
    engineCurrencies: Object.fromEntries(Object.entries(gd.daevanion).map(([key, board]) => [key, board.currency])),
    result: {
      build: structuredClone(request.args.build), priority: { label: "empty", entries: [] },
      current_dps: 0, result: { dps: 0 }, playstyle: { key: "leveling" }, daevanion_path: [],
      variants: [{ key: "max", build: structuredClone(request.args.build), dps: 0 }],
    },
  };
}

describe("planner cross-runtime acceptance harness", () => {
  it("generates all eight classes at all three levels using actual frontend helpers", () => {
    assert.equal(cases.length, 33);
    for (const key of classKeys) for (const level of levels) {
      const request = cases.find(row => row.id === `${key}-${level}-unlocked`);
      assert.ok(request);
      assert.equal(request.args.playstyle_key, "leveling");
      assert.equal(request.args.build.stigma_unlocked, true);
      assert.equal(request.args.battle_points, 0);
    }
  });

  it("preserves explicit earned rewards and locked quest gates", () => {
    for (const level of levels) {
      const baseline = helpers.levelBudget(level);
      const earned = cases.find(row => row.id === `sorcerer-${level}-earned`);
      assert.deepEqual(earned.budget, { skill: baseline.skill + 5, stigma: baseline.stigma + 3, daevanion: baseline.daevanion + 4 });
      const locked = cases.find(row => row.id === `sorcerer-${level}-locked-earned`);
      assert.deepEqual(locked.budget, { skill: baseline.skill + 5, stigma: 0, daevanion: 0 });
      assert.equal(locked.args.build.stigma_unlocked, false);
      assert.equal(locked.args.daevanion_points, 0);
    }
  });

  it("accepts a legal envelope and checks every variant", () => {
    const request = cases.find(row => row.id === "sorcerer-22-unlocked");
    assert.deepEqual(checkCase(request, responseFor(request), gdByClass.sorcerer, helpers), { issues: [], plansChecked: 2 });
  });

  it("uses the actual plan validator for rank gates and spending in variants", () => {
    const request = cases.find(row => row.id === "sorcerer-22-unlocked");
    const response = responseFor(request);
    const ranks = response.result.variants[0].build.skill_ranks;
    for (const key of Object.keys(ranks)) ranks[key] = helpers.progression.classes.sorcerer.skills[key].ranks.at(-1).rank;
    const checked = checkCase(request, response, gdByClass.sorcerer, helpers);
    assert.ok(checked.issues.some(issue => /variant max.*needs level/.test(issue)));
    assert.ok(checked.issues.some(issue => /variant max.*plan costs/.test(issue)));
  });

  it("uses the actual priority validator for unavailable rotation skills", () => {
    const request = cases.find(row => row.id === "sorcerer-22-locked");
    const response = responseFor(request);
    response.result.priority.entries = [{ skill_key: "cold-storm", charge_level: 0, require_status: null }];
    assert.ok(checkCase(request, response, gdByClass.sorcerer, helpers).issues.some(issue => /main priority:.*unavailable/.test(issue)));
  });

  it("uses the actual specialty validator", () => {
    const request = cases.find(row => row.id === "sorcerer-22-unlocked");
    const response = responseFor(request);
    response.result.variants[0].build.specs["flame-arrow"] = [999];
    assert.ok(checkCase(request, response, gdByClass.sorcerer, helpers).issues.some(issue => /variant max.*invalid or locked specialty/.test(issue)));
  });

  it("rejects wrong consumed inputs and changed returned budgets", () => {
    const request = cases[0];
    const response = responseFor(request);
    response.request.args.build.skill_points++;
    response.result.build.skill_points++;
    const checked = checkCase(request, response, gdByClass.assassin, helpers);
    assert.ok(checked.issues.some(issue => /Python consumed request/.test(issue)));
    assert.ok(checked.issues.some(issue => /main: skill_points/.test(issue)));
  });

  it("rejects null or nonfinite current DPS and variant DPS", () => {
    const request = cases[0];
    const response = responseFor(request);
    response.result.current_dps = null;
    response.result.variants[0].dps = Infinity;
    const checked = checkCase(request, response, gdByClass.assassin, helpers);
    assert.ok(checked.issues.some(issue => /current_dps/.test(issue)));
    assert.ok(checked.issues.some(issue => /variant max: dps/.test(issue)));
  });

  it("compares board currencies with the derived map and rejects BattleCrystal nodes", () => {
    const request = cases.find(row => row.id === "sorcerer-45-unlocked");
    const response = responseFor(request);
    const [key, board] = Object.entries(gdByClass.sorcerer.daevanion).find(([, board]) => board.currency === "battle");
    response.engineCurrencies[key] = "daevanion";
    response.result.variants[0].build.daevanion_nodes = [board.start_id];
    response.result.daevanion_path = [board.start_id];
    const checked = checkCase(request, response, gdByClass.sorcerer, helpers);
    assert.ok(checked.issues.some(issue => /CPython\/derived board currency/.test(issue)));
    assert.ok(checked.issues.some(issue => /variant max: nodes: BattleCrystal/.test(issue)));
    assert.ok(checked.issues.some(issue => /Daevanion path: BattleCrystal/.test(issue)));
  });

  it("accepts full guidance with locked gates and no purchased nodes, regardless of guidance level or cost", () => {
    const request = cases.find(row => row.id === "sorcerer-22-locked");
    const response = responseFor(request);
    const gd = gdByClass.sorcerer;
    const board = Object.values(gd.daevanion).find(board => board.currency === "daevanion");
    const node = Object.values(board.nodes).find(node => node.cost > 0);
    const futureGd = { ...gd, daevanion: { ...gd.daevanion, [board.key]: { ...board, unlock_level: 45 } } };
    response.result.daevanion_path = [node.id];
    assert.equal(request.budget.daevanion, 0);
    assert.deepEqual(response.result.build.daevanion_nodes, []);
    assert.deepEqual(checkCase(request, response, futureGd, helpers), { issues: [], plansChecked: 2 });
  });

  it("still rejects purchased nodes with a locked quest gate in main and variant builds", () => {
    const request = cases.find(row => row.id === "sorcerer-22-locked");
    const response = responseFor(request);
    const board = Object.values(gdByClass.sorcerer.daevanion).find(board => board.currency === "daevanion" && board.unlock_level <= 22);
    const node = Object.values(board.nodes).find(node => node.cost > 0);
    response.result.daevanion_path = [node.id];
    response.result.build.daevanion_nodes = [node.id];
    response.result.variants[0].build.daevanion_nodes = [node.id];
    const checked = checkCase(request, response, gdByClass.sorcerer, helpers);
    assert.ok(checked.issues.some(issue => /main: nodes: Daevanion quest gate is locked/.test(issue)));
    assert.ok(checked.issues.some(issue => /variant max: nodes: Daevanion quest gate is locked/.test(issue)));
    assert.ok(checked.issues.some(issue => /main: Daevanion plan costs/.test(issue)));
    assert.ok(checked.issues.some(issue => /variant max: Daevanion plan costs/.test(issue)));
    assert.ok(!checked.issues.some(issue => issue.startsWith("Daevanion path:")));
  });

  it("rejects unrecognized guidance nodes even when no nodes are purchased", () => {
    const request = cases.find(row => row.id === "sorcerer-22-locked");
    const response = responseFor(request);
    response.result.daevanion_path = [-1];
    assert.deepEqual(checkCase(request, response, gdByClass.sorcerer, helpers).issues, ["Daevanion path: unknown node -1"]);
  });

  it("rejects BattleCrystal guidance with a zero battle budget independently of purchases", () => {
    const request = cases.find(row => row.id === "sorcerer-22-locked");
    const response = responseFor(request);
    const board = Object.values(gdByClass.sorcerer.daevanion).find(board => board.currency === "battle");
    response.result.daevanion_path = [board.start_id];
    assert.deepEqual(checkCase(request, response, gdByClass.sorcerer, helpers).issues,
      [`Daevanion path: BattleCrystal node ${board.start_id} with zero battle budget`]);
  });

  it("reports missing/duplicate responses and engine exceptions", () => {
    const request = cases[0];
    assert.equal(checkResponses([request], [], gdByClass, helpers).passed, false);
    const response = { id: request.id, request, error: "engine traceback" };
    const report = checkResponses([request], [response, response], gdByClass, helpers);
    assert.equal(report.passed, false);
    assert.ok(report.issues.some(issue => /Duplicate response/.test(issue)));
    assert.ok(report.cases[0].issues.some(issue => /CPython optimize failed/.test(issue)));
  });
});
