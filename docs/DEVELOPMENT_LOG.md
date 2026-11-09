# 개발 기록

Asia/Seoul 기준 시간순으로 누적한다. 이전 기록을 삭제하지 않는다. 과거 설치·보안 검토의 정확한 수행 시각은 이번 로그에 소급하여 만들지 않았다. 날짜만 알려진 기존 요구사항은 DECISIONS에서 구분한다.

## 2026-11-06 23:56:48 KST — 프로젝트 현황 조사

- 도구: Codex Desktop.
- 목적: 전체 기획·AI 협업 문서 작성 전 실제 코드·설정 확인.
- 생성·수정·삭제 파일: 이 조사 단계에서는 없음.
- 확인: 실제 프론트 폴더 front, Vue 3·Vue CLI·Router·Vuex·Vuetify 기본 구성, Express·Jade 기본 라우트. MySQL·인증·AI·제품 API 미구현.
- 검증: 파일 읽기, 구조 확인. front/backend의 코드·설정·잠금 파일 SHA-256 비교 기준 확보.
- 제약: 앱·DB·API 실행, 설치, 네트워크, Git 변경 없음.
- 문제: Git은 front에만 존재; Google Fonts 로딩 코드; 비밀파일 제외 정책 보강 필요. 런타임 동작 미확인.
- 다음 작업: 기존 Taste 규칙을 보존한 단일 원본과 진입점, 기획·설계·현황·시험 문서 작성.

## 2026-11-07 00:04:08 KST — 문서 체계 작성 및 마무리 검토

- 시각 근거: 로컬 시계의 TZ=Asia/Seoul 출력. 이 시각은 작업 중 확인한 기준 시각이며 최종 완료 시각이 아님.
- 도구: Codex Desktop.
- 목적: 한국어 기획과 Codex·Antigravity 인수인계 체계 구성.
- 수정: AGENTS.md를 공통 문서 참조 진입점으로 변경.
- 생성: GEMINI.md, docs/PROJECT_OVERVIEW.md, ARCHITECTURE.md, DEVELOPMENT_RULES.md, CURRENT_STATUS.md, DEVELOPMENT_LOG.md, DECISIONS.md, TEST_PLAN.md.
- 삭제: 없음.
- 변경 이유: 단일 개발 규칙 원본을 두고 현재 템플릿 상태·미래 설계·검증·중단 지점을 분리해 교대 개발 지원.
- 실제 작성: 스마트폰 범위, 프로필·기기 흐름, DB 후보→AI 판단→Express 검증, 논리 데이터 모델, 데이터 권리 미확정, PC-FIT 보류, Taste 제한 보존, 기능별 테스트 계획.
- 실제 구현: 문서만 작성. 서비스 코드·DB·외부 연동 구현 없음.
- 중간 처리: 최초 문서 패치가 같은 파일에 중복 작업을 포함해 도구 검증에서 거절됨. 해당 패치는 적용되지 않았으며 이후 파일별 정상 패치로 작성함.
- 검증: 기존 코드·설정·잠금 파일 해시 중간 대조 일치. 문서 링크·상태·보안 규칙의 최종 검증은 후속 완료 기록에 기재.
- 미해결: 양 도구 새 세션의 자동 문서 참조, 전체 Git 관리 범위, AI·데이터 공급 권한, 인증·보존·일부 경계 정책.
- 다음 작업: 문서 최종 검증 후 상태 갱신. 개발은 별도 요청에서 시작.

## 2026-11-07 00:09:39 KST — 최종 정적 검증 및 인수인계

