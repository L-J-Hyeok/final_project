# CATALOG_FIELD_MAP — 6개 제품군 DB 필드 및 추천·업그레이드 엔진 매핑

> 기준 코드: `backend/services/catalog-validation.js`, `catalog-recommendation-engine.js`, `catalog-upgrade-advisor.js`, `recommendation-ranker.js`, `upgrade-advisor.js`, `danawa-price-sync.js`

## 1. 공통 규칙 (검증 및 결측 처리)

- **문자열(`text`)**: 앞뒤 공백 없음(`trim`), 길이 `1~120`, 제어문자 금지.
- **URL(`https`)**: `https://` 프로토콜 필수, 길이 `<= 2048`, 계정정보(`user:pass`)·제어문자 금지.
- **배열(`strings`)**: 1~32개, 중복 없는 `text` 배열.
- **결측치(NULL) 처리 원칙**:
  - `catalog-recommendation-engine.js` / `recommendation-ranker.js`: 미확인 사양(`null`)은 **0점이나 임의 추정치로 대체하지 않고 해당 메트릭(`metricScores[key] = null`)을 가중치 계산에서 제외**하며 `missing_metrics`와 `insufficient_info_notes`에 사유를 기록한다.
  - **가격(`price`) 누락/만료 시**:
    - 비스마트폰 5개 제품군: `checkHardEligibility()`에서 `MISSING_PRICE`로 **추천 후보에서 즉시 제외** (`budget_unlimited` 포함).
    - 스마트폰: `budget_max_krw` 또는 `budget_unlimited` 조건이 있으면 제외. `catalog_price_observations` 및 최근 정책에서는 마지막 정상 참고 가격(`retained_observation: true`)을 참고가로 표시하되 주의 문구를 함께 반환한다.

---

## 2. 스마트폰 (`smartphone`) — 전용 테이블 (`smartphones`, `smartphone_variants`, `price_observations`)

| 필드명 (DB 컬럼) | 타입 / 단위 | 필수 여부 | 허용값 / 검증 규칙 | 사용 위치 | 출처 | 누락 시 처리 |
|---|---|---|---|---|---|---|
| `brand` | VARCHAR(80) | 필수 | `apple`, `samsung` 등 소문자/정규화 | 추천 필터, 선호 브랜드 | 제조사 공식 | 등록 불가 |
| `model_name` | VARCHAR(120) | 필수 | 비어있지 않은 문자열 | 표시, UI, 보유기기 매칭 | 제조사 공식 | 등록 불가 |
| `domestic_model_number` | VARCHAR(80) | 공개 필수 | `(brand, domestic_model_number)` UNIQUE | 다나와 가격 그룹, 중복 판별 | 제조사/KC인증 | `verified=1` 불가 |
| `released_on_kr` | DATE | 공개 필수 | `YYYY-MM-DD`, 출시 3년 이내 윈도우 | `isWithinReleaseWindow`, 업그레이드 3년 경과 | 제조사 보도자료 | `verified=1` 불가 |
| `os` | VARCHAR(16) | 공개 필수 | `'android' \| 'ios' \| 'other'` | OS 필터, 생태계 가점 | 제조사 공식 | `verified=1` 불가 |
| `chipset` | VARCHAR(120) | 선택 | 문자열 | 비교표 표시 (벤치마크 점수 미생성) | 제조사 공식 | 표시 생략 |
| `screen_inches` | DECIMAL(4,2) / in | 선택(권장) | `> 0` | `portability`, `display` 점수, 업그레이드 비교 | 제조사 공식 | 화면 점수 제외/감점 |
| `refresh_hz` | SMALLINT / Hz | 선택(권장) | `> 0` (예: 60, 120) | `min_refresh_hz` 필터, `display` 점수 | 제조사 공식 | 필터 탈락 / 주사율 제외 |
| `battery_mah` | INT / mAh | 선택(권장) | `> 0` | `battery` 점수, 업그레이드 비교 | 제조사/인증 | 배터리 점수 제외 |
| `weight_g` | DECIMAL(6,2) / g | 선택(권장) | `> 0` | `max_weight_g` 필터, `portability` 점수 | 제조사 공식 | 필터 탈락 / 휴대성 제외 |
| `supports_5g` | BOOLEAN | 선택 | `0 \| 1 \| NULL` | `require_5g` 하드 필터 | 제조사 공식 | 5G 필터 시 탈락 |
| `wireless_charging` | BOOLEAN | 선택 | `0 \| 1 \| NULL` | `require_wireless_charging` 하드 필터 | 제조사 공식 | 무선충전 필터 시 탈락 |
| `storage_gb` (SKU) | INT / GB | 필수 | `> 0` | `min_storage_gb` 필터, `storage` 점수, 가격그룹 | 제조사/판매처 | 등록 불가 |
| `ram_gb` (SKU) | INT / GB | 선택 | `> 0` 또는 `NULL` (Apple 비공개 허용) | `memory_spec` 점수, 다나와 가격그룹(`ram_identity_gb`) | 제조사 공식 | `memory_spec` 제외 |
| `color` (SKU) | VARCHAR(40) | 필수 | 기본 `'unspecified'`, 동일 그룹 공통가 공유 | UI 색상 선택지 (`attachColorOptions`) | 제조사/판매처 | 기본값 처리 |
| `amount_krw` (가격) | INT UNSIGNED / 원 | 추천 시 필수 | `> 0`, `is_new=1`, `is_unlocked=1` | 예산 필터, `budget_fit` 점수 | 다나와 CLI / 공식몰 | 예산 필터 시 제외 |

