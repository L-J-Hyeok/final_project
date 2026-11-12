'use strict';

const discovery = require('./smartphone-candidate-discovery');
const danawaAdapter = require('./danawa-price-adapter');

const VERIFICATION_STATUSES = Object.freeze({
  VERIFIED: 'VERIFIED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  REJECTED: 'REJECTED',
});

const ADMIN_STATUSES = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  HELD: 'held',
  REJECTED: 'rejected',
});

// Explicit official KR rejections verified against Samsung Newsroom KR / Apple KR docs.
// Keyed by normalized domestic_model_number|storage_gb|normalized_color
const OFFICIAL_REJECTED_COMBINATIONS = Object.freeze({
  'SM-F966N|1024|실버 쉐도우': {
    reasonCode: 'UNRELEASED_STORAGE_COLOR_COMBINATION',
    reason: '삼성전자 뉴스룸 KR 공식 출시 기준 Galaxy Z Fold7 1TB(16GB RAM)는 블루 쉐도우·제트블랙 2종만 출시되어 실버 쉐도우 1TB는 단순 조합 오류입니다.',
    evidenceUrls: [
      'https://news.samsung.com/kr/%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90-%EA%B0%A4%EB%9F%AD%EC%8B%9C-z-%ED%8F%B4%EB%93%9C7-%EA%B3%B5%EA%B0%9C',
    ],
  },
  'SM-F966N|1024|민트': {
    reasonCode: 'UNRELEASED_STORAGE_COLOR_COMBINATION',
    reason: '삼성전자 공식 기준 Galaxy Z Fold7 삼성닷컴 전용 민트는 256GB/512GB 전용이며 1TB(16GB RAM) 용량으로는 국내 미출시입니다.',
    evidenceUrls: [
      'https://news.samsung.com/kr/%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90-%EA%B0%A4%EB%9F%AD%EC%8B%9C-z-%ED%8F%B4%EB%93%9C7-%EA%B3%B5%EA%B0%9C',
    ],
  },
});

// Verified domestic model color-conflict / identification hold rules against existing pending DB rows.
const MODEL_VERIFICATION_NOTES = Object.freeze({
  'SM-F976N': {
    hasDbColorConflict: true,
    note: '기존 DB pending 행(실버 쉐도우·제트블랙)과 삼성 뉴스룸 KR 보도자료 색상(바이올렛 쉐도우·그라파이트·크림·그린 쉐도우) 불일치 및 개별 SKU 미확인으로 정합성 검수 필요.',
  },
  'SM-F971N': {
    hasDbColorConflict: true,
    note: '기존 DB pending 행(실버 쉐도우·네이비·제트블랙)과 삼성 뉴스룸 KR 보도자료 색상(라벤더·그라파이트·크림·피스타치오) 불일치 및 개별 SKU 미확인으로 정합성 검수 필요.',
  },
  'SM-F776N': {
    hasDbColorConflict: true,
    note: '기존 DB pending 행(민트·실버 쉐도우·블루)과 삼성 뉴스룸 KR 보도자료 색상(핑크·그라파이트·크림·민트) 불일치로 정합성 검수 필요.',
  },
  'A3720': {
    identificationHold: true,
    note: 'AI_HANDOFF/CURRENT_STATUS상 국내 정발 모델 식별·사양 재확인 보류 대상(A3720)입니다.',
  },
});

