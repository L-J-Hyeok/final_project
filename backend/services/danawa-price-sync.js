'use strict';

const fs = require('fs');
const path = require('path');
const { QueryTypes } = require('sequelize');
const catalog = require('./smartphone-catalog');
const productPublication = require('./product-publication');
const adapterModule = require('./danawa-price-adapter');
const matcher = require('./danawa-price-matcher');

const DEFAULT_SOURCE_NAME = 'danawa-cli';
const DEFAULT_TTL_HOURS = 6;
const MAX_TTL_HOURS = 24;
const TWENTY_FOUR_HOURS_MS = catalog.TWENTY_FOUR_HOURS_MS || MAX_TTL_HOURS * 60 * 60 * 1000;
const DANAWA_REFERENCE_LABEL = '다나와 기준 최저가';
const DANAWA_REFERENCE_WARNING =
  '다나와 기준 최저가(참고용)입니다. 배송비·재고·결제 조건에 따라 실제 최종 결제가격과 다를 수 있으며, 예산 충족이나 교체 권장 확정 근거로 사용되지 않습니다.';
const DEFAULT_MOCK_FIXTURE_PATH = path.resolve(__dirname, '../data/danawa-cli-mock-samples.json');
let cachedMockFixtures = null;

async function loadExistingSmartphoneVariants(db, options = {}) {
  if (!db) {
    const err = new Error('Database instance is required to load existing variants');
    err.code = 'DB_REQUIRED';
    throw err;
  }

  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 20;
  const whereClauses = [];
  const replacements = { limit };

  if (options.includeUnapproved !== true) {
    whereClauses.push(await productPublication.sql(db));
  } else {
    whereClauses.push('s.is_test = 0');
  }

  if (Array.isArray(options.variantIds) && options.variantIds.length > 0) {
    whereClauses.push('v.id IN (:variantIds)');
    replacements.variantIds = options.variantIds.map(String);
  }
  if (Array.isArray(options.smartphoneIds) && options.smartphoneIds.length > 0) {
    whereClauses.push('s.id IN (:smartphoneIds)');
    replacements.smartphoneIds = options.smartphoneIds.map(String);
  }
  if (Array.isArray(options.domesticModelNumbers) && options.domesticModelNumbers.length > 0) {
    whereClauses.push('s.domestic_model_number IN (:domesticModelNumbers)');
    replacements.domesticModelNumbers = options.domesticModelNumbers.map(String);
  }

  const sql = `
    SELECT
      v.id AS variant_id,
      v.smartphone_id,
      s.brand,
      s.model_name,
      s.domestic_model_number,
      v.storage_gb,
      v.ram_gb,
      v.ram_identity_gb,
      v.color,
      v.launch_price_krw,
      s.review_status AS smartphone_review_status,
      v.review_status AS variant_review_status
    FROM smartphones s
    JOIN smartphone_variants v ON v.smartphone_id = s.id
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY s.id ASC, v.storage_gb ASC, v.ram_identity_gb ASC, v.color ASC
    LIMIT :limit
  `;

  return db.query(sql, { replacements, type: QueryTypes.SELECT });
}

function parseValidDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function validateTtlHours(ttlHours) {
  const num = ttlHours == null ? DEFAULT_TTL_HOURS : Number(ttlHours);
  if (!Number.isFinite(num) || num <= 0 || num > MAX_TTL_HOURS) {
    const err = new Error(`ttlHours must be > 0 and <= ${MAX_TTL_HOURS}`);
    err.code = 'INVALID_TTL_HOURS';
    throw err;
  }
  return num;
}

function collectMissingSellerFields(item = {}) {
  const missing = [];
  if (!item.source_url) missing.push('source_url');
  if (!item.seller_name) missing.push('seller_name');
  if (item.shipping_krw === null || item.shipping_krw === undefined) missing.push('shipping_krw');
  if (item.unconditional === null || item.unconditional === undefined) missing.push('unconditional');
  if (item.in_stock === null || item.in_stock === undefined) missing.push('in_stock');
  if (item.is_new === null || item.is_new === undefined) missing.push('is_new');
  if (item.is_unlocked === null || item.is_unlocked === undefined) missing.push('is_unlocked');
  return missing;
}

