# DATA_COLLECTION_GUIDE — 조원용 제품 데이터 수집 규격

> 기준: `backend/services/catalog-validation.js`, `backend/db/models.js`, `backend/db/catalog-models.js`  
> 출처가 불명확한 사양·가격은 절대 추정하지 말고 `null`(빈칸)로 둔다.

## 1. 모델(Model)과 SKU의 차이

| 구분 | 모델 (`smartphones` / `catalog_models`) | SKU (`smartphone_variants` / `catalog_skus`) |
|---|---|---|
| 의미 | 제품 시리즈 내 **국내 대표 기종 1개** | **실제 판매되는 단일 옵션 조합 1개** |
| 식별 키 | `(brand, domestic_model_number)` 또는 `(category_code, brand, model_number)` | `(model_id, sku_code)` 또는 `(smartphone_id, storage_gb, ram_identity_gb, color)` |
| 포함 정보 | 공통 사양 (`chipset`, `screen_inches`, `specs_json`, `weight_g`, `released_on`) | 옵션 사양 (`storage_gb`, `ram_gb`, `color`, `connectivity`, `options_json`) |
| 예시 | `Galaxy Tab S10+` (`SM-X820`) | `SM-X820NZAAKOO` (256GB / 12GB / 문스톤 그레이 / Wi-Fi) |

---

## 2. 식별·옵션·출시일·판매 상태 기준

1. **제조사(`brand`)**: 정규화된 영문명 사용 권장 (`apple`, `samsung`, `lg`, `lenovo`, `asus`, `sony`, `bose`, `sennheiser`, `jbl` — 공통 카탈로그 엔진에서 대소문자 구분 없이 소문자 비교).
2. **제품명(`model_name`)**: 국내 공식몰 표기명 기준(임의 약칭 금지, 길이 `1~120`).
3. **국내 모델번호(`model_number` / `domestic_model_number`)**: 한국 출시 모델번호만 사용 (예: `SM-S931N`, `A3354`, `NT960XHA-K71A`). 해외판/통신사 전용 모델번호 금지.
4. **옵션 구분 기준**:
   - **저장 용량(`storage_gb`)**: 정수 GB 단위 (`128`, `256`, `512`, `1024`, `2048`). `1TB`는 `1024`로 변환.
   - **색상(`color`)**: 공식 한국어/영문 색상명 그대로 기록. 색상 목록 × 용량 목록으로 가짜 조합 생성 금지(실제 국내 출시 조합만 등록).
   - **연결 방식(`connectivity`)**: 제품군별 허용 값만 사용.
     - `tablet`, `laptop`: `'wifi'` 또는 `'cellular'`
     - `smartwatch`: `'gps'`, `'cellular'`, `'bluetooth'`
     - `earbuds`: `'bluetooth'`, `'wired'`, `'wireless_dongle'`
     - `speaker`: `'wired'`, `'bluetooth'`, `'wifi'`, `'multi'`
5. **출시일(`released_on` / `released_on_kr`) & 판매 상태(`sale_status`)**:
   - 출시일은 `YYYY-MM-DD` (일자를 모르면 `specs_json.release_month`에 `YYYY-MM`만 기록).
   - `sale_status`: `'on_sale'`(판매 중), `'discontinued'`(단종), `'unknown'`(미확인).
   - `publication_status`: 검수 전 `'private'`, 검수 완료 후 `'public'` (`verification_status='verified'`, `verified_at` 필수).

---

## 3. 가격 수집 및 제외 대상 원칙

### 필수 기록 항목
- **가격(`amount_minor` / `amount_krw`)**: 원(KRW) 단위 양의 정수 (`currency = 'KRW'`).
- **판매처(`seller_name`)**: 예) `다나와 최저가(자급제)`, `삼성닷컴`, `쿠팡(로켓배송)` 등.
- **출처 URL(`product_url` / `source_url`)**: `https://`로 시작하는 실제 확인 페이지 (길이 `<= 2048`).
- **관측 시각(`observed_at`) & 확인 시각(`checked_at`)**: ISO 8601 (`checked_at >= observed_at`).

### 가격 미확보 시 저장 원칙
- 가격을 찾지 못했으면 **가격 테이블에 0원이나 추정가 행을 만들지 않는다.** (모델/SKU만 등록 가능. 단, 추천 엔진에서는 가격 없는 SKU를 예산/가성비 평가에서 자동 제외함).

