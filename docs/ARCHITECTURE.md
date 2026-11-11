# 현재 및 목표 아키텍처

## 현재 상태 — 정적 파일 확인

2026-11-06 Asia/Seoul에 확인했다. 아래 버전은 package.json 선언값이며 실제 런타임 검증 결과가 아니다.

| 계층 | 구성 | 현재 기능 |
|---|---|---|
| front | Vue ^3.2.13, Router ^4.0.3, Vuex ^4.0.0, Vuetify ^3.0.0-beta.0, Vue CLI ~5.0.0 | Home/About·HelloWorld, 빈 store |
| backend | Node.js 기반 Express ~4.16.1, Jade ~1.11.0, cookie-parser·morgan | 기본 / 렌더링, /users 예시 문자열, 404·오류 처리 |
| 실행 설정 | front의 serve·build, backend의 start, 기본 포트 3000 | 이번 실행 안 함 |
| DB·AI | 연결 코드·제품 API·인증 없음 | 모두 구현 예정 |

실제 구조:

```text
final_project/
├── front/                  # frontend/로 이름을 바꾸지 않음
│   ├── .git/
│   ├── src/{views,components,router,store,plugins,assets}/
│   ├── public/
│   ├── package.json
│   └── vue.config.js
├── backend/
│   ├── app.js
│   ├── bin/www
│   ├── routes/{index,users}.js
│   ├── views/
│   ├── public/
│   └── package.json
├── .agents/skills/
├── skills-lock.json
├── AGENTS.md
├── GEMINI.md
└── docs/
```

양쪽 node_modules와 package-lock.json이 존재한다. 루트·backend에는 .git이 없고 front에만 있다. 루트 문서와 backend는 front 저장소에 자동 포함되지 않는다.

front/src/plugins/webfontloader.js에 Google Fonts 로딩 코드가 있어 네트워크 없는 실행을 보장하지 않는다. front/.gitignore는 .env.local 및 .env.*.local만 명시한다. 루트·backend의 비밀정보 제외 정책은 개발 전 보강이 필요하다. 이번에는 변경하지 않았다.

## 스마트폰 MVP 상세 설계 — 2026-11-09 확정, 미구현

이하 계약은 이전 논리 모델 초안을 대체한다(D-013~D-017). D-018은 보유 기기 유형·수동 사양과 확장 경계만 보완하며 스마트폰 추천 계약은 유지한다. Vue 3·Express·MySQL 8.0을 유지한다. Node.js는 직전 점검에서 v26.3.0, 설치 Vue 3.5.45·Express 4.16.4를 확인했으나 이번에는 재실행하지 않았다. 직전 Vue 4개 파일 메모리 컴파일·Jade 렌더링은 통과했고 HTTP는 환경의 EPERM으로 미검증이다.

### 1. 인증과 서버 경계

- 이메일·비밀번호 가입, 서버 세션 로그인. JWT·소셜 로그인·메일 인증·비밀번호 재설정은 이번 구현 범위에서 제외하며 공개 서비스 전 별도 보강한다.
- 이메일은 trim·소문자 정규화 후 형식·254자 이하 검사, 비밀번호는 정규화/trim 없이 12~128자·UTF-8 512바이트 이하. 이메일 UNIQUE. 가입 시 users와 빈 profiles를 한 트랜잭션으로 생성하고 로그인은 별도 수행.
- 비밀번호: Node 내장 비동기 scrypt, N=131072, r=8, p=1, maxmem=256MiB, 무작위 salt 16바이트·키 64바이트. 알고리즘·파라미터·salt·해시를 password_hash에 저장, 상수시간 비교. 요청 처리 동시 해시 2개로 제한하며 대상 장비에서 시간·메모리 시험 후 파라미터 변경은 결정 기록에 남긴다.
- express-session + MySQL 영속 store 사용 예정. 기본 MemoryStore는 사용하지 않음. Sequelize v6 계열과 mysql2 드라이버 사용(D-019, 사용자 요청으로 기존 ORM 없음 결정을 대체). 직접 SQL은 파라미터 바인딩을 유지. 패키지 설치는 다음 구현 작업에서 수행한다.
- 쿠키 sid: HttpOnly, SameSite=Lax, Path=/, Domain 미설정, 운영 HTTPS에서 Secure=true. 로컬 HTTP에서만 Secure=false. 로그인 시 세션 ID·CSRF 토큰 재발급, 로그아웃 시 서버 삭제·동일 속성 쿠키 만료.
- 세션 idle 30분, 로그인 후 절대 24시간. 응답/DB 만료는 두 기한 중 이른 시각. 서버에서 매 요청 만료 검사, 만료행 정리는 요청 인증을 대체하지 않음.
- 세션에는 user_id·CSRF 토큰·로그인/활동 시각만 저장. 비밀번호·프로필·기기 목록 저장 금지. 서버 비밀키는 환경 주입, 로그와 응답에서 제외.
- Vue는 /api 상대 경로 사용. 개발은 Vue CLI 프록시로 Express 연결, 운영은 동일 origin 역방향 프록시. credentialed CORS를 기본 허용하지 않음.
- GET /api/auth/csrf에서 익명 세션·토큰 발급. 모든 POST/PUT/DELETE에 X-CSRF-Token 및 허용 origin 검증(로그인·가입 포함). 토큰은 Vue 메모리 보관. 로그인 뒤 새 토큰으로 교체.
- 사용자 ID는 세션에서 결정. 소유 데이터 쿼리는 WHERE id=? AND user_id=?; 남의 자원과 없는 자원은 동일 404. 비로그인 401.
- 단일 Express 인스턴스 MVP: 로그인 실패 계정+IP당 15분 5회, IP당 15분 30회; 가입 IP당 시간 5회; AI 호출 사용자당 분 5회 및 동시 1개. 초과 429. 분산 배포 시 공유 제한 저장소 도입은 별도 결정.
- JSON 본문 16KiB, 자연어 2,000자 이하. 알 수 없는 입력 필드·enum·숫자 범위는 422. 세션/사용자 응답 Cache-Control: no-store.

### 2. 프로필·필수 조건·선호 조건

profiles의 common_json과 smartphone_json만 사용한다. 별도 성향·태그·버전 테이블은 만들지 않고 version 정수와 추천 스냅샷으로 추적한다. common_json의 용도·소비 성향·이동성은 다른 IT 기기에도 재사용한다. 현재 ecosystem의 android/apple 값은 모바일 생태계 문맥이며 PC 운영체제·CPU 제조사로 해석하지 않는다. smartphone_json의 브랜드·OS 제한과 프로필 완료 조건은 스마트폰 온보딩에만 적용한다. PC 선호를 이 필드에 억지로 넣지 않으며, 후속 제품군 선호 필드는 해당 기능 구현 시 버전 있는 마이그레이션으로 추가한다.

| 분류 | 필드 / 허용값 | 필수 여부 |
|---|---|---|
| 공통 성향 | usages: communication, video, coding, gaming, camera, work 중 중복 없는 1~6개 | 온보딩 필수 |
| 공통 성향 | spending_style: value, balanced, premium | 온보딩 필수 |
| 공통 성향 | mobility: low, medium, high; ecosystem: none, android, apple, mixed; lifestyle_note 300자 이하 | 선택, 미언급 시 null |
| 스마트폰 선호 | preferred_brands: samsung/apple 목록; priorities: battery, camera, performance, portability, display 중 순서 있는 최대 3개 | 빈 목록 허용 |
| 스마트폰 선호 | preferred_os: android, ios 또는 null | 선택 |
| 이번 구매 필수 | budget_max_krw: 정수 1~10000000, usages: 1~6개 | 추천 실행 전 반드시 확인 |
| 이번 구매 필수 | allowed_brands, required_os, min_storage_gb, max_weight_g, min_refresh_hz, require_5g, require_wireless_charging | 선택; 미지정은 제한 없음 |
| 이번 구매 선호 | 위 스마트폰 선호의 이번 요청 override | 선택, 영구 저장하지 않음 |
| 이번 구매 문맥 | replacement_device_id, purchase_reason 300자 이하 | 선택, 기기 ID 소유권 검증 |

