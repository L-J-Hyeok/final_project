'use strict';
// Read-only file plan. No database imports or execution mode.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const prep=require('./prepare-smartphone-upsert');
function run(args=process.argv.slice(2)){
 if(args.some(x=>x!=='--dry-run'))throw Error('WRITE_MODE_NOT_AVAILABLE');
 const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data',n),'utf8'));
 const review=read('smartphone-normalized-review-52.json'),base=read('normalized-smartphones.json');
 const inventory=prep.baselineInventory(base),seen=new Set(),models=[],held=[];
 for(const r of review.models){
  const v=r.current_schema_values;
  if(!v.domestic_model_number||!v.released_on_kr){held.push(r.key);continue;}
  const key=v.brand.toLowerCase()+':'+v.domestic_model_number.toUpperCase();assert.ok(!seen.has(key),'MODEL_DUPLICATE');seen.add(key);
  const old=inventory.models.find(x=>x.brand===v.brand&&x.domestic_model_number===v.domestic_model_number);
  const enrich={},differences=[];
  if(old)for(const [k,value]of Object.entries(v)){
   if(value===null)continue;
   if(old[k]===null)enrich[k]=value;
   else if(old[k]!==value)differences.push(k);
  }
  models.push({key:r.key,action:old?'preserve_existing':'new_model_candidate',existing_id:old?.id??null,existing_key:old?.key??null,values:old?null:{...v,verified:false,is_test:false},proposed_null_enrichment:enrich,review_differences:differences,public:false,approval_required:true,note:'No DML. verified=false does not itself prevent all existing API exposure. Pending models stay outside DB until publication policy is implemented.'});
 }
 assert.equal(models.length,44);assert.equal(held.length,8);assert.equal(models.filter(m=>m.action==='new_model_candidate').length,33);
 return {mode:'OFFLINE_DRY_RUN',models,held,summary:{identified:44,existing_preserved:11,new_model_candidates:33,held:8,baseline_preserved_models:16,baseline_preserved_variants:29,existing_outside_research:5,duplicate_models:0,known_value_difference_models:models.filter(m=>m.review_differences.length).length},exact_variant_plan:prep.run([]),db_writes:0,actual_ids_verified:false};
}
if(require.main===module){try{console.log(JSON.stringify(run(),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={run, executeTest: options => require('../db/test-smartphone-import').execute(options)};
