'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const verifier = require('../services/smartphone-candidate-verifier');
const { createCandidateReviewStore } = require('../services/smartphone-candidate-review-store');
const { isAdminEmail, parseAdminEmails } = require('../auth/admin');
const cli = require('../scripts/verify-smartphone-candidates');

const { VERIFICATION_STATUSES, ADMIN_STATUSES } = verifier;

function makeMockIndex() {
  const models = [
    {
      id: 90000108,
      brand: 'apple',
      model_name: 'iPhone 16',
      domestic_model_number: 'A3287',
      review_status: 'legacy',
      verified: true,
      released_on_kr: '2024-09-20',
      source_url: 'https://support.apple.com/ko-kr/121029',
      official_product_url: 'https://support.apple.com/ko-kr/121029',
    },
    {
      id: 90000129,
      brand: 'samsung',
      model_name: 'Galaxy Z Fold7',
      domestic_model_number: 'SM-F966N',
      review_status: 'approved',
      verified: true,
      released_on_kr: '2025-07-25',
      source_url: 'https://news.samsung.com/kr/삼성전자-갤럭시-z-폴드7-공개',
      official_product_url: 'https://news.samsung.com/kr/삼성전자-갤럭시-z-폴드7-공개',
    },
    {
      id: 90000134,
      brand: 'samsung',
      model_name: 'Galaxy S26',
      domestic_model_number: 'SM-S942N',
      review_status: 'pending',
      verified: false,
      released_on_kr: '2026-03-11',
    },
  ];

  const variants = [
    {
      id: 90001108,
      smartphone_id: 90000108,
      storage_gb: 128,
      ram_gb: 8,
      color: '블랙',
      review_status: 'legacy',
    },
    {
      id: 90001129,
      smartphone_id: 90000129,
      storage_gb: 256,
      ram_gb: 12,
      color: '블루 쉐도우',
      review_status: 'approved',
    },
  ];

  const discovery = require('../services/smartphone-candidate-discovery');
  return discovery.buildInventoryIndex(models, variants);
}

test('verifier identifies VERIFIED, REVIEW_REQUIRED, and explicitly REJECTED combinations', () => {
  const liveIndex = makeMockIndex();
  const checkedAt = '2026-11-12';

  const mockDiscovery = {
    checked_at: checkedAt,
    candidates: {
      new_models: [
        {
          modelClassification: 'NEW_MODEL',
          normalizedModel: {
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
          },
          check_constraint_readiness: {
            model: { admin_approval_ready: true },
            variants: [{ admin_approval_ready: true }],
          },
          smartphone_variants_insert_payloads: [
            {
              storage_gb: 512,
              ram_gb: 16,
              color: '블랙 쉐도우',
              launch_price_krw: 2789600,
              channel: 'standard',
              sku_example: 'SM-F958NZKAKOO',
              source_url: 'https://www.samsung.com/sec/smartphones/galaxy-z-fold6-se-f958/SM-F958NZKAKOO/',
            },
          ],
        },
      ],
      new_variants: [
        {
          classification: 'NEW_VARIANT',
          target_smartphone_id: 90000108,
          target_model_name: 'iPhone 16',
          target_domestic_model_number: 'A3287',
          target_parent_review_status: 'legacy',
          option: {
            storage_gb: 256,
            ram_gb: 8,
            color: '핑크',
            launch_price_krw: null,
            official_option_verified: true,
            source_url: 'https://support.apple.com/ko-kr/121029',
          },
        },
        {
          classification: 'NEW_VARIANT',
          target_smartphone_id: 90000129,
          target_model_name: 'Galaxy Z Fold7',
          target_domestic_model_number: 'SM-F966N',
          target_parent_review_status: 'approved',
          option: {
            storage_gb: 1024,
            ram_gb: 16,
            color: '실버 쉐도우',
            launch_price_krw: null,
            official_option_verified: true,
            source_url: 'https://news.samsung.com/kr/삼성전자-갤럭시-z-폴드7-공개',
          },
        },
        {
          classification: 'NEW_VARIANT',
          target_smartphone_id: 90000134,
          target_model_name: 'Galaxy S26',
          target_domestic_model_number: 'SM-S942N',
          target_parent_review_status: 'pending',
          option: {
            storage_gb: 256,
            ram_gb: 12,
            color: '스카이 블루',
            launch_price_krw: null,
            official_option_verified: true,
            source_url: 'https://news.samsung.com/kr/삼성전자-3세대-ai폰-갤럭시-s26-시리즈-공개',
          },
        },
      ],
      review_required: [
        {
          modelClassification: 'REVIEW_REQUIRED',
          reasonCode: 'MISSING_OFFICIAL_SPECS_OR_OPTIONS',
          normalizedModel: {
            brand: 'samsung',
            model_name: 'Galaxy Wide9',
            domestic_model_number: 'SM-M176S',
            released_on_kr: '2026-07-03',
            source_url: 'https://www.samsung.com/sec/support/model/SM-M176SZKASKC/',
          },
          missingFields: ['chipset', 'confirmed_storage_color_options'],
          partialVariants: [],
        },
      ],
    },
  };

  const report = verifier.verifyAllCandidates({
    discoveryReport: mockDiscovery,
    existingModels: liveIndex.models,
    existingVariants: liveIndex.variants,
    checkedAt,
  });

  assert.equal(report.schema_version, 3);
  assert.equal(report.db_write_performed, false);
  assert.equal(report.production_approved, false);

  const newModel = report.candidates.find((c) => c.candidate_kind === 'new_model');
  assert.equal(newModel.verification_status, VERIFICATION_STATUSES.VERIFIED);
  assert.equal(newModel.approval_eligible, true);

  const verifiedVariant = report.candidates.find(
    (c) => c.candidate_kind === 'new_variant' && c.model_name === 'iPhone 16'
  );
  assert.equal(verifiedVariant.verification_status, VERIFICATION_STATUSES.VERIFIED);
  assert.equal(verifiedVariant.approval_eligible, true);

  const rejectedVariant = report.candidates.find(
    (c) => c.candidate_kind === 'new_variant' && c.model_name === 'Galaxy Z Fold7' && c.storage_gb === 1024
  );
  assert.equal(rejectedVariant.verification_status, VERIFICATION_STATUSES.REJECTED);
  assert.equal(rejectedVariant.verification_reason_code, 'UNRELEASED_STORAGE_COLOR_COMBINATION');
  assert.equal(rejectedVariant.approval_eligible, false);

  const pendingParentVariant = report.candidates.find(
    (c) => c.candidate_kind === 'new_variant' && c.model_name === 'Galaxy S26'
  );
  assert.equal(pendingParentVariant.verification_status, VERIFICATION_STATUSES.REVIEW_REQUIRED);
  assert.equal(pendingParentVariant.approval_eligible, false);

  const reviewModel = report.candidates.find((c) => c.candidate_kind === 'review_model');
  assert.equal(reviewModel.verification_status, VERIFICATION_STATUSES.REVIEW_REQUIRED);
  assert.equal(reviewModel.approval_eligible, false);
});

