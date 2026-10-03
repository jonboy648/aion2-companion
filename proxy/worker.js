// Aion 2 armory proxy (Cloudflare Worker). Whitelisted GET routes only; see CONTRACT.md. No secrets.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const REGIONS = new Set(["nae", "naw", "eu", "la", "as"]);
const BOARD_IDS = new Set([61, 62, 63, 64, 65, 66, 67, 68]);
const TIMEOUT_MS = 10_000;
const CACHE_TTL_S = 600;
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
  boardId: (v) => (/^\d{1,4}$/.test(v) && BOARD_IDS.has(+v) ? String(+v) : null),
  keyword: (v) => (v.length >= 1 && v.length <= 32 && !/[\u0000-\u001f\u007f]/.test(v) ? v : null),
  page: intRange(1, 10),
  size: intRange(1, 100),
};

const ROUTES = {
  "/search": { required: ["keyword", "region"], optional: { page: "1", size: "100" } },
  "/info": { required: ["characterId", "serverId", "region"], optional: {} },
  "/equipment": { required: ["characterId", "serverId", "region"], optional: {} },
  "/daevanion": { required: ["characterId", "serverId", "region", "boardId"], optional: {} },
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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

/**
 * deps.cache: {match(req), put(req,res)}; defaults to caches.default on Workers.
 * deps.fetch: upstream fetch (tests mock it).
 */
export async function handle(request, env, ctx, deps = {}) {
  const cors = corsHeaders(request, env);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { Allow: "GET, OPTIONS", ...cors });

  const url = new URL(request.url);
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

  const cache = deps.cache ?? (typeof caches !== "undefined" ? caches.default : null);
  const key = new Request(
    `https://cache.invalid${url.pathname}?` +
      Object.keys(p).sort().map((k) => `${k}=${encodeURIComponent(p[k])}`).join("&"),
  );
  if (cache) {
    const hit = await cache.match(key);
    if (hit) {
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
    },
  });
  if (cache) {
    const put = cache.put(key, store.clone());
    if (ctx?.waitUntil) ctx.waitUntil(put);
    else await put;
  }
  const h = new Headers(store.headers);
  h.set("X-Cache", "MISS");
  for (const [k, v] of Object.entries(cors)) h.set(k, v);
  return new Response(body, { status: 200, headers: h });
}

export default {
  fetch(request, env, ctx) {
    return handle(request, env, ctx);
  },
};
