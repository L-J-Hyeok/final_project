'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const connection = require('../db/connection');
const aiModule = require('../services/ai-adapter');
const validator = require('../services/recommendation-validator');
const catalogEngine = require('../services/catalog-recommendation-engine');
const recRouter = require('../routes/recommendations');

function invokeRouter(router, method, path, reqOverrides = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method: method.toUpperCase(),
      url: path,
      originalUrl: `/api${path}`,
      path,
      params: {},
      query: {},
      headers: {},
      session: { user_id: '1' },
      body: {},
      ...reqOverrides
    };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); },
      end() { resolve({ status: this.statusCode, body: null }); }
    };
    router.handle(req, res, err => (err ? reject(err) : resolve({ status: res.statusCode, body: null })));
  });
}

test('1. Natural language analysis (mock) accurately parses category, budget, brands, OS compatibility, and required features across all 5 categories', async () => {
  const adapter = aiModule.createAiAdapter();

  // Tablet
  const tabletAn = await adapter.analyze(
    { purpose: 'purchase', text: '80만원 이하 대학생 강의 필기용 태블릿 추천해줘. 펜 지원 필수고 삼성 선호해.' },
    { AI_PROVIDER: 'mock' }
  );
  const vTablet = validator.validateAnalysisOutput('purchase', tabletAn.output, '80만원 이하 대학생 강의 필기용 태블릿 추천해줘. 펜 지원 필수고 삼성 선호해.');
  assert.equal(vTablet.draft.category, 'tablet');
  assert.equal(vTablet.draft.hard.budget_max_krw, 800000);
  assert.equal(vTablet.draft.hard.require_pen, true);
  assert.deepEqual(vTablet.draft.soft.preferred_brands, ['samsung']);

  // Laptop
  const laptopAn = await adapter.analyze(
    { purpose: 'purchase', text: '200만원 이하 코딩 개발용 노트북 찾고 있어. RAM 16GB 이상, 1.4kg 이하 가벼운 걸로 LG나 레노버 선호.' },
    { AI_PROVIDER: 'mock' }
  );
  const vLaptop = validator.validateAnalysisOutput('purchase', laptopAn.output, '200만원 이하 코딩 개발용 노트북 찾고 있어. RAM 16GB 이상, 1.4kg 이하 가벼운 걸로 LG나 레노버 선호.');
  assert.equal(vLaptop.draft.category, 'laptop');
  assert.equal(vLaptop.draft.hard.budget_max_krw, 2000000);
  assert.equal(vLaptop.draft.hard.min_ram_gb, 16);
  assert.equal(vLaptop.draft.hard.max_weight_g, 1400);
  assert.deepEqual(vLaptop.draft.soft.preferred_brands.sort(), ['lenovo', 'lg']);

  // Smartwatch (iPhone compatible)
  const watchAn = await adapter.analyze(
    { purpose: 'purchase', text: '아이폰이랑 연동해서 러닝 운동할 때 쓸 스마트워치 50만원 이하, 방수 필수.' },
    { AI_PROVIDER: 'mock' }
  );
  const vWatch = validator.validateAnalysisOutput('purchase', watchAn.output, '아이폰이랑 연동해서 러닝 운동할 때 쓸 스마트워치 50만원 이하, 방수 필수.');
  assert.equal(vWatch.draft.category, 'smartwatch');
  assert.equal(vWatch.draft.hard.budget_max_krw, 500000);
  assert.equal(vWatch.draft.hard.compatible_os, 'ios');
  assert.equal(vWatch.draft.hard.require_water_resistance, true);

  // Earbuds (ANC required + Sony only)
  const earbudsAn = await adapter.analyze(
    { purpose: 'purchase', text: '출퇴근 음악 감상용 노이즈캔슬링 필수 무선이어폰 30만원 이하, 무조건 소니만 추천해줘.' },
    { AI_PROVIDER: 'mock' }
  );
  const vEarbuds = validator.validateAnalysisOutput('purchase', earbudsAn.output, '출퇴근 음악 감상용 노이즈캔슬링 필수 무선이어폰 30만원 이하, 무조건 소니만 추천해줘.');
  assert.equal(vEarbuds.draft.category, 'earbuds');
  assert.equal(vEarbuds.draft.hard.budget_max_krw, 300000);
  assert.equal(vEarbuds.draft.hard.require_anc, true);
  assert.deepEqual(vEarbuds.draft.hard.allowed_brands, ['sony']);

  // Speaker (Outdoor + water resistance)
  const speakerAn = await adapter.analyze(
    { purpose: 'purchase', text: '캠핑 야외용 방수 블루투스 스피커 20만원 이하 추천해줘.' },
    { AI_PROVIDER: 'mock' }
  );
  const vSpeaker = validator.validateAnalysisOutput('purchase', speakerAn.output, '캠핑 야외용 방수 블루투스 스피커 20만원 이하 추천해줘.');
  assert.equal(vSpeaker.draft.category, 'speaker');
  assert.equal(vSpeaker.draft.hard.budget_max_krw, 200000);
  assert.equal(vSpeaker.draft.hard.require_water_resistance, true);
});

