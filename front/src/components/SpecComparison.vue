<template>
  <div class="apple-compare-root">
    <!-- 1. Compact Sticky Header (Always identifies slots while scrolling) -->
    <div class="sticky-compare-bar" role="region" aria-label="비교 중인 제품 고정 헤더">
      <div class="sticky-cols" :class="`cols-${slots.length}`">
        <div v-for="(product, i) in slots" :key="'sticky-' + i" class="sticky-col-item">
          <template v-if="product">
            <span class="sticky-model-name">{{ product.model_name }}</span>
            <button
              type="button"
              class="sticky-change-link"
              :aria-label="`${product.model_name} 기기 변경`"
              @click="$emit('change', i)"
            >
              변경
            </button>
          </template>
          <template v-else>
            <span class="sticky-empty-label">기기 {{ i + 1 }}</span>
            <button
              type="button"
              class="sticky-change-link"
              @click="$emit('select', i)"
            >
              선택
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- 2. Apple-Style Independent Vertical Product Columns (Hero Header Row) -->
    <div class="apple-columns-grid hero-row" :class="`cols-${slots.length}`">
      <div v-for="(product, i) in slots" :key="'hero-' + i" class="apple-hero-col">
        <div class="col-utility-row">
          <span v-if="product" class="brand-caption">
            {{ product.brand_name || (product.brand === 'samsung' ? '삼성전자' : product.brand === 'apple' ? 'Apple' : product.brand) }}
          </span>
          <span v-else class="brand-caption empty">기기 {{ i + 1 }}</span>

          <button
            v-if="product"
            type="button"
            class="col-remove-link"
            :aria-label="`${product.model_name} 비교에서 제거`"
            @click="$emit('remove', i)"
          >
            제거
          </button>
        </div>

        <Transition name="fade-slide" mode="out-in">
          <div v-if="product" :key="heroSlotKey(product, i)" class="hero-product-content">
            <!-- Visual Stage (Actual matched official render, teammate reference image, or category SVG placeholder) -->
            <div :class="['product-visual-pedestal', `pedestal-${category}`]">
              <img
                v-if="!failedImages[imageTrackKey(product)] && productImageUrl(product)"
                v-show="isLoaded(imageTrackKey(product))"
                :key="imageTrackKey(product)"
                :src="productImageUrl(product)"
                :alt="productImageAlt(product)"
                :data-image-scope="productImageScope(product)"
                :data-transparency="isTransparentOfficialRender(product) ? 'transparent' : 'opaque'"
                :class="[
                  'product-photo',
                  `photo-${category}`,
                  {
                    'is-transparent': isTransparentOfficialRender(product),
                    'is-portrait': isPortraitOfficialRender(product),
                    'is-reference': isModelReferenceImage(product)
                  }
                ]"
                @load="onImageLoad(imageTrackKey(product))"
                @error="onImageError(imageTrackKey(product))"
              />
              <div
                v-show="!loadedImages[imageTrackKey(product)] || failedImages[imageTrackKey(product)]"
                class="product-placeholder-graphic"
                role="img"
                :aria-label="`${product.model_name} 기기 플레이스홀더`"
              >
                <svg v-if="category === 'tablet'" viewBox="0 0 120 140" class="device-svg tablet-svg" aria-hidden="true">
                  <rect x="6" y="6" width="108" height="128" rx="14" fill="#ffffff" stroke="#71717a" stroke-width="2.2" />
                  <rect x="14" y="14" width="92" height="112" rx="8" fill="#f5f5f7" stroke="#d4d4d8" stroke-width="1.4" />
                  <circle cx="60" cy="10" r="2" fill="#52525b" />
                </svg>
                <svg v-else-if="category === 'smartwatch'" viewBox="0 0 90 140" class="device-svg watch-svg" aria-hidden="true">
                  <rect x="25" y="4" width="40" height="24" rx="4" fill="#d4d4d8" />
                  <rect x="25" y="112" width="40" height="24" rx="4" fill="#d4d4d8" />
                  <rect x="10" y="24" width="70" height="92" rx="20" fill="#ffffff" stroke="#71717a" stroke-width="2.2" />
                  <rect x="16" y="30" width="58" height="80" rx="14" fill="#f5f5f7" stroke="#d4d4d8" stroke-width="1.4" />
                  <circle cx="75" cy="54" r="3" fill="#71717a" />
                </svg>
                <svg v-else viewBox="0 0 80 140" class="device-svg phone-svg" aria-hidden="true">
                  <rect x="4" y="4" width="72" height="132" rx="16" fill="#ffffff" stroke="#71717a" stroke-width="2.2" />
                  <rect x="10" y="16" width="60" height="106" rx="8" fill="#f5f5f7" stroke="#d4d4d8" stroke-width="1.4" />
                  <circle cx="40" cy="10" r="2.2" fill="#52525b" />
                  <rect x="30" y="127" width="20" height="3" rx="1.5" fill="#a1a1aa" />
                </svg>
                <span class="placeholder-caption">이미지 준비 중</span>
              </div>
              <span
                v-if="isModelReferenceImage(product) && !failedImages[imageTrackKey(product)]"
                v-show="isLoaded(imageTrackKey(product))"
                class="reference-caption-pill"
              >
                대표 이미지 · 선택한 색상과 다를 수 있음
              </span>
            </div>

            <h2 class="hero-model-name">{{ product.model_name }}</h2>
            <p class="hero-model-sub">
              {{ product.domestic_model_number || '모델번호 없음' }}
              <template v-if="product.storage_gb || product.specs?.storage">
                · {{ product.storage_gb ? formatStorageLabel(product.storage_gb) : product.specs.storage }}
              </template>
              <template v-if="displayColor(product)">
                · {{ displayColor(product) }}
              </template>
            </p>

            <div
              v-if="category === 'smartphone' && (availableStorages(product).length > 0 || availableColors(product).length > 0)"
              class="variant-selectors-panel"
            >
              <div
                v-if="availableStorages(product).length > 0"
                class="variant-selector-group"
                role="group"
                :aria-label="`${product.model_name} 저장 용량 선택`"
              >
                <span class="variant-group-label">저장 용량</span>
                <div class="variant-chip-list">
                  <button
                    v-for="gb in availableStorages(product)"
                    :key="`storage-${gb}`"
                    type="button"
                    :class="[
                      'variant-pill-btn',
                      {
                        active: Number(product.storage_gb) === Number(gb),
                        'is-cross-option': displayColor(product) && !hasStorageAndColor(product, gb, product.color)
                      }
                    ]"
                    :title="displayColor(product) && !hasStorageAndColor(product, gb, product.color) ? `${formatStorageLabel(gb)}는 현재 색상과 함께 제공되지 않아 지원 색상으로 전환됩니다` : undefined"
                    :aria-pressed="Number(product.storage_gb) === Number(gb)"
                    @click="onSelectStorage(i, product, gb)"
                  >
                    {{ formatStorageLabel(gb) }}
                  </button>
                </div>
              </div>

              <div
                v-if="availableColors(product).length > 0"
                class="variant-selector-group"
                role="group"
                :aria-label="`${product.model_name} 색상 선택`"
              >
                <span class="variant-group-label">색상</span>
                <div class="variant-chip-list">
                  <button
                    v-for="color in availableColors(product)"
                    :key="`color-${color}`"
                    type="button"
                    :class="[
                      'variant-pill-btn',
                      {
                        active: normalizeColorKey(product.color) === normalizeColorKey(color),
                        'is-cross-option': product.storage_gb && !hasStorageAndColor(product, product.storage_gb, color)
                      }
                    ]"
                    :title="product.storage_gb && !hasStorageAndColor(product, product.storage_gb, color) ? `${color} 색상은 현재 용량에서 제공되지 않아 지원 용량으로 전환됩니다` : undefined"
                    :aria-pressed="normalizeColorKey(product.color) === normalizeColorKey(color)"
                    @click="onSelectColor(i, product, color)"
                  >
                    {{ color }}
                  </button>
                </div>
              </div>
            </div>

            <div class="hero-price-box">
              <strong class="hero-price-main">
                {{ category === 'smartphone' ? formatPriceShort(product) : formatSupplementalPriceShort(product) }}
              </strong>
              <span :class="['hero-price-note', { warn: isDevOrRefPrice(product) }]">
                {{ category === 'smartphone' ? formatPriceNoteShort(product) : '출고가 · 조원 참고' }}
              </span>
              <a
                v-if="category === 'smartphone' && getDanawaUrl(product)"
                :href="getDanawaUrl(product)"
                target="_blank"
                rel="noopener noreferrer"
                class="spec-external-link hero-danawa-link"
              >
                다나와 상품 보기
              </a>
              <small v-if="category === 'smartphone' && product.seller_price_summary?.lowest">
                지정 판매처 중 최저가: {{ Number(product.seller_price_summary.lowest.total_krw).toLocaleString('ko-KR') }}원 (배송비 포함)
                · {{ product.seller_price_summary.lowest.seller_name }}
              </small>
              <details v-if="category === 'smartphone' && product.seller_price_summary">
                <summary>판매처별 조회 가격 · 구매 조건 확인 필요</summary>
                <ul>
                  <li v-for="offer in product.latest_prices_by_seller" :key="offer.observation_id">
                    {{ offer.seller_name }}:
                    <template v-if="offer.is_expired">가격 만료</template>
                    <template v-else>
                      {{ Number(offer.amount_krw).toLocaleString('ko-KR') }}원
                      · {{ offer.shipping_krw == null ? '배송비 미확인' : `배송비 ${Number(offer.shipping_krw).toLocaleString('ko-KR')}원` }}
                      · {{ offer.eligible ? '구매 조건 확인 가격' : '참고 가격 · 조건 미확인' }}
                    </template>
                    <small> · {{ offer.observed_at }}</small>
                    <a v-if="offer.danawa_product_url" :href="offer.danawa_product_url" target="_blank" rel="noopener noreferrer">다나와에서 조건 확인</a>
                  </li>
                </ul>
                <p v-for="seller in product.seller_price_summary.sellers.filter(s => s.status === 'unknown')" :key="seller.seller_key">
                  {{ seller.seller_name }}: 가격 미확인
                </p>
                <small>조회 시점의 참고 정보이며 실제 결제금액은 달라질 수 있습니다.</small>
              </details>
            </div>

            <button type="button" class="hero-change-btn" @click="$emit('change', i)">
              기기 변경
            </button>
          </div>

          <div v-else key="empty" class="hero-empty-content">
            <button type="button" :class="['empty-visual-pedestal', `pedestal-${category}`]" @click="$emit('select', i)">
              <v-icon icon="mdi-plus" size="30" />
              <span>비교할 기기 선택</span>
            </button>
            <h2 class="hero-model-name muted">선택된 기기 없음</h2>
            <p class="hero-model-sub">비교할 {{ categoryLabel }}을 추가하세요</p>
            <button type="button" class="hero-select-btn" @click="$emit('select', i)">
              기기 선택
            </button>
          </div>
        </Transition>
      </div>
    </div>

    <div class="apple-section-divider" aria-hidden="true"></div>

    <!-- 3. Apple-Style Icon + Core Metric Vertical Spec Comparison (No HTML table, no left label column) -->
    <section class="visual-specs-area" :aria-label="`${categoryLabel} 핵심 사양 시각적 비교`">
      <div v-if="!visibleVisualSpecs.length" class="no-diff-notice">
        선택한 기기 간 차이가 있는 핵심 사양이 없습니다.
      </div>

      <div
        v-else
        class="apple-columns-grid specs-matrix"
        :class="`cols-${slots.length}`"
      >
        <template v-for="specItem in visibleVisualSpecs" :key="specItem.key">
          <div
            v-for="(product, i) in slots"
            :key="`${specItem.key}-col-${i}`"
            class="visual-spec-block"
          >
            <template v-if="product">
              <div class="spec-icon-holder" aria-hidden="true">
                <v-icon :icon="specItem.icon" size="26" />
              </div>
              <strong :class="['spec-headline-val', { 'is-unknown': isUnknown(specItem.value(product)) }]">
                {{ specItem.value(product) }}
              </strong>
              <span class="spec-sub-caption">{{ specItem.caption(product) }}</span>
            </template>
            <template v-else>
              <span class="cell-empty" aria-hidden="true">—</span>
            </template>
          </div>
        </template>
      </div>
    </section>

    <!-- 4. Progressive Disclosure Accordion Button for Detailed Spec Table -->
    <div class="detailed-toggle-wrap">
      <button
        type="button"
        class="detail-accordion-btn"
        :aria-expanded="detailsExpanded"
        aria-controls="detailed-spec-panel"
        @click="detailsExpanded = !detailsExpanded"
      >
        <span>{{ detailsExpanded ? '상세 사양표 접기' : '상세 사양표 모두 보기' }}</span>
        <span class="btn-meta">({{ currentCategories.length }}개 영역)</span>
        <span class="btn-arrow" aria-hidden="true">{{ detailsExpanded ? '⌃' : '⌄' }}</span>
      </button>
    </div>

    <!-- 5. Existing Full Detailed Spec Table (Collapsed by default, synchronized with slots & showDiffOnly) -->
    <div
      id="detailed-spec-panel"
      :class="['detailed-panel', { 'is-open': detailsExpanded }]"
      :aria-hidden="!detailsExpanded"
      :inert="!detailsExpanded"
    >
      <div class="detailed-panel-inner">
        <div class="comparison-scroll" role="region" aria-label="기기 상세 사양 비교표" tabindex="0">
          <table :class="['comparison-table', { 'cols-3': slots.length === 3 }]">
            <caption class="sr-only">기기 간 상세 사양 및 가격 비교표. 값 다름 표시는 차이 안내이며 우열을 의미하지 않습니다.</caption>
            <thead>
              <tr>
                <th scope="col" class="corner-head">
                  <span class="corner-label">{{ categoryBadge }}</span>
                  <strong>세부 비교 항목</strong>
                </th>
                <th v-for="(product, i) in slots" :key="'th-' + i" scope="col" class="table-col-head">
                  {{ product ? product.model_name : `기기 ${i + 1} 미선택` }}
                </th>
              </tr>
            </thead>

            <tbody>
              <template v-for="catGroup in visibleCategories" :key="catGroup.name">
                <tr class="category-header-row">
                  <th :colspan="slots.length + 1" scope="colgroup">
                    <span class="category-title">{{ catGroup.name }}</span>
                  </th>
                </tr>

                <tr
                  v-for="field in catGroup.fields"
                  :key="field.key"
                  :class="{ 'spec-difference': differs(field) }"
                >
                  <th scope="row" class="spec-label-cell">
                    <div class="spec-label-wrap">
                      <span class="spec-label-text">{{ field.label }}</span>
                      <span v-if="differs(field)" class="difference-label">값 다름</span>
                    </div>
                  </th>
                  <td v-for="(product, i) in slots" :key="'td-' + field.key + '-' + i" class="spec-value-cell">
                    <template v-if="product">
                      <div class="spec-value-wrap">
                        <a
                          v-if="field.href && field.href(product)"
                          :href="field.href(product)"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="spec-external-link"
                        >
                          {{ field.format(product) }}
                        </a>
                        <span v-else :class="{ 'is-unknown': isUnknown(field.format(product)) }">
                          {{ field.format(product) }}
                        </span>
                      </div>
                    </template>
                    <template v-else>
                      <div class="spec-value-wrap">
                        <span class="cell-empty">-</span>
                      </div>
                    </template>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import {
  resolveDeviceImage,
  isOfficialRender,
  isModelReferenceImage,
  isTransparentOfficialRender,
  isPortraitOfficialRender,
  getAvailableVariantsForProduct,
  normalizeColorKey
} from '../utils/deviceImages.js'
import {
  isReferenceOrDevPrice,
  formatPriceAmount as formatPolicyPriceAmount,
  formatPriceTypeLabel as formatPolicyPriceTypeLabel,
  formatPriceNotice as formatPolicyPriceNotice,
  getDanawaProductUrl,
  formatPriceCheckedAt
} from '../utils/priceDisplay.js'

