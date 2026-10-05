import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { buildProgression, compactProgression, formatCompactProgression,
  normalizePrerequisites, parseTable } from "./build_progression.mjs";
import { decodeProgression } from "../src/features/progression/decodeProgression.ts";

function acquisition(overrides = {}) {
  return {
    ID: { Value: 987654321 }, ClassType: "ECharacterClass::Gladiator",
    AcquireType: "ESkillAcquireType::Mastery", SkillId: { Value: 100 },
    SkillLevel: 1, bAutoLearn: true, NeedCharacterLevel: 1,
    NeedAscensionGrade: "EAscensionGrade::None", NeedPrevSkillDataList: [],
    CostSkillPoint: 0, CostStigmaPoint: 0, CostStigmaSuperiorPoint: 0,
    GainStigmaSuperiorPoint: 0, CostItemDataList: [], bSkillListUI: true,
    ...overrides,
  };
}

function fixture(overrides = {}) {
  return {
    exp: [1, 2, 3].map((Level) => ({ Level, BonusSkillPoint: Level - 1,
      BonusStigmaPoint: Level === 3 ? 1 : 0, StigmaSkillContextSlotMax: Level === 3 ? 1 : 0,
      DaevanionPointMap: [{ Key: "EDaevanionPointType::DaevanionCrystal", Value: Level - 1 },
        { Key: "EDaevanionPointType::Other", Value: 99999 }] })),
    acquisitions: [acquisition(), acquisition({ SkillLevel: 2, bAutoLearn: false, CostSkillPoint: 4 })],
    classData: { gladiator: { level_caps: { global: 3, korea: 50 }, skills: {
      strike: { skill_id: 100, regions: ["global", "korea"], unlock_level: 99, max_rank: 1 },
      missing: { skill_id: 200, regions: ["global"] },
      synthetic: { skill_id: null, regions: ["global"] },
      korea: { skill_id: 300, regions: ["korea"] },
    } } },
    specialtySlots: [{ SkillAcquireType: "ESkillAcquireType::Mastery",
      SlotType: "ESpecializedSkillSlotType::Slot_1", UnlockSkillLv: 8,
      bShowSlot: true, bUserEditSlot: true }],
    ...overrides,
  };
}

test("parses only Properties.Data, without treating the envelope version as client version", () => {
  const rows = [acquisition()];
  assert.deepEqual(parseTable(JSON.stringify({ Version: 13, Ids: ["private"], Properties: { Data: rows } })), rows);
  assert.deepEqual(parseTable({ Properties: { Data: rows } }), rows);
  for (const bad of [rows, { Data: rows }, { Properties: { Data: {} } }, null]) {
    assert.throws(() => parseTable(bad), /Properties.Data/);
  }
  const data = buildProgression(fixture());
  assert.equal(data.source.clientVersion, null);
  assert.equal(data.source.exportedAt, "2026-10-04");
  assert.match(data.source.note, /version unverified/);
});

test("maps exact IDs only, preserves free auto-learn and exported costs, and retains source ranks", () => {
  const input = fixture();
  input.acquisitions.push(acquisition({ SkillId: { Value: 300 } }),
    acquisition({ SkillId: { Value: 999 } }),
    acquisition({ SkillLevel: 40, NeedCharacterLevel: 60, bAutoLearn: false, CostSkillPoint: 7 }));
  const data = buildProgression(input);
  assert.deepEqual(Object.keys(data.classes.gladiator.skills), ["strike"]);
  const skill = data.classes.gladiator.skills.strike;
  assert.equal(skill.unlockLevel, 1);
  assert.equal(skill.autoLearn, true);
  assert.deepEqual(skill.ranks[0], { rank: 1, characterLevel: 1, skillCost: 0, stigmaCost: 0, requires: [] });
  assert.equal(skill.ranks[1].skillCost, 4);
  assert.equal(skill.ranks[2].rank, 40);
  assert.equal(skill.ranks[2].characterLevel, 60);
  assert.equal(data.levels.length, 3);
});

