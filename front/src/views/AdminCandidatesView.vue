<template>
  <section class="member-page section-wrap admin-review-page">
    <header class="member-heading">
      <span class="eyebrow">ADMIN CANDIDATE REVIEW · PHASE 3</span>
      <h1>스마트폰 후보 검수 대시보드</h1>
      <p>
        2단계 탐색 후보와 기존 DB 승인 대기 제품을 공식 출처 기준으로 검수합니다.
        실제 운영 제품 테이블(<code>smartphones</code>, <code>smartphone_variants</code>) 반영은 4단계에서 별도 승인 후 수행됩니다.
      </p>
    </header>

    <v-alert
      type="info"
      variant="tonal"
      role="status"
      class="mb-4 admin-policy-banner"
    >
      <strong>운영 DB 직접 반영 비활성화:</strong>
      현재 단계에서는 후보 검수 상태 및 이력만 격리 저장소에 기록되며, 운영 카탈로그 DB에는 INSERT/UPDATE/DELETE를 수행하지 않습니다.
      <span v-if="adminSession && !adminSession.review_persistence_enabled" class="banner-subnote">
        (현재 환경에서는 읽기 전용 모드로 검수 저장이 잠겨 있습니다.)
      </span>
    </v-alert>

    <p v-if="loading && !initialized" role="status" class="loading-status">
      관리자 권한과 후보 검증 목록을 불러오는 중입니다...
    </p>

    <StatusPanel
      v-else-if="accessDenied"
      error
      title="관리자 권한이 필요합니다"
      :description="accessDeniedMessage"
      primary-to="/"
      primary-label="홈으로 돌아가기"
    />

    <template v-else>
      <v-alert v-if="error" type="error" variant="tonal" role="alert" class="mb-4">
        {{ error }}
      </v-alert>
      <v-alert v-if="actionMessage" type="success" variant="tonal" role="status" class="mb-4">
        {{ actionMessage }}
      </v-alert>

      <!-- Summary Cards -->
      <div v-if="summary" class="admin-kpi-grid" aria-label="후보 검증 요약">
        <v-card class="member-card admin-kpi-card">
          <small>전체 검수 대상</small>
          <strong>{{ summary.total }}건</strong>
          <span>신규 모델 {{ summary.by_candidate_kind?.new_model || 0 }} · 추가 옵션 {{ summary.by_candidate_kind?.new_variant || 0 }}</span>
        </v-card>
        <v-card class="member-card admin-kpi-card">
          <small>공식 검증 완료 (VERIFIED)</small>
          <strong>{{ summary.by_verification_status?.VERIFIED || 0 }}건</strong>
          <span>승인 가능 후보</span>
        </v-card>
        <v-card class="member-card admin-kpi-card">
          <small>추가 검수 보류 (REVIEW_REQUIRED)</small>
          <strong>{{ summary.by_verification_status?.REVIEW_REQUIRED || 0 }}건</strong>
          <span>추가 검토 {{ summary.by_candidate_kind?.review_model || 0 }} · DB 대기 {{ (summary.by_candidate_kind?.db_pending_model || 0) + (summary.by_candidate_kind?.db_pending_variant || 0) }}</span>
        </v-card>
        <v-card class="member-card admin-kpi-card">
          <small>관리자 검수 현황</small>
          <strong>승인 {{ summary.by_admin_status?.approved || 0 }}건</strong>
          <span>대기 {{ summary.by_admin_status?.pending || 0 }} · 보류 {{ summary.by_admin_status?.held || 0 }} · 거절 {{ summary.by_admin_status?.rejected || 0 }}</span>
        </v-card>
      </div>

      <!-- Category Tabs: New Model vs Existing Model Additional Variants -->
      <div class="admin-kind-tabs" role="tablist" aria-label="후보 유형 구분">
        <button
          v-for="tab in kindTabs"
          :key="tab.value"
          type="button"
          role="tab"
          class="admin-tab-btn"
          :class="{ active: filters.kind === tab.value }"
          :aria-selected="filters.kind === tab.value"
          @click="selectKind(tab.value)"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Filter Bar -->
      <v-card class="member-card admin-filter-card">
        <form class="admin-filter-grid member-form" @submit.prevent="applyFilters">
          <div>
            <label for="admin-filter-brand">제조사</label>
            <select id="admin-filter-brand" v-model="filters.brand" @change="applyFilters">
              <option value="all">전체 제조사</option>
              <option value="samsung">삼성전자 (Samsung)</option>
              <option value="apple">Apple</option>
            </select>
          </div>
          <div>
            <label for="admin-filter-vstatus">공식 검증 상태</label>
            <select id="admin-filter-vstatus" v-model="filters.verification_status" @change="applyFilters">
              <option value="all">전체 검증 상태</option>
              <option value="VERIFIED">VERIFIED (검증 완료)</option>
              <option value="REVIEW_REQUIRED">REVIEW_REQUIRED (검수 보류)</option>
              <option value="REJECTED">REJECTED (미출시/거절)</option>
            </select>
          </div>
          <div>
            <label for="admin-filter-astatus">관리자 승인 상태</label>
            <select id="admin-filter-astatus" v-model="filters.admin_status" @change="applyFilters">
              <option value="all">전체 관리자 상태</option>
              <option value="pending">승인 대기 (pending)</option>
              <option value="approved">후보 승인 (approved)</option>
              <option value="held">보류 (held)</option>
              <option value="rejected">거절 (rejected)</option>
            </select>
          </div>
          <div>
            <label for="admin-filter-query">모델명·모델번호·색상 검색</label>
            <div class="search-row">
              <input
                id="admin-filter-query"
                v-model="filters.q"
                type="search"
                placeholder="예: SM-F958N, Fold7, 핑크"
              />
              <AppButton type="submit" :disabled="loading">조회</AppButton>
            </div>
          </div>
        </form>
      </v-card>

      <!-- Workspace Layout: Candidate List + Detail Review Panel -->
      <div class="admin-workspace-grid">
        <div class="admin-list-col">
          <div class="admin-list-meta">
            <span>검색 결과 <strong>{{ filteredTotal }}</strong>건 (표시 {{ candidates.length }}건)</span>
          </div>

          <div v-if="!candidates.length && !loading" class="member-card admin-empty">
            <p>조건에 일치하는 후보가 없습니다.</p>
          </div>

          <div v-else class="admin-candidate-list">
            <button
              v-for="item in candidates"
              :key="item.candidate_id"
              type="button"
              class="admin-candidate-row"
              :class="{ selected: selectedCandidate?.candidate_id === item.candidate_id }"
              @click="selectCandidate(item)"
            >
              <div class="row-top">
                <span class="kind-pill" :class="`kind-${item.candidate_kind}`">
                  {{ kindLabel(item.candidate_kind) }}
                </span>
                <span class="status-badge" :class="`vstatus-${item.verification_status}`">
                  {{ item.verification_status }}
                </span>
                <span class="status-badge" :class="`astatus-${item.admin_review?.admin_status || 'pending'}`">
                  {{ adminStatusLabel(item.admin_review?.admin_status) }}
                </span>
              </div>

              <div class="row-title">
                <strong>{{ item.model_name }}</strong>
                <span class="dom-code">{{ item.domestic_model_number || '모델번호 미확정' }}</span>
              </div>

              <div class="row-specs">
                <span>{{ brandLabel(item.brand) }}</span>
                <span v-if="item.released_on_kr">출시 {{ item.released_on_kr }}</span>
                <span v-if="item.storage_gb">{{ item.storage_gb }}GB</span>
                <span v-if="item.ram_gb">RAM {{ item.ram_gb }}GB</span>
                <span v-if="item.color">{{ item.color }}</span>
              </div>

              <div class="row-dup">
                <span :class="item.duplicate_check?.is_duplicate ? 'dup-warn' : 'dup-ok'">
                  {{ item.duplicate_check?.is_duplicate ? '기존 DB 중복 감지' : 'DB 중복 없음' }}
                </span>
                <span v-if="item.registration?.status === 'registered'" class="reg-pill reg-done">
                  DB 등록 완료 (#{{ item.registration.inserted_id }})
                </span>
                <span v-else-if="item.registration_readiness?.status === 'ready_to_register'" class="reg-pill reg-ready">
                  DB 등록 가능
                </span>
                <span v-else class="reg-pill reg-not-ready">
                  DB 미등록
                </span>
                <span v-if="item.candidate_kind === 'new_variant'" class="parent-ref">
                  기존 모델 ID #{{ item.target_smartphone_id }} ({{ item.target_parent_review_status }})
                </span>
              </div>
            </button>
          </div>

          <div v-if="filteredTotal > candidates.length" class="admin-pagination">
            <AppButton variant="outlined" :disabled="filters.offset === 0 || loading" @click="changePage(-1)">
              이전
            </AppButton>
            <AppButton
              variant="outlined"
              :disabled="filters.offset + candidates.length >= filteredTotal || loading"
              @click="changePage(1)"
            >
              다음
            </AppButton>
          </div>
        </div>

        <!-- Detail & Review Panel -->
        <aside class="admin-detail-col" aria-label="후보 상세 검수 패널">
          <v-card v-if="selectedCandidate" class="member-card admin-detail-card">
            <div class="detail-header">
              <span class="kind-pill" :class="`kind-${selectedCandidate.candidate_kind}`">
                {{ kindLabel(selectedCandidate.candidate_kind) }}
              </span>
              <h2>{{ selectedCandidate.model_name }}</h2>
              <p class="detail-subtitle">
                {{ brandLabel(selectedCandidate.brand) }} · {{ selectedCandidate.domestic_model_number || '모델번호 미확정' }}
              </p>
            </div>

            <dl class="detail-spec-grid">
              <div><dt>국내 출시일</dt><dd>{{ selectedCandidate.released_on_kr || '미확인 (NULL)' }}</dd></div>
              <div><dt>저장 용량</dt><dd>{{ selectedCandidate.storage_gb ? `${selectedCandidate.storage_gb}GB` : '모델 행' }}</dd></div>
              <div><dt>RAM</dt><dd>{{ selectedCandidate.ram_gb ? `${selectedCandidate.ram_gb}GB` : '미확인 / 모델 행' }}</dd></div>
              <div><dt>색상</dt><dd>{{ selectedCandidate.color || '모델 전체' }}</dd></div>
              <div><dt>SKU / 채널</dt><dd>{{ selectedCandidate.sku_example || '-' }} ({{ selectedCandidate.channel || 'standard' }})</dd></div>
              <div><dt>공식 출고가</dt><dd>{{ formatPrice(selectedCandidate.launch_price_krw) }}</dd></div>
            </dl>

            <div class="detail-block">
              <h3>기존 DB 중복 검사 결과</h3>
              <p :class="selectedCandidate.duplicate_check?.is_duplicate ? 'dup-warn' : 'dup-ok'">
                {{ selectedCandidate.duplicate_check?.detail || '중복 확인 정보 없음' }}
              </p>
            </div>

            <div class="detail-block">
              <h3>공식 검증 결과 ({{ selectedCandidate.verification_status }})</h3>
              <p>{{ selectedCandidate.verification_reason }}</p>
            </div>

            <div class="detail-block">
              <h3>공식 출처 URL</h3>
              <ul v-if="selectedCandidate.official_sources?.length" class="source-list">
                <li v-for="url in selectedCandidate.official_sources" :key="url">
                  <a :href="url" target="_blank" rel="noopener noreferrer">{{ url }}</a>
                </li>
              </ul>
              <p v-else class="muted-note">공식 출처 URL 미등록</p>
            </div>

            <!-- Review Action Form -->
            <form class="detail-block member-form" @submit.prevent>
              <h3>관리자 검수 결정</h3>
              <p class="policy-hint" v-if="!selectedCandidate.approval_eligible">
                승인 정책 제한: 공식 검증 완료(VERIFIED) 및 비중복 후보만 승인할 수 있습니다. 보류 또는 거절 처리는 가능합니다.
              </p>
              <label for="admin-review-reason">검수 사유 (필수, 2~500자)</label>
              <textarea
                id="admin-review-reason"
                v-model="reviewReason"
                rows="3"
                maxlength="500"
                placeholder="공식 출처 확인 결과, 중복 여부, 보류/거절 사유를 기록하세요."
              />
              <div class="member-actions">
                <AppButton
                  type="button"
                  :disabled="!canApproveSelected || submitting"
                  @click="submitAction('approve')"
                >
                  승인 (후보 승인)
                </AppButton>
                <AppButton
                  type="button"
                  variant="outlined"
                  :disabled="!canMutate || submitting"
                  @click="submitAction('hold')"
                >
                  보류
                </AppButton>
                <AppButton
                  type="button"
                  variant="outlined"
                  :disabled="!canMutate || submitting"
                  @click="submitAction('reject')"
                >
                  거절
                </AppButton>
              </div>
            </form>

            <!-- DB Registration (Phase 4) -->
            <div class="detail-block db-registration-block">
              <h3>MySQL 카탈로그 DB 등록 (Phase 4)</h3>
              <div v-if="selectedCandidate.registration?.status === 'registered'" class="reg-status-box reg-status-done">
                <span class="reg-status-icon">✓</span>
                <div>
                  <strong>DB 등록 완료 (비공개 draft)</strong>
                  <p>
                    대상 테이블: <code>{{ selectedCandidate.registration.target_table }}</code> ·
                    등록 ID: <strong>#{{ selectedCandidate.registration.inserted_id }}</strong>
                  </p>
                  <small>등록 시각: {{ formatDateTime(selectedCandidate.registration.registered_at) }}</small>
                </div>
              </div>
              <div v-else class="reg-status-box" :class="canRegisterSelected ? 'reg-status-ready' : 'reg-status-locked'">
                <div>
                  <strong>{{ canRegisterSelected ? 'DB 등록 가능 (비공개 draft 적재 준비)' : 'DB 등록 대기 / 차단' }}</strong>
                  <p>{{ registrationReadinessText }}</p>
                  <small v-if="!canRegisterSelected" class="policy-hint">
                    등록 정책: 공식 검증(VERIFIED)과 관리자 승인(approved)이 모두 완료되어야 하며, 부모 모델 pending 및 삼성닷컴 SKU 미확인 시 차단됩니다.
                  </small>
                </div>
                <div v-if="canRegisterSelected" class="member-actions mt-3">
                  <AppButton
                    type="button"
                    class="db-reg-btn"
                    :disabled="registering || submitting"
                    @click="executeRegistration"
                  >
                    {{ registering ? 'DB 등록 중...' : 'DB 등록 실행 (비공개 등록)' }}
                  </AppButton>
                </div>
              </div>
              <p class="catalog-safety-note">
                * 등록 시 <code>review_status: 'pending'</code> 및 <code>verified: false</code>로 비공개 적재되어, 별도 공개 승인 전까지 일반 사용자 화면(/compare, /upgrade)에 노출되지 않습니다.
              </p>
            </div>

            <!-- Audit History -->
            <div class="detail-block">
              <h3>관리자 검수 이력</h3>
              <ul v-if="selectedCandidate.admin_review?.history?.length" class="review-history-list">
                <li v-for="entry in selectedCandidate.admin_review.history" :key="entry.history_id">
                  <div class="history-entry-top">
                    <strong>{{ entry.to_admin_status }}</strong>
                    <span>{{ entry.actor_email }}</span>
                    <time>{{ formatDateTime(entry.reviewed_at) }}</time>
                  </div>
                  <p>{{ entry.reason }}</p>
                  <small>{{ entry.duplicate_detail }}</small>
                </li>
              </ul>
              <p v-else class="muted-note">아직 관리자 검수 이력이 없습니다.</p>
            </div>
          </v-card>

          <v-card v-else class="member-card admin-detail-empty">
            <p>좌측 목록에서 후보 항목을 선택하면 공식 출처, DB 중복 검사, 승인 정책 및 검수 이력을 확인할 수 있습니다.</p>
          </v-card>
        </aside>
      </div>
    </template>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import AppButton from '../components/AppButton.vue';
import StatusPanel from '../components/StatusPanel.vue';
import {
  fetchAdminSession,
  fetchAdminCandidates,
  fetchAdminCandidateDetail,
  submitCandidateReview,
  registerAdminCandidate,
} from '../api/admin';

const props = defineProps({
  initialSession: { type: Object, default: null },
  initialData: { type: Object, default: null },
  initialSelected: { type: Object, default: null },
  initialAccessDenied: { type: Boolean, default: false },
});

const loading = ref(false);
const initialized = ref(Boolean(props.initialData || props.initialAccessDenied));
const accessDenied = ref(Boolean(props.initialAccessDenied));
const accessDeniedMessage = ref('이 페이지는 등록된 관리자 계정으로 로그인한 경우에만 이용할 수 있습니다.');
const error = ref('');
const actionMessage = ref('');
const submitting = ref(false);
const registering = ref(false);
const reviewReason = ref('');

const adminSession = ref(props.initialSession);
const summary = ref(props.initialData?.overall_summary || null);
const filteredTotal = ref(props.initialData?.filtered_total || 0);
const candidates = ref(props.initialData?.items || []);
const selectedCandidate = ref(props.initialSelected || props.initialData?.items?.[0] || null);

const filters = ref({
  kind: 'all',
  brand: 'all',
  verification_status: 'all',
  admin_status: 'all',
  q: '',
  limit: 30,
  offset: 0,
});

const kindTabs = [
  { value: 'all', label: '전체 후보' },
  { value: 'new_model', label: '신규 모델 후보' },
  { value: 'new_variant', label: '기존 모델 추가 옵션' },
  { value: 'review_model', label: '추가 검토 모델' },
  { value: 'db_pending', label: 'DB 승인 대기 제품' },
];

const canMutate = computed(() => Boolean(adminSession.value?.review_persistence_enabled));
const canApproveSelected = computed(
  () =>
    canMutate.value &&
    Boolean(selectedCandidate.value?.approval_eligible) &&
    !selectedCandidate.value?.duplicate_check?.is_duplicate
);

const canRegisterSelected = computed(() => {
  if (!selectedCandidate.value) return false;
  if (selectedCandidate.value.registration?.status === 'registered') return false;
  const readiness = selectedCandidate.value.registration_readiness;
  if (readiness) return Boolean(readiness.ready);
  return (
    canMutate.value &&
    selectedCandidate.value.admin_review?.admin_status === 'approved' &&
    selectedCandidate.value.verification_status === 'VERIFIED' &&
    !selectedCandidate.value.duplicate_check?.is_duplicate
  );
});

const registrationReadinessText = computed(() => {
  if (!selectedCandidate.value) return '';
  if (selectedCandidate.value.registration?.status === 'registered') {
    return `이미 ${selectedCandidate.value.registration.target_table} 테이블에 등록되었습니다 (ID: #${selectedCandidate.value.registration.inserted_id}).`;
  }
  const readiness = selectedCandidate.value.registration_readiness;
  if (readiness) return readiness.reason;
  if (selectedCandidate.value.admin_review?.admin_status !== 'approved') {
    return '관리자 승인(approved) 상태가 필요합니다.';
  }
  if (selectedCandidate.value.verification_status !== 'VERIFIED') {
    return `공식 검증 미완료 상태입니다 (${selectedCandidate.value.verification_status}).`;
  }
  return 'DB 비공개 등록이 준비되었습니다.';
});

function brandLabel(brand) {
  if (brand === 'samsung') return '삼성전자';
  if (brand === 'apple') return 'Apple';
  return brand || '기타';
}

function kindLabel(kind) {
  return (
    {
      new_model: '신규 모델',
      new_variant: '기존 모델 옵션 추가',
      review_model: '추가 검토 모델',
      db_pending_model: 'DB 대기 모델',
      db_pending_variant: 'DB 대기 옵션',
    }[kind] || kind
  );
}

function adminStatusLabel(status) {
  return (
    {
      pending: '승인 대기',
      approved: '후보 승인',
      held: '보류',
      rejected: '거절',
    }[status || 'pending'] || status
  );
}

function formatPrice(price) {
  if (!price) return '미확인';
  return `${Number(price).toLocaleString('ko-KR')}원`;
}

function formatDateTime(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 19).replace('T', ' ');
}

