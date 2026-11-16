'use strict';
const { createHash } = require('node:crypto');

const categories = Object.freeze({
  smartphone: '스마트폰', tablet: '태블릿', laptop: '노트북',
  smartwatch: '스마트워치', earbuds: '무선이어폰', speaker: '스피커'
});
const textMax = max => value => typeof value === 'string' && value === value.trim() && value.length > 0 &&
  value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
const text = textMax(120);
const dateOnly = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value) &&
  Number.isFinite(Date.parse(value + 'T00:00:00Z'));
const positive = max => value => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= max;
const capacity = value => Number.isInteger(value) && positive(1048576)(value);
const bool = value => typeof value === 'boolean';
const strings = value => Array.isArray(value) && value.length > 0 && value.length <= 32 &&
  value.every(text) && new Set(value).size === value.length;

const releaseMonth = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const specs = {
  smartphone: { chipset: text, screen_inches: positive(30), camera: text, battery_mah: capacity },
  tablet: { chipset: text, screen_inches: positive(40), pen_supported: bool, keyboard_supported: bool, battery_mah: capacity, battery_wh: positive(1000), display: text },
  laptop: { cpu: text, gpu: text, screen_inches: positive(40), battery_wh: positive(1000), display: text, refresh_hz: positive(1000), os: text, ports: strings },
  smartwatch: { sensors: strings, gps: bool, battery_mah: capacity, water_resistance: text, compatible_os: strings, screen_inches: positive(10), display: text },
  earbuds: { anc: bool, codecs: strings, latency_ms: positive(10000), battery_hours: positive(1000), battery_condition: text, driver: text, wireless_charging: bool, water_resistance: text, bluetooth_version: text },
  speaker: { power_w: positive(100000), audio_formats: strings, power_supply: text, bluetooth_version: text,
    battery_hours: positive(1000), battery_condition: text, water_resistance: text,
    dimensions_mm: value => Array.isArray(value) && value.length === 3 && value.every(positive(10000)) }
};
const options = {
  smartphone: {}, tablet: { weight_g: positive(10000) }, laptop: { cpu: text, gpu: text, display: text, storage_type: text },
  smartwatch: { case_size_mm: positive(150), band: text, case_material: text }, earbuds: {},
  speaker: { audio_configuration: text }
};
const connections = {
  smartphone: ['cellular'], tablet: ['wifi', 'cellular'],
  laptop: ['wifi', 'cellular'], smartwatch: ['gps', 'cellular', 'bluetooth'],
  earbuds: ['bluetooth', 'wired', 'wireless_dongle'],
  speaker: ['wired', 'bluetooth', 'wifi', 'multi']
};
const requirements = {
  smartphone: ['storage_gb'], tablet: ['storage_gb', 'connectivity'],
  laptop: ['storage_gb', 'ram_gb', 'cpu'], smartwatch: ['case_size_mm', 'connectivity'],
  earbuds: [], speaker: []
};
const groupRequirements = {
  smartphone: ['storage_gb', 'ram_gb'], tablet: ['storage_gb', 'ram_gb', 'connectivity'],
  laptop: ['storage_gb', 'ram_gb', 'cpu', 'gpu', 'display', 'storage_type'],
  smartwatch: ['case_size_mm', 'connectivity', 'band', 'case_material'],
  earbuds: ['connectivity'], speaker: ['connectivity', 'audio_configuration']
};

function invalid(field, detail = null) {
  const err = Object.assign(new Error('Invalid catalog ' + field), { code: 'INVALID_INPUT' });
  if (detail) err.detail = detail;
  throw err;
}
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
function fields(value, schema) {
  if (!isObject(value) || Object.entries(value).some(([key, item]) =>
    !Object.hasOwn(schema, key) || (item !== null && !schema[key](item)))) invalid('specifications');
}
function https(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\x00-\x20\x7f]/.test(value)) invalid('URL');
  const url = URL.canParse(value) && new URL(value);
  if (!url || url.protocol !== 'https:' || url.username || url.password) invalid('URL');
}

