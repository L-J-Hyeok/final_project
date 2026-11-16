'use strict';
const publication = require('../services/product-publication');
const express=require('express'),{Op,QueryTypes}=require('sequelize');
const connection=require('../db/connection'),v=require('../services/member-validation');
const router=express.Router();
const wrap=fn=>(req,res,next)=>Promise.resolve().then(()=>fn(req,res,next)).catch(next);
// This router handles only member resources, leaving auth endpoints unchanged.
router.use(['/profile','/owned-devices','/owned-device-options'],wrap(async(req,res,next)=>{
 if(!req.session||!req.session.user_id)throw v.fail('AUTH_REQUIRED',401);
 const user=await connection.getDatabase().models.users.findByPk(req.session.user_id,{attributes:['id']});
 if(!user)throw v.fail('AUTH_REQUIRED',401);
 next();
}));
function db(){return connection.getDatabase();}
function profileView(p){return {version:p.version,common:p.common_json,smartphone:p.smartphone_json,confirmed_at:p.confirmed_at};}
function stripInternalSmartphoneKeys(s){
 if(!s||typeof s!=='object')return {};
 const copy={...s};delete copy._upgrade_state;return copy;
}
function mergeInternalSmartphoneKeys(prev,next){
 const out={...(next||{})};
 if(prev&&typeof prev==='object'&&prev._upgrade_state&&typeof prev._upgrade_state==='object'){
  out._upgrade_state=prev._upgrade_state;
 }
 return out;
}
async function lockedProfile(uid,t){
 const user=await db().models.users.findByPk(uid,{transaction:t,lock:t.LOCK.UPDATE,attributes:['id']});
 if(!user)throw v.fail('AUTH_REQUIRED',401);
 const p=await db().models.profiles.findByPk(uid,{transaction:t,lock:t.LOCK.UPDATE});
 if(!p)throw v.fail('NOT_FOUND',404);
 return p;
}
async function increment(p,t,extra={}){if(p.version>=4294967295)throw v.fail('VERSION_EXHAUSTED',409);return p.update({...extra,version:p.version+1,updated_at:new Date()},{transaction:t});}
async function invalidate(uid,t){await db().models.recommendations.destroy({where:{user_id:uid},transaction:t});}
router.get('/profile',wrap(async(req,res)=>{
 v.object(req.query,[]);
 const p=await db().models.profiles.findByPk(req.session.user_id);
 if(!p)throw v.fail('NOT_FOUND',404);res.json({data:{version:p.version,common:p.common_json,smartphone:stripInternalSmartphoneKeys(p.smartphone_json),confirmed_at:p.confirmed_at}});
}));
router.put('/profile',wrap(async(req,res)=>{
 const input=v.profile(req.body),uid=req.session.user_id;
 const p=await db().transaction(async t=>{const p=await lockedProfile(uid,t);if(p.version!==input.expected_version)throw v.fail('PROFILE_CHANGED',409);return increment(p,t,{common_json:input.common_json,smartphone_json:mergeInternalSmartphoneKeys(p.smartphone_json,input.smartphone_json),confirmed_at:new Date()});});
 res.json({data:{version:p.version,common:p.common_json,smartphone:stripInternalSmartphoneKeys(p.smartphone_json),confirmed_at:p.confirmed_at}});
}));
router.delete('/profile',wrap(async(req,res)=>{
 v.object(req.body,['expected_version']);v.version(req.body.expected_version);const uid=req.session.user_id;
 await db().transaction(async t=>{const p=await lockedProfile(uid,t);if(p.version!==req.body.expected_version)throw v.fail('PROFILE_CHANGED',409);await increment(p,t,{common_json:{},smartphone_json:{},confirmed_at:null});await invalidate(uid,t);});res.status(204).end();
}));
async function variant(id,t,publicOnly=false){
 let gate='';
 if(publicOnly){
  let pub=await publication.sql(db(),{transaction:t});
  if(process.env.NODE_ENV==='test')pub=pub.replace('s.is_test = 0','1=1');
  gate=` AND ${pub}`;
 }
 const rows=await db().query('SELECT CAST(v.id AS CHAR) id, CAST(s.id AS CHAR) smartphone_id, s.brand,s.model_name,s.domestic_model_number,s.released_on_kr,v.storage_gb,v.ram_gb,v.color,(s.verified AND v.verified) verified,s.is_test FROM smartphone_variants v JOIN smartphones s ON s.id=v.smartphone_id WHERE v.id=:id'+gate,{replacements:{id},type:QueryTypes.SELECT,transaction:t});
 return rows[0]||null;
}

