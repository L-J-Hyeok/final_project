<template>
  <section class="section-wrap compare-page">
    <span class="eyebrow">SIDE BY SIDE</span>
    <div class="section-heading">
      <div>
        <h1>제품 스펙 비교</h1>
        <p>같은 기준으로 나란히 보고, 나에게 필요한 차이를 찾아보세요.</p>
      </div>
      <!-- Category Tabs -->
      <div class="category-tabs" role="tablist" aria-label="기기 카테고리 전환">
        <button
          type="button"
          role="tab"
          :class="['cat-tab-btn', { active: activeCategory === 'smartphone' }]"
          :aria-selected="activeCategory === 'smartphone'"
          @click="switchCategory('smartphone')"
        >
          스마트폰 ({{ groupedSmartphoneModels.length || '...' }})
        </button>
        <button
          type="button"
          role="tab"
          :class="['cat-tab-btn', { active: activeCategory === 'tablet' }]"
          :aria-selected="activeCategory === 'tablet'"
          @click="switchCategory('tablet')"
        >
          태블릿 ({{ supplementalData.tablets.length }})
        </button>
        <button
          type="button"
          role="tab"
          :class="['cat-tab-btn', { active: activeCategory === 'smartwatch' }]"
          :aria-selected="activeCategory === 'smartwatch'"
          @click="switchCategory('smartwatch')"
        >
          스마트워치 ({{ supplementalData.smartwatches.length }})
        </button>
        <button
          type="button"
          role="tab"
          :class="['cat-tab-btn', { active: activeCategory === 'laptop' }]"
          :aria-selected="activeCategory === 'laptop'"
          @click="switchCategory('laptop')"
        >
          노트북 <small class="tab-badge">준비 중</small>
        </button>
      </div>
    </div>

    <!-- Laptop Preparation Notice -->
    <div v-if="activeCategory === 'laptop'" class="laptop-notice">
      <v-alert type="info" variant="tonal" class="mb-4">
        <strong>노트북 카테고리는 현재 데이터 준비 중입니다.</strong>
        <p class="mt-2">향후 업데이트에서 다양한 노트북 사양 비교를 지원할 예정이에요. 상단 탭에서 스마트폰, 태블릿, 스마트워치 비교를 이용해 보세요.</p>
      </v-alert>
      <div class="laptop-placeholder-card">
        <v-icon icon="mdi-laptop" size="64" color="primary" />
        <h3>노트북 비교 기능 준비 중</h3>
        <p>조원 제공 원본 데이터에 노트북 제품이 포함되어 있지 않아 현재 신규 데이터 수집 및 구축을 준비하고 있습니다.</p>
        <button type="button" class="back-cat-btn" @click="switchCategory('smartphone')">스마트폰 비교로 돌아가기</button>
      </div>
    </div>

    <!-- Active Device Comparison Content -->
    <template v-else>
      <!-- Auth check notice for smartphone API -->
      <v-alert
        v-if="activeCategory === 'smartphone' && !isLoggedIn"
        type="info"
        variant="tonal"
        class="auth-notice"
        role="status"
      >
        공개 승인된 스마트폰은 로그인 없이 비교할 수 있어요. 개인화 추천은 로그인 후 이용해 주세요.
        <router-link to="/login?next=/compare" class="login-action-link">로그인하기 →</router-link>
      </v-alert>

      <!-- Error message if any -->
      <v-alert v-if="catalogError" type="error" variant="tonal" class="error-notice" role="alert">
        {{ catalogError }}
        <button type="button" class="retry-btn" @click="loadSmartphoneCatalog">다시 시도</button>
      </v-alert>

      <!-- Supplemental Data Notice for Tablets & Smartwatches -->
      <div v-if="activeCategory === 'tablet' || activeCategory === 'smartwatch'" class="supplemental-source-banner">
        <v-icon icon="mdi-information-outline" size="18" />
        <span>
          현재 <strong>{{ activeCategory === 'tablet' ? '태블릿' : '스마트워치' }}</strong>는 조원 제공 참고 데이터를 읽기 전용으로 표시하고 있습니다.
          실제 판매처의 최신 가격 및 재고와 다를 수 있습니다.
        </span>
      </div>

      <!-- Compare Controls Toolbar -->
      <div class="compare-toolbar">
        <div class="toolbar-left">
          <span>{{ currentCategoryLabel }} 비교</span>
          <small>{{ activeCategory === 'smartphone' ? '검증된 정규 DB 연동' : '조원 제공 참고 데이터 기반' }}</small>
        </div>

        <div class="toolbar-center">
          <!-- Quick Slot Selectors for fast switching -->
          <div class="quick-pickers" v-if="activeCategory === 'smartphone' ? groupedSmartphoneModels.length : currentCatalog.length">
            <label class="quick-field">
              <span class="quick-label">기기 1</span>
              <select v-model="quickSlot1" class="quick-select" @change="onQuickSelect(0, $event.target.value)">
                <option value="">선택 안 됨</option>
                <template v-if="activeCategory === 'smartphone'">
                  <option v-for="m in groupedSmartphoneModels" :key="m.modelKey" :value="m.modelKey">
                    [{{ m.brand === 'samsung' ? '삼성' : '애플' }}] {{ m.model_name }}
                  </option>
                </template>
                <template v-else>
                  <option v-for="p in currentCatalog" :key="p.variant_id || p.id" :value="p.variant_id || p.id">
                    [{{ p.brand_name || (p.brand === 'samsung' ? '삼성' : '애플') }}] {{ p.model_name }}
                    {{ p.storage_gb ? `(${p.storage_gb}GB${p.color ? ` · ${p.color}` : ''})` : (p.specs?.storage ? `(${p.specs.storage})` : '') }}
                  </option>
                </template>
              </select>
            </label>

            <span class="quick-vs">VS</span>

            <label class="quick-field">
              <span class="quick-label">기기 2</span>
              <select v-model="quickSlot2" class="quick-select" @change="onQuickSelect(1, $event.target.value)">
                <option value="">선택 안 됨</option>
                <template v-if="activeCategory === 'smartphone'">
                  <option v-for="m in groupedSmartphoneModels" :key="m.modelKey" :value="m.modelKey">
                    [{{ m.brand === 'samsung' ? '삼성' : '애플' }}] {{ m.model_name }}
                  </option>
                </template>
                <template v-else>
                  <option v-for="p in currentCatalog" :key="p.variant_id || p.id" :value="p.variant_id || p.id">
                    [{{ p.brand_name || (p.brand === 'samsung' ? '삼성' : '애플') }}] {{ p.model_name }}
                    {{ p.storage_gb ? `(${p.storage_gb}GB${p.color ? ` · ${p.color}` : ''})` : (p.specs?.storage ? `(${p.specs.storage})` : '') }}
                  </option>
                </template>
              </select>
            </label>

            <template v-if="count === 3">
              <span class="quick-vs">VS</span>
              <label class="quick-field">
                <span class="quick-label">기기 3</span>
                <select v-model="quickSlot3" class="quick-select" @change="onQuickSelect(2, $event.target.value)">
                  <option value="">선택 안 됨</option>
                  <template v-if="activeCategory === 'smartphone'">
                    <option v-for="m in groupedSmartphoneModels" :key="m.modelKey" :value="m.modelKey">
                      [{{ m.brand === 'samsung' ? '삼성' : '애플' }}] {{ m.model_name }}
                    </option>
                  </template>
                  <template v-else>
                    <option v-for="p in currentCatalog" :key="p.variant_id || p.id" :value="p.variant_id || p.id">
                      [{{ p.brand_name || (p.brand === 'samsung' ? '삼성' : '애플') }}] {{ p.model_name }}
                      {{ p.storage_gb ? `(${p.storage_gb}GB${p.color ? ` · ${p.color}` : ''})` : (p.specs?.storage ? `(${p.specs.storage})` : '') }}
                    </option>
                  </template>
                </select>
              </label>
            </template>
          </div>
        </div>

        <div class="toolbar-right">
          <!-- Diff Toggle -->
          <label class="diff-toggle">
            <input v-model="showDiffOnly" type="checkbox">
            <span>차이 있는 항목만 보기</span>
          </label>

          <!-- Slot Count Buttons -->
          <div role="group" aria-label="비교 열 수" class="count-buttons">
            <v-btn
              v-for="n in [2, 3]"
              :key="n"
              :variant="count === n ? 'flat' : 'outlined'"
              :color="count === n ? 'primary' : 'secondary'"
              size="small"
              rounded="pill"
              :aria-pressed="count === n"
              @click="setCount(n)"
            >
              {{ n }}개 비교
            </v-btn>
          </div>
        </div>
      </div>

      <!-- Skeleton Loading Indicator (Zero Layout Shift) -->
      <div v-if="loading" class="compare-skeleton-wrap" role="status" aria-label="기기 사양 데이터를 불러오는 중">
        <span class="sr-only">기기 사양 데이터를 불러오고 있어요...</span>
        <div class="skeleton-cards-grid" :style="{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }">
          <div v-for="n in count" :key="'skel-card-' + n" class="skeleton-card">
            <div class="skeleton-block skel-img"></div>
            <div class="skeleton-block skel-title"></div>
            <div class="skeleton-block skel-meta"></div>
          </div>
        </div>
        <div class="skeleton-rows">
          <div v-for="r in 4" :key="'skel-row-' + r" class="skeleton-block skel-row"></div>
        </div>
      </div>

      <!-- Visual Product Comparison Component -->
      <SpecComparison
        v-else
        :products="selectedProducts"
        :catalog="currentCatalog"
        :count="count"
        :show-diff-only="showDiffOnly"
        :category="activeCategory"
        @select="openPicker"
        @change="openPicker"
        @remove="removeSlot"
        @select-variant="onSelectVariant"
      />

      <!-- Comparison Footnotes & Policy Notices -->
      <div class="compare-notes">
        <p>• ‘값 다름’ 표시는 기기 간 사양 차이를 안내하며, 더 우수한 제품이라는 뜻이 아닙니다.</p>
        <p>• 스마트폰은 검증된 MySQL 데이터베이스를 연동하며, 미공개(pending) 모델은 노출되지 않습니다.</p>
        <p>• 태블릿과 스마트워치는 조원 제공 참고 데이터 원문을 충실히 표시하며, 임의로 수치를 가공하지 않았습니다.</p>
        <p>• 일반 스펙 비교는 AI를 호출하지 않으며, 실시간 제품 카탈로그 및 참고 데이터에서 직접 불러옵니다.</p>
        <p>• 표시된 출고가 및 개발용 참고 가격은 실제 판매처의 현재 판매가 및 재고와 다를 수 있습니다.</p>
      </div>

      <!-- Product Selection Dialog Modal -->
      <v-dialog v-model="pickerOpen" max-width="640">
        <v-card class="picker-card">
          <div class="picker-header">
            <h2>{{ currentCategoryLabel }} 선택 · 기기 {{ pickerSlotIndex + 1 }}</h2>
            <button type="button" class="close-btn" @click="pickerOpen = false" aria-label="닫기">✕</button>
          </div>

          <!-- Search Bar -->
          <div class="picker-search-bar">
            <input
              v-model="pickerQuery"
              type="text"
              :placeholder="`제조사, 모델명, 모델번호 검색 (예: ${activeCategory === 'tablet' ? 'Tab S9, iPad Pro' : activeCategory === 'smartwatch' ? 'Galaxy Watch, Apple Watch' : 'S24, iPhone'})`"
              class="picker-input"
              @keydown.enter.prevent
            >
          </div>

          <!-- Brand Filter Tabs -->
          <div class="picker-brand-tabs">
            <button
              type="button"
              :class="['brand-tab', { active: pickerBrand === 'all' }]"
              @click="pickerBrand = 'all'"
            >
              전체 ({{ filteredCatalog.length }})
            </button>
            <button
              type="button"
              :class="['brand-tab', { active: pickerBrand === 'samsung' }]"
              @click="pickerBrand = 'samsung'"
            >
              삼성전자
            </button>
            <button
              type="button"
              :class="['brand-tab', { active: pickerBrand === 'apple' }]"
              @click="pickerBrand = 'apple'"
            >
              Apple
            </button>
          </div>

          <!-- Product List -->
          <div class="picker-product-list" role="listbox">
            <div
              v-for="item in filteredCatalog"
              :key="item.modelKey || item.variant_id || item.id"
              class="picker-product-item"
              role="option"
              tabindex="0"
              @click="chooseProduct(item)"
              @keydown.enter="chooseProduct(item)"
            >
              <div class="item-left">
                <span class="item-brand-tag" :class="`tag-${item.brand}`">
                  {{ item.brand_name || (item.brand === 'samsung' ? '삼성' : '애플') }}
                </span>
                <div>
                  <strong class="item-model-name">{{ item.model_name }}</strong>
                  <span v-if="activeCategory === 'smartphone'" class="item-sub">
                    {{ item.domestic_model_number || '모델번호 없음' }}
                    {{ item.storages?.length ? `· ${item.storages.map(formatCapacityBadge).join(' / ')}` : '' }}
                    {{ item.colors?.length ? `· 색상 ${item.colors.length}종` : '' }}
                  </span>
                  <span v-else class="item-sub">
                    {{ item.domestic_model_number || '모델번호 없음' }}
                    {{ item.storage_gb ? `· ${item.storage_gb}GB` : (item.specs?.storage ? `· ${item.specs.storage}` : '') }}
                    {{ item.color ? `· ${item.color}` : '' }}
                  </span>
                </div>
              </div>
              <div class="item-right">
                <span class="item-date">{{ item.released_on_kr || item.released_on || '' }}</span>
                <span class="item-select-action">선택</span>
              </div>
            </div>

            <div v-if="!filteredCatalog.length" class="picker-empty">
              검색 조건에 맞는 기기가 없어요.
            </div>
          </div>

          <div class="picker-footer">
            <button type="button" class="picker-cancel-btn" @click="pickerOpen = false">취소</button>
          </div>
        </v-card>
      </v-dialog>
    </template>
  </section>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useStore } from 'vuex'
