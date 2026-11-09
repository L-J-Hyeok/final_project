# 현재 상태 및 인수인계

최신 상태: 2026-11-10 01:16:00 KST — 보유 스마트폰 출시 3년 경과 기반 개인화 업그레이드 제안(`GET /api/upgrade-offer`, `PUT /api/upgrade-offer/state`), 보유 기기 대비 객관 비교 및 현 기기 유지(`status: 'keep'`) 추천, 다중 IT기기 확장 정책 구조 구현 완료. 백엔드 전체 회귀 테스트 32/32(Live 포함 33/33) 통과. 프론트엔드(Vue 3) 개발에 필요한 모든 백엔드 API 준비 완료.

- 마지막 작업: **2026-11-10 01:16:00 KST**.
- 작업 도구 전환: Codex Desktop → **Google Antigravity**.
- Codex Desktop: 8테이블 마이그레이션 및 DB·HTTP 통합 검증 완료.
- 기준: ARCHITECTURE.md 및 DECISIONS.md D-013~D-026. Express 4.16.4·MySQL 8.0.16+ 유지.

## 구현 상태

- users, sessions, profiles, smartphones, smartphone_variants, price_observations, owned_devices, recommendations의 SQL과 모델 작성.
- FK/UNIQUE/NOT NULL/CHECK, 환경 변수 설정·연결 풀·버전 확인·안전한 오류 코드 구현.
- DB 연결 성공 후 HTTP 시작. GET /api/health/db는 연결 성공 200, 실패 503.
- 기존 빈 DB에만 명시적 마이그레이션 적용. DB 자체 생성·sync·삭제·추가 메타 테이블 없음.
- MySQL DDL 부분 실패는 삭제 없이 중단하고 생성된 테이블을 보고한다.
- 실행 안내: backend/db/README.md. 인증·세션 store·CRUD·추천 기능은 아직 미구현.

## 환경 및 검증

- Node v26.3.0, 설치 Express 4.16.4, MySQL 명령 버전 8.0.45 확인.
- sequelize·mysql2 미설치. 필요한 패키지를 보고했으며 설치·의존성/잠금 파일 변경 없음(package.json은 실행 명령만 추가).
- 현재 프로세스 DB 환경 변수 없음. 기본 3306 리스너와 기본 소켓 2개를 찾지 못함. 다른 포트·원격 DB 상태는 미확인.
- node --test test/db.test.js: 7/7 통과(설정·버전·오류 은폐·모의 마이그레이션·health 핸들러).
- JS 8파일 구문 검사 통과. 모델 수정 중 발견한 문법 오류는 수정 후 재검증.
- db/check.js 및 bin/www: DB_CONFIG_INVALID로 실패 종료. 가짜 접속 환경 변수의 check: DB_DEPENDENCY_MISSING으로 실패 종료.
- 실제 MySQL 연결·DDL·제약 통합 검증·Sequelize 런타임 매핑·HTTP 성공 기동은 미실행. 모의 테스트를 실제 DB 성공으로 해석하지 않는다.

## 다음 작업

1. 사용자 승인 후 Sequelize v6·mysql2 패키지 버전/Node 호환성을 확인하고 설치·잠금 파일 반영.
2. 실행 중인 MySQL 8.0, 기존 빈 DB·계정·환경 변수 준비. 비밀값은 문서/로그에 출력하지 않음.
3. 연결 검사 → 초기 마이그레이션 → 실제 FK/UNIQUE/CHECK·모델 매핑·HTTP 검증.
4. 세션 store·CSRF·회원가입/로그인/로그아웃·소유권 테스트.
5. 프로필·보유 기기 CRUD, 제품/가격, 후보 검색·모의 AI·Express 검증, Vue 연결.

## 유지하는 설계와 보류 사항

공통 성향은 IT 기기 전반에서 재사용한다. smartphone_json·variant_id는 스마트폰 전용이다. 보유 기기는 연식 제한 없이 부품 category·manual_specs_json을 지원하며 수동 사양은 호환성 판단 근거가 아니다. PC 상세·명시적 FK·조립 관계와 PC-FIT 통합은 후속 검증 이후 진행한다.

