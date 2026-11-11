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

## 프론트 기반·제품 스펙 비교 검증

이번 확인: 개발 서버 컴파일, 운영 빌드, 홈 시각 확인(1200/390px), 768px 포함 가로 넘침 없음, 업무 플레이스홀더 9개·오류/404 라우팅과 본문 포커스 이동, 모바일 메뉴 개폐, 콘솔 error/warn 없음. /compare의 3→2열 전환, 누락 7항목 ‘정보 없음’, 브라우저 메모리의 가상 RAM 8/12 차이에 한 행만 강조, 모바일 비교표 내부 가로 스크롤·페이지 넘침 없음 확인. 가상 값은 시험 직후 제거했다. 실제 제품/API 연결 시험이 아니다. API 클라이언트는 모의 fetch로 CSRF 획득·토큰 회전·쿠키 옵션·204·401·외부 경로 거절을 확인했다.

후속 비교 통합 기준(미실행):
- 정확히 2~3개 선택, 0/1/4개·중복 variant 차단, 용량/색상 다른 옵션 식별, 제거/교체·목록 페이지 이동 처리.
- 모델/옵션 verified와 시험 데이터 제외 확인; 사양 null·미검증·누락은 ‘정보 없음’. RAM/저장/VRAM 단위 구분, 동일 값 미강조·다른 값 강조, 점수/최고 제품 자동 판정 금지.
- price=null/만료/미래 관측/조건부 가격·배송비 미확인 처리; 유효 가격과 출처·관측/만료 시각 표시, 과거 가격 회귀 금지.
- 일반 비교 과정 Gemini 호출 0회·브라우저 외부 AI 요청 0회, 내부 카탈로그 ID만 사용. 세션 만료/403/네트워크 오류에 선택 상태와 오류 안내 검증.
- 보유 스마트폰 비교 시 본인 소유권, 3년 초과 제품 비교 허용 여부를 해당 카탈로그 계약으로 확인; 수동/식별불가 기기는 미검증 표시·사양 추측 금지.
- 향후 기기별 fields 교체, 펜/센서/호환성 누락 처리, PC 부품/총견적·검증된 호환성 근거 시험은 해당 기능 도입 후 수행.
- 키보드·스크린리더 전수 접근성, 실제 모바일 기기, 운영 프록시/백엔드 API 연동은 미검증이다.


## 프론트 3단계 실제 결과 — 2026-11-10 21:22:47 KST

| 구분 | 확인 결과 |
|---|---|
| 실제 Express/MySQL | 전용 계정 가입/로그인, 프로필 조회·전체 저장·수정·새로고침·선택값 생략 및 다른 필드 보존 통과 |
| 실제 충돌 | profile expected_version 충돌 409: 초안 보존·저장 차단·명시적 재조회 안내 |
| 실제 기기 CRUD | 수동 2개 등록, RAM/저장 용량 보존 수정, 대표 변경, 삭제 확인 및 DELETE 후 1개 남음 확인 |
| 실제 검색/미확인 | samsung 검색 200/0개 및 빈 상태, 미등록 수동 모델 needs_verification 안내 통과 |
| 실제 알림 상태 | 미식별 시험 기기에 snooze 200/30일, dismiss_permanent 200 및 GET 저장 유지. 대상 제품의 실제 배너는 미검증 |
| 실제 인증 회귀 | 새로고침 세션 유지, CSRF 없는 수정 403. 서버 logout 204 후 열린 목록 재조회 401·로그인 이동. 실제 시간 경과 만료는 미시험 |
| 모의 브라우저 | 정확 옵션 선택 후 variant_id만 POST, 카탈로그 표시, 3년 이상 배너, 미만 무배너, 유예·영구 숨김 클릭 후 배너 제거, 일반 추천 링크 유지, AI 요청 없음 |
| 빌드·화면 | 최종 production 빌드 성공(MDI/Vuetify 기존 용량 경고). 390px 프로필·기기·모달, 768/1280px 기기 가로 넘침 없음. 입력 레이블 확인. 키보드/스크린리더 전수는 미실행 |
| 기존 단위 | node --test backend/test/auth.test.js backend/test/member.test.js backend/test/upgrade.test.js: 12/12 통과 |
| 정리·보존 | 전용 계정과 종속 프로필/기기/로그인 세션 잔여 0. backend 51 파일 해시 동일. 전체 DB·AI 회귀 미실행 |

