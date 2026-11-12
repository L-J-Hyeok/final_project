'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { Sequelize, DataTypes, Op } = require('sequelize');

require('../config/loadEnv')();
const databaseConfig = require('../config/database').readConfig();
const defineModels = require('../db/models');
const catalog = require('../services/smartphone-catalog');
const productPublication = require('../services/product-publication');
const adapterModule = require('../services/danawa-price-adapter');
const matcher = require('../services/danawa-price-matcher');
const syncService = require('../services/danawa-price-sync');
const pricePreview = require('../services/smartphone-price-preview');
const recommendationValidator = require('../services/recommendation-validator');
const upgradeAdvisor = require('../services/upgrade-advisor');

const TEST_DB_NAME = 'final_project_test_phase5';
const FIXTURE_PATH = path.resolve(__dirname, '../data/danawa-cli-mock-samples.json');
const MOCK_FIXTURES = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

let rawConnection;
let testDb;

async function resetTestData() {
  await testDb.query('DELETE FROM price_observations WHERE id > 0');
  await testDb.query('DELETE FROM smartphone_variants WHERE id > 0');
  await testDb.query('DELETE FROM smartphones WHERE id > 0');
  await testDb.query('DELETE FROM users WHERE id > 0');

  await testDb.query(
    `INSERT INTO users (id, email, password_hash) VALUES (1, 'tester@kikirowum.test', 'hash')`
  );

  // 1. Published verified smartphone: Galaxy S24 (SM-S921N)
  await testDb.query(
    `INSERT INTO smartphones (
      id, brand, model_name, domestic_model_number, released_on_kr, os, chipset,
      screen_inches, refresh_hz, battery_mah, weight_g, supports_5g, wireless_charging,
      source_name, source_url, official_product_url, review_status, verified_at, verified, is_test
    ) VALUES (
      90000119, 'samsung', 'Galaxy S24', 'SM-S921N', '2024-01-31', 'android', 'Exynos 2400',
      6.20, 120, 4000, 167.00, 1, 1,
      '삼성전자 공식', 'https://news.samsung.com/kr/s24', 'https://www.samsung.com/sec/smartphones/galaxy-s24/',
      'legacy', '2024-01-31 00:00:00.000', 1, 0
    )`
  );

  // Published verified variant: Galaxy S24 256GB 앰버 옐로우
  await testDb.query(
    `INSERT INTO smartphone_variants (
      id, smartphone_id, storage_gb, ram_gb, color,
      source_name, source_url, review_status, verified_at, verified
    ) VALUES (
      90000500, 90000119, 256, 8, '앰버 옐로우',
      '삼성전자 공식', 'https://news.samsung.com/kr/s24', 'legacy', '2024-01-31 00:00:00.000', 1
    )`
  );

  // Published verified variant: Galaxy S24 256GB 마블 그레이
  await testDb.query(
    `INSERT INTO smartphone_variants (
      id, smartphone_id, storage_gb, ram_gb, color,
      source_name, source_url, review_status, verified_at, verified
    ) VALUES (
      90001390, 90000119, 256, 8, '마블 그레이',
      '삼성전자 공식', 'https://news.samsung.com/kr/s24', 'legacy', '2024-01-31 00:00:00.000', 1
    )`
  );

  // 2. Pending unapproved smartphone & variant: Galaxy Z Fold Special Edition (SM-F958N)
  await testDb.query(
    `INSERT INTO smartphones (
      id, brand, model_name, domestic_model_number, released_on_kr, os, chipset,
      screen_inches, refresh_hz, battery_mah, weight_g, supports_5g, wireless_charging,
      source_name, source_url, official_product_url, review_status, review_metadata_json, verified_at, verified, is_test
    ) VALUES (
      90000140, 'samsung', 'Galaxy Z Fold Special Edition', 'SM-F958N', '2024-10-25', 'android', 'Snapdragon 8 Gen 3 for Galaxy',
      8.00, 120, 4400, 236.00, 1, 1,
      '삼성전자 공식', 'https://news.samsung.com/kr/fold-se', 'https://www.samsung.com/sec/smartphones/galaxy-z-fold6-se-f958/',
      'pending', null, null, 0, 0
    )`
  );

  await testDb.query(
    `INSERT INTO smartphone_variants (
      id, smartphone_id, storage_gb, ram_gb, color,
      source_name, source_url, review_status, verified_at, verified
    ) VALUES (
      90001500, 90000140, 512, 16, '블랙 쉐도우',
      '삼성전자 공식', 'https://news.samsung.com/kr/fold-se', 'pending', null, 0
    )`
  );
}

