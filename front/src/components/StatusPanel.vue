<template><section class="status-panel" :role="error ? 'alert' : 'status'"><span class="eyebrow">{{ error ? '다시 확인해 주세요' : '화면 연결 준비 중' }}</span><h1>{{ title }}</h1><p>{{ description }}</p><AppButton to="/">홈으로 돌아가기</AppButton></section></template>
<script setup>
import AppButton from './AppButton.vue'
defineProps({ title: String, description: String, error: Boolean })
</script>
