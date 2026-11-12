<template>
  <section class="member-page section-wrap recommend-page">
    <header class="member-heading">
      <span class="eyebrow">{{ isUpgradeRoute ? 'UPGRADE ADVISOR · 보유 기기 유지·교체 판단' : 'AI RECOMMENDATION · 스마트폰 구매 가이드' }}</span>
      <h1>{{ isUpgradeRoute ? '지금 스마트폰을 바꿀 때일까요?' : '나에게 맞는 스마트폰 찾기' }}</h1>
      <p>{{ isUpgradeRoute ? '현재 보유 중인 스마트폰과 불편 항목을 바탕으로 유지(KEEP)·보류(DEFER)·교체 추천을 객관적으로 판단해 드려요.' : '단계별로 조건을 선택하면 저장된 프로필과 내부 제품 데이터를 바탕으로 AI가 추천해 드려요.' }}</p>
    </header>

    <p v-if="profileLoading" role="status" class="status-note">저장된 프로필을 확인하고 있어요.</p>
    <v-alert v-if="profileError" type="error" variant="tonal" role="alert" class="mb-6">
      {{ profileError }}
      <v-btn variant="text" @click="loadProfile">다시 확인</v-btn>
    </v-alert>
    <v-alert v-if="profile && !ready" type="warning" variant="tonal" class="mb-6">
      추천 전에 사용 목적과 구매 성향을 저장해 주세요.
      <router-link to="/profile" class="alert-link">내 프로필 설정하기</router-link>
    </v-alert>

    <!-- Step-by-step Wizard Navigation Bar -->
    <nav class="wizard-steps-nav" aria-label="추천 조건 입력 단계">
      <button
        type="button"
        :class="['wizard-step-btn', { active: currentStep === 1, done: hasBudget }]"
        :aria-current="currentStep === 1 ? 'step' : undefined"
        @click="currentStep = 1"
      >
        <span class="step-num">01</span>
        <div class="step-meta">
          <strong>예산 설정</strong>
          <small>{{ hasBudget ? `${Number(form.budget).toLocaleString('ko-KR')}원` : '필수 입력' }}</small>
        </div>
      </button>

      <button
        type="button"
        :class="['wizard-step-btn', { active: currentStep === 2, done: form.usages.length > 0 }]"
        :aria-current="currentStep === 2 ? 'step' : undefined"
        @click="currentStep = 2"
      >
        <span class="step-num">02</span>
        <div class="step-meta">
          <strong>사용 목적</strong>
          <small>{{ form.usages.length ? `${form.usages.length}개 선택` : '1개 이상 선택' }}</small>
        </div>
      </button>

      <button
        type="button"
        :class="['wizard-step-btn', { active: currentStep === 3 }]"
        :aria-current="currentStep === 3 ? 'step' : undefined"
        @click="currentStep = 3"
      >
        <span class="step-num">03</span>
        <div class="step-meta">
          <strong>선호 제조사 · 실행</strong>
          <small>{{ brandSummaryText }}</small>
        </div>
      </button>
    </nav>

    <form class="member-form" @submit.prevent="submit" novalidate>
      <fieldset :disabled="busy || profileLoading || !ready">
        <v-card class="member-card">
          <h2>현재 기기를 계속 사용할까요?</h2>
          <p v-if="devicesError" role="alert">{{ devicesError }}</p>
          <label for="upgrade-device">평가할 보유 스마트폰</label>
          <select id="upgrade-device" v-model="form.deviceId">
            <option value="">기기 선택 없이 일반 구매 추천</option>
            <option v-for="d in devices" :key="d.id" :value="String(d.id)">{{ d.product?.model_name || d.manual_model_name }} · {{ d.product?.storage_gb || d.manual_storage_gb || '용량 미확인' }}{{ d.product?.color ? ' · '+d.product.color : '' }}</option>
          </select>
          <p v-if="!devices.length && !devicesError">등록된 스마트폰이 없어요. <router-link to="/devices">보유 기기 등록</router-link></p>
          <template v-if="form.deviceId">
            <label for="upgrade-reason">교체를 고려하는 이유</label><textarea id="upgrade-reason" v-model="form.reason" maxlength="300" rows="3" />
            <label for="upgrade-intent">현재 사용 만족도·교체 의향</label>
            <select id="upgrade-intent" v-model="form.intent"><option value="low_or_keep_if_okay">만족하며 가능하면 유지</option><option value="moderate">유지와 교체를 비교하고 싶음</option><option value="high">불편해서 교체하고 싶음</option></select>
            <fieldset><legend>만족하는 항목 (최대 6개)</legend><label v-for="(label,key) in aspects" :key="key"><input v-model="form.satisfied" type="checkbox" :value="key"> {{ label }}</label></fieldset>
            <fieldset><legend>개선하고 싶은 불편 (최대 6개)</legend><label v-for="(label,key) in aspects" :key="key"><input v-model="form.pains" type="checkbox" :value="key"> {{ label }}</label></fieldset>
            <label for="upgrade-os">선호 운영체제</label><select id="upgrade-os" v-model="form.os"><option value="">상관없음</option><option value="android">Android</option><option value="ios">iOS</option></select>
            <p>평소 중요도는 저장된 프로필을 사용합니다. 검증된 비교 근거가 없으면 교체를 단정하지 않습니다.</p>
          </template>
        </v-card>
        <v-card class="member-card wizard-card">
          <!-- STEP 1: Budget -->
          <div v-show="currentStep === 1" class="wizard-panel">
            <div class="panel-header">
              <span class="step-badge">STEP 01</span>
              <h2>어느 정도 예산을 생각하고 계신가요?</h2>
              <p>선택한 최대 예산 내에서 구매 후보와 기기 유지 여부를 함께 검토합니다.</p>
            </div>

            <div class="budget-presets" role="group" aria-label="빠른 예산 선택">
              <button
                v-for="preset in budgetPresets"
                :key="preset.value"
                type="button"
                :class="['preset-chip', { active: String(form.budget) === String(preset.value) }]"
                @click="form.budget = preset.value"
              >
                {{ preset.label }}
              </button>
            </div>

            <label for="recommend-budget">최대 예산 · 원 (직접 입력 가능)</label>
            <input
              id="recommend-budget"
              v-model="form.budget"
              type="number"
              min="1"
              max="10000000"
              step="1"
              inputmode="numeric"
              placeholder="예: 1200000"
              required
              aria-describedby="budget-help"
            >
            <small id="budget-help">최대 1천만 원. 개발용 대체 가격은 실제 구매 비용과 다를 수 있습니다.</small>

            <div class="wizard-footer-nav end">
              <button type="button" class="nav-next-btn" @click="currentStep = 2">
                다음: 사용 목적 선택 →
              </button>
            </div>
          </div>

          <!-- STEP 2: Usage Purposes -->
          <div v-show="currentStep === 2" class="wizard-panel">
            <div class="panel-header">
              <span class="step-badge">STEP 02</span>
              <h2>스마트폰으로 주로 무엇을 하시나요?</h2>
              <p>가장 자주 활용하는 작업을 1개 이상 선택해 주세요. (중복 선택 가능)</p>
            </div>

            <fieldset class="choice-group usage-grid">
              <legend class="sr-only">주요 사용 목적 · 1개 이상</legend>
              <label
                v-for="item in purposeItems"
                :key="item.key"
                :class="['usage-tile', { checked: form.usages.includes(item.key) }]"
              >
                <input v-model="form.usages" type="checkbox" :value="item.key">
                <span class="tile-icon" aria-hidden="true">
                  <v-icon :icon="item.icon" size="22" />
                </span>
                <span class="tile-copy">
                  <strong>{{ item.label }}</strong>
                  <small>{{ item.desc }}</small>
                </span>
              </label>
            </fieldset>

            <div class="wizard-footer-nav">
              <button type="button" class="nav-prev-btn" @click="currentStep = 1">
                ← 이전: 예산 설정
              </button>
              <button type="button" class="nav-next-btn" @click="currentStep = 3">
                다음: 선호 제조사 · 확인 →
              </button>
            </div>
          </div>

          <!-- STEP 3: Brand Preference & Submit -->
          <div v-show="currentStep === 3" class="wizard-panel">
            <div class="panel-header">
              <span class="step-badge">STEP 03</span>
              <h2>선호하는 제조사가 있으신가요?</h2>
              <p>제조사 선호는 우선순위이며 필수 제한이 아닙니다. 이번 조건은 영구 프로필을 변경하지 않습니다.</p>
            </div>

            <fieldset class="choice-group brand-grid">
              <legend class="sr-only">선호 제조사 · 선택</legend>
              <button
                type="button"
                :class="['brand-tile', { checked: form.brands.length === 0 }]"
                @click="form.brands = []"
              >
                <strong>상관없음 (전체)</strong>
                <small>제조사 구분 없이 최적 기기 탐색</small>
              </button>

              <label :class="['brand-tile', { checked: form.brands.includes('samsung') }]">
                <input v-model="form.brands" type="checkbox" value="samsung">
                <strong>삼성</strong>
                <small>갤럭시 시리즈 우선 고려</small>
              </label>

              <label :class="['brand-tile', { checked: form.brands.includes('apple') }]">
                <input v-model="form.brands" type="checkbox" value="apple">
                <strong>애플</strong>
                <small>아이폰 시리즈 우선 고려</small>
              </label>
            </fieldset>

            <!-- Live Condition Summary Strip -->
            <div class="wizard-summary-box" aria-label="선택한 추천 조건 요약">
              <div class="summary-row">
                <span class="sum-key">최대 예산</span>
                <strong class="sum-val">{{ hasBudget ? `${Number(form.budget).toLocaleString('ko-KR')}원` : '미입력 (필수)' }}</strong>
              </div>
              <div class="summary-row">
                <span class="sum-key">주요 목적</span>
                <strong class="sum-val">{{ usageSummaryText }}</strong>
              </div>
              <div class="summary-row">
                <span class="sum-key">선호 제조사</span>
                <strong class="sum-val">{{ brandSummaryText }}</strong>
              </div>
            </div>

            <div class="submit-zone">
              <div class="wizard-footer-nav">
                <button type="button" class="nav-prev-btn" @click="currentStep = 2">
                  ← 이전: 사용 목적
                </button>
                <div class="submit-cta-wrap">
                  <p class="submit-caption">버튼을 누르면 AI 추천을 요청하고 서버에 결과가 저장됩니다.</p>
                  <AppButton type="submit" block :loading="busy" :disabled="busy || !ready">
                    {{ busy ? '추천을 확인하고 있어요' : 'AI 추천 받기' }}
                  </AppButton>
                </div>
              </div>
            </div>
          </div>
        </v-card>
      </fieldset>
    </form>

    <div ref="resultRegion" tabindex="-1" class="recommendation-output">
      <RecommendationResult
        :result="result"
        :loading="busy"
        :error="error"
        :owned-variant-id="selectedOwnedVariantId"
      />
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import AppButton from '../components/AppButton.vue'
import RecommendationResult from '../components/RecommendationResult.vue'
import { useMemberApi } from '../composables/useMemberApi'
import { createRecommendationApi, buildRecommendationRequest, recommendationMessage } from '../api/recommendations'

