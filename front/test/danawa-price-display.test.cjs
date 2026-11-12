const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { parse, compileScript } = require('@vue/compiler-sfc')
const { transformSync } = require('@babel/core')
const vue = require('vue')
const { renderToString } = require('@vue/server-renderer')

const root = path.resolve(__dirname, '../src')

function loadSfcOrModule(relPath, cache = {}) {
  if (cache[relPath]) return cache[relPath]
  const absPath = path.join(root, relPath)
  const source = fs.readFileSync(absPath, 'utf8')
  if (relPath.endsWith('.json')) {
    cache[relPath] = JSON.parse(source)
    return cache[relPath]
  }
  const js = relPath.endsWith('.vue')
    ? compileScript(parse(source).descriptor, { id: 'test-' + relPath, inlineTemplate: true }).content
    : source
  const code = transformSync(js, {
    cwd: path.resolve(__dirname, '..'),
    configFile: false,
    babelrc: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs', { paths: [path.resolve(__dirname, '../node_modules')] })],
  }).code
  const module = { exports: {} }
  const customRequire = (reqPath) => {
    if (reqPath.startsWith('.')) {
      const resolvedRel = path.relative(root, path.resolve(path.dirname(absPath), reqPath))
      return loadSfcOrModule(resolvedRel, cache)
    }
    return require(reqPath)
  }
  new Function('require', 'module', 'exports', code)(customRequire, module, module.exports)
  cache[relPath] = module.exports
  return module.exports
}

const SpecComparison = loadSfcOrModule('components/SpecComparison.vue').default
const RecommendationResult = loadSfcOrModule('components/RecommendationResult.vue').default
const priceDisplay = loadSfcOrModule('utils/priceDisplay.js')

async function renderSpecComparison(props) {
  const app = vue.createSSRApp(SpecComparison, props)
  for (const name of ['v-icon', 'v-card', 'v-btn']) {
    app.component(name, { setup: (_, ctx) => () => vue.h('div', ctx.attrs, ctx.slots.default?.()) })
  }
  return renderToString(app)
}

async function renderRecommendationResult(props) {
  const app = vue.createSSRApp(RecommendationResult, props)
  for (const name of ['v-card', 'v-alert', 'router-link']) {
    app.component(name, { setup: (_, ctx) => () => vue.h('div', ctx.attrs, ctx.slots.default?.()) })
  }
  return renderToString(app)
}

const ACTIVE_DANAWA_PRICE = {
  price_source: 'danawa_reference',
  price_label: '다나와 기준 최저가',
  is_reference_price: true,
  purchase_verified: false,
  development_only: false,
  amount_krw: 918000,
  shipping_krw: null,
  total_krw: null,
  budget_basis_krw: null,
  source_name: '다나와 가격비교 (Mock 참고가)',
  danawa_product_url: 'https://prod.danawa.com/info/?pcode=33921003',
  checked_at: '2026-11-12T06:00:00.000Z',
  observed_at: '2026-11-12T06:00:00.000Z',
  expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  warning: '다나와 기준 최저가(참고용)입니다. 배송비·재고·결제 조건에 따라 실제 최종 결제가격과 다를 수 있으며, 예산 충족이나 교체 권장 확정 근거로 사용되지 않습니다.',
}

const EXPIRED_DANAWA_PRICE = {
  ...ACTIVE_DANAWA_PRICE,
  expires_at: new Date(Date.now() - 60 * 1000).toISOString(),
}

test('SpecComparison renders 다나와 기준 최저가, link, checked timestamp, disclaimer, and hides expired prices', async () => {
  const html = await renderSpecComparison({
    defaultExpanded: true,
    category: 'smartphone',
    products: [
      {
        variant_id: '90001390',
        smartphone_id: '90000119',
        brand: 'samsung',
        model_name: 'Galaxy S24',
        domestic_model_number: 'SM-S921N',
        storage_gb: 256,
        color: '마블 그레이',
        price: ACTIVE_DANAWA_PRICE,
      },
      {
        variant_id: '90001391',
        smartphone_id: '90000119',
        brand: 'samsung',
        model_name: 'Galaxy S24',
        domestic_model_number: 'SM-S921N',
        storage_gb: 256,
        color: '코발트 바이올렛',
        price: EXPIRED_DANAWA_PRICE,
      },
    ],
  })

  assert.ok(html.includes('918,000원'))
  assert.ok(html.includes('다나와 기준 최저가'))
  assert.ok(html.includes('실제 최종 결제가격'))
  assert.ok(html.includes('https://prod.danawa.com/info/?pcode=33921003'))
  assert.ok(html.includes('다나와 상품 보기'))
  assert.ok(html.includes('가격 조회 시각'))
  assert.ok(html.includes('가격 정보 없음'))
})

test('RecommendationResult & upgrade comparison render 다나와 기준 최저가 consistently without claiming purchase verification', async () => {
  const html = await renderRecommendationResult({
    result: {
      status: 'recommend',
      items: [
        {
          variant_id: '90001390',
          product: {
            model_name: 'Galaxy S24',
            domestic_model_number: 'SM-S921N',
            storage_gb: 256,
            ram_gb: 8,
            color: '마블 그레이',
          },
          price: ACTIVE_DANAWA_PRICE,
          comparison_with_owned: {
            comparable: true,
            fields: {
              price: {
                status: 'development_fallback_price',
                candidate_total_krw: 918000,
                price_source: 'danawa_reference',
                development_only: false,
              },
            },
          },
          reasons: [{ description: '저장 용량 조건 충족' }],
        },
      ],
    },
  })

  assert.ok(html.includes('다나와 기준 최저가'))
  assert.ok(html.includes('918,000원'))
  assert.ok(html.includes('실제 최종 결제가격'))
  assert.ok(html.includes('https://prod.danawa.com/info/?pcode=33921003'))
  assert.ok(html.includes('다나와 상품 보기'))
  assert.ok(html.includes('조회 시각:'))
  assert.ok(html.includes('다나와 기준 최저가 (참고용)'))
  assert.ok(!html.includes('검증된 판매가 · 배송비 포함'))
})

test('priceDisplay helper treats expired 24h prices strictly as null / 가격 정보 없음', () => {
  assert.equal(priceDisplay.formatPriceAmount(EXPIRED_DANAWA_PRICE, { emptyText: '가격 정보 없음' }), '가격 정보 없음')
  assert.equal(priceDisplay.getDanawaProductUrl(EXPIRED_DANAWA_PRICE), null)
  assert.equal(priceDisplay.formatPriceCheckedAt(EXPIRED_DANAWA_PRICE), '정보 없음')
})

test('seller prices display designated minimum, unknown shipping, expiry and missing sellers', async () => {
  const row = { observation_id:'1', seller_name:'쿠팡', amount_krw:800000, shipping_krw:null, observed_at:'2026-11-13T03:00:00Z', eligible:false, is_expired:false, danawa_product_url:'https://prod.danawa.com/info/?pcode=12345678' }
  const html = await renderSpecComparison({ category:'smartphone', products:[{
    variant_id:'1',model_name:'Galaxy S24',price:null,
    latest_prices_by_seller:[row,{...row,observation_id:'2',seller_name:'G마켓',is_expired:true}],
    seller_price_summary:{lowest:null,sellers:[{seller_key:'11st',seller_name:'11번가',status:'unknown'}]}
  },null] })
  for(const text of ['판매처별 조회 가격','배송비 미확인','가격 만료','11번가: 가격 미확인','800,000']) assert.ok(html.includes(text),text)
  assert.ok(!html.includes('지정 판매처 중 최저가:'))
})
