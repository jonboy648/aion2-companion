// Live server status: cron ingest of the dbaion2.ru population feed + official NCSOFT roster into D1, and the /status read side.
// Data only; no routing or CORS here (worker.js). See CONTRACT.md "Server status".

export const FEED_URL = "https://dbaion2.ru/api/servers";
export const ROSTER_URL = (region) => `https://aion2.plaync.com/en-us/api/gameinfo/servers?lang=en-US&region=${region}`;
export const STATUS_UA = "becomecube.com server-status (fan site; polls every 5 min; contact via becomecube.com)";
export const REGION_CODES = ["nae", "naw", "eu", "la", "as"];
const REGION_BY_DIGIT = { 1: "nae", 2: "naw", 3: "eu", 4: "la", 5: "as" };
export const HISTORY_DAYS = 30;
export const ROSTER_TTL_MS = 24 * 3600_000;
const MAX_ROWS = 200;
const FETCH_TIMEOUT_MS = 10_000;
const BATCH = 40;
const MIN = 60_000;
const HOUR = 3600_000;
const DAY = 24 * HOUR;

const hasDb = (env) => !!env?.STATS && typeof env.STATS.prepare === "function";

/** Strict name check: letters, digits, space, apostrophe, hyphen, dot; max 24. Anything else is dropped, never stored. */
export function cleanName(v) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return /^[\p{L}\p{N} '\-.]{1,24}$/u.test(s) ? s : null;
}

const intIn = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);

/** Region + race a server id encodes (Elyos 1RNN, Asmodian 2RNN), or null for anything that is not an Aion 2 Global id. */
export function idInfo(id) {
  if (!Number.isInteger(id) || id < 1101 || id > 2599) return null;
  const race = Math.floor(id / 1000);
  const region = REGION_BY_DIGIT[Math.floor(id / 100) % 10];
  const slot = id % 100;
  return region && slot >= 1 ? { race, region, slot } : null;
}

/**
 * Validate the dbaion2 feed. Returns {updated, servers} with only well-formed rows (ids must agree with region/race),
 * or null if the body is not the expected shape or has no usable row. Pure.
 */
export function parseFeed(body) {
  if (!body || typeof body !== "object" || !Array.isArray(body.servers)) return null;
  const updated = intIn(body.updated, 1, 4e12);
  const seen = new Set();
  const servers = [];
  for (const s of body.servers.slice(0, MAX_ROWS)) {
    if (!s || typeof s !== "object") continue;
    const info = idInfo(s.id);
    const name = cleanName(s.name);
    const cap = intIn(s.cap, 1, 100_000);
    const players = intIn(s.players, 0, 100_000);
    if (!info || !name || cap === null || players === null || seen.has(s.id)) continue;
    if (s.region !== info.region || s.race !== info.race) continue;
    const at = intIn(s.at, 1, 4e12) ?? updated;
    if (at === null) continue;
    seen.add(s.id);
    servers.push({ id: s.id, region: info.region, race: info.race, name, tags: (intIn(s.tags, 0, 255) ?? 0) & 7, capacity: cap, players, source_at: at, stale: s.stale === true });
  }
  return servers.length ? { updated, servers } : null;
}

/** Validate one official roster response ({serverList:[{raceId, serverId, serverName}]}) for a region. Pure. */
export function parseRoster(region, body) {
  const list = body?.serverList;
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const s of list.slice(0, MAX_ROWS)) {
    const info = idInfo(s?.serverId);
    const name = cleanName(s?.serverName);
    if (!info || !name || info.region !== region || s.raceId !== info.race || seen.has(s.serverId)) continue;
    seen.add(s.serverId);
    out.push({ id: s.serverId, region, race: info.race, name });
  }
  return out;
}