const callApi = useMemberApi()
const api = createRecommendationApi(callApi)
const profile = ref(null)
const profileLoading = ref(false)
const profileError = ref('')
const busy = ref(false)
const error = ref('')
const result = ref(null)
const resultRegion = ref(null)
const currentStep = ref(1)

const route = useRoute() || {query:{}}
const devices = ref([])
const devicesError = ref('')
const aspects = {battery:'배터리',camera:'카메라',performance:'성능',portability:'휴대성',display:'화면',storage:'저장 용량',price:'비용',os_ecosystem:'OS·생태계'}
const form = reactive({ budget: '', usages: [], brands: [], deviceId: '', reason:'', intent:'moderate', satisfied:[], pains:[], os:'', priorities:[] })
const ready = computed(() => !!profile.value?.confirmed_at && !!profile.value?.common?.spending_style && !!profile.value?.common?.usages?.length)
const isUpgradeRoute = computed(() => route.path === '/upgrade')
const selectedOwnedVariantId = computed(() => {
  const selected = devices.value.find(d => String(d.id) === String(form.deviceId))
  return result.value?.owned_variant_id || selected?.product?.variant_id || selected?.variant_id || ''
})

const budgetPresets = [
  { label: '50만 원 이하', value: 500000 },
  { label: '80만 원대', value: 850000 },
  { label: '120만 원대', value: 1200000 },
  { label: '150만 원 이상', value: 1500000 }
]

