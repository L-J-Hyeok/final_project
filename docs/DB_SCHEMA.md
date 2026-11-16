# DB_SCHEMA — 기기로움 MySQL 데이터베이스 구조 및 현황

> 기준일: 2026-11-16 | 확인 대상: MySQL `8.0.45` (`final_project` 스키마) + `backend/db/models.js`, `catalog-models.js`, `migrations/001, 006, 007`  
> 민감 정보(접속 계정·비밀번호·사용자 이메일/토큰)는 기록하지 않는다.

## 1. 전체 요약 및 용량

- **총 테이블 수**: **17개** (운영/서비스 테이블 15개 + 과거 백업 스냅샷 테이블 2개)
- **스토리지 엔진 / 문자셋**: 전 테이블 `InnoDB` / 운영 15개 `utf8mb4_0900_ai_ci`, 스냅샷 2개 `utf8mb4_unicode_ci`
- **총 DB 사용 용량**: **3,129,344 bytes (약 2.98 MiB)**
  - 데이터 용량 (`DATA_LENGTH`): `2,572,288 bytes` (약 2.45 MiB)
  - 인덱스 용량 (`INDEX_LENGTH`): `557,056 bytes` (약 0.53 MiB)

| 구분 | 테이블명 | 정확한 행 수 | 데이터(B) | 인덱스(B) | 합계(B) | 역할 |
|---|---|---:|---:|---:|---:|---|
| 인증/사용자 | `users` | 18 | 16,384 | 16,384 | 32,768 | 회원 계정 (`email`, `password_hash`) |
| 인증/사용자 | `sessions` | 36 | 16,384 | 32,768 | 49,152 | 로그인 세션 (`sid_hash` BINARY(32) PK) |
| 인증/사용자 | `profiles` | 18 | 16,384 | 0 | 16,384 | 사용자 취향 프로필 (`common_json`, `smartphone_json`) |
| 인증/사용자 | `owned_devices` | 19 | 16,384 | 32,768 | 49,152 | 보유 기기 (스마트폰 FK 또는 수동/공통카탈로그 JSON) |
| 추천 이력 | `recommendations` | 47 | 1,589,248 | 16,384 | 1,605,632 | 추천 요청/후보 스냅샷·결과 JSON 이력 |
| 스마트폰 전용 | `smartphones` | 53 | 163,840 | 32,768 | 196,608 | 스마트폰 모델 마스터 (`001` + `002` 확장 컬럼) |
| 스마트폰 전용 | `smartphone_variants` | 352 | 294,912 | 16,384 | 311,296 | 스마트폰 용량·RAM·색상별 SKU (`ram_identity_gb` 포함) |
| 스마트폰 전용 | `price_observations` | 93 | 65,536 | 16,384 | 81,920 | 스마트폰 가격 관측 이력 |
| 스마트폰 전용 | `smartphone_performance_measurements` | 0 | 16,384 | 49,152 | 65,536 | 스마트폰 성능 실측치 (`006`) |
| 공통 카탈로그 | `catalog_categories` | 6 | 16,384 | 16,384 | 32,768 | 6개 제품군 코드 마스터 |
| 공통 카탈로그 | `catalog_models` | 64 | 65,536 | 49,152 | 114,688 | 비스마트폰 5개 제품군 모델 마스터 |
| 공통 카탈로그 | `catalog_price_groups` | 0 | 16,384 | 65,536 | 81,920 | 동일 사양 가격 그룹 (현재 미사용, 0건) |
| 공통 카탈로그 | `catalog_skus` | 77 | 49,152 | 98,304 | 147,456 | 비스마트폰 5개 제품군 SKU |
| 공통 카탈로그 | `catalog_price_observations` | 56 | 16,384 | 65,536 | 81,920 | 비스마트폰 가격 관측 이력 (`target_key` 생성 컬럼) |
| 공통 카탈로그 | `catalog_admin_events` | 133 | 65,536 | 49,152 | 114,688 | 카탈로그 관리자 변경 감사 로그 |
| 백업 스냅샷 | `smartphones_data_snapshot_20261112` | 49 | 131,072 | 0 | 131,072 | 2026-11-12 스마트폰 백업 (코드 미매핑) |
| 백업 스냅샷 | `smartphone_variants_data_snapshot_20261112` | 31 | 16,384 | 0 | 16,384 | 2026-11-12 스마트폰 옵션 백업 (코드 미매핑) |

---

## 2. 스마트폰 전용 구조 vs 공통 카탈로그 구조 관계

기기로움 DB는 **이중 카탈로그 구조**로 운영된다.

