# 스마트폰 최소 DB 확장 설계안

상태: 검토 제안·미적용. 웹 검색·제품 수집·DB 접속·마이그레이션·적재 없음. 현재 소스와 조사 JSON, 이전 실제 DB 대조 보고서를 정적으로 분석했다. 이전 DB 확인 시각은 2026-11-11 04:15:15 KST이며 그 이후 DB 변동은 이번에 재확인하지 않았다.

## 1. 입력과 보존 기준

- 조사 원본: `backend/data/smartphone-expansion-2026-11-10.json` — 52모델·99저장 용량/RAM구성·출고가70값. 구성은 색상별 SKU가 아니다.
- 기존 원본: `backend/data/normalized-smartphones.json` — 26모델/39변형 중 검증16/29, 미적재 보류10/10. 조사 파일의 baseline SHA-256과 실제 원본 일치.
- 이전 DB 대조: `backend/data/smartphone-expansion-dry-run-report.json` — 실제16/29/판매가격0, 보존 대상 누락0.
- 조사52 = DB기존11 + DB미적재41(원본보류10 + 완전신규31). 기존2023년 모델5개는 조사기간 밖이므로 삭제/미존재 판정하지 않는다.
- 기존11개 공통 스칼라 사양 대조: 양쪽 값이 있는 화면/주사율/배터리/무게는 일치. 칩셋10개는 조사쪽 표현이 축약되어 있어 자동 변경 금지. 조사 null로 기존값을 지우지 않는다(A35 무게·칩셋, Fold6/Flip6 주사율, iPhone16 화면 등).
- 기존29변형은 한국어 색상이고 신규 JSON은 영어 색상 목록이다. 번역 문자열만으로 자동 매칭/신규 생성하지 않는다. 모델+용량 일치만으로 기존 변형에 출고가를 적용하지 않는다.

## 2. 권장 구조 — 기존 3테이블 재사용, 새 테이블 없음

기존 조회/필터 컬럼을 유지하고, 상세 사양과 근거만 JSON으로 보완한다. 범용 product/EAV/spec_definitions 테이블이나 별도 카테고리 DB는 이번에 만들지 않는다.

| 테이블 | 추가 컬럼 | 형식·역할 |
|---|---|---|
| smartphones | official_product_url | VARCHAR(2048) NULL. 공식 제품 소개/사양 링크; 기존 source_url(현재 핵심 근거) 유지 |
| smartphones | details_json | JSON NULL. schema_version=1의 스마트폰 전용 상세 사양, 폴더블 화면/크기 등 |
| smartphones | review_status | VARCHAR(16) NOT NULL. legacy/pending/approved/held/rejected |
| smartphones | review_metadata_json | JSON NULL. 검수자 식별·시각·출처 URL/확인시각·필드별 근거·권리 근거·보류 사유. 비밀값/원문 복제 제외 |
| smartphone_variants | launch_price_krw | INT UNSIGNED NULL. 정확한 국내 변형의 출시 당시 원화 가격. null 또는 양수 |
| smartphone_variants | launch_price_metadata_json | JSON NULL. schema_version, status(pending/approved/held/rejected), sources, checked_at, reviewed_at, reviewer_ref, 적용 SKU/용량/RAM/색상 범위 |
| smartphone_variants | review_status | VARCHAR(16) NOT NULL. 모델과 동일한 상태 집합, 옵션 검증은 모델 검증과 별개 |
| smartphone_variants | review_metadata_json | JSON NULL. 옵션 식별·색상 대응·공식 SKU(확인된 경우)·권리/승인 근거 |
| smartphone_variants | ram_identity_gb | INT GENERATED ALWAYS AS (COALESCE(ram_gb,0)) STORED. 유일키 전용; API/실제 RAM은 기존 ram_gb 사용 |
| price_observations | 변경 없음 | 승인된 현재 판매 관측만 기록. 출고가/캐시 가격/미확인 조건 저장 금지 |

JSON을 문자열로 이중 직렬화하지 않는다. DB CHECK로 JSON NULL 또는 OBJECT, review_status 허용 값, launch_price_krw NULL 또는 >0, 금액이 있으면 metadata OBJECT를 요구한다. 세부 JSON 스키마(타입·필수 키·단위·배열 크기·URL·날짜·승인 근거)는 향후 Express/적재기에서 검증하며 MySQL JSON 타입만으로 검증된다고 주장하지 않는다. 기본 제한 제안: details 32KiB, metadata 각32KiB, 출처30개/URL2048자, HTTPS만. 해외 모델·지역 SKU의 자동 유추 금지.

