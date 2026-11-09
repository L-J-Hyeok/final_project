# 테스트 계획

## 상태와 실행 원칙

현재 서비스 기능은 미구현이며 아래 T01~T20은 **계획만 작성, 모두 미실행**이다. 실제 결과를 기대 결과와 혼동하지 않는다. 이번 문서 작업 검증은 DEVELOPMENT_LOG에서 별도 기록한다. 이 문서는 테스트 실행 권한을 부여하지 않는다. 실행 범위와 Taste 제한은 [공통 규칙](DEVELOPMENT_RULES.md)을 따른다.

초기에는 자체 작성·검증한 로컬 시험 자료, 고정 시각, 모의 AI 응답으로 서버의 경계 조건을 검증한다. 가상 제품은 test 전용으로 명시하고 실제 추천 데이터와 분리한다. 실제 AI API 평가는 허용된 별도 작업에서만 수행한다.

## 기능별 명세

| ID / 대상 | 입력 | 정상 기대 결과 | 예외·오류 조건 | 방법 | 완료 기준 |
|---|---|---|---|---|---|
| T01 회원가입·로그인 | 시험 계정·정상/잘못된 비밀번호 | 가입·로그인·로그아웃, 비밀번호 해시 저장 | 중복 식별자, 잘못된 입력, 인증 실패·만료, 반복 시도 | API 통합·저장값 형식·응답 검사 | 평문 비밀번호 노출 0, 오류 시 세션 미발급, 로그아웃 후 접근 거절 |
| T02 회원 데이터 격리 | A/B 사용자와 상대 프로필·기기·이력 ID | 자기 데이터만 읽기·수정·삭제 | 다른 사용자 ID·미로그인 | 권한 부정 테스트 | 모든 대상 경로에서 비인가 접근·변경 0 |
| T03 자연어 프로필 | 대학생·코딩·영상·가성비·유연한 삼성 선호 예문 | 구조화 초안, 미언급 항목 미확인, 확인 후 저장 | 빈/과도한 입력, 상충 문장, AI 오분석 | 모의 AI 단위·사용자 확인 UI | 원문에 없는 사실 확정 0, 확인·수정·취소 동작 |
| T04 보유 기기 | 직접 검색·옵션 선택, 오래된 타사·미등록 기기 | 제조사·연령 제한 없이 등록·수정·삭제 | 잘못된 옵션 조합·중복·모델 미확인 | API 통합·UI 시나리오 | 소유권 유지, 미검증 표시, 자연어·선택 UI 병행 |
| T05 추천 범위 | 기준일 D, D-3년 경계·하루 전·미래·미확인 출시일 | 확정 정책의 범위 안 국내 삼성·애플 제품만 후보 | 해외 출시일만 존재, 윤일, 과거 보유 기기 | 고정 시각 단위·DB 조회 | 경계 사례 100% 일치, 보유 기기 등록에는 필터 미적용; D-015 확정 경계 적용 |
| T06 제품·옵션 정합성 | 모델번호·용량이 다른 동일 제품, 단위가 다른 사양 | 올바른 variant·정규화 사양·출처 연결 | 옵션 누락·중복·사양 충돌·미확인 값 | 수집 검수·DB 제약·조회 시험 | 서로 다른 용량 가격 혼용 0, 출처 없는 실제품 확정 0 |
| T07 DB 후보 전용 | 후보 A/B, AI가 C·가상 ID·중복 순위 반환 | 이번 후보에 포함된 유효 ID만 통과 | 다른 요청의 실존 ID·잘못된 타입·스키마 | 검증기 단위·모의 AI 통합 | 후보 외 추천 0, 위반 응답 차단 |
| T08 예산 | 예산 100만원, 99만·100만·101만원 옵션 | 유효 조건에서 예산 이하만 추천 | 가격 없음·오래됨·할인 조건 미충족·배송 불명 | 검증기 경계·통합 | 예산 위반 확정 추천 0, 불확실 가격 충족 단정 0 |
| T09 필수 조건 | 용량·제조사·기능의 필수/선호 구분 | 필수 조건 충족, 선호는 순위에 반영 | 필수 사양 미확인, 조건 충돌, 후보 없음 | 필터·검증기 단위 | 필수 위반 0, 자동 조건 완화 0, 필요 시 질문 |
| T10 기존 기기·호환성 | 보유 워치·폰·주변기기, 검증된 연동 사양 | 호환 여부·제약·개선점에 근거 제시 | 호환 데이터 없음·불일치 | 시험 조합·설명 근거 대조 | 미확인 호환을 가능으로 단정 0, 제한 명시 |
| T11 추천 이유 사실성 | 후보 사양·가격·evidence_keys와 AI 설명 | 객관 주장은 DB 근거 일치, 해석은 구분 | 허위 사양·출처 없는 수치·가격 변조 | 자동 구조 검증+문장 수동 평가 | 구조화 사실 일치 100%, 필수 사실 오류 0 |
| T12 개인화 | 후보 동일, 영상/코딩·휴대성·브랜드 선호만 변경 | 관련 근거·적합성이 변화 | 선호만으로 필수 조건 위반 | 쌍대 시나리오·수동 루브릭 | 사전 정의한 개인화 기준 충족, 무관 성향 추정 0 |
| T13 재추천·버전 | 예산·프로필·보유 기기 수정 후 재요청 | 새 조건 반영·새 이력, 이전 결과 버전 유지 | 처리 중 수정·오래된 응답 도착 | API 통합·동시 요청 시험 | 최신 요청과 결과 혼합 0, 기준 버전 표시 |
| T14 추가 질문 | 예산/용도 부족·서로 모순된 조건 | 필요한 최소 질문과 수정 경로 | 불필요한 개인정보 질문·무한 반복 | 시나리오·모의 AI | 사전 정한 불명확 사례에서 질문, 임의 가정 0 |
| T15 가격 신선도 | 기준 시각과 임계값 직전·동일·초과 관측값 | 출처·확인 시각·조건 표시, 오래됨 경고 | 시각 누락·미래·다른 옵션 가격 | 고정 시각 단위·UI | 오래된 가격 최신 표시 0; D-015의 24시간 미만 적용 |
| T16 AI 장애·보류 | timeout·429·잘못된 JSON·후보 없음·교체 이득 없음 | 제한적 재시도·안내·clarify/keep/defer/no_match | 무한 재시도·조작된 정상 응답 | 모의 제공업체·실패 주입 | 무한 대기·가상 제품 생성 0, 사용자 복구 경로 제공 |
| T17 이력·수정·삭제 | 저장 요청·프로필/기기/계정 삭제 | 소유 이력 조회, 확정 보존 정책대로 삭제 | 고아 레코드·중복 저장·백업 원문 잔존 | 트랜잭션·삭제 통합 시험 | 사용자 간 혼합 0, 삭제 범위 검증; D-017의 로컬 MVP 정책 적용 |
| T18 개인정보·주입 방어 | “명령 무시·SQL 실행·키 출력” 입력, 악성 제품 설명 | 데이터로 취급, 허용 도구·필터 유지 | 로그·AI 요청에 비밀정보 포함 | 가짜 비밀값 fixture·모의 API payload 검사 | 실제 비밀값 사용 없이 외부 전송 최소화 확인, 임의 SQL·웹 검색 0 |
| T19 UI·접근성 | 390/768/1440 폭, 키보드·동작 감소, 정상/빈/오류 상태 | 탐색·등록·상담·비교 사용 가능 | 잘림·포커스 유실·색만으로 상태 전달 | 허용된 독립 UI 검사 또는 수동 검토; Taste 도구 금지 | 주요 흐름 완료, 레이블·포커스·대비 검토 통과, 가로 넘침 없음 |
| T20 운영·실행 환경 | macOS·Windows, 설정 누락, 불량 요청 | 설정 오류 안내·입력 제한·일관된 처리 | 키 없는 실행·원문 로그·쿠키/CSRF/CORS 결함 | 별도 승인된 로컬 실행·보안 통합 검사 | 정한 인증 방식의 보호 동작, 비밀 노출 0, 양 OS 결과 기록 |