---

## 3. 신규 5개 제품군 공통 컬럼 (`catalog_models`, `catalog_skus`, `catalog_price_observations`)

| 구분 | DB 컬럼 | 타입 / 단위 | 필수 여부 | 허용값 / 검증 규칙 | 사용 위치 |
|---|---|---|---|---|---|
| 모델 | `category_code` | VARCHAR(16) | 필수 | `'tablet' \| 'laptop' \| 'smartwatch' \| 'earbuds' \| 'speaker'` | 전체 엔진 분기 키 |
| 모델 | `brand`, `model_name`, `model_number` | VARCHAR | 필수 | `text` (1~120 / 80), `(category_code, brand, model_number)` UNIQUE | 후보 식별, 브랜드 필터 |
| 모델 | `released_on` | DATE | 선택 | `YYYY-MM-DD` (`specs_json.release_month` 보조) | 출시일 표시 |
| 모델 | `weight_g` | DECIMAL(9,2) / g | 선택(권장) | `> 0` (SKU `options_json.weight_g` 우선) | `max_weight_g` 필터, 휴대성/업그레이드 |
| 모델 | `source_name`, `source_url`, `verified_at` | VARCHAR / DATETIME | 공개 필수 | `source_url` HTTPS 필수, `public` 시 `verified`+`verified_at` 필수 | 공개 게이트 및 출처 표기 |
| SKU | `sku_code` | VARCHAR(100) | 필수 | `text`, `(model_id, sku_code)` UNIQUE | SKU 식별 |
| SKU | `connectivity` | VARCHAR(24) | 제품군별 필수 | 허용 Enum은 아래 제품군별 표 참조 | `require_cellular`, `connectivity` 필터 |
| 가격 | `amount_minor` | BIGINT UNSIGNED / KRW | 추천 시 필수 | `> 0`, `currency='KRW'`, `status='normal'` | 예산 필터, `budget_fit`, 가성비 |
| 가격 | `seller_name`, `product_url`, `observed_at`, `checked_at` | - | 가격 시 필수 | `product_url` HTTPS, `checked_at >= observed_at` | 최신가 윈도우(`ROW_NUMBER`), 출처 표시 |

---

## 4. 제품군별 세부 사양 (`specs_json`, `options_json`, SKU 컬럼)

### 4.1 태블릿 (`tablet`)
- **SKU 필수**: `storage_gb` (정수 GB, `>0`), `connectivity` (`'wifi' \| 'cellular'`)
- **SKU 선택**: `ram_gb` (정수 GB, Apple 등 미공개 시 `NULL`), `color`, `options_json.weight_g` (`0 < x <= 10000`)
- **`specs_json` 허용 키**:

| JSON 키 | 타입 / 단위 | 검증 상한 | 추천·업그레이드 사용 위치 | 누락 시 처리 |
|---|---|---|---|---|
| `chipset` | string | `text` | 업그레이드 비교표 표시 (벤치마크 점수 미생성) | 표시 생략 |
| `screen_inches` | number / in | `0 < x <= 40` | `display` 점수, 업그레이드 화면 비교 | `missing_metrics: ['screen_inches']` |
| `display` | string | `text` | 비교표 사양 표시 | 표시 생략 |
| `pen_supported` | boolean | `true \| false` | `require_pen` 필터, `pen_productivity` 점수, 업그레이드 개선 | `require_pen` 탈락, 점수 제외 |
| `keyboard_supported` | boolean | `true \| false` | `require_keyboard` 필터, `pen_productivity` 가점(1.0) | `require_keyboard` 탈락 |
| `battery_mah` / `battery_wh` | int / number | `mAh<=1048576`, `Wh<=1000` | `battery_portability` 점수, 업그레이드 비교(동일 단위만 비교) | `missing_metrics: ['battery']` |
| `release_month` | string | `YYYY-MM` | `released_on` 없을 때 `-01` 보완 | 생략 |

