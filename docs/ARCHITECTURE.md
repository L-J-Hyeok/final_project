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
- 이메일은 trim·소문자 정규화 후 형식·254자 이하 검사, 비밀번호는 정규화/trim 없이 8~128자·UTF-8 512바이트 이하. 이메일 UNIQUE. 가입 시 users와 빈 profiles를 한 트랜잭션으로 생성하고 로그인은 별도 수행.
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

## 실제 MySQL 스마트폰 DB 및 개발 가격 Fallback 아키텍처 완성 — 2026-11-11T16:25:00+09:00

### 1. 개발 가격 Fallback 아키텍처 및 안전 경계
- **동작 원칙:** 운영 환경(`NODE_ENV === 'production'`)에서는 24시간 이내 검증된 실시간 판매가(`verified_sale`)만 추천 후보 평가에 사용된다.
- **개발 환경 활성화 조건:** `NODE_ENV === 'development'` AND `ALLOW_DEVELOPMENT_PRICES === 'true'`가 서버 환경 변수로 명시된 경우에만 활성화된다.
- **우선순위 계층:**
  1. `verified_sale`: 24시간 이내의 실시간 유효 판매 관측가 (`price_observations` 테이블)
  2. `reference_sale`: 엄격한 사양 일치(제조사 + 모델명 + 색상 + 저장용량 + RAM)가 확인된 색상별 다나와 수집 참고가
  3. `official_launch`: 제조사 공식 국내 출고가 (`smartphone_variants.launch_price_krw` 또는 출고가 JSON)
  4. `null`: 위 조건 모두 미충족 시 가격 없음 처리
- **DB 무결성 보호:** 개발용 대체 가격 사용 시 `price_observations` 테이블에 가짜 관측치 레코드를 절대 INSERT하지 않는다.
- **추천 이력 보존:** `recommendations` 테이블 저장 시 `observation_id: null`을 허용하며, `price_source`, `development_only: true`, `warning` 문구를 결과 JSON 및 스냅샷에 원자적으로 저장한다. 이력 조회 시에도 당시의 참고 가격과 경고가 그대로 보존된다.

### 2. 마이그레이션 002/003 및 Sequelize 런타임 매핑 안정화
- `db/connection.js`에서 Sequelize 모델 정의 시 `{ extended: true }` 옵션을 기본 활성화하여, 마이그레이션 002/003으로 추가된 `review_status`, `launch_price_krw` 컬럼이 ORM rawAttributes에 포함되도록 개선.
- MySQL 8.0 CHECK 제약조건(`ck_phone_review_verified`, `ck_variant_review_verified`: `verified = 0 OR review_status IN ('legacy', 'approved')`)과의 정합성을 확보하여 테스트 및 운영 중 무단 제약 위반을 원천 방지.

### 3. 공개 상태 게이팅(Publication Gate)
- `product-publication.js`의 `sql(db)` 및 `predicate`는 `s.verified = 1 AND s.is_test = 0 AND s.review_status IN ('legacy', 'approved')`를 강제.
- `GET /smartphones`, `GET /smartphones/:variantId`, `POST /recommendation-candidates`, `POST /recommendations`에서 비공개(pending, held, rejected) 모델의 노출을 차단.
- 보유 기기 등록(`POST /owned-devices`) 시에도 `publicOnly=true`를 통하여 미승인(pending) 변형 등록을 차단.

### 4. 실서버 Gemini Live 연동 아키텍처
- `ai-adapter.js`를 통해 Gemini 3.5 Flash Lite 모델과 JSON 스키마 기반 응답 통신.
- 모델 호출 전후 엄격한 사양·근거 검증(`recommendation-validator.js`)을 거쳐 환각(Hallucination) 및 임의 가격/사양 조작을 100% 차단.
- `.env` 및 API 키는 환경 변수를 통해서만 참조하며, 대화/로그/클라이언트 응답에 원문, 일부 문자열, 해시 노출을 엄격히 금지.

## 스마트폰 모델 중심 추천

공개 자급제 후보를 필수 조건과 가격으로 걸러 전부 평가한다. 카탈로그 모델 ID와 국내 모델번호로 묶고, 서버 순위에서 가장 높은 용량·RAM 구성을 모델별 대표로 확정한다. 최대 3개 대표만 Gemini 설명에 전달하며, 최종 가격·후보 검증은 유지한다. 대표 SKU와 같은 구성의 선택 색상 SKU를 구분한다. 색상을 바꿔도 점수·공통 참고가·링크는 유지하며 RAM이 미확인이면 다른 SKU와 동일 구성으로 추정하지 않는다.

순위 정책 `smartphone-ranker-v2`는 휴대성 선호가 명시되면 무게와 화면 크기를 함께 평가하고 둘 중 적합도가 낮은 쪽을 더 크게 반영한다. 이는 필수 조건을 추가하지 않는다. 저장 공간과 RAM은 용도별 평가 기준에 도달한 이후 추가 점수의 증가 폭이 줄어든다. 이 기준은 사용자 저장 공간 사용량 추정치가 아니며, 명시한 최소 용량은 별도 필수 필터다. 카메라 선호를 별도 저장 공간 가중치로 치환하지 않고 성능 선호에 따른 RAM 가중치 증가 폭을 줄였다. 실측 게임 성능, 촬영 품질, 배터리 사용 시간은 근거가 없으면 불확실성을 표시한다. 가격 점수와 가격 적격 조건은 기존 정책을 따른다.

