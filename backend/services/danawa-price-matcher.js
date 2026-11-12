'use strict';

const pricePreview = require('./smartphone-price-preview');

const MIN_VALID_PHONE_PRICE_KRW = 50000;
const MIN_LAUNCH_RATIO = 0.25;

// Covers all distinct colors in `smartphone_variants` with Korean/English aliases.
// Keys are canonical normalized color keys; aliases are matched longest-first so compound colors
// like "티타늄 제트블랙" or "블루 블랙" never falsely collide with "티타늄 블랙" or "블랙".
const COLOR_ALIAS_DEFINITIONS = Object.freeze([
  // Compound blacks / titaniums / blues first (order is reinforced by length sorting)
  ['티타늄 제트블랙', ['티타늄 제트블랙', '티타늄제트블랙', 'titanium jetblack', 'titanium jet black']],
  ['티타늄 아이시블루', ['티타늄 아이시블루', '티타늄아이시블루', '티타늄 아이스블루', '티타늄아이스블루', 'titanium icyblue', 'titanium silverblue']],
  ['어썸 아이스블루', ['어썸 아이스블루', '어썸아이스블루', 'awesome iceblue', 'awesome ice blue']],
  ['티타늄 바이올렛', ['티타늄 바이올렛', '티타늄바이올렛', 'titanium violet']],
  ['티타늄 옐로우', ['티타늄 옐로우', '티타늄옐로우', '티타늄 옐로', 'titanium yellow']],
  ['티타늄 그레이', ['티타늄 그레이', '티타늄그레이', 'titanium gray', 'titanium grey']],
  ['티타늄 블랙', ['티타늄 블랙', '티타늄블랙', 'titanium black']],
  ['티타늄 실버', ['티타늄 실버', '티타늄실버', 'titanium silver']],
  ['티타늄 블루', ['티타늄 블루', '티타늄블루', 'titanium blue']],
  ['내추럴 티타늄', ['내추럴 티타늄', '내추럴티타늄', 'natural titanium']],
  ['데저트 티타늄', ['데저트 티타늄', '데저트티타늄', 'desert titanium']],
  ['블랙 티타늄', ['블랙 티타늄', '블랙티타늄', 'black titanium']],
  ['화이트 티타늄', ['화이트 티타늄', '화이트티타늄', 'white titanium']],
  ['블루 티타늄', ['블루 티타늄', '블루티타늄', 'blue titanium']],
  ['코발트 바이올렛', ['코발트 바이올렛', '코발트바이올렛', 'cobalt violet']],
  ['크래프티드 블랙', ['크래프티드 블랙', '크래프티드블랙', 'crafted black']],
  ['실버 알루미늄', ['실버 알루미늄', '실버알루미늄', 'silver aluminum']],
  ['클라우드 화이트', ['클라우드 화이트', '클라우드화이트', 'cloud white']],
  ['스페이스 블랙', ['스페이스 블랙', '스페이스블랙', 'space black']],
  ['코스믹 오렌지', ['코스믹 오렌지', '코스믹오렌지', 'cosmic orange']],
  ['나이트 스카이', ['나이트 스카이', '나이트스카이', 'night sky']],
  ['실버 쉐도우', ['실버 쉐도우', '실버쉐도우', '실버 섀도우', '실버섀도우', 'silver shadow']],
  ['블루 쉐도우', ['블루 쉐도우', '블루쉐도우', '블루 섀도우', '블루섀도우', 'blue shadow']],
  ['오닉스 블랙', ['오닉스 블랙', '오닉스블랙', 'onyx black']],
  ['팬텀 블랙', ['팬텀 블랙', '팬텀블랙', 'phantom black']],
  ['블루 블랙', ['블루 블랙', '블루블랙', 'blue black']],
  ['어썸 네이비', ['어썸 네이비', '어썸네이비', 'awesome navy']],
  ['어썸 라벤더', ['어썸 라벤더', '어썸라벤더', 'awesome lavender']],
  ['어썸 라일락', ['어썸 라일락', '어썸라일락', 'awesome lilac']],
  ['어썸 화이트', ['어썸 화이트', '어썸화이트', 'awesome white']],
  ['어썸 블랙', ['어썸 블랙', '어썸블랙', 'awesome black']],
  ['어썸 차콜', ['어썸 차콜', '어썸차콜', 'awesome charcoal']],
  ['마블 그레이', ['마블 그레이', '마블그레이', 'marble gray', 'marble grey']],
  ['앰버 옐로우', ['앰버 옐로우', '앰버옐로우', '앰버 옐로', '앰버옐로', 'amber yellow']],
  ['라이트 블루', ['라이트 블루', '라이트블루', 'light blue']],
  ['라이트 골드', ['라이트 골드', '라이트골드', 'light gold']],
  ['라이트 그린', ['라이트 그린', '라이트그린', 'light green']],
  ['미스트 블루', ['미스트 블루', '미스트블루', 'mist blue']],
  ['스카이 블루', ['스카이 블루', '스카이블루', 'sky blue']],
  ['스타 화이트', ['스타 화이트', '스타화이트', 'star white']],
  ['소프트 핑크', ['소프트 핑크', '소프트핑크', 'soft pink']],
  ['코랄 레드', ['코랄 레드', '코랄레드', 'coral red']],
  ['딥 블루', ['딥 블루', '딥블루', 'deep blue']],
  ['울트라마린', ['울트라마린', '울트라 마린', 'ultramarine']],
  ['아이스블루', ['아이스블루', '아이스 블루', '아이시블루', '아이시 블루', 'ice blue', 'icy blue']],
  ['제트블랙', ['제트블랙', '제트 블랙', 'jet black', 'jetblack']],
  ['그라파이트', ['그라파이트', 'graphite']],
  ['피스타치오', ['피스타치오', 'pistachio']],
  ['블루베리', ['블루베리', 'blueberry']],
  ['글래시어', ['글래시어', 'glacier']],
  ['라벤더', ['라벤더', 'lavender']],
  ['버건디', ['버건디', 'burgundy']],
  ['옐로우', ['옐로우', '옐로', 'yellow']],
  ['화이트', ['화이트', 'white']],
  ['네이비', ['네이비', 'navy']],
  ['그레이', ['그레이', 'gray', 'grey']],
  ['블랙', ['블랙', 'black']],
  ['블루', ['블루', 'blue']],
  ['실버', ['실버', 'silver']],
  ['그린', ['그린', 'green']],
  ['민트', ['민트', 'mint']],
  ['핑크', ['핑크', 'pink']],
  ['세이지', ['세이지', 'sage']],
  ['크림', ['크림', 'cream']],
  ['틸', ['틸', 'teal']],
]);