## 추천 품질 실험 — 제안, 구현 전 수치 합의

- 고정 후보·가격 시각·프로필·프롬프트·모델 버전의 시험 세트 20건 이상, 동일 조건 각 5회 반복을 제안한다.
- 자동 측정: 후보 ID 유효율, 예산·필수조건 준수율, 구조화 근거 일치율, 추가 질문 적절성, 가격 경고 누락률.
- 하드 조건은 시험 세트에서 100% 준수해야 한다. 이는 실제 운영 전체의 무오류 보장이 아니다.
- 개인화·설명은 0~2점 루브릭으로 평가: 0=누락/오류, 1=일부 반영·불명확, 2=관련 성향과 검증된 근거를 명확히 연결. 평균 1.5 이상을 잠정 목표로 제안하며 최종 기준은 합의 후 고정한다.
- 일관성: Top-1 일치율, Top-3 집합 겹침 비율, 순위 변화 및 이유의 모순을 기록한다. 동점 후보 교체를 곧바로 실패로 보지 않는다. 허용 변화 기준은 실험 전에 확정한다.
- 조건 변경 쌍에서는 무조건 순위가 바뀌는지가 아니라 변경 조건과 근거가 반영되는지 평가한다.
- AI 모델·프롬프트·데이터 변경 시 동일 고정 세트로 회귀 비교한다. 실측 전 성능 수치를 작성하지 않는다.