function collectOfficialSources(...urls) {
  const seen = new Set();
  const out = [];
  for (const raw of urls.flat()) {
    const cleaned = danawaAdapter.cleanProductText(raw);
    if (!cleaned || seen.has(cleaned)) continue;
    if (discovery.isDanawaProhibitedUrl(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out;
}

function isOfficialManufacturerUrl(url) {
  const raw = danawaAdapter.cleanProductText(url).toLowerCase();
  if (!raw) return false;
  return (
    raw.includes('samsung.com/sec') ||
    raw.includes('news.samsung.com/kr') ||
    raw.includes('samsungsvc.co.kr') ||
    raw.includes('apple.com/kr') ||
    raw.includes('support.apple.com/ko-kr') ||
    raw.includes('news.sktelecom.com') ||
    raw.includes('m.lguplus.com') ||
    raw.includes('news.lguplus.com')
  );
}

function buildDuplicateCheckResult(candidate, liveIndex) {
  if (!liveIndex) {
    return {
      is_duplicate: false,
      match_strategy: 'no_live_index',
      matched_smartphone_id: null,
      matched_variant_id: null,
      matched_review_status: null,
      detail: '실시간 DB 인덱스 미제공',
    };
  }

  if (candidate.candidate_kind === 'new_model' || candidate.candidate_kind === 'review_model') {
    const existingModel = discovery.findMatchingExistingModel({
      brand: candidate.brand,
      model_name: candidate.model_name,
      domestic_model_number: candidate.domestic_model_number,
    }, liveIndex);

    if (existingModel) {
      return {
        is_duplicate: true,
        match_strategy: existingModel.matchStrategy,
        matched_smartphone_id: String(existingModel.matched.id),
        matched_variant_id: null,
        matched_review_status: existingModel.matched.review_status || null,
        detail: `기존 DB 모델(${existingModel.matched.model_name}, id=${existingModel.matched.id}, status=${existingModel.matched.review_status})과 중복됩니다.`,
      };
    }
    return {
      is_duplicate: false,
      match_strategy: 'not_found_in_smartphones',
      matched_smartphone_id: null,
      matched_variant_id: null,
      matched_review_status: null,
      detail: '기존 DB 49개 모델(legacy/approved/pending 포함)과 중복 없음',
    };
  }

  if (candidate.candidate_kind === 'new_variant') {
    const parentId = candidate.target_smartphone_id ? Number(candidate.target_smartphone_id) : null;
    const matchedParent = parentId ? liveIndex.byId.get(parentId) : null;
    if (!matchedParent) {
      return {
        is_duplicate: false,
        match_strategy: 'parent_model_missing_in_live_db',
        matched_smartphone_id: null,
        matched_variant_id: null,
        matched_review_status: null,
        detail: '대상 부모 모델을 실시간 DB에서 찾지 못했습니다.',
      };
    }

    const existingVariant = discovery.findMatchingExistingVariant(
      matchedParent.id,
      {
        storage_gb: candidate.storage_gb,
        ram_gb: candidate.ram_gb,
        color: candidate.color,
      },
      liveIndex,
      { brand: matchedParent.brand, modelName: matchedParent.model_name }
    );

    if (existingVariant) {
      return {
        is_duplicate: true,
        match_strategy: existingVariant.matchType,
        matched_smartphone_id: String(matchedParent.id),
        matched_variant_id: String(existingVariant.matched.id),
        matched_review_status: existingVariant.matched.review_status || null,
        detail: `기존 DB 옵션(id=${existingVariant.matched.id}, status=${existingVariant.matched.review_status})과 중복됩니다.`,
      };
    }

    return {
      is_duplicate: false,
      match_strategy: 'unique_new_variant',
      matched_smartphone_id: String(matchedParent.id),
      matched_variant_id: null,
      matched_review_status: matchedParent.review_status || null,
      detail: `기존 DB 모델(${matchedParent.model_name}, status=${matchedParent.review_status}) 내 중복 옵션 없음`,
    };
  }

  // db_pending_model / db_pending_variant already reside inside smartphones / smartphone_variants as pending rows
  return {
    is_duplicate: false,
    match_strategy: 'existing_db_pending_row',
    matched_smartphone_id: candidate.target_smartphone_id ? String(candidate.target_smartphone_id) : null,
    matched_variant_id: candidate.target_variant_id ? String(candidate.target_variant_id) : null,
    matched_review_status: 'pending',
    detail: '운영 DB에 review_status=pending 비공개 상태로 이미 적재된 항목입니다.',
  };
}

function makeCandidateId(prefix, parts) {
  return [prefix, ...parts.map((p) => String(p ?? 'na').replace(/[^a-zA-Z0-9가-힣_-]+/g, '_'))].join('__');
}

function verifyNewModelCandidate(rawItem, liveIndex, checkedAt) {
  const m = rawItem.normalizedModel;
  const variantPayloads = Array.isArray(rawItem.smartphone_variants_insert_payloads)
    ? rawItem.smartphone_variants_insert_payloads
    : [];
  const firstOpt = rawItem.variantEvaluations?.[0]?.option || variantPayloads[0] || {};
  const officialSources = collectOfficialSources(
    m.source_url,
    m.official_product_url,
    firstOpt.source_url
  );
  const candidate = {
    candidate_id: makeCandidateId('new_model', [m.brand, m.domestic_model_number || m.model_name]),
    candidate_kind: 'new_model',
    brand: m.brand,
    model_name: m.model_name,
    domestic_model_number: m.domestic_model_number,
    released_on_kr: m.released_on_kr,
    storage_gb: firstOpt.storage_gb || null,
    ram_gb: firstOpt.ram_gb || null,
    color: firstOpt.color || null,
    launch_price_krw: firstOpt.launch_price_krw || null,
    channel: firstOpt.channel || 'standard',
    sku_example: firstOpt.sku_example || null,
    target_smartphone_id: null,
    target_variant_id: null,
    target_parent_review_status: null,
    official_sources: officialSources,
    specs: {
      os: m.os,
      chipset: m.chipset,
      screen_inches: m.screen_inches,
      refresh_hz: m.refresh_hz,
      battery_mah: m.battery_mah,
      weight_g: m.weight_g,
      supports_5g: m.supports_5g,
      wireless_charging: m.wireless_charging,
    },
    checked_at: checkedAt,
    phase3_payload: {
      model: rawItem.smartphones_insert_payload || null,
      variants: variantPayloads,
      check_constraint_readiness: rawItem.check_constraint_readiness || null,
    },
  };

  const dupCheck = buildDuplicateCheckResult(candidate, liveIndex);
  candidate.duplicate_check = dupCheck;

  const hasOfficialUrl = officialSources.some(isOfficialManufacturerUrl);
  const modelReady = Boolean(rawItem.check_constraint_readiness?.model?.admin_approval_ready);
  const hasVerifiedOption = Boolean(
    firstOpt.storage_gb && firstOpt.color && firstOpt.sku_example && firstOpt.launch_price_krw
  );

  if (dupCheck.is_duplicate) {
    candidate.verification_status = VERIFICATION_STATUSES.REJECTED;
    candidate.verification_reason_code = 'DUPLICATE_IN_EXISTING_DB';
    candidate.verification_reason = dupCheck.detail;
  } else if (!hasOfficialUrl || !modelReady || !hasVerifiedOption) {
    candidate.verification_status = VERIFICATION_STATUSES.REVIEW_REQUIRED;
    candidate.verification_reason_code = 'OFFICIAL_EVIDENCE_INCOMPLETE';
    candidate.verification_reason = '공식 출처 URL, 필수 사양 또는 단일 국내 출시 SKU 근거가 불완전합니다.';
  } else {
    candidate.verification_status = VERIFICATION_STATUSES.VERIFIED;
    candidate.verification_reason_code = 'OFFICIAL_KR_SINGLE_SKU_VERIFIED';
    candidate.verification_reason = `제조사 공식 한국 출처(${m.source_name}) 기준 국내 모델번호(${m.domestic_model_number}), 출시일(${m.released_on_kr}), 단일 SKU(${firstOpt.sku_example}) 및 사양이 모두 검증되었습니다.`;
  }

  candidate.approval_eligible =
    candidate.verification_status === VERIFICATION_STATUSES.VERIFIED && !dupCheck.is_duplicate;
  return candidate;
}

function verifyNewVariantCandidate(rawItem, liveIndex, checkedAt) {
  const opt = rawItem.option || {};
  const parentModel = liveIndex?.byId.get(Number(rawItem.target_smartphone_id)) || null;
  const brand = parentModel ? parentModel.brand : (rawItem.target_domestic_model_number?.startsWith('A') ? 'apple' : 'samsung');
  const dom = rawItem.target_domestic_model_number || parentModel?.domestic_model_number || null;
  const normColor = discovery.normalizeColorForDedupe(opt.color, {
    brand,
    modelName: rawItem.target_model_name,
  });
  const officialSources = collectOfficialSources(
    opt.source_url,
    parentModel?.source_url,
    parentModel?.official_product_url
  );

  const candidate = {
    candidate_id: makeCandidateId('new_variant', [
      rawItem.target_smartphone_id,
      opt.storage_gb,
      opt.ram_gb ?? 0,
      opt.color,
    ]),
    candidate_kind: 'new_variant',
    brand,
    model_name: rawItem.target_model_name,
    domestic_model_number: dom,
    released_on_kr: parentModel?.released_on_kr || null,
    storage_gb: opt.storage_gb,
    ram_gb: opt.ram_gb ?? null,
    color: opt.color,
    launch_price_krw: opt.launch_price_krw ?? null,
    channel: opt.channel || 'standard',
    sku_example: opt.sku_example || null,
    target_smartphone_id: String(rawItem.target_smartphone_id),
    target_variant_id: null,
    target_parent_review_status: parentModel?.review_status || rawItem.target_parent_review_status,
    official_sources: officialSources,
    specs: parentModel
      ? {
          os: parentModel.os,
          chipset: parentModel.chipset,
          screen_inches: parentModel.screen_inches,
          refresh_hz: parentModel.refresh_hz,
          battery_mah: parentModel.battery_mah,
          weight_g: parentModel.weight_g,
        }
      : null,
    checked_at: checkedAt,
    phase3_payload: {
      variant: rawItem.smartphone_variants_insert_payload || null,
      check_constraint_readiness: rawItem.check_constraint_readiness || null,
    },
  };

  const dupCheck = buildDuplicateCheckResult(candidate, liveIndex);
  candidate.duplicate_check = dupCheck;

  const rejectionKey = `${dom}|${opt.storage_gb}|${normColor}`;
  const explicitRejection = OFFICIAL_REJECTED_COMBINATIONS[rejectionKey];
  const modelNote = MODEL_VERIFICATION_NOTES[dom];
  const parentStatus = candidate.target_parent_review_status;
  const hasOfficialUrl = officialSources.some(isOfficialManufacturerUrl);

  if (dupCheck.is_duplicate) {
    candidate.verification_status = VERIFICATION_STATUSES.REJECTED;
    candidate.verification_reason_code = 'DUPLICATE_IN_EXISTING_DB';
    candidate.verification_reason = dupCheck.detail;
  } else if (explicitRejection) {
    candidate.verification_status = VERIFICATION_STATUSES.REJECTED;
    candidate.verification_reason_code = explicitRejection.reasonCode;
    candidate.verification_reason = explicitRejection.reason;
    candidate.official_sources = collectOfficialSources(officialSources, explicitRejection.evidenceUrls);
  } else if (!hasOfficialUrl || !opt.official_option_verified) {
    candidate.verification_status = VERIFICATION_STATUSES.REVIEW_REQUIRED;
    candidate.verification_reason_code = 'MISSING_OFFICIAL_OPTION_EVIDENCE';
    candidate.verification_reason = '공식 출처 URL 또는 공식 옵션 판매 근거가 부족합니다.';
  } else if (!['legacy', 'approved'].includes(parentStatus)) {
    candidate.verification_status = VERIFICATION_STATUSES.REVIEW_REQUIRED;
    candidate.verification_reason_code = modelNote?.hasDbColorConflict
      ? 'PARENT_PENDING_COLOR_CONFLICT'
      : modelNote?.identificationHold
        ? 'PARENT_IDENTIFICATION_HOLD'
        : 'PARENT_MODEL_PENDING_REVIEW';
    candidate.verification_reason =
      modelNote?.note ||
      `부모 모델(${candidate.model_name}, status=${parentStatus})이 아직 승인 대기 상태이며, 개별 용량·색상 조합을 부모 모델 승인과 함께 재검수해야 합니다.`;
  } else if (brand === 'samsung' && candidate.channel === 'samsung_dotcom_exclusive' && !candidate.sku_example) {
    candidate.verification_status = VERIFICATION_STATUSES.REVIEW_REQUIRED;
    candidate.verification_reason_code = 'SAMSUNG_DOTCOM_SKU_VERIFICATION_REQUIRED';
    candidate.verification_reason = `삼성닷컴·삼성 강남 전용 색상(${candidate.color} ${candidate.storage_gb}GB)으로 보도자료상 존재하나 용량별 개별 국내 SKU 품번(SM-...KOO) 직접 확인 전까지 단순 조합 자동 승인을 보류합니다.`;
  } else {
    candidate.verification_status = VERIFICATION_STATUSES.VERIFIED;
    candidate.verification_reason_code = candidate.sku_example
      ? 'OFFICIAL_KR_SKU_VERIFIED'
      : 'OFFICIAL_KR_LINEUP_VERIFIED';
    candidate.verification_reason = candidate.sku_example
      ? `공식 SKU(${candidate.sku_example}) 및 제조사 공식 출처로 국내 판매 옵션이 확인되었습니다.`
      : `제조사 공식 사양·보도자료 기준(${candidate.model_name} ${candidate.storage_gb}GB ${candidate.color}) 실제 국내 판매 조합이 확인되었으며 기존 DB와 중복이 없습니다.`;
  }

  candidate.approval_eligible =
    candidate.verification_status === VERIFICATION_STATUSES.VERIFIED && !dupCheck.is_duplicate;
  return candidate;
}

function verifyDiscoveryReviewModel(rawItem, liveIndex, checkedAt) {
  const m = rawItem.normalizedModel;
  const missing = Array.isArray(rawItem.missingFields) ? rawItem.missingFields : [];
  const officialSources = collectOfficialSources(m.source_url, m.official_product_url);
  const candidate = {
    candidate_id: makeCandidateId('review_model', [m.brand, m.domestic_model_number || m.model_name]),
    candidate_kind: 'review_model',
    brand: m.brand,
    model_name: m.model_name,
    domestic_model_number: m.domestic_model_number,
    released_on_kr: m.released_on_kr || null,
    storage_gb: rawItem.partialVariants?.[0]?.storage_gb ?? null,
    ram_gb: rawItem.partialVariants?.[0]?.ram_gb ?? null,
    color: rawItem.partialVariants?.[0]?.color ?? null,
    launch_price_krw: rawItem.partialVariants?.[0]?.launch_price_krw ?? null,
    channel: 'carrier_or_enterprise',
    sku_example: rawItem.partialVariants?.[0]?.sku_example ?? null,
    target_smartphone_id: null,
    target_variant_id: null,
    target_parent_review_status: null,
    official_sources: officialSources,
    missing_fields: missing,
    checked_at: checkedAt,
    phase3_payload: null,
  };

  const dupCheck = buildDuplicateCheckResult(candidate, liveIndex);
  candidate.duplicate_check = dupCheck;

  if (dupCheck.is_duplicate) {
    candidate.verification_status = VERIFICATION_STATUSES.REJECTED;
    candidate.verification_reason_code = 'DUPLICATE_IN_EXISTING_DB';
    candidate.verification_reason = dupCheck.detail;
  } else {
    candidate.verification_status = VERIFICATION_STATUSES.REVIEW_REQUIRED;
    candidate.verification_reason_code = rawItem.reasonCode || 'MISSING_OFFICIAL_SPECS_OR_OPTIONS';
    candidate.verification_reason =
      rawItem.audit?.review_reason ||
      `공식 사양/출시일/옵션 누락(${missing.join(', ')})으로 추측 등록을 금지하고 검수 보류합니다.`;
  }

  candidate.approval_eligible = false;
  return candidate;
}

function verifyExistingPendingModel(dbModel, liveIndex, checkedAt) {
  const dom = dbModel.domestic_model_number;
  const officialSources = collectOfficialSources(dbModel.source_url, dbModel.official_product_url);
  const missing = [];
  if (!dbModel.source_url) missing.push('source_url');
  if (!dbModel.released_on_kr) missing.push('released_on_kr');
  if (!dbModel.os) missing.push('os');
  if (!dbModel.chipset) missing.push('chipset');
  if (dbModel.screen_inches === null || dbModel.screen_inches === undefined) missing.push('screen_inches');
  if (dbModel.weight_g === null || dbModel.weight_g === undefined) missing.push('weight_g');

  const note = MODEL_VERIFICATION_NOTES[dom];
  const blockers = [];
  if (missing.length > 0) blockers.push(`누락 필드: ${missing.join(', ')}`);
  if (note?.hasDbColorConflict) blockers.push(note.note);
  if (note?.identificationHold) blockers.push(note.note);
  if (
    dbModel.official_product_url &&
    String(dbModel.official_product_url).includes('all-smartphones')
  ) {
    blockers.push('official_product_url이 모델 전용 페이지가 아닌 전체 목록 URL입니다.');
  }

  const candidate = {
    candidate_id: makeCandidateId('db_pending_model', [dbModel.id, dom || dbModel.model_name]),
    candidate_kind: 'db_pending_model',
    brand: dbModel.brand,
    model_name: dbModel.model_name,
    domestic_model_number: dom,
    released_on_kr: dbModel.released_on_kr ? String(dbModel.released_on_kr).slice(0, 10) : null,
    storage_gb: null,
    ram_gb: null,
    color: null,
    launch_price_krw: null,
    channel: 'existing_db_pending',
    sku_example: null,
    target_smartphone_id: String(dbModel.id),
    target_variant_id: null,
    target_parent_review_status: dbModel.review_status,
    official_sources: officialSources,
    missing_fields: missing,
    checked_at: checkedAt,
    verification_status: VERIFICATION_STATUSES.REVIEW_REQUIRED,
    verification_reason_code: note?.hasDbColorConflict
      ? 'DB_PENDING_COLOR_CONFLICT'
      : note?.identificationHold
        ? 'DB_PENDING_IDENTIFICATION_HOLD'
        : 'DB_PENDING_OFFICIAL_SOURCE_OR_SPEC_GAP',
    verification_reason:
      blockers.length > 0
        ? blockers.join(' / ')
        : '기존 DB pending 모델의 공식 출처·사양 교차 검수가 필요합니다.',
    approval_eligible: false,
    phase3_payload: null,
  };
  candidate.duplicate_check = buildDuplicateCheckResult(candidate, liveIndex);
  return candidate;
}

function verifyExistingPendingVariant(dbVariant, parentModel, liveIndex, checkedAt) {
  const dom = parentModel?.domestic_model_number || null;
  const note = dom ? MODEL_VERIFICATION_NOTES[dom] : null;
  const officialSources = collectOfficialSources(
    dbVariant.source_url,
    parentModel?.source_url,
    parentModel?.official_product_url
  );

  const blockers = [];
  if (parentModel && parentModel.review_status === 'pending') {
    blockers.push(`부모 모델(${parentModel.model_name}, id=${parentModel.id})이 pending 상태`);
  }
  if (note?.hasDbColorConflict) {
    blockers.push(`뉴스룸 공식 색상과 불일치 가능성(${dbVariant.color})`);
  }
  if (note?.identificationHold) {
    blockers.push(note.note);
  }
  if (!dbVariant.source_url || String(dbVariant.source_url).includes('all-smartphones')) {
    blockers.push('개별 옵션 공식 출처 URL 보완 필요');
  }

  const candidate = {
    candidate_id: makeCandidateId('db_pending_variant', [dbVariant.id, dbVariant.smartphone_id]),
    candidate_kind: 'db_pending_variant',
    brand: parentModel?.brand || 'unknown',
    model_name: parentModel?.model_name || `Model #${dbVariant.smartphone_id}`,
    domestic_model_number: dom,
    released_on_kr: parentModel?.released_on_kr ? String(parentModel.released_on_kr).slice(0, 10) : null,
    storage_gb: dbVariant.storage_gb,
    ram_gb: dbVariant.ram_gb ?? null,
    color: dbVariant.color,
    launch_price_krw: dbVariant.launch_price_krw ?? null,
    channel: 'existing_db_pending',
    sku_example: null,
    target_smartphone_id: String(dbVariant.smartphone_id),
    target_variant_id: String(dbVariant.id),
    target_parent_review_status: parentModel?.review_status || 'unknown',
    official_sources: officialSources,
    checked_at: checkedAt,
    verification_status: VERIFICATION_STATUSES.REVIEW_REQUIRED,
    verification_reason_code: note?.hasDbColorConflict
      ? 'DB_PENDING_COLOR_CONFLICT'
      : 'DB_PENDING_PARENT_OR_URL_REVIEW_REQUIRED',
    verification_reason: blockers.join(' / ') || '기존 DB pending 옵션 검수 필요',
    approval_eligible: false,
    phase3_payload: null,
  };
  candidate.duplicate_check = buildDuplicateCheckResult(candidate, liveIndex);
  return candidate;
}

function summarizeVerifiedCandidates(candidates) {
  const byVerificationStatus = { VERIFIED: 0, REVIEW_REQUIRED: 0, REJECTED: 0 };
  const byKind = {
    new_model: { total: 0, VERIFIED: 0, REVIEW_REQUIRED: 0, REJECTED: 0 },
    new_variant: { total: 0, VERIFIED: 0, REVIEW_REQUIRED: 0, REJECTED: 0 },
    review_model: { total: 0, VERIFIED: 0, REVIEW_REQUIRED: 0, REJECTED: 0 },
    db_pending_model: { total: 0, VERIFIED: 0, REVIEW_REQUIRED: 0, REJECTED: 0 },
    db_pending_variant: { total: 0, VERIFIED: 0, REVIEW_REQUIRED: 0, REJECTED: 0 },
  };
  let confirmedKrOptionsCount = 0;

  for (const c of candidates) {
    byVerificationStatus[c.verification_status] = (byVerificationStatus[c.verification_status] || 0) + 1;
    if (byKind[c.candidate_kind]) {
      byKind[c.candidate_kind].total += 1;
      byKind[c.candidate_kind][c.verification_status] += 1;
    }
    if (
      (c.candidate_kind === 'new_model' || c.candidate_kind === 'new_variant') &&
      c.verification_status === VERIFICATION_STATUSES.VERIFIED
    ) {
      confirmedKrOptionsCount += 1;
    }
  }

  return {
    total_candidates: candidates.length,
    by_verification_status: byVerificationStatus,
    by_candidate_kind: byKind,
    confirmed_kr_sales_options_count: confirmedKrOptionsCount,
  };
}

function verifyAllCandidates({
  discoveryReport,
  existingModels = [],
  existingVariants = [],
  checkedAt = discovery.DEFAULT_CHECKED_AT,
} = {}) {
  const liveIndex = discovery.buildInventoryIndex(existingModels, existingVariants);
  const candidates = [];

  for (const item of discoveryReport?.candidates?.new_models || []) {
    candidates.push(verifyNewModelCandidate(item, liveIndex, checkedAt));
  }
  for (const item of discoveryReport?.candidates?.new_variants || []) {
    candidates.push(verifyNewVariantCandidate(item, liveIndex, checkedAt));
  }
  for (const item of discoveryReport?.candidates?.review_required || []) {
    candidates.push(verifyDiscoveryReviewModel(item, liveIndex, checkedAt));
  }

  const pendingModels = existingModels.filter((m) => m.review_status === 'pending');
  for (const m of pendingModels) {
    candidates.push(verifyExistingPendingModel(m, liveIndex, checkedAt));
  }
  const pendingVariants = existingVariants.filter((v) => v.review_status === 'pending');
  for (const v of pendingVariants) {
    const parent = liveIndex.byId.get(Number(v.smartphone_id)) || null;
    candidates.push(verifyExistingPendingVariant(v, parent, liveIndex, checkedAt));
  }

  return {
    schema_version: 3,
    phase: 'phase_3_candidate_verification',
    db_write_performed: false,
    production_approved: false,
    checked_at: checkedAt,
    summary: summarizeVerifiedCandidates(candidates),
    candidates,
  };
}

function verifySingleCandidateForApproval(candidate, liveIndex) {
  const liveDuplicateCheck = buildDuplicateCheckResult(candidate, liveIndex);

  if (liveDuplicateCheck.is_duplicate) {
    return {
      allowed: false,
      errorCode: 'DUPLICATE_CANDIDATE',
      message: liveDuplicateCheck.detail,
      duplicate_check: liveDuplicateCheck,
    };
  }

  if (candidate.verification_status !== VERIFICATION_STATUSES.VERIFIED) {
    return {
      allowed: false,
      errorCode: 'APPROVAL_POLICY_VIOLATION',
      message: `검증 상태가 ${candidate.verification_status}인 후보는 승인할 수 없습니다. (${candidate.verification_reason})`,
      duplicate_check: liveDuplicateCheck,
    };
  }

  if (!Array.isArray(candidate.official_sources) || !candidate.official_sources.some(isOfficialManufacturerUrl)) {
    return {
      allowed: false,
      errorCode: 'APPROVAL_POLICY_VIOLATION',
      message: '공식 제조사 출처 URL이 없는 후보는 승인할 수 없습니다.',
      duplicate_check: liveDuplicateCheck,
    };
  }

  if (candidate.candidate_kind === 'new_variant') {
    const liveParent = liveIndex?.byId.get(Number(candidate.target_smartphone_id));
    if (!liveParent || !['legacy', 'approved'].includes(liveParent.review_status)) {
      return {
        allowed: false,
        errorCode: 'APPROVAL_POLICY_VIOLATION',
        message: '부모 모델이 아직 공개 승인(legacy/approved) 상태가 아니므로 옵션을 단독 승인할 수 없습니다.',
        duplicate_check: liveDuplicateCheck,
      };
    }
  }

  return {
    allowed: true,
    errorCode: null,
    message: '승인 정책 및 실시간 중복 검사를 통과했습니다.',
    duplicate_check: liveDuplicateCheck,
  };
}

module.exports = {
  VERIFICATION_STATUSES,
  ADMIN_STATUSES,
  OFFICIAL_REJECTED_COMBINATIONS,
  MODEL_VERIFICATION_NOTES,
  collectOfficialSources,
  isOfficialManufacturerUrl,
  buildDuplicateCheckResult,
  verifyAllCandidates,
  verifySingleCandidateForApproval,
  summarizeVerifiedCandidates,
};