### 수집 제외 대상 (Strict Exclusion)
- **제외**: 중고, 리퍼/리뉴, 전시상품, 통신사 약정/번호이동/기기변경 조건부 할인가, 해외직구(해외판), 케이스·충전기·펜촉·스트랩 등 액세서리/단품 부품.
- **포함**: 국내 정식 발매 **신품·무약정·자급제(언락)** 단품 가격만 수집.

---

## 4. 잘못된 데이터 입력 예시 (금지 사례)

| 잘못된 입력 | 문제점 | 올바른 입력 |
|---|---|---|
| `"storage_gb": "256GB"` | 문자열+단위 포함 (검증 실패) | `"storage_gb": 256` (정수) |
| `"ram_gb": 0` 또는 `"ram_gb": 8` (Apple 미공개) | `<=0` 금지, 미공개 사양 추정 금지 | `"ram_gb": null` |
| 스마트워치/이어폰에 `"storage_gb": 32` 입력 | `validateSkuFields`에서 거부됨 | `"storage_gb": null, "ram_gb": null` |
| `"source_url": "http://..."` | HTTP 프로토콜 거부 (`https://` 필수) | `"source_url": "https://..."` |
| `"connectivity": "LTE"` | 허용 Enum 외 대문자/임의 문자열 | `"connectivity": "cellular"` |
| `"amount_minor": 0` 또는 `"1,290,000"` | 0원 및 쉼표 포함 문자열 불가 | `"amount_minor": 1290000` |
| `"battery_wh": 8000` (mAh를 Wh에 입력) | 단위 혼동 (`Wh` 상한 1000 초과) | `battery_mah: 8000` 또는 `battery_wh: 30.4` |

---

## 5. 중복 등록 방지 및 검수 절차

1. **사전 중복 확인**:
   - 스마트폰: `(brand, domestic_model_number)` 및 `(smartphone_id, storage_gb, ram_gb, color)` 기존 DB 조회.
   - 비스마트폰 5종: `(category_code, brand, model_number)` 및 `(model_id, sku_code)` / `(model_id, manufacturer_part_number)` 조회.
2. **출처 검수**: 공식 제조사 스펙 페이지 → 국내 보도자료 → 다나와/공식 판매처 순으로 대조. `source_name`, `source_url`, `verified_at` 누락 시 `public` 전환 불가.
3. **Dry-run 검증 및 3단계 상태 확인**:
   ```bash
   node backend/scripts/import-common-catalog.js <수집파일.json>
   ```
   - `--apply` 없이 실행하면 DB를 변경하지 않고 전체 입력을 검증한 뒤 SKU별 3단계 상태를 출력한다:
     - `registrable`: 스키마·타입·단위·중복(모델/SKU코드/품번/옵션조합) 통과 여부
     - `publishable`: `publication_status='public'`, `verification_status='verified'`, `verified_at` 및 공개 필수 옵션 충족 여부
     - `recommendable`: `publishable` 충족 + 유효한 `KRW` 신품·무약정·자급제 가격(`prices`) 포함 여부 (`false`이면 `unrecommendable_reasons` 출력)
     - `insufficient_info_fields`: 추천 엔진에서 정보 부족으로 제외될 사양 목록
   - 검증 실패 시 `INVALID_INPUT: <구체적 사유>`가 출력되므로 수정 후 재검증한다.

---

## 6. 제품군별 실제 스키마 입력 예시

### ① 스마트폰 (`smartphones` + `smartphone_variants`)
```json
{
  "model": {
    "brand": "samsung", "model_name": "Galaxy S25", "domestic_model_number": "SM-S931N",
    "released_on_kr": "2025-02-07", "os": "android", "chipset": "Snapdragon 8 Elite for Galaxy",
    "screen_inches": 6.2, "refresh_hz": 120, "battery_mah": 4000, "weight_g": 162,
    "supports_5g": true, "wireless_charging": true,
    "source_name": "삼성전자 공식", "source_url": "https://www.samsung.com/sec/smartphones/galaxy-s25/"
  },
  "sku": { "storage_gb": 256, "ram_gb": 12, "color": "실버 쉐도우" }
}
```