실제 카탈로그 연결과 출시 3년 경과 대상의 종단간 UI 검증은 허용된 제품 데이터 확보 후 수행한다. 테스트 목적으로 제품 DB를 새로 구축하지 않았다. 정상 실행 후 콘솔에는 미인증 시험의 예상 401 응답 외 새 UI 런타임 예외를 관찰하지 않았다.

## D-028 향후 데이터 운영·관리자 테스트 — 계획, 전부 미실행

- 일반 회원/비로그인 사용자의 관리자 API 직접 호출 차단, 관리자는 허용된 관리 작업만 가능(Express 인가).
- 모델·사양·가격·수집 기록의 출처 URL/확인 시각/모델번호/검증 상태/승인 이력 추적, 잘못된 옵션 연결 및 유효기간 지난 가격 처리.
- 미승인·반려·검증 누락·시험 데이터를 일반 추천 후보에서 제외; 승인된 정보만 추천에 사용. verified와 관리자 승인의 혼동 방지.
- 수집 전 사이트별 이용약관·robots.txt·재사용 권한 확인 기록 및 허용 범위 준수. 접근 제한 우회·무단 대량 수집·이미지/설명 복제 없음. TechSpecs API 요청 없음.
- 별도 UI 개선 단계에서 기존 인증/프로필/기기 흐름 회귀, 모바일·키보드·대비 검증. 다른 기기/PC-FIT 확장은 해당 단계에서 검증.

## 조원 프로젝트(`pc_final-main.zip`) 스마트폰 데이터 오프라인 정규화 검증 — 2026-11-10 21:52:00 KST

- 실행 명령: `node backend/scripts/validate-normalized-smartphones.js` (대상: `backend/data/normalized-smartphones.json`)
- 결과: **PASS** (외부 네트워크·DB 연결 0회, 임시 ZIP 분석 디렉터리 정리 완료)
- 검증 항목:
  - `smartphones` 26개 모델의 `ck_smartphones_os`, `ck_smartphones_positive`, `ck_smartphones_flags`, `ck_smartphones_verified`, `uq_smartphones_model`(`brand`, `model_name`, `domestic_model_number`) 통과.
  - `smartphone_variants` 39개 옵션의 `fk_variants_smartphone`, `ck_variants_capacity`(`storage_gb > 0`, `ram_gb IS NULL OR ram_gb > 0`), `ck_variants_verified`, `uq_variants_option` 통과.
  - 누락 사양 및 공식 사양 보완 검증: `verified_ready` 16개 모델의 `wireless_charging`이 제조사 한국 공식 사양(`true` 15종, `SM-A356N` `false` 1종)으로 반영되었으며, `iPhone 15` 시리즈 4종(`A3090`, `A3094`, `A3102`, `A3106`)의 `released_on_kr`이 한국 정식 출시일(`2023-10-13`)로 정정됨을 확인. Apple `battery_mah` 13개 모델 전수 `null`, Apple `ram_gb` 20개 옵션 전수 `null` 유지 확인(참조 사양은 `audit_metadata.investigated_reference_specs`에 기록).
  - 출고가·현재 판매가 분리 검증: `currentLowestPriceKrw`가 전수 `null`이므로 `price_observations`가 빈 배열(`[]`)로 유지되고 가짜 24시간 가격이 생성되지 않음을 확인.
  - `smartphone-catalog.js`(`isWithinReleaseWindow`, `matchesHardConditions`) 및 `upgrade-advisor.js`(`evaluateReleaseElapsed`, `buildDeviceCandidateComparison`)와의 정합성 확인:
    - 출시 3년 이내 추천 후보군 21개 모델(검증 완료 11 + 보류 10) 및 출시 3년 경과 업그레이드 대상 5개 모델(`Galaxy S23 Ultra` `2023-02-17`, `iPhone 15 / 15 Plus / 15 Pro / 15 Pro Max` `2023-10-13`) 판정 일치.
    - `Galaxy S23 Ultra → Galaxy S24 Ultra` 및 `iPhone 15 Pro → iPhone 16 Pro` 사양 비교 시 검증된 항목(`wireless_charging` 포함)은 `verified_comparison`으로 비교되고, 공식 미공개 `null` 항목(`ram_gb`, `battery_mah`)은 `insufficient_data`로 처리됨을 확인.
    - 24시간 유효 `price_observations`가 없을 때 `matchesHardConditions`가 추천 후보에서 제외함을 확인.
