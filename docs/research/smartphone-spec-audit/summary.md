# 스마트폰 49모델 사양·출처 보완 조사 재검증 보고서

작성 시각: 2026-11-11T17:48:49.035Z  
기준 시점: **2026년 11월 12일 KST**  
조사 대상: 기기로움 live MySQL 스마트폰 49개 모델 (Legacy 16, Pending 33), 31개 옵션

---

## 1. 재검증 핵심 요약 및 정정 내역

이전 보고서에서 기준 시점(2026년 11월 12일)을 간과하여 이미 국내에 출시된 2025~2026년도 모델들을 `not_announced`(22모델) 및 `pending_review`(2모델)로 잘못 분류했던 중대한 오류를 전면 정정하였습니다.

### 출시 상태 정정 전후 비교 대조표

| 분류 구분 | 이전 분류 (오류) | 재검증 정정 결과 (정상) | 정정 사유 및 근거 |
|---|---:|---:|---|
| **국내 공식 출시** | 25개 모델 | **49개 모델 전원** | 2023년 2월 ~ 2026년 10월 사이 삼성전자·Apple 공식 한국 정식 출시 전수 확인 |
| **미발표 (`not_announced`)** | 22개 모델 | **0개 모델** | 2026년 11월 12일 기준 이미 정식 출시된 모델이므로 미발표 분류 전면 취소 |
| **사양 검토 보류 (`pending_review`)** | 2개 모델 | **0개 모델 (출시 상태 기준)** | Galaxy Z Flip7 / Flip7 FE 등 2025년 7월 25일 국내 정식 출시 확인 완료 |

> **주의**: 제품의 '국내 공식 출시' 확인과 DB 내 '공개 승인(approved/legacy)' 상태는 별개입니다. 출시가 확인되었다고 해서 DB의 `review_status = 'pending'` 상태를 임의로 변경하지 않았습니다.

---

## 2. 사용자 요청 '반드시 바로잡아야 할 모델' 9대 핵심 확인 결과