실제 AI 제공자·데이터 사용 권한·배포/백업·전체 Git 관리 방식은 미확정이다. 기존 front의 Vue 구조는 유지하며 이번에 프론트·front/.git에 쓰기 작업 및 Git 명령 실행 없음. 이전 HEAD 0694d1c init/미커밋 상태 확인은 과거 로그이며 이번 재검증은 하지 않았다.

공통 규칙과 실제 코드를 대조해 이어서 작업한다. 다른 도구의 변경을 덮어쓰지 않는다. 새 세션 진입점 자동 발견·Antigravity 참조는 미검증이고 문서 규칙은 OS 권한 통제를 대신하지 않는다.

## 최근 연결 설정 보완

Codex Desktop: 이전 ZIP 연결·환경 로더·모델 초기화를 읽기 전용 비교하고 backend/.env DB 키 자동 로딩을 추가했다. 실행 환경 우선, Node 내장 파서 사용. 8테이블·SQL·모델은 변경하지 않았다. 로더 포함 테스트 8/8 및 변경 JS 구문 검사 통과. 실제 node db/check.js는 DB_CONFIG_INVALID(exit 1): .env와 DB 환경 변수가 없어 DB 접속 단계에 도달하지 못했다. sequelize/mysql2도 미설치 상태다. 전용 DB/계정의 실제 존재는 미확인이고 이전 DB에는 접속하지 않았다. 다음 단계는 패키지 설치 승인·전용 접속 설정 준비 후 연결 재검증이다.

## 로컬 환경 확인·설치 결과 — 2026-11-09 22:48:11 KST

- Codex Desktop: 지정된 로컬 1학기 프로젝트의 DB 관련 파일만 읽기 전용 확인. 환경 변수→Sequelize→모델 등록 구조는 같아 코드 변경 없음. 기존 back/.env 및 DB 패키지 node_modules 없음.
- MySQL 8.0.45가 127.0.0.1:3306에서 실행 중. Node v26.3.0/npm 11.16.0 재사용. 설치/재시작 없음.
- 원본 lock과 동일한 sequelize 6.37.8·mysql2 3.22.3을 현재 backend에 고정 설치. package.json/package-lock.json 반영, 간접 의존성 포함 31개 추가. ignore-scripts/no-audit/no-fund 사용. Express 4.16.4 유지. npm의 uuid/dottie 사용 중단 경고 확인, 전체 업데이트 없음.
- npm run test:db 8/8 통과. 실제 Sequelize의 8모델 등록 성공(접속 없이 검사). 기존 8테이블 SQL·모델·연결 코드 유지.
- node db/check.js 결과 DB_CONFIG_INVALID(exit 1). 실제 접속 설정이 없어 DB 접속 전 중단. 사용자에게 backend/.env 설정 요청, 비밀번호 채팅 전송 금지 안내.
- 미실행: 전용 DB 존재 확인/생성·마이그레이션·실제 FK/UNIQUE/NOT NULL/CHECK·모델 대조·HTTP 연결. 설정 준비 후 이어서 검증해야 한다.
- Git 읽기 전용 확인: backend는 저장소 범위 밖, front 추적 파일에 .env 계열 없음. 현재 backend/.env 없음, backend/.gitignore의 .env 제외 확인. Git 구성 변경·프론트 수정·기존 프로젝트/DB 변경·외부 검색·Taste 실행 없음.
- 변경: backend/package.json, package-lock.json, node_modules 설치 및 docs/CURRENT_STATUS.md, DEVELOPMENT_LOG.md, DECISIONS.md, TEST_PLAN.md, backend/db/README.md 기록.

## 실제 연결 재점검 — 2026-11-09 22:58:10 KST

- Codex Desktop. 사용자 준비 완료 안내 후 정확한 backend 경로 재확인: .env는 없고 .env.example만 존재. 루트에도 env 이름 파일 없음. DB 필수 프로세스 환경 변수도 없음. 비밀값 출력 없음.
- 대상 DB/로컬 호스트 확인 단계에서 중단. node db/check.js는 DB_CONFIG_INVALID(exit 1). npm run test:db 8/8 통과.
- 실제 DB 연결·테이블 조회·마이그레이션·FK/UNIQUE/NOT NULL/CHECK·모델 대조·HTTP 통합 검증은 미실행. 사용자가 Workbench에서 준비한 DB의 존재/내용을 이번 도구로 확인한 것은 아님.
- 사용자에게 정확한 backend/.env 저장 위치 확인 요청. 설정 준비 후 동일 순서로 재개. 코드·DB·패키지·Git·프론트 수정 없음. 이번 변경은 CURRENT_STATUS/DEVELOPMENT_LOG/TEST_PLAN 기록만.

