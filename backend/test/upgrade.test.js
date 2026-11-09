'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const upgradeAdvisor = require('../services/upgrade-advisor');

test('Exact 3-year release anniversary boundary in Asia/Seoul, leap-day policy, and re-evaluation over time', () => {
  // 1. Standard release date: 2023-11-10
  // - 1 day before 3rd anniversary (2026-11-09): NOT elapsed
  const oneDayBefore = upgradeAdvisor.evaluateReleaseElapsed('2023-11-10', '2026-11-09', 3);
  assert.equal(oneDayBefore.elapsed_threshold_years, false);
  assert.equal(oneDayBefore.anniversary_date_kr, '2026-11-10');
  assert.equal(oneDayBefore.needs_verification, false);

  // - Exact 3rd anniversary (2026-11-10): ELAPSED (eligible)
  const exact3Years = upgradeAdvisor.evaluateReleaseElapsed('2023-11-10', '2026-11-10', 3);
  assert.equal(exact3Years.elapsed_threshold_years, true);
  assert.equal(exact3Years.status, 'elapsed');

  // - Under 3 years (e.g. 2025-02-01 evaluated on 2026-11-10 -> not eligible, re-evaluated on 2028-02-01 -> eligible)
  const in2026 = upgradeAdvisor.evaluateReleaseElapsed('2025-02-01', '2026-11-10', 3);
  assert.equal(in2026.elapsed_threshold_years, false);
  const in2028 = upgradeAdvisor.evaluateReleaseElapsed('2025-02-01', '2028-02-01', 3);
  assert.equal(in2028.elapsed_threshold_years, true);

  // 2. Leap day release (2024-02-29): 3rd anniversary in 2027 (non-leap year) is 2027-02-28
  const leapBefore = upgradeAdvisor.evaluateReleaseElapsed('2024-02-29', '2027-02-27', 3);
  assert.equal(leapBefore.anniversary_date_kr, '2027-02-28');
  assert.equal(leapBefore.elapsed_threshold_years, false);

  const leapExact = upgradeAdvisor.evaluateReleaseElapsed('2024-02-29', '2027-02-28', 3);
  assert.equal(leapExact.elapsed_threshold_years, true);

  // 3. Missing, invalid, or future release date -> needs_verification=true, elapsed=false
  const missing = upgradeAdvisor.evaluateReleaseElapsed(null, '2026-11-10', 3);
  assert.equal(missing.needs_verification, true);
  assert.equal(missing.elapsed_threshold_years, false);

  const invalid = upgradeAdvisor.evaluateReleaseElapsed('2023-02-30', '2026-11-10', 3);
  assert.equal(invalid.needs_verification, true);
  assert.equal(invalid.elapsed_threshold_years, false);

  const future = upgradeAdvisor.evaluateReleaseElapsed('2027-01-01', '2026-11-10', 3);
  assert.equal(future.status, 'future_release_date');
  assert.equal(future.needs_verification, true);
  assert.equal(future.elapsed_threshold_years, false);
});

test('Manual smartphone identification: exact model number, single model name, ambiguous variants, and unidentified models', () => {
  const catalogPhones = [
    {
      smartphone_id: '1',
      brand: 'samsung',
      model_name: 'Galaxy S21',
      domestic_model_number: 'SM-G991N',
      released_on_kr: '2021-01-29',
      verified: true
    },
    {
      smartphone_id: '2',
      brand: 'samsung',
      model_name: 'Galaxy S22',
      domestic_model_number: 'SM-S901N',
      released_on_kr: '2022-02-25',
      verified: true
    },
    {
      smartphone_id: '3',
      brand: 'samsung',
      model_name: 'Galaxy S22', // Same model_name, different regional/carrier model number
      domestic_model_number: 'SM-S901U',
      released_on_kr: '2022-02-25',
      verified: true
    },
    {
      smartphone_id: '4',
      brand: 'apple',
      model_name: 'iPhone Unverified',
      domestic_model_number: 'A9999',
      released_on_kr: null,
      verified: false
    }
  ];

  // 1. Single verified model by brand + model_name
  const s21 = upgradeAdvisor.matchManualSmartphoneToCatalog(
    { manual_brand: 'Samsung', manual_model_name: 'Galaxy S21', manual_model_number: null },
    catalogPhones
  );
  assert.equal(s21.identification_status, 'identified_by_model_name');
  assert.equal(s21.needs_verification, false);
  assert.equal(s21.matched_phone.domestic_model_number, 'SM-G991N');

  // 2. Ambiguous model name (Galaxy S22 has 2 variants in catalog) without model_number -> ambiguous_model_variant
  const s22Ambiguous = upgradeAdvisor.matchManualSmartphoneToCatalog(
    { manual_brand: 'Samsung', manual_model_name: 'Galaxy S22', manual_model_number: null },
    catalogPhones
  );
  assert.equal(s22Ambiguous.identification_status, 'ambiguous_model_variant');
  assert.equal(s22Ambiguous.needs_verification, true);
  assert.equal(s22Ambiguous.matched_phone, null);

  // 3. Disambiguated by exact domestic_model_number -> identified_by_model_number
  const s22Exact = upgradeAdvisor.matchManualSmartphoneToCatalog(
    { manual_brand: 'Samsung', manual_model_name: 'Galaxy S22', manual_model_number: 'SM-S901N' },
    catalogPhones
  );
  assert.equal(s22Exact.identification_status, 'identified_by_model_number');
  assert.equal(s22Exact.needs_verification, false);
  assert.equal(s22Exact.matched_phone.smartphone_id, '2');

  // 4. Unidentified model -> unidentified_model, needs_verification=true
  const unknown = upgradeAdvisor.matchManualSmartphoneToCatalog(
    { manual_brand: 'LG', manual_model_name: 'Velvet', manual_model_number: null },
    catalogPhones
  );
  assert.equal(unknown.identification_status, 'unidentified_model');
  assert.equal(unknown.needs_verification, true);

  // 5. Unverified catalog model -> unverified_catalog_model, needs_verification=true
  const unverified = upgradeAdvisor.matchManualSmartphoneToCatalog(
    { manual_brand: 'Apple', manual_model_name: 'iPhone Unverified', manual_model_number: 'A9999' },
    catalogPhones
  );
  assert.equal(unverified.identification_status, 'unverified_catalog_model');
  assert.equal(unverified.needs_verification, true);
});

