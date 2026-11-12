'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { Sequelize, DataTypes } = require('sequelize');

require('../config/loadEnv')();
const databaseConfig = require('../config/database').readConfig();
const defineModels = require('../db/models');
const productPublication = require('../services/product-publication');
const { createCandidateReviewStore } = require('../services/smartphone-candidate-review-store');
const registrationService = require('../services/smartphone-candidate-registration');

const TEST_DB_NAME = 'final_project_test_phase4';

let rawConnection;
let testDb;
let reviewStore;
let sampleCandidates;

const adminUser = {
  id: 1,
  email: 'admin@kikirowum.test',
};

function createSampleCandidates() {
  return [
    {
      candidate_id: 'new_model__samsung__SM-F958N',
      candidate_kind: 'new_model',
      brand: 'samsung',
      model_name: 'Galaxy Z Fold Special Edition',
      domestic_model_number: 'SM-F958N',
      released_on_kr: '2024-10-25',
      storage_gb: 512,
      ram_gb: 16,
      color: '블랙 쉐도우',
      launch_price_krw: 2789600,
      channel: 'standard',
      sku_example: 'SM-F958NZKAKOO',
      target_smartphone_id: null,
      target_variant_id: null,
      target_parent_review_status: null,
      official_sources: [
        'https://www.samsung.com/sec/smartphones/galaxy-z-fold6-se-f958/SM-F958NZKAKOO/',
        'https://news.samsung.com/kr/삼성전자-갤럭시-z-폴드-스페셜-에디션-국내-출시-2',
      ],
      specs: {
        os: 'android',
        chipset: 'Snapdragon 8 Gen 3 for Galaxy',
        screen_inches: 8.0,
        refresh_hz: 120,
        battery_mah: 4400,
        weight_g: 236,
        supports_5g: true,
        wireless_charging: true,
      },
      phase3_payload: {
        model: {
          brand: 'samsung',
          model_name: 'Galaxy Z Fold Special Edition',
          domestic_model_number: 'SM-F958N',
          released_on_kr: '2024-10-25',
          os: 'android',
          chipset: 'Snapdragon 8 Gen 3 for Galaxy',
          screen_inches: 8.0,
          refresh_hz: 120,
          battery_mah: 4400,
          weight_g: 236,
          supports_5g: true,
          wireless_charging: true,
          source_name: '삼성전자 공식',
          source_url: 'https://www.samsung.com/sec/smartphones/galaxy-z-fold6-se-f958/SM-F958NZKAKOO/',
          official_product_url: 'https://news.samsung.com/kr/삼성전자-갤럭시-z-폴드-스페셜-에디션-국내-출시-2',
          details_json: { cover_display_inches: 6.5, ip_rating: 'IP48' },
        },
        variants: [
          {
            storage_gb: 512,
            ram_gb: 16,
            color: '블랙 쉐도우',
            launch_price_krw: 2789600,
            launch_price_metadata_json: {
              currency: 'KRW',
              price_type: 'official_kr_launch',
              sku: 'SM-F958NZKAKOO',
            },
            source_name: '삼성전자 공식',
            source_url: 'https://www.samsung.com/sec/smartphones/galaxy-z-fold6-se-f958/SM-F958NZKAKOO/',
          },
        ],
      },
      duplicate_check: { is_duplicate: false, detail: '중복 없음' },
      verification_status: 'VERIFIED',
      verification_reason: '공식 SKU 및 출시일 검증 완료',
      approval_eligible: true,
      admin_review: {
        admin_status: 'approved',
        latest_reason: '공식 확인 및 관리자 승인 완료',
        history: [],
      },
      registration: null,
    },
    {
      candidate_id: 'new_variant__90000108__256__8__핑크',
      candidate_kind: 'new_variant',
      brand: 'apple',
      model_name: 'iPhone 16',
      domestic_model_number: 'A3287',
      released_on_kr: '2024-09-20',
      storage_gb: 256,
      ram_gb: 8,
      color: '핑크',
      launch_price_krw: 1400000,
      channel: 'standard',
      sku_example: 'MYDE3KH/A',
      target_smartphone_id: '90000108',
      target_variant_id: null,
      target_parent_review_status: 'legacy',
      official_sources: ['https://support.apple.com/ko-kr/121029'],
      specs: {
        os: 'ios',
        chipset: 'Apple A18',
        screen_inches: 6.1,
      },
      phase3_payload: {
        variant: {
          smartphone_id: 90000108,
          storage_gb: 256,
          ram_gb: 8,
          color: '핑크',
          launch_price_krw: 1400000,
          launch_price_metadata_json: {
            currency: 'KRW',
            sku: 'MYDE3KH/A',
          },
          source_name: 'Apple 공식',
          source_url: 'https://support.apple.com/ko-kr/121029',
        },
      },
      duplicate_check: { is_duplicate: false, detail: '중복 없음' },
      verification_status: 'VERIFIED',
      verification_reason: '공식 사양 검증 완료',
      approval_eligible: true,
      admin_review: {
        admin_status: 'approved',
        latest_reason: 'iPhone 16 핑크 옵션 승인',
        history: [],
      },
      registration: null,
    },
    {
      candidate_id: 'unapproved_candidate',
      candidate_kind: 'new_model',
      brand: 'samsung',
      model_name: 'Galaxy Test Unapproved',
      domestic_model_number: 'SM-T999N',
      released_on_kr: '2025-01-01',
      storage_gb: 256,
      ram_gb: 8,
      color: '블랙',
      verification_status: 'VERIFIED',
      official_sources: ['https://news.samsung.com/kr/test'],
      duplicate_check: { is_duplicate: false },
      admin_review: {
        admin_status: 'pending',
        history: [],
      },
    },
    {
      candidate_id: 'unverified_candidate',
      candidate_kind: 'new_model',
      brand: 'samsung',
      model_name: 'Galaxy Test Unverified',
      domestic_model_number: 'SM-U999N',
      released_on_kr: '2025-01-01',
      storage_gb: 256,
      ram_gb: 8,
      color: '블랙',
      verification_status: 'REVIEW_REQUIRED',
      official_sources: ['https://news.samsung.com/kr/test'],
      duplicate_check: { is_duplicate: false },
      admin_review: {
        admin_status: 'approved',
        history: [],
      },
    },
    {
      candidate_id: 'variant_with_pending_parent',
      candidate_kind: 'new_variant',
      brand: 'samsung',
      model_name: 'Galaxy S26',
      domestic_model_number: 'SM-S942N',
      target_smartphone_id: '90000134',
      storage_gb: 512,
      ram_gb: 12,
      color: '옐로우',
      verification_status: 'VERIFIED',
      official_sources: ['https://news.samsung.com/kr/test'],
      duplicate_check: { is_duplicate: false },
      admin_review: {
        admin_status: 'approved',
        history: [],
      },
    },
    {
      candidate_id: 'samsung_exclusive_without_sku',
      candidate_kind: 'new_variant',
      brand: 'samsung',
      model_name: 'iPhone 16',
      domestic_model_number: 'A3287',
      target_smartphone_id: '90000108',
      storage_gb: 256,
      ram_gb: 8,
      color: '크래프티드 블랙',
      channel: 'samsung_dotcom_exclusive',
      sku_example: null,
      verification_status: 'VERIFIED',
      official_sources: ['https://news.samsung.com/kr/test'],
      duplicate_check: { is_duplicate: false },
      admin_review: {
        admin_status: 'approved',
        history: [],
      },
    },
    {
      candidate_id: 'db_pending_model_with_catalog_url',
      candidate_kind: 'db_pending_model',
      brand: 'samsung',
      model_name: 'Galaxy Z Fold8',
      domestic_model_number: 'SM-F976N',
      official_sources: ['https://www.samsung.com/sec/all-smartphones/'],
      verification_status: 'VERIFIED',
      duplicate_check: { is_duplicate: false },
      admin_review: {
        admin_status: 'approved',
        history: [],
      },
    },
    {
      candidate_id: 'db_pending_model_held',
      candidate_kind: 'db_pending_model',
      brand: 'apple',
      model_name: 'iPhone Duo',
      domestic_model_number: 'A3720',
      official_sources: ['https://www.apple.com/kr/'],
      verification_status: 'VERIFIED',
      duplicate_check: { is_duplicate: false },
      admin_review: {
        admin_status: 'approved',
        history: [],
      },
    },
  ];
}

