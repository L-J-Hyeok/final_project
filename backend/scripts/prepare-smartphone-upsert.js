'use strict';
// Offline upsert PLAN only. No DB/config imports, executor, network or env access.
// --apply is deliberately rejected until a separate approved implementation task.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const DATA = path.resolve(__dirname, '../data');
const CANDIDATES = 'smartphone-import-candidates-2026-11-11.json';
const OFFICIAL_HOSTS = new Set(['www.samsung.com', 'news.samsung.com', 'www.apple.com', 'support.apple.com', 'www.samsungsvc.co.kr']);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
// Conservative offline identity comparison, NOT an emulation of MySQL collation.
const fold = value => String(value).normalize('NFKC').trim().toLowerCase();
const modelKey = row => `${fold(row.brand)}:${fold(row.domestic_model_number)}`;
const optionKey = row => `${row.storage_gb}:${row.ram_gb === null ? 0 : row.ram_gb}:${fold(row.color)}`;
const colorKey = row => `${row.storage_gb}:${fold(row.color)}`;
const positive = value => Number.isSafeInteger(value) && value > 0;
const nullableBoolean = value => value === null || typeof value === 'boolean';
const CORE = ['model_name', 'released_on_kr', 'os', 'chipset', 'screen_inches', 'refresh_hz', 'battery_mah', 'weight_g', 'supports_5g', 'wireless_charging'];

