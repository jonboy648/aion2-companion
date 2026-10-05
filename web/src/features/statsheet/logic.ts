import { useEffect, useState } from "react";
import { statSheet } from "@/engine/api";
import type { ArmoryRaw, StatCategory, StatRow, StatSheet, StatSource, StatSourceGroup } from "@/lib/types";

/** 1234.5 -> "1,234.5", 3.1527 -> "3.15", 0 -> "0"; percent stats get a % sign. Two decimals at most, no trailing zeros. */
export function fmtStat(value: number, unit: string): string {
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  const n = Number(value.toFixed(digits));
  return `${n.toLocaleString("en-US", { maximumFractionDigits: digits })}${unit}`;
}

/** "+12.5" / "-3": signed form used in the source list. */
export function fmtSigned(value: number, unit: string): string {
  return `${value > 0 ? "+" : ""}${fmtStat(value, unit)}`;
}

export interface SourceGroupSum {
  group: StatSourceGroup;
  name: string;
  total: number;
  /** every line in the group is an estimate or a gap-fill */
  est: boolean;
  lines: StatSource[];
}

/** The sources of one stat grouped by origin (gear, Daevanion, ...) in the engine's order, with a subtotal per group. */
export function groupSources(row: StatRow, groups: StatSheet["groups"]): SourceGroupSum[] {
  const out: SourceGroupSum[] = [];
  for (const g of groups) {
    const lines = row.sources.filter((s) => s.group === g.key);
    if (lines.length) out.push({ group: g.key, name: g.name, total: lines.reduce((a, s) => a + s.value, 0), est: lines.every((s) => s.est), lines });
  }
  return out;
}

/** A row is flagged when the armory's own number disagrees with what we could add up from known sources. */
export const isFlagged = (r: StatRow) => r.armory !== undefined && !r.armory.ok;

export function flagCount(c: StatCategory): number {
  return c.stats.filter(isFlagged).length;
}

/** Case-insensitive name filter; empty query keeps everything. Categories with no match are dropped. */
export function filterCategories(cats: StatCategory[], query: string): StatCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return cats;
  return cats.map((c) => ({ ...c, stats: c.stats.filter((s) => s.name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) })).filter((c) => c.stats.length > 0);
}

/** Plain-English line for the armory comparison under a row. */
export function armoryNote(r: StatRow): string | null {
  const a = r.armory;
  if (!a) return null;
  if (a.basis === "attribute total") {
    const known = a.known ?? 0;
    return a.ok ? `Armory ${fmtStat(a.value, "")}: matches the sources we can see.` : `Armory ${fmtStat(a.value, "")}, our known sources give ${fmtStat(known, "")} (${fmtSigned(a.diff, "")}).`;
  }
  return a.ok ? `Armory lists ${fmtStat(a.value, r.unit)} from attributes: matches.` : `Armory lists ${fmtStat(a.value, r.unit)} from attributes, we get ${fmtStat(a.value + a.diff, r.unit)}.`;
}

interface Async<T> {
  data: T | null;
  error: string | null;
  busy: boolean;
}

/** The stat sheet for an armory download. `enabled` holds the (serial) engine until the page's other work is done. */
export function useStatSheet(raw: ArmoryRaw | null, calibrate: boolean, enabled = true): Async<StatSheet> {
  const [s, setS] = useState<Async<StatSheet>>({ data: null, error: null, busy: false });
  useEffect(() => {
    if (!raw || !enabled) return;
    let live = true;
    setS((p) => ({ ...p, busy: true, error: null }));
    statSheet(raw, calibrate).then(
      (data) => live && setS({ data, error: null, busy: false }),
      (e) => live && setS({ data: null, error: e instanceof Error ? e.message : String(e), busy: false }),
    );
    return () => {
      live = false;
    };
  }, [raw, calibrate, enabled]);
  return s;
}
