'use strict';

// AI 출력 스키마·사실성·근거(evidence & reason_code) 검증기 및 객관 설명 템플릿 생성기
const catalog = require('./smartphone-catalog');

const USAGES = ['communication', 'video', 'coding', 'gaming', 'camera', 'work'];
const SPENDING_STYLES = ['value', 'balanced', 'premium'];
const MOBILITIES = ['low', 'medium', 'high'];
const ECOSYSTEMS = ['none', 'android', 'apple', 'mixed'];
const BRANDS = ['samsung', 'apple'];
const OS_VALUES = ['android', 'ios'];
const PRIORITIES = ['battery', 'camera', 'performance', 'portability', 'display'];

const ALLOWED_REASON_CODES = [
  'storage_meets_requirement',
  'lighter_than_owned',
  'budget_headroom',
  'preferred_brand_match',
  'preferred_os_match',
  'higher_refresh_than_owned'
];

const ALLOWED_PROFILE_REFS = [
  'common.usages',
  'common.spending_style',
  'common.mobility',
  'common.ecosystem',
  'smartphone.preferred_brands',
  'smartphone.priorities',
  'smartphone.preferred_os',
  'soft.preferred_brands',
  'soft.priorities',
  'soft.preferred_os'
];

const ALLOWED_EVIDENCE_FIELDS = [
  'price',
  'storage_gb',
  'ram_gb',
  'screen_inches',
  'refresh_hz',
  'battery_mah',
  'weight_g',
  'supports_5g',
  'wireless_charging',
  'brand',
  'os'
];

function isPlainObject(x) {
  return Boolean(x) && typeof x === 'object' && !Array.isArray(x);
}

function validateAnalysisInput(body) {
  catalog.object(body, ['purpose', 'text']);
  if (!['profile', 'purchase'].includes(body.purpose)) {
    throw catalog.fail('INVALID_INPUT', 422);
  }
  if (typeof body.text !== 'string' || !body.text.trim() || [...body.text.trim()].length > 2000) {
    throw catalog.fail('INVALID_INPUT', 422);
  }
  return { purpose: body.purpose, text: body.text.trim() };
}

function cleanStringArray(arr, maxItems = 10, maxLen = 300) {
  if (!Array.isArray(arr) || arr.length > maxItems) throw catalog.fail('AI_INVALID_RESULT', 502);
  const out = [];
  for (const item of arr) {
    if (typeof item !== 'string' || !item.trim() || [...item.trim()].length > maxLen) {
      throw catalog.fail('AI_INVALID_RESULT', 502);
    }
    out.push(item.trim());
  }
  return out;
}

function cleanEnumArray(arr, allowed, maxItems) {
  if (arr === undefined || arr === null) return undefined;
  if (!Array.isArray(arr) || arr.length > maxItems) throw catalog.fail('AI_INVALID_RESULT', 502);
  const dedup = [...new Set(arr)];
  if (dedup.some(v => !allowed.includes(v))) throw catalog.fail('AI_INVALID_RESULT', 502);
  return dedup;
}

function cleanOptionalEnum(val, allowed) {
  if (val === undefined || val === null) return undefined;
  if (!allowed.includes(val)) throw catalog.fail('AI_INVALID_RESULT', 502);
  return val;
}

function cleanOptionalInt(val, min, max) {
  if (val === undefined || val === null) return undefined;
  if (!Number.isInteger(val) || val < min || val > max) throw catalog.fail('AI_INVALID_RESULT', 502);
  return val;
}

function cleanOptionalBool(val) {
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'boolean') throw catalog.fail('AI_INVALID_RESULT', 502);
  return val;
}

