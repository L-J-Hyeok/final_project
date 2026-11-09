'use strict';

const express = require('express');
const { Op, QueryTypes } = require('sequelize');
const connection = require('../db/connection');
const limiterFactory = require('../auth/limiter');
const catalog = require('../services/smartphone-catalog');
const memberVal = require('../services/member-validation');
const validator = require('../services/recommendation-validator');
const aiModule = require('../services/ai-adapter');
const smartphonesRouter = require('./smartphones');

const router = express.Router();
const aiLimiter = limiterFactory();
const activeAiUsers = new Set();
const TOTAL_RECOMMEND_BUDGET_MS = 45000;

let currentAdapter = aiModule.createAiAdapter();

function setAiAdapter(customAdapter) {
  currentAdapter = customAdapter || aiModule.createAiAdapter();
}

function db() {
  return connection.getDatabase();
}

const wrap = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);

// 사용자당 AI 호출 제한: 분당 5회 및 동시 1개 (ARCHITECTURE §1)
function acquireAiSlot(uid) {
  const key = 'ai-user:' + String(uid);
  if (activeAiUsers.has(key)) {
    throw catalog.fail('RATE_LIMITED', 429);
  }
  const releaseRate = aiLimiter.take(key, 5, 60000);
  if (!releaseRate) {
    throw catalog.fail('RATE_LIMITED', 429);
  }
  activeAiUsers.add(key);
  return function releaseConcurrency() {
    activeAiUsers.delete(key);
  };
}

// 서버 기동 시 2분 이상 경과한 processing 상태 이력을 failed로 정리 (자동 재실행 없음, ARCHITECTURE §6.10)
async function cleanupStaleProcessing() {
  const cutoff = new Date(Date.now() - 2 * 60 * 1000);
  await db().models.recommendations.update(
    {
      status: 'failed',
      validation_errors: ['STALE_PROCESSING_CLEANUP']
    },
    {
      where: {
        status: 'processing',
        created_at: { [Op.lte]: cutoff }
      }
    }
  );
}

router.use(['/analysis', '/recommendations'], wrap(async (req, res, next) => {
  if (!req.session || !req.session.user_id) throw catalog.fail('AUTH_REQUIRED', 401);
  const user = await db().models.users.findByPk(req.session.user_id, { attributes: ['id'] });
  if (!user) throw catalog.fail('AUTH_REQUIRED', 401);
  next();
}));

// POST /api/analysis — 자연어 입력 분석 초안 반환 (DB 저장 없음, 원문 로그 금지)
router.post('/analysis', wrap(async (req, res) => {
  const uid = req.session.user_id;
  const input = validator.validateAnalysisInput(req.body);
  const p = await db().models.profiles.findByPk(uid);
  const existingProfile = p
    ? {
        common: p.common_json,
        smartphone: require('./member').stripInternalSmartphoneKeys(p.smartphone_json),
        confirmed_at: p.confirmed_at
      }
    : null;

  const releaseSlot = acquireAiSlot(uid);
  try {
    const aiRes = await currentAdapter.analyze({
      purpose: input.purpose,
      text: input.text,
      existingProfile
    });
    const validated = validator.validateAnalysisOutput(input.purpose, aiRes.output);
    res.json({
      data: {
        draft: validated.draft,
        questions: validated.questions,
        uncertainties: validated.uncertainties,
        ai_meta: {
          model_name: aiRes.model_name,
          prompt_version: currentAdapter.promptVersion || aiModule.PROMPT_VERSION,
          usage: aiRes.usage
        }
      }
    });
  } finally {
    releaseSlot();
  }
}));