### 4.2 노트북 (`laptop`)
- **SKU 필수**: `storage_gb` (정수 GB), `ram_gb` (정수 GB), `options_json.cpu` (`text`)
- **SKU 선택**: `connectivity` (`'wifi' \| 'cellular'`), `color`, `options_json.gpu` (`text`), `options_json.display` (`text`), `options_json.storage_type` (`text`)
- **`specs_json` 허용 키**:

| JSON 키 | 타입 / 단위 | 검증 상한 | 추천·업그레이드 사용 위치 | 누락 시 처리 |
|---|---|---|---|---|
| `cpu` | string | `text` | 업그레이드 비교표 (임의 벤치마크 점수 미생성) | SKU `options_json.cpu` 참조 |
| `gpu` | string | `text` | `require_discrete_gpu` (`NVIDIA\|RTX\|GeForce\|Radeon RX`), `cpu_gpu` 점수 | 내장/미확인 기본점(0.60) |
| `screen_inches` | number / in | `0 < x <= 40` | `display` 점수 | 기본점 0.5 |
| `refresh_hz` | number / Hz | `0 < x <= 1000` | `min_refresh_hz` 필터, `display` 점수, 업그레이드 | 필터 탈락, 점수 기본 0.4 |
| `battery_wh` | number / Wh | `0 < x <= 1000` | `battery_portability` 점수, 업그레이드 비교 | `batScore = null` (무게로만 평가) |
| `display` | string | `text` | 비교표 표시 | 생략 |
| `os` | string | `text` | `required_os` (`macos`/`windows`) 추론 | OS 필터 시 탈락 |
| `ports` | string[] | `strings` | 비교표 및 확장성 표시 | 생략 |
| `release_month` | string | `YYYY-MM` | 출시월 보완 | 생략 |

### 4.3 스마트워치 (`smartwatch`)
- **SKU 필수**: `options_json.case_size_mm` (`0 < x <= 150`), `connectivity` (`'gps' \| 'cellular' \| 'bluetooth'`)
- **SKU 금지**: `storage_gb`, `ram_gb`는 반드시 `NULL` (`validateSkuFields`에서 거부됨)
- **SKU 선택**: `color`, `options_json.band` (`text`), `options_json.case_material` (`text`)
- **`specs_json` 허용 키**:

| JSON 키 | 타입 / 단위 | 검증 상한 | 추천·업그레이드 사용 위치 | 누락 시 처리 |
|---|---|---|---|---|
| `compatible_os` | string[] | `strings` | `compatible_os` (`ios`/`android`) 필터, `os_compatibility` 점수 | OS 필터 시 탈락 |
| `gps` | boolean | `true \| false` | `require_gps` 필터, `gps_sensors` 기본 점수(0.65 vs 0.2) | GPS 필터 탈락 |
| `sensors` | string[] | `strings` | `gps_sensors` 가점(+0.2) | 가점 없음 |
| `water_resistance` | string | `text` (예: `5ATM`, `IP68`) | `require_water_resistance` 필터, `gps_sensors` 가점(+0.15) | 필터 탈락 |
| `battery_mah` | int / mAh | `<= 1048576` | `battery` 점수 (Apple 등 비공개 시 `NULL`) | `missing_metrics: ['battery_mah']` |
| `screen_inches` | number / in | `0 < x <= 10` | 비교표 표시 | 생략 |
| `display` | string | `text` | 비교표 표시 | 생략 |
| `release_month` | string | `YYYY-MM` | 출시월 보완 | 생략 |

### 4.4 무선이어폰 (`earbuds`)
- **SKU 필수**: 별도 필수 옵션 없음 (`color`, `connectivity` 선택)
- **SKU 금지**: `storage_gb`, `ram_gb` 반드시 `NULL`
- **SKU `connectivity` 허용**: `'bluetooth' \| 'wired' \| 'wireless_dongle'`
- **`specs_json` 허용 키**:

| JSON 키 | 타입 / 단위 | 검증 상한 | 추천·업그레이드 사용 위치 | 누락 시 처리 |
|---|---|---|---|---|
| `anc` | boolean | `true \| false` | `require_anc` 필터, `anc` 점수(1.0 vs 0.2), 업그레이드 | `missing_metrics: ['anc']` |
| `bluetooth_version` | string | `text` (예: `"5.3"`) | `connectivity_codecs` 점수 | 기본 `5.0` 간주 |
| `codecs` | string[] | `strings` | `LDAC\|aptX Lossless\|aptX Adaptive\|SSC-UHQ\|SSC Hi-Fi` 가점(+0.2) | 가점 없음 |
| `battery_hours` | number / hr | `0 < x <= 1000` | `battery_durability` 점수, 업그레이드(조건 동일 시만 비교) | 배터리 점수 제외 |
| `battery_condition` | string | `text` | 업그레이드 동일 시험 조건 판별 키 | 주의 문구 출력 |
| `driver` | string | `text` | 비교표 표시 | 생략 |
| `water_resistance` | string | `text` (예: `IP57`) | `require_water_resistance` 필터, `battery_durability` 가점(+0.15) | 필터 탈락 |
| `wireless_charging` | boolean | `true \| false` | `require_wireless_charging` 필터, 가점(+0.10) | 필터 탈락 |
| `latency_ms` | number / ms | `0 < x <= 10000` | 비교표 표시 (선택) | 생략 |
| `release_month` | string | `YYYY-MM` | 출시월 보완 | 생략 |

