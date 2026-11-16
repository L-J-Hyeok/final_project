'use strict';
const { isDeepStrictEqual } = require('node:util');
const { fail, object } = require('./smartphone-catalog');
const { classifyDisqualifiedListing } = require('./danawa-price-matcher');
const { validateModel, validateSku, validatePrice } = require('./catalog-validation');

const modelFields = ['category_code', 'brand', 'model_name', 'model_number', 'released_on', 'weight_g',
  'official_product_url', 'specs_json', 'publication_status', 'verification_status', 'sale_status',
  'source_name', 'source_url', 'verified_at'];
const skuFields = ['sku_code', 'manufacturer_part_number', 'storage_gb', 'ram_gb', 'color', 'connectivity',
  'options_json', 'publication_status', 'verification_status', 'sale_status', 'source_name', 'source_url', 'verified_at'];
const variantFields = ['storage_gb', 'ram_gb', 'color', 'connectivity', 'options_json'];
const saleFields = ['seller_name', 'amount_minor', 'currency', 'product_url', 'observed_at', 'checked_at',
  'listing_title', 'sku_match', 'new_item', 'domestic_unit', 'unconditional', 'available', 'storage_authorized', 'reuse_basis'];

function validateListing(model, sku, sale, now) {
  object(sale, saleFields);
  const { listing_title, sku_match, new_item, domestic_unit, unconditional, available, storage_authorized, reuse_basis, ...price } = sale;
  const expected = {
    brand: model.brand, model_number: model.model_number, manufacturer_part_number: sku.manufacturer_part_number ?? null,
    storage_gb: sku.storage_gb ?? null, ram_gb: sku.ram_gb ?? null, color: sku.color ?? null,
    connectivity: sku.connectivity ?? null, options_json: sku.options_json
  };
  // Two independently reviewed records are compared. NULL on the catalog side is never positive proof.
  if (!isDeepStrictEqual(sku_match, expected) ||
      ![new_item, domestic_unit, unconditional, available, storage_authorized].every(flag => flag === true)) throw fail();
  if (typeof reuse_basis !== 'string' || !reuse_basis.trim() || reuse_basis.length > 500) throw fail();
  if (typeof listing_title !== 'string' || !listing_title.trim() || listing_title.length > 500) throw fail();
  validatePrice(price);
  const result = classifyDisqualifiedListing({ productName: listing_title, minPrice: price.amount_minor });
  // The phone-specific price floor and model suffix checks do not describe other device categories.
  if (result.reasons.some(reason => reason !== 'ABNORMAL_LOW_PRICE' &&
      !reason.startsWith('NON_DOMESTIC_SAMSUNG_MODEL:'))) throw fail();
  if (new Date(price.checked_at) > now) throw fail();
  const url = new URL(price.product_url);
  if (url.hostname.endsWith('.danawa.com') || url.hostname === 'danawa.com') {
    if (url.hostname !== 'prod.danawa.com' || url.pathname !== '/info/' ||
        !/^[1-9]\d*$/.test(url.searchParams.get('pcode') || '') || url.searchParams.getAll('pcode').length !== 1) throw fail();
  }
  return { price, reuseBasis: reuse_basis };
}

function prepare(entries, now = new Date()) {
  if (!Array.isArray(entries) || !entries.length || entries.length > 500) throw fail();
  const identities = new Set();
  return entries.map(entry => {
    object(entry, ['model', 'skus']);
    object(entry.model, modelFields);
    validateModel(entry.model);
    const { model, skus } = entry;
    const key = [model.category_code, model.brand, model.model_number].map(value => value.toLowerCase()).join('\0');
    if (identities.has(key) || !Array.isArray(skus) || !skus.length) throw fail();
    identities.add(key);
    const codes = new Set();
    return { model, skus: skus.map(item => {
      object(item, ['sku', 'prices']);
      object(item.sku, skuFields);
      const sku = { ...item.sku, category_code: model.category_code };
      validateSku(sku);
      if (codes.has(sku.sku_code.toLowerCase()) || !Array.isArray(item.prices) ||
          (sku.publication_status === 'public' && model.publication_status !== 'public')) throw fail();
      codes.add(sku.sku_code.toLowerCase());
      return { sku, prices: item.prices.map(sale => validateListing(model, sku, sale, now)) };
    }) };
  });
}

function equivalent(key, input, existing) {
  if (input == null) return existing == null;
  if (existing instanceof Date) return +new Date(input) === +existing;
  if (key === 'weight_g' || key === 'amount_minor') return String(Number(input)) === String(Number(existing)) &&
    (key !== 'amount_minor' || BigInt(input) === BigInt(existing));
  return isDeepStrictEqual(input, existing);
}

function verifyExisting(values, row) {
  // Updates and approval transitions belong to the administrator workflow.
  if (Object.entries(values).some(([key, value]) => !equivalent(key, value, row.get(key)))) {
    throw fail('CATALOG_IMPORT_CONFLICT', 409);
  }
}

async function apply(db, entries, actorUserId = null) {
  const prepared = prepare(entries);
  const tables = db.models;
  return db.transaction(async transaction => {
    const counts = { models: 0, skus: 0, prices: 0 };
    for (const entry of prepared) {
      const { category_code, brand, model_number } = entry.model;
      const [model, modelCreated] = await tables.catalog_models.findOrCreate({
        where: { category_code, brand, model_number }, defaults: entry.model, transaction
      });
      if (!modelCreated) verifyExisting(entry.model, model);
      counts.models += Number(modelCreated);
      await tables.catalog_models.findByPk(model.id, { transaction, lock: transaction.LOCK.UPDATE });
      const variants = await tables.catalog_skus.findAll({ where: { model_id: model.id }, transaction,
        lock: transaction.LOCK.UPDATE });
      for (const { sku, prices } of entry.skus) {
        const [variant, skuCreated] = await tables.catalog_skus.findOrCreate({
          where: { model_id: model.id, sku_code: sku.sku_code }, defaults: sku, transaction
        });
        if (!skuCreated) verifyExisting(sku, variant);
        if (skuCreated) {
          if (variants.some(existing => variantFields.every(key => equivalent(key, sku[key], existing.get(key))))) {
            throw fail('CATALOG_IMPORT_CONFLICT', 409);
          }
          variants.push(variant);
        }
        counts.skus += Number(skuCreated);
        if (skuCreated) await tables.catalog_admin_events.create({
          actor_user_id: actorUserId, model_id: model.id, sku_id: variant.id, action: 'import_sku',
          changes_json: { model_created: modelCreated, source_url: sku.source_url }
        }, { transaction });
        for (const { price, reuseBasis } of prices) {
          const [record, created] = await tables.catalog_price_observations.findOrCreate({
            where: { model_id: model.id, sku_id: variant.id, seller_name: price.seller_name,
              currency: price.currency, observed_at: new Date(price.observed_at) },
            defaults: price, transaction
          });
          if (!created) verifyExisting(price, record);
          counts.prices += Number(created);
          if (created) await tables.catalog_admin_events.create({
            actor_user_id: actorUserId, model_id: model.id, sku_id: variant.id, action: 'import_price',
            changes_json: { observation_id: String(record.id), source_url: price.product_url, reuse_basis: reuseBasis }
          }, { transaction });
        }
      }
    }
    return counts;
  });
}

module.exports = { prepare, apply };
