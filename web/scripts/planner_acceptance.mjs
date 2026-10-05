import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { build } from "vite";
import acceptanceConfig from "./planner_acceptance.vite.mjs";

export const webDir = fileURLToPath(new URL("../", import.meta.url));
export const artifactDir = join(webDir, ".planner-acceptance");
export const levels = [22, 30, 45];
export const classKeys = ["assassin", "chanter", "cleric", "gladiator", "ranger", "sorcerer", "spiritmaster", "templar"];
const zeroEarned = { skill: 0, stigma: 0, daevanion: 0 };
const extraEarned = { skill: 5, stigma: 3, daevanion: 4 };

export async function loadHelpers() {
  await build({ ...acceptanceConfig, configFile: false, logLevel: "warn" });
  return import(pathToFileURL(join(artifactDir, "validator.mjs")).href + `?built=${Date.now()}`);
}

export async function loadShippedData() {
  const classDataDir = join(webDir, "public", "engine", "classes");
  const manifest = JSON.parse(await readFile(join(webDir, "public", "engine", "manifest.json"), "utf8"));
  assert.deepEqual([...manifest.classes].sort(), classKeys, "Acceptance matrix must cover every shipped class");
  const gdByClass = Object.fromEntries(await Promise.all(classKeys.map(async (key) => {
    const gd = JSON.parse(await readFile(join(classDataDir, `${key}.json`), "utf8"));
    assert.equal(gd.class_key, key);
    return [key, gd];
  })));
  return { manifest, classDataDir, gdByClass };
}

export function generateCases(gdByClass, helpers) {
  const cases = [];
  function add(classKey, level, mode, earned, unlocked) {
    const gd = gdByClass[classKey];
    const form = { ...helpers.initialForm(classKey), level: String(level) };
    const built = helpers.buildFromForm(form, gd.level_caps.global);
    assert.ok(!("errors" in built), JSON.stringify(built));
    const prepared = helpers.prepareLevelBuild(built.build, gd, earned, unlocked, unlocked);
    const budget = { skill: prepared.budget.skill, stigma: prepared.build.stigma_points, daevanion: prepared.daevanionPoints };
    const request = {
      id: `${classKey}-${level}-${mode}`,
      earned: { ...earned },
      stigmaUnlocked: unlocked,
      daevanionUnlocked: unlocked,
      budget,
      args: { build: prepared.build, playstyle_key: "leveling", daevanion_points: prepared.daevanionPoints, battle_points: 0 },
    };
    assert.deepEqual(helpers.validateLevelPlan(prepared.build, budget, unlocked, gd), [], `${request.id}: generated input is illegal`);
    cases.push(request);
  }
  for (const key of classKeys) for (const level of levels) add(key, level, "unlocked", zeroEarned, true);
  for (const level of levels) {
    add("sorcerer", level, "locked", zeroEarned, false);
    add("sorcerer", level, "earned", extraEarned, true);
    add("sorcerer", level, "locked-earned", extraEarned, false);
  }
  return cases;
}

