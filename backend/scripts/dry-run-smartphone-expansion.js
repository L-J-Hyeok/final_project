'use strict';
// No write mode. Read only the dedicated project's product tables in a READ ONLY transaction.
const fs = require('node:fs');
const { validate, DATA_PATH, BASELINE_PATH } = require('./validate-smartphone-expansion');
const connection = require('../db/connection');
async function run() {
  if (process.argv.length > 2) throw new Error('ARGUMENTS_NOT_ALLOWED');
  const data = JSON.parse(fs.readFileSync(DATA_PATH));
  const bytes = fs.readFileSync(BASELINE_PATH);
  if (!validate(data, bytes).passed) throw new Error('OFFLINE_VALIDATION_FAILED');
  const baseline = JSON.parse(bytes);
  const db = connection.getDatabase(); // Normal backend config loading; never display environment/config.
  if (db.config.database !== 'final_project') throw new Error('PROJECT_DATABASE_MISMATCH');
  let raw;
  try {
    raw = await db.connectionManager.getConnection();
    const query = sql => new Promise((resolve, reject) => raw.query(sql, (err, rows) => err ? reject(err) : resolve(rows)));
    const version = await query('SELECT VERSION() AS version');
    connection.assertVersion(version[0].version);
    await query('START TRANSACTION READ ONLY');
    try {
      const phones = await query('SELECT id, brand, model_name, domestic_model_number, released_on_kr FROM smartphones');
      const variants = await query('SELECT id, smartphone_id, storage_gb, ram_gb, color FROM smartphone_variants');
      const prices = await query('SELECT COUNT(*) AS count FROM price_observations');
      const columns = await query("SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('smartphones','smartphone_variants','price_observations') ORDER BY TABLE_NAME,ORDINAL_POSITION");
      const identity = m => m.brand.toLowerCase() + ':' + m.domestic_model_number;
      const byId = new Map(phones.map(p => [identity(p),p]));
      const preserved = baseline.smartphones.filter(m => m.verified && m.audit_metadata.migration_tier === 'verified_ready');
      const oldByKey = new Map(baseline.smartphones.map(m => [m.smartphone_key,m]));
      const missingBaselineModels = preserved.filter(m => !byId.has(identity(m))).map(m => m.smartphone_key);
      const missingBaselineVariants = baseline.smartphone_variants.filter(v => v.verified && preserved.some(m => m.smartphone_key === v.smartphone_key)).filter(v => {
        const p = byId.get(identity(oldByKey.get(v.smartphone_key)));
        return !p || !variants.some(x => String(x.smartphone_id) === String(p.id) && Number(x.storage_gb) === v.storage_gb && x.color === (v.color || 'unspecified'));
      }).map(v => ({ smartphone_key: v.smartphone_key, storage_gb: v.storage_gb, color: v.color }));
      const matched = data.models.filter(m => m.domestic_model_number && byId.has(identity(m))).map(m => m.key);
      const newIdentified = data.models.filter(m => m.domestic_model_number && !byId.has(identity(m))).map(m => m.key);
      const unresolved = data.models.filter(m => !m.domestic_model_number).map(m => m.key);
      const report = {
        checked_at: new Date().toISOString(), mode: 'read_only_transaction', db_writes: 0,
        table_counts: { smartphones: phones.length, smartphone_variants: variants.length, price_observations: Number(prices[0].count) },
        baseline_models_expected: preserved.length, missing_baseline_models: missingBaselineModels,
        baseline_variants_expected: baseline.smartphone_variants.filter(v => v.verified && preserved.some(m => m.smartphone_key === v.smartphone_key)).length,
        missing_baseline_variants: missingBaselineVariants,
        matching_db_models: matched, new_identified_review_models: newIdentified, unresolved_identity_models: unresolved,
        proposed_inserts: 0, proposed_updates: 0,
        reason: 'Review-only dataset; no approved exact color SKUs, no production price observations. This is an inventory comparison, not an apply-ready migration.',
        current_columns: columns.map(c => c.TABLE_NAME + '.' + c.COLUMN_NAME)
      };
      if (missingBaselineModels.length || missingBaselineVariants.length) report.warning = 'Baseline rows missing: investigate; never repair automatically';
      console.log(JSON.stringify(report, null, 2));
    } finally { await query('ROLLBACK'); }
  } finally {
    if (raw) await db.connectionManager.releaseConnection(raw);
    await connection.close();
  }
}
run().catch(async error => {
  await connection.close().catch(() => {});
  const allowed = ['ARGUMENTS_NOT_ALLOWED','OFFLINE_VALIDATION_FAILED','PROJECT_DATABASE_MISMATCH'];
  const code = allowed.includes(error.message) ? error.message : connection.publicCode(error);
  const cause = error.original || error.parent || error;
  const safeCauses = ['EPERM','EACCES','ECONNREFUSED','ETIMEDOUT','ENOTFOUND','ER_ACCESS_DENIED_ERROR','ER_BAD_DB_ERROR'];
  console.error(JSON.stringify({ mode: 'read_only_transaction', passed: false, code,
    cause: safeCauses.includes(cause.code) ? cause.code : 'UNCLASSIFIED', db_writes: 0 }));
  process.exitCode = 1;
});
