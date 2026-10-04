import { cn } from "@/lib/utils";

interface Props {
  value: number;
  max: number;
  label: string;
  className?: string;
  tone?: "gold" | "ether";
  small?: boolean;
}

/** In-game XP bar: bevelled trough, ten tick marks, gold (or ether) fill with glow. */
export function XpBar({ value, max, label, className, tone = "gold", small }: Props) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <span className={cn("xp-bar block", small && "xp-bar-sm", className)} data-tone={tone} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span className="xp-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}
