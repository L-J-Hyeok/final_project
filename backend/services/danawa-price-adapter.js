'use strict';

/**
 * Danawa CLI search adapter (Mock + Dry-run + policy-gated).
 *
 * Inspected target CLI: https://github.com/tellang/danawa-cli (v3.0.0, MIT, ESM, zero deps, Node >= 20).
 * Live requests to prod.danawa.com are blocked by default because prod.danawa.com/robots.txt disallows /api/
 * and Danawa Terms of Use / danawa-cli disclaimers prohibit unauthorized automated collection or monitoring services.
 */

const DANAWA_SEARCH_ENDPOINT = 'https://prod.danawa.com/api/vssearch/searchProducts.php';
const DANAWA_SEARCH_REFERER = 'https://search.danawa.com/dsearch.php';
const DANAWA_INFO_BASE_URL = 'https://prod.danawa.com/info/?pcode=';
const MAX_QUERY_LENGTH = 128;

const DANAWA_CLI_COMPATIBILITY = Object.freeze({
  packageName: 'danawa-cli',
  versionChecked: '3.0.0',
  repositoryUrl: 'https://github.com/tellang/danawa-cli',
  license: 'MIT',
  moduleFormat: 'esm',
  minNodeVersion: '20.0.0',
  zeroDependencies: true,
  backendModuleFormat: 'commonjs',
  integrationNote: 'Backend is CommonJS; programmatic use requires dynamic import() or subprocess/HTTP serve once authorized.',
  cliCommands: Object.freeze(['search', 'batch', 'schema', 'serve']),
  supportedFormats: Object.freeze(['table', 'json', 'jsonl', 'csv']),
  searchEndpoint: DANAWA_SEARCH_ENDPOINT,
  outputFields: Object.freeze([
    'productCode',
    'productName',
    'imageUrl',
    'category',
    'minPrice',
    'reviewCount',
    'starPoint',
    'mallName',
    'maker',
  ]),
  missingPriceObservationFields: Object.freeze([
    'shipping_krw',
    'source_url (direct seller URL)',
    'in_stock',
    'is_new',
    'is_unlocked',
    'unconditional',
    'conditions_text',
    'observed_at',
    'expires_at',
  ]),
});

const AUTOMATION_POLICY = Object.freeze({
  liveCollectionAllowedByDefault: false,
  robotsRules: Object.freeze({
    'prod.danawa.com': Object.freeze(['Disallow: /api/', 'Disallow: /bridge/', 'Disallow: /list/ajax/', 'Disallow: /info/ajax/']),
    'search.danawa.com': Object.freeze(['Crawl-delay: 10', 'Disallow: /api_ui/', 'Disallow: /globalData/', 'Disallow: /snippets/']),
  }),
  robotsDisallowPaths: Object.freeze(['/api/']),
  termsRestricted: true,
  cliPersonalUseOnly: true,
  requiredAuthorizationFields: Object.freeze(['allowLiveCollection', 'authorizationRef']),
  blockedReasonCode: 'LIVE_COLLECTION_NOT_PERMITTED',
});

const CONTROL_CHAR_REGEX = /[\u0000-\u001F\u007F]/;
const DANGEROUS_UNICODE_REGEX = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/;
const PERCENT_ENCODING_REGEX = /%[0-9a-fA-F]{2}/;
const SHELL_METACHAR_REGEX = /[;&|`$<>\\]/;

function normalizeWhitespace(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function validateQueryInput(rawQuery) {
  const rawString = String(rawQuery == null ? '' : rawQuery);
  if (CONTROL_CHAR_REGEX.test(rawString) || DANGEROUS_UNICODE_REGEX.test(rawString)) {
    const err = new Error('Search query contains forbidden control or invisible characters');
    err.code = 'INVALID_DANAWA_QUERY';
    throw err;
  }
  const normalized = normalizeWhitespace(rawString);
  if (!normalized) {
    const err = new Error('Search query must not be empty');
    err.code = 'INVALID_DANAWA_QUERY';
    throw err;
  }
  if (normalized.length > MAX_QUERY_LENGTH) {
    const err = new Error(`Search query exceeds ${MAX_QUERY_LENGTH} characters`);
    err.code = 'INVALID_DANAWA_QUERY';
    throw err;
  }
  if (PERCENT_ENCODING_REGEX.test(normalized)) {
    const err = new Error('Search query must not contain pre-encoded percent sequences');
    err.code = 'INVALID_DANAWA_QUERY';
    throw err;
  }
  if (SHELL_METACHAR_REGEX.test(normalized)) {
    const err = new Error('Search query contains forbidden shell metacharacters');
    err.code = 'INVALID_DANAWA_QUERY';
    throw err;
  }
  return normalized;
}

function formatStorageToken(storageGb) {
  const numeric = Number(storageGb);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  if (numeric >= 1024 && numeric % 1024 === 0) {
    return `${numeric / 1024}TB`;
  }
  return `${numeric}GB`;
}

function sanitizeQueryPart(value) {
  return normalizeWhitespace(String(value == null ? '' : value).replace(/[;&|`$<>\\]/g, ' '));
}