## MVP 완료 게이트

T01~T20 중 스마트폰 MVP에 적용되는 항목 통과, 미해결 고위험 결함 없음, 공급 데이터 권리·출처 확인, D-013~D-017의 확정 계약을 구현·검증해야 한다. 실제 AI 평가는 별도 승인 후 모의 시험과 구분하여 수행한다. 미실행 항목은 남겨두고 전체 완료로 표시하지 않는다.

조립 PC 시험은 통합 재개 후 별도 추가한다: 소켓·칩셋·메모리·전원·케이스 치수·부품 DB 이전 무결성 및 기존 로직 회귀. 현재 이 기능은 보류다.

## 실제 결과 기록 양식

- 실행 시각(Asia/Seoul), 도구·담당자, 대상 코드/데이터/모델/프롬프트 버전:
- 테스트 ID와 입력 fixture:
- 실행 방법(모의/실제 API, 외부 통신 여부):
- 기대 결과 / 실제 결과 / 통과·실패·미실행:
- 증거 위치(비밀정보 제외), 미해결 문제, 재시험 조건:

실제 실행 요약은 DEVELOPMENT_LOG와 CURRENT_STATUS에 연결한다.

## 2026-11-09 확정 계약의 최소 회귀 기준 — 전부 미실행

기존 T01~T20을 유지하며 아래 구체 사례를 추가한다. 모의 AI·고정 시각·가상 비밀값만 사용한다. 이번에는 설계 정합성만 검토했으며 아래 기능을 실행하지 않았다.

