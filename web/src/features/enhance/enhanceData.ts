import type { Step } from "./enhanceMath";

/** web/public/data/enhance.json (derived by app/aion2c/data/enhance_export.py; field order is in its `fields`). */
type Mats = [number, number][];
type StepRow = [number, number, number, number, Mats]; // success, pity, drop, kinah (1/10000 for the first two), materials
export type TrackKey = "enchant" | "exceed" | "surpass" | "soulbind" | "souladd";
type ItemRow = [number, string, number, string, string, string | null, string | null, string | null, string | null, string | null];

export interface EnhanceDoc {
  schema: number;
  materials: string[];
  items: ItemRow[];
  enchant: Record<string, StepRow[]>;
  exceed: Record<string, StepRow[]>;
  surpass: Record<string, StepRow[]>;
  soulbind: Record<string, { steps: [number, Mats][]; reroll: [number, Mats] }>;
  souladd: Record<string, [number, number, Mats]>;
}

export interface EnhItem {
  id: number;
  name: string;
  il: number;
  grade: string;
  slot: string;
  groups: Record<TrackKey, string | null>;
}

export const TRACKS: { key: TrackKey; label: string; level: (n: number) => string; blurb: string }[] = [
  { key: "enchant", label: "Enhance", level: (n) => `+${n}`, blurb: "Enhance Stones and kinah; the odds drop from the first risky level and each failure adds pity." },
  { key: "exceed", label: "Amplify", level: (n) => `Amp ${n}`, blurb: "Amplify Stones, after the item reaches its top enhance level." },
  { key: "surpass", label: "Potential", level: (n) => `Pot ${n}`, blurb: "Potential (Surpass) steps with Abyss Points; the client table lists no failure." },
  { key: "soulbind", label: "Soul bind", level: (n) => `Bind ${n}`, blurb: "Soul Codex cost per binding level. Success odds of binding are not in the cost table, so each step is counted once." },
  { key: "souladd", label: "Soul add", level: (n) => `Add ${n}`, blurb: "One soul-add attempt." },
];

export const SLOT_LABEL: Record<string, string> = {
  weapon: "Weapon", offhand: "Off-hand", helmet: "Helmet", shoulder: "Shoulders", torso: "Torso", gloves: "Gloves", legs: "Legs",
  boots: "Boots", cape: "Cape", belt: "Belt", necklace: "Necklace", earring: "Earring", ring: "Ring", bracelet: "Bracelet",
  amulet: "Amulet", rune: "Rune", arcana: "Arcana",
};

export function toItem(r: ItemRow): EnhItem {
  return { id: r[0], name: r[1], il: r[2], grade: r[3], slot: r[4], groups: { enchant: r[5], exceed: r[6], surpass: r[7], soulbind: r[8], souladd: r[9] } };
}

const matObj = (doc: EnhanceDoc, m: Mats): Record<string, number> => Object.fromEntries(m.map(([i, n]) => [doc.materials[i], n]));

/** The calculator's steps for one track and group, or null when the group is not in the data. Level i is step i -> i+1. */
export function stepsFor(doc: EnhanceDoc, track: TrackKey, group: string | null): Step[] | null {
  if (!group) return null;
  if (track === "enchant" || track === "exceed" || track === "surpass") {
    const rows = doc[track][group];
    return rows ? rows.map(([s, f, drop, kinah, m]) => ({ p: s / 10000, fc: f / 10000, drop, kinah, mats: matObj(doc, m) })) : null;
  }
  if (track === "soulbind") {
    const t = doc.soulbind[group];
    return t ? t.steps.map(([kinah, m]) => ({ p: 1, fc: 0, drop: 0, kinah, mats: matObj(doc, m) })) : null;
  }
  const t = doc.souladd[group];
  return t ? [{ p: t[0] / 10000, fc: 0, drop: 0, kinah: t[1], mats: matObj(doc, t[2]) }] : null;
}

/** Soul-bind reroll price (one reset), for the note under that track. */
export function rerollFor(doc: EnhanceDoc, group: string | null): { kinah: number; mats: Record<string, number> } | null {
  const t = group ? doc.soulbind[group] : undefined;
  return t ? { kinah: t.reroll[0], mats: matObj(doc, t.reroll[1]) } : null;
}

let cache: Promise<EnhanceDoc> | null = null;
/** Fetched once, on first use (435 KB); a failure is retried by the next call. */
export function loadEnhance(): Promise<EnhanceDoc> {
  cache ??= fetch(`${import.meta.env.BASE_URL ?? "/"}data/enhance.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`enhance.json: HTTP ${r.status}`);
      return r.json() as Promise<EnhanceDoc>;
    })
    .catch((e) => {
      cache = null;
      throw e;
    });
  return cache;
}

export function searchItems(items: readonly EnhItem[], q: string, limit = 12): EnhItem[] {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  const words = t.split(/\s+/);
  const hits = items.filter((i) => words.every((w) => i.name.toLowerCase().includes(w) || i.grade.toLowerCase() === w));
  return hits.sort((a, b) => b.il - a.il || a.name.localeCompare(b.name)).slice(0, limit);
}

/** First level whose odds are below 100% (where gear starts to fail), or 0. */
export const firstRiskyLevel = (steps: readonly Step[]): number => Math.max(0, steps.findIndex((s) => s.p < 1));

/** 1,234 / 12.3K / 4.56M for big numbers; whole numbers below 1000, two decimals below 10. */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return "never";
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  if (a >= 100) return Math.round(n).toLocaleString("en-US");
  return a >= 10 ? n.toFixed(1) : n.toFixed(2);
}