const props = defineProps({
  products: { type: Array, default: () => [] },
  catalog: { type: Array, default: () => [] },
  count: { type: Number, default: 2 },
  showDiffOnly: { type: Boolean, default: false },
  category: { type: String, default: 'smartphone' },
  defaultExpanded: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'remove', 'change', 'select-variant'])

const detailsExpanded = ref(props.defaultExpanded)
const failedImages = reactive({})
const loadedImages = reactive({})

const slots = computed(() => {
  const targetLen = Math.min(3, Math.max(2, props.count))
  return Array.from({ length: targetLen }, (_, i) => props.products[i] || null)
})

const selectedProducts = computed(() => slots.value.filter(p => !!p))

const categoryLabel = computed(() => {
  if (props.category === 'tablet') return '태블릿'
  if (props.category === 'smartwatch') return '스마트워치'
  return '스마트폰'
})

const categoryBadge = computed(() => `${categoryLabel.value} 비교`)

function isLoaded(key) {
  if (typeof window === 'undefined') return true
  if (!key || key === 'no-image') return false
  return Boolean(loadedImages[key])
}

function productImageUrl(product) {
  return resolveDeviceImage(product)
}

function heroSlotKey(p, i) {
  return `${props.category}-${p.smartphone_id || p.id || p.model_name}-${i}`
}

