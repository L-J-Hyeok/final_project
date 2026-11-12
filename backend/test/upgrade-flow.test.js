'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const advisor=require('../services/upgrade-advisor'),validator=require('../services/recommendation-validator');
const ai=require('../services/ai-adapter'),connection=require('../db/connection');
function context(){return {profile_snapshot:{common:{usages:['work'],spending_style:'balanced'}},replacement_device:{id:'1',category:'smartphone',source:'catalog',product:{verified:true,model_name:'Owned',brand:'samsung',os:'android',storage_gb:128,refresh_hz:60,weight_g:200}},purchase_conditions:{hard:{budget_max_krw:1000,min_storage_gb:null,min_refresh_hz:null,max_weight_g:null,required_os:null,allowed_brands:['samsung','apple']},soft:{},purchase_reason:'저장 공간 부족',upgrade_context:{replacement_intent:'moderate',satisfied_aspects:[],pain_points:['storage']}},candidates_snapshot:[{variant_id:'2',smartphone_id:'2',model_name:'Candidate',brand:'samsung',storage_gb:256,weight_g:190,refresh_hz:120,price:{observation_id:null,total_krw:null,budget_basis_krw:900,amount_krw:900,development_only:true,price_source:'official_launch'},eligible_reasons:[{code:'budget_headroom',value:100}]}]};}
test('KEEP: satisfied owner with known hard specs; OS mismatch cannot KEEP',()=>{const c=context();c.purchase_conditions.upgrade_context={replacement_intent:'low_or_keep_if_okay',satisfied_aspects:['storage'],pain_points:[]};assert.equal(advisor.evaluateUpgradeDecision(c).status,'keep');c.purchase_conditions.hard.required_os='ios';assert.notEqual(advisor.evaluateUpgradeDecision(c).status,'keep');});
test('REPLACE: verified storage benefit passes Mock AI and server validation',()=>{const c=context();c.upgrade_decision=advisor.evaluateUpgradeDecision(c);assert.equal(c.upgrade_decision.status,'recommend');const output=ai.mockRecommend({aiContext:c}).output;assert.equal(validator.validateRecommendationOutput(output,c).valid,true);output.items[0].variant_id='999';assert.equal(validator.validateRecommendationOutput(output,c).valid,false);});
test('DEFER: no eligible price candidate or only unproven camera/performance claims',()=>{const c=context();c.candidates_snapshot=[];assert.equal(advisor.evaluateUpgradeDecision(c).status,'defer');for(const pain of ['camera','performance','battery','price']){const x=context();x.purchase_conditions.upgrade_context.pain_points=[pain];assert.equal(advisor.evaluateUpgradeDecision(x).status,'defer');}const both=context();both.purchase_conditions.upgrade_context.pain_points=['battery','camera'];assert.equal(advisor.evaluateUpgradeDecision(both).status,'defer');});
test('MIXED PAINS: verifiable benefit with unverified pains still recommends verified upgrades and flags uncertainties',()=>{
 const c=context();
 c.candidates_snapshot.push({variant_id:'3',smartphone_id:'3',model_name:'SameStorage',brand:'samsung',storage_gb:128,weight_g:190,refresh_hz:120,price:{observation_id:null,total_krw:null,budget_basis_krw:850,amount_krw:850,development_only:true,price_source:'official_launch'},eligible_reasons:[{code:'budget_headroom',value:150}]});
 c.purchase_conditions.upgrade_context.pain_points=['storage','camera','battery'];
 const decision=advisor.evaluateUpgradeDecision(c);
 assert.equal(decision.status,'recommend');
 assert.deepEqual(decision.eligible_variant_ids,['2']);
 assert.deepEqual(decision.verified_needs,['storage']);
 assert.deepEqual(decision.unverified_needs,['camera','battery']);
 assert.equal(decision.unverified_cautions.length,1);
 c.upgrade_decision=decision;
 c.candidates_snapshot=c.candidates_snapshot.filter(x=>decision.eligible_variant_ids.includes(x.variant_id));
 const output=ai.mockRecommend({aiContext:c}).output;
 assert.equal(validator.validateRecommendationOutput(output,c).valid,true);
 assert(output.items[0].uncertainties.some(u=>u.includes('카메라·배터리')));
});
test('>40 candidates: KEEP upgrade_decision overrides candidate cap while remaining >40 upgrade matches stay clarify',async()=>{
 const phones=require('../routes/smartphones'),r=require('../routes/recommendations');
 const oldSearch=phones.searchCandidatesForUser,oldDb=connection.getDatabase;
 const c=context();c.purchase_conditions.upgrade_context={replacement_intent:'low_or_keep_if_okay',satisfied_aspects:['storage'],pain_points:[]};
 let stored=[];
 connection.getDatabase=()=>({
  query:async()=>[{variant_id:'10',smartphone_id:'10',model_name:'Owned',os:'android',brand:'samsung',storage_gb:128,ram_gb:8,refresh_hz:60,weight_g:200,battery_mah:4000,supports_5g:true,wireless_charging:true,color:'블랙',verified:1}],
  transaction:fn=>fn({LOCK:{UPDATE:1}}),
  models:{owned_devices:{findOne:async()=>({toJSON:()=>({id:'1',category:'smartphone',variant_id:'10'})})},users:{findByPk:async()=>({id:'owner'})},profiles:{findByPk:async()=>({version:1})},recommendations:{create:async x=>{stored.push(x);return {...x,id:String(stored.length)}}}}
 });
 try{
  phones.searchCandidatesForUser=async()=>({status:'clarify',clarify_reason:'too_many_candidates',candidate_count:55,profile_version:1,input:{...c.purchase_conditions,replacement_device_id:'1',clarify_questions:[]},upgrade_decision:{status:'keep',questions:[],reasons:['현재 기기가 조건을 충족합니다.'],eligible_variant_ids:[]},keep_current_evaluation:{reasons:['현재 기기가 조건을 충족합니다.'],cautions:['배터리 상태 점검 권장']},candidates:[],questions:['후보가 55개로 많습니다.']});
  const keepOut=await invoke(r,'post','/recommendations',{session:{user_id:'owner'},body:{}});
  assert.equal(keepOut.data.status,'keep');
  assert.equal(keepOut.data.owned_variant_id,'10');
  assert.deepEqual(keepOut.data.keep_cautions,['배터리 상태 점검 권장']);

  phones.searchCandidatesForUser=async()=>({status:'clarify',clarify_reason:'too_many_candidates',candidate_count:45,profile_version:1,input:{...c.purchase_conditions,replacement_device_id:'1',clarify_questions:[]},candidates:[],questions:['조건을 만족하는 교체 후보가 45개로 너무 많습니다.']});
  const clarifyOut=await invoke(r,'post','/recommendations',{session:{user_id:'owner'},body:{}});
  assert.equal(clarifyOut.data.status,'clarify');
  assert.match(clarifyOut.data.questions[0],/45개/);
 }finally{phones.searchCandidatesForUser=oldSearch;connection.getDatabase=oldDb}
});
test('searchCandidatesForUser narrows >40 matches for storage upgrade and attaches KEEP on >40 general matches',async()=>{
 const phones=require('../routes/smartphones'),oldDb=connection.getDatabase;
 const makeVariantRows=(count)=>Array.from({length:count},(_,idx)=>({
  variant_id:String(100+idx),smartphone_id:String(100+idx),brand:'samsung',model_name:`Model ${idx}`,domestic_model_number:`SM-T${idx}`,
  released_on_kr:'2025-05-01',os:'android',chipset:'Snapdragon',screen_inches:6.2,refresh_hz:120,battery_mah:4000,weight_g:180,
  supports_5g:true,wireless_charging:true,official_product_url:null,details_json:null,phone_source_name:'official',phone_source_url:'https://example.invalid',
  storage_gb:idx<3?512:128,ram_gb:8,color:'블랙',sku_code:null,official_launch_price_krw:900000,danawa_lowest_price_krw:null,
  danawa_product_url:null,variant_source_name:'official',variant_source_url:'https://example.invalid',spec_verified:true,phone_verified:1,variant_verified:1
 }));
 const rows=makeVariantRows(45);
 const priceRows=rows.map((r,idx)=>({
  id:String(1000+idx),variant_id:r.variant_id,source_name:'TestStore',source_url:'https://example.invalid/price',
  seller_name:'SellerA',amount_krw:900000,shipping_krw:0,observed_at:'2026-11-12T08:00:00.000Z',
  expires_at:'2026-11-13T08:00:00.000Z',conditions_text:'자급제 신품',unconditional:1,in_stock:1,is_new:1,is_unlocked:1
 }));
 connection.getDatabase=()=>({
  transaction:fn=>fn({LOCK:{UPDATE:1}}),
  models:{
   users:{findByPk:async()=>({id:'owner'})},
   profiles:{findByPk:async()=>({version:2,confirmed_at:new Date(),common_json:{usages:['work'],spending_style:'balanced'},smartphone_json:{},update:async()=>{}})},
   owned_devices:{findOne:async()=>({toJSON:()=>({id:'1',category:'smartphone',variant_id:'9'})})}
  },
  query:async(sql)=>{
   const q=String(sql);
   if(q.includes('INFORMATION_SCHEMA')||q.includes('SHOW COLUMNS')) return [{COLUMN_NAME:'publication_status',Field:'publication_status'}];
   if(q.includes('WHERE v.id = :id')) return [{variant_id:'9',smartphone_id:'9',brand:'samsung',model_name:'Owned',domestic_model_number:'SM-OWN',released_on_kr:'2025-01-01',os:'android',chipset:'Snapdragon',screen_inches:6.2,refresh_hz:120,battery_mah:4000,weight_g:180,supports_5g:true,wireless_charging:true,storage_gb:128,ram_gb:8,color:'블랙',verified:1}];
   if(q.includes('FROM price_observations')) return priceRows;
   return rows;
  }
 });
 try{
  const keepSearch=await phones.searchCandidatesForUser('owner',{
   expected_profile_version:2,replacement_device_id:'1',purchase_reason:'확인',
   upgrade_context:{replacement_intent:'low_or_keep_if_okay',satisfied_aspects:['storage'],pain_points:[]},
   hard:{budget_max_krw:1200000,usages:['work']}
  },new Date('2026-11-12T12:00:00Z'));
  assert.equal(keepSearch.upgrade_decision?.status,'keep');

  const upgradeSearch=await phones.searchCandidatesForUser('owner',{
   expected_profile_version:2,replacement_device_id:'1',purchase_reason:'용량 부족',
   upgrade_context:{replacement_intent:'high',satisfied_aspects:[],pain_points:['storage','camera']},
   hard:{budget_max_krw:1200000,usages:['work']}
  },new Date('2026-11-12T12:00:00Z'));
  assert.equal(upgradeSearch.status,'candidates_ready');
  assert.equal(upgradeSearch.candidate_count,3);
 }finally{connection.getDatabase=oldDb}
});
test('CLARIFY: missing satisfaction/reason or unverified manual device',()=>{const c=context();c.purchase_conditions.purchase_reason='';assert.equal(advisor.evaluateUpgradeDecision(c).status,'clarify');c.purchase_conditions.purchase_reason='교체';c.replacement_device.product=null;assert.equal(advisor.evaluateUpgradeDecision(c).status,'clarify');assert.equal(advisor.evaluateUpgradeDecision({...c,replacement_device:null}),null);});
test('comparison never invents camera/benchmark values; NULL preserved',()=>{const c=context(),x=advisor.buildDeviceCandidateComparison(c.replacement_device.product,c.candidates_snapshot[0]);assert.equal(x.fields.camera.status,'insufficient_data');assert.equal(x.fields.ram_gb.current,null);assert.equal(x.fields.chipset.status,'insufficient_benchmark_data');});
async function invoke(router,method,path,req){let result;await router.stack.find(x=>x.route?.path===path&&x.route.methods[method]).route.stack[0].handle(req,{status(){return this},json(x){result=x},end(){}},e=>{throw e});return result;}
test('owned-device delete preserves history and increments profile version; explicit profile delete still erases history',async()=>{const saved=connection.getDatabase;let historyDeletes=0,deviceDeletes=0;const p={version:1,smartphone_json:{},update:async function(x){Object.assign(this,x);return this}};connection.getDatabase=()=>({transaction:fn=>fn({LOCK:{UPDATE:1}}),models:{users:{findByPk:async()=>({id:'owner'})},profiles:{findByPk:async()=>p},owned_devices:{findOne:async({where})=>{assert.equal(where.user_id,'owner');return {destroy:async()=>deviceDeletes++}}},recommendations:{destroy:async()=>historyDeletes++}}});try{const r=require('../routes/member');await invoke(r,'delete','/owned-devices/:id',{params:{id:'1'},body:{},session:{user_id:'owner'}});assert.equal(deviceDeletes,1);assert.equal(historyDeletes,0);assert.equal(p.version,2);await invoke(r,'delete','/profile',{body:{expected_version:2},session:{user_id:'owner'}});assert.equal(historyDeletes,1);}finally{connection.getDatabase=saved}});
test('actual recommendation handler stores KEEP snapshot without AI or product writes',async()=>{const phones=require('../routes/smartphones'),r=require('../routes/recommendations');const oldSearch=phones.searchCandidatesForUser,oldDb=connection.getDatabase;const c=context();c.purchase_conditions.upgrade_context={replacement_intent:'low_or_keep_if_okay',satisfied_aspects:['storage'],pain_points:[]};let stored;phones.searchCandidatesForUser=async()=>({status:'candidates_ready',profile_version:1,input:{...c.purchase_conditions,replacement_device_id:'1'},ai_context:c,candidates:c.candidates_snapshot});connection.getDatabase=()=>({transaction:fn=>fn({LOCK:{UPDATE:1}}),models:{users:{findByPk:async()=>({})},profiles:{findByPk:async()=>({version:1})},recommendations:{create:async x=>{stored=x;return {...x,id:'9'}}}}});try{const out=await invoke(r,'post','/recommendations',{session:{user_id:'owner'},body:{}});assert.equal(out.data.status,'keep');assert.equal(stored.input_snapshot.owned_device_snapshot.id,'1');assert.equal(stored.model_name,null);assert(stored.result_json.keep_reasons.length);}finally{phones.searchCandidatesForUser=oldSearch;connection.getDatabase=oldDb}});
test('owned-device edit preserves historical records and advances profile version',async()=>{
 const old=connection.getDatabase;let erased=false;const p={version:1,smartphone_json:{},update:async function(x){Object.assign(this,x);return this}};
 const row={variant_id:null,update:async()=>{},toJSON:()=>({id:'1',user_id:'owner',category:'laptop',variant_id:null})};
 connection.getDatabase=()=>({transaction:fn=>fn({LOCK:{UPDATE:1}}),models:{users:{findByPk:async()=>({})},profiles:{findByPk:async()=>p},owned_devices:{findOne:async({where})=>{assert.equal(where.user_id,'owner');return row}},recommendations:{destroy:async()=>{erased=true}}}});
 try{await invoke(require('../routes/member'),'put','/owned-devices/:id',{params:{id:'1'},body:{category:'laptop',manual_brand:'Test',manual_model_name:'Owned'},session:{user_id:'owner'}});assert.equal(erased,false);assert.equal(p.version,2);}finally{connection.getDatabase=old}
});
test('no-match upgrade enforces owner lookup before any history write',async()=>{
 const phones=require('../routes/smartphones'),oldSearch=phones.searchCandidatesForUser,oldDb=connection.getDatabase;let writes=0;
 phones.searchCandidatesForUser=async()=>({status:'no_match',input:{replacement_device_id:'99'},profile_version:1,candidates:[]});
 connection.getDatabase=()=>({models:{owned_devices:{findOne:async({where})=>{assert.equal(where.user_id,'owner');return null}},recommendations:{create:async()=>writes++}}});
 try{await assert.rejects(invoke(require('../routes/recommendations'),'post','/recommendations',{session:{user_id:'owner'},body:{}}),{code:'NOT_FOUND'});assert.equal(writes,0);}finally{phones.searchCandidatesForUser=oldSearch;connection.getDatabase=oldDb}
});
