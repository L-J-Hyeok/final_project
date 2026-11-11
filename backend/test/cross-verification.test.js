'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const price=require('../services/smartphone-price-preview'),catalog=require('../services/smartphone-catalog');
const connection=require('../db/connection');
const row={variant_id:'7',brand:'samsung',domestic_model_number:'SM-TEST',storage_gb:256,ram_gb:12,color:'블랙',phone_verified:true,variant_verified:true};
const snapshot={variant_id:'7',mapping_verified:true,domestic_model_number_reference:'SM-TEST',storage_gb:256,ram_gb:12,color_as_supplied:'Black',displayed_amount_krw:100,research_date:'2026-11-11'};
function data(s){return {normalized:{smartphone_variants:[]},colorReview:{snapshots:[s]}};}
test('reference mapping needs explicit variant identity and actual RAM, not catalog hints',()=>{
 assert.equal(price.resolveCuratedPriceInputsForVariant(row,data(snapshot)).references.length,1);
 for(const patch of [{variant_id:null},{mapping_verified:false},{ram_gb:null,catalog_ram_reference_gb:12},{color_as_supplied:'White'},{storage_gb:512},{domestic_model_number_reference:'OTHER'}])assert.equal(price.resolveCuratedPriceInputsForVariant(row,data({...snapshot,...patch})).references.length,0);
});
test('launch price requires independent approved evidence; configuration-only prices cannot cross colors',()=>{
 const custom={...data({}),expansion:{models:[{brand:'samsung',domestic_model_number:'SM-TEST',configurations:[{storage_gb:256,ram_gb:12,launch_price:{verified:true,amount_krw:100}}]}]}};
 assert.equal(price.resolveCuratedPriceInputsForVariant(row,custom).launch,null);
 assert.equal(price.resolveCuratedPriceInputsForVariant({...row,launch_price_krw:100,launch_price_metadata_json:{status:'pending'}},custom).launch,null);
 const launch=price.resolveCuratedPriceInputsForVariant({...row,launch_price_krw:100,launch_price_metadata_json:{status:'approved',source_url:'https://example.invalid/official',checked_at:'2026-11-11'}},custom).launch;
 assert.equal(launch.amount_krw,100);assert.equal(launch.checked_at,'2026-11-11');
});
test('production and ordinary development cannot opt into fixture visibility',()=>{
 const prev=process.env.NODE_ENV;try{for(const env of ['production','development',undefined]){if(env)process.env.NODE_ENV=env;else delete process.env.NODE_ENV;assert.throws(()=>catalog.validateCatalogQuery({include_test:'true'}));assert.throws(()=>catalog.validateCandidateInput({expected_profile_version:1,hard:{},include_test:true}));}}finally{if(prev===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=prev;}
});
test('production price fallback is disabled even with explicit toggle; NULL cannot meet budget',()=>{
 const curated={references:[],launch:{variant_id:'7',mapping_verified:true,verified:true,amount_krw:100}};
 assert.equal(price.buildCandidatePriceObject(row,[],{NODE_ENV:'production',ALLOW_DEVELOPMENT_PRICES:'true'},new Date(),curated).selected,null);
 assert.equal(catalog.effectiveBudgetPriceKrw({eligible:true,total_krw:null,budget_basis_krw:null,development_only:true}),null);
});
test('string flags cannot certify a purchase as verified',()=>{
 const now=new Date('2026-11-11T12:00:00Z');const o={id:'1',amount_krw:100,shipping_krw:0,observed_at:'2026-11-11T11:00:00Z',expires_at:'2026-11-12T11:00:00Z',unconditional:1,in_stock:1,is_new:'false',is_unlocked:1};assert.equal(catalog.evaluateObservation(o,now).eligible,false);
});
async function invoke(router,method,path,req){const handler=router.stack.find(x=>x.route?.path===path&&x.route.methods[method]).route.stack[0].handle;let result;await handler(req,{json:x=>{result=x;}},e=>{throw e;});return result;}
test('owned-device PUT rejects switching to pending; owner scope enforced before variant lookup',async()=>{
 const saved=connection.getDatabase;let lookups=0;const profile={version:1};const db={transaction:fn=>fn({LOCK:{UPDATE:'UPDATE'}}),models:{users:{findByPk:async()=>({})},profiles:{findByPk:async()=>profile},owned_devices:{findOne:async({where})=>{assert.equal(where.user_id,'owner');return where.id==='1'?{variant_id:'5'}:null;}}},query:async sql=>{if(sql.includes('information_schema'))return [{table_name:'smartphones'},{table_name:'smartphone_variants'}];lookups++;assert.match(sql,/s.review_status IN/);assert.match(sql,/v.review_status IN/);return [];}};
 connection.getDatabase=()=>db;try{const r=require('../routes/member');for(const id of ['1','2'])await assert.rejects(invoke(r,'put','/owned-devices/:id',{params:{id},session:{user_id:'owner'},body:{variant_id:'7'}}),{code:'NOT_FOUND'});assert.equal(lookups,1);}finally{connection.getDatabase=saved;}
});
test('production detail enforces test and pending filters in SQL',async()=>{
 const saved=connection.getDatabase,env=process.env.NODE_ENV;process.env.NODE_ENV='production';let checked=false;connection.getDatabase=()=>({query:async sql=>{if(sql.includes('information_schema'))return [{table_name:'smartphones'},{table_name:'smartphone_variants'}];assert.match(sql,/s.is_test = 0/);assert.match(sql,/s.review_status IN/);assert.match(sql,/v.review_status IN/);checked=true;return [];}});try{await assert.rejects(invoke(require('../routes/smartphones'),'get','/smartphones/:variantId',{params:{variantId:'7'},query:{}}),{code:'NOT_FOUND'});assert(checked);}finally{connection.getDatabase=saved;if(env===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=env;}
});
test('AI cannot substitute model/variant IDs or fill a NULL specification',()=>{
 const validator=require('../services/recommendation-validator'),ai=require('../services/ai-adapter');
 const candidate={...row,smartphone_id:'3',battery_mah:null,price:{observation_id:null,total_krw:null,amount_krw:100,budget_basis_krw:100,price_source:'official_launch',development_only:true,purchase_verified:false,warning:'development only'},eligible_reasons:[{code:'budget_headroom',value:900}]};
 const ctx={profile_snapshot:{common:{usages:['video'],spending_style:'balanced'}},purchase_conditions:{hard:{budget_max_krw:1000},soft:{}},candidates_snapshot:[candidate]};
 const valid=ai.mockRecommend({aiContext:ctx}).output;assert.equal(validator.validateRecommendationOutput(valid,ctx).valid,true);
 for(const change of [{variant_id:'999'},{smartphone_id:'999'},{evidence:[{variant_id:'7',field:'battery_mah',value:5000}]},{evidence:[{variant_id:'7',field:'price',price_observation_id:null,total_krw:1}]}]){const out=structuredClone(valid);Object.assign(out.items[0],change);assert.equal(validator.validateRecommendationOutput(out,ctx).valid,false);}
});
