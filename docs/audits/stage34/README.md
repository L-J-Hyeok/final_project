# 3-4 실제 적용 결과 — 2026-11-14 KST

## 수량과 정책

|항목|변경 전|변경 후|
|---|---:|---:|
|모델/옵션|53 / 352|53 / 352|
|공개 모델/옵션|51 / 332|44 / 310|
|공개 모델·용량 조합|104|97|
|가격 관측|3|3|

Buddy3·Buddy5·Jump5·Wide9·Quantum5·Quantum6·Quantum7의 19옵션은 DB/승인 상태를 유지하고 사용자 공개·가격 수집 경로에서 제외했다. S25 Ultra의 불명확 색상 3옵션(90001419, 90001422, 90001424)은 pending/verified=0으로 보류했다. 색상을 임의로 바꾸거나 ID를 지우지 않았다. 기존 비공개 iPhone 17 Pro/Pro Max는 공개하지 않았다.

## 근거의 처리

- 기존 41개 조합과 신규 근거 30개 조합은 중복 없는 분류다. 56개 검토 조합에서 30개를 제외한 26개 결과는 `remaining-26-results.json`에 기록했다.
- 원본 170행에는 이미 반려된 8옵션/5조합도 있어 전체를 단순 합산하면 잘못된 수량이 나온다. 또한 하나의 조합 안에 품번 확보/미확보 옵션이 함께 있다.
- 94개 옵션은 기존 승인된 국내 색상·용량 검증과 원래 DB 출처를 재사용해 옵션 검증 메타데이터를 반영했다. **94개 제조사 품번을 모두 검증 완료 처리하지 않았다.** 원본 품번 주장은 `submitted_sku_evidence`에 미검증으로 보존했다.
- `MTV43KH/A`가 iPhone 15 Pro 128GB 블루 및 256GB 블랙에 중복 주장됐고, Apple 원본 근거의 111829/111831 제품명이 뒤바뀌어 있었다. 정확한 품번 승격을 보류하고 DB의 기존 올바른 옵션 출처를 유지했다.
- 직접 공식 상품으로 확인한 SKU 8개만 `official_sku_verified=true`로 저장했다. A25 라이트 블루는 SM-A256NLBAKOO, 옐로우는 SM-A256NZYAKOO로 구분했다. 원본의 잘못된 품번은 확정값으로 저장하지 않았다.
- 나머지 26개 조합 모두 존재하는 공개 옵션 기준으로 수집 준비 가능하다. 그중 S25 Ultra 256/512GB는 불명확한 3옵션을 제외한 나머지만 가능하다. 1TB 12GB/16GB는 별도 검색어·variant_id 목록을 제공하며 공통 검색어는 NULL로 막는다. 신규 조합을 생성하지 않았다.
- 최종 97개는 **데이터 준비 기준** 수량이다. 외부 수집 권한과 실제 다나와 옵션 매칭은 별도이며, 실가격 수집은 실행하지 않았다.

## 사양 정정과 한계

- iPhone 16e 무게 168→167g: https://support.apple.com/ko-kr/122208
- S25/S25+ 메인 카메라 NULL→50MP: https://www.samsungsvc.co.kr/solution/3187302
- iPhone Air 메인 카메라 NULL→48MP: https://www.apple.com/kr/iphone-air/specs/
- S25 FE 메인 카메라 NULL→50MP: https://www.samsung.com/sec/support/model/SM-S731NZWWKOO/
- Edge ‘티타늄 아이시블루’, FE ‘아이시블루’를 공식 ‘아이스블루’ 표기로 정정했다. 기존 variant_id 유지.
- A17 6GB/128GB는 https://www.samsung.com/sec/support/model/SM-A175NZAAKOO/ 와 일치하므로 RAM을 변경하지 않았다.
- S25 Ultra RAM 차이는 공식 국내 사전판매 자료의 16GB/1TB 제트블랙과 일반 12GB 모델을 구분했다: https://news.samsung.com/kr/삼성전자-갤럭시-s25-시리즈-사전-판매-시작
- Apple RAM은 제조사 공식 미공개인 경우 기존 값을 새 공식 검증값으로 승격하지 않았다. 일부에는 재검증하지 않았다는 메타데이터를 기록했다. 이번 작업을 전체 352옵션 모든 사양의 독립 재검증으로 해석하면 안 된다.
- 비공개 iPhone 17 Pro/Pro Max의 screen_inches NULL과 기존 2026년 자료의 세부 사양 일관성은 남아 있다. 기존 승인 카탈로그 근거를 재사용했으며 모든 2026년 자료를 새로 전수 조사하지 않았다.

