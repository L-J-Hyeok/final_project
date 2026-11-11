'use strict';

var readConfig = require('../config/database').readConfig;
var database;

function safeError(code) {
  var error = new Error(code);
  error.code = code;
  return error;
}

function getDatabase() {
  if (database) return database;
  require('../config/loadEnv')();
  var config = readConfig();
  var Sequelize, mysql;
  try {
    Sequelize = require('sequelize').Sequelize;
    mysql = require('mysql2');
  } catch (_) {
    throw safeError('DB_DEPENDENCY_MISSING');
  }
  config.options.dialectModule = mysql;
  database = new Sequelize(config.database, config.username, config.password, config.options);
  try {
    require('./models')(database, require('sequelize').DataTypes, { extended: true });
  } catch (error) {
    var failed = database;
    database = undefined;
    failed.close().catch(function () {});
    throw safeError('DB_MODEL_INVALID');
  }
  return database;
}

function assertVersion(version) {
  var match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match || match[1] !== '8' || match[2] !== '0' || Number(match[3]) < 16 ||
      /mariadb/i.test(version)) throw safeError('DB_VERSION_UNSUPPORTED');
}

async function connect() {
  var db = getDatabase();
  await db.authenticate();
  var result = await db.query('SELECT VERSION() AS version');
  assertVersion(result[0][0].version);
  return db;
}

async function close() {
  var current = database;
  database = undefined;
  if (current) await current.close();
}

function publicCode(error) {
  var allowed = ['DB_CONFIG_INVALID', 'DB_DEPENDENCY_MISSING', 'DB_MODEL_INVALID',
    'DB_VERSION_UNSUPPORTED', 'DB_SCHEMA_NOT_EMPTY'];
  return error && allowed.indexOf(error.code) >= 0 ? error.code : 'DB_UNAVAILABLE';
}

module.exports = { getDatabase: getDatabase, connect: connect, close: close,
  assertVersion: assertVersion, publicCode: publicCode };
