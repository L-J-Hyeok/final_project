'use strict';

const adapter = require('./danawa-price-adapter');
const { classifyDisqualifiedListing } = require('./danawa-price-matcher');

const EXTRA_DISQUALIFIED_KEYWORDS = [
  '파우치', '슬리브', '키스킨', '액정보호필름', '종이질감', '펜촉', '이어팁', '시계줄', '워치밴드',
  '충전독', '충전크래들', '단품', '유닛단품', '왼쪽단품', '오른쪽단품', '본체단품',
  '북커버', '스마트폴리오', '키보드케이스', '전용케이스', '보호케이스', '실리콘케이스',
  '해외쇼핑', '구매대행', '병행', '내수용', '중국버전', '글로벌롬',
  '리퍼', '중고', '전시', '반품', '가개통', '미개봉중고', '박스개봉'
];

const BRAND_PATTERNS = {
  apple: /\b(apple)\b|애플|\b(ipad|macbook|airpods)\b|아이패드|맥북|에어팟|애플워치/i,
  samsung: /\b(samsung)\b|삼성|삼성전자|\b(galaxy)\b|갤럭시/i,
  lg: /\b(lg)\b|lg전자|\b(gram|ultragear)\b|그램|울트라기어/i,
  lenovo: /\b(lenovo)\b|레노버|\b(legion|thinkpad|yoga)\b|리전|씽크패드|요가/i,
  asus: /\b(asus)\b|에이수스|아수스|\b(rog|zenbook|tuf|zephyrus)\b|젠북|제피러스/i,
  sony: /\b(sony)\b|소니|\b(wf-1000xm5|wf-ls900n|linkbuds)\b|링크버즈/i,
  bose: /\b(bose)\b|보스|\b(quietcomfort)\b/i,
  sennheiser: /\b(sennheiser)\b|젠하이저|\b(momentum|mtw4)\b|모멘텀/i,
  jbl: /\b(jbl)\b|제이비엘|하만/i
};

function cleanText(text) {
  return adapter.cleanProductText(text || '');
}

function parseStorageTokensFromTitle(title) {
  const tokens = new Set();
  const str = String(title || '');
  const tbRegex = /(?:SSD\s*|저장장치\s*|내장\s*)?(\d+(?:\.\d+)?)\s*TB\b/gi;
  let m;
  while ((m = tbRegex.exec(str)) !== null) {
    tokens.add(Math.round(Number(m[1]) * 1024));
  }
  // Match GB tokens that are NOT preceded by 램 / RAM / 메모리 / RTX / GTX / 외장
  const gbRegex = /(?<!램\s*|RAM\s*|메모리\s*|RTX\s*\d+\s*|GTX\s*\d+\s*)(\d+)\s*GB\b/gi;
  while ((m = gbRegex.exec(str)) !== null) {
    const val = Number(m[1]);
    if ([32, 64, 128, 256, 512, 1024, 2048].includes(val)) {
      tokens.add(val);
    }
  }
  return [...tokens];
}

function parseRamTokensFromTitle(title) {
  const tokens = new Set();
  const str = String(title || '');
  const ramRegex = /(?:램|RAM|메모리)\s*(\d+)\s*GB\b/gi;
  let m;
  while ((m = ramRegex.exec(str)) !== null) {
    tokens.add(Number(m[1]));
  }
  return [...tokens];
}

function hasPlusBundleInTitle(title, modelName) {
  // Remove legitimate model '+' occurrences like S9+, S10+, FE+
  const stripped = String(title || '')
    .replace(/(?:S9|S10|FE)\s*\+/gi, '')
    .replace(/8\+\s*Gen/gi, '');
  if (/\+\s*[가-힣a-zA-Z0-9]+.*(?:케이스|필름|스트랩|커버|펜|파우치|어댑터|마우스|가방)/i.test(stripped)) {
    return true;
  }
  return false;
}

