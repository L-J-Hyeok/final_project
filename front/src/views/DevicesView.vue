<template>
<section class="member-page section-wrap">
  <header class="member-heading"><span class="eyebrow">MY DEVICES</span><h1>함께 쓰는 기기</h1><p>오래된 기기도 등록할 수 있어요. 정확한 모델을 선택하거나 직접 입력하세요.</p></header>
  <p v-if="loading" role="status">보유 기기를 불러오는 중입니다.</p><p v-if="error" role="alert" class="auth-error">{{ error }}</p><p v-if="success" role="status" class="auth-success">{{ success }}</p>
  <div class="member-actions"><AppButton :disabled="busy || loading || !loaded" @click="start()">기기 등록</AppButton><AppButton secondary :disabled="busy || loading" @click="load">목록 새로고침</AppButton></div>
  <UpgradeNotice v-if="offer" :offer="offer" :busy="busy || loading" @action="changeState" />
  <div v-if="loaded && !devices.length && !error" class="devices-empty">
    <v-icon size="48" aria-hidden="true">mdi-devices</v-icon>
    <h2>나의 첫 기기를 등록해 보세요</h2>
    <p>지금 쓰는 스마트폰부터 오래된 기기까지.<br>모델을 검색하거나 직접 입력할 수 있어요.</p>
    <AppButton :disabled="busy || loading" @click="start()">첫 기기 등록</AppButton>
  </div>
  <div v-if="devices.length" class="devices-list-heading"><h2>내 기기 <span>{{ devices.length }}</span></h2><p>대표 스마트폰을 기준으로 업그레이드를 안내해 드려요.</p></div>
  <div class="devices-grid" :aria-busy="loading">
    <article v-for="d in devices" :key="d.id" class="device-card" :aria-labelledby="'device-title-'+d.id">
      <div class="device-stage">
        <span class="device-category">{{ categories[d.category] || d.category }}</span>
        <span v-if="current(d)" class="device-current">대표 스마트폰</span>
        <v-icon size="76" aria-hidden="true">{{ deviceIcon(d.category) }}</v-icon>
      </div>
      <div class="device-content">
        <p class="device-brand">{{ d.product?.brand || d.manual_brand || '제조사 정보 없음' }}</p>
        <h3 :id="'device-title-'+d.id">{{ d.product?.model_name || d.manual_model_name || '모델명 정보 없음' }}</h3>
        <p class="device-role">{{ current(d) ? '현재 사용 중인 대표 스마트폰' : '기타 보유 기기' }}</p>
        <dl class="device-facts">
          <div><dt>모델번호</dt><dd>{{ d.product?.domestic_model_number || d.manual_model_number || '정보 없음' }}</dd></div>
          <div v-if="['smartphone','laptop','tablet','pc','ssd'].includes(d.category)"><dt>저장 용량</dt><dd>{{ capacity(d.product?.storage_gb ?? d.manual_storage_gb) }}</dd></div>
          <div v-if="d.product"><dt>RAM / 색상</dt><dd>{{ capacity(d.product.ram_gb) }} / {{ d.product.color || '정보 없음' }}</dd></div>
          <div><dt>등록일</dt><dd>{{ registeredDate(d.created_at) }}</dd></div>
        </dl>
        <details v-if="Object.keys(d.manual_specs_json || {}).length" class="device-details"><summary>직접 입력한 사양</summary><dl class="device-facts"><div v-for="(value,key) in d.manual_specs_json" :key="key"><dt>{{ specs[key]?.label || key }}</dt><dd>{{ value ?? '정보 없음' }}</dd></div></dl></details>
        <p class="device-source">{{ d.source==='manual'?'수동 등록 · 미검증 정보':'카탈로그 연결' }}<small>{{ d.source==='manual'?'입력한 사양은 성능·호환성 판정에 사용하지 않아요.':d.product?.verified?'호환성은 별도로 확인해 주세요.':'모델 정보 확인이 필요해요.' }}</small></p>
        <div class="device-actions"><AppButton v-if="d.category==='smartphone'" secondary :to="'/recommend?device='+d.id">유지·교체 판단하기</AppButton><AppButton secondary :disabled="busy || loading" :aria-label="title(d)+' 수정'" @click="start(d)">수정</AppButton><AppButton secondary :disabled="busy || loading" :aria-label="title(d)+' 삭제'" @click="remove(d)">삭제</AppButton></div>
        <AppButton v-if="d.category==='smartphone' && !current(d)" class="device-primary-action" secondary :disabled="busy || loading" @click="changeState('set_current',d.id)">대표 스마트폰으로 지정</AppButton>
      </div>
    </article>
  </div>
  <v-dialog v-model="editor" max-width="760" :persistent="busy || searching">
    <v-card class="member-card device-editor"><h2 id="device-editor-title">{{ editingId?'기기 정보 수정':'기기 등록' }}</h2><p v-if="editingId">기기 정보를 수정해도 과거 추천 이력은 보존됩니다. 이 기기의 숨김 설정은 초기화됩니다.</p>
      <p v-if="formError" role="alert" class="auth-error">{{ formError }}</p>
      <form class="member-form" aria-labelledby="device-editor-title" @submit.prevent="save">
        <fieldset :disabled="busy || searching">
          <fieldset v-if="!editingId" class="choice-group"><legend>등록 방식</legend><label><input v-model="mode" type="radio" value="catalog">스마트폰 검색</label><label><input v-model="mode" type="radio" value="manual">직접 입력</label></fieldset>
          <template v-if="mode==='catalog'">
            <label for="device-query">제조사·모델명·모델번호 검색</label><div class="search-row"><input id="device-query" v-model="query" maxlength="100" placeholder="예: samsung, apple, 모델번호" @keydown.enter.prevent="search(false)"><AppButton secondary type="button" @click="search(false)">검색</AppButton></div>
            <p v-if="searchError" role="alert" class="auth-error">{{ searchError }}</p><p v-if="searched && !options.length" role="status">검색 결과가 없어요. 다른 검색어를 사용하거나 직접 입력해 주세요.</p>
            <fieldset class="search-options"><legend>정확한 모델과 옵션 선택</legend><label v-for="p in options" :key="p.id"><input v-model="selected" type="radio" :value="p.id"><span>{{ p.brand }} {{ p.model_name }} · {{ capacity(p.storage_gb) }}<small>{{ p.domestic_model_number }} · RAM {{ capacity(p.ram_gb) }} · {{ p.color || '색상 정보 없음' }} · {{ p.verified?'검증됨':'정보 확인 필요' }}{{ p.is_test?' · 테스트 데이터':'' }}</small></span></label></fieldset>
            <AppButton v-if="cursor" secondary type="button" @click="search(true)">검색 결과 더 보기</AppButton>
            <p v-if="selected">선택한 옵션 ID: {{ selected }}</p><small>출시 3년 제한 없이 검색합니다. 같은 모델의 여러 기기를 등록할 수 있습니다.</small>
          </template>
          <template v-else>
            <label for="category">제품 유형</label><select id="category" v-model="manual.category" :disabled="!!editingId" @change="resetSpecs"><option v-for="(label,key) in categories" :key="key" :value="key">{{ label }}</option></select>
            <div class="member-grid"><div><label for="brand">제조사 · 필수</label><input id="brand" v-model="manual.manual_brand" required maxlength="80"></div><div><label for="model-name">모델명 · 필수</label><input id="model-name" v-model="manual.manual_model_name" required maxlength="120"></div></div>
            <label for="model-number">정확한 모델번호 · 선택</label><input id="model-number" v-model="manual.manual_model_number" maxlength="80">
            <template v-if="hasStorage"><label for="storage">저장 용량 (GB) · 선택</label><input id="storage" v-model="manual.manual_storage_gb" type="number" min="1" max="2147483647" step="1"></template>
            <div class="member-grid"><div v-for="key in specKeys[manual.category]" :key="key"><label :for="'spec-'+key">{{ specs[key].label }} · 선택</label><input :id="'spec-'+key" v-model="manual.manual_specs_json[key]" :type="specs[key].number?'number':'text'" :min="specs[key].number?1:undefined" :max="specs[key].number?1000000:undefined" :step="specs[key].number?1:undefined" :maxlength="key==='note'?300:120"></div></div>
            <p>수동 정보는 미검증으로 저장됩니다. 출시일은 추측하지 않으며 성능이나 PC 부품 호환성 판정에 자동 사용하지 않습니다.</p>
          </template>
          <label v-if="manual.category==='smartphone' || mode==='catalog'" class="check-line"><input v-model="makeCurrent" type="checkbox">저장 후 현재 대표 스마트폰으로 지정</label>
        </fieldset>
        <p v-if="searching" role="status">검색 중입니다.</p><div class="member-actions"><AppButton type="submit" :loading="busy" :disabled="busy || searching">{{ editingId?'수정 저장':'등록' }}</AppButton><AppButton secondary type="button" :disabled="busy || searching" @click="editor=false">취소</AppButton></div>
      </form>
    </v-card>
  </v-dialog>
