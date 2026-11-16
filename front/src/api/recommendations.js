import { request } from './client'
const usages = ['communication', 'video', 'coding', 'gaming', 'camera', 'work']
const COMMON_CATEGORIES = ['tablet', 'laptop', 'smartwatch', 'earbuds', 'speaker']
const COMMON_BRANDS = ['samsung', 'apple', 'lg', 'lenovo', 'asus', 'sony', 'bose', 'sennheiser', 'jbl']

export function buildRecommendationRequest(form, version, category = 'smartphone') {
  const normCategory = (form.category || category || 'smartphone').trim().toLowerCase()
  const isSmartphone = normCategory === 'smartphone'
  const budget = Number(form.budget)

  if (!Number.isInteger(version) || version < 1) throw new Error('프로필 정보를 확인해 주세요.')

  if (isSmartphone) {
    if (!Number.isInteger(budget) || budget < 1 || budget > 10000000 || !Array.isArray(form.usages) || !form.usages.length || form.usages.some(x => !usages.includes(x))) {
      throw new Error('예산은 1~10,000,000원 사이의 정수로 입력하고 사용 목적을 선택해 주세요.')
    }
    if (!Array.isArray(form.brands) || form.brands.some(x => !['samsung', 'apple'].includes(x))) {
      throw new Error('제조사 선호를 확인해 주세요.')
    }
    const body = {
      expected_profile_version: version,
      hard: { budget_max_krw: budget, usages: [...new Set(form.usages)] },
      soft: { preferred_brands: [...new Set(form.brands)] }
    }
    if (form.deviceId) {
      if (!/^[1-9][0-9]*$/.test(String(form.deviceId)) || !form.reason?.trim() || (!form.satisfied?.length && !form.pains?.length)) {
        throw new Error('교체 이유와 만족하거나 불편한 항목을 선택해 주세요.')
      }
      if ([...form.reason.trim()].length > 300) throw new Error('교체 이유는 300자 이내로 입력해 주세요.')
      if (form.satisfied.length > 6 || form.pains.length > 6) throw new Error('만족·불편 항목은 각각 6개까지 선택해 주세요.')
      body.replacement_device_id = String(form.deviceId)
      body.purchase_reason = form.reason.trim()
      body.upgrade_context = { replacement_intent: form.intent, satisfied_aspects: form.satisfied, pain_points: form.pains }
      body.soft.preferred_os = form.os || null
      body.soft.priorities = form.priorities || []
    }
    return body
  }

  // Non-smartphone catalog recommendation (tablet, laptop, smartwatch, earbuds, speaker)
  if (!COMMON_CATEGORIES.includes(normCategory)) throw new Error('지원하지 않는 카테고리입니다.')
  if (!Number.isInteger(budget) || budget < 1 || budget > 20000000 || !Array.isArray(form.usages) || !form.usages.length || form.usages.some(x => !usages.includes(x))) {
    throw new Error('예산은 1~20,000,000원 사이의 정수로 입력하고 사용 목적을 1개 이상 선택해 주세요.')
  }
  const cleanPreferredBrands = Array.isArray(form.preferred_brands || form.brands)
    ? (form.preferred_brands || form.brands).map(b => String(b).trim().toLowerCase()).filter(b => COMMON_BRANDS.includes(b))
    : []
  const cleanAllowedBrands = Array.isArray(form.allowed_brands)
    ? form.allowed_brands.map(b => String(b).trim().toLowerCase()).filter(b => COMMON_BRANDS.includes(b))
    : []

  const hard = {
    budget_max_krw: budget,
    usages: [...new Set(form.usages)]
  }
  if (cleanAllowedBrands.length) {
    hard.allowed_brands = [...new Set(cleanAllowedBrands)]
  }

  // OS requirements
  if (form.required_os && ['android', 'ios', 'macos', 'windows'].includes(String(form.required_os).toLowerCase())) {
    hard.required_os = String(form.required_os).toLowerCase()
  } else if (normCategory === 'laptop' && form.os && ['macos', 'windows'].includes(form.os.toLowerCase())) {
    hard.required_os = form.os.toLowerCase()
  } else if (normCategory === 'tablet' && form.os && ['android', 'ios'].includes(form.os.toLowerCase())) {
    hard.required_os = form.os.toLowerCase()
  }

  if (form.compatible_os && ['android', 'ios'].includes(String(form.compatible_os).toLowerCase())) {
    hard.compatible_os = String(form.compatible_os).toLowerCase()
  } else if (normCategory === 'smartwatch' && form.os && ['android', 'ios'].includes(form.os.toLowerCase())) {
    hard.compatible_os = form.os.toLowerCase()
  }

  // Essential specs
  const checkInt = val => (Number.isInteger(val) && val > 0 ? val : undefined)
  const minStorage = checkInt(form.min_storage_gb)
  if (minStorage !== undefined) hard.min_storage_gb = minStorage
  const minRam = checkInt(form.min_ram_gb)
  if (minRam !== undefined) hard.min_ram_gb = minRam
  const maxWeight = checkInt(form.max_weight_g)
  if (maxWeight !== undefined) hard.max_weight_g = maxWeight
  const minRefresh = checkInt(form.min_refresh_hz)
  if (minRefresh !== undefined) hard.min_refresh_hz = minRefresh

  // Feature flags
  if (form.require_pen) hard.require_pen = true
  if (form.require_keyboard) hard.require_keyboard = true
  if (form.require_cellular || form.require_5g || form.require_lte) hard.require_cellular = true
  if (form.require_anc) hard.require_anc = true
  if (form.require_water_resistance) hard.require_water_resistance = true
  if (form.require_discrete_gpu) hard.require_discrete_gpu = true
  if (form.require_gps) hard.require_gps = true
  if (form.require_wireless_charging) hard.require_wireless_charging = true
  if (Array.isArray(form.unsupported_requirements) && form.unsupported_requirements.length) {
    hard.unsupported_requirements = [...new Set(form.unsupported_requirements)].slice(0, 10)
  }

  const soft = {
    preferred_brands: cleanPreferredBrands,
    priorities: Array.isArray(form.priorities) ? form.priorities : [],
    preferred_os: form.os || null
  }
  const body = {
    category: normCategory,
    expected_profile_version: version,
    hard,
    soft
  }
  if (form.deviceId) {
    if (!/^[1-9][0-9]*$/.test(String(form.deviceId))) throw new Error('보유 기기를 선택해 주세요.')
    const pains = Array.isArray(form.pains) ? form.pains : []
    const intent = form.intent || 'moderate'
    const noPainConfirmed = Boolean(form.no_pain_confirmed || (intent === 'low_or_keep_if_okay' && pains.length === 0))
    body.replacement_device_id = String(form.deviceId)
    body.purchase_reason = form.reason?.trim() || '기기 업그레이드 검토'
    body.upgrade_context = {
      replacement_intent: intent,
      satisfied_aspects: Array.isArray(form.satisfied) ? form.satisfied : [],
      pain_points: pains,
      ...(noPainConfirmed && pains.length === 0 ? { no_pain_confirmed: true } : {})
    }
  }
  return body
}