export function checkCase(request, response, gd, helpers) {
  const issues = [];
  let plansChecked = 0;
  const fail = (message) => issues.push(message);
  function equal(actual, expected, label) {
    try { assert.deepEqual(actual, expected); } catch { fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
  }
  function finite(value, label) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(`${label}: expected finite nonnegative DPS, got ${value}`);
  }
  equal(response.id, request.id, "Response ID");
  equal(response.request, request, "Python consumed request");
  if (response.error) return { issues: [...issues, `CPython optimize failed: ${response.error}`], plansChecked };
  const derivedCurrencies = helpers.progression.classes[gd.class_key]?.boardCurrencies;
  equal(Object.keys(derivedCurrencies ?? {}).sort(), Object.keys(gd.daevanion).sort(), "Derived board keys");
  for (const [key, board] of Object.entries(gd.daevanion)) {
    equal(board.currency, derivedCurrencies?.[key], `${key}: shipped/derived board currency`);
    equal(response.engineCurrencies?.[key], derivedCurrencies?.[key], `${key}: CPython/derived board currency`);
  }
  equal(Object.keys(response.engineCurrencies ?? {}).sort(), Object.keys(gd.daevanion).sort(), "CPython board keys");
  const nodeIndex = new Map();
  for (const board of Object.values(gd.daevanion)) for (const node of Object.values(board.nodes)) {
    if (nodeIndex.has(node.id)) fail(`Ambiguous Daevanion node ${node.id}`);
    nodeIndex.set(node.id, board);
  }
  function checkNodes(nodes, label, guidance = false) {
    if (!Array.isArray(nodes)) { fail(`${label}: missing node list`); return; }
    if (!guidance && !request.daevanionUnlocked && nodes.length) fail(`${label}: Daevanion quest gate is locked`);
    for (const id of nodes) {
      const board = nodeIndex.get(id);
      if (!board) fail(`${label}: unknown node ${id}`);
      else if (board.currency === "battle" || derivedCurrencies?.[board.key] === "battle") fail(`${label}: BattleCrystal node ${id} with zero battle budget`);
      else if (!guidance && board.unlock_level > request.args.build.level) fail(`${label}: node ${id} needs level ${board.unlock_level}`);
    }
  }
  function checkPlan(plan, label) {
    if (!plan || typeof plan !== "object") { fail(`${label}: missing build`); return; }
    plansChecked++;
    const input = request.args.build;
    for (const key of ["class_key", "level", "region", "skill_points", "stigma_points", "stigma_unlocked", "show_kr"]) equal(plan[key], input[key], `${label}: ${key}`);
    equal(plan.bonus_ranks, input.bonus_ranks, `${label}: unprovided bonus ranks`);
    try {
      issues.push(...helpers.validateLevelPlan(plan, request.budget, request.stigmaUnlocked, gd).map(issue => `${label}: ${issue}`));
      for (const key of new Set([...Object.keys(plan.skill_ranks), ...plan.stigmas])) {
        const skill = gd.skills[key];
        if (!skill || !skill.regions.includes(input.region) || (skill.unlock_level ?? 0) > input.level) fail(`${label}: ${key} unavailable in this region/level`);
      }
      checkNodes(plan.daevanion_nodes, `${label}: nodes`);
    } catch (error) { fail(`${label}: validator threw ${error.message}`); }
  }
  const result = response.result;
  if (!result) return { issues: [...issues, "Missing FullBuild output"], plansChecked };
  equal(result.playstyle?.key, request.args.playstyle_key, "Returned playstyle");
  finite(result.current_dps, "current_dps");
  finite(result.result?.dps, "result.dps");
  checkPlan(result.build, "main");
  try {
    issues.push(...helpers.validateLevelPriority(result.build, result.priority, gd).map(issue => `main priority: ${issue}`));
  } catch (error) { fail(`main priority: validator threw ${error.message}`); }
  // Full opening order is guidance, not the nodes purchased from this request's budget.
  checkNodes(result.daevanion_path, "Daevanion path", true);
  if (!Array.isArray(result.variants) || !result.variants.length) fail("Missing build variants");
  else {
    const keys = new Set();
    for (const variant of result.variants) {
      if (typeof variant.key !== "string" || keys.has(variant.key)) fail(`Invalid/duplicate variant key ${variant.key}`);
      keys.add(variant.key);
      finite(variant.dps, `variant ${variant.key}: dps`);
      checkPlan(variant.build, `variant ${variant.key}`);
      // The current webapi variant contract has no priority. Check one if it is added later.
      if (variant.priority) {
        try { issues.push(...helpers.validateLevelPriority(variant.build, variant.priority, gd).map(issue => `variant ${variant.key} priority: ${issue}`)); }
        catch (error) { fail(`variant ${variant.key} priority: validator threw ${error.message}`); }
      }
    }
    if (!keys.has("max")) fail("Missing max variant");
  }
  return { issues, plansChecked };
}

export function checkResponses(requests, responses, gdByClass, helpers) {
  const byId = new Map();
  const issues = [];
  const expected = new Set(requests.map(request => request.id));
  for (const response of responses) {
    if (byId.has(response.id)) issues.push(`Duplicate response ${response.id}`);
    if (!expected.has(response.id)) issues.push(`Unexpected response ${response.id}`);
    byId.set(response.id, response);
  }
  const cases = requests.map(request => {
    const response = byId.get(request.id);
    const checked = response ? checkCase(request, response, gdByClass[request.args.build.class_key], helpers)
      : { issues: ["Missing CPython response"], plansChecked: 0 };
    return { id: request.id, elapsedSeconds: response?.elapsedSeconds, ...checked };
  });
  return { cases, issues, passed: issues.length === 0 && cases.every(row => row.issues.length === 0),
    plansChecked: cases.reduce((total, row) => total + row.plansChecked, 0) };
}

export async function writeArtifact(name, data) {
  assert.equal(name, name.split(/[\\/]/).at(-1), "Artifact name must be a filename");
  await mkdir(artifactDir, { recursive: true });
  const path = join(artifactDir, name);
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
  return path;
}