import { useRoute } from 'vue-router'
import SpecComparison from '../components/SpecComparison.vue'
import { useMemberApi, memberMessage } from '../composables/useMemberApi'
import { createSmartphoneApi } from '../api/smartphones'
import supplementalData from '../data/supplemental-devices.json'

const store = useStore()
const route = useRoute() || { query: {} }
const memberApi = useMemberApi()
const phoneApi = createSmartphoneApi(memberApi)

// Category state: 'smartphone' | 'tablet' | 'smartwatch' | 'laptop'
const activeCategory = ref('smartphone')

const count = ref(2)
const showDiffOnly = ref(false)
const loading = ref(false)
const catalogError = ref('')

// Smartphone catalog from MySQL
const smartphoneCatalog = ref([])

// Slots holding selected devices for current category (indices 0, 1, 2)
const selectedSlots = ref([null, null, null])

// Quick select dropdown bindings for slots 0, 1, 2
const quickSlot1 = ref('')
const quickSlot2 = ref('')
const quickSlot3 = ref('')

// Dialog state
const pickerOpen = ref(false)
const pickerSlotIndex = ref(0)
const pickerQuery = ref('')
const pickerBrand = ref('all')

const abortController = new AbortController()

const isLoggedIn = computed(() => !!store.state.user)