## MySQL 인증 재검증 — 2026-11-09 23:00:35 KST

- backend/.env 존재 및 DB 필수 5개 값의 존재 확인(값 출력 없음). 대상 final_project와 로컬 호스트 일치 확인.
- Sequelize 연결은 ER_ACCESS_DENIED_ERROR로 인증 실패. DB 테이블 조회 전에 중단; 계정/비밀번호/허용 호스트 중 정확한 원인은 미확정. 인증정보 변경·추측 재시도 없음.
- DB 테이블 조회·초기 마이그레이션·실제 제약/스키마 비교·HTTP 통합 검증 미실행. 기존 DB 및 프로젝트 코드 수정 없음.
- 다음: Workbench LocalHost의 실제 접속 방식과 backend/.env의 계정·비밀번호·호스트를 사용자가 대조한 후 재검증. 비밀번호는 채팅/문서에 기록하지 않음.

## 실제 MySQL 초기 마이그레이션 검증 — 2026-11-09 23:07:56 KST

- Codex Desktop: 필수 환경 설정 존재·로컬 대상 final_project 확인 후 Sequelize로 MySQL 8.0.45 연결 성공. SHOW FULL TABLES 결과 빈 DB 확인.
- 기존 node db/migrate.js --apply 실행 성공. users/sessions/profiles/smartphones/smartphone_variants/price_observations/owned_devices/recommendations 총 8테이블 생성. PK 8·FK 7·UNIQUE 3·CHECK 15 확인.
- 모델과 실 DB의 전체 컬럼명·타입·NULL·PK, FK 대상/삭제 규칙 및 선언 인덱스 일치. INTEGER/INT 동의어 정규화, 문서상 sessions BLOB 매핑↔실제 BINARY(32) 예외 적용. 비교 스크립트의 첫 타입 동의어 오탐은 수정 후 통과; 프로젝트 코드/스키마 수정 없음.
- 실제 트랜잭션 시험 24개 검증 통과: 이메일/국내 모델/옵션 UNIQUE, NOT NULL, 고아 FK, version·사양·검증 출처·가격/기간/boolean·보유 기기 XOR/유형/JSON·추천 status CHECK 대표 위반, RESTRICT, 사용자 종속 4테이블 CASCADE, Sequelize SID Buffer/JSON 왕복. 모든 CHECK의 모든 경계 조합을 전수 검사한 것은 아님.
- 시험 트랜잭션 롤백 후 8테이블 모두 행 수 0 확인. AUTO_INCREMENT 값은 롤백으로 복구되지 않을 수 있으며 초기화하지 않음.
- 실제 bin/www를 임시 포트로 시작하여 GET /api/health/db HTTP 200 및 {"data":{"database":"connected"}} 확인 후 시험 서버 정상 종료.
- npm run test:db 8/8 통과. node db/check.js DB_CONNECTION_OK. 테스트용 스크립트는 /private/tmp에서 실행, 프로젝트에 추가하지 않음.
- 기존 DB/프론트/Git/비밀값 변경·패키지 설치 없음. 프로젝트 파일 변경은 CURRENT_STATUS/DEVELOPMENT_LOG/TEST_PLAN만. 새 기술 결정 없음.
- 다음: 별도 요청에서 서버 세션 store·CSRF·회원가입/로그인 구현. 기존 초기 마이그레이션은 재실행하지 않음. 회원가입/AI 기능은 이번 미구현.

## 백엔드 인증 구현 — 2026-11-09 23:15:55 KST

