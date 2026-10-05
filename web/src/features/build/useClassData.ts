import { useEffect, useState } from "react";
import { gamedata, iconUrls } from "@/engine/api";
import classes from "@/fixtures/list_classes.json";
import type { GameData, IconUrls } from "@/lib/types";

export interface ClassData {
  gd: GameData | null;
  icons: IconUrls;
  error?: string | null;
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status}).`);
  return response.json() as Promise<T>;
}

/** Loads a class's game data (skill names, rules) and official icon URLs. Never throws: icons are decoration. */
export function useClassData(
  classKey: string | null | undefined,
  { staticData = false }: { staticData?: boolean } = {},
): ClassData {
  const useStaticData = staticData && import.meta.env.VITE_ENGINE !== "mock";
  const [state, setState] = useState<ClassData & { key: string | null; staticData: boolean }>({
    gd: null, icons: {}, key: null, staticData: false,
  });
  useEffect(() => {
    if (!classKey) return;
    if (useStaticData && !classes.some(({ key }) => key === classKey)) {
      setState({ key: classKey, staticData: useStaticData, gd: null, icons: {}, error: `Unknown class: ${classKey}.` });
      return;
    }
    setState({ key: classKey, staticData: useStaticData, gd: null, icons: {}, error: null });
    let live = true;
    const controller = new AbortController();
    const base = import.meta.env.BASE_URL;
    const data = useStaticData
      ? fetchJson<GameData>(`${base}engine/classes/${classKey}.json`, controller.signal).then((gd) => {
        if (gd?.class_key !== classKey) throw new Error(`Class data does not match requested class ${classKey}.`);
        return gd;
      })
      : gamedata(classKey);
    const icons = useStaticData
      ? fetchJson<Record<string, string | null>>(`${base}engine/icons/${classKey}.json`, controller.signal).then((names) =>
        Object.fromEntries(Object.entries(names).map(([key, name]) => [key,
          typeof name === "string" && /^[A-Za-z0-9_]+$/.test(name)
            ? `https://assets.playnccdn.com/static-aion2-gamedata/resources/${name}.png` : null,
        ])))
      : iconUrls(classKey);
    Promise.allSettled([data, icons]).then(([g, i]) => {
      if (!live) return;
      setState({
        key: classKey,
        staticData: useStaticData,
        gd: g.status === "fulfilled" ? g.value : null,
        icons: i.status === "fulfilled" ? i.value : {},
        error: g.status === "rejected" ? (g.reason instanceof Error ? g.reason.message : "Could not load class data.") : null,
      });
    });
    return () => {
      live = false;
      controller.abort();
    };
  }, [classKey, useStaticData]);
  return state.key === classKey && state.staticData === useStaticData ? state : { gd: null, icons: {} };
}
