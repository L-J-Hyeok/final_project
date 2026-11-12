'use strict';
// Server-side DTO preparation only; never import review JSON into the AI candidate list.
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('./smartphone-catalog');
const positive = n => Number.isSafeInteger(n) && n > 0;
const DATA_DIR = path.resolve(__dirname, '../data');

let cachedCatalogData = null;

const COLOR_SYNONYMS_KR = {
  Black: '블랙',
  White: '화이트',
  'Sky Blue': '스카이 블루',
  Lavender: '라벤더',
  'Titanium Gray': '티타늄 그레이',
  'Titanium Black': '티타늄 블랙',
  'Titanium Silverblue': '티타늄 실버블루',
  'Titanium Jetblack': '티타늄 제트블랙',
  'Titanium Silver': '티타늄 실버',
  'Silver Shadow': '실버 쉐도우',
  'Cobalt Violet': '코발트 바이올렛'
};

function normalizeColor(c) {
  if (typeof c !== 'string') return '';
  return c.trim();
}

function colorsStrictlyMatch(candidateColor, refColor) {
  const c = normalizeColor(candidateColor);
  const r = normalizeColor(refColor);
  if (!c || !r || c.toLowerCase() === 'unspecified' || r.toLowerCase() === 'unspecified') return false;
  if (c === r) return true;
  if (COLOR_SYNONYMS_KR[r] === c || COLOR_SYNONYMS_KR[c] === r) return true;
  return false;
}

function loadServerCuratedCatalogData() {
  if (cachedCatalogData) return cachedCatalogData;
  const normalized = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'normalized-smartphones.json'), 'utf8'));
  const colorReview = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'smartphone-color-price-review-2026-11-11.json'), 'utf8'));
  cachedCatalogData = { normalized, colorReview };
  return cachedCatalogData;
}

function getDevelopmentPricingFlags(env = process.env) {
  const environment = String(env.NODE_ENV || 'production').trim().toLowerCase();
  const allowDevelopmentPrices = environment === 'development' && String(env.ALLOW_DEVELOPMENT_PRICES || '').trim().toLowerCase() === 'true';
  return { environment, allowDevelopmentPrices };
}

function resolveCuratedPriceInputsForVariant(row, customData = null) {
  if (!row || !row.variant_id || !row.phone_verified || !row.variant_verified) {
    return { references: [], launch: null };
  }
  const variantId = String(row.variant_id);
  const brand = String(row.brand || '').toLowerCase();
  const modelNum = String(row.domestic_model_number || '').trim().toUpperCase();
  const storageGb = Number(row.storage_gb);
  const ramGb = row.ram_gb === null || row.ram_gb === undefined ? null : Number(row.ram_gb);
  const color = normalizeColor(row.color);

  const { normalized, colorReview } = customData || loadServerCuratedCatalogData();
  const references = [];

  for (const snap of colorReview.snapshots || []) {
    // Research-only snapshots are not approved variant mappings. Never infer RAM.
    if (snap.mapping_verified !== true || String(snap.variant_id) !== variantId || !positive(snap.displayed_amount_krw)) continue;
    const snapModelNum = String(snap.domestic_model_number_reference || '').trim().toUpperCase();
    if (snapModelNum !== modelNum) continue;
    if (Number(snap.storage_gb) !== storageGb) continue;
    const snapRam = snap.ram_gb !== null && snap.ram_gb !== undefined
      ? Number(snap.ram_gb)
      : null;
    if (snapRam !== ramGb) continue;
    if (!colorsStrictlyMatch(color, snap.color_as_supplied)) continue;

    references.push({
      variant_id: variantId,
      mapping_verified: true,
      storage_gb: storageGb,
      ram_gb: ramGb,
      color: row.color,
      amount_krw: snap.displayed_amount_krw,
      shipping_krw: Number.isSafeInteger(snap.shipping_krw) && snap.shipping_krw >= 0 ? snap.shipping_krw : null,
      research_date: snap.research_date || '2026-11-11',
      source_url: snap.seller_purchase_url || snap.danawa_product_url || null,
      danawa_product_url: snap.danawa_product_url || null,
      seller_name: snap.seller_name || null
    });
  }

  let launch = null;
  const launchEvidence = row.launch_price_metadata_json;
  if (positive(Number(row.launch_price_krw)) && launchEvidence && launchEvidence.status === 'approved') {
    launch = {
      variant_id: variantId,
      mapping_verified: true,
      verified: Boolean(row.phone_verified && row.variant_verified),
      amount_krw: Number(row.launch_price_krw),
      source_url: launchEvidence.source_url || null,
      checked_at: launchEvidence.checked_at || null
    };
  }

  if (!launch) {
    const normMatch = (normalized.smartphone_variants || []).find(v =>
      v.verified === true &&
      String(v.domestic_model_number || '').trim().toUpperCase() === modelNum &&
      Number(v.storage_gb) === storageGb &&
      (v.ram_gb === null || v.ram_gb === undefined ? null : Number(v.ram_gb)) === ramGb &&
      normalizeColor(v.color) === color &&
      positive(v.audit_metadata?.reference_launch_price_krw)
    );
    if (normMatch) {
      launch = {
        variant_id: variantId,
        mapping_verified: true,
        verified: true,
        amount_krw: normMatch.audit_metadata.reference_launch_price_krw,
        source_url: normMatch.source_url || row.variant_source_url || row.phone_source_url || null,
        checked_at: normMatch.verified_at ? String(normMatch.verified_at).slice(0, 10) : '2026-11-06'
      };
    }
  }

  // Configuration-only research cannot establish a color-specific launch price.

  return { references, launch };
}

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