</section>
</template>
<script setup>
import {ref,computed,onMounted} from 'vue'
import AppButton from '../components/AppButton.vue'
import UpgradeNotice from '../components/UpgradeNotice.vue'
import {useMemberApi,memberMessage} from '../composables/useMemberApi'
const api=useMemberApi(),devices=ref([]),offer=ref(null),loaded=ref(false),loading=ref(false),busy=ref(false),error=ref(''),success=ref('')
const editor=ref(false),editingId=ref(null),mode=ref('catalog'),query=ref(''),options=ref([]),selected=ref(null),cursor=ref(null),searched=ref(false),searching=ref(false),searchError=ref(''),formError=ref(''),makeCurrent=ref(true)
let searchQuery=''
const categories={smartphone:'스마트폰',laptop:'노트북',tablet:'태블릿',watch:'스마트워치',monitor:'모니터',pc:'데스크톱 PC',cpu:'CPU',gpu:'GPU',ram:'RAM',ssd:'SSD',motherboard:'메인보드',psu:'파워서플라이',case:'케이스',cooler:'쿨러',other:'기타'}
const specKeys={smartphone:['ram_gb','processor_model','gpu_model','os_name'],laptop:['ram_gb','processor_model','gpu_model','os_name'],tablet:['ram_gb','processor_model','gpu_model','os_name'],pc:['ram_gb','processor_model','gpu_model','os_name'],cpu:['socket','cores'],gpu:['vram_gb','power_w'],ram:['capacity_gb','memory_standard','speed_mt_s','module_count'],ssd:['interface','form_factor'],motherboard:['socket','memory_standard','form_factor'],psu:['rated_power_w'],case:['form_factor'],cooler:['form_factor'],watch:['note'],monitor:['note'],other:['note']}
const specs={ram_gb:{label:'RAM (GB)',number:true},processor_model:{label:'CPU / 칩셋'},gpu_model:{label:'GPU 모델'},os_name:{label:'운영체제'},socket:{label:'소켓'},cores:{label:'코어 수',number:true},vram_gb:{label:'VRAM (GB)',number:true},power_w:{label:'소비 전력 (W)',number:true},capacity_gb:{label:'RAM 용량 (GB)',number:true},memory_standard:{label:'메모리 규격'},speed_mt_s:{label:'메모리 속도 (MT/s)',number:true},module_count:{label:'모듈 수',number:true},interface:{label:'인터페이스'},form_factor:{label:'폼팩터'},rated_power_w:{label:'정격 출력 (W)',number:true},note:{label:'메모'}}
const blank=()=>({category:'smartphone',manual_brand:'',manual_model_name:'',manual_model_number:'',manual_storage_gb:'',manual_specs_json:{}})
const manual=ref(blank()),hasStorage=computed(()=>['smartphone','laptop','tablet','pc','ssd'].includes(manual.value.category))
const current=d=>String(offer.value?.current_device?.owned_device_id)===String(d.id)
const title=d=>d.product?`${d.product.brand} ${d.product.model_name}`:`${d.manual_brand} ${d.manual_model_name}`
const deviceIcon=category=>({smartphone:'mdi-cellphone',laptop:'mdi-laptop',tablet:'mdi-tablet',watch:'mdi-watch',monitor:'mdi-monitor',pc:'mdi-desktop-tower',cpu:'mdi-chip',gpu:'mdi-expansion-card',ram:'mdi-memory',ssd:'mdi-harddisk'}[category] || 'mdi-devices')
const registeredDate=value=>{if(!value)return '정보 없음';const date=new Date(value);return Number.isNaN(date.getTime())?'정보 없음':new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric'}).format(date)}
const capacity=v=>v===null||v===undefined||v===''?'정보 없음':`${v}GB`
async function load(){loading.value=true;error.value='';try{const [d,o]=await Promise.all([api('/api/owned-devices?limit=50'),api('/api/upgrade-offer')]);devices.value=d.data;offer.value=o.data;loaded.value=true;return true}catch(e){error.value=memberMessage(e);return false}finally{loading.value=false}}
function start(d){editingId.value=d?.id||null;mode.value=d?.source||'catalog';query.value='';searchQuery='';options.value=d?.product?[d.product]:[];selected.value=d?.variant_id||null;cursor.value=null;searched.value=false;formError.value='';searchError.value='';manual.value=d?.source==='manual'?{category:d.category,manual_brand:d.manual_brand,manual_model_name:d.manual_model_name,manual_model_number:d.manual_model_number||'',manual_storage_gb:d.manual_storage_gb??'',manual_specs_json:{...d.manual_specs_json}}:blank();makeCurrent.value=d?current(d):true;editor.value=true}
function resetSpecs(){manual.value.manual_specs_json={};manual.value.manual_storage_gb=''}
async function search(more){if(searching.value)return;const entered=query.value.trim();const q=more?searchQuery:({'삼성':'samsung','삼성전자':'samsung','애플':'apple'}[entered]||entered);if(!q){searchError.value='검색어를 입력해 주세요.';return}searching.value=true;searchError.value='';if(!more){options.value=[];selected.value=null;cursor.value=null;searched.value=false;searchQuery=q}try{const r=await api(`/api/owned-device-options?q=${encodeURIComponent(q)}${more&&cursor.value?'&cursor='+cursor.value:''}`);options.value=more?[...options.value,...r.data]:r.data;cursor.value=r.next_cursor;searched.value=true}catch(e){searchError.value=memberMessage(e)}finally{searching.value=false}}
function payload(){if(mode.value==='catalog'){if(!selected.value)throw new Error('정확한 모델과 옵션을 선택해 주세요.');return {variant_id:selected.value}}const m=manual.value;if(!m.manual_brand.trim()||!m.manual_model_name.trim())throw new Error('제조사와 모델명을 입력해 주세요.');const out={...m,manual_model_number:m.manual_model_number.trim()||null,manual_specs_json:{}};delete out.manual_storage_gb;if(hasStorage.value)out.manual_storage_gb=m.manual_storage_gb===''?null:Number(m.manual_storage_gb);for(const [k,v] of Object.entries(m.manual_specs_json)){out.manual_specs_json[k]=v===null||String(v).trim()===''?null:specs[k]?.number?Number(v):String(v).trim()}return out}
async function save(){if(busy.value||searching.value)return;formError.value='';let body;try{body=payload()}catch(e){formError.value=e.message;return}
 const duplicate=devices.value.some(d=>d.id!==editingId.value&&(body.variant_id?d.variant_id===body.variant_id:d.source==='manual'&&d.category===body.category&&d.manual_brand===body.manual_brand&&d.manual_model_name===body.manual_model_name&&d.manual_model_number===(body.manual_model_number||null)&&d.manual_storage_gb===(body.manual_storage_gb??null)))
 if(duplicate&&!window.confirm('같은 모델이 이미 등록되어 있어요. 별도로 보유한 기기로 저장할까요?'))return
 busy.value=true;success.value='';error.value='';try{const r=await api(editingId.value?`/api/owned-devices/${editingId.value}`:'/api/owned-devices',{method:editingId.value?'PUT':'POST',body});editor.value=false;success.value='기기를 저장했어요.';if(makeCurrent.value&&r.data.device.category==='smartphone'){try{await api('/api/upgrade-offer/state',{method:'PUT',body:{action:'set_current',owned_device_id:r.data.device.id}})}catch(e){success.value='기기는 저장됐지만 대표 기기 지정은 실패했어요. 목록에서 다시 지정해 주세요.'}}const refreshed=await load();if(!refreshed)success.value+=' 최신 목록을 불러오지 못했어요. 다시 등록하지 말고 목록을 새로고침해 주세요.'}catch(e){formError.value=memberMessage(e)}finally{busy.value=false}}
async function changeState(action,id){if(busy.value||loading.value)return;busy.value=true;error.value='';success.value='';try{offer.value=(await api('/api/upgrade-offer/state',{method:'PUT',body:{action,owned_device_id:String(id)}})).data;success.value=action==='set_current'?'대표 스마트폰을 변경했어요.':action==='snooze'?'업그레이드 안내를 나중으로 미뤘어요.':'이 기기의 업그레이드 제안을 숨겼어요.'}catch(e){error.value=memberMessage(e)}finally{busy.value=false}}
async function remove(d){if(busy.value||!window.confirm(`${title(d)} 기기를 삭제할까요? 이 기기의 숨김 설정은 삭제하고 과거 추천 이력은 당시 정보로 보존합니다.`))return;busy.value=true;success.value='';try{await api(`/api/owned-devices/${d.id}`,{method:'DELETE'});success.value='기기를 삭제했어요.';await load()}catch(e){error.value=memberMessage(e)}finally{busy.value=false}}
onMounted(load)
</script>

<style scoped>
.devices-list-heading { display:flex; justify-content:space-between; align-items:baseline; gap:16px; margin:32px 0 16px; }
.devices-list-heading h2 { font-size:20px; white-space:nowrap; }
.devices-list-heading h2 span { color:#71717a; margin-left:6px; }
.devices-list-heading p, .device-role { color:#52525b; font-size:14px; }
.devices-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:24px; }
.device-card { min-width:0; overflow:hidden; border:1px solid var(--border-hairline,#e5e5e7); border-radius:24px; background:#fff; display:flex; flex-direction:column; }
.device-stage { position:relative; display:flex; justify-content:center; align-items:center; min-height:190px; padding:56px 24px 24px; background:var(--surface-gray,#f5f5f7); color:var(--ink-black,#111); }
.device-category, .device-current { position:absolute; top:20px; font-size:12px; line-height:24px; }
.device-category { left:20px; color:#52525b; }
.device-current { right:20px; padding:0 10px; border-radius:99px; background:#111; color:#fff; }
.device-content { padding:24px; display:flex; flex-direction:column; flex:1; }
.device-brand { font-size:12px; color:#52525b; margin:0 0 6px; }
.device-content h3 { font-size:24px; line-height:1.3; letter-spacing:-.03em; overflow-wrap:anywhere; }
.device-role { margin:8px 0 20px; }
.device-facts { margin:0; font-size:14px; }
.device-facts > div { display:grid; grid-template-columns:90px minmax(0,1fr); gap:12px; padding:8px 0; }
.device-facts dt { color:#52525b; }
.device-facts dd { margin:0; overflow-wrap:anywhere; color:#111; }
.device-details { margin-top:12px; font-size:14px; }
.device-details summary { cursor:pointer; min-height:44px; padding:12px 0; }
.device-source { margin:20px 0; border-top:1px solid #e5e5e7; padding-top:16px; font-size:12px; color:#52525b; }
.device-source small { display:block; margin-top:4px; font-size:12px; line-height:1.6; }
.device-actions { display:flex; gap:10px; margin-top:auto; }
.device-actions > * { flex:1; min-width:0; }
.device-primary-action { margin-top:10px; width:100%; }
.devices-empty { text-align:center; padding:64px 24px; margin-top:24px; background:var(--surface-gray,#f5f5f7); border-radius:24px; }
.devices-empty h2 { margin:20px 0 12px; font-size:24px; }
.devices-empty p { color:#52525b; line-height:1.8; margin-bottom:24px; }
.device-card :focus-visible, .devices-empty :focus-visible { outline:2px solid #111; outline-offset:4px; }
@media(max-width:700px) { .devices-grid { grid-template-columns:minmax(0,1fr); gap:20px; } .devices-list-heading { align-items:flex-start; flex-direction:column; gap:6px; } .device-content { padding:20px; } .device-content h3 { font-size:22px; } }
@media(prefers-reduced-motion:reduce) { .search-options label { transition:none !important; } }
.search-options label {
  padding: 12px 10px;
  border-radius: 8px;
  transition: background-color 0.12s ease;
  cursor: pointer;
}
.search-options label:hover {
  background: #f5f5f7;
}
.choice-group label {
  display: inline-flex !important;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 6px 14px;
  border: 1px solid #e5e5e7;
  border-radius: 10px;
  background: #ffffff;
  cursor: pointer;
}
.choice-group label:has(input:checked) {
  background: #f5f5f7;
  border-color: #111111;
  font-weight: 650;
}
</style>
