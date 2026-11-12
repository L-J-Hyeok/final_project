<template>
  <section
    class="hero-carousel"
    :class="[`theme-${currentSlide.theme}`, { 'reduced-motion': prefersReducedMotion }]"
    aria-roledescription="carousel"
    aria-label="기기로움 주요 서비스 하이라이트"
    tabindex="0"
    @keydown.left.prevent="handleManualPrev"
    @keydown.right.prevent="handleManualNext"
  >
    <!-- Background Product Visual Layer (Zero layout shift fixed container) -->
    <div class="carousel-media-layer" aria-hidden="true">
      <div
        v-for="(slide, idx) in activeSlides"
        :key="slide.id"
        :class="['slide-media-frame', { active: idx === currentIndex }]"
      >
        <img
          v-if="!imageErrors[slide.id] && slide.image"
          :src="slide.image"
          :alt="slide.imageAlt"
          class="slide-hero-image"
          @error="onImageError(slide.id)"
        />
        <div v-else class="slide-image-fallback" :class="`fallback-${slide.theme}`">
          <div class="fallback-inner">
            <span class="fallback-tag">{{ slide.categoryTag }}</span>
            <p class="fallback-message">제품 비주얼을 불러오지 못했습니다. 아래 버튼을 통해 서비스를 계속 이용하실 수 있습니다.</p>
          </div>
        </div>
        <div class="slide-scrim" :class="`scrim-${slide.theme}`"></div>
      </div>
    </div>

    <!-- Foreground Editorial Copy & Controls -->
    <div class="section-wrap carousel-foreground">
      <div class="slide-copy-box" aria-live="polite">
        <div class="slide-eyebrow-row">
          <span class="slide-eyebrow">{{ currentSlide.eyebrow }}</span>
          <span
            v-if="currentSlide.statusBadge"
            :class="['slide-status-pill', currentSlide.upcoming ? 'is-upcoming' : 'is-active']"
          >
            {{ currentSlide.statusBadge }}
          </span>
        </div>

        <h1 class="slide-headline">{{ currentSlide.headline }}</h1>
        <p class="slide-description">{{ currentSlide.description }}</p>

        <p v-if="currentSlide.scopeNote" class="slide-scope-note">
          {{ currentSlide.scopeNote }}
        </p>

        <div class="slide-cta-row">
          <router-link
            v-for="cta in currentSlide.ctas"
            :key="cta.to + cta.label"
            :to="cta.to"
            :class="ctaButtonClass(cta.variant, currentSlide.theme)"
          >
            {{ cta.label }}
          </router-link>
        </div>
      </div>

      <!-- Bottom Navigation Controls Bar -->
      <div class="carousel-controls">
        <div class="slide-indicators" role="tablist" aria-label="슬라이드 선택">
          <button
            v-for="(slide, idx) in activeSlides"
            :key="slide.id"
            type="button"
            role="tab"
            :aria-selected="idx === currentIndex"
            :aria-label="`${idx + 1}번째 슬라이드: ${slide.shortLabel}`"
            :class="['indicator-btn', { active: idx === currentIndex }]"
            @click="handleSelectSlide(idx)"
          >
            <span class="indicator-index">0{{ idx + 1 }}</span>
            <span class="indicator-label">{{ slide.shortLabel }}</span>
          </button>
        </div>

        <div class="control-buttons-group">
          <button
            type="button"
            class="ctrl-circle-btn"
            aria-label="이전 슬라이드"
            @click="handleManualPrev"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            class="ctrl-circle-btn"
            aria-label="다음 슬라이드"
            @click="handleManualNext"
          >
            <span aria-hidden="true">›</span>
          </button>
          <button
            type="button"
            class="ctrl-pause-btn"
            :aria-pressed="isPaused"
            :aria-label="isPaused ? '자동 전환 재생' : '자동 전환 일시정지'"
            @click="togglePause"
          >
            {{ isPaused ? '재생' : '일시정지' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import heroPlatformImg from '../assets/home/hero-platform.jpg'
import heroSmartphonesImg from '../assets/home/hero-smartphones.jpg'
import heroCompareImg from '../assets/home/hero-compare.jpg'
import heroPcFitImg from '../assets/home/hero-pc-fit.jpg'

const AUTO_INTERVAL_MS = 7000

const props = defineProps({
  slides: {
    type: Array,
    default: null
  },
  initialIndex: {
    type: Number,
    default: 0
  }
})

const defaultSlides = [
  {
    id: 'platform',
    shortLabel: '통합 IT 플랫폼',
    theme: 'light',
    upcoming: false,
    eyebrow: 'GIKIROUN · MULTI-DEVICE PLATFORM',
    statusBadge: '종합 IT 추천·비교',
    headline: '내 생활과 예산에 맞는 IT기기,\n가장 합리적인 선택.',
    description: '특정 제조사에 치우치지 않고 스마트폰, 태블릿, 스마트워치부터 향후 노트북과 조립 PC까지 한곳에서 비교하고 추천받으세요.',
    scopeNote: '독자적 스튜디오 연출 이미지 · 실제 추천 및 사양은 각 서비스에서 제공됩니다.',
    categoryTag: '통합 IT기기 플랫폼',
    image: heroPlatformImg,
    imageAlt: '노트북, 태블릿, 다양한 스마트폰, 스마트워치가 나란히 배치된 미니멀 IT 제품 비주얼',
    ctas: [
      { label: 'AI 추천', to: '/recommend', variant: 'primary' },
      { label: '기기 스펙 비교', to: '/compare', variant: 'outline' }
    ]
  },
  {
    id: 'ai-recommend',
    shortLabel: 'AI 스마트폰 추천',
    theme: 'light',
    upcoming: false,
    eyebrow: 'AI RECOMMENDATION',
    statusBadge: '현재 지원: 스마트폰',
    headline: '사용 목적과 예산 기반\nAI 맞춤형 스마트폰 추천.',
    description: '자주 쓰는 용도와 구매 예산, 현재 보유 기기를 함께 분석해 알맞은 스마트폰이나 기기 유지 의견을 제안합니다.',
    scopeNote: '현재 실제 AI 추천 지원 범위는 스마트폰입니다 (향후 다른 기기군 확장 예정).',
    categoryTag: 'AI 스마트폰 추천',
    image: heroSmartphonesImg,
    imageAlt: '서로 다른 마감과 카메라 구성을 지닌 다양한 제조사 중립 스마트폰 비주얼',
    ctas: [
      { label: 'AI 추천 시작', to: '/recommend', variant: 'primary' }
    ]
  },
  {
    id: 'spec-compare',
    shortLabel: '상세 스펙 비교',
    theme: 'light',
    upcoming: false,
    eyebrow: 'SIDE-BY-SIDE COMPARISON',
    statusBadge: '스마트폰 · 태블릿 · 워치',
    headline: '제품별 주요 사양과 차이를\n객관적으로 한눈에.',
    description: '스마트폰, 태블릿, 스마트워치를 나란히 두고 확인 가능한 스펙과 차이점을 필터링해 정확히 비교하세요.',
    scopeNote: '노트북 비교 및 추가 카테고리는 향후 순차 확장될 예정입니다.',
    categoryTag: '상세 스펙 비교',
    image: heroCompareImg,
    imageAlt: '스마트폰, 태블릿, 스마트워치가 스펙 대조를 위해 정갈히 배치된 비주얼',
    ctas: [
      { label: '기기 비교 시작', to: '/compare', variant: 'primary' }
    ]
  },
  {
    id: 'pc-fit',
    shortLabel: 'PC-FIT (준비 중)',
    theme: 'dark',
    upcoming: true,
    eyebrow: 'PC-FIT INTEGRATION',
    statusBadge: '준비 중 · 현재 미구현',
    headline: '맞춤 조립 PC 견적과\n부품 호환성까지, PC-FIT.',
    description: '용도와 예산에 따른 CPU·GPU·메인보드 호환성 검사 및 AI 조립 PC 구성 추천 기능이 향후 통합될 예정입니다.',
    scopeNote: '현재 조립 PC 견적 기능은 미구현 상태이며 준비 중 안내 페이지로 연결됩니다.',
    categoryTag: 'PC-FIT 조립 PC (준비 중)',
    image: heroPcFitImg,
    imageAlt: '조립 PC 워크스테이션 케이스와 GPU, CPU 쿨러, 메인보드 하드웨어 비주얼',
    ctas: [
      { label: 'PC-FIT 준비 중 안내 보기', to: '/pc', variant: 'primary' }
    ]
  }
]

const activeSlides = computed(() => props.slides || defaultSlides)
const currentIndex = ref(Math.max(0, Math.min(props.initialIndex, (props.slides || defaultSlides).length - 1)))
const isPaused = ref(false)
const prefersReducedMotion = ref(false)
const imageErrors = reactive({})

let timerId = null

const currentSlide = computed(() => activeSlides.value[currentIndex.value] || activeSlides.value[0])

function ctaButtonClass(variant, theme) {
  if (theme === 'dark') {
    return variant === 'primary' ? 'hero-btn btn-on-dark-primary' : 'hero-btn btn-on-dark-outline'
  }
  return variant === 'primary' ? 'hero-btn btn-on-light-primary' : 'hero-btn btn-on-light-outline'
}

function onImageError(slideId) {
  imageErrors[slideId] = true
}

function clearTimer() {
  if (timerId !== null) {
    clearInterval(timerId)
    timerId = null
  }
}

function startTimer() {
  clearTimer()
  if (isPaused.value || prefersReducedMotion.value || activeSlides.value.length <= 1) return
  timerId = setInterval(() => {
    currentIndex.value = (currentIndex.value + 1) % activeSlides.value.length
  }, AUTO_INTERVAL_MS)
}

function stopAutoAdvanceOnUserAction() {
  // Pause auto-advance so user browsing/reading is never interrupted
  isPaused.value = true
  clearTimer()
}

function handleManualPrev() {
  stopAutoAdvanceOnUserAction()
  currentIndex.value = (currentIndex.value - 1 + activeSlides.value.length) % activeSlides.value.length
}

function handleManualNext() {
  stopAutoAdvanceOnUserAction()
  currentIndex.value = (currentIndex.value + 1) % activeSlides.value.length
}

function handleSelectSlide(idx) {
  stopAutoAdvanceOnUserAction()
  currentIndex.value = idx
}

function togglePause() {
  isPaused.value = !isPaused.value
  if (isPaused.value) {
    clearTimer()
  } else {
    startTimer()
  }
}

onMounted(() => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReducedMotion.value = !!mq.matches
    if (prefersReducedMotion.value) {
      isPaused.value = true
    }
  }
  startTimer()
})