async function loadCandidates() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetchAdminCandidates(filters.value);
    const data = res?.data || {};
    summary.value = data.overall_summary || null;
    filteredTotal.value = data.filtered_total || 0;
    candidates.value = data.items || [];
    if (selectedCandidate.value) {
      const refreshed = candidates.value.find((c) => c.candidate_id === selectedCandidate.value.candidate_id);
      if (refreshed) selectedCandidate.value = refreshed;
    } else if (candidates.value.length > 0) {
      selectedCandidate.value = candidates.value[0];
    }
  } catch (e) {
    error.value = e.message || '후보 목록을 불러오지 못했습니다.';
  } finally {
    loading.value = false;
    initialized.value = true;
  }
}

async function selectKind(kind) {
  filters.value.kind = kind;
  filters.value.offset = 0;
  await loadCandidates();
}

async function applyFilters() {
  filters.value.offset = 0;
  await loadCandidates();
}

async function changePage(direction) {
  const nextOffset = Math.max(0, filters.value.offset + direction * filters.value.limit);
  filters.value.offset = nextOffset;
  await loadCandidates();
}

async function selectCandidate(item) {
  selectedCandidate.value = item;
  actionMessage.value = '';
  error.value = '';
  try {
    const res = await fetchAdminCandidateDetail(item.candidate_id);
    if (res?.data?.candidate) {
      selectedCandidate.value = res.data.candidate;
    }
  } catch {
    // Keep already-loaded list item if detail refresh fails silently
  }
}