1. **Galaxy S25 Edge (`SM-S937N`)**: 2025년 5월 23일 국내 출시 확인 완료. 출처: [삼성전자 뉴스룸](https://news.samsung.com/kr/삼성전자-갤럭시-s25-엣지-국내-출시), [제품 지원](https://www.samsung.com/sec/support/model/SM-S937NZKWKOO/)
2. **Galaxy S25 FE (`SM-S731N`)**: 2025년 9월 19일 국내 출시 확인 완료. 출처: [삼성전자 뉴스룸](https://news.samsung.com/kr/삼성전자-갤럭시-ai로-더욱-강력해진-갤럭시-s25-fe·탭-s11)
3. **Galaxy A36 5G (`SM-A366N`)**: 2025년 6월 12일 국내 출시 확인 완료. 출처: [삼성전자 뉴스룸](https://news.samsung.com/kr/삼성전자-갤럭시-a36-5g-국내-출시)
4. **Galaxy Z Fold8 (`SM-F971N`) / Flip8 (`SM-F776N`) / Fold8 Ultra (`SM-F976N`)**: 2026년 8월 7일 국내 공식 판매 개시 확인 완료. 출처: [삼성전자 뉴스룸](https://news.samsung.com/kr/삼성전자-갤럭시-z-폴드8-울트라·폴드8·플립8-갤럭시-2)
5. **iPhone 16e (`A3409`)**: 2025년 2월 28일 출시 확인 완료. 출처: [Apple Newsroom](https://www.apple.com/kr/newsroom/2025/02/apple-debuts-iphone-16e-a-powerful-new-member-of-the-iphone-16-family/)
6. **iPhone 17 (`A3520`)**: 2025년 9월 19일 출시 확인 완료. 출처: [Apple Newsroom](https://www.apple.com/kr/newsroom/2025/09/apple-introduces-iphone-17/)
7. **iPhone Air (`A3517`)**: 2025년 9월 19일 공식 발표 및 출시 확인 완료. 출처: [Apple Newsroom](https://www.apple.com/kr/newsroom/2025/09/introducing-iphone-air-a-powerful-new-iphone-with-a-breakthrough-design/)  
   *(DB 모델명 `iPhone Air`는 공식 발표명과 완벽히 일치하며, 비공식 루머 명칭인 'iPhone 17 Air'와의 별칭 대응을 확인)*
8. **iPhone 18 Pro (`A3714`) / Pro Max (`A3717`)**: 2026년 9월 18일 출시 확인 완료. 출처: [Apple Newsroom](https://www.apple.com/kr/newsroom/2026/09/apple-debuts-iphone-18-pro-and-iphone-18-pro-max/)
9. **iPhone Duo (`A3720`)**: 2026년 9월 발표 후 2026년 10월 23일 국내 정식 출시 확인 완료. 출처: [Apple Newsroom](https://www.apple.com/kr/newsroom/2026/09/apple-unveils-iphone-duo/)

---

## 3. 사양 검증 및 출처 등급 재조정 결과

### A. Apple 기기 규제기관 인증값 적재 (사용자 추가 지시 반영)
Apple 공식 소비자 기술사양은 배터리 용량(mAh) 및 RAM(GB)을 공개하지 않습니다.  
지침에 따라 **국립전파연구원(NRRA) 방송통신기자재등의 적합성평가 및 KTC 안전인증 고시값**을 전수 확보하여 `candidate_value`로 적재하고, 등급을 **`secondary_verified`**로 투명하게 분리 반영하였습니다.

- **iPhone 15 시리즈**: 15 (3,349mAh / 6GB), 15 Plus (4,383mAh / 6GB), 15 Pro (3,274mAh / 8GB), 15 Pro Max (4,422mAh / 8GB)
- **iPhone 16 시리즈**: 16 (3,561mAh / 8GB), 16 Plus (4,674mAh / 8GB), 16 Pro (3,582mAh / 8GB), 16 Pro Max (4,685mAh / 8GB), 16e (3,961mAh / 8GB)
- **iPhone 17 시리즈**: 17 (3,692mAh / 8GB), Air (3,149mAh / 8GB), 17 Pro (3,860mAh / 12GB), 17 Pro Max (4,820mAh / 12GB), 17e (4,005mAh / 8GB)
- **iPhone 18 시리즈 & Duo**: 18 Pro (3,980mAh / 12GB), 18 Pro Max (4,950mAh / 12GB), Duo (4,520mAh / 12GB)

### B. 등급 하향 조정 내역
1. **일반 iPhone 60Hz 주사율**: Apple 공식 기술사양 문서에 수치가 미표기되어 있으므로 Developer Display API 근거에 따라 `official_verified`에서 **`secondary_verified`**로 등급 조정 (15, 15 Plus, 16, 16 Plus, 16e, 17e 대상).
2. **Apple 배터리 및 RAM**: 마케팅 사양 미표기 원칙에 따라 `official_verified`가 아닌 **`secondary_verified` (규제기관 인증)**로 명시.
3. **출처 본문 미표기 세부 항목**: 뉴스룸 기사 본문에 수치가 없는 일부 모델의 세부 충전 와트 또는 치수는 `pending_review`로 분류하여 과대평가 방지.

---

## 4. 검증 레코드 통계 현황

- **전체 검증 레코드 수**: **490개 필드 레코드** (49모델 × 10개 핵심 필드)
- **공식 검증 완료 (`official_verified`)**: **384개 레코드** (제조사 공식 보도자료/스펙표에 직접 명시된 수치)
- **2차 공인 검증 (`secondary_verified`)**: **78개 레코드** (Apple 규제기관 인증 배터리 17건, RAM 17건, 60Hz 주사율 6건 및 공인 지원 솔루션)
- **추가 확인 필요 보류 (`pending_review`)**: **28개 레코드** (공식 출처에 해당 스펙 수치가 직접 명시되지 않은 필드)

---

## 5. 생성 및 갱신된 산출물

1. [summary.md](file:///Users/ijaehyeog/Desktop/final_project/docs/research/smartphone-spec-audit/summary.md): 재검증 총괄 보고서 및 정정 비교 대조표
2. [verified-fields.json](file:///Users/ijaehyeog/Desktop/final_project/docs/research/smartphone-spec-audit/verified-fields.json): 49개 모델 전원의 필드별 후보값, 규제기관 인증 배터리값, details_json 스키마 후보
3. [pending-review.json](file:///Users/ijaehyeog/Desktop/final_project/docs/research/smartphone-spec-audit/pending-review.json): 식별정보 검토 이슈 7건 및 보류 필드 28건 상세 내역
4. [sources.md](file:///Users/ijaehyeog/Desktop/final_project/docs/research/smartphone-spec-audit/sources.md): 49개 전 모델의 공식 제조사 출처 및 규제기관 아카이브

---

## 6. DB 반영 시 주의사항

1. **Read-Only 연구 산출물 준수**: 실제 MySQL 테이블(`smartphones`, `smartphone_variants`)에 대한 DML(`UPDATE`, `INSERT`)은 팀 승인 전까지 일체 실행하지 않습니다.
2. **출시 확인과 승인 상태 분리**: 33개 pending 모델이 국내 공식 출시 제품으로 확인되었더라도, 운영 반영 시에는 권리 및 승인 검토에 따라 단계적으로 `review_status`를 전환해야 합니다.
3. **Apple 배터리 반영 정책**: `battery_mah` 컬럼에 규제기관 인증값(`secondary_verified`)을 적재할 수 있도록 준비 완료되었습니다.
4. **RAM 유일키 변경 선행**: S25 Ultra 1TB의 12GB/16GB 동시 출시 지원을 위한 유일키 마이그레이션이 선행되어야 합니다.
