/** Pure item database logic: stat labels, table columns, filtering, sorting, compare and category / id lookup. */
import labels from "./statLabels.json";
import index from "../../../public/items/index.json";

export interface ItemRow {
  id: number;
  n: string;
  g: string;
  /** item level (equipment only) */
  il?: number;
  el: number;
  /** description (consumables, materials, currency) */
  d?: string;
  /** CDN resource name */
  i?: string;
  /** alternate icon name, tried when `i` does not load */
  i2?: string;
  /** class lock (weapons) */
  c?: string;
  /** main stats {stat: value}; WeaponFixingDamage is the max attack */
  m: Record<string, number>;
  /** min attack (weapons) */
  mn?: number;
  /** best roll of a few random-line stats */
  p?: Record<string, number>;
  /** category key, added on load */
  cat: string;
}

export interface Stat {
  id: string;
  v: number;
  min?: number;
  w?: number;
  slope?: number;
}

export interface ItemDetail {
  id: number;
  name: string;
  slot: string;
  grade: string;
  il: number;
  equip_level: number;
  class_lock: string[];
  max_enchant: number;
  main: Stat[];
  subs: Stat[];
  sub_random: boolean;
  sub_count: number;
  mana_slots: number;
  god_slots: number;
  sources: string[];
  icon?: string;
  icon_alt?: string;
  max_exceed?: number;
  enchant_group?: string;
  odds_group?: string;
  exceed_group?: string;
  set?: string;
}

export interface EnchantTables {
  series: Record<string, Record<string, number[]>>;
  odds: Record<string, number[]>;
  exceed: Record<string, { odds: number[]; levels: Record<string, number>[] }>;
}

export interface CatInfo {
  key: string;
  label: string;
  count: number;
}
export interface GroupInfo {
  key: string;
  label: string;
  /** gear = equipment (has stats, enchant tables); misc = consumables, materials, currency; sets = item sets */
  kind: "gear" | "misc" | "sets";
  cats: CatInfo[];
  /** sets group only */
  count?: number;
}

export const INDEX = index as unknown as { source: string; groups: GroupInfo[]; runs: [number, number, string][] };
export const CATS: CatInfo[] = INDEX.groups.flatMap((g) => g.cats);
export const GEAR_KEYS: string[] = INDEX.groups.filter((g) => g.kind === "gear").flatMap((g) => g.cats.map((c) => c.key));
export const TOTAL = CATS.filter((c) => GEAR_KEYS.includes(c.key)).reduce((n, c) => n + c.count, 0);
export const OTHER_TOTAL = CATS.reduce((n, c) => n + c.count, 0) - TOTAL;

export const catLabel = (key: string) => CATS.find((c) => c.key === key)?.label ?? key;
export const groupOfCat = (key: string) => INDEX.groups.find((g) => g.cats.some((c) => c.key === key));
export const isGearCat = (key: string) => GEAR_KEYS.includes(key);

export interface ItemSet {
  key: string;
  name: string;
  icon: string;
  type: string;
  bonuses: { pieces: number; name: string; text: string; stats?: Record<string, number> }[];
  items: { id: number; n: string; g: string; i?: string; cat: string }[];
}

/** What a /items/:key URL segment means. */
export function resolveKey(
  key: string | undefined,
): { kind: "root" } | { kind: "sets" } | { kind: "group"; group: GroupInfo } | { kind: "cat"; cat: CatInfo } | { kind: "item"; id: number } | { kind: "unknown" } {
  if (!key) return { kind: "root" };
  if (/^\d+$/.test(key)) return { kind: "item", id: Number(key) };
  if (INDEX.groups.some((g) => g.key === key && g.kind === "sets")) return { kind: "sets" };
  const group = INDEX.groups.find((g) => g.key === key);
  if (group) return { kind: "group", group };
  const cat = CATS.find((c) => c.key === key);
  return cat ? { kind: "cat", cat } : { kind: "unknown" };
}

