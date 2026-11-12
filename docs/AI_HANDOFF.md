# AI 인수인계 스냅샷 (AI Handoff)

> 최신 보완(2026-11-13 04:57 KST): 판매처별 내부 feed 처리·저장 함수·005 SQL 초안·가격 요약 API/비교 표시 구현. 관련 Mock/SSR37개·빌드 통과. 실제 다나와 연결·저장권한 미확보, 격리 MySQL 초기화 signal11로 실제 DB 검증 미완료. 운영 DB 미접속/미변경. 하단 건수는 과거 스냅샷이며 이번에 재확인하지 않음. Codex 편집 종료; 상세 및 재개 조건은 PRICE_COLLECTION_PLAN 최신 절. Gemini 순위 결정은 기존 방식 유지, AI 설명 전용 서버 순위 정책은 미구현.

> 이 문서는 Codex와 Antigravity 간 세션 전환 및 작업 인계를 위한 **현재 시점 단일 스냅샷**이다.
> 과거 작업 이력은 누적하지 않으며, 주요 상태가 변경될 때 최신 상태로 덮어써서 갱신한다.
> 상세 규칙: [docs/AI_WORKFLOW.md](AI_WORKFLOW.md) | 유일한 개발 규칙 원본: [docs/DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md)

---

## 1. 인계 메타데이터
- **최신 갱신 일시:** 2026-11-12T00:10:00+09:00
- **인계 작업 주체:** Antigravity
- **다음 작업 대상:** Codex Desktop / Antigravity 공통
- **마지막 반영 로그 ID:** `2026-11-12T00:10:00+09:00` (DEVELOPMENT_LOG.md: 실제 IT기기 제품 이미지 확보 및 `/compare` 적용)

---

## 2. 현재 시스템 및 기술 스택
- **Frontend:** Vue 3.5 + Vuetify 3.13 + Vue Router 4 + Vuex 4
- **Backend:** Node.js (v26.3.0) + Express 4.16 + Sequelize 6.37 + MySQL 8.0.45
- **AI Engine:** Google Gemini API (`gemini-3.5-flash-lite`, `gemini-3.6-flash`) + Mock AI Adapter

---

## 3. 데이터베이스 및 카탈로그 현황
- **smartphones:** 49개 모델 (기존 검증 16개 + 신규 33개 적재 완료)
- **smartphone_variants:** 31개 변형 (기존 검증 29개 + 신규 2개 적재 완료)
- **신규 33개 모델 상태:** 전원 `pending` 및 `verified = false` (비공개 유지)
  - 10개 모델: 기존 자료상 검수 후보. 이전 교차 검증에서 최종 공개 승인을 확정한 것은 아님
  - 22개 모델: `os IS NULL` 상태로 추가 공식 사양 확인 필요 (CHECK 제약상 verified 승격 불가)
  - 1개 모델(`iPhone Duo`, A3720): 식별 불확실로 공개 보류. 실제 DB 상태는 `pending`이며 `held`로 변경한 것은 아님
  - 미식별 8개 모델: DB 외부 파일 격리 유지
- **price_observations:** 실제 유효 판매 관측치 0건 (개발 환경은 대체 가격 fallback 사용)

---

## 4. 백엔드 기능 및 검증 완료 상태
- **인증/회원 및 보유 기기 보안:**
  - 세션 기반 scrypt 인증, CSRF 방어, 프로필 CRUD 및 낙관적 락(version) 완료
  - 보유 기기 수정(`PUT`) 시 미승인 변형으로의 우회 변경 차단 (`publicOnly` 검사 복구)
  - 보유 기기 20개 상한, 3년 경계 판정, snooze/영구숨김, keep 제안 완료
- **추천 API 및 개발 가격 안전성 (Codex 교차 검증 보강):**
  - 테스트 제품 및 `include_test` 예외 처리를 `NODE_ENV=test` 환경으로 엄격 제한
  - 미확인 RAM/색상 가격 자동승격 차단 (명시적 variant_id/실제 사양 일치만 허용)
  - 추천 완료 시점 DB 사양·모델 ID 일치 여부 재검증 추가 (가격만 일치하는 사양 조작 차단)
  - `ALLOW_DEVELOPMENT_PRICES=true` + `NODE_ENV=development` 시 출고가/참고가 기반 11개 후보군 도출
  - `recommendations` 저장 시 `observation_id: null` 및 `development_only: true` 메타데이터 안전 보존
  - 실제 `price_observations` 테이블 가짜 가격 삽입 0건 (DB 무결성 100% 보존)