function mapMatchedOfferToPriceObservation(matchResult, variant, options = {}) {
  const item = (matchResult && matchResult.item) || {};
  const now = parseValidDate(options.now) || new Date();
  const ttlHours = validateTtlHours(options.ttlHours);

  const observedAt = parseValidDate(item.observed_at) || now;
  const explicitExpiresAt = parseValidDate(item.expires_at);
  const expiresAt = explicitExpiresAt || new Date(observedAt.getTime() + ttlHours * 60 * 60 * 1000);

  const ttlMs = expiresAt.getTime() - observedAt.getTime();
  const ttlWithin24h = ttlMs > 0 && ttlMs <= TWENTY_FOUR_HOURS_MS;
  const notExpiredYet = observedAt.getTime() <= now.getTime() && now.getTime() < expiresAt.getTime();

  const missingSellerFields = collectMissingSellerFields(item);
  const blockingReasons = [];
  if (missingSellerFields.length > 0) {
    blockingReasons.push(`INCOMPLETE_SELLER_FIELDS:${missingSellerFields.join(',')}`);
  }
  if (!ttlWithin24h) {
    blockingReasons.push('TTL_EXCEEDS_OR_INVALID_24H_WINDOW');
  }
  if (!notExpiredYet) {
    blockingReasons.push('OBSERVATION_ALREADY_EXPIRED_OR_FUTURE_OBSERVED_AT');
  }

  const observationPayload = {
    variant_id: String(variant.variant_id != null ? variant.variant_id : variant.id),
    source_name: item.source_name || options.sourceName || DEFAULT_SOURCE_NAME,
    source_url: item.source_url || null,
    seller_name: item.seller_name || item.mallName || null,
    amount_krw: item.minPrice != null ? Number(item.minPrice) : null,
    shipping_krw: item.shipping_krw != null ? Number(item.shipping_krw) : null,
    observed_at: observedAt,
    expires_at: expiresAt,
    conditions_text: item.conditions_text || null,
    unconditional: item.unconditional,
    in_stock: item.in_stock,
    is_new: item.is_new,
    is_unlocked: item.is_unlocked,
  };

  const evaluation = catalog.evaluateObservation(observationPayload, now);
  if (!evaluation.eligible && blockingReasons.length === 0) {
    blockingReasons.push('CATALOG_EVALUATION_INELIGIBLE');
  }

  const readyForStorage = blockingReasons.length === 0 && evaluation.eligible === true;

  return {
    readyForStorage,
    blockingReasons,
    missingSellerFields,
    dataCompleteness: item.data_completeness || (missingSellerFields.length === 0 ? 'complete_verified_offer' : 'search_summary_only'),
    ttlHoursApplied: Math.round((ttlMs / (60 * 60 * 1000)) * 100) / 100,
    ttlWithin24h,
    observationPayload,
    evaluation,
    danawaProductUrl: item.danawaProductUrl || null,
    productCode: item.productCode || null,
    matchDetails: matchResult.matchDetails || null,
  };
}