/** Category key of an item id (the index stores id-sorted runs), or null for an id we do not have. */
export function catOfId(id: number, runs = INDEX.runs): string | null {
  let lo = 0;
  let hi = runs.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [a, b, cat] = runs[mid];
    if (id < a) hi = mid - 1;
    else if (id > b) lo = mid + 1;
    else return cat; // any real id between a run's ends is in that run; the detail file lookup rejects ids that do not exist
  }
  return null;
}

export const ICON_CDN = "https://assets.playnccdn.com/static-aion2-gamedata/resources/";
export const iconUrl = (name?: string) => (name ? `${ICON_CDN}${name}.png` : null);

export const GRADES = ["Special", "Common", "Rare", "Unique", "Epic", "Heroic"] as const;
export const GRADE_RANK: Record<string, number> = Object.fromEntries(GRADES.map((g, i) => [g, i]));

const LABELS: Record<string, string> = labels;
/** Readable name of a client stat id ("CriticalAddDamage" has a label; unknown ids are split at capitals). */
export const statLabel = (id: string) => LABELS[id] ?? id.replace(/([a-z])([A-Z])/g, "$1 $2");

export interface Column {
  key: string;
  label: string;
  /** numeric value to sort / compare by (undefined = not applicable) */
  get: (r: ItemRow) => number | string | undefined;
  /** text; defaults to the value */
  fmt?: (r: ItemRow) => string;
  /** left aligned text column */
  text?: boolean;
  /** stat column the visitor can switch on and off */
  stat?: boolean;
  title?: string;
}

const num = (n: number | undefined) => (n === undefined ? "" : Number.isInteger(n) ? n.toLocaleString("en-US") : String(Math.round(n * 100) / 100));
const main = (id: string) => (r: ItemRow) => r.m[id];
const roll = (id: string) => (r: ItemRow) => r.p?.[id];

export const COLUMNS: Column[] = [
  { key: "name", label: "Item", get: (r) => r.n, text: true },
  { key: "grade", label: "Grade", get: (r) => GRADE_RANK[r.g] ?? -1, fmt: (r) => r.g, text: true },
  { key: "cat", label: "Type", get: (r) => catLabel(r.cat), text: true },
  { key: "class", label: "Class", get: (r) => r.c, text: true },
  { key: "el", label: "Level", get: (r) => r.el, stat: true, title: "Required character level" },
  { key: "il", label: "Item level", get: (r) => r.il, stat: true },
  { key: "atk", label: "Attack", get: main("WeaponFixingDamage"), stat: true, title: "Max attack at +0" },
  { key: "atkmin", label: "Min attack", get: (r) => r.mn, stat: true },
  { key: "acc", label: "Accuracy", get: main("WeaponAccuracy"), stat: true },
  { key: "crit", label: "Critical", get: main("Critical"), stat: true },
  { key: "block", label: "Block", get: main("Block"), stat: true },
  { key: "def", label: "Defense", get: main("ArmorDefense"), stat: true },
  { key: "hp", label: "HP", get: main("HPMax"), stat: true },
  { key: "dmgboost", label: "Damage boost", get: roll("AmplifyAllDamage"), stat: true, title: "Best the random line can roll (%)" },
  { key: "wdmgboost", label: "Weapon dmg boost", get: roll("AmplifyWeaponDamage"), stat: true, title: "Best the random line can roll (%)" },
  { key: "critdmg", label: "Crit damage", get: roll("CriticalAddDamage"), stat: true, title: "Best the random line can roll" },
  { key: "speed", label: "Combat speed", get: roll("CombatSpeed"), stat: true, title: "Best the random line can roll (%)" },
  { key: "hitrate", label: "Hit rate", get: roll("AdditionalHitRate"), stat: true, title: "Best the random line can roll (%)" },
  { key: "desc", label: "Description", get: (r) => r.d, text: true },
];
for (const c of COLUMNS) if (!c.fmt) c.fmt = (r) => (typeof c.get(r) === "number" ? num(c.get(r) as number) : String(c.get(r) ?? ""));
export const COLUMN = Object.fromEntries(COLUMNS.map((c) => [c.key, c])) as Record<string, Column>;
export const STAT_COLUMNS = COLUMNS.filter((c) => c.stat);
export const DEFAULT_COLUMNS = ["el", "il", "atk", "acc", "crit", "block", "def", "hp"];

