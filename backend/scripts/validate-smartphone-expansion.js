'use strict';
// Offline review checks only; no application config, environment, DB or network imports.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const DATA_PATH = path.join(__dirname, '../data/smartphone-expansion-2026-11-10.json');
const BASELINE_PATH = path.join(__dirname, '../data/normalized-smartphones.json');
function validate(d, baselineBytes) {
  const errors = [];
  const check = (ok, msg) => { if (!ok) errors.push(msg); };
  const refs = (ids, label, required = true) => {
    check(Array.isArray(ids) && (!required || ids.length > 0), label + ': missing evidence');
    for (const id of ids || []) check(Boolean(d.sources[id]), label + ': unknown source');
  };
  check(d.schema_version === 'smartphone-expansion-review/1', 'schema version');
  check(d.production_approved === false, 'review must not be production approved');
  check(d.price_observations.length === 0, 'launch prices/excerpts must not become live prices');
  check(d.scope.sale_start_from === '2024-01-01' && d.scope.sale_start_to === '2026-11-10', 'scope');
  check(crypto.createHash('sha256').update(baselineBytes).digest('hex') === d.baseline.sha256, 'baseline changed');
  for (const [id, s] of Object.entries(d.sources)) {
    try { const u = new URL(s.url); check(u.protocol === 'https:' && !u.username && !u.password, id + ': unsafe URL'); }
    catch (_) { errors.push(id + ': invalid URL'); }
    check(Number.isFinite(Date.parse(s.checked_at)), id + ': invalid timestamp');
  }
  const baseline = JSON.parse(baselineBytes.toString());
  const keys = new Set(), identities = new Set();
  for (const m of d.models) {
    check(!keys.has(m.key), 'duplicate model key'); keys.add(m.key);
    check(['samsung','apple'].includes(m.brand), m.key + ': brand');
    check(m.review_status === 'review_only' && m.production_approved === false, m.key + ': approval');
    refs(m.release_source_ids, m.key); refs(m.spec_source_ids, m.key);
    refs(m.identity_source_ids, m.key, false); refs(m.color_source_ids, m.key, m.colors_kr !== null);
    if (m.domestic_model_number !== null) {
      const identity = m.brand + ':' + m.domestic_model_number;
      check(!identities.has(identity), 'duplicate domestic model'); identities.add(identity);
      check(/^(SM-[A-Z0-9]+|A\d{4})$/.test(m.domestic_model_number), m.key + ': model number');
      check(m.identity_source_ids.length > 0 || Boolean(m.baseline_key), m.key + ': identity evidence');
    }
    if (m.released_on_kr !== null) {
      const day = m.released_on_kr;
      const valid = /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day));
      check(valid && new Date(day).toISOString().slice(0, 10) === day, m.key + ': calendar date');
      check(day >= d.scope.sale_start_from && day <= d.scope.sale_start_to, m.key + ': outside release window');
      check(m.release_status === 'confirmed_kr_general_sale', m.key + ': date status');
    } else check(m.release_status === 'hold_exact_sale_date', m.key + ': missing date must be held');
    if (m.baseline_key) {
      const old = baseline.smartphones.find(x => x.smartphone_key === m.baseline_key);
      check(old && old.domestic_model_number === m.domestic_model_number, m.key + ': baseline identity');
    }
    for (const [field, value] of Object.entries(m.specs)) {
      if (typeof value === 'number') check(Number.isFinite(value) && value > 0, m.key + ': invalid ' + field);
      if (['wireless_charging','reverse_wireless','supports_5g','nfc'].includes(field)) check(value === null || typeof value === 'boolean', m.key + ': tristate ' + field);
    }
    check(JSON.stringify(Object.keys(m.specs).filter(f => m.specs[f] === null).sort()) === JSON.stringify([...m.missing_spec_fields].sort()), m.key + ': missing-spec list');
    const configs = new Set();
    for (const c of m.configurations) {
      const key = JSON.stringify([c.storage_gb,c.ram_gb,c.color_restriction]);
      check(!configs.has(key), m.key + ': duplicate option'); configs.add(key);
      check(Number.isInteger(c.storage_gb) && c.storage_gb > 0, m.key + ': storage');
      check(c.ram_gb === null || Number.isInteger(c.ram_gb) && c.ram_gb > 0, m.key + ': RAM');
      check(c.exact_color_sku_verified === false, m.key + ': unapproved color SKU');
      refs(c.option_source_ids, m.key);
      const p = c.launch_price;
      check(p.kind === 'official_kr_launch' && p.currency === 'KRW', m.key + ': price kind');
      check(p.amount_krw === null || Number.isInteger(p.amount_krw) && p.amount_krw > 0, m.key + ': price value');
      check(p.verified === (p.amount_krw !== null), m.key + ': price evidence flag');
      refs(p.source_ids, m.key, p.amount_krw !== null);
    }
  }
  for (const r of d.current_price_reviews) {
    check(keys.has(r.model_key), 'price model'); refs([r.source_id], 'price excerpt');
    check(r.production_approved === false && r.observed_at === null && r.expires_at === null, 'cached price cannot be live');
    check(['in_stock','is_new','is_unlocked','unconditional'].every(f => r[f] === null), 'unverified purchase conditions');
    check(r.hold_reasons.length > 0, 'price hold reason');
  }
  const stats = {
    model_records: keys.size,
    confirmed_general_sale_dates: d.models.filter(m => m.released_on_kr).length,
    held_exact_sale_dates: d.models.filter(m => !m.released_on_kr).length,
    storage_ram_configurations: d.models.reduce((n,m) => n + m.configurations.length, 0),
    launch_price_values: d.models.reduce((n,m) => n + m.configurations.filter(c => c.launch_price.amount_krw !== null).length, 0),
    live_current_prices: d.price_observations.length,
    review_only_price_excerpts: d.current_price_reviews.length
  };
  check(JSON.stringify(stats) === JSON.stringify(d.summary), 'summary mismatch');
  return { passed: errors.length === 0, errors, stats };
}
if (require.main === module) {
  const result = validate(JSON.parse(fs.readFileSync(DATA_PATH)), fs.readFileSync(BASELINE_PATH));
  console.log(JSON.stringify(result, null, 2)); process.exitCode = result.passed ? 0 : 1;
}
module.exports = { validate, DATA_PATH, BASELINE_PATH };