1. **스마트폰 (`smartphone`)**:
   - 전용 테이블 `smartphones` → `smartphone_variants` → `price_observations` 사용.
   - `catalog_models`에는 `CHECK (category_code <> 'smartphone')` 제약이 걸려 있어 스마트폰 모델을 넣을 수 없다.
   - `owned_devices`는 `variant_id` FK가 `smartphone_variants(id)`만 직접 참조한다.
2. **신규 5개 제품군 (`tablet`, `laptop`, `smartwatch`, `earbuds`, `speaker`)**:
   - 공통 카탈로그 테이블 `catalog_categories` → `catalog_models` → `catalog_skus` → `catalog_price_observations` 사용.
   - `owned_devices`에서 비스마트폰 보유 기기를 저장할 때는 `variant_id = NULL`로 두고 `manual_brand`, `manual_model_name`, `manual_specs_json._catalog_ref`에 `{ model_id, sku_id, category, sku_code }`를 기록한다. (`ck_owned_category` 제약에 `earbuds`, `speaker`, `smartwatch` 코드가 없어 해당 기기는 `category = 'other'` 또는 `'watch'`로 저장됨)

```
[users] 1──N [sessions]
   │ 1──1 [profiles]
   │ 1──N [recommendations]
   └──1──N [owned_devices] ──(variant_id, smartphone만)──▶ [smartphone_variants] ──▶ [smartphones]
                 │                                                └──▶ [price_observations]
                 └──(manual_specs_json._catalog_ref, 비스마트폰)──▶ [catalog_skus] ──▶ [catalog_models]
                                                                          │                  │
                                                                          ▼                  ▼
                                                            [catalog_price_observations] ◀───┘
```

---

## 3. 주요 테이블 컬럼·제약·인덱스 요약

### 3.1 사용자 / 세션 / 프로필 / 보유기기 / 추천
- **`users`**: `id` (BIGINT UNSIGNED AI PK), `email` (VARCHAR(254) UNIQUE), `password_hash` (VARCHAR(512)), `created_at` (DATETIME(3)).
- **`sessions`**: `sid_hash` (BINARY(32) PK), `user_id` (FK→`users.id` ON DELETE CASCADE), `data` (JSON), `expires_at` (DATETIME(3)). 인덱스: `ix_sessions_expires`, `ix_sessions_user`.
- **`profiles`**: `user_id` (PK, FK→`users.id` ON DELETE CASCADE), `common_json` (JSON), `smartphone_json` (JSON), `version` (INT UNSIGNED DEFAULT 1, `>=1`), `confirmed_at` (DATETIME(3) NULL), `updated_at` (DATETIME(3)).
- **`owned_devices`**: `id` (PK), `user_id` (FK→`users.id` CASCADE), `variant_id` (NULL, FK→`smartphone_variants.id` RESTRICT), `category` (VARCHAR(16)), `manual_brand`, `manual_model_name`, `manual_model_number`, `manual_storage_gb`, `manual_specs_json` (JSON NULL).
  - CHECK: `ck_owned_category` (`smartphone`, `laptop`, `tablet`, `watch`, `monitor`, `pc`, `cpu`, `gpu`, `ram`, `ssd`, `motherboard`, `psu`, `case`, `cooler`, `other`), `ck_owned_mode` (FK 모드 vs 수동 모드 배타).
- **`recommendations`**: `id` (PK), `user_id` (FK→`users.id` CASCADE), `status` (`processing`/`recommend`/`clarify`/`keep`/`defer`/`no_match`/`failed`), `profile_version` (INT), `input_snapshot` (JSON), `candidates_snapshot` (JSON), `result_json` (JSON NULL), `validation_errors` (JSON NULL), `model_name`, `prompt_version`, `as_of` (DATETIME(3)), `created_at` (DATETIME(3)). 인덱스: `ix_recommendations_user (user_id, created_at, id)`.

### 3.2 스마트폰 전용 테이블
- **`smartphones`**:
  - 식별: `id` (PK), `brand` (VARCHAR(80)), `model_name` (VARCHAR(120)), `domestic_model_number` (VARCHAR(80) NULL). UNIQUE: `uq_smartphones_model (brand, domestic_model_number)`.
  - 사양: `released_on_kr` (DATE NULL), `os` (`android`/`ios`/`other`), `chipset` (VARCHAR(120) NULL), `screen_inches` (DECIMAL(4,2) NULL), `refresh_hz` (SMALLINT NULL), `battery_mah` (INT NULL), `weight_g` (DECIMAL(6,2) NULL), `supports_5g` (TINYINT(1) NULL), `wireless_charging` (TINYINT(1) NULL).
  - 검증/상태: `source_name`, `source_url`, `verified_at`, `verified` (DEFAULT 0), `is_test` (DEFAULT 1), `official_product_url`, `details_json`, `review_status` (`legacy`/`pending`/`approved`/`held`/`rejected`, DEFAULT `'pending'`), `review_metadata_json`.
  - 핵심 CHECK: `verified=1`이면 `source_name`, `source_url`, `verified_at`, `domestic_model_number`, `released_on_kr`, `os` 모두 NOT NULL이고 `review_status IN ('legacy','approved')`여야 함.
