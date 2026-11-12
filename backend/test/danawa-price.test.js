'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const catalog = require('../services/smartphone-catalog');
const pricePreview = require('../services/smartphone-price-preview');
const adapterModule = require('../services/danawa-price-adapter');
const matcher = require('../services/danawa-price-matcher');
const syncService = require('../services/danawa-price-sync');
const dryRunScript = require('../scripts/danawa-price-dry-run');

const FIXTURE_PATH = path.resolve(__dirname, '../data/danawa-cli-mock-samples.json');
const MOCK_FIXTURES = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

test('danawa adapter documents danawa-cli v3.0.0 schema and blocks live scraping by default', async () => {
  assert.equal(adapterModule.DANAWA_CLI_COMPATIBILITY.versionChecked, '3.0.0');
  assert.equal(adapterModule.DANAWA_CLI_COMPATIBILITY.minNodeVersion, '20.0.0');
  assert.ok(adapterModule.DANAWA_CLI_COMPATIBILITY.outputFields.includes('minPrice'));
  assert.ok(adapterModule.DANAWA_CLI_COMPATIBILITY.missingPriceObservationFields.includes('shipping_krw'));

  assert.throws(
    () => adapterModule.createDanawaSearchAdapter({ mode: 'live' }),
    err => err.code === 'LIVE_COLLECTION_NOT_PERMITTED'
  );

  assert.throws(
    () => adapterModule.validateQueryInput('Galaxy S24\nrm -rf'),
    err => err.code === 'INVALID_DANAWA_QUERY'
  );
  assert.throws(
    () => adapterModule.validateQueryInput('Galaxy%20S24'),
    err => err.code === 'INVALID_DANAWA_QUERY'
  );
  assert.throws(
    () => adapterModule.validateQueryInput('Galaxy S24; echo hi'),
    err => err.code === 'INVALID_DANAWA_QUERY'
  );

  const mockAdapter = adapterModule.createDanawaSearchAdapter({ mode: 'mock', fixtures: MOCK_FIXTURES });
  const queries = adapterModule.buildVariantSearchQueries(dryRunScript.OFFLINE_FALLBACK_VARIANTS[0]);
  assert.ok(queries[0].includes('Galaxy S24'));
  assert.ok(queries[0].includes('자급제'));
  assert.ok(queries[0].includes('SM-S921N'));

  const res = await mockAdapter.searchVariant(dryRunScript.OFFLINE_FALLBACK_VARIANTS[0]);
  assert.equal(res.executedLiveRequest, false);
  assert.equal(res.mode, 'mock');
  assert.ok(res.items.length >= 5);
  assert.equal(res.plan.entries[0].primaryRequest.args.includes('--dry-run'), true);
});

test('parseCliSearchPayload supports JSON/JSONL and keeps unknown seller fields strictly null', () => {
  const jsonl = [
    JSON.stringify({ productCode: '1234567', productName: '삼성 갤럭시 S24 SM-S921N 256GB 자급제 앰버 옐로우', minPrice: '920,000', mallName: '쿠팡', maker: '삼성전자' }),
  ].join('\n');

  const parsed = adapterModule.parseCliSearchPayload(jsonl);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].minPrice, 920000);
  assert.equal(parsed[0].shipping_krw, null);
  assert.equal(parsed[0].source_url, null);
  assert.equal(parsed[0].unconditional, null);
  assert.equal(parsed[0].in_stock, null);
  assert.equal(parsed[0].is_new, null);
  assert.equal(parsed[0].is_unlocked, null);
  assert.equal(parsed[0].data_completeness, 'search_summary_only');
});

