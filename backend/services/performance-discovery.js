'use strict';

const FIXINDEX_DATA = 'https://fixindex.eu/data/fixindex-phones.json';
const FIXINDEX_LICENSE = 'https://fixindex.eu/data/';
const EPREL_ORIGIN = 'https://eprel.ec.europa.eu';
const EPREL_GROUP = 'smartphonestablets20231669';
const MAX_FEED_BYTES = 1024 * 1024;

function identity(value) {
  return typeof value === 'string' ? value.trim().normalize('NFKC').toLowerCase() : '';
}

async function readFixIndexFeed(fetchImpl, signal) {
  const response = await fetchImpl(FIXINDEX_DATA, { redirect: 'error', signal });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    await response.body?.cancel();
    return null;
  }
  let length = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    length += chunk.byteLength;
    if (length > MAX_FEED_BYTES) return null;
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// Discover the provider's documented files by matching catalog names, then let the
// original fiche prove the regulatory model number. Marketing names are discovery hints.
async function discoverEprelBattery({ category, products, metrics, fetchImpl = globalThis.fetch, signal }) {
  if (category !== 'smartphone' || !metrics.includes('battery_runtime') ||
      !products.some(product => product.brand && product.model_name && product.domestic_model_number && product.chipset)) return [];
  const feed = await readFixIndexFeed(fetchImpl, signal);
  if (feed?.license !== 'https://creativecommons.org/licenses/by/4.0/' || !Array.isArray(feed.phones)) return [];

  const productsByIdentity = new Map(products.map(product => [
    JSON.stringify([identity(product.brand), identity(product.model_name),
      identity(product.domestic_model_number), product.chipset]), product
  ]));
  return [...productsByIdentity.values()].flatMap(product => {
    if (!product.domestic_model_number || !product.chipset) return [];
    const matches = feed.phones.filter(row => identity(row?.brand) === identity(product.brand) &&
      identity(row?.model) === identity(product.model_name));
    if (matches.length !== 1) return [];
    const row = matches[0];
    const registration = String(row.eprel_registration);
    if (!/^[1-9]\d{0,11}$/.test(registration) ||
        row.eprel_url !== `${EPREL_ORIGIN}/screen/product/${EPREL_GROUP}/${registration}` ||
        !Number.isInteger(row.eu_battery_endurance_hours)) return [];
    return [{
      category, dimension: 'battery_runtime', kind: 'device_measured', model: product.model_name,
      domestic_model_number: product.domestic_model_number, chipset: product.chipset,
      source_name: 'EPREL, European Commission · FixIndex.eu (CC BY 4.0, hours converted to minutes)',
      url: `${EPREL_ORIGIN}/fiches/${EPREL_GROUP}/Fiche_${registration}_EN.pdf`,
      rights_reference: FIXINDEX_LICENSE, allow_rank_use: true,
      method_name: 'EPREL battery endurance per cycle', method_version: 'EU 2023/1669',
      test_conditions: 'Battery endurance per cycle (ENDdevice), whole hours as printed in the product information sheet',
      device_settings: 'Settings prescribed by the EU test method',
      checked_on: row.eu_retrieved, unit: 'minutes',
      discovery: { value: row.eu_battery_endurance_hours, unit: 'hours' }
    }];
  });
}

module.exports = { discoverEprelBattery };