function buildDanawaReferencePrice(matchResult, variant, options = {}) {
  if (!matchResult || !matchResult.matched || !matchResult.item) return null;
  const item = matchResult.item;
  const amountKrw = Number(item.minPrice);
  if (!Number.isSafeInteger(amountKrw) || amountKrw <= 0) return null;

  const now = parseValidDate(options.now) || new Date();
  const ttlHours = validateTtlHours(options.ttlHours);
  const observedAt = parseValidDate(options.observedAt || item.observed_at || options.fixtureGeneratedAt) || now;
  const explicitExpiresAt = parseValidDate(options.expiresAt || item.expires_at);
  const expiresAt = explicitExpiresAt || new Date(observedAt.getTime() + ttlHours * 60 * 60 * 1000);

  const ttlMs = expiresAt.getTime() - observedAt.getTime();
  const ttlWithin24h = ttlMs > 0 && ttlMs <= TWENTY_FOUR_HOURS_MS;
  const activeNow = observedAt.getTime() <= now.getTime() && now.getTime() < expiresAt.getTime();
  if (!ttlWithin24h || !activeNow) {
    return null;
  }

  const danawaUrl = adapterModule.safeHttpUrl(item.danawaProductUrl) || null;
  const isMock = options.isMock !== false;

  return {
    observation_id: null,
    variant_id: String(variant.variant_id != null ? variant.variant_id : variant.id),
    price_source: 'danawa_reference',
    price_label: DANAWA_REFERENCE_LABEL,
    is_reference_price: true,
    purchase_verified: false,
    development_only: false,
    eligible: false,
    is_expired: false,
    source_name: isMock ? '다나와 가격비교 (Mock 참고가)' : '다나와 가격비교 (참고가)',
    source_url: danawaUrl,
    danawa_product_url: danawaUrl,
    danawa_product_code: item.productCode || null,
    danawa_product_name: item.productName || null,
    seller_name: item.mallName ? `${item.mallName} (다나와 검색 요약)` : '다나와 가격비교',
    amount_krw: amountKrw,
    shipping_krw: null,
    total_krw: null,
    budget_basis_krw: null,
    observed_at: observedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    checked_at: observedAt.toISOString(),
    conditions_text: '모델번호·용량·색상·자급제 매칭 다나와 검색 기준가 (배송비·재고·판매조건 미검증)',
    unconditional: null,
    in_stock: null,
    is_new: true,
    is_unlocked: true,
    is_mock: isMock,
    warning: DANAWA_REFERENCE_WARNING,
    match_details: matchResult.matchDetails || null,
  };
}

function selectBestDanawaReferencePrice(referencePrices = []) {
  const valid = referencePrices.filter(r => r && Number.isSafeInteger(r.amount_krw) && r.amount_krw > 0 && r.is_expired === false);
  if (valid.length === 0) return null;
  return [...valid].sort((a, b) => a.amount_krw - b.amount_krw)[0];
}

