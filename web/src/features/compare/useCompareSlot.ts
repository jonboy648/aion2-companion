import { useEffect, useState } from "react";
import { compare, importCharacter } from "@/engine/api";
import { pickHit } from "@/features/build/useCharacter";
import { ArmoryError, armoryExtras, fetchCharacter, search, type ArmoryExtras } from "@/lib/armory";
import type { ArmorySearchHit, CompareResult, ImportResult } from "@/lib/types";
import type { Triplet } from "./logic";

export type SlotPhase = "empty" | "lookup" | "import" | "optimize" | "done" | "error";

export interface SlotState {
  phase: SlotPhase;
  message: string;
  hit: ArmorySearchHit | null;
  imp: ImportResult | null;
  extras: ArmoryExtras | null;
  /** engine estimate (all four playstyles); the page shows the boss one */
  cmp: CompareResult | null;
  error: string | null;
}

const EMPTY: SlotState = { phase: "empty", message: "", hit: null, imp: null, extras: null, cmp: null, error: null };

/** Armory search -> fetch -> import -> compare for one comparison slot. The import is published before the slow compare finishes. */
export function useCompareSlot(t: Triplet | null): SlotState {
  const [state, setState] = useState<SlotState>(EMPTY);
  const key = t ? `${t.region}/${t.serverId}/${t.name}` : "";
  useEffect(() => {
    if (!t) {
      setState(EMPTY);
      return;
    }
    let live = true;
    const patch = (p: Partial<SlotState>) => live && setState((s) => ({ ...s, ...p }));
    setState({ ...EMPTY, phase: "lookup", message: "Looking up character..." });
    (async () => {
      try {
        const hits = await search(t.name, t.region);
        const hit = pickHit(hits, t.name, t.serverId);
        if (!hit) throw new ArmoryError(`No character named "${t.name}" was found in that region.`);
        patch({ hit, message: "Fetching gear and Daevanion..." });
        const raw = await fetchCharacter(hit.characterId, hit.serverId ?? t.serverId, t.region);
        patch({ phase: "import", extras: armoryExtras(raw), message: "Reading the build..." });
        const imp = await importCharacter(raw);
        patch({ imp, phase: "optimize", message: "Estimating boss DPS..." });
        const cmp = await compare(imp.build, null, (m) => patch({ message: m }));
        patch({ cmp, phase: "done", message: "Done" });
      } catch (e) {
        patch({ phase: "error", error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
