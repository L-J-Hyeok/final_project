'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ranker = require('../services/recommendation-ranker');
const validator = require('../services/recommendation-validator');
const aiModule = require('../services/ai-adapter');
const connection = require('../db/connection');
const phonesRouter = require('../routes/smartphones');
const recRouter = require('../routes/recommendations');

const FIXED_NOW = new Date('2026-11-13T05:00:00.000Z');
const VALID_EXPIRES_AT = '2026-11-14T04:00:00.000Z';
const EXPIRED_AT = '2026-11-12T05:00:00.000Z';

function makeCandidate(overrides = {}) {
  const base = {
    variant_id: '90001390',
    smartphone_id: '101',
    brand: 'samsung',
    model_name: 'Galaxy S24',
    domestic_model_number: 'SM-S921N',
    released_on_kr: '2024-01-31',
    os: 'android',
    chipset: 'Exynos 2400',
    screen_inches: 6.2,
    refresh_hz: 120,
    battery_mah: 4000,
    weight_g: 167,
    supports_5g: true,
    wireless_charging: true,
    storage_gb: 256,
    ram_gb: 8,
    color: '오닉스 블랙',
    sources: { model: { source_name: 'Samsung KR' }, variant: { source_name: 'Samsung KR' } },
    price: {
      observation_id: '7001',
      price_source: 'danawa_reference',
      price_label: '다나와 기준 최저가',
      is_reference_price: true,
      total_krw: 1177790,
      amount_krw: 1177790,
      shipping_krw: null,
      budget_basis_krw: 1177790,
      purchase_verified: true,
      development_only: false,
      source_name: '다나와 (danawa-cli)',
      source_url: 'https://prod.danawa.com/info/?pcode=123',
      danawa_product_url: 'https://prod.danawa.com/info/?pcode=123',
      danawa_product_code: '20123457',
      danawa_product_code: '20123456',
      seller_name: null,
      observed_at: '2026-11-13T04:00:00.000Z',
      expires_at: VALID_EXPIRES_AT,
      checked_at: '2026-11-13T04:00:00.000Z',
      conditions_text: '자급제 신품 기준',
      warning: '판매 가격은 구매 조건에 따라 달라질 수 있습니다.'
    },
    eligible_reasons: [
      { code: 'storage_meets_requirement', field: 'storage_gb', value: 256 },
      { code: 'budget_headroom', field: 'total_krw', value: 322210 }
    ]
  };
  return {
    ...base,
    ...overrides,
    price: overrides.price === null ? null : { ...base.price, ...(overrides.price || {}) }
  };
}

function invokeRouter(router, method, path, reqOverrides = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method: method.toUpperCase(),
      url: path,
      originalUrl: `/api${path}`,
      path,
      params: {},
      query: {},
      headers: {},
      session: { user_id: '1' },
      body: {},
      ...reqOverrides
    };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); },
      end() { resolve({ status: this.statusCode, body: null }); }
    };
    router.handle(req, res, err => (err ? reject(err) : resolve({ status: res.statusCode, body: null })));
  });
}

test('1. Deterministic reproducibility: identical input + candidates + timestamp produces identical ranking and policy version', () => {
  const candidates = [
    makeCandidate({ variant_id: '101', smartphone_id: '1', model_name: 'Model A', price: { total_krw: 900000, budget_basis_krw: 900000 } }),
    makeCandidate({ variant_id: '102', smartphone_id: '2', model_name: 'Model B', storage_gb: 512, weight_g: 190, price: { total_krw: 1100000, budget_basis_krw: 1100000 } }),
    makeCandidate({ variant_id: '103', smartphone_id: '3', model_name: 'Model C', weight_g: 155, battery_mah: 4500, price: { total_krw: 950000, budget_basis_krw: 950000 } })
  ];
  const profile = { common: { usages: ['video', 'work'], spending_style: 'balanced', mobility: 'medium' }, smartphone: {} };
  const purchaseConditions = { hard: { budget_max_krw: 1500000, usages: ['video'], allowed_brands: ['samsung', 'apple'] }, soft: { priorities: ['battery'] } };

  const r1 = ranker.rankSmartphoneCandidates({ candidates, profile, purchaseConditions, now: FIXED_NOW });
  const r2 = ranker.rankSmartphoneCandidates({ candidates, profile, purchaseConditions, now: FIXED_NOW });

  assert.equal(r1.policy_version, ranker.RANKING_POLICY_VERSION);
  assert.deepEqual(r1.public_ranking, r2.public_ranking);
  assert.deepEqual(
    r1.top_candidates.map(c => c.candidate.variant_id),
    r2.top_candidates.map(c => c.candidate.variant_id)
  );
});

