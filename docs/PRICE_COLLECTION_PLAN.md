# 스마트폰 판매 가격 수집 계획

상태: 조사·설계 완료, 수집기/관리자 기능/자동 갱신 **미구현**. 조사 기준일: 2026-11-10 KST. D-028을 유지하며 D-029로 구현 경계를 정리한다.

## 1. 확인 범위와 결론

- AGENTS, 공통 규칙, 개요/아키텍처/현황/최근 로그/관련 결정·테스트 기록, `backend/db/models.js`, `backend/db/migrations/001-initial.sql`, `backend/services/smartphone-catalog.js`를 정적으로 확인했다.
- 16개 모델·29개 변형 적재 및 가격 0건은 사용자와 Antigravity의 최신 기록이다. 정규화 파일의 요약도 일치한다. 이번에는 DB 연결·행 수 재검증을 하지 않았다.
- 공개 저장소 소스·커밋·라이선스, 공식 정책·robots.txt만 조사했다. 가격 수집 스크립트 실행, 상품 검색/가격 API 실호출, 상품 페이지 크롤링, 패키지 설치, DB 변경은 하지 않았다. 외부 코드는 분석 데이터로만 취급했다.
- **추천 순서: 이용 권한이 확인된 판매처 자료의 관리자 검수·수동 등록 → 계약된 가격 API/피드 → 명시적 허가를 받은 사이트별 자동 수집.** 공개 GitHub 코드나 robots 허용만으로 데이터 이용 권한을 확보했다고 판단하지 않는다.

## 2. GitHub 프로젝트 정적 분석

| 항목 | MineEric64/danawa-py | Blue-B/danawa_product_price |
|---|---|---|
| 구조 | danawa.py, test.py, test_price_info.py, CSV, README 2종, LICENSE | main.py, README.md |
| 외부 의존성 | requests, beautifulsoup4; html.parser는 표준 라이브러리 | requests, beautifulsoup4, lxml, python-telegram-bot, schedule; asyncio/time 표준 라이브러리 |
| 설치 명세 | 버전 고정/lock/requirements 미확인 | 버전 고정 없음. README 설치 안내에는 bs4/lxml 누락 |
| 검색 | get_product_codes(keyword): 코드·제목·최저가 추출 | 없음. 상품코드를 코드 안에 직접 등록 |
| 가격 | get_product: 최저가·가격 문자열 목록. get_price_variance: 이력 | 상품 상세 HTML의 첫 제목/가격을 텔레그램 전송 |
| 판매처·구매 URL | 판매처와 판매 링크를 반환하지 않음. 요청하는 다나와 URL은 구매 URL이 아님 | 판매처·구매 URL 출력 없음. 다나와 pcode URL만 구성 |
| 구매 조건 | 배송비·재고·신품·자급제·무조건 가격을 구조화하지 않음 | 동일하게 미지원 |
| 라이선스 | Apache-2.0. 고지·라이선스 사본·수정 표시 및 해당 시 NOTICE 조건 준수하에 코드 재사용 검토 가능 | 루트 README/main.py에 재사용 허가 문구와 LICENSE를 확인하지 못함. 복사·변형 재사용은 저자 허락 전 보류 |
| 최근 이력(UTC) | 마지막 커밋 2022-10-22, 069bf681…; 핵심 소스도 같은 날 f46285f2… | 마지막 커밋 2024-08-30, 0004ff88…; main.py는 2024-08-29, 9b9f6516… |
| 판정 | 정적 참고만 권고, 바로 채택 불가 | 수집 시스템으로 채택하지 않음 |

공통 위험: HTML 선택자 의존, 요청 timeout 미지정, 모델·옵션 정확 매칭/검수/DB 적재/멱등성 없음. 최근 사이트에서 실행 성공했는지는 확인하지 않았다. 오래된 마지막 커밋이 영구 유지관리 중단을 증명하는 것은 아니다.

세부: danawa.py L13~58 검색, L59~110 상세, L111 이후 이력. by_month를 검사하지만 실제 이력 요청은 period=1 고정이다. Blue-B main.py L23~26 동일 페이지 2회 요청·쿠키 재사용, L43 텔레그램 전송, L49~52 매시간 반복. 브라우저 형태 User-Agent를 사용하지만 이 작업에서 실행하거나 차단 회피에 이용하지 않았다. 텔레그램 기능은 본 프로젝트에 불필요하다.