function buildCatalogSearchQueries(model, sku) {
  const cat = model.category_code;
  const brand = model.brand;
  const name = model.model_name;
  const modelNo = model.model_number;
  const storageToken = sku.storage_gb ? adapter.formatStorageToken(sku.storage_gb) : '';
  const queries = [];

  if (cat === 'tablet') {
    if (modelNo === 'A3354') {
      queries.push(`iPad A16 ${storageToken}`);
      queries.push(`아이패드 11세대 A16 ${storageToken}`);
    } else if (modelNo === 'A3266') {
      queries.push(`iPad Air 11 M3 ${storageToken}`);
      queries.push(`아이패드 에어 11 M3 ${storageToken}`);
    } else if (modelNo === 'A3268') {
      queries.push(`iPad Air 13 M3 ${storageToken}`);
      queries.push(`아이패드 에어 13 M3 ${storageToken}`);
    } else if (modelNo === 'A2925') {
      queries.push(`iPad Pro 13 M4 ${storageToken}`);
      queries.push(`아이패드 프로 13 M4 ${storageToken}`);
    } else if (modelNo === 'A2836') {
      queries.push(`iPad Pro 11 M4 ${storageToken}`);
      queries.push(`아이패드 프로 11 M4 ${storageToken}`);
    } else if (modelNo === 'A2898') {
      queries.push(`iPad Air 13 M2 ${storageToken}`);
      queries.push(`아이패드 에어 13 M2 ${storageToken}`);
    } else if (modelNo === 'A2993') {
      queries.push(`iPad mini A17 Pro ${storageToken}`);
      queries.push(`아이패드 미니 7세대 ${storageToken}`);
    } else if (brand.toLowerCase() === 'samsung') {
      const korName = name
        .replace(/^Galaxy\s+Tab\s+/i, '갤럭시탭 ')
        .replace(/\+/g, ' 플러스');
      queries.push(`${korName} Wi-Fi ${storageToken}`);
      queries.push(`${modelNo} ${storageToken}`);
    } else if (brand.toLowerCase() === 'lenovo') {
      if (modelNo === 'TB-320FC') {
        queries.push(`레노버 리전탭 Y700 2세대 ${storageToken}`);
        queries.push(`TB-320FC ${storageToken}`);
      } else if (modelNo === 'TB-321FU') {
        queries.push(`레노버 리전탭 Y700 3세대 ${storageToken}`);
        queries.push(`TB-321FU ${storageToken}`);
      } else if (modelNo === 'TB-Q706F') {
        queries.push(`레노버 탭 P12 Pro ${storageToken}`);
      } else if (modelNo === 'TB-132FU') {
        queries.push(`레노버 탭 P11 Pro 2세대 ${storageToken}`);
      } else if (modelNo === 'TB-330FU') {
        queries.push(`레노버 탭 M11 ${storageToken}`);
      }
    }
  } else if (cat === 'laptop') {
    if (brand.toLowerCase() === 'apple') {
      const korName = name
        .replace(/^MacBook\s+Pro\s+/i, '맥북프로 ')
        .replace(/^MacBook\s+Air\s+/i, '맥북에어 ')
        .replace(/[()]/g, '');
      const ramToken = sku.ram_gb ? `램${sku.ram_gb}GB` : '';
      queries.push(`APPLE ${korName} ${ramToken} SSD ${storageToken}`);
      queries.push(`${korName} ${storageToken}`);
    } else {
      queries.push(`${modelNo} ${storageToken}`);
      queries.push(`${modelNo}`);
    }
  } else if (cat === 'smartwatch') {
    const sizeMm = sku.options_json?.case_size_mm ? `${sku.options_json.case_size_mm}mm` : '';
    const connKor = sku.connectivity === 'cellular' ? 'LTE' : (brand.toLowerCase() === 'apple' ? 'GPS' : '블루투스');
    if (brand.toLowerCase() === 'samsung') {
      const korName = name
        .replace(/^Galaxy\s+Watch/i, '갤럭시워치')
        .replace(/\s+Bluetooth.*$/i, '')
        .replace(/\s+\d+\s*mm.*$/i, '')
        .replace(/Classic/i, '클래식')
        .replace(/Ultra/i, '울트라');
      queries.push(`삼성전자 ${korName} ${sizeMm} ${connKor} 정품`);
      queries.push(`${modelNo} ${sizeMm}`);
    } else if (brand.toLowerCase() === 'apple') {
      if (modelNo === 'A2986') {
        queries.push(`APPLE 애플워치 울트라2 ${sizeMm} 티타늄 정품`);
      } else {
        const seriesMatch = name.match(/Series\s*(\d+)/i);
        const seriesNum = seriesMatch ? seriesMatch[1] : '';
        queries.push(`APPLE 애플워치${seriesNum} ${sizeMm} 알루미늄 ${connKor} 정품`);
        queries.push(`애플워치 시리즈 ${seriesNum} ${sizeMm} ${connKor}`);
      }
    }
  } else if (cat === 'earbuds') {
    if (modelNo === 'A3048') {
      queries.push('APPLE 에어팟 프로2 USB-C 정품');
    } else if (modelNo === 'A3056') {
      queries.push('APPLE 에어팟 4세대 노이즈 캔슬링 정품');
      queries.push('에어팟4 액티브 노이즈 캔슬링');
    } else if (modelNo === 'A3050') {
      queries.push('APPLE 에어팟 4세대 일반모델 정품');
      queries.push('에어팟4 정품');
    } else if (modelNo === 'SM-R630') {
      queries.push('삼성전자 갤럭시 버즈3 프로 SM-R630N 정품');
    } else if (modelNo === 'SM-R530') {
      queries.push('삼성전자 갤럭시 버즈3 SM-R530N 정품');
    } else if (modelNo === 'SM-R400') {
      queries.push('삼성전자 갤럭시 버즈 FE SM-R400N 정품');
    } else if (modelNo === 'SM-R510') {
      queries.push('삼성전자 갤럭시 버즈2 프로 SM-R510N 정품');
    } else if (modelNo === 'WF-1000XM5') {
      queries.push('소니 WF-1000XM5 정품');
    } else if (modelNo === 'WF-LS900N') {
      queries.push('소니 링크버즈 S WF-LS900N 정품');
    } else if (modelNo === 'QC-ULTRA-EB') {
      queries.push('BOSE QC 울트라 이어버드 정품');
      queries.push('Bose QuietComfort Ultra Earbuds 정품');
    } else if (modelNo === 'QC-EB-2024') {
      queries.push('BOSE QuietComfort 이어버드 2024 정품');
      queries.push('보스 QC 이어버드 정품');
    } else if (modelNo === 'MTW4') {
      queries.push('젠하이저 모멘텀 트루 와이어리스 4 정품');
      queries.push('Sennheiser MTW4 정품');
    }
  } else if (cat === 'speaker') {
    if (modelNo === 'FLIP 7') {
      queries.push('JBL FLIP 7 정품');
    } else {
      queries.push(`${brand} ${name} 정품`);
    }
  }

  return [...new Set(queries.map(q => adapter.validateQueryInput(q.slice(0, 128))))];
}