/** Columns worth showing for these rows: the identity columns that vary plus every stat column some row has a value for. */
export function columnsFor(rows: ItemRow[]): string[] {
  const has = (k: string) => rows.some((r) => COLUMN[k].get(r) !== undefined);
  const out = ["grade"];
  if (new Set(rows.map((r) => r.cat)).size > 1) out.push("cat");
  if (has("class")) out.push("class");
  return [...out, ...["el", "il", "atk", "atkmin", "acc", "crit", "block", "def", "hp", "desc"].filter(has)];
}

export interface Filters {
  q: string;
  grades: string[];
  elMin?: number;
  elMax?: number;
  ilMin?: number;
  ilMax?: number;
  cls: string;
  cats?: string[];
}
export const NO_FILTERS: Filters = { q: "", grades: [], cls: "" };

export function filterRows(rows: ItemRow[], f: Filters): ItemRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || r.n.toLowerCase().includes(q) || String(r.id).startsWith(q)) &&
      (!f.grades.length || f.grades.includes(r.g)) &&
      (f.elMin === undefined || r.el >= f.elMin) &&
      (f.elMax === undefined || r.el <= f.elMax) &&
      (f.ilMin === undefined || (r.il !== undefined && r.il >= f.ilMin)) &&
      (f.ilMax === undefined || (r.il !== undefined && r.il <= f.ilMax)) &&
      (!f.cls || r.c === f.cls) &&
      (!f.cats?.length || f.cats.includes(r.cat)),
  );
}

export interface Sort {
  key: string;
  dir: "asc" | "desc";
}

/** Stable sort by a column; items with no value for it always go last. Ties fall back to name then id. */
export function sortRows(rows: ItemRow[], sort: Sort): ItemRow[] {
  const col = COLUMN[sort.key];
  if (!col) return rows;
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = col.get(a);
    const y = col.get(b);
    if (x === undefined && y === undefined) return a.n.localeCompare(b.n) || a.id - b.id;
    if (x === undefined) return 1;
    if (y === undefined) return -1;
    const d = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return d ? d * sign : a.n.localeCompare(b.n) || a.id - b.id;
  });
}

/** Next sort when a header is clicked: a new column starts descending for numbers, ascending for text; same column flips. */
export function nextSort(cur: Sort, key: string): Sort {
  if (cur.key === key) return { key, dir: cur.dir === "asc" ? "desc" : "asc" };
  return { key, dir: COLUMN[key]?.text ? "asc" : "desc" };
}

export const MAX_PINS = 4;

/** Add or remove an id from the pinned list (capped at MAX_PINS; a full list ignores the add). */
export function togglePin(pins: number[], id: number): number[] {
  if (pins.includes(id)) return pins.filter((p) => p !== id);
  return pins.length >= MAX_PINS ? pins : [...pins, id];
}

export const parsePins = (s: string | null): number[] =>
  [...new Set((s ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAX_PINS);

export interface CompareLine {
  col: Column;
  values: (number | string | undefined)[];
  /** indexes holding the highest numeric value (only when at least two items have a value and they differ) */
  best: number[];
}

/** Side-by-side table for pinned items: one line per column, flagging the best value. Lines where nothing has a value are dropped. */
export function compare(rows: ItemRow[], columns: Column[]): CompareLine[] {
  const out: CompareLine[] = [];
  for (const col of columns) {
    const values = rows.map((r) => col.get(r));
    if (values.every((v) => v === undefined)) continue;
    const nums = values.filter((v): v is number => typeof v === "number");
    const top = Math.max(...nums);
    const distinct = new Set(nums).size > 1;
    out.push({ col, values, best: distinct ? values.flatMap((v, i) => (v === top ? [i] : [])) : [] });
  }
  return out;
}

/** Value of a stat at a given enchant level: base + the series bonus at that level (level 0 = base). */
export function atEnchant(base: number, series: number[] | undefined, level: number): number {
  if (!series || level <= 0) return base;
  return Math.round((base + series[Math.min(level, series.length) - 1]) * 100) / 100;
}

export const fmtNum = num;
