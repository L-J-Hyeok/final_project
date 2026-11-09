'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const signature = require('cookie-signature');
const connection = require('../db/connection');
const { digest } = require('../auth/store');
const catalog = require('../services/smartphone-catalog');
const aiModule = require('../services/ai-adapter');
const recRouter = require('../routes/recommendations');

test('analysis, recommendation lifecycle, hallucination defense, concurrency conflicts, and history HTTP integration', async () => {
  require('../config/loadEnv')();
  assert.equal(process.env.DB_NAME, 'final_project');
  assert.notEqual(process.env.NODE_ENV, 'production');

  // 자동 테스트는 Mock AI 모드로 실행하여 유료/외부 API 호출을 방지하되, 키 누락 검사는 별도로 수행
  const prevProvider = process.env.AI_PROVIDER;
  const prevKey = process.env.GEMINI_API_KEY;
  process.env.AI_PROVIDER = 'mock';

  const d = await connection.connect();
  const m = d.models;
  const authCfg = require('../auth/config')(process.env);
  const origin = authCfg.origin;
  const prefix = 'rec-test-' + crypto.randomUUID().slice(0, 8);
  const emails = [prefix + '-a@example.invalid', prefix + '-b@example.invalid'];
  const hashes = new Map();
  const createdPrices = [];
  const createdVariants = [];
  const createdPhones = [];
  const users = [];
  let server;
  let checks = 0;

  function check(r, expectedStatus) {
    assert.equal(r.status, expectedStatus, `Expected HTTP ${expectedStatus}, got ${r.status}: ${JSON.stringify(r.body)}`);
    checks++;
    return r.body?.data;
  }

  try {
    for (const email of emails) {
      assert.equal(await m.users.count({ where: { email } }), 0);
    }

    const now = new Date();
    const { minDate, maxDate } = catalog.releaseWindowKst(now);
    const verifiedAt = new Date(now.getTime() - 3600 * 1000);
    const freshObservedAt = new Date(now.getTime() - 2 * 3600 * 1000);
    const freshExpiresAt = new Date(freshObservedAt.getTime() + 24 * 3600 * 1000);

    // 가상 테스트 스마트폰 2종 생성 (실제 개인정보 없음)
    const samsungPhone = await m.smartphones.create({
      brand: 'samsung',
      model_name: prefix + ' Galaxy S24',
      domestic_model_number: 'SM-S921N-' + prefix,
      released_on_kr: minDate,
      os: 'android',
      chipset: 'Exynos 2400',
      screen_inches: 6.20,
      refresh_hz: 120,
      battery_mah: 4000,
      weight_g: 141.00,
      supports_5g: true,
      wireless_charging: true,
      source_name: 'Samsung KR Spec',
      source_url: 'https://example.invalid/s24',
      verified_at: verifiedAt,
      verified: true,
      is_test: true
    });
    createdPhones.push(samsungPhone);

    const applePhone = await m.smartphones.create({
      brand: 'apple',
      model_name: prefix + ' iPhone 16',
      domestic_model_number: 'A3287-' + prefix,
      released_on_kr: maxDate,
      os: 'ios',
      chipset: 'A18',
      screen_inches: 6.10,
      refresh_hz: 60,
      battery_mah: 3561,
      weight_g: 143.00,
      supports_5g: true,
      wireless_charging: true,
      source_name: 'Apple KR Spec',
      source_url: 'https://example.invalid/ip16',
      verified_at: verifiedAt,
      verified: true,
      is_test: true
    });
    createdPhones.push(applePhone);

    const vSamsung256 = await m.smartphone_variants.create({
      smartphone_id: samsungPhone.id,
      storage_gb: 256,
      ram_gb: 8,
      color: 'black',
      source_name: 'Samsung KR Spec',
      source_url: 'https://example.invalid/s24-256',
      verified_at: verifiedAt,
      verified: true
    });
    createdVariants.push(vSamsung256);

    const vApple256 = await m.smartphone_variants.create({
      smartphone_id: applePhone.id,
      storage_gb: 256,
      ram_gb: 8,
      color: 'white',
      source_name: 'Apple KR Spec',
      source_url: 'https://example.invalid/ip16-256',
      verified_at: verifiedAt,
      verified: true
    });
    createdVariants.push(vApple256);

    const pSamsung = await m.price_observations.create({
      variant_id: vSamsung256.id,
      source_name: 'TestPriceSource',
      source_url: 'https://example.invalid/ps1',
      seller_name: 'SellerA',
      amount_krw: 947000,
      shipping_krw: 3000,
      observed_at: freshObservedAt,
      expires_at: freshExpiresAt,
      conditions_text: '무조건 자급제 신품',
      unconditional: true,
      in_stock: true,
      is_new: true,
      is_unlocked: true
    });
    createdPrices.push(pSamsung);

    const pApple = await m.price_observations.create({
      variant_id: vApple256.id,
      source_name: 'TestPriceSource',
      source_url: 'https://example.invalid/pa1',
      seller_name: 'SellerB',
      amount_krw: 990000,
      shipping_krw: 0,
      observed_at: freshObservedAt,
      expires_at: freshExpiresAt,
      conditions_text: '무조건 자급제 신품',
      unconditional: true,
      in_stock: true,
      is_new: true,
      is_unlocked: true
    });
    createdPrices.push(pApple);

    server = require('../app').listen(0, '127.0.0.1');
    await new Promise(r => server.once('listening', r));
    const base = 'http://127.0.0.1:' + server.address().port + '/api';

    function client() {
      return { cookie: '', csrf: '' };
    }
    async function req(c, method, path, body, opts = {}) {
      const headers = { Origin: opts.origin || origin };
      if (c.cookie) headers.Cookie = c.cookie;
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        if (!opts.noCsrf) headers['X-CSRF-Token'] = opts.token || c.csrf;
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

    const a = client();
    const b = client();
    const anon = client();

    // 1. 비로그인 401 검증
    anon.csrf = check(await req(anon, 'GET', '/auth/csrf'), 200).csrf_token;
    check(await req(anon, 'POST', '/analysis', { purpose: 'purchase', text: '100만원 이하' }), 401);
    check(await req(anon, 'POST', '/recommendations', { expected_profile_version: 1, hard: { budget_max_krw: 1000000, usages: ['video'] } }), 401);
    check(await req(anon, 'GET', '/recommendations'), 401);

    // 가상 테스트 사용자 A, B 가입 및 로그인
    for (const [i, c] of [a, b].entries()) {
      c.csrf = check(await req(c, 'GET', '/auth/csrf'), 200).csrf_token;
      const u = check(await req(c, 'POST', '/auth/register', { email: emails[i], password: 'test-only-password-12345' }), 201);
      users.push(u.id);
      const login = check(await req(c, 'POST', '/auth/login', { email: emails[i], password: 'test-only-password-12345' }), 200);
      c.csrf = login.csrf_token;
    }

    // 2. CSRF 검증 (403) 및 입력 검증 (422)
    check(await req(a, 'POST', '/analysis', { purpose: 'purchase', text: '100만원 이하' }, { noCsrf: true }), 403);
    check(await req(a, 'POST', '/analysis', { purpose: 'invalid', text: '100만원 이하' }), 422);
    check(await req(a, 'POST', '/analysis', { purpose: 'purchase', text: '' }), 422);

    // 3. POST /api/analysis 실행 후 DB에 자동 저장되지 않음을 검증
    const draftProfile = check(await req(a, 'POST', '/analysis', {
      purpose: 'profile',
      text: '대학생이고 유튜브·코딩 위주로 사용하며 가성비를 중시해. 삼성 선호야.'
    }), 200);
    assert.deepEqual(draftProfile.draft.common.usages.sort(), ['coding', 'video']);
    assert.equal(draftProfile.draft.common.spending_style, 'value');
    assert.deepEqual(draftProfile.draft.smartphone.preferred_brands, ['samsung']);

    // 프로필은 여전히 version=1, confirmed_at=null 이어야 함 (자동 저장 0)
    const profBefore = check(await req(a, 'GET', '/profile'), 200);
    assert.equal(profBefore.version, 1);
    assert.equal(profBefore.confirmed_at, null);

    // 4. 사용자가 확인 후 PUT /api/profile로 저장 (version=2)
    const profConfirmed = check(await req(a, 'PUT', '/profile', {
      expected_version: 1,
      common: { usages: ['video', 'coding'], spending_style: 'value', mobility: 'high', ecosystem: 'android', lifestyle_note: null },
      smartphone: { preferred_brands: ['samsung'], priorities: ['battery', 'portability'], preferred_os: 'android' }
    }), 200);
    assert.equal(profConfirmed.version, 2);

    // 5. Gemini 모드에서 API 키가 없을 때 명확한 안내와 함께 503 AI_KEY_MISSING 반환 확인
    process.env.AI_PROVIDER = 'gemini';
    delete process.env.GEMINI_API_KEY;
    const noKeyRes = await req(a, 'POST', '/analysis', { purpose: 'purchase', text: '100만원 이하 삼성폰' });
    check(noKeyRes, 503);
    assert.equal(noKeyRes.body.error.code, 'AI_KEY_MISSING');
    assert.ok(noKeyRes.body.error.message.includes('GEMINI_API_KEY'));
    process.env.AI_PROVIDER = 'mock';

    // 6. POST /api/recommendations 정상 추천 (Mock AI)
    // max_weight_g: 145로 병렬 실행 중인 다른 테스트의 테스트 데이터와 격리
    const recOk = check(await req(a, 'POST', '/recommendations', {
      expected_profile_version: 2,
      hard: {
        budget_max_krw: 1000000,
        usages: ['video', 'coding'],
        min_storage_gb: 256,
        max_weight_g: 145,
        allowed_brands: ['samsung', 'apple']
      },
      soft: {
        preferred_brands: ['samsung'],
        priorities: ['battery', 'portability']
      },
      include_test: true
    }), 201);

    assert.equal(recOk.status, 'recommend');
    assert.equal(recOk.items.length, 2);
    // 삼성 선호 + 더 저렴한 가격(950,000 vs 990,000)이므로 vSamsung256이 rank 1이어야 함
    assert.equal(recOk.items[0].variant_id, String(vSamsung256.id));
    assert.equal(recOk.items[0].rank, 1);
    assert.equal(recOk.items[0].price.total_krw, 950000);
    assert.ok(recOk.items[0].reasons.some(r => r.code === 'storage_meets_requirement'));
    assert.ok(recOk.items[0].reasons.some(r => r.code === 'preferred_brand_match'));

    // 7. 후보가 없는 경우(no_match) AI를 호출하지 않고 질문과 함께 201 저장 반환
    let aiCalledOnNoMatch = false;
    recRouter.setAiAdapter(aiModule.createAiAdapter({
      mockRecommendFn: async () => {
        aiCalledOnNoMatch = true;
        throw new Error('SHOULD_NOT_BE_CALLED');
      }
    }));
    const recNoMatch = check(await req(a, 'POST', '/recommendations', {
      expected_profile_version: 2,
      hard: {
        budget_max_krw: 400000,
        usages: ['coding'],
        min_storage_gb: 512
      },
      include_test: true
    }), 201);
    assert.equal(recNoMatch.status, 'no_match');
    assert.equal(aiCalledOnNoMatch, false);
    assert.ok(recNoMatch.questions.length >= 2);
    recRouter.setAiAdapter(null);

    // 8. AI가 후보에 없는 제품 ID나 조작된 근거를 반환할 때 1회 재시도 후 502 AI_INVALID_RESULT 차단 및 failed 기록 확인
    let attemptCount = 0;
    recRouter.setAiAdapter(aiModule.createAiAdapter({
      mockRecommendFn: async () => {
        attemptCount++;
        return {
          output: {
            status: 'recommend',
            items: [
              {
                variant_id: '999999999', // 존재하지 않는 ID
                rank: 1,
                profile_refs: ['common.usages'],
                reason_codes: ['storage_meets_requirement'],
                evidence: [{ variant_id: '999999999', field: 'storage_gb', value: 256 }],
                uncertainties: []
              }
            ],
            questions: []
          },
          model_name: 'mock-bad-ai',
          usage: { prompt_tokens: 10, output_tokens: 10, total_tokens: 20, estimated_cost_usd: 0 }
        };
      }
    }));
    const badAiRes = await req(a, 'POST', '/recommendations', {
      expected_profile_version: 2,
      hard: { budget_max_krw: 1000000, usages: ['video'], min_storage_gb: 256, max_weight_g: 145 },
      include_test: true
    });
    check(badAiRes, 502);
    assert.equal(badAiRes.body.error.code, 'AI_INVALID_RESULT');
    assert.equal(attemptCount, 2, 'Must retry exactly once (total 2 attempts) and stop');
    recRouter.setAiAdapter(null);

    // 9. AI 처리 도중 가격이 변동/만료된 경우 저장 직전 409 CANDIDATES_CHANGED로 차단되는지 확인
    // 별도 사용자 B의 프로필을 확정하여 레이스 테스트 수행
    check(await req(b, 'PUT', '/profile', {
      expected_version: 1,
      common: { usages: ['video'], spending_style: 'balanced' },
      smartphone: {}
    }), 200);

    recRouter.setAiAdapter(aiModule.createAiAdapter({
      mockRecommendFn: async ({ aiContext }) => {
        // AI 응답 반환 직전에 DB의 가격 관측치를 품절(in_stock=false)로 변경해 후보 가격 유효성 파괴
        await pSamsung.update({ in_stock: false });
        return aiModule.mockRecommend({ aiContext });
      }
    }));
    const priceChangedRes = await req(b, 'POST', '/recommendations', {
      expected_profile_version: 2,
      hard: { budget_max_krw: 1000000, usages: ['video'], min_storage_gb: 256, max_weight_g: 145 },
      include_test: true
    });
    check(priceChangedRes, 409);
    assert.equal(priceChangedRes.body.error.code, 'CANDIDATES_CHANGED');
    await pSamsung.update({ in_stock: true });
    recRouter.setAiAdapter(null);

    // 10. 추천 이력 조회 (GET /api/recommendations, GET /api/recommendations/:id) 및 가격 만료 표시 확인
    const historyList = check(await req(a, 'GET', '/recommendations'), 200);
    assert.ok(historyList.length >= 2);
    const savedRecDetail = check(await req(a, 'GET', '/recommendations/' + recOk.id), 200);
    assert.equal(savedRecDetail.id, recOk.id);
    assert.equal(savedRecDetail.items[0].price.total_krw, 950000);
    assert.equal(savedRecDetail.items[0].price.is_expired_now, false);

    // 저장된 스냅샷의 expires_at을 과거로 수정한 뒤 조회 시 당시 가격은 유지되면서 is_expired_now=true가 표시되는지 확인
    const recRow = await m.recommendations.findByPk(recOk.id);
    const modifiedResultJson = structuredClone(recRow.result_json);
    modifiedResultJson.items[0].price.expires_at = new Date(Date.now() - 60000).toISOString();
    await recRow.update({ result_json: modifiedResultJson });

    const expiredRecDetail = check(await req(a, 'GET', '/recommendations/' + recOk.id), 200);
    assert.equal(expiredRecDetail.items[0].price.total_krw, 950000);
    assert.equal(expiredRecDetail.items[0].price.is_expired_now, true);
    assert.ok(expiredRecDetail.items[0].price.price_status_note.includes('만료'));

    // 11. 다른 사용자(User B)가 User A의 추천 이력을 조회하거나 삭제하려 할 때 404 차단 확인
    check(await req(b, 'GET', '/recommendations/' + recOk.id), 404);
    check(await req(b, 'DELETE', '/recommendations/' + recOk.id, {}), 404);

    // 12. 본인 추천 이력 삭제 (204) 및 재조회 시 404 확인
    check(await req(a, 'DELETE', '/recommendations/' + recOk.id, {}), 204);
    check(await req(a, 'GET', '/recommendations/' + recOk.id), 404);

    // 13. 오류 처리 검증: AI 요청 실패(502 AI_UNAVAILABLE), 타임아웃(504 AI_TIMEOUT), 잘못된 출력(502 AI_INVALID_RESULT), 그리고 분당 5회 초과 시 사용량 제한(429 RATE_LIMITED)
    // User B는 앞서 9번에서 1회 호출했으므로 앞으로 4회 더 호출 가능하고 6번째 호출에서 429가 발생해야 함
    for (const [errCode, expectedHttp, path, body] of [
      ['AI_UNAVAILABLE', 502, '/analysis', { purpose: 'purchase', text: '80만원 이하 삼성폰' }],
      ['AI_TIMEOUT', 504, '/analysis', { purpose: 'purchase', text: '80만원 이하 삼성폰' }],
      ['AI_UNAVAILABLE', 502, '/recommendations', { expected_profile_version: 2, hard: { budget_max_krw: 1000000, usages: ['video'], min_storage_gb: 256, max_weight_g: 145 }, include_test: true }],
      ['AI_TIMEOUT', 504, '/recommendations', { expected_profile_version: 2, hard: { budget_max_krw: 1000000, usages: ['video'], min_storage_gb: 256, max_weight_g: 145 }, include_test: true }]
    ]) {
      recRouter.setAiAdapter(aiModule.createAiAdapter({
        mockAnalyzeFn: async () => {
          throw Object.assign(new Error(errCode), { code: errCode, status: expectedHttp });
        },
        mockRecommendFn: async () => {
          throw Object.assign(new Error(errCode), { code: errCode, status: expectedHttp });
        }
      }));
      const errRes = await req(b, 'POST', path, body);
      check(errRes, expectedHttp);
      assert.equal(errRes.body.error.code, errCode);
    }
    recRouter.setAiAdapter(null);

    // User B의 분당 6번째 AI 호출 -> 어댑터 도달 전에 서버 자체 레이트 리미터가 429 RATE_LIMITED로 차단
    const rateLimitedRes = await req(b, 'POST', '/analysis', { purpose: 'purchase', text: '6번째 호출 제한 확인' });
    check(rateLimitedRes, 429);
    assert.equal(rateLimitedRes.body.error.code, 'RATE_LIMITED');

    console.log('recommendation HTTP status assertions:', checks);
  } finally {
    recRouter.setAiAdapter(null);
    if (prevProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = prevProvider;
    if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevKey;

    if (server) await new Promise(r => server.close(r));
    for (const h of hashes.values()) await m.sessions.destroy({ where: { sid_hash: h } });
    for (const email of emails) await m.users.destroy({ where: { email } });
    for (const p of createdPrices) await p.destroy();
    for (const v of createdVariants) await v.destroy();
    for (const s of createdPhones) await s.destroy();

    for (const uid of users) {
      for (const name of ['profiles', 'owned_devices', 'recommendations', 'sessions']) {
        assert.equal(await m[name].count({ where: { user_id: uid } }), 0);
      }
    }
    await connection.close();
  }
});
