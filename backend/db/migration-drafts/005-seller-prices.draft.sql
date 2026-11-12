-- Opt-in, backup required. MySQL 8 DDL auto-commits. Never auto-run on app startup.
-- Apply once after inspecting information_schema; a repeat should fail with duplicate column.
-- Rollback: restore a verified backup into a separate database, validate, then switch deliberately.
-- Existing rows/IDs/FKs are untouched; unknown flags remain NULL, never false/true guesses.
ALTER TABLE price_observations
  ADD COLUMN price_metadata_json JSON NULL,
  ADD COLUMN observation_key CHAR(64) NULL,
  ADD CONSTRAINT ck_price_metadata_object CHECK(price_metadata_json IS NULL OR JSON_TYPE(price_metadata_json) = 'OBJECT'),
  ADD UNIQUE KEY uq_price_observation_key (observation_key),
  MODIFY unconditional TINYINT(1) NULL,
  MODIFY in_stock TINYINT(1) NULL,
  MODIFY is_new TINYINT(1) NULL,
  MODIFY is_unlocked TINYINT(1) NULL;