async function submitAction(action) {
  if (!selectedCandidate.value) return;
  const reason = reviewReason.value.trim();
  if (reason.length < 2) {
    error.value = '검수 사유를 2자 이상 입력해 주세요.';
    return;
  }
  submitting.value = true;
  error.value = '';
  actionMessage.value = '';
  try {
    const res = await submitCandidateReview(selectedCandidate.value.candidate_id, { action, reason });
    if (res?.data?.candidate) {
      selectedCandidate.value = res.data.candidate;
    }
    reviewReason.value = '';
    actionMessage.value = `후보 검수 상태가 '${adminStatusLabel(res?.data?.candidate?.admin_review?.admin_status)}'(으)로 기록되었습니다. (운영 DB 미반영)`;
    await loadCandidates();
  } catch (e) {
    error.value = e.message || '검수 상태 저장에 실패했습니다.';
  } finally {
    submitting.value = false;
  }
}

async function executeRegistration() {
  if (!selectedCandidate.value || !canRegisterSelected.value) return;
  registering.value = true;
  error.value = '';
  actionMessage.value = '';
  try {
    const res = await registerAdminCandidate(selectedCandidate.value.candidate_id);
    const data = res?.data || {};
    actionMessage.value = `후보가 DB(${data.target_table || 'smartphones'})에 성공적으로 비공개 등록되었습니다 (ID: #${data.inserted_id}).`;
    await loadCandidates();
    if (data.candidate) {
      selectedCandidate.value = data.candidate;
    }
  } catch (e) {
    error.value = e.message || 'DB 등록 처리에 실패했습니다.';
  } finally {
    registering.value = false;
  }
}

