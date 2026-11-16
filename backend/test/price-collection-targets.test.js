'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  prepare,
  detectSalesChannel,
  assessVariantSkuStatus,
} = require('../scripts/prepare-price-collection-targets');

const asOf = '2026-11-13T10:00:00Z';
const m = {
  id: '1',
  brand: 'samsung',
  model_name: 'Fixture',
  domestic_model_number: 'TEST',
  released_on_kr: '2026-01-01',
  verified: 1,
  is_test: 0,
  review_status: 'approved',
  review_metadata_json: {channel:'unlocked',channel_verified:true,channel_source_url:'https://example.com/fixture'},
};
const v = {
  id: '2',
  smartphone_id: '1',
  storage_gb: 256,
  ram_gb: null,
  color: 'black',
  verified: 1,
  review_status: 'approved',
  source_name: 'Samsung',
  source_url: 'https://example.com/fixture',
};
const run = (models = [m], variants = [v], prices = [], options = {}) =>
  prepare({ models, variants, prices, asOf, options });

// -------------------------------------------------------------
// Existing 6 tests (MUST PASS FOR FULL BACKWARD COMPATIBILITY)
// -------------------------------------------------------------

test('deduplicates colors but preserves exact variant identity and NULL RAM', () => {
  const r = run([m], [v, { ...v, id: '3', color: 'white' }]);
  assert.equal(r.length, 1);
  assert.equal(r[0].variants.length, 2);
  assert.equal(r[0].variants[0].ram_gb, null);
  assert.equal(r[0].query, 'TEST 256GB 자급제');
});

test('missing prices prioritized without inventing unlocked evidence', () => {
  assert.equal(run()[0].status, 'never_collected');
  assert.equal(run()[0].unlocked_status, 'domestic_standalone_verified');
});

test('pending and test products blocked', () => {
  for (const x of [
    { ...m, verified: 0, review_status: 'pending' },
    { ...m, is_test: 1 },
  ]) {
    assert.equal(run([x])[0].collection_eligible, false);
  }
});

test('fresh price covers only its exact variant', () => {
  const r = run(
    [m],
    [v, { ...v, id: '3', color: 'white' }],
    [
      {
        variant_id: '2',
        amount_krw: 100,
        observed_at: '2026-11-13T09:00:00Z',
        expires_at: '2026-11-14T09:00:00Z',
      },
    ]
  )[0];
  assert.equal(r.status, 'active_reference_or_sale');
  assert.deepEqual(r.active_variant_ids, ['2']);
});

test('24h boundary expired; future observation needs review', () => {
  const p = {
    variant_id: '2',
    amount_krw: 100,
    observed_at: '2026-11-12T10:00:00Z',
    expires_at: asOf,
  };
  assert.equal(run([m], [v], [p])[0].status, 'expired_only');
  assert.equal(
    run([m], [v], [{ ...p, observed_at: '2026-11-14T10:00:00Z', expires_at: '2026-11-15T10:00:00Z' }])[0]
      .status,
    'review_required'
  );
});

test('different capacities remain separate; duplicate model identity blocked', () => {
  assert.equal(run([m], [v, { ...v, id: '3', storage_gb: 512 }]).length, 2);
  assert.equal(
    run([m, { ...m, id: '4' }], [v, { ...v, id: '5', smartphone_id: '4' }])[0].collection_eligible,
    false
  );
});

// -------------------------------------------------------------
// New Stage 3-2 Regression Tests
// -------------------------------------------------------------