test('approval policy enforces real-time re-deduplication and rejects unverified or duplicate candidates', () => {
  const liveIndex = makeMockIndex();

  const validCandidate = {
    candidate_id: 'new_model__samsung__SM-F958N',
    candidate_kind: 'new_model',
    brand: 'samsung',
    model_name: 'Galaxy Z Fold Special Edition',
    domestic_model_number: 'SM-F958N',
    verification_status: VERIFICATION_STATUSES.VERIFIED,
    official_sources: ['https://www.samsung.com/sec/smartphones/galaxy-z-fold6-se-f958/SM-F958NZKAKOO/'],
  };
  const approval1 = verifier.verifySingleCandidateForApproval(validCandidate, liveIndex);
  assert.equal(approval1.allowed, true);

  const duplicateCandidate = {
    candidate_id: 'new_model__apple__A3287',
    candidate_kind: 'new_model',
    brand: 'apple',
    model_name: 'iPhone 16',
    domestic_model_number: 'A3287',
    verification_status: VERIFICATION_STATUSES.VERIFIED,
    official_sources: ['https://support.apple.com/ko-kr/121029'],
  };
  const approval2 = verifier.verifySingleCandidateForApproval(duplicateCandidate, liveIndex);
  assert.equal(approval2.allowed, false);
  assert.equal(approval2.errorCode, 'DUPLICATE_CANDIDATE');

  const unverifiedCandidate = {
    ...validCandidate,
    verification_status: VERIFICATION_STATUSES.REVIEW_REQUIRED,
  };
  const approval3 = verifier.verifySingleCandidateForApproval(unverifiedCandidate, liveIndex);
  assert.equal(approval3.allowed, false);
  assert.equal(approval3.errorCode, 'APPROVAL_POLICY_VIOLATION');
});

