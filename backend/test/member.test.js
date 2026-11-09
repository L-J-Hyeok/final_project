'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),v=require('../services/member-validation');
const valid={expected_version:1,common:{usages:['work'],spending_style:'value'},smartphone:{}};
test('profile optional defaults and strict permanent fields',()=>{
 const x=v.profile(valid);assert.equal(x.common_json.mobility,null);assert.deepEqual(x.smartphone_json.preferred_brands,[]);assert.equal(x.smartphone_json.preferred_os,null);
 for(const body of [{...valid,raw_text:'private draft'},{...valid,common:{...valid.common,budget_max_krw:100}},{...valid,common:{}},{...valid,smartphone:{priorities:['camera','camera']}},{...valid,expected_version:'1'}])assert.throws(()=>v.profile(body),{code:'INVALID_INPUT'});
});
test('manual specifications are bounded and category-specific',()=>{
 const ram={category:'ram',manual_brand:'test',manual_model_name:'kit',manual_specs_json:{capacity_gb:32,module_count:2}};
 assert.equal(v.device(ram).manual_storage_gb,null);
 for(const x of [{...ram,manual_storage_gb:32},{...ram,manual_specs_json:{vram_gb:8}},{...ram,manual_specs_json:{capacity_gb:'32'}},{...ram,manual_specs_json:{capacity_gb:{x:1}}},{...ram,manual_specs_json:[]},{...ram,variant_id:'1'}])assert.throws(()=>v.device(x));
 const catalog=v.device({variant_id:'1'});assert.equal(catalog.manual_specs_json,null);assert.equal(catalog.category,'smartphone');
 assert.throws(()=>v.id('18446744073709551616'));assert.throws(()=>v.id(1));
});
test('all documented categories accept minimal manual records',()=>{
 for(const category of ['smartphone','laptop','tablet','watch','monitor','pc','cpu','gpu','ram','ssd','motherboard','psu','case','cooler','other'])assert.equal(v.device({category,manual_brand:'test',manual_model_name:'test'}).category,category);
});
test('nullable model specifications may be omitted; required/positive rules remain',async()=>{
 const {Sequelize,DataTypes}=require('sequelize');const db=new Sequelize('unused','unused','unused',{dialect:'mysql',logging:false});
 try{const m=require('../db/models')(db,DataTypes);await m.smartphones.build({brand:'test',model_name:'test'}).validate();await assert.rejects(m.smartphones.build({brand:'test',model_name:'test',weight_g:0}).validate());await assert.rejects(m.smartphone_variants.build({smartphone_id:'1'}).validate());}finally{await db.close();}
});
