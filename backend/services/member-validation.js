'use strict';
function fail(code='INVALID_INPUT',status=422){return Object.assign(new Error(code),{code,status});}
function object(x,keys){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!keys.includes(k)))throw fail();}
function str(x,max,nullable=false){if(nullable&&(x===undefined||x===null))return null;if(typeof x!=='string'||!x.trim()||[...x.trim()].length>max)throw fail();return x.trim();}
function integer(x,max=1000000){if(!Number.isInteger(x)||x<1||x>max)throw fail();return x;}
function option(x,values){if(x===undefined||x===null)return null;if(!values.includes(x))throw fail();return x;}
function list(x,values,min,max){if(!Array.isArray(x)||x.length<min||x.length>max||new Set(x).size!==x.length||x.some(v=>!values.includes(v)))throw fail();return x;}
function id(x){if(typeof x!=='string'||! /^(?:[1-9][0-9]{0,19})$/.test(x)||BigInt(x)>18446744073709551615n)throw fail();return x;}
function version(x){return integer(x,4294967295);}
function profile(x){
 object(x,['expected_version','common','smartphone']);version(x.expected_version);
 object(x.common,['usages','spending_style','mobility','ecosystem','lifestyle_note']);
 object(x.smartphone,['preferred_brands','priorities','preferred_os','min_storage_gb']);
 const c=x.common,s=x.smartphone;
 if(!['value','balanced','premium'].includes(c.spending_style))throw fail();
 return {expected_version:x.expected_version,common_json:{usages:list(c.usages,['communication','video','coding','gaming','camera','work'],1,6),spending_style:c.spending_style,mobility:option(c.mobility,['low','medium','high']),ecosystem:option(c.ecosystem,['none','android','apple','mixed']),lifestyle_note:str(c.lifestyle_note,300,true)},smartphone_json:{preferred_brands:list(s.preferred_brands===undefined?[]:s.preferred_brands,['samsung','apple'],0,2),priorities:list(s.priorities===undefined?[]:s.priorities,['battery','camera','performance','portability','display'],0,3),preferred_os:option(s.preferred_os,['android','ios']),...(Object.hasOwn(s,'min_storage_gb')?{min_storage_gb:s.min_storage_gb==null?null:integer(s.min_storage_gb,4096)}:{})}};
}
const specKeys={
 smartphone:['ram_gb','processor_model','gpu_model','os_name'],
 laptop:['ram_gb','processor_model','gpu_model','os_name','screen_inches','refresh_hz','battery_wh','weight_g','storage_type','discrete_gpu','note'],
 tablet:['ram_gb','processor_model','gpu_model','os_name','screen_inches','refresh_hz','battery_mah','battery_wh','weight_g','pen_supported','keyboard_supported','connectivity','note'],
 pc:['ram_gb','processor_model','gpu_model','os_name'],
 cpu:['socket','cores'],
 gpu:['vram_gb','power_w'],
 ram:['capacity_gb','memory_standard','speed_mt_s','module_count'],
 ssd:['interface','form_factor'],
 motherboard:['socket','memory_standard','form_factor'],
 psu:['rated_power_w'],
 case:['form_factor'],
 cooler:['form_factor'],
 watch:['case_size_mm','connectivity','compatible_os','gps','water_resistance','battery_hours','battery_mah','weight_g','note'],
 smartwatch:['case_size_mm','connectivity','compatible_os','gps','water_resistance','battery_hours','battery_mah','weight_g','note'],
 earbuds:['anc','transparency_mode','multipoint','codecs','battery_hours','case_battery_hours','water_resistance','weight_g','connectivity','note'],
 speaker:['power_w','battery_hours','water_resistance','multipairing','weight_g','connectivity','audio_config','note'],
 monitor:['note'],
 other:['note']
};
const numeric=['ram_gb','cores','vram_gb','power_w','capacity_gb','speed_mt_s','module_count','rated_power_w','refresh_hz','battery_mah','case_size_mm'];
const floatKeys=['screen_inches','battery_wh','battery_hours','case_battery_hours','weight_g'];
const boolKeys=['pen_supported','keyboard_supported','discrete_gpu','gps','anc','transparency_mode','multipoint'];
const allowedPainPoints=['battery','camera','performance','portability','display','storage','price','os_ecosystem','pen','keyboard','ram','gpu','anc','codec','multipoint','water_resistance','gps','cellular','power'];
const allowedUsages=['communication','video','coding','gaming','camera','work'];
const catalogDeviceCategories=['tablet','laptop','smartwatch','earbuds','speaker','watch'];
const manualKeys=['category','manual_brand','manual_model_name','manual_model_number','manual_storage_gb','manual_specs_json','catalog_sku_id','catalog_model_id','purchase_price_krw','purchase_date','pain_points','usages','satisfied_aspects','replacement_intent'];

function toDbCategory(cat){
 if(cat==='watch')return 'smartwatch';
 return cat;
}

