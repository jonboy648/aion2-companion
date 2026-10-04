// Owner analytics (Cloudflare D1, binding STATS). Every writer is a silent no-op when the binding is absent,
// and every writer swallows its own errors: analytics must never break or slow a user-facing response.
// PRIVACY: raw IPs and user agents are never stored; see visitorId().

export const MAX_KEYWORD = 32;

/** Route patterns of the site (hash routes in web/src/App.tsx). /admin is deliberately not countable. */
const PATH_PATTERNS = [
  [/^\/$/, "/"],
  [/^\/(guide|build|daevanion|codex|keybinds|crafting|roadmap)$/, null],
  [/^\/codex\/[A-Za-z0-9_-]{1,40}$/, "/codex/:classKey"],
  [/^\/compare(\/[^/]{1,120}){0,2}$/, "/compare"],
  [/^\/c\/[a-z]{2,3}\/\d{1,6}\/[^/]{1,64}$/, "/c/:region/:serverId/:name"],
];

/** Returns the normalized route pattern for a site path, or null if it is not a known route / too long. */
export function normalizePath(path) {
  if (typeof path !== "string" || path.length < 1 || path.length > 200) return null;
  if (/[\u0000-\u001f\u007f?#\s]/.test(path)) return null;
  const p = path.length > 1 ? path.replace(/\/+$/, "") : path;
  for (const [re, name] of PATH_PATTERNS) if (re.test(p)) return name ?? p;
  return null;
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = (s) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));

export const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * Anonymous per-day visitor id: SHA-256(ip | day | ADMIN_SALT) truncated to 16 hex chars (64 bits).
 * The day is part of the input, so the id changes every UTC day and cannot be used to follow someone over time;
 * ADMIN_SALT (a Worker secret) stops anyone with a copy of the table from brute-forcing the IPv4 space.
 */
export async function visitorId(ip, env, day) {
  return hex(await sha256(`${ip}|${day}|${env?.ADMIN_SALT ?? ""}`)).slice(0, 16);
}

/** Constant-time string compare (both sides hashed to equal length first). */
export async function safeEqual(a, b) {
  const [x, y] = await Promise.all([sha256(String(a)), sha256(String(b))]);
  const u = new Uint8Array(x);
  const v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}

const hasDb = (env) => !!env?.STATS && typeof env.STATS.prepare === "function";

async function guarded(env, fn) {
  if (!hasDb(env)) return;
  try {
    await fn(env.STATS);
  } catch {
    /* analytics must never throw into the request path */
  }
}

export const clean = (s, max) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);

export function logVisit(env, { ip, path, now = Date.now() }) {
  return guarded(env, async (db) => {
    const day = utcDay(now);
    const visitor = await visitorId(ip, env, day);
    await db.prepare("INSERT INTO visits (day, path, visitor, ts) VALUES (?1, ?2, ?3, ?4)").bind(day, path, visitor, now).run();
  });
}

export function logSearch(env, { keyword, region, results, now = Date.now() }) {
  return guarded(env, async (db) => {
    const kw = clean(keyword, MAX_KEYWORD);
    if (!kw) return;
    await db
      .prepare("INSERT INTO searches (ts, keyword, region, results) VALUES (?1, ?2, ?3, ?4)")
      .bind(now, kw, region, results)
      .run();
  });
}

/** Attach the opened character to the latest unclaimed lookup (within 1 h) whose keyword the name starts with. */
export function logPicked(env, { name, server, now = Date.now() }) {
  return guarded(env, async (db) => {
    const n = clean(name, MAX_KEYWORD);
    const s = clean(server, MAX_KEYWORD);
    if (!n) return;
    await db
      .prepare(
        `UPDATE searches SET picked_name = ?1, picked_server = ?2
         WHERE rowid = (SELECT rowid FROM searches
                        WHERE picked_name IS NULL AND results > 0 AND ts >= ?3 AND instr(lower(?1), lower(keyword)) = 1
                        ORDER BY ts DESC LIMIT 1)`,
      )
      .bind(n, s, now - 3_600_000)
      .run();
  });
}

const dayOffset = (ms, back) => utcDay(ms - back * 86_400_000);

/** JSON for GET /admin/stats. Unique visitors for multi-day ranges = sum of daily uniques (ids rotate daily). */
export async function adminStats(env, now = Date.now()) {
  const db = env.STATS;
  const today = utcDay(now);
  const from7 = dayOffset(now, 6);
  const from30 = dayOffset(now, 29);
  const totalsSql = (where) =>
    `SELECT COUNT(*) AS page_views, COUNT(DISTINCT day || visitor) AS unique_visitors FROM visits ${where}`;
  const [t0, t7, t30, tAll, perDay, paths, top, recent] = await db.batch([
    db.prepare(totalsSql("WHERE day = ?1")).bind(today),
    db.prepare(totalsSql("WHERE day >= ?1")).bind(from7),
    db.prepare(totalsSql("WHERE day >= ?1")).bind(from30),
    db.prepare(totalsSql("")),
    db.prepare("SELECT day, COUNT(*) AS page_views, COUNT(DISTINCT visitor) AS unique_visitors FROM visits WHERE day >= ?1 GROUP BY day").bind(from30),
    db.prepare("SELECT path, COUNT(*) AS page_views FROM visits WHERE day >= ?1 GROUP BY path ORDER BY page_views DESC, path LIMIT 20").bind(from30),
    db.prepare(
      `SELECT MAX(keyword) AS keyword, COUNT(*) AS count, MAX(ts) AS last_ts FROM searches
       GROUP BY lower(keyword) ORDER BY count DESC, last_ts DESC LIMIT 50`,
    ),
    db.prepare("SELECT ts, keyword, region, results, picked_name, picked_server FROM searches ORDER BY ts DESC LIMIT 100"),
  ]);
  const one = (r) => ({
    page_views: Number(r.results?.[0]?.page_views ?? 0),
    unique_visitors: Number(r.results?.[0]?.unique_visitors ?? 0),
  });
  const byDay = new Map((perDay.results ?? []).map((r) => [r.day, r]));
  const visits_per_day = [];
  for (let i = 29; i >= 0; i--) {
    const day = dayOffset(now, i);
    const r = byDay.get(day);
    visits_per_day.push({ day, page_views: Number(r?.page_views ?? 0), unique_visitors: Number(r?.unique_visitors ?? 0) });
  }
  return {
    generated_at: now,
    totals: { today: one(t0), last_7_days: one(t7), last_30_days: one(t30), all_time: one(tAll) },
    visits_per_day,
    top_paths: paths.results ?? [],
    top_searches: top.results ?? [],
    recent_searches: (recent.results ?? []).map((r) => ({
      ts: r.ts,
      keyword: r.keyword,
      region: r.region,
      results: r.results,
      picked: r.picked_name ? { name: r.picked_name, server: r.picked_server } : null,
    })),
  };
}

export { hasDb };
