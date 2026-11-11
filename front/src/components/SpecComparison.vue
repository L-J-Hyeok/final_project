<template><div class="comparison-scroll" role="region" aria-label="제품 사양 비교표" tabindex="0"><table class="comparison-table"><caption class="sr-only">제품 간 사양 차이. 강조는 우열을 의미하지 않습니다.</caption><thead><tr><th scope="col">비교 항목</th><th v-for="(product,i) in slots" :key="i" scope="col"><span class="product-slot"><v-icon icon="mdi-cellphone" size="28" /><strong>{{ product?.model_name || `제품 ${i+1}` }}</strong><small>{{ product ? '선택한 제품' : '아직 선택한 제품이 없어요' }}</small><span v-if="!product" class="selection-pending">제품 선택 · 다음 단계 연결</span></span></th></tr></thead><tbody><tr v-for="field in fields" :key="field.key" :class="{ 'spec-difference': differs(field) }"><th scope="row">{{ field.label }}<span v-if="differs(field)" class="difference-label">값 다름</span></th><td v-for="(product,i) in slots" :key="i">{{ format(product,field) }}</td></tr></tbody></table></div></template>
<script setup>
import { computed } from 'vue'
const props=defineProps({products:{type:Array,default:()=>[]},fields:{type:Array,required:true},count:{type:Number,default:3}})
const slots=computed(()=>Array.from({length:Math.min(3,Math.max(2,props.count))},(_,i)=>props.products[i]||null))
function value(p,f){return p?.[f.key]??null}
function format(p,f){const v=value(p,f);return v===null?'정보 없음':`${typeof v==='number'?v.toLocaleString('ko-KR'):v}${f.unit?' '+f.unit:''}`}
function differs(f){const values=slots.value.map(p=>value(p,f)).filter(v=>v!==null);return new Set(values).size>1}
</script>
