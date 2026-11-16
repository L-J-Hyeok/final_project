'use strict';

const fs = require('node:fs');
const { validateModel, validateSku } = require('./catalog-validation');
const importer = require('./catalog-import');

function parseCapacityGb(str) {
  if (!str || typeof str !== 'string') return null;
  const tb = str.match(/(\d+(?:\.\d+)?)\s*TB/i);
  if (tb) return Math.round(Number(tb[1]) * 1024);
  const gb = str.match(/(\d+(?:\.\d+)?)\s*GB/i);
  if (gb) {
    const val = Number(gb[1]);
    return Number.isInteger(val) && val > 0 ? val : null;
  }
  return null;
}

function isHeadphoneAudio(prod, specMap) {
  const name = String(prod.name || '');
  const slug = String(prod.slug || '');
  const modelNo = String(prod.baseModelNumber || '');
  const weightNum = specMap.weight?.numericValue;
  if (/헤드폰|Headphones|AirPods Max|Studio Pro|Momentum 4 Wireless|WH-|ULT WEAR/i.test(`${name} ${slug} ${modelNo}`)) {
    return true;
  }
  if (typeof weightNum === 'number' && weightNum >= 100) {
    return true;
  }
  return false;
}

function isWiredAudio(prod, specMap) {
  const conn = `${prod.variants?.[0]?.connectivity || ''} ${specMap.connectivity?.specValue || ''}`;
  if (!/bluetooth|무선|wireless/i.test(conn) && /유선|wired|3\.5mm/i.test(conn)) {
    return true;
  }
  return false;
}

function buildTabletSpecs(prod, specMap) {
  const specs = {};
  if (prod.releaseDate && /^\d{4}-(0[1-9]|1[0-2])/.test(prod.releaseDate)) {
    specs.release_month = prod.releaseDate.slice(0, 7);
  }
  if (specMap.processor?.specValue) specs.chipset = specMap.processor.specValue.trim().slice(0, 120);
  if (typeof specMap.display?.numericValue === 'number' && specMap.display.numericValue > 0 && specMap.display.numericValue <= 40) {
    specs.screen_inches = specMap.display.numericValue;
  }
  if (specMap.display?.specValue) {
    specs.display = specMap.display.specValue.trim().slice(0, 120);
  }
  const batText = specMap.battery?.specValue || '';
  const mahMatch = batText.match(/([\d,]+)\s*mAh/i);
  if (mahMatch) {
    const mah = Number(mahMatch[1].replace(/,/g, ''));
    if (Number.isInteger(mah) && mah > 0) specs.battery_mah = mah;
  }
  const whMatch = batText.match(/(\d+(?:\.\d+)?)\s*Wh/i);
  if (whMatch) {
    const wh = Number(whMatch[1]);
    if (wh > 0 && wh <= 1000) specs.battery_wh = wh;
  }
  const allText = `${specMap.connectivity?.specValue || ''} ${specMap.display?.specValue || ''}`;
  if (/펜\s*지원|S펜/i.test(allText)) {
    specs.pen_supported = true;
  }
  return specs;
}

function parseLaptopCpuGpuPorts(specMap) {
  const proc = (specMap.processor?.specValue || '').trim();
  const conn = (specMap.connectivity?.specValue || '').trim();
  let cpu = proc;
  let gpu = null;
  if (proc.includes('+')) {
    const parts = proc.split('+').map(s => s.trim());
    cpu = parts[0];
    gpu = parts.slice(1).join(' + ');
  } else if (/^Apple\s+M\d/i.test(proc)) {
    const gpuMatch = proc.match(/(\d+\s*코어\s*GPU)/i);
    const chipMatch = proc.match(/^(Apple\s+M\d+(?:\s+(?:Pro|Max|Ultra))?)/i);
    if (gpuMatch && chipMatch) {
      gpu = `${chipMatch[1]} (${gpuMatch[1]})`;
    }
  }
  const rawConnParts = conn ? conn.split(',').map(s => s.trim()).filter(Boolean) : [];
  const ports = [];
  for (const part of rawConnParts) {
    if (!gpu && /NVIDIA|RTX|GeForce|Radeon|Arc\s+Graphics/i.test(part)) {
      gpu = part;
    } else {
      ports.push(part);
    }
  }
  return { cpu, gpu, ports: [...new Set(ports)] };
}

