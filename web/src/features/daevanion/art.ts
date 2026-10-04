import type { NodeState } from "./logic";

/** Game UI art exported from the client (FWindow_Daevanion atlas), resized into public/daevanion/. */
export const ART_BASE = `${import.meta.env.BASE_URL ?? "/"}daevanion/`;

const url = (name: string) => `${ART_BASE}${name}.webp`;

/** Our rarity -> the client's frame grade. Our "Epic" is the client's Legend grade (blue frame). */
const GRADE: Record<string, string> = { common: "common", rare: "rare", epic: "legend", unique: "unique" };

export function frameGrade(rarity: string): string {
  return GRADE[rarity.toLowerCase()] ?? "common";
}

/** Frame image for a node: the game's lit ("open") variant once learned, its disabled variant otherwise. */
export function nodeFrame(rarity: string, state: NodeState): string {
  if (state === "start") return url("node-start");
  const g = frameGrade(rarity);
  return url(state === "selected" ? `node-${g}-open` : `node-${g}`);
}

const CLASS_ICONS = new Set(["gladiator", "templar", "assassin", "ranger", "sorcerer", "spiritmaster", "cleric", "chanter"]);

export function startIcon(classKey: string | undefined): string | null {
  return classKey && CLASS_ICONS.has(classKey) ? url(`start-${classKey}`) : null;
}

export const ART = {
  background: url("board-background"),
  startBg: url("start-bg"),
  selectRing: url("fx-select-ring"),
  availableFill: url("fx-available-fill"),
  titleDeco: url("title-deco"),
};
