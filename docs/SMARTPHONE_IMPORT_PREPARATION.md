# 스마트폰 NULL·링크·적재 준비 계약

작성: 2026-11-11 09:27:27 KST. **설계/오프라인 준비 완료, 런타임 구현·MySQL 적용 미완료**. 현재 Phase1 스마트폰만 대상. A/B/C 재분류는 [재분류 보고서](SMARTPHONE_VALIDATION_RECLASSIFICATION.md), 기존 DB 확장은 [설계안](SMARTPHONE_DB_EXTENSION_DESIGN.md)을 따른다. 이번 요청의 A 기준은 OS **계열**이며 버전·모든 선택 사양을 강제하지 않는다. 기존9개 우선모델/2변형/출고가35구성·연결2를 파일과 대조해 유지했다.

## NULL 및 출처 계약

| 값/상태 | 저장·매핑 | 화면 표시/추천 |
|---|---|---|
| RAM/배터리/카메라/무선충전/출력 미확인 | null 또는 필드별 pending. 0/false/빈 문자열로 대체 금지 | 숫자는 ‘정보 없음’, 불리언도 ‘정보 없음’. ‘미지원’ 아님 |
| 실제 미지원이 근거로 확인됨 | boolean false + 필드별 출처 | ‘미지원’. true는 ‘지원’ |
| 공식 출고가 미확인 | launch_price_krw=null. 현행에는 해당컬럼 없으므로 외부 근거 유지 | ‘출고가 정보 없음’ |
| 현재 유효 판매가 없음 | price_observations 새 행 생성 안 함. API price=null | ‘현재 판매가 정보 없음’. 구매 가능한 추천후보 제외 |
| 기존 검증값 + 신규 조사 null | 기존값 유지, null 덮어쓰기 없음 | 과거의 검증값을 unknown으로 낮추지 않음 |
| 기존값과 다른 새 값 | 자동 덮어쓰기 금지, 충돌·검수 대상으로 분리 | 기존값 공개 유지, 승인 전 새 값 비공개 |

세부 근거는 review_metadata_json.fields의 값 경로별 status/source_refs로 연결한다. source_kind는 manufacturer_kr / manufacturer_global_supplement / official_carrier / secondary_verified를 구분한다. 보조 출처는 실제 측정 대상의 한국 모델·옵션·시점·측정방법을 확인하고 관리자 검수 후 해당 필드에만 사용할 수 있다. 공식 미공개 RAM을 추측하거나 글로벌 SKU에서 복사하지 않는다. 보조 출처를 공식 출고가 근거로 승격하지 않는다. 출처 URL만 있다는 사실이 검수/재사용 권한 확보를 뜻하지 않는다.

API 숫자 변환 전에 null/undefined를 분기하고 불리언을 strict 검사한다. `Number(null)`, `Boolean(null)`, `value || 0` 같은 변환을 쓰지 않는다. undefined 입력은 기존값 유지, 명시적 null은 이 적재 계획에서 기존 검증값을 지우지 않는 의미다. 제품 입력과 사용자 프로필 삭제 의미를 혼용하지 않는다. NULL RAM 인덱스용0은 내부 생성키일 뿐 API·비교·AI에 절대 사양값으로 전달하지 않는다.

## 링크 역할과 최소 저장 방법

새로운 링크 테이블/컬럼을 추가하지 않는다. smartphones.official_product_url은 공식 소개 URL 1개이고, 나머지는 제안된 review_metadata_json.links의 역할별 근거 객체로 관리한다. 기존 source_url은 대표 검증 근거로 유지한다.

| 역할 | 저장 제안 | 공개 조건 |
|---|---|---|
| 공식 소개 | official_product_url + metadata.links.product_info | 정확한 국내 모델과 일치하는 링크 검수 |
| 공식 상세 사양 | metadata.links.specifications | 해당 모델/지역의 실제 사양 페이지임을 확인 |
| 제조사 공식 구매 | metadata.links.manufacturer_purchase | 해당 모델/옵션에 연결. 재고/판매 여부와 링크 검증은 별도 |
| 판매처 실제 구매 | 기존 price_observations.source_url | 검증된 해당 변형 관측의 URL. 현재 가격 적격 조건 통과 시 구매 버튼 |
| 사양 검증 출처 | review_metadata_json.sources/fields + 기존 source_url | 필드별 출처 종류와 확인시각 표시; 보도자료를 구매 URL로 사용하지 않음 |

링크 객체는 `url, purpose, source_kind, domestic_model_number, variant_scope, target_verified_at, review_status, availability, checked_at`을 포함하는 제안이다. variant_scope는 실제 확인된 용량/RAM/색상 또는 모델 단위. availability는 unknown/available/unavailable이고 **링크가 정상이라고 available로 설정하지 않는다**. 모델 소개·사양 페이지는 구매 가능성 표시가 필요 없다. 구매 경로가 판매종료면 ‘판매 종료’, 확인하지 않았으면 ‘제조사 판매 여부 확인’으로 표시하고 즉시 구매 가능 배지/가격을 만들지 않는다. 필요하면 정보성 외부 링크로만 제공한다.