const purposes = {
  communication: '연락·소통',
  video: '영상 시청',
  coding: '코딩',
  gaming: '게임',
  camera: '사진·영상 촬영',
  work: '업무'
}

const purposeItems = [
  { key: 'communication', label: '연락·소통', desc: '통화·메신저·일상 검색', icon: 'mdi-message-text-outline' },
  { key: 'video', label: '영상 시청', desc: '유튜브·OTT 스트리밍', icon: 'mdi-play-circle-outline' },
  { key: 'coding', label: '코딩', desc: '개발·문서·멀티태스킹', icon: 'mdi-code-tags' },
  { key: 'gaming', label: '게임', desc: '고사양 3D·고주사율', icon: 'mdi-gamepad-variant-outline' },
  { key: 'camera', label: '사진·영상 촬영', desc: '야간·인물·여행 기록', icon: 'mdi-camera-outline' },
  { key: 'work', label: '업무', desc: '메일·화상회의·보안', icon: 'mdi-briefcase-outline' }
]

const hasBudget = computed(() => {
  const n = Number(form.budget)
  return form.budget !== '' && Number.isFinite(n) && n > 0
})

const usageSummaryText = computed(() => {
  if (!form.usages.length) return '선택 없음 (1개 이상 필수)'
  return form.usages.map(k => purposes[k] || k).join(', ')
})

