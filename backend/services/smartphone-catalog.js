'use strict';

function fail(code = 'INVALID_INPUT', status = 422) {
  return Object.assign(new Error(code), { code, status });
}

function isPlainObject(x) {
  return Boolean(x) && typeof x === 'object' && !Array.isArray(x);
}

function object(x, keys) {
  if (!isPlainObject(x) || Object.keys(x).some(k => !keys.includes(k))) throw fail();
}

function id(x) {
  if (typeof x !== 'string' || !/^(?:[1-9][0-9]{0,19})$/.test(x) || BigInt(x) > 18446744073709551615n) throw fail();
  return x;
}

function integer(x, min = 1, max = 1000000) {
  if (!Number.isInteger(x) || x < min || x > max) throw fail();
  return x;
}

function str(x, max, nullable = false) {
  if (nullable && (x === undefined || x === null)) return null;
  if (typeof x !== 'string' || !x.trim() || [...x.trim()].length > max) throw fail();
  return x.trim();
}

function option(x, values) {
  if (x === undefined || x === null) return null;
  if (!values.includes(x)) throw fail();
  return x;
}

function boolOption(x) {
  if (x === undefined || x === null) return null;
  if (typeof x !== 'boolean') throw fail();
  return x;
}

function list(x, values, min, max) {
  if (!Array.isArray(x) || x.length < min || x.length > max || new Set(x).size !== x.length || x.some(v => !values.includes(v))) throw fail();
  return x;
}

const USAGES = ['communication', 'video', 'coding', 'gaming', 'camera', 'work'];
const BRANDS = ['samsung', 'apple'];
const OS_VALUES = ['android', 'ios'];
const PRIORITIES = ['battery', 'camera', 'performance', 'portability', 'display'];

const BRAND_OS = { samsung: 'android', apple: 'ios' };

// Date boundary: D in Asia/Seoul, inclusive [D - 3 calendar years, D]. Leap day Feb 29 -> Feb 28 in target year.
function kstDateString(nowInput = new Date()) {
  const d = nowInput instanceof Date ? nowInput : new Date(nowInput);
  if (Number.isNaN(d.getTime())) throw fail();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return fmt.format(d);
}

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
}

