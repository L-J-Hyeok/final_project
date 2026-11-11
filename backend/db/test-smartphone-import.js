'use strict';
// Explicitly isolated test connection only. Does not import config/loadEnv/connection.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { QueryTypes, Sequelize } = require('sequelize');
const prep = require('../scripts/prepare-smartphone-upsert');
const dataDir = path.join(__dirname, '../data');
const read = name => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
function assertTarget(config, confirmation) {
  if (!config || !/^final_project_test_[a-z0-9_]+$/.test(config.database || '') || confirmation !== config.database ||
      !['127.0.0.1','::1'].includes(config.host) || config.username !== 'fp_import_test' ||
      !Number.isInteger(config.port) || config.port < 1 || config.port > 65535 ||
      Object.keys(config).some(k => !['database','host','port','username','password'].includes(k))) throw Error('TEST_TARGET_REQUIRED');
}
function assertGrants(grants, database) {
  const allowed = '`' + database + '`.*';
  for (const row of grants) {
    const grant = Object.values(row)[0];
    if (/^GRANT USAGE ON \*\.\* TO /i.test(grant)) continue;
    if (!grant.includes(' ON '+allowed+' TO ') || /WITH GRANT OPTION/i.test(grant)) throw Error('TEST_ACCOUNT_NOT_ISOLATED');
    const privileges=grant.slice(6,grant.indexOf(' ON ')).split(',').map(s=>s.trim().toUpperCase());
    if (!privileges.every(p=>['SELECT','INSERT'].includes(p))) throw Error('TEST_ACCOUNT_NOT_ISOLATED');
  }
}
function identity(row) { return row.brand.toLowerCase() + ':' + row.domestic_model_number.toUpperCase(); }
function assertPreserved(before, after) {
  const byId = new Map(after.map(r=>[String(r.id),r]));
  for (const old of before) assert.deepEqual(byId.get(String(old.id)),old,'EXISTING_ROW_CHANGED');
}
async function importTransaction(db, transaction, records, bundle, baseline, sources = {}) {
  const q = (sql,replacements={})=>db.query(sql,{type:QueryTypes.SELECT,replacements,transaction});
  const phones = await q('SELECT * FROM smartphones FOR UPDATE');
  const variants = await q('SELECT * FROM smartphone_variants FOR UPDATE');
  const inv = prep.baselineInventory(baseline);
  const byIdentity = new Map();
  for (const phone of phones) {
    if (!phone.domestic_model_number) continue;
    assert.ok(!byIdentity.has(identity(phone)), 'MODEL_DUPLICATE');byIdentity.set(identity(phone),phone);
  }
  // Refuse an empty/unrelated fixture. A dedicated copy of the 16/29 baseline is required.
  for (const m of inv.models) {
    const found=byIdentity.get(identity(m));assert.ok(found,'BASELINE_MODEL_MISSING');
    for (const v of inv.variants.filter(v=>v.model_key===m.key)) assert.ok(variants.some(x=>String(x.smartphone_id)===String(found.id)&&x.storage_gb===v.storage_gb&&x.ram_gb===v.ram_gb&&x.color===v.color),'BASELINE_VARIANT_MISSING');
  }
  const insert = (table,record)=>db.getQueryInterface().bulkInsert(table,[record],{transaction});
  let insertedModels=0,insertedVariants=0;
  for (const r of records) {
    const values=r.current_schema_values;
    if (!values.domestic_model_number || !values.released_on_kr) continue;
    const old=byIdentity.get(identity(values));
    if (old) {
      if (!inv.models.some(m=>identity(m)===identity(values))) {
        assert.equal(old.model_name,values.model_name,'EXISTING_MODEL_CONFLICT');
        assert.equal(old.released_on_kr,values.released_on_kr,'EXISTING_RELEASE_CONFLICT');
      }
      continue; // Never enrich or change an existing record in this executor.
    }
    assert.ok(!phones.some(x=>x.brand===values.brand&&x.model_name===values.model_name),'MODEL_NAME_CONFLICT');
    const sourceIds=[...(r.sources.identity||[]),...(r.sources.release||[]),...(r.sources.specs||[])];
    await insert('smartphones',{...values,verified:false,is_test:false,review_status:'pending',
      official_product_url:r.extension_values.official_product_url,
      details_json:JSON.stringify(r.extension_values.details_json),
      review_metadata_json:JSON.stringify({status:'pending',source_ids:sourceIds,sources:Object.fromEntries(sourceIds.map(id=>[id,sources[id]||null])),public:false})});
    const rows=await q('SELECT * FROM smartphones WHERE brand=:brand AND domestic_model_number=:number FOR UPDATE',{brand:values.brand,number:values.domestic_model_number});
    assert.equal(rows.length,1);byIdentity.set(identity(values),rows[0]);phones.push(rows[0]);insertedModels++;
  }
  // Only the two evidence-validated options, never the 99 configuration/color Cartesian product.
  for (const v of bundle.variants) {
    const m=bundle.models.find(m=>m.key===v.model_key);const phone=byIdentity.get(identity(m));assert.ok(phone);
    const siblings=await q('SELECT * FROM smartphone_variants WHERE smartphone_id=:id AND storage_gb=:storage FOR UPDATE',{id:phone.id,storage:v.storage_gb});
    const same=siblings.filter(x=>x.color===v.color);
    if (same.length) {
      assert.equal(same.length,1,'VARIANT_AMBIGUOUS');assert.equal(same[0].ram_gb,v.ram_gb,'RAM_REVIEW_REQUIRED');continue;
    }
    // Unknown aliases can refer to the same physical option. Do not guess/insert.
    assert.ok(!siblings.some(x=>x.color==='unspecified'||/^[\x00-\x7f]+$/.test(x.color)!==/^[\x00-\x7f]+$/.test(v.color)),'COLOR_MAPPING_REQUIRED');
    await insert('smartphone_variants',{smartphone_id:phone.id,storage_gb:v.storage_gb,ram_gb:v.ram_gb,color:v.color,verified:false,review_status:'pending',
      review_metadata_json:JSON.stringify({status:'pending',official_sku:v.official_sku,evidence:v.color_evidence,sources:m.source_refs}),
      launch_price_krw:v.launch_price.amount_krw,launch_price_metadata_json:JSON.stringify({...v.launch_price,status:'pending',sources:m.source_refs})});insertedVariants++;
  }
  // Capture before arrays separately; newly inserted rows must not enter preservation baseline.
  return {insertedModels,insertedVariants};
}
async function execute({apply=false,config,confirmation}={}) {
  const plan = require('../scripts/prepare-smartphone-model-merge').run([]);
  if (apply === false) return plan;
  if (apply !== true) throw Error('EXPLICIT_APPLY_REQUIRED');
  assertTarget(config,confirmation); // Before constructing/connecting a DB client.
  const review=read('smartphone-normalized-review-52.json'),baseline=read('normalized-smartphones.json'),bundle=read('smartphone-import-candidates-2026-11-11.json');
  // Existing planner validates candidate source hashes and exact option evidence.
  prep.run([]);
  const crypto=require('node:crypto');
  for(const [name,hash]of Object.entries(review.source_hashes)) {
    assert.ok(/^[a-z0-9.-]+\.json$/.test(name),'INVALID_SOURCE_NAME');
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dataDir,name))).digest('hex'),hash,'SOURCE_CHANGED');
  }
  const db=new Sequelize(config.database,config.username,config.password,{host:config.host,port:config.port,dialect:'mysql',logging:false,pool:{max:1,min:0},retry:{max:0}});
  try {
    await db.authenticate();
    const version=await db.query('SELECT VERSION() AS version',{type:QueryTypes.SELECT});
    assert.ok(/^8\.0\./.test(version[0].version) && Number(version[0].version.split('.')[2].split('-')[0]) >= 16 && !/mariadb/i.test(version[0].version),'MYSQL_VERSION_REQUIRED');
    const engines=await db.query("SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('smartphones','smartphone_variants')",{type:QueryTypes.SELECT});
    assert.equal(engines.length,2,'TARGET_TABLES_REQUIRED');
    assert.ok(engines.every(r=>r.ENGINE==='InnoDB'),'TRANSACTIONAL_TABLES_REQUIRED');

    assertGrants(await db.query('SHOW GRANTS FOR CURRENT_USER',{type:QueryTypes.SELECT}),config.database);
    const columns=await db.query("SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()",{type:QueryTypes.SELECT});
    for(const [table,needed]of Object.entries({smartphones:['review_status','official_product_url','details_json','review_metadata_json'],smartphone_variants:['review_status','review_metadata_json','launch_price_krw','launch_price_metadata_json','ram_identity_gb']}))for(const col of needed)assert.ok(columns.some(c=>c.TABLE_NAME===table&&c.COLUMN_NAME===col),'EXTENDED_SCHEMA_REQUIRED');
    return await db.transaction(async transaction=>{
      const opts={type:QueryTypes.SELECT,transaction};
      const selected=await db.query('SELECT DATABASE() AS name',opts);assert.equal(selected[0].name,config.database);
      const lockName='smartphone_import:'+config.database;
      const locked=await db.query('SELECT GET_LOCK(:name,0) AS acquired',{...opts,replacements:{name:lockName}});assert.equal(locked[0].acquired,1,'IMPORT_BUSY');
      try {
        const beforePhones=await db.query('SELECT * FROM smartphones FOR UPDATE',opts),beforeVariants=await db.query('SELECT * FROM smartphone_variants FOR UPDATE',opts);
        const result=await importTransaction(db,transaction,review.models,bundle,baseline,review.sources);
        assertPreserved(beforePhones,await db.query('SELECT * FROM smartphones',opts));assertPreserved(beforeVariants,await db.query('SELECT * FROM smartphone_variants',opts));
        return {...result,mode:'TEST_DATABASE_APPLY',publications:0};
      } finally {await db.query('SELECT RELEASE_LOCK(:name)',{...opts,replacements:{name:lockName}});}
    });
  } finally {await db.close();}
}
module.exports={execute,assertTarget,assertGrants,assertPreserved,importTransaction};
