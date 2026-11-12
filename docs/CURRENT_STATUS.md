# 현재 상태 및 인수인계

> 2026-11-13 04:57 KST, Codex: 판매처별 가격 수신·저장 함수, 005 SQL 초안, 판매처 요약 API·비교 표시 구현. 관련 Mock/SSR 37개 및 빌드 통과. 실제 다나와 연결/저장 권한 미확보, 격리 MySQL 8.0.45 초기화 signal11 실패로 실제 DB 검증 미완료. 운영 DB 접속·변경 없음. 편집 종료. PRICE_COLLECTION_PLAN 최신 절에서 다음 작업과 한계를 확인할 것.

> 최신 (2026-11-11T19:39:19+09:00): 교차 검증·보안 수정 완료,90/90·HTTP217. 49/31 보존. 신규 공개 승인 미실행; iPhone Duo 식별 검수 필요. 아래 최신 교차 검증 절 참고.

> 최신 상태 (2026-11-11T16:25:00+09:00): 실제 MySQL 스마트폰 카탈로그(49모델·31변형) 기반 Express 추천 API 및 Gemini AI 추천 통합 완료. 전체 백엔드 테스트 58/58(오프라인+통합) 전수 통과. 실서버 Gemini Live API 정상 호출 검증 완료. 개발용 가격 대체(Fallback) 안전 연동 완료(실제 price_observations 테이블 무단 삽입 0건, DB 무결성 100% 보존). 신규 33모델 분류 보고 완료(DB 일괄 승인 없이 pending 유지).

> 최신 상태 (2026-11-11T14:51:01+09:00): 실제 로컬 개발 DB 확장·적재 완료, 49모델/31변형. HTTP22/22·오프라인60/60. 아래 최신 적용 결과 절 참고. 신규33모델은 비공개 유지.

> 최신: 문서 끝의 **실제 격리 MySQL 검증 시도** 참조. 서버 초기화 실패로 실제 DB 검증 미실행.

> 최신: 문서 끝의 **공개 필터·테스트 DB 적재 실행부 완료** 참조. 실제 MySQL 적용은 대기.

> 최신: 문서 끝의 **44모델 병합·개발용 가격 DTO 준비** 참조.

> 최신: 문서 끝의 **색상별 다나와 참고 가격 정리** 참조.

> 최신: 문서 끝의 **52개 조사 기록 정규화 완료** 참조.

> 이전 인수인계: 문서 끝의 **스마트폰 적재·NULL·링크 준비 완료** 참조. SQL·Upsert 계획 준비, 실제 DB 적용 미승인.

최신 상태: 2026-11-10 23:16:23 KST — 스마트폰 16모델·29변형 적재 완료(사용자/Antigravity 기록)를 이어받아 실제 판매 가격 수집 조사·설계를 완료했다. 가격 수집기·자동 갱신·실제 가격 적재는 미구현. 상세: PRICE_COLLECTION_PLAN.md.

- 마지막 작업: **2026-11-10 23:16:23 KST**.
- 작업 도구 전환: Codex Desktop (프론트엔드 1~3단계) → **Google Antigravity** (인수인계 및 소규모 스마트폰 DB 구축 준비).
- Codex Desktop: 8테이블 마이그레이션, DB·HTTP 통합 검증 및 프론트엔드 1~3단계 구현·인증/프로필/수동 기기 E2E 검증 완료.
- 기준: ARCHITECTURE.md 및 DECISIONS.md D-013~D-028. Express 4.16.4·MySQL 8.0.16+·Vue 3.5.45·Vuetify 3.13.7 유지.

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

## 프론트 1단계 인수인계

완료: 홈, 공통 테마/헤더/모바일 메뉴/푸터/버튼/카드/오류 상태, 404, 업무 라우트 플레이스홀더, /compare 2~3열 기본 UI 및 재사용 SpecComparison, 공통 API 요청 모듈·개발 프록시. 제품 스펙 비교는 D-027의 정식 핵심 기능이다.

미완료: 제품 검색/선택/실데이터 비교, 회원가입·로그인/세션 초기화 화면 흐름, 프로필/기기/추천/이력/업그레이드 실제 화면 연결. 비교 페이지는 실제품·가짜 추천 결과를 표시하지 않는다. 노트북/태블릿/워치/PC는 계획만 반영.

검증: Vue 3.5.45/Vuetify 3.13.7/Router 4.6.4 유지. 개발 서버 및 운영 빌드 성공(기존 MDI/Vuetify 번들 용량 경고 있음). 1200/768/390px 반응형·모바일 메뉴·라우트·콘솔 및 비교 UI 검사 완료. 페이지 외부 리소스/API 요청 0회. API 모의 검사 통과. 백엔드 51개 소스 파일 작업 전후 SHA-256 일치(.env/node_modules/.git 제외). .env는 읽기·해시·수정하지 않음. 백엔드 32/32·194 HTTP는 이전 도구 보고이며 이번 재실행하지 않았다.

문서 차이: CURRENT_STATUS의 오래된 ‘인증/추천 미구현·의존성 미설치’ 문장은 과거 기록이다. 실제 최신 라우트 및 D-024 루트 모노레포 확인을 우선했다. 과거 내용을 근거로 백엔드/저장소를 재구성하지 않았다.

다음: 사용자가 backend APP_ORIGIN을 개발 origin에 맞춘 후 공통 클라이언트로 csrf→회원가입/로그인→me→logout 흐름 연결. 일반 스펙 비교는 카탈로그 선택 2~3개·verified/유효가격 매핑부터 구현. 개발 서버는 127.0.0.1:8080에서 실행했다. 이번 검증은 Vue CLI의 loadEnv를 비활성화해 .env 자동 읽기도 피했으며 빌드 산출물은 /private/tmp에 생성했다.

## 프론트 인증 연결 — 2026-11-10 09:38:21 KST

- 회원가입/로그인 폼, 헤더 로그아웃, Vuex 사용자 상태, 라우트 진입 시 /auth/me 복원 및 보호 페이지→로그인 이동 구현. 기존 same-origin 세션/CSRF 클라이언트 재사용, 비밀번호는 요청 후 폼에서 제거하고 저장소에 보관하지 않음.
- 입력 검증(이메일·12~128자/512바이트·가입 비밀번호 확인), 중복 제출 방지, 401/409/403/429 및 연결 오류 메시지. 가입 후 로그인 안내, 로그인 성공 시 원래 내부 경로 복귀. 로그아웃 실패 시 성공으로 가장하지 않음.
- 변경: front/src/views/AuthView.vue, api/messages.js 신규; store/index.js, router/index.js, App.vue, styles/global.css 수정. backend/DB/.env/보안 규칙/의존성/Git 쓰기 없음.
- 검증: Vuex 모의 요청으로 미로그인·로그인·상태 복원·로그아웃·로그아웃 후 거절 5 assertion 통과. 실제 127.0.0.1:3000 연결은 실패(curl HTTP 000). 실제 회원가입/쿠키/새로고침/CSRF/로그아웃 HTTP 종단간 성공은 미검증. 백엔드 또는 DB를 시작하거나 테스트 데이터를 생성하지 않음.
- 다음: 사용자가 기존 백엔드를 실행하고 APP_ORIGIN을 프론트 origin에 일치시킨 뒤 실제 인증 HTTP 검증. 이번에 .env는 읽지 않음. 프로필/기기/비교/추천 화면은 이전 플레이스홀더 유지.