function matchDanawaItemToCatalogSku(item, model, sku, options = {}) {
  const reasons = [];
  const title = cleanText(item?.productName || '');
  const minPrice = Number(item?.minPrice);
  const pcode = String(item?.productCode || '').trim();

  if (!title) reasons.push('EMPTY_TITLE');
  if (!/^[1-9]\d{3,19}$/.test(pcode)) reasons.push('INVALID_PRODUCT_CODE');
  if (!Number.isSafeInteger(minPrice) || minPrice <= 0) reasons.push('INVALID_PRICE');

  // 1. Check general disqualified listing rules (used, refurb, overseas, contract, out-of-stock, accessory)
  const disq = classifyDisqualifiedListing({ productName: title, minPrice });
  for (const r of disq.reasons) {
    if (r !== 'ABNORMAL_LOW_PRICE' && !r.startsWith('NON_DOMESTIC_SAMSUNG_MODEL:')) {
      reasons.push(r);
    }
  }
  for (const kw of EXTRA_DISQUALIFIED_KEYWORDS) {
    if (title.toLowerCase().includes(kw.toLowerCase())) {
      reasons.push(`EXTRA_DISQUALIFIED:${kw}`);
    }
  }
  if (hasPlusBundleInTitle(title, model.model_name)) {
    reasons.push('BUNDLE_OFFER_EXCLUDED');
  }

  // 2. Price floor & launch price sanity check
  if (minPrice < 50000) {
    reasons.push('ABNORMAL_LOW_PRICE');
  }
  const launchPrice = options.launchPriceKrw ? Number(options.launchPriceKrw) : null;
  if (launchPrice && launchPrice > 0) {
    if (minPrice < Math.round(launchPrice * 0.30)) {
      reasons.push('BELOW_LAUNCH_PRICE_RATIO');
    }
    if (minPrice > Math.round(launchPrice * 1.50)) {
      reasons.push('ABOVE_LAUNCH_PRICE_RATIO');
    }
  }

  // 3. Brand check
  const brandKey = model.brand.toLowerCase();
  const brandPattern = BRAND_PATTERNS[brandKey];
  if (brandPattern && !brandPattern.test(`${title} ${item?.maker || ''}`)) {
    reasons.push('BRAND_MISMATCH');
  }

  const cat = model.category_code;
  const modelNo = model.model_number;
  const name = model.model_name;

  // 4. Category-specific matching
  if (cat === 'tablet') {
    // Storage check
    const storageTokens = parseStorageTokensFromTitle(title);
    if (!storageTokens.includes(Number(sku.storage_gb)) || storageTokens.length > 1) {
      reasons.push(`STORAGE_MISMATCH:expected=${sku.storage_gb},found=${storageTokens.join(',')}`);
    }
    // RAM check if present in title and SKU
    const ramTokens = parseRamTokensFromTitle(title);
    if (sku.ram_gb != null && ramTokens.length > 0 && !ramTokens.includes(Number(sku.ram_gb))) {
      reasons.push(`RAM_MISMATCH:expected=${sku.ram_gb},found=${ramTokens.join(',')}`);
    }
    // Connectivity check (wifi vs cellular)
    const hasCellularToken = /\b(5g|lte|cellular)\b|셀룰러/i.test(title);
    if (sku.connectivity === 'wifi' && hasCellularToken) {
      reasons.push('CONNECTIVITY_MISMATCH:expected=wifi,found=cellular');
    } else if (sku.connectivity === 'cellular' && !hasCellularToken) {
      reasons.push('CONNECTIVITY_MISMATCH:expected=cellular,found=wifi');
    }
    // Model identity check
    if (modelNo === 'A3354') {
      if (!(/\ba16\b|11세대|\ba3354\b/i.test(title)) || /\b(air|pro|mini)\b|에어|프로|미니/i.test(title)) {
        reasons.push('TABLET_MODEL_MISMATCH:A3354');
      }
    } else if (modelNo === 'A3266') {
      if (!(/\bair\b|에어/i.test(title) && /\bm3\b/i.test(title) && /\b11\b/i.test(title)) || /\b13\b|\bpro\b|프로/i.test(title)) {
        reasons.push('TABLET_MODEL_MISMATCH:A3266');
      }
    } else if (modelNo === 'A3268') {
      if (!(/\bair\b|에어/i.test(title) && /\bm3\b/i.test(title) && /\b13\b/i.test(title)) || /\b11\b|\bpro\b|프로/i.test(title)) {
        reasons.push('TABLET_MODEL_MISMATCH:A3268');
      }
    } else if (modelNo === 'A2925') {
      if (!(/\bpro\b|프로/i.test(title) && /\bm4\b/i.test(title) && /\b13\b/i.test(title)) || /\b11\b|\bair\b|에어|나노\s*텍스처|nano/i.test(title)) {
        reasons.push('TABLET_MODEL_MISMATCH:A2925');
      }
    } else if (modelNo === 'A2836') {
      if (!(/\bpro\b|프로/i.test(title) && /\bm4\b/i.test(title) && /\b11\b/i.test(title)) || /\b13\b|\bair\b|에어|나노\s*텍스처|nano/i.test(title)) {
        reasons.push('TABLET_MODEL_MISMATCH:A2836');
      }
    } else if (modelNo === 'A2898') {
      if (!(/\bair\b|에어/i.test(title) && /\bm2\b/i.test(title) && /\b13\b/i.test(title)) || /\b11\b|\bpro\b|프로/i.test(title)) {
        reasons.push('TABLET_MODEL_MISMATCH:A2898');
      }
    } else if (modelNo === 'A2993') {
      const strippedA17Pro = title.replace(/a17\s*(?:pro|프로)/gi, 'a17');
      if (!(/\bmini\b|미니/i.test(strippedA17Pro) && (/\ba17\b|7세대|\ba2993\b/i.test(strippedA17Pro))) || /\b(air|pro)\b|에어|프로|6세대/i.test(strippedA17Pro)) {
        reasons.push('TABLET_MODEL_MISMATCH:A2993');
      }
    } else if (brandKey === 'samsung') {
      const wantS10 = /S10/i.test(name);
      const wantS9 = /S9/i.test(name);
      const wantFe = /\bFE\b/i.test(name);
      const wantPlus = /\+|Plus/i.test(name);
      const wantUltra = /Ultra/i.test(name);
      const hasS10 = /S10/i.test(title);
      const hasS9 = /S9/i.test(title);
      const hasFe = /\bFE\b/i.test(title);
      const hasPlus = /\+|플러스|\bplus\b/i.test(title);
      const hasUltra = /울트라|\bultra\b/i.test(title);
      const hasLite = /라이트|\blite\b/i.test(title);
      if (wantS10 !== hasS10 || wantS9 !== hasS9 || wantFe !== hasFe || wantPlus !== hasPlus || wantUltra !== hasUltra || hasLite) {
        reasons.push('SAMSUNG_TAB_QUALIFIER_MISMATCH');
      }
    } else if (brandKey === 'lenovo') {
      if (modelNo === 'TB-320FC') {
        if (!(/y700/i.test(title) && (/2세대|2nd|tb-?320/i.test(title))) || /3세대|2024|tb-?321/i.test(title)) {
          reasons.push('LENOVO_TAB_MISMATCH:TB-320FC');
        }
      } else if (modelNo === 'TB-321FU') {
        if (!(/y700/i.test(title) && (/3세대|2024|tb-?321/i.test(title))) || /2세대|tb-?320/i.test(title)) {
          reasons.push('LENOVO_TAB_MISMATCH:TB-321FU');
        }
      } else if (modelNo === 'TB-Q706F') {
        if (!(/p12\s*(?:pro|프로)|tb-?q706/i.test(title))) reasons.push('LENOVO_TAB_MISMATCH:TB-Q706F');
      } else if (modelNo === 'TB-132FU') {
        if (!(/p11\s*pro|tb-?132/i.test(title))) reasons.push('LENOVO_TAB_MISMATCH:TB-132FU');
      } else if (modelNo === 'TB-330FU') {
        if (!(/\bm11\b|tb-?330/i.test(title))) reasons.push('LENOVO_TAB_MISMATCH:TB-330FU');
      }
    }
  } else if (cat === 'laptop') {
    const storageTokens = parseStorageTokensFromTitle(title);
    if (!storageTokens.includes(Number(sku.storage_gb)) || storageTokens.length > 1) {
      reasons.push(`LAPTOP_STORAGE_MISMATCH:expected=${sku.storage_gb},found=${storageTokens.join(',')}`);
    }
    const ramTokens = parseRamTokensFromTitle(title);
    if (sku.ram_gb != null && ramTokens.length > 0 && !ramTokens.includes(Number(sku.ram_gb))) {
      reasons.push(`LAPTOP_RAM_MISMATCH:expected=${sku.ram_gb},found=${ramTokens.join(',')}`);
    }
    if (/램업|SSD업|추가장착|특가패키지/i.test(title)) {
      reasons.push('LAPTOP_CUSTOM_MODIFIED');
    }

    if (brandKey === 'apple') {
      const wantPro = /MacBook\s+Pro/i.test(name);
      const wantAir = /MacBook\s+Air/i.test(name);
      const hasPro = /맥북\s*프로|macbook\s*pro/i.test(title);
      const hasAir = /맥북\s*에어|macbook\s*air/i.test(title);
      if (wantPro !== hasPro || wantAir !== hasAir) {
        reasons.push('MACBOOK_LINE_MISMATCH');
      }
      const sizeMatch = name.match(/\b(13|14|15|16)\b/);
      if (sizeMatch) {
        const sz = sizeMatch[1];
        const szRegex = new RegExp(`(?:맥북(?:프로|에어)?\\s*${sz}|\\b${sz}(?:인치|형)?\\b)`, 'i');
        if (!szRegex.test(title)) reasons.push(`MACBOOK_SIZE_MISMATCH:${sz}`);
      }
      // Chip check: M3 Max vs M3 Pro vs M3 vs M5
      const cpuOpt = `${sku.options_json?.cpu || ''} ${sku.options_json?.gpu || ''} ${name}`;
      const wantM3Max = /M3\s*Max/i.test(cpuOpt);
      const wantM3Pro = /M3\s*Pro/i.test(cpuOpt);
      const wantM5 = /\bM5\b/i.test(cpuOpt);
      const wantM3Base = /\bM3\b/i.test(cpuOpt) && !wantM3Max && !wantM3Pro;
      const hasM3Max = /M3\s*(?:Max|맥스)/i.test(title);
      const hasM3Pro = /M3\s*(?:Pro|프로)/i.test(title);
      const hasM5 = /\bM5\b/i.test(title);
      const hasM3Any = /\bM3\b/i.test(title);
      if (wantM3Max && !hasM3Max) reasons.push('MACBOOK_CHIP_MISMATCH:expected=M3_Max');
      if (wantM3Pro && (!hasM3Pro || hasM3Max)) reasons.push('MACBOOK_CHIP_MISMATCH:expected=M3_Pro');
      if (wantM3Base && (!hasM3Any || hasM3Max || hasM3Pro)) reasons.push('MACBOOK_CHIP_MISMATCH:expected=M3');
      if (wantM5 && (!hasM5 || /M5\s*(?:Pro|Max|프로|맥스)/i.test(title))) reasons.push('MACBOOK_CHIP_MISMATCH:expected=M5');

      // GPU core count check if specified in SKU options_json.gpu and in title
      const skuGpuCores = (sku.options_json?.gpu || '').match(/(\d+)\s*코어/i)?.[1];
      const titleGpuCores = title.match(/(\d+)\s*코어\s*GPU/i)?.[1];
      if (skuGpuCores && titleGpuCores && skuGpuCores !== titleGpuCores) {
        reasons.push(`MACBOOK_GPU_CORE_MISMATCH:expected=${skuGpuCores},found=${titleGpuCores}`);
      }
      // Require explicit RAM match on MacBooks
      if (!ramTokens.includes(Number(sku.ram_gb))) {
        reasons.push(`MACBOOK_EXPLICIT_RAM_REQUIRED:${sku.ram_gb}`);
      }
    } else {
      // Non-Apple laptop: require exact model_number in title
      const normalizedTitle = title.toUpperCase().replace(/\s+/g, '');
      const normalizedCode = modelNo.toUpperCase().replace(/\s+/g, '');
      if (!normalizedTitle.includes(normalizedCode)) {
        reasons.push(`LAPTOP_MODEL_CODE_MISMATCH:${modelNo}`);
      }
    }
  } else if (cat === 'smartwatch') {
    const sizeMm = sku.options_json?.case_size_mm;
    if (sizeMm) {
      const mmRegex = new RegExp(`\\b${sizeMm}\\s*mm\\b`, 'i');
      if (!mmRegex.test(title)) {
        reasons.push(`WATCH_SIZE_MISMATCH:expected=${sizeMm}mm`);
      }
    }
    const hasLte = /\b(lte|cellular)\b|셀룰러/i.test(title);
    if (sku.connectivity === 'cellular' && !hasLte) {
      reasons.push('WATCH_CONN_MISMATCH:expected=cellular');
    } else if (sku.connectivity !== 'cellular' && hasLte) {
      reasons.push(`WATCH_CONN_MISMATCH:expected=${sku.connectivity},found=cellular`);
    }

    if (brandKey === 'samsung') {
      if (modelNo === 'SM-L330') {
        if (!(/워치\s*8|watch\s*8/i.test(title)) || /클래식|classic|울트라|ultra/i.test(title)) {
          reasons.push('WATCH_MODEL_MISMATCH:SM-L330');
        }
      } else if (modelNo === 'SM-L300' || modelNo === 'SM-L310') {
        if (!(/워치\s*7|watch\s*7/i.test(title)) || /클래식|classic|울트라|ultra|\bfe\b/i.test(title)) {
          reasons.push(`WATCH_MODEL_MISMATCH:${modelNo}`);
        }
      } else if (modelNo === 'SM-L705N') {
        if (!(/워치\s*울트라|watch\s*ultra/i.test(title))) {
          reasons.push('WATCH_MODEL_MISMATCH:SM-L705N');
        }
      } else if (modelNo === 'SM-R960') {
        if (!(/워치\s*6|watch\s*6/i.test(title) && /클래식|classic/i.test(title))) {
          reasons.push('WATCH_MODEL_MISMATCH:SM-R960');
        }
      } else if (modelNo === 'SM-R861') {
        if (!(/워치\s*fe|watch\s*fe/i.test(title))) {
          reasons.push('WATCH_MODEL_MISMATCH:SM-R861');
        }
      }
    } else if (brandKey === 'apple') {
      if (modelNo === 'A2986') {
        if (!(/울트라\s*2|ultra\s*2/i.test(title))) reasons.push('WATCH_MODEL_MISMATCH:A2986');
      } else if (modelNo === 'A3331') {
        if (!(/애플워치\s*11|워치\s*11|series\s*11|시리즈\s*11/i.test(title)) || /티타늄|스틸|에르메스|\bse\b/i.test(title)) {
          reasons.push('WATCH_MODEL_MISMATCH:A3331');
        }
      } else if (modelNo === 'A2999' || modelNo === 'A2997') {
        if (!(/애플워치\s*10|워치\s*10|series\s*10|시리즈\s*10/i.test(title)) || /티타늄|스틸|에르메스|\bse\b/i.test(title)) {
          reasons.push(`WATCH_MODEL_MISMATCH:${modelNo}`);
        }
      } else if (modelNo === 'A2980') {
        if (!(/애플워치\s*9|워치\s*9|series\s*9|시리즈\s*9/i.test(title)) || /티타늄|스틸|스테인리스|에르메스|\bse\b/i.test(title)) {
          reasons.push('WATCH_MODEL_MISMATCH:A2980');
        }
      }
    }
  } else if (cat === 'earbuds') {
    if (/헤드폰|headphones|맥스|\bmax\b/i.test(title)) {
      reasons.push('EARBUDS_HEADPHONE_CONFLICT');
    }
    if (modelNo === 'A3048') {
      if (!(/에어팟\s*프로\s*2|airpods\s*pro\s*2/i.test(title) && /usb-?c/i.test(title)) || /라이트닝|lightning/i.test(title)) {
        reasons.push('EARBUDS_MODEL_MISMATCH:A3048');
      }
    } else if (modelNo === 'A3056') {
      if (!(/에어팟\s*4|airpods\s*4/i.test(title) && /노이즈\s*캔슬링|\banc\b/i.test(title))) {
        reasons.push('EARBUDS_MODEL_MISMATCH:A3056');
      }
    } else if (modelNo === 'A3050') {
      if (!(/에어팟\s*4|airpods\s*4/i.test(title)) || /노이즈\s*캔슬링|\banc\b|프로|\bpro\b/i.test(title)) {
        reasons.push('EARBUDS_MODEL_MISMATCH:A3050');
      }
    } else if (modelNo === 'SM-R630') {
      if (!(/버즈\s*3\s*프로|buds\s*3\s*pro|sm-r630/i.test(title))) {
        reasons.push('EARBUDS_MODEL_MISMATCH:SM-R630');
      }
    } else if (modelNo === 'SM-R530') {
      if (!(/버즈\s*3|buds\s*3|sm-r530/i.test(title)) || /프로|\bpro\b|\bfe\b/i.test(title)) {
        reasons.push('EARBUDS_MODEL_MISMATCH:SM-R530');
      }
    } else if (modelNo === 'SM-R400') {
      if (!(/버즈\s*fe|buds\s*fe|sm-r400/i.test(title))) {
        reasons.push('EARBUDS_MODEL_MISMATCH:SM-R400');
      }
    } else if (modelNo === 'SM-R510') {
      if (!(/버즈\s*2\s*프로|buds\s*2\s*pro|sm-r510/i.test(title))) {
        reasons.push('EARBUDS_MODEL_MISMATCH:SM-R510');
      }
    } else if (modelNo === 'WF-1000XM5') {
      if (!(/\bwf-1000xm5\b/i.test(title))) {
        reasons.push('EARBUDS_MODEL_MISMATCH:WF-1000XM5');
      }
    } else if (modelNo === 'WF-LS900N') {
      if (!(/링크버즈\s*s|linkbuds\s*s|\bwf-ls900n\b/i.test(title)) || /핏|\bfit\b|오픈|\bopen\b/i.test(title)) {
        reasons.push('EARBUDS_MODEL_MISMATCH:WF-LS900N');
      }
    } else if (modelNo === 'QC-ULTRA-EB') {
      if (!(/울트라|ultra/i.test(title) && /이어버드|earbuds/i.test(title)) || /2세대|\b2nd\b|\bii\b/i.test(title)) {
        reasons.push('EARBUDS_MODEL_MISMATCH:QC-ULTRA-EB');
      }
    } else if (modelNo === 'QC-EB-2024') {
      if (!(/quietcomfort|qc/i.test(title) && /이어버드|earbuds/i.test(title)) || /울트라|ultra|\bii\b|2세대/i.test(title)) {
        reasons.push('EARBUDS_MODEL_MISMATCH:QC-EB-2024');
      }
    } else if (modelNo === 'MTW4') {
      if (!(/모멘텀\s*트루\s*와이어리스\s*4|momentum\s*true\s*wireless\s*4|\bmtw4\b/i.test(title))) {
        reasons.push('EARBUDS_MODEL_MISMATCH:MTW4');
      }
    }
  } else if (cat === 'speaker') {
    if (modelNo === 'FLIP 7') {
      if (!(/\bflip\s*7\b|플립\s*7/i.test(title))) {
        reasons.push('SPEAKER_MODEL_MISMATCH:FLIP_7');
      }
    }
  }

  return {
    matched: reasons.length === 0,
    reasons,
    productCode: pcode,
    productName: title,
    minPrice,
    productUrl: `${adapter.DANAWA_INFO_BASE_URL}${pcode}`
  };
}

function buildSaleObservationForCatalog(matchResult, model, sku, now = new Date()) {
  const isoNow = (now instanceof Date ? now : new Date(now)).toISOString();
  return {
    seller_name: '다나와 기준 최저가',
    amount_minor: String(matchResult.minPrice),
    currency: 'KRW',
    product_url: matchResult.productUrl,
    observed_at: isoNow,
    checked_at: isoNow,
    listing_title: matchResult.productName.slice(0, 500),
    sku_match: {
      brand: model.brand,
      model_number: model.model_number,
      manufacturer_part_number: sku.manufacturer_part_number ?? null,
      storage_gb: sku.storage_gb ?? null,
      ram_gb: sku.ram_gb ?? null,
      color: sku.color ?? null,
      connectivity: sku.connectivity ?? null,
      options_json: sku.options_json
    },
    new_item: true,
    domestic_unit: true,
    unconditional: true,
    available: true,
    storage_authorized: true,
    reuse_basis: `danawa-cli v3.0.0 searchDanawa 모델·옵션·국내 정품 신품 조건 일치 확인 (pcode=${matchResult.productCode})`
  };
}

module.exports = {
  buildCatalogSearchQueries,
  matchDanawaItemToCatalogSku,
  buildSaleObservationForCatalog
};
