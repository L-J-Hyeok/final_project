'use strict';
const { fail, id } = require('./smartphone-catalog');

const common = ['weight_g', 'reference_price'];
const fieldsByCategory = {
  smartphone: ['chipset', 'os', 'screen_inches', 'refresh_hz', 'storage_gb', 'ram_gb', 'battery_mah'],
  tablet: ['chipset', 'screen_inches', 'display', 'storage_gb', 'ram_gb', 'connectivity', 'pen_supported',
    'keyboard_supported', 'battery_wh', 'battery_mah'],
  laptop: ['cpu', 'gpu', 'ram_gb', 'storage_gb', 'storage_type', 'display', 'screen_inches', 'refresh_hz',
    'battery_wh', 'os', 'ports'],
  smartwatch: ['compatible_os', 'sensors', 'gps', 'case_size_mm', 'screen_inches', 'display', 'battery_mah',
    'water_resistance', 'connectivity'],
  earbuds: ['anc', 'driver', 'codecs', 'latency_ms', 'battery_hours', 'battery_condition', 'wireless_charging',
    'water_resistance', 'connectivity', 'bluetooth_version'],
  speaker: ['power_w', 'connectivity', 'audio_configuration', 'audio_formats', 'power_supply', 'battery_hours',
    'battery_condition', 'water_resistance', 'bluetooth_version', 'dimensions_mm']
};

function parseSelections(value) {
  if (typeof value !== 'string' || value.length > 128) throw fail();
  const pairs = value.split(',');
  if (pairs.length < 2 || pairs.length > 3 || new Set(pairs).size !== pairs.length) throw fail();
  return pairs.map(pair => {
    const parts = pair.split(':');
    if (parts.length !== 2) throw fail();
    return { modelId: id(parts[0]), skuId: id(parts[1]) };
  });
}

function compare(category, items) {
  const fields = [...fieldsByCategory[category], ...common].map(key => {
    const values = items.map(({ model, sku }) => {
      if (key === 'weight_g') return sku.options.weight_g ?? model.weight_g;
      return sku[key] ?? sku.options[key] ?? model.specifications[key] ?? null;
    });
    const highlight = ['storage_gb', 'ram_gb'].includes(key) && values.every(Number.isFinite) &&
      new Set(values).size > 1;
    return { key, values, has_unknown: values.includes(null),
      higher_sku_ids: highlight ? items.filter((_, index) => values[index] === Math.max(...values))
        .map(item => item.sku.sku_id) : [] };
  });
  // Raw comparisons avoid claiming quality from incomparable battery, camera or price measurements.
  return { category, items, fields };
}

module.exports = { parseSelections, compare };
