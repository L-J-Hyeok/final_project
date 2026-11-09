'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('crypto');
const connection=require('../db/connection');
const {digest,MysqlStore}=require('../auth/store');
const signature=require('cookie-signature');
test('real MySQL + HTTP authentication lifecycle and safety',async()=>{
 require('../config/loadEnv')();assert.equal(process.env.DB_NAME,'final_project');
 const db=await connection.connect();
 const config=require('../auth/config')(process.env);
 assert.equal(config.production,false,'integration test is local development only');
 const email='auth-test-'+crypto.randomUUID()+'@example.invalid',pass='test-only-password-12345';
 assert.equal(await db.models.users.count({where:{email}}),0);
 const server=require('../app').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port;
 let cookie='',csrf='',userId;const hashes=new Map();let checks=0;
 function rawSid(value){const signed=decodeURIComponent(value.split('=')[1]);return signature.unsign(signed.slice(2),config.secret);}
 async function request(method,path,body,opts={}){
  const headers={Origin:opts.origin||config.origin};if(cookie)headers.Cookie=cookie;
  if(body!==undefined){headers['Content-Type']='application/json';if(!opts.noCsrf)headers['X-CSRF-Token']=opts.token||csrf;}
  const res=await fetch(base+'/api/auth'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const sc=res.headers.get('set-cookie');if(sc){const v=sc.split(';')[0];if(v!=='sid='){cookie=v;const sid=rawSid(v);assert.ok(sid);hashes.set(digest(sid).toString('hex'),digest(sid));}}
  const data=res.status===204?null:await res.json();return {status:res.status,data,cookieHeader:sc,cache:res.headers.get('cache-control')};
 }
 function status(r,n){assert.equal(r.status,n);checks++;}
 try{
  status(await request('GET','/me'),401);
  let r=await request('GET','/csrf');status(r,200);csrf=r.data.data.csrf_token;
  assert.ok(r.cookieHeader.includes('HttpOnly'));assert.ok(r.cookieHeader.includes('SameSite=Lax'));assert.ok(!r.cookieHeader.includes('Secure'));assert.equal(r.cache,'no-store');
  status(await request('POST','/register',{email,password:pass},{noCsrf:true}),403);
  status(await request('POST','/register',{email,password:pass},{token:'0'.repeat(64)}),403);
  status(await request('POST','/register',{email,password:pass},{origin:'https://evil.invalid'}),403);
  status(await request('POST','/register',{email:'bad',password:pass}),422);
  status(await request('POST','/login',{email,password:'short'}),422);
  status(await request('POST','/login',{email,password:pass},{noCsrf:true}),403);
  status(await request('POST','/register',{email,password:pass,user_id:'1'}),422);
  r=await request('POST','/register',{email:' '+email.toUpperCase()+' ',password:pass});status(r,201);userId=r.data.data.id;assert.equal(r.data.data.email,email);
  const user=await db.models.users.findByPk(userId);assert.ok(user.password_hash.startsWith('scrypt$'));assert.ok(!user.password_hash.includes(pass));assert.equal(await db.models.profiles.count({where:{user_id:userId}}),1);
  status(await request('POST','/register',{email,password:pass}),409);
  status(await request('GET','/me'),401);
  const bad=await request('POST','/login',{email,password:pass+'x'});status(bad,401);
  const missing=await request('POST','/login',{email:'missing-'+email,password:pass});status(missing,401);assert.deepEqual(bad.data,missing.data);
  const oldCookie=cookie,oldCsrf=csrf,oldHash=digest(rawSid(cookie));
  r=await request('POST','/login',{email,password:pass});status(r,200);csrf=r.data.data.csrf_token;assert.notEqual(cookie,oldCookie);assert.notEqual(csrf,oldCsrf);assert.equal(await db.models.sessions.findByPk(oldHash),null);
  status(await request('GET','/me'),200);
  const sid=rawSid(cookie),hash=digest(sid);const row=await db.models.sessions.findByPk(hash);assert.equal(row.sid_hash.length,32);assert.ok(!JSON.stringify(row.data).includes(pass));assert.ok(!JSON.stringify(row.data).includes(sid));
  const freshStore=new MysqlStore(config.cookie);const persisted=await new Promise((resolve,reject)=>freshStore.get(sid,(e,s)=>e?reject(e):resolve(s)));assert.equal(persisted.user_id,userId);
  status(await request('POST','/logout',{}, {token:oldCsrf}),403);
  status(await request('POST','/logout',{}, {noCsrf:true}),403);
  const loggedCookie=cookie;status(await request('POST','/logout',{}),204);assert.equal(await db.models.sessions.findByPk(hash),null);
  await new Promise((resolve,reject)=>freshStore.set(sid,persisted,e=>e?reject(e):resolve()));assert.equal(await db.models.sessions.findByPk(hash),null,'stale save must not resurrect logout');
  cookie=loggedCookie;status(await request('GET','/me'),401);
  r=await request('GET','/csrf');csrf=r.data.data.csrf_token;
  r=await request('POST','/login',{email,password:pass});status(r,200);csrf=r.data.data.csrf_token;
  let current=await db.models.sessions.findByPk(digest(rawSid(cookie)));await current.update({expires_at:new Date(Date.now()-1000)});status(await request('GET','/me'),401);
  r=await request('GET','/csrf');csrf=r.data.data.csrf_token;r=await request('POST','/login',{email,password:pass});status(r,200);csrf=r.data.data.csrf_token;
  current=await db.models.sessions.findByPk(digest(rawSid(cookie)));await current.update({data:{...current.data,login_at:Date.now()-86400001},expires_at:new Date(Date.now()+600000)});status(await request('GET','/me'),401);
  r=await request('GET','/csrf');csrf=r.data.data.csrf_token;
  for(let i=0;i<4;i++)status(await request('POST','/login',{email,password:pass+'wrong'}),401);
  status(await request('POST','/login',{email,password:pass}),429);
  status(await request('POST','/register',{email:'invalid',password:pass}),422);
  status(await request('POST','/register',{email,password:pass}),429);
  const malformed=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:config.origin},body:'{'});assert.equal(malformed.status,400);checks++;
  const oversized=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:config.origin},body:JSON.stringify({payload:'x'.repeat(17000)})});assert.equal(oversized.status,413);checks++;
  console.log('HTTP auth status assertions:',checks);
 }finally{
  await new Promise(r=>server.close(r));
  for(const hash of hashes.values())await db.models.sessions.destroy({where:{sid_hash:hash}});
  // Unique test identity only; never bulk-delete user data.
  await db.models.users.destroy({where:{email}});
  assert.equal(await db.models.users.count({where:{email}}),0);
  if(userId)assert.equal(await db.models.profiles.count({where:{user_id:userId}}),0);
  for(const hash of hashes.values())assert.equal(await db.models.sessions.findByPk(hash),null);
  await connection.close();
 }
});
