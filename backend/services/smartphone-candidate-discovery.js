'use strict';

const catalog = require('./smartphone-catalog');
const danawaAdapter = require('./danawa-price-adapter');
const danawaMatcher = require('./danawa-price-matcher');

const DEFAULT_CHECKED_AT = '2026-11-12';
const TARGET_BRANDS = new Set(['samsung', 'apple']);
const VALID_OS_VALUES = new Set(['android', 'ios', 'other']);

const CLASSIFICATIONS = Object.freeze({
  NEW_MODEL: 'NEW_MODEL',
  NEW_VARIANT: 'NEW_VARIANT',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  EXCLUDED: 'EXCLUDED',
});

// Model-agnostic + model-specific color aliases extending danawaMatcher.canonicalizeVariantColor
// without duplicating its core alias table.
const EXTRA_COLOR_ALIASES = Object.freeze({
  'black shadow': '블랙 쉐도우',
  '블랙쉐도우': '블랙 쉐도우',
  'light gray': '라이트 그레이',
  '라이트그레이': '라이트 그레이',
  '어썸 라이트그레이': '어썸 라이트그레이',
  'awesome light gray': '어썸 라이트그레이',
  'awesome lightgray': '어썸 라이트그레이',
  '어썸 그래파이트': '어썸 그래파이트',
  'awesome graphite': '어썸 그래파이트',
  'awesome gray': '어썸 그레이',
  '어썸그레이': '어썸 그레이',
  '크래프트 블랙': '크래프티드 블랙',
  '크래프트블랙': '크래프티드 블랙',
  'thunder black': '썬더 블랙',
  '썬더블랙': '썬더 블랙',
  'mint green': '민트 그린',
  '민트그린': '민트 그린',
  'blush pink': '블러쉬 핑크',
  '블러쉬핑크': '블러쉬 핑크',
  'peach': '피치',
  'gold': '골드',
  'cream': '크림',
  'pink gold': '핑크 골드',
  '핑크골드': '핑크 골드',
  'jade green': '제이드 그린',
  '제이드그린': '제이드 그린',
  'sapphire blue': '사파이어 블루',
  '사파이어블루': '사파이어 블루',
  'sandstone orange': '샌드스톤 오렌지',
  '샌드스톤오렌지': '샌드스톤 오렌지',
  'titanium green': '티타늄 그린',
  '티타늄그린': '티타늄 그린',
  'titanium orange': '티타늄 오렌지',
  '티타늄오렌지': '티타늄 오렌지',
  'titanium silverblue': '티타늄 블루',
  '티타늄 실버블루': '티타늄 블루',
  '티타늄실버블루': '티타늄 블루',
  'titanium whitesilver': '티타늄 실버',
  '티타늄 화이트실버': '티타늄 실버',
  '티타늄화이트실버': '티타늄 실버',
  'titanium jade green': '티타늄 제이드그린',
  '티타늄제이드그린': '티타늄 제이드그린',
  '티타늄 제이드 그린': '티타늄 제이드그린',
  'titanium pink gold': '티타늄 핑크골드',
  '티타늄핑크골드': '티타늄 핑크골드',
  '티타늄 핑크 골드': '티타늄 핑크골드',
  'violet shadow': '바이올렛 쉐도우',
  '바이올렛쉐도우': '바이올렛 쉐도우',
  'green shadow': '그린 쉐도우',
  '그린쉐도우': '그린 쉐도우',
  'dark blue': '다크 블루',
  '다크블루': '다크 블루',
  'haze orange': '헤이즈 오렌지',
  '헤이즈오렌지': '헤이즈 오렌지',
});

function normalizeBrand(brand) {
  const raw = danawaAdapter.cleanProductText(brand).toLowerCase();
  if (!raw) return '';
  if (raw === '삼성' || raw === '삼성전자' || raw.includes('samsung')) return 'samsung';
  if (raw === '애플' || raw.includes('apple')) return 'apple';
  return raw;
}

function normalizeDomesticModelNumber(code, brand = '') {
  const raw = danawaAdapter.cleanProductText(code).toUpperCase().replace(/\s+/g, '');
  if (!raw) return null;

  const samsungMatch = raw.match(/^(SM-[A-Z]\d{3}[A-Z0-9])/);
  if (samsungMatch) {
    return samsungMatch[1];
  }

  const normalizedBrand = normalizeBrand(brand);
  if (normalizedBrand === 'samsung') {
    const extracted = danawaMatcher.extractSamsungModelCodes(raw);
    if (extracted.length > 0) {
      const first = extracted[0];
      return typeof first === 'string' ? first : (first?.full || first?.base || null);
    }
  }

  const appleMatch = raw.match(/^(A\d{4})$/);
  if (appleMatch) {
    return appleMatch[1];
  }
  if (normalizedBrand === 'apple') {
    const extracted = danawaMatcher.extractAppleModelCodes(raw);
    if (extracted.length > 0) {
      const first = extracted[0];
      return typeof first === 'string' ? first : (first?.full || first?.base || null);
    }
  }

  return raw;
}