## 실행·테스트

- 백업 검증 → 현재 값 일치 검사 → 트랜잭션 UPDATE → ID/변경 필드/옵션 중복/FK/가격 관측 보존 검사 → commit 수행. 스키마·회원·보유기기·추천 이력 쓰기는 하지 않았다.
- 초기 검증 과정에서 JSON 키 순서와 DECIMAL/COUNT 표현 차이로 롤백됐다. 정규화 후 실제 적용 성공. 이는 DB 오류나 데이터 손실이 아니다.
- 단위/Mock 회귀 41/41: price-collection-targets, publication-import, recommendation, hybrid-recommendation.
- 실제 개발 MySQL + 임시 Express 라우터 HTTP 검사 12/12: 통신사 상세 7개 404, 공개 전체 페이지와 SQL 310옵션 일치, 불명확 색상 3개 404, 가격 관측 없는 옵션 상세 200. 요청 DB 접근은 SELECT/SHOW만 허용했다. 임시 서버 종료.
- 실제 브라우저·전체 앱 인증·Gemini 유료 호출·다나와 수집·실제 추천 저장 테스트는 수행하지 않았다. 기존 보유기기/추천 후보 권한 관련 검증은 Mock 회귀다.
- CSV 3개 헤더/중복 필드 검사 통과. CSV 자동 등록 기능 없음.

## 복구 자료

`product-tables-before.json`, `product-tables-after.json`은 제품 3테이블의 전후 사본이다. **전체 DB 백업이 아니며 사용자 개인정보는 포함하지 않는다.** `applied-patch.json`은 실제 변경 필드, `rollback-review-only.json`은 그 역변경이다.

복구 전 새 백업과 현재값 충돌 검사가 필요하다. `backend/scripts/apply-smartphone-stage34.js`는 지정 계획 파일의 변경 전 값이 일치할 때만 실행하며 기본은 Dry-Run이다. 역변경 파일을 Dry-Run으로 확인한 후 별도 복구 필요성이 확인될 때만 `--apply`한다. 이번에는 실제 복원을 실행하지 않았다. 초기 적용 계획은 재실행하면 현재값 불일치로 중단되는 일회성 감사 패치다.

다음 작업은 기존 danawa-cli 연동에서 허용된 접근 경로·정확한 옵션 매칭 및 RAM별 검색을 확인한 뒤 가격 만료/추천 통합 테스트를 수행하는 것이다. SKU 미확인만을 이유로 제품 검증 단계를 다시 세분화하지 않는다.

## 변경 파일과 최종 확인

코드: `backend/services/smartphone-sales-channel.js`, `product-publication.js`, `danawa-price-sync.js`(수집 대상 공개 필터만), `backend/scripts/prepare-price-collection-targets.js`, `apply-smartphone-stage34.js`, `backend/test/price-collection-targets.test.js`, `publication-import.test.js`.

문서: PRODUCT_DATA_COLLECTION_STANDARD, CURRENT_STATUS, DEVELOPMENT_LOG, TEST_PLAN, templates/product_*.csv 및 본 감사 자료. 기존 SKU 근거 JSON 원본은 수정하지 않았다. 프론트·추천 순위·Gemini·인증·스키마는 수정하지 않았다.

최종 역변경 계획 Dry-Run 220행 통과(복원 미실행). 제품 ID 집합 및 가격3건 전체 행이 최초 백업과 동일함을 재확인했다. 개발 서버가 이전 코드를 로드한 상태이면 사용자 서버 재시작 후 새 공개 필터가 적용된다. 본 HTTP 검증은 최신 코드를 로드한 임시 서버에서 수행했다.