### 4.5 스피커 (`speaker`)
- **SKU 필수**: 별도 필수 옵션 없음 (`color`, `connectivity`, `options_json.audio_configuration` 선택)
- **SKU 금지**: `storage_gb`, `ram_gb` 반드시 `NULL`
- **SKU `connectivity` 허용**: `'wired' \| 'bluetooth' \| 'wifi' \| 'multi'`
- **`specs_json` 허용 키**:

| JSON 키 | 타입 / 단위 | 검증 상한 | 추천·업그레이드 사용 위치 | 누락 시 처리 |
|---|---|---|---|---|
| `power_w` | number / W | `0 < x <= 100000` | `power_output` 점수, 결과 카드 정격 출력 표시(`35W`), 업그레이드 | 카드에 `"정보 없음"` 표시 |
| `battery_hours` | number / hr | `0 < x <= 1000` | `battery_durability` 점수 | 배터리 점수 제외 |
| `battery_condition` | string | `text` | 업그레이드 시험 조건 비교 | 주의 문구 출력 |
| `water_resistance` | string | `text` | `require_water_resistance` 필터, `IP67\|IP68` 가점(+0.2) | 가점 없음 |
| `bluetooth_version` | string | `text` | `connectivity` 점수 | 기본 `5.0` 간주 |
| `power_supply` | string | `text` | 비교표 전원 방식 표시 | 생략 |
| `dimensions_mm` | number[3] | 각 `0 < x <= 10000` | 비교표 크기 표시 (`[W, H, D]`) | 생략 |
| `audio_formats` | string[] | `strings` | 비교표 지원 포맷 표시 | 생략 |

---

## 5. 제품군별 3단계 필드 분류 요약 (등록 필수 / 추천 핵심 / 권장)

| 제품군 | ① 등록 필수 (없으면 DB/Import 불가) | ② 추천 핵심 (필터·점수·업그레이드 판단) | ③ 권장 (비교표·설명 품질 향상) |
|---|---|---|---|
| **스마트폰** | `brand`, `model_name`, `domestic_model_number`(공개), `released_on_kr`(공개), `os`(공개), `storage_gb`, `color`, `source_*` | `amount_krw`(예산 필터), `ram_gb`, `screen_inches`, `refresh_hz`, `battery_mah`, `weight_g`, `supports_5g`, `wireless_charging` | `chipset`, `official_product_url`, `launch_price_krw` |
| **태블릿** | `brand`, `model_name`, `model_number`, `sku_code`, `storage_gb`, `connectivity`, `source_*` | `amount_minor`(추천 필수), `pen_supported`, `keyboard_supported`, `ram_gb`, `screen_inches`, `battery_mah` 또는 `battery_wh`, `weight_g` | `chipset`, `display`, `released_on`, `release_month`, `official_product_url` |
| **노트북** | `brand`, `model_name`, `model_number`, `sku_code`, `storage_gb`, `ram_gb`, `options_json.cpu`, `source_*` | `amount_minor`(추천 필수), `specs_json.os`, `gpu`, `screen_inches`, `refresh_hz`, `battery_wh`, `weight_g` | `display`, `ports`, `options_json.storage_type`, `released_on` |
| **스마트워치** | `brand`, `model_name`, `model_number`, `sku_code`, `connectivity`, `options_json.case_size_mm`, `source_*` (`storage_gb`/`ram_gb` 금지) | `amount_minor`(추천 필수), `compatible_os`, `gps`, `water_resistance`, `battery_mah`, `weight_g` | `sensors`, `screen_inches`, `display`, `options_json.band`, `case_material` |
| **무선이어폰** | `brand`, `model_name`, `model_number`, `sku_code`, `source_*` (`storage_gb`/`ram_gb` 금지) | `amount_minor`(추천 필수), `anc`, `bluetooth_version`, `codecs`, `battery_hours`, `water_resistance`, `wireless_charging`, `weight_g` | `driver`, `battery_condition`, `latency_ms`, `connectivity` |
| **스피커** | `brand`, `model_name`, `model_number`, `sku_code`, `source_*` (`storage_gb`/`ram_gb` 금지) | `amount_minor`(추천 필수), `power_w`, `battery_hours`, `water_resistance`, `bluetooth_version`, `weight_g` | `power_supply`, `battery_condition`, `dimensions_mm`, `audio_formats` |