- **테스트 통과 현황 (Codex 최종 검증):**
  - 전체 단위/통합 테스트 **90/90 통과** (기존 비과금 57개 + 적재 준비 24개 + 신규 회귀 9개)
  - HTTP 상태 단언 **217건** 전수 통과 (인증 33 / 회원 65 / 스마트폰 34 / 추천 34 / 업그레이드 29 / 카탈로그 22)
  - 이전 실제 Gemini Live API 2/2 호출 성공 보존 (Codex 교차 검증 시 추가 유료 호출 0건)

---

## 5. 핵심 보안 및 작업 제약사항
- `backend/.env` 및 비밀정보 파일 직접 열람·수정·출력 절대 금지
- `iPhone Duo` 등 미검증 모델의 DB 일괄 공개(approved/verified) 금지
- 프론트엔드 작업 시 기존 백엔드 API 계약 및 DB 스키마 무단 수정 금지
- Git commit 및 push는 사용자 명시적 요청 시에만 수행

---

## 6. 프론트엔드 구현 및 검증 현황
- **`/recommend` (AI 스마트폰 추천 화면):**
  - `GET /api/profile`로 확정 여부·version 확인 후 `POST /api/recommendations` 1회 호출.
  - 예산/사용 목적/선호 제조사 폼, 결과 카드, 개발 가격 경고, 모바일 390px 반응형 및 키보드 접근성 강화 완료.
  - 관련 단위/SSR 테스트: `test/recommendation-ui.test.cjs` 8/8 통과.
- **`/compare` (스마트폰 상세 스펙 비교 화면):**
  - 2개 비교 기본, 최대 3개 확장 비교 지원.
  - 상단 1:1 빠른 선택 드롭다운 및 제조사/모델명/모델번호 검색 모달 제공.
  - DB/API 이미지 우선 사용 및 공통 스마트폰 SVG 플레이스홀더 제공.
  - 7개 카테고리(기본 정보, 디스플레이, 성능, 카메라, 배터리, 네트워크, 가격) 상세 사양 및 '값 다름' 강조, '차이 있는 항목만 보기' 지원.
  - 개발용 출고가/참고가 구분 및 경고 안내 표시, API 미제공 필드 정직하게 '정보 없음' 처리.
  - 관련 단위/SSR 테스트: `test/compare-ui.test.cjs` 7/7 통과, 실제 Headless Chrome 브라우저 검증 8/8 항목 전수 통과.
- **`/history` (추천 이력 화면) 및 `/recommendations/:id` (추천 상세 화면):**
  - `/history`: `GET /api/recommendations`로 본인 과거 AI 추천 이력 목록 조회 (90일 보관 정책), 추천일·예산·사용목적·추천기기 요약, 개별 삭제(`DELETE /api/recommendations/:id`), 빈 상태 안내/CTA, 커서 기반 추가 조회 지원.
  - `/recommendations/:id`: `GET /api/recommendations/:id`로 특정 추천 건 단건 상세 조회 (새로고침 유지), 추천 당시 요청 조건 스냅샷(예산, 목적, 브랜드, 프로필 버전) 표시, 기존 `RecommendationResult.vue` 재사용(추천 기기, 상세 사양, 이유, 가격 상태 `is_expired_now`/`price_status_note`, 개발용 가격 경고), 404/90일 만료 시 안내 및 목록 복귀.
  - 관련 단위/SSR 테스트: `test/history-ui.test.cjs` 5/5 통과.