async function resetBaselineData() {
  await testDb.query('DELETE FROM price_observations WHERE id > 0');
  await testDb.query('DELETE FROM smartphone_variants WHERE id > 0');
  await testDb.query('DELETE FROM smartphones WHERE id > 0');
  await testDb.query('DELETE FROM users WHERE id > 0');

  await testDb.query(
    `INSERT INTO users (id, email, password_hash) VALUES (1, 'admin@kikirowum.test', 'hash')`
  );

  await testDb.query(
    `INSERT INTO smartphones (
      id, brand, model_name, domestic_model_number, released_on_kr, os, chipset,
      screen_inches, refresh_hz, battery_mah, weight_g, supports_5g, wireless_charging,
      source_name, source_url, official_product_url, review_status, verified_at, verified, is_test
    ) VALUES (
      90000108, 'apple', 'iPhone 16', 'A3287', '2024-09-20', 'ios', 'Apple A18',
      6.10, 60, 3561, 170.00, 1, 1,
      'Apple Korea 공식 사양', 'https://support.apple.com/ko-kr/121029', 'https://www.apple.com/kr/iphone-16/specs/',
      'legacy', '2024-09-20 00:00:00.000', 1, 0
    )`
  );

  await testDb.query(
    `INSERT INTO smartphone_variants (
      id, smartphone_id, storage_gb, ram_gb, color,
      source_name, source_url, review_status, verified_at, verified
    ) VALUES (
      90001108, 90000108, 128, 8, '블랙',
      'Apple Korea 공식 사양', 'https://support.apple.com/ko-kr/121029', 'legacy', '2024-09-20 00:00:00.000', 1
    )`
  );

  await testDb.query(
    `INSERT INTO smartphones (
      id, brand, model_name, domestic_model_number, released_on_kr, os, chipset,
      screen_inches, refresh_hz, battery_mah, weight_g, supports_5g, wireless_charging,
      source_name, source_url, official_product_url, review_status, review_metadata_json, verified_at, verified, is_test
    ) VALUES (
      90000129, 'samsung', 'Galaxy Z Fold7', 'SM-F966N', '2025-07-25', 'android', 'Snapdragon 8 Elite',
      7.60, 120, 4400, 239.00, 1, 1,
      '삼성전자 공식', 'https://news.samsung.com/kr/fold7', 'https://news.samsung.com/kr/fold7',
      'approved', '{"status":"approved","source":"newsroom"}', '2025-07-25 00:00:00.000', 1, 0
    )`
  );

  await testDb.query(
    `INSERT INTO smartphone_variants (
      id, smartphone_id, storage_gb, ram_gb, color,
      source_name, source_url, review_status, review_metadata_json, verified_at, verified
    ) VALUES (
      90001129, 90000129, 256, 12, '블루 쉐도우',
      '삼성전자 공식', 'https://news.samsung.com/kr/fold7', 'approved', '{"status":"approved"}', '2025-07-25 00:00:00.000', 1
    )`
  );

  await testDb.query(
    `INSERT INTO smartphones (
      id, brand, model_name, domestic_model_number, released_on_kr, os, chipset,
      screen_inches, refresh_hz, battery_mah, weight_g, supports_5g, wireless_charging,
      source_name, source_url, review_status, verified, is_test
    ) VALUES (
      90000134, 'samsung', 'Galaxy S26', 'SM-S942N', '2026-03-11', 'android', 'Exynos 2600',
      6.20, 120, 4000, 168.00, 1, 1,
      '삼성전자 공식', 'https://news.samsung.com/kr/s26',
      'pending', 0, 0
    )`
  );

  sampleCandidates = createSampleCandidates();
  let inMemoryState = {
    schema_version: 1,
    storage_kind: 'isolated_test_store',
    reviews: {},
  };

  reviewStore = createCandidateReviewStore({
    loadReport: () => ({ checked_at: '2026-11-13', candidates: sampleCandidates }),
    loadState: () => inMemoryState,
    saveState: (next) => {
      inMemoryState = next;
    },
  });
}