test('2. Weight personalization: value+portability vs premium+display shifts ranking rationally', () => {
  const compactValue = makeCandidate({
    variant_id: '201',
    smartphone_id: '21',
    model_name: 'Compact Value',
    weight_g: 155,
    screen_inches: 6.1,
    storage_gb: 256,
    ram_gb: 8,
    refresh_hz: 60,
    price: { total_krw: 750000, budget_basis_krw: 750000 }
  });
  const bigPremium = makeCandidate({
    variant_id: '202',
    smartphone_id: '22',
    model_name: 'Big Premium',
    weight_g: 232,
    screen_inches: 6.8,
    storage_gb: 512,
    ram_gb: 12,
    refresh_hz: 120,
    battery_mah: 5000,
    price: { total_krw: 1450000, budget_basis_krw: 1450000 }
  });

  const valueResult = ranker.rankSmartphoneCandidates({
    candidates: [bigPremium, compactValue],
    profile: { common: { usages: ['communication'], spending_style: 'value', mobility: 'high' } },
    purchaseConditions: { hard: { budget_max_krw: 1500000, usages: ['communication'], allowed_brands: ['samsung', 'apple'] }, soft: { priorities: ['portability'] } },
    now: FIXED_NOW
  });
  assert.equal(valueResult.top_candidates[0].candidate.variant_id, '201');

  const premiumResult = ranker.rankSmartphoneCandidates({
    candidates: [compactValue, bigPremium],
    profile: { common: { usages: ['gaming', 'video'], spending_style: 'premium', mobility: 'low' } },
    purchaseConditions: { hard: { budget_max_krw: 1500000, usages: ['gaming', 'video'], allowed_brands: ['samsung', 'apple'] }, soft: { priorities: ['display', 'performance'] } },
    now: FIXED_NOW
  });
  assert.equal(premiumResult.top_candidates[0].candidate.variant_id, '202');
});

test('3. Excludes over-budget, hard-condition violations, and unverified candidates before ranking', () => {
  const candidates = [
    makeCandidate({ variant_id: '301', price: { total_krw: 1600000, budget_basis_krw: 1600000 } }), // over budget
    makeCandidate({ variant_id: '302', phone_verified: false }), // unverified model
    makeCandidate({ variant_id: '303', variant_verified: false }), // unverified variant
    makeCandidate({ variant_id: '304', brand: 'apple', os: 'ios' }), // disallowed brand/os
    makeCandidate({ variant_id: '305', released_on_kr: '2020-01-01' }), // outside 3-year window
    makeCandidate({ variant_id: '306', price: { total_krw: 1000000, budget_basis_krw: 1000000 } }) // valid
  ];

  const res = ranker.rankSmartphoneCandidates({
    candidates,
    profile: { common: { usages: ['work'], spending_style: 'balanced' } },
    purchaseConditions: { hard: { budget_max_krw: 1500000, usages: ['work'], allowed_brands: ['samsung'], required_os: 'android' }, soft: {} },
    now: FIXED_NOW
  });

  assert.equal(res.top_candidates.length, 1);
  assert.equal(res.top_candidates[0].candidate.variant_id, '306');
  assert.equal(res.excluded_candidates.length, 5);
});

test('4. Missing specs are NEVER converted to 0 and are flagged as insufficient_info', () => {
  const completeCand = makeCandidate({
    variant_id: '401',
    weight_g: 168,
    battery_mah: 4200,
    refresh_hz: 120,
    ram_gb: 8,
    storage_gb: 256,
    price: { total_krw: 950000, budget_basis_krw: 950000 }
  });
  const sparseCand = makeCandidate({
    variant_id: '402',
    weight_g: null,
    battery_mah: null,
    refresh_hz: null,
    ram_gb: null,
    screen_inches: null,
    storage_gb: 512,
    price: { total_krw: 950000, budget_basis_krw: 950000 }
  });

  const res = ranker.rankSmartphoneCandidates({
    candidates: [sparseCand, completeCand],
    profile: { common: { usages: ['work'], spending_style: 'balanced' } },
    purchaseConditions: { hard: { budget_max_krw: 1200000, usages: ['work'], allowed_brands: ['samsung'] }, soft: {} },
    now: FIXED_NOW
  });

  const sparseEntry = res.ranked_candidates.find(e => e.candidate.variant_id === '402');
  assert.equal(sparseEntry._internal_metric_scores.portability, null);
  assert.equal(sparseEntry._internal_metric_scores.battery, null);
  assert.equal(sparseEntry._internal_metric_scores.display, null);
  assert.equal(sparseEntry._internal_metric_scores.memory_spec, null);
  assert.equal(sparseEntry.insufficient_info, true);
  assert.ok(sparseEntry.insufficient_info_notes.length >= 3);
  // Sparse candidate must not beat well-documented candidate via unconditional weight redistribution
  assert.equal(res.top_candidates[0].candidate.variant_id, '401');
});