async function fetchJson(doFetch, url) {
  const res = await doFetch(url, { headers: { "User-Agent": STATUS_UA, Accept: "application/json" }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  return res.json();
}

const run = (db, sql, ...args) => db.prepare(sql).bind(...args);
async function batched(db, stmts) {
  for (let i = 0; i < stmts.length; i += BATCH) await db.batch(stmts.slice(i, i + BATCH));
}
const setMeta = (db, key, value) => run(db, "INSERT INTO status_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);

async function refreshRoster(db, doFetch, now) {
  const got = await Promise.allSettled(REGION_CODES.map(async (r) => parseRoster(r, await fetchJson(doFetch, ROSTER_URL(r)))));
  const rows = got.flatMap((g) => (g.status === "fulfilled" ? g.value : []));
  if (!rows.length) return;
  await batched(db, [
    ...rows.map((r) =>
      run(db, "INSERT INTO server_roster (server_id, region, race, name, fetched_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(server_id) DO UPDATE SET region = excluded.region, race = excluded.race, name = excluded.name, fetched_at = excluded.fetched_at", r.id, r.region, r.race, r.name, now),
    ),
    setMeta(db, "roster_at", now),
  ]);
}

/**
 * The 5-minute cron. Upstream failure keeps the previous rows and only records last_error_at.
 * deps.fetch / deps.now are for tests. Never throws (a cron error must not mask the next run).
 */
export async function runStatusCron(env, deps = {}) {
  if (!hasDb(env)) return { ok: false, reason: "no_db" };
  const db = env.STATS;
  const doFetch = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now();
  let feed = null;
  try {
    feed = parseFeed(await fetchJson(doFetch, FEED_URL));
  } catch {
    feed = null;
  }
  try {
    if (!feed) {
      await setMeta(db, "last_error_at", now).run();
      return { ok: false, reason: "upstream" };
    }
    const stmts = feed.servers.map((s) =>
      run(db, "INSERT INTO server_status (server_id, region, race, name, tags, capacity, players, source_at, stale, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(server_id) DO UPDATE SET region = excluded.region, race = excluded.race, name = excluded.name, tags = excluded.tags, capacity = excluded.capacity, players = excluded.players, source_at = excluded.source_at, stale = excluded.stale, fetched_at = excluded.fetched_at",
        s.id, s.region, s.race, s.name, s.tags, s.capacity, s.players, s.source_at, s.stale ? 1 : 0, now),
    );
    // a server absent from the feed is gone from the live table (the roster then shows it as having no data)
    stmts.push(run(db, "DELETE FROM server_status WHERE fetched_at < ?", now));
    // history only from fresh rows: repeating a stale count would draw a flat line that never happened
    const fresh = feed.servers.filter((s) => !s.stale);
    for (const s of fresh) stmts.push(run(db, "INSERT OR REPLACE INTO server_status_history (server_id, ts, players) VALUES (?, ?, ?)", s.id, now, s.players));
    for (const region of REGION_CODES) {
      const rows = fresh.filter((s) => s.region === region);
      if (rows.length) stmts.push(run(db, "INSERT OR REPLACE INTO region_history (region, ts, players) VALUES (?, ?, ?)", region, now, rows.reduce((a, s) => a + s.players, 0)));
    }
    stmts.push(run(db, "DELETE FROM server_status_history WHERE ts < ?", now - HISTORY_DAYS * DAY));
    stmts.push(run(db, "DELETE FROM region_history WHERE ts < ?", now - HISTORY_DAYS * DAY));
    stmts.push(setMeta(db, "last_ok_at", now));
    stmts.push(setMeta(db, "feed_updated", feed.updated ?? now));
    await batched(db, stmts);
  } catch {
    return { ok: false, reason: "db" };
  }
  try {
    const m = (await db.prepare("SELECT value FROM status_meta WHERE key = 'roster_at'").all()).results[0];
    if (!m || now - m.value >= ROSTER_TTL_MS) await refreshRoster(db, doFetch, now);
  } catch {
    // roster is cosmetic; the live counts are already stored
  }
  return { ok: true, servers: feed.servers.length };
}

// ---------------- read side ----------------

/** range -> [window ms, bucket ms, table is raw 5-minute rows when bucket is 0]. */
export const RANGES = { "24h": [DAY, 0], "7d": [7 * DAY, HOUR], "30d": [30 * DAY, 3 * HOUR] };

/** Region totals from merged server rows. players/capacity sum only rows that report. Pure. */
export function regionTotals(servers) {
  return REGION_CODES.map((region) => {
    const rows = servers.filter((s) => s.region === region);
    const live = rows.filter((s) => s.players !== null);
    return {
      region,
      servers: rows.length,
      reporting: live.length,
      players: live.reduce((a, s) => a + s.players, 0),
      capacity: live.reduce((a, s) => a + (s.capacity ?? 0), 0),
      stale: live.length > 0 && live.every((s) => s.stale),
      source_at: live.reduce((a, s) => Math.max(a, s.source_at ?? 0), 0) || null,
    };
  });
}

/** Fresh status rows plus official roster names for servers the feed does not list. */
export async function statusRows(db) {
  const live = (await db.prepare("SELECT server_id, region, race, name, tags, capacity, players, source_at, stale, fetched_at FROM server_status").all()).results;
  const roster = (await db.prepare("SELECT server_id, region, race, name FROM server_roster").all()).results;
  const have = new Set(live.map((r) => r.server_id));
  const servers = [
    ...live.map((r) => ({ id: r.server_id, region: r.region, race: r.race, name: r.name, tags: r.tags, capacity: r.capacity, players: r.players, source_at: r.source_at, stale: !!r.stale, fetched_at: r.fetched_at, listed: true })),
    ...roster.filter((r) => !have.has(r.server_id)).map((r) => ({ id: r.server_id, region: r.region, race: r.race, name: r.name, tags: 0, capacity: null, players: null, source_at: null, stale: false, fetched_at: null, listed: false })),
  ];
  servers.sort((a, b) => a.id % 1000 - b.id % 1000 || a.id - b.id);
  return servers;
}

export async function statusMeta(db) {
  const rows = (await db.prepare("SELECT key, value FROM status_meta").all()).results;
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { last_ok_at: m.last_ok_at ?? null, last_error_at: m.last_error_at ?? null, feed_updated: m.feed_updated ?? null };
}

/** Columnar region history for one range: {step_ms, ts:[...], regions:{nae:[n|null...]}}; gaps are null. */
export async function regionHistory(db, range, now) {
  const [win, bucket] = RANGES[range];
  const from = now - win;
  const step = bucket || 5 * MIN;
  const sql = bucket
    ? "SELECT (ts / ?) * ? AS t, region, AVG(players) AS p FROM region_history WHERE ts >= ? GROUP BY t, region ORDER BY t"
    : "SELECT ts AS t, region, players AS p FROM region_history WHERE ts >= ? ORDER BY t";
  const rows = (await db.prepare(sql).bind(...(bucket ? [bucket, bucket, from] : [from])).all()).results;
  const ts = [...new Set(rows.map((r) => r.t))];
  const idx = new Map(ts.map((t, i) => [t, i]));
  const regions = Object.fromEntries(REGION_CODES.map((r) => [r, ts.map(() => null)]));
  for (const r of rows) if (regions[r.region]) regions[r.region][idx.get(r.t)] = Math.round(r.p);
  return { step_ms: step, ts, regions };
}

/** History of one server pair (both faction halves), columnar like regionHistory. */
export async function pairHistory(db, serverId, range, now) {
  const base = serverId % 1000;
  const ids = [1000 + base, 2000 + base];
  const [win, bucket] = RANGES[range];
  const from = now - win;
  const sql = bucket
    ? "SELECT (ts / ?) * ? AS t, server_id, AVG(players) AS p FROM server_status_history WHERE server_id IN (?, ?) AND ts >= ? GROUP BY t, server_id ORDER BY t"
    : "SELECT ts AS t, server_id, players AS p FROM server_status_history WHERE server_id IN (?, ?) AND ts >= ? ORDER BY t";
  const rows = (await db.prepare(sql).bind(...(bucket ? [bucket, bucket] : []), ...ids, from).all()).results;
  const ts = [...new Set(rows.map((r) => r.t))];
  const idx = new Map(ts.map((t, i) => [t, i]));
  const elyos = ts.map(() => null);
  const asmodian = ts.map(() => null);
  for (const r of rows) (r.server_id === ids[0] ? elyos : asmodian)[idx.get(r.t)] = Math.round(r.p);
  return { pair: ids, range, step_ms: bucket || 5 * MIN, ts, elyos, asmodian };
}

/** The full /status body (without the optional per-pair history). */
export async function buildStatus(db, now) {
  const [servers, meta] = await Promise.all([statusRows(db), statusMeta(db)]);
  return { generated_at: now, ...meta, regions: regionTotals(servers), servers };
}