test("normalizes explicit skill/rank prerequisites; missing, ambiguous and unknown structures stay unresolved", () => {
  const index = new Map([[100, ["strike"]], [200, ["a", "b"]]]);
  const prev = (id, rank = 2) => ({ SkillId: { Value: id }, SkillLevel: rank });
  assert.deepEqual(normalizePrerequisites([], index), { requires: [], unresolved: false });
  assert.deepEqual(normalizePrerequisites([prev(100)], index), {
    requires: [{ skill: "strike", rank: 2 }], unresolved: false,
  });
  for (const list of [[prev(999)], [prev(200)], [{ unexpected: "private" }], [prev(100, 0)], null]) {
    assert.equal(normalizePrerequisites(list, index).unresolved, true);
  }
  const input = fixture();
  input.acquisitions[1].NeedPrevSkillDataList = [prev(200), prev(100, 1)];
  const rank = buildProgression(input).classes.gladiator.skills.strike.ranks[1];
  assert.equal(rank.unresolved, true);
  assert.deepEqual(rank.requires, [{ skill: "missing", rank: 2 }, { skill: "strike", rank: 1 }]);
  input.classData.gladiator.skills.alias = { skill_id: 200, regions: ["global"] };
  assert.equal(buildProgression(input).classes.gladiator.skills.strike.ranks[1].unresolved, true);
});

test("missing prerequisite ranks and KR-only prerequisites cannot appear resolved", () => {
  const input = fixture();
  for (const [id, rank] of [[100, 20], [300, 1]]) {
    input.acquisitions[1].NeedPrevSkillDataList = [{ SkillId: { Value: id }, SkillLevel: rank }];
    assert.equal(buildProgression(input).classes.gladiator.skills.strike.ranks[1].unresolved, true);
  }
});

test("accepts the alternate list spelling conservatively and flags missing rank one", () => {
  const input = fixture();
  input.acquisitions.shift();
  delete input.acquisitions[0].NeedPrevSkillDataList;
  input.acquisitions[0].NeedsPrevSkillDataList = [{ SkillId: { Value: 999 }, SkillLevel: 1 }];
  const skill = buildProgression(input).classes.gladiator.skills.strike;
  assert.equal(skill.autoLearn, false);
  assert.equal(skill.ranks[0].unresolved, true);
});

test("unsupported costs and conditions are explicit; duplicate rank facts are rejected", () => {
  for (const extra of [
    { CostItemDataList: [{ private: 123 }] }, { CostStigmaSuperiorPoint: 1 },
    { GainStigmaSuperiorPoint: 1 }, { NeedAscensionGrade: "EAscensionGrade::Unknown" },
    { NeedQuest: { Value: 999 } },
  ]) {
    const data = buildProgression(fixture({ acquisitions: [acquisition(extra)] }));
    assert.equal(data.classes.gladiator.skills.strike.ranks[0].unresolved, true);
  }
  assert.throws(() => buildProgression(fixture({ acquisitions: [acquisition(), acquisition()] })), /duplicate/);
});

test("level totals stay cumulative and monotonic, only crystals count, and cap comes from Global classdata", () => {
  const input = fixture();
  input.exp.push({ Level: 4, BonusSkillPoint: 999 });
  const data = buildProgression(input);
  assert.deepEqual(data.levels[2], { level: 3, skill: 2, stigma: 1, stigmaSlots: 1, daevanion: 2 });
  for (const field of ["BonusSkillPoint", "BonusStigmaPoint", "StigmaSkillContextSlotMax"]) {
    const broken = fixture();
    broken.exp[1][field] = 2;
    broken.exp[2][field] = 1;
    assert.throws(() => buildProgression(broken), /Nonmonotonic/);
  }
  const broken = fixture();
  broken.exp[1].DaevanionPointMap[0].Value = 5;
  assert.throws(() => buildProgression(broken), /Nonmonotonic/);
  assert.throws(() => buildProgression(fixture({ exp: fixture().exp.slice(1) })), /every Global level/);
});

test("specialty slot thresholds include only visible editable slots", () => {
  const input = fixture();
  input.specialtySlots.push({ SkillAcquireType: "ESkillAcquireType::Stigma",
    SlotType: "ESpecializedSkillSlotType::Slot_1", UnlockSkillLv: 0, bShowSlot: false, bUserEditSlot: false });
  assert.deepEqual(buildProgression(input).specialtySlots, { core: [{ slot: 1, rank: 8 }], stigma: [] });
});

test("stigma acquisition derives ascension and unlock gates without quest identifiers", () => {
  const data = buildProgression(fixture({ acquisitions: [acquisition({
    AcquireType: "ESkillAcquireType::Stigma", NeedAscensionGrade: "EAscensionGrade::AscensionGrade_3",
    bAutoLearn: false, CostStigmaPoint: 1,
  })] }));
  const skill = data.classes.gladiator.skills.strike;
  assert.equal(skill.autoLearn, false);
  assert.deepEqual(skill.ranks[0], { rank: 1, characterLevel: 1, skillCost: 0, stigmaCost: 1,
    requires: [], ascensionGrade: 3, requiresStigmaUnlock: true });
});