const ALIAS_LOOKUP = (() => {
  const entries = [];
  for (const [canonical, aliases] of COLOR_ALIAS_DEFINITIONS) {
    for (const alias of aliases) {
      const compact = alias.toLowerCase().replace(/\s+/g, '');
      entries.push({
        canonical,
        aliasLower: alias.toLowerCase(),
        compact,
      });
    }
  }
  entries.sort((a, b) => b.compact.length - a.compact.length || b.aliasLower.length - a.aliasLower.length);
  return entries;
})();

const ACCESSORY_KEYWORDS = [
  '케이스', '젤리케이스', '범퍼케이스', '다이어리케이스', '맥세이프 케이스',
  '보호필름', '강화유리', '액정보호', '카메라렌즈필름', '렌즈보호',
  '충전기', '초고속충전기', '어댑터', '케이블', '거치대', '스탠드',
  '스트랩', '그립톡', '스마트톡', '박스만', '공박스', '빈박스',
  '모형폰', '목업', '더미폰', '부품', '교체용', '배터리팩', '보조배터리',
  '할인권', '교환권',
];

const USED_REFURB_KEYWORDS = [
  '중고', '중고폰', '리퍼', '리퍼비시', '리뉴', '민트급', '특a급', 's급', 'a급', 'b급',
  '전시품', '매장전시', '반품', '박스훼손', '단순개봉', '개봉품', '미개봉아님',
  '가개통', '미사용개통', '개통철회', '렌탈', '대여', '월렌탈', '장기렌탈',
];

const CARRIER_CONTRACT_KEYWORDS = [
  '약정', '24개월', '36개월', '공시지원', '공시지원금', '선택약정', '선약',
  '번호이동', '번이', '기기변경', '기변', '신규가입', '요금제',
  '개통필수', '선개통', '당일개통', '할부원금', '통신사개통', '월납부',
  'skt전용', 'kt전용', 'lgu+전용', 'skt개통', 'kt개통', 'lgu+개통',
  'skt용', 'kt용', 'lgu+용', 'lg u+용',
];

