/**
 * Live server status client (see proxy/CONTRACT.md "Live server status": GET /status).
 * Population numbers are the upstream's own (dbaion2.ru); load labels and the pairing/total maths here are ours.
 * A "server" is one faction half (its own server id and name); a "pair" is the two halves sharing serverId % 100.
 */

export type StatusRegion = "nae" | "naw" | "eu" | "la" | "as";
export const STATUS_REGIONS: { code: StatusRegion; label: string }[] = [
  { code: "nae", label: "NA East" },
  { code: "naw", label: "NA West" },
  { code: "eu", label: "Europe" },
  { code: "la", label: "South America" },
  { code: "as", label: "Asia" },
];
export const REGION_COLOR: Record<StatusRegion, string> = { nae: "#5fd0f0", naw: "#4cc38a", eu: "#e0b458", la: "#ef6f78", as: "#b583f0" };

/**
 * OUR ESTIMATE, not an official figure: NCSOFT publishes no queue or load numbers. A server's load is players / capacity
 * as reported by the population feed. Below `busy` is Good, from `busy` up to (not including) `full` is Busy, `full` and up is Full.
 */
export const LOAD_THRESHOLDS = { busy: 0.7, full: 0.95 } as const;
export type LoadLevel = "good" | "busy" | "full" | "offline";
export const LOAD_LABEL: Record<LoadLevel, string> = { good: "Good", busy: "Busy", full: "Full", offline: "Maintenance / offline" };

export const TAG_NEW = 1;
export const TAG_RECOMMENDED = 2;
export const TAG_CREATION_BLOCKED = 4;

export interface StatusServer {
  id: number;
  region: StatusRegion;
  /** 1 Elyos, 2 Asmodian */
  race: 1 | 2;
  name: string;
  tags: number;
  capacity: number | null;
  /** null when the population feed does not list the server (name comes from the official roster) */
  players: number | null;
  source_at: number | null;
  stale: boolean;
  fetched_at: number | null;
  listed: boolean;
}
export interface RegionTotal {
  region: StatusRegion;
  servers: number;
  reporting: number;
  players: number;
  capacity: number;
  stale: boolean;
  source_at: number | null;
}
export interface RegionHistory {
  step_ms: number;
  ts: number[];
  regions: Partial<Record<StatusRegion, (number | null)[]>>;
}
export type HistoryRange = "24h" | "7d" | "30d";
export interface StatusResponse {
  generated_at: number;
  last_ok_at: number | null;
  last_error_at: number | null;
  feed_updated: number | null;
  regions: RegionTotal[];
  servers: StatusServer[];
  history: Partial<Record<HistoryRange, RegionHistory>>;
}

export function loadLevel(players: number | null, capacity: number | null): LoadLevel {
  if (players === null || !capacity || capacity <= 0) return "offline";
  const r = players / capacity;
  return r >= LOAD_THRESHOLDS.full ? "full" : r >= LOAD_THRESHOLDS.busy ? "busy" : "good";
}

export interface ServerPair {
  region: StatusRegion;
  /** serverId % 100 */
  slot: number;
  elyos: StatusServer | null;
  asmodian: StatusServer | null;
}

/** Group servers into pairs by serverId % 100 within a region, ordered by region then slot. */
export function pairServers(servers: readonly StatusServer[]): ServerPair[] {
  const map = new Map<string, ServerPair>();
  for (const s of servers) {
    const slot = s.id % 100;
    const key = `${s.region}:${slot}`;
    const p = map.get(key) ?? { region: s.region, slot, elyos: null, asmodian: null };
    if (s.race === 1) p.elyos = s;
    else p.asmodian = s;
    map.set(key, p);
  }
  const order = (r: StatusRegion) => STATUS_REGIONS.findIndex((x) => x.code === r);
  return [...map.values()].sort((a, b) => order(a.region) - order(b.region) || a.slot - b.slot);
}

