<template>
  <section class="member-page section-wrap recommend-page">
    <header class="member-heading">
      <span class="eyebrow">{{ isUpgradeRoute ? 'UPGRADE ADVISOR · 보유 기기 유지·교체 판단' : ('AI RECOMMENDATION · ' + currentCategoryLabel + ' 구매 가이드') }}</span>
      <h1>{{ isUpgradeRoute ? (activeCategory === 'smartphone' ? '지금 스마트폰을 바꿀 때일까요?' : `지금 ${currentCategoryLabel}을(를) 바꿀 때일까요?`) : `나에게 맞는 ${currentCategoryLabel} 찾기` }}</h1>
      <p>{{ isUpgradeRoute ? `현재 보유 중인 ${currentCategoryLabel}과 불편 항목을 바탕으로 유지(KEEP)·보류(DEFER)·교체 추천을 객관적으로 판단해 드려요.` : '단계별로 조건을 선택하면 저장된 프로필과 내부 제품 데이터를 바탕으로 AI가 추천해 드려요.' }}</p>

      <!-- Category Tabs (Identical to CompareView) -->
      <div class="category-tabs" role="tablist" aria-label="기기 카테고리 전환">
        <button
          v-for="cat in categories"
          :key="cat.code"
          type="button"
          role="tab"
          :class="['cat-tab-btn', { active: activeCategory === cat.code }]"
          :aria-selected="activeCategory === cat.code"
          @click="switchCategory(cat.code)"
        >
          {{ cat.label }}
        </button>
      </div>
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

    <form class="member-form" @submit.prevent="startConversation">
      <v-card class="member-card">
        <h2>{{ isUpgradeRoute ? `지금 기기에서 어떤 점이 고민인가요?` : `어떤 ${currentCategoryLabel}이 필요한가요?` }}</h2>
        <label v-if="isUpgradeRoute" for="conversation-device">평가할 보유 {{ currentCategoryLabel }}</label>
        <select v-if="isUpgradeRoute" id="conversation-device" v-model="form.deviceId" :disabled="busy" required>
          <option value="">기기를 선택해 주세요</option>
          <option v-for="d in filteredDevices" :key="d.id" :value="String(d.id)">
            {{ d.product?.model_name || d.manual_model_name }} · {{ capacityText(d) }}
          </option>
        </select>
        <p v-if="isUpgradeRoute && !filteredDevices.length && !devicesError">
          등록된 {{ currentCategoryLabel }}이(가) 없어요. <router-link to="/devices">보유 기기 등록</router-link>
        </p>
        <p v-if="isUpgradeRoute && devicesError" role="alert">{{ devicesError }}</p>
        <label for="conversation-text">{{ isUpgradeRoute ? '만족도·불편·교체 이유' : '구매 목적·예산·필수 조건' }}</label>
        <textarea
          id="conversation-text"
          v-model="conversationText"
          rows="3"
          maxlength="2000"
          :disabled="busy"
          :placeholder="isUpgradeRoute ? '예: 지금 기기에 만족하고 특별한 불편이 없어요.' : `예: 150만 원 이하에서 ${categoryPlaceholderText}`"
          required
        />
        <AppButton
          type="submit"
          :loading="busy"
          :disabled="busy || !ready || !conversationText.trim() || (isUpgradeRoute && !form.deviceId)"
        >
          {{ dialog ? '이 내용으로 새 상담 시작' : 'AI 상담 시작' }}
        </AppButton>
      </v-card>
    </form>
    <RecommendationQuestions
      v-if="dialog"
      class="conversation-questions"
      :conversation="dialog"
      :busy="busy"
      :can-resume="retryConversation"
      :needs-revision="result?.status === 'clarify' && !dialog.questions?.length && !retryConversation"
      @answer="sendAnswer"
      @resume="resumeConversation"
    />

    <details class="manual-recommendation">
      <summary>조건을 직접 선택하기</summary>
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
            <label for="upgrade-device">평가할 보유 {{ currentCategoryLabel }}</label>
            <select id="upgrade-device" v-model="form.deviceId">
              <option value="">기기 선택 없이 일반 구매 추천</option>
              <option v-for="d in filteredDevices" :key="d.id" :value="String(d.id)">
                {{ d.product?.model_name || d.manual_model_name }} · {{ capacityText(d) }}
              </option>
            </select>
            <p v-if="!filteredDevices.length && !devicesError">
              등록된 {{ currentCategoryLabel }}이(가) 없어요. <router-link to="/devices">보유 기기 등록</router-link>
            </p>
            <template v-if="form.deviceId">
              <label for="upgrade-reason">교체를 고려하는 이유</label>
              <textarea id="upgrade-reason" v-model="form.reason" maxlength="300" rows="3" />
              <label for="upgrade-intent">현재 사용 만족도·교체 의향</label>
              <select id="upgrade-intent" v-model="form.intent">
                <option value="low_or_keep_if_okay">만족하며 가능하면 유지</option>
                <option value="moderate">유지와 교체를 비교하고 싶음</option>
                <option value="high">불편해서 교체하고 싶음</option>
              </select>
              <fieldset>
                <legend>만족하는 항목 (최대 6개)</legend>
                <label v-for="(label, key) in aspects" :key="key">
                  <input v-model="form.satisfied" type="checkbox" :value="key"> {{ label }}
                </label>
              </fieldset>
              <fieldset>
                <legend>개선하고 싶은 불편 (최대 6개)</legend>
                <label v-for="(label, key) in aspects" :key="key">
                  <input v-model="form.pains" type="checkbox" :value="key"> {{ label }}
                </label>
              </fieldset>
              <label v-if="['smartphone', 'smartwatch', 'tablet', 'laptop'].includes(activeCategory)" for="upgrade-os">선호 운영체제</label>
              <select v-if="['smartphone', 'smartwatch', 'tablet'].includes(activeCategory)" id="upgrade-os" v-model="form.os">
                <option value="">상관없음</option>
                <option value="android">Android</option>
                <option value="ios">iOS</option>
              </select>
              <select v-else-if="activeCategory === 'laptop'" id="upgrade-os" v-model="form.os">
                <option value="">상관없음</option>
                <option value="macos">macOS</option>
                <option value="windows">Windows</option>
              </select>
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
                max="20000000"
                step="1"
                inputmode="numeric"
                placeholder="예: 1200000"
                required
                aria-describedby="budget-help"
              >
              <small id="budget-help">최대 2천만 원. 참고 가격은 실제 결제 조건에 따라 달라질 수 있습니다.</small>

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
                <h2>{{ currentCategoryLabel }}으로 주로 무엇을 하시나요?</h2>
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

              <!-- Category Extra Requirements -->
              <div v-if="activeCategory !== 'smartphone'" class="category-extra-options mt-4">
                <h3>{{ currentCategoryLabel }} 필수 조건 (선택)</h3>
                <div v-if="activeCategory === 'laptop'" class="extra-controls">
                  <label class="control-label">운영체제(OS) 제한</label>
                  <div class="choice-group mini">
                    <button type="button" :class="['brand-tile mini', { checked: !form.os }]" @click="form.os = ''">상관없음</button>
                    <button type="button" :class="['brand-tile mini', { checked: form.os === 'macos' }]" @click="form.os = 'macos'">macOS (MacBook)</button>
                    <button type="button" :class="['brand-tile mini', { checked: form.os === 'windows' }]" @click="form.os = 'windows'">Windows</button>
                  </div>
                  <label class="check-line mt-2">
                    <input v-model="form.require_discrete_gpu" type="checkbox"> 외장 그래픽(dGPU) 탑재 모델만 추천
                  </label>
                </div>
                <div v-else-if="activeCategory === 'tablet'" class="extra-controls">
                  <label class="control-label">운영체제(OS) 제한</label>
                  <div class="choice-group mini">
                    <button type="button" :class="['brand-tile mini', { checked: !form.os }]" @click="form.os = ''">상관없음</button>
                    <button type="button" :class="['brand-tile mini', { checked: form.os === 'android' }]" @click="form.os = 'android'">Android</button>
                    <button type="button" :class="['brand-tile mini', { checked: form.os === 'ios' }]" @click="form.os = 'ios'">iPadOS (iOS)</button>
                  </div>
                  <label class="check-line mt-2">
                    <input v-model="form.require_pen" type="checkbox"> S펜 / 애플펜슬 등 스타일러스 펜 지원 필수
                  </label>
                  <label class="check-line mt-2">
                    <input v-model="form.require_cellular" type="checkbox"> 셀룰러(LTE/5G) 지원 모델만 추천
                  </label>
                </div>
                <div v-else-if="activeCategory === 'smartwatch'" class="extra-controls">
                  <label class="control-label">스마트폰 연동 호환 OS</label>
                  <div class="choice-group mini">
                    <button type="button" :class="['brand-tile mini', { checked: !form.os }]" @click="form.os = ''">상관없음</button>
                    <button type="button" :class="['brand-tile mini', { checked: form.os === 'android' }]" @click="form.os = 'android'">Android 호환</button>
                    <button type="button" :class="['brand-tile mini', { checked: form.os === 'ios' }]" @click="form.os = 'ios'">iPhone(iOS) 호환</button>
                  </div>
                  <label class="check-line mt-2">
                    <input v-model="form.require_water_resistance" type="checkbox"> 방수 기능(5ATM/IP68 이상) 필수
                  </label>
                </div>
                <div v-else-if="activeCategory === 'earbuds'" class="extra-controls">
                  <label class="check-line mt-2">
                    <input v-model="form.require_anc" type="checkbox"> 액티브 노이즈 캔슬링(ANC) 필수
                  </label>
                  <label class="check-line mt-2">
                    <input v-model="form.require_water_resistance" type="checkbox"> 생활 방수(IPX4 이상) 필수
                  </label>
                </div>
                <div v-else-if="activeCategory === 'speaker'" class="extra-controls">
                  <label class="check-line mt-2">
                    <input v-model="form.require_water_resistance" type="checkbox"> 방수/아웃도어 방수 필수
                  </label>
                </div>
              </div>

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

                <label
                  v-for="b in currentBrandOptions"
                  :key="b.value"
                  :class="['brand-tile', { checked: form.brands.includes(b.value) }]"
                >
                  <input v-model="form.brands" type="checkbox" :value="b.value">
                  <strong>{{ b.label }}</strong>
                  <small>{{ b.sub }}</small>
                </label>
              </fieldset>

              <!-- Live Condition Summary Strip -->
              <div class="wizard-summary-box" aria-label="선택한 추천 조건 요약">
                <div class="summary-row">
                  <span class="sum-key">카테고리</span>
                  <strong class="sum-val">{{ currentCategoryLabel }}</strong>
                </div>
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
                <div v-if="form.os" class="summary-row">
                  <span class="sum-key">선호 OS</span>
                  <strong class="sum-val">{{ form.os.toUpperCase() }}</strong>
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
    </details>

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
import RecommendationQuestions from '../components/RecommendationQuestions.vue'
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
const dialog = ref(null)
const conversationText = ref('')
const retryConversation = ref(false)
const resultRegion = ref(null)
const currentStep = ref(1)

