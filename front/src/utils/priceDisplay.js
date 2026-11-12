export const DANAWA_REFERENCE_LABEL = '다나와 기준 최저가'
export const DANAWA_REFERENCE_NOTICE =
  '다나와 기준 최저가(참고용)입니다. 실제 최종 결제가격(배송비·재고·결제 조건)과 다를 수 있으며, 예산 충족이나 교체 권장 확정 근거로 사용되지 않습니다.'

export function isValidPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function isPriceExpired(price, now = new Date()) {
  if (!price || !price.expires_at) return false
  const expMs = new Date(price.expires_at).getTime()
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime()
  if (!Number.isFinite(expMs) || !Number.isFinite(nowMs)) return true
  return nowMs >= expMs
}

export function isDanawaReferencePrice(price) {
  if (!price) return false
  return price.price_source === 'danawa_reference' || price.is_reference_price === true
}

export function isDevFallbackPrice(price) {
  if (!price) return false
  if (isDanawaReferencePrice(price)) return false
  return price.development_only === true || ['official_launch', 'reference_sale'].includes(price.price_source)
}

export function isVerifiedPrice(price, now = new Date()) {
  if (!price || isPriceExpired(price, now)) return false
  if (isDanawaReferencePrice(price) || isDevFallbackPrice(price)) return false
  return price.price_source === 'verified_sale' && price.purchase_verified === true
}

export function isReferenceOrDevPrice(price, now = new Date()) {
  if (!price || isPriceExpired(price, now)) return false
  return isDanawaReferencePrice(price) || isDevFallbackPrice(price)
}

export function getDisplayPriceAmountKrw(price, now = new Date()) {
  if (!price || isPriceExpired(price, now)) return null
  if (isVerifiedPrice(price, now)) {
    return isValidPositiveNumber(price.total_krw) ? price.total_krw : null
  }
  if (isDanawaReferencePrice(price)) {
    return isValidPositiveNumber(price.amount_krw) ? price.amount_krw : null
  }
  if (isDevFallbackPrice(price)) {
    const devAmt = isValidPositiveNumber(price.budget_basis_krw) ? price.budget_basis_krw : price.amount_krw
    return isValidPositiveNumber(devAmt) ? devAmt : null
  }
  return null
}

export function formatPriceAmount(price, { emptyText = '가격 정보 없음', includeTag = false, now = new Date() } = {}) {
  const amt = getDisplayPriceAmountKrw(price, now)
  if (amt === null) return emptyText
  const formatted = `${amt.toLocaleString('ko-KR')}원`
  if (!includeTag) return formatted
  if (isVerifiedPrice(price, now)) return formatted
  if (isDanawaReferencePrice(price)) return `${formatted} (다나와 기준 최저가)`
  if (price.price_source === 'official_launch') return `${formatted} (개발용 출고가)`
  if (price.price_source === 'reference_sale') return `${formatted} (개발용 참고가)`
  return `${formatted} (개발용 가격)`
}

export function formatPriceTypeLabel(price, { emptyText = '가격 정보 없음', now = new Date() } = {}) {
  if (!price || isPriceExpired(price, now)) return emptyText
  if (isVerifiedPrice(price, now)) return '검증된 판매가 · 배송비 포함'
  if (isDanawaReferencePrice(price)) return DANAWA_REFERENCE_LABEL
  if (price.price_source === 'official_launch') return '개발용 공식 출고가 · 실제 판매가 아님'
  if (price.price_source === 'reference_sale') return '개발용 참고가 · 구매 조건 미검증'
  if (price.development_only === true) return '개발용 가격 · 실제 판매가 아님'
  return emptyText
}

export function formatPriceNotice(price, now = new Date()) {
  if (!price || isPriceExpired(price, now)) return '구매 조건 확인 필요'
  if (price.warning) return price.warning
  if (isDanawaReferencePrice(price)) return DANAWA_REFERENCE_NOTICE
  if (isDevFallbackPrice(price)) {
    return '실제 구매 가능 가격이 아닙니다. 배송비·재고·구매 조건은 확인이 필요합니다.'
  }
  if (isVerifiedPrice(price, now)) return '배송비 포함 검증 가격'
  return '구매 조건 확인 필요'
}

export function getDanawaProductUrl(price, now = new Date()) {
  if (!price || isPriceExpired(price, now)) return null
  const candidate = price.danawa_product_url || null
  if (typeof candidate !== 'string' || !candidate.trim()) return null
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null
  } catch {
    return null
  }
}

export function formatPriceCheckedAt(price, now = new Date()) {
  if (!price || isPriceExpired(price, now)) return '정보 없음'
  const raw = price.checked_at || price.observed_at
  if (!raw) return '정보 없음'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '정보 없음'
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
