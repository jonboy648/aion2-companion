import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BeamSearch } from "@/components/ui/beam-search";
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
  const errorId = useId();

  function open(h: ArmorySearchHit) {
    saveRecent(hitToRecent(h));
    trackPicked(h.name, h.serverName);
    nav(characterPath({ region: h.region, serverId: h.serverId ?? 0, name: h.name }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setHits(null);
    if (!name.trim()) {
      setError("Type a character name first.");
      return;
    }
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
      <form onSubmit={onSubmit} className="character-search-form moon-search-composer" role="search" aria-label="Character search" aria-busy={busy}>
        <BeamSearch
          type="search"
          aria-label="Character name"
          aria-describedby={error ? errorId : undefined}
          placeholder="Character name"
          autoComplete="off"
          value={name}
          onChange={(next) => {
            if (next) warmEngine(); // Start loading the engine while the player enters their name.
            setName(next);
            setHits(null);
            setError(null);
          }}
          colorVariant="gold"
          theme="dark"
          disabled={busy}
        />
        <div className="character-search-toolbar">
          <select
            aria-label="Region"
            value={region}
            onChange={(e) => {
              setRegion(e.target.value as ArmoryRegion | "");
              setHits(null);
              setError(null);
            }}
            className="character-search-region"
            disabled={busy}
          >
            <option value="">Auto (all regions)</option>
            {ARMORY_REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
          <Button type="submit" size="icon" className="character-search-submit" title="Search character" disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowUp aria-hidden="true" />}
            <span className="sr-only">Search</span>
          </Button>
        </div>
      </form>

      {busy && <p role="status" className="moon-search-feedback mt-3 text-sm text-dim">Searching the armory...</p>}
      {error && (
        <p id={errorId} role="alert" className="moon-search-feedback mt-3 text-sm text-error">
          {error}
        </p>
      )}
      {hits && hits.length === 0 && <p role="status" className="moon-search-feedback mt-3 text-sm text-dim">No characters found. Check the spelling, or pick the region instead of Auto.</p>}
      {hits && hits.length > 1 && (
        <>
          <p role="status" className="moon-search-feedback mt-3 text-sm text-dim">{hits.length} characters found. Choose your server.</p>
          <ul className="character-search-results mt-2 divide-y divide-border-soft" aria-label="Search results">
            {hits.map((h) => (
              <li key={`${h.region}-${h.serverId}-${h.characterId}`}>
                <button type="button" onClick={() => open(h)} className="character-search-result">
                  <span className="min-w-0 break-words">
                    <strong>{h.name}</strong>
                    <span className="ml-2 text-sm text-dim">
                      {h.level != null ? `Lv ${h.level} - ` : ""}
                      {h.serverName} ({h.region.toUpperCase()})
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-gold">Open</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