- 비파괴 Upsert Dry-Run 검증(`node backend/scripts/seed-verified-smartphones.js`):
  - 결과: **DRY_RUN_OK** (실제 DB INSERT/UPDATE/DELETE 0회, 전후 행 수 변동 0건)
  - 예상 적재 건수: `smartphones` 신규 삽입 **16건**(갱신 0, 미변경 0, 충돌 0), `smartphone_variants` 신규 삽입 **29건**(갱신 0, 미변경 0, 충돌 0), `price_observations` **0건**.
  - 보호 대상 테이블(`users`, `profiles`, `owned_devices`, `recommendations`, `price_observations`) 행 수 변동 없음 확인.
- 실제 MySQL 적재(`--apply`), 재실행 중복 방지 및 실시간 API 통합 검증 — 2026-11-10 23:03:00 KST:
  - 1차 적재(`node backend/scripts/seed-verified-smartphones.js --apply`): **APPLY_OK** (`smartphones: 16`, `smartphone_variants: 29`, `price_observations: 0`).
  - 2차 재실행(`node backend/scripts/seed-verified-smartphones.js --apply`): **APPLY_OK** (`smartphones` `unchanged: 16`, `smartphone_variants` `unchanged: 29`, `to_insert: 0`, `to_update: 0`, `conflicts: 0` — 중복 데이터 생성 0건).
  - 실제 Express + MySQL API 통합 검증:
    - `GET /api/smartphones?limit=50`: 출시 3년 이내 추천 가능 옵션 **20개**(11개 모델) 반환, `SM-A356N` `wireless_charging: false` 및 나머지 19개 옵션 `true`, `price: null` 확인.
    - `GET /api/smartphones?only_recommendable=false&limit=50`: 전체 검증 옵션 **29개**(출시 3년 경과 9개 옵션 포함, `iPhone 15` 시리즈 7개 옵션 모두 `released_on_kr: "2023-10-13"`), 브랜드 필터(Apple 15개, Samsung 14개) 확인.
    - `GET /api/owned-device-options`: `q=S24`(7건), `q=iPhone 15`(7건), `q=SM-S918N`(2건) 검색 결과 확인.
    - `POST /api/owned-devices` + `GET /api/upgrade-offer` + `PUT /api/upgrade-offer/state`:
      - `iPhone 15 Pro`(`A3102`, `2023-10-13`) 및 `Galaxy S23 Ultra`(`SM-S918N`, `2023-02-17`) 카탈로그 선택 등록 시 `upgrade_offer_eligible: true`, `should_show_popup: true`, `needs_verification: false` 확인.
      - `iPhone 16 Pro`(`A3293`, `2024-09-20`) 및 `Galaxy S24 Ultra`(`SM-S928N`, `2024-01-31`) 카탈로그 선택 등록 시 `upgrade_offer_eligible: false`, `should_show_popup: false`, `needs_verification: false` 확인.
      - 수동 입력(`manual_brand: "apple"`, `manual_model_name: "iPhone 15"`) 등록 시 카탈로그(`A3090`, `2023-10-13`) 자동 매칭 및 `upgrade_offer_eligible: true` 확인.
    - 테스트 종료 후 임시 계정·보유 기기·세션 정리 완료(`smartphones: 16`, `smartphone_variants: 29`, `users: 0`, `profiles: 0`, `owned_devices: 0`, `recommendations: 0`, `price_observations: 0`, `sessions: 0`).