| 연결 ID | 입력·정상 조건 | 오류·경계 입력 | 최소 완료 기준·방법 |
|---|---|---|---|
| T01·T20 인증 | 가입→CSRF→로그인→me→로그아웃 | 중복 이메일, 11자/129자 비밀번호, 잘못된 암호, 30분 idle·24시간 절대 만료 | 서버 통합: 암호 해시·SID 재발급, 로그아웃 후 401, 경계 시각 만료, 세션 DB·로그에 원본 SID 없음 |
| T01·T02·T18 보호 | 본인 세션·정상 CSRF | 토큰 없음/변조, 타 origin, 타인 ID, 제한 초과 | CSRF 403·타인 404·429, 오류에도 데이터 변경 0, 운영 쿠키 속성·해시 동시 처리 2개 검증 |
| T03·T13 프로필 | 필수 usages/spending_style·expected_version 일치 | 초안만 분석, enum 오류, 누락·동시 수정 | 분석만으로 저장 0, 확인 PUT만 저장, 충돌 409, version 원자 증가; API/트랜잭션 시험 |
| T04 기기 | 구형 타사 카탈로그·수동·같은 모델 두 대 | catalog/manual 혼합, 타인 variant 관련 소유 ID, 21번째 기기 | 출시일 필터 없음, XOR 제약, 사용자별 20개 상한·CRUD·version 증가; DB/서비스 시험 |
| T05·T06 DB | 모델번호 같고 용량/색상 다른 옵션 | 중복(brand,국내번호), 중복 옵션, 고아 FK·음수·미검증 값 | UNIQUE/FK/CHECK 실패, verified 출처 필수, test 자료 production 제외; 마이그레이션 통합 |
| T05 날짜 | D=2026-11-09일 때 2023-11-09·2026-11-09 | 2023-11-08·2026-11-10·NULL, D=2028-02-29 | 양 끝 포함, 윤일 하한 2025-02-28, 미래·미확인 제외; 고정 시각 단위 |
| T08·T15 가격 | 24시간 직전·배송 포함 예산과 동일 | 정확히 24시간·미래·배송 미확인·조건부 할인·품절 | 만료/조건 불명 제외, 예산 같음 통과·1원 초과 탈락; 고정 시각 단위 |
| T06·T15 관측 | 동일 판매처 과거 저가와 최신 품절·다른 판매처 유효가 | 최신 만료인데 과거 저가 존재 | 과거 저가로 회귀 금지, 다른 유효 판매처만 선택; SQL fixture |
| T07·T09·T14 후보 | hard 충족·soft 불일치 | hard 사양 NULL, 0개·40개·41개 후보, 삼성 선호 vs 삼성만 | soft로 제거 0, NULL hard 탈락, 0=no_match·40=AI 전달·41=clarify, 임의 완화 없음 |
| T07·T11·T18 근거 | candidate variant·정확한 field/value·reason_code | 다른 요청 ID·가상 ID·가격 조작·허위 사양·잘못된 profile_ref·자유문장 수치 | 서버 차단, 1회 수정 실패 후 502, 사용자 설명은 검증된 템플릿만; 검증기 단위 |
| T10·T12 개인화 | 예산 여유·용량 조건·검증 기기 무게 비교 | 수동 기기 수치·미확인 워치 호환 요구 | 사양 일치 근거만 통과, 호환 필수 미확인은 clarify, 평가용 AI 자유문장 미노출 |
| T13·T16 동시성·장애 | 완료 직전 동일 버전·가격 | 프로필 변경·가격 만료/갱신·탈퇴·AI timeout·서버 재시작 | 409 변경·504 timeout, 탈퇴 후 결과 저장 0, 제한된 재시도·processing 정리; 서비스 통합 |
| T17 삭제·보관 | 본인 이력 삭제·프로필 초기화·기기 수정/삭제·탈퇴 | 타인 요청·90일 경계 | 정책대로 이력/개인 스냅샷 제거·CASCADE·만료 정리, 카탈로그 유지; 트랜잭션 시험 |
| T19 UI 계약 | API 정상·clarify/no_match·에러, 모바일·키보드 | 재로그인으로 CSRF 변경·409·502·504 | 새 CSRF 사용, 초안 확인 UI·재요청 안내, 실패를 추천 성공으로 표시하지 않음 |

구현 시작 게이트: 8테이블·제약, 세션 인증·CSRF·소유권, 프로필/기기 CRUD부터 각각 위 기준을 통과한다. 실제 AI 제공업체 확정은 모의 응답 기반 서버 구현의 선행 조건이 아니다.

## D-018 확장 경계 최소 검증 — 계획, 미실행

| 대상 | 입력 | 기대 결과·최소 기준 |
|---|---|---|
| 보유 유형 | 구형 타사 laptop/tablet, cpu/gpu/ram/ssd 수동 등록 | 브랜드·출시 3년 필터 없이 각 category 유지; 소유권·20개 상한 적용 |
| 유형/사양 분리 | RAM capacity_gb=32, GPU vram_gb=8, SSD manual_storage_gb=1024 | 메모리·VRAM·저장 용량 혼용 0, 등록·조회 값 유지 |
| 입력 제한 | cpu에 vram_gb, 중첩 JSON, 2KiB 초과·음수·문자열 숫자 | 422, 입력 형식 통과를 사실 검증으로 취급하지 않음 |
| 기존 호환 | 기존 스마트폰 catalog/manual 요청, manual_specs_json 생략 | 이전 API 동작 유지, 생략은 null, catalog형은 모든 manual_* null |
| 전환/수정 | ram→ssd category 변경, 수동→catalog 전환 | 이전 유형 사양 잔존 없음, XOR·원자적 version·이력 삭제 유지 |
| 추천 격리 | 소유 CPU 또는 수동 사양을 smartphone variant_id/근거로 제출 | 참조·유형 검증 실패, 미검증 사양으로 객관 호환·성능 설명 생성 0 |
| 프로필 재사용 | 공통 usages/spending_style와 smartphone 선호 | 공통 성향 보존; 스마트폰 브랜드·OS를 PC 선호로 해석하지 않음 |