// 완료 직전 후보 사양 및 선택 가격의 최신성·유효성 재검증 (변경 시 409 CANDIDATES_CHANGED)
async function verifySnapshotFreshness(candidatesSnapshot, hard, checkTime) {
  const variantIds = candidatesSnapshot.map(c => c.variant_id);
  if (!variantIds.length) return true;

  const rows = await db().query(
    `${smartphonesRouter.VARIANT_JOIN_SQL} WHERE v.id IN (:variantIds)`,
    { replacements: { variantIds }, type: QueryTypes.SELECT }
  );
  const rowMap = new Map(rows.map(r => [String(r.variant_id), r]));
  const priceMap = await smartphonesRouter.fetchPricesByVariantIds(variantIds);

  for (const snap of candidatesSnapshot) {
    const currentRow = rowMap.get(String(snap.variant_id));
    if (!currentRow) return false;
    const obsList = priceMap.get(String(snap.variant_id)) || [];
    const priceSummary = catalog.selectBestPrice(obsList, checkTime);
    const best = priceSummary.selected;
    if (!best || !best.eligible) return false;
    // 선택된 관측 ID 또는 총액이 달라졌으면 CANDIDATES_CHANGED
    if (
      String(best.observation_id) !== String(snap.price.observation_id) ||
      Number(best.total_krw) !== Number(snap.price.total_krw)
    ) {
      return false;
    }
    if (!catalog.matchesHardConditions({ ...currentRow, price: best }, hard, checkTime)) {
      return false;
    }
  }
  return true;
}