const route = useRoute() || { query: {} }
const devices = ref([])
const devicesError = ref('')
const aspects = {
  battery: '배터리',
  camera: '카메라',
  performance: '성능',
  portability: '휴대성',
  display: '화면',
  storage: '저장 용량',
  price: '비용',
  os_ecosystem: 'OS·생태계'
}

const categories = [
  { code: 'smartphone', label: '스마트폰' },
  { code: 'tablet', label: '태블릿' },
  { code: 'laptop', label: '노트북' },
  { code: 'smartwatch', label: '스마트워치' },
  { code: 'earbuds', label: '무선이어폰' },
  { code: 'speaker', label: '스피커' }
]
const activeCategory = ref('smartphone')
const currentCategoryLabel = computed(() => categories.find(c => c.code === activeCategory.value)?.label || '기기')

const form = reactive({
  budget: '',
  usages: [],
  brands: [],
  allowed_brands: [],
  deviceId: '',
  reason: '',
  intent: 'moderate',
  satisfied: [],
  pains: [],
  os: '',
  compatible_os: '',
  priorities: [],
  min_storage_gb: null,
  min_ram_gb: null,
  max_weight_g: null,
  min_refresh_hz: null,
  require_pen: false,
  require_keyboard: false,
  require_cellular: false,
  require_discrete_gpu: false,
  require_anc: false,
  require_water_resistance: false,
  require_gps: false,
  require_wireless_charging: false,
  unsupported_requirements: [],
  no_pain_confirmed: false
})

