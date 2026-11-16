'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { randomBytes } = require('node:crypto');
const mysql = require('mysql2/promise');
const { Sequelize, DataTypes, QueryTypes } = require('sequelize');
const connection = require('../db/connection');
const { apply } = require('../db/migrate-catalog');
const { categories, validateModel, validateSku, validatePrice } = require('../services/catalog-validation');

const testedAt = new Date('2024-01-02T00:00:00Z');
const source = { source_name: 'synthetic test only', source_url: 'https://example.invalid/evidence',
  verified_at: testedAt, publication_status: 'public', verification_status: 'verified' };
const samples = {
  tablet: [{ pen_supported: false, screen_inches: 11 }, { storage_gb: 256, ram_gb: 8, connectivity: 'wifi' }, {}],
  laptop: [{ battery_wh: 60 }, { storage_gb: 512, ram_gb: 16 }, { cpu: 'Fixture CPU', gpu: 'Fixture GPU' }],
  smartwatch: [{ gps: true, compatible_os: ['fixture-os'] }, { connectivity: 'gps' }, { case_size_mm: 42 }],
  earbuds: [{ anc: true, codecs: ['fixture-codec'] }, { connectivity: 'bluetooth' }, {}],
  speaker: [{ dimensions_mm: [100, 50, 40], power_w: 10 }, { connectivity: 'wifi' }, { audio_configuration: 'stereo' }]
};
const modelRow = (category, specs) => ({
  category_code: category, brand: 'FixtureCo', model_name: 'Fixture ' + category, model_number: 'fixture-' + category,
  specs_json: specs, ...source
});
const skuRow = (category, modelId, config, options) => ({
  category_code: category, model_id: modelId, sku_code: 'fixture-option', options_json: options, ...config, ...source
});

test('catalog validates evidence, category-specific types and required confirmed options', () => {
  for (const [category, [specs, config, options]] of Object.entries(samples)) {
    assert.doesNotThrow(() => validateModel(modelRow(category, specs)));
    assert.doesNotThrow(() => validateSku(skuRow(category, 1, config, options)));
  }
  for (const [category, specs] of [['tablet', { pen_supported: 'false' }], ['earbuds', { weight_g: 10 }]]) {
    assert.throws(() => validateModel(modelRow(category, specs)), { code: 'INVALID_INPUT' });
  }
  assert.throws(() => validateModel({ ...modelRow('tablet', {}), source_url: 'https://password@example.invalid' }),
    { code: 'INVALID_INPUT' });
  assert.throws(() => validateSku(skuRow('laptop', 1, { storage_gb: 512 }, {})), { code: 'INVALID_INPUT' });
  assert.throws(() => validateSku(skuRow('earbuds', 1, { ram_gb: 8 }, {})), { code: 'INVALID_INPUT' });
  assert.throws(() => validateSku({ ...skuRow('tablet', 1, { storage_gb: 256, connectivity: 'wifi' }, {}),
    price_group_id: 1 }), { code: 'INVALID_INPUT' });
  assert.throws(() => validatePrice({ ...source, sku_id: 1, price_group_id: 1 }), { code: 'INVALID_INPUT' });
});