function buildCandidatePriceObject(row, observations = [], env = process.env, now = new Date(), customCurated = null) {
  const priceSummary = catalog.selectBestPrice(observations, now);
  if (priceSummary.selected && priceSummary.selected.eligible) {
    return {
      selected: {
        ...priceSummary.selected,
        price_source: 'verified_sale',
        budget_basis_krw: priceSummary.selected.total_krw,
        purchase_verified: true,
        development_only: false,
        danawa_product_url: priceSummary.selected.danawa_product_url || null,
        checked_at: priceSummary.selected.observed_at,
        warning: priceSummary.selected.warning || null
      },
      latest_by_seller: priceSummary.latest_by_seller
    };
  }

  const { environment, allowDevelopmentPrices } = getDevelopmentPricingFlags(env);
  if (environment === 'development' && allowDevelopmentPrices) {
    const candidate = {
      variant_id: String(row.variant_id),
      phone_verified: Boolean(row.phone_verified),
      variant_verified: Boolean(row.variant_verified),
      storage_gb: Number(row.storage_gb),
      ram_gb: row.ram_gb === null || row.ram_gb === undefined ? null : Number(row.ram_gb),
      color: row.color
    };
    const { references, launch } = customCurated || resolveCuratedPriceInputsForVariant(row);
    const devPricing = selectPrice({
      candidate,
      observations,
      references,
      launch,
      environment,
      allowDevelopmentPrices,
      now
    });

    if (devPricing && devPricing.price_source) {
      const isRefSale = devPricing.price_source === 'reference_sale';
      return {
        selected: {
          observation_id: null,
          variant_id: String(row.variant_id),
          price_source: devPricing.price_source,
          source_name: isRefSale ? '개발용 다나와 참고 스냅샷(비실시간)' : (row.phone_source_name || row.variant_source_name || '국내 공식 출고가(개발용 폴백)'),
          source_url: devPricing.source_url,
          danawa_product_url: devPricing.danawa_product_url,
          seller_name: isRefSale ? '개발용 참고 판매처(실시간 재고 미검증)' : '공식 출고가 기준(실시간 판매처 미검증)',
          amount_krw: devPricing.amount_krw,
          shipping_krw: devPricing.shipping_krw,
          total_krw: devPricing.total_krw,
          budget_basis_krw: devPricing.budget_basis_krw,
          observed_at: null,
          expires_at: null,
          checked_at: devPricing.checked_at,
          conditions_text: isRefSale
            ? '개발용 참고 판매가(배송비·재고·실시간 구매 가능 여부 미검증)'
            : '개발용 국내 공식 출고가 폴백(현재 실제 판매가 아님)',
          unconditional: false,
          in_stock: false,
          is_new: true,
          is_unlocked: true,
          is_expired: false,
          eligible: true,
          purchase_verified: false,
          development_only: true,
          warning: devPricing.warning
        },
        latest_by_seller: priceSummary.latest_by_seller
      };
    }
  }

  const allowDanawaReference = String(env.ALLOW_DANAWA_REFERENCE_PRICES || '').trim().toLowerCase() === 'true'
    || Boolean(customCurated && customCurated.danawaFixtures);
  if (allowDanawaReference) {
    // Lazy require avoids circular dependency cleanly while sharing the strict variant matcher and 24h TTL policy.
    const danawaSync = require('./danawa-price-sync');
    const refPrice = danawaSync.resolveVariantDanawaReferencePrice(row, {
      now,
      fixtures: customCurated && customCurated.danawaFixtures ? customCurated.danawaFixtures : null,
      isMock: true,
    });
    if (refPrice) {
      return {
        selected: refPrice,
        latest_by_seller: priceSummary.latest_by_seller
      };
    }
  }

  return priceSummary;
}

function candidatePriceDTO(input) {
  const pricing = selectPrice(input);
  return { variant_id: input.candidate?.variant_id ?? null, price_source: pricing.price_source, pricing };
}
module.exports = {
  selectPrice,
  candidatePriceDTO,
  getDevelopmentPricingFlags,
  resolveCuratedPriceInputsForVariant,
  buildCandidatePriceObject,
  colorsStrictlyMatch
};