test('5. Larger screen is NOT blindly better; unverified camera/chipset scores are never fabricated', () => {
  const compact = makeCandidate({ variant_id: '501', screen_inches: 6.1, weight_g: 162, price: { total_krw: 950000, budget_basis_krw: 950000 } });
  const huge = makeCandidate({ variant_id: '502', screen_inches: 6.9, weight_g: 230, price: { total_krw: 950000, budget_basis_krw: 950000 } });

  const res = ranker.rankSmartphoneCandidates({
    candidates: [huge, compact],
    profile: { common: { usages: ['camera'], spending_style: 'balanced', mobility: 'high' } },
    purchaseConditions: {
      hard: { budget_max_krw: 1200000, usages: ['camera'], allowed_brands: ['samsung'] },
      soft: { priorities: ['portability', 'camera', 'performance'] }
    },
    now: FIXED_NOW
  });

  assert.equal(res.top_candidates[0].candidate.variant_id, '501');
  const notes = res.top_candidates[0].insufficient_info_notes.join(' ');
  assert.ok(notes.includes('카메라'));
  assert.ok(notes.includes('칩셋'));
});

test('6. Danawa reference price works within 24h TTL with caution; expired or missing price is excluded', () => {
  const activeDanawa = makeCandidate({
    variant_id: '601',
    price: { price_source: 'danawa_reference', total_krw: 1177790, budget_basis_krw: 1177790, expires_at: VALID_EXPIRES_AT }
  });
  const expiredDanawa = makeCandidate({
    variant_id: '602',
    price: { price_source: 'danawa_reference', total_krw: 900000, budget_basis_krw: 900000, expires_at: EXPIRED_AT }
  });
  const missingPrice = makeCandidate({
    variant_id: '603',
    price: null
  });

  const res = ranker.rankSmartphoneCandidates({
    candidates: [expiredDanawa, missingPrice, activeDanawa],
    profile: { common: { usages: ['video'], spending_style: 'balanced' } },
    purchaseConditions: { hard: { budget_max_krw: 1500000, usages: ['video'], allowed_brands: ['samsung'] }, soft: {} },
    now: FIXED_NOW
  });

  assert.equal(res.top_candidates.length, 1);
  assert.equal(res.top_candidates[0].candidate.variant_id, '601');
  assert.ok(res.top_candidates[0].price_caution.includes('다나와'));

  // Without strict budget_max_krw, missing/expired price is NOT excluded from general suitability,
  // but receives budget_fit: null (never 0 or fabricated) and ranks below priced candidate.
  const noBudgetRes = ranker.rankSmartphoneCandidates({
    candidates: [expiredDanawa, missingPrice, activeDanawa],
    profile: { common: { usages: ['video'], spending_style: 'balanced' } },
    purchaseConditions: { hard: { budget_max_krw: null, usages: ['video'], allowed_brands: ['samsung'] }, soft: {} },
    now: FIXED_NOW
  });
  assert.equal(noBudgetRes.ranked_candidates.length, 3);
  assert.equal(noBudgetRes.top_candidates.length, 1);
  assert.equal(noBudgetRes.top_candidates[0].candidate.variant_id, '601');
  const missingEntry = noBudgetRes.ranked_candidates.find(e => e.candidate.variant_id === '603');
  assert.equal(missingEntry._internal_metric_scores.budget_fit, null);
  assert.equal(missingEntry.effective_price_krw, null);
  assert.ok(missingEntry.insufficient_info_notes.some(n => n.includes('가격 정보')));
});