const currentCategoryLabel = computed(() => {
  if (activeCategory.value === 'tablet') return '태블릿'
  if (activeCategory.value === 'smartwatch') return '스마트워치'
  if (activeCategory.value === 'laptop') return '노트북'
  return '스마트폰'
})

function isValidColorName(color) {
  if (!color || typeof color !== 'string') return false
  const c = color.trim().toLowerCase()
  return Boolean(c && c !== 'unspecified' && c !== '미정')
}

function formatCapacityBadge(gb) {
  const n = Number(gb || 0)
  if (n >= 1024 && n % 1024 === 0) return `${n / 1024}TB`
  return n ? `${n}GB` : ''
}

function modelGroupKey(item) {
  if (!item) return ''
  if (item.smartphone_id !== undefined && item.smartphone_id !== null && String(item.smartphone_id).trim() !== '') {
    return String(item.smartphone_id).trim()
  }
  const code = String(item.domestic_model_number || '').trim().toUpperCase()
  if (code) return `${String(item.brand || '').toLowerCase()}::${code}`
  return `${String(item.brand || '').toLowerCase()}::${String(item.model_name || '').trim().toLowerCase()}`
}

const currentCatalog = computed(() => {
  if (activeCategory.value === 'tablet') return supplementalData.tablets || []
  if (activeCategory.value === 'smartwatch') return supplementalData.smartwatches || []
  return smartphoneCatalog.value
})

