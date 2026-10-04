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
  max_dps      INTEGER,
  max_dps_ts   INTEGER,
  first_seen   INTEGER NOT NULL,
  last_seen    INTEGER NOT NULL,
  lookups      INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (region, server_id, character_id)
);
CREATE INDEX IF NOT EXISTS idx_board_seen  ON board (last_seen);
CREATE INDEX IF NOT EXISTS idx_board_power ON board (combat_power);
CREATE INDEX IF NOT EXISTS idx_board_dps   ON board (max_dps);