- 구현 API: GET /api/auth/csrf, POST /api/auth/register, POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout. 가입 시 users+빈 profiles만 원자적으로 생성하며 프로필 기능은 미구현.
- express-session 1.19.0 최소 설치(Express 공식 저장소 메타데이터 확인), Express 4.16.4 유지. 기존 sessions 테이블용 MySQL Store 사용, 8테이블·제약·마이그레이션 변경 없음.
- scrypt 131072/8/1, salt 16바이트·키 64바이트·상수시간 검증·동시 2개. 로그인 시 SID/CSRF 회전, SHA-256 SID 저장, 30분 idle/24시간 절대 만료, logout 삭제, stale save 재생성 방지.
- Origin+세션 CSRF, HttpOnly/SameSite=Lax, 개발 loopback HTTP만 Secure=false·운영 HTTPS Secure=true. 입력/JSON 16KiB 검증, 동일 로그인 실패 응답, 고정 구간 IP/계정 제한, 비밀값/URL API 로그 차단.
- 검증: 인증 테스트 5/5(단위 4+MySQL/HTTP 1), HTTP 상태 assertion 33개 통과. 기존 DB 단위 8/8 및 연결 검사 통과. 로컬 scrypt 5작업 약 1.4초, 동시 2개 시험 프로세스 최대 RSS 약 323MiB; 운영 성능 보장은 아님. 최종 loopback 쿠키 정책 보강 후 해당 설정 테스트 재통과.
- 실제 확인: 가입·중복·정규화·해시·빈 프로필·로그인/유지/로그아웃·SID 교체·원본 SID 미저장·Store 재생성 후 읽기·CSRF/Origin 거절·DB 만료/절대 만료·로그인/가입 제한·입력/본문 오류·logout 후 지연 저장 방지. 시험 계정·세션만 식별하여 finally 정리. 최종 users/profiles/sessions 행 수 각각 0, 테이블 8개.
- 운영 HTTPS/프록시·브라우저 연동은 미검증. 만료행 주기 정리와 다중 인스턴스 제한 저장소는 후속 과제. 현재 만료행은 접근 불가. 회원가입 409는 설계상 중복 여부 신호가 될 수 있음.
- 다음: 사용자 요청 시 프로필·보유 기기 CRUD. 프론트/AI/계정 복구는 이번 미구현.

## 프로필·보유 기기 CRUD 완료 — 2026-11-09 23:27:14 KST

- Codex Desktop. 기존 8테이블·세션·CSRF 방식 유지. 인증 라우트 안의 세션/CSRF 처리만 auth/middleware.js로 분리해 /api 공통 적용(health/db 제외), 기존 로그인 코드와 Store는 유지.
- GET/PUT/DELETE /api/profile, GET /api/owned-device-options, GET/POST /api/owned-devices, PUT/DELETE /api/owned-devices/:id 구현. 스마트폰 선호도는 /profile의 smartphone으로 조회·전체 저장하며 중복 API 추가 없음.
- 프로필: 가입 시 생성된 version=1 빈 행을 PUT으로 확인 저장, usages/spending_style 필수, 선택값 null/빈 배열 기본화, confirmed_at·expected_version/409. 자연어 원문·AI 초안은 영속 저장하지 않음; 사용자 확인 lifestyle_note 300자만 허용. 예산/이번 구매 조건·알 수 없는 키 거절.
- 보유 기기: 15유형, manual_specs_json 타입별 허용키/단위·2KiB·수치 검증, 수동 사양과 호환성은 미검증 표시. variant_id 단독 등록/수동 입력 XOR, 전체 교체 수정, 카탈로그 전환 시 manual_* 초기화. 구형/타사/미검증 카탈로그 검색 허용, 출시 3년 제한 없음.
- 사용자 행→프로필 행 잠금으로 변경·version 증가·20개 상한 직렬화. 다른 사용자/없는 기기는 동일 404. 프로필 초기화 및 기기 수정/삭제는 본인 추천 이력만 같은 트랜잭션에서 삭제(기존 설계의 개인정보 보존 정책); 프로필 초기화 시 보유 기기 유지.
- npm run test:member 5/5(단위 4+실제 DB/HTTP 1), HTTP 상태 assertion 65개. 두 사용자 소유권, CSRF/Origin, 선택 생략, 선호 저장, 수동/구형 카탈로그, 전환/수정/삭제, 페이지, 잘못된 입력, 버전 충돌·동시 수정, 동시 20개 상한, 이력 정리 범위 검증.
- 회귀: npm run test:auth 5/5(HTTP assertion 33), npm run test:db 8/8, node db/check.js 성공. 선택 사양 생략 시 기존 모델 custom validator가 undefined를 거절하던 오류를 null과 함께 허용하도록 최소 수정, 필수/양수 거절 단위 검증 유지.
- 테스트 생성 계정 2개와 해당 프로필/기기/이력/세션, 직접 생성한 카탈로그만 식별해 정리. 최종 users/profiles/owned_devices/recommendations/sessions 행 수 0. 테이블 8, PK 8/FK 7/UNIQUE 3/CHECK 15 유지. 기존 사용자 데이터 삭제·DDL·패키지 설치·프론트·Git 변경 없음.
- 남은 범위: AI 자연어 분석, 추천, 프론트 연결 미구현. 원문/분석 초안은 미래 클라이언트 임시 상태로 관리하고 명시적 PUT만 확정 저장으로 취급한다. 운영 HTTPS/프록시는 이전 단계와 같이 별도 검증 대상.
- 다음: 스마트폰 시험 카탈로그·가격 입력 및 후보 검색/서버 검증을 별도 요청에서 구현.