function imageTrackKey(p) {
  return productImageUrl(p) || 'no-image'
}

function productImageAlt(product) {
  if (isOfficialRender(product)) {
    return displayColor(product)
      ? `${product.model_name} (${displayColor(product)}) 제조사 공식 제품 이미지`
      : `${product.model_name} 제조사 공식 제품 이미지`
  }
  return isModelReferenceImage(product) ? `${product.model_name} 대표 모델 사진` : product.model_name
}

function productImageScope(product) {
  if (isOfficialRender(product)) return 'official-render-variant'
  return isModelReferenceImage(product) ? 'model-reference' : 'variant'
}

function displayColor(product) {
  if (!product || !product.color || typeof product.color !== 'string') return ''
  const trimmed = product.color.trim()
  const lower = trimmed.toLowerCase()
  if (!trimmed || lower === 'unspecified' || trimmed === '미정') return ''
  return trimmed
}

function formatStorageLabel(gb) {
  const n = Number(gb)
  if (!Number.isFinite(n) || n <= 0) return '정보 없음'
  if (n >= 1024 && n % 1024 === 0) return `${n / 1024}TB`
  return `${n}GB`
}

function modelVariantsFor(product) {
  return getAvailableVariantsForProduct(product, props.catalog)
}

function availableStorages(product) {
  const variants = modelVariantsFor(product)
  const set = new Set()
  for (const v of variants) {
    const gb = Number(v.storage_gb)
    if (Number.isFinite(gb) && gb > 0) set.add(gb)
  }
  if (set.size === 0 && Number(product?.storage_gb) > 0) {
    set.add(Number(product.storage_gb))
  }
  return [...set].sort((a, b) => a - b)
}

function availableColors(product) {
  const variants = modelVariantsFor(product)
  const colorMap = new Map()
  for (const v of variants) {
    const label = displayColor(v)
    if (!label) continue
    const key = normalizeColorKey(label)
    if (key && !colorMap.has(key)) colorMap.set(key, label)
  }
  if (colorMap.size === 0) {
    const selfColor = displayColor(product)
    if (selfColor) colorMap.set(normalizeColorKey(selfColor), selfColor)
  }
  return [...colorMap.values()].sort((a, b) => a.localeCompare(b, 'ko'))
}

function findVariantForStorageAndColor(product, storageGb, color) {
  const variants = modelVariantsFor(product)
  const targetStorage = Number(storageGb)
  const targetColorKey = normalizeColorKey(color)
  return variants.find(v => {
    const sameStorage = Number(v.storage_gb) === targetStorage
    if (!targetColorKey) return sameStorage
    return sameStorage && normalizeColorKey(v.color) === targetColorKey
  }) || null
}

function hasStorageAndColor(product, storageGb, color) {
  return Boolean(findVariantForStorageAndColor(product, storageGb, color))
}

function onSelectStorage(slotIndex, product, targetStorageGb) {
  const variants = modelVariantsFor(product)
  if (!variants.length) return
  const targetStorage = Number(targetStorageGb)
  const exact = displayColor(product)
    ? findVariantForStorageAndColor(product, targetStorage, product.color)
    : null
  const match = exact || variants.find(v => Number(v.storage_gb) === targetStorage)
  if (!match) return
  if (String(match.variant_id || '') === String(product.variant_id || '')) return
  emit('select-variant', slotIndex, match)
}

function onSelectColor(slotIndex, product, targetColor) {
  const variants = modelVariantsFor(product)
  if (!variants.length) return
  const exact = product.storage_gb
    ? findVariantForStorageAndColor(product, product.storage_gb, targetColor)
    : null
  let match = exact
  if (!match) {
    const targetColorKey = normalizeColorKey(targetColor)
    const colorMatches = variants.filter(v => normalizeColorKey(v.color) === targetColorKey)
    if (colorMatches.length) {
      const currentStorage = Number(product.storage_gb || 0)
      match = [...colorMatches].sort((a, b) => {
        const da = Math.abs(Number(a.storage_gb || 0) - currentStorage)
        const db = Math.abs(Number(b.storage_gb || 0) - currentStorage)
        if (da !== db) return da - db
        return Number(a.storage_gb || 0) - Number(b.storage_gb || 0)
      })[0]
    }
  }
  if (!match) return
  if (String(match.variant_id || '') === String(product.variant_id || '')) return
  emit('select-variant', slotIndex, match)
}

function onImageLoad(key) {
  if (key && key !== 'no-image') loadedImages[key] = true
}

function onImageError(key) {
  if (key && key !== 'no-image') failedImages[key] = true
}

function isUnknown(val) {
  return val === '정보 없음' || val === '가격 정보 없음' || val === null || val === undefined
}

// Price Helpers (shared with recommendation & upgrade screens via utils/priceDisplay.js)
function formatPriceShort(p) {
  if (!p || !p.price) return '가격 정보 없음'
  return formatPolicyPriceAmount(p.price, { emptyText: '가격 정보 없음', includeTag: false })
}

