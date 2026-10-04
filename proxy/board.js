// Public board (Cloudflare D1, binding STATS): recent lookups and leaderboards. See schema.sql for the privacy notes.
// Rows come from the armory's own /info response, parsed here in the Worker, so they cannot be forged by a visitor.
import { clean, hasDb } from "./stats.js";

export const BOARD_SORTS = new Set(["recent", "power", "gear", "dps"]);
export const MAX_DPS = 1_000_000;
export const DPS_COOLDOWN_MS = 600_000;
const MAX_POWER = 10_000_000;
const MAX_ITEM_LEVEL = 10_000;

const intIn = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);

/** The armory's ItemLevel stat ("gear score") from an /info body, or null. */
function itemLevelOf(info) {
  const stat = (info?.stat?.statList ?? []).find((s) => s?.type === "ItemLevel");
  return intIn(stat?.value, 0, MAX_ITEM_LEVEL);
}

/** The public fields of an upstream /info body (`{profile:{...}, stat:{statList:[...]}}`), or null if it is not a character. */
export function parseInfo(buf) {
  try {
    const info = JSON.parse(new TextDecoder().decode(buf));
    const p = info?.profile;
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
      itemLevel: itemLevelOf(info),
    };
  } catch {
    return null;
  }
}

const UPSERT_WITH_IL = `INSERT INTO board (region, server_id, character_id, name, class_name, server_name, level, combat_power, item_level, first_seen, last_seen)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?10, ?9, ?9)
       ON CONFLICT (region, server_id, character_id) DO UPDATE SET
         name = ?4, class_name = ?5, server_name = ?6, level = ?7, combat_power = ?8, item_level = ?10, last_seen = ?9, lookups = lookups + 1`;
// Used while the item_level column has not been added to an existing database yet (see migrations/).
const UPSERT_LEGACY = `INSERT INTO board (region, server_id, character_id, name, class_name, server_name, level, combat_power, first_seen, last_seen)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
       ON CONFLICT (region, server_id, character_id) DO UPDATE SET
         name = ?4, class_name = ?5, server_name = ?6, level = ?7, combat_power = ?8, last_seen = ?9, lookups = lookups + 1`;

/** Upsert the character an /info response describes. Silent no-op without a D1 binding; never throws. */
export async function recordInfo(env, region, buf, now = Date.now()) {
  if (!hasDb(env)) return;
  const c = parseInfo(buf);
  if (!c) return;
  const base = [region, c.serverId, c.characterId, c.name, c.className, c.serverName, c.level, c.combatPower, now];
  try {
    await env.STATS.prepare(UPSERT_WITH_IL).bind(...base, c.itemLevel).run();
  } catch {
    try {
      await env.STATS.prepare(UPSERT_LEGACY).bind(...base).run();
    } catch {
      /* the board must never break a user-facing response */
    }
  }
}

/**
 * Store the browser's max-potential estimate on a character the Worker has already seen. Anyone can call this, so a new
 * value only replaces the stored one if it is higher, or the stored one is older than DPS_COOLDOWN_MS (so engine fixes
 * can still lower it, but nobody can zero out or flip a score repeatedly).
 * Returns "updated" | "ignored" (character known, value not accepted now) | "unknown" (never seen via /info).
 */
export async function recordDps(env, { region, serverId, characterId, dps }, now = Date.now()) {
  if (!hasDb(env)) return "unknown";
  const r = await env.STATS.prepare(
    `UPDATE board SET max_dps = ?1, max_dps_ts = ?2
     WHERE region = ?3 AND server_id = ?4 AND character_id = ?5
       AND (max_dps IS NULL OR ?1 > max_dps OR max_dps_ts IS NULL OR max_dps_ts < ?6)`,
  )
    .bind(dps, now, region, serverId, characterId, now - DPS_COOLDOWN_MS)
    .run();
  if ((r?.meta?.changes ?? 0) > 0) return "updated";
  const known = await env.STATS.prepare("SELECT 1 AS x FROM board WHERE region = ?1 AND server_id = ?2 AND character_id = ?3")
    .bind(region, serverId, characterId)
    .all();
  return known.results?.length ? "ignored" : "unknown";
}

const COLUMNS = "name, class_name, server_name, region, server_id, level, combat_power, item_level, max_dps, last_seen";
const COLUMNS_LEGACY = "name, class_name, server_name, region, server_id, level, combat_power, NULL AS item_level, max_dps, last_seen";

const ORDER = {
  recent: "last_seen DESC",
  power: "combat_power DESC, last_seen DESC",
  gear: "item_level DESC, last_seen DESC",
  dps: "max_dps DESC, last_seen DESC",
};
const REQUIRES = { power: "combat_power IS NOT NULL", gear: "item_level IS NOT NULL", dps: "max_dps IS NOT NULL" };

/** Rows for GET /board. sort: recent (newest lookups) | power (combat power) | gear (item level) | dps (max-potential estimate). */
export async function boardRows(env, { sort, className, limit }) {
  const where = [];
  const args = [];
  if (REQUIRES[sort]) where.push(REQUIRES[sort]);
  if (className) {
    args.push(className);
    where.push(`lower(class_name) = lower(?${args.length})`);
  }
  args.push(limit);
  const sql = (cols, order) =>
    `SELECT ${cols} FROM board ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${order} LIMIT ?${args.length}`;
  let out;
  try {
    out = await env.STATS.prepare(sql(COLUMNS, ORDER[sort])).bind(...args).all();
  } catch (e) {
    // the item_level column is not in this database yet: serve the other boards, leave the gear board empty
    if (sort === "gear") return [];
    out = await env.STATS.prepare(sql(COLUMNS_LEGACY, ORDER[sort])).bind(...args).all();
  }
  return (out.results ?? []).map((r) => ({
    name: r.name,
    class_name: r.class_name,
    server_name: r.server_name,
    region: r.region,
    server_id: r.server_id,
    level: r.level,
    combat_power: r.combat_power,
    item_level: r.item_level ?? null,
    max_dps: r.max_dps,
    last_seen: r.last_seen,
  }));
}
