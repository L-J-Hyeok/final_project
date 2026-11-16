'use strict';

const catalog = require('./smartphone-catalog');
const { performanceDimensions } = require('./chipset-performance');
const { comparableScores, partialScoreAdjustments } = require('./smartphone-performance');

const RANKING_POLICY_VERSION = 'smartphone-ranker-v2';
const MAX_RECOMMENDED_ITEMS = 3;

const PRICE_SOURCE_RELIABILITY = {
  verified_sale: 1.0,
  danawa_reference: 0.96,
  reference_sale: 0.90,
  dev_launch_price_fallback: 0.85
};

const PRICE_SOURCE_RANK_PRIORITY = {
  verified_sale: 4,
  danawa_reference: 3,
  reference_sale: 2,
  dev_launch_price_fallback: 1
};

const BASE_METRIC_WEIGHTS = {
  budget_fit: 0.25,
  storage: 0.15,
  portability: 0.15,
  display: 0.15,
  battery: 0.15,
  memory_spec: 0.05,
  feature_preference: 0.10
};

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

function getEffectivePriceKrw(price) {
  if (!price || typeof price !== 'object') return null;
  if (price.eligible === false && price.price_source !== 'danawa_reference') return null;
  if (Number.isSafeInteger(price.total_krw) && price.total_krw > 0) return price.total_krw;
  if (Number.isSafeInteger(price.budget_basis_krw) && price.budget_basis_krw > 0) return price.budget_basis_krw;
  if (Number.isSafeInteger(price.amount_krw) && price.amount_krw > 0) return price.amount_krw;
  return null;
}

function isPriceExpired(price, now = new Date()) {
  if (!price || typeof price !== 'object') return true;
  if (price.development_only === true || price.price_source === 'dev_launch_price_fallback') {
    return false;
  }
  if (price.retained_observation || !price.expires_at) return false;
  const expMs = new Date(price.expires_at).getTime();
  if (!Number.isFinite(expMs)) return true;
  return now.getTime() >= expMs;
}

function computeUserMetricWeights(profile = {}, purchaseConditions = {}) {
  const common = profile?.common || {};
  const soft = purchaseConditions?.soft || {};
  const hard = purchaseConditions?.hard || {};

  const weights = { ...BASE_METRIC_WEIGHTS };

  // 1. Spending style adjustments
  if (common.spending_style === 'value') {
    weights.budget_fit += 0.18;
    weights.storage += 0.02;
    weights.battery += 0.02;
    weights.display -= 0.05;
    weights.memory_spec -= 0.02;
  } else if (common.spending_style === 'premium') {
    weights.budget_fit -= 0.10;
    weights.storage += 0.06;
    weights.display += 0.06;
    weights.memory_spec += 0.04;
    weights.battery += 0.02;
  }

  // 2. Mobility adjustments
  if (common.mobility === 'high') {
    weights.portability += 0.12;
    weights.battery += 0.06;
    weights.budget_fit -= 0.04;
  } else if (common.mobility === 'low') {
    weights.portability -= 0.06;
    weights.display += 0.06;
  }

  // 3. Usage adjustments (explicit hard.usages overrides profile.common.usages)
  const usages = Array.isArray(hard.usages) && hard.usages.length
    ? hard.usages
    : (Array.isArray(common.usages) ? common.usages : []);

  for (const usage of usages) {
    if (usage === 'video') {
      weights.display += 0.07;
      weights.battery += 0.04;
    } else if (usage === 'gaming') {
      weights.display += 0.08;
      weights.memory_spec += 0.06;
      weights.battery += 0.05;
    } else if (usage === 'coding' || usage === 'work') {
      weights.memory_spec += 0.05;
      weights.storage += 0.05;
      weights.battery += 0.04;
    } else if (usage === 'communication') {
      weights.battery += 0.04;
      weights.portability += 0.04;
    }
  }

  // 4. Priority boosts (ordered preference)
  const priorities = Array.isArray(soft.priorities) ? soft.priorities : [];
  const priorityBoosts = [0.14, 0.09, 0.05];
  priorities.forEach((prio, idx) => {
    const boost = priorityBoosts[idx] ?? 0.04;
    if (prio === 'portability') weights.portability += 2 * boost;
    else if (prio === 'battery') weights.battery += boost;
    else if (prio === 'display') weights.display += boost;
    else if (prio === 'performance') weights.memory_spec += boost * 0.5;
  });

  // 5. Feature/brand/OS preferences
  const hasBrandPref = Array.isArray(soft.preferred_brands) && soft.preferred_brands.length > 0;
  const hasOsPref = Boolean(soft.preferred_os);
  const hasEcoPref = common.ecosystem === 'apple' || common.ecosystem === 'android';
  if (!hasBrandPref && !hasOsPref && !hasEcoPref) {
    weights.feature_preference = 0;
  } else {
    weights.feature_preference += 0.06;
  }

  // Clamp and normalize to sum = 1.0
  let sum = 0;
  for (const key of Object.keys(weights)) {
    weights[key] = Math.max(0, weights[key]);
    sum += weights[key];
  }
  if (sum > 0) {
    for (const key of Object.keys(weights)) {
      weights[key] = Number((weights[key] / sum).toFixed(6));
    }
  }
  return weights;
}

