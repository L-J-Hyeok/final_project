'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const discovery = require('../services/smartphone-candidate-discovery');
const cli = require('../scripts/discover-smartphone-candidates');

const { CLASSIFICATIONS } = discovery;

function makeFullOfficialRecord(overrides = {}) {
  return {
    brand: 'samsung',
    model_name: 'Galaxy Test Ultra',
    domestic_model_number: 'SM-S999N',
    released_on_kr: '2025-05-01',
    release_date_source_type: 'manufacturer_kr',
    os: 'android',
    chipset: 'Snapdragon Test',
    screen_inches: 6.8,
    refresh_hz: 120,
    battery_mah: 5000,
    weight_g: 215,
    supports_5g: true,
    wireless_charging: true,
    official_spec_verified: true,
    source_name: '삼성전자 대한민국 공식 홈페이지',
    source_url: 'https://www.samsung.com/sec/smartphones/galaxy-test/',
    official_product_url: 'https://www.samsung.com/sec/smartphones/galaxy-test/',
    source_kind: 'manufacturer_kr',
    options: [
      {
        storage_gb: 512,
        ram_gb: 16,
        color: '블랙 쉐도우',
        launch_price_krw: 1990000,
        official_option_verified: true,
        sku_example: 'SM-S999NZKAKOO',
        source_url: 'https://www.samsung.com/sec/smartphones/galaxy-test/',
      },
    ],
    ...overrides,
  };
}

test('computeReleaseWindow computes exact 3-year KST calendar window', () => {
  const window = discovery.computeReleaseWindow('2026-11-12');
  assert.equal(window.referenceDateKst, '2026-11-12');
  assert.equal(window.minDate, '2023-11-12');
  assert.equal(window.maxDate, '2026-11-12');
});

test('normalizeDomesticModelNumber always returns string or null (handles SM-A5560 and A3102)', () => {
  assert.equal(discovery.normalizeDomesticModelNumber('SM-A5560', 'samsung'), 'SM-A5560');
  assert.equal(discovery.normalizeDomesticModelNumber('sm-f958nzkakoo', 'samsung'), 'SM-F958N');
  assert.equal(discovery.normalizeDomesticModelNumber('A3102', 'apple'), 'A3102');
  assert.equal(discovery.normalizeDomesticModelNumber('', 'samsung'), null);
});

test('normalizeColorForDedupe unifies English/Korean and model-specific aliases', () => {
  assert.equal(
    discovery.normalizeColorForDedupe('Silver', { brand: 'apple', modelName: 'iPhone 17 Pro' }),
    '실버 알루미늄'
  );
  assert.equal(discovery.normalizeColorForDedupe('Black Shadow', { brand: 'samsung' }), '블랙 쉐도우');
  assert.equal(discovery.normalizeColorForDedupe('Titanium Whitesilver', { brand: 'samsung' }), '티타늄 실버');
});

test('3-year cutoff includes 2023-11-12 and excludes 2023-11-11 and unreleased candidates', async () => {
  const onBoundary = makeFullOfficialRecord({
    model_name: 'Boundary Included Phone',
    domestic_model_number: 'SM-B100N',
    released_on_kr: '2023-11-12',
  });
  const outsideBoundary = makeFullOfficialRecord({
    model_name: 'Galaxy Jump3',
    domestic_model_number: 'SM-M446K',
    released_on_kr: '2023-11-11',
  });
  const futureRelease = makeFullOfficialRecord({
    model_name: 'Future Phone',
    domestic_model_number: 'SM-F100N',
    released_on_kr: '2026-12-01',
  });
  const unreleased = makeFullOfficialRecord({
    brand: 'apple',
    os: 'ios',
    model_name: 'iPhone 18',
    domestic_model_number: null,
    released_on_kr: null,
    release_status: 'unreleased',
  });

  const report = await discovery.discoverSmartphoneCandidates({
    sourceRecords: [onBoundary, outsideBoundary, futureRelease, unreleased],
    existingModels: [],
    existingVariants: [],
    referenceDateKst: '2026-11-12',
  });

  assert.equal(report.summary.classifications.NEW_MODEL, 1);
  assert.equal(report.candidates.new_models[0].normalizedModel.model_name, 'Boundary Included Phone');
  assert.equal(report.summary.classifications.EXCLUDED, 3);
  assert.deepEqual(
    report.candidates.excluded.map((e) => e.reasonCode),
    ['OUTSIDE_3_YEAR_WINDOW', 'NOT_YET_RELEASED_AS_OF_CHECK_DATE', 'NOT_YET_RELEASED_AS_OF_CHECK_DATE']
  );
});