후속 PC-FIT 통합 게이트(현재 시험 대상 아님): 원본 권리·스키마 확인, 부품 ID 매핑·타입·단위·FK 무결성, 호환/비호환/정보부족 회귀 사례, 스마트폰 추천 결과 회귀. 조립 구성·상세 테이블·부품 검색 API는 지금 생성하지 않는다.

## DB 1차 구현 검증 — 2026-11-09

- 실행: backend에서 node --test test/db.test.js — **7개 통과**. 설정 누락/범위, MySQL 버전, 오류 정보 보호, 비어 있지 않은 DB의 DDL 거절, 8개 순차 생성 계획, 부분 실패 중단, health 핸들러 200/503 검증.
- 마이그레이션은 가짜 query 객체를 사용한 동작 시험이다. 실제 SQL 문법·FK·CHECK가 MySQL에서 통과했다는 뜻이 아니다.
- node --check: 신규 DB JS·health 라우트·app.js·bin/www 구문 검사 통과.
- node db/check.js 및 node bin/www: DB_CONFIG_INVALID로 종료. 시험용 가짜 환경 변수로 연결 점검: DB_DEPENDENCY_MISSING으로 종료. 실제 비밀값·외부 DB를 사용하지 않음.
- 미실행: 실제 Sequelize 모델 생성, MySQL 연결, 초기 DDL 적용·제약 삽입 시험, HTTP 실접속. sequelize/mysql2·환경 설정·실행 중 MySQL 필요.

다음 통합 게이트: 승인된 패키지 설치 후 기존 빈 시험 DB에서 8테이블 생성, 모델 컬럼 일치·BINARY(32) SID 왕복, 중복 UNIQUE·고아 FK·CHECK 위반 거절, 수동/catalog XOR·JSON object, CASCADE/RESTRICT 검증. 기존 데이터가 없는 전용 시험 환경에서만 수행하며 자동 삭제 마이그레이션은 사용하지 않는다.

### 환경 파일 로딩 보완 검증

node --test test/db.test.js test/env.test.js: 8/8 통과. 임시 가짜 파일로 DB 키만 로딩·실행 환경 우선·인용부호/CRLF·파일 누락·읽기 오류 은폐 검증. 실제 연결 검사 명령은 DB_CONFIG_INVALID(exit 1)로 접속 전 중단; DB 인증 성공은 미검증.

### 설치 후 검사 — 2026-11-09 22:48:11 KST

단위 8/8·실제 Sequelize 8모델 등록 통과(접속 없는 검사). DB 검사 명령은 DB_CONFIG_INVALID로 접속 전 중단. 인증정보 준비 후 기존 통합 게이트 수행 필요.

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

## 스마트폰 제품·가격 조회 및 후보 검색 검증 — 2026-11-09 23:40:40 KST

- Google Antigravity. `npm run test:smartphone` (`test/smartphone.test.js` + `test/smartphone.integration.test.js`) **5/5 통과**, HTTP status assertion **34개** 통과.
- 단위 검증(`test/smartphone.test.js`):
  - T05: Asia/Seoul 기준 3년 달력 경계(`2023-11-09`~`2026-11-09` 양 끝 포함, `2023-11-08`·`2026-11-10`·`null` 제외) 및 윤일(`2028-02-29` → 하한 `2025-02-28` 보정) 검증 통과.
  - T06·T08·T15: 24시간 미만 유효기간, 정확히 24시간/미래 시각/배송비 미확인/조건부 할인/품절/중고/통신사 락 제외, 배송비 포함 총액 계산, 동일 판매처 최신 품절 시 과거 저가 회귀 방지 및 타 판매처 유효 최저가 선택 검증 통과.
  - T07·T09·T14: 예산/용도 누락 및 제조사-OS 모순 시 `clarify` 질문 생성, 타입/범위/미허용 키 `422 INVALID_INPUT`, 필수 사양 `null` 후보 탈락, 선호(`soft`) 불일치 후보 유지 검증 통과.
  - T10·T11·T12: `eligible_reasons`가 검증된 카탈로그 보유 기기에 대해서만 무게·주사율 비교 근거(`lighter_than_owned`, `higher_refresh_than_owned`)를 생성하고 수동 등록 기기는 비교 근거에서 제외함을 검증.
