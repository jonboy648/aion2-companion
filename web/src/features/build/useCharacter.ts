import { useEffect, useState } from "react";
import { compare, importCharacter } from "@/engine/api";
import { storeActiveBuild } from "@/features/keybinds/activeBuild";
import { ArmoryError, fetchCharacter, search } from "@/lib/armory";
import type { ArmoryRegion, ArmorySearchHit, CompareResult, ImportResult } from "@/lib/types";

export type Phase = "lookup" | "import" | "optimize" | "done" | "error";

export interface CharacterState {
  phase: Phase;
  message: string;
  steps: string[];
  hit: ArmorySearchHit | null;
  imp: ImportResult | null;
  cmp: CompareResult | null;
  error: string | null;
}

const INITIAL: CharacterState = { phase: "lookup", message: "Looking up character...", steps: [], hit: null, imp: null, cmp: null, error: null };

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
export function useCharacter(region: string, serverId: string, name: string): CharacterState {
  const [state, setState] = useState<CharacterState>(INITIAL);

  useEffect(() => {
    let live = true;
    const patch = (p: Partial<CharacterState>) => live && setState((s) => ({ ...s, ...p }));
    const step = (message: string) => live && setState((s) => ({ ...s, message, steps: [...s.steps, message] }));

    setState({ ...INITIAL, steps: [INITIAL.message] });
    (async () => {
      try {
        const hits = await search(name, region as ArmoryRegion);
        const hit = pickHit(hits, name, serverId);
        if (!hit) throw new ArmoryError(`No character named "${name}" was found in that region.`);
        patch({ hit });
        step("Fetching gear and Daevanion from the armory...");
        const raw = await fetchCharacter(hit.characterId, hit.serverId ?? serverId, region as ArmoryRegion);
        patch({ phase: "import" });
        step("Reading the build...");
        const imp = await importCharacter(raw);
        storeActiveBuild(imp.build); // hand-off to Keybinds / Crafting / Road Map
        patch({ phase: "optimize", imp });
        step("Comparing playstyles...");
        const cmp = await compare(imp.build, null, step);
        patch({ phase: "done", cmp, message: "Done" });
      } catch (e) {
        patch({ phase: "error", error: e instanceof Error ? e.message : String(e) });
      }
    })();

    return () => {
      live = false;
    };
  }, [region, serverId, name]);

  return state;
}
