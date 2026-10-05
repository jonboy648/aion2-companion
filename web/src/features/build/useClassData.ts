import { useEffect, useState } from "react";
import { gamedata, iconUrls } from "@/engine/api";
import type { GameData, IconUrls } from "@/lib/types";

export interface ClassData {
  gd: GameData | null;
  icons: IconUrls;
  error?: string | null;
}

/** Loads a class's game data (skill names, rules) and official icon URLs. Never throws: icons are decoration. */
export function useClassData(classKey: string | null | undefined): ClassData {
  const [state, setState] = useState<ClassData & { key: string | null }>({ gd: null, icons: {}, key: null });
  useEffect(() => {
    if (!classKey) return;
    let live = true;
    Promise.allSettled([gamedata(classKey), iconUrls(classKey)]).then(([g, i]) => {
      if (!live) return;
      setState({
        key: classKey,
        gd: g.status === "fulfilled" ? g.value : null,
        icons: i.status === "fulfilled" ? i.value : {},
        error: g.status === "rejected" ? (g.reason instanceof Error ? g.reason.message : "Could not load class data.") : null,
      });
    });
    return () => {
      live = false;
    };
  }, [classKey]);
  return state.key === classKey ? state : { gd: null, icons: {} };
}
