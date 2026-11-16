'use strict';

const express = require('express');
const { Op, QueryTypes } = require('sequelize');
const connection = require('../db/connection');
const limiterFactory = require('../auth/limiter');
const catalog = require('../services/smartphone-catalog');
const pricePreview = require('../services/smartphone-price-preview');
const memberVal = require('../services/member-validation');
const validator = require('../services/recommendation-validator');
const performance = require('../services/smartphone-performance');
const externalPerformance = require('../services/external-performance');
const ranker = require('../services/recommendation-ranker');
const aiModule = require('../services/ai-adapter');
const smartphonesRouter = require('./smartphones');
const conversation = require('../services/recommendation-conversation');
const catalogEngine = require('../services/catalog-recommendation-engine');
const catalogUpgradeAdvisor = require('../services/catalog-upgrade-advisor');

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

router.use(['/analysis', '/recommendations', '/catalog'], wrap(async (req, res, next) => {
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
      category: input.category || null,
      existingProfile
    });
    const validated = validator.validateAnalysisOutput(input.purpose, aiRes.output, input.text, input.category || null);
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
    `${smartphonesRouter.VARIANT_JOIN_SQL} WHERE v.id IN (:variantIds) AND ${await smartphonesRouter.publicationWhere()}`,
    { replacements: { variantIds }, type: QueryTypes.SELECT }
  );
  const rowMap = new Map(rows.map(r => [String(r.variant_id), r]));
  const priceMap = await smartphonesRouter.fetchPricesByVariantIds(variantIds, undefined, { commonOnly: true });

  for (const snap of candidatesSnapshot) {
    const currentRow = rowMap.get(String(snap.variant_id));
    if (!currentRow) return false;
    // Reject stale specification evidence, even if a changed spec still meets the hard filter.
    const numericFields = ['screen_inches','refresh_hz','battery_mah','weight_g','storage_gb','ram_gb'];
    const booleanFields = ['supports_5g','wireless_charging'];
    for (const key of ['smartphone_id','brand','model_name','domestic_model_number','released_on_kr','os','chipset','color',...numericFields,...booleanFields]) {
      const normalize = value => value == null ? null : numericFields.includes(key) ? Number(value) : booleanFields.includes(key) ? value === true || value === 1 : String(value);
      if (normalize(currentRow[key]) !== normalize(snap[key])) return false;
    }
    const obsList = priceMap.get(String(snap.variant_id)) || [];
    const priceSummary = pricePreview.buildCandidatePriceObject(currentRow, obsList, process.env, checkTime);
    const best = priceSummary.selected;
    const bestBasis = catalog.effectiveBudgetPriceKrw(best, checkTime);
    if (bestBasis === null) return false;

    const snapObsId = snap.price.observation_id === null || snap.price.observation_id === undefined
      ? null
      : String(snap.price.observation_id);
    const bestObsId = best.observation_id === null || best.observation_id === undefined
      ? null
      : String(best.observation_id);
    const snapBasis = catalog.effectiveBudgetPriceKrw(snap.price, checkTime);
    const snapSource = snap.price.price_source || 'verified_sale';
    const bestSource = best.price_source || 'verified_sale';

    // 선택된 관측 ID, 가격 출처, 또는 예산 산정 기준 금액이 달라졌으면 CANDIDATES_CHANGED
    if (
      snapBasis === null ||
      bestObsId !== snapObsId ||
      bestSource !== snapSource ||
      Number(bestBasis) !== Number(snapBasis)
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
async function runRecommendation(uid, body, send, { conversational = false } = {}) {
  const startedAtMs = Date.now();
  const asOf = new Date(startedAtMs);

  // 1. 기존 후보 검색 로직 재사용 (프로필 확정 여부, 버전, 소유 기기, 필수 조건 검증)
  const searchResult = await smartphonesRouter.searchCandidatesForUser(uid, body, asOf, { allowBudgetlessKeep: conversational });
  // Reuse owner-scoped catalog context; missing/no-match paths still need the
  // selected owned device to make a conservative keep/defer decision.
  let upgradeDecision = null;
  let upgradeContext = searchResult.ai_context;
  const ownedProduct = upgradeContext?.replacement_device?.product;
  const evidenceTargets = [...searchResult.candidates, ...(ownedProduct?.verified ? [ownedProduct] : [])];
  const performanceMeasurements = await performance.loadVerified(db(), evidenceTargets);
  const external = await externalPerformance.loadExternalPerformance({
    category: 'smartphone', products: searchResult.candidates.length ? evidenceTargets : [],
    priorityProduct: ownedProduct,
    metrics: externalPerformance.requestedMetrics(upgradeContext?.purchase_conditions, upgradeContext?.profile_snapshot),
    authorize: () => aiLimiter.take('performance-user:' + uid, 2, 60000) &&
      aiLimiter.take('performance-global', 20, 60000),
    canReadUrls: currentAdapter.supportsPerformanceUrls?.bind(currentAdapter),
    readUrls: currentAdapter.readPerformanceUrls?.bind(currentAdapter)
  });
  const rankingMeasurements = [...performanceMeasurements, ...external.measurements];
  if (searchResult.input.replacement_device_id) {
    if (!upgradeContext) {
      const owned = await db().models.owned_devices.findOne({ where: { id: searchResult.input.replacement_device_id, user_id: uid } });
      if (!owned) throw catalog.fail('NOT_FOUND', 404);
      const device = owned.toJSON();
      let product = null;
      if (device.variant_id) {
        const rows = await db().query(`SELECT CAST(v.id AS CHAR) AS variant_id,CAST(s.id AS CHAR) AS smartphone_id,s.model_name,s.os,s.brand,s.chipset,s.screen_inches,s.refresh_hz,s.weight_g,s.battery_mah,s.supports_5g,s.wireless_charging,v.storage_gb,v.ram_gb,v.color,(s.verified AND v.verified) verified FROM smartphone_variants v JOIN smartphones s ON s.id=v.smartphone_id WHERE v.id=:id`, { replacements: { id: device.variant_id }, type: QueryTypes.SELECT });
        product = rows[0] || null;
      }
      upgradeContext = { replacement_device: { id: String(device.id), category: device.category, source: device.variant_id ? 'catalog' : 'manual', product }, purchase_conditions: { hard: searchResult.input.hard, soft: searchResult.input.soft, purchase_reason: searchResult.input.purchase_reason, upgrade_context: searchResult.input.upgrade_context }, candidates_snapshot: searchResult.candidates || [] };
    }
    const advisor = require('../services/upgrade-advisor');
    const hasHardClarify = Array.isArray(searchResult.input?.clarify_questions) && searchResult.input.clarify_questions.length > 0;
    if (!hasHardClarify) {
      upgradeDecision = rankingMeasurements.length
        ? advisor.evaluateUpgradeDecision({ ...upgradeContext, performanceMeasurements: rankingMeasurements })
        : searchResult.upgrade_decision || advisor.evaluateUpgradeDecision(upgradeContext);
    }
    if (upgradeDecision?.status === 'recommend' && searchResult.ai_context) {
      searchResult.candidates = searchResult.candidates.filter(c => upgradeDecision.eligible_variant_ids.includes(String(c.variant_id)));
      searchResult.ai_context.candidates_snapshot = searchResult.candidates;
      searchResult.ai_context.upgrade_decision = upgradeDecision;
    }
  }
  const ownedVariantId = upgradeContext?.replacement_device?.product?.variant_id
    ? String(upgradeContext.replacement_device.product.variant_id)
    : null;
  const inputSnapshot = {
    expected_profile_version: searchResult.profile_version,
    hard: searchResult.input.hard,
    soft: searchResult.input.soft,
    replacement_device_id: searchResult.input.replacement_device_id,
    upgrade_context: searchResult.input.upgrade_context,
    owned_device_snapshot: upgradeContext?.replacement_device || null,
    purchase_reason: searchResult.input.purchase_reason
  };

  // 2. 후보가 없거나(no_match) 추가 질문이 필요한 경우(clarify) AI를 호출하지 않고 저장 후 즉시 반환
  if (searchResult.status === 'clarify' || searchResult.status === 'no_match' || (upgradeDecision && upgradeDecision.status !== 'recommend')) {
    const status = upgradeDecision?.status || searchResult.status;
    const questions = upgradeDecision?.questions || searchResult.questions;
    if (conversational && status === 'clarify') {
      return send(200, { data: { status, questions, items: [], owned_variant_id: ownedVariantId } });
    }
    const reasons = upgradeDecision?.reasons || [];
    const cautions = status === 'keep' ? (searchResult.keep_current_evaluation?.cautions || []) : [];
    const saved = await db().transaction(async t => {
      const user = await db().models.users.findByPk(uid, { transaction: t, lock: t.LOCK.UPDATE, attributes: ['id'] });
      if (!user) throw catalog.fail('AUTH_REQUIRED', 401);
      const p = await db().models.profiles.findByPk(uid, { transaction: t, lock: t.LOCK.UPDATE });
      if (!p || p.version !== searchResult.profile_version) throw catalog.fail('PROFILE_CHANGED', 409);

      return db().models.recommendations.create({
        user_id: uid,
        status,
        profile_version: searchResult.profile_version,
        input_snapshot: inputSnapshot,
        candidates_snapshot: [],
        result_json: {
          items: [],
          questions,
          keep_reasons: reasons,
          keep_cautions: cautions
        },
        validation_errors: null,
        model_name: null,
        prompt_version: currentAdapter.promptVersion || aiModule.PROMPT_VERSION,
        as_of: asOf
      }, { transaction: t });
    });

    return send(201, {
      data: {
        id: String(saved.id),
        status: saved.status,
        profile_version: saved.profile_version,
        as_of: asOf.toISOString(),
        owned_variant_id: ownedVariantId,
        items: [],
        questions,
        keep_reasons: reasons,
        keep_cautions: cautions
      }
    });
  }

  // 3. 전체 적격 후보: 로컬 가중치 엔진으로 최종 순위 확정 후 AI 설명 생성 (실패 시 서버 폴백 설명)
  const rankingResult = ranker.rankSmartphoneCandidates({
    candidates: searchResult.candidates,
    profile: searchResult.ai_context.profile_snapshot,
    purchaseConditions: searchResult.ai_context.purchase_conditions,
    upgradeDecision,
    performanceMeasurements: rankingMeasurements,
    now: asOf
  });

  if (rankingResult.status === 'no_match' || rankingResult.top_candidates.length === 0) {
    const questions = catalog.buildRelaxationQuestions(searchResult.input.hard);
    const saved = await db().transaction(async t => {
      const user = await db().models.users.findByPk(uid, { transaction: t, lock: t.LOCK.UPDATE, attributes: ['id'] });
      if (!user) throw catalog.fail('AUTH_REQUIRED', 401);
      const p = await db().models.profiles.findByPk(uid, { transaction: t, lock: t.LOCK.UPDATE });
      if (!p || p.version !== searchResult.profile_version) throw catalog.fail('PROFILE_CHANGED', 409);

      return db().models.recommendations.create({
        user_id: uid,
        status: 'no_match',
        profile_version: searchResult.profile_version,
        input_snapshot: inputSnapshot,
        candidates_snapshot: [],
        result_json: {
          items: [],
          questions,
          keep_reasons: [],
          keep_cautions: [],
          ranking_policy_version: rankingResult.policy_version
        },
        validation_errors: null,
        model_name: null,
        prompt_version: currentAdapter.promptVersion || aiModule.PROMPT_VERSION,
        as_of: asOf
      }, { transaction: t });
    });

    return send(201, {
      data: {
        id: String(saved.id),
        status: saved.status,
        profile_version: saved.profile_version,
        as_of: asOf.toISOString(),
        owned_variant_id: ownedVariantId,
        ranking_policy_version: rankingResult.policy_version,
        items: [],
        questions,
        keep_reasons: [],
        keep_cautions: []
      }
    });
  }

  const representatives = rankingResult.top_candidates.map(entry => entry.candidate);
  searchResult.ai_context.candidates_snapshot = representatives;
  searchResult.ai_context.server_ranking = {
    policy_version: rankingResult.policy_version,
    items: rankingResult.public_ranking
  };

  const releaseSlot = acquireAiSlot(uid);
  let processingRow = null;
  try {
    processingRow = await db().models.recommendations.create({
      user_id: uid,
      status: 'processing',
      profile_version: searchResult.profile_version,
      input_snapshot: inputSnapshot,
      candidates_snapshot: representatives,
      result_json: null,
      validation_errors: null,
      model_name: null,
      prompt_version: currentAdapter.promptVersion || aiModule.PROMPT_VERSION,
      as_of: asOf
    });

    let aiRes = null;
    let check = null;
    let totalUsage = { prompt_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0 };
    let explanationSource = 'ai';
    let aiFallbackReason = null;

    const remainingMs = () => TOTAL_RECOMMEND_BUDGET_MS - (Date.now() - startedAtMs);
    const explain = validationErrorCodes => currentAdapter.recommend({
      aiContext: searchResult.ai_context,
      validationErrorCodes,
      signal: AbortSignal.timeout(Math.max(0, remainingMs()))
    });
    try {
      if (external.providerThrottled) throw catalog.fail('RATE_LIMITED', 429);
      if (remainingMs() <= 0) throw catalog.fail('AI_TIMEOUT', 504);
      aiRes = await explain(null);
      check = validator.validateRecommendationOutput(aiRes.output, searchResult.ai_context);
      if (aiRes.usage) {
        totalUsage = { ...totalUsage, ...aiRes.usage };
      }

      // 4. 스키마/근거/순위 검증 실패 시 오류 코드만 전달해 최대 1회 재시도 (전체 45초 예산 내)
      if (!check.valid) {
        if (remainingMs() > 0) {
          const retryRes = await explain(check.errors);
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
        } else {
          aiFallbackReason = 'AI_TIMEOUT';
        }
      }
    } catch (aiErr) {
      if (aiErr?.code === 'INVALID_INPUT') {
        throw aiErr;
      }
      aiFallbackReason = aiErr?.code || 'AI_UNAVAILABLE';
    }

    if (!check || !check.valid) {
      if (!aiFallbackReason) {
        const schemaError = /^(OUTPUT_NOT_OBJECT|INVALID_STATUS|INVALID_ITEMS_COUNT|ITEM_SCHEMA_MISMATCH|ITEM_\d+_NOT_OBJECT|EMPTY_PROFILE_REFS|EMPTY_REASONS|EMPTY_EVIDENCE|INVALID_EVIDENCE_ENTRY)/;
        aiFallbackReason = check?.errors?.some(error => schemaError.test(error))
          ? 'AI_RESPONSE_SCHEMA_MISMATCH' : 'AI_EVIDENCE_REJECTED';
      }
      const fallbackOutput = ranker.buildFallbackRecommendationOutput(rankingResult, searchResult.ai_context);
      const fallbackCheck = validator.validateRecommendationOutput(fallbackOutput, searchResult.ai_context, { trustedExplanation: true });
      if (!fallbackCheck.valid) {
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
              validation_errors: fallbackCheck.errors,
              model_name: aiRes?.model_name || null
            }, { transaction: t });
          }
        });
        throw catalog.fail('AI_INVALID_RESULT', 502);
      }
      check = fallbackCheck;
      explanationSource = 'server_fallback';
      aiRes = {
        model_name: 'local-ranker-fallback',
        usage: totalUsage
      };
    }

    // 5. 완료 직전 가격·사양 유효성 및 프로필 버전 재검증
    const finishNow = new Date();
    const stillFresh = await verifySnapshotFreshness(
      representatives,
      searchResult.input.hard,
      finishNow
    );
    if (!stillFresh) {
      await db().models.recommendations.destroy({ where: { id: processingRow.id, user_id: uid } });
      throw catalog.fail('CANDIDATES_CHANGED', 409);
    }

    if (
      check.result.status === 'recommend' &&
      Array.isArray(upgradeDecision?.unverified_cautions) &&
      upgradeDecision.unverified_cautions.length
    ) {
      for (const item of check.result.items) {
        if (!Array.isArray(item.uncertainties)) item.uncertainties = [];
        for (const rawCaution of upgradeDecision.unverified_cautions) {
          const caution = typeof rawCaution === 'string' ? rawCaution.trim().slice(0, 300) : '';
          if (caution && !item.uncertainties.includes(caution)) {
            item.uncertainties.push(caution);
          }
        }
      }
    }

    const configurationRows = await db().query(
      `${smartphonesRouter.VARIANT_JOIN_SQL}
       WHERE s.id IN (:modelIds) AND ${await smartphonesRouter.publicationWhere()}`,
      { replacements: { modelIds: representatives.map(candidate => candidate.smartphone_id) }, type: QueryTypes.SELECT }
    );
    const ownedProduct = upgradeContext?.replacement_device?.product;
    const evidence = performanceMeasurements;
    const items = check.result.items.map(item => {
      const entry = rankingResult.top_candidates.find(({ candidate }) => String(candidate.variant_id) === String(item.variant_id));
      if (!entry) return item;
      const candidate = entry.candidate;
      const colors = new Map();
      const addColor = row => {
        if (row.color && !colors.has(row.color)) {
          colors.set(row.color, { color: row.color, variant_id: String(row.variant_id) });
        }
      };
      addColor(candidate);
      for (const row of candidate.ram_gb == null ? [] : configurationRows) {
        if (String(row.smartphone_id) === String(candidate.smartphone_id) &&
            row.domestic_model_number === candidate.domestic_model_number &&
            Number(row.storage_gb) === Number(candidate.storage_gb) &&
            (row.ram_gb == null ? null : Number(row.ram_gb)) ===
              (candidate.ram_gb == null ? null : Number(candidate.ram_gb))) {
          addColor(row);
        }
      }
      return {
        ...item,
        ...(Object.keys(candidate.camera_specs || {}).length ? { performance_specifications: { camera: candidate.camera_specs } } : {}),
        ...(evidence.length ? {
          performance_evidence: performance.summarizeMeasurements(evidence, candidate),
          ...(ownedProduct?.verified ? {
            performance_comparison: performance.compareMeasurements(evidence, ownedProduct, candidate)
          } : {})
        } : {}),
        representative_variant_id: String(candidate.variant_id),
        recommendation_score: Number((entry._internal_score * 100).toFixed(2)),
        color_options: [...colors.values()]
      };
    });

    const finalPayload = {
      items,
      questions: check.result.questions,
      keep_reasons: check.result.keep_reasons || [],
      keep_cautions: check.result.keep_cautions || [],
      ranking_policy_version: rankingResult.policy_version,
      explanation_source: explanationSource,
      ...(aiFallbackReason ? { ai_fallback_reason: aiFallbackReason } : {}),
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

    const responseItems = external.measurements.length ? items.map(item => {
      const product = representatives.find(candidate => String(candidate.variant_id) === String(item.variant_id));
      if (!product) return item;
      return { ...item,
        performance_evidence: performance.summarizeMeasurements(rankingMeasurements, product),
        ...(ownedProduct?.verified ? {
          performance_comparison: performance.compareMeasurements(rankingMeasurements, ownedProduct, product)
        } : {})
      };
    }) : items;
    return send(201, {
      data: {
        id: String(processingRow.id),
        status: check.result.status,
        profile_version: searchResult.profile_version,
        as_of: asOf.toISOString(),
        owned_variant_id: ownedVariantId,
        model_name: aiRes.model_name || null,
        prompt_version: currentAdapter.promptVersion || aiModule.PROMPT_VERSION,
        ranking_policy_version: rankingResult.policy_version,
        explanation_source: explanationSource,
        ...(aiFallbackReason ? { ai_fallback_reason: aiFallbackReason } : {}),
        ai_usage: totalUsage,
        performance_source_status: external.status,
        items: responseItems,
        questions: check.result.questions,
        keep_reasons: check.result.keep_reasons || [],
        keep_cautions: check.result.keep_cautions || []
      }
    }, items);
  } catch (err) {
    if (
      processingRow &&
      !['AI_INVALID_RESULT', 'CANDIDATES_CHANGED'].includes(err.code)
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
}

// 공통 카탈로그(태블릿·노트북·스마트워치·무선이어폰·스피커) 후보 사양 및 가격 최신성 재검증
async function verifyCatalogSnapshotFreshness(representatives, category, hard) {
  if (!representatives.length) return true;
  const { allCandidates } = await catalogEngine.fetchPublicCatalogCandidates(db(), category, 'KRW');
  const currentMap = new Map(allCandidates.map(c => [String(c.sku_id), c]));

  for (const snap of representatives) {
    const current = currentMap.get(String(snap.sku_id));
    if (!current) return false;
    if (
      String(current.model_id) !== String(snap.model_id) ||
      current.brand !== snap.brand ||
      current.model_name !== snap.model_name ||
      current.model_number !== snap.model_number ||
      current.storage_gb !== snap.storage_gb ||
      current.ram_gb !== snap.ram_gb
    ) {
      return false;
    }
    if (!current.price || !snap.price) return false;
    if (
      String(current.price.observation_id) !== String(snap.price.observation_id) ||
      Number(current.price.amount_krw) !== Number(snap.price.amount_krw)
    ) {
      return false;
    }
    const check = catalogEngine.checkHardEligibility(current, hard);
    if (!check.eligible) return false;
  }
  return true;
}

function buildOwnedDeviceSnapshot(ownedResolution) {
  if (!ownedResolution) return null;
  const dev = ownedResolution.owned_device || {};
  const prod = ownedResolution.product || null;
  return {
    id: String(dev.id),
    category: ownedResolution.owned_category || dev.category,
    source: dev.source,
    identification_status: ownedResolution.identification_status,
    manual_brand: dev.manual_brand || null,
    manual_model_name: dev.manual_model_name || null,
    manual_model_number: dev.manual_model_number || null,
    purchase_info: dev.purchase_info || null,
    user_context: dev.user_context || null,
    product: prod ? {
      category: prod.category,
      model_id: prod.model_id,
      sku_id: prod.sku_id,
      sku_code: prod.sku_code,
      brand: prod.brand,
      model_name: prod.model_name,
      model_number: prod.model_number,
      storage_gb: prod.storage_gb,
      ram_gb: prod.ram_gb,
      color: prod.color,
      connectivity: prod.connectivity,
      weight_g: prod.weight_g,
      specifications: prod.specifications,
      verified: prod.verified,
      current_reference_price: prod.current_reference_price || null
    } : null
  };
}

async function searchCatalogCandidatesForUser(uid, rawBody, defaultCategory = null) {
  const input = catalogEngine.validateCatalogRecommendationInput(rawBody, defaultCategory);
  const p = await db().models.profiles.findByPk(uid);
  if (!p || !p.confirmed_at || !p.common_json || !Array.isArray(p.common_json.usages) || !p.common_json.usages.length || !p.common_json.spending_style) {
    throw catalog.fail('PROFILE_INCOMPLETE', 409);
  }
  if (p.version !== input.expected_profile_version) {
    throw catalog.fail('PROFILE_CHANGED', 409);
  }

  const { allCandidates, priceAvailability } = await catalogEngine.fetchPublicCatalogCandidates(db(), input.category, 'KRW');

  let ownedResolution = null;
  let ownedDeviceSnapshot = null;
  if (input.replacement_device_id) {
    ownedResolution = await catalogUpgradeAdvisor.resolveAndIdentifyOwnedDevice(
      db(),
      uid,
      input.replacement_device_id,
      input.category,
      allCandidates
    );
    ownedDeviceSnapshot = buildOwnedDeviceSnapshot(ownedResolution);
  }

  if (input.clarify_questions.length > 0) {
    return {
      status: 'clarify',
      ...(ownedResolution ? { upgrade_decision: 'CLARIFY', owned_device: ownedDeviceSnapshot } : {}),
      category: input.category,
      profile_version: p.version,
      input,
      candidates: [],
      questions: input.clarify_questions,
      price_availability: priceAvailability
    };
  }

  const profileSnapshot = {
    version: p.version,
    common: p.common_json,
    smartphone: require('./member').stripInternalSmartphoneKeys(p.smartphone_json)
  };
  const purchaseConditions = {
    category: input.category,
    hard: input.hard,
    soft: input.soft,
    purchase_reason: input.purchase_reason,
    upgrade_context: input.upgrade_context
  };
  let rankingResult = catalogEngine.rankCatalogCandidates({
    category: input.category,
    candidates: allCandidates,
    profile: profileSnapshot,
    purchaseConditions
  });

  if (ownedResolution) {
    const upgradeDecision = catalogUpgradeAdvisor.evaluateCatalogUpgradeDecision({
      category: input.category,
      ownedResolution,
      upgradeContext: input.upgrade_context,
      purchaseReason: input.purchase_reason,
      hard: input.hard,
      soft: input.soft,
      rankedCandidates: rankingResult.ranked_candidates,
      excludedCandidates: rankingResult.excluded_candidates
    });

    if (upgradeDecision.status !== 'recommend') {
      return {
        status: upgradeDecision.status,
        upgrade_decision: upgradeDecision.upgrade_decision,
        category: input.category,
        profile_version: p.version,
        input,
        owned_device: ownedDeviceSnapshot,
        upgrade_result: upgradeDecision,
        all_candidates: allCandidates,
        candidates: [],
        ranking_result: rankingResult,
        questions: upgradeDecision.questions || [],
        price_availability: priceAvailability
      };
    }

    const eligibleSet = new Set(upgradeDecision.eligible_sku_ids.map(String));
    const improvingCandidates = allCandidates
      .filter(c => eligibleSet.has(String(c.sku_id)))
      .map(c => ({
        ...c,
        comparison_with_owned: upgradeDecision.comparisons_by_sku_id.get(String(c.sku_id)) || null
      }));

    rankingResult = catalogEngine.rankCatalogCandidates({
      category: input.category,
      candidates: improvingCandidates,
      profile: profileSnapshot,
      purchaseConditions
    });

    return {
      status: 'ready',
      upgrade_decision: 'REPLACE',
      category: input.category,
      profile_version: p.version,
      input,
      owned_device: ownedDeviceSnapshot,
      upgrade_result: upgradeDecision,
      profile_snapshot: profileSnapshot,
      purchase_conditions: purchaseConditions,
      all_candidates: allCandidates,
      candidates: rankingResult.ranked_candidates.map(e => e.candidate),
      ranking_result: rankingResult,
      questions: [],
      price_availability: priceAvailability
    };
  }

  if (rankingResult.status === 'no_match' || rankingResult.top_candidates.length === 0) {
    return {
      status: 'no_match',
      category: input.category,
      profile_version: p.version,
      input,
      all_candidates: allCandidates,
      candidates: [],
      ranking_result: rankingResult,
      questions: catalogEngine.buildCatalogRelaxationQuestions(input.category, input.hard),
      price_availability: priceAvailability
    };
  }

  return {
    status: 'ready',
    category: input.category,
    profile_version: p.version,
    input,
    profile_snapshot: profileSnapshot,
    purchase_conditions: purchaseConditions,
    all_candidates: allCandidates,
    candidates: rankingResult.ranked_candidates.map(e => e.candidate),
    ranking_result: rankingResult,
    questions: [],
    price_availability: priceAvailability
  };
}

async function runCatalogRecommendation(uid, rawBody, send, { defaultCategory = null } = {}) {
  const startedAtMs = Date.now();
  const asOf = new Date(startedAtMs);

  const searchResult = await searchCatalogCandidatesForUser(uid, rawBody, defaultCategory);
  const inputSnapshot = {
    category: searchResult.category,
    expected_profile_version: searchResult.profile_version,
    hard: searchResult.input.hard,
    soft: searchResult.input.soft,
    replacement_device_id: searchResult.input.replacement_device_id,
    upgrade_context: searchResult.input.upgrade_context || null,
    owned_device_snapshot: searchResult.owned_device || null,
    purchase_reason: searchResult.input.purchase_reason
  };

  if (['clarify', 'no_match', 'keep', 'defer'].includes(searchResult.status)) {
    const status = searchResult.status;
    const questions = searchResult.questions || [];
    const policyVersion = searchResult.ranking_result?.policy_version || catalogEngine.POLICY_VERSIONS[searchResult.category];
    const reasons = searchResult.upgrade_result?.reasons || [];
    const cautions = searchResult.upgrade_result?.cautions || [];
    const upgradeDecisionCode = searchResult.upgrade_decision || null;

    const saved = await db().transaction(async t => {
      const user = await db().models.users.findByPk(uid, { transaction: t, lock: t.LOCK.UPDATE, attributes: ['id'] });
      if (!user) throw catalog.fail('AUTH_REQUIRED', 401);
      const p = await db().models.profiles.findByPk(uid, { transaction: t, lock: t.LOCK.UPDATE });
      if (!p || p.version !== searchResult.profile_version) throw catalog.fail('PROFILE_CHANGED', 409);

      return db().models.recommendations.create({
        user_id: uid,
        status,
        profile_version: searchResult.profile_version,
        input_snapshot: inputSnapshot,
        candidates_snapshot: [],
        result_json: {
          category: searchResult.category,
          ...(upgradeDecisionCode ? { upgrade_decision: upgradeDecisionCode } : {}),
          ...(searchResult.owned_device ? { owned_device: searchResult.owned_device } : {}),
          items: [],
          questions,
          decision_reasons: reasons,
          keep_reasons: reasons,
          keep_cautions: cautions,
          ranking_policy_version: policyVersion,
          price_availability: searchResult.price_availability
        },
        validation_errors: null,
        model_name: null,
        prompt_version: currentAdapter.promptVersion || aiModule.PROMPT_VERSION,
        as_of: asOf
      }, { transaction: t });
    });

    return send(201, {
      data: {
        id: String(saved.id),
        category: searchResult.category,
        status: saved.status,
        ...(upgradeDecisionCode ? { upgrade_decision: upgradeDecisionCode } : {}),
        ...(searchResult.owned_device ? { owned_device: searchResult.owned_device } : {}),
        profile_version: saved.profile_version,
        as_of: asOf.toISOString(),
        ranking_policy_version: policyVersion,
        price_availability: searchResult.price_availability,
        items: [],
        questions,
        decision_reasons: reasons,
        keep_reasons: reasons,
        keep_cautions: cautions
      }
    });
  }

  const rankingResult = searchResult.ranking_result;
  const representatives = rankingResult.top_candidates.map(entry => entry.candidate);
  const aiContext = {
    category: searchResult.category,
    profile_snapshot: searchResult.profile_snapshot,
    purchase_conditions: searchResult.purchase_conditions,
    candidates_snapshot: representatives,
    server_ranking: {
      policy_version: rankingResult.policy_version,
      items: rankingResult.public_ranking
    }
  };

  const releaseSlot = acquireAiSlot(uid);
  let processingRow = null;
  try {
    processingRow = await db().models.recommendations.create({
      user_id: uid,
      status: 'processing',
      profile_version: searchResult.profile_version,
      input_snapshot: inputSnapshot,
      candidates_snapshot: representatives,
      result_json: null,
      validation_errors: null,
      model_name: null,
      prompt_version: currentAdapter.promptVersion || aiModule.PROMPT_VERSION,
      as_of: asOf
    });

    let aiRes = null;
    let check = null;
    let totalUsage = { prompt_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0 };
    let explanationSource = 'ai';
    let aiFallbackReason = null;

    const remainingMs = () => TOTAL_RECOMMEND_BUDGET_MS - (Date.now() - startedAtMs);
    const explain = validationErrorCodes => currentAdapter.recommend({
      aiContext,
      validationErrorCodes,
      signal: AbortSignal.timeout(Math.max(0, remainingMs()))
    });

    try {
      if (remainingMs() <= 0) throw catalog.fail('AI_TIMEOUT', 504);
      aiRes = await explain(null);
      check = validator.validateRecommendationOutput(aiRes.output, aiContext);
      if (aiRes.usage) {
        totalUsage = { ...totalUsage, ...aiRes.usage };
      }

      if (!check.valid) {
        if (remainingMs() > 0) {
          const retryRes = await explain(check.errors);
          if (retryRes.usage) {
            totalUsage = {
              prompt_tokens: (totalUsage.prompt_tokens || 0) + (retryRes.usage.prompt_tokens || 0),
              output_tokens: (totalUsage.output_tokens || 0) + (retryRes.usage.output_tokens || 0),
              total_tokens: (totalUsage.total_tokens || 0) + (retryRes.usage.total_tokens || 0),
              estimated_cost_usd: Number(((totalUsage.estimated_cost_usd || 0) + (retryRes.usage.estimated_cost_usd || 0)).toFixed(8))
            };
          }
          aiRes = retryRes;
          check = validator.validateRecommendationOutput(aiRes.output, aiContext);
        } else {
          aiFallbackReason = 'AI_TIMEOUT';
        }
      }
    } catch (aiErr) {
      if (aiErr?.code === 'INVALID_INPUT') {
        throw aiErr;
      }
      aiFallbackReason = aiErr?.code || 'AI_UNAVAILABLE';
    }

    if (!check || !check.valid) {
      if (!aiFallbackReason) {
        const schemaError = /^(OUTPUT_NOT_OBJECT|INVALID_STATUS|INVALID_ITEMS_COUNT|ITEM_SCHEMA_MISMATCH|ITEM_\d+_NOT_OBJECT|EMPTY_PROFILE_REFS|EMPTY_REASONS|EMPTY_EVIDENCE|INVALID_EVIDENCE_ENTRY)/;
        aiFallbackReason = check?.errors?.some(error => schemaError.test(error))
          ? 'AI_RESPONSE_SCHEMA_MISMATCH'
          : 'AI_EVIDENCE_REJECTED';
      }
      const fallbackOutput = catalogEngine.buildCatalogFallbackRecommendationOutput(aiContext);
      const fallbackCheck = validator.validateRecommendationOutput(fallbackOutput, aiContext, { trustedExplanation: true });
      if (!fallbackCheck.valid) {
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
              validation_errors: fallbackCheck.errors,
              model_name: aiRes?.model_name || null
            }, { transaction: t });
          }
        });
        throw catalog.fail('AI_INVALID_RESULT', 502);
      }
      check = fallbackCheck;
      explanationSource = 'server_fallback';
      aiRes = {
        model_name: 'local-ranker-fallback',
        usage: totalUsage
      };
    }

    const stillFresh = await verifyCatalogSnapshotFreshness(
      representatives,
      searchResult.category,
      searchResult.input.hard
    );
    if (!stillFresh) {
      await db().models.recommendations.destroy({ where: { id: processingRow.id, user_id: uid } });
      throw catalog.fail('CANDIDATES_CHANGED', 409);
    }

    const items = catalogEngine.attachColorOptionsToCatalogItems(
      check.result.items,
      searchResult.all_candidates
    );

    const upgradeDecisionCode = searchResult.upgrade_decision || null;
    const decisionReasons = searchResult.upgrade_result?.reasons || [];
    const upgradeCautions = searchResult.upgrade_result?.cautions || [];
    const verifiedImprovements = items[0]?.verified_improvements || [];
    const topLimitations = items[0]?.limitations || [];

    const finalPayload = {
      category: searchResult.category,
      ...(upgradeDecisionCode ? {
        upgrade_decision: upgradeDecisionCode,
        owned_device: searchResult.owned_device || null,
        decision_reasons: decisionReasons,
        verified_improvements: verifiedImprovements,
        limitations: topLimitations
      } : {}),
      items,
      questions: check.result.questions,
      keep_reasons: [],
      keep_cautions: upgradeCautions,
      ranking_policy_version: rankingResult.policy_version,
      price_availability: searchResult.price_availability,
      explanation_source: explanationSource,
      ...(aiFallbackReason ? { ai_fallback_reason: aiFallbackReason } : {}),
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

    return send(201, {
      data: {
        id: String(processingRow.id),
        category: searchResult.category,
        status: check.result.status,
        ...(upgradeDecisionCode ? {
          upgrade_decision: upgradeDecisionCode,
          owned_device: searchResult.owned_device || null,
          decision_reasons: decisionReasons,
          verified_improvements: verifiedImprovements,
          limitations: topLimitations
        } : {}),
        profile_version: searchResult.profile_version,
        as_of: asOf.toISOString(),
        model_name: aiRes.model_name || null,
        prompt_version: currentAdapter.promptVersion || aiModule.PROMPT_VERSION,
        ranking_policy_version: rankingResult.policy_version,
        price_availability: searchResult.price_availability,
        explanation_source: explanationSource,
        ...(aiFallbackReason ? { ai_fallback_reason: aiFallbackReason } : {}),
        ai_usage: totalUsage,
        items,
        questions: check.result.questions,
        keep_reasons: [],
        keep_cautions: upgradeCautions
      }
    }, items);
  } catch (err) {
    if (
      processingRow &&
      !['AI_INVALID_RESULT', 'CANDIDATES_CHANGED'].includes(err.code)
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
}

router.post('/recommendations', wrap((req, res) => {
  const rawCategory = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body.category : undefined;
  if (rawCategory !== undefined && rawCategory !== null) {
    const normalizedCat = typeof rawCategory === 'string' ? rawCategory.trim().toLowerCase() : '';
    if (catalogEngine.COMMON_CATEGORIES.includes(normalizedCat)) {
      return runCatalogRecommendation(
        req.session.user_id,
        { ...req.body, category: normalizedCat },
        (status, payload) => res.status(status).json(payload)
      );
    }
    if (normalizedCat === 'smartphone') {
      const { category: _ignored, ...smartphoneBody } = req.body;
      return runRecommendation(req.session.user_id, smartphoneBody, (status, payload) => res.status(status).json(payload));
    }
    throw catalog.fail('INVALID_INPUT', 422);
  }
  return runRecommendation(req.session.user_id, req.body, (status, payload) => res.status(status).json(payload));
}));

router.post('/catalog/:category/recommendation-candidates', wrap(async (req, res) => {
  const category = typeof req.params.category === 'string' ? req.params.category.trim().toLowerCase() : '';
  if (category === 'smartphone') {
    const result = await smartphonesRouter.searchCandidatesForUser(req.session.user_id, req.body, new Date());
    return res.json({
      data: {
        category: 'smartphone',
        status: result.status,
        profile_version: result.profile_version,
        questions: result.questions,
        candidates: result.candidates
      }
    });
  }
  if (!catalogEngine.COMMON_CATEGORIES.includes(category)) {
    throw catalog.fail('NOT_FOUND', 404);
  }
  const result = await searchCatalogCandidatesForUser(req.session.user_id, req.body, category);
  return res.json({
    data: {
      category,
      status: result.status,
      profile_version: result.profile_version,
      price_availability: result.price_availability,
      questions: result.questions,
      candidates: result.candidates
    }
  });
}));

router.post('/catalog/:category/recommendations', wrap((req, res) => {
  const category = typeof req.params.category === 'string' ? req.params.category.trim().toLowerCase() : '';
  if (category === 'smartphone') {
    const { category: _ignored, ...smartphoneBody } = req.body && typeof req.body === 'object' ? req.body : {};
    return runRecommendation(req.session.user_id, smartphoneBody, (status, payload) => res.status(status).json(payload));
  }
  if (!catalogEngine.COMMON_CATEGORIES.includes(category)) {
    throw catalog.fail('NOT_FOUND', 404);
  }
  return runCatalogRecommendation(
    req.session.user_id,
    req.body,
    (status, payload) => res.status(status).json(payload),
    { defaultCategory: category }
  );
}));

function conversationResponse(res, state) {
  if (state.result) {
    return res.json({ data: { ...state.result, conversation: conversation.view(state) } });
  }
  const summary = conversation.view(state);
  return res.json({ data: {
    status: 'clarify', items: [], conversation: summary,
    can_resume: !summary.limit_reached && !summary.questions.length,
    questions: summary.limit_reached ? ['답변 수정 한도에 도달했습니다. 새 상담을 시작해 주세요.'] : summary.questions.map(q => q.label)
  } });
}

router.get('/recommendations/conversation', wrap(async (req, res) => {
  const state = conversation.get(req);
  if (!state) return res.json({ data: null });
  const profile = await db().models.profiles.findByPk(req.session.user_id);
  if (profile?.version !== state.version) throw catalog.fail('PROFILE_CHANGED', 409);
  return conversationResponse(res, state);
}));

router.post('/recommendations/conversation', wrap((req, res) => conversation.exclusive(req, async () => {
  const uid = req.session.user_id;
  const previous = conversation.get(req);
  const input = req.body;
  let state;
  const p = await db().models.profiles.findByPk(uid);
  if (!p?.confirmed_at || !p.common_json?.usages?.length || !p.common_json.spending_style) throw catalog.fail('PROFILE_INCOMPLETE', 409);
  if (input?.action === 'start') {
    catalog.object(input, ['action', 'text', 'replacement_device_id', 'mode']);
    if (!['purchase', 'upgrade'].includes(input.mode)) throw catalog.fail();
    const { text } = validator.validateAnalysisInput({ purpose: 'purchase', text: input.text });
    const deviceId = input.mode === 'upgrade' ? catalog.id(input.replacement_device_id) : null;
    if (!deviceId && input.replacement_device_id != null) throw catalog.fail();
    let ownedCapacity = null;
    if (deviceId) {
      const owned = await db().models.owned_devices.findOne({ where: { id: deviceId, user_id: uid, category: 'smartphone' } });
      if (!owned) throw catalog.fail('NOT_FOUND', 404);
      if (owned.variant_id) {
        const rows = await db().query('SELECT storage_gb FROM smartphone_variants WHERE id = :id', {
          replacements: { id: String(owned.variant_id) }, type: QueryTypes.SELECT
        });
        ownedCapacity = Number(rows[0]?.storage_gb) || null;
      }
    }
    const { minDate, maxDate } = catalog.releaseWindowKst();
    let capacities = [];
    if (!deviceId) {
      const rows = await db().query(
        `SELECT DISTINCT v.storage_gb FROM smartphone_variants v JOIN smartphones s ON s.id = v.smartphone_id
         WHERE ${await smartphonesRouter.publicationWhere()} AND s.is_test = 0 AND s.released_on_kr BETWEEN :minDate AND :maxDate`,
        { replacements: { minDate, maxDate }, type: QueryTypes.SELECT }
      );
      capacities = [...new Set(rows.map(row => Number(row.storage_gb)))].filter(gb => [128, 256, 512].includes(gb));
    }
    const smartphone = require('./member').stripInternalSmartphoneKeys(p.smartphone_json);
    const { lifestyle_note: omitted, ...common } = p.common_json;
    const existingProfile = { common, smartphone, confirmed_at: p.confirmed_at };
    const releaseSlot = acquireAiSlot(uid);
    try {
      const aiRes = await currentAdapter.analyze({ purpose: 'purchase', text, existingProfile, upgrade: Boolean(deviceId) });
      const { draft } = validator.validateAnalysisOutput('purchase', aiRes.output, text);
      state = conversation.create({ text, replacement_device_id: deviceId }, draft, { version: p.version, common, smartphone }, capacities, ownedCapacity);
    } finally {
      releaseSlot();
    }
  } else if (input?.action === 'answer') {
    if (!previous) throw catalog.fail('CONVERSATION_EXPIRED', 409);
    if (previous.version !== p.version) throw catalog.fail('PROFILE_CHANGED', 409);
    state = conversation.answer(previous, input);
  } else if (input?.action === 'resume') {
    catalog.object(input, ['action', 'id', 'revision']);
    if (!previous) throw catalog.fail('CONVERSATION_EXPIRED', 409);
    if (previous.id !== input.id || previous.revision !== input.revision) throw catalog.fail('CONVERSATION_CHANGED', 409);
    if (previous.version !== p.version) throw catalog.fail('PROFILE_CHANGED', 409);
    if (previous.result) return conversationResponse(res, previous);
    state = previous;
  } else {
    throw catalog.fail();
  }

  conversation.put(req, state);
  let { body, missing, blocked } = conversation.prepare(state);
  if (blocked) {
    state = { ...state, result: { status: 'clarify', items: [], questions: ['검증할 수 없는 필수 조건을 유지했습니다. 답변을 수정하거나 검증 가능한 조건으로 새 상담을 시작해 주세요.'] } };
    conversation.put(req, state);
    return conversationResponse(res, state);
  }
  if (missing.some(q => q.id === 'storage') && !missing.some(q => q.id !== 'storage')) {
    // A storage question is useful only if the current budget and requirements leave multiple sizes.
    const preview = await smartphonesRouter.searchCandidatesForUser(uid, body);
    const available = new Set(preview.candidates.map(candidate => candidate.storage_gb));
    const capacities = state.capacities.filter(gb => available.has(gb));
    const questions = state.questions.map(q => q.id === 'storage'
      ? { ...q, options: q.options.filter(option => option.value === 'auto' || capacities.includes(Number(option.value))) }
      : q);
    state = { ...state, capacities, questions };
    ({ body, missing } = conversation.prepare(state));
  }
  conversation.put(req, state);
  if (missing.length) return conversationResponse(res, state);

  return runRecommendation(uid, body, (status, payload, storedItems) => {
    state = { ...state, result: storedItems ? { ...payload.data, items: storedItems } : payload.data };
    conversation.put(req, state);
    return res.status(status).json({ data: { ...payload.data, conversation: conversation.view(state) } });
  }, { conversational: true });
})));


// 이력은 해당 추천에서 사용한 관측 가격을 그대로 표시한다.
function formatHistoricalRecommendation(row) {
  const raw = row.toJSON();
  const resultJson = raw.result_json || { items: [], questions: [] };
  const items = Array.isArray(resultJson.items)
    ? resultJson.items.map(item => {
        if (!item.price) return item;
        return {
          ...item,
          price: { ...item.price, is_expired_now: false,
            retained_observation: item.price.observation_id != null,
            price_status_note: '추천 당시 사용한 참고 가격' }
        };
      })
    : [];

  return {
    id: String(raw.id),
    ...(resultJson.category || raw.input_snapshot?.category ? { category: resultJson.category || raw.input_snapshot.category } : {}),
    status: raw.status,
    ...(resultJson.upgrade_decision ? { upgrade_decision: resultJson.upgrade_decision } : {}),
    ...(resultJson.owned_device || raw.input_snapshot?.owned_device_snapshot ? { owned_device: resultJson.owned_device || raw.input_snapshot.owned_device_snapshot } : {}),
    ...(Array.isArray(resultJson.decision_reasons) ? { decision_reasons: resultJson.decision_reasons } : {}),
    ...(Array.isArray(resultJson.verified_improvements) ? { verified_improvements: resultJson.verified_improvements } : {}),
    ...(Array.isArray(resultJson.limitations) ? { limitations: resultJson.limitations } : {}),
    profile_version: raw.profile_version,
    as_of: new Date(raw.as_of).toISOString(),
    created_at: new Date(raw.created_at).toISOString(),
    model_name: raw.model_name,
    prompt_version: raw.prompt_version,
    input_snapshot: raw.input_snapshot,
    historical_snapshot: true,
    validity_note: '추천 당시 조건의 기록입니다. 현재 구매 전 가격·조건을 다시 확인하세요.',
    items,
    questions: Array.isArray(resultJson.questions) ? resultJson.questions : [],
    keep_reasons: Array.isArray(resultJson.keep_reasons) ? resultJson.keep_reasons : [],
    keep_cautions: Array.isArray(resultJson.keep_cautions) ? resultJson.keep_cautions : [],
    ranking_policy_version: resultJson.ranking_policy_version || null,
    ...(resultJson.price_availability ? { price_availability: resultJson.price_availability } : {}),
    explanation_source: resultJson.explanation_source || null,
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

router.verifySnapshotFreshness = verifySnapshotFreshness;
router.setAiAdapter = setAiAdapter;
router.cleanupStaleProcessing = cleanupStaleProcessing;

module.exports = router;