const OVERSEAS_KEYWORDS = [
  '해외판', '해외직구', '직구', '해외구매', '글로벌판', '글로벌버전', 'global',
  '홍콩판', '일본판', '북미판', '미국판', '중국판', '대만판', '유럽판',
  '내수용', '병행수입', '해외언락', '해외용',
];

const CONDITIONAL_DISCOUNT_KEYWORDS = [
  '카드할인', '제휴카드', '청구할인', '카드결제시', '특정카드',
  '멤버십할인', '와우할인', '유니버스클럽', '임직원가', '복지몰',
  '보상판매', '중고보상', '반납조건', '최대혜택가', '체감가', '쿠폰적용가',
];

const OUT_OF_STOCK_KEYWORDS = ['품절', '일시품절', '재고없음', '예약판매', '사전예약'];

const QUALIFIER_TOKENS = [
  { key: 'ultra', pattern: /\b(ultra)\b|울트라/i },
  { key: 'plus', pattern: /\b(plus)\b|플러스|(?<![uU])\+(?=\s|$|[\])(/,가-힣])/i },
  { key: 'max', pattern: /\b(max)\b|맥스/i },
  { key: 'pro', pattern: /\b(pro)\b|프로/i },
  { key: 'fe', pattern: /\bfe\b/i },
  { key: 'edge', pattern: /\b(edge)\b|엣지/i },
  { key: 'mini', pattern: /\b(mini)\b|미니/i },
  { key: 'air', pattern: /\b(air)\b|에어/i },
  { key: 'duo', pattern: /\b(duo)\b|듀오/i },
  { key: 'lite', pattern: /\b(lite)\b|라이트/i },
  { key: 'e_suffix', pattern: /\b(?:16|17|18)e\b/i },
];

const KOREAN_SAMSUNG_MODEL_SUFFIXES = new Set(['N', 'S', 'K', 'L']);

function normalizeText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSamsungModelCodes(text) {
  const results = [];
  const regex = /\bSM-([A-Z]\d{3})([A-Z0-9]*)\b/gi;
  let match;
  while ((match = regex.exec(String(text || ''))) !== null) {
    const full = `SM-${match[1].toUpperCase()}${(match[2] || '').toUpperCase()}`;
    const rest = (match[2] || '').toUpperCase();
    const baseDomestic = rest.length >= 1 ? `SM-${match[1].toUpperCase()}${rest[0]}` : full;
    results.push({ full, base: baseDomestic, suffix: rest[0] || '' });
  }
  return results;
}

function extractAppleModelCodes(text) {
  const results = [];
  const regex = /\bA\d{4}\b/gi;
  let match;
  while ((match = regex.exec(String(text || ''))) !== null) {
    results.push(match[0].toUpperCase());
  }
  return results;
}

function hasDisallowedCarrierSignal(combinedLower) {
  for (const kw of CARRIER_CONTRACT_KEYWORDS) {
    if (combinedLower.includes(kw)) return kw;
  }
  // Strip benign carrier compatibility mentions like "3사 호환", "SKT/KT/LGU+ 호환", "통신3사 사용가능"
  const strippedCompat = combinedLower
    .replace(/(?:skt|kt|lgu\+|lg\s*u\+|유플러스|통신\s*3사|3사)(?:\s*[/,|·]\s*(?:skt|kt|lgu\+|lg\s*u\+|유플러스))*\s*(?:호환|사용\s*가능|지원)/g, ' ');
  const standaloneCarrier = /(?:^|[\s[/,(])(skt|sk텔레콤|lgu\+|lg\s*u\+|lg유플러스|kt)(?=$|[\s\]/),])/i.exec(strippedCompat);
  return standaloneCarrier ? standaloneCarrier[1] : null;
}