“삼성 선호”는 preferred_brands, “삼성만”은 확인 후 allowed_brands다. “저렴하면 좋음”은 선호이며 명시 예산은 필수 상한이다. AI가 임의로 hard 조건을 만들거나 완화하지 않는다. 명시적인 이번 조건 > 저장 선호이며 서로 모순된 필수 조건은 clarify로 반환한다.

hard의 allowed_brands는 samsung/apple 중 비어 있지 않은 부분집합(기본 둘 다), required_os는 android/ios/null, min_storage_gb는 1~4096 정수, max_weight_g는 1~2000, min_refresh_hz는 1~1000, require_*는 boolean이다. 생략·null은 제한 없음이며 require_*=false도 요구 없음이다. 예산·숫자를 문자열로 자동 변환하지 않는다. soft는 프로필의 같은 필드 스키마를 사용하며 명시된 필드만 이번 요청에 덮어쓴다. usages는 이번 구매 목적이며 SQL 사양 필터가 아니라 AI 적합성 입력이다.

자연어 분석은 DB에 저장하지 않는 초안만 반환한다. 사용자가 편집·확정해 PUT /profile 또는 POST /recommendations로 보내야 적용된다. 초안의 자연어 원문은 영속 저장하지 않는다. 초기 프로필은 version=1, confirmed_at=null; 확인 저장 시 version 증가. PUT은 expected_version 비교 후 갱신, 불일치 409. 필수 프로필 미완료 시 추천은 409 PROFILE_INCOMPLETE.

분석·추천의 의미상 예산/용도 누락은 clarify로 질문하되, 제공된 값의 타입·범위 오류는 422다. 프로필 PUT의 필수 필드 누락은 422다.

### 3. 보유 기기

- GET /api/owned-device-options?q=...는 **카탈로그 전체** 검색으로 삼성·애플·3년 필터 없음. 이번 스마트폰 카탈로그 밖 태블릿·PC·워치 등은 수동 등록.
- 카탈로그 선택은 variant_id만 받으며 명칭·옵션은 서버에서 읽는다.
- 수동은 category(smartphone/laptop/tablet/watch/monitor/pc/cpu/gpu/ram/ssd/motherboard/psu/case/cooler/other), manual_brand 80자, manual_model_name 120자가 필수. manual_storage_gb·manual_model_number·manual_specs_json은 선택. 제품 유형은 category, 부가 사양은 manual_specs_json으로 분리한다. 숫자는 양수 또는 null.
- catalog/manual 중 하나만 허용. 미등록 기기·오래된 기기 등록에 출시일을 요구하지 않음. 수동 사양·모델은 미검증이며 객관 성능·호환성 주장 근거로 쓰지 않음.
- 사용자당 최대 20개, 동일 모델 복수 소유는 허용. 수정·삭제는 소유권 검증. 기기 변경과 profiles.version 증가는 한 트랜잭션에서 처리해 추천 중 변경을 감지한다.
- MVP는 OS·생태계 선호만 비교한다. 특정 워치/액세서리의 검증된 호환 데이터가 없으면 “호환 미확인” 표시. 정확한 호환이 필수인 요청은 추정 추천하지 않고 clarify. 범용 호환성 테이블은 만들지 않음.

### 4. 제품·옵션·가격 정책

- smartphones는 **국내 모델번호별 모델 행**, smartphone_variants는 모델+저장 용량+색상별 구매 옵션 행이다. 해외 명칭이나 시리즈명을 국내 모델번호 대신 쓰지 않는다.
- 추천 필터: brand IN (samsung,apple), verified=true, is_test=false, 국내 모델번호·국내 출시일 존재. 새 국내 자급제 제품의 유효 가격 필요. 보유 기기용 카탈로그에는 타사·구형·미확인 행을 둘 수 있음.
- 추천 시작의 Asia/Seoul 날짜 D에서 달력상 3년 전~D **양 끝 포함**. 윤일은 대상 연도 말일 보정. 미래·미확인 국내 출시일 제외.
- 모델 공통 사양: os, chipset, screen_inches, refresh_hz, battery_mah, weight_g, supports_5g, wireless_charging. 옵션별 storage_gb, ram_gb. 모르는 값은 null이고 0/false로 대체하지 않음.
- 사양 묶음은 source_name·source_url·verified_at로 출처 추적. 확인된 한 출처에서 검증 가능한 값만 채우고, 서로 다른 출처 혼합이 필요한 데이터는 검수 후 일관된 기록으로 등록한다.
- price_observations는 옵션별 append-only 관측. source_name, source_url, seller_name, amount_krw, shipping_krw, observed_at, expires_at, conditions_text, unconditional, in_stock, is_new, is_unlocked 필수.
- KRW 정수, 배송비 포함 total=amount+shipping. 카드·통신약정·보상판매·회원전용 할인은 unconditional=false로 후보 제외. 출고가를 현재 구매가로 대신 사용하지 않음.
- 유효기간: 실제 구현은 0 < expires_at-observed_at <= 24시간 및 observed_at <= now < expires_at을 검사한다. 수집기 TTL은 이 상한 안에서 출처별로 더 짧게 설정할 수 있다. 미래 시각·배송비 미확인·재고 없음·중고·통신사 조건은 제외.
- 판매처+옵션+출처별 최신 관측을 먼저 고른 후 유효한 행 중 최저 총액 선택. 최신이 품절/만료면 그 판매처의 과거 저가로 되돌아가지 않음. 다른 판매처의 유효 가격은 사용 가능.
- 추천 완료 직전 선택 가격의 최신성·유효기간 재검증. 변경되면 결과를 버리고 409 CANDIDATES_CHANGED. 이력은 당시 가격을 유지하되 현재 만료 여부를 표시하며 “현재 최저가”라고 부르지 않음.
- TechSpecs API는 사용하지 않는다(D-028). 제조사 공식 자료·다나와 등의 수집/재사용 권한은 아직 미확인. 초기 시험 자료는 is_test=true로 분리하고 production 후보에서 항상 제외. 검증한 실제품 자료의 출처·사용 권리 확인 전 실서비스 데이터로 승격하지 않음.

### 5. MySQL 핵심 테이블 — 8개, 초기 SQL·모델 작성 완료 / 실제 DB 적용 전

공통: InnoDB, utf8mb4, 시간은 UTC DATETIME(3), API는 UTC ISO8601, 출시일은 DATE. id는 BIGINT UNSIGNED AUTO_INCREMENT이며 JSON에서는 문자열 ID. CHECK를 지원하는 MySQL 8.0.16 이상을 구현 최소 버전으로 정한다. 아래 표시 외 값은 NOT NULL; ?는 NULL 허용. JSON 내용은 Express의 고정 스키마로 검증한다.

