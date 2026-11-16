# 7-7 공개 스마트폰 성능 자료 점검

개발 MySQL을 읽기 전용으로 조사했다. 공개 모델 44개, SKU 310개, 칩셋 표기 24종, 가격 관측 93건, DB의 검증 완료 실측 0건이다. 기존 가격 정책·카탈로그 필터·로컬 랭커로 검증한 추천 범위는 28모델·64구성·163 SKU다. 성능 자료는 DB에 적재하지 않았다.

## 자료 확보 상태

| 제조사 | 공개 모델 | 배터리 원본·국내 모델 일치 | 원본 모델번호 불일치 | 공개 피드에서 적격 시험지 미발견 |
| --- | ---: | ---: | ---: | ---: |
| Apple | 15 | 13 | 0 | 2 |
| 삼성 | 29 | 0 | 18 | 11 |
| 전체 | 44 | 13 | 18 | 13 |

배터리는 전 모델을 [FixIndex 공개 피드](https://fixindex.eu/data/)에 대조했다. 링크가 있는 31건은 EPREL 원본 PDF의 모델 식별자와 ENDdevice 정수 시간 값으로 검증했다. FixIndex.eu CC BY 4.0과 EPREL, European Commission을 출처로 표시한다.

CPU·GPU는 24개 고유 칩셋 표기를 조사 대상으로 확인했으나, 자동 이용 가능한 공급 경로가 없어 24개 그룹의 개별 실측 검증은 보류했다. 게임·카메라도 공급 경로 수준까지만 확인해 44모델의 개별 실측은 미조사 상태다. 네 분야에서 채택한 실측은 각각 0건이다. 아래 표의 상태는 배터리에 한한다.

| 모델 | 국내 모델번호 | DB 칩셋 | 배터리 결과 | 가격 기반 평가 | Gemini 채택 |
| --- | --- | --- | --- | --- | --- |
| iPhone 16 Pro Max | A3296 | Apple A18 Pro (6코어 CPU, 6코어 GPU, 16코어 Neural Engine) | [일치 · 48시간](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2251149_EN.pdf) | 포함 | 미채택 |
| iPhone 16 Pro | A3293 | Apple A18 Pro (6코어 CPU, 6코어 GPU, 16코어 Neural Engine) | [일치 · 37시간](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2251148_EN.pdf) | 포함 | 미채택 |
| iPhone 16 Plus | A3290 | Apple A18 (6코어 CPU, 5코어 GPU, 16코어 Neural Engine) | [일치 · 48시간](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2251147_EN.pdf) | 포함 | 미채택 |
| iPhone 16 | A3287 | Apple A18 (6코어 CPU, 5코어 GPU, 16코어 Neural Engine) | [일치 · 37시간](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2251146_EN.pdf) | 포함 | 채택 |
| iPhone 15 Plus | A3094 | Apple A16 Bionic (6코어 CPU, 5코어 GPU) | [일치 · 45시간](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2251145_EN.pdf) | 제외 | 미채택 |
| iPhone 15 Pro Max | A3106 | Apple A17 Pro (6코어 CPU, 6코어 GPU, 16코어 Neural Engine) | 피드 항목 미확보 | 제외 | 미채택 |
| iPhone 15 Pro | A3102 | Apple A17 Pro (6코어 CPU, 6코어 GPU, 16코어 Neural Engine) | 피드 항목 미확보 | 제외 | 미채택 |
| iPhone 15 | A3090 | Apple A16 Bionic (6코어 CPU, 5코어 GPU, 16코어 Neural Engine) | [일치 · 34시간](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2247679_EN.pdf) | 제외 | 미채택 |
| Galaxy S24 FE | SM-S721N | Samsung Exynos 2400e (데카코어) | [불일치 · SM-S721B/DS](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2284557_EN.pdf) | 포함 | 미채택 |
| Galaxy Z Fold6 | SM-F956N | Snapdragon 8 Gen 3 for Galaxy (옥타코어) | 피드 항목 미확보 | 포함 | 미채택 |
| Galaxy Z Flip6 | SM-F741N | Snapdragon 8 Gen 3 for Galaxy (옥타코어) | 피드 항목 미확보 | 포함 | 미채택 |
| Galaxy A35 5G | SM-A356N | Samsung Exynos 1380 (옥타코어) | 피드 항목 미확보 | 제외 | 미채택 |
| Galaxy S24 Ultra | SM-S928N | Snapdragon 8 Gen 3 for Galaxy (옥타코어) | 피드 항목 미확보 | 포함 | 미채택 |
| Galaxy S24+ | SM-S926N | Samsung Exynos 2400 (데카코어) | 피드 항목 미확보 | 포함 | 미채택 |
| Galaxy S24 | SM-S921N | Samsung Exynos 2400 (데카코어) | 피드 항목 미확보 | 포함 | 미채택 |
| Galaxy S23 Ultra | SM-S918N | Snapdragon 8 Gen 2 for Galaxy (옥타코어) | 피드 항목 미확보 | 제외 | 미채택 |
| Galaxy A25 5G | SM-A256N | Samsung Exynos 1280 (옥타코어) | 피드 항목 미확보 | 제외 | 미채택 |
| Galaxy A15 LTE | SM-A155N | MediaTek Helio G99 (옥타코어) | 피드 항목 미확보 | 포함 | 미채택 |
| Galaxy A16 LTE | SM-A165N | MediaTek Helio G99 (옥타코어) | 피드 항목 미확보 | 포함 | 미채택 |
| Galaxy S25 | SM-S931N | Snapdragon 8 Elite for Galaxy | [불일치 · SM-S931B/DS](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2339790_EN.pdf) | 포함 | 미채택 |
| Galaxy S25+ | SM-S936N | Snapdragon 8 Elite for Galaxy | [불일치 · SM-S936B/DS](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2339793_EN.pdf) | 포함 | 미채택 |
| Galaxy S25 Ultra | SM-S938N | Snapdragon 8 Elite for Galaxy | [불일치 · SM-S938B/DS](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2339789_EN.pdf) | 포함 | 미채택 |
| Galaxy S25 Edge | SM-S937N | Snapdragon 8 Elite for Galaxy | [불일치 · SM-S937B/DS](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2284553_EN.pdf) | 포함 | 미채택 |
| Galaxy S25 FE | SM-S731N | Samsung Exynos 2400e (10코어) | [불일치 · SM-S731B/DS](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2409885_EN.pdf) | 포함 | 미채택 |
| Galaxy Z Fold7 | SM-F966N | Snapdragon 8 Elite for Galaxy | [불일치 · SM-F966B/DS](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2284559_EN.pdf) | 포함 | 미채택 |
| Galaxy Z Flip7 | SM-F766N | Exynos 2500 | [불일치 · SM-F766B](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2284558_EN.pdf) | 포함 | 미채택 |
| Galaxy Z Flip7 FE | SM-F761N | Exynos 2400 | [불일치 · SM-F761B](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2284542_EN.pdf) | 포함 | 미채택 |
| Galaxy A36 5G | SM-A366N | Snapdragon 6 Gen 3 (옥타코어) | [불일치 · SM-A366B/DS](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2301641_EN.pdf) | 제외 | 미채택 |
| Galaxy A17 LTE | SM-A175N | MediaTek Helio G99 (옥타코어) | 피드 항목 미확보 | 포함 | 미채택 |
| Galaxy S26 | SM-S942N | Exynos 2600 | [불일치 · SM-S942B/DS](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2523577_EN.pdf) | 제외 | 미채택 |
| Galaxy S26+ | SM-S947N | Exynos 2600 | [불일치 · SM-S947B/DS](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2532406_EN.pdf) | 제외 | 미채택 |
| Galaxy S26 Ultra | SM-S948N | Snapdragon 8 Elite Gen 5 for Galaxy | [불일치 · SM-S948B/DS](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2488593_EN.pdf) | 제외 | 미채택 |
| Galaxy S26 FE | SM-S741N | Exynos 2500 | [불일치 · SM-S741B/DS](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2707876_EN.pdf) | 제외 | 미채택 |
| Galaxy A37 5G | SM-A376N | Samsung Exynos 1480 (4nm) | [불일치 · SM-A376B/DS](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2533371_EN.pdf) | 제외 | 미채택 |
| Galaxy Z Fold8 Ultra | SM-F976N | Snapdragon 8 Elite Gen 5 for Galaxy | [불일치 · SM-F976B](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2600776_EN.pdf) | 포함 | 미채택 |
| Galaxy Z Fold8 | SM-F971N | Snapdragon 8 Elite Gen 5 for Galaxy | [불일치 · SM-F971B](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2600778_EN.pdf) | 제외 | 미채택 |
| Galaxy Z Flip8 | SM-F776N | Exynos 2600 | [불일치 · SM-F776B](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2610204_EN.pdf) | 포함 | 미채택 |
| iPhone 16e | A3409 | Apple A18 | [일치 · 41시간](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2261239_EN.pdf) | 포함 | 채택 |
| iPhone 17 | A3520 | Apple A19 | [일치 · 41시간](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2402623_EN.pdf) | 제외 | 미채택 |
| iPhone Air | A3517 | Apple A19 Pro | [일치 · 40시간](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2402612_EN.pdf) | 포함 | 미채택 |
| iPhone 17e | A3634 | Apple A19 | [일치 · 45시간](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2556297_EN.pdf) | 제외 | 미채택 |
| iPhone 18 Pro | A3714 | Apple A20 Pro | [일치 · 52시간](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2774822_EN.pdf) | 포함 | 미채택 |
| iPhone 18 Pro Max | A3717 | Apple A20 Pro | [일치 · 62시간](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2774823_EN.pdf) | 포함 | 미채택 |
| iPhone Duo | A3720 | Apple A20 Pro | [일치 · 51시간](https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_2774825_EN.pdf) | 포함 | 미채택 |

## 공급처 검토

- [Geekbench Browser API](https://www.geekbench.com/api/api.html)는 CPU·GPU 프로그램 조회를 지원하며 Bearer 인증이 필요하다. 인증과 이용 범위가 확인된 연동이 필요하다.
- [UL 3DMark](https://support.benchmarks.ul.com/support/solutions/articles/44002132667)는 실제 그래픽·지속 시험을 제공한다. 프로그램에서 스마트폰 배포 결과를 자동 취득해 로컬 점수로 사용할 경로는 확보하지 못했다.
- [Notebookcheck](https://www.notebookcheck.net/Contact.270.0.html)는 콘텐츠 복사에 명시적 허용을 요구한다. [GSMArena](https://www.gsmarena.com/privacy-policy.php3)의 제품별 실측도 공식 자동 재사용 경로를 확인하지 못했다.
- [DXOMARK](https://www.dxomark.com/terms-and-conditions/)의 제한적 발췌 규정에는 수치 변형 제한이 있다. 랭커에서 정규화할 근거로 채택하지 않았다.
- [InnoReviews](https://innoreviews.com/methodology)의 공개 다운로드는 자체 종합·하위 점수를 제공한다. 제3자 원본 벤치마크 수치는 라이선스와 다운로드에서 제외된다. 제조사 사양은 제품과 칩셋 식별에 참고한다.
- [NPU Bench Swarm](https://zenodo.org/records/21602991)의 공개 연구 데이터는 이 카탈로그에 없는 Poco X6 Pro의 추론 지연 자료다. 일반 CPU·GPU·게임 점수로 대체하지 않았다.

## 실제 가격 기반 로컬 평가

아래 결과는 가상 선호와 실개발 카탈로그를 기존 서버 랭커에 전달해 평가한 값이다. 실제 계정 요청과 이력 저장은 실행하지 않았다. 열 개 시나리오에 28모델 전체가 한 번 이상 포함됐다. 의도에 맞춰 외부 근거를 요청하며 이번 실측은 배터리 우선 및 배터리 우선·예산 무제한 시나리오에만 반영했다. 상위 세 모델은 모든 시나리오에서 서로 다르며 실측 반영 전후 동일했다.

| 시나리오 | 평가 모델 / 구성 / SKU | 상위 세 모델 |
| --- | --- | --- |
| 가성비 | 16 / 22 / 62 | Galaxy A15 LTE → Galaxy A17 LTE → Galaxy A16 LTE |
| 최고 성능 | 27 / 56 / 142 | Galaxy S24+ → Galaxy S25 Ultra → Galaxy S25 FE |
| 게임 | 5 / 5 / 13 | Galaxy S25 FE → Galaxy A15 LTE → Galaxy A17 LTE |
| 카메라 | 16 / 22 / 62 | Galaxy S25 FE → Galaxy A15 LTE → Galaxy S24+ |
| 배터리 | 27 / 50 / 128 | Galaxy S25 FE → Galaxy S24+ → Galaxy A17 LTE |
| 휴대성 | 16 / 22 / 62 | Galaxy S25 → Galaxy S24 → Galaxy A15 LTE |
| 업무 | 21 / 32 / 85 | Galaxy S25 FE → Galaxy S24+ → Galaxy S25+ |
| 일반 | 5 / 5 / 13 | Galaxy A15 LTE → Galaxy A17 LTE → Galaxy A16 LTE |
| 무제한 | 28 / 64 / 163 | Galaxy S25 FE → Galaxy S24+ → Galaxy S25+ |
| 256GB 이상 | 12 / 17 / 51 | Galaxy S25 FE → Galaxy S24+ → Galaxy S25+ |

실제 Gemini가 채택한 iPhone 16·16e를 사용하면 두 모델의 점수가 변했고 순위는 유지됐다. 공개 PDF로 직접 검증한 자료를 모두 넣은 별도 읽기 전용 평가에서는 9모델의 점수가 바뀌었다. 예산 무제한의 iPhone 18 Pro Max는 11위에서 8위, 배터리 250만원에서는 13위에서 10위로 이동했다. 실측이 없는 삼성 모델의 점수는 그대로였으며 상대 순위는 변할 수 있다.

8개 URL씩 진행한 Gemini 배치는 3회 시간 초과와 공급자 오류 1회였다. 3개 URL로 제한한 일반 서비스 호출은 3건 모두 원문 조회에 성공했고, iPhone 16(37시간)·16e(41시간)를 채택했다. Galaxy S25는 모델번호 불일치로 제외했다. 나머지 시험지는 원본 PDF로 독립 확인했다.

배터리 불편을 부여한 합성 조건에서 실제 카탈로그와 Gemini 실측을 사용해 iPhone 16 → iPhone 16e 교체 판단 DEFER → REPLACE를 확인했다. 칩셋만으로 기기의 지속 성능 개선을 확정하지 않는 분기는 합성 테스트로 검증했다.

100만원 게임 후보는 5모델에 그쳤다. A15 LTE가 2위였으나 동일 시험 CPU·GPU·게임 증거가 없으므로 게임 성능으로 해석할 수 없다. 저장 용량 조건·예산·가격 링크는 기존 정책을 적용했다.
