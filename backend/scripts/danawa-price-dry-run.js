'use strict';

const fs = require('fs');
const path = require('path');
const { createDanawaSearchAdapter } = require('../services/danawa-price-adapter');
const { loadExistingSmartphoneVariants, runDanawaPriceDryRun } = require('../services/danawa-price-sync');

const DEFAULT_FIXTURE_PATH = path.resolve(__dirname, '../data/danawa-cli-mock-samples.json');
const DEFAULT_TARGET_MODELS = ['SM-S921N', 'SM-F741N', 'SM-S938N', 'A3293'];

const OFFLINE_FALLBACK_VARIANTS = [
  { variant_id: '90000500', smartphone_id: '90000119', brand: 'samsung', model_name: 'Galaxy S24', domestic_model_number: 'SM-S921N', storage_gb: 256, ram_gb: 8, color: '앰버 옐로우', launch_price_krw: null },
  { variant_id: '90001390', smartphone_id: '90000119', brand: 'samsung', model_name: 'Galaxy S24', domestic_model_number: 'SM-S921N', storage_gb: 256, ram_gb: 8, color: '마블 그레이', launch_price_krw: null },
  { variant_id: '90001375', smartphone_id: '90000115', brand: 'samsung', model_name: 'Galaxy Z Flip6', domestic_model_number: 'SM-F741N', storage_gb: 256, ram_gb: 12, color: '민트', launch_price_krw: null },
  { variant_id: '90001376', smartphone_id: '90000115', brand: 'samsung', model_name: 'Galaxy Z Flip6', domestic_model_number: 'SM-F741N', storage_gb: 256, ram_gb: 12, color: '실버 쉐도우', launch_price_krw: null },
  { variant_id: '90001420', smartphone_id: '90000126', brand: 'samsung', model_name: 'Galaxy S25 Ultra', domestic_model_number: 'SM-S938N', storage_gb: 256, ram_gb: 12, color: '티타늄 블랙', launch_price_krw: null },
  { variant_id: '90001425', smartphone_id: '90000126', brand: 'samsung', model_name: 'Galaxy S25 Ultra', domestic_model_number: 'SM-S938N', storage_gb: 1024, ram_gb: 12, color: '티타늄 블랙', launch_price_krw: null },
  { variant_id: '90000504', smartphone_id: '90000126', brand: 'samsung', model_name: 'Galaxy S25 Ultra', domestic_model_number: 'SM-S938N', storage_gb: 1024, ram_gb: 16, color: '티타늄 제트블랙', launch_price_krw: 2249500 },
  { variant_id: '90000477', smartphone_id: '90000106', brand: 'apple', model_name: 'iPhone 16 Pro', domestic_model_number: 'A3293', storage_gb: 128, ram_gb: null, color: '내추럴 티타늄', launch_price_krw: null },
  { variant_id: '90001323', smartphone_id: '90000106', brand: 'apple', model_name: 'iPhone 16 Pro', domestic_model_number: 'A3293', storage_gb: 256, ram_gb: 8, color: '데저트 티타늄', launch_price_krw: null },
];

function parseArgs(argv) {
  const opts = {
    offline: false,
    json: false,
    limit: 30,
    ttlHours: 6,
    models: DEFAULT_TARGET_MODELS,
    fixturePath: DEFAULT_FIXTURE_PATH,
    now: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--offline') opts.offline = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--limit' && argv[i + 1]) opts.limit = Number(argv[++i]);
    else if (arg === '--ttl-hours' && argv[i + 1]) opts.ttlHours = Number(argv[++i]);
    else if (arg === '--models' && argv[i + 1]) {
      opts.models = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg === '--fixture' && argv[i + 1]) {
      opts.fixturePath = path.resolve(argv[++i]);
    } else if (arg === '--now' && argv[i + 1]) {
      opts.now = argv[++i];
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const fixtures = JSON.parse(fs.readFileSync(opts.fixturePath, 'utf8'));
  const evaluationNow = opts.now || fixtures.referenceNow || new Date().toISOString();

  const adapter = createDanawaSearchAdapter({
    mode: 'mock',
    fixtures,
  });

  let dbConnection = null;
  let variantSource = 'offline_fallback';
  let variants = OFFLINE_FALLBACK_VARIANTS;

  if (!opts.offline) {
    dbConnection = require('../db/connection');
    await dbConnection.connect();
    try {
      variants = await loadExistingSmartphoneVariants(dbConnection.getDatabase(), {
        domesticModelNumbers: opts.models,
        limit: opts.limit,
      });
      variantSource = 'mysql_read_only';
    } finally {
      await dbConnection.close();
    }
  }

  const report = await runDanawaPriceDryRun({
    variants,
    adapter,
    now: evaluationNow,
    ttlHours: opts.ttlHours,
    fixtureGeneratedAt: fixtures.generatedAt || null,
    sourceName: 'danawa-cli',
  });

  const output = {
    variantSource,
    fixturePath: opts.fixturePath,
    ...report,
  };

  if (opts.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log('=== Danawa CLI Price Integration Dry-Run ===');
  console.log(`Variant Source       : ${variantSource}`);
  console.log(`Adapter Mode         : ${output.summary.adapterMode} (liveRequest=${output.summary.executedLiveRequest})`);
  console.log(`DB Writes Attempted  : ${output.summary.dbWritesAttempted}`);
  console.log(`TTL Policy           : ${output.summary.ttlHours}h (max 24h)`);
  console.log(`Variants Checked     : ${output.summary.totalVariantsChecked}`);
  console.log(`Variants Matched     : ${output.summary.variantsWithMatchedCandidates}`);
  console.log(`Variants ReferenceOK : ${output.summary.variantsWithReferencePrice}`);
  console.log(`Variants StorageReady: ${output.summary.variantsReadyForStorage}`);
  console.log(`Matched Offers       : ${output.summary.totalMatchedItems} (ready=${output.summary.totalReadyObservations}, incompleteSearchOnly=${output.summary.totalIncompleteSearchOnlyMatches})`);
  console.log(`Excluded Items       : ${output.summary.totalRejectedItems} -> ${JSON.stringify(output.summary.exclusionBreakdown)}`);
  console.log('');

  for (const entry of output.variantReports) {
    if (entry.matchedCount === 0) continue;
    const v = entry.variant;
    const best = entry.bestSelectedPrice;
    const refPrice = entry.bestReferencePrice;
    const incomplete = entry.mappedMatches.filter(m => !m.readyForStorage);
    console.log(
      `[MATCH] variant=${v.variant_id} ${v.model_name} (${v.domestic_model_number}) ${v.storage_gb}GB${v.ram_gb ? `/${v.ram_gb}GB` : ''} ${v.color}`
    );
    if (best) {
      console.log(
        `  -> Selected Verified (24h eligible): ${best.total_krw.toLocaleString('ko-KR')}원 (product=${best.amount_krw.toLocaleString('ko-KR')} + ship=${best.shipping_krw}) seller=${best.seller_name} expires=${best.expires_at}`
      );
    }
    if (refPrice) {
      console.log(
        `  -> Reference Price (${refPrice.price_label}): ${refPrice.amount_krw.toLocaleString('ko-KR')}원 url=${refPrice.danawa_product_url} checked_at=${refPrice.checked_at}`
      );
    }
    if (!best && incomplete.length > 0) {
      console.log(
        `  -> DB Storage Blocked (incomplete seller fields): ${incomplete[0].blockingReasons.join(',')}`
      );
    }
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Dry-run failed:', err);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_TARGET_MODELS,
  OFFLINE_FALLBACK_VARIANTS,
  parseArgs,
  main,
};
