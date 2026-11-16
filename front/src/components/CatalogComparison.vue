<template>
  <div class="catalog-comparison">
    <div class="compare-controls">
      <h2>{{ label }} 비교 <small v-if="!loading && !catalogError">· {{ models.length }}개 모델</small></h2>
      <div class="d-flex flex-wrap ga-2">
        <label class="mr-2"><input v-model="onlyDifferences" type="checkbox"> 차이 있는 항목만 보기</label>
        <v-btn v-for="number in [2, 3]" :key="number" size="small" rounded="pill"
          :variant="count === number ? 'flat' : 'outlined'" :aria-pressed="count === number"
          @click="setCount(number)">{{ number }}개 비교</v-btn>
      </div>
    </div>

    <v-alert v-if="catalogError" type="error" variant="tonal" role="alert">
      {{ catalogError }} <v-btn variant="text" @click="loadModels">다시 시도</v-btn>
    </v-alert>
    <p v-else-if="loading" role="status">제품 목록을 불러오는 중이에요.</p>
    <p v-else-if="!models.length">등록된 공개 제품이 없어요.</p>
    <template v-else>
      <div class="device-grid hero-row" :style="columnStyle">
        <article v-for="(slot, index) in visibleSlots" :key="index" class="device-column">
          <div class="col-utility">
            <span>{{ modelFor(slot)?.brand || '기기 ' + (index + 1) }}</span>
            <button v-if="slot.modelId" type="button" @click="selectModel(index, null)">제거</button>
          </div>
          <div class="pedestal">
            <img v-if="imageUrl(slot, index)" :key="imageUrl(slot, index)" :src="imageUrl(slot, index)"
              :alt="modelFor(slot)?.model_name" @error="failedImages.add(index + ':' + imageUrl(slot, index))">
            <template v-else>
              <v-icon :icon="deviceIcons[category]" size="62" aria-hidden="true" />
              <small>{{ slot.modelId ? '제품 이미지 없음' : '선택된 기기 없음' }}</small>
            </template>
          </div>
          <h3 v-if="slot.modelId">{{ modelFor(slot)?.model_name }}</h3>
          <p v-if="slot.modelId" class="muted">{{ modelFor(slot)?.model_number }}</p>
          <div v-if="selectedSku(slot)" class="option-panel">
            <div v-for="group in skuDimensions(category, slot.skus)" :key="group.key" class="option-field">
              <span>{{ fieldLabels[group.key] }}</span>
              <strong v-if="group.values.length === 1">{{ displayValue(group.key, skuValue(selectedSku(slot), group.key)) }}</strong>
              <div v-else class="option-chips" role="group" :aria-label="fieldLabels[group.key]">
                <button v-for="value in group.values" :key="value" type="button"
                  :aria-pressed="skuValue(selectedSku(slot), group.key) === value"
                  :disabled="!optionSku(slot, index, group.key, value)"
                  @click="changeOption(slot, index, group.key, value)">
                  {{ displayValue(group.key, value) }}
                </button>
              </div>
            </div>
            <small v-if="slot.notice" role="status">{{ slot.notice }}</small>
          </div>

          <div v-if="selectedSku(slot)" class="hero-price">
            <template v-if="selectedSku(slot).reference_price">
              <strong>{{ priceAmount(selectedSku(slot).reference_price) }}</strong>
              <small>{{ selectedSku(slot).reference_price.price_source === 'danawa_reference' ? DANAWA_REFERENCE_LABEL : '수집 당시 참고 가격' }}</small>
              <small>{{ selectedSku(slot).reference_price.seller_name }} · {{ formatPriceCheckedAt(selectedSku(slot).reference_price) }}</small>
              <a v-if="safeLink(selectedSku(slot).reference_price.product_url)"
                :href="safeLink(selectedSku(slot).reference_price.product_url)" target="_blank" rel="noopener noreferrer">
                {{ selectedSku(slot).reference_price.price_source === 'danawa_reference' ? '다나와에서 가격 비교하기' : '상품 페이지 확인' }}
              </a>
            </template>
            <template v-else>
              <strong>{{ priceStatusLabel(selectedSku(slot).price_status) }}</strong>
              <small v-if="selectedSku(slot).price_status_reviewed_at">
                확인 기록 · {{ formatPriceCheckedAt({ checked_at: selectedSku(slot).price_status_reviewed_at }) }}
              </small>
            </template>
          </div>

          <button type="button" class="device-select" :aria-label="'기기 ' + (index + 1) + (slot.modelId ? ' 변경' : ' 선택')"
            @click="openPicker(index)">{{ slot.modelId ? '기기 변경' : '기기 선택' }}</button>
          <p v-if="slot.loading" role="status">옵션을 불러오는 중이에요.</p>
          <p v-else-if="slot.error" role="alert">
            {{ slot.error }} <v-btn variant="text" @click="selectModel(index, slot.modelId)">다시 시도</v-btn>
          </p>
          <p v-else-if="slot.modelId && !slot.skuId" role="status">비교에 추가할 수 있는 다른 옵션이 없어요.</p>
        </article>
      </div>
      <v-dialog v-model="pickerOpen" max-width="620">
        <v-card class="picker-card" title="비교할 기기 선택">
          <v-card-text>
            <v-select v-model="pickerBrand" :items="brands" label="제조사" variant="outlined" density="compact" />
            <v-text-field v-model="pickerQuery" label="모델명 또는 모델번호 검색" variant="outlined" density="compact" />
            <div class="picker-list">
              <button v-for="model in filteredModels" :key="model.model_id" type="button" @click="pickModel(model)">
                <strong>{{ model.model_name }}</strong><small>{{ model.brand }} · {{ model.model_number }}</small>
              </button>
              <p v-if="!filteredModels.length">검색 조건에 맞는 기기가 없어요.</p>
            </div>
          </v-card-text>
          <v-card-actions><v-btn variant="text" @click="pickerOpen = false">닫기</v-btn></v-card-actions>
        </v-card>
      </v-dialog>
    </template>

    <p v-if="comparing" role="status">비교할 사양을 불러오는 중이에요.</p>
    <v-alert v-else-if="comparisonError" type="error" variant="tonal" role="alert">
      {{ comparisonError }} <v-btn variant="text" @click="refresh">다시 시도</v-btn>
    </v-alert>
    <template v-else-if="result">
      <div class="apple-section-divider" aria-hidden="true"></div>
      <section class="visual-specs-area" :aria-label="label + ' 핵심 사양 비교'">
        <div v-if="!coreFields.length" class="no-diff-notice">표시할 핵심 사양 차이가 없어요.</div>
        <div v-else class="device-grid specs-matrix" :style="columnStyle">
          <template v-for="field in coreFields" :key="field.key">
            <div v-for="(itemIndex, column) in resultColumns" :key="column" class="visual-spec-block">
              <template v-if="itemIndex !== -1">
                <div class="spec-icon-holder" aria-hidden="true"><v-icon :icon="specIcon(field.key)" size="26" /></div>
                <strong :class="['spec-headline-val', {
                  'is-unknown': field.values[itemIndex] == null,
                  'spec-leading': isHigher(field, itemIndex)
                }]">{{ formatCoreValue(field, itemIndex) }}</strong>
                <span class="spec-sub-caption">{{ fieldLabels[field.key] }}</span>
              </template>
              <span v-else class="cell-empty" aria-hidden="true">—</span>
            </div>
          </template>
        </div>
      </section>
      <div class="detailed-toggle-wrap">
        <button type="button" class="detail-accordion-btn" :aria-expanded="detailsOpen" aria-controls="catalog-detail"
          @click="detailsOpen = !detailsOpen">
          {{ detailsOpen ? '상세 사양 접기' : '상세 사양 보기' }}
          <span class="btn-meta">({{ detailGroups.length }}개 영역)</span>
          <span class="btn-arrow" aria-hidden="true">{{ detailsOpen ? '⌃' : '⌄' }}</span>
        </button>
      </div>
      <div v-if="detailsOpen" id="catalog-detail" class="comparison-table" tabindex="0" role="region" :aria-label="label + ' 상세 사양 비교'">
        <table>
          <thead><tr><th scope="col">비교 항목</th>
            <th v-for="{ model, sku } in result.items" :key="sku.sku_id" scope="col">
              {{ model.model_name }}<small>{{ sku.color }}</small>
            </th>
          </tr></thead>
          <tbody v-for="group in detailGroups" :key="group.label">
            <tr class="group-heading"><th scope="colgroup" :colspan="result.items.length + 1">{{ group.label }}</th></tr>
            <tr v-for="field in group.fields" :key="field.key">
              <th scope="row">{{ fieldLabels[field.key] }}</th>
              <td v-for="(value, index) in field.values" :key="index" :class="{ higher: isHigher(field, index) }">
                {{ formatField(field, value, index) }}
              </td>
            </tr>
          </tbody>
          <tbody><tr><th scope="row">사양 출처</th>
            <td v-for="{ model, sku } in result.items" :key="sku.sku_id">
              <a v-if="safeLink(model.source?.url)" :href="safeLink(model.source.url)" target="_blank" rel="noopener noreferrer">모델 사양</a>
              <a v-if="safeLink(sku.source?.url) && sku.source.url !== model.source?.url" :href="safeLink(sku.source.url)"
                target="_blank" rel="noopener noreferrer">옵션 사양</a>
              <span v-if="!safeLink(model.source?.url) && !safeLink(sku.source?.url)">정보 없음</span>
            </td>
          </tr></tbody>
        </table>
      </div>
    </template>
    <p v-else-if="!loading && models.length" role="status">서로 다른 옵션 2개를 선택하면 사양을 비교할 수 있어요.</p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { skuDimensions, skuValue, chooseSku, priceStatusLabel } from '../utils/catalogComparison'
