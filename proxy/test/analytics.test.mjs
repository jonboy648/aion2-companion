import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { handle, _resetRateLimit } from "../worker.js";
import { normalizePath, visitorId } from "../stats.js";

const ORIGIN = "https://becomecube.com";
const IP = "203.0.113.77";
const TOKEN = "s3cret-token-value";
const SALT = "pepper";
const baseEnv = { ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173` };

/** In-memory D1 fake backed by real SQLite, loaded with the real schema.sql. */
function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
    all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }),
  });
  return { db, prepare: (sql) => stmt(sql), batch: async (list) => Promise.all(list.map((s) => s.all())) };
}
function mkCtx() {
  const jobs = [];
  return { jobs, waitUntil: (p) => jobs.push(p), settle: () => Promise.all(jobs) };
}
const mkEnv = (extra = {}) => ({ ...baseEnv, STATS: fakeD1(), ADMIN_TOKEN: TOKEN, ADMIN_SALT: SALT, ...extra });
const post = (path, body, headers = {}) =>
  new Request("http://x" + path, {
    method: "POST",
    headers: { "CF-Connecting-IP": IP, Origin: ORIGIN, "Content-Type": "text/plain", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const get = (path, headers = {}) => new Request("http://x" + path, { headers: { "CF-Connecting-IP": IP, ...headers } });
const rows = (env, table) => env.STATS.db.prepare(`SELECT * FROM ${table}`).all().map((r) => ({ ...r }));
const searchDeps = (body = '{"list":[{"name":"a"},{"name":"b"}]}') => ({
  fetch: async () => new Response(body, { status: 200, headers: { "Content-Type": "application/json" } }),
  cache: { match: async () => undefined, put: async () => {} },
});

beforeEach(() => _resetRateLimit());

test("normalizePath accepts site routes (normalized), rejects the rest", () => {
  assert.equal(normalizePath("/"), "/");
  assert.equal(normalizePath("/guide"), "/guide");
  assert.equal(normalizePath("/guide/"), "/guide");
  assert.equal(normalizePath("/timers/"), "/timers");
  assert.equal(normalizePath("/server-status"), "/server-status");
  assert.equal(normalizePath("/codex"), "/codex");
  assert.equal(normalizePath("/codex/assassin"), "/codex/:classKey");
  assert.equal(normalizePath("/compare"), "/compare");
  assert.equal(normalizePath("/compare/nae.2103.Bob/_"), "/compare");
  assert.equal(normalizePath("/compare/a/b/c"), null);
  assert.equal(normalizePath("/c/nae/2103/DarthThot"), "/c/:region/:serverId/:name");
  assert.equal(normalizePath("/c/nae/2103/Dar%20th"), "/c/:region/:serverId/:name");
  for (const bad of ["/admin", "/nope", "/guide?x=1", "//evil", "/c/nae/2103", "/" + "a".repeat(300), "", null, 5, "/gu ide"])
    assert.equal(normalizePath(bad), null, String(bad));
});

test("POST /hit stores day/path/anonymous visitor, never the IP, via ctx.waitUntil", async () => {
  const env = mkEnv();
  const ctx = mkCtx();
  const r = await handle(post("/hit", { path: "/c/nae/2103/DarthThot" }), env, ctx);
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(ctx.jobs.length, 1, "logging went through waitUntil");
  await ctx.settle();
  const [v] = rows(env, "visits");
  assert.equal(v.path, "/c/:region/:serverId/:name");
  assert.match(v.day, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(v.visitor, /^[0-9a-f]{16}$/);
  const everything = JSON.stringify(rows(env, "visits"));
  assert.ok(!everything.includes(IP), "raw IP must not be stored");
  assert.ok(!everything.includes("203.0.113"), "no IP fragment");
  assert.equal(v.visitor, await visitorId(IP, env, v.day));
});

test("visitor hash: stable within a day, differs by ip, day and ADMIN_SALT", async () => {
  const a = await visitorId("1.1.1.1", { ADMIN_SALT: "s" }, "2026-01-01");
  assert.equal(a, await visitorId("1.1.1.1", { ADMIN_SALT: "s" }, "2026-01-01"));
  assert.notEqual(a, await visitorId("1.1.1.2", { ADMIN_SALT: "s" }, "2026-01-01"));
  assert.notEqual(a, await visitorId("1.1.1.1", { ADMIN_SALT: "s" }, "2026-01-02"));
  assert.notEqual(a, await visitorId("1.1.1.1", { ADMIN_SALT: "t" }, "2026-01-01"));
});

test("no STATS binding: beacons and search are no-ops that still succeed, waitUntil never called", async () => {
  const env = { ...baseEnv };
  const ctx = mkCtx();
  assert.equal((await handle(post("/hit", { path: "/" }), env, ctx)).status, 204);
  assert.equal((await handle(post("/picked", { name: "A", server: "B" }), env, ctx)).status, 204);
  const { fetch } = searchDeps(); // no cache either, so the only possible waitUntil caller is analytics
  const s = await handle(get("/search?keyword=abc&region=nae"), env, ctx, { fetch });
  assert.equal(s.status, 200);
  assert.deepEqual(await s.json(), { list: [{ name: "a" }, { name: "b" }] });
  assert.equal(ctx.jobs.length, 0);
});

test("a failing database never breaks the response", async () => {
  const boom = () => {
    throw new Error("d1 down");
  };
  const env = mkEnv({ STATS: { prepare: boom, batch: boom } });
  const ctx = mkCtx();
  assert.equal((await handle(post("/hit", { path: "/" }), env, ctx)).status, 204);
  assert.equal((await handle(get("/search?keyword=abc&region=nae"), env, ctx, searchDeps())).status, 200);
  await ctx.settle(); // must not reject
});

test("/hit validation: method, origin, body, path, size, rate limit", async () => {
  const env = mkEnv();
  const ctx = mkCtx();
  assert.equal((await handle(get("/hit"), env, ctx)).status, 405);
  assert.equal((await handle(post("/hit", { path: "/" }, { Origin: "https://evil.example" }), env, ctx)).status, 403);
  const noOrigin = new Request("http://x/hit", { method: "POST", body: '{"path":"/"}' });
  assert.equal((await handle(noOrigin, env, ctx)).status, 403);
  assert.equal((await handle(post("/hit", "not json"), env, ctx)).status, 400);
  assert.equal((await handle(post("/hit", "[1]"), env, ctx)).status, 400);
  assert.equal((await handle(post("/hit", { path: "/admin" }), env, ctx)).status, 400);
  assert.equal((await handle(post("/hit", { path: "/" + "a".repeat(500) }), env, ctx)).status, 400);
  assert.equal((await handle(post("/hit", "x".repeat(5000)), env, ctx)).status, 400);
  assert.equal(ctx.jobs.length, 0);
  assert.equal(rows(env, "visits").length, 0);
  let last;
  for (let i = 0; i < 70; i++) last = await handle(post("/hit", { path: "/" }), env, ctx);
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get("retry-after")) >= 1);
});

test("/search logs trimmed keyword, region and result count (not page 2, upstream errors, bad input)", async () => {
  const env = mkEnv();
  const ctx = mkCtx();
  const r = await handle(get("/search?keyword=%20Darththot%20&region=nae"), env, ctx, searchDeps());
  assert.equal(r.status, 200);
  await handle(get("/search?keyword=Darththot&region=eu&page=2"), env, ctx, searchDeps());
  await handle(get("/search?keyword=Darththot&region=eu"), env, ctx, { ...searchDeps(), fetch: async () => new Response("{}", { status: 500 }) });
  await handle(get("/search?keyword=&region=nae"), env, ctx, searchDeps());
  await ctx.settle();
  const s = rows(env, "searches");
  assert.equal(s.length, 1);
  assert.deepEqual({ ...s[0], ts: 0 }, { ts: 0, keyword: "Darththot", region: "nae", results: 2, picked_name: null, picked_server: null });
});

test("/search logs on cache hits too, reading the count from the cached body", async () => {
  const env = mkEnv();
  const ctx = mkCtx();
  const cache = { match: async () => new Response('{"list":[{"x":1}]}', { headers: { "Content-Type": "application/json" } }), put: async () => {} };
  const r = await handle(get("/search?keyword=Abc&region=la"), env, ctx, { cache, fetch: async () => assert.fail("no upstream") });
  assert.equal(r.headers.get("x-cache"), "HIT");
  await ctx.settle();
  assert.equal(rows(env, "searches")[0].results, 1);
});

test("search keyword over 32 chars is rejected and nothing is logged", async () => {
  const env = mkEnv();
  const ctx = mkCtx();
  const r = await handle(get(`/search?keyword=${"a".repeat(33)}&region=nae`), env, ctx, searchDeps());
  assert.equal(r.status, 400);
  await ctx.settle();
  assert.equal(rows(env, "searches").length, 0);
});

test("POST /picked attaches to the latest matching unclaimed lookup", async () => {
  const env = mkEnv();
  const ctx = mkCtx();
  await handle(get("/search?keyword=Dark&region=nae"), env, ctx, searchDeps());
  await ctx.settle();
  const r = await handle(post("/picked", { name: "DarkKnight", server: "Triniel" }), env, ctx);
  assert.equal(r.status, 204);
  await ctx.settle();
  const [s] = rows(env, "searches");
  assert.equal(s.picked_name, "DarkKnight");
  assert.equal(s.picked_server, "Triniel");
  // unrelated name: nothing to attach to, no row invented
  await handle(post("/picked", { name: "Zed", server: "S" }), env, ctx);
  await ctx.settle();
  assert.equal(rows(env, "searches").length, 1);
  assert.equal((await handle(post("/picked", { name: "", server: "S" }), env, ctx)).status, 400);
  assert.equal((await handle(post("/picked", { name: "a".repeat(40), server: "S" }), env, ctx)).status, 400);
});

test("GET /admin/stats: 401 without / with wrong token, and when ADMIN_TOKEN is unset or empty", async () => {
  const env = mkEnv();
  for (const h of [{}, { Authorization: "Bearer nope" }, { Authorization: TOKEN }, { Authorization: "Basic " + TOKEN }, { Authorization: "Bearer " }]) {
    _resetRateLimit();
    const r = await handle(get("/admin/stats", h), env, mkCtx());
    assert.equal(r.status, 401, JSON.stringify(h));
    assert.deepEqual(await r.json(), { error: "unauthorized" });
  }
  const unset = mkEnv({ ADMIN_TOKEN: undefined });
  assert.equal((await handle(get("/admin/stats", { Authorization: "Bearer undefined" }), unset, mkCtx())).status, 401);
  assert.equal((await handle(get("/admin/stats", { Authorization: "Bearer " }), mkEnv({ ADMIN_TOKEN: "" }), mkCtx())).status, 401);
});

test("GET /admin/stats: correct token returns totals, per-day, paths, top searches, recent", async () => {
  const env = mkEnv();
  const ctx = mkCtx();
  const day = new Date().toISOString().slice(0, 10);
  const ins = env.STATS.db.prepare("INSERT INTO visits (day, path, visitor, ts) VALUES (?, ?, ?, ?)");
  ins.run(day, "/", "v1", Date.now());
  ins.run(day, "/", "v1", Date.now());
  ins.run(day, "/guide", "v2", Date.now());
  ins.run("2020-01-01", "/", "v9", 1);
  await handle(get("/search?keyword=Alpha&region=nae"), env, ctx, searchDeps());
  await handle(get("/search?keyword=alpha&region=eu"), env, ctx, searchDeps('{"list":[]}'));
  await handle(get("/search?keyword=Beta&region=nae"), env, ctx, searchDeps());
  await ctx.settle();
  await handle(post("/picked", { name: "Betamax", server: "Siel" }), env, ctx);
  await ctx.settle();

  const r = await handle(get("/admin/stats", { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN }), env, mkCtx());
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
  const j = await r.json();
  assert.deepEqual(j.totals.today, { page_views: 3, unique_visitors: 2 });
  assert.deepEqual(j.totals.last_7_days, { page_views: 3, unique_visitors: 2 });
  assert.deepEqual(j.totals.all_time, { page_views: 4, unique_visitors: 3 });
  assert.equal(j.visits_per_day.length, 30);
  assert.deepEqual(j.visits_per_day.at(-1), { day, page_views: 3, unique_visitors: 2 });
  assert.equal(j.visits_per_day[0].page_views, 0);
  assert.deepEqual(j.top_paths[0], { path: "/", page_views: 2 });
  assert.equal(j.top_searches[0].count, 2);
  assert.equal(j.top_searches[0].keyword.toLowerCase(), "alpha");
  assert.equal(j.top_searches.length, 2);
  assert.equal(j.recent_searches.length, 3);
  assert.deepEqual(j.recent_searches[0].picked, { name: "Betamax", server: "Siel" });
  assert.equal(j.recent_searches[0].keyword, "Beta");
  assert.ok(!JSON.stringify(j).includes(IP));
});

test("GET /admin/stats with a valid token but no database: 503", async () => {
  const r = await handle(get("/admin/stats", { Authorization: `Bearer ${TOKEN}` }), { ...baseEnv, ADMIN_TOKEN: TOKEN }, mkCtx());
  assert.equal(r.status, 503);
});

test("CORS preflight for beacons and admin allows POST and Authorization only for our origins", async () => {
  const env = mkEnv();
  for (const path of ["/hit", "/picked", "/admin/stats"]) {
    const ok = await handle(new Request("http://x" + path, { method: "OPTIONS", headers: { Origin: ORIGIN } }), env, mkCtx());
    assert.equal(ok.status, 204);
    assert.match(ok.headers.get("access-control-allow-methods"), /POST/);
    assert.match(ok.headers.get("access-control-allow-headers"), /Authorization/);
    const bad = await handle(new Request("http://x" + path, { method: "OPTIONS", headers: { Origin: "https://evil.example" } }), env, mkCtx());
    assert.equal(bad.headers.get("access-control-allow-origin"), null);
  }
});

test("admin brute force is rate limited", async () => {
  const env = mkEnv();
  let last;
  for (let i = 0; i < 70; i++) last = await handle(get("/admin/stats", { Authorization: "Bearer wrong" }), env, mkCtx());
  assert.equal(last.status, 429);
});
