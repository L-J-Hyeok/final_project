'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../services/smartphone-catalog');

test('T05: 3-year KST calendar release window and leap-day handling', () => {
  // Reference D = 2026-11-09 in KST -> [2023-11-09, 2026-11-09] inclusive
  const ref = new Date('2026-11-09T12:00:00+09:00');
  const win = catalog.releaseWindowKst(ref);
  assert.deepEqual(win, { minDate: '2023-11-09', maxDate: '2026-11-09' });

  assert.equal(catalog.isWithinReleaseWindow('2023-11-09', ref), true);
  assert.equal(catalog.isWithinReleaseWindow('2026-11-09', ref), true);
  assert.equal(catalog.isWithinReleaseWindow('2023-11-08', ref), false);
  assert.equal(catalog.isWithinReleaseWindow('2026-11-10', ref), false);
  assert.equal(catalog.isWithinReleaseWindow(null, ref), false);

  // Leap day D = 2028-02-29 -> target year 2025 is non-leap, minDate = 2025-02-28
  const leapWin = catalog.releaseWindowKst('2028-02-29');
  assert.deepEqual(leapWin, { minDate: '2025-02-28', maxDate: '2028-02-29' });
  assert.equal(catalog.isWithinReleaseWindow('2025-02-28', '2028-02-29'), true);
  assert.equal(catalog.isWithinReleaseWindow('2025-02-27', '2028-02-29'), false);
});

test('T06/T08/T15: price observation freshness (<24h), seller latest-first rule, and shipping-included total', () => {
  const now = new Date('2026-11-09T12:00:00.000Z');
  const baseObs = {
    id: '10',
    variant_id: '100',
    source_name: 'TestSource',
    source_url: 'https://example.invalid/price',
    seller_name: 'SellerA',
    amount_krw: 997000,
    shipping_krw: 3000,
    observed_at: '2026-11-08T12:00:01.000Z', // 23h 59m 59s ago
    expires_at: '2026-11-09T12:00:01.000Z',
    conditions_text: '무조건 자급제 신품',
    unconditional: true,
    in_stock: true,
    is_new: true,
    is_unlocked: true
  };

  // Just under 24h -> eligible, total = 1,000,000
  const justUnder = catalog.evaluateObservation(baseObs, now);
  assert.equal(justUnder.eligible, true);
  assert.equal(justUnder.is_expired, false);
  assert.equal(justUnder.total_krw, 1000000);

  // Exactly 24h (now == expires_at) -> expired & ineligible
  const exact24h = catalog.evaluateObservation({
    ...baseObs,
    observed_at: '2026-11-08T12:00:00.000Z',
    expires_at: '2026-11-09T12:00:00.000Z'
  }, now);
  assert.equal(exact24h.eligible, false);
  assert.equal(exact24h.is_expired, true);

  // Future observed_at -> ineligible
  const futureObs = catalog.evaluateObservation({
    ...baseObs,
    observed_at: '2026-11-09T12:00:01.000Z',
    expires_at: '2026-11-10T12:00:01.000Z'
  }, now);
  assert.equal(futureObs.eligible, false);

  // Unknown shipping (null) -> ineligible
  const unknownShipping = catalog.evaluateObservation({ ...baseObs, shipping_krw: null }, now);
  assert.equal(unknownShipping.eligible, false);
  assert.equal(unknownShipping.total_krw, null);

  // Conditional discount / out of stock / used / carrier locked -> ineligible
  for (const flag of ['unconditional', 'in_stock', 'is_new', 'is_unlocked']) {
    const res = catalog.evaluateObservation({ ...baseObs, [flag]: false }, now);
    assert.equal(res.eligible, false, `Expected ${flag}=false to be ineligible`);
  }

  // Seller latest-first rule: SellerA had cheap price earlier (900,000), but latest observation from SellerA is out of stock.
  // SellerB has valid price (950,000). Must NOT fall back to SellerA's older cheap price; must pick SellerB.
  const observations = [
    {
      ...baseObs,
      id: '1',
      seller_name: 'SellerA',
      amount_krw: 900000,
      shipping_krw: 0,
      observed_at: '2026-11-09T08:00:00.000Z',
      expires_at: '2026-11-10T08:00:00.000Z',
      in_stock: true
    },
    {
      ...baseObs,
      id: '2',
      seller_name: 'SellerA',
      amount_krw: 900000,
      shipping_krw: 0,
      observed_at: '2026-11-09T10:00:00.000Z',
      expires_at: '2026-11-10T10:00:00.000Z',
      in_stock: false
    },
    {
      ...baseObs,
      id: '3',
      seller_name: 'SellerB',
      amount_krw: 947500,
      shipping_krw: 2500,
      observed_at: '2026-11-09T09:00:00.000Z',
      expires_at: '2026-11-10T09:00:00.000Z',
      in_stock: true
    }
  ];

  const best = catalog.selectBestPrice(observations, now);
  assert.ok(best.selected);
  assert.equal(best.selected.seller_name, 'SellerB');
  assert.equal(best.selected.total_krw, 950000);
  assert.equal(best.latest_by_seller.length, 2);
});

