'use strict';
const fs = require('node:fs');
const path = require('node:path');
const connection = require('./connection');

async function apply(db, target) {
  const [[row]] = await db.query('SELECT DATABASE() AS name');
  if (!target || row.name !== target) throw new Error('PERFORMANCE_MIGRATION_TARGET_MISMATCH');
  const sql = fs.readFileSync(path.join(__dirname, 'migrations/006-smartphone-performance.sql'), 'utf8');
  await db.query(sql);
}

async function main() {
  const [flag, target, ...extra] = process.argv.slice(2);
  if (flag !== '--apply' || !/^[a-zA-Z0-9_]+$/.test(target || '') || extra.length) {
    console.error('Usage: node db/migrate-performance.js --apply <database-name>');
    process.exitCode = 1;
    return;
  }
  try {
    await apply(await connection.connect(), target);
    console.log('Performance measurement table ready.');
  } catch (error) {
    console.error(error.original?.code || error.code || error.message);
    process.exitCode = 1;
  } finally {
    await connection.close();
  }
}

if (require.main === module) main();
module.exports = { apply };