const ready = computed(() => !!profile.value?.confirmed_at && !!profile.value?.common?.spending_style && !!profile.value?.common?.usages?.length)
const isUpgradeRoute = computed(() => route.path === '/upgrade')

const filteredDevices = computed(() => {
  return devices.value.filter(d => {
    const cat = d.category === 'watch' ? 'smartwatch' : d.category
    return cat === activeCategory.value
  })
})

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

const brandsByCategory = {
  smartphone: [
    { value: 'samsung', label: '삼성', sub: '갤럭시 시리즈 우선 고려' },
    { value: 'apple', label: '애플', sub: '아이폰 시리즈 우선 고려' }
  ],
  tablet: [
    { value: 'samsung', label: '삼성', sub: '갤럭시 탭 시리즈' },
    { value: 'apple', label: '애플', sub: '아이패드 시리즈' },
    { value: 'lenovo', label: '레노버', sub: '가성비 태블릿' }
  ],
  laptop: [
    { value: 'apple', label: '애플', sub: 'MacBook 시리즈' },
    { value: 'samsung', label: '삼성', sub: '갤럭시북 시리즈' },
    { value: 'lg', label: 'LG', sub: '그램 시리즈' },
    { value: 'asus', label: 'ASUS', sub: '젠북·비보북 시리즈' },
    { value: 'lenovo', label: '레노버', sub: '씽크패드 시리즈' }
  ],
  smartwatch: [
    { value: 'samsung', label: '삼성', sub: '갤럭시 워치' },
    { value: 'apple', label: '애플', sub: 'Apple Watch' }
  ],
  earbuds: [
    { value: 'apple', label: '애플', sub: 'AirPods 시리즈' },
    { value: 'samsung', label: '삼성', sub: '갤럭시 버즈 시리즈' },
    { value: 'sony', label: '소니', sub: 'WF 시리즈' },
    { value: 'bose', label: '보스', sub: 'QC 시리즈' },
    { value: 'sennheiser', label: '젠하이저', sub: '모멘텀 시리즈' }
  ],
  speaker: [
    { value: 'jbl', label: 'JBL', sub: '블루투스 스피커' }
  ]
}

