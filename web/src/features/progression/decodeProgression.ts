export type BoardCurrency = "daevanion" | "battle";

export interface ExpandedAcquisitionRank {
  rank: number;
  characterLevel: number;
  skillCost: number;
  stigmaCost: number;
  requires: { skill: string; rank: number }[];
  ascensionGrade?: number;
  requiresStigmaUnlock?: boolean;
  unresolved?: boolean;
}

export interface ExpandedProgression {
  schema: 1;
  source: { region: string; clientVersion: string | null; exportedAt?: string; note: string };
  levels: { level: number; skill: number; stigma: number; stigmaSlots: number; daevanion: number }[];
  classes: Record<string, {
    skills: Record<string, {
      unlockLevel: number;
      autoLearn: boolean;
      ranks: ExpandedAcquisitionRank[];
      specialtyAutoSlots?: { slot: number; rank: number }[];
    }>;
    boardCurrencies: Record<string, BoardCurrency>;
  }>;
  specialtySlots: { core: { slot: number; rank: number }[]; stigma: { slot: number; rank: number }[] };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid progression object");
  return value as Record<string, unknown>;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Invalid progression array");
  return value;
}

function integer(value: unknown, minimum = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error("Invalid progression integer");
  }
  return value;
}

function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid progression string");
  return value;
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Invalid progression flag");
  return value;
}

function tuple(value: unknown, lengths: number[]): unknown[] {
  const row = array(value);
  if (!lengths.includes(row.length)) throw new Error("Invalid progression tuple");
  return row;
}

function slots(value: unknown): { slot: number; rank: number }[] {
  return array(value).map((value) => {
    const row = record(value);
    return { slot: integer(row.slot, 1), rank: integer(row.rank, 1) };
  });
}

function decodeRank(value: unknown): ExpandedAcquisitionRank {
  const row = tuple(value, [4, 5]);
  const gates = row.length === 5 ? record(row[4]) : {};
  if (Object.keys(gates).some((key) => !["requires", "ascensionGrade", "requiresStigmaUnlock", "unresolved"].includes(key))) {
    throw new Error("Unknown acquisition gate");
  }
  const requires = gates.requires === undefined ? [] : array(gates.requires).map((value) => {
    const req = tuple(value, [2]);
    return { skill: text(req[0]), rank: integer(req[1], 1) };
  });
  return {
    rank: integer(row[0], 1), characterLevel: integer(row[1], 1),
    skillCost: integer(row[2]), stigmaCost: integer(row[3]), requires,
    ...(Object.hasOwn(gates, "ascensionGrade") ? { ascensionGrade: integer(gates.ascensionGrade) } : {}),
    ...(Object.hasOwn(gates, "requiresStigmaUnlock") ? { requiresStigmaUnlock: boolean(gates.requiresStigmaUnlock) } : {}),
    ...(Object.hasOwn(gates, "unresolved") ? { unresolved: boolean(gates.unresolved) } : {}),
  };
}

/** Schema 2 pools facts; decode to schema 1 without guessing missing ranks, gates, or currencies. */
export function decodeProgression(input: unknown): ExpandedProgression {
  const data = record(input);
  if (data.schema !== 2) throw new Error("Unsupported compact progression schema");
  const source = record(data.source);
  const rankProfiles = array(data.rankProfiles).map((profile) => {
    const ranks = array(profile).map(decodeRank);
    if (!ranks.length || ranks.some((rank, i) => i > 0 && rank.rank <= ranks[i - 1].rank)) {
      throw new Error("Invalid acquisition rank order");
    }
    return ranks;
  });
  const autoSlotProfiles = array(data.autoSlotProfiles).map((profile) => array(profile).map((value) => {
    const row = tuple(value, [2]);
    return { slot: integer(row[0], 1), rank: integer(row[1], 1) };
  }));
  const levels = array(data.levels).map((value) => {
    const row = tuple(value, [5]);
    return { level: integer(row[0], 1), skill: integer(row[1]), stigma: integer(row[2]),
      stigmaSlots: integer(row[3]), daevanion: integer(row[4]) };
  });
  const classes = Object.fromEntries(Object.entries(record(data.classes)).map(([key, value]) => {
    const entry = record(value);
    const boardCurrencies = Object.fromEntries(Object.entries(record(entry.boardCurrencies)).map(([board, currency]) => {
      if (currency !== "daevanion" && currency !== "battle") throw new Error(`Unknown board currency: ${key}/${board}`);
      return [board, currency];
    })) as Record<string, BoardCurrency>;
    const skills = Object.fromEntries(Object.entries(record(entry.skills)).map(([skill, value]) => {
      const row = tuple(value, [3, 4]);
      const ranks = rankProfiles[integer(row[2])];
      if (!ranks || (row[1] !== 0 && row[1] !== 1)) throw new Error("Invalid acquisition profile reference");
      const autoSlots = row.length === 4 ? autoSlotProfiles[integer(row[3])] : undefined;
      if (row.length === 4 && !autoSlots) throw new Error("Invalid automatic specialty profile reference");
      return [skill, { unlockLevel: integer(row[0], 1), autoLearn: row[1] === 1,
        ranks: ranks.map((rank) => ({ ...rank, requires: rank.requires.map((req) => ({ ...req })) })),
        ...(autoSlots ? { specialtyAutoSlots: autoSlots.map((slot) => ({ ...slot })) } : {}) }];
    }));
    return [key, { skills, boardCurrencies }];
  }));
  const specialtySlots = record(data.specialtySlots);
  return {
    schema: 1,
    source: { region: text(source.region), clientVersion: source.clientVersion === null ? null : text(source.clientVersion),
      note: text(source.note), ...(Object.hasOwn(source, "exportedAt") ? { exportedAt: text(source.exportedAt) } : {}) },
    levels, classes, specialtySlots: { core: slots(specialtySlots.core), stigma: slots(specialtySlots.stigma) },
  };
}
