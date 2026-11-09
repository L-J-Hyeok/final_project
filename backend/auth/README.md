# 백엔드 인증

`npm start`로 실행한다. 기존 8개 테이블을 사용하며 새 마이그레이션은 없다.

- `GET /api/auth/csrf`: 익명 세션과 `data.csrf_token` 발급.
- `POST /api/auth/register`: `{email,password}` → 201. 빈 profiles 행만 함께 생성하며 자동 로그인하지 않음.
- `POST /api/auth/login`: `{email,password}` → `data.user`, 새 `data.csrf_token`.
- `GET /api/auth/me`: 현재 사용자, 비로그인은 401.
- `POST /api/auth/logout`: `{}` → 204, 세션 삭제·쿠키 만료.

변경 요청은 `Content-Type: application/json`, `Origin`(APP_ORIGIN과 일치), `X-CSRF-Token`과 sid 쿠키가 필요하다. 로그인 후에는 새 CSRF 토큰을 사용한다. 오류는 JSON이며 API 로그에 URL·본문·세션을 기록하지 않는다.

## 환경

backend/.env 또는 실행 환경에서 `SESSION_SECRET`(무작위 32바이트 이상), `APP_ORIGIN`을 설정한다. 실제 값은 소스/문서에 기록하지 않는다. 로컬 환경에는 초기 무작위 secret을 생성했으며 재시작 때 재생성하지 않는다. secret 변경 시 기존 쿠키는 무효화된다.

`APP_ORIGIN` 기본값은 개발용 `http://localhost:3000`. Vue를 프록시로 연결할 때는 실제 브라우저 origin으로 변경한다. 개발 HTTP는 localhost/loopback에만 허용한다. 운영은 `NODE_ENV=production`을 실행 환경에 설정하고 HTTPS APP_ORIGIN을 명시한다. 운영 Secure 쿠키는 HTTPS를 필요로 한다. 로컬 역방향 프록시를 신뢰하도록 구성한 경우에만 `TRUST_PROXY_LOOPBACK=true`를 설정한다. 기본값은 프록시 헤더를 신뢰하지 않는다. 임의 프록시/다중 서버 배포는 별도 검증 대상이다.

## 보안과 제한

비동기 scrypt N=131072/r=8/p=1, salt 16바이트·키 64바이트, 동시 2개. 비밀번호 12~128 Unicode 코드포인트/512 UTF-8 바이트, trim하지 않는다.

sid 원문 대신 SHA-256 BINARY(32)를 저장한다. 세션 유휴 30분/절대 24시간, 쿠키 HttpOnly·SameSite=Lax·Path=/·Domain 없음. 만료는 DB와 세션 시간 모두 검사한다. 기존 세션 저장은 UPDATE만 허용하여 로그아웃 후 지연 저장으로 재생성되지 않는다. 만료된 행은 인증에 사용할 수 없으며 주기적 정리는 이번 구현에 포함하지 않는다.

단일 프로세스 메모리에서 로그인 실패/진행 중 요청 계정+IP당 15분 5회, IP당 30회, 가입 시도 IP당 시간 5회. 인증 경로 전체 IP당 분 120회·제한 키 최대 10,000개. 프로세스 재시작 시 제한 카운터가 초기화되므로 다중 인스턴스/공개 배포 전에 공유 제한 저장소를 검토한다. 회원가입은 계약상 409 충돌을 반환하므로 중복 여부를 완전히 숨기는 API는 아니다. 로그인 오류는 계정 없음/잘못된 비밀번호를 구분하지 않는다.

## 테스트

- `npm run test:db`: 기존 8개 단위 테스트.
- `npm run test:auth`: scrypt/설정/기한 단위 및 실제 MySQL+HTTP 테스트. **로컬 final_project 개발 DB에 접속한다.** 무작위 시험 이메일과 쿠키로 식별한 행만 정리하며 기존 데이터는 삭제하지 않는다. 시험 중 생성한 AUTO_INCREMENT 간격은 복구하지 않는다.

운영 HTTPS/프록시, 브라우저/Vue 연동, 메일 인증·비밀번호 복구는 별도 검증/구현 대상이다.