test('deduplication checks legacy, approved, and pending models/variants including null-RAM legacy fallback', async () => {
  const existingModels = [
    {
      id: 1,
      brand: 'apple',
      model_name: 'iPhone 17 Pro',
      domestic_model_number: 'A3523',
      review_status: 'pending',
      verified: false,
      released_on_kr: '2025-09-19',
    },
    {
      id: 2,
      brand: 'samsung',
      model_name: 'Galaxy S24',
      domestic_model_number: 'SM-S921N',
      review_status: 'legacy',
      verified: true,
      released_on_kr: '2024-01-31',
    },
  ];

  const existingVariants = [
    {
      id: 101,
      smartphone_id: 1,
      storage_gb: 256,
      ram_gb: 12,
      color: '실버 알루미늄',
      review_status: 'pending',
    },
    {
      id: 102,
      smartphone_id: 2,
      storage_gb: 256,
      ram_gb: null,
      color: '오닉스 블랙',
      review_status: 'legacy',
    },
  ];

  const appleRecord = makeFullOfficialRecord({
    brand: 'apple',
    os: 'ios',
    model_name: 'iPhone 17 Pro',
    domestic_model_number: 'A3523',
    released_on_kr: '2025-09-19',
    options: [
      { storage_gb: 256, ram_gb: 12, color: 'Silver', official_option_verified: true },
      { storage_gb: 512, ram_gb: 12, color: 'Cosmic Orange', official_option_verified: true },
    ],
  });

  const samsungRecord = makeFullOfficialRecord({
    brand: 'samsung',
    os: 'android',
    model_name: 'Galaxy S24',
    domestic_model_number: 'SM-S921N',
    released_on_kr: '2024-01-31',
    options: [
      { storage_gb: 256, ram_gb: 8, color: '오닉스 블랙', official_option_verified: true },
      { storage_gb: 512, ram_gb: 8, color: '사파이어 블루', official_option_verified: true },
    ],
  });

  const report = await discovery.discoverSmartphoneCandidates({
    sourceRecords: [appleRecord, samsungRecord],
    existingModels,
    existingVariants,
    referenceDateKst: '2026-11-12',
  });

  assert.equal(report.db_write_performed, false);
  assert.equal(report.production_approved, false);
  assert.equal(report.summary.classifications.ALREADY_EXISTS_MODELS, 2);
  assert.equal(report.summary.classifications.ALREADY_EXISTS_VARIANTS, 2);
  assert.equal(report.summary.classifications.NEW_VARIANT, 2);

  const s24Existing = report.candidates.already_exists_variants.find((v) => v.target_smartphone_id === 2);
  assert.equal(s24Existing.reasonCode, 'ALREADY_EXISTS_WITH_LEGACY_NULL_RAM');

  assert.deepEqual(
    report.candidates.new_variants.map((v) => `${v.target_model_name}:${v.option.storage_gb}:${v.option.color}`),
    ['iPhone 17 Pro:512:코스믹 오렌지', 'Galaxy S24:512:사파이어 블루']
  );
  for (const nv of report.candidates.new_variants) {
    assert.equal(nv.smartphone_variants_insert_payload.review_status, 'pending');
    assert.equal(nv.smartphone_variants_insert_payload.verified, false);
    assert.equal(nv.check_constraint_readiness.insert_as_pending_ready, true);
  }
});

