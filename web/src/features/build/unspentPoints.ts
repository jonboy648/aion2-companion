import { useCallback, useEffect, useState } from "react";
import type { CharacterBuild } from "@/lib/types";

/** Unspent skill / stigma points. The armory doesn't report them, so the user types them in. Blank = none (null). */
export interface Points {
  skill: string;
  stigma: string;
}

export const NO_POINTS: Points = { skill: "", stigma: "" };
export const POINTS_DEBOUNCE_MS = 600;

export const pointsKey = (region: string, serverId: string, name: string) => `aion2c:unspent:${region}/${serverId}/${name.toLowerCase()}`;

/** "" / junk / 0 / negative -> null; otherwise a whole number. */
export function parsePoints(s: string): number | null {
  const n = Math.floor(Number(s));
  return s.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

/** The build with the typed points applied (the imported build always has them null). */
export function applyPoints(build: CharacterBuild, p: Points): CharacterBuild {
  return { ...build, skill_points: parsePoints(p.skill), stigma_points: parsePoints(p.stigma) };
}

export function loadPoints(key: string): Points {
  try {
    const o = JSON.parse(localStorage.getItem(key) ?? "null") as Partial<Points> | null;
    return { skill: String(o?.skill ?? ""), stigma: String(o?.stigma ?? "") };
  } catch {
    return NO_POINTS;
  }
}

export function savePoints(key: string, p: Points): void {
  try {
    if (!p.skill && !p.stigma) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(p));
  } catch {
    /* storage blocked: the value just won't persist */
  }
}

/** Points state persisted under `key`; reloads when the key changes (another character). */
export function usePoints(key: string): [Points, (p: Points) => void] {
  const [state, setState] = useState<{ key: string; p: Points }>(() => ({ key, p: loadPoints(key) }));
  useEffect(() => {
    setState((s) => (s.key === key ? s : { key, p: loadPoints(key) }));
  }, [key]);
  const set = useCallback(
    (p: Points) => {
      savePoints(key, p);
      setState({ key, p });
    },
    [key],
  );
  return [state.key === key ? state.p : loadPoints(key), set];
}