### 검증 상태와 기존 verified의 관계

- `review_status`는 전체 검수 단계, `verified`는 **기존 핵심 사양/옵션을 기존 코드에서 사용 가능하게 하는 호환 플래그**다. 상세 JSON/출고가가 자동으로 모두 검증됐다는 뜻이 아니다.
- 기존16/29는 legacy로 분류하고 기존 verified/verified_at을 그대로 보존한다. 과거 검증을 새 관리자 승인으로 위장하지 않는다.
- 새 행은 pending, verified=false가 기본. 다만 미승인 자료는 DB 밖에 유지하므로 운영 테이블의 pending은 일반 조사 저장소로 사용하지 않는다.
- 승인된 모델/변형만 approved와 기존 verified=true를 같은 트랜잭션에서 설정한다. 권리 근거·공식 국내 식별·판매일·OS분류·옵션 근거를 확인한다. approved라도 미확인 상세 필드는 null로 남길 수 있다.
- 상태 CHECK: verified=1이면 review_status IN ('legacy','approved'). legacy 신규 생성은 후속 입력기에서 금지한다. 이 CHECK는 관리자 인가/권리 검토를 대신하지 않는다.
- 세부 사양 provenance는 필드별 status와 sources로 유지하고 승인된 필드만 공개한다. launch_price_metadata_json.status=approved이고 정확한 변형 매칭 시에만 출고가 공개. 기존 verified=true만으로 출고가/상세 JSON을 공개하지 않는다.
- legacy 기본값으로 컬럼 추가하여 기존행을 보존한 뒤 신규행 기본값을 pending으로 전환하는 순서가 필요하다. 실제 DDL은 승인 후 생성하며 새 승인 플래그만 추가해서 기존 앱이 자동으로 통제할 것이라고 가정하지 않는다.

## 3. 상세 사양과 폴더블 표현

기존 smartphones.screen_inches/refresh_hz는 **메인(펼쳤을 때) 화면**을 뜻하도록 유지한다. 다음은 구조 예시이며 제품 데이터가 아니다.

```json
{
  "schema_version": 1,
  "displays": {
    "main": {"inches": null, "panel_type": null, "resolution": {"width_px": null, "height_px": null}, "refresh_hz": null, "brightness": {"nits": null, "mode": null}},
    "cover": null
  },
  "dimensions_mm": {"folded": null, "unfolded": null, "panels": []},
  "cameras": {"rear": [], "front": []},
  "charging": {"wired_max_w": null, "wireless_max_w": null, "reverse_wireless": null},
  "connectivity": {"wifi": null, "bluetooth": null, "nfc": null},
  "protection": {"ip_rating": null},
  "software": {"os_at_launch": null, "os_upgrade_generations": null, "security_update_years": null}
}
```

- 폴더블 cover는 main과 같은 객체 구조. 접힘/펼침은 height_mm/width_mm/depth_mm의 명명된 값, TriFold 패널별 두께는 panels[{position,depth_mm}]에 보존한다. 가장 얇은 값을 전체 두께로 대신하지 않는다.
- 해상도 원본 배열은 방향·가로/세로 의미를 근거로 확인한 뒤 명명된 값으로 변환한다. 확인되지 않으면 배열을 임의 뒤집지 않고 원본 근거와 보류 이유만 metadata에 남긴다.
- 카메라는 role(main/ultrawide/telephoto/macro/cover_front/inner_front), mp, optical_zoom_x, optical_quality_zoom_x를 분리한다. 광학 수준 크롭을 실제 망원 배율로 승격하지 않는다.
- 기본 필드와 상세 JSON의 같은 의미 값은 하나의 매핑 규칙으로 생성하고 충돌 시 반영을 중단한다. details에 기본 칩셋/RAM/저장 용량을 중복 저장하지 않는다. 표시용 main 화면의 상세 표현이 기존값과 다르면 자동 덮어쓰기 금지.
- 미공개 Apple RAM/mAh는 null 유지. reverse_wireless=true로 wireless_charging 출력(W)을 추정하지 않는다. 밝기는 outdoor/HBM/HDR 등 모드를 구분한다.
- JSON의 field provenance는 review_metadata_json.fields에 JSON 경로별 status/source_refs/checked_at으로 보존. 입력 JSON의 source_id는 해당 URL·출처 메타데이터와 함께 복사해 원본 파일 없이는 해석할 수 없는 참조를 만들지 않는다.