function isDevOrRefPrice(p) {
  if (!p || !p.price) return false
  return isReferenceOrDevPrice(p.price)
}

function formatPriceNoteShort(p) {
  if (!p || !p.price) return '현재 판매가 미확인'
  return formatPolicyPriceTypeLabel(p.price, { emptyText: '가격 정보 미확인' })
}

function formatSupplementalPriceShort(p) {
  if (!p || !p.launch_price_krw) return '가격 정보 없음'
  return `${Number(p.launch_price_krw).toLocaleString('ko-KR')}원`
}

// Smartphone Full Price Helpers (for Detailed Table)
function formatPriceAmount(p) {
  if (!p || !p.price) return '가격 정보 없음'
  return formatPolicyPriceAmount(p.price, { emptyText: '가격 정보 없음', includeTag: true })
}

function formatPriceType(p) {
  if (!p || !p.price) return '가격 정보 없음'
  return formatPolicyPriceTypeLabel(p.price, { emptyText: '가격 정보 없음' })
}

function formatPriceDate(p) {
  if (!p || !p.price) return '정보 없음'
  return formatPriceCheckedAt(p.price)
}

function formatPriceNotice(p) {
  if (!p || !p.price) return '구매 조건 확인 필요'
  return formatPolicyPriceNotice(p.price)
}

function getDanawaUrl(p) {
  return p && p.price ? getDanawaProductUrl(p.price) : null
}

function formatSupplementalPrice(p) {
  if (!p || !p.launch_price_krw) return '가격 정보 없음'
  return `${Number(p.launch_price_krw).toLocaleString('ko-KR')}원 (출고가 · 조원 참고)`
}

function formatOfficialLaunchPrice(p) {
  if (!p || !p.launch_price_krw) return '정보 없음'
  if (p.launch_price_metadata_json?.status !== 'approved') return '정보 없음'
  return `${Number(p.launch_price_krw).toLocaleString('ko-KR')}원 (공식 출고가)`
}

function detailsOf(p) {
  return p && p.details_json && typeof p.details_json === 'object' ? p.details_json : {}
}

function firstDefined(...vals) {
  for (const v of vals) {
    if (v !== null && v !== undefined && v !== '') return v
  }
  return null
}

function screenInchesVal(p) {
  const v = firstDefined(p?.screen_inches, detailsOf(p).main_display_inches)
  return v !== null ? Number(v) : null
}

function refreshHzVal(p) {
  const v = firstDefined(p?.refresh_hz, detailsOf(p).refresh_hz)
  return v !== null ? Number(v) : null
}

function chipsetVal(p) {
  return firstDefined(p?.chipset, detailsOf(p).chipset)
}

function batteryMahVal(p) {
  const v = firstDefined(p?.battery_mah, detailsOf(p).battery_typical_mah)
  return v !== null ? Number(v) : null
}

function weightGVal(p) {
  const v = firstDefined(p?.weight_g, detailsOf(p).weight_g)
  return v !== null ? Number(v) : null
}

function supports5gVal(p) {
  const v = firstDefined(p?.supports_5g, detailsOf(p).supports_5g)
  return typeof v === 'boolean' ? v : null
}

function wirelessChargingVal(p) {
  const v = firstDefined(p?.wireless_charging, detailsOf(p).wireless_charging)
  return typeof v === 'boolean' ? v : null
}

function formatBool(v, trueText = '지원', falseText = '미지원') {
  if (v === true) return trueText
  if (v === false) return falseText
  return '정보 없음'
}

function formatResolution(px) {
  if (!Array.isArray(px) || px.length < 2) return '정보 없음'
  const w = Number(px[0])
  const h = Number(px[1])
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return '정보 없음'
  return `${w} × ${h} px`
}

function formatDimensionsMm(arr) {
  if (!Array.isArray(arr) || arr.length !== 3) return null
  if (!arr.every(n => Number.isFinite(Number(n)) && Number(n) > 0)) return null
  return `${arr[0]} × ${arr[1]} × ${arr[2]} mm`
}

function formatDimensionsAll(d) {
  const unfolded = formatDimensionsMm(d?.dimensions_unfolded_h_w_d_mm)
  const folded = formatDimensionsMm(d?.dimensions_folded_h_w_d_mm)
  if (unfolded && folded) return `펼침 ${unfolded} / 접힘 ${folded}`
  if (unfolded) return unfolded
  if (folded) return `접힘 ${folded}`
  return '정보 없음'
}

function formatBrightness(nits, mode) {
  if (!nits || !Number.isFinite(Number(nits))) return '정보 없음'
  const base = `${Number(nits).toLocaleString('ko-KR')} nits`
  if (mode && typeof mode === 'string' && mode !== 'maximum unspecified mode') {
    return `${base} (${mode})`
  }
  return base
}

function formatCoverDisplay(d) {
  if (!d) return '정보 없음'
  const parts = []
  if (d.cover_display_inches) parts.push(`${d.cover_display_inches}인치`)
  const res = formatResolution(d.cover_resolution_px)
  if (res !== '정보 없음') parts.push(res)
  if (d.cover_refresh_hz) parts.push(`${d.cover_refresh_hz}Hz`)
  return parts.length ? parts.join(' · ') : '정보 없음'
}

function formatTelephoto(d) {
  if (!d) return '정보 없음'
  if (Array.isArray(d.telephoto_cameras) && d.telephoto_cameras.length) {
    const items = d.telephoto_cameras
      .map(cam => {
        if (!cam || typeof cam !== 'object') return null
        const parts = []
        if (cam.mp) parts.push(`${cam.mp}MP`)
        if (cam.optical_zoom_x) parts.push(`(광학 ${cam.optical_zoom_x}배)`)
        return parts.join(' ') || null
      })
      .filter(Boolean)
    if (items.length) return items.join(', ')
  }
  if (d.optical_zoom) return `광학 ${d.optical_zoom}배`
  if (d.optical_quality_zoom) return `광학급 ${d.optical_quality_zoom}배`
  return '정보 없음'
}

function formatFrontCamera(d) {
  if (!d) return '정보 없음'
  const parts = []
  if (d.front_camera_mp) {
    parts.push(d.inner_front_camera_mp ? `커버 ${d.front_camera_mp}MP` : `${d.front_camera_mp}MP`)
  }
  if (d.inner_front_camera_mp) {
    parts.push(`내부 ${d.inner_front_camera_mp}MP`)
  }
  return parts.length ? parts.join(' · ') : '정보 없음'
}

function formatCameraSummary(d) {
  if (!d) return '카메라 상세 정보'
  const parts = []
  if (d.ultrawide_camera_mp) parts.push(`초광각 ${d.ultrawide_camera_mp}MP`)
  const tele = formatTelephoto(d)
  if (tele !== '정보 없음') parts.push(`망원 ${tele}`)
  if (d.front_camera_mp) parts.push(`전면 ${d.front_camera_mp}MP`)
  return parts.length ? parts.join(' · ') : '후면 카메라'
}

function formatUpdateSupport(d) {
  if (!d) return '정보 없음'
  const parts = []
  if (d.os_update_generations) parts.push(`OS ${d.os_update_generations}세대`)
  if (d.security_update_years) parts.push(`보안 ${d.security_update_years}년`)
  return parts.length ? parts.join(' · ') : '정보 없음'
}

function formatWifi(val) {
  if (!val) return '정보 없음'
  const s = String(val).trim()
  return /^wi-?fi/i.test(s) ? s : `Wi-Fi ${s}`
}