test('sales channel separation: carrier-exclusive models identified without keyword query for unlocked', () => {
  const carrierModels = [
    { id: '10', brand: 'samsung', model_name: 'Galaxy Buddy5', domestic_model_number: 'SM-A176L', review_metadata_json: { channel: 'carrier_exclusive_lgu', carrier: 'LG U+' } },
    { id: '11', brand: 'samsung', model_name: 'Galaxy Jump5', domestic_model_number: 'SM-A276K', review_metadata_json: { channel: 'carrier_exclusive_kt', carrier: 'KT' } },
    { id: '12', brand: 'samsung', model_name: 'Galaxy Wide9', domestic_model_number: 'SM-M176S', review_metadata_json: { channel: 'carrier_exclusive_skt', carrier: 'SKT' } },
    { id: '13', brand: 'samsung', model_name: 'Galaxy Quantum7', domestic_model_number: 'SM-A576S', review_metadata_json: { channel: 'carrier_exclusive_skt', carrier: 'SKT' } },
    { id: '14', brand: 'samsung', model_name: 'Galaxy Buddy3', domestic_model_number: 'SM-A156L', review_metadata_json: { sources: { b3: { kind: 'official_carrier' } } } },
    { id: '15', brand: 'samsung', model_name: 'Galaxy Quantum5', domestic_model_number: 'SM-A556S', review_metadata_json: { sources: { q5: { kind: 'official_carrier' } } } },
    { id: '16', brand: 'samsung', model_name: 'Galaxy Quantum6', domestic_model_number: 'SM-A566S', review_metadata_json: { sources: { q6: { kind: 'official_carrier' } } } },
  ];

  const carrierVariants = carrierModels.map((cm, idx) => ({
    id: String(100 + idx),
    smartphone_id: cm.id,
    storage_gb: 128,
    ram_gb: 6,
    color: 'black',
    verified: 1,
    review_status: 'approved',
    source_name: 'Official Carrier Announcement',
    source_url: 'https://example.com/carrier',
  }));

  const targets = run(carrierModels.map(x => ({ ...m, ...x })), carrierVariants);
  assert.equal(targets.length, 7);

  for (const t of targets) {
    assert.equal(t.is_unlocked, false);
    assert.match(t.sales_channel, /^carrier_exclusive_/);
    assert.ok(t.carrier, 'Carrier name should be identified');
    // REQUIREMENT 3: "통신사 모델에는 자급제 검색어를 생성하지 않는다"
    assert.equal(t.search_query, null);
    assert.equal(t.data_consistency_eligible, false);
    assert.ok(t.variants.every(v => !v.public));
    assert.equal(t.query, null);
    assert.equal(t.carrier_pricing_mode, 'device_only');
    assert.equal(t.unlocked_status, 'carrier_exclusive_not_unlocked');
  }
});

test('ambiguous channel classified as review_required and withheld from auto unlocked collection', () => {
  const ambiguousModel = {
    ...m,
    id: '99',
    domestic_model_number: null,
    review_metadata_json: { channel: 'review_required' },
  };
  const ambiguousVariant = { ...v, smartphone_id: '99' };

  const targets = run([ambiguousModel], [ambiguousVariant]);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].sales_channel, 'review_required');
  assert.equal(targets[0].is_unlocked, null);
  assert.equal(targets[0].search_query, null);
  assert.equal(targets[0].data_consistency_eligible, false);
  assert.equal(targets[0].exclusion_reason, '국내 모델번호 또는 유효 저장용량이 누락되어 구분이 불가능합니다.');
});

test('ambiguous RAM configurations block automatic collection to prevent mixing prices', () => {
  const s25UltraModel = {
    ...m,
    id: '25',
    domestic_model_number: 'SM-S938N',
    model_name: 'Galaxy S25 Ultra',
  };
  const v12Gb = { ...v, source_url:null, id: '251', smartphone_id: '25', storage_gb: 1024, ram_gb: 12 };
  const v16Gb = { ...v, source_url:null, id: '252', smartphone_id: '25', storage_gb: 1024, ram_gb: 16 };

  const targets = run([s25UltraModel], [v12Gb, v16Gb]);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].has_ambiguous_ram, true);
  assert.deepEqual(targets[0].ram_configs, [12, 16]);
  assert.equal(targets[0].data_consistency_eligible, false);
  assert.ok(targets[0].exclusion_reason.includes('복수의 RAM 사양'));
});

