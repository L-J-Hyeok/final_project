'use strict';

const fs = require('fs');
const path = require('path');
const { connect, close, getDatabase } = require('../db/connection');
const discovery = require('../services/smartphone-candidate-discovery');
const verifier = require('../services/smartphone-candidate-verifier');

const DEFAULT_DISCOVERY_PATH = path.resolve(__dirname, '../data/smartphone-discovery-candidates-2026-11-12.json');
const DEFAULT_OUTPUT_PATH = path.resolve(__dirname, '../data/smartphone-verification-report-2026-11-12.json');

function parseCliArgs(argv = []) {
  if (argv.includes('--apply') || argv.includes('--write-db')) {
    const err = new Error('Phase 3 verification script is strictly read-only on MySQL and does not accept --apply or --write-db.');
    err.code = 'PHASE3_READ_ONLY_VIOLATION';
    throw err;
  }

  let discoveryPath = DEFAULT_DISCOVERY_PATH;
  let outputPath = DEFAULT_OUTPUT_PATH;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--in' && argv[i + 1]) {
      discoveryPath = path.resolve(argv[++i]);
    } else if (arg === '--out' && argv[i + 1]) {
      outputPath = path.resolve(argv[++i]);
    }
  }

  return { discoveryPath, outputPath };
}

async function runVerificationCli(argv = process.argv.slice(2)) {
  const { discoveryPath, outputPath } = parseCliArgs(argv);
  const discoveryReport = JSON.parse(fs.readFileSync(discoveryPath, 'utf8'));

  await connect();
  try {
    const db = getDatabase();
    const { models, variants } = await discovery.loadExistingInventoryFromDb(db);
    const report = verifier.verifyAllCandidates({
      discoveryReport,
      existingModels: models,
      existingVariants: variants,
      checkedAt: discoveryReport.checked_at || discovery.DEFAULT_CHECKED_AT,
    });

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    return { report, outputPath };
  } finally {
    await close();
  }
}

if (require.main === module) {
  runVerificationCli()
    .then(({ report, outputPath }) => {
      console.log('=== PHASE 3 CANDIDATE VERIFICATION COMPLETE (DB READ-ONLY) ===');
      console.log('Output:', outputPath);
      console.log('Summary:', JSON.stringify(report.summary, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Verification failed:', err.code || err.message);
      process.exit(1);
    });
}

module.exports = {
  parseCliArgs,
  runVerificationCli,
};