function formatBluetooth(val) {
  if (!val) return '정보 없음'
  const s = String(val).trim()
  return /^bluetooth/i.test(s) ? s : `Bluetooth ${s}`
}

function safeHttpsUrl(url) {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : null
}

// =========================================================================
// Apple-Style Visual Spec Items per Category (Icon + Core Number + Subtext)
// =========================================================================
const smartphoneVisualSpecs = [
  {
    key: 'display',
    icon: 'mdi-cellphone',
    value: p => screenInchesVal(p) ? `${screenInchesVal(p)}인치` : '정보 없음',
    caption: p => {
      const d = detailsOf(p)
      const hz = refreshHzVal(p)
      const parts = []
      if (d.display_type) parts.push(d.display_type)
      if (hz) parts.push(`${hz}Hz`)
      return parts.join(' · ') || '화면 주사율 정보 없음'
    }
  },
  {
    key: 'processor',
    icon: 'mdi-cpu-64-bit',
    value: p => chipsetVal(p) || '정보 없음',
    caption: p => {
      const d = detailsOf(p)
      const osText = p.os === 'ios' ? 'iOS' : p.os === 'android' ? 'Android' : p.os
      if (osText && d.os_at_launch) return `${osText} · 출시 ${d.os_at_launch}`
      return osText ? `${osText} · 칩셋` : '프로세서'
    }
  },
  {
    key: 'camera',
    icon: 'mdi-camera-outline',
    value: p => detailsOf(p).main_camera_mp ? `메인 ${detailsOf(p).main_camera_mp}MP` : '정보 없음',
    caption: p => formatCameraSummary(detailsOf(p))
  },
  {
    key: 'memory',
    icon: 'mdi-memory',
    value: p => p.ram_gb ? `${p.ram_gb}GB` : '정보 없음',
    caption: () => 'RAM'
  },
  {
    key: 'storage',
    icon: 'mdi-sd',
    value: p => p.storage_gb ? formatStorageLabel(p.storage_gb) : '정보 없음',
    caption: p => displayColor(p) ? `저장 용량 · ${displayColor(p)}` : '저장 용량'
  },
  {
    key: 'battery',
    icon: 'mdi-battery-high',
    value: p => batteryMahVal(p) ? `${batteryMahVal(p).toLocaleString('ko-KR')}mAh` : '정보 없음',
    caption: p => {
      const d = detailsOf(p)
      const parts = []
      if (d.wired_charging_w) parts.push(`유선 ${d.wired_charging_w}W`)
      const wc = wirelessChargingVal(p)
      if (wc === true) parts.push('무선 충전')
      else if (wc === false) parts.push('무선 충전 미지원')
      return parts.join(' · ') || '배터리 및 충전'
    }
  },
  {
    key: 'network',
    icon: 'mdi-signal-5g',
    value: p => {
      const v = supports5gVal(p)
      return v === true ? '5G 지원' : v === false ? 'LTE' : '정보 없음'
    },
    caption: p => {
      const d = detailsOf(p)
      const parts = []
      if (d.wifi) parts.push(formatWifi(d.wifi))
      if (d.ip_rating) parts.push(d.ip_rating)
      return parts.join(' · ') || '모바일 네트워크'
    }
  },
  {
    key: 'weight',
    icon: 'mdi-scale-balance',
    value: p => weightGVal(p) ? `${weightGVal(p)}g` : '정보 없음',
    caption: p => p.released_on_kr ? `국내 출시 ${p.released_on_kr}` : '무게 및 출시일'
  }
]

const tabletVisualSpecs = [
  {
    key: 'display',
    icon: 'mdi-tablet',
    value: p => p.specs?.display || '정보 없음',
    caption: p => [p.specs?.resolution, p.specs?.refresh_rate].filter(Boolean).join(' · ') || '디스플레이'
  },
  {
    key: 'processor',
    icon: 'mdi-cpu-64-bit',
    value: p => p.specs?.processor || '정보 없음',
    caption: p => p.specs?.os || '프로세서 · OS'
  },
  {
    key: 'memory',
    icon: 'mdi-memory',
    value: p => p.specs?.storage || '정보 없음',
    caption: p => p.specs?.memory ? `RAM ${p.specs.memory}` : '저장 용량 · 메모리'
  },
  {
    key: 'battery',
    icon: 'mdi-battery-high',
    value: p => p.specs?.battery || '정보 없음',
    caption: () => '배터리 용량'
  },
  {
    key: 'camera',
    icon: 'mdi-camera-outline',
    value: p => p.specs?.camera || '정보 없음',
    caption: () => '카메라 사양'
  },
  {
    key: 'weight',
    icon: 'mdi-scale-balance',
    value: p => p.specs?.weight || '정보 없음',
    caption: p => p.specs?.dimensions || '무게 및 크기'
  }
]

const smartwatchVisualSpecs = [
  {
    key: 'display',
    icon: 'mdi-watch',
    value: p => p.specs?.display || '정보 없음',
    caption: p => [p.specs?.resolution, p.specs?.refresh_rate].filter(Boolean).join(' · ') || '디스플레이'
  },
  {
    key: 'processor',
    icon: 'mdi-cpu-64-bit',
    value: p => p.specs?.processor || '정보 없음',
    caption: p => p.specs?.os || '프로세서 · OS'
  },
  {
    key: 'memory',
    icon: 'mdi-memory',
    value: p => p.specs?.storage || '정보 없음',
    caption: p => p.specs?.memory ? `RAM ${p.specs.memory}` : '메모리 · 저장 용량'
  },
  {
    key: 'battery',
    icon: 'mdi-battery-high',
    value: p => p.specs?.battery || '정보 없음',
    caption: () => '배터리 및 사용 시간'
  },
  {
    key: 'dimensions',
    icon: 'mdi-ruler',
    value: p => p.specs?.weight || '정보 없음',
    caption: p => p.specs?.dimensions || '무게 및 규격'
  },
  {
    key: 'connectivity',
    icon: 'mdi-wifi',
    value: p => p.specs?.connectivity || '정보 없음',
    caption: () => '연결성 · GPS'
  }
]

const currentVisualSpecs = computed(() => {
  if (props.category === 'tablet') return tabletVisualSpecs
  if (props.category === 'smartwatch') return smartwatchVisualSpecs
  return smartphoneVisualSpecs
})

function visualSpecDiffers(item) {
  if (selectedProducts.value.length < 2) return false
  const vals = selectedProducts.value.map(p => `${item.value(p)}|${item.caption(p)}`)
  return new Set(vals).size > 1
}

const visibleVisualSpecs = computed(() => {
  if (!props.showDiffOnly) return currentVisualSpecs.value
  return currentVisualSpecs.value.filter(item => visualSpecDiffers(item))
})

