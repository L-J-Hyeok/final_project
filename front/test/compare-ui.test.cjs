const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { createRequire } = require('node:module')
const { parse, compileScript } = require('@vue/compiler-sfc')
const { transformSync } = require('@babel/core')
const vue = require('vue')
const { renderToString } = require('@vue/server-renderer')

const root = path.resolve(__dirname, '../src')

function load(file, mocks = {}) {
  const fullPath = path.join(root, file)
  const localRequire = createRequire(fullPath)
  const source = fs.readFileSync(fullPath, 'utf8')
  const js = file.endsWith('.vue')
    ? compileScript(parse(source).descriptor, { id: 'test-compare', inlineTemplate: true }).content
    : source
  const code = transformSync(js, {
    configFile: false,
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs']
  }).code
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => mocks[name] || localRequire(name), module, module.exports)
  return module.exports
}

const apiModule = load('api/smartphones.js')
const deviceImages = load('utils/deviceImages.js')
const specComponent = load('components/SpecComparison.vue', {
  '../utils/deviceImages.js': deviceImages,
  '../utils/deviceImages': deviceImages
}).default
const supplementalData = require('../src/data/supplemental-devices.json')

async function renderTable(props) {
  const app = vue.createSSRApp(specComponent, props)
  for (const name of ['v-icon', 'v-btn', 'v-card']) {
    app.component(name, {
      setup: (_, ctx) => () => vue.h('div', ctx.attrs, ctx.slots.default?.())
    })
  }
  return renderToString(app)
}

const mockSamsungPhone = {
  variant_id: '101',
  smartphone_id: '1',
  brand: 'samsung',
  model_name: 'Galaxy S24',
  domestic_model_number: 'SM-S921N',
  released_on_kr: '2024-01-30',
  os: 'Android',
  chipset: 'Exynos 2400',
  screen_inches: 6.2,
  refresh_hz: 120,
  battery_mah: 4000,
  weight_g: 167,
  supports_5g: true,
  wireless_charging: true,
  storage_gb: 256,
  ram_gb: 8,
  color: '오닉스 블랙',
  verified: true,
  is_test: false,
  price: {
    price_source: 'verified_sale',
    purchase_verified: true,
    total_krw: 1050000,
    source_name: '네이버 쇼핑 공식 인증점',
    observed_at: '2024-02-01T00:00:00.000Z'
  }
}

const mockApplePhone = {
  variant_id: '102',
  smartphone_id: '2',
  brand: 'apple',
  model_name: 'iPhone 15 Pro',
  domestic_model_number: 'A3102',
  released_on_kr: '2023-10-13',
  os: 'iOS',
  chipset: 'Apple A17 Pro',
  screen_inches: 6.1,
  refresh_hz: 120,
  battery_mah: null,
  weight_g: 187,
  supports_5g: true,
  wireless_charging: true,
  storage_gb: 128,
  ram_gb: null,
  color: '내추럴 티타늄',
  verified: true,
  is_test: false,
  price: {
    price_source: 'official_launch',
    development_only: true,
    purchase_verified: false,
    budget_basis_krw: 1550000,
    amount_krw: 1550000,
    source_name: 'Apple 공식 출고가',
    observed_at: '2023-10-13T00:00:00.000Z',
    warning: '개발용 공식 출고가'
  }
}

test('createSmartphoneApi correctly constructs query params and paths', async () => {
  const calls = []
  const mockClient = async (path, opts) => {
    calls.push({ path, opts })
    return { data: [] }
  }
  const api = apiModule.createSmartphoneApi(mockClient)
  const signal = new AbortController().signal

  await api.list({ brand: 'samsung', limit: 20, only_recommendable: false }, signal)
  assert.equal(calls[0].path, '/api/smartphones?brand=samsung&only_recommendable=false&limit=20')

  await api.get('42', signal)
  assert.equal(calls[1].path, '/api/smartphones/42')

  await api.search('Galaxy', '10', signal)
  assert.equal(calls[2].path, '/api/owned-device-options?q=Galaxy&cursor=10')
})

