<template>
  <section class="member-page section-wrap history-page">
    <header class="member-heading">
      <span class="eyebrow">MY RECOMMENDATIONS</span>
      <h1>나의 추천 이력</h1>
      <p>저장된 과거 스마트폰 AI 추천 기록입니다. (최근 90일 보관 정책 반영)</p>
    </header>

    <!-- Loading State -->
    <p v-if="loading && !items.length" role="status" class="loading-status">
      추천 이력을 불러오고 있어요...
    </p>

    <!-- Error State -->
    <v-alert v-if="error" type="error" variant="tonal" role="alert" class="mb-4">
      {{ error }}
      <v-btn variant="text" size="small" @click="loadInitial">다시 시도</v-btn>
    </v-alert>

    <!-- Empty State -->
    <div v-if="!loading && !items.length && !error" class="member-card empty-history">
      <v-icon icon="mdi-history" size="48" color="#111111" class="mb-3" />
      <h2>저장된 추천 이력이 없어요</h2>
      <p>나의 생활스타일과 구매 성향에 꼭 맞는 스마트폰 추천을 받아보세요.</p>
      <div class="mt-4">
        <AppButton to="/recommend">AI 스마트폰 추천 받기</AppButton>
      </div>
    </div>

    <!-- History List -->
    <div v-if="items.length" class="history-list">
      <v-card v-for="rec in items" :key="rec.id" class="member-card history-item-card">
        <div class="history-card-header">
          <div class="header-left">
            <span class="status-badge" :class="`status-${rec.status}`">
              {{ statusLabel(rec.status) }}
            </span>
            <span class="history-date">{{ formatDate(rec.created_at) }}</span>
          </div>
          <button
            type="button"
            class="delete-btn"
            title="이력 삭제"
            :aria-label="`${formatDate(rec.created_at)} 추천 이력 삭제`"
            :disabled="deletingId === rec.id"
            @click="deleteItem(rec.id)"
          >
            {{ deletingId === rec.id ? '삭제 중…' : '삭제' }}
          </button>
        </div>

        <!-- Input Conditions Summary -->
        <div class="history-conditions">
          <span class="cond-item">
            <strong>최대 예산:</strong> {{ formatBudget(rec.input_snapshot?.hard?.budget_max_krw) }}
          </span>
          <span class="cond-item">
            <strong>사용 목적:</strong> {{ formatUsages(rec.input_snapshot?.hard?.usages) }}
          </span>
          <span class="cond-item" v-if="rec.input_snapshot?.soft?.preferred_brands?.length">
            <strong>선호 제조사:</strong> {{ formatBrands(rec.input_snapshot?.soft?.preferred_brands) }}
          </span>
        </div>

        <!-- Recommended Devices Summary or Status Note -->
        <div class="history-summary-box">
          <template v-if="rec.status === 'recommend' && rec.items?.length">
            <span class="summary-label">추천 기기 ({{ rec.items.length }}종):</span>
            <div class="device-pill-list">
              <span v-for="item in rec.items" :key="item.variant_id" class="device-pill">
                <v-icon icon="mdi-cellphone" size="14" class="mr-1" />
                {{ item.product?.model_name || '스마트폰' }}
                <small v-if="item.product?.storage_gb">({{ item.product.storage_gb }}GB)</small>
              </span>
            </div>
          </template>
          <p v-else-if="rec.status === 'no_match'" class="status-desc">
            입력하신 예산과 조건에 유효한 가격으로 일치하는 제품이 없었습니다.
          </p>
          <p v-else-if="rec.status === 'keep'" class="status-desc">
            현재 기기를 계속 사용하는 것이 경제적이고 효율적인 선택으로 권장되었습니다.
          </p>
          <p v-else-if="rec.status === 'clarify'" class="status-desc">
            조건을 구체화하기 위한 추가 안내 질문이 제공되었습니다.
          </p>
          <p v-else-if="rec.status === 'defer'" class="status-desc">
            지금 바로 구매하기보다 추가 정보 확인 및 구매 보류가 권장되었습니다.
          </p>
          <p v-else class="status-desc">
            추천 응답 결과를 확인해 주세요.
          </p>
        </div>

        <!-- Detail Action Link -->
        <div class="history-card-actions">
          <router-link :to="`/recommendations/${rec.id}`" class="detail-link">
            상세 추천 결과 및 근거 보기 →
          </router-link>
        </div>
      </v-card>

      <!-- Load More Button -->
      <div v-if="nextCursor" class="load-more-wrap">
        <AppButton secondary :loading="loadingMore" @click="loadMore">
          이전 추천 이력 더 보기
        </AppButton>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import AppButton from '../components/AppButton.vue'
import { useMemberApi } from '../composables/useMemberApi'
import { createRecommendationApi, recommendationMessage } from '../api/recommendations'