| 테이블 | 최소 컬럼 | 관계·제약·인덱스 |
|---|---|---|
| users | id, email VARCHAR(254), password_hash VARCHAR(512), created_at | UNIQUE(email), 정규화 이메일 |
| sessions | sid_hash BINARY(32), user_id?, data JSON, expires_at | PK(sid_hash), FK user_id→users CASCADE, INDEX(expires_at), INDEX(user_id) |
| profiles | user_id, common_json JSON, smartphone_json JSON, version INT UNSIGNED, confirmed_at?, updated_at | PK/FK user_id→users CASCADE, CHECK(version>=1) |
| smartphones | id, brand VARCHAR(80), model_name VARCHAR(120), domestic_model_number VARCHAR(80)?, released_on_kr DATE?, os VARCHAR(16)?, chipset VARCHAR(120)?, screen_inches DECIMAL(4,2)?, refresh_hz SMALLINT?, battery_mah INT?, weight_g DECIMAL(6,2)?, supports_5g BOOLEAN?, wireless_charging BOOLEAN?, source_name VARCHAR(120)?, source_url VARCHAR(2048)?, verified_at?, verified BOOLEAN DEFAULT false, is_test BOOLEAN DEFAULT true, updated_at | UNIQUE(brand,domestic_model_number), INDEX(brand,released_on_kr), 수치 양수/null, boolean 0/1/null |
| smartphone_variants | id, smartphone_id, storage_gb INT, ram_gb INT?, color VARCHAR(40), source_name VARCHAR(120)?, source_url VARCHAR(2048)?, verified_at?, verified BOOLEAN DEFAULT false, updated_at | FK smartphone_id→smartphones RESTRICT, UNIQUE(smartphone_id,storage_gb,color), 용량·RAM 양수, color 정규화 코드; 모르면 unspecified |
| price_observations | id, variant_id, source_name VARCHAR(120), source_url VARCHAR(2048), seller_name VARCHAR(120), amount_krw INT UNSIGNED, shipping_krw INT UNSIGNED?, observed_at, expires_at, conditions_text VARCHAR(500), unconditional BOOLEAN, in_stock BOOLEAN, is_new BOOLEAN, is_unlocked BOOLEAN | FK variant_id→smartphone_variants RESTRICT, CHECK(amount_krw>0), CHECK(expires_at>observed_at), INDEX(variant_id,source_name,seller_name,observed_at,id); 기간 24h·시각은 서버 검증 |
| owned_devices | id, user_id, variant_id?, category VARCHAR(16), manual_brand VARCHAR(80)?, manual_model_name VARCHAR(120)?, manual_model_number VARCHAR(80)?, manual_storage_gb INT?, manual_specs_json JSON?, created_at, updated_at | FK user_id→users CASCADE, FK variant_id→smartphone_variants RESTRICT, INDEX(user_id), 카탈로그형과 수동형 XOR CHECK |
| recommendations | id, user_id, status VARCHAR(16), profile_version INT, input_snapshot JSON, candidates_snapshot JSON, result_json JSON?, validation_errors JSON?, model_name VARCHAR(120)?, prompt_version VARCHAR(40), as_of, created_at | FK user_id→users CASCADE, INDEX(user_id,created_at,id), status CHECK(processing/recommend/clarify/keep/defer/no_match/failed) |

상세 제약:
- owned_devices: variant_id가 있으면 category=smartphone이고 manual_specs_json을 포함한 모든 manual_*는 null. 없으면 manual_brand·manual_model_name 필수. category는 §3의 허용값을 CHECK로 제한한다. manual_storage_gb는 smartphone/laptop/tablet/pc/ssd에서만 양수 또는 null, 그 외 유형은 null. JSON은 null 또는 객체인지만 DB CHECK로 확인하고 유형별 키·값은 Express에서 검증한다. PC 부품도 같은 소유권·20개 상한·version·삭제 정책 적용.
- verified=true인 모델·옵션은 출처·verified_at 필수, 모델은 국내 모델번호·출시일·os 필수. 허용 OS는 android/ios/other. 추천에는 옵션 verified=true도 필요. DB CHECK와 서버 검증을 함께 구현.
- sessions store는 원본 SID의 SHA-256을 PK로 사용하고 원본을 DB·로그에 남기지 않는다. express-session Store 계약의 get/set/touch/destroy를 구현한다. get/touch에서 서버 만료·절대 기한 확인. 익명 CSRF 세션은 user_id=null.
- FK 부모 삭제 정책 외에 사용자 탈퇴는 비밀번호 재확인 후 단일 트랜잭션으로 user 삭제·연관 프로필/기기/이력/세션 CASCADE. DB 사양·가격 행은 공개 카탈로그이므로 사용자 삭제와 무관.
- 프로필 초기화는 빈 JSON·confirmed_at=null·version 증가와 해당 사용자 추천 이력 삭제를 한 트랜잭션으로 처리. 기기 삭제·수정 시 해당 사용자의 추천 이력도 삭제해 기기 스냅샷 잔존 방지.
- 추천 이력 90일 보관 후 삭제. 입력 자연어·원시 AI 응답은 영속 보관하지 않고 정규화 스냅샷·검증 코드만 저장. 외부 백업·공개 배포는 아직 없음; 도입 전 삭제 전파·보존 정책 별도 확정.
- 기존 다제품군 category_preferences, 별도 profile_versions, 일반 EAV 사양, data_sources, recommendation_items 테이블은 MVP에서 생성하지 않는다. 추천 항목·출처는 위 컬럼/JSON으로 충분하다.

### 6. AI → 후보 검색 → AI 추천 → 서버 검증

1. POST /api/analysis는 purpose=profile 또는 purchase와 text를 받는다. AI에 명령 실행·SQL·웹 도구 없이 최소 입력만 보내 초안을 만들고 Express가 enum·타입·필드·질문을 검증한다. 사용자 확인 없이 저장/추천하지 않음.
2. POST /recommendations는 **사용자가 확인한 구조화 조건**과 expected_profile_version을 받는다. 구매 필수값 누락/충돌이면 clarify. 프로필·기기는 서버가 읽고 트랜잭션에서 version·스냅샷을 확보한다.
3. parameterized SELECT로 출시·제조사·옵션·유효 가격·모든 hard 조건 충족 후보 조회. null 사양은 해당 필수 조건을 충족하지 못함. soft 조건은 후보 제거에 쓰지 않음.
4. 후보 0개면 no_match(조건 완화 질문, 자동 완화 없음). 40개 초과면 clarify로 범위를 좁히며 임의 상위 40개 절단 금지. 1~40개는 모든 후보를 AI에 전달한다.
5. AI는 최대 3개 variant_id와 순위, profile_refs, 구조화된 evidence·tradeoffs, subjective_fit, uncertainties를 반환한다. 유지·보류는 keep/defer와 검증 가능한 근거 또는 불확실성을 반환한다.
6. Express가 현재 DB의 모델/옵션 ID·이번 후보 포함·중복·순위, 예산·출시·hard 조건을 재확인한다. 프로필 버전 변경은 409 PROFILE_CHANGED, 후보 사양/가격 변경은 409 CANDIDATES_CHANGED.
7. evidence는 {variant_id, field, value}로 제한하고 허용 필드와 스냅샷 값을 엄격 비교한다. 가격 evidence는 price_observation_id·total_krw, 기존 기기 비교는 검증된 카탈로그 필드만 허용한다. 수동 입력 사양·추측 비교는 거절한다.
8. 사용자 표시용 객관적 장단점·수치는 서버 템플릿으로 검증된 evidence에서 생성한다. AI의 자유문장 subjective_fit은 평가용으로만 다루고 MVP 응답에는 그대로 노출하지 않는다. AI가 고른 profile_refs와 reason_code(예: storage_meets_requirement, lighter_than_owned, budget_headroom)에서 서버가 적합성 설명을 조합한다. reason_code별 조건도 검증하여 사실과 무관한 이유를 차단한다.
reason_code 허용 목록은 storage_meets_requirement(용량>=필수 최소), lighter_than_owned(검증된 이전 기기보다 가벼움), budget_headroom(예산-배송포함가격>0), preferred_brand_match(선호 제조사 일치), preferred_os_match(선호 OS 일치), higher_refresh_than_owned(검증된 이전 기기보다 높은 주사율)로 시작한다. profile_refs는 확인된 common/smartphone/이번 soft 필드만 허용한다. 근거 없는 카메라·배터리 실사용 우수성은 생성하지 않는다. 이유를 하나도 검증할 수 없으면 recommend로 반환하지 않는다.

