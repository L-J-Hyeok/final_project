'use strict';
const { createHash } = require('node:crypto');
const { Op } = require('sequelize');

const TABLE = 'smartphone_performance_measurements';
const metrics = {
  cpu: { score: 1e9 }, gpu: { score: 1e9, fps: 10000 },
  sustained: { score: 1e9, fps: 10000 },
  camera_photo: { score: 1e9 }, camera_video: { score: 1e9 },
  battery_runtime: { minutes: 10080 }
};
const fields = {
  method_name: 120, method_version: 80, test_conditions: 500, device_settings: 500,
  source_name: 120, source_url: 2048
};
const fail = code => { throw Object.assign(new Error(code), { code }); };
const digest = parts => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const protocolKey = row => digest([row.metric, row.unit, row.method_name, row.method_version,
  row.test_conditions, row.device_settings, row.source_name]);
const observationKey = row => digest([String(row.smartphone_id), row.variant_id == null ? null : String(row.variant_id),
  protocolKey(row), row.source_url, row.measured_on]);

function id(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,19}$/.test(value) ||
      BigInt(value) > 18446744073709551615n) fail('INVALID_PERFORMANCE_ID');
  return value;
}

function dateOnly(value, today) {
  const d = new Date(value);
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(+d) || d.toISOString().slice(0, 10) !== value || value > today || value < '1000-01-01') {
    fail('INVALID_PERFORMANCE_DATE');
  }
  return value;
}

function normalizeMeasurement(input, now = new Date(), { allowUnknownMeasuredOn = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_PERFORMANCE_FIELD');
  const row = {};
  for (const [field, max] of Object.entries(fields)) {
    const value = typeof input[field] === 'string' ? input[field].trim().normalize('NFC') : '';
    if (!value || [...value].length > max || /[\x00-\x1f\x7f]/.test(value)) fail('INVALID_PERFORMANCE_FIELD');
    row[field] = value;
  }
  const url = URL.canParse(row.source_url) ? new URL(row.source_url) : null;
  if (!url || url.protocol !== 'https:' || url.username || url.password) fail('INVALID_PERFORMANCE_SOURCE');
  url.hash = '';
  row.source_url = url.href;
  if (row.source_url.length > fields.source_url) fail('INVALID_PERFORMANCE_SOURCE');

  const { metric, unit, measured_value: value } = input;
  const limits = typeof metric === 'string' && Object.hasOwn(metrics, metric) ? metrics[metric] : {};
  const limit = typeof unit === 'string' && Object.hasOwn(limits, unit) ? limits[unit] : undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || !limit || value < 0.000001 ||
      value > limit || Number(value.toFixed(6)) !== value) fail('INVALID_PERFORMANCE_VALUE');
  Object.assign(row, { metric, unit, measured_value: value, smartphone_id: id(input.smartphone_id),
    variant_id: input.variant_id == null ? null : id(input.variant_id),
    verification_status: input.verification_status ?? 'pending' });
  if (!['pending', 'verified', 'rejected'].includes(row.verification_status)) fail('INVALID_PERFORMANCE_STATUS');
  const today = now.toISOString().slice(0, 10);
  row.measured_on = allowUnknownMeasuredOn && input.measured_on == null ? null : dateOnly(input.measured_on, today);
  row.checked_on = dateOnly(input.checked_on, today);
  if (row.measured_on && row.checked_on < row.measured_on) fail('INVALID_PERFORMANCE_DATE');
  row.protocol_key = protocolKey(row);
  row.observation_key = observationKey(row);
  return row;
}

// Internal import entry point. Only a trusted reviewer can submit a verified observation.
async function storeMeasurement(db, input, { reviewed = false, now } = {}) {
  const row = normalizeMeasurement(input, now);
  if (row.verification_status === 'verified' && reviewed !== true) fail('PERFORMANCE_REVIEW_REQUIRED');
  if (typeof input.domestic_model_number !== 'string' || !input.domestic_model_number.trim()) fail('PERFORMANCE_MODEL_MISMATCH');
  return db.transaction(async transaction => {
    const phone = await db.models.smartphones.findByPk(row.smartphone_id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!phone || (!phone.verified && row.verification_status === 'verified') ||
        phone.domestic_model_number?.toUpperCase() !== input.domestic_model_number.trim().toUpperCase()) fail('PERFORMANCE_MODEL_MISMATCH');
    if (row.variant_id) {
      const variant = await db.models.smartphone_variants.findByPk(row.variant_id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!variant || String(variant.smartphone_id) !== row.smartphone_id ||
          (!variant.verified && row.verification_status === 'verified')) fail('PERFORMANCE_VARIANT_MISMATCH');
    }
    return db.models[TABLE].create(row, { transaction });
  });
}

function measurementsFor(rows, product) {
  const byProtocol = new Map();
  for (const row of rows) {
    if (row.verification_status !== 'verified' || String(row.smartphone_id) !== String(product.smartphone_id) ||
        (row.variant_id != null && String(row.variant_id) !== String(product.variant_id))) continue;
    // The query is ordered by date and ID. An exact SKU result wins over a model-wide result.
    const previous = byProtocol.get(row.protocol_key);
    if (!previous || (previous.variant_id == null && row.variant_id != null)) byProtocol.set(row.protocol_key, row);
  }
  return [...byProtocol.values()];
}

