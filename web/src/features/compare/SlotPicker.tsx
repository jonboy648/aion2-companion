import { useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ARMORY_REGIONS, search } from "@/lib/armory";
import type { ArmoryRegion, ArmorySearchHit } from "@/lib/types";
import type { Triplet } from "./logic";

export const hitToTriplet = (h: ArmorySearchHit): Triplet => ({ region: h.region as ArmoryRegion, serverId: String(h.serverId ?? 0), name: h.name });

/** Name + region search for one slot. One hit is picked straight away; several are listed (same name, different servers). */
export function SlotPicker({ label, current, onPick }: { label: string; current: Triplet | null; onPick: (t: Triplet) => void }) {
  const [name, setName] = useState(current?.name ?? "");
  const [region, setRegion] = useState<ArmoryRegion | "">(current?.region ?? "");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<ArmorySearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setHits(null);
    setBusy(true);
    try {
      const found = await search(name.trim(), region || undefined);
      if (found.length === 1) onPick(hitToTriplet(found[0]));
      else setHits(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0">
      <form onSubmit={submit} role="search" aria-label={`${label} search`} className="flex flex-col gap-2">
        <Input aria-label={`${label} character name`} placeholder={`${label}: character name`} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} className="h-10 bg-bg/70" />
        <div className="flex gap-2">
          <select aria-label={`${label} region`} value={region} onChange={(e) => setRegion(e.target.value as ArmoryRegion | "")} className="game-input h-10 min-w-0 flex-1 px-2 text-sm">
            <option value="">Auto (all regions)</option>
            {ARMORY_REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" className="h-10" disabled={busy || !name.trim()}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Search />}
            Load
          </Button>
        </div>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
      {hits && hits.length === 0 && <p className="mt-2 text-sm text-dim">No characters found. Check the spelling or pick the region.</p>}
      {hits && hits.length > 1 && (
        <ul className="mt-2 divide-y divide-border-soft rounded-md border border-border-soft bg-bg/60" aria-label={`${label} results`}>
          {hits.map((h) => (
            <li key={`${h.region}-${h.serverId}-${h.characterId}`}>
              <button type="button" onClick={() => onPick(hitToTriplet(h))} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface2">
                <span className="min-w-0 truncate">
                  <strong>{h.name}</strong>
                  <span className="ml-2 text-dim">
                    {h.level != null ? `Lv ${h.level} - ` : ""}
                    {h.serverName} ({h.region.toUpperCase()})
                  </span>
                </span>
                <span className="text-gold">Pick</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
