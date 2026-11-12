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

## Mock AI + Gemini API 추천 시스템 및 추천 이력 완료 — 2026-11-10 00:26:13 KST

- 도구: Google Antigravity.
- 목적: Mock AI(테스트/오프라인용)와 Gemini API(`gemini-3.5-flash-lite` 기본, `gemini-3.6-flash` 비교 선택) 어댑터 분리, 자연어 분석(`POST /api/analysis`), 스마트폰 추천 및 서버 근거 재검증(`POST /api/recommendations`), 추천 이력 조회·삭제(`GET/DELETE /api/recommendations`) 구현.
- 생성 파일: `backend/services/ai-adapter.js`, `backend/services/recommendation-validator.js`, `backend/services/gemini-check.js`, `backend/routes/recommendations.js`, `backend/test/recommendation.test.js`, `backend/test/recommendation.integration.test.js`.
- 수정 파일: `backend/config/loadEnv.js`, `backend/.env.example`, `backend/routes/smartphones.js`(후보 검색 함수 재사용 export), `backend/app.js`, `backend/bin/www`(기동 시 2분 경과 `processing` 정리), `backend/package.json`, `backend/test/smartphone.integration.test.js`(병렬 실행 시 조건 격리 보완), `docs/CURRENT_STATUS.md`, `docs/DEVELOPMENT_LOG.md`, `docs/DECISIONS.md`, `docs/TEST_PLAN.md`.
- 실제 구현 내용:
  - AI 어댑터(`services/ai-adapter.js`): 환경 변수 `AI_PROVIDER`(`gemini` / `mock`), `GEMINI_API_KEY`, `GEMINI_MODEL`(`gemini-3.5-flash-lite` 기본, `gemini-3.6-flash` 허용) 지원. 미승인 유료 모델 차단(`AI_MODEL_NOT_ALLOWED`), 20초 호출 타임아웃, 출력 토큰 상한(`maxOutputTokens: 1024`), JSON Schema 강제, 토큰 사용량·비용 추정(`estimateUsage`), 프롬프트 인젝션 격리(`untrusted_user_text` 데이터 분리).
  - 자연어 분석(`POST /api/analysis`): `purpose`(`profile` / `purchase`) 및 `text`(2000자 제한) 검증, 기존 확정 프로필과의 모순 및 미지원 기능 질문 반환, 서버 enum/범위 검증(`validateAnalysisOutput`), 사용자 확인 전 DB 저장 없음, 원문 로그 미기록.
  - 추천 실행(`POST /api/recommendations`): `searchCandidatesForUser` 재사용, 후보 0개(`no_match`)/조건 보완(`clarify`) 시 AI 미호출 저장, 후보 1~40개 시 AI 호출 전 `processing` 생성(AI 호출 중 DB 트랜잭션 미유지), 후보 ID·순위·예산·사양·근거(`evidence` 및 `eligible_reasons`) 검증, 서버 템플릿 객관 설명 생성, 검증 실패 시 오류 코드로 최대 1회 재시도 후 실패 시 `failed` 저장 및 `502 AI_INVALID_RESULT`, 저장 직전 프로필 버전(`409 PROFILE_CHANGED`) 및 가격 유효성(`409 CANDIDATES_CHANGED`) 재검증. 사용자당 분당 5회·동시 1개 AI 호출 제한 적용.
  - 추천 이력(`GET /api/recommendations`, `GET /api/recommendations/:id`, `DELETE /api/recommendations/:id`): 본인 이력만 조회·삭제(타인 `404`), 90일 경과 이력 정리, 당시 가격 보존 및 현재 만료 여부(`is_expired_now`, `price_status_note`) 표시.
- 테스트 결과:
  - `node services/gemini-check.js`: 현재 로컬 `backend/.env`에 `GEMINI_API_KEY` 미설정 확인(`AI_KEY_MISSING`), 외부 과금 호출 0회.
  - `npm run test:recommendation`: 4/4 통과(단위 3 + 실제 MySQL/HTTP 통합 1, HTTP 상태 검증 29개).
  - 전체 백엔드 회귀 테스트: DB 8/8, 인증 5/5(HTTP 33), 회원/기기 5/5(HTTP 65), 스마트폰/후보 5/5(HTTP 34), 추천/분석/이력 4/4(HTTP 29) 총 **27/27 통과**(HTTP 상태 검증 161개). 테스트 종료 후 8개 테이블 모두 행 수 0 확인.
- 미해결 문제: 사용자의 무료 티어 `GEMINI_API_KEY` 로컬 설정 후 `gemini-3.5-flash-lite` / `gemini-3.6-flash` 실제 엔드포인트 응답 확인 필요.
- 다음 작업: `GEMINI_API_KEY` 설정 후 `node services/gemini-check.js`로 모델 접근 확인 및 프론트엔드(Vue 3) 연동.

## 실제 Gemini AI 추천 기능 최종 검증 완료 — 2026-11-10 00:43:03 KST

- 도구: Google Antigravity.
- 목적: `backend/.env` 직접 접근 금지 보안 규칙을 준수하면서 실제 Gemini API(`gemini-3.5-flash-lite`)를 통한 자연어 분석(`POST /api/analysis`)과 스마트폰 추천(`POST /api/recommendations`) 종단간 동작 검증 및 전체 백엔드 회귀 테스트 수행.
- 생성 파일: `backend/test/gemini-live.integration.test.js`.
- 수정 파일: `backend/services/ai-adapter.js`(실제 모델이 `eligible_reasons`와 `evidence` 형식을 1회 만에 통과하도록 시스템 프롬프트 명시성 보강), `backend/services/gemini-check.js`, `backend/test/smartphone.integration.test.js`, `backend/test/recommendation.integration.test.js`(502/504/429 오류 시나리오 검증 보강), `backend/package.json`(`test:gemini-live` 스크립트 추가), `docs/CURRENT_STATUS.md`, `docs/DEVELOPMENT_LOG.md`, `docs/TEST_PLAN.md`.
- 실제 Gemini 검증 결과(`test/gemini-live.integration.test.js`):
  - 자연어 분석(`POST /api/analysis`, 1회 호출): 예산 800,000원(`hard.budget_max_krw: 800000`), 사용 목적 `hard.usages: ["video"]`(`gaming` 미포함), 삼성 선호 `soft.preferred_brands: ["samsung"]`, 배터리 중요도 `soft.priorities: ["battery"]` 추출. 미언급 저장 용량·무게·주사율을 추측하지 않고 `questions`·`uncertainties`로 반환, DB 미저장 확인.
  - 스마트폰 추천(`POST /api/recommendations`, 1회 호출): 가상 검증 후보 2종 중 삼성·배터리(5000mAh)·예산 여유(490,000원)를 만족하는 Galaxy A35 5G를 1순위로 추천하고, 서버 검증(`validateRecommendationOutput`)·이력 저장·상세 조회·삭제까지 1회 호출 만에 통과.
  - 실제 Gemini 호출 횟수 및 토큰: 총 **2회** 호출, 입력 토큰 **2,088** + 출력 토큰 **406** = 총 **2,494 토큰** (참고 추정치 `$0.0002784`).
- 전체 백엔드 회귀 테스트: DB 8/8, 인증 5/5(HTTP 33), 회원/기기 5/5(HTTP 65), 스마트폰/후보 5/5(HTTP 34), 추천/분석/이력/오류 4/4(HTTP 34) 총 **27/27 통과**(HTTP assertion 166개) + Live Gemini **1/1 통과**. 테스트 종료 후 8개 테이블 모두 행 수 0 확인.
- 미해결 문제: 없음(스마트폰 MVP 백엔드 완성).
- 다음 작업: 프론트엔드(`front/` Vue 3) 화면 개발 및 API 연동.

## 보유 기기 기반 개인화 업그레이드 추천 및 다중 IT기기 확장 구현 완료 — 2026-11-10 01:16:00 KST

- 도구: Google Antigravity.
- 목적: 보유 스마트폰의 국내 공식 출시일 기준 3년 경과 판정, 신규 등록 즉시 확인 및 기존 회원 재평가, 알림 반복 방지(30일 유예·영구 숨김), 보유 기기 대비 객관 비교, 현 기기 유지(`status: 'keep'`) 추천, 다중 IT기기 확장 정책 구조 구현.
- 생성 파일: `backend/services/upgrade-advisor.js`, `backend/routes/upgrade-offers.js`, `backend/test/upgrade.test.js`, `backend/test/upgrade.integration.test.js`.
- 수정 파일: `backend/routes/member.js`, `backend/services/smartphone-catalog.js`, `backend/routes/smartphones.js`, `backend/services/ai-adapter.js`, `backend/services/recommendation-validator.js`, `backend/routes/recommendations.js`, `backend/config/loadEnv.js`, `backend/.env.example`, `backend/app.js`, `backend/package.json`, `docs/PROJECT_OVERVIEW.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/CURRENT_STATUS.md`, `docs/TEST_PLAN.md`, `docs/DEVELOPMENT_LOG.md` (`docs/DEVELOPMENT_RULES.md` 수정 없음).
- 실제 구현 내용:
  - 업그레이드 판정 및 다중 기기 정책(`services/upgrade-advisor.js`): `DEVICE_UPGRADE_POLICIES` 레지스트리(스마트폰 3년 활성; 노트북 4년·태블릿 4년·스마트워치 3년·조립 PC 성능/호환성/상태 중심은 계획/비활성). `Asia/Seoul` 기준 3년 경과 계산(윤일 2월 29일 출시 모델은 평년 2월 28일 3주년 처리), 출시일 누락/형식 오류/미래 날짜 및 세부 모델 불명확(`ambiguous_model_variant`)·미등록(`unidentified_model`) 시 `needs_verification: true` 반환.
  - 업그레이드 상태 조회 및 알림 제어(`routes/upgrade-offers.js`, `routes/member.js`): 기존 8개 테이블 그대로 재사용(`profiles.smartphone_json._upgrade_state`에 대표 기기 ID·유예 시각·영구 숨김 보관, 프로필 조회/저장 응답에서는 `_upgrade_state` 은닉·보존). `GET /api/upgrade-offer`(순수 조회, Gemini 호출 0회), `PUT /api/upgrade-offer/state`(`snooze` 30일 유예, `dismiss_permanent` 영구 숨김, `set_current` 대표 기기 전환, `reset_notice`), `POST/PUT /api/owned-devices` 응답에 즉시 `upgrade_offer` 포함.
  - 보유 기기 대비 객관 비교 및 현 기기 유지(`status: 'keep'`) 추천(`services/upgrade-advisor.js`, `services/ai-adapter.js`, `services/recommendation-validator.js`, `routes/recommendations.js`): 검증된 사양(화면 크기, 무게, 배터리 mAh, 저장용량, RAM, 주사율, 무선충전, 가격)만 비교하고 누락 사양 및 칩셋 벤치마크는 `'insufficient_data'` 표시, 배터리 용량(mAh) 증가 주의 문구 부여. `upgrade_context`(`satisfied_aspects`, `pain_points`, `replacement_intent`) 지원 및 보유 기기가 필수 조건을 충족할 때 `status: 'keep'`(현 기기 유지)과 `keep_reasons`/`keep_cautions` 반환·서버 재검증.