async function loadVerified(db, products) {
  const model = db.models?.[TABLE];
  const ids = [...new Set(products.filter(product => product?.smartphone_id).map(product => String(product.smartphone_id)))];
  if (!ids.length || !model) return [];
  try {
    const rows = await model.findAll({
      where: { smartphone_id: { [Op.in]: ids }, verification_status: 'verified' }, raw: true,
      order: [['measured_on', 'DESC'], ['id', 'DESC']]
    });
    // Keep malformed or manually edited rows outside the evidence contract.
    return rows.filter(row => {
      try {
        const canonical = normalizeMeasurement({ ...row, smartphone_id: String(row.smartphone_id),
          variant_id: row.variant_id == null ? null : String(row.variant_id), measured_value: Number(row.measured_value) });
        return canonical.protocol_key === row.protocol_key && canonical.observation_key === row.observation_key;
      } catch (error) {
        if (!error.code?.startsWith('INVALID_PERFORMANCE_')) throw error;
        return false;
      }
    });
  } catch (error) {
    // Backward compatibility while this optional migration is pending.
    if (error.original?.code === 'ER_NO_SUCH_TABLE') return [];
    throw error;
  }
}

function compareMeasurements(rows, owned, candidate) {
  const left = measurementsFor(rows, owned);
  const right = measurementsFor(rows, candidate);
  const comparisons = right.flatMap(measurement => {
    const baseline = left.find(item => item.protocol_key === measurement.protocol_key);
    if (!baseline) return [];
    const current = Number(baseline.measured_value);
    const next = Number(measurement.measured_value);
    if (!Number.isFinite(current) || current <= 0 || !Number.isFinite(next) || next <= 0) return [];
    return [{ metric: measurement.metric, owned: baseline, candidate: measurement,
      delta: next - current, change_percent: Number((((next - current) / current) * 100).toFixed(2)) }];
  });
  const leftKeys = new Set(left.map(row => row.protocol_key));
  const rightKeys = new Set(right.map(row => row.protocol_key));
  return {
    status: comparisons.length ? 'comparable' : left.length && right.length ? 'different_protocol' : 'insufficient_data',
    comparisons,
    unmatched_owned: left.filter(row => !rightKeys.has(row.protocol_key)),
    unmatched_candidate: right.filter(row => !leftKeys.has(row.protocol_key))
  };
}

function summarizeMeasurements(rows, product) {
  const measurements = measurementsFor(rows, product);
  const available = accepted => measurements.some(row => accepted.includes(row.metric));
  return {
    game: available(['cpu', 'gpu', 'sustained']),
    camera: available(['camera_photo', 'camera_video']),
    battery: available(['battery_runtime']),
    measurements
  };
}

// A protocol affects ranking only when it covers every eligible configuration.
function comparableScores(rows, products, metrics) {
  if (new Set(products.map(product => String(product.smartphone_id))).size < 2 || !metrics.length || !rows.length) return new Map();
  const byVariant = products.map(product => measurementsFor(rows, product));
  const shared = byVariant[0].filter(row => metrics.includes(row.metric) &&
    byVariant.every(measurements => measurements.some(item => item.protocol_key === row.protocol_key)));
  const scores = new Map(products.map(product => [String(product.variant_id), []]));
  const dimension = row => row.dimension || row.metric;
  // Use at most one shared protocol per field so duplicate tests do not add weight.
  for (const field of new Set(shared.map(dimension))) {
    const protocol = shared.filter(row => dimension(row) === field)
      .sort((a, b) => Number(a.evidence_kind === 'chipset_reference') - Number(b.evidence_kind === 'chipset_reference') ||
        a.protocol_key.localeCompare(b.protocol_key))[0];
    if (!protocol) continue;
    const values = byVariant.map(measurements => Number(measurements.find(row => row.protocol_key === protocol.protocol_key).measured_value));
    if (values.some(value => !Number.isFinite(value) || value <= 0)) continue;
    const best = Math.max(...values);
    products.forEach((product, index) => scores.get(String(product.variant_id)).push(values[index] / best));
  }
  return new Map([...scores].filter(([, values]) => values.length)
    .map(([key, values]) => [key, values.reduce((sum, value) => sum + value, 0) / values.length]));
}

// A single partial protocol contributes relative adjustments, never a fabricated score
// for a device without a measurement. The mean is model-weighted, not SKU-weighted.
function partialScoreAdjustments(rows, products, metrics) {
  const modelCount = new Set(products.map(product => String(product.smartphone_id))).size;
  if (modelCount < 3 || !metrics.length || !rows.length) return new Map();
  const protocols = new Map();
  for (const product of products) {
    for (const row of measurementsFor(rows, product)) {
      const value = Number(row.measured_value);
      if (!metrics.includes(row.metric) || !Number.isFinite(value) || value <= 0) continue;
      const protocol = protocols.get(row.protocol_key) || { models: new Map(), kind: row.evidence_kind };
      const id = String(product.smartphone_id);
      const entries = protocol.models.get(id) || [];
      entries.push({ id: String(product.variant_id), value });
      protocol.models.set(id, entries);
      protocols.set(row.protocol_key, protocol);
    }
  }

  const selected = [...protocols.entries()].filter(([, protocol]) => protocol.models.size >= 2)
    .sort(([aKey, a], [bKey, b]) =>
      Number(a.kind === 'chipset_reference') - Number(b.kind === 'chipset_reference') ||
      b.models.size - a.models.size || aKey.localeCompare(bKey))[0]?.[1];
  if (!selected) return new Map();

  const cohorts = [...selected.models.values()];
  const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const best = Math.max(...cohorts.flatMap(entries => entries.map(entry => entry.value)));
  const modelAverage = average(cohorts.map(entries => average([...new Set(entries.map(entry => entry.value / best))])));
  const coverage = selected.models.size / modelCount;
  return new Map(cohorts.flatMap(entries => entries.map(({ id, value }) =>
    [id, coverage * (value / best - modelAverage)]).filter(([, delta]) => delta !== 0)));
}

module.exports = { TABLE, normalizeMeasurement, comparableScores, partialScoreAdjustments, storeMeasurement, loadVerified, compareMeasurements, summarizeMeasurements };
