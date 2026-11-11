'use strict';
// Server-side DTO preparation only; never import review JSON into the AI candidate list.
const catalog = require('./smartphone-catalog');
const positive = n => Number.isSafeInteger(n) && n > 0;
function selectPrice({ candidate, observations = [], references = [], launch = null, environment = 'production', allowDevelopmentPrices = false, now = new Date() }) {
  const empty = { price_source: null, amount_krw: null, shipping_krw: null, total_krw: null, budget_basis_krw: null, purchase_verified: false, development_only: false, source_url: null, danawa_product_url: null, checked_at: null, warning: null };
  if (!candidate || !candidate.variant_id || !candidate.phone_verified || !candidate.variant_verified) return empty;
  const id = String(candidate.variant_id);
  const valid = observations.filter(o => String(o.variant_id) === id && ['in_stock','is_new','is_unlocked','unconditional'].every(k => o[k] === true || o[k] === 1) && o.observed_at && o.expires_at && Number.isFinite(Date.parse(o.observed_at)) && Number.isFinite(Date.parse(o.expires_at)));
  const sale = catalog.selectBestPrice(valid, now).selected;
  if (sale) return { ...empty, price_source: 'verified_sale', amount_krw: sale.amount_krw, shipping_krw: sale.shipping_krw, total_krw: sale.total_krw, budget_basis_krw: sale.total_krw, purchase_verified: true, source_url: sale.source_url, checked_at: sale.observed_at };
  if (environment !== 'development' || allowDevelopmentPrices !== true) return empty;
  // These mappings must be curated on the server, never supplied by request bodies.
  const matches = references.filter(r => r.mapping_verified === true && String(r.variant_id) === id && r.storage_gb === candidate.storage_gb && r.color === candidate.color && r.ram_gb === candidate.ram_gb && positive(r.amount_krw));
  const ref = [...matches].sort((a,b) => String(b.research_date).localeCompare(String(a.research_date)) || a.amount_krw-b.amount_krw)[0];
  let chosen = ref, source = 'reference_sale';
  if (!chosen && launch && launch.mapping_verified === true && String(launch.variant_id) === id && launch.verified === true && positive(launch.amount_krw)) { chosen = launch; source = 'official_launch'; }
  if (!chosen) return empty;
  const shipping = source === 'reference_sale' && Number.isSafeInteger(chosen.shipping_krw) && chosen.shipping_krw >= 0 ? chosen.shipping_krw : null;
  return { ...empty, price_source: source, amount_krw: chosen.amount_krw, shipping_krw: shipping, total_krw: shipping === null ? null : chosen.amount_krw + shipping, budget_basis_krw: chosen.amount_krw + (shipping === null ? 0 : shipping), development_only: true, source_url: chosen.source_url || null, danawa_product_url: source === 'reference_sale' ? chosen.danawa_product_url || null : null, checked_at: chosen.research_date || chosen.checked_at || null, warning: '개발용 참고 가격입니다. 실제 구매 가능 가격과 다를 수 있으며 배송비가 포함되지 않을 수 있습니다.' };
}
function candidatePriceDTO(input) {
  const pricing = selectPrice(input);
  return { variant_id: input.candidate?.variant_id ?? null, price_source: pricing.price_source, pricing };
}
module.exports = { selectPrice, candidatePriceDTO };
