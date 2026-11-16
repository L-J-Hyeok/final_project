'use strict';

const fs = require('node:fs');
const path = require('node:path');
const converter = require('../services/teammate-catalog-converter');
const matcher = require('../services/catalog-danawa-matcher');
const importer = require('../services/catalog-import');

const DEFAULT_TEAMMATE_JSON = '/Users/ijaehyeog/.gemini/antigravity/brain/c3c60e0f-79c7-4c89-936e-1202a86726b5/scratch/pc_final_upload/pc_final-main/backend/src/data/products.json';
const EXISTING_82_JSON = path.join(__dirname, '../data/common-catalog-verified-8-2.json');
const OUTPUT_CATALOG_JSON = path.join(__dirname, '../data/common-catalog-teammate-8-2-5.json');
const OUTPUT_REPORT_JSON = path.join(__dirname, '../data/common-catalog-teammate-report-8-2-5.json');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const teammateJsonPath = process.argv[2] || DEFAULT_TEAMMATE_JSON;
  const { searchDanawa } = await import('danawa-cli');

  const existing82 = JSON.parse(fs.readFileSync(EXISTING_82_JSON, 'utf8'));
  const conversion = converter.loadAndConvertTeammateFile(teammateJsonPath, EXISTING_82_JSON);

  const launchMap = conversion.launchPriceIndex;
  launchMap.set('apple:a3354:128', 529000);
  launchMap.set('apple:a3354:256', 679000);
  launchMap.set('apple:a3449:512', 1890000);
  launchMap.set('samsung:sm-l300', 349000);
  launchMap.set('samsung:sm-r530', 219000);
  launchMap.set('jbl:flip 7', 199000);

  const allEntries = [
    ...JSON.parse(JSON.stringify(existing82)),
    ...conversion.entries
  ];

  const now = new Date();
  const queryCache = new Map();
  const priceStats = {
    total_skus: 0,
    matched_skus: 0,
    unmatched_skus: 0,
    by_category: {},
    matched_details: [],
    unmatched_details: []
  };

  for (const entry of allEntries) {
    const { model, skus } = entry;
    const cat = model.category_code;
    if (!priceStats.by_category[cat]) {
      priceStats.by_category[cat] = { total_skus: 0, matched_skus: 0, unmatched_skus: 0 };
    }

    for (const skuItem of skus) {
      const { sku } = skuItem;
      priceStats.total_skus += 1;
      priceStats.by_category[cat].total_skus += 1;

      const bKey = model.brand.toLowerCase();
      const mKey = model.model_number.toLowerCase();
      const launchPriceKrw =
        launchMap.get(`${bKey}:${mKey}:${sku.sku_code}`) ||
        (sku.storage_gb ? launchMap.get(`${bKey}:${mKey}:${sku.storage_gb}`) : null) ||
        launchMap.get(`${bKey}:${mKey}`) ||
        null;

      const queries = matcher.buildCatalogSearchQueries(model, sku);
      let bestMatch = null;
      let lastReasons = [];

      for (const q of queries) {
        let items;
        if (queryCache.has(q)) {
          items = queryCache.get(q);
        } else {
          await sleep(100);
          try {
            const res = await searchDanawa({ query: q, limit: 10 });
            items = res && res.ok && Array.isArray(res.items) ? res.items : [];
          } catch (_) {
            items = [];
          }
          queryCache.set(q, items);
        }

        if (!items.length) {
          lastReasons.push(`NO_SEARCH_RESULTS:${q}`);
          continue;
        }

        const validMatches = [];
        for (const item of items) {
          const ev = matcher.matchDanawaItemToCatalogSku(item, model, sku, { launchPriceKrw });
          if (ev.matched) {
            validMatches.push(ev);
          } else {
            lastReasons.push(`${item.productName} -> [${ev.reasons.join(', ')}]`);
          }
        }

        if (validMatches.length > 0) {
          validMatches.sort((a, b) => a.minPrice - b.minPrice);
          bestMatch = validMatches[0];
          break;
        }
      }

      if (bestMatch) {
        const sale = matcher.buildSaleObservationForCatalog(bestMatch, model, sku, now);
        skuItem.prices = [sale];
        priceStats.matched_skus += 1;
        priceStats.by_category[cat].matched_skus += 1;
        priceStats.matched_details.push({
          category: cat,
          brand: model.brand,
          model_name: model.model_name,
          model_number: model.model_number,
          sku_code: sku.sku_code,
          storage_gb: sku.storage_gb,
          ram_gb: sku.ram_gb,
          connectivity: sku.connectivity,
          amount_minor: sale.amount_minor,
          product_url: sale.product_url,
          listing_title: sale.listing_title
        });
      } else {
        skuItem.prices = [];
        priceStats.unmatched_skus += 1;
        priceStats.by_category[cat].unmatched_skus += 1;
        priceStats.unmatched_details.push({
          category: cat,
          brand: model.brand,
          model_name: model.model_name,
          model_number: model.model_number,
          sku_code: sku.sku_code,
          storage_gb: sku.storage_gb,
          ram_gb: sku.ram_gb,
          connectivity: sku.connectivity,
          queries,
          reasons: lastReasons.slice(0, 5)
        });
      }
    }
  }

  const prepared = importer.prepare(allEntries, new Date(Date.now() + 5000));
  fs.writeFileSync(OUTPUT_CATALOG_JSON, JSON.stringify(allEntries, null, 2));
  fs.writeFileSync(OUTPUT_REPORT_JSON, JSON.stringify({
    generated_at: now.toISOString(),
    source_counts: conversion.sourceCounts,
    duplicates_with_existing_db: conversion.duplicates,
    excluded_items: conversion.excluded,
    validation_errors: conversion.validationErrors,
    new_models_count: conversion.entries.length,
    new_skus_count: conversion.entries.reduce((s, e) => s + e.skus.length, 0),
    total_common_catalog_models: prepared.length,
    total_common_catalog_skus: priceStats.total_skus,
    price_collection: priceStats
  }, null, 2));

  console.log(JSON.stringify({
    prepared_models: prepared.length,
    total_skus: priceStats.total_skus,
    matched_skus: priceStats.matched_skus,
    unmatched_skus: priceStats.unmatched_skus,
    by_category: priceStats.by_category
  }, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}

module.exports = { main };
