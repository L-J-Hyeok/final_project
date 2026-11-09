'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const signature = require('cookie-signature');
const connection = require('../db/connection');
const { digest } = require('../auth/store');
const catalog = require('../services/smartphone-catalog');

test('smartphone product/price lookup and candidate search HTTP integration', async () => {
  require('../config/loadEnv')();
  assert.equal(process.env.DB_NAME, 'final_project');
  assert.notEqual(process.env.NODE_ENV, 'production');

  const d = await connection.connect();
  const m = d.models;
  const authCfg = require('../auth/config')(process.env);
  const origin = authCfg.origin;
  const prefix = 'phone-test-' + crypto.randomUUID().slice(0, 8);
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
    const freshObservedAt = new Date(now.getTime() - 2 * 3600 * 1000); // 2h ago
    const freshExpiresAt = new Date(freshObservedAt.getTime() + 24 * 3600 * 1000); // +24h
    const olderObservedAt = new Date(now.getTime() - 4 * 3600 * 1000); // 4h ago
    const olderExpiresAt = new Date(olderObservedAt.getTime() + 24 * 3600 * 1000);
    const expiredObservedAt = new Date(now.getTime() - 25 * 3600 * 1000); // 25h ago
    const expiredExpiresAt = new Date(expiredObservedAt.getTime() + 24 * 3600 * 1000); // 1h ago (expired)

    // 1. Samsung model within 3 years (boundary minDate)
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
      weight_g: 167.00,
      supports_5g: true,
      wireless_charging: true,
      source_name: 'Samsung KR Spec',
      source_url: 'https://example.invalid/samsung-s24',
      verified_at: verifiedAt,
      verified: true,
      is_test: true
    });
    createdPhones.push(samsungPhone);

    // 2. Apple model within 3 years (maxDate), wireless_charging=true, weight=170g
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
      weight_g: 170.00,
      supports_5g: true,
      wireless_charging: true,
      source_name: 'Apple KR Spec',
      source_url: 'https://example.invalid/apple-16',
      verified_at: verifiedAt,
      verified: true,
      is_test: true
    });
    createdPhones.push(applePhone);

    // 3. Old Samsung model outside 3-year window (2020-03-06) -> for owned device comparison & 3-year filter exclusion
    const oldSamsungPhone = await m.smartphones.create({
      brand: 'samsung',
      model_name: prefix + ' Galaxy S20 Old',
      domestic_model_number: 'SM-G981N-' + prefix,
      released_on_kr: '2020-03-06',
      os: 'android',
      chipset: 'Snapdragon 865',
      screen_inches: 6.20,
      refresh_hz: 60,
      battery_mah: 4000,
      weight_g: 195.00,
      supports_5g: true,
      wireless_charging: true,
      source_name: 'Samsung KR Archive',
      source_url: 'https://example.invalid/samsung-s20',
      verified_at: verifiedAt,
      verified: true,
      is_test: true
    });
    createdPhones.push(oldSamsungPhone);

    // 4. Other brand model -> excluded from /smartphones & candidates
    const otherBrandPhone = await m.smartphones.create({
      brand: 'other',
      model_name: prefix + ' Other Phone',
      domestic_model_number: 'OTH-100-' + prefix,
      released_on_kr: maxDate,
      os: 'android',
      source_name: 'Other Spec',
      source_url: 'https://example.invalid/other',
      verified_at: verifiedAt,
      verified: true,
      is_test: true
    });
    createdPhones.push(otherBrandPhone);

    // Variants:
    // vSamsung256Black: 256GB black (valid price 950,000)
    const vSamsung256Black = await m.smartphone_variants.create({
      smartphone_id: samsungPhone.id,
      storage_gb: 256,
      ram_gb: 8,
      color: 'black',
      source_name: 'Samsung KR Spec',
      source_url: 'https://example.invalid/samsung-s24-256-black',
      verified_at: verifiedAt,
      verified: true
    });
    createdVariants.push(vSamsung256Black);

    // vSamsung512Gray: 512GB gray (valid price 1,150,000)
    const vSamsung512Gray = await m.smartphone_variants.create({
      smartphone_id: samsungPhone.id,
      storage_gb: 512,
      ram_gb: 8,
      color: 'gray',
      source_name: 'Samsung KR Spec',
      source_url: 'https://example.invalid/samsung-s24-512-gray',
      verified_at: verifiedAt,
      verified: true
    });
    createdVariants.push(vSamsung512Gray);

    // vApple256White: 256GB white (valid price 1,000,000)
    const vApple256White = await m.smartphone_variants.create({
      smartphone_id: applePhone.id,
      storage_gb: 256,
      ram_gb: 8,
      color: 'white',
      source_name: 'Apple KR Spec',
      source_url: 'https://example.invalid/apple-16-256-white',
      verified_at: verifiedAt,
      verified: true
    });
    createdVariants.push(vApple256White);

    // vApple128BlackExpired: 128GB black (only expired price -> excluded from candidates, shown as expired in GET /smartphones/:id)
    const vApple128BlackExpired = await m.smartphone_variants.create({
      smartphone_id: applePhone.id,
      storage_gb: 128,
      ram_gb: 8,
      color: 'black',
      source_name: 'Apple KR Spec',
      source_url: 'https://example.invalid/apple-16-128-black',
      verified_at: verifiedAt,
      verified: true
    });
    createdVariants.push(vApple128BlackExpired);

    // vOldSamsung128: old phone variant for owned device registration
    const vOldSamsung128 = await m.smartphone_variants.create({
      smartphone_id: oldSamsungPhone.id,
      storage_gb: 128,
      ram_gb: 12,
      color: 'blue',
      source_name: 'Samsung KR Archive',
      source_url: 'https://example.invalid/samsung-s20-128',
      verified_at: verifiedAt,
      verified: true
    });
    createdVariants.push(vOldSamsung128);

    // vOther256: other brand variant
    const vOther256 = await m.smartphone_variants.create({
      smartphone_id: otherBrandPhone.id,
      storage_gb: 256,
      ram_gb: 8,
      color: 'black',
      source_name: 'Other Spec',
      source_url: 'https://example.invalid/other-256',
      verified_at: verifiedAt,
      verified: true
    });
    createdVariants.push(vOther256);

    // Price observations for vSamsung256Black:
    // SellerA older cheap (850,000, in_stock=true) + SellerA newer out-of-stock (850,000, in_stock=false)
    // SellerB valid (947,000 + 3,000 = 950,000)
    // SellerC conditional card discount (800,000, unconditional=false)
    createdPrices.push(await m.price_observations.create({
      variant_id: vSamsung256Black.id,
      source_name: 'TestPriceSource',
      source_url: 'https://example.invalid/p1',
      seller_name: 'SellerA',
      amount_krw: 850000,
      shipping_krw: 0,
      observed_at: olderObservedAt,
      expires_at: olderExpiresAt,
      conditions_text: '자급제 신품',
      unconditional: true,
      in_stock: true,
      is_new: true,
      is_unlocked: true
    }));
    createdPrices.push(await m.price_observations.create({
      variant_id: vSamsung256Black.id,
      source_name: 'TestPriceSource',
      source_url: 'https://example.invalid/p2',
      seller_name: 'SellerA',
      amount_krw: 850000,
      shipping_krw: 0,
      observed_at: freshObservedAt,
      expires_at: freshExpiresAt,
      conditions_text: '일시 품절',
      unconditional: true,
      in_stock: false,
      is_new: true,
      is_unlocked: true
    }));
    const validSamsung256Price = await m.price_observations.create({
      variant_id: vSamsung256Black.id,
      source_name: 'TestPriceSource',
      source_url: 'https://example.invalid/p3',
      seller_name: 'SellerB',
      amount_krw: 947000,
      shipping_krw: 3000,
      observed_at: freshObservedAt,
      expires_at: freshExpiresAt,
      conditions_text: '무조건 자급제 신품 배송비 3000원',
      unconditional: true,
      in_stock: true,
      is_new: true,
      is_unlocked: true
    });
    createdPrices.push(validSamsung256Price);
    createdPrices.push(await m.price_observations.create({
      variant_id: vSamsung256Black.id,
      source_name: 'TestPriceSource',
      source_url: 'https://example.invalid/p4',
      seller_name: 'SellerC',
      amount_krw: 800000,
      shipping_krw: 0,
      observed_at: freshObservedAt,
      expires_at: freshExpiresAt,
      conditions_text: '특정 카드 24개월 약정 할인가',
      unconditional: false,
      in_stock: true,
      is_new: true,
      is_unlocked: true
    }));

    // Price observation for vSamsung512Gray: 1,150,000 KRW
    createdPrices.push(await m.price_observations.create({
      variant_id: vSamsung512Gray.id,
      source_name: 'TestPriceSource',
      source_url: 'https://example.invalid/p5',
      seller_name: 'SellerB',
      amount_krw: 1150000,
      shipping_krw: 0,
      observed_at: freshObservedAt,
      expires_at: freshExpiresAt,
      conditions_text: '무조건 자급제 신품 무료배송',
      unconditional: true,
      in_stock: true,
      is_new: true,
      is_unlocked: true
    }));

    // Price observation for vApple256White: 1,000,000 KRW
    createdPrices.push(await m.price_observations.create({
      variant_id: vApple256White.id,
      source_name: 'TestPriceSource',
      source_url: 'https://example.invalid/p6',
      seller_name: 'SellerD',
      amount_krw: 1000000,
      shipping_krw: 0,
      observed_at: freshObservedAt,
      expires_at: freshExpiresAt,
      conditions_text: '무조건 자급제 신품 무료배송',
      unconditional: true,
      in_stock: true,
      is_new: true,
      is_unlocked: true
    }));

    // Expired price observation for vApple128BlackExpired
    createdPrices.push(await m.price_observations.create({
      variant_id: vApple128BlackExpired.id,
      source_name: 'TestPriceSource',
      source_url: 'https://example.invalid/p7',
      seller_name: 'SellerD',
      amount_krw: 890000,
      shipping_krw: 0,
      observed_at: expiredObservedAt,
      expires_at: expiredExpiresAt,
      conditions_text: '24시간 경과 만료 가격',
      unconditional: true,
      in_stock: true,
      is_new: true,
      is_unlocked: true
    }));

    // Start HTTP server
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

    // Unauthenticated access rejected with 401
    check(await req(anon, 'GET', '/smartphones'), 401);
    check(await req(anon, 'GET', '/smartphones/' + vSamsung256Black.id), 401);
    anon.csrf = check(await req(anon, 'GET', '/auth/csrf'), 200).csrf_token;
    check(await req(anon, 'POST', '/recommendation-candidates', { expected_profile_version: 1, hard: { budget_max_krw: 1000000, usages: ['video'] } }), 401);

    // Register & login users A and B
    for (const [i, c] of [a, b].entries()) {
      c.csrf = check(await req(c, 'GET', '/auth/csrf'), 200).csrf_token;
      const u = check(await req(c, 'POST', '/auth/register', { email: emails[i], password: 'test-only-password-12345' }), 201);
      users.push(u.id);
      const login = check(await req(c, 'POST', '/auth/login', { email: emails[i], password: 'test-only-password-12345' }), 200);
      c.csrf = login.csrf_token;
    }

    // 1. GET /api/smartphones default excludes is_test=true (production guard)
    const defaultList = check(await req(a, 'GET', '/smartphones'), 200);
    assert.equal(defaultList.some(x => x.variant_id === String(vSamsung256Black.id)), false);

    // 2. GET /api/smartphones?include_test=true returns verified Samsung/Apple within 3 years, excludes old (>3y) and 'other' brand
    const testList = check(await req(a, 'GET', '/smartphones?include_test=true'), 200);
    const returnedIds = testList.map(x => x.variant_id);
    assert.equal(returnedIds.includes(String(vSamsung256Black.id)), true);
    assert.equal(returnedIds.includes(String(vSamsung512Gray.id)), true);
    assert.equal(returnedIds.includes(String(vApple256White.id)), true);
    assert.equal(returnedIds.includes(String(vOldSamsung128.id)), false, 'Old (>3y) model must be excluded when only_recommendable=true');
    assert.equal(returnedIds.includes(String(vOther256.id)), false, 'Non-Samsung/Apple brand must be excluded');

    // Filter by brand & storage_gb
    const filteredList = check(await req(a, 'GET', '/smartphones?include_test=true&brand=samsung&storage_gb=512'), 200);
    assert.equal(filteredList.length, 1);
    assert.equal(filteredList[0].variant_id, String(vSamsung512Gray.id));
    assert.equal(filteredList[0].storage_gb, 512);
    assert.equal(filteredList[0].color, 'gray');

    // Pagination on /api/smartphones
    const page1 = await req(a, 'GET', '/smartphones?include_test=true&limit=2');
    check(page1, 200);
    assert.equal(page1.body.data.length, 2);
    assert.ok(page1.body.next_cursor);
    const page2 = await req(a, 'GET', '/smartphones?include_test=true&limit=2&cursor=' + page1.body.next_cursor);
    check(page2, 200);
    assert.ok(page2.body.data.length >= 1);

    // Invalid query params on /api/smartphones -> 422
    check(await req(a, 'GET', '/smartphones?brand=xiaomi'), 422);
    check(await req(a, 'GET', '/smartphones?storage_gb=0'), 422);
    check(await req(a, 'GET', '/smartphones?unknown=1'), 422);

    // 3. GET /api/smartphones/:variantId detail and price verification
    const detail256 = check(await req(a, 'GET', '/smartphones/' + vSamsung256Black.id), 200);
    assert.equal(detail256.domestic_model_number, 'SM-S921N-' + prefix);
    assert.equal(detail256.storage_gb, 256);
    assert.equal(detail256.color, 'black');
    assert.equal(detail256.verified, true);
    assert.ok(detail256.price);
    // Must pick SellerB (950,000), NOT SellerA's older 850,000 (since SellerA latest is out of stock) and NOT SellerC's conditional 800,000
    assert.equal(detail256.price.observation_id, String(validSamsung256Price.id));
    assert.equal(detail256.price.seller_name, 'SellerB');
    assert.equal(detail256.price.total_krw, 950000);
    assert.equal(detail256.price.is_expired, false);
    assert.equal(detail256.latest_prices_by_seller.length, 3);

    // Expired price variant detail shows price=null and latest_prices_by_seller[0].is_expired=true
    const detailExpired = check(await req(a, 'GET', '/smartphones/' + vApple128BlackExpired.id), 200);
    assert.equal(detailExpired.price, null);
    assert.equal(detailExpired.latest_prices_by_seller.length, 1);
    assert.equal(detailExpired.latest_prices_by_seller[0].is_expired, true);

    // Non-existent or invalid variantId
    check(await req(a, 'GET', '/smartphones/18446744073709551615'), 404);
    check(await req(a, 'GET', '/smartphones/invalid-id'), 422);

    // 4. POST /api/recommendation-candidates before profile confirmation -> 409 PROFILE_INCOMPLETE
    const unconfirmedRes = await req(a, 'POST', '/recommendation-candidates', {
      expected_profile_version: 1,
      hard: { budget_max_krw: 1000000, usages: ['coding'] },
      include_test: true
    });
    check(unconfirmedRes, 409);
    assert.equal(unconfirmedRes.body.error.code, 'PROFILE_INCOMPLETE');

    // Confirm User A's profile (version becomes 2)
    const profA = check(await req(a, 'PUT', '/profile', {
      expected_version: 1,
      common: { usages: ['video', 'coding'], spending_style: 'balanced', mobility: 'high', ecosystem: 'android', lifestyle_note: null },
      smartphone: { preferred_brands: ['samsung'], priorities: ['portability', 'display'], preferred_os: 'android' }
    }), 200);
    assert.equal(profA.version, 2);

    // Register owned device (old Galaxy S20, weight 195g, refresh 60Hz) for User A (version becomes 3)
    const ownedA = check(await req(a, 'POST', '/owned-devices', { variant_id: String(vOldSamsung128.id) }), 201);
    assert.equal(ownedA.profile_version, 3);

    // Register owned device for User B to test ownership isolation
    const ownedB = check(await req(b, 'POST', '/owned-devices', { category: 'smartphone', manual_brand: 'test', manual_model_name: 'other-user-phone' }), 201);

    // CSRF protection on POST /api/recommendation-candidates
    check(await req(a, 'POST', '/recommendation-candidates', {
      expected_profile_version: 3,
      hard: { budget_max_krw: 1000000, usages: ['coding'] }
    }, { noCsrf: true }), 403);

    // Version mismatch -> 409 PROFILE_CHANGED
    const verConflict = await req(a, 'POST', '/recommendation-candidates', {
      expected_profile_version: 2,
      hard: { budget_max_krw: 1000000, usages: ['coding'] },
      include_test: true
    });
    check(verConflict, 409);
    assert.equal(verConflict.body.error.code, 'PROFILE_CHANGED');

    // Another user's replacement_device_id -> 404 NOT_FOUND
    check(await req(a, 'POST', '/recommendation-candidates', {
      expected_profile_version: 3,
      hard: { budget_max_krw: 1000000, usages: ['coding'] },
      replacement_device_id: ownedB.device.id,
      include_test: true
    }), 404);

    // Semantic missing budget -> 200 status='clarify'
    const clarifyBudget = check(await req(a, 'POST', '/recommendation-candidates', {
      expected_profile_version: 3,
      hard: { usages: ['coding'] },
      include_test: true
    }), 200);
    assert.equal(clarifyBudget.status, 'clarify');
    assert.ok(clarifyBudget.questions.length >= 1);

    // Contradictory hard conditions (Samsung + iOS) -> 200 status='clarify'
    const clarifyContradiction = check(await req(a, 'POST', '/recommendation-candidates', {
      expected_profile_version: 3,
      hard: { budget_max_krw: 1000000, usages: ['coding'], allowed_brands: ['samsung'], required_os: 'ios' },
      include_test: true
    }), 200);
    assert.equal(clarifyContradiction.status, 'clarify');

    // 5. Normal candidate search: budget 1,000,000, min_storage_gb 256, max_weight_g 180 (weight >= 167g)
    // Should include vSamsung256Black (950,000) and vApple256White (1,000,000)
    // Should exclude vSamsung512Gray (1,150,000 > budget), vApple128BlackExpired (128GB & expired), vOldSamsung128 (>3 years)
    const searchRes = check(await req(a, 'POST', '/recommendation-candidates', {
      expected_profile_version: 3,
      hard: {
        budget_max_krw: 1000000,
        usages: ['video', 'coding'],
        min_storage_gb: 256,
        allowed_brands: ['samsung', 'apple']
      },
      replacement_device_id: ownedA.device.id,
      purchase_reason: '구형 기기 무게와 주사율 개선 희망',
      include_test: true
    }), 200);

    assert.equal(searchRes.status, 'candidates_ready');
    const candIds = searchRes.candidates.map(c => c.variant_id);
    assert.ok(candIds.includes(String(vSamsung256Black.id)));
    assert.ok(candIds.includes(String(vApple256White.id)));
    assert.equal(candIds.includes(String(vSamsung512Gray.id)), false);
    assert.equal(candIds.includes(String(vApple128BlackExpired.id)), false);
    assert.equal(candIds.includes(String(vOldSamsung128.id)), false);

    // Verify structured AI context & eligible_reasons for Samsung 256GB compared against owned Galaxy S20 (195g -> 167g, 60Hz -> 120Hz)
    const samCand = searchRes.candidates.find(c => c.variant_id === String(vSamsung256Black.id));
    const reasonCodes = samCand.eligible_reasons.map(r => r.code);
    assert.ok(reasonCodes.includes('storage_meets_requirement'));
    assert.ok(reasonCodes.includes('budget_headroom'));
    assert.ok(reasonCodes.includes('preferred_brand_match'));
    assert.ok(reasonCodes.includes('preferred_os_match'));
    assert.ok(reasonCodes.includes('lighter_than_owned'));
    assert.ok(reasonCodes.includes('higher_refresh_than_owned'));
    assert.ok(searchRes.ai_context);
    assert.equal(searchRes.ai_context.profile_snapshot.version, 3);
    assert.equal(searchRes.ai_context.replacement_device.id, ownedA.device.id);

    // 6. Zero candidates -> status='no_match' with relaxation questions, no automatic relaxation
    const noMatchRes = check(await req(a, 'POST', '/recommendation-candidates', {
      expected_profile_version: 3,
      hard: {
        budget_max_krw: 500000,
        usages: ['coding'],
        min_storage_gb: 512
      },
      include_test: true
    }), 200);
    assert.equal(noMatchRes.status, 'no_match');
    assert.equal(noMatchRes.candidate_count, 0);
    assert.equal(noMatchRes.candidates.length, 0);
    assert.ok(noMatchRes.questions.length >= 2);
    assert.equal(noMatchRes.ai_context, null);

    // 7. More than 40 candidates -> status='clarify' without arbitrary top-40 truncation
    const bulkVariants = [];
    const bulkPrices = [];
    try {
      for (let i = 1; i <= 40; i++) {
        const bv = await m.smartphone_variants.create({
          smartphone_id: samsungPhone.id,
          storage_gb: 256,
          ram_gb: 8,
          color: 'bulk-color-' + i,
          source_name: 'Samsung KR Spec',
          source_url: 'https://example.invalid/bulk-' + i,
          verified_at: verifiedAt,
          verified: true
        });
        bulkVariants.push(bv);
        bulkPrices.push(await m.price_observations.create({
          variant_id: bv.id,
          source_name: 'TestPriceSource',
          source_url: 'https://example.invalid/bulk-p-' + i,
          seller_name: 'SellerBulk',
          amount_krw: 900000,
          shipping_krw: 0,
          observed_at: freshObservedAt,
          expires_at: freshExpiresAt,
          conditions_text: '무조건 자급제 신품',
          unconditional: true,
          in_stock: true,
          is_new: true,
          is_unlocked: true
        }));
      }
      // Total matching candidates is now 2 + 40 = 42 (> 40)
      const over40Res = check(await req(a, 'POST', '/recommendation-candidates', {
        expected_profile_version: 3,
        hard: {
          budget_max_krw: 1000000,
          usages: ['coding'],
          min_storage_gb: 256
        },
        include_test: true
      }), 200);
      assert.equal(over40Res.status, 'clarify');
      assert.ok(over40Res.candidate_count >= 42);
      assert.equal(over40Res.candidates.length, 0);
      assert.ok(over40Res.questions.length >= 1);
      assert.equal(over40Res.ai_context, null);
    } finally {
      for (const bp of bulkPrices) await bp.destroy();
      for (const bv of bulkVariants) await bv.destroy();
    }

    console.log('smartphone HTTP status assertions:', checks);
  } finally {
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