test('teammate catalog converter and multi-category Danawa matcher classify, deduplicate and validate strictly', () => {
  const { convertTeammateProducts } = require('../services/teammate-catalog-converter');
  const { matchDanawaItemToCatalogSku } = require('../services/catalog-danawa-matcher');
  const existing82 = JSON.parse(readFileSync(join(__dirname, '../data/common-catalog-verified-8-2.json'), 'utf8'));
  const combined825 = JSON.parse(readFileSync(join(__dirname, '../data/common-catalog-teammate-8-2-5.json'), 'utf8'));
  const report825 = JSON.parse(readFileSync(join(__dirname, '../data/common-catalog-teammate-report-8-2-5.json'), 'utf8'));

  assert.equal(report825.source_counts.total_models, 99);
  assert.equal(report825.source_counts.total_skus, 120);
  assert.equal(report825.duplicates_with_existing_db.length, 2);
  assert.equal(report825.excluded_items.filter(x => x.reason === 'existing_smartphone_catalog_preserved').length, 30);
  assert.equal(report825.excluded_items.filter(x => x.reason === 'unsupported_audio_headphone').length, 8);
  assert.equal(report825.new_models_count, 59);
  assert.equal(report825.new_skus_count, 67);
  assert.equal(combined825.length, 64);

  // Verify converter rejects headphones and preserves existing 8-2 models on synthetic teammate payload
  const syntheticTeammate = {
    products: [
      {
        id: 'p-dup', slug: 'ipad-a16', name: 'iPad (A16)', baseModelNumber: 'A3354', releaseDate: '2025-04-10',
        verificationStatus: 'verified', isTestData: false,
        brand: { name: 'Apple' }, category: { slug: 'tablet' },
        dataSource: { name: 'Apple 공식 사양', sourceUrl: 'https://www.apple.com/kr/ipad-11/specs/', verifiedAt: '2026-11-06' },
        variants: [{ skuCode: 'APPLE-A3354-DEFAULT', storageCapacity: '128GB', connectivity: 'Wi-Fi', colorName: '실버' }]
      },
      {
        id: 'p-hp', slug: 'sony-wh-1000xm5', name: 'Sony WH-1000XM5 헤드폰', baseModelNumber: 'WH-1000XM5', releaseDate: '2022-11-01',
        verificationStatus: 'verified', isTestData: false,
        brand: { name: 'Sony' }, category: { slug: 'audio' },
        dataSource: { name: 'Sony 공식 사양', sourceUrl: 'https://store.sony.co.kr/product-view/102148119', verifiedAt: '2026-11-12' },
        variants: [{ skuCode: 'SONY-WH-1000XM5-DEFAULT', storageCapacity: '기본 내장', connectivity: 'Bluetooth 5.2', colorName: '실버' }]
      }
    ],
    rawSpecs: [{ productId: 'p-hp', variantId: null, specKey: 'weight', specValue: '250g', numericValue: 250 }]
  };
  const conv = convertTeammateProducts(syntheticTeammate, existing82);
  assert.equal(conv.entries.length, 0);
  assert.equal(conv.duplicates.length, 1);
  assert.equal(conv.excluded.length, 1);
  assert.equal(conv.excluded[0].reason, 'unsupported_audio_headphone');

  // Verify Danawa matcher accepts exact match and rejects wrong storage, connectivity, case size, or used/overseas
  const ipadModel = existing82[0].model;
  const ipadSku128 = existing82[0].skus[0].sku;
  assert.equal(matchDanawaItemToCatalogSku(
    { productCode: '77313098', productName: 'APPLE 2025 iPad A16 11세대(128GB)', minPrice: 612390 },
    ipadModel, ipadSku128, { launchPriceKrw: 529000 }
  ).matched, true);
  assert.equal(matchDanawaItemToCatalogSku(
    { productCode: '77313149', productName: 'APPLE 2025 iPad A16 11세대(256GB)', minPrice: 834870 },
    ipadModel, ipadSku128, { launchPriceKrw: 529000 }
  ).matched, false);
  assert.equal(matchDanawaItemToCatalogSku(
    { productCode: '77313999', productName: 'APPLE 2025 iPad A16 11세대 Cellular(128GB)', minPrice: 834870 },
    ipadModel, ipadSku128, { launchPriceKrw: 529000 }
  ).matched, false);
});

