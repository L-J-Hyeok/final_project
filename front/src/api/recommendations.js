import { request } from './client'
const usages=['communication','video','coding','gaming','camera','work']
export function buildRecommendationRequest(form,version) {
  const budget=Number(form.budget)
  if(!Number.isInteger(version)||version<1||!Number.isInteger(budget)||budget<1||budget>10000000||!Array.isArray(form.usages)||!form.usages.length||form.usages.some(x=>!usages.includes(x)))throw new Error('예산은 1~10,000,000원 사이의 정수로 입력하고 사용 목적을 선택해 주세요.')
  if(!Array.isArray(form.brands)||form.brands.some(x=>!['samsung','apple'].includes(x)))throw new Error('제조사 선호를 확인해 주세요.')
  const body={expected_profile_version:version,hard:{budget_max_krw:budget,usages:[...new Set(form.usages)]},soft:{preferred_brands:[...new Set(form.brands)]}}
  if(form.deviceId){
    if(!/^[1-9][0-9]*$/.test(String(form.deviceId)) || !form.reason?.trim() || (!form.satisfied?.length && !form.pains?.length))throw new Error('교체 이유와 만족하거나 불편한 항목을 선택해 주세요.')
    if([...form.reason.trim()].length>300)throw new Error('교체 이유는 300자 이내로 입력해 주세요.')
    if(form.satisfied.length>6 || form.pains.length>6)throw new Error('만족·불편 항목은 각각 6개까지 선택해 주세요.')
    body.replacement_device_id=String(form.deviceId)
    body.purchase_reason=form.reason.trim()
    body.upgrade_context={replacement_intent:form.intent,satisfied_aspects:form.satisfied,pain_points:form.pains}
    body.soft.preferred_os=form.os || null
    body.soft.priorities=form.priorities || []
  }
  return body
}
export function createRecommendationApi(call=request) {
  return {
    devices: signal => call('/api/owned-devices?limit=50', { signal }),
    profile: signal => call('/api/profile', { signal }),
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
