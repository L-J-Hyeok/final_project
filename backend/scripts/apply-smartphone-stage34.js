'use strict';
// Explicit reviewed field patch; dry-run by default. Never creates/deletes rows or changes IDs.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { QueryTypes } = require('sequelize');
const connection = require('../db/connection');
const allowed = {
  smartphones: new Set(['review_metadata_json', 'weight_g', 'details_json']),
  smartphone_variants: new Set(['review_metadata_json', 'color', 'verified', 'review_status'])
};
function canonical(v) {
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));
  return v;
}
const normalize = v => JSON.stringify(canonical(v));
async function run({ planPath, backupPath, apply = false }) {
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  for (const change of plan.changes) {
    assert(allowed[change.table], 'INVALID_TABLE');
    assert(/^\d+$/.test(String(change.id)), 'INVALID_ID');
    for (const field of Object.keys(change.fields)) assert(allowed[change.table].has(field), 'INVALID_FIELD');
  }
  const db = connection.getDatabase();
  assert(db.config.database === 'final_project' && ['localhost','127.0.0.1','::1'].includes(db.config.host), 'LOCAL_PROJECT_DB_REQUIRED');
  try {
    return await db.transaction(async transaction => {
      const select = sql => db.query(sql, {type:QueryTypes.SELECT, transaction, logging:false});
      const before = {};
      for (const table of Object.keys(allowed)) before[table] = await select(`SELECT * FROM ${table} ORDER BY id FOR UPDATE`);
      before.price_observations = await select('SELECT * FROM price_observations ORDER BY id');
      for (const c of plan.changes) {
        const row = before[c.table].find(r=>String(r.id)===String(c.id));
        assert(row, 'ROW_MISSING');
        for (const [field, values] of Object.entries(c.fields)) assert.equal(normalize(row[field]), normalize(values.before), 'CONCURRENT_CHANGE_DETECTED');
      }
      if (!apply) return {dry_run:true,changes:plan.changes.length};
      assert(backupPath, 'BACKUP_PATH_REQUIRED');
      fs.writeFileSync(backupPath, JSON.stringify({created_at:new Date().toISOString(), before, changes:plan.changes},null,2), {mode:0o600,flag:'wx'});
      assert.deepEqual(JSON.parse(fs.readFileSync(backupPath,'utf8')).before, JSON.parse(JSON.stringify(before)), 'BACKUP_INVALID');
      for (const c of plan.changes) {
        const replacements={id:c.id};
        const assignments=Object.entries(c.fields).map(([field,values],i)=>{
          replacements['v'+i] = field.endsWith('_json') ? JSON.stringify(values.after) : values.after;
          return `\`${field}\`=:v${i}`;
        });
        await db.query(`UPDATE ${c.table} SET ${assignments.join(',')} WHERE id=:id`,{replacements,transaction,logging:false});
      }
      for (const table of Object.keys(allowed)) {
        const after=await select(`SELECT * FROM ${table} ORDER BY id`);
        assert.deepEqual(after.map(r=>r.id),before[table].map(r=>r.id),'ID_CHANGED');
        for(const row of after){const old=before[table].find(r=>r.id===row.id);const patch=plan.changes.find(c=>c.table===table&&String(c.id)===String(row.id));
          for(const field of Object.keys(row)) {
            if(field==='updated_at')continue;
            assert.equal(normalize(row[field]),normalize(patch && Object.hasOwn(patch.fields, field) ? patch.fields[field].after : old[field]),'UNEXPECTED_FIELD_CHANGE:'+table+':'+row.id+':'+field);
          }
        }
      }
      assert.deepEqual(await select('SELECT * FROM price_observations ORDER BY id'),before.price_observations,'PRICE_CHANGED');
      assert.equal(Number((await select('SELECT COUNT(*) AS n FROM smartphone_variants v LEFT JOIN smartphones s ON s.id=v.smartphone_id WHERE s.id IS NULL'))[0].n),0);
      assert.equal(Number((await select('SELECT COUNT(*) AS n FROM price_observations p LEFT JOIN smartphone_variants v ON v.id=p.variant_id WHERE v.id IS NULL'))[0].n),0);
      assert.equal((await select('SELECT smartphone_id,storage_gb,COALESCE(ram_gb,0),color FROM smartphone_variants GROUP BY smartphone_id,storage_gb,COALESCE(ram_gb,0),color HAVING COUNT(*)>1')).length,0);
      return {applied:true,models:before.smartphones.length,variants:before.smartphone_variants.length,prices:before.price_observations.length,changed_rows:plan.changes.length};
    });
  } finally { await connection.close(); }
}
if(require.main===module)run({planPath:process.argv[2],backupPath:process.argv[3],apply:process.argv.includes('--apply')}).then(r=>console.log(JSON.stringify(r))).catch(()=>{console.error('STAGE34_ABORTED_NO_SECRET_LOGGING');process.exitCode=1;});
module.exports={run};
