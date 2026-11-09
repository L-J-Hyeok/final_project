# DB 연결 및 초기 마이그레이션

상태: 코드 작성 완료, 실제 MySQL 적용·Sequelize 런타임 검증 전. Express 4.16.4 유지.

## 패키지 설치 상태

- sequelize: v6 계열 모델·연결 관리.
- mysql2: v3 계열 MySQL 드라이버.
- sequelize 6.37.8/mysql2 3.22.3 설치 완료. 원본 lock 버전 고정, Node v26.3.0 모델 등록·단위 테스트 통과.
- dotenv/sequelize-cli는 불필요하다. 환경 변수와 직접 실행하는 단방향 마이그레이션을 사용한다.
- 사용자 승인으로 package.json·package-lock.json 반영. 실제 DB 접속 설정 대기.

## 준비

MySQL 8.0.16 이상 8.0.x의 **기존 빈 데이터베이스**와 계정을 준비한다. 이 코드는 DB·계정을 자동 생성하거나 MySQL 서비스를 시작하지 않는다.
DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD를 실행 환경으로 주입한다. 값은 로그에 출력하지 않는다.
backend/.env의 DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD만 자동 로드한다. 실행 환경 변수가 우선하며 cwd와 무관하게 backend/.env를 읽는다. Node 내장 util.parseEnv가 필요하며 현재 Node v26.3.0에서 검증했다. 실제 .env는 Git 제외 대상이다. .env.example을 참고해 전용 final_project DB와 전용 계정의 값을 사용자 환경에서 설정한다. 이전 프로젝트 DB·인증정보는 복사하지 않는다.

## 명령 (backend에서 실행)

- node --test test/db.test.js test/env.test.js: 외부 의존성·DB 없는 단위 검증.
- node db/check.js: 읽기 전용 연결 및 서버 버전 검사.
- node db/migrate.js --apply: 빈 DB에만 8테이블 생성. --apply 없이는 DDL을 수행하지 않는다.
- npm start: DB 인증·버전 확인 성공 후에만 Express가 포트를 연다.
- GET /api/health/db: 연결 확인만 수행(200/503). 스키마 완전성 검사는 아님.

패키지 설치·연결 정보 준비 전에는 DB_DEPENDENCY_MISSING 또는 DB_CONFIG_INVALID로 종료한다.

## 데이터 보존

초기 SQL은 정확히 8개 업무 테이블만 만든다. 메타데이터 테이블·시드 데이터·자동 sync/alter·롤백 삭제는 없다.
마이그레이션은 전용 DDL 계정으로 단독 실행한다. 앱 계정에는 필요한 DML만 부여한다.
기존 테이블/뷰가 하나라도 있으면 DB_SCHEMA_NOT_EMPTY로 중단한다. 재실행도 중단하며 자동 덮어쓰지 않는다.
MySQL DDL은 자동 커밋된다. 도중 실패하면 일부 테이블이 남을 수 있으므로 생성 완료 테이블명만 보고하고 중단한다. 자동 삭제·재시도하지 말고 실제 상태 확인 후 별도 전진 마이그레이션을 작성한다.
SQL 파일은 초기 스키마의 기준이며 Sequelize 모델은 매핑용이다. sessions.sid_hash는 실제 BINARY(32), 모델은 Buffer를 읽고 쓰는 BLOB 타입으로 매핑한다. 모델로 스키마를 생성하지 않는다.

## 이번 범위 밖

세션 Store 동작·인증 API·프로필/기기 CRUD·가격 24시간 검증·추천·유형별 manual_specs 검증·삭제/보존 작업은 다음 단계다.
DB에는 설계의 FK·UNIQUE·CHECK·NULL 제약을 적용한다. DB CHECK만으로 사용자별 20개 상한·외부 출처 신뢰·개인정보 정책이 구현됐다고 간주하지 않는다.

## 이전 프로젝트와 비교

ZIP의 환경 변수 → Sequelize 인스턴스 → 모델 초기화 함수 흐름을 확인했다. 현재 모델 등록 구조는 동일한 책임 분리를 유지한다. 환경 파일 로딩만 보완했고 dotenv 추가 설치·기존 코드 실행은 하지 않았다. 원본의 환경 덮어쓰기, sync({ alter }), 관리자 자동 생성은 적용하지 않는다. 원본 실행 성공은 이번에 검증하지 않았다.
