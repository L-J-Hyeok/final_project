'use strict';
const fs = require('node:fs/promises');
const { isIP } = require('node:net');
const { normalizeMeasurement } = require('./smartphone-performance');
const { chipsetKey, performanceDimensions } = require('./chipset-performance');
const { discoverEprelBattery } = require('./performance-discovery');

const GEEKBENCH_GRAPHICS_APIS = new Set(['metal', 'vulkan', 'opencl']);
const MAX_URLS = 8;
const MAX_AUTOMATIC_URLS = 3;
const MAX_RECORDS = 24;
const MAX_ACTIVE = 2;
const LOOKUP_TIMEOUT_MS = 12000;
const COOLDOWN_MS = 60000;
let active = 0;
let blockedUntil = 0;

const modelId = product => product.product_id ?? product.smartphone_id;

const fields = Object.freeze({
  cpu_single: 'cpu', cpu_multi: 'cpu', gpu: 'gpu', gaming_fps: 'sustained',
  sustained: 'sustained', camera_photo: 'camera_photo', camera_video: 'camera_video',
  battery_runtime: 'battery_runtime'
});

function approvedUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash ||
      isIP(url.hostname.replace(/^\[|\]$/g, '')) || !url.hostname.includes('.') ||
      /\.(localhost|local|internal|test)$/.test(url.hostname)) return null;
    return url.href;
  } catch (_) { return null; }
}

// The registry is server-side and curated. URLs do not come from request bodies or model output.
async function configuredSources(signal) {
  const file = process.env.PERFORMANCE_SOURCE_FILE;
  if (!file) return [];
  return JSON.parse(await fs.readFile(file, { encoding: 'utf8', signal }));
}

async function collectPerformance({ category, products, metrics, approvedSources, discoveredSources = [], readUrls, signal }) {
  const records = [];
  const urls = new Set();
  const keys = new Set();
  const inputs = [...approvedSources.map(source => ({ source, discovered: false })),
    ...discoveredSources.map(source => ({ source, discovered: true }))];
  for (const { source, discovered } of inputs) {
    if (!source || typeof source !== 'object') continue;
    if (source.category !== category || !metrics.includes(source.dimension) || !Object.hasOwn(fields, source.dimension) ||
      typeof source.rights_reference !== 'string' || !source.rights_reference.trim() ||
      source.allow_rank_use !== true || !approvedUrl(source.url) ||
      !['device_measured', 'chipset_reference'].includes(source.kind)) continue;
    if (source.kind === 'chipset_reference' && !['cpu_single', 'cpu_multi', 'gpu'].includes(source.dimension)) continue;
    const chipsetReference = source.kind === 'chipset_reference';
    const sourceChip = chipsetReference ? chipsetKey(source.chipset) : source.chipset;
    if (!sourceChip) continue;
    const targets = products.filter(product => product && modelId(product) != null &&
      (chipsetReference ? chipsetKey(product.chipset, product) === sourceChip :
        product.chipset === sourceChip && product.model_name === source.model &&
        product.domestic_model_number === source.domestic_model_number && Boolean(source.domestic_model_number)) &&
      (source.variant_id == null || String(product.variant_id) === String(source.variant_id)));
    if (!targets.length) continue;
    const graphicsApi = typeof source.graphics_api === 'string' ? source.graphics_api.trim().toLowerCase() : null;
    const geekbenchGraphics = source.dimension === 'gpu' && /\bgeekbench\b/i.test(source.method_name);
    if (geekbenchGraphics && !GEEKBENCH_GRAPHICS_APIS.has(graphicsApi)) continue;
    const url = approvedUrl(source.url);
    if (records.length === MAX_RECORDS || (!urls.has(url) && urls.size === MAX_URLS)) continue;
    const sourceUnit = discovered ? source.discovery?.unit : source.unit;
    const sourceValue = discovered ? source.discovery?.value : source.reviewed_value;
    const unitFactor = sourceUnit === source.unit ? 1 : sourceUnit === 'hours' && source.unit === 'minutes' ? 60 : null;
    if (typeof sourceValue !== 'number' || unitFactor == null) continue;
    const key = JSON.stringify([url, source.dimension, sourceChip,
      chipsetReference ? null : source.model, chipsetReference ? null : source.domestic_model_number, source.variant_id,
      source.kind, source.method_name, source.method_version, source.test_conditions, graphicsApi]);
    if (keys.has(key)) continue;
    try {
      const measurement = normalizeMeasurement({
        smartphone_id: String(modelId(targets[0])), metric: fields[source.dimension],
        method_name: source.method_name, method_version: source.method_version,
        test_conditions: source.test_conditions, device_settings: source.device_settings,
        source_name: source.source_name, source_url: url, measured_value: sourceValue * unitFactor,
        measured_on: source.measured_on, checked_on: source.checked_on, unit: source.unit
      }, new Date(), { allowUnknownMeasuredOn: discovered });
      urls.add(url);
      keys.add(key);
      records.push({ source, targets, measurement, sourceUnit, sourceValue, discovered, graphicsApi, id: String(records.length + 1) });
    } catch (error) {
      if (!error.code?.startsWith('INVALID_PERFORMANCE_')) throw error;
    }
  }
  if (!records.length) return { status: 'unavailable', measurements: [] };
  signal?.throwIfAborted();
  const result = await readUrls({ signal, sources: records.map(({ id, source, measurement, sourceUnit, discovered, graphicsApi }) => ({
    id, url: measurement.source_url, kind: source.kind, dimension: source.dimension, unit: sourceUnit,
    ...(discovered ? { verifyIdentity: true } : {
      model: source.model, domesticModelNumber: source.domestic_model_number, chipset: source.chipset
    }),
    ...(graphicsApi ? { graphics_api: graphicsApi } : {}),
    method: measurement.method_name, version: measurement.method_version, conditions: measurement.test_conditions
  })) });
  const context = result.urlContext || {};
  const fetched = new Set((context.urlMetadata || context.url_metadata || [])
    .filter(row => (row.urlRetrievalStatus || row.url_retrieval_status) === 'URL_RETRIEVAL_STATUS_SUCCESS')
    .map(row => approvedUrl(row.retrievedUrl || row.retrieved_url)).filter(Boolean));
  const outputs = Array.isArray(result.output) ? result.output : [];
  const measurements = records.flatMap(({ id, source, targets, measurement, sourceUnit, sourceValue, discovered, graphicsApi }) => {
    const matching = outputs.filter(row => row?.id === id);
    // Corroborate the extraction against the independently obtained value.
    if (matching.length !== 1 || approvedUrl(matching[0].url) !== measurement.source_url ||
      !fetched.has(measurement.source_url) || matching[0].value !== sourceValue) return [];
    if (graphicsApi && (typeof matching[0].graphics_api !== 'string' ||
      matching[0].graphics_api.trim().toLowerCase() !== graphicsApi)) return [];
    if (discovered) {
      const row = matching[0];
      const correctIdentity = source.kind === 'chipset_reference' ? chipsetKey(row.chipset) === chipsetKey(source.chipset) :
        (typeof row.model_number === 'string' &&
          row.model_number.trim().toUpperCase() === source.domestic_model_number.trim().toUpperCase());
      if (!correctIdentity || row.unit !== sourceUnit) return [];
    }
    const retrievedAt = new Date().toISOString();
    return [...new Set(targets.map(product => String(modelId(product))))].map(id => ({
      ...measurement, rights_reference: source.rights_reference, product_category: category, device_model: source.model ?? null,
      chipset: source.chipset, metric_type: source.dimension, benchmark_name: measurement.method_name,
      benchmark_version: measurement.method_version, measurement_scope: source.kind,
      product_id: id, smartphone_id: category === 'smartphone' ? id : undefined, variant_id: source.variant_id == null ? null : String(source.variant_id),
      verification_status: 'verified', dimension: source.dimension, evidence_kind: source.kind,
      ...(graphicsApi ? { graphics_api: graphicsApi } : {}),
      protocol_key: JSON.stringify([measurement.protocol_key, source.dimension, source.kind,
        ...(graphicsApi ? [graphicsApi] : [])]),
      retrieval_status: 'available', retrieved_at: retrievedAt
    }));
  });
  return { status: measurements.length ? 'available' : 'unavailable', measurements };
}