- 추가 검증: 운영 빌드 성공(기존 MDI/Vuetify 번들 크기 경고 유지). 실제 백엔드 인증 HTTP 테스트는 여전히 대기.

## 인증 종단간 재검증 — 2026-11-10 09:41:29 KST

- backend/package.json의 npm start(node ./bin/www)로 기존 Express 실행 성공. Vue CLI는 loadEnv 비활성 상태로 127.0.0.1:8080 실행. backend health 응답 database=connected. 앱 자체의 정상 설정 로딩 외 .env 직접 읽기/출력/수정 없음.
- /api/auth/csrf 실제 HTTP 200, 토큰·쿠키 발급 존재 확인(값 미출력). 같은 쿠키/정상 토큰으로 Origin=http://127.0.0.1:8080에서 빈 login 요청은 403 CSRF_INVALID. 알려진 기본 Origin=http://localhost:3000으로 진단 요청 시 422 INVALID_INPUT으로 입력 검증 도달. 후자는 진단만 수행한 것으로 브라우저 인증 성공이 아님.
- 차단 원인: Vue origin과 백엔드 허용 Origin 불일치. Origin 프록시 위조·백엔드 코드/설정 변경 없이 중단. 실제 가입/정상 로그인/로그아웃·로그인 후 새로고침 세션 유지·잘못된 비밀번호 거부·중복 제출 종단간은 아직 미검증.
- 시험 계정/사용자 데이터 생성 없음. CSRF 확인용 익명 세션만 생성되어 기존 만료 정책 적용; 다른 세션/기존 사용자 데이터 삭제하지 않음. API 키·쿠키·토큰 출력 없음.
- 필요한 사용자 설정: 백엔드 APP_ORIGIN을 실제 Vue 주소 http://127.0.0.1:8080과 정확히 맞추고 Express 재시작. 파일을 AI가 수정하지 않음. 서버는 이번 검증 후 실행 상태로 둠.
- 변경 파일: front/src/api/messages.js, docs/CURRENT_STATUS.md, docs/DEVELOPMENT_LOG.md. CSRF_INVALID가 Origin 불일치도 포함하므로 ‘토큰 만료’ 단정을 일반적인 보안 확인 실패 안내로 최소 수정. 브라우저에서 오류 안내와 비밀번호 입력 삭제 확인. 백엔드·스키마·Git 변경 없음.


## 인증 종단간 검증 완료 — 2026-11-10 21:02:41 KST

- 사용자 APP_ORIGIN 변경 후 기존 Express 실행 방식(npm start)으로 재시작. Vue http://127.0.0.1:8080 → 개발 프록시 → Express :3000에서 실제 브라우저/DB 인증 검증 완료. 기존 Origin 불일치 차단 해소.
- 회원가입 201 및 가입 완료 안내, 잘못된 비밀번호 로그인 401 및 오류 안내, 정상 로그인 200 확인. 가입·로그인 폼 각각 연속 2회 제출 시 실제 해당 POST 요청은 1회만 발생.
- 로그인 후 실제 브라우저 새로고침에도 /api/auth/me 200 및 로그아웃 메뉴 유지. 세션 쿠키 값은 document.cookie에 노출되지 않음. CSRF 발급 200, 토큰 누락/오류 요청 각각 403 확인(비밀번호·쿠키·토큰 값 미출력).
- 실제 헤더 로그아웃 후 /api/auth/me 401, /profile 진입 시 /login?next=/profile 이동. 동일 이메일 재가입 409 및 가입 불가 안내 확인.
- 중단 전 시험 계정과 재개 후 시험 계정 총 2개를 정확한 시험 이메일로만 찾아 정리. 기존 사용자 데이터 변경 없음. 익명 CSRF 세션은 기존 만료 정책에 맡기며 다른 세션을 일괄 삭제하지 않음.
- 이번 재개 작업의 변경 파일은 docs/CURRENT_STATUS.md, docs/DEVELOPMENT_LOG.md뿐. backend·front 코드, DB 스키마, .env, Git 수정 없음. .env 직접 읽기/출력 없음(백엔드 정상 실행에 필요한 기존 설정 로딩만 사용).
- 이번 인증 시나리오에서 남은 오류 없음. 전체 백엔드 회귀 테스트/운영 배포 환경 검증은 이번에 재실행하지 않음. Express와 Vue 개발 서버는 실행 상태로 유지.
- 다음: 별도 개발 단계에서 프로필·보유 기기 화면 API 연동 진행. 제품 비교·AI 추천 UI 연동은 이번 범위에 포함하지 않음.


## 프론트 3단계 착수 기록 (완료 결과는 하단 참조)

- 담당: Codex Desktop. front/ 프로필·보유 기기 화면 및 관련 테스트, CURRENT_STATUS/DEVELOPMENT_LOG/TEST_PLAN만 편집. backend/DB 스키마/보안 규칙 유지.
- 현재 대화 작업 폴더와 프로젝트 경로가 달라 명시된 final_project의 AGENTS/GEMINI 및 공통 규칙을 직접 확인했다. Taste 실행 금지를 유지하며 기존 미커밋 변경을 보존한다.


## 프론트 3단계 — 프로필·보유 기기 연결 완료 (2026-11-10 21:22:47 KST)

