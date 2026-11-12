<template>
  <v-btn
    :variant="secondary ? 'outlined' : 'flat'"
    :color="secondary ? 'secondary' : 'primary'"
    size="large"
    rounded="pill"
  >
    <slot />
  </v-btn>
</template>
<script setup>
defineProps({ secondary: Boolean })
</script>
