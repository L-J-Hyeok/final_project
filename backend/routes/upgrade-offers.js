'use strict';

// 보유 기기 기반 업그레이드 제안 상태 조회·숨김/30일 억제·현재 사용 기기 지정 API 라우터
// 주의: 상태 조회/변경 API에서는 절대 Gemini나 외부 API를 호출하지 않는다.
const express = require('express');
const { QueryTypes } = require('sequelize');
const connection = require('../db/connection');
const catalog = require('../services/smartphone-catalog');
const upgradeAdvisor = require('../services/upgrade-advisor');

const router = express.Router();
const wrap = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);

function db() {
  return connection.getDatabase();
}

router.use(['/upgrade-offer'], wrap(async (req, res, next) => {
  if (!req.session || !req.session.user_id) throw catalog.fail('AUTH_REQUIRED', 401);
  const user = await db().models.users.findByPk(req.session.user_id, { attributes: ['id'] });
  if (!user) throw catalog.fail('AUTH_REQUIRED', 401);
  next();
}));

async function buildUpgradeOfferStatus(uid, nowInput = new Date(), t = undefined) {
  const p = await db().models.profiles.findByPk(uid, { transaction: t });
  if (!p) throw catalog.fail('NOT_FOUND', 404);

  const savedUpgradeState = (p.smartphone_json && typeof p.smartphone_json === 'object' && p.smartphone_json._upgrade_state)
    ? p.smartphone_json._upgrade_state
    : {};

  // 사용자의 모든 스마트폰 보유 기기 조회 (최신 등록/수정 순 파악을 위해 id ASC 조회)
  const ownedRows = await db().models.owned_devices.findAll({
    where: { user_id: uid, category: 'smartphone' },
    order: [['id', 'ASC']],
    transaction: t
  });

  if (ownedRows.length === 0) {
    return {
      has_owned_smartphone: false,
      current_device: null,
      past_or_other_smartphones: [],
      upgrade_offer_eligible: false,
      should_show_popup: false,
      needs_verification: false,
      can_start_upgrade_recommendation: true,
      can_start_general_recommendation: true,
      snooze_policy_days: upgradeAdvisor.getSnoozeDays(process.env),
      active_policies: {
        smartphone: upgradeAdvisor.DEVICE_UPGRADE_POLICIES.smartphone
      },
      planned_policies: {
        laptop: upgradeAdvisor.DEVICE_UPGRADE_POLICIES.laptop,
        tablet: upgradeAdvisor.DEVICE_UPGRADE_POLICIES.tablet,
        watch: upgradeAdvisor.DEVICE_UPGRADE_POLICIES.watch,
        pc: upgradeAdvisor.DEVICE_UPGRADE_POLICIES.pc
      }
    };
  }

  // 카탈로그 연결 기기 조회
  const variantIds = ownedRows.filter(r => r.variant_id !== null).map(r => r.variant_id);
  const variantMap = new Map();
  if (variantIds.length > 0) {
    const vRows = await db().query(
      `SELECT
         CAST(v.id AS CHAR) AS variant_id,
         CAST(s.id AS CHAR) AS smartphone_id,
         s.brand,
         s.model_name,
         s.domestic_model_number,
         s.released_on_kr,
         s.os,
         (s.verified AND v.verified) AS verified,
         s.is_test
       FROM smartphone_variants v
       JOIN smartphones s ON s.id = v.smartphone_id
       WHERE v.id IN (:variantIds)`,
      { replacements: { variantIds }, type: QueryTypes.SELECT, transaction: t }
    );
    for (const r of vRows) {
      variantMap.set(String(r.variant_id), r);
    }
  }

  // 수동 입력 스마트폰이 있으면 카탈로그 모델 목록 조회 (모델명/모델번호 대조용)
  const hasManual = ownedRows.some(r => r.variant_id === null);
  let catalogPhonesForManual = [];
  if (hasManual) {
    catalogPhonesForManual = await db().query(
      `SELECT
         CAST(id AS CHAR) AS smartphone_id,
         brand,
         model_name,
         domestic_model_number,
         released_on_kr,
         os,
         verified,
         is_test
       FROM smartphones
       ORDER BY id ASC`,
      { type: QueryTypes.SELECT, transaction: t }
    );
  }

  const evaluatedList = ownedRows.map(r => {
    const raw = r.toJSON();
    const catProd = raw.variant_id ? (variantMap.get(String(raw.variant_id)) || null) : null;
    return upgradeAdvisor.evaluateSmartphoneDeviceStatus(
      raw,
      catProd,
      catalogPhonesForManual,
      savedUpgradeState,
      nowInput
    );
  });

  // 현재 사용 기기(current_device)와 과거/보조 보유 기기 구분:
  // 사용자가 명시적으로 지정한 current_device_id가 현재 보유 목록에 있으면 우선 사용하고,
  // 없거나 삭제되었으면 가장 최근에 등록한 스마트폰(마지막 항목)을 현재 사용 기기로 판정한다.
  const preferredId = savedUpgradeState.current_device_id ? String(savedUpgradeState.current_device_id) : null;
  let currentDevice = evaluatedList.find(d => d.owned_device_id === preferredId) || null;
  if (!currentDevice) {
    currentDevice = evaluatedList[evaluatedList.length - 1];
  }

  const pastOrOtherDevices = evaluatedList
    .filter(d => d.owned_device_id !== currentDevice.owned_device_id)
    .map(d => ({ ...d, is_current_device: false }));

  currentDevice = { ...currentDevice, is_current_device: true };

  return {
    has_owned_smartphone: true,
    current_device: currentDevice,
    past_or_other_smartphones: pastOrOtherDevices,
    upgrade_offer_eligible: currentDevice.upgrade_offer_eligible,
    should_show_popup: currentDevice.should_show_popup,
    needs_verification: currentDevice.needs_verification,
    can_start_upgrade_recommendation: true,
    can_start_general_recommendation: true,
    snooze_policy_days: upgradeAdvisor.getSnoozeDays(process.env),
    active_policies: {
      smartphone: upgradeAdvisor.DEVICE_UPGRADE_POLICIES.smartphone
    },
    planned_policies: {
      laptop: upgradeAdvisor.DEVICE_UPGRADE_POLICIES.laptop,
      tablet: upgradeAdvisor.DEVICE_UPGRADE_POLICIES.tablet,
      watch: upgradeAdvisor.DEVICE_UPGRADE_POLICIES.watch,
      pc: upgradeAdvisor.DEVICE_UPGRADE_POLICIES.pc
    }
  };
}

