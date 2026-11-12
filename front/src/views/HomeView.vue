<template>
  <div class="home-page">
    <!-- 0. Practical Web App Utility & Platform Sub-Navigation (nofee.team inspired) -->
    <div class="sub-nav-bar">
      <div class="section-wrap sub-nav-inner">
        <nav class="platform-nav" aria-label="플랫폼 핵심 영역">
          <router-link to="/recommend" class="subnav-link">
            IT기기 AI 추천
          </router-link>
          <router-link to="/compare" class="subnav-link">
            IT기기 상세 비교
          </router-link>
          <router-link to="/pc" class="subnav-link subnav-pc">
            조립 PC · PC-FIT
            <span class="subnav-tag">준비 중</span>
          </router-link>
        </nav>

        <div class="account-nav" aria-label="계정 및 개인화 메뉴">
          <template v-if="currentUser">
            <span class="user-greeting">
              <strong>{{ currentUser.name || currentUser.email }}</strong>님
            </span>
            <router-link to="/devices" class="account-link">보유 기기</router-link>
            <router-link to="/profile" class="account-link">내 프로필</router-link>
            <router-link to="/history" class="account-link">추천 이력</router-link>
          </template>
          <template v-else>
            <span class="guest-label">게스트 · 스펙 비교 이용 가능</span>
            <router-link to="/login" class="account-link">로그인</router-link>
            <router-link to="/register" class="account-link">회원가입</router-link>
          </template>
        </div>
      </div>
    </div>

    <!-- 1. Large Product Visual Hero Slideshow -->
    <HeroSlideshow
      :slides="slides"
      :initial-index="initialSlide"
    />

    <!-- A. AI 맞춤 추천 (현재 제공 핵심 기능) -->
    <section class="feature-band band-white" aria-labelledby="section-ai-title">
      <div class="section-wrap band-split">
        <div class="visual-frame light-frame">
          <img
            v-if="!sectionImgError.ai"
            :src="aiImage"
            alt="제조사 중립적 스마트폰 라인업 비주얼"
            class="band-image"
            @error="sectionImgError.ai = true"
          />
          <div v-else class="band-image-fallback light-fallback">
            <span>AI 맞춤형 스마트폰 추천 이미지</span>
          </div>
          <div class="visual-caption-bar">
            <span>현재 실제 추천 지원: 스마트폰</span>
            <span>사용 목적 · 예산 · 보유 기기 반영</span>
          </div>
        </div>

        <div class="band-copy">
          <span class="band-eyebrow">AI RECOMMENDATION · 서비스 중</span>
          <h2 id="section-ai-title" class="band-heading">
            예산과 일상에 맞춘<br>
            스마트폰 AI 추천.
          </h2>
          <p class="band-description">
            자주 하는 작업, 구매 예산 상한, 현재 보유 기기를 바탕으로 Gemini AI가 알맞은 스마트폰을 제안합니다. 지금 기기가 충분하다면 무리한 교체 대신 '기기 유지' 의견도 솔직하게 안내합니다.
          </p>
          <div class="band-actions">
            <router-link to="/recommend" class="btn-black-pill">
              AI 추천 시작
            </router-link>
            <router-link to="/history" class="link-underlined">
              추천 이력 보기 <span aria-hidden="true">→</span>
            </router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- B. IT기기 스펙 비교 (스마트폰·태블릿·스마트워치) -->
    <section class="feature-band band-gray" aria-labelledby="section-compare-title">
      <div class="section-wrap band-split reversed">
        <div class="band-copy">
          <span class="band-eyebrow">SPEC COMPARISON · 스마트폰 · 태블릿 · 워치</span>
          <h2 id="section-compare-title" class="band-heading">
            주요 사양을 나란히,<br>
            차이만 선명하게.
          </h2>
          <p class="band-description">
            스마트폰, 태블릿, 스마트워치 중 2~3개 기기를 같은 기준표 위에 올려두고 객관적으로 대조하세요. 실제 비교 화면의 카테고리 탭과 '차이 있는 항목만 보기' 필터로 핵심 차이만 빠르게 확인할 수 있습니다.
          </p>

          <!-- Authentic Reflection of Real /compare UI Features -->
          <div class="compare-ui-strip" aria-label="실제 비교 화면 주요 기능 요약">
            <div class="ui-strip-row">
              <span class="ui-strip-key">카테고리 전환</span>
              <span class="ui-strip-val">스마트폰 · 태블릿 · 스마트워치 (노트북 준비 중)</span>
            </div>
            <div class="ui-strip-row">
              <span class="ui-strip-key">비교 기능</span>
              <span class="ui-strip-val">2~3대 동시 비교 · 차이 항목 하이라이트 · 차이만 보기</span>
            </div>
          </div>

          <div class="band-actions">
            <router-link to="/compare" class="btn-outline-pill">
              기기 스펙 비교 열기
            </router-link>
          </div>
        </div>

        <div class="visual-frame white-frame">
          <img
            v-if="!sectionImgError.compare"
            :src="compareImage"
            alt="스마트폰, 태블릿, 스마트워치 비교 비주얼"
            class="band-image"
            @error="sectionImgError.compare = true"
          />
          <div v-else class="band-image-fallback light-fallback">
            <span>IT기기 스펙 비교 이미지</span>
          </div>
          <div class="visual-caption-bar">
            <span>확인된 사양 기준 표기</span>
            <span>미확인 항목 투명 안내</span>
          </div>
        </div>
      </div>
    </section>

    <!-- C. PC-FIT 조립 PC 추천 (향후 통합 예정 · 준비 중 정직 고지) -->
    <section class="feature-band band-dark" aria-labelledby="section-pcfit-title">
      <div class="section-wrap band-split">
        <div class="visual-frame dark-frame">
          <img
            v-if="!sectionImgError.pcfit"
            :src="pcfitImage"
            alt="PC-FIT 조립 PC 하드웨어 구성 비주얼"
            class="band-image"
            @error="sectionImgError.pcfit = true"
          />
          <div v-else class="band-image-fallback dark-fallback">
            <span>PC-FIT 조립 PC 하드웨어 비주얼</span>
          </div>
          <div class="visual-caption-bar dark-caption">
            <span>PC-FIT · 향후 통합 예정</span>
            <span>현재 미구현 상태</span>
          </div>
        </div>

        <div class="band-copy">
          <span class="band-eyebrow dark-eyebrow">PC-FIT INTEGRATION · 준비 중</span>
          <h2 id="section-pcfit-title" class="band-heading dark-heading">
            부품 호환성부터<br>
            AI 조립 PC 견적까지.
          </h2>
          <p class="band-description dark-description">
            기기로움은 스마트폰·모바일 기기를 넘어 조립 PC까지 아우르는 종합 IT 플랫폼으로 확장합니다. 현재는 안내 페이지만 제공되며, PC-FIT 연동 후 아래 기능이 추가될 예정입니다.
          </p>

          <ul class="roadmap-list">
            <li>CPU · GPU · 메인보드 · 파워 부품 간 호환성 자동 검사 (예정)</li>
            <li>게임 · 작업 용도 및 예산별 AI 조립 PC 견적 추천 (예정)</li>
            <li>실제 판매가 및 구매처 정보 통합 제공 (예정)</li>
          </ul>

          <div class="band-actions">
            <router-link to="/pc" class="btn-white-pill">
              PC-FIT 준비 중 안내 보기
            </router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- D. 간결한 마지막 CTA -->
    <section class="closing-band" aria-labelledby="closing-cta-title">
      <div class="section-wrap closing-inner">
        <div class="closing-copy">
          <h2 id="closing-cta-title">나에게 맞는 IT기기 탐색, 지금 시작하세요.</h2>
          <p v-if="currentUser">
            등록한 보유 기기와 프로필을 바탕으로 AI 추천과 비교 기능을 바로 이용할 수 있습니다.
          </p>
          <p v-else>
            로그인 없이도 기기 스펙 비교를 이용할 수 있으며, 로그인 후 AI 맞춤 추천을 받을 수 있습니다.
          </p>
        </div>

        <div class="closing-actions">
          <router-link to="/recommend" class="btn-black-pill">
            AI 추천
          </router-link>
          <router-link to="/compare" class="btn-outline-pill">
            기기 스펙 비교
          </router-link>
          <router-link v-if="currentUser" to="/history" class="link-underlined">
            추천 이력 <span aria-hidden="true">→</span>
          </router-link>
          <router-link v-else to="/login" class="link-underlined">
            로그인 <span aria-hidden="true">→</span>
          </router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { reactive, computed } from 'vue'