function normalizeModelName(modelName) {
  let text = danawaAdapter.cleanProductText(modelName).toLowerCase();
  if (!text) return '';
  text = text
    .replace(/\((?:자급제|skt|kt|lgu\+|lg u\+|공시|약정|새상품|미개봉)\)/gi, ' ')
    .replace(/\+/g, ' plus ')
    .replace(/프로\s*맥스/g, 'pro max')
    .replace(/스페셜\s*에디션/g, 'special edition')
    .replace(/트라이폴드/g, 'trifold')
    .replace(/퀀텀/g, 'quantum')
    .replace(/와이드/g, 'wide')
    .replace(/버디/g, 'buddy')
    .replace(/점프/g, 'jump')
    .replace(/갤럭시/g, 'galaxy')
    .replace(/아이폰/g, 'iphone')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

function normalizeColorForDedupe(color, context = {}) {
  const cleaned = danawaAdapter.cleanProductText(color);
  if (!cleaned) return '';

  const lower = cleaned.toLowerCase();
  const compact = lower.replace(/\s+/g, '');

  const modelLower = normalizeModelName(context.modelName || context.model_name || '');
  // Apple iPhone 17 Pro / Pro Max uses '실버 알루미늄' in DB and 'Silver' in Apple Newsroom.
  if (
    (modelLower.includes('iphone 17 pro')) &&
    (compact === 'silver' || compact === '실버' || compact === 'silveraluminum' || compact === '실버알루미늄')
  ) {
    return '실버 알루미늄';
  }

  if (EXTRA_COLOR_ALIASES[lower]) return EXTRA_COLOR_ALIASES[lower];
  if (EXTRA_COLOR_ALIASES[compact]) return EXTRA_COLOR_ALIASES[compact];

  return danawaMatcher.canonicalizeVariantColor(cleaned);
}

function parsePositiveIntOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const tbMatch = value.trim().match(/^(\d+(?:\.\d+)?)\s*tb$/i);
    if (tbMatch) return Math.round(Number(tbMatch[1]) * 1024);
    const gbMatch = value.trim().match(/^(\d+(?:\.\d+)?)\s*gb?$/i);
    if (gbMatch) return Math.round(Number(gbMatch[1]));
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num);
}

function parsePositiveNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

function normalizeBooleanOrNull(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return null;
}

function normalizeOs(os) {
  const raw = danawaAdapter.cleanProductText(os).toLowerCase();
  if (!raw) return null;
  if (raw.includes('android') || raw.includes('안드로이드')) return 'android';
  if (raw === 'ios' || raw.includes('iphone os')) return 'ios';
  if (VALID_OS_VALUES.has(raw)) return raw;
  return null;
}

function normalizeIsoDateOrNull(dateValue) {
  if (!dateValue) return null;
  const str = String(dateValue).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const d = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.toISOString().slice(0, 10) !== str) return null;
  return str;
}

function ramIdentityGb(ramGb) {
  const parsed = parsePositiveIntOrNull(ramGb);
  return parsed === null ? 0 : parsed;
}

function isDanawaProhibitedUrl(url) {
  const raw = String(url || '');
  if (!raw) return false;
  if (/prod\.danawa\.com\/(?:info\/ajax|api)/i.test(raw)) return true;
  if (/danawa\.com/i.test(raw)) return true;
  return false;
}

function computeReleaseWindow(referenceDateKst = DEFAULT_CHECKED_AT) {
  const normalizedRef = normalizeIsoDateOrNull(referenceDateKst) || DEFAULT_CHECKED_AT;
  const refDateObj = new Date(`${normalizedRef}T12:00:00+09:00`);
  const window = catalog.releaseWindowKst(refDateObj);
  return {
    referenceDateKst: normalizedRef,
    minDate: window.minDate,
    maxDate: window.maxDate,
  };
}

function buildVariantExactKey(smartphoneId, storageGb, ramGb, canonicalColor) {
  return `${smartphoneId}|${storageGb}|${ramIdentityGb(ramGb)}|${canonicalColor}`;
}

function buildVariantColorStorageKey(smartphoneId, storageGb, canonicalColor) {
  return `${smartphoneId}|${storageGb}|${canonicalColor}`;
}