const currentBrandOptions = computed(() => brandsByCategory[activeCategory.value] || brandsByCategory.smartphone)

const categoryPlaceholderText = computed(() => {
  switch (activeCategory.value) {
    case 'laptop': return '코딩·업무용 노트북이 필요해요.'
    case 'tablet': return '인강·필기용 가벼운 태블릿이 필요해요.'
    case 'smartwatch': return '운동용 방수 스마트워치가 필요해요.'
    case 'earbuds': return '통화와 노이즈캔슬링이 좋은 무선이어폰이 필요해요.'
    case 'speaker': return '아웃도어 방수 블루투스 스피커가 필요해요.'
    default: return '사진을 많이 찍을 스마트폰이 필요해요.'
  }
})

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
  const brandMap = {
    samsung: '삼성',
    apple: '애플',
    lg: 'LG',
    asus: 'ASUS',
    lenovo: '레노버',
    sony: '소니',
    bose: '보스',
    sennheiser: '젠하이저',
    jbl: 'JBL'
  }
  return form.brands.map(b => brandMap[b] || b).join(', ')
})

function capacityText(d) {
  const cap = d.product?.storage_gb || d.manual_storage_gb
  if (cap) return cap >= 1024 && cap % 1024 === 0 ? `${cap / 1024}TB` : `${cap}GB`
  if (d.product?.ram_gb) return `RAM ${d.product.ram_gb}GB`
  return d.product?.color || '용량 미확인'
}

function switchCategory(code) {
  if (activeCategory.value === code) return
  activeCategory.value = code
  result.value = null
  error.value = ''
  dialog.value = null
  const match = filteredDevices.value[0]
  form.deviceId = match ? String(match.id) : ''
  form.min_storage_gb = null
  form.min_ram_gb = null
  form.max_weight_g = null
  form.min_refresh_hz = null
  form.require_pen = false
  form.require_keyboard = false
  form.require_cellular = false
  form.require_discrete_gpu = false
  form.require_anc = false
  form.require_water_resistance = false
  form.require_gps = false
  form.require_wireless_charging = false
  form.unsupported_requirements = []
  form.allowed_brands = []
  form.no_pain_confirmed = false
  if (code === 'smartphone') {
    form.brands = [...(profile.value?.smartphone?.preferred_brands || [])]
    form.os = profile.value?.smartphone?.preferred_os || ''
  } else {
    form.brands = []
    form.os = ''
  }
}

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
    // ignore
  }
  if (!preferredId) {
    const fallbackDevice = filteredDevices.value.find(d => d.product?.verified) || filteredDevices.value[0] || devices.value[0]
    preferredId = fallbackDevice ? String(fallbackDevice.id) : ''
  }
  if (preferredId) form.deviceId = preferredId
}

watch(
  () => [route.path, route.query.device, route.query.category],
  async ([newPath, newDevice, newCategory]) => {
    if (newCategory && categories.some(c => c.code === newCategory)) {
      activeCategory.value = newCategory
    }
    if (newDevice && devices.value.some(d => String(d.id) === String(newDevice))) {
      devicesError.value = ''
      const matched = devices.value.find(d => String(d.id) === String(newDevice))
      if (matched) {
        const cat = matched.category === 'watch' ? 'smartwatch' : matched.category
        if (categories.some(c => c.code === cat)) activeCategory.value = cat
      }
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
      devices.value = (await api.devices(controller.signal)).data || []
      if (route.query.device && devices.value.some(d => String(d.id) === String(route.query.device))) {
        const matched = devices.value.find(d => String(d.id) === String(route.query.device))
        if (matched) {
          const cat = matched.category === 'watch' ? 'smartwatch' : matched.category
          if (categories.some(c => c.code === cat)) activeCategory.value = cat
        }
        form.deviceId = String(route.query.device)
      } else if (route.query.device) {
        devicesError.value = '선택한 기기를 찾을 수 없습니다. 본인의 등록 기기를 선택해 주세요.'
      } else if (route.query.category && categories.some(c => c.code === route.query.category)) {
        activeCategory.value = route.query.category
      } else {
        await applyDefaultUpgradeDevice()
      }
    } catch (e) {
      devicesError.value = recommendationMessage(e)
    }
  } catch (e) {
    if (e.name !== 'AbortError') profileError.value = recommendationMessage(e)
  } finally {
    profileLoading.value = false
  }
}