test("specialty auto-slots use exact parent IDs and retain only numeric slot/rank requirements", () => {
  const specialtyParts = [5, 10, 15, 20].map((rank, i) => ({
    ID: { Value: 123456789 + i }, ParentSkillId: { Value: 100 }, ParentSkillLv: rank,
    InitEquipSlotType: `ESpecializedSkillSlotType::Slot_${i + 1}`,
    SpecializedSkillPartsDesc: "STR_SKILL_PRIVATE",
  }));
  specialtyParts.push({ ParentSkillId: { Value: 999 }, ParentSkillLv: 99,
    InitEquipSlotType: "ESpecializedSkillSlotType::Slot_1" });
  const data = buildProgression(fixture({ specialtyParts }));
  assert.deepEqual(data.classes.gladiator.skills.strike.specialtyAutoSlots,
    [5, 10, 15, 20].map((rank, i) => ({ slot: i + 1, rank })));
  assert.doesNotMatch(JSON.stringify(data), /ParentSkill|InitEquip|STR_SKILL|123456789/);
  assert.throws(() => buildProgression(fixture({ specialtyParts: [...specialtyParts, specialtyParts[0]] })), /Ambiguous/);
});

test("derived output cannot leak raw field names, identifiers, strings, or private paths", () => {
  const input = fixture();
  input.classData.gladiator.skills.strike.description = "PRIVATE_SENTINEL D:\\private\\export";
  input.classData.gladiator.skills.strike.source = "STR_SKILL_PRIVATE";
  const json = JSON.stringify(buildProgression(input));
  assert.doesNotMatch(json, /SkillId|SkillLevel|CostSkillPoint|Properties|skill_id|987654321|PRIVATE_SENTINEL|STR_SKILL|D:\\|export-test/);
});

function boardFixture() {
  const input = fixture();
  input.classData.gladiator.daevanion = {
    namedKey: { name: "Nezekan", unlock_level: 12 },
    arbitraryKey: { name: "Azphel", unlock_level: 45 },
  };
  input.daevanionBoards = [
    { ID: { Value: 123456 }, Class: "ECharacterClass::Gladiator", Title: { Key: "PRIVATE_NEZ" },
      NeedLevel: 12, CostPointType: "EDaevanionPointType::DaevanionCrystal" },
    { ID: { Value: 654321 }, Class: "ECharacterClass::Gladiator", Title: { Key: "PRIVATE_AZP" },
      NeedLevel: 45, CostPointType: "EDaevanionPointType::BattleCrystal" },
  ];
  input.strings = { String_PRIVATE_NEZ_body: "Nezekan", String_PRIVATE_AZP_body: "Azphel" };
  return input;
}

test("board currencies use exact class, localized title and unlock level joins, never IDs or board keys", () => {
  const input = boardFixture();
  input.daevanionBoards.push({ ...input.daevanionBoards[1], Class: "ECharacterClass::Sorcerer",
    CostPointType: "EDaevanionPointType::DaevanionCrystal" });
  const expanded = buildProgression(input);
  assert.deepEqual(expanded.classes.gladiator.boardCurrencies, { arbitraryKey: "battle", namedKey: "daevanion" });
  const decoded = decodeProgression(compactProgression(expanded));
  assert.deepEqual(decoded, expanded);
  assert.doesNotMatch(JSON.stringify(decoded), /PRIVATE_|123456|654321|CostPointType|ECharacterClass/);
});

test("missing, ambiguous and unknown board currencies fail closed", () => {
  for (const change of [
    (input) => { input.daevanionBoards[1].CostPointType = "EDaevanionPointType::Unknown"; },
    (input) => { input.daevanionBoards[1].NeedLevel = 44; },
    (input) => { input.daevanionBoards[1].Class = "ECharacterClass::Sorcerer"; },
    (input) => { input.daevanionBoards[1].Title.Key = "MISSING"; },
    (input) => { input.daevanionBoards.push(input.daevanionBoards[1]); },
    (input) => { input.daevanionBoards = []; },
  ]) {
    const input = boardFixture();
    change(input);
    assert.throws(() => buildProgression(input), /currency|board join/);
  }
});