// Express 검증: AI가 반환한 자연어 분석 초안 JSON 스키마·허용 enum·수치 범위 확인
function validateAnalysisOutput(purpose, aiOutput) {
  if (!isPlainObject(aiOutput) || !isPlainObject(aiOutput.draft)) {
    throw catalog.fail('AI_INVALID_RESULT', 502);
  }
  const questions = cleanStringArray(aiOutput.questions || [], 10, 300);
  const uncertainties = cleanStringArray(aiOutput.uncertainties || [], 10, 300);

  if (purpose === 'profile') {
    const rawCommon = aiOutput.draft.common || {};
    const rawPhone = aiOutput.draft.smartphone || {};
    if (!isPlainObject(rawCommon) || !isPlainObject(rawPhone)) {
      throw catalog.fail('AI_INVALID_RESULT', 502);
    }
    const common = {};
    const usages = cleanEnumArray(rawCommon.usages, USAGES, 6);
    if (usages && usages.length) common.usages = usages;
    const spending = cleanOptionalEnum(rawCommon.spending_style, SPENDING_STYLES);
    if (spending) common.spending_style = spending;
    const mobility = cleanOptionalEnum(rawCommon.mobility, MOBILITIES);
    if (mobility) common.mobility = mobility;
    const ecosystem = cleanOptionalEnum(rawCommon.ecosystem, ECOSYSTEMS);
    if (ecosystem) common.ecosystem = ecosystem;

    const smartphone = {};
    const prefBrands = cleanEnumArray(rawPhone.preferred_brands, BRANDS, 2);
    if (prefBrands && prefBrands.length) smartphone.preferred_brands = prefBrands;
    const priorities = cleanEnumArray(rawPhone.priorities, PRIORITIES, 3);
    if (priorities && priorities.length) smartphone.priorities = priorities;
    const prefOs = cleanOptionalEnum(rawPhone.preferred_os, OS_VALUES);
    if (prefOs) smartphone.preferred_os = prefOs;

    return {
      draft: { common, smartphone },
      questions,
      uncertainties
    };
  }

  // purpose === 'purchase'
  const rawHard = aiOutput.draft.hard || {};
  const rawSoft = aiOutput.draft.soft || {};
  if (!isPlainObject(rawHard) || !isPlainObject(rawSoft)) {
    throw catalog.fail('AI_INVALID_RESULT', 502);
  }

  const hard = {};
  const budget = cleanOptionalInt(rawHard.budget_max_krw, 1, 10000000);
  if (budget !== undefined) hard.budget_max_krw = budget;
  const usages = cleanEnumArray(rawHard.usages, USAGES, 6);
  if (usages && usages.length) hard.usages = usages;
  const allowedBrands = cleanEnumArray(rawHard.allowed_brands, BRANDS, 2);
  if (allowedBrands && allowedBrands.length) hard.allowed_brands = allowedBrands;
  const reqOs = cleanOptionalEnum(rawHard.required_os, OS_VALUES);
  if (reqOs !== undefined) hard.required_os = reqOs;
  const minStorage = cleanOptionalInt(rawHard.min_storage_gb, 1, 4096);
  if (minStorage !== undefined) hard.min_storage_gb = minStorage;
  const maxWeight = cleanOptionalInt(rawHard.max_weight_g, 1, 2000);
  if (maxWeight !== undefined) hard.max_weight_g = maxWeight;
  const minRefresh = cleanOptionalInt(rawHard.min_refresh_hz, 1, 1000);
  if (minRefresh !== undefined) hard.min_refresh_hz = minRefresh;
  const req5g = cleanOptionalBool(rawHard.require_5g);
  if (req5g !== undefined) hard.require_5g = req5g;
  const reqWireless = cleanOptionalBool(rawHard.require_wireless_charging);
  if (reqWireless !== undefined) hard.require_wireless_charging = reqWireless;

  const soft = {};
  const prefBrands = cleanEnumArray(rawSoft.preferred_brands, BRANDS, 2);
  if (prefBrands && prefBrands.length) soft.preferred_brands = prefBrands;
  const priorities = cleanEnumArray(rawSoft.priorities, PRIORITIES, 3);
  if (priorities && priorities.length) soft.priorities = priorities;
  const prefOs = cleanOptionalEnum(rawSoft.preferred_os, OS_VALUES);
  if (prefOs !== undefined) soft.preferred_os = prefOs;

  return {
    draft: { hard, soft },
    questions,
    uncertainties
  };
}

// 서버 템플릿: 검증된 reason_code와 후보 사양으로 객관적 사용자 설명 문장 생성 (AI 자유문장 배제)
function renderReasonTemplate(reason, candidate, hard, replacementDevice) {
  switch (reason.code) {
    case 'storage_meets_requirement':
      return `저장 용량이 ${candidate.storage_gb}GB로 필수 기준(${hard.min_storage_gb}GB 이상)을 충족합니다.`;
    case 'budget_headroom':
      return `배송비 포함 최저가(${candidate.price.total_krw.toLocaleString('ko-KR')}원)가 예산 상한 대비 ${(hard.budget_max_krw - candidate.price.total_krw).toLocaleString('ko-KR')}원 여유가 있습니다.`;
    case 'preferred_brand_match':
      return `선호하시는 제조사(${candidate.brand === 'samsung' ? '삼성전자' : '애플'}) 제품입니다.`;
    case 'preferred_os_match':
      return `선호하시는 운영체제(${candidate.os === 'android' ? 'Android' : 'iOS'})를 지원합니다.`;
    case 'lighter_than_owned': {
      const ownedW = replacementDevice?.product?.weight_g;
      return `기존 보유 기기(${ownedW}g)보다 가벼운 ${candidate.weight_g}g으로 휴대성이 개선됩니다.`;
    }
    case 'higher_refresh_than_owned': {
      const ownedHz = replacementDevice?.product?.refresh_hz;
      return `기존 보유 기기(${ownedHz}Hz)보다 높은 ${candidate.refresh_hz}Hz 주사율을 지원합니다.`;
    }
    default:
      return '';
  }
}