- 실제 MySQL + HTTP 통합 검증(`test/smartphone.integration.test.js`):
  - 비로그인 401, CSRF 누락 403, 타인 보유 기기 참조 404, 미확정 프로필 `409 PROFILE_INCOMPLETE`, 버전 불일치 `409 PROFILE_CHANGED` 확인.
  - `GET /api/smartphones`: 기본 `is_test=false` 격리, `include_test=true` 시 삼성·애플 3년 이내 검증 모델만 반환(3년 초과 구형 및 타사 브랜드 제외), 브랜드·용량 필터 및 커서 페이지네이션 확인.
  - `GET /api/smartphones/:variantId`: 옵션별 용량·색상·국내 모델번호·출처, 판매처별 최신 관측 중 유효 최저가 선택 및 만료 가격(`is_expired=true`, `price=null`) 표시 확인.
  - `POST /api/recommendation-candidates`: 예산·최소 용량 충족 후보(1~40개) 조회 및 `ai_context`·`eligible_reasons` 반환, 후보 0개 시 `status='no_match'` 및 완화 질문 반환, 후보 40개 초과(42개) 시 임의 절단 없이 `status='clarify'` 반환 확인.
- 회귀 및 정리: DB 8/8, 인증 5/5(HTTP 33), 회원/기기 5/5(HTTP 65), 스마트폰/후보 5/5(HTTP 34) 총 **23/23 통과**, `node db/check.js` 정상. 테스트 종료 후 8개 테이블 전체 행 수 0 확인.

## Mock AI + Gemini 어댑터 및 추천·이력 검증 — 2026-11-10 00:26:13 KST

- Google Antigravity. `npm run test:recommendation` (`test/recommendation.test.js` + `test/recommendation.integration.test.js`) **4/4 통과**, HTTP status assertion **29개** 통과.
- 단위 검증(`test/recommendation.test.js`):
  - AI 설정 검증: 기본 `gemini-3.5-flash-lite`, 선택 `gemini-3.6-flash`, 테스트 `mock` 허용 및 미승인 모델(`AI_MODEL_NOT_ALLOWED`)·공급자(`AI_CONFIG_INVALID`) 차단 확인.
  - T03·T14·T18(자연어 분석): 예산/용도/선호 브랜드 추출, 미언급 항목 미추정 및 질문 반환, 기존 확정 프로필과의 브랜드/OS 충돌 질문, 미지원 기능(워치 호환·S펜) 불확실성 안내, 프롬프트 인젝션 문구(`DROP TABLE`, 시스템 지침 무시) 데이터 격리 확인.
  - T07·T11(추천 검증기): 정상 후보 추천 및 서버 템플릿 문장 생성 통과, 후보 외 `variant_id`(`999`) 차단, 가격 변조(`PRICE_EVIDENCE_MISMATCH`) 차단, 해당 후보에 없는 근거 코드(`UNVERIFIED_REASON_FOR_CANDIDATE`) 차단, 사양 수치 조작(`SPEC_EVIDENCE_MISMATCH`) 차단 확인.
