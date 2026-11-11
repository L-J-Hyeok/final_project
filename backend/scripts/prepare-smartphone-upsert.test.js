'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const prep = require('./prepare-smartphone-upsert');
const catalog = require('../services/smartphone-catalog');
const upgrade = require('../services/upgrade-advisor');
const raw = require('../data/smartphone-import-candidates-2026-11-11.json');
const baseline = require('../data/normalized-smartphones.json');
const expansion = require('../data/smartphone-expansion-2026-11-10.json');
const priority = require('../data/smartphone-priority-verification-2026-11-11.json');
const copy = value => structuredClone(value);
const one = () => ({ ...copy(raw), models: [copy(raw.models[0])], variants: [copy(raw.variants[0])] });
const existing = (b = one()) => ({ models: b.models.map(m => ({ ...copy(m), id: '101' })), variants: b.variants.map(v => ({ ...copy(v), id: '201' })) });

test('default and extended dry runs propose only two models/two variants, no writes', () => {
  for (const args of [[], ['--dry-run','--extended']]) {
    const p = prep.run(args); assert.equal(p.summary.models_to_insert,2); assert.equal(p.summary.variants_to_insert,2);
    assert.equal(p.summary.conflicts,0); assert.equal(p.db_writes,0); assert.equal(p.apply_supported,false); assert.deepEqual(p.price_observations,[]);
  }
});
test('apply and unknown options are rejected before any I/O', () => {
  assert.throws(() => prep.run(['--apply'],'/does-not-exist'), /WRITE_MODE_NOT_AVAILABLE/);
  assert.throws(() => prep.run(['--database=production']), /WRITE_MODE_NOT_AVAILABLE/);
});
test('baseline 16/29 is preserved byte-for-byte in memory', () => {
  const before=JSON.stringify(baseline), inventory=prep.baselineInventory(baseline), snapshot=JSON.stringify(inventory);
  prep.planUpsert(raw,inventory); assert.equal(JSON.stringify(baseline),before); assert.equal(JSON.stringify(inventory),snapshot);
  assert.equal(inventory.models.length,16);assert.equal(inventory.variants.length,29);
});
test('exact candidates remain bound to original evidence; fabricated RAM/price rejected', () => {
  assert.ok(prep.validateEvidence(raw,expansion,priority));
  const b=copy(raw);b.variants[0].ram_gb=12;assert.throws(()=>prep.validateEvidence(b,expansion,priority));
  const c=copy(raw);c.variants[0].launch_price.amount_krw=1;assert.throws(()=>prep.validateEvidence(c,expansion,priority));
});
test('duplicate domestic model numbers rejected despite different logical keys', () => {
  const b=one();b.models.push({...copy(b.models[0]),key:'duplicate'});assert.throws(()=>prep.validateBundle(b),/DUPLICATE_MODEL_NUMBER/);
});
test('NULL RAM duplicates rejected; actual zero RAM is invalid', () => {
  const b=one();b.variants[0].ram_gb=null;b.variants.push(copy(b.variants[0]));assert.throws(()=>prep.validateBundle(b),/DUPLICATE_VARIANT/);
  b.variants.pop();b.variants[0].ram_gb=0;assert.throws(()=>prep.validateBundle(b),/INVALID_CAPACITY/);
});
test('existing duplicate NULL identities make plan non-ready', () => {
  const b=one(), inv=existing(b);inv.variants[0].ram_gb=null;inv.variants.push(copy(inv.variants[0]));
  assert.ok(prep.planUpsert(b,inv).conflicts.some(c=>c.reason==='EXISTING_NULL_OR_RAM_KEY_DUPLICATE'));
});
test('same variant rerun preserves actual supplied IDs and has no insert', () => {
  const b=one(),p=prep.planUpsert(b,existing(b));assert.equal(p.insert_models.length,0);assert.equal(p.insert_variants.length,0);
  assert.equal(p.preserve_models[0].existing_id,'101');assert.equal(p.preserve_variants[0].existing_id,'201');
});
test('same model name/different number blocks child options', () => {
  const b=one(),inv=existing(b);inv.models[0].domestic_model_number='SM-CONFLICT';const p=prep.planUpsert(b,inv);
  assert.ok(p.conflicts.length);assert.equal(p.insert_variants.length,0);
});
test('unknown to known RAM without SKU identity proof is held', () => {
  const b=one(),inv=existing(b);inv.variants[0].ram_gb=null;const p=prep.planUpsert(b,inv,{extended:true});
  assert.ok(p.conflicts.some(c=>c.reason==='UNKNOWN_KNOWN_SKU_REVIEW_REQUIRED'));assert.equal(p.insert_variants.length,0);
});
test('same proven SKU enriches RAM proposal with old ID, no replacement', () => {
  const b={...copy(raw),models:[copy(raw.models[1])],variants:[copy(raw.variants[1])]}, inv=existing(b);inv.variants[0].ram_gb=null;
  const p=prep.planUpsert(b,inv,{extended:true});assert.equal(p.insert_variants.length,0);assert.equal(p.proposed_null_enrichments[0].existing_id,'201');
  assert.equal(p.proposed_null_enrichments[0].parent_lock_required,true);assert.equal(inv.variants[0].ram_gb,null);
});
test('known RAM variants need extended key when model/storage/color match', () => {
  const b=one(), inv=existing(b);inv.variants[0].ram_gb=12;
  assert.ok(prep.planUpsert(b,inv).conflicts.some(c=>c.reason==='CURRENT_UNIQUE_KEY_RAM_CONFLICT'));
  assert.equal(prep.planUpsert(b,inv,{extended:true}).insert_variants.length,1);
});
test('unknown color and unreviewed English/Korean aliases are held', () => {
  const b=one(),inv=existing(b);inv.variants[0].color='Titanium Jetblack';assert.ok(prep.planUpsert(b,inv).conflicts.some(c=>c.reason==='COLOR_MAPPING_REQUIRED'));
  b.variants[0].color='unspecified';assert.throws(()=>prep.validateBundle(b),/COLOR_UNVERIFIED/);
});
test('NULL battery/charging preserved; verified old values never erased', () => {
  const b=one(),inv=existing(b);b.models[0].battery_mah=null;b.models[0].wireless_charging=null;inv.models[0].wireless_charging=true;
  const p=prep.planUpsert(b,inv);assert.equal(inv.models[0].wireless_charging,true);assert.equal(p.proposed_null_enrichments.length,0);
  assert.equal(b.models[0].wireless_charging,null);
});
test('string false and numeric zero are not silently cast to Boolean', () => {
  const b=one();b.models[0].wireless_charging='false';assert.throws(()=>prep.validateBundle(b),/INVALID_BOOLEAN/);
  b.models[0].wireless_charging=0;assert.throws(()=>prep.validateBundle(b),/INVALID_BOOLEAN/);
});
test('missing launch price does not block a verified option', () => {
  const b=one();b.variants[0].launch_price.amount_krw=null;b.variants[0].launch_price.fact_status='unknown';b.variants[0].launch_price.source_ids=[];
  assert.equal(prep.planUpsert(b,{models:[],variants:[]}).insert_variants.length,1);
});
test('launch prices cannot become observations or current purchase prices', () => {
  const b=one();b.price_observations=[{amount_krw:b.variants[0].launch_price.amount_krw}];assert.throws(()=>prep.validateBundle(b));
  b.price_observations=[];b.variants[0].current_price={amount_krw:1};assert.throws(()=>prep.validateBundle(b),/CURRENT_PRICE_NOT_AUTHORIZED/);
});
test('unknown/held facts and premature production approval rejected', () => {
  const b=one();b.variants[0].fact_status='held';assert.throws(()=>prep.validateBundle(b));
  b.variants[0].fact_status='verified';b.production_approved=true;assert.throws(()=>prep.validateBundle(b));
});
test('URL protocol/credentials/host/port tricks rejected without network', () => {
  assert.ok(prep.safeUrl('https://www.samsung.com/sec/support/model/test/'));
  for (const u of ['http://www.samsung.com/','javascript:alert(1)','https://www.samsung.com.evil.test/','https://www.samsung.com@evil.test/','https://evil.test@www.samsung.com/','https://127.0.0.1/','https://www.samsung.com:444/','https://www.samsung.com/%0aevil','https://www.samsung.com/\nfoo']) assert.equal(prep.safeUrl(u),false,u);
});
test('existing recommendation helper excludes facts with no eligible sales price', () => {
  const m=raw.models[0],v=raw.variants[0],c={...m,...v,phone_verified:true,variant_verified:true,price:null};
  const hard={allowed_brands:['samsung','apple'],required_os:null,min_storage_gb:null,max_weight_g:null,min_refresh_hz:null,require_5g:false,require_wireless_charging:false,budget_max_krw:null};
  assert.equal(catalog.matchesHardConditions(c,hard,new Date('2026-11-11T00:00:00Z')),false);
});
test('existing upgrade helper distinguishes missing specs and dates without price', () => {
  const old={...raw.models[0],...raw.variants[0],verified:true,ram_gb:null,battery_mah:null,wireless_charging:null};
  const c={...old,price:null};const comparison=upgrade.buildDeviceCandidateComparison(old,c);
  assert.equal(comparison.fields.ram_gb.status,'insufficient_data');assert.equal(comparison.fields.battery_mah.status,'insufficient_data');
  assert.equal(upgrade.evaluateReleaseElapsed(old.released_on_kr,'2026-11-11').elapsed_threshold_years,false);
  assert.equal(upgrade.evaluateReleaseElapsed(null,'2026-11-11').needs_verification,true);
});
test('draft SQL keeps PK/FK and price table, retains old key until separate stage', () => {
  const dir=path.resolve(__dirname,'../db/migration-drafts');const sql=fs.readFileSync(path.join(dir,'002-smartphone-details.draft.sql'),'utf8');
  const statements=sql.replace(/--[^\n]*/g,'');
  assert.match(statements,/COALESCE\(ram_gb, 0\)/);assert.doesNotMatch(statements,/DROP|DELETE|UPDATE|price_observations|FOREIGN KEY|PRIMARY KEY/i);
  assert.match(statements,/DEFAULT 'legacy'/);assert.match(statements,/SET DEFAULT 'pending'/);
  assert.match(fs.readFileSync(path.join(dir,'003-smartphone-ram-key.draft.sql'),'utf8'),/DROP INDEX uq_variants_option/);
});

test('changed source hashes fail closed before producing an import plan', () => {
  const os=require('node:os');const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'smartphone-hash-test-'));
  try {
    fs.writeFileSync(path.join(tmp,'smartphone-import-candidates-2026-11-11.json'),JSON.stringify(raw));
    fs.writeFileSync(path.join(tmp,'normalized-smartphones.json'),'{}');
    assert.throws(()=>prep.run([],tmp),/SOURCE_HASH_MISMATCH/);
  } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
});
test('different explicit SKU cannot silently reuse an existing variant ID', () => {
  const b={...copy(raw),models:[copy(raw.models[1])],variants:[copy(raw.variants[1])]},inv=existing(b);
  inv.variants[0].official_sku='DIFFERENT-KR-SKU';assert.ok(prep.planUpsert(b,inv).conflicts.some(c=>c.reason==='EXACT_SKU_CONFLICT'));
});