const groupedSmartphoneModels = computed(() => {
  const groups = new Map()
  for (const item of smartphoneCatalog.value) {
    if (!item || item.is_test) continue
    const key = modelGroupKey(item)
    if (!key) continue
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key).push(item)
  }

  const list = []
  for (const [modelKey, rawVariants] of groups.entries()) {
    const seenVariant = new Set()
    const variants = []
    for (const v of rawVariants) {
      const vid = String(v.variant_id || v.id || `${v.storage_gb}-${v.color}-${v.ram_gb || ''}`)
      if (seenVariant.has(vid)) continue
      seenVariant.add(vid)
      variants.push(v)
    }
    variants.sort((a, b) => {
      const sa = Number(a.storage_gb || 0)
      const sb = Number(b.storage_gb || 0)
      if (sa !== sb) return sa - sb
      const ca = String(a.color || '')
      const cb = String(b.color || '')
      const cmp = ca.localeCompare(cb, 'ko')
      if (cmp !== 0) return cmp
      return Number(a.ram_gb || 0) - Number(b.ram_gb || 0)
    })

    const storages = [...new Set(variants.map(v => Number(v.storage_gb)).filter(n => n > 0))].sort((a, b) => a - b)
    const colorMap = new Map()
    for (const v of variants) {
      if (!isValidColorName(v.color)) continue
      const norm = v.color.trim().toLowerCase()
      if (!colorMap.has(norm)) colorMap.set(norm, v.color.trim())
    }
    const colors = [...colorMap.values()].sort((a, b) => a.localeCompare(b, 'ko'))
    const representative = variants.find(v => v.price) || variants[0]

    list.push({
      modelKey,
      smartphone_id: representative?.smartphone_id ?? null,
      brand: representative?.brand || '',
      model_name: representative?.model_name || '',
      domestic_model_number: representative?.domestic_model_number || null,
      released_on_kr: representative?.released_on_kr || null,
      storages,
      colors,
      variants,
      representative
    })
  }

  return list.sort((a, b) => {
    const da = String(a.released_on_kr || '')
    const db = String(b.released_on_kr || '')
    if (da !== db) return db.localeCompare(da)
    const ba = String(a.brand || '')
    const bb = String(b.brand || '')
    if (ba !== bb) return ba.localeCompare(bb)
    return String(a.model_name || '').localeCompare(String(b.model_name || ''), 'ko')
  })
})