export function createRecommendationApi(call = request) {
  return {
    devices: signal => call('/api/owned-devices?limit=50', { signal }),
    profile: signal => call('/api/profile', { signal }),
    conversation: signal => call('/api/recommendations/conversation', { signal }),
    sendConversation: (body, signal) => call('/api/recommendations/conversation', { method: 'POST', body, signal }),
    analyze: (body, signal) => call('/api/analysis', { method: 'POST', body, signal }),
    recommend: (body, signal) => call('/api/recommendations', { method: 'POST', body, signal }),
    history: (cursor, signal) => call('/api/recommendations' + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''), { signal }),
    getRecommendation: (id, signal) => call(`/api/recommendations/${encodeURIComponent(id)}`, { signal }),
    deleteRecommendation: (id, signal) => call(`/api/recommendations/${encodeURIComponent(id)}`, { method: 'DELETE', signal })
  }
}

export function recommendationMessage(error) {
  return ({
    NOT_FOUND: '추천 이력을 찾을 수 없거나 보관 기간(90일)이 만료되었어요.',
    PROFILE_INCOMPLETE: '먼저 내 프로필에서 사용 목적과 구매 성향을 확인하고 저장해 주세요.',
    CONVERSATION_EXPIRED: '상담 시간이 만료됐어요. 입력 내용을 확인한 후 새 상담을 시작해 주세요.',
    CONVERSATION_CHANGED: '다른 요청에서 상담이 변경됐어요. 최신 답변을 불러온 뒤 다시 시도해 주세요.',
    PROFILE_CHANGED: '프로필이 변경됐어요. 입력한 조건을 확인한 후 다시 요청해 주세요.',
    CANDIDATES_CHANGED: '추천 중 제품이나 가격 정보가 변경됐어요. 조건을 확인한 후 다시 요청해 주세요.',
    AUTH_REQUIRED: '로그인이 만료됐어요. 다시 로그인해 주세요.',
    CSRF_INVALID: '보안 확인에 실패했어요. 새로고침 후 다시 시도해 주세요.',
    INVALID_INPUT: '예산과 사용 목적을 확인해 주세요.',
    RATE_LIMITED: '요청이 많아요. 잠시 후 다시 시도해 주세요.',
    AI_TIMEOUT: 'AI 응답 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.',
    AI_INVALID_RESULT: '추천 결과를 안전하게 검증하지 못했어요. 잠시 후 다시 시도해 주세요.',
    AI_KEY_MISSING: '현재 AI 추천 서비스를 사용할 수 없어요. 관리자에게 문의해 주세요.',
    AI_UNAVAILABLE: '현재 AI 추천 서비스에 연결할 수 없어요.',
    NETWORK_ERROR: '서버에 연결하지 못했어요. 요청은 자동으로 다시 전송하지 않습니다.'
  })[error?.code] || (error?.status === 401 ? '로그인이 만료됐어요. 다시 로그인해 주세요.' : error?.status === 404 ? '추천 이력을 찾을 수 없거나 보관 기간(90일)이 만료되었어요.' : '추천을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.')
}