## 실제 MySQL DB 기반 Express 추천 API 및 Gemini AI 추천 통합 검증 — 2026-11-11 16:25:00 KST

### 1. 테스트 실행 결과 요약 (58/58 전수 통과)

| 테스트 스위트 | 실행 대상 파일 | 통과 / 전체 | 주요 검증 항목 |
|---|---|---|---|
| `test:db` | `test/db.test.js`, `test/env.test.js` | **8 / 8** | 설정 오류 은폐, MySQL 8.0 CHECK 지원, DDL 무결성, 헬스체크 |
| `test:auth` | `test/auth.test.js`, `test/auth.integration.test.js` | **5 / 5** (33 assertions) | 실 DB scrypt 동시성(2제한), 세션 만료, 쿠키 보안, 회원가입/로그인 라이프사이클 |
| `test:member` | `test/member.test.js`, `test/member.integration.test.js` | **5 / 5** (65 assertions) | 프로필 낙관적 락(version 충돌 409), 보유 기기 20개 상한, 미승인 변형 등록 차단 |
| `test:smartphone` | `test/smartphone.test.js`, `test/smartphone.integration.test.js` | **5 / 5** (34 assertions) | 3년 출시일 윈도우, 24시간 가격 신선도, 후보 검색 필터, 커서 기반 페이지네이션 |
| `test:recommendation` | `test/recommendation.test.js`, `test/recommendation.integration.test.js` | **4 / 4** (34 assertions) | 자연어 분석 draft 추출, 환각 방어, 분당 5회 속도 제한, 추천 저장 및 이력 |
| `test:upgrade` | `test/upgrade.test.js`, `test/upgrade.integration.test.js` | **5 / 5** (28 assertions) | 정확 3년 경계, 30일 snooze, 영구 숨김, 현재 기기 유지(keep) 제안 |
| `publication-import` | `test/publication-import.test.js`, `services/smartphone-price-preview.test.js` | **25 / 25** | 공개 게이팅 fail-closed, 트랜잭션 롤백, 개발 가격 우선순위 및 색상 매칭 |
| `test:gemini-live` | `test/gemini-live.integration.test.js` | **1 / 1** | 실서버 Gemini Live API 자연어 분석 및 종단간 추천 성공 (2회 호출, 2,718 토큰) |
| **합계** | **전체 백엔드 테스트** | **58 / 58** | **전수 통과 (실패 0)** |

### 2. 개발 가격 Fallback 및 실제 카탈로그 후보 도출 검증
- 실행 스크립트: `verify-dev-price-fallback.js`
- 결과: **PASS**
  - `ALLOW_DEVELOPMENT_PRICES` 미지정 시: `status: 'no_match'`, `candidates: 0` (실시간 가격 부재 정상 반영)
  - `ALLOW_DEVELOPMENT_PRICES=true` + `NODE_ENV=development`: `status: 'candidates_ready'`, `candidates: 11` (실제 DB 카탈로그 기반)
  - Fallback 가격 정보: `price_source: 'official_launch'`, `observation_id: null`, `development_only: true`, 경고 문구 정상 부착
  - 추천 생성(`POST /api/recommendations`): Mock AI 및 Gemini 추천 생성 HTTP 201 성공, DB FK 제약 오류 없음
  - 이력 조회(`GET /api/recommendations/:id`): 당시 참고 가격 보존 및 `is_expired_now: false` 정상 포맷
  - DB 무결성: `price_observations` 건수 **0건** 유지 (가짜 관측 레코드 무단 생성 없음)

### 3. 보안 및 데이터 무결성 검증
- `.env` 및 API 키 원문, 일부 문자열, 해시 노출 0건
- 프론트엔드(`front/`) 수정 0건
- MySQL 49개 모델 및 31개 변형 데이터 100% 보존 확인 (삭제 및 재적재 없음)


## 실제 판매 가격 수집 검증 계획 — 2026-11-10 23:16:23 KST, 구현·실행 전

이번에는 정적 계약·문서 링크/변경 범위만 점검했다. 아래는 후속 시험이며 통과 기록이 아니다.

