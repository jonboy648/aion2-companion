import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
  ring?: string;
}

/**
 * Official skill icon, hotlinked from NCSoft's CDN (never hosted by us). Falls back to the skill's
 * initials in a gold-ringed tile when the URL is missing or fails to load.
 */
export function SkillIcon({ name, url, size = 40, className, ring }: Props) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-surface3", className)}
      style={{ width: size, height: size, borderColor: ring ?? "var(--border)" }}
      title={name}
    >
      {url && !failed ? (
        <img src={url} alt={name} width={size} height={size} loading="eager" decoding="async" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        <span aria-label={name} className="text-[11px] font-semibold text-gold-lo" style={{ fontSize: Math.max(10, size / 3.2) }}>
          {initials}
        </span>
      )}
    </span>
  );
}
