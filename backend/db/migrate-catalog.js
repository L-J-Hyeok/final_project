'use strict';
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const connection = require('./connection');

async function apply(db, target) {
  const [[row]] = await db.query('SELECT DATABASE() AS name');
  if (!target || row.name !== target) throw Object.assign(new Error('CATALOG_MIGRATION_TARGET_MISMATCH'), {
    code: 'CATALOG_MIGRATION_TARGET_MISMATCH'
  });
  const [tables] = await db.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('users','smartphones','smartphone_variants','price_observations')");
  if (tables.length !== 4) throw Object.assign(new Error('CATALOG_MIGRATION_REQUIRES_001'), {
    code: 'CATALOG_MIGRATION_REQUIRES_001'
  });
  const sql = await readFile(path.join(__dirname, 'migrations/007-common-catalog.sql'), 'utf8');
  for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) {
    await db.query(statement);
  }
}

async function main() {
  const [flag, target, ...extra] = process.argv.slice(2);
  if (flag !== '--apply' || !/^[a-zA-Z0-9_]+$/.test(target || '') || extra.length) {
    console.error('Usage: node db/migrate-catalog.js --apply <database-name>');
    process.exitCode = 1;
    return;
  }
  try {
    await apply(await connection.connect(), target);
    console.log('Common catalog tables ready.');
  } catch (error) {
    console.error(error.original?.code || error.code || 'CATALOG_MIGRATION_FAILED');
    process.exitCode = 1;
  } finally {
    await connection.close();
  }
}

if (require.main === module) main();
module.exports = { apply };