test('matcher accurately matches domestic model number, storage, RAM, color, and unlocked listings', () => {
  const s24Amber = {
    variant_id: '90000500',
    brand: 'samsung',
    model_name: 'Galaxy S24',
    domestic_model_number: 'SM-S921N',
    storage_gb: 256,
    ram_gb: 8,
    color: '앰버 옐로우',
  };

  // Matches Korean spelling variant "옐로", shorthand "256G", full Samsung domestic SKU prefix, and "3사/LGU+ 호환"
  const okSkuAndCompat = matcher.matchDanawaItemToVariant({
    productName: '삼성 갤럭시 S24 SM-S921NZYEKOO 256G 앰버 옐로 자급제 (SKT/KT/LGU+ 호환)',
    minPrice: 929000,
    maker: '삼성전자',
  }, s24Amber);
  assert.equal(okSkuAndCompat.matched, true);
  assert.equal(okSkuAndCompat.matchDetails.domesticModelNumberMatched, true);
  assert.equal(okSkuAndCompat.matchDetails.storageGb, 256);

  // Separates Galaxy S25 Ultra 16GB/1TB 티타늄 제트블랙 vs 12GB/1TB 티타늄 블랙
  const s25UltraJetBlack = {
    variant_id: '90000504',
    brand: 'samsung',
    model_name: 'Galaxy S25 Ultra',
    domestic_model_number: 'SM-S938N',
    storage_gb: 1024,
    ram_gb: 16,
    color: '티타늄 제트블랙',
    launch_price_krw: 2249500,
  };
  const s25UltraBlack1Tb = {
    variant_id: '90001425',
    brand: 'samsung',
    model_name: 'Galaxy S25 Ultra',
    domestic_model_number: 'SM-S938N',
    storage_gb: 1024,
    ram_gb: 12,
    color: '티타늄 블랙',
  };

  const jetBlackListing = {
    productName: '삼성전자 갤럭시 S25 울트라 SM-S938N 16GB/1TB 티타늄 제트블랙 자급제',
    minPrice: 2090000,
    maker: '삼성전자',
  };
  const blackListing = {
    productName: '삼성전자 갤럭시 S25 울트라 SM-S938N 12GB/1TB 티타늄 블랙 자급제',
    minPrice: 1950000,
    maker: '삼성전자',
  };

  assert.equal(matcher.matchDanawaItemToVariant(jetBlackListing, s25UltraJetBlack).matched, true);
  assert.equal(matcher.matchDanawaItemToVariant(jetBlackListing, s25UltraBlack1Tb).matched, false);
  assert.equal(matcher.matchDanawaItemToVariant(blackListing, s25UltraBlack1Tb).matched, true);
  assert.equal(matcher.matchDanawaItemToVariant(blackListing, s25UltraJetBlack).matched, false);

  // "5G" model suffix must never be misinterpreted as 5GB RAM
  const a35 = {
    variant_id: '90001380',
    brand: 'samsung',
    model_name: 'Galaxy A35 5G',
    domestic_model_number: 'SM-A356N',
    storage_gb: 128,
    ram_gb: 6,
    color: '어썸 아이스블루',
  };
  const a35Match = matcher.matchDanawaItemToVariant({
    productName: '삼성 갤럭시 A35 5G SM-A356N 128GB 어썸 아이스블루 자급제',
    minPrice: 430000,
    maker: '삼성전자',
  }, a35);
  assert.equal(a35Match.matched, true);
});

test('matcher rejects disqualified listings (used, refurb, carrier, overseas, accessory, conditional, abnormal, missing code)', () => {
  const s24 = {
    variant_id: '90000500',
    brand: 'samsung',
    model_name: 'Galaxy S24',
    domestic_model_number: 'SM-S921N',
    storage_gb: 256,
    ram_gb: 8,
    color: '앰버 옐로우',
    launch_price_krw: 1155000,
  };

  const cases = [
    { name: 'used', item: { productName: '갤럭시 S24 SM-S921N 256GB 앰버 옐로우 자급제 단순개봉 S급', minPrice: 690000 }, cat: 'used_or_refurb' },
    { name: 'refurb', item: { productName: '갤럭시 S24 SM-S921N 256GB 앰버 옐로우 자급제 리퍼비시', minPrice: 680000 }, cat: 'used_or_refurb' },
    { name: 'carrier', item: { productName: '갤럭시 S24 SM-S921N 256GB 앰버 옐로우 SKT 공시지원 번호이동', minPrice: 350000 }, cat: 'carrier_contract' },
    { name: 'overseas', item: { productName: '갤럭시 S24 SM-S921B 256GB 앰버 옐로우 해외직구 자급제', minPrice: 780000 }, cat: 'overseas' },
    { name: 'accessory', item: { productName: '갤럭시 S24 SM-S921N 앰버 옐로우 투명 케이스', category: '휴대폰케이스', minPrice: 15900 }, cat: 'accessory' },
    { name: 'conditional', item: { productName: '갤럭시 S24 SM-S921N 256GB 앰버 옐로우 자급제 제휴카드 청구할인가', minPrice: 850000 }, cat: 'conditional_discount' },
    { name: 'out_of_stock', item: { productName: '갤럭시 S24 SM-S921N 256GB 앰버 옐로우 자급제 일시품절', minPrice: 929000 }, cat: 'out_of_stock' },
    { name: 'below_launch_ratio', item: { productName: '갤럭시 S24 SM-S921N 256GB 앰버 옐로우 자급제', minPrice: 200000 }, cat: 'abnormal_price' },
    { name: 'not_unlocked', item: { productName: '갤럭시 S24 SM-S921N 256GB 앰버 옐로우', minPrice: 920000 }, cat: 'not_unlocked' },
    { name: 'plus_collision', item: { productName: '갤럭시 S24+ SM-S926N 256GB 앰버 옐로우 자급제', minPrice: 1120000 }, cat: 'model_mismatch' },
    { name: 'missing_domestic_code', item: { productName: '갤럭시 S24 256GB 앰버 옐로우 자급제', minPrice: 920000 }, cat: 'domestic_model_number_mismatch' },
  ];

  for (const c of cases) {
    const res = matcher.matchDanawaItemToVariant(c.item, s24);
    assert.equal(res.matched, false, `${c.name} should not match`);
    assert.equal(res.exclusionCategory, c.cat, `${c.name} expected exclusion ${c.cat}, got ${res.exclusionCategory}`);
  }
});

