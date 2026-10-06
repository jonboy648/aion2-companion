import type { CharacterBuild, Stats } from "@/lib/types";

/** Mirrors aion2c.models.BASELINE_L45_STATS (typical level-45 profile; crit 15% is an estimate). */
export const DEFAULT_STATS: Stats = {
  attack: 550,
  attack_increase_pct: 1.6,
  weapon_dmg_pct: 0,
  dmg_boost_pct: 0,
  pve_dmg_pct: 0,
  boss_dmg_pct: 0,
  crit_chance_pct: 15,
  crit_dmg_pct: 50,
  smite_pct: 0,
  combat_speed_pct: 3.8,
  cdr_pct: 0.1,
  max_mp: 1000,
  mp_regen_per_s: 20,
  target_defense: 0,
  penetration: 0,
};

export interface StatField {
  key: keyof Stats;
  label: string;
  hint?: string;
  step: number;
  advanced?: boolean;
}

export const STAT_FIELDS: StatField[] = [
  { key: "attack", label: "Attack", hint: "Weapon attack: middle of the Max and Min Attack on your sheet, before Amp Ratio", step: 10 },
  { key: "attack_increase_pct", label: "Attack increase %", step: 0.1 },
  { key: "weapon_dmg_pct", label: "Weapon damage %", step: 0.1 },
  { key: "dmg_boost_pct", label: "Damage boost %", step: 0.1 },
  { key: "crit_chance_pct", label: "Crit chance %", step: 0.1 },
  { key: "crit_dmg_pct", label: "Crit damage %", step: 1 },
  { key: "combat_speed_pct", label: "Combat speed %", step: 0.1 },
  { key: "cdr_pct", label: "Cooldown reduction %", step: 0.1 },
  { key: "max_mp", label: "Max MP", step: 50 },
  { key: "mp_regen_per_s", label: "MP regen per second", step: 1 },
  { key: "pve_dmg_pct", label: "PvE damage %", step: 0.1, advanced: true },
  { key: "boss_dmg_pct", label: "Boss damage %", step: 0.1, advanced: true },
  { key: "smite_pct", label: "Smite %", step: 0.1, advanced: true },
  { key: "target_defense", label: "Target defense", step: 10, advanced: true },
  { key: "penetration", label: "Penetration", step: 10, advanced: true },
];

export interface ManualForm {
  classKey: string;
  level: string;
  stats: Record<keyof Stats, string>;
}

export function initialForm(classKey: string): ManualForm {
  const stats = Object.fromEntries(Object.entries(DEFAULT_STATS).map(([k, v]) => [k, String(v)])) as Record<keyof Stats, string>;
  return { classKey, level: "50", stats };
}

const num = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Validate the form. Returns the build, or a list of human-readable problems. */
export function buildFromForm(form: ManualForm, levelCap: number): { build: CharacterBuild } | { errors: string[] } {
  const errors: string[] = [];
  const level = num(form.level);
  if (level == null || !Number.isInteger(level) || level < 1 || level > levelCap) errors.push(`Level must be a whole number from 1 to ${levelCap}.`);
  const stats = { ...DEFAULT_STATS };
  for (const f of STAT_FIELDS) {
    const v = num(form.stats[f.key]);
    if (v == null || v < 0) errors.push(`${f.label} must be a number, 0 or more.`);
    else stats[f.key] = v;
  }
  if (errors.length) return { errors };
  return {
    build: {
      name: "Manual build",
      region: "global",
      level: level as number,
      skill_ranks: {},
      stigmas: [],
      specs: {},
      stats,
      show_kr: false,
      daevanion_nodes: [],
      skill_points: null,
      stigma_points: null,
      class_key: form.classKey,
      bonus_ranks: {},
      stigma_unlocked: null,
    },
  };
}
