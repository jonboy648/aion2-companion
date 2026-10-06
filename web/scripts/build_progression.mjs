import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const defaultDestination = join(repoRoot, "web/src/features/progression/data.json");
const clientClasses = {
  assassin: "Assassin", chanter: "Chanter", cleric: "Cleric", gladiator: "Gladiator",
  ranger: "Ranger", sorcerer: "Sorcerer", spiritmaster: "Elementalist", templar: "Templar",
};
const currencies = {
  "EDaevanionPointType::DaevanionCrystal": "daevanion",
  "EDaevanionPointType::BattleCrystal": "battle",
};
const sourceNote = "Global level range from app class data; client version unverified. " +
  "Level point values are cumulative; acquisition ranks are source facts, not regional caps. " +
  "Only exact skill mappings are included; missing skills are not inferred. " +
  "Unresolved ranks have missing/ambiguous prerequisites or unsupported conditions/costs. " +
  "Exported prerequisite lists are empty; nonempty lists require explicit skill/rank fields. " +
  "Ascension grades and the stigma-unlock gate are derived without quest identifiers. " +
  "Specialty slots cover visible editable slots; auto-slot ranks use exact parent mappings. " +
  "Individual Parts options and complete condition support are not claimed.";

const acquisitionFields = new Set([
  "ID", "ClassType", "AcquireType", "SkillId", "SkillLevel", "bAutoLearn",
  "NeedCharacterLevel", "NeedAscensionGrade", "NeedPrevSkillDataList",
  "NeedsPrevSkillDataList", "CostSkillPoint", "CostStigmaPoint",
  "CostStigmaSuperiorPoint", "GainStigmaSuperiorPoint", "CostItemDataList", "bSkillListUI",
]);