test('price observation mapping enforces 24h TTL policy, distinguishes incomplete search output, and integrates with smartphoneCatalog & preview', async () => {
  const now = new Date('2026-11-12T06:10:00.000Z');
  const adapter = adapterModule.createDanawaSearchAdapter({ mode: 'mock', fixtures: MOCK_FIXTURES });

  const report = await syncService.runDanawaPriceDryRun({
    variants: dryRunScript.OFFLINE_FALLBACK_VARIANTS,
    adapter,
    now,
    ttlHours: 6,
  });

  assert.equal(report.summary.dryRun, true);
  assert.equal(report.summary.dbWritesAttempted, 0);
  assert.equal(report.summary.executedLiveRequest, false);
  assert.equal(report.summary.variantsWithMatchedCandidates, 9);
  assert.equal(report.summary.variantsReadyForStorage, 5);
  assert.equal(report.summary.totalIncompleteSearchOnlyMatches, 4);

  // Flip6 256GB 민트 should pick 1,010,000 + 0 = 1,010,000 over 995,000 + 50,000 = 1,045,000
  const flip6Mint = report.variantReports.find(r => r.variant.variant_id === '90001375');
  assert.ok(flip6Mint);
  assert.equal(flip6Mint.bestSelectedPrice.total_krw, 1010000);
  assert.equal(flip6Mint.bestSelectedPrice.seller_name, '삼성공식스토어');

  // Search-summary-only variant (Galaxy S24 마블 그레이 90001390) matches metadata yet stays blocked for DB storage
  const s24MarbleGray = report.variantReports.find(r => r.variant.variant_id === '90001390');
  assert.equal(s24MarbleGray.matchedCount, 1);
  assert.equal(s24MarbleGray.readyForStorageCount, 0);
  assert.equal(s24MarbleGray.mappedMatches[0].readyForStorage, false);
  assert.ok(s24MarbleGray.mappedMatches[0].missingSellerFields.includes('shipping_krw'));
  assert.ok(s24MarbleGray.mappedMatches[0].missingSellerFields.includes('source_url'));

  // TTL cap > 24h throws
  assert.throws(
    () => syncService.mapMatchedOfferToPriceObservation(
      { item: { productName: 'x', minPrice: 1000000 } },
      { variant_id: '1' },
      { now, ttlHours: 25 }
    ),
    err => err.code === 'INVALID_TTL_HOURS'
  );

  // Integration check with smartphoneCatalog + smartphonePricePreview before and after 24h expiration
  const s24AmberReport = report.variantReports.find(r => r.variant.variant_id === '90000500');
  const obsList = s24AmberReport.mappedMatches
    .filter(m => m.readyForStorage)
    .map((m, idx) => ({ id: idx + 1, ...m.observationPayload }));

  const activePrice = pricePreview.buildCandidatePriceObject(
    { variant_id: '90000500', brand: 'samsung', model_name: 'Galaxy S24', storage_gb: 256, color: '앰버 옐로우' },
    obsList,
    { NODE_ENV: 'test' },
    now
  );
  assert.ok(activePrice.selected);
  assert.equal(activePrice.selected.price_source, 'verified_sale');
  assert.equal(activePrice.selected.total_krw, 929000);
  assert.equal(activePrice.selected.purchase_verified, true);

  const afterExpiration = new Date('2026-11-12T12:05:00.000Z');
  const expiredSelection = catalog.selectBestPrice(obsList, afterExpiration);
  assert.equal(expiredSelection.selected, null);
  const expiredPreview = pricePreview.buildCandidatePriceObject(
    { variant_id: '90000500', brand: 'samsung', model_name: 'Galaxy S24', storage_gb: 256, color: '앰버 옐로우' },
    obsList,
    { NODE_ENV: 'test' },
    afterExpiration
  );
  assert.equal(expiredPreview.selected, null);
});