// =========================================================================
// Detailed Categories (Preserved 100% for Expandable Table)
// =========================================================================
const smartphoneCategories = [
  {
    name: '기본 정보',
    fields: [
      { key: 'brand', label: '제조사', format: p => p.brand === 'samsung' ? '삼성전자' : p.brand === 'apple' ? 'Apple' : p.brand || '정보 없음' },
      { key: 'model_name', label: '모델명', format: p => p.model_name || '정보 없음' },
      { key: 'domestic_model_number', label: '국내 모델번호', format: p => p.domestic_model_number || '정보 없음' },
      { key: 'released_on_kr', label: '국내 출시일', format: p => p.released_on_kr || '정보 없음' },
      { key: 'os', label: '운영체제', format: p => p.os === 'ios' ? 'iOS' : p.os === 'android' ? 'Android' : p.os || '정보 없음' },
      { key: 'os_at_launch', label: '출시 당시 OS', format: p => detailsOf(p).os_at_launch || '정보 없음' },
      { key: 'software_updates', label: 'OS·보안 업데이트', format: p => formatUpdateSupport(detailsOf(p)) },
      { key: 'color', label: '색상', format: p => displayColor(p) || '정보 없음' },
      {
        key: 'official_product_url',
        label: '공식 제품 페이지',
        href: p => safeHttpsUrl(p.official_product_url),
        format: p => safeHttpsUrl(p.official_product_url) ? '공식 페이지 보기 ↗' : '정보 없음'
      }
    ]
  },
  {
    name: '디스플레이',
    fields: [
      { key: 'screen_inches', label: '메인 화면 크기', format: p => screenInchesVal(p) ? `${screenInchesVal(p)}인치` : '정보 없음' },
      { key: 'panel_type', label: '패널 종류', format: p => detailsOf(p).display_type || '정보 없음' },
      { key: 'resolution', label: '해상도', format: p => formatResolution(detailsOf(p).main_resolution_px) },
      { key: 'refresh_hz', label: '화면 주사율', format: p => refreshHzVal(p) ? `${refreshHzVal(p)}Hz` : '정보 없음' },
      { key: 'brightness', label: '최대 밝기', format: p => formatBrightness(detailsOf(p).brightness_nits, detailsOf(p).brightness_mode) },
      { key: 'cover_display', label: '커버 디스플레이', format: p => formatCoverDisplay(detailsOf(p)) }
    ]
  },
  {
    name: '성능 및 메모리',
    fields: [
      { key: 'chipset', label: '프로세서 (AP)', format: p => chipsetVal(p) || '정보 없음' },
      { key: 'ram_gb', label: 'RAM', format: p => p.ram_gb ? `${p.ram_gb}GB` : '정보 없음' },
      { key: 'storage_gb', label: '저장 용량', format: p => p.storage_gb ? formatStorageLabel(p.storage_gb) : '정보 없음' }
    ]
  },
  {
    name: '카메라',
    fields: [
      { key: 'rear_camera', label: '후면 메인 카메라', format: p => detailsOf(p).main_camera_mp ? `${detailsOf(p).main_camera_mp}MP` : '정보 없음' },
      { key: 'ultrawide_camera', label: '후면 초광각 카메라', format: p => detailsOf(p).ultrawide_camera_mp ? `${detailsOf(p).ultrawide_camera_mp}MP` : '정보 없음' },
      { key: 'telephoto_camera', label: '후면 망원 카메라', format: p => formatTelephoto(detailsOf(p)) },
      { key: 'front_camera', label: '전면 카메라', format: p => formatFrontCamera(detailsOf(p)) }
    ]
  },
  {
    name: '배터리 및 충전',
    fields: [
      { key: 'battery_mah', label: '배터리 용량', format: p => batteryMahVal(p) ? `${batteryMahVal(p).toLocaleString('ko-KR')}mAh` : '정보 없음' },
      { key: 'wired_charging', label: '고속 유선 충전 규격', format: p => detailsOf(p).wired_charging_w ? `최대 ${detailsOf(p).wired_charging_w}W` : '정보 없음' },
      { key: 'wireless_charging', label: '무선 충전', format: p => formatBool(wirelessChargingVal(p), '지원', '미지원') },
      { key: 'reverse_wireless', label: '무선 배터리 공유', format: p => formatBool(detailsOf(p).reverse_wireless, '지원', '미지원') }
    ]
  },
  {
    name: '네트워크 및 규격',
    fields: [
      { key: 'supports_5g', label: '5G 네트워크', format: p => formatBool(supports5gVal(p), '5G 지원', 'LTE') },
      { key: 'wifi', label: 'Wi-Fi 규격', format: p => formatWifi(detailsOf(p).wifi) },
      { key: 'bluetooth', label: 'Bluetooth 규격', format: p => formatBluetooth(detailsOf(p).bluetooth) },
      { key: 'nfc', label: 'NFC', format: p => formatBool(detailsOf(p).nfc, '지원', '미지원') },
      { key: 'waterproof', label: '방수·방진', format: p => detailsOf(p).ip_rating || '정보 없음' },
      { key: 'weight_g', label: '무게', format: p => weightGVal(p) ? `${weightGVal(p)}g` : '정보 없음' },
      { key: 'dimensions', label: '크기 (세로×가로×두께)', format: p => formatDimensionsAll(detailsOf(p)) }
    ]
  },
  {
    name: '가격 및 구매 정보',
    fields: [
      { key: 'price_amount', label: '현재 판매가', format: formatPriceAmount },
      { key: 'launch_price', label: '공식 출고가', format: formatOfficialLaunchPrice },
      { key: 'price_type', label: '가격 유형', format: formatPriceType },
      { key: 'price_source', label: '가격 출처', format: p => p.price?.source_name || '정보 없음' },
      { key: 'danawa_link', label: '다나와 상품 링크', format: p => getDanawaUrl(p) ? '다나와 상품 보기' : '정보 없음', href: getDanawaUrl },
      { key: 'price_date', label: '가격 조회 시각', format: formatPriceDate },
      { key: 'price_notice', label: '구매 참고사항', format: formatPriceNotice }
    ]
  }
]

const tabletCategories = [
  {
    name: '기본 정보',
    fields: [
      { key: 'brand', label: '제조사', format: p => p.brand_name || (p.brand === 'samsung' ? '삼성전자' : 'Apple') },
      { key: 'model_name', label: '모델명', format: p => p.model_name || '정보 없음' },
      { key: 'domestic_model_number', label: '기본 모델번호', format: p => p.domestic_model_number || '정보 없음' },
      { key: 'released_on', label: '출시일', format: p => p.released_on || '정보 없음' },
      { key: 'os', label: '운영체제', format: p => p.specs?.os || '정보 없음' }
    ]
  },
  {
    name: '디스플레이 및 화면',
    fields: [
      { key: 'display', label: '디스플레이', format: p => p.specs?.display || '정보 없음' },
      { key: 'resolution', label: '해상도', format: p => p.specs?.resolution || '정보 없음' },
      { key: 'refresh_rate', label: '화면 주사율', format: p => p.specs?.refresh_rate || '정보 없음' }
    ]
  },
  {
    name: '성능 및 프로세서',
    fields: [
      { key: 'processor', label: '프로세서 (AP)', format: p => p.specs?.processor || '정보 없음' },
      { key: 'memory', label: '메모리 (RAM)', format: p => p.specs?.memory || '정보 없음' },
      { key: 'storage', label: '저장 용량', format: p => p.specs?.storage || '정보 없음' }
    ]
  },
  {
    name: '카메라',
    fields: [
      { key: 'camera', label: '카메라 사양', format: p => p.specs?.camera || '정보 없음' }
    ]
  },
  {
    name: '배터리 및 외형 규격',
    fields: [
      { key: 'battery', label: '배터리 용량', format: p => p.specs?.battery || '정보 없음' },
      { key: 'weight', label: '무게', format: p => p.specs?.weight || '정보 없음' },
      { key: 'dimensions', label: '크기 (규격)', format: p => p.specs?.dimensions || '정보 없음' }
    ]
  },
  {
    name: '연결성',
    fields: [
      { key: 'connectivity', label: '네트워크 / 연결성', format: p => p.specs?.connectivity || '정보 없음' }
    ]
  },
  {
    name: '가격 및 데이터 출처',
    fields: [
      { key: 'price_amount', label: '출고가 (참고)', format: formatSupplementalPrice },
      { key: 'price_type', label: '가격 구분', format: () => '출고가 기준 (조원 제공 참고 데이터)' },
      { key: 'price_source', label: '데이터 출처', format: p => p.source_name ? `조원 제공 참고 데이터 (${p.source_name})` : '조원 제공 참고 데이터' },
      { key: 'price_notice', label: '구매 참고사항', format: () => '조원 제공 참고 데이터입니다. 실제 판매처의 현재 가격 및 재고와 다를 수 있습니다.' }
    ]
  }
]

