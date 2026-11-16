'use strict';

const { randomUUID } = require('node:crypto');
const catalog = require('./smartphone-catalog');
const advisor = require('./upgrade-advisor');

const TTL = 20 * 60 * 1000;
const MAX_DRAFTS = 500;
const sessions = new Map();
const active = new Set();
const usages = { communication: '연락·소통', video: '영상 시청', coding: '코딩', gaming: '게임', camera: '사진·영상 촬영', work: '업무' };
const aspects = { battery: '배터리', camera: '카메라', performance: '성능', portability: '휴대성', display: '화면', storage: '저장 공간', price: '비용', os_ecosystem: 'OS·생태계' };
const intents = { low_or_keep_if_okay: '만족하며 가능하면 유지', moderate: '유지와 교체를 비교', high: '불편해서 교체를 고려' };
const choice = (id, label, values, type = 'choice') => ({
  id, label, type, options: Object.entries(values).map(([value, label]) => ({ value, label }))
});

function key(req) {
  return JSON.stringify([req.sessionID, String(req.session.user_id)]);
}

function get(req, now = Date.now()) {
  const k = key(req), state = sessions.get(k);
  if (state?.expiresAt > now) return state;
  sessions.delete(k);
  return null;
}

function put(req, state, now = Date.now()) {
  for (const [k, value] of sessions) if (value.expiresAt <= now) sessions.delete(k);
  if (!sessions.has(key(req)) && sessions.size >= MAX_DRAFTS) throw catalog.fail('RATE_LIMITED', 429);
  sessions.set(key(req), { ...state, expiresAt: now + TTL });
}

async function exclusive(req, run) {
  const k = key(req);
  if (active.has(k)) throw catalog.fail('CONVERSATION_CHANGED', 409);
  active.add(k);
  try { return await run(); } finally { active.delete(k); }
}

function create(input, draft, profile, capacities, ownedCapacity = null) {
  const hard = { ...draft.hard };
  if (!hard.usages?.length) hard.usages = profile.common?.usages;
  if (hard.min_storage_gb == null && Number.isInteger(profile.smartphone?.min_storage_gb)) {
    hard.min_storage_gb = profile.smartphone.min_storage_gb;
  }
  const upgrade = Boolean(input.replacement_device_id);
  const context = draft.upgrade || {};
  const reason = context.reason || null;
  const questions = [
    ...(hard.unsupported_requirements || []).map((requirement, index) => {
      const id = 'requirement_' + index;
      if (/무게|경량|가볍|가벼/.test(requirement)) {
        return {
          id, label: '“' + requirement + '”의 최대 무게를 g 단위로 입력하거나 이 조건을 제외해 주세요.',
          type: 'number', min: 1, max: 2000, removeRequirement: true
        };
      }
      return choice(id, '“' + requirement + '”을 카탈로그에서 확인할 수 없어요. 이 조건의 적용 여부를 선택해 주세요.',
        { remove: '이 조건 제외하고 계속', keep: '필수 조건 유지 · 추천 중단' });
    }),
    { id: 'budget', label: '최대 예산을 알려 주세요 (원).', type: 'number', min: 1, max: 10000000 },
    choice('usage', '주요 사용 목적은 무엇인가요?', usages, 'multiple'),
    choice('intent', '현재 기기에 얼마나 만족하시나요?', intents),
    choice('pain', '개선하고 싶은 불편이 있나요?', { ...aspects, none: '특별한 불편 없음' }, 'multiple'),
    { id: 'reason', label: '교체를 고민하는 주된 이유가 무엇인가요?', type: 'text' },
    { id: 'used_storage', label: '현재 저장 공간을 얼마나 사용하고 있나요? (GB)', type: 'number', min: 1, max: ownedCapacity || 4096, optional: true },
    choice('storage', '최소 어느 정도 저장 용량이 필요하신가요?', {
      ...Object.fromEntries(capacities.map(gb => [gb, gb + 'GB 이상'])), auto: '잘 모르겠어요 · AI가 추천해 주세요'
    })
  ];
  return {
    id: randomUUID(), revision: 0, text: input.text, version: profile.version,
    deviceId: input.replacement_device_id || null, hard, soft: draft.soft, upgrade,
    intent: context.replacement_intent ?? null, pains: context.pain_points ?? null, reason,
    capacities, ownedCapacity, questions, answers: {}, result: null, submissions: 0
  };
}

