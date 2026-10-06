import type { GameMapMeta, UserMarkerInstance, UserMarkerLocalType } from "../types/game";

const KINDS = new Set<UserMarkerLocalType>(["completed", "location", "fox", "favorite", "gathering", "creature"]);
export const MAX_PARTY_PINS = 200;
export type PartyShare = { zone: string; pins: UserMarkerInstance[] };

export function sanitizePartyPins(input: unknown, map: GameMapMeta): UserMarkerInstance[] {
  if (!Array.isArray(input)) return [];
  const pins: UserMarkerInstance[] = [];
  for (const row of input) {
    if (pins.length === MAX_PARTY_PINS) break;
    if (!Array.isArray(row)) continue;
    const [kind, x, y, label] = row;
    if (!KINDS.has(kind) || typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    pins.push({ id: `party-${pins.length}`, markerId: "", subtype: "", mapId: map.id,
      type: "local", localType: kind,
      x: Math.max(0, Math.min(map.tileWidth * map.tilesCountX, x)),
      y: Math.max(0, Math.min(map.tileHeight * map.tilesCountY, y)),
      name: typeof label === "string" ? label.slice(0, 40) : "",
      description: "", image: "" });
  }
  return pins;
}

export function encodePartyLink(map: GameMapMeta, markers: UserMarkerInstance[]): string {
  const rows = markers.filter(m => m.type === "local").map(m => [m.localType ?? "fox", m.x, m.y, m.name]);
  const pins = sanitizePartyPins(rows, map).map(m => [m.localType, Math.round(m.x), Math.round(m.y), m.name]);
  const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, zone: map.name, pins }));
  return btoa(Array.from(bytes, b => String.fromCharCode(b)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePartyLink(value: string | null, maps: GameMapMeta[]): PartyShare | null {
  try {
    if (!value || value.length > 100000 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
    const bytes = Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || data.v !== 1 || !Array.isArray(data.pins)) return null;
    const map = maps.find(m => m.name === data.zone);
    return map ? { zone: map.name, pins: sanitizePartyPins(data.pins, map) } : null;
  } catch { return null; }
}