function validateCandidateEligibility(cand, hard = {}, upgradeDecision = null, now = new Date(), options = {}) {
  if (!cand || typeof cand !== 'object') {
    return { eligible: false, reason: 'INVALID_CANDIDATE' };
  }
  if (!cand.variant_id || !cand.smartphone_id) {
    return { eligible: false, reason: 'MISSING_IDENTITY' };
  }
  if (cand.phone_verified === false || cand.variant_verified === false) {
    return { eligible: false, reason: 'UNVERIFIED_PRODUCT' };
  }
  if (!options.trustPreFilteredCandidates) {
    if (!cand.domestic_model_number || !cand.released_on_kr || !cand.os || !cand.storage_gb) {
      return { eligible: false, reason: 'INCOMPLETE_IDENTITY_SPECS' };
    }
    if (!catalog.isWithinReleaseWindow(cand.released_on_kr, now)) {
      return { eligible: false, reason: 'OUTSIDE_RELEASE_WINDOW' };
    }
  } else if (cand.released_on_kr && !catalog.isWithinReleaseWindow(cand.released_on_kr, now)) {
    return { eligible: false, reason: 'OUTSIDE_RELEASE_WINDOW' };
  }
  if (Array.isArray(hard.allowed_brands) && hard.allowed_brands.length && !hard.allowed_brands.includes(cand.brand)) {
    return { eligible: false, reason: 'BRAND_FILTER_MISMATCH' };
  }
  if (hard.required_os && cand.os !== hard.required_os) {
    return { eligible: false, reason: 'OS_FILTER_MISMATCH' };
  }
  if (hard.min_storage_gb != null && Number(cand.storage_gb) < hard.min_storage_gb) {
    return { eligible: false, reason: 'STORAGE_BELOW_MIN' };
  }
  if (hard.max_weight_g != null) {
    const w = toFiniteNumber(cand.weight_g);
    if (w === null || w > hard.max_weight_g) {
      return { eligible: false, reason: 'WEIGHT_ABOVE_MAX' };
    }
  }
  if (hard.min_refresh_hz != null) {
    const hz = toFiniteNumber(cand.refresh_hz);
    if (hz === null || hz < hard.min_refresh_hz) {
      return { eligible: false, reason: 'REFRESH_BELOW_MIN' };
    }
  }
  if (hard.require_5g && cand.supports_5g !== true && cand.supports_5g !== 1) {
    return { eligible: false, reason: 'MISSING_5G' };
  }
  if (hard.require_wireless_charging && cand.wireless_charging !== true && cand.wireless_charging !== 1) {
    return { eligible: false, reason: 'MISSING_WIRELESS_CHARGING' };
  }

  const rawPriceKrw = getEffectivePriceKrw(cand.price);
  const priceExpired = rawPriceKrw !== null && !options.skipPriceExpiryCheck && isPriceExpired(cand.price, now);
  const validPriceKrw = rawPriceKrw !== null && !priceExpired ? rawPriceKrw : null;

  // 엄격한 예산 상한 조건이 있는 경우, 가격 누락·만료 후보는 조건 충족 근거가 없으므로 제외
  if ((hard.budget_unlimited || hard.budget_max_krw != null) && validPriceKrw === null) {
    return { eligible: false, reason: 'PRICE_MISSING_OR_EXPIRED' };
  }
  if (hard.budget_max_krw != null && validPriceKrw > hard.budget_max_krw) {
    return { eligible: false, reason: 'OVER_BUDGET' };
  }

  if (upgradeDecision?.status === 'recommend' && Array.isArray(upgradeDecision.eligible_variant_ids)) {
    if (!upgradeDecision.eligible_variant_ids.includes(String(cand.variant_id))) {
      return { eligible: false, reason: 'NOT_IN_UPGRADE_ELIGIBLE' };
    }
  }

  return { eligible: true, priceKrw: validPriceKrw, priceExpired };
}