import { memberMessage } from '../composables/useMemberApi'
import { DANAWA_REFERENCE_LABEL, formatPriceCheckedAt, getDanawaProductUrl } from '../utils/priceDisplay'

const props = defineProps({
  api: { type: Object, required: true },
  category: { type: String, required: true },
  label: String,
  initialModelId: [String, Number],
  initialSkuId: [String, Number],
  peerModelId: [String, Number],
  peerSkuId: [String, Number],
  initialVariants: [String, Array]
})
const models = ref([])
const loading = ref(true)
const catalogError = ref('')
const count = ref(2)
const onlyDifferences = ref(false)
const emptySlot = () => ({ modelId: null, skuId: null, skus: [], loading: false, error: '', notice: '' })
const slots = ref(Array.from({ length: 3 }, emptySlot))
const visibleSlots = computed(() => slots.value.slice(0, count.value))
const columnStyle = computed(() => ({ '--columns': count.value, '--tablet-gap': count.value === 3 ? '16px' : '32px', '--tablet-row-gap': count.value === 3 ? '16px' : '42px' }))
const pickerOpen = ref(false)
const pickerSlot = ref(0)
const pickerBrand = ref('전체')
const pickerQuery = ref('')
const brands = computed(() => ['전체', ...new Set(models.value.map(model => model.brand))])
const filteredModels = computed(() => {
  const query = pickerQuery.value.trim().toLowerCase()
  return models.value.filter(model => (pickerBrand.value === '전체' || pickerBrand.value === model.brand) &&
    [model.brand, model.model_name, model.model_number].some(value => value?.toLowerCase().includes(query)))
})
const detailsOpen = ref(false)
const failedImages = ref(new Set())
const deviceIcons = { tablet: 'mdi-tablet', laptop: 'mdi-laptop', smartwatch: 'mdi-watch-variant',
  earbuds: 'mdi-headphones', speaker: 'mdi-speaker' }
