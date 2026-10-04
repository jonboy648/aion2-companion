import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LoaderCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { warmEngine } from "@/engine/api";
import { trackPicked } from "@/lib/analytics";
import { ARMORY_REGIONS, search } from "@/lib/armory";
import type { ArmoryRegion, ArmorySearchHit } from "@/lib/types";
import { characterPath, hitToRecent, saveRecent } from "./helpers";

/**
 * Character search: name + region ("Auto" searches all five). A single hit opens directly;
 * several hits (same name on different servers) are listed so the player picks theirs.
 */
export function SearchBox() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [region, setRegion] = useState<ArmoryRegion | "">("");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<ArmorySearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function open(h: ArmorySearchHit) {
    saveRecent(hitToRecent(h));
    trackPicked(h.name, h.serverName);
    nav(characterPath({ region: h.region, serverId: h.serverId ?? 0, name: h.name }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setHits(null);
    setBusy(true);
    try {
      const found = await search(name.trim(), region || undefined);
      if (found.length === 1) open(found[0]);
      else setHits(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row" role="search" aria-label="Character search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input
            aria-label="Character name"
            placeholder="Character name"
            autoComplete="off"
            value={name}
            onChange={(e) => {
              if (e.target.value) warmEngine(); // they are about to search: start the engine now
              setName(e.target.value);
            }}
            className="h-12 bg-bg/70 pl-9 text-base"
          />
        </div>
        <select
          aria-label="Region"
          value={region}
          onChange={(e) => setRegion(e.target.value as ArmoryRegion | "")}
          className="h-12 game-input px-3 text-sm  sm:w-44"
        >
          <option value="">Auto (all regions)</option>
          {ARMORY_REGIONS.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
        <Button type="submit" size="lg" className="h-12" disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Search />}
          Search
        </Button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-error">
          {error}
        </p>
      )}
      {hits && hits.length === 0 && <p className="mt-3 text-sm text-dim">No characters found. Check the spelling, or pick the region instead of Auto.</p>}
      {hits && hits.length > 1 && (
        <ul className="mt-3 divide-y divide-border-soft rounded-md border border-border-soft bg-bg/60" aria-label="Search results">
          {hits.map((h) => (
            <li key={`${h.region}-${h.serverId}-${h.characterId}`}>
              <button type="button" onClick={() => open(h)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface2">
                <span>
                  <strong>{h.name}</strong>
                  <span className="ml-2 text-sm text-dim">
                    {h.level != null ? `Lv ${h.level} - ` : ""}
                    {h.serverName} ({h.region.toUpperCase()})
                  </span>
                </span>
                <span className="text-sm text-gold">Open</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