function integer(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} must be an integer >= ${minimum}`);
  }
  return value;
}

export function parseTable(document) {
  const parsed = typeof document === "string" ? JSON.parse(document) : document;
  if (!Array.isArray(parsed?.Properties?.Data)) {
    throw new Error("Expected a JSON envelope with Properties.Data array");
  }
  return parsed.Properties.Data;
}

function skillIndex(skills) {
  const index = new Map();
  for (const [key, skill] of Object.entries(skills)) {
    if (!Number.isSafeInteger(skill.skill_id) || skill.skill_id <= 0) continue;
    const keys = index.get(skill.skill_id) ?? [];
    keys.push(key);
    index.set(skill.skill_id, keys);
  }
  return index;
}

// The inspected export has only empty lists. Unknown nonempty layouts stay unresolved.
export function normalizePrerequisites(list, index) {
  const requires = [];
  let unresolved = !Array.isArray(list);
  for (const entry of Array.isArray(list) ? list : []) {
    const keys = index.get(entry?.SkillId?.Value);
    if (keys?.length !== 1 || !Number.isSafeInteger(entry?.SkillLevel) || entry.SkillLevel < 1 ||
      Object.keys(entry).some((key) => !["SkillId", "SkillLevel"].includes(key))) {
      unresolved = true;
      continue;
    }
    if (!requires.some((req) => req.skill === keys[0] && req.rank === entry.SkillLevel)) {
      requires.push({ skill: keys[0], rank: entry.SkillLevel });
    }
  }
  requires.sort((a, b) => a.skill.localeCompare(b.skill) || a.rank - b.rank);
  return { requires, unresolved };
}

function ascensionGrade(value) {
  if (value === "EAscensionGrade::None") return 0;
  const match = /^EAscensionGrade::AscensionGrade_(\d+)$/.exec(value);
  return match ? integer(Number(match[1]), "Ascension grade", 1) : null;
}

function unsupportedConditions(row) {
  return Object.keys(row).some((key) => !acquisitionFields.has(key)) ||
    !["ESkillAcquireType::Mastery", "ESkillAcquireType::Stigma"].includes(row.AcquireType) ||
    ascensionGrade(row.NeedAscensionGrade) === null ||
    !Array.isArray(row.CostItemDataList) || row.CostItemDataList.length > 0 ||
    row.CostStigmaSuperiorPoint !== 0 || row.GainStigmaSuperiorPoint !== 0;
}

function buildLevels(exp, cap) {
  const levels = exp.filter((row) => row.Level <= cap).map((row) => {
    if (!Array.isArray(row.DaevanionPointMap)) throw new Error("Expected a Daevanion point map array");
    const crystals = row.DaevanionPointMap.filter((point) =>
      point.Key === "EDaevanionPointType::DaevanionCrystal");
    if (crystals.length > 1) throw new Error("Ambiguous Daevanion crystal total");
    return {
      level: integer(row.Level, "Level", 1),
      skill: integer(row.BonusSkillPoint, "Skill total"),
      stigma: integer(row.BonusStigmaPoint, "Stigma total"),
      stigmaSlots: integer(row.StigmaSkillContextSlotMax, "Stigma slot total"),
      daevanion: integer(crystals[0]?.Value ?? 0, "Daevanion crystal total"),
    };
  }).sort((a, b) => a.level - b.level);
  if (levels.length !== cap || levels.some((row, i) => row.level !== i + 1)) {
    throw new Error("Expected one progression row for every Global level");
  }
  for (let i = 1; i < levels.length; i++) {
    for (const key of ["skill", "stigma", "stigmaSlots", "daevanion"]) {
      if (levels[i][key] < levels[i - 1][key]) throw new Error(`Nonmonotonic ${key} total`);
    }
  }
  return levels;
}

function buildSpecialtySlots(rows) {
  const slots = { core: [], stigma: [] };
  for (const row of rows) {
    if (!row.bShowSlot || !row.bUserEditSlot) continue;
    const kind = { "ESkillAcquireType::Mastery": "core", "ESkillAcquireType::Stigma": "stigma" }[
      row.SkillAcquireType];
    const match = /^ESpecializedSkillSlotType::Slot_(\d+)$/.exec(row.SlotType);
    if (!kind || !match) throw new Error("Unsupported visible specialty slot");
    const slot = integer(Number(match[1]), "Specialty slot", 1);
    if (slots[kind].some((item) => item.slot === slot)) throw new Error("Duplicate specialty slot");
    slots[kind].push({ slot, rank: integer(row.UnlockSkillLv, "Specialty rank", 1) });
  }
  for (const list of Object.values(slots)) list.sort((a, b) => a.slot - b.slot);
  return slots;
}

function buildSpecialtyAutoSlots(parts, skillId) {
  const slots = [];
  for (const part of parts) {
    if (part.ParentSkillId?.Value !== skillId || part.InitEquipSlotType === "ESpecializedSkillSlotType::None") continue;
    const match = /^ESpecializedSkillSlotType::Slot_(\d+)$/.exec(part.InitEquipSlotType);
    if (!match) throw new Error("Unsupported specialty auto-slot");
    const slot = integer(Number(match[1]), "Specialty auto-slot", 1);
    const rank = integer(part.ParentSkillLv, "Specialty auto-slot rank", 1);
    if (slots.some((item) => item.slot === slot)) throw new Error("Ambiguous specialty auto-slot");
    slots.push({ slot, rank });
  }
  return slots.sort((a, b) => a.slot - b.slot);
}

export function buildBoardCurrencies(classKey, data, boards, strings) {
  const result = {};
  for (const [key, board] of Object.entries(data.daevanion ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    const matches = boards.filter((row) => row.Class === `ECharacterClass::${clientClasses[classKey]}` &&
      strings[`String_${row.Title?.Key}_body`] === board.name && row.NeedLevel === board.unlock_level);
    if (!clientClasses[classKey] || matches.length !== 1) {
      throw new Error(`Missing or ambiguous Daevanion board join: ${classKey}/${key}`);
    }
    const sourceCurrency = matches[0].CostPointType;
    if (!Object.hasOwn(currencies, sourceCurrency)) throw new Error(`Unknown Daevanion currency: ${classKey}/${key}`);
    const currency = currencies[sourceCurrency];
    result[key] = currency;
  }
  return result;
}

export function buildProgression({ exp, acquisitions, specialtySlots = [], specialtyParts = [],
  daevanionBoards = [], strings = {}, classData }) {
  const caps = Object.values(classData).map((data) => integer(data.level_caps?.global, "Global cap", 1));
  if (!caps.length || new Set(caps).size !== 1) throw new Error("Expected a shared Global class level cap");
  const classes = {};
  for (const classKey of Object.keys(classData).sort()) {
    const data = classData[classKey];
    // Include all real IDs in the index so a duplicate or KR-only prerequisite cannot look resolved.
    const index = skillIndex(data.skills);
    const skills = {};
    for (const skillKey of Object.keys(data.skills).sort()) {
      const skill = data.skills[skillKey];
      if (!skill.regions?.includes("global") || index.get(skill.skill_id)?.length !== 1) continue;
      const rows = acquisitions.filter((row) => row.SkillId?.Value === skill.skill_id);
      if (!rows.length) continue;
      const ranks = rows.map((row) => {
        const lists = [row.NeedPrevSkillDataList ?? row.NeedsPrevSkillDataList];
        if (row.NeedPrevSkillDataList !== undefined && row.NeedsPrevSkillDataList !== undefined) {
          lists.push(row.NeedsPrevSkillDataList);
        }
        const requirements = lists.map((list) => normalizePrerequisites(list, index));
        const requires = requirements.flatMap((requirement) => requirement.requires);
        const unresolved = requirements.some((requirement) => requirement.unresolved) ||
          requires.some((requirement) => !data.skills[requirement.skill].regions?.includes("global")) ||
          unsupportedConditions(row);
        const grade = ascensionGrade(row.NeedAscensionGrade);
        if (typeof row.bAutoLearn !== "boolean") throw new Error("Expected an acquisition auto-learn flag");
        return {
          rank: integer(row.SkillLevel, "Rank", 1),
          characterLevel: integer(row.NeedCharacterLevel, "Character level", 1),
          skillCost: integer(row.CostSkillPoint, "Skill cost"),
          stigmaCost: integer(row.CostStigmaPoint, "Stigma cost"),
          requires,
          ...(grade > 0 ? { ascensionGrade: grade } : {}),
          ...(grade === 3 && row.AcquireType === "ESkillAcquireType::Stigma" ? { requiresStigmaUnlock: true } : {}),
          ...(unresolved ? { unresolved: true } : {}),
        };
      }).sort((a, b) => a.rank - b.rank);
      if (new Set(ranks.map((rank) => rank.rank)).size !== ranks.length) {
        throw new Error("Ambiguous duplicate acquisition rank");
      }
      const first = rows.find((row) => row.SkillLevel === 1);
      if (!first) for (const rank of ranks) rank.unresolved = true;
      const specialtyAutoSlots = buildSpecialtyAutoSlots(specialtyParts, skill.skill_id);
      skills[skillKey] = {
        unlockLevel: first?.NeedCharacterLevel ?? Math.min(...ranks.map((rank) => rank.characterLevel)),
        autoLearn: first?.bAutoLearn ?? false,
        ranks,
        ...(specialtyAutoSlots.length ? { specialtyAutoSlots } : {}),
      };
    }
    classes[classKey] = { skills, boardCurrencies: buildBoardCurrencies(classKey, data, daevanionBoards, strings) };
  }
  // Resolve only requirements whose own acquisition record is actually present.
  for (const { skills } of Object.values(classes)) {
    for (const skill of Object.values(skills)) {
      for (const rank of skill.ranks) {
        if (rank.requires.some((req) => !skills[req.skill]?.ranks.some((row) => row.rank === req.rank))) {
          rank.unresolved = true;
        }
      }
    }
  }
  return {
    schema: 1,
    source: { region: "global", clientVersion: null, exportedAt: "2026-10-04", note: sourceNote },
    levels: buildLevels(exp, caps[0]),
    classes,
    specialtySlots: buildSpecialtySlots(specialtySlots),
  };
}

function knownFields(value, allowed, label) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error(`Unsupported ${label} field; compact encoding must preserve it`);
  }
}

// Pool source facts verbatim; rank numbers stay explicit, including gaps and unresolved records.
export function compactProgression(data) {
  const rankProfiles = [];
  const autoSlotProfiles = [];
  const rankIndex = new Map();
  const autoSlotIndex = new Map();
  const intern = (value, profiles, index) => {
    const key = JSON.stringify(value);
    if (!index.has(key)) { index.set(key, profiles.length); profiles.push(value); }
    return index.get(key);
  };
  knownFields(data, ["schema", "source", "levels", "classes", "specialtySlots"], "progression");
  knownFields(data.source, ["region", "clientVersion", "exportedAt", "note"], "source");
  if (data.schema !== 1) throw new Error("Expected expanded progression schema 1");
  const classes = {};
  for (const [classKey, entry] of Object.entries(data.classes)) {
    knownFields(entry, ["skills", "boardCurrencies"], "class");
    const skills = {};
    for (const [key, skill] of Object.entries(entry.skills)) {
      knownFields(skill, ["unlockLevel", "autoLearn", "ranks", "specialtyAutoSlots"], "skill");
      const ranks = skill.ranks.map((rank) => {
        knownFields(rank, ["rank", "characterLevel", "skillCost", "stigmaCost", "requires",
          "ascensionGrade", "requiresStigmaUnlock", "unresolved"], "rank");
        const gates = {};
        if (rank.requires.length) gates.requires = rank.requires.map((req) => {
          knownFields(req, ["skill", "rank"], "prerequisite");
          return [req.skill, req.rank];
        });
        for (const field of ["ascensionGrade", "requiresStigmaUnlock", "unresolved"]) {
          if (Object.hasOwn(rank, field)) gates[field] = rank[field];
        }
        return [rank.rank, rank.characterLevel, rank.skillCost, rank.stigmaCost,
          ...(Object.keys(gates).length ? [gates] : [])];
      });
      const tuple = [skill.unlockLevel, skill.autoLearn ? 1 : 0, intern(ranks, rankProfiles, rankIndex)];
      if (skill.specialtyAutoSlots !== undefined) {
        const slots = skill.specialtyAutoSlots.map((slot) => {
          knownFields(slot, ["slot", "rank"], "automatic specialty slot");
          return [slot.slot, slot.rank];
        });
        tuple.push(intern(slots, autoSlotProfiles, autoSlotIndex));
      }
      skills[key] = tuple;
    }
    classes[classKey] = { skills, boardCurrencies: entry.boardCurrencies };
  }
  const levels = data.levels.map((level) => {
    knownFields(level, ["level", "skill", "stigma", "stigmaSlots", "daevanion"], "level");
    return [level.level, level.skill, level.stigma, level.stigmaSlots, level.daevanion];
  });
  knownFields(data.specialtySlots, ["core", "stigma"], "specialty slots");
  for (const slots of Object.values(data.specialtySlots)) {
    for (const slot of slots) knownFields(slot, ["slot", "rank"], "specialty slot");
  }
  return { schema: 2, source: data.source, levels, rankProfiles, autoSlotProfiles,
    classes, specialtySlots: data.specialtySlots };
}

export function formatCompactProgression(data) {
  const lines = ["{", '  "schema": 2,', `  "source": ${JSON.stringify(data.source)},`];
  for (const field of ["levels", "rankProfiles", "autoSlotProfiles"]) {
    lines.push(`  "${field}": [`, data[field].map((row) => `    ${JSON.stringify(row)}`).join(",\n"), "  ],");
  }
  lines.push('  "classes": {');
  const entries = Object.entries(data.classes);
  entries.forEach(([key, entry], i) => {
    lines.push(`    ${JSON.stringify(key)}: {`, '      "skills": {',
      Object.entries(entry.skills).map(([skill, tuple]) => `        ${JSON.stringify(skill)}: ${JSON.stringify(tuple)}`).join(",\n"),
      "      },", `      "boardCurrencies": ${JSON.stringify(entry.boardCurrencies)}`,
      `    }${i < entries.length - 1 ? "," : ""}`);
  });
  lines.push("  },", `  "specialtySlots": ${JSON.stringify(data.specialtySlots)}`, "}", "");
  return lines.join("\n");
}

export async function generateProgression({
  exportDir = process.env.AION2_EXPORT_DIR,
  classesDir = join(repoRoot, "app/aion2c/data/classes"),
  destination = defaultDestination,
} = {}) {
  if (!exportDir) {
    throw new Error("Set AION2_EXPORT_DIR to the private client export's Table directory before generating progression.");
  }
  const readTable = async (name) => parseTable(await readFile(join(exportDir, `${name}.json`), "utf8"));
  const classData = {};
  for (const entry of (await readdir(classesDir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) {
      classData[entry.name] = JSON.parse(await readFile(join(classesDir, entry.name, "gamedata.json"), "utf8"));
    }
  }
  const data = buildProgression({
    exp: await readTable("Exp"),
    acquisitions: await readTable("SkillAcquireData"),
    specialtySlots: await readTable("SpecializedSkillSlot"),
    specialtyParts: await readTable("SpecializedSkillParts"),
    daevanionBoards: await readTable("DaevanionBoard"),
    strings: JSON.parse(await readFile(join(exportDir, "L10N/en-US/L10NString.json"), "utf8")).Entries,
    classData,
  });
  const compact = compactProgression(data);
  const json = formatCompactProgression(compact);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, json, "utf8");
  return { data, compact, bytes: Buffer.byteLength(json) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length > 3) throw new Error("Usage: node build_progression.mjs [destination.json]");
  const { data, bytes } = await generateProgression({ destination: process.argv[2] ?? defaultDestination });
  const classes = Object.values(data.classes);
  const skills = classes.flatMap((entry) => Object.values(entry.skills));
  console.log(JSON.stringify({ bytes, levels: data.levels.length, classes: classes.length,
    skills: skills.length, ranks: skills.reduce((total, skill) => total + skill.ranks.length, 0) }));
}
