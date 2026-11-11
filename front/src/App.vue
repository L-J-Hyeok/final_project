<template>
<v-app>
<a href="#main-content" class="skip-link">본문으로 건너뛰기</a>
<header class="site-header"><div class="header-inner">
<router-link to="/" class="brand" aria-label="기기로운 홈"><span class="brand-mark">g.</span>기기로운<span class="brand-caption">내게 맞는 기술</span></router-link>
<nav class="desktop-nav" aria-label="주 메뉴"><router-link v-for="n in navigation" :key="n.to" :to="n.to">{{ n.label }}</router-link></nav>
<div class="header-actions"><router-link v-if="!store.state.user" to="/login" class="login-link">로그인</router-link><button v-else class="login-link" :disabled="loggingOut" @click="logout">{{ loggingOut ? '처리 중…' : '로그아웃' }}</button><AppButton to="/recommend" class="header-cta">추천 시작하기</AppButton><v-btn class="menu-toggle" variant="text" :aria-expanded="menu" aria-controls="mobile-menu" :aria-label="menu ? '메뉴 닫기' : '메뉴 열기'" @click="menu = !menu"><v-icon :icon="menu ? 'mdi-close' : 'mdi-menu'" /></v-btn></div>
</div><nav v-if="menu" id="mobile-menu" class="mobile-nav" aria-label="모바일 메뉴" @keydown.esc="closeMenu"><router-link v-for="n in [...navigation, {to:'/login',label:'로그인'}, {to:'/register',label:'회원가입'}]" :key="n.to" :to="n.to">{{ n.label }}</router-link></nav></header>
<v-main><p v-if="logoutError" class="auth-error section-wrap" role="alert">{{ logoutError }}</p><main id="main-content" tabindex="-1"><StatusPanel v-if="renderError" error title="화면을 표시하지 못했어요" description="홈으로 이동하거나 페이지를 새로고침해 주세요." /><router-view v-else /></main></v-main>
<footer class="site-footer"><div><router-link to="/" class="brand">기기로운</router-link><p>더 많은 선택보다, 나에게 맞는 선택.</p></div><div class="footer-links"><router-link to="/profile">내 프로필</router-link><router-link to="/history">추천 이력</router-link><router-link to="/pc">조립 PC · 예정</router-link></div><small>스마트폰 MVP · 화면 개발 중</small></footer>
</v-app>
</template>
<script setup>
import { ref, watch, onErrorCaptured, nextTick } from 'vue'
import { useStore } from 'vuex'
import { authMessage } from './api/messages'
import { useRouter } from 'vue-router'
import { useRoute } from 'vue-router'
import AppButton from './components/AppButton.vue'
import StatusPanel from './components/StatusPanel.vue'
const store=useStore(), router=useRouter(), loggingOut=ref(false), logoutError=ref('')
async function logout(){if(loggingOut.value)return;loggingOut.value=true;logoutError.value='';try{await store.dispatch('logout');await router.replace('/login')}catch(e){logoutError.value=authMessage(e)}finally{loggingOut.value=false}}
const route=useRoute(), menu=ref(false), renderError=ref(false)
const navigation=[{to:'/recommend',label:'AI 제품 추천'},{to:'/compare',label:'제품 스펙 비교'},{to:'/devices',label:'보유 기기'},{to:'/upgrade',label:'업그레이드'}]
function closeMenu(){menu.value=false;nextTick(()=>document.querySelector('.menu-toggle')?.focus())}
watch(()=>route.fullPath,async()=>{menu.value=false;renderError.value=false;await nextTick();document.getElementById('main-content')?.focus()})
onErrorCaptured(()=>{renderError.value=true;return false})
</script>
