const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { parse, compileScript } = require('@vue/compiler-sfc')
const { transformSync } = require('@babel/core')
const vue = require('vue')
const { renderToString } = require('@vue/server-renderer')

const root = path.resolve(__dirname, '../src')

function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const js = file.endsWith('.vue')
    ? compileScript(parse(source).descriptor, { id: 'test-admin', inlineTemplate: true }).content
    : source
  const code = transformSync(js, {
    configFile: false,
    babelrc: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')]
  }).code
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => mocks[name] || require(name), module, module.exports)
  return module.exports
}

const appButtonComponent = load('components/AppButton.vue').default
const statusPanelComponent = load('components/StatusPanel.vue', {
  './AppButton.vue': { __esModule: true, default: appButtonComponent }
}).default

const adminView = load('views/AdminCandidatesView.vue', {
  '../components/AppButton.vue': { __esModule: true, default: appButtonComponent },
  '../components/StatusPanel.vue': { __esModule: true, default: statusPanelComponent },
  '../api/admin': {
    fetchAdminSession: async () => ({ data: { admin: true, review_persistence_enabled: true } }),
    fetchAdminCandidates: async () => ({ data: { items: [], overall_summary: {}, filtered_total: 0 } }),
    fetchAdminCandidateDetail: async () => ({ data: {} }),
    submitCandidateReview: async () => ({ data: {} }),
    registerAdminCandidate: async () => ({ data: {} }),
  }
}).default

async function renderComponent(component, props = {}) {
  const app = vue.createSSRApp(component, props)
  for (const name of ['v-card', 'v-alert', 'v-icon', 'v-btn', 'router-link', 'AppButton', 'StatusPanel']) {
    app.component(name, {
      setup: (_, ctx) => () => vue.h('div', ctx.attrs, ctx.slots.default?.())
    })
  }
  return renderToString(app)
}

test('router maps /admin to AdminCandidatesView with requiresAuth', () => {
  const routerSource = fs.readFileSync(path.join(root, 'router/index.js'), 'utf8')
  assert.ok(routerSource.includes("path:'/admin'"))
  assert.ok(routerSource.includes("import('../views/AdminCandidatesView.vue')"))
  assert.ok(routerSource.includes("requiresAuth:true"))
})

test('AdminCandidatesView renders access denied when unauthorized', async () => {
  const html = await renderComponent(adminView, {
    initialAccessDenied: true,
  })
  assert.ok(html.includes('관리자 권한이 필요합니다'))
  assert.ok(html.includes('홈으로 돌아가기'))
})

test('AdminCandidatesView renders KPI cards, tabs, candidate list and review detail', async () => {
  const sampleCandidate = {
    candidate_id: 'new_model__samsung__SM-F958N',
    candidate_kind: 'new_model',
    brand: 'samsung',
    model_name: 'Galaxy Z Fold Special Edition',
    domestic_model_number: 'SM-F958N',
    released_on_kr: '2024-10-25',
    storage_gb: 512,
    ram_gb: 16,
    color: '블랙 쉐도우',
    launch_price_krw: 2789600,
    channel: 'standard',
    sku_example: 'SM-F958NZKAKOO',
    verification_status: 'VERIFIED',
    verification_reason: '공식 SKU 및 출시일 검증 완료',
    approval_eligible: true,
    official_sources: [
      'https://www.samsung.com/sec/smartphones/galaxy-z-fold6-se-f958/SM-F958NZKAKOO/',
      'https://news.samsung.com/kr/삼성전자-갤럭시-z-폴드-스페셜-에디션-국내-출시-2'
    ],
    duplicate_check: {
      is_duplicate: false,
      detail: '기존 DB와 중복 없음'
    },
    admin_review: {
      admin_status: 'pending',
      history: []
    }
  }

  const sampleSummary = {
    total: 287,
    by_verification_status: { VERIFIED: 65, REVIEW_REQUIRED: 220, REJECTED: 2 },
    by_admin_status: { pending: 287, approved: 0, held: 0, rejected: 0 },
    by_candidate_kind: {
      new_model: 2,
      new_variant: 206,
      review_model: 8,
      db_pending_model: 13,
      db_pending_variant: 58
    }
  }

  const html = await renderComponent(adminView, {
    initialSession: { admin: true, review_persistence_enabled: true },
    initialData: {
      overall_summary: sampleSummary,
      filtered_total: 1,
      items: [sampleCandidate]
    },
    initialSelected: sampleCandidate,
    initialAccessDenied: false
  })

  // Title and header
  assert.ok(html.includes('스마트폰 후보 검수 대시보드'))
  assert.ok(html.includes('ADMIN CANDIDATE REVIEW · PHASE 3'))

  // KPI cards
  assert.ok(html.includes('287건'))
  assert.ok(html.includes('65건'))
  assert.ok(html.includes('220건'))

  // Kind tabs
  assert.ok(html.includes('전체 후보'))
  assert.ok(html.includes('신규 모델 후보'))
  assert.ok(html.includes('기존 모델 추가 옵션'))
  assert.ok(html.includes('추가 검토 모델'))
  assert.ok(html.includes('DB 승인 대기 제품'))

  // Candidate row in list
  assert.ok(html.includes('Galaxy Z Fold Special Edition'))
  assert.ok(html.includes('SM-F958N'))
  assert.ok(html.includes('블랙 쉐도우'))
  assert.ok(html.includes('512GB'))
  assert.ok(html.includes('DB 중복 없음'))

  // Detail panel
  assert.ok(html.includes('기존 DB 중복 검사 결과'))
  assert.ok(html.includes('공식 검증 결과 (VERIFIED)'))
  assert.ok(html.includes('공식 출처 URL'))
  assert.ok(html.includes('https://www.samsung.com/sec/smartphones/galaxy-z-fold6-se-f958/SM-F958NZKAKOO/'))
  assert.ok(html.includes('승인 (후보 승인)'))
  assert.ok(html.includes('보류'))
  assert.ok(html.includes('거절'))

  // Registration section (Phase 4)
  assert.ok(html.includes('MySQL 카탈로그 DB 등록 (Phase 4)'))
  assert.ok(html.includes('DB 미등록'))
})