## 스마트폰 제품·가격 조회 및 추천 후보 검색 완료 — 2026-11-09 23:40:40 KST

- Google Antigravity 전환 후 인수인계 검증 완료: `final_project` 경로, `GEMINI.md` 진입점, `DEVELOPMENT_RULES.md` 및 현황·로그·설계·결정·테스트 계획 대조 확인. 기존 DB 8/8, 인증 5/5(HTTP assertion 33), 프로필·기기 5/5(HTTP assertion 65) 회귀 통과 확인.
- 구현 API: `GET /api/smartphones`, `GET /api/smartphones/:variantId`, `POST /api/recommendation-candidates`. 기존 8테이블·세션·CSRF·소유권·오류 코드 계약 유지.
- 제품·옵션·3년 필터: 삼성·애플(`samsung`, `apple`), 국내 모델번호·저장 용량·색상 옵션별 구분, KST 기준 달력 3년 이내(`D - 3년 <= released_on_kr <= D`, 윤일 2/29 → 평년 2/28 말일 보정), `verified=true` 및 기본 `is_test=false`(비운영 테스트 시에만 `include_test=true` 허용).
- 가격 출처·유효기간·최저가 선택: `observed_at <= now < expires_at`(24시간 미만), `unconditional/in_stock/is_new/is_unlocked=true`, 배송비 포함 총액(`amount_krw + shipping_krw`). 판매처+출처별 최신 관측(`observed_at DESC, id DESC`)을 먼저 선정한 뒤 유효한 행 중 최저 총액을 선택하며, 최신 관측이 품절·만료인 경우 해당 판매처의 과거 저가로 회귀하지 않음.
- 추천 후보 검색(`POST /api/recommendation-candidates`): 프로필 완료(`PROFILE_INCOMPLETE` 409) 및 버전(`PROFILE_CHANGED` 409) 잠금 확인, 교체 대상 보유 기기 소유권 검증, 필수 조건(`budget_max_krw`, `usages` 누락 및 제조사-OS 모순 시 `status='clarify'`), NULL 사양의 필수 조건 탈락, 선호 조건(`soft`)의 후보 제거 배제.
- 후보 건수 분기 및 AI 입력 구조화: 후보 0개 시 자동 완화 없이 `status='no_match'`와 조건 완화 질문 반환, 40개 초과 시 임의 절단 없이 `status='clarify'` 반환, 1~40개 시 `status='candidates_ready'`와 검증된 객관적 추천 근거 후보(`eligible_reasons`)·비식별 스냅샷(`ai_context`) 반환.
- 검증: `npm run test:smartphone` 5/5(단위 4 + 실제 MySQL/HTTP 통합 1, HTTP status assertion 34개) 통과. 전체 백엔드 테스트 23/23 통과 및 `db/check.js` 정상. 테스트 데이터 정리 후 8테이블 모두 행 수 0 확인. 외부 API·AI 호출·패키지 설치·프론트·Git 변경 없음.
- 다음 작업: 모의 AI 응답 어댑터 및 서버 측 추천 결과/근거 재검증(`POST /api/analysis`, `POST /api/recommendations`, 추천 이력 조회/삭제) 구현.

## 전체 Git 저장소 통합 및 첫 커밋 준비 — 2026-11-09 23:52:04 KST

