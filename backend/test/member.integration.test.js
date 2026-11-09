'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('crypto'),signature=require('cookie-signature');
const connection=require('../db/connection'),{digest}=require('../auth/store');
test('profile and owned-device HTTP CRUD, isolation, version and capacity concurrency',async()=>{
 require('../config/loadEnv')();assert.equal(process.env.DB_NAME,'final_project');assert.notEqual(process.env.NODE_ENV,'production');
 const d=await connection.connect(),m=d.models,origin=require('../auth/config')(process.env).origin;
 const prefix='member-test-'+crypto.randomUUID(),emails=[prefix+'-a@example.invalid',prefix+'-b@example.invalid'];
 const hashes=new Map();let phone,variant,server,checks=0;const users=[];
 function check(r,n){assert.equal(r.status,n);checks++;return r.body?.data;}
 try{
  for(const email of emails)assert.equal(await m.users.count({where:{email}}),0);
  phone=await m.smartphones.create({brand:'other',model_name:prefix,domestic_model_number:prefix,released_on_kr:'2010-01-01',is_test:true});
  variant=await m.smartphone_variants.create({smartphone_id:phone.id,storage_gb:128});
  server=require('../app').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port+'/api';
  function client(){return {cookie:'',csrf:''};}
  async function req(c,method,path,body,opts={}){
   const headers={Origin:opts.origin||origin};if(c.cookie)headers.Cookie=c.cookie;
   if(body!==undefined){headers['Content-Type']='application/json';if(!opts.noCsrf)headers['X-CSRF-Token']=opts.token||c.csrf;}
   const r=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
   const sc=r.headers.get('set-cookie');if(sc){const cookie=sc.split(';')[0];if(cookie!=='sid='){c.cookie=cookie;const sid=signature.unsign(decodeURIComponent(cookie.split('=')[1]).slice(2),process.env.SESSION_SECRET);assert.ok(sid);hashes.set(digest(sid).toString('hex'),digest(sid));}}
   return {status:r.status,body:r.status===204?null:await r.json()};
  }
  const a=client(),b=client(),anon=client();
  check(await req(anon,'GET','/profile'),401);check(await req(anon,'GET','/owned-devices'),401);check(await req(anon,'GET','/owned-device-options?q=test'),401);
  anon.csrf=check(await req(anon,'GET','/auth/csrf'),200).csrf_token;
  check(await req(anon,'POST','/owned-devices',{category:'cpu',manual_brand:'test',manual_model_name:'test'}),401);
  for(const [i,c] of [a,b].entries()){
   c.csrf=check(await req(c,'GET','/auth/csrf'),200).csrf_token;
   const u=check(await req(c,'POST','/auth/register',{email:emails[i],password:'test-only-password-12345'}),201);users.push(u.id);
   const login=check(await req(c,'POST','/auth/login',{email:emails[i],password:'test-only-password-12345'}),200);c.csrf=login.csrf_token;
  }
  let p=check(await req(a,'GET','/profile'),200);assert.equal(p.version,1);assert.equal(p.confirmed_at,null);assert.deepEqual(p.common,{});
  const save={expected_version:1,common:{usages:['coding'],spending_style:'balanced'},smartphone:{}};
  check(await req(a,'PUT','/profile',save,{noCsrf:true}),403);check(await req(a,'PUT','/profile',save,{origin:'https://evil.invalid'}),403);
  p=check(await req(a,'PUT','/profile',save),200);assert.equal(p.version,2);assert.equal(p.common.lifestyle_note,null);assert.deepEqual(p.smartphone.priorities,[]);assert.ok(p.confirmed_at);
  check(await req(a,'PUT','/profile',save),409);check(await req(a,'PUT','/profile',{...save,expected_version:2,user_id:users[1]}),422);
  check(await req(a,'PUT','/profile',{...save,expected_version:2,common:{...save.common,budget_max_krw:1}}),422);
  const update={...save,expected_version:2,common:{...save.common,lifestyle_note:'사용자가 확인한 짧은 메모'},smartphone:{preferred_brands:['apple'],priorities:['battery','camera'],preferred_os:'ios'}};
  const race=await Promise.all([req(a,'PUT','/profile',update),req(a,'PUT','/profile',update)]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);checks+=2;
  p=check(await req(a,'GET','/profile'),200);assert.equal(p.version,3);assert.equal(p.smartphone.preferred_os,'ios');assert.deepEqual((await m.profiles.findByPk(users[0])).smartphone_json,p.smartphone);
  assert.deepEqual(check(await req(b,'GET','/profile'),200).common,{});
  check(await req(b,'GET','/profile?user_id='+users[0]),422);
  const ram={category:'ram',manual_brand:'test',manual_model_name:'kit',manual_specs_json:{capacity_gb:32,module_count:2,memory_standard:'DDR5'}};
  check(await req(a,'POST','/owned-devices',ram,{token:'0'.repeat(64)}),403);
  check(await req(a,'POST','/owned-devices',{...ram,manual_storage_gb:32}),422);
  const manual=check(await req(a,'POST','/owned-devices',ram),201);assert.equal(manual.profile_version,4);assert.equal(manual.device.manual_specs_verified,false);assert.equal(manual.device.compatibility_verified,false);const id=manual.device.id;
  const opts=check(await req(a,'GET','/owned-device-options?q='+encodeURIComponent(prefix)),200);assert.ok(opts.some(x=>x.id===String(variant.id)));assert.ok(opts.some(x=>String(x.released_on_kr).startsWith('2010')));
  const linked=check(await req(a,'POST','/owned-devices',{variant_id:String(variant.id)}),201);assert.equal(linked.device.product.brand,'other');assert.equal(linked.device.source,'catalog');
  check(await req(a,'POST','/owned-devices',{variant_id:'18446744073709551615'}),404);
  assert.equal(check(await req(b,'GET','/owned-devices'),200).length,0);
  const other=await req(b,'PUT','/owned-devices/'+id,ram),absent=await req(b,'PUT','/owned-devices/18446744073709551615',ram);check(other,404);check(absent,404);assert.deepEqual(other.body,absent.body);
  check(await req(b,'DELETE','/owned-devices/'+id,{}),404);
  check(await req(a,'GET','/owned-devices?limit=0'),422);
  const page=await req(a,'GET','/owned-devices?limit=1');check(page,200);assert.ok(page.body.next_cursor);assert.equal(check(await req(a,'GET','/owned-devices?limit=1&cursor='+page.body.next_cursor),200).length,1);
  const rec=uid=>m.recommendations.create({user_id:uid,status:'keep',profile_version:1,input_snapshot:{},candidates_snapshot:[],prompt_version:'test',as_of:new Date()});
  await rec(users[0]);await rec(users[1]);
  const converted=check(await req(a,'PUT','/owned-devices/'+id,{variant_id:String(variant.id)}),200);assert.equal(converted.device.manual_specs_json,null);assert.equal(converted.device.manual_brand,null);
  assert.equal(await m.recommendations.count({where:{user_id:users[0]}}),0);assert.equal(await m.recommendations.count({where:{user_id:users[1]}}),1);
  check(await req(a,'PUT','/owned-devices/'+id,{category:'gpu',manual_brand:'test',manual_model_name:'gpu',manual_specs_json:{vram_gb:8}}),200);
  check(await req(a,'PUT','/owned-devices/'+id,{category:'cpu',manual_brand:'test',manual_model_name:'cpu',manual_specs_json:{vram_gb:8}}),422);
  check(await req(a,'DELETE','/owned-devices/'+linked.device.id,{}),204);check(await req(a,'DELETE','/owned-devices/'+linked.device.id,{}),404);
  // At 19 records, concurrent inserts must yield exactly one success.
  for(let i=0;i<18;i++)check(await req(a,'POST','/owned-devices',ram),201);
  const cap=await Promise.all([req(a,'POST','/owned-devices',ram),req(a,'POST','/owned-devices',ram)]);assert.deepEqual(cap.map(x=>x.status).sort(),[201,409]);checks+=2;assert.equal(await m.owned_devices.count({where:{user_id:users[0]}}),20);
  p=check(await req(a,'GET','/profile'),200);await rec(users[0]);
  check(await req(a,'DELETE','/profile',{expected_version:p.version-1}),409);
  check(await req(a,'DELETE','/profile',{expected_version:p.version}),204);
  const reset=check(await req(a,'GET','/profile'),200);assert.equal(reset.version,p.version+1);assert.equal(reset.confirmed_at,null);assert.deepEqual(reset.smartphone,{});assert.equal(await m.owned_devices.count({where:{user_id:users[0]}}),20);assert.equal(await m.recommendations.count({where:{user_id:users[0]}}),0);assert.equal(await m.recommendations.count({where:{user_id:users[1]}}),1);
  console.log('member HTTP status assertions:',checks);
 }finally{
  if(server)await new Promise(r=>server.close(r));
  for(const h of hashes.values())await m.sessions.destroy({where:{sid_hash:h}});
  for(const email of emails)await m.users.destroy({where:{email}});
  if(variant)await variant.destroy();if(phone)await phone.destroy();
  for(const uid of users)for(const name of ['profiles','owned_devices','recommendations','sessions'])assert.equal(await m[name].count({where:{user_id:uid}}),0);
  for(const h of hashes.values())assert.equal(await m.sessions.findByPk(h),null);
  await connection.close();
 }
});
