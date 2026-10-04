import { useEffect, useState } from "react";
import { gearUpgrades, maxPotential } from "@/engine/api";
import { PLAYSTYLE_ORDER, slotLabel } from "@/features/build/helpers";
import type { ArmoryRaw, CharacterBuild, GearUpgradesResult, MaxPotentialResult, PlaystyleKey } from "@/lib/types";

export { PLAYSTYLE_ORDER, slotLabel };

export const PLAYSTYLE_LABEL: Record<PlaystyleKey, string> = { boss: "Boss DPS", aoe: "AoE", leveling: "Leveling", burst: "Burst" };

/** "+3.9%" / "+0.04%": two decimals below 0.1 so small gains do not read as zero. */
export function fmtGain(pct: number): string {
  const d = Math.abs(pct) < 0.1 && pct !== 0 ? 2 : 1;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(d)}%`;
}

/** "Quest, Crafting" -> ["Quest", "Crafting"] (the engine joins sources with ", "). */
export function sources(source: string | null | undefined): string[] {
  return (source ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

type Piece = { name: string; enchant: number; grade?: string; il?: number };

/** "Rare, IL 13": what tells two same-named items apart (a morph or grade-up keeps the name). */
const tier = (p: Piece) => [p.grade, p.il != null ? `IL ${p.il}` : null].filter(Boolean).join(", ");

/**
 * One line for an upgrade: "Old +10 -> New +10", or "Item +0 -> +10" for an enchant step. When an item steps up to a
 * version with the same name (Revelation Amulet Rare -> Unique), the grade and item level are shown so the line says
 * what changes.
 */
export function moveText(u: { kind: "item" | "enchant"; from: Piece | null; to: Piece }): string {
  if (u.kind === "enchant") return `${u.to.name} +${u.from?.enchant ?? 0} -> +${u.to.enchant}`;
  const same = u.from !== null && u.from.name === u.to.name && (tier(u.from) || tier(u.to)) !== "";
  const label = (p: Piece) => (same ? `${p.name} (${tier(p)})` : p.name);
  return `${u.from ? `${label(u.from)} +${u.from.enchant}` : "Empty"} -> ${label(u.to)} +${u.to.enchant}`;
}

interface Async<T> {
  data: T | null;
  error: string | null;
  busy: boolean;
}
const IDLE = { data: null, error: null, busy: false };

/** Gear upgrades for one playstyle. Re-runs when the playstyle or reachable filter changes; stale replies are dropped. */
export function useGearUpgrades(raw: ArmoryRaw | null, build: CharacterBuild | null, playstyle: PlaystyleKey, reachableOnly: boolean, enabled = true): Async<GearUpgradesResult> {
  const [s, setS] = useState<Async<GearUpgradesResult>>(IDLE);
  useEffect(() => {
    if (!raw || !build || !enabled) return;
    let live = true;
    setS((p) => ({ ...p, busy: true, error: null }));
    gearUpgrades(raw, build, playstyle, 10, reachableOnly).then(
      (data) => live && setS({ data, error: null, busy: false }),
      (e) => live && setS({ data: null, error: e instanceof Error ? e.message : String(e), busy: false }),
    );
    return () => {
      live = false;
    };
  }, [raw, build, playstyle, reachableOnly, enabled]);
  return s;
}

/** Max potential is the full optimizer: run only on request (`run()`), cached per playstyle + filter. */
export function useMaxPotential(raw: ArmoryRaw | null, build: CharacterBuild | null, playstyle: PlaystyleKey, reachableOnly: boolean) {
  const [cache, setCache] = useState<Record<string, MaxPotentialResult>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = `${playstyle}:${reachableOnly}`;
  async function run() {
    if (!build) return;
    setBusy(true);
    setError(null);
    try {
      const r = await maxPotential(build.class_key, playstyle, reachableOnly, build, raw);
      setCache((c) => ({ ...c, [key]: r }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return { data: cache[key] ?? null, busy, error, run };
}