- 담당/도구: Codex Desktop. 기존 Vue/Vuetify/Router/Vuex 인증 및 API 클라이언트를 재사용했다. 추가 패키지 없음.
- /profile: 회원 이메일, 공통 용도·구매 성향·이동 빈도·모바일 생태계·생활스타일 메모, 스마트폰 브랜드·OS·순서 있는 우선순위 편집. 기존 전체 값을 불러와 PUT하며 expected_version 충돌 시 초안 유지·자동 덮어쓰기 차단. 선택값 생략 지원. 예산은 영구 프로필 계약에 없어 저장하지 않음. AI 분석 없음.
- /devices: 제조사/모델/모델번호 검색 및 옵션 선택·더 보기, 빈 결과, 수동 유형별 사양 입력, 목록·수정·삭제 확인, 동일 모델 복수 소유 확인, 대표 스마트폰 지정. RAM/VRAM/저장 용량 구분, 기존 수동 사양 보존, 미검증/호환성 미확인 표시. 기기 변경 후 목록·업그레이드 상태 재조회.
- 업그레이드: 서버의 current_device, needs_verification, upgrade_offer_eligible, should_show_popup에 따라 표시. 국내 공식 출시일 기준임을 안내하며 30일 유예/기기별 영구 숨김 연결. 일반 추천 링크는 연령 제한 없이 기존 준비 화면으로 이동; Gemini 실행/결과 UI는 미구현.
- API: GET/PUT /api/profile; GET /api/owned-device-options; GET/POST /api/owned-devices; PUT/DELETE /api/owned-devices/:id; GET /api/upgrade-offer; PUT /api/upgrade-offer/state. 기존 세션/CSRF 사용, 서버 인가 유지. 세션 소멸 응답 시 로그인 이동.
- 코드 생성: front/src/views/ProfileView.vue, front/src/views/DevicesView.vue, front/src/components/UpgradeNotice.vue, front/src/composables/useMemberApi.js. 수정: front/src/router/index.js, front/src/views/AuthView.vue(만료 안내), front/src/styles/global.css.
- 실제 검증: 테스트 계정 가입 201·로그인 200, 프로필 저장/수정 200·새로고침 유지·다른 필드 보존, 버전 충돌 409 시 초안 보존, 검색 빈 결과 200, 수동 기기 2개 등록·수정·삭제·대표 변경, 정보 확인 필요 표시, 유예 30일/영구 숨김 PUT 200 및 GET 유지, CSRF 없는 PUT 403. 서버 세션을 로그아웃 204로 폐기한 뒤 열린 기기 화면 재조회 시 401·로그인 이동·만료 안내 확인(30분 시간 경과 시험과는 구분).
- 실제 데이터 한계: samsung 검색 결과 0개. 카탈로그 연결 등록 및 출시 3년 미만/이상 배너는 모의 응답으로 검증했으며 실제 제품 통합 검증 완료로 간주하지 않는다. 실제 유예/숨김 API 저장 검증은 미식별 수동 시험 기기에 수행했고, 배너 버튼 클릭·숨김은 모의 검증이다.
- 운영 빌드 성공, 기존 MDI/Vuetify 번들 크기 경고 유지. 개발 컴파일 성공. 390px 실제 에뮬레이션에서 프로필·기기·편집창 가로 넘침 없음; 768/1280px 기기 화면도 없음. 폼 레이블 확인, 스크린리더·키보드 전수 시험은 미실행. 기존 auth/member/upgrade 단위 12/12 통과. 전체 DB/AI 회귀는 미실행.
- 테스트 전용 계정 1개 및 종속 프로필·보유 기기·로그인 세션 정리 완료(잔여 0). 익명 CSRF 세션은 기존 만료 정책 유지. 기존 사용자/제품 데이터 변경 없음. backend 51개 파일 작업 전후 해시 일치(.env/node_modules/.git 제외). .env 직접 접근 없음. Git 쓰기·Taste 실행·외부 검색·제품 데이터 생성 없음.
- 최초 컴파일 태그 오류 수정 및 이전 개발 서버의 캐시 권한 오류 해결 후 재빌드 통과. 현재 개발 서버 유지. 임시 운영 빌드는 /private/tmp/final-project-stage3-production에 있음. 편집 종료.
- 추가 확정 계획: D-028에 TechSpecs 미사용, 허용된 제조사/다나와 자료 정규화·검증·관리자 승인, Express 관리자 인가, 향후 시각적 UI 개선 기록. 관리자/수집기/승인 스키마/디자인 전면 개선은 미구현이며 기존 MVP 우선 로드맵 유지.
- 다음: 허용된 실제 카탈로그 확보 후 연결 등록·3년 전후 안내 실제 통합 검증; 별도 단계에서 제품 비교 API 연동, 이후 AI 추천·이력 화면 진행. 관리자/데이터 운영은 별도 후속 설계.

## Antigravity 인수인계 및 소규모 스마트폰 제품 데이터 구축 준비 — 2026-11-10 21:26:30 KST

- 담당/도구: Google Antigravity (Codex Desktop에서 전환).
- 세션 진입 및 규칙 확인:
  - 올바른 `/Users/ijaehyeog/Desktop/final_project` 경로 및 루트 단일 Git 저장소 확인.
  - `GEMINI.md`, `AGENTS.md`, `docs/DEVELOPMENT_RULES.md`, `docs/PROJECT_OVERVIEW.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`(D-001~D-028), `docs/CURRENT_STATUS.md`, `docs/TEST_PLAN.md`, `docs/DEVELOPMENT_LOG.md` 전수 대조 확인.
  - Codex가 구현한 프론트엔드 1~3단계(`front/src/views/{HomeView,AuthView,ProfileView,DevicesView,CompareView,PlaceholderView,ErrorView}.vue`, `front/src/components/{AppButton,FeatureCard,StatusPanel,SpecComparison,UpgradeNotice}.vue`, `front/src/api/{client,messages}.js`, `front/src/composables/useMemberApi.js`) 및 백엔드 코드를 수정 없이 그대로 보존.
  - `.env` 직접 읽기/출력 금지, Taste Skill 실행 금지, DB 스키마 변경 및 무단 외부 크롤링·적재 금지 준수.
- 스마트폰 카탈로그 스키마·검증·적재 준비 요약:
  - 대상 테이블: `smartphones`(모델·공통 사양), `smartphone_variants`(저장용량·RAM·색상 옵션), `price_observations`(옵션별 판매처 가격 관측).
  - 핵심 제약: `verified=true` 설정 시 `source_name`, `source_url`, `verified_at`이 모델과 옵션 모두 필수이며, 모델은 `domestic_model_number`(국내 자급제 모델번호, 예: `SM-S921N`, `A3287`), `released_on_kr`(국내 공식 출시일 `YYYY-MM-DD`), `os`(`android`/`ios`)가 필수(`ck_smartphones_verified`, `ck_variants_verified`). 추천 후보 및 기본 카탈로그 노출에는 `is_test=false` 및 유효 가격(`observed_at <= now < expires_at` 24시간 미만, `unconditional/in_stock/is_new/is_unlocked=true`, `shipping_krw IS NOT NULL`) 필요.
  - 조원 프로젝트 데이터 연동 준비: 원본 데이터를 곧바로 DB에 넣지 않고 (1) 원본 읽기 전용 구조/라이선스/출처 점검 → (2) 모델(`smartphones`)과 옵션(`smartphone_variants`) 1:N 분리 및 국내 모델번호·국내 출시일·단위 정규화 매핑 → (3) 출처 URL·검수 시각 부여 및 `ck_*` 제약 사전 검증(Dry-Run) → (4) 소규모 핵심 라인업(출시 3년 이내 추천용 + 출시 3년 경과 업그레이드 안내 검증용) 트랜잭션 적재 순서로 진행.
- 다음 우선 작업:
  1. 조원 프로젝트의 스마트폰 데이터 파일(JSON/CSV/SQL 등) 경로를 전달받아 읽기 전용으로 필드 구조와 출처를 분석하고 정규화 매핑 스크립트(Dry-Run 검증 포함) 작성.
  2. 검증 완료된 소규모 삼성·애플 스마트폰 카탈로그 및 가격 데이터를 적재한 뒤, 프론트엔드 `/devices`(카탈로그 검색·등록·출시 3년 전후 업그레이드 배너), `/compare`(2~3개 실데이터 스펙 비교 API 연결), `/recommend` 화면 통합 검증 진행.

## 조원 프로젝트(`pc_final-main.zip`) 스마트폰 데이터 분석·정규화·오프라인 검증 완료 — 2026-11-10 21:52:00 KST