function approve(row) {
  if (!text(row.source_name)) invalid('source name');
  https(row.source_url);
  if (row.publication_status === 'public' && (row.verification_status !== 'verified' ||
      row.verified_at == null || !Number.isFinite(+new Date(row.verified_at)))) invalid('publication');
}
function validateModel(row) {
  if (!Object.hasOwn(categories, row.category_code) || row.category_code === 'smartphone') invalid('category', `Unsupported category_code: ${row.category_code}`);
  if (!textMax(80)(row.brand) || !text(row.model_name) || !textMax(80)(row.model_number)) invalid('model identity', `Invalid brand/model_name/model_number for ${row.model_name || '(unknown)'}`);
  if (row.released_on != null && !dateOnly(row.released_on)) invalid('released_on', `Invalid released_on date format (expected YYYY-MM-DD): ${row.released_on}`);
  if (row.weight_g != null && !positive(1000000)(row.weight_g)) invalid('weight_g', `Invalid weight_g (expected 0 < weight_g <= 1000000): ${row.weight_g}`);
  fields(row.specs_json, { ...specs[row.category_code], release_month: releaseMonth });
  if (row.official_product_url != null) https(row.official_product_url);
  approve(row);
}
function validateSkuFields(category, row) {
  if (!Object.hasOwn(options, category)) invalid('category');
  fields(row.options_json, options[category]);
  if (['smartwatch', 'earbuds', 'speaker'].includes(category) && (row.storage_gb != null || row.ram_gb != null)) invalid('memory');
  for (const key of ['storage_gb', 'ram_gb']) if (row[key] != null && !capacity(row[key])) invalid(key);
  if (row.connectivity != null && !connections[category].includes(row.connectivity)) invalid('connectivity');
  return { ...row.options_json, storage_gb: row.storage_gb, ram_gb: row.ram_gb, connectivity: row.connectivity };
}
function requireFields(config, required) {
  if (required.some(key => config[key] == null)) invalid('required options');
}
function configurationKey(category, row) {
  const data = validateSkuFields(category, row);
  const required = groupRequirements[category];
  requireFields(data, required);
  // Null and omitted are both unconfirmed. Every known non-color option participates.
  const entries = Object.entries(data).filter(([, value]) => value != null).sort(([a], [b]) => a.localeCompare(b, 'en'));
  return createHash('sha256').update(JSON.stringify([category, entries])).digest('hex');
}
function validateSku(row) {
  if (!textMax(100)(row.sku_code) || (row.manufacturer_part_number != null && !textMax(100)(row.manufacturer_part_number)) ||
      (row.color != null && !textMax(80)(row.color))) invalid('SKU identity', `Invalid sku_code/part_number/color for ${row.sku_code || '(unknown)'}`);
  approve(row);
  const data = validateSkuFields(row.category_code, row);
  if (row.publication_status === 'public') requireFields(data, requirements[row.category_code]);
  return row.price_group_id == null ? null : configurationKey(row.category_code, row);
}
function validateGroup(row) {
  https(row.evidence_url);
  if (!isObject(row.configuration_json) || Object.keys(row.configuration_json).some(key =>
    !['storage_gb', 'ram_gb', 'connectivity', 'options_json'].includes(key))) invalid('price configuration');
  return configurationKey(row.category_code, row.configuration_json);
}
function validatePrice(row) {
  if (row.sku_id != null && row.price_group_id != null) invalid('price target');
  if (!text(row.seller_name)) invalid('seller');
  https(row.product_url);
  if (typeof row.currency !== 'string' || !/^[A-Z]{3}$/.test(row.currency)) invalid('currency');
  const amount = typeof row.amount_minor === 'number' && !Number.isSafeInteger(row.amount_minor) ? '' : String(row.amount_minor);
  if (!/^[1-9]\d{0,19}$/.test(amount) || BigInt(amount) > 18446744073709551615n) invalid('price');
  const observed = +new Date(row.observed_at), checked = +new Date(row.checked_at);
  if (row.observed_at == null || row.checked_at == null || !Number.isFinite(observed) ||
      !Number.isFinite(checked) || observed > checked) invalid('price timestamps');
}

module.exports = { categories, specs, options, validateModel, validateSku, validateGroup, validatePrice };
