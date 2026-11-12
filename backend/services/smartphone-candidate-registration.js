'use strict';

const verifier = require('./smartphone-candidate-verifier');

function createRegistrationError(status, code, message, extra = {}) {
  const err = new Error(message || code);
  err.status = status;
  err.code = code;
  err.publicMessage = message;
  Object.assign(err, extra);
  return err;
}

function evaluateRegistrationReadiness(candidate, liveParentModel = null) {
  if (!candidate) {
    return {
      ready: false,
      status: 'blocked',
      code: 'NOT_FOUND',
      reason: '후보 정보를 찾을 수 없습니다.',
    };
  }

  if (candidate.registration && candidate.registration.status === 'registered') {
    return {
      ready: false,
      status: 'registered',
      code: 'ALREADY_REGISTERED',
      reason: `이미 DB에 등록 완료되었습니다. (ID: ${candidate.registration.inserted_id})`,
      registration: candidate.registration,
    };
  }

  if (candidate.admin_review?.admin_status !== verifier.ADMIN_STATUSES.APPROVED) {
    return {
      ready: false,
      status: 'blocked',
      code: 'APPROVAL_REQUIRED',
      reason: '관리자 승인(approved) 상태가 아닙니다.',
    };
  }

  if (candidate.verification_status !== verifier.VERIFICATION_STATUSES.VERIFIED) {
    return {
      ready: false,
      status: 'blocked',
      code: 'VERIFICATION_REQUIRED',
      reason: `공식 검증 상태가 VERIFIED가 아닙니다. (${candidate.verification_status})`,
    };
  }

  // Issue 2: Samsung exclusive colors without official domestic SKU
  if (
    candidate.brand === 'samsung' &&
    candidate.channel === 'samsung_dotcom_exclusive' &&
    !candidate.sku_example
  ) {
    return {
      ready: false,
      status: 'blocked',
      code: 'MISSING_OFFICIAL_SKU',
      reason: '삼성닷컴·삼성 강남 전용 색상으로 공식 SKU(SM-...KOO) 확인 전까지 등록이 차단됩니다.',
    };
  }

  // Issue 3: Pending models with general catalog URL or identification hold
  if (candidate.candidate_kind === 'db_pending_model') {
    if (candidate.official_sources && candidate.official_sources.some((u) => u.includes('all-smartphones'))) {
      return {
        ready: false,
        status: 'blocked',
        code: 'UNVERIFIED_SOURCE_URL',
        reason: 'official_product_url이 모델 전용 페이지가 아닌 전체 목록 URL이므로 등록이 차단됩니다.',
      };
    }
    if (candidate.domestic_model_number === 'A3720') {
      return {
        ready: false,
        status: 'blocked',
        code: 'IDENTIFICATION_HOLD',
        reason: '국내 정발 모델 식별·사양 재확인 보류 대상(A3720)입니다.',
      };
    }
  }

  // Issue 1: Child variant parent model verification
  if (candidate.candidate_kind === 'new_variant') {
    if (!liveParentModel) {
      return {
        ready: false,
        status: 'blocked',
        code: 'PARENT_MODEL_NOT_FOUND',
        reason: `부모 스마트폰 모델(ID: ${candidate.target_smartphone_id})이 DB에 존재하지 않습니다.`,
      };
    }
    if (!['legacy', 'approved'].includes(liveParentModel.review_status)) {
      return {
        ready: false,
        status: 'blocked',
        code: 'PARENT_MODEL_NOT_READY',
        reason: `부모 모델(${liveParentModel.model_name || candidate.model_name}, status=${liveParentModel.review_status})이 아직 승인 대기(pending) 상태이므로 자식 옵션을 등록할 수 없습니다.`,
      };
    }
  }

  return {
    ready: true,
    status: 'ready_to_register',
    code: 'READY',
    reason: '공식 검증 및 관리자 승인이 완료되어 DB 비공개 등록이 가능합니다.',
  };
}

function validateCandidateForRegistration(candidate, liveParentModel = null) {
  const readiness = evaluateRegistrationReadiness(candidate, liveParentModel);
  if (!readiness.ready) {
    throw createRegistrationError(409, readiness.code, readiness.reason, {
      readiness,
      candidate_id: candidate?.candidate_id,
    });
  }
}

