<template><v-card class="member-card upgrade-notice"><h2>현재 스마트폰 안내</h2>
  <p v-if="!offer.has_owned_smartphone">스마트폰을 등록하면 공식 출시일을 기준으로 안내해 드려요.</p>
  <template v-else><h3>{{ device.verified_model_name || '현재 스마트폰' }}</h3>
    <p v-if="offer.needs_verification">정보 확인 필요: 모델이나 국내 공식 출시일을 확인할 수 없어요. 정확한 모델번호로 수정하거나 카탈로그에서 선택해 주세요.</p>
    <template v-else><p>국내 공식 출시일: {{ device.official_release_date_kr || '정보 없음' }}</p><p>{{ offer.upgrade_offer_eligible ? '출시 후 3년 이상 경과한 스마트폰입니다.' : '아직 출시 후 3년이 지나지 않았습니다.' }}</p></template>
    <p v-if="device.dismissed_permanently">이 기기의 업그레이드 제안을 숨겼어요.</p><p v-else-if="device.notification_state==='snoozed'">{{ date(device.snoozed_until) }}까지 안내를 미뤘어요.</p>
    <div v-if="offer.should_show_popup" class="upgrade-banner"><h3>교체가 필요한지 차분히 살펴보세요</h3><p>3년 경과가 교체 필요성을 뜻하지는 않아요. 현재 기기를 계속 사용하는 것도 좋은 선택입니다.</p><div class="member-actions"><AppButton secondary :disabled="busy" @click="$emit('action','snooze',device.owned_device_id)">나중에 보기 ({{ offer.snooze_policy_days }}일)</AppButton><AppButton secondary :disabled="busy" @click="$emit('action','dismiss_permanent',device.owned_device_id)">이 기기에서는 다시 표시하지 않기</AppButton></div></div>
    <small>개인 구매일이나 사용 기간이 아닌 제품의 국내 공식 출시일 기준입니다.</small>
  </template><p class="member-footnote">출시 경과 기간과 관계없이 일반 추천을 이용할 수 있습니다. 유지와 교체를 비교해 보세요.</p><router-link class="text-link" :to="device.owned_device_id ? '/recommend?device='+device.owned_device_id : '/recommend'">유지·교체 판단하기 →</router-link>
</v-card></template>
<script setup>
import {computed} from 'vue'
import AppButton from './AppButton.vue'
const props=defineProps({offer:{type:Object,required:true},busy:Boolean})
defineEmits(['action'])
const device=computed(()=>props.offer.current_device||{})
function date(value){return value?new Date(value).toLocaleDateString('ko-KR'):'안내된 날짜'}
</script>
