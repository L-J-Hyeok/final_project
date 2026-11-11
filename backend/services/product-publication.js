'use strict';
const { QueryTypes } = require('sequelize');
// No cache: a schema transition must never leave a stale permissive predicate.
async function columns(db, transaction) {
  return db.query("SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('smartphones','smartphone_variants') AND COLUMN_NAME='review_status'", { type: QueryTypes.SELECT, transaction });
}
function predicate(rows, variants = true) {
  const tables = new Set(rows.map(r => r.table_name));
  const clauses = ['s.verified = 1', 's.is_test = 0'];
  if (tables.has('smartphones')) clauses.push("s.review_status IN ('legacy','approved')");
  if (variants) {
    clauses.push('v.verified = 1');
    if (tables.has('smartphone_variants')) clauses.push("v.review_status IN ('legacy','approved')");
  }
  return '(' + clauses.join(' AND ') + ')';
}
async function sql(db, { variants = true, transaction } = {}) {
  return predicate(await columns(db, transaction), variants);
}
function isPublic(row, { hasReviewStatus = false } = {}) {
  return (row.verified === true || row.verified === 1) && (!hasReviewStatus || ['legacy','approved'].includes(row.review_status));
}
module.exports = { sql, predicate, isPublic };