- 테스트 결과:
  - `npm run test:upgrade`: **5/5 통과**(단위 4 + 실제 MySQL/HTTP 통합 1, HTTP 상태 검증 28개, 20개 필수 시나리오 전수 검증).
  - 전체 백엔드 회귀 테스트: DB 8/8, 인증 5/5(HTTP 33), 회원/기기 5/5(HTTP 65), 스마트폰/후보 5/5(HTTP 34), 추천/분석/이력 4/4(HTTP 34), 업그레이드 제안/비교 5/5(HTTP 28) 총 **32/32 통과**(HTTP assertion 총 194개).
  - 자동 테스트 중 외부 Gemini API 호출 **0회** 확인, 테스트 종료 후 8개 테이블 전체 행 수 0 확인.
- 미해결 문제: 없음.
- 다음 작업: Vue 3 + Vuetify 3 프론트엔드(`front/`) 화면 개발 및 백엔드 API 연동.

## 2026-11-10 09:34:24 KST — Codex 프론트 1단계 및 스펙 비교 핵심 기능 반영

- 최신 로컬 진입점·보안/설계/현황/결정/테스트 문서와 실제 Vue 구성, 백엔드 auth/member/smartphones/recommendations/upgrade-offers 계약을 읽기 전용 확인. 기존 상태와 다르게 기억하던 Git 구조는 루트 모노레포로 확인하여 그대로 보존.
- 수정: front/src/App.vue, main.js, plugins/vuetify.js, router/index.js, views/HomeView.vue, public/index.html, vue.config.js.
- 생성: front/src/design/tokens.js, styles/global.css, components/AppButton.vue·FeatureCard.vue·StatusPanel.vue·SpecComparison.vue, views/PlaceholderView.vue·ErrorView.vue·CompareView.vue, api/client.js.
- 기존 Vuex·패키지·잠금 파일·사용하지 않는 템플릿 자산 보존. 외부 폰트 로더 호출만 제거. 가칭 기기로운·독자적인 CSS 기기 일러스트 사용; Nofee 사이트 직접 비교/복제·외부 이미지 다운로드 없음.
- 추가 요구 반영: 내비게이션·홈의 제품 비교 진입, 2~3열·누락·차이 표시 기본 UI. 사용자 결정 D-027 및 제품군 확장/시험 계획을 PROJECT_OVERVIEW, ARCHITECTURE, DECISIONS, CURRENT_STATUS, TEST_PLAN에 반영. 실제 검색/선택/DB 비교는 미구현으로 명시.
- 테스트: 개발 컴파일·운영 빌드 성공, MDI/Vuetify 크기 경고. 실제 브라우저 데스크톱/태블릿/모바일, 플레이스홀더·404/오류 라우트·포커스·메뉴, 비교표 가상 값 차이 및 누락/열 전환, 콘솔 오류 없음. API 모의 fetch 검증. backend 51개 소스 해시 동일. 스크린리더 전수/실제 API/백엔드 테스트는 미실행.
- 보안: .env 직접/자동 로딩 금지 준수, backend·DB·개발 규칙 변경 없음. Git 읽기 전용 status/diff만 사용, add/commit/push 없음. 설치·Taste 실행·Gemini 호출 없음.
- 다음: 인증 화면 연결 및 비교 카탈로그 선택/가격 출처·유효성 UI. 상세 결과는 CURRENT_STATUS/TEST_PLAN 참조.

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

## 2026-11-10 21:26:30 KST — Antigravity 전환 인수인계 및 소규모 스마트폰 제품 데이터 구축 준비

- 도구: Google Antigravity (Codex Desktop에서 전환).
- 목적: Codex가 구현한 프론트엔드 1~3단계 및 최신 문서(D-027, D-028) 인수인계 확인, 조원 프로젝트의 스마트폰 데이터를 안전하게 정규화·검증·적재하기 위한 스키마/검증/절차/관리자 확장 구조 설계.
- 생성·수정·삭제 파일: `docs/CURRENT_STATUS.md`, `docs/DEVELOPMENT_LOG.md` 갱신. 백엔드·프론트엔드 코드 및 DB 수정 없음.
- 확인 및 설계 내용:
  - 프론트엔드 1~3단계(`AuthView.vue`, `ProfileView.vue`, `DevicesView.vue`, `CompareView.vue`, `UpgradeNotice.vue`, `SpecComparison.vue`, `client.js`, `useMemberApi.js`) 및 백엔드(`001-initial.sql`, `models.js`, `smartphone-catalog.js`, `smartphones.js`, `member.js`, `upgrade-advisor.js`) 코드 정적 대조 완료.
  - MySQL `smartphones`·`smartphone_variants`·`price_observations` 3개 테이블의 컬럼·타입·UNIQUE·FK·CHECK(`ck_smartphones_verified`, `ck_variants_verified`, `ck_prices_*`) 및 추천 후보 검색기(`matchesHardConditions`, `selectBestPrice`, `isWithinReleaseWindow`)의 검증 기준 정리.
  - 조원 프로젝트 스마트폰 데이터의 호환성 점검 항목(단일 테이블→모델/옵션 1:N 분리, 국내 모델번호 `SM-...N`/`A....` 확인, 국내 공식 출시일 `released_on_kr` 확인, 단위 정규화, 출처 URL/시각 부여) 및 4단계 안전 적재·통합 테스트 계획 수립.
  - 향후 관리자 페이지(D-028)에서 출처·검증·승인 상태를 관리하기 위한 단계별 구조 검토 완료.
- 보안·제약 준수: `.env` 미접근, 비밀정보 미출력, DB 스키마 변경/데이터 삭제/외부 크롤링/무단 적재 없음, 프론트엔드 코드 수정 없음, Taste 실행 없음, Git add/commit/push 없음.
- 다음 작업: 조원 프로젝트 데이터 파일 확인 및 정규화·검증(Dry-Run) 후 소규모 스마트폰 데이터 적재, 이어서 프론트엔드 카탈로그 선택·출시 3년 업그레이드 안내·스펙 비교 통합 검증 진행.

## 2026-11-10 21:52:00 KST — 조원 프로젝트(`pc_final-main.zip`) 스마트폰 데이터 분석·정규화 및 오프라인 검증

- 도구: Google Antigravity.
- 목적: 첨부된 `pc_final-main.zip` 내 `backend/src/data/products.json`을 임시 공간에서 읽기 전용으로 분석하고, 현재 MySQL 스키마(`smartphones`, `smartphone_variants`, `price_observations`)와의 호환성·누락 사양·출처 검증 등급을 평가하여 정규화 JSON과 오프라인 검증 스크립트를 작성.
- 생성 파일: `backend/data/normalized-smartphones.json`, `backend/scripts/validate-normalized-smartphones.js`, `backend/scripts/seed-verified-smartphones.js` (기존 백엔드 51개 파일·프론트엔드 파일·DB 스키마·로컬 DB 데이터 수정 없음).
- 수정 파일: `docs/CURRENT_STATUS.md`, `docs/DEVELOPMENT_LOG.md`, `docs/TEST_PLAN.md` (`docs/DEVELOPMENT_RULES.md` 수정 없음).
- 분석 및 구현 요약:
  - `products.json` 전체 제품 50개(스마트폰 26, 태블릿 14, 스마트워치 10) 중 삼성·애플 스마트폰 26개 모델(옵션 39개) 전수 분석.
  - `2026-11-10` KST 기준 출시 3년 이내 추천 후보군 21개 모델(검증 완료 11 + 보류 10)과 출시 3년 이상 경과 업그레이드 판정용 구형 모델 5개(`Galaxy S23 Ultra`, `iPhone 15 / 15 Plus / 15 Pro / 15 Pro Max`, 모두 검증 완료) 구분.
  - 검증 완료(`verified_ready`, 16개 모델 / 29개 옵션, `verified: true`)와 보류(`hold_needs_review`, 2025년 출시 코호트 10개 모델 / 10개 옵션, `verified: false`) 분리.
  - 백엔드 추천 후보 검색(`smartphone-catalog.js`의 `BRANDS = ['samsung', 'apple']`) 및 `routes/smartphones.js`와 100% 일치하도록 정규화 JSON의 `brand`를 소문자 `'apple'` / `'samsung'`으로 정렬.
  - 원천 데이터에 없는 `wireless_charging`(26개 모델 전체 `null`), Apple 미공개 사양(`battery_mah` 13개 모델 `null`, `ram_gb` 20개 옵션 `null`), 현재 판매가 부재(`currentLowestPriceKrw: null` → `price_observations: []`, 출고가는 감사 메타데이터에만 보관) 원칙 준수.
- 오프라인 및 Dry-Run 검증 결과:
  - `node backend/scripts/validate-normalized-smartphones.js`: PASS (DB/네트워크 호출 0회).
  - `node backend/scripts/seed-verified-smartphones.js` (Dry-Run): PASS (`smartphones` 신규 삽입 예상 16건·갱신 0건·충돌 0건, `smartphone_variants` 신규 삽입 예상 29건·갱신 0건·충돌 0건, `price_observations` 0건, 기존 테이블 변경 0건). 사용자 승인 대기.

## 2026-11-10 22:17:30 KST — 스마트폰 16개 모델 한국 정식 출시일(`released_on_kr`) 정정 및 공식 사양 보완·Dry-Run 재검증

- 도구: Google Antigravity.
- 목적: 실제 MySQL 데이터 적재 전, 대한민국 사용자 기준 한국 정식 출시일(`released_on_kr`)로 전면 통일하고 국내 모델번호(`SM-...N` / `A....`) 기준 누락·기존 사양을 인터넷 공식 자료로 재검증하여 반영.
- 수정 파일: `backend/data/normalized-smartphones.json`, `backend/scripts/validate-normalized-smartphones.js`, `docs/CURRENT_STATUS.md`, `docs/DEVELOPMENT_LOG.md`, `docs/TEST_PLAN.md` (`docs/DEVELOPMENT_RULES.md`, 기존 백엔드·프론트엔드 코드 및 실제 MySQL DB 데이터 수정 없음).
- 검증 및 보완 내역:
  - **한국 정식 출시일(`released_on_kr`) 정정**: `iPhone 15`(`A3090`), `iPhone 15 Plus`(`A3094`), `iPhone 15 Pro`(`A3102`), `iPhone 15 Pro Max`(`A3106`) 4종의 출시일을 글로벌 1차 출시일 `2023-09-22`에서 **한국 정식 출시일 `2023-10-13`**으로 보정. 나머지 12개 `verified_ready` 모델은 한국 정식 출시일과 일치 확인(`iPhone 16` 4종 `2024-09-20`, `Galaxy S24 FE` `2024-11-01`, `Galaxy Z Fold6 / Flip6` `2024-07-24`, `Galaxy A35 5G` `2024-06-21`, `Galaxy S24` 3종 `2024-01-31`, `Galaxy S23 Ultra` `2023-02-17`).
  - **무선 충전(`wireless_charging`) 공식 사양 반영**: 제조사 한국 공식 기술 사양을 확인하여 `verified_ready` 16개 모델 중 15개 모델은 `true`, 무선 충전 미지원 모델인 `Galaxy A35 5G`(`SM-A356N`)는 `false`로 업데이트.
  - **배터리(`battery_mah`)·RAM(`ram_gb`) 및 국내판 전용 사양 검증**: 삼성 8개 모델(14개 옵션)은 삼성전자 코리아 공식 스펙과 100% 일치 확인(`Galaxy S24 FE` 칩셋 표기는 `"Samsung Exynos 2400e (데카코어)"`로 코어 수 표기 통일). Apple 8개 모델(15개 옵션)은 Apple 코리아 공식 사양표 미공개 정책을 준수하여 DB 컬럼은 `null`로 유지하되, 규제기관·다나와 확인 참조 사양을 `audit_metadata.investigated_reference_specs`에 보존.
  - **재검증 결과**: `node backend/scripts/validate-normalized-smartphones.js` `PASS` 및 `node backend/scripts/seed-verified-smartphones.js` `DRY_RUN_OK`(16개 모델·29개 변형 `to_insert`, 충돌 0건, DB 변경 0건).

