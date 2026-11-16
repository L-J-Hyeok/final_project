'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { randomBytes } = require('node:crypto');
const connection = require('../db/connection');
const router = require('../routes/recommendations');
const model = require('../services/recommendation-conversation');
const ai = require('../services/ai-adapter');

test('conversation state expires, locks concurrent writes and is isolated by session and user', async () => {
  const a = { sessionID: 'conversation-test-a', session: { user_id: '1' } };
  const b = { ...a, session: { user_id: '2' } };
  model.put(a, { id: 'draft' }, 100);
  assert.equal(model.get(a, 101).id, 'draft');
  assert.equal(model.get(b, 101), null);
  assert.equal(model.get(a, 100 + model.TTL), null);
  await model.exclusive(a, () => assert.rejects(model.exclusive(a, () => {}), { code: 'CONVERSATION_CHANGED' }));
});

test('HTTP conversation preserves conditions across edits and uses the existing recommendation pipeline', async () => {
  const originals = { getDatabase: connection.getDatabase, provider: process.env.AI_PROVIDER };
  process.env.AI_PROVIDER = 'mock';
  let seq = 0, analyzeCalls = 0, ownedLookups = 0;
  const history = new Map(), sessions = new Map();
  const user = { id: '1', email: 'conversation@example.test' };
  const password = 'isolated-test-password';
  user.password_hash = await require('../auth/password').hash(password);
  const profile = { version: 1, confirmed_at: new Date(), common_json: { usages: ['video'], spending_style: 'balanced' }, smartphone_json: {} };
  const today = require('../services/smartphone-catalog').kstDateString(new Date());
  const variants = [128, 256, 512].map((storage, index) => ({
    smartphone_id: '2', variant_id: String(10 + index), domestic_model_number: 'SM-TEST',
    model_name: 'Galaxy test fixture', brand: 'samsung', os: 'android', chipset: 'fixture',
    released_on_kr: today, verified: true, phone_verified: true, variant_verified: true, wireless_charging: false, storage_gb: storage, ram_gb: 8, color: '검정',
    screen_inches: 6.2, battery_mah: 4200, refresh_hz: 120, weight_g: 170, supports_5g: true
  }));
  const db = {
    models: {
      users: { findByPk: async () => user, findOne: async ({ where }) => ({ ...user, id: where.email.split('@')[0] === 'conversation' ? '1' : where.email.split('@')[0] }) },
      profiles: { findByPk: async () => profile },
      owned_devices: { findOne: async ({ where }) => {
        ownedLookups++;
        assert.equal(where.user_id, '1');
        if (where.id !== '88') return null;
        const row = { id: '88', category: 'smartphone', variant_id: '11' };
        return { ...row, toJSON: () => row };
      } },
      sessions: {
        findByPk: async key => sessions.get(key.toString('hex')),
        create: async row => sessions.set(row.sid_hash.toString('hex'), row),
        update: async (row, { where }) => {
          const key = where.sid_hash.toString('hex');
          if (sessions.has(key)) sessions.set(key, { ...sessions.get(key), ...row });
          return [1];
        },
        destroy: async ({ where }) => sessions.delete(where.sid_hash.toString('hex'))
      },
      recommendations: {
        create: async input => {
          const row = { id: String(++seq), ...input, async update(values) { Object.assign(this, values); return this; } };
          history.set(row.id, row);
          return row;
        },
        findByPk: async id => history.get(String(id)),
        findOne: async ({ where }) => history.get(String(where.id)),
        update: async (values, { where }) => {
          const row = history.get(String(where.id));
          if (row) Object.assign(row, values);
          return [row ? 1 : 0];
        }
      }
    },
    transaction: fn => fn({ LOCK: { UPDATE: 'UPDATE' } }),
    query: async (sql, options = {}) => {
      assert.match(sql.trim(), /^SELECT\b/i);
      const params = options.replacements || {};
      if (sql.includes('DISTINCT v.storage_gb')) return variants;
      if (sql.includes('WHERE v.id = :id') || sql.includes('WHERE id = :id')) return variants.filter(v => v.variant_id === params.id);
      if (sql.includes('price_observations')) {
        return variants.map((v, index) => ({
          variant_id: v.variant_id, id: String(20 + index), observation_id: String(20 + index),
          seller_name: 'fixture', source_name: 'test', source_url: 'https://example.test/product',
          amount_krw: 500000 + index * 100000, shipping_krw: 0,
          observed_at: new Date(Date.now() - 1000), expires_at: new Date(Date.now() + 3600000),
          unconditional: true, in_stock: true, is_new: true, is_unlocked: true
        }));
      }
      if (sql.includes('smartphone_variants')) {
        return variants.filter(v => (!params.variantIds || params.variantIds.includes(v.variant_id)) &&
          (!params.minStorageGb || v.storage_gb >= params.minStorageGb));
      }
      throw Error('Unexpected query');
    }
  };
  connection.getDatabase = () => db;
  const phones = require('../routes/smartphones');
  const oldPublication = phones.publicationWhere;
  const oldPrices = phones.fetchPricesByVariantIds;
  phones.publicationWhere = async () => 's.is_test = 0';
  // Supply only isolated price fixtures; candidate SQL and final freshness run normally.
  phones.fetchPricesByVariantIds = async () => new Map((await db.query('SELECT * FROM price_observations')).map(p => [p.variant_id, [p]]));
  const publication = require('../services/product-publication');
  const oldSql = publication.sql;
  publication.sql = async () => 's.is_test = 0';
  router.setAiAdapter(ai.createAiAdapter({
    mockAnalyzeFn: input => {
      analyzeCalls++;
      const result = ai.mockAnalyze(input);
      // Sanitized reproduction of the live classification error.
      if (input.text.includes('작고 가벼운')) result.output.draft.hard.unsupported_requirements = ['가볍고 작은 폰'];
      return result;
    },
    mockRecommendFn: input => {
      const result = ai.mockRecommend(input);
      if (result.output.status === 'recommend') result.output.status = 'success';
      for (const item of result.output.items) item.explanation = '검증되지 않은 배터리 90000mAh';
      return result;
    }
  }));
  const origin = 'http://127.0.0.1:3000';
  const config = require('../auth/config')({ SESSION_SECRET: randomBytes(32).toString('hex'), APP_ORIGIN: origin });
  const app = express();
  app.use(express.json());
  app.use('/api', require('../auth/middleware')(config), router);
  app.use('/api/auth', require('../routes/auth')(config));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ code: error.code || error.name }));
  const server = await new Promise(resolve => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  async function request(client, path, body, validCsrf = true) {
    const res = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: {
      Origin: origin, ...(client.cookie ? { Cookie: client.cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json', ...(validCsrf ? { 'X-CSRF-Token': client.csrf } : {}) } : {})
    }, body: body ? JSON.stringify(body) : undefined });
    if (res.headers.get('Set-Cookie')) client.cookie = res.headers.get('Set-Cookie').split(';')[0];
    const json = res.status === 204 ? {} : await res.json();
    if (json.data?.csrf_token) client.csrf = json.data.csrf_token;
    return { status: res.status, data: json.data, code: json.code };
  }
  const path = '/recommendations/conversation';
  async function client(account = user.email) {
    const ctx = {};
    await request(ctx, '/auth/csrf');
    assert.equal((await request(ctx, '/auth/login', { email: account, password })).status, 200);
    return ctx;
  }
  const start = (ctx, text, device) => request(ctx, path, { action: 'start', mode: device ? 'upgrade' : 'purchase', text, ...(device ? { replacement_device_id: device } : {}) });
  const answer = (ctx, draft, question_id, value, extra) => request(ctx, path, {
    action: 'answer', id: draft.id, revision: draft.revision, question_id, answer: value, ...extra
  });

  try {
    const a = await client(), b = await client();
    const requestText = '예산 100만 원, 사진 촬영용';
    assert.equal((await request(a, path, { action: 'start', mode: 'purchase', text: requestText }, false)).status, 403);
    const initial = await start(a, requestText);
    assert.equal(initial.status, 200);
    const draft = initial.data.conversation;
    assert.deepEqual(draft.questions.map(q => q.id), ['storage']);
    assert.equal(history.size, 0);
    assert.equal((await request(b, path)).data, null);
    assert.equal((await answer(b, draft, 'storage', '256')).code, 'CONVERSATION_EXPIRED');
    assert.equal((await answer(a, draft, 'storage', 'invalid')).status, 422);
    assert.equal((await answer(a, draft, 'storage', '256', { hard: { budget_max_krw: 9999999 } })).status, 422);
    const finished = await answer(a, draft, 'storage', '256');
    assert.equal(finished.status, 201, JSON.stringify(finished));
    assert.equal(finished.data.status, 'recommend');
    assert.equal(finished.data.explanation_source, 'ai');
    assert(!finished.data.items[0].explanation.includes('90000'));
    assert(finished.data.items[0].explanation.includes('256GB'));
    assert.equal(finished.data.items.length, 1);
    assert(finished.data.items[0].product.storage_gb >= 256);
    assert.equal(finished.data.conversation.confirmed.budget_max_krw, 1000000);
    assert.equal(finished.data.conversation.text, requestText);
    assert.equal((await answer(a, draft, 'storage', '512')).code, 'CONVERSATION_CHANGED');
    const edited = await answer(a, finished.data.conversation, 'storage', '512');
    assert.equal(edited.data.items[0].product.storage_gb, 512);
    assert.equal(analyzeCalls, 1);

    const c = await client('2@example.test'), d = await client('3@example.test');
    const auto = await start(c, requestText);
    const autoResult = await answer(c, auto.data.conversation, 'storage', 'auto');
    assert.equal(autoResult.data.status, 'recommend');
    assert.equal(autoResult.data.conversation.confirmed.min_storage_gb, undefined);
    assert.deepEqual(autoResult.data.conversation.questions, []);

    const direct = await start(d, '예산 100만 원, 영상 시청');
    assert.equal(direct.data?.status, 'recommend', JSON.stringify(direct));
    profile.smartphone_json.min_storage_gb = 256;
    const savedSize = await start(d, requestText);
    assert.equal(savedSize.data?.status, 'recommend', JSON.stringify(savedSize));
    assert.equal(savedSize.data.conversation.confirmed.min_storage_gb, 256);
    assert.equal((await start(b, '현재 기기에 만족합니다.', '999')).status, 404);

    const upgrade = await start(a, '현재 기기를 평가해 주세요.', '88');
    assert.deepEqual(upgrade.data.conversation.questions.map(q => q.id), ['intent', 'pain']);
    const intent = await answer(a, upgrade.data.conversation, 'intent', 'low_or_keep_if_okay');
    const keep = await answer(a, intent.data.conversation, 'pain', ['none']);
    assert.equal(keep.data?.status, 'keep', JSON.stringify(keep));
    assert(ownedLookups >= 3);
    const e = await client('4@example.test');
    const unlimited = await start(e, '가격은 상관없고 작고 가벼운 폰이 좋아.');
    assert.equal(unlimited.data?.status, 'recommend', JSON.stringify(unlimited));
    assert.equal(unlimited.data.conversation.confirmed.budget_unlimited, true);
    assert.equal(unlimited.data.conversation.confirmed.budget_max_krw, undefined);
    assert.equal(unlimited.data.conversation.confirmed.unsupported_requirements, undefined);
    const blocked = await start(e, '예산 100만 원, 영상 시청, 플래그십 필수');
    const requirement = blocked.data.conversation.questions.find(q => q.id === 'requirement_0');
    assert(requirement);
    const paused = await answer(e, blocked.data.conversation, requirement.id, 'keep');
    assert.equal(paused.data.status, 'clarify');
    assert.equal(paused.data.conversation.answered[0].answer, 'keep');
    assert.deepEqual(paused.data.items, []);
    const revised = await answer(e, paused.data.conversation, requirement.id, 'remove');
    assert.equal(revised.data?.status, 'recommend', JSON.stringify(revised));
    assert.equal(revised.data.conversation.confirmed.budget_max_krw, 1000000);
    assert.equal(revised.data.conversation.confirmed.min_storage_gb, 256);
    assert.equal((await request(a, '/auth/logout', {})).status, 204);
    assert.equal((await request(a, path)).status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
    connection.getDatabase = originals.getDatabase;
    if (originals.provider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = originals.provider;
    phones.publicationWhere = oldPublication;
    phones.fetchPricesByVariantIds = oldPrices;
    publication.sql = oldSql;
    router.setAiAdapter(null);
  }
});

test('storage pain follow-up is bounded by the owned option and survives edits to other answers', () => {
  const state = model.create({ text: '교체를 고민 중', replacement_device_id: '8' },
    { hard: { allowed_brands: ['samsung'] }, soft: {} },
    { version: 1, common: { usages: ['video'] }, smartphone: {} }, [], 256);
  const respond = (s, question_id, value) => model.answer(s,
    { action: 'answer', id: s.id, revision: s.revision, question_id, answer: value });
  const withIntent = respond(state, 'intent', 'high');
  const withPain = respond(withIntent, 'pain', ['storage']);
  assert.deepEqual(model.prepare(withPain).missing.map(q => q.id), ['reason', 'budget', 'used_storage']);
  assert.throws(() => respond(withPain, 'used_storage', 257), { code: 'INVALID_INPUT' });
  const withUsage = respond(withPain, 'used_storage', 245);
  const withReason = respond(withUsage, 'reason', '영상 파일을 보관할 공간이 부족해요.');
  const complete = respond(withReason, 'budget', 1000000);
  const edited = respond(complete, 'budget', 800000);
  assert.deepEqual(model.prepare(edited).missing, []);
  assert.deepEqual(model.prepare(edited).body.hard, {
    allowed_brands: ['samsung'], usages: ['video'], budget_max_krw: 800000, min_storage_gb: 245
  });
  assert.equal(model.prepare(edited).body.purchase_reason, withReason.answers.reason);
  assert.equal(model.prepare(respond(edited, 'pain', ['battery'])).body.hard.min_storage_gb, undefined);
});

test('clarifying a weight limit preserves a stricter existing limit and unrelated purchase conditions', () => {
  const state = model.create({ text: '가볍고 작은 폰 필수' }, {
    hard: { budget_unlimited: true, usages: ['video'], min_storage_gb: 256,
      max_weight_g: 170, unsupported_requirements: ['가볍고 작은 폰'] },
    soft: { priorities: ['portability'] }
  }, { version: 1 }, []);
  const question = model.view(state).questions[0];
  const updated = model.answer(state, {
    action: 'answer', id: state.id, revision: state.revision, question_id: question.id, answer: 180
  });
  assert.deepEqual(model.prepare(updated).body.hard, {
    budget_unlimited: true, usages: ['video'], min_storage_gb: 256, max_weight_g: 170
  });
  assert.deepEqual(model.view(updated).questions, []);
});