test('SpecComparison renders 2 smartphones side by side with categories and correct specs', async () => {
  const html = await renderTable({ products: [mockSamsungPhone, mockApplePhone], count: 2, category: 'smartphone' })

  assert.ok(html.includes('스마트폰 비교'))
  assert.ok(html.includes('Galaxy S24'))
  assert.ok(html.includes('iPhone 15 Pro'))
  assert.ok(html.includes('SM-S921N'))
  assert.ok(html.includes('A3102'))
  assert.ok(html.includes('기본 정보'))
  assert.ok(html.includes('디스플레이'))
  assert.ok(html.includes('성능 및 메모리'))
  assert.ok(html.includes('카메라'))
  assert.ok(html.includes('배터리 및 충전'))
  assert.ok(html.includes('네트워크 및 규격'))
  assert.ok(html.includes('가격 및 구매 정보'))
  assert.ok(html.includes('6.2인치'))
  assert.ok(html.includes('Exynos 2400'))
  assert.ok(html.includes('Apple A17 Pro'))
  assert.ok(html.includes('4,000mAh'))
})

test('NULL specs and unprovided database fields render as 정보 없음', async () => {
  const html = await renderTable({ products: [mockSamsungPhone, mockApplePhone], count: 2, category: 'smartphone' })
  assert.ok(html.includes('정보 없음'))
  assert.ok(html.includes('후면 카메라'))
  assert.ok(html.includes('전면 카메라'))
})

test('Supplemental data integrity contains 14 tablets and 10 smartwatches', () => {
  assert.equal(supplementalData.tablets.length, 14)
  assert.equal(supplementalData.smartwatches.length, 10)
  for (const t of supplementalData.tablets) {
    assert.equal(t.category, 'tablet')
    assert.ok(t.model_name)
    assert.ok(t.specs)
  }
  for (const w of supplementalData.smartwatches) {
    assert.equal(w.category, 'smartwatch')
    assert.ok(w.model_name)
    assert.ok(w.specs)
  }
})

test('SpecComparison renders tablet category with rawSpecs verbatim and source attribution', async () => {
  const t1 = supplementalData.tablets[0] // Galaxy Tab S9 FE+
  const t2 = supplementalData.tablets.find(t => t.brand === 'apple') // iPad
  assert.ok(t1 && t2)

  const html = await renderTable({ products: [t1, t2], count: 2, category: 'tablet' })

  assert.ok(html.includes('태블릿 비교'))
  assert.ok(html.includes(t1.model_name))
  assert.ok(html.includes(t2.model_name))
  assert.ok(html.includes('tablet-svg'))

  // Tablet-specific categories
  assert.ok(html.includes('디스플레이 및 화면'))
  assert.ok(html.includes('배터리 및 외형 규격'))
  assert.ok(html.includes('연결성'))

  // Raw specs verbatim
  if (t1.specs.display) assert.ok(html.includes(t1.specs.display))
  if (t1.specs.processor) assert.ok(html.includes(t1.specs.processor))
  if (t1.specs.battery) assert.ok(html.includes(t1.specs.battery))

  // Data source attribution & disclaimer
  assert.ok(html.includes('조원 제공 참고 데이터'))
  assert.ok(html.includes('출고가 · 조원 참고'))
})

test('SpecComparison renders smartwatch category with watch-specific specs and watch SVG', async () => {
  const w1 = supplementalData.smartwatches[0]
  const w2 = supplementalData.smartwatches.find(w => w.brand === 'apple')
  assert.ok(w1 && w2)

  const html = await renderTable({ products: [w1, w2], count: 2, category: 'smartwatch' })

  assert.ok(html.includes('스마트워치 비교'))
  assert.ok(html.includes(w1.model_name))
  assert.ok(html.includes(w2.model_name))
  assert.ok(html.includes('watch-svg'))

  // Watch-specific categories
  assert.ok(html.includes('성능 및 하드웨어'))
  assert.ok(html.includes('연결성 및 센서'))

  // Raw specs verbatim
  if (w1.specs.processor) assert.ok(html.includes(w1.specs.processor))
  if (w1.specs.battery) assert.ok(html.includes(w1.specs.battery))
  assert.ok(html.includes('조원 제공 참고 데이터'))
})