9. 스키마/근거 실패 시 오류 코드만 AI에 보내 수정 1회. 각 호출 timeout 20초, 전체 추천 요청 45초 제한. 여전히 실패하면 failed 저장·502 AI_INVALID_RESULT, timeout은 504. 응답 가격을 채우거나 가상 제품으로 복구하지 않음.
10. 결과와 최소 스냅샷·모델·프롬프트 버전·검증 결과 저장. AI 호출 중 DB 트랜잭션을 열어두지 않는다. 최종 저장 때 user/profiles 행을 잠그고 버전을 재확인; 삭제와 경합 시 결과 미저장. 요청은 동기 처리하고 큐/별도 작업 테이블은 만들지 않음. 서버 시작 시 2분 이상 지난 processing 행은 failed로 정리하며 자동 재실행하지 않는다. AI 재시도는 45초 전체 제한 내에서만 수행한다.

AI 공급자 결정 전 동일 입출력 계약의 모의 응답으로 구현한다. AI가 실제 순위·개인 적합성을 결정하되 Express는 데이터·안전 조건만 강제한다.

### 7. 필수 REST API

공통: /api, JSON, ID는 문자열. 성공은 {data:...}, 오류는 {error:{code,message,fields?}}. 목록은 {data:[...],next_cursor:null|string}, limit 기본 20·최대 50. 쿠키 세션 사용, user_id 입력 금지. 변경 요청은 CSRF 필수. 삭제 성공은 204·본문 없음. 400 JSON 파싱, 401 미로그인, 403 CSRF, 404 자원 없음, 409 충돌, 422 스키마, 429 제한, 502/504 AI 장애.

| 메서드·경로 | 입력 | 성공·역할 |
|---|---|---|
| GET /auth/csrf | 없음 | 200 {csrf_token}, 익명 세션 생성 |
| POST /auth/register | email,password | 201 {id,email}, 프로필 초기행 생성, 자동 로그인 안 함 |
| POST /auth/login | email,password | 200 {user:{id,email},csrf_token}, 세션 재발급 |
| GET /auth/me | 없음 | 200 {id,email}; 미로그인 401 |
| POST /auth/logout | 빈 객체 | 204, DB 세션 삭제 |
| DELETE /account | password | 204, 비밀번호 재확인·전체 개인 데이터 삭제 |
| GET /profile | 없음 | 200 {version,common,smartphone,confirmed_at} |
| PUT /profile | expected_version,common,smartphone | 200 갱신 프로필; 전체 교체·확인 저장 |
| DELETE /profile | expected_version | 204, 프로필 초기화·이력 삭제; 보유 기기는 유지 |
| POST /analysis | purpose,text | 200 {draft,questions,uncertainties}; 저장 없음 |
| GET /owned-device-options | q,limit,cursor | 200 카탈로그 옵션 목록; 제조사·연식 필터 없음 |
| GET /owned-devices | 없음 | 200 소유 기기 목록 |
| POST /owned-devices | {variant_id} 또는 수동 필드 | 201 기기와 profile_version |
| PUT /owned-devices/:id | 위와 같은 전체 필드 | 200 기기와 profile_version |
| DELETE /owned-devices/:id | 없음 | 204, 이력 삭제·프로필 version 증가; 이후 GET /profile |
| GET /smartphones/:variantId | 없음 | 200 모델·옵션·검증 사양·최신 가격/만료 표시; 인증 필요 |
| POST /recommendations | expected_profile_version,hard,soft,replacement_device_id? | 201 {id,status,items,questions,as_of}; clarify/no_match도 정상 결과 |
| GET /recommendations | limit,cursor | 200 본인 이력 목록 |
| GET /recommendations/:id | 없음 | 200 당시 결과·현재 가격 만료 표시 |
| DELETE /recommendations/:id | 없음 | 204 본인 이력 삭제 |

수동 등록 예:
```json
{"category":"smartphone","manual_brand":"기타 제조사","manual_model_name":"사용 중인 구형 모델","manual_model_number":null,"manual_storage_gb":64}
```

프로필 확정 요청 PUT /api/profile:
```json
{"expected_version":1,"common":{"usages":["video","coding"],"spending_style":"value","mobility":"high","ecosystem":"android","lifestyle_note":null},"smartphone":{"preferred_brands":["samsung"],"priorities":["battery","portability"],"preferred_os":null}}
```
응답: {data:{version:2,common:요청값,smartphone:요청값,confirmed_at:UTC시각}}.

분석 요청/응답 예(실제 모델 호출 결과 아님):
```json
{"purpose":"purchase","text":"100만원 이하, 256GB 이상. 삼성 선호지만 다른 제품도 괜찮아."}
```
```json
{"data":{"draft":{"hard":{"budget_max_krw":1000000,"min_storage_gb":256},"soft":{"preferred_brands":["samsung"]}},"questions":["주요 사용 목적을 확인해 주세요."],"uncertainties":[]}}
```

추천 요청(프로필에서 가져와 사용자가 확인한 usages를 명시):
```json
{"expected_profile_version":2,"hard":{"budget_max_krw":1000000,"usages":["video","coding"],"min_storage_gb":256,"allowed_brands":["samsung","apple"]},"soft":{"preferred_brands":["samsung"],"priorities":["battery","portability"]},"replacement_device_id":null}
```

응답 예 — 아래 ID·가격은 가상 계약 예시이며 실제 제품 정보가 아님:
```json
{"data":{"id":"901","status":"recommend","as_of":"2026-11-09T09:00:00.000Z","items":[{"variant_id":"101","rank":1,"price":{"observation_id":"501","total_krw":900000,"source_name":"테스트 출처","source_url":"https://example.com/test","observed_at":"2026-11-09T08:00:00.000Z","expires_at":"2026-11-10T08:00:00.000Z"},"reasons":[{"code":"storage_meets_requirement","field":"storage_gb","value":256}],"uncertainties":["카메라 품질의 정량 비교 자료 없음"]}],"questions":[]}}
```
오류 예: {"error":{"code":"PROFILE_CHANGED","message":"프로필이 변경되었습니다. 다시 요청해 주세요."}} (409).

### 8. 다음 구현 단위와 제외 범위

1. MySQL 8.0.16+ 핵심 8테이블 마이그레이션·제약 시험, mysql2 연결과 설정 누락 처리.
2. 서버 세션 Store·가입/로그인/CSRF·로그아웃·소유권.
3. 프로필·기기 CRUD 및 원자적 version 갱신.
4. 시험 카탈로그·가격 fixture·후보 SELECT·모의 AI·검증기.
5. Vue 화면 연결 후 별도 승인된 실제 AI 평가.

일반 추천 엔진, 다제품군 EAV, 관리자 UI, 수집 자동화, 실시간 가격 조회, 범용 호환 엔진, PC-FIT 통합은 만들지 않는다. PC-FIT의 실제 코드·Supabase 스키마·권리 검증과 MySQL 이전은 스마트폰 이후다. [제품 데이터 공급 계획](PROJECT_OVERVIEW.md)은 D-028을 따르며 수집·재사용 권한은 별도 확인한다. 테스트 계약은 [TEST_PLAN.md](TEST_PLAN.md), 보안·Taste 제한은 [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md)를 따른다.

### 9. IT 기기·PC 부품 확장 경계 — D-018, 현재 8테이블 유지

최종 서비스는 IT 기기·조립 PC 추천 플랫폼이며 스마트폰은 첫 구현 범위다. 현재 구조는 확장 가능하지만 **PC 부품 카탈로그·호환 검사·조립 구성 관계까지 이미 지원하는 것은 아니다.**

