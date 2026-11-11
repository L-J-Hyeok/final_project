'use strict';
const publication = require('../services/product-publication');

const express = require('express');
const { QueryTypes } = require('sequelize');
const connection = require('../db/connection');
const catalog = require('../services/smartphone-catalog');
const pricePreview = require('../services/smartphone-price-preview');
const upgradeAdvisor = require('../services/upgrade-advisor');
const memberRouter = require('./member');

const router = express.Router();
const wrap = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);

function db() {
  return connection.getDatabase();
}

router.use(['/smartphones', '/recommendation-candidates'], wrap(async (req, res, next) => {
  if (!req.session || !req.session.user_id) throw catalog.fail('AUTH_REQUIRED', 401);
  const user = await db().models.users.findByPk(req.session.user_id, { attributes: ['id'] });
  if (!user) throw catalog.fail('AUTH_REQUIRED', 401);
  next();
}));

const VARIANT_JOIN_SQL = `
  SELECT
    CAST(v.id AS CHAR) AS variant_id,
    CAST(s.id AS CHAR) AS smartphone_id,
    s.brand,
    s.model_name,
    s.domestic_model_number,
    s.released_on_kr,
    s.os,
    s.chipset,
    s.screen_inches,
    s.refresh_hz,
    s.battery_mah,
    s.weight_g,
    s.supports_5g,
    s.wireless_charging,
    s.source_name AS phone_source_name,
    s.source_url AS phone_source_url,
    s.verified_at AS phone_verified_at,
    s.verified AS phone_verified,
    s.is_test,
    v.storage_gb,
    v.ram_gb,
    v.color,
    v.launch_price_krw,
    v.launch_price_metadata_json,
    v.source_name AS variant_source_name,
    v.source_url AS variant_source_url,
    v.verified_at AS variant_verified_at,
    v.verified AS variant_verified
  FROM smartphone_variants v
  JOIN smartphones s ON s.id = v.smartphone_id
`;

function formatVariantRow(row, priceSummary, now) {
  const phoneVerified = Boolean(row.phone_verified);
  const variantVerified = Boolean(row.variant_verified);
  const verified = phoneVerified && variantVerified;
  const within3Years = catalog.isWithinReleaseWindow(row.released_on_kr, now);
  return {
    variant_id: String(row.variant_id),
    smartphone_id: String(row.smartphone_id),
    brand: row.brand,
    model_name: row.model_name,
    domestic_model_number: row.domestic_model_number,
    released_on_kr: row.released_on_kr,
    within_3_years_kr: within3Years,
    os: row.os,
    chipset: row.chipset,
    screen_inches: row.screen_inches === null ? null : Number(row.screen_inches),
    refresh_hz: row.refresh_hz === null ? null : Number(row.refresh_hz),
    battery_mah: row.battery_mah === null ? null : Number(row.battery_mah),
    weight_g: row.weight_g === null ? null : Number(row.weight_g),
    supports_5g: row.supports_5g === null ? null : Boolean(row.supports_5g),
    wireless_charging: row.wireless_charging === null ? null : Boolean(row.wireless_charging),
    storage_gb: Number(row.storage_gb),
    ram_gb: row.ram_gb === null ? null : Number(row.ram_gb),
    color: row.color,
    verified,
    is_test: Boolean(row.is_test),
    sources: {
      model: {
        source_name: row.phone_source_name,
        source_url: row.phone_source_url,
        verified_at: row.phone_verified_at ? new Date(row.phone_verified_at).toISOString() : null,
        verified: phoneVerified
      },
      variant: {
        source_name: row.variant_source_name,
        source_url: row.variant_source_url,
        verified_at: row.variant_verified_at ? new Date(row.variant_verified_at).toISOString() : null,
        verified: variantVerified
      }
    },
    price: priceSummary.selected,
    latest_prices_by_seller: priceSummary.latest_by_seller
  };
}