- 담당/도구: Google Antigravity.
- 읽기 전용 분석 결과(`pc_final-main/backend/src/data/products.json`):
  - 전체 제품 총 **50개**(Apple 25, Samsung 25): 스마트폰 **26개 모델(옵션 39개)**, 태블릿 14개, 스마트워치 10개.
  - 스마트폰 26개 모델 구성: Apple 13개 모델(옵션 20개), Samsung 13개 모델(옵션 19개).
  - 출시일(`2026-11-10` KST 기준 3년 경계 `2023-11-10`) 분류:
    - **출시 3년 이내 추천 후보군(`2023-11-10 ~ 2026-11-10`)**: 총 **21개 모델(옵션 31개)** — 검증 완료(`verified_ready`) **11개 모델(옵션 21개)** + 보류(`hold_needs_review`) **10개 모델(옵션 10개)**.
    - **출시 3년 경과 업그레이드 판정 대상군(`released_on_kr <= 2023-11-10`)**: 총 **5개 모델(옵션 8개, 모두 `verified_ready`)** — `Galaxy S23 Ultra`(`SM-S918N`, `2023-02-17`), `iPhone 15`(`A3090`, 한국 정식 출시일 `2023-10-13`으로 정정), `iPhone 15 Plus`(`A3094`, `2023-10-13`), `iPhone 15 Pro`(`A3102`, `2023-10-13`), `iPhone 15 Pro Max`(`A3106`, `2023-10-13`).
- 출처·검증 등급 분리(`verified_ready` vs `hold_needs_review`):
  - **즉시 적재 가능(`verified_ready`, `verified: true`) — 16개 모델(옵션 29개)**: 조원 프로젝트의 초기 30개 검수 마스터 목록에 포함된 2023~2024년 출시 14개 모델 + 공식 국내 모델번호·공식 스펙 URL이 확인된 `iPhone 15 Plus`(`A3094`) 및 `Galaxy S24 FE`(`SM-S721N`).
  - **보류/추가 검수 필요(`hold_needs_review`, `verified: false`) — 10개 모델(옵션 10개)**: 이후 추가된 2025년 출시 코호트(`iPhone 17` 4종, `iPhone 16e`, `Galaxy S25` 3종, `Galaxy Z Flip7 / Fold7`). 특히 `iPhone 17 Pro / Pro Max`는 Apple 공식 스펙 페이지 미표기 항목인 `RAM 12GB`가 `rawSpecs`에 들어 있어 임의 확정하지 않고 `ram_gb: null` 처리 및 `hold_needs_review`로 분리.
- 한국 정식 출시일(`released_on_kr`) 정정 및 국내 모델번호 기준 사양 보완(2026-11-10 22:17 KST):
  - **한국 정식 출시일 통일**: `iPhone 15 / 15 Plus / 15 Pro / 15 Pro Max` 4종의 `released_on_kr`을 글로벌 1차 출시일(`2023-09-22`)에서 **한국 정식 출시일 `2023-10-13`**으로 정정(`2026-11-10` 기준 여전히 출시 후 3년 28일 경과하여 업그레이드 판정 대상 5종 유지). 나머지 `verified_ready` 12개 모델(`iPhone 16` 4종 `2024-09-20`, `Galaxy S24 FE` `2024-11-01`, `Galaxy Z Fold6 / Flip6` `2024-07-24`, `Galaxy A35 5G` `2024-06-21`, `Galaxy S24 / S24+ / S24 Ultra` `2024-01-31`, `Galaxy S23 Ultra` `2023-02-17`)은 한국 정식 출시일과 100% 일치 확인.
  - **`wireless_charging` 공식 사양 보완**: `verified_ready` 16개 모델에 대해 제조사 한국 공식 기술 사양을 확인하여 15개 플래그십·FE 모델(`A3287`, `A3290`, `A3293`, `A3296`, `A3090`, `A3094`, `A3102`, `A3106`, `SM-S721N`, `SM-F956N`, `SM-F741N`, `SM-S928N`, `SM-S926N`, `SM-S921N`, `SM-S918N`)은 `wireless_charging: true`, 무선 충전을 지원하지 않는 `Galaxy A35 5G`(`SM-A356N`)는 `wireless_charging: false`로 반영.
  - **Apple `battery_mah` / `ram_gb` 조사 및 정책**: 삼성 8개 모델(14개 옵션)은 삼성전자 코리아 공식 스펙에 `battery_mah`·`ram_gb`가 100% 공개되어 완비됨. Apple 8개 모델(15개 옵션)은 Apple 코리아 공식 기술 사양 페이지에서 배터리 용량(mAh)과 RAM(GB)을 비공개하므로 공식 출처 무결성을 위해 DB 컬럼은 `null`로 유지하고, 국내 전파인증·규제기관 신고 및 다나와 기준 실측/신고 사양(`iPhone 16` 4종 `8GB RAM` / `3561~4685mAh`, `iPhone 15 Pro/Pro Max` `8GB RAM` / `3274~4422mAh`, `iPhone 15/Plus` `6GB RAM` / `3349~4383mAh`)을 `audit_metadata.investigated_reference_specs`에 기록.
  - **국내 자급제 모델번호(`SM-...N` / `A....`) 기준 사양 대조 완료**: 국내판 `Galaxy S24 / S24+`(`SM-S921N` / `SM-S926N`)의 `Exynos 2400`, `Galaxy S24 FE`(`SM-S721N`)의 `Exynos 2400e (데카코어)` 표기 통일, 국내판 `Galaxy A35 5G`(`SM-A356N`) 단일 `6GB RAM / 128GB` 구성 및 국내판 iPhone 8종의 Sub-6GHz 5G·무게(g) 일치 확인.
  - **가격(`price_observations`)**: 조원 데이터에는 출고가(`launchPriceKrw`)만 존재하고 현재 판매 최저가(`currentLowestPriceKrw`)는 39개 전 옵션 `null`이다. 출고가를 현재 판매가로 대체하거나 임의의 24시간 유효 가격을 생성하지 않는 원칙에 따라 `price_observations`는 빈 배열(`[]`)로 유지하고 출고가는 `audit_metadata.reference_launch_price_krw`에만 보존했다.
