CREATE TABLE IF NOT EXISTS smartphone_performance_measurements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  smartphone_id BIGINT UNSIGNED NOT NULL,
  variant_id BIGINT UNSIGNED NULL,
  metric VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  method_name VARCHAR(120) NOT NULL,
  method_version VARCHAR(80) NOT NULL,
  test_conditions VARCHAR(500) NOT NULL,
  device_settings VARCHAR(500) NOT NULL,
  measured_value DECIMAL(16,6) NOT NULL,
  unit VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_name VARCHAR(120) NOT NULL,
  source_url VARCHAR(2048) NOT NULL,
  measured_on DATE NOT NULL,
  checked_on DATE NOT NULL,
  verification_status VARCHAR(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending',
  protocol_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  observation_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  CONSTRAINT fk_performance_phone FOREIGN KEY (smartphone_id) REFERENCES smartphones(id) ON DELETE RESTRICT,
  CONSTRAINT fk_performance_variant FOREIGN KEY (variant_id) REFERENCES smartphone_variants(id) ON DELETE RESTRICT,
  CONSTRAINT uq_performance_observation UNIQUE (observation_key),
  INDEX ix_performance_lookup (smartphone_id, verification_status, protocol_key),
  CONSTRAINT ck_performance_status CHECK (verification_status IN ('pending','verified','rejected')),
  CONSTRAINT ck_performance_dates CHECK (checked_on >= measured_on),
  CONSTRAINT ck_performance_measurement CHECK (
    (metric IN ('cpu','gpu','sustained','camera_photo','camera_video') AND unit = 'score' AND measured_value > 0 AND measured_value <= 1000000000)
    OR (metric IN ('gpu','sustained') AND unit = 'fps' AND measured_value > 0 AND measured_value <= 10000)
    OR (metric = 'battery_runtime' AND unit = 'minutes' AND measured_value > 0 AND measured_value <= 10080)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