test('candidate review store supports list filtering, isolated state persistence, and audit history', async () => {
  const liveIndex = makeMockIndex();
  let fakeState = {
    schema_version: 1,
    storage_kind: 'isolated_json_review_state',
    mysql_catalog_write_enabled: false,
    updated_at: null,
    reviews: {},
  };

  const sampleReport = {
    checked_at: '2026-11-12',
    candidates: [
      {
        candidate_id: 'cand_1',
        candidate_kind: 'new_model',
        brand: 'samsung',
        model_name: 'Galaxy Z Fold Special Edition',
        domestic_model_number: 'SM-F958N',
        verification_status: VERIFICATION_STATUSES.VERIFIED,
        official_sources: ['https://www.samsung.com/sec/test/'],
        storage_gb: 512,
        color: '블랙 쉐도우',
        duplicate_check: { is_duplicate: false, detail: '중복 없음' },
      },
      {
        candidate_id: 'cand_2',
        candidate_kind: 'new_variant',
        brand: 'samsung',
        model_name: 'Galaxy Z Fold7',
        domestic_model_number: 'SM-F966N',
        target_smartphone_id: '90000129',
        target_parent_review_status: 'approved',
        verification_status: VERIFICATION_STATUSES.REJECTED,
        official_sources: ['https://news.samsung.com/kr/test/'],
        storage_gb: 1024,
        color: '실버 쉐도우',
        duplicate_check: { is_duplicate: false, detail: '중복 없음' },
      },
    ],
  };

  const store = createCandidateReviewStore({
    loadReport: () => sampleReport,
    loadState: () => fakeState,
    saveState: (nextState) => {
      fakeState = nextState;
    },
  });

  const listInitial = await store.listCandidates({ kind: 'new_model' }, liveIndex);
  assert.equal(listInitial.filtered_total, 1);
  assert.equal(listInitial.items[0].candidate_id, 'cand_1');
  assert.equal(listInitial.items[0].admin_review.admin_status, ADMIN_STATUSES.PENDING);

  // Rejection of invalid approval
  await assert.rejects(
    () =>
      store.reviewCandidate({
        candidateId: 'cand_2',
        action: 'approve',
        reason: '비공식 조합 강제 승인 시도',
        adminUser: { id: '1', email: 'admin@example.com' },
        liveIndex,
      }),
    { code: 'APPROVAL_POLICY_VIOLATION' }
  );

  // Successful candidate approval recorded in isolated state
  const reviewResult = await store.reviewCandidate({
    candidateId: 'cand_1',
    action: 'approve',
    reason: '삼성전자 공식 뉴스룸 및 공식 SKU 확인 완료로 후보 승인',
    adminUser: { id: '7', email: 'reviewer@kikirowum.kr' },
    liveIndex,
  });

  assert.equal(reviewResult.candidate.admin_review.admin_status, ADMIN_STATUSES.APPROVED);
  assert.equal(reviewResult.mysql_catalog_write_enabled, false);
  assert.equal(fakeState.reviews.cand_1.admin_status, 'approved');
  assert.equal(fakeState.reviews.cand_1.history.length, 1);
  assert.equal(fakeState.reviews.cand_1.history[0].action, 'approve');

  // Query updated list
  const listAfter = await store.listCandidates({ admin_status: 'approved' }, liveIndex);
  assert.equal(listAfter.filtered_total, 1);
  assert.equal(listAfter.items[0].candidate_id, 'cand_1');
});

test('admin authentication and email allowlist validation work safely', () => {
  const env = { ADMIN_EMAILS: 'admin@kikirowum.kr, super@kikirowum.kr ' };
  const emails = parseAdminEmails(env);
  assert.equal(emails.has('admin@kikirowum.kr'), true);
  assert.equal(emails.has('super@kikirowum.kr'), true);
  assert.equal(isAdminEmail('admin@kikirowum.kr', env), true);
  assert.equal(isAdminEmail(' ADMIN@kikirowum.kr ', env), true);
  assert.equal(isAdminEmail('guest@kikirowum.kr', env), false);
  assert.equal(isAdminEmail('', env), false);
});

test('verify-smartphone-candidates CLI rejects DB write flags', () => {
  assert.throws(() => cli.parseCliArgs(['--apply']), { code: 'PHASE3_READ_ONLY_VIOLATION' });
  assert.throws(() => cli.parseCliArgs(['--write-db']), { code: 'PHASE3_READ_ONLY_VIOLATION' });
});

test('Phase 3 verification report JSON file integrity checks', () => {
  const reportPath = path.resolve(__dirname, '../data/smartphone-verification-report-2026-11-12.json');
  assert.equal(fs.existsSync(reportPath), true);

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.schema_version, 3);
  assert.equal(report.db_write_performed, false);
  assert.equal(report.production_approved, false);
  assert.equal(report.summary.total_candidates, 287);
  assert.equal(report.summary.by_verification_status.VERIFIED, 65);
  assert.equal(report.summary.by_verification_status.REVIEW_REQUIRED, 220);
  assert.equal(report.summary.by_verification_status.REJECTED, 2);
  assert.equal(report.summary.confirmed_kr_sales_options_count, 65);

  const rejectedItems = report.candidates.filter((c) => c.verification_status === 'REJECTED');
  assert.equal(rejectedItems.length, 2);
  for (const item of rejectedItems) {
    assert.equal(item.approval_eligible, false);
    assert.equal(item.verification_reason_code, 'UNRELEASED_STORAGE_COLOR_COMBINATION');
  }
});
