import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { handle, _resetRateLimit } from "../worker.js";
import { parseInfo } from "../board.js";

const ORIGIN = "https://becomecube.com";
const baseEnv = { ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173` };
const CID = "SQlrdtb1Tw1yEhS_c-OisaL9MCPPr9kxYIr6S7hx8JM=";

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
const mkCtx = () => {
  const jobs = [];
  return { waitUntil: (p) => jobs.push(p), settle: () => Promise.all(jobs) };
};
const mkEnv = () => ({ ...baseEnv, STATS: fakeD1() });
const info = (o = {}) =>
  JSON.stringify({
    profile: { characterId: CID, characterName: "DarthThot", className: "Sorcerer", serverId: 2103, serverName: "Triniel", characterLevel: 45, combatPower: 38507, ...o },
  });
const deps = (body) => ({
  fetch: async () => new Response(body, { status: 200, headers: { "Content-Type": "application/json" } }),
  cache: { match: async () => undefined, put: async () => {} },
});
const lookup = async (env, body, ctx = mkCtx(), region = "nae") => {
  const r = await handle(
    new Request(`http://x/info?characterId=${encodeURIComponent(CID)}&serverId=2103&region=${region}`, { headers: { "CF-Connecting-IP": "203.0.113.5", Origin: ORIGIN } }),
    env, ctx, deps(body),
  );
  await ctx.settle();
  return r;
};
const board = (env, qs = "") => handle(new Request(`http://x/board${qs}`, { headers: { "CF-Connecting-IP": "203.0.113.6", Origin: ORIGIN } }), env, mkCtx());
const postDps = (env, body, headers = {}) =>
  handle(new Request("http://x/board/dps", { method: "POST", headers: { "CF-Connecting-IP": "203.0.113.7", Origin: ORIGIN, "Content-Type": "text/plain", ...headers }, body: JSON.stringify(body) }), env, mkCtx());
const rows = (env) => env.STATS.db.prepare("SELECT * FROM board").all().map((r) => ({ ...r }));

beforeEach(() => _resetRateLimit());

test("parseInfo keeps only public fields and rejects non-characters", () => {
  const c = parseInfo(new TextEncoder().encode(info()));
  assert.deepEqual(c, { name: "DarthThot", characterId: CID, serverId: 2103, className: "Sorcerer", serverName: "Triniel", level: 45, combatPower: 38507, itemLevel: null });
  for (const bad of ["{}", "not json", info({ characterName: "" }), info({ characterId: "x" }), info({ serverId: 0 })]) {
    assert.equal(parseInfo(new TextEncoder().encode(bad)), null, bad);
  }
});

test("an /info lookup is recorded from the armory's own response, and repeat lookups update it", async () => {
  const env = mkEnv();
  await lookup(env, info());
  await lookup(env, info({ combatPower: 40000, characterLevel: 46 }));
  const r = rows(env);
  assert.equal(r.length, 1);
  assert.equal(r[0].combat_power, 40000);
  assert.equal(r[0].level, 46);
  assert.equal(r[0].lookups, 2);
  assert.equal(r[0].region, "nae");
});

test("a non-character /info body is not recorded and the response is unchanged", async () => {
  const env = mkEnv();
  const res = await lookup(env, '{"hello":1}');
  assert.equal(res.status, 200);
  assert.equal(rows(env).length, 0);
});

test("GET /board: recent, power and dps orderings, class filter, public (no admin token)", async () => {
  const env = mkEnv();
  const seed = (name, cls, power, ts, dps = null) =>
    env.STATS.db.prepare("INSERT INTO board (region, server_id, character_id, name, class_name, server_name, level, combat_power, max_dps, first_seen, last_seen) VALUES ('nae', 1, ?1, ?2, ?3, 'S', 45, ?4, ?5, ?6, ?6)").run(`id-${name}-12345`, name, cls, power, dps, ts);
  seed("A", "Cleric", 30000, 1000, 5000);
  seed("B", "Sorcerer", 50000, 3000, 20000);
  seed("C", "Cleric", 40000, 2000, null);
  const names = async (qs) => (await (await board(env, qs)).json()).rows.map((r) => r.name);
  assert.deepEqual(await names(""), ["B", "C", "A"]);
  assert.deepEqual(await names("?sort=power"), ["B", "C", "A"]);
  assert.deepEqual(await names("?sort=dps"), ["B", "A"]);
  assert.deepEqual(await names("?sort=power&class=cleric"), ["C", "A"]);
  assert.deepEqual(await names("?limit=1"), ["B"]);
  const res = await board(env, "?sort=power");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.ok(!("character_id" in (await res.json()).rows[0]), "internal ids are not published");
});

test("GET /board rejects bad params and answers 503 without a database", async () => {
  const env = mkEnv();
  for (const [qs, param] of [["?sort=evil", "sort"], ["?limit=0", "limit"], ["?limit=51", "limit"], ["?class=a%3Bb", "class"]]) {
    const r = await board(env, qs);
    assert.equal(r.status, 400, qs);
    assert.equal((await r.json()).param, param);
  }
  assert.equal((await board(baseEnv)).status, 503);
});

