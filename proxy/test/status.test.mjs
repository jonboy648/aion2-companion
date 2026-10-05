import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { handle, _resetRateLimit } from "../worker.js";
import worker from "../worker.js";
import { parseFeed, parseRoster, runStatusCron, regionTotals, FEED_URL, STATUS_UA } from "../status.js";

const ORIGIN = "https://becomecube.com";
const NOW = 1_800_000_000_000;

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
const mkEnv = () => ({ ALLOWED_ORIGINS: ORIGIN, STATS: fakeD1() });
const mapCache = () => {
  const m = new Map();
  return { match: async (r) => m.get(r.url)?.clone(), put: async (r, res) => void m.set(r.url, res) };
};

const srv = (id, o = {}) => ({
  id, region: ["", "nae", "naw", "eu", "la", "as"][Math.floor(id / 100) % 10], race: Math.floor(id / 1000), name: `S${id}`,
  tags: 0, cap: 7000, players: 1000, at: NOW - 1000, stale: false, ...o,
});
const feed = (servers, o = {}) => ({ updated: NOW, servers, ...o });
const roster = (region, ids) => ({ serverList: ids.map((id) => ({ raceId: Math.floor(id / 1000), serverId: id, serverName: `R${id}`, serverShortName: "X" })) });
const fakeFetch = (feedBody, rosters = {}, calls = []) => async (url, init) => {
  calls.push({ url: String(url), ua: init?.headers?.["User-Agent"] });
  if (String(url) === FEED_URL) {
    if (feedBody === "fail") return new Response("nope", { status: 503 });
    return new Response(JSON.stringify(feedBody), { status: 200 });
  }
  const region = new URL(url).searchParams.get("region");
  return new Response(JSON.stringify(rosters[region] ?? { serverList: [] }), { status: 200 });
};
const rows = (env, t) => env.STATS.db.prepare(`SELECT * FROM ${t}`).all().map((r) => ({ ...r }));
const get = (env, qs = "", cache = mapCache()) =>
  handle(new Request(`http://x/status${qs}`, { headers: { "CF-Connecting-IP": "203.0.113.9", Origin: ORIGIN } }), env, { waitUntil() {} }, { cache });

beforeEach(() => _resetRateLimit());

test("parseFeed keeps well-formed rows and drops bad ones", () => {
  const good = srv(1101, { tags: 2 | 8 });
  const out = parseFeed(feed([
    good,
    srv(1101), // duplicate id
    srv(1102, { name: "<script>" }),
    srv(1103, { cap: 0 }),
    srv(1104, { players: -5 }),
    srv(1105, { region: "eu" }), // id says nae
    srv(2106, { race: 1 }), // id says Asmodian
    srv(9999),
    { id: "1107" },
    null,
    srv(2101, { stale: true }),
  ]));
  assert.deepEqual(out.servers.map((s) => s.id), [1101, 2101]);
  assert.deepEqual(out.servers[0], { id: 1101, region: "nae", race: 1, name: "S1101", tags: 2, capacity: 7000, players: 1000, source_at: NOW - 1000, stale: false });
  assert.equal(out.servers[1].stale, true);
});

test("parseFeed rejects non-feeds", () => {
  for (const bad of [null, "x", [], {}, { servers: "no" }, feed([]), feed([{ id: 1 }])]) assert.equal(parseFeed(bad), null);
});

test("parseRoster checks region, race and names", () => {
  const body = roster("eu", [1301, 2301, 1101]); // 1101 is NAE, not in the EU roster
  assert.deepEqual(parseRoster("eu", body).map((r) => r.id), [1301, 2301]);
  assert.deepEqual(parseRoster("eu", { serverList: [{ raceId: 2, serverId: 1301, serverName: "X" }] }), []);
  assert.deepEqual(parseRoster("eu", null), []);
});