onMounted(async () => {
  if (props.initialData || props.initialAccessDenied) return;
  loading.value = true;
  try {
    const sessionRes = await fetchAdminSession();
    adminSession.value = sessionRes?.data || null;
    await loadCandidates();
  } catch (e) {
    initialized.value = true;
    loading.value = false;
    if (e.status === 401 || e.status === 403 || e.code === 'ADMIN_REQUIRED') {
      accessDenied.value = true;
      accessDeniedMessage.value = e.message || accessDeniedMessage.value;
    } else {
      error.value = e.message || '관리자 대시보드를 초기화하지 못했습니다.';
    }
  }
});
</script>

<style scoped>
.admin-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.admin-kpi-card {
  margin: 0 !important;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.admin-kpi-card strong {
  font-size: 24px;
  letter-spacing: -0.04em;
}
.admin-kpi-card span {
  font-size: 12px;
  color: var(--muted);
}
.admin-kind-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.admin-tab-btn {
  border: 1px solid var(--border-strong);
  background: #ffffff;
  color: var(--ink);
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.admin-tab-btn.active {
  background: #111111;
  color: #ffffff;
  border-color: #111111;
}
.admin-filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.admin-filter-grid label {
  margin-top: 0 !important;
}
.admin-workspace-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.95fr);
  gap: 20px;
  align-items: start;
}
.admin-list-meta {
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 12px;
}
.admin-candidate-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.admin-candidate-row {
  text-align: left;
  width: 100%;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 16px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.admin-candidate-row.selected {
  border-color: #111111;
  background: #f5f5f7;
}
.row-top, .row-specs, .row-dup {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 12px;
}
.row-title {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: baseline;
}
.dom-code {
  font-size: 12px;
  color: var(--muted);
}
.kind-pill, .status-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 650;
  background: #f4f4f5;
}
.vstatus-VERIFIED { background: #e8f5e9; color: #1b5e20; }
.vstatus-REVIEW_REQUIRED { background: #fff8e1; color: #8d6e00; }
.vstatus-REJECTED { background: #fdecea; color: #b42318; }
.astatus-approved { background: #111111; color: #ffffff; }
.astatus-held { background: #fef3c7; color: #92400e; }
.astatus-rejected { background: #fee2e2; color: #991b1b; }
.dup-ok { color: #176b50; font-weight: 600; }
.dup-warn { color: #b42318; font-weight: 700; }
.detail-spec-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
  margin: 16px 0;
  font-size: 13px;
}
.detail-spec-grid dt { color: var(--muted); font-size: 11px; }
.detail-spec-grid dd { margin: 2px 0 0; font-weight: 600; }
.detail-block {
  border-top: 1px solid var(--line);
  padding-top: 14px;
  margin-top: 14px;
}
.source-list {
  padding-left: 18px;
  font-size: 12px;
  word-break: break-all;
}
.source-list a { color: var(--blue); text-decoration: underline; }
.review-history-list {
  list-style: none;
  padding: 0;
  margin: 8px 0 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.review-history-list li {
  background: #fafafa;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12px;
}
.history-entry-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
.policy-hint {
  font-size: 12px;
  color: #92400e;
  margin-bottom: 8px;
}
.reg-pill {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}
.reg-done {
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}
.reg-ready {
  background: #eff6ff;
  color: #1e40af;
  border: 1px solid #bfdbfe;
}
.reg-not-ready {
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #e5e7eb;
}
.db-registration-block {
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
}
.reg-status-box {
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
  font-size: 13px;
}
.reg-status-done {
  background: #ecfdf5;
  border: 1px solid #10b981;
  display: flex;
  gap: 12px;
  align-items: center;
}
.reg-status-icon {
  font-size: 20px;
  color: #059669;
  font-weight: bold;
}
.reg-status-ready {
  background: #eff6ff;
  border: 1px solid #3b82f6;
}
.reg-status-locked {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
}
.db-reg-btn {
  background: #0284c7 !important;
  color: #ffffff !important;
  font-weight: 600;
}
.catalog-safety-note {
  font-size: 11px;
  color: #64748b;
  margin-top: 10px;
  line-height: 1.4;
}
.admin-pagination {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}
@media (max-width: 960px) {
  .admin-kpi-grid, .admin-filter-grid, .admin-workspace-grid {
    grid-template-columns: 1fr;
  }
}
</style>
