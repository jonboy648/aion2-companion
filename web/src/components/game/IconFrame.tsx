import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type Rarity = "common" | "rare" | "epic" | "unique" | "legend" | "heroic" | "ultimate";

/** Armory/crafting grade string -> rarity ("legendary" counts as legend). Unknown -> common. */
export function rarityOf(grade: string | null | undefined): Rarity {
  const g = (grade ?? "").trim().toLowerCase();
  if (g === "legendary") return "legend";
  return (["common", "rare", "epic", "unique", "legend", "heroic", "ultimate"] as const).find((r) => r === g) ?? "common";
}

interface Props {
  /** official icon URL (hotlinked from NCSoft's CDN, never hosted here) */
  url?: string | null;
  name: string;
  size?: number;
  rarity?: Rarity;
  className?: string;
  /** alt text; icons next to a visible label may pass "" */
  alt?: string;
  eager?: boolean;
  title?: string;
}

/** In-game inventory style item/skill icon: rarity gradient frame, inner bevel, soft glow; initials when the image is missing. */
export function IconFrame({ url, name, size = 40, rarity = "epic", className, alt, eager, title }: Props) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const style: CSSProperties = { width: size, height: size };
  return (
    <span className={cn("icon-frame", className)} data-rarity={rarity} style={style} title={title ?? name}>
      {url && !failed ? (
        <img src={url} alt={alt ?? name} loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <span aria-label={alt ?? name} className="grid place-items-center font-semibold text-[#d9c27a]" style={{ fontSize: Math.max(9, size / 3.2) }}>
          {initials || "?"}
        </span>
      )}
    </span>
  );
}