const smartwatchCategories = [
  {
    name: '기본 정보',
    fields: [
      { key: 'brand', label: '제조사', format: p => p.brand_name || (p.brand === 'samsung' ? '삼성전자' : 'Apple') },
      { key: 'model_name', label: '모델명', format: p => p.model_name || '정보 없음' },
      { key: 'domestic_model_number', label: '기본 모델번호', format: p => p.domestic_model_number || '정보 없음' },
      { key: 'released_on', label: '출시일', format: p => p.released_on || '정보 없음' },
      { key: 'os', label: '운영체제', format: p => p.specs?.os || '정보 없음' }
    ]
  },
  {
    name: '디스플레이',
    fields: [
      { key: 'display', label: '디스플레이', format: p => p.specs?.display || '정보 없음' },
      { key: 'resolution', label: '해상도', format: p => p.specs?.resolution || '정보 없음' },
      { key: 'refresh_rate', label: '화면 주사율', format: p => p.specs?.refresh_rate || '정보 없음' }
    ]
  },
  {
    name: '성능 및 하드웨어',
    fields: [
      { key: 'processor', label: '프로세서 (SiP / AP)', format: p => p.specs?.processor || '정보 없음' },
      { key: 'memory', label: '메모리 (RAM)', format: p => p.specs?.memory || '정보 없음' },
      { key: 'storage', label: '저장 용량', format: p => p.specs?.storage || '정보 없음' }
    ]
  },
  {
    name: '배터리 및 외형',
    fields: [
      { key: 'battery', label: '배터리 / 사용 시간', format: p => p.specs?.battery || '정보 없음' },
      { key: 'weight', label: '무게', format: p => p.specs?.weight || '정보 없음' },
      { key: 'dimensions', label: '크기 (규격)', format: p => p.specs?.dimensions || '정보 없음' }
    ]
  },
  {
    name: '연결성 및 센서',
    fields: [
      { key: 'connectivity', label: '연결성 / GPS', format: p => p.specs?.connectivity || '정보 없음' }
    ]
  },
  {
    name: '가격 및 데이터 출처',
    fields: [
      { key: 'price_amount', label: '출고가 (참고)', format: formatSupplementalPrice },
      { key: 'price_type', label: '가격 구분', format: () => '출고가 기준 (조원 제공 참고 데이터)' },
      { key: 'price_source', label: '데이터 출처', format: p => p.source_name ? `조원 제공 참고 데이터 (${p.source_name})` : '조원 제공 참고 데이터' },
      { key: 'price_notice', label: '구매 참고사항', format: () => '조원 제공 참고 데이터입니다. 실제 판매처의 현재 가격 및 재고와 다를 수 있습니다.' }
    ]
  }
]

const currentCategories = computed(() => {
  if (props.category === 'tablet') return tabletCategories
  if (props.category === 'smartwatch') return smartwatchCategories
  return smartphoneCategories
})

function differs(f) {
  if (selectedProducts.value.length < 2) return false
  const values = selectedProducts.value.map(p => f.format(p))
  return new Set(values).size > 1
}

const visibleCategories = computed(() => {
  const cats = currentCategories.value
  if (!props.showDiffOnly) return cats
  return cats
    .map(c => ({
      ...c,
      fields: c.fields.filter(f => differs(f))
    }))
    .filter(c => c.fields.length > 0)
})
</script>

<style scoped>
.apple-compare-root {
  display: flex;
  flex-direction: column;
}

/* 1. Sticky Compact Header */
.sticky-compare-bar {
  position: sticky;
  top: 64px;
  z-index: 14;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid #e5e5e7;
  padding: 12px 0;
  margin-bottom: 32px;
}

.sticky-cols {
  display: grid;
  gap: 32px;
}

.sticky-cols.cols-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.sticky-cols.cols-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.sticky-col-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-width: 0;
}

.sticky-model-name {
  font-size: 14px;
  font-weight: 700;
  color: #111111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sticky-empty-label {
  font-size: 13px;
  color: #71717a;
}

.sticky-change-link {
  background: transparent;
  border: 1px solid #d4d4d8;
  border-radius: 9999px;
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 600;
  color: #3f3f46;
  cursor: pointer;
  flex-shrink: 0;
}

.sticky-change-link:hover {
  border-color: #111111;
  color: #111111;
}

/* 2. Independent Vertical Columns Grid */
.apple-columns-grid {
  display: grid;
  gap: 32px;
}

.apple-columns-grid.cols-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.apple-columns-grid.cols-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

/* Hero Row */
.apple-hero-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.col-utility-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 0 4px;
}

.brand-caption {
  font-size: 12px;
  font-weight: 600;
  color: #52525b;
}

.brand-caption.empty {
  color: #a1a1aa;
}

.col-remove-link {
  background: none;
  border: 0;
  font-size: 12px;
  color: #71717a;
  cursor: pointer;
  padding: 2px 6px;
}

.col-remove-link:hover {
  color: #b42318;
  text-decoration: underline;
}

.hero-product-content,
.hero-empty-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.product-visual-pedestal {
  position: relative;
  width: 100%;
  height: 224px;
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 22px;
  padding: 20px;
}

.product-visual-pedestal.pedestal-smartphone {
  height: 280px;
  padding: 18px 20px;
}

.product-visual-pedestal.pedestal-tablet {
  height: 240px;
  padding: 16px 20px;
}

.product-visual-pedestal.pedestal-smartwatch {
  height: 240px;
  padding: 16px 20px;
}

.product-photo {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  object-position: center;
  border-radius: 0;
  display: block;
}

.product-photo.photo-smartphone {
  max-width: 84%;
  max-height: 100%;
}

.product-photo.photo-tablet {
  max-width: 92%;
  max-height: 100%;
}

.product-photo.photo-smartwatch {
  max-width: 80%;
  max-height: 100%;
}

.product-photo.is-transparent {
  border-radius: 0;
  filter: drop-shadow(0 10px 20px rgba(17, 17, 17, 0.08));
}

.product-photo.is-portrait {
  max-width: 84%;
  max-height: 100%;
}

.reference-caption-pill {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(6px);
  border: 1px solid #e4e4e7;
  border-radius: 9999px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 500;
  color: #52525b;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 1px 4px rgba(17, 17, 17, 0.06);
}

