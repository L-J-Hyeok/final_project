'use strict';
const { readFile } = require('node:fs/promises');
const connection = require('../db/connection');
const importer = require('../services/catalog-import');

async function main() {
  const [file, flag, target, ...extra] = process.argv.slice(2);
  if (!file || (flag && (flag !== '--apply' || !/^[a-zA-Z0-9_]+$/.test(target || '') || extra.length))) {
    throw new Error('Usage: node scripts/import-common-catalog.js <input.json> [--apply <database-name>]');
  }
  const input = JSON.parse(await readFile(file, 'utf8'));
  const prepared = importer.prepare(input);
  if (!flag) {
    const readiness = importer.assessCatalogEntries(prepared);
    console.log(JSON.stringify({ mode: 'dry-run', models: prepared.length,
      skus: prepared.reduce((sum, entry) => sum + entry.skus.length, 0),
      prices: prepared.flatMap(entry => entry.skus).reduce((sum, item) => sum + item.prices.length, 0),
      readiness }, null, 2));
    return;
  }
  const db = await connection.connect();
  const [[actual]] = await db.query('SELECT DATABASE() AS name');
  if (target !== actual.name) throw Object.assign(new Error('CATALOG_TARGET_MISMATCH'), { code: 'CATALOG_TARGET_MISMATCH' });
  console.log(JSON.stringify({ mode: 'applied', ...await importer.apply(db, input) }));
}

main().catch(error => {
  const code = error.original?.code || error.code || (error.message?.startsWith('Usage:') ? error.message : 'CATALOG_IMPORT_FAILED');
  console.error(error.detail ? `${code}: ${error.detail}` : code);
  process.exitCode = 1;
}).finally(() => connection.close());
