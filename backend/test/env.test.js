'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var os = require('os');
var path = require('path');
var loadEnv = require('../config/loadEnv');

test('DB 환경 파일: 환경 우선·인용부호·DB 키만 허용·누락·읽기 오류', function () {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mvp-env-test-'));
  var file = path.join(dir, '.env');
  try {
    fs.writeFileSync(file, 'DB_HOST=localhost\r\nDB_NAME=final_project\r\nDB_PASSWORD="test#value"\r\nDB_SYNC_ALTER=true\r\nNODE_OPTIONS=ignored\r\n');
    var env = { DB_HOST: '127.0.0.1' };
    loadEnv(file, env);
    assert.deepEqual(env, { DB_HOST: '127.0.0.1', DB_NAME: 'final_project', DB_PASSWORD: 'test#value' });
    loadEnv(path.join(dir, 'absent'), env);
    assert.throws(function () { loadEnv(dir, {}); }, { code: 'DB_CONFIG_INVALID', message: 'DB_CONFIG_INVALID' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