describe('Phase 4 isolated registration tests', { concurrency: 1 }, () => {
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
    await resetBaselineData();
  });

  it('verifies test schema lifecycle and initial baseline count', async () => {
    const [[phoneCount]] = await testDb.query('SELECT count(*) as c FROM smartphones');
    const [[variantCount]] = await testDb.query('SELECT count(*) as c FROM smartphone_variants');

    assert.equal(Number(phoneCount.c), 3, 'Baseline should contain 3 models');
    assert.equal(Number(variantCount.c), 2, 'Baseline should contain 2 variants');
  });

  it('1. Successfully registers new model candidate with initial variants in transaction', async () => {
    const res = await registrationService.registerApprovedCandidate({
      candidateId: 'new_model__samsung__SM-F958N',
      adminUser,
      db: testDb,
      reviewStore,
    });

    assert.equal(res.success, true);
    assert.equal(res.already_registered, false);
    assert.equal(res.target_table, 'smartphones');
    assert.ok(res.inserted_id > 0);

    const [modelRows] = await testDb.query(
      'SELECT * FROM smartphones WHERE id = :id',
      { replacements: { id: res.inserted_id } }
    );
    assert.equal(modelRows.length, 1);
    const registeredModel = modelRows[0];

    assert.equal(registeredModel.brand, 'samsung');
    assert.equal(registeredModel.domestic_model_number, 'SM-F958N');
    assert.equal(registeredModel.model_name, 'Galaxy Z Fold Special Edition');
    assert.equal(registeredModel.review_status, 'pending', 'Must register as pending for draft safety');
    assert.equal(registeredModel.verified, 0, 'Must register as unverified (verified = 0)');
    assert.equal(registeredModel.is_test, 0, 'is_test must be 0 for catalog draft');

    const [variantRows] = await testDb.query(
      'SELECT * FROM smartphone_variants WHERE smartphone_id = :id',
      { replacements: { id: res.inserted_id } }
    );
    assert.equal(variantRows.length, 1);
    const registeredVariant = variantRows[0];
    assert.equal(registeredVariant.storage_gb, 512);
    assert.equal(registeredVariant.ram_gb, 16);
    assert.equal(registeredVariant.color, '블랙 쉐도우');
    assert.equal(registeredVariant.review_status, 'pending');
    assert.equal(registeredVariant.verified, 0);

    const updatedCandidate = await reviewStore.getCandidateById('new_model__samsung__SM-F958N');
    assert.equal(updatedCandidate.registration?.status, 'registered');
    assert.equal(updatedCandidate.registration?.target_table, 'smartphones');
    assert.equal(updatedCandidate.registration?.inserted_id, res.inserted_id);
  });

  it('2. Idempotent repeated registration returns already_registered without duplicating rows', async () => {
    const firstCall = await registrationService.registerApprovedCandidate({
      candidateId: 'new_model__samsung__SM-F958N',
      adminUser,
      db: testDb,
      reviewStore,
    });

    const [[countBefore]] = await testDb.query('SELECT count(*) as c FROM smartphones');

    const secondCall = await registrationService.registerApprovedCandidate({
      candidateId: 'new_model__samsung__SM-F958N',
      adminUser,
      db: testDb,
      reviewStore,
    });

    const [[countAfter]] = await testDb.query('SELECT count(*) as c FROM smartphones');

    assert.equal(secondCall.success, true);
    assert.equal(secondCall.already_registered, true);
    assert.equal(secondCall.inserted_id, firstCall.inserted_id);
    assert.equal(Number(countBefore.c), Number(countAfter.c));
  });

  it('3. Successfully registers new variant candidate on existing approved model', async () => {
    const res = await registrationService.registerApprovedCandidate({
      candidateId: 'new_variant__90000108__256__8__핑크',
      adminUser,
      db: testDb,
      reviewStore,
    });

    assert.equal(res.success, true);
    assert.equal(res.already_registered, false);
    assert.equal(res.target_table, 'smartphone_variants');
    assert.ok(res.inserted_id > 0);

    const [variantRows] = await testDb.query(
      'SELECT * FROM smartphone_variants WHERE id = :id',
      { replacements: { id: res.inserted_id } }
    );
    assert.equal(variantRows.length, 1);
    const row = variantRows[0];
    assert.equal(String(row.smartphone_id), '90000108');
    assert.equal(row.storage_gb, 256);
    assert.equal(row.color, '핑크');
    assert.equal(row.review_status, 'pending');
    assert.equal(row.verified, 0);
  });

  it('4. Dry run verifies registration eligibility without writing to DB', async () => {
    const [[countBefore]] = await testDb.query('SELECT count(*) as c FROM smartphones');

    const res = await registrationService.registerApprovedCandidate({
      candidateId: 'new_model__samsung__SM-F958N',
      adminUser,
      db: testDb,
      reviewStore,
      dryRun: true,
    });

    const [[countAfter]] = await testDb.query('SELECT count(*) as c FROM smartphones');

    assert.equal(res.success, true);
    assert.equal(res.dry_run, true);
    assert.equal(Number(countBefore.c), Number(countAfter.c));
  });

  it('5. Policy enforcement: Blocks registration of candidate lacking admin approval (APPROVAL_REQUIRED)', async () => {
    await assert.rejects(
      async () => {
        await registrationService.registerApprovedCandidate({
          candidateId: 'unapproved_candidate',
          adminUser,
          db: testDb,
          reviewStore,
        });
      },
      (err) => {
        assert.equal(err.code, 'APPROVAL_REQUIRED');
        assert.equal(err.status, 409);
        return true;
      }
    );
  });

  it('6. Policy enforcement: Blocks registration of candidate not VERIFIED (VERIFICATION_REQUIRED)', async () => {
    await assert.rejects(
      async () => {
        await registrationService.registerApprovedCandidate({
          candidateId: 'unverified_candidate',
          adminUser,
          db: testDb,
          reviewStore,
        });
      },
      (err) => {
        assert.equal(err.code, 'VERIFICATION_REQUIRED');
        assert.equal(err.status, 409);
        return true;
      }
    );
  });

  it('7. Issue 1 enforcement: Blocks child variant registration when parent model is pending or non-existent', async () => {
    await assert.rejects(
      async () => {
        await registrationService.registerApprovedCandidate({
          candidateId: 'variant_with_pending_parent',
          adminUser,
          db: testDb,
          reviewStore,
        });
      },
      (err) => {
        assert.equal(err.code, 'PARENT_MODEL_NOT_READY');
        assert.equal(err.status, 409);
        return true;
      }
    );
  });

  it('8. Issue 2 enforcement: Blocks Samsung dotcom exclusive colors lacking domestic SKU (MISSING_OFFICIAL_SKU)', async () => {
    await assert.rejects(
      async () => {
        await registrationService.registerApprovedCandidate({
          candidateId: 'samsung_exclusive_without_sku',
          adminUser,
          db: testDb,
          reviewStore,
        });
      },
      (err) => {
        assert.equal(err.code, 'MISSING_OFFICIAL_SKU');
        assert.equal(err.status, 409);
        return true;
      }
    );
  });

  it('9. Issue 3 enforcement: Blocks catalog URL or identification hold pending models', async () => {
    await assert.rejects(
      async () => {
        await registrationService.registerApprovedCandidate({
          candidateId: 'db_pending_model_with_catalog_url',
          adminUser,
          db: testDb,
          reviewStore,
        });
      },
      (err) => {
        assert.equal(err.code, 'UNVERIFIED_SOURCE_URL');
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await registrationService.registerApprovedCandidate({
          candidateId: 'db_pending_model_held',
          adminUser,
          db: testDb,
          reviewStore,
        });
      },
      (err) => {
        assert.equal(err.code, 'IDENTIFICATION_HOLD');
        return true;
      }
    );
  });

  it('10. Issue 4 enforcement: Atomic transaction rollback on failure protects DB from partial writes', async () => {
    const [[phoneCountBefore]] = await testDb.query('SELECT count(*) as c FROM smartphones');
    const [[variantCountBefore]] = await testDb.query('SELECT count(*) as c FROM smartphone_variants');

    await assert.rejects(
      async () => {
        await registrationService.registerApprovedCandidate({
          candidateId: 'new_model__samsung__SM-F958N',
          adminUser,
          db: testDb,
          reviewStore,
          simulateError: true,
        });
      },
      (err) => {
        assert.equal(err.message, 'SIMULATED_TRANSACTION_FAILURE');
        return true;
      }
    );

    const [[phoneCountAfter]] = await testDb.query('SELECT count(*) as c FROM smartphones');
    const [[variantCountAfter]] = await testDb.query('SELECT count(*) as c FROM smartphone_variants');

    assert.equal(Number(phoneCountBefore.c), Number(phoneCountAfter.c), 'Smartphones count must be unchanged');
    assert.equal(Number(variantCountBefore.c), Number(variantCountAfter.c), 'Variants count must be unchanged');
  });

  it('11. Public catalog safety: Newly registered draft rows (review_status=pending, verified=0) are excluded from public catalog', async () => {
    await registrationService.registerApprovedCandidate({
      candidateId: 'new_model__samsung__SM-F958N',
      adminUser,
      db: testDb,
      reviewStore,
    });

    const publicPredicate = await productPublication.sql(testDb, { variants: true });
    const [publicRows] = await testDb.query(
      `SELECT s.id, s.model_name, s.review_status, s.verified
       FROM smartphones s
       JOIN smartphone_variants v ON v.smartphone_id = s.id
       WHERE ${publicPredicate}`
    );

    for (const row of publicRows) {
      assert.equal(row.verified, 1);
      assert.ok(['legacy', 'approved'].includes(row.review_status));
      assert.notEqual(row.model_name, 'Galaxy Z Fold Special Edition');
    }
  });
});
