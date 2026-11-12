'use strict';
// Internal authorized-feed contract, NOT a claim about the MCP/CLI response schema.
const { createHash } = require('node:crypto');
const adapter = require('./danawa-price-adapter');
const matcher = require('./danawa-price-matcher');
const DEFAULT_SELLERS = Object.freeze(['coupang', 'gmarket', '11st', 'samsung', 'apple']);
const SELLERS = Object.freeze({
  coupang: { names: ['쿠팡', 'Coupang'], hosts: ['coupang.com'], type: 'marketplace' },
  gmarket: { names: ['G마켓', 'Gmarket', '지마켓'], hosts: ['gmarket.co.kr'], type: 'marketplace' },
  '11st': { names: ['11번가'], hosts: ['11st.co.kr'], type: 'marketplace' },
  samsung: { names: ['삼성닷컴'], hosts: ['samsung.com'], type: 'manufacturer_store' },
  apple: { names: ['Apple 공식몰', 'Apple Store'], hosts: ['apple.com'], type: 'manufacturer_store' }
});
function isAllowedSeller(key, allowed = DEFAULT_SELLERS) { return allowed.includes(key); }
function urlHost(url) { try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password ? u.hostname : null; } catch (_) { return null; } }
function sellerIdentity(offer, registry = SELLERS, allowed = DEFAULT_SELLERS) {
  const entry = registry[offer.seller_key];
  if (!entry || !isAllowedSeller(offer.seller_key, allowed) || !entry.names.includes(offer.seller_name)) return null;
  const host = urlHost(offer.seller_product_url);
  const matchesHost = host && entry.hosts.some(h => host === h || host.endsWith('.' + h));
  // A certified reseller is never promoted to a manufacturer store by its display label.
  if ((offer.seller_product_url && !matchesHost) || (entry.type === 'manufacturer_store' && !matchesHost)) return null;
  return entry;
}
function validAmount(n) { return Number.isSafeInteger(n) && n > 0; }
function prepareSellerObservations(variant, feed, options = {}) {
  const now = new Date(options.now || Date.now());
  if (!Number.isFinite(now.getTime())) throw new Error('INVALID_EVALUATION_TIME');
  const accepted = [], rejected = [];
  const sync = require('./danawa-price-sync');
  for (const offer of feed.offers || []) {
    const reject = reason => rejected.push({ seller_key: offer.seller_key || null, reason });
    const identity = sellerIdentity(offer, options.registry, options.allowedSellers);
    if (!identity || (identity.type === 'manufacturer_store' && offer.seller_key !== variant.brand)) { reject('SELLER_NOT_ALLOWED_OR_NOT_OFFICIAL'); continue; }
    if (!validAmount(offer.amount_krw) || (offer.shipping_krw != null && (!Number.isSafeInteger(offer.shipping_krw) || offer.shipping_krw < 0))) { reject('INVALID_PRICE'); continue; }
    if (offer.unconditional === false || offer.in_stock === false || offer.is_new !== true || offer.is_unlocked !== true) { reject('CONDITIONAL_UNAVAILABLE_OR_UNVERIFIED_PRODUCT'); continue; }
    if (!feed.observed_at || !Number.isFinite(new Date(feed.observed_at).getTime())) { reject('MISSING_OBSERVATION_TIME'); continue; }
    if (feed.expires_at != null && !Number.isFinite(new Date(feed.expires_at).getTime())) { reject('INVALID_EXPIRY'); continue; }
    const item = adapter.normalizeDanawaItem({
      ...offer, productCode: feed.product_code, productName: offer.product_name,
      maker: feed.maker, minPrice: offer.amount_krw,
      source_name: 'danawa', source_url: offer.seller_product_url,
      observed_at: feed.observed_at, expires_at: feed.expires_at
    });
    const match = matcher.matchDanawaItemToVariant(item, variant, { requireDomesticModelNumber: true });
    if (!match.matched) { reject((match.reasons || []).join(',') || 'OPTION_MISMATCH'); continue; }
    const expectedRam = variant.ram_gb == null ? null : Number(variant.ram_gb);
    if (match.matchDetails.ramGb !== expectedRam) { reject('RAM_NOT_EXACT'); continue; }
    if (!item.danawaProductUrl) { reject('MISSING_PRODUCT_CODE'); continue; }
    const mapped = sync.mapMatchedOfferToPriceObservation(match, variant, { now, ttlHours: options.ttlHours });
    if (!mapped.ttlWithin24h || new Date(mapped.observationPayload.observed_at) > now || new Date(mapped.observationPayload.expires_at) <= now) { reject('STALE_OR_INVALID_PERIOD'); continue; }
    const payload = mapped.observationPayload;
    payload.source_url = offer.seller_product_url || item.danawaProductUrl;
    payload.seller_name = identity.names[0];
    payload.conditions_text = item.conditions_text || '판매 조건 미확인';
    payload.price_metadata_json = {
      version: 1, price_type: mapped.readyForStorage ? 'verified_sale' : 'reference_sale',
      seller_key: offer.seller_key, seller_type: identity.type,
      product_code: item.productCode, danawa_product_url: item.danawaProductUrl,
      seller_product_url: offer.seller_product_url || null,
      provider_updated_at: feed.provider_updated_at || null
    };
    // Exact repeated observation only; new checks (even unchanged prices) retain history.
    payload.observation_key = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    accepted.push(payload);
  }
  return { accepted, rejected, overall_minimum_krw: null }; // Never infer Danawa-wide minimum from selected sellers.
}
function summarizeSellerPrices(latest = []) {
  const sellers = DEFAULT_SELLERS.map(key => {
    const rows = latest.filter(p => p.seller_key === key);
    const price = rows.sort((a,b) => new Date(b.observed_at) - new Date(a.observed_at))[0] || null;
    return { seller_key: key, seller_name: SELLERS[key].names[0], price,
      status: !price ? 'unknown' : price.is_expired ? 'expired' : price.eligible ? 'verified_sale' : 'reference_sale' };
  });
  const eligible = sellers.map(s => s.price).filter(p => p?.eligible).sort((a,b) => a.total_krw - b.total_krw);
  return { lowest: eligible[0] || null, sellers, overall_danawa_minimum_krw: null };
}
async function persistSellerObservations(db, prepared, options = {}) {
  if (options.apply !== true) return { applied: false, inserted: 0, duplicates: 0, prepared: prepared.accepted.length };
  if (options.allowDbWrite !== true || typeof options.authorizationRef !== 'string' || options.authorizationRef.trim().length < 3 || options.storageAuthorized !== true) throw new Error('SELLER_PRICE_STORAGE_NOT_AUTHORIZED');
  const columns = await db.getQueryInterface().describeTable('price_observations');
  if (!columns.price_metadata_json || !columns.observation_key || !columns.in_stock.allowNull || !columns.unconditional.allowNull) throw new Error('SELLER_PRICE_MIGRATION_REQUIRED');
  const model = db.models.price_observations;
  const D = require('sequelize').DataTypes;
  if (!model.rawAttributes.price_metadata_json) {
    model.rawAttributes.price_metadata_json = { type: D.JSON, allowNull: true };
    model.rawAttributes.observation_key = { type: D.STRING(64), allowNull: true };
    for (const k of ['unconditional', 'in_stock', 'is_new', 'is_unlocked']) model.rawAttributes[k].allowNull = true;
    model.refreshAttributes();
  }
  let inserted = 0, duplicates = 0;
  await db.transaction(async transaction => {
    for (const payload of prepared.accepted) {
      // Serialize writes for this option, also protecting concurrent identical imports.
      const variant = await db.models.smartphone_variants.findByPk(payload.variant_id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!variant) throw new Error('VARIANT_NOT_FOUND');
      if (await model.findOne({ where: { observation_key: payload.observation_key }, transaction })) { duplicates++; continue; }
      await model.create(payload, { transaction }); inserted++;
    }
  });
  return { applied: true, inserted, duplicates };
}
module.exports = { summarizeSellerPrices, DEFAULT_SELLERS, SELLERS, isAllowedSeller, sellerIdentity, prepareSellerObservations, persistSellerObservations };