function classifyDisqualifiedListing(item = {}, variant = {}) {
  const title = normalizeText(item.productName);
  const category = normalizeText(item.category);
  const conditions = normalizeText(item.conditions_text);
  const combined = `${title} ${category} ${conditions}`.trim();
  const combinedLower = combined.toLowerCase();
  const reasons = [];
  let exclusionCategory = null;

  const addReason = (code, cat) => {
    if (!reasons.includes(code)) reasons.push(code);
    if (!exclusionCategory) exclusionCategory = cat;
  };

  for (const kw of ACCESSORY_KEYWORDS) {
    if (combinedLower.includes(kw)) {
      addReason(`ACCESSORY_KEYWORD:${kw}`, 'accessory');
      break;
    }
  }
  if (category && /케이스|필름|충전기|액세서리|태블릿|스마트워치/.test(category) && !/휴대폰|스마트폰|자급제폰/.test(category)) {
    addReason('NON_HANDSET_CATEGORY', 'accessory');
  }

  if (item.is_new === false) {
    addReason('IS_NEW_FALSE', 'used_or_refurb');
  }
  for (const kw of USED_REFURB_KEYWORDS) {
    if (kw === 'a급' || kw === 'b급' || kw === 's급') {
      const gradeRe = new RegExp(`(^|[\\s[/,(])${escapeRegExp(kw)}($|[\\s\\]/,)])`, 'i');
      if (gradeRe.test(combinedLower)) {
        addReason(`USED_OR_REFURB_KEYWORD:${kw}`, 'used_or_refurb');
        break;
      }
    } else if (combinedLower.includes(kw)) {
      addReason(`USED_OR_REFURB_KEYWORD:${kw}`, 'used_or_refurb');
      break;
    }
  }

  if (item.is_unlocked === false) {
    addReason('IS_UNLOCKED_FALSE', 'carrier_contract');
  }
  const carrierHit = hasDisallowedCarrierSignal(combinedLower);
  if (carrierHit) {
    addReason(`CARRIER_CONTRACT_SIGNAL:${carrierHit}`, 'carrier_contract');
  }

  for (const kw of OVERSEAS_KEYWORDS) {
    if (combinedLower.includes(kw)) {
      addReason(`OVERSEAS_KEYWORD:${kw}`, 'overseas');
      break;
    }
  }

  const samsungCodes = extractSamsungModelCodes(title);
  for (const sc of samsungCodes) {
    if (sc.suffix && !KOREAN_SAMSUNG_MODEL_SUFFIXES.has(sc.suffix)) {
      addReason(`NON_DOMESTIC_SAMSUNG_MODEL:${sc.full}`, 'overseas');
    }
  }

  if (item.unconditional === false) {
    addReason('UNCONDITIONAL_FALSE', 'conditional_discount');
  }
  for (const kw of CONDITIONAL_DISCOUNT_KEYWORDS) {
    if (combinedLower.includes(kw)) {
      addReason(`CONDITIONAL_DISCOUNT_KEYWORD:${kw}`, 'conditional_discount');
      break;
    }
  }

  if (item.in_stock === false) {
    addReason('IN_STOCK_FALSE', 'out_of_stock');
  }
  for (const kw of OUT_OF_STOCK_KEYWORDS) {
    if (combinedLower.includes(kw)) {
      addReason(`OUT_OF_STOCK_KEYWORD:${kw}`, 'out_of_stock');
      break;
    }
  }

  if (item.minPrice == null || !Number.isFinite(Number(item.minPrice)) || Number(item.minPrice) <= 0) {
    addReason('PRICE_MISSING_OR_INVALID', 'invalid_price');
  } else {
    const price = Number(item.minPrice);
    if (price < MIN_VALID_PHONE_PRICE_KRW) {
      addReason('ABNORMAL_LOW_PRICE', 'abnormal_price');
    } else if (variant.launch_price_krw != null && Number(variant.launch_price_krw) > 0) {
      if (price < Number(variant.launch_price_krw) * MIN_LAUNCH_RATIO) {
        addReason('ABNORMAL_BELOW_LAUNCH_RATIO', 'abnormal_price');
      }
    }
  }

  return {
    disqualified: reasons.length > 0,
    exclusionCategory,
    reasons,
  };
}

function canonicalizeModelText(text) {
  return normalizeText(text)
    .replace(/갤럭시/g, 'galaxy')
    .replace(/아이폰/g, 'iphone')
    .replace(/울트라/g, 'ultra')
    .replace(/플러스/g, 'plus')
    .replace(/프로/g, 'pro')
    .replace(/맥스/g, 'max')
    .replace(/플립(?=\d|\b)/g, 'flip')
    .replace(/폴드(?=\d|\b)/g, 'fold')
    .replace(/엣지/g, 'edge')
    .replace(/에어/g, 'air')
    .replace(/듀오/g, 'duo')
    .replace(/퀀텀/g, 'quantum')
    .replace(/버디/g, 'buddy')
    .replace(/(s\d{2})\s*(?<![uU])\+(?=\s|$|[\])(/,가-힣a-zA-Z0-9])/gi, '$1plus')
    .toLowerCase()
    .replace(/[\s/_-]+/g, '');
}