test('sku verification status distinguishes verified vs review_required vs unsupported', () => {
  const testModel = { ...m, id: '50', domestic_model_number: 'SM-S999N' };

  const vVerified = {
    ...v,
    id: '501',
    smartphone_id: '50',
    storage_gb: 256,
    color: 'black',
    review_metadata_json: { official_sku: 'FIXTURE-PART', official_sku_verified:true, sku_status: 'verified' },
  };
  const vPendingSku = {
    ...v,
    id: '502',
    smartphone_id: '50',
    storage_gb: 256,
    color: 'silver',
    review_metadata_json: { sku_status: 'pending_review', official_sku: null },
  };
  const vRejected = {
    ...v,
    id: '503',
    smartphone_id: '50',
    storage_gb: 512,
    color: 'fake_color',
    review_status: 'rejected',
    review_metadata_json: { status: 'rejected', reject_reason: '미출시 색상' },
  };

  // 1. Group with pending SKU review -> target sku_verification_status: review_required
  const targetPending = run([testModel], [vVerified, vPendingSku]);
  assert.equal(targetPending[0].sku_verification_status, 'review_required');
  assert.equal(targetPending[0].data_consistency_eligible, false);
  assert.ok(targetPending[0].exclusion_reason.includes('공식 세부 SKU 조합 검증이 완료되지 않아'));

  // 2. Group with only verified SKU -> target sku_verification_status: verified
  const targetVerified = run([testModel], [vVerified]);
  assert.equal(targetVerified[0].sku_verification_status, 'verified');
  assert.equal(targetVerified[0].data_consistency_eligible, true);

  // 3. Group with only rejected variants -> unsupported
  const targetRejected = run([testModel], [vRejected]);
  assert.equal(targetRejected[0].sku_verification_status, 'unsupported');
  assert.equal(targetRejected[0].data_consistency_eligible, false);
});

test('separate collection eligibility: data consistency vs external source permission', () => {
  // Case A: Default without permission -> source_permission is false
  const targetDefault = run()[0];
  assert.equal(targetDefault.data_consistency_eligible, true);
  assert.equal(targetDefault.source_permission_eligible, false);
  assert.equal(targetDefault.collection_eligibility.eligible, false);
  assert.equal(targetDefault.collection_eligibility.reason_code, 'LIVE_COLLECTION_NOT_PERMITTED');

  // Case B: With explicit permission and authorizationRef -> source_permission is true
  const targetAuthorized = run([m], [v], [], {
    allowLiveCollection: true,
    authorizationRef: 'APPROVED_AUDIT_STAGE_3_2',
  })[0];
  assert.equal(targetAuthorized.data_consistency_eligible, true);
  assert.equal(targetAuthorized.source_permission_eligible, true);
  assert.equal(targetAuthorized.collection_eligibility.eligible, true);
  assert.equal(targetAuthorized.collection_eligibility.reason_code, null);
});

test('channel cannot be inferred from N suffix or Apple brand', () => {
  for (const model of [{domestic_model_number:'SM-S999N'},{brand:'apple',domestic_model_number:'A9999'}]) {
    assert.equal(detectSalesChannel(model).is_unlocked, null);
  }
});
test('source-backed option is eligible without manufacturer SKU', () => {
 const row={...v,review_metadata_json:{option_release_verified:true,option_source_url:'https://example.com/fixture',official_sku:null}};
 assert.equal(run([m],[row])[0].data_consistency_eligible,true);
});
test('verified mixed RAM emits separate queries, never an ambiguous general query', () => {
 const variants=[12,16].map((ram,i)=>({...v,id:String(i+20),ram_gb:ram,review_metadata_json:{option_release_verified:true,option_source_url:'https://example.com/fixture'}}));
 const t=run([m],variants)[0]; assert.equal(t.query,null);assert.equal(t.ram_specific_queries.length,2);
 assert.equal(t.ram_specific_queries[0].variant_ids.length,1);
});

test('price DB loader excludes carrier products even with administrative approval bypass', async () => {
  const sync = require('../services/danawa-price-sync');
  let query;
  const db={query:async sql=>{query=sql;return [];}};
  await sync.loadExistingSmartphoneVariants(db,{includeUnapproved:true});
  for(const code of Object.keys(require('../services/smartphone-sales-channel').CARRIERS)) assert.ok(query.includes(code));
  assert.match(query,/carrier_exclusive_/);
});
