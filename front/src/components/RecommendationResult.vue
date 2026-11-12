<template>
  <section aria-label="추천 진행 및 결과" aria-live="polite" :aria-busy="loading">
    <!-- Skeleton Loading State (Prevents layout shift) -->
    <div v-if="loading" class="result-skeleton-wrap" role="status">
      <p class="skeleton-status-text">조건에 맞는 제품을 검토하고 있어요. 잠시 기다려 주세요.</p>
      <div class="recommendation-grid">
        <div v-for="n in 2" :key="'rec-skel-' + n" class="skeleton-result-card">
          <div class="skeleton-block skel-stage"></div>
          <div class="skeleton-block skel-line lg"></div>
          <div class="skeleton-block skel-line sm"></div>
          <div class="skel-stat-row">
            <div class="skeleton-block skel-stat"></div>
            <div class="skeleton-block skel-stat"></div>
            <div class="skeleton-block skel-stat"></div>
          </div>
          <div class="skeleton-block skel-price"></div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <v-alert v-else-if="error" type="error" variant="tonal" role="alert">{{ error }}</v-alert>

    <!-- Results -->
    <Transition name="reveal" appear>
      <div v-if="!loading && !error && result" class="result-content-wrap">
        <div class="result-header-band"><p v-if="result.validity_note">{{ result.validity_note }}</p>
          <h2 tabindex="-1">{{ result.status==='recommend' && result.items?.some(i=>i.comparison_with_owned) ? '교체 추천 · 확인된 개선 비교' : (titles[result.status] || '추천 응답을 확인해 주세요') }}</h2>
          <p v-if="result.status === 'no_match'" class="status-lead">
            현재 예산·필수 조건과 유효한 가격을 모두 충족하는 제품이 없어요. 조건은 자동으로 완화하지 않았습니다.
          </p>
          <p v-if="result.status === 'clarify'" class="status-lead">
            아래 내용을 참고해 조건을 구체화한 뒤 다시 요청해 주세요.
          </p>
          <p v-if="result.status === 'keep'" class="status-lead">
            현재 기기를 계속 사용하는 선택도 고려해 보세요.
          </p>
          <p v-if="result.status === 'defer'" class="status-lead">
            지금 바로 구매하기보다 추가 정보를 확인해 주세요.
          </p>
        </div>

        <div
          v-if="result.questions?.length || result.keep_reasons?.length || result.keep_cautions?.length"
          class="decision-notes-card"
        >
          <ul v-if="result.questions?.length" class="notes-list">
            <li v-for="(question, i) in result.questions" :key="'q-' + i">{{ question }}</li>
          </ul>
          <ul v-if="result.keep_reasons?.length" class="notes-list">
            <li v-for="(reason, i) in result.keep_reasons" :key="'kr-' + i">{{ text(reason) }}</li>
          </ul>
          <ul v-if="result.keep_cautions?.length" class="notes-list">
            <li v-for="(reason, i) in result.keep_cautions" :key="'kc-' + i">{{ text(reason) }}</li>
          </ul>
        </div>

        <!-- Product Spotlight Cards -->
        <div v-if="result.status === 'recommend'" class="recommendation-grid">
          <v-card v-for="(item, idx) in result.items || []" :key="item.variant_id" class="member-card result-card">
            <!-- Top Product Showcase Header -->
            <div class="product-stage-band">
              <span class="rank-pill">추천 0{{ idx + 1 }}</span>
              <svg viewBox="0 0 80 124" class="spotlight-phone-svg" aria-hidden="true">
                <rect x="6" y="4" width="68" height="116" rx="14" fill="#ffffff" stroke="#71717a" stroke-width="2" />
                <rect x="12" y="14" width="56" height="94" rx="7" fill="#f5f5f7" stroke="#d4d4d8" stroke-width="1.2" />
                <circle cx="40" cy="9" r="2" fill="#52525b" />
                <rect x="30" y="112" width="20" height="2.5" rx="1.25" fill="#a1a1aa" />
              </svg>
            </div>

            <div class="card-body-pad">
              <div class="model-head">
                <h3>{{ item.product?.model_name || '제품 정보 없음' }}</h3>
                <p class="model-number">{{ item.product?.domestic_model_number || '모델번호 정보 없음' }}</p>
              </div>

              <!-- Key Specs Stat Strip -->
              <dl class="spec-stat-grid">
                <div class="stat-tile">
                  <dt>저장 용량</dt>
                  <dd>{{ spec(item.product?.storage_gb, 'GB') }}</dd>
                </div>
                <div class="stat-tile">
                  <dt>RAM</dt>
                  <dd>{{ spec(item.product?.ram_gb, 'GB') }}</dd>
                </div>
                <div class="stat-tile">
                  <dt>색상</dt>
                  <dd>{{ item.product?.color || '정보 없음' }}</dd>
                </div>
              </dl>

              <!-- Price Block with Semantic Warnings Preserved -->
              <div class="price-block">
                <strong :class="['price-type-label', { verified: isVerifiedPrice(item.price) }]">
                  {{ priceLabel(item.price) }}
                </strong>
                <p class="price-amount">{{ money(priceAmount(item.price)) }}</p>
                <p v-if="development(item.price)" class="price-dev-notice">
                  실제 구매 가능 가격이 아닙니다. 배송비·재고·구매 조건은 확인이 필요합니다.
                </p>
                <p v-if="item.price?.warning" class="price-warning" role="note">{{ item.price.warning }}</p>
                <div class="price-meta-foot">
                  <p v-if="item.price?.source_name" class="price-source">출처: {{ item.price.source_name }}</p>
                  <small class="price-date">확인일: {{ date(item.price?.checked_at || item.price?.observed_at) }}</small>
                </div>
              </div>

              <section v-if="item.comparison_with_owned" class="reasons-section">
                <h4>현재 기기와 비교</h4>
                <p v-if="!item.comparison_with_owned.comparable">{{ item.comparison_with_owned.reason }}</p>
                <dl v-for="(value,key) in item.comparison_with_owned.fields" :key="key">
                  <dt>{{ comparisonLabels[key] || key }}</dt>
                  <dd v-if="value.status==='verified_comparison'">{{ value.current }} → {{ value.candidate }} {{ value.unit || '' }}</dd>
                  <dd v-else-if="key==='price' && value.candidate_total_krw != null">{{ value.candidate_total_krw.toLocaleString('ko-KR') }}원 · {{ value.development_only ? '개발용 가격, 실제 구매가 아님' : '검증 판매가' }}</dd>
                  <dd v-else>{{ value.note || '비교 불가: 검증된 자료 부족' }}<span v-if="key==='chipset'"> ({{ value.current || '정보 없음' }} → {{ value.candidate || '정보 없음' }})</span></dd>
                </dl>
                <ul><li v-for="note in [...(item.comparison_with_owned.improvements || []),...(item.comparison_with_owned.tradeoffs || []),...(item.comparison_with_owned.cautions || [])]" :key="note">{{ note }}</li></ul>
                <router-link :to="compareUrl(item)" class="compare-handoff-link">제품 사양 직접 비교</router-link>
              </section>
              <!-- Recommendation Reasons -->
              <div class="reasons-section">
                <h4>추천 근거</h4>
                <ul class="reasons-list">
                  <li v-for="(reason, i) in item.reasons || []" :key="'r-' + i">{{ text(reason) }}</li>
                </ul>
                <ul v-if="item.uncertainties?.length" class="uncertainties">
                  <li v-for="(note, i) in item.uncertainties" :key="'u-' + i">{{ note }}</li>
                </ul>
                <div v-if="!item.comparison_with_owned && item.variant_id" class="result-card-actions">
                  <router-link :to="compareUrl(item)" class="compare-handoff-link">이 제품 사양 직접 비교 →</router-link>
                </div>
              </div>
            </div>
          </v-card>
        </div>

        <p v-if="result.status === 'recommend' && !result.items?.length" class="empty-items-note">
          표시할 제품 정보가 없습니다. 잠시 후 다시 확인해 주세요.
        </p>
      </div>
    </Transition>
  </section>
