import { IconFrame, type Rarity } from "@/components/game/IconFrame";
import type { Confidence, Element, Num } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fmtNum } from "./logic";

const CONF_STYLE: Record<Confidence, string> = {
  confirmed: "border-confirmed/40 bg-confirmed/10 text-confirmed",
  estimated: "border-estimated/40 bg-estimated/10 text-estimated",
  unknown: "border-unknown/40 bg-unknown/10 text-unknown",
};
const CONF_MARK: Record<Confidence, string> = { confirmed: "✓", estimated: "~", unknown: "?" };

export function ConfidenceBadge({ confidence, source }: { confidence: Confidence; source?: string }) {
  return (
    <span
      title={source ? `${confidence}: ${source}` : confidence}
      className={cn("inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-medium leading-4", CONF_STYLE[confidence])}
    >
      {CONF_MARK[confidence]} {confidence}
    </span>
  );
}

/** A number with its confidence mark and a hover title with the source. */
export function NumCell({ n, unit, digits }: { n: Num; unit?: string; digits?: number }) {
  const col = n.confidence === "confirmed" ? "text-foreground" : n.confidence === "estimated" ? "text-estimated" : "text-unknown";
  return (
    <span className={cn("tabular-nums", col)} title={`${n.confidence}: ${n.source}`}>
      {fmtNum(n, unit, digits)}
    </span>
  );
}

const ELEMENT_COLOR: Record<Element, string> = { fire: "#ef7a3d", water: "#4cc3e8", earth: "#b98d35", none: "#6b7699" };

export function ElementDot({ element }: { element: Element }) {
  if (element === "none") return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-dim">
      <span className="inline-block size-2 rounded-full" style={{ background: ELEMENT_COLOR[element] }} aria-hidden />
      {element}
    </span>
  );
}

/** Official CDN icon (hotlinked) in a rarity frame. Shows initials when the URL is missing or fails to load. */
export function SkillIcon({ url, name, size = 48, className, rarity }: { url: string | null | undefined; name: string; size?: number; className?: string; rarity?: Rarity }) {
  return <IconFrame url={url} name={name} size={size} className={className} rarity={rarity ?? "epic"} alt="" />;
}
