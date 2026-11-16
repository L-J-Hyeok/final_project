'use strict';
const validation = require('../services/catalog-validation');

module.exports = function defineCatalogModels(db, D) {
  const column = (type, allowNull = false, extra = {}) => ({ type, allowNull, ...extra });
  const str = (length, nullable) => column(D.STRING(length), nullable);
  const big = nullable => column(D.BIGINT.UNSIGNED, nullable);
  const id = () => column(D.BIGINT.UNSIGNED, false, { primaryKey: true, autoIncrement: true });
  const date = nullable => column(D.DATE(3), nullable);
  const enumeration = (values, fallback) => column(D.ENUM(...values), false, { defaultValue: fallback });
  const source = () => ({
    source_name: str(120), source_url: str(2048), verified_at: date(true),
    publication_status: enumeration(['private', 'public'], 'private'),
    verification_status: enumeration(['pending', 'verified', 'rejected'], 'pending'),
    sale_status: enumeration(['unknown', 'on_sale', 'discontinued'], 'unknown')
  });
  const define = (name, fields, beforeValidate) => db.define(name, fields, {
    tableName: name, freezeTableName: true, timestamps: false,
    ...(beforeValidate ? { hooks: { beforeValidate } } : {})
  });
  const Category = define('catalog_categories', {
    code: column(D.STRING(16), false, { primaryKey: true }), label: str(40), sort_order: column(D.TINYINT.UNSIGNED)
  });
  const Model = define('catalog_models', {
    id: id(), category_code: str(16), brand: str(80), model_name: str(120), model_number: str(80),
    released_on: column(D.DATEONLY, true), weight_g: column(D.DECIMAL(9, 2), true),
    official_product_url: str(2048, true), specs_json: column(D.JSON),
    is_test: column(D.BOOLEAN, false, { defaultValue: false }), ...source()
  }, validation.validateModel);
  const Group = define('catalog_price_groups', {
    id: id(), model_id: big(), category_code: str(16), configuration_json: column(D.JSON),
    configuration_key: str(64), evidence_url: str(2048)
  }, row => { row.configuration_key = validation.validateGroup(row); });
  const Sku = define('catalog_skus', {
    id: id(), model_id: big(), category_code: str(16), sku_code: str(100), manufacturer_part_number: str(100, true),
    storage_gb: column(D.INTEGER.UNSIGNED, true), ram_gb: column(D.INTEGER.UNSIGNED, true),
    color: str(80, true), connectivity: str(24, true), options_json: column(D.JSON), ...source(),
    price_group_id: big(true), configuration_key: str(64, true)
  }, row => { row.configuration_key = validation.validateSku(row); });
  const Price = define('catalog_price_observations', {
    id: id(), model_id: big(), sku_id: big(true), price_group_id: big(true), seller_name: str(120),
    amount_minor: big(), currency: column(D.CHAR(3), false, { defaultValue: 'KRW' }),
    product_url: str(2048), observed_at: date(), checked_at: date(), status: enumeration(['normal', 'invalid'], 'normal')
  }, validation.validatePrice);
  const Event = define('catalog_admin_events', {
    id: id(), actor_user_id: big(true), model_id: big(), sku_id: big(true), action: str(40),
    changes_json: column(D.JSON), created_at: column(D.DATE(3), false, { defaultValue: D.NOW })
  });
  // Read associations only. Composite relationships are declared in migration 007.
  Model.belongsTo(Category, { foreignKey: 'category_code', constraints: false });
  for (const entity of [Group, Sku, Price, Event]) entity.belongsTo(Model, { foreignKey: 'model_id', constraints: false });
  Sku.belongsTo(Group, { foreignKey: 'price_group_id', constraints: false });
  Price.belongsTo(Sku, { foreignKey: 'sku_id', constraints: false });
  Price.belongsTo(Group, { foreignKey: 'price_group_id', constraints: false });
  Event.belongsTo(db.models.users, { foreignKey: 'actor_user_id', constraints: false });
};
