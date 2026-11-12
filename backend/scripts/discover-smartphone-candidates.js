'use strict';

const fs = require('fs');
const path = require('path');
const { connect, close, getDatabase } = require('../db/connection');
const discovery = require('../services/smartphone-candidate-discovery');

const DEFAULT_SOURCES_PATH = path.resolve(__dirname, '../data/kr-smartphone-discovery-sources-2026-11-12.json');
const DEFAULT_OUTPUT_PATH = path.resolve(__dirname, '../data/smartphone-discovery-candidates-2026-11-12.json');

function parseCliArgs(argv = []) {
  if (argv.includes('--apply') || argv.includes('--write-db')) {
    const err = new Error('Phase 2 discovery script is strictly read-only on MySQL and does not accept --apply or --write-db.');
    err.code = 'PHASE2_READ_ONLY_VIOLATION';
    throw err;
  }

  let sourcesPath = DEFAULT_SOURCES_PATH;
  let outputPath = DEFAULT_OUTPUT_PATH;
  let referenceDate = discovery.DEFAULT_CHECKED_AT;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--sources' && argv[i + 1]) {
      sourcesPath = path.resolve(argv[++i]);
    } else if (arg === '--out' && argv[i + 1]) {
      outputPath = path.resolve(argv[++i]);
    } else if (arg === '--date' && argv[i + 1]) {
      referenceDate = argv[++i];
    }
  }

  return { sourcesPath, outputPath, referenceDate };
}

async function runDiscoveryCli(argv = process.argv.slice(2)) {
  const { sourcesPath, outputPath, referenceDate } = parseCliArgs(argv);
  const rawSources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
  const sourceRecords = Array.isArray(rawSources.records) ? rawSources.records : [];

  await connect();
  try {
    const db = getDatabase();
    const { models, variants } = await discovery.loadExistingInventoryFromDb(db);
    const report = await discovery.discoverSmartphoneCandidates({
      sourceRecords,
      existingModels: models,
      existingVariants: variants,
      referenceDateKst: referenceDate,
      checkedAt: rawSources.checked_at || referenceDate,
    });

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    return { report, outputPath };
  } finally {
    await close();
  }
}

if (require.main === module) {
  runDiscoveryCli()
    .then(({ report, outputPath }) => {
      console.log('=== PHASE 2 SMARTPHONE DISCOVERY COMPLETE (DB READ-ONLY) ===');
      console.log('Output:', outputPath);
      console.log('Window:', report.release_window_kst.min_date, '~', report.release_window_kst.max_date);
      console.log('Existing DB:', JSON.stringify(report.existing_db_snapshot_summary));
      console.log('Summary:', JSON.stringify(report.summary, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Discovery failed:', err.code || err.message);
      process.exit(1);
    });
}

module.exports = {
  parseCliArgs,
  runDiscoveryCli,
};