test('7. Validator blocks Gemini from changing server-confirmed product IDs, rank order, prices, or specs', () => {
  const c1 = makeCandidate({ variant_id: '701', smartphone_id: '71', price: { total_krw: 900000, budget_basis_krw: 900000 } });
  const c2 = makeCandidate({ variant_id: '702', smartphone_id: '72', storage_gb: 512, price: { total_krw: 1100000, budget_basis_krw: 1100000 } });
  const aiContext = {
    profile_snapshot: { common: { usages: ['video'], spending_style: 'value' }, smartphone: {} },
    purchase_conditions: { hard: { budget_max_krw: 1500000, usages: ['video'], allowed_brands: ['samsung'] }, soft: {} },
    candidates_snapshot: [c1, c2],
    server_ranking: {
      policy_version: ranker.RANKING_POLICY_VERSION,
      items: [
        { variant_id: '701', smartphone_id: '71', rank: 1, insufficient_info_notes: [], price_caution: null },
        { variant_id: '702', smartphone_id: '72', rank: 2, insufficient_info_notes: [], price_caution: null }
      ]
    }
  };

  // Swapping rank 1 and rank 2 must fail validation
  const swapped = aiModule.mockRecommend({ aiContext }).output;
  [swapped.items[0], swapped.items[1]] = [swapped.items[1], swapped.items[0]];
  swapped.items[0].rank = 1;
  swapped.items[1].rank = 2;
  const swapCheck = validator.validateRecommendationOutput(swapped, aiContext);
  assert.equal(swapCheck.valid, false);
  assert.ok(swapCheck.errors.some(e => e.startsWith('SERVER_RANKING_MISMATCH')));

  // Altering price in evidence must fail validation
  const validOut = aiModule.mockRecommend({ aiContext }).output;
  validOut.items[0].evidence[0].total_krw = 1000;
  const priceCheck = validator.validateRecommendationOutput(validOut, aiContext);
  assert.equal(priceCheck.valid, false);
  assert.ok(priceCheck.errors.some(e => e.startsWith('PRICE_EVIDENCE_MISMATCH')));
});