import { useStore } from 'vuex'
import HeroSlideshow from '../components/HeroSlideshow.vue'
import heroSmartphonesImg from '../assets/home/hero-smartphones.jpg'
import heroCompareImg from '../assets/home/hero-compare.jpg'
import heroPcFitImg from '../assets/home/hero-pc-fit.jpg'

const props = defineProps({
  user: {
    type: Object,
    default: null
  },
  slides: {
    type: Array,
    default: null
  },
  initialSlide: {
    type: Number,
    default: 0
  }
})

const store = useStore()
const currentUser = computed(() => props.user ?? store?.state?.user ?? null)

const aiImage = heroSmartphonesImg
const compareImage = heroCompareImg
const pcfitImage = heroPcFitImg

const sectionImgError = reactive({
  ai: false,
  compare: false,
  pcfit: false
})
</script>

<style scoped>
/* ==========================================================================
   Home View — 기기로움 종합 IT 플랫폼 메인 페이지
   White / Light Gray / Black & Neutral Charcoal Palette
   ========================================================================== */

.home-page {
  background-color: #ffffff;
  color: #111111;
}

.home-page a:focus-visible,
.home-page button:focus-visible {
  outline: 2px solid #111111;
  outline-offset: 3px;
}

/* 0. Sub-Navigation Utility Bar */
.sub-nav-bar {
  background-color: #ffffff;
  border-bottom: 1px solid #e5e5e7;
}