test('2. Live DB verification across all 5 categories: tablet, laptop, smartwatch, earbuds, speaker', async t => {
  const db = connection.getDatabase();
  const baseProfile = {
    version: 1,
    common: { usages: ['work', 'video'], spending_style: 'balanced', mobility: 'medium' },
    smartphone: {}
  };

  // --- A. TABLET ---
  const tabletData = await catalogEngine.fetchPublicCatalogCandidates(db, 'tablet', 'KRW');
  assert.equal(tabletData.priceAvailability.total_public_skus, 28);
  assert.equal(tabletData.priceAvailability.priced_skus, 26);
  assert.equal(tabletData.priceAvailability.missing_price_skus, 2);

  // A1. Basic tablet recommendation (up to 3 distinct models, all priced)
  const tabBasic = catalogEngine.rankCatalogCandidates({
    category: 'tablet',
    candidates: tabletData.allCandidates,
    profile: baseProfile,
    purchaseConditions: {
      hard: { budget_max_krw: 1200000, usages: ['work', 'video'] },
      soft: { priorities: ['display', 'portability'] }
    }
  });
  assert.equal(tabBasic.status, 'recommend');
  assert.equal(tabBasic.policy_version, 'tablet-ranker-v1');
  assert.equal(tabBasic.top_candidates.length, 3);
  const tabModelIds = new Set(tabBasic.top_candidates.map(e => e.candidate.model_id));
  assert.equal(tabModelIds.size, 3, 'Must select at most 1 representative SKU per distinct model');
  for (const entry of tabBasic.top_candidates) {
    assert.ok(entry.candidate.price && entry.candidate.price.amount_krw <= 1200000);
  }

  // A2. Tablet required feature: require_pen=true must return only pen_supported=true with valid price (iPad A16), excluding unpriced Lenovo Tab M11
  const tabPen = catalogEngine.rankCatalogCandidates({
    category: 'tablet',
    candidates: tabletData.allCandidates,
    profile: baseProfile,
    purchaseConditions: {
      hard: { budget_max_krw: 1000000, usages: ['work'], require_pen: true },
      soft: {}
    }
  });
  assert.equal(tabPen.status, 'recommend');
  assert.equal(tabPen.top_candidates.length, 1);
  assert.equal(tabPen.top_candidates[0].candidate.model_number, 'A3354');
  assert.equal(tabPen.top_candidates[0].candidate.specifications.pen_supported, true);

  // A3. Tablet brand filter: allowed_brands=['lenovo'] recommends priced Lenovo tablets while excluding unpriced Lenovo Tab M11 / P12
  const tabLenovo = catalogEngine.rankCatalogCandidates({
    category: 'tablet',
    candidates: tabletData.allCandidates,
    profile: baseProfile,
    purchaseConditions: {
      hard: { budget_max_krw: 1000000, usages: ['video'], allowed_brands: ['lenovo'] },
      soft: {}
    }
  });
  assert.equal(tabLenovo.status, 'recommend');
  assert.ok(tabLenovo.top_candidates.every(e => e.candidate.brand_lower === 'lenovo'));
  assert.ok(tabLenovo.excluded_candidates.some(e => e.reason === 'MISSING_PRICE' && e.model_name.includes('Lenovo')));

  // --- B. LAPTOP ---
  const laptopData = await catalogEngine.fetchPublicCatalogCandidates(db, 'laptop', 'KRW');
  assert.equal(laptopData.priceAvailability.total_public_skus, 22);
  assert.equal(laptopData.priceAvailability.priced_skus, 9);
  assert.equal(laptopData.priceAvailability.missing_price_skus, 13);

  // B1. Basic laptop recommendation (coding/work, <= 2,000,000 KRW)
  const lapBasic = catalogEngine.rankCatalogCandidates({
    category: 'laptop',
    candidates: laptopData.allCandidates,
    profile: { version: 1, common: { usages: ['coding', 'work'], spending_style: 'value', mobility: 'high' } },
    purchaseConditions: {
      hard: { budget_max_krw: 2000000, usages: ['coding', 'work'], min_ram_gb: 16 },
      soft: { priorities: ['portability', 'performance'] }
    }
  });
  assert.equal(lapBasic.status, 'recommend');
  assert.equal(lapBasic.policy_version, 'laptop-ranker-v1');
  assert.equal(lapBasic.top_candidates.length, 3);
  for (const entry of lapBasic.top_candidates) {
    assert.ok(entry.candidate.price && entry.candidate.price.amount_krw <= 2000000);
    assert.ok(entry.candidate.ram_gb >= 16);
  }

  // B2. Laptop discrete GPU required (gaming/video) -> returns priced LG Gram Pro 16 (RTX 3050, 16Z90SP-ED7HK) and excludes unpriced RTX laptops
  const lapGpu = catalogEngine.rankCatalogCandidates({
    category: 'laptop',
    candidates: laptopData.allCandidates,
    profile: baseProfile,
    purchaseConditions: {
      hard: { budget_max_krw: 3500000, usages: ['gaming'], require_discrete_gpu: true },
      soft: { priorities: ['performance'] }
    }
  });
  assert.equal(lapGpu.status, 'recommend');
  assert.equal(lapGpu.top_candidates.length, 1);
  assert.equal(lapGpu.top_candidates[0].candidate.model_number, '16Z90SP-ED7HK');
  assert.match(lapGpu.top_candidates[0].candidate.specifications.gpu, /RTX/i);

  // --- C. SMARTWATCH ---
  const watchData = await catalogEngine.fetchPublicCatalogCandidates(db, 'smartwatch', 'KRW');
  assert.equal(watchData.priceAvailability.total_public_skus, 12);
  assert.equal(watchData.priceAvailability.priced_skus, 7);
  assert.equal(watchData.priceAvailability.missing_price_skus, 5);

  // C1. Smartwatch iOS compatibility -> ONLY Apple Watch models
  const watchIos = catalogEngine.rankCatalogCandidates({
    category: 'smartwatch',
    candidates: watchData.allCandidates,
    profile: baseProfile,
    purchaseConditions: {
      hard: { budget_max_krw: 1000000, usages: ['communication'], compatible_os: 'ios' },
      soft: { priorities: ['battery'] }
    }
  });
  assert.equal(watchIos.status, 'recommend');
  assert.equal(watchIos.policy_version, 'smartwatch-ranker-v1');
  assert.ok(watchIos.top_candidates.length >= 1);
  for (const entry of watchIos.top_candidates) {
    assert.equal(entry.candidate.brand_lower, 'apple');
  }

  // C2. Smartwatch Android compatibility -> ONLY Samsung Galaxy Watch models
  const watchAndroid = catalogEngine.rankCatalogCandidates({
    category: 'smartwatch',
    candidates: watchData.allCandidates,
    profile: baseProfile,
    purchaseConditions: {
      hard: { budget_max_krw: 1000000, usages: ['communication'], compatible_os: 'android' },
      soft: { priorities: ['battery'] }
    }
  });
  assert.equal(watchAndroid.status, 'recommend');
  assert.equal(watchAndroid.top_candidates.length, 3);
  for (const entry of watchAndroid.top_candidates) {
    assert.equal(entry.candidate.brand_lower, 'samsung');
  }

  // C3. Smartwatch Cellular required -> Galaxy Watch Ultra 47mm (LTE) SM-L705N
  const watchLte = catalogEngine.rankCatalogCandidates({
    category: 'smartwatch',
    candidates: watchData.allCandidates,
    profile: baseProfile,
    purchaseConditions: {
      hard: { budget_max_krw: 1000000, usages: ['communication'], require_cellular: true },
      soft: {}
    }
  });
  assert.equal(watchLte.status, 'recommend');
  assert.equal(watchLte.top_candidates.length, 1);
  assert.equal(watchLte.top_candidates[0].candidate.model_number, 'SM-L705N');

  // --- D. EARBUDS ---
  const earbudsData = await catalogEngine.fetchPublicCatalogCandidates(db, 'earbuds', 'KRW');
  assert.equal(earbudsData.priceAvailability.total_public_skus, 13);
  assert.equal(earbudsData.priceAvailability.priced_skus, 12);
  assert.equal(earbudsData.priceAvailability.missing_price_skus, 1);

  // D1. Earbuds ANC required -> excludes AirPods 4 (non-ANC, A3050) and unpriced Galaxy Buds FE (SM-R400)
  const budsAnc = catalogEngine.rankCatalogCandidates({
    category: 'earbuds',
    candidates: earbudsData.allCandidates,
    profile: baseProfile,
    purchaseConditions: {
      hard: { budget_max_krw: 260000, usages: ['video', 'communication'], require_anc: true },
      soft: { priorities: ['battery', 'portability'] }
    }
  });
  assert.equal(budsAnc.status, 'recommend');
  assert.equal(budsAnc.policy_version, 'earbuds-ranker-v1');
  assert.equal(budsAnc.top_candidates.length, 3);
  for (const entry of budsAnc.top_candidates) {
    assert.equal(entry.candidate.specifications.anc, true);
    assert.notEqual(entry.candidate.model_number, 'A3050');
    assert.notEqual(entry.candidate.model_number, 'SM-R400');
  }

  // D2. Earbuds brand filter (Sony only -> WF-1000XM5 & LinkBuds S)
  const budsSony = catalogEngine.rankCatalogCandidates({
    category: 'earbuds',
    candidates: earbudsData.allCandidates,
    profile: baseProfile,
    purchaseConditions: {
      hard: { budget_max_krw: 400000, usages: ['video'], allowed_brands: ['sony'] },
      soft: {}
    }
  });
  assert.equal(budsSony.status, 'recommend');
  assert.equal(budsSony.top_candidates.length, 2);
  for (const entry of budsSony.top_candidates) {
    assert.equal(entry.candidate.brand_lower, 'sony');
  }

  // --- E. SPEAKER ---
  const speakerData = await catalogEngine.fetchPublicCatalogCandidates(db, 'speaker', 'KRW');
  assert.equal(speakerData.priceAvailability.total_public_skus, 2);
  assert.equal(speakerData.priceAvailability.priced_skus, 2);
  assert.equal(speakerData.priceAvailability.missing_price_skus, 0);

  // E1. Speaker has 1 public model (JBL Flip 7) with 2 color SKUs -> must return 1 item (not 2 or 3) and attach both colors in color_options
  const spkRank = catalogEngine.rankCatalogCandidates({
    category: 'speaker',
    candidates: speakerData.allCandidates,
    profile: baseProfile,
    purchaseConditions: {
      hard: { budget_max_krw: 200000, usages: ['communication'], require_water_resistance: true },
      soft: { priorities: ['battery', 'portability'] }
    }
  });
  assert.equal(spkRank.status, 'recommend');
  assert.equal(spkRank.policy_version, 'speaker-ranker-v1');
  assert.equal(spkRank.top_candidates.length, 1, 'Speaker category with 1 model must return 1 recommendation without duplicate color SKUs');
  assert.equal(spkRank.top_candidates[0].candidate.model_name, 'JBL Flip 7');
});

