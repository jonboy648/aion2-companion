import type { ArmoryRegion, ArmorySearchHit, ClassRole, CompareResult, FullBuild, PlaystyleKey, Stats } from "@/lib/types";

export const PLAYSTYLE_ORDER: PlaystyleKey[] = ["boss", "aoe", "leveling", "burst"];

/** Item grade -> colour (DESIGN.md rarity palette, extended for the grades the armory returns). */
export const GRADE_COLOR: Record<string, string> = {
  common: "#9aa3b8",
  rare: "#4cc38a",
  epic: "#4a9df0",
  heroic: "#b07cf0",
  legend: "#f0922f",
  unique: "#f0922f",
  ultimate: "#ef5f6b",
};

export function gradeColor(grade: string): string {
  return GRADE_COLOR[grade.trim().toLowerCase()] ?? GRADE_COLOR.common;
}

/** "MainHand" -> "Main hand", "Earring2" -> "Earring 2". */
export function slotLabel(slot: string): string {
  const spaced = slot.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Za-z])(\d)/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

const STAT_LABELS: Record<keyof Stats, string> = {
  attack: "Attack",
  attack_increase_pct: "Attack increase",
  weapon_dmg_pct: "Weapon damage",
  dmg_boost_pct: "Damage boost",
  pve_dmg_pct: "PvE damage",
  boss_dmg_pct: "Boss damage",
  crit_chance_pct: "Crit chance",
  crit_dmg_pct: "Crit damage",
  smite_pct: "Smite",
  combat_speed_pct: "Combat speed",
  cdr_pct: "Cooldown reduction",
  max_mp: "Max MP",
  mp_regen_per_s: "MP regen / s",
  target_defense: "Target defense",
  penetration: "Penetration",
};

export function statLabel(stat: string): string {
  return STAT_LABELS[stat as keyof Stats] ?? stat.replace(/_pct$/, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** "+1%" for *_pct stats, "+10" for flat ones. */
export function statDelta(stat: string, delta: number): string {
  const n = Number.isInteger(delta) ? String(delta) : delta.toFixed(1);
  return `+${n}${stat.endsWith("_pct") ? "%" : ""}`;
}

export const fmtDps = (n: number): string => Math.round(n).toLocaleString("en-US");

export function fmtPct(n: number, digits = 1): string {
  const v = n.toFixed(digits);
  return `${n > 0 ? "+" : ""}${v}%`;
}

export function skillName(gdSkills: Record<string, { name: string }> | undefined, key: string): string {
  return gdSkills?.[key]?.name ?? key.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** The highest-DPS playstyle's DPS; used to scale the comparison bars. */
export function maxDps(cmp: CompareResult): number {
  return Math.max(1, ...PLAYSTYLE_ORDER.map((k) => cmp[k]?.result.dps ?? 0));
}

export interface RotationRow {
  skillKey: string;
  chargeLevel: number;
  requireStatus: string | null;
  casts: number;
  damageShare: number;
}

/** Rotation entries joined with the simulator tally (casts and share of total damage). */
export function rotationRows(fb: FullBuild): RotationRow[] {
  const total = fb.result.total_damage || 0;
  return fb.priority.entries.map((e) => {
    const tally = fb.result.per_skill[e.skill_key];
    return {
      skillKey: e.skill_key,
      chargeLevel: e.charge_level,
      requireStatus: e.require_status,
      casts: tally?.casts ?? 0,
      damageShare: total > 0 && tally ? (tally.damage / total) * 100 : 0,
    };
  });
}

/** Short human note for one rotation row: from the data rule note when present, else derived from the numbers. */
export function roleNote(row: RotationRow, ruleNote: string | undefined, tags: string[] | undefined): string {
  // data-team notes that talk about data provenance ("dump description", "unknown") are for developers, not players
  if (ruleNote && ruleNote.trim() && !/dump|unverified|unknown|estimate|client/i.test(ruleNote)) return ruleNote.trim();
  if (row.casts === 0) return "Never cast in the simulated window.";
  if (row.damageShare < 0.5) {
    const t = tags?.includes("buff") ? "Buff" : tags?.includes("debuff") ? "Setup" : "Utility";
    return `${t}: ${row.casts} cast${row.casts === 1 ? "" : "s"}, adds no direct damage.`;
  }
  return `${row.casts} casts, ${row.damageShare.toFixed(0)}% of damage.`;
}

// ---- recent searches (per-viewer convenience; storage can be blocked, so every call is guarded) ----

export interface RecentSearch {
  name: string;
  region: ArmoryRegion;
  serverId: number | string;
  serverName: string;
  level: number | null;
}

const RECENT_KEY = "becomecube.recent.v1";
const RECENT_MAX = 6;

export function loadRecent(): RecentSearch[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? (v as RecentSearch[]).filter((r) => r && typeof r.name === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function saveRecent(entry: RecentSearch): RecentSearch[] {
  const next = [entry, ...loadRecent().filter((r) => !(r.name === entry.name && String(r.serverId) === String(entry.serverId)))].slice(0, RECENT_MAX);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode / blocked storage: just don't remember */
  }
  return next;
}

export function clearRecent(): void {
  try {
    window.localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore */
  }
}

export const hitToRecent = (h: ArmorySearchHit): RecentSearch => ({
  name: h.name,
  region: h.region as ArmoryRegion,
  serverId: h.serverId ?? 0,
  serverName: h.serverName,
  level: h.level,
});

export const characterPath = (r: { region: string; serverId: number | string; name: string }): string =>
  `/c/${r.region}/${r.serverId}/${encodeURIComponent(r.name)}`;

export const ROLE_LABEL: Record<ClassRole, string> = {
  melee_dps: "Melee DPS",
  ranged_dps: "Ranged DPS",
  tank: "Tank",
  healer: "Healer",
  support: "Support",
};
