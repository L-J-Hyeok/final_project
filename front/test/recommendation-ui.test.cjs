const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {parse,compileScript}=require('@vue/compiler-sfc'),{transformSync}=require('@babel/core'),vue=require('vue'),{renderToString}=require('@vue/server-renderer')
const root=path.resolve(__dirname,'../src')
function load(file,mocks={}){const source=fs.readFileSync(path.join(root,file),'utf8');const js=file.endsWith('.vue')?compileScript(parse(source).descriptor,{id:'test-recommendation',inlineTemplate:true}).content:source;const code=transformSync(js,{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;const module={exports:{}};new Function('require','module','exports',code)(name=>mocks[name]||require(name),module,module.exports);return module.exports}
const api=load('api/recommendations.js',{'./client':{request:()=>{throw Error('Unexpected real request')}}})
const component=load('components/RecommendationResult.vue').default
async function html(props){const app=vue.createSSRApp(component,props);for(const name of ['v-card','v-alert','router-link'])app.component(name,{setup:(_,ctx)=>()=>vue.h('div',ctx.attrs,ctx.slots.default?.())});return renderToString(app)}
const item={variant_id:'42',product:{model_name:'서버 제품',domestic_model_number:'MODEL-KR',storage_gb:256,ram_gb:null,color:'검정'},reasons:[{description:'서버가 검증한 추천 근거'}],price:{price_source:'official_launch',development_only:true,purchase_verified:false,budget_basis_krw:1000000,total_krw:null,warning:'서버 경고'}}
test('request contract preserves hard budget and soft brand without fixture bypass',()=>{const body=api.buildRecommendationRequest({budget:'1500000',usages:['video'],brands:['samsung']},3);assert.deepEqual(body,{expected_profile_version:3,hard:{budget_max_krw:1500000,usages:['video']},soft:{preferred_brands:['samsung']}});assert(!('include_test' in body));for(const budget of ['',0,-1,1.5,10000001])assert.throws(()=>api.buildRecommendationRequest({budget,usages:['video'],brands:[]},3));assert.throws(()=>api.buildRecommendationRequest({budget:1,usages:[],brands:[]},3))})
test('API wrapper uses profile GET and one recommendation POST, returns unchanged response',async()=>{const calls=[],response={data:{status:'recommend',items:[item]}};const client=api.createRecommendationApi(async(...args)=>{calls.push(args);return response});const signal=new AbortController().signal;await client.profile(signal);const body=api.buildRecommendationRequest({budget:1000000,usages:['video'],brands:[]},2);assert.equal(await client.recommend(body,signal),response);assert.deepEqual(calls,[['/api/profile',{signal}],['/api/recommendations',{method:'POST',body,signal}]])})
test('Mock response renders returned product, option, evidence and unknown RAM',async()=>{const s=await html({result:{status:'recommend',items:[item]}});for(const text of ['서버 제품','MODEL-KR','256GB','정보 없음','검정','서버가 검증한 추천 근거'])assert(s.includes(text))})
test('official launch and reference prices are explicitly non-purchasable development prices',async()=>{for(const source of ['official_launch','reference_sale']){const s=await html({result:{status:'recommend',items:[{...item,price:{...item.price,price_source:source}}]}});assert(s.includes('개발용'));assert(s.includes('실제 구매 가능 가격이 아닙니다'));assert(s.includes('서버 경고'));assert(s.includes('1,000,000원'));assert(!s.includes('검증된 판매가 · 배송비 포함'))}})
test('verified sale displays shipping-inclusive total; missing price never becomes zero',async()=>{let s=await html({result:{status:'recommend',items:[{...item,price:{price_source:'verified_sale',purchase_verified:true,total_krw:1200000}}]}});assert(s.includes('검증된 판매가 · 배송비 포함'));assert(s.includes('1,200,000원'));s=await html({result:{status:'recommend',items:[{...item,price:{price_source:null,total_krw:null}}]}});assert(s.includes('현재 판매가 정보 없음'));assert(!s.includes('>0원'))})
test('loading, error and no-match states are distinct and accessible',async()=>{assert((await html({loading:true})).includes('role="status"'));assert((await html({error:'서버 연결 오류'})).includes('role="alert"'));const s=await html({result:{status:'no_match',questions:['예산을 확인해 주세요.']}});assert(s.includes('추천 결과가 없어요'));assert(s.includes('예산을 확인해 주세요.'));assert(!s.includes('서버 제품'))})
test('clarify, keep and defer responses do not pretend to recommend products',async()=>{for(const status of ['clarify','keep','defer']){const s=await html({result:{status,items:[item],questions:['서버 질문']}});assert(s.includes('서버 질문'));assert(!s.includes('서버 제품'))}})
test('auth, profile conflict and server failures have separate user messages',()=>{assert.match(api.recommendationMessage({status:401}),/로그인/);assert.match(api.recommendationMessage({code:'PROFILE_INCOMPLETE'}),/프로필/);assert.match(api.recommendationMessage({code:'AI_TIMEOUT'}),/시간/);assert.match(api.recommendationMessage({code:'NETWORK_ERROR'}),/자동으로 다시 전송하지/);assert.match(api.recommendationMessage({status:503}),/완료하지 못/)} )

test('RecommendationResult renders skeleton loading layout and product spotlight showcase',async()=>{
  const skel=await html({loading:true})
  assert(skel.includes('result-skeleton-wrap'))
  assert(skel.includes('skeleton-result-card'))
  const rec=await html({result:{status:'recommend',items:[item]}})
  assert(rec.includes('product-stage-band'))
  assert(rec.includes('추천 01'))
  assert(rec.includes('spec-stat-grid'))
})

test('RecommendView renders 3-step guided wizard with budget presets, usage cards, and summary',async()=>{
  const appBtn=load('components/AppButton.vue').default
  const view=load('views/RecommendView.vue',{
    '../components/AppButton.vue':{__esModule:true,default:appBtn},
    '../components/RecommendationResult.vue':{__esModule:true,default:component},
    '../composables/useMemberApi':{useMemberApi:()=>async()=>({data:null})},
    'vue-router':{useRoute:()=>({query:{}})},
    '../api/recommendations':api
  }).default
  const app=vue.createSSRApp(view)
  for(const name of ['v-card','v-alert','v-btn','v-icon','router-link','AppButton'])app.component(name,{setup:(_,ctx)=>()=>vue.h('div',ctx.attrs,ctx.slots.default?.())})
  app.component('RecommendationResult',component)
  const s=await renderToString(app)
  assert(s.includes('wizard-steps-nav'))
  assert(s.includes('예산 설정'))
  assert(s.includes('사용 목적'))
  assert(s.includes('선호 제조사 · 실행'))
  assert(s.includes('50만 원 이하'))
  assert(s.includes('id="recommend-budget"'))
  assert(s.includes('wizard-summary-box'))
})

test('upgrade request preserves owned identity, reasons, satisfaction and preferences',()=>{
 const f={budget:'1000000',usages:['work'],brands:['samsung'],deviceId:'42',reason:'공간 부족',intent:'moderate',satisfied:['display'],pains:['storage'],os:'android',priorities:['portability']};
 const b=api.buildRecommendationRequest(f,2);assert.equal(b.replacement_device_id,'42');assert.equal(b.upgrade_context.pain_points[0],'storage');assert.equal(b.soft.preferred_os,'android');assert.throws(()=>api.buildRecommendationRequest({...f,reason:''},2));assert.throws(()=>api.buildRecommendationRequest({...f,deviceId:'other'},2));
})
test('upgrade comparison renders actual difference and explicitly unavailable camera data',async()=>{
 const s=await html({ownedVariantId:'10',result:{status:'recommend',items:[{...item,comparison_with_owned:{comparable:true,fields:{storage_gb:{status:'verified_comparison',current:128,candidate:256,unit:'GB'},camera:{status:'insufficient_data',note:'카메라 비교 자료 부족'}},improvements:['저장 용량 증가'],tradeoffs:[],cautions:[]}}]}});
 assert(s.includes('128 → 256'));assert(s.includes('카메라 비교 자료 부족'));assert(s.includes('현재 기기와 비교'));
 assert(s.includes('/compare?variants=10%2C42'));
});
test('general recommendation renders contextual /compare handoff link with candidate variant_id',async()=>{
 const s=await html({result:{status:'recommend',items:[item,{...item,variant_id:'77'}]}});
 assert(s.includes('/compare?variants=42%2C77'));
});
test('router maps /upgrade to RecommendView rather than PlaceholderView',()=>{
 const routerSource=fs.readFileSync(path.join(root,'router/index.js'),'utf8');
 assert(routerSource.includes("['/recommend','/upgrade'].includes(path)?()=>import('../views/RecommendView.vue')"));
});
test('RecommendView adapts heading on /upgrade route',async()=>{
 const appBtn=load('components/AppButton.vue').default;
 const view=load('views/RecommendView.vue',{
  '../components/AppButton.vue':{__esModule:true,default:appBtn},
  '../components/RecommendationResult.vue':{__esModule:true,default:component},
  '../composables/useMemberApi':{useMemberApi:()=>async()=>({data:null})},
  'vue-router':{useRoute:()=>({path:'/upgrade',query:{}})},
  '../api/recommendations':api
 }).default;
 const app=vue.createSSRApp(view);
 for(const name of ['v-card','v-alert','v-btn','v-icon','router-link','AppButton'])app.component(name,{setup:(_,ctx)=>()=>vue.h('div',ctx.attrs,ctx.slots.default?.())});
 app.component('RecommendationResult',component);
 const s=await renderToString(app);
 assert(s.includes('지금 스마트폰을 바꿀 때일까요?'));
});
