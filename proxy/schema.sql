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