test('persistVerifiedObservations stays blocked without explicit approval flags and deduplicates when mocked', async () => {
  const readyCandidate = {
    readyForStorage: true,
    evaluation: { eligible: true },
    observationPayload: {
      variant_id: '90000500',
      source_name: 'danawa-cli',
      source_url: 'https://www.samsung.com/sec/smartphones/galaxy-s24-s921/SM-S921NZYEKOO/',
      seller_name: '삼성공식파트너',
      amount_krw: 929000,
      shipping_krw: 0,
      observed_at: new Date('2026-11-12T06:00:00.000Z'),
      expires_at: new Date('2026-11-12T12:00:00.000Z'),
      conditions_text: '조건 없는 국내 정품 자급제 새제품',
      unconditional: true,
      in_stock: true,
      is_new: true,
      is_unlocked: true,
    },
  };

  const blockedRes = await syncService.persistVerifiedObservations(null, [readyCandidate], { apply: false });
  assert.equal(blockedRes.applied, false);
  assert.equal(blockedRes.insertedCount, 0);

  await assert.rejects(
    () => syncService.persistVerifiedObservations(null, [readyCandidate], { apply: true, allowDbWrite: true }),
    err => err.code === 'WRITE_PERMISSION_REF_REQUIRED'
  );

  // Mock Sequelize transaction & PriceObservation model
  const createdRows = [];
  let findCallCount = 0;
  const mockDb = {
    models: {
      PriceObservation: {
        findOne: async () => {
          findCallCount += 1;
          return findCallCount === 1 ? null : { id: 999 };
        },
        create: async (row) => {
          createdRows.push(row);
          return row;
        },
      },
    },
    transaction: async (fn) => fn({}),
  };

  const persisted = await syncService.persistVerifiedObservations(
    mockDb,
    [readyCandidate, readyCandidate],
    {
      apply: true,
      allowDbWrite: true,
      permissionRef: 'MOCK-TEST-APPROVAL-001',
      now: new Date('2026-11-12T06:10:00.000Z'),
    }
  );
  assert.equal(persisted.applied, true);
  assert.equal(persisted.insertedCount, 1);
  assert.equal(persisted.skippedDuplicatesCount, 1);
  assert.equal(createdRows.length, 1);
});

test('CommonJS backend verifies ESM dynamic import() + HTML cleaning + AbortSignal contract matching PC-FIT searchDanawa shape', async () => {
  const esmDataUrl = `data:text/javascript,${encodeURIComponent(`
    export async function searchDanawa({ query, page, limit, signal }) {
      if (!signal || typeof signal.aborted !== 'boolean') {
        return { ok: false, errorCode: 'MISSING_SIGNAL' };
      }
      return {
        ok: true,
        items: [{
          productCode: '33921003',
          productName: '<b>삼성전자</b> 갤럭시 S24 SM-S921N 256GB &amp; 자급제 마블 그레이',
          minPrice: 918000,
          mallName: '쿠팡',
          maker: '삼성전자',
          queryEcho: query,
          page,
          limit,
        }],
      };
    }
  `)}`;

  const probe = await adapterModule.probeDanawaCliEsmSupport({
    importModule: () => import(esmDataUrl),
  });
  assert.equal(probe.esmDynamicImportSupported, true);
  assert.equal(probe.packageAvailable, true);
  assert.equal(probe.hasSearchDanawa, true);
  assert.ok(probe.exports.includes('searchDanawa'));

  const transport = adapterModule.createDanawaCliTransport({
    importModule: () => import(esmDataUrl),
    timeoutMs: 15000,
    page: 1,
    limit: 10,
  });

  // Remains blocked when allowLiveCollection / authorizationRef are omitted
  assert.throws(
    () => adapterModule.createDanawaSearchAdapter({ mode: 'live', transport }),
    err => err.code === 'LIVE_COLLECTION_NOT_PERMITTED'
  );

  // Clean HTML tags/entities and parse items when run via explicit injected transport test
  const rawPayload = await transport({ query: 'Galaxy S24 자급제 256GB SM-S921N' });
  const parsed = adapterModule.parseCliSearchPayload(rawPayload);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].productName, '삼성전자 갤럭시 S24 SM-S921N 256GB & 자급제 마블 그레이');
  assert.equal(parsed[0].danawaProductUrl, 'https://prod.danawa.com/info/?pcode=33921003');
  assert.equal(parsed[0].shipping_krw, null);
});