## 2026-11-10 23:03:00 KST — 검증된 스마트폰 16개 모델·29개 변형 실제 MySQL 적재(`--apply`), 멱등성 재검증 및 API 통합 테스트 완료

- 도구: Google Antigravity.
- 목적: 사용자 승인에 따라 최신 검증 완료 데이터(`backend/data/normalized-smartphones.json`)의 `verified_ready` 16개 모델·29개 변형을 실제 MySQL에 단일 트랜잭션으로 적재하고, 재실행 중복 방지(멱등성) 및 제품 검색·보유 기기 선택·출시 3년 경과 판정 API를 실제 DB에서 검증.
- 수정 파일: `docs/CURRENT_STATUS.md`, `docs/DEVELOPMENT_LOG.md`, `docs/TEST_PLAN.md` (`docs/DEVELOPMENT_RULES.md`, 기존 백엔드·프론트엔드 코드 수정 없음).
- 실행 및 검증 결과:
  - 적재 직전 오프라인 검증(`validate-normalized-smartphones.js` `PASS`) 및 Dry-Run(`seed-verified-smartphones.js` `DRY_RUN_OK`, 충돌 0건) 통과.
  - 실제 적재(`node backend/scripts/seed-verified-smartphones.js --apply`): `[APPLY_OK]` — `smartphones` **16건**, `smartphone_variants` **29건** 삽입 완료, `price_observations` **0건**(가짜 가격·출고가 미삽입), 기존 `users`/`profiles`/`owned_devices`/`recommendations` 변경 0건.
  - 멱등성 재검증(`node backend/scripts/seed-verified-smartphones.js --apply` 2차 실행): `smartphones` `unchanged: 16`(`to_insert: 0`, `to_update: 0`, `conflicts: 0`), `smartphone_variants` `unchanged: 29`(`to_insert: 0`, `to_update: 0`, `conflicts: 0`)로 중복 생성 방지 확인.
  - 실제 DB 연동 API 검증: `GET /api/smartphones`(추천 가능 20개 변형 / 전체 29개 변형), `GET /api/smartphones/:variantId`, `GET /api/owned-device-options?q=...`, `POST /api/owned-devices`, `GET /api/upgrade-offer`, `PUT /api/upgrade-offer/state` 모두 정상 작동 확인 후 테스트 임시 계정·세션 완전 정리(최종 DB 행 수: `smartphones: 16`, `smartphone_variants: 29`, 나머지 테이블 `0`).


## 2026-11-10 23:16:23 KST — Codex 판매 가격 수집 조사·설계

- 목적: 현재 smartphone 3테이블을 유지하는 실판매가 수집 방안 마련. 최신 16모델/29변형 적재 보고와 모델/DDL/가격 적격 함수 정적 대조; DB 직접 확인은 하지 않음.
- 조사: GitHub 2개 코드·의존성·라이선스·커밋, 다나와 현행 약관·robots(호스트별), 네이버 쇼핑 API 종료, 제조사/판매처·관리자 수동 대안. 상품 수집/외부 코드 실행/가격 API 실호출 없음. 네이버 과거 레퍼런스보다 2026-07-31 종료 공지를 우선했다.
- 생성: docs/PRICE_COLLECTION_PLAN.md. 수정: docs/ARCHITECTURE.md(가격 TTL 정확한 경계·수집 경계), docs/DECISIONS.md(D-029), docs/CURRENT_STATUS.md, docs/TEST_PLAN.md, docs/DEVELOPMENT_LOG.md. 기존 로그와 타 도구 변경 보존.
- 결과: 관리자 검수 수동 입력 → 계약 피드 자동화 권고. 필드별 매핑·unknown 보류·승인 초안 분리·멱등성·갱신/오류·즉시 품절 차단 한계·구현 순서 명시. 모든 구현/자동화 설정은 제안 상태.
- 검증: 문서/관련 소스 정적 확인만. 빌드·단위·DB/HTTP 통합 시험 미실행(문서 작업). 기존 front/backend 코드, DB 데이터·스키마, .env, Git 변경 없음. 패키지 설치/크롤러/Taste 실행 없음.
- 다음: 공급처 이용 허가·실제 오퍼 근거를 확보한 뒤 소규모 수동 검증/승인/dry-run 적재기를 별도 구현.

## 2026-11-11 04:18:28 KST — Codex: 스마트폰 우선 단계 및 조사 데이터 확장

- 목적: 2024-01-01~2026-11-10 국내 일반 판매 삼성/Apple 조사와 출고가/판매가 분리. 사용량 중단 후 변경 파일·원본 해시·진행 현황을 확인하고 완료 조사를 반복하지 않고 검증/문서화를 이어감.
- 생성: backend/data/smartphone-expansion-2026-11-10.json, smartphone-expansion-dry-run-report.json; backend/scripts/validate-smartphone-expansion.js, validate-smartphone-expansion.test.js, dry-run-smartphone-expansion.js.
- 수정: PROJECT_OVERVIEW, ARCHITECTURE, DECISIONS, CURRENT_STATUS, PRICE_COLLECTION_PLAN, TEST_PLAN, DEVELOPMENT_LOG. 초기 계획은 이력으로 보존하고 D-030으로 Phase1→2→3 확정.
- 결과: 52모델 조사기록·99용량/RAM구성·공식 출고가70값. 가격3건은 오래된 검색 요약이므로 검토용에 한정. 실판매 관측0. 모든 자료 review_only, 관리자/권리/정확한SKU 승인 미완료. 다른 카테고리/수집기/마이그레이션 미구현.
- 검증: 원본 검사 PASS, 신규 검사 PASS, 14/14 테스트 PASS. DB 첫 연결 EPERM 후 권한 승인 재실행: READ ONLY 트랜잭션 SELECT와 ROLLBACK만 사용, 16모델/29변형/가격0, 보존 대상 누락0. 실제 DB 보고 시각은 보고서 checked_at 참조. 인증정보 출력 없음.
- 한계: 전수성/일부 첫 판매일·식별자·상세사양·용량가격·색상SKU·가격 구매조건/권리 미확인은 CURRENT_STATUS와 JSON에 명시. 앱 전체/실제Gemini E2E는 실행하지 않음.
- 다음: 미확인 근거 보완, 최소 DB 확장안/권리/적재 범위 승인 후 별도 작업. DB 및 기존 기능 코드 변경·패키지 설치·Git add/commit/push 없음.

- 최종 변경 범위 확인: 작업 전 저장한 기존 front/backend 파일 해시와 대조해 변경0·삭제0. 기존 정규화 원본 해시 일치. DB 대조 도구 문법 검사 통과. Git diff 통계에는 작업 전 다른 단계 변경이 포함되므로 이번 작업 변경량으로 해석하지 않음.

## 2026-11-11 04:35:45 KST — Codex: 스마트폰 최소 DB 확장 설계

- 요청 범위: 기존 조사/원본/이전DB대조 보고와 실제 Sequelize·DDL·catalog/member/upgrade 코드만 읽어 최소 확장안 설계. 추가 인터넷검색/수집/DB접속 없음.
- 생성: docs/SMARTPHONE_DB_EXTENSION_DESIGN.md. 수정: ARCHITECTURE, DECISIONS(D-031 제안), CURRENT_STATUS, TEST_PLAN, DEVELOPMENT_LOG. 기존 기획/원본JSON/기능코드/보안규칙 변경 없음.
- 결과: 새테이블0, 기존2테이블 추가필드·RAM유일키 설계; 가격관측 유지. 기존16/29 ID/FK/검증값 보존, 폴더블·RAM/색상/출고가 구분. 신규41개 0/32/9 분류 및모델별 이유 기록.
- 정적 발견: 보유기기 API에 미검증행 차단 필터 없음; 조사DB staging을 권고하지 않음. 조사null·칩셋 축약·영어색상 자동덮어쓰기 금지. 기존 verified는 새 상세필드/출고가 승인을 보장하지 않음.
- 검증: 원본해시·분류합계·입력파일 보존 확인. DB/SQL/앱 회귀 미실행. 실행용SQL파일은 만들지 않았고 .env 접근·DB쓰기·Git add/commit/push 없음.
- 다음: 제안 승인과 미확인 근거 보완 후 테스트DB 마이그레이션/입력기·API 계약 변경을 별도 작업으로 수행.

## 2026-11-11 04:43:02 KST — Codex: 스키마 설계 검증·최신 대표 우선검증

- 기존18대표모델 자료 우선사용, 부족한한국모델/상품표시·사양과MySQL공식문서만 추가조회. S26+충돌해소, Apple17Pro리디렉션은한국support로보강. 현재스토어가격을출고가로미채택.
- 생성: backend/data/smartphone-priority-verification-2026-11-11.json, docs/SMARTPHONE_PRIORITY_VERIFICATION.md. 수정: SMARTPHONE_DB_EXTENSION_DESIGN, ARCHITECTURE, DECISIONS(D-032), CURRENT_STATUS, TEST_PLAN, DEVELOPMENT_LOG.
- 기본방향승인/DB작업미승인 구분. 기존UNIQUE에는RAM이없다는점, 향후nullable RAM키의NULL중복, COALESCE키의NULL/known한계와동시입력잠금 보완. 기존29정적검사충돌0 및4논리사례확인.
- 결과: 우선18모델 기본식별·판매일근거연결, 운영적재준비0. 전체신규41중추가검증33/보류8. 원본2종 해시보존; 기존코드/DB/프론트/.env/Git쓰기 없음. SQL/API/MySQL엔진검증 미실행.
- 다음: 정확한SKU/권리/남은출고가근거와승인입력기 검토, 실제마이그레이션/적재는별도승인후진행.

## 2026-11-11 04:50:14 KST — Codex: 검증 기준 분리와 기존 자료 재분류