const props = defineProps({
  initialItems: { type: Array, default: () => [] }
})

const api = createRecommendationApi(useMemberApi())

const items = ref([...props.initialItems])
const nextCursor = ref(null)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
const deletingId = ref(null)

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

function statusLabel(status) {
  const map = {
    recommend: '추천 완료',
    no_match: '조건 일치 없음',
    clarify: '조건 구체화',
    keep: '기기 유지 권장',
    defer: '구매 보류 권장'
  }
  return map[status] || '추천 기록'
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

async function loadInitial() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.history(null, controller.signal)
    items.value = Array.isArray(res.data) ? res.data : []
    nextCursor.value = res.next_cursor || null
  } catch (e) {
    if (e.name !== 'AbortError') {
      error.value = recommendationMessage(e)
    }
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!nextCursor.value || loadingMore.value) return
  loadingMore.value = true
  try {
    const res = await api.history(nextCursor.value, controller.signal)
    const nextItems = Array.isArray(res.data) ? res.data : []
    items.value = [...items.value, ...nextItems]
    nextCursor.value = res.next_cursor || null
  } catch (e) {
    if (e.name !== 'AbortError') {
      error.value = recommendationMessage(e)
    }
  } finally {
    loadingMore.value = false
  }
}

async function deleteItem(id) {
  if (!id || deletingId.value) return
  if (!window.confirm('이 추천 기록을 삭제할까요? 삭제 후에는 복구할 수 없습니다.')) return
  deletingId.value = id
  try {
    await api.deleteRecommendation(id, controller.signal)
    items.value = items.value.filter(x => x.id !== id)
  } catch (e) {
    if (e.name !== 'AbortError') {
      error.value = recommendationMessage(e)
    }
  } finally {
    deletingId.value = null
  }
}

onMounted(loadInitial)
onBeforeUnmount(() => controller.abort())
</script>

<style scoped>
.history-page {
  padding-top: 56px;
  padding-bottom: 88px;
}
.loading-status {
  padding: 24px 0;
  color: #52525b;
}
.empty-history {
  padding: 56px 24px !important;
  text-align: center;
  border-radius: 16px;
}
.empty-history h2 {
  font-size: 20px;
  font-weight: 750;
  color: #111111;
  margin-bottom: 8px;
}
.empty-history p {
  color: #52525b;
  font-size: 14px;
}
.history-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.history-item-card {
  padding: 24px 28px !important;
  border: 1px solid #e5e5e7 !important;
  border-radius: 16px !important;
  margin: 0 !important;
  box-shadow: none !important;
  transition: border-color .15s ease;
}
.history-item-card:hover {
  border-color: #111111 !important;
}
.history-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.status-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 9999px;
}
.status-recommend {
  background: #111111;
  color: #ffffff;
}
.status-no_match {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}
.status-keep {
  background: #ecfdf5;
  color: #047857;
}
.status-clarify {
  background: #f4f4f5;
  color: #3f3f46;
}
.status-defer {
  background: #fef2f2;
  color: #b42318;
}
.history-date {
  font-size: 13px;
  font-weight: 500;
  color: #71717a;
}
.delete-btn {
  background: none;
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 500;
  color: #71717a;
  cursor: pointer;
  padding: 5px 10px;
  border-radius: 9999px;
  transition: all .12s ease;
}
.delete-btn:hover {
  color: #b42318;
  background: #fef2f2;
  border-color: #fecaca;
}
.history-conditions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  font-size: 13px;
  color: #111111;
  background: #f5f5f7;
  padding: 12px 16px;
  border-radius: 10px;
  margin-bottom: 14px;
}
.cond-item strong {
  color: #52525b;
  font-weight: 600;
  margin-right: 6px;
}
.history-summary-box {
  margin: 12px 0;
}
.summary-label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #52525b;
  margin-bottom: 8px;
}
.device-pill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.device-pill {
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  font-weight: 650;
  color: #111111;
  background: #f5f5f7;
  border: 1px solid #e5e5e7;
  padding: 5px 12px;
  border-radius: 9999px;
}
.device-pill small {
  color: #52525b;
  font-weight: 500;
  margin-left: 4px;
}
.status-desc {
  font-size: 13px;
  color: #52525b;
  margin: 4px 0;
  line-height: 1.5;
}
.history-card-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #f4f4f5;
}
.detail-link {
  font-size: 13px;
  font-weight: 700;
  color: #111111;
  text-decoration: none;
  border-bottom: 1px solid #d4d4d8;
  padding-bottom: 2px;
}
.detail-link:hover {
  border-bottom-color: #111111;
}
.load-more-wrap {
  display: flex;
  justify-content: center;
  margin-top: 28px;
}
</style>