function releaseWindowKst(nowInput = new Date()) {
  const maxDate = typeof nowInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(nowInput)
    ? nowInput
    : kstDateString(nowInput);
  const [yStr, mStr, dStr] = maxDate.split('-');
  const targetYear = Number(yStr) - 3;
  const month = Number(mStr);
  let day = Number(dStr);
  if (month === 2 && day === 29 && !isLeapYear(targetYear)) {
    day = 28;
  }
  const minDate = `${String(targetYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { minDate, maxDate };
}

function isWithinReleaseWindow(releasedOnKr, nowInput = new Date()) {
  if (!releasedOnKr || typeof releasedOnKr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(releasedOnKr)) return false;
  const { minDate, maxDate } = releaseWindowKst(nowInput);
  return releasedOnKr >= minDate && releasedOnKr <= maxDate;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// Evaluate a single price observation against reference timestamp `now`
function evaluateObservation(obs, nowInput = new Date()) {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const nowMs = now.getTime();
  const observedAt = obs.observed_at instanceof Date ? obs.observed_at : new Date(obs.observed_at);
  const expiresAt = obs.expires_at instanceof Date ? obs.expires_at : new Date(obs.expires_at);
  const obsMs = observedAt.getTime();
  const expMs = expiresAt.getTime();

  const amount = Number(obs.amount_krw);
  const shippingKnown = obs.shipping_krw !== null && obs.shipping_krw !== undefined;
  const shipping = shippingKnown ? Number(obs.shipping_krw) : null;
  const total = shippingKnown && Number.isInteger(amount) && amount > 0 && Number.isInteger(shipping) && shipping >= 0
    ? amount + shipping
    : null;

  const validPeriod = Number.isFinite(obsMs) && Number.isFinite(expMs) && expMs > obsMs && (expMs - obsMs) <= TWENTY_FOUR_HOURS_MS;
  const isFresh = validPeriod && obsMs <= nowMs && nowMs < expMs;
  const isFuture = Number.isFinite(obsMs) && obsMs > nowMs;
  const isExpired = validPeriod && nowMs >= expMs;

  const flagsOk = ['unconditional', 'in_stock', 'is_new', 'is_unlocked'].every(key => obs[key] === true || obs[key] === 1);
  const eligible = isFresh && !isFuture && flagsOk && total !== null;

  return {
    observation_id: String(obs.id),
    variant_id: String(obs.variant_id),
    source_name: obs.source_name,
    source_url: obs.source_url,
    seller_name: obs.seller_name,
    amount_krw: amount,
    shipping_krw: shipping,
    total_krw: total,
    observed_at: observedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    conditions_text: obs.conditions_text,
    unconditional: Boolean(obs.unconditional),
    in_stock: Boolean(obs.in_stock),
    is_new: Boolean(obs.is_new),
    is_unlocked: Boolean(obs.is_unlocked),
    is_expired: !isFresh || isExpired,
    eligible
  };
}

// Group by (source_name, seller_name), pick latest by (observed_at DESC, id DESC) per seller+source,
// then select lowest total_krw among eligible latest observations.
function selectBestPrice(observations, nowInput = new Date()) {
  if (!Array.isArray(observations) || observations.length === 0) {
    return { selected: null, latest_by_seller: [] };
  }
  const latestMap = new Map();
  for (const raw of observations) {
    const key = `${raw.source_name}\u0000${raw.seller_name}`;
    const current = latestMap.get(key);
    if (!current) {
      latestMap.set(key, raw);
      continue;
    }
    const rawTime = new Date(raw.observed_at).getTime();
    const curTime = new Date(current.observed_at).getTime();
    if (rawTime > curTime || (rawTime === curTime && BigInt(String(raw.id)) > BigInt(String(current.id)))) {
      latestMap.set(key, raw);
    }
  }

  const evaluatedLatest = [];
  for (const raw of latestMap.values()) {
    evaluatedLatest.push(evaluateObservation(raw, nowInput));
  }

  evaluatedLatest.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (a.total_krw !== null && b.total_krw !== null && a.total_krw !== b.total_krw) {
      return a.total_krw - b.total_krw;
    }
    const tA = new Date(a.observed_at).getTime();
    const tB = new Date(b.observed_at).getTime();
    if (tA !== tB) return tB - tA;
    return BigInt(a.observation_id) < BigInt(b.observation_id) ? -1 : 1;
  });

  const eligibleList = evaluatedLatest.filter(x => x.eligible);
  return {
    selected: eligibleList.length > 0 ? eligibleList[0] : null,
    latest_by_seller: evaluatedLatest
  };
}

function validateCatalogQuery(q) {
  object(q, ['brand', 'os', 'storage_gb', 'only_recommendable', 'include_test', 'limit', 'cursor']);
  let limit = 20;
  if (q.limit !== undefined) {
    if (typeof q.limit !== 'string' || !/^[1-9][0-9]?$/.test(q.limit)) throw fail();
    limit = integer(Number(q.limit), 1, 50);
  }
  const cursor = q.cursor === undefined ? '0' : id(q.cursor);
  const brand = q.brand === undefined ? null : option(q.brand, BRANDS);
  const os = q.os === undefined ? null : option(q.os, OS_VALUES);
  let storage_gb = null;
  if (q.storage_gb !== undefined) {
    if (typeof q.storage_gb !== 'string' || !/^[1-9][0-9]{0,3}$/.test(q.storage_gb)) throw fail();
    storage_gb = integer(Number(q.storage_gb), 1, 4096);
  }
  let only_recommendable = true;
  if (q.only_recommendable !== undefined) {
    if (q.only_recommendable !== 'true' && q.only_recommendable !== 'false') throw fail();
    only_recommendable = q.only_recommendable === 'true';
  }
  let include_test = false;
  if (q.include_test !== undefined) {
    if (q.include_test !== 'true' && q.include_test !== 'false') throw fail();
    include_test = q.include_test === 'true';
    if (include_test && process.env.NODE_ENV !== 'test') throw fail();
  }
  return { brand, os, storage_gb, only_recommendable, include_test, limit, cursor };
}

// Validate candidate search / recommendation input body.
// Semantic missing budget_max_krw or usages returns clarify questions instead of 422,
// while invalid types/ranges/unknown keys throw 422 INVALID_INPUT.
function validateCandidateInput(body, profileSmartphone = {}) {
  object(body, ['expected_profile_version', 'hard', 'soft', 'replacement_device_id', 'purchase_reason', 'upgrade_context', 'include_test']);
  const expected_profile_version = integer(body.expected_profile_version, 1, 4294967295);
  if (!isPlainObject(body.hard)) throw fail();
  object(body.hard, [
    'budget_max_krw',
    'usages',
    'allowed_brands',
    'required_os',
    'min_storage_gb',
    'max_weight_g',
    'min_refresh_hz',
    'require_5g',
    'require_wireless_charging'
  ]);

  const h = body.hard;
  const questions = [];

  let budget_max_krw = null;
  if (h.budget_max_krw === undefined || h.budget_max_krw === null) {
    questions.push('최대 예산(원)을 확인해 주세요.');
  } else {
    budget_max_krw = integer(h.budget_max_krw, 1, 10000000);
  }

  let usages = null;
  if (h.usages === undefined || h.usages === null || (Array.isArray(h.usages) && h.usages.length === 0)) {
    questions.push('이번 구매의 주요 사용 목적을 1개 이상 선택해 주세요.');
  } else {
    usages = list(h.usages, USAGES, 1, 6);
  }

  const allowed_brands = h.allowed_brands === undefined || h.allowed_brands === null
    ? ['samsung', 'apple']
    : list(h.allowed_brands, BRANDS, 1, 2);

  const required_os = option(h.required_os, OS_VALUES);
  const min_storage_gb = h.min_storage_gb === undefined || h.min_storage_gb === null ? null : integer(h.min_storage_gb, 1, 4096);
  const max_weight_g = h.max_weight_g === undefined || h.max_weight_g === null ? null : integer(h.max_weight_g, 1, 2000);
  const min_refresh_hz = h.min_refresh_hz === undefined || h.min_refresh_hz === null ? null : integer(h.min_refresh_hz, 1, 1000);
  const require_5g = boolOption(h.require_5g) === true;
  const require_wireless_charging = boolOption(h.require_wireless_charging) === true;

  // Check contradictory hard conditions (e.g., Samsung only + iOS, or Apple only + Android)
  if (required_os) {
    const compatibleBrands = allowed_brands.filter(b => BRAND_OS[b] === required_os);
    if (compatibleBrands.length === 0) {
      questions.push('선택한 필수 제조사와 필수 운영체제(OS) 조건이 서로 충돌합니다. 조건을 확인해 주세요.');
    }
  }

  let softInput = {};
  if (body.soft !== undefined && body.soft !== null) {
    object(body.soft, ['preferred_brands', 'priorities', 'preferred_os']);
    softInput = body.soft;
  }

  const mergedSoft = {
    preferred_brands: softInput.preferred_brands !== undefined
      ? list(softInput.preferred_brands === null ? [] : softInput.preferred_brands, BRANDS, 0, 2)
      : (Array.isArray(profileSmartphone.preferred_brands) ? profileSmartphone.preferred_brands : []),
    priorities: softInput.priorities !== undefined
      ? list(softInput.priorities === null ? [] : softInput.priorities, PRIORITIES, 0, 3)
      : (Array.isArray(profileSmartphone.priorities) ? profileSmartphone.priorities : []),
    preferred_os: softInput.preferred_os !== undefined
      ? option(softInput.preferred_os, OS_VALUES)
      : (profileSmartphone.preferred_os || null)
  };

  const replacement_device_id = body.replacement_device_id === undefined || body.replacement_device_id === null
    ? null
    : id(body.replacement_device_id);
  const purchase_reason = str(body.purchase_reason, 300, true);
  const upgrade_context = body.upgrade_context === undefined ? null : body.upgrade_context;

  let include_test = false;
  if (body.include_test !== undefined) {
    if (typeof body.include_test !== 'boolean') throw fail();
    if (body.include_test && process.env.NODE_ENV !== 'test') throw fail();
    include_test = body.include_test;
  }

  return {
    expected_profile_version,
    hard: {
      budget_max_krw,
      usages,
      allowed_brands,
      required_os,
      min_storage_gb,
      max_weight_g,
      min_refresh_hz,
      require_5g,
      require_wireless_charging
    },
    soft: mergedSoft,
    replacement_device_id,
    purchase_reason,
    upgrade_context,
    include_test,
    clarify_questions: questions
  };
}

function effectiveBudgetPriceKrw(price) {
  if (!price || !price.eligible) return null;
  if (Number.isSafeInteger(price.total_krw) && price.total_krw > 0) return price.total_krw;
  if (price.development_only === true && Number.isSafeInteger(price.budget_basis_krw) && price.budget_basis_krw > 0) {
    return price.budget_basis_krw;
  }
  return null;
}

function matchesHardConditions(candidate, hard, nowInput = new Date()) {
  if (!BRANDS.includes(candidate.brand)) return false;
  if (!candidate.phone_verified || !candidate.variant_verified) return false;
  if (!candidate.domestic_model_number || !candidate.released_on_kr || !candidate.os) return false;
  if (!isWithinReleaseWindow(candidate.released_on_kr, nowInput)) return false;
  if (!hard.allowed_brands.includes(candidate.brand)) return false;
  if (hard.required_os && candidate.os !== hard.required_os) return false;
  if (hard.min_storage_gb !== null) {
    if (candidate.storage_gb === null || candidate.storage_gb === undefined || Number(candidate.storage_gb) < hard.min_storage_gb) return false;
  }
  if (hard.max_weight_g !== null) {
    if (candidate.weight_g === null || candidate.weight_g === undefined || Number(candidate.weight_g) > hard.max_weight_g) return false;
  }
  if (hard.min_refresh_hz !== null) {
    if (candidate.refresh_hz === null || candidate.refresh_hz === undefined || Number(candidate.refresh_hz) < hard.min_refresh_hz) return false;
  }
  if (hard.require_5g && candidate.supports_5g !== true && candidate.supports_5g !== 1) return false;
  if (hard.require_wireless_charging && candidate.wireless_charging !== true && candidate.wireless_charging !== 1) return false;
  const basisPrice = effectiveBudgetPriceKrw(candidate.price);
  if (basisPrice === null) return false;
  if (hard.budget_max_krw !== null && basisPrice > hard.budget_max_krw) return false;
  return true;
}

// Compute verified objective reason codes that AI can later reference without hallucinating
function buildEligibleReasons(candidate, hard, soft, replacementDevice) {
  const reasons = [];
  if (hard.min_storage_gb !== null && Number(candidate.storage_gb) >= hard.min_storage_gb) {
    reasons.push({ code: 'storage_meets_requirement', field: 'storage_gb', value: Number(candidate.storage_gb) });
  }
  const basisPrice = effectiveBudgetPriceKrw(candidate.price);
  if (hard.budget_max_krw !== null && basisPrice !== null && basisPrice < hard.budget_max_krw) {
    reasons.push({ code: 'budget_headroom', field: 'total_krw', value: hard.budget_max_krw - basisPrice });
  }
  if (Array.isArray(soft.preferred_brands) && soft.preferred_brands.includes(candidate.brand)) {
    reasons.push({ code: 'preferred_brand_match', field: 'brand', value: candidate.brand });
  }
  if (soft.preferred_os && candidate.os === soft.preferred_os) {
    reasons.push({ code: 'preferred_os_match', field: 'os', value: candidate.os });
  }
  // Only compare with owned device if the owned device is a verified catalog smartphone
  if (replacementDevice && replacementDevice.source === 'catalog' && replacementDevice.product && replacementDevice.product.verified) {
    const ownedWeight = replacementDevice.product.weight_g !== null && replacementDevice.product.weight_g !== undefined
      ? Number(replacementDevice.product.weight_g)
      : null;
    const candWeight = candidate.weight_g !== null && candidate.weight_g !== undefined
      ? Number(candidate.weight_g)
      : null;
    if (ownedWeight !== null && candWeight !== null && candWeight < ownedWeight) {
      reasons.push({ code: 'lighter_than_owned', field: 'weight_g', value: candWeight });
    }
    const ownedRefresh = replacementDevice.product.refresh_hz !== null && replacementDevice.product.refresh_hz !== undefined
      ? Number(replacementDevice.product.refresh_hz)
      : null;
    const candRefresh = candidate.refresh_hz !== null && candidate.refresh_hz !== undefined
      ? Number(candidate.refresh_hz)
      : null;
    if (ownedRefresh !== null && candRefresh !== null && candRefresh > ownedRefresh) {
      reasons.push({ code: 'higher_refresh_than_owned', field: 'refresh_hz', value: candRefresh });
    }
  }
  return reasons;
}

function buildRelaxationQuestions(hard) {
  const questions = ['조건을 모두 만족하는 스마트폰 후보가 없습니다. 완화가 가능한 조건을 선택해 주세요.'];
  if (hard.budget_max_krw !== null) {
    questions.push(`예산 상한(${hard.budget_max_krw.toLocaleString('ko-KR')}원)을 조정할 수 있나요?`);
  }
  if (hard.min_storage_gb !== null) {
    questions.push(`최소 저장 용량(${hard.min_storage_gb}GB) 조건을 낮출 수 있나요?`);
  }
  if (hard.max_weight_g !== null) {
    questions.push(`최대 무게(${hard.max_weight_g}g) 제한을 완화할 수 있나요?`);
  }
  if (hard.min_refresh_hz !== null) {
    questions.push(`최소 주사율(${hard.min_refresh_hz}Hz) 제한을 완화할 수 있나요?`);
  }
  if (hard.allowed_brands.length === 1 || hard.required_os !== null) {
    questions.push('제조사 또는 운영체제(OS) 범위를 넓힐 수 있나요?');
  }
  return questions;
}

module.exports = {
  fail,
  id,
  object,
  kstDateString,
  releaseWindowKst,
  isWithinReleaseWindow,
  evaluateObservation,
  selectBestPrice,
  effectiveBudgetPriceKrw,
  validateCatalogQuery,
  validateCandidateInput,
  matchesHardConditions,
  buildEligibleReasons,
  buildRelaxationQuestions
};