function restoreConversation(data) {
  if (!data?.conversation || Boolean(data.conversation.replacement_device_id) !== isUpgradeRoute.value) return
  dialog.value = data.conversation
  retryConversation.value = data.can_resume === true
  if (!conversationText.value) conversationText.value = data.conversation.text
  if (isUpgradeRoute.value) form.deviceId = data.conversation.replacement_device_id
  result.value = data
}

async function sendTurn(body) {
  if (busy.value || !ready.value) return
  error.value = ''
  retryConversation.value = false
  busy.value = true
  try {
    const response = await api.sendConversation(body, controller.signal)
    const data = response?.data
    if (!data?.conversation || !['recommend', 'no_match', 'clarify', 'keep', 'defer'].includes(data.status)) throw { code: 'INVALID_RESPONSE' }
    restoreConversation(data)
  } catch (e) {
    if (e.name === 'AbortError') return
    error.value = e.code === 'INVALID_INPUT' ? '답변 형식이나 선택한 항목을 확인해 주세요.' : recommendationMessage(e)
    if (!['INVALID_INPUT', 'PROFILE_CHANGED', 'AUTH_REQUIRED', 'CSRF_INVALID', 'CONVERSATION_EXPIRED'].includes(e.code)) {
      try {
        const { data } = await api.conversation(controller.signal)
        restoreConversation(data)
        retryConversation.value = data?.can_resume === true
      } catch (_) { /* preserve */ }
    }
  } finally {
    busy.value = false
    await nextTick()
    if (dialog.value?.questions?.length && !error.value) {
      document.querySelector('.conversation-questions input, .conversation-questions select, .conversation-questions textarea')?.focus()
    } else {
      resultRegion.value?.focus()
    }
  }
}