test("the cron stores latest rows, history and region totals, and identifies itself", async () => {
  const env = mkEnv();
  const calls = [];
  const f = fakeFetch(feed([srv(1301, { players: 100 }), srv(2301, { players: 50 }), srv(1101, { stale: true, players: 999 })]), {}, calls);
  const r = await runStatusCron(env, { fetch: f, now: NOW });
  assert.deepEqual(r, { ok: true, servers: 3 });
  assert.equal(calls[0].url, FEED_URL);
  assert.equal(calls[0].ua, STATUS_UA);
  assert.match(STATUS_UA, /becomecube\.com/);
  assert.equal(rows(env, "server_status").length, 3);
  assert.equal(rows(env, "server_status").find((x) => x.server_id === 1101).stale, 1);
  // stale rows never enter history
  assert.deepEqual(rows(env, "server_status_history").map((x) => x.server_id).sort(), [1301, 2301]);
  assert.deepEqual(rows(env, "region_history"), [{ region: "eu", ts: NOW, players: 150 }]);
  const meta = Object.fromEntries(rows(env, "status_meta").map((m) => [m.key, m.value]));
  assert.equal(meta.last_ok_at, NOW);
  assert.equal(meta.roster_at, undefined); // every roster response was empty: nothing stored, retried next run
});

test("an upstream failure keeps the last data and records the error time", async () => {
  const env = mkEnv();
  await runStatusCron(env, { fetch: fakeFetch(feed([srv(1301)])), now: NOW });
  const r = await runStatusCron(env, { fetch: fakeFetch("fail"), now: NOW + 300_000 });
  assert.deepEqual(r, { ok: false, reason: "upstream" });
  assert.equal(rows(env, "server_status").length, 1);
  const meta = Object.fromEntries(rows(env, "status_meta").map((m) => [m.key, m.value]));
  assert.equal(meta.last_ok_at, NOW);
  assert.equal(meta.last_error_at, NOW + 300_000);
  // garbage that parses but has no usable row counts as a failure too
  assert.equal((await runStatusCron(env, { fetch: fakeFetch({ updated: 1, servers: [{ id: 5 }] }), now: NOW + 600_000 })).ok, false);
  assert.equal(rows(env, "server_status").length, 1);
});

test("servers that leave the feed leave the live table; history older than 30 days is pruned", async () => {
  const env = mkEnv();
  const day = 24 * 3600_000;
  await runStatusCron(env, { fetch: fakeFetch(feed([srv(1301), srv(1302)])), now: NOW - 31 * day });
  await runStatusCron(env, { fetch: fakeFetch(feed([srv(1301)])), now: NOW - 29 * day });
  assert.deepEqual(rows(env, "server_status").map((x) => x.server_id), [1301]);
  await runStatusCron(env, { fetch: fakeFetch(feed([srv(1301)])), now: NOW });
  const hist = rows(env, "server_status_history");
  assert.deepEqual(hist.map((h) => h.ts).sort(), [NOW - 29 * day, NOW]);
  assert.equal(rows(env, "region_history").length, 2);
});

test("the roster is fetched once, then only after 24 h", async () => {
  const env = mkEnv();
  const calls = [];
  const rosters = { eu: roster("eu", [1301, 1302, 2301]), nae: roster("nae", [1101, 2101]) };
  const f = fakeFetch(feed([srv(1301)]), rosters, calls);
  await runStatusCron(env, { fetch: f, now: NOW });
  const rosterCalls = () => calls.filter((c) => c.url.includes("gameinfo")).length;
  assert.equal(rosterCalls(), 5);
  assert.equal(rows(env, "server_roster").length, 5);
  await runStatusCron(env, { fetch: f, now: NOW + 300_000 });
  assert.equal(rosterCalls(), 5);
  await runStatusCron(env, { fetch: f, now: NOW + 25 * 3600_000 });
  assert.equal(rosterCalls(), 10);
});

test("no D1 binding: the cron does nothing and /status says unavailable", async () => {
  assert.deepEqual(await runStatusCron({}, { fetch: fakeFetch(feed([srv(1301)])) }), { ok: false, reason: "no_db" });
  const r = await get({ ALLOWED_ORIGINS: ORIGIN });
  assert.equal(r.status, 503);
});

test("scheduled() runs the cron through waitUntil", async () => {
  const env = mkEnv();
  const orig = globalThis.fetch;
  globalThis.fetch = fakeFetch(feed([srv(1301)]));
  try {
    const jobs = [];
    worker.scheduled({}, env, { waitUntil: (p) => jobs.push(p) });
    await Promise.all(jobs);
  } finally {
    globalThis.fetch = orig;
  }
  assert.equal(rows(env, "server_status").length, 1);
});