- Google Antigravity. 프로젝트 외부 백업(`/Users/ijaehyeog/.gemini/antigravity/brain/c3c60e0f-79c7-4c89-936e-1202a86726b5/scratch/git-backup-20261109`)에 `front.git.bak`, `front-all.bundle`(2 refs 검증 완료), `front-uncommitted.patch`, `front-working-files.tar` 생성 완료.
- `front/.git`을 프로젝트 루트 `/Users/ijaehyeog/Desktop/final_project/.git`으로 이동해 단일 저장소로 통합하고 루트 `.gitignore`를 생성했다(`front/.gitignore`, `backend/.gitignore` 보존). 중첩 `.git` 없음.
- 기존 `master` 브랜치 및 `0694d1c`(`init`) 커밋 객체·이력(`git fsck --full` 통과), `front/`의 미커밋 수정 8개 및 신규 파일(`logo.svg`, `src/plugins/*`)을 손실 없이 보존했다.
- 루트 `.gitignore`로 `node_modules/`, `.env`·`.env.*`(`!.env.example` 예외), 빌드 산출물(`dist/`), 로그, OS 파일(`.DS_Store`), 그리고 Taste Skill의 실행 금지 스크립트·대용량 데모 자산(`.agents/skills/design-taste-frontend/scripts/`, `assets/`, `*.mjs`, `*.js` 약 38MB)을 제외하고 읽기 전용 디자인 문서(`SKILL.md`, `references/`, `library/`)만 추적 가능하도록 구성했다.
- `git add`·`git commit`·`git push`·원격 변경은 수행하지 않았으며 사용자가 터미널에서 직접 수행한다.

## Mock AI + Gemini API 추천 시스템 및 추천 이력 완료 — 2026-11-10 00:26:13 KST

- Google Antigravity. 기존 8테이블·세션·CSRF·후보 검색 구조를 그대로 유지하면서 AI 어댑터(`services/ai-adapter.js`), 서버 검증기(`services/recommendation-validator.js`), 추천·분석·이력 라우터(`routes/recommendations.js`) 및 모델 접근 점검 스크립트(`services/gemini-check.js`)를 구현했다.
- AI 공급자 및 모델: `AI_PROVIDER` 환경 변수로 `gemini`(기본 주력)와 `mock`(자동 테스트·오프라인 개발용)을 전환한다. 기본 모델은 `gemini-3.5-flash-lite`, 추천 품질 비교용 선택 모델은 `gemini-3.6-flash`만 허용하며 승인되지 않은 유료 모델은 `AI_MODEL_NOT_ALLOWED`(503)로 차단한다.
- 현재 로컬 `backend/.env`에 `GEMINI_API_KEY`가 아직 설정되지 않은 것을 확인(`node services/gemini-check.js` → `AI_KEY_MISSING`). 키 미설정 시 `503 AI_KEY_MISSING`과 로컬 설정 안내를 반환하며, 자동 테스트는 모두 `AI_PROVIDER=mock`으로 실행해 외부 과금·호출 0회를 보장했다.
- 구현 API:
  - `POST /api/analysis`: 한국어 자연어 입력(`profile` 또는 `purchase`)을 구조화 초안(`draft`, `questions`, `uncertainties`)으로 분석. 기존 프로필과의 모순 및 미지원 조건은 질문으로 반환하며 사용자 확인 전까지 DB에 저장하지 않음. 자연어 원문은 로그/DB에 남기지 않음.
  - `POST /api/recommendations`: 기존 후보 검색(`searchCandidatesForUser`) 재사용. 후보 0개(`no_match`) 및 조건 보완(`clarify`)은 AI 호출 없이 저장 후 반환. 후보 1~40개는 AI 호출 후 제품 ID·순위·예산·사양·근거(`evidence` 및 `eligible_reasons` 내 `reason_code`)를 검증하고 서버 템플릿 설명을 생성. 검증 실패 시 오류 코드만 전달해 최대 1회 재시도 후 실패 시 `failed` 기록 및 `502 AI_INVALID_RESULT` 반환. 저장 직전 프로필 버전(`409 PROFILE_CHANGED`) 및 가격 유효성(`409 CANDIDATES_CHANGED`) 재검증.
  - `GET /api/recommendations`, `GET /api/recommendations/:id`, `DELETE /api/recommendations/:id`: 본인 추천 이력만 조회·삭제(타인 이력 `404`), 90일 경과 이력 자동 정리, 추천 당시 가격 보존 및 현재 만료 여부(`is_expired_now`, `price_status_note`) 표시.
