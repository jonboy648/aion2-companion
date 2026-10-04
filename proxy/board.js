// Public board (Cloudflare D1, binding STATS): recent lookups and leaderboards. See schema.sql for the privacy notes.
// Rows come from the armory's own /info response, parsed here in the Worker, so they cannot be forged by a visitor.
import { clean, hasDb } from "./stats.js";

export const BOARD_SORTS = new Set(["recent", "power", "dps"]);
export const MAX_DPS = 1_000_000;
const MAX_POWER = 10_000_000;

const intIn = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);

/** The public fields of an upstream /info body (`{profile:{...}}`), or null if it is not a character. */
export function parseInfo(buf) {
  try {
    const p = JSON.parse(new TextDecoder().decode(buf))?.profile;
    const name = clean(p?.characterName, 32);
    const characterId = typeof p?.characterId === "string" ? p.characterId : "";
    const serverId = intIn(p?.serverId, 1, 999_999);
    const className = clean(p?.className, 24);
    if (!name || !className || serverId === null || !/^[A-Za-z0-9_\-=+/%]{8,128}$/.test(characterId)) return null;
    return {
      name,
      characterId,
      serverId,
      className,
      serverName: clean(p.serverName, 32),
      level: intIn(p.characterLevel, 1, 99),
      combatPower: intIn(p.combatPower, 0, MAX_POWER),
    };
  } catch {
    return null;
  }
}

/** Upsert the character an /info response describes. Silent no-op without a D1 binding; never throws. */
export async function recordInfo(env, region, buf, now = Date.now()) {
  if (!hasDb(env)) return;
  const c = parseInfo(buf);
  if (!c) return;
  try {
    await env.STATS.prepare(
      `INSERT INTO board (region, server_id, character_id, name, class_name, server_name, level, combat_power, first_seen, last_seen)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
       ON CONFLICT (region, server_id, character_id) DO UPDATE SET
         name = ?4, class_name = ?5, server_name = ?6, level = ?7, combat_power = ?8, last_seen = ?9, lookups = lookups + 1`,
    )
      .bind(region, c.serverId, c.characterId, c.name, c.className, c.serverName, c.level, c.combatPower, now)
      .run();
  } catch {
    /* the board must never break a user-facing response */
  }
}

/** Store the browser's max-potential estimate on a character the Worker has already seen. Returns true if a row changed. */
export async function recordDps(env, { region, serverId, characterId, dps }, now = Date.now()) {
  if (!hasDb(env)) return false;
  const r = await env.STATS.prepare(
    "UPDATE board SET max_dps = ?1, max_dps_ts = ?2 WHERE region = ?3 AND server_id = ?4 AND character_id = ?5",
  )
    .bind(dps, now, region, serverId, characterId)
    .run();
  return (r?.meta?.changes ?? 0) > 0;
}

const COLUMNS = "name, class_name, server_name, region, server_id, level, combat_power, max_dps, last_seen";

/** Rows for GET /board. sort: recent (newest lookups) | power (combat power) | dps (max-potential estimate). */
export async function boardRows(env, { sort, className, limit }) {
  const where = [];
  const args = [];
  if (sort === "power") where.push("combat_power IS NOT NULL");
  if (sort === "dps") where.push("max_dps IS NOT NULL");
  if (className) {
    args.push(className);
    where.push(`lower(class_name) = lower(?${args.length})`);
  }
  const order = sort === "power" ? "combat_power DESC, last_seen DESC" : sort === "dps" ? "max_dps DESC, last_seen DESC" : "last_seen DESC";
  args.push(limit);
  const sql = `SELECT ${COLUMNS} FROM board ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${order} LIMIT ?${args.length}`;
  const out = await env.STATS.prepare(sql).bind(...args).all();
  return (out.results ?? []).map((r) => ({
    name: r.name,
    class_name: r.class_name,
    server_name: r.server_name,
    region: r.region,
    server_id: r.server_id,
    level: r.level,
    combat_power: r.combat_power,
    max_dps: r.max_dps,
    last_seen: r.last_seen,
  }));
}