- 시각 근거: 검증 단계 로컬 Asia/Seoul 시계. 이 결과를 현황과 로그에 반영했다.
- 도구: Codex Desktop.
- 목적: 작성한 문서의 정합성·제약 준수 확인.
- 수정 파일: docs/CURRENT_STATUS.md, docs/DEVELOPMENT_LOG.md에 완료 상태·결과 반영. 전체 변경 목록은 앞 기록과 동일하다.
- 결과: 요청 문서 9개 존재, docs 7개 내용 재읽기·작성본 대조, 내부 상대 링크 6개 유효, 진입점 2개의 문서 참조 대상 존재 확인. 기존 Taste 제한 원문 보존 확인.
- 변경 범위 검증: front/backend의 코드·설정·잠금 파일 등 31개 SHA-256이 작업 전후 일치. node_modules·Git 내부·.DS_Store는 비교에서 제외했다.
- 의미 검토: 실제 front 폴더 유지, 현재 템플릿과 미래 설계 구분, 외부 공급처 권한 미확정, 날짜·가격 정책 제안 표시, 기능 테스트 전부 미실행 상태 확인.
- 미실행: 앱·빌드·DB·AI·외부 API·Taste 실행. 설치·업데이트·Git 커밋·Push 없음.
- 한계: Codex/Antigravity 새 세션의 자동 진입점·문서 참조 및 실제 도구 권한 강제는 미검증. 문서상 인수인계 체계만 구축했다.
- 다음 작업: 실제 도구 전환 검증, MVP 상세 설계와 미결정 정책 합의. 미완성 서비스 코드·임시 산출물 없음.

## 향후 기록 양식

- 실제 날짜·시각(Asia/Seoul) / 도구 / 작업 목적:
- 생성·수정·삭제 파일:
- 변경 이유 / 실제 구현 내용:
- 테스트 방법·결과·미실행 이유:
- 미해결 문제·중단 위치:
- 다음 작업·인수인계 주의사항:

## 2026-11-09 18:41:50 KST — 스마트폰 MVP 최소 상세 설계 확정

- 도구: Codex Desktop. 시각은 로컬 Asia/Seoul 시계로 확인.
- 목적: 다음 단계 MySQL·Express 구현에 필요한 최소 계약 확정.
- 수정: docs/ARCHITECTURE.md, docs/DECISIONS.md, docs/TEST_PLAN.md, docs/CURRENT_STATUS.md, docs/DEVELOPMENT_LOG.md. 신규·삭제 파일 없음.
- 내용: 세션 인증·CSRF·비밀번호 해시, 공통/스마트폰 성향, hard/soft, 무연식 제한 기기 CRUD, 국내 모델/옵션/가격 24시간, AI 후보·근거 검증, 8테이블·제약, REST API·예시·회귀 기준.
- 결정: D-013~D-017 추가. 기존 결정은 삭제하지 않았고 D-006 등 대체 관계 명시. 기존 아키텍처의 과도한 범용 테이블 초안은 최소 모델로 대체.
- 구현: Markdown 설계만 반영. 앱·DB·API·패키지는 미구현/미실행.
- 검증: 수정 문서 재읽기·작성본 대조, JSON 예시 6개 파싱 통과, 코드 블록 짝 확인, 테이블·API·hard/soft·출시일/가격 경계 및 테스트 간 정합성 검토.
- Git 보존: 읽기 전용 비교에서 front/.git HEAD·작업 트리 diff·staged diff·미추적 항목을 포함한 상태 목록이 작업 전후 동일. Git 관련 변경·커밋·Push 없음. 미추적 파일 내용 자체의 해시 비교는 수행하지 않았으며 해당 파일에 쓰기 작업을 하지 않음.
- 권한: 최초 적용은 작업 폴더 밖 쓰기 제한으로 거절되어 미적용. 요청한 Markdown 5개만 쓰기 권한을 받은 뒤 적용.
- 미실행: 코드 테스트·DB 생성·외부 API·웹 검색·패키지 설치·Taste 실행. 설계 테스트를 기능 통과로 해석하지 않음.
- 남은 사항: 실제 AI·데이터 권리·공개 배포/백업·Git 전체 관리 방식. 모의 AI 기반 구현은 시작 가능.
- 다음 작업: 별도 구현 요청에서 MySQL 8테이블·제약, 세션 store·회원가입/로그인·CSRF, 프로필·기기 CRUD 순서로 진행.

## 2026-11-09 18:47:40 KST — IT 기기·PC 부품 확장성 검토

