// Aion 2 armory proxy (Cloudflare Worker). Whitelisted armory GET routes plus owner analytics; see CONTRACT.md.
// Secrets (set with `wrangler secret put`, optional): ADMIN_TOKEN, ADMIN_SALT. Optional D1 binding: STATS.
import { adminStats, hasDb, logPicked, logSearch, logVisit, normalizePath, safeEqual, clean, MAX_KEYWORD } from "./stats.js";
import { RANGES, buildStatus, pairHistory, regionHistory, runStatusCron, idInfo } from "./status.js";
import { BOARD_SORTS, MAX_DPS, boardRows, recordDps, recordInfo } from "./board.js";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const REGIONS = new Set(["nae", "naw", "eu", "la", "as"]);
const TIMEOUT_MS = 10_000;
const CACHE_TTL_S = 600;
const FRESH_MIN_AGE_MS = 30_000; // ?fresh=1 re-reads the armory, but not more often than this per cached entry
const RATE_LIMIT = 60; // requests per rolling minute per IP, per isolate (best-effort)
const RATE_WINDOW_MS = 60_000;

const SEARCH_BASE = "https://api-search.plaync.com/aion2global/search/v2/character";
const CHAR_BASE = "https://aion2.plaync.com/api/character";

const intRange = (min, max) => (v) => (/^\d{1,6}$/.test(v) && +v >= min && +v <= max ? String(+v) : null);
const validators = {
  region: (v) => (REGIONS.has(v) ? v : null),
  serverId: (v) => (/^\d{1,6}$/.test(v) ? String(+v) : null),
  // decoded characterId (base64-ish) or the armory's own percent-encoded form
  characterId: (v) => (/^[A-Za-z0-9_\-=+/%]{8,128}$/.test(v) && !/%(?![0-9A-Fa-f]{2})/.test(v) ? v : null),
  // each class has its own board range (Templar 21-26, Sorcerer 61-68, Cleric 71-76, ...)
  boardId: (v) => (/^\d{1,4}$/.test(v) && +v > 0 ? String(+v) : null),
  keyword: (v) => (v.length >= 1 && v.length <= 32 && !/[\u0000-\u001f\u007f]/.test(v) ? v : null),
  fresh: (v) => (v === "1" ? "1" : null),
  page: intRange(1, 10),
  size: intRange(1, 100),
};

const ROUTES = {
  "/search": { required: ["keyword", "region"], optional: { page: "1", size: "100" } },
  "/info": { required: ["characterId", "serverId", "region"], optional: { fresh: "" } },
  "/equipment": { required: ["characterId", "serverId", "region"], optional: { fresh: "" } },
  "/daevanion": { required: ["characterId", "serverId", "region", "boardId"], optional: { fresh: "" } },
};

// A characterId that still contains "%" is already in the armory's percent-encoded form: send as-is.
const encId = (v) => (v.includes("%") ? v : encodeURIComponent(v));

