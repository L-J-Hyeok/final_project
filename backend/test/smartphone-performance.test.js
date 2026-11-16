'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const performance = require('../services/smartphone-performance');

const sample = {
  smartphone_id: '1', domestic_model_number: 'FIXTURE-A', metric: 'cpu', unit: 'score',
  method_name: 'Synthetic protocol only', method_version: '1.0', test_conditions: 'Isolated test',
  device_settings: 'Fixed fixture settings', source_name: 'Synthetic fixture only',
  source_url: 'https://example.invalid/synthetic', measured_value: 123,
  measured_on: '2025-01-01', checked_on: '2025-01-02'
};

test('performance validation rejects malformed sources, dates, values and units', () => {
  for (const changes of [
    { source_url: 'http://example.invalid/' }, { source_url: 'https://u:p@example.invalid/' },
    { method_version: '' }, { device_settings: '' }, { measured_on: '2025-02-30' },
    { checked_on: '2024-12-31' }, { unit: 'fps' }, { measured_value: '123' },
    { measured_value: Infinity }, { measured_value: -1 }, { measured_value: 1000000001 }
  ]) assert.throws(() => performance.normalizeMeasurement({ ...sample, ...changes }), /INVALID_PERFORMANCE/);
});

test('missing optional measurement table leaves existing engines with no evidence', async () => {
  const noTable = { models: { [performance.TABLE]: { findAll: async () => {
    throw Object.assign(new Error('missing'), { original: { code: 'ER_NO_SUCH_TABLE' } });
  } } } };
  assert.deepEqual(await performance.loadVerified(noTable, [{ smartphone_id: '1' }]), []);
  assert.equal(performance.compareMeasurements([], { smartphone_id: '1' }, { smartphone_id: '2' }).status, 'insufficient_data');
});

test('additive MySQL migration and validated measurement import in an isolated schema', async () => {
  require('../config/loadEnv')();
  const cfg = require('../config/database').readConfig();
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(cfg.options.host));
  const mysql = require('mysql2/promise');
  const { Sequelize, DataTypes } = require('sequelize');
  const schema = 'kiki_perf_test_' + randomBytes(8).toString('hex');
  const admin = await mysql.createConnection({ host: cfg.options.host, port: cfg.options.port,
    user: cfg.username, password: cfg.password });
  let db, created = false;
  try {
    await admin.query(`CREATE DATABASE \`${schema}\``);
    created = true;
    db = new Sequelize(schema, cfg.username, cfg.password, cfg.options);
    await require('../db/migrate').apply(db);
    require('../db/models')(db, DataTypes);
    for (const [id, model] of [[1, 'FIXTURE-A'], [2, 'FIXTURE-B']]) {
      await db.models.smartphones.create({ id, brand: 'synthetic', model_name: model,
        domestic_model_number: model, released_on_kr: '2025-01-01', os: 'android',
        verified: true, is_test: true, source_name: 'Synthetic fixture only',
        source_url: sample.source_url, verified_at: new Date() });
      await db.models.smartphone_variants.create({ id, smartphone_id: id, storage_gb: 256,
        ram_gb: 8, verified: true, verified_at: new Date(), source_name: 'Synthetic fixture only',
        source_url: sample.source_url });
    }
    const migration = require('../db/migrate-performance');
    await assert.rejects(migration.apply(db, 'wrong_target'), /TARGET_MISMATCH/);
    assert.deepEqual(await performance.loadVerified(db, [{ smartphone_id: '1' }]), []);
    await migration.apply(db, schema);
    await migration.apply(db, schema);
    assert.equal(await db.models.smartphones.count(), 2);
    assert.equal(await db.models.smartphone_variants.count(), 2);
    const verified = { ...sample, verification_status: 'verified' };
    const store = row => performance.storeMeasurement(db, row, { reviewed: true });
    await assert.rejects(performance.storeMeasurement(db, verified), /REVIEW_REQUIRED/);
    await assert.rejects(store({ ...verified, domestic_model_number: 'FIXTURE-B' }), /MODEL_MISMATCH/);
    await assert.rejects(store({ ...verified, variant_id: '2' }), /VARIANT_MISMATCH/);
    await store(verified);
    await assert.rejects(store({ ...verified, measured_value: 124 }), { name: 'SequelizeUniqueConstraintError' });

    for (const [metric, unit] of [['gpu', 'score'], ['sustained', 'fps'], ['camera_photo', 'score'],
      ['camera_video', 'score'], ['battery_runtime', 'minutes']]) {
      await store({ ...verified, variant_id: '1', metric, unit });
    }
    await store({ ...verified, verification_status: 'pending', metric: 'gpu', method_version: 'unreviewed' });
    await store({ ...verified, smartphone_id: '2', domestic_model_number: 'FIXTURE-B' });
    await store({ ...verified, smartphone_id: '2', domestic_model_number: 'FIXTURE-B', metric: 'gpu', method_version: '2.0' });

    const owned = { smartphone_id: '1', variant_id: '1' };
    const candidate = { smartphone_id: '2', variant_id: '2' };
    const rows = await performance.loadVerified(db, [owned, candidate]);
    assert.equal(rows.length, 8);
    const summary = performance.summarizeMeasurements(rows, owned);
    assert.deepEqual([summary.game, summary.camera, summary.battery], [true, true, true]);
    assert.equal(summary.measurements.length, 6);
    assert.equal(performance.summarizeMeasurements(rows, { smartphone_id: '1' }).measurements.length, 1);
    const comparison = performance.compareMeasurements(rows, owned, candidate);
    assert.equal(comparison.status, 'comparable');
    assert.deepEqual(comparison.comparisons.map(pair => pair.metric), ['cpu']);
    assert.deepEqual(comparison.unmatched_candidate.map(row => row.metric), ['gpu']);
    assert.equal(performance.compareMeasurements(rows.filter(row => row.metric === 'gpu'), owned, candidate).status, 'different_protocol');
  } finally {
    try {
      if (db) await db.close();
      if (created) await admin.query(`DROP DATABASE \`${schema}\``);
    } finally { await admin.end(); }
  }
});