const brandSummaryText = computed(() => {
  if (!form.brands.length) return '전체 (상관없음)'
  return form.brands.map(b => b === 'samsung' ? '삼성' : b === 'apple' ? '애플' : b).join(', ')
})

const controller = new AbortController()

async function applyDefaultUpgradeDevice() {
  if (route.path !== '/upgrade' || route.query.device || form.deviceId || !devices.value.length) return
  let preferredId = ''
  try {
    const offer = await callApi('/api/upgrade-offer', { signal: controller.signal })
    const offeredId = offer?.data?.current_device?.owned_device_id
    if (offeredId && devices.value.some(d => String(d.id) === String(offeredId))) {
      preferredId = String(offeredId)
    }
  } catch (_) {
    // upgrade-offer 조회 실패 시 등록된 스마트폰 중 첫 기기로 폴백
  }
  if (!preferredId) {
    const fallbackDevice = devices.value.find(d => d.product?.verified) || devices.value[0]
    preferredId = fallbackDevice ? String(fallbackDevice.id) : ''
  }
  if (preferredId) form.deviceId = preferredId
}

watch(
  () => [route.path, route.query.device],
  async ([newPath, newDevice]) => {
    if (newDevice && devices.value.some(d => String(d.id) === String(newDevice))) {
      devicesError.value = ''
      form.deviceId = String(newDevice)
      return
    }
    if (newPath === '/upgrade') {
      await applyDefaultUpgradeDevice()
    }
  }
)