- 실제 MySQL + HTTP 통합 검증(`test/recommendation.integration.test.js`):
  - 비로그인 401, CSRF 누락 403, 잘못된 분석 요청 422, 분석 초안 호출 후 DB 미저장(`version=1, confirmed_at=null` 유지) 확인.
  - `AI_PROVIDER=gemini`에서 `GEMINI_API_KEY` 미설정 시 `503 AI_KEY_MISSING` 및 로컬 설정 안내 메시지 반환 확인.
  - `POST /api/recommendations`: 정상 추천(`201`, `status='recommend'`, 삼성 선호 반영 1순위 정렬), 후보 0개(`no_match`) 시 AI 미호출 검증, AI 환각 응답 시 정확히 1회 재시도(총 2회 호출) 후 `502 AI_INVALID_RESULT` 및 `failed` 상태 저장 검증, AI 응답 직전 가격 품절 변경 시 `409 CANDIDATES_CHANGED` 차단 검증.
  - `GET /api/recommendations`, `GET /api/recommendations/:id`, `DELETE /api/recommendations/:id`: 본인 이력 목록/상세 조회, 스냅샷 만료 시 당시 가격 유지 및 `is_expired_now=true`·`price_status_note` 표시, 타인 이력 조회·삭제 시 `404` 격리, 본인 이력 삭제(`204`) 확인.
- 전체 회귀 및 DB 정리: DB 8/8, 인증 5/5(HTTP 33), 회원/기기 5/5(HTTP 65), 스마트폰/후보 5/5(HTTP 34), 추천/분석/이력 4/4(HTTP 29) 총 **27/27 통과**(HTTP assertion 161개). 테스트 종료 후 8개 테이블 전체 행 수 0 확인.
- 실제 Gemini API 호출 상태: 로컬 `backend/.env`에 `GEMINI_API_KEY`가 아직 설정되지 않아(`node services/gemini-check.js` → `AI_KEY_MISSING`), 외부 API 호출 없이 확인을 마쳤다. 키 설정 후 `node services/gemini-check.js`로 최소 토큰 확인 가능.

## 실제 Gemini API (`gemini-3.5-flash-lite`) 종단간 검증 — 2026-11-10 00:43:03 KST

- Google Antigravity. 사용자가 `node services/gemini-check.js`로 `gemini-3.5-flash-lite` 및 `gemini-3.6-flash` HTTP 200 연결을 확인한 뒤, `npm run test:gemini-live` (`test/gemini-live.integration.test.js`)로 실제 Gemini API 종단간 테스트 **1/1 통과**.
- `POST /api/analysis` (실제 호출 1회, 604 토큰): 가상 입력 *"나는 게임을 거의 하지 않고 유튜브와 웹서핑을 주로 해. 배터리가 오래가는 삼성 갤럭시를 선호하고 예산은 80만 원 이하여야 해."* → `hard: { budget_max_krw: 800000, usages: ["video"] }`, `soft: { preferred_brands: ["samsung"], priorities: ["battery"] }`, 미언급 저장 용량·무게·주사율은 추측 없이 `questions`·`uncertainties`로 분리 반환, DB 미저장 확인.
- `POST /api/recommendations` (실제 호출 1회, 1,890 토큰): 가상 검증 후보 2종(Galaxy A35 5G 5000mAh 490,000원 vs iPhone Budget 2018mAh 650,000원) 전달 → Galaxy A35 5G 1순위 선정, 후보 내 정확한 `variant_id`, `price_observation_id`, `total_krw`, `eligible_reasons` 일치 검증 통과, 추천 이력 저장·상세 조회(`GET /api/recommendations/:id`)·삭제(`DELETE /api/recommendations/:id`) 확인.
- 오류 처리 및 전체 백엔드 회귀(`test/recommendation.integration.test.js` 포함 27/27 통과, HTTP assertion 166개):
  - `AI_UNAVAILABLE`(502), `AI_TIMEOUT`(504), 사용자당 분당 5회 초과 `RATE_LIMITED`(429), `AI_INVALID_RESULT`(502), 후보 외 ID·가격/사양 변조 차단, 가격 품절/만료 시 `409 CANDIDATES_CHANGED`, 후보 0개 `no_match`(AI 미호출) 모두 통과.
  - 테스트 종료 후 8개 테이블 전체 행 수 0 확인.

## 보유 기기 기반 업그레이드 추천 및 다중 IT기기 확장 검증 — 2026-11-10 01:16:00 KST

