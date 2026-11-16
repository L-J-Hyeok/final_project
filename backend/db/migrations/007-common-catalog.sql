CREATE TABLE IF NOT EXISTS catalog_categories (
  code VARCHAR(16) PRIMARY KEY,
  label VARCHAR(40) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO catalog_categories (code, label, sort_order) VALUES
  ('smartphone','스마트폰',1), ('tablet','태블릿',2), ('laptop','노트북',3),
  ('smartwatch','스마트워치',4), ('earbuds','무선이어폰',5), ('speaker','스피커',6)
ON DUPLICATE KEY UPDATE code = catalog_categories.code;

CREATE TABLE IF NOT EXISTS catalog_models (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_code VARCHAR(16) NOT NULL,
  brand VARCHAR(80) NOT NULL,
  model_name VARCHAR(120) NOT NULL,
  model_number VARCHAR(80) NOT NULL,
  released_on DATE NULL,
  weight_g DECIMAL(9,2) NULL,
  official_product_url VARCHAR(2048) NULL,
  specs_json JSON NOT NULL,
  publication_status ENUM('private','public') NOT NULL DEFAULT 'private',
  verification_status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  sale_status ENUM('unknown','on_sale','discontinued') NOT NULL DEFAULT 'unknown',
  is_test BOOLEAN NOT NULL DEFAULT FALSE,
  source_name VARCHAR(120) NOT NULL,
  source_url VARCHAR(2048) NOT NULL,
  verified_at DATETIME(3) NULL,
  UNIQUE KEY uq_catalog_model_identity (category_code, brand, model_number),
  UNIQUE KEY uq_catalog_model_category (category_code, id),
  KEY ix_catalog_model_list (category_code, publication_status, verification_status, is_test, id),
  FOREIGN KEY (category_code) REFERENCES catalog_categories (code),
  CHECK (category_code <> 'smartphone'),
  CHECK (weight_g IS NULL OR weight_g > 0),
  CHECK (JSON_TYPE(specs_json) = 'OBJECT'),
  CHECK (publication_status <> 'public' OR (verification_status = 'verified' AND verified_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS catalog_price_groups (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  model_id BIGINT UNSIGNED NOT NULL,
  category_code VARCHAR(16) NOT NULL,
  configuration_json JSON NOT NULL,
  configuration_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  evidence_url VARCHAR(2048) NOT NULL,
  UNIQUE KEY uq_catalog_group_configuration (model_id, configuration_key),
  UNIQUE KEY uq_catalog_group_target (model_id, id, configuration_key),
  UNIQUE KEY uq_catalog_group_parent (model_id, id),
  FOREIGN KEY (category_code, model_id) REFERENCES catalog_models (category_code, id),
  CHECK (JSON_TYPE(configuration_json) = 'OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS catalog_skus (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  model_id BIGINT UNSIGNED NOT NULL,
  category_code VARCHAR(16) NOT NULL,
  sku_code VARCHAR(100) NOT NULL,
  manufacturer_part_number VARCHAR(100) NULL,
  storage_gb INT UNSIGNED NULL,
  ram_gb INT UNSIGNED NULL,
  color VARCHAR(80) NULL,
  connectivity VARCHAR(24) NULL,
  options_json JSON NOT NULL,
  publication_status ENUM('private','public') NOT NULL DEFAULT 'private',
  verification_status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  sale_status ENUM('unknown','on_sale','discontinued') NOT NULL DEFAULT 'unknown',
  source_name VARCHAR(120) NOT NULL,
  source_url VARCHAR(2048) NOT NULL,
  verified_at DATETIME(3) NULL,
  price_group_id BIGINT UNSIGNED NULL,
  configuration_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  UNIQUE KEY uq_catalog_sku_identity (model_id, sku_code),
  UNIQUE KEY uq_catalog_sku_part (model_id, manufacturer_part_number),
  UNIQUE KEY uq_catalog_sku_parent (model_id, id),
  KEY ix_catalog_sku_list (model_id, publication_status, verification_status, id),
  FOREIGN KEY (category_code, model_id) REFERENCES catalog_models (category_code, id),
  FOREIGN KEY (model_id, price_group_id, configuration_key)
    REFERENCES catalog_price_groups (model_id, id, configuration_key),
  CHECK ((price_group_id IS NULL) = (configuration_key IS NULL)),
  CHECK (JSON_TYPE(options_json) = 'OBJECT'),
  CHECK (storage_gb IS NULL OR storage_gb > 0),
  CHECK (ram_gb IS NULL OR ram_gb > 0),
  CHECK (publication_status <> 'public' OR (verification_status = 'verified' AND verified_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS catalog_price_observations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  model_id BIGINT UNSIGNED NOT NULL,
  sku_id BIGINT UNSIGNED NULL,
  price_group_id BIGINT UNSIGNED NULL,
  seller_name VARCHAR(120) NOT NULL,
  amount_minor BIGINT UNSIGNED NOT NULL,
  currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'KRW',
  product_url VARCHAR(2048) NOT NULL,
  observed_at DATETIME(3) NOT NULL,
  checked_at DATETIME(3) NOT NULL,
  status ENUM('normal','invalid') NOT NULL DEFAULT 'normal',
  target_key VARCHAR(22) GENERATED ALWAYS AS
    (CASE WHEN sku_id IS NOT NULL THEN CONCAT('s:',sku_id)
          WHEN price_group_id IS NOT NULL THEN CONCAT('g:',price_group_id) ELSE 'model' END) STORED,
  UNIQUE KEY uq_catalog_price_observation (model_id, target_key, seller_name, currency, observed_at),
  KEY ix_catalog_price_target (model_id, target_key, status, observed_at DESC, id DESC),
  FOREIGN KEY (model_id) REFERENCES catalog_models (id),
  FOREIGN KEY (model_id, sku_id) REFERENCES catalog_skus (model_id, id),
  FOREIGN KEY (model_id, price_group_id) REFERENCES catalog_price_groups (model_id, id),
  CHECK (sku_id IS NULL OR price_group_id IS NULL),
  CHECK (amount_minor > 0),
  CHECK (checked_at >= observed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS catalog_admin_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id BIGINT UNSIGNED NULL,
  model_id BIGINT UNSIGNED NOT NULL,
  sku_id BIGINT UNSIGNED NULL,
  action VARCHAR(40) NOT NULL,
  changes_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL,
  FOREIGN KEY (model_id) REFERENCES catalog_models (id),
  FOREIGN KEY (model_id, sku_id) REFERENCES catalog_skus (model_id, id),
  KEY ix_catalog_admin_model (model_id, id),
  CHECK (JSON_TYPE(changes_json) = 'OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
