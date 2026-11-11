# AI 인수인계 스냅샷 (AI Handoff)

> 이 문서는 Codex와 Antigravity 간 세션 전환 및 작업 인계를 위한 **현재 시점 단일 스냅샷**이다.
> 과거 작업 이력은 누적하지 않으며, 주요 상태가 변경될 때 최신 상태로 덮어써서 갱신한다.
> 상세 규칙: [docs/AI_WORKFLOW.md](AI_WORKFLOW.md) | 유일한 개발 규칙 원본: [docs/DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md)

---

## 1. 인계 메타데이터
- **최신 갱신 일시:** 2026-11-11T19:50:00+09:00
- **인계 작업 주체:** Google Antigravity
- **다음 작업 대상:** Codex Desktop / Antigravity 공통
- **마지막 반영 로그 ID:** `2026-11-11T19:39:19+09:00` (DEVELOPMENT_LOG.md: Antigravity 독립 교차 검증·최소 수정)

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
  - 10개 모델: 사양 및 국내 정식 출시일 확인 완료 (향후 승인 메타데이터 작성 후 개별 승인 가능)
  - 22개 모델: `os IS NULL` 상태로 추가 공식 사양 확인 필요 (CHECK 제약상 verified 승격 불가)
  - 1개 모델(`iPhone Duo`, A3720): 식별 불확실 및 출처 불명으로 보류(`held`), 절대 공개 금지
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

## 6. 다음 우선 작업 (Next Task)
- **우선순위 1:** Vue 추천 화면의 실제 Express 추천 API 연동 (`POST /api/recommendation-candidates`, `POST /api/recommendations`)
- **우선순위 2:** 개발용 가격 fallback 적용 시 프론트엔드에 "개발용 참고 가격" 경고 배너 표시 UI 구현