test('catalog migration and HTTP on isolated MySQL with synthetic fixtures', {
  skip: process.env.RUN_ISOLATED_CATALOG_MYSQL !== '1', timeout: 120000
}, async t => {
  const suffix = randomBytes(8).toString('hex');
  const schema = 'kiki_catalog_test_' + suffix;
  const username = 'kiki_c_' + suffix;
  const password = 'T9!a' + randomBytes(24).toString('hex');
  let admin, db, server, createdSchema = false, createdUser = false;
  const originalGetDatabase = connection.getDatabase;
  const step = (name, action) => t.test(name, async () => {
    try { await action(); } catch (err) {
      if (err.code === 'ERR_ASSERTION') throw err;
      throw new Error(err.original?.code || err.code || err.name);
    }
  });
  try {
    require('../config/loadEnv')();
    const config = require('../config/database').readConfig();
    assert.ok(['localhost', '127.0.0.1', '::1'].includes(config.options.host));
    assert.equal(config.database, 'final_project');
    admin = await mysql.createConnection({ host: config.options.host, port: config.options.port,
      user: config.username, password: config.password, connectTimeout: 5000 });
    const [version] = await admin.query('SELECT VERSION() version');
    connection.assertVersion(version[0].version);
    await admin.query(`CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    createdSchema = true;
    await admin.query("CREATE USER ?@'localhost' IDENTIFIED BY ?", [username, password]);
    createdUser = true;
    await admin.query(`GRANT ALL PRIVILEGES ON \`${schema}\`.* TO ?@'localhost'`, [username]);
    db = new Sequelize(schema, username, password, { ...config.options, logging: false });
    await assert.rejects(db.query('SELECT 1 FROM final_project.users LIMIT 0'),
      err => ['ER_TABLEACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR'].includes(err.original?.code));
    const [target] = await db.query('SELECT DATABASE() AS name', { type: QueryTypes.SELECT });
    assert.equal(target.name, schema);
    for (const file of ['migrations/001-initial.sql', 'migration-drafts/002-smartphone-details.draft.sql',
      'migration-drafts/003-smartphone-ram-key.draft.sql', 'migration-drafts/005-seller-prices.draft.sql',
      'migrations/006-smartphone-performance.sql']) {
      const sql = readFileSync(join(__dirname, '../db', file), 'utf8').replace(/^\s*--.*$/gm, '');
      for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) await db.query(statement);
    }
    const m = require('../db/models')(db, DataTypes, { extended: true });
    const phone = await m.smartphones.create({ brand: 'samsung', model_name: 'Fixture legacy smartphone',
      domestic_model_number: 'FIXTURE-PHONE', released_on_kr: '2024-01-31', os: 'android', verified: true,
      is_test: false, review_status: 'legacy', verified_at: testedAt,
      source_name: source.source_name, source_url: source.source_url });
    const phoneSku = await m.smartphone_variants.create({ smartphone_id: phone.id, storage_gb: 128,
      color: 'Fixture color', verified: true, review_status: 'legacy', verified_at: testedAt,
      source_name: source.source_name, source_url: source.source_url });
    const phonePrice = await m.price_observations.create({
      variant_id: phoneSku.id, source_name: 'synthetic legacy snapshot', source_url: 'https://example.invalid/phone',
      seller_name: '다나와 기준 최저가', amount_krw: 500000, observed_at: testedAt,
      expires_at: new Date(+testedAt + 86400000), conditions_text: 'synthetic [scope:capacity_common]',
      unconditional: false, in_stock: false, is_new: true, is_unlocked: true
    });
    const snapshot = () => db.query(`SELECT
      (SELECT COUNT(*) FROM smartphones) AS phones, (SELECT COUNT(*) FROM smartphone_variants) AS skus,
      (SELECT COUNT(*) FROM price_observations) AS prices, (SELECT COUNT(*) FROM owned_devices) AS devices,
      (SELECT COUNT(*) FROM recommendations) AS recommendations, (SELECT COUNT(*) FROM users) AS users`, { type: QueryTypes.SELECT });
    const before = await snapshot();
    await step('007 only adds new InnoDB tables, refuses wrong target and repeats safely', async () => {
      await assert.rejects(apply(db, 'final_project'), { code: 'CATALOG_MIGRATION_TARGET_MISMATCH' });
      await apply(db, schema);
      await apply(db, schema);
      assert.deepEqual(await snapshot(), before);
      const tables = await db.query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND LEFT(TABLE_NAME, 8)='catalog_'",
        { type: QueryTypes.SELECT });
      assert.equal(tables.length, 6);
      assert.ok(tables.every(row => row.ENGINE === 'InnoDB'));
      const dbCategories = await m.catalog_categories.findAll({ order: ['sort_order'] });
      assert.deepEqual(dbCategories.map(row => [row.code, row.label]), Object.entries(categories));
    });

    connection.getDatabase = () => db;
    const app = require('../app');
    server = await new Promise(resolve => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    const request = async (route, status = 200, options) => {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api/${route}`, options);
      const body = await res.json();
      assert.equal(res.status, status, route + ' ' + JSON.stringify(body));
      return body;
    };
    const registered = {};
    await step('six categories and empty listing, then five category-specific model/SKU detail and prices', async () => {
      const result = await request('catalog/categories');
      assert.deepEqual(result.data.map(row => row.code), Object.keys(categories));
      assert.deepEqual(await request('catalog/tablet/models'), { data: [], next_cursor: null });
      for (const [category, [specs, config, options]] of Object.entries(samples)) {
        const model = await m.catalog_models.create(modelRow(category, specs));
        const sku = await m.catalog_skus.create(skuRow(category, model.id, config, options));
        registered[category] = { model, sku };
        await assert.rejects(m.catalog_skus.create(skuRow(category, model.id, config, options)),
          { name: 'SequelizeUniqueConstraintError' });
        await m.catalog_price_observations.create({
          model_id: model.id, sku_id: sku.id, seller_name: 'Fixture seller', amount_minor: '345000',
          product_url: 'https://example.invalid/sale', observed_at: testedAt, checked_at: testedAt
        });
        const base = 'catalog/' + category + '/models/' + model.id;
        const detail = await request(base);
        assert.deepEqual(detail.data.specifications, specs);
        const listing = await request(base + '/skus');
        assert.equal(listing.data[0].sku_id, String(sku.id));
        assert.deepEqual(listing.data[0].options, options);
        assert.equal(listing.data[0].reference_price.amount_minor, '345000');
        assert.equal(listing.data[0].reference_price.scope, 'sku');
        assert.equal(listing.data[0].reference_price.product_url, 'https://example.invalid/sale');
      }
    });
    await step('compound foreign keys prevent cross-model and mismatched shared prices', async () => {
      const model = registered.tablet.model;
      const cfg = { storage_gb: 256, ram_gb: 8, connectivity: 'wifi', options_json: {} };
      const group = await m.catalog_price_groups.create({
        model_id: model.id, category_code: 'tablet', configuration_json: cfg, evidence_url: source.source_url
      });
      const input = skuRow('tablet', model.id, { storage_gb: 256, ram_gb: 8, connectivity: 'wifi' }, {});
      await assert.rejects(m.catalog_skus.create({ ...input, sku_code: 'other-connectivity',
        connectivity: 'cellular', price_group_id: group.id }), /foreign key constraint/);
      await assert.rejects(m.catalog_skus.create({ ...input, sku_code: 'other-ram',
        ram_gb: 16, price_group_id: group.id }), /foreign key constraint/);
      await assert.rejects(m.catalog_skus.create({ ...input, sku_code: 'other-storage',
        storage_gb: 512, price_group_id: group.id }), /foreign key constraint/);
      await assert.rejects(m.catalog_price_observations.create({ model_id: model.id, sku_id: registered.laptop.sku.id,
        seller_name: 'Fixture seller', amount_minor: '1', product_url: source.source_url,
        observed_at: testedAt, checked_at: testedAt }), /foreign key constraint/);
      for (const color of ['gray', 'blue']) {
        await m.catalog_skus.create({ ...input, color, sku_code: color, price_group_id: group.id });
      }
      await m.catalog_skus.create({ ...input, sku_code: 'unpriced', storage_gb: 512 });
      const observation = { model_id: model.id, price_group_id: group.id, amount_minor: '200000',
        seller_name: 'Fixture seller', product_url: source.source_url, observed_at: testedAt, checked_at: testedAt };
      await m.catalog_price_observations.create(observation);
      await assert.rejects(m.catalog_price_observations.create(observation), { name: 'SequelizeUniqueConstraintError' });
      const later = new Date(+testedAt + 1000);
      await m.catalog_price_observations.create({ ...observation, amount_minor: '210000', observed_at: later, checked_at: later });
      const invalid = new Date(+later + 1000);
      await m.catalog_price_observations.create({ ...observation, status: 'invalid', amount_minor: '1',
        observed_at: invalid, checked_at: invalid });
      const future = new Date('2099-01-01T00:00:00Z');
      await m.catalog_price_observations.create({ ...observation, amount_minor: '1', observed_at: future, checked_at: future });
      await m.catalog_price_observations.create({ ...observation, price_group_id: null });
      assert.equal(await m.catalog_price_observations.count({ where: { price_group_id: group.id } }), 4);
      const base = 'catalog/tablet/models/' + model.id;
      const listing = await request(base + '/skus?limit=2');
      assert.equal(listing.data[0].reference_price.scope, 'sku');
      assert.equal(listing.data[1].reference_price.amount_minor, '210000');
      assert.equal(listing.data[1].reference_price.scope, 'group');
      const remaining = await request(base + '/skus?limit=2&after=' + listing.next_cursor);
      assert.equal(remaining.data[0].reference_price.observation_id, listing.data[1].reference_price.observation_id);
      assert.equal(remaining.data[1].reference_price, null);
      assert.equal((await request(base)).data.reference_price.scope, 'model');
      assert.ok((await request(base + '/skus?currency=USD')).data.every(row => row.reference_price === null));
    });
    await step('publication gates, filters, read-only API and legacy smartphone IDs', async () => {
      const fixture = modelRow('tablet', {});
      const priv = await m.catalog_models.create({ ...fixture, model_number: 'pending',
        publication_status: 'private', verification_status: 'pending' });
      const testOnly = await m.catalog_models.create({ ...fixture, model_number: 'test-only', is_test: true });
      const second = await m.catalog_models.create({ ...fixture, model_name: 'Other fixture tablet', model_number: 'second' });
      const tablet = registered.tablet.model;
      const adminUser = await m.users.create({ email: 'fixture@example.invalid', password_hash: 'NOT_A_REAL_PASSWORD_HASH' });
      await m.catalog_admin_events.create({ actor_user_id: adminUser.id, model_id: tablet.id,
        sku_id: registered.tablet.sku.id, action: 'fixture_publish', changes_json: {} });
      await m.catalog_skus.create({ ...skuRow('tablet', tablet.id, {}, {}), sku_code: 'private',
        publication_status: 'private', verification_status: 'pending' });
      const listing = await request('catalog/tablet/models?limit=1&q=fixture&brand=FixtureCo&sort=id_desc');
      assert.equal(listing.data[0].model_id, String(second.id));
      const next = await request('catalog/tablet/models?limit=1&sort=id_desc&after=' + listing.next_cursor);
      assert.equal(next.data[0].model_id, String(tablet.id));
      assert.equal(next.next_cursor, null);
      await request('catalog/tablet/models/' + priv.id, 404);
      await request('catalog/tablet/models/' + testOnly.id + '/skus', 404);
      await request('catalog/tablet/models?include_test=true', 422);
      await request('catalog/tablet/models?limit=101', 422);
      await request('admin/session', 401);
      assert.ok((await request('catalog/tablet/models/' + tablet.id + '/skus')).data.every(row => row.sku_code !== 'private'));
      const list = await request('catalog/smartphone/models');
      assert.deepEqual(list.data.map(row => row.model_id), [String(phone.id)]);
      const legacy = await request('smartphones?limit=1&only_recommendable=false&comparison=true');
      const phoneOptions = await request('catalog/smartphone/models/' + phone.id + '/skus');
      assert.equal(phoneOptions.data[0].sku_id, String(phoneSku.id));
      assert.equal(phoneOptions.data[0].sku_id, legacy.data[0].variant_id);
      assert.equal(phoneOptions.data[0].ram_gb, null);
      assert.equal(phoneOptions.data[0].reference_price.amount_minor, String(legacy.data[0].price.amount_krw));
      assert.equal(phoneOptions.data[0].reference_price.product_url, legacy.data[0].price.danawa_product_url);
      assert.equal(phoneOptions.data[0].reference_price.observation_id, String(phonePrice.id));
      assert.equal(await m.catalog_admin_events.count(), 1);
      await apply(db, schema);
      assert.equal(await m.catalog_price_observations.count(), 10);
      assert.equal(await m.catalog_models.count(), 8);
      assert.equal(await m.smartphones.count(), 1);
      assert.equal(await m.smartphone_variants.count(), 1);
    });
    await step('reviewed import matches exact listing, is repeatable and rolls back a conflict', async () => {
      const { prepare, apply: importCatalog } = require('../services/catalog-import');
      const model = { ...modelRow('tablet', { chipset: 'Test processor' }), model_number: 'review-import' };
      const sku = { sku_code: 'review-256', color: 'black', options_json: {},
        storage_gb: 256, ram_gb: 8, connectivity: 'wifi', ...source };
      const listing = { seller_name: 'Test seller', amount_minor: '123456', currency: 'KRW', listing_title: 'Test tablet 256GB',
        product_url: 'https://prod.danawa.com/info/?pcode=100001', observed_at: testedAt, checked_at: testedAt,
        sku_match: { brand: model.brand, model_number: model.model_number, manufacturer_part_number: null,
          storage_gb: 256, ram_gb: 8, color: 'black', connectivity: 'wifi', options_json: {} },
        new_item: true, domestic_unit: true, unconditional: true, available: true, storage_authorized: true,
        reuse_basis: 'synthetic test only' };
      const entry = { model, skus: [{ sku, prices: [listing] }] };
      for (const change of [
        { sku_match: { ...listing.sku_match, storage_gb: 128 } },
        { sku_match: { ...listing.sku_match, ram_gb: 16 } },
        { sku_match: { ...listing.sku_match, brand: 'Other' } },
        { sku_match: { ...listing.sku_match, color: 'white' } },
        { sku_match: { ...listing.sku_match, connectivity: 'cellular' } },
        { sku_match: { ...listing.sku_match, model_number: 'other' } },
        { unconditional: false }, { domestic_unit: false }, { new_item: false },
        { listing_title: 'Test tablet 리퍼 상품' }, { listing_title: 'Test tablet 해외구매' },
        { listing_title: 'Test tablet 케이스' },
        { available: false }, { storage_authorized: false },
        { product_url: 'https://prod.danawa.com/info/ajax/forbidden' }
      ]) {
        assert.throws(() => prepare([{ model, skus: [{ sku, prices: [{ ...listing, ...change }] }] }]),
          { code: 'INVALID_INPUT' });
      }
      assert.deepEqual(await importCatalog(db, [entry]), { models: 1, skus: 1, prices: 1 });
      assert.deepEqual(await importCatalog(db, [entry]), { models: 0, skus: 0, prices: 0 });
      const modelRowInDb = await m.catalog_models.findOne({ where: { model_number: model.model_number } });
      const oldSku = await m.catalog_skus.findOne({ where: { model_id: modelRowInDb.id } });
      const newSku = { ...sku, sku_code: 'review-512', storage_gb: 512 };
      const alias = { ...sku, sku_code: 'duplicate' };
      await assert.rejects(importCatalog(db, [{ model, skus: [entry.skus[0],
        { sku: newSku, prices: [] }, { sku: alias, prices: [] }] }]), { code: 'CATALOG_IMPORT_CONFLICT' });
      assert.equal(await m.catalog_skus.count({ where: { model_id: modelRowInDb.id } }), 1);
      const latest = new Date(+testedAt + 3000);
      const newer = { ...listing, observed_at: latest, checked_at: latest, amount_minor: '99999' };
      assert.deepEqual(await importCatalog(db, [{ model, skus: [{ sku, prices: [newer] },
        { sku: newSku, prices: [] }] }]), { models: 0, skus: 1, prices: 1 });
      assert.equal(await m.catalog_price_observations.count({ where: { model_id: modelRowInDb.id } }), 2);
      const base = 'catalog/tablet/';
      const { data: skus } = await request(base + 'models/' + modelRowInDb.id + '/skus');
      const select = skus.map(item => modelRowInDb.id + ':' + item.sku_id).join(',');
      const result = await request(base + 'compare?items=' + select);
      assert.deepEqual(result.data.items.map(item => item.sku.reference_price?.amount_minor ?? null), ['99999', null]);
      assert.equal(result.data.items[0].sku.reference_price.price_source, 'danawa_reference');
      const storage = result.data.fields.find(field => field.key === 'storage_gb');
      assert.deepEqual(storage.values, [256, 512]);
      assert.deepEqual(storage.higher_sku_ids, [skus[1].sku_id]);
      const other = registered.tablet;
      const multiModel = await request(base + 'compare?items=' + select + ',' + other.model.id + ':' + other.sku.id);
      assert.deepEqual(multiModel.data.items.map(row => row.model.model_id),
        [String(modelRowInDb.id), String(modelRowInDb.id), String(other.model.id)]);
      const wrongParent = registered.tablet.model.id + ':' + oldSku.id;
      await request(base + 'compare?items=' + wrongParent + ',' + select.split(',')[1], 404);
      await request('catalog/laptop/compare?items=' + select, 404);
      await request(base + 'compare?items=' + Array(2).fill(select.split(',')[0]).join(','), 422);
      const hiddenSku = await m.catalog_skus.create({ ...sku, model_id: modelRowInDb.id, category_code: 'tablet',
        sku_code: 'hidden', publication_status: 'private' });
      await request(base + 'compare?items=' + select.split(',')[0] + ',' + modelRowInDb.id + ':' + hiddenSku.id, 404);
      await request('admin/session', 401);
    });
    await step('8-2.5 teammate dataset imports safely on top of 8-2, preserves IDs, is idempotent, and serves 6-category compare with Danawa prices', async () => {
      const before825 = await snapshot();
      const { apply: importCatalog } = require('../services/catalog-import');
      const entries82 = JSON.parse(readFileSync(join(__dirname, '../data/common-catalog-verified-8-2.json'), 'utf8'));
      const entries825 = JSON.parse(readFileSync(join(__dirname, '../data/common-catalog-teammate-8-2-5.json'), 'utf8'));

      assert.deepEqual(await importCatalog(db, entries82), { models: 5, skus: 10, prices: 0 });
      const ipadBefore = await m.catalog_models.findOne({ where: { category_code: 'tablet', brand: 'Apple', model_number: 'A3354' } });
      const budsBefore = await m.catalog_models.findOne({ where: { category_code: 'earbuds', brand: 'Samsung', model_number: 'SM-R530' } });

      assert.deepEqual(await importCatalog(db, entries825), { models: 59, skus: 67, prices: 56 });
      // Repeat runs are 100% idempotent
      assert.deepEqual(await importCatalog(db, entries825), { models: 0, skus: 0, prices: 0 });
      assert.deepEqual(await importCatalog(db, entries82), { models: 0, skus: 0, prices: 0 });

      const ipadAfter = await m.catalog_models.findOne({ where: { category_code: 'tablet', brand: 'Apple', model_number: 'A3354' } });
      const budsAfter = await m.catalog_models.findOne({ where: { category_code: 'earbuds', brand: 'Samsung', model_number: 'SM-R530' } });
      assert.equal(String(ipadAfter.id), String(ipadBefore.id));
      assert.equal(String(budsAfter.id), String(budsBefore.id));

      // Verify all 5 non-smartphone categories via HTTP compare API with real imported models and Danawa prices
      for (const cat of ['tablet', 'laptop', 'smartwatch', 'earbuds', 'speaker']) {
        const modelsRes = await request(`catalog/${cat}/models?limit=30`);
        assert.ok(modelsRes.data.length >= 1, `expected models in ${cat}`);
        const comparePairs = [];
        for (const mod of modelsRes.data) {
          const skusRes = await request(`catalog/${cat}/models/${mod.model_id}/skus`);
          for (const s of skusRes.data) {
            comparePairs.push(`${mod.model_id}:${s.sku_id}`);
            if (comparePairs.length === 2) break;
          }
          if (comparePairs.length === 2) break;
        }
        assert.equal(comparePairs.length, 2, `expected at least 2 SKUs in ${cat}`);
        const compRes = await request(`catalog/${cat}/compare?items=${comparePairs.join(',')}`);
        assert.equal(compRes.data.category, cat);
        assert.equal(compRes.data.items.length, 2);
      }
      assert.deepEqual(await snapshot(), before825);
    });
  } catch (err) {
    if (err.code === 'ERR_ASSERTION') throw err;
    throw new Error(err.original?.code || err.code || err.name);
  } finally {
    connection.getDatabase = originalGetDatabase;
    if (server) await new Promise(resolve => server.close(resolve));
    if (db) await db.close();
    if (createdUser) await admin.query("DROP USER ?@'localhost'", [username]);
    if (createdSchema) await admin.query(`DROP DATABASE \`${schema}\``);
    if (admin) await admin.end();
  }
});