.sub-nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  gap: 20px;
}

.platform-nav {
  display: flex;
  align-items: center;
  gap: 24px;
  overflow-x: auto;
  scrollbar-width: none;
}

.platform-nav::-webkit-scrollbar {
  display: none;
}

.subnav-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #3f3f46;
  text-decoration: none;
  padding: 13px 0;
  white-space: nowrap;
  transition: color 0.15s ease;
}

.subnav-link:hover {
  color: #111111;
}

.subnav-tag {
  font-size: 10px;
  font-weight: 600;
  background: #f4f4f5;
  color: #71717a;
  padding: 1px 6px;
  border-radius: 4px;
}

.account-nav {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  white-space: nowrap;
}

.user-greeting strong {
  color: #111111;
  font-weight: 700;
}

.guest-label {
  color: #71717a;
  font-size: 12px;
}

.account-link {
  color: #52525b;
  font-weight: 500;
  text-decoration: none;
}

.account-link:hover {
  color: #111111;
  text-decoration: underline;
}

/* Shared Editorial Feature Bands */
.feature-band {
  padding: 88px 0;
}

.band-white {
  background-color: #ffffff;
}

.band-gray {
  background-color: #f5f5f7;
}

.band-dark {
  background-color: #111114;
  color: #ffffff;
}

.band-dark a:focus-visible {
  outline-color: #ffffff;
}

.band-split {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  align-items: center;
  gap: 64px;
}

.visual-frame {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #e5e5e7;
}

.light-frame {
  background-color: #f5f5f7;
}

.white-frame {
  background-color: #ffffff;
}

.dark-frame {
  background-color: #18181b;
  border-color: rgba(255, 255, 255, 0.14);
}

.band-image {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  object-position: right center;
  display: block;
}

.band-image-fallback {
  width: 100%;
  aspect-ratio: 16 / 10;
  display: grid;
  place-items: center;
  font-size: 13px;
}

.light-fallback {
  background-color: #f4f4f5;
  color: #71717a;
}

.dark-fallback {
  background-color: #1c1c20;
  color: #a1a1aa;
}