test('3. End-to-end API route integration (POST /api/recommendations & POST /api/catalog/:category/recommendations): history save, fallback resilience, and zero internal score leakage', async t => {
  const db = connection.getDatabase();
  const uniqueEmail = `cat_rec_test_${Date.now()}@example.com`;
  let createdUserId = null;

  recRouter.setAiAdapter(aiModule.createAiAdapter({
    mockRecommendFn: ({ aiContext }) => aiModule.mockRecommend({ aiContext })
  }));

  try {
    const user = await db.models.users.create({
      email: uniqueEmail,
      password_hash: 'test_hash_only'
    });
    createdUserId = user.id;

    await db.models.profiles.create({
      user_id: createdUserId,
      version: 1,
      common_json: {
        usages: ['work', 'video', 'communication'],
        spending_style: 'balanced',
        mobility: 'high',
        ecosystem: 'apple'
      },
      smartphone_json: {
        preferred_brands: ['apple'],
        priorities: ['battery', 'portability'],
        preferred_os: 'ios'
      },
      confirmed_at: new Date()
    });

    // 1. POST /api/recommendations with category='speaker' -> returns 1 item with 2 color_options and zero internal score leakage
    const spkRes = await invokeRouter(recRouter, 'POST', '/recommendations', {
      session: { user_id: String(createdUserId) },
      body: {
        category: 'speaker',
        expected_profile_version: 1,
        hard: {
          budget_max_krw: 200000,
          usages: ['communication'],
          require_water_resistance: true
        },
        soft: {
          priorities: ['battery', 'portability']
        }
      }
    });
    assert.equal(spkRes.status, 201);
    assert.equal(spkRes.body.data.category, 'speaker');
    assert.equal(spkRes.body.data.status, 'recommend');
    assert.equal(spkRes.body.data.ranking_policy_version, 'speaker-ranker-v1');
    assert.equal(spkRes.body.data.items.length, 1);
    const spkItem = spkRes.body.data.items[0];
    assert.equal(spkItem.model_name, 'JBL Flip 7');
    assert.equal(spkItem.reference_price.amount_krw, 129120);
    assert.equal(spkItem.color_options.length, 2);

    // Ensure no internal scores or weights leak anywhere in response
    const serialized = JSON.stringify(spkRes.body);
    assert.ok(!serialized.includes('_internal_score'));
    assert.ok(!serialized.includes('_internal_metric_scores'));
    assert.ok(!serialized.includes('_internal_weights'));
    assert.ok(!serialized.includes('recommendation_score'));

    // 2. POST /api/catalog/smartwatch/recommendations with Gemini tampering -> triggers server_fallback cleanly
    recRouter.setAiAdapter(aiModule.createAiAdapter({
      mockRecommendFn: () => ({
        output: {
          status: 'recommend',
          items: [{ variant_id: '999999', rank: 1, profile_refs: ['common.usages'], reason_codes: ['eligible_price'], evidence: [], uncertainties: [] }],
          questions: []
        },
        model_name: 'tampered-ai',
        usage: { prompt_tokens: 10, output_tokens: 10, total_tokens: 20, estimated_cost_usd: 0 }
      })
    }));

    const watchRes = await invokeRouter(recRouter, 'POST', '/catalog/smartwatch/recommendations', {
      params: { category: 'smartwatch' },
      session: { user_id: String(createdUserId) },
      body: {
        expected_profile_version: 1,
        hard: {
          budget_max_krw: 600000,
          usages: ['communication'],
          compatible_os: 'ios'
        },
        soft: {
          priorities: ['portability']
        }
      }
    });
    assert.equal(watchRes.status, 201);
    assert.equal(watchRes.body.data.category, 'smartwatch');
    assert.equal(watchRes.body.data.explanation_source, 'server_fallback');
    assert.ok(watchRes.body.data.items.length >= 1);
    for (const item of watchRes.body.data.items) {
      assert.equal(item.brand.toLowerCase(), 'apple');
    }

    // 3. Verify GET /api/recommendations/:id preserves historical category and reference price
    const histRes = await invokeRouter(recRouter, 'GET', `/recommendations/${watchRes.body.data.id}`, {
      params: { id: watchRes.body.data.id },
      session: { user_id: String(createdUserId) }
    });
    assert.equal(histRes.status, 200);
    assert.equal(histRes.body.data.category, 'smartwatch');
    assert.equal(histRes.body.data.historical_snapshot, true);
    assert.equal(histRes.body.data.items.length, watchRes.body.data.items.length);
  } finally {
    recRouter.setAiAdapter(null);
    if (createdUserId !== null) {
      await db.models.recommendations.destroy({ where: { user_id: createdUserId } });
      await db.models.profiles.destroy({ where: { user_id: createdUserId } });
      await db.models.users.destroy({ where: { id: createdUserId } });
    }
  }
});

test.after(async () => {
  await connection.getDatabase().close();
});