- 생성된 정규화·오프라인 검증·비파괴 Upsert 산출물(기존 백엔드·프론트엔드 코드 및 DB 수정 없음):
  - `backend/data/normalized-smartphones.json`: MySQL `smartphones`·`smartphone_variants`·`price_observations` 스키마에 맞춘 정규화 JSON(`brand`는 백엔드 카탈로그·프론트엔드 검색 규격에 맞춰 소문자 `'apple'` / `'samsung'`으로 정렬).
  - `backend/scripts/validate-normalized-smartphones.js`: DB 연결 및 외부 네트워크 호출 없이 MySQL `CHECK`/`UNIQUE`(`uq_smartphones_model`, `uq_variants_option`)/`NOT NULL` 제약과 `smartphone-catalog.js`·`upgrade-advisor.js` 순수 함수를 검증하는 오프라인 검증 스크립트(실행 결과 `[PASS]`).
  - `backend/scripts/seed-verified-smartphones.js`: `verified_ready` 16개 모델(29개 변형)만 대상으로 기존 사용자·프로필·보유 기기·추천 이력·가격 데이터를 건드리지 않는 비파괴 Upsert 스크립트(기본 `--dry-run`, 명시적 `--apply` 승인 시에만 단일 트랜잭션 적재).
  - **Dry-Run 재실행 결과(`node backend/scripts/seed-verified-smartphones.js`)**: 현재 MySQL `smartphones` 0건, `smartphone_variants` 0건 상태에서 **`smartphones` 신규 삽입 예상 16건(갱신 0, 충돌 0), `smartphone_variants` 신규 삽입 예상 29건(갱신 0, 충돌 0), `price_observations` 삽입 0건** 확인(Dry-Run 전후 DB 행 수 변동 0건).
- **실제 MySQL 적재(`--apply`), 재실행 중복 방지(멱등성) 및 실시간 API 통합 검증 완료 — 2026-11-10 23:03:00 KST**:
  - **단일 트랜잭션 적재(`node backend/scripts/seed-verified-smartphones.js --apply`)**: `[APPLY_OK]` — `smartphones` **16건**, `smartphone_variants` **29건** 신규 적재 완료(`price_observations: 0`, 기존 `users`/`profiles`/`owned_devices`/`recommendations` 변경 0건).
  - **재실행 중복 방지(멱등성) 검증**: 동일 명령(`--apply`) 재실행 시 `smartphones`(`to_insert: 0`, `to_update: 0`, `unchanged: 16`, `conflicts: 0`), `smartphone_variants`(`to_insert: 0`, `to_update: 0`, `unchanged: 29`, `conflicts: 0`)로 중복 삽입·갱신 0건 확인.
  - **실제 DB 기반 API 통합 검증**:
    - 제품 카탈로그 조회(`GET /api/smartphones`, `GET /api/smartphones/:variantId`): 출시 3년 이내 추천 가능 옵션 **20개**(11개 모델, `SM-A356N` `wireless_charging: false` 및 나머지 19개 옵션 `true`), 전체 검증 옵션 **29개**(출시 3년 경과 5개 모델 9개 옵션 포함, `iPhone 15` 4종 `released_on_kr: "2023-10-13"`), 브랜드 필터(Apple 15개, Samsung 14개) 정상 동작 확인.
    - 보유 기기 검색(`GET /api/owned-device-options?q=...`): `q=S24`(7개), `q=iPhone 15`(7개), `q=SM-S918N`(2개) 검색 일치 확인.
    - 보유 기기 선택 등록(`POST /api/owned-devices`) 및 출시 3년 경과 판정(`GET /api/upgrade-offer`, `PUT /api/upgrade-offer/state`): `iPhone 15 Pro`(`A3102`, `2023-10-13`) 및 `Galaxy S23 Ultra`(`SM-S918N`, `2023-02-17`)는 `upgrade_offer_eligible: true` / `should_show_popup: true`, `iPhone 16 Pro`(`A3293`, `2024-09-20`) 및 `Galaxy S24 Ultra`(`SM-S928N`, `2024-01-31`)는 `upgrade_offer_eligible: false` / `should_show_popup: false`, 수동 입력 `apple` + `iPhone 15`는 카탈로그(`A3090`, `2023-10-13`) 자동 식별 후 `upgrade_offer_eligible: true` 판정 확인(검증 후 임시 테스트 계정·기기·세션 100% 정리 완료).
- 다음 우선 작업: 다나와 및 공식 판매처의 실제 판매 가격(`price_observations`) 수집·적재 및 추천 후보 검색(`POST /api/recommendation-candidates`)·AI 추천 통합 검증.


## 판매 가격 수집 조사·설계 완료 — 2026-11-10 23:16:23 KST

- Codex Desktop, 편집 종료. 명시된 final_project 경로에서 진입점/공통 규칙/관련 문서 및 가격 모델·DDL·카탈로그 함수를 정적으로 확인했다. Taste 스크립트 실행 없음.
- 두 GitHub 저장소의 실제 Python 코드·의존성·라이선스·최근 커밋, 다나와 약관/호스트별 robots, 네이버 공식 종료 공지, 제조사 정책을 조사했다. 추천: 이용 권한 확인된 자료의 관리자 검수 수동 등록 후 계약 API/피드 자동화.
- [PRICE_COLLECTION_PLAN.md](PRICE_COLLECTION_PLAN.md)에 필드 매핑, 정확한 모델번호/용량/색상 확인, 조건 미확인 보류, 가격 적격성, 승인/멱등성/TTL/오류 처리/단계별 개발 계획 기록. D-029 추가.
- DB에는 승인·unknown·수집 실패 상태가 없어 승인 전 자료는 별도 검토 영역으로 분리해야 한다. 가격 없는 품절/수집 실패의 즉시 무효화는 현행 구조로 보장하지 못함. 제안과 실제 구현을 구분했다.
- 최신 문서의 16/29/가격0 기록을 읽었으며 이번에 DB 행 수를 직접 재검증하지 않았다. DB 연결·앱 테스트·실제 수집/가격 API 호출·패키지 설치 없음. 코드/DB/스키마/.env/Git 쓰기 없음.
- 다음: 공급처의 저장·표시·AI 이용 권한 확보와 소수 변형 매핑 확정 → 오프라인 가격 검증·관리자 승인 입력기 및 기본 dry-run 적재기 구현. 다나와 자동화 허가/네이버 대체 가격 API는 확보되지 않았다.


## 스마트폰 데이터 확장 조사 진행 중 — Codex

- 담당: Codex. 문서 7종과 신규 조사 JSON·검증 도구만 편집. 기존 정규화 원본과 기능 코드는 유지.
- 조사 범위: 국내 판매 시작일 2024-01-01~2026-11-10. DB 쓰기·마이그레이션·자동 크롤링 없음.
- 모델/사양/출고가 근거 확인 → 정규화 → 오프라인 검증 → 읽기 전용 DB 대조 순서. 완료 결과는 후속 기록 참조.

## 스마트폰 확장 조사 산출물·재개 지점 — 2026-11-11 04:18:28 KST

