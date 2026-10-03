import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { handle, rateLimit, _resetRateLimit } from "../worker.js";

const ENV = { ALLOWED_ORIGINS: "https://becomecube.com,http://localhost:5173" };
const ID = "abcdEFGH12345678";

function memCache() {
  const m = new Map();
  return {
    m,
    async match(r) {
      const e = m.get(r.url);
      return e ? new Response(e.body, { status: e.status, headers: e.headers }) : undefined;
    },
    async put(r, res) {
      m.set(r.url, { body: await res.arrayBuffer(), status: res.status, headers: [...res.headers] });
    },
  };
}
function mockUp(status = 200, body = '{"ok":true}') {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(body, { status, headers: { "Content-Type": "application/json" } });
  };
  return { calls, fetch };
}
const req = (path, headers = {}, method = "GET") =>
  new Request("http://x" + path, { method, headers: { "CF-Connecting-IP": "1.1.1.1", ...headers } });
const run = (path, deps, headers, method) => handle(req(path, headers, method), ENV, undefined, deps);

beforeEach(() => _resetRateLimit());

test("search builds the upstream url, browser UA, no Origin/Referer", async () => {
  const up = mockUp();
  const r = await run("/search?keyword=Darththot&region=nae", { fetch: up.fetch, cache: memCache() }, {
    Origin: "http://localhost:5173",
    Referer: "http://localhost:5173/",
  });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  const { url, init } = up.calls[0];
  assert.equal(
    url,
    "https://api-search.plaync.com/aion2global/search/v2/character?keyword=Darththot&page=1&size=100&localeInfo=en-US&region=nae&serverId=",
  );
  assert.match(init.headers["User-Agent"], /Mozilla\/5\.0.*Chrome/);
  assert.equal(init.headers.Origin, undefined);
  assert.equal(init.headers.Referer, undefined);
  assert.equal(r.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(r.headers.get("x-cache"), "MISS");
});

test("info / equipment / daevanion upstream urls", async () => {
  const up = mockUp();
  const d = { fetch: up.fetch, cache: memCache() };
  const q = `characterId=${ID}&serverId=2103&region=nae`;
  await run(`/info?${q}`, d);
  await run(`/equipment?${q}`, d);
  await run(`/daevanion?${q}&boardId=61`, d);
  assert.equal(up.calls[0].url, `https://aion2.plaync.com/api/character/info?lang=en-US&characterId=${ID}&serverId=2103&region=nae`);
  assert.equal(up.calls[1].url, `https://aion2.plaync.com/api/character/equipment?lang=en-US&characterId=${ID}&serverId=2103&region=nae`);
  assert.equal(
    up.calls[2].url,
    `https://aion2.plaync.com/api/character/daevanion/detail?lang=en-US&characterId=${ID}&serverId=2103&region=nae&boardId=61`,
  );
});

test("characterId '=' is re-encoded; already-encoded '%3D' form passes through", async () => {
  const up = mockUp();
  const d = { fetch: up.fetch, cache: memCache() };
  await run("/info?characterId=abcdEFGH1234%3D&serverId=1&region=eu", d); // decodes to "...="
  assert.match(up.calls[0].url, /characterId=abcdEFGH1234%3D&/);
  await run("/info?characterId=abcdEFGH1234%253D&serverId=1&region=eu", d); // decodes to "...%3D"
  assert.match(up.calls[1].url, /characterId=abcdEFGH1234%3D&/);
});

test("strict validation", async () => {
  const d = { fetch: mockUp().fetch, cache: memCache() };
  const bad = [
    ["/search?region=nae", "keyword"],
    ["/search?keyword=a&region=kr", "region"],
    ["/search?keyword=" + "a".repeat(33) + "&region=nae", "keyword"],
    ["/search?keyword=a%00b&region=nae", "keyword"],
    ["/search?keyword=a&region=nae&size=101", "size"],
    ["/search?keyword=a&region=nae&page=0", "page"],
    [`/info?characterId=short&serverId=1&region=nae`, "characterId"],
    [`/info?characterId=${ID}%3Cx&serverId=1&region=nae`, "characterId"],
    [`/info?characterId=${ID}&serverId=abc&region=nae`, "serverId"],
    [`/info?characterId=${ID}&serverId=1&region=xx`, "region"],
    [`/daevanion?characterId=${ID}&serverId=1&region=nae&boardId=60`, "boardId"],
    [`/daevanion?characterId=${ID}&serverId=1&region=nae&boardId=69`, "boardId"],
    [`/daevanion?characterId=${ID}&serverId=1&region=nae`, "boardId"],
  ];
  for (const [path, param] of bad) {
    const r = await run(path, d);
    assert.equal(r.status, 400, path);
    assert.deepEqual(await r.json(), { error: "bad_request", param }, path);
  }
});

test("all valid boardIds 61..68 accepted", async () => {
  const d = { fetch: mockUp().fetch, cache: memCache() };
  for (let b = 61; b <= 68; b++) {
    const r = await run(`/daevanion?characterId=${ID}&serverId=1&region=nae&boardId=${b}`, d);
    assert.equal(r.status, 200);
  }
});

test("unknown params are dropped; unknown path 404; bad method 405", async () => {
  const up = mockUp();
  const d = { fetch: up.fetch, cache: memCache() };
  await run("/search?keyword=a&region=nae&evil=http://x&localeInfo=ko", d);
  assert.ok(!up.calls[0].url.includes("evil"));
  assert.ok(up.calls[0].url.includes("localeInfo=en-US"));
  const nf = await run("/anything-else", d);
  assert.equal(nf.status, 404);
  assert.deepEqual(await nf.json(), { error: "not_found" });
  assert.equal((await run("/search?keyword=a&region=nae", d, {}, "POST")).status, 405);
  assert.equal(up.calls.length, 1);
});

test("CORS: allowed origin, foreign origin, no origin, preflight", async () => {
  const d = { fetch: mockUp().fetch, cache: memCache() };
  const ok = await run("/search?keyword=a&region=nae", d, { Origin: "https://becomecube.com" });
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://becomecube.com");
  assert.equal(ok.headers.get("vary"), "Origin");
  const evil = await run("/search?keyword=a&region=nae", d, { Origin: "https://evil.example" });
  assert.equal(evil.status, 200);
  assert.equal(evil.headers.get("access-control-allow-origin"), null);
  const none = await run("/search?keyword=a&region=nae", d);
  assert.equal(none.headers.get("access-control-allow-origin"), null);
  const pre = await run("/search", d, { Origin: "https://becomecube.com" }, "OPTIONS");
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-methods"), "GET, OPTIONS");
  assert.equal(pre.headers.get("access-control-allow-headers"), "Content-Type");
  assert.equal(pre.headers.get("access-control-max-age"), "86400");
  const preEvil = await run("/search", d, { Origin: "https://evil.example" }, "OPTIONS");
  assert.equal(preEvil.status, 204);
  assert.equal(preEvil.headers.get("access-control-allow-origin"), null);
});

test("cache: second call is a HIT and does not hit upstream; key ignores param order", async () => {
  const up = mockUp();
  const d = { fetch: up.fetch, cache: memCache() };
  const a = await run("/search?keyword=a&region=nae", d);
  assert.equal(a.headers.get("x-cache"), "MISS");
  assert.equal(a.headers.get("cache-control"), "public, max-age=600");
  const b = await run("/search?region=nae&keyword=a&page=1", d, { Origin: "https://becomecube.com" });
  assert.equal(b.headers.get("x-cache"), "HIT");
  assert.equal(b.headers.get("access-control-allow-origin"), "https://becomecube.com");
  assert.deepEqual(await b.json(), { ok: true });
  assert.equal(up.calls.length, 1);
});

test("upstream errors pass status, are not cached", async () => {
  const cache = memCache();
  const r = await run("/search?keyword=a&region=nae", { fetch: mockUp(403, "forbidden").fetch, cache });
  assert.equal(r.status, 403);
  assert.deepEqual(await r.json(), { error: "upstream", status: 403 });
  assert.equal(cache.m.size, 0);
});

test("upstream timeout -> 504; network failure -> 502", async () => {
  const to = async () => {
    throw Object.assign(new Error("t"), { name: "TimeoutError" });
  };
  const r = await run("/search?keyword=a&region=nae", { fetch: to, cache: memCache() });
  assert.equal(r.status, 504);
  assert.deepEqual(await r.json(), { error: "upstream_timeout" });
  const nf = async () => {
    throw new TypeError("fetch failed");
  };
  assert.equal((await run("/search?keyword=a&region=nae", { fetch: nf, cache: memCache() })).status, 502);
});

test("rate limit: 60 pass, 61st is 429 with Retry-After; other IPs unaffected; refills", async () => {
  const d = { fetch: mockUp().fetch, cache: memCache() };
  for (let i = 0; i < 60; i++) assert.equal((await run("/search?keyword=a&region=nae", d)).status, 200);
  const r = await run("/search?keyword=a&region=nae", d);
  assert.equal(r.status, 429);
  assert.deepEqual(await r.json(), { error: "rate_limited" });
  assert.ok(+r.headers.get("retry-after") >= 1);
  const other = await run("/search?keyword=a&region=nae", d, { "CF-Connecting-IP": "2.2.2.2" });
  assert.equal(other.status, 200);
  _resetRateLimit();
  const t0 = 1_000_000;
  for (let i = 0; i < 60; i++) assert.equal(rateLimit("ip", t0), 0);
  assert.ok(rateLimit("ip", t0) > 0);
  assert.equal(rateLimit("ip", t0 + 1500), 0); // ~1.5 tokens refilled
});
