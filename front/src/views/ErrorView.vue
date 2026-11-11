<template><div class="section-wrap"><StatusPanel error :title="route.name === 'not-found' ? '페이지를 찾을 수 없어요' : '잠시 문제가 생겼어요'" description="주소를 확인하거나 홈에서 다시 시작해 주세요." /></div></template>
<script setup>import { useRoute } from 'vue-router'; import StatusPanel from '../components/StatusPanel.vue'; const route=useRoute()</script>
