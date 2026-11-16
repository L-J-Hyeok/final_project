'use strict';

// Offline planning and target preparation: no DB mutations, no network requests, no live price collection.
const fs = require('node:fs');

const DANAWA_BLOCKED_REASON = 'LIVE_COLLECTION_NOT_PERMITTED';

function parseJson(val) {
  if (!val) return {};
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (_) {
    return {};
  }
}

const publicRow = (r) =>
  (r.verified === true || r.verified === 1) && ['legacy', 'approved'].includes(r.review_status);

const detectSalesChannel = require('../services/smartphone-sales-channel').classify;

function assessVariantSkuStatus(v, m) {
  const vm = parseJson(v.review_metadata_json);
  if (v.review_status === 'rejected' || vm.status === 'rejected') {
    return {
      sku_verification_status: 'unsupported',
      sku_verification_reason: vm.reject_reason || 'option_rejected_by_audit',
    };
  }
  if (v.review_status === 'pending' || vm.status === 'pending') {
    return {
      sku_verification_status: 'review_required',
      sku_verification_reason: 'variant_review_pending',
    };
  }
  if ((vm.official_sku && vm.official_sku_verified === true) || (vm.option_release_verified === true && vm.option_source_url)) {
    return {
      sku_verification_status: 'verified',
      sku_verification_reason: 'official_sku_verified',
    };
  }
  if (vm.stage === 'stage2_2026_audit' && vm.option_release_verified === true) {
    return {
      sku_verification_status: 'verified',
      sku_verification_reason: 'stage2_2026_audit_lineup_verified',
    };
  }
  if (vm.sku_status === 'pending_review') {
    return {
      sku_verification_status: 'review_required',
      sku_verification_reason: 'individual_retail_sku_pending_review',
    };
  }
  if (
    (v.review_status === 'legacy' || v.review_status === 'approved') &&
    (v.source_url || m?.official_product_url)
  ) {
    return {
      sku_verification_status: 'verified',
      sku_verification_reason: 'official_source_catalog_verified',
    };
  }
  return {
    sku_verification_status: 'review_required',
    sku_verification_reason: 'insufficient_sku_evidence',
  };
}