async function loadProfile() {
  if (profileLoading.value) return
  profileLoading.value = true
  profileError.value = ''
  try {
    profile.value = (await api.profile(controller.signal)).data
    if (!form.usages.length) form.usages = [...(profile.value.common?.usages || [])]
    if (!form.brands.length) form.brands = [...(profile.value.smartphone?.preferred_brands || [])]
    if (!form.os) form.os = profile.value.smartphone?.preferred_os || ''
    if (!form.priorities.length) form.priorities = [...(profile.value.smartphone?.priorities || [])]
    try {
      devices.value = (await api.devices(controller.signal)).data.filter(d=>d.category==='smartphone')
      if (route.query.device && devices.value.some(d=>String(d.id)===String(route.query.device))) form.deviceId=String(route.query.device)
      else if(route.query.device) devicesError.value='선택한 기기를 찾을 수 없습니다. 본인의 등록 기기를 선택해 주세요.'
      else await applyDefaultUpgradeDevice()
    } catch(e) { devicesError.value=recommendationMessage(e) }
  } catch (e) {
    if (e.name !== 'AbortError') profileError.value = recommendationMessage(e)
  } finally {
    profileLoading.value = false
  }
}

async function submit() {
  if (busy.value || !ready.value) return
  error.value = ''
  result.value = null
  try {
    buildRecommendationRequest(form, profile.value.version)
  } catch (e) {
    error.value = e.message
    if (!hasBudget.value) currentStep.value = 1
    else if (!form.usages.length) currentStep.value = 2
    await nextTick()
    resultRegion.value?.focus()
    return
  }
  busy.value = true
  try {
    profile.value = (await api.profile(controller.signal)).data
    if (!ready.value) throw { code: 'PROFILE_INCOMPLETE' }
    const response = await api.recommend(buildRecommendationRequest(form, profile.value.version), controller.signal)
    if (!['recommend', 'no_match', 'clarify', 'keep', 'defer'].includes(response.data?.status)) {
      throw { code: 'INVALID_RESPONSE' }
    }
    result.value = response.data
  } catch (e) {
    if (e.name !== 'AbortError') error.value = recommendationMessage(e)
  } finally {
    busy.value = false
    await nextTick()
    resultRegion.value?.focus()
  }
}

onMounted(loadProfile)
onBeforeUnmount(() => controller.abort())
</script>

<style scoped>
.status-note {
  margin-bottom: 16px;
  font-size: 14px;
  color: #52525b;
}

.alert-link {
  font-weight: 700;
  text-decoration: underline;
  margin-left: 8px;
  color: inherit;
}

/* Wizard Stepper Bar */
.wizard-steps-nav {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.wizard-step-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #ffffff;
  border: 1px solid #e5e5e7;
  border-radius: 14px;
  padding: 14px 18px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.wizard-step-btn:hover {
  background: #fafafa;
  border-color: #d4d4d8;
}

.wizard-step-btn.active {
  background: #111111;
  border-color: #111111;
  color: #ffffff;
}

.step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #f5f5f7;
  color: #111111;
  font-size: 12px;
  font-weight: 800;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.wizard-step-btn.active .step-num {
  background: #ffffff;
  color: #111111;
}

.wizard-step-btn.done:not(.active) .step-num {
  background: #111111;
  color: #ffffff;
}

.step-meta strong {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: inherit;
}

.step-meta small {
  display: block;
  font-size: 11px;
  color: #71717a;
  margin-top: 2px;
}

.wizard-step-btn.active .step-meta small {
  color: #d4d4d8;
}

/* Wizard Panel Card */
.wizard-card {
  margin: 0 !important;
}

.panel-header {
  margin-bottom: 24px;
}

.step-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #71717a;
  margin-bottom: 8px;
}

.panel-header h2 {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: #111111;
  margin-bottom: 6px;
}

.panel-header p {
  font-size: 14px;
  color: #52525b;
  margin: 0;
}

/* Step 1: Budget Presets */
.budget-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.preset-chip {
  padding: 9px 16px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 9999px;
  border: 1px solid #d4d4d8;
  background: #ffffff;
  color: #111111;
  cursor: pointer;
  transition: all 0.12s ease;
}

.preset-chip:hover {
  background: #f5f5f7;
  border-color: #111111;
}

.preset-chip.active {
  background: #111111;
  border-color: #111111;
  color: #ffffff;
}

.member-card input[type='number'] {
  display: block;
  width: 100%;
  min-height: 50px;
  padding: 12px 16px;
  border: 1px solid #d4d4d8;
  border-radius: 12px;
  margin: 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #111111;
  background: #ffffff;
  box-sizing: border-box;
}

