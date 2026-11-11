'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const connection=require('../db/connection');
test('real catalog: pending access denied, development Mock prices persist unchanged in history',async t=>{
 const previous={NODE_ENV:process.env.NODE_ENV,AI_PROVIDER:process.env.AI_PROVIDER,ALLOW_DEVELOPMENT_PRICES:process.env.ALLOW_DEVELOPMENT_PRICES};
 process.env.NODE_ENV='development';process.env.AI_PROVIDER='mock';process.env.ALLOW_DEVELOPMENT_PRICES='true';
 let db,server,uid,otherId;let cookie='',csrf='',checks=0;const email='cross-'+crypto.randomUUID()+'@example.invalid',otherEmail='cross-'+crypto.randomUUID()+'@example.invalid',password=crypto.randomBytes(24).toString('hex');
 try{
  db=connection.getDatabase();assert.equal(db.config.database,'final_project');assert(['127.0.0.1','localhost','::1'].includes(db.config.host));await connection.connect();
  const beforePhones=JSON.stringify(await db.models.smartphones.findAll({order:[['id','ASC']]})),beforeVariants=JSON.stringify(await db.models.smartphone_variants.findAll({order:[['id','ASC']]})),priceCount=await db.models.price_observations.count();
  const origin=require('../auth/config')(process.env).origin,app=require('../app');server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port+'/api';
  async function req(method,path,body,status=200){const response=await fetch(base+path,{method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});const sc=response.headers.getSetCookie();if(sc.length)cookie=sc[0].split(';')[0];const payload=response.status===204?null:await response.json();assert.equal(response.status,status,method+' '+path);checks++;return payload?.data;}
  csrf=(await req('GET','/auth/csrf')).csrf_token;uid=(await req('POST','/auth/register',{email,password},201)).id;csrf=(await req('POST','/auth/login',{email,password})).csrf_token;
  const visible=await req('GET','/smartphones?only_recommendable=false&limit=50');assert.equal(visible.length,29);
  const hidden=await db.models.smartphone_variants.findOne({where:{review_status:'pending'}});assert(hidden);const hiddenPhone=await db.models.smartphones.findByPk(hidden.smartphone_id);
  await req('GET','/smartphones/'+hidden.id,undefined,404);assert.equal((await req('GET','/owned-device-options?q='+encodeURIComponent(hiddenPhone.domestic_model_number))).length,0);
  await req('POST','/owned-devices',{variant_id:String(hidden.id)},404);
  const device=await req('POST','/owned-devices',{variant_id:visible[0].variant_id},201);
  await req('PUT','/owned-devices/'+device.device.id,{variant_id:String(hidden.id)},404);
  otherId=(await db.models.users.create({email:otherEmail,password_hash:await require('../auth/password').hash(password)})).id;
  const otherDevice=await db.models.owned_devices.create({user_id:otherId,variant_id:visible[0].variant_id,category:'smartphone'});
  await req('PUT','/owned-devices/'+otherDevice.id,{variant_id:visible[0].variant_id},404);
  // Only this isolated account's ownership fixture, no product status changes.
  const hiddenOwned=await db.models.owned_devices.create({user_id:uid,variant_id:hidden.id,category:'smartphone'});
  const owned=await req('GET','/owned-devices');assert(owned.some(x=>x.id===String(hiddenOwned.id)&&x.product));
  await req('PUT','/owned-devices/'+hiddenOwned.id,{variant_id:String(hidden.id)});await req('GET','/upgrade-offer');
  const profile=await req('GET','/profile');const saved=await req('PUT','/profile',{expected_version:profile.version,common:{usages:['video'],spending_style:'balanced'},smartphone:{}});
  const body={expected_profile_version:saved.version,hard:{budget_max_krw:3000000,usages:['video']},soft:{}};
  const candidates=await req('POST','/recommendation-candidates',body);assert.equal(candidates.status,'candidates_ready');assert(candidates.candidates.length>0);const pendingPhones=await db.models.smartphones.findAll({where:{review_status:'pending'},attributes:['id']});const ids=new Set(pendingPhones.map(x=>String(x.id)));assert(candidates.candidates.every(x=>!ids.has(x.smartphone_id)));
  process.env.NODE_ENV='production';await req('GET','/smartphones?include_test=true',undefined,422);await req('POST','/recommendation-candidates',{...body,include_test:true},422);const production=await req('POST','/recommendation-candidates',body);assert.equal(production.status,'no_match');process.env.NODE_ENV='development';
  const rec=await req('POST','/recommendations',body,201);assert.equal(rec.status,'recommend');assert(rec.items.length>0);
  const history=await req('GET','/recommendations/'+rec.id);const stored=await db.models.recommendations.findByPk(rec.id);
  for(const item of rec.items){assert.equal(item.price.development_only,true);assert.equal(item.price.purchase_verified,false);assert.equal(item.price.observation_id,null);assert(item.price.warning);assert(['official_launch','reference_sale'].includes(item.price.price_source));assert.equal(item.price.total_krw,null);assert(item.price.budget_basis_krw<=body.hard.budget_max_krw);const fromHistory=history.items.find(x=>x.variant_id===item.variant_id);const fromDb=stored.result_json.items.find(x=>x.variant_id===item.variant_id);for(const [key,value]of Object.entries(item.price)){assert.deepEqual(fromHistory.price[key],value);assert.deepEqual(fromDb.price[key],value);}}
  assert.equal(await db.models.price_observations.count(),priceCount);assert.equal(JSON.stringify(await db.models.smartphones.findAll({order:[['id','ASC']]})),beforePhones);assert.equal(JSON.stringify(await db.models.smartphone_variants.findAll({order:[['id','ASC']]})),beforeVariants);
  await req('POST','/auth/logout',{},204);t.diagnostic('Actual HTTP assertions: '+checks+'; no paid AI call; product rows unchanged');
 }finally{
  if(server)await new Promise(r=>server.close(r));
  if(db){if(uid)await db.models.users.destroy({where:{id:uid,email}});if(otherId)await db.models.users.destroy({where:{id:otherId,email:otherEmail}});await connection.close();}
  for(const [key,value]of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
});
