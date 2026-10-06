import type { ReactNode } from "react";
import { Link, useInRouterContext } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { IconFrame, OrnateCard, SectionTitle, rarityOf } from "@/components/game";
import { Badge } from "@/components/ui/badge";
import type { GearPiece, GearUpgrade, GearUpgradesResult } from "@/lib/types";
import { fmtGain, moveText, slotLabel, sources } from "./logic";

function Piece({ item, icon, size = 44 }: { item: GearPiece | null; icon?: string | null; size?: number }) {
  if (!item) return <IconFrame name="Empty" url={null} size={size} rarity="common" alt="Empty slot" />;
  return <IconFrame name={item.name} url={icon ?? item.icon} size={size} rarity={rarityOf(item.grade)} title={`${item.name} +${item.enchant} (IL ${item.il})`} alt="" />;
}

/** Deep link to the cost calculator for an enhance / amplify move (only inside the router). */
export function costLink(u: GearUpgrade): string | null {
  if (u.kind === "item") return null;
  const exceed = u.kind === "exceed";
  const a = exceed ? u.from?.exceed ?? 0 : u.from?.enchant ?? 0;
  const b = exceed ? u.to.exceed : u.to.enchant;
  return `/enhance?item=${u.to.id}&track=${exceed ? "exceed" : "enchant"}&from=${a}&to=${b}`;
}

export function UpgradeRow({ u, rank }: { u: GearUpgrade; rank: number }) {
  const inRouter = useInRouterContext();
  const cost = inRouter ? costLink(u) : null;
  return (
    <li className="frame flex flex-wrap items-center gap-x-3 gap-y-2 p-2.5" data-testid="gear-upgrade">
      <span className="w-5 shrink-0 text-center text-xs tabular-nums text-faint">{rank}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        <Piece item={u.from} />
        <ArrowRight className="size-4 text-faint" aria-hidden />
        <Piece item={u.to} icon={u.icon} />
      </span>
      <span className="min-w-0 flex-1 basis-48">
        <span className="block text-[11px] uppercase tracking-wide text-faint">{slotLabel(u.slot)}</span>
        <span className="block truncate text-[13px]" title={moveText(u)}>
          {moveText(u)}
        </span>
        <span className="mt-1 flex flex-wrap gap-1">
          <Badge tone={u.kind === "item" ? "gold" : "info"}>{u.kind === "enchant" ? "Enchant" : u.kind === "exceed" ? "Exceed" : "New item"}</Badge>
          {sources(u.source).map((s) => (
            <Badge key={s}>{s}</Badge>
          ))}
          <Badge tone={u.reachable ? "ok" : "warn"}>{u.reachable ? "Reachable" : "Not yet obtainable"}</Badge>
          {cost && <Link to={cost} className="text-[11px] text-gold underline-offset-2 hover:underline">Cost to reach {u.kind === "exceed" ? `Amp ${u.to.exceed}` : `+${u.to.enchant}`}</Link>}
        </span>
      </span>
      <span className="ml-auto text-right">
        <span className="block font-display text-xl font-bold tabular-nums text-gold">{fmtGain(u.dps_gain_pct)}</span>
        <span className="text-[11px] text-dim">DPS</span>
      </span>
    </li>
  );
}

interface Props {
  result: GearUpgradesResult | null;
  busy: boolean;
  error: string | null;
  reachableOnly: boolean;
  onReachable: (v: boolean) => void;
  /** playstyle selector, rendered by the section */
  selector: ReactNode;
}

/** Ranked list of the next best gear moves for this character. */
export function GearUpgradesCard({ result, busy, error, reachableOnly, onReachable, selector }: Props) {
  return (
    <OrnateCard className="mb-6 p-4 sm:p-5" data-testid="gear-upgrades">
      <SectionTitle as="h2" caption="Greedy order: each step is the single best move by simulated DPS, then everything is re-evaluated.">
        Gear upgrades
      </SectionTitle>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {selector}
        <label className="flex items-center gap-2 text-sm text-dim">
          <input type="checkbox" checked={reachableOnly} onChange={(e) => onReachable(e.target.checked)} />
          Only items obtainable now
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-error">
          Could not compute gear upgrades: {error}
        </p>
      )}
      {busy && !result && (
        <p className="text-sm text-dim" role="status">
          Loading the item database and simulating upgrades...
        </p>
      )}
      {result && (
        <div className={busy ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={busy}>
          {result.upgrades.length > 0 ? (
            <ol className="space-y-2">
              {result.upgrades.map((u, i) => (
                <UpgradeRow key={`${u.slot}-${u.to.id}-${u.to.enchant}-${i}`} u={u} rank={i + 1} />
              ))}
            </ol>
          ) : (
            <p className="text-sm text-dim">No upgrade improves your simulated DPS with the items we know about.</p>
          )}
          {result.notes.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-dim">
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-faint">Gains are not additive: each is measured after the steps above it. Rating conversions are estimates.</p>
        </div>
      )}
    </OrnateCard>
  );
}
