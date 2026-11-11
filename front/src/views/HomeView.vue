<template>
<div class="home">
<section class="hero section-wrap">
<div class="hero-copy"><span class="eyebrow"><span class="tiny-dot"></span> MY LIFE, MY TECH</span><h1>나에게 맞는 IT기기를<br><em>더 똑똑하게</em><br>선택하세요.</h1><p class="hero-description">스펙은 복잡해도, 선택은 쉬워야 하니까.<br>나의 생활과 지금 쓰는 기기에서 시작하는<br class="desktop-break"> 개인화 추천을 만나보세요.</p><div class="hero-actions"><AppButton to="/recommend">스마트폰 추천 시작 <v-icon icon="mdi-arrow-right" size="18" class="ml-3" /></AppButton><a href="#how-it-works" class="text-link">어떻게 추천하나요? <span aria-hidden="true">↗</span></a></div><p class="availability"><v-icon icon="mdi-information-outline" size="16" /> 화면 미리보기 단계입니다. 실제 추천 연결은 준비 중이에요.</p></div>
<div class="hero-visual" aria-label="생활과 기기를 함께 고려하는 추천 과정 예시">
<div class="visual-top"><span class="eyebrow">YOUR NEXT DEVICE</span><span class="example-label">추천 과정 예시</span></div>
<div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
<div class="phone"><div class="phone-notch"></div><div class="phone-screen"><span class="phone-clock">09:41</span><div class="screen-orb"></div><span class="phone-caption">나의 일상에<br>맞춰지는 기술.</span><div class="phone-widgets"><span></span><span></span><span></span></div></div></div>
<div class="floating-note note-life"><span class="note-icon"><v-icon icon="mdi-leaf" /></span><div><small>나의 생활스타일</small><strong>일상은 가볍게, 배터리는 오래</strong></div></div>
<div class="floating-note note-choice"><span class="note-icon blue"><v-icon icon="mdi-check" /></span><div><small>새 제품만이 답은 아니니까</small><strong>지금 기기 유지도 좋은 선택</strong></div></div>
<div class="visual-bottom"><span class="visual-dot"></span> 생활스타일 <span>＋</span> 보유 기기 <span>＋</span> 나의 기준</div>
</div>
</section>
<section class="category-strip section-wrap" aria-label="지원 기기 범위"><span class="category-label">함께 고민할 기기</span><span class="category-active"><v-icon icon="mdi-cellphone" size="20" /> 스마트폰 <small>MVP</small></span><span v-for="x in ['노트북','태블릿','스마트워치','조립 PC']" :key="x" class="category-planned">{{ x }} <small>예정</small></span></section>
<section id="how-it-works" class="features section-wrap"><div class="section-heading"><div><span class="eyebrow">SPEC보다 LIFE</span><h2>좋은 기기보다,<br class="mobile-break"> 나에게 좋은 기기.</h2></div><p>비싼 제품을 고르는 대신<br>내가 필요한 이유를 찾아보세요.</p></div><div class="feature-grid"><FeatureCard icon="mdi-account-outline" title="내 생활에서 시작하는 추천">영상, 업무, 게임까지. 자주 하는 일과 중요하게 생각하는 기준을 함께 고려합니다.</FeatureCard><FeatureCard icon="mdi-cellphone-link" title="지금 쓰는 기기와 나란히">보유 기기와 후보 제품의 확인 가능한 사양을 비교해, 달라지는 점을 살펴봅니다.</FeatureCard><FeatureCard icon="mdi-refresh" title="바꿀 때도, 더 쓸 때도">업그레이드가 필요한지부터 생각합니다. 지금 기기를 유지하는 선택도 존중합니다.</FeatureCard></div></section>
<section class="compare-invite section-wrap"><div><span class="eyebrow">COMPARE YOUR WAY</span><h2>직접 고르고, 나란히 비교해 보세요.</h2><p>스마트폰 2~3개의 확인 가능한 사양을 같은 기준으로. 제품 연결은 준비 중입니다.</p></div><AppButton secondary to="/compare">제품 스펙 비교 살펴보기</AppButton></section>
<section class="journey section-wrap"><div><span class="eyebrow">YOUR OWN STANDARD</span><h2>나의 기준이<br>선택의 기준이 되도록.</h2><p>이렇게 추천을 준비하고 있어요.</p></div><ol><li><span>01</span><div><h3>나에 대해 알려주세요</h3><p>생활스타일과 기기 사용 목적을 정리해요.</p></div></li><li><span>02</span><div><h3>지금 쓰는 기기를 더해주세요</h3><p>마음에 드는 점과 바꾸고 싶은 점을 살펴봐요.</p></div></li><li><span>03</span><div><h3>이유를 보고 선택하세요</h3><p>추천 이유와 차이를 비교하고 직접 결정해요.</p></div></li></ol></section>
<section class="bottom-cta section-wrap"><div><h2>다음 기기, 나의 기준으로.</h2><p>스마트폰부터 시작해, 나의 IT 생활을 더 가볍게.</p></div><AppButton to="/recommend">추천 화면 살펴보기 <v-icon icon="mdi-arrow-right" class="ml-3" size="18" /></AppButton></section>
</div>
</template>
<script setup>
import AppButton from '../components/AppButton.vue'
import FeatureCard from '../components/FeatureCard.vue'
</script>