export interface Summary {
  players: number;
  capacity: number;
  elyosPlayers: number;
  asmodianPlayers: number;
  /** null when nobody is counted */
  elyosPct: number | null;
  asmodianPct: number | null;
  serversTotal: number;
  /** servers the feed reports a count for */
  serversOnline: number;
  fullServers: number;
  creationLocked: number;
  /** regions whose counts the upstream flags as old */
  staleRegions: StatusRegion[];
}

/** Whole-site totals from the server rows. Servers without a count add nothing; stale counts are included and reported. */
export function summarize(servers: readonly StatusServer[]): Summary {
  const live = servers.filter((s) => s.players !== null);
  const sum = (rows: readonly StatusServer[]) => rows.reduce((a, s) => a + (s.players ?? 0), 0);
  const players = sum(live);
  const elyosPlayers = sum(live.filter((s) => s.race === 1));
  const asmodianPlayers = sum(live.filter((s) => s.race === 2));
  const pct = (n: number) => (players > 0 ? (n / players) * 100 : null);
  const stale = new Set<StatusRegion>();
  for (const r of STATUS_REGIONS) {
    const rows = live.filter((s) => s.region === r.code);
    if (rows.length && rows.every((s) => s.stale)) stale.add(r.code);
  }
  return {
    players,
    capacity: live.reduce((a, s) => a + (s.capacity ?? 0), 0),
    elyosPlayers,
    asmodianPlayers,
    elyosPct: pct(elyosPlayers),
    asmodianPct: pct(asmodianPlayers),
    serversTotal: servers.length,
    serversOnline: live.length,
    fullServers: live.filter((s) => loadLevel(s.players, s.capacity) === "full").length,
    creationLocked: servers.filter((s) => (s.tags & TAG_CREATION_BLOCKED) !== 0).length,
    staleRegions: [...stale],
  };
}

/** Highest summed player count across the 24h history, or null with no history. */
export function peak(h: RegionHistory | undefined): number | null {
  if (!h || h.ts.length === 0) return null;
  let best: number | null = null;
  h.ts.forEach((_, i) => {
    let any = false;
    let total = 0;
    for (const arr of Object.values(h.regions)) {
      const v = arr?.[i];
      if (typeof v === "number") {
        any = true;
        total += v;
      }
    }
    if (any && (best === null || total > best)) best = total;
  });
  return best;
}

export type ChartPoint = { ts: number } & Partial<Record<StatusRegion, number | null>>;
/** Columnar history to recharts rows. */
export function chartRows(h: RegionHistory | undefined): ChartPoint[] {
  if (!h) return [];
  return h.ts.map((ts, i) => {
    const row: ChartPoint = { ts };
    for (const r of STATUS_REGIONS) row[r.code] = h.regions[r.code]?.[i] ?? null;
    return row;
  });
}

export function ageText(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

const base = (): string => (import.meta.env.VITE_ARMORY_PROXY_URL ?? "").replace(/\/+$/, "");

export class StatusUnavailable extends Error {}

/** GET /status. Rejects with StatusUnavailable (message safe to show) when the proxy is missing, down or answers oddly. */
export async function fetchStatus(signal?: AbortSignal): Promise<StatusResponse> {
  const url = base();
  if (!url) throw new StatusUnavailable("Server status is not available in this build.");
  let res: Response;
  try {
    res = await fetch(`${url}/status`, { credentials: "omit", signal, headers: { Accept: "application/json" } });
  } catch {
    if (signal?.aborted) throw new StatusUnavailable("aborted");
    throw new StatusUnavailable("Could not reach the status service. Check your connection; this page retries every minute.");
  }
  if (!res.ok) throw new StatusUnavailable(res.status === 429 ? "Too many requests, wait a moment." : "Server status is not available right now. This page retries every minute.");
  let body: any;
  try {
    body = await res.json();
  } catch {
    throw new StatusUnavailable("The status service sent something unexpected. This page retries every minute.");
  }
  if (!body || !Array.isArray(body.servers) || !Array.isArray(body.regions)) throw new StatusUnavailable("The status service sent something unexpected. This page retries every minute.");
  return { history: {}, ...body } as StatusResponse;
}
