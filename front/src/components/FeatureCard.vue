<template><v-card class="feature-card" tag="article"><div class="feature-icon"><v-icon :icon="icon" /></div><h3>{{ title }}</h3><p><slot /></p></v-card></template>
<script setup>defineProps({ icon: String, title: String })</script>
