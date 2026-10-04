/** Party map markers: plain data that lives in a share link, so a party sees the same pins without any server. */

export const MARKER_KINDS = {
  question: { glyph: "?", label: "Unknown / check this" },
  boss: { glyph: "B", label: "Boss" },
  portal: { glyph: "P", label: "Portal" },
  cube: { glyph: "C", label: "Cube" },
  gather: { glyph: "G", label: "Gather" },
  member: { glyph: "M", label: "Party member" },
  rally: { glyph: "!", label: "Rally here" },
} as const;

export type MarkerKind = keyof typeof MARKER_KINDS;

export interface Marker {
  id: string;
  kind: MarkerKind;
  /** position on the board, 0..1 of its width and height */
  x: number;
  y: number;
  label: string;
}

export const MAX_MARKERS = 200;
export const MAX_LABEL = 40;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const isKind = (k: unknown): k is MarkerKind => typeof k === "string" && Object.prototype.hasOwnProperty.call(MARKER_KINDS, k);

/** Keep only well-formed markers from untrusted input (a pasted link): known kinds, finite coordinates, short labels. */
export function sanitize(input: unknown): Marker[] {
  if (!Array.isArray(input)) return [];
  const out: Marker[] = [];
  for (const m of input) {
    if (out.length >= MAX_MARKERS) break;
    if (!m || typeof m !== "object") continue;
    const { id, kind, x, y, label } = m as Record<string, unknown>;
    if (!isKind(kind) || typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({
      id: typeof id === "string" && id ? id.slice(0, 16) : `m${out.length}`,
      kind,
      x: clamp01(x),
      y: clamp01(y),
      label: typeof label === "string" ? label.slice(0, MAX_LABEL) : "",
    });
  }
  return out;
}

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

/** Markers -> url-safe text for a share link (rounded to 3 decimals to keep links short). */
export function encodeMarkers(markers: Marker[]): string {
  const compact = markers.map((m) => [m.kind, Math.round(m.x * 1000) / 1000, Math.round(m.y * 1000) / 1000, m.label]);
  return b64(JSON.stringify(compact));
}

/** Inverse of encodeMarkers. Bad input gives an empty list, never throws. */
export function decodeMarkers(text: string): Marker[] {
  try {
    const rows = JSON.parse(unb64(text));
    if (!Array.isArray(rows)) return [];
    return sanitize(rows.map((r, i) => (Array.isArray(r) ? { id: `m${i}`, kind: r[0], x: r[1], y: r[2], label: r[3] } : null)));
  } catch {
    return [];
  }
}
