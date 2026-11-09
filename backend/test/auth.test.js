'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const password = require('../auth/password');
const config = require('../auth/config');
const { deadline, IDLE, ABSOLUTE } = require('../auth/store');
test('scrypt format, random salts and constant-time verifier', async () => {
  const p = 'test-only-password-123';
  const start = Date.now();
  const hash = await password.hash(p);
  assert.ok(hash.startsWith('scrypt$131072$8$1$'));
  assert.ok(!hash.includes(p));
  assert.equal(await password.verify(p,hash),true);
  assert.equal(await password.verify(p+'x',hash),false);
  assert.equal(await password.verify(p,null),false);
  assert.notEqual(hash,await password.hash(p));
  console.log('scrypt five operations ms:',Date.now()-start);
});
test('scrypt concurrency is bounded at two', async () => {
  const a=password.hash('test-only-password-123'),b=password.hash('test-only-password-456');
  await assert.rejects(password.hash('test-only-password-789'),{code:'AUTH_BUSY'});
  await Promise.all([a,b]);
  console.log('scrypt process max RSS MiB:', Math.round(process.resourceUsage().maxRSS / 1024));
});
test('production cookie and explicit configuration', () => {
  const e={SESSION_SECRET:'x'.repeat(48),APP_ORIGIN:'https://example.invalid',NODE_ENV:'production'};
  const c=config(e);assert.equal(c.cookie.secure,true);assert.equal(c.cookie.httpOnly,true);assert.equal(c.cookie.sameSite,'lax');
  assert.equal(config({SESSION_SECRET:e.SESSION_SECRET}).cookie.secure,false);
  assert.throws(()=>config({...e,APP_ORIGIN:'http://example.invalid'}));
  assert.throws(()=>config({...e,SESSION_SECRET:''}));
  assert.throws(()=>config({SESSION_SECRET:e.SESSION_SECRET,APP_ORIGIN:'http://public.example'}));
});
test('idle and absolute deadlines',()=>{
 assert.equal(deadline({last_seen:1000,login_at:1000}),1000+IDLE);
 assert.equal(deadline({last_seen:ABSOLUTE,login_at:1000}),1000+ABSOLUTE);
});