function parseMetaFields(x){
 const meta={};
 if(x.purchase_price_krw!==undefined&&x.purchase_price_krw!==null){
  meta.purchase_price_krw=integer(x.purchase_price_krw,20000000);
 }
 if(x.purchase_date!==undefined&&x.purchase_date!==null){
  if(typeof x.purchase_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x.purchase_date))throw fail();
  meta.purchase_date=x.purchase_date;
 }
 if(x.pain_points!==undefined&&x.pain_points!==null){
  meta.pain_points=list(x.pain_points,allowedPainPoints,0,8);
 }
 if(x.usages!==undefined&&x.usages!==null){
  meta.usages=list(x.usages,allowedUsages,0,6);
 }
 if(x.satisfied_aspects!==undefined&&x.satisfied_aspects!==null){
  meta.satisfied_aspects=list(x.satisfied_aspects,allowedPainPoints,0,8);
 }
 if(x.replacement_intent!==undefined&&x.replacement_intent!==null){
  if(!['high','moderate','low_or_keep_if_okay'].includes(x.replacement_intent))throw fail();
  meta.replacement_intent=x.replacement_intent;
 }
 return meta;
}

function device(x){
 object(x,['variant_id',...manualKeys]);
 const blank={manual_brand:null,manual_model_name:null,manual_model_number:null,manual_storage_gb:null,manual_specs_json:null};
 if(Object.hasOwn(x,'variant_id')&&x.variant_id!==undefined&&x.variant_id!==null){
  if(Object.keys(x).some(k=>k!=='variant_id'&&x[k]!==undefined&&x[k]!==null))throw fail();
  return {...blank,variant_id:id(x.variant_id),category:'smartphone'};
 }
 const hasCatalogSku=x.catalog_sku_id!==undefined&&x.catalog_sku_id!==null;
 const hasCatalogModel=x.catalog_model_id!==undefined&&x.catalog_model_id!==null;
 const meta=parseMetaFields(x);
 if(hasCatalogSku||hasCatalogModel){
  let reqCat=null;
  if(x.category!==undefined&&x.category!==null){
   if(!catalogDeviceCategories.includes(x.category))throw fail();
   reqCat=toDbCategory(x.category);
  }
  return {
   ...blank,
   variant_id:null,
   category:reqCat?toDbCategory(reqCat):'other',
   _catalog_lookup:{
    category:reqCat,
    catalog_sku_id:hasCatalogSku?id(String(x.catalog_sku_id)):null,
    catalog_model_id:hasCatalogModel?id(String(x.catalog_model_id)):null,
    meta
   }
  };
 }
 if(!Object.hasOwn(specKeys,x.category))throw fail();
 const dbCat=toDbCategory(x.category);
 const result={...blank,variant_id:null,category:dbCat,manual_brand:str(x.manual_brand,80),manual_model_name:str(x.manual_model_name,120),manual_model_number:str(x.manual_model_number,80,true)};
 if(x.manual_storage_gb!==undefined&&x.manual_storage_gb!==null){
  if(!['smartphone','laptop','tablet','pc','ssd'].includes(dbCat))throw fail();
  result.manual_storage_gb=integer(x.manual_storage_gb,2147483647);
 }
 let specsObj=null;
 if(x.manual_specs_json!==undefined&&x.manual_specs_json!==null){
  object(x.manual_specs_json,specKeys[x.category]);
  if(Buffer.byteLength(JSON.stringify(x.manual_specs_json))>2048)throw fail();
  specsObj={};
  for(const [k,v] of Object.entries(x.manual_specs_json)){
   if(v===null){specsObj[k]=null;continue;}
   if(numeric.includes(k))specsObj[k]=integer(v);
   else if(floatKeys.includes(k)){
    if(typeof v!=='number'||!Number.isFinite(v)||v<=0||v>100000)throw fail();
    specsObj[k]=Number(v);
   }else if(boolKeys.includes(k)){
    if(typeof v!=='boolean')throw fail();
    specsObj[k]=v;
   }else{
    specsObj[k]=str(v,k==='note'?300:120);
   }
  }
 }
 const canonicalCat=['watch','smartwatch'].includes(x.category)?'smartwatch':x.category;
 if(['smartwatch','earbuds','speaker'].includes(canonicalCat)||Object.keys(meta).length>0){
  specsObj=specsObj?{...specsObj}:{};
  if(['smartwatch','earbuds','speaker'].includes(canonicalCat)){
   specsObj._catalog_category=canonicalCat;
  }
  if(Object.keys(meta).length>0){
   specsObj._device_meta=meta;
  }
 }
 result.manual_specs_json=specsObj;
 return result;
}
function pagination(q,search=false){object(q,search?['q','limit','cursor','category']:['limit','cursor']);let limit=20;if(q.limit!==undefined){if(typeof q.limit!=='string'||! /^[1-9][0-9]?$/.test(q.limit))throw fail();limit=integer(Number(q.limit),50);}const category=search&&q.category!==undefined?str(q.category,20):null;return {limit,cursor:q.cursor===undefined?'0':id(q.cursor),q:search?str(q.q,100):null,...(category?{category}:{})};}
module.exports={fail,object,str,integer,id,version,profile,device,pagination,toDbCategory};