// Reward meeting a recommendation target, then taper the benefit of extra capacity.
function capacityFit(value, target) {
  if (value <= target) return 0.8 * value / target;
  return 1 - 0.2 * target / value;
}

function evaluateCandidateMetrics(cand, priceKrw, profile = {}, purchaseConditions = {}, maxObservedPrice = null, priceExpired = false) {
  const common = profile?.common || {};
  const hard = purchaseConditions?.hard || {};
  const soft = purchaseConditions?.soft || {};
  const priorities = Array.isArray(soft.priorities) ? soft.priorities : [];
  const usages = Array.isArray(hard.usages) && hard.usages.length
    ? hard.usages
    : (Array.isArray(common.usages) ? common.usages : []);

  const missingMetrics = [];
  const insufficientInfoNotes = [];
  let priceCaution = null;

  // 1. Budget fit & price source reliability (가격 누락·만료 시 0점 치환 없이 null 유지 및 정보 부족 표시)
  const priceSource = priceKrw !== null ? (cand.price?.price_source || 'verified_sale') : null;
  let budget_fit = null;
  if (priceKrw !== null) {
    const reliability = PRICE_SOURCE_RELIABILITY[priceSource] ?? 0.90;
    const budgetCeiling = hard.budget_max_krw != null ? hard.budget_max_krw : (maxObservedPrice || priceKrw);
    const headroomRatio = budgetCeiling > 0
      ? clamp01((budgetCeiling - priceKrw) / budgetCeiling)
      : 0.5;
    // Blend headroom with base reliability so lower price within budget scores better without ignoring source trust
    budget_fit = clamp01((0.3 + 0.7 * headroomRatio) * reliability);

    if (priceSource === 'danawa_reference') {
      priceCaution = '다나와 수집 당시 참고 가격이며, 배송비 및 실제 구매 조건에 따라 가격이 달라질 수 있습니다.';
    } else if (cand.price?.development_only || priceSource === 'dev_launch_price_fallback') {
      priceCaution = '개발용 국내 공식 출고가 참고치이며 현재 실제 판매가가 아닙니다.';
    }
  } else {
    missingMetrics.push('budget_fit');
    insufficientInfoNotes.push('유효한 가격 정보가 없어 가성비·예산 적합도 평가에서 제외되었습니다.');
    priceCaution = priceExpired
      ? '가격 관측치가 만료되어 현재 유효한 가격으로 평가할 수 없습니다.'
      : '확인된 가격 정보가 없어 가성비 평가가 보류되었습니다.';
  }

  // 2. Storage (objective GB)
  const storageGb = toFiniteNumber(cand.storage_gb);
  let storage = null;
  if (storageGb !== null && storageGb > 0) {
    const baseline = usages.some(usage => ['camera', 'gaming', 'coding', 'work'].includes(usage)) ? 256 : 128;
    const target = Math.max(baseline, hard.min_storage_gb || 0);
    storage = capacityFit(storageGb, target);
  } else {
    missingMetrics.push('storage');
    insufficientInfoNotes.push('저장 용량 정보가 없어 저장 공간 평가에서 제외되었습니다.');
  }

  // 3. Portability (weight_g + context-aware screen_inches; bigger screen is NOT always better)
  const weightG = toFiniteNumber(cand.weight_g);
  const screenInches = toFiniteNumber(cand.screen_inches);
  let portability = null;
  if (weightG !== null && weightG > 0) {
    const weightScore = 1 - clamp01((weightG - 130) / (260 - 130));
    if (screenInches !== null && screenInches > 0) {
      const compactPreferred = common.mobility === 'high' || priorities.includes('portability');
      const screenFit = compactPreferred
        ? 1 - clamp01((screenInches - 6.1) / 0.9)
        : 1 - Math.min(1, Math.abs(screenInches - 6.4) / 1.0);
      portability = compactPreferred
        ? (weightScore + screenFit + 2 * Math.min(weightScore, screenFit)) / 4
        : 0.75 * weightScore + 0.25 * screenFit;
    } else {
      if (priorities.includes('portability') || common.mobility === 'high') {
        insufficientInfoNotes.push('화면 크기 정보가 없어 작은 기기 선호를 완전히 평가할 수 없습니다.');
      }
      portability = priorities.includes('portability') || common.mobility === 'high' ? weightScore * 0.5 : weightScore;
    }
  } else {
    missingMetrics.push('portability');
    insufficientInfoNotes.push('무게(g) 정보가 없어 휴대성 정량 평가에서 제외되었습니다.');
  }

  // 4. Display (refresh_hz + usage-appropriate screen_inches)
  const refreshHz = toFiniteNumber(cand.refresh_hz);
  let display = null;
  const displayParts = [];
  if (refreshHz !== null && refreshHz > 0) {
    displayParts.push(clamp01((refreshHz - 60) / 60));
  } else {
    insufficientInfoNotes.push('화면 주사율(Hz) 정보가 누락되어 있습니다.');
  }
  if (screenInches !== null && screenInches > 0) {
    const largeMediaUsage = (usages.includes('video') || usages.includes('gaming')) && !priorities.includes('portability');
    const screenDisplayScore = largeMediaUsage
      ? clamp01((screenInches - 5.8) / 1.0)
      : 1 - Math.min(1, Math.max(0, Math.abs(screenInches - 6.4) - 0.3) / 0.7);
    displayParts.push(screenDisplayScore);
  }
  if (displayParts.length > 0) {
    display = displayParts.reduce((a, b) => a + b, 0) / displayParts.length;
  } else {
    missingMetrics.push('display');
    insufficientInfoNotes.push('화면 사양 정보가 없어 디스플레이 평가에서 제외되었습니다.');
  }

  // 5. Battery (diminishing returns on battery_mah, never equated with real-world SOT)
  const batteryMah = toFiniteNumber(cand.battery_mah);
  let battery = null;
  if (batteryMah !== null && batteryMah > 0) {
    battery = clamp01((batteryMah - 2800) / (5000 - 2800));
    insufficientInfoNotes.push('배터리 용량(mAh)은 실사용 시간 측정값이 아닙니다.');
  } else {
    missingMetrics.push('battery');
    insufficientInfoNotes.push('배터리 용량(mAh) 정보가 없어 배터리 평가에서 제외되었습니다.');
  }

  // 6. Memory spec (RAM GB only; NEVER fabricate chipset/camera scores)
  const ramGb = toFiniteNumber(cand.ram_gb);
  let memory_spec = null;
  if (ramGb !== null && ramGb > 0) {
    const target = usages.some(usage => ['gaming', 'coding', 'work'].includes(usage)) ? 8 : 6;
    memory_spec = capacityFit(ramGb, target);
  } else {
    missingMetrics.push('memory_spec');
    insufficientInfoNotes.push('RAM 용량 정보가 없어 메모리 사양 평가에서 제외되었습니다.');
  }

  if (priorities.includes('camera') || usages.includes('camera')) {
    insufficientInfoNotes.push('카메라 실사용 화질의 정량 비교 자료는 포함되어 있지 않습니다.');
  }
  if (performanceIntent(profile, purchaseConditions)) {
    insufficientInfoNotes.push('칩셋 벤치마크 실측 점수가 없어 RAM·주사율 등 확인된 사양 위주로 비교했습니다.');
  }

  // 7. Feature / brand / OS / ecosystem preferences
  const prefChecks = [];
  if (Array.isArray(soft.preferred_brands) && soft.preferred_brands.length > 0) {
    prefChecks.push(soft.preferred_brands.includes(cand.brand) ? 1 : 0);
  }
  if (soft.preferred_os) {
    prefChecks.push(cand.os === soft.preferred_os ? 1 : 0);
  }
  if (common.ecosystem === 'apple') {
    prefChecks.push(cand.os === 'ios' ? 1 : 0);
  } else if (common.ecosystem === 'android') {
    prefChecks.push(cand.os === 'android' ? 1 : 0);
  }
  const feature_preference = prefChecks.length > 0
    ? prefChecks.reduce((a, b) => a + b, 0) / prefChecks.length
    : null;

  return {
    metric_scores: {
      budget_fit,
      storage,
      portability,
      display,
      battery,
      memory_spec,
      feature_preference
    },
    missing_metrics: missingMetrics,
    insufficient_info: missingMetrics.length > 0 || insufficientInfoNotes.length > 0,
    insufficient_info_notes: [...new Set(insufficientInfoNotes)],
    price_caution: priceCaution
  };
}