## 4. RAM별 변형과 가격 — 필요한 유일키 변경

현재 UNIQUE(smartphone_id, storage_gb, color)는 동일 색상/용량의 다른 RAM을 표현하지 못한다. 권장 키는 **UNIQUE(smartphone_id, storage_gb, ram_identity_gb, color)**다. ram_gb NULL은 Apple 등 실제 미확인 정보로 유지하고, 유일키에서만 0으로 정규화해 MySQL NULL 중복 허용 문제를 방지한다. 실제 ram_gb=0은 기존 CHECK로 계속 금지한다.

S25 Ultra 1TB/RAM12GB 출고가2,127,400원과 1TB/RAM16GB 출고가2,249,500원은 별도 변형이다. 조사에서16GB는 Titanium Jetblack 제한이 있으므로 다른 색상과 곱집합을 만들지 않는다. 12GB와 같은 실제 색상이 존재하는지 추가 확인해야 하며, 현재 JSON만으로 충돌 SKU가 실제 존재한다고 단정하지 않는다.

유일키 변경 순서(미실행): 기존 키 유지 상태에서 새 생성 컬럼·새 유일키 추가 → 기존 행 충돌0/29개 보존 검사 → 입력기/Sequelize의 매칭을 새 키로 변경 → 기존 옵션 유일키 제거. PK(id)와 FK는 변경하지 않는다. 생성 컬럼은 읽기 전용으로 다루며 Sequelize 쓰기 목록에 포함하지 않는다.

RAM 미확인 행이 나중에 확인되면 자동으로 새 행을 만들지 않는다. 동일 실제 SKU임이 입증된 경우 원래 ID의 ram_gb를 보완하고 중복 후보가 있으면 수동 검수한다. 이미 참조 중인 행을 합치거나 삭제하지 않는다. color='unspecified'는 특정 색상 SKU가 아니므로 색상별 판매가 연결 불가. 영어/한국어 별칭은 명시적 검토 매핑을 작성하고 기존 한국어 값을 유지한다.

## 5. 기존 제약과 기능 호환성

| 실제 코드/제약 | 분석 결과 및 후속 필요 사항 |
|---|---|
| smartphones: UNIQUE(brand, domestic_model_number), nullable 모델번호 | NULL 중복이 가능하므로 모델번호 미확인 조사행은 넣지 않음. 기존 ID·국내 출시일 보존 |
| smartphones CHECK verified | source_name/source_url/verified_at/모델번호/국내판매일/os가 있어야 true. 조사 os_at_launch와 기존 os(android/ios/other)는 서로 다른 필드; 브랜드만 보고 OS 버전 생성 금지 |
| variants FK RESTRICT, 양수 용량/RAM, verified 근거 CHECK | 그대로 유지. 기존 유일키만 RAM을 포함하도록 변경 제안 |
| prices FK RESTRICT, 양수 금액, expires>observed, NOT NULL 네 플래그 | 그대로 유지. TTL≤24시간·미래관측 제외·배송비 필수는 DB CHECK가 아니라 smartphone-catalog.js 평가 규칙임 |
| routes/smartphones.js 명시적 SELECT/응답 포맷 | 추가 컬럼으로 기존 응답은 바뀌지 않음. 신규 상세/출고가/링크 표시는 승인 후 명시적으로 응답 필드 추가 필요 |
| services/smartphone-catalog.js matchesHardConditions | verified·국내판매일·기존 사양·실판매가 적격성 유지. 출고가 fallback 금지. 현재 판매가0이면 추천 후보 완성을 주장할 수 없음 |
| routes/member.js owned-device-options 및 등록 | 검색에서 verified 필터 없음; 등록도 변형 존재만 확인. **verified=false만으로 사용자 노출을 차단할 수 없음**. 승인 전 자료는 DB 밖 유지. 추후 staging 필요 시 먼저 검색/등록에 인가·공개 조건 추가 필요 |
| services/upgrade-advisor.js | 기존 국내 판매일/verified/variant ID 기반. 이번 변경은 ID·날짜를 보존하므로 기존 흐름 유지 가능. 화면 상세/출고가는 현 판정에 영향 없음 |
| seed-verified-smartphones.js | 16/29 고정 검사 유지. 검토 JSON을 그대로 입력할 수 없음. 별도 승인된 변환/적재 계획 필요 |