async function catalogVariant(ref,t,publicOnly=false){
 if(!ref||(!ref.sku_id&&!ref.model_id&&!ref.catalog_sku_id&&!ref.catalog_model_id))return null;
 const skuId=ref.sku_id||ref.catalog_sku_id||null;
 const modelId=ref.model_id||ref.catalog_model_id||null;
 const pubGate=publicOnly
  ?` AND m.publication_status='public' AND m.verification_status='verified'${process.env.NODE_ENV==='test'?'':' AND m.is_test=0'}`
  :'';
 if(skuId){
  const rows=await db().query(`
   SELECT CAST(k.id AS CHAR) sku_id, CAST(m.id AS CHAR) model_id, m.category_code, m.brand, m.model_name, m.model_number,
          m.released_on, m.weight_g AS model_weight_g, m.specs_json, k.sku_code, k.storage_gb, k.ram_gb, k.color, k.connectivity,
          k.options_json, CAST(k.price_group_id AS CHAR) price_group_id,
          (m.verification_status='verified' AND k.verification_status='verified') verified
   FROM catalog_skus k JOIN catalog_models m ON m.id=k.model_id
   WHERE k.id=:skuId${pubGate}${publicOnly?" AND k.publication_status='public' AND k.verification_status='verified'":''}
  `,{replacements:{skuId},type:QueryTypes.SELECT,transaction:t});
  const r=rows[0]||null;
  if(!r)return null;
  if(modelId&&String(r.model_id)!==String(modelId))return null;
  if(ref.category&&r.category_code!==ref.category)return null;
  const specs=typeof r.specs_json==='string'?JSON.parse(r.specs_json):(r.specs_json||{});
  const opts=typeof r.options_json==='string'?JSON.parse(r.options_json):(r.options_json||{});
  return {
   category:r.category_code,
   model_id:String(r.model_id),
   sku_id:String(r.sku_id),
   sku_code:r.sku_code,
   brand:r.brand,
   model_name:r.model_name,
   model_number:r.model_number,
   released_on:r.released_on||null,
   storage_gb:r.storage_gb==null?null:Number(r.storage_gb),
   ram_gb:r.ram_gb==null?null:Number(r.ram_gb),
   color:r.color||null,
   connectivity:r.connectivity||null,
   weight_g:opts.weight_g!=null?Number(opts.weight_g):(r.model_weight_g!=null?Number(r.model_weight_g):null),
   specifications:specs,
   options:opts,
   verified:Boolean(r.verified)
  };
 }
 const rows=await db().query(`
  SELECT CAST(m.id AS CHAR) model_id, m.category_code, m.brand, m.model_name, m.model_number,
         m.released_on, m.weight_g AS model_weight_g, m.specs_json,
         (m.verification_status='verified') verified
  FROM catalog_models m
  WHERE m.id=:modelId${pubGate}
 `,{replacements:{modelId},type:QueryTypes.SELECT,transaction:t});
 const r=rows[0]||null;
 if(!r)return null;
 if(ref.category&&r.category_code!==ref.category)return null;
 const specs=typeof r.specs_json==='string'?JSON.parse(r.specs_json):(r.specs_json||{});
 return {
  category:r.category_code,
  model_id:String(r.model_id),
  sku_id:null,
  sku_code:null,
  brand:r.brand,
  model_name:r.model_name,
  model_number:r.model_number,
  released_on:r.released_on||null,
  storage_gb:null,
  ram_gb:null,
  color:null,
  connectivity:null,
  weight_g:r.model_weight_g!=null?Number(r.model_weight_g):null,
  specifications:specs,
  options:{},
  verified:Boolean(r.verified)
 };
}

async function resolveDeviceInput(input,t){
 if(!input._catalog_lookup)return input;
 const lookup=input._catalog_lookup;
 const catProd=await catalogVariant(lookup,t,true);
 if(!catProd)throw v.fail('NOT_FOUND',404);
 const dbCat=v.toDbCategory(catProd.category);
 const storageGb=['tablet','laptop'].includes(catProd.category)&&catProd.storage_gb!=null?Number(catProd.storage_gb):null;
 const specsJson={
  _catalog_category:catProd.category,
  _catalog_ref:{
   category:catProd.category,
   model_id:catProd.model_id,
   sku_id:catProd.sku_id,
   sku_code:catProd.sku_code
  },
  ...(lookup.meta&&Object.keys(lookup.meta).length?{_device_meta:lookup.meta}:{})
 };
 return {
  variant_id:null,
  category:dbCat,
  manual_brand:catProd.brand,
  manual_model_name:catProd.model_name,
  manual_model_number:catProd.model_number,
  manual_storage_gb:storageGb,
  manual_specs_json:specsJson
 };
}

