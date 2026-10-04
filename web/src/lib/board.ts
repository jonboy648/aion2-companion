/**
 * Public board client (see proxy/CONTRACT.md: GET /board, POST /board/dps).
 * Rows are public armory fields recorded by the Worker itself; the only browser-supplied number is the
 * max-potential DPS estimate, which the Worker clamps and only attaches to a character it has already seen.
 */

export type BoardSort = "recent" | "power" | "dps";

export interface BoardRow {
  name: string;
  class_name: string;
  server_name: string;
  region: string;
  server_id: number;
  level: number | null;
  combat_power: number | null;
  max_dps: number | null;
  /** unix ms of the latest lookup */
  last_seen: number;
}

const base = (): string => (import.meta.env.VITE_ARMORY_PROXY_URL ?? "").replace(/\/+$/, "");

export class BoardUnavailable extends Error {}

/** GET /board. Rejects with BoardUnavailable when the proxy is not configured or has no board yet. */
export async function fetchBoard(sort: BoardSort, className = "", limit = 25): Promise<BoardRow[]> {
  const url = base();
  if (!url) throw new BoardUnavailable("The board is not available in this build.");
  const qs = new URLSearchParams({ sort, limit: String(limit) });
  if (className) qs.set("class", className);
  let res: Response;
  try {
    res = await fetch(`${url}/board?${qs}`, { credentials: "omit" });
  } catch {
    throw new BoardUnavailable("Could not reach the board. Try again in a moment.");
  }
  if (!res.ok) throw new BoardUnavailable(res.status === 429 ? "Too many requests, wait a moment." : "The board is not available right now.");
  return ((await res.json()) as { rows: BoardRow[] }).rows;
}

const doNotTrack = (): boolean => typeof navigator !== "undefined" && navigator.doNotTrack === "1";

/**
 * Send the character's max-potential DPS estimate (boss playstyle, obtainable gear) so it can rank on the board.
 * Fire and forget; never throws. Skipped when the proxy is unset or Do Not Track is on.
 */
export function submitMaxDps(c: { region: string; serverId: number; characterId: string; dps: number }): void {
  const url = base();
  if (!url || doNotTrack() || !Number.isFinite(c.dps) || c.dps < 1) return;
  try {
    void fetch(`${url}/board/dps`, {
      method: "POST",
      body: JSON.stringify({ ...c, dps: Math.round(c.dps) }),
      headers: { "Content-Type": "text/plain" },
      keepalive: true,
      credentials: "omit",
    }).catch(() => {});
  } catch {
    /* the board must never break the page */
  }
}

/** "5 min ago" style label for a unix-ms time. */
export function ago(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export const REGION_LABEL: Record<string, string> = { nae: "NA East", naw: "NA West", eu: "EU", la: "LA", as: "Asia" };
