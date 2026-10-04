/**
 * Owner analytics client (see proxy/CONTRACT.md: POST /hit, POST /picked, GET /admin/stats).
 * Anonymous by design: no cookies, no storage, nothing identifying is sent. Skipped entirely when the proxy URL
 * is unset (local dev, tests) or the browser asks not to be tracked (Do Not Track).
 */

const base = (): string => (import.meta.env.VITE_ARMORY_PROXY_URL ?? "").replace(/\/+$/, "");

const doNotTrack = (): boolean => typeof navigator !== "undefined" && navigator.doNotTrack === "1";

/** text/plain keeps the POST a CORS "simple request" (no preflight); the Worker parses the body as JSON anyway. */
function beacon(path: string, body: unknown): void {
  const url = base();
  if (!url || doNotTrack()) return;
  try {
    void fetch(`${url}${path}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "text/plain" },
      keepalive: true,
      credentials: "omit",
    }).catch(() => {});
  } catch {
    /* analytics must never break the page */
  }
}

let lastPath: string | null = null;

/** One page view per route change. Consecutive duplicates (StrictMode double effects) and /admin are ignored. */
export function trackHit(pathname: string): void {
  if (pathname === lastPath || pathname.startsWith("/admin")) return;
  lastPath = pathname;
  beacon("/hit", { path: pathname });
}

/** A user opened a character from the search results. */
export function trackPicked(name: string, serverName: string): void {
  beacon("/picked", { name, server: serverName });
}

export function _resetTrackingForTests(): void {
  lastPath = null;
}

// ---- admin dashboard ----
export interface Totals {
  page_views: number;
  unique_visitors: number;
}
export interface AdminStats {
  generated_at: number;
  totals: { today: Totals; last_7_days: Totals; last_30_days: Totals; all_time: Totals };
  visits_per_day: { day: string; page_views: number; unique_visitors: number }[];
  top_paths: { path: string; page_views: number }[];
  top_searches: { keyword: string; count: number; last_ts: number }[];
  recent_searches: { ts: number; keyword: string; region: string; results: number; picked: { name: string; server: string } | null }[];
}

export class AdminAuthError extends Error {}

export const ADMIN_TOKEN_KEY = "aion2.admin.token";

export async function fetchAdminStats(token: string): Promise<AdminStats> {
  const url = base();
  if (!url) throw new Error("Proxy not configured (VITE_ARMORY_PROXY_URL is unset in this build).");
  let res: Response;
  try {
    res = await fetch(`${url}/admin/stats`, { headers: { Authorization: `Bearer ${token}` }, credentials: "omit", cache: "no-store" });
  } catch {
    throw new Error("Could not reach the stats endpoint.");
  }
  if (res.status === 401) throw new AdminAuthError("Wrong token.");
  if (res.status === 503) throw new Error("The stats database (D1) is not connected to the Worker yet.");
  if (!res.ok) throw new Error(`The stats endpoint answered ${res.status}.`);
  return (await res.json()) as AdminStats;
}