async function checkRegistrationDuplicate(candidate, db, transaction) {
  if (candidate.candidate_kind === 'new_model') {
    const [rows] = await db.query(
      'SELECT id, brand, model_name, domestic_model_number, review_status, verified FROM smartphones WHERE brand = :brand AND domestic_model_number = :domestic_model_number',
      {
        replacements: {
          brand: candidate.brand,
          domestic_model_number: candidate.domestic_model_number,
        },
        transaction,
      }
    );
    if (rows && rows.length > 0) {
      return {
        is_duplicate: true,
        existing_id: rows[0].id,
        table: 'smartphones',
        row: rows[0],
      };
    }
  } else if (candidate.candidate_kind === 'new_variant') {
    const [rows] = await db.query(
      'SELECT id, smartphone_id, storage_gb, ram_gb, color, review_status, verified FROM smartphone_variants WHERE smartphone_id = :smartphone_id AND storage_gb = :storage_gb AND color = :color',
      {
        replacements: {
          smartphone_id: Number(candidate.target_smartphone_id),
          storage_gb: Number(candidate.storage_gb),
          color: candidate.color || 'unspecified',
        },
        transaction,
      }
    );
    if (rows && rows.length > 0) {
      return {
        is_duplicate: true,
        existing_id: rows[0].id,
        table: 'smartphone_variants',
        row: rows[0],
      };
    }
  }

  return { is_duplicate: false };
}

