'use strict';
const express = require('express');
const wrap = require('../http/async-handler');
const { QueryTypes } = require('sequelize');
const connection = require('../db/connection');
const { categories } = require('../services/catalog-validation');
const { fail, id, integer, object, str } = require('../services/smartphone-catalog');
const publication = require('../services/product-publication');
const { buildCandidatePriceObject } = require('../services/smartphone-price-preview');
const phones = require('./smartphones');
const { priceAvailability } = require('../services/catalog-price-availability');
const comparisonService = require('../services/catalog-comparison');

const router = express.Router();
const select = (db, sql, replacements) => db.query(sql, { replacements, type: QueryTypes.SELECT });
const amount = value => value == null ? null : Number(value);
const json = value => typeof value === 'string' ? JSON.parse(value) : value;
const publicModel = "m.publication_status = 'public' AND m.verification_status = 'verified' AND m.is_test = 0";
const publicSku = "k.publication_status = 'public' AND k.verification_status = 'verified'";

function categoryCode(value) {
  if (!Object.hasOwn(categories, value)) throw fail('NOT_FOUND', 404);
  return value;
}

function currency(query) {
  if (query.currency === undefined) return 'KRW';
  if (typeof query.currency !== 'string' || !/^[A-Z]{3}$/.test(query.currency)) throw fail();
  return query.currency;
}

function paging(query, extra) {
  object(query, ['limit', 'after', 'sort', ...extra]);
  const direction = query.sort === 'id_desc' ? 'DESC' : 'ASC';
  if (query.sort !== undefined && !['id_asc', 'id_desc'].includes(query.sort)) throw fail();
  const raw = query.limit ?? '30';
  if (typeof raw !== 'string' || !/^[1-9][0-9]{0,2}$/.test(raw)) throw fail();
  const limit = integer(Number(raw), 1, 100);
  return { direction, limit, after: query.after === undefined ? null : id(query.after) };
}

function page(rows, limit, key) {
  const data = rows.slice(0, limit);
  return { data, next_cursor: rows.length > limit ? data.at(-1)[key] : null };
}

function source(name, url, verifiedAt) {
  return { name, url, verified_at: verifiedAt, verification_status: 'verified' };
}

function modelDto(row, category) {
  return {
    model_id: String(row.model_id), category, brand: row.brand, model_name: row.model_name,
    model_number: row.model_number, released_on: row.released_on, weight_g: amount(row.weight_g),
    official_product_url: row.official_product_url, sale_status: row.sale_status,
    specifications: json(row.specifications), source: source(row.source_name, row.source_url, row.verified_at)
  };
}

function skuDto(row, price) {
  return {
    sku_id: String(row.sku_id), model_id: String(row.model_id), sku_code: row.sku_code,
    manufacturer_part_number: row.manufacturer_part_number, storage_gb: amount(row.storage_gb),
    ram_gb: amount(row.ram_gb), color: row.color, connectivity: row.connectivity,
    options: json(row.options), sale_status: row.sale_status, reference_price: price,
    source: source(row.source_name, row.source_url, row.verified_at)
  };
}

