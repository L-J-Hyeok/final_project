CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(512) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_users_email UNIQUE(email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE sessions (
  sid_hash BINARY(32) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  data JSON NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_sessions_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX ix_sessions_expires(expires_at),
  INDEX ix_sessions_user(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE profiles (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  common_json JSON NOT NULL,
  smartphone_json JSON NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  confirmed_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_profiles_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT ck_profiles_version CHECK(version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE smartphones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  brand VARCHAR(80) NOT NULL,
  model_name VARCHAR(120) NOT NULL,
  domestic_model_number VARCHAR(80) NULL,
  released_on_kr DATE NULL,
  os VARCHAR(16) NULL,
  chipset VARCHAR(120) NULL,
  screen_inches DECIMAL(4,2) NULL,
  refresh_hz SMALLINT NULL,
  battery_mah INT NULL,
  weight_g DECIMAL(6,2) NULL,
  supports_5g BOOLEAN NULL,
  wireless_charging BOOLEAN NULL,
  source_name VARCHAR(120) NULL,
  source_url VARCHAR(2048) NULL,
  verified_at DATETIME(3) NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_test BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_smartphones_model UNIQUE(brand, domestic_model_number),
  INDEX ix_smartphones_release(brand, released_on_kr),
  CONSTRAINT ck_smartphones_os CHECK(os IN ('android','ios','other')),
  CONSTRAINT ck_smartphones_positive CHECK(
   (screen_inches IS NULL OR screen_inches > 0) AND
   (refresh_hz IS NULL OR refresh_hz > 0) AND
   (battery_mah IS NULL OR battery_mah > 0) AND
   (weight_g IS NULL OR weight_g > 0)),
  CONSTRAINT ck_smartphones_flags CHECK(
   (supports_5g IS NULL OR supports_5g IN (0,1)) AND
   (wireless_charging IS NULL OR wireless_charging IN (0,1)) AND
   verified IN (0,1) AND is_test IN (0,1)),
  CONSTRAINT ck_smartphones_verified CHECK(verified = 0 OR (
   source_name IS NOT NULL AND source_url IS NOT NULL AND verified_at IS NOT NULL AND
   domestic_model_number IS NOT NULL AND released_on_kr IS NOT NULL AND os IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE smartphone_variants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  smartphone_id BIGINT UNSIGNED NOT NULL,
  storage_gb INT NOT NULL,
  ram_gb INT NULL,
  color VARCHAR(40) NOT NULL DEFAULT 'unspecified',
  source_name VARCHAR(120) NULL,
  source_url VARCHAR(2048) NULL,
  verified_at DATETIME(3) NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_variants_phone FOREIGN KEY(smartphone_id) REFERENCES smartphones(id) ON DELETE RESTRICT,
  CONSTRAINT uq_variants_option UNIQUE(smartphone_id, storage_gb, color),
  CONSTRAINT ck_variants_capacity CHECK(storage_gb > 0 AND (ram_gb IS NULL OR ram_gb > 0)),
  CONSTRAINT ck_variants_verified CHECK(verified IN (0,1) AND (verified = 0 OR (
   source_name IS NOT NULL AND source_url IS NOT NULL AND verified_at IS NOT NULL)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE price_observations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  variant_id BIGINT UNSIGNED NOT NULL,
  source_name VARCHAR(120) NOT NULL,
  source_url VARCHAR(2048) NOT NULL,
  seller_name VARCHAR(120) NOT NULL,
  amount_krw INT UNSIGNED NOT NULL,
  shipping_krw INT UNSIGNED NULL,
  observed_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  conditions_text VARCHAR(500) NOT NULL,
  unconditional BOOLEAN NOT NULL,
  in_stock BOOLEAN NOT NULL,
  is_new BOOLEAN NOT NULL,
  is_unlocked BOOLEAN NOT NULL,
  CONSTRAINT fk_prices_variant FOREIGN KEY(variant_id) REFERENCES smartphone_variants(id) ON DELETE RESTRICT,
  INDEX ix_prices_latest(variant_id, source_name, seller_name, observed_at, id),
  CONSTRAINT ck_prices_amount CHECK(amount_krw > 0),
  CONSTRAINT ck_prices_period CHECK(expires_at > observed_at),
  CONSTRAINT ck_prices_flags CHECK(unconditional IN (0,1) AND in_stock IN (0,1) AND is_new IN (0,1) AND is_unlocked IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE owned_devices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  variant_id BIGINT UNSIGNED NULL,
  category VARCHAR(16) NOT NULL,
  manual_brand VARCHAR(80) NULL,
  manual_model_name VARCHAR(120) NULL,
  manual_model_number VARCHAR(80) NULL,
  manual_storage_gb INT NULL,
  manual_specs_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_owned_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_owned_variant FOREIGN KEY(variant_id) REFERENCES smartphone_variants(id) ON DELETE RESTRICT,
  INDEX ix_owned_user(user_id),
  CONSTRAINT ck_owned_category CHECK(category IN ('smartphone','laptop','tablet','watch','monitor','pc','cpu','gpu','ram','ssd','motherboard','psu','case','cooler','other')),
  CONSTRAINT ck_owned_mode CHECK(
   (variant_id IS NOT NULL AND category = 'smartphone' AND manual_brand IS NULL AND manual_model_name IS NULL
    AND manual_model_number IS NULL AND manual_storage_gb IS NULL AND manual_specs_json IS NULL)
   OR (variant_id IS NULL AND manual_brand IS NOT NULL AND manual_model_name IS NOT NULL)),
  CONSTRAINT ck_owned_storage CHECK(manual_storage_gb IS NULL OR (
   category IN ('smartphone','laptop','tablet','pc','ssd') AND manual_storage_gb > 0)),
  CONSTRAINT ck_owned_specs CHECK(manual_specs_json IS NULL OR JSON_TYPE(manual_specs_json) = 'OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE recommendations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(16) NOT NULL,
  profile_version INT NOT NULL,
  input_snapshot JSON NOT NULL,
  candidates_snapshot JSON NOT NULL,
  result_json JSON NULL,
  validation_errors JSON NULL,
  model_name VARCHAR(120) NULL,
  prompt_version VARCHAR(40) NOT NULL,
  as_of DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_recommendations_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX ix_recommendations_user(user_id, created_at, id),
  CONSTRAINT ck_recommendations_status CHECK(status IN ('processing','recommend','clarify','keep','defer','no_match','failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