test('8 & 9 & 11. Server fallback explanation works on Gemini failure/tampering AND internal scores/weights never leak in API response', async () => {
  const oldSearch = phonesRouter.searchCandidatesForUser;
  const oldDb = connection.getDatabase;
  const oldFetch = phonesRouter.fetchPricesByVariantIds;
  const oldPub = phonesRouter.publicationWhere;

  const baseNow = Date.now();
  const liveObservedAt = new Date(baseNow - 60 * 60 * 1000).toISOString();
  const liveExpiresAt = new Date(baseNow + 23 * 60 * 60 * 1000).toISOString();
  const cand1 = makeCandidate({
    variant_id: '90001390',
    smartphone_id: '101',
    model_name: 'Galaxy S24',
    price: {
      observation_id: '7001',
      price_source: 'verified_sale',
      price_label: null,
      eligible: true,
      is_reference_price: false,
      total_krw: 1177790,
      amount_krw: 1177790,
      shipping_krw: 0,
      budget_basis_krw: 1177790,
      seller_name: '쿠팡',
      observed_at: liveObservedAt,
      expires_at: liveExpiresAt
    }
  });
  const cand2 = makeCandidate({
    variant_id: '90001375',
    smartphone_id: '102',
    model_name: 'Galaxy Z Flip6',
    weight_g: 187,
    price: {
      observation_id: '7002',
      price_source: 'verified_sale',
      price_label: null,
      eligible: true,
      is_reference_price: false,
      total_krw: 1250000,
      amount_krw: 1250000,
      shipping_krw: 0,
      budget_basis_krw: 1250000,
      seller_name: '11번가',
      observed_at: liveObservedAt,
      expires_at: liveExpiresAt
    }
  });

  const performance = require('../services/smartphone-performance');
  const evidence = performance.normalizeMeasurement({
    smartphone_id: String(cand1.smartphone_id), variant_id: String(cand1.variant_id),
    metric: 'battery_runtime', unit: 'minutes', measured_value: 480,
    method_name: 'Synthetic runtime', method_version: '1', test_conditions: 'Fixed load',
    device_settings: 'Fixed brightness', source_name: 'Synthetic fixture',
    source_url: 'https://example.invalid/runtime', measured_on: '2025-01-01',
    checked_on: '2025-01-02', verification_status: 'verified'
  });
  const storedRows = [];
  connection.getDatabase = () => ({
    query: async () => [
      { ...cand1, phone_verified: 1, variant_verified: 1 },
      { ...cand2, phone_verified: 1, variant_verified: 1 }
    ],
    transaction: async fn => fn({ LOCK: { UPDATE: 1 } }),
    models: {
      [performance.TABLE]: { findAll: async () => [evidence] },
      users: { findByPk: async () => ({ id: '1' }) },
      profiles: { findByPk: async () => ({ version: 2 }) },
      recommendations: {
        create: async data => {
          const row = { ...data, id: String(storedRows.length + 1), created_at: new Date(), update: async patch => Object.assign(row, patch), toJSON: () => row };
          storedRows.push(row);
          return row;
        },
        findOne: async ({ where }) => storedRows.find(r => r.id === where.id) || null,
        findAll: async () => storedRows,
        destroy: async () => 1
      }
    }
  });
  phonesRouter.fetchPricesByVariantIds = async () => new Map([
    ['90001390', [{
      id: '7001',
      variant_id: '90001390',
      price_source: 'verified_sale',
      source_name: '쿠팡',
      source_url: 'https://example.invalid/7001',
      seller_name: '쿠팡',
      amount_krw: 1177790,
      shipping_krw: 0,
      total_krw: 1177790,
      is_new: true,
      is_unlocked: true,
      unconditional: true,
      conditions_text: '자급제 신품 기준',
      observed_at: liveObservedAt,
      expires_at: liveExpiresAt,
      in_stock: true
    }]],
    ['90001375', [{
      id: '7002',
      variant_id: '90001375',
      price_source: 'verified_sale',
      source_name: '11번가',
      source_url: 'https://example.invalid/7002',
      seller_name: '11번가',
      amount_krw: 1250000,
      shipping_krw: 0,
      total_krw: 1250000,
      is_new: true,
      is_unlocked: true,
      unconditional: true,
      conditions_text: '자급제 신품 기준',
      observed_at: liveObservedAt,
      expires_at: liveExpiresAt,
      in_stock: true
    }]]
  ]);
  phonesRouter.publicationWhere = async () => '1=1';
  phonesRouter.searchCandidatesForUser = async () => ({
    status: 'candidates_ready',
    as_of: FIXED_NOW.toISOString(),
    profile_version: 2,
    input: {
      expected_profile_version: 2,
      hard: { budget_max_krw: 1500000, usages: ['video'], allowed_brands: ['samsung'], required_os: null, min_storage_gb: null, max_weight_g: null, min_refresh_hz: null, require_5g: false, require_wireless_charging: false },
      soft: { preferred_brands: ['samsung'], priorities: ['portability'], preferred_os: null },
      replacement_device_id: null,
      purchase_reason: null,
      upgrade_context: null
    },
    candidate_count: 2,
    candidates: [cand1, cand2],
    questions: [],
    keep_current_evaluation: null,
    ai_context: {
      profile_snapshot: { version: 2, common: { usages: ['video'], spending_style: 'value' }, smartphone: {} },
      purchase_conditions: {
        hard: { budget_max_krw: 1500000, usages: ['video'], allowed_brands: ['samsung'] },
        soft: { preferred_brands: ['samsung'], priorities: ['portability'] }
      },
      replacement_device: null,
      keep_current_evaluation: null,
      candidates_snapshot: [cand1, cand2]
    }
  });

  try {
    // 8a. Gemini outage (AI_UNAVAILABLE) triggers server fallback explanation
    recRouter.setAiAdapter(aiModule.createAiAdapter({
      mockRecommendFn: async () => {
        throw Object.assign(new Error('AI_UNAVAILABLE'), { code: 'AI_UNAVAILABLE', status: 502 });
      }
    }));
    const resFallback = await invokeRouter(recRouter, 'post', '/recommendations', {
      session: { user_id: '1' },
      body: { expected_profile_version: 2, hard: { budget_max_krw: 1500000, usages: ['video'] } }
    });
    assert.equal(resFallback.status, 201);
    assert.equal(resFallback.body.data.status, 'recommend');
    assert.equal(resFallback.body.data.explanation_source, 'server_fallback');
    assert.equal(resFallback.body.data.ai_fallback_reason, 'AI_UNAVAILABLE');
    assert.equal(resFallback.body.data.ranking_policy_version, ranker.RANKING_POLICY_VERSION);
    assert.ok(resFallback.body.data.items[0].explanation.includes('Galaxy S24'));
    assert.equal(resFallback.body.data.items.find(item => item.variant_id === cand1.variant_id).performance_evidence.battery, true);
    assert.equal(resFallback.body.data.items.find(item => item.variant_id === cand2.variant_id).performance_evidence.battery, false);

    // 9. Verify NO internal scores or weights leak anywhere in serialized response
    const serialized = JSON.stringify(resFallback.body.data);
    assert.equal(serialized.includes('_internal_score'), false);
    assert.equal(serialized.includes('_internal_weights'), false);
    assert.equal(serialized.includes('metric_scores'), false);
    assert.equal(serialized.includes('"weights"'), false);

    // 8b. Gemini attempting to tamper with rank order fails 1 retry and triggers server fallback
    let attempts = 0;
    recRouter.setAiAdapter(aiModule.createAiAdapter({
      mockRecommendFn: async ({ aiContext }) => {
        attempts++;
        const out = aiModule.mockRecommend({ aiContext }).output;
        out.items[0].variant_id = '999999999'; // tampered ID
        return { output: out, model_name: 'tamper-ai', usage: { prompt_tokens: 1, output_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 } };
      }
    }));
    const resTamper = await invokeRouter(recRouter, 'post', '/recommendations', {
      session: { user_id: '1' },
      body: { expected_profile_version: 2, hard: { budget_max_krw: 1500000, usages: ['video'] } }
    });
    assert.equal(attempts, 2);
    assert.equal(resTamper.status, 201);
    assert.equal(resTamper.body.data.explanation_source, 'server_fallback');
    assert.equal(resTamper.body.data.ai_fallback_reason, 'AI_EVIDENCE_REJECTED');

    // 11. History retrieval compatibility
    const histDetail = await invokeRouter(recRouter, 'get', `/recommendations/${resFallback.body.data.id}`, {
      session: { user_id: '1' },
      params: { id: resFallback.body.data.id }
    });
    assert.equal(histDetail.status, 200);
    assert.equal(histDetail.body.data.historical_snapshot, true);
    assert.equal(histDetail.body.data.ranking_policy_version, ranker.RANKING_POLICY_VERSION);
    assert.equal(histDetail.body.data.explanation_source, 'server_fallback');
  } finally {
    recRouter.setAiAdapter(null);
    phonesRouter.searchCandidatesForUser = oldSearch;
    connection.getDatabase = oldDb;
    phonesRouter.fetchPricesByVariantIds = oldFetch;
    phonesRouter.publicationWhere = oldPub;
  }
});

