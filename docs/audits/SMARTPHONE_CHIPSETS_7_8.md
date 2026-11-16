# 7-8 공개 스마트폰 칩셋과 벤치마크 조사

개발 MySQL 읽기 전용 조회에서 공개 44모델·310 SKU와 원본 칩셋 표기 24종을 확인했다. 제품별 제조사 근거를 반영한 벤치마크 조회 키는 22개다. 가격 관측 93건과 검증 완료 실측 DB 0건을 확인했다. 가격 필터에 적격인 28모델·64개 용량/RAM 구성·163 SKU를 10개 시나리오에 포함했다.

## 24개 원본 표기

표의 링크는 CPU·GPU·3DMark·게임 자료를 찾기 위한 공개 결과 또는 리뷰 후보이다. 원본 전수 측정치 채택이나 국내 변형의 실측 확인을 뜻하지 않는다. 22개 키를 대상으로 공개 출처를 검색했다. 이번 단계에서 랭커 사용을 허용하고 제품 식별·시험 호환성까지 검증한 CPU 싱글/멀티코어, GPU, 3DMark, 실게임 FPS·지속성의 수는 각 0이다. 개별 시험의 데이터 부재 여부는 단정하지 않는다.

| DB 표기 | 참조 조회 키 | 공개 모델 | 공개 자료 후보 |
| --- | --- | --- | --- |
| Apple A18 Pro (6코어 CPU, 6코어 GPU, 16코어 Neural Engine) | apple a18 pro (6코어 cpu, 6코어 gpu, 16코어 neural engine) | iPhone 16 Pro Max, iPhone 16 Pro | [iPhone 16 Pro](https://nanoreview.net/en/phone/apple-iphone-16-pro) |
| Apple A18 (6코어 CPU, 5코어 GPU, 16코어 Neural Engine) | apple a18 (5-core gpu) | iPhone 16 Plus, iPhone 16 | [iPhone 16](https://benchmarks.ul.com/hardware/phone/Apple%2BiPhone%2B16%2Breview) |
| Apple A16 Bionic (6코어 CPU, 5코어 GPU) | apple a16 bionic | iPhone 15 Plus | [iPhone 15](https://benchmarks.ul.com/hardware/phone/Apple%2BiPhone%2B15%2Breview) |
| Apple A17 Pro (6코어 CPU, 6코어 GPU, 16코어 Neural Engine) | apple a17 pro (6-core gpu) | iPhone 15 Pro Max, iPhone 15 Pro | [iPhone 15 Pro](https://nanoreview.net/en/phone/apple-iphone-15-pro) |
| Apple A16 Bionic (6코어 CPU, 5코어 GPU, 16코어 Neural Engine) | apple a16 bionic | iPhone 15 | [iPhone 15](https://benchmarks.ul.com/hardware/phone/Apple%2BiPhone%2B15%2Breview) |
| Samsung Exynos 2400e (데카코어) | exynos 2400e | Galaxy S24 FE | [Galaxy S24 FE](https://www.techarp.com/mobile/samsung-galaxy-s24-fe-performance/) |
| Snapdragon 8 Gen 3 for Galaxy (옥타코어) | snapdragon 8 gen 3 for galaxy (옥타코어) | Galaxy Z Fold6, Galaxy Z Flip6, Galaxy S24 Ultra | [Galaxy S24 Ultra](https://benchmarks.ul.com/en/hardware/phone/Samsung%2BGalaxy%2BS24%2BUltra%2Breview) |
| Samsung Exynos 1380 (옥타코어) | samsung exynos 1380 (옥타코어) | Galaxy A35 5G | 제품·칩셋 인덱스 확인 |
| Samsung Exynos 2400 (데카코어) | exynos 2400 | Galaxy S24+, Galaxy S24 | [Galaxy S25 FE](https://www.tomsguide.com/phones/samsung-phones/samsung-galaxy-s25-fe-review) |
| Snapdragon 8 Gen 2 for Galaxy (옥타코어) | snapdragon 8 gen 2 for galaxy (옥타코어) | Galaxy S23 Ultra | [Galaxy S23 Ultra](https://benchmarks.ul.com/hardware/phone/Samsung%2BGalaxy%2BS23%2BUltra%2Breview) |
| Samsung Exynos 1280 (옥타코어) | samsung exynos 1280 (옥타코어) | Galaxy A25 5G | 제품·칩셋 인덱스 확인 |
| MediaTek Helio G99 (옥타코어) | mediatek helio g99 (옥타코어) | Galaxy A15 LTE, Galaxy A16 LTE, Galaxy A17 LTE | [Galaxy A15 LTE](https://benchmarks.ul.com/hardware/phone/Samsung%2BGalaxy%2BA15%2B5G%2Breview) |
| Snapdragon 8 Elite for Galaxy | snapdragon 8 elite for galaxy | Galaxy S25, Galaxy S25+, Galaxy S25 Ultra, Galaxy S25 Edge, Galaxy Z Fold7 | [Galaxy S25](https://benchmarks.ul.com/hardware/phone/Samsung%2BGalaxy%2BS25%2Breview) |
| Samsung Exynos 2400e (10코어) | exynos 2400 | Galaxy S25 FE | [Galaxy S25 FE](https://www.tomsguide.com/phones/samsung-phones/samsung-galaxy-s25-fe-review) |
| Exynos 2500 | exynos 2500 | Galaxy Z Flip7, Galaxy S26 FE | [Galaxy Z Flip7](https://benchmarks.ul.com/hardware/phone/Samsung%20Galaxy%20Z%20Flip7%20review) |
| Exynos 2400 | exynos 2400 | Galaxy Z Flip7 FE | [Galaxy S25 FE](https://www.tomsguide.com/phones/samsung-phones/samsung-galaxy-s25-fe-review) |
| Snapdragon 6 Gen 3 (옥타코어) | snapdragon 6 gen 3 (옥타코어) | Galaxy A36 5G | 제품·칩셋 인덱스 확인 |
| Exynos 2600 | exynos 2600 | Galaxy S26, Galaxy S26+, Galaxy Z Flip8 | [Galaxy S26](https://benchmarks.ul.com/hardware/phone/Samsung%2BGalaxy%2BS26%2B%28Exynos%2B2600%29%2Breview) |
| Snapdragon 8 Elite Gen 5 for Galaxy | snapdragon 8 elite gen 5 for galaxy | Galaxy S26 Ultra, Galaxy Z Fold8 Ultra, Galaxy Z Fold8 | [Galaxy S26 Ultra](https://www.tomsguide.com/us/best-phone-cameras%2Creview-2272.html) |
| Samsung Exynos 1480 (4nm) | samsung exynos 1480 (4nm) | Galaxy A37 5G | 제품·칩셋 인덱스 확인 |
| Apple A18 | apple a18 (4-core gpu) | iPhone 16e | [iPhone 16e](https://www.tomsguide.com/phones/ive-tested-the-iphone-17e-pixel-10a-and-galaxy-a57-heres-the-sub-usd700-mid-range-phone-worth-buying) |
| Apple A19 | apple a19 (5-core gpu) / apple a19 (4-core gpu) | iPhone 17, iPhone 17e | [iPhone 17](https://www.tomsguide.com/phones/iphones/apple-iphone-17-review) · [iPhone 17e](https://www.tomsguide.com/phones/ive-tested-the-iphone-17e-pixel-10a-and-galaxy-a57-heres-the-sub-usd700-mid-range-phone-worth-buying) |
| Apple A19 Pro | apple a19 pro (5-core gpu) | iPhone Air | [iPhone Air](https://benchmarks.ul.com/en-sc/hardware/phone/Apple%2BiPhone%2BAir%2Breview) |
| Apple A20 Pro | apple a20 pro (6-core cpu, 7-core gpu) | iPhone 18 Pro, iPhone 18 Pro Max, iPhone Duo | [iPhone 18 Pro](https://benchmarks.ul.com/hardware/phone/Apple%2BiPhone%2B18%2BPro%2Breview) |

- A16 Bionic의 설명 차이는 같은 iPhone 15 계열의 CPU/GPU 구성을 나타낸다. [Apple 발표](https://www.apple.com/newsroom/2023/09/apple-debuts-iphone-15-and-iphone-15-plus/)
- Galaxy S25 FE SM-S731N은 DB 표기와 달리 삼성 국내 자급제 자료에 Exynos 2400으로 명시된다. 해당 모델에만 벤치마크 별칭을 적용했고 카탈로그는 그대로다. S24 FE의 2400e는 별개다. [S25 FE 공식 사양](https://www.samsung.com/sec/support/model/SM-S731NLBWKOO/) · [S24 FE 공식 사양](https://www.samsung.com/sec/support/model/SM-S721NLBWKOO/)
- A18·A19·A19 Pro는 GPU 코어가 다른 제품 구성을 분리한다. A20 Pro는 iPad mini의 5코어 CPU 구성과도 구분한다. [Apple iPhone 16e](https://support.apple.com/ko-kr/122208) · [Apple iPhone 17 비교](https://www.apple.com/kr/iphone/compare/?modelList=iphone-17e%2Ciphone-17) · [Apple iPhone Air](https://www.apple.com/kr/iphone-air/specs/) · [Apple iPad mini](https://www.apple.com/kr/ipad-mini/specs/)

## 공급처 상태

- Geekbench에는 싱글·멀티코어와 OpenCL·Vulkan·Metal 결과가 있다. 공개 차트 일부는 Geekbench 7이므로 6과 합산하지 않는다. 공식 API는 v6·v7 CPU/GPU를 지원하며 계정에 연결된 Bearer 키가 필요하다. 공개 API 문서에서 가격과 기기로움의 정규화·표시 허용 범위를 확인하지 못했다. [Geekbench 공식 API](https://www.geekbench.com/api/api.html) · [Geekbench 6 GPU 결과](https://browser.geekbench.com/v6/compute)
- UL의 모바일 Wild Life 및 Stress Test는 GPU·지속 성능 후보이다. 공식 리테일 API 문서의 표준 상품은 PC 추정치용이다. 스마트폰 실측의 전달 방식과 비용은 별도 확인이 필요하다. [3DMark 모바일 시험](https://benchmarks.ul.com/3dmark-android) · [리테일 API](https://support.benchmarks.ul.com/support/solutions/articles/44002238427-api-documentation)
- DevCheck는 모바일 CPU/GPU 수치를 공개하지만 자동 추출을 제한한다. PassMark에는 모바일 데이터 계약 경로가 있으나 공개 추천 사이트의 이용 범위는 계약 전에 확인해야 한다. [DevCheck 약관](https://devcheck.app/terms) · [PassMark 데이터 구독](https://www.passmark.com/services/market-analysis.php)
- Notebookcheck·GSMArena 및 직접 시험 리뷰에서 공개 후보를 찾았다. 자동 이용과 로컬 점수 산출 권한을 확인하지 못했다. 공개 데이터 후보 중 InnoReviews는 제3자 원본 수치를 재사용 라이선스에서 제외한다. NPU Bench Swarm은 Poco X6 Pro의 특정 추론 시험이라 현 카탈로그 평가에는 부적합하다. [Notebookcheck 이용 안내](https://www.notebookcheck.net/Contact.270.0.html) · [InnoReviews 데이터 방법](https://innoreviews.com/methodology) · [NPU Bench Swarm](https://zenodo.org/records/21602991)

승인된 CPU·GPU 문서를 확보하지 못해 이번 단계에 해당 URL의 Gemini 실호출은 0회다. 구조화 계약, 오매칭 차단, 시험 API 분리, 429·자료 결측 대응과 점수 반영은 합성 자료로 시험했다.

## 실제 추천 전후 비교

예산과 저장 용량 조건을 적용한 실개발 카탈로그에 동일한 합성 선호를 전달했다. 변경 전후 전체 후보의 점수와 순위가 모두 같았다. 아래는 변경 후 상위 결과이며 모델은 모두 서로 다르다. 가격과 다나와 링크는 기존 관측값을 그대로 사용했다. 점수는 내부 검증용이다.

| 조건 | 모델 / 구성 / SKU | 상위 세 모델과 내부 점수 |
| --- | --- | --- |
| 게임 100만 | 5 / 5 / 13 | Galaxy S25 FE 256GB·8GB 0.7342 → Galaxy A15 LTE 128GB·6GB 0.6632 → Galaxy A17 LTE 128GB·6GB 0.6586 |
| 게임 150만 | 16 / 22 / 62 | Galaxy S25 FE 256GB·8GB 0.7790 → Galaxy S24+ 256GB·12GB 0.7692 → Galaxy S25+ 256GB·12GB 0.7446 |
| 성능 무제한 | 28 / 64 / 163 | Galaxy S25 Ultra 1024GB·16GB 0.8637 → Galaxy S24+ 512GB·12GB 0.8615 → Galaxy S24 Ultra 1024GB·12GB 0.8495 |
| 가성비 70만 | 3 / 3 / 8 | Galaxy A15 LTE 128GB·6GB 0.7320 → Galaxy A16 LTE 128GB·4GB 0.6559 → Galaxy A17 LTE 128GB·6GB 0.6486 |
| 카메라 150만 | 16 / 22 / 62 | Galaxy S25 FE 256GB·8GB 0.7450 → Galaxy A15 LTE 128GB·6GB 0.7227 → Galaxy S24+ 256GB·12GB 0.7209 |
| 배터리 100만 | 5 / 5 / 13 | Galaxy A15 LTE 128GB·6GB 0.7748 → Galaxy A17 LTE 128GB·6GB 0.7611 → Galaxy A16 LTE 128GB·4GB 0.7516 |
| 휴대성 무제한 | 28 / 64 / 163 | Galaxy S25 256GB·12GB 0.7891 → Galaxy S24 512GB·8GB 0.7810 → iPhone 16e 256GB·8GB 0.7326 |
| 일반 100만 | 5 / 5 / 13 | Galaxy A15 LTE 128GB·6GB 0.7698 → Galaxy A17 LTE 128GB·6GB 0.7315 → Galaxy A16 LTE 128GB·4GB 0.7180 |
| 업무 180만 | 21 / 32 / 85 | Galaxy S25 FE 256GB·8GB 0.7739 → Galaxy S24+ 512GB·12GB 0.7658 → Galaxy S25+ 256GB·12GB 0.7362 |
| 256GB 이상 150만 | 12 / 17 / 51 | Galaxy S25 FE 256GB·8GB 0.7601 → Galaxy S24+ 256GB·12GB 0.7386 → Galaxy S25+ 256GB·12GB 0.7081 |

100만원 게임의 A15 LTE는 337,000원으로 예산 적합도가 0.7335였다. A17 LTE는 569,040원으로 0.5776이었다. 예산 가중치 0.20에서 A15가 얻은 점수 차이는 약 0.0312였다. A17의 화면 점수 우위 약 0.0256을 넘어 A15가 2위가 됐다. 두 제품에 검증된 게임 성능값은 사용되지 않았다.

실측 적용 0/28로 삼성 19개·Apple 9개 모두 기존 사양 기반 평가를 사용했다. 성능 자료가 없는 제품을 0으로 채우지 않았다. 부분 실측 한도 ±0.025는 실측 기반 조정이 없어 유지했다. 실개발 카탈로그에 합성 업그레이드 의향을 사용해 KEEP, 저장 공간 개선 시 REPLACE, 성능 증거 부족 시 DEFER를 확인했다. 실제 계정 요청·이력 저장은 실행하지 않았다.