후속 대화 설계: 신규 추천은 프로필과 자연어에서 예산·용도·필수 조건을 추출한다. 최소 저장 용량을 지정하면 필수 조건으로 적용하며, 모른다고 답하면 프로필·용도·예산을 근거로 서버가 결정한다. 업그레이드는 소유권을 확인한 등록 기기 사양을 우선 사용하고, 부족한 만족도·불편·교체 이유만 질문한다. 저장 공간이 문제라면 실제 사용량을 물을 수 있다. 기존 성능과 근거 있는 체감 개선, 구매 비용, 수리 등 비구매 대안을 고려하며 불만족만으로 교체하지 않는다. KEEP/REPLACE/DEFER/CLARIFY를 유지한다. 두 흐름 모두 기존 응답을 보존하며 정보가 충분하면 추가 질문 없이 진행한다. 다중 턴 상태와 질문 UI는 스마트폰 MVP에 구현했다.

`GET/POST /api/recommendations/conversation`은 로그인 세션과 기존 CSRF를 사용한다. 최초 원문만 기존 구매 분석기로 구조화하고, 이후 응답은 서버가 발급한 질문 ID와 상담 버전으로 검증한다. 서버는 답한 항목만 병합하고 임의의 조건 객체는 받지 않는다. 프로필 버전이 바뀌면 재개하지 않는다. 예산과 필수 조건을 충족하는 실제 용량이 여러 개이고 게임·촬영에 용량이 중요할 때 질문한다. 업그레이드는 소유 기기를 먼저 확인하고 불편이 없고 만족하는 경우 구매 후보 없이 기존 KEEP 검증을 실행할 수 있다.

상담에서 예산 상한 없음은 `hard.budget_unlimited`로 기록한다. 금액 상한만 생략하고 가격의 최신성과 적격성은 검사한다. 검증할 수 없는 필수 조건은 사용자가 구체적인 무게로 바꾸거나 명시적으로 제외할 수 있다. 조건을 유지하면 추천을 중단하고 답변 수정 경로를 제공한다. 서버 순위가 확정된 경우 Gemini 설명의 `status`는 `recommend`이며, 서버는 검증된 근거 코드와 증거를 사용해 표시 문장을 생성한다.

상담은 로그인 세션당 하나, 서버 메모리에 마지막 활동 기준 20분간 유지한다. 새 상담이 이전 상담을 대체하고, 로그아웃 또는 서버 재시작 시 사라진다. 답변 제출·수정 합계는 20회로 제한한다. 중간 질문이나 최초 원문을 추천 이력에 저장하지 않으며 최종 추천은 기존 검증 및 이력 저장 경로를 재사용한다. 서버를 여러 대 운영할 때는 별도의 공유 상담 저장소가 필요하다.

### 스마트폰 실측 근거 저장과 비교

`smartphone_performance_measurements`는 스마트폰 모델과 선택 SKU에 실측값, 단위, 시험 이름·버전·조건·기기 설정, 출처, 측정일·확인일, 검증 상태를 연결한다. 내부 등록 경로는 국내 모델번호와 SKU 소속을 확인한다. 시험 식별자는 지표·단위·시험 버전·조건·설정·출처를 포함하고, 제품 범위·출처 URL·측정일을 더한 관측 키는 중복을 막는다. 검증 상태가 verified인 행만 조회하고 동일 시험 식별자끼리 원본 수치를 나란히 제공한다. 특정 SKU의 자료는 다른 SKU에 공유하지 않는다.

추천 API는 서버 순위 확정 후 선택된 후보에만 검증 근거를 첨부하고, 검증된 보유 기기가 있으면 비교 가능 여부도 반환한다. 기존 순위와 교체 판단은 그대로 동작하며, 테이블이 아직 없거나 데이터가 비어 있으면 기존 응답 형식을 사용한다. `node db/migrate-performance.js --apply <database-name>`은 명시적으로 지정한 DB에 추가 테이블을 생성한다.

향후 범용 측정 계층은 출처·이용 허용 범위, 관측 이력, 시험 정의, 검증 상태, 정규화된 값·단위, 시험 호환 판정을 공유한다. 시험에서 통제한 조건과 기기별 실제 설정·OS·하드웨어를 별도 필드로 관리하고 호환 규칙을 시험별로 버전 관리한다. 두 번째 카탈로그가 추가될 때 공통 제품·SKU 참조를 실제 외래 키로 연결하고, 스마트폰 관측의 원본 ID와 출처를 보존해 이관한다. 제품군별 점수 모듈은 공통 추천 흐름에서 선택하도록 분리한다. 현재 `smartphone-ranker-v2`는 스마트폰 전용 함수이며, 제품군별 모듈을 선택하는 공통 진입점은 후속 설계다.

| 제품군 | 평가 모듈의 주요 지표 |
| --- | --- |
| 스마트폰 | 게임·촬영·휴대성·배터리 |
| 태블릿 | 생산성·필기·성능·배터리 |
| 노트북 | CPU·GPU·발열·전력·휴대성 |
| 스마트워치 | 센서·배터리·운동 추적 |
| 무선이어폰 | ANC·음질·지연·배터리 |
| 스피커 | 음질·출력·연결성 |