test('10 & 12. Normal vs Upgrade branching preserved and recommended items keep exact catalog variant_id & price contract', () => {
  const c1 = makeCandidate({ variant_id: '90001390', smartphone_id: '101', storage_gb: 256, price: { total_krw: 1177790, budget_basis_krw: 1177790 } });
  const c2 = makeCandidate({ variant_id: '90000477', smartphone_id: '103', brand: 'apple', os: 'ios', model_name: 'iPhone 16 Pro', storage_gb: 128, price: { observation_id: '7003', total_krw: 2000000, budget_basis_krw: 2000000 } });

  // General recommendation (no owned device)
  const generalRank = ranker.rankSmartphoneCandidates({
    candidates: [c1, c2],
    profile: { common: { usages: ['video'], spending_style: 'balanced' } },
    purchaseConditions: { hard: { budget_max_krw: 2500000, usages: ['video'], allowed_brands: ['samsung', 'apple'] }, soft: {} },
    upgradeDecision: null,
    now: FIXED_NOW
  });
  assert.equal(generalRank.top_candidates.length, 2);

  // Upgrade recommendation filtered by eligible_variant_ids
  const upgradeRank = ranker.rankSmartphoneCandidates({
    candidates: [c1, c2],
    profile: { common: { usages: ['video'], spending_style: 'balanced' } },
    purchaseConditions: { hard: { budget_max_krw: 2500000, usages: ['video'], allowed_brands: ['samsung', 'apple'] }, soft: {} },
    upgradeDecision: { status: 'recommend', eligible_variant_ids: ['90001390'] },
    now: FIXED_NOW
  });
  assert.equal(upgradeRank.top_candidates.length, 1);
  assert.equal(upgradeRank.top_candidates[0].candidate.variant_id, '90001390');
  assert.equal(upgradeRank.top_candidates[0].candidate.smartphone_id, '101');
  assert.equal(upgradeRank.top_candidates[0].effective_price_krw, 1177790);
});

test('ranks all configurations before choosing at most one representative per model', () => {
  const variants = Array.from({ length: 45 }, (_, i) =>
    makeCandidate({ variant_id: String(91000 + i), color: 'color-' + i }));
  variants.push(
    makeCandidate({ variant_id: '92001', storage_gb: 512 }),
    makeCandidate({ variant_id: '92002', smartphone_id: '102', domestic_model_number: 'SM-S926N', storage_gb: 512 }),
    makeCandidate({ variant_id: '92003', smartphone_id: '103', domestic_model_number: 'SM-S928N', storage_gb: 512 })
  );
  const result = ranker.rankSmartphoneCandidates({
    candidates: variants,
    purchaseConditions: { hard: { budget_max_krw: 1177790, min_storage_gb: 512 }, soft: {} },
    now: FIXED_NOW
  });
  assert.deepEqual(new Set(result.top_candidates.map(row => row.candidate.variant_id)),
    new Set(['92001', '92002', '92003']));

  const includingColors = ranker.rankSmartphoneCandidates({
    candidates: variants, purchaseConditions: { hard: { budget_max_krw: 1177790 }, soft: {} }, now: FIXED_NOW
  });
  assert.equal(includingColors.ranked_candidates.length, 48);
  assert.equal(new Set(includingColors.top_candidates.map(row => row.candidate.smartphone_id)).size, 3);
});