| 시험 | 기대 결과 |
|---|---|
| 출처 권한/robots | 권한 미확인·만료, 금지 경로, 403/CAPTCHA는 수집 차단. 429는 허용 시각까지 연기, 우회 없음 |
| 정확한 옵션 | 국내 모델번호+용량+색상/SKU 근거 일치만 매칭. 해외판/동명이종/액세서리/색상별 차등가 보류 |
| 가격·구매 조건 | 출고가·월납입금·조건부 할인·미확인 배송/재고/신품/자급제의 적격화 금지. 문자열 false도 true로 변환 금지 |
| 승인 경계 | 미승인/반려/null 플래그 적재 0, 승인 이후 값 변경·해시 불일치 차단. 승인 시각으로 관측 시각 재설정 금지 |
| 수명 | 미래 시각, expires<=observed, 수명>24h 거절. 정확히 24h 수명 허용, now==expires 제외; 더 짧은 출처 TTL 적용 |
| 최신 판매처 | 최신 품절/만료 후 과거 저가 회귀 없음. 배송비 포함 합계, 동일 판매처 다중 URL 대표 오퍼 선정 일관성 |
| 누락·수집 장애 | timeout/파싱 실패를 품절이나 무료배송으로 오인하지 않음. 가격 없는 품절에 과거 금액/0 삽입 금지. 기존 TTL 잔존 위험 별도 점검 |
| 재실행·동시성 | 동일 승인 배치 재실행 skip, 중복 프로세스 차단, 트랜잭션 원자성, 커밋 후 로그 장애 복구. 실제 재관측은 새 행 허용 |
| URL/보안 | 내부 IP/비HTTP/허용되지 않은 리다이렉트 거절, 외부 본문 실행 금지, 토큰/개인정보 로그 없음 |
| 통합/회귀 | 카탈로그 가격·후보 예산·가격변경 409 검증. 기존 16모델·29변형·보유/업그레이드 영향 없음. 전용 테스트 자료만 정리 |

실제 판매가 확보 및 이용 권한 확인 후 별도 승인된 작업에서 시행한다. 근거·개발 순서: [PRICE_COLLECTION_PLAN.md](PRICE_COLLECTION_PLAN.md).

## 스마트폰 확장 조사 검증 결과 — 2026-11-11 04:18:28 KST

| 실제 실행 | 결과 | 한계 |
|---|---|---|
| 기존 validate-normalized-smartphones.js | PASS: 26모델/39변형, 기존 검증16/29·보류10/10 | 원본 데이터 형식/정책 검사; 전체 웹 사실 검증 아님 |
| validate-smartphone-expansion.js | PASS: 52모델·99구성·출고가70·운영판매가0 | 출처 URL 문법/참조·중복·날짜·null·가격 분리 검증; 출처 내용의 진실/완전성·재사용 허가를 자동 인증하지 않음 |
| node --test backend/scripts/validate-smartphone-expansion.test.js | 14/14 PASS | 중복 식별자/옵션, 범위 밖·잘못된 날짜, 없는 출처, 추정 재고, 캐시 가격 승격, 출고가 혼용, 원본 변경, RAM/색상 옵션 보존 검사 |
| dry-run-smartphone-expansion.js | 실제 MySQL READ ONLY 성공:16/29/가격0, 원본16/29 누락0 | 기존 컬럼·제품 식별/옵션 대조만. 새 데이터 적재·스키마 변경·전체 기능 회귀 테스트 아님 |

첫 DB 시도는 EPERM으로 실패했고 연결 권한 승인 후 재실행했다. `.env` 직접 조회 없이 기존 백엔드 연결 모듈만 사용했으며 인증정보는 출력하지 않았다. DB 쓰기 0. 보고서는 `backend/data/smartphone-expansion-dry-run-report.json`에 보존한다.

재실행(프로젝트 루트): `node backend/scripts/validate-smartphone-expansion.js`, `node --test backend/scripts/validate-smartphone-expansion.test.js`. DB 대조는 `node backend/scripts/dry-run-smartphone-expansion.js`; 별도 옵션/쓰기 모드 없음. 앱/Gemini/프론트 E2E는 이번 작업에서 실행하지 않았다.

