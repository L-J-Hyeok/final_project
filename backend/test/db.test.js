'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var readConfig = require('../config/database').readConfig;
var connection = require('../db/connection');
var migrate = require('../db/migrate');
var makeHandler = require('../routes/db-health').makeHandler;
var fixture = { DB_HOST: '127.0.0.1', DB_NAME: 'test_only', DB_USER: 'test_only', DB_PASSWORD: 'fake-test-secret' };

test('설정 누락·잘못된 포트/DB명은 비밀값 없이 거절', function () {
  for (var key of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
    var env = Object.assign({}, fixture); delete env[key];
    assert.throws(function () { readConfig(env); }, { code: 'DB_CONFIG_INVALID' });
  }
  for (var port of ['0', '65536', 'text', '1.5', '']) {
    assert.throws(function () { readConfig(Object.assign({}, fixture, { DB_PORT: port })); });
  }
  assert.throws(function () { readConfig(Object.assign({}, fixture, { DB_NAME: 'bad;name' })); });
  var config = readConfig(fixture);
  assert.equal(config.options.port, 3306);
  assert.equal(config.options.logging, false);
  assert.equal(config.options.dialectOptions.multipleStatements, false);
});
test('CHECK를 지원하는 MySQL 8.0만 허용', function () {
  connection.assertVersion('8.0.16'); connection.assertVersion('8.0.45');
  for (var value of ['8.0.15', '5.7.44', '10.11.0-MariaDB', '9.0.1', '8.4.1']) {
    assert.throws(function () { connection.assertVersion(value); }, { code: 'DB_VERSION_UNSUPPORTED' });
  }
});
test('드라이버 에러·SQL·비밀번호는 공개하지 않음', function () {
  assert.equal(connection.publicCode(new Error(fixture.DB_PASSWORD)), 'DB_UNAVAILABLE');
  assert.equal(connection.publicCode({ code: 'DB_DEPENDENCY_MISSING' }), 'DB_DEPENDENCY_MISSING');
});
test('기존 테이블이 있으면 DDL 0회', async function () {
  var calls = [];
  var db = { query: async function (sql) { calls.push(sql); return [[{ TABLE_NAME: 'users' }]]; } };
  await assert.rejects(migrate.apply(db), { code: 'DB_SCHEMA_NOT_EMPTY' });
  assert.equal(calls.length, 1);
});
test('빈 DB 초기화는 정확히 8개 생성, 삭제·자동 변경 없음', async function () {
  var calls = [];
  var db = { query: async function (sql) { calls.push(sql); return [[]]; } };
  assert.deepEqual(await migrate.apply(db), migrate.tables);
  assert.equal(calls.length, 9);
  assert.ok(calls.slice(1).every(function (sql) { return /^CREATE TABLE/.test(sql); }));
  assert.ok(calls.every(function (sql) { return !/\b(DROP|TRUNCATE|DELETE|ALTER)\b/i.test(sql.replace(/ON DELETE (CASCADE|RESTRICT)/g, '')); }));
});
test('DDL 부분 실패 시 중단하고 원본 오류를 감춤', async function () {
  var calls = 0;
  var db = { query: async function () {
    calls++;
    if (calls === 4) throw new Error(fixture.DB_PASSWORD);
    return [[]];
  } };
  await assert.rejects(migrate.apply(db), function (error) {
    assert.equal(error.code, 'DB_MIGRATION_FAILED');
    assert.deepEqual(error.completed, ['users', 'sessions']);
    assert.ok(!error.message.includes(fixture.DB_PASSWORD));
    return true;
  });
  assert.equal(calls, 4);
});
function response() {
  return { headers: {}, set: function (k,v) { this.headers[k]=v; return this; },
    status: function (s) { this.statusCode=s; return this; },
    json: function (b) { this.body=b; return this; } };
}
test('Express health 핸들러의 연결 성공/실패 및 비밀정보 차단', async function () {
  var ok=response();
  await makeHandler(async function () {} )({},ok);
  assert.equal(ok.statusCode,200);
  var bad=response();
  await makeHandler(async function () { throw new Error(fixture.DB_PASSWORD); })({},bad);
  assert.equal(bad.statusCode,503);
  assert.equal(bad.headers['Cache-Control'],'no-store');
  assert.ok(!JSON.stringify(bad.body).includes(fixture.DB_PASSWORD));
});
