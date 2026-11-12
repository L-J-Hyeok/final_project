/**
 * final_project 통합 디자인 시스템 토큰
 * - Apple / Samsung: 화이트·블랙·뉴트럴 그레이 기반 여백, 강한 타이포그래피, 제품 중심 배치
 * - nofee.team: 직관적 카테고리 탐색, 정돈된 헤어라인 구분, 실용적 웹앱 내비게이션
 */

// Vuetify 전 페이지 공통 테마 컬러 (화이트·블랙·뉴트럴 그레이 통일 + 시맨틱 경고/오류/성공 유지)
export const colors = {
  primary: '#111111',
  secondary: '#111111',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  info: '#3F3F46',
  error: '#B42318',
  success: '#176B50',
  warning: '#8A5300'
}

export const designTokens = {
  colors: {
    surfaceWhite: '#FFFFFF',
    surfaceGray: '#F5F5F7',
    surfaceSubtle: '#FAFAFA',
    inkBlack: '#111111',
    inkCharcoal: '#1D1D1F',
    inkSecondary: '#52525B',
    inkMuted: '#71717A',
    borderHairline: '#E5E5E7',
    borderStrong: '#D4D4D8',
    ctaPrimaryBg: '#111111',
    ctaPrimaryHover: '#27272A',
    ctaPrimaryText: '#FFFFFF',
    ctaSecondaryBorder: '#111111',
    ctaSecondaryText: '#111111',
    statusUpcomingBg: '#F4F4F5',
    statusUpcomingText: '#71717A'
  },
  typography: {
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Pretendard', 'Segoe UI', Roboto, sans-serif",
    heroDisplay: { size: '56px', lineHeight: '1.14', letterSpacing: '-0.04em', weight: '800' },
    sectionHeading: { size: '38px', lineHeight: '1.22', letterSpacing: '-0.035em', weight: '750' },
    subHeading: { size: '24px', lineHeight: '1.35', letterSpacing: '-0.025em', weight: '700' },
    bodyLarge: { size: '18px', lineHeight: '1.6', weight: '400' },
    bodyRegular: { size: '15px', lineHeight: '1.6', weight: '400' },
    eyebrow: { size: '12px', lineHeight: '1.4', letterSpacing: '0.1em', weight: '600' }
  },
  radii: {
    none: '0px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    pill: '9999px'
  },
  spacing: {
    bandDesktop: '96px',
    bandMobile: '56px',
    containerMax: '1200px'
  }
}