- 검증: 신규 `npm run test:recommendation` 4/4(단위 3 + 실제 MySQL/HTTP 통합 1, HTTP assertion 29개) 통과. 전체 백엔드 테스트 27/27 통과(HTTP assertion 총 161개) 및 테스트 종료 후 8개 테이블 전체 행 수 0 확인.
- 다음 작업: 사용자가 `backend/.env`에 무료 티어 `GEMINI_API_KEY`를 설정한 뒤 `node services/gemini-check.js`로 `gemini-3.5-flash-lite` / `gemini-3.6-flash` 접근 확인 및 소량 실호출 검증, 이후 프론트엔드(Vue 3) 화면 연동 진행.

## 실제 Gemini AI 추천 기능 최종 검증 완료 — 2026-11-10 00:43:03 KST

- Google Antigravity. `backend/.env`를 직접 열거나 읽지 않고 보안 규칙을 준수한 상태에서 `npm run test:gemini-live` (`test/gemini-live.integration.test.js`)로 실제 `gemini-3.5-flash-lite` 모델을 최소 2회(자연어 분석 1회 + 추천 1회)만 호출하여 종단간(E2E) 검증을 완료했다.
- 실제 자연어 분석(`POST /api/analysis`): 가상 입력 *"나는 게임을 거의 하지 않고 유튜브와 웹서핑을 주로 해. 배터리가 오래가는 삼성 갤럭시를 선호하고 예산은 80만 원 이하여야 해."*에 대해 `hard.budget_max_krw: 800000`, `hard.usages: ["video"]`(`gaming` 제외), `soft.preferred_brands: ["samsung"]`, `soft.priorities: ["battery"]`를 정확히 분리하고, 미언급 저장 용량·무게·주사율을 임의 추측하지 않고 `questions` 및 `uncertainties`로 반환함을 확인.
- 실제 스마트폰 추천(`POST /api/recommendations`): 가상 후보 2종(Galaxy A35 5G 5000mAh 49만 원 vs iPhone Budget 2018mAh 65만 원) 중 1순위로 Galaxy A35 5G를 선정하고, 후보 내 정확한 `variant_id`, `price_observation_id`, `total_krw`, `eligible_reasons` 코드(`storage_meets_requirement`, `budget_headroom`, `preferred_brand_match`, `preferred_os_match`)만 인용하여 Express 검증 및 이력 저장·조회·삭제를 1회 호출 만에 통과.
- 호출 횟수 및 토큰 사용량: 총 **2회** 호출 (`POST /api/analysis` 1회: 입력 454 / 출력 150 / 합계 604 토큰, `POST /api/recommendations` 1회: 입력 1,634 / 출력 256 / 합계 1,890 토큰 → 총 **2,494 토큰**, 참고 추정 비용 `$0.0002784`, 무료 티어 내 처리).
- 오류 처리 및 전체 회귀: `AI_UNAVAILABLE`(502), `AI_TIMEOUT`(504), 분당 5회 초과 `RATE_LIMITED`(429), `AI_INVALID_RESULT`(502), 존재하지 않는 제품 ID·예산 초과·가격 만료(`409 CANDIDATES_CHANGED`)·후보 0개(`no_match`) 검증을 포함한 전체 백엔드 회귀 테스트 **27/27 통과**(HTTP status assertion 166개) 및 Live 테스트 **1/1 통과**. 테스트 종료 후 8개 테이블 전체 행 수 0 확인.
- 다음 작업: 스마트폰 MVP 백엔드 전체 기능 및 실제 Gemini 연동 검증이 완료되었으므로 프론트엔드(`front/` Vue 3) 화면 개발 및 API 연동 시작 가능.

## 보유 기기 기반 개인화 업그레이드 추천 및 다중 IT기기 확장 설계 완료 — 2026-11-10 01:16:00 KST