.member-card input[type='number']:focus-visible {
  outline: 2px solid #111111;
  outline-offset: 2px;
  border-color: #111111;
}

.member-card small {
  display: block;
  color: #71717a;
  line-height: 1.5;
}

/* Step 2 & 3 Interactive Tiles */
fieldset {
  min-width: 0;
}

.usage-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 0 0 24px;
}

.usage-tile {
  display: flex !important;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border: 1px solid #e5e5e7;
  border-radius: 14px;
  background: #ffffff;
  cursor: pointer;
  min-height: 76px;
  position: relative;
  transition: border-color 0.12s ease, background-color 0.12s ease;
}

.usage-tile input[type='checkbox'] {
  width: 18px;
  height: 18px;
  accent-color: #111111;
  margin-top: 2px;
  flex-shrink: 0;
}

.usage-tile:hover {
  background: #f5f5f7;
  border-color: #d4d4d8;
}

.usage-tile.checked {
  background: #f5f5f7;
  border-color: #111111;
}

.usage-tile:focus-within {
  outline: 2px solid #111111;
  outline-offset: 2px;
}

.tile-icon {
  color: #111111;
  margin-top: 1px;
}

.tile-copy strong {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: #111111;
}

.tile-copy small {
  display: block;
  font-size: 12px;
  color: #71717a;
  margin-top: 2px;
}

.brand-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 0 0 24px;
}

.brand-tile {
  display: flex !important;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 16px 18px;
  border: 1px solid #e5e5e7;
  border-radius: 14px;
  background: #ffffff;
  cursor: pointer;
  text-align: left;
  min-height: 80px;
}

.brand-tile input[type='checkbox'] {
  width: 18px;
  height: 18px;
  accent-color: #111111;
  margin-bottom: 4px;
}

.brand-tile.checked {
  background: #f5f5f7;
  border-color: #111111;
}

.brand-tile strong {
  font-size: 15px;
  font-weight: 750;
  color: #111111;
}

.brand-tile small {
  font-size: 12px;
  color: #71717a;
}

/* Summary Strip */
.wizard-summary-box {
  background: #f5f5f7;
  border: 1px solid #e5e5e7;
  border-radius: 12px;
  padding: 16px 20px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.summary-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sum-key {
  font-size: 11px;
  font-weight: 600;
  color: #71717a;
}

.sum-val {
  font-size: 14px;
  font-weight: 700;
  color: #111111;
  word-break: keep-all;
}

/* Footer Controls */
.wizard-footer-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid #e5e5e7;
  flex-wrap: wrap;
}

.wizard-footer-nav.end {
  justify-content: flex-end;
}

.nav-prev-btn {
  padding: 11px 20px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 9999px;
  border: 1px solid #d4d4d8;
  background: #ffffff;
  color: #111111;
  cursor: pointer;
}

.nav-prev-btn:hover {
  background: #f5f5f7;
}

.nav-next-btn {
  padding: 11px 22px;
  font-size: 13px;
  font-weight: 650;
  border-radius: 9999px;
  border: 0;
  background: #111111;
  color: #ffffff;
  cursor: pointer;
}

.nav-next-btn:hover {
  background: #27272a;
}

.submit-zone {
  margin-top: 20px;
}

.submit-zone .wizard-footer-nav {
  align-items: flex-end;
}

.submit-cta-wrap {
  flex: 1;
  min-width: 240px;
}

.submit-caption {
  font-size: 12px;
  color: #71717a;
  margin: 0 0 10px;
  text-align: right;
}

.recommendation-output {
  margin-top: 40px;
  padding-top: 40px;
  border-top: 1px solid #e5e5e7;
}

.recommendation-output:focus {
  outline: none;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

@media (max-width: 820px) {
  .wizard-steps-nav,
  .usage-grid,
  .brand-grid,
  .wizard-summary-box {
    grid-template-columns: 1fr;
  }

  .submit-caption {
    text-align: left;
  }
}
</style>