function upstreamUrl(path, p) {
  if (path === "/search") {
    return `${SEARCH_BASE}?keyword=${encodeURIComponent(p.keyword)}&page=${p.page}&size=${p.size}&localeInfo=en-US&region=${p.region}&serverId=`;
  }
  const action = path === "/daevanion" ? "daevanion/detail" : path.slice(1);
  let u = `${CHAR_BASE}/${action}?lang=en-US&characterId=${encId(p.characterId)}&serverId=${p.serverId}&region=${p.region}`;
  if (path === "/daevanion") u += `&boardId=${p.boardId}`;
  return u;
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = (env?.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body, status, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

// ---- rate limit: in-memory token bucket per IP. Per isolate, so best-effort, not a hard guarantee. ----
const buckets = new Map();
/** Returns 0 if allowed, else seconds to wait. */
export function rateLimit(ip, now = Date.now()) {
  let b = buckets.get(ip);
  if (!b) {
    if (buckets.size > 5000) for (const [k, v] of buckets) if (now - v.t > RATE_WINDOW_MS) buckets.delete(k);
    b = { tokens: RATE_LIMIT, t: now };
    buckets.set(ip, b);
  }
  b.tokens = Math.min(RATE_LIMIT, b.tokens + ((now - b.t) / RATE_WINDOW_MS) * RATE_LIMIT);
  b.t = now;
  if (b.tokens < 1) return Math.ceil(((1 - b.tokens) / RATE_LIMIT) * (RATE_WINDOW_MS / 1000));
  b.tokens -= 1;
  return 0;
}
export function _resetRateLimit() {
  buckets.clear();
}

// ---- analytics glue ----
/** Run a logging job off the response path. No STATS binding: nothing is scheduled at all. */
function track(env, ctx, job) {
  if (!hasDb(env)) return;
  const p = Promise.resolve().then(job).catch(() => {});
  if (ctx?.waitUntil) ctx.waitUntil(p);
}

/** Number of hits in an upstream /search body (`{list:[...]}` or a bare array); 0 if unparseable. */
function resultCount(buf) {
  try {
    const j = JSON.parse(new TextDecoder().decode(buf));
    const rows = Array.isArray(j) ? j : j?.list;
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
}

async function readJsonBody(request) {
  try {
    const text = await request.text();
    if (text.length > 1024) return null;
    const j = JSON.parse(text);
    return j && typeof j === "object" && !Array.isArray(j) ? j : null;
  } catch {
    return null;
  }
}

/** POST /hit {path} and POST /picked {name, server}: fire-and-forget beacons from the site. */
async function handleBeacon(request, pathname, env, ctx, cors) {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { Allow: "POST, OPTIONS", ...cors });
  // browsers always send Origin on cross-origin POST; only our own site may feed the log
  if (!cors["Access-Control-Allow-Origin"]) return json({ error: "forbidden_origin" }, 403, cors);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const retry = rateLimit(`beacon:${ip}`);
  if (retry) return json({ error: "rate_limited" }, 429, { "Retry-After": String(retry), ...cors });
  const body = await readJsonBody(request);
  if (!body) return json({ error: "bad_request" }, 400, cors);
  if (pathname === "/hit") {
    const path = normalizePath(body.path);
    if (!path) return json({ error: "bad_request", param: "path" }, 400, cors);
    track(env, ctx, () => logVisit(env, { ip, path }));
  } else {
    const name = clean(body.name, MAX_KEYWORD + 1);
    const server = clean(body.server, MAX_KEYWORD + 1);
    if (!name || name.length > MAX_KEYWORD) return json({ error: "bad_request", param: "name" }, 400, cors);
    if (server.length > MAX_KEYWORD) return json({ error: "bad_request", param: "server" }, 400, cors);
    track(env, ctx, () => logPicked(env, { name, server }));
  }
  return new Response(null, { status: 204, headers: cors });
}

/** GET /board?sort=recent|power|dps&class=&limit=: public recent lookups and leaderboards (public armory fields only). */
async function handleBoard(request, url, env, cors) {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { Allow: "GET, OPTIONS", ...cors });
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const retry = rateLimit(`board:${ip}`);
  if (retry) return json({ error: "rate_limited" }, 429, { "Retry-After": String(retry), ...cors });
  const sort = url.searchParams.get("sort") ?? "recent";
  if (!BOARD_SORTS.has(sort)) return json({ error: "bad_request", param: "sort" }, 400, cors);
  const rawClass = url.searchParams.get("class") ?? "";
  const className = clean(rawClass, 24);
  if (rawClass && !/^[A-Za-z' -]{1,24}$/.test(className)) return json({ error: "bad_request", param: "class" }, 400, cors);
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit === null ? 25 : /^\d{1,3}$/.test(rawLimit) && +rawLimit >= 1 && +rawLimit <= 50 ? +rawLimit : null;
  if (limit === null) return json({ error: "bad_request", param: "limit" }, 400, cors);
  if (!hasDb(env)) return json({ error: "board_unavailable" }, 503, cors);
  try {
    const rows = await boardRows(env, { sort, className, limit });
    return json({ sort, generated_at: Date.now(), rows }, 200, { "Cache-Control": "public, max-age=30", ...cors });
  } catch {
    return json({ error: "board_error" }, 500, cors);
  }
}

/** POST /board/dps {region, serverId, characterId, dps}: the browser's max-potential estimate for an already-seen character. */
async function handleBoardDps(request, env, cors) {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { Allow: "POST, OPTIONS", ...cors });
  if (!cors["Access-Control-Allow-Origin"]) return json({ error: "forbidden_origin" }, 403, cors);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const retry = rateLimit(`boarddps:${ip}`);
  if (retry) return json({ error: "rate_limited" }, 429, { "Retry-After": String(retry), ...cors });
  const body = await readJsonBody(request);
  if (!body) return json({ error: "bad_request" }, 400, cors);
  const region = typeof body.region === "string" ? validators.region(body.region) : null;
  const serverId = Number.isInteger(body.serverId) && body.serverId >= 1 && body.serverId <= 999_999 ? body.serverId : null;
  const characterId = typeof body.characterId === "string" ? validators.characterId(body.characterId) : null;
  const dps = Number.isFinite(body.dps) && body.dps >= 1 && body.dps <= MAX_DPS ? Math.round(body.dps) : null;
  for (const [param, v] of [["region", region], ["serverId", serverId], ["characterId", characterId], ["dps", dps]]) {
    if (v === null) return json({ error: "bad_request", param }, 400, cors);
  }
  if (!hasDb(env)) return json({ error: "board_unavailable" }, 503, cors);
  try {
    const out = await recordDps(env, { region, serverId, characterId, dps });
    return out === "unknown" ? json({ error: "unknown_character" }, 404, cors) : new Response(null, { status: 204, headers: cors });
  } catch {
    return json({ error: "board_error" }, 500, cors);
  }
}


const STATUS_TTL_S = 60;
const HISTORY_TTL_S = { "24h": 300, "7d": 3600, "30d": 3600 }; // history rows are scanned from D1: keep reads rare (free tier)

/** Cache a JSON-able value under a synthetic key for ttl seconds (no cache available: compute every time). */
async function memo(cache, key, ttl, fn) {
  const k = new Request(`https://cache.invalid/${key}`);
  const hit = cache ? await cache.match(k) : undefined;
  if (hit) return hit.json();
  const v = await fn();
  if (cache) await cache.put(k, new Response(JSON.stringify(v), { headers: { "Cache-Control": `public, max-age=${ttl}` } }));
  return v;
}

/** GET /status[?server=<id>&range=24h|7d|30d]: latest server rows, region totals and region history. Public, cached ~60 s. */
async function handleStatus(request, url, env, ctx, cors, deps) {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { Allow: "GET, OPTIONS", ...cors });
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const retry = rateLimit(`status:${ip}`);
  if (retry) return json({ error: "rate_limited" }, 429, { "Retry-After": String(retry), ...cors });
  const rawServer = url.searchParams.get("server");
  const server = rawServer === null ? null : /^\d{4}$/.test(rawServer) && idInfo(+rawServer) ? +rawServer : undefined;
  if (server === undefined) return json({ error: "bad_request", param: "server" }, 400, cors);
  const range = url.searchParams.get("range") ?? "24h";
  if (!Object.hasOwn(RANGES, range)) return json({ error: "bad_request", param: "range" }, 400, cors);
  if (!hasDb(env)) return json({ error: "status_unavailable" }, 503, cors);

  const cache = deps.cache ?? (typeof caches !== "undefined" ? caches.default : null);
  const key = new Request(`https://cache.invalid/status?server=${server ?? ""}&range=${server ? range : ""}`);
  const hit = cache ? await cache.match(key) : undefined;
  if (hit) {
    const h = new Headers(hit.headers);
    h.set("X-Cache", "HIT");
    for (const [k, v] of Object.entries(cors)) h.set(k, v);
    return new Response(hit.body, { status: 200, headers: h });
  }
  try {
    const now = Date.now();
    const db = env.STATS;
    const body = server
      ? { generated_at: now, ...(await memo(cache, `pair-${server}-${range}`, HISTORY_TTL_S[range], () => pairHistory(db, server, range, now))) }
      : {
          ...(await buildStatus(db, now)),
          history: Object.fromEntries(await Promise.all(Object.keys(RANGES).map(async (r) => [r, await memo(cache, `region-history-${r}`, HISTORY_TTL_S[r], () => regionHistory(db, r, now))]))),
        };
    const res = json(body, 200, { "Cache-Control": `public, max-age=${STATUS_TTL_S}`, ...cors });
    if (cache) {
      const put = cache.put(key, res.clone());
      if (ctx?.waitUntil) ctx.waitUntil(put);
      else await put;
    }
    return res;
  } catch {
    return json({ error: "status_error" }, 500, cors);
  }
}

/** GET /admin/stats with `Authorization: Bearer <ADMIN_TOKEN>`. */
async function handleAdmin(request, env, cors) {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { Allow: "GET, OPTIONS", ...cors });
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const retry = rateLimit(`admin:${ip}`);
  if (retry) return json({ error: "rate_limited" }, 429, { "Retry-After": String(retry), ...cors });
  const m = /^Bearer (.+)$/.exec(request.headers.get("Authorization") ?? "");
  const token = env?.ADMIN_TOKEN;
  const ok = m && typeof token === "string" && token.length > 0 && (await safeEqual(m[1], token));
  if (!ok) return json({ error: "unauthorized" }, 401, { "WWW-Authenticate": "Bearer", ...cors });
  if (!hasDb(env)) return json({ error: "stats_unavailable" }, 503, cors);
  try {
    return json(await adminStats(env), 200, { "Cache-Control": "no-store", ...cors });
  } catch {
    return json({ error: "stats_error" }, 500, cors);
  }
}