function buildVariantSearchQueries(variant = {}) {
  const modelName = sanitizeQueryPart(variant.model_name);
  const domesticCode = sanitizeQueryPart(variant.domestic_model_number);
  const storageToken = formatStorageToken(variant.storage_gb);
  const color = sanitizeQueryPart(variant.color);

  const rawCandidates = [
    [modelName, '자급제', storageToken, domesticCode].filter(Boolean).join(' '),
    [modelName, '자급제', storageToken, color].filter(Boolean).join(' '),
    [domesticCode, storageToken, '자급제'].filter(Boolean).join(' '),
  ].filter(Boolean);

  const unique = [];
  for (const candidate of rawCandidates) {
    const clipped = candidate.slice(0, MAX_QUERY_LENGTH).trim();
    const safe = validateQueryInput(clipped);
    if (!unique.includes(safe)) unique.push(safe);
  }
  return unique;
}

function buildDanawaCliArgs(query, options = {}) {
  const safeQuery = validateQueryInput(query);
  const page = Number.isInteger(options.page) && options.page > 0 ? options.page : 1;
  const limit = Number.isInteger(options.limit) && options.limit > 0 && options.limit <= 100 ? options.limit : 20;
  const fields = Array.isArray(options.fields) && options.fields.length > 0
    ? options.fields.filter(f => DANAWA_CLI_COMPATIBILITY.outputFields.includes(f))
    : DANAWA_CLI_COMPATIBILITY.outputFields;

  const args = [
    'search',
    safeQuery,
    '--format',
    'json',
    '--page',
    String(page),
    '--limit',
    String(limit),
    '--fields',
    fields.join(','),
  ];
  if (options.dryRun !== false) {
    args.push('--dry-run');
  }
  return args;
}

function buildSearchRequestPreview(query, options = {}) {
  const safeQuery = validateQueryInput(query);
  const page = Number.isInteger(options.page) && options.page > 0 ? options.page : 1;
  const limit = Number.isInteger(options.limit) && options.limit > 0 && options.limit <= 100 ? options.limit : 20;
  const params = new URLSearchParams({
    keyword: safeQuery,
    page: String(page),
    limit: String(limit),
  });
  return {
    query: safeQuery,
    command: 'danawa',
    args: buildDanawaCliArgs(safeQuery, { page, limit, fields: options.fields, dryRun: true }),
    httpMethod: 'GET',
    endpointUrl: `${DANAWA_SEARCH_ENDPOINT}?${params.toString()}`,
    refererUrl: `${DANAWA_SEARCH_REFERER}?query=${encodeURIComponent(safeQuery)}`,
  };
}

function buildSearchPlan(variants = [], options = {}) {
  const entries = [];
  for (const variant of variants) {
    const queries = buildVariantSearchQueries(variant);
    const primaryQuery = queries[0];
    entries.push({
      variant_id: variant.variant_id != null ? String(variant.variant_id) : (variant.id != null ? String(variant.id) : null),
      smartphone_id: variant.smartphone_id != null ? String(variant.smartphone_id) : null,
      domestic_model_number: variant.domestic_model_number || null,
      model_name: variant.model_name || null,
      storage_gb: variant.storage_gb != null ? Number(variant.storage_gb) : null,
      color: variant.color || null,
      queries,
      primaryRequest: primaryQuery ? buildSearchRequestPreview(primaryQuery, options) : null,
    });
  }
  return {
    mode: options.mode || 'mock',
    liveCollectionBlocked: !options.allowLiveCollection,
    policyReason: AUTOMATION_POLICY.blockedReasonCode,
    totalVariants: entries.length,
    entries,
  };
}