- 현재 후보 JSON은 모델 소개/사양/제조사 구매 링크를 null로 유지하고, 검증 출처만 source_refs에 담았다. 링크 역할별 승인과 공개 응답은 후속 작업이다. URL을 slug/모델번호 조합으로 생성하지 않았다.
- URL은 HTTPS·2048자 이내·정확한 승인 호스트만. scheme-relative/http/javascript/data/file, 사용자정보, 제어문자(인코딩 포함), 비표준 포트, localhost/원시 IP/유사 도메인 거절. 공식 사이트 목록은 실제 검증된 호스트를 명시적으로 관리하며 판매처는 별도 승인 목록이다.
- 이번 safeUrl은 오프라인 구문/호스트 검사일 뿐 링크 생존성·정확한 모델 대응·DNS/리디렉션·재고 확인이 아니다. 링크 검수는 별도 근거로 한다. 향후 서버가 URL을 가져올 경우 사설/루프백 IPv4·IPv6와 리디렉션 매 홉을 검증하고 타임아웃/본문 크기를 제한한다. 이번 서버 다운로드 없음.
- 새 탭은 `target="_blank" rel="noopener noreferrer"`, 접근 가능한 ‘새 탭에서 열림’ 안내. URL을 HTML로 삽입하거나 사용자/AI가 제공한 임의 URL을 구매 버튼으로 렌더하지 않는다. 기존 세션·비밀정보를 URL에 붙이지 않는다.

## API 응답·화면 연결 — 제안, 기존 API 미변경

기존 GET /api/smartphones 및 /api/smartphones/:variantId의 기존 키와 price(현재가)를 유지하고, 다음 **추가 키**를 후속 구현 시 명시적으로 매핑한다. 신규metadata 전체를 응답/AI에 통째로 전달하지 않는다. API serializer가 approved 또는 기존 legacy 공개범위와 필드별 상태를 확인한다. 기존 SQL SELECT/Sequelize 모델은 아직 새 컬럼을 읽거나 쓰지 않는다.

```json
{
  "ram_gb": null,
  "battery_mah": null,
  "wireless_charging": null,
  "price": null,
  "launch_price": null,
  "links": {
    "product_info": null,
    "specifications": null,
    "manufacturer_purchase": null,
    "seller_purchase": null
  },
  "spec_verification": {
    "ram_gb": {"status": "unknown", "source_kind": null},
    "wireless_charging": {"status": "unknown", "source_kind": null}
  },
  "price_comparison": null
}
```

이것은 미확인 필드의 계약 예시이며 실제 응답/적재 데이터가 아니다. 승인 출고가가 있으면 launch_price는 `amount_krw, currency, applicable_variant_id, sources, checked_at`을 갖는다. 링크 객체는 공개용 `url, label, availability, checked_at`만 보낸다. price는 기존 `amount_krw, shipping_krw, total_krw, source_url, seller_name, observed_at, expires_at, eligible` 계약을 유지한다.

할인 비교는 같은 한국 변형의 승인 출고가 L>0과 **유효하고 구매조건을 충족한 현재가**가 모두 있을 때만 한다. 배송비 포함 총구매비 T를 기본 기준으로 `차액=L−T`, `차이율=(L−T)/L×100`(화면 소수1자리)을 표시하고 ‘배송비 포함, 공식 출고가 대비’로 표기한다. L은 역사적 출시가라 판매가 TTL을 적용하지 않지만 검증 승인/출처가 철회되면 계산 중단. 현재가는 기존 TTL/재고/신품/자급제/무조건구매/배송비 검사 적용. 구매조건·옵션 불일치나 null이면 비교도 null. T>L이면 음의 할인율을 할인으로 광고하지 않고 ‘출고가보다 ○원 높음’으로 표시한다. 순수 상품가격 기준을 별도 제공할 경우 배송비 제외라고 명시한다. 높은 할인율을 성능·가성비 점수나 추천 우선순위로 자동 사용하지 않는다.

- 제품 상세: 사양/출고가/현재가/근거/링크를 구분.
- /compare: 같은 필드 정의로 정보 없음·차이만 표시; null은 0으로 비교하지 않으며 양쪽 unknown을 성능 동률로 표시하지 않음.
- Gemini 결과: 기존 내부 DB 승인 후보만 사용. 사양 null은 모름으로 전달, 링크는 AI 생성이 아니라 서버의 검증 링크로 매핑. 가격 없는 제품을 구매 추천으로 승인하지 않음.
- 보유/업그레이드: 공식 출시일 기반 연령 판정과 가격을 분리. 보유 기기 누락 사양은 정보 없음. 현 기기 유지와 가격 없는 객관적 비교는 가능하되 신규 구매 추천은 현재가 적격성 필요.

## SQL 준비 및 적용 전 경계