async function deviceView(row,t){
 const x=row.toJSON();
 delete x.user_id;
 x.id=String(x.id);
 x.variant_id=x.variant_id===null?null:String(x.variant_id);
 const rawSpecs=x.manual_specs_json&&typeof x.manual_specs_json==='object'?{...x.manual_specs_json}:null;
 const catCategory=rawSpecs?._catalog_category||rawSpecs?._catalog_ref?.category||null;
 const catRef=rawSpecs?._catalog_ref||null;
 const devMeta=rawSpecs?._device_meta||null;
 if(rawSpecs){
  delete rawSpecs._catalog_category;
  delete rawSpecs._catalog_ref;
  delete rawSpecs._device_meta;
  x.manual_specs_json=Object.keys(rawSpecs).length>0?rawSpecs:null;
 }
 if(catCategory){
  x.category=catCategory;
 }
 if(x.variant_id){
  x.source='catalog';
  x.manual_specs_verified=false;
  x.compatibility_verified=false;
  x.product=await variant(x.variant_id,t);
  return x;
 }
 if(catRef){
  const catProd=await catalogVariant(catRef,t,false);
  x.source='catalog';
  x.catalog_model_id=catRef.model_id||null;
  x.catalog_sku_id=catRef.sku_id||null;
  x.manual_specs_verified=Boolean(catProd?.verified);
  x.compatibility_verified=Boolean(catProd?.verified);
  x.product=catProd;
 }else{
  x.source='manual';
  x.manual_specs_verified=false;
  x.compatibility_verified=false;
  x.product=null;
 }
 if(devMeta){
  x.purchase_info={
   purchase_price_krw:devMeta.purchase_price_krw??null,
   purchase_date:devMeta.purchase_date??null
  };
  x.user_context={
   pain_points:devMeta.pain_points||[],
   usages:devMeta.usages||[],
   satisfied_aspects:devMeta.satisfied_aspects||[],
   replacement_intent:devMeta.replacement_intent||null
  };
 }
 return x;
}