.product-placeholder-graphic {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.phone-svg {
  width: 78px;
  height: 136px;
}

.pedestal-smartphone .phone-svg {
  width: 88px;
  height: 156px;
}

.tablet-svg {
  width: 112px;
  height: 132px;
}

.watch-svg {
  width: 84px;
  height: 132px;
}

.placeholder-caption {
  font-size: 11px;
  color: #71717a;
}

.empty-visual-pedestal {
  width: 100%;
  height: 224px;
  border: 1.5px dashed #d4d4d8;
  border-radius: 16px;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #71717a;
  font-size: 13px;
  cursor: pointer;
  margin-bottom: 22px;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.empty-visual-pedestal.pedestal-smartphone {
  height: 280px;
}

.empty-visual-pedestal:hover {
  border-color: #111111;
  color: #111111;
}

.hero-model-name {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #111111;
  margin: 0 0 6px;
  word-break: keep-all;
}

.hero-model-name.muted {
  color: #71717a;
  font-weight: 600;
}

.hero-model-sub {
  font-size: 13px;
  color: #52525b;
  margin: 0 0 12px;
  min-height: 20px;
}

.variant-selectors-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin: 0 0 16px;
}

.variant-selector-group {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.variant-group-label {
  font-size: 11px;
  font-weight: 700;
  color: #71717a;
  letter-spacing: -0.01em;
}

.variant-chip-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.variant-pill-btn {
  border: 1px solid #d4d4d8;
  background: #ffffff;
  color: #3f3f46;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 9999px;
  cursor: pointer;
  line-height: 1.4;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
}

.variant-pill-btn:hover {
  border-color: #111111;
  color: #111111;
}

.variant-pill-btn.is-cross-option {
  border-style: dashed;
  color: #71717a;
  background: #fafafa;
}

.variant-pill-btn.active {
  background: #111111;
  border-color: #111111;
  color: #ffffff;
}

.hero-price-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  margin-bottom: 18px;
}

.hero-price-main {
  font-size: 17px;
  font-weight: 750;
  color: #111111;
}

.hero-price-note {
  font-size: 11px;
  color: #71717a;
}

.hero-price-note.warn {
  color: #92400e;
}

.hero-change-btn {
  background: transparent;
  border: 1px solid #d4d4d8;
  border-radius: 9999px;
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 600;
  color: #111111;
  cursor: pointer;
}

.hero-change-btn:hover {
  background: #f5f5f7;
  border-color: #111111;
}

.hero-select-btn {
  background: #111111;
  border: 1px solid #111111;
  border-radius: 9999px;
  padding: 9px 22px;
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  cursor: pointer;
  margin-top: 6px;
}

/* Divider */
.apple-section-divider {
  border-top: 1px solid #e5e5e7;
  margin: 44px 0 36px;
}

/* 3. Pure Vertical Visual Specs Grid (No borders, no left label col, no badges) */
.visual-specs-area {
  margin-bottom: 48px;
}

.no-diff-notice {
  padding: 40px 24px;
  text-align: center;
  color: #52525b;
  font-size: 14px;
}

.specs-matrix {
  row-gap: 42px;
}

.visual-spec-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 4px 12px;
}

.spec-icon-holder {
  color: #111111;
  margin-bottom: 12px;
}

.spec-headline-val {
  font-size: 20px;
  font-weight: 750;
  letter-spacing: -0.025em;
  line-height: 1.3;
  color: #111111;
  margin-bottom: 4px;
  word-break: keep-all;
}

.spec-headline-val.is-unknown {
  font-size: 14px;
  font-weight: 500;
  color: #71717a;
}

.spec-sub-caption {
  font-size: 13px;
  line-height: 1.45;
  color: #71717a;
  word-break: keep-all;
}

.cell-empty {
  color: #d4d4d8;
  font-size: 18px;
}

/* 4. Detailed Table Progressive Disclosure Button */
.detailed-toggle-wrap {
  display: flex;
  justify-content: center;
  padding: 12px 0 32px;
}

.detail-accordion-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 13px 28px;
  border-radius: 9999px;
  border: 1px solid #111111;
  background: #ffffff;
  color: #111111;
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.detail-accordion-btn:hover {
  background: #111111;
  color: #ffffff;
}

.btn-meta {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.72;
}

.btn-arrow {
  font-size: 16px;
  line-height: 1;
}

/* 5. Smooth Grid Collapse for Detailed Spec Table */
.detailed-panel {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease;
  pointer-events: none;
}

.detailed-panel.is-open {
  grid-template-rows: 1fr;
  opacity: 1;
  pointer-events: auto;
  margin-bottom: 24px;
}

.detailed-panel-inner {
  overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .detailed-panel {
    transition: none !important;
  }
}

.comparison-scroll {
  overflow-x: auto;
  border: 1px solid #e5e5e7;
  border-radius: 16px;
  background: #ffffff;
}

.comparison-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin: 0;
  min-width: 660px;
}

.comparison-table.cols-3 {
  min-width: 760px;
}

.corner-head {
  background: #fafafa;
  width: 200px;
  min-width: 170px;
  vertical-align: middle;
  padding: 16px 20px;
  text-align: left;
  border-bottom: 1px solid #e5e5e7;
}

.corner-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #71717a;
  margin-bottom: 4px;
}

.table-col-head {
  padding: 16px 20px;
  text-align: center;
  vertical-align: middle;
  font-size: 14px;
  font-weight: 750;
  color: #111111;
  border-bottom: 1px solid #e5e5e7;
  word-break: keep-all;
  overflow-wrap: break-word;
  line-height: 1.4;
}

.category-header-row th {
  background: #f5f5f7;
  padding: 12px 20px;
  vertical-align: middle;
  text-align: left;
  border-top: 1px solid #e5e5e7;
  border-bottom: 1px solid #e5e5e7;
}

.category-title {
  font-size: 13px;
  font-weight: 750;
  color: #111111;
  letter-spacing: -0.01em;
}

.spec-label-cell {
  background: #fafafa;
  font-size: 13px;
  font-weight: 600;
  color: #111111;
  width: 200px;
  min-width: 170px;
  padding: 16px 20px;
  vertical-align: middle;
  text-align: left;
  border-bottom: 1px solid #f0f0f2;
}

.spec-label-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  width: 100%;
}

.spec-label-text {
  display: block;
  line-height: 1.45;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.spec-value-cell {
  font-size: 13px;
  padding: 16px 20px;
  vertical-align: middle;
  text-align: center !important;
  color: #111111;
  border-bottom: 1px solid #f0f0f2;
}

.spec-value-wrap {
  display: block;
  width: 100%;
  text-align: center;
  word-break: keep-all;
  overflow-wrap: break-word;
  line-height: 1.6;
}

.spec-value-wrap span {
  display: inline-block;
  text-align: center;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.is-unknown {
  color: #71717a;
  font-size: 12px;
}

.spec-external-link {
  color: #111111;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.spec-external-link:hover {
  color: #3f3f46;
}

.difference-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #ffffff;
  background: #111111;
  padding: 2px 8px;
  border-radius: 9999px;
  white-space: nowrap;
  line-height: 1.4;
  letter-spacing: -0.01em;
  flex-shrink: 0;
}

@media (max-width: 800px) {
  .sticky-compare-bar {
    top: 60px;
  }

  .apple-columns-grid.cols-3,
  .sticky-cols.cols-3 {
    gap: 16px;
  }

  .spec-headline-val {
    font-size: 17px;
  }
}

@media (max-width: 560px) {
  .apple-columns-grid.cols-2,
  .apple-columns-grid.cols-3,
  .sticky-cols.cols-2,
  .sticky-cols.cols-3 {
    gap: 12px;
  }

  .product-visual-pedestal,
  .empty-visual-pedestal {
    height: 164px;
  }

  .product-visual-pedestal.pedestal-smartphone,
  .empty-visual-pedestal.pedestal-smartphone {
    height: 208px;
  }

  .hero-model-name {
    font-size: 18px;
  }

  .spec-headline-val {
    font-size: 15px;
  }
}
</style>