| 영역 | 현재 지원·한계 | 지금의 최소 조치 / 나중의 작업 |
|---|---|---|
| 사용자 프로필 | common_json 재사용, smartphone_json은 스마트폰 전용 | 현재 테이블·응답 유지. PC 선호는 후속 마이그레이션에서 별도 이름으로 추가, 스마트폰 필수값을 전체 플랫폼 가입 조건으로 확대하지 않음 |
| 보유 기기 | 노트북·태블릿 등 수동 등록 가능, 기존에는 부품 유형·사양 슬롯 없음 | category 허용값 확대·manual_specs_json 1개 추가 **설계**. 별도 테이블 없음 |
| 카탈로그 참조 | variant_id는 smartphone_variants FK, 임의 다른 테이블 참조 불가 | 의미·FK 유지. PC 카탈로그 도입 때 nullable pc_component_variant_id 같은 명시적 FK와 XOR/category 제약을 추가 검토. 현재는 추가하지 않음 |
| 제품 사양·가격 | smartphones/variants/price_observations는 스마트폰 전용 | CPU·GPU 사양을 스마트폰 컬럼에 넣지 않음. 후속 PC 부품 상세·옵션·가격 테이블은 별도 설계; price_observations.variant_id 의미를 혼용하지 않음 |
| 조립 PC | category=pc는 보유 완성 PC 한 대의 기록일 뿐 | 부품 여러 개의 연결·수량·슬롯·호환성이 표현된 것으로 간주하지 않음. 구성/구성항목 관계는 PC 기능 시작 때 설계 |
| 추천·분석 API | 현재 /analysis purchase와 /recommendations는 스마트폰용 | 현재 계약 유지. 후속 제품군 구분·근거 스키마·정책 버전은 그때 추가하며 과거 이력은 스마트폰 v1로 해석 |

#### manual_specs_json의 제한된 용도

사용자 입력 사양을 잃지 않고 타입별로 구분하기 위한 **미검증 보유 자산 메모**다. 제품 DB·EAV·호환성 엔진을 대신하지 않으며 AI의 객관적 추천 근거로 승격하지 않는다. 입력·조회 API에 같은 이름으로 노출하고 기존 수동 요청에서 생략하면 null이다.

| category | 허용 JSON 키 |
|---|---|
| smartphone/laptop/tablet/pc | ram_gb, processor_model, gpu_model, os_name |
| cpu | socket, cores |
| gpu | vram_gb, power_w |
| ram | capacity_gb, memory_standard, speed_mt_s, module_count |
| ssd | interface, form_factor |
| motherboard | socket, memory_standard, form_factor |
| psu | rated_power_w |
| case/cooler | form_factor |
| watch/monitor/other | note |

- storage는 기존 manual_storage_gb만 사용한다. RAM capacity_gb, GPU vram_gb와 저장장치 용량을 혼동하지 않는다. RAM의 capacity_gb는 해당 등록 키트 전체 용량이며 module_count는 키트 내 모듈 수다.
- 숫자형 키는 양의 정수(1~1000000), 문자열은 1~120자(note는 300자); 생략·null은 미확인이다. JSON 최대 UTF-8 2KiB, 중첩 객체/배열·미허용 키·다른 유형의 키는 422. 값의 형식이 유효해도 실제 사양이 검증됐다는 뜻은 아니다.
- category 변경 시 사양을 새 유형에 맞게 전체 교체한다. 수동→카탈로그 전환 시 모든 manual_*를 null로 비우며, 자동 모델 추정·연결은 하지 않는다.
- pc의 processor_model 같은 문자열만으로 실제 소유 CPU 행과의 관계를 생성하지 않는다.

예: 수동 RAM 등록(가상 입력, 실제 제품 사양 아님).
```json
{"category":"ram","manual_brand":"사용자 입력 제조사","manual_model_name":"보유 메모리 키트","manual_model_number":null,"manual_storage_gb":null,"manual_specs_json":{"capacity_gb":32,"memory_standard":"DDR5","speed_mt_s":5600,"module_count":2}}
```

#### PC-FIT 후속 통합 절차 — 이번 미실행