function parseOptionalInt(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }
  const digits = String(value).replace(/[^\d-]/g, '');
  if (!digits || digits === '-') return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalFloat(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseOptionalBool(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  return null;
}

function cleanProductText(value) {
  return normalizeWhitespace(
    String(value == null ? '' : value)
      .replace(/<[^>]*>/g, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'")
  );
}

function isValidHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function safeHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function buildDanawaProductUrl(productCode) {
  if (productCode == null) return null;
  const code = String(productCode).trim();
  if (!/^\d{4,20}$/.test(code)) return null;
  return `${DANAWA_INFO_BASE_URL}${code}`;
}

function normalizeDanawaItem(raw = {}) {
  const productCode = raw.productCode != null ? String(raw.productCode).trim() : null;
  const productName = cleanProductText(raw.productName || raw.name || '');
  const minPrice = parseOptionalInt(raw.minPrice != null ? raw.minPrice : raw.amount_krw);
  const danawaProductUrl = buildDanawaProductUrl(productCode) || safeHttpUrl(raw.danawaProductUrl);

  const sellerUrl = isValidHttpUrl(raw.source_url) ? raw.source_url : null;
  const sellerName = cleanProductText(raw.seller_name || raw.mallName || '') || null;
  const shippingKrw = raw.shipping_krw === undefined ? null : parseOptionalInt(raw.shipping_krw);
  const observedAt = raw.observed_at ? String(raw.observed_at) : null;
  const expiresAt = raw.expires_at ? String(raw.expires_at) : null;
  const conditionsText = raw.conditions_text != null ? cleanProductText(raw.conditions_text) : null;

  const unconditional = parseOptionalBool(raw.unconditional);
  const inStock = parseOptionalBool(raw.in_stock);
  const isNew = parseOptionalBool(raw.is_new);
  const isUnlocked = parseOptionalBool(raw.is_unlocked);

  const hasCompleteSellerVerification = Boolean(
    sellerUrl
    && sellerName
    && minPrice != null && minPrice > 0
    && shippingKrw != null && shippingKrw >= 0
    && observedAt
    && expiresAt
    && unconditional !== null
    && inStock !== null
    && isNew !== null
    && isUnlocked !== null
  );

  return {
    productCode,
    productName,
    imageUrl: isValidHttpUrl(raw.imageUrl) ? raw.imageUrl : null,
    category: cleanProductText(raw.category || '') || null,
    minPrice,
    reviewCount: parseOptionalInt(raw.reviewCount),
    starPoint: parseOptionalFloat(raw.starPoint),
    mallName: cleanProductText(raw.mallName || '') || null,
    maker: cleanProductText(raw.maker || '') || null,
    danawaProductUrl,
    // Downstream seller-level fields are kept strictly null unless verified source supplies them.
    source_name: cleanProductText(raw.source_name || '') || null,
    source_url: sellerUrl,
    seller_name: sellerName,
    shipping_krw: shippingKrw,
    observed_at: observedAt,
    expires_at: expiresAt,
    conditions_text: conditionsText,
    unconditional,
    in_stock: inStock,
    is_new: isNew,
    is_unlocked: isUnlocked,
    data_completeness: hasCompleteSellerVerification ? 'complete_verified_offer' : 'search_summary_only',
  };
}

function parseCliSearchPayload(rawPayload) {
  let parsed = rawPayload;
  if (typeof rawPayload === 'string') {
    const trimmed = rawPayload.trim();
    if (!trimmed) return [];
    let parsedSingle = false;
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        parsed = JSON.parse(trimmed);
        parsedSingle = true;
      } catch {
        parsedSingle = false;
      }
    }
    if (!parsedSingle) {
      // JSONL (--format jsonl) support, including multi-line NDJSON
      parsed = trimmed
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => JSON.parse(line));
    }
  }

  let rawItems = [];
  if (Array.isArray(parsed)) {
    rawItems = parsed;
  } else if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.items)) rawItems = parsed.items;
    else if (Array.isArray(parsed.data)) rawItems = parsed.data;
    else if (Array.isArray(parsed.results)) rawItems = parsed.results;
    else if (parsed.productCode != null || parsed.productName != null || parsed.minPrice != null) {
      rawItems = [parsed];
    }
  }

  return rawItems.map(normalizeDanawaItem);
}