- 도구: Codex Desktop. 시각은 실제 Asia/Seoul 로컬 시계 확인.
- 목적: 스마트폰 MVP를 유지하면서 최종 IT 기기·조립 PC 플랫폼 확장 경계 확인.
- 수정: docs/ARCHITECTURE.md, DECISIONS.md, TEST_PLAN.md, CURRENT_STATUS.md, DEVELOPMENT_LOG.md. 신규·삭제 파일 없음.
- 확인: 공통 성향은 재사용 가능. 기존 owned_devices는 laptop/tablet 수동 등록을 지원하지만 CPU/GPU/RAM/SSD 유형과 세부 사양 슬롯이 부족. variant_id FK는 스마트폰 전용이며 PC 참조로 혼용할 수 없음.
- 최소 보완: category 허용값 확대, nullable manual_specs_json 한 필드의 문서 설계·타입별 검증 정의. manual_storage_gb와 RAM/VRAM 분리. D-018 추가.
- 유지: 8테이블, 스마트폰 모델·옵션·가격·3년·24시간·추천 API, 기존 소유권·version·삭제 정책.
- 후속 경계: PC 상세·가격·제품군 선호·명시적 FK·조립 관계는 실제 PC-FIT 코드/DB/권리 검증 이후 설계·마이그레이션. 원본 확인·통합은 이번 미실행.
- 검증: 변경 설계·결정·테스트 문서 재읽기 일치, JSON 예시 7개 파싱, 유형별 사양·XOR 및 기존 API 생략 호환성 정적 검토. 기능 테스트 미실행.
- 미수행: 테이블 생성·코드 수정·패키지 설치·외부 요청·Taste 실행·Git 명령/변경/커밋/Push. 기존 .git 및 미커밋 파일은 건드리지 않음.
- 다음 작업: D-018의 작은 보완을 포함한 기존 스마트폰 MVP MySQL·Express 구현. PC 기능은 계속 보류.

## 2026-11-09 19:04:34 KST — 스마트폰 MVP DB·Express 연결 코드

- 도구: Codex Desktop. AGENTS·공통 규칙·설계·현재 상태 및 필요한 backend 설정 확인.
- 신규: backend/config/database.js, backend/db/connection.js, backend/db/models.js, backend/db/check.js, backend/db/migrate.js, backend/db/migrations/001-initial.sql, backend/db/README.md, backend/routes/db-health.js, backend/test/db.test.js, backend/.env.example, backend/.gitignore.
- 수정: backend/app.js, backend/bin/www, backend/package.json(실행 명령만); docs/ARCHITECTURE.md, DEVELOPMENT_RULES.md, DECISIONS.md, TEST_PLAN.md, CURRENT_STATUS.md, DEVELOPMENT_LOG.md.
- 구현: 확정 8테이블 SQL·제약·Sequelize 모델, 환경 변수 검증·연결 풀·MySQL 버전 확인, 연결 후 HTTP 시작, 연결 상태 API, 빈 DB 전용 명시적 마이그레이션. 세션 인증 및 CRUD는 미구현.
- D-019: 사용자 지시에 따라 ORM 미사용 설계를 Sequelize v6/mysql2로 대체. SQL이 스키마 원본이며 sync·추가 메타 테이블 없음. DDL 부분 실패 시 삭제 없이 중단.
- 환경: Node v26.3.0·Express 4.16.4·MySQL 명령 8.0.45. 기본 3306 리스너/확인한 기본 소켓 없음, DB 환경 변수 없음. sequelize/mysql2 미설치를 보고하고 설치하지 않음. 실제 비밀값은 읽거나 기록하지 않음.
- 테스트: node --test test/db.test.js 7/7 통과; JS 8파일 구문 검사 통과. 모델 편집 후 문법 오류를 수정하고 재검증. db/check.js·bin/www는 DB_CONFIG_INVALID로 종료; 가짜 환경 변수 check는 DB_DEPENDENCY_MISSING으로 종료.
- 한계: 모의 DB 테스트이며 실제 MySQL 접속·DDL·제약·Sequelize 매핑·HTTP 성공 기동 미검증. DB/계정 생성·서비스 시작·실제 마이그레이션 없음.
- 보존: 패키지 설치·잠금 파일 수정·프론트 수정·외부 요청·Taste 실행·Git 명령/변경/커밋/Push 없음. 승인받은 backend·문서 경로만 작성.
- 다음: 패키지 설치 승인 및 DB 환경 준비 후 연결·초기 마이그레이션·통합 검증, 이어서 세션 인증 구현.

## 2026-11-09 22:36:39 KST — 기존 ZIP 연결 방식 비교·환경 로더 보완

