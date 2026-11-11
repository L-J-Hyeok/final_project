<template>
  <section class="member-page section-wrap">
    <header class="member-heading"><span class="eyebrow">MY PROFILE</span><h1>나의 생활과 취향</h1><p>자주 하는 일과 중요하게 생각하는 것을 알려 주세요.</p></header>
    <v-card class="member-card"><h2>회원 정보</h2><p class="member-email">{{ store.state.user?.email }}</p><router-link class="text-link" to="/devices">보유 기기 관리하기 →</router-link></v-card>
    <p v-if="loading" role="status">프로필을 불러오는 중입니다.</p>
    <p v-if="error" role="alert" class="auth-error">{{ error }}</p>
    <p v-if="success" role="status" class="auth-success">{{ success }}</p>
    <AppButton v-if="error" secondary :disabled="busy || loading" @click="reload">최신 정보 다시 불러오기</AppButton>
    <form v-if="form" class="member-form" @submit.prevent="save">
      <fieldset :disabled="busy || loading">
        <v-card class="member-card"><h2>공통 성향</h2><p v-if="!confirmed">아직 저장한 성향이 없어요. 필수 항목부터 선택해 주세요.</p>
          <fieldset class="choice-group"><legend>주요 사용 목적 · 필수, 1개 이상</legend><label v-for="(label,key) in usages" :key="key"><input type="checkbox" v-model="form.common.usages" :value="key">{{ label }}</label></fieldset>
          <label for="spending">구매 성향 · 필수</label><select id="spending" v-model="form.common.spending_style" required><option value="" disabled>선택해 주세요</option><option value="value">가성비 중심</option><option value="balanced">균형 중심</option><option value="premium">프리미엄 중심</option></select>
          <div class="member-grid"><div><label for="mobility">이동 빈도</label><select id="mobility" v-model="form.common.mobility"><option :value="null">선택 안 함</option><option value="low">낮음</option><option value="medium">보통</option><option value="high">높음</option></select></div><div><label for="ecosystem">사용 중인 모바일 생태계</label><select id="ecosystem" v-model="form.common.ecosystem"><option :value="null">선택 안 함</option><option value="none">없음</option><option value="android">Android</option><option value="apple">Apple</option><option value="mixed">함께 사용</option></select></div></div>
          <label for="lifestyle">생활스타일과 추가 요구사항 · 선택</label><textarea id="lifestyle" v-model="form.common.lifestyle_note" maxlength="300" rows="4" aria-describedby="note-help"></textarea><small id="note-help">최대 300자. 입력한 내용을 그대로 저장하며 AI로 분석하지 않습니다.</small>
        </v-card>
        <v-card class="member-card"><h2>스마트폰 선호</h2><fieldset class="choice-group"><legend>선호 브랜드 · 선택</legend><label><input v-model="form.smartphone.preferred_brands" type="checkbox" value="samsung">삼성</label><label><input v-model="form.smartphone.preferred_brands" type="checkbox" value="apple">애플</label></fieldset>
          <label for="os">선호 운영체제</label><select id="os" v-model="form.smartphone.preferred_os"><option :value="null">선호 없음</option><option value="android">Android</option><option value="ios">iOS</option></select>
          <fieldset class="choice-group"><legend>중요한 항목 · 선택 순서대로 최대 3개</legend><label v-for="(label,key) in priorities" :key="key"><input v-model="form.smartphone.priorities" type="checkbox" :value="key" :disabled="form.smartphone.priorities.length>=3 && !form.smartphone.priorities.includes(key)">{{ label }}</label></fieldset>
          <p>우선순위: {{ form.smartphone.priorities.map(k=>priorities[k]).join(' → ') || '선호 없음' }}</p><small>순서를 바꾸려면 선택을 해제한 뒤 원하는 순서로 다시 선택하세요.</small>
        </v-card>
        <p>이번 구매의 예산과 필수 조건은 추천 요청 단계에서 별도로 입력합니다.</p>
        <div class="member-actions"><AppButton type="submit" :loading="busy" :disabled="busy || conflict">확인하고 저장</AppButton><AppButton secondary type="button" @click="reload">저장된 정보 다시 불러오기</AppButton></div>
      </fieldset>
    </form>
  </section>
</template>
<script setup>
import { ref,onMounted } from 'vue'
import { useStore } from 'vuex'
import AppButton from '../components/AppButton.vue'
import { useMemberApi,memberMessage } from '../composables/useMemberApi'
const api=useMemberApi(),store=useStore(),form=ref(null),loading=ref(false),busy=ref(false),error=ref(''),success=ref(''),confirmed=ref(false),conflict=ref(false)
const usages={communication:'연락·소통',video:'영상 시청',coding:'코딩',gaming:'게임',camera:'사진·영상 촬영',work:'업무'}
const priorities={battery:'배터리',camera:'카메라',performance:'성능',portability:'휴대성',display:'화면'}
let baseline=''
function apply(p){form.value={expected_version:p.version,common:{usages:[],spending_style:'',mobility:null,ecosystem:null,lifestyle_note:null,...p.common},smartphone:{preferred_brands:[],priorities:[],preferred_os:null,...p.smartphone}};confirmed.value=!!p.confirmed_at;baseline=JSON.stringify(form.value);conflict.value=false}
async function load(){loading.value=true;error.value='';try{apply((await api('/api/profile')).data)}catch(e){error.value=memberMessage(e)}finally{loading.value=false}}
function reload(){if(form.value&&JSON.stringify(form.value)!==baseline&&!window.confirm('입력 중인 내용을 버리고 저장된 정보를 불러올까요?'))return;success.value='';load()}
async function save(){if(busy.value||conflict.value)return;error.value='';success.value='';if(!form.value.common.usages.length){error.value='주요 사용 목적을 1개 이상 선택해 주세요.';return}busy.value=true;try{const body=JSON.parse(JSON.stringify(form.value));body.common.lifestyle_note=body.common.lifestyle_note?.trim()||null;apply((await api('/api/profile',{method:'PUT',body})).data);success.value='프로필을 저장했어요.'}catch(e){error.value=memberMessage(e);conflict.value=e.code==='PROFILE_CHANGED'}finally{busy.value=false}}
onMounted(load)
</script>