// POST /api/recommendations — 후보 검색 -> AI 추천 -> 서버 재검증(최대 1회 수정 재시도) -> 원자적 저장
router.post('/recommendations', wrap(async (req, res) => {
  const uid = req.session.user_id;
  const startedAtMs = Date.now();
  const asOf = new Date(startedAtMs);

  // 1. 기존 후보 검색 로직 재사용 (프로필 확정 여부, 버전, 소유 기기, 필수 조건 검증)
  const searchResult = await smartphonesRouter.searchCandidatesForUser(uid, req.body, asOf);
  const inputSnapshot = {
    expected_profile_version: searchResult.profile_version,
    hard: searchResult.input.hard,
    soft: searchResult.input.soft,
    replacement_device_id: searchResult.input.replacement_device_id,
    purchase_reason: searchResult.input.purchase_reason
  };

  // 2. 후보가 없거나(no_match) 추가 질문이 필요한 경우(clarify) AI를 호출하지 않고 저장 후 즉시 반환
  if (searchResult.status === 'clarify' || searchResult.status === 'no_match') {
    const saved = await db().transaction(async t => {
      const user = await db().models.users.findByPk(uid, { transaction: t, lock: t.LOCK.UPDATE, attributes: ['id'] });
      if (!user) throw catalog.fail('AUTH_REQUIRED', 401);
      const p = await db().models.profiles.findByPk(uid, { transaction: t, lock: t.LOCK.UPDATE });
      if (!p || p.version !== searchResult.profile_version) throw catalog.fail('PROFILE_CHANGED', 409);

      return db().models.recommendations.create({
        user_id: uid,
        status: searchResult.status,
        profile_version: searchResult.profile_version,
        input_snapshot: inputSnapshot,
        candidates_snapshot: [],
        result_json: {
          items: [],
          questions: searchResult.questions
        },
        validation_errors: null,
        model_name: null,
        prompt_version: currentAdapter.promptVersion || aiModule.PROMPT_VERSION,
        as_of: asOf
      }, { transaction: t });
    });

    return res.status(201).json({
      data: {
        id: String(saved.id),
        status: saved.status,
        profile_version: saved.profile_version,
        as_of: asOf.toISOString(),
        items: [],
        questions: searchResult.questions
      }
    });
  }

  // 3. 후보 1~40개: AI 호출 전 processing 레코드 생성 (AI 호출 중에는 DB 트랜잭션을 열어두지 않음)
  const releaseSlot = acquireAiSlot(uid);
  let processingRow = null;
  try {
    processingRow = await db().models.recommendations.create({
      user_id: uid,
      status: 'processing',
      profile_version: searchResult.profile_version,
      input_snapshot: inputSnapshot,
      candidates_snapshot: searchResult.candidates,
      result_json: null,
      validation_errors: null,
      model_name: null,
      prompt_version: currentAdapter.promptVersion || aiModule.PROMPT_VERSION,
      as_of: asOf
    });

    let aiRes = await currentAdapter.recommend({
      aiContext: searchResult.ai_context,
      validationErrorCodes: null
    });
    let check = validator.validateRecommendationOutput(aiRes.output, searchResult.ai_context);
    let totalUsage = { ...(aiRes.usage || { prompt_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0 }) };

    // 4. 스키마/근거 검증 실패 시 오류 코드만 전달해 최대 1회 재시도 (전체 45초 예산 내)
    if (!check.valid) {
      const elapsed = Date.now() - startedAtMs;
      if (elapsed >= TOTAL_RECOMMEND_BUDGET_MS) {
        throw catalog.fail('AI_TIMEOUT', 504);
      }
      const retryRes = await currentAdapter.recommend({
        aiContext: searchResult.ai_context,
        validationErrorCodes: check.errors
      });
      if (retryRes.usage) {
        totalUsage = {
          prompt_tokens: (totalUsage.prompt_tokens || 0) + (retryRes.usage.prompt_tokens || 0),
          output_tokens: (totalUsage.output_tokens || 0) + (retryRes.usage.output_tokens || 0),
          total_tokens: (totalUsage.total_tokens || 0) + (retryRes.usage.total_tokens || 0),
          estimated_cost_usd: Number(((totalUsage.estimated_cost_usd || 0) + (retryRes.usage.estimated_cost_usd || 0)).toFixed(8))
        };
      }
      aiRes = retryRes;
      check = validator.validateRecommendationOutput(aiRes.output, searchResult.ai_context);
    }

    if (!check.valid) {
      // 1회 재시도 후에도 실패하면 failed로 기록하고 502 AI_INVALID_RESULT 반환
      await db().transaction(async t => {
        const user = await db().models.users.findByPk(uid, { transaction: t, lock: t.LOCK.UPDATE, attributes: ['id'] });
        if (!user) return;
        const row = await db().models.recommendations.findOne({
          where: { id: processingRow.id, user_id: uid },
          transaction: t,
          lock: t.LOCK.UPDATE
        });
        if (row) {
          await row.update({
            status: 'failed',
            validation_errors: check.errors,
            model_name: aiRes.model_name || null
          }, { transaction: t });
        }
      });
      throw catalog.fail('AI_INVALID_RESULT', 502);
    }

    // 5. 완료 직전 가격·사양 유효성 및 프로필 버전 재검증
    const finishNow = new Date();
    const stillFresh = await verifySnapshotFreshness(
      searchResult.candidates,
      searchResult.input.hard,
      finishNow
    );
    if (!stillFresh) {
      await db().models.recommendations.destroy({ where: { id: processingRow.id, user_id: uid } });
      throw catalog.fail('CANDIDATES_CHANGED', 409);
    }

    const finalPayload = {
      items: check.result.items,
      questions: check.result.questions,
      keep_reasons: check.result.keep_reasons || [],
      keep_cautions: check.result.keep_cautions || [],
      ai_usage: totalUsage
    };

    await db().transaction(async t => {
      const user = await db().models.users.findByPk(uid, { transaction: t, lock: t.LOCK.UPDATE, attributes: ['id'] });
      if (!user) throw catalog.fail('AUTH_REQUIRED', 401);
      const p = await db().models.profiles.findByPk(uid, { transaction: t, lock: t.LOCK.UPDATE });
      if (!p || p.version !== searchResult.profile_version) {
        await db().models.recommendations.destroy({ where: { id: processingRow.id, user_id: uid }, transaction: t });
        throw catalog.fail('PROFILE_CHANGED', 409);
      }
      const row = await db().models.recommendations.findOne({
        where: { id: processingRow.id, user_id: uid },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!row) throw catalog.fail('PROFILE_CHANGED', 409);

      await row.update({
        status: check.result.status,
        result_json: finalPayload,
        validation_errors: null,
        model_name: aiRes.model_name || null
      }, { transaction: t });
    });

    return res.status(201).json({
      data: {
        id: String(processingRow.id),
        status: check.result.status,
        profile_version: searchResult.profile_version,
        as_of: asOf.toISOString(),
        model_name: aiRes.model_name || null,
        prompt_version: currentAdapter.promptVersion || aiModule.PROMPT_VERSION,
        ai_usage: totalUsage,
        items: check.result.items,
        questions: check.result.questions,
        keep_reasons: check.result.keep_reasons || [],
        keep_cautions: check.result.keep_cautions || []
      }
    });
  } catch (err) {
    if (
      processingRow &&
      !['AI_INVALID_RESULT', 'CANDIDATES_CHANGED', 'PROFILE_CHANGED'].includes(err.code)
    ) {
      try {
        await db().models.recommendations.update(
          { status: 'failed', validation_errors: [err.code || 'INTERNAL_ERROR'] },
          { where: { id: processingRow.id, user_id: uid, status: 'processing' } }
        );
      } catch (_) {
        // ignore secondary cleanup error
      }
    }
    throw err;
  } finally {
    releaseSlot();
  }
}));

// 이력 조회 시 추천 당시의 가격을 보존하되 현재 시점 기준 만료 여부(is_expired_now)를 별도 표시
function formatHistoricalRecommendation(row, now = new Date()) {
  const raw = row.toJSON();
  const nowMs = now.getTime();
  const resultJson = raw.result_json || { items: [], questions: [] };
  const items = Array.isArray(resultJson.items)
    ? resultJson.items.map(item => {
        if (!item.price) return item;
        const expMs = new Date(item.price.expires_at).getTime();
        const isExpiredNow = !Number.isFinite(expMs) || nowMs >= expMs;
        return {
          ...item,
          price: {
            ...item.price,
            is_expired_now: isExpiredNow,
            price_status_note: isExpiredNow
              ? '추천 당시 관측 가격(현재 만료됨)'
              : '추천 당시 관측 가격(유효기간 내)'
          }
        };
      })
    : [];

  return {
    id: String(raw.id),
    status: raw.status,
    profile_version: raw.profile_version,
    as_of: new Date(raw.as_of).toISOString(),
    created_at: new Date(raw.created_at).toISOString(),
    model_name: raw.model_name,
    prompt_version: raw.prompt_version,
    input_snapshot: raw.input_snapshot,
    items,
    questions: Array.isArray(resultJson.questions) ? resultJson.questions : [],
    keep_reasons: Array.isArray(resultJson.keep_reasons) ? resultJson.keep_reasons : [],
    keep_cautions: Array.isArray(resultJson.keep_cautions) ? resultJson.keep_cautions : [],
    ai_usage: resultJson.ai_usage || null
  };
}

// GET /api/recommendations — 본인 추천 이력 목록 조회 (90일 보관 정책 반영)
router.get('/recommendations', wrap(async (req, res) => {
  const uid = req.session.user_id;
  const p = memberVal.pagination(req.query, false);
  const now = new Date();
  const retentionCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // 90일 경과 이력 자동 정리 (ARCHITECTURE §5)
  await db().models.recommendations.destroy({
    where: {
      user_id: uid,
      created_at: { [Op.lt]: retentionCutoff }
    }
  });

  const rows = await db().models.recommendations.findAll({
    where: {
      user_id: uid,
      id: { [Op.gt]: p.cursor }
    },
    order: [['id', 'ASC']],
    limit: p.limit + 1
  });

  const hasMore = rows.length > p.limit;
  const data = rows.slice(0, p.limit).map(r => formatHistoricalRecommendation(r, now));
  res.json({
    data,
    next_cursor: hasMore ? data[data.length - 1].id : null
  });
}));

// GET /api/recommendations/:id — 본인 추천 이력 단건 상세 조회 (당시 근거·가격 및 현재 만료 표시)
router.get('/recommendations/:id', wrap(async (req, res) => {
  catalog.object(req.query, []);
  const id = catalog.id(req.params.id);
  const uid = req.session.user_id;
  const row = await db().models.recommendations.findOne({
    where: { id, user_id: uid }
  });
  if (!row) throw catalog.fail('NOT_FOUND', 404);
  res.json({
    data: formatHistoricalRecommendation(row, new Date())
  });
}));

// DELETE /api/recommendations/:id — 본인 추천 이력 삭제 (타인 이력은 동일 404)
router.delete('/recommendations/:id', wrap(async (req, res) => {
  catalog.object(req.body || {}, []);
  const id = catalog.id(req.params.id);
  const uid = req.session.user_id;
  const deleted = await db().models.recommendations.destroy({
    where: { id, user_id: uid }
  });
  if (!deleted) throw catalog.fail('NOT_FOUND', 404);
  res.status(204).end();
}));

router.setAiAdapter = setAiAdapter;
router.cleanupStaleProcessing = cleanupStaleProcessing;

module.exports = router;