async function startConversation() {
  if (!conversationText.value.trim() || (isUpgradeRoute.value && !form.deviceId)) return
  if (activeCategory.value === 'smartphone') {
    return sendTurn({
      action: 'start',
      mode: isUpgradeRoute.value ? 'upgrade' : 'purchase',
      text: conversationText.value,
      ...(isUpgradeRoute.value ? { replacement_device_id: form.deviceId } : {})
    })
  }

  // Multi-category NL analysis & direct recommendation
  if (busy.value || !ready.value) return
  busy.value = true
  error.value = ''
  result.value = null
  try {
    profile.value = (await api.profile(controller.signal)).data
    if (!ready.value) throw { code: 'PROFILE_INCOMPLETE' }

    let draft = {}
    try {
      const analysisRes = await api.analyze({
        purpose: 'purchase',
        text: conversationText.value,
        category: activeCategory.value
      }, controller.signal)
      draft = analysisRes.data?.draft || {}
    } catch (_) {
      // If AI analysis times out or falls back, continue with user inputs
    }

    // Merge analyzed conditions into form state for multi-step wizard / subsequent turns
    if (draft.hard) {
      if (draft.hard.budget_max_krw) form.budget = draft.hard.budget_max_krw
      if (Array.isArray(draft.hard.usages) && draft.hard.usages.length) form.usages = [...draft.hard.usages]
      if (draft.hard.required_os) form.os = draft.hard.required_os
      if (draft.hard.compatible_os) form.compatible_os = draft.hard.compatible_os
      if (draft.hard.min_storage_gb) form.min_storage_gb = draft.hard.min_storage_gb
      if (draft.hard.min_ram_gb) form.min_ram_gb = draft.hard.min_ram_gb
      if (draft.hard.max_weight_g) form.max_weight_g = draft.hard.max_weight_g
      if (draft.hard.min_refresh_hz) form.min_refresh_hz = draft.hard.min_refresh_hz
      if (draft.hard.require_pen !== undefined) form.require_pen = Boolean(draft.hard.require_pen)
      if (draft.hard.require_keyboard !== undefined) form.require_keyboard = Boolean(draft.hard.require_keyboard)
      if (draft.hard.require_cellular !== undefined) form.require_cellular = Boolean(draft.hard.require_cellular)
      if (draft.hard.require_anc !== undefined) form.require_anc = Boolean(draft.hard.require_anc)
      if (draft.hard.require_water_resistance !== undefined) form.require_water_resistance = Boolean(draft.hard.require_water_resistance)
      if (draft.hard.require_discrete_gpu !== undefined) form.require_discrete_gpu = Boolean(draft.hard.require_discrete_gpu)
      if (draft.hard.require_gps !== undefined) form.require_gps = Boolean(draft.hard.require_gps)
      if (draft.hard.require_wireless_charging !== undefined) form.require_wireless_charging = Boolean(draft.hard.require_wireless_charging)
      if (Array.isArray(draft.hard.allowed_brands)) form.allowed_brands = [...draft.hard.allowed_brands]
      if (Array.isArray(draft.hard.unsupported_requirements)) form.unsupported_requirements = [...draft.hard.unsupported_requirements]
    }
    if (draft.soft) {
      if (Array.isArray(draft.soft.preferred_brands) && draft.soft.preferred_brands.length) {
        form.brands = [...draft.soft.preferred_brands]
      }
      if (Array.isArray(draft.soft.priorities) && draft.soft.priorities.length) {
        form.priorities = [...draft.soft.priorities]
      }
      if (draft.soft.preferred_os) form.os = draft.soft.preferred_os
    }

    const hard = {
      budget_max_krw: draft.hard?.budget_max_krw || Number(form.budget) || 2000000,
      usages: (draft.hard?.usages && draft.hard.usages.length) ? draft.hard.usages : (form.usages.length ? form.usages : ['video']),
      ...(draft.hard?.required_os ? { required_os: draft.hard.required_os } : (form.os ? { required_os: form.os } : {})),
      ...(draft.hard?.compatible_os ? { compatible_os: draft.hard.compatible_os } : (form.compatible_os ? { compatible_os: form.compatible_os } : {})),
      ...(draft.hard?.allowed_brands ? { allowed_brands: draft.hard.allowed_brands } : (form.allowed_brands?.length ? { allowed_brands: form.allowed_brands } : {})),
      ...(draft.hard?.min_storage_gb || form.min_storage_gb ? { min_storage_gb: draft.hard?.min_storage_gb || form.min_storage_gb } : {}),
      ...(draft.hard?.min_ram_gb || form.min_ram_gb ? { min_ram_gb: draft.hard?.min_ram_gb || form.min_ram_gb } : {}),
      ...(draft.hard?.max_weight_g || form.max_weight_g ? { max_weight_g: draft.hard?.max_weight_g || form.max_weight_g } : {}),
      ...(draft.hard?.min_refresh_hz || form.min_refresh_hz ? { min_refresh_hz: draft.hard?.min_refresh_hz || form.min_refresh_hz } : {}),
      ...(draft.hard?.require_pen || form.require_pen ? { require_pen: true } : {}),
      ...(draft.hard?.require_keyboard || form.require_keyboard ? { require_keyboard: true } : {}),
      ...(draft.hard?.require_cellular || form.require_cellular ? { require_cellular: true } : {}),
      ...(draft.hard?.require_anc || form.require_anc ? { require_anc: true } : {}),
      ...(draft.hard?.require_water_resistance || form.require_water_resistance ? { require_water_resistance: true } : {}),
      ...(draft.hard?.require_discrete_gpu || form.require_discrete_gpu ? { require_discrete_gpu: true } : {}),
      ...(draft.hard?.require_gps || form.require_gps ? { require_gps: true } : {}),
      ...(draft.hard?.require_wireless_charging || form.require_wireless_charging ? { require_wireless_charging: true } : {}),
      ...(draft.hard?.unsupported_requirements ? { unsupported_requirements: draft.hard.unsupported_requirements } : (form.unsupported_requirements?.length ? { unsupported_requirements: form.unsupported_requirements } : {}))
    }

    const soft = {
      preferred_brands: draft.soft?.preferred_brands || form.brands || [],
      priorities: draft.soft?.priorities || form.priorities || [],
      preferred_os: draft.soft?.preferred_os || form.os || null
    }

    const recBody = {
      category: activeCategory.value,
      expected_profile_version: profile.value.version,
      hard,
      soft
    }

    if (isUpgradeRoute.value && form.deviceId) {
      const textLowIntent = /만족|불편\s*(이|은)?\s*없|교체\s*의향\s*(이|은)?\s*낮|바꿀\s*생각\s*(이|은)?\s*없|계속\s*쓰|그대로\s*쓸|유지|문제\s*(이|은)?\s*없|고장\s*(이|은)?\s*없/.test(conversationText.value)
      const textHighIntent = /교체하고\s*싶|바꾸고\s*싶|바꿀래|교체\s*의향\s*(이|은)?\s*높|새로\s*사|불편해서\s*못|고장\s*나|너무\s*느려/.test(conversationText.value)

      let upgradeIntent = 'moderate'
      if (draft.upgrade?.replacement_intent && ['low_or_keep_if_okay', 'high', 'moderate'].includes(draft.upgrade.replacement_intent)) {
        upgradeIntent = draft.upgrade.replacement_intent
      } else if (textLowIntent && !textHighIntent) {
        upgradeIntent = 'low_or_keep_if_okay'
      } else if (textHighIntent && !textLowIntent) {
        upgradeIntent = 'high'
      } else if (form.intent && ['low_or_keep_if_okay', 'high'].includes(form.intent)) {
        upgradeIntent = form.intent
      } else if (form.intent) {
        upgradeIntent = form.intent
      }

      let upgradePains = Array.isArray(draft.upgrade?.pain_points)
        ? draft.upgrade.pain_points
        : (Array.isArray(form.pains) ? form.pains : [])

      if (/불편\s*(이|은)?\s*없|문제\s*(이|은)?\s*없|고장\s*(이|은)?\s*없/.test(conversationText.value)) {
        upgradePains = []
      }

      const upgradeSatisfied = Array.isArray(form.satisfied) && form.satisfied.length
        ? form.satisfied
        : (Array.isArray(draft.upgrade?.satisfied_aspects) ? draft.upgrade.satisfied_aspects : [])

      const isLowOrKeep = upgradeIntent === 'low_or_keep_if_okay'
      const userStatedNoPain = /불편\s*(이|은)?\s*없|문제\s*(이|은)?\s*없|고장\s*(이|은)?\s*없/.test(conversationText.value)
      const noPain = Boolean(
        upgradePains.length === 0 && (
          form.no_pain_confirmed ||
          (isLowOrKeep && userStatedNoPain) ||
          isLowOrKeep
        )
      )

      form.intent = upgradeIntent
      form.pains = upgradePains
      form.satisfied = upgradeSatisfied
      form.no_pain_confirmed = noPain

      recBody.replacement_device_id = String(form.deviceId)
      recBody.purchase_reason = draft.upgrade?.reason || conversationText.value
      recBody.upgrade_context = {
        replacement_intent: upgradeIntent,
        satisfied_aspects: upgradeSatisfied,
        pain_points: upgradePains,
        ...(noPain && upgradePains.length === 0 ? { no_pain_confirmed: true } : {})
      }
    }

    const response = await api.recommend(recBody, controller.signal)
    if (!['recommend', 'no_match', 'clarify', 'keep', 'defer'].includes(response.data?.status)) {
      throw { code: 'INVALID_RESPONSE' }
    }
    result.value = response.data
    if (response.data?.status === 'clarify' && response.data?.questions?.length) {
      dialog.value = {
        text: conversationText.value,
        questions: response.data.questions.map((q, idx) => ({ id: 'q_' + idx, label: q, type: 'text' }))
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') error.value = recommendationMessage(e)
  } finally {
    busy.value = false
    await nextTick()
    resultRegion.value?.focus()
  }
}

function sendAnswer(questionId, answer) {
  if (activeCategory.value === 'smartphone') {
    const { id, revision } = dialog.value
    return sendTurn({ action: 'answer', id, revision, question_id: questionId, answer })
  }
  // For other categories, append answer to conversationText and re-run
  conversationText.value += ` (추가 답변: ${answer})`
  const numMatch = String(answer).replace(/,/g, '').match(/\d+/)
  if (numMatch) {
    const val = Number(numMatch[0])
    if (/예산|가격|원/.test(String(answer)) || val > 10000) {
      form.budget = val > 10000 ? val : val * 10000
    } else if (/ram|램/i.test(String(answer))) {
      form.min_ram_gb = val
    } else if (/용량|저장|gb/i.test(String(answer))) {
      form.min_storage_gb = val
    }
  }
  dialog.value = null
  return startConversation()
}

function resumeConversation() {
  if (activeCategory.value === 'smartphone') {
    const { id, revision } = dialog.value
    return sendTurn({ action: 'resume', id, revision })
  }
  dialog.value = null
  return startConversation()
}

async function submit() {
  if (busy.value || !ready.value) return
  error.value = ''
  result.value = null
  let reqBody
  try {
    reqBody = buildRecommendationRequest(form, profile.value.version, activeCategory.value)
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
    const response = await api.recommend(reqBody, controller.signal)
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

async function loadConversation() {
  if (!ready.value || activeCategory.value !== 'smartphone') return
  try {
    restoreConversation((await api.conversation(controller.signal)).data)
  } catch (_) {
    /* starting a new conversation remains available */
  }
}

watch(isUpgradeRoute, () => {
  dialog.value = null
  result.value = null
  conversationText.value = ''
  retryConversation.value = false
  if (activeCategory.value === 'smartphone') loadConversation()
})

onMounted(async () => {
  await loadProfile()
  await loadConversation()
})
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

/* Category Tabs (Identical to CompareView) */
.category-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 16px;
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
  color: #a1a1aa;
}

.wizard-card {
  padding: 32px !important;
}

.panel-header {
  margin-bottom: 28px;
}

.step-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #52525b;
  background: #f4f4f5;
  padding: 4px 10px;
  border-radius: 6px;
  margin-bottom: 12px;
}

.panel-header h2 {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-bottom: 8px;
}

.panel-header p {
  font-size: 14px;
  color: #52525b;
  line-height: 1.5;
}

/* Quick budget preset chips */
.budget-presets {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.preset-chip {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid #e5e5e7;
  border-radius: 9999px;
  background: #ffffff;
  color: #52525b;
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-chip:hover {
  border-color: #d4d4d8;
  background: #f5f5f7;
  color: #111111;
}

.preset-chip.active {
  background: #111111;
  border-color: #111111;
  color: #ffffff;
}

/* Usage Purposes Grid */
.usage-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 28px;
}

.usage-tile {
  display: flex !important;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e5e5e7;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.usage-tile:hover {
  background: #fafafa;
  border-color: #d4d4d8;
}

.usage-tile.checked {
  border-color: #111111;
  background: #fbfbfb;
  box-shadow: inset 0 0 0 1px #111111;
}

.usage-tile input {
  margin-top: 3px;
}

.tile-icon {
  color: #52525b;
  margin-top: 2px;
}

.usage-tile.checked .tile-icon {
  color: #111111;
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
  line-height: 1.4;
}

/* Category Extra Requirements Box */
.category-extra-options {
  margin-top: 24px;
  padding: 20px;
  background: #f9f9fb;
  border-radius: 14px;
  border: 1px solid #e5e5e7;
}
.category-extra-options h3 {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 12px;
}
.extra-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.control-label {
  font-size: 13px;
  font-weight: 600;
  color: #52525b;
}
.choice-group.mini {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.brand-tile.mini {
  padding: 8px 14px;
  font-size: 13px;
  border-radius: 8px;
  border: 1px solid #e5e5e7;
  background: #fff;
  cursor: pointer;
}
.brand-tile.mini.checked {
  background: #111;
  color: #fff;
  border-color: #111;
}

/* Brand Grid */
.brand-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 28px;
}

.brand-tile {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 20px 14px;
  background: #ffffff;
  border: 1px solid #e5e5e7;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.brand-tile input {
  display: none;
}

.brand-tile:hover {
  background: #fafafa;
  border-color: #d4d4d8;
}

.brand-tile.checked {
  border-color: #111111;
  background: #111111;
  color: #ffffff;
}

.brand-tile strong {
  font-size: 15px;
  font-weight: 700;
}

.brand-tile small {
  font-size: 12px;
  color: #71717a;
  margin-top: 4px;
}

.brand-tile.checked small {
  color: #a1a1aa;
}

/* Live summary strip */
.wizard-summary-box {
  background: #f5f5f7;
  border-radius: 14px;
  padding: 16px 20px;
  margin-bottom: 24px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
}

.summary-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sum-key {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: #71717a;
  letter-spacing: 0.05em;
}

.sum-val {
  font-size: 14px;
  font-weight: 700;
  color: #111111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Stepper Bottom Navigation */
.wizard-footer-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #f0f0f2;
}

.wizard-footer-nav.end {
  justify-content: flex-end;
}

.nav-prev-btn, .nav-next-btn {
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 700;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-prev-btn {
  background: #f5f5f7;
  border: 1px solid #e5e5e7;
  color: #111111;
}

.nav-prev-btn:hover {
  background: #ebebee;
}

.nav-next-btn {
  background: #111111;
  border: 1px solid #111111;
  color: #ffffff;
}

.nav-next-btn:hover {
  background: #27272a;
}

.submit-zone {
  margin-top: 16px;
}

.submit-cta-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.submit-caption {
  font-size: 12px;
  color: #71717a;
  margin: 0;
}

.manual-recommendation {
  margin-top: 32px;
  border-top: 1px solid #e5e5e7;
  padding-top: 24px;
}

.manual-recommendation summary {
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  padding: 8px 0;
  color: #111111;
}

.recommendation-output {
  margin-top: 48px;
}

@media (max-width: 768px) {
  .wizard-steps-nav {
    grid-template-columns: 1fr;
  }
  .usage-grid, .brand-grid {
    grid-template-columns: 1fr;
  }
  .wizard-card {
    padding: 20px !important;
  }
  .wizard-footer-nav {
    flex-direction: column;
    align-items: stretch;
  }
  .submit-cta-wrap {
    align-items: stretch;
  }
}
</style>
