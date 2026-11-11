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
 const gate=publicOnly?` AND ${await publication.sql(db(),{transaction:t})}`:'';
 const rows=await db().query('SELECT CAST(v.id AS CHAR) id, CAST(s.id AS CHAR) smartphone_id, s.brand,s.model_name,s.domestic_model_number,s.released_on_kr,v.storage_gb,v.ram_gb,v.color,(s.verified AND v.verified) verified,s.is_test FROM smartphone_variants v JOIN smartphones s ON s.id=v.smartphone_id WHERE v.id=:id'+gate,{replacements:{id},type:QueryTypes.SELECT,transaction:t});
 return rows[0]||null;
}
async function deviceView(row,t){const x=row.toJSON();delete x.user_id;x.id=String(x.id);x.variant_id=x.variant_id===null?null:String(x.variant_id);x.source=x.variant_id?'catalog':'manual';x.manual_specs_verified=false;x.compatibility_verified=false;x.product=x.variant_id?await variant(x.variant_id,t):null;return x;}
router.get('/owned-device-options',wrap(async(req,res)=>{
 const p=v.pagination(req.query,true);
 // LOCATE treats user input as literal text rather than LIKE wildcards.
 const rows=await db().query('SELECT CAST(v.id AS CHAR) id, s.brand,s.model_name,s.domestic_model_number,s.released_on_kr,v.storage_gb,v.ram_gb,v.color,(s.verified AND v.verified) verified,s.is_test FROM smartphone_variants v JOIN smartphones s ON s.id=v.smartphone_id WHERE '+await publication.sql(db())+' AND v.id>:cursor AND (LOCATE(:q,s.model_name)>0 OR LOCATE(:q,s.brand)>0 OR LOCATE(:q,s.domestic_model_number)>0) ORDER BY v.id ASC LIMIT :limit',{replacements:{q:p.q,cursor:p.cursor,limit:p.limit+1},type:QueryTypes.SELECT});
 const more=rows.length>p.limit;res.json({data:rows.slice(0,p.limit),next_cursor:more?rows[p.limit-1].id:null});
}));
router.get('/owned-devices',wrap(async(req,res)=>{
 const p=v.pagination(req.query);const rows=await db().models.owned_devices.findAll({where:{user_id:req.session.user_id,id:{[Op.gt]:p.cursor}},order:[['id','ASC']],limit:p.limit+1});
 const data=await Promise.all(rows.slice(0,p.limit).map(x=>deviceView(x)));res.json({data,next_cursor:rows.length>p.limit?data[data.length-1].id:null});
}));
router.post('/owned-devices',wrap(async(req,res)=>{
 const input=v.device(req.body),uid=req.session.user_id;
 const result=await db().transaction(async t=>{const p=await lockedProfile(uid,t);
 if(await db().models.owned_devices.count({where:{user_id:uid},transaction:t})>=20)throw v.fail('DEVICE_LIMIT',409);
 if(input.variant_id&&!await variant(input.variant_id,t,true))throw v.fail('NOT_FOUND',404);
 const row=await db().models.owned_devices.create({...input,user_id:uid},{transaction:t});await increment(p,t);
 const devView=await deviceView(row,t);
 const upgradeOffer=devView.category==='smartphone'?await require('./upgrade-offers').buildUpgradeOfferStatus(uid,new Date(),t):null;
 return {device:devView,profile_version:p.version,upgrade_offer:upgradeOffer};});res.status(201).json({data:result});
}));
router.put('/owned-devices/:id',wrap(async(req,res)=>{
 const id=v.id(req.params.id),uid=req.session.user_id,input=v.device(req.body);
 const result=await db().transaction(async t=>{const p=await lockedProfile(uid,t);const row=await db().models.owned_devices.findOne({where:{id,user_id:uid},transaction:t,lock:t.LOCK.UPDATE});if(!row)throw v.fail('NOT_FOUND',404);
 if(input.variant_id&&String(input.variant_id)!==String(row.variant_id)&&!await variant(input.variant_id,t,true))throw v.fail('NOT_FOUND',404);
 const curJson=(p.smartphone_json&&typeof p.smartphone_json==='object')?{...p.smartphone_json}:{};
 if(curJson._upgrade_state&&curJson._upgrade_state.devices&&curJson._upgrade_state.devices[String(id)]){
  const nextDevices={...curJson._upgrade_state.devices};delete nextDevices[String(id)];
  curJson._upgrade_state={...curJson._upgrade_state,devices:nextDevices};
 }
 await row.update({...input,updated_at:new Date()},{transaction:t});await increment(p,t,{smartphone_json:curJson});await invalidate(uid,t);
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
 await row.destroy({transaction:t});await increment(p,t,{smartphone_json:curJson});await invalidate(uid,t);});res.status(204).end();
}));
router.stripInternalSmartphoneKeys=stripInternalSmartphoneKeys;
router.mergeInternalSmartphoneKeys=mergeInternalSmartphoneKeys;
module.exports=router;
