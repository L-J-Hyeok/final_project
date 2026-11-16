'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { priceAvailability, classify } = require('../services/catalog-price-availability');

test('only matched report evidence is applied; valid observations supersede old failures', () => {
  const sku = { category: 'laptop', brand: 'Apple', model_number: 'A3449',
    sku_code: 'A3449-16-512-10gpu-starlight', storage_gb: 512, ram_gb: 16, connectivity: 'wifi' };
  assert.equal(priceAvailability(sku, null).price_status, 'option_mismatch');
  assert.ok(priceAvailability(sku, null).price_status_reviewed_at);
  assert.deepEqual(priceAvailability({ ...sku, ram_gb: 24 }, null), { price_status: 'unknown' });
  assert.deepEqual(priceAvailability(sku, { amount_minor: '100' }), { price_status: 'available' });
});

test('rejected candidates do not prove stock or discontinuation', () => {
  assert.equal(classify(['NO_SEARCH_RESULTS:q']), 'no_new_seller');
  assert.equal(classify(['title -> [ABOVE_LAUNCH_PRICE_RATIO]']), 'price_excluded');
  assert.equal(classify(['title -> [OVERSEAS_KEYWORD:해외구매, TABLET_MODEL_MISMATCH]']), 'sale_condition_mismatch');
  assert.equal(classify(['title -> [OUT_OF_STOCK_KEYWORD:품절]']), 'unknown');
  assert.equal(classify(['unknown failure']), 'unknown');
});