### Phase 1 완료 게이트 — 아직 미통과

- 실제 세션 인증·CSRF·소유권, 프로필 저장 복원, 보유 기기 검색/수동/대표/수정/삭제.
- 국내 공식 판매일 기준 3년 경계·모델 미확인·30일 유예·영구 숨김·일반 추천 접근, 기존2023제품 유지.
- 내부 DB 스마트폰 2~3개 실제 비교, 옵션 차이/누락/폴더블 화면 구분. 큰 수치를 무조건 우수로 판정하지 않음; Gemini 호출0.
- 출고가/실판매가 분리, 배송비/품절/신품/자급제/약정/조건부 할인, 정확한 SKU, 시각 미래/만료/24h경계, 캐시·수집 실패 제외.
- 실제 Gemini는 내부 적격 후보만 사용, Express 제품ID/사양근거/예산/필수조건 검증, keep/no_match/hold 및 추천 이력. Mock 통과와 실제 호출 결과 별도 기록.
- 검증된 공식 정보/구매 링크, 잘못된 URL/외부 콘텐츠 처리, 모바일390px·키보드·로딩/오류 복구.
- 기존 실제 데이터 보존한 전용 계정으로 전체 흐름 통과 후 Phase 2 착수. 향후 카테고리별 사양 정의·제조사 확장은 별도 테스트 계획이고 이번 실행 대상 아님.

## 최소 DB 확장 설계 검토 — 2026-11-11 04:35:45 KST

실행: 파일 정적 대조 및 분류 합계 검증(신규41=적재가능0+추가검증32+보류9), 기존원본해시 일치. DB/앱/SQL 테스트는 미실행이다. [설계안 §9](SMARTPHONE_DB_EXTENSION_DESIGN.md)의 승인 후 검사에 기존16/29 ID/FK보존, RAM12/16·NULL 유일성, 영어/한국어색상 매핑, metadata/상세필드 승인, 폴더블 안팎 화면, null 덮어쓰기 방지, 출고가/판매가 분리, 보유기기 미승인행 노출 차단과 기존 API 회귀를 추가했다. 이번 설계 검토를 마이그레이션 통과로 간주하지 않는다.

## NULL RAM 및 최신 대표 검증 — 2026-11-11 04:43:02 KST

정적검증: 기존29변형(미확인RAM15)의 COALESCE키 충돌0, NULL/NULL 및12/12 같은키,12/16 및NULL/12 다른키의4논리사례 확인. 원본해시 대조와18모델/신규전체41분류(0/33/8)합계 확인. MySQL/DDL/API회귀는 미실행. 후속승인시험에는 DB collation색상중복, 같은키동시삽입, NULL→known 동시보완·기존ID유지, 부모행잠금 모든입력경로 적용, 기존FK/검증값보존을 포함한다. 공식근거확인과 운영적재승인을 구분한다.

## A/B/C 재분류 정적 검토 — 2026-11-11 04:50:14 KST

수행: JSON 집계 우선18/49구성/출고가35 및 전체52/99구성/출고가70, A완료 우선9/신규전체10, B색상특정2, 원본해시 보존 확인. DB/HTTP 시험은 미실행.

후속 승인 후 시험: (1) 출고가null·가격행0인 A+B 변형 등록/조회 가능, (2) Apple RAM null을 사실 검증 실패로 처리하지 않음, (3) 색상 목록×용량 곱집합과 형제 변형 자동승인 거절, (4) S25 Ultra16GB 전용색상1건만 채택, (5) S26+블랙256/12만 채택, (6) OS계열과 출시버전 구분·미검증 baseline 무단승격 거절, (7) 현재가 없으면 보유기기/연령판정 가능하되 추천후보 제외, (8) 미승인행 운영DB적재 차단 및 카탈로그/보유기기 조회 노출 검토, (9) 기존16/29 ID/FK/verified/날짜 보존, (10) 출고가 metadata 없이 금액승격 금지. 실제 통과로 기록하지 않는다.

