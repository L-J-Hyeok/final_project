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

test('owned smartphone upgrade offer eligibility, 3-year boundaries, snooze/dismissal, keep-current recommendation, and isolation HTTP integration', async () => {
  require('../config/loadEnv')();
  assert.equal(process.env.DB_NAME, 'final_project');
  assert.notEqual(process.env.NODE_ENV, 'production');

  const prevProvider = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = 'mock';

  const d = await connection.connect();
  const m = d.models;
  const authCfg = require('../auth/config')(process.env);
  const origin = authCfg.origin;
  const prefix = 'upg-test-' + crypto.randomUUID().slice(0, 8);
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

  // Compute exact dates relative to today in Asia/Seoul
  const todayKst = catalog.kstDateString(new Date());
  const { minDate: exact3YearsAgoKst } = catalog.releaseWindowKst(todayKst);
  // 1 day after 3-year-ago date (i.e., 1 day short of 3rd anniversary)
  function addDays(dateStr, days) {
    const [y, mo, da] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, mo - 1, da + days));
    return dt.toISOString().slice(0, 10);
  }
  const oneDayShortOf3YearsKst = addDays(exact3YearsAgoKst, 1);
  const oneYearAgoKst = addDays(todayKst, -365);

  try {
    for (const email of emails) {
      assert.equal(await m.users.count({ where: { email } }), 0);
    }

    const now = new Date();
    const verifiedAt = new Date(now.getTime() - 3600 * 1000);
    const freshObservedAt = new Date(now.getTime() - 1 * 3600 * 1000);
    const freshExpiresAt = new Date(freshObservedAt.getTime() + 24 * 3600 * 1000);

    // 1. Phone released EXACTLY 3 years ago today -> eligible for upgrade offer AND within 3-year candidate window
    const phoneExact3Y = await m.smartphones.create({
      brand: 'samsung',
      model_name: prefix + ' Galaxy S23 Exact3Y',
      domestic_model_number: 'SM-S911N-' + prefix,
      released_on_kr: exact3YearsAgoKst,
      os: 'android',
      chipset: 'Snapdragon 8 Gen 2',
      screen_inches: 6.10,
      refresh_hz: 120,
      battery_mah: 4480,
      weight_g: 215.00,
      supports_5g: true,
      wireless_charging: true,
      source_name: 'Samsung KR Official',
      source_url: 'https://example.invalid/s23',
      verified_at: verifiedAt,
      verified: true,
      review_status: 'legacy',
      is_test: true
    });
    createdPhones.push(phoneExact3Y);

    // 2. Phone released 1 day short of 3 years ago -> NOT eligible for upgrade offer yet
    const phoneOneDayShort = await m.smartphones.create({
      brand: 'samsung',
      model_name: prefix + ' Galaxy S23 Plus Short1D',
      domestic_model_number: 'SM-S916N-' + prefix,
      released_on_kr: oneDayShortOf3YearsKst,
      os: 'android',
      chipset: 'Snapdragon 8 Gen 2',
      screen_inches: 6.60,
      refresh_hz: 120,
      battery_mah: 4700,
      weight_g: 216.00,
      supports_5g: true,
      wireless_charging: true,
      source_name: 'Samsung KR Official',
      source_url: 'https://example.invalid/s23p',
      verified_at: verifiedAt,
      verified: true,
      review_status: 'legacy',
      is_test: true
    });
    createdPhones.push(phoneOneDayShort);

    // 3. Phone released 1 year ago (new candidate phone)
    const phoneRecentCandidate = await m.smartphones.create({
      brand: 'samsung',
      model_name: prefix + ' Galaxy S25 New',
      domestic_model_number: 'SM-S931N-' + prefix,
      released_on_kr: oneYearAgoKst,
      os: 'android',
      chipset: 'Snapdragon 8 Elite',
      screen_inches: 6.20,
      refresh_hz: 120,
      battery_mah: 5200,
      weight_g: 214.00,
      supports_5g: true,
      wireless_charging: true,
      source_name: 'Samsung KR Official',
      source_url: 'https://example.invalid/s25',
      verified_at: verifiedAt,
      verified: true,
      review_status: 'legacy',
      is_test: true
    });
    createdPhones.push(phoneRecentCandidate);

    // 4. Phone with missing release date (unverified)
    const phoneMissingDate = await m.smartphones.create({
      brand: 'apple',
      model_name: prefix + ' iPhone Unknown Date',
      domestic_model_number: 'A0000-' + prefix,
      released_on_kr: null,
      os: 'ios',
      verified: false,
      is_test: true
    });
    createdPhones.push(phoneMissingDate);

    // 5. Two phones with identical model_name but different domestic_model_number (to test ambiguous variant detection)
    const phoneDupA = await m.smartphones.create({
      brand: 'samsung',
      model_name: prefix + ' Galaxy Ambiguous',
      domestic_model_number: 'SM-AMB1-' + prefix,
      released_on_kr: '2020-05-01',
      os: 'android',
      source_name: 'Samsung KR Official',
      source_url: 'https://example.invalid/amb1',
      verified_at: verifiedAt,
      verified: true,
      review_status: 'legacy',
      is_test: true
    });
    createdPhones.push(phoneDupA);

    const phoneDupB = await m.smartphones.create({
      brand: 'samsung',
      model_name: prefix + ' Galaxy Ambiguous',
      domestic_model_number: 'SM-AMB2-' + prefix,
      released_on_kr: '2020-05-01',
      os: 'android',
      source_name: 'Samsung KR Official',
      source_url: 'https://example.invalid/amb2',
      verified_at: verifiedAt,
      verified: true,
      review_status: 'legacy',
      is_test: true
    });
    createdPhones.push(phoneDupB);

    const vExact3Y = await m.smartphone_variants.create({
      smartphone_id: phoneExact3Y.id,
      storage_gb: 2048,
      ram_gb: 8,
      color: 'black',
      source_name: 'Samsung KR Official',
      source_url: 'https://example.invalid/v-s23',
      verified_at: verifiedAt,
      verified: true,
      review_status: 'legacy'
    });
    createdVariants.push(vExact3Y);

    const vOneDayShort = await m.smartphone_variants.create({
      smartphone_id: phoneOneDayShort.id,
      storage_gb: 2048,
      ram_gb: 8,
      color: 'black',
      source_name: 'Samsung KR Official',
      source_url: 'https://example.invalid/v-s23p',
      verified_at: verifiedAt,
      verified: true,
      review_status: 'legacy'
    });
    createdVariants.push(vOneDayShort);

    const vRecentCandidate = await m.smartphone_variants.create({
      smartphone_id: phoneRecentCandidate.id,
      storage_gb: 2048,
      ram_gb: 12,
      color: 'silver',
      source_name: 'Samsung KR Official',
      source_url: 'https://example.invalid/v-s25',
      verified_at: verifiedAt,
      verified: true,
      review_status: 'legacy'
    });
    createdVariants.push(vRecentCandidate);

    const vMissingDate = await m.smartphone_variants.create({
      smartphone_id: phoneMissingDate.id,
      storage_gb: 128,
      color: 'black',
      verified: false
    });
    createdVariants.push(vMissingDate);

    // Valid price for vRecentCandidate (1,820,000 KRW)
    createdPrices.push(await m.price_observations.create({
      variant_id: vRecentCandidate.id,
      source_name: 'TestPriceSource',
      source_url: 'https://example.invalid/p-s25',
      seller_name: 'SellerKR',
      amount_krw: 1820000,
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

    // Unauthenticated check
    check(await req(anon, 'GET', '/upgrade-offer'), 401);

    // Register & login User A and User B
    for (const [i, c] of [a, b].entries()) {
      c.csrf = check(await req(c, 'GET', '/auth/csrf'), 200).csrf_token;
      const u = check(await req(c, 'POST', '/auth/register', { email: emails[i], password: 'test-only-password-12345' }), 201);
      users.push(u.id);
      const login = check(await req(c, 'POST', '/auth/login', { email: emails[i], password: 'test-only-password-12345' }), 200);
      c.csrf = login.csrf_token;
    }

    // Track AI calls to prove status checks invoke Gemini 0 times
    let aiCallCounter = 0;
    const defaultAdapter = aiModule.createAiAdapter();
    recRouter.setAiAdapter({
      promptVersion: aiModule.PROMPT_VERSION,
      async analyze(args, env) {
        aiCallCounter++;
        return defaultAdapter.analyze(args, env);
      },
      async recommend(args, env) {
        aiCallCounter++;
        return defaultAdapter.recommend(args, env);
      }
    });

    // Empty state before registering any smartphone
    const emptyOffer = check(await req(a, 'GET', '/upgrade-offer'), 200);
    assert.equal(emptyOffer.has_owned_smartphone, false);
    assert.equal(emptyOffer.upgrade_offer_eligible, false);
    assert.equal(emptyOffer.should_show_popup, false);
    assert.equal(emptyOffer.can_start_general_recommendation, true);

    // Test 1 & 4: Register smartphone 1 day short of 3 years -> immediate evaluation returns NOT eligible
    const regShort = check(await req(a, 'POST', '/owned-devices', { variant_id: String(vOneDayShort.id) }), 201);
    assert.ok(regShort.upgrade_offer);
    assert.equal(regShort.upgrade_offer.upgrade_offer_eligible, false);
    assert.equal(regShort.upgrade_offer.should_show_popup, false);
    const devShortId = regShort.device.id;

    // Test 3 & 7: Register second smartphone released EXACTLY 3 years ago -> becomes current_device, eligible & popup=true
    // Previous smartphone moves to past_or_other_smartphones
    const regExact = check(await req(a, 'POST', '/owned-devices', { variant_id: String(vExact3Y.id) }), 201);
    assert.equal(regExact.upgrade_offer.upgrade_offer_eligible, true);
    assert.equal(regExact.upgrade_offer.should_show_popup, true);
    assert.equal(regExact.upgrade_offer.current_device.owned_device_id, regExact.device.id);
    assert.equal(regExact.upgrade_offer.past_or_other_smartphones.length, 1);
    assert.equal(regExact.upgrade_offer.past_or_other_smartphones[0].owned_device_id, devShortId);
    const devExactId = regExact.device.id;

    // Repeated GET /api/upgrade-offer does NOT auto-dismiss or alter popup state, and calls AI 0 times
    const getOffer1 = check(await req(a, 'GET', '/upgrade-offer'), 200);
    const getOffer2 = check(await req(a, 'GET', '/upgrade-offer'), 200);
    assert.equal(getOffer1.should_show_popup, true);
    assert.equal(getOffer2.should_show_popup, true);
    assert.equal(aiCallCounter, 0, 'Upgrade offer status check must call Gemini 0 times');

    // Test 11: 'snooze' ('나중에 보기') suppresses popup for 30 days
    check(await req(a, 'PUT', '/upgrade-offer/state', { action: 'snooze', owned_device_id: devExactId }, { noCsrf: true }), 403);
    const snoozedRes = check(await req(a, 'PUT', '/upgrade-offer/state', { action: 'snooze', owned_device_id: devExactId }), 200);
    assert.equal(snoozedRes.upgrade_offer_eligible, true);
    assert.equal(snoozedRes.should_show_popup, false);
    assert.equal(snoozedRes.current_device.notification_state, 'snoozed');
    assert.equal(snoozedRes.can_start_upgrade_recommendation, true);

    // Test 12: After 30 days pass (simulate expired snoozed_until in DB), popup re-appears
    const pRow = await m.profiles.findByPk(users[0]);
    const expiredSnoozeJson = structuredClone(pRow.smartphone_json);
    expiredSnoozeJson._upgrade_state.devices[devExactId].snoozed_until = new Date(Date.now() - 1000).toISOString();
    await pRow.update({ smartphone_json: expiredSnoozeJson });

    const after30Days = check(await req(a, 'GET', '/upgrade-offer'), 200);
    assert.equal(after30Days.should_show_popup, true);
    assert.equal(after30Days.current_device.notification_state, 'show_popup');

    // Test 13: 'dismiss_permanent' ('이 기기에서는 다시 표시하지 않기') hides popup permanently for this device
    const permRes = check(await req(a, 'PUT', '/upgrade-offer/state', { action: 'dismiss_permanent', owned_device_id: devExactId }), 200);
    assert.equal(permRes.should_show_popup, false);
    assert.equal(permRes.current_device.dismissed_permanently, true);

    // Test 14: User B cannot view or mutate User A's device upgrade state (returns 404)
    check(await req(b, 'PUT', '/upgrade-offer/state', { action: 'snooze', owned_device_id: devExactId }), 404);

    // Test 5: Re-evaluation of existing member's device when time passes (update phoneOneDayShort release date to exact3YearsAgoKst)
    // First switch current device to devShortId
    const switchCur = check(await req(a, 'PUT', '/upgrade-offer/state', { action: 'set_current', owned_device_id: devShortId }), 200);
    assert.equal(switchCur.current_device.owned_device_id, devShortId);
    assert.equal(switchCur.upgrade_offer_eligible, false);

    // Simulate time passing so phoneOneDayShort reaches 3rd anniversary
    await phoneOneDayShort.update({ released_on_kr: exact3YearsAgoKst });
    const reEvalVisit = check(await req(a, 'GET', '/upgrade-offer'), 200);
    assert.equal(reEvalVisit.current_device.owned_device_id, devShortId);
    assert.equal(reEvalVisit.upgrade_offer_eligible, true);
    assert.equal(reEvalVisit.should_show_popup, true);

    // Test 6, 8, 9, 10: Modify device to missing release date, ambiguous model name, and unidentified manual model
    // Missing release date catalog model -> needs_verification=true, eligible=false
    check(await req(a, 'PUT', '/owned-devices/' + devShortId, { variant_id: String(vMissingDate.id) }), 404);
    // Legacy ownership fixture: only this test user's row, not a public registration bypass.
    await m.owned_devices.update({ variant_id: vMissingDate.id }, { where: { id: devShortId, user_id: users[0] } });
    const modMissing = check(await req(a, 'GET', '/upgrade-offer'), 200);
    assert.equal(modMissing.needs_verification, true);
    assert.equal(modMissing.upgrade_offer_eligible, false);

    // Ambiguous manual model name (matches both SM-AMB1 and SM-AMB2) -> ambiguous_model_variant, needs_verification=true
    const modAmbiguous = check(await req(a, 'PUT', '/owned-devices/' + devShortId, {
      category: 'smartphone',
      manual_brand: 'samsung',
      manual_model_name: prefix + ' Galaxy Ambiguous'
    }), 200);
    assert.equal(modAmbiguous.upgrade_offer.current_device.identification_status, 'ambiguous_model_variant');
    assert.equal(modAmbiguous.upgrade_offer.needs_verification, true);
    assert.equal(modAmbiguous.upgrade_offer.upgrade_offer_eligible, false);

    // Disambiguated by manual_model_number -> identified_by_model_number, eligible=true!
    const modDisambiguated = check(await req(a, 'PUT', '/owned-devices/' + devShortId, {
      category: 'smartphone',
      manual_brand: 'samsung',
      manual_model_name: prefix + ' Galaxy Ambiguous',
      manual_model_number: 'SM-AMB1-' + prefix
    }), 200);
    assert.equal(modDisambiguated.upgrade_offer.current_device.identification_status, 'identified_by_model_number');
    assert.equal(modDisambiguated.upgrade_offer.upgrade_offer_eligible, true);
    assert.equal(modDisambiguated.upgrade_offer.should_show_popup, true); // Modifying device resets previous suppression!

    // Delete devShortId -> current_device automatically falls back to devExactId
    check(await req(a, 'DELETE', '/owned-devices/' + devShortId, {}), 204);
    const afterDelete = check(await req(a, 'GET', '/upgrade-offer'), 200);
    assert.equal(afterDelete.current_device.owned_device_id, devExactId);
    assert.equal(aiCallCounter, 0, 'Still 0 AI calls before user explicitly requests recommendation');

    // Confirm User A's profile to run upgrade & keep recommendations
    const curProf = check(await req(a, 'GET', '/profile'), 200);
    const savedProf = check(await req(a, 'PUT', '/profile', {
      expected_version: curProf.version,
      common: { usages: ['video', 'communication'], spending_style: 'balanced', mobility: 'medium', ecosystem: 'android', lifestyle_note: null },
      smartphone: { preferred_brands: ['samsung'], priorities: ['battery', 'portability'], preferred_os: 'android' }
    }), 200);

    // Test 18: Keep current device recommendation (status='keep') when current device meets requirements and replacement_intent is low
    const keepRec = check(await req(a, 'POST', '/recommendations', {
      expected_profile_version: savedProf.version,
      hard: {
        budget_max_krw: 1900000,
        usages: ['video'],
        min_storage_gb: 2048,
        max_weight_g: 220,
        min_refresh_hz: 120,
        require_5g: true,
        require_wireless_charging: true
      },
      replacement_device_id: devExactId,
      upgrade_context: {
        satisfied_aspects: ['performance', 'display'],
        pain_points: [],
        replacement_intent: 'low_or_keep_if_okay'
      },
      include_test: true
    }), 201);
    assert.equal(keepRec.status, 'keep');
    assert.equal(keepRec.items.length, 0);
    assert.ok(keepRec.keep_reasons.length >= 2);
    assert.equal(aiCallCounter, 1);

    // Test 19: Personalized upgrade recommendation with comparison against owned device (when user has pain points & high replacement intent)
    const upgRec = check(await req(a, 'POST', '/recommendations', {
      expected_profile_version: savedProf.version,
      hard: {
        budget_max_krw: 1900000,
        usages: ['video'],
        min_storage_gb: 2048,
        max_weight_g: 220
      },
      replacement_device_id: devExactId,
      upgrade_context: {
        satisfied_aspects: ['os_ecosystem'],
        pain_points: ['battery'],
        replacement_intent: 'high'
      },
      include_test: true
    }), 201);
    assert.equal(upgRec.status, 'recommend');
    assert.ok(upgRec.items.length >= 1);
    assert.equal(upgRec.items[0].variant_id, String(vRecentCandidate.id));
    assert.ok(upgRec.items[0].comparison_with_owned);
    assert.equal(upgRec.items[0].comparison_with_owned.comparable, true);
    assert.ok(upgRec.items[0].comparison_with_owned.improvements.some(s => s.includes('배터리')));

    console.log('upgrade HTTP status assertions:', checks);
  } finally {
    recRouter.setAiAdapter(null);
    if (prevProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = prevProvider;

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