- Codex Desktop. ZIP의 back/app.js, config/loadEnv.js, model.js 초기화/동기화 부분을 읽기 전용 비교. 원본 실행·인증정보 재사용 없음.
- 신규: backend/config/loadEnv.js, backend/test/env.test.js. 수정: backend/db/connection.js, backend/.env.example, backend/package.json(테스트 명령), backend/db/README.md, docs/CURRENT_STATUS.md, DECISIONS.md, TEST_PLAN.md, DEVELOPMENT_LOG.md.
- DB 키만 backend/.env에서 로드, 실행 환경 우선. Node 내장 파서 사용. 기존 8테이블/모델/SQL 및 패키지 의존성은 유지. D-020 기록.
- 테스트 8/8·변경 JS 구문 검사 통과. node db/check.js 실제 실행 결과 DB_CONFIG_INVALID, 종료 1: 설정 부재로 연결 전 중단. sequelize/mysql2 미설치. 실제 연결 성공·전용 DB 존재 미검증.
- 설치·DB 생성/변경·이전 DB 접속·프론트 수정·외부 검색·Git 변경/커밋/Push 없음. 샌드박스 쓰기 차단 후 지정 경로 권한을 받아 적용.
- 다음: 패키지 설치 승인 및 전용 DB 접속 설정 준비 후 실제 연결 재검증. 비밀번호는 채팅/문서에 기록하지 않음.

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

- 생성: backend/auth/{config,password,store,limiter}.js, auth/README.md, routes/auth.js, test/auth.test.js, test/auth.integration.test.js. .env.example은 없음을 확인하여 비밀값 없는 예시로 생성.
- 수정: backend/app.js, config/loadEnv.js, package.json/package-lock.json, 로컬 .env(새 세션 secret·APP_ORIGIN만 보완, DB 값 유지), docs/CURRENT_STATUS.md, DEVELOPMENT_LOG.md, TEST_PLAN.md, DECISIONS.md.
- 로컬 secret은 무작위 생성·출력하지 않음, .env 권한 600. backend는 Git 저장소 범위 밖이며 .gitignore의 .env 제외 확인. Git 쓰기·프론트·기존 DB 데이터 삭제·Taste 실행 없음.
- 검사 중 수정: 테스트 로그인 실패 누적 횟수 기대값 보정, 라우터 경로에 따른 morgan skip을 originalUrl 기반으로 보완. 최종 회귀 통과. 새 기능 범위 외 코드 변경 없음.

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

- 생성 코드: backend/auth/middleware.js, backend/services/member-validation.js, backend/routes/member.js, backend/test/member.test.js, backend/test/member.integration.test.js.
- 수정 코드: backend/app.js(공통 미들웨어/라우팅·오류 코드), backend/routes/auth.js(공통 처리 추출), backend/db/models.js(선택 숫자 undefined 검증 수정), backend/package.json(test:member 명령). 잠금 파일·의존성·환경 비밀값 변경 없음.
- 수정 문서: CURRENT_STATUS.md, DEVELOPMENT_LOG.md, TEST_PLAN.md, DECISIONS.md. 원본 스킬 실행·외부 검색·AI API 사용 없음.

## 스마트폰 제품·가격 조회 및 추천 후보 검색 완료 — 2026-11-09 23:40:40 KST

