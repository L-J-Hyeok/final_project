'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { collectPerformance, loadExternalPerformance } = require('../services/external-performance');

const source = {
  category: 'smartphone', kind: 'device_measured', dimension: 'cpu_single',
  model: 'Test Phone', domestic_model_number: 'TEST-KR', chipset: 'Test Chip',
  allow_rank_use: true, rights_reference: 'Synthetic test fixture',
  url: 'https://example.invalid/device-test', source_name: 'Synthetic Lab',
  method_name: 'Fixture', method_version: '1.0', test_conditions: 'Fixed load',
  device_settings: 'Default mode', measured_on: '2025-01-01', checked_on: '2025-01-02',
  unit: 'score', reviewed_value: 42
};
const target = { smartphone_id: '1', model_name: source.model,
  domestic_model_number: source.domestic_model_number, chipset: source.chipset };
const dimensions = ['cpu_single', 'cpu_multi', 'gpu', 'gaming_fps', 'sustained', 'camera_photo', 'camera_video', 'battery_runtime'];
const read = async ({ sources }) => ({
  output: sources.map(({ id, url }) => ({ id, url, value: 42 })),
  urlContext: { urlMetadata: [{ retrievedUrl: source.url, urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS' }] }
});
test('URL retrieval, reviewed value and exact identity are mandatory in every measurement family', async () => {
  const input = { category: 'smartphone', products: [target], metrics: dimensions,
    approvedSources: dimensions.map(dimension => ({ ...source, dimension,
      unit: dimension === 'battery_runtime' ? 'minutes' : dimension === 'gaming_fps' ? 'fps' : 'score' })),
    readUrls: read };
  const results = await collectPerformance(input);
  assert.deepEqual(results.measurements.map(row => row.dimension), dimensions);
  const badTargets = [{ ...target, domestic_model_number: 'WRONG' }];
  for (const overrides of [
    { products: badTargets },
    { approvedSources: [{ ...source, allow_rank_use: false }] },
    { approvedSources: [{ ...source, kind: 'chipset_reference', dimension: 'battery_runtime' }] },
    { readUrls: async () => ({ output: [{ id: '1', url: source.url, value: 42 }] }) },
    { readUrls: async request => ({ ...await read(request), output: [{ id: '1', url: source.url, value: 43 }] }) }
  ]) assert.deepEqual((await collectPerformance({ ...input, ...overrides })).measurements, []);
  assert.equal((await loadExternalPerformance({ category: 'smartphone', products: [target] })).status, 'unavailable');
});

test('Gemini REST sends only URL Context and retains per-URL retrieval metadata', async t => {
  const adapter = require('../services/ai-adapter').createAiAdapter();
  const metadata = { urlMetadata: [{ retrievedUrl: source.url, urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS' }] };
  t.mock.method(globalThis, 'fetch', async (_url, request) => {
    const payload = JSON.parse(request.body);
    assert.deepEqual(payload.tools, [{ url_context: {} }]);
    assert.equal(payload.generationConfig.responseSchema, undefined);
    return new Response(JSON.stringify({ candidates: [{ urlContextMetadata: metadata,
      content: { parts: [{ text: '[{"id":"1","url":"https://example.invalid/device-test","value":42}]' }] } }] }));
  });
  const response = await adapter.readPerformanceUrls({ sources: [{ id: '1', url: source.url }] },
    { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'fixture-api-key' });
  assert.deepEqual(response.urlContext, metadata);
  assert.equal(response.output[0].value, 42);
});

test('discovers a public battery fiche without a configured score and validates exact identity and original units', async () => {
  const { discoverEprelBattery } = require('../services/performance-discovery');
  const phone = { ...target, brand: 'Apple', model_name: 'iPhone 16', domestic_model_number: 'A3287' };
  let fetches = 0;
  const feed = { license: 'https://creativecommons.org/licenses/by/4.0/', phones: [{
    brand: phone.brand, model: phone.model_name, eprel_registration: '123',
    eprel_url: 'https://eprel.ec.europa.eu/screen/product/smartphonestablets20231669/123',
    eu_battery_endurance_hours: 37, eu_retrieved: '2025-10-01'
  }] };
  let outputIdentity = 'A3287';
  let hours = 37;
  const request = {
    category: 'smartphone', products: [phone, { ...phone, variant_id: '1234' }], metrics: ['battery_runtime'],
    discover: options => discoverEprelBattery({ ...options,
      fetchImpl: async (url, config) => {
        fetches++;
        assert.equal(url, 'https://fixindex.eu/data/fixindex-phones.json');
        assert.equal(config.redirect, 'error');
        assert.ok(config.signal instanceof AbortSignal);
        return Response.json(feed);
      }
    }),
    readUrls: async ({ sources, signal }) => {
      assert.ok(signal instanceof AbortSignal);
      assert.equal(sources.length, 1);
      const [fiche] = sources;
      assert.equal(fiche.url, 'https://eprel.ec.europa.eu/fiches/smartphonestablets20231669/Fiche_123_EN.pdf');
      assert.equal(fiche.verifyIdentity, true);
      assert.ok(!('domesticModelNumber' in fiche));
      return { output: [{ id: fiche.id, url: fiche.url, value: hours, model_number: outputIdentity,
        unit: 'hours' }],
      urlContext: { urlMetadata: [{ retrievedUrl: fiche.url, urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS' }] } };
    }
  };
  const result = await loadExternalPerformance(request);
  assert.equal(result.status, 'available');
  assert.equal(fetches, 1);
  assert.equal(result.measurements.length, 1);
  assert.equal(result.measurements[0].measured_value, 2220);
  assert.equal(result.measurements[0].measured_on, null);
  outputIdentity = 'A3081';
  assert.equal((await loadExternalPerformance(request)).status, 'unavailable');
  outputIdentity = 'A3287';
  hours = 38;
  assert.equal((await loadExternalPerformance(request)).status, 'unavailable');
});

test('skips irrelevant discovery and falls back on denied or unavailable lookups', async () => {
  const { requestedMetrics } = require('../services/external-performance');
  assert.deepEqual(requestedMetrics({ upgrade_context: { pain_points: ['battery'] } }), ['battery_runtime']);
  assert.deepEqual(requestedMetrics({ soft: { priorities: ['portability'] } }), []);
  const request = { category: 'smartphone', products: [target],
    discover: async () => { throw new Error('feed unavailable'); },
    readUrls: async () => assert.fail('No eligible URLs should be read') };
  assert.equal((await loadExternalPerformance({ ...request, authorize: () => false })).status, 'rate_limited');
  assert.equal((await loadExternalPerformance(request)).status, 'unavailable');
});

test('shares a CPU reference across matching chipsets with one lookup and prefers a comparable device test', async () => {
  const { comparableScores } = require('../services/smartphone-performance');
  const peer = { ...target, smartphone_id: '2', variant_id: '22', domestic_model_number: 'PEER-KR' };
  const first = { ...target, variant_id: '11' };
  let requests = 0;
  const { measurements } = await collectPerformance({ category: 'smartphone', products: [first, peer],
    metrics: ['cpu_single'], approvedSources: [{ ...source, kind: 'chipset_reference' }],
    readUrls: async request => {
      requests += request.sources.length;
      return read(request);
    }
  });
  assert.equal(requests, 1);
  assert.equal(measurements.length, 2);
  const deviceOnly = measurements.map((row, index) => ({ ...row,
    protocol_key: 'shared-device-protocol', evidence_kind: 'device_measured', measured_value: index ? 84 : 42 }));
  const scores = comparableScores([...measurements, ...deviceOnly], [first, peer], ['cpu']);
  assert.equal(scores.get('11'), 0.5);
  assert.equal(scores.get('22'), 1);
});

test('bounds automatic URL reads and keeps the owned device in the batch', async () => {
  const products = Array.from({ length: 6 }, (_, i) => ({
    ...target, smartphone_id: String(i + 1), model_name: 'Model ' + i, domestic_model_number: 'KR' + i
  }));
  const vendor = products.map(product => ({
    ...source, model: product.model_name, domestic_model_number: product.domestic_model_number,
    url: 'https://example.invalid/' + product.domestic_model_number, discovery: { value: 42, unit: 'score' }
  }));
  let called = false;
  await loadExternalPerformance({ category: 'smartphone', products, priorityProduct: products.at(-1),
    discover: async () => vendor,
    readUrls: async ({ sources }) => {
      called = sources.length === 3 && sources.some(row => row.url === vendor.at(-1).url);
      return { output: [] };
    }
  });
  assert.equal(called, true);
});

test('stops additional source calls during the Gemini 429 cooldown', async () => {
  const input = { category: 'smartphone', products: [target],
    discover: async () => [{ ...source, discovery: { value: 42, unit: 'score' } }],
    readUrls: async () => { throw Object.assign(new Error('rate limited'), { code: 'RATE_LIMITED' }); } };
  assert.equal((await loadExternalPerformance(input)).status, 'rate_limited');
  assert.equal((await loadExternalPerformance({ ...input,
    discover: async () => assert.fail('Cooldown must precede network access')
  })).status, 'rate_limited');
});

test('canonical chipset references deduplicate aliases and preserve GPU variants and Samsung model identity', async () => {
  const { chipsetKey } = require('../services/chipset-performance');
  const iphone15 = { ...target, chipset: 'Apple A16 Bionic (6코어 CPU, 5코어 GPU, 16코어 Neural Engine)' };
  const iphone15Plus = { ...target, smartphone_id: '2', chipset: 'Apple A16 Bionic (6코어 CPU, 5코어 GPU)' };
  const approvedSources = [
    { ...source, kind: 'chipset_reference', chipset: 'Apple A16 Bionic' },
    { ...source, kind: 'chipset_reference', chipset: iphone15Plus.chipset }
  ];
  const result = await collectPerformance({ category: 'smartphone', products: [iphone15, iphone15Plus, target],
    metrics: ['cpu_single'], approvedSources, readUrls: async request => {
      assert.equal(request.sources.length, 1);
      return read(request);
    }
  });
  assert.deepEqual(result.measurements.map(row => row.smartphone_id), ['1', '2']);
  assert.equal(chipsetKey('Apple A18'), null);
  assert.notEqual(chipsetKey('Apple A18', { domestic_model_number: 'A3409' }),
    chipsetKey('Apple A18', { domestic_model_number: 'A3287' }));
  assert.equal(chipsetKey('Apple A19'), null);
  assert.notEqual(chipsetKey('Apple A19', { domestic_model_number: 'A3634' }),
    chipsetKey('Apple A19', { domestic_model_number: 'A3520' }));
  const legacy = 'Samsung Exynos 2400e (10코어)';
  assert.equal(chipsetKey(legacy, { domestic_model_number: 'SM-S731N', model_name: 'Galaxy S25 FE' }), 'exynos 2400');
  assert.equal(chipsetKey(legacy, { domestic_model_number: 'SM-S721N', model_name: 'Galaxy S24 FE' }), 'exynos 2400e');
  assert.notEqual(chipsetKey('Snapdragon 8 Elite Gen 5 for Galaxy'), chipsetKey('Snapdragon 8 Elite Gen 5'));
});

test('Geekbench GPU evidence requires the reported compute API and separates cross-API protocols', async () => {
  const candidate = { ...target, smartphone_id: '2', model_name: 'Peer Phone', domestic_model_number: 'PEER-KR' };
  const gpu = { ...source, dimension: 'gpu', method_name: 'Geekbench GPU' };
  const run = graphicsApi => collectPerformance({ category: 'smartphone', products: [target, candidate], metrics: ['gpu'],
    approvedSources: [{ ...gpu, graphics_api: graphicsApi }, { ...gpu, model: candidate.model_name,
      domestic_model_number: candidate.domestic_model_number, graphics_api: 'Vulkan' }],
    readUrls: async request => ({ ...await read(request), output: request.sources.map(({ id, url, graphics_api }) =>
      ({ id, url, value: 42, graphics_api: graphics_api === 'opencl' ? 'wrong' : graphics_api })) })
  });
  assert.deepEqual((await run(undefined)).measurements.map(row => row.smartphone_id), ['2']);
  assert.deepEqual((await run('OpenCL')).measurements.map(row => row.smartphone_id), ['2']);
  const records = (await run('Metal')).measurements;
  assert.deepEqual(records.map(row => row.graphics_api), ['metal', 'vulkan']);
  assert.notEqual(records[0].protocol_key, records[1].protocol_key);
});

test('Gemini deadline stays active until the response body is consumed', async t => {
  const adapter = require('../services/ai-adapter').createAiAdapter({ timeoutMs: 20 });
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => ({
    ok: true, status: 200,
    json: () => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    })
  }));
  await assert.rejects(adapter.readPerformanceUrls({ sources: [{ id: '1', url: source.url }] },
    { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'fixture-api-key' }), { code: 'AI_TIMEOUT' });
});
