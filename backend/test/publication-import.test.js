'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const publication=require('../services/product-publication');
const importer=require('../db/test-smartphone-import');
const prep=require('../scripts/prepare-smartphone-model-merge');
const {Sequelize,DataTypes}=require('sequelize');
const config={database:'final_project_test_catalog',host:'127.0.0.1',port:3306,username:'fp_import_test',password:'fixture'};
test('publication states fail closed; legacy verified kept',()=>{
 for(const status of ['pending','held','rejected',null])assert.equal(publication.isPublic({verified:true,review_status:status},{hasReviewStatus:true}),false);
 for(const status of ['legacy','approved'])assert.equal(publication.isPublic({verified:1,review_status:status},{hasReviewStatus:true}),true);
 assert.equal(publication.isPublic({verified:false,review_status:'approved'},{hasReviewStatus:true}),false);
 assert.equal(publication.isPublic({verified:1}),true);
});
test('SQL before/after/partial migration always checks verified and production-only',()=>{
 assert.equal(publication.predicate([]),'(s.verified = 1 AND s.is_test = 0 AND v.verified = 1)');
 const sql=publication.predicate([{table_name:'smartphones'},{table_name:'smartphone_variants'}]);
 assert.match(sql,/s.review_status/);assert.match(sql,/v.review_status/);
 assert.doesNotMatch(publication.predicate([{table_name:'smartphones'}],false),/v\./);
});
test('schema detection failure never falls back to permissive SQL',async()=>{
 await assert.rejects(publication.sql({query:async()=>{throw Error('permission denied')}}));
});
test('guard rejects production/default/root/remote/extra connection options',()=>{
 importer.assertTarget(config,config.database);
 for(const change of [{database:'final_project'},{host:'remote.example'},{username:'root'},{socketPath:'/tmp/mysql.sock'},{database:'final_project_test_%'}])assert.throws(()=>importer.assertTarget({...config,...change},config.database));
 assert.throws(()=>importer.assertTarget(config,'yes'));
});
test('test DB account must have no cross database/global/role grants',()=>{
 importer.assertGrants([{'grant':'GRANT USAGE ON *.* TO user'},{'grant':'GRANT SELECT, INSERT ON `final_project_test_catalog`.* TO user'}],config.database);
 for(const grant of ['GRANT ALL PRIVILEGES ON *.* TO user','GRANT SELECT ON `final_project`.* TO user','GRANT role TO user','GRANT SELECT, INSERT ON `final_project_test_catalog`.* TO user WITH GRANT OPTION'])assert.throws(()=>importer.assertGrants([{grant}],config.database));
});
test('apply guard blocks before connecting; default returns 44 model plan',async()=>{
 await assert.rejects(importer.execute({apply:true,config:{...config,database:'final_project'},confirmation:'final_project'}),/TEST_TARGET_REQUIRED/);
 const p=await importer.execute();assert.equal(p.summary.identified,44);assert.equal(p.summary.new_model_candidates,33);assert.equal(p.held.length,8);assert.equal(p.summary.baseline_preserved_models,16);assert.equal(p.summary.baseline_preserved_variants,29);
});
test('preservation check includes IDs/FKs/null/known values',()=>{
 const before=[{id:'1',smartphone_id:'2',ram_gb:null,verified:1}];
 importer.assertPreserved(before,[...structuredClone(before),{id:'3'}]);
 for(const change of [{id:'9'},{smartphone_id:'3'},{ram_gb:0},{verified:0}])assert.throws(()=>importer.assertPreserved(before,[{...before[0],...change}]));
});
test('ORM opt-in maps extension without generated writable column or forced schema',async()=>{
 for(const extended of [false,true]){
  const db=new Sequelize('unused','unused','unused',{dialect:'mysql',logging:false});
  try{const m=require('../db/models')(db,DataTypes,{extended});assert.equal(!!m.smartphones.rawAttributes.review_status,extended);assert.equal(!!m.smartphone_variants.rawAttributes.launch_price_krw,extended);assert.equal(m.smartphone_variants.rawAttributes.ram_identity_gb,undefined);if(extended)assert.equal(m.smartphones.build({brand:'samsung',model_name:'fixture'}).review_status,'pending');}finally{await db.close();}
 }
});
// Exercise actual route handlers with a fake DB, not an HTTP/MySQL integration claim.
const connection=require('../db/connection');
async function invoke(router,method,route,req){
 const layer=router.stack.find(l=>l.route?.path===route&&l.route.methods[method]);let result;
 await layer.route.stack[0].handle(req,{json:x=>{result=x},status:()=>({end(){}})},e=>{throw e});return result;
}
test('public list/detail/options exclude pending even when optional filter disabled',async()=>{
 const saved=connection.getDatabase;const queries=[];
 const db={query:async sql=>{queries.push(sql);if(sql.includes('information_schema'))return [{table_name:'smartphones'},{table_name:'smartphone_variants'}];assert.match(sql,/s.review_status IN/);assert.match(sql,/v.review_status IN/);return [];}};
 connection.getDatabase=()=>db;
 try{
  const smartphones=require('../routes/smartphones'),member=require('../routes/member');
  await invoke(smartphones,'get','/smartphones',{query:{only_recommendable:'false'},session:{user_id:'1'}});
  await assert.rejects(invoke(smartphones,'get','/smartphones/:variantId',{params:{variantId:'9'},query:{}}),e=>e.code==='NOT_FOUND');
  await invoke(member,'get','/owned-device-options',{query:{q:'Galaxy'},session:{user_id:'1'}});
  assert.ok(queries.length>=6);
 }finally{connection.getDatabase=saved;}
});
test('owned hidden product remains visible only through owner-scoped list',async()=>{
 const saved=connection.getDatabase;
 connection.getDatabase=()=>({models:{owned_devices:{findAll:async options=>{assert.equal(options.where.user_id,'owner');return [{toJSON:()=>({id:'1',user_id:'owner',variant_id:'7',category:'smartphone'})}]}}},query:async sql=>{assert.doesNotMatch(sql,/review_status/);return [{id:'7',verified:0}]}});
 try{const result=await invoke(require('../routes/member'),'get','/owned-devices',{query:{},session:{user_id:'owner'}});assert.equal(result.data[0].product.id,'7');assert.equal(result.data[0].user_id,undefined);}finally{connection.getDatabase=saved;}
});
test('test executor inserts 33 models and two proven variants, rerun preserves all IDs',async()=>{
 const base=require('../data/normalized-smartphones.json'),review=require('../data/smartphone-normalized-review-52.json'),bundle=require('../data/smartphone-import-candidates-2026-11-11.json');
 const inv=require('../scripts/prepare-smartphone-upsert').baselineInventory(base);
 const phones=inv.models.map((m,i)=>({...structuredClone(m),id:String(i+1)}));
 const variants=inv.variants.map((v,i)=>({...structuredClone(v),id:String(i+1),smartphone_id:phones.find(p=>p.key===v.model_key).id}));
 const beforePhones=structuredClone(phones),beforeVariants=structuredClone(variants);
 const db={query:async(sql,{replacements:r})=>{
  if(sql.includes('FROM smartphone_variants'))return structuredClone(sql.includes('WHERE')?variants.filter(v=>String(v.smartphone_id)===String(r.id)&&v.storage_gb===r.storage):variants);
  if(sql.includes('FROM smartphones'))return structuredClone(sql.includes('WHERE')?phones.filter(p=>p.brand===r.brand&&p.domestic_model_number===r.number):phones);
  throw Error('UNEXPECTED_SQL');
 },getQueryInterface:()=>({bulkInsert:async(table,records)=>{const target=table==='smartphones'?phones:variants;for(const r of records)target.push({...structuredClone(r),id:String(target.length+1)});}})};
 const result=await importer.importTransaction(db,{},review.models,bundle,base,review.sources);
 assert.deepEqual(result,{insertedModels:33,insertedVariants:2});
 importer.assertPreserved(beforePhones,phones);importer.assertPreserved(beforeVariants,variants);
 assert.ok(phones.slice(16).every(p=>p.verified===false&&p.review_status==='pending'));
 assert.ok(phones.slice(16).some(p=>p.os===null));
 const again=await importer.importTransaction(db,{},review.models,bundle,base,review.sources);
 assert.deepEqual(again,{insertedModels:0,insertedVariants:0});
});
test('recommendation candidate query always includes publication status',async()=>{
 const fs=require('node:fs');
 // Narrow static integration assertion supplements predicate/route tests, not a DB query test.
 const s=fs.readFileSync(require.resolve('../routes/smartphones'),'utf8');
 assert.match(s,/const where = \[\s*await publication.sql\(db\(\)\)/);
 assert.match(fs.readFileSync(require.resolve('../routes/recommendations'),'utf8'),/variantIds\) AND \$\{await smartphonesRouter.publicationWhere\(\)\}/);
});
test('execution failure after writes propagates through managed transaction rollback (mock DB)',async()=>{
 // Stub every DB entry point: no network, credentials or .env access.
 const names=['authenticate','query','transaction','getQueryInterface','close'];
 const saved=Object.fromEntries(names.map(n=>[n,Sequelize.prototype[n]]));
 const base=require('../data/normalized-smartphones.json');const inv=require('../scripts/prepare-smartphone-upsert').baselineInventory(base);
 let phones=inv.models.map((m,i)=>({...structuredClone(m),id:String(i+1)}));
 let variants=inv.variants.map((v,i)=>({...structuredClone(v),id:String(i+1),smartphone_id:phones.find(p=>p.key===v.model_key).id}));
 const original=JSON.stringify({phones,variants});let rolledBack=false,committed=false,writes=0;
 try{
  Sequelize.prototype.authenticate=async()=>{};Sequelize.prototype.close=async()=>{};
  Sequelize.prototype.query=async function(sql,options={}){
   const r=options.replacements||{};
   if(sql.includes('VERSION()'))return [{version:'8.0.36'}];
   if(sql.includes('information_schema.TABLES'))return ['smartphones','smartphone_variants'].map(TABLE_NAME=>({TABLE_NAME,ENGINE:'InnoDB'}));
   if(sql.startsWith('SHOW GRANTS'))return [{grant:'GRANT SELECT, INSERT ON `final_project_test_catalog`.* TO user'}];
   if(sql.includes('information_schema.COLUMNS'))return Object.entries({smartphones:['review_status','official_product_url','details_json','review_metadata_json'],smartphone_variants:['review_status','review_metadata_json','launch_price_krw','launch_price_metadata_json','ram_identity_gb']}).flatMap(([TABLE_NAME,cols])=>cols.map(COLUMN_NAME=>({TABLE_NAME,COLUMN_NAME})));
   if(sql.includes('DATABASE() AS name'))return [{name:config.database}];
   if(sql.includes('GET_LOCK'))return [{acquired:1}];if(sql.includes('RELEASE_LOCK'))return [];
   if(sql.includes('FROM smartphone_variants'))return structuredClone(sql.includes('WHERE')?variants.filter(v=>String(v.smartphone_id)===String(r.id)&&v.storage_gb===r.storage):variants);
   if(sql.includes('FROM smartphones'))return structuredClone(sql.includes('WHERE')?phones.filter(p=>p.brand===r.brand&&p.domestic_model_number===r.number):phones);
   throw Error('UNEXPECTED_QUERY');
  };
  Sequelize.prototype.getQueryInterface=()=>({bulkInsert:async(table,records)=>{writes++;if(writes===2)throw Error('SIMULATED_INSERT_FAILURE');for(const row of records)phones.push({...structuredClone(row),id:String(phones.length+1)});}});
  Sequelize.prototype.transaction=async function(work){const snapshot=structuredClone({phones,variants});try{const result=await work({});committed=true;return result;}catch(error){phones=snapshot.phones;variants=snapshot.variants;rolledBack=true;throw error;}};
  await assert.rejects(importer.execute({apply:true,config,confirmation:config.database}),/SIMULATED_INSERT_FAILURE/);
  assert.equal(writes,2);assert.equal(rolledBack,true);assert.equal(committed,false);assert.equal(JSON.stringify({phones,variants}),original);
 }finally{for(const n of names)Sequelize.prototype[n]=saved[n];}
});
test('new owned-device registration rejects hidden variant before creating ownership',async()=>{
 const saved=connection.getDatabase;let created=false;
 const profile={version:1};
 const db={transaction:async work=>work({LOCK:{UPDATE:'UPDATE'}}),models:{users:{findByPk:async()=>({id:'owner'})},profiles:{findByPk:async()=>profile},owned_devices:{count:async()=>0,create:async()=>{created=true;throw Error('MUST_NOT_CREATE')}}},query:async sql=>{
  if(sql.includes('information_schema'))return [{table_name:'smartphones'},{table_name:'smartphone_variants'}];
  assert.match(sql,/s.review_status IN/);assert.match(sql,/v.review_status IN/);return [];
 }};
 connection.getDatabase=()=>db;
 try{await assert.rejects(invoke(require('../routes/member'),'post','/owned-devices',{body:{variant_id:'9'},session:{user_id:'owner'}}),e=>e.code==='NOT_FOUND');assert.equal(created,false);}finally{connection.getDatabase=saved;}
});