function getActiveQualifiers(text) {
  const active = new Set();
  for (const q of QUALIFIER_TOKENS) {
    if (q.pattern.test(text)) active.add(q.key);
  }
  return active;
}

function verifyBrandAndModelName(title, item, variant) {
  const haystack = `${title} ${normalizeText(item.maker)}`;
  const lower = haystack.toLowerCase();
  const brand = String(variant.brand || '').toLowerCase();

  if (brand === 'samsung') {
    if (/\biphone\b|아이폰|애플|\bapple\b/i.test(title)) {
      return { ok: false, reason: 'BRAND_MISMATCH' };
    }
    if (!/(삼성|samsung|갤럭시|galaxy|\bsm-[a-z]\d{3})/i.test(lower)) {
      return { ok: false, reason: 'BRAND_MISMATCH' };
    }
  } else if (brand === 'apple') {
    if (/(삼성|samsung|갤럭시|galaxy|\bsm-[a-z]\d{3})/i.test(title)) {
      return { ok: false, reason: 'BRAND_MISMATCH' };
    }
    if (!/(애플|apple|아이폰|iphone|\ba\d{4}\b)/i.test(lower)) {
      return { ok: false, reason: 'BRAND_MISMATCH' };
    }
  }

  const canonicalTitle = canonicalizeModelText(title);
  const canonicalModel = canonicalizeModelText(variant.model_name);
  if (!canonicalModel || !canonicalTitle.includes(canonicalModel)) {
    return { ok: false, reason: 'MODEL_NAME_MISMATCH' };
  }

  // Prevent base models from matching Plus/Ultra/Pro Max/FE/e variants and vice versa
  const expectedQualifiers = getActiveQualifiers(variant.model_name);
  const titleQualifiers = getActiveQualifiers(title);
  for (const q of QUALIFIER_TOKENS) {
    if (expectedQualifiers.has(q.key) !== titleQualifiers.has(q.key)) {
      return { ok: false, reason: `MODEL_QUALIFIER_CONFLICT:${q.key}` };
    }
  }

  return { ok: true, reason: null };
}

function verifyDomesticModelNumber(title, variant, options = {}) {
  const expected = normalizeText(variant.domestic_model_number).toUpperCase();
  const requireExplicit = options.requireDomesticModelNumber !== false;
  if (!expected) {
    return requireExplicit
      ? { ok: false, reason: 'VARIANT_MISSING_DOMESTIC_MODEL_NUMBER', matched: false }
      : { ok: true, reason: null, matched: false };
  }

  const brand = String(variant.brand || '').toLowerCase();
  const extractedSamsung = extractSamsungModelCodes(title);
  const extractedApple = extractAppleModelCodes(title);

  if (brand === 'samsung' || expected.startsWith('SM-')) {
    if (extractedSamsung.some(sc => sc.base !== expected)) {
      return { ok: false, reason: 'DOMESTIC_MODEL_NUMBER_MISMATCH', matched: false };
    }
    const matched = extractedSamsung.some(sc => sc.base === expected);
    if (!matched && requireExplicit) {
      return { ok: false, reason: 'DOMESTIC_MODEL_NUMBER_MISSING', matched: false };
    }
    return { ok: true, reason: null, matched };
  }

  if (brand === 'apple' || /^A\d{4}$/.test(expected)) {
    if (extractedApple.some(code => code !== expected)) {
      return { ok: false, reason: 'DOMESTIC_MODEL_NUMBER_MISMATCH', matched: false };
    }
    const matched = extractedApple.includes(expected);
    if (!matched && requireExplicit) {
      return { ok: false, reason: 'DOMESTIC_MODEL_NUMBER_MISSING', matched: false };
    }
    return { ok: true, reason: null, matched };
  }

  const matched = title.toUpperCase().includes(expected);
  if (!matched && requireExplicit) {
    return { ok: false, reason: 'DOMESTIC_MODEL_NUMBER_MISSING', matched: false };
  }
  return { ok: true, reason: null, matched };
}