- **`/` (기기로움 종합 IT 플랫폼 메인 페이지 프리미엄 리디자인):**
  - 제조사 중립적 스튜디오 제품 비주얼 4종(`front/src/assets/home/hero-*.jpg`) 자체 생성·탑재 (무단 복제·핫링크 배제, 개별 실물 SKU 이미지는 미확보로 정직 구분).
  - `HeroSlideshow.vue`: 4종 슬라이드(통합 IT 플랫폼, AI 스마트폰 추천, 상세 스펙 비교, PC-FIT 준비 중 다크), 7초 자동 전환, 좌우 버튼·인디케이터·일시정지, 키보드 화살표, `prefers-reduced-motion`, 수동 조작 시 자동전환 방해 방지, `@error` 이미지 폴백 구현.
  - `HomeView.vue`: 5대 확장 영역 서브 내비게이션(AI 추천, 상세 비교, PC-FIT 준비 중, 보유 기기, 프로필, 추천 이력) + 히어로 슬라이드쇼 + Section A(AI 맞춤 추천) + Section B(IT기기 스펙 비교·실제 비교 UI 요약) + Section C(PC-FIT 조립 PC 준비 중 다크 섹션) + Section D(간결한 마지막 CTA). 불필요한 테이블/반복 설명 섹션 제거.
  - 단위/SSR 테스트 `test/home-ui.test.cjs` 7/7 통과 및 실제 데스크톱 Chrome(`1440×900`) 검증 완료 (4종 슬라이드 전환, 키보드·수동 조작, 404 이미지 폴백 무흔들림, 로그인/비로그인 분기, `/pc`·`/compare`·`/recommend` 이동, 전역 스타일 무회귀, 콘솔 오류 0건).
- **내부 페이지 디자인 통일 (`/recommend`, `/compare`, `/history`, `/recommendations/:id`, `/profile`, `/devices`):**
  - 공통 Vuetify 테마(`tokens.js`), `AppButton.vue`(`rounded="pill"` 블랙/아웃라인 필), `global.css` 모노크롬 카드·폼·비교표 차이 하이라이트(`#f5f5f7`) 통일 적용 (오류/경고/성공 시맨틱 색상 및 `HomeView`/`HeroSlideshow` 무수정).
  - `/recommend`: 단계 구분(`01 필수 조건`·`02 선택 조건`·실행 영역), 칩형 선택, 앰버 개발용 가격 경고 유지.
  - `/compare`: Apple식 비교표·SVG 플레이스홀더 유지, 카테고리 탭·개수 버튼·모달 검색·차이 강조를 모노크롬 블랙/그레이 톤으로 정리.
  - `/history` & `/recommendations/:id`: 상태 뱃지·조건 요약 바·스냅샷 카드 가독성 개선, 삭제 및 90일 만료 안내 유지.
  - `/profile` & `/devices`: 칩형 선택지, 깔끔한 입력 테두리·모달 호버 정리 (기존 검색/등록/수정/삭제 동작 유지).
  - 실제 Chrome(`1440×900`) 6개 내부 페이지 렌더링·입력 조작·경고 가독성·콘솔 오류 0건 확인.
- **UI·UX 고도화 1차 (`docs/DESIGN_SYSTEM.md`, `/recommend`):**
  - 공통 디자인·인터랙션 원칙(`docs/DESIGN_SYSTEM.md`, `global.css` 스켈레톤·전환·`prefers-reduced-motion`) 정립 및 `/recommend` (`RecommendView.vue`, `RecommendationResult.vue`) 3단계 구매 가이드 위저드·스켈레톤·스포트라이트 결과 카드 적용.