.visual-caption-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  font-size: 12px;
  font-weight: 500;
  color: #52525b;
  background-color: inherit;
  border-top: 1px solid #e5e5e7;
}

.dark-caption {
  color: #a1a1aa;
  border-top-color: rgba(255, 255, 255, 0.12);
}

.band-eyebrow {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #71717a;
  margin-bottom: 14px;
}

.dark-eyebrow {
  color: #a1a1aa;
}

.band-heading {
  font-size: clamp(28px, 3vw, 38px);
  font-weight: 800;
  line-height: 1.24;
  letter-spacing: -0.035em;
  color: #111111;
  margin: 0 0 18px 0;
  word-break: keep-all;
}

.dark-heading {
  color: #ffffff;
}

.band-description {
  font-size: 16px;
  line-height: 1.65;
  color: #52525b;
  margin: 0 0 28px 0;
  word-break: keep-all;
}

.dark-description {
  color: #d4d4d8;
}

/* Real Comparison UI Feature Strip */
.compare-ui-strip {
  border-top: 1px solid #d4d4d8;
  border-bottom: 1px solid #d4d4d8;
  margin-bottom: 28px;
}

.ui-strip-row {
  display: grid;
  grid-template-columns: 108px 1fr;
  gap: 12px;
  padding: 12px 0;
  font-size: 13px;
  border-bottom: 1px solid #e5e5e7;
}

.ui-strip-row:last-child {
  border-bottom: 0;
}

.ui-strip-key {
  font-weight: 700;
  color: #111111;
}

.ui-strip-val {
  color: #52525b;
}

/* PC-FIT Planned Roadmap List */
.roadmap-list {
  list-style: none;
  padding: 0;
  margin: 0 0 32px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
}

.roadmap-list li {
  font-size: 14px;
  color: #e4e4e7;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
}

/* Action Buttons */
.band-actions {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.btn-black-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: #111111;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  padding: 13px 26px;
  border-radius: 9999px;
  text-decoration: none;
}

.btn-black-pill:hover {
  background-color: #27272a;
}

.btn-outline-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  color: #111111;
  border: 1px solid #111111;
  font-size: 14px;
  font-weight: 600;
  padding: 12px 24px;
  border-radius: 9999px;
  text-decoration: none;
}

.btn-outline-pill:hover {
  background-color: rgba(17, 17, 17, 0.05);
}

.btn-white-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: #ffffff;
  color: #111111;
  font-size: 14px;
  font-weight: 600;
  padding: 13px 26px;
  border-radius: 9999px;
  text-decoration: none;
}

.btn-white-pill:hover {
  background-color: #e4e4e7;
}

.link-underlined {
  font-size: 14px;
  font-weight: 600;
  color: #111111;
  border-bottom: 1px solid #d4d4d8;
  padding-bottom: 2px;
  text-decoration: none;
}

.link-underlined:hover {
  border-bottom-color: #111111;
}

/* D. Closing Band */
.closing-band {
  background-color: #ffffff;
  padding: 72px 0;
  border-top: 1px solid #e5e5e7;
}

.closing-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
}

.closing-copy h2 {
  font-size: clamp(22px, 2.8vw, 30px);
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #111111;
  margin: 0 0 8px 0;
}

.closing-copy p {
  font-size: 15px;
  color: #52525b;
  margin: 0;
}

.closing-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

/* Responsive Layout */
@media (max-width: 960px) {
  .sub-nav-inner {
    flex-direction: column;
    align-items: stretch;
    padding-top: 8px;
    padding-bottom: 10px;
    gap: 8px;
  }

  .account-nav {
    justify-content: flex-end;
    font-size: 12px;
  }

  .feature-band {
    padding: 64px 0;
  }

  .band-split {
    grid-template-columns: 1fr;
    gap: 36px;
  }

  .band-split.reversed .band-copy {
    order: 1;
  }

  .band-split.reversed .visual-frame {
    order: 2;
  }

  .closing-inner {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 600px) {
  .visual-caption-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .ui-strip-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .closing-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .btn-black-pill,
  .btn-outline-pill,
  .btn-white-pill {
    width: 100%;
  }
}
</style>
