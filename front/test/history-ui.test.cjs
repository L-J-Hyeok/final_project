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
    ? compileScript(parse(source).descriptor, { id: 'test-history', inlineTemplate: true }).content
    : source
  const code = transformSync(js, {
    configFile: false,
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs']
  }).code
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => mocks[name] || require(name), module, module.exports)
  return module.exports
}

const apiModule = load('api/recommendations.js', {
  './client': { request: () => { throw Error('Unexpected network call') } }
})

const appButtonComponent = load('components/AppButton.vue').default
const resultComponent = load('components/RecommendationResult.vue').default

const historyView = load('views/HistoryView.vue', {
  '../components/AppButton.vue': { __esModule: true, default: appButtonComponent },
  '../composables/useMemberApi': { useMemberApi: () => async () => ({ data: [] }) },
  '../api/recommendations': apiModule
}).default

const detailView = load('views/RecommendationDetailView.vue', {
  'vue-router': { useRoute: () => ({ params: { id: '42' } }) },
  '../components/AppButton.vue': { __esModule: true, default: appButtonComponent },
  '../components/RecommendationResult.vue': { __esModule: true, default: resultComponent },
  '../composables/useMemberApi': { useMemberApi: () => async () => ({ data: mockRecord }) },
  '../api/recommendations': apiModule
}).default

async function renderComponent(component, props = {}) {
  const app = vue.createSSRApp(component, props)
  for (const name of ['v-card', 'v-alert', 'v-icon', 'v-btn', 'router-link', 'AppButton']) {
    app.component(name, {
      setup: (_, ctx) => () => vue.h('div', ctx.attrs, ctx.slots.default?.())
    })
  }
  return renderToString(app)
}

const mockRecord = {
  id: '42',
  status: 'recommend',
  profile_version: 2,
  created_at: '2026-11-11T12:00:00.000Z',
  model_name: 'mock-ai-v1',
  input_snapshot: {
    expected_profile_version: 2,
    hard: {
      budget_max_krw: 1200000,
      usages: ['video', 'coding']
    },
    soft: {
      preferred_brands: ['samsung']
    }
  },
  items: [
    {
      variant_id: '101',
      product: {
        model_name: 'Galaxy S24',
        domestic_model_number: 'SM-S921N',
        storage_gb: 256,
        ram_gb: 8,
        color: '오닉스 블랙'
      },
      reasons: [{ description: '영상 시청 및 코딩 작업에 적합한 플래그십 성능' }],
      uncertainties: ['현재 판매처 재고 확인 필요'],
      price: {
        amount_krw: 1050000,
        total_krw: 1050000,
        price_source: 'verified_sale',
        purchase_verified: true,
        source_name: '네이버 쇼핑 공식 인증점',
        observed_at: '2026-11-11T10:00:00.000Z',
        is_expired_now: false,
        price_status_note: '추천 당시 관측 가격(유효기간 내)'
      }
    }
  ],
  questions: []
}

test('createRecommendationApi correctly handles history, get, and delete endpoints', async () => {
  const calls = []
  const mockClient = async (...args) => {
    calls.push(args)
    return { data: [] }
  }
  const api = apiModule.createRecommendationApi(mockClient)
  const signal = new AbortController().signal

  await api.history(null, signal)
  assert.equal(calls[0][0], '/api/recommendations')

  await api.history('cur_123', signal)
  assert.equal(calls[1][0], '/api/recommendations?cursor=cur_123')

  await api.getRecommendation('42', signal)
  assert.equal(calls[2][0], '/api/recommendations/42')

  await api.deleteRecommendation('42', signal)
  assert.equal(calls[3][0], '/api/recommendations/42')
  assert.equal(calls[3][1].method, 'DELETE')
})

test('recommendationMessage handles NOT_FOUND and 90-day retention policies', () => {
  assert.match(apiModule.recommendationMessage({ code: 'NOT_FOUND' }), /90일/)
  assert.match(apiModule.recommendationMessage({ status: 404 }), /90일/)
  assert.match(apiModule.recommendationMessage({ status: 401 }), /로그인/)
})

test('HistoryView renders empty state when no recommendation records exist', async () => {
  const html = await renderComponent(historyView, { initialItems: [] })
  assert.ok(html.includes('저장된 추천 이력이 없어요'))
  assert.ok(html.includes('스마트폰 추천 받기'))
})

test('HistoryView renders history record items and conditions summary', async () => {
  const html = await renderComponent(historyView, { initialItems: [mockRecord] })
  assert.ok(html.includes('추천 완료'))
  assert.ok(html.includes('1,200,000원'))
  assert.ok(html.includes('영상 시청'))
  assert.ok(html.includes('코딩'))
  assert.ok(html.includes('Galaxy S24'))
  assert.ok(html.includes('256GB'))
  assert.ok(html.includes('/recommendations/42'))
})

test('RecommendationDetailView renders saved conditions and recommendation results', async () => {
  const html = await renderComponent(detailView, { initialData: mockRecord })

  // Title and header
  assert.ok(html.includes('추천 결과 상세'))
  assert.ok(html.includes('mock-ai-v1'))

  // Condition snapshot
  assert.ok(html.includes('1,200,000원'))
  assert.ok(html.includes('영상 시청'))
  assert.ok(html.includes('코딩'))
  assert.ok(html.includes('삼성'))
  assert.ok(html.includes('v2'))

  // Reused result components
  assert.ok(html.includes('Galaxy S24'))
  assert.ok(html.includes('SM-S921N'))
  assert.ok(html.includes('256GB'))
  assert.ok(html.includes('1,050,000원'))
  assert.ok(html.includes('영상 시청 및 코딩 작업에 적합한 플래그십 성능'))
  assert.ok(html.includes('네이버 쇼핑 공식 인증점'))
})