function resolveFixtureItemsForVariant(fixtures, variant, queries) {
  if (!fixtures) return [];
  const variantId = variant.variant_id != null ? String(variant.variant_id) : (variant.id != null ? String(variant.id) : null);
  const domesticCode = normalizeWhitespace(variant.domestic_model_number || '').toUpperCase();

  if (Array.isArray(fixtures.batches)) {
    const matchedItems = [];
    for (const batch of fixtures.batches) {
      const batchVariantIds = Array.isArray(batch.variant_ids) ? batch.variant_ids.map(String) : [];
      const batchCodes = Array.isArray(batch.domestic_model_numbers)
        ? batch.domestic_model_numbers.map(c => normalizeWhitespace(c).toUpperCase())
        : (batch.domestic_model_number ? [normalizeWhitespace(batch.domestic_model_number).toUpperCase()] : []);
      const variantMatch = variantId && batchVariantIds.includes(variantId);
      const codeMatch = domesticCode && batchCodes.includes(domesticCode);
      if (variantMatch || codeMatch) {
        matchedItems.push(...parseCliSearchPayload(batch.items || []));
      }
    }
    return matchedItems;
  }

  if (variantId && fixtures.byVariantId && fixtures.byVariantId[variantId]) {
    return parseCliSearchPayload(fixtures.byVariantId[variantId]);
  }
  if (domesticCode && fixtures.byDomesticModelNumber && fixtures.byDomesticModelNumber[domesticCode]) {
    return parseCliSearchPayload(fixtures.byDomesticModelNumber[domesticCode]);
  }
  if (fixtures.byQuery && typeof fixtures.byQuery === 'object') {
    for (const q of queries) {
      if (fixtures.byQuery[q]) return parseCliSearchPayload(fixtures.byQuery[q]);
    }
  }
  if (Array.isArray(fixtures.items) || Array.isArray(fixtures)) {
    return parseCliSearchPayload(fixtures);
  }
  return [];
}

function createLiveBlockedError(details = {}) {
  const err = new Error(
    'Live collection from Danawa is disabled by policy (prod.danawa.com/robots.txt Disallow: /api/, Terms of Use §24②, and danawa-cli personal-use restriction).'
  );
  err.code = AUTOMATION_POLICY.blockedReasonCode;
  err.reason = 'live-collection-not-permitted';
  err.details = details;
  return err;
}

function assertLiveAuthorized({ allowLiveCollection, authorizationRef, transport }) {
  const hasPermission = allowLiveCollection === true
    && typeof authorizationRef === 'string'
    && authorizationRef.trim().length >= 3;
  if (!hasPermission) {
    throw createLiveBlockedError({ hasPermission: false });
  }
  if (typeof transport !== 'function') {
    throw createLiveBlockedError({ hasPermission: true, missingTransport: true });
  }
}