test('Danawa listing dates and prohibited URLs are never accepted as official launch dates', async () => {
  assert.equal(discovery.isDanawaProhibitedUrl('https://prod.danawa.com/info/ajax/getProductInfo.php?pcode=123'), true);
  assert.equal(discovery.isDanawaProhibitedUrl('https://www.samsung.com/sec/smartphones/'), false);

  const danawaDated = makeFullOfficialRecord({
    model_name: 'Danawa Only Date Phone',
    domestic_model_number: 'SM-D100N',
    released_on_kr: '2025-03-01',
    release_date_source_type: 'danawa_listing',
    source_url: 'https://prod.danawa.com/info/ajax/getOpinion.php',
  });

  const missingSpecs = makeFullOfficialRecord({
    model_name: 'Galaxy Wide9',
    domestic_model_number: 'SM-M176S',
    released_on_kr: '2026-07-03',
    chipset: null,
    weight_g: null,
    official_spec_verified: false,
    options: [],
  });

  const verifiedWithMockDanawa = makeFullOfficialRecord({
    model_name: 'Galaxy Z Fold Special Edition',
    domestic_model_number: 'SM-F958N',
    released_on_kr: '2024-10-25',
  });

  const report = await discovery.discoverSmartphoneCandidates({
    sourceRecords: [danawaDated, missingSpecs, verifiedWithMockDanawa],
    existingModels: [],
    existingVariants: [],
    referenceDateKst: '2026-11-12',
    danawaAdapterInstance: {
      async search(query) {
        return { source: 'danawa-cli-mock', items: [{ title: `${query} 512GB`, price: 2500000 }] };
      },
    },
  });

  assert.equal(report.summary.classifications.REVIEW_REQUIRED, 2);
  assert.equal(report.candidates.review_required[0].reasonCode, 'DANAWA_LISTING_DATE_NOT_OFFICIAL_LAUNCH_DATE');
  assert.equal(report.candidates.review_required[1].reasonCode, 'MISSING_OFFICIAL_SPECS_OR_OPTIONS');
  assert.equal(report.candidates.review_required[1].normalizedModel.chipset, null);
  assert.equal(report.candidates.review_required[1].normalizedModel.weight_g, null);

  assert.equal(report.summary.classifications.NEW_MODEL, 1);
  const newModel = report.candidates.new_models[0];
  assert.equal(newModel.smartphones_insert_payload.review_status, 'pending');
  assert.equal(newModel.smartphones_insert_payload.verified, false);
  assert.equal(newModel.smartphones_insert_payload.is_test, false);
  assert.equal(newModel.check_constraint_readiness.model.insert_as_pending_ready, true);
  assert.equal(newModel.danawa_cross_check.launch_date_trusted, false);
  assert.equal(newModel.danawa_cross_check.item_count, 1);
});

test('discover-smartphone-candidates CLI rejects DB write flags', () => {
  assert.throws(() => cli.parseCliArgs(['--apply']), { code: 'PHASE2_READ_ONLY_VIOLATION' });
  assert.throws(() => cli.parseCliArgs(['--write-db']), { code: 'PHASE2_READ_ONLY_VIOLATION' });

  const parsed = cli.parseCliArgs(['--date', '2026-11-12', '--out', '/tmp/test-out.json']);
  assert.equal(parsed.referenceDate, '2026-11-12');
  assert.equal(parsed.outputPath, '/tmp/test-out.json');
});

test('generated Phase 2 candidate JSON file passes read-only & schema integrity checks', () => {
  const outputPath = path.resolve(__dirname, '../data/smartphone-discovery-candidates-2026-11-12.json');
  assert.equal(fs.existsSync(outputPath), true);

  const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(report.db_write_performed, false);
  assert.equal(report.production_approved, false);
  assert.equal(report.release_window_kst.min_date, '2023-11-12');
  assert.equal(report.release_window_kst.max_date, '2026-11-12');

  for (const model of report.candidates.new_models) {
    assert.equal(typeof model.normalizedModel.domestic_model_number, 'string');
    assert.equal(model.smartphones_insert_payload.review_status, 'pending');
    assert.equal(model.check_constraint_readiness.model.insert_as_pending_ready, true);
  }
  for (const variant of report.candidates.new_variants) {
    assert.equal(variant.smartphone_variants_insert_payload.review_status, 'pending');
    assert.equal(variant.check_constraint_readiness.insert_as_pending_ready, true);
  }
  for (const excluded of report.candidates.excluded) {
    if (excluded.normalizedModel.domestic_model_number !== null) {
      assert.equal(typeof excluded.normalizedModel.domestic_model_number, 'string');
    }
  }
});