7-4단계에서 게임·성능 우선 요청의 CPU/GPU 실측 입력을 서버 순위에 연결했다. 예산과 필수 조건을 통과한 모든 구성에 공통으로 적용되는 검증 시험만 사용한다. 시험별 최고값으로 나눈 상대 점수를 구하고, 사용할 수 있는 CPU·GPU 점수의 평균을 기존 RAM 평가와 절반씩 반영한다. 지표별 시험 하나를 결정적으로 선택한다. 공통 시험이 없으면 기존 v2 점수를 그대로 계산한다. 업그레이드의 교체 여부는 기존 로컬 정책으로 결정하며 구매 후보 응답에 같은 시험의 보유 기기 비교를 첨부한다. 가격은 다음 정상 관측이 들어올 때까지 기존 참고 가격을 사용한다.

성능 처리의 공통 경계는 제품·구성 식별, 시험 호환성, 검증 자료로 제한한다. 스마트폰은 첫 MVP이며 추후 태블릿·노트북·워치·이어폰·스피커·PC 부품별로 지표와 점수 정책을 선택한다. 기기 실측, 같은 칩셋의 CPU/GPU 참고값, 사양 기반 보조 평가, 자료 없음을 구분한다. 칩셋 참고값으로 기기 발열·배터리·카메라를 평가하지 않으며 PC-FIT 호환성은 별도 로컬 규칙으로 처리한다. 현재 점수 경로에는 검증된 기기 실측만 연결되어 있다.

Google 공개 문서상 현재 Gemini 모델은 Search Grounding을 지원한다. 검색 응답을 추출하여 별도 랭커의 점수 입력으로 이용하는 권한이 확인될 때까지 검색 어댑터·캐시·저장은 보류한다. Gemini의 현재 요청 분석과 추천 설명은 기존 경로를 사용한다.

### 7-5 성능 평가 파이프라인

추천 요청이 카탈로그·가격·예산을 통과하면 검증된 DB 측정과 승인된 외부 근거를 조회한다. 서버 환경 변수 `PERFORMANCE_SOURCE_FILE`은 운영자가 검수한 JSON 배열 파일을 가리킨다. 각 항목에는 `category`, `kind`, `dimension`, `model`, `domestic_model_number`, `chipset`, 선택적 `variant_id`, `url`, `source_name`, `rights_reference`, `allow_rank_use`, `reviewed_value`, `unit`, `method_name`, `method_version`, `test_conditions`, `device_settings`, `measured_on`, `checked_on`을 넣는다. 칩셋 참고 자료는 제품명·국내 모델번호 대신 정확한 칩셋으로 연결하며 CPU·GPU에 한정한다. 지표 키는 `cpu_single`, `cpu_multi`, `gpu`, `gaming_fps`, `sustained`, `camera_photo`, `camera_video`, `battery_runtime`이다. 서버 등록 URL 조회가 성공하고 구조화 값이 검수값과 일치해야 사용한다. 요청당 최대 8개 URL·24개 항목을 한 번 호출한다. 외부 원본·추출값은 즉시 응답에만 제공하며 성능 DB·추천 이력·상담 복원 상태에 쓰지 않는다.

시험별 점수는 동일 시험 최고값 대비 비율이며 해당 시험이 있는 모든 적격 구성에서만 활성화한다. CPU·GPU·게임 결과는 기존 RAM 지표에 절반을 반영한다. 사진·영상 실측은 촬영 우선 요청에서 15%를 배정하고, 배터리 실측은 용량 점수와 절반씩 반영한다. 소형 선호 시 모든 후보의 실측 외형 규격이 있으면 무게·화면 기반 휴대성의 20%를 상대 부피로 보완한다. 폴더블은 접은 규격을 우선한다. 비교 가능한 실측과 가격이 확보되면 가격 지표의 25%를 비가격 종합점수/기존 참고 가격으로 반영한다. 카메라 사양은 참고 정보이며 화질 실측으로 변환하지 않는다.

업그레이드는 기존 로컬 만족도·불편·예산 정책에 동일 시험 기기 실측 비교를 더한다. 해당 불편 분야의 비교 지표 중 10% 이상 개선이 하나 이상 있고 비교 가능한 지표의 하락이 없을 때 객관적 개선을 인정한다. 칩셋 참고값은 이 판단에서 제외한다. URL 서비스는 제품군·제품 식별자와 지표를 입력으로 받으며 스마트폰 외 제품군의 카탈로그와 평가 모듈은 후속 범위다. PC-FIT 호환성 검사는 별도의 서버 규칙을 적용한다.

### 7-6 요청 시 성능 자료 자동 탐색

