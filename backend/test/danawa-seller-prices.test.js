'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const sellers = require('../services/danawa-seller-prices');
const catalog = require('../services/smartphone-catalog');
const preview = require('../services/smartphone-price-preview');
const upgrade = require('../services/upgrade-advisor');
const now = new Date('2026-11-13T03:00:00Z');
const variant = { variant_id: '1', smartphone_id: '1', brand: 'samsung', model_name: 'Galaxy S24', domestic_model_number: 'SM-S921N', storage_gb: 256, ram_gb: 8, color: '마블 그레이', phone_verified: true, variant_verified: true };
const offer = { seller_key: 'coupang', seller_name: '쿠팡', seller_product_url: 'https://www.coupang.com/test-only', product_name: '삼성 갤럭시 S24 SM-S921N 256GB RAM 8GB 마블 그레이 자급제', amount_krw: 800000, shipping_krw: 3000, unconditional: true, in_stock: true, is_new: true, is_unlocked: true, conditions_text: 'Mock only' };
const feed = { product_code: '12345678', maker: '삼성전자', observed_at: now.toISOString(), offers: [offer] };
function prepare(overrides = {}, extra = {}) { return sellers.prepareSellerObservations(variant, { ...feed, ...extra, offers: [{ ...offer, ...overrides }] }, { now }); }
module.exports = { variant, offer, feed, now }; // Shared only by isolated-DB harness.
test('seller extraction preserves exact matched options and links, rejects other RAM/color/storage', () => {
  assert.equal(prepare().accepted.length, 1);
  for (const [from,to] of [['256GB','512GB'],['8GB','12GB'],['마블 그레이','앰버 옐로우'],['SM-S921N','SM-S926N']]) {
    assert.equal(prepare({ product_name: offer.product_name.replace(from,to) }).accepted.length, 0);
  }
  assert.equal(prepare({ product_name: offer.product_name.replace('RAM 8GB','') }).accepted.length, 0);
  const p = prepare().accepted[0];
  assert.equal(p.price_metadata_json.seller_product_url, offer.seller_product_url);
  assert.equal(p.price_metadata_json.price_type, 'verified_sale');
});
test('seller allowlist distinguishes manufacturer store from certified reseller', () => {
  assert.equal(prepare({ seller_key: 'unknown' }).accepted.length, 0);
  assert.equal(prepare({ seller_key: 'samsung', seller_name: '삼성공식인증점' }).accepted.length, 0);
  assert.equal(prepare({ seller_key: 'samsung', seller_name: '삼성닷컴' }).accepted.length, 0);
  assert.equal(prepare({ seller_key: 'samsung', seller_name: '삼성닷컴', seller_product_url: 'https://www.samsung.com/sec/test' }).accepted.length, 1);
  assert.equal(prepare({ seller_key: 'apple', seller_name: 'Apple Store', seller_product_url: 'https://apple.com.evil.test/' }).accepted.length, 0);
});
test('unknown shipping/stock kept NULL as reference, never eligible budget cost', () => {
  const p = prepare({ shipping_krw: null, in_stock: null }).accepted[0];
  assert.equal(p.shipping_krw, null); assert.equal(p.in_stock, null);
  assert.equal(p.price_metadata_json.price_type, 'reference_sale');
  const price = catalog.evaluateObservation({ id: 1, ...p }, now);
  assert.equal(price.eligible, false); assert.equal(price.in_stock, null);
  assert.equal(catalog.effectiveBudgetPriceKrw(price), null);
  assert.equal(prepare({ unconditional: false }).accepted.length, 0);
  for (const text of ['중고','리퍼','해외구매','번호이동']) assert.equal(prepare({ product_name: offer.product_name + ' ' + text }).accepted.length, 0);
});
test('latest per seller precedes eligibility; price updates change lowest stored cost', () => {
  const a = { id: 1, ...prepare().accepted[0] };
  const b = { id: 2, ...prepare({seller_key:'gmarket',seller_name:'G마켓',seller_product_url:'https://gmarket.co.kr/test',amount_krw:810000}).accepted[0] };
  assert.equal(catalog.selectBestPrice([a,b],now).selected.total_krw,803000);
  const a2 = { ...a, id: 3, amount_krw: 820000, observed_at: new Date(now.getTime()+1000) };
  assert.equal(catalog.selectBestPrice([a,b,a2],new Date(now.getTime()+2000)).selected.seller_name,'G마켓');
  const gone = { ...a2,id:4,in_stock:false };
  assert.equal(catalog.selectBestPrice([a,b,gone],new Date(now.getTime()+2000)).selected.seller_name,'G마켓');
  assert.equal(catalog.selectBestPrice([a,b],new Date(now.getTime()+86400000)).selected,null);
});
test('stored seller price flows into candidate DTO, budget and upgrade comparison without AI price generation', () => {
  const row = { ...variant, released_on_kr:'2024-01-31',os:'android',weight_g:167,refresh_hz:120, supports_5g:true };
  const price = preview.buildCandidatePriceObject(row,[{id:1,...prepare().accepted[0]}],{NODE_ENV:'production'},now).selected;
  assert.equal(price.total_krw,803000); assert.ok(price.danawa_product_url); assert.ok(price.warning);
  const hard = { allowed_brands:['samsung'], required_os:null,min_storage_gb:null,max_weight_g:null,min_refresh_hz:null, budget_max_krw:802000 };
  assert.equal(catalog.matchesHardConditions({...row,price},hard,now),false);
  assert.equal(catalog.matchesHardConditions({...row,price},{...hard,budget_max_krw:804000},now),true);
  const comparison = upgrade.buildDeviceCandidateComparison({...row,verified:true},{...row,price});
  assert.equal(comparison.fields.price.candidate_total_krw,803000);
});
test('repeat fingerprints exact; renewed checks/history differ; no implicit storage', async () => {
  const first = prepare(); const again = prepare();
  assert.equal(first.accepted[0].observation_key,again.accepted[0].observation_key);
  assert.notEqual(first.accepted[0].observation_key,prepare({amount_krw:810000}).accepted[0].observation_key);
  assert.equal((await sellers.persistSellerObservations(null,first)).applied,false);
  await assert.rejects(sellers.persistSellerObservations(null,first,{apply:true}),/NOT_AUTHORIZED/);
  assert.equal(prepare({}, {observed_at:null}).accepted.length,0);
});
test('designated seller summary distinguishes unknown, expired, and overall Danawa minimum', () => {
  const p = catalog.evaluateObservation({id:1,...prepare().accepted[0]},now);
  const s = sellers.summarizeSellerPrices([p]);
  assert.equal(s.lowest.total_krw,803000);
  assert.equal(s.sellers.filter(x=>x.status==='unknown').length,4);
  assert.equal(s.overall_danawa_minimum_krw,null);
});
test('transaction writer preserves history, deduplicates exact observations and rolls back failed batch (mock DB)', async () => {
  let rows = [];
  const model = { rawAttributes:{price_metadata_json:{}},
    findOne: async ({where}) => rows.find(r=>r.observation_key===where.observation_key),
    create: async p => { if (p.variant_id==='999') throw new Error('BAD_FK'); rows.push(p); }
  };
  const db = { getQueryInterface:()=>({describeTable:async()=>({price_metadata_json:{},observation_key:{},in_stock:{allowNull:true},unconditional:{allowNull:true}})}),
    models:{price_observations:model,smartphone_variants:{findByPk:async()=>({id:1})}},
    transaction:async fn=>{const snapshot=rows.slice();try{return await fn({LOCK:{UPDATE:'UPDATE'}});}catch(e){rows=snapshot;throw e;}}
  };
  const opts={apply:true,allowDbWrite:true,authorizationRef:'mock-test',storageAuthorized:true};
  assert.equal((await sellers.persistSellerObservations(db,prepare(),opts)).inserted,1);
  assert.equal((await sellers.persistSellerObservations(db,prepare(),opts)).duplicates,1);
  assert.equal((await sellers.persistSellerObservations(db,prepare({amount_krw:810000}),opts)).inserted,1);
  const bad = prepare({amount_krw:820000});
  bad.accepted.push({...bad.accepted[0],variant_id:'999',observation_key:'bad'});
  await assert.rejects(sellers.persistSellerObservations(db,bad,opts),/BAD_FK/);
  assert.equal(rows.length,2);
});
