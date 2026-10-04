import { useEffect, useRef, useState } from "react";
import { compare, importCharacter, warmEngine } from "@/engine/api";
import { storeActiveBuild } from "@/features/keybinds/activeBuild";
import { applyPoints, pointsKey, POINTS_DEBOUNCE_MS, usePoints, type Points } from "./unspentPoints";
import { ArmoryError, armoryExtras, fetchCharacter, search, type ArmoryExtras } from "@/lib/armory";
import type { ArmoryRaw, ArmoryRegion, ArmorySearchHit, CompareResult, ImportResult } from "@/lib/types";

export type Phase = "lookup" | "import" | "optimize" | "done" | "error";

export interface CharacterState {
  phase: Phase;
  message: string;
  steps: string[];
  hit: ArmorySearchHit | null;
  imp: ImportResult | null;
  /** gear icon URLs and pet/wings from the raw armory payload */
  extras: ArmoryExtras | null;
  /** the armory payload passed to importCharacter (the gear card re-feeds it to the engine) */
  raw: ArmoryRaw | null;
  cmp: CompareResult | null;
  error: string | null;
}

const INITIAL: CharacterState = { phase: "lookup", message: "Looking up character...", steps: [], hit: null, imp: null, extras: null, raw: null, cmp: null, error: null };

/** Pick the hit for this server (exact name match preferred), else the first hit. */
export function pickHit(hits: ArmorySearchHit[], name: string, serverId: string): ArmorySearchHit | null {
  const sid = String(serverId);
  const exact = hits.find((h) => h.name.toLowerCase() === name.toLowerCase() && String(h.serverId) === sid);
  return exact ?? hits.find((h) => h.name.toLowerCase() === name.toLowerCase()) ?? hits[0] ?? null;
}

/**
 * Armory search -> fetch -> engine import -> compare, publishing each phase so the page can show the
 * character card as soon as the import lands while the (slow, in the real engine) optimizer still runs.
 */
export function useCharacter(region: string, serverId: string, name: string): CharacterState & { points: Points; setPoints: (p: Points) => void; refresh: () => void } {
  const [state, setState] = useState<CharacterState>(INITIAL);
  // bumped by refresh(): re-run the load, asking the proxy to skip its cache
  const [reloads, setReloads] = useState(0);
  const [points, setPoints] = usePoints(pointsKey(region, serverId, name));
  const comparedFor = useRef<ImportResult | null>(null);

  useEffect(() => {
    let live = true;
    const patch = (p: Partial<CharacterState>) => live && setState((s) => ({ ...s, ...p }));
    const step = (message: string) => live && setState((s) => ({ ...s, message, steps: [...s.steps, message] }));

    warmEngine(); // boot the engine while the armory request is in flight
    setState({ ...INITIAL, steps: [INITIAL.message] });
    (async () => {
      try {
        const hits = await search(name, region as ArmoryRegion);
        const hit = pickHit(hits, name, serverId);
        if (!hit) throw new ArmoryError(`No character named "${name}" was found in that region.`);
        patch({ hit });
        step("Fetching gear and Daevanion from the armory...");
        const raw = await fetchCharacter(hit.characterId, hit.serverId ?? serverId, region as ArmoryRegion, reloads > 0);
        patch({ phase: "import", extras: armoryExtras(raw), raw });
        step("Reading the build...");
        const imp = await importCharacter(raw);
        patch({ imp }); // the compare effect below picks it up
      } catch (e) {
        patch({ phase: "error", error: e instanceof Error ? e.message : String(e) });
      }
    })();

    return () => {
      live = false;
    };
  }, [region, serverId, name, reloads]);

  // compare = import + the typed unspent points. Immediate for a fresh import, debounced when the points change.
  const imp = state.imp;
  useEffect(() => {
    if (!imp) return;
    let live = true;
    const first = comparedFor.current !== imp;
    comparedFor.current = imp;
    const timer = window.setTimeout(
      async () => {
        const build = applyPoints(imp.build, points);
        storeActiveBuild(build); // hand-off to Keybinds / Crafting / Road Map
        const step = (message: string) => live && setState((s) => ({ ...s, message, steps: [...s.steps, message] }));
        setState((s) => ({ ...s, phase: "optimize", message: "Comparing playstyles...", steps: [...s.steps, "Comparing playstyles..."] }));
        try {
          const cmp = await compare(build, 0, step);
          if (live) setState((s) => ({ ...s, phase: "done", cmp, message: "Done" }));
        } catch (e) {
          if (live) setState((s) => ({ ...s, phase: "error", error: e instanceof Error ? e.message : String(e) }));
        }
      },
      first ? 0 : POINTS_DEBOUNCE_MS,
    );
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [imp, points.skill, points.stigma]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, points, setPoints, refresh: () => setReloads((n) => n + 1) };
}