async function fetchPricesByVariantIds(variantIds, t) {
  const map = new Map();
  if (!variantIds.length) return map;
  for (const id of variantIds) map.set(String(id), []);
  const rows = await db().query(
    `SELECT
       CAST(id AS CHAR) AS id,
       CAST(variant_id AS CHAR) AS variant_id,
       source_name,
       source_url,
       seller_name,
       amount_krw,
       shipping_krw,
       observed_at,
       expires_at,
       conditions_text,
       unconditional,
       in_stock,
       is_new,
       is_unlocked
     FROM price_observations
     WHERE variant_id IN (:variantIds)
     ORDER BY observed_at DESC, id DESC`,
    { replacements: { variantIds }, type: QueryTypes.SELECT, transaction: t }
  );
  for (const r of rows) {
    const list = map.get(String(r.variant_id));
    if (list) list.push(r);
  }
  return map;
}

// GET /api/smartphones — Samsung/Apple smartphone variant list with 3-year filter & price summary
router.get('/smartphones', wrap(async (req, res) => {
  const q = catalog.validateCatalogQuery(req.query);
  const now = new Date();
  const { minDate, maxDate } = catalog.releaseWindowKst(now);

  const conditions = [
    await publication.sql(db()),
    'v.id > :cursor',
    "s.brand IN ('samsung', 'apple')"
  ];
  if (q.include_test) {
    conditions[0] = conditions[0].replace('s.is_test = 0', 's.is_test = 1');
  }
  const replacements = {
    cursor: q.cursor,
    limit: q.limit + 1,
    minDate,
    maxDate
  };

  if (!q.include_test) {
    conditions.push('s.is_test = 0');
  }
  if (q.only_recommendable) {
    conditions.push(
      's.verified = 1',
      'v.verified = 1',
      's.domestic_model_number IS NOT NULL',
      's.released_on_kr IS NOT NULL',
      's.os IS NOT NULL',
      's.released_on_kr >= :minDate',
      's.released_on_kr <= :maxDate'
    );
  }
  if (q.brand) {
    conditions.push('s.brand = :brand');
    replacements.brand = q.brand;
  }
  if (q.os) {
    conditions.push('s.os = :os');
    replacements.os = q.os;
  }
  if (q.storage_gb !== null) {
    conditions.push('v.storage_gb = :storage_gb');
    replacements.storage_gb = q.storage_gb;
  }

  const sql = `${VARIANT_JOIN_SQL} WHERE ${conditions.join(' AND ')} ORDER BY v.id ASC LIMIT :limit`;
  const rows = await db().query(sql, { replacements, type: QueryTypes.SELECT });
  const hasMore = rows.length > q.limit;
  const pageRows = rows.slice(0, q.limit);
  const priceMap = await fetchPricesByVariantIds(pageRows.map(r => r.variant_id));

  const data = pageRows.map(row => {
    const obs = priceMap.get(String(row.variant_id)) || [];
    const priceSummary = catalog.selectBestPrice(obs, now);
    return formatVariantRow(row, priceSummary, now);
  });

  res.json({
    data,
    release_window_kr: { min_date: minDate, max_date: maxDate },
    as_of: now.toISOString(),
    next_cursor: hasMore ? data[data.length - 1].variant_id : null
  });
}));

// GET /api/smartphones/:variantId — Single smartphone variant detail, specs, and latest/expired prices
router.get('/smartphones/:variantId', wrap(async (req, res) => {
  catalog.object(req.query, []);
  const variantId = catalog.id(req.params.variantId);
  const now = new Date();

  let pubClause = await publication.sql(db());
  if (process.env.NODE_ENV === 'test') {
    pubClause = pubClause.replace('s.is_test = 0', '1=1');
  }
  const rows = await db().query(
    `${VARIANT_JOIN_SQL} WHERE v.id = :variantId AND ${pubClause}`,
    { replacements: { variantId }, type: QueryTypes.SELECT }
  );
  if (!rows.length) throw catalog.fail('NOT_FOUND', 404);

  const priceMap = await fetchPricesByVariantIds([variantId]);
  const priceSummary = catalog.selectBestPrice(priceMap.get(variantId) || [], now);
  const view = formatVariantRow(rows[0], priceSummary, now);

  res.json({
    data: {
      ...view,
      as_of: now.toISOString()
    }
  });
}));