const result = ref(null)
const comparisonError = ref('')
const comparing = ref(false)
const requests = new AbortController()
const skuRequests = []
let comparisonRequest

const fieldLabels = {
  battery: '배터리', color: '색상', case_material: '케이스 재질', band: '밴드', released_on: '출시일',
  release_month: '출시월', manufacturer_part_number: '옵션 모델번호', chipset: '칩셋', cpu: 'CPU', gpu: 'GPU', os: '운영체제', compatible_os: '호환 운영체제',
  storage_gb: '저장 용량', ram_gb: 'RAM', display: '디스플레이', screen_inches: '화면 크기', refresh_hz: '주사율',
  pen_supported: '펜 지원', keyboard_supported: '키보드 지원', connectivity: '연결 방식',
  battery_mah: '배터리 용량', battery_wh: '배터리 에너지', battery_hours: '재생 시간', battery_condition: '재생 조건',
  weight_g: '무게', reference_price: '참고 가격', storage_type: '저장 장치', ports: '포트',
  gps: 'GPS', sensors: '센서', case_size_mm: '케이스 크기', water_resistance: '방수·방진',
  anc: '액티브 노이즈 캔슬링', driver: '드라이버', codecs: '코덱', latency_ms: '지연 시간',
  wireless_charging: '무선 충전', bluetooth_version: 'Bluetooth 버전', power_w: '출력',
  audio_configuration: '오디오 구성', audio_formats: '오디오 포맷', power_supply: '전원 방식', dimensions_mm: '기기 크기'
}
const units = { storage_gb: 'GB', ram_gb: 'GB', screen_inches: '인치', refresh_hz: 'Hz',
  battery_mah: 'mAh', battery_wh: 'Wh', battery_hours: '시간', weight_g: 'g', case_size_mm: 'mm',
  latency_ms: 'ms', power_w: 'W', dimensions_mm: 'mm' }