`performance-discovery.js`는 제품군·카탈로그 제품·필요 지표를 입력으로 받는다. 스마트폰 배터리 조회는 [FixIndex 공개 JSON과 이용 조건](https://fixindex.eu/data/)을 사용한다. 제조사·모델명으로 [EPREL](https://energy-efficient-products.ec.europa.eu/product-list/smartphones-and-tablets_en) 등록을 찾고 등록번호로 공개 제품 정보 PDF를 구성한다. Gemini URL Context에서 PDF 본문 조회, 국내 카탈로그와 동일한 규제 모델번호, 원본 단위 및 JSON 공개 수치와의 일치를 모두 확인한다. 시험지의 정수 시간만 분으로 환산하며 미공개 측정일은 NULL로 유지한다. 응답에 원본과 데이터 이용 조건을 포함한다.

사용 목적·선호·교체 불편에서 관련 지표를 선택하며 외부에는 사용자 원문을 전송하지 않는다. 수동 승인 파일 `PERFORMANCE_SOURCE_FILE`은 보조 경로로 유지한다. 요청당 12초, 최대 8개 URL·24항목을 단일 Gemini 호출로 처리하며 서비스 동시 조회는 2건이다. Gemini 429에는 60초간 외부 조회를 건너뛴다. 실패 시 로컬 자료와 기존 점수로 진행한다. 측정값은 해당 응답에서만 사용한다.

해당 분야의 동일 시험이 전체 적격 구성에 적용될 때 점수에 반영한다. 동일 조건의 기기 실측 시험을 칩셋 참고 시험보다 우선한다. 업그레이드는 보유 기기와 후보의 동일 시험 기기 실측만 사용한다. 공급자 조회와 자료 구조는 공통 경계로 두며 충전·배터리·열·호환성 등 제품군별 평가 정책은 별개다. 현재 자동 공급자는 스마트폰 배터리에 연결되어 있다.

### 7-7 부분 실측에 대한 점수 보정

전체 적격 구성이 동일 시험을 공유하면 기존 반영 방식을 적용한다. 해당 분야의 완전 비교가 없으면 같은 시험에서 두 모델 이상이 측정된 자료를 고른다. 기기 실측을 우선하고 시험 호환 키가 다른 집단은 합산하지 않는다. 각 관측을 시험 최고값으로 나누고 모델별 상대값 평균을 빼며, 전체 모델에서 측정 모델이 차지하는 비율을 곱한다. 여기에 해당 분야 가중치의 절반을 적용하고 모든 부분 보정의 합을 ±0.025로 제한한다. 미측정 구성의 기존 점수와 가격 점수는 그대로다. 같은 색상 구성이 많아도 시험 평균에는 영향을 주지 않는다.

요청의 자동 URL은 최대 세 개다. 업그레이드에서는 확인 가능한 기존 기기 URL을 우선하고, 남은 URL은 날짜에 따라 순환한다. 점수 계산은 여전히 모든 적격 구성에 적용한다. 칩셋 CPU·GPU 비교는 업그레이드의 참고 설명에 사용하고, 기기 성능이나 지속 성능 향상의 판정 근거는 동일 시험의 기기 실측을 사용한다.

### 7-8 칩셋 참조값 식별

`chipset-performance.js`는 제조사에서 확인한 동등 표기만 같은 키로 해석한다. GPU 코어 또는 CPU 구성이 다른 Apple 칩은 국내 모델 식별자로 구분하고, 구성 확인이 필요한 이름만 있는 측정치는 제외한다. Galaxy S25 FE SM-S731N의 Exynos 2400e 원본 표기는 벤치마크 매칭에서만 제조사가 확인한 Exynos 2400으로 처리한다. 카탈로그 DB 원본과 기기 실측의 모델번호 검증은 유지한다.

같은 시험과 출처에서 중복된 칩셋 별칭은 한 번만 조회한다. Geekbench GPU는 원본의 Metal·Vulkan·OpenCL을 확인하고 비교 키에 포함한다. 업무·코딩·가성비 선호도 CPU·GPU 자료를 요청하며 게임 FPS·지속 시험은 성능/게임 목적에서 요청한다. 동등 시험에 대한 v2 점수와 부분 실측 ±0.025 한도는 유지한다. 출처 조건을 확인한 자료는 제품군별 실제 구성과 대응해야 하므로 PC 부품·태블릿 등에도 같은 조회 및 비교 경계를 재사용할 수 있다.

### 7-9 성능 조회와 팀 인계

서버가 공개 후보를 고르고 허용된 피드에서 원본 URL을 찾은 뒤 Gemini URL Context로 읽는다. 서버가 수치·단위·제품 식별자·시험을 대조하고 순위와 업그레이드 여부를 확정한다. Gemini 설명은 추천 대상·순위·가격을 바꿀 수 없다. 외부 수치와 비교는 즉시 응답에 한해 제공하며 이력 및 상담 복원은 원본 수치를 보관하지 않는다. Search Grounding은 사용자에게 검색 결과와 검색 제안을 함께 보여주는 기능이며 현재 추천 화면에 연결하지 않았다. 별도 랭커용 URL·수치 추출에는 이용하지 않는다. [Gemini 이용 조건](https://ai.google.dev/gemini-api/terms)

URL 조회 예산은 12초, 자동 URL은 최대 3개로 유지한다. Gemini 호출 타이머는 응답 본문 읽기까지 적용한다. 설명과 최대 한 번의 검증 재시도는 요청 시작 기준 45초 예산에서 남은 시간을 공유한다. 필수 DB 처리와 응답 전송은 이 AI 예산 밖에서 마무리할 수 있다. 성능 조회가 Gemini 429를 반환하면 해당 요청은 재호출 없이 서버 설명으로 완료한다. 성능 조회 쿨다운은 기존 60초다.

#### 팀 실행 절차

- macOS·Windows에서 동일한 프로젝트 Node 버전으로 맞춘다. 현재 검증 환경은 Node 26과 MySQL 8.0.16 이상 8.0.x다. `backend`에서 `npm ci`, `npm run db:check`, `npm start`를 실행한다. 별도 터미널의 `front`에서 `npm ci`, `npm run serve`를 실행한다. Vue 기본 주소는 `http://127.0.0.1:8080`이고 API 프록시는 `127.0.0.1:3000`이다. Windows에서 실행 정책이 `npm.ps1`을 차단하면 CMD 또는 `npm.cmd`를 사용한다.
- 실제 값은 팀원별로 설정한다. `backend/.env.example`을 기준으로 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, 32바이트 이상의 `SESSION_SECRET`, 브라우저 주소와 동일한 `APP_ORIGIN`을 지정한다. 오프라인은 `AI_PROVIDER=mock`으로 실행한다. 실제 호출은 `AI_PROVIDER=gemini`, 서버 측 `GEMINI_API_KEY`, 선택적인 `GEMINI_MODEL`을 사용한다. 기본 포트의 변경이 필요한 경우 `PORT`와 Vue 프록시를 함께 검토한다. `ADMIN_EMAILS`와 선택적인 `PERFORMANCE_SOURCE_FILE`은 서버 프로세스 환경에 주입한다. 현재 자동 로더의 허용 목록에는 이 두 항목이 없다.
- 신규 로컬 DB는 비어 있는 전용 스키마를 만든 후 `npm run db:migrate`로 001을 적용한다. 현재 운영과 동일한 확장 스키마가 필요하면 검토된 SQL 또는 승인된 스키마 사본으로 002·003, 필요한 관리자 작업용 004와 판매처별 가격 확장용 005를 준비한다. 초안은 기존 DB에 자동 적용하지 않는다. 성능 테이블은 `node db/migrate-performance.js --apply <대상_DB명>`으로 추가한다. `node scripts/seed-verified-smartphones.js`로 먼저 검증용 시드를 확인하고 전용 개발 DB에서만 `--apply`한다. 기본 시드 범위는 16모델·29옵션이다. 44모델과 참고 가격까지 필요한 팀원은 승인된 제품·가격 사본을 별도로 사용한다.

#### HTTP 계약

| 영역 | 권한과 경로 |
| --- | --- |
| 공개 카탈로그 | `GET /api/health/db`, `GET /api/smartphones`, `GET /api/smartphones/:variantId`. 카탈로그 목록은 페이지 커서를 사용한다. |
| 인증 | `GET /api/auth/csrf`, `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` |
| 로그인 사용자 | `GET/PUT /api/profile`, `GET /api/owned-device-options`, `GET/POST /api/owned-devices`, `PUT/DELETE /api/owned-devices/:id`, `GET /api/upgrade-offer`, `PUT /api/upgrade-offer/state` |
| 상담·추천 | `POST /api/analysis`, `POST /api/recommendation-candidates`, `POST /api/recommendations`, `GET/POST /api/recommendations/conversation`, `GET /api/recommendations`, `GET /api/recommendations/:id` |
| 관리자 | `GET /api/admin/session`, `GET /api/admin/candidates`, 상세 및 해당 후보의 `review`·`register` 경로. 서버가 관리자 권한을 확인한다. |

세션 쿠키를 유지하고 JSON 변경 요청에는 `X-CSRF-Token`을 전달한다. 로그인 성공 응답에서 갱신된 토큰을 사용한다. 카탈로그 보유 기기 등록 본문은 `{"variant_id":"…"}`다. 가입 후 프로필을 확정하고 GET 응답의 버전을 다음 변경·추천 요청에 사용한다.

직접 추천의 예시 본문은 `{"expected_profile_version":2,"hard":{"budget_max_krw":1500000,"usages":["gaming"],"min_storage_gb":256,"allowed_brands":["samsung"]},"soft":{"priorities":["performance"]}}`이다. 필수 제조사는 `hard.allowed_brands`, 선호는 `soft.preferred_brands`다. 예산 무제한은 `hard.budget_unlimited:true`로 보내고 예산 상한을 함께 보내지 않는다. 업그레이드는 본인 `replacement_device_id`와 `purchase_reason`, `upgrade_context`를 추가한다. 교체 의향 값은 `high`, `moderate`, `low_or_keep_if_okay`다.

추천 응답은 `data.status`로 `recommend`·`no_match`·`clarify`·`keep`·`defer`를 구분한다. 업그레이드 교체 판단은 `recommend`다. `items[].product`에 모델·용량·RAM, `items[].color_options`에 동일 구성의 색상 SKU, `items[].price`에 참고 가격·출처·관측 시각·다나와 URL이 있다. `performance_source_status`는 자료 조회 상태이고, 채택한 지표의 실제 수치는 해당 카드의 `performance_evidence`에서 확인한다.

상담은 `{"action":"start","mode":"purchase","text":"…"}`로 시작한다. 업그레이드는 `mode:"upgrade"`와 본인 `replacement_device_id`를 보낸다. `data.conversation.questions`의 질문에 `action:"answer"`, `id`, `revision`, `question_id`, `answer`로 응답한다. `resume`은 현재 `id`·`revision`을 사용한다. 초안은 세션별 서버 메모리에 있으며 만료 기준은 20분이다. 종료 후 새로운 상담을 시작할 수 있다.

오류 본문은 `error.code`와 `error.message`다. 401은 로그인 필요, 403은 CSRF 또는 관리자 권한, 404는 대상 미존재 또는 소유권 불일치, 422는 입력 형식 오류다. 409의 `PROFILE_CHANGED`는 프로필 새로 조회, `CONVERSATION_CHANGED`는 상담 상태 새로 조회, `CONVERSATION_EXPIRED`는 상담 재시작, `CANDIDATES_CHANGED`는 후보 재조회가 필요하다. 429는 `Retry-After`를 따른다. 외부 자료만 실패하면 추천 자체는 사양 기반으로 진행한다.

제품 정보의 제출 양식과 승인 절차는 [데이터 수집 표준](PRODUCT_DATA_COLLECTION_STANDARD.md)을 따른다. 판매가는 기존 `price_observations` 공급 경로로 들어오며, 승인된 모델·용량·RAM의 마지막 정상 참고 관측치를 사용한다. 성능은 검수한 기기 관측을 `smartphone-performance.js`의 내부 등록 경로로 입력하거나, 이용 조건이 확인된 원본을 설정해 요청 내에서 검증한다. 공개 성능 입력 API와 제품 CSV 자동 등록은 현재 제공 범위 밖이다.

## 8-1 공통 제품 카탈로그

스마트폰은 기존 `smartphones`, `smartphone_variants`, `price_observations`를 공통 DTO로 읽는다. `catalog_models`는 스마트폰을 별도로 등록할 수 없게 한다. 공통 API의 식별자는 `category`와 `model_id` 또는 `sku_id`를 함께 사용한다. 스마트폰 ID는 기존 모델·변형 ID와 동일하다. 보유 기기 및 추천 이력의 기존 FK와 API는 유지된다.

007은 `catalog_categories`, `catalog_models`, `catalog_skus`, `catalog_price_groups`, `catalog_price_observations`, `catalog_admin_events`를 추가한다. 모델에는 브랜드·모델번호·출시일·무게·공식 링크·출처와 공개/판매/검증 상태를, SKU에는 옵션 식별자·제조사 부품번호·용량·RAM·색상·연결 방식을 둔다. 모델의 `specs_json`과 SKU의 `options_json`은 제품군별 허용 키와 타입을 서버에서 검증한다. SQL은 JSON 객체, 모델과 SKU의 중복 방지, 복합 FK 및 공개 상태 제약을 강제한다.

| 제품군 | 모델 사양 | SKU의 대표 옵션 |
| --- | --- | --- |
| 스마트폰 | 기존 칩셋·화면·카메라·배터리·무게 및 상세 사양 | 기존 용량·RAM·색상 |
| 태블릿 | 칩셋·화면·펜·배터리 | 저장 용량·RAM·Wi-Fi/셀룰러·색상 |
| 노트북 | CPU·GPU·화면·배터리(Wh) | CPU·GPU·RAM·저장 용량과 종류·화면 구성 |
| 스마트워치 | 센서·GPS·배터리·방수·호환 OS | 케이스 크기·재질·밴드·연결 방식·색상 |
| 무선이어폰 | ANC·코덱·지연·배터리 | 색상·연결 방식 |
| 스피커 | 출력·오디오 포맷·크기·전원 방식 | 색상·연결 방식·오디오 구성 |

새 제품군의 참고 가격은 같은 통화의 정상 관측치 중 가장 최근 행을 사용한다. 모델 단위 가격은 모델 상세에만 반환한다. SKU에는 해당 SKU의 관측치 또는 명시적으로 연결한 가격 그룹을 적용한다. 그룹 연결에는 공유 근거 URL과 확인된 비색상 옵션의 동일 지문이 필요하다. 신규 수집기가 없으며 가격의 출처, 실제 관측·확인 시각 및 이력을 보존한다.

| 공개 GET | 동작 |
| --- | --- |
| `/api/catalog/categories` | 고정 6개 제품군 코드와 표시명 |
| `/api/catalog/:category/models` | 모델 목록·사양. `q`(모델명 또는 모델번호), `brand` 필터 |
| `/api/catalog/:category/models/:modelId` | 모델 공통 정보·제품군 사양·출처 및 모델 단위 `reference_price` |
| `/api/catalog/:category/models/:modelId/skus` | 공개 SKU·옵션 및 SKU/그룹 참고 가격 |

목록과 SKU 조회는 `limit` 기본 30, 최대 100, `sort=id_asc|id_desc` 및 `after=<next_cursor>`를 받는다. 정렬과 필터를 유지해 다음 페이지를 요청한다. 상세와 SKU는 `currency`로 통화를 선택할 수 있으며 기본값은 `KRW`다. 참고 가격은 `amount_minor`(문자열), `currency`, `product_url`, `seller_name`, `observed_at`, `checked_at`, `scope`, `label`을 반환한다. 예를 들어 제품 데이터가 없는 태블릿의 목록은 007 적용 후 `{"data":[],"next_cursor":null}`, 개별 가격이 없으면 `"reference_price":null`이다. 미공개·미검증 대상 상세는 404, 입력 형식 오류는 422다.

공개 모델과 SKU는 모두 검증 완료가 필요하며 테스트 모델은 제외한다. 기존 관리자 권한은 `requireAdmin`으로 확인한다. 공통 쓰기 경로를 연결하는 후속 단계에서는 검증 훅이 실행되는 Sequelize 인스턴스 작업과 승인·감사 기록을 같은 트랜잭션으로 묶는다. 감사 기록은 사용자·모델·선택 SKU를 참조한다. 8-1에서는 조회 라우트와 감사 저장 구조를 제공한다.

팀 개발 DB에 적용할 때 001 및 기존 스마트폰 확장 여부를 먼저 확인하고 백업한 후, `backend`에서 `node db/migrate-catalog.js --apply <대상_DB명>`을 실행한다. 명령은 실제 연결 DB명이 다르면 중단한다. 기존 DB에 007을 적용하지 않은 상태에서도 제품군 목록과 스마트폰 읽기 경로는 사용할 수 있다. 나머지 제품군 요청은 테이블을 만들기 전까지 503이다.

## 8-2 제품 등록과 공통 비교

`GET /api/catalog/:category/compare?items=<modelId>:<skuId>,<modelId>:<skuId>`는 동일 제품군의 서로 다른 SKU 선택 2~3개를 요청 순서대로 비교한다. 한 모델의 용량·색상·GPU 옵션도 비교할 수 있다. 선택마다 모델·SKU 관계와 공개 상태를 확인한다. 잘못된 관계·비공개 SKU는 404, 같은 선택 중복·개수 오류는 422다. `currency`의 기본값은 KRW다.

응답의 `data.items[].model`과 `data.items[].sku`에는 모델 사양과 실제 옵션, 출처·확인 상태, SKU 단위 참고 가격이 들어간다. 가격이 확인된 경우 같은 가격 객체에 상품 링크, 관측 시각, `price_source`가 포함된다. 예를 들어 실제 iPad 비교 요청은 `/api/catalog/tablet/compare?items=1:1,1:2`이며 `data.fields`의 저장 용량 항목은 `{"key":"storage_gb","values":[128,256],"has_unknown":false,"higher_sku_ids":["2"]}`다. 값이 없으면 `null`과 `has_unknown:true`를 쓴다. 수치 우세 표시는 직접 비교할 수 있는 용량·RAM으로 제한한다. 사진 품질, 배터리 시간이나 가격을 임의로 환산해 우위를 표시하지 않는다.

팀원은 `backend/data/common-catalog-verified-8-2.json`과 같은 구조로 모델·정확한 국내 SKU 및 출처를 정리한다. `backend`에서 `node scripts/import-common-catalog.js <입력.json>`을 실행하면 입력 검증만 수행한다. 백업과 대상 확인 후 `--apply <대상_DB명>`을 붙이면 공통 테이블 안에서 한 트랜잭션으로 반영한다. 동일 입력을 재실행하면 새 행이 생기지 않으며, 기존 행과 충돌하는 데이터는 전체 배치에서 롤백한다. 제품 수정·승인 전환은 후속 관리자 경로에 맡긴다.

공개 가격 입력은 업체별 일반 판매 상품에서 독립적으로 확인한 제조사·모델번호·SKU 식별자·용량·RAM·색상·연결 방식·구성을 대조한다. 신품·국내 판매·일반 구매·판매 가능·저장/표시 권한과 그 근거를 기록한다. 다나와는 공개 상품 상세 `pcode` URL만 받고, 상품명에서 부적합 판매 조건을 추가 검사한다. 이 검증은 입력을 점검하며 공급처의 이용 권한을 부여하지 않는다. 스크립트가 외부 URL을 열거나 예약 수집을 수행하지 않는다. 정상 관측치와 확인 시각은 이력으로 남고, 기존 스마트폰 관측치는 그대로 사용한다.

## 8-2.5 조원 제품 데이터 통합 및 다나와 가격 연동

- [`teammate-catalog-converter.js`](../backend/services/teammate-catalog-converter.js)는 조원 프로젝트(`pc_final-main/backend/src/data/products.json`, 99모델·120 SKU)를 읽어 공통 카탈로그 규격으로 정규화한다. 기존 스마트폰 카탈로그(53모델·352 SKU)를 보존하기 위해 스마트폰 30모델·43 SKU를 제외하고, 오디오 20모델 중 지원 범위 밖인 오버이어 헤드폰 8모델·8 SKU를 제외한 무선이어폰 12모델·12 SKU만 분류한다. 기존 8-2 등록 모델과 중복되는 `iPad (A16)`(`A3354`) 및 `Galaxy Buds3`(`SM-R530`) 2모델·2 SKU는 기존 모델·SKU ID와 검증 사양을 우선 유지하고, 신규 **59모델·67 SKU**(태블릿 18모델·26 SKU, 노트북 20모델·20 SKU, 스마트워치 10모델·10 SKU, 무선이어폰 11모델·11 SKU)를 추가한다.
- [`catalog-danawa-matcher.js`](../backend/services/catalog-danawa-matcher.js) 및 [`prepare-teammate-catalog-8-2-5.js`](../backend/scripts/prepare-teammate-catalog-8-2-5.js)는 신규 5개 제품군 전체(64모델·77 SKU)에 대해 제조사·모델번호·저장 용량·RAM·연결 방식(Wi-Fi/셀룰러, Bluetooth/GPS/LTE)·케이스 크기·CPU/GPU 코어 구성 및 국내 정품 신품 조건을 대조하여 다나와 참고 가격과 상세 상품 URL(`https://prod.danawa.com/info/?pcode=...`)을 매칭한다. 중고·리퍼·해외직구·번들·액세서리 및 출고가 대비 비정상 품절 할증가(>150%)나 저가(<30%)는 제외하고 가격을 `null`로 유지한다.
- 생성된 통합 파일 [`common-catalog-teammate-8-2-5.json`](../backend/data/common-catalog-teammate-8-2-5.json)은 기존 `node scripts/import-common-catalog.js data/common-catalog-teammate-8-2-5.json [--apply final_project]`로 검증·적용하며, 재실행 시 중복 생성 없이 `{models:0,skus:0,prices:0}`을 보장한다.

## 8-3A 범용 AI 추천 엔진 (태블릿·노트북·스마트워치·무선이어폰·스피커)

- 기존 스마트폰 추천(`smartphone-ranker-v2`, `smartphones`, `smartphone_variants`, `price_observations`)은 수정 없이 그대로 유지하며, 신규 5개 제품군(`tablet`, `laptop`, `smartwatch`, `earbuds`, `speaker`)은 [`catalog-recommendation-engine.js`](../backend/services/catalog-recommendation-engine.js)를 통해 공통 파이프라인(`요구사항 정규화 → 공개 검증 모델·SKU 및 최신 정상 가격 조회 → 필수 조건·OS 호환성 필터링 → 제품군별 로컬 점수화 → 모델별 최적 대표 SKU 최대 3개 선정 → Gemini 추천 설명 및 서버 폴백`)으로 처리한다.
- **API 계약:**
  - `POST /api/analysis`: `purpose="purchase"` 요청 시 선택적 `category` 입력 또는 자연어 문맥 감지를 통해 6개 제품군 코드(`draft.category`)와 제품군별 필수 조건(`require_pen`, `require_keyboard`, `require_anc`, `require_cellular`, `require_water_resistance`, `require_gps`, `require_discrete_gpu`, `compatible_os`, `min_ram_gb`, `min_storage_gb`, `max_weight_g`, `min_refresh_hz`) 및 제조사(`samsung`, `apple`, `lg`, `lenovo`, `asus`, `sony`, `bose`, `sennheiser`, `jbl`)를 추출한다.
  - `POST /api/recommendations` (요청 본문 `category` 지정) 및 `POST /api/catalog/:category/recommendations`, `POST /api/catalog/:category/recommendation-candidates`: `category`가 생략되거나 `"smartphone"`이면 기존 스마트폰 추천 엔진을 실행하고, 신규 5개 제품군이면 제품군별 랭커(`tablet-ranker-v1`, `laptop-ranker-v1`, `smartwatch-ranker-v1`, `earbuds-ranker-v1`, `speaker-ranker-v1`)를 실행한다.
- **가격·근거·안전성 규칙:**
  - `catalog_price_observations`의 정상 참고 가격이 없는 SKU(미수집 21개 SKU)는 예산·가성비 기반 추천 후보에서 제외하며(`missing_price_policy: 'excluded_from_budget_and_value_evaluation'`), 출고가 대체나 임의 가격 생성을 금지한다.
  - 스마트워치는 `compatible_os` 기준(`ios` → Apple Watch, `android` → Galaxy Watch)으로 호환 불일치 후보를 엄격히 제외한다.
  - 후보가 3개 미만인 제품군(예: 스피커 `JBL Flip 7` 1모델·2색상 SKU)은 가능한 개수(1개)만 추천하고 동일 사양의 색상 SKU는 `color_options`로 묶어 모델 중복 추천을 방지한다. 내부 점수나 가중치 수치는 응답에 노출하지 않는다.

## 8-3B 범용 보유 기기·업그레이드 판단 엔진

- **보유 기기 구조(무스키마 변경)**: 기존 `owned_devices` 테이블의 `variant_id`는 스마트폰 전용 외래키로 보존하고, 신규 5개 제품군(`tablet`, `laptop`, `smartwatch`, `earbuds`, `speaker`)은 `variant_id=NULL`과 `manual_specs_json._catalog_ref`(`catalog_model_id`, `catalog_sku_id`) 및 `_device_meta`(`purchase_price_krw`, `purchase_date`, `pain_points`, `usages`)를 통해 공통 카탈로그 ID와 스마트폰 ID를 혼동 없이 분리 저장한다.
- **서버 업그레이드 결정([`catalog-upgrade-advisor.js`](../backend/services/catalog-upgrade-advisor.js))**: 동일 제품군 내에서 보유 기기와 적격 후보의 확인된 사양만 비교하여 서버가 `upgrade_decision` (`REPLACE` / `KEEP` / `DEFER` / `CLARIFY`, DB `status`: `recommend` / `keep` / `defer` / `clarify`)을 확정한다.
  - CPU/칩셋 모델명이나 출시 연도만으로 임의 성능 향상률을 생성하지 않으며, 배터리 정격 용량(`mAh`/`Wh`)과 사용 시간(`battery_hours`)은 동일 단위끼리만 비교한다.
  - 보유 기기 구매가(`purchase_price_krw`)와 후보의 현재 다나와 참고 가격(`reference_price`)을 구분하고, 미확인 중고 판매가는 차감하지 않는다(`resale_value_estimated: false`).
  - 보유 기기와 동일한 모델 또는 동일 SKU로의 교체는 `SAME_MODEL_OR_SKU_AS_OWNED`로 제외하며, 미수집 가격 후보만 존재하거나 검증 가능한 사양 개선이 없으면 `DEFER`, 보유 기기 사양/목적 정보가 부족하거나 타 제품군 기기가 전달되면 `CLARIFY`를 반환한다.