</template>

<script setup>
const props = defineProps({ result: Object, loading: Boolean, error: String, ownedVariantId: [String, Number] })

function resolveOwnedVariantId() {
  const raw =
    props.ownedVariantId ||
    props.result?.owned_variant_id ||
    props.result?.input_snapshot?.owned_device_snapshot?.product?.variant_id
  return raw ? String(raw) : ''
}

function compareUrl(item) {
  const candidateId = item?.variant_id ? String(item.variant_id) : ''
  const ownedId = resolveOwnedVariantId()
  const ids = []
  if (ownedId && ownedId !== candidateId) ids.push(ownedId)
  if (candidateId) ids.push(candidateId)
  if (!ownedId && candidateId && Array.isArray(props.result?.items)) {
    const peer = props.result.items.find(other => other?.variant_id && String(other.variant_id) !== candidateId)
    if (peer?.variant_id) ids.push(String(peer.variant_id))
  }
  const params = new URLSearchParams()
  if (ids.length) params.set('variants', ids.join(','))
  if (ownedId) params.set('owned_variant_id', ownedId)
  if (candidateId) params.set('variant_id', candidateId)
  const qs = params.toString()
  return qs ? `/compare?${qs}` : '/compare'
}

const comparisonLabels={screen_inches:'화면 크기',refresh_hz:'주사율',storage_gb:'저장 용량',ram_gb:'RAM',weight_g:'무게',battery_mah:'배터리 용량',wireless_charging:'무선 충전',chipset:'칩셋',camera:'카메라',usage_performance:'용도별 성능',price:'구매 비용 (위 가격 안내 참고)'}
const titles = {
  recommend: '나에게 맞는 스마트폰 추천',
  no_match: '조건에 맞는 추천 결과가 없어요',
  clarify: '추천 조건을 더 알려 주세요',
  keep: '현재 기기를 유지해도 좋아요',
  defer: '구매를 잠시 보류해 보세요'
}