const connections = { wifi: 'Wi-Fi', cellular: '셀룰러', bluetooth: 'Bluetooth', wired: '유선',
  gps: 'GPS', wireless_dongle: '무선 동글', multi: '다중 연결' }

function displayValue(key, value) {
  if (value == null) return '정보 없음'
  if (typeof value === 'boolean') return value ? '지원' : '미지원'
  if (key === 'connectivity') return connections[value] || value
  const formatted = Array.isArray(value) ? value.join(key === 'dimensions_mm' ? ' × ' : ', ') : value
  return units[key] ? formatted + ' ' + units[key] : formatted
}

const safeLink = url => getDanawaProductUrl({ danawa_product_url: url })
const modelFor = slot => models.value.find(model => model.model_id === slot.modelId)
const selectedSku = slot => slot.skus.find(sku => sku.sku_id === slot.skuId)

function imageUrl(slot, index) {
  const url = safeLink(selectedSku(slot)?.image_url || modelFor(slot)?.image_url)
  return url && !failedImages.value.has(index + ':' + url) ? url : null
}

function openPicker(index) {
  pickerSlot.value = index
  pickerBrand.value = '전체'
  pickerQuery.value = ''
  pickerOpen.value = true
}

function pickModel(model) {
  pickerOpen.value = false
  selectModel(pickerSlot.value, model.model_id)
}

function optionSku(slot, index, key, value) {
  return chooseSku(slot.skus, skuDimensions(props.category, slot.skus), selectedSku(slot), key, value,
    sku => usedInOtherSlot(slot.modelId, sku.sku_id, index))
}

function changeOption(slot, index, key, value) {
  const option = optionSku(slot, index, key, value)
  if (!option) return
  slot.skuId = option.sku.sku_id
  slot.notice = option.changed.map(field => fieldLabels[field] + ' ' + displayValue(field, skuValue(option.sku, field))).join(' · ')
  if (slot.notice) slot.notice = '가능한 구성으로 함께 변경됨 · ' + slot.notice
}

function priceAmount(price) {
  if (!/^\d+$/.test(price.amount_minor)) return '가격 정보 없음'
  if (price.currency === 'KRW') return BigInt(price.amount_minor).toLocaleString('ko-KR') + '원'
  return '가격 정보 없음' // This page requests the API's default KRW observations.
}

