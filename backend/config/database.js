'use strict';

function configError(field) {
  var error = new Error('DB 설정을 확인하세요: ' + field);
  error.code = 'DB_CONFIG_INVALID';
  return error;
}

function readConfig(env) {
  env = env || process.env;
  ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].forEach(function (key) {
    if (typeof env[key] !== 'string' || !env[key].trim()) throw configError(key);
  });
  if (!/^[a-zA-Z0-9_]+$/.test(env.DB_NAME)) throw configError('DB_NAME');
  var port = env.DB_PORT === undefined ? 3306 : Number(env.DB_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw configError('DB_PORT');
  return {
    database: env.DB_NAME,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    options: {
      host: env.DB_HOST, port: port, dialect: 'mysql', timezone: '+00:00',
      logging: false, retry: { max: 0 },
      pool: { max: 5, min: 0, acquire: 5000, idle: 10000 },
      dialectOptions: {
        connectTimeout: 5000, supportBigNumbers: true, bigNumberStrings: true,
        multipleStatements: false, charset: 'utf8mb4'
      },
      define: { freezeTableName: true, timestamps: false }
    }
  };
}

module.exports = { readConfig: readConfig };
