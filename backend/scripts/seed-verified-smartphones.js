'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const connection = require('../db/connection');
const { validateNormalizedDataset } = require('./validate-normalized-smartphones');

const DEFAULT_JSON_PATH = path.resolve(__dirname, '../data/normalized-smartphones.json');

function normalizeBrand(b) {
  return String(b || '').trim().toLowerCase();
}

function normalizeDecimal(val) {
  if (val === null || val === undefined) return null;
  return Number(Number(val).toFixed(2));
}

function normalizeBool(val) {
  if (val === null || val === undefined) return null;
  return Boolean(val);
}

function normalizeIsoTime(val) {
  if (!val) return null;
  return new Date(val).toISOString();
}

function diffSmartphoneRow(existing, target) {
  const diffs = [];
  const compare = (field, a, b) => {
    if (a !== b) diffs.push({ field, existing: a, target: b });
  };
  compare('brand', normalizeBrand(existing.brand), normalizeBrand(target.brand));
  compare('model_name', existing.model_name, target.model_name);
  compare('domestic_model_number', existing.domestic_model_number, target.domestic_model_number);
  compare('released_on_kr', existing.released_on_kr, target.released_on_kr);
  compare('os', existing.os, target.os);
  compare('chipset', existing.chipset, target.chipset);
  compare('screen_inches', normalizeDecimal(existing.screen_inches), normalizeDecimal(target.screen_inches));
  compare('refresh_hz', existing.refresh_hz === null ? null : Number(existing.refresh_hz), target.refresh_hz);
  compare('battery_mah', existing.battery_mah === null ? null : Number(existing.battery_mah), target.battery_mah);
  compare('weight_g', normalizeDecimal(existing.weight_g), normalizeDecimal(target.weight_g));
  compare('supports_5g', normalizeBool(existing.supports_5g), normalizeBool(target.supports_5g));
  compare('wireless_charging', normalizeBool(existing.wireless_charging), normalizeBool(target.wireless_charging));
  compare('source_name', existing.source_name, target.source_name);
  compare('source_url', existing.source_url, target.source_url);
  compare('verified_at', normalizeIsoTime(existing.verified_at), normalizeIsoTime(target.verified_at));
  compare('verified', Boolean(existing.verified), Boolean(target.verified));
  compare('is_test', Boolean(existing.is_test), Boolean(target.is_test));
  return diffs;
}

function diffVariantRow(existing, target) {
  const diffs = [];
  const compare = (field, a, b) => {
    if (a !== b) diffs.push({ field, existing: a, target: b });
  };
  compare('storage_gb', Number(existing.storage_gb), Number(target.storage_gb));
  compare('ram_gb', existing.ram_gb === null ? null : Number(existing.ram_gb), target.ram_gb);
  compare('color', existing.color, target.color || 'unspecified');
  compare('source_name', existing.source_name, target.source_name);
  compare('source_url', existing.source_url, target.source_url);
  compare('verified_at', normalizeIsoTime(existing.verified_at), normalizeIsoTime(target.verified_at));
  compare('verified', Boolean(existing.verified), Boolean(target.verified));
  return diffs;
}