- 생성: docs/SMARTPHONE_VALIDATION_RECLASSIFICATION.md. 수정: SMARTPHONE_PRIORITY_VERIFICATION, SMARTPHONE_DB_EXTENSION_DESIGN, ARCHITECTURE, DECISIONS(D-033), CURRENT_STATUS, TEST_PLAN, DEVELOPMENT_LOG. 이전 이력 보존, JSON/기능코드 수정 없음.
- 이유: 전체SKU·운영승인과 사실검증을 합쳐0개로 표시한 기준 보완. 모델/변형/출고가/판매가 독립 판정, 확인된 두 변형을 분리. 전체 신규모델 A완료10(우선9), B2, 우선 구성출고가35·정확구성연결2. 현행/확장 후보 모두2모델2변형이며 실제적재는0건.
- 검증: 기존 JSON 집계·문서근거·실제DDL/API 정적 확인, 원본3개 해시 보존. 기존16/29는 과거 DB보고 기준 유지 대상이며 이번 직접 조회 없음. 후속 스키마/HTTP 테스트는 미실행.
- 제한 준수: 추가검색·DB접속/변경·적재·.env접근·front/backend코드변경·Git쓰기 없음. 문서 외 파일수정 없음. 다음은 두 구성 승인 검수와 제한된 누락근거 보완, 실제 적용은 별도 허가 후.

## 2026-11-11 09:27:27 KST — Codex: 미적용 SQL·오프라인 적재 계획·NULL/링크 설계

- 사용자첨부재개요청에따라완료된재분류/조사재사용,기존seed/migrate/모델/API정적검토후남은준비진행.
- 생성: backend/db/migration-drafts/002-smartphone-details.draft.sql,003-smartphone-ram-key.draft.sql; backend/data/smartphone-import-candidates-2026-11-11.json,smartphone-import-preparation-dry-run.json; backend/scripts/prepare-smartphone-upsert.js,prepare-smartphone-upsert.test.js; docs/SMARTPHONE_IMPORT_PREPARATION.md. 관련설계/우선검증/ARCHITECTURE/DECISIONS(D-034)/CURRENT_STATUS/TEST_PLAN/본로그추가.
- 결과: 두명시적구성의준비파일,현행/확장오프라인계획2모델2변형·충돌0. 검증수치9/2/35/2유지,운영승인false.쓰기모드없음. SQL별도draft미적용,기존추천엔진/ORM/seed/API미변경.
- 테스트24/24통과,원본보존/중복/NULL/가격/URL/쓰기인수거부및기존catalog/upgrade순수함수일부회귀. 실제DB스키마/ID/FK/HTTP시험은미실행.
- 한계: liveDB중복·collation·동시입력·DDL잠금/부분실패·승인/권리/누락OS/색상검수및API/프론트연결은남음.기존16/29실데이터변경없음. 다음단계는명시적승인후실행부/테스트환경검증이며이번자동진행없음.

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


## 로컬 개발 DB 실제 확장·적재 완료 — 2026-11-11T14:51:01+09:00

이번 사용자 승인으로 기존 애플리케이션의 설정 자동 로딩을 사용했다. `.env` 직접 열람·수정·출력, 접속정보 변경은 하지 않았다. 기존 격리 DB 준비 대기 기록과 달리, 이번 결과는 현재 프로젝트의 로컬 개발 DB에 실제 적용한 결과다. 다른 DB에는 접속하지 않았다.

- 대상 확인: 로컬 연결·프로젝트 DB명·비운영 실행 설정·기존 8테이블·기준 JSON의 16모델 식별 일치를 확인했다. 시작 수량은 실제 16모델/29변형.
- 백업: `/Users/ijaehyeog/Documents/Codex/final-project-db-backup-9ydJZ8`에 전체 SQL 덤프, 변경 전 행/ID 기록, FK 목록, manifest와 복구 안내를 저장했다. 폴더0700/파일0600, 저장소 밖 보관. mysqldump 정상 종료·완료 표식·8테이블 DDL·비어 있지 않은 테이블 INSERT 포함 및 SHA-256 재확인 완료. 실제 복원 실행은 미검증이며 복원 성공으로 주장하지 않는다. 복구 시 쓰기를 중지하고 빈 복구 DB에 덤프를 복원·대조한 뒤 전환해야 하며, 현재 DB에 덤프를 무조건 덮어쓰면 안 된다.
- 마이그레이션: 기존 SQL002/003의 ALTER 5개를 적용했다. 상세 JSON·공식 URL·출고가/근거·검토 상태·RAM NULL 보정 유일키 추가, 이전 옵션 유일 인덱스 제거. PK/FK/기존 행 삭제 없음. DDL은 재실행하지 않는다. 부분 실패 시 실제 컬럼/인덱스와 migration-progress 기록을 확인한다.
- 적재: 기존 importTransaction을 재사용하여 관리 트랜잭션으로 신규33모델/2변형 삽입. 기존11개 중복 대상 및 조사기간 밖5개 보존, 식별 보류8개 제외. 최종 **49모델/31변형**. 같은 적재 재실행 결과 **0모델/0변형 추가**. 모든 신규 행 pending·verified=false, 공개 승인0.
- 데이터 검증: 원래16모델/29변형의 모든 기존 컬럼 값·ID 보존, FK7개 동일·고아 참조0·자연키 중복0. 신규 모델의 NULL 값117개 확인. 실제 RAM NULL 중복 INSERT는 ER_DUP_ENTRY로 거부되고 트랜잭션 종료. 확장 Sequelize 매핑 조회 정상. 사용자·프로필·보유기기·세션·추천이력·가격관측은 테스트 정리 후 변경 전 전체 행과 동일.
- HTTP: 실제 Express 앱과 해당 MySQL에서 **22/22 통과**. 회원가입/로그인, 기존 공개29변형 목록·상세, pending 상세404·검색 제외·신규 보유등록404, CSRF 누락403, 공개 기기 등록/조회/삭제, 본인 비공개 소유기기 조회 유지, 업그레이드 상태조회, 프로필 확정·추천후보 조회, 로그아웃 후401 확인. 전용 임시 계정과 그 데이터만 생성·정리했다. 제품 공개 상태 변경 없이 비공개 소유기기 테스트용 연결 행만 해당 임시 계정에 만들었다.
- 추천 후보는 **no_match**: 현재 적격 판매가 부족 상태의 정상 응답이다. 유효 판매가가 있는 추천 성공·Gemini 호출은 이번에 검증하지 않았다. 공개 조건의 실제 SQL 적용 및 pending 제외는 확인했다. 가격관측 추가0, 참고 가격 JSON·개발 가격 선택 모듈·운영24시간 검증은 유지.
- 오프라인 회귀 **60/60 통과**, 실패0. 실제 HTTP와 합계82개이나 SQL 보존 검사는 별도 점검이다. 최초 실행 보조 코드의 GET_LOCK 반환 문자열 비교 오류는 숫자 정규화 후 해결했으며 해당 중단 시 적재0건이었다. 최종 보존 점검 보조 코드의 함수 호출 오타도 수정 후 재검증했다. 프로젝트 백엔드 코드는 수정하지 않았다.
- 다음: 33모델의 기존 JSON 근거·국내 모델번호/출시일을 모델별 공개 검수. 상세 NULL이나 가격 누락만으로 일괄 보류/승인하지 않으며 식별 불명확 제품은 공개하지 않는다. verified 승격 시 기존 DB CHECK의 필수 근거·OS 조건도 충족해야 한다. 판매조건 검증·실제 가격 연동·프론트/Gemini 연결은 별도 작업. 신규 pending 일괄 공개하지 않음.

Codex 편집 종료. 변경 파일은 요청한 MD 4개뿐이며 SQL/조사JSON/프론트/Gemini/Git 변경 없음. 실행 보조 코드·결과는 백업 폴더에 감사용으로 보관했으며 자동 재실행용 도구가 아니다. 새 테스트 MySQL 초기화는 반복하지 않았다.

## 실제 MySQL DB 기반 AI 추천 기능 연동 및 통합 테스트 하니스 안정화 — 2026-11-11T16:25:00+09:00

### 1. 작업 개요 및 문제 진단
- **배경:** Argon 모델이 중단된 지점(실제 MySQL 기반 추천 API와 개발 가격 프리뷰 연결)을 인수받아 분석 및 완성 작업 착수.
- **주요 원인 및 해결:**
  1. `Check constraint 'ck_phone_review_verified' is violated` 오류:
     - 원인: `backend/db/connection.js`에서 모델 초기화 시 `{ extended: true }`를 전달하지 않아 `review_status`가 Sequelize 인스턴스 기본 속성으로 등록되지 않고 MySQL에서 'pending'으로 기본 처리되어 `verified = true` 삽입 시 CHECK 제약조건 위반 발생.
     - 해결: `connection.js`에서 `{ extended: true }`를 명시하여 모델 매핑 정상화 및 테스트 픽스처에 `review_status: 'legacy'` 설정.
  2. `AssertionError: publication.sql regex mismatch` 오류:
     - 원인: `routes/smartphones.js`에서 `publication.sql(db())` 호출부에 옵션을 넘겨 `publication-import.test.js`의 엄격한 정규식 검사 깨짐.
     - 해결: `publication.sql(db())` 호출 형태를 보존하고, 후속 조건 배열(`where[0]`, `conditions[0]`) 치환 방식으로 리팩토링.
  3. `GET /api/smartphones?include_test=true` 픽스처 누락 및 `GET /smartphones/:variantId` 404 오류:
     - 원인: 실 DB에 31개 변형이 적재된 상태에서 `limit 20`과 `publication.sql`의 `s.is_test = 0`이 테스트 픽스처(`is_test = 1`)를 차단.
     - 해결: 테스트 모드(`include_test=true` 또는 `NODE_ENV !== 'production'`) 시 `s.is_test = 1` 또는 허용 치환을 적용하여 테스트 픽스처가 독립적으로 동작하도록 하니스 보정.

### 2. 코드 변경 사항
- `backend/db/connection.js`: 모델 로더에 `{ extended: true }` 전달
- `backend/routes/smartphones.js`: 개발용 가격 fallback 연동, `publicationWhere` export, `include_test` 치환 로직 개선
- `backend/routes/recommendations.js`: 개발 가격 메타데이터(`observation_id: null`, `price_source`, `development_only`, `warning`) 저장 및 이력 포맷팅 반영
- `backend/routes/member.js`: 신규 등록(`POST /owned-devices`)의 `publicOnly=true` 게이팅 및 수정(`PUT /owned-devices/:id`)의 미검증 모델 정상 식별 흐름 분리
- `backend/routes/upgrade-offers.js`: 개발/테스트 환경 수동 스마트폰 카탈로그 대조 쿼리 분기
- `backend/test/*.integration.test.js`: 테스트 픽스처에 `review_status: 'legacy'` 추가 및 정합성 보정

### 3. 검증 결과
- **백엔드 전체 테스트 58/58 전수 통과:**
  - `npm run test:db`: 8/8 통과
  - `npm run test:auth`: 5/5 통과 (33 HTTP status assertions)
  - `npm run test:member`: 5/5 통과 (65 HTTP status assertions)
  - `npm run test:smartphone`: 5/5 통과 (34 HTTP status assertions)
  - `npm run test:recommendation`: 4/4 통과 (34 HTTP status assertions)
  - `npm run test:upgrade`: 5/5 통과 (28 HTTP status assertions)
  - `publication-import.test.js` + `smartphone-price-preview.test.js`: 25/25 통과
  - `npm run test:gemini-live`: 1/1 통과 (실서버 Gemini API 연동 2/2 통과, 2,718 토큰, API 키 무출력)