- Google Antigravity. 기존 8개 MySQL 테이블을 그대로 재사용(DDL·신규 테이블/컬럼 변경 0건)하면서 보유 스마트폰 출시 3년 경과 판정 서비스(`services/upgrade-advisor.js`), 업그레이드 상태 조회·알림 제어 API(`routes/upgrade-offers.js`), 보유 기기 대비 객관 비교 및 현 기기 유지(`status: 'keep'`) 추천을 구현했다.
- 구현된 업그레이드 제안 및 비교 기능:
  - 신규 회원 스마트폰 등록(`POST /api/owned-devices`) 및 기기 수정(`PUT /api/owned-devices/:id`) 응답에 즉시 `upgrade_offer` 포함, 기존 회원 재방문·로그인 시 `GET /api/upgrade-offer`로 현재 KST 날짜 기준 재평가(Gemini 호출 0회, 단순 조회로 알림 상태 자동 해제 금지).
  - 국내 공식 출시일(`released_on_kr`) 기준 정확히 3년 이상 경과(`currentKst >= anniversary3YKst`, 윤일 2월 29일은 평년 2월 28일) 시에만 `upgrade_offer_eligible: true` 판정. 개인 실사용 기간이 아닌 제품 출시 경과 기간임을 명시하며, 출시 3년 미만 사용자도 일반 추천(`can_start_general_recommendation: true`) 이용 가능.
  - 수동 등록 스마트폰 식별: 국내 모델번호 정확 일치 또는 브랜드+모델명 단일 검증 모델 일치 시 출시일 확인, 복수 세부 모델(`ambiguous_model_variant`), 미등록 모델(`unidentified_model`), 출시일 누락/오류/미래 날짜는 `needs_verification: true`(`확인 필요`) 반환. 현재 대표 스마트폰(`current_device`)과 과거·기타 스마트폰(`past_or_other_smartphones`) 구분.
  - 알림 반복 방지(`PUT /api/upgrade-offer/state`): `'snooze'`(`UPGRADE_SNOOZE_DAYS`, 기본 30일 유예 후 재노출), `'dismiss_permanent'`(해당 기기 영구 숨김), `'set_current'`(대표 스마트폰 변경), `'reset_notice'`. 상태는 `profiles.smartphone_json._upgrade_state`에 보관하며 `GET/PUT /api/profile` 응답에서는 은닉·보존.
  - 보유 기기 대비 객관 비교(`comparison_with_owned`) 및 현 기기 유지(`status: 'keep'`) 추천: 화면 크기·무게·배터리(mAh)·저장용량·RAM·주사율·무선충전·가격만 객관 비교하고 누락 사양 및 칩셋 벤치마크는 `'insufficient_data'`(`정보 부족`)로 표시, 배터리 mAh 증가 주의 문구 포함. 보유 기기가 필수 조건을 충족하고 교체 의향이 낮으면 `status: 'keep'`과 유지 근거(`keep_reasons`, `keep_cautions`) 반환.
  - 다중 IT기기 확장 정책 레지스트리(`DEVICE_UPGRADE_POLICIES`): 스마트폰(3년, 활성), 노트북(4년, 예정), 태블릿(4년, 예정), 스마트워치(3년, 예정), 데스크톱/조립 PC(성능·호환성·상태 중심, PC-FIT 연동 예정).
- 프론트엔드 개발을 위해 준비된 백엔드 API 전체 목록:
  - 인증/세션: `GET /api/auth/csrf`, `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
  - 프로필/보유 기기: `GET/PUT/DELETE /api/profile`, `GET /api/owned-device-options`, `GET/POST /api/owned-devices`, `PUT/DELETE /api/owned-devices/:id`
  - 업그레이드 제안/알림 제어: `GET /api/upgrade-offer`, `PUT /api/upgrade-offer/state`
  - 스마트폰 카탈로그/후보 검색: `GET /api/smartphones`, `GET /api/smartphones/:variantId`, `POST /api/recommendation-candidates`
  - AI 자연어 분석/추천/이력: `POST /api/analysis`, `POST /api/recommendations`, `GET /api/recommendations`, `GET /api/recommendations/:id`, `DELETE /api/recommendations/:id`
- 검증: 신규 `npm run test:upgrade` 5/5(단위 4 + 실제 MySQL/HTTP 통합 1, HTTP status assertion 28개, 20개 필수 시나리오 전수 포함) 통과. 전체 백엔드 회귀 테스트 **32/32 통과**(HTTP status assertion 총 194개, Live 포함 33/33) 및 테스트 종료 후 8개 테이블 전체 행 수 0 확인.
- 다음 작업: Vue 3 + Vuetify 3 프론트엔드(`front/`) 화면 개발 및 백엔드 API 연동.