describe('Phase 5 Danawa Price Integration & Verification', { concurrency: 1 }, () => {
  before(async () => {
    rawConnection = await mysql.createConnection({
      host: databaseConfig.options.host,
      port: databaseConfig.options.port,
      user: databaseConfig.username,
      password: databaseConfig.password,
      multipleStatements: true,
    });

    await rawConnection.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
    await rawConnection.query(`CREATE DATABASE ${TEST_DB_NAME}`);
    await rawConnection.changeUser({ database: TEST_DB_NAME });

    const sql001 = fs.readFileSync(path.resolve(__dirname, '../db/migrations/001-initial.sql'), 'utf8');
    await rawConnection.query(sql001);

    const sql002 = fs.readFileSync(path.resolve(__dirname, '../db/migration-drafts/002-smartphone-details.draft.sql'), 'utf8');
    await rawConnection.query(sql002);

    testDb = new Sequelize(TEST_DB_NAME, databaseConfig.username, databaseConfig.password, {
      host: databaseConfig.options.host,
      port: databaseConfig.options.port,
      dialect: 'mysql',
      logging: false,
      retry: { max: 0 },
      dialectOptions: {
        supportBigNumbers: true,
        bigNumberStrings: true,
        multipleStatements: false,
      },
    });

    defineModels(testDb, DataTypes, { extended: true });
    await testDb.authenticate();
  });

  after(async () => {
    if (testDb) {
      await testDb.close();
    }
    if (rawConnection) {
      await rawConnection.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
      await rawConnection.end();
    }
  });

  beforeEach(async () => {
    await resetTestData();
  });

  it('1. PC-FIT searchDanawa shape & transport contract compatibility', async () => {
    // Verifies the exact call shape from PC-FIT: searchDanawa({ query, page: 1, limit: 10, signal })
    const esmDataUrl = `data:text/javascript,${encodeURIComponent(`
      export async function searchDanawa({ query, page, limit, signal }) {
        if (!query || typeof query !== 'string') throw new Error('Query required');
        if (!signal || typeof signal.aborted !== 'boolean') throw new Error('AbortSignal required');
        return {
          ok: true,
          items: [
            {
              productCode: '33921001',
              productName: '<b>삼성전자</b> 갤럭시 S24 SM-S921N 256GB &amp; 자급제 앰버 옐로우',
              minPrice: 929000,
              mallName: '삼성공식파트너',
              maker: '삼성전자',
              queryEcho: query,
              page,
              limit,
            }
          ]
        };
      }
    `)}`;

    const transport = adapterModule.createDanawaCliTransport({
      importModule: () => import(esmDataUrl),
      timeoutMs: 15000,
      page: 1,
      limit: 10,
    });

    const rawPayload = await transport({ query: 'Galaxy S24 자급제 256GB SM-S921N' });
    const parsed = adapterModule.parseCliSearchPayload(rawPayload);

    assert.equal(parsed.length, 1);
    // HTML tags stripped, entities decoded
    assert.equal(parsed[0].productName, '삼성전자 갤럭시 S24 SM-S921N 256GB & 자급제 앰버 옐로우');
    assert.equal(parsed[0].minPrice, 929000);
    assert.equal(parsed[0].danawaProductUrl, 'https://prod.danawa.com/info/?pcode=33921001');
    assert.equal(parsed[0].data_completeness, 'search_summary_only');

    // Query injection checks
    assert.throws(
      () => adapterModule.validateQueryInput('Galaxy S24; rm -rf /'),
      err => err.code === 'INVALID_DANAWA_QUERY'
    );
  });

  it('2. Multi-factor matching against Kikirowum DB specs and disqualification filters', () => {
    const s24Variant = {
      variant_id: '90000500',
      brand: 'samsung',
      model_name: 'Galaxy S24',
      domestic_model_number: 'SM-S921N',
      storage_gb: 256,
      ram_gb: 8,
      color: '앰버 옐로우',
    };

    // Match success
    const matchSuccess = matcher.matchDanawaItemToVariant({
      productName: '삼성전자 갤럭시 S24 SM-S921N 256GB 자급제 앰버 옐로우',
      minPrice: 929000,
      maker: '삼성전자',
    }, s24Variant);
    assert.equal(matchSuccess.matched, true);
    assert.equal(matchSuccess.matchDetails.domesticModelNumberMatched, true);
    assert.equal(matchSuccess.matchDetails.storageGb, 256);

    // Disqualified: used / refurb
    const matchUsed = matcher.matchDanawaItemToVariant({
      productName: '삼성전자 갤럭시 S24 SM-S921N 256GB [중고/A급] 자급제 앰버 옐로우',
      minPrice: 650000,
    }, s24Variant);
    assert.equal(matchUsed.matched, false);
    assert.equal(matchUsed.disqualified, true);
    assert.equal(matchUsed.exclusionCategory, 'used_or_refurb');

    // Disqualified: carrier contract
    const matchCarrier = matcher.matchDanawaItemToVariant({
      productName: '삼성전자 갤럭시 S24 SM-S921N 256GB SKT 기기변경 공시지원 앰버 옐로우',
      minPrice: 300000,
    }, s24Variant);
    assert.equal(matchCarrier.matched, false);
    assert.equal(matchCarrier.disqualified, true);
    assert.equal(matchCarrier.exclusionCategory, 'carrier_contract');

    // Disqualified: overseas import
    const matchOverseas = matcher.matchDanawaItemToVariant({
      productName: '삼성 갤럭시 S24 256GB 해외직구 글로벌버전 앰버 옐로우',
      minPrice: 750000,
    }, s24Variant);
    assert.equal(matchOverseas.matched, false);
    assert.equal(matchOverseas.disqualified, true);
    assert.equal(matchOverseas.exclusionCategory, 'overseas');

    // Disqualified: accessory
    const matchAccessory = matcher.matchDanawaItemToVariant({
      productName: '갤럭시 S24 SM-S921N 정품 실리콘 케이스 앰버 옐로우',
      minPrice: 28000,
    }, s24Variant);
    assert.equal(matchAccessory.matched, false);
    assert.equal(matchAccessory.disqualified, true);
    assert.equal(matchAccessory.exclusionCategory, 'accessory');
  });

  it('3. syncVariantPrices dry-run vs transactional DB persistence with deduplication', async () => {
    const adapter = adapterModule.createDanawaSearchAdapter({
      mode: 'mock',
      fixtures: MOCK_FIXTURES,
    });

    const now = new Date('2026-11-12T06:10:00.000Z');

    // Step A: Dry run (apply: false)
    const dryRunResult = await syncService.syncVariantPrices(testDb, {
      adapter,
      options: {
        apply: false,
        now,
        ttlHours: 6,
        domesticModelNumbers: ['SM-S921N'],
      },
    });

    assert.equal(dryRunResult.success, true);
    assert.equal(dryRunResult.dryRun, true);
    assert.equal(dryRunResult.persistence.applied, false);
    assert.equal(dryRunResult.summary.variantsWithMatchedCandidates >= 1, true);

    // Verify 0 DB writes occurred in dry run
    const [obsBefore] = await testDb.query('SELECT COUNT(*) as count FROM price_observations');
    assert.equal(Number(obsBefore[0].count), 0);

    // Step B: Persistence requires permissionRef
    await assert.rejects(
      () => syncService.syncVariantPrices(testDb, {
        adapter,
        options: {
          apply: true,
          allowDbWrite: true,
          now,
        },
      }),
      err => err.code === 'WRITE_PERMISSION_REF_REQUIRED'
    );

    // Step C: Apply persistence with valid permissionRef
    const syncApplyResult = await syncService.syncVariantPrices(testDb, {
      adapter,
      options: {
        apply: true,
        allowDbWrite: true,
        permissionRef: 'PHASE5-VERIFIED-SYNC-001',
        now,
        ttlHours: 6,
        domesticModelNumbers: ['SM-S921N'],
      },
    });

    assert.equal(syncApplyResult.success, true);
    assert.equal(syncApplyResult.dryRun, false);
    assert.equal(syncApplyResult.persistence.applied, true);
    assert.ok(syncApplyResult.persistence.insertedCount >= 1);
    assert.ok(syncApplyResult.persistence.rejectedIncompleteCount >= 1); // search-only items rejected

    // Verify written observation in DB
    const [obsRows] = await testDb.query(
      'SELECT * FROM price_observations WHERE variant_id = 90000500'
    );
    assert.ok(obsRows.length >= 1);
    const firstObs = obsRows[0];
    assert.equal(Number(firstObs.amount_krw), 929000);
    assert.equal(Number(firstObs.shipping_krw), 0);
    assert.equal(firstObs.seller_name, '삼성공식파트너');
    assert.equal(Boolean(firstObs.in_stock), true);
    assert.equal(Boolean(firstObs.is_unlocked), true);

    // Step D: Re-running sync with identical price deduplicates (no double insert)
    const syncDuplicateResult = await syncService.syncVariantPrices(testDb, {
      adapter,
      options: {
        apply: true,
        allowDbWrite: true,
        permissionRef: 'PHASE5-VERIFIED-SYNC-002',
        now,
        ttlHours: 6,
        domesticModelNumbers: ['SM-S921N'],
      },
    });

    assert.equal(syncDuplicateResult.persistence.applied, true);
    assert.ok(syncDuplicateResult.persistence.skippedDuplicatesCount >= 1);

    const [obsAfterDup] = await testDb.query('SELECT COUNT(*) as count FROM price_observations');
    assert.equal(Number(obsAfterDup[0].count), obsRows.length);
  });

  it('4. Price change tracking and historical price observations preservation', async () => {
    const now1 = new Date('2026-11-12T06:00:00.000Z');
    const now2 = new Date('2026-11-12T08:00:00.000Z');

    // First observation: 929,000 KRW
    const candidate1 = {
      readyForStorage: true,
      evaluation: { eligible: true },
      observationPayload: {
        variant_id: '90000500',
        source_name: 'danawa-cli',
        source_url: 'https://www.samsung.com/sec/s24',
        seller_name: '삼성공식파트너',
        amount_krw: 929000,
        shipping_krw: 0,
        observed_at: now1,
        expires_at: new Date(now1.getTime() + 6 * 60 * 60 * 1000),
        conditions_text: '조건 없는 국내 정품 자급제 새제품',
        unconditional: true,
        in_stock: true,
        is_new: true,
        is_unlocked: true,
      },
    };

    await syncService.persistVerifiedObservations(testDb, [candidate1], {
      apply: true,
      allowDbWrite: true,
      permissionRef: 'PHASE5-PRICE-CHANGE-001',
      now: now1,
    });

    // Seller updates price: drops to 919,000 KRW at 08:00
    const candidate2 = {
      readyForStorage: true,
      evaluation: { eligible: true },
      observationPayload: {
        variant_id: '90000500',
        source_name: 'danawa-cli',
        source_url: 'https://www.samsung.com/sec/s24',
        seller_name: '삼성공식파트너',
        amount_krw: 919000,
        shipping_krw: 0,
        observed_at: now2,
        expires_at: new Date(now2.getTime() + 6 * 60 * 60 * 1000),
        conditions_text: '조건 없는 국내 정품 자급제 새제품 (가격 인하)',
        unconditional: true,
        in_stock: true,
        is_new: true,
        is_unlocked: true,
      },
    };

    const updateRes = await syncService.persistVerifiedObservations(testDb, [candidate2], {
      apply: true,
      allowDbWrite: true,
      permissionRef: 'PHASE5-PRICE-CHANGE-002',
      now: now2,
    });

    assert.equal(updateRes.insertedCount, 1);
    assert.equal(updateRes.skippedDuplicatesCount, 0);

    // Both observations exist in DB (history preserved)
    const [allObs] = await testDb.query(
      'SELECT id, amount_krw, observed_at FROM price_observations WHERE variant_id = 90000500 ORDER BY observed_at ASC'
    );
    assert.equal(allObs.length, 2);
    assert.equal(Number(allObs[0].amount_krw), 929000);
    assert.equal(Number(allObs[1].amount_krw), 919000);

    // Catalog selection picks the latest lower price
    const selection = catalog.selectBestPrice(allObs.map(r => ({
      ...r,
      variant_id: '90000500',
      source_name: 'danawa-cli',
      source_url: 'https://www.samsung.com/sec/s24',
      seller_name: '삼성공식파트너',
      shipping_krw: 0,
      expires_at: new Date(now2.getTime() + 6 * 60 * 60 * 1000),
      unconditional: true,
      in_stock: true,
      is_new: true,
      is_unlocked: true,
      conditions_text: '정품',
    })), now2);

    assert.equal(selection.selected.amount_krw, 919000);
  });

  it('5. 24-hour TTL and expiration policy enforcement', () => {
    const now = new Date('2026-11-12T12:00:00.000Z');

    // Observation active (expires at 14:00)
    const activeObs = {
      id: 1,
      variant_id: 90000500,
      source_name: 'danawa-cli',
      source_url: 'https://samsung.com',
      seller_name: '삼성공식파트너',
      amount_krw: 929000,
      shipping_krw: 0,
      observed_at: new Date('2026-11-12T08:00:00.000Z'),
      expires_at: new Date('2026-11-12T14:00:00.000Z'),
      conditions_text: '정품',
      unconditional: true,
      in_stock: true,
      is_new: true,
      is_unlocked: true,
    };
    const evalActive = catalog.evaluateObservation(activeObs, now);
    assert.equal(evalActive.eligible, true);
    assert.equal(evalActive.is_expired, false);

    // Observation expired (expired at 11:00, now is 12:00)
    const expiredObs = {
      ...activeObs,
      expires_at: new Date('2026-11-12T11:00:00.000Z'),
    };
    const evalExpired = catalog.evaluateObservation(expiredObs, now);
    assert.equal(evalExpired.eligible, false);
    assert.equal(evalExpired.is_expired, true);

    // Reject TTL > 24 hours
    assert.throws(
      () => syncService.mapMatchedOfferToPriceObservation(
        { item: {} },
        { variant_id: '90000500' },
        { ttlHours: 48 }
      ),
      err => err.code === 'INVALID_TTL_HOURS'
    );
  });

  it('6. Publication gate prevents draft Phase 4 registered products from leaking via price links', async () => {
    // Phase 4 draft product: Galaxy Z Fold Special Edition (SM-F958N, variant 90001500)
    const [draftVariants] = await testDb.query(
      'SELECT * FROM smartphone_variants WHERE id = 90001500'
    );
    assert.equal(draftVariants.length, 1);
    assert.equal(productPublication.isPublic(draftVariants[0], { hasReviewStatus: true }), false);

    // Even if a price observation is linked to this draft variant
    await testDb.query(
      `INSERT INTO price_observations (
        id, variant_id, source_name, source_url, seller_name, amount_krw, shipping_krw,
        observed_at, expires_at, conditions_text, unconditional, in_stock, is_new, is_unlocked
      ) VALUES (
        99901, 90001500, 'danawa-cli', 'https://samsung.com/fold-se', '삼성닷컴', 2789600, 0,
        '2026-11-12 06:00:00.000', '2026-11-12 18:00:00.000', '자급제 공식', 1, 1, 1, 1
      )`
    );

    // Public catalog query using productPublication.sql MUST filter out draft model & variant
    const pubSql = await productPublication.sql(testDb);
    const [publicList] = await testDb.query(`
      SELECT s.id as smartphone_id, v.id as variant_id, s.model_name
      FROM smartphones s
      JOIN smartphone_variants v ON v.smartphone_id = s.id
      WHERE ${pubSql}
    `);

    // S24 variants are public; draft Fold Special Edition is NOT public
    const publicVariantIds = publicList.map(r => Number(r.variant_id));
    assert.ok(publicVariantIds.includes(90000500));
    assert.ok(publicVariantIds.includes(90001390));
    assert.equal(publicVariantIds.includes(90001500), false);
  });

  it('7. Service integration with Recommendation Validator & Upgrade Advisor', async () => {
    const now = new Date('2026-11-12T07:00:00.000Z');

    // Seed verified active price observation
    await testDb.query(
      `INSERT INTO price_observations (
        id, variant_id, source_name, source_url, seller_name, amount_krw, shipping_krw,
        observed_at, expires_at, conditions_text, unconditional, in_stock, is_new, is_unlocked
      ) VALUES (
        50001, 90000500, 'danawa-cli', 'https://samsung.com/s24', '삼성공식스토어', 929000, 0,
        '2026-11-12 06:00:00.000', '2026-11-12 18:00:00.000', '자급제 무료배송', 1, 1, 1, 1
      )`
    );

    const [obsRows] = await testDb.query(
      'SELECT * FROM price_observations WHERE variant_id = 90000500'
    );
    const candidateRow = {
      variant_id: '90000500',
      smartphone_id: '90000119',
      phone_verified: true,
      variant_verified: true,
      brand: 'samsung',
      model_name: 'Galaxy S24',
      domestic_model_number: 'SM-S921N',
      storage_gb: 256,
      ram_gb: 8,
      color: '앰버 옐로우',
    };

    const priceObj = pricePreview.buildCandidatePriceObject(candidateRow, obsRows, { NODE_ENV: 'production' }, now);
    assert.equal(priceObj.selected.price_source, 'verified_sale');
    assert.equal(priceObj.selected.amount_krw, 929000);
    assert.equal(priceObj.selected.purchase_verified, true);

    // Part A: Upgrade Advisor integration
    const ownedDevice = {
      category: 'smartphone',
      brand: 'samsung',
      model_name: 'Galaxy S21',
      domestic_model_number: 'SM-G991N',
      storage_gb: 128,
      ram_gb: 8,
      screen_inches: 6.2,
      refresh_hz: 120,
      battery_mah: 4000,
      weight_g: 169,
      wireless_charging: true,
      verified: true,
    };

    const fullCandidate = {
      ...candidateRow,
      screen_inches: 6.2,
      refresh_hz: 120,
      battery_mah: 4000,
      weight_g: 167,
      supports_5g: true,
      wireless_charging: true,
      chipset: 'Exynos 2400',
      eligible_reasons: [{ code: 'budget_headroom' }],
      price: priceObj.selected,
      sources: [{ source_name: '삼성전자 공식' }],
    };

    const comparison = upgradeAdvisor.buildDeviceCandidateComparison(ownedDevice, fullCandidate);
    assert.equal(comparison.fields.price.status, 'verified_candidate_price');
    assert.equal(comparison.fields.price.candidate_total_krw, 929000);
    assert.equal(comparison.fields.price.price_source, 'verified_sale');
    assert.equal(comparison.fields.price.development_only, false);

    // Part B: Recommendation Validator integration
    const recommendationContext = {
      purchase_conditions: {
        hard: {
          budget_max_krw: 1200000,
          min_storage_gb: 256,
          usages: ['coding'],
        },
      },
      candidates_snapshot: [fullCandidate],
    };

    const mockAiOutput = {
      status: 'recommend',
      items: [
        {
          variant_id: '90000500',
          rank: 1,
          profile_refs: ['common.usages'],
          reasons: [
            {
              code: 'budget_headroom',
            },
          ],
          evidence: [
            {
              field: 'price',
              variant_id: '90000500',
              price_observation_id: '50001',
              total_krw: 929000,
              value: 929000,
            },
          ],
        },
      ],
    };

    const validationResult = recommendationValidator.validateRecommendationOutput(mockAiOutput, recommendationContext);
    assert.equal(validationResult.valid, true);
    assert.equal(validationResult.result.items[0].price.price_source, 'verified_sale');
    assert.equal(validationResult.result.items[0].price.purchase_verified, true);
    assert.equal(validationResult.result.items[0].price.total_krw, 929000);
  });

  it('8. Verify Live MySQL database has ZERO writes (49 / 257 / 0 preserved)', async () => {
    // Query the production DB directly through a separate connection
    const liveConn = await mysql.createConnection({
      host: databaseConfig.options.host,
      port: databaseConfig.options.port,
      user: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database,
    });

    try {
      const [s] = await liveConn.query('SELECT COUNT(*) as count FROM smartphones');
      const [v] = await liveConn.query('SELECT COUNT(*) as count FROM smartphone_variants');
      const [p] = await liveConn.query('SELECT COUNT(*) as count FROM price_observations');

      assert.equal(Number(s[0].count), 49, 'Production smartphones count must remain exactly 49');
      assert.equal(Number(v[0].count), 257, 'Production smartphone_variants count must remain exactly 257');
      assert.equal(Number(p[0].count), 0, 'Production price_observations count must remain exactly 0');
    } finally {
      await liveConn.end();
    }
  });
});