onBeforeUnmount(() => {
  clearTimer()
})

defineExpose({
  currentIndex,
  isPaused,
  imageErrors,
  onImageError,
  handleManualNext,
  handleManualPrev,
  handleSelectSlide,
  togglePause
})
</script>

<style scoped>
.hero-carousel {
  position: relative;
  width: 100%;
  height: 580px;
  overflow: hidden;
  background-color: #f5f5f7;
  color: #111111;
  outline: none;
}

.hero-carousel.theme-dark {
  background-color: #111114;
  color: #ffffff;
}

.hero-carousel:focus-visible {
  outline: 2px solid #111111;
  outline-offset: -2px;
}

.hero-carousel.theme-dark:focus-visible {
  outline-color: #ffffff;
}

/* Fixed layer preventing CLS on slide change */
.carousel-media-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.slide-media-frame {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.45s ease;
  pointer-events: none;
}

.slide-media-frame.active {
  opacity: 1;
}

.hero-carousel.reduced-motion .slide-media-frame {
  transition: none;
}

.slide-hero-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: right center;
  display: block;
}

.slide-image-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 48px 10%;
}

.fallback-light {
  background-color: #f1f1f4;
  color: #52525b;
}

.fallback-dark {
  background-color: #18181b;
  color: #a1a1aa;
}