test("compact round trip preserves every expanded fact, prerequisites, rank gaps, flags and automatic tiers", () => {
  const input = boardFixture();
  input.acquisitions.push(acquisition({ SkillLevel: 40, NeedCharacterLevel: 60,
    CostSkillPoint: 7, NeedPrevSkillDataList: [{ SkillId: { Value: 100 }, SkillLevel: 2 }],
    NeedAscensionGrade: "EAscensionGrade::AscensionGrade_4", CostItemDataList: [{ private: 42 }] }));
  input.specialtyParts = [{ ParentSkillId: { Value: 100 }, ParentSkillLv: 5,
    InitEquipSlotType: "ESpecializedSkillSlotType::Slot_1" }];
  const expanded = buildProgression(input);
  expanded.classes.gladiator.skills.strike.ranks[0].unresolved = false;
  expanded.classes.gladiator.skills.strike.ranks[0].requiresStigmaUnlock = false;
  expanded.classes.gladiator.skills.alias = structuredClone(expanded.classes.gladiator.skills.strike);
  const snapshot = structuredClone(expanded);
  const packed = compactProgression(expanded);
  assert.equal(packed.rankProfiles.length, 1);
  assert.equal(packed.autoSlotProfiles.length, 1);
  assert.deepEqual(decodeProgression(JSON.parse(formatCompactProgression(packed))), expanded);
  assert.deepEqual(expanded, snapshot);
  assert.equal(packed.rankProfiles[0][2][0], 40);
  const decoded = decodeProgression(packed);
  decoded.classes.gladiator.skills.alias.ranks[0].requires.push({ skill: "other", rank: 1 });
  assert.deepEqual(decoded.classes.gladiator.skills.strike.ranks[0].requires, []);
  expanded.classes.gladiator.skills.strike.ranks[0].newGate = true;
  assert.throws(() => compactProgression(expanded), /must preserve/);
});

test("committed derived data has Global level 45 totals, exported cost differences, and no raw fields", async () => {
  const text = await readFile(join(dirname(fileURLToPath(import.meta.url)), "../src/features/progression/data.json"), "utf8");
  const compact = JSON.parse(text);
  assert.equal(compact.schema, 2);
  assert.equal(compact.rankProfiles.length, 26);
  assert.ok(Buffer.byteLength(text) < 20000, "Keep the readable generated payload compact");
  const data = decodeProgression(compact);
  assert.deepEqual(decodeProgression(compactProgression(data)), data);
  assert.equal(data.schema, 1);
  assert.equal(data.source.region, "global");
  assert.equal(data.source.clientVersion, null);
  assert.equal(data.levels.length, 45);
  assert.deepEqual(data.levels.at(-1), { level: 45, skill: 203, stigma: 29, stigmaSlots: 4, daevanion: 136 });
  for (let i = 0; i < data.levels.length; i++) {
    assert.equal(data.levels[i].level, i + 1);
    if (i) for (const field of ["skill", "stigma", "stigmaSlots", "daevanion"]) {
      assert.ok(data.levels[i][field] >= data.levels[i - 1][field]);
    }
  }
  assert.equal(Object.keys(data.classes).length, 8);
  for (const entry of Object.values(data.classes)) {
    assert.deepEqual(entry.boardCurrencies, {
      azphel: "battle", nezekan: "daevanion", triniel: "daevanion", vaizel: "daevanion", zikel: "daevanion",
    });
  }
  const ranks = data.classes.gladiator.skills["rending-blow"].ranks;
  assert.deepEqual(ranks.slice(0, 8).map((rank) => rank.skillCost), [0, 1, 1, 1, 2, 2, 2, 4]);
  assert.deepEqual(data.specialtySlots.core.map((slot) => slot.rank), [8, 12, 20]);
  const stigma = data.classes.gladiator.skills["blade-toss"];
  assert.equal(stigma.autoLearn, false);
  assert.equal(stigma.ranks[0].stigmaCost, 1);
  assert.equal(stigma.ranks[0].ascensionGrade, 3);
  assert.equal(stigma.ranks[0].requiresStigmaUnlock, true);
  assert.deepEqual(stigma.specialtyAutoSlots.map((slot) => slot.rank), [5, 10, 15, 20]);
  assert.doesNotMatch(text, /SkillId|NeedCharacterLevel|CostSkillPoint|Properties|STR_SKILL|[A-Z]:\\|export-test|\.dat/);
});