async function registerApprovedCandidate({
  candidateId,
  adminUser,
  db,
  reviewStore,
  dryRun = false,
  simulateError = false,
}) {
  if (!adminUser || !adminUser.id) {
    throw createRegistrationError(401, 'ADMIN_REQUIRED', '관리자 인증 정보가 필요합니다.');
  }

  if (!candidateId) {
    throw createRegistrationError(422, 'INVALID_INPUT', 'candidateId가 필요합니다.');
  }

  const candidate = await reviewStore.getCandidateById(candidateId);
  if (!candidate) {
    throw createRegistrationError(404, 'NOT_FOUND', '등록할 후보 항목을 찾을 수 없습니다.');
  }

  // Idempotency check on existing state
  if (candidate.registration && candidate.registration.status === 'registered') {
    return {
      success: true,
      already_registered: true,
      candidate_id: candidateId,
      target_table: candidate.registration.target_table,
      inserted_id: candidate.registration.inserted_id,
      registered_at: candidate.registration.registered_at,
      message: '이미 DB에 등록 완료된 후보입니다.',
      candidate,
    };
  }

  // Fetch parent model from DB if new_variant
  let liveParentModel = null;
  if (candidate.candidate_kind === 'new_variant' && candidate.target_smartphone_id) {
    const [parentRows] = await db.query(
      'SELECT id, brand, model_name, domestic_model_number, review_status, verified FROM smartphones WHERE id = :id',
      {
        replacements: { id: Number(candidate.target_smartphone_id) },
      }
    );
    liveParentModel = parentRows && parentRows.length > 0 ? parentRows[0] : null;
  }

  // Validate policy compliance
  validateCandidateForRegistration(candidate, liveParentModel);

  if (dryRun) {
    const dupCheck = await checkRegistrationDuplicate(candidate, db, null);
    return {
      success: true,
      dry_run: true,
      already_registered: Boolean(dupCheck.is_duplicate),
      candidate_id: candidateId,
      target_table: candidate.candidate_kind === 'new_model' ? 'smartphones' : 'smartphone_variants',
      message: dupCheck.is_duplicate
        ? 'Dry-run: 이미 DB에 일치하는 제품이 존재합니다.'
        : 'Dry-run: 등록 검증 통과 (DB 미반영)',
    };
  }

  // Transactional insertion
  const nowIso = new Date().toISOString();

  const regResult = await db.transaction(async (t) => {
    // 1. Re-check duplicates inside transaction lock
    const dupCheck = await checkRegistrationDuplicate(candidate, db, t);
    if (dupCheck.is_duplicate) {
      return {
        already_registered: true,
        target_table: dupCheck.table,
        inserted_id: dupCheck.existing_id,
        registered_at: nowIso,
      };
    }

    let insertedId;
    let targetTable;

    if (candidate.candidate_kind === 'new_model') {
      targetTable = 'smartphones';
      const mPayload = candidate.phase3_payload?.model || {};

      // Insert parent model with review_status='pending', verified=false, is_test=false
      await db.query(
        `INSERT INTO smartphones (
          brand, model_name, domestic_model_number, released_on_kr, os, chipset,
          screen_inches, refresh_hz, battery_mah, weight_g, supports_5g, wireless_charging,
          source_name, source_url, official_product_url, details_json,
          review_status, verified, is_test, review_metadata_json, updated_at
        ) VALUES (
          :brand, :model_name, :domestic_model_number, :released_on_kr, :os, :chipset,
          :screen_inches, :refresh_hz, :battery_mah, :weight_g, :supports_5g, :wireless_charging,
          :source_name, :source_url, :official_product_url, :details_json,
          'pending', 0, 0, :review_metadata_json, CURRENT_TIMESTAMP(3)
        )`,
        {
          replacements: {
            brand: candidate.brand,
            model_name: candidate.model_name,
            domestic_model_number: candidate.domestic_model_number,
            released_on_kr: candidate.released_on_kr || mPayload.released_on_kr || null,
            os: candidate.specs?.os || mPayload.os || null,
            chipset: candidate.specs?.chipset || mPayload.chipset || null,
            screen_inches: candidate.specs?.screen_inches ?? mPayload.screen_inches ?? null,
            refresh_hz: candidate.specs?.refresh_hz ?? mPayload.refresh_hz ?? null,
            battery_mah: candidate.specs?.battery_mah ?? mPayload.battery_mah ?? null,
            weight_g: candidate.specs?.weight_g ?? mPayload.weight_g ?? null,
            supports_5g: (candidate.specs?.supports_5g ?? mPayload.supports_5g) ? 1 : 0,
            wireless_charging: (candidate.specs?.wireless_charging ?? mPayload.wireless_charging) ? 1 : 0,
            source_name: mPayload.source_name || candidate.source_name || '제조사 공식',
            source_url: mPayload.source_url || candidate.official_sources?.[0] || null,
            official_product_url:
              mPayload.official_product_url ||
              candidate.official_sources?.[1] ||
              candidate.official_sources?.[0] ||
              null,
            details_json: JSON.stringify(mPayload.details_json || candidate.details_json || {}),
            review_metadata_json: JSON.stringify({
              registered_by: { id: String(adminUser.id), email: adminUser.email },
              registered_at: nowIso,
              candidate_id: candidate.candidate_id,
              phase: 'phase_4_admin_registration',
            }),
          },
          transaction: t,
        }
      );

      const [lastIdRows] = await db.query('SELECT LAST_INSERT_ID() AS last_id', { transaction: t });
      insertedId = Number(lastIdRows[0].last_id);

      if (simulateError) {
        throw new Error('SIMULATED_TRANSACTION_FAILURE');
      }

      // Initial variants linked to newly created parent model
      const variantsToInsert = Array.isArray(candidate.phase3_payload?.variants) && candidate.phase3_payload.variants.length > 0
        ? candidate.phase3_payload.variants
        : candidate.storage_gb
          ? [
              {
                storage_gb: candidate.storage_gb,
                ram_gb: candidate.ram_gb,
                color: candidate.color || 'unspecified',
                launch_price_krw: candidate.launch_price_krw || null,
                launch_price_metadata_json: candidate.launch_price_krw
                  ? { sku: candidate.sku_example, source: candidate.official_sources?.[0] }
                  : null,
                source_name: mPayload.source_name || '제조사 공식',
                source_url: mPayload.source_url || candidate.official_sources?.[0] || null,
              },
            ]
          : [];

      for (const vp of variantsToInsert) {
        const launchPrice = vp.launch_price_krw || null;
        const launchMeta = launchPrice
          ? JSON.stringify(
              vp.launch_price_metadata_json || {
                currency: 'KRW',
                price_type: 'official_kr_launch',
                source_url: vp.source_url,
                sku: candidate.sku_example || null,
              }
            )
          : null;

        await db.query(
          `INSERT INTO smartphone_variants (
            smartphone_id, storage_gb, ram_gb, color,
            launch_price_krw, launch_price_metadata_json,
            source_name, source_url, verified, review_status, review_metadata_json, updated_at
          ) VALUES (
            :smartphone_id, :storage_gb, :ram_gb, :color,
            :launch_price_krw, :launch_price_metadata_json,
            :source_name, :source_url, 0, 'pending', :review_metadata_json, CURRENT_TIMESTAMP(3)
          )`,
          {
            replacements: {
              smartphone_id: insertedId,
              storage_gb: Number(vp.storage_gb),
              ram_gb: vp.ram_gb ? Number(vp.ram_gb) : null,
              color: vp.color || 'unspecified',
              launch_price_krw: launchPrice,
              launch_price_metadata_json: launchMeta,
              source_name: vp.source_name || '제조사 공식',
              source_url: vp.source_url || candidate.official_sources?.[0] || null,
              review_metadata_json: JSON.stringify({
                registered_by: { id: String(adminUser.id), email: adminUser.email },
                registered_at: nowIso,
                candidate_id: candidate.candidate_id,
                parent_smartphone_id: insertedId,
                phase: 'phase_4_admin_registration',
              }),
            },
            transaction: t,
          }
        );
      }
    } else if (candidate.candidate_kind === 'new_variant') {
      targetTable = 'smartphone_variants';
      const vPayload = candidate.phase3_payload?.variant || {};
      const launchPrice = candidate.launch_price_krw || vPayload.launch_price_krw || null;
      const launchMeta = launchPrice
        ? JSON.stringify(
            vPayload.launch_price_metadata_json || {
              currency: 'KRW',
              price_type: 'official_kr_launch',
              source_url: candidate.official_sources?.[0] || null,
              sku: candidate.sku_example || null,
            }
          )
        : null;

      if (simulateError) {
        throw new Error('SIMULATED_TRANSACTION_FAILURE');
      }

      await db.query(
        `INSERT INTO smartphone_variants (
          smartphone_id, storage_gb, ram_gb, color,
          launch_price_krw, launch_price_metadata_json,
          source_name, source_url, verified, review_status, review_metadata_json, updated_at
        ) VALUES (
          :smartphone_id, :storage_gb, :ram_gb, :color,
          :launch_price_krw, :launch_price_metadata_json,
          :source_name, :source_url, 0, 'pending', :review_metadata_json, CURRENT_TIMESTAMP(3)
        )`,
        {
          replacements: {
            smartphone_id: Number(candidate.target_smartphone_id),
            storage_gb: Number(candidate.storage_gb),
            ram_gb: candidate.ram_gb ? Number(candidate.ram_gb) : null,
            color: candidate.color || 'unspecified',
            launch_price_krw: launchPrice,
            launch_price_metadata_json: launchMeta,
            source_name: vPayload.source_name || candidate.source_name || '제조사 공식',
            source_url: candidate.official_sources?.[0] || null,
            review_metadata_json: JSON.stringify({
              registered_by: { id: String(adminUser.id), email: adminUser.email },
              registered_at: nowIso,
              candidate_id: candidate.candidate_id,
              target_smartphone_id: candidate.target_smartphone_id,
              phase: 'phase_4_admin_registration',
            }),
          },
          transaction: t,
        }
      );

      const [lastIdRows] = await db.query('SELECT LAST_INSERT_ID() AS last_id', { transaction: t });
      insertedId = Number(lastIdRows[0].last_id);
    } else {
      throw createRegistrationError(400, 'UNSUPPORTED_CANDIDATE_KIND', `지원되지 않는 후보 유형입니다: ${candidate.candidate_kind}`);
    }

    return {
      already_registered: false,
      target_table: targetTable,
      inserted_id: insertedId,
      registered_at: nowIso,
    };
  });

  // Record audit history & registration state in review store
  const historyEntry = {
    history_id: `reg_${Date.now()}_${(candidate.admin_review?.history?.length || 0) + 1}`,
    action: 'register',
    target_table: regResult.target_table,
    inserted_id: regResult.inserted_id,
    actor_user_id: String(adminUser.id),
    actor_email: adminUser.email,
    registered_at: regResult.registered_at,
    status: 'success',
    already_registered: Boolean(regResult.already_registered),
  };

  const registrationInfo = {
    status: 'registered',
    target_table: regResult.target_table,
    inserted_id: regResult.inserted_id,
    registered_at: regResult.registered_at,
    registered_by: {
      id: String(adminUser.id),
      email: adminUser.email,
    },
  };

  let updatedCandidate = candidate;
  if (reviewStore && typeof reviewStore.recordCandidateRegistration === 'function') {
    const recordResult = await reviewStore.recordCandidateRegistration({
      candidateId: candidate.candidate_id,
      registration: registrationInfo,
      historyEntry,
    });
    updatedCandidate = recordResult.candidate || updatedCandidate;
  }

  return {
    success: true,
    already_registered: Boolean(regResult.already_registered),
    candidate_id: candidate.candidate_id,
    target_table: regResult.target_table,
    inserted_id: regResult.inserted_id,
    registered_at: regResult.registered_at,
    registration: registrationInfo,
    candidate: updatedCandidate,
  };
}

module.exports = {
  evaluateRegistrationReadiness,
  validateCandidateForRegistration,
  checkRegistrationDuplicate,
  registerApprovedCandidate,
};
