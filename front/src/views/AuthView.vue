<template><section class="auth-page section-wrap"><v-card class="auth-card"><span class="eyebrow">MY LIFE, MY TECH</span><h1>{{ register?'회원가입':'다시 만나 반가워요' }}</h1><p>{{ register?'나에게 맞는 기기를 찾는 첫걸음.':'로그인하고 나의 선택을 이어가세요.' }}</p><p v-if="route.query.expired" role="status">세션이 만료됐어요. 다시 로그인해 주세요.</p><p v-if="route.query.registered" role="status" class="auth-success">가입이 완료됐어요. 로그인해 주세요.</p><p v-if="message" role="alert" class="auth-error">{{ message }}</p><form @submit.prevent="submit"><label for="email">이메일</label><input id="email" v-model="email" type="email" autocomplete="username" maxlength="254" required :disabled="busy"><label for="password">비밀번호</label><input id="password" v-model="password" type="password" :autocomplete="register?'new-password':'current-password'" required aria-describedby="password-help" :disabled="busy"><small id="password-help">8~128자 · 공백도 비밀번호에 포함됩니다.</small><template v-if="register"><label for="confirm">비밀번호 확인</label><input id="confirm" v-model="confirm" type="password" autocomplete="new-password" required :disabled="busy"></template><AppButton type="submit" block :loading="busy" :disabled="busy">{{ register?'회원가입':'로그인' }}</AppButton></form><router-link :to="register?'/login':'/register'">{{ register?'이미 계정이 있나요? 로그인':'처음이신가요? 회원가입' }}</router-link></v-card></section></template>
<script setup>
import {ref,computed,watch} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {useStore} from 'vuex'
import AppButton from '../components/AppButton.vue'
import {request} from '../api/client'
import {authMessage} from '../api/messages'
const route=useRoute(),router=useRouter(),store=useStore(),register=computed(()=>route.path==='/register')
const email=ref(''),password=ref(''),confirm=ref(''),busy=ref(false),message=ref('')
watch(()=>route.path,()=>{password.value='';confirm.value='';message.value=''})
async function submit(){
 if(busy.value)return;message.value=''
 const value=email.value.trim().toLowerCase()
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)||value.length>254){message.value='올바른 이메일 주소를 입력해 주세요.';return}
 if([...password.value].length<8||[...password.value].length>128||new TextEncoder().encode(password.value).length>512){message.value='비밀번호는 8~128자, UTF-8 512바이트 이하여야 합니다.';return}
 if(register.value&&password.value!==confirm.value){message.value='비밀번호 확인이 일치하지 않습니다.';return}
 busy.value=true
 try{const body={email:value,password:password.value};if(register.value){await request('/api/auth/register',{method:'POST',body});await router.replace('/login?registered=1')}else{await store.dispatch('login',body);const next=route.query.next;await router.replace(typeof next==='string'&&/^\/(?!\/)/.test(next)&&!next.includes('\\')?next:'/')}}catch(e){message.value=authMessage(e)}finally{busy.value=false;password.value='';confirm.value=''}
}
</script>