- 담당 Codex. 이번 파일 편집 종료; **모델 전수성/모든 사양/실시간 가격 검증은 아직 완료 아님**. 현재 범위는 Phase 1 스마트폰이며 Phase 2 태블릿→노트북→워치, Phase 3 별도 PC-FIT으로 확정(D-030).
- 작성 완료: 별도 검토 JSON 52모델(일자확인49/보류3), 99용량·RAM구성, 출고가70값/29null, 검색가격 검토3/적격 실판매가0. 기존2025보류10모델의 공식 발표 근거를 보강했으나 운영 승인 상태로 변경하지 않음.
- 실제 DB 읽기 전용 확인: 모델16/변형29/가격0, 보존 대상 누락0. 조사 중 기존DB일치11/모델번호확인 신규33/모델번호미확인8. 기존2023모델5도 보존. INSERT/UPDATE/DELETE/마이그레이션 없음.
- 검증: 기존 원본 검사 PASS, 신규 오프라인 검사 PASS, 부정 입력 포함14테스트 PASS. source URL은 문법/참조만 검사했으며 링크 전체 가용성이나 사실 완전성을 자동 검증한 결과가 아님.
- 미완료: Buddy4/Wide8/Buddy5 정확한 첫 판매일, Jump4/5·키즈폰 전수 커버리지, 국내 모델번호8개, 일부 상세 사양/용량가격/색상SKU, S26+ 식별번호 충돌, S24FE 옵션 근거, Apple18Pro 기술사양 접근제한(429), 실판매 조건/권리/재고.
- 다음: PRICE_COLLECTION_PLAN 최신 모델표·JSON의 missing_requirements/conflicts/coverage_holds부터 검수. 완료 조사 재실행 대신 누락 항목 보완 → 상세사양/출고가/SKU 승인안 → 명시적 승인 후 별도 적재 구현 → 실제 비교/가격/추천 포함 Phase 1 통합.
- 변경: 지정 MD7종, 신규 검토 JSON·읽기전용 보고서·검증/테스트/DB대조 도구. 기존 원본·앱 기능·프론트·DB·보안 규칙·PC-FIT 유지. Git 쓰기 없음. 임시 작성 도구는 /tmp에 있으며 프로젝트 재개에 필요하지 않음.

## 최소 DB 확장 설계안 — 2026-11-11 04:35:45 KST

- Codex 편집 종료. [SMARTPHONE_DB_EXTENSION_DESIGN.md](SMARTPHONE_DB_EXTENSION_DESIGN.md)에 컬럼/제약/폴더블/RAM/승인/보존 및41개 신규 모델별 분류를 기록했다. 새 테이블0, 기존2테이블 확장 제안, 현재가격 테이블 유지. 실제SQL/마이그레이션/DB변경 없음.
- 이번 재대조는 파일 기반이다. 기존 원본 해시 일치, 이전 실제DB보고(2026-11-11 04:15:15 KST)의16/29 보존을 기준으로 조사52=기존11+미적재41. 즉시운영적재0/추가검증32/보류9. 기존2023모델5는 유지 대상.
- 발견: 기존 검증 사양을 조사 null/축약 칩셋으로 덮어쓰면 손실. 기존29변형의 한국어색상과 조사 영어색상은 명시적 매칭 필요. 보유기기 검색/등록은 미검증도 허용하므로 승인 전 DB밖 유지.
- 다음: 확장 설계 승인 → 미확인 국내식별/판매일/정확한SKU/권리 보완 → 테스트DB 마이그레이션·호환 입력기/API 구현 → 별도 적재 승인. 이번에는 웹검색/수집/DB접속/.env 직접열기/코드변경/Git쓰기 없음.

## 최신 대표18모델 검증·NULL RAM 보완 — 2026-11-11 04:43:02 KST

- Codex 편집 종료. 최소확장 기본방향은 사용자승인, 실제마이그레이션/적재는 미승인. 가격관측 및기존16/29·API 변경 없음.
- 우선18모델의 공식식별/출시근거를 재사용·보강. S26+번호충돌 해소, Fold7/8·Flip8와iPhone17/18 한국모델 근거 및일부사양 추가. SKU 사실확인1건(S26+블랙256/12), 전체옵션확정 아님.
- 운영적재준비0, 우선18모델추가검증. 전체41은추가검증33/보류8. 권리·정확한색상SKU·Apple상위용량출고가 등미완료. 기본정보확인을 전체사양검증완료로표시하지 않음.
- 원본JSON2종 유지. 별도 backend/data/smartphone-priority-verification-2026-11-11.json 및 docs/SMARTPHONE_PRIORITY_VERIFICATION.md 추가. NULL키29행정적충돌0(미확인RAM15), 논리4사례확인; DB시험아님.
- 다음: 남은SKU·근거검토 → 승인입력기/동시성·스키마시험계획 → 실제마이그레이션/적재별도승인. .env/DB접속/프론트변경/패키지설치/Git쓰기 없음.

## 검증 기준 분리 및 재분류 — 2026-11-11 04:50:14 KST

- Codex 편집 종료. 실제 final_project의 AGENTS/공통규칙과 관련문서/DDL/API 정적 확인. 문서만 변경, 다른 편집자 변경 덮어쓰기 없음. 자동 진입점 발견은 가정하지 않고 명시적으로 읽음.
- [재분류](SMARTPHONE_VALIDATION_RECLASSIFICATION.md): 우선18 A 완료9, B 완료2변형/2모델, C1 용량/RAM 근거35개·B연결2개, C2없음. 전체 신규41 A 완료10/추가확인31(식별보류8 포함), 기존11은 승인 이력 유지. 전체 출고가70은 색상SKU70을 뜻하지 않음.
- 현행/최소확장 후 모두 사양 등록 후보2모델2변형. S25 Ultra1TB/16GB 티타늄 제트블랙 및 S26+256GB/12GB 블랙. 운영 승인/실제 적재는 미완료. 이전0개는 이와 분리한 과거 운영준비 수치.
- 현재가/출고가 미확인을 모델·변형 검증 차단조건으로 쓰지 않음. 미확인 OS 계열/핵심값/색상 대응만 후속 확인. 기존16/29 ID/FK 및 가격관측 유지.
- 검증: JSON 집계·두 변형 근거·SQL/API 정적 확인·원본 해시 보존. 웹/DB/앱/API 시험 미실행. .env 접근/코드변경/Git쓰기 없음.
- 다음: 두 변형의 후보표 검수 및 별도 운영/적재 승인 → dry-run·ID/FK 보존검증. 이미 확인한 모델번호/날짜/금액의 반복 조사 불필요.

## 스마트폰 적재·NULL·링크 준비 완료 — 2026-11-11 09:27:27 KST

- Codex 편집종료. 진입점AGENTS/GEMINI/공통규칙과직전산출물·코드읽음. 선행재분류는재사용,웹조사/전체수집없음.
- 수치확정: 우선18/A완료9/B완료2/용량RAM출고가35·특정변형연결2,현재가0. 전체신규A10(Edge포함). 후보:S25Ultra1TB16GB티타늄제트블랙,S26+256GB12GB블랙.운영승인은별도미완료.
- 작성: migration-drafts의002/003 SQL초안, smartphone-import-candidates-2026-11-11.json, prepare-smartphone-upsert.js 및test, smartphone-import-preparation-dry-run.json. [적재계약](SMARTPHONE_IMPORT_PREPARATION.md)에NULL/링크/API/가격차이정책정리.
- 계획결과: 현행/확장모두2모델2변형,파일기준충돌0·쓰기0. 기본오프라인, --apply거부,DB쓰기실행부없음. 기존seed/migrate/ORM/API미변경.
- 검증: 오프라인24/24통과. 기존catalog/upgrade순수함수일부검증. DB/DDL/HTTP통합시험미실행,실제ID/FK미재조회. 기존16/29는과거DB보고값이며원본해시보존.
- 현재미구현: SQL실제적용,Upsert쓰기실행부,ORM새필드매핑,링크/출고가API응답,프론트표시. 미승인제품DBstaging금지.
- 다음승인: 후보/운영검수 → 별도안전테스트DB및백업계획 → 적용/쓰기실행부·ORM·공개정책구현/회귀 → 실제운영마이그레이션·적재명시승인. 자동진행없음.
- .env접근/실제DB접속·변경/프론트·추천엔진수정/Git쓰기0.다른기기/PC-FIT변경없음.

