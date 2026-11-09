'use strict';

var fs = require('fs');
var path = require('path');
var connection = require('./connection');
var expected = ['users', 'sessions', 'profiles', 'smartphones',
  'smartphone_variants', 'price_observations', 'owned_devices', 'recommendations'];

function statements() {
  var sql = fs.readFileSync(path.join(__dirname, 'migrations/001-initial.sql'), 'utf8');
  var parts = sql.split(';').map(function (s) { return s.trim(); }).filter(Boolean);
  if (parts.length !== expected.length || parts.some(function (s, i) {
    return !s.startsWith('CREATE TABLE ' + expected[i] + ' (');
  })) throw new Error('DB_MIGRATION_INVALID');
  return parts;
}

async function apply(db) {
  var existing = await db.query(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
  if (existing[0].length) {
    var error = new Error('DB_SCHEMA_NOT_EMPTY');
    error.code = 'DB_SCHEMA_NOT_EMPTY';
    throw error;
  }
  var parts = statements();
  var completed = [];
  try {
    for (var i = 0; i < parts.length; i++) {
      await db.query(parts[i]);
      completed.push(expected[i]);
    }
  } catch (error) {
    // MySQL DDL 자동 커밋: 삭제/롤백하지 않고 완료한 테이블 이름만 알린다.
    var failure = new Error('DB_MIGRATION_FAILED');
    failure.code = 'DB_MIGRATION_FAILED';
    failure.completed = completed;
    throw failure;
  }
  return completed;
}

async function main() {
  if (process.argv.slice(2).join(' ') !== '--apply') {
    console.error('사용법: node db/migrate.js --apply (기존 빈 DB 전용)');
    process.exitCode = 1;
    return;
  }
  try {
    var db = await connection.connect();
    console.log('생성 완료: ' + (await apply(db)).join(', '));
  } catch (error) {
    console.error(error.code === 'DB_MIGRATION_FAILED' ? error.code : connection.publicCode(error));
    if (error.completed) console.error('생성된 테이블: ' + error.completed.join(', '));
    process.exitCode = 1;
  } finally {
    await connection.close().catch(function () { process.exitCode = 1; });
  }
}

if (require.main === module) main();
module.exports = { apply: apply, statements: statements, tables: expected };
