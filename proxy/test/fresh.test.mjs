import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { handle, _resetRateLimit } from "../worker.js";

const ORIGIN = "https://becomecube.com";
const env = { ALLOWED_ORIGINS: ORIGIN };
const CID = "SQlrdtb1Tw1yEhS_c-OisaL9MCPPr9kxYIr6S7hx8JM=";

function memCache() {
  const m = new Map();
  return {
    m,
    match: async (req) => m.get(req.url)?.clone(),
    put: async (req, res) => void m.set(req.url, res),
  };
}
function upstream() {
  const calls = [];
  return { calls, fetch: async (url) => (calls.push(url), new Response(JSON.stringify({ profile: { n: calls.length } }), { status: 200 })) };
}
const req = (qs) => new Request(`http://x/info?characterId=${encodeURIComponent(CID)}&serverId=2103&region=nae${qs}`, { headers: { Origin: ORIGIN, "CF-Connecting-IP": "203.0.113.9" } });

beforeEach(() => _resetRateLimit());

test("fresh=1 is not part of the cache key and is not forwarded upstream", async () => {
  const cache = memCache();
  const up = upstream();
  await handle(req(""), env, null, { cache, fetch: up.fetch });
  assert.equal(cache.m.size, 1);
  await handle(req("&fresh=1"), env, null, { cache, fetch: up.fetch });
  assert.equal(cache.m.size, 1, "same key");
  for (const u of up.calls) assert.ok(!u.includes("fresh"), u);
});

test("a recent cache entry is served even when fresh is asked (the armory is protected)", async () => {
  const cache = memCache();
  const up = upstream();
  await handle(req(""), env, null, { cache, fetch: up.fetch });
  const r = await handle(req("&fresh=1"), env, null, { cache, fetch: up.fetch });
  assert.equal(up.calls.length, 1);
  assert.equal(r.headers.get("X-Cache"), "HIT");
});

test("an old cache entry is re-read from the armory when fresh is asked, and replaces the cached copy", async () => {
  const cache = memCache();
  const up = upstream();
  await handle(req(""), env, null, { cache, fetch: up.fetch });
  const [k, old] = [...cache.m.entries()][0];
  const aged = new Response(await old.clone().text(), { headers: { "X-Cached-At": String(Date.now() - 120_000) } });
  cache.m.set(k, aged);
  // without fresh, the old entry is still served
  assert.equal((await handle(req(""), env, null, { cache, fetch: up.fetch })).headers.get("X-Cache"), "HIT");
  assert.equal(up.calls.length, 1);
  const r = await handle(req("&fresh=1"), env, null, { cache, fetch: up.fetch });
  assert.equal(r.headers.get("X-Cache"), "MISS");
  assert.equal(up.calls.length, 2);
  assert.equal((await r.json()).profile.n, 2);
  // the next normal request gets the refreshed copy
  const after = await handle(req(""), env, null, { cache, fetch: up.fetch });
  assert.equal((await after.json()).profile.n, 2);
});

test("only fresh=1 is accepted", async () => {
  const r = await handle(req("&fresh=yes"), env, null, { cache: memCache(), fetch: upstream().fetch });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).param, "fresh");
});