function extractCapacitiesFromTitle(title) {
  const storageValues = new Set();
  const ramValues = new Set();
  const text = String(title || '');

  // Explicit pair like "12GB/256GB", "12GB 256GB", "16G/1TB"
  const pairRegex = /\b(\d{1,2})\s*g(?:b)?\s*[/+|]\s*(\d+(?:\.\d+)?)\s*(tb|t|gb|g|기가)\b/gi;
  let match;
  while ((match = pairRegex.exec(text)) !== null) {
    const ram = Number(match[1]);
    const unit = match[3].toLowerCase();
    const rawStorage = Number(match[2]);
    const storageGb = (unit === 'tb' || unit === 't') ? Math.round(rawStorage * 1024) : Math.round(rawStorage);
    if (ram >= 2 && ram <= 24) ramValues.add(ram);
    if (storageGb >= 32) storageValues.add(storageGb);
  }

  // Standalone capacity tokens (requires gb/tb/기가 so "5G" is never mistaken for RAM)
  const tokenRegex = /(?:(ram|램)\s*)?(\d+(?:\.\d+)?)\s*(tb|gb|기가)(?![a-z0-9])/gi;
  while ((match = tokenRegex.exec(text)) !== null) {
    const ramPrefix = Boolean(match[1]);
    const num = Number(match[2]);
    const unit = match[3].toLowerCase();
    const gb = unit === 'tb' ? Math.round(num * 1024) : Math.round(num);
    if (ramPrefix || (gb >= 2 && gb <= 24)) {
      ramValues.add(gb);
    } else if (gb >= 32) {
      storageValues.add(gb);
    }
  }

  // Korean shorthand storage tokens like "256G", "512G", "1T" (explicitly excludes 4G/5G)
  const shortStorageRegex = /(?<![a-z0-9])(64|128|256|512)\s*g(?![a-z0-9])|(?<![a-z0-9])([12])\s*t(?![a-z0-9])/gi;
  while ((match = shortStorageRegex.exec(text)) !== null) {
    if (match[1]) storageValues.add(Number(match[1]));
    if (match[2]) storageValues.add(Number(match[2]) * 1024);
  }

  return {
    storageValues: Array.from(storageValues),
    ramValues: Array.from(ramValues),
  };
}

function verifyStorageAndRam(title, variant) {
  const expectedStorage = Number(variant.storage_gb);
  const { storageValues, ramValues } = extractCapacitiesFromTitle(title);

  if (storageValues.length === 0) {
    return { ok: false, reason: 'STORAGE_MISSING' };
  }
  if (storageValues.length > 1 || storageValues[0] !== expectedStorage) {
    return { ok: false, reason: 'STORAGE_MISMATCH', extractedStorage: storageValues };
  }

  const expectedRam = variant.ram_gb != null ? Number(variant.ram_gb) : null;
  if (ramValues.length > 0) {
    if (expectedRam == null) {
      return { ok: false, reason: 'RAM_CONFLICT_DB_NULL', extractedRam: ramValues };
    }
    if (ramValues.length > 1 || ramValues[0] !== expectedRam) {
      return { ok: false, reason: 'RAM_MISMATCH', extractedRam: ramValues };
    }
  }

  return { ok: true, reason: null, extractedStorage: storageValues, extractedRam: ramValues };
}

function extractCanonicalColorsFromTitle(title) {
  let remaining = normalizeText(title).toLowerCase();
  const matched = [];

  for (const entry of ALIAS_LOOKUP) {
    const pattern = new RegExp(escapeRegExp(entry.aliasLower), 'i');
    const compactRemaining = remaining.replace(/\s+/g, '');
    if (pattern.test(remaining) || compactRemaining.includes(entry.compact)) {
      if (!matched.includes(entry.canonical)) {
        matched.push(entry.canonical);
      }
      remaining = remaining
        .replace(new RegExp(escapeRegExp(entry.aliasLower), 'gi'), ' ')
        .replace(new RegExp(escapeRegExp(entry.compact), 'gi'), ' ');
    }
  }
  return matched;
}

function canonicalizeVariantColor(color) {
  const text = normalizeText(color).toLowerCase();
  const compact = text.replace(/\s+/g, '');
  for (const entry of ALIAS_LOOKUP) {
    if (text === entry.aliasLower || compact === entry.compact) {
      return entry.canonical;
    }
  }
  return text;
}