const text = x => typeof x === 'string' ? x : (x?.description || x?.message || '')
const spec = (value, unit) => value == null ? '정보 없음' : `${value}${unit}`
const valid = value => typeof value === 'number' && Number.isFinite(value) && value > 0
const money = value => valid(value) ? `${value.toLocaleString('ko-KR')}원` : '현재 판매가 정보 없음'
const development = p => p?.development_only === true || ['reference_sale', 'official_launch'].includes(p?.price_source)
const isVerifiedPrice = p => p?.price_source === 'verified_sale' && p?.purchase_verified === true && !development(p)

function priceAmount(p) {
  if (!p) return null
  if (development(p)) return valid(p.budget_basis_krw) ? p.budget_basis_krw : p.amount_krw
  return p.price_source === 'verified_sale' && p.purchase_verified === true ? p.total_krw : null
}

function priceLabel(p) {
  if (p?.price_source === 'official_launch') return '개발용 공식 출고가 기준 · 현재 판매가 아님'
  if (p?.price_source === 'reference_sale') return '개발용 참고 판매가 · 구매 조건 미검증'
  if (development(p)) return '개발용 가격 · 실제 판매가 아님'
  return p?.price_source === 'verified_sale' && p?.purchase_verified === true
    ? '검증된 판매가 · 배송비 포함'
    : '현재 판매가 정보 없음'
}

function date(value) {
  if (!value) return '정보 없음'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '정보 없음' : d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
}
</script>

<style scoped>
/* Skeleton Loading */
.result-skeleton-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-status-text {
  font-size: 14px;
  font-weight: 600;
  color: #52525b;
  margin: 0;
}

