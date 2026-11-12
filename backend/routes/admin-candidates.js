'use strict';

const express = require('express');
const connection = require('../db/connection');
const { requireAdmin, isIsolatedReviewPersistenceEnabled } = require('../auth/admin');
const discovery = require('../services/smartphone-candidate-discovery');
const { createCandidateReviewStore } = require('../services/smartphone-candidate-review-store');
const registrationService = require('../services/smartphone-candidate-registration');

function fail(status, code, message) {
  return Object.assign(new Error(message || code), { status, code, publicMessage: message });
}

function parseReviewBody(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object') {
    throw fail(422, 'INVALID_INPUT', '요청 본문 형식이 올바르지 않습니다.');
  }
  const keys = Object.keys(body);
  for (const key of keys) {
    if (key !== 'action' && key !== 'reason') {
      throw fail(422, 'INVALID_INPUT', '허용되지 않은 입력 필드가 포함되어 있습니다.');
    }
  }
  if (typeof body.action !== 'string' || typeof body.reason !== 'string') {
    throw fail(422, 'INVALID_INPUT', 'action과 reason을 문자열로 입력해 주세요.');
  }
  return { action: body.action, reason: body.reason };
}

function createAdminCandidatesRouter(options = {}) {
  const router = express.Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);
  const store = options.reviewStore || createCandidateReviewStore(options);
  const getEnv = options.getEnv || (() => process.env);
  const loadLiveIndex =
    options.loadLiveIndex ||
    (async () => {
      const db = (options.getDatabase || connection.getDatabase)();
      const { index } = await discovery.loadExistingInventoryFromDb(db);
      return index;
    });

  const adminGuard = requireAdmin({
    getDatabase: options.getDatabase,
    getEnv,
  });

  router.use(adminGuard);

  router.get('/session', wrap(async (req, res) => {
    const env = getEnv();
    const persistenceEnabled = isIsolatedReviewPersistenceEnabled(env, options);
    res.json({
      data: {
        admin: true,
        user: req.adminUser,
        review_persistence_enabled: persistenceEnabled,
        review_persistence_mode: persistenceEnabled ? 'isolated_json_store' : 'read_only_disabled',
        mysql_catalog_write_enabled: false,
      },
    });
  }));

  router.get('/candidates', wrap(async (req, res) => {
    const liveIndex = await loadLiveIndex();
    const result = await store.listCandidates(
      {
        kind: typeof req.query.kind === 'string' ? req.query.kind : 'all',
        brand: typeof req.query.brand === 'string' ? req.query.brand : 'all',
        verification_status:
          typeof req.query.verification_status === 'string' ? req.query.verification_status : 'all',
        admin_status: typeof req.query.admin_status === 'string' ? req.query.admin_status : 'all',
        registration_status:
          typeof req.query.registration_status === 'string' ? req.query.registration_status : 'all',
        q: typeof req.query.q === 'string' ? req.query.q : '',
        limit: req.query.limit,
        offset: req.query.offset,
      },
      liveIndex
    );

    const items = (result.items || []).map((item) => {
      const parent = item.target_smartphone_id ? liveIndex?.byId.get(Number(item.target_smartphone_id)) : null;
      return {
        ...item,
        registration_readiness: registrationService.evaluateRegistrationReadiness(item, parent),
      };
    });

    res.json({
      data: {
        ...result,
        items,
      },
    });
  }));

  router.get('/candidates/:candidateId', wrap(async (req, res) => {
    const liveIndex = await loadLiveIndex();
    const item = await store.getCandidateById(req.params.candidateId, liveIndex);
    if (!item) {
      throw fail(404, 'NOT_FOUND', '후보 항목을 찾을 수 없습니다.');
    }
    const parent = item.target_smartphone_id ? liveIndex?.byId.get(Number(item.target_smartphone_id)) : null;
    const readiness = registrationService.evaluateRegistrationReadiness(item, parent);

    res.json({
      data: {
        candidate: {
          ...item,
          registration_readiness: readiness,
        },
        mysql_catalog_write_enabled: false,
      },
    });
  }));

  router.post('/candidates/:candidateId/review', wrap(async (req, res) => {
    const env = getEnv();
    if (!isIsolatedReviewPersistenceEnabled(env, options)) {
      throw fail(
        403,
        'ADMIN_REVIEW_DISABLED',
        '운영 환경에서는 별도 승인 전까지 후보 검수 상태 저장이 비활성화되어 있습니다.'
      );
    }

    const input = parseReviewBody(req.body);
    const liveIndex = await loadLiveIndex();
    const result = await store.reviewCandidate({
      candidateId: req.params.candidateId,
      action: input.action,
      reason: input.reason,
      adminUser: req.adminUser,
      liveIndex,
    });

    res.json({ data: result });
  }));

  router.post('/candidates/:candidateId/register', wrap(async (req, res) => {
    const env = getEnv();
    if (!isIsolatedReviewPersistenceEnabled(env, options)) {
      throw fail(
        403,
        'ADMIN_REGISTRATION_DISABLED',
        '운영 환경에서는 별도 승인 전까지 후보 등록이 비활성화되어 있습니다.'
      );
    }

    const db = (options.getDatabase || connection.getDatabase)();
    const result = await registrationService.registerApprovedCandidate({
      candidateId: req.params.candidateId,
      adminUser: req.adminUser,
      db,
      reviewStore: store,
      dryRun: Boolean(req.body && req.body.dry_run),
    });

    res.json({ data: result });
  }));

  return router;
}

module.exports = createAdminCandidatesRouter;