// Core candidate search logic extracted for reuse by both POST /api/recommendation-candidates and POST /api/recommendations
async function searchCandidatesForUser(uid, body, now = new Date()) {
  const { minDate, maxDate } = catalog.releaseWindowKst(now);

  const context = await db().transaction(async t => {
    const user = await db().models.users.findByPk(uid, { transaction: t, lock: t.LOCK.UPDATE, attributes: ['id'] });
    if (!user) throw catalog.fail('AUTH_REQUIRED', 401);
    const p = await db().models.profiles.findByPk(uid, { transaction: t, lock: t.LOCK.UPDATE });
    if (!p) throw catalog.fail('NOT_FOUND', 404);

    if (!p.confirmed_at || !p.common_json || !Array.isArray(p.common_json.usages) || !p.common_json.spending_style) {
      throw catalog.fail('PROFILE_INCOMPLETE', 409);
    }

    const cleanPhonePrefs = memberRouter.stripInternalSmartphoneKeys(p.smartphone_json || {});
    const input = catalog.validateCandidateInput(body, cleanPhonePrefs);
    input.upgrade_context = upgradeAdvisor.validateUpgradeContextInput(input.upgrade_context);
    if (p.version !== input.expected_profile_version) {
      throw catalog.fail('PROFILE_CHANGED', 409);
    }

    let replacementDevice = null;
    if (input.replacement_device_id !== null) {
      const ownedRow = await db().models.owned_devices.findOne({
        where: { id: input.replacement_device_id, user_id: uid },
        transaction: t
      });
      if (!ownedRow) throw catalog.fail('NOT_FOUND', 404);
      const rawOwned = ownedRow.toJSON();
      let product = null;
      if (rawOwned.variant_id !== null) {
        const prodRows = await db().query(
          `SELECT
             CAST(v.id AS CHAR) AS variant_id,
             CAST(s.id AS CHAR) AS smartphone_id,
             s.brand,
             s.model_name,
             s.domestic_model_number,
             s.released_on_kr,
             s.os,
             s.chipset,
             s.screen_inches,
             s.refresh_hz,
             s.battery_mah,
             s.weight_g,
             s.supports_5g,
             s.wireless_charging,
             v.storage_gb,
             v.ram_gb,
             v.color,
             (s.verified AND v.verified) AS verified
           FROM smartphone_variants v
           JOIN smartphones s ON s.id = v.smartphone_id
           WHERE v.id = :id`,
          { replacements: { id: rawOwned.variant_id }, type: QueryTypes.SELECT, transaction: t }
        );
        product = prodRows[0] || null;
      }
      replacementDevice = {
        id: String(rawOwned.id),
        category: rawOwned.category,
        source: rawOwned.variant_id ? 'catalog' : 'manual',
        manual_brand: rawOwned.manual_brand,
        manual_model_name: rawOwned.manual_model_name,
        manual_storage_gb: rawOwned.manual_storage_gb,
        manual_specs_verified: false,
        compatibility_verified: false,
        product
      };
    }

    return {
      profile: {
        version: p.version,
        common: p.common_json,
        smartphone: cleanPhonePrefs,
        confirmed_at: new Date(p.confirmed_at).toISOString()
      },
      input,
      replacementDevice
    };
  });

  const { profile, input, replacementDevice } = context;

  // 1. If required purchase conditions are missing or contradictory -> clarify
  if (input.clarify_questions.length > 0) {
    return {
      status: 'clarify',
      as_of: now.toISOString(),
      profile_version: profile.version,
      input,
      candidate_count: 0,
      candidates: [],
      questions: input.clarify_questions,
      ai_context: null
    };
  }

  // 2. Parameterized SELECT for hard spec conditions
  const h = input.hard;
  const where = [
    await publication.sql(db()),
    's.verified = 1',
    'v.verified = 1',
    's.domestic_model_number IS NOT NULL',
    's.released_on_kr IS NOT NULL',
    's.os IS NOT NULL',
    's.released_on_kr >= :minDate',
    's.released_on_kr <= :maxDate',
    's.brand IN (:allowedBrands)'
  ];
  if (input.include_test) {
    where[0] = where[0].replace('s.is_test = 0', 's.is_test = 1');
  }
  const replacements = {
    minDate,
    maxDate,
    allowedBrands: h.allowed_brands
  };

  if (!input.include_test) {
    where.push('s.is_test = 0');
  }
  if (h.required_os !== null) {
    where.push('s.os = :requiredOs');
    replacements.requiredOs = h.required_os;
  }
  if (h.min_storage_gb !== null) {
    where.push('v.storage_gb >= :minStorageGb');
    replacements.minStorageGb = h.min_storage_gb;
  }
  if (h.max_weight_g !== null) {
    where.push('s.weight_g IS NOT NULL AND s.weight_g <= :maxWeightG');
    replacements.maxWeightG = h.max_weight_g;
  }
  if (h.min_refresh_hz !== null) {
    where.push('s.refresh_hz IS NOT NULL AND s.refresh_hz >= :minRefreshHz');
    replacements.minRefreshHz = h.min_refresh_hz;
  }
  if (h.require_5g) {
    where.push('s.supports_5g = 1');
  }
  if (h.require_wireless_charging) {
    where.push('s.wireless_charging = 1');
  }

  const sql = `${VARIANT_JOIN_SQL} WHERE ${where.join(' AND ')} ORDER BY v.id ASC`;
  const variantRows = await db().query(sql, { replacements, type: QueryTypes.SELECT });
  const priceMap = await fetchPricesByVariantIds(variantRows.map(r => r.variant_id));

  const matchedCandidates = [];
  for (const row of variantRows) {
    const obs = priceMap.get(String(row.variant_id)) || [];
    const priceSummary = pricePreview.buildCandidatePriceObject(row, obs, process.env, now);
    const candidateObj = {
      ...row,
      price: priceSummary.selected
    };
    if (!catalog.matchesHardConditions(candidateObj, h, now)) continue;

    const formatted = formatVariantRow(row, priceSummary, now);
    const eligibleReasons = catalog.buildEligibleReasons(formatted, h, input.soft, replacementDevice);
    const comparison = replacementDevice
      ? upgradeAdvisor.buildDeviceCandidateComparison(replacementDevice.product, formatted)
      : null;
    matchedCandidates.push({
      variant_id: formatted.variant_id,
      smartphone_id: formatted.smartphone_id,
      brand: formatted.brand,
      model_name: formatted.model_name,
      domestic_model_number: formatted.domestic_model_number,
      released_on_kr: formatted.released_on_kr,
      os: formatted.os,
      chipset: formatted.chipset,
      screen_inches: formatted.screen_inches,
      refresh_hz: formatted.refresh_hz,
      battery_mah: formatted.battery_mah,
      weight_g: formatted.weight_g,
      supports_5g: formatted.supports_5g,
      wireless_charging: formatted.wireless_charging,
      storage_gb: formatted.storage_gb,
      ram_gb: formatted.ram_gb,
      color: formatted.color,
      sources: formatted.sources,
      price: {
        observation_id: formatted.price.observation_id ?? null,
        price_source: formatted.price.price_source || 'verified_sale',
        total_krw: formatted.price.total_krw ?? null,
        amount_krw: formatted.price.amount_krw ?? null,
        shipping_krw: formatted.price.shipping_krw ?? null,
        budget_basis_krw: formatted.price.budget_basis_krw ?? formatted.price.total_krw ?? formatted.price.amount_krw ?? null,
        purchase_verified: formatted.price.purchase_verified !== undefined ? Boolean(formatted.price.purchase_verified) : true,
        development_only: Boolean(formatted.price.development_only),
        source_name: formatted.price.source_name ?? null,
        source_url: formatted.price.source_url ?? null,
        danawa_product_url: formatted.price.danawa_product_url ?? null,
        seller_name: formatted.price.seller_name ?? null,
        observed_at: formatted.price.observed_at ?? null,
        expires_at: formatted.price.expires_at ?? null,
        checked_at: formatted.price.checked_at ?? formatted.price.observed_at ?? null,
        conditions_text: formatted.price.conditions_text ?? null,
        warning: formatted.price.warning ?? null
      },
      eligible_reasons: eligibleReasons,
      comparison_with_owned: comparison
    });
  }

  const keepAssessment = replacementDevice
    ? upgradeAdvisor.evaluateKeepCurrentDeviceOption({
        ownedDevice: replacementDevice,
        upgradeContext: input.upgrade_context,
        hard: h,
        candidates: matchedCandidates
      })
    : null;

  // 3. Zero candidates -> no_match with relaxation questions (never auto-relax)
  if (matchedCandidates.length === 0) {
    return {
      status: 'no_match',
      as_of: now.toISOString(),
      profile_version: profile.version,
      input,
      candidate_count: 0,
      candidates: [],
      questions: catalog.buildRelaxationQuestions(h),
      keep_current_evaluation: keepAssessment,
      ai_context: null
    };
  }

  // 4. More than 40 candidates -> clarify without arbitrary truncation
  if (matchedCandidates.length > 40) {
    return {
      status: 'clarify',
      as_of: now.toISOString(),
      profile_version: profile.version,
      input,
      candidate_count: matchedCandidates.length,
      candidates: [],
      questions: [
        `조건을 만족하는 후보가 ${matchedCandidates.length}개로 너무 많습니다. 선호 제조사·저장 용량·예산 범위를 조금 더 구체화해 주세요.`
      ],
      keep_current_evaluation: keepAssessment,
      ai_context: null
    };
  }

  // 5. 1..40 candidates -> candidate_ready with structured AI input snapshot (no PII/secrets)
  return {
    status: 'candidates_ready',
    as_of: now.toISOString(),
    profile_version: profile.version,
    release_window_kr: { min_date: minDate, max_date: maxDate },
    input,
    candidate_count: matchedCandidates.length,
    candidates: matchedCandidates,
    questions: [],
    keep_current_evaluation: keepAssessment,
    ai_context: {
      profile_snapshot: {
        version: profile.version,
        common: profile.common,
        smartphone: profile.smartphone
      },
      purchase_conditions: {
        hard: h,
        soft: input.soft,
        purchase_reason: input.purchase_reason,
        upgrade_context: input.upgrade_context
      },
      replacement_device: replacementDevice,
      keep_current_evaluation: keepAssessment,
      candidates_snapshot: matchedCandidates
    }
  };
}

// POST /api/recommendation-candidates — Validate profile/owned devices, filter candidates by hard conditions,
// handle 0 / >40 / clarify cases, and structure verified candidate payload for downstream AI recommendation.
router.post('/recommendation-candidates', wrap(async (req, res) => {
  const result = await searchCandidatesForUser(req.session.user_id, req.body, new Date());
  const responseData = { ...result };
  delete responseData.input;
  res.json({ data: responseData });
}));

router.searchCandidatesForUser = searchCandidatesForUser;
router.fetchPricesByVariantIds = fetchPricesByVariantIds;
router.VARIANT_JOIN_SQL = VARIANT_JOIN_SQL;
router.publicationWhere = () => publication.sql(db()).then(sql => (process.env.NODE_ENV === 'test' ? sql.replace('s.is_test = 0', '1=1') : sql));

module.exports = router;
