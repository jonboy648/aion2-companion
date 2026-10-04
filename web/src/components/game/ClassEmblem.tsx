import { useState } from "react";
import { Crosshair, HeartPulse, Music, Shield, Sparkles, Sword, Swords, WandSparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const FALLBACK: Record<string, LucideIcon> = {
  gladiator: Swords,
  templar: Shield,
  assassin: Sword,
  ranger: Crosshair,
  sorcerer: WandSparkles,
  elementalist: Sparkles,
  spiritmaster: Sparkles,
  cleric: HeartPulse,
  chanter: Music,
};

/** The official emblem file is named "elementalist" even though the game shows the class as Spiritmaster. */
export function classEmblemUrl(classKey: string): string {
  const k = classKey.toLowerCase() === "spiritmaster" ? "elementalist" : classKey.toLowerCase();
  return `https://assets.playnccdn.com/static-aion2/characters/img/class/class_icon_${k}.png`;
}

/** Official class emblem (hotlinked from NCSoft's CDN, never re-hosted); our own line glyph when it fails to load. */
export function ClassEmblem({ classKey, size = 44, className }: { classKey: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const Fallback = FALLBACK[classKey.toLowerCase()] ?? Sparkles;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full border border-[var(--metal)] bg-[radial-gradient(circle_at_50%_35%,#27355f,#0f1730)] shadow-[0_0_12px_-2px_rgb(var(--ether)/0.55),inset_0_0_6px_rgb(0_0_0/0.45)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {failed ? (
        <Fallback className="text-[var(--metal-hi)]" style={{ width: size * 0.5, height: size * 0.5 }} />
      ) : (
        <img src={classEmblemUrl(classKey)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} style={{ width: size * 0.78, height: size * 0.78 }} className="object-contain" />
      )}
    </span>
  );
}