const selectedProducts = computed(() => {
  return selectedSlots.value.slice(0, count.value)
})

const filteredCatalog = computed(() => {
  const q = pickerQuery.value.trim().toLowerCase()
  if (activeCategory.value === 'smartphone') {
    return groupedSmartphoneModels.value.filter(m => {
      if (pickerBrand.value !== 'all' && m.brand !== pickerBrand.value) return false
      if (!q) return true
      const model = (m.model_name || '').toLowerCase()
      const num = (m.domestic_model_number || '').toLowerCase()
      const brand = (m.brand || '').toLowerCase()
      const brandKr = brand === 'samsung' ? '삼성' : brand === 'apple' ? '애플' : ''
      const chipset = (m.representative?.chipset || m.representative?.details_json?.chipset || '').toLowerCase()
      return model.includes(q) || num.includes(q) || brand.includes(q) || brandKr.includes(q) || chipset.includes(q)
    })
  }
  return currentCatalog.value.filter(item => {
    if (item.is_test) return false
    if (pickerBrand.value !== 'all' && item.brand !== pickerBrand.value) return false
    if (!q) return true
    const model = (item.model_name || '').toLowerCase()
    const num = (item.domestic_model_number || '').toLowerCase()
    const color = (item.color || '').toLowerCase()
    const storage = item.storage_gb ? `${item.storage_gb}gb` : ''
    const brand = (item.brand || '').toLowerCase()
    const brandKr = brand === 'samsung' ? '삼성' : brand === 'apple' ? '애플' : ''
    return model.includes(q) || num.includes(q) || color.includes(q) || storage.includes(q) || brand.includes(q) || brandKr.includes(q)
  })
})

function setCount(n) {
  count.value = Math.min(3, Math.max(2, n))
}