test('compact preference rewards both smaller screen and lower weight without creating a hard limit', () => {
  const compact = makeCandidate({ variant_id: '93001', screen_inches: 6.2, weight_g: 162,
    storage_gb: 256, ram_gb: 8, battery_mah: 4000 });
  const large = makeCandidate({ variant_id: '93002', smartphone_id: '102', domestic_model_number: 'SM-S926N',
    screen_inches: 6.9, weight_g: 218, storage_gb: 1024, ram_gb: 16, battery_mah: 5000 });
  const result = ranker.rankSmartphoneCandidates({
    candidates: [large, compact], now: FIXED_NOW,
    purchaseConditions: { hard: { budget_unlimited: true, usages: ['video'] }, soft: { priorities: ['portability'] } }
  });
  assert.deepEqual(result.top_candidates.map(row => row.candidate.variant_id), ['93001', '93002']);
  assert(result.top_candidates[0]._internal_metric_scores.portability > result.top_candidates[1]._internal_metric_scores.portability);
});

test('capacity above the scoring target has diminishing returns, and the hard minimum still excludes smaller variants', () => {
  const hard = { budget_max_krw: 1200000, min_storage_gb: 256, usages: ['gaming'] };
  const conditions = { hard, soft: {} };
  const configurations = [128, 256, 512, 1024].map((storage_gb, i) =>
    makeCandidate({ variant_id: String(94001 + i), storage_gb, ram_gb: 4 + 4 * i }));
  const scores = configurations.map(c => ranker.evaluateCandidateMetrics(c, 1177790, {}, conditions).metric_scores);
  for (const key of ['storage', 'memory_spec']) {
    assert(scores[1][key] - scores[0][key] > scores[2][key] - scores[1][key]);
    assert(scores[2][key] - scores[1][key] > scores[3][key] - scores[2][key]);
  }
  const result = ranker.rankSmartphoneCandidates({ candidates: configurations, purchaseConditions: conditions, now: FIXED_NOW });
  assert.equal(result.ranked_candidates.length, 3);
  assert.equal(result.top_candidates.length, 1);
  assert.equal(result.top_candidates[0].candidate.storage_gb, 1024);
});

test('shared verified benchmarks can change gaming order; missing or incompatible evidence preserves the baseline', () => {
  const { normalizeMeasurement } = require('../services/smartphone-performance');
  const samsung = makeCandidate({ smartphone_id: '31', variant_id: '301', ram_gb: 8 });
  const apple = makeCandidate({ smartphone_id: '32', variant_id: '302', domestic_model_number: 'A3287',
    brand: 'apple', os: 'ios', ram_gb: 6 });
  const excluded = makeCandidate({ smartphone_id: '33', variant_id: '303', storage_gb: 128 });
  const input = {
    candidates: [samsung, apple, excluded], now: FIXED_NOW,
    purchaseConditions: { hard: { usages: ['gaming'], min_storage_gb: 256, budget_max_krw: 1500000 } }
  };
  const measurement = (product, measured_value, method_version = '1') => normalizeMeasurement({
    smartphone_id: product.smartphone_id, metric: 'gpu', unit: 'fps', measured_value,
    method_name: 'Synthetic GPU protocol', method_version, test_conditions: 'Fixed renderer workload',
    device_settings: 'Default power mode', source_name: 'Synthetic test lab',
    source_url: 'https://example.invalid/test-gpu', measured_on: '2025-01-01', checked_on: '2025-01-02',
    verification_status: 'verified'
  });
  const order = result => result.top_candidates.map(row => row.candidate.variant_id);
  const baseline = ranker.rankSmartphoneCandidates(input);
  assert.deepEqual(order(baseline), ['301', '302']);
  const first = measurement(samsung, 20);
  const second = measurement(apple, 60);
  assert.deepEqual(order(ranker.rankSmartphoneCandidates({ ...input, performanceMeasurements: [first, second] })), ['302', '301']);
  for (const rows of [[first], [first, measurement(apple, 60, '2')],
    [first, { ...second, verification_status: 'pending' }], [first, { ...second, variant_id: '999' }]]) {
    assert.deepEqual(ranker.rankSmartphoneCandidates({ ...input, performanceMeasurements: rows }), baseline);
  }
});