async function models(db, category, { modelId = null, direction = 'ASC', after = null, limit = 1, brand = null, q = null } = {}) {
  const smartphone = category === 'smartphone';
  const alias = smartphone ? 's' : 'm';
  const columns = smartphone ? `
    s.domestic_model_number AS model_number, s.released_on_kr AS released_on, 'unknown' AS sale_status,
    JSON_OBJECT('os', s.os, 'chipset', s.chipset, 'screen_inches', s.screen_inches,
      'refresh_hz', s.refresh_hz, 'battery_mah', s.battery_mah, 'supports_5g',
      IF(s.supports_5g IS NULL, NULL, s.supports_5g = 1), 'wireless_charging',
      IF(s.wireless_charging IS NULL, NULL, s.wireless_charging = 1), 'details', s.details_json) AS specifications
  ` : 'm.model_number, m.released_on, m.sale_status, m.specs_json AS specifications';
  const where = smartphone
    ? `s.brand IN ('apple','samsung') AND EXISTS (SELECT 1 FROM smartphone_variants v
        WHERE v.smartphone_id = s.id AND ${await publication.sql(db)})`
    : `m.category_code = :category AND ${publicModel}`;
  const modelNumber = smartphone ? 's.domestic_model_number' : 'm.model_number';
  const comparison = direction === 'ASC' ? '>' : '<';
  const rows = await select(db, `
    SELECT CAST(${alias}.id AS CHAR) AS model_id, ${alias}.brand, ${alias}.model_name,
      ${alias}.weight_g, ${alias}.official_product_url, ${alias}.source_name, ${alias}.source_url,
      ${alias}.verified_at, ${columns}
    FROM ${smartphone ? 'smartphones s' : 'catalog_models m'}
    WHERE ${where} AND (:modelId IS NULL OR ${alias}.id = CAST(:modelId AS UNSIGNED))
      AND (:after IS NULL OR ${alias}.id ${comparison} CAST(:after AS UNSIGNED))
      AND (:brand IS NULL OR ${alias}.brand = :brand)
      AND (:q IS NULL OR LOCATE(:q, ${alias}.model_name) > 0 OR LOCATE(:q, ${modelNumber}) > 0)
    ORDER BY ${alias}.id ${direction} LIMIT :rowLimit
  `, { category, modelId, after, brand, q, rowLimit: limit + 1 });
  return rows.map(row => {
    const result = modelDto(row, category);
    if (smartphone) {
      for (const field of ['supports_5g', 'wireless_charging']) {
        if (result.specifications[field] != null) result.specifications[field] = Boolean(result.specifications[field]);
      }
    }
    return result;
  });
}

async function storedPrices(db, modelId, targets, priceCurrency) {
  if (!targets.length) return new Map();
  const rows = await select(db, `
    SELECT target_key, CAST(id AS CHAR) AS observation_id, seller_name, CAST(amount_minor AS CHAR) AS amount_minor,
      currency, product_url, observed_at, checked_at
    FROM (
      SELECT p.*, ROW_NUMBER() OVER (PARTITION BY target_key ORDER BY observed_at DESC, id DESC) AS price_rank
      FROM catalog_price_observations p
      WHERE model_id = CAST(:modelId AS UNSIGNED) AND currency = :priceCurrency AND target_key IN (:targets)
        AND status = 'normal' AND observed_at <= NOW(3) AND checked_at <= NOW(3)
    ) ranked WHERE price_rank = 1
  `, { modelId, targets, priceCurrency });
  return new Map(rows.map(({ target_key: target, ...row }) => [target, {
    ...row, scope: target === 'model' ? 'model' : target.startsWith('s:') ? 'sku' : 'group',
    label: '수집 당시 참고 가격', price_source: new URL(row.product_url).hostname === 'prod.danawa.com'
      ? 'danawa_reference' : 'seller_reference'
  }]));
}

