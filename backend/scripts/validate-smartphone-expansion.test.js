'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { validate, DATA_PATH, BASELINE_PATH } = require('./validate-smartphone-expansion');
const bytes = fs.readFileSync(BASELINE_PATH);
const original = JSON.parse(fs.readFileSync(DATA_PATH));
test('real dataset passes without live prices', () => {
  const result = validate(original, bytes); assert.deepEqual(result.errors, []); assert.equal(result.stats.live_current_prices, 0);
});
for (const [name, corrupt] of [
  ['duplicate identity', d => { d.models[1].domestic_model_number = d.models[0].domestic_model_number; }],
  ['outside date', d => { d.models[0].released_on_kr = '2026-11-11'; }],
  ['invalid calendar date', d => { d.models[0].released_on_kr = '2025-02-30'; }],
  ['unknown source', d => { d.models[0].release_source_ids = ['nonexistent']; }],
  ['inferred stock', d => { d.current_price_reviews[0].in_stock = true; }],
  ['cached price as live', d => { d.current_price_reviews[0].observed_at = d.generated_at; }],
  ['launch price as sale price', d => { d.price_observations.push({ amount_krw: 1254000 }); }],
  ['duplicate option', d => { d.models[0].configurations.push(d.models[0].configurations[0]); }],
  ['unknown RAM converted to zero', d => { d.models[0].configurations[0].ram_gb = 0; }],
  ['automatic approval', d => { d.production_approved = true; }],
  ['invented exact color SKU', d => { d.models[0].configurations[0].exact_color_sku_verified = true; }]
]) test('rejects ' + name, () => {
  const d = structuredClone(original); corrupt(d); assert.equal(validate(d, bytes).passed, false);
});
test('baseline drift blocks review reuse', () => assert.equal(validate(original, Buffer.concat([bytes, Buffer.from(' ')])).passed, false));
test('S25 Ultra 1TB RAM options remain distinct', () => {
  const configs = original.models.find(m => m.key === 's25-ultra').configurations.filter(c => c.storage_gb === 1024);
  assert.deepEqual(configs.map(c => c.ram_gb), [12,16]); assert.deepEqual(configs[1].color_restriction, ['Titanium Jetblack']);
});