test('T07/T09/T14: hard vs soft condition validation, null spec rejection, and clarify questions', () => {
  // Missing budget or usages returns clarify questions, not 422
  const missingBudget = catalog.validateCandidateInput({
    expected_profile_version: 2,
    hard: { usages: ['video'] }
  });
  assert.equal(missingBudget.clarify_questions.length, 1);

  // Contradictory brand + OS returns clarify question
  const contradiction = catalog.validateCandidateInput({
    expected_profile_version: 2,
    hard: { budget_max_krw: 1000000, usages: ['video'], allowed_brands: ['samsung'], required_os: 'ios' }
  });
  assert.ok(contradiction.clarify_questions.length > 0);

  // Invalid type (string budget, invalid enum, unknown key) throws 422 INVALID_INPUT
  for (const invalid of [
    { expected_profile_version: 2, hard: { budget_max_krw: '1000000', usages: ['video'] } },
    { expected_profile_version: 2, hard: { budget_max_krw: 0, usages: ['video'] } },
    { expected_profile_version: 2, hard: { budget_max_krw: 1000000, usages: ['invalid_usage'] } },
    { expected_profile_version: 2, hard: { budget_max_krw: 1000000, usages: ['video'] }, unknown_field: true }
  ]) {
    assert.throws(() => catalog.validateCandidateInput(invalid), { code: 'INVALID_INPUT' });
  }

  // Hard condition matching: null spec fails when hard requirement is set, soft condition never filters out candidate
  const now = new Date('2026-11-09T12:00:00.000Z');
  const parsed = catalog.validateCandidateInput({
    expected_profile_version: 2,
    hard: {
      budget_max_krw: 1000000,
      usages: ['coding'],
      min_storage_gb: 256,
      max_weight_g: 200,
      min_refresh_hz: 120,
      require_5g: true,
      require_wireless_charging: true
    },
    soft: { preferred_brands: ['samsung'], preferred_os: 'android' }
  });

  const baseCandidate = {
    brand: 'apple', // Does not match soft preferred_brands=['samsung'], but MUST still pass hard filter
    phone_verified: true,
    variant_verified: true,
    domestic_model_number: 'A3102-KR',
    released_on_kr: '2025-09-20',
    os: 'ios',
    storage_gb: 256,
    weight_g: 187,
    refresh_hz: 120,
    supports_5g: true,
    wireless_charging: true,
    price: { eligible: true, total_krw: 1000000 }
  };

  assert.equal(catalog.matchesHardConditions(baseCandidate, parsed.hard, now), true);
  // 1 KRW over budget -> rejected
  assert.equal(catalog.matchesHardConditions({ ...baseCandidate, price: { eligible: true, total_krw: 1000001 } }, parsed.hard, now), false);
  // NULL weight when max_weight_g is required -> rejected
  assert.equal(catalog.matchesHardConditions({ ...baseCandidate, weight_g: null }, parsed.hard, now), false);
  // NULL wireless_charging when require_wireless_charging=true -> rejected
  assert.equal(catalog.matchesHardConditions({ ...baseCandidate, wireless_charging: null }, parsed.hard, now), false);
});

test('T10/T11/T12: eligible_reasons only include verified catalog comparisons and factual specs', () => {
  const candidate = {
    brand: 'samsung',
    os: 'android',
    storage_gb: 256,
    weight_g: 168,
    refresh_hz: 120,
    price: { eligible: true, total_krw: 890000 }
  };
  const hard = { budget_max_krw: 1000000, min_storage_gb: 256 };
  const soft = { preferred_brands: ['samsung'], preferred_os: 'android' };

  // Manual replacement device must NOT produce lighter_than_owned or higher_refresh_than_owned
  const manualOwned = {
    source: 'manual',
    product: null
  };
  const reasonsWithManual = catalog.buildEligibleReasons(candidate, hard, soft, manualOwned);
  assert.deepEqual(reasonsWithManual.map(r => r.code), [
    'storage_meets_requirement',
    'budget_headroom',
    'preferred_brand_match',
    'preferred_os_match'
  ]);

  // Verified catalog replacement device with heavier weight (200g) and lower refresh rate (60Hz)
  const catalogOwned = {
    source: 'catalog',
    product: { verified: true, weight_g: 200, refresh_hz: 60 }
  };
  const reasonsWithCatalog = catalog.buildEligibleReasons(candidate, hard, soft, catalogOwned);
  assert.deepEqual(reasonsWithCatalog.map(r => r.code), [
    'storage_meets_requirement',
    'budget_headroom',
    'preferred_brand_match',
    'preferred_os_match',
    'lighter_than_owned',
    'higher_refresh_than_owned'
  ]);
});