function prepare(state) {
  const a = state.answers;
  const hard = { ...state.hard };
  if (a.budget === 'unlimited') {
    delete hard.budget_max_krw;
    hard.budget_unlimited = true;
  } else if (a.budget != null) {
    hard.budget_max_krw = a.budget;
    delete hard.budget_unlimited;
  }
  const unresolved = (state.hard.unsupported_requirements || []).filter((_, index) => {
    const value = a['requirement_' + index];
    if (Number.isInteger(value)) hard.max_weight_g = Math.min(hard.max_weight_g ?? value, value);
    return value === undefined || value === 'keep';
  });
  if (unresolved.length) hard.unsupported_requirements = unresolved;
  else delete hard.unsupported_requirements;
  if (a.usage != null) hard.usages = a.usage;
  if (a.storage != null && a.storage !== 'auto') hard.min_storage_gb = Number(a.storage);
  const intent = a.intent ?? state.intent;
  const pains = a.pain ? a.pain.filter(p => p !== 'none') : state.pains;
  const happy = intent === 'low_or_keep_if_okay' && pains?.length === 0;
  const reason = a.reason ?? state.reason;
  const storageHeavy = hard.usages?.some(u => ['gaming', 'camera'].includes(u));
  const missing = [];
  const add = id => missing.push(state.questions.find(q => q.id === id));
  for (const q of state.questions) {
    if (q.id.startsWith('requirement_') && !Object.hasOwn(a, q.id)) missing.push(q);
  }
  if (state.upgrade) {
    if (!intent) add('intent');
    if (pains == null) add('pain');
    if (intent && pains && !happy && !reason) add('reason');
  }
  if ((!state.upgrade || (intent && pains != null && !happy)) && hard.budget_max_krw == null && !hard.budget_unlimited) add('budget');
  if (!hard.usages?.length) add('usage');
  if (state.upgrade && pains?.includes('storage') && state.ownedCapacity && hard.min_storage_gb == null && a.used_storage == null) add('used_storage');
  // Ask only when storage is likely to affect a purchase and the catalog has a meaningful choice.
  if (!state.upgrade && storageHeavy && (hard.budget_max_krw != null || hard.budget_unlimited) && !hard.unsupported_requirements?.length && hard.min_storage_gb == null && state.capacities.length > 1 && a.storage == null) add('storage');
  if (pains?.includes('storage') && Number.isInteger(a.used_storage)) {
    hard.min_storage_gb = Math.max(hard.min_storage_gb || 0, a.used_storage);
  }
  const body = { expected_profile_version: state.version, hard, soft: state.soft };
  if (state.upgrade) {
    body.replacement_device_id = state.deviceId;
    body.purchase_reason = (reason && (!unresolved.length && catalog.requiresFlagship(reason) && state.hard.unsupported_requirements?.some(catalog.requiresFlagship) ? '사용자가 교체 조건을 수정했습니다.' : reason)) || (happy ? '현재 기기 사용에 특별한 불편이 없습니다.' : null);
    body.upgrade_context = advisor.validateUpgradeContextInput({
      replacement_intent: intent, pain_points: pains, satisfied_aspects: [], no_pain_confirmed: pains?.length === 0
    });
  }
  return { body, missing, blocked: Object.entries(a).some(([id, value]) => id.startsWith('requirement_') && value === 'keep') };
}

function answer(state, input) {
  catalog.object(input, ['action', 'id', 'revision', 'question_id', 'answer']);
  if (input.id !== state.id || input.revision !== state.revision || state.submissions >= 20) {
    throw catalog.fail('CONVERSATION_CHANGED', 409);
  }
  const q = state.questions.find(item => item.id === input.question_id);
  if (!q || (!Object.hasOwn(state.answers, q.id) && !prepare(state).missing.some(item => item.id === q.id))) throw catalog.fail();
  let value = input.answer;
  if (q.type === 'choice' || q.type === 'multiple') {
    const values = q.options.map(o => o.value);
    if (q.type === 'choice') {
      if (!values.includes(value)) throw catalog.fail();
    } else {
      if (!Array.isArray(value) || !value.length || value.length > 6 ||
          new Set(value).size !== value.length || value.some(v => !values.includes(v)) ||
          (value.includes('none') && value.length !== 1)) throw catalog.fail();
      value = [...value];
    }
  } else if (q.type === 'number') {
    if (!(q.optional && value === 'unknown') && !(q.id === 'budget' && value === 'unlimited') && !(q.removeRequirement && value === 'remove') && (!Number.isInteger(value) || value < q.min || value > q.max)) throw catalog.fail();
  } else {
    value = require('./member-validation').str(value, 300);
  }
  return { ...state, revision: state.revision + 1, submissions: state.submissions + 1,
    answers: { ...state.answers, [q.id]: value }, result: null };
}

function view(state, missing = prepare(state).missing) {
  return {
    id: state.id, revision: state.revision, text: state.text, replacement_device_id: state.deviceId,
    confirmed: prepare(state).body.hard,
    questions: state.submissions >= 20 ? [] : missing,
    limit_reached: state.submissions >= 20,
    answered: state.questions.filter(q => Object.hasOwn(state.answers, q.id)).map(q => ({ ...q, answer: state.answers[q.id] }))
  };
}

module.exports = { get, put, exclusive, create, prepare, answer, view, clear: req => sessions.delete(key(req)), TTL };
