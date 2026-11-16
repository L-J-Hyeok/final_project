'use strict';

const fs = require('fs');
const path = require('path');
const conn = require('../db/connection');
const adapter = require('../services/danawa-price-adapter');
const matcher = require('../services/danawa-price-matcher');
const sync = require('../services/danawa-price-sync');

const SLEEP_MS = 600;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getKoreanModelName(modelName) {
  return String(modelName || '')
    .replace(/^Galaxy\s+/i, '갤럭시')
    .replace(/^iPhone\s+/i, '아이폰');
}

async function supplementMissingPrices() {
  const { searchDanawa } = await import('danawa-cli');
  const db = conn.getDatabase();

  const reportPath = path.resolve(__dirname, '../data/live-danawa-collection-report.json');
  const prevReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const failures = prevReport.failures || [];
  console.log(`Starting supplement run for ${failures.length} previously failed groups...`);

  // Load variant metadata for each failed group
  const [variants] = await db.query(`
    SELECT
      s.id AS smartphone_id,
      s.brand,
      s.model_name,
      s.domestic_model_number,
      v.id AS variant_id,
      v.storage_gb,
      v.ram_gb,
      v.color
    FROM smartphones s
    JOIN smartphone_variants v ON v.smartphone_id = s.id
    WHERE s.verified = 1 AND v.verified = 1
    ORDER BY s.id ASC, v.storage_gb ASC, v.id ASC
  `);

  const groupInfoMap = new Map();
  for (const v of variants) {
    const key = `${v.model_name} ${v.domestic_model_number} ${v.storage_gb}GB`;
    if (!groupInfoMap.has(key)) {
      groupInfoMap.set(key, {
        smartphone_id: String(v.smartphone_id),
        brand: v.brand,
        model_name: v.model_name,
        domestic_model_number: v.domestic_model_number,
        storage_gb: Number(v.storage_gb),
        ram_gb: v.ram_gb != null ? Number(v.ram_gb) : null,
        rep_variant_id: String(v.variant_id),
        color: v.color || '블랙',
      });
    }
  }

  const results = {
    totalToProcess: failures.length,
    successfulMatches: 0,
    failedGroups: 0,
    successfulList: [],
    stillFailedList: [],
    offersToPersist: [],
  };

  for (let i = 0; i < failures.length; i++) {
    const f = failures[i];
    const g = groupInfoMap.get(f.group);
    if (!g) {
      console.log(`[SKIP - NOT FOUND IN DB] ${f.group}`);
      continue;
    }

    const storageToken = adapter.formatStorageToken(g.storage_gb);
    const koreanModel = getKoreanModelName(g.model_name);

    // Refined queries
    const queries = [];
    if (g.domestic_model_number) {
      queries.push(`${g.domestic_model_number} ${storageToken} 자급제`);
      queries.push(`${g.domestic_model_number} ${storageToken}`);
      queries.push(`${g.domestic_model_number} 자급제`);
    }
    queries.push(`${koreanModel} ${storageToken} 자급제`);
    queries.push(`${g.model_name} ${storageToken} 자급제`);

    const targetVariant = {
      variant_id: g.rep_variant_id,
      smartphone_id: g.smartphone_id,
      brand: g.brand,
      model_name: g.model_name,
      domestic_model_number: g.domestic_model_number,
      storage_gb: g.storage_gb,
      ram_gb: g.ram_gb,
      color: g.color,
    };

    console.log(`[${i + 1}/${failures.length}] Re-evaluating: ${f.group} (prev reason: ${f.reason})`);

    let matchedOffer = null;
    let lastRejections = [];

    // Deduplicate queries
    const uniqueQueries = [...new Set(queries)];
    for (const q of uniqueQueries) {
      try {
        await sleep(SLEEP_MS);
        const searchRes = await searchDanawa({ query: q, limit: 10 });
        const items = (searchRes.items || []).map(adapter.normalizeDanawaItem);
        if (!items.length) {
          lastRejections = [{ reason: 'NO_SEARCH_RESULTS', query: q }];
          continue;
        }

        const matchEval = matcher.evaluateVariantCandidates(items, targetVariant, {
          requireDomesticModelNumber: false,
          allowSpecificColorAsCommon: true,
          forceCapacityCommon: true,
        });

        if (matchEval.bestMatch) {
          matchedOffer = matchEval.bestMatch;
          break;
        } else {
          lastRejections = matchEval.rejected.map(r => ({
            reasons: r.reasons,
            productName: r.item?.productName,
            category: r.exclusionCategory,
          }));
        }
      } catch (err) {
        lastRejections = [{ reason: `ERROR:${err.message}`, query: q }];
      }
    }

    if (matchedOffer) {
      const refPrice = sync.buildDanawaReferencePrice(
        matchedOffer,
        targetVariant,
        { isMock: false, ttlHours: 24 }
      );

      if (refPrice && Number(refPrice.amount_krw) > 0) {
        results.successfulMatches += 1;
        results.successfulList.push({
          group: f.group,
          model_name: g.model_name,
          domestic_model_number: g.domestic_model_number,
          storage_gb: g.storage_gb,
          ram_gb: g.ram_gb,
          amount_krw: refPrice.amount_krw,
          pcode: matchedOffer.item?.productCode,
          productName: matchedOffer.item?.productName,
          originalListingColor: matchedOffer.matchDetails?.originalListingColor || null,
          rep_variant_id: g.rep_variant_id,
        });

        results.offersToPersist.push({
          refPrice,
          variant: targetVariant,
        });

        console.log(`   --> [SUPPLEMENT MATCH] ${refPrice.amount_krw.toLocaleString('ko-KR')}원 (pcode: ${matchedOffer.item?.productCode}) - ${matchedOffer.item?.productName}`);
      } else {
        results.failedGroups += 1;
        results.stillFailedList.push({
          group: f.group,
          reason: 'REF_PRICE_BUILD_FAILED',
        });
      }
    } else {
      results.failedGroups += 1;
      const primaryReason = lastRejections.length
        ? (lastRejections[0].reason || lastRejections[0].reasons?.join(',') || 'NO_MATCH')
        : 'NO_RESULTS';
      results.stillFailedList.push({
        group: f.group,
        reason: primaryReason,
        sampleTitle: lastRejections[0]?.productName || null,
      });
      console.log(`   --> [STILL NO MATCH] ${primaryReason}`);
    }
  }

  console.log('\n=========================================');
  console.log('SUPPLEMENT COMPLETED. PERSISTING NEW MATCHES TO MYSQL...');
  console.log(`New matches to persist: ${results.offersToPersist.length}`);

  let persistResult = { insertedCount: 0, updatedPriceCount: 0, skippedDuplicatesCount: 0 };
  if (results.offersToPersist.length > 0) {
    persistResult = await sync.persistDanawaReferenceObservations(db, results.offersToPersist, {
      apply: true,
      allowDbWrite: true,
      permissionRef: 'USER_LIVE_COLLECTION_APPROVED',
      ttlHours: 24,
    });
  }

  console.log('PERSIST RESULT:', persistResult);
  console.log('=========================================\n');

  const supplementSummary = {
    totalTargetedFromFailures: failures.length,
    newlyAcquiredPrices: results.successfulMatches,
    insertedToDb: persistResult.insertedCount + persistResult.updatedPriceCount,
    remainingMissingGroups: results.failedGroups,
    successfulList: results.successfulList,
    stillFailedList: results.stillFailedList,
  };

  fs.writeFileSync(
    path.resolve(__dirname, '../data/live-danawa-supplement-report.json'),
    JSON.stringify(supplementSummary, null, 2),
    'utf8'
  );

  console.log(JSON.stringify(supplementSummary, null, 2));
  process.exit(0);
}

supplementMissingPrices().catch(err => {
  console.error('Fatal supplement error:', err);
  process.exit(1);
});