## 스마트폰 적재 준비 오프라인 검증 — 2026-11-11 09:27:27 KST

실행: `node --test backend/scripts/prepare-smartphone-upsert.test.js` **24/24 통과**. 기본/--extended 계획 각각모델2·변형2·충돌0·쓰기0. 기존16/29 원본 및신규근거파일해시일치. 쓰기인수거부,국내번호중복,NULL RAM중복/unknown→known동일ID제안,색상별칭보류,출고가null허용/판매가혼용거절,NULL유지/문자false거절,URL위험형식/해시변조/서로다른SKU거절을검증했다. 기존catalog/upgrade순수함수로가격없는후보제외/null비교/연령판정확인.

SQL검사는텍스트상PK/FK/가격테이블불변및생성키/기본값/단계분리확인뿐이다. MySQL/DDL/실제collation·동시성·HTTP/API/FK실행검증은미실행. 안전한별도테스트DB의격리/접속정보가제공되지않아DB연결0.

후속: 적용전ID/FK전체스냅샷·복원시험,002부분실패복구/기존쓰기경로호환,003전부모행잠금/ORM,링크리디렉션/대상모델검수,API기존키보존·미승인행노출차단,동일변형할인계산의null/만료/배송비/음수차이,프론트4화면정보없음표시를별도승인후검증한다.

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


## 최신 교차 검증 결과 — 2026-11-11T19:39:19+09:00

- 실제49모델/31변형 및 기존 사용자 데이터 보존 확인. 신규33개 pending/verified=false, 모델번호/동일명 중복0, 보류8개 미등록. 상세33행은 TEST_PLAN 최신 절 참조.
- iPhone Duo(A3720,90000153)는 원본 조사JSON부터 등록 후보였고 실제 비공개 DB행에 존재. 식별 재확인 전 공개 불가. 신규 검수10개에 기존iPhone15/16을 포함하면 분류 오류. 이번 최종 승인 확정0.
- 수정: 보유기기 PUT 미승인 변형 우회 차단, 테스트 제품 예외를 NODE_ENV=test로 제한, 미확인 RAM/색상 가격 자동승격 차단, 가격근거 검토 상태 및 추천 완료 시 사양·모델ID 재검증 보강.
- 수정 전81/81 → 수정 후90/90 통과. Antigravity58개 중 유료Live1개는 재호출하지 않아 독립 재검증은57개이며 적재준비24개·신규회귀9개를 더한 수치다. 실제HTTP217단언, Mock추천 저장·이력의 가격 출처/경고 동일. 추가 유료호출0.
- 테스트 후8테이블 전체 기존 행 동일,49/31·가격관측0·공개 상태 보존. 스키마/제품 데이터/프론트/Git 변경 없음.
- 다음: 일반 개발 서버 재시작 후 프론트 연결 가능. 신규 모델 공개·실판매 추천 출시는 국내 식별과 가격 매핑 검수 대기. 상세 발견/수정/한계는 DEVELOPMENT_LOG 같은 시각 절. Codex 편집 종료.


