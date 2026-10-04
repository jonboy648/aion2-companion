import { IconFrame, type Rarity } from "@/components/game/IconFrame";

interface Props {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
  rarity?: Rarity;
  /** kept for older call sites; the rarity frame replaces the ring */
  ring?: string;
}

/**
 * Official skill icon, hotlinked from NCSoft's CDN (never hosted by us), in an inventory-style rarity frame.
 * Falls back to the skill's initials when the URL is missing or fails to load.
 */
export function SkillIcon({ name, url, size = 40, className, rarity, ring }: Props) {
  return <IconFrame name={name} url={url} size={size} className={className} rarity={rarity ?? (ring ? "unique" : "epic")} eager />;
}