/**
 * deps.cache: {match(req), put(req,res)}; defaults to caches.default on Workers.
 * deps.fetch: upstream fetch (tests mock it).
 */
export async function handle(request, env, ctx, deps = {}) {
  const cors = corsHeaders(request, env);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const url = new URL(request.url);
  if (url.pathname === "/hit" || url.pathname === "/picked") return handleBeacon(request, url.pathname, env, ctx, cors);
  if (url.pathname === "/admin/stats") return handleAdmin(request, env, cors);
  if (url.pathname === "/board") return handleBoard(request, url, env, cors);
  if (url.pathname === "/board/dps") return handleBoardDps(request, env, cors);
  if (url.pathname === "/status") return handleStatus(request, url, env, ctx, cors, deps);
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { Allow: "GET, OPTIONS", ...cors });

  const route = ROUTES[url.pathname];
  if (!route) return json({ error: "not_found" }, 404, cors);

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const retry = rateLimit(ip);
  if (retry) return json({ error: "rate_limited" }, 429, { "Retry-After": String(retry), ...cors });

  const p = {};
  for (const name of route.required) {
    const raw = url.searchParams.get(name);
    const v = raw === null ? null : validators[name](raw);
    if (v === null) return json({ error: "bad_request", param: name }, 400, cors);
    p[name] = v;
  }
  for (const [name, def] of Object.entries(route.optional)) {
    const raw = url.searchParams.get(name);
    if (raw === null || raw === "") {
      p[name] = def;
      continue;
    }
    const v = validators[name](raw);
    if (v === null) return json({ error: "bad_request", param: name }, 400, cors);
    p[name] = v;
  }

  // ?fresh=1 only asks to skip the cache; it is not part of the cache key
  const wantFresh = p.fresh === "1";
  delete p.fresh;
  const cache = deps.cache ?? (typeof caches !== "undefined" ? caches.default : null);
  const key = new Request(
    `https://cache.invalid${url.pathname}?` +
      Object.keys(p).sort().map((k) => `${k}=${encodeURIComponent(p[k])}`).join("&"),
  );
  if (cache) {
    const hit = await cache.match(key);
    // a fresh request is served from cache only if that entry was fetched moments ago (protects the armory and the quota)
    const tooRecent = hit && Date.now() - Number(hit.headers.get("X-Cached-At") || 0) < FRESH_MIN_AGE_MS;
    if (hit && (!wantFresh || tooRecent)) {
      if (url.pathname === "/search" && p.page === "1") {
        const copy = hit.clone();
        track(env, ctx, async () => logSearch(env, { keyword: p.keyword, region: p.region, results: resultCount(await copy.arrayBuffer()) }));
      }
      if (url.pathname === "/info") {
        const copy = hit.clone();
        track(env, ctx, async () => recordInfo(env, p.region, await copy.arrayBuffer()));
      }
      const h = new Headers(hit.headers);
      h.set("X-Cache", "HIT");
      for (const [k, v] of Object.entries(cors)) h.set(k, v);
      return new Response(hit.body, { status: hit.status, headers: h });
    }
  }

  const doFetch = deps.fetch ?? fetch;
  let up;
  try {
    up = await doFetch(upstreamUrl(url.pathname, p), {
      method: "GET",
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") return json({ error: "upstream_timeout" }, 504, cors);
    return json({ error: "upstream", status: 502 }, 502, cors);
  }
  if (!up.ok) return json({ error: "upstream", status: up.status }, up.status, cors);

  const body = await up.arrayBuffer();
  const store = new Response(body, {
    status: 200,
    headers: {
      "Content-Type": up.headers.get("Content-Type") || "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${CACHE_TTL_S}`,
      "X-Cached-At": String(Date.now()),
    },
  });
  if (cache) {
    const put = cache.put(key, store.clone());
    if (ctx?.waitUntil) ctx.waitUntil(put);
    else await put;
  }
  if (url.pathname === "/search" && p.page === "1") {
    track(env, ctx, () => logSearch(env, { keyword: p.keyword, region: p.region, results: resultCount(body) }));
  }
  if (url.pathname === "/info") track(env, ctx, () => recordInfo(env, p.region, body));
  const h = new Headers(store.headers);
  h.set("X-Cache", "MISS");
  for (const [k, v] of Object.entries(cors)) h.set(k, v);
  return new Response(body, { status: 200, headers: h });
}

export default {
  fetch(request, env, ctx) {
    return handle(request, env, ctx);
  },
  // cron "*/5 * * * *" (wrangler.toml): refresh the live server status
  scheduled(_event, env, ctx) {
    ctx.waitUntil(runStatusCron(env));
  },
};
