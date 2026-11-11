-- DRAFT ONLY: not registered with db/migrate.js. Never run against production now.
-- MySQL 8.0.16+. Obtain separate approval, backup and schema/ID/FK snapshot first.
-- Stop on any error. DDL auto-commits; do not retry partially applied steps blindly.
-- Existing records keep their IDs, FKs, verified, dates and values.
-- Existing price_observations is intentionally untouched.
ALTER TABLE smartphones
  ADD COLUMN official_product_url VARCHAR(2048) NULL,
  ADD COLUMN details_json JSON NULL,
  ADD COLUMN review_status VARCHAR(16) NOT NULL DEFAULT 'legacy',
  ADD COLUMN review_metadata_json JSON NULL,
  ADD CONSTRAINT ck_phone_details_object CHECK(details_json IS NULL OR JSON_TYPE(details_json) = 'OBJECT'),
  ADD CONSTRAINT ck_phone_review_object CHECK(review_metadata_json IS NULL OR JSON_TYPE(review_metadata_json) = 'OBJECT'),
  ADD CONSTRAINT ck_phone_review_status CHECK(review_status IN ('legacy','pending','approved','held','rejected')),
  ADD CONSTRAINT ck_phone_review_verified CHECK(verified = 0 OR review_status IN ('legacy','approved')),
  ADD CONSTRAINT ck_phone_review_approved CHECK(review_status <> 'approved' OR (review_metadata_json IS NOT NULL AND JSON_TYPE(review_metadata_json) = 'OBJECT'));

ALTER TABLE smartphone_variants
  ADD COLUMN launch_price_krw INT UNSIGNED NULL,
  ADD COLUMN launch_price_metadata_json JSON NULL,
  ADD COLUMN review_status VARCHAR(16) NOT NULL DEFAULT 'legacy',
  ADD COLUMN review_metadata_json JSON NULL,
  ADD COLUMN ram_identity_gb INT GENERATED ALWAYS AS (COALESCE(ram_gb, 0)) STORED,
  ADD CONSTRAINT uq_variants_option_ram UNIQUE(smartphone_id, storage_gb, ram_identity_gb, color),
  ADD CONSTRAINT ck_variant_launch_amount CHECK(launch_price_krw IS NULL OR launch_price_krw > 0),
  ADD CONSTRAINT ck_variant_launch_object CHECK(launch_price_metadata_json IS NULL OR JSON_TYPE(launch_price_metadata_json) = 'OBJECT'),
  ADD CONSTRAINT ck_variant_launch_evidence CHECK(launch_price_krw IS NULL OR (launch_price_metadata_json IS NOT NULL AND JSON_TYPE(launch_price_metadata_json) = 'OBJECT')),
  ADD CONSTRAINT ck_variant_review_object CHECK(review_metadata_json IS NULL OR JSON_TYPE(review_metadata_json) = 'OBJECT'),
  ADD CONSTRAINT ck_variant_review_status CHECK(review_status IN ('legacy','pending','approved','held','rejected')),
  ADD CONSTRAINT ck_variant_review_verified CHECK(verified = 0 OR review_status IN ('legacy','approved')),
  ADD CONSTRAINT ck_variant_review_approved CHECK(review_status <> 'approved' OR (review_metadata_json IS NOT NULL AND JSON_TYPE(review_metadata_json) = 'OBJECT'));

-- Change defaults for FUTURE rows only. Pause all product writers during these steps.
-- Old writers that set verified=true without review_status must be upgraded first.
ALTER TABLE smartphones ALTER COLUMN review_status SET DEFAULT 'pending';
ALTER TABLE smartphone_variants ALTER COLUMN review_status SET DEFAULT 'pending';
-- Keep uq_variants_option until the reviewed writer and ORM are ready for stage 003.