- **Apple 스타일 기기 비교 화면(`/compare`) 전면 리디자인 (`SpecComparison.vue`, `compare-ui.test.cjs`):**
  - 기본 화면의 좌측 라벨형 `<table>`·반복 `값 다름` 뱃지를 제거하고 Apple식 독립 세로 제품 열(`.apple-columns-grid` / `.apple-hero-col`, 2~3열)로 전면 개편.
  - 상단 고정 스티키 바(`.sticky-compare-bar`, `top: 64px`), 제품 이미지 무대(SVG/`@error` 폴백)·모델명·가격/출처·`기기 변경`/`제거`, 아이콘+굵은 핵심 수치+보조 설명 세로 블록(`.visual-specs-area`, CSS Grid 수평 행 정렬) 구현.
  - 7개 영역 상세 비교표는 중앙 `상세 사양표 모두 보기`/`접기` 아코디언(`#detailed-spec-panel`, 초기 `aria-expanded="false"`, `inert`, `prefers-reduced-motion` 대응)으로 분리하고 `차이 있는 항목만 보기` 및 2~3열과 실시간 동기화.
  - 상세 사양표 세부 정렬 개선: 첫 열 '값 다름' 뱃지 겹침 해소(`.spec-label-wrap` 세로 flex gap 6px), `table-layout: fixed` 기반 2~3열 너비 완전 균등 분할 및 사양 값 가로 중앙(`text-align: center`)·수직 가운데(`vertical-align: middle`) 정렬, 긴 텍스트 중앙 줄바꿈 통일.
  - 실제 데스크톱 Chrome(`1440×900`, 모의 API) 검증으로 2·3열 수평 정렬(`0px` 오차), 스티키 바, 모달 검색/교체·제거, 차이만 보기, 아코디언 펼침/접힘, 스마트폰·태블릿·스마트워치·노트북 전환, 콘솔 오류 0건 확인.
- **실제 IT기기 제품 이미지 확보 및 `/compare` 적용 (`deviceImages.js`, `SpecComparison.vue`, `supplemental-devices.json`):**
  - 저작권/사용조건 감사(Samsung/Apple 공식 사이트 비교표 재배포 불가 제외, Wikimedia Commons `CC0`/`CC BY 4.0`/`CC BY-SA 4.0` 중 모델·세대·크기 일치 사진만 선별)로 **26/40 모델**(스마트폰 15/16, 태블릿 8/14, 스마트워치 3/10) 확보, 미확보 14종은 기존 카테고리 SVG 플레이스홀더 유지(`thumbnail_url: null`).
  - `front/public/images/products/`(26개 최적화 JPEG/PNG) + `front/src/utils/deviceImages.js`(모델 대표 이미지 `model_reference`와 변형 SKU 구분, 공통 `resolveDeviceImage` 조회, 우선 `/compare`에만 적용).
  - Chrome(`1440×900`) 실사진·미확보 SVG·3열·탭 전환·`@error` 폴백 및 콘솔 오류 0건 확인.
- **빌드 및 프론트엔드 테스트 전체:**
  - 단위/SSR 테스트: **33/33 통과** (`home-ui` 7/7, `history-ui` 5/5, `recommendation-ui` 10/10, `compare-ui` 11/11).
  - 빌드: `npm run build` 성공 (`DONE Build complete`, 기존 폰트·히어로 이미지·`galaxy-tab-s9.png` 크기 권고 3건 외 오류 없음).
- **다음 작업 (후속 UX 고도화):** `/devices`(갤러리형), `/profile`, `/history`, `/upgrade`(기존 로직 확인 기반 UI 개선), 메인 페이지 절제된 스크롤 리빌 검토 및 PC-FIT 통합 대비.

## 로컬 인증·공개 카탈로그 현재 정책
- 개발 HTTP Origin은 설정된 localhost/127.0.0.1의 동일 포트 별칭만 허용. production은 설정 Origin 하나만 허용. CSRF 토큰·HttpOnly·SameSite·Secure 정책 유지, 프록시 changeOrigin=false 유지.
- 비밀번호는 프론트/백엔드 모두8~128 Unicode 코드포인트·512 UTF-8 바이트 이하, scrypt/기존 해시 유지.
- 게스트 스마트폰 목록·상세는 공개 검증 행만 접근. pending/is_test는 게스트 조회 불가. 개인 프로필/추천후보/이력은 인증 필수. CompareView의 게스트 로딩 중단 조건 제거, 정적 태블릿/워치 비교 유지.
- 이번 검증: localhost:8080 실제HTTP17, 백엔드 관련34/34, 프론트15/15, 빌드 성공(크기 경고3). 게스트 브라우저 스마트폰29·태블릿14·워치10 선택 가능. 임시 계정 정리 후8테이블 모든 기존 행 동일, Gemini 호출0. 검증용으로 시작한 서버는 종료하며 VS Code에서 backend npm run start / front npm run serve 재시작 필요.
