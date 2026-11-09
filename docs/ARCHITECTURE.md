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
- 유효기간: observed_at부터 **24시간 미만**, 즉 observed_at <= now < expires_at=observed_at+24시간. 미래 시각·배송비 미확인·재고 없음·중고·통신사 조건은 제외.
- 판매처+옵션+출처별 최신 관측을 먼저 고른 후 유효한 행 중 최저 총액 선택. 최신이 품절/만료면 그 판매처의 과거 저가로 되돌아가지 않음. 다른 판매처의 유효 가격은 사용 가능.
- 추천 완료 직전 선택 가격의 최신성·유효기간 재검증. 변경되면 결과를 버리고 409 CANDIDATES_CHANGED. 이력은 당시 가격을 유지하되 현재 만료 여부를 표시하며 “현재 최저가”라고 부르지 않음.
- TechSpecs·다나와 권한은 여전히 미확보. 초기 시험 자료는 is_test=true로 분리하고 production 후보에서 항상 제외. 검증한 실제품 자료의 출처·사용 권리 확인 전 실서비스 데이터로 승격하지 않음.

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

일반 추천 엔진, 다제품군 EAV, 관리자 UI, 수집 자동화, 실시간 가격 조회, 범용 호환 엔진, PC-FIT 통합은 만들지 않는다. PC-FIT의 실제 코드·Supabase 스키마·권리 검증과 MySQL 이전은 스마트폰 이후다. [TechSpecs·가격 공급](PROJECT_OVERVIEW.md)의 권리 미확정 상태는 유지한다. 테스트 계약은 [TEST_PLAN.md](TEST_PLAN.md), 보안·Taste 제한은 [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md)를 따른다.

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

현 환경: Express 4.16.4, MySQL 실행 파일 8.0.45 확인. 기본 3306 리스너·기본 소켓은 확인되지 않았고 DB 환경 변수도 미설정. sequelize/mysql2 미설치로 실제 접속·DDL·모델 런타임은 미검증이다. 필요한 패키지는 보고만 했고 설치하지 않았다. 실행 안내는 backend/db/README.md에 있다.