정적 호환성 판단이지 실제 마이그레이션·통합 통과 결과가 아니다. 추천 snapshot/이력, owned_devices.variant_id, price_observations.variant_id는 원래 ID를 계속 참조한다. 상세 JSON이나 검수 metadata 전체를 AI 입력/공개 API로 자동 전달하지 않는다.

## 6. 신규 적재 분류

분류 기준은 **운영 DB에 실제 제품/변형을 공개할 준비**이며 SQL에 행을 삽입할 수 있다는 뜻이 아니다. 모든 신규 JSON이 production_approved=false이고 정확한 색상 SKU/권리 승인 미완료이므로 **즉시 적재 가능0개**, 추가 검증32개, 보류9개(총 DB미적재41개)다. 기존11개는 업데이트 승인 대상이고 신규 집계에서 제외한다. 권리 승인 문제는 모든 신규에 공통이며, 분류는 추가로 필요한 데이터 확인의 정도를 나타낸다.

- 적재 가능: 권리·한국 모델 식별·판매일·기본 사양·정확한 변형·검수 승인 모두 통과. 현재0.
- 추가 검증: 국내 모델번호와 판매일이 기록되어 있으나 옵션·근거·권리·사양 승인 부족.32개.
- 보류: 필수 식별/판매일/변형 정보 부재 또는 모델 식별 충돌.8개 미식별 + S26+1개.
- S25 Ultra는 모델이 아니라 RAM/색상 구성별 판단이 필요. Apple9개 신규는 기타 국가 모델과 한국 SKU 대응 검토가 필요. iPhone18Pro 상세 접근제한, Duo 규격 충돌은 해당 필드 보류. S24FE는 기존 제품을 유지하고 신규 출고가 연결만 보류한다.