function prepare({ models, variants, prices, asOf, options = {} }) {
  const now = Date.parse(asOf);
  if (!Number.isFinite(now)) throw new Error('AS_OF_REQUIRED');

  const allowLiveCollection = Boolean(options.allowLiveCollection && options.authorizationRef);
  const byModel = new Map(models.map((m) => [String(m.id), m]));
  const groups = new Map();

  for (const v of variants) {
    const m = byModel.get(String(v.smartphone_id));
    if (!m) throw new Error('ORPHAN_VARIANT');

    const channelInfo = detectSalesChannel(m, [v]);
    const key = JSON.stringify([
      m.brand,
      m.domestic_model_number || `missing:${m.id}`,
      v.storage_gb,
      channelInfo.sales_channel,
    ]);

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        brand: m.brand,
        year: String(m.released_on_kr || '').slice(0, 4),
        model_name: m.model_name,
        domestic_model_number: m.domestic_model_number,
        storage_gb: v.storage_gb,
        smartphone_id: String(m.id),
        model_ids: [],
        sales_channel: channelInfo.sales_channel,
        carrier: channelInfo.carrier,
        is_unlocked: channelInfo.is_unlocked,
        channel_evidence: channelInfo.channel_evidence,
        source_url: m.official_product_url || m.source_url || null,
        official_product_url: m.official_product_url || null,
        variants: [],
        observations: [],
      });
    }

    const g = groups.get(key);
    if (!g.model_ids.includes(String(m.id))) g.model_ids.push(String(m.id));

    const isPublic = publicRow(m) && !m.is_test && publicRow(v) && channelInfo.is_unlocked !== false;
    const skuAssessment = assessVariantSkuStatus(v, m);

    g.variants.push({
      variant_id: String(v.id),
      color: v.color,
      ram_gb: v.ram_gb,
      public: isPublic,
      sku_verification_status: skuAssessment.sku_verification_status,
      sku_verification_reason: skuAssessment.sku_verification_reason,
      official_sku: parseJson(v.review_metadata_json).official_sku || null,
      source_url: v.source_url || null,
      source_name: v.source_name || null,
    });

    g.observations.push(...prices.filter((p) => String(p.variant_id) === String(v.id)));
  }

  return [...groups.values()]
    .map((g) => {
      const fresh = (p) => {
        const o = Date.parse(p.observed_at);
        const e = Date.parse(p.expires_at);
        return (
          o <= now &&
          now < e &&
          e > o &&
          e - o <= 86400000 &&
          now - o < 86400000 &&
          Number(p.amount_krw) > 0
        );
      };
      const expired = (p) => {
        const o = Date.parse(p.observed_at);
        const e = Date.parse(p.expires_at);
        return Number.isFinite(o) && Number.isFinite(e) && o <= now && (e <= now || now - o >= 86400000);
      };

      const active = g.observations.filter(fresh);
      const price_status = active.length
        ? 'active_reference_or_sale'
        : !g.observations.length
        ? 'never_collected'
        : g.observations.every(expired)
        ? 'expired_only'
        : 'review_required';

      const publicVariants = g.variants.filter((v) => v.public);
      const isPublicGroup = publicVariants.length > 0;

      // RAM configuration assessment
      const ramConfigs = [...new Set(g.variants.map((v) => v.ram_gb).filter((r) => r != null))].sort(
        (a, b) => a - b
      );
      const hasAmbiguousRam = ramConfigs.length > 1;
      const representativeRam =
        ramConfigs.length === 1 ? ramConfigs[0] : ramConfigs.length === 0 ? null : ramConfigs;

      // Group-level SKU verification status
      let groupSkuStatus = 'review_required';
      if (!isPublicGroup || publicVariants.every((v) => v.sku_verification_status === 'unsupported')) {
        groupSkuStatus = 'unsupported';
      } else if (publicVariants.some((v) => v.sku_verification_status === 'review_required')) {
        groupSkuStatus = 'review_required';
      } else if (publicVariants.every((v) => v.sku_verification_status === 'verified')) {
        groupSkuStatus = 'verified';
      }

      // Check product and model identity
      const m = byModel.get(g.smartphone_id);
      const productPublicOk = publicRow(m) && !m.is_test && isPublicGroup;
      const requiredSpecsOk = Boolean(g.domestic_model_number) && Number(g.storage_gb) > 0;
      const singleModelIdentity = g.model_ids.length === 1;
      const channelIdentified =
        g.sales_channel !== 'review_required' &&
        g.sales_channel !== 'unknown' &&
        g.is_unlocked !== null;
      const ramUnambiguousOk = !hasAmbiguousRam || publicVariants.every(v => v.ram_gb != null && v.sku_verification_status === 'verified');
      const skuVerifiedOk = groupSkuStatus === 'verified';

      // Data consistency eligibility
      const dataConsistencyEligible =
        productPublicOk &&
        g.is_unlocked === true &&
        requiredSpecsOk &&
        singleModelIdentity &&
        channelIdentified &&
        ramUnambiguousOk &&
        (options.requireVerifiedSku === false ? groupSkuStatus !== 'unsupported' : skuVerifiedOk);

      let exclusionReason = null;
      let exclusionReasonCode = null;

      if (!productPublicOk) {
        exclusionReasonCode = 'PRODUCT_NOT_PUBLIC_OR_TEST';
        exclusionReason = '비공개 또는 테스트용 제품으로 수집 대상에서 제외됩니다.';
      } else if (g.is_unlocked === false) {
        exclusionReasonCode = 'CARRIER_OUTSIDE_MVP';
        exclusionReason = '통신사 전용 제품은 자급제 MVP 가격 수집 범위 밖입니다. 관리 데이터는 보존합니다.';
      } else if (!requiredSpecsOk) {
        exclusionReasonCode = 'MISSING_MODEL_NUMBER_OR_STORAGE';
        exclusionReason = '국내 모델번호 또는 유효 저장용량이 누락되어 구분이 불가능합니다.';
      } else if (!singleModelIdentity) {
        exclusionReasonCode = 'MULTIPLE_MODEL_IDENTITY_CONFLICT';
        exclusionReason = '복수의 모델 ID가 동일 식별자에 매핑되어 충돌합니다.';
      } else if (!channelIdentified) {
        exclusionReasonCode = 'SALES_CHANNEL_REVIEW_REQUIRED';
        exclusionReason = '자급제 및 통신사 판매 채널이 명확히 확인되지 않아 검토가 필요합니다.';
      } else if (!ramUnambiguousOk) {
        exclusionReasonCode = 'AMBIGUOUS_RAM_CONFIGURATION';
        exclusionReason = `동일 용량에 복수의 RAM 사양(${ramConfigs.join('GB, ')}GB)이 혼재되어 자동 저장이 보류됩니다.`;
      } else if (!skuVerifiedOk) {
        exclusionReasonCode = 'SKU_VERIFICATION_REQUIRED';
        exclusionReason = '공식 세부 SKU 조합 검증이 완료되지 않아 자동 수집이 보류됩니다.';
      }

      // Source permission eligibility
      const sourcePermissionEligible = allowLiveCollection;
      if (dataConsistencyEligible && !sourcePermissionEligible) {
        exclusionReasonCode = DANAWA_BLOCKED_REASON;
        exclusionReason =
          '외부 실시간 가격 수집 권한이 부여되지 않았습니다 (LIVE_COLLECTION_NOT_PERMITTED).';
      }

      // Search query construction: NEVER include '자급제' for carrier models
      let searchQuery = null;
      if (g.is_unlocked === true) {
        searchQuery = `${g.domestic_model_number} ${g.storage_gb}GB 자급제`;
      } else if (g.is_unlocked === false) {
        // Carrier-exclusive device-only purchase query
        searchQuery = null;
      }

      const collectionEligibility = {
        eligible: dataConsistencyEligible && sourcePermissionEligible,
        data_consistency: dataConsistencyEligible,
        source_permission: sourcePermissionEligible,
        reason_code: exclusionReasonCode,
        exclusion_reason: exclusionReason,
      };

      const priority = !dataConsistencyEligible
        ? 4
        : price_status === 'never_collected'
        ? 1
        : price_status === 'expired_only'
        ? 2
        : price_status === 'review_required'
        ? 3
        : 5;

      const { observations, ...rest } = g;

      return {
        ...rest,
        ram_gb: representativeRam,
        ram_configs: ramConfigs,
        ram_specific_queries: hasAmbiguousRam && dataConsistencyEligible ? ramConfigs.map(ram => ({ram_gb:ram, query:`${g.domestic_model_number} ${g.storage_gb}GB RAM ${ram}GB 자급제`, variant_ids:publicVariants.filter(v=>v.ram_gb===ram).map(v=>v.variant_id)})) : [],
        has_ambiguous_ram: hasAmbiguousRam,
        sku_verification_status: groupSkuStatus,
        status: price_status,
        price_status,
        observation_count: observations.length,
        active_variant_ids: [...new Set(active.map((p) => String(p.variant_id)))],
        data_consistency_eligible: dataConsistencyEligible,
        source_permission_eligible: sourcePermissionEligible,
        collection_eligible: dataConsistencyEligible,
        collection_eligibility: collectionEligibility,
        exclusion_reason: exclusionReason,
        query: hasAmbiguousRam ? null : searchQuery,
        search_query: hasAmbiguousRam ? null : searchQuery,
        carrier_pricing_mode: g.is_unlocked === false ? 'device_only' : 'unlocked_standalone',
        priority,
        unlocked_status:
          g.is_unlocked === true
            ? 'domestic_standalone_verified'
            : g.is_unlocked === false
            ? 'carrier_exclusive_not_unlocked'
            : 'review_required',
        note:
          g.is_unlocked === false
            ? '통신사 전용 모델: 이번 MVP 가격 수집 제외. 관리자 데이터는 보존.'
            : '검색만 색상 중복 제거. 저장 전 원래 variant_id·RAM·색상·자급제 매칭 필수. 다른 색상으로 가격 복사 금지.',
      };
    })
    .sort((a, b) => a.priority - b.priority || b.year.localeCompare(a.year) || a.key.localeCompare(b.key));
}

module.exports = { prepare, detectSalesChannel, assessVariantSkuStatus };

if (require.main === module) {
  const [input, asOf] = process.argv.slice(2);
  if (!input || !asOf) {
    throw new Error('Usage: node prepare-price-collection-targets.js snapshot.json ISO_AS_OF');
  }
  console.log(JSON.stringify(prepare({ ...JSON.parse(fs.readFileSync(input, 'utf8')), asOf }), null, 2));
}