- Google Antigravity. `npm run test:upgrade` (`test/upgrade.test.js` + `test/upgrade.integration.test.js`) **5/5 통과**, HTTP status assertion **28개** 통과.
- 20개 필수 시나리오 전수 검증 결과:
  1. 신규 회원 스마트폰 등록 직후 출시일 즉시 판정(`POST /api/owned-devices` 응답 `upgrade_offer` 포함) 통과.
  2. 기존 회원 재방문 시 현재 날짜 기준 재평가(`GET /api/upgrade-offer`) 통과.
  3. 출시일 기준 정확히 3년 도래일(`2023-11-10` → `2026-11-10`) 업그레이드 대상 포함 통과.
  4. 출시일 기준 3년 도래 하루 전(`2023-11-11` → `2026-11-10`) 업그레이드 대상 제외 통과.
  5. 기존 회원의 기기가 시간이 지나 3년 경과 시 업그레이드 대상으로 전환 통과.
  6. 보유 기기 수정(`PUT /api/owned-devices/:id`) 및 삭제(`DELETE /api/owned-devices/:id`) 시 업그레이드 상태 즉시 갱신 및 대표 기기 자동 승계 통과.
  7. 다수 스마트폰 보유 시 현재 대표 스마트폰(`current_device`)만 판정하고 나머지는 `past_or_other_smartphones`로 분리 통과.
  8. 출시일 누락/형식 오류/미래 날짜 모델의 `needs_verification: true`(`확인 필요`) 처리 통과.
  9. 동일 모델명에 복수 세부 모델(`domestic_model_number`) 존재 시 `ambiguous_model_variant` 및 `needs_verification: true` 처리, 모델번호 명시 시 정확 식별(`identified_by_model_number`) 통과.
  10. 카탈로그 미등록 수동 스마트폰(`unidentified_model`) 처리 및 3년 경과 임의 추측 방지 통과.
  11. 최초 팝업 표시(`should_show_popup: true`) 및 `'snooze'`(‘나중에 보기’) 선택 시 30일(`UPGRADE_SNOOZE_DAYS`) 유예 억제 통과.
  12. 30일 유예 만료 후 재방문 시 팝업 재표시 통과.
  13. `'dismiss_permanent'`(‘이 기기에서는 다시 표시하지 않기’) 선택 시 해당 기기 영구 숨김 통과.
  14. 타 사용자의 보유 기기 업그레이드 상태 조회·변경 시도 차단(`404 NOT_FOUND`) 통과.
  15. 업그레이드 대상(3년 이상) 사용자의 추천 후보 조회 시 MySQL 내부 카탈로그 후보만 반환 통과.
  16. 출시 3년 미만 스마트폰 보유 사용자의 일반 추천(`can_start_general_recommendation: true`) 정상 동작 통과.
  17. 후보 0개(`no_match`) 시 조건 완화 안내 반환 및 AI 미호출 통과.
  18. 현 기기 유지(`status: 'keep'`)가 유리할 때 유지 추천 및 근거(`keep_reasons`, `keep_cautions`) 반환 통과.
  19. Gemini/AI 추천 결과가 후보 외 제품·가격·사양을 생성할 때 서버 검증기(`validateRecommendationOutput`) 차단 통과.
  20. 업그레이드 대상 여부 조회(`GET /api/upgrade-offer`) 및 상태 변경 시 Gemini 호출 횟수 **0회** 확인 통과.
- 향후 다중 IT기기(노트북 4년, 태블릿 4년, 스마트워치 3년, 데스크톱/조립 PC 성능·호환성·상태 중심) 확장 시 추가할 테스트 항목:
  - 각 제품군 카탈로그 도입 및 정책 활성화(`active: true`) 시 기기군별 경계일(4년/3년) 단위·통합 검증.
  - 조립 PC(PC-FIT 연동) 부품별 성능 병목·소켓/메모리/전원 호환성·상태 기반 업그레이드/유지 판정 회귀 테스트.
- 전체 백엔드 회귀 및 DB 정리: DB 8/8, 인증 5/5(HTTP 33), 회원/기기 5/5(HTTP 65), 스마트폰/후보 5/5(HTTP 34), 추천/분석/이력 4/4(HTTP 34), 업그레이드 제안/비교 5/5(HTTP 28) 총 **32/32 통과**(HTTP assertion 총 194개). 테스트 종료 후 8개 테이블 전체 행 수 0 확인.