function buildInventoryIndex(models = [], variants = []) {
  const byId = new Map();
  const byDomesticModel = new Map();
  const byBrandModelName = new Map();
  const variantsByExactKey = new Map();
  const variantsByStorageColorKey = new Map();
  const variantsByPhoneId = new Map();

  for (const model of models) {
    const id = Number(model.id);
    const brand = normalizeBrand(model.brand);
    const domesticModelNumber = normalizeDomesticModelNumber(model.domestic_model_number, brand);
    const normalizedName = normalizeModelName(model.model_name);

    const indexed = {
      ...model,
      id,
      brand,
      domestic_model_number: domesticModelNumber,
      normalized_model_name: normalizedName,
    };

    byId.set(id, indexed);
    if (domesticModelNumber) {
      byDomesticModel.set(`${brand}|${domesticModelNumber}`, indexed);
      byDomesticModel.set(domesticModelNumber, indexed);
    }
    if (brand && normalizedName) {
      byBrandModelName.set(`${brand}|${normalizedName}`, indexed);
    }
  }

  for (const variant of variants) {
    const smartphoneId = Number(variant.smartphone_id);
    const parent = byId.get(smartphoneId) || null;
    const storageGb = parsePositiveIntOrNull(variant.storage_gb);
    const ramGb = parsePositiveIntOrNull(variant.ram_gb);
    const canonicalColor = normalizeColorForDedupe(variant.color, {
      brand: parent ? parent.brand : '',
      modelName: parent ? parent.model_name : '',
    });

    const indexedVariant = {
      ...variant,
      id: Number(variant.id),
      smartphone_id: smartphoneId,
      storage_gb: storageGb,
      ram_gb: ramGb,
      canonical_color: canonicalColor,
    };

    if (!variantsByPhoneId.has(smartphoneId)) {
      variantsByPhoneId.set(smartphoneId, []);
    }
    variantsByPhoneId.get(smartphoneId).push(indexedVariant);

    if (storageGb && canonicalColor) {
      const exactKey = buildVariantExactKey(smartphoneId, storageGb, ramGb, canonicalColor);
      variantsByExactKey.set(exactKey, indexedVariant);

      const scKey = buildVariantColorStorageKey(smartphoneId, storageGb, canonicalColor);
      if (!variantsByStorageColorKey.has(scKey)) {
        variantsByStorageColorKey.set(scKey, []);
      }
      variantsByStorageColorKey.get(scKey).push(indexedVariant);
    }
  }

  return {
    models,
    variants,
    byId,
    byDomesticModel,
    byBrandModelName,
    variantsByExactKey,
    variantsByStorageColorKey,
    variantsByPhoneId,
  };
}

async function loadExistingInventoryFromDb(db) {
  // Explicitly read-only SELECT queries across ALL review_status values (legacy, approved, pending, held, rejected).
  const [models] = await db.query(
    `SELECT id, brand, model_name, domestic_model_number, released_on_kr, os, chipset,
            screen_inches, refresh_hz, battery_mah, weight_g, supports_5g, wireless_charging,
            source_name, source_url, official_product_url, verified, is_test, review_status
       FROM smartphones
      ORDER BY id ASC`
  );
  const [variants] = await db.query(
    `SELECT id, smartphone_id, storage_gb, ram_gb, ram_identity_gb, color,
            launch_price_krw, source_name, source_url, verified, review_status
       FROM smartphone_variants
      ORDER BY smartphone_id ASC, id ASC`
  );
  return {
    models,
    variants,
    index: buildInventoryIndex(models, variants),
  };
}

function findMatchingExistingModel(candidate, index) {
  const brand = normalizeBrand(candidate.brand);
  const dmn = normalizeDomesticModelNumber(candidate.domestic_model_number, brand);
  const normName = normalizeModelName(candidate.model_name);

  if (dmn && index.byDomesticModel.has(`${brand}|${dmn}`)) {
    const matched = index.byDomesticModel.get(`${brand}|${dmn}`);
    return {
      matched,
      basis: 'brand+domestic_model_number',
      matchedKey: `${brand}|${dmn}`,
    };
  }

  if (brand && normName && index.byBrandModelName.has(`${brand}|${normName}`)) {
    const matched = index.byBrandModelName.get(`${brand}|${normName}`);
    return {
      matched,
      basis: 'brand+normalized_model_name',
      matchedKey: `${brand}|${normName}`,
    };
  }

  return null;
}

function findMatchingExistingVariant(smartphoneId, option, index, parentContext = {}) {
  const storageGb = parsePositiveIntOrNull(option.storage_gb);
  const ramGb = parsePositiveIntOrNull(option.ram_gb);
  const canonicalColor = normalizeColorForDedupe(option.color, parentContext);

  if (!storageGb || !canonicalColor) {
    return null;
  }

  const exactKey = buildVariantExactKey(smartphoneId, storageGb, ramGb, canonicalColor);
  if (index.variantsByExactKey.has(exactKey)) {
    return {
      matched: index.variantsByExactKey.get(exactKey),
      matchType: 'exact_storage_ram_color',
      dedupeKey: exactKey,
      canonicalColor,
    };
  }

  const scKey = buildVariantColorStorageKey(smartphoneId, storageGb, canonicalColor);
  const sameStorageColor = index.variantsByStorageColorKey.get(scKey) || [];
  // Many legacy rows in smartphone_variants have ram_gb = NULL (ram_identity_gb = 0).
  // Match them carefully when checking if the official option already exists in DB.
  const nullRamMatch = sameStorageColor.find((v) => v.ram_gb === null);
  if (nullRamMatch) {
    return {
      matched: nullRamMatch,
      matchType: 'storage_color_with_existing_null_ram',
      dedupeKey: scKey,
      canonicalColor,
    };
  }

  return null;
}