### ② 태블릿 (`tablet`)
```json
{
  "category_code": "tablet", "brand": "Samsung", "model_name": "Galaxy Tab S10+", "model_number": "SM-X820",
  "released_on": "2024-10-03", "weight_g": 571,
  "specs_json": {
    "chipset": "MediaTek Dimensity 9300+", "screen_inches": 12.4, "display": "Dynamic AMOLED 2X",
    "pen_supported": true, "keyboard_supported": true, "battery_mah": 10090, "release_month": "2024-10"
  },
  "sku": { "sku_code": "SM-X820NZAAKOO", "storage_gb": 256, "ram_gb": 12, "color": "문스톤 그레이", "connectivity": "wifi", "options_json": {} }
}
```

### ③ 노트북 (`laptop`)
```json
{
  "category_code": "laptop", "brand": "LG", "model_name": "그램 Pro 16", "model_number": "16Z90SP",
  "released_on": "2024-01-15", "weight_g": 1199,
  "specs_json": {
    "cpu": "Intel Core Ultra 7 155H", "gpu": "Intel Arc Graphics", "screen_inches": 16.0,
    "display": "WQXGA IPS", "refresh_hz": 144, "battery_wh": 77, "os": "Windows 11 Home",
    "ports": ["Thunderbolt 4 x2", "USB-A x2", "HDMI"], "release_month": "2024-01"
  },
  "sku": {
    "sku_code": "16Z90SP-KA76K", "storage_gb": 512, "ram_gb": 16, "color": "에센스 화이트", "connectivity": "wifi",
    "options_json": { "cpu": "Intel Core Ultra 7 155H", "gpu": "Intel Arc Graphics", "storage_type": "NVMe SSD" }
  }
}
```

### ④ 스마트워치 (`smartwatch`)
```json
{
  "category_code": "smartwatch", "brand": "Apple", "model_name": "Apple Watch Series 10", "model_number": "A2999",
  "released_on": "2024-09-20", "weight_g": 36.4,
  "specs_json": {
    "compatible_os": ["watchOS", "iOS"], "gps": true, "water_resistance": "50m 방수 (WR50)",
    "sensors": ["심박수", "혈중산소", "수온"], "screen_inches": 1.96, "display": "LTPO3 OLED", "release_month": "2024-09"
  },
  "sku": {
    "sku_code": "MWWQ3KH/A", "storage_gb": null, "ram_gb": null, "color": "제트 블랙", "connectivity": "gps",
    "options_json": { "case_size_mm": 46, "case_material": "알루미늄", "band": "스포츠 밴드" }
  }
}
```

### ⑤ 무선이어폰 (`earbuds`)
```json
{
  "category_code": "earbuds", "brand": "Samsung", "model_name": "Galaxy Buds3", "model_number": "SM-R530",
  "released_on": "2024-07-24", "weight_g": 4.7,
  "specs_json": {
    "anc": true, "codecs": ["AAC", "SBC", "SSC Hi-Fi", "SSC-UHQ"], "bluetooth_version": "5.4",
    "battery_hours": 6.0, "battery_condition": "ANC 끔 기준 이어버드 단독", "driver": "11mm 다이내믹",
    "water_resistance": "IP57", "wireless_charging": true, "release_month": "2024-07"
  },
  "sku": { "sku_code": "SM-R530NZAAKOO", "storage_gb": null, "ram_gb": null, "color": "실버", "connectivity": "bluetooth", "options_json": {} }
}
```

### ⑥ 스피커 (`speaker`)
```json
{
  "category_code": "speaker", "brand": "JBL", "model_name": "JBL Flip 7", "model_number": "FLIP 7",
  "released_on": null, "weight_g": 560,
  "specs_json": {
    "power_w": 35, "power_supply": "내장 리튬이온 배터리 (USB-C)", "bluetooth_version": "5.4",
    "battery_hours": 14, "battery_condition": "제조사 표준 재생 기준", "water_resistance": "IP68",
    "dimensions_mm": [182.5, 69.5, 71.5]
  },
  "sku": { "sku_code": "JBLFLIP7BLK", "storage_gb": null, "ram_gb": null, "color": "블랙", "connectivity": "bluetooth", "options_json": {} }
}
```