function safeUrl(value, hosts = OFFICIAL_HOSTS) {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\u0000-\u001f\u007f\\]/u.test(value)) return false;
  try {
    const u = new URL(value);
    if (/[\u0000-\u001f\u007f]/u.test(decodeURIComponent(u.pathname + u.search + u.hash))) return false;
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && hosts.has(u.hostname);
  } catch { return false; }
}
function validateBundle(bundle) {
  assert.equal(bundle.schema_version, 1);
  assert.equal(bundle.mode, 'offline_preparation_only');
  assert.equal(bundle.production_approved, false);
  assert.equal(bundle.execution_authorized, false);
  assert.deepEqual(bundle.price_observations, []);
  assert.ok(Array.isArray(bundle.models) && Array.isArray(bundle.variants));
  const keys = new Set(), identities = new Set(), options = new Set();
  for (const m of bundle.models) {
    assert.ok(typeof m.key === 'string' && !keys.has(m.key), 'DUPLICATE_MODEL_KEY'); keys.add(m.key);
    assert.ok(['samsung','apple'].includes(m.brand));
    assert.ok(typeof m.model_name === 'string' && m.model_name.trim());
    assert.ok(typeof m.domestic_model_number === 'string' && m.domestic_model_number.trim());
    assert.ok(!identities.has(modelKey(m)), 'DUPLICATE_MODEL_NUMBER'); identities.add(modelKey(m));
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(m.released_on_kr) && new Date(m.released_on_kr).toISOString().slice(0,10) === m.released_on_kr);
    assert.ok(['android','ios','other'].includes(m.os));
    assert.equal(m.fact_status, 'verified'); assert.equal(m.production_approved, false);
    for (const field of ['supports_5g','wireless_charging']) assert.ok(nullableBoolean(m[field]), 'INVALID_BOOLEAN');
    for (const field of ['screen_inches','refresh_hz','battery_mah','weight_g']) assert.ok(m[field] === null || (typeof m[field] === 'number' && Number.isFinite(m[field]) && m[field] > 0), 'INVALID_SPEC');
    assert.ok(m.source_refs && Object.keys(m.source_refs).length);
    for (const source of Object.values(m.source_refs)) assert.ok(safeUrl(source.url), 'UNSAFE_SOURCE_URL');
    for (const link of Object.values(m.links)) assert.ok(link === null || safeUrl(link.url), 'UNSAFE_PRODUCT_LINK');
  }
  for (const v of bundle.variants) {
    const m = bundle.models.find(m => m.key === v.model_key); assert.ok(m, 'MISSING_PARENT');
    assert.ok(positive(v.storage_gb) && (v.ram_gb === null || positive(v.ram_gb)), 'INVALID_CAPACITY');
    assert.ok(typeof v.color === 'string' && v.color.trim() && fold(v.color) !== 'unspecified', 'COLOR_UNVERIFIED');
    const key = v.model_key + ':' + optionKey(v);
    assert.ok(!options.has(key), 'DUPLICATE_VARIANT'); options.add(key);
    assert.equal(v.fact_status, 'verified'); assert.equal(v.production_approved, false);
    assert.ok(['exact_sku','explicit_exclusive_configuration'].includes(v.color_evidence.kind));
    assert.ok(v.color_evidence.source_ids.length && v.color_evidence.source_ids.every(id => m.source_refs[id]), 'COLOR_EVIDENCE_MISSING');
    if (v.color_evidence.kind === 'exact_sku') assert.ok(typeof v.official_sku === 'string' && v.official_sku.length);
    assert.equal(v.current_price, null, 'CURRENT_PRICE_NOT_AUTHORIZED');
    const p = v.launch_price;
    assert.equal(p.currency, 'KRW'); assert.equal(p.production_approved, false);
    assert.ok(p.amount_krw === null || positive(p.amount_krw), 'INVALID_LAUNCH_PRICE');
    if (p.amount_krw !== null) {
      assert.equal(p.fact_status, 'verified');
      assert.ok(p.source_ids.length && p.source_ids.every(id => m.source_refs[id]), 'LAUNCH_EVIDENCE_MISSING');
    }
  }
  return true;
}
function baselineInventory(baseline) {
  const models = baseline.smartphones.filter(m => m.verified === true && m.audit_metadata.migration_tier === 'verified_ready');
  const keys = new Set(models.map(m => m.smartphone_key));
  const variants = baseline.smartphone_variants.filter(v => v.verified === true && keys.has(v.smartphone_key));
  assert.equal(models.length, 16, 'BASELINE_MODEL_COUNT'); assert.equal(variants.length, 29, 'BASELINE_VARIANT_COUNT');
  // Original JSON has logical keys, not actual MySQL PKs. Never synthesize database IDs.
  return { models: models.map(m => ({ ...m, key: m.smartphone_key })), variants: variants.map(v => ({ ...v, model_key: v.smartphone_key })) };
}
function planUpsert(bundle, inventory, { extended = false } = {}) {
  validateBundle(bundle);
  const before = JSON.stringify(inventory);
  const result = { mode: 'OFFLINE_DRY_RUN', schema: extended ? 'proposed_extension' : 'current',
    basis: 'file_inventory_not_live_database', actual_db_ids_verified: false, db_writes: 0,
    insert_models: [], insert_variants: [], preserve_models: [], preserve_variants: [],
    proposed_null_enrichments: [], conflicts: [], price_observations: [],
    operational_approval: false, apply_supported: false,
    inventory_before: { models: inventory.models.length, variants: inventory.variants.length },
    preservation: 'Input inventory remains unchanged; actual DB IDs/FKs need separate read-only verification.' };
  const bad = (key, reason) => result.conflicts.push({ key, reason });
  const seenModels = new Set(), seenVariants = new Set();
  for (const m of inventory.models) {
    if (seenModels.has(modelKey(m))) bad(m.key, 'EXISTING_MODEL_DUPLICATE'); seenModels.add(modelKey(m));
  }
  for (const v of inventory.variants) {
    const key = v.model_key + ':' + optionKey(v);
    if (seenVariants.has(key)) bad(key, 'EXISTING_NULL_OR_RAM_KEY_DUPLICATE'); seenVariants.add(key);
  }
  const blocked = new Set();
  for (const m of bundle.models) {
    const matches = inventory.models.filter(old => modelKey(old) === modelKey(m));
    const sameName = inventory.models.filter(old => fold(old.brand) === fold(m.brand) && fold(old.model_name) === fold(m.model_name) && modelKey(old) !== modelKey(m));
    if (sameName.length || matches.length > 1) { bad(m.key, 'MODEL_IDENTITY_CONFLICT'); blocked.add(m.key); continue; }
    if (!matches.length) result.insert_models.push({ key: m.key, domestic_model_number: m.domestic_model_number });
    else {
      const old = matches[0], patches = {};
      for (const field of CORE) {
        if (m[field] === null) continue; // Never erase an already verified value.
        if (old[field] === null) patches[field] = m[field];
        else if (old[field] !== m[field]) { bad(m.key, 'MODEL_VALUE_CONFLICT:' + field); blocked.add(m.key); }
      }
      result.preserve_models.push({ key: m.key, existing_key: old.key, existing_id: old.id ?? null });
      if (Object.keys(patches).length) result.proposed_null_enrichments.push({ kind: 'model', key: m.key, existing_id: old.id ?? null, patch: patches, approval_required: true });
    }
  }
  // Include accepted planned options in comparisons to catch conflicts within the new batch.
  const staged = [];
  for (const v of bundle.variants) {
    if (blocked.has(v.model_key)) continue;
    const m = bundle.models.find(m => m.key === v.model_key);
    const oldParent = inventory.models.find(old => modelKey(old) === modelKey(m));
    const siblings = [...inventory.variants.filter(old => old.model_key === oldParent?.key), ...staged.filter(old => old.model_key === v.model_key)];
    const sameColor = siblings.filter(old => colorKey(old) === colorKey(v));
    // Unmapped placeholder/English aliases require review, not silent new variants.
    const ambiguous = siblings.some(old => old.storage_gb === v.storage_gb && (fold(old.color) === 'unspecified' || (/^[\x00-\x7f]+$/.test(old.color) !== /^[\x00-\x7f]+$/.test(v.color))));
    if (ambiguous) { bad(v.model_key, 'COLOR_MAPPING_REQUIRED'); continue; }
    if (sameColor.length > 1 && sameColor.some(old => old.ram_gb === null)) { bad(v.model_key, 'UNKNOWN_KNOWN_AMBIGUITY'); continue; }
    const same = sameColor.find(old => old.ram_gb === v.ram_gb);
    if (same) {
      if (same.official_sku && v.official_sku && same.official_sku !== v.official_sku) { bad(v.model_key, 'EXACT_SKU_CONFLICT'); continue; }
      result.preserve_variants.push({ model_key: v.model_key, existing_id: same.id ?? null, storage_gb: v.storage_gb, color: same.color }); continue;
    }
    const unknown = sameColor.find(old => old.ram_gb === null || v.ram_gb === null);
    if (unknown) {
      if (unknown.official_sku && v.official_sku && unknown.official_sku === v.official_sku) {
        result.preserve_variants.push({ model_key: v.model_key, existing_id: unknown.id ?? null, storage_gb: v.storage_gb, color: unknown.color });
        if (unknown.ram_gb === null && v.ram_gb !== null) result.proposed_null_enrichments.push({ kind: 'variant', model_key: v.model_key, existing_id: unknown.id ?? null, patch: { ram_gb: v.ram_gb }, approval_required: true, parent_lock_required: true });
      } else bad(v.model_key, 'UNKNOWN_KNOWN_SKU_REVIEW_REQUIRED');
      continue;
    }
    if (!extended && sameColor.length) { bad(v.model_key, 'CURRENT_UNIQUE_KEY_RAM_CONFLICT'); continue; }
    result.insert_variants.push({ model_key: v.model_key, storage_gb: v.storage_gb, ram_gb: v.ram_gb, color: v.color }); staged.push(v);
  }
  result.ready_for_review = result.conflicts.length === 0;
  result.summary = { models_to_insert: result.insert_models.length, variants_to_insert: result.insert_variants.length,
    models_preserved: result.preserve_models.length, variants_preserved: result.preserve_variants.length,
    enrichments_proposed: result.proposed_null_enrichments.length, conflicts: result.conflicts.length,
    executable_writes: 0 };
  assert.equal(JSON.stringify(inventory), before, 'INVENTORY_MUTATED');
  return result;
}
function validateEvidence(bundle, expansion, priority) {
  const expected = [
    { key: 's25-ultra', storage: 1024, ram: 16, color: '티타늄 제트블랙', original: 'Titanium Jetblack', sku: null },
    { key: 's26-plus', storage: 256, ram: 12, color: '블랙', original: 'Black', sku: 'SM-S947NZKAKOO' }
  ];
  assert.equal(bundle.models.length, expected.length, 'CANDIDATE_SCOPE');
  assert.equal(bundle.variants.length, expected.length, 'CANDIDATE_SCOPE');
  for (const e of expected) {
    const m = bundle.models.find(m => m.key === e.key), v = bundle.variants.find(v => v.model_key === e.key);
    const original = expansion.models.find(m => m.key === e.key), review = priority.models.find(m => m.model_key === e.key);
    assert.ok(m && v && original && review, 'CANDIDATE_EVIDENCE_MISSING');
    assert.equal(m.domestic_model_number, review.domestic_model_number);
    for (const f of ['brand','model_name','released_on_kr']) assert.equal(m[f], original[f]);
    assert.equal(m.os, 'android'); assert.ok(original.specs.os_at_launch.startsWith('Android '));
    const fields = { chipset: 'chipset', screen_inches: 'main_display_inches', refresh_hz: 'refresh_hz', battery_mah: 'battery_typical_mah', weight_g: 'weight_g', supports_5g: 'supports_5g', wireless_charging: 'wireless_charging' };
    for (const [field, source] of Object.entries(fields)) assert.deepEqual(m[field], original.specs[source], 'SPEC_EVIDENCE_MISMATCH');
    for (const [id, source] of Object.entries(m.source_refs)) assert.deepEqual(source, priority.sources[id], 'SOURCE_EVIDENCE_MISMATCH');
    assert.equal(v.storage_gb, e.storage); assert.equal(v.ram_gb, e.ram); assert.equal(v.color, e.color); assert.equal(v.official_sku, e.sku);
    const c = original.configurations.find(c => c.storage_gb === e.storage && c.ram_gb === e.ram);
    if (e.sku) {
      assert.ok(review.verified_exact_skus.some(s => s.sku === e.sku && s.storage_gb === e.storage && s.ram_gb === e.ram && s.color_kr === e.color && s.fact_verified));
    } else assert.deepEqual(c.color_restriction, [e.original], 'EXCLUSIVE_COLOR_EVIDENCE');
    // A missing price remains null and does not disqualify the product.
    if (v.launch_price.amount_krw !== null) assert.equal(v.launch_price.amount_krw, c.launch_price.amount_krw, 'LAUNCH_PRICE_EVIDENCE');
    assert.deepEqual(v.launch_price.source_ids, c.launch_price.source_ids);
  }
  return true;
}
function run(args = process.argv.slice(2), dataDir = DATA) {
  if (args.some(a => !['--dry-run','--extended'].includes(a))) throw new Error('WRITE_MODE_NOT_AVAILABLE');
  const bundle = JSON.parse(fs.readFileSync(path.join(dataDir, CANDIDATES), 'utf8'));
  const allowed = ['normalized-smartphones.json','smartphone-expansion-2026-11-10.json','smartphone-priority-verification-2026-11-11.json'];
  assert.deepEqual(Object.keys(bundle.source_hashes).sort(), [...allowed].sort(), 'SOURCE_SET_MISMATCH');
  for (const name of allowed) assert.equal(sha(fs.readFileSync(path.join(dataDir, name))), bundle.source_hashes[name], 'SOURCE_HASH_MISMATCH');
  validateEvidence(bundle, JSON.parse(fs.readFileSync(path.join(dataDir, allowed[1]), 'utf8')), JSON.parse(fs.readFileSync(path.join(dataDir, allowed[2]), 'utf8')));
  const baseline = JSON.parse(fs.readFileSync(path.join(dataDir, allowed[0]), 'utf8'));
  return planUpsert(bundle, baselineInventory(baseline), { extended: args.includes('--extended') });
}
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error('PREPARATION_FAILED: ' + (error.message || 'INVALID_DATA').split('\n')[0]); process.exitCode = 1; }
}
module.exports = { validateEvidence, safeUrl, optionKey, validateBundle, baselineInventory, planUpsert, run };