## 52개 조사 기록 정규화 완료 — 2026-11-11T09:38:16.807107+09:00

- Codex 편집 종료. 신규 backend/data/smartphone-normalized-review-52.json 및 smartphone-normalized-review-52-report.json 작성. 기존 원본4개 해시/내용 보존, SQL002/003 및 기존Upsert도구 재사용·미수정. DB/웹/.env 접근·프론트/추천엔진/Git 변경 없음.
- 52개 = 기존등록 대응11 + 국내식별·출시 확인 신규모델후보33 + 식별/출시보류8. 기존16개 중 조사기간밖5개도 보존. 실제DB재조회가 아닌 기존검증원본 기준 대조다.33은 완전검증/운영승인/변형확보33을 뜻하지 않으며 OS등 verified CHECK와 공개조건은 별도다.
- 확인된 개별 변형은2모델2개 유지. 99용량/RAM구성과색상목록은 증거로만 보존하며 곱집합/자동INSERT 금지. 전체52개에 일부 기본/선택 사양누락이 있으나 이것만으로모델전체를보류하지않음.
- 현재스키마값과 확장후상세/공식URL값 분리,기존값원본 별도보존. 출고가70값(색상SKU70건아님),미확인29값NULL,정확변형연결2. 현재판매가/가격관측0. 공식URL도기존근거만복사하며역할검수필요표시;미확인사양/링크NULL,구매URL추정없음.
- 오프라인검사:52개합계·모델번호중복0·검증변형중복0·NULL매핑·원본16/29보존통과. 기존도구Dry-Run은검증된2개구성만평가하여2모델2변형·충돌0·쓰기0. 전체33모델의실행계획은아님. 기존테스트24/24통과. 실제MySQL/DDL/ID/FK/HTTP검증미실행.
- 다음:33모델후보의OS/공개검수와개별옵션근거보완,기존값대조차이승인 → 격리테스트DB/백업·마이그레이션호환·쓰기실행부/ORM/노출정책준비 → 실제적재별도승인. 현행보유기기API의미검증노출때문에후보전체운영DBstaging금지.

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

## 실제 격리 MySQL 검증 시도 — 2026-11-11T14:29:33.581092+09:00

Codex 편집 종료. 실제 DB 검증 목표는 미달성이다. 기존 공개 필터/적재기/SQL/JSON을 재작성하지 않았다.

- 확인: Homebrew MySQL 8.0.45 서버·클라이언트·mysqldump 실행 파일 존재. 기존 서버 설정/운영 인증정보/.env는 읽지 않았다. Docker/Podman/Colima는 PATH에서 발견되지 않았다.
- 격리 준비: /tmp/fp-mysql-isolated.JbI1Lg 새 임시 경로에서 --no-defaults --initialize-insecure --datadir=해당경로/data --log-error=해당경로/init.log 로 별도 인스턴스 초기화를 시도했다. 이는 기존 서버 접속이 아니라 새 테스트 데이터 디렉터리 생성 시도다. 운영 데이터 디렉터리·포트·계정 재사용 없음.
- 실패: 프로세스가 초기화 직후 signal 11, 종료코드2로 중단. 로그의 delegates_init/Aligned_atomic 부근 스택 확인. 별도 sysctl hw.cachelinesize 조회도 Operation not permitted. 권한 제한이 충돌의 원인인지는 미확정이다. 제한 우회·기존 서버 대체 접속·재설치 없음.
- 테스트 서버/제한 계정/기준16·29 사본을 확보하지 못했으므로 SQL002/003 실행0, 신규33모델/2변형 실제 적재0, HTTP 테스트0. 실제 FK/NULL유일키/DDL반복/백업복구/실제롤백은 미실행. 운영DB 접속·변경0. 미완성 임시 디렉터리와 init.log는 진단용으로 보존했고 기존 데이터 삭제 없음.
- 오프라인 회귀는60/60통과·실패0. 기존 모델 병합 Dry-Run도44=11기존+33신규,보류8,기준16/29·기간밖5 보존 계획 유지. 이것은 실제 DB 보존/적재 검증을 대체하지 않는다. 신규 모의 테스트는 추가하지 않았다.
- 다음 준비: 사용자가 별도 터미널/승인된 격리 환경에서 MySQL8.0.16+ 인스턴스 초기화를 완료하고, 운영과 다른 데이터 디렉터리·포트·서버 식별을 확인해야 한다. 테스트 DB명은 final_project_test_<이름>, 적재 계정 fp_import_test는 해당스키마 SELECT/INSERT만 부여하고 운영 권한이 없어야 한다. DDL/기준사본 준비 계정과 적재 계정을 분리한다. 인증정보를 MD/대화/.env에 복사하거나 출력하지 않는다.
- 준비 확인 후: 기존 검증 JSON에서16모델29변형 기준사본 생성 → 백업/복원 경로 검증 → SQL002/003/재실행·부분실패복구 검증 → 테스트 적재33/2 및재실행 → ID/FK/NULL/공개필터/보유기기/업그레이드 HTTP 검증. 기존 integration 테스트는 loadEnv/운영DB명을 사용하므로 그대로 실행하지 말고 격리DB 전용 하니스가 필요하다. 운영 적용은 이후에도 별도 승인이다.

이번 변경은 CURRENT_STATUS, SMARTPHONE_IMPORT_PREPARATION, TEST_PLAN, DEVELOPMENT_LOG의 기록뿐이다. 코드/조사JSON/프론트/Gemini/Git 변경 없음.


## 최신 실제 개발 DB 적용 결과 — 2026-11-11T14:51:01+09:00

- **실제 적용 완료:** SQL002/003(ALTER5개), 신규33모델·2변형 → 총49모델·31변형. 신규 행은 pending/verified=false로 비공개. 기존16모델·29변형의 ID/기존 값과 FK7개 보존, 보류8개 제외. 재적재0/0·중복0·고아FK0·NULL117항목 확인.
- 백업 완료: `/Users/ijaehyeog/Documents/Codex/final-project-db-backup-9ydJZ8`. 전체 SQL·행/ID·FK 기록·체크섬·복구 안내 보관. 덤프 구조/완료 검증은 수행했으나 실제 복원 시험은 미실행. DDL 재실행 금지, 부분 상태 확인 후 복구 절차 사용.
- 실제 Express HTTP22/22, 기존 오프라인60/60 통과. 기존29변형 공개 유지·pending 차단·본인 비공개 보유기기 조회 유지·CSRF·업그레이드 조회 확인. 추천 후보는 적격 판매가 부족으로 no_match; Gemini/유효 판매가 추천 성공 미검증.
- 테스트 계정 정리 후 기존 사용자/프로필/보유기기/세션/가격/추천이력 전체 행 동일. 확장 ORM 조회 및 RAM NULL 실제 중복 거부 확인.
- 신규33모델은 기존 조사 JSON 근거로 향후 개별 공개 검수 대기. 가격 수집·프론트/Gemini 연동·일괄 공개는 하지 않았다. 자동 설정 로딩만 사용했고 .env 직접 접근/출력 없음.
- 최신 상세 실행 기록은 DEVELOPMENT_LOG의 같은 시각 절 참고. 이전의 ‘실제 DB 미적용/접속 불가’ 기록은 당시 이력이며 현재 상태가 아니다.

