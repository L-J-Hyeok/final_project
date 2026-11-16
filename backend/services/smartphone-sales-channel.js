'use strict';
// Explicit MVP exclusions, not a model-number suffix inference.
const CARRIERS = Object.freeze({
  'SM-A156L':'LG U+', 'SM-A176L':'LG U+', 'SM-A276K':'KT',
  'SM-M176S':'SKT', 'SM-A556S':'SKT', 'SM-A566S':'SKT', 'SM-A576S':'SKT'
});
function metadata(value) { if (!value) return {}; if(typeof value==='object') return value; try{return JSON.parse(value);}catch(_){return {};}}
function classify(model, variants=[]) {
  const code=String(model.domestic_model_number||'').trim();
  const mm=metadata(model.review_metadata_json), metas=[mm,...variants.map(v=>metadata(v.review_metadata_json))];
  const carrier=CARRIERS[code];
  if(carrier || metas.some(m=>String(m.channel||'').startsWith('carrier_exclusive_') || m.unlocked_released===false)) {
    return {sales_channel: carrier==='LG U+'?'carrier_exclusive_lgu':carrier==='KT'?'carrier_exclusive_kt':carrier==='SKT'?'carrier_exclusive_skt':'carrier_exclusive_unspecified',carrier:carrier||mm.carrier||null,is_unlocked:false,channel_evidence:carrier?'explicit_mvp_carrier_policy':'explicit_carrier_metadata'};
  }
  if(metas.some(m=>m.channel==='unlocked' && m.channel_verified===true && m.channel_source_url)) return {sales_channel:'unlocked',carrier:null,is_unlocked:true,channel_evidence:'verified_domestic_standalone_source'};
  return {sales_channel:'review_required',carrier:null,is_unlocked:null,channel_evidence:'channel_source_required'};
}
function sql(alias='s',hasMetadata=false) {
  if(!/^[a-z]+$/i.test(alias))throw Error('INVALID_ALIAS');
  const clauses=[`COALESCE(${alias}.domestic_model_number, '') NOT IN (${Object.keys(CARRIERS).map(x=>`'${x}'`).join(',')})`];
  if(hasMetadata) clauses.push(`COALESCE(JSON_UNQUOTE(JSON_EXTRACT(${alias}.review_metadata_json, '$.channel')), '') NOT LIKE 'carrier_exclusive_%'`);
  return '('+clauses.join(' AND ')+')';
}
module.exports={CARRIERS,metadata,classify,sql};
