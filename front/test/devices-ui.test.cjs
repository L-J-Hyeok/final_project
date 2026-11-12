const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {parse,compileScript}=require('@vue/compiler-sfc'),{transformSync}=require('@babel/core'),vue=require('vue'),{renderToString}=require('@vue/server-renderer')
const source=fs.readFileSync(path.resolve(__dirname,'../src/views/DevicesView.vue'),'utf8')
async function render(devices=[],offer=null){
 const seeded=source.replace('devices=ref([]),offer=ref(null),loaded=ref(false)',`devices=ref(${JSON.stringify(devices)}),offer=ref(${JSON.stringify(offer)}),loaded=ref(true)`)
 const js=compileScript(parse(seeded).descriptor,{id:'devices-test',inlineTemplate:true}).content
 const code=transformSync(js,{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code
 const button={setup:(_,ctx)=>()=>vue.h('button',ctx.attrs,ctx.slots.default?.())}
 const module={exports:{}};new Function('require','module','exports',code)(name=>name==='vue'?vue:name.includes('AppButton')?{default:button,__esModule:true}:name.includes('UpgradeNotice')?{default:{render:()=>null},__esModule:true}:name.includes('useMemberApi')?{useMemberApi:()=>()=>{throw Error('Real API forbidden')},memberMessage:()=>''}:require(name),module,module.exports)
 const app=vue.createSSRApp(module.exports.default)
 app.component('v-icon',{setup:(_,ctx)=>()=>vue.h('span',ctx.attrs,ctx.slots.default?.())})
 app.component('v-card',button)
 app.component('v-dialog',{render:()=>null})
 return renderToString(app)
}
const device={id:'1',category:'smartphone',source:'catalog',created_at:'2026-11-12T03:00:00Z',product:{brand:'Samsung',model_name:'Test phone',domestic_model_number:'TEST',storage_gb:256,ram_gb:null,color:null,verified:true}}
test('empty collection provides registration action',async()=>{const s=await render();assert(s.includes('첫 기기 등록'));assert(!s.includes('<article'))})
test('catalog identity, unknown specs, registration and actions',async()=>{const s=await render([device]);for(const text of ['Samsung','Test phone','256GB','정보 없음 / 정보 없음','등록일','2026년','카탈로그 연결','수정','삭제','대표 스마트폰으로 지정'])assert(s.includes(text),text);assert(!s.includes('undefined'));assert(!s.includes('<img'))})
test('current phone is labelled',async()=>{const s=await render([device],{current_device:{owned_device_id:'1'}});assert(s.includes('현재 사용 중인 대표 스마트폰'));assert(!s.includes('대표 스마트폰으로 지정'))})
test('manual RAM does not masquerade as storage',async()=>{const s=await render([{id:'2',category:'ram',source:'manual',manual_brand:'제조사',manual_model_name:'메모리',manual_specs_json:{capacity_gb:16,note:null}}]);assert(s.includes('수동 등록 · 미검증 정보'));assert(s.includes('<details'));assert(s.includes('RAM 용량 (GB)'));assert(!s.includes('<dt>저장 용량</dt>'));assert(s.includes('정보 없음'))})