function buildLaptopSpecs(prod, specMap) {
  const specs = {};
  if (prod.releaseDate && /^\d{4}-(0[1-9]|1[0-2])/.test(prod.releaseDate)) {
    specs.release_month = prod.releaseDate.slice(0, 7);
  }
  const { cpu, gpu, ports } = parseLaptopCpuGpuPorts(specMap);
  if (cpu) specs.cpu = cpu.slice(0, 120);
  if (gpu) specs.gpu = gpu.slice(0, 120);
  if (typeof specMap.display?.numericValue === 'number' && specMap.display.numericValue > 0 && specMap.display.numericValue <= 40) {
    specs.screen_inches = specMap.display.numericValue;
  }
  if (specMap.display?.specValue) specs.display = specMap.display.specValue.trim().slice(0, 120);
  if (typeof specMap.refresh_rate?.numericValue === 'number' && specMap.refresh_rate.numericValue > 0 && specMap.refresh_rate.numericValue <= 1000) {
    specs.refresh_hz = specMap.refresh_rate.numericValue;
  }
  if (typeof specMap.battery?.numericValue === 'number' && specMap.battery.numericValue > 0 && specMap.battery.numericValue <= 1000) {
    specs.battery_wh = specMap.battery.numericValue;
  }
  if (specMap.os?.specValue) specs.os = specMap.os.specValue.trim().slice(0, 120);
  if (ports.length > 0) specs.ports = ports.slice(0, 32);
  return { specs, cpu: specs.cpu || null, gpu: specs.gpu || null };
}

function buildSmartwatchSpecs(prod, specMap) {
  const specs = {};
  if (prod.releaseDate && /^\d{4}-(0[1-9]|1[0-2])/.test(prod.releaseDate)) {
    specs.release_month = prod.releaseDate.slice(0, 7);
  }
  const connText = `${specMap.connectivity?.specValue || ''} ${prod.variants?.[0]?.connectivity || ''}`;
  if (/gps/i.test(connText)) specs.gps = true;
  if (specMap.os?.specValue) {
    specs.compatible_os = [specMap.os.specValue.trim().slice(0, 120)];
  }
  const dispText = specMap.display?.specValue || '';
  const dispNum = specMap.display?.numericValue;
  if (typeof dispNum === 'number' && dispNum > 0 && dispNum <= 10) {
    specs.screen_inches = dispNum;
  } else {
    const inchMatch = dispText.match(/(\d+(?:\.\d+)?)\s*(?:인치|형)/);
    if (inchMatch && Number(inchMatch[1]) > 0 && Number(inchMatch[1]) <= 10) {
      specs.screen_inches = Number(inchMatch[1]);
    }
  }
  if (dispText) specs.display = dispText.trim().slice(0, 120);
  const batText = specMap.battery?.specValue || '';
  const mahMatch = batText.match(/([\d,]+)\s*mAh/i);
  if (mahMatch) {
    const mah = Number(mahMatch[1].replace(/,/g, ''));
    if (Number.isInteger(mah) && mah > 0) specs.battery_mah = mah;
  }
  return specs;
}