function syncQuickSlots() {
  if (activeCategory.value === 'smartphone') {
    quickSlot1.value = modelGroupKey(selectedSlots.value[0])
    quickSlot2.value = modelGroupKey(selectedSlots.value[1])
    quickSlot3.value = modelGroupKey(selectedSlots.value[2])
    return
  }
  quickSlot1.value = selectedSlots.value[0]?.variant_id || selectedSlots.value[0]?.id || ''
  quickSlot2.value = selectedSlots.value[1]?.variant_id || selectedSlots.value[1]?.id || ''
  quickSlot3.value = selectedSlots.value[2]?.variant_id || selectedSlots.value[2]?.id || ''
}

function onQuickSelect(slotIndex, id) {
  if (!id) {
    selectedSlots.value[slotIndex] = null
    syncQuickSlots()
    return
  }
  if (activeCategory.value === 'smartphone') {
    const modelGroup = groupedSmartphoneModels.value.find(m => m.modelKey === String(id))
    if (modelGroup?.representative) {
      selectedSlots.value[slotIndex] = { ...modelGroup.representative }
      syncQuickSlots()
    }
    return
  }
  const item = currentCatalog.value.find(p => String(p.variant_id || p.id) === String(id))
  if (item) {
    selectedSlots.value[slotIndex] = item
    syncQuickSlots()
  }
}

function openPicker(slotIndex) {
  pickerSlotIndex.value = slotIndex
  pickerQuery.value = ''
  pickerBrand.value = 'all'
  pickerOpen.value = true
}

function chooseProduct(item) {
  if (activeCategory.value === 'smartphone' && item?.representative) {
    selectedSlots.value[pickerSlotIndex.value] = { ...item.representative }
  } else {
    selectedSlots.value[pickerSlotIndex.value] = item
  }
  syncQuickSlots()
  pickerOpen.value = false
}

function removeSlot(slotIndex) {
  selectedSlots.value[slotIndex] = null
  syncQuickSlots()
}

function onSelectVariant(slotIndex, variant) {
  if (!variant) return
  selectedSlots.value[slotIndex] = { ...variant }
  syncQuickSlots()
}

function initCategoryDefaults() {
  if (activeCategory.value === 'smartphone') {
    const models = groupedSmartphoneModels.value
    if (!models || models.length < 2) {
      selectedSlots.value = [null, null, null]
      syncQuickSlots()
      return
    }
    const samsung =
      models.find(m => m.brand === 'samsung' && m.representative?.details_json?.main_resolution_px && m.colors.length > 1 && m.storages.length > 1) ||
      models.find(m => m.brand === 'samsung') ||
      models[0]
    const apple =
      models.find(m => m.brand === 'apple' && m.representative?.details_json?.main_resolution_px && m.colors.length > 1 && m.storages.length > 1 && m.modelKey !== samsung?.modelKey) ||
      models.find(m => m.brand === 'apple' && m.modelKey !== samsung?.modelKey) ||
      models[1]
    selectedSlots.value = [
      samsung?.representative ? { ...samsung.representative } : null,
      apple?.representative ? { ...apple.representative } : null,
      null
    ]
    syncQuickSlots()
    return
  }

  const cat = currentCatalog.value
  if (!cat || cat.length < 2) {
    selectedSlots.value = [null, null, null]
    syncQuickSlots()
    return
  }
  // Try to pick one Samsung and one Apple
  const samsung = cat.find(p => p.brand === 'samsung') || cat[0]
  const apple = cat.find(p => p.brand === 'apple' && (p.variant_id || p.id) !== (samsung?.variant_id || samsung?.id)) || cat[1]
  selectedSlots.value = [samsung || null, apple || null, null]
  syncQuickSlots()
}

function switchCategory(cat) {
  activeCategory.value = cat
  pickerOpen.value = false
  catalogError.value = ''
  if (cat === 'laptop') {
    selectedSlots.value = [null, null, null]
    return
  }
  initCategoryDefaults()
}

function parseQueryVariantIds() {
  const q = route?.query || {}
  const ordered = []
  const pushVal = val => {
    if (val === undefined || val === null) return
    const items = Array.isArray(val) ? val : [val]
    for (const raw of items) {
      if (raw === undefined || raw === null) continue
      const parts = String(raw).split(',').map(s => s.trim()).filter(Boolean)
      for (const p of parts) {
        if (!ordered.includes(p)) ordered.push(p)
      }
    }
  }
  if (q.variants) {
    pushVal(q.variants)
  } else {
    pushVal(q.owned_variant_id || q.v1)
    pushVal(q.variant_id || q.v2)
    pushVal(q.v3)
  }
  return ordered.slice(0, 3)
}

