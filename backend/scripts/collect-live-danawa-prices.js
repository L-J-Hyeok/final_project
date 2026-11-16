'use strict';

const path = require('path');
const fs = require('fs');
const conn = require('../db/connection');
const publication = require('../services/product-publication');
const salesChannel = require('../services/smartphone-sales-channel');
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

async function collectAllLivePrices() {
  const { searchDanawa } = await import('danawa-cli');
  const db = conn.getDatabase();
  const pubSql = await publication.sql(db);
  const chanSql = salesChannel.sql('s', true);

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
    WHERE ${pubSql} AND ${chanSql}
    ORDER BY s.id ASC, v.storage_gb ASC, v.ram_gb ASC, v.id ASC
  `);

  // Group by (smartphone_id, storage_gb, resolved_ram_gb) in JS
  // First, find known RAMs per (smartphone_id, storage_gb)
  const ramsByPhoneAndStorage = new Map();
  for (const v of variants) {
    const key = `${v.smartphone_id}:${v.storage_gb}`;
    if (!ramsByPhoneAndStorage.has(key)) ramsByPhoneAndStorage.set(key, new Set());
    if (v.ram_gb != null) ramsByPhoneAndStorage.get(key).add(Number(v.ram_gb));
  }

  const groupMap = new Map();
  for (const v of variants) {
    const psKey = `${v.smartphone_id}:${v.storage_gb}`;
    const knownRams = ramsByPhoneAndStorage.get(psKey);
    // If there is only one known RAM for this storage, resolve null RAM to it
    const resolvedRam = v.ram_gb != null
      ? Number(v.ram_gb)
      : (knownRams.size === 1 ? [...knownRams][0] : null);

    const groupKey = `${v.domestic_model_number}:${v.storage_gb}:${resolvedRam ?? 'null'}`;
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        smartphone_id: v.smartphone_id,
        brand: v.brand,
        model_name: v.model_name,
        domestic_model_number: v.domestic_model_number,
        storage_gb: Number(v.storage_gb),
        resolved_ram_gb: resolvedRam,
        rep_variant_id: v.variant_id,
        rep_color: v.color,
        variant_ids: [],
        colors: new Set(),
        require_explicit_ram: knownRams.size > 1,
      });
    }

    const g = groupMap.get(groupKey);
    g.variant_ids.push(v.variant_id);
    g.colors.add(v.color);
  }

  const allGroups = [...groupMap.values()];

  console.log(`Found ${allGroups.length} public unlocked groups in total.`);

  // Find existing fresh observations in DB (e.g. 802, 803, 804)
  const [existingObs] = await db.query(`
    SELECT p.id, p.variant_id, p.amount_krw, p.source_url, v.smartphone_id, v.storage_gb, v.ram_gb, s.domestic_model_number
    FROM price_observations p
    JOIN smartphone_variants v ON v.id = p.variant_id
    JOIN smartphones s ON s.id = v.smartphone_id
    WHERE p.expires_at > NOW() AND p.observed_at <= NOW()
  `);

  const existingGroupKeys = new Set(
    existingObs.map(o => `${o.domestic_model_number}:${o.storage_gb}`)
  );

  const results = {
    totalGroups: allGroups.length,
    existingFreshGroups: existingGroupKeys.size,
    targetGroups: 0,
    queried: 0,
    successfulMatches: 0,
    failedGroups: 0,
    failures: [],
    successfulList: [],
    offersToPersist: [],
  };

  for (let i = 0; i < allGroups.length; i++) {
    const g = allGroups[i];
    const groupKey = `${g.domestic_model_number}:${g.storage_gb}`;

    // Skip the 3 already existing fresh groups
    if (existingGroupKeys.has(groupKey)) {
      console.log(`[SKIP - EXISTING FRESH] ${g.model_name} ${g.domestic_model_number} ${g.storage_gb}GB`);
      continue;
    }

    results.targetGroups += 1;
    results.queried += 1;

    const storageToken = adapter.formatStorageToken(g.storage_gb);
    const koreanModel = getKoreanModelName(g.model_name);

    // Queries: domestic code first, then Korean model name
    const queries = [];
    if (g.domestic_model_number) {
      queries.push(`${g.domestic_model_number} ${storageToken} 자급제`);
    }
    queries.push(`${koreanModel} ${storageToken} 자급제`);
    if (g.brand === 'apple') {
      queries.push(`${g.model_name} ${storageToken} 자급제`);
    }

    const targetVariant = {
      variant_id: String(g.rep_variant_id),
      smartphone_id: String(g.smartphone_id),
      brand: g.brand,
      model_name: g.model_name,
      domestic_model_number: g.domestic_model_number,
      storage_gb: Number(g.storage_gb),
      ram_gb: g.resolved_ram_gb != null ? Number(g.resolved_ram_gb) : null,
      color: g.rep_color || '블랙',
      require_explicit_ram: Boolean(g.require_explicit_ram),
    };

    console.log(`[${i + 1}/${allGroups.length}] Searching: ${g.model_name} ${storageToken} (${g.domestic_model_number})`);

    let matchedOffer = null;
    let lastRejections = [];

    for (const q of queries) {
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
          model_name: g.model_name,
          domestic_model_number: g.domestic_model_number,
          storage_gb: g.storage_gb,
          ram_gb: g.resolved_ram_gb,
          amount_krw: refPrice.amount_krw,
          pcode: matchedOffer.item?.productCode,
          productName: matchedOffer.item?.productName,
          rep_variant_id: g.rep_variant_id,
        });

        results.offersToPersist.push({
          refPrice,
          variant: targetVariant,
        });

        console.log(`   --> [MATCH] ${refPrice.amount_krw.toLocaleString('ko-KR')}원 (pcode: ${matchedOffer.item?.productCode}) - ${matchedOffer.item?.productName}`);
      } else {
        results.failedGroups += 1;
        results.failures.push({
          group: `${g.model_name} ${g.domestic_model_number} ${g.storage_gb}GB`,
          reason: 'REF_PRICE_BUILD_FAILED',
        });
      }
    } else {
      results.failedGroups += 1;
      const primaryReason = lastRejections.length
        ? (lastRejections[0].reason || lastRejections[0].reasons?.join(',') || 'NO_MATCH')
        : 'NO_RESULTS';
      results.failures.push({
        group: `${g.model_name} ${g.domestic_model_number} ${g.storage_gb}GB`,
        reason: primaryReason,
        sampleTitle: lastRejections[0]?.productName || null,
      });
      console.log(`   --> [NO MATCH] ${primaryReason}`);
    }
  }

  console.log('\n=========================================');
  console.log('COLLECTION FINISHED. PERSISTING TO MYSQL...');
  console.log(`Matches to persist: ${results.offersToPersist.length}`);

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

  // Summary analysis
  const failureCategoryCounts = {};
  for (const f of results.failures) {
    const cat = f.reason.startsWith('NO_SEARCH_RESULTS') ? 'UNRELEASED_OR_NO_RESULTS'
      : f.reason.includes('CARRIER') ? 'CARRIER_CONTRACT_ONLY'
      : f.reason.includes('USED') ? 'USED_OR_REFURB_ONLY'
      : f.reason.includes('MODEL') ? 'MODEL_MISMATCH'
      : f.reason.includes('STORAGE') ? 'STORAGE_MISMATCH'
      : f.reason;
    failureCategoryCounts[cat] = (failureCategoryCounts[cat] || 0) + 1;
  }

  const finalSummary = {
    totalGroups: results.totalGroups,
    existingFreshGroups: results.existingFreshGroups,
    targetGroupsQueried: results.targetGroups,
    successfulQueries: results.successfulMatches,
    verifiedMatchesSaved: persistResult.insertedCount + persistResult.updatedPriceCount,
    failedGroupsCount: results.failedGroups,
    failureCategoryBreakdown: failureCategoryCounts,
    sampleSuccesses: results.successfulList.slice(0, 10),
    allSuccesses: results.successfulList,
    failures: results.failures,
  };

  fs.writeFileSync(
    path.resolve(__dirname, '../data/live-danawa-collection-report.json'),
    JSON.stringify(finalSummary, null, 2),
    'utf8'
  );

  console.log(JSON.stringify(finalSummary, null, 2));
  process.exit(0);
}

async function collectSelectedColors(modelCodes, apply) {
  if (!modelCodes.length || modelCodes.some(code => !/^(?:SM-[A-Z0-9]+|A[0-9]{4})$/.test(code))) {
    throw new Error('Pass one or more domestic model numbers after --colors');
  }
  const db = conn.getDatabase();
  try {
    const variants = await sync.loadExistingSmartphoneVariants(db, {
      domesticModelNumbers: modelCodes,
      limit: 1000,
    });
    const search = adapter.createDanawaSearchAdapter({ mode: 'live' });
    const colorSearch = {
      ...search,
      async searchVariant(...args) {
        await sleep(SLEEP_MS);
        return search.searchVariant(...args);
      },
    };
    const result = await sync.syncVariantPrices(db, {
      variants,
      adapter: colorSearch,
      options: {
        apply,
        allowDbWrite: apply,
        permissionRef: 'targeted-danawa-color-collection',
        persistReferencePrices: true,
        ttlHours: 24,
        searchOptions: { colorSpecific: true, exactOnly: true },
      },
    });
    console.log(JSON.stringify({
      persistence: result.persistence,
      exactMatches: result.variantReports.flatMap(({ variant, bestReferencePrice }) =>
        bestReferencePrice?.color_scope === 'exact_color'
          ? [{ variant, price: bestReferencePrice }]
          : []),
    }, null, 2));
  } finally {
    await conn.close();
  }
}

const args = process.argv.slice(2);
const collection = args[0] === '--colors'
  ? collectSelectedColors(args.slice(1).filter(arg => arg !== '--apply'), args.includes('--apply'))
  : collectAllLivePrices();
collection.catch(err => {
  console.error('Fatal collection error:', err);
  process.exit(1);
});