test("GET /status: shape, region totals, roster merge, history, CORS and caching", async () => {
  const env = mkEnv();
  const t = Date.now();
  const f = fakeFetch(
    feed([srv(1301, { players: 100, cap: 7000, at: t }), srv(2301, { players: 50, cap: 7500, at: t, tags: 4 }), srv(1101, { players: 10, stale: true, at: t - 9e6 })], { updated: t }),
    { eu: roster("eu", [1301, 2301, 1302, 2302]) },
  );
  await runStatusCron(env, { fetch: f, now: t - 3600_000 });
  await runStatusCron(env, { fetch: f, now: t });
  const cache = mapCache();
  const r = await get(env, "", cache);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.match(r.headers.get("Cache-Control"), /max-age=60/);
  const b = await r.json();
  assert.equal(b.last_ok_at, t);
  assert.equal(b.last_error_at, null);
  const ids = b.servers.map((s) => s.id);
  assert.deepEqual(ids, [1101, 1301, 1302, 2301, 2302].sort((a, c) => (a % 1000) - (c % 1000) || a - c));
  const unlisted = b.servers.find((s) => s.id === 1302);
  assert.deepEqual({ ...unlisted }, { id: 1302, region: "eu", race: 1, name: "R1302", tags: 0, capacity: null, players: null, source_at: null, stale: false, fetched_at: null, listed: false });
  assert.equal(b.servers.find((s) => s.id === 2301).tags, 4);
  assert.deepEqual(b.regions.map((x) => x.region), ["nae", "naw", "eu", "la", "as"]);
  const eu = b.regions.find((x) => x.region === "eu");
  assert.deepEqual({ ...eu, source_at: 0 }, { region: "eu", servers: 4, reporting: 2, players: 150, capacity: 14500, stale: false, source_at: 0 });
  assert.equal(b.regions.find((x) => x.region === "nae").stale, true);
  for (const range of ["24h", "7d", "30d"]) {
    const h = b.history[range];
    assert.ok(h.step_ms > 0 && Array.isArray(h.ts));
    assert.deepEqual(Object.keys(h.regions), ["nae", "naw", "eu", "la", "as"]);
    assert.equal(h.regions.eu.length, h.ts.length);
  }
  assert.equal(b.history["24h"].ts.length, 2);
  assert.deepEqual(b.history["24h"].regions.eu, [150, 150]);
  assert.equal(b.history["24h"].regions.nae.every((v) => v === null), true); // stale-only region has no history
  // second call is served from the edge cache even after the DB is gone
  env.STATS.db.exec("DELETE FROM server_status");
  const again = await get(env, "", cache);
  assert.equal(again.headers.get("X-Cache"), "HIT");
  assert.equal((await again.json()).servers.length, 5);
});

test("GET /status?server= returns one pair's history; bad params are 400", async () => {
  const env = mkEnv();
  const t = Date.now();
  const f = (p1, p2) => fakeFetch(feed([srv(1301, { players: p1, at: t }), srv(2301, { players: p2, at: t })], { updated: t }));
  await runStatusCron(env, { fetch: f(100, 40), now: t - 600_000 });
  await runStatusCron(env, { fetch: f(120, 60), now: t });
  const r = await get(env, "?server=2301&range=24h");
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.deepEqual(b.pair, [1301, 2301]);
  assert.deepEqual(b.elyos, [100, 120]);
  assert.deepEqual(b.asmodian, [40, 60]);
  const hourly = await (await get(env, "?server=1301&range=7d")).json();
  assert.equal(hourly.step_ms, 3600_000);
  assert.ok(hourly.elyos.length >= 1 && hourly.elyos.length <= 2);
  for (const qs of ["?server=abc", "?server=9999", "?server=1301&range=1y", "?range=9d"]) assert.equal((await get(env, qs)).status, 400, qs);
  assert.equal((await handle(new Request("http://x/status", { method: "POST" }), env, {}, { cache: mapCache() })).status, 405);
});

test("regionTotals ignores rows without a count", () => {
  const t = regionTotals([
    { region: "eu", players: 10, capacity: 100, stale: false, source_at: 5 },
    { region: "eu", players: null, capacity: null, stale: false, source_at: null },
  ]);
  assert.deepEqual(t.find((x) => x.region === "eu"), { region: "eu", servers: 2, reporting: 1, players: 10, capacity: 100, stale: false, source_at: 5 });
  assert.deepEqual(t.find((x) => x.region === "la"), { region: "la", servers: 0, reporting: 0, players: 0, capacity: 0, stale: false, source_at: null });
});