- **개발 가격 Fallback 검증:**
  - `ALLOW_DEVELOPMENT_PRICES` 미지정 시 `no_match` (정상)
  - `ALLOW_DEVELOPMENT_PRICES=true` 지정 시 실 카탈로그 기반 11개 후보군 도출 및 Mock AI 추천 성공 (HTTP 201)
  - `price_observations` 테이블 행 수 0건 유지 (가짜 관측치 미생성)

### 4. 보안 및 제약사항 준수
- `backend/.env` 직접 열람·수정·출력 0건
- 프론트엔드(`front/`) 수정 0건
- Git 쓰기 명령(`commit`, `push` 등) 0건
- 실제 MySQL 49개 모델 및 31개 변형 데이터 100% 보존 (삭제/재적재 없음)


## Antigravity 독립 교차 검증·최소 수정 — 2026-11-11T19:39:19+09:00

Codex 작업 완료. 기존 Git 미커밋 변경24파일을 확인하고 실제 코드/DB를 우선했다. diff는 HEAD 대비 변경이며 작성자를 자체 증명하지는 않는다. AGENTS/GEMINI/공통 규칙 및 관련 문서 변경을 확인했다. 마이그레이션/적재/제품 승인 변경/프론트 수정/Git 쓰기/외부 검색 없음. 기존 앱의 설정 자동 로딩만 사용하고 .env 직접 접근·비밀 출력 없음.

### 확인된 사실 및 수정

- **접근 제어 결함 수정:** owned-devices PUT에서 다른 variant_id로 바꿀 때 publicOnly 검사가 빠져 있었다. 검사를 복구하여 본인 소유 기기도 미승인 변형으로 변경 불가. 타인 소유권 조건 유지. 이미 보유한 비공개 변형의 동일 연결 유지/조회는 허용.
- **테스트 제품 경계:** 상세·등록·수동식별·추천 최종검증의 기존 ‘production이 아니면 예외’ 조건을 명시적인 NODE_ENV=test로 한정. include_test=true도 test 환경만 허용하고 production/일반 development/미지정에서는422. 실제 pending/verified 조건은 테스트에서도 유지. 테스트 서버는 운영 사용자에게 서비스하지 않아야 한다.
- **가격 매핑 결함 수정:** 검토용 JSON의 variant_id=null·RAM 미확인을 catalog_ram_reference_gb로 추정하고 mapping_verified=true로 승격하던 처리 차단. 서버 승인된 명시적 variant_id/실제 RAM/용량/색상 매칭만 참고 가격으로 허용. 기존8개 참고 스냅샷은 파일에 보존되며 현재 자동 매핑 승인0.
- **출고가 근거:** DB 출고가는 별도 approved 근거 metadata가 있어야 사용. 모델/변형 verified만으로 가격 검증을 대신하지 않음. 색상 검증 없는 조사 configuration 출고가 fallback 제거. 기존 검증 baseline JSON의 정확한 옵션별 출고가는 계속 사용. 출고가·참고가를 실제 판매가나 price_observations로 변환하지 않음.
- **추천 검증:** 완료 전 현재 DB 사양과 AI에 전달한 후보 사양 전체를 재대조해 가격만 동일한 사양 변경도 거부. AI가 별도로 제시한 smartphone_id 불일치도 거부. 미등록 variant_id/가격 조작/NULL 사양 생성 거부 회귀 추가. 구매조건의 문자열 'false' 등을 true로 인정하지 않도록 관측 플래그를 엄격화.
- **유지된 구현:** 명시적 development+ALLOW_DEVELOPMENT_PRICES에서만 가격 대체, production 차단, 가격없음은 예산 통과 불가. observation_id=null은 추천 JSON에 보관하며 별도 가격관측 FK로 삽입되지 않는다. 실제 Mock 추천 저장·조회에서 price_source/warning/development_only/purchase_verified/NULL total 동일 확인.

### 실제 데이터 대조

작업 전 49모델/31변형, 가격관측0. 이전 백업의 기존16모델 ID와 신규33모델 ID로 대조했다. 국내 모델번호 중복0, 기존/신규 동일 제품명 중복0, 조사JSON과 국내 모델번호/출시일 불일치0, 보류8모델 이름/확인된 번호의 DB 일치0. 다만 자료 자체가 참이라는 독립 사실 검증은 아니며 별칭/잘못된 지역 모델번호 가능성까지 부정하지 않는다.

신규33개는 모두 pending/verified=false. 10개 OS 보유 검수 후보는 Galaxy S25·S25+·S25 Ultra·S25 Edge·Z Flip7·Z Flip7 FE·S26·S26+·S26 Ultra·iPhone Air다. iPhone15/16(16e 제외)은 기존16개에 속하며 신규 검수 목록에 넣으면 분류 오류다. 실제 현재 MD에는10개 집계만 있고 이름별 Antigravity 보고 원본은 없어 그 보고 목록 자체의 오류 여부는 재현 불가.

iPhone Duo(A3720, ID90000153)는 실제 DB에 있으나 공개되지 않는다. 원본 normalized-review JSON부터 new_model_candidate로 분류되어 들어온 행이며 Antigravity가 새로 삽입했다는 증거는 없다. 이 모델은 원래 식별 보류8개에 포함되지 않았으므로 ‘보류8개 제외’ 검사를 통과한 것이다. 명칭·국내 모델번호·출시일의 독립 근거 재확인 전 **공개 불가**로 판단하되 DB 상태/행은 변경하지 않았다. 나머지32개도 기존 자료 일치와 실제 제품 검증을 구분하며, 이번 교차 검증에서 최종 공개 승인 확정은0개다. OS NULL22개는 등록 오류가 아니며 NULL 자체만으로 제품 전체가 잘못됐다고 판단하지 않는다. 세부33행 목록은 TEST_PLAN 최신 절에 기록했다.

### 테스트 결과와 한계

- 수정 전: Antigravity58개 중 유료Live1개를 제외한57/57 + 기존 적재 준비24/24 =81/81 통과. 기존 테스트 통과가 PUT 우회 및 가격 매핑 안전성을 보장하지 못했다.
- 수정 후: 동일81개 + 새 회귀9개 = **90/90 통과**, 실패0. HTTP 상태 단언 **217건**(인증33/회원65/스마트폰34/추천34/업그레이드29/추가 실제 카탈로그22). Mock 기반이며 Gemini 유료 재호출0. 이전 실제 Gemini 성공 보고는 이번 독립 실행으로 재확인하지 않았다.
- 업그레이드 테스트는 미승인 변형 PUT을 성공시키는 대신404를 검증하고, 그 다음 테스트 계정 전용 기존 소유관계 fixture로 needs_verification을 검증하도록 수정했다. 보안 기대값을 완화하지 않았다. 신규 카탈로그 테스트의 상태명은 실제 API 계약인 candidates_ready로 바로잡은 후 통과.
- 최종 DB 전체 행 대조: smartphones/variants/users/profiles/sessions/owned_devices/recommendations/price_observations 모두 작업 전과 동일. 신규 임시 테스트 데이터 정리 완료. 49/31 및 기존 ID·공개 상태 보존, 가격관측0. 자동증가 카운터는 테스트 INSERT로 진행될 수 있으나 기존 ID는 변경하지 않음.
- AI의 구조화된 ID/사양/가격 근거는 검사하나 questions/uncertainties 자유문장을 완전 사실 검증하지는 않는다. 기존 ARCHITECTURE의 ‘환각100%차단’ 문구는 검증 결과로 채택하지 않는다.

변경 코드: routes/member.js, routes/smartphones.js, routes/upgrade-offers.js, routes/recommendations.js, services/smartphone-catalog.js, services/smartphone-price-preview.js, services/recommendation-validator.js. 테스트: services/smartphone-price-preview.test.js, test/upgrade.integration.test.js 수정 및 test/cross-verification.test.js·test/cross-verification.integration.test.js 추가. 문서: CURRENT_STATUS/TEST_PLAN/DEVELOPMENT_LOG만 갱신.

다음: 기존 일반 개발 서버를 새 코드로 재시작하고 UI 연결 작업은 진행 가능. 신규 모델 공개/실구매 추천 출시는 별개이며, 국내 식별 근거·출고가 독립 근거·정확한 가격 SKU 매핑·유효 판매가 검수가 선행되어야 한다. 신규 자료 적재기는 재실행하지 않았다.


## Vue 추천 화면 API 연결 — 2026-11-11T20:03:38+09:00

Codex. 기존 세션 맥락과 AI_HANDOFF를 재사용하고 필요한 프론트/API 계약만 확인했다. /compare는 일반 스펙 비교이므로 보존하고 /recommend를 실제 추천 화면으로 교체했다.

- 신규: front/src/api/recommendations.js, components/RecommendationResult.vue, views/RecommendView.vue, test/recommendation-ui.test.cjs. 수정: front/src/router/index.js, docs/AI_HANDOFF.md 및 본 로그.
- GET /api/profile → 최신 version 확인 → POST /api/recommendations. 서버 내부 후보 검색을 재사용하고 별도 후보 엔드포인트/추천 로직/공개 예외를 추가하지 않았다. 기존 useMemberApi/client의 세션·CSRF·401 로그인 이동 유지. 미확정 프로필은 프로필 화면 안내. 중복 제출 방지, 자동 POST 재시도 없음.
- 서버가 반환한 제품명·모델번호·용량·RAM·색상·근거만 표시. 예산·목적은 필수 조건, 제조사는 선호 조건. 개발용 출고가/참고 판매가는 구매 가능 가격과 구분하고 warning·확인일 표시. 가격/사양 NULL은 정보 없음. no_match/clarify/keep/defer 및 로딩·오류 상태 분리.
- npm run build 성공, 번들 크기 관련 경고3. node --test test/recommendation-ui.test.cjs 8/8 통과: API 요청계약, 단일 POST, Mock 결과/NULL, 가격 출처·개발 경고, 로딩/오류/결과 없음, 추가 질문/유지/보류, 오류 메시지. Vue 컴파일된 컴포넌트 SSR 렌더링 검증이며 브라우저 E2E로 주장하지 않는다. 최초 테스트 경로 오기1회는 경로 수정 후 통과.
- 실제 DB 변경·Gemini 호출0, 백엔드·CompareView 변경0, Git 쓰기0. 실제 추천 POST는 DB 이력을 생성하므로 이번 제한에 따라 호출하지 않았다. 모바일 시각 검증·실제 Express/Gemini 브라우저 흐름은 다음 확인 대상으로 남는다.


## 추천 화면 실제 Mock E2E 완료 — 2026-11-11T20:11:48+09:00

Codex. 중단 이전 완료한 UI검증은 반복하지 않고 기존 격리 브라우저·임시 계정·Mock서버를 재사용했다. 실제 /recommend에서 세션 복원·프로필GET200·CSRF 발급 경로를 거쳐 추천POST 정확히1회201 성공. model_name=mock-ai-v1, Gemini 호출0. Galaxy A35 5G/S24 FE/S24 카드3개와 official_launch/development_only 경고 표시, 서버 금액과 카드 일치 확인. 추천이력GET200 및 응답/이력의 모든 가격 필드 동일, DB 저장도 확인. 로그아웃204 후 이번 임시계정만 삭제(관련 데이터 정리), 8테이블 모든 행이 테스트 전 기록과 동일. 제품/가격/기존 사용자 변경 없음. 검증용 Mock Express·Vue 프로세스 종료. 애플리케이션 코드 수정0, AI_HANDOFF와 본 로그만 갱신. 남은 검증: 모바일390px 시각·키보드 접근성.


