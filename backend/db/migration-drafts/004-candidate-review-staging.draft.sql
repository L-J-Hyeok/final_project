-- DRAFT ONLY: isolated review staging schema for Phase 3/4 verification.
-- NEVER execute automatically against production MySQL without explicit Phase 4 approval and backup.
-- Existing product tables (smartphones, smartphone_variants, price_observations) remain untouched.

CREATE TABLE IF NOT EXISTS candidate_reviews (
  candidate_id VARCHAR(160) NOT NULL,
  candidate_kind VARCHAR(32) NOT NULL,
  brand VARCHAR(32) NOT NULL,
  model_name VARCHAR(120) NOT NULL,
  domestic_model_number VARCHAR(80) NULL,
  storage_gb INT NULL,
  ram_gb INT NULL,
  color VARCHAR(40) NULL,
  verification_status VARCHAR(24) NOT NULL,
  admin_status VARCHAR(16) NOT NULL DEFAULT 'pending',
  latest_reason VARCHAR(500) NULL,
  reviewed_by_user_id BIGINT UNSIGNED NULL,
  reviewed_by_email VARCHAR(254) NULL,
  reviewed_at DATETIME(3) NULL,
  duplicate_checked_at DATETIME(3) NULL,
  duplicate_found BOOLEAN NOT NULL DEFAULT FALSE,
  official_sources_json JSON NOT NULL,
  payload_snapshot_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (candidate_id),
  CONSTRAINT ck_cr_kind CHECK (candidate_kind IN ('new_model','new_variant','review_model','db_pending_model','db_pending_variant')),
  CONSTRAINT ck_cr_verification CHECK (verification_status IN ('VERIFIED','REVIEW_REQUIRED','REJECTED')),
  CONSTRAINT ck_cr_admin_status CHECK (admin_status IN ('pending','approved','held','rejected')),
  CONSTRAINT ck_cr_approved_policy CHECK (admin_status <> 'approved' OR (verification_status = 'VERIFIED' AND duplicate_found = 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS candidate_review_histories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  candidate_id VARCHAR(160) NOT NULL,
  actor_user_id BIGINT UNSIGNED NOT NULL,
  actor_email VARCHAR(254) NOT NULL,
  action VARCHAR(16) NOT NULL,
  from_admin_status VARCHAR(16) NOT NULL,
  to_admin_status VARCHAR(16) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  duplicate_found BOOLEAN NOT NULL DEFAULT FALSE,
  duplicate_detail VARCHAR(500) NULL,
  reviewed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_crh_candidate_time (candidate_id, reviewed_at, id),
  CONSTRAINT fk_crh_candidate FOREIGN KEY (candidate_id) REFERENCES candidate_reviews (candidate_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_crh_action CHECK (action IN ('approve','hold','reject'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