function verifyColor(title, variant) {
  const expectedRaw = normalizeText(variant.color);
  if (!expectedRaw) {
    return { ok: false, reason: 'VARIANT_MISSING_COLOR' };
  }

  const extracted = extractCanonicalColorsFromTitle(title);
  if (extracted.length === 0) {
    return { ok: false, reason: 'COLOR_MISSING', extractedColors: extracted };
  }
  if (extracted.length > 1) {
    return { ok: false, reason: 'COLOR_AMBIGUOUS', extractedColors: extracted };
  }

  const expectedCanonical = canonicalizeVariantColor(expectedRaw);
  const directMatch = extracted[0] === expectedCanonical;
  const previewMatch = pricePreview.colorsStrictlyMatch(extracted[0], expectedRaw);

  if (!directMatch && !previewMatch) {
    return { ok: false, reason: 'COLOR_MISMATCH', extractedColors: extracted };
  }

  return { ok: true, reason: null, extractedColors: extracted };
}

function verifyUnlockedListing(title, item) {
  if (item.is_unlocked === false) {
    return { ok: false, reason: 'IS_UNLOCKED_FALSE' };
  }
  const hasKeyword = /(자급제|공식\s*자급제|unlocked)/i.test(title);
  if (item.is_unlocked !== true && !hasKeyword) {
    return { ok: false, reason: 'UNLOCKED_INDICATOR_MISSING' };
  }
  return { ok: true, reason: null };
}

function matchDanawaItemToVariant(item = {}, variant = {}, options = {}) {
  const title = normalizeText(item.productName);
  const disqualification = classifyDisqualifiedListing(item, variant);
  if (disqualification.disqualified) {
    return {
      matched: false,
      disqualified: true,
      exclusionCategory: disqualification.exclusionCategory,
      reasons: disqualification.reasons,
      item,
    };
  }

  const unlockedCheck = verifyUnlockedListing(title, item);
  if (!unlockedCheck.ok) {
    return {
      matched: false,
      disqualified: true,
      exclusionCategory: 'not_unlocked',
      reasons: [unlockedCheck.reason],
      item,
    };
  }

  const brandAndModel = verifyBrandAndModelName(title, item, variant);
  if (!brandAndModel.ok) {
    return {
      matched: false,
      disqualified: false,
      exclusionCategory: 'model_mismatch',
      reasons: [brandAndModel.reason],
      item,
    };
  }

  const domesticModel = verifyDomesticModelNumber(title, variant, options);
  if (!domesticModel.ok) {
    return {
      matched: false,
      disqualified: domesticModel.reason === 'DOMESTIC_MODEL_NUMBER_MISMATCH',
      exclusionCategory: 'domestic_model_number_mismatch',
      reasons: [domesticModel.reason],
      item,
    };
  }

  const capacityCheck = verifyStorageAndRam(title, variant);
  if (!capacityCheck.ok) {
    return {
      matched: false,
      disqualified: false,
      exclusionCategory: 'capacity_mismatch',
      reasons: [capacityCheck.reason],
      item,
    };
  }

  const colorCheck = verifyColor(title, variant);
  if (!colorCheck.ok) {
    return {
      matched: false,
      disqualified: false,
      exclusionCategory: 'color_mismatch',
      reasons: [colorCheck.reason],
      item,
    };
  }

  return {
    matched: true,
    disqualified: false,
    exclusionCategory: null,
    reasons: [],
    matchDetails: {
      domesticModelNumberMatched: domesticModel.matched,
      storageGb: capacityCheck.extractedStorage[0],
      ramGb: capacityCheck.extractedRam.length === 1 ? capacityCheck.extractedRam[0] : null,
      color: colorCheck.extractedColors[0],
      unlockedConfirmed: true,
    },
    item,
  };
}

function evaluateVariantCandidates(items = [], variant = {}, options = {}) {
  const matched = [];
  const rejected = [];

  for (const item of items) {
    const result = matchDanawaItemToVariant(item, variant, options);
    if (result.matched) {
      matched.push(result);
    } else {
      rejected.push(result);
    }
  }

  matched.sort((a, b) => Number(a.item.minPrice) - Number(b.item.minPrice));
  return {
    variant,
    matched,
    rejected,
    bestMatch: matched[0] || null,
  };
}

module.exports = {
  MIN_VALID_PHONE_PRICE_KRW,
  MIN_LAUNCH_RATIO,
  COLOR_ALIAS_DEFINITIONS,
  extractSamsungModelCodes,
  extractAppleModelCodes,
  extractCapacitiesFromTitle,
  extractCanonicalColorsFromTitle,
  canonicalizeVariantColor,
  classifyDisqualifiedListing,
  matchDanawaItemToVariant,
  evaluateVariantCandidates,
};