// GET /api/upgrade-offer — 현재 로그인 회원의 보유 스마트폰 출시 3년 경과 및 업그레이드 제안 상태 조회
// 단순 조회(GET)는 안내 확인/숨김 상태를 절대 변경하지 않으며, Gemini를 호출하지 않는다.
router.get('/upgrade-offer', wrap(async (req, res) => {
  catalog.object(req.query, []);
  const status = await buildUpgradeOfferStatus(req.session.user_id, new Date());
  res.json({ data: status });
}));

// PUT /api/upgrade-offer/state — 안내 상태 변경 ('snooze': 30일 숨김, 'dismiss_permanent': 이 기기 영구 숨김, 'set_current': 현재 사용 스마트폰 지정, 'reset_notice': 숨김 해제)
// 동시 호출 시 중복/경합 방지를 위해 사용자/프로필 행을 잠그고 원자적으로 갱신하되, 프로필 version은 증가시키지 않아 진행 중인 추천과 충돌하지 않게 한다.
router.put('/upgrade-offer/state', wrap(async (req, res) => {
  const uid = req.session.user_id;
  const input = upgradeAdvisor.validateUpgradeStateActionInput(req.body);
  const now = new Date();
  const snoozeDays = upgradeAdvisor.getSnoozeDays(process.env);

  const status = await db().transaction(async t => {
    const user = await db().models.users.findByPk(uid, { transaction: t, lock: t.LOCK.UPDATE, attributes: ['id'] });
    if (!user) throw catalog.fail('AUTH_REQUIRED', 401);
    const p = await db().models.profiles.findByPk(uid, { transaction: t, lock: t.LOCK.UPDATE });
    if (!p) throw catalog.fail('NOT_FOUND', 404);

    // 본인 소유 스마트폰인지 검증 (타인 기기 또는 비스마트폰/없는 기기는 404)
    const owned = await db().models.owned_devices.findOne({
      where: { id: input.owned_device_id, user_id: uid, category: 'smartphone' },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!owned) throw catalog.fail('NOT_FOUND', 404);

    const curJson = (p.smartphone_json && typeof p.smartphone_json === 'object') ? { ...p.smartphone_json } : {};
    const upgradeState = (curJson._upgrade_state && typeof curJson._upgrade_state === 'object')
      ? { ...curJson._upgrade_state, devices: { ...(curJson._upgrade_state.devices || {}) } }
      : { current_device_id: null, devices: {} };

    // 현재 보유 중인 스마트폰 ID 집합만 유지하여 삭제된 기기 상태 찌꺼기 정리
    const allOwnedIds = await db().models.owned_devices.findAll({
      where: { user_id: uid, category: 'smartphone' },
      attributes: ['id'],
      transaction: t
    });
    const validIdSet = new Set(allOwnedIds.map(r => String(r.id)));
    for (const k of Object.keys(upgradeState.devices)) {
      if (!validIdSet.has(k)) delete upgradeState.devices[k];
    }

    const devKey = String(owned.id);
    const prevDevState = upgradeState.devices[devKey] || {
      snoozed_until: null,
      dismissed_permanently: false,
      updated_at: null
    };

    if (input.action === 'set_current') {
      upgradeState.current_device_id = devKey;
    } else if (input.action === 'snooze') {
      const snoozeUntil = new Date(now.getTime() + snoozeDays * 24 * 60 * 60 * 1000).toISOString();
      upgradeState.devices[devKey] = {
        ...prevDevState,
        snoozed_until: snoozeUntil,
        updated_at: now.toISOString()
      };
    } else if (input.action === 'dismiss_permanent') {
      upgradeState.devices[devKey] = {
        ...prevDevState,
        dismissed_permanently: true,
        updated_at: now.toISOString()
      };
    } else if (input.action === 'reset_notice') {
      upgradeState.devices[devKey] = {
        snoozed_until: null,
        dismissed_permanently: false,
        updated_at: now.toISOString()
      };
    }

    curJson._upgrade_state = upgradeState;
    await p.update({ smartphone_json: curJson }, { transaction: t });

    return buildUpgradeOfferStatus(uid, now, t);
  });

  res.json({ data: status });
}));

router.buildUpgradeOfferStatus = buildUpgradeOfferStatus;

module.exports = router;
