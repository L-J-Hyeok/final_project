'use strict';
var express = require('express');
var session = require('express-session');
var crypto = require('crypto');
var storeModule = require('./store');
var limiterFactory = require('./limiter');
function fail(status, code) { return Object.assign(new Error(code), { status: status, code: code }); }
function callSession(req, method) { return new Promise((resolve, reject) => req.session[method](err => err ? reject(err) : resolve())); }
function equal(a, b) { return typeof a === 'string' && typeof b === 'string' && /^[a-f0-9]{64}$/.test(a) && /^[a-f0-9]{64}$/.test(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
module.exports = function (config) {
  var router = express.Router(), limiter = limiterFactory();
  var store = new storeModule.MysqlStore(config.cookie);
  var wrap = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use((req, res, next) => {
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('Origin') !== config.origin) return next(fail(403, 'CSRF_INVALID'));
    if (!limiter.take('request:' + req.ip, 120, 60000)) return next(fail(429, 'RATE_LIMITED'));
    next();
  });
  router.use(session({ name: 'sid', secret: config.secret, store: store, resave: false,
    saveUninitialized: false, rolling: true, cookie: Object.assign({ maxAge: storeModule.IDLE }, config.cookie) }));
  router.use(wrap(async (req, res, next) => {
    var now = Date.now();
    if (req.session.created_at && storeModule.deadline(req.session) <= now) await callSession(req, 'regenerate');
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && !equal(req.get('X-CSRF-Token'), req.session.csrf_token)) throw fail(403, 'CSRF_INVALID');
    if (req.session.created_at) {
      req.session.last_seen = now;
      req.session.cookie.maxAge = Math.min(storeModule.IDLE, (req.session.login_at || req.session.created_at) + storeModule.ABSOLUTE - now);
    }
    next();
  }));
  return router;
};