test('danawa_reference surfaces minPrice as 참고가격 without relaxing budget/upgrade confirmation and honors 24h expiry', () => {
  const now = new Date('2026-11-12T06:10:00.000Z');
  const marbleGrayRow = {
    variant_id: '90001390',
    smartphone_id: '90000119',
    brand: 'samsung',
    model_name: 'Galaxy S24',
    domestic_model_number: 'SM-S921N',
    released_on_kr: '2024-01-31',
    os: 'android',
    storage_gb: 256,
    ram_gb: 8,
    color: '마블 그레이',
    phone_verified: 1,
    variant_verified: 1,
  };

  // Without opt-in flag, existing behavior remains null when observations are empty
  const defaultRes = pricePreview.buildCandidatePriceObject(marbleGrayRow, [], { NODE_ENV: 'test' }, now);
  assert.equal(defaultRes.selected, null);

  // With ALLOW_DANAWA_REFERENCE_PRICES=true, search-summary minPrice is surfaced as 다나와 기준 최저가
  const refRes = pricePreview.buildCandidatePriceObject(
    marbleGrayRow,
    [],
    { NODE_ENV: 'test', ALLOW_DANAWA_REFERENCE_PRICES: 'true' },
    now
  );
  assert.ok(refRes.selected);
  assert.equal(refRes.selected.price_source, 'danawa_reference');
  assert.equal(refRes.selected.price_label, '다나와 기준 최저가');
  assert.equal(refRes.selected.amount_krw, 918000);
  assert.equal(refRes.selected.shipping_krw, null);
  assert.equal(refRes.selected.total_krw, null);
  assert.equal(refRes.selected.budget_basis_krw, null);
  assert.equal(refRes.selected.purchase_verified, false);
  assert.equal(refRes.selected.eligible, false);
  assert.equal(refRes.selected.danawa_product_url, 'https://prod.danawa.com/info/?pcode=33921003');
  assert.ok(refRes.selected.checked_at);
  assert.match(refRes.selected.warning, /실제 최종 결제가격과 다를 수/);

  // Reference price MUST NOT confirm budget compliance or hard conditions
  assert.equal(catalog.effectiveBudgetPriceKrw(refRes.selected), null);
  assert.equal(
    catalog.matchesHardConditions(
      { ...marbleGrayRow, price: refRes.selected },
      {
        allowed_brands: ['samsung'],
        required_os: null,
        min_storage_gb: 256,
        max_weight_g: null,
        min_refresh_hz: null,
        require_5g: false,
        require_wireless_charging: false,
        budget_max_krw: 1500000,
      },
      now
    ),
    false
  );

  // Verified observation always overrides danawa_reference
  const verifiedOverride = pricePreview.buildCandidatePriceObject(
    marbleGrayRow,
    [{
      id: 77,
      variant_id: '90001390',
      source_name: 'samsung_partner',
      source_url: 'https://samsung.com/sec/example',
      seller_name: '삼성공식',
      amount_krw: 940000,
      shipping_krw: 0,
      observed_at: new Date('2026-11-12T06:00:00.000Z'),
      expires_at: new Date('2026-11-12T12:00:00.000Z'),
      conditions_text: '무조건',
      unconditional: true,
      in_stock: true,
      is_new: true,
      is_unlocked: true,
    }],
    { NODE_ENV: 'test', ALLOW_DANAWA_REFERENCE_PRICES: 'true' },
    now
  );
  assert.equal(verifiedOverride.selected.price_source, 'verified_sale');
  assert.equal(verifiedOverride.selected.purchase_verified, true);
  assert.equal(verifiedOverride.selected.total_krw, 940000);

  // After 24h (or 6h TTL expiry), danawa_reference expires cleanly to null
  const afterExpiry = pricePreview.buildCandidatePriceObject(
    marbleGrayRow,
    [],
    { NODE_ENV: 'test', ALLOW_DANAWA_REFERENCE_PRICES: 'true' },
    new Date('2026-11-12T12:05:00.000Z')
  );
  assert.equal(afterExpiry.selected, null);
});