function buildObjectiveSpecSummary(candidate) {
  const parts = [`${candidate.model_name} (${candidate.domestic_model_number})`, `${candidate.storage_gb}GB`];
  if (candidate.ram_gb) parts.push(`RAM ${candidate.ram_gb}GB`);
  if (candidate.screen_inches) parts.push(`${candidate.screen_inches}인치`);
  if (candidate.refresh_hz) parts.push(`${candidate.refresh_hz}Hz`);
  if (candidate.weight_g) parts.push(`${candidate.weight_g}g`);
  if (candidate.battery_mah) parts.push(`${candidate.battery_mah}mAh`);
  return parts.join(' · ');
}

// Express 검증: AI 추천 응답이 후보 목록·예산·사양·근거(evidence & reason_code)와 100% 일치하는지 확인
function validateRecommendationOutput(aiOutput, aiContext) {
  const errors = [];
  if (!isPlainObject(aiOutput)) {
    return { valid: false, errors: ['OUTPUT_NOT_OBJECT'] };
  }

  const status = aiOutput.status;
  if (!['recommend', 'keep', 'defer', 'clarify'].includes(status)) {
    return { valid: false, errors: ['INVALID_STATUS'] };
  }

  const candidateMap = new Map();
  for (const c of aiContext.candidates_snapshot || []) {
    candidateMap.set(String(c.variant_id), c);
  }

  if (status === 'keep' || status === 'defer' || status === 'clarify') {
    const keepEval = aiContext.keep_current_evaluation;
    if (status === 'keep') {
      if (!aiContext.replacement_device || !keepEval || !keepEval.meets_current_hard_specs) {
        return { valid: false, errors: ['UNVERIFIED_KEEP_RECOMMENDATION'] };
      }
    }
    const questions = Array.isArray(aiOutput.questions)
      ? aiOutput.questions.filter(q => typeof q === 'string' && q.trim()).map(q => q.trim().slice(0, 300))
      : [];
    return {
      valid: true,
      result: {
        status,
        items: [],
        questions,
        keep_reasons: status === 'keep' ? (keepEval.reasons || []) : [],
        keep_cautions: status === 'keep' ? (keepEval.cautions || []) : []
      }
    };
  }

  // status === 'recommend'
  if (!Array.isArray(aiOutput.items) || aiOutput.items.length < 1 || aiOutput.items.length > 3) {
    return { valid: false, errors: ['INVALID_ITEMS_COUNT'] };
  }

  const seenVariants = new Set();
  const seenRanks = new Set();
  const validatedItems = [];

  for (let idx = 0; idx < aiOutput.items.length; idx++) {
    const item = aiOutput.items[idx];
    if (!isPlainObject(item)) {
      errors.push(`ITEM_${idx}_NOT_OBJECT`);
      continue;
    }

    const variantId = String(item.variant_id || '');
    const candidate = candidateMap.get(variantId);
    if (!candidate) {
      errors.push(`VARIANT_NOT_IN_CANDIDATES:${variantId}`);
      continue;
    }
    if (seenVariants.has(variantId)) {
      errors.push(`DUPLICATE_VARIANT:${variantId}`);
      continue;
    }
    seenVariants.add(variantId);

    const expectedRank = idx + 1;
    if (!Number.isInteger(item.rank) || item.rank !== expectedRank || seenRanks.has(item.rank)) {
      errors.push(`INVALID_RANK:${item.rank}`);
      continue;
    }
    seenRanks.add(item.rank);

    // profile_refs 검증
    if (!Array.isArray(item.profile_refs) || item.profile_refs.length === 0) {
      errors.push(`EMPTY_PROFILE_REFS:${variantId}`);
      continue;
    }
    const invalidRef = item.profile_refs.find(r => !ALLOWED_PROFILE_REFS.includes(r));
    if (invalidRef) {
      errors.push(`INVALID_PROFILE_REF:${invalidRef}`);
      continue;
    }

    // reason_codes 검증: 허용 코드이자 해당 후보의 eligible_reasons에 실제로 존재하는 사실이어야 함
    const eligibleMap = new Map((candidate.eligible_reasons || []).map(r => [r.code, r]));
    const rawReasonCodes = Array.isArray(item.reason_codes)
      ? item.reason_codes
      : Array.isArray(item.reasons)
        ? item.reasons.map(r => (typeof r === 'string' ? r : r?.code))
        : [];

    if (rawReasonCodes.length === 0) {
      errors.push(`EMPTY_REASONS:${variantId}`);
      continue;
    }

    const verifiedReasons = [];
    const seenReasons = new Set();
    for (const code of rawReasonCodes) {
      if (!ALLOWED_REASON_CODES.includes(code)) {
        errors.push(`DISALLOWED_REASON_CODE:${code}`);
        continue;
      }
      const matchedReason = eligibleMap.get(code);
      if (!matchedReason) {
        errors.push(`UNVERIFIED_REASON_FOR_CANDIDATE:${variantId}:${code}`);
        continue;
      }
      if (!seenReasons.has(code)) {
        seenReasons.add(code);
        verifiedReasons.push({
          code: matchedReason.code,
          field: matchedReason.field,
          value: matchedReason.value,
          description: renderReasonTemplate(
            matchedReason,
            candidate,
            aiContext.purchase_conditions.hard,
            aiContext.replacement_device
          )
        });
      }
    }

    if (verifiedReasons.length === 0) {
      errors.push(`NO_VALID_REASONS:${variantId}`);
      continue;
    }

    // evidence 검증: 후보 스냅샷의 실제 필드·수치·가격과 엄격 비교 (수동 기기나 허위 수치 차단)
    if (!Array.isArray(item.evidence) || item.evidence.length === 0) {
      errors.push(`EMPTY_EVIDENCE:${variantId}`);
      continue;
    }

    const verifiedEvidence = [];
    for (const ev of item.evidence) {
      if (!isPlainObject(ev) || String(ev.variant_id) !== variantId || !ALLOWED_EVIDENCE_FIELDS.includes(ev.field)) {
        errors.push(`INVALID_EVIDENCE_ENTRY:${variantId}`);
        continue;
      }
      if (ev.field === 'price') {
        if (
          String(ev.price_observation_id) !== String(candidate.price.observation_id) ||
          Number(ev.total_krw) !== Number(candidate.price.total_krw)
        ) {
          errors.push(`PRICE_EVIDENCE_MISMATCH:${variantId}`);
          continue;
        }
        verifiedEvidence.push({
          variant_id: variantId,
          field: 'price',
          price_observation_id: String(candidate.price.observation_id),
          total_krw: Number(candidate.price.total_krw)
        });
      } else {
        const actualVal = candidate[ev.field];
        if (actualVal === null || actualVal === undefined || Number(ev.value) !== Number(actualVal)) {
          errors.push(`SPEC_EVIDENCE_MISMATCH:${variantId}:${ev.field}`);
          continue;
        }
        verifiedEvidence.push({
          variant_id: variantId,
          field: ev.field,
          value: actualVal
        });
      }
    }

    if (errors.length > 0) continue;

    const uncertainties = Array.isArray(item.uncertainties)
      ? item.uncertainties.filter(u => typeof u === 'string' && u.trim()).map(u => u.trim().slice(0, 300))
      : [];

    validatedItems.push({
      variant_id: candidate.variant_id,
      smartphone_id: candidate.smartphone_id,
      rank: item.rank,
      product: {
        brand: candidate.brand,
        model_name: candidate.model_name,
        domestic_model_number: candidate.domestic_model_number,
        released_on_kr: candidate.released_on_kr,
        os: candidate.os,
        storage_gb: candidate.storage_gb,
        ram_gb: candidate.ram_gb,
        color: candidate.color,
        screen_inches: candidate.screen_inches,
        refresh_hz: candidate.refresh_hz,
        battery_mah: candidate.battery_mah,
        weight_g: candidate.weight_g,
        objective_summary: buildObjectiveSpecSummary(candidate),
        sources: candidate.sources
      },
      price: {
        observation_id: candidate.price.observation_id,
        total_krw: candidate.price.total_krw,
        amount_krw: candidate.price.amount_krw,
        shipping_krw: candidate.price.shipping_krw,
        source_name: candidate.price.source_name,
        source_url: candidate.price.source_url,
        seller_name: candidate.price.seller_name,
        observed_at: candidate.price.observed_at,
        expires_at: candidate.price.expires_at,
        conditions_text: candidate.price.conditions_text
      },
      profile_refs: [...new Set(item.profile_refs)],
      reasons: verifiedReasons,
      evidence: verifiedEvidence,
      comparison_with_owned: candidate.comparison_with_owned || null,
      uncertainties
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

module.exports = {
  ALLOWED_REASON_CODES,
  ALLOWED_PROFILE_REFS,
  validateAnalysisInput,
  validateAnalysisOutput,
  validateRecommendationOutput
};
