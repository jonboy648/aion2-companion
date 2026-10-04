import { cn } from "@/lib/utils";
import type { Faction } from "./faction";

/** Single stylised wing (our own art): feathers fanning out; mirrored for the right side. */
export function WingMark({ className, flip }: { className?: string; flip?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 38 18" className={cn("wing", className)} style={flip ? { transform: "scaleX(-1)" } : undefined} fill="currentColor">
      <path d="M38 9.2C30 9 22 7 12 1.2 16 5.6 20 8 24 9.1 17 9.6 9 8.8 1 3.4 6 8.2 14 11.2 24 11.4 17 12.4 11 12.6 4 11 10 14.8 19 15.4 28 12.9 24 14.6 19 16.4 14 17.2 24 17.6 33 14 38 10.6Z" opacity=".95" />
      <circle cx="36.3" cy="9.9" r="1.7" />
    </svg>
  );
}

/** Faction crest: wings around a diamond. neutral = ether crystal, elyos = upswept wings, asmodian = angular wings. */
export function FactionEmblem({ faction, size = 28, className }: { faction: Faction; size?: number; className?: string }) {
  const id = `fe-${faction}`;
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 32 32" className={className} fill="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7dd96" />
          <stop offset="1" stopColor="#b8862c" />
        </linearGradient>
      </defs>
      {faction === "asmodian" ? (
        <g fill={`url(#${id})`}>
          <path d="M16 12 L2 3 6 15 3 24 12 20Z" />
          <path d="M16 12 L30 3 26 15 29 24 20 20Z" />
          <path d="M16 6 L21 16 16 28 11 16Z" stroke="#7a1d2b" strokeWidth="1" />
        </g>
      ) : faction === "elyos" ? (
        <g fill={`url(#${id})`}>
          <path d="M16 18 C10 18 5 13 2 4 8 7 12 8 16 8Z" />
          <path d="M16 18 C22 18 27 13 30 4 24 7 20 8 16 8Z" />
          <path d="M16 11 L19 17 16 27 13 17Z" stroke="#3b7cb0" strokeWidth="1" />
        </g>
      ) : (
        <g fill={`url(#${id})`}>
          <path d="M16 15 C10 15 5 12 2 6 8 8 12 8 16 9Z" />
          <path d="M16 15 C22 15 27 12 30 6 24 8 20 8 16 9Z" />
          <path d="M16 8 L21 17 16 28 11 17Z" stroke="#2f7fa3" strokeWidth="1" />
        </g>
      )}
    </svg>
  );
}

/** Thin gold rule with a centre diamond. */
export function OrnateDivider({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex items-center gap-2 text-[var(--metal)]", className)}>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-current opacity-60" />
      <svg viewBox="0 0 12 12" className="size-2.5" fill="currentColor">
        <path d="M6 0 12 6 6 12 0 6Z" />
      </svg>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-current opacity-60" />
    </div>
  );
}