function normalizeRawVariantOption(rawOption, parentContext = {}) {
  const storageGb = parsePositiveIntOrNull(rawOption.storage_gb);
  const ramGb = parsePositiveIntOrNull(rawOption.ram_gb);
  const rawColor = danawaAdapter.cleanProductText(rawOption.color);
  const canonicalColor = normalizeColorForDedupe(rawColor, parentContext);
  const launchPriceKrw = parsePositiveIntOrNull(rawOption.launch_price_krw);
  const sourceUrl = danawaAdapter.safeHttpUrl(rawOption.source_url || parentContext.source_url);

  return {
    storage_gb: storageGb,
    ram_gb: ramGb,
    ram_identity_gb: ramIdentityGb(ramGb),
    color: canonicalColor || rawColor || null,
    raw_color: rawColor || null,
    launch_price_krw: launchPriceKrw,
    official_option_verified: rawOption.official_option_verified !== false,
    sku_example: danawaAdapter.cleanProductText(rawOption.sku_example) || null,
    channel: danawaAdapter.cleanProductText(rawOption.channel) || 'standard',
    source_name: danawaAdapter.cleanProductText(rawOption.source_name || parentContext.source_name) || null,
    source_url: sourceUrl,
    notes: danawaAdapter.cleanProductText(rawOption.notes) || null,
  };
}

function inspectRequiredModelFields(model) {
  const missing = [];
  if (!model.domestic_model_number) missing.push('domestic_model_number');
  if (!model.released_on_kr) missing.push('released_on_kr');
  if (!model.os || !VALID_OS_VALUES.has(model.os)) missing.push('os');
  if (!model.chipset) missing.push('chipset');
  if (!model.screen_inches) missing.push('screen_inches');
  if (!model.refresh_hz) missing.push('refresh_hz');
  if (!model.battery_mah) missing.push('battery_mah');
  if (!model.weight_g) missing.push('weight_g');
  if (!model.source_url) missing.push('source_url');
  return missing;
}

function evaluateCheckConstraintReadiness(payload, kind = 'model') {
  if (kind === 'model') {
    const approvalBlockers = [];
    if (!payload.source_name) approvalBlockers.push('source_name');
    if (!payload.source_url) approvalBlockers.push('source_url');
    if (!payload.domestic_model_number) approvalBlockers.push('domestic_model_number');
    if (!payload.released_on_kr) approvalBlockers.push('released_on_kr');
    if (!payload.os || !VALID_OS_VALUES.has(payload.os)) approvalBlockers.push('os');
    return {
      insert_as_pending_ready: Boolean(payload.brand && payload.model_name),
      admin_approval_ready: approvalBlockers.length === 0,
      approval_blockers: approvalBlockers,
    };
  }

  const approvalBlockers = [];
  if (!payload.storage_gb || payload.storage_gb <= 0) approvalBlockers.push('storage_gb');
  if (!payload.color) approvalBlockers.push('color');
  if (!payload.source_name) approvalBlockers.push('source_name');
  if (!payload.source_url) approvalBlockers.push('source_url');
  return {
    insert_as_pending_ready: Boolean(payload.storage_gb > 0 && payload.color),
    admin_approval_ready: approvalBlockers.length === 0,
    approval_blockers: approvalBlockers,
  };
}

function buildPhase3ModelPayload(normalizedModel, checkedAt) {
  const insertPayload = {
    brand: normalizedModel.brand,
    model_name: normalizedModel.model_name,
    domestic_model_number: normalizedModel.domestic_model_number,
    released_on_kr: normalizedModel.released_on_kr,
    os: normalizedModel.os,
    chipset: normalizedModel.chipset,
    screen_inches: normalizedModel.screen_inches,
    refresh_hz: normalizedModel.refresh_hz,
    battery_mah: normalizedModel.battery_mah,
    weight_g: normalizedModel.weight_g,
    supports_5g: normalizedModel.supports_5g,
    wireless_charging: normalizedModel.wireless_charging,
    source_name: normalizedModel.source_name,
    source_url: normalizedModel.source_url,
    official_product_url: normalizedModel.official_product_url || normalizedModel.source_url,
    verified_at: null,
    verified: false,
    is_test: false,
    review_status: 'pending',
    details_json: normalizedModel.details_json || null,
    review_metadata_json: {
      discovery_phase: 'phase_2',
      checked_at: checkedAt,
      source_kind: normalizedModel.source_kind,
      source_url: normalizedModel.source_url,
      requires_admin_approval: true,
    },
  };

  return {
    insertPayload,
    readiness: evaluateCheckConstraintReadiness(insertPayload, 'model'),
  };
}