1. 기존 [PC-FIT](https://github.com/tjandud/pc-fit)의 코드·Supabase 스키마·사용 권리·가격 및 사양 출처를 읽기 전용으로 검증한다. 현재 원본 구조·정확성·재사용 가능성은 미확인이다.
2. 원본 부품 ID와 새 ID의 매핑, 모델/옵션·단위·누락값을 정의한다. 원본 ID를 smartphone variant_id에 재사용하지 않는다. 매핑 보관 방식·부품별 상세 테이블은 조사 이후 결정한다.
3. 소켓·칩셋/BIOS·DDR 세대·전원·치수·슬롯 규칙의 입력/출력·누락값 처리를 검증한다. 기존 로직은 Express의 별도 PC 검증 경계에서 재사용할지 판단하며 AI가 호환성 판정을 우회할 수 없게 한다.
4. 이전은 원본 보존·롤백·건수/FK/중복/단위 검증 후 진행한다. 기존 호환/비호환/정보부족 사례로 회귀 검사하고 스마트폰 회귀 시험도 유지한다.
5. 사용자 동의·확인 없이 기존 수동 부품을 카탈로그에 자동 연결하지 않는다. 삼성·애플·최근 3년·스마트폰 가격 정책은 PC에 자동 상속하지 않고 별도 결정한다.

현재 수행 범위는 문서 보완뿐이다. PC 테이블·새 FK·조립 관계·추가 API·실행 코드는 생성하지 않는다.

### 10. DB 1차 구현 상태 — 2026-11-09

backend/db/migrations/001-initial.sql에 8테이블·FK·UNIQUE·CHECK를 작성하고 db/models.js에서 Sequelize로 매핑했다. config/database.js는 환경 변수만 읽으며, bin/www는 DB 인증·MySQL 8.0.16+ 버전 확인 성공 후 HTTP를 시작한다. /api/health/db는 연결 상태만 확인한다.

DB는 자동 생성하지 않는다. db/migrate.js --apply는 기존 빈 스키마만 허용하며 자동 sync·기존 테이블 변경·삭제·롤백 삭제·시드 생성은 없다. 업무 테이블 외 마이그레이션 메타 테이블도 추가하지 않았다. DDL 부분 실패 시 중단하며 후속 전진 마이그레이션이 필요하다.

### 11. 보유 기기 기반 업그레이드 제안 및 다중 IT기기 확장 아키텍처 — 2026-11-10

1. **업그레이드 판정 서비스 (`backend/services/upgrade-advisor.js`) 및 기기군별 정책 레지스트리 (`DEVICE_UPGRADE_POLICIES`)**:
   - `smartphone`: `active: true`, `threshold_years: 3`, `criteria_type: 'release_date_elapsed'` (현재 MVP 활성화).
   - `laptop`: `active: false`, `threshold_years: 4`, `criteria_type: 'release_date_elapsed'` (향후 확장 예정, 현재 미실행).
   - `tablet`: `active: false`, `threshold_years: 4`, `criteria_type: 'release_date_elapsed'` (향후 확장 예정, 현재 미실행).
   - `watch`: `active: false`, `threshold_years: 3`, `criteria_type: 'release_date_elapsed'` (향후 확장 예정, 현재 미실행).
   - `pc`: `active: false`, `threshold_years: null`, `criteria_type: 'performance_compatibility_condition'` (단순 출시일이 아닌 성능·호환성·부품 상태 중심, PC-FIT 후속 연동 예정).

2. **보유 스마트폰 식별 및 출시 3년 경과 판정 규칙**:
   - 카탈로그 연결(`variant_id`) 기기는 연결된 `smartphones.released_on_kr`과 `verified` 여부를 직접 확인한다.
   - 수동 등록(`manual_*`) 스마트폰은 내부 카탈로그에서 (1) `manual_model_number` 정확 일치 또는 (2) `manual_brand + manual_model_name` 단일 검증 모델 일치 시에만 출시일을 식별한다. 동일 모델명에 여러 세부 모델(`domestic_model_number`)이 존재하면 `ambiguous_model_variant`, 일치 모델이 없으면 `unidentified_model`, 출시일 누락/형식 오류/미래 날짜이면 `needs_verification: true`(`확인 필요`)를 반환하며 임의로 출시일을 추측하지 않는다.
   - 경과 계산은 `Asia/Seoul` 달력 날짜 기준으로 수행하며, 출시일 `Y-M-D`의 3년 도래일(`Y+3-M-D`, 윤년 2월 29일 출시 모델은 평년 2월 28일)과 현재 KST 날짜를 비교해 `currentKst >= anniversary3YKst`일 때만 `three_years_elapsed: true`, `upgrade_offer_eligible: true`로 판정한다.
   - 다수의 스마트폰을 등록한 경우 사용자가 명시적으로 지정한 대표 스마트폰(`current_device_id`) 또는 가장 최근 등록된 스마트폰(`id DESC`)을 `current_device`로 선정하고 나머지는 `past_or_other_smartphones`로 분리한다.

3. **기존 8개 테이블 재사용 및 알림 표시·보류 상태 관리 (`routes/upgrade-offers.js`, `routes/member.js`)**:
   - DDL이나 신규 테이블·컬럼 추가 없이 `profiles.smartphone_json` 내부의 서버 전용 메타데이터(`_upgrade_state: { current_device_id, devices: { [ownedDeviceId]: { snoozed_until, dismissed_permanently, updated_at } } }`)에 기기별 알림 상태를 저장한다.
   - `GET /api/profile` 및 `PUT /api/profile`에서는 `_upgrade_state`를 외부 응답에서 제거하고 내부적으로 보존하여 기존 프로필 API 계약을 100% 유지한다.
   - `GET /api/upgrade-offer`는 상태를 변경하지 않는 순수 조회(Gemini 호출 0회)이며, `PUT /api/upgrade-offer/state`를 통해 `'snooze'`(`UPGRADE_SNOOZE_DAYS`, 기본 30일 유예), `'dismiss_permanent'`(해당 기기 영구 숨김), `'set_current'`(대표 기기 전환), `'reset_notice'`를 처리한다. 보유 기기를 수정하거나 삭제하면 해당 기기의 알림 억제는 자동 초기화된다.

4. **보유 기기 대비 객관 비교, 현 기기 유지(`status: 'keep'`) 판단 및 AI/서버 역할 분리**:
   - **결정론적 서버 계산**: 출시 3년 경과 판정, 후보 검색(`searchCandidatesForUser`), 보유 기기 대비 화면·무게·배터리(mAh)·저장용량·RAM·주사율·무선충전·가격의 객관적 수치 비교(`buildDeviceCandidateComparison`), 현 기기 유지 가능 여부(`evaluateKeepCurrentDeviceOption`)는 모두 Express 서버가 결정론적으로 계산한다. 누락된 사양이나 벤치마크 테이블이 없는 칩셋 성능 차이는 `'insufficient_data'`(`정보 부족`)로 표시하고, 배터리 용량(mAh) 증가는 실사용 시간 증가를 보장하지 않는다는 주의 문구를 부여한다.
   - **AI 판단 및 서버 재검증**: 사용자가 명시적으로 `POST /api/recommendations`를 호출할 때만 Mock AI 또는 Gemini API를 호출한다(실시간 웹 검색 및 Google Search Grounding 금지). 보유 기기가 이번 필수 조건을 모두 충족하고 사용자의 교체 의향이 낮거나 체감 업그레이드 이득이 낮으면 `status: 'keep'`과 검증된 유지 근거(`keep_reasons`, `keep_cautions`)를 반환하며, `recommendation-validator.js`가 보유 기기 사양 충족 사실과 후보 근거 일치 여부를 최종 검증한다.

## 프론트엔드 1단계 및 제품 비교 데이터 경계

기존 Vue 3.5.45·Vuetify 3.13.7·Vue Router 4.6.4·Vuex·Vue CLI 구성 유지. App.vue의 헤더/모바일 메뉴/푸터, 공통 버튼·카드·상태 화면, design/tokens.js 및 styles/global.css로 테마·간격·상태를 구성한다. 외부 웹폰트 로더는 진입점에서 호출하지 않으며 시스템 폰트와 설치된 로컬 MDI를 사용한다. ‘기기로운’은 화면용 가칭이다. 기존 HelloWorld/AboutView 자산은 삭제하지 않고 라우트에서만 분리했다.

라우트: / 홈, /register, /login, /profile, /devices, /recommend, /recommendations/:id, /history, /upgrade, /pc, /compare, /error 및 나머지 404. 홈과 레이아웃, /compare 기본 틀만 구현했으며 나머지 업무 화면은 준비 중 플레이스홀더다. 실제 로그인 가드/사용자 데이터 로딩은 다음 단계다.

### 일반 스펙 비교 (D-027)

연결 예정 흐름: 내부 MySQL → 기존 Express GET /api/smartphones 및 /api/smartphones/:variantId → 프론트 제품 선택(2~3개) → 항목 정의에 맞춘 표시용 매핑 → SpecComparison.vue. Gemini/analysis/recommendations는 이 경로에서 호출하지 않는다. 차이 강조는 값 비교일 뿐 추천 점수나 승자 판정이 아니다.

기존 API에서 screen_inches, refresh_hz, ram_gb, storage_gb, battery_mah, weight_g, sources/verified/is_test, price를 확인했다. 가격은 유효한 price.total_krw(배송비 포함)를 화면의 price_krw로 매핑할 예정이며 관측 시점·유효기간·출처도 연결 단계에서 안내한다. 만료/미확인 가격은 0원으로 바꾸지 않는다. 모델·옵션 검증 상태와 시험 데이터 제외를 확인하고 미검증 항목은 표시 근거로 사용하지 않는다. 기존 API는 세션 인증이 필요하므로 ‘AI 추천과 독립’은 비로그인 공개 API를 의미하지 않는다.

현재 비교 컴포넌트는 products, fields, count만 받고, 화면은 빈 2~3열과 ‘정보 없음’을 표시한다. 실제품 검색·중복 선택 방지·선택 상태·API 어댑터·가격 시점 표시는 아직 미구현이다. API 추가 필요는 현재 스마트폰 사양 범위에서 발견하지 못했지만 실제 데이터 충족도는 DB 조회하지 않아 미확인이다. 보유 기기 비교는 소유권이 확인된 데이터와 검증된 카탈로그 연결에 한하며 수동 사양은 검증 자료로 승격하지 않는다. 다른 기기군 카탈로그/펜·센서·호환성/PC-FIT 데이터는 현 API만으로 보장하지 않으며 다음 설계에서 별도 검토한다.

### API 클라이언트 준비

src/api/client.js는 /api 상대 경로, same-origin 쿠키, 메모리 CSRF, 로그인 후 토큰 교체·로그아웃 초기화, 204와 {data,next_cursor}/{error:{code,message}} 보존, 구조화 오류와 취소 signal을 지원한다. 실패한 변경 요청을 자동 재전송하지 않는다. 페이지에서 아직 호출하지 않는다. 개발 프록시는 /api → 127.0.0.1:3000이며 Origin을 임의 변경하지 않는다. 다음 연동 전 사용자가 백엔드 APP_ORIGIN과 실제 브라우저 origin(예: http://127.0.0.1:8080)을 맞춰야 한다. 이번에 .env를 읽거나 변경하지 않았다.


## 향후 데이터 운영 경계 — D-028, 설계 방향만 확정

허용된 제조사 공식 자료·다나와 등 → 출처/확인 시각/모델번호를 포함한 수집 기록 → 모델·옵션·사양·가격 정규화 및 검증 → 관리자 검토·승인 → 내부 MySQL → Express 후보 조회·검증 → 추천 흐름을 계획한다. TechSpecs API와 실시간 웹 검색을 추천 경로에 연결하지 않는다.

관리자 UI는 제품과 수집 내역 관리용으로 분리하고 Express에서 인증과 관리자 권한을 검증한다. 화면을 숨기는 것만으로 권한을 통제하지 않는다. 현재 verified/is_test 및 가격 출처 필드는 기존 구현이며 **관리자 승인 절차·역할·감사 이력·추천 승인 필터는 미구현**이다. 승인 여부 저장 및 이력 스키마는 해당 단계에서 결정하며 현재 8개 테이블을 변경하지 않는다. 미승인·반려·검증 누락 자료는 추천 후보로 승격하지 않도록 설계한다.

현재 프론트는 초기 UI다. 별도 시각적 개선 단계에서도 Vue 3/Vuetify 3와 공통 레이아웃을 재사용한다. 관리자/수집기/PC-FIT 구현 또는 디자인 전면 교체는 이번 프로필·보유 기기 단계에 포함하지 않는다.


## 가격 수집 경계 — 조사·설계, 미구현

구체적 공급처 조사·필드 매핑·갱신·개발 순서는 [PRICE_COLLECTION_PLAN.md](PRICE_COLLECTION_PLAN.md)를 따른다(D-029). 권한이 확인된 자료 → DB 밖 검토 초안 → 정확한 변형 매칭/조건 확인 → 관리자 승인 → 기존 price_observations에 추가 → 기존 카탈로그·추천 가격 검증 흐름을 제안한다.

현행 가격 테이블은 승인 상태/외부 오퍼 ID/미확인 플래그/수집 실패를 저장하지 못한다. 미승인·조건 미확인 값은 적재하지 않으며 source_url은 구매 URL, 별도 evidence_url은 검토 기록으로 구분한다. 품절 가격 누락/수집 실패 시 과거 가격을 새 가격으로 복제하지 않는다. 원래 TTL 전에 즉시 차단하려면 후속 설계가 필요하며 이번 백엔드·스키마 변경은 없다. 네이버 쇼핑 검색 API 종료와 다나와 권한 미확보로 이를 당장 사용 가능한 가격 공급원으로 취급하지 않는다.

## 스마트폰 조사 데이터와 후속 DB 설계안 — 2026-11-11 04:18:28 KST

현재 스키마는 유지한다. 읽기 전용 실제 DB 대조에서 `smartphones` 16개, `smartphone_variants` 29개, `price_observations` 0개 및 세 테이블의 컬럼을 확인했다. 추천/업그레이드/인증 코드와 DB는 변경하지 않았다.

### 별도 검토 데이터 계약 — 작성됨, 운영 미적용

- `backend/data/normalized-smartphones.json`: 기존 26모델/39변형 원본 유지(16/29 적재 대상 + 10/10 보류). 새 JSON으로 덮어쓰지 않는다.
- `backend/data/smartphone-expansion-2026-11-10.json`: 52개 조사 기록, 공식 일반 판매일 확인 49개·정확한 일자 보류 3개, 99개 저장 용량/RAM 구성, 출고가 값 70개/미확인 29개. **99개는 색상별 SKU나 DB 변형 수가 아니다.** 기본 용량만 가격이 확인된 Apple의 나머지 용량 가격은 null이다.
- 모델 식별·판매일·사양·색상·옵션·출고가 출처를 나누고 `sources` URL/확인 시각과 연결한다. `baseline_specs_reference`는 이전 값 참조이며 새 공식 검증으로 승격하지 않는다. 가격 `verified`는 발표 금액 근거 유무로, 정확한 변형 매핑/관리자 승인과 다르다.
- `production_approved=false`, `review_only`, `exact_color_sku_verified=false`를 유지한다. 출처를 읽었다는 사실은 운영 DB 재사용 허가나 관리자 승인 완료가 아니다. 보류 모델은 자동 적재하지 않는다.
- 폴더블 안쪽/바깥쪽 화면, 접힘/펼침 크기, 망원 렌즈 배율과 센서 크롭의 광학 수준 줌, 일반/최대 밝기를 구분한다. Apple 미공개 RAM·mAh, 미확인 충전 출력은 null. 충전기 정격을 기기 입력 최대 출력으로 전용하지 않는다.
- 가격 검색 요약 3건은 `current_price_reviews`에만 저장한다. 실제 판매처 SKU/재고/조건/재사용 권한과 실시간성 미확인으로 관측·만료 시각은 null이며 `price_observations=[]`다.

### 현행 테이블 매핑과 최소 확장 제안 — 승인 전 미구현

| 정보 | 현재 저장 위치/문제 | 후속 제안 |
|---|---|---|
| 브랜드·국내 모델번호·국내 판매일·기본 사양 | smartphones 기존 컬럼 | 확정값만 그대로 매핑. null을 기존 검증값 위에 덮어쓰지 않음 |
| 용량·RAM·색상 | smartphone_variants, UNIQUE(smartphone_id, storage_gb, color) | 정확한 색상/SKU 확인 후 매핑. S25 Ultra 1TB RAM12/16과 전용색 충돌 검사; 실제 충돌 시 별도 SKU 식별자 또는 정규화된 RAM 포함 유일키 승인 필요 |
| 공식 출시 당시 원화 가격 | 현재 전용 컬럼 없음 | 우선 variant에 nullable launch_price_krw, launch_price_source_url, launch_price_checked_at, launch_price_verification_status 추가안. 향후 가격 이력 필요 전에는 별도 범용 가격 테이블 만들지 않음 |
| 해상도·카메라·충전·Wi-Fi 등 상세 사양 | 현재 컬럼 없음 | 스마트폰 전용 typed details JSON 또는 1:1 상세 테이블 중 하나를 선택·승인. 필드별 단위와 provenance/unknown 의미 고정. 추천용 핵심 컬럼은 유지 |
| 공식 정보/공식 구매/판매처 상품 URL | source_url 한 개로 역할 구분 불충분 | 모델 정보 URL과 variant 공식 구매 URL 분리 제안. 판매가격의 source_url은 실제 상품 URL, 다나와 비교 페이지는 추가 출처로 별도 보존 |
| 검수/권리/승인/실패 상태 | verified만으로 충분하지 않음 | 서버 승인 상태·근거를 설계 후 적용. 당장은 DB 밖 검토 자료에 보존 |

현재 가격 적격성은 `smartphone-catalog.js`의 양수 원화가격 + 알려진 배송비 + 네 조건(in_stock/is_new/is_unlocked/unconditional) + observed_at≤현재<expires_at + 0<TTL≤24시간이다. 출고가는 이 경로로 전달하지 않는다. 최신 동일 판매처/출처 관측을 먼저 고른 뒤 적격 배송 포함 총액을 비교한다. 추천 가격 없음은 정상적인 보류/후보 부족 상태여야 한다.

### 다중 카테고리 — Phase 2 설계 과제

스마트폰 MVP 통합 통과 후 공통 제품 식별(브랜드/카테고리/모델/국내 출시/출처)과 카테고리별 상세 사양 정의를 분리한다. 공통 비교 UI는 필드 정의·단위·null 표시를 받아 재사용하며 일반 비교는 MySQL → Express → Vue이고 Gemini를 호출하지 않는다. 조원의 `spec_definitions`/`specifications`는 후속 참고 대상일 뿐 이번에 읽거나 도입하지 않았으며 Supabase를 도입하지 않는다. 기존 스마트폰 ID·보유 기기 FK를 보존하는 점진적 설계를 검토한다. PC-FIT 부품·호환성은 별도 도메인으로 유지한다.

## 스마트폰 최소 DB 확장 권고안 — 2026-11-11 04:35:45 KST

앞선 대안들을 [SMARTPHONE_DB_EXTENSION_DESIGN.md](SMARTPHONE_DB_EXTENSION_DESIGN.md)로 구체화했다(제안·미적용). 새 테이블 없이 smartphones에 공식 URL/details JSON/검수 상태·근거, smartphone_variants에 출고가·근거/검수 상태·근거와 RAM 유일키용 생성 컬럼을 제안한다. price_observations는 유지한다. RAM null은 실사양에서 null, 유일키에서만0으로 처리하며 원래PK/FK는 보존한다.

중요한 실제 코드 제약: member.js 보유 기기 검색·등록은 미검증 변형도 허용한다. 따라서 verified=false만으로 staging 격리가 되지 않으며 승인 전 조사 데이터는 DB 밖에 둔다. 새 상세/출고가 필드는 기존 명시적 SELECT에 자동 노출되지 않으므로 승인 후 API/Sequelize/입력기 변경이 필요하다. 기존 verified를 전체 상세사양/가격 승인으로 재해석하지 않는다. 실제 호환성 테스트는 아직 미실행.

## NULL RAM 및 승인 경계 보완 — 2026-11-11 04:43:02 KST

최소 확장 기본방향은 승인됐고 실제마이그레이션/적재는 미승인(D-032). 생성키는 NULL끼리의중복을 막지만NULL/known의실물동일성은 판정하지 못하므로 승인입력기에 부모행잠금/SKU확인/기존ID보완을 요구한다. 기존16/29와price_observations 유지. 상세는 SMARTPHONE_DB_EXTENSION_DESIGN.md §10. 신규근거는 별도priority-verification JSON으로 보존하고 기존정규화/확장JSON을 수정하지 않았다.

## 사양 검증과 가격 적격성 분리 — 2026-11-11 04:50:14 KST

D-033: 모델(A), 개별 변형(B), 공식 출고가(C1), 현재 판매가(C2)를 분리한다. A+B가 확인된 변형은 가격 행 없이 사양 등록 후보가 될 수 있다. 현행은 출고가를 별도 문서에 유지하고 최소확장 후 nullable 출고가/metadata에 보존한다. C2 없으면 기존 추천 후보 검사는 계속 제외하며 보유기기와 출시3년 판정은 별도다. 미승인 제품은 verified=false만으로 숨겨지지 않으므로 운영DB밖 유지. 상세 수치/근거는 [재분류](SMARTPHONE_VALIDATION_RECLASSIFICATION.md) 참조. 런타임 변경 없음.

## NULL·공식 링크 API 계약 및 적재 준비 — 2026-11-11 09:27:27 KST

[SMARTPHONE_IMPORT_PREPARATION.md](SMARTPHONE_IMPORT_PREPARATION.md)에 기존응답 보존+launch_price/links/spec_verification/price_comparison의 추가 계약을 제안했다. 기존price는현재가, 출고가는별도 nullable 필드. 공식소개/사양/제조사구매/판매처구매/검증출처를 분리하며 모델링크는 기존제안metadata로 유지한다. null은정보없음, false는검증된미지원; AI가추측하거나링크생성하지않는다.

002/003 SQL초안과DB없는Upsert계획기는작성됐지만런타임 serializer/ORM/프론트/쓰기실행부/마이그레이션 적용은미완료다. 기존member 노출한계때문에미승인제품DBstaging금지.16/29 PK/FK보존,가격관측테이블유지.

## 공개 필터·테스트 DB 적재 실행부 완료 — 2026-11-11T14:25:08.174937+09:00

Codex 재개 작업 완료. 직전 구현을 유지하고 MySQL 버전/InnoDB 안전검사, 실패 롤백 모의검증, 미공개 기기 신규등록 거부 테스트 및 문서 인수인계를 마무리했다. 운영/테스트 DB 실제 접속 없음. .env/웹/프론트/Git 작업 없음.

### 구현 완료

- services/product-publication.js: 스키마 이전 verified=true/is_test=false, 확장 후 모델·변형 각각 legacy/approved 상태까지 강제 확인. information_schema 조회 실패 시 허용으로 fallback하지 않으며 캐시하지 않는다.
- routes/smartphones.js: 목록·상세·추천후보 조회 필터. 선택적 검색 옵션으로 공개 필터 우회 불가.
- routes/member.js: 보유기기 선택 목록/신규등록/다른 변형으로 변경 시 필터. 기존 본인 소유 기기 조회·동일 변형 유지·삭제는 소유권 검사 유지, 소유기록 삭제 없음.
- routes/upgrade-offers.js: 수동 기기 자동식별은 공개 모델만. 기존 소유 카탈로그 기기 조회·연령 판정 보존.
- routes/recommendations.js: 직전 작업에서 최종 후보 재검증 SELECT의 공개 조건만 추가. Gemini 호출/프롬프트/가격/결과 로직 변경 없음. 이번 재개에서는 추가 수정하지 않음.
- db/models.js: defineModels(db,DataTypes,{extended:true}) 선택적 확장 매핑. 기본 매핑은 기존 컬럼만 사용하므로 마이그레이션 이전 유지. 공식 URL/details/출고가/review 상태·metadata 매핑, 생성 ram_identity_gb는 쓰기 속성에서 제외. 상세 사양 링크는 metadata에 역할별 저장. SQL002/003 미수정·미실행.
- scripts/prepare-smartphone-model-merge.js의 run은 오프라인 기본, executeTest(options)는 db/test-smartphone-import.js 호출. 동일 기능의 새 CLI 없음.

### 테스트 DB 쓰기 실행부

executeTest() 기본은 DB 접속 없이 계획 반환. apply:true와 정확한 DB명 confirmation 및 명시적 config가 있어야 연결 가능하다. DB명 final_project_test_[a-z0-9_]+, 로컬IP 127.0.0.1/::1, 전용계정 fp_import_test만 허용. root/운영DB/원격/추가 연결옵션 거부. .env/기존 connection 모듈 사용하지 않음. CLI --apply는 계속 거부한다.

접속 후 해당 테스트 스키마 SELECT/INSERT 및 전역USAGE만 허용하는 계정 권한 검사, MySQL8.0.16+·InnoDB·확장컬럼 검사. 다른 DB/전역 권한·role·GRANT OPTION·UPDATE/DELETE 권한은 거부한다. DDL은 이 실행부에서 실행하지 않는다.

기존 원본hash/후보 검증 재사용, 테스트DB에 기준16모델/29변형 사본이 없으면 중단. 신규33모델·근거확인2변형만 pending/verified=false로 삽입하며 8개 식별보류 제외. 기존11+조사기간밖5 및29변형은 전체행/ID/FK 비교로 보존. 기존행 UPDATE/DELETE 없음, 조사 null 덮어쓰기 없음. 재실행은 같은ID로 skip. RAM/색상 모호성은 보류하고 자동 병합하지 않는다. 신규 가격관측0, 기존 색상 가격JSON/개발 가격모듈 유지.

한 Sequelize 관리 트랜잭션, 부모행잠금/GET_LOCK, 실패 예외 전파를 통한 rollback 구조. 실제 운영 공개 승인은 수행하지 않으며 모델 등록 가능과 공개 가능은 구분한다. OS NULL 행은 저장 가능하지만 기존 CHECK상 verified=true로 승격할 수 없다.

### 오프라인 검증 완료 / 실제 DB 검증 대기

총60테스트 통과·실패0(새 publication-import 14 + 기존46). 실행 대상: test/publication-import.test.js, services/smartphone-price-preview.test.js, scripts/prepare-smartphone-upsert.test.js, test/member.test.js, test/smartphone.test.js, test/upgrade.test.js.

상태/스키마전후/조회실패 차단, 전용DB·계정·권한 제한, 선택적ORM, 실제 라우트핸들러+가짜DB 공개 조회·기존소유기기·미공개 신규등록 거부, 가짜저장소33모델2변형 삽입 및 재실행0/0, 원래ID/값 보존을 확인했다. 두번째INSERT 강제실패 시 모의 관리트랜잭션 rollback·commit없음 검증. 실제 MySQL rollback 성공으로 해석하지 않는다. 최초 검색어 누락 테스트 fixture는 수정 후 통과했다.

기존 개발가격/색상 매칭/운영24시간 규칙·보유기기·업그레이드 순수함수 회귀 통과. JSON 원본 해시 보존. 실제 HTTP/MySQL/DDL/collation/동시성/FK/Gemini E2E는 미실행. 격리된 테스트DB 증거가 없어 어떤 DB에도 접속하지 않았다.

다음: 격리 테스트DB·제한 계정·기준16/29 사본 및 백업 확보 → SQL002/003 호환/실제 롤백/동시성/ID·FK/API 검증 → 데이터 운영 검수 및 별도 운영 적재 승인. 신규 데이터를 공개 승인하는 관리자 흐름, 프론트·Gemini 개발가격 연결은 미구현이다. 운영 적용 대기.
