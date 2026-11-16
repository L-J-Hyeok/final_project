const optionKeys = {
  tablet: ['storage_gb', 'ram_gb', 'connectivity', 'color'],
  laptop: ['cpu', 'gpu', 'ram_gb', 'storage_gb', 'storage_type', 'display', 'connectivity', 'color'],
  smartwatch: ['case_size_mm', 'connectivity', 'case_material', 'band', 'color'],
  earbuds: ['connectivity', 'color'],
  speaker: ['connectivity', 'audio_configuration', 'color']
}

export function skuValue(sku, key) {
  return sku?.options?.[key] ?? sku?.[key] ?? null
}

export function skuDimensions(category, skus) {
  return optionKeys[category].map(key => ({
    key, values: [...new Set(skus.map(sku => skuValue(sku, key)))].filter(value => value != null)
  })).filter(group => group.values.length)
}

export function chooseSku(skus, dimensions, current, key, value, unavailable) {
  const matches = skus.filter(sku => skuValue(sku, key) === value && !unavailable(sku))
  const differences = sku => dimensions.filter(group => group.key !== key &&
    skuValue(current, group.key) !== skuValue(sku, group.key))
  matches.sort((a, b) => differences(a).length - differences(b).length)
  const sku = matches[0]
  return sku ? { sku, changed: differences(sku).map(group => group.key) } : null
}

export const priceStatusLabels = {
  sold_out: '품절 확인',
  discontinued: '단종 확인',
  no_new_seller: '신품 판매처 확인 불가',
  option_mismatch: '일치하는 구성의 가격 없음',
  sale_condition_mismatch: '일반 구매 가격 확인 불가',
  price_excluded: '가격 검증 제외'
}
export function priceStatusLabel(status) {
  return Object.hasOwn(priceStatusLabels, status) ? priceStatusLabels[status] : '가격 확인 불가'
}
