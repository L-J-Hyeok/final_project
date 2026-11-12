'use strict';
var express = require('express');
var crypto = require('crypto');
var connection = require('../db/connection');
var password = require('../auth/password');
var storeModule = require('../auth/store');
var limiterFactory = require('../auth/limiter');
function fail(status, code, message) { return Object.assign(new Error(message || code), { status: status, code: code }); }
function credentials(body) {
  if (!body || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'email,password' ||
      typeof body.email !== 'string' || typeof body.password !== 'string') throw fail(422, 'INVALID_INPUT');
  var email = body.email.trim().toLowerCase(), p = body.password;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      [...p].length < 8 || [...p].length > 128 || Buffer.byteLength(p) > 512) throw fail(422, 'INVALID_INPUT');
  return { email: email, password: p };
}
function callSession(req, method) { return new Promise((resolve, reject) => req.session[method](err => err ? reject(err) : resolve())); }
function token() { return crypto.randomBytes(32).toString('hex'); }
module.exports = function createAuth(config) {
  var router = express.Router(), limiter = limiterFactory();
  var wrap = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);
  router.get('/csrf', wrap(async (req, res) => {
    if (!req.session.csrf_token) { req.session.csrf_token = token(); req.session.created_at = req.session.last_seen = Date.now(); }
    await callSession(req, 'save');
    res.json({ data: { csrf_token: req.session.csrf_token } });
  }));
  router.post('/register', wrap(async (req, res) => {
    if (!limiter.take('register:' + req.ip, 5, 3600000)) throw fail(429, 'RATE_LIMITED');
    var input = credentials(req.body), hash = await password.hash(input.password);
    var db = connection.getDatabase();
    var user;
    try {
      user = await db.transaction(async t => {
        var u = await db.models.users.create({ email: input.email, password_hash: hash }, { transaction: t });
        await db.models.profiles.create({ user_id: u.id, common_json: {}, smartphone_json: {} }, { transaction: t });
        return u;
      });
    } catch (err) { if (err.name === 'SequelizeUniqueConstraintError') throw fail(409, 'REGISTRATION_CONFLICT'); throw err; }
    res.status(201).json({ data: { id: String(user.id), email: user.email } });
  }));
  router.post('/login', wrap(async (req, res) => {
    var input = credentials(req.body);
    var key = crypto.createHash('sha256').update(input.email).digest('hex') + ':' + req.ip;
    var releaseIp = limiter.take('login-ip:' + req.ip, 30, 900000);
    if (!releaseIp) throw fail(429, 'RATE_LIMITED');
    var releasePair = limiter.take('login-pair:' + key, 5, 900000);
    if (!releasePair) throw fail(429, 'RATE_LIMITED');
    var user = await connection.getDatabase().models.users.findOne({ where: { email: input.email } });
    var valid = await password.verify(input.password, user && user.password_hash);
    if (!user || !valid) throw fail(401, 'INVALID_CREDENTIALS');
    releaseIp(); releasePair();
    await callSession(req, 'regenerate');
    req.session.user_id = String(user.id); req.session.csrf_token = token();
    req.session.created_at = req.session.login_at = req.session.last_seen = Date.now();
    req.session.cookie.maxAge = storeModule.IDLE;
    await callSession(req, 'save');
    res.json({ data: { user: { id: String(user.id), email: user.email }, csrf_token: req.session.csrf_token } });
  }));
  router.get('/me', wrap(async (req, res) => {
    if (!req.session.user_id) throw fail(401, 'AUTH_REQUIRED');
    var user = await connection.getDatabase().models.users.findByPk(req.session.user_id, { attributes: ['id', 'email'] });
    if (!user) { await callSession(req, 'destroy'); res.clearCookie('sid', config.cookie); throw fail(401, 'AUTH_REQUIRED'); }
    res.json({ data: { id: String(user.id), email: user.email } });
  }));
  router.post('/logout', wrap(async (req, res) => {
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length) throw fail(422, 'INVALID_INPUT');
    if (!req.session.user_id) throw fail(401, 'AUTH_REQUIRED');
    await callSession(req, 'destroy');
    res.clearCookie('sid', config.cookie); res.status(204).end();
  }));
  return router;
};
