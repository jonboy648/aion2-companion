import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { gamedata, iconUrls, importCharacter, listClasses } from "@/engine/api";
import { fetchCharacter, search } from "@/lib/armory";
import type { ArmoryRegion, GameData, IconUrls, ImportResult } from "@/lib/types";
import { Planner } from "./Planner";

/** Link other pages use to open the planner on an imported character. */
export const daevanionLink = (region: string, serverId: string | number, name: string) =>
  `/daevanion?c=${encodeURIComponent(`${region}/${serverId}/${name}`)}`;

interface Loaded {
  gd: GameData;
  icons: IconUrls;
  imp: ImportResult | null;
  classes: { key: string; name: string }[];
}

export function parseChar(c: string | null): { region: ArmoryRegion; serverId: string; name: string } | null {
  const m = c?.split("/");
  if (!m || m.length < 3 || !m[2]) return null;
  return { region: m[0] as ArmoryRegion, serverId: m[1], name: m.slice(2).join("/") };
}

/** Loads class data (and the imported character, if ?c=region/serverId/name is present), then hands over to the planner. */
export function DaevanionView() {
  const [params, setParams] = useSearchParams();
  const charParam = params.get("c");
  const classParam = params.get("class") ?? "sorcerer";
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    (async () => {
      const ch = parseChar(charParam);
      let imp: ImportResult | null = null;
      if (ch) {
        const hits = await search(ch.name, ch.region);
        const hit = hits.find((h) => String(h.serverId) === ch.serverId) ?? hits[0];
        const raw = await fetchCharacter(hit?.characterId ?? "", ch.serverId, ch.region);
        imp = await importCharacter(raw);
      }
      const classKey = imp?.build.class_key ?? classParam;
      const [gd, icons, classes] = await Promise.all([gamedata(classKey), iconUrls(classKey), listClasses()]);
      return { gd, icons, imp, classes };
    })().then(
      (d) => live && setData(d),
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
  }, [charParam, classParam]);

  if (error)
    return (
      <p role="alert" className="text-error">
        Could not load the planner: {error}
      </p>
    );
  if (!data) return <p className="text-dim">Loading boards...</p>;
  return <Planner key={`${data.gd.class_key}|${charParam ?? ""}`} {...data} hasCharacter={!!charParam} onClass={(k) => setParams({ class: k })} />;
}
