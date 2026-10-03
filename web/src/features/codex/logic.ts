import type { Confidence, GameData, Link, Num, Skill, SkillKind } from "@/lib/types";

export type KindFilter = "all" | "active" | "passive" | "stigma" | "chain" | "other";

export const KIND_FILTERS: { key: KindFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "passive", label: "Passive" },
  { key: "stigma", label: "Stigma" },
  { key: "chain", label: "Chain" },
  { key: "other", label: "Other" },
];

/** Skill kinds that fall under the "Other" filter. */
const OTHER_KINDS: SkillKind[] = ["proc", "charge_tier", "system", "dodge"];

export const KIND_LABEL: Record<SkillKind, string> = {
  active: "Active",
  passive: "Passive",
  stigma: "Stigma",
  chain: "Chain",
  proc: "Proc",
  charge_tier: "Charge tier",
  system: "System",
  dodge: "Dodge",
};

const KIND_ORDER: SkillKind[] = ["active", "chain", "charge_tier", "stigma", "passive", "proc", "dodge", "system"];

export function matchesKind(s: Skill, f: KindFilter): boolean {
  if (f === "all") return true;
  if (f === "other") return OTHER_KINDS.includes(s.kind);
  return s.kind === f;
}

export function matchesQuery(s: Skill, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return [s.name, s.name_kr ?? "", s.key, s.description, ...s.tags].some((x) => x.toLowerCase().includes(t));
}

/** Skills for the grid: filtered, then grouped by kind, unlock level, name. */
export function filterSkills(gd: GameData, kind: KindFilter, query: string): Skill[] {
  return Object.values(gd.skills)
    .filter((s) => matchesKind(s, kind) && matchesQuery(s, query))
    .sort(
      (a, b) =>
        KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
        (a.unlock_level ?? 999) - (b.unlock_level ?? 999) ||
        a.name.localeCompare(b.name),
    );
}

export function kindCounts(gd: GameData): Record<KindFilter, number> {
  const out: Record<KindFilter, number> = { all: 0, active: 0, passive: 0, stigma: 0, chain: 0, other: 0 };
  for (const s of Object.values(gd.skills)) {
    out.all++;
    out[OTHER_KINDS.includes(s.kind) ? "other" : (s.kind as KindFilter)]++;
  }
  return out;
}

/** Links touching this skill, split into what comes before and after. */
export function skillLinks(gd: GameData, key: string): { parents: Link[]; children: Link[] } {
  return {
    parents: gd.links.filter((l) => l.child_key === key),
    children: gd.links.filter((l) => l.parent_key === key),
  };
}

const CONF_MARK: Record<Confidence, string> = { confirmed: "", estimated: "~", unknown: "?" };

/** "12 s" / "~1.0 s" / "?"; the mark carries the confidence so colour is never the only signal. */
export function fmtNum(n: Num | null | undefined, unit = "", digits = 1): string {
  if (!n || n.value === null) return "?";
  const v = Number.isInteger(n.value) ? String(n.value) : n.value.toFixed(digits);
  return `${CONF_MARK[n.confidence]}${v}${unit ? ` ${unit}` : ""}`;
}

/** Cooldown / MP of a skill at rank 1 for the grid cards. */
export function cardLine(s: Skill): string {
  const r = s.ranks[0];
  const parts: string[] = [];
  if (r?.cooldown_s.value) parts.push(`CD ${fmtNum(r.cooldown_s, "s")}`);
  if (r?.mp_cost.value != null && r.mp_cost.value > 0) parts.push(`MP ${fmtNum(r.mp_cost)}`);
  if (s.range_m) parts.push(`${s.range_m} m`);
  return parts.join(" - ");
}