function loadMockDanawaReferenceFixtures(fixturePath = DEFAULT_MOCK_FIXTURE_PATH) {
  try {
    if (fixturePath === DEFAULT_MOCK_FIXTURE_PATH && cachedMockFixtures) {
      return cachedMockFixtures;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    if (fixturePath === DEFAULT_MOCK_FIXTURE_PATH) {
      cachedMockFixtures = raw;
    }
    return raw;
  } catch {
    return null;
  }
}

function resolveVariantDanawaReferencePrice(variant, options = {}) {
  try {
    if (!variant || !variant.domestic_model_number) return null;
    const fixtures = options.fixtures || loadMockDanawaReferenceFixtures(options.fixturePath);
    if (!fixtures) return null;

    const now = parseValidDate(options.now) || new Date();
    const ttlHours = validateTtlHours(options.ttlHours);
    const isMock = options.isMock !== false;

    const adapter = adapterModule.createDanawaSearchAdapter({ mode: 'mock', fixtures });
    const queries = adapterModule.buildVariantSearchQueries(variant);
    let candidateItems = [];
    // Resolve synchronously via mock batches/maps without live HTTP requests.
    if (Array.isArray(fixtures.batches)) {
      const code = String(variant.domestic_model_number || '').trim().toUpperCase();
      const vid = variant.variant_id != null ? String(variant.variant_id) : (variant.id != null ? String(variant.id) : null);
      for (const batch of fixtures.batches) {
        const codes = Array.isArray(batch.domestic_model_numbers)
          ? batch.domestic_model_numbers.map(c => String(c).trim().toUpperCase())
          : (batch.domestic_model_number ? [String(batch.domestic_model_number).trim().toUpperCase()] : []);
        const vids = Array.isArray(batch.variant_ids) ? batch.variant_ids.map(String) : [];
        if ((code && codes.includes(code)) || (vid && vids.includes(vid))) {
          candidateItems.push(...adapterModule.parseCliSearchPayload(batch.items || []));
        }
      }
    } else {
      const resolvedSync = adapter.buildSearchPlan([variant]);
      void resolvedSync;
      if (fixtures.byVariantId && variant.variant_id && fixtures.byVariantId[String(variant.variant_id)]) {
        candidateItems = adapterModule.parseCliSearchPayload(fixtures.byVariantId[String(variant.variant_id)]);
      } else if (fixtures.byDomesticModelNumber) {
        const code = String(variant.domestic_model_number).trim().toUpperCase();
        if (fixtures.byDomesticModelNumber[code]) {
          candidateItems = adapterModule.parseCliSearchPayload(fixtures.byDomesticModelNumber[code]);
        }
      } else if (fixtures.byQuery && typeof fixtures.byQuery === 'object') {
        for (const q of queries) {
          if (fixtures.byQuery[q]) {
            candidateItems = adapterModule.parseCliSearchPayload(fixtures.byQuery[q]);
            break;
          }
        }
      } else if (Array.isArray(fixtures.items) || Array.isArray(fixtures)) {
        candidateItems = adapterModule.parseCliSearchPayload(fixtures);
      }
    }

    if (candidateItems.length === 0) return null;

    const matchEval = matcher.evaluateVariantCandidates(candidateItems, variant, {
      requireDomesticModelNumber: options.requireDomesticModelNumber !== false,
    });
    const refs = matchEval.matched
      .map(m => buildDanawaReferencePrice(m, variant, {
        now,
        ttlHours,
        fixtureGeneratedAt: fixtures.generatedAt || null,
        isMock,
      }))
      .filter(Boolean);

    return selectBestDanawaReferencePrice(refs);
  } catch {
    return null;
  }
}

function summarizeExclusionCounts(rejected = []) {
  const counts = {};
  for (const r of rejected) {
    const key = r.exclusionCategory || 'other';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

async function runDanawaPriceDryRun(options = {}) {
  if (!options.adapter || typeof options.adapter.searchVariant !== 'function') {
    const err = new Error('An initialized Danawa search adapter is required');
    err.code = 'ADAPTER_REQUIRED';
    throw err;
  }

  const now = parseValidDate(options.now) || new Date();
  const ttlHours = validateTtlHours(options.ttlHours);
  const variants = Array.isArray(options.variants)
    ? options.variants
    : await loadExistingSmartphoneVariants(options.db, options);

  const variantReports = [];
  const summary = {
    dryRun: true,
    dbWritesAttempted: 0,
    adapterMode: options.adapter.mode,
    executedLiveRequest: false,
    evaluatedAt: now.toISOString(),
    ttlHours,
    totalVariantsChecked: variants.length,
    variantsWithMatchedCandidates: 0,
    variantsWithReferencePrice: 0,
    variantsReadyForStorage: 0,
    totalItemsInspected: 0,
    totalMatchedItems: 0,
    totalReadyObservations: 0,
    totalIncompleteSearchOnlyMatches: 0,
    totalRejectedItems: 0,
    exclusionBreakdown: {},
  };

  for (const variant of variants) {
    const searchResult = await options.adapter.searchVariant(variant, options.searchOptions);
    if (searchResult.executedLiveRequest) {
      summary.executedLiveRequest = true;
    }

    const items = searchResult.items || [];
    summary.totalItemsInspected += items.length;

    const matchEval = matcher.evaluateVariantCandidates(items, variant, {
      requireDomesticModelNumber: options.requireDomesticModelNumber !== false,
    });

    const mappedMatches = matchEval.matched.map(m =>
      mapMatchedOfferToPriceObservation(m, variant, { now, ttlHours, sourceName: options.sourceName })
    );

    const referencePrices = matchEval.matched
      .map(m => buildDanawaReferencePrice(m, variant, {
        now,
        ttlHours,
        fixtureGeneratedAt: options.fixtureGeneratedAt || null,
        isMock: options.adapter.mode === 'mock',
      }))
      .filter(Boolean);
    const bestReferencePrice = selectBestDanawaReferencePrice(referencePrices);

    const readyObservations = mappedMatches
      .filter(m => m.readyForStorage)
      .map((m, idx) => ({ id: idx + 1, ...m.observationPayload }));

    const bestPriceSelection = catalog.selectBestPrice(readyObservations, now);

    if (matchEval.matched.length > 0) summary.variantsWithMatchedCandidates += 1;
    if (bestReferencePrice) summary.variantsWithReferencePrice += 1;
    if (readyObservations.length > 0) summary.variantsReadyForStorage += 1;
    summary.totalMatchedItems += matchEval.matched.length;
    summary.totalReadyObservations += readyObservations.length;
    summary.totalIncompleteSearchOnlyMatches += mappedMatches.filter(m => !m.readyForStorage).length;
    summary.totalRejectedItems += matchEval.rejected.length;

    const variantExclusions = summarizeExclusionCounts(matchEval.rejected);
    for (const [k, v] of Object.entries(variantExclusions)) {
      summary.exclusionBreakdown[k] = (summary.exclusionBreakdown[k] || 0) + v;
    }

    variantReports.push({
      variant: {
        variant_id: String(variant.variant_id != null ? variant.variant_id : variant.id),
        smartphone_id: variant.smartphone_id != null ? String(variant.smartphone_id) : null,
        brand: variant.brand,
        model_name: variant.model_name,
        domestic_model_number: variant.domestic_model_number,
        storage_gb: Number(variant.storage_gb),
        ram_gb: variant.ram_gb != null ? Number(variant.ram_gb) : null,
        color: variant.color,
        launch_price_krw: variant.launch_price_krw != null ? Number(variant.launch_price_krw) : null,
      },
      queries: searchResult.queries,
      totalItemsInspected: items.length,
      matchedCount: mappedMatches.length,
      readyForStorageCount: readyObservations.length,
      rejectedCount: matchEval.rejected.length,
      mappedMatches,
      rejected: matchEval.rejected.map(r => ({
        productCode: r.item && r.item.productCode ? r.item.productCode : null,
        productName: r.item && r.item.productName ? r.item.productName : null,
        minPrice: r.item && r.item.minPrice != null ? r.item.minPrice : null,
        disqualified: r.disqualified,
        exclusionCategory: r.exclusionCategory,
        reasons: r.reasons,
      })),
      bestSelectedPrice: bestPriceSelection.selected,
      bestReferencePrice,
    });
  }

  return {
    summary,
    variantReports,
  };
}

async function persistVerifiedObservations(db, mappedCandidates = [], options = {}) {
  if (options.apply !== true || options.allowDbWrite !== true) {
    return {
      applied: false,
      reason: 'DRY_RUN_ONLY',
      insertedCount: 0,
      skippedDuplicatesCount: 0,
      rejectedIncompleteCount: mappedCandidates.filter(c => !c.readyForStorage).length,
    };
  }

  if (typeof options.permissionRef !== 'string' || options.permissionRef.trim().length < 3) {
    const err = new Error('DB persistence requires a valid authorization permissionRef');
    err.code = 'WRITE_PERMISSION_REF_REQUIRED';
    throw err;
  }

  const PriceObservationModel = db?.models?.price_observations || db?.models?.PriceObservation;
  if (!PriceObservationModel) {
    const err = new Error('Sequelize PriceObservation model is required for persistence');
    err.code = 'PRICE_OBSERVATION_MODEL_REQUIRED';
    throw err;
  }

  const ready = mappedCandidates.filter(c => c && c.readyForStorage === true && c.evaluation && c.evaluation.eligible === true);
  const incompleteCount = mappedCandidates.length - ready.length;
  if (ready.length === 0) {
    return {
      applied: true,
      insertedCount: 0,
      skippedDuplicatesCount: 0,
      rejectedIncompleteCount: incompleteCount,
    };
  }

  const { Op } = require('sequelize');
  const now = parseValidDate(options.now) || new Date();
  let insertedCount = 0;
  let skippedDuplicatesCount = 0;
  const insertedRecords = [];

  await db.transaction(async (transaction) => {
    for (const candidate of ready) {
      const p = candidate.observationPayload;
      const existing = await PriceObservationModel.findOne({
        where: {
          variant_id: p.variant_id,
          source_name: p.source_name,
          seller_name: p.seller_name,
          amount_krw: p.amount_krw,
          shipping_krw: p.shipping_krw,
          expires_at: { [Op.gt]: now },
        },
        transaction,
      });

      if (existing) {
        skippedDuplicatesCount += 1;
        continue;
      }

      const created = await PriceObservationModel.create(p, { transaction });
      insertedCount += 1;
      insertedRecords.push(created);
    }
  });

  return {
    applied: true,
    insertedCount,
    skippedDuplicatesCount,
    rejectedIncompleteCount: incompleteCount,
    insertedRecords,
  };
}

async function syncVariantPrices(db, { variants, adapter, options = {} } = {}) {
  if (!adapter || typeof adapter.searchVariant !== 'function') {
    const err = new Error('An initialized Danawa search adapter is required');
    err.code = 'ADAPTER_REQUIRED';
    throw err;
  }

  const now = parseValidDate(options.now) || new Date();
  const ttlHours = validateTtlHours(options.ttlHours);
  const targetVariants = Array.isArray(variants)
    ? variants
    : await loadExistingSmartphoneVariants(db, options);

  const dryRunResult = await runDanawaPriceDryRun({
    db,
    variants: targetVariants,
    adapter,
    now,
    ttlHours,
    sourceName: options.sourceName,
    requireDomesticModelNumber: options.requireDomesticModelNumber,
    searchOptions: options.searchOptions,
    fixtureGeneratedAt: options.fixtureGeneratedAt,
  });

  const allMappedCandidates = [];
  for (const report of dryRunResult.variantReports) {
    if (Array.isArray(report.mappedMatches)) {
      allMappedCandidates.push(...report.mappedMatches);
    }
  }

  let persistenceResult = {
    applied: false,
    reason: options.apply === true ? 'NO_DB_GIVEN' : 'DRY_RUN_ONLY',
    insertedCount: 0,
    skippedDuplicatesCount: 0,
    rejectedIncompleteCount: allMappedCandidates.filter(c => !c.readyForStorage).length,
  };

  if (options.apply === true && options.allowDbWrite === true) {
    if (!db) {
      const err = new Error('Database instance is required for applying price sync');
      err.code = 'DB_REQUIRED';
      throw err;
    }
    persistenceResult = await persistVerifiedObservations(db, allMappedCandidates, {
      apply: true,
      allowDbWrite: true,
      permissionRef: options.permissionRef,
      now,
    });
  }

  return {
    success: true,
    dryRun: !persistenceResult.applied,
    evaluatedAt: now.toISOString(),
    ttlHours,
    summary: dryRunResult.summary,
    persistence: persistenceResult,
    variantReports: dryRunResult.variantReports,
  };
}

// Seller feed ingestion is separate from CLI search summaries. The feed supplier must
// attest lookup/storage rights; no website scraping or fabricated seller rows here.
async function syncSellerPrices(db, { variant, feed, options = {} } = {}) {
  const sellerPrices = require('./danawa-seller-prices');
  if (!variant || !feed || !Array.isArray(feed.offers) || feed.offers.length > 100) throw new Error('INVALID_SELLER_FEED');
  if (options.apply === true) {
    const rows = await loadExistingSmartphoneVariants(db, { variantIds: [variant.variant_id], limit: 1 });
    const actual = rows.find(row => String(row.variant_id) === String(variant.variant_id));
    if (!actual) throw new Error('PUBLIC_VARIANT_REQUIRED');
    variant = actual; // Caller-supplied model/options are never trusted for writes.
  }
  const prepared = sellerPrices.prepareSellerObservations(variant, feed, options);
  const persistence = await sellerPrices.persistSellerObservations(db, prepared, options);
  return { ...prepared, persistence };
}

module.exports = {
  syncSellerPrices,
  DEFAULT_SOURCE_NAME,
  DEFAULT_TTL_HOURS,
  MAX_TTL_HOURS,
  DANAWA_REFERENCE_LABEL,
  DANAWA_REFERENCE_WARNING,
  loadExistingSmartphoneVariants,
  collectMissingSellerFields,
  mapMatchedOfferToPriceObservation,
  buildDanawaReferencePrice,
  selectBestDanawaReferencePrice,
  loadMockDanawaReferenceFixtures,
  resolveVariantDanawaReferencePrice,
  runDanawaPriceDryRun,
  persistVerifiedObservations,
  syncVariantPrices,
};
