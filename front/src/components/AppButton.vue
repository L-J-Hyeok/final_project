<template><v-btn :variant="secondary ? 'outlined' : 'flat'" :color="secondary ? 'secondary' : 'primary'" size="large"><slot /></v-btn></template>
<script setup>defineProps({ secondary: Boolean })</script>