function computeWeightedScore(metricScores, weights) {
  let weightedSum = 0;
  let availableWeightSum = 0;
  let activeWeightSum = 0;

  for (const [metric, weight] of Object.entries(weights)) {
    if (!weight || weight <= 0) continue;
    const val = metricScores[metric];
    if (val === null || val === undefined) {
      // Only count as missing in activeWeightSum if it's an objective spec metric (not optional feature_preference)
      if (metric !== 'feature_preference') {
        activeWeightSum += weight;
      }
      continue;
    }
    activeWeightSum += weight;
    availableWeightSum += weight;
    weightedSum += weight * val;
  }

  if (availableWeightSum <= 0) return 0;
  const rawAvailableAvg = weightedSum / availableWeightSum;
  const coverageRatio = activeWeightSum > 0 ? availableWeightSum / activeWeightSum : 1;
  // Penalize sparse-spec candidates gently rather than substituting 0 or inflating via full weight redistribution
  const adjusted = rawAvailableAvg * (0.75 + 0.25 * coverageRatio);
  return Number(adjusted.toFixed(6));
}

function compareRankedEntries(a, b) {
  const hasPriceA = a.effective_price_krw !== null ? 1 : 0;
  const hasPriceB = b.effective_price_krw !== null ? 1 : 0;
  if (hasPriceA !== hasPriceB) {
    return hasPriceB - hasPriceA;
  }
  if (a._internal_score !== b._internal_score) {
    return b._internal_score - a._internal_score;
  }
  const prioA = PRICE_SOURCE_RANK_PRIORITY[a.price_source] || 0;
  const prioB = PRICE_SOURCE_RANK_PRIORITY[b.price_source] || 0;
  if (prioA !== prioB) {
    return prioB - prioA;
  }
  if (a.effective_price_krw !== null && b.effective_price_krw !== null && a.effective_price_krw !== b.effective_price_krw) {
    return a.effective_price_krw - b.effective_price_krw;
  }
  if (a.released_on_kr !== b.released_on_kr) {
    return a.released_on_kr > b.released_on_kr ? -1 : 1;
  }
  const idA = BigInt(a.candidate.variant_id);
  const idB = BigInt(b.candidate.variant_id);
  return idA < idB ? -1 : idA > idB ? 1 : 0;
}