### 신규33모델 실제 ID 대조 (기존16모델은 이전 백업 ID로 제외)
자료상의 번호·날짜는 DB와 동일하며 외부 재검증 결과가 아니다. 전체 pending/verified=false. ‘검수 후보’는 공개 승인 완료가 아니다.
| DB ID | 제품명 | 국내 모델번호(기존 자료) | 국내 출시일(기존 자료) | 판정 |
|---|---|---|---|---|
| 90000121 | Galaxy A25 5G | SM-A256N | 2024-01-05 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000122 | Galaxy A15 LTE | SM-A155N | 2024-03-18 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000123 | Galaxy A16 LTE | SM-A165N | 2024-11-29 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000124 | Galaxy S25 | SM-S931N | 2025-02-07 | 자료상 일치·중복 없음 / 추가 검증 필요 (10개 검수 후보) |
| 90000125 | Galaxy S25+ | SM-S936N | 2025-02-07 | 자료상 일치·중복 없음 / 추가 검증 필요 (10개 검수 후보) |
| 90000126 | Galaxy S25 Ultra | SM-S938N | 2025-02-07 | 자료상 일치·중복 없음 / 추가 검증 필요 (10개 검수 후보) |
| 90000127 | Galaxy S25 Edge | SM-S937N | 2025-05-23 | 자료상 일치·중복 없음 / 추가 검증 필요 (10개 검수 후보) |
| 90000128 | Galaxy S25 FE | SM-S731N | 2025-09-19 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000129 | Galaxy Z Fold7 | SM-F966N | 2025-07-25 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000130 | Galaxy Z Flip7 | SM-F766N | 2025-07-25 | 자료상 일치·중복 없음 / 추가 검증 필요 (10개 검수 후보) |
| 90000131 | Galaxy Z Flip7 FE | SM-F761N | 2025-07-25 | 자료상 일치·중복 없음 / 추가 검증 필요 (10개 검수 후보) |
| 90000132 | Galaxy A36 5G | SM-A366N | 2025-06-12 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000133 | Galaxy A17 LTE | SM-A175N | 2025-11-07 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000134 | Galaxy S26 | SM-S942N | 2026-03-11 | 자료상 일치·중복 없음 / 추가 검증 필요 (10개 검수 후보) |
| 90000135 | Galaxy S26+ | SM-S947N | 2026-03-11 | 자료상 일치·중복 없음 / 추가 검증 필요 (10개 검수 후보) |
| 90000136 | Galaxy S26 Ultra | SM-S948N | 2026-03-11 | 자료상 일치·중복 없음 / 추가 검증 필요 (10개 검수 후보) |
| 90000137 | Galaxy S26 FE | SM-S741N | 2026-09-04 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000138 | Galaxy A37 5G | SM-A376N | 2026-06-19 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000139 | Galaxy Z Fold8 Ultra | SM-F976N | 2026-08-07 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000140 | Galaxy Z Fold8 | SM-F971N | 2026-08-07 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000141 | Galaxy Z Flip8 | SM-F776N | 2026-08-07 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000142 | Galaxy Buddy3 | SM-A156L | 2024-04-26 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000143 | Galaxy Quantum5 | SM-A556S | 2024-08-28 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000144 | Galaxy Quantum6 | SM-A566S | 2025-08-01 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000145 | iPhone 16e | A3409 | 2025-02-28 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000146 | iPhone 17 | A3520 | 2025-09-19 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000147 | iPhone Air | A3517 | 2025-09-19 | 자료상 일치·중복 없음 / 추가 검증 필요 (10개 검수 후보) |
| 90000148 | iPhone 17 Pro | A3523 | 2025-09-19 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000149 | iPhone 17 Pro Max | A3526 | 2025-09-19 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000150 | iPhone 17e | A3634 | 2026-03-11 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000151 | iPhone 18 Pro | A3714 | 2026-09-18 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000152 | iPhone 18 Pro Max | A3717 | 2026-09-18 | 자료상 일치·중복 없음 / 추가 검증 필요 (OS NULL) |
| 90000153 | iPhone Duo | A3720 | 2026-10-23 | 공개 불가: 식별 재확인 |

DB 미등록 보류8개: Galaxy Z Fold Special Edition, Galaxy Z TriFold, Galaxy Wide7, Galaxy Buddy4, Galaxy Wide8, Galaxy Buddy5, Galaxy Wide9, Galaxy Quantum7. 실제 중복 가능성을 특정할 자료 충돌은 발견0이나, 이름이 다른 동일 기기/해외 모델번호의 오기 여부는 외부 검증 없이 확정할 수 없다.

재실행: NODE_ENV=test AI_PROVIDER=mock으로 기존 db/env/auth/member/smartphone/recommendation/upgrade 단위·통합, publication-import, smartphone-price-preview, prepare-smartphone-upsert 및 cross-verification 2개 테스트를 node --test --test-concurrency=1로 실행. gemini-live.integration.test.js는 제외. 새 실제 카탈로그 검증은 로컬 final_project 대상 확인·전용 계정 생성/정리·제품 상태 무변경 방식. .env는 앱 자동 로딩만 사용한다.
