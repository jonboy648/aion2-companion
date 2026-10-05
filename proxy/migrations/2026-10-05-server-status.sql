-- Live server status tables for the existing `aion2-stats` D1 database (also in schema.sql for new databases).
-- Idempotent (CREATE IF NOT EXISTS), safe to run more than once:
--   npx wrangler d1 execute aion2-stats --remote --file=migrations/2026-10-05-server-status.sql
-- The Worker keeps working before this runs: the cron just records nothing and GET /status answers 503.

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