function usedInOtherSlot(modelId, skuId, index) {
  return visibleSlots.value.some((slot, pos) => pos !== index && slot.modelId === modelId && slot.skuId === skuId)
}

function setCount(number) {
  if (number === 2) {
    skuRequests[2]?.abort()
    slots.value[2] = emptySlot()
  }
  count.value = number
}

async function applyInitialSelections() {
  if (!models.value.length) return
  if (props.initialModelId && models.value.some(m => String(m.model_id) === String(props.initialModelId))) {
    await selectModel(0, props.initialModelId, props.initialSkuId)
    if (props.peerModelId && models.value.some(m => String(m.model_id) === String(props.peerModelId))) {
      await selectModel(1, props.peerModelId, props.peerSkuId)
    } else {
      const other = models.value.find(m => String(m.model_id) !== String(props.initialModelId))
      if (other) await selectModel(1, other.model_id)
    }
  } else if (models.value.length >= 2) {
    await selectModel(0, models.value[0].model_id)
    await selectModel(1, models.value[1].model_id)
  }
}

async function loadModels() {
  loading.value = true
  catalogError.value = ''
  try {
    models.value = await props.api.models(props.category, requests.signal)
    if (!requests.signal.aborted && models.value.length) {
      await applyInitialSelections()
    }
  }
  catch (error) { if (!requests.signal.aborted) catalogError.value = memberMessage(error) }
  finally { loading.value = false }
}

async function selectModel(index, modelId, targetSkuId = null) {
  skuRequests[index]?.abort()
  slots.value[index] = { ...emptySlot(), modelId }
  if (!modelId) return
  const current = new AbortController()
  skuRequests[index] = current
  const slot = slots.value[index]
  slot.loading = true
  try {
    const options = await props.api.skus(props.category, modelId, current.signal)
    if (current.signal.aborted) return
    slot.skus = options
    if (targetSkuId && options.some(s => String(s.sku_id) === String(targetSkuId))) {
      slot.skuId = options.find(s => String(s.sku_id) === String(targetSkuId)).sku_id
    } else {
      slot.skuId = options.find(sku => !usedInOtherSlot(modelId, sku.sku_id, index))?.sku_id ?? options[0]?.sku_id ?? null
    }
  } catch (error) {
    if (!current.signal.aborted) slot.error = memberMessage(error)
  } finally {
    if (!current.signal.aborted) slot.loading = false
  }
}

const selections = computed(() => visibleSlots.value.flatMap(slot => slot.modelId && slot.skuId ? [slot.modelId + ':' + slot.skuId] : []))
const selectionKey = computed(() => selections.value.join(','))
const coreKeys = {
  tablet: ['display', 'chipset', 'ram_gb', 'storage_gb', 'battery', 'pen_supported', 'weight_g'],
  laptop: ['display', 'cpu', 'gpu', 'ram_gb', 'storage_gb', 'battery_wh', 'weight_g'],
  smartwatch: ['display', 'compatible_os', 'gps', 'sensors', 'battery_mah', 'water_resistance'],
  earbuds: ['anc', 'driver', 'codecs', 'battery_hours', 'wireless_charging', 'water_resistance'],
  speaker: ['power_w', 'connectivity', 'battery_hours', 'water_resistance', 'weight_g']
}
const extraKeys = ['color', 'case_material', 'band', 'released_on', 'release_month', 'manufacturer_part_number']
const extraFields = computed(() => extraKeys.map(key => ({
  key,
  values: (result.value?.items || []).map(({ model, sku }) => skuValue(sku, key) ??
    model[key] ?? model.specifications?.[key] ?? null)
})).filter(field => field.values.some(value => value !== null)))

function specIcon(key) {
  if (key.startsWith('battery')) return 'mdi-battery'
  if (['display', 'screen_inches'].includes(key)) return 'mdi-monitor'
  if (['cpu', 'gpu', 'chipset', 'ram_gb'].includes(key)) return 'mdi-memory'
  if (key === 'storage_gb') return 'mdi-harddisk'
  if (key === 'water_resistance') return 'mdi-water-outline'
  if (key === 'weight_g') return 'mdi-scale'
  if (key === 'gps') return 'mdi-map-marker-outline'
  if (key === 'power_w' || key === 'power_supply') return 'mdi-lightning-bolt-outline'
  return deviceIcons[props.category]
}

