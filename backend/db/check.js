'use strict';

var db = require('./connection');

(async function () {
  try {
    await db.connect();
    console.log('DB_CONNECTION_OK (MySQL 8.0.16+)');
  } catch (error) {
    console.error(db.publicCode(error));
    process.exitCode = 1;
  } finally {
    await db.close().catch(function () { process.exitCode = 1; });
  }
}());