function buildPhase3VariantPayload(targetSmartphoneId, normalizedVariant, checkedAt) {
  const insertPayload = {
    smartphone_id: targetSmartphoneId || null,
    storage_gb: normalizedVariant.storage_gb,
    ram_gb: normalizedVariant.ram_gb,
    color: normalizedVariant.color,
    launch_price_krw: normalizedVariant.launch_price_krw,
    launch_price_metadata_json: normalizedVariant.launch_price_krw
      ? {
          currency: 'KRW',
          price_type: 'official_kr_launch',
          source_url: normalizedVariant.source_url,
          checked_at: checkedAt,
        }
      : null,
    source_name: normalizedVariant.source_name,
    source_url: normalizedVariant.source_url,
    verified_at: null,
    verified: false,
    review_status: 'pending',
    review_metadata_json: {
      discovery_phase: 'phase_2',
      checked_at: checkedAt,
      channel: normalizedVariant.channel,
      sku_example: normalizedVariant.sku_example,
      requires_admin_approval: true,
    },
  };

  return {
    insertPayload,
    readiness: evaluateCheckConstraintReadiness(insertPayload, 'variant'),
  };
}

function evaluateCandidateRecord(rawRecord, index, options = {}) {
  const checkedAt = options.checkedAt || DEFAULT_CHECKED_AT;
  const window = computeReleaseWindow(options.referenceDateKst || checkedAt);

  const brand = normalizeBrand(rawRecord.brand);
  const modelName = danawaAdapter.cleanProductText(rawRecord.model_name);
  const domesticModelNumber = normalizeDomesticModelNumber(rawRecord.domestic_model_number, brand);
  const releasedOnKr = normalizeIsoDateOrNull(rawRecord.released_on_kr);
  const sourceUrl = danawaAdapter.safeHttpUrl(rawRecord.source_url);
  const officialProductUrl = danawaAdapter.safeHttpUrl(rawRecord.official_product_url) || sourceUrl;
  const sourceKind = danawaAdapter.cleanProductText(rawRecord.source_kind) || 'unknown';
  const sourceName = danawaAdapter.cleanProductText(rawRecord.source_name) || null;
  const releaseDateSourceType = danawaAdapter.cleanProductText(rawRecord.release_date_source_type) || 'manufacturer_official';

  const normalizedModel = {
    brand,
    model_name: modelName,
    domestic_model_number: domesticModelNumber,
    released_on_kr: releasedOnKr,
    os: normalizeOs(rawRecord.os),
    chipset: danawaAdapter.cleanProductText(rawRecord.chipset) || null,
    screen_inches: parsePositiveNumberOrNull(rawRecord.screen_inches),
    refresh_hz: parsePositiveIntOrNull(rawRecord.refresh_hz),
    battery_mah: parsePositiveIntOrNull(rawRecord.battery_mah),
    weight_g: parsePositiveNumberOrNull(rawRecord.weight_g),
    supports_5g: normalizeBooleanOrNull(rawRecord.supports_5g),
    wireless_charging: normalizeBooleanOrNull(rawRecord.wireless_charging),
    source_name: sourceName,
    source_url: sourceUrl,
    official_product_url: officialProductUrl,
    source_kind: sourceKind,
    details_json: rawRecord.details_json && typeof rawRecord.details_json === 'object' ? rawRecord.details_json : null,
  };

  const baseAudit = {
    source_url: sourceUrl,
    source_kind: sourceKind,
    checked_at: checkedAt,
    dedupe_basis: null,
    review_reason: null,
  };

  // 1. Scope exclusions (brand, overseas-only, out of 3-year window, unreleased)
  if (!TARGET_BRANDS.has(brand)) {
    return {
      modelClassification: CLASSIFICATIONS.EXCLUDED,
      reasonCode: 'NON_TARGET_BRAND',
      normalizedModel,
      variantEvaluations: [],
      audit: {
        ...baseAudit,
        review_reason: `Excluded non-target brand: ${brand || 'unknown'}`,
      },
    };
  }

  if (rawRecord.kr_released === false || rawRecord.market_scope === 'overseas_only') {
    return {
      modelClassification: CLASSIFICATIONS.EXCLUDED,
      reasonCode: rawRecord.exclusion_reason_code || 'NO_OFFICIAL_KR_RELEASE',
      normalizedModel,
      variantEvaluations: [],
      audit: {
        ...baseAudit,
        review_reason: rawRecord.review_reason || 'No official South Korea consumer release confirmed.',
      },
    };
  }

  if (rawRecord.release_status === 'unreleased' || (releasedOnKr && releasedOnKr > window.maxDate)) {
    return {
      modelClassification: CLASSIFICATIONS.EXCLUDED,
      reasonCode: 'NOT_YET_RELEASED_AS_OF_CHECK_DATE',
      normalizedModel,
      variantEvaluations: [],
      audit: {
        ...baseAudit,
        review_reason: `Not officially released in KR as of ${window.maxDate}.`,
      },
    };
  }

  if (releasedOnKr && releasedOnKr < window.minDate) {
    return {
      modelClassification: CLASSIFICATIONS.EXCLUDED,
      reasonCode: 'OUTSIDE_3_YEAR_WINDOW',
      normalizedModel,
      variantEvaluations: [],
      audit: {
        ...baseAudit,
        review_reason: `KR release date ${releasedOnKr} is older than 3-year cutoff ${window.minDate}.`,
      },
    };
  }

  // 2. Danawa listing dates must NEVER be treated as official KR launch dates.
  const rawOptions = Array.isArray(rawRecord.options) ? rawRecord.options : [];
  const normalizedOptions = rawOptions.map((opt) =>
    normalizeRawVariantOption(opt, {
      brand,
      modelName,
      source_url: sourceUrl,
      source_name: sourceName,
    })
  );

  const existingMatch = findMatchingExistingModel(normalizedModel, index);

  if (existingMatch) {
    const matchedDbModel = existingMatch.matched;
    const dedupeBasis = {
      matched_smartphone_id: matchedDbModel.id,
      matched_model_name: matchedDbModel.model_name,
      matched_domestic_model_number: matchedDbModel.domestic_model_number,
      matched_review_status: matchedDbModel.review_status,
      matched_verified: Boolean(matchedDbModel.verified),
      match_strategy: existingMatch.basis,
    };

    const variantEvaluations = normalizedOptions.map((opt) => {
      if (!opt.storage_gb || !opt.color || opt.official_option_verified === false || isDanawaProhibitedUrl(opt.source_url)) {
        return {
          classification: CLASSIFICATIONS.REVIEW_REQUIRED,
          reasonCode: isDanawaProhibitedUrl(opt.source_url)
            ? 'SECONDARY_SOURCE_OPTION_REQUIRES_OFFICIAL_CHECK'
            : 'OPTION_SPEC_OR_OFFICIAL_CONFIRMATION_MISSING',
          option: opt,
          target_smartphone_id: matchedDbModel.id,
          target_model_name: matchedDbModel.model_name,
          target_domestic_model_number: matchedDbModel.domestic_model_number,
          target_parent_review_status: matchedDbModel.review_status,
          audit: {
            source_url: opt.source_url || sourceUrl,
            source_kind: sourceKind,
            checked_at: checkedAt,
            dedupe_basis: dedupeBasis,
            review_reason: opt.notes || 'Storage, color, or official source confirmation missing; do not guess.',
          },
        };
      }

      const existingVariantMatch = findMatchingExistingVariant(matchedDbModel.id, opt, index, {
        brand: matchedDbModel.brand,
        modelName: matchedDbModel.model_name,
      });

      if (existingVariantMatch) {
        return {
          classification: CLASSIFICATIONS.ALREADY_EXISTS,
          reasonCode: existingVariantMatch.matchType === 'storage_color_with_existing_null_ram'
            ? 'ALREADY_EXISTS_WITH_LEGACY_NULL_RAM'
            : 'ALREADY_EXISTS_EXACT',
          option: opt,
          target_smartphone_id: matchedDbModel.id,
          target_model_name: matchedDbModel.model_name,
          target_domestic_model_number: matchedDbModel.domestic_model_number,
          target_parent_review_status: matchedDbModel.review_status,
          matched_variant_id: existingVariantMatch.matched.id,
          matched_variant_review_status: existingVariantMatch.matched.review_status,
          audit: {
            source_url: opt.source_url || sourceUrl,
            source_kind: sourceKind,
            checked_at: checkedAt,
            dedupe_basis: {
              ...dedupeBasis,
              matched_variant_id: existingVariantMatch.matched.id,
              matched_variant_review_status: existingVariantMatch.matched.review_status,
              variant_match_type: existingVariantMatch.matchType,
              dedupe_key: existingVariantMatch.dedupeKey,
            },
            review_reason: `Variant already exists in smartphone_variants (id=${existingVariantMatch.matched.id}, status=${existingVariantMatch.matched.review_status}).`,
          },
        };
      }

      const phase3Variant = buildPhase3VariantPayload(matchedDbModel.id, opt, checkedAt);
      return {
        classification: CLASSIFICATIONS.NEW_VARIANT,
        reasonCode: 'MISSING_OFFICIAL_OPTION_ON_EXISTING_MODEL',
        option: opt,
        target_smartphone_id: matchedDbModel.id,
        target_model_name: matchedDbModel.model_name,
        target_domestic_model_number: matchedDbModel.domestic_model_number,
        target_parent_review_status: matchedDbModel.review_status,
        sql_target_table: 'smartphone_variants',
        smartphone_variants_insert_payload: phase3Variant.insertPayload,
        check_constraint_readiness: phase3Variant.readiness,
        audit: {
          source_url: opt.source_url || sourceUrl,
          source_kind: sourceKind,
          checked_at: checkedAt,
          dedupe_basis: {
            ...dedupeBasis,
            checked_existing_variants_count: (index.variantsByPhoneId.get(matchedDbModel.id) || []).length,
            proposed_dedupe_key: buildVariantExactKey(matchedDbModel.id, opt.storage_gb, opt.ram_gb, opt.color),
          },
          review_reason: opt.notes || `Official ${matchedDbModel.model_name} option (${opt.storage_gb}GB / ${opt.ram_gb ?? 'null'}GB / ${opt.color}) missing from smartphone_variants.`,
        },
      };
    });

    return {
      modelClassification: CLASSIFICATIONS.ALREADY_EXISTS,
      reasonCode: 'EXISTING_MODEL_IN_DB',
      normalizedModel,
      matchedDbModel,
      variantEvaluations,
      audit: {
        ...baseAudit,
        dedupe_basis: dedupeBasis,
        review_reason: `Model already present in smartphones (id=${matchedDbModel.id}, status=${matchedDbModel.review_status}).`,
      },
    };
  }

  // 3. New model not in smartphones yet: verify launch date & required official specs strictly.
  if (releaseDateSourceType === 'danawa_listing' || isDanawaProhibitedUrl(sourceUrl) || !releasedOnKr) {
    return {
      modelClassification: CLASSIFICATIONS.REVIEW_REQUIRED,
      reasonCode: releaseDateSourceType === 'danawa_listing'
        ? 'DANAWA_LISTING_DATE_NOT_OFFICIAL_LAUNCH_DATE'
        : 'MISSING_OFFICIAL_KR_RELEASE_DATE',
      normalizedModel,
      missingFields: inspectRequiredModelFields(normalizedModel),
      variantEvaluations: [],
      audit: {
        ...baseAudit,
        dedupe_basis: { match_strategy: 'not_found_in_smartphones', checked_models_count: index.models.length },
        review_reason: rawRecord.review_reason || 'Official Korea release date missing or only secondary listing date available.',
      },
    };
  }

  const missingFields = inspectRequiredModelFields(normalizedModel);
  const validOptions = normalizedOptions.filter((opt) => opt.storage_gb && opt.color && opt.official_option_verified);

  if (
    rawRecord.official_spec_verified === false ||
    missingFields.length > 0 ||
    validOptions.length === 0
  ) {
    const missing = [...missingFields];
    if (validOptions.length === 0) missing.push('confirmed_storage_color_options');
    return {
      modelClassification: CLASSIFICATIONS.REVIEW_REQUIRED,
      reasonCode: 'MISSING_OFFICIAL_SPECS_OR_OPTIONS',
      normalizedModel,
      missingFields: missing,
      partialVariants: normalizedOptions,
      variantEvaluations: [],
      audit: {
        ...baseAudit,
        dedupe_basis: { match_strategy: 'not_found_in_smartphones', checked_models_count: index.models.length },
        review_reason: rawRecord.review_reason || `Official verification incomplete (${missing.join(', ')}); unknown fields preserved as null.`,
      },
    };
  }

  const phase3Model = buildPhase3ModelPayload(normalizedModel, checkedAt);
  const phase3Variants = validOptions.map((opt) => buildPhase3VariantPayload(null, opt, checkedAt));

  return {
    modelClassification: CLASSIFICATIONS.NEW_MODEL,
    reasonCode: 'VERIFIED_OFFICIAL_NEW_MODEL',
    normalizedModel,
    sql_target_table: 'smartphones',
    smartphones_insert_payload: phase3Model.insertPayload,
    smartphone_variants_insert_payloads: phase3Variants.map((v) => v.insertPayload),
    check_constraint_readiness: {
      model: phase3Model.readiness,
      variants: phase3Variants.map((v) => v.readiness),
    },
    variantEvaluations: validOptions.map((opt, idx) => ({
      classification: CLASSIFICATIONS.NEW_MODEL,
      option: opt,
      smartphone_variants_insert_payload: phase3Variants[idx].insertPayload,
    })),
    audit: {
      ...baseAudit,
      dedupe_basis: {
        match_strategy: 'not_found_in_smartphones',
        checked_domestic_model_number: domesticModelNumber,
        checked_normalized_model_name: normalizeModelName(modelName),
        checked_existing_models_count: index.models.length,
      },
      review_reason: `Confirmed official KR launch (${releasedOnKr}) missing from smartphones; ready for admin Phase 3 review.`,
    },
  };
}

