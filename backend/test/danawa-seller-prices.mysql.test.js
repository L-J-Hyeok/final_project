'use strict';
// Explicit opt-in. Bootstrap only creates a fresh schema/account; all test writes
// use its schema-limited account. Never DROP a pre-existing schema or load app DB models.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { Sequelize, DataTypes, QueryTypes } = require('sequelize');
const mysql = require('mysql2/promise');
const sync = require('../services/danawa-price-sync');
const sellers = require('../services/danawa-seller-prices');
const catalog = require('../services/smartphone-catalog');
const defineModels = require('../db/models');
function safeError(e) { return new Error(e?.original?.code || e?.code || 'ISOLATED_TEST_FAILED'); }
function statements(file) {
  return fs.readFileSync(path.join(__dirname, '../db', file), 'utf8').replace(/^\s*--.*$/gm, '').split(';').map(s=>s.trim()).filter(Boolean);
}

test('real MySQL seller-price integration (synthetic feed, fresh restricted schema)', {
  skip: process.env.RUN_ISOLATED_SELLER_MYSQL !== '1', timeout: 120000
}, async t => {
  const suffix = randomBytes(8).toString('hex');
  const schema = 'kiki_price_test_' + suffix;
  const username = 'kiki_p_' + suffix;
  const password = 'T9!a' + randomBytes(32).toString('hex'); // Satisfy server policy without weakening it.
  let admin, db, server, createdSchema = false, createdUser = false, originalGetDatabase;
  const connection = require('../db/connection');
  const now = new Date(Date.now() - 10000);
  const opts = { apply:true,allowDbWrite:true,storageAuthorized:true,authorizationRef:'synthetic-isolated-test-only',now };
  const variant = { variant_id:'1', brand:'samsung',model_name:'Galaxy S24', domestic_model_number:'SM-S921N',storage_gb:256,ram_gb:8,color:'마블 그레이' };
  const base = { product_name:'삼성 갤럭시 S24 SM-S921N 256GB RAM 8GB 마블 그레이 자급제',shipping_krw:0,unconditional:true,in_stock:true,is_new:true,is_unlocked:true,conditions_text:'SYNTHETIC TEST ONLY - NOT COLLECTED PRICE' };
  const feed = { product_code:'12345678',maker:'삼성전자',observed_at:now.toISOString(),offers:[
    {...base,seller_key:'coupang',seller_name:'쿠팡',seller_product_url:'https://www.coupang.com/test-only',amount_krw:800000,shipping_krw:3000},
    {...base,seller_key:'gmarket',seller_name:'G마켓',seller_product_url:'https://www.gmarket.co.kr/test-only',amount_krw:810000},
    {...base,seller_key:'11st',seller_name:'11번가',seller_product_url:'https://www.11st.co.kr/test-only',amount_krw:830000},
    {...base,seller_key:'samsung',seller_name:'삼성닷컴',seller_product_url:'https://www.samsung.com/sec/test-only',amount_krw:900000}
  ] };
  const rows = () => db.query('SELECT * FROM price_observations ORDER BY id', {type:QueryTypes.SELECT});
  const step = (name, fn) => t.test(name, async () => {try {await fn();} catch(e) {if(e.code==='ERR_ASSERTION') throw e; throw safeError(e);}});
  try {
    require('../config/loadEnv')(); // Normal loading; never print credentials/config.
    const config = require('../config/database').readConfig();
    assert.ok(['localhost','127.0.0.1','::1'].includes(config.options.host));
    assert.equal(config.database,'final_project');
    admin = await mysql.createConnection({host:config.options.host,port:config.options.port,user:config.username,password:config.password,connectTimeout:5000});
    const [version] = await admin.query('SELECT VERSION() version');
    connection.assertVersion(version[0].version);
    // No IF EXISTS/IF NOT EXISTS: a collision fails closed and is never cleaned up.
    await admin.query(`CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`); createdSchema = true;
    await admin.query('CREATE USER ?@\'localhost\' IDENTIFIED BY ?', [username,password]); createdUser = true;
    await admin.query(`GRANT ALL PRIVILEGES ON \`${schema}\`.* TO ?@'localhost'`,[username]);
    db = new Sequelize(schema,username,password,{...config.options,logging:false});
    await db.authenticate();
    const [target] = await db.query('SELECT DATABASE() db', {type:QueryTypes.SELECT});
    assert.equal(target.db,schema);
    await step('dedicated account has no access to existing application tables', async()=>{
      await assert.rejects(db.query('SELECT 1 FROM final_project.users LIMIT 0'), e=>e.original?.code==='ER_TABLEACCESS_DENIED_ERROR'||e.original?.code==='ER_DBACCESS_DENIED_ERROR');
    });
    await step('001/002/003/005 migration succeeds on MySQL8; InnoDB and unique key present',async()=>{
      for (const file of ['migrations/001-initial.sql','migration-drafts/002-smartphone-details.draft.sql','migration-drafts/003-smartphone-ram-key.draft.sql','migration-drafts/005-seller-prices.draft.sql']) {
        for(const sql of statements(file)) await db.query(sql);
      }
      const tables = await db.query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()",{type:QueryTypes.SELECT});
      assert.equal(tables.length,8); assert.ok(tables.every(x=>x.ENGINE==='InnoDB'));
      const indexes=await db.getQueryInterface().showIndex('price_observations');
      assert.ok(indexes.some(x=>x.name==='uq_price_observation_key'&&x.unique));
    });
    defineModels(db,DataTypes,{extended:true}); // Exercise lazy price model extension used by app.
    const evidence={source_name:'synthetic fixture',source_url:'https://example.invalid/test-only',verified_at:now};
    await db.models.smartphones.create({id:1,brand:'samsung',model_name:'Galaxy S24',domestic_model_number:'SM-S921N',released_on_kr:'2024-01-31',os:'android',verified:true,is_test:false,review_status:'legacy',...evidence});
    await db.models.smartphone_variants.create({id:1,smartphone_id:1,storage_gb:256,ram_gb:8,color:'마블 그레이',verified:true,review_status:'legacy',...evidence});
    await db.models.smartphones.create({id:2,brand:'samsung',model_name:'Pending synthetic',domestic_model_number:'TEST-PENDING',verified:false,is_test:false,review_status:'pending'});
    await db.models.smartphone_variants.create({id:2,smartphone_id:2,storage_gb:256,ram_gb:8,color:'마블 그레이',verified:false,review_status:'pending'});
    await step('four seller INSERTs preserve variant FK, JSON metadata and source',async()=>{
      const result=await sync.syncSellerPrices(db,{variant,feed,options:opts});
      assert.equal(result.persistence.inserted,4); assert.equal(result.rejected.length,0);
      const saved=await rows(); assert.equal(saved.length,4); assert.ok(saved.every(p=>String(p.variant_id)==='1'));
      assert.equal(new Set(saved.map(p=>p.seller_name)).size,4);
      assert.ok(saved.every(p=>p.price_metadata_json.product_code==='12345678'));
    });
    await step('identical observation repeats insert zero rows',async()=>{
      const r=await sync.syncSellerPrices(db,{variant,feed,options:opts});
      assert.equal(r.persistence.inserted,0); assert.equal(r.persistence.duplicates,4); assert.equal((await rows()).length,4);
    });
    await step('shipping-included minimum is Coupang803000, not Danawa-wide minimum',async()=>{
      const summary=sellers.summarizeSellerPrices(catalog.selectBestPrice(await rows(),now).latest_by_seller);
      assert.equal(summary.lowest.total_krw,803000); assert.equal(summary.lowest.seller_name,'쿠팡');
      assert.equal(summary.overall_danawa_minimum_krw,null);
    });
    await step('price change appends history; latest seller price changes minimum to Gmarket810000',async()=>{
      const changed={...feed,observed_at:new Date(+now+1000).toISOString(),offers:[{...feed.offers[0],amount_krw:850000}]};
      await sync.syncSellerPrices(db,{variant,feed:changed,options:{...opts,now:new Date(+now+2000)}});
      const saved=await rows(); assert.equal(saved.length,5); assert.equal(saved[0].amount_krw,800000);
      const selected=catalog.selectBestPrice(saved,new Date(+now+2000)).selected;
      assert.equal(selected.seller_name,'G마켓'); assert.equal(selected.total_krw,810000);
    });
    await step('stored observations remain eligible after the former expiry',async()=>{
      assert.ok(catalog.selectBestPrice(await rows(),new Date(+now+86400000)).selected);
    });
    await step('unknown stock/shipping persist as NULL reference, not verified price',async()=>{
      const unknown={...feed,observed_at:new Date(+now+3000).toISOString(),offers:[{...feed.offers[2],shipping_krw:null,in_stock:null}]};
      await sync.syncSellerPrices(db,{variant,feed:unknown,options:{...opts,now:new Date(+now+4000)}});
      const saved=await rows(); const last=saved.at(-1);
      assert.equal(last.shipping_krw,null); assert.equal(last.in_stock,null);
      assert.equal(last.price_metadata_json.price_type,'reference_sale'); assert.equal(catalog.evaluateObservation(last,new Date(+now+4000)).eligible,false);
    });
    await step('mid-batch failure rolls back first insert as well',async()=>{
      const before=(await rows()).length;
      const prepared=sellers.prepareSellerObservations(variant,{...feed,offers:[{...feed.offers[0],amount_krw:870000}]},{now});
      prepared.accepted.push({...prepared.accepted[0],variant_id:'999999',observation_key:'f'.repeat(64)});
      await assert.rejects(sellers.persistSellerObservations(db,prepared,opts),/VARIANT_NOT_FOUND/);
      assert.equal((await rows()).length,before);
    });
    await step('concurrent identical imports serialize and insert exactly one observation',async()=>{
      const prepared=sellers.prepareSellerObservations(variant,{...feed,offers:[{...feed.offers[0],amount_krw:880000}]},{now});
      const results=await Promise.all([sellers.persistSellerObservations(db,prepared,opts),sellers.persistSellerObservations(db,prepared,opts)]);
      assert.equal(results.reduce((n,x)=>n+x.inserted,0),1); assert.equal(results.reduce((n,x)=>n+x.duplicates,0),1);
    });
    await step('pending variant blocked from ingestion and public SQL',async()=>{
      await assert.rejects(sync.syncSellerPrices(db,{variant:{...variant,variant_id:'2'},feed,options:opts}),/PUBLIC_VARIANT_REQUIRED/);
      assert.deepEqual((await sync.loadExistingSmartphoneVariants(db)).map(x=>String(x.variant_id)),['1']);
    });
    await step('repeat005 fails closed, leaves all data and FK intact',async()=>{
      const before=await rows();
      await assert.rejects(db.query(statements('migration-drafts/005-seller-prices.draft.sql')[0]),e=>['ER_DUP_FIELDNAME','ER_CHECK_CONSTRAINT_DUP_NAME'].includes(e.original?.code));
      assert.deepEqual(await rows(),before);
      const orphan=await db.query('SELECT COUNT(*) n FROM price_observations p LEFT JOIN smartphone_variants v ON v.id=p.variant_id WHERE v.id IS NULL',{type:QueryTypes.SELECT});
      assert.equal(Number(orphan[0].n),0);
    });
    await step('real Express HTTP list/detail return stored prices and hide pending option',async()=>{
      originalGetDatabase=connection.getDatabase; connection.getDatabase=()=>db;
      const express=require('express');const app=express(); app.use('/api',require('../routes/smartphones'));
      app.use((e,req,res,next)=>res.status(e.status||500).json({error:{code:e.code||'INTERNAL_ERROR'}}));
      server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
      const url=`http://127.0.0.1:${server.address().port}/api/smartphones`;
      const list=await fetch(url); assert.equal(list.status,200); const body=await list.json();
      assert.deepEqual(body.data.map(x=>x.variant_id),['1']); assert.ok(body.data[0].seller_price_summary.lowest);
      assert.equal((await fetch(url+'/2')).status,404);
      const detail=await fetch(url+'/1'); assert.equal(detail.status,200);
      assert.equal((await detail.json()).data.latest_prices_by_seller.length,4);
    });
    await step('CLI-shaped reference persists once and shares only within matching capacity and RAM', async () => {
      const variantModel = db.models.smartphone_variants;
      for (const [id, ram, color] of [[3,8,'코발트 바이올렛'],[4,12,'오닉스 블랙'],[5,null,'NULL fixture']]) {
        await variantModel.create({ ...evidence,id,smartphone_id:1,storage_gb:256,ram_gb:ram,color,verified:true,review_status:'legacy' });
      }
      const adapter = {mode:'mock',searchVariant:async()=>({items:[{
        productName:'삼성 갤럭시 S24 SM-S921N 256GB RAM 8GB 자급제',
        productCode:'12345678',minPrice:790000,danawaProductUrl:'https://prod.danawa.com/info/?pcode=12345678'
      }]})};
      const options={...opts,permissionRef:'isolated-test',persistReferencePrices:true,ttlHours:24};
      const first=await sync.syncVariantPrices(db,{variants:[variant],adapter,options});
      const repeat=await sync.syncVariantPrices(db,{variants:[variant],adapter,options});
      assert.equal(first.persistence.insertedCount,1);
      assert.equal(repeat.persistence.skippedDuplicatesCount,1);
      const url=`http://127.0.0.1:${server.address().port}/api/smartphones`;
      const shared=(await (await fetch(url+'/3')).json()).data.price;
      assert.equal(shared.color_scope,'capacity_common');
      assert.equal(shared.amount_krw,790000);
      assert.equal(shared.purchase_verified,false);
      assert.equal((await (await fetch(url+'/4')).json()).data.price,null);
      assert.equal((await (await fetch(url+'/5')).json()).data.price,null);
      await variantModel.update({storage_gb:512},{where:{id:3}});
      assert.equal((await (await fetch(url+'/3')).json()).data.price,null);
      await variantModel.update({storage_gb:256},{where:{id:3}});
      const Price = db.models.price_observations;
      const reference = await Price.findOne({where:{seller_name:'다나와 기준 최저가'}});
      const original = reference.conditions_text;
      for (const text of ['legacy reference', original.replace('capacity_common','exact_color')]) {
        await reference.update({conditions_text:text});
        assert.equal((await (await fetch(url+'/3')).json()).data.price,null);
      }
      await reference.update({conditions_text:original});
      await variantModel.update({ram_gb:null},{where:{id:1}});
      assert.equal((await (await fetch(url+'/5')).json()).data.price,null);
      assert.equal((await (await fetch(url+'/3')).json()).data.price,null);
      await variantModel.update({ram_gb:8},{where:{id:1}});
      const exactAdapter = { mode: 'mock', searchVariant: async () => ({ items: [
        ...(await adapter.searchVariant()).items,
        { productName:'삼성 갤럭시 S24 SM-S921N 256GB RAM 8GB 코발트 바이올렛 자급제',
          productCode:'23456789', minPrice:810000, danawaProductUrl:'https://prod.danawa.com/info/?pcode=23456789' },
      ] }) };
      const exact = await sync.syncVariantPrices(db,{variants:[{...variant,variant_id:'3',color:'코발트 바이올렛'}],adapter:exactAdapter,options});
      assert.equal(exact.persistence.insertedCount,2);
      const detail = (await (await fetch(url+'/3')).json()).data;
      assert.equal(detail.price.danawa_product_url,
        'https://prod.danawa.com/info/?pcode=23456789');
      const catalogRoute = require('../routes/smartphones');
      const common = await catalogRoute.fetchPricesByVariantIds(['3'], undefined, { commonOnly:true });
      assert.ok(common.get('3').every(row=>catalog.evaluateObservation(row).color_scope!=='exact_color'));
      const list=(await (await fetch(url)).json()).data;
      assert.equal(list.find(x=>x.variant_id==='3').price.danawa_product_code,'23456789');
    });
  } catch(e) { throw safeError(e); }
  finally {
    if(server)await new Promise(resolve=>server.close(resolve));
    if(originalGetDatabase)connection.getDatabase=originalGetDatabase;
    if(db)await db.close();
    if(admin){
      try {
        if(createdSchema)await admin.query(`DROP DATABASE \`${schema}\``);
        if(createdUser)await admin.query('DROP USER ?@\'localhost\'',[username]);
        const [remaining]=await admin.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',[schema]);
        assert.equal(remaining.length,0);
        console.log('Isolated schema/account cleaned up; application database not selected or modified.');
      }catch(e){throw safeError(e);}finally{await admin.end();}
    }
  }
});