function applySmartphoneSelection() {
  const requestedIds = parseQueryVariantIds()
  if (!requestedIds.length) {
    initCategoryDefaults()
    return
  }
  const matched = requestedIds
    .map(id => smartphoneCatalog.value.find(p => String(p.variant_id || p.id) === id))
    .filter(Boolean)
  if (!matched.length) {
    initCategoryDefaults()
    return
  }
  if (matched.length === 1) {
    const first = matched[0]
    const firstKey = modelGroupKey(first)
    const models = groupedSmartphoneModels.value
    const peer =
      models.find(m => m.brand !== first.brand && m.modelKey !== firstKey && m.representative) ||
      models.find(m => m.modelKey !== firstKey && m.representative)
    selectedSlots.value = [{ ...first }, peer?.representative ? { ...peer.representative } : null, null]
    count.value = 2
  } else if (matched.length === 2) {
    selectedSlots.value = [{ ...matched[0] }, { ...matched[1] }, null]
    count.value = 2
  } else {
    selectedSlots.value = [{ ...matched[0] }, { ...matched[1] }, { ...matched[2] }]
    count.value = 3
  }
  syncQuickSlots()
}

async function loadSmartphoneCatalog() {
  loading.value = true
  catalogError.value = ''
  try {
    const res = await phoneApi.listAll({ only_recommendable: false, limit: 50 }, abortController.signal)
    const list = Array.isArray(res.data) ? res.data : []
    smartphoneCatalog.value = list.filter(p => !p.is_test && p.verified !== false)

    if (parseQueryVariantIds().length && activeCategory.value !== 'smartphone') {
      activeCategory.value = 'smartphone'
    }
    if (activeCategory.value === 'smartphone') {
      applySmartphoneSelection()
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      catalogError.value = memberMessage(e)
    }
  } finally {
    loading.value = false
  }
}

watch(
  () => route.query,
  () => {
    if (!smartphoneCatalog.value.length) return
    if (parseQueryVariantIds().length && activeCategory.value !== 'smartphone') {
      activeCategory.value = 'smartphone'
    }
    if (activeCategory.value === 'smartphone') {
      applySmartphoneSelection()
    }
  },
  { deep: true }
)

onMounted(() => {
  loadSmartphoneCatalog()
})

onBeforeUnmount(() => {
  abortController.abort()
})
</script>