async function skus(db, category, modelId, { direction, after, limit, skuId = null }, priceCurrency) {
  const comparison = direction === 'ASC' ? '>' : '<';
  if (category === 'smartphone') {
    const rows = await select(db, `${phones.VARIANT_JOIN_SQL}
      WHERE s.id = CAST(:modelId AS UNSIGNED) AND s.brand IN ('apple','samsung') AND ${await publication.sql(db)}
        AND (:skuId IS NULL OR v.id = CAST(:skuId AS UNSIGNED))
        AND (:after IS NULL OR v.id ${comparison} CAST(:after AS UNSIGNED)) ORDER BY v.id ${direction} LIMIT :rowLimit`,
    { modelId, after, skuId, rowLimit: limit + 1 });
    const result = page(rows, limit, 'variant_id');
    const observations = priceCurrency === 'KRW'
      ? await phones.fetchPricesByVariantIds(result.data.map(row => row.variant_id), undefined, { comparison: true })
      : new Map();
    return { ...result, data: result.data.map(row => {
      const price = buildCandidatePriceObject(row, observations.get(row.variant_id) || [], {}).selected;
      return skuDto({
        ...row, sku_id: row.variant_id, model_id: row.smartphone_id, sku_code: null,
        manufacturer_part_number: null, connectivity: null, options: {}, sale_status: 'unknown',
        source_name: row.variant_source_name, source_url: row.variant_source_url, verified_at: row.variant_verified_at
      }, price?.observed_at ? {
        observation_id: price.observation_id, seller_name: price.seller_name,
        amount_minor: String(price.amount_krw), currency: 'KRW', product_url: price.danawa_product_url || price.source_url,
        observed_at: price.observed_at, checked_at: price.checked_at, scope: 'capacity_common',
        label: '수집 당시 참고 가격', price_source: price.price_source
      } : null);
    }) };
  }

  const rows = await select(db, `
    SELECT CAST(k.id AS CHAR) AS sku_id, CAST(k.model_id AS CHAR) AS model_id, k.sku_code,
      m.category_code AS category, m.brand, m.model_number,
      k.manufacturer_part_number, k.storage_gb, k.ram_gb, k.color, k.connectivity, k.options_json AS options,
      k.sale_status, CAST(k.price_group_id AS CHAR) AS price_group_id, k.source_name, k.source_url, k.verified_at
    FROM catalog_skus k JOIN catalog_models m ON m.id = k.model_id
    WHERE m.id = CAST(:modelId AS UNSIGNED) AND m.category_code = :category AND ${publicModel} AND ${publicSku}
      AND (:skuId IS NULL OR k.id = CAST(:skuId AS UNSIGNED))
      AND (:after IS NULL OR k.id ${comparison} CAST(:after AS UNSIGNED))
    ORDER BY k.id ${direction} LIMIT :rowLimit
  `, { category, modelId, after, skuId, rowLimit: limit + 1 });
  const result = page(rows, limit, 'sku_id');
  const targets = new Set(result.data.flatMap(row => [
    's:' + row.sku_id, ...(row.price_group_id == null ? [] : ['g:' + row.price_group_id])
  ]));
  const prices = await storedPrices(db, modelId, [...targets], priceCurrency);
  return { ...result, data: result.data.map(row => {
    const price = prices.get('s:' + row.sku_id) ?? prices.get('g:' + row.price_group_id) ?? null;
    return { ...skuDto(row, price), ...priceAvailability(row, price) };
  }) };
}

router.get('/categories', (req, res) => res.json({
  data: Object.entries(categories).map(([code, label]) => ({ code, label }))
}));

router.get('/:category/models', wrap(async (req, res) => {
  const category = categoryCode(req.params.category);
  const pagingOptions = paging(req.query, ['brand', 'q']);
  const brand = str(req.query.brand, 80, true);
  const q = str(req.query.q, 120, true);
  const data = await models(connection.getDatabase(), category, { ...pagingOptions, brand, q });
  res.json(page(data, pagingOptions.limit, 'model_id'));
}));

router.get('/:category/models/:modelId', wrap(async (req, res) => {
  const category = categoryCode(req.params.category);
  const modelId = id(req.params.modelId);
  object(req.query, ['currency']);
  const priceCurrency = currency(req.query);
  const db = connection.getDatabase();
  const [model] = await models(db, category, { modelId });
  if (!model) throw fail('NOT_FOUND', 404);
  const prices = category === 'smartphone' ? new Map() : await storedPrices(db, modelId, ['model'], priceCurrency);
  res.json({ data: { ...model, reference_price: prices.get('model') ?? null } });
}));

router.get('/:category/models/:modelId/skus', wrap(async (req, res) => {
  const category = categoryCode(req.params.category);
  const modelId = id(req.params.modelId);
  const pagingOptions = paging(req.query, ['currency']);
  const priceCurrency = currency(req.query);
  const db = connection.getDatabase();
  if (!(await models(db, category, { modelId })).length) throw fail('NOT_FOUND', 404);
  res.json(await skus(db, category, modelId, pagingOptions, priceCurrency));
}));

router.get('/:category/compare', wrap(async (req, res) => {
  const category = categoryCode(req.params.category);
  object(req.query, ['items', 'currency']);
  const selections = comparisonService.parseSelections(req.query.items);
  const priceCurrency = currency(req.query);
  const db = connection.getDatabase();
  const modelCache = new Map();
  const items = [];
  for (const { modelId, skuId } of selections) {
    if (!modelCache.has(modelId)) {
      modelCache.set(modelId, (await models(db, category, { modelId }))[0]);
    }
    const model = modelCache.get(modelId);
    if (!model) throw fail('NOT_FOUND', 404);
    const result = await skus(db, category, modelId, { direction: 'ASC', after: null, limit: 1, skuId }, priceCurrency);
    if (!result.data[0]) throw fail('NOT_FOUND', 404);
    items.push({ model, sku: result.data[0] });
  }
  res.json({ data: comparisonService.compare(category, items) });
}));

module.exports = router;