## 실제 MySQL 기반 Express 추천 API 및 Gemini AI 추천 통합 완료 — 2026-11-11T16:25:00+09:00

- **작업 개요:** Antigravity를 통해 실제 MySQL 스마트폰 데이터베이스(49모델·31변형)와 Express 추천 API(`POST /api/recommendation-candidates`, `POST /api/recommendations`, `GET /api/recommendations/:id`) 및 Gemini AI(실서버 Live 및 Mock AI) 연동을 완성하고, 통합 테스트 하니스를 안정화함.
- **수정 및 보완 파일:**
  - `backend/db/connection.js`: Sequelize 모델 초기화 시 `{ extended: true }`를 전달하여 마이그레이션 002/003의 `review_status`, `launch_price_krw` 속성을 rawAttributes에 정상 매핑, CHECK 제약조건(`ck_phone_review_verified`, `ck_variant_review_verified`) 위반 문제 근본 해결.
  - `backend/routes/smartphones.js`: 개발/테스트 환경 분기 및 `include_test` 처리 개선. `ALLOW_DEVELOPMENT_PRICES=true` 및 `NODE_ENV=development` 시 출고가(`official_launch`) 및 색상별 검증 참고가(`reference_sale`) fallback 연동.
  - `backend/routes/recommendations.js`: 추천 저장 및 이력 포맷팅 시 `observation_id: null`을 허용하고 `price_source`, `development_only`, `warning` 메타데이터를 원자적으로 보존.
  - `backend/routes/member.js`: 신규 등록(`POST /owned-devices`) 시 `publicOnly=true`를 적용하여 미승인(pending) 변형 등록을 차단하고, 기존 기기 수정(`PUT /owned-devices/:id`) 시에는 출시일 누락 모델에 대한 upgrade advisor의 `needs_verification` 검증 흐름을 지원.
  - `backend/routes/upgrade-offers.js`: 개발/테스트 환경에서 수동 스마트폰 식별(`matchManualSmartphoneToCatalog`) 대상 조회 시 테스트 픽스처가 누락되지 않도록 안전하게 분기.
  - `backend/test/*.js`: 테스트 픽스처 모델/변형에 `review_status: 'legacy'` 명시 및 `is_test: true` 정합성 보정.
- **테스트 결과:**
  - 전체 단위/통합 테스트 **58/58 전수 통과** (실패 0).
    - `test:db`: 8/8 통과
    - `test:auth`: 5/5 통과 (33 HTTP 단언)
    - `test:member`: 5/5 통과 (65 HTTP 단언)
    - `test:smartphone`: 5/5 통과 (34 HTTP 단언)
    - `test:recommendation`: 4/4 통과 (34 HTTP 단언)
    - `test:upgrade`: 5/5 통과 (28 HTTP 단언)
    - `publication-import.test.js` + `smartphone-price-preview.test.js`: 25/25 통과
    - `test:gemini-live`: 1/1 통과 (실제 Gemini Live API 연동 2회 호출 성공, 총 2,718 토큰, $0.00030195 소모, 비밀정보/API키 노출 0건)
- **개발용 가격 폴백(Fallback) 동작 검증:**
  - `ALLOW_DEVELOPMENT_PRICES` 미지정 시: `price_observations` 빈 상태로 인해 정상적으로 `no_match` 반환.
  - `ALLOW_DEVELOPMENT_PRICES=true` + `NODE_ENV=development`: 실제 카탈로그 기기(Galaxy A35 5G, Galaxy S24, iPhone 16 Plus 등)가 `official_launch` 및 `reference_sale`로 가격 프리뷰를 획득하여 11개 후보군 정상 도출 및 AI 추천/저장/이력 조회 성공.
  - 실제 MySQL `price_observations` 테이블에는 가짜 가격 데이터 무단 삽입 **0건** 유지 (무결성 보존).
- **데이터베이스 보존 확인:**
  - `smartphones`: 49개 모델 그대로 보존
  - `smartphone_variants`: 31개 변형 그대로 보존
  - `price_observations`: 0건 (가짜 데이터 삽입 없음)
  - 기존 사용자/프로필/보유기기/추천이력 데이터 무변경 확인.
- **신규 33모델 검수 보고:**
  - 10개 모델: 사양 및 국내 정식 출시일 완비(승인 메타데이터 작성 후 승인 가능 후보).
  - 22개 모델: `os IS NULL` 상태로 공식 사양 추가 확인 필요.
  - 1개 모델(`iPhone Duo`): 출처/명칭 불명확으로 보류(held).
  - 8개 모델: 식별 불가로 DB 외부 유지.
  - **결론:** DB 일괄 승인 쓰기 없이 pending 상태 유지 (분류 보고서만 제공).


## 최신 교차 검증 결과 — 2026-11-11T19:39:19+09:00

- 실제49모델/31변형 및 기존 사용자 데이터 보존 확인. 신규33개 pending/verified=false, 모델번호/동일명 중복0, 보류8개 미등록. 상세33행은 TEST_PLAN 최신 절 참조.
- iPhone Duo(A3720,90000153)는 원본 조사JSON부터 등록 후보였고 실제 비공개 DB행에 존재. 식별 재확인 전 공개 불가. 신규 검수10개에 기존iPhone15/16을 포함하면 분류 오류. 이번 최종 승인 확정0.
- 수정: 보유기기 PUT 미승인 변형 우회 차단, 테스트 제품 예외를 NODE_ENV=test로 제한, 미확인 RAM/색상 가격 자동승격 차단, 가격근거 검토 상태 및 추천 완료 시 사양·모델ID 재검증 보강.
- 수정 전81/81 → 수정 후90/90 통과. Antigravity58개 중 유료Live1개는 재호출하지 않아 독립 재검증은57개이며 적재준비24개·신규회귀9개를 더한 수치다. 실제HTTP217단언, Mock추천 저장·이력의 가격 출처/경고 동일. 추가 유료호출0.
- 테스트 후8테이블 전체 기존 행 동일,49/31·가격관측0·공개 상태 보존. 스키마/제품 데이터/프론트/Git 변경 없음.
- 다음: 일반 개발 서버 재시작 후 프론트 연결 가능. 신규 모델 공개·실판매 추천 출시는 국내 식별과 가격 매핑 검수 대기. 상세 발견/수정/한계는 DEVELOPMENT_LOG 같은 시각 절. Codex 편집 종료.