<style scoped>
.category-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.cat-tab-btn {
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 9999px;
  border: 1px solid #e5e5e7;
  background: #ffffff;
  color: #52525b;
  cursor: pointer;
  transition: all .15s ease;
}
.cat-tab-btn:hover {
  background: #f5f5f7;
  color: #111111;
  border-color: #d4d4d8;
}
.cat-tab-btn.active {
  background: #111111;
  border-color: #111111;
  color: #ffffff;
  font-weight: 700;
}
.tab-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 9999px;
  background: #f4f4f5;
  color: #71717a;
  margin-left: 4px;
}
.cat-tab-btn.active .tab-badge {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}
.laptop-notice {
  margin: 32px 0;
}
.laptop-placeholder-card {
  padding: 60px 24px;
  text-align: center;
  border: 1px dashed #d4d4d8;
  border-radius: 16px;
  background: #f5f5f7;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.laptop-placeholder-card h3 {
  font-size: 18px;
  font-weight: 750;
  color: #111111;
}
.laptop-placeholder-card p {
  font-size: 13px;
  color: #52525b;
  max-width: 480px;
}
.back-cat-btn {
  margin-top: 12px;
  padding: 10px 22px;
  background: #111111;
  color: #ffffff;
  border: none;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.back-cat-btn:hover {
  background: #27272a;
}
.supplemental-source-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  color: #92400e;
  font-size: 13px;
  margin-bottom: 20px;
}
.auth-notice, .error-notice {
  margin-bottom: 24px;
}
.login-action-link {
  font-weight: 700;
  color: #111111;
  margin-left: 10px;
  text-decoration: underline;
}
.retry-btn {
  background: none;
  border: none;
  color: inherit;
  font-weight: 700;
  text-decoration: underline;
  margin-left: 12px;
  cursor: pointer;
}
.compare-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  padding: 18px 22px;
  background: #f5f5f7;
  border: 1px solid #e5e5e7;
  border-radius: 16px;
  margin-bottom: 24px;
}
.toolbar-left span {
  font-size: 15px;
  font-weight: 750;
  color: #111111;
}
.toolbar-left small {
  display: block;
  font-size: 11px;
  color: #71717a;
  margin-top: 4px;
}
.toolbar-center {
  display: flex;
  align-items: center;
}
.quick-pickers {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.quick-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #52525b;
}
.quick-select {
  padding: 7px 12px;
  font-size: 13px;
  font-family: inherit;
  border: 1px solid #d4d4d8;
  border-radius: 10px;
  background: #ffffff;
  color: #111111;
  max-width: 220px;
}
.quick-vs {
  font-size: 12px;
  font-weight: 800;
  color: #71717a;
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 18px;
}
.diff-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #111111;
  cursor: pointer;
  user-select: none;
}
.diff-toggle input[type=checkbox] {
  width: 16px;
  height: 16px;
  accent-color: #111111;
  cursor: pointer;
}
.count-buttons {
  display: flex;
  gap: 6px;
}
.compare-skeleton-wrap {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.skeleton-cards-grid {
  display: grid;
  gap: 20px;
}
.skeleton-card {
  border: 1px solid #e5e5e7;
  border-radius: 20px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.skel-img {
  width: 100%;
  height: 196px;
}
.skel-title {
  width: 60%;
  height: 22px;
}
.skel-meta {
  width: 40%;
  height: 14px;
}
.skeleton-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.skel-row {
  width: 100%;
  height: 64px;
}
.picker-card {
  padding: 28px !important;
  border-radius: 16px !important;
  border: 1px solid #e5e5e7 !important;
  box-shadow: none !important;
}
.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.picker-header h2 {
  font-size: 18px;
  font-weight: 750;
  color: #111111;
}
.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: #71717a;
  cursor: pointer;
  padding: 4px;
}
.close-btn:hover {
  color: #111111;
}
.picker-search-bar {
  margin-bottom: 14px;
}
.picker-input {
  width: 100%;
  padding: 11px 14px;
  font-size: 14px;
  border: 1px solid #d4d4d8;
  border-radius: 10px;
  font-family: inherit;
  color: #111111;
  outline: none;
  box-sizing: border-box;
}
.picker-input:focus {
  border-color: #111111;
  box-shadow: 0 0 0 2px rgba(17, 17, 17, 0.12);
}
.picker-brand-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.brand-tab {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 9999px;
  border: 1px solid #e5e5e7;
  background: #ffffff;
  color: #52525b;
  cursor: pointer;
}
.brand-tab.active {
  background: #111111;
  border-color: #111111;
  color: #ffffff;
}
.picker-product-list {
  max-height: 340px;
  overflow-y: auto;
  border: 1px solid #e5e5e7;
  border-radius: 12px;
  margin-bottom: 16px;
}
.picker-product-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f4f4f5;
  cursor: pointer;
  transition: background .12s ease;
}
.picker-product-item:last-child {
  border-bottom: none;
}
.picker-product-item:hover, .picker-product-item:focus {
  background: #f5f5f7;
  outline: none;
}
.item-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.item-brand-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  text-transform: uppercase;
}
.tag-samsung {
  background: #f4f4f5;
  color: #111111;
}
.tag-apple {
  background: #18181b;
  color: #ffffff;
}
.item-model-name {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: #111111;
}
.item-sub {
  font-size: 12px;
  color: #71717a;
}
.item-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.item-date {
  font-size: 11px;
  color: #71717a;
}
.item-select-action {
  font-size: 12px;
  font-weight: 700;
  color: #111111;
}
.picker-empty {
  padding: 32px;
  text-align: center;
  font-size: 13px;
  color: #71717a;
}
.picker-footer {
  display: flex;
  justify-content: flex-end;
}
.picker-cancel-btn {
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid #d4d4d8;
  background: #ffffff;
  border-radius: 9999px;
  cursor: pointer;
  color: #52525b;
}
.picker-cancel-btn:hover {
  background: #f5f5f7;
  color: #111111;
}
</style>
