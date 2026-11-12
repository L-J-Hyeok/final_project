<template>
  <section class="member-page section-wrap detail-page">
    <div class="nav-back-wrap">
      <router-link to="/history" class="nav-back-link">
        ← 나의 추천 이력 목록으로 돌아가기
      </router-link>
    </div>

    <!-- Loading State -->
    <p v-if="loading" role="status" class="loading-status">
      저장된 추천 상세 결과를 불러오고 있어요...
    </p>

    <!-- Error State -->
    <v-alert v-else-if="error" :type="isNotFound ? 'warning' : 'error'" variant="tonal" role="alert" class="mb-6">
      <div class="alert-content">
        <p><strong>{{ error }}</strong></p>
        <p v-if="isNotFound" class="mt-1">
          추천 이력은 개인정보 보호 및 데이터 정책에 따라 생성일로부터 90일 동안 보관됩니다.
        </p>
        <div class="mt-3">
          <AppButton to="/history" secondary size="small">이력 목록으로 돌아가기</AppButton>
          <AppButton v-if="!isNotFound" size="small" class="ml-2" @click="loadDetail">다시 시도</AppButton>
        </div>
      </div>
    </v-alert>

    <!-- Detail Content -->
    <template v-else-if="record">
      <header class="member-heading detail-header">
        <span class="eyebrow">SAVED RECOMMENDATION</span>
        <h1>추천 결과 상세</h1>
        <div class="header-meta">
          <span><strong>추천 일시:</strong> {{ formatDate(record.created_at) }}</span>
          <span v-if="record.model_name" class="meta-tag">모델: {{ record.model_name }}</span>
        </div>
      </header>

      <!-- Snapshot Conditions Card -->
      <v-card class="member-card conditions-card">
        <h2>당시 요청 조건</h2>
        <div class="conditions-grid">
          <div class="condition-box">
            <span class="box-label">최대 예산</span>
            <strong class="box-value">{{ formatBudget(record.input_snapshot?.hard?.budget_max_krw) }}</strong>
          </div>
          <div class="condition-box">
            <span class="box-label">주요 사용 목적</span>
            <strong class="box-value">{{ formatUsages(record.input_snapshot?.hard?.usages) }}</strong>
          </div>
          <div class="condition-box">
            <span class="box-label">선호 제조사</span>
            <strong class="box-value">{{ formatBrands(record.input_snapshot?.soft?.preferred_brands) }}</strong>
          </div>
        </div>
        <p class="conditions-notice">
          ※ 이 추천은 추천 당시 저장된 프로필(v{{ record.profile_version }})과 당시 유효했던 기기 카탈로그를 바탕으로 분석된 결과입니다.
        </p>
      </v-card>

      <!-- Reused Recommendation Result Component -->
      <div class="result-container">
        <RecommendationResult
          :result="record"
          :owned-variant-id="record.input_snapshot?.owned_device_snapshot?.product?.variant_id || ''"
          :loading="false"
        />
      </div>

      <!-- Footer Navigation Actions -->
      <div class="detail-footer-actions">
        <AppButton to="/history" secondary>목록으로 돌아가기</AppButton>
        <AppButton to="/recommend">새 스마트폰 추천 받기</AppButton>
      </div>
    </template>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import AppButton from '../components/AppButton.vue'
import RecommendationResult from '../components/RecommendationResult.vue'
import { useMemberApi } from '../composables/useMemberApi'
import { createRecommendationApi, recommendationMessage } from '../api/recommendations'

const props = defineProps({
  initialData: { type: Object, default: null }
})

const route = useRoute()
const api = createRecommendationApi(useMemberApi())

const record = ref(props.initialData || null)
const loading = ref(false)
const error = ref('')
const isNotFound = ref(false)

const controller = new AbortController()

const purposes = {
  communication: '연락·소통',
  video: '영상 시청',
  coding: '코딩',
  gaming: '게임',
  camera: '사진·영상 촬영',
  work: '업무'
}

const brands = {
  samsung: '삼성',
  apple: '애플'
}

function formatDate(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatBudget(val) {
  if (typeof val !== 'number' || !Number.isFinite(val)) return '정보 없음'
  return `${val.toLocaleString('ko-KR')}원`
}

function formatUsages(arr) {
  if (!Array.isArray(arr) || !arr.length) return '선택 없음'
  return arr.map(u => purposes[u] || u).join(', ')
}

function formatBrands(arr) {
  if (!Array.isArray(arr) || !arr.length) return '전체'
  return arr.map(b => brands[b] || b).join(', ')
}

async function loadDetail() {
  const id = route.params.id
  if (!id) {
    error.value = '추천 이력 ID를 확인할 수 없습니다.'
    return
  }
  loading.value = true
  error.value = ''
  isNotFound.value = false
  try {
    const res = await api.getRecommendation(id, controller.signal)
    if (!res || !res.data) throw { code: 'NOT_FOUND', status: 404 }
    record.value = res.data
  } catch (e) {
    if (e.name !== 'AbortError') {
      if (e.code === 'NOT_FOUND' || e.status === 404) {
        isNotFound.value = true
      }
      error.value = recommendationMessage(e)
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadDetail)
onBeforeUnmount(() => controller.abort())
</script>

<style scoped>
.detail-page {
  padding-top: 48px;
  padding-bottom: 88px;
}
.nav-back-wrap {
  margin-bottom: 24px;
}
.nav-back-link {
  font-size: 13px;
  font-weight: 650;
  color: #111111;
  text-decoration: none;
  border-bottom: 1px solid #d4d4d8;
  padding-bottom: 2px;
}
.nav-back-link:hover {
  border-bottom-color: #111111;
}
.loading-status {
  padding: 32px 0;
  color: #52525b;
}
.detail-header {
  margin-bottom: 28px;
}
.header-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 10px;
  font-size: 13px;
  color: #52525b;
  flex-wrap: wrap;
}
.meta-tag {
  background: #f5f5f7;
  color: #111111;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
}
.conditions-card {
  padding: 28px !important;
  background: #f5f5f7 !important;
  border: 1px solid #e5e5e7 !important;
  border-radius: 16px !important;
  margin-bottom: 32px !important;
  box-shadow: none !important;
}
.conditions-card h2 {
  font-size: 17px;
  font-weight: 750;
  margin-bottom: 16px;
  color: #111111;
}
.conditions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 14px;
}
.condition-box {
  background: #ffffff;
  border: 1px solid #e5e5e7;
  padding: 14px 18px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.box-label {
  font-size: 11px;
  font-weight: 600;
  color: #71717a;
}
.box-value {
  font-size: 15px;
  font-weight: 700;
  color: #111111;
}
.conditions-notice {
  font-size: 12px;
  color: #52525b;
  margin-top: 10px;
  line-height: 1.5;
}
.result-container {
  margin-top: 28px;
}
.detail-footer-actions {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-top: 44px;
  padding-top: 28px;
  border-top: 1px solid #e5e5e7;
  flex-wrap: wrap;
}
</style>