test('Notification visibility: initial popup, 30-day snooze suppression, re-display after 30 days, and permanent dismissal', () => {
  const now = new Date('2026-11-10T00:00:00.000Z');

  // 1. Eligible with no prior suppression -> show_popup=true
  const initial = upgradeAdvisor.evaluateNotificationVisibility(true, null, now);
  assert.equal(initial.notification_state, 'show_popup');
  assert.equal(initial.should_show_popup, true);

  // 2. Snoozed for 30 days (until 2026-12-10T00:00:00.000Z)
  const snoozeState = {
    snoozed_until: '2026-12-10T00:00:00.000Z',
    dismissed_permanently: false
  };
  // At 29 days later -> still suppressed
  const day29 = upgradeAdvisor.evaluateNotificationVisibility(true, snoozeState, new Date('2026-12-09T23:59:59.000Z'));
  assert.equal(day29.notification_state, 'snoozed');
  assert.equal(day29.should_show_popup, false);

  // At 30 days later -> snooze expired, popup shown again!
  const day30 = upgradeAdvisor.evaluateNotificationVisibility(true, snoozeState, new Date('2026-12-10T00:00:00.000Z'));
  assert.equal(day30.notification_state, 'show_popup');
  assert.equal(day30.should_show_popup, true);
  assert.equal(day30.is_snooze_expired, true);

  // 3. Permanently dismissed -> never show popup for this device
  const permState = {
    snoozed_until: null,
    dismissed_permanently: true
  };
  const perm = upgradeAdvisor.evaluateNotificationVisibility(true, permState, new Date('2027-05-01T00:00:00.000Z'));
  assert.equal(perm.notification_state, 'dismissed_permanently');
  assert.equal(perm.should_show_popup, false);
});

test('Comparison & keep-current-device evaluation: verified specs only, battery/chipset cautions, and keep option', () => {
  const ownedProduct = {
    model_name: 'Galaxy S23',
    verified: true,
    screen_inches: 6.1,
    weight_g: 168,
    battery_mah: 3900,
    storage_gb: 256,
    ram_gb: 8,
    refresh_hz: 120,
    supports_5g: true,
    wireless_charging: true,
    chipset: 'Snapdragon 8 Gen 2'
  };

  const candidate = {
    model_name: 'Galaxy S25',
    screen_inches: 6.2,
    weight_g: 162,
    battery_mah: 4000,
    storage_gb: 256,
    ram_gb: null, // Missing RAM in candidate -> must be treated as insufficient_data
    refresh_hz: 120,
    supports_5g: true,
    wireless_charging: true,
    chipset: 'Snapdragon 8 Elite',
    price: { total_krw: 1150000 }
  };

  const comp = upgradeAdvisor.buildDeviceCandidateComparison(ownedProduct, candidate);
  assert.equal(comp.comparable, true);
  assert.equal(comp.fields.weight_g.status, 'verified_comparison');
  assert.equal(comp.fields.weight_g.diff, -6);
  assert.equal(comp.fields.ram_gb.status, 'insufficient_data');
  assert.ok(comp.insufficient_data_fields.includes('ram_gb'));
  assert.ok(comp.insufficient_data_fields.includes('chipset_benchmark'));
  assert.ok(comp.cautions.some(c => c.includes('배터리 표기 용량(mAh) 증가가 실제 화면 켜짐 시간')));

  // Keep current device evaluation when user is satisfied and current phone meets all hard requirements
  const keepEval = upgradeAdvisor.evaluateKeepCurrentDeviceOption({
    ownedDevice: { source: 'catalog', product: ownedProduct },
    upgradeContext: {
      satisfied_aspects: ['performance', 'portability'],
      pain_points: [],
      replacement_intent: 'low_or_keep_if_okay'
    },
    hard: {
      budget_max_krw: 1200000,
      usages: ['video', 'communication'],
      min_storage_gb: 256,
      max_weight_g: 180,
      min_refresh_hz: 120,
      require_5g: true,
      require_wireless_charging: true
    },
    candidates: [candidate]
  });
  assert.equal(keepEval.recommend_keep, true);
  assert.equal(keepEval.meets_current_hard_specs, true);
  assert.ok(keepEval.reasons.length >= 2);
});
