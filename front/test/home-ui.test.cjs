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
    ? compileScript(parse(source).descriptor, { id: `test-${path.basename(file, '.vue')}`, inlineTemplate: true }).content
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

const imageMocks = {
  '../assets/home/hero-platform.jpg': '/mock/hero-platform.jpg',
  '../assets/home/hero-smartphones.jpg': '/mock/hero-smartphones.jpg',
  '../assets/home/hero-compare.jpg': '/mock/hero-compare.jpg',
  '../assets/home/hero-pc-fit.jpg': '/mock/hero-pc-fit.jpg'
}

const heroSlideshowComponent = load('components/HeroSlideshow.vue', imageMocks).default

const homeViewComponent = load('views/HomeView.vue', {
  ...imageMocks,
  '../components/HeroSlideshow.vue': { __esModule: true, default: heroSlideshowComponent },
  'vuex': { useStore: () => ({ state: { user: null } }) }
}).default

async function renderComponent(comp, props = {}) {
  const app = vue.createSSRApp(comp, props)
  app.component('HeroSlideshow', heroSlideshowComponent)
  app.component('router-link', {
    props: ['to'],
    setup: (p, ctx) => () => vue.h('a', { href: p.to, ...ctx.attrs }, ctx.slots.default?.())
  })
  return await renderToString(app)
}

test('HeroSlideshow renders Slide 1 (통합 IT 플랫폼) and carousel accessibility controls', async () => {
  const html = await renderComponent(heroSlideshowComponent, { initialIndex: 0 })
  assert.ok(html.includes('aria-roledescription="carousel"'))
  assert.ok(html.includes('내 생활과 예산에 맞는 IT기기'))
  assert.ok(html.includes('href="/recommend"'))
  assert.ok(html.includes('href="/compare"'))
  assert.ok(html.includes('이전 슬라이드'))
  assert.ok(html.includes('다음 슬라이드'))
  assert.ok(html.includes('일시정지'))
})

test('HeroSlideshow renders Slide 2 (AI 스마트폰 추천) with explicit smartphone-only scope', async () => {
  const html = await renderComponent(heroSlideshowComponent, { initialIndex: 1 })
  assert.ok(html.includes('AI 맞춤형 스마트폰 추천'))
  assert.ok(html.includes('현재 실제 AI 추천 지원 범위는 스마트폰입니다'))
  assert.ok(html.includes('AI 추천 시작'))
  assert.ok(html.includes('href="/recommend"'))
})

test('HeroSlideshow renders Slide 3 (상세 스펙 비교) with direct compare CTA', async () => {
  const html = await renderComponent(heroSlideshowComponent, { initialIndex: 2 })
  assert.ok(html.includes('제품별 주요 사양과 차이를'))
  assert.ok(html.includes('기기 비교 시작'))
  assert.ok(html.includes('href="/compare"'))
})

test('HeroSlideshow renders Slide 4 (PC-FIT 준비 중) transparently with /pc link', async () => {
  const html = await renderComponent(heroSlideshowComponent, { initialIndex: 3 })
  assert.ok(html.includes('PC-FIT'))
  assert.ok(html.includes('준비 중 · 현재 미구현'))
  assert.ok(html.includes('현재 조립 PC 견적 기능은 미구현 상태이며 준비 중 안내 페이지로 연결됩니다'))
  assert.ok(html.includes('href="/pc"'))
  assert.ok(html.includes('theme-dark'))
})

test('HeroSlideshow renders clean fallback frame when an image source is missing/failed', async () => {
  const brokenSlides = [
    {
      id: 'broken-slide',
      shortLabel: '테스트 슬라이드',
      theme: 'light',
      upcoming: false,
      eyebrow: 'TEST',
      statusBadge: '테스트',
      headline: '이미지 폴백 확인',
      description: '설명 텍스트',
      categoryTag: '테스트 기기',
      image: '',
      imageAlt: '대체 텍스트',
      ctas: [{ label: '이동', to: '/compare', variant: 'primary' }]
    }
  ]
  const html = await renderComponent(heroSlideshowComponent, { slides: brokenSlides })
  assert.ok(html.includes('slide-image-fallback'))
  assert.ok(html.includes('제품 비주얼을 불러오지 못했습니다'))
  assert.ok(!html.includes('<img'))
})

test('HomeView includes Section A (AI 추천), Section B (스펙 비교), Section C (PC-FIT), Section D (CTA) without legacy filler', async () => {
  const html = await renderComponent(homeViewComponent)
  // Section A
  assert.ok(html.includes('예산과 일상에 맞춘'))
  assert.ok(html.includes('현재 실제 추천 지원: 스마트폰'))
  // Section B
  assert.ok(html.includes('주요 사양을 나란히'))
  assert.ok(html.includes('2~3대 동시 비교 · 차이 항목 하이라이트 · 차이만 보기'))
  // Section C
  assert.ok(html.includes('부품 호환성부터'))
  assert.ok(html.includes('PC-FIT INTEGRATION · 준비 중'))
  assert.ok(html.includes('CPU · GPU · 메인보드 · 파워 부품 간 호환성 자동 검사 (예정)'))
  // Section D
  assert.ok(html.includes('나에게 맞는 IT기기 탐색, 지금 시작하세요.'))
  // Removed redundant sections
  assert.ok(!html.includes('기기별 지원 현황'))
})

test('HomeView handles guest and logged-in utility navigation cleanly', async () => {
  const guestHtml = await renderComponent(homeViewComponent, { user: null })
  assert.ok(guestHtml.includes('게스트 · 스펙 비교 이용 가능'))
  assert.ok(guestHtml.includes('href="/login"'))
  assert.ok(guestHtml.includes('href="/register"'))

  const authHtml = await renderComponent(homeViewComponent, {
    user: { id: 3, email: 'jihoon@example.com', name: '김지훈' }
  })
  assert.ok(authHtml.includes('김지훈'))
  assert.ok(authHtml.includes('href="/devices"'))
  assert.ok(authHtml.includes('href="/profile"'))
  assert.ok(authHtml.includes('href="/history"'))
})