.fallback-inner {
  max-width: 320px;
  border: 1px dashed currentColor;
  border-radius: 12px;
  padding: 24px;
  text-align: left;
}

.fallback-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 8px;
}

.fallback-message {
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
  color: inherit;
}

/* Smooth readable directional gradient scrim over left text column */
.slide-scrim {
  position: absolute;
  inset: 0;
}

.scrim-light {
  background: linear-gradient(
    90deg,
    rgba(245, 245, 247, 0.96) 0%,
    rgba(245, 245, 247, 0.88) 38%,
    rgba(245, 245, 247, 0.25) 64%,
    rgba(245, 245, 247, 0) 82%
  );
}

.scrim-dark {
  background: linear-gradient(
    90deg,
    rgba(17, 17, 20, 0.96) 0%,
    rgba(17, 17, 20, 0.88) 38%,
    rgba(17, 17, 20, 0.28) 64%,
    rgba(17, 17, 20, 0) 84%
  );
}

/* Foreground Container */
.carousel-foreground {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-top: 68px;
  padding-bottom: 28px;
}

.slide-copy-box {
  max-width: 560px;
}

.slide-eyebrow-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

.slide-eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #52525b;
}

.theme-dark .slide-eyebrow {
  color: #a1a1aa;
}

.slide-status-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 9999px;
}

.slide-status-pill.is-active {
  background: rgba(17, 17, 17, 0.07);
  color: #111111;
}

.slide-status-pill.is-upcoming {
  background: rgba(255, 255, 255, 0.14);
  color: #e4e4e7;
  border: 1px solid rgba(255, 255, 255, 0.22);
}