function formatField(field, value, index) {
  if (field.key !== 'reference_price') return displayValue(field.key, value)
  return value ? priceAmount(value) : priceStatusLabel(result.value.items[index].sku.price_status)
}

function isHigher(field, index) {
  return field.higher_sku_ids?.includes(result.value.items[index].sku.sku_id)
}

const resultColumns = computed(() => visibleSlots.value.map(slot =>
  result.value?.items.findIndex(({ model, sku }) => model.model_id === slot.modelId && sku.sku_id === slot.skuId) ?? -1))

function formatCoreValue(field, index) {
  return displayValue(field.valueKeys?.[index] ?? field.key, field.values[index])
}

const displayedFields = computed(() => [...(result.value?.fields || []), ...extraFields.value].filter(field => {
  if (!onlyDifferences.value) return true
  const values = field.key === 'reference_price'
    ? field.values.map((price, index) => price ? [price.currency, price.amount_minor] : result.value.items[index].sku.price_status ?? null)
    : field.values
  return new Set(values.map(value => JSON.stringify(value))).size > 1
}))

const coreFields = computed(() => {
  const fields = new Map(result.value?.fields.map(field => [field.key, field]))
  function combined(key, alternatives) {
    const valueKeys = (result.value?.items || []).map((_, index) =>
      alternatives.find(option => fields.get(option)?.values[index] != null))
    return { key, valueKeys, values: valueKeys.map((option, index) => fields.get(option)?.values[index] ?? null) }
  }
  fields.set('display', combined('display', ['screen_inches', 'display']))
  fields.set('battery', combined('battery', ['battery_wh', 'battery_mah']))
  return coreKeys[props.category].map(key => fields.get(key)).filter(field => field &&
    field.values.some(value => value != null) && (!onlyDifferences.value ||
      new Set(field.values.map((value, i) => JSON.stringify([field.valueKeys?.[i], value]))).size > 1))
})
const detailGroups = computed(() => {
  const groups = [
    ['구성 및 모델 정보', ['connectivity', 'cpu', 'gpu', 'chipset', 'ram_gb', 'storage_gb', 'storage_type',
      'case_size_mm', 'color', 'case_material', 'band', 'os', 'compatible_os', ...extraKeys.slice(3)]],
    ['배터리 및 휴대성', ['battery_mah', 'battery_wh', 'battery_hours', 'battery_condition', 'power_supply',
      'weight_g', 'dimensions_mm', 'wireless_charging']],
    ['가격', ['reference_price']]
  ]
  const assigned = new Set(groups.flatMap(([, keys]) => keys))
  groups.splice(1, 0, ['디스플레이 및 기능', displayedFields.value.map(field => field.key).filter(key => !assigned.has(key))])
  return groups.map(([label, keys]) => ({ label, fields: displayedFields.value.filter(field => keys.includes(field.key)) }))
    .filter(group => group.fields.length)
})

async function refresh() {
  comparisonRequest?.abort()
  result.value = null
  comparing.value = false
  comparisonError.value = ''
  if (selections.value.length < 2) return
  if (new Set(selections.value).size !== selections.value.length) {
    comparisonError.value = '같은 모델의 서로 다른 옵션을 선택해 주세요.'
    return
  }
  const current = new AbortController()
  comparisonRequest = current
  comparing.value = true
  try {
    const response = await props.api.compare(props.category, selections.value, current.signal)
    if (!current.signal.aborted) result.value = response.data
  } catch (error) {
    if (!current.signal.aborted) comparisonError.value = memberMessage(error)
  } finally {
    if (!current.signal.aborted) comparing.value = false
  }
}

