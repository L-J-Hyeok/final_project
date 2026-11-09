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
 object(x.smartphone,['preferred_brands','priorities','preferred_os']);
 const c=x.common,s=x.smartphone;
 if(!['value','balanced','premium'].includes(c.spending_style))throw fail();
 return {expected_version:x.expected_version,common_json:{usages:list(c.usages,['communication','video','coding','gaming','camera','work'],1,6),spending_style:c.spending_style,mobility:option(c.mobility,['low','medium','high']),ecosystem:option(c.ecosystem,['none','android','apple','mixed']),lifestyle_note:str(c.lifestyle_note,300,true)},smartphone_json:{preferred_brands:list(s.preferred_brands===undefined?[]:s.preferred_brands,['samsung','apple'],0,2),priorities:list(s.priorities===undefined?[]:s.priorities,['battery','camera','performance','portability','display'],0,3),preferred_os:option(s.preferred_os,['android','ios'])}};
}
const specKeys={smartphone:['ram_gb','processor_model','gpu_model','os_name'],laptop:['ram_gb','processor_model','gpu_model','os_name'],tablet:['ram_gb','processor_model','gpu_model','os_name'],pc:['ram_gb','processor_model','gpu_model','os_name'],cpu:['socket','cores'],gpu:['vram_gb','power_w'],ram:['capacity_gb','memory_standard','speed_mt_s','module_count'],ssd:['interface','form_factor'],motherboard:['socket','memory_standard','form_factor'],psu:['rated_power_w'],case:['form_factor'],cooler:['form_factor'],watch:['note'],monitor:['note'],other:['note']};
const numeric=['ram_gb','cores','vram_gb','power_w','capacity_gb','speed_mt_s','module_count','rated_power_w'];
const manualKeys=['category','manual_brand','manual_model_name','manual_model_number','manual_storage_gb','manual_specs_json'];
function device(x){
 object(x,['variant_id',...manualKeys]);
 const blank={manual_brand:null,manual_model_name:null,manual_model_number:null,manual_storage_gb:null,manual_specs_json:null};
 if(Object.hasOwn(x,'variant_id')){if(Object.keys(x).length!==1)throw fail();return {...blank,variant_id:id(x.variant_id),category:'smartphone'};}
 if(!Object.hasOwn(specKeys,x.category))throw fail();
 const result={...blank,variant_id:null,category:x.category,manual_brand:str(x.manual_brand,80),manual_model_name:str(x.manual_model_name,120),manual_model_number:str(x.manual_model_number,80,true)};
 if(x.manual_storage_gb!==undefined&&x.manual_storage_gb!==null){if(!['smartphone','laptop','tablet','pc','ssd'].includes(x.category))throw fail();result.manual_storage_gb=integer(x.manual_storage_gb,2147483647);}
 if(x.manual_specs_json!==undefined&&x.manual_specs_json!==null){
  object(x.manual_specs_json,specKeys[x.category]);
  if(Buffer.byteLength(JSON.stringify(x.manual_specs_json))>2048)throw fail();
  result.manual_specs_json={};
  for(const [k,v] of Object.entries(x.manual_specs_json))result.manual_specs_json[k]=v===null?null:numeric.includes(k)?integer(v):str(v,k==='note'?300:120);
 }
 return result;
}
function pagination(q,search=false){object(q,search?['q','limit','cursor']:['limit','cursor']);let limit=20;if(q.limit!==undefined){if(typeof q.limit!=='string'||! /^[1-9][0-9]?$/.test(q.limit))throw fail();limit=integer(Number(q.limit),50);}return {limit,cursor:q.cursor===undefined?'0':id(q.cursor),q:search?str(q.q,100):null};}
module.exports={fail,object,str,integer,id,version,profile,device,pagination};