function createDanawaSearchAdapter(config = {}) {
  const mode = config.mode || 'mock';
  if (mode !== 'mock' && mode !== 'live') {
    const err = new Error(`Unsupported adapter mode: ${mode}`);
    err.code = 'INVALID_ADAPTER_MODE';
    throw err;
  }

  if (mode === 'live') {
    assertLiveAuthorized({
      allowLiveCollection: config.allowLiveCollection,
      authorizationRef: config.authorizationRef,
      transport: config.transport,
    });
  }

  const limit = Number.isInteger(config.limit) && config.limit > 0 ? config.limit : 20;

  async function searchVariant(variant, options = {}) {
    const queries = buildVariantSearchQueries(variant);
    const plan = buildSearchPlan([variant], { mode, limit, allowLiveCollection: config.allowLiveCollection });

    if (mode === 'mock') {
      const items = resolveFixtureItemsForVariant(options.fixtures || config.fixtures, variant, queries);
      return {
        ok: true,
        adapter: 'danawa-cli',
        mode: 'mock',
        executedLiveRequest: false,
        queries,
        plan,
        items,
      };
    }

    assertLiveAuthorized({
      allowLiveCollection: config.allowLiveCollection,
      authorizationRef: config.authorizationRef,
      transport: config.transport,
    });

    const primaryQuery = queries[0];
    const request = buildSearchRequestPreview(primaryQuery, { page: 1, limit });
    const rawPayload = await config.transport(request, variant);
    const items = parseCliSearchPayload(rawPayload);
    return {
      ok: true,
      adapter: 'danawa-cli',
      mode: 'live',
      executedLiveRequest: true,
      queries,
      plan,
      items,
    };
  }

  return {
    adapterName: 'danawa-cli',
    mode,
    compatibility: DANAWA_CLI_COMPATIBILITY,
    policy: AUTOMATION_POLICY,
    buildSearchPlan: (variants, opts = {}) => buildSearchPlan(variants, { ...opts, mode, limit, allowLiveCollection: config.allowLiveCollection }),
    searchVariant,
  };
}

async function probeDanawaCliEsmSupport({ importModule } = {}) {
  const loader = typeof importModule === 'function' ? importModule : () => import('danawa-cli');
  try {
    const mod = await loader();
    const hasSearchDanawa = Boolean(mod && typeof mod.searchDanawa === 'function');
    return {
      esmDynamicImportSupported: true,
      packageAvailable: true,
      hasSearchDanawa,
      exports: mod ? Object.keys(mod).sort() : [],
    };
  } catch (err) {
    return {
      esmDynamicImportSupported: true,
      packageAvailable: false,
      hasSearchDanawa: false,
      errorCode: err && err.code ? err.code : 'IMPORT_FAILED',
      errorMessage: err ? err.message : 'Failed to import danawa-cli',
    };
  }
}

/**
 * CommonJS -> ESM dynamic import bridge mirroring PC-FIT's `await import('danawa-cli')`
 * + `searchDanawa({ query, page, limit, signal })` call shape.
 * Remains blocked behind AUTOMATION_POLICY unless live authorization is explicitly granted.
 */
function createDanawaCliTransport({ importModule, timeoutMs = 15000, page = 1, limit = 10 } = {}) {
  const loader = typeof importModule === 'function' ? importModule : () => import('danawa-cli');
  const safeTimeout = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0 ? Number(timeoutMs) : 15000;

  return async function danawaCliTransport(request) {
    const mod = await loader();
    if (!mod || typeof mod.searchDanawa !== 'function') {
      const err = new Error('Imported danawa-cli ESM module does not export searchDanawa');
      err.code = 'INVALID_DANAWA_CLI_MODULE';
      throw err;
    }
    const result = await mod.searchDanawa({
      query: request.query,
      page,
      limit,
      signal: AbortSignal.timeout(safeTimeout),
    });
    if (!result || !result.ok) {
      const err = new Error(result && result.errorCode ? `Danawa search failed: ${result.errorCode}` : 'Danawa search failed');
      err.code = 'DANAWA_UPSTREAM_FAILED';
      err.upstreamResult = result || null;
      throw err;
    }
    return { items: Array.isArray(result.items) ? result.items : [] };
  };
}

module.exports = {
  DANAWA_SEARCH_ENDPOINT,
  DANAWA_SEARCH_REFERER,
  DANAWA_INFO_BASE_URL,
  DANAWA_CLI_COMPATIBILITY,
  AUTOMATION_POLICY,
  cleanProductText,
  safeHttpUrl,
  validateQueryInput,
  formatStorageToken,
  buildVariantSearchQueries,
  buildDanawaCliArgs,
  buildSearchRequestPreview,
  buildSearchPlan,
  normalizeDanawaItem,
  parseCliSearchPayload,
  probeDanawaCliEsmSupport,
  createDanawaCliTransport,
  createDanawaSearchAdapter,
};
