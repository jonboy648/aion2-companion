/**
 * Pure Daevanion planner logic. A faithful TS port of the adjacency rule in app/aion2c/daevanion.py:
 * a node is selectable iff any id in its `adjacent` is the board's start node or an already selected node.
 */
import type { CharacterBuild, DaevanionBoard, DaevanionNode, GameData } from "@/lib/types";

export const SKILL_BONUS_CAP = 4; // Daevanion adds at most +4 ranks per skill

export const RARITY_COLORS: Record<string, string> = {
  common: "#9aa3b8", // grey
  rare: "#4cc38a", // green
  epic: "#4a9df0", // blue
  unique: "#f0922f", // orange
  legend: "#f0922f",
  legendary: "#f0922f",
};

export function rarityColor(rarity: string): string {
  return RARITY_COLORS[rarity.toLowerCase()] ?? RARITY_COLORS.common;
}

export const nodeList = (b: DaevanionBoard): DaevanionNode[] => Object.values(b.nodes);

/** Unselected, non-start nodes with at least one neighbour that is the start or selected. */
export function selectable(board: DaevanionBoard, selected: ReadonlySet<number>): Set<number> {
  const out = new Set<number>();
  for (const node of nodeList(board)) {
    if (node.id === board.start_id || selected.has(node.id)) continue;
    if (node.adjacent.some((a) => a === board.start_id || selected.has(a))) out.add(node.id);
  }
  return out;
}

/** True iff every selected node of this board is connected to the start through selected nodes. */
export function isValid(board: DaevanionBoard, selected: ReadonlySet<number>): boolean {
  const mine = new Set<number>();
  for (const n of selected) {
    if (n === board.start_id) continue;
    if (board.nodes[String(n)]) mine.add(n);
  }
  const reached = new Set<number>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of mine) {
      if (reached.has(n)) continue;
      if (board.nodes[String(n)].adjacent.some((a) => a === board.start_id || reached.has(a))) {
        reached.add(n);
        grew = true;
      }
    }
  }
  return reached.size === mine.size;
}

/** A selected node can be removed iff the rest of its board stays connected to the start. */
export function removable(board: DaevanionBoard, selected: ReadonlySet<number>, id: number): boolean {
  if (id === board.start_id || !selected.has(id)) return false;
  const rest = new Set(selected);
  rest.delete(id);
  return isValid(board, rest);
}

export type NodeState = "start" | "selected" | "available" | "locked";

export function nodeState(board: DaevanionBoard, selected: ReadonlySet<number>, avail: ReadonlySet<number>, id: number): NodeState {
  if (id === board.start_id) return "start";
  if (selected.has(id)) return "selected";
  return avail.has(id) ? "available" : "locked";
}

export function nodeIndex(gd: GameData): Map<number, DaevanionNode & { board: string }> {
  const idx = new Map<number, DaevanionNode & { board: string }>();
  for (const [key, b] of Object.entries(gd.daevanion)) for (const n of nodeList(b)) idx.set(n.id, { ...n, board: key });
  return idx;
}

/** Selected (non-start) nodes that sit on this board. */
export function boardSelection(board: DaevanionBoard, selected: ReadonlySet<number>): number[] {
  return nodeList(board)
    .filter((n) => n.id !== board.start_id && selected.has(n.id))
    .map((n) => n.id);
}

export function boardTotal(board: DaevanionBoard): number {
  return nodeList(board).filter((n) => n.id !== board.start_id).length;
}

export function pointsSpent(gd: GameData, selected: ReadonlySet<number>): number {
  const idx = nodeIndex(gd);
  let sum = 0;
  for (const n of selected) sum += idx.get(n)?.cost ?? 0;
  return sum;
}

export interface StatTotal {
  stat: string;
  value: number;
  unit: string;
}

/** Running stat totals over the selected nodes, grouped by stat + unit. */
export function statTotals(gd: GameData, selected: ReadonlySet<number>): StatTotal[] {
  const idx = nodeIndex(gd);
  const acc = new Map<string, StatTotal>();
  for (const id of selected) {
    for (const e of idx.get(id)?.effects ?? []) {
      const k = `${e.stat}|${e.unit}`;
      const cur = acc.get(k) ?? { stat: e.stat, value: 0, unit: e.unit };
      cur.value += e.value;
      acc.set(k, cur);
    }
  }
  return [...acc.values()].sort((a, b) => a.stat.localeCompare(b.stat));
}

/** Selected skill nodes per skill key, capped at +4 (mirrors daevanion.skill_bonus). */
export function skillBonuses(gd: GameData, selected: ReadonlySet<number>): Record<string, number> {
  const idx = nodeIndex(gd);
  const out: Record<string, number> = {};
  for (const id of selected) {
    const k = idx.get(id)?.skill_key;
    if (k) out[k] = Math.min(SKILL_BONUS_CAP, (out[k] ?? 0) + 1);
  }
  return out;
}

export function formatEffect(value: number, unit: string): string {
  const v = Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  if (unit === "%") return `+${v}%`;
  return `+${v}`;
}

/** Board is open to the player when their level reaches its unlock level. */
export const boardUnlocked = (b: DaevanionBoard, level: number): boolean => level >= b.unlock_level;

/**
 * Stand-in build for the planner when nobody imported a character. Stats are the engine's own defaults
 * (models.Stats) so "Max power path" still returns a sensible order.
 */
export function plannerBuild(gd: GameData, level: number, nodes: Iterable<number>): CharacterBuild {
  const ranks: Record<string, number> = {};
  for (const [k, s] of Object.entries(gd.skills)) if (s.kind === "active" || s.kind === "passive") ranks[k] = 1;
  return {
    name: "Planner",
    region: "global",
    level,
    skill_ranks: ranks,
    stigmas: [],
    specs: {},
    bonus_ranks: {},
    stats: {
      attack: 550,
      attack_increase_pct: 0,
      weapon_dmg_pct: 0,
      dmg_boost_pct: 0,
      pve_dmg_pct: 0,
      boss_dmg_pct: 0,
      crit_chance_pct: 0,
      crit_dmg_pct: 50,
      smite_pct: 0,
      combat_speed_pct: 0,
      cdr_pct: 0,
      max_mp: 1000,
      mp_regen_per_s: 20,
      target_defense: 0,
      penetration: 0,
    },
    show_kr: false,
    daevanion_nodes: [...nodes].sort((a, b) => a - b),
    skill_points: null,
    stigma_points: null,
    class_key: gd.class_key,
  };
}