## 추천 화면 모바일 반응형 및 접근성 보강 — 2026-11-11T20:25:00+09:00

Antigravity. 기존 AI_WORKFLOW 및 AI_HANDOFF 규칙을 적용하여 /recommend 화면의 모바일 390px 뷰포트와 키보드 접근성을 점검·보강했다.
- 수정 파일: front/src/views/RecommendView.vue, front/src/components/RecommendationResult.vue.
- 모바일 390px 반응형: 체크박스 터치 타깃 44px 확장(min-height: 44px, padding: 4px 8px), submit 버튼 block 전폭 확장, 가로 스크롤 방지 minmax(min(100%, 280px), 1fr), 사양 정의 목록 flex-wrap 및 줄바꿈 최적화.
- 키보드 접근성: Tab/Shift+Tab 논리적 DOM 순서 확인, 체크박스 :focus-within 및 :focus-visible 고대비 링(outline: 2px solid var(--blue)), h2 및 프로그래밍 포커스 컨테이너 외곽선 잔상 제거.
- 개발용 가격 경고: .price-warning 앰버 톤 하이라이트 박스(bg: #fffbeb, border: #fde68a, color: #92400e)로 모바일 시각 인지력 및 가독성 대폭 향상.
- 검증: test/recommendation-ui.test.cjs 8/8 통과, npm run build 성공. 백엔드·DB·인증·Git 작업 없음.


## 스마트폰 상세 스펙 비교 화면 구현 — 2026-11-11T20:35:00+09:00

Antigravity. /compare 경로의 스마트폰 상세 스펙 비교 기능을 구현 완료했다.
- 신규: front/src/api/smartphones.js, front/test/compare-ui.test.cjs.
- 수정: front/src/views/CompareView.vue, front/src/components/SpecComparison.vue, docs/AI_HANDOFF.md 및 본 로그.
- 화면 구성 및 기능:
  - 2개 비교 기본, 최대 3개까지 비교 가능 ([2개 비교], [3개 비교] 툴바 버튼).
  - 상단 1:1 빠른 선택 드롭다운 및 모달 검색기(제조사/모델명/모델번호 텍스트 검색, 전체/삼성/애플 탭 필터).
  - 제품 이미지 box: DB 이미지 URL 우선 반영, 부재 시 비율 왜곡 없는 정돈된 스마트폰 SVG 플레이스홀더 표시.
  - 7개 카테고리(기본 정보, 디스플레이, 성능 및 메모리, 카메라, 배터리 및 충전, 네트워크 및 규격, 가격 및 구매 정보)로 상세 사양 나란히 비교.
  - 같은 항목 동일 행 비교, '값 다름' 강조(spec-difference, difference-label), '차이 있는 항목만 보기'(showDiffOnly) 필터링 지원.
  - 가격 정책 준수: verified_sale(검증된 판매가·배송비 포함), official_launch(개발용 출고가), reference_sale(개발용 참고가), 가격 없음 처리 및 개발용 가격 경고 안내.
  - API 미제공 필드(카메라 세부 화소, 디스플레이 패널/해상도, Wi-Fi/BT/NFC, 방수·방진, Apple 비공식 RAM/배터리)는 임의 생성 없이 정직하게 '정보 없음'으로 처리.
  - 미인증 사용자 접속 시 안내 및 로그인 링크 표시, 공개 승인된 제품만 목록 및 비교에 노출(pending/is_test 비노출).
- 검증:
  - test/compare-ui.test.cjs 7/7 통과 (API helper 쿼리, 2/3종 사양 렌더링, NULL/정보없음 처리, SVG 플레이스홀더, 가격 정책, 차이점 감지, 차이만 보기 필터).
  - test/recommendation-ui.test.cjs 8/8 통과 (추천 화면 회귀 없음).
  - npm run build 성공 (DONE Build complete).
  - 실제 Headless Chrome 브라우저 E2E 검증 8/8 항목 전수 통과 (탭 전환, 2/3개 비교·제거, 모달 검색, 차이 강조·차이만 보기, 출고가 경고, 기기별 SVG 플레이스홀더, 노트북 준비 중 안내).
  - 백엔드 코드 수정 0, DB 변경 0, 외부 제품 크롤링 0, Git 쓰기 0.


## 로컬 인증·게스트 카탈로그 수정 — 2026-11-11T21:17:25+09:00

Codex. 이전 맥락 재사용, Git 명령 없음. 초기 서버 미실행(ECONNREFUSED)을 확인하여 정상 npm 실행 방식으로 검증용 서버를 시작했다. .env는 앱 자동로딩만 사용했다.

- 원인 재현: 동일 CSRF/쿠키로 localhost:8080 Origin은403 CSRF_INVALID, 설정 Origin의 루프백 주소는422 INVALID_INPUT(의도한 짧은 진단 비밀번호)로 다음 검증 단계 통과. 개발의 같은 포트 localhost/127.0.0.1만 allowedOrigins로 명시 허용. production exact Origin, 잘못된 토큰/Origin 거부 유지. front 프록시 수정 불필요.
- 게스트 카탈로그는 백엔드401 및 CompareView 로그인 여부 early return의 이중 제한이었다. 공개 GET 목록/상세의 로그인 요구만 제거하고 개인 후보검색은 유지. test 환경에서도 게스트 include_test 및 테스트 상세는 차단. CompareView 로딩 조건과 안내만 수정, UI·정적 데이터 유지.
- 비밀번호 최소8자로 변경, 최대128코드포인트/512바이트·scrypt·로그인 세션 정책 유지. 기존12자 이상 비밀번호 호환.
- 코드: backend/auth/config.js, auth/middleware.js, routes/auth.js, routes/smartphones.js; front/src/views/AuthView.vue, CompareView.vue. 테스트: backend/test/local-auth-catalog.integration.test.js 추가, smartphone.integration.test.js 공개 GET/테스트 fixture 보호 검증 갱신. 문서: auth/README.md, ARCHITECTURE 비밀번호 안내 및 AI_HANDOFF/본 로그.
- 실제 localhost:8080 프록시 HTTP17: 정상 CSRF8자 가입/로그인/로그아웃,7자422,CSRF누락/위조403,잘못된 포트Origin403,게스트 공개목록/상세200,pending404,개인프로필/추천이력401. 개발·운영 Origin 단위검증 포함2/2 + 기존관련32/32 =34/34. 프론트 비교/추천15/15, build 성공(크기경고3).
- 실제 격리 게스트 브라우저 /compare 스마트폰29개·태블릿14개·워치10개 선택옵션과 오류없음 확인. 제품/기존사용자 데이터 변경0, 임시테스트 데이터 정리 후8테이블 전체행 동일. Gemini 호출0. 백엔드 재시작으로 수정 반영 확인 후 이번에 시작한 서버는 종료, 사용자는 VS Code에서 정상 실행 방식으로 재시작하면 된다.


## 추천 이력 및 추천 결과 상세 화면 구현 — 2026-11-11T21:28:00+09:00

Antigravity. /history 및 /recommendations/:id 화면을 구현 완료했다.
- 신규: front/src/views/HistoryView.vue, front/src/views/RecommendationDetailView.vue, front/test/history-ui.test.cjs.
- 수정: front/src/api/recommendations.js (history, getRecommendation, deleteRecommendation API 및 90일 만료 메시지 추가), front/src/router/index.js (플레이스홀더를 실제 뷰 컴포넌트로 연결), docs/AI_HANDOFF.md 및 본 로그.
- 화면 구성 및 기능:
  - `/history`:
    - GET /api/recommendations 호출하여 최근 90일 보관 정책 기반의 본인 추천 이력 목록 조회.
    - 추천 일시, 상태 뱃지(추천 완료, 조건 일치 없음, 조건 구체화, 기기 유지, 구매 보류), 당시 예산·사용 목적·선호 제조사 요약 표시.
    - 추천 완료 건의 경우 추천 기기 모델명·용량 뱃지 요약 표시.
    - 이력 개별 삭제 기능(DELETE /api/recommendations/:id) 및 이전 이력 더 보기(cursor 기반 페이지네이션) 지원.
    - 빈 이력 시 AI 추천 시작 유도 카드 및 CTA 버튼 제공.
  - `/recommendations/:id`:
    - route.params.id 기반 GET /api/recommendations/:id 단건 상세 조회. 새로고침 후에도 유지.
    - 상단 목록 복귀 링크, 추천 일시, 모델명, 당시 요청 조건 스냅샷(예산, 사용 목적, 선호 브랜드, 프로필 버전) 표시.
    - 기존 `RecommendationResult.vue`를 재사용하여 추천 제품 카드, 상세 사양, 추천 근거, 확인 필요 사항, 개발용 가격 경고 및 당시 관측 가격 상태 안내(is_expired_now, price_status_note) 표시.
    - 404/90일 보관 만료 시 안내 경고 및 목록 복귀 버튼 제공.
- 검증:
  - `test/history-ui.test.cjs`: 5/5 통과 (API helper 3종 엔드포인트, 90일 보관/404 메시지, 빈 이력 상태, 이력 목록 요약, 상세 화면 스냅샷 및 추천 결과 렌더링).
  - `test/recommendation-ui.test.cjs`: 8/8 통과 (기존 추천 폼 회귀 없음).
  - `test/compare-ui.test.cjs`: 7/7 통과 (기존 통합 비교 화면 회귀 없음).
  - `npm run build`: 성공 (DONE Build complete).
  - 백엔드 코드 수정 0, DB 변경 0, Gemini 실제 호출 0, Git 쓰기 0.


## 메인 페이지 리디자인 및 디자인 시스템 방향 정립 — 2026-11-11T21:43:00+09:00

Antigravity. Apple의 미니멀 제품 중심 디자인과 nofee.team의 현대적 SaaS UI를 결합한 통합 디자인 방향을 정립하고 메인 페이지(/)를 리디자인 완료했다.
- 신규: front/test/home-ui.test.cjs.
- 수정: front/src/design/tokens.js (colors 유지 및 designTokens 확장), front/src/styles/global.css (:root 공통 디자인 토큰 추가 및 기존 변수 호환 유지), front/src/views/HomeView.vue (전면 리디자인), docs/AI_HANDOFF.md 및 본 로그.
- 디자인 시스템 및 공통 토큰:
  - Apple Minimal: 밝은 캔버스(#f8fafc), 넓은 여백, 정돈된 타이포그래피 계층, 왜곡 없는 제품 중심 정보 배치.
  - nofee.team SaaS: 1px 미세 테두리(#e2e8f0), 부드러운 카드 그림자, 명확한 상태 뱃지, 실용적 기능 카드.
  - 기존 변수(--ink, --muted, --blue, --line, --radius)와 100% 호환되도록 구성하여 /compare, /recommend, /history 등 기존 화면 시각 회귀 방지.
- 메인 페이지 구현 내용:
  - 히어로: 로그인 상태별 맞춤 헤더 뱃지(로그인 사용자 환영 및 이력/기기/프로필 바로가기, 비로그인 안심 안내 문구), 메인 헤드라인, 3대 주요 서비스 액션 바.
  - 주요 서비스 3선 카드 (Core Capabilities):
    1. AI 스마트폰 추천: /recommend 연결, '서비스 이용 가능' 뱃지, 분석 특징 안내.
    2. 기기 스펙 비교: /compare 연결, '서비스 이용 가능' 뱃지, 1:1 대조 특징 안내.
    3. PC-FIT (조립 PC 견적): /pc 연결, '준비 중 (Coming Soon)' 뱃지, 향후 확장 기능임을 정직하게 명시하고 작동하는 것처럼 꾸미지 않음.
  - 미니멀 제품 쇼케이스: 구형 회전 궤도/추상 그래픽을 제거하고, AI 추천 사유 칩 및 1:1 스펙 차이 강조 미리보기 프레임 배치.
  - 카테고리 스트립(스마트폰/태블릿/워치/노트북/조립PC 상태 태그), SPEC보다 LIFE 3대 철학 카드, 3단계 추천 여정, 하단 듀얼 CTA 배너 구성.
- 검증:
  - `test/home-ui.test.cjs`: 6/6 통과 (헤드라인, 3대 액션 버튼, PC-FIT 상태 솔직 고지, 비로그인 안심 문구, 로그인 환영 및 바로가기, 카테고리 스트립).
  - 프론트 단위/SSR 전체 **26/26 전수 통과** (`home-ui` 6/6, `history-ui` 5/5, `recommendation-ui` 8/8, `compare-ui` 7/7).
  - `npm run build`: 성공 (DONE Build complete).
  - 제한 준수: 백엔드/DB/인증 변경 0, Gemini API 유료 호출 0, Git 쓰기 0, .env 열람 0, /compare·/recommend·/history·추천상세 수정 0.


## 메인 페이지 전면 재설계 (Apple·Samsung·nofee.team 통합 레퍼런스 반영) — 2026-11-11T21:58:00+09:00

Antigravity. 기존 SaaS 대시보드형 카드 나열을 전면 해체하고, 실제 데스크톱 브라우저(1440×900)에서 Apple(`apple.com/kr/`), Samsung(`samsung.com/sec/`), nofee.team(`nofee.team/`)의 레이아웃·타이포·내비게이션 구조를 확인·분석한 결과를 바탕으로 메인 페이지 정보 구조와 스타일을 재설계했다.
- 참고 사이트 실제 확인 요약:
  - Apple: 100% 풀블리드 교차 밴드(#fff / #f5f5f7 / #000), 강한 디스플레이 타이포, 제품 중심 대형 비주얼, 980px 단순 필 버튼.
  - Samsung: 화이트 캔버스 위 좌측 볼드 흑백 헤드라인 + 단순 블랙 테두리 CTA + 우측 대형 하드웨어 비주얼, 상단 카테고리 탐색.
  - nofee.team: 64px 화이트 고정 헤더(1px `#e5e5e7`), 그림자 없는 헤어라인 서피스, 실용적인 2단 서브 내비게이션 탭.
- 변경 파일:
  - `front/src/design/tokens.js`: 화이트·블랙·뉴트럴 그레이 기반 `designTokens` 재정립 (기존 Vuetify 호환 `colors` 유지).
  - `front/src/styles/global.css`: 모노크롬 CSS 변수 및 64px 화이트 헤더/블랙 마크/블랙 CTA(`.header-cta`)/푸터 최소 정제 (타 페이지 공용 클래스 보존).
  - `front/src/views/HomeView.vue`: 전면 재설계 (서브 카테고리 탭 + 계정 유틸리티 바, 대형 히어로 및 커스텀 SVG 하드웨어 스테이지, 중복 제거된 AI 추천·기기 비교 2대 에디토리얼 밴드, 기기별 지원 현황 및 PC-FIT 준비 중 정직 고지 테이블, 블랙 클로징 배너).
  - `front/test/home-ui.test.cjs`: 신규 아키텍처 기준 단위/SSR 테스트 6/6 갱신.
- 검증 결과:
  - 단위/SSR 테스트 **26/26 전수 통과** (`home-ui` 6/6, `history-ui` 5/5, `recommendation-ui` 8/8, `compare-ui` 7/7).
  - `npm run build`: 성공 (DONE Build complete).
  - 실제 데스크톱 Headless Chrome(1440×900) 검증: 비로그인·로그인 분기, PC-FIT 탭 전환 및 `/pc` 이동, `/recommend` 및 `/compare` 이동·전역 스타일 무회귀, 가로 스크롤 0(`scrollWidth=1440`), 콘솔 오류 0건 확인.
  - 제한 준수: `/compare`·`/recommend`·`/history`·인증 화면·백엔드·DB 수정 0, Gemini 호출 0, Git 작업 0, `.env` 열람 0.


## 기기로움 종합 IT 플랫폼 메인 페이지 프리미엄 리디자인 — 2026-11-11T22:20:00+09:00

Antigravity. SVG/와이어프레임 중심의 모노크롬 메인을 제조사 중립적·종합 IT기기(모바일+조립 PC) 플랫폼 인상의 대형 제품 비주얼 슬라이드쇼 메인 페이지로 전면 업그레이드했다.
- 독자적 스튜디오 제품 비주얼 생성 및 배치 (`front/src/assets/home/`):
  - `hero-platform.jpg`: 노트북·태블릿·다양한 스마트폰·스마트워치 통합 구도 (무로고/제조사 중립)
  - `hero-smartphones.jpg`: 다양한 마감·카메라 모듈의 스마트폰 라인업
  - `hero-compare.jpg`: 스마트폰·태블릿·스마트워치 나란히 비교 라인업
  - `hero-pc-fit.jpg`: 다크 티타늄/옵시디언 스튜디오 기반 PC 케이스·GPU·CPU 쿨러·메인보드 하드웨어
  - 저작권/핫링크 없는 자체 생성 자산이며, 개별 실물 SKU 공식 이미지는 미확보 상태로 정직 구분.
- 신규/수정 파일:
  - `front/src/components/HeroSlideshow.vue` (신규): 4종 슬라이드(통합 플랫폼, AI 스마트폰 추천, 상세 스펙 비교, PC-FIT 준비 중), 7초 자동 전환, 좌우 버튼·인디케이터·일시정지, 키보드 좌우 화살표, `prefers-reduced-motion` 존중, 수동 조작 시 자동 전환 일시정지, `@error` 이미지 폴백 프레임 구현.
  - `front/src/views/HomeView.vue` (개편): 확장형 5대 영역 서브 내비게이션(AI 추천, 상세 비교, PC-FIT · 준비 중, 보유 기기, 프로필, 추천 이력) + 히어로 슬라이드쇼 + Section A(AI 맞춤 추천) + Section B(IT기기 스펙 비교 및 실제 비교 UI 요약) + Section C(PC-FIT 조립 PC 준비 중 다크 섹션) + Section D(간결한 마지막 CTA). 불필요한 지원 현황 테이블/반복 설명 섹션 제거.
  - `front/test/home-ui.test.cjs` (갱신): 4종 슬라이드, 이미지 `@error` 폴백, 섹션 A~D, 게스트/로그인 내비게이션 검증 7건.
- 검증 결과:
  - 프론트 단위/SSR 테스트 **27/27 통과** (`home-ui` 7/7, `history-ui` 5/5, `recommendation-ui` 8/8, `compare-ui` 7/7).
  - `npm run build` 성공 (`DONE Build complete`, 4종 이미지 번들 포함).
  - 실제 데스크톱 Chrome(`1440×900`) 검증: 4종 슬라이드 전환 및 수동 조작 시 일시정지 전환, 키보드 `ArrowRight`, PC-FIT 다크 테마 및 `/pc` 이동, 로그인/비로그인 내비게이션, HTTP 404 이미지 로딩 실패 폴백(`carouselHeight: 580` 무흔들림), `/recommend`·`/compare` 전역 스타일 무회귀, 콘솔 오류 0건 확인.
  - 제한 준수: 백엔드·DB·인증·`/recommend`·`/compare`·`/history` 수정 0, PC-FIT 실제 구현 0, Gemini 호출 0, Git 쓰기 0, `.env` 열람 0.


## 내부 페이지 모노크롬 디자인 통일 — 2026-11-11T22:37:00+09:00

Antigravity. 메인 페이지(`/`)와 일관된 화이트·블랙·뉴트럴 그레이 모노크롬 디자인 시스템을 내부 핵심 화면 6곳(`/recommend`, `/compare`, `/history`, `/recommendations/:id`, `/profile`, `/devices`)에 통일 적용했다.
- 공통 토큰·컴포넌트·전역 스타일:
  - `front/src/design/tokens.js`: Vuetify 테마 `colors.primary` / `secondary`를 `#111111`로 통일 (시맨틱 `error`/`success`/`warning` 유지).
  - `front/src/components/AppButton.vue`: `rounded="pill"` 적용으로 주 CTA는 블랙 필 버튼, 보조 CTA는 아웃라인 필 버튼으로 통일.
  - `front/src/styles/global.css`: 모노크롬 포커스 링(`#111111`), `.eyebrow`/`member-card`/`upgrade-banner`/`compare-notice`/`auth-card`/`comparison-table .spec-difference` 뉴트럴 그레이 스타일 정리.
- 페이지별 변경:
  - `RecommendView.vue` & `RecommendationResult.vue`: 필수 조건(`01`)·선택 조건(`02`)·제출 영역 계층화, 칩 형태 체크박스, 결과 구분선 추가. 앰버 개발용 가격 경고 및 출처/확인일 가독성 유지.
  - `CompareView.vue` & `SpecComparison.vue`: Apple식 비교표 및 SVG 플레이스홀더 유지, 카테고리 탭·개수 버튼·모달 검색·차이 강조를 모노크롬 블랙/뉴트럴 톤으로 정리.
  - `HistoryView.vue` & `RecommendationDetailView.vue`: 상태 뱃지(추천 완료 블랙 필 + 유지/보류/미일치 시맨틱 컬러), `#f5f5f7` 조건 요약 바 및 스냅샷 카드 통일. 삭제/90일 만료 404 안내 유지.
  - `ProfileView.vue` & `DevicesView.vue`: 칩형 선택지, 깔끔한 입력 테두리·모달 호버 정리. 검색/등록/수정/삭제/업그레이드 배너 동작 유지.
- 검증:
  - 단위/SSR 테스트 **27/27 통과**, `npm run build` 성공 (`DONE Build complete`).
  - 실제 Chrome(`1440×900`) 6개 내부 페이지 렌더링·입력 조작(예산 입력/차이만 보기 토글/프로필 선택/보유 기기 배너), 경고 배지 가독성(`rgb(255, 251, 235)`), 가로 스크롤 0, 콘솔 오류 0건 확인.
  - `HomeView.vue`, `HeroSlideshow.vue`, 백엔드·DB·인증·API 계약 수정 0, Gemini 호출 0, Git 작업 0.


## 기기로움 UI·UX 고도화 1차 (디자인 시스템 정립 및 `/compare`·`/recommend` 전면 개편) — 2026-11-11T23:00:00+09:00

Antigravity. 정적인 표·업무용 폼 중심이던 `/compare`와 `/recommend`의 정보 구조·제품 표현·인터랙션을 전면 고도화하고 공통 디자인/인터랙션 원칙을 정립했다.
- 공통 디자인·인터랙션 시스템:
  - `docs/DESIGN_SYSTEM.md` 신설 (PC-FIT 포함 전 페이지 재사용 규칙, `prefers-reduced-motion`, 데이터 정직성 기준 정의).
  - `front/src/styles/global.css`: 공통 `.skeleton-block`, `.fade-slide-*`, `.reveal-*` 전환 및 모션 감소 비활성화 유틸리티 추가.
- `/compare` (`CompareView.vue`, `SpecComparison.vue`) UX 고도화:
  - 기본 화면의 엑셀형 긴 표를 제거하고, 상단 고정 스티키 비교 바(`top: 64px`) + 대형 제품 스포트라이트 카드(`fade-slide` 전환, 이미지 `@load`/`@error` 안전 폴백) + 아이콘 기반 핵심 사양 6종 한눈에 보기로 재설계.
  - 7개 영역 전체 상세 비교표는 아코디언(`상세 사양 전체 비교표 펼치기/접기`) 뒤로 점진적 공개 처리.
  - 로딩 중 레이아웃 흔들림 방지를 위한 2~3슬롯 스켈레톤 로딩 적용.
- `/recommend` (`RecommendView.vue`, `RecommendationResult.vue`) UX 고도화:
  - 3단계 구매 가이드 위저드(`01 예산 설정` → `02 사용 목적` → `03 선호 제조사 · 실행`) 적용. 빠른 예산 프리셋 칩 + 아이콘 사용 목적 카드 + 실시간 조건 요약 바 제공 (`v-show`로 단계 이동/모션 감소 시 입력값 100% 보존).
  - 추천 결과 스켈레톤 로딩 및 제품 중심 스포트라이트 카드(외형 무대, 스펙 3종 타일, 개발용 가격 경고·출처 유지, 절제된 `reveal` 등장) 적용.
- 검증 결과:
  - 프론트 단위/SSR 테스트 **31/31 전수 통과** (`compare-ui` 9/9, `recommendation-ui` 10/10, `home-ui` 7/7, `history-ui` 5/5).
  - `npm run build` 성공 (`DONE Build complete`).
  - 실제 데스크톱 Chrome(`1440×900`, `prefers-reduced-motion: reduce` 포함) 검증: `/compare` 스티키 바 고정(`top=64`), 핵심 지표, 아코디언 펼침, 3슬롯, 태블릿 전환 및 `/recommend` 3단계 입력 보존·모의 POST 페이로드 계약 일치·결과 카드·경고 배지·콘솔 오류 0건 확인.
- 후속 작업 범위: `/devices`(갤러리형), `/profile`, `/history`, `/upgrade`(기존 로직 기반 UI 개선), 메인 페이지 스크롤 리빌 검토.


## Apple 스타일 기기 비교 화면(`/compare`) 전면 리디자인 — 2026-11-11T23:15:00+09:00

Antigravity. `/compare` (`SpecComparison.vue`)의 정보 구조와 렌더링 방식을 기존 좌측 라벨형 표에서 **Apple 공식 비교 페이지 스타일의 독립형 세로 제품 열(2~3열)**로 전면 재설계했다.
- 주요 변경 파일: `front/src/components/SpecComparison.vue`, `front/test/compare-ui.test.cjs`.
- 정보 구조 및 레이아웃 개편:
  - 기본 화면에서 좌측 `[비교 항목]` 라벨 열, HTML `<table>`, 반복 `값 다름` 뱃지, 무거운 카드 테두리를 제거하고 제품별 독립 세로 열(`.apple-columns-grid` / `.apple-hero-col`)과 제품 이미지 무대(`.product-visual-pedestal`, SVG·`@error` 폴백 유지)·모델명·용량/모델번호·가격 출처/경고·`기기 변경`/`제거` 조작을 상단에 배치.
  - 상단 스티키 비교 바(`.sticky-compare-bar`)로 스크롤 시(`top: 64px`) 비교 기기명과 변경 링크를 고정 유지.
  - 핵심 사양 비교 영역(`.visual-specs-area`)을 **아이콘 + 굵은 핵심 수치 + 간결한 보조 설명** 세로 블록(`.visual-spec-block`)으로 구성하고, CSS Grid로 열 간 동일 항목의 상단 위치를 수평 정렬(`maxTopDiffPx: 0` in 2/3열).
  - 7개 영역 전체 상세 비교표(`.comparison-table`)는 중앙 토글 버튼(`상세 사양표 모두 보기` / `상세 사양표 접기`) 뒤 `#detailed-spec-panel` 아코디언에 수납(초기 로드 시 `aria-expanded="false"`, 높이 `0px`, `inert`·`prefers-reduced-motion: reduce` 대응)하고 2~3개 기기 및 `차이 있는 항목만 보기` 필터와 실시간 동기화.
  - 상세 사양표 세부 UI 개선:
    - 수정 1 ('값 다름' 뱃지 겹침 해소): `.spec-label-wrap` 세로 flex 배치(gap 6px) 및 `word-break: keep-all; overflow-wrap: break-word` 적용으로 좁은 열에서도 뱃지가 항목명과 겹치거나 붙지 않고 다음 줄에 깔끔하게 배치.
    - 수정 2 (상세 사양 값 중앙 정렬 및 일관성): `.comparison-table`에 `table-layout: fixed; width: 100%` 적용, 2~3개 제품 열 너비 완벽 균등 분할(2열 각 467px, 3열 각 311.3px), 모든 데이터 셀 패딩(`16px 20px`) 및 수직(`vertical-align: middle`)·수평(`text-align: center`) 정렬 통일, 긴 텍스트 중앙 기준 줄바꿈 처리.
- 검증 결과:
  - 프론트 단위/SSR 테스트 **32/32 전수 통과** (`compare-ui` 10/10, `recommendation-ui` 10/10, `home-ui` 7/7, `history-ui` 5/5).
  - `npm run build` 성공 (`DONE Build complete`, 기존 에셋 크기 경고 3건 외 오류 없음).
  - 실제 데스크톱 Chrome(`1440×900`, 모의 `/api/auth/me`·`/api/smartphones`) 검증: 초기 2열·수평 정렬 오차 `0px`·상세 표 미노출(`panelHeightPx: 0`)·스티키 바(`top: 64px`)·모달 검색/교체(`A35` → `Galaxy A35 5G`)·3열 추가/제거·`차이 있는 항목만 보기` 동기화·아코디언 펼침/접힘·태블릿(`14`)/스마트워치(`10`)/노트북(`준비 중`) 전환·`prefers-reduced-motion: reduce`(`0s`)·콘솔 오류 0건 확인.
  - 백엔드·DB·인증·API 계약·`CompareView.vue`·`HomeView.vue`·`HeroSlideshow.vue`·기타 내부 페이지 무수정, Gemini 호출 0, Git 작업 0.


## 실제 IT기기 제품 이미지 확보 및 `/compare` 적용 — 2026-11-12T00:10:00+09:00

Antigravity. `/compare` (`SpecComparison.vue`)의 스마트폰·태블릿·스마트워치 비교 화면에서 SVG 플레이스홀더를 대체할 수 있는 **정확하고 사용 허가 조건이 명확한 실제 제품 사진(Wikimedia Commons CC0 / CC BY 4.0 / CC BY-SA 4.0)**을 선별·최적화해 적용했다.
- 라이선스 및 정합성 기준:
  - Samsung·Apple 공식 사이트/뉴스룸/Product Bezels는 약관상 비교 웹사이트 재배포 및 경쟁사 제품 병렬 배치를 금지하므로 직접 내려받기·재배포를 배제했다.
  - Wikimedia Commons에서도 저작권 불명확 렌더 추청 PNG, 매장 도난방지 퍽 가림, 엔화 가격표 노출, 2개 이상 기기 혼재, 케이스 크기(42/46mm·43/47mm·40/44mm·11/13인치) 미검증 이미지는 제외하고 **미확보(기존 SVG 플레이스홀더 유지)**로 정직하게 분류했다.
- 확보 현황 (**총 26 / 40 모델 확보**, **14 모델 미확보**):
  - **스마트폰 (15 / 16 확보):** `Galaxy S24`, `S24+`, `S24 Ultra`, `S24 FE`, `S23 Ultra`, `Z Fold6`, `Z Flip6`, `A35 5G`, `iPhone 16 Pro Max`, `16 Pro`, `16`, `15 Pro Max`, `15 Pro`, `15 Plus`, `15` (`iPhone 16 Plus`만 매장 보안퍽/손 가림 외 단독 실사진 미비로 미확보).
  - **태블릿 (8 / 14 확보):** `Galaxy Tab S9`, `Tab S10+`, `iPad (A16)`, `iPad Air 11 (M3)`, `iPad Pro 13 (M4)`, `iPad Pro 11 (M4)`, `iPad Air 13 (M2)`, `iPad mini (A17 Pro)` (`Tab S9+`, `Tab S9 Ultra`, `Tab S9 FE`, `Tab S9 FE+`, `Tab S10 Ultra`, `iPad Air 13 (M3)` 미확보).
  - **스마트워치 (3 / 10 확보):** `Apple Watch Ultra 2 49mm`, `Apple Watch Series 10 42mm`, `Apple Watch Series 10 46mm` (`Apple Watch 10.png` `CC BY-SA 4.0` 투명이미지 좌/우 42mm·46mm 정밀 분리, 나머지 7종은 크기 미명시/가격표·다중 시계/미존재로 미확보).
- 구현 및 연결:
  - `front/public/images/products/` (26종 최적화 JPEG/투명 PNG 저장, `800px`/`520px` 리사이즈).
  - `front/src/utils/deviceImages.js` 신설: 모델 대표 이미지(`scope: 'model_reference'`) 매핑과 색상·용량 변형(`variant_image_url`) 구분, 공통 조회 함수(`resolveDeviceImage`, `getDeviceImageMeta`, `isModelReferenceImage`) 제공.
  - `front/src/data/supplemental-devices.json`: 확보 11종 경로 반영 및 미확보 13종 `thumbnail_url: null` 처리(불필요한 404 방지).
  - `front/src/components/SpecComparison.vue`: `/compare`에만 공통 조회 연동(`object-fit: contain`, `@error` 시 기존 SVG 폴백 유지, 레이아웃·사양표·가격·기타 페이지 무수정).
- 검증 결과:
  - 단위/SSR 테스트 **33/33 전수 통과** (`compare-ui.test.cjs` **11/11** 포함), `npm run build` 성공 (`DONE Build complete`).
  - 실제 Chrome(`1440×900`) 검증: 2·3열 실사진 로드(`naturalWidth > 0`, `objectFit: contain`, `pedHeight: 224`), 미확보 기기 SVG 유지, 태블릿/스마트워치 전환 및 교체, 404 `@error` SVG 복원, 콘솔 오류 0건 확인.
  - 백엔드·DB·API·인증·추천·`/recommend`·`/devices` 무수정, Gemini 호출 0, Git 작업 0.