async function enrichCandidateWithDanawaSecondary(candidateResult, danawaAdapterInstance) {
  if (!danawaAdapterInstance || typeof danawaAdapterInstance.search !== 'function') {
    return null;
  }
  const model = candidateResult.normalizedModel;
  const queries = danawaAdapter.buildVariantSearchQueries({
    brand: model.brand,
    model_name: model.model_name,
    domestic_model_number: model.domestic_model_number,
    storage_gb: candidateResult.variantEvaluations?.[0]?.option?.storage_gb || undefined,
    color: candidateResult.variantEvaluations?.[0]?.option?.color || undefined,
  });

  if (queries.length === 0) return null;
  const response = await danawaAdapterInstance.search(queries[0], { maxResults: 5 });
  return {
    role: 'secondary_cross_check_only',
    launch_date_trusted: false,
    query: queries[0],
    source: response.source || 'danawa-cli',
    item_count: Array.isArray(response.items) ? response.items.length : 0,
    checked_at: candidateResult.audit?.checked_at || DEFAULT_CHECKED_AT,
  };
}

async function discoverSmartphoneCandidates({
  sourceRecords = [],
  existingModels = [],
  existingVariants = [],
  referenceDateKst = DEFAULT_CHECKED_AT,
  checkedAt = DEFAULT_CHECKED_AT,
  danawaAdapterInstance = null,
} = {}) {
  const window = computeReleaseWindow(referenceDateKst);
  const index = buildInventoryIndex(existingModels, existingVariants);

  const newModels = [];
  const newVariants = [];
  const alreadyExistsModels = [];
  const alreadyExistsVariants = [];
  const reviewRequired = [];
  const excluded = [];

  for (const rawRecord of sourceRecords) {
    const evaluated = evaluateCandidateRecord(rawRecord, index, {
      referenceDateKst: window.referenceDateKst,
      checkedAt,
    });

    if (danawaAdapterInstance && evaluated.modelClassification === CLASSIFICATIONS.NEW_MODEL) {
      evaluated.danawa_cross_check = await enrichCandidateWithDanawaSecondary(evaluated, danawaAdapterInstance);
    }

    if (evaluated.modelClassification === CLASSIFICATIONS.NEW_MODEL) {
      newModels.push(evaluated);
    } else if (evaluated.modelClassification === CLASSIFICATIONS.REVIEW_REQUIRED) {
      reviewRequired.push(evaluated);
    } else if (evaluated.modelClassification === CLASSIFICATIONS.EXCLUDED) {
      excluded.push(evaluated);
    } else if (evaluated.modelClassification === CLASSIFICATIONS.ALREADY_EXISTS) {
      alreadyExistsModels.push({
        smartphone_id: evaluated.matchedDbModel.id,
        brand: evaluated.matchedDbModel.brand,
        model_name: evaluated.matchedDbModel.model_name,
        domestic_model_number: evaluated.matchedDbModel.domestic_model_number,
        review_status: evaluated.matchedDbModel.review_status,
        audit: evaluated.audit,
      });

      for (const ve of evaluated.variantEvaluations) {
        if (ve.classification === CLASSIFICATIONS.NEW_VARIANT) {
          newVariants.push(ve);
        } else if (ve.classification === CLASSIFICATIONS.ALREADY_EXISTS) {
          alreadyExistsVariants.push(ve);
        } else if (ve.classification === CLASSIFICATIONS.REVIEW_REQUIRED) {
          reviewRequired.push(ve);
        }
      }
    }
  }

  const countByBrand = (items, getter) => items.reduce(
    (acc, item) => {
      const b = getter(item);
      if (b === 'samsung') acc.samsung += 1;
      else if (b === 'apple') acc.apple += 1;
      else acc.other += 1;
      return acc;
    },
    { samsung: 0, apple: 0, other: 0 }
  );

  const existingByStatus = existingModels.reduce((acc, m) => {
    const s = m.review_status || 'unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const existingVariantsByStatus = existingVariants.reduce((acc, v) => {
    const s = v.review_status || 'unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return {
    schema_version: 2,
    phase: 'phase_2_candidate_discovery',
    db_write_performed: false,
    production_approved: false,
    reference_date_kst: window.referenceDateKst,
    release_window_kst: {
      min_date: window.minDate,
      max_date: window.maxDate,
    },
    checked_at: checkedAt,
    existing_db_snapshot_summary: {
      total_models: existingModels.length,
      total_variants: existingVariants.length,
      models_by_review_status: existingByStatus,
      variants_by_review_status: existingVariantsByStatus,
    },
    summary: {
      source_records_processed: sourceRecords.length,
      classifications: {
        NEW_MODEL: newModels.length,
        NEW_VARIANT: newVariants.length,
        ALREADY_EXISTS_MODELS: alreadyExistsModels.length,
        ALREADY_EXISTS_VARIANTS: alreadyExistsVariants.length,
        REVIEW_REQUIRED: reviewRequired.length,
        EXCLUDED: excluded.length,
      },
      new_models_by_brand: countByBrand(newModels, (m) => m.normalizedModel.brand),
      new_variants_by_brand: countByBrand(newVariants, (v) => {
        const parent = index.byId.get(v.target_smartphone_id);
        return parent ? parent.brand : '';
      }),
      new_variants_by_parent_review_status: newVariants.reduce((acc, v) => {
        const s = v.target_parent_review_status || 'unknown';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {}),
    },
    candidates: {
      new_models: newModels,
      new_variants: newVariants,
      review_required: reviewRequired,
      excluded,
      already_exists_models: alreadyExistsModels,
      already_exists_variants: alreadyExistsVariants,
    },
  };
}

module.exports = {
  DEFAULT_CHECKED_AT,
  CLASSIFICATIONS,
  normalizeBrand,
  normalizeDomesticModelNumber,
  normalizeModelName,
  normalizeColorForDedupe,
  parsePositiveIntOrNull,
  normalizeOs,
  normalizeIsoDateOrNull,
  ramIdentityGb,
  isDanawaProhibitedUrl,
  computeReleaseWindow,
  buildInventoryIndex,
  loadExistingInventoryFromDb,
  findMatchingExistingModel,
  findMatchingExistingVariant,
  evaluateCandidateRecord,
  discoverSmartphoneCandidates,
};
