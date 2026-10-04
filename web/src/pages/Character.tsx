import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Share2 } from "lucide-react";
import { useCharacterFaction } from "@/components/game/faction";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BuildResults, ProgressPanel } from "@/features/build/BuildResults";
import { CharacterCard } from "@/features/build/CharacterCard";
import { saveRecent } from "@/features/build/helpers";
import { comparePath } from "@/features/compare/logic";
import { GearSection } from "@/features/gear/GearSection";
import { daevanionLink } from "@/features/daevanion/DaevanionView";
import { UnspentPoints } from "@/features/build/UnspentPointsInput";
import { useCharacter } from "@/features/build/useCharacter";
import { useClassData } from "@/features/build/useClassData";
import type { ArmoryRegion, PlaystyleKey } from "@/lib/types";

function ShareButton() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* nothing else to try */
      }
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button variant="secondary" size="sm" onClick={copy} aria-live="polite">
      {copied ? <Check className="text-ok" /> : <Share2 />}
      {copied ? "Link copied" : "Share"}
    </Button>
  );
}

/** The router already decoded once; a stray "%" left over must not throw and blank the app. */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Shareable route /#/c/:region/:serverId/:name. Armory -> engine import -> four playstyles. */
export function Character() {
  const { region = "nae", serverId = "", name: rawName = "" } = useParams();
  const name = safeDecode(rawName);
  const st = useCharacter(region, serverId, name);
  const data = useClassData(st.imp?.build.class_key);
  const [playstyle, setPlaystyle] = useState<PlaystyleKey>("boss"); // shared by the playstyle strip and the gear cards
  useCharacterFaction(st.imp?.profile.race);

  const hit = st.hit;
  const imp = st.imp;
  useEffect(() => {
    if (imp && hit) saveRecent({ name: hit.name, region: region as ArmoryRegion, serverId: hit.serverId ?? serverId, serverName: hit.serverName, level: hit.level });
  }, [imp, hit, region, serverId]);

  if (st.phase === "error") {
    return (
      <>
        <PageHeader title={name || "Character"} caption="Could not load this character." />
        <div role="alert" className="ornate border-error/50 bg-error/10 p-4 text-sm">
          <p className="text-error">{st.error}</p>
          <p className="mt-2 text-dim">Check the spelling and region, then try again. The armory only lists characters that logged in recently.</p>
          <Button asChild size="sm" className="mt-3">
            <Link to="/">Back to search</Link>
          </Button>
        </div>
      </>
    );
  }

  const title = imp?.profile.name ?? name;
  const caption = imp ? `${imp.profile.class_name} - Lv ${imp.profile.level ?? "?"} - ${imp.profile.server}` : "Loading from the official armory...";
  // No `key`s on the siblings below: CharacterPage already remounts this page per character, and two siblings sharing a key
  // (they both used the character name) make React insert duplicates and skip removals in production builds.
  return (
    <>
      <PageHeader title={title} caption={caption}>
        <div className="flex flex-wrap items-center gap-2">
          {imp && (
            <Badge tone="gold">
              {imp.daevanion_summary.matched}/{imp.daevanion_summary.open} Daevanion nodes
            </Badge>
          )}
          {imp && (
            <Button asChild variant="secondary" size="sm">
              <Link to={daevanionLink(region, hit?.serverId ?? serverId, imp.profile.name)}>Open Daevanion</Link>
            </Button>
          )}
          <Button asChild variant="secondary" size="sm">
            <Link to={comparePath({ region: region as ArmoryRegion, serverId: String(hit?.serverId ?? serverId), name: imp?.profile.name ?? name }, null)}>Compare with…</Link>
          </Button>
          <ShareButton />
        </div>
      </PageHeader>

      {imp ? <CharacterCard imp={imp} data={data} extras={st.extras} /> : <ProgressPanel title="Importing character" message={st.message} steps={st.steps} />}

      {imp && <UnspentPoints value={st.points} onChange={st.setPoints} />}

      {imp && st.phase !== "done" && <ProgressPanel title="Comparing playstyles" message={st.message} steps={st.steps} />}
      {st.cmp && <BuildResults cmp={st.cmp} data={data} selected={playstyle} onSelect={setPlaystyle} />}

      {imp && st.raw && <GearSection imp={imp} raw={st.raw} playstyle={playstyle} onPlaystyle={setPlaystyle} ready={st.phase === "done"} region={region} />}

      {imp && imp.notes.length > 0 && st.phase === "done" && (
        <details className="mt-6 text-xs text-dim">
          <summary className="cursor-pointer text-cyan">Import notes ({imp.notes.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {imp.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