test("POST /board/dps updates only a character the Worker already saw, with clamped values", async () => {
  const env = mkEnv();
  const good = { region: "nae", serverId: 2103, characterId: CID, dps: 12345.6 };
  assert.equal((await postDps(env, good)).status, 404, "unknown character");
  await lookup(env, info());
  assert.equal((await postDps(env, good)).status, 204);
  assert.equal(rows(env)[0].max_dps, 12346);
  for (const [patch, param] of [[{ dps: 0 }, "dps"], [{ dps: 2e6 }, "dps"], [{ dps: "9" }, "dps"], [{ region: "xx" }, "region"], [{ serverId: "2103" }, "serverId"], [{ characterId: "short" }, "characterId"]]) {
    const r = await postDps(env, { ...good, ...patch });
    assert.equal(r.status, 400, JSON.stringify(patch));
    assert.equal((await r.json()).param, param);
  }
  assert.equal(rows(env)[0].max_dps, 12346, "bad submissions change nothing");
});

test("a lower DPS cannot replace a higher one inside the cooldown, a higher one can, and an old one can be replaced", async () => {
  const env = mkEnv();
  await lookup(env, info());
  const send = (dps) => postDps(env, { region: "nae", serverId: 2103, characterId: CID, dps });
  assert.equal((await send(20000)).status, 204);
  assert.equal((await send(1)).status, 204, "ignored but not an error");
  assert.equal(rows(env)[0].max_dps, 20000, "a forged low value does not zero the score");
  assert.equal((await send(30000)).status, 204);
  assert.equal(rows(env)[0].max_dps, 30000, "higher values are accepted");
  env.STATS.db.prepare("UPDATE board SET max_dps_ts = ?1").run(Date.now() - 11 * 60_000);
  assert.equal((await send(25000)).status, 204);
  assert.equal(rows(env)[0].max_dps, 25000, "after the cooldown the value can come down (engine fixes)");
});

test("the board page itself is a countable analytics path", async () => {
  const { normalizePath } = await import("../stats.js");
  assert.equal(normalizePath("/board"), "/board");
  assert.equal(normalizePath("/maps"), "/maps");
});

test("POST /board/dps is only accepted from the site's own origin", async () => {
  const env = mkEnv();
  await lookup(env, info());
  const r = await postDps(env, { region: "nae", serverId: 2103, characterId: CID, dps: 100 }, { Origin: "https://evil.example" });
  assert.equal(r.status, 403);
  assert.equal(rows(env)[0].max_dps, null);
});

const withIL = (v, o = {}) => JSON.stringify({ profile: { characterId: CID, characterName: "DarthThot", className: "Sorcerer", serverId: 2103, serverName: "Triniel", characterLevel: 45, combatPower: 38507, ...o }, stat: { statList: [{ type: "Might", value: 14 }, { type: "ItemLevel", name: "x", value: v }] } });

test("item level (gear score) is read from the armory's own stat list", () => {
  assert.equal(parseInfo(new TextEncoder().encode(withIL(738))).itemLevel, 738);
  for (const bad of [-1, 99999, "738", null, 7.5]) assert.equal(parseInfo(new TextEncoder().encode(withIL(bad))).itemLevel, null, String(bad));
});

test("item level is recorded, updated, ranked by sort=gear and returned on every board", async () => {
  const env = mkEnv();
  await lookup(env, withIL(700));
  await lookup(env, withIL(738)); // same character again: updated
  const seed = (name, il) =>
    env.STATS.db.prepare("INSERT INTO board (region, server_id, character_id, name, class_name, server_name, level, combat_power, item_level, first_seen, last_seen) VALUES ('nae', 1, ?1, ?2, 'Cleric', 'S', 45, 100, ?3, 1, 1)").run(`id-${name}-12345`, name, il);
  seed("Low", 500);
  seed("High", 900);
  seed("None", null);
  const rowsOf = async (qs) => (await (await board(env, qs)).json()).rows;
  assert.equal(rows(env).find((r) => r.name === "DarthThot").item_level, 738);
  assert.deepEqual((await rowsOf("?sort=gear")).map((r) => [r.name, r.item_level]), [["High", 900], ["DarthThot", 738], ["Low", 500]]);
  assert.ok((await rowsOf("?sort=power")).every((r) => "item_level" in r));
  assert.deepEqual((await rowsOf("?sort=gear&class=sorcerer")).map((r) => r.name), ["DarthThot"]);
});

test("a database without the item_level column keeps recording and serving (gear board empty until migrated)", async () => {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE board (region TEXT NOT NULL, server_id INTEGER NOT NULL, character_id TEXT NOT NULL, name TEXT NOT NULL, class_name TEXT NOT NULL,
    server_name TEXT NOT NULL DEFAULT '', level INTEGER, combat_power INTEGER, max_dps INTEGER, max_dps_ts INTEGER, first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL, lookups INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (region, server_id, character_id));`);
  const stmt = (sql, args = []) => ({ bind: (...a) => stmt(sql, a), run: async () => ({ meta: { changes: Number(d.prepare(sql).run(...args).changes) } }), all: async () => ({ results: d.prepare(sql).all(...args).map((r) => ({ ...r })) }) });
  const env = { ...baseEnv, STATS: { prepare: (sql) => stmt(sql), batch: async () => [] } };
  await lookup(env, withIL(738));
  assert.equal(d.prepare("SELECT COUNT(*) AS n FROM board").get().n, 1, "recorded through the legacy statement");
  const recent = await (await board(env, "?sort=recent")).json();
  assert.equal(recent.rows.length, 1);
  assert.equal(recent.rows[0].item_level, null);
  assert.deepEqual((await (await board(env, "?sort=gear")).json()).rows, []);
});