test('camera, runtime and game score channels change the order only with shared evidence', () => {
  const a = makeCandidate({ smartphone_id: '61', variant_id: '601' });
  const b = makeCandidate({ smartphone_id: '62', variant_id: '602', domestic_model_number: 'SYNTH-2' });
  for (const [metric, usage, priority, scoreKey] of [
    ['camera_photo', 'camera', 'camera', 'camera_quality'],
    ['camera_video', 'camera', 'camera', 'camera_quality'],
    ['battery_runtime', 'video', 'battery', 'battery'],
    ['sustained', 'gaming', 'performance', 'memory_spec'],
    ['cpu', 'gaming', 'performance', 'memory_spec'],
    ['gpu', 'gaming', 'performance', 'memory_spec']
  ]) {
    const input = { candidates: [a, b], now: FIXED_NOW,
      purchaseConditions: { hard: { usages: [usage], budget_max_krw: 1500000 }, soft: { priorities: [priority] } } };
    const measurements = [a, b].map((candidate, i) => ({
      smartphone_id: candidate.smartphone_id, metric, protocol_key: 'exact-fixture',
      verification_status: 'verified', measured_value: i ? 80 : 40
    }));
    const baseline = ranker.rankSmartphoneCandidates(input);
    assert.equal(baseline.top_candidates[0].candidate.variant_id, '601');
    assert.deepEqual(ranker.rankSmartphoneCandidates({ ...input, performanceMeasurements: measurements.slice(0, 1) }), baseline);
    const ranked = ranker.rankSmartphoneCandidates({ ...input, performanceMeasurements: measurements });
    assert.deepEqual(ranked.top_candidates.map(row => row.candidate.variant_id), ['602', '601']);
    assert(ranked.top_candidates[0]._internal_metric_scores[scoreKey] > ranked.top_candidates[1]._internal_metric_scores[scoreKey]);
    assert(ranked.top_candidates[0]._internal_metric_scores.budget_fit > ranked.top_candidates[1]._internal_metric_scores.budget_fit);
  }
});

test('partial evidence changes only comparable candidates and is bounded independently of SKU count', () => {
  const a = makeCandidate({ smartphone_id: '61', variant_id: '601' });
  const b = makeCandidate({ smartphone_id: '62', variant_id: '602', domestic_model_number: 'SYNTH-2' });
  const c = makeCandidate({ smartphone_id: '63', variant_id: '603', domestic_model_number: 'SYNTH-3' });
  const measurements = [a, b].map((product, i) => ({
    smartphone_id: product.smartphone_id, metric: 'battery_runtime', protocol_key: 'exact-fixture',
    verification_status: 'verified', measured_value: i ? 80 : 40
  }));
  const input = { now: FIXED_NOW,
    purchaseConditions: { hard: { budget_max_krw: 1500000 }, soft: { priorities: ['battery'] } } };
  const view = (candidates, performanceMeasurements) => new Map(ranker
    .rankSmartphoneCandidates({ ...input, candidates, performanceMeasurements }).ranked_candidates
    .map(row => [row.candidate.variant_id, row]));
  const baseline = view([a, b, c], []);
  const measured = view([a, b, c], measurements);
  assert.deepEqual(measured.get('603')._internal_metric_scores, baseline.get('603')._internal_metric_scores);
  assert.equal(measured.get('603')._internal_score, baseline.get('603')._internal_score);
  assert(measured.get('601')._internal_score < baseline.get('601')._internal_score);
  assert(measured.get('602')._internal_score > baseline.get('602')._internal_score);
  assert(measured.get('602')._internal_score - baseline.get('602')._internal_score <= 0.025000001);
  const withMoreColors = view([a, { ...a, variant_id: '604' }, b, c], measurements);
  assert.equal(withMoreColors.get('602')._internal_score, measured.get('602')._internal_score);
  assert.equal(withMoreColors.get('604')._internal_score, measured.get('601')._internal_score);
});

test('verified CPU/GPU evidence applies to work and value while unrelated sustained tests do not', () => {
  const { requestedMetrics } = require('../services/external-performance');
  const candidates = [makeCandidate({ smartphone_id: '61', variant_id: '601' }),
    makeCandidate({ smartphone_id: '62', variant_id: '602', domestic_model_number: 'SYNTH-2' })];
  const evidence = candidates.map((candidate, index) => ({
    smartphone_id: candidate.smartphone_id, metric: 'cpu', dimension: 'cpu_multi', protocol_key: 'compatible-cpu',
    evidence_kind: 'chipset_reference', verification_status: 'verified', measured_value: index ? 80 : 40
  }));
  for (const [usages, common] of [[['work'], {}], [['communication'], { spending_style: 'value' }]]) {
    const purchaseConditions = { hard: { usages, budget_max_krw: 1500000 } };
    const profile = { common };
    assert.deepEqual(requestedMetrics(purchaseConditions, profile), ['cpu_single', 'cpu_multi', 'gpu']);
    const input = { candidates, profile, purchaseConditions, now: FIXED_NOW };
    const baseline = ranker.rankSmartphoneCandidates(input);
    assert.deepEqual(ranker.rankSmartphoneCandidates({ ...input, performanceMeasurements: evidence.map(row =>
      ({ ...row, metric: 'sustained', dimension: 'gaming_fps' })) }), baseline);
    const ranked = ranker.rankSmartphoneCandidates({ ...input, performanceMeasurements: evidence });
    assert.equal(baseline.top_candidates[0].candidate.variant_id, '601');
    assert.equal(ranked.top_candidates[0].candidate.variant_id, '602');
  }
});