function stripInternalRankingFields(entry) {
  return {
    variant_id: String(entry.candidate.variant_id),
    smartphone_id: String(entry.candidate.smartphone_id),
    rank: entry.rank,
    insufficient_info_notes: entry.insufficient_info_notes,
    price_caution: entry.price_caution
  };
}

function performanceIntent(profile, purchaseConditions) {
  return performanceDimensions(purchaseConditions, profile).length > 0;
}

function rankSmartphoneCandidates({
  candidates = [],
  profile = {},
  purchaseConditions = {},
  upgradeDecision = null,
  performanceMeasurements = [],
  now = new Date(),
  skipPriceExpiryCheck = false,
  trustPreFilteredCandidates = false
}) {
  const hard = purchaseConditions?.hard || {};
  const weights = computeUserMetricWeights(profile, purchaseConditions);

  const eligibleEntries = [];
  const excludedCandidates = [];

  for (const cand of Array.isArray(candidates) ? candidates : []) {
    const check = validateCandidateEligibility(cand, hard, upgradeDecision, now, {
      skipPriceExpiryCheck,
      trustPreFilteredCandidates
    });
    if (!check.eligible) {
      excludedCandidates.push({
        variant_id: cand?.variant_id ? String(cand.variant_id) : null,
        reason: check.reason
      });
      continue;
    }
    eligibleEntries.push({ cand, priceKrw: check.priceKrw, priceExpired: Boolean(check.priceExpired) });
  }

  if (eligibleEntries.length === 0) {
    return {
      policy_version: RANKING_POLICY_VERSION,
      status: 'no_match',
      ranked_candidates: [],
      top_candidates: [],
      public_ranking: [],
      excluded_candidates: excludedCandidates,
      _internal_weights: weights
    };
  }

  const pricedValues = eligibleEntries.map(e => e.priceKrw).filter(v => v !== null);
  const maxObservedPrice = pricedValues.length > 0 ? Math.max(...pricedValues) : null;

  const products = eligibleEntries.map(entry => entry.cand);
  const priorities = purchaseConditions.soft?.priorities || [];
  const usages = hard.usages || profile.common?.usages || [];
  const dimensionsRequested = performanceDimensions(purchaseConditions, profile);
  const performanceMetrics = dimensionsRequested.includes('sustained')
    ? ['cpu', 'gpu', 'sustained'] : dimensionsRequested.length ? ['cpu', 'gpu'] : [];
  const cameraMetrics = priorities.includes('camera') || usages.includes('camera') ? ['camera_photo', 'camera_video'] : [];
  const batteryMetrics = ['battery_runtime'];
  const performanceScores = comparableScores(performanceMeasurements, products, performanceMetrics);
  const photoScores = comparableScores(performanceMeasurements, products, cameraMetrics);
  const batteryScores = comparableScores(performanceMeasurements, products, batteryMetrics);
  const partialPerformance = performanceScores.size ? new Map()
    : partialScoreAdjustments(performanceMeasurements, products, performanceMetrics);
  const partialAdjustments = [
    [photoScores, cameraMetrics, 0.15],
    [batteryScores, batteryMetrics, weights.battery]
  ].map(([sharedScores, metrics, weight]) => [
    sharedScores.size ? new Map() : partialScoreAdjustments(performanceMeasurements, products, metrics), weight
  ]);
  partialAdjustments.push([partialPerformance, weights.memory_spec]);
  const dimensions = products.map(product => product.dimensions_mm);
  const compact = (priorities.includes('portability') || profile.common?.mobility === 'high') &&
    dimensions.every(size => Array.isArray(size) && size.length === 3 &&
      size.every(value => Number.isFinite(value) && value > 0));
  const capacity = size => size.reduce((volume, value) => volume * value, 1);
  const minVolume = compact ? Math.min(...dimensions.map(capacity)) : null;
  if (photoScores.size) {
    // Reserve a camera weight only when all eligible options have comparable evidence.
    for (const metric of Object.keys(weights)) weights[metric] *= 0.85;
    weights.camera_quality = 0.15;
  }

  const prepared = eligibleEntries.map(({ cand, priceKrw, priceExpired }) => {
    const evaluation = evaluateCandidateMetrics(cand, priceKrw, profile, purchaseConditions, maxObservedPrice, priceExpired);
    const scores = evaluation.metric_scores;
    const id = String(cand.variant_id);
    const blend = (spec, measured) => spec == null ? measured : (spec + measured) / 2;
    if (performanceScores.has(id)) {
      scores.memory_spec = blend(scores.memory_spec, performanceScores.get(id));
      evaluation.insufficient_info_notes = evaluation.insufficient_info_notes.filter(note => !note.startsWith('칩셋 벤치마크'));
      evaluation.insufficient_info_notes.push(performanceMetrics.includes('sustained')
        ? '동일 기준의 CPU·GPU·게임 시험 중 확보한 지표를 반영했습니다.'
        : '동일 기준의 CPU·GPU 시험 중 확보한 지표를 반영했습니다.');
    }
    if (partialPerformance.has(id)) {
      evaluation.insufficient_info_notes = evaluation.insufficient_info_notes.filter(note => !note.startsWith('칩셋 벤치마크'));
      evaluation.insufficient_info_notes.push('같은 시험으로 비교할 수 있는 일부 제품의 성능 자료를 제한적으로 반영했습니다.');
    }
    if (batteryScores.has(id)) scores.battery = blend(scores.battery, batteryScores.get(id));
    if (photoScores.has(id)) {
      scores.camera_quality = photoScores.get(id);
      evaluation.insufficient_info_notes = evaluation.insufficient_info_notes.filter(note => !note.startsWith('카메라 실사용'));
    }
    if (compact && scores.portability != null) {
      scores.portability = 0.8 * scores.portability + 0.2 * minVolume / capacity(cand.dimensions_mm);
    }
    return { cand, priceKrw, evaluation };
  });

  const hasComparableMeasurements = Boolean(performanceScores.size || photoScores.size || batteryScores.size);
  const nonPriceWeights = { ...weights, budget_fit: 0 };
  const values = hasComparableMeasurements && prepared.every(row => row.priceKrw > 0)
    ? prepared.map(row => computeWeightedScore(row.evaluation.metric_scores, nonPriceWeights) / row.priceKrw)
    : [];
  const bestValue = values.length ? Math.max(...values) : 0;
  const scored = prepared.map(({ cand, priceKrw, evaluation: evalResult }, index) => {
    if (bestValue > 0 && evalResult.metric_scores.budget_fit != null) {
      evalResult.metric_scores.budget_fit = 0.75 * evalResult.metric_scores.budget_fit + 0.25 * values[index] / bestValue;
    }
    // Partial evidence is a bounded correction; it does not renormalize anyone's
    // baseline metrics or affect price-to-performance for uncovered models.
    const measuredDelta = partialAdjustments.reduce((sum, [adjustments, weight]) =>
      sum + (adjustments.get(String(cand.variant_id)) ?? 0) * weight * 0.5, 0);
    const correction = Math.max(-0.025, Math.min(0.025, measuredDelta));
    const internalScore = clamp01(computeWeightedScore(evalResult.metric_scores, weights) + correction);
    return {
      candidate: cand,
      effective_price_krw: priceKrw,
      price_source: priceKrw !== null ? (cand.price?.price_source || 'verified_sale') : null,
      released_on_kr: cand.released_on_kr,
      missing_metrics: evalResult.missing_metrics,
      insufficient_info: evalResult.insufficient_info,
      insufficient_info_notes: evalResult.insufficient_info_notes,
      price_caution: evalResult.price_caution,
      _internal_metric_scores: evalResult.metric_scores,
      _internal_score: internalScore
    };
  });

  scored.sort(compareRankedEntries);

  const ranked = scored.map((entry, idx) => ({
    ...entry,
    rank: idx + 1
  }));

  const seenModels = new Set();
  const top = [];
  for (const entry of ranked) {
    const { smartphone_id, domestic_model_number } = entry.candidate;
    const modelKey = JSON.stringify([String(smartphone_id), domestic_model_number]);
    if (seenModels.has(modelKey)) continue;
    seenModels.add(modelKey);
    top.push({ ...entry, rank: top.length + 1 });
    if (top.length === MAX_RECOMMENDED_ITEMS) break;
  }

  return {
    policy_version: RANKING_POLICY_VERSION,
    status: 'recommend',
    ranked_candidates: ranked,
    top_candidates: top,
    public_ranking: top.map(stripInternalRankingFields),
    excluded_candidates: excludedCandidates,
    _internal_weights: weights
  };
}

