'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { QueryTypes } = require('sequelize');
const connection = require('../db/connection');
const aiModule = require('../services/ai-adapter');
const memberRouter = require('../routes/member');
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

test('8-3B Universal Owned Device Registration & Upgrade Decision Engine (Scenarios 1-9 across tablet, laptop, smartwatch, earbuds, speaker)', async () => {
  const db = connection.getDatabase();
  const uniqueEmail = `upg_83b_${Date.now()}@example.com`;
  const uniqueEmail2 = `upg_83b_2_${Date.now()}@example.com`;
  let uid = null;
  let uid2 = null;

  recRouter.setAiAdapter(aiModule.createAiAdapter({
    mockRecommendFn: ({ aiContext }) => aiModule.mockRecommend({ aiContext })
  }));

  async function currentProfileVersion(targetUid = uid) {
    const p = await db.models.profiles.findByPk(targetUid);
    return p.version;
  }

  try {
    const user = await db.models.users.create({
      email: uniqueEmail,
      password_hash: 'test_hash_83b'
    });
    uid = String(user.id);

    const user2 = await db.models.users.create({
      email: uniqueEmail2,
      password_hash: 'test_hash_83b_2'
    });
    uid2 = String(user2.id);

    for (const targetUid of [uid, uid2]) {
      await db.models.profiles.create({
        user_id: targetUid,
        version: 1,
        common_json: {
          usages: ['work', 'coding', 'video', 'communication'],
          spending_style: 'balanced',
          mobility: 'high',
          ecosystem: 'mixed'
        },
        smartphone_json: {
          preferred_brands: ['samsung', 'apple'],
          priorities: ['performance', 'portability', 'battery'],
          preferred_os: null
        },
        confirmed_at: new Date()
      });
    }

    // Lookup real catalog SKU IDs from final_project DB
    const [tabS9FeSku] = await db.query(
      "SELECT k.id AS sku_id, m.id AS model_id FROM catalog_skus k JOIN catalog_models m ON m.id = k.model_id WHERE m.category_code = 'tablet' AND m.model_number = 'SM-X510' AND k.storage_gb = 128 LIMIT 1",
      { type: QueryTypes.SELECT }
    );
    const [ipadA16Sku] = await db.query(
      "SELECT k.id AS sku_id, m.id AS model_id FROM catalog_skus k JOIN catalog_models m ON m.id = k.model_id WHERE m.category_code = 'tablet' AND m.model_number = 'A3354' AND k.storage_gb = 128 LIMIT 1",
      { type: QueryTypes.SELECT }
    );
    const [macbook8GbSku] = await db.query(
      "SELECT k.id AS sku_id, m.id AS model_id FROM catalog_skus k JOIN catalog_models m ON m.id = k.model_id WHERE m.category_code = 'laptop' AND m.model_number = 'A3113' LIMIT 1",
      { type: QueryTypes.SELECT }
    );
    const [watch8Sku] = await db.query(
      "SELECT k.id AS sku_id, m.id AS model_id FROM catalog_skus k JOIN catalog_models m ON m.id = k.model_id WHERE m.category_code = 'smartwatch' AND m.model_number = 'SM-L330' LIMIT 1",
      { type: QueryTypes.SELECT }
    );
    const [airpods4NoAncSku] = await db.query(
      "SELECT k.id AS sku_id, m.id AS model_id FROM catalog_skus k JOIN catalog_models m ON m.id = k.model_id WHERE m.category_code = 'earbuds' AND m.model_number = 'A3050' LIMIT 1",
      { type: QueryTypes.SELECT }
    );
    const [jblFlip7BlkSku] = await db.query(
      "SELECT k.id AS sku_id, m.id AS model_id FROM catalog_skus k JOIN catalog_models m ON m.id = k.model_id WHERE m.category_code = 'speaker' AND k.sku_code = 'JBLFLIP7BLK' LIMIT 1",
      { type: QueryTypes.SELECT }
    );

    assert.ok(tabS9FeSku && ipadA16Sku && macbook8GbSku && watch8Sku && airpods4NoAncSku && jblFlip7BlkSku);

    // =========================================================================
    // Scenario 1: Tablet Owned Device Registration & Upgrade (REPLACE & KEEP)
    // =========================================================================
    const regTabRes = await invokeRouter(memberRouter, 'POST', '/owned-devices', {
      session: { user_id: uid },
      body: {
        category: 'tablet',
        catalog_sku_id: String(tabS9FeSku.sku_id),
        purchase_price_krw: 480000,
        purchase_date: '2024-03-10',
        pain_points: ['pen', 'storage'],
        usages: ['work']
      }
    });
    assert.equal(regTabRes.status, 201);
    const ownedTabId = regTabRes.body.data.device.id;
    assert.equal(regTabRes.body.data.device.category, 'tablet');
    assert.equal(regTabRes.body.data.device.source, 'catalog');
    assert.equal(regTabRes.body.data.device.catalog_sku_id, String(tabS9FeSku.sku_id));
    assert.equal(regTabRes.body.data.device.purchase_info.purchase_price_krw, 480000);
    assert.equal(regTabRes.body.data.device.product.model_number, 'SM-X510');

    // 1A. Tablet Upgrade -> REPLACE (SM-X510 128GB -> iPad A16 256GB with verified pen & keyboard support and 256GB storage)
    const tabUpgRes = await invokeRouter(recRouter, 'POST', '/recommendations', {
      session: { user_id: uid },
      body: {
        category: 'tablet',
        expected_profile_version: await currentProfileVersion(),
        replacement_device_id: ownedTabId,
        purchase_reason: '강의 필기용 공식 펜·키보드 지원이 확인된 모델과 256GB 이상 저장 공간이 필요함',
        upgrade_context: {
          pain_points: ['pen', 'storage'],
          replacement_intent: 'high'
        },
        hard: {
          budget_max_krw: 900000,
          usages: ['work'],
          require_pen: true,
          min_storage_gb: 256
        },
        soft: {
          priorities: ['portability']
        }
      }
    });
    assert.equal(tabUpgRes.status, 201);
    assert.equal(tabUpgRes.body.data.status, 'recommend');
    assert.equal(tabUpgRes.body.data.upgrade_decision, 'REPLACE');
    assert.equal(tabUpgRes.body.data.owned_device.product.model_number, 'SM-X510');
    assert.equal(tabUpgRes.body.data.items.length, 1);
    assert.equal(tabUpgRes.body.data.items[0].model_number, 'A3354');
    assert.equal(tabUpgRes.body.data.items[0].storage_gb, 256);
    assert.ok(tabUpgRes.body.data.verified_improvements.some(s => s.includes('펜')));
    assert.ok(tabUpgRes.body.data.verified_improvements.some(s => s.includes('저장 용량')));
    assert.equal(tabUpgRes.body.data.items[0].cost_analysis.owned_purchase_price_krw, 480000);
    assert.equal(tabUpgRes.body.data.items[0].cost_analysis.candidate_reference_price_krw, 834870);
    assert.equal(tabUpgRes.body.data.items[0].cost_analysis.resale_value_estimated, false);

    // 1B. Tablet Upgrade -> KEEP (Register iPad A16 128GB, satisfied with pen & portability, low replacement intent)
    const regIpadRes = await invokeRouter(memberRouter, 'POST', '/owned-devices', {
      session: { user_id: uid },
      body: {
        category: 'tablet',
        catalog_sku_id: String(ipadA16Sku.sku_id),
        purchase_price_krw: 600000
      }
    });
    assert.equal(regIpadRes.status, 201);
    const ownedIpadId = regIpadRes.body.data.device.id;

    const tabKeepRes = await invokeRouter(recRouter, 'POST', '/recommendations', {
      session: { user_id: uid },
      body: {
        category: 'tablet',
        expected_profile_version: await currentProfileVersion(),
        replacement_device_id: ownedIpadId,
        purchase_reason: '현재 아이패드로 필기 잘 쓰고 있는데 바꿀 필요가 있는지 궁금함',
        upgrade_context: {
          satisfied_aspects: ['pen', 'portability'],
          pain_points: [],
          replacement_intent: 'low_or_keep_if_okay',
          no_pain_confirmed: true
        },
        hard: {
          budget_max_krw: 900000,
          usages: ['work'],
          require_pen: true
        }
      }
    });
    assert.equal(tabKeepRes.status, 201);
    assert.equal(tabKeepRes.body.data.status, 'keep');
    assert.equal(tabKeepRes.body.data.upgrade_decision, 'KEEP');
    assert.equal(tabKeepRes.body.data.items.length, 0);
    assert.ok(tabKeepRes.body.data.keep_reasons.length >= 2);

    // =========================================================================
    // Scenario 2: Laptop RAM & SSD Shortage -> REPLACE (without fabricating CPU %)
    // =========================================================================
    const regLapRes = await invokeRouter(memberRouter, 'POST', '/owned-devices', {
      session: { user_id: uid },
      body: {
        category: 'laptop',
        catalog_sku_id: String(macbook8GbSku.sku_id), // 8GB RAM / 256GB SSD (MacBook Air 13 M3)
        purchase_price_krw: 1350000
      }
    });
    assert.equal(regLapRes.status, 201);
    const ownedLapId = regLapRes.body.data.device.id;

    const lapUpgRes = await invokeRouter(recRouter, 'POST', '/recommendations', {
      session: { user_id: uid },
      body: {
        category: 'laptop',
        expected_profile_version: await currentProfileVersion(),
        replacement_device_id: ownedLapId,
        purchase_reason: '개발 환경 컨테이너 실행 시 RAM 8GB와 SSD 256GB가 부족함',
        upgrade_context: {
          pain_points: ['ram', 'storage'],
          replacement_intent: 'high'
        },
        hard: {
          budget_max_krw: 2500000,
          usages: ['coding', 'work'],
          min_ram_gb: 16,
          min_storage_gb: 512
        }
      }
    });
    assert.equal(lapUpgRes.status, 201);
    assert.equal(lapUpgRes.body.data.status, 'recommend');
    assert.equal(lapUpgRes.body.data.upgrade_decision, 'REPLACE');
    assert.ok(lapUpgRes.body.data.items.length >= 1);
    const topLap = lapUpgRes.body.data.items[0];
    assert.ok(topLap.ram_gb >= 16);
    assert.ok(topLap.storage_gb >= 512);
    assert.ok(topLap.verified_improvements.some(s => s.includes('RAM')));
    assert.ok(topLap.verified_improvements.some(s => s.includes('SSD')));
    assert.equal(topLap.comparison_with_owned.fields.cpu.status, 'insufficient_benchmark_data');

    // =========================================================================
    // Scenario 3: Smartwatch iOS / Android Compatibility Transition -> REPLACE
    // =========================================================================
    const regWatchRes = await invokeRouter(memberRouter, 'POST', '/owned-devices', {
      session: { user_id: uid },
      body: {
        category: 'smartwatch',
        catalog_sku_id: String(watch8Sku.sku_id), // Galaxy Watch8 44mm (Android only)
        purchase_price_krw: 350000
      }
    });
    assert.equal(regWatchRes.status, 201);
    const ownedWatchId = regWatchRes.body.data.device.id;
    assert.equal(regWatchRes.body.data.device.category, 'smartwatch');

    const watchUpgRes = await invokeRouter(recRouter, 'POST', '/recommendations', {
      session: { user_id: uid },
      body: {
        category: 'smartwatch',
        expected_profile_version: await currentProfileVersion(),
        replacement_device_id: ownedWatchId,
        purchase_reason: '아이폰으로 스마트폰을 기변해서 기존 갤럭시 워치 연동이 불가능함',
        upgrade_context: {
          pain_points: ['os_ecosystem'],
          replacement_intent: 'high'
        },
        hard: {
          budget_max_krw: 650000,
          usages: ['communication'],
          compatible_os: 'ios'
        }
      }
    });
    assert.equal(watchUpgRes.status, 201);
    assert.equal(watchUpgRes.body.data.status, 'recommend');
    assert.equal(watchUpgRes.body.data.upgrade_decision, 'REPLACE');
    assert.ok(watchUpgRes.body.data.items.length >= 1);
    for (const item of watchUpgRes.body.data.items) {
      assert.equal(item.brand.toLowerCase(), 'apple');
      assert.ok(item.verified_improvements.some(s => s.includes('iPhone(iOS)')));
    }

    // =========================================================================
    // Scenario 4: Wireless Earbuds ANC Improvement -> REPLACE
    // =========================================================================
    const regBudsRes = await invokeRouter(memberRouter, 'POST', '/owned-devices', {
      session: { user_id: uid },
      body: {
        category: 'earbuds',
        catalog_sku_id: String(airpods4NoAncSku.sku_id), // AirPods 4 non-ANC (A3050)
        purchase_price_krw: 179000
      }
    });
    assert.equal(regBudsRes.status, 201);
    const ownedBudsId = regBudsRes.body.data.device.id;
    assert.equal(regBudsRes.body.data.device.category, 'earbuds');

    const budsUpgRes = await invokeRouter(recRouter, 'POST', '/recommendations', {
      session: { user_id: uid },
      body: {
        category: 'earbuds',
        expected_profile_version: await currentProfileVersion(),
        replacement_device_id: ownedBudsId,
        purchase_reason: '출퇴근 지하철 소음 때문에 액티브 노이즈 캔슬링(ANC) 기능이 필요함',
        upgrade_context: {
          pain_points: ['anc'],
          replacement_intent: 'high'
        },
        hard: {
          budget_max_krw: 350000,
          usages: ['video', 'communication'],
          require_anc: true
        }
      }
    });
    assert.equal(budsUpgRes.status, 201);
    assert.equal(budsUpgRes.body.data.status, 'recommend');
    assert.equal(budsUpgRes.body.data.upgrade_decision, 'REPLACE');
    assert.ok(budsUpgRes.body.data.items.length >= 1);
    for (const item of budsUpgRes.body.data.items) {
      assert.notEqual(item.model_number, 'A3050');
      assert.equal(item.specifications.anc, true);
      assert.ok(item.verified_improvements.some(s => s.includes('ANC')));
    }

    // =========================================================================
    // Scenario 5: Speaker Output / Water Resistance / Portability -> REPLACE
    // =========================================================================
    const regManualSpkRes = await invokeRouter(memberRouter, 'POST', '/owned-devices', {
      session: { user_id: uid },
      body: {
        category: 'speaker',
        manual_brand: 'GenericAudio',
        manual_model_name: 'Indoor Mini 10W',
        manual_specs_json: {
          power_w: 10,
          battery_hours: 6,
          water_resistance: 'IPX4',
          weight_g: 820
        },
        purchase_price_krw: 45000
      }
    });
    assert.equal(regManualSpkRes.status, 201);
    const ownedManualSpkId = regManualSpkRes.body.data.device.id;
    assert.equal(regManualSpkRes.body.data.device.category, 'speaker');

    const spkUpgRes = await invokeRouter(recRouter, 'POST', '/recommendations', {
      session: { user_id: uid },
      body: {
        category: 'speaker',
        expected_profile_version: await currentProfileVersion(),
        replacement_device_id: ownedManualSpkId,
        purchase_reason: '캠핑장 야외에서 쓰기에 출력이 약하고 방수·배터리가 부족하며 무거움',
        upgrade_context: {
          pain_points: ['power', 'water_resistance', 'battery', 'portability'],
          replacement_intent: 'high'
        },
        hard: {
          budget_max_krw: 200000,
          usages: ['communication'],
          require_water_resistance: true
        }
      }
    });
    assert.equal(spkUpgRes.status, 201);
    assert.equal(spkUpgRes.body.data.status, 'recommend');
    assert.equal(spkUpgRes.body.data.upgrade_decision, 'REPLACE');
    assert.equal(spkUpgRes.body.data.items.length, 1);
    assert.equal(spkUpgRes.body.data.items[0].model_name, 'JBL Flip 7');
    assert.ok(spkUpgRes.body.data.verified_improvements.some(s => s.includes('정격 출력: 10W → 35W')));
    assert.ok(spkUpgRes.body.data.verified_improvements.some(s => s.includes('IP68')));
    assert.ok(spkUpgRes.body.data.verified_improvements.some(s => s.includes('경량화')));

    // =========================================================================
    // Scenario 6: Unpriced Candidate Handling -> DEFER (Lenovo Tab M11 has pen_supported=true but price=null)
    // =========================================================================
    const unpricedDeferRes = await invokeRouter(recRouter, 'POST', '/recommendations', {
      session: { user_id: uid },
      body: {
        category: 'tablet',
        expected_profile_version: await currentProfileVersion(),
        replacement_device_id: ownedTabId,
        purchase_reason: '레노버 펜 지원 태블릿으로 교체하고 싶음',
        upgrade_context: {
          pain_points: ['pen'],
          replacement_intent: 'high'
        },
        hard: {
          budget_max_krw: 600000,
          usages: ['work'],
          allowed_brands: ['lenovo'],
          require_pen: true
        }
      }
    });
    assert.equal(unpricedDeferRes.status, 201);
    assert.equal(unpricedDeferRes.body.data.status, 'defer');
    assert.equal(unpricedDeferRes.body.data.upgrade_decision, 'DEFER');
    assert.equal(unpricedDeferRes.body.data.items.length, 0);
    assert.ok(unpricedDeferRes.body.data.decision_reasons.some(r => r.includes('참고 가격이 아직 확보되지 않아')));

    // =========================================================================
    // Scenario 7: Prevent Same Model or Same SKU Replacement (Owning JBL Flip 7 BLK must NEVER recommend JBL Flip 7 BLK or BLU)
    // =========================================================================
    const regFlip7Res = await invokeRouter(memberRouter, 'POST', '/owned-devices', {
      session: { user_id: uid },
      body: {
        category: 'speaker',
        catalog_sku_id: String(jblFlip7BlkSku.sku_id)
      }
    });
    assert.equal(regFlip7Res.status, 201);
    const ownedFlip7Id = regFlip7Res.body.data.device.id;

    const sameModelDeferRes = await invokeRouter(recRouter, 'POST', '/recommendations', {
      session: { user_id: uid },
      body: {
        category: 'speaker',
        expected_profile_version: await currentProfileVersion(),
        replacement_device_id: ownedFlip7Id,
        purchase_reason: '더 높은 출력의 스피커로 바꾸고 싶음',
        upgrade_context: {
          pain_points: ['power'],
          replacement_intent: 'high'
        },
        hard: {
          budget_max_krw: 300000,
          usages: ['communication']
        }
      }
    });
    assert.equal(sameModelDeferRes.status, 201);
    assert.equal(sameModelDeferRes.body.data.status, 'defer');
    assert.equal(sameModelDeferRes.body.data.upgrade_decision, 'DEFER');
    assert.equal(sameModelDeferRes.body.data.items.length, 0);
    assert.ok(sameModelDeferRes.body.data.decision_reasons.some(r => r.includes('동일한 모델뿐이어서')));

    // =========================================================================
    // Scenario 8: Insufficient Owned Device Info & Cross-Category Mismatch -> CLARIFY
    // =========================================================================
    const regUnknownLapRes = await invokeRouter(memberRouter, 'POST', '/owned-devices', {
      session: { user_id: uid },
      body: {
        category: 'laptop',
        manual_brand: 'CustomBrand',
        manual_model_name: 'MysteryBook Without Specs'
      }
    });
    assert.equal(regUnknownLapRes.status, 201);
    const ownedUnknownLapId = regUnknownLapRes.body.data.device.id;

    // 8A. Unidentified manual laptop without RAM/SSD specs -> CLARIFY
    const clarifyMissingSpecsRes = await invokeRouter(recRouter, 'POST', '/recommendations', {
      session: { user_id: uid },
      body: {
        category: 'laptop',
        expected_profile_version: await currentProfileVersion(),
        replacement_device_id: ownedUnknownLapId,
        purchase_reason: '램이 부족해서 업그레이드하고 싶음',
        upgrade_context: {
          pain_points: ['ram'],
          replacement_intent: 'high'
        },
        hard: {
          budget_max_krw: 2000000,
          usages: ['coding']
        }
      }
    });
    assert.equal(clarifyMissingSpecsRes.status, 201);
    assert.equal(clarifyMissingSpecsRes.body.data.status, 'clarify');
    assert.equal(clarifyMissingSpecsRes.body.data.upgrade_decision, 'CLARIFY');
    assert.equal(clarifyMissingSpecsRes.body.data.items.length, 0);
    assert.ok(clarifyMissingSpecsRes.body.data.questions.some(q => q.includes('사양 정보가 부족해')));

    // 8B. Cross-category mismatch (passing laptop device ID to tablet recommendation) -> CLARIFY
    const clarifyMismatchRes = await invokeRouter(recRouter, 'POST', '/recommendations', {
      session: { user_id: uid },
      body: {
        category: 'tablet',
        expected_profile_version: await currentProfileVersion(),
        replacement_device_id: ownedLapId,
        purchase_reason: '태블릿 업그레이드',
        upgrade_context: {
          pain_points: ['portability'],
          replacement_intent: 'high'
        },
        hard: {
          budget_max_krw: 1000000,
          usages: ['work']
        }
      }
    });
    assert.equal(clarifyMismatchRes.status, 201);
    assert.equal(clarifyMismatchRes.body.data.status, 'clarify');
    assert.equal(clarifyMismatchRes.body.data.upgrade_decision, 'CLARIFY');
    assert.ok(clarifyMismatchRes.body.data.questions.some(q => q.includes('제품군')));

    // =========================================================================
    // Scenario 9: Gemini Explanation Failure / Tampering -> Server Fallback Preserves REPLACE Decision
    // =========================================================================
    const regBudsUser2 = await invokeRouter(memberRouter, 'POST', '/owned-devices', {
      session: { user_id: uid2 },
      body: {
        category: 'earbuds',
        catalog_sku_id: String(airpods4NoAncSku.sku_id)
      }
    });
    assert.equal(regBudsUser2.status, 201);
    const ownedBudsIdUser2 = regBudsUser2.body.data.device.id;

    recRouter.setAiAdapter(aiModule.createAiAdapter({
      mockRecommendFn: () => {
        const err = new Error('RATE_LIMITED');
        err.code = 'RATE_LIMITED';
        err.status = 429;
        throw err;
      }
    }));

    const fallbackUpgRes = await invokeRouter(recRouter, 'POST', '/catalog/earbuds/recommendations', {
      params: { category: 'earbuds' },
      session: { user_id: uid2 },
      body: {
        expected_profile_version: await currentProfileVersion(uid2),
        replacement_device_id: ownedBudsIdUser2,
        purchase_reason: 'ANC 기능 추가 희망',
        upgrade_context: {
          pain_points: ['anc'],
          replacement_intent: 'high'
        },
        hard: {
          budget_max_krw: 350000,
          usages: ['video'],
          require_anc: true
        }
      }
    });
    assert.equal(fallbackUpgRes.status, 201);
    assert.equal(fallbackUpgRes.body.data.status, 'recommend');
    assert.equal(fallbackUpgRes.body.data.upgrade_decision, 'REPLACE');
    assert.equal(fallbackUpgRes.body.data.explanation_source, 'server_fallback');
    assert.equal(fallbackUpgRes.body.data.ai_fallback_reason, 'RATE_LIMITED');
    assert.ok(fallbackUpgRes.body.data.items.length >= 1);

    // Ensure zero internal score/weight leakage
    const rawJson = JSON.stringify(fallbackUpgRes.body);
    assert.ok(!rawJson.includes('_internal_score'));
    assert.ok(!rawJson.includes('_internal_weights'));
    assert.ok(!rawJson.includes('recommendation_score'));

    // =========================================================================
    // Scenario 10: Existing Smartphone Upgrade Regression (variant_id reference, KEEP & REPLACE)
    // =========================================================================
    recRouter.setAiAdapter(aiModule.createAiAdapter({
      mockRecommendFn: ({ aiContext }) => aiModule.mockRecommend({ aiContext })
    }));

    const [s24Variant] = await db.query(
      "SELECT v.id AS variant_id FROM smartphone_variants v JOIN smartphones s ON s.id = v.smartphone_id WHERE s.domestic_model_number = 'SM-S921N' AND v.storage_gb = 256 AND s.verified = 1 AND v.verified = 1 LIMIT 1",
      { type: QueryTypes.SELECT }
    );
    assert.ok(s24Variant);

    const regPhoneRes = await invokeRouter(memberRouter, 'POST', '/owned-devices', {
      session: { user_id: uid2 },
      body: {
        variant_id: String(s24Variant.variant_id)
      }
    });
    assert.equal(regPhoneRes.status, 201);
    assert.equal(regPhoneRes.body.data.device.category, 'smartphone');
    assert.equal(regPhoneRes.body.data.device.source, 'catalog');
    assert.equal(regPhoneRes.body.data.device.variant_id, String(s24Variant.variant_id));
    const ownedPhoneId = regPhoneRes.body.data.device.id;

    // 10A. Smartphone KEEP when satisfied and low replacement intent
    const phoneKeepRes = await invokeRouter(recRouter, 'POST', '/recommendations', {
      session: { user_id: uid2 },
      body: {
        expected_profile_version: await currentProfileVersion(uid2),
        replacement_device_id: ownedPhoneId,
        purchase_reason: '현재 갤럭시 S24 사용에 만족하며 교체 필요성만 확인',
        upgrade_context: {
          satisfied_aspects: ['portability', 'display'],
          pain_points: [],
          replacement_intent: 'low_or_keep_if_okay',
          no_pain_confirmed: true
        },
        hard: {
          budget_max_krw: 1800000,
          usages: ['communication', 'video'],
          min_storage_gb: 256
        }
      }
    });
    assert.equal(phoneKeepRes.status, 201);
    assert.equal(phoneKeepRes.body.data.status, 'keep');
    assert.ok(phoneKeepRes.body.data.keep_reasons.length >= 1);

    // 10B. Smartphone REPLACE when requesting 512GB storage upgrade
    const phoneReplaceRes = await invokeRouter(recRouter, 'POST', '/recommendations', {
      session: { user_id: uid2 },
      body: {
        expected_profile_version: await currentProfileVersion(uid2),
        replacement_device_id: ownedPhoneId,
        purchase_reason: '256GB 저장 공간이 부족해서 512GB 이상으로 교체 필요',
        upgrade_context: {
          pain_points: ['storage'],
          replacement_intent: 'high'
        },
        hard: {
          budget_max_krw: 2200000,
          usages: ['video', 'work'],
          min_storage_gb: 512
        }
      }
    });
    assert.equal(phoneReplaceRes.status, 201);
    assert.equal(phoneReplaceRes.body.data.status, 'recommend');
    assert.ok(phoneReplaceRes.body.data.items.length >= 1);
    assert.ok(phoneReplaceRes.body.data.items[0].product.storage_gb >= 512);
    assert.ok(phoneReplaceRes.body.data.items[0].comparison_with_owned.improvements.some(s => s.includes('저장 용량')));
  } finally {
    recRouter.setAiAdapter(null);
    for (const targetUid of [uid, uid2]) {
      if (targetUid !== null) {
        await db.models.recommendations.destroy({ where: { user_id: targetUid } });
        await db.models.owned_devices.destroy({ where: { user_id: targetUid } });
        await db.models.profiles.destroy({ where: { user_id: targetUid } });
        await db.models.users.destroy({ where: { id: targetUid } });
      }
    }
  }
});

test.after(async () => {
  await connection.close();
});
