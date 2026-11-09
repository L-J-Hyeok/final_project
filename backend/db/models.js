'use strict';

// 스키마 생성은 SQL 마이그레이션 전용. 여기서는 기존 8테이블에 매핑한다.
module.exports = function defineModels(sequelize, D) {
  function col(type, nullable, extra) {
    return Object.assign({ type: type, allowNull: Boolean(nullable) }, extra || {});
  }
  function id() { return col(D.BIGINT.UNSIGNED, false, { primaryKey: true, autoIncrement: true }); }
  function fk(table, nullable, onDelete) {
    return col(D.BIGINT.UNSIGNED, nullable, { references: { model: table, key: 'id' }, onDelete: onDelete, onUpdate: 'RESTRICT' });
  }
  function text(n, nullable) { return col(D.STRING(n), nullable); }
  function date(nullable) { return col(D.DATE(3), nullable); }
  function created() { return col(D.DATE(3), false, { defaultValue: D.NOW }); }
  function positive(type, nullable) {
    return col(type, nullable, { validate: { isPositive: function (value) {
      if (value != null && !(Number(value) > 0)) throw new Error('POSITIVE_VALUE_REQUIRED');
    } } });
  }
  function model(name, fields, indexes) {
    return sequelize.define(name, fields, {
      tableName: name, timestamps: false, freezeTableName: true,
      indexes: indexes || []
    });
  }
  var users = model('users', {
    id: id(), email: text(254), password_hash: text(512), created_at: created()
  }, [{ unique: true, fields: ['email'] }]);
  var sessions = model('sessions', {
    // SQL BINARY(32)를 Buffer로 매핑한다. sync로 타입을 바꾸지 않는다.
    sid_hash: col(D.BLOB, false, { primaryKey: true, validate: {
      isDigest: function (value) {
        if (!Buffer.isBuffer(value) || value.length !== 32) throw new Error('INVALID_SESSION_DIGEST');
      }
    } }),
    user_id: fk('users', true, 'CASCADE'), data: col(D.JSON), expires_at: date()
  }, [{ fields: ['expires_at'] }, { fields: ['user_id'] }]);
  var profiles = model('profiles', {
    user_id: Object.assign(fk('users', false, 'CASCADE'), { primaryKey: true }),
    common_json: col(D.JSON), smartphone_json: col(D.JSON),
    version: col(D.INTEGER.UNSIGNED, false, { defaultValue: 1, validate: { min: 1 } }),
    confirmed_at: date(true), updated_at: created()
  });
  var smartphones = model('smartphones', {
    id: id(), brand: text(80), model_name: text(120), domestic_model_number: text(80, true),
    released_on_kr: col(D.DATEONLY, true), os: col(D.STRING(16), true, { validate: { isIn: [['android', 'ios', 'other']] } }),
    chipset: text(120, true), screen_inches: positive(D.DECIMAL(4, 2), true),
    refresh_hz: positive(D.SMALLINT, true), battery_mah: positive(D.INTEGER, true),
    weight_g: positive(D.DECIMAL(6, 2), true), supports_5g: col(D.BOOLEAN, true),
    wireless_charging: col(D.BOOLEAN, true), source_name: text(120, true), source_url: text(2048, true),
    verified_at: date(true), verified: col(D.BOOLEAN, false, { defaultValue: false }),
    is_test: col(D.BOOLEAN, false, { defaultValue: true }), updated_at: created()
  }, [{ unique: true, fields: ['brand', 'domestic_model_number'] }, { fields: ['brand', 'released_on_kr'] }]);
  var variants = model('smartphone_variants', {
    id: id(), smartphone_id: fk('smartphones', false, 'RESTRICT'),
    storage_gb: positive(D.INTEGER), ram_gb: positive(D.INTEGER, true),
    color: col(D.STRING(40), false, { defaultValue: 'unspecified' }),
    source_name: text(120, true), source_url: text(2048, true), verified_at: date(true),
    verified: col(D.BOOLEAN, false, { defaultValue: false }), updated_at: created()
  }, [{ unique: true, fields: ['smartphone_id', 'storage_gb', 'color'] }]);
  var prices = model('price_observations', {
    id: id(), variant_id: fk('smartphone_variants', false, 'RESTRICT'),
    source_name: text(120), source_url: text(2048), seller_name: text(120),
    amount_krw: positive(D.INTEGER.UNSIGNED),
    shipping_krw: col(D.INTEGER.UNSIGNED, true, { validate: { min: 0 } }),
    observed_at: date(), expires_at: date(), conditions_text: text(500),
    unconditional: col(D.BOOLEAN), in_stock: col(D.BOOLEAN), is_new: col(D.BOOLEAN), is_unlocked: col(D.BOOLEAN)
  }, [{ fields: ['variant_id', 'source_name', 'seller_name', 'observed_at', 'id'] }]);
  var owned = model('owned_devices', {
    id: id(), user_id: fk('users', false, 'CASCADE'),
    variant_id: fk('smartphone_variants', true, 'RESTRICT'), category: col(D.STRING(16), false, {
      validate: { isIn: [['smartphone','laptop','tablet','watch','monitor','pc','cpu','gpu','ram','ssd','motherboard','psu','case','cooler','other']] }
    }),
    manual_brand: text(80, true), manual_model_name: text(120, true), manual_model_number: text(80, true),
    manual_storage_gb: positive(D.INTEGER, true), manual_specs_json: col(D.JSON, true),
    created_at: created(), updated_at: created()
  }, [{ fields: ['user_id'] }]);
  var recommendations = model('recommendations', {
    id: id(), user_id: fk('users', false, 'CASCADE'), status: col(D.STRING(16), false, {
      validate: { isIn: [['processing','recommend','clarify','keep','defer','no_match','failed']] }
    }),
    profile_version: col(D.INTEGER), input_snapshot: col(D.JSON), candidates_snapshot: col(D.JSON),
    result_json: col(D.JSON, true), validation_errors: col(D.JSON, true), model_name: text(120, true),
    prompt_version: text(40), as_of: date(), created_at: created()
  }, [{ fields: ['user_id', 'created_at', 'id'] }]);
  // 이미 정의한 FK만 연결한다. 추가 컬럼이나 중간 테이블을 생성하지 않는다.
  sessions.belongsTo(users, { foreignKey: 'user_id', onDelete: 'CASCADE' });
  profiles.belongsTo(users, { foreignKey: 'user_id', onDelete: 'CASCADE' });
  variants.belongsTo(smartphones, { foreignKey: 'smartphone_id', onDelete: 'RESTRICT' });
  prices.belongsTo(variants, { foreignKey: 'variant_id', onDelete: 'RESTRICT' });
  owned.belongsTo(users, { foreignKey: 'user_id', onDelete: 'CASCADE' });
  owned.belongsTo(variants, { foreignKey: 'variant_id', onDelete: 'RESTRICT' });
  recommendations.belongsTo(users, { foreignKey: 'user_id', onDelete: 'CASCADE' });
  return sequelize.models;
};
