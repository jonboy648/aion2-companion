import { useState } from "react";
import { cn } from "@/lib/utils";

/** Official CDN icon (hotlinked, never hosted here). Falls back to an initial tile when missing or blocked. */
export function SkillIcon({
  url,
  name,
  size = 40,
  className,
}: {
  url: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (!url || failed) {
    return (
      <span
        aria-hidden
        style={style}
        className={cn("grid shrink-0 place-items-center rounded-md border border-border bg-surface3 text-xs font-semibold text-dim", className)}
      >
        {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={style}
      className={cn("shrink-0 rounded-md border border-border bg-surface3 object-cover", className)}
    />
  );
}