async function runSeedVerifiedSmartphones({ apply = false, jsonPath = DEFAULT_JSON_PATH } = {}) {
  // 1. Offline validation first
  const dataset = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const validation = validateNormalizedDataset(dataset);
  if (!validation.passed) {
    throw new Error('Offline validation failed: ' + validation.errors.join('; '));
  }

  // 2. Filter strictly to verified_ready (16 models, 29 variants)
  const verifiedModels = dataset.smartphones.filter(
    (s) => s.verified === true && s.audit_metadata?.migration_tier === 'verified_ready'
  );
  const verifiedModelKeySet = new Set(verifiedModels.map((s) => s.smartphone_key));
  const verifiedVariants = dataset.smartphone_variants.filter(
    (v) => v.verified === true && verifiedModelKeySet.has(v.smartphone_key)
  );

  assert.equal(verifiedModels.length, 16, `Expected 16 verified_ready models, got ${verifiedModels.length}`);
  assert.equal(verifiedVariants.length, 29, `Expected 29 verified_ready variants, got ${verifiedVariants.length}`);

  const db = await connection.connect();
  const m = db.models;

  try {
    // 3. Snapshot non-target table row counts to verify zero unintended side effects
    const beforeProtectedCounts = {
      users: await m.users.count(),
      profiles: await m.profiles.count(),
      owned_devices: await m.owned_devices.count(),
      recommendations: await m.recommendations.count(),
      price_observations: await m.price_observations.count()
    };

    const existingPhones = await m.smartphones.findAll({ raw: true });
    const existingVariants = await m.smartphone_variants.findAll({ raw: true });

    const existingPhoneByUniqueKey = new Map();
    const existingPhoneByModelNameKey = new Map();
    for (const row of existingPhones) {
      const uqKey = `${normalizeBrand(row.brand)}||${row.domestic_model_number || ''}`;
      existingPhoneByUniqueKey.set(uqKey, row);
      const nameKey = `${normalizeBrand(row.brand)}||${String(row.model_name || '').trim().toLowerCase()}`;
      existingPhoneByModelNameKey.set(nameKey, row);
    }

    const existingVariantByUniqueKey = new Map();
    for (const row of existingVariants) {
      const uqVarKey = `${row.smartphone_id}||${Number(row.storage_gb)}||${row.color}`;
      existingVariantByUniqueKey.set(uqVarKey, row);
    }

    const plan = {
      mode: apply ? 'APPLY' : 'DRY_RUN',
      existing_db_counts: {
        smartphones: existingPhones.length,
        smartphone_variants: existingVariants.length,
        ...beforeProtectedCounts
      },
      smartphones: {
        to_insert: [],
        to_update: [],
        unchanged: [],
        conflicts: []
      },
      smartphone_variants: {
        to_insert: [],
        to_update: [],
        unchanged: [],
        conflicts: []
      }
    };

    for (const s of verifiedModels) {
      const uqKey = `${normalizeBrand(s.brand)}||${s.domestic_model_number}`;
      const nameKey = `${normalizeBrand(s.brand)}||${s.model_name.trim().toLowerCase()}`;
      const existingByUq = existingPhoneByUniqueKey.get(uqKey);
      const existingByName = existingPhoneByModelNameKey.get(nameKey);

      if (existingByName && (!existingByUq || String(existingByName.id) !== String(existingByUq.id))) {
        plan.smartphones.conflicts.push({
          smartphone_key: s.smartphone_key,
          reason: 'Existing DB row has same brand+model_name but different domestic_model_number',
          existing_id: String(existingByName.id),
          existing_domestic_model_number: existingByName.domestic_model_number,
          target_domestic_model_number: s.domestic_model_number
        });
        continue;
      }

      if (!existingByUq) {
        plan.smartphones.to_insert.push({
          smartphone_key: s.smartphone_key,
          brand: s.brand,
          model_name: s.model_name,
          domestic_model_number: s.domestic_model_number,
          released_on_kr: s.released_on_kr,
          record: s
        });
      } else {
        const diffs = diffSmartphoneRow(existingByUq, s);
        if (diffs.length > 0) {
          plan.smartphones.to_update.push({
            id: String(existingByUq.id),
            smartphone_key: s.smartphone_key,
            domestic_model_number: s.domestic_model_number,
            diffs,
            record: s
          });
        } else {
          plan.smartphones.unchanged.push({
            id: String(existingByUq.id),
            smartphone_key: s.smartphone_key,
            domestic_model_number: s.domestic_model_number
          });
        }
      }
    }

    for (const v of verifiedVariants) {
      const parentModel = verifiedModels.find((s) => s.smartphone_key === v.smartphone_key);
      const uqPhoneKey = `${normalizeBrand(parentModel.brand)}||${parentModel.domestic_model_number}`;
      const existingParent = existingPhoneByUniqueKey.get(uqPhoneKey);

      if (!existingParent) {
        plan.smartphone_variants.to_insert.push({
          smartphone_key: v.smartphone_key,
          domestic_model_number: v.domestic_model_number,
          storage_gb: v.storage_gb,
          ram_gb: v.ram_gb,
          color: v.color || 'unspecified',
          record: v
        });
      } else {
        const uqVarKey = `${existingParent.id}||${Number(v.storage_gb)}||${v.color || 'unspecified'}`;
        const existingVar = existingVariantByUniqueKey.get(uqVarKey);
        if (!existingVar) {
          plan.smartphone_variants.to_insert.push({
            smartphone_id: String(existingParent.id),
            smartphone_key: v.smartphone_key,
            domestic_model_number: v.domestic_model_number,
            storage_gb: v.storage_gb,
            ram_gb: v.ram_gb,
            color: v.color || 'unspecified',
            record: v
          });
        } else {
          const diffs = diffVariantRow(existingVar, v);
          if (diffs.length > 0) {
            plan.smartphone_variants.to_update.push({
              id: String(existingVar.id),
              smartphone_id: String(existingParent.id),
              smartphone_key: v.smartphone_key,
              storage_gb: v.storage_gb,
              color: v.color || 'unspecified',
              diffs,
              record: v
            });
          } else {
            plan.smartphone_variants.unchanged.push({
              id: String(existingVar.id),
              smartphone_id: String(existingParent.id),
              smartphone_key: v.smartphone_key,
              storage_gb: v.storage_gb,
              color: v.color || 'unspecified'
            });
          }
        }
      }
    }

    if (plan.smartphones.conflicts.length > 0 || plan.smartphone_variants.conflicts.length > 0) {
      throw new Error('Conflict detected during upsert planning: ' + JSON.stringify({
        smartphone_conflicts: plan.smartphones.conflicts,
        variant_conflicts: plan.smartphone_variants.conflicts
      }));
    }

    if (apply) {
      await db.transaction(async (t) => {
        const phoneIdByKey = new Map();

        for (const item of plan.smartphones.unchanged) {
          phoneIdByKey.set(item.smartphone_key, item.id);
        }

        for (const item of plan.smartphones.to_insert) {
          const s = item.record;
          const created = await m.smartphones.create({
            brand: normalizeBrand(s.brand),
            model_name: s.model_name,
            domestic_model_number: s.domestic_model_number,
            released_on_kr: s.released_on_kr,
            os: s.os,
            chipset: s.chipset,
            screen_inches: s.screen_inches,
            refresh_hz: s.refresh_hz,
            battery_mah: s.battery_mah,
            weight_g: s.weight_g,
            supports_5g: s.supports_5g,
            wireless_charging: s.wireless_charging,
            source_name: s.source_name,
            source_url: s.source_url,
            verified_at: new Date(s.verified_at),
            verified: true,
            is_test: false
          }, { transaction: t });
          phoneIdByKey.set(s.smartphone_key, String(created.id));
        }

        for (const item of plan.smartphones.to_update) {
          const s = item.record;
          await m.smartphones.update({
            brand: normalizeBrand(s.brand),
            model_name: s.model_name,
            domestic_model_number: s.domestic_model_number,
            released_on_kr: s.released_on_kr,
            os: s.os,
            chipset: s.chipset,
            screen_inches: s.screen_inches,
            refresh_hz: s.refresh_hz,
            battery_mah: s.battery_mah,
            weight_g: s.weight_g,
            supports_5g: s.supports_5g,
            wireless_charging: s.wireless_charging,
            source_name: s.source_name,
            source_url: s.source_url,
            verified_at: new Date(s.verified_at),
            verified: true,
            is_test: false
          }, { where: { id: item.id }, transaction: t });
          phoneIdByKey.set(s.smartphone_key, item.id);
        }

        for (const item of plan.smartphone_variants.to_insert) {
          const v = item.record;
          const smartphoneId = phoneIdByKey.get(v.smartphone_key);
          assert.ok(smartphoneId, `Missing parent smartphone_id for ${v.smartphone_key}`);
          await m.smartphone_variants.create({
            smartphone_id: smartphoneId,
            storage_gb: v.storage_gb,
            ram_gb: v.ram_gb,
            color: v.color || 'unspecified',
            source_name: v.source_name,
            source_url: v.source_url,
            verified_at: new Date(v.verified_at),
            verified: true
          }, { transaction: t });
        }

        for (const item of plan.smartphone_variants.to_update) {
          const v = item.record;
          await m.smartphone_variants.update({
            ram_gb: v.ram_gb,
            color: v.color || 'unspecified',
            source_name: v.source_name,
            source_url: v.source_url,
            verified_at: new Date(v.verified_at),
            verified: true
          }, { where: { id: item.id }, transaction: t });
        }
      });
    }

    const afterProtectedCounts = {
      users: await m.users.count(),
      profiles: await m.profiles.count(),
      owned_devices: await m.owned_devices.count(),
      recommendations: await m.recommendations.count(),
      price_observations: await m.price_observations.count()
    };

    assert.deepEqual(
      afterProtectedCounts,
      beforeProtectedCounts,
      'Protected tables (users, profiles, owned_devices, recommendations, price_observations) must remain untouched'
    );

    const afterTargetCounts = {
      smartphones: await m.smartphones.count(),
      smartphone_variants: await m.smartphone_variants.count()
    };

    return {
      mode: plan.mode,
      existing_db_counts: plan.existing_db_counts,
      after_db_counts: {
        ...afterTargetCounts,
        ...afterProtectedCounts
      },
      summary: {
        smartphones: {
          to_insert: plan.smartphones.to_insert.length,
          to_update: plan.smartphones.to_update.length,
          unchanged: plan.smartphones.unchanged.length,
          conflicts: plan.smartphones.conflicts.length
        },
        smartphone_variants: {
          to_insert: plan.smartphone_variants.to_insert.length,
          to_update: plan.smartphone_variants.to_update.length,
          unchanged: plan.smartphone_variants.unchanged.length,
          conflicts: plan.smartphone_variants.conflicts.length
        },
        price_observations_inserted: 0
      },
      models_to_insert: plan.smartphones.to_insert.map((i) => ({
        smartphone_key: i.smartphone_key,
        brand: i.brand,
        model_name: i.model_name,
        domestic_model_number: i.domestic_model_number,
        released_on_kr: i.released_on_kr
      })),
      models_to_update: plan.smartphones.to_update.map((i) => ({
        id: i.id,
        smartphone_key: i.smartphone_key,
        domestic_model_number: i.domestic_model_number,
        diffs: i.diffs
      }))
    };
  } finally {
    await connection.close().catch(() => {});
  }
}

if (require.main === module) {
  const apply = process.argv.includes('--apply');
  runSeedVerifiedSmartphones({ apply })
    .then((report) => {
      console.log(`[${report.mode}_OK] Verified smartphone upsert check completed.`);
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((err) => {
      console.error('[SEED_ERROR]', err.message || err);
      process.exitCode = 1;
    });
}

module.exports = {
  runSeedVerifiedSmartphones
};
