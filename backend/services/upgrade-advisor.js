'use strict';

// 다중 IT기기 확장 가능 업그레이드 자격 판정·식별·비교·알림 억제 서비스 (스마트폰 MVP 활성화)
const catalog = require('./smartphone-catalog');

// 기기 종류별 업그레이드 정책 레지스트리 (현재 스마트폰 3년만 active: true, 타 기기는 확장 설계 초안)
const DEVICE_UPGRADE_POLICIES = {
  smartphone: {
    category: 'smartphone',
    active: true,
    evaluation_mode: 'release_age',
    threshold_years: 3,
    leap_day_rule: 'feb_28_in_non_leap_year',
    description: '공식 국내 출시일 기준 3주년 이상 경과 시 업그레이드 제안 대상(실제 사용 기간과 구분)'
  },
  laptop: {
    category: 'laptop',
    active: false,
    evaluation_mode: 'release_age',
    threshold_years: 4,
    leap_day_rule: 'feb_28_in_non_leap_year',
    description: '향후 검토 초기 가정: 출시 후 4년 경과 기준(현재 미활성)'
  },
  tablet: {
    category: 'tablet',
    active: false,
    evaluation_mode: 'release_age',
    threshold_years: 4,
    leap_day_rule: 'feb_28_in_non_leap_year',
    description: '향후 검토 초기 가정: 출시 후 4년 경과 기준(현재 미활성)'
  },
  watch: {
    category: 'watch',
    active: false,
    evaluation_mode: 'release_age',
    threshold_years: 3,
    leap_day_rule: 'feb_28_in_non_leap_year',
    description: '향후 검토 초기 가정: 출시 후 3년 경과 기준(현재 미활성)'
  },
  pc: {
    category: 'pc',
    active: false,
    evaluation_mode: 'performance_compatibility_condition',
    threshold_years: null,
    leap_day_rule: null,
    description: '향후 PC-FIT 통합 대상: 부품 성능·호환성·상태 중심 판정(현재 미활성)'
  }
};

function getSnoozeDays(env = process.env) {
  const raw = env.UPGRADE_SNOOZE_DAYS;
  if (raw === undefined || raw === null || raw === '') return 30;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 365) return 30;
  return n;
}

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
}

function isValidDateOnlyString(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && (dt.getUTCMonth() + 1) === m && dt.getUTCDate() === d;
}

