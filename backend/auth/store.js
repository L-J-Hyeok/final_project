'use strict';
var Store = require('express-session').Store;
var crypto = require('crypto');
var Op = require('sequelize').Op;
var connection = require('../db/connection');
var IDLE = 30 * 60 * 1000, ABSOLUTE = 24 * 60 * 60 * 1000;
function digest(sid) { return crypto.createHash('sha256').update(sid).digest(); }
function deadline(s) { return Math.min(s.last_seen + IDLE, (s.login_at || s.created_at) + ABSOLUTE); }
function payload(s) { return { user_id: s.user_id || null, csrf_token: s.csrf_token,
  created_at: s.created_at, login_at: s.login_at || null, last_seen: s.last_seen }; }
class MysqlStore extends Store {
  constructor(cookie) { super(); this.cookie = cookie; }
  model() { return connection.getDatabase().models.sessions; }
  get(sid, callback) {
    this.model().findByPk(digest(sid)).then(row => {
      if (!row) return callback(null, null);
      var s = row.data, now = Date.now();
      if (!s || !Number.isFinite(deadline(s)) || deadline(s) <= now || +row.expires_at <= now) return callback(null, null);
      callback(null, Object.assign({}, s, { _persisted: true,
        cookie: Object.assign({}, this.cookie, { originalMaxAge: Math.min(IDLE, deadline(s) - now), expires: new Date(deadline(s)) }) }));
    }).catch(callback);
  }
  set(sid, s, callback) {
    var now = Date.now(), end = deadline(s);
    if (!Number.isFinite(end) || end <= now) return callback(null);
    var values = { user_id: s.user_id || null, data: payload(s), expires_at: new Date(end) };
    // Loaded sessions are UPDATE-only: a concurrent logout cannot resurrect them.
    var job = s._persisted
      ? this.model().update(values, { where: { sid_hash: digest(sid), expires_at: { [Op.gt]: new Date(now) } } })
      : this.model().create(Object.assign({ sid_hash: digest(sid) }, values));
    job.then(() => { s._persisted = true; callback(null); }).catch(callback);
  }
  touch(sid, s, callback) {
    var now = Date.now();
    var end = deadline(s);
    if (!Number.isFinite(end) || end <= now) return callback(null);
    this.model().update({ data: payload(s), expires_at: new Date(end) }, {
      where: { sid_hash: digest(sid), expires_at: { [Op.gt]: new Date(now) } }
    }).then(() => callback(null)).catch(callback);
  }
  destroy(sid, callback) { this.model().destroy({ where: { sid_hash: digest(sid) } }).then(() => callback(null)).catch(callback); }
}
module.exports = { MysqlStore: MysqlStore, digest: digest, deadline: deadline, IDLE: IDLE, ABSOLUTE: ABSOLUTE };