`backend/db/migration-drafts/002-smartphone-details.draft.sql`은 두 테이블의 nullable 상세/공식URL·출고가·검수metadata, legacy→신규pending 기본값, JSON OBJECT/CHECK, RAM 생성키/새UNIQUE를 추가한다. 기존 유일키는 유지한다. `003-smartphone-ram-key.draft.sql`은 별도 게이트 후 이전 UNIQUE 인덱스만 제거한다. 신규테이블0, 기존 가격관측·PK·FK·ID·verified·핵심값 수정 없음. 두 파일은 기존 db/migrate.js의 초기 스키마 경로에 연결하지 않았다.

주의: 기존 migrate.js는 **빈 DB 전용**이며 이 확장 SQL 실행 도구가 아니다. STORED 추가의 재구성/잠금 시간, 실제 collation 충돌, CHECK와 기존 데이터 적합성, DDL 자동커밋/부분실패는 테스트 MySQL에서 검증 전이다. SQL은 자동 재실행/rollback용이 아니며 적용이 중단되면 SHOW CREATE/인덱스/기록으로 완료 단계를 확인한다. DROP TABLE/초기화로 복구하지 않는다.

review_status=legacy는 기존 검증 이력 보존이고 새 승인 아님. 신규 pending 기본값과 CHECK 때문에 review_status 없이 verified=true를 쓰는 기존 입력기는 호환되지 않을 수 있다. 따라서 **기존 seed를 수정 없이 확장 데이터에 재사용하지 않는다**. 승인 입력기/Sequelize 쓰기 목록 및 공개 정책을 준비한 후에만 SQL 적용을 승인한다. legacy 기본값→pending 전환 사이에는 제품 쓰기 경로를 정지한다. JSON OBJECT CHECK는 reviewer/권리/상태/URL 같은 내부 필드 검증을 대체하지 못한다.

## 신규 적재 계획 도구 — 쓰기 실행부 없음

- 파일: backend/scripts/prepare-smartphone-upsert.js, 후보: backend/data/smartphone-import-candidates-2026-11-11.json.
- 기본은 파일 기반 OFFLINE_DRY_RUN. 인수는 --dry-run/--extended만 허용하고 **--apply는 I/O 이전 거절**. DB 연결 모듈/.env/ORM import 없음. INSERT/UPDATE/DELETE 실행 기능 없음. 실제 Upsert 실행부는 별도 승인 후 추가해야 하므로 ‘운영 적재기 완성’이라고 표시하지 않는다.
- 원본3개 SHA-256·근거·명시적2구성 검증 후 기존 verified_ready16/29만 기준 재고로 대조. 이전 baseline 보류10개는 운영DB 제품으로 오인하지 않는다.
- 결과: 현행/확장 모두 신규모델2/변형2, 충돌0, 변경 제안0, 가격관측0. 이 보고는 실제 DB 조회/PK 검증이 아니고 JSON에는 DB ID가 없으므로 ID를 만들어내지 않는다. 기존 행은 재실행 시 제공된 ID를 유지한다. 알 수 없는 실제 ID는 null로 보고한다.
- null 신규값은 기존값을 지우지 않는다. 기존 null 보완은 별도 승인 제안만 작성하고 기존 known 값 차이는 충돌 처리한다. unknown→known RAM은 동일 공식SKU 근거가 있을 때만 동일 ID 보완 제안, 그 외 보류. 입력기 구현 시 부모 모델행 잠금·한 트랜잭션·최종UNIQUE 검증은 별도 필요하다.
- 영문/한국어 색상 별칭 또는 unspecified의 모호한 매칭은 보류한다. 현재2개 신규모델에는 기존변형 매칭이 없으므로 충돌0이며, 일반적인 색상 사전은 이번에 만들지 않았다. JS 정규화는 MySQL collation의 완전한 대체가 아니다.
- 모델/변형 사실 verified와 운영 production_approved=false를 분리했다. 승인 안 된 후보 파일을 운영 테이블에 staging하지 않는다. 기존 member.js 및 일부 catalog 조회는 미검증행도 노출할 수 있어 verified=false만으로 격리가 안 된다.

## 실제 검증과 남은 승인

오프라인24테스트 통과: 원본 보존·중복/NULL RAM·동일ID 유지·조건부 RAM 보완 계획·색상모호성·출고가/판매가 분리·null/false·URL·hash변조·명시적SKU충돌·쓰기모드 차단. 기존 catalog/upgrade **순수 함수**의 가격없는 후보 제외·null 비교·출시경과 판정을 테스트했다. SQL 검증은 텍스트 구조 점검이며 MySQL 구문/DDL 실행시험이 아니다. 보유기기/회원/추천 HTTP·실제ID/FK 회귀는 미실행이다.

안전한 별도 테스트DB의 위치/접속/격리 근거가 제공되지 않았고 .env 접근도 금지되어 이번에는 어떠한 DB에도 연결하지 않았다. 실행 순서: 후보2개 및 자료 운영 승인 → 전용 테스트DB/백업·검증 계획 승인 → SQL·쓰기 실행부/ORM/공개 정책 구현 승인 → 실제ID/FK/기존값 재대조·회귀검증 → 별도 운영 적용/적재 승인. 현 단계에서 자동으로 다음 단계로 넘어가지 않는다.

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
