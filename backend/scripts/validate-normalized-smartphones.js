'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const catalog = require('../services/smartphone-catalog');
const upgrade = require('../services/upgrade-advisor');

const DEFAULT_JSON_PATH = path.resolve(__dirname, '../data/normalized-smartphones.json');

function isIsoDateOnly(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isIsoDateTime(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function validateNormalizedDataset(dataset) {
  const errors = [];
  const check = (condition, message) => {
    if (!condition) errors.push(message);
  };

  check(dataset && typeof dataset === 'object', 'Dataset root must be an object');
  check(Array.isArray(dataset.smartphones), 'smartphones must be an array');
  check(Array.isArray(dataset.smartphone_variants), 'smartphone_variants must be an array');
  check(Array.isArray(dataset.price_observations), 'price_observations must be an array');

  const referenceNow = new Date('2026-11-10T12:00:00.000Z');
  const modelKeySet = new Set();
  const uniqueModelConstraintSet = new Set();
  const uniqueVariantConstraintSet = new Set();
  const variantsByModelKey = new Map();

  for (const [idx, s] of (dataset.smartphones || []).entries()) {
    const label = `smartphones[${idx}] (${s.smartphone_key || s.model_name || 'unknown'})`;

    check(typeof s.smartphone_key === 'string' && s.smartphone_key.length > 0, `${label}: missing smartphone_key`);
    check(!modelKeySet.has(s.smartphone_key), `${label}: duplicate smartphone_key ${s.smartphone_key}`);
    modelKeySet.add(s.smartphone_key);
    variantsByModelKey.set(s.smartphone_key, []);

    check(['samsung', 'apple'].includes(s.brand), `${label}: invalid brand (expected lowercase 'samsung' or 'apple', got ${s.brand})`);
    check(typeof s.model_name === 'string' && s.model_name.length > 0 && s.model_name.length <= 120, `${label}: invalid model_name`);
    check(
      s.domestic_model_number === null || (typeof s.domestic_model_number === 'string' && s.domestic_model_number.length > 0 && s.domestic_model_number.length <= 80),
      `${label}: invalid domestic_model_number`
    );
    check(s.released_on_kr === null || isIsoDateOnly(s.released_on_kr), `${label}: invalid released_on_kr ${s.released_on_kr}`);

    // ck_smartphones_os
    check(['android', 'ios', 'other'].includes(s.os), `${label}: ck_smartphones_os failed (${s.os})`);

    // ck_smartphones_positive
    check(s.screen_inches === null || (typeof s.screen_inches === 'number' && s.screen_inches > 0), `${label}: ck_smartphones_positive screen_inches failed`);
    check(s.refresh_hz === null || (Number.isInteger(s.refresh_hz) && s.refresh_hz > 0), `${label}: ck_smartphones_positive refresh_hz failed`);
    check(s.battery_mah === null || (Number.isInteger(s.battery_mah) && s.battery_mah > 0), `${label}: ck_smartphones_positive battery_mah failed`);
    check(s.weight_g === null || (Number.isInteger(s.weight_g) && s.weight_g > 0), `${label}: ck_smartphones_positive weight_g failed`);

    // ck_smartphones_flags
    check(s.supports_5g === null || typeof s.supports_5g === 'boolean', `${label}: ck_smartphones_flags supports_5g failed`);
    check(s.wireless_charging === null || typeof s.wireless_charging === 'boolean', `${label}: ck_smartphones_flags wireless_charging failed`);
    check(typeof s.verified === 'boolean', `${label}: ck_smartphones_flags verified failed`);
    check(typeof s.is_test === 'boolean', `${label}: ck_smartphones_flags is_test failed`);

    // ck_smartphones_verified
    if (s.verified) {
      check(
        typeof s.source_name === 'string' && s.source_name.length > 0 &&
        typeof s.source_url === 'string' && s.source_url.startsWith('https://') &&
        isIsoDateTime(s.verified_at) &&
        typeof s.domestic_model_number === 'string' && s.domestic_model_number.length > 0 &&
        isIsoDateOnly(s.released_on_kr) &&
        ['android', 'ios', 'other'].includes(s.os),
        `${label}: ck_smartphones_verified failed`
      );
    }

    // uq_smartphones_model: UNIQUE(brand, domestic_model_number)
    const uqKey = `${s.brand}||${s.domestic_model_number || ''}`;
    check(!uniqueModelConstraintSet.has(uqKey), `${label}: uq_smartphones_model duplicate (${uqKey})`);
    uniqueModelConstraintSet.add(uqKey);

    // Policy: verified_ready models must have official manufacturer-verified wireless_charging boolean;
    // hold_needs_review models remain null until verification; Apple battery_mah remains null (not disclosed on official spec sheet)
    if (s.verified) {
      check(typeof s.wireless_charging === 'boolean', `${label}: verified_ready model must have boolean wireless_charging`);
      const expectedWireless = s.domestic_model_number === 'SM-A356N' ? false : true;
      check(s.wireless_charging === expectedWireless, `${label}: expected wireless_charging=${expectedWireless} for ${s.domestic_model_number}`);
    } else {
      check(s.wireless_charging === null, `${label}: hold_needs_review wireless_charging must remain null`);
    }
    if (['A3090', 'A3094', 'A3102', 'A3106'].includes(s.domestic_model_number)) {
      check(s.released_on_kr === '2023-10-13', `${label}: iPhone 15 series released_on_kr must be KR official launch date 2023-10-13`);
    }
    if (s.brand === 'apple') {
      check(s.battery_mah === null, `${label}: Apple battery_mah must remain null (not disclosed on official spec sheet)`);
    }

    // Service pure function consistency: smartphone-catalog.isWithinReleaseWindow & upgrade-advisor.evaluateReleaseElapsed
    const within3YByService = catalog.isWithinReleaseWindow(s.released_on_kr, referenceNow);
    const releaseEval = upgrade.evaluateReleaseElapsed(s.released_on_kr, referenceNow, 3);
    check(
      within3YByService === s.audit_metadata?.within_3_years_as_of_2026_11_10,
      `${label}: service isWithinReleaseWindow mismatch (${within3YByService})`
    );
    check(
      releaseEval.elapsed_threshold_years === s.audit_metadata?.upgrade_offer_eligible_as_of_2026_11_10,
      `${label}: service evaluateReleaseElapsed mismatch (${releaseEval.elapsed_threshold_years})`
    );
  }

  for (const [idx, v] of (dataset.smartphone_variants || []).entries()) {
    const label = `smartphone_variants[${idx}] (${v.smartphone_key} ${v.storage_gb}GB)`;

    check(modelKeySet.has(v.smartphone_key), `${label}: fk_variants_smartphone failed (unknown smartphone_key ${v.smartphone_key})`);
    if (variantsByModelKey.has(v.smartphone_key)) {
      variantsByModelKey.get(v.smartphone_key).push(v);
    }

    // ck_variants_capacity
    check(Number.isInteger(v.storage_gb) && v.storage_gb > 0, `${label}: ck_variants_capacity storage_gb failed (${v.storage_gb})`);
    check(v.ram_gb === null || (Number.isInteger(v.ram_gb) && v.ram_gb > 0), `${label}: ck_variants_capacity ram_gb failed (${v.ram_gb})`);

    // ck_variants_verified
    check(typeof v.verified === 'boolean', `${label}: ck_variants_verified boolean failed`);
    if (v.verified) {
      check(
        typeof v.source_name === 'string' && v.source_name.length > 0 &&
        typeof v.source_url === 'string' && v.source_url.startsWith('https://') &&
        isIsoDateTime(v.verified_at),
        `${label}: ck_variants_verified metadata failed`
      );
    }

    // uq_variants_option: UNIQUE(smartphone_id, storage_gb, color)
    const uqVarKey = `${v.smartphone_key}||${v.storage_gb}||${v.color ?? 'unspecified'}`;
    check(!uniqueVariantConstraintSet.has(uqVarKey), `${label}: uq_variants_option duplicate (${uqVarKey})`);
    uniqueVariantConstraintSet.add(uqVarKey);

    // Policy: current_lowest_price_krw is null in source, so launch price must only be kept in audit_metadata
    check(
      v.audit_metadata?.current_lowest_price_krw === null,
      `${label}: unexpected current_lowest_price_krw`
    );
  }

  // Verify spec comparison between an upgrade-eligible 2023 model (Galaxy S23 Ultra) and a 2024 verified candidate (Galaxy S24 Ultra)
  const s23Ultra = dataset.smartphones.find((m) => m.domestic_model_number === 'SM-S918N');
  const s24Ultra = dataset.smartphones.find((m) => m.domestic_model_number === 'SM-S928N');
  const ip15Pro = dataset.smartphones.find((m) => m.domestic_model_number === 'A3102');
  const ip16Pro = dataset.smartphones.find((m) => m.domestic_model_number === 'A3293');

  const samsungComparison = upgrade.buildDeviceCandidateComparison(
    { ...s23Ultra, storage_gb: 256, ram_gb: 12 },
    { ...s24Ultra, storage_gb: 256, ram_gb: 12, price: null }
  );
  const appleComparison = upgrade.buildDeviceCandidateComparison(
    { ...ip15Pro, storage_gb: 128, ram_gb: null },
    { ...ip16Pro, storage_gb: 128, ram_gb: null, price: null }
  );

  check(samsungComparison.comparable === true, 'Samsung S23 Ultra -> S24 Ultra comparison must be comparable');
  check(appleComparison.comparable === true, 'Apple iPhone 15 Pro -> iPhone 16 Pro comparison must be comparable even with null RAM/battery');
  check(appleComparison.fields.ram_gb?.status === 'insufficient_data', 'Apple null RAM must produce insufficient_data status');
  check(appleComparison.fields.battery_mah?.status === 'insufficient_data', 'Apple null battery must produce insufficient_data status');
  check(appleComparison.fields.wireless_charging?.status === 'verified_comparison', 'Verified boolean wireless_charging must produce verified_comparison status');

  // Verify candidate hard-condition matching without price_observations returns false (confirming price_observations requirement)
  const hardFilter = catalog.validateCandidateInput({
    expected_profile_version: 1,
    hard: { budget_max_krw: 2500000, usages: ['camera'] }
  }).hard;
  const s24UltraCandidateWithoutPrice = {
    ...s24Ultra,
    storage_gb: 256,
    ram_gb: 12,
    variant_verified: true,
    price: catalog.selectBestPrice([], referenceNow)
  };
  check(
    catalog.matchesHardConditions(s24UltraCandidateWithoutPrice, hardFilter, referenceNow) === false,
    'Without 24h price_observations, matchesHardConditions must reject candidate as designed'
  );

  // Price policy check: no fake 24-hour price observations from launchPriceKrw
  check(
    dataset.price_observations.length === 0,
    'price_observations must be empty because source data has no current retail prices (only launch MSRP)'
  );

  // Release window & verification tier checks as of 2026-11-10
  const within3Years = dataset.smartphones.filter((s) => s.audit_metadata?.within_3_years_as_of_2026_11_10);
  const upgradeEligible = dataset.smartphones.filter((s) => s.audit_metadata?.upgrade_offer_eligible_as_of_2026_11_10);
  const verifiedModels = dataset.smartphones.filter((s) => s.verified);
  const holdModels = dataset.smartphones.filter((s) => !s.verified);

  check(dataset.smartphones.length === 26, `Expected 26 smartphone models, got ${dataset.smartphones.length}`);
  check(within3Years.length === 21, `Expected 21 models within 3 years, got ${within3Years.length}`);
  check(upgradeEligible.length === 5, `Expected 5 upgrade-eligible models (3+ years elapsed), got ${upgradeEligible.length}`);
  check(verifiedModels.length === 16, `Expected 16 verified_ready models, got ${verifiedModels.length}`);
  check(holdModels.length === 10, `Expected 10 hold_needs_review models, got ${holdModels.length}`);

  return {
    passed: errors.length === 0,
    errors,
    stats: {
      models: dataset.smartphones.length,
      variants: dataset.smartphone_variants.length,
      priceObservations: dataset.price_observations.length,
      verifiedModels: verifiedModels.length,
      verifiedVariants: dataset.smartphone_variants.filter((v) => v.verified).length,
      holdModels: holdModels.length,
      holdVariants: dataset.smartphone_variants.filter((v) => !v.verified).length,
      within3YearsCandidates: within3Years.length,
      within3YearsVerified: within3Years.filter((s) => s.verified).length,
      upgradeOfferTargets: upgradeEligible.length
    }
  };
}

if (require.main === module) {
  const targetPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_JSON_PATH;
  const dataset = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  const result = validateNormalizedDataset(dataset);

  if (!result.passed) {
    console.error('[FAIL] Offline smartphone dataset validation failed:');
    for (const err of result.errors) {
      console.error(' -', err);
    }
    process.exit(1);
  }

  assert.equal(result.passed, true);
  console.log('[PASS] Offline smartphone dataset validation succeeded (0 DB/network calls).');
  console.log(JSON.stringify(result.stats, null, 2));
}

module.exports = {
  validateNormalizedDataset
};
