import { useEffect, useState } from "react";
import { submitMaxDps } from "@/lib/board";
import { GameTabs } from "@/components/game";
import type { ArmoryRaw, ImportResult, PlaystyleKey } from "@/lib/types";
import { GearUpgradesCard } from "./GearUpgradesCard";
import { MaxPotentialPanel } from "./MaxPotentialPanel";
import { PLAYSTYLE_LABEL, PLAYSTYLE_ORDER, useGearUpgrades, useMaxPotential } from "./logic";

interface Props {
  imp: ImportResult;
  raw: ArmoryRaw | null;
  playstyle: PlaystyleKey;
  onPlaystyle: (k: PlaystyleKey) => void;
  /** hold the (serial) engine until the playstyle comparison has finished */
  ready?: boolean;
  /** armory region code (nae, eu...), needed to file the max-potential estimate on the public board */
  region?: string;
}

/** The two gear cards for the Character page; the playstyle is shared with the page's playstyle strip. */
export function GearSection({ imp, raw, playstyle, onPlaystyle, ready = true, region }: Props) {
  const [reachableOnly, setReachable] = useState(true);
  const up = useGearUpgrades(raw, imp.build, playstyle, reachableOnly, ready);
  const mp = useMaxPotential(raw, imp.build, playstyle, reachableOnly);
  // The board ranks one comparable number per character: boss playstyle, obtainable gear. The Worker only
  // attaches it to a character it already saw through /info.
  const dps = playstyle === "boss" && reachableOnly ? (mp.data?.dps ?? null) : null;
  useEffect(() => {
    const p = (raw?.info as { profile?: { characterId?: unknown; serverId?: unknown } } | undefined)?.profile;
    if (!region || dps === null || typeof p?.characterId !== "string" || typeof p?.serverId !== "number") return;
    submitMaxDps({ region, serverId: p.serverId, characterId: p.characterId, dps });
  }, [region, dps, raw]);
  if (!raw) return null;
  const selector = (
    <GameTabs label="Gear playstyle" value={playstyle} onChange={onPlaystyle} tabs={PLAYSTYLE_ORDER.map((k) => ({ key: k, label: PLAYSTYLE_LABEL[k] }))} />
  );
  return (
    <>
      <GearUpgradesCard result={up.data} busy={up.busy} error={up.error} reachableOnly={reachableOnly} onReachable={setReachable} selector={selector} />
      <MaxPotentialPanel result={mp.data} busy={mp.busy} error={mp.error} onRun={mp.run} classLabel={imp.profile.class_name} />
    </>
  );
}