function buildEarbudsSpecs(prod, specMap) {
  const specs = {};
  if (prod.releaseDate && /^\d{4}-(0[1-9]|1[0-2])/.test(prod.releaseDate)) {
    specs.release_month = prod.releaseDate.slice(0, 7);
  }
  const fullText = `${prod.name} ${specMap.processor?.specValue || ''} ${specMap.battery?.specValue || ''} ${specMap.connectivity?.specValue || ''} ${specMap.os?.specValue || ''}`;
  if (prod.baseModelNumber === 'A3050') {
    specs.anc = false;
  } else if (/ANC|노이즈\s*캔슬링|Noise\s*Cancelling/i.test(fullText)) {
    specs.anc = true;
  }
  if (typeof specMap.battery?.numericValue === 'number' && specMap.battery.numericValue > 0 && specMap.battery.numericValue <= 1000) {
    specs.battery_hours = specMap.battery.numericValue;
  }
  if (specMap.battery?.specValue) {
    specs.battery_condition = specMap.battery.specValue.trim().slice(0, 120);
  }
  if (specMap.processor?.specValue) {
    specs.driver = specMap.processor.specValue.trim().slice(0, 120);
  }
  const btMatch = (`${prod.variants?.[0]?.connectivity || ''} ${specMap.connectivity?.specValue || ''}`).match(/Bluetooth\s*([0-9.]+)/i);
  if (btMatch) specs.bluetooth_version = btMatch[1];
  const ipMatch = fullText.match(/\b(IP[X0-9]{2})\b/i);
  if (ipMatch) specs.water_resistance = ipMatch[1].toUpperCase();
  if (/무선\s*(?:Qi\s*)?충전|MagSafe/i.test(fullText)) {
    specs.wireless_charging = true;
  }
  const codecTokens = ['aptX Lossless', 'aptX Adaptive', 'aptX HD', 'LDAC', 'SSC-UHQ', 'SSC Hi-Fi', 'SSC', 'LC3', 'AAC', 'SBC'];
  const foundCodecs = [];
  for (const c of codecTokens) {
    if (new RegExp(c.replace(/\s+/g, '\\s+'), 'i').test(fullText)) {
      foundCodecs.push(c);
    }
  }
  if (foundCodecs.length > 0) specs.codecs = [...new Set(foundCodecs)];
  return specs;
}