.skeleton-result-card {
  border: 1px solid #e5e5e7;
  border-radius: 18px;
  padding: 24px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.skel-stage {
  width: 100%;
  height: 132px;
}

.skel-line.lg {
  width: 65%;
  height: 22px;
}

.skel-line.sm {
  width: 38%;
  height: 14px;
}

.skel-stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.skel-stat {
  height: 54px;
}

.skel-price {
  width: 100%;
  height: 92px;
}

/* Header & Decision Notes */
.result-header-band h2 {
  font-size: clamp(24px, 3vw, 30px);
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #111111;
  margin-bottom: 10px;
  word-break: keep-all;
}

.result-header-band h2:focus {
  outline: none;
}

.status-lead {
  font-size: 15px;
  color: #52525b;
  margin-bottom: 20px;
  word-break: keep-all;
}

.decision-notes-card {
  background: #f5f5f7;
  border: 1px solid #e5e5e7;
  border-radius: 14px;
  padding: 20px 24px;
  margin-bottom: 24px;
}

.notes-list {
  padding-left: 18px;
  margin: 6px 0;
}

.notes-list li {
  font-size: 14px;
  color: #111111;
  line-height: 1.6;
  margin: 6px 0;
}

/* Product Cards Grid */
.recommendation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  gap: 24px;
  margin-top: 24px;
}

.result-card {
  min-width: 0;
  overflow-wrap: anywhere;
  margin: 0 !important;
  padding: 0 !important;
  background: #ffffff !important;
  border: 1px solid #e5e5e7 !important;
  border-radius: 18px !important;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.product-stage-band {
  background: #f5f5f7;
  padding: 24px 20px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  border-bottom: 1px solid #e5e5e7;
}

.rank-pill {
  position: absolute;
  top: 14px;
  left: 16px;
  font-size: 11px;
  font-weight: 700;
  color: #ffffff;
  background: #111111;
  padding: 3px 10px;
  border-radius: 9999px;
}

.spotlight-phone-svg {
  width: 66px;
  height: 102px;
}

.card-body-pad {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  flex: 1;
}

.model-head h3 {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: #111111;
  word-break: keep-all;
  margin-bottom: 4px;
}

.model-number {
  font-size: 12px;
  color: #71717a;
  margin: 0;
}

.spec-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.stat-tile {
  background: #f5f5f7;
  border-radius: 10px;
  padding: 10px 10px;
  text-align: center;
}

.stat-tile dt {
  font-size: 11px;
  color: #71717a;
  font-weight: 600;
  margin-bottom: 4px;
}

.stat-tile dd {
  margin: 0;
  font-size: 13px;
  font-weight: 750;
  color: #111111;
  word-break: break-word;
}

/* Price Block */
.price-block {
  padding: 16px;
  background: #fafafa;
  border: 1px solid #e5e5e7;
  border-radius: 12px;
}

.price-type-label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #b45309;
  line-height: 1.4;
  word-break: keep-all;
}

.price-type-label.verified {
  color: #176b50;
}

.price-amount {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.025em;
  margin: 6px 0;
  color: #111111;
  word-break: break-all;
}

.price-dev-notice {
  font-size: 12px;
  color: #52525b;
  margin: 6px 0;
  word-break: keep-all;
  line-height: 1.5;
}

.price-warning {
  margin: 10px 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
  word-break: keep-all;
}

.price-meta-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-top: 8px;
}

.price-source,
.price-date {
  font-size: 11px;
  color: #71717a;
  margin: 0;
}

/* Reasons */
.reasons-section h4 {
  font-size: 14px;
  font-weight: 750;
  color: #111111;
  margin: 0 0 8px;
}

.reasons-list {
  padding-left: 18px;
  margin: 0;
}

.reasons-list li {
  font-size: 13px;
  line-height: 1.6;
  color: #3f3f46;
  margin: 6px 0;
  word-break: keep-all;
}

.uncertainties {
  padding-left: 18px;
  margin: 10px 0 0;
  font-size: 12px;
  color: #71717a;
}

.result-card-actions {
  margin-top: 12px;
}

.compare-handoff-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #2563eb;
  text-decoration: none;
}

.compare-handoff-link:hover {
  text-decoration: underline;
}

.empty-items-note {
  font-size: 14px;
  color: #52525b;
  margin-top: 16px;
}

@media (max-width: 650px) {
  .price-amount {
    font-size: 20px;
  }

  .spec-stat-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