watch(selectionKey, refresh)
watch(
  () => [props.initialModelId, props.initialSkuId],
  () => {
    if (models.value.length && props.initialModelId) {
      applyInitialSelections()
    }
  }
)
onMounted(loadModels)
onBeforeUnmount(() => {
  requests.abort()
  skuRequests.forEach(request => request.abort())
  comparisonRequest?.abort()
})
</script>

<style scoped>
.catalog-comparison { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; color: #111; }
.compare-controls, .col-utility { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.compare-controls h2 { font-size: 1.1rem; }
small, .muted { color: #65656b; font-size: .8rem; font-weight: 400; }
.device-grid { display: grid; grid-template-columns: repeat(var(--columns), minmax(0, 1fr)); column-gap: 32px; }
.device-column { min-width: 0; text-align: center; overflow-wrap: anywhere; }
.col-utility { min-height: 36px; font-size: .82rem; color: #65656b; }
.col-utility button { text-decoration: underline; }
.pedestal { height: clamp(112px, 22vw, 240px); display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 6px; color: #71717a; background: #f5f5f7; border-radius: 18px; margin-bottom: 16px; }
.pedestal img { max-width: 90%; max-height: 92%; object-fit: contain; }
.device-column h3 { font-size: clamp(1rem, 2.2vw, 1.65rem); line-height: 1.2; }
.option-panel { display: grid; gap: 8px; text-align: start; margin: 12px 0; }
.option-field { font-size: .8rem; display: grid; gap: 4px; }
.option-field > span { color: #65656b; }
.option-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.option-chips button { max-width: 100%; overflow-wrap: anywhere; border: 1px solid #d4d4d8; border-radius: 999px; padding: 4px 9px; }
.option-chips button[aria-pressed="true"] { border-color: #111; box-shadow: inset 0 0 0 1px #111; font-weight: 700; }
.option-chips button:disabled { opacity: .45; }
.device-select { border-radius: 999px; border: 1px solid currentColor; padding: 7px 14px; margin: 8px 0; }
.hero-price { display: grid; gap: 3px; margin: 14px 0; }
.hero-price strong { font-size: clamp(.9rem, 1.7vw, 1.25rem); }
a { color: inherit; text-decoration: underline; font-size: .83rem; }
.apple-section-divider {
  border-top: 1px solid #e5e5e7;
  margin: 24px 0 16px;
}

/* 3. Pure Vertical Visual Specs Grid (No borders, no left label col, no badges) */
.visual-specs-area {
  margin-bottom: 28px;
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

.spec-headline-val, .spec-sub-caption { overflow-wrap: anywhere; }
.spec-leading { text-decoration: underline; text-decoration-color: #a1a1aa; text-underline-offset: 4px; }
.higher { font-weight: 700; background: #f2f2f5; }
@media (max-width: 800px) {
  .device-grid { column-gap: var(--tablet-gap); }
  .specs-matrix { row-gap: var(--tablet-row-gap); }
  .spec-headline-val { font-size: 17px; }
}
@media (max-width: 560px) {
  .device-grid { column-gap: 12px; }
  .specs-matrix { row-gap: 12px; }
  .spec-headline-val { font-size: 15px; }
}
.comparison-table { min-width: 0; overflow-x: auto; border-radius: 16px; border: 1px solid #e5e5e7; }
table { border-collapse: collapse; width: 100%; }
th, td { padding: 12px; text-align: start; border-bottom: 1px solid #e5e5e7; }
th[scope="row"] { min-width: 106px; }
td { min-width: 114px; overflow-wrap: anywhere; }
td a, th small { display: block; }
.group-heading { background: #f5f5f7; }
.picker-list { display: grid; max-height: 52vh; overflow-y: auto; }
.picker-list button { text-align: start; padding: 12px; border-bottom: 1px solid #e5e5e7; display: grid; }
.picker-list button:hover { background: #f5f5f7; }
@media (max-width: 600px) {
  .device-select { padding-inline: 8px; font-size: .8rem; }
  th, td { padding: 8px; }
  .option-chips button { padding-inline: 6px; }
}
</style>