test('Differences between products trigger spec-difference and showDiffOnly filters rows', async () => {
  const t1 = supplementalData.tablets[0]
  const t2 = supplementalData.tablets.find(t => t.brand === 'apple')

  const htmlAll = await renderTable({ products: [t1, t2], count: 2, category: 'tablet' })
  assert.ok(htmlAll.includes('spec-difference'))
  assert.ok(htmlAll.includes('값 다름'))

  const htmlDiffOnly = await renderTable({ products: [t1, t2], count: 2, category: 'tablet', showDiffOnly: true })
  assert.ok(htmlDiffOnly.includes('spec-difference'))
})

test('SpecComparison renders Apple-style independent vertical columns, sticky header, and collapsed detailed accordion by default', async () => {
  const html = await renderTable({ products: [mockSamsungPhone, mockApplePhone], count: 2, category: 'smartphone' })
  assert.ok(html.includes('sticky-compare-bar'))
  assert.ok(html.includes('apple-columns-grid hero-row'))
  assert.ok(html.includes('product-visual-pedestal'))
  assert.ok(html.includes('visual-specs-area'))
  assert.ok(html.includes('visual-spec-block'))
  assert.ok(html.includes('spec-icon-holder'))
  assert.ok(html.includes('spec-headline-val'))
  assert.ok(html.includes('spec-sub-caption'))
  assert.ok(html.includes('aria-expanded="false"'))
  assert.ok(html.includes('상세 사양표 모두 보기'))
  assert.ok(html.includes('id="detailed-spec-panel"'))
  assert.ok(html.includes('aria-hidden="true"'))
  assert.ok(!html.includes('detailed-panel is-open'))

  const beforePanel = html.slice(0, html.indexOf('id="detailed-spec-panel"'))
  assert.ok(!beforePanel.includes('<table'))
  assert.ok(!beforePanel.includes('값 다름'))

  const htmlExpanded = await renderTable({ products: [mockSamsungPhone, mockApplePhone], count: 2, category: 'smartphone', defaultExpanded: true })
  assert.ok(htmlExpanded.includes('aria-expanded="true"'))
  assert.ok(htmlExpanded.includes('상세 사양표 접기'))
  assert.ok(htmlExpanded.includes('detailed-panel is-open'))
})

test('SpecComparison supports 3-slot comparison in sticky header, hero columns, and visual specs', async () => {
  const html3 = await renderTable({ products: [mockSamsungPhone, mockApplePhone], count: 3, category: 'smartphone' })
  assert.ok(html3.includes('cols-3'))
  assert.ok(html3.includes('기기 3'))
})

test('SpecComparison visual spec blocks respect showDiffOnly filter', async () => {
  const samePhoneClone = { ...mockSamsungPhone, id: 999, model_name: 'Galaxy Clone' }
  const htmlAll = await renderTable({ products: [mockSamsungPhone, samePhoneClone], count: 2, category: 'smartphone', showDiffOnly: false })
  const htmlDiff = await renderTable({ products: [mockSamsungPhone, samePhoneClone], count: 2, category: 'smartphone', showDiffOnly: true })
  const countBlocks = (s) => (s.match(/visual-spec-block/g) || []).length
  assert.ok(countBlocks(htmlAll) > 0)
  assert.ok(countBlocks(htmlDiff) < countBlocks(htmlAll))
})

