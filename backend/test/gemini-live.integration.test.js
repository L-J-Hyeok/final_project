'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const signature = require('cookie-signature');
const connection = require('../db/connection');
const { digest } = require('../auth/store');
const catalog = require('../services/smartphone-catalog');
const aiModule = require('../services/ai-adapter');

test('Live Gemini API natural language analysis and end-to-end smartphone recommendation verification', async () => {
  require('../config/loadEnv')();
  assert.equal(process.env.DB_NAME, 'final_project');
  assert.notEqual(process.env.NODE_ENV, 'production');

  // Ensure Gemini provider is active (do not read or print GEMINI_API_KEY)
  const prevProvider = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = 'gemini';

  const d = await connection.connect();
  const m = d.models;
  const authCfg = require('../auth/config')(process.env);
  const origin = authCfg.origin;
  const prefix = 'live-gemini-' + crypto.randomUUID().slice(0, 8);
  const email = prefix + '@example.invalid';
  const hashes = new Map();
  const createdPrices = [];
  const createdVariants = [];
  const createdPhones = [];
  let userId = null;
  let server;
  let totalCalls = 0;
  let totalPromptTokens = 0;
  let totalOutputTokens = 0;
  let totalEstimatedUsd = 0;

  try {
    assert.equal(await m.users.count({ where: { email } }), 0);

    const now = new Date();
    const { minDate, maxDate } = catalog.releaseWindowKst(now);
    const verifiedAt = new Date(now.getTime() - 3600 * 1000);
    const freshObservedAt = new Date(now.getTime() - 1 * 3600 * 1000);
    const freshExpiresAt = new Date(freshObservedAt.getTime() + 24 * 3600 * 1000);

    // 가상 검증 스마트폰 2종 구성 (예산 80만 원 이하: 갤럭시 A35 5000mAh 49만 원 vs 아이폰 SE 2018mAh 65만 원)
    // max_weight_g: 135로 격리하여 이 두 후보만 정확히 매칭되도록 설정
    const galaxyBudgetPhone = await m.smartphones.create({
      brand: 'samsung',
      model_name: prefix + ' Galaxy A35 5G',
      domestic_model_number: 'SM-A356N-' + prefix,
      released_on_kr: maxDate,
      os: 'android',
      chipset: 'Exynos 1380',
      screen_inches: 6.60,
      refresh_hz: 120,
      battery_mah: 5000,
      weight_g: 131.00,
      supports_5g: true,
      wireless_charging: false,
      source_name: 'Samsung KR Official Spec',
      source_url: 'https://example.invalid/sm-a356n',
      verified_at: verifiedAt,
      verified: true,
      review_status: 'legacy',
      is_test: true
    });
    createdPhones.push(galaxyBudgetPhone);

    const iphoneBudgetPhone = await m.smartphones.create({
      brand: 'apple',
      model_name: prefix + ' iPhone Budget',
      domestic_model_number: 'A2783-' + prefix,
      released_on_kr: minDate,
      os: 'ios',
      chipset: 'A15 Bionic',
      screen_inches: 4.70,
      refresh_hz: 60,
      battery_mah: 2018,
      weight_g: 133.00,
      supports_5g: true,
      wireless_charging: true,
      source_name: 'Apple KR Official Spec',
      source_url: 'https://example.invalid/a2783',
      verified_at: verifiedAt,
      verified: true,
      review_status: 'legacy',
      is_test: true
    });
    createdPhones.push(iphoneBudgetPhone);

    const vGalaxy128 = await m.smartphone_variants.create({
      smartphone_id: galaxyBudgetPhone.id,
      storage_gb: 128,
      ram_gb: 6,
      color: 'black',
      source_name: 'Samsung KR Official Spec',
      source_url: 'https://example.invalid/sm-a356n-128',
      verified_at: verifiedAt,
      verified: true,
      review_status: 'legacy'
    });
    createdVariants.push(vGalaxy128);

    const vIphone128 = await m.smartphone_variants.create({
      smartphone_id: iphoneBudgetPhone.id,
      storage_gb: 128,
      ram_gb: 4,
      color: 'white',
      source_name: 'Apple KR Official Spec',
      source_url: 'https://example.invalid/a2783-128',
      verified_at: verifiedAt,
      verified: true,
      review_status: 'legacy'
    });
    createdVariants.push(vIphone128);

    createdPrices.push(await m.price_observations.create({
      variant_id: vGalaxy128.id,
      source_name: 'TestPriceSource',
      source_url: 'https://example.invalid/price-a35',
      seller_name: 'SellerKR1',
      amount_krw: 490000,
      shipping_krw: 0,
      observed_at: freshObservedAt,
      expires_at: freshExpiresAt,
      conditions_text: '무조건 자급제 신품 무료배송',
      unconditional: true,
      in_stock: true,
      is_new: true,
      is_unlocked: true
    }));

    createdPrices.push(await m.price_observations.create({
      variant_id: vIphone128.id,
      source_name: 'TestPriceSource',
      source_url: 'https://example.invalid/price-ip',
      seller_name: 'SellerKR2',
      amount_krw: 650000,
      shipping_krw: 0,
      observed_at: freshObservedAt,
      expires_at: freshExpiresAt,
      conditions_text: '무조건 자급제 신품 무료배송',
      unconditional: true,
      in_stock: true,
      is_new: true,
      is_unlocked: true
    }));

    server = require('../app').listen(0, '127.0.0.1');
    await new Promise(r => server.once('listening', r));
    const base = 'http://127.0.0.1:' + server.address().port + '/api';

    const c = { cookie: '', csrf: '' };
    async function req(method, path, body) {
      const headers = { Origin: origin };
      if (c.cookie) headers.Cookie = c.cookie;
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        headers['X-CSRF-Token'] = c.csrf;
      }
      const r = await fetch(base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const sc = r.headers.get('set-cookie');
      if (sc) {
        const cookie = sc.split(';')[0];
        if (cookie !== 'sid=') {
          c.cookie = cookie;
          const sid = signature.unsign(decodeURIComponent(cookie.split('=')[1]).slice(2), authCfg.secret);
          assert.ok(sid);
          hashes.set(digest(sid).toString('hex'), digest(sid));
        }
      }
      return { status: r.status, body: r.status === 204 ? null : await r.json() };
    }

    // 1. 가상 사용자 가입 및 로그인
    const csrfRes = await req('GET', '/auth/csrf');
    assert.equal(csrfRes.status, 200);
    c.csrf = csrfRes.body.data.csrf_token;

    const regRes = await req('POST', '/auth/register', { email, password: 'test-only-password-12345' });
    assert.equal(regRes.status, 201);
    userId = regRes.body.data.id;

    const loginRes = await req('POST', '/auth/login', { email, password: 'test-only-password-12345' });
    assert.equal(loginRes.status, 200);
    c.csrf = loginRes.body.data.csrf_token;

    // 2. 실제 Gemini 자연어 분석 호출 (1회)
    const samplePrompt = '나는 게임을 거의 하지 않고 유튜브와 웹서핑을 주로 해. 배터리가 오래가는 삼성 갤럭시를 선호하고 예산은 80만 원 이하여야 해.';
    const analysisRes = await req('POST', '/analysis', {
      purpose: 'purchase',
      text: samplePrompt
    });
    assert.equal(analysisRes.status, 200, `Analysis failed: ${JSON.stringify(analysisRes.body)}`);
    totalCalls += 1;
    const analysisData = analysisRes.body.data;
    totalPromptTokens += analysisData.ai_meta?.usage?.prompt_tokens || 0;
    totalOutputTokens += analysisData.ai_meta?.usage?.output_tokens || 0;
    totalEstimatedUsd += analysisData.ai_meta?.usage?.estimated_cost_usd || 0;

    console.log('LIVE_GEMINI_ANALYSIS_RESULT:', JSON.stringify(analysisData));

    // 검증: 예산 800,000원 인식, 유튜브/웹서핑 목적(video 등, gaming 미포함), 삼성 선호(soft.preferred_brands), 배터리 중요도(soft.priorities)
    assert.equal(analysisData.draft.hard.budget_max_krw, 800000);
    assert.ok(Array.isArray(analysisData.draft.hard.usages) && analysisData.draft.hard.usages.includes('video'));
    assert.equal(analysisData.draft.hard.usages.includes('gaming'), false);
    assert.deepEqual(analysisData.draft.soft.preferred_brands, ['samsung']);
    assert.ok(Array.isArray(analysisData.draft.soft.priorities) && analysisData.draft.soft.priorities.includes('battery'));
    // 사용자가 언급하지 않은 조건(예: allowed_brands 필수 제한, min_storage_gb 등)을 임의로 hard로 강제하지 않았는지 확인
    assert.equal(analysisData.draft.hard.allowed_brands, undefined);
    assert.equal(analysisData.draft.hard.min_storage_gb, undefined);

    // DB에 자동 저장되지 않았는지 확인
    const profBefore = await req('GET', '/profile');
    assert.equal(profBefore.body.data.version, 1);
    assert.equal(profBefore.body.data.confirmed_at, null);

    // 3. 가상 프로필 확정 저장 (version=2)
    const putProfRes = await req('PUT', '/profile', {
      expected_version: 1,
      common: {
        usages: ['video', 'communication'],
        spending_style: 'value',
        mobility: 'medium',
        ecosystem: 'android',
        lifestyle_note: null
      },
      smartphone: {
        preferred_brands: ['samsung'],
        priorities: ['battery'],
        preferred_os: 'android'
      }
    });
    assert.equal(putProfRes.status, 200);
    assert.equal(putProfRes.body.data.version, 2);

    // 4. 실제 Gemini 스마트폰 추천 실행 (POST /api/recommendations)
    const recRes = await req('POST', '/recommendations', {
      expected_profile_version: 2,
      hard: {
        budget_max_krw: 800000,
        usages: ['video', 'communication'],
        min_storage_gb: 128,
        max_weight_g: 135,
        allowed_brands: ['samsung', 'apple']
      },
      soft: {
        preferred_brands: ['samsung'],
        priorities: ['battery'],
        preferred_os: 'android'
      },
      include_test: true
    });
    assert.equal(recRes.status, 201, `Recommendation failed: ${JSON.stringify(recRes.body)}`);
    totalCalls += 1;
    const recData = recRes.body.data;
    totalPromptTokens += recData.ai_usage?.prompt_tokens || 0;
    totalOutputTokens += recData.ai_usage?.output_tokens || 0;
    totalEstimatedUsd += recData.ai_usage?.estimated_cost_usd || 0;

    console.log('LIVE_GEMINI_RECOMMENDATION_RESULT:', JSON.stringify(recData));

    assert.equal(recData.status, 'recommend');
    assert.ok(recData.items.length >= 1 && recData.items.length <= 2);
    // 1순위는 삼성 선호 + 5000mAh 배터리 + 49만 원인 vGalaxy128 이어야 함
    assert.equal(recData.items[0].variant_id, String(vGalaxy128.id));
    assert.equal(recData.items[0].rank, 1);
    assert.equal(recData.items[0].price.total_krw, 490000);
    assert.ok(recData.items[0].reasons.length >= 1);
    assert.ok(recData.items[0].evidence.length >= 1);

    // 5. 저장된 추천 이력 조회 및 삭제 확인
    const getHistRes = await req('GET', '/recommendations/' + recData.id);
    assert.equal(getHistRes.status, 200);
    assert.equal(getHistRes.body.data.id, recData.id);
    assert.equal(getHistRes.body.data.items[0].variant_id, String(vGalaxy128.id));
    assert.equal(getHistRes.body.data.items[0].price.is_expired_now, false);

    const delHistRes = await req('DELETE', '/recommendations/' + recData.id, {});
    assert.equal(delHistRes.status, 204);

    console.log('LIVE_GEMINI_USAGE_SUMMARY:', JSON.stringify({
      model: recData.model_name,
      total_calls: totalCalls,
      total_prompt_tokens: totalPromptTokens,
      total_output_tokens: totalOutputTokens,
      total_tokens: totalPromptTokens + totalOutputTokens,
      estimated_cost_usd: Number(totalEstimatedUsd.toFixed(8))
    }));
  } finally {
    if (prevProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = prevProvider;

    if (server) await new Promise(r => server.close(r));
    for (const h of hashes.values()) await m.sessions.destroy({ where: { sid_hash: h } });
    await m.users.destroy({ where: { email } });
    for (const p of createdPrices) await p.destroy();
    for (const v of createdVariants) await v.destroy();
    for (const s of createdPhones) await s.destroy();

    if (userId) {
      for (const name of ['profiles', 'owned_devices', 'recommendations', 'sessions']) {
        assert.equal(await m[name].count({ where: { user_id: userId } }), 0);
      }
    }
    await connection.close();
  }
});