// 출시일 R에서 정확히 N주년(기본 3년)이 되는 Asia/Seoul 달력 날짜 계산
// 윤년 2월 29일 출시 모델의 3주년은 평년이므로 2월 28일(해당 월 말일)로 보정한다.
function computeAnniversaryDateKst(releasedOnKr, years = 3) {
  if (!isValidDateOnlyString(releasedOnKr)) return null;
  const [yStr, mStr, dStr] = releasedOnKr.split('-');
  const targetYear = Number(yStr) + years;
  const month = Number(mStr);
  let day = Number(dStr);
  if (month === 2 && day === 29 && !isLeapYear(targetYear)) {
    day = 28;
  }
  return `${String(targetYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// 공식 출시일 기준 N년(스마트폰 3년) 경과 여부 판정 (Asia/Seoul 기준)
// 주의: 제품 출시 후 경과 기간이며, 사용자가 해당 기기를 실제로 3년간 사용했다는 뜻이 아니다.
function evaluateReleaseElapsed(releasedOnKr, nowInput = new Date(), thresholdYears = 3) {
  const todayKst = typeof nowInput === 'string' && isValidDateOnlyString(nowInput)
    ? nowInput
    : catalog.kstDateString(nowInput);

  if (!releasedOnKr) {
    return {
      status: 'missing_release_date',
      released_on_kr: null,
      anniversary_date_kr: null,
      evaluated_date_kr: todayKst,
      elapsed_threshold_years: false,
      needs_verification: true
    };
  }

  if (!isValidDateOnlyString(releasedOnKr)) {
    return {
      status: 'invalid_release_date',
      released_on_kr: String(releasedOnKr),
      anniversary_date_kr: null,
      evaluated_date_kr: todayKst,
      elapsed_threshold_years: false,
      needs_verification: true
    };
  }

  // 미래 출시일은 유효한 출시일로 인정하지 않음
  if (releasedOnKr > todayKst) {
    return {
      status: 'future_release_date',
      released_on_kr: releasedOnKr,
      anniversary_date_kr: null,
      evaluated_date_kr: todayKst,
      elapsed_threshold_years: false,
      needs_verification: true
    };
  }

  const anniversaryDate = computeAnniversaryDateKst(releasedOnKr, thresholdYears);
  const elapsed = todayKst >= anniversaryDate;

  return {
    status: elapsed ? 'elapsed' : 'not_elapsed',
    released_on_kr: releasedOnKr,
    anniversary_date_kr: anniversaryDate,
    evaluated_date_kr: todayKst,
    elapsed_threshold_years: elapsed,
    needs_verification: false
  };
}

// 수동 등록된 스마트폰과 MySQL smartphones 카탈로그 매칭 평가
// - 국내 모델번호가 정확히 일치하면 단일 모델로 식별
// - 제조사+모델명(대소문자·공백 정규화)이 단일 검증 모델과 일치하면 식별
// - 동일 모델명에 여러 국내 모델번호(변형/국가별 모델)가 존재하면 잘못 연결하지 않고 ambiguous_model(확인 필요) 반환
function matchManualSmartphoneToCatalog(manualDevice, catalogPhones) {
  const brand = (manualDevice.manual_brand || '').trim().toLowerCase();
  const modelName = (manualDevice.manual_model_name || '').trim().toLowerCase();
  const modelNumber = manualDevice.manual_model_number ? manualDevice.manual_model_number.trim().toLowerCase() : null;

  if (!Array.isArray(catalogPhones) || catalogPhones.length === 0) {
    return {
      identification_status: 'unidentified_model',
      matched_phone: null,
      needs_verification: true,
      note: '내부 카탈로그에서 일치하는 스마트폰 모델을 찾을 수 없어 확인이 필요합니다.'
    };
  }

  // 1. 국내 모델번호가 입력된 경우: 브랜드 + 국내 모델번호 정확 일치만 허용
  if (modelNumber) {
    const exactNumMatches = catalogPhones.filter(
      p => p.brand.toLowerCase() === brand &&
           p.domestic_model_number &&
           p.domestic_model_number.trim().toLowerCase() === modelNumber
    );
    if (exactNumMatches.length === 1) {
      const matched = exactNumMatches[0];
      if (!matched.verified) {
        return {
          identification_status: 'unverified_catalog_model',
          matched_phone: matched,
          needs_verification: true,
          note: '카탈로그 모델이 존재하나 공식 사양·출시일 검증이 완료되지 않았습니다.'
        };
      }
      return {
        identification_status: 'identified_by_model_number',
        matched_phone: matched,
        needs_verification: false,
        note: '제조사와 국내 모델번호로 정확히 식별되었습니다.'
      };
    }
    return {
      identification_status: 'unidentified_model',
      matched_phone: null,
      needs_verification: true,
      note: '입력된 모델번호와 일치하는 국내 정식 출시 모델을 찾을 수 없습니다.'
    };
  }

  // 2. 모델번호 없이 제조사 + 모델명만 입력된 경우
  const nameMatches = catalogPhones.filter(
    p => p.brand.toLowerCase() === brand &&
         p.model_name.trim().toLowerCase() === modelName
  );

  if (nameMatches.length === 0) {
    return {
      identification_status: 'unidentified_model',
      matched_phone: null,
      needs_verification: true,
      note: '수동 입력된 스마트폰 모델이 카탈로그에서 확인되지 않습니다.'
    };
  }

  if (nameMatches.length > 1) {
    // 동일한 이름의 서로 다른 모델번호/변형이 복수 존재하면 임의 연결 금지
    return {
      identification_status: 'ambiguous_model_variant',
      matched_phone: null,
      needs_verification: true,
      note: '동일한 모델명의 세부 변형 모델이 여러 개 존재하여 국내 모델번호 확인이 필요합니다.'
    };
  }

  const single = nameMatches[0];
  if (!single.verified) {
    return {
      identification_status: 'unverified_catalog_model',
      matched_phone: single,
      needs_verification: true,
      note: '카탈로그 모델이 존재하나 공식 출시일 검증이 완료되지 않았습니다.'
    };
  }

  return {
    identification_status: 'identified_by_model_name',
    matched_phone: single,
    needs_verification: false,
    note: '제조사와 모델명으로 단일 검증 모델이 식별되었습니다.'
  };
}

// 기기별 알림 표시·숨김·30일 재표시 억제 상태 평가 (단순 조회 시 상태를 변경하지 않음)
function evaluateNotificationVisibility(isEligible, deviceUpgradeState, nowInput = new Date()) {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const nowMs = now.getTime();
  const state = deviceUpgradeState && typeof deviceUpgradeState === 'object' ? deviceUpgradeState : {};

  const dismissedPermanently = Boolean(state.dismissed_permanently);
  const snoozedUntilIso = typeof state.snoozed_until === 'string' ? state.snoozed_until : null;
  const snoozedUntilMs = snoozedUntilIso ? new Date(snoozedUntilIso).getTime() : NaN;
  const isSnoozedActive = Number.isFinite(snoozedUntilMs) && nowMs < snoozedUntilMs;

  let displayState = 'not_eligible';
  let shouldShowPopup = false;

  if (isEligible) {
    if (dismissedPermanently) {
      displayState = 'dismissed_permanently';
      shouldShowPopup = false;
    } else if (isSnoozedActive) {
      displayState = 'snoozed';
      shouldShowPopup = false;
    } else {
      displayState = 'show_popup';
      shouldShowPopup = true;
    }
  } else {
    if (dismissedPermanently) displayState = 'dismissed_permanently';
    else if (isSnoozedActive) displayState = 'snoozed';
  }

  return {
    notification_state: displayState,
    should_show_popup: shouldShowPopup,
    dismissed_permanently: dismissedPermanently,
    snoozed_until: Number.isFinite(snoozedUntilMs) ? new Date(snoozedUntilMs).toISOString() : null,
    is_snooze_expired: Number.isFinite(snoozedUntilMs) && nowMs >= snoozedUntilMs,
    updated_at: state.updated_at || null
  };
}

// 단일 보유 스마트폰에 대한 전체 업그레이드 제안 상태 판정
function evaluateSmartphoneDeviceStatus(ownedRow, catalogProduct, catalogPhonesForManual, savedUpgradeState, nowInput = new Date()) {
  const deviceId = String(ownedRow.id);
  const perDeviceState = savedUpgradeState?.devices?.[deviceId] || null;
  const policy = DEVICE_UPGRADE_POLICIES.smartphone;

  let identificationStatus = 'unidentified_model';
  let verifiedModelName = null;
  let domesticModelNumber = null;
  let releasedOnKr = null;
  let modelVerified = false;
  let releaseEval;

  if (ownedRow.variant_id !== null && ownedRow.variant_id !== undefined) {
    if (!catalogProduct) {
      identificationStatus = 'unidentified_model';
      releaseEval = evaluateReleaseElapsed(null, nowInput, policy.threshold_years);
    } else {
      verifiedModelName = catalogProduct.model_name;
      domesticModelNumber = catalogProduct.domestic_model_number || null;
      releasedOnKr = catalogProduct.released_on_kr || null;
      modelVerified = Boolean(catalogProduct.verified) && Boolean(domesticModelNumber);
      identificationStatus = modelVerified ? 'identified_catalog_variant' : 'unverified_catalog_model';
      releaseEval = evaluateReleaseElapsed(releasedOnKr, nowInput, policy.threshold_years);
      if (!modelVerified) {
        releaseEval.needs_verification = true;
        releaseEval.elapsed_threshold_years = false;
      }
    }
  } else {
    // 수동 등록된 스마트폰: 카탈로그 대조 시도
    const matchRes = matchManualSmartphoneToCatalog(ownedRow, catalogPhonesForManual);
    identificationStatus = matchRes.identification_status;
    if (matchRes.matched_phone) {
      verifiedModelName = matchRes.matched_phone.model_name;
      domesticModelNumber = matchRes.matched_phone.domestic_model_number || null;
      releasedOnKr = matchRes.matched_phone.released_on_kr || null;
      modelVerified = Boolean(matchRes.matched_phone.verified) && !matchRes.needs_verification;
      releaseEval = evaluateReleaseElapsed(releasedOnKr, nowInput, policy.threshold_years);
      if (!modelVerified) {
        releaseEval.needs_verification = true;
        releaseEval.elapsed_threshold_years = false;
      }
    } else {
      releaseEval = evaluateReleaseElapsed(null, nowInput, policy.threshold_years);
    }
  }

  const isUpgradeEligible = modelVerified && !releaseEval.needs_verification && releaseEval.elapsed_threshold_years;
  const notif = evaluateNotificationVisibility(isUpgradeEligible, perDeviceState, nowInput);

  // 주의: 제품 공식 출시일 경과 기준이며 실제 사용자의 구매/사용 기간을 단정하지 않는 문구 제공
  let statusMessage;
  if (releaseEval.needs_verification) {
    statusMessage = '등록된 스마트폰의 정확한 국내 출시일 또는 모델 식별을 위해 추가 확인이 필요합니다.';
  } else if (isUpgradeEligible) {
    statusMessage = `등록하신 ${verifiedModelName}(공식 국내 출시일: ${releasedOnKr}) 모델이 출시 후 3년 이상 경과하여 업그레이드 비교 상담을 받아보실 수 있습니다.`;
  } else {
    statusMessage = `등록하신 ${verifiedModelName}(공식 국내 출시일: ${releasedOnKr}) 모델은 아직 출시 3주년이 경과하지 않았습니다. 원하실 경우 언제든 일반 추천 상담을 이용하실 수 있습니다.`;
  }

  return {
    owned_device_id: deviceId,
    category: 'smartphone',
    source: ownedRow.variant_id ? 'catalog' : 'manual',
    variant_id: ownedRow.variant_id ? String(ownedRow.variant_id) : null,
    identification_status: identificationStatus,
    verified_model_name: verifiedModelName,
    domestic_model_number: domesticModelNumber,
    official_release_date_kr: releaseEval.status === 'invalid_release_date' ? null : releasedOnKr,
    three_year_anniversary_kr: releaseEval.anniversary_date_kr,
    evaluated_date_kr: releaseEval.evaluated_date_kr,
    release_elapsed_3_years: isUpgradeEligible,
    upgrade_offer_eligible: isUpgradeEligible,
    should_show_popup: notif.should_show_popup,
    needs_verification: releaseEval.needs_verification,
    notification_state: notif.notification_state,
    dismissed_permanently: notif.dismissed_permanently,
    snoozed_until: notif.snoozed_until,
    can_start_upgrade_recommendation: true, // 사용자는 홈/마이페이지에서 언제든 직접 추천 시작 가능
    release_age_basis_note: '실제 개인 구매·사용 기간이 아닌 제품의 국내 공식 출시일 기준 경과 판정입니다.',
    status_message: statusMessage
  };
}

// 기존 보유 기기와 추천 후보의 검증된 사양 비교 컨텍스트 생성
// - DB에 검증된 값이 있는 항목만 비교하고, 누락된 항목은 'insufficient_data'(정보 부족)로 처리
// - 배터리 용량 증가 시 실제 사용 시간 증가로 단정하지 않도록 주의 문구 포함
// - 칩셋 성능은 동일 기준의 검증된 벤치마크 테이블이 현재 없으므로 이름만 병기하고 정량 성능 우열은 'insufficient_data'로 처리
function buildDeviceCandidateComparison(ownedDeviceProduct, candidate) {
  const fields = {};
  const improvements = [];
  const tradeoffs = [];
  const cautions = [];
  const insufficientFields = [];

  if (!ownedDeviceProduct || !ownedDeviceProduct.verified) {
    return {
      comparable: false,
      reason: '보유 기기의 카탈로그 사양이 검증되지 않아 정량 사양 비교를 생략하고 정보 부족으로 처리합니다.',
      fields: {},
      improvements: [],
      tradeoffs: [],
      cautions: ['보유 기기가 수동 입력되었거나 미검증 상태이므로 사양 우열을 단정하지 않습니다.'],
      insufficient_data_fields: [
        'screen_inches', 'weight_g', 'battery_mah', 'storage_gb',
        'ram_gb', 'refresh_hz', 'wireless_charging', 'chipset', 'price'
      ]
    };
  }

  function compareNumeric(fieldKey, label, unit, higherIsBetter) {
    const cur = ownedDeviceProduct[fieldKey] !== null && ownedDeviceProduct[fieldKey] !== undefined
      ? Number(ownedDeviceProduct[fieldKey])
      : null;
    const next = candidate[fieldKey] !== null && candidate[fieldKey] !== undefined
      ? Number(candidate[fieldKey])
      : null;

    if (cur === null || next === null) {
      fields[fieldKey] = { status: 'insufficient_data', current: cur, candidate: next, unit };
      insufficientFields.push(fieldKey);
      return;
    }

    const diff = Number((next - cur).toFixed(2));
    let direction = 'same';
    if (diff > 0) direction = higherIsBetter === null ? 'larger' : (higherIsBetter ? 'improved' : 'tradeoff');
    else if (diff < 0) direction = higherIsBetter === null ? 'smaller' : (higherIsBetter ? 'tradeoff' : 'improved');

    fields[fieldKey] = { status: 'verified_comparison', current: cur, candidate: next, diff, unit, direction };

    if (fieldKey === 'weight_g') {
      if (diff < 0) improvements.push(`무게가 ${cur}g에서 ${next}g으로 ${Math.abs(diff)}g 가벼워집니다.`);
      else if (diff > 0) tradeoffs.push(`무게가 ${cur}g에서 ${next}g으로 ${diff}g 무거워집니다.`);
    } else if (fieldKey === 'battery_mah') {
      if (diff > 0) {
        improvements.push(`배터리 정격 용량이 ${cur}mAh에서 ${next}mAh로 ${diff}mAh 증가합니다.`);
        cautions.push('배터리 표기 용량(mAh) 증가가 실제 화면 켜짐 시간 비례 증가를 보장하지는 않습니다.');
      } else if (diff < 0) {
        tradeoffs.push(`배터리 정격 용량이 ${cur}mAh에서 ${next}mAh로 ${Math.abs(diff)}mAh 감소합니다.`);
      }
    } else if (fieldKey === 'storage_gb') {
      if (diff > 0) improvements.push(`저장 용량이 ${cur}GB에서 ${next}GB로 늘어납니다.`);
      else if (diff < 0) tradeoffs.push(`저장 용량이 ${cur}GB에서 ${next}GB로 줄어듭니다.`);
    } else if (fieldKey === 'ram_gb') {
      if (diff > 0) improvements.push(`RAM 용량이 ${cur}GB에서 ${next}GB로 증가합니다.`);
      else if (diff < 0) tradeoffs.push(`RAM 용량이 ${cur}GB에서 ${next}GB로 감소합니다.`);
    } else if (fieldKey === 'refresh_hz') {
      if (diff > 0) improvements.push(`최대 화면 주사율이 ${cur}Hz에서 ${next}Hz로 향상됩니다.`);
      else if (diff < 0) tradeoffs.push(`최대 화면 주사율이 ${cur}Hz에서 ${next}Hz로 낮아집니다.`);
    } else if (fieldKey === 'screen_inches') {
      if (diff !== 0) {
        cautions.push(`화면 크기가 ${cur}인치에서 ${next}인치로 달라지므로 그립감과 휴대성 선호를 확인해 주세요.`);
      }
    }
  }

  compareNumeric('screen_inches', '화면 크기', 'inches', null);
  compareNumeric('weight_g', '무게', 'g', false);
  compareNumeric('battery_mah', '배터리 용량', 'mAh', true);
  compareNumeric('storage_gb', '저장 용량', 'GB', true);
  compareNumeric('ram_gb', 'RAM', 'GB', true);
  compareNumeric('refresh_hz', '주사율', 'Hz', true);

  // 충전 사양(무선 충전 지원 여부)
  const curWireless = ownedDeviceProduct.wireless_charging === null || ownedDeviceProduct.wireless_charging === undefined
    ? null
    : Boolean(ownedDeviceProduct.wireless_charging);
  const nextWireless = candidate.wireless_charging === null || candidate.wireless_charging === undefined
    ? null
    : Boolean(candidate.wireless_charging);
  if (curWireless === null || nextWireless === null) {
    fields.wireless_charging = { status: 'insufficient_data', current: curWireless, candidate: nextWireless };
    insufficientFields.push('wireless_charging');
  } else {
    fields.wireless_charging = { status: 'verified_comparison', current: curWireless, candidate: nextWireless };
    if (!curWireless && nextWireless) improvements.push('무선 충전 기능이 새롭게 지원됩니다.');
    else if (curWireless && !nextWireless) tradeoffs.push('기존 기기에서 지원하던 무선 충전이 제외됩니다.');
  }

  // 칩셋: 동일 기준 벤치마크 점수가 없으므로 모델명만 표시하고 정량 성능 우열은 정보 부족으로 안내
  fields.chipset = {
    status: 'insufficient_benchmark_data',
    current: ownedDeviceProduct.chipset || null,
    candidate: candidate.chipset || null,
    note: '동일 기준의 검증된 벤치마크 데이터가 없어 칩셋 명칭만 제공하며 정량 성능 배수를 단정하지 않습니다.'
  };
  insufficientFields.push('chipset_benchmark');

  // 가격: 신규 후보 구매 비용 표시
  fields.price = {
    status: candidate.price ? 'verified_candidate_price' : 'insufficient_data',
    candidate_total_krw: candidate.price ? candidate.price.total_krw : null
  };

  return {
    comparable: true,
    fields,
    improvements,
    tradeoffs,
    cautions,
    insufficient_data_fields: insufficientFields
  };
}

// 현재 기기 유지(keep) 적합성 평가:
// - 사용자가 현재 기기에 만족하고 불편한 점이 없거나 교체 의향이 낮은 경우
// - 검증된 카탈로그 기기가 이미 주요 필수 사양(저장 용량, 주사율, 5G 등)을 충족하고 후보 대비 뚜렷한 실익이 적은 경우
function evaluateKeepCurrentDeviceOption({ ownedDevice, upgradeContext, hard, candidates }) {
  const reasonsToKeep = [];
  const cautions = [];
  const intent = upgradeContext?.replacement_intent || 'normal';
  const satisfied = Array.isArray(upgradeContext?.satisfied_aspects) ? upgradeContext.satisfied_aspects : [];
  const painPoints = Array.isArray(upgradeContext?.pain_points) ? upgradeContext.pain_points : [];

  if (!ownedDevice) {
    return { recommend_keep: false, reasons: [], cautions: [] };
  }

  const prod = ownedDevice.product;
  let meetsCurrentNeeds = false;

  if (ownedDevice.source === 'catalog' && prod && prod.verified) {
    const storageOk = hard.min_storage_gb === null || (prod.storage_gb && Number(prod.storage_gb) >= hard.min_storage_gb);
    const refreshOk = hard.min_refresh_hz === null || (prod.refresh_hz && Number(prod.refresh_hz) >= hard.min_refresh_hz);
    const weightOk = hard.max_weight_g === null || (prod.weight_g && Number(prod.weight_g) <= hard.max_weight_g);
    const fiveGOk = !hard.require_5g || Boolean(prod.supports_5g);
    const wirelessOk = !hard.require_wireless_charging || Boolean(prod.wireless_charging);
    meetsCurrentNeeds = Boolean(storageOk && refreshOk && weightOk && fiveGOk && wirelessOk);

    if (meetsCurrentNeeds) {
      reasonsToKeep.push(
        `현재 보유 기기(${prod.model_name}, ${prod.storage_gb}GB)가 요청하신 필수 사양 기준을 이미 충족하고 있습니다.`
      );
    }
  } else {
    cautions.push('현재 보유 기기의 상세 사양이 카탈로그에서 검증되지 않아 객관 사양만으로는 기기 유지 최선 여부를 단정할 수 없습니다.');
  }

  if (intent === 'low_or_keep_if_okay' && painPoints.length === 0) {
    reasonsToKeep.push('현재 기기 사용에 특별한 불편함이 없고 유지 의향이 있으시므로 즉시 교체하지 않는 선택이 비용 대비 합리적입니다.');
  }

  // 후보들과 비교했을 때 배터리·용량·주사율·무게 개선 항목이 하나도 없는 경우
  if (ownedDevice.source === 'catalog' && prod && prod.verified && Array.isArray(candidates) && candidates.length > 0) {
    const anyMeaningfulGain = candidates.some(c => {
      const comp = buildDeviceCandidateComparison(prod, c);
      return comp.improvements.length > 0;
    });
    if (!anyMeaningfulGain) {
      reasonsToKeep.push('예산 내 신규 후보들이 현재 보유 기기 대비 검증된 사양(용량·주사율·무게·배터리) 면에서 뚜렷한 개선점을 제공하지 못합니다.');
    }
  }

  const recommendKeep = (meetsCurrentNeeds && intent === 'low_or_keep_if_okay' && painPoints.length === 0) ||
    (meetsCurrentNeeds && reasonsToKeep.length >= 2);

  if (satisfied.length > 0 && recommendKeep) {
    reasonsToKeep.push(`기존 기기에서 만족하신 요소(${satisfied.join(', ')})를 추가 지출 없이 계속 유지할 수 있습니다.`);
  }

  return {
    recommend_keep: recommendKeep,
    meets_current_hard_specs: meetsCurrentNeeds,
    reasons: reasonsToKeep,
    cautions
  };
}

function validateUpgradeStateActionInput(body) {
  catalog.object(body, ['action', 'owned_device_id']);
  if (!['snooze', 'dismiss_permanent', 'set_current', 'reset_notice'].includes(body.action)) {
    throw catalog.fail('INVALID_INPUT', 422);
  }
  const owned_device_id = catalog.id(body.owned_device_id);
  return { action: body.action, owned_device_id };
}

const ASPECT_VALUES = ['battery', 'camera', 'performance', 'portability', 'display', 'storage', 'price', 'os_ecosystem'];
const INTENT_VALUES = ['high', 'moderate', 'low_or_keep_if_okay'];

function validateUpgradeContextInput(rawContext) {
  if (rawContext === undefined || rawContext === null) return null;
  catalog.object(rawContext, ['satisfied_aspects', 'pain_points', 'replacement_intent']);
  const satisfied_aspects = rawContext.satisfied_aspects === undefined || rawContext.satisfied_aspects === null
    ? []
    : Array.isArray(rawContext.satisfied_aspects) &&
      rawContext.satisfied_aspects.length <= 6 &&
      new Set(rawContext.satisfied_aspects).size === rawContext.satisfied_aspects.length &&
      rawContext.satisfied_aspects.every(v => ASPECT_VALUES.includes(v))
      ? rawContext.satisfied_aspects
      : (() => { throw catalog.fail('INVALID_INPUT', 422); })();

  const pain_points = rawContext.pain_points === undefined || rawContext.pain_points === null
    ? []
    : Array.isArray(rawContext.pain_points) &&
      rawContext.pain_points.length <= 6 &&
      new Set(rawContext.pain_points).size === rawContext.pain_points.length &&
      rawContext.pain_points.every(v => ASPECT_VALUES.includes(v))
      ? rawContext.pain_points
      : (() => { throw catalog.fail('INVALID_INPUT', 422); })();

  const replacement_intent = rawContext.replacement_intent === undefined || rawContext.replacement_intent === null
    ? 'moderate'
    : INTENT_VALUES.includes(rawContext.replacement_intent)
      ? rawContext.replacement_intent
      : (() => { throw catalog.fail('INVALID_INPUT', 422); })();

  return { satisfied_aspects, pain_points, replacement_intent };
}

module.exports = {
  DEVICE_UPGRADE_POLICIES,
  getSnoozeDays,
  computeAnniversaryDateKst,
  evaluateReleaseElapsed,
  matchManualSmartphoneToCatalog,
  evaluateNotificationVisibility,
  evaluateSmartphoneDeviceStatus,
  buildDeviceCandidateComparison,
  evaluateKeepCurrentDeviceOption,
  validateUpgradeStateActionInput,
  validateUpgradeContextInput
};