test('deviceImages enforces official_render_only policy with exact model and DB color matching and SVG fallback', async () => {
  assert.equal(deviceImages.IMAGE_POLICY, 'official_render_only')

  const modelEntries = Object.values(deviceImages.DEVICE_MODEL_IMAGE_MANIFEST)
  assert.equal(modelEntries.length, 4)

  let variantRenderCount = 0
  for (const modelEntry of modelEntries) {
    assert.equal(modelEntry.brand, 'samsung')
    for (const [colorName, colorMeta] of Object.entries(modelEntry.colors || {})) {
      assert.ok(colorMeta.url.startsWith('/images/official/'), `Expected /images/official/ for ${colorName}`)
      assert.ok(!colorMeta.url.includes('/images/products/'))
      const diskPath = path.resolve(__dirname, '../public', colorMeta.url.replace(/^\//, ''))
      assert.ok(fs.existsSync(diskPath), `Missing official render on disk: ${diskPath}`)
      assert.ok(fs.statSync(diskPath).size > 10000, `Suspiciously small official render: ${diskPath}`)
      assert.ok(colorMeta.sourceArticleUrl && colorMeta.imageUrl && colorMeta.licenseNote)
      variantRenderCount++
    }
  }
  assert.equal(variantRenderCount, 7)

  // Previously saved Wikimedia Commons files remain preserved on disk untouched, just disconnected
  const legacyDir = path.resolve(__dirname, '../public/images/products')
  assert.ok(fs.existsSync(legacyDir))
  assert.ok(fs.readdirSync(legacyDir).filter(f => !f.startsWith('.')).length >= 26)

  // All 4 verified Samsung models resolve accurately by exact color variant
  const fold6Silver = { brand: 'samsung', model_name: 'Galaxy Z Fold6', domestic_model_number: 'SM-F956N', color: '실버 쉐도우' }
  const fold6Navy = { brand: 'samsung', model_name: 'Galaxy Z Fold6', domestic_model_number: 'SM-F956N', color: '네이비' }
  const flip6Blue = { brand: 'samsung', model_name: 'Galaxy Z Flip6', domestic_model_number: 'SM-F741N', color: '블루' }
  const flip6Mint = { brand: 'samsung', model_name: 'Galaxy Z Flip6', domestic_model_number: 'SM-F741N', color: '민트' }
  const a35Ice = { brand: 'samsung', model_name: 'Galaxy A35 5G', domestic_model_number: 'SM-A356N', color: '어썸 아이스블루' }
  const s23Green = { brand: 'samsung', model_name: 'Galaxy S23 Ultra', domestic_model_number: 'SM-S918N', color: '그린' }
  const s23Black = { brand: 'samsung', model_name: 'Galaxy S23 Ultra', domestic_model_number: 'SM-S918N', color: '팬텀 블랙' }

  assert.equal(deviceImages.resolveDeviceImage(fold6Silver), '/images/official/samsung-galaxy-z-fold6-silver-shadow.jpg')
  assert.equal(deviceImages.resolveDeviceImage(fold6Navy), '/images/official/samsung-galaxy-z-fold6-navy.jpg')
  assert.equal(deviceImages.resolveDeviceImage(flip6Blue), '/images/official/samsung-galaxy-z-flip6-blue.png')
  assert.equal(deviceImages.resolveDeviceImage(flip6Mint), '/images/official/samsung-galaxy-z-flip6-mint.jpg')
  assert.equal(deviceImages.resolveDeviceImage(a35Ice), '/images/official/samsung-galaxy-a35-5g-awesome-iceblue.jpg')
  assert.equal(deviceImages.resolveDeviceImage(s23Green), '/images/official/samsung-galaxy-s23-ultra-green.jpg')
  assert.equal(deviceImages.resolveDeviceImage(s23Black), '/images/official/samsung-galaxy-s23-ultra-phantom-black.jpg')
  assert.equal(deviceImages.isOfficialRender(s23Black), true)
  assert.equal(deviceImages.isModelReferenceImage(s23Black), false)

  // Space/case-insensitive color match works for exact variant color
  assert.equal(
    deviceImages.resolveDeviceImage({ brand: 'samsung', model_name: 'Galaxy S23 Ultra', domestic_model_number: 'SM-S918N', color: '팬텀블랙' }),
    '/images/official/samsung-galaxy-s23-ultra-phantom-black.jpg'
  )

  // Official priority: When exact official render exists, official image is served without reference note
  assert.equal(deviceImages.isOfficialRender(s23Green), true)
  assert.equal(deviceImages.isModelReferenceImage(s23Green), false)

  // Priority 3: When exact color official render is not present, falls back to teammate representative image
  assert.equal(
    deviceImages.resolveDeviceImage({ brand: 'samsung', model_name: 'Galaxy S23 Ultra', domestic_model_number: 'SM-S918N', color: '라벤더' }),
    '/images/products/galaxy-s23-ultra.jpg'
  )
  assert.equal(
    deviceImages.isModelReferenceImage({ brand: 'samsung', model_name: 'Galaxy S23 Ultra', domestic_model_number: 'SM-S918N', color: '라벤더' }),
    true
  )

  // S24 Ultra & iPhone 15 Pro have representative images matched
  assert.equal(deviceImages.resolveDeviceImage({ brand: 'samsung', model_name: 'Galaxy S24 Ultra', domestic_model_number: 'SM-S928N', color: '티타늄 그레이' }), '/images/products/galaxy-s24-ultra.jpg')
  assert.equal(deviceImages.resolveDeviceImage({ brand: 'samsung', model_name: 'Galaxy S24 FE', domestic_model_number: 'SM-S721N', color: '그라파이트' }), '/images/products/galaxy-s24-fe.jpg')
  assert.equal(deviceImages.resolveDeviceImage(mockApplePhone), '/images/products/iphone-15-pro.jpg')

  // Unknown model without reference image returns null (clean SVG fallback)
  const unknownModel = { brand: 'other', model_name: 'Unknown Phone', domestic_model_number: 'UNKNOWN-001' }
  assert.equal(deviceImages.resolveDeviceImage(unknownModel), null)
  assert.equal(deviceImages.isOfficialRender(unknownModel), false)
  assert.equal(deviceImages.isModelReferenceImage(unknownModel), false)
  assert.equal(deviceImages.resolveDeviceImage({ ...unknownModel, image_url: 'https://example.com/hotlink.jpg' }), null)

  // All 14 supplemental tablets resolve to their exact representative images
  for (const t of supplementalData.tablets) {
    const img = deviceImages.resolveDeviceImage(t)
    assert.ok(img && img.startsWith('/images/products/'), `Tablet ${t.model_name} should resolve image`)
    assert.equal(deviceImages.isModelReferenceImage(t), true)
  }

  // All 10 supplemental smartwatches resolve to their exact representative images (size-accurate)
  for (const w of supplementalData.smartwatches) {
    const img = deviceImages.resolveDeviceImage(w)
    assert.ok(img && img.startsWith('/images/products/'), `Watch ${w.model_name} should resolve image`)
    assert.equal(deviceImages.isModelReferenceImage(w), true)
  }

  // SpecComparison SSR renders official variant <img> for verified Samsung colorway, and representative note for Apple
  const fold6SilverFull = { ...mockSamsungPhone, variant_id: 'vf1', model_name: 'Galaxy Z Fold6', domestic_model_number: 'SM-F956N', storage_gb: 256, color: '실버 쉐도우' }
  const fold6NavyFull = { ...mockSamsungPhone, variant_id: 'vf2', model_name: 'Galaxy Z Fold6', domestic_model_number: 'SM-F956N', storage_gb: 512, color: '네이비' }
  const htmlPhones = await renderTable({ products: [fold6NavyFull, mockApplePhone], catalog: [fold6SilverFull, fold6NavyFull, mockApplePhone], count: 2, category: 'smartphone' })
  // Verify that fold6 (official render) does NOT render reference note, but mockApplePhone (reference image) DOES
  assert.ok(htmlPhones.includes('src="/images/official/samsung-galaxy-z-fold6-navy.jpg"'))
  assert.ok(htmlPhones.includes('data-image-scope="official-render-variant"'))
  assert.ok(htmlPhones.includes('src="/images/products/iphone-15-pro.jpg"'))
  assert.ok(htmlPhones.includes('대표 이미지 · 선택한 색상과 다를 수 있음'))
  assert.ok(htmlPhones.includes('pedestal-smartphone'))
  assert.ok(htmlPhones.includes('variant-selectors-panel'))
  assert.ok(htmlPhones.includes('aria-label="Galaxy Z Fold6 저장 용량 선택"'))
  assert.ok(htmlPhones.includes('aria-label="Galaxy Z Fold6 색상 선택"'))
  assert.ok(htmlPhones.includes('variant-pill-btn active'))
  assert.ok(htmlPhones.includes('variant-pill-btn is-cross-option'))
  assert.ok(htmlPhones.includes('256GB'))
  assert.ok(htmlPhones.includes('512GB'))
  assert.ok(htmlPhones.includes('실버 쉐도우'))
  assert.ok(htmlPhones.includes('네이비'))

  // All registered static paths exist cleanly on disk (prevents runtime 404s)
  for (const relUrl of deviceImages.getManifestImagePaths()) {
    const abs = path.resolve(__dirname, '../public', relUrl.replace(/^\//, ''))
    assert.ok(fs.existsSync(abs), `Manifest image path missing on disk: ${abs}`)
  }

  // A device without official render or reference image renders SVG placeholder
  const htmlWithout = await renderTable({ products: [unknownModel], catalog: [unknownModel], count: 2, category: 'smartphone' })
  assert.ok(htmlWithout.includes('phone-svg'))
  assert.ok(htmlWithout.includes('이미지 준비 중'))
  assert.ok(!htmlWithout.includes('대표 이미지 · 선택한 색상과 다를 수 있음'))

  // Tablet comparison renders matched reference images with representative notice
  const htmlTablets = await renderTable({ products: [supplementalData.tablets[0], supplementalData.tablets[1]], count: 2, category: 'tablet' })
  assert.ok(htmlTablets.includes('galaxy-tab-s9-fe-plus.jpg'))
  assert.ok(htmlTablets.includes('대표 이미지 · 선택한 색상과 다를 수 있음'))
  assert.ok(htmlTablets.includes('pedestal-tablet'))

  // Tablet without image renders tablet-svg
  const unknownTablet = { brand: 'other', model_name: 'Unknown Slate', domestic_model_number: 'UNK-TAB-01', category: 'tablet' }
  const htmlTabletSvg = await renderTable({ products: [unknownTablet], count: 2, category: 'tablet' })
  assert.ok(htmlTabletSvg.includes('tablet-svg'))
  assert.ok(htmlTabletSvg.includes('이미지 준비 중'))
})

test('user-provided official render resolver prioritizes model+color match, preserves storage linking, and safely handles background removal', () => {
  const mockUserRegistry = {
    entries: {
      'SM-S928N': {
        category: 'smartphone',
        brand: 'samsung',
        domesticModelNumbers: ['SM-S928N'],
        modelNames: ['galaxy s24 ultra'],
        colors: {
          '티타늄 그레이': {
            url: '/images/official/optimized/sm-s928n/sm-s928n__티타늄-그레이.webp',
            orientation: 'portrait',
            transparent: true,
            format: 'webp',
            width: 600,
            height: 1120,
            sourceName: '사용자 제공 제조사 공식 렌더',
            licenseNote: '사용자 직접 제공'
          }
        }
      },
      'A3296': {
        category: 'smartphone',
        brand: 'apple',
        domesticModelNumbers: ['A3296'],
        modelNames: ['iphone 16 pro max'],
        colors: {
          '데저트 티타늄': {
            url: '/images/official/optimized/a3296/a3296__데저트-티타늄.webp',
            orientation: 'portrait',
            transparent: true,
            format: 'webp',
            sourceName: '사용자 제공',
            licenseNote: '사용자 직접 제공'
          }
        }
      }
    }
  }
  const customResolver = deviceImages.createDeviceImageResolver(mockUserRegistry)

  const s24Gray256 = { variant_id: 's1', brand: 'samsung', model_name: 'Galaxy S24 Ultra', domestic_model_number: 'SM-S928N', storage_gb: 256, color: '티타늄 그레이' }
  const s24Gray512 = { variant_id: 's2', brand: 'samsung', model_name: 'Galaxy S24 Ultra', domestic_model_number: 'SM-S928N', storage_gb: 512, color: '티타늄 그레이' }
  const s24Black512 = { variant_id: 's3', brand: 'samsung', model_name: 'Galaxy S24 Ultra', domestic_model_number: 'SM-S928N', storage_gb: 512, color: '티타늄 블랙' }
  const iphone256 = { variant_id: 'a1', brand: 'apple', model_name: 'iPhone 16 Pro Max', domestic_model_number: 'A3296', storage_gb: 256, color: '데저트 티타늄' }
  const iphone512 = { variant_id: 'a2', brand: 'apple', model_name: 'iPhone 16 Pro Max', domestic_model_number: 'A3296', storage_gb: 512, color: '데저트 티타늄' }

  // Model + color matches cleanly regardless of storage tier; capacity updates option while keeping image
  assert.equal(customResolver.resolveDeviceImage(s24Gray256), '/images/official/optimized/sm-s928n/sm-s928n__티타늄-그레이.webp')
  assert.equal(customResolver.resolveDeviceImage(s24Gray512), '/images/official/optimized/sm-s928n/sm-s928n__티타늄-그레이.webp')
  assert.equal(customResolver.getDeviceImageMeta(s24Gray512)?.storageGb, 512)
  assert.equal(customResolver.isTransparentOfficialRender(s24Gray256), true)
  assert.equal(customResolver.isPortraitOfficialRender(s24Gray256), true)
  assert.equal(customResolver.resolveDeviceImage(iphone256), '/images/official/optimized/a3296/a3296__데저트-티타늄.webp')
  assert.equal(customResolver.resolveDeviceImage(iphone512), '/images/official/optimized/a3296/a3296__데저트-티타늄.webp')

  // Helper getDeviceImages returns single representative image contract
  const s24Images = customResolver.getDeviceImages(s24Gray256)
  assert.equal(s24Images?.url, '/images/official/optimized/sm-s928n/sm-s928n__티타늄-그레이.webp')
  assert.equal(s24Images?.primary, '/images/official/optimized/sm-s928n/sm-s928n__티타늄-그레이.webp')
  assert.equal(s24Images?.color, '티타늄 그레이')
  // When an official color is not supplied in user registry, it falls back to model reference JPG
  assert.equal(customResolver.resolveDeviceImage(s24Black512), '/images/products/galaxy-s24-ultra.jpg')
  assert.equal(customResolver.isOfficialRender(s24Black512), false)
  assert.equal(customResolver.isModelReferenceImage(s24Black512), true)

  // Pure official resolver without reference manifest returns null for unsupplied colors
  const pureOfficialResolver = deviceImages.createDeviceImageResolver(mockUserRegistry, deviceImages.DEVICE_MODEL_IMAGE_MANIFEST, {})
  assert.equal(pureOfficialResolver.resolveDeviceImage(s24Black512), null)
  assert.equal(pureOfficialResolver.getDeviceImages(s24Black512), null)

  // Capacity/color variant grouping returns sorted variants for exact model only
  const variants = deviceImages.getAvailableVariantsForProduct(s24Gray256, [s24Black512, iphone256, s24Gray512, s24Gray256])
  assert.equal(variants.length, 3)
  assert.equal(variants[0].storage_gb, 256)
  assert.equal(variants[1].variant_id, 's2')
  assert.equal(variants[2].variant_id, 's3')

  // Verify Python remove_bg.py safety & alpha preservation on temporary fixture files
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'official-render-proc-'))
  try {
    const pyScript = path.resolve(__dirname, '../scripts/remove_bg.py')
    const genScript = `
import os
from PIL import Image, ImageDraw
tmp = ${JSON.stringify(tmp)}
# 1) Existing transparent PNG phone
im1 = Image.new("RGBA", (220, 420), (0, 0, 0, 0))
d1 = ImageDraw.Draw(im1)
d1.rounded_rectangle([40, 20, 180, 400], radius=24, fill=(30, 32, 36, 255))
d1.rounded_rectangle([48, 32, 172, 388], radius=16, fill=(248, 249, 252, 255))
im1.save(os.path.join(tmp, "trans.png"))

# 2) Solid white studio background around dark frame + enclosed pure white screen
im2 = Image.new("RGB", (260, 460), (255, 255, 255))
d2 = ImageDraw.Draw(im2)
d2.rounded_rectangle([55, 30, 205, 430], radius=24, fill=(28, 30, 34))
d2.rounded_rectangle([64, 42, 196, 418], radius=16, fill=(255, 255, 255))
im2.save(os.path.join(tmp, "opaque_white_bg.jpg"), quality=95)

# 3) Complex non-white/textured border background -> should fallback safely
im3 = Image.new("RGB", (220, 420), (140, 155, 170))
d3 = ImageDraw.Draw(im3)
d3.rectangle([0, 0, 220, 120], fill=(80, 95, 110))
d3.rounded_rectangle([50, 40, 170, 380], radius=18, fill=(20, 20, 22))
im3.save(os.path.join(tmp, "complex_bg.jpg"), quality=95)
`
    execFileSync('python3', ['-c', genScript])

    const r1 = JSON.parse(execFileSync('python3', [pyScript, '--input', path.join(tmp, 'trans.png'), '--output-base', path.join(tmp, 'out1')], { encoding: 'utf8' }))
    assert.equal(r1.status, 'preserved_transparent_alpha')
    assert.equal(r1.transparent, true)
    assert.equal(r1.orientation, 'portrait')
    assert.ok(fs.existsSync(r1.outputPath))

    const r2 = JSON.parse(execFileSync('python3', [pyScript, '--input', path.join(tmp, 'opaque_white_bg.jpg'), '--output-base', path.join(tmp, 'out2')], { encoding: 'utf8' }))
    assert.equal(r2.status, 'removed_light_bg')
    assert.equal(r2.transparent, true)
    assert.equal(r2.orientation, 'portrait')
    assert.ok(fs.existsSync(r2.outputPath))
    // Confirm enclosed white phone screen center stayed opaque (alpha === 255) and outside border corner transparent (alpha === 0)
    const centerCheck = execFileSync('python3', ['-c', `
from PIL import Image
im = Image.open(${JSON.stringify(r2.outputPath)}).convert("RGBA")
w, h = im.size
print(im.getpixel((1, 1))[3], im.getpixel((w // 2, h // 2))[3])
`], { encoding: 'utf8' }).trim()
    assert.equal(centerCheck, '0 255')

    const r3 = JSON.parse(execFileSync('python3', [pyScript, '--input', path.join(tmp, 'complex_bg.jpg'), '--output-base', path.join(tmp, 'out3')], { encoding: 'utf8' }))
    assert.equal(r3.status, 'kept_original_complex_bg')
    assert.equal(r3.needsManualReview, true)
    assert.equal(r3.transparent, false)
    assert.ok(fs.existsSync(r3.outputPath))
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('SpecComparison displays 1 representative official render per slot and updates upon color switch', async () => {
  // Test with phone having verified official render (Galaxy Z Fold6 실버 쉐도우), phone with teammate reference JPG (Galaxy S24 FE), and unknown model without image
  const fold6 = {
    variant_id: 'fold6-1',
    smartphone_id: 'f6',
    brand: 'samsung',
    model_name: 'Galaxy Z Fold6',
    domestic_model_number: 'SM-F956N',
    color: '실버 쉐도우',
    storage_gb: 256,
    specs: { storage: '256GB', display: '7.6인치', weight: '239g' }
  }
  const s24fe = {
    variant_id: 's24fe-1',
    smartphone_id: 'fe',
    brand: 'samsung',
    model_name: 'Galaxy S24 FE',
    domestic_model_number: 'SM-S721N',
    color: '그라파이트',
    storage_gb: 256,
    specs: { storage: '256GB', display: '6.7인치', weight: '213g' }
  }
  const noImageDevice = {
    variant_id: 'unknown-1',
    smartphone_id: 'unk',
    brand: 'samsung',
    model_name: 'Unknown Test Phone',
    domestic_model_number: 'SM-UNKNOWN999',
    color: '테스트 색상',
    storage_gb: 128,
    specs: { storage: '128GB' }
  }

  const html = await renderTable({
    products: [fold6, s24fe, noImageDevice],
    catalog: [fold6, s24fe, noImageDevice],
    count: 3,
    category: 'smartphone'
  })

  // Fold6 has official render -> 1 img.product-photo rendered with exact official URL, no reference badge
  assert.ok(html.includes('samsung-galaxy-z-fold6-silver-shadow.jpg'))
  assert.ok(html.includes('class="product-photo'))

  // S24 FE has teammate reference render -> rendered with reference URL and notice
  assert.ok(html.includes('galaxy-s24-fe.jpg'))
  assert.ok(html.includes('대표 이미지 · 선택한 색상과 다를 수 있음'))

  // noImageDevice lacks both official and reference renders -> renders phone-svg placeholder
  assert.ok(html.includes('phone-svg'))
  assert.ok(html.includes('이미지 준비 중'))

  // Verify no dual image stage and no gallery
  assert.equal(html.includes('dual-render-stage'), false)
  assert.equal(html.includes('gallery-stage'), false)
})