function buildFallbackItemText(entry) {
  const cand = entry.candidate;
  const priceText = entry.effective_price_krw
    ? `${entry.effective_price_krw.toLocaleString('ko-KR')}원`
    : '가격 확인 필요';
  const specParts = [`${cand.storage_gb}GB`];
  if (cand.ram_gb != null) specParts.push(`RAM ${cand.ram_gb}GB`);
  if (cand.screen_inches != null) specParts.push(`${cand.screen_inches}형`);
  if (cand.refresh_hz != null) specParts.push(`${cand.refresh_hz}Hz`);
  if (cand.battery_mah != null) specParts.push(`${cand.battery_mah}mAh`);
  if (cand.weight_g != null) specParts.push(`${cand.weight_g}g`);

  const pros = [];
  for (const r of (cand.eligible_reasons || []).slice(0, 3)) {
    if (r.code === 'budget_headroom') pros.push(`예산 대비 ${Number(r.value).toLocaleString('ko-KR')}원 여유`);
    else if (r.code === 'storage_meets_requirement') pros.push(`저장 용량 ${r.value}GB 조건 충족`);
    else if (r.code === 'preferred_brand_match') pros.push(`선호 제조사(${r.value}) 일치`);
    else if (r.code === 'preferred_os_match') pros.push(`선호 운영체제(${r.value}) 일치`);
    else if (r.code === 'lighter_than_owned') pros.push(`기존 기기보다 가벼운 무게(${r.value}g)`);
    else if (r.code === 'higher_refresh_than_owned') pros.push(`기존 기기보다 높은 주사율(${r.value}Hz)`);
  }
  if (!pros.length) {
    pros.push(`필수 조건을 모두 충족하는 검증 모델 (${specParts.join(' · ')})`);
  }

  const cons = [...entry.insufficient_info_notes];
  if (entry.price_caution) cons.push(entry.price_caution);

  const explanation = `${entry.rank}순위 추천: ${cand.model_name} (${specParts.join(', ')}) — 확인된 가격 ${priceText} 기준으로 요청 조건과 성향 가중치에 가장 잘 부합합니다.`;

  return { explanation, pros, cons };
}

