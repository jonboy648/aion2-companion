-- D1 schema for owner analytics (database `aion2-stats`, binding STATS). Idempotent: safe to re-run.
-- PRIVACY: no IP addresses, no user agents. `visitor` is a truncated SHA-256(ip + day + ADMIN_SALT), see stats.js.

CREATE TABLE IF NOT EXISTS visits (
  day     TEXT    NOT NULL,   -- UTC date, YYYY-MM-DD
  path    TEXT    NOT NULL,   -- normalized route pattern, e.g. /c/:region/:serverId/:name
  visitor TEXT    NOT NULL,   -- anonymous daily hash (16 hex chars)
  ts      INTEGER NOT NULL    -- unix ms
);
CREATE INDEX IF NOT EXISTS idx_visits_day ON visits (day);
CREATE INDEX IF NOT EXISTS idx_visits_day_visitor ON visits (day, visitor);
CREATE INDEX IF NOT EXISTS idx_visits_path ON visits (path);

CREATE TABLE IF NOT EXISTS searches (
  ts            INTEGER NOT NULL,  -- unix ms
  keyword       TEXT    NOT NULL,  -- trimmed, max 32 chars
  region        TEXT    NOT NULL,
  results       INTEGER NOT NULL,  -- hit count returned for this region lookup
  picked_name   TEXT,              -- set by POST /picked
  picked_server TEXT
);
CREATE INDEX IF NOT EXISTS idx_searches_ts ON searches (ts);
CREATE INDEX IF NOT EXISTS idx_searches_keyword ON searches (keyword COLLATE NOCASE);

-- Public board: one row per character the site has looked up. Filled by the Worker itself from the armory's own
-- /info response (never from the browser), so name, class and combat power cannot be faked. Only PUBLIC armory
-- fields are stored. max_dps is the one browser-supplied value (the in-browser max-potential estimate): it only
-- updates a row the Worker already created, is clamped, and is shown as an unverified estimate.
CREATE TABLE IF NOT EXISTS board (
  region       TEXT    NOT NULL,
  server_id    INTEGER NOT NULL,
  character_id TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  class_name   TEXT    NOT NULL,
  server_name  TEXT    NOT NULL DEFAULT '',
  level        INTEGER,
  combat_power INTEGER,
  item_level   INTEGER,   -- the armory's ItemLevel stat ("gear score"), read by the Worker like combat_power
  max_dps      INTEGER,
  max_dps_ts   INTEGER,
  first_seen   INTEGER NOT NULL,
  last_seen    INTEGER NOT NULL,
  lookups      INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (region, server_id, character_id)
);
CREATE INDEX IF NOT EXISTS idx_board_seen  ON board (last_seen);
CREATE INDEX IF NOT EXISTS idx_board_power ON board (combat_power);
CREATE INDEX IF NOT EXISTS idx_board_item_level ON board (item_level);
CREATE INDEX IF NOT EXISTS idx_board_dps   ON board (max_dps);

-- Live server status (same tables as migrations/2026-10-05-server-status.sql).
CREATE TABLE IF NOT EXISTS server_status (
  server_id  INTEGER PRIMARY KEY,   -- Elyos 1RNN, Asmodian 2RNN (R: 1 NAE, 2 NAW, 3 EU, 4 LA, 5 AS); NN pairs the halves
  region     TEXT    NOT NULL,
  race       INTEGER NOT NULL,      -- 1 Elyos, 2 Asmodian
  name       TEXT    NOT NULL,
  tags       INTEGER NOT NULL DEFAULT 0,  -- bitmask: 1 New, 2 Recommended, 4 Character creation blocked
  capacity   INTEGER NOT NULL,
  players    INTEGER NOT NULL,
  source_at  INTEGER NOT NULL,      -- unix ms the upstream says the count was reported
  stale      INTEGER NOT NULL DEFAULT 0,
  fetched_at INTEGER NOT NULL       -- unix ms of the cron run that stored it
);

CREATE TABLE IF NOT EXISTS server_status_history (
  server_id INTEGER NOT NULL,
  ts        INTEGER NOT NULL,       -- unix ms of the cron run
  players   INTEGER NOT NULL,
  PRIMARY KEY (server_id, ts)
);
CREATE INDEX IF NOT EXISTS idx_ssh_ts ON server_status_history (ts);

-- Per-region totals per cron run (fresh rows only): keeps the region chart cheap to read.
CREATE TABLE IF NOT EXISTS region_history (
  region  TEXT    NOT NULL,
  ts      INTEGER NOT NULL,
  players INTEGER NOT NULL,
  PRIMARY KEY (region, ts)
);
CREATE INDEX IF NOT EXISTS idx_rh_ts ON region_history (ts);

-- Official NCSOFT roster (names for servers the population feed does not list), refreshed at most every 24 h.
CREATE TABLE IF NOT EXISTS server_roster (
  server_id  INTEGER PRIMARY KEY,
  region     TEXT    NOT NULL,
  race       INTEGER NOT NULL,
  name       TEXT    NOT NULL,
  fetched_at INTEGER NOT NULL
);

-- last_ok_at, last_error_at, feed_updated, roster_at (unix ms).
CREATE TABLE IF NOT EXISTS status_meta (
  key   TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