test('AdminCandidatesView renders DB registration button when candidate is approved and verified', async () => {
  const approvedCandidate = {
    candidate_id: 'new_model__samsung__SM-F958N',
    candidate_kind: 'new_model',
    brand: 'samsung',
    model_name: 'Galaxy Z Fold Special Edition',
    domestic_model_number: 'SM-F958N',
    released_on_kr: '2024-10-25',
    storage_gb: 512,
    ram_gb: 16,
    color: '블랙 쉐도우',
    verification_status: 'VERIFIED',
    verification_reason: '공식 SKU 및 출시일 검증 완료',
    approval_eligible: true,
    official_sources: ['https://www.samsung.com/sec/smartphones/galaxy-z-fold6-se-f958/SM-F958NZKAKOO/'],
    duplicate_check: { is_duplicate: false, detail: '중복 없음' },
    admin_review: {
      admin_status: 'approved',
      latest_reason: '공식 확인 완료',
      history: []
    },
    registration: null,
    registration_readiness: {
      ready: true,
      status: 'ready_to_register',
      code: 'READY',
      reason: '공식 검증 및 관리자 승인이 완료되어 DB 비공개 등록이 가능합니다.'
    }
  }

  const html = await renderComponent(adminView, {
    initialSession: { admin: true, review_persistence_enabled: true },
    initialData: {
      overall_summary: { total: 1 },
      filtered_total: 1,
      items: [approvedCandidate]
    },
    initialSelected: approvedCandidate,
    initialAccessDenied: false
  })

  assert.ok(html.includes('DB 등록 가능'))
  assert.ok(html.includes('DB 등록 실행 (비공개 등록)'))
})

test('AdminCandidatesView renders registered badge and details when already registered', async () => {
  const registeredCandidate = {
    candidate_id: 'new_model__samsung__SM-F958N',
    candidate_kind: 'new_model',
    brand: 'samsung',
    model_name: 'Galaxy Z Fold Special Edition',
    domestic_model_number: 'SM-F958N',
    released_on_kr: '2024-10-25',
    storage_gb: 512,
    ram_gb: 16,
    color: '블랙 쉐도우',
    verification_status: 'VERIFIED',
    verification_reason: '공식 SKU 및 출시일 검증 완료',
    approval_eligible: true,
    duplicate_check: { is_duplicate: false, detail: '중복 없음' },
    admin_review: {
      admin_status: 'approved',
      latest_reason: '공식 확인 완료',
      history: []
    },
    registration: {
      status: 'registered',
      target_table: 'smartphones',
      inserted_id: 90000201,
      registered_at: '2026-11-13T03:30:00.000Z',
      registered_by: { id: '1', email: 'admin@kikirowum.test' }
    }
  }

  const html = await renderComponent(adminView, {
    initialSession: { admin: true, review_persistence_enabled: true },
    initialData: {
      overall_summary: { total: 1 },
      filtered_total: 1,
      items: [registeredCandidate]
    },
    initialSelected: registeredCandidate,
    initialAccessDenied: false
  })

  assert.ok(html.includes('DB 등록 완료 (#90000201)'))
  assert.ok(html.includes('DB 등록 완료 (비공개 draft)'))
  assert.ok(html.includes('smartphones'))
  assert.ok(html.includes('#90000201'))
})