function convertTeammateProducts(rawProductsJson, existingEntries = []) {
  const existingByKey = new Map();
  for (const entry of existingEntries) {
    const k = `${entry.model.category_code}:${entry.model.brand.toLowerCase()}:${entry.model.model_number.toLowerCase()}`;
    existingByKey.set(k, entry);
  }

  const specsByProduct = new Map();
  for (const r of rawProductsJson.rawSpecs || []) {
    if (!specsByProduct.has(r.productId)) specsByProduct.set(r.productId, []);
    specsByProduct.get(r.productId).push(r);
  }

  const sourceCounts = {
    total_models: 0,
    total_skus: 0,
    by_original_category: {}
  };

  const entries = [];
  const duplicates = [];
  const excluded = [];
  const validationErrors = [];
  const launchPriceIndex = new Map();

  for (const prod of rawProductsJson.products || []) {
    const origCat = prod.category?.slug || 'unknown';
    const skuCount = Array.isArray(prod.variants) ? prod.variants.length : 0;
    sourceCounts.total_models += 1;
    sourceCounts.total_skus += skuCount;
    if (!sourceCounts.by_original_category[origCat]) {
      sourceCounts.by_original_category[origCat] = { models: 0, skus: 0 };
    }
    sourceCounts.by_original_category[origCat].models += 1;
    sourceCounts.by_original_category[origCat].skus += skuCount;

    const raw = specsByProduct.get(prod.id) || [];
    const specMap = Object.fromEntries(raw.filter(r => !r.variantId).map(r => [r.specKey, r]));

    if (origCat === 'smartphone') {
      excluded.push({
        reason: 'existing_smartphone_catalog_preserved',
        original_category: origCat,
        brand: prod.brand?.name || null,
        model_name: prod.name || null,
        model_number: prod.baseModelNumber || null,
        sku_count: skuCount
      });
      continue;
    }

    let categoryCode = origCat;
    if (origCat === 'audio') {
      if (isHeadphoneAudio(prod, specMap)) {
        excluded.push({
          reason: 'unsupported_audio_headphone',
          original_category: origCat,
          brand: prod.brand?.name || null,
          model_name: prod.name || null,
          model_number: prod.baseModelNumber || null,
          sku_count: skuCount
        });
        continue;
      }
      if (isWiredAudio(prod, specMap)) {
        excluded.push({
          reason: 'unsupported_audio_wired',
          original_category: origCat,
          brand: prod.brand?.name || null,
          model_name: prod.name || null,
          model_number: prod.baseModelNumber || null,
          sku_count: skuCount
        });
        continue;
      }
      categoryCode = 'earbuds';
    }

    if (!['tablet', 'laptop', 'smartwatch', 'earbuds', 'speaker'].includes(categoryCode)) {
      excluded.push({
        reason: 'unsupported_category',
        original_category: origCat,
        brand: prod.brand?.name || null,
        model_name: prod.name || null,
        model_number: prod.baseModelNumber || null,
        sku_count: skuCount
      });
      continue;
    }

    const brandName = String(prod.brand?.name || '').trim();
    const modelNumber = String(prod.baseModelNumber || '').trim();
    const key = `${categoryCode}:${brandName.toLowerCase()}:${modelNumber.toLowerCase()}`;

    if (prod.launchPriceKrw) {
      launchPriceIndex.set(`${brandName.toLowerCase()}:${modelNumber.toLowerCase()}`, Number(prod.launchPriceKrw));
    }
    for (const v of prod.variants || []) {
      if (v.launchPriceKrw) {
        const stGb = parseCapacityGb(v.storageCapacity);
        if (stGb) {
          launchPriceIndex.set(`${brandName.toLowerCase()}:${modelNumber.toLowerCase()}:${stGb}`, Number(v.launchPriceKrw));
        }
        launchPriceIndex.set(`${brandName.toLowerCase()}:${modelNumber.toLowerCase()}:${v.skuCode}`, Number(v.launchPriceKrw));
      }
    }

    if (existingByKey.has(key)) {
      const existingEntry = existingByKey.get(key);
      duplicates.push({
        category_code: categoryCode,
        brand: brandName,
        model_name: prod.name,
        model_number: modelNumber,
        existing_model_name: existingEntry.model.model_name,
        existing_sku_codes: existingEntry.skus.map(s => s.sku.sku_code),
        teammate_sku_codes: (prod.variants || []).map(v => v.skuCode),
        sku_count: skuCount,
        resolution: 'preserve_existing_model_and_skus'
      });
      continue;
    }

    const verifiedAtIso = new Date((prod.dataSource?.verifiedAt || '2026-11-12') + 'T00:00:00.000Z').toISOString();
    const sourceName = String(prod.dataSource?.name || `${brandName} 공식 사양`).trim();
    const sourceUrl = String(prod.dataSource?.sourceUrl || prod.dataSource?.baseUrl || '').trim();

    let specsJson = {};
    let laptopCpu = null;
    let laptopGpu = null;
    if (categoryCode === 'tablet') {
      specsJson = buildTabletSpecs(prod, specMap);
    } else if (categoryCode === 'laptop') {
      const res = buildLaptopSpecs(prod, specMap);
      specsJson = res.specs;
      laptopCpu = res.cpu;
      laptopGpu = res.gpu;
    } else if (categoryCode === 'smartwatch') {
      specsJson = buildSmartwatchSpecs(prod, specMap);
    } else if (categoryCode === 'earbuds') {
      specsJson = buildEarbudsSpecs(prod, specMap);
    }

    const weightNum = specMap.weight?.numericValue;
    const weightG = typeof weightNum === 'number' && weightNum > 0 ? weightNum : null;

    const model = {
      category_code: categoryCode,
      brand: brandName,
      model_name: String(prod.name || '').trim(),
      model_number: modelNumber,
      released_on: prod.releaseDate || null,
      weight_g: weightG,
      official_product_url: sourceUrl,
      specs_json: specsJson,
      publication_status: prod.verificationStatus === 'verified' && !prod.isTestData ? 'public' : 'private',
      verification_status: prod.verificationStatus === 'verified' ? 'verified' : 'pending',
      sale_status: 'unknown',
      source_name: sourceName,
      source_url: sourceUrl,
      verified_at: verifiedAtIso
    };

    const skus = (prod.variants || []).map(v => {
      let storageGb = null;
      let ramGb = null;
      let connectivity = null;
      let optionsJson = {};

      if (categoryCode === 'tablet') {
        storageGb = parseCapacityGb(v.storageCapacity) ?? (Number.isInteger(specMap.storage?.numericValue) ? specMap.storage.numericValue : null);
        ramGb = parseCapacityGb(v.ramCapacity) ?? ((prod.variants || []).length === 1 && Number.isInteger(specMap.memory?.numericValue) ? specMap.memory.numericValue : null);
        connectivity = /cellular|5g|lte|셀룰러/i.test(v.connectivity || '') ? 'cellular' : 'wifi';
      } else if (categoryCode === 'laptop') {
        storageGb = parseCapacityGb(v.storageCapacity) ?? (Number.isInteger(specMap.storage?.numericValue) ? specMap.storage.numericValue : null);
        ramGb = parseCapacityGb(v.ramCapacity) ?? (Number.isInteger(specMap.memory?.numericValue) ? specMap.memory.numericValue : null);
        connectivity = /cellular|5g|lte|셀룰러/i.test(v.connectivity || '') ? 'cellular' : 'wifi';
        optionsJson = {
          cpu: laptopCpu,
          ...(laptopGpu ? { gpu: laptopGpu } : {}),
          storage_type: 'SSD'
        };
      } else if (categoryCode === 'smartwatch') {
        storageGb = null;
        ramGb = null;
        if (/cellular|lte/i.test(v.connectivity || '')) connectivity = 'cellular';
        else if (/^gps$/i.test((v.connectivity || '').trim())) connectivity = 'gps';
        else connectivity = 'bluetooth';
        const sizeMatch = (`${prod.name} ${specMap.display?.specValue || ''}`).match(/(\d{2})\s*mm/i);
        optionsJson = {
          case_size_mm: sizeMatch ? Number(sizeMatch[1]) : 44
        };
      } else if (categoryCode === 'earbuds') {
        storageGb = null;
        ramGb = null;
        connectivity = 'bluetooth';
        optionsJson = {};
      }

      return {
        sku: {
          sku_code: String(v.skuCode || '').trim(),
          manufacturer_part_number: null,
          storage_gb: storageGb,
          ram_gb: ramGb,
          color: v.colorName ? String(v.colorName).trim() : null,
          connectivity,
          options_json: optionsJson,
          publication_status: model.publication_status,
          verification_status: model.verification_status,
          sale_status: 'unknown',
          source_name: sourceName,
          source_url: sourceUrl,
          verified_at: verifiedAtIso
        },
        prices: []
      };
    });

    try {
      validateModel(model);
      for (const item of skus) {
        validateSku({ ...item.sku, category_code: model.category_code });
      }
      entries.push({ model, skus });
    } catch (err) {
      validationErrors.push({
        category_code: categoryCode,
        brand: brandName,
        model_name: prod.name,
        model_number: modelNumber,
        error: err.message
      });
    }
  }

  // Validate full prepared batch
  if (entries.length > 0) {
    importer.prepare(entries);
  }

  return {
    sourceCounts,
    entries,
    duplicates,
    excluded,
    validationErrors,
    launchPriceIndex
  };
}

function loadAndConvertTeammateFile(teammateJsonPath, existingCatalogJsonPath) {
  const rawProductsJson = JSON.parse(fs.readFileSync(teammateJsonPath, 'utf8'));
  const existingEntries = existingCatalogJsonPath && fs.existsSync(existingCatalogJsonPath)
    ? JSON.parse(fs.readFileSync(existingCatalogJsonPath, 'utf8'))
    : [];
  return convertTeammateProducts(rawProductsJson, existingEntries);
}

module.exports = {
  parseCapacityGb,
  isHeadphoneAudio,
  isWiredAudio,
  convertTeammateProducts,
  loadAndConvertTeammateFile
};