.slide-headline {
  font-size: clamp(32px, 3.8vw, 48px);
  font-weight: 800;
  line-height: 1.18;
  letter-spacing: -0.04em;
  margin: 0 0 18px 0;
  white-space: pre-line;
  word-break: keep-all;
}

.theme-dark .slide-headline {
  color: #ffffff;
}

.slide-description {
  font-size: 16px;
  line-height: 1.6;
  color: #3f3f46;
  margin: 0 0 12px 0;
  word-break: keep-all;
}

.theme-dark .slide-description {
  color: #d4d4d8;
}

.slide-scope-note {
  font-size: 12px;
  color: #71717a;
  margin: 0 0 28px 0;
}

.theme-dark .slide-scope-note {
  color: #a1a1aa;
}

.slide-cta-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.hero-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  padding: 13px 26px;
  border-radius: 9999px;
  text-decoration: none;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.hero-btn:focus-visible {
  outline: 2px solid #111111;
  outline-offset: 3px;
}

.theme-dark .hero-btn:focus-visible {
  outline-color: #ffffff;
}

.btn-on-light-primary {
  background-color: #111111;
  color: #ffffff;
}

.btn-on-light-primary:hover {
  background-color: #27272a;
}

.btn-on-light-outline {
  background-color: rgba(255, 255, 255, 0.85);
  color: #111111;
  border: 1px solid #111111;
}

.btn-on-light-outline:hover {
  background-color: #ffffff;
}

.btn-on-dark-primary {
  background-color: #ffffff;
  color: #111111;
}

.btn-on-dark-primary:hover {
  background-color: #e4e4e7;
}

.btn-on-dark-outline {
  background-color: transparent;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.45);
}

/* Bottom Controls */
.carousel-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(17, 17, 17, 0.08);
}

.theme-dark .carousel-controls {
  border-top-color: rgba(255, 255, 255, 0.14);
}

.slide-indicators {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.indicator-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 9999px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  color: #52525b;
  cursor: pointer;
  transition: all 0.15s ease;
}

.indicator-btn:hover {
  color: #111111;
  border-color: rgba(17, 17, 17, 0.35);
}

.indicator-btn.active {
  background: #111111;
  color: #ffffff;
  border-color: #111111;
  font-weight: 600;
}

.theme-dark .indicator-btn {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  color: #d4d4d8;
}

.theme-dark .indicator-btn.active {
  background: #ffffff;
  color: #111111;
  border-color: #ffffff;
}

.indicator-index {
  font-size: 10px;
  opacity: 0.75;
}

.control-buttons-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ctrl-circle-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid rgba(17, 17, 17, 0.2);
  background: rgba(255, 255, 255, 0.85);
  color: #111111;
  font-size: 18px;
  line-height: 1;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.ctrl-pause-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 9999px;
  border: 1px solid rgba(17, 17, 17, 0.2);
  background: rgba(255, 255, 255, 0.85);
  color: #111111;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.theme-dark .ctrl-circle-btn,
.theme-dark .ctrl-pause-btn {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.28);
  color: #ffffff;
}

.indicator-btn:focus-visible,
.ctrl-circle-btn:focus-visible,
.ctrl-pause-btn:focus-visible {
  outline: 2px solid #111111;
  outline-offset: 2px;
}

.theme-dark .indicator-btn:focus-visible,
.theme-dark .ctrl-circle-btn:focus-visible,
.theme-dark .ctrl-pause-btn:focus-visible {
  outline-color: #ffffff;
}

@media (max-width: 960px) {
  .hero-carousel {
    height: auto;
    min-height: 540px;
  }

  .slide-hero-image {
    object-position: center center;
    opacity: 0.42;
  }

  .theme-dark .slide-hero-image {
    opacity: 0.55;
  }

  .scrim-light {
    background: linear-gradient(
      180deg,
      rgba(245, 245, 247, 0.92) 0%,
      rgba(245, 245, 247, 0.82) 65%,
      rgba(245, 245, 247, 0.95) 100%
    );
  }

  .scrim-dark {
    background: linear-gradient(
      180deg,
      rgba(17, 17, 20, 0.88) 0%,
      rgba(17, 17, 20, 0.78) 65%,
      rgba(17, 17, 20, 0.95) 100%
    );
  }

  .carousel-controls {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 600px) {
  .carousel-foreground {
    padding-top: 40px;
    padding-bottom: 24px;
  }

  .indicator-label {
    display: none;
  }

  .indicator-btn {
    padding: 6px 10px;
  }
}
</style>
