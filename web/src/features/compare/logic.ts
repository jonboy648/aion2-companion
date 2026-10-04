import type { ArmoryRegion, CharacterBuild, DaevanionBoardSummary, GearItem, ImportedStigma, ImportResult } from "@/lib/types";

export type Side = "a" | "b";
export type Winner = Side | "tie";

// ---- URL triplets: one path segment "region~serverId~name" per character ----

export interface Triplet {
  region: ArmoryRegion;
  serverId: string;
  name: string;
}

export const EMPTY_SLOT = "-";

export const tripletParam = (t: Triplet): string => encodeURIComponent([t.region, t.serverId, t.name].join("~"));

/** Parse a route param. Returns null for "-", blanks and anything that is not region~serverId~name. */
export function parseTriplet(param: string | undefined): Triplet | null {
  if (!param || param === EMPTY_SLOT) return null;
  let s = param;
  try {
    s = decodeURIComponent(param);
  } catch {
    /* router already decoded it */
  }
  const i = s.indexOf("~");
  const j = s.indexOf("~", i + 1);
  if (i < 1 || j < 0) return null;
  const region = s.slice(0, i);
  const serverId = s.slice(i + 1, j);
  const name = s.slice(j + 1);
  return region && serverId && name ? { region: region as ArmoryRegion, serverId, name } : null;
}

export const comparePath = (a: Triplet | null, b: Triplet | null): string =>
  `/compare/${a ? tripletParam(a) : EMPTY_SLOT}/${b ? tripletParam(b) : EMPTY_SLOT}`;

// ---- comparisons ----

const GRADES = ["common", "rare", "epic", "unique", "heroic", "legend", "legendary", "ultimate"];
export const gradeRank = (g: string | null | undefined): number => {
  const i = GRADES.indexOf((g ?? "").trim().toLowerCase());
  return i < 0 ? 0 : i === 6 ? 5 : i === 7 ? 6 : i;
};

/** Higher grade wins, then enchant, then exceed. The armory gives no per-slot item level, so this is the per-slot proxy. */
export function gearScore(g: GearItem | undefined): number {
  return g ? gradeRank(g.grade) * 1e6 + g.enchant * 1e3 + g.exceed : -1;
}

export function better(a: number | null | undefined, b: number | null | undefined): Winner {
  const x = a ?? -Infinity;
  const y = b ?? -Infinity;
  return x === y ? "tie" : x > y ? "a" : "b";
}

export interface GearRow {
  slot: string;
  a?: GearItem;
  b?: GearItem;
  winner: Winner;
}

/** Slots in A's order, then any slot only B has. */
export function gearRows(a: GearItem[], b: GearItem[]): GearRow[] {
  const slots = [...a.map((g) => g.slot), ...b.map((g) => g.slot).filter((s) => !a.some((g) => g.slot === s))];
  return slots.map((slot) => {
    const ga = a.find((g) => g.slot === slot);
    const gb = b.find((g) => g.slot === slot);
    return { slot, a: ga, b: gb, winner: better(gearScore(ga), gearScore(gb)) };
  });
}

export interface RankRow {
  key: string;
  a: number;
  b: number;
  /** b - a: positive = B is higher */
  diff: number;
}

/** Union of both rank maps; missing = 0. Largest gap first, then alphabetical. */
export function rankRows(a: Record<string, number>, b: Record<string, number>): RankRow[] {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return keys
    .map((key) => ({ key, a: a[key] ?? 0, b: b[key] ?? 0, diff: (b[key] ?? 0) - (a[key] ?? 0) }))
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff) || x.key.localeCompare(y.key));
}

export interface StigmaRow {
  name: string;
  a?: ImportedStigma;
  b?: ImportedStigma;
}

export function stigmaRows(a: ImportedStigma[], b: ImportedStigma[]): StigmaRow[] {
  const names = [...new Set([...a.map((s) => s.name), ...b.map((s) => s.name)])];
  return names.map((name) => ({ name, a: a.find((s) => s.name === name), b: b.find((s) => s.name === name) }));
}

export interface BoardRow {
  board: string;
  a?: DaevanionBoardSummary;
  b?: DaevanionBoardSummary;
}

export function boardRows(a: DaevanionBoardSummary[], b: DaevanionBoardSummary[]): BoardRow[] {
  const names = [...new Set([...a.map((x) => x.board), ...b.map((x) => x.board)])];
  return names.map((board) => ({ board, a: a.find((x) => x.board === board), b: b.find((x) => x.board === board) }));
}

/** "+3", "-2" or "even". */
export const fmtDiff = (d: number): string => (d === 0 ? "even" : d > 0 ? `+${d}` : String(d));

/** Percent difference of b over a, e.g. "+12.4%". Null when a is missing or zero. */
export function pctDiff(a: number | null | undefined, b: number | null | undefined): string | null {
  if (!a || b == null) return null;
  const p = ((b - a) / a) * 100;
  return `${p > 0 ? "+" : ""}${p.toFixed(1)}%`;
}

// ---- copy their build ----

export const TARGET_PLAN_KEY = "aion2c.targetPlan.v1";

export interface TargetPlan {
  /** who the plan was copied from */
  from: string;
  copiedAt: string;
  build: CharacterBuild;
}

export type CopyResult = { ok: true; plan: TargetPlan; warnings: string[] } | { ok: false; reason: string };

/**
 * The other character's stigmas, skill-rank targets and Daevanion nodes laid over `mine` (level, stats and unspent
 * points stay yours). Needs the same class, because skill keys are per class. With no `mine`, the plan is theirs outright.
 */
export function buildCopyPlan(mine: ImportResult | null, theirs: ImportResult, now = new Date()): CopyResult {
  const t = theirs.build;
  if (mine && mine.build.class_key !== t.class_key) {
    return { ok: false, reason: `${theirs.profile.name} plays ${theirs.profile.class_name}; skill ranks only carry over within the same class.` };
  }
  const warnings: string[] = [];
  const base = mine?.build ?? t;
  if (mine && t.level > mine.build.level) warnings.push(`Their level (${t.level}) is above yours (${mine.build.level}); some ranks may not be reachable yet.`);
  const build: CharacterBuild = {
    ...base,
    name: `Target: ${theirs.profile.name}`,
    skill_ranks: { ...t.skill_ranks },
    stigmas: [...t.stigmas],
    specs: structuredClone(t.specs),
    daevanion_nodes: [...t.daevanion_nodes],
  };
  return { ok: true, plan: { from: theirs.profile.name, copiedAt: now.toISOString(), build }, warnings };
}