근거: [MineEric 소스](https://github.com/MineEric64/danawa-py/blob/main/danawa.py), [라이선스](https://github.com/MineEric64/danawa-py/blob/main/LICENSE), [커밋](https://api.github.com/repos/MineEric64/danawa-py/commits?per_page=1), [Blue-B 소스](https://github.com/Blue-B/danawa_product_price/blob/main/main.py), [루트 목록](https://api.github.com/repos/Blue-B/danawa_product_price/contents), [커밋](https://api.github.com/repos/Blue-B/danawa_product_price/commits?per_page=1). 코드 라이선스는 다나와 데이터 수집·재배포 허가와 별개다.

## 3. 다나와 정책 확인

- [현재 일반회원 약관](https://www.danawa.com/info/provision.html) 제24조②는 회사 지식재산권 귀속 정보의 사전 승낙 없는 영리 이용·제3자 이용 등을 제한한다. [홈페이지 콘텐츠 고지](https://www.danawa.com/)도 동의 없는 복제·가공 제한을 표시한다. 이번 프로젝트의 정규화·DB 저장·공개·AI 입력까지 허용하는 일반 허가를 확인하지 못했다. 비영리 졸업작품이라는 이유만으로 허용한다고 단정하지 않는다.
- [콘텐츠 이용안내](https://help.danawa.com/bizCenter/index.php?depth1=11)는 뉴스·리뷰 등의 이용 상담과 조건을 안내한다. 해당 CCL 설명을 가격 DB 전체의 수집 허가로 확대하지 않는다. 가격 피드/API의 제공 여부·계약·요금·저장 기간은 별도 문의 대상이며 공개 API가 존재한다고 가정하지 않는다. 문의를 보내지는 않았다.
- [search robots](https://search.danawa.com/robots.txt): User-agent `*`, `/api_ui/`, `/classes/`, `/genfile/`, `/globalData/`, `/snippets/`, `/tpl/`, `/mobile/tpl/` 금지, Crawl-delay 10. `/dsearch.php`가 열거되지 않은 것은 데이터 재사용 허가가 아니다.
- [prod robots](https://prod.danawa.com/robots.txt): `/api/`, `/bridge/`, `/community/`, `/list/ajax/`, `/info/ajax/` 금지. danawa-py의 이력 조회 경로 `/info/ajax/getProductPriceList.ajax.php`는 금지 경로에 포함된다. 실행 대상에서 제외한다. 판매처 링크가 금지된 bridge를 경유하면 자동 추적하지 않는다.
- [www robots](https://www.danawa.com/robots.txt)는 별도 호스트 규칙이다. 이를 search/prod 호스트에 대신 적용하지 않는다.
- robots는 직접 HTTPS 일반 요청으로 확인했다. 웹 도구가 읽지 못한 일부 정책 URL은 현재 홈페이지의 공식 링크로 확인했다. 이전 모바일 약관 URL은 인증서 검증 실패로 중단했으며 TLS 검증을 끄지 않았다.

**착수 조건:** 허용 호스트/경로·빈도, 수집 필드, 저장/보존, 공개 표시, 재가공, Gemini 추천 입력 허용 여부를 확인해 출처별 권한 기록으로 남긴다. robots와 계약 중 더 제한적인 조건을 준수하며 403·429·CAPTCHA·로그인 제한은 우회하지 않는다.

## 4. 대체 방식 비교

| 방식 | 장점 | 제약·실현 가능성 | 난이도 |
|---|---|---|---|
| 제조사 공식 스토어 | 모델 식별·직판 판매자 확인 용이 | 현행 판매 옵션만 가능, 판매 종료 제품 누락. 일반가/보상판매/회원가 분리 필요. 공개 페이지가 자동 수집 허가는 아님 | 수동 중, 자동 높음 |
| 공식 판매처와 계약된 API/CSV 피드 | SKU·배송비·재고·조건을 구조화할 가능성, 안정적 갱신 | 계약·필드 완전성·가격 재사용 및 AI 전달 권한 확인 필요. 확보된 피드 없음 | 중~높음 |
| 네이버 쇼핑 검색 API | 과거 title/link/lprice/mallName/productType 제공 | **신규 대안에서 제외:** 공식 공지상 2026-07-31 종료, API HUB 대체 없음. 남아 있는 과거 레퍼런스를 현행 제공 근거로 사용하지 않음 | 현 시점 부적합 |
| 관리자 승인 수동 등록 | 소규모 MVP에 빠르고 확인 근거를 남기기 쉬움 | 사람의 갱신 부담·입력 오류, 자료 이용 권한은 여전히 필요. 관리자 승인 자체가 외부 권리를 만들지 않음 | 낮음~중간 |

[네이버 공식 종료 공지](https://developers.naver.com/notice/article/32564), [이관 제외·대체 API 없음 안내](https://developers.naver.com/notice/article/32530). 과거 쇼핑 API에도 배송비·실재고·자급제·조건 없는 가격 필드는 없었다([구 레퍼런스](https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md)). Shopping Insight는 가격 피드 대체 수단으로 취급하지 않는다.

[Apple 사이트 약관](https://www.apple.com/kr/legal/internet-services/terms/site.html)의 사이트 사용 조항은 자동 수집과 유사 수동 절차 등을 제한한다. Apple 자동 스크래핑을 기본안으로 삼지 않는다. [삼성 정책 페이지](https://www.samsung.com/sec/info/terms/)에서 무단 복사·배포 제한 고지는 확인했으나 가격 자동 수집 허가는 확보하지 못했다. 제조사/공식 판매처 모두 별도 허가된 제공 방식을 우선 협의한다.

## 5. 기존 스키마와 매핑

SQL/Sequelize 정적 확인 결과다. 이번에 실제 information_schema를 조회한 결과는 아니다.

| 수집 정보 | 기존 컬럼 | 저장·판정 규칙 |
|---|---|---|
| 변형 ID | variant_id | smartphone_variants FK. 국내 모델번호 → smartphones, 저장 용량 및 색상 옵션 → 정확한 변형 1개 |
| 판매 가격 | amount_krw | 양의 KRW 정수, VAT 포함 실제 일시불 상품가. 출고가·할부 월납입금·예상 할인 금지 |
| 배송비 | shipping_krw | 0 이상 정수. 무료 배송 확인 시에만 0. 미확인은 검토 단계 null; 현행 DB nullable지만 추천 부적격 |
| 출처 | source_name | 승인된 출처 식별명 고정. 수집 방식/회차마다 변경 금지 |
| 판매처 | seller_name | 실제 판매자 고정명, 마켓플레이스 이름만으로 대체 금지. 출처+판매자 그룹이 흔들리지 않게 관리 |
| 구매 URL | source_url | 정확한 옵션을 구매하는 HTTPS 페이지. 검색·가격비교 집계 페이지와 구분. 옵션 선택 상태·판매자 식별은 검토 근거에 보존 |
| 확인 시각 | observed_at | 실제 가격/조건 확인 시각 UTC, DATETIME(3). 승인/적재 시각으로 갱신하지 않음 |
| 만료 시각 | expires_at | min(관측+출처 TTL, 명시 행사 종료). TTL은 최대 24시간, 초기 운영 제안 6시간. 승인 시 이미 만료면 재확인 |
| 재고 | in_stock | true/false가 확인된 경우만. 검색에 노출된다는 이유로 true 금지 |
| 신품 | is_new | 새 제품 명시 확인. 미개봉 중고·리퍼·전시·반품·렌탈은 제외 |
| 자급제 | is_unlocked | 국내 자급제 확인. 통신사 약정/요금제/번호이동/해외판은 그대로 적격 처리하지 않음 |
| 무조건 구매 | unconditional | 특정 카드·회원·쿠폰 자격·보상판매·구독·번들 등 조건 없이 해당 가격으로 구매 가능해야 true |
| 조건 요약 | conditions_text | 500자 이내 확인 근거 요약. 비밀값/개인정보 제외. 승인기록의 대체 컬럼으로 남용하지 않음 |

- SQL: amount>0, expires>observed, 플래그 0/1 NOT NULL, variant FK RESTRICT. 배송비만 NULL 허용. 최대 24시간은 SQL CHECK가 아니라 catalog 함수가 검사한다.
- 실제 함수: `0 < expires_at-observed_at <= 24h`, `observed_at <= now < expires_at`, 배송비 확인, 네 플래그 모두 true일 때 적격. 최대 수명 24시간은 허용하지만 만료 시각에는 제외한다. 기존 문서의 '24시간 미만' 표현과 구분한다.
- 최신은 변형별 `(source_name,seller_name)` 그룹의 observed_at DESC/id DESC. 최신 부적격이면 같은 판매처의 과거 적격 저가로 복귀하지 않는다. 다른 판매처 최신 적격 총액의 최소값을 고른다.
- 동일 모델명/제목의 '256GB'만으로 매칭하지 않는다. 국내 모델번호·저장 용량·색상(컬럼이 옵션 식별자인 경우)을 일치시키고, 판매처 SKU와 국내 모델 간 대응 근거가 필요하다. 색상 무관 대표 변형이라면 해당 DB 의미와 모든 선택 색상의 동일가를 먼저 검토한다. 가격 하나를 29개 변형에 일괄 복제하지 않는다.

## 6. 승인 전 자료와 최소 파이프라인 — 구현 제안

```text
권한이 확인된 수동 자료 또는 계약 피드
  → 초안 JSON(unknown 허용, 추천 경로에 노출 안 함)
  → 정확한 옵션 매칭 / 가격·구매 조건 검증
  → 관리자 승인(관측값 전체의 해시에 결합)
  → 기본 dry-run → 명시적 apply → price_observations INSERT
  → 기존 카탈로그 가격 선정 / 추천 검증 유지
```

초기에는 새 DB 테이블 없이 서버 전용 비공개 파일로 초안·승인 증거를 관리하는 로컬 운영 도구를 제안한다. 공개 웹 폴더/Git에 수집 원문·인증정보를 저장하지 않는다. 관리자가 검토하는 구조화 JSON/CSV 입력기를 먼저 만들고 HTML 파서를 뒤에 둔다. 현재는 그 파일/도구도 만들지 않았다.

검토 자료의 최소 키: schema_version, batch_id, source_permission_ref, source_product_id, seller_id, purchase_url, evidence_url, domestic_model_number, storage_gb, color, variant_id, amount_krw, shipping_krw, 4개 true/false/null 플래그, observed_at, expires_at, 각 필드 확인 근거, review_status(pending/approved/rejected), reviewer_ref, approved_at, payload_hash. URL 1개인 DB의 한계를 보완해 구매 URL과 수집 근거 URL을 검토 기록에서는 분리한다. 원문·이미지 저장은 권리와 필요가 확인된 최소 범위만 허용한다.

- unknown은 false로도 true로도 치환하지 않는다. 네 플래그 중 null이면 DB 적재 보류. 확인된 false만 실제 불충족으로 기록할 수 있다.
- price_observations에는 approval_status/approved_by/원문증거/외부상품ID/중복 방지 UNIQUE가 없다. 승인 초안을 먼저 삽입한 뒤 '나중에 승인'하는 구조 금지. **승인된 값만 쓰는 적재 경로**로 보완한다. JSON의 approved 문자열만 믿지 않고 보호된 운영 권한·해시 결합 검토 기록을 검사한다. 공개 관리자 API는 Express 서버 인가·감사 저장소를 별도 구현하기 전 제공하지 않는다.
- 적재기는 기존 모델/검증 함수를 재사용하고 앱 시작이나 추천 요청 중 실행하지 않는다. 기존 테이블을 생성/sync/alter하지 않고 승인된 가격 행만 추가한다.
- 같은 배치 재적재: 변형 행을 트랜잭션 잠금 후 canonical 관측값 전체의 기존 동일행을 조회해 skip. 프로세스 중복 실행 잠금도 적용. 커밋 뒤 처리 로그 기록 실패 시 재조회로 회복한다. 새 시각에 실제 재확인한 같은 가격은 새 관측으로 허용. 스키마 UNIQUE가 없어 이 경로 밖의 임의 쓰기까지 중복을 막는다고 주장하지 않는다.
- 한 변형/출처/판매자에 여러 구매 링크가 있으면 MVP에서는 관리자 지정 대표 오퍼 1개만 갱신한다. 복수 오퍼를 순서대로 삽입해 '가장 늦게 수집한 것'을 최저가로 오인하지 않는다. 전체 오퍼별 추적은 별도 스키마/선정 규칙 검토 대상이다.
- URL은 HTTPS 허용 출처·판매자 도메인만, 사용자 제공 URL 자동 fetch 금지. 추후 어댑터는 내부 IP/localhost/비HTTP·허용되지 않은 리다이렉트를 거절해 SSRF를 방지한다. 본문은 문자열로 검증하며 실행하지 않는다.

### 수집 실패·품절의 기존 구조 한계

가격과 조건이 모두 확인되고 품절이면 in_stock=false인 최신 관측을 기록할 수 있다. 그러나 품절 페이지에 가격이 없어졌다면 amount>0 제약 때문에 완전한 행을 만들 수 없다. 과거 가격을 새 관측으로 복사하거나 0/가짜 금액을 넣지 않는다. 차단·timeout·파싱 실패도 품절로 가장하지 않는다.

이 경우 새 가격 행 없이 실패/불완전 상태를 검토 기록에 남기고 이전 행의 만료를 연장하지 않는다. **현행 추천 코드는 실패 로그를 읽지 않아 기존 가격이 원래 TTL 동안 남을 수 있다.** 단기 TTL로 노출 시간을 줄일 수 있지만 즉시 무효화는 보장하지 못한다. 가격 미표시 품절/권한 철회 시 즉시 추천 제외가 필수라면, 후속 단계에서 별도의 수집상태 차단 또는 명시적 관측 취소 방식을 먼저 설계·승인해야 한다. 이번에는 append-only 정책이나 백엔드를 임의로 바꾸지 않는다.

## 7. 자동 갱신 제안 — 허가·승인 이후만

- 전용 배치 작업, 한 번에 한 실행. 기본 자동 수집 OFF. source별 enabled/permission_expiry/allowed_paths/rate_limit/ttl 설정을 먼저 검증한다.
- 시작 범위: 실제 공급처가 있는 소수 변형 3~5개, 출처 1개. 허용된 API/피드만 4시간 간격 조회 + 6시간 TTL을 초기 제안으로 한다. 계약이 더 엄격하면 그 제한을 우선한다. 전체 29개 커버를 완료 조건으로 강제하지 않는다.
- 새 관측마다 관리자 검수 후 게시하는 반자동 단계부터 시작. 승인 대기 중 만료되면 재확인. 출처/옵션 매핑 승인만으로 미래의 모든 가격을 자동 승인하지 않는다. 완전 자동 승인은 별도 결정이다.
- 정책·권한 변경/403/CAPTCHA 발생 시 해당 출처 정지. 429는 Retry-After 및 허용 쿼터를 준수해 실행을 미루며 우회 재시도하지 않음. 네트워크/5xx는 timeout 10초, 지수 지연 최대 2회 같은 상한을 출처 계약 내에서 제안한다. 실패 시 마지막 성공 시각을 조작하지 않는다.
- 메트릭: 수집/보류/승인/적재/중복skip/오류/만료 건수, 출처별 마지막 성공 및 승인 대기 시간. 인증정보/사용자 데이터는 로그에 기록하지 않는다.
- 변경 후 기존 추천 API가 가격을 재검증한다. 상품 페이지/사용자 요청마다 외부 수집을 실행하지 않는다. 표시 문구는 '확인 시점의 판매가'이며 전체 시장 실시간 최저가를 보장하지 않는다.

## 8. 개발 순서와 완료 조건

1. 자료 이용 권한 확보: 자동 접근/저장/표시/가공/AI 전달 및 갱신 한도 확인. 공급처 미확보 시 수동 운영 도구까지만 구현.
2. 오프라인 검증기·초안 형식: 기존 29개 변형에 정확 매핑, unknown/조건부/출고가/시각/배송비 누락 거절. 네트워크·DB 쓰기 없는 dry-run부터 구현.
3. 보호된 관리자 승인 기록 및 INSERT 적재기: 기존 스키마 유지, 승인된 자료만, 중복 방지·전부 또는 전무 트랜잭션. 실가격 3~5개 등록은 자료·사용자 실행 승인 확보 후 별도 작업.
4. 실제 API 통합 시험: 카탈로그 총액·추천 적격성·가격 변경 409·품절 최신값·만료 검증. 제품/보유 기기/업그레이드 회귀 확인. 운영 사용자/제품 데이터 정리 금지.
5. 계약 피드 어댑터 1개 연결 후 제한된 스케줄 실행. 관리자 승인/수집 오류 보류·자동 중단·만료를 확인한 뒤 범위 확대.

개발 위험: 수동 검증/적재기는 낮음~중간, 계약 피드 중간, HTML 파서는 높음(권리·선택자·옵션·구매 조건). 가장 큰 착수 의존성은 **가격 데이터 이용 권한 및 조건 완전성**, 가장 큰 현행 구조 제약은 **승인·unknown·수집 실패 상태의 DB 표현 부재**다. 관리자 UI·별도 승인 DB·네이버 대체 API·다나와 접근 허가는 이번에 구현/확보하지 않았다.

## 조사 확장 결과와 가격 우선순위 — 2026-11-11 04:18:28 KST

기존 수집기 조사/권한 판단은 유지한다. 2026년 → 2025년 → 현재 신품 판매가 확인되는 2024년 순으로 실제 가격을 검토한다. 판매 종료 여부가 미확인인 상품을 임의로 판매 종료로 확정하지 않는다. 판매가 없는 제품은 출고가만 표시할 수 있지만 이를 현재 예산 검증 가격으로 사용하지 않는다.

이번 검토 결과: 52개 모델 기록 중 일반 판매일 확인 49개, 정확한 일자 보류 3개. 국내 모델번호 확인 44개/보완 필요 8개. **전수 목록의 완전성 검증은 미완료**다. Jump4/Jump5의 공식 출시 근거, 통신사 키즈폰/기업판의 독립 모델 여부를 후속 대조해야 한다. 기존 원본 2025년 보류 10개는 모두 조사 목록과 연결했으나 자동 적재 승인하지 않았다.

### 모델·국내 판매일·공식 출고가 조사 목록

가격은 현재 판매가가 아니다. GB는 저장 용량/RAM을 각각 표시하며 RAM ?는 미확인이다. 1TB=1024GB, 2TB=2048GB로 정규화한다. 목록에 없는 용량 가격은 JSON에서 null이고 색상 전체 조합을 생성하지 않았다. 발표 가격이 있어도 용량 근거가 없는 모델은 변형 가격 연결을 보류했다. S24 FE 256GB의 공식 옵션 근거 연결은 추가 검수 대상이다.

| 모델 | 국내 모델번호 | 한국 일반 판매일 | 기존 자료 관계 | 확인된 용량별 출고가 | 판매일/가격 출처 |
|---|---|---|---|---|---|
| Galaxy A25 5G | SM-A256N | 2024-01-05 | 신규 조사 | 128GB/?GB RAM: 449,900원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-a25-5g-국내-출시) |
| Galaxy S24 | SM-S921N | 2024-01-31 | DB 기존 | 256GB/8GB RAM: 1,155,000원, 512GB/8GB RAM: 1,298,000원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-s24-시리즈-사전-판매-실시) |
| Galaxy S24+ | SM-S926N | 2024-01-31 | DB 기존 | 256GB/12GB RAM: 1,353,000원, 512GB/12GB RAM: 1,496,000원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-s24-시리즈-사전-판매-실시) |
| Galaxy S24 Ultra | SM-S928N | 2024-01-31 | DB 기존 | 256GB/12GB RAM: 1,698,400원, 512GB/12GB RAM: 1,841,400원, 1024GB/12GB RAM: 2,127,400원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-s24-시리즈-사전-판매-실시) |
| Galaxy A15 LTE | SM-A155N | 2024-03-18 | 신규 조사 | 128GB/?GB RAM: 319,000원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-a15-lte-국내-출시) |
| Galaxy Buddy3 | SM-A156L | 2024-04-26 | 신규 조사 | 128GB/6GB RAM: 399,300원 | [공식 기록](https://www.lg.co.kr/media/release/27610) |
| Galaxy A35 5G | SM-A356N | 2024-06-21 | DB 기존 | 128GB/?GB RAM: 499,400원 | [공식 기록](https://news.samsung.com/kr/456735-2) |
| Galaxy Wide7 | 미확인 | 2024-06-26 | 신규 조사 | 변형별 미확인 | [공식 기록](https://news.sktelecom.com/204986) |
| Galaxy Z Flip6 | SM-F741N | 2024-07-24 | DB 기존 | 256GB/12GB RAM: 1,485,000원, 512GB/12GB RAM: 1,643,400원 | [공식 기록](https://news.samsung.com/kr/삼성전자갤럭시-z-폴드6·z-플립6-사전판매-실시) |
| Galaxy Z Fold6 | SM-F956N | 2024-07-24 | DB 기존 | 256GB/12GB RAM: 2,229,700원, 512GB/12GB RAM: 2,388,100원, 1024GB/12GB RAM: 2,704,900원 | [공식 기록](https://news.samsung.com/kr/삼성전자갤럭시-z-폴드6·z-플립6-사전판매-실시) |
| Galaxy Quantum5 | SM-A556S | 2024-08-28 | 신규 조사 | 128GB/?GB RAM: 618,200원 | [공식 기록](https://news.sktelecom.com/206559) |
| iPhone 16 | A3287 | 2024-09-20 | DB 기존 | 128GB/?GB RAM: 1,250,000원 | [공식 기록](https://www.apple.com/kr/newsroom/2024/09/apple-introduces-iphone-16-iphone-16-plus/) |
| iPhone 16 Plus | A3290 | 2024-09-20 | DB 기존 | 128GB/?GB RAM: 1,350,000원 | [공식 기록](https://www.apple.com/kr/newsroom/2024/09/apple-introduces-iphone-16-iphone-16-plus/) |
| iPhone 16 Pro | A3293 | 2024-09-20 | DB 기존 | 128GB/?GB RAM: 1,550,000원 | [공식 기록](https://www.apple.com/kr/newsroom/2024/09/apple-debuts-iphone-16-pro-iphone-16-pro-max/) |
| iPhone 16 Pro Max | A3296 | 2024-09-20 | DB 기존 | 256GB/?GB RAM: 1,900,000원 | [공식 기록](https://www.apple.com/kr/newsroom/2024/09/apple-debuts-iphone-16-pro-iphone-16-pro-max/) |
| Galaxy Z Fold Special Edition | 미확인 | 2024-10-25 | 신규 조사 | 변형별 미확인 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-z-폴드-스페셜-에디션-국내-출시-2) |
| Galaxy S24 FE | SM-S721N | 2024-11-01 | DB 기존 | 256GB/?GB RAM: 946,000원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-s24-fe-국내-출시) |
| Galaxy A16 LTE | SM-A165N | 2024-11-29 | 신규 조사 | 128GB/?GB RAM: 319,000원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-a16-lte-국내-출시) |
| Galaxy S25 | SM-S931N | 2025-02-07 | 원본 보류 재검토 | 256GB/12GB RAM: 1,155,000원, 512GB/12GB RAM: 1,298,000원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-s25-시리즈-사전-판매-시작) |
| Galaxy S25+ | SM-S936N | 2025-02-07 | 원본 보류 재검토 | 256GB/12GB RAM: 1,353,000원, 512GB/12GB RAM: 1,496,000원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-s25-시리즈-사전-판매-시작) |
| Galaxy S25 Ultra | SM-S938N | 2025-02-07 | 원본 보류 재검토 | 256GB/12GB RAM: 1,698,400원, 512GB/12GB RAM: 1,841,400원, 1024GB/12GB RAM: 2,127,400원, 1024GB/16GB RAM: 2,249,500원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-s25-시리즈-사전-판매-시작) |
| iPhone 16e | A3409 | 2025-02-28 | 원본 보류 재검토 | 128GB/?GB RAM: 990,000원 | [공식 기록](https://www.apple.com/kr/newsroom/2025/02/apple-debuts-iphone-16e-a-powerful-new-member-of-the-iphone-16-family/) |
| Galaxy S25 Edge | SM-S937N | 2025-05-23 | 신규 조사 | 256GB/12GB RAM: 1,496,000원, 512GB/12GB RAM: 1,639,000원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-s25-엣지-국내-출시) |
| Galaxy A36 5G | SM-A366N | 2025-06-12 | 신규 조사 | 128GB/6GB RAM: 499,400원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-a36-5g-국내-출시) |
| Galaxy Z Flip7 | SM-F766N | 2025-07-25 | 원본 보류 재검토 | 256GB/12GB RAM: 1,485,000원, 512GB/12GB RAM: 1,643,400원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-z-플립7-공개) |
| Galaxy Z Flip7 FE | SM-F761N | 2025-07-25 | 신규 조사 | 256GB/8GB RAM: 1,199,000원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-z-플립7-공개) |
| Galaxy Z Fold7 | SM-F966N | 2025-07-25 | 원본 보류 재검토 | 256GB/12GB RAM: 2,379,300원, 512GB/12GB RAM: 2,537,700원, 1024GB/16GB RAM: 2,933,700원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-z-폴드7-공개) |
| Galaxy Quantum6 | SM-A566S | 2025-08-01 | 신규 조사 | 128GB/?GB RAM: 618,200원 | [공식 기록](https://news.sktelecom.com/214156) |
| iPhone 17 | A3520 | 2025-09-19 | 원본 보류 재검토 | 256GB/?GB RAM: 1,290,000원 | [공식 기록](https://www.apple.com/kr/newsroom/2025/09/apple-introduces-iphone-17/) |
| iPhone 17 Pro | A3523 | 2025-09-19 | 원본 보류 재검토 | 256GB/?GB RAM: 1,790,000원 | [공식 기록](https://www.apple.com/kr/newsroom/2025/09/apple-unveils-iphone-17-pro-and-iphone-17-pro-max-the-most-powerful-and-advanced-pro-models-ever/) |
| iPhone 17 Pro Max | A3526 | 2025-09-19 | 원본 보류 재검토 | 256GB/?GB RAM: 1,990,000원 | [공식 기록](https://www.apple.com/kr/newsroom/2025/09/apple-unveils-iphone-17-pro-and-iphone-17-pro-max-the-most-powerful-and-advanced-pro-models-ever/) |
| iPhone Air | A3517 | 2025-09-19 | 원본 보류 재검토 | 256GB/?GB RAM: 1,590,000원 | [공식 기록](https://www.apple.com/kr/newsroom/2025/09/introducing-iphone-air-a-powerful-new-iphone-with-a-breakthrough-design/) |
| Galaxy S25 FE | SM-S731N | 2025-09-19 | 신규 조사 | 256GB/?GB RAM: 946,000원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-ai로-더욱-강력해진-갤럭시-s25-fe·탭-s11) |
| Galaxy A17 LTE | SM-A175N | 2025-11-07 | 신규 조사 | 128GB/6GB RAM: 319,000원 | [공식 기록](https://news.samsung.com/kr/삼성전자-ai-탑재한-실속형-스마트폰-갤럭시-a17-lte-국내) |
| Galaxy Z TriFold | 미확인 | 2025-12-12 | 신규 조사 | 512GB/16GB RAM: 3,590,400원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-z-트라이폴드-공개) |
| iPhone 17e | A3634 | 2026-03-11 | 신규 조사 | 256GB/?GB RAM: 990,000원 | [공식 기록](https://www.apple.com/kr/newsroom/2026/03/apple-introduces-iphone-17e/) |
| Galaxy S26 | SM-S942N | 2026-03-11 | 신규 조사 | 256GB/12GB RAM: 1,254,000원, 512GB/12GB RAM: 1,507,000원 | [공식 기록](https://news.samsung.com/kr/삼성전자-3세대-ai폰-갤럭시-s26-시리즈-공개) |
| Galaxy S26+ | SM-S947N | 2026-03-11 | 신규 조사 | 256GB/12GB RAM: 1,452,000원, 512GB/12GB RAM: 1,705,000원 | [공식 기록](https://news.samsung.com/kr/삼성전자-3세대-ai폰-갤럭시-s26-시리즈-공개) |
| Galaxy S26 Ultra | SM-S948N | 2026-03-11 | 신규 조사 | 256GB/12GB RAM: 1,797,400원, 512GB/12GB RAM: 2,050,400원, 1024GB/16GB RAM: 2,545,400원 | [공식 기록](https://news.samsung.com/kr/삼성전자-3세대-ai폰-갤럭시-s26-시리즈-공개) |
| Galaxy A37 5G | SM-A376N | 2026-06-19 | 신규 조사 | 128GB/6GB RAM: 598,400원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-a37-5g-국내-출시) |
| Galaxy Wide9 | 미확인 | 2026-07-03 | 신규 조사 | 변형별 미확인 | [공식 기록](https://news.sktelecom.com/227414) |
| Galaxy Z Flip8 | SM-F776N | 2026-08-07 | 신규 조사 | 256GB/12GB RAM: 1,683,000원, 512GB/12GB RAM: 1,936,000원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-z-폴드8-울트라·폴드8·플립8-갤럭시-2) |
| Galaxy Z Fold8 | SM-F971N | 2026-08-07 | 신규 조사 | 256GB/12GB RAM: 2,278,100원, 512GB/12GB RAM: 2,531,100원, 1024GB/16GB RAM: 3,152,600원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-z-폴드8-울트라·폴드8·플립8-갤럭시-2) |
| Galaxy Z Fold8 Ultra | SM-F976N | 2026-08-07 | 신규 조사 | 256GB/12GB RAM: 2,577,300원, 512GB/12GB RAM: 2,830,300원, 1024GB/16GB RAM: 3,451,800원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-z-폴드8-울트라·폴드8·플립8-갤럭시-2) |
| Galaxy Quantum7 | 미확인 | 2026-08-25 | 신규 조사 | 변형별 미확인 | [공식 기록](https://news.sktelecom.com/229704) |
| Galaxy S26 FE | SM-S741N | 2026-09-04 | 신규 조사 | 256GB/?GB RAM: 1,045,000원 | [공식 기록](https://news.samsung.com/kr/삼성전자-갤럭시-s26-fe-국내-출시) |
| iPhone 18 Pro | A3714 | 2026-09-18 | 신규 조사 | 256GB/?GB RAM: 1,990,000원 | [공식 기록](https://www.apple.com/kr/newsroom/2026/09/apple-debuts-iphone-18-pro-and-iphone-18-pro-max/) |
| iPhone 18 Pro Max | A3717 | 2026-09-18 | 신규 조사 | 256GB/?GB RAM: 2,190,000원 | [공식 기록](https://www.apple.com/kr/newsroom/2026/09/apple-debuts-iphone-18-pro-and-iphone-18-pro-max/) |
| iPhone Duo | A3720 | 2026-10-23 | 신규 조사 | 256GB/?GB RAM: 3,290,000원 | [공식 기록](https://www.apple.com/kr/newsroom/2026/09/apple-unveils-iphone-duo/) |
| Galaxy Buddy4 | 미확인 | 일자 보류 | 신규 조사 | 변형별 미확인 | [공식 기록](https://m.lguplus.com/about/ko/corporation/promotion/press-kit/detail?atclNo=2000001186&pageNo=1&srchCond=titCon) |
| Galaxy Buddy5 | 미확인 | 일자 보류 | 신규 조사 | 변형별 미확인 | [공식 기록](https://news.lguplus.com/?p=21844) |
| Galaxy Wide8 | 미확인 | 일자 보류 | 신규 조사 | 변형별 미확인 | [공식 기록](https://cdnm.shop.tworld.co.kr/pimg/plan_html/202509/P00000324_mobile.html) |

### 현재 판매가 검토 — 실시간 적격 가격 0건

다나와 공개 검색 요약에서 S26 256GB 블랙(1,110,000원·블러모아), S25 256GB 실버쉐도우(1,106,000원·호갱마켓), iPhone 17 256GB 블랙(1,251,300원·11번가) 및 무료배송 표기를 확인했다. 검색 도구는 수개월 전 수집 결과로 표시했으므로 **현재 구매 가능 가격으로 검증하지 않았다**. 원문·이미지를 복제하지 않고 값/링크/보류 이유만 검토용 JSON에 보존한다.

[다나와 S26](https://prod.danawa.com/info/?pcode=106720964), [다나와 S25](https://prod.danawa.com/info/?pcode=102124202), [다나와 iPhone 17](https://prod.danawa.com/info/?pcode=96314051).

판매처 실제 상품 URL·국내 모델번호/색상 SKU·재고·신품·약정/카드/회원 조건·재사용 권한을 확보하지 못해 observed_at/expires_at 및 조건 플래그는 null, production_approved=false다. 검색 확인 시각(reviewed_at)은 실제 판매 관측 시각과 다르다. 2026년 Apple 및 나머지 모델의 판매 가격은 미검증이다. 다나와 bridge/ajax 호출, 자동 크롤러, 구매/폼 제출은 수행하지 않았다.

### 다음 실행 순서

1. 공식 출시일 보류 3개(Buddy4/Wide8/Buddy5), 식별 미완료 8개, Jump4/5·키즈폰 커버리지와 사양 충돌 보완.
2. 용량별 출고가 29개 null 및 색상×RAM×저장공간의 실제 SKU를 검증. Apple 미공개 RAM/mAh는 계속 null.
3. 공식 제품 정보/구매 URL 역할 및 자료 이용 권한 확인. 검색 최저가 대신 판매처 실구매 상품을 확인할 수 있는 허용된 방식 확보.
4. 상세 사양/출고가 저장 설계·관리자 승인 흐름 승인 → 별도 안전한 마이그레이션/적재 구현. 이번 원본 적재기는 16/29 고정 검사를 유지하며 이 검토 JSON을 직접 입력하지 않는다.
5. 승인된 소수 실제 가격 관측부터 등록 후 만료/품절/조건부 할인 제외를 통합 검증. 갱신 주기·TTL은 공급처 허용 범위 내 결정하고 최대 24시간 제약 유지. 실패 시 기존 관측 기한을 연장하지 않음.
6. 전체 스마트폰 MVP 통합 통과 후 Phase 2 검토. 이번에 다른 카테고리 조사/화면/DB를 추가하지 않음.

## 색상별 다나와 참고 가격 정리 — 2026-11-11T10:32:27.206538+09:00

- Codex 편집 종료. 사용자 제공 조사일2026-11-11의 가격8건+URL전용4건을 smartphone-color-price-review-2026-11-11.json 및 smartphone-color-price-review-report.json에 별도 보존. 추가검색/URL접속/DB/.env/기능코드/Git쓰기없음. 기존52모델/99구성 및 원본4파일 내용보존.
- 모델·256GB대응12/12(가격8/8). 기존색상목록대응9/12, S25Ultra3색은기존색상목록미기록. 기존검증된정확구성과대응은S26+블랙256/12 한건이나판매처SKU는전부미확인. RAM은제공자료에없어snapshot null,카탈로그참고RAM은별도. DB변형ID전부null,새변형생성0.
- 직접판매처URL/배송비/총가격/실제관측·갱신·만료시각/신품·재고·자급제·무조건구매 모두미확인. 조사일을관측시각으로대체하지않음. 추천적격0/price_observations추가0. 공식출고가와혼용없음.
- 중복0/동일구성금액충돌0. 기존iPhone17블랙은같은금액1,251,300원이지만이전11번가와신규쿠팡이달라별도스냅샷보존;이전무료배송값상속금지. S25Ultra색상간338,560원(22.15%)차이는검토표시이며오류확정/삭제/색상간가격대체하지않음.
- 오프라인10개검사항목통과(구조·집계·매칭·중복·null·URL역할·양수금액·기존자료차이·원본보존). 페이지사실/재고/최종가격/DB통합은미검증.
- 향후: 쿠팡/G마켓/삼성닷컴/Apple공식몰우선비교,다나와는상품발견/가격비교. 신품·국내정식자급제·무조건구매·배송비포함만승인,중고/리퍼/전시/해외/가개통/약정/번호이동/카드·회원조건제외. 관측은출처·판매처·색상·시각별추가보존하고이상가격은검토분리.
- 모델기본최저가는검증된구성중선택하고그용량/RAM/색상을함께표시;용량선택시그용량내,색상선택시그색상내최저가. 가격없으면현재판매가정보없음,판매종료는근거있을때만판정하고출고가유지. 후속세대출시만으로이전세대제외하지않되기존출시3년/가격24시간/필수조건은유지. 기간확장은별도결정사항.
- 판매상태unknown/verified_available/verified_unavailable/discontinued_confirmed를구분하며12건모두unknown. 가격부재를판매종료로해석하지않음. 동일변형의승인출고가+적격현재가일때만배송비포함차액/할인율. 다나와링크는비교정보링크,직접구매링크는별도이며이번8건을구매가능가격으로공개하지않음. UI/API연동·수집자동화는미구현.

## 44모델 병합·개발용 가격 DTO 준비 — 2026-11-11T10:39:56.988197+09:00

- Codex 편집종료. 구현: backend/scripts/prepare-smartphone-model-merge.js(파일기반44모델병합계획), backend/services/smartphone-price-preview.js 및 .test.js(가격선택·DTO). 보고서 backend/data/smartphone-model-merge-plan.json. 기존원본해시유지,SQL002/003·Upsert도구·운영라우트·추천검증미수정.
- 계획44=기존11보존+신규33,식별보류8제외. 기존16/29 및기간밖5보존. 신규OS등NULL허용하여 verified=false로표현가능하나공개승인은별도. 기존known값차이10모델은검토목록으로만기록하고덮어쓰지않음. null입력은기존값보존. 정확변형은기존계획2모델2변형,중복0. 실제DB ID/FK검사아님.
- 가격모듈: 검증판매가→정확히서버매핑한색상참고가→검증출고가→null. 기본production, development와allowDevelopmentPrices=true를동시에명시해야대체가격허용. 환경/매핑옵션은서버전용이며요청body에서받으면안됨. price_source=verified_sale/reference_sale/official_launch/null. 기존24시간검증함수재사용. development여도DB변형ID·모델/변형verified없으면가격없음.
- DTO: variant_id,price_source,pricing{amount_krw,shipping_krw,total_krw,budget_basis_krw,purchase_verified,development_only,source_url,danawa_product_url,checked_at,warning}. 참고가배송비미확인은shipping/total=null,예산실험값만상품금액사용하며실구매가격차이/배송비누락경고필수. 판매가가아닌출고가를현재가로표시하지않음. NULL사양을수정하거나Gemini후보를JSON에서만들지않음.
- 기존참고JSON의ram_gb=null/영문색상을DB색상에자동매칭하지않는다. server references입력은실제variant_id,용량/RAM/색상이확정된별도매핑필요. 예: S26+블랙256/12의기존구성근거를실제DB ID에대조한후에만매핑. SKU미확인나머지는가격프리뷰에서도자동승격금지. source_url과danawa_product_url역할분리,출고가차액은실제유효판매가와승인출고가있을때만후속API에서계산.
- API계약준비상태: candidatePriceDTO는실행가능순수함수이나Express응답/추천저장/이력/Gemini최종결과에는아직연결하지않았다. 기존최종추천검증은실제observation_id와현재가를재조회하므로개발참고가를기존price에끼워넣지않음. 후속연결시후보와결과/스냅샷모두price_source·development_only·warning을보존하고운영조회에개발이력혼입차단필요. 이번운영추천흐름변경없음.
- 테스트: 새10+기존24=34/34통과. 가격우선순위·운영/기본차단·명시적옵트인·24시간/만료·색상/RAM불일치·DB미검증후보차단·NULL보존·잘못된불리언거절. 병합계획44/33/11/8검사통과. SQL은정적검토만이며MySQL문법실행/동시성/실제API통합시험아님. 안전한분리테스트DB의존재·격리근거가없어어떤DB에도접속하지않음.
- 공개정책: OS NULL 모델은등록준비가능하지만기존verified CHECK상true불가. member/일부catalog는false도조회할수있으므로미승인/보류모델은계속파일에격리. 실제적재전공개필터/승인입력기/ORM·마이그레이션검증필수. 가격대체허용은개발전용새정책이며운영의실판매가원칙을완화하지않음.
- 다음: 33모델/2변형의운영검수와SQL테스트환경승인, 공개필터·실제쓰기실행부준비, DB조회결과에대한색상가격매핑및개발전용추천최종검증/이력연결. .env/웹검색/DB접속·적재/프론트/Git/PC-FIT변경없음.