function requestedMetrics(conditions, profile) {
  const interests = new Set([
    ...(conditions?.hard?.usages?.length ? conditions.hard.usages : profile?.common?.usages || []),
    ...(conditions?.soft?.priorities || []), ...(conditions?.upgrade_context?.pain_points || [])
  ]);
  return [
    ...performanceDimensions(conditions, profile),
    ...(interests.has('camera') ? ['camera_photo', 'camera_video'] : []),
    ...(interests.has('battery') ? ['battery_runtime'] : [])
  ];
}

function limitDiscoveredSources(sources, priorityProduct, day = Math.floor(Date.now() / 86400000)) {
  const urls = [...new Set(sources.map(source => source.url))].sort();
  if (urls.length <= MAX_AUTOMATIC_URLS) return sources;
  const priority = priorityProduct && sources.find(source => source.model === priorityProduct.model_name &&
    source.domestic_model_number === priorityProduct.domestic_model_number)?.url;
  const pool = urls.filter(url => url !== priority);
  const capacity = MAX_AUTOMATIC_URLS - Number(Boolean(priority));
  const offset = day % pool.length;
  const selected = new Set([priority, ...[...pool.slice(offset), ...pool.slice(0, offset)].slice(0, capacity)]);
  return sources.filter(source => selected.has(source.url));
}

async function loadExternalPerformance({
  category, products, metrics = Object.keys(fields), readUrls, canReadUrls, authorize, priorityProduct,
  discover = discoverEprelBattery
}) {
  const empty = status => ({ status, measurements: [] });
  if (typeof readUrls !== 'function' || !products.length || !metrics.length) return empty('unavailable');
  if (Date.now() < blockedUntil) return { ...empty('rate_limited'), providerThrottled: true };
  if (active >= MAX_ACTIVE) return empty('rate_limited');
  active++;
  try {
    if (canReadUrls && !canReadUrls()) return empty('unavailable');
    if (authorize && !authorize()) return empty('rate_limited');
    const signal = AbortSignal.timeout(LOOKUP_TIMEOUT_MS);
    const [approved, discovered] = await Promise.allSettled([
      configuredSources(signal), discover({ category, products, metrics, signal })
    ]);
    return await collectPerformance({ category, products, metrics, signal, readUrls,
      approvedSources: approved.status === 'fulfilled' && Array.isArray(approved.value) ? approved.value : [],
      discoveredSources: discovered.status === 'fulfilled'
        ? limitDiscoveredSources(discovered.value, priorityProduct) : []
    });
  } catch (error) {
    if (error.code === 'RATE_LIMITED') {
      blockedUntil = Date.now() + COOLDOWN_MS;
      return { ...empty('rate_limited'), providerThrottled: true };
    }
    return empty('unavailable');
  } finally {
    active--;
  }
}
module.exports = { collectPerformance, loadExternalPerformance, requestedMetrics };