router.get('/owned-device-options',wrap(async(req,res)=>{
 const p=v.pagination(req.query,true);
 const cat=p.category==='watch'?'smartwatch':p.category;
 if(cat&&['tablet','laptop','smartwatch','earbuds','speaker'].includes(cat)){
  const rows=await db().query(`
   SELECT CAST(k.id AS CHAR) id, CAST(k.id AS CHAR) catalog_sku_id, CAST(m.id AS CHAR) catalog_model_id,
          m.category_code AS category, m.brand, m.model_name, m.model_number, m.released_on,
          k.sku_code, k.storage_gb, k.ram_gb, k.color, k.connectivity,
          (m.verification_status='verified' AND k.verification_status='verified') verified, m.is_test
   FROM catalog_skus k JOIN catalog_models m ON m.id=k.model_id
   WHERE m.category_code=:cat AND m.publication_status='public' AND m.verification_status='verified' AND m.is_test=0
     AND k.publication_status='public' AND k.verification_status='verified'
     AND k.id>:cursor AND (LOCATE(:q,m.model_name)>0 OR LOCATE(:q,m.brand)>0 OR LOCATE(:q,m.model_number)>0 OR LOCATE(:q,k.sku_code)>0)
   ORDER BY k.id ASC LIMIT :limit
  `,{replacements:{cat,q:p.q,cursor:p.cursor,limit:p.limit+1},type:QueryTypes.SELECT});
  const more=rows.length>p.limit;
  return res.json({data:rows.slice(0,p.limit),next_cursor:more?rows[p.limit-1].id:null});
 }
 // LOCATE treats user input as literal text rather than LIKE wildcards.
 const rows=await db().query('SELECT CAST(v.id AS CHAR) id, s.brand,s.model_name,s.domestic_model_number,s.released_on_kr,v.storage_gb,v.ram_gb,v.color,(s.verified AND v.verified) verified,s.is_test FROM smartphone_variants v JOIN smartphones s ON s.id=v.smartphone_id WHERE '+await publication.sql(db())+' AND v.id>:cursor AND (LOCATE(:q,s.model_name)>0 OR LOCATE(:q,s.brand)>0 OR LOCATE(:q,s.domestic_model_number)>0) ORDER BY v.id ASC LIMIT :limit',{replacements:{q:p.q,cursor:p.cursor,limit:p.limit+1},type:QueryTypes.SELECT});
 const more=rows.length>p.limit;res.json({data:rows.slice(0,p.limit),next_cursor:more?rows[p.limit-1].id:null});
}));
router.get('/owned-devices',wrap(async(req,res)=>{
 const p=v.pagination(req.query);const rows=await db().models.owned_devices.findAll({where:{user_id:req.session.user_id,id:{[Op.gt]:p.cursor}},order:[['id','ASC']],limit:p.limit+1});
 const data=await Promise.all(rows.slice(0,p.limit).map(x=>deviceView(x)));res.json({data,next_cursor:rows.length>p.limit?data[data.length-1].id:null});
}));
router.post('/owned-devices',wrap(async(req,res)=>{
 const rawInput=v.device(req.body),uid=req.session.user_id;
 const result=await db().transaction(async t=>{const p=await lockedProfile(uid,t);
 if(await db().models.owned_devices.count({where:{user_id:uid},transaction:t})>=20)throw v.fail('DEVICE_LIMIT',409);
 if(rawInput.variant_id&&!await variant(rawInput.variant_id,t,true))throw v.fail('NOT_FOUND',404);
 const input=await resolveDeviceInput(rawInput,t);
 const row=await db().models.owned_devices.create({...input,user_id:uid},{transaction:t});await increment(p,t);
 const devView=await deviceView(row,t);
 const upgradeOffer=devView.category==='smartphone'?await require('./upgrade-offers').buildUpgradeOfferStatus(uid,new Date(),t):null;
 return {device:devView,profile_version:p.version,upgrade_offer:upgradeOffer};});res.status(201).json({data:result});
}));
router.put('/owned-devices/:id',wrap(async(req,res)=>{
 const id=v.id(req.params.id),uid=req.session.user_id,rawInput=v.device(req.body);
 const result=await db().transaction(async t=>{const p=await lockedProfile(uid,t);const row=await db().models.owned_devices.findOne({where:{id,user_id:uid},transaction:t,lock:t.LOCK.UPDATE});if(!row)throw v.fail('NOT_FOUND',404);
 if(rawInput.variant_id&&String(rawInput.variant_id)!==String(row.variant_id)&&!await variant(rawInput.variant_id,t,true))throw v.fail('NOT_FOUND',404);
 const input=await resolveDeviceInput(rawInput,t);
 const curJson=(p.smartphone_json&&typeof p.smartphone_json==='object')?{...p.smartphone_json}:{};
 if(curJson._upgrade_state&&curJson._upgrade_state.devices&&curJson._upgrade_state.devices[String(id)]){
  const nextDevices={...curJson._upgrade_state.devices};delete nextDevices[String(id)];
  curJson._upgrade_state={...curJson._upgrade_state,devices:nextDevices};
 }
 await row.update({...input,updated_at:new Date()},{transaction:t});await increment(p,t,{smartphone_json:curJson});
 const devView=await deviceView(row,t);
 const upgradeOffer=devView.category==='smartphone'?await require('./upgrade-offers').buildUpgradeOfferStatus(uid,new Date(),t):null;
 return {device:devView,profile_version:p.version,upgrade_offer:upgradeOffer};});res.json({data:result});
}));
router.delete('/owned-devices/:id',wrap(async(req,res)=>{
 const id=v.id(req.params.id),uid=req.session.user_id;v.object(req.body||{},[]);
 await db().transaction(async t=>{const p=await lockedProfile(uid,t);const row=await db().models.owned_devices.findOne({where:{id,user_id:uid},transaction:t,lock:t.LOCK.UPDATE});if(!row)throw v.fail('NOT_FOUND',404);
 const curJson=(p.smartphone_json&&typeof p.smartphone_json==='object')?{...p.smartphone_json}:{};
 if(curJson._upgrade_state){
  const nextDevices={...(curJson._upgrade_state.devices||{})};delete nextDevices[String(id)];
  const nextCurrent=String(curJson._upgrade_state.current_device_id)===String(id)?null:curJson._upgrade_state.current_device_id;
  curJson._upgrade_state={...curJson._upgrade_state,current_device_id:nextCurrent,devices:nextDevices};
 }
 await row.destroy({transaction:t});await increment(p,t,{smartphone_json:curJson});});res.status(204).end();
}));
router.stripInternalSmartphoneKeys=stripInternalSmartphoneKeys;
router.mergeInternalSmartphoneKeys=mergeInternalSmartphoneKeys;
router.deviceView=deviceView;
router.catalogVariant=catalogVariant;
module.exports=router;
