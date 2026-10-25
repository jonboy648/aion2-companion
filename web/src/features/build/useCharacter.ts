import { useEffect, useState } from "react";
import { compare, importCharacter, warmEngine } from "@/engine/api";
import { clearImportedCharacterContext, storeActiveBuild, storeImportedCharacterContext } from "@/features/keybinds/activeBuild";
import { applyPoints, pointsKey, usePoints, type Points } from "./unspentPoints";
import { ArmoryError, armoryExtras, fetchCharacter, search, type ArmoryExtras } from "@/lib/armory";
import type { ArmoryRaw, ArmoryRegion, ArmorySearchHit, CompareResult, Goal, ImportResult } from "@/lib/types";

export type Phase = "lookup" | "import" | "ready" | "optimize" | "done" | "error";

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

/** A character URL identifies one name and server; never silently substitute a search suggestion. */
export function pickHit(hits: ArmorySearchHit[], name: string, serverId: string, region?: string): ArmorySearchHit | null {
  const sid = String(serverId);
  const exact = hits.find((h) => h.name.toLowerCase() === name.toLowerCase() && String(h.serverId) === sid && (!region || h.region === region));
  return exact ?? null;
}

/**
 * Armory search -> fetch -> engine import -> compare, publishing each phase so the page can show the
 * character card as soon as the import lands while the (slow, in the real engine) optimizer still runs.
 */
export function useCharacter(region: string, serverId: string, name: string) {
  const [state, setState] = useState<CharacterState>(INITIAL);
  // bumped by refresh(): re-run the load, asking the proxy to skip its cache
  const [reloads, setReloads] = useState(0);
  const [points, savePoints] = usePoints(pointsKey(region, serverId, name));
  const [goal, saveGoal] = useState<Goal>("damage");
  const [calculation, setCalculation] = useState<{ imp: ImportResult; points: Points; goal: Goal } | null>(null);
  const [pendingChanges, setPendingChanges] = useState(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const patch = (p: Partial<CharacterState>) => live && setState((s) => ({ ...s, ...p }));
    const step = (message: string) => live && setState((s) => ({ ...s, message, steps: [...s.steps, message] }));

    warmEngine(); // boot the engine while the armory request is in flight
    clearImportedCharacterContext();
    setCalculation(null);
    setCalculationError(null);
    setPendingChanges(false);
    setState({ ...INITIAL, steps: [INITIAL.message] });
    (async () => {
      try {
        const hits = await search(name, region as ArmoryRegion);
        if (!live) return;
        const hit = pickHit(hits, name, serverId, region);
        if (!hit) throw new ArmoryError(`No character named "${name}" was found on server ${serverId} in ${region}.`);
        patch({ hit });
        step("Fetching gear and Daevanion from the armory...");
        const raw = await fetchCharacter(hit.characterId, hit.serverId ?? serverId, region as ArmoryRegion, reloads > 0);
        if (!live) return;
        const profile = raw.info.profile as { characterName?: unknown; serverId?: unknown } | undefined;
        if (typeof profile?.characterName !== "string" || profile.characterName.toLowerCase() !== name.toLowerCase()
          || String(profile.serverId) !== String(serverId)) {
          throw new ArmoryError("The armory profile does not match the requested name and server. Refresh or return to search; no build was calculated.");
        }
        patch({ phase: "import", extras: armoryExtras(raw), raw });
        step("Reading the build...");
        const imp = await importCharacter(raw);
        if (live) storeImportedCharacterContext({ region: region as ArmoryRegion, serverId: String(hit.serverId ?? serverId), name: hit.name });
        patch({ imp }); // the compare effect below picks it up
      } catch (e) {
        patch({ phase: "error", error: e instanceof Error ? e.message : String(e) });
      }
    })();

    return () => {
      live = false;
    };
  }, [region, serverId, name, reloads]);

  // A fresh import calculates automatically. Later edits only invalidate the submitted request.
  const imp = state.imp;
  useEffect(() => {
    if (!imp) return;
    setCalculation({ imp, points: { ...points }, goal });
  }, [imp]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!calculation || calculation.imp !== imp) return;
    let live = true;
    const timer = window.setTimeout(
      async () => {
        const build = applyPoints(calculation.imp.build, calculation.points);
        storeActiveBuild(build); // hand-off to Keybinds / Crafting / Road Map
        const step = (message: string) => live && setState((s) => ({ ...s, message, steps: [...s.steps, message] }));
        setState((s) => ({ ...s, phase: "optimize", message: "Comparing playstyles...", steps: [...s.steps, "Comparing playstyles..."] }));
        try {
          const cmp = await compare(build, 0, step, calculation.goal);
          const mismatch = Object.values(cmp).find(fb =>
            (fb.objective ?? fb.playstyle.scenario.objective ?? "damage") !== calculation.goal
            || (fb.playstyle.scenario.objective !== undefined && fb.playstyle.scenario.objective !== calculation.goal));
          if (mismatch) throw new Error(`The engine returned a ${mismatch.objective ?? mismatch.playstyle.scenario.objective ?? "damage"} result for the requested ${calculation.goal} goal. Calculate again with a matching engine.`);
          if (live) {
            setState((s) => ({ ...s, phase: "done", cmp, message: "Done" }));
            setPendingChanges(false);
          }
        } catch (e) {
          if (live) {
            setCalculationError(e instanceof Error ? e.message : String(e));
            setState((s) => ({ ...s, phase: s.cmp ? "done" : "ready" }));
          }
        }
      },
      0,
    );
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [imp, calculation]);

  const invalidate = () => {
    setCalculation(null); // effect cleanup ignores late replies and progress; the worker keeps running
    setPendingChanges(true);
    setCalculationError(null);
    setState((s) => ({ ...s, phase: s.cmp ? "done" : s.imp ? "ready" : s.phase }));
  };
  const calculate = () => {
    if (!imp) return;
    setPendingChanges(true);
    setCalculationError(null);
    setCalculation({ imp, points: { ...points }, goal });
  };

  return { ...state, points, goal, calculationError, stale: !!state.cmp && (pendingChanges || state.phase === "optimize"), calculate,
    setPoints: (p: Points) => { invalidate(); savePoints(p); },
    setGoal: (g: Goal) => { invalidate(); saveGoal(g); },
    refresh: () => setReloads((n) => n + 1) };
}