- **`smartphone_variants`**:
  - 식별: `id` (PK), `smartphone_id` (FK→`smartphones.id` RESTRICT), `storage_gb` (INT > 0), `ram_gb` (INT NULL, > 0), `color` (VARCHAR(40) DEFAULT `'unspecified'`), `ram_identity_gb` (**STORED 생성 컬럼** `COALESCE(ram_gb, 0)`).
  - UNIQUE: `uq_variants_option_ram (smartphone_id, storage_gb, ram_identity_gb, color)`.
  - 확장: `launch_price_krw` (INT UNSIGNED NULL), `launch_price_metadata_json`, `review_status`, `review_metadata_json`.
- **`price_observations`**:
  - `id` (PK), `variant_id` (FK→`smartphone_variants.id` RESTRICT), `source_name`, `source_url`, `seller_name`, `amount_krw` (INT UNSIGNED > 0), `shipping_krw` (NULL), `observed_at`, `expires_at` (`> observed_at`), `conditions_text`, `unconditional`, `in_stock`, `is_new`, `is_unlocked`.
  - 인덱스: `ix_prices_latest (variant_id, source_name, seller_name, observed_at, id)`.

### 3.3 공통 카탈로그 테이블 (`007-common-catalog.sql`)
- **`catalog_categories`**: `code` (VARCHAR(16) PK), `label` (VARCHAR(40)), `sort_order` (TINYINT UNSIGNED UNIQUE).
  - 현재 값: `smartphone(1)`, `tablet(2)`, `laptop(3)`, `smartwatch(4)`, `earbuds(5)`, `speaker(6)`.
- **`catalog_models`**:
  - `id` (PK), `category_code` (FK→`catalog_categories.code`, CHECK `<> 'smartphone'`), `brand` (80), `model_name` (120), `model_number` (80), `released_on` (DATE NULL), `weight_g` (DECIMAL(9,2) NULL), `official_product_url` (2048 NULL), `specs_json` (JSON OBJECT), `publication_status` (`private`/`public`), `verification_status` (`pending`/`verified`/`rejected`), `sale_status` (`unknown`/`on_sale`/`discontinued`), `is_test` (TINYINT(1) DEFAULT 0), `source_name`, `source_url`, `verified_at`.
  - UNIQUE: `uq_catalog_model_identity (category_code, brand, model_number)`, `uq_catalog_model_category (category_code, id)`.
  - CHECK: `publication_status = 'public'`이면 `verification_status = 'verified'` 및 `verified_at IS NOT NULL`.
- **`catalog_skus`**:
  - `id` (PK), `model_id`, `category_code` (복합 FK `(category_code, model_id)` → `catalog_models`), `sku_code` (100), `manufacturer_part_number` (100 NULL), `storage_gb` (INT UNSIGNED NULL), `ram_gb` (INT UNSIGNED NULL), `color` (80 NULL), `connectivity` (24 NULL), `options_json` (JSON OBJECT), `publication_status`, `verification_status`, `sale_status`, `source_name`, `source_url`, `verified_at`, `price_group_id` (NULL), `configuration_key` (CHAR(64) NULL).
  - UNIQUE: `uq_catalog_sku_identity (model_id, sku_code)`, `uq_catalog_sku_part (model_id, manufacturer_part_number)`, `uq_catalog_sku_parent (model_id, id)`.
- **`catalog_price_observations`**:
  - `id` (PK), `model_id` (FK), `sku_id` (NULL, 복합 FK `(model_id, sku_id)`), `price_group_id` (NULL, 복합 FK `(model_id, price_group_id)`), `seller_name` (120), `amount_minor` (BIGINT UNSIGNED > 0), `currency` (CHAR(3) DEFAULT `'KRW'`), `product_url` (2048), `observed_at` (DATETIME(3)), `checked_at` (`>= observed_at`), `status` (`normal`/`invalid`), `target_key` (**STORED 생성 컬럼**: `s:<sku_id>` / `g:<price_group_id>` / `model`).
  - UNIQUE: `uq_catalog_price_observation (model_id, target_key, seller_name, currency, observed_at)`.
  - 인덱스: `ix_catalog_price_target (model_id, target_key, status, observed_at DESC, id DESC)`.
- **`catalog_admin_events`**:
  - `id` (PK), `actor_user_id` (FK→`users.id` SET NULL), `model_id` (FK→`catalog_models.id`), `sku_id` (NULL, 복합 FK `(model_id, sku_id)`), `action` (40), `changes_json` (JSON OBJECT), `created_at` (DATETIME(3)).
