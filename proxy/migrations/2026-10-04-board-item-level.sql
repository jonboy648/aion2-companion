-- One-time migration for the existing `aion2-stats` D1 database: adds the item level ("gear score") column to the public board.
-- New databases get the column from schema.sql. Run ONCE (ALTER ... ADD COLUMN is not idempotent):
--   npx wrangler d1 execute aion2-stats --remote --file=migrations/2026-10-04-board-item-level.sql
-- The Worker keeps working before this runs (it falls back to the old columns), the gear-score ranking just stays empty.
ALTER TABLE board ADD COLUMN item_level INTEGER;
CREATE INDEX IF NOT EXISTS idx_board_item_level ON board (item_level);
