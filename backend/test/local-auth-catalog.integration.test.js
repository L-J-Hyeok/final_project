'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const connection=require('../db/connection'),config=require('../auth/config'),{digest}=require('../auth/store'),signature=require('cookie-signature');
test('development loopback aliases keep the same port and production remains exact-origin',()=>{
 const base={SESSION_SECRET:'x'.repeat(48),APP_ORIGIN:'http://127.0.0.1:8080',NODE_ENV:'development'};
 const dev=config(base);assert.deepEqual(dev.allowedOrigins,['http://127.0.0.1:8080','http://localhost:8080']);for(const origin of ['null','http://localhost:8081','https://localhost:8080','http://localhost.evil:8080'])assert(!dev.allowedOrigins.includes(origin));
 assert.deepEqual(config({...base,NODE_ENV:'production',APP_ORIGIN:'https://example.invalid'}).allowedOrigins,['https://example.invalid']);assert.equal(dev.cookie.httpOnly,true);assert.equal(dev.cookie.sameSite,'lax');
});
test('localhost CSRF, eight-character signup and guest catalog preserve private access',async t=>{
 let server,id,cookie='',csrf='',checks=0;const hashes=new Map(),email='local-auth-'+crypto.randomUUID()+'@example.invalid',pass='Abcd1234';
 const db=connection.getDatabase();assert.equal(db.config.database,'final_project');assert(['127.0.0.1','localhost','::1'].includes(db.config.host));await connection.connect();const cfg=config(process.env);assert.equal(cfg.production,false);
 let base=process.env.LOCAL_AUTH_TEST_BASE;if(base){assert.equal(base,'http://localhost:8080');}else{server=require('../app').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;}
 async function req(method,path,body,status=200,options={}){const headers={Origin:options.origin||'http://localhost:8080'};if(!options.guest&&cookie)headers.Cookie=cookie;if(body!==undefined){headers['Content-Type']='application/json';if(!options.noCsrf)headers['X-CSRF-Token']=options.token||csrf;}const r=await fetch(base+'/api'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const sc=r.headers.get('set-cookie');if(sc&&!sc.startsWith('sid=;')){cookie=sc.split(';')[0];const sid=signature.unsign(decodeURIComponent(cookie.split('=')[1]).slice(2),cfg.secret);assert(sid);hashes.set(digest(sid).toString('hex'),digest(sid));}const result=r.status===204?null:await r.json();assert.equal(r.status,status,method+' '+path);checks++;return result?.data;}
 try{
  assert.equal(await db.models.users.count({where:{email}}),0);
  const items=await req('GET','/smartphones?only_recommendable=false&limit=50');assert(items.length>0);assert(items.every(x=>!x.is_test));await req('GET','/smartphones/'+items[0].variant_id);
  const pending=await db.models.smartphone_variants.findOne({where:{review_status:'pending'}});assert(pending);await req('GET','/smartphones/'+pending.id,undefined,404);assert(!items.some(x=>x.variant_id===String(pending.id)));
  await req('GET','/profile',undefined,401);await req('GET','/recommendations',undefined,401);
  csrf=(await req('GET','/auth/csrf')).csrf_token;
  await req('POST','/auth/register',{email,password:pass},403,{noCsrf:true});await req('POST','/auth/register',{email,password:pass},403,{token:'0'.repeat(64)});await req('POST','/auth/register',{email,password:pass},403,{origin:'http://localhost:8081'});
  await req('POST','/auth/register',{email,password:pass.slice(0,7)},422);
  id=(await req('POST','/auth/register',{email,password:pass},201)).id;const user=await db.models.users.findByPk(id);assert(user.password_hash.startsWith('scrypt$'));assert(await require('../auth/password').verify(pass,user.password_hash));
  csrf=(await req('POST','/auth/login',{email,password:pass})).csrf_token;await req('GET','/auth/me');await req('GET','/profile');await req('GET','/smartphones?only_recommendable=false');await req('POST','/auth/logout',{},204);await req('GET','/profile',undefined,401);
  t.diagnostic('HTTP checks: '+checks+'; real 8-character account cleaned; no AI request');
 }finally{if(server)await new Promise(r=>server.close(r));for(const hash of hashes.values())await db.models.sessions.destroy({where:{sid_hash:hash}});if(id)await db.models.users.destroy({where:{id,email}});await connection.close();}
});