| 신규 모델 | 분류 | 추가 확인 사항 |
|---|---|---|
| Galaxy A25 5G (`a25`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy A15 LTE (`a15`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy A16 LTE (`a16`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy Z Fold Special Edition (`fold-special-edition`) | 보류 | domestic_model_number; storage_configuration |
| Galaxy S25 (`s25`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy S25+ (`s25-plus`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy S25 Ultra (`s25-ultra`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인; RAM12/16GB 및 전용 색상 |
| Galaxy S25 Edge (`s25-edge`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy S25 FE (`s25-fe`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy Z Fold7 (`fold7`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인; 보류 원본 외 공식 식별 근거 |
| Galaxy Z Flip7 (`flip7`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy Z Flip7 FE (`flip7-fe`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy A36 5G (`a36`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy A17 LTE (`a17`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy Z TriFold (`trifold`) | 보류 | domestic_model_number |
| Galaxy S26 (`s26`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy S26+ (`s26-plus`) | 보류 | 국내 모델번호 출처 충돌 |
| Galaxy S26 Ultra (`s26-ultra`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy S26 FE (`s26-fe`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy A37 5G (`a37`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy Z Fold8 Ultra (`fold8-ultra`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy Z Fold8 (`fold8`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy Z Flip8 (`flip8`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy Buddy3 (`buddy3`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy Wide7 (`wide7`) | 보류 | domestic_model_number; storage_configuration |
| Galaxy Quantum5 (`quantum5`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy Buddy4 (`buddy4`) | 보류 | domestic_model_number; released_on_kr; storage_configuration |
| Galaxy Wide8 (`wide8`) | 보류 | domestic_model_number; released_on_kr; storage_configuration |
| Galaxy Quantum6 (`quantum6`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인 |
| Galaxy Buddy5 (`buddy5`) | 보류 | domestic_model_number; released_on_kr; storage_configuration |
| Galaxy Wide9 (`wide9`) | 보류 | domestic_model_number; storage_configuration |
| Galaxy Quantum7 (`quantum7`) | 보류 | domestic_model_number; storage_configuration |
| iPhone 16e (`iphone-16e`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인; 한국 지역 모델/SKU 대응 |
| iPhone 17 (`iphone-17`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인; 한국 지역 모델/SKU 대응 |
| iPhone Air (`iphone-air`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인; 한국 지역 모델/SKU 대응 |
| iPhone 17 Pro (`iphone-17-pro`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인; 한국 지역 모델/SKU 대응 |
| iPhone 17 Pro Max (`iphone-17-pro-max`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인; 한국 지역 모델/SKU 대응 |
| iPhone 17e (`iphone-17e`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인; 한국 지역 모델/SKU 대응 |
| iPhone 18 Pro (`iphone-18-pro`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인; 한국 지역 모델/SKU 대응; 접근제한 상세 필드는 미확인 유지 |
| iPhone 18 Pro Max (`iphone-18-pro-max`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인; 한국 지역 모델/SKU 대응 |
| iPhone Duo (`iphone-duo`) | 추가 검증 | 정확한 색상/SKU·이용 권리·검수 승인; 한국 지역 모델/SKU 대응; 커버 화면 규격 충돌 |

## 7. 기존 데이터 보존 및 승인 후 적용 순서

1. 검토: 이 설계와 공개/승인 정책, RAM 유일키를 승인한다. SQL은 아직 작성하지 않았고 마이그레이션 실행 경로에 새 파일을 만들지 않았다.
2. 적용 직전 읽기 전용 재대조: SHOW CREATE TABLE/인덱스/제약과16/29의 실제 ID·핵심 값·참조 개수를 재확인한다. 이전 보고서는 컬럼/식별 대조이며 현재 DB의 전체 제약이 DDL과 일치함을 증명하지 않는다.
3. 백업/복원 절차와 점검 시간을 마련하고, 별도 테스트 DB에서 additive 컬럼·CHECK·RAM유일키 변경을 검증한다. MySQL DDL을 일반 트랜잭션 rollback으로 되돌릴 수 있다고 가정하지 않는다. 오류 시 기존 운영 DB에서 DROP TABLE/강제 sync로 복구하지 않는다.
4. 컬럼 추가 시 기존 metadata/details/출고가는 NULL, review_status=legacy로 유지. 신규행 기본값만pending으로 전환. 기존 핵심값/색상/verified/가격/PK/FK를 일괄 재작성하지 않는다. 새 상태·필드별 승인 정책과 Sequelize/적재기/응답 명시적 매핑을 구현한다.
5. 기존 자연키(브랜드·국내모델번호)로 모델 식별 후 ID를 재사용한다. 2023년을 포함한 기존16/29를 고정 보존 목록으로 둔다. 신규 조사 null·축약문자열로 기존 검증값을 덮어쓰지 않는다. 차이는 필드별 수정 승인 목록으로만 반영한다.
6. 승인된 **실제 색상 SKU**를 기존29변형과 대조한다. 모델×용량×RAM×색상 전체 조합 생성 금지. Apple RAM null과 S25 Ultra RAM12/16을 혼동하지 않는다. 새 JSON 키와 기존 smartphone_key가 달라도 국내 모델번호로 연결한다.
7. 소규모 명시적 허용 목록으로 dry-run을 만들고 삽입/수정/스킵·ID 재사용·보류 사유를 검토한 뒤 별도 적재 승인을 받는다. 멱등키/재실행/중간 실패 복구를 검증한다. 기존16/29 전용 seed를 단순 숫자 변경하여 재사용하지 않는다.
8. 새 DML은 트랜잭션으로 처리하고 검증 실패 시 해당 배치를 rollback. 출고가 미확인 변형은 NULL로 유지 가능하나 현재 판매가격으로 대체하지 않는다. 미승인 가격3건은 계속 DB 밖이다.
9. 실제 API 회귀 통과: 기존 카탈로그/보유 기기/업그레이드와 예산 검사, 승인 필드 공개, 미래/만료가격 차단, 신규 RAM별 옵션 구분. 스마트폰 MVP 전체 통합 후에만 Phase2로 확장한다.

## 8. 향후 기기군 확장 경계

이번에는 smartphone 전용 details_json 계약만 만든다. 공통 표현 규칙(단위·값/null·출처·검증 상태·화면 role)은 향후 태블릿/노트북/워치에서도 재사용 가능하다. 카테고리별 JSON 스키마와 비교 필드 정의는 분리하고, 스마트폰 테이블에 노트북 행을 넣지 않는다. 실제 확장 시 공통 제품/옵션과 카테고리별 상세 테이블을 검토하되 기존 스마트폰 ID/FK를 보존하는 매핑을 설계한다. 조원 spec_definitions/specifications는 나중에 참고하며 Supabase/EAV 시스템을 지금 도입하지 않는다. PC-FIT은 변경하지 않는다.

## 9. 이번 검증과 미검증

- 수행: 조사 JSON 및 기존 원본 해시 대조, 기존11개 모델의 공통 사양과29변형 옵션 정적 비교, 이전 DB대조 결과 참조, 모델/마이그레이션/카탈로그/member/업그레이드 코드의 정적 분석, 분류 합계 검사(0+32+9=41, 기존11과 합계52).
- 미실행: 인터넷·DB 접속/쓰기·SQL 실행·앱/API 테스트·데이터 수집. 이전 DB16/29는 새로 측정한 값이 아니다.
- 승인 후 필수 테스트: 기존 ID/FK/핵심값 보존, 같은 용량·색상 다른RAM 허용/같은RAM 중복 거부/NULL RAM 중복 거부, legacy 보존/pending 비공개, JSON 필드별 상태·단위/배열방향 검증, null 덮어쓰기 차단, 출시가와 현재가 분리, 정확한 색상·지역SKU, 일반 추천/보유기기/업그레이드 회귀.

작성 시각: 2026-11-11 04:35:45 KST

## 10. 사용자 기본 방향 승인 및 NULL RAM 검증 — 2026-11-11 04:43:02 KST

최소 확장 **방향은 사용자 승인**. 실제 마이그레이션·DB 적재는 명시적으로 미승인이다. 위 §6의 0/32/9는 이전 검토 이력이며 최신 분류는 [최신 대표 모델 검증](SMARTPHONE_PRIORITY_VERIFICATION.md)의0/33/8을 따른다.

### NULL 중복 문제의 정확한 범위

- 현재 UNIQUE(smartphone_id,storage_gb,color)에는 RAM이 없고 세 컬럼이 NOT NULL이다. **현재 키에서 RAM NULL 때문에 중복이 허용되는 것은 아니다.** 향후 RAM을 nullable 그대로 UNIQUE에 넣으면 같은 모델/용량/색상/NULL RAM이 여러 번 삽입될 수 있다.
- 권장: `ram_identity_gb INT GENERATED ALWAYS AS (COALESCE(ram_gb,0)) STORED` + UNIQUE(smartphone_id,storage_gb,ram_identity_gb,color). 실제 RAM null 유지, 기존 양수 CHECK 유지. 키용0은 RAM사양·API·AI에 노출하지 않는다. FK는 계속 원래id를 참조한다.
- 기존 검증29변형 중 RAM null15개. 파일 기준 생성키 충돌0. 이는 기존 원본의 정확 문자열 기준 점검이고 MySQL collation/DDL 실험은 아니다.
- MySQL 문서상 UNIQUE는 여러NULL을 허용하고 생성컬럼 인덱스를 지원한다. STORED 추가는 테이블 재구성이 필요할 수 있어 무잠금/즉시 적용을 보장하지 않는다. 이번에는 SQL을 실행하지 않았다.

| 같은 모델·용량·색상에서 비교 | 새 키 기대 결과 |
|---|---|
| NULL / NULL | 둘 다0, 중복 거부 |
| 12 / 12 | 중복 거부 |
| 12 / 16 | 별도 옵션 허용 |
| NULL / 12 | 키만으로는 둘 다 허용 — 아래 별도 제어 필요 |

### unknown→known 및 동시 입력 보완

NULL이 실제 미확인 RAM이라면 알려진RAM과 같은 실물 SKU일 가능성이 있다. 생성키만으로 이를 판단하지 않는다. 후속 입력기는 모델 부모행을 잠근 동일 트랜잭션에서 모델/용량/정규화색상의 모든 RAM 변형을 조회한다. 같은 실물SKU 근거가 있으면 **기존id의 RAM만 보완**하고, 알려진 옵션과의 중복 후보 또는 판단 불가 시 배치 전체를 보류한다. 자동 병합·ID교체·삭제 금지. 모든 승인 입력 경로가 이 잠금 규칙을 따라야 하며, 사전SELECT만으로 동시 삽입을 막았다고 주장하지 않는다. 최종 같은 키의 동시 중복은 DB UNIQUE로도 차단한다.

영문/국문 색상은 명시적 별칭 대응 후 기존 한국어 색상 유지. 대소문자/악센트 비교는 기존 utf8mb4_0900_ai_ci를 유지하고 실제 DB에서 별도 확인한다. 색상 공백·unspecified·지역SKU를 자동 동등 처리하지 않는다. 생성컬럼을 Sequelize INSERT/UPDATE payload에 포함하지 않는다.

### 보존 및 적용 게이트

16모델/29변형의 기존 PK, FK, verified/verified_at, 색상, 출시일과 기존API 계약을 유지한다. 출고가와 price_observations는 분리하며 가격관측 테이블은 변경하지 않는다. 기존 옵션 유일키는 새 키와 승인 입력기가 준비된 후에만 교체할 수 있다. 기존 모델/옵션 생성 경로와 새 검수 상태를 연결하지 않은 상태에서 검토 자료를 운영DB에 넣지 않는다. 현재 member.js는 미검증 옵션도 노출할 수 있다는 제약을 유지한다.

근거: [MySQL8.0 UNIQUE](https://dev.mysql.com/doc/refman/8.0/en/create-index.html), [생성컬럼](https://dev.mysql.com/doc/refman/8.0/en/create-table-generated-columns.html), [온라인DDL 제약](https://dev.mysql.com/doc/refman/8.0/en/innodb-online-ddl-operations.html).

## 11. 검증 단위 분리 — 2026-11-11 04:50:14 KST

D-033 및 [재분류](SMARTPHONE_VALIDATION_RECLASSIFICATION.md)가 §6/§10의 단일 0/33/8 운영준비 분류를 보완·대체한다. A 모델/B 개별 구성/C1 출고가/C2 판매가/운영 승인을 분리한다. 형제 변형 전체·공식 SKU 코드 전체·출고가·현재가 확보를 A/B 완료 조건으로 요구하지 않는다. 실제 국내 구성/색상 근거는 필수이고 목록 곱집합은 금지한다. 미공개 RAM null·출고가 null 허용, 색상 미확인 unspecified는 신규 B 완료로 세지 않는다. 기존 컬럼/CHECK/생성키 설계 및 가격관측 테이블 유지.

기존 자료 기준 우선18 A 완료9, 전체 신규 A 완료10. 독립적인 B 완료는 S25 Ultra1TB/16GB 티타늄 제트블랙과 S26+256GB/12GB 블랙의2개다. 현행/확장 모두2모델2변형을 사양 등록 후보로 표현 가능하며 확장은 사양 근거/출고가 보존을 추가한다. 운영 승인과 실제 적용은 별도이며 이번 실행 없음. 기존16/29 보존, 미승인행은DB밖 유지한다.

## 12. SQL 초안 및 NULL·링크 계약 준비 — 2026-11-11 09:27:27 KST

[적재 준비 계약](SMARTPHONE_IMPORT_PREPARATION.md)에 NULL 표시/보조출처/링크 역할/API 응답과 가격차이 계산, 적용게이트를 기록했다. 기존4+5컬럼 확장방향 유지, 추가 링크 전용컬럼/테이블 없음. 공식사양/제조사구매는 review_metadata_json.links로 구분하고 판매처 구매는 기존 price_observations.source_url을 유지한다.

002-smartphone-details.draft.sql(컬럼·CHECK·RAM 생성키/새UNIQUE·기존legacy와신규pending)과003-smartphone-ram-key.draft.sql(후속게이트 뒤기존INDEX제거)을 migration-drafts에 작성했다. 기존 migrate.js에 등록하지 않았고 DB 적용0. 기존입력기의verified=true/새pending CHECK 호환, ORM/공개정책/부모행잠금은 승인 후 구현·테스트 필요. 기존PK/FK/16·29 및가격관측 보존.
