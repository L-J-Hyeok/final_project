# 사용자 제공 공식 제품 렌더 이미지 등록 가이드 (단일 대표 이미지 정책)

직접 확보하신 제조사 공식 제품 렌더 이미지를 프로젝트에 추가하고 투명 배경 최적화 및 자동 매핑을 적용하는 방법입니다.

기기로움은 **모델·색상별 대표 렌더 이미지 1장**을 비교 화면에 선명하게 표시합니다. 전후면이 하나의 이미지에 함께 들어 있는 공식 렌더(예: 삼성전자 뉴스룸 배포본)도 그대로 한 장의 대표 이미지로 사용됩니다.

---

## 1. 원본 파일 넣는 위치

아래 **원본 전용 디렉터리**에 원본 이미지를 그대로 넣어주세요. (처리 스크립트는 이 디렉터리의 원본을 **절대 수정·삭제하지 않습니다.**)

```text
front/assets-source/official-renders/originals/
```

지원 확장자: `.png`, `.jpg`, `.jpeg`, `.webp`

---

## 2. 파일 이름(또는 폴더) 규칙

**국내 모델번호**와 **정확한 DB 색상명**을 조합하면 자동으로 매핑됩니다.  
아래 두 가지 방식 중 편한 방식을 사용할 수 있습니다.

### 방식 A: 단일 폴더에 넣기 (`<모델번호>__<색상명>.<확장자>`)

- 예시:
  - `SM-S928N__티타늄-그레이.png`
  - `SM-S928N__티타늄-블랙.jpg`
  - `A3296__데저트-티타늄.png`
  - `A3102__블루-티타늄.webp`

### 방식 B: 모델번호별 하위 폴더에 넣기 (`<모델번호>/<색상명>.<확장자>`)

- 예시:
  - `SM-S928N/티타늄-그레이.png`
  - `SM-S928N/티타늄-블랙.png`
  - `A3296/데저트-티타늄.png`

> 주의: 색상명의 하이픈(`-`)이나 띄어쓰기는 자동 정규화되므로 `티타늄-그레이` 또는 `티타늄 그레이` 모두 동일하게 매칭됩니다. 단, 다른 색상 이미지는 임의로 대체 표시되지 않습니다.

---

## 3. 자동 검증 및 중복 파일 격리 규칙

1. **DB 자동 검증**:
   - 파일명의 모델번호가 DB 등록 모델과 일치하는지 확인합니다.
   - 색상명이 해당 모델의 DB 등록 색상명과 일치하는지 확인합니다.
   - 일치하지 않는 파일은 등록되지 않고 `processing-report.json`의 `manualReview`로 분류됩니다.
2. **중복/충돌 방지**:
   - 동일 모델·색상에 여러 개의 파일이 존재할 경우, 최신 수정일의 파일을 대표 이미지로 선택합니다.
   - 이전/중복 파일은 덮어쓰지 않고 `manualReview`에 안전하게 격리 보존됩니다.
3. **단일 대표 이미지 렌더링**:
   - 비교 화면(/compare) 상단 세로형 비주얼 스테이지(높이 280px)에 대표 이미지 1장을 정중앙에 선명하게 표시합니다.
   - 사용자가 색상 옵션을 변경하면 즉시 해당 색상의 공식 렌더로 전환됩니다.
   - 공식 렌더가 확보되지 않은 모델/색상은 깔끔한 SVG 플레이스홀더를 표시합니다.

---

## 4. (선택) 출처·라이선스·배경제거 예외 메타데이터 등록

`front/assets-source/official-renders/metadata.json` 파일을 만들어 파일별 출처 및 옵션을 지정할 수 있습니다.

```json
{
  "A3296__데저트-티타늄.png": {
    "sourceName": "Apple 코리아 공식 미디어 자산",
    "sourceUrl": "https://www.apple.com/kr/...",
    "licenseNote": "공식 보도·제조사 허가 확인 완료",
    "allowBgRemoval": true
  }
}
```

- 이미 투명한 PNG는 자동으로 알파 채널을 보존하며 배경 제거를 건너뜁니다.
- 배경이 흰색/밝은 단색 스튜디오 배경이 아니거나 테두리 손상 위험이 감지되면, 제품을 훼손하지 않고 원본을 유지한 뒤 `processing-report.json`의 `manualReview` 항목으로 분류합니다.

---

## 5. 처리 실행 방법

`front/` 폴더에서 아래 명령을 실행합니다.

```bash
cd front
npm run images:process
```

실행 결과:
1. 서비스용 최적화 이미지(투명 WebP/PNG)가 `front/public/images/official/optimized/`에 별도 생성됩니다.
2. 매핑 레지스트리 `front/src/data/user-official-renders.json`이 자동 갱신됩니다(실제 디스크에 존재하는 파일만 등록해 404 오류를 예방합니다).
3. 상세 처리 결과 및 수동 검수 목록은 `front/assets-source/official-renders/processing-report.json`에서 확인할 수 있습니다.

---

## 6. 현재 지원 스마트폰 모델번호 · DB 색상 기준표

| 제조사 | 모델명 | 모델번호 (`domestic_model_number`) | DB 지원 색상 | DB 용량 옵션 |
| :--- | :--- | :--- | :--- | :--- |
| Samsung | Galaxy S24 Ultra | `SM-S928N` | `티타늄 그레이`, `티타늄 블랙` | 256GB / 512GB |
| Samsung | Galaxy S24+ | `SM-S926N` | `코발트 바이올렛`, `오닉스 블랙` | 256GB / 512GB |
| Samsung | Galaxy S24 | `SM-S921N` | `앰버 옐로우`, `마블 그레이` | 256GB / 512GB |
| Samsung | Galaxy S24 FE | `SM-S721N` | `그라파이트` | 256GB |
| Samsung | Galaxy Z Fold6 | `SM-F956N` | `실버 쉐도우`, `네이비` *(기본 공식 렌더 보유)* | 256GB / 512GB |
| Samsung | Galaxy Z Flip6 | `SM-F741N` | `블루`, `민트` *(기본 공식 렌더 보유)* | 256GB / 512GB |
| Samsung | Galaxy A35 5G | `SM-A356N` | `어썸 아이스블루` *(기본 공식 렌더 보유)* | 128GB |
| Samsung | Galaxy S23 Ultra | `SM-S918N` | `그린`, `팬텀 블랙` *(기본 공식 렌더 보유)* | 256GB / 512GB |
| Apple | iPhone 16 Pro Max | `A3296` | `데저트 티타늄` | 256GB / 512GB |
| Apple | iPhone 16 Pro | `A3293` | `내추럴 티타늄` | 128GB / 256GB |
| Apple | iPhone 16 Plus | `A3290` | `울트라마린` | 128GB / 256GB |
| Apple | iPhone 16 | `A3287` | `울트라마린` | 128GB / 256GB |
| Apple | iPhone 15 Pro Max | `A3106` | `내추럴 티타늄` | 256GB / 512GB |
| Apple | iPhone 15 Pro | `A3102` | `블루 티타늄` | 128GB / 256GB |
| Apple | iPhone 15 Plus | `A3094` | `블랙` | 128GB |
| Apple | iPhone 15 | `A3090` | `핑크` | 128GB / 256GB |

*(향후 태블릿·스마트워치 공식 렌더 추가 시에도 `SM-X820__그레이.png` / `A2925__실버.png` 등 동일 모델번호 규칙으로 `metadata.json`에 `"category": "tablet"` 또는 `"smartwatch"`와 함께 등록할 수 있습니다.)*