- 도구: Google Antigravity (Codex Desktop에서 인수인계 전환).
- 목적: Codex 인수인계 상태 검증 및 스마트폰 제품·가격 조회, 예산/필수 조건 기반 추천 후보 검색 구현.
- 생성 파일: `backend/services/smartphone-catalog.js`, `backend/routes/smartphones.js`, `backend/test/smartphone.test.js`, `backend/test/smartphone.integration.test.js`.
- 수정 파일: `backend/app.js`, `backend/package.json`, `docs/CURRENT_STATUS.md`, `docs/DEVELOPMENT_LOG.md`, `docs/DECISIONS.md`, `docs/TEST_PLAN.md`. 삭제 파일 없음.
- 인수인계 검증: `GEMINI.md` 진입점, `DEVELOPMENT_RULES.md`, `CURRENT_STATUS.md`, `DEVELOPMENT_LOG.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `TEST_PLAN.md` 확인 후 실제 백엔드 코드·DB 상태 대조. 기존 DB 8/8, 인증 5/5(HTTP assertion 33), 프로필·기기 5/5(HTTP assertion 65) 회귀 실행 통과.
- 실제 구현 내용:
  - `GET /api/smartphones`: 삼성·애플(`samsung`, `apple`) 스마트폰 모델·옵션 목록 조회(커서 기반 페이지네이션, 브랜드·OS·용량 필터, 국내 출시 3년 이내 추천 가능 필터, 판매처별 최신 가격 및 최저 유효 총액 포함).
  - `GET /api/smartphones/:variantId`: 단일 옵션 상세 사양, 모델·옵션 출처(`sources`), 현재 유효 최저가(`price`) 및 판매처별 최신 관측·만료 여부(`latest_prices_by_seller`) 반환.
  - `POST /api/recommendation-candidates`: 사용자 프로필 확정 여부(`PROFILE_INCOMPLETE` 409) 및 버전(`PROFILE_CHANGED` 409) 검증, 교체 기기 소유권 확인, 필수(`hard`)·선호(`soft`) 조건 분리 검증.
  - 날짜·가격·예외 규칙: Asia/Seoul 달력 3년 경계(양 끝 포함, 윤일 2/29 평년 2/28 말일 보정), 가격 관측 후 24시간 미만(`observed_at <= now < expires_at`)·무조건 자급제 신품·재고 있음·배송비 포함 총액 계산, 판매처별 최신 관측 우선 선택(품절/만료 시 과거 저가 회귀 차단).
  - 후보 분기 및 AI 구조화: 필수 예산/용도 누락 및 브랜드-OS 충돌 시 `clarify`, 후보 0개 시 자동 완화 없이 `no_match`와 완화 질문 반환, 40개 초과 시 임의 절단 없이 `clarify` 반환, 1~40개 시 `candidates_ready`와 검증된 객관 근거 후보(`eligible_reasons`) 및 비식별 `ai_context` 반환.
- 테스트 방법·결과:
  - 신규 `test/smartphone.test.js` 및 `test/smartphone.integration.test.js`: 5/5 통과(단위 4 + 실제 MySQL/HTTP 통합 1, HTTP 상태 검증 34개).
  - 전체 회귀 테스트: DB 8/8, 인증 5/5(HTTP 33), 회원/기기 5/5(HTTP 65), 스마트폰/후보 5/5(HTTP 34) 총 23/23 통과. `node db/check.js` `DB_CONNECTION_OK`.
  - 테스트 종료 후 생성 계정·세션·가격·옵션·모델 정리 완료, 8테이블 전체 행 수 0 확인.
- 미해결 문제: 실제 AI 제공자(OpenAI/Gemini) 및 TechSpecs·다나와 외부 데이터 권한 미확정 유지.
- 다음 작업: 모의 AI 응답 어댑터 및 서버 측 추천 결과/근거 재검증(`POST /api/analysis`, `POST /api/recommendations`, 추천 이력 조회·삭제) 구현.

## 전체 Git 저장소 통합 및 첫 커밋 준비 — 2026-11-09 23:52:04 KST

- 도구: Google Antigravity.
- 목적: 기존 `front/.git` 이력(`0694d1c`)과 미커밋 변경을 보존하면서 프로젝트 루트 단일 Git 저장소로 통합하고 `.gitignore` 및 민감정보 검증 수행.
- 생성·이동·수정 파일: `front/.git` → `.git`(루트 이동), 루트 `.gitignore` 생성, `docs/CURRENT_STATUS.md`, `docs/DEVELOPMENT_LOG.md`, `docs/DECISIONS.md` 갱신. 애플리케이션 코드·DB 수정 없음.
- 백업 및 복구 검증: `/Users/ijaehyeog/.gemini/antigravity/brain/c3c60e0f-79c7-4c89-936e-1202a86726b5/scratch/git-backup-20261109/`에 `front.git.bak`, `front-all.bundle`(`git bundle verify` 통과), `front-uncommitted.patch`, `front-working-files.tar` 백업 완료.
- 검증 결과: 루트에서 `git status`, `git log`(`0694d1c`), `git fsck --full` 정상 확인. `backend/.env`, `node_modules/`, `.DS_Store`, Taste Skill 실행 스크립트·대용량 에셋 제외 및 `backend/.env.example` 추적 허용 확인. 과거 커밋(`0694d1c`) 및 현재 추적 대상 코드에 비밀번호·API 키 하드코딩 없음 확인.
- 다음 작업: 사용자가 터미널에서 직접 `git add`·`git commit`·원격 연결 및 `git push` 수행 후, 백엔드 모의 AI 및 추천 검증 API 구현 진행.
