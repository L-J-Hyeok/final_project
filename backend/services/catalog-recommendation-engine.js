'use strict';

const { QueryTypes } = require('sequelize');
const catalog = require('./smartphone-catalog');
const { categories } = require('./catalog-validation');

const COMMON_CATEGORIES = ['tablet', 'laptop', 'smartwatch', 'earbuds', 'speaker'];
const ALL_CATEGORIES = ['smartphone', ...COMMON_CATEGORIES];
const COMMON_BRANDS = ['apple', 'samsung', 'lg', 'lenovo', 'asus', 'sony', 'bose', 'sennheiser', 'jbl'];
const USAGES = ['communication', 'video', 'coding', 'gaming', 'camera', 'work'];
const PRIORITIES = ['battery', 'camera', 'performance', 'portability', 'display'];
const MAX_RECOMMENDED_ITEMS = 3;

const POLICY_VERSIONS = Object.freeze({
  tablet: 'tablet-ranker-v1',
  laptop: 'laptop-ranker-v1',
  smartwatch: 'smartwatch-ranker-v1',
  earbuds: 'earbuds-ranker-v1',
  speaker: 'speaker-ranker-v1'
});

const BRAND_DISPLAY_NAMES = Object.freeze({
  apple: 'Apple',
  samsung: '삼성전자',
  lg: 'LG전자',
  lenovo: 'Lenovo',
  asus: 'ASUS',
  sony: 'Sony',
  bose: 'Bose',
  sennheiser: 'Sennheiser',
  jbl: 'JBL'
});

const ALLOWED_CATALOG_REASON_CODES = Object.freeze([
  'eligible_price',
  'budget_headroom',
  'storage_meets_requirement',
  'ram_meets_requirement',
  'preferred_brand_match',
  'pen_support_verified',
  'anc_support_verified',
  'cellular_support_verified',
  'water_resistance_verified',
  'os_compatibility_verified',
  'discrete_gpu_equipped',
  'high_refresh_display',
  'high_res_audio_codec',
  'gps_health_sensor_equipped',
  'high_power_speaker_output'
]);

const ALLOWED_CATALOG_EVIDENCE_FIELDS = Object.freeze([
  'price',
  'storage_gb',
  'ram_gb',
  'screen_inches',
  'refresh_hz',
  'battery_mah',
  'battery_wh',
  'battery_hours',
  'weight_g',
  'case_size_mm',
  'power_w'
]);

