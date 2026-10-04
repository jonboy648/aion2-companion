import type { SimResult } from "@/lib/types";

export interface DamageDatum {
  key: string;
  label: string;
  damage: number;
  share: number;
}

export function damageBreakdown(
  result: SimResult,
  names: Readonly<Record<string, string>>,
  limit?: number,
): DamageDatum[] | null {
  const total = result.total_damage;
  if (!Number.isFinite(total) || total < 0) return null;
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 0)) return null;
  let sum = 0;
  const rows: DamageDatum[] = [];
  for (const [key, tally] of Object.entries(result.per_skill)) {
    const damage = tally.damage;
    if (!Number.isFinite(damage) || damage < 0) return null;
    sum += damage;
    if (damage === 0) continue;
    const readable = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim();
    const label = Object.hasOwn(names, key) && names[key].trim()
      ? names[key]
      : readable ? readable.charAt(0).toUpperCase() + readable.slice(1) : "Unknown skill";
    rows.push({ key, label, damage, share: total > 0 ? damage / total : 0 });
  }
  if (!Number.isFinite(sum) || Math.abs(sum - total) > Math.max(1e-6, 1e-9 * Math.abs(total))) return null;
  if (total === 0) return [];
  rows.sort((a, b) => b.damage - a.damage);
  if (limit === undefined || rows.length <= limit) return rows;
  const retained = rows.slice(0, limit);
  const omitted = rows.slice(limit).reduce((value, row) => value + row.damage, 0);
  // Keep aggregation keys distinct from real skills named "other".
  let key = "other";
  while (Object.hasOwn(result.per_skill, key)) key = `_${key}`;
  retained.push({ key, label: "Other", damage: omitted, share: omitted / total });
  return retained;
}
