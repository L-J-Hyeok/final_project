'use strict';

var fs = require('fs');
var path = require('path');
var parseEnv = require('node:util').parseEnv;
var keys = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
  'SESSION_SECRET', 'APP_ORIGIN', 'TRUST_PROXY_LOOPBACK',
  'AI_PROVIDER', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'UPGRADE_SNOOZE_DAYS'];

// 허용된 서버 설정만 읽는다. 실행 환경의 명시적 값은 덮어쓰지 않는다.
module.exports = function loadEnv(file, env) {
  file = file || path.resolve(__dirname, '..', '.env');
  env = env || process.env;
  var values;
  try {
    values = parseEnv(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return;
    var safe = new Error('DB_CONFIG_INVALID');
    safe.code = 'DB_CONFIG_INVALID';
    throw safe;
  }
  keys.forEach(function (key) {
    if (env[key] === undefined && values[key] !== undefined) env[key] = values[key];
  });
};