function isPlainObject(x) {
  return Boolean(x) && typeof x === 'object' && !Array.isArray(x);
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function detectCategoryFromText(text) {
  const t = String(text || '');
  if (/(?:스마트폰|휴대폰|핸드폰|아이폰|갤럭시\s*폰|폰)(?:만|을|도|으로)?\s*(?:추천|구매|사려|살|찾|골라)/i.test(t) || /기존\s*워치\s*호환|워치\s*호환\s*필수/i.test(t)) {
    return 'smartphone';
  }
  if (/스마트\s*워치|스마트워치|애플\s*워치|갤럭시\s*워치|apple\s*watch|galaxy\s*watch|워치\s*(?:추천|구매|사려|살|찾|모델)/i.test(t)) {
    return 'smartwatch';
  }
  if (/무선\s*이어폰|블루투스\s*이어폰|이어폰|에어팟|갤럭시\s*버즈|버즈\s*[0-9fepro]*|이어버드|링크버즈|모멘텀\s*트루|wf-1000xm5|\bairpods\b|\bearbuds\b/i.test(t)) {
    return 'earbuds';
  }
  if (/블루투스\s*스피커|휴대용\s*스피커|무선\s*스피커|스피커|\bjbl\b|\bflip\s*7\b/i.test(t)) {
    return 'speaker';
  }
  if (/태블릿|아이패드|갤럭시\s*탭|레노버\s*탭|리전\s*탭|\bipad\b|galaxy\s*tab|legion\s*tab/i.test(t)) {
    return 'tablet';
  }
  if (/노트북|랩탑|맥북|갤럭시\s*북|그램|울트라기어|씽크패드|리전\s*프로|요가\s*슬림|젠북|제피러스|비보북|아이디어패드|\bmacbook\b|galaxy\s*book|\bthinkpad\b|\bzenbook\b|\bzephyrus\b/i.test(t)) {
    return 'laptop';
  }
  return 'smartphone';
}

function inferSmartwatchCompatibleOs(model, specs) {
  const compatList = Array.isArray(specs?.compatible_os) ? specs.compatible_os.join(' ') : '';
  const brandLower = String(model.brand || '').toLowerCase();
  const supported = new Set();
  if (/watchos|\bios\b|iphone|아이폰/i.test(compatList) || (brandLower === 'apple' && /watchos/i.test(compatList))) {
    supported.add('ios');
  }
  if (/android|wear\s*os/i.test(compatList)) {
    supported.add('android');
  }
  return supported;
}

function inferLaptopOrTabletOsFamily(category, model, specs) {
  const osText = String(specs?.os || '');
  const brandLower = String(model.brand || '').toLowerCase();
  if (category === 'laptop') {
    if (/macos/i.test(osText) || brandLower === 'apple') return 'macos';
    if (/windows/i.test(osText)) return 'windows';
    return null;
  }
  if (category === 'tablet') {
    if (/ipados|\bios\b/i.test(osText) || brandLower === 'apple') return 'ios';
    if (/android|zui|one\s*ui/i.test(osText) || ['samsung', 'lenovo'].includes(brandLower)) return 'android';
    return null;
  }
  return null;
}

function validateCatalogRecommendationInput(body, defaultCategory = null) {
  if (!isPlainObject(body)) throw catalog.fail('INVALID_INPUT', 422);
  const allowedTopKeys = [
    'category',
    'expected_profile_version',
    'hard',
    'soft',
    'replacement_device_id',
    'purchase_reason',
    'upgrade_context',
    'include_test'
  ];
  catalog.object(body, allowedTopKeys);

  const category = body.category ?? defaultCategory;
  if (!COMMON_CATEGORIES.includes(category)) {
    throw catalog.fail('INVALID_INPUT', 422);
  }
  if (!Number.isInteger(body.expected_profile_version) || body.expected_profile_version < 1) {
    throw catalog.fail('INVALID_INPUT', 422);
  }
  if (!isPlainObject(body.hard)) {
    throw catalog.fail('INVALID_INPUT', 422);
  }

  const allowedHardKeys = [
    'budget_max_krw',
    'budget_unlimited',
    'usages',
    'allowed_brands',
    'required_os',
    'compatible_os',
    'min_storage_gb',
    'min_ram_gb',
    'max_weight_g',
    'min_refresh_hz',
    'require_5g',
    'require_cellular',
    'require_lte',
    'require_wireless_charging',
    'require_pen',
    'require_keyboard',
    'require_anc',
    'require_water_resistance',
    'require_gps',
    'require_discrete_gpu',
    'connectivity',
    'unsupported_requirements'
  ];
  catalog.object(body.hard, allowedHardKeys);

  const h = body.hard;
  const clarify_questions = [];

  if (Array.isArray(h.unsupported_requirements) && h.unsupported_requirements.length > 0) {
    for (const reqText of h.unsupported_requirements) {
      if (typeof reqText === 'string' && reqText.trim()) {
        clarify_questions.push(`"${reqText.trim()}" 조건은 카탈로그에서 정량 검증할 수 없습니다. 조건을 완화하거나 제외할까요?`);
      }
    }
  }

  const budget_unlimited = h.budget_unlimited === true;
  let budget_max_krw = null;
  if (budget_unlimited) {
    if (h.budget_max_krw !== undefined && h.budget_max_krw !== null) {
      throw catalog.fail('INVALID_INPUT', 422);
    }
  } else if (h.budget_max_krw === undefined || h.budget_max_krw === null) {
    clarify_questions.push('최대 예산(원)을 확인해 주세요.');
  } else {
    if (!Number.isInteger(h.budget_max_krw) || h.budget_max_krw < 1 || h.budget_max_krw > 20000000) {
      throw catalog.fail('INVALID_INPUT', 422);
    }
    budget_max_krw = h.budget_max_krw;
  }

  let usages = null;
  if (h.usages === undefined || h.usages === null || (Array.isArray(h.usages) && h.usages.length === 0)) {
    clarify_questions.push('이번 구매의 주요 사용 목적을 1개 이상 선택해 주세요.');
  } else {
    if (!Array.isArray(h.usages) || h.usages.length < 1 || h.usages.length > 6 || new Set(h.usages).size !== h.usages.length || h.usages.some(u => !USAGES.includes(u))) {
      throw catalog.fail('INVALID_INPUT', 422);
    }
    usages = [...h.usages];
  }

  let allowed_brands = null;
  if (h.allowed_brands !== undefined && h.allowed_brands !== null) {
    if (!Array.isArray(h.allowed_brands) || h.allowed_brands.length < 1 || h.allowed_brands.length > 9) {
      throw catalog.fail('INVALID_INPUT', 422);
    }
    const normalized = h.allowed_brands.map(b => typeof b === 'string' ? b.trim().toLowerCase() : '');
    if (new Set(normalized).size !== normalized.length || normalized.some(b => !COMMON_BRANDS.includes(b))) {
      throw catalog.fail('INVALID_INPUT', 422);
    }
    allowed_brands = normalized;
  }

  const validOsValues = ['android', 'ios', 'macos', 'windows'];
  let required_os = null;
  if (h.required_os !== undefined && h.required_os !== null) {
    const osVal = typeof h.required_os === 'string' ? h.required_os.trim().toLowerCase() : '';
    if (!validOsValues.includes(osVal)) throw catalog.fail('INVALID_INPUT', 422);
    required_os = osVal;
  }

  let compatible_os = null;
  if (h.compatible_os !== undefined && h.compatible_os !== null) {
    const compatVal = typeof h.compatible_os === 'string' ? h.compatible_os.trim().toLowerCase() : '';
    if (!['android', 'ios'].includes(compatVal)) throw catalog.fail('INVALID_INPUT', 422);
    compatible_os = compatVal;
  } else if (category === 'smartwatch' && required_os && ['android', 'ios'].includes(required_os)) {
    compatible_os = required_os;
  }

  // Check brand <-> OS contradiction on smartwatch / tablet / laptop
  if (category === 'smartwatch' && allowed_brands && compatible_os) {
    if (compatible_os === 'ios' && !allowed_brands.includes('apple')) {
      clarify_questions.push('iPhone(iOS) 호환 필수 조건과 선택한 필수 제조사 조건이 서로 충돌합니다.');
    } else if (compatible_os === 'android' && allowed_brands.length === 1 && allowed_brands[0] === 'apple') {
      clarify_questions.push('Android 호환 필수 조건과 Apple 단독 필수 제조사 조건이 서로 충돌합니다.');
    }
  }

  const checkOptInt = (val, min, max) => {
    if (val === undefined || val === null) return null;
    if (!Number.isInteger(val) || val < min || val > max) throw catalog.fail('INVALID_INPUT', 422);
    return val;
  };
  const checkOptBool = val => {
    if (val === undefined || val === null) return false;
    if (typeof val !== 'boolean') throw catalog.fail('INVALID_INPUT', 422);
    return val;
  };

  const min_storage_gb = checkOptInt(h.min_storage_gb, 1, 8192);
  const min_ram_gb = checkOptInt(h.min_ram_gb, 1, 512);
  const max_weight_g = checkOptInt(h.max_weight_g, 1, 10000);
  const min_refresh_hz = checkOptInt(h.min_refresh_hz, 1, 1000);
  const require_cellular = checkOptBool(h.require_cellular) || checkOptBool(h.require_lte) || checkOptBool(h.require_5g) || h.connectivity === 'cellular';
  const require_wireless_charging = checkOptBool(h.require_wireless_charging);
  const require_pen = checkOptBool(h.require_pen);
  const require_keyboard = checkOptBool(h.require_keyboard);
  const require_anc = checkOptBool(h.require_anc);
  const require_water_resistance = checkOptBool(h.require_water_resistance);
  const require_gps = checkOptBool(h.require_gps);
  const require_discrete_gpu = checkOptBool(h.require_discrete_gpu);

  let connectivity = null;
  if (h.connectivity !== undefined && h.connectivity !== null) {
    if (typeof h.connectivity !== 'string' || !['wifi', 'cellular', 'bluetooth', 'gps', 'wired', 'multi'].includes(h.connectivity)) {
      throw catalog.fail('INVALID_INPUT', 422);
    }
    connectivity = h.connectivity;
  }

  // Validate soft preferences
  const rawSoft = body.soft === undefined || body.soft === null ? {} : body.soft;
  if (!isPlainObject(rawSoft)) throw catalog.fail('INVALID_INPUT', 422);
  catalog.object(rawSoft, ['preferred_brands', 'priorities', 'preferred_os']);

  let preferred_brands = [];
  if (rawSoft.preferred_brands !== undefined && rawSoft.preferred_brands !== null) {
    if (!Array.isArray(rawSoft.preferred_brands) || rawSoft.preferred_brands.length > 9) {
      throw catalog.fail('INVALID_INPUT', 422);
    }
    const normPref = rawSoft.preferred_brands.map(b => typeof b === 'string' ? b.trim().toLowerCase() : '');
    if (new Set(normPref).size !== normPref.length || normPref.some(b => !COMMON_BRANDS.includes(b))) {
      throw catalog.fail('INVALID_INPUT', 422);
    }
    preferred_brands = normPref;
  }

  let priorities = [];
  if (rawSoft.priorities !== undefined && rawSoft.priorities !== null) {
    if (!Array.isArray(rawSoft.priorities) || rawSoft.priorities.length > 5 || new Set(rawSoft.priorities).size !== rawSoft.priorities.length || rawSoft.priorities.some(p => !PRIORITIES.includes(p))) {
      throw catalog.fail('INVALID_INPUT', 422);
    }
    priorities = [...rawSoft.priorities];
  }

  let preferred_os = null;
  if (rawSoft.preferred_os !== undefined && rawSoft.preferred_os !== null) {
    const pOs = typeof rawSoft.preferred_os === 'string' ? rawSoft.preferred_os.trim().toLowerCase() : '';
    if (!validOsValues.includes(pOs)) throw catalog.fail('INVALID_INPUT', 422);
    preferred_os = pOs;
  }

  const replacement_device_id = body.replacement_device_id === undefined || body.replacement_device_id === null
    ? null
    : catalog.id(String(body.replacement_device_id));

  let upgrade_context = null;
  if (body.upgrade_context !== undefined && body.upgrade_context !== null) {
    if (!isPlainObject(body.upgrade_context)) throw catalog.fail('INVALID_INPUT', 422);
    catalog.object(body.upgrade_context, ['satisfied_aspects', 'pain_points', 'replacement_intent', 'no_pain_confirmed']);
    const allowedAspects = ['battery', 'camera', 'performance', 'portability', 'display', 'storage', 'ram', 'gpu', 'pen', 'keyboard', 'anc', 'codec', 'multipoint', 'water_resistance', 'gps', 'cellular', 'power', 'multipairing', 'os_ecosystem', 'price'];
    const cleanAspects = val => {
      if (val === undefined || val === null) return [];
      if (!Array.isArray(val) || val.length > 8 || new Set(val).size !== val.length || val.some(v => typeof v !== 'string' || !allowedAspects.includes(v))) {
        throw catalog.fail('INVALID_INPUT', 422);
      }
      return [...val];
    };
    const satisfied_aspects = cleanAspects(body.upgrade_context.satisfied_aspects);
    const pain_points = cleanAspects(body.upgrade_context.pain_points);
    const replacement_intent = body.upgrade_context.replacement_intent === undefined || body.upgrade_context.replacement_intent === null
      ? 'moderate'
      : ['high', 'moderate', 'low_or_keep_if_okay'].includes(body.upgrade_context.replacement_intent)
        ? body.upgrade_context.replacement_intent
        : (() => { throw catalog.fail('INVALID_INPUT', 422); })();
    if (body.upgrade_context.no_pain_confirmed !== undefined && (typeof body.upgrade_context.no_pain_confirmed !== 'boolean' || (body.upgrade_context.no_pain_confirmed && pain_points.length > 0))) {
      throw catalog.fail('INVALID_INPUT', 422);
    }
    upgrade_context = {
      satisfied_aspects,
      pain_points,
      replacement_intent,
      ...(body.upgrade_context.no_pain_confirmed ? { no_pain_confirmed: true } : {})
    };
  }

  return {
    category,
    expected_profile_version: body.expected_profile_version,
    hard: {
      budget_max_krw,
      ...(budget_unlimited ? { budget_unlimited: true } : {}),
      usages,
      allowed_brands,
      required_os,
      compatible_os,
      min_storage_gb,
      min_ram_gb,
      max_weight_g,
      min_refresh_hz,
      require_cellular,
      require_wireless_charging,
      require_pen,
      require_keyboard,
      require_anc,
      require_water_resistance,
      require_gps,
      require_discrete_gpu,
      connectivity
    },
    soft: {
      preferred_brands,
      priorities,
      preferred_os
    },
    replacement_device_id,
    upgrade_context,
    purchase_reason: typeof body.purchase_reason === 'string' ? body.purchase_reason.trim().slice(0, 300) : null,
    clarify_questions
  };
}

async function fetchPublicCatalogCandidates(db, category, priceCurrency = 'KRW') {
  const rows = await db.query(`
    SELECT
      CAST(m.id AS CHAR) AS model_id,
      m.category_code,
      m.brand,
      m.model_name,
      m.model_number,
      m.released_on,
      m.weight_g AS model_weight_g,
      m.official_product_url,
      m.specs_json,
      m.sale_status AS model_sale_status,
      m.source_name AS model_source_name,
      m.source_url AS model_source_url,
      m.verified_at AS model_verified_at,
      CAST(k.id AS CHAR) AS sku_id,
      k.sku_code,
      k.manufacturer_part_number,
      k.storage_gb,
      k.ram_gb,
      k.color,
      k.connectivity,
      k.options_json,
      k.sale_status AS sku_sale_status,
      CAST(k.price_group_id AS CHAR) AS price_group_id,
      k.source_name AS sku_source_name,
      k.source_url AS sku_source_url,
      k.verified_at AS sku_verified_at
    FROM catalog_models m
    JOIN catalog_skus k ON k.model_id = m.id
    WHERE m.category_code = :category
      AND m.publication_status = 'public'
      AND m.verification_status = 'verified'
      AND m.is_test = 0
      AND k.publication_status = 'public'
      AND k.verification_status = 'verified'
    ORDER BY m.id ASC, k.id ASC
  `, { replacements: { category }, type: QueryTypes.SELECT });

  if (!rows.length) {
    return { allCandidates: [], priceAvailability: { total_public_skus: 0, priced_skus: 0, missing_price_skus: 0 } };
  }

  const modelIds = [...new Set(rows.map(r => Number(r.model_id)))];
  const priceRows = await db.query(`
    SELECT
      CAST(model_id AS CHAR) AS model_id,
      target_key,
      CAST(id AS CHAR) AS observation_id,
      seller_name,
      CAST(amount_minor AS CHAR) AS amount_minor,
      currency,
      product_url,
      observed_at,
      checked_at
    FROM (
      SELECT p.*, ROW_NUMBER() OVER (PARTITION BY model_id, target_key ORDER BY observed_at DESC, id DESC) AS price_rank
      FROM catalog_price_observations p
      WHERE model_id IN (:modelIds)
        AND currency = :priceCurrency
        AND status = 'normal'
        AND observed_at <= NOW(3)
        AND checked_at <= NOW(3)
    ) ranked
    WHERE price_rank = 1
  `, { replacements: { modelIds, priceCurrency }, type: QueryTypes.SELECT });

  const priceMap = new Map();
  for (const p of priceRows) {
    const isDanawa = (() => {
      try { return new URL(p.product_url).hostname === 'prod.danawa.com'; } catch (_) { return false; }
    })();
    priceMap.set(`${p.model_id}:${p.target_key}`, {
      observation_id: String(p.observation_id),
      seller_name: p.seller_name,
      amount_minor: String(p.amount_minor),
      amount_krw: Number(p.amount_minor),
      budget_basis_krw: Number(p.amount_minor),
      total_krw: null,
      shipping_krw: null,
      currency: p.currency,
      product_url: p.product_url,
      danawa_product_url: isDanawa ? p.product_url : null,
      source_url: p.product_url,
      source_name: isDanawa ? 'danawa-cli' : p.seller_name,
      observed_at: p.observed_at instanceof Date ? p.observed_at.toISOString() : String(p.observed_at),
      checked_at: p.checked_at instanceof Date ? p.checked_at.toISOString() : String(p.checked_at),
      expires_at: null,
      retained_observation: true,
      is_reference_price: true,
      purchase_verified: false,
      development_only: false,
      eligible: true,
      price_missing: false,
      scope: p.target_key === 'model' ? 'model' : p.target_key.startsWith('s:') ? 'sku' : 'group',
      price_label: '수집 당시 참고 가격',
      price_source: isDanawa ? 'danawa_reference' : 'seller_reference',
      warning: '다나와 기준 참고 최저가로, 실제 구매 조건·배송비에 따라 가격이 달라질 수 있습니다.'
    });
  }

  let pricedCount = 0;
  let missingCount = 0;

  const allCandidates = rows.map(r => {
    const specs = typeof r.specs_json === 'string' ? JSON.parse(r.specs_json) : (r.specs_json || {});
    const options = typeof r.options_json === 'string' ? JSON.parse(r.options_json) : (r.options_json || {});
    const price =
      priceMap.get(`${r.model_id}:s:${r.sku_id}`) ||
      (r.price_group_id ? priceMap.get(`${r.model_id}:g:${r.price_group_id}`) : null) ||
      null;

    if (price && Number.isSafeInteger(price.amount_krw) && price.amount_krw > 0) {
      pricedCount += 1;
    } else {
      missingCount += 1;
    }

    const weightG = options.weight_g != null
      ? Number(options.weight_g)
      : (r.model_weight_g != null ? Number(r.model_weight_g) : null);

    return {
      category: r.category_code,
      model_id: String(r.model_id),
      sku_id: String(r.sku_id),
      variant_id: String(r.sku_id),
      smartphone_id: String(r.model_id),
      sku_code: r.sku_code,
      manufacturer_part_number: r.manufacturer_part_number || null,
      brand: r.brand,
      brand_lower: String(r.brand || '').toLowerCase(),
      model_name: r.model_name,
      model_number: r.model_number,
      domestic_model_number: r.model_number,
      released_on: r.released_on || null,
      released_on_kr: r.released_on || (specs.release_month ? `${specs.release_month}-01` : null),
      storage_gb: r.storage_gb != null ? Number(r.storage_gb) : null,
      ram_gb: r.ram_gb != null ? Number(r.ram_gb) : null,
      color: r.color || null,
      connectivity: r.connectivity || null,
      weight_g: weightG,
      screen_inches: specs.screen_inches != null ? Number(specs.screen_inches) : null,
      refresh_hz: specs.refresh_hz != null ? Number(specs.refresh_hz) : null,
      battery_mah: specs.battery_mah != null ? Number(specs.battery_mah) : null,
      battery_wh: specs.battery_wh != null ? Number(specs.battery_wh) : null,
      battery_hours: specs.battery_hours != null ? Number(specs.battery_hours) : null,
      case_size_mm: options.case_size_mm != null ? Number(options.case_size_mm) : null,
      power_w: specs.power_w != null ? Number(specs.power_w) : null,
      official_product_url: r.official_product_url || null,
      specifications: specs,
      options,
      price,
      sources: {
        model: {
          name: r.model_source_name,
          url: r.model_source_url,
          verified_at: r.model_verified_at instanceof Date ? r.model_verified_at.toISOString() : String(r.model_verified_at)
        },
        sku: {
          name: r.sku_source_name,
          url: r.sku_source_url,
          verified_at: r.sku_verified_at instanceof Date ? r.sku_verified_at.toISOString() : String(r.sku_verified_at)
        }
      }
    };
  });

  return {
    allCandidates,
    priceAvailability: {
      total_public_skus: rows.length,
      priced_skus: pricedCount,
      missing_price_skus: missingCount,
      missing_price_policy: 'excluded_from_budget_and_value_evaluation'
    }
  };
}

function checkHardEligibility(cand, hard = {}) {
  const specs = cand.specifications || {};
  const opts = cand.options || {};

  // 1. Price & Budget check: missing prices are NEVER eligible for budget/purchase recommendations
  const priceKrw = cand.price && Number.isSafeInteger(cand.price.amount_krw) && cand.price.amount_krw > 0
    ? cand.price.amount_krw
    : null;
  if (priceKrw === null) {
    return { eligible: false, reason: 'MISSING_PRICE' };
  }
  if (!hard.budget_unlimited && hard.budget_max_krw != null && priceKrw > hard.budget_max_krw) {
    return { eligible: false, reason: 'OVER_BUDGET' };
  }

  // 2. Brand check
  if (Array.isArray(hard.allowed_brands) && hard.allowed_brands.length > 0) {
    if (!hard.allowed_brands.includes(cand.brand_lower)) {
      return { eligible: false, reason: 'BRAND_MISMATCH' };
    }
  }

  // 3. Storage & RAM check
  if (hard.min_storage_gb != null) {
    if (cand.storage_gb === null || cand.storage_gb < hard.min_storage_gb) {
      return { eligible: false, reason: 'STORAGE_BELOW_MIN' };
    }
  }
  if (hard.min_ram_gb != null) {
    if (cand.ram_gb === null || cand.ram_gb < hard.min_ram_gb) {
      return { eligible: false, reason: 'RAM_BELOW_MIN' };
    }
  }

  // 4. Weight & Refresh rate check
  if (hard.max_weight_g != null) {
    if (cand.weight_g === null || cand.weight_g > hard.max_weight_g) {
      return { eligible: false, reason: 'WEIGHT_ABOVE_MAX' };
    }
  }
  if (hard.min_refresh_hz != null) {
    if (cand.refresh_hz === null || cand.refresh_hz < hard.min_refresh_hz) {
      return { eligible: false, reason: 'REFRESH_BELOW_MIN' };
    }
  }

  // 5. Category-specific hard conditions & OS compatibility
  if (hard.require_pen) {
    const hasPen = specs.pen_supported === true || (Array.isArray(specs.ports) && specs.ports.some(p => /S펜|펜/i.test(p)));
    if (!hasPen) {
      return { eligible: false, reason: 'PEN_SUPPORT_UNVERIFIED_OR_FALSE' };
    }
  }
  if (hard.require_keyboard) {
    if (specs.keyboard_supported !== true) {
      return { eligible: false, reason: 'KEYBOARD_SUPPORT_UNVERIFIED_OR_FALSE' };
    }
  }
  if (hard.require_anc) {
    if (specs.anc !== true) {
      return { eligible: false, reason: 'ANC_UNVERIFIED_OR_FALSE' };
    }
  }
  if (hard.require_cellular) {
    if (cand.connectivity !== 'cellular') {
      return { eligible: false, reason: 'CELLULAR_NOT_SUPPORTED' };
    }
  }
  if (hard.connectivity && cand.connectivity !== hard.connectivity) {
    return { eligible: false, reason: 'CONNECTIVITY_MISMATCH' };
  }
  if (hard.require_wireless_charging) {
    if (specs.wireless_charging !== true) {
      return { eligible: false, reason: 'WIRELESS_CHARGING_UNVERIFIED_OR_FALSE' };
    }
  }
  if (hard.require_water_resistance) {
    if (typeof specs.water_resistance !== 'string' || !specs.water_resistance.trim()) {
      return { eligible: false, reason: 'WATER_RESISTANCE_UNVERIFIED' };
    }
  }
  if (hard.require_gps) {
    if (specs.gps !== true) {
      return { eligible: false, reason: 'GPS_UNVERIFIED' };
    }
  }
  if (hard.require_discrete_gpu) {
    const gpuStr = String(opts.gpu || specs.gpu || '');
    if (!/NVIDIA|RTX|GeForce|Radeon\s+RX/i.test(gpuStr)) {
      return { eligible: false, reason: 'DISCRETE_GPU_REQUIRED' };
    }
  }

  if (cand.category === 'smartwatch' && hard.compatible_os) {
    const supportedOs = inferSmartwatchCompatibleOs(cand, specs);
    if (!supportedOs.has(hard.compatible_os)) {
      return { eligible: false, reason: `OS_INCOMPATIBLE:${hard.compatible_os}` };
    }
  } else if ((cand.category === 'laptop' || cand.category === 'tablet') && hard.required_os) {
    const osFamily = inferLaptopOrTabletOsFamily(cand.category, cand, specs);
    if (osFamily !== hard.required_os) {
      return { eligible: false, reason: `OS_MISMATCH:${hard.required_os}` };
    }
  }

  return { eligible: true, priceKrw };
}

function buildEligibleReasonsForCatalog(cand, hard = {}, soft = {}) {
  const reasons = [];
  const specs = cand.specifications || {};
  const opts = cand.options || {};
  const priceKrw = cand.price?.amount_krw;

  if (hard.budget_max_krw != null && priceKrw < hard.budget_max_krw) {
    reasons.push({
      code: 'budget_headroom',
      field: 'price',
      value: hard.budget_max_krw - priceKrw
    });
  } else if (priceKrw != null) {
    reasons.push({
      code: 'eligible_price',
      field: 'price',
      value: priceKrw
    });
  }

  if (hard.min_storage_gb != null && cand.storage_gb != null && cand.storage_gb >= hard.min_storage_gb) {
    reasons.push({ code: 'storage_meets_requirement', field: 'storage_gb', value: cand.storage_gb });
  }
  if (hard.min_ram_gb != null && cand.ram_gb != null && cand.ram_gb >= hard.min_ram_gb) {
    reasons.push({ code: 'ram_meets_requirement', field: 'ram_gb', value: cand.ram_gb });
  }
  if (Array.isArray(soft.preferred_brands) && soft.preferred_brands.includes(cand.brand_lower)) {
    reasons.push({ code: 'preferred_brand_match', field: 'brand', value: cand.brand });
  }
  if (specs.pen_supported === true) {
    reasons.push({ code: 'pen_support_verified', field: 'pen_supported', value: true });
  }
  if (specs.anc === true) {
    reasons.push({ code: 'anc_support_verified', field: 'anc', value: true });
  }
  if (cand.connectivity === 'cellular') {
    reasons.push({ code: 'cellular_support_verified', field: 'connectivity', value: 'cellular' });
  }
  if (typeof specs.water_resistance === 'string' && specs.water_resistance.trim()) {
    reasons.push({ code: 'water_resistance_verified', field: 'water_resistance', value: specs.water_resistance.trim() });
  }
  if (cand.category === 'smartwatch') {
    const supportedOs = inferSmartwatchCompatibleOs(cand, specs);
    if (hard.compatible_os && supportedOs.has(hard.compatible_os)) {
      reasons.push({ code: 'os_compatibility_verified', field: 'compatible_os', value: hard.compatible_os });
    } else if (supportedOs.size > 0) {
      reasons.push({ code: 'os_compatibility_verified', field: 'compatible_os', value: [...supportedOs][0] });
    }
    if (specs.gps === true) {
      reasons.push({ code: 'gps_health_sensor_equipped', field: 'gps', value: true });
    }
  }
  if (cand.category === 'laptop') {
    const gpuStr = String(opts.gpu || specs.gpu || '');
    if (/NVIDIA|RTX|GeForce/i.test(gpuStr)) {
      reasons.push({ code: 'discrete_gpu_equipped', field: 'gpu', value: gpuStr });
    }
    if (cand.refresh_hz != null && cand.refresh_hz >= 120) {
      reasons.push({ code: 'high_refresh_display', field: 'refresh_hz', value: cand.refresh_hz });
    }
  }
  if (cand.category === 'earbuds' && Array.isArray(specs.codecs)) {
    const hiRes = specs.codecs.find(c => /LDAC|aptX\s*Lossless|aptX\s*Adaptive|SSC-UHQ|SSC\s*Hi-Fi/i.test(c));
    if (hiRes) {
      reasons.push({ code: 'high_res_audio_codec', field: 'codecs', value: hiRes });
    }
  }
  if (cand.category === 'speaker' && cand.power_w != null && cand.power_w >= 20) {
    reasons.push({ code: 'high_power_speaker_output', field: 'power_w', value: cand.power_w });
  }

  return reasons;
}

function renderCatalogReasonDescription(reason, cand, hard) {
  const brandLabel = BRAND_DISPLAY_NAMES[cand.brand_lower] || cand.brand;
  switch (reason.code) {
    case 'budget_headroom':
      return `다나와 수집 당시 참고 가격(${Number(cand.price.amount_krw).toLocaleString('ko-KR')}원)이 예산 상한 대비 ${Number(reason.value).toLocaleString('ko-KR')}원 여유가 있습니다.`;
    case 'eligible_price':
      return `다나와 수집 당시 참고 가격(${Number(cand.price.amount_krw).toLocaleString('ko-KR')}원)이 확인된 구매 가능 구성입니다.`;
    case 'storage_meets_requirement':
      return `저장 용량이 ${cand.storage_gb}GB로 필수 기준(${hard.min_storage_gb}GB 이상)을 충족합니다.`;
    case 'ram_meets_requirement':
      return `메모리가 ${cand.ram_gb}GB로 필수 기준(${hard.min_ram_gb}GB 이상)을 충족합니다.`;
    case 'preferred_brand_match':
      return `선호하시는 제조사(${brandLabel}) 제품입니다.`;
    case 'pen_support_verified':
      return '공식 사양에서 펜 입력 지원이 확인된 모델입니다.';
    case 'anc_support_verified':
      return '액티브 노이즈 캔슬링(ANC) 지원이 공식 사양에서 확인되었습니다.';
    case 'cellular_support_verified':
      return '단독 셀룰러(LTE) 연결을 지원하는 구성입니다.';
    case 'water_resistance_verified':
      return `공식 방수·방진 등급(${reason.value})이 확인된 제품입니다.`;
    case 'os_compatibility_verified':
      return `${reason.value === 'ios' ? 'iPhone(iOS/watchOS)' : 'Android(Wear OS)'} 생태계 호환성이 확인된 스마트워치입니다.`;
    case 'discrete_gpu_equipped':
      return `외장 그래픽(${reason.value})을 탑재해 그래픽·고부하 작업에 유리합니다.`;
    case 'high_refresh_display':
      return `${reason.value}Hz 고주사율 디스플레이를 탑재했습니다.`;
    case 'high_res_audio_codec':
      return `고음질 블루투스 코덱(${reason.value})을 지원합니다.`;
    case 'gps_health_sensor_equipped':
      return '내장 GPS 및 건강·운동 측정 센서를 지원합니다.';
    case 'high_power_speaker_output':
      return `정격 ${reason.value}W 출력을 지원하는 블루투스 스피커입니다.`;
    default:
      return '확인된 공식 사양과 가격 기준을 충족합니다.';
  }
}

function computeBudgetFitScore(priceKrw, hard, spendingStyle, maxObservedPrice) {
  if (priceKrw === null || priceKrw <= 0) return null;
  const ceiling = !hard.budget_unlimited && hard.budget_max_krw !== null && hard.budget_max_krw > 0
    ? hard.budget_max_krw
    : (maxObservedPrice && maxObservedPrice > 0 ? maxObservedPrice * 1.1 : priceKrw);
  const ratio = clamp01(priceKrw / ceiling);
  const headroom = clamp01(1 - ratio);
  if (spendingStyle === 'value') return clamp01(0.45 + 0.55 * headroom);
  if (spendingStyle === 'premium') return clamp01(0.65 + 0.35 * (1 - Math.abs(0.85 - ratio)));
  return clamp01(0.50 + 0.50 * headroom);
}

function evaluateCategoryCandidate(cand, priceKrw, profile, hard, soft, stats) {
  const common = profile?.common || {};
  const spendingStyle = common.spending_style || 'balanced';
  const usages = Array.isArray(hard.usages) && hard.usages.length ? hard.usages : (common.usages || []);
  const priorities = Array.isArray(soft.priorities) ? soft.priorities : [];
  const specs = cand.specifications || {};
  const opts = cand.options || {};

  const metricScores = {};
  const missingMetrics = [];
  const notes = [];

  metricScores.budget_fit = computeBudgetFitScore(priceKrw, hard, spendingStyle, stats.maxPrice);

  let prefScore = 0.5;
  if (Array.isArray(soft.preferred_brands) && soft.preferred_brands.length > 0) {
    prefScore = soft.preferred_brands.includes(cand.brand_lower) ? 1.0 : 0.25;
  } else if (common.ecosystem === 'apple') {
    prefScore = cand.brand_lower === 'apple' ? 0.95 : 0.45;
  } else if (common.ecosystem === 'android') {
    prefScore = cand.brand_lower === 'samsung' ? 0.95 : 0.50;
  }
  metricScores.feature_preference = prefScore;

  if (cand.category === 'tablet') {
    // 1. Pen & productivity
    if (specs.pen_supported === true) {
      metricScores.pen_productivity = specs.keyboard_supported === true ? 1.0 : 0.9;
    } else if (specs.pen_supported === false) {
      metricScores.pen_productivity = 0.2;
    } else {
      metricScores.pen_productivity = null;
      missingMetrics.push('pen_supported');
      notes.push('제조사 사양표에 펜 지원 여부가 정형화되어 있지 않아 펜 항목 점수에서 제외했습니다.');
    }

    // 2. Memory & Storage (chipset benchmark is never fabricated)
    const storageNorm = cand.storage_gb != null ? clamp01(Math.log2(Math.max(32, cand.storage_gb) / 32) / 4) : null;
    const ramNorm = cand.ram_gb != null ? clamp01((cand.ram_gb - 4) / 12) : null;
    if (storageNorm !== null && ramNorm !== null) {
      metricScores.memory_storage = clamp01(0.55 * ramNorm + 0.45 * storageNorm);
    } else if (storageNorm !== null) {
      metricScores.memory_storage = storageNorm;
      missingMetrics.push('ram_gb');
      notes.push('제조사 공식 사양에서 RAM 용량이 비공개(null)여서 저장 용량 기준으로만 메모리 항목을 평가했습니다.');
    } else {
      metricScores.memory_storage = null;
    }
    if (priorities.includes('performance') || usages.includes('gaming')) {
      notes.push('칩셋 이름만으로 임의 벤치마크 점수를 생성하지 않고 확인된 RAM·저장 용량 사양을 반영했습니다.');
    }

    // 3. Display
    if (cand.screen_inches != null) {
      const wantCompact = priorities.includes('portability') || common.mobility === 'high';
      metricScores.display = wantCompact
        ? clamp01(1 - Math.abs(cand.screen_inches - 10.5) / 6)
        : clamp01((cand.screen_inches - 8) / 6.6);
    } else {
      metricScores.display = null;
      missingMetrics.push('screen_inches');
    }

    // 4. Battery & Weight
    let batScore = null;
    if (cand.battery_mah != null && stats.maxBatteryMah > 0) {
      batScore = clamp01(cand.battery_mah / stats.maxBatteryMah);
    } else if (cand.battery_wh != null && stats.maxBatteryWh > 0) {
      batScore = clamp01(cand.battery_wh / stats.maxBatteryWh);
    } else {
      missingMetrics.push('battery');
      notes.push('배터리 용량(mAh/Wh) 정보가 없어 배터리 정량 비교에서 제외했습니다.');
    }
    const weightScore = cand.weight_g != null ? clamp01((800 - cand.weight_g) / 520) : null;
    if (batScore !== null && weightScore !== null) {
      metricScores.battery_portability = clamp01(0.5 * batScore + 0.5 * weightScore);
    } else {
      metricScores.battery_portability = batScore ?? weightScore;
    }
  } else if (cand.category === 'laptop') {
    const ramNorm = cand.ram_gb != null ? clamp01((cand.ram_gb - 8) / 40) : null;
    const storageNorm = cand.storage_gb != null ? clamp01(Math.log2(Math.max(128, cand.storage_gb) / 128) / 3) : null;
    metricScores.memory_storage = (ramNorm !== null && storageNorm !== null)
      ? clamp01(0.6 * ramNorm + 0.4 * storageNorm)
      : (ramNorm ?? storageNorm);

    const gpuStr = String(opts.gpu || specs.gpu || '');
    const hasDiscreteGpu = /NVIDIA|RTX|GeForce/i.test(gpuStr);
    const hasIntegratedGpu = Boolean(gpuStr);
    metricScores.cpu_gpu = hasDiscreteGpu ? 1.0 : (hasIntegratedGpu ? 0.72 : 0.60);
    notes.push('CPU·GPU 명칭으로 임의 벤치마크 점수를 생성하지 않고 확인된 코어·외장그래픽 구성과 RAM·SSD 용량을 반영했습니다.');

    const hzScore = cand.refresh_hz != null ? clamp01((cand.refresh_hz - 60) / 180) : 0.4;
    const screenScore = cand.screen_inches != null ? clamp01((cand.screen_inches - 13) / 4.3) : 0.5;
    metricScores.display = clamp01(0.6 * screenScore + 0.4 * hzScore);

    const batScore = cand.battery_wh != null && stats.maxBatteryWh > 0 ? clamp01(cand.battery_wh / stats.maxBatteryWh) : null;
    const weightScore = cand.weight_g != null ? clamp01((2700 - cand.weight_g) / 1750) : null;
    metricScores.battery_portability = (batScore !== null && weightScore !== null)
      ? clamp01(0.45 * batScore + 0.55 * weightScore)
      : (batScore ?? weightScore);
  } else if (cand.category === 'smartwatch') {
    const supportedOs = inferSmartwatchCompatibleOs(cand, specs);
    metricScores.os_compatibility = supportedOs.size > 0 ? 1.0 : null;

    let sensorScore = specs.gps === true ? 0.65 : 0.2;
    if (Array.isArray(specs.sensors) && specs.sensors.length > 0) sensorScore += 0.2;
    if (typeof specs.water_resistance === 'string' && specs.water_resistance.trim()) sensorScore += 0.15;
    metricScores.gps_sensors = clamp01(sensorScore);

    if (cand.battery_mah != null && stats.maxBatteryMah > 0) {
      metricScores.battery = clamp01(cand.battery_mah / stats.maxBatteryMah);
    } else {
      metricScores.battery = null;
      missingMetrics.push('battery_mah');
      notes.push('제조사 공식 사양에 배터리 용량(mAh)이 비공개(null)여서 배터리 용량 점수 계산에서 제외했습니다.');
    }

    const weightScore = cand.weight_g != null ? clamp01((65 - cand.weight_g) / 40) : null;
    const sizeScore = cand.case_size_mm != null ? clamp01(1 - Math.abs(cand.case_size_mm - 44) / 12) : null;
    metricScores.size_portability = (weightScore !== null && sizeScore !== null)
      ? clamp01(0.6 * weightScore + 0.4 * sizeScore)
      : (weightScore ?? sizeScore);
  } else if (cand.category === 'earbuds') {
    if (specs.anc === true) metricScores.anc = 1.0;
    else if (specs.anc === false) metricScores.anc = 0.2;
    else {
      metricScores.anc = null;
      missingMetrics.push('anc');
    }

    const btVer = parseFloat(specs.bluetooth_version || '5.0');
    let connScore = Number.isFinite(btVer) ? clamp01((btVer - 5.0) / 0.4) * 0.5 + 0.3 : 0.5;
    if (Array.isArray(specs.codecs)) {
      if (specs.codecs.some(c => /LDAC|aptX\s*Lossless|aptX\s*Adaptive|SSC-UHQ|SSC\s*Hi-Fi/i.test(c))) {
        connScore += 0.2;
      }
    }
    metricScores.connectivity_codecs = clamp01(connScore);

    const batScore = cand.battery_hours != null && stats.maxBatteryHours > 0
      ? clamp01(cand.battery_hours / stats.maxBatteryHours)
      : null;
    const waterBonus = typeof specs.water_resistance === 'string' && specs.water_resistance.trim() ? 0.15 : 0;
    const wirelessBonus = specs.wireless_charging === true ? 0.10 : 0;
    metricScores.battery_durability = batScore !== null ? clamp01(batScore * 0.75 + waterBonus + wirelessBonus) : null;

    metricScores.portability = cand.weight_g != null
      ? clamp01((7.5 - cand.weight_g) / 3.5)
      : null;
    if (cand.weight_g == null) {
      missingMetrics.push('weight_g');
      notes.push('유닛 단일 무게가 정형 수치로 등록되지 않아 무게 평가에서 제외했습니다.');
    }
  } else if (cand.category === 'speaker') {
    metricScores.power_output = cand.power_w != null && stats.maxPowerW > 0
      ? clamp01(cand.power_w / stats.maxPowerW)
      : null;
    const btVer = parseFloat(specs.bluetooth_version || '5.0');
    metricScores.connectivity = Number.isFinite(btVer) ? clamp01(0.5 + (btVer - 5.0)) : 0.7;
    const batScore = cand.battery_hours != null && stats.maxBatteryHours > 0
      ? clamp01(cand.battery_hours / stats.maxBatteryHours)
      : null;
    const waterBonus = typeof specs.water_resistance === 'string' && /IP6[78]/i.test(specs.water_resistance) ? 0.2 : 0;
    metricScores.battery_durability = batScore !== null ? clamp01(batScore * 0.8 + waterBonus) : null;
    metricScores.portability = cand.weight_g != null ? clamp01((1500 - cand.weight_g) / 1200) : null;
  }

  return {
    metric_scores: metricScores,
    missing_metrics: missingMetrics,
    insufficient_info: missingMetrics.length > 0,
    insufficient_info_notes: [...new Set(notes)],
    price_caution: cand.price?.warning || null
  };
}

function computeCategoryWeights(category, profile = {}, hard = {}, soft = {}) {
  const common = profile?.common || {};
  const usages = Array.isArray(hard.usages) && hard.usages.length ? hard.usages : (common.usages || []);
  const priorities = Array.isArray(soft.priorities) ? soft.priorities : [];

  let weights;
  if (category === 'tablet') {
    weights = {
      budget_fit: 0.24,
      pen_productivity: 0.16,
      memory_storage: 0.20,
      display: 0.16,
      battery_portability: 0.16,
      feature_preference: 0.08
    };
    if (hard.require_pen || usages.includes('work') || usages.includes('coding')) {
      weights.pen_productivity += 0.12;
    }
    if (usages.includes('video')) weights.display += 0.10;
    if (usages.includes('gaming')) weights.memory_storage += 0.12;
  } else if (category === 'laptop') {
    weights = {
      budget_fit: 0.22,
      cpu_gpu: 0.20,
      memory_storage: 0.22,
      display: 0.12,
      battery_portability: 0.16,
      feature_preference: 0.08
    };
    if (usages.includes('coding') || usages.includes('work')) {
      weights.memory_storage += 0.10;
      weights.battery_portability += 0.06;
    }
    if (usages.includes('gaming')) {
      weights.cpu_gpu += 0.16;
      weights.display += 0.08;
    }
  } else if (category === 'smartwatch') {
    weights = {
      budget_fit: 0.24,
      os_compatibility: 0.20,
      gps_sensors: 0.20,
      battery: 0.14,
      size_portability: 0.14,
      feature_preference: 0.08
    };
  } else if (category === 'earbuds') {
    weights = {
      budget_fit: 0.24,
      anc: 0.24,
      connectivity_codecs: 0.18,
      battery_durability: 0.18,
      portability: 0.08,
      feature_preference: 0.08
    };
    if (hard.require_anc) weights.anc += 0.10;
  } else {
    weights = {
      budget_fit: 0.25,
      power_output: 0.22,
      connectivity: 0.15,
      battery_durability: 0.20,
      portability: 0.10,
      feature_preference: 0.08
    };
  }

  if (common.spending_style === 'value') weights.budget_fit += 0.14;
  else if (common.spending_style === 'premium') weights.budget_fit = Math.max(0.08, weights.budget_fit - 0.08);

  if (priorities.includes('portability') || common.mobility === 'high') {
    if (weights.battery_portability !== undefined) weights.battery_portability += 0.12;
    if (weights.size_portability !== undefined) weights.size_portability += 0.12;
    if (weights.portability !== undefined) weights.portability += 0.12;
  }
  if (priorities.includes('battery')) {
    if (weights.battery_portability !== undefined) weights.battery_portability += 0.10;
    if (weights.battery !== undefined) weights.battery += 0.12;
    if (weights.battery_durability !== undefined) weights.battery_durability += 0.12;
  }
  if (priorities.includes('performance')) {
    if (weights.memory_storage !== undefined) weights.memory_storage += 0.10;
    if (weights.cpu_gpu !== undefined) weights.cpu_gpu += 0.10;
  }
  if (priorities.includes('display') && weights.display !== undefined) {
    weights.display += 0.10;
  }

  let total = 0;
  for (const k of Object.keys(weights)) {
    weights[k] = Math.max(0, weights[k]);
    total += weights[k];
  }
  if (total > 0) {
    for (const k of Object.keys(weights)) {
      weights[k] = Number((weights[k] / total).toFixed(6));
    }
  }
  return weights;
}

function computeWeightedScore(metricScores, weights) {
  let activeWeightSum = 0;
  let weightedSum = 0;
  for (const [k, w] of Object.entries(weights)) {
    if (w <= 0) continue;
    const score = metricScores[k];
    if (score === null || score === undefined || !Number.isFinite(score)) continue;
    activeWeightSum += w;
    weightedSum += score * w;
  }
  if (activeWeightSum <= 0) return 0;
  return Number((weightedSum / activeWeightSum).toFixed(6));
}

function rankCatalogCandidates({ category, candidates = [], profile = {}, purchaseConditions = {}, hard: directHard, soft: directSoft }) {
  const hard = directHard || purchaseConditions?.hard || {};
  const soft = directSoft || purchaseConditions?.soft || {};
  const weights = computeCategoryWeights(category, profile, hard, soft);
  const eligibleEntries = [];
  const excludedCandidates = [];

  for (const cand of candidates) {
    const check = checkHardEligibility(cand, hard);
    if (!check.eligible) {
      excludedCandidates.push({
        sku_id: String(cand.sku_id),
        model_id: String(cand.model_id),
        model_name: cand.model_name,
        reason: check.reason
      });
      continue;
    }
    const eligibleReasons = buildEligibleReasonsForCatalog(cand, hard, soft);
    eligibleEntries.push({
      cand: { ...cand, eligible_reasons: eligibleReasons },
      priceKrw: check.priceKrw
    });
  }

  const policyVersion = POLICY_VERSIONS[category] || 'catalog-ranker-v1';
  if (eligibleEntries.length === 0) {
    return {
      policy_version: policyVersion,
      status: 'no_match',
      ranked_candidates: [],
      top_candidates: [],
      public_ranking: [],
      excluded_candidates: excludedCandidates,
      _internal_weights: weights
    };
  }

  const stats = {
    maxPrice: Math.max(...eligibleEntries.map(e => e.priceKrw)),
    maxBatteryMah: Math.max(0, ...eligibleEntries.map(e => e.cand.battery_mah || 0)),
    maxBatteryWh: Math.max(0, ...eligibleEntries.map(e => e.cand.battery_wh || 0)),
    maxBatteryHours: Math.max(0, ...eligibleEntries.map(e => e.cand.battery_hours || 0)),
    maxPowerW: Math.max(0, ...eligibleEntries.map(e => e.cand.power_w || 0))
  };

  const scored = eligibleEntries.map(({ cand, priceKrw }) => {
    const ev = evaluateCategoryCandidate(cand, priceKrw, profile, hard, soft, stats);
    const internalScore = clamp01(computeWeightedScore(ev.metric_scores, weights));
    return {
      candidate: cand,
      effective_price_krw: priceKrw,
      price_source: cand.price?.price_source || 'danawa_reference',
      released_on: cand.released_on,
      missing_metrics: ev.missing_metrics,
      insufficient_info: ev.insufficient_info,
      insufficient_info_notes: ev.insufficient_info_notes,
      price_caution: ev.price_caution,
      _internal_metric_scores: ev.metric_scores,
      _internal_score: internalScore
    };
  });

  scored.sort((a, b) => {
    if (b._internal_score !== a._internal_score) return b._internal_score - a._internal_score;
    if (a.effective_price_krw !== b.effective_price_krw) return a.effective_price_krw - b.effective_price_krw;
    const relA = a.released_on || '';
    const relB = b.released_on || '';
    if (relA !== relB) return relB.localeCompare(relA);
    return Number(a.candidate.sku_id) - Number(b.candidate.sku_id);
  });

  const ranked = scored.map((entry, idx) => ({ ...entry, rank: idx + 1 }));

  // Deduplicate by model_id so at most 1 best SKU per model appears in top 3
  const seenModels = new Set();
  const top = [];
  for (const entry of ranked) {
    const modelKey = `${entry.candidate.model_id}:${entry.candidate.model_number}`;
    if (seenModels.has(modelKey)) continue;
    seenModels.add(modelKey);
    top.push({ ...entry, rank: top.length + 1 });
    if (top.length === MAX_RECOMMENDED_ITEMS) break;
  }

  const publicRanking = top.map(entry => ({
    variant_id: String(entry.candidate.sku_id),
    sku_id: String(entry.candidate.sku_id),
    model_id: String(entry.candidate.model_id),
    rank: entry.rank,
    effective_price_krw: entry.effective_price_krw,
    price_source: entry.price_source,
    insufficient_info: entry.insufficient_info,
    insufficient_info_notes: entry.insufficient_info_notes,
    price_caution: entry.price_caution
  }));

  return {
    policy_version: policyVersion,
    status: 'recommend',
    ranked_candidates: ranked,
    top_candidates: top,
    public_ranking: publicRanking,
    excluded_candidates: excludedCandidates,
    _internal_weights: weights
  };
}

function buildCatalogObjectiveSummary(cand) {
  const specs = cand.specifications || {};
  const opts = cand.options || {};
  const parts = [`${cand.model_name} (${cand.model_number})`];
  if (cand.storage_gb != null) parts.push(`${cand.storage_gb}GB`);
  if (cand.ram_gb != null) parts.push(`RAM ${cand.ram_gb}GB`);
  if (opts.cpu || specs.cpu) parts.push(opts.cpu || specs.cpu);
  else if (specs.chipset) parts.push(specs.chipset);
  if (opts.gpu || specs.gpu) parts.push(opts.gpu || specs.gpu);
  if (cand.screen_inches != null) parts.push(`${cand.screen_inches}인치`);
  if (cand.case_size_mm != null) parts.push(`${cand.case_size_mm}mm`);
  if (cand.connectivity) parts.push(cand.connectivity.toUpperCase());
  if (cand.weight_g != null) parts.push(`${cand.weight_g}g`);
  return parts.join(' · ');
}

function buildCatalogEvidenceForCandidate(cand) {
  const evidence = [
    {
      variant_id: String(cand.sku_id),
      field: 'price',
      price_observation_id: cand.price?.observation_id ?? null,
      total_krw: cand.price?.amount_krw ?? null
    }
  ];
  for (const field of ['storage_gb', 'ram_gb', 'screen_inches', 'refresh_hz', 'battery_mah', 'battery_wh', 'battery_hours', 'weight_g', 'case_size_mm', 'power_w']) {
    if (typeof cand[field] === 'number' && Number.isFinite(cand[field])) {
      evidence.push({
        variant_id: String(cand.sku_id),
        field,
        value: cand[field]
      });
      if (evidence.length >= 4) break;
    }
  }
  return evidence;
}

function buildCatalogProsAndCons(entry, hard) {
  const cand = entry.candidate;
  const specs = cand.specifications || {};
  const opts = cand.options || {};
  const pros = [];

  for (const r of (cand.eligible_reasons || []).slice(0, 4)) {
    const desc = renderCatalogReasonDescription(r, cand, hard);
    if (desc && !pros.includes(desc)) pros.push(desc);
  }
  if (cand.storage_gb != null && pros.length < 4) pros.push(`저장 용량 ${cand.storage_gb}GB 구성`);
  if (cand.ram_gb != null && pros.length < 4) pros.push(`메모리 RAM ${cand.ram_gb}GB 탑재`);
  if ((opts.cpu || specs.cpu || specs.chipset) && pros.length < 4) {
    pros.push(`프로세서: ${opts.cpu || specs.cpu || specs.chipset}`);
  }
  if (cand.weight_g != null && pros.length < 4) pros.push(`무게 ${cand.weight_g}g`);

  const cons = [...(entry.insufficient_info_notes || [])];
  if (entry.price_caution && !cons.includes(entry.price_caution)) {
    cons.push(entry.price_caution);
  }
  if (!cons.length) {
    cons.push('실제 판매처별 재고 및 배송비 조건은 구매 링크에서 최종 확인이 필요합니다.');
  }
  return { pros: pros.slice(0, 4), cons: cons.slice(0, 3) };
}

function resolveTopEntriesAndRanking(rankingResult, aiContext) {
  if (rankingResult && Array.isArray(rankingResult.top_candidates)) {
    return {
      topEntries: rankingResult.top_candidates,
      serverRankingItems: rankingResult.public_ranking || []
    };
  }
  const serverRankingItems = Array.isArray(aiContext?.server_ranking?.items)
    ? aiContext.server_ranking.items
    : [];
  const candById = new Map((aiContext?.candidates_snapshot || []).map(c => [String(c.sku_id || c.variant_id), c]));
  const topEntries = serverRankingItems
    .map(sr => {
      const candidate = candById.get(String(sr.sku_id || sr.variant_id));
      if (!candidate) return null;
      return {
        candidate,
        rank: sr.rank,
        effective_price_krw: sr.effective_price_krw ?? candidate.price?.amount_krw ?? 0,
        price_source: sr.price_source ?? candidate.price?.price_source ?? 'danawa_reference',
        insufficient_info: Boolean(sr.insufficient_info),
        insufficient_info_notes: sr.insufficient_info_notes || [],
        price_caution: sr.price_caution || null
      };
    })
    .filter(Boolean);
  return { topEntries, serverRankingItems };
}

function buildCatalogFallbackRecommendationOutput(arg1, arg2 = null) {
  const aiContext = arg2 || arg1;
  const rankingResult = arg2 ? arg1 : null;
  const { topEntries } = resolveTopEntriesAndRanking(rankingResult, aiContext);
  const common = aiContext?.profile_snapshot?.common || {};
  const soft = aiContext?.purchase_conditions?.soft || {};
  const hard = aiContext?.purchase_conditions?.hard || {};

  const profileRefs = [];
  if (common.spending_style) profileRefs.push('common.spending_style');
  if (Array.isArray(common.usages) && common.usages.length) profileRefs.push('common.usages');
  if (Array.isArray(soft.preferred_brands) && soft.preferred_brands.length) profileRefs.push('soft.preferred_brands');
  if (soft.preferred_os) profileRefs.push('soft.preferred_os');
  if (Array.isArray(soft.priorities) && soft.priorities.length) profileRefs.push('soft.priorities');
  if (!profileRefs.length) profileRefs.push('common.usages');

  const items = topEntries.map(entry => {
    const cand = entry.candidate;
    const reasonCodes = (cand.eligible_reasons || []).map(r => r.code).slice(0, 3);
    const evidence = buildCatalogEvidenceForCandidate(cand);
    const { pros, cons } = buildCatalogProsAndCons(entry, hard);
    const uncertainties = [...(entry.insufficient_info_notes || [])];
    if (entry.price_caution && !uncertainties.includes(entry.price_caution)) {
      uncertainties.push(entry.price_caution);
    }
    const priceText = `${Number(entry.effective_price_krw).toLocaleString('ko-KR')}원`;
    const explanation = `${entry.rank}순위 추천: ${cand.brand} ${cand.model_name} (${buildCatalogObjectiveSummary(cand)}) — 참고 최저가 ${priceText} 기준으로 필수 조건과 사용 목적 가중치에 가장 잘 부합합니다.`;

    return {
      variant_id: String(cand.sku_id),
      rank: entry.rank,
      profile_refs: profileRefs,
      reason_codes: reasonCodes,
      evidence,
      uncertainties,
      explanation,
      pros,
      cons
    };
  });

  return {
    status: 'recommend',
    items,
    questions: []
  };
}

function validateCatalogRecommendationOutput(aiOutput, aiContext, rankingResult = null) {
  if (!isPlainObject(aiOutput)) {
    return { valid: false, errors: ['OUTPUT_NOT_OBJECT'] };
  }
  const status = aiOutput.status === 'success' ? 'recommend' : aiOutput.status;
  if (status !== 'recommend') {
    return { valid: false, errors: ['INVALID_STATUS'] };
  }
  const { topEntries, serverRankingItems } = resolveTopEntriesAndRanking(rankingResult, aiContext);
  if (!Array.isArray(aiOutput.items) || aiOutput.items.length !== serverRankingItems.length) {
    return { valid: false, errors: ['SERVER_RANKING_COUNT_MISMATCH'] };
  }

  const topBySkuId = new Map(topEntries.map(e => [String(e.candidate.sku_id), e]));
  const hard = aiContext?.purchase_conditions?.hard || {};
  const errors = [];
  const validatedItems = [];

  for (let i = 0; i < serverRankingItems.length; i++) {
    const expected = serverRankingItems[i];
    const actual = aiOutput.items[i];
    if (!isPlainObject(actual) || String(actual.variant_id || '') !== String(expected.variant_id) || actual.rank !== expected.rank) {
      return { valid: false, errors: [`SERVER_RANKING_MISMATCH:${i + 1}`] };
    }
    const entry = topBySkuId.get(String(expected.variant_id));
    if (!entry) {
      return { valid: false, errors: [`SKU_NOT_FOUND:${expected.variant_id}`] };
    }
    const cand = entry.candidate;

    if (!Array.isArray(actual.profile_refs) || actual.profile_refs.length === 0) {
      errors.push(`EMPTY_PROFILE_REFS:${cand.sku_id}`);
      continue;
    }

    const eligibleMap = new Map((cand.eligible_reasons || []).map(r => [r.code, r]));
    const rawCodes = Array.isArray(actual.reason_codes) ? actual.reason_codes : [];
    const verifiedReasons = [];
    const seenCodes = new Set();
    for (const code of rawCodes) {
      if (!ALLOWED_CATALOG_REASON_CODES.includes(code) || !eligibleMap.has(code)) {
        errors.push(`UNVERIFIED_REASON_FOR_CANDIDATE:${cand.sku_id}:${code}`);
        continue;
      }
      if (!seenCodes.has(code)) {
        seenCodes.add(code);
        const r = eligibleMap.get(code);
        verifiedReasons.push({
          code: r.code,
          field: r.field,
          value: r.value,
          description: renderCatalogReasonDescription(r, cand, hard)
        });
      }
    }
    if (verifiedReasons.length === 0) {
      errors.push(`NO_VALID_REASONS:${cand.sku_id}`);
      continue;
    }

    if (!Array.isArray(actual.evidence) || actual.evidence.length === 0) {
      errors.push(`EMPTY_EVIDENCE:${cand.sku_id}`);
      continue;
    }

    const verifiedEvidence = [];
    for (const ev of actual.evidence) {
      if (!isPlainObject(ev) || String(ev.variant_id) !== String(cand.sku_id) || !ALLOWED_CATALOG_EVIDENCE_FIELDS.includes(ev.field)) {
        errors.push(`INVALID_EVIDENCE_ENTRY:${cand.sku_id}`);
        continue;
      }
      if (ev.field === 'price') {
        const expectedObsId = String(cand.price.observation_id);
        const evObsId = ev.price_observation_id == null ? null : String(ev.price_observation_id);
        const expectedKrw = Number(cand.price.amount_krw);
        const evKrw = Number(ev.total_krw ?? ev.value);
        if (evObsId !== expectedObsId || evKrw !== expectedKrw) {
          errors.push(`PRICE_EVIDENCE_MISMATCH:${cand.sku_id}`);
          continue;
        }
        verifiedEvidence.push({
          variant_id: String(cand.sku_id),
          field: 'price',
          price_observation_id: expectedObsId,
          total_krw: null,
          budget_basis_krw: expectedKrw,
          price_source: cand.price.price_source
        });
      } else {
        const actualVal = cand[ev.field];
        if (actualVal === null || actualVal === undefined || Number(ev.value) !== Number(actualVal)) {
          errors.push(`SPEC_EVIDENCE_MISMATCH:${cand.sku_id}:${ev.field}`);
          continue;
        }
        verifiedEvidence.push({
          variant_id: String(cand.sku_id),
          field: ev.field,
          value: Number(actualVal)
        });
      }
    }
    if (errors.length > 0) continue;

    const { pros, cons } = buildCatalogProsAndCons(entry, hard);
    const uncertainties = [...(entry.insufficient_info_notes || [])];
    if (entry.price_caution && !uncertainties.includes(entry.price_caution)) {
      uncertainties.push(entry.price_caution);
    }
    const explanation = verifiedReasons.map(r => r.description).join(' ');

    const referencePrice = {
      observation_id: cand.price.observation_id,
      amount_minor: cand.price.amount_minor,
      amount_krw: cand.price.amount_krw,
      currency: cand.price.currency,
      seller_name: cand.price.seller_name,
      product_url: cand.price.product_url,
      observed_at: cand.price.observed_at,
      checked_at: cand.price.checked_at,
      scope: cand.price.scope,
      price_source: cand.price.price_source,
      label: cand.price.price_label
    };

    validatedItems.push({
      rank: expected.rank,
      category: cand.category,
      brand: cand.brand,
      model_id: String(cand.model_id),
      model_name: cand.model_name,
      model_number: cand.model_number,
      sku_id: String(cand.sku_id),
      sku_code: cand.sku_code,
      variant_id: String(cand.sku_id),
      smartphone_id: String(cand.model_id),
      storage_gb: cand.storage_gb,
      ram_gb: cand.ram_gb,
      color: cand.color,
      connectivity: cand.connectivity,
      options: cand.options,
      specifications: cand.specifications,
      reference_price: referencePrice,
      product: {
        category: cand.category,
        model_id: String(cand.model_id),
        sku_id: String(cand.sku_id),
        sku_code: cand.sku_code,
        brand: cand.brand,
        model_name: cand.model_name,
        model_number: cand.model_number,
        domestic_model_number: cand.model_number,
        released_on: cand.released_on,
        released_on_kr: cand.released_on_kr,
        storage_gb: cand.storage_gb,
        ram_gb: cand.ram_gb,
        color: cand.color,
        connectivity: cand.connectivity,
        screen_inches: cand.screen_inches,
        refresh_hz: cand.refresh_hz,
        battery_mah: cand.battery_mah,
        battery_wh: cand.battery_wh,
        battery_hours: cand.battery_hours,
        weight_g: cand.weight_g,
        specifications: cand.specifications,
        options: cand.options,
        objective_summary: buildCatalogObjectiveSummary(cand),
        sources: cand.sources
      },
      price: { ...cand.price },
      profile_refs: [...new Set(actual.profile_refs)],
      reasons: verifiedReasons,
      evidence: verifiedEvidence,
      ...(cand.comparison_with_owned ? {
        comparison_with_owned: cand.comparison_with_owned,
        verified_improvements: cand.comparison_with_owned.improvements || [],
        limitations: cand.comparison_with_owned.tradeoffs || [],
        cost_analysis: cand.comparison_with_owned.cost_analysis || null
      } : {}),
      cautions: uncertainties,
      uncertainties,
      explanation,
      pros,
      cons
    });
  }

  if (errors.length > 0 || validatedItems.length === 0) {
    return { valid: false, errors: errors.length ? errors : ['NO_VALIDATED_ITEMS'] };
  }
  return {
    valid: true,
    result: {
      status: 'recommend',
      items: validatedItems,
      questions: []
    }
  };
}

function buildCatalogRelaxationQuestions(category, hard) {
  const catLabel = categories[category] || category;
  const questions = [`조건을 모두 만족하는 ${catLabel} 후보가 없습니다. 완화가 가능한 조건을 선택해 주세요.`];
  if (hard.budget_max_krw !== null) {
    questions.push(`예산 상한(${hard.budget_max_krw.toLocaleString('ko-KR')}원)을 조정할 수 있나요?`);
  }
  if (hard.min_storage_gb !== null) {
    questions.push(`최소 저장 용량(${hard.min_storage_gb}GB) 조건을 낮출 수 있나요?`);
  }
  if (hard.min_ram_gb !== null) {
    questions.push(`최소 RAM(${hard.min_ram_gb}GB) 조건을 낮출 수 있나요?`);
  }
  if (hard.require_pen) {
    questions.push('펜 입력 필수 조건을 선호 조건으로 완화할 수 있나요?');
  }
  if (hard.require_anc) {
    questions.push('액티브 노이즈 캔슬링(ANC) 필수 조건을 완화할 수 있나요?');
  }
  if (hard.require_cellular) {
    questions.push('셀룰러(LTE) 필수 조건을 Wi-Fi/블루투스 모델까지 넓힐 수 있나요?');
  }
  if (hard.require_water_resistance) {
    questions.push('방수 등급 필수 조건을 완화할 수 있나요?');
  }
  if (Array.isArray(hard.allowed_brands) && hard.allowed_brands.length > 0) {
    questions.push('제조사 제한 범위를 넓힐 수 있나요?');
  }
  return questions;
}

function attachColorOptionsToCatalogItems(items, allCandidates) {
  return items.map(item => {
    const siblings = allCandidates.filter(c =>
      String(c.model_id) === String(item.model_id) &&
      c.storage_gb === item.product.storage_gb &&
      c.ram_gb === item.product.ram_gb &&
      c.connectivity === item.product.connectivity &&
      JSON.stringify(c.options) === JSON.stringify(item.product.options)
    );
    const colors = new Map();
    for (const s of siblings) {
      const colorKey = s.color || s.sku_code || s.sku_id;
      if (!colors.has(colorKey)) {
        colors.set(colorKey, {
          color: s.color,
          sku_id: String(s.sku_id),
          sku_code: s.sku_code,
          variant_id: String(s.sku_id)
        });
      }
    }
    return {
      ...item,
      representative_variant_id: String(item.sku_id),
      color_options: [...colors.values()]
    };
  });
}

module.exports = {
  COMMON_CATEGORIES,
  ALL_CATEGORIES,
  COMMON_BRANDS,
  POLICY_VERSIONS,
  ALLOWED_CATALOG_REASON_CODES,
  ALLOWED_CATALOG_EVIDENCE_FIELDS,
  detectCategoryFromText,
  inferSmartwatchCompatibleOs,
  validateCatalogRecommendationInput,
  fetchPublicCatalogCandidates,
  checkHardEligibility,
  buildEligibleReasonsForCatalog,
  renderCatalogReasonDescription,
  rankCatalogCandidates,
  buildCatalogEvidenceForCandidate,
  buildCatalogFallbackRecommendationOutput,
  validateCatalogRecommendationOutput,
  buildCatalogRelaxationQuestions,
  attachColorOptionsToCatalogItems
};