function buildFallbackRecommendationOutput(rankingResult, aiContext) {
  const common = aiContext?.profile_snapshot?.common || {};
  const soft = aiContext?.purchase_conditions?.soft || {};

  const profileRefs = [];
  if (common.spending_style) profileRefs.push('common.spending_style');
  if (Array.isArray(common.usages) && common.usages.length) profileRefs.push('common.usages');
  if (Array.isArray(soft.preferred_brands) && soft.preferred_brands.length) profileRefs.push('soft.preferred_brands');
  if (soft.preferred_os) profileRefs.push('soft.preferred_os');
  if (Array.isArray(soft.priorities) && soft.priorities.length) profileRefs.push('soft.priorities');
  if (!profileRefs.length) profileRefs.push('common.usages');

  const items = (rankingResult?.top_candidates || []).map(entry => {
    const cand = entry.candidate;
    const reasonCodes = (cand.eligible_reasons || []).map(r => r.code).slice(0, 3);
    const evidence = [];
    if (entry.effective_price_krw !== null) {
      evidence.push({
        variant_id: String(cand.variant_id),
        field: 'price',
        price_observation_id: cand.price?.observation_id ?? null,
        total_krw: entry.effective_price_krw
      });
    }
    evidence.push({
      variant_id: String(cand.variant_id),
      field: 'storage_gb',
      value: cand.storage_gb
    });
    if (cand.weight_g !== null && cand.weight_g !== undefined) {
      evidence.push({ variant_id: String(cand.variant_id), field: 'weight_g', value: cand.weight_g });
    }

    const uncertainties = [...entry.insufficient_info_notes];
    if (entry.price_caution && !uncertainties.includes(entry.price_caution)) {
      uncertainties.push(entry.price_caution);
    }
    for (const caution of (aiContext?.upgrade_decision?.unverified_cautions || [])) {
      if (typeof caution === 'string' && caution.trim() && !uncertainties.includes(caution.trim())) {
        uncertainties.push(caution.trim().slice(0, 300));
      }
    }

    const text = buildFallbackItemText(entry);
    return {
      variant_id: String(cand.variant_id),
      rank: entry.rank,
      profile_refs: profileRefs,
      reason_codes: reasonCodes,
      evidence,
      uncertainties,
      explanation: text.explanation,
      pros: text.pros,
      cons: text.cons
    };
  });

  return {
    status: 'recommend',
    items,
    questions: []
  };
}

module.exports = {
  RANKING_POLICY_VERSION,
  performanceIntent,
  MAX_RECOMMENDED_ITEMS,
  BASE_METRIC_WEIGHTS,
  PRICE_SOURCE_RELIABILITY,
  computeUserMetricWeights,
  validateCandidateEligibility,
  evaluateCandidateMetrics,
  computeWeightedScore,
  rankSmartphoneCandidates,
  stripInternalRankingFields,
  buildFallbackRecommendationOutput
};
