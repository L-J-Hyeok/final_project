<template>
  <div v-if="conversation" class="member-card">
    <h2>상담 조건 확인</h2>
    <p>{{ conversation.text }}</p>
    <ul>
      <li v-if="conversation.confirmed?.budget_max_krw">최대 예산 {{ conversation.confirmed.budget_max_krw.toLocaleString('ko-KR') }}원</li>
      <li v-if="conversation.confirmed?.budget_unlimited">예산 상한 없음</li>
      <li v-if="conversation.confirmed?.max_weight_g">최대 무게 {{ conversation.confirmed.max_weight_g }}g</li>
      <li v-if="conversation.confirmed?.min_storage_gb">최소 저장 용량 {{ conversation.confirmed.min_storage_gb }}GB</li>
      <li v-for="condition in conversation.confirmed?.unsupported_requirements || []" :key="condition">확인 불가한 필수 조건: {{ condition }}</li>
    </ul>
    <form v-for="question in questions" :key="question.id" @submit.prevent="submit(question)">
      <fieldset :disabled="busy">
        <legend>{{ question.label }}</legend>
        <template v-if="question.type === 'multiple'">
          <label v-for="option in question.options" :key="option.value">
            <input type="checkbox" :value="option.value" v-model="drafts[question.id]"> {{ option.label }}
          </label>
        </template>
        <select v-else-if="question.type === 'choice'" v-model="drafts[question.id]" :aria-label="question.label" required>
          <option value="" disabled>선택해 주세요</option>
          <option v-for="option in question.options" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
        <input v-else-if="question.type === 'number'" v-model.number="drafts[question.id]" type="number"
          :aria-label="question.label" :min="question.min" :max="question.max" step="1" :required="!question.optional">
        <textarea v-else v-model.trim="drafts[question.id]" :aria-label="question.label" maxlength="300" required />
        <AppButton type="submit">{{ Object.hasOwn(question, 'answer') ? '이 답변 수정' : '답변 제출' }}</AppButton>
        <button v-if="question.id === 'budget'" type="button" @click="$emit('answer', question.id, 'unlimited')">예산 제한 없음</button>
        <button v-if="question.removeRequirement" type="button" @click="$emit('answer', question.id, 'remove')">이 조건 제외하고 계속</button>
        <p v-if="question.answer === 'unlimited' || question.answer === 'remove'">선택한 답변: {{ question.answer === 'unlimited' ? '예산 제한 없음' : '이 조건 제외' }}</p>
        <button v-if="question.optional" type="button" @click="$emit('answer', question.id, 'unknown')">잘 모르겠어요</button>
      </fieldset>
    </form>
    <p v-if="needsRevision">위 요청 내용을 수정한 뒤 새 상담을 시작해 주세요.</p>
    <button v-if="canResume && !conversation.limit_reached" type="button" :disabled="busy" @click="$emit('resume')">현재 답변으로 다시 시도</button>
    <p v-if="conversation.limit_reached" role="status">답변 수정 한도에 도달했어요. 처음 입력을 확인하고 새 상담을 시작해 주세요.</p>
  </div>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import AppButton from './AppButton.vue'

const props = defineProps({ conversation: Object, busy: Boolean, canResume: Boolean, needsRevision: Boolean })
const emit = defineEmits(['answer', 'resume'])
const drafts = reactive({})
const questions = computed(() => props.conversation?.limit_reached ? [] : [
  ...(props.conversation?.questions || []), ...(props.conversation?.answered || [])
])
watch(questions, value => {
  for (const key of Object.keys(drafts)) {
    if (!value.some(question => question.id === key)) delete drafts[key]
  }
  for (const question of value) {
    if (Object.hasOwn(question, 'answer') || !Object.hasOwn(drafts, question.id)) {
      drafts[question.id] = ['unknown', 'unlimited', 'remove'].includes(question.answer) ? '' :
        (question.answer ?? (question.type === 'multiple' ? [] : ''))
    }
  }
}, { immediate: true })
function submit(question) {
  const value = drafts[question.id]
  emit('answer', question.id, question.optional && value === '' ? 'unknown' : value)
}
</script>
