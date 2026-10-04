import { IconFrame, type Rarity } from "@/components/game/IconFrame";

/** Official CDN icon (hotlinked, never hosted here) in a rarity frame. Falls back to initials when missing or blocked. */
export function SkillIcon({
  url,
  name,
  size = 40,
  className,
  rarity,
}: {
  url: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
  rarity?: Rarity;
}) {
  return <IconFrame url={url} name={name} size={size} className={className} rarity={rarity ?? "epic"} alt="" />;
}
