/**
 * Verified manufacturer official studio render manifest & resolution helpers.
 *
 * Strict Policy (`IMAGE_POLICY = 'official_render_only'`):
 * 1. ONLY verified official renders with permitted reuse are served:
 *    - Priority 1: User-provided & locally processed assets in `../data/user-official-renders.json`
 *      (`/images/official/optimized/...`, generated cleanly by `npm run images:process` while
 *      preserving originals untouched).
 *    - Priority 2: Built-in unmodified Samsung Korea Newsroom renders under `/images/official/`
 *      (`extAuthor: NONE`, zero watermarks, unmodified binary originals).
 * 2. Exact matching by `domestic_model_number` (+ brand/model verification) AND exact `color`.
 *    Never substitutes another color or model; storage capacity (`storage_gb`) integrates cleanly
 *    via catalog variant helpers without altering image color truthfulness.
 * 3. Any model or color without a verified official render resolves to `null` (clean SVG fallback).
 */

import userOfficialRenders from '../data/user-official-renders.json'

export const IMAGE_POLICY = 'official_render_only'

const SAMSUNG_KR_NEWSROOM_LICENSE_NOTE =
  '삼성전자 뉴스룸 코리아 콘텐츠 이용 안내 (자체 제작·무워터마크·원본 무변형 조건 자유 사용)'

export const DEVICE_MODEL_IMAGE_MANIFEST = {
  // === Verified Unmodified Samsung Korea Newsroom Smartphone Renders ===
  'galaxy-z-fold6': {
    category: 'smartphone',
    brand: 'samsung',
    domesticModelNumbers: ['SM-F956N'],
    modelNames: ['galaxy z fold6', '갤럭시 z 폴드6'],
    colors: {
      '실버 쉐도우': {
        url: '/images/official/samsung-galaxy-z-fold6-silver-shadow.jpg',
        aliases: ['실버쉐도우', 'silver shadow'],
        orientation: 'front-and-back',
        transparent: false,
        format: 'jpg',
        sourceName: '삼성전자 뉴스룸 코리아',
        sourceArticleUrl:
          'https://news.samsung.com/kr/삼성전자-갤럭시-z-폴드6·갤럭시-z-플립6·갤럭시-버',
        imageUrl:
          'https://img.kr.news.samsung.com/kr/wp-content/uploads/2024/07/%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90-%EB%AA%A8%EB%B0%94%EC%9D%BC-%EA%B0%A4%EB%9F%AD%EC%8B%9C-Z%ED%8F%B4%EB%93%9C6-%EC%96%B8%ED%8C%A92024-1.jpg',
        licenseNote: SAMSUNG_KR_NEWSROOM_LICENSE_NOTE
      },
      '네이비': {
        url: '/images/official/samsung-galaxy-z-fold6-navy.jpg',
        aliases: ['navy'],
        orientation: 'front-and-back',
        transparent: false,
        format: 'jpg',
        sourceName: '삼성전자 뉴스룸 코리아',
        sourceArticleUrl:
          'https://news.samsung.com/kr/삼성전자-갤럭시-z-폴드6·갤럭시-z-플립6·갤럭시-버',
        imageUrl:
          'https://img.kr.news.samsung.com/kr/wp-content/uploads/2024/07/%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90-%EB%AA%A8%EB%B0%94%EC%9D%BC-%EA%B0%A4%EB%9F%AD%EC%8B%9C-Z%ED%8F%B4%EB%93%9C6-%EC%96%B8%ED%8C%A92024-2.jpg',
        licenseNote: SAMSUNG_KR_NEWSROOM_LICENSE_NOTE
      }
    }
  },
  'galaxy-z-flip6': {
    category: 'smartphone',
    brand: 'samsung',
    domesticModelNumbers: ['SM-F741N'],
    modelNames: ['galaxy z flip6', '갤럭시 z 플립6'],
    colors: {
      '블루': {
        url: '/images/official/samsung-galaxy-z-flip6-blue.png',
        aliases: ['blue'],
        orientation: 'front-and-back',
        transparent: false,
        format: 'png',
        sourceName: '삼성전자 뉴스룸 코리아',
        sourceArticleUrl:
          'https://news.samsung.com/kr/삼성전자-갤럭시-z-폴드6·갤럭시-z-플립6·갤럭시-버',
        imageUrl:
          'https://img.kr.news.samsung.com/kr/wp-content/uploads/2024/07/%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90-%EB%AA%A8%EB%B0%94%EC%9D%BC-%EA%B0%A4%EB%9F%AD%EC%8B%9C-Z%ED%94%8C%EB%A6%BD6-%EC%96%B8%ED%8C%A92024-2.png',
        licenseNote: SAMSUNG_KR_NEWSROOM_LICENSE_NOTE
      },
      '민트': {
        url: '/images/official/samsung-galaxy-z-flip6-mint.jpg',
        aliases: ['mint'],
        orientation: 'front-and-back',
        transparent: false,
        format: 'jpg',
        sourceName: '삼성전자 뉴스룸 코리아',
        sourceArticleUrl:
          'https://news.samsung.com/kr/삼성전자-갤럭시-z-폴드6·갤럭시-z-플립6·갤럭시-버',
        imageUrl:
          'https://img.kr.news.samsung.com/kr/wp-content/uploads/2024/07/%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90-%EB%AA%A8%EB%B0%94%EC%9D%BC-%EA%B0%A4%EB%9F%AD%EC%8B%9C-Z%ED%94%8C%EB%A6%BD6-%EC%96%B8%ED%8C%A92024-1.jpg',
        licenseNote: SAMSUNG_KR_NEWSROOM_LICENSE_NOTE
      }
    }
  },
  'galaxy-a35-5g': {
    category: 'smartphone',
    brand: 'samsung',
    domesticModelNumbers: ['SM-A356N'],
    modelNames: ['galaxy a35 5g', '갤럭시 a35 5g'],
    colors: {
      '어썸 아이스블루': {
        url: '/images/official/samsung-galaxy-a35-5g-awesome-iceblue.jpg',
        aliases: ['어썸아이스블루', '어썸 아이스 블루', 'awesome iceblue', 'awesome ice blue'],
        orientation: 'front-and-back',
        transparent: false,
        format: 'jpg',
        sourceName: '삼성전자 뉴스룸 코리아',
        sourceArticleUrl: 'https://news.samsung.com/kr/456735-2',
        imageUrl:
          'https://img.kr.news.samsung.com/kr/wp-content/uploads/2024/06/%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90-%EB%AA%A8%EB%B0%94%EC%9D%BC-%EA%B0%A4%EB%9F%AD%EC%8B%9C-%EA%B0%A4%EB%9F%AD%EC%8B%9C-A35-5G-%EC%B6%9C%EC%8B%9C-1-e1718779744456.jpg',
        licenseNote: SAMSUNG_KR_NEWSROOM_LICENSE_NOTE
      }
    }
  },
  'galaxy-s23-ultra': {
    category: 'smartphone',
    brand: 'samsung',
    domesticModelNumbers: ['SM-S918N'],
    modelNames: ['galaxy s23 ultra', '갤럭시 s23 울트라'],
    colors: {
      '그린': {
        url: '/images/official/samsung-galaxy-s23-ultra-green.jpg',
        aliases: ['green'],
        orientation: 'front-and-back',
        transparent: false,
        format: 'jpg',
        sourceName: '삼성전자 뉴스룸 코리아',
        sourceArticleUrl:
          'https://news.samsung.com/kr/삼성전자-갤럭시-s23-시리즈-전격-공개',
        imageUrl:
          'https://img.kr.news.samsung.com/kr/wp-content/uploads/2023/02/2-%EA%B0%A4%EB%9F%AD%EC%8B%9C-S23-%EC%9A%B8%ED%8A%B8%EB%9D%BC_%EA%B7%B8%EB%A6%B0.jpg',
        licenseNote: SAMSUNG_KR_NEWSROOM_LICENSE_NOTE
      },
      '팬텀 블랙': {
        url: '/images/official/samsung-galaxy-s23-ultra-phantom-black.jpg',
        aliases: ['팬텀블랙', 'phantom black'],
        orientation: 'front-and-back',
        transparent: false,
        format: 'jpg',
        sourceName: '삼성전자 뉴스룸 코리아',
        sourceArticleUrl:
          'https://news.samsung.com/kr/삼성전자-갤럭시-s23-시리즈-전격-공개',
        imageUrl:
          'https://img.kr.news.samsung.com/kr/wp-content/uploads/2023/02/5-%EA%B0%A4%EB%9F%AD%EC%8B%9C-S23-%EC%9A%B8%ED%8A%B8%EB%9D%BC_%ED%8C%AC%ED%85%80-%EB%B8%94%EB%9E%99.jpg',
        licenseNote: SAMSUNG_KR_NEWSROOM_LICENSE_NOTE
      }
    }
  }
}

export const UNVERIFIED_OR_RESTRICTED_MODELS = {
  apple: {
    models: [
      'iPhone 16 Pro Max',
      'iPhone 16 Pro',
      'iPhone 16 Plus',
      'iPhone 16',
      'iPhone 15 Plus',
      'iPhone 15 Pro Max',
      'iPhone 15 Pro',
      'iPhone 15'
    ],
    reason:
      'Apple Site Terms prohibit unauthorized copying/publishing/distribution; user may supply permitted local assets via assets-source/official-renders/originals/.'
  },
  samsungUnsecured: {
    models: ['Galaxy S24 FE', 'Galaxy S24 Ultra', 'Galaxy S24+', 'Galaxy S24'],
    reason:
      'Samsung Korea Newsroom lacked unmodified standalone colorway renders matching DB SKUs; user may supply permitted local assets via assets-source/official-renders/originals/.'
  }
}

/**
 * Teammate project reference representative images (located in `/images/products/`).
 * Used exclusively for review inspection when an official model+color render is not yet supplied.
 * 1:1 mapped to 16 smartphones, 14 tablets, and 10 smartwatches (40 models total).
 */
export const MODEL_REFERENCE_IMAGE_MANIFEST = {
  // === 16 Smartphones ===
  'galaxy-s24-ultra': {
    category: 'smartphone',
    brand: 'samsung',
    modelName: 'Galaxy S24 Ultra',
    modelNames: ['galaxy s24 ultra', '갤럭시 s24 울트라'],
    domesticModelNumbers: ['SM-S928N'],
    smartphoneKeys: ['galaxy-s24-ultra'],
    fileName: 'galaxy-s24-ultra.jpg',
    url: '/images/products/galaxy-s24-ultra.jpg',
    orientation: 'portrait'
  },
  'galaxy-s24-plus': {
    category: 'smartphone',
    brand: 'samsung',
    modelName: 'Galaxy S24+',
    modelNames: ['galaxy s24+', 'galaxy s24 plus', '갤럭시 s24+', '갤럭시 s24 플러스'],
    domesticModelNumbers: ['SM-S926N'],
    smartphoneKeys: ['galaxy-s24-plus'],
    fileName: 'galaxy-s24-plus.jpg',
    url: '/images/products/galaxy-s24-plus.jpg',
    orientation: 'portrait'
  },
  'galaxy-s24': {
    category: 'smartphone',
    brand: 'samsung',
    modelName: 'Galaxy S24',
    modelNames: ['galaxy s24', '갤럭시 s24'],
    domesticModelNumbers: ['SM-S921N'],
    smartphoneKeys: ['galaxy-s24'],
    fileName: 'galaxy-s24.jpg',
    url: '/images/products/galaxy-s24.jpg',
    orientation: 'portrait'
  },
  'galaxy-s24-fe': {
    category: 'smartphone',
    brand: 'samsung',
    modelName: 'Galaxy S24 FE',
    modelNames: ['galaxy s24 fe', '갤럭시 s24 fe'],
    domesticModelNumbers: ['SM-S721N'],
    smartphoneKeys: ['galaxy-s24-fe'],
    fileName: 'galaxy-s24-fe.jpg',
    url: '/images/products/galaxy-s24-fe.jpg',
    orientation: 'portrait'
  },
  'galaxy-z-fold6': {
    category: 'smartphone',
    brand: 'samsung',
    modelName: 'Galaxy Z Fold6',
    modelNames: ['galaxy z fold6', '갤럭시 z 폴드6'],
    domesticModelNumbers: ['SM-F956N'],
    smartphoneKeys: ['galaxy-z-fold6'],
    fileName: 'galaxy-z-fold6.jpg',
    url: '/images/products/galaxy-z-fold6.jpg',
    orientation: 'portrait'
  },
  'galaxy-z-flip6': {
    category: 'smartphone',
    brand: 'samsung',
    modelName: 'Galaxy Z Flip6',
    modelNames: ['galaxy z flip6', '갤럭시 z 플립6'],
    domesticModelNumbers: ['SM-F741N'],
    smartphoneKeys: ['galaxy-z-flip6'],
    fileName: 'galaxy-z-flip6.jpg',
    url: '/images/products/galaxy-z-flip6.jpg',
    orientation: 'portrait'
  },
  'galaxy-a35-5g': {
    category: 'smartphone',
    brand: 'samsung',
    modelName: 'Galaxy A35 5G',
    modelNames: ['galaxy a35 5g', 'galaxy a35', '갤럭시 a35 5g', '갤럭시 a35'],
    domesticModelNumbers: ['SM-A356N'],
    smartphoneKeys: ['galaxy-a35-5g'],
    fileName: 'galaxy-a35-5g.jpg',
    url: '/images/products/galaxy-a35-5g.jpg',
    orientation: 'portrait'
  },
  'galaxy-s23-ultra': {
    category: 'smartphone',
    brand: 'samsung',
    modelName: 'Galaxy S23 Ultra',
    modelNames: ['galaxy s23 ultra', '갤럭시 s23 울트라'],
    domesticModelNumbers: ['SM-S918N'],
    smartphoneKeys: ['galaxy-s23-ultra'],
    fileName: 'galaxy-s23-ultra.jpg',
    url: '/images/products/galaxy-s23-ultra.jpg',
    orientation: 'portrait'
  },
  'iphone-16-pro-max': {
    category: 'smartphone',
    brand: 'apple',
    modelName: 'iPhone 16 Pro Max',
    modelNames: ['iphone 16 pro max', '아이폰 16 프로 맥스', '아이폰 16 프로맥스'],
    domesticModelNumbers: ['A3296'],
    smartphoneKeys: ['iphone-16-pro-max'],
    fileName: 'iphone-16-pro-max.jpg',
    url: '/images/products/iphone-16-pro-max.jpg',
    orientation: 'portrait'
  },
  'iphone-16-pro': {
    category: 'smartphone',
    brand: 'apple',
    modelName: 'iPhone 16 Pro',
    modelNames: ['iphone 16 pro', '아이폰 16 프로'],
    domesticModelNumbers: ['A3293'],
    smartphoneKeys: ['iphone-16-pro'],
    fileName: 'iphone-16-pro.jpg',
    url: '/images/products/iphone-16-pro.jpg',
    orientation: 'portrait'
  },
  'iphone-16-plus': {
    category: 'smartphone',
    brand: 'apple',
    modelName: 'iPhone 16 Plus',
    modelNames: ['iphone 16 plus', '아이폰 16 플러스'],
    domesticModelNumbers: ['A3290'],
    smartphoneKeys: ['iphone-16-plus'],
    fileName: 'iphone-16-plus.jpg',
    url: '/images/products/iphone-16-plus.jpg',
    orientation: 'portrait'
  },
  'iphone-16': {
    category: 'smartphone',
    brand: 'apple',
    modelName: 'iPhone 16',
    modelNames: ['iphone 16', '아이폰 16'],
    domesticModelNumbers: ['A3287'],
    smartphoneKeys: ['iphone-16'],
    fileName: 'iphone-16.jpg',
    url: '/images/products/iphone-16.jpg',
    orientation: 'portrait'
  },
  'iphone-15-pro-max': {
    category: 'smartphone',
    brand: 'apple',
    modelName: 'iPhone 15 Pro Max',
    modelNames: ['iphone 15 pro max', '아이폰 15 프로 맥스', '아이폰 15 프로맥스'],
    domesticModelNumbers: ['A3106'],
    smartphoneKeys: ['iphone-15-pro-max'],
    fileName: 'iphone-15-pro-max.jpg',
    url: '/images/products/iphone-15-pro-max.jpg',
    orientation: 'portrait'
  },
  'iphone-15-pro': {
    category: 'smartphone',
    brand: 'apple',
    modelName: 'iPhone 15 Pro',
    modelNames: ['iphone 15 pro', '아이폰 15 프로'],
    domesticModelNumbers: ['A3102'],
    smartphoneKeys: ['iphone-15-pro'],
    fileName: 'iphone-15-pro.jpg',
    url: '/images/products/iphone-15-pro.jpg',
    orientation: 'portrait'
  },
  'iphone-15-plus': {
    category: 'smartphone',
    brand: 'apple',
    modelName: 'iPhone 15 Plus',
    modelNames: ['iphone 15 plus', '아이폰 15 플러스'],
    domesticModelNumbers: ['A3094'],
    smartphoneKeys: ['iphone-15-plus'],
    fileName: 'iphone-15-plus.jpg',
    url: '/images/products/iphone-15-plus.jpg',
    orientation: 'portrait'
  },
  'iphone-15': {
    category: 'smartphone',
    brand: 'apple',
    modelName: 'iPhone 15',
    modelNames: ['iphone 15', '아이폰 15'],
    domesticModelNumbers: ['A3090'],
    smartphoneKeys: ['iphone-15'],
    fileName: 'iphone-15.jpg',
    url: '/images/products/iphone-15.jpg',
    orientation: 'portrait'
  },

  // === 14 Tablets ===
  'galaxy-tab-s9-fe-plus': {
    category: 'tablet',
    brand: 'samsung',
    modelName: 'Galaxy Tab S9 FE+',
    modelNames: ['galaxy tab s9 fe+', 'galaxy tab s9 fe plus', '갤럭시 탭 s9 fe+'],
    domesticModelNumbers: ['SM-X610'],
    ids: ['p0000000-0000-4000-8000-793945917345'],
    fileName: 'galaxy-tab-s9-fe-plus.jpg',
    url: '/images/products/galaxy-tab-s9-fe-plus.jpg',
    orientation: 'landscape'
  },
  'galaxy-tab-s9': {
    category: 'tablet',
    brand: 'samsung',
    modelName: 'Galaxy Tab S9',
    modelNames: ['galaxy tab s9', '갤럭시 탭 s9'],
    domesticModelNumbers: ['SM-X710'],
    ids: ['p0000000-0000-4000-8000-793945923940'],
    fileName: 'galaxy-tab-s9.jpg',
    url: '/images/products/galaxy-tab-s9.jpg',
    orientation: 'landscape'
  },
  'galaxy-tab-s9-plus': {
    category: 'tablet',
    brand: 'samsung',
    modelName: 'Galaxy Tab S9+',
    modelNames: ['galaxy tab s9+', 'galaxy tab s9 plus', '갤럭시 탭 s9+'],
    domesticModelNumbers: ['SM-X810'],
    ids: ['p0000000-0000-4000-8000-793945925915'],
    fileName: 'galaxy-tab-s9-plus.jpg',
    url: '/images/products/galaxy-tab-s9-plus.jpg',
    orientation: 'landscape'
  },
  'ipad-a16': {
    category: 'tablet',
    brand: 'apple',
    modelName: 'iPad (A16)',
    modelNames: ['ipad (a16)', 'ipad a16', '아이패드 (a16)'],
    domesticModelNumbers: ['A3354'],
    ids: ['p0000000-0000-4000-8000-793945922214'],
    fileName: 'ipad-a16.jpg',
    url: '/images/products/ipad-a16.jpg',
    orientation: 'portrait'
  },
  'ipad-air-11-m3': {
    category: 'tablet',
    brand: 'apple',
    modelName: 'iPad Air 11 (M3)',
    modelNames: ['ipad air 11 (m3)', 'ipad air 11 m3', '아이패드 에어 11 (m3)'],
    domesticModelNumbers: ['A3266'],
    ids: ['p0000000-0000-4000-8000-793945922763'],
    fileName: 'ipad-air-11-m3.jpg',
    url: '/images/products/ipad-air-11-m3.jpg',
    orientation: 'portrait'
  },
  'ipad-air-13-m3': {
    category: 'tablet',
    brand: 'apple',
    modelName: 'iPad Air 13 (M3)',
    modelNames: ['ipad air 13 (m3)', 'ipad air 13 m3', '아이패드 에어 13 (m3)'],
    domesticModelNumbers: ['A3268'],
    ids: ['p0000000-0000-4000-8000-793945925312'],
    fileName: 'ipad-air-13-m3.jpg',
    url: '/images/products/ipad-air-13-m3.jpg',
    orientation: 'portrait'
  },
  'ipad-pro-13-m4': {
    category: 'tablet',
    brand: 'apple',
    modelName: 'iPad Pro 13 (M4)',
    modelNames: ['ipad pro 13 (m4)', 'ipad pro 13 m4', '아이패드 프로 13 (m4)'],
    domesticModelNumbers: ['A2925'],
    ids: ['p0000000-0000-4000-8000-000000000015'],
    fileName: 'ipad-pro-13-m4.jpg',
    url: '/images/products/ipad-pro-13-m4.jpg',
    orientation: 'portrait'
  },
  'ipad-pro-11-m4': {
    category: 'tablet',
    brand: 'apple',
    modelName: 'iPad Pro 11 (M4)',
    modelNames: ['ipad pro 11 (m4)', 'ipad pro 11 m4', '아이패드 프로 11 (m4)'],
    domesticModelNumbers: ['A2836'],
    ids: ['p0000000-0000-4000-8000-000000000016'],
    fileName: 'ipad-pro-11-m4.jpg',
    url: '/images/products/ipad-pro-11-m4.jpg',
    orientation: 'portrait'
  },
  'ipad-air-13-m2': {
    category: 'tablet',
    brand: 'apple',
    modelName: 'iPad Air 13 (M2)',
    modelNames: ['ipad air 13 (m2)', 'ipad air 13 m2', '아이패드 에어 13 (m2)'],
    domesticModelNumbers: ['A2898'],
    ids: ['p0000000-0000-4000-8000-000000000017'],
    fileName: 'ipad-air-13-m2.jpg',
    url: '/images/products/ipad-air-13-m2.jpg',
    orientation: 'portrait'
  },
  'ipad-mini-a17-pro': {
    category: 'tablet',
    brand: 'apple',
    modelName: 'iPad mini (A17 Pro)',
    modelNames: ['ipad mini (a17 pro)', 'ipad mini a17 pro', '아이패드 미니 (a17 pro)'],
    domesticModelNumbers: ['A2993'],
    ids: ['p0000000-0000-4000-8000-000000000018'],
    fileName: 'ipad-mini-a17-pro.jpg',
    url: '/images/products/ipad-mini-a17-pro.jpg',
    orientation: 'portrait'
  },
  'galaxy-tab-s10-ultra': {
    category: 'tablet',
    brand: 'samsung',
    modelName: 'Galaxy Tab S10 Ultra',
    modelNames: ['galaxy tab s10 ultra', '갤럭시 탭 s10 울트라'],
    domesticModelNumbers: ['SM-X920'],
    ids: ['p0000000-0000-4000-8000-000000000019'],
    fileName: 'galaxy-tab-s10-ultra.jpg',
    url: '/images/products/galaxy-tab-s10-ultra.jpg',
    orientation: 'landscape'
  },
  'galaxy-tab-s10-plus': {
    category: 'tablet',
    brand: 'samsung',
    modelName: 'Galaxy Tab S10+',
    modelNames: ['galaxy tab s10+', 'galaxy tab s10 plus', '갤럭시 탭 s10+'],
    domesticModelNumbers: ['SM-X820'],
    ids: ['p0000000-0000-4000-8000-000000000020'],
    fileName: 'galaxy-tab-s10-plus.jpg',
    url: '/images/products/galaxy-tab-s10-plus.jpg',
    orientation: 'landscape'
  },
  'galaxy-tab-s9-ultra': {
    category: 'tablet',
    brand: 'samsung',
    modelName: 'Galaxy Tab S9 Ultra',
    modelNames: ['galaxy tab s9 ultra', '갤럭시 탭 s9 울트라'],
    domesticModelNumbers: ['SM-X910'],
    ids: ['p0000000-0000-4000-8000-000000000021'],
    fileName: 'galaxy-tab-s9-ultra.jpg',
    url: '/images/products/galaxy-tab-s9-ultra.jpg',
    orientation: 'landscape'
  },
  'galaxy-tab-s9-fe': {
    category: 'tablet',
    brand: 'samsung',
    modelName: 'Galaxy Tab S9 FE',
    modelNames: ['galaxy tab s9 fe', '갤럭시 탭 s9 fe'],
    domesticModelNumbers: ['SM-X510'],
    ids: ['p0000000-0000-4000-8000-000000000022'],
    fileName: 'galaxy-tab-s9-fe.jpg',
    url: '/images/products/galaxy-tab-s9-fe.jpg',
    orientation: 'landscape'
  },

  // === 10 Smartwatches ===
  'galaxy-watch8-44': {
    category: 'smartwatch',
    brand: 'samsung',
    modelName: 'Galaxy Watch8 44mm',
    modelNames: ['galaxy watch8 44mm', 'galaxy watch8', '갤럭시 워치8 44mm'],
    domesticModelNumbers: ['SM-L330'],
    ids: ['p0000000-0000-4000-8000-793945925597'],
    sizeMm: 44,
    fileName: 'galaxy-watch8-44.jpg',
    url: '/images/products/galaxy-watch8-44.jpg',
    orientation: 'portrait'
  },
  'apple-watch-series-11-46': {
    category: 'smartwatch',
    brand: 'apple',
    modelName: 'Apple Watch Series 11 46mm',
    modelNames: ['apple watch series 11 46mm', '애플워치 시리즈 11 46mm'],
    domesticModelNumbers: ['A3331'],
    ids: ['p0000000-0000-4000-8000-793945917387'],
    sizeMm: 46,
    fileName: 'apple-watch-series-11-46.jpg',
    url: '/images/products/apple-watch-series-11-46.jpg',
    orientation: 'portrait'
  },
  'apple-watch-series-10-46': {
    category: 'smartwatch',
    brand: 'apple',
    modelName: 'Apple Watch Series 10 46mm',
    modelNames: ['apple watch series 10 46mm', '애플워치 시리즈 10 46mm'],
    domesticModelNumbers: ['A2999'],
    ids: ['p0000000-0000-4000-8000-000000000023'],
    sizeMm: 46,
    fileName: 'apple-watch-series-10-46.jpg',
    url: '/images/products/apple-watch-series-10-46.jpg',
    orientation: 'portrait'
  },
  'apple-watch-series-10-42': {
    category: 'smartwatch',
    brand: 'apple',
    modelName: 'Apple Watch Series 10 42mm',
    modelNames: ['apple watch series 10 42mm', '애플워치 시리즈 10 42mm'],
    domesticModelNumbers: ['A2997'],
    ids: ['p0000000-0000-4000-8000-000000000024'],
    sizeMm: 42,
    fileName: 'apple-watch-series-10-42.jpg',
    url: '/images/products/apple-watch-series-10-42.jpg',
    orientation: 'portrait'
  },
  'apple-watch-ultra-2': {
    category: 'smartwatch',
    brand: 'apple',
    modelName: 'Apple Watch Ultra 2 49mm',
    modelNames: ['apple watch ultra 2 49mm', 'apple watch ultra 2', '애플워치 울트라 2'],
    domesticModelNumbers: ['A2986'],
    ids: ['p0000000-0000-4000-8000-000000000025'],
    sizeMm: 49,
    fileName: 'apple-watch-ultra-2.jpg',
    url: '/images/products/apple-watch-ultra-2.jpg',
    orientation: 'portrait'
  },
  'apple-watch-series-9-45': {
    category: 'smartwatch',
    brand: 'apple',
    modelName: 'Apple Watch Series 9 45mm',
    modelNames: ['apple watch series 9 45mm', '애플워치 시리즈 9 45mm'],
    domesticModelNumbers: ['A2980'],
    ids: ['p0000000-0000-4000-8000-000000000026'],
    sizeMm: 45,
    fileName: 'apple-watch-series-9-45.jpg',
    url: '/images/products/apple-watch-series-9-45.jpg',
    orientation: 'portrait'
  },
  'galaxy-watch-ultra': {
    category: 'smartwatch',
    brand: 'samsung',
    modelName: 'Galaxy Watch Ultra 47mm',
    modelNames: ['galaxy watch ultra 47mm', 'galaxy watch ultra', '갤럭시 워치 울트라'],
    domesticModelNumbers: ['SM-L705N'],
    ids: ['p0000000-0000-4000-8000-000000000027'],
    sizeMm: 47,
    fileName: 'galaxy-watch-ultra.jpg',
    url: '/images/products/galaxy-watch-ultra.jpg',
    orientation: 'portrait'
  },
  'galaxy-watch7-44': {
    category: 'smartwatch',
    brand: 'samsung',
    modelName: 'Galaxy Watch7 44mm',
    modelNames: ['galaxy watch7 44mm', 'galaxy watch7', '갤럭시 워치7 44mm'],
    domesticModelNumbers: ['SM-L310'],
    ids: ['p0000000-0000-4000-8000-000000000028'],
    sizeMm: 44,
    fileName: 'galaxy-watch7-44.jpg',
    url: '/images/products/galaxy-watch7-44.jpg',
    orientation: 'portrait'
  },
  'galaxy-watch6-classic-47': {
    category: 'smartwatch',
    brand: 'samsung',
    modelName: 'Galaxy Watch6 Classic 47mm',
    modelNames: ['galaxy watch6 classic 47mm', '갤럭시 워치6 클래식 47mm'],
    domesticModelNumbers: ['SM-R960'],
    ids: ['p0000000-0000-4000-8000-000000000029'],
    sizeMm: 47,
    fileName: 'galaxy-watch6-classic-47.jpg',
    url: '/images/products/galaxy-watch6-classic-47.jpg',
    orientation: 'portrait'
  },
  'galaxy-watch-fe': {
    category: 'smartwatch',
    brand: 'samsung',
    modelName: 'Galaxy Watch FE 40mm',
    modelNames: ['galaxy watch fe 40mm', 'galaxy watch fe', '갤럭시 워치 fe'],
    domesticModelNumbers: ['SM-R861'],
    ids: ['p0000000-0000-4000-8000-000000000030'],
    sizeMm: 40,
    fileName: 'galaxy-watch-fe.jpg',
    url: '/images/products/galaxy-watch-fe.jpg',
    orientation: 'portrait'
  }
}

export function normalizeBrand(brand) {
  return String(brand || '').trim().toLowerCase()
}

export function normalizeModelName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function normalizeCode(code) {
  return String(code || '').trim().toUpperCase()
}

export function normalizeColorKey(color) {
  return String(color || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

function isAllowedOfficialExplicitUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return false
  const trimmed = rawUrl.trim()
  return trimmed.startsWith('/images/official/')
}

function buildManifestIndex(rawEntries, origin) {
  const byKey = new Map()
  const byCode = new Map()
  const byBrandName = new Map()

  for (const [key, rawEntry] of Object.entries(rawEntries || {})) {
    if (!rawEntry || typeof rawEntry !== 'object') continue
    const colorIndex = new Map()
    for (const [canonicalColor, colorMeta] of Object.entries(rawEntry.colors || {})) {
      if (!colorMeta || !isAllowedOfficialExplicitUrl(colorMeta.url)) continue
      const names = [canonicalColor, ...(colorMeta.aliases || [])]
      for (const candidate of names) {
        const norm = normalizeColorKey(candidate)
        if (norm) {
          colorIndex.set(norm, { canonicalColor, ...colorMeta, origin })
        }
      }
    }
    const indexed = { key, ...rawEntry, origin, colorIndex }
    byKey.set(key.toLowerCase(), indexed)
    for (const code of indexed.domesticModelNumbers || []) {
      const c = normalizeCode(code)
      if (c) byCode.set(c, indexed)
    }
    for (const name of indexed.modelNames || []) {
      const b = normalizeBrand(indexed.brand)
      const n = normalizeModelName(name)
      if (b && n) byBrandName.set(`${b}:${n}`, indexed)
    }
  }

  return { byKey, byCode, byBrandName }
}

function findEntryInIndex(index, product) {
  // Prioritize domestic_model_number per modelCode + color mapping policy
  const code = normalizeCode(product.domestic_model_number)
  if (code && index.byCode.has(code)) {
    const match = index.byCode.get(code)
    const prodBrand = normalizeBrand(product.brand)
    if (!prodBrand || !match.brand || prodBrand === normalizeBrand(match.brand)) {
      return match
    }
  }

  const smartphoneKey = String(product.smartphone_key || '').trim().toLowerCase()
  if (smartphoneKey && index.byKey.has(smartphoneKey)) {
    return index.byKey.get(smartphoneKey)
  }

  const name = normalizeModelName(product.model_name)
  const brand = normalizeBrand(product.brand)
  if (name && brand && index.byBrandName.has(`${brand}:${name}`)) {
    return index.byBrandName.get(`${brand}:${name}`)
  }

  return null
}

function buildReferenceIndex(entries) {
  const byId = new Map()
  const byCode = new Map()
  const byKey = new Map()
  const byBrandName = new Map()

  for (const [key, rawEntry] of Object.entries(entries || {})) {
    if (!rawEntry || typeof rawEntry !== 'object') continue
    const full = { key, ...rawEntry }
    byKey.set(key.toLowerCase(), full)
    for (const id of full.ids || []) {
      if (id) byId.set(String(id).trim().toLowerCase(), full)
    }
    for (const code of full.domesticModelNumbers || []) {
      const c = normalizeCode(code)
      if (c) byCode.set(c, full)
    }
    for (const skey of full.smartphoneKeys || []) {
      if (skey) byKey.set(String(skey).trim().toLowerCase(), full)
    }
    for (const name of full.modelNames || []) {
      const b = normalizeBrand(full.brand)
      const n = normalizeModelName(name)
      if (b && n) byBrandName.set(`${b}:${n}`, full)
    }
  }

  return { byId, byCode, byKey, byBrandName }
}

function findReferenceInIndex(index, product) {
  if (!product || typeof product !== 'object') return null

  // 1. Match by id / variant_id (for supplemental devices)
  const rawId = String(product.id || product.variant_id || '').trim().toLowerCase()
  if (rawId && index.byId.has(rawId)) {
    return index.byId.get(rawId)
  }

  // 2. Match by domestic_model_number (exact model number)
  const code = normalizeCode(product.domestic_model_number)
  if (code && index.byCode.has(code)) {
    const candidate = index.byCode.get(code)
    if (!product.category || !candidate.category || normalizeBrand(product.category) === normalizeBrand(candidate.category)) {
      return candidate
    }
  }

  // 3. Match by smartphone_key
  const skey = String(product.smartphone_key || '').trim().toLowerCase()
  if (skey && index.byKey.has(skey)) {
    return index.byKey.get(skey)
  }

  // 4. Match by brand:model_name
  const b = normalizeBrand(product.brand)
  const n = normalizeModelName(product.model_name)
  if (b && n && index.byBrandName.has(`${b}:${n}`)) {
    const candidate = index.byBrandName.get(`${b}:${n}`)
    if (!product.category || !candidate.category || normalizeBrand(product.category) === normalizeBrand(candidate.category)) {
      return candidate
    }
  }

  return null
}

/**
 * Create a self-contained image resolver combining:
 * 1. User-provided processed official renders (Priority 1)
 * 2. Verified Samsung Newsroom official renders (Priority 2)
 * 3. Teammate model-representative JPG reference images (Priority 3)
 * 4. SVG fallback (Priority 4)
 */
export function createDeviceImageResolver(
  customUserRegistry = userOfficialRenders,
  customManifest = DEVICE_MODEL_IMAGE_MANIFEST,
  customReferenceManifest = MODEL_REFERENCE_IMAGE_MANIFEST
) {
  const userIndex = buildManifestIndex(customUserRegistry?.entries || {}, 'user_provided')
  const builtInIndex = buildManifestIndex(customManifest, 'official_newsroom')
  const referenceIndex = buildReferenceIndex(customReferenceManifest)

  function lookupInIndex(index, product) {
    const entry = findEntryInIndex(index, product)
    if (!entry) return null

    if (product.category && entry.category && normalizeBrand(product.category) !== normalizeBrand(entry.category)) {
      return null
    }

    const colorKey = normalizeColorKey(product.color)
    if (!colorKey || !entry.colorIndex.has(colorKey)) {
      return null
    }

    const colorMeta = entry.colorIndex.get(colorKey)
    return {
      key: entry.key,
      origin: colorMeta.origin,
      category: entry.category,
      brand: entry.brand || normalizeBrand(product.brand),
      domesticModelNumber: normalizeCode(product.domestic_model_number) || entry.domesticModelNumbers?.[0] || null,
      storageGb: product.storage_gb ?? null,
      url: colorMeta.url,
      color: colorMeta.canonicalColor,
      matchedColor: product.color,
      orientation: colorMeta.orientation || 'portrait',
      transparent: Boolean(colorMeta.transparent),
      format: colorMeta.format || null,
      width: colorMeta.width || null,
      height: colorMeta.height || null,
      sourceName: colorMeta.sourceName || null,
      sourceUrl: colorMeta.sourceUrl || colorMeta.sourceArticleUrl || null,
      sourceArticleUrl: colorMeta.sourceArticleUrl || null,
      imageUrl: colorMeta.imageUrl || null,
      licenseNote: colorMeta.licenseNote || null,
      scope: 'official_render_variant'
    }
  }

  function lookupInReferenceIndex(product) {
    const ref = findReferenceInIndex(referenceIndex, product)
    if (!ref) return null

    return {
      key: ref.key,
      origin: 'teammate_model_reference',
      category: ref.category,
      brand: ref.brand,
      domesticModelNumber: normalizeCode(product.domestic_model_number) || ref.domesticModelNumbers?.[0] || null,
      storageGb: product.storage_gb ?? null,
      url: ref.url,
      color: product.color || null,
      matchedColor: null,
      orientation: ref.orientation || (ref.category === 'tablet' ? 'landscape' : 'portrait'),
      transparent: false,
      format: 'jpg',
      sourceName: '조원 수집 대표 모델 이미지 (점검용 임시)',
      sourceUrl: null,
      licenseNote: '조원 프로젝트 임시 대표 이미지 · 색상별 공식 렌더 교체 대기',
      scope: 'model_reference'
    }
  }

  function getDeviceImageMeta(product) {
    if (!product || typeof product !== 'object') return null
    // Priority 1: User-supplied processed official renders (exact model + DB color)
    const userMatch = lookupInIndex(userIndex, product)
    if (userMatch) return userMatch

    // Priority 2: Built-in Samsung Newsroom unmodified official renders (exact model + DB color)
    const builtInMatch = lookupInIndex(builtInIndex, product)
    if (builtInMatch) return builtInMatch

    // Priority 3: Teammate model-representative JPG asset from /images/products/
    const refMatch = lookupInReferenceIndex(product)
    if (refMatch) return refMatch

    // Priority 4: null -> clean SVG placeholder fallback
    return null
  }

  function resolveDeviceImage(product) {
    if (!product || typeof product !== 'object') return null
    const explicitCandidates = [
      product.variant_image_url,
      product.image_url,
      product.thumbnailUrl,
      product.thumbnail_url
    ]
    for (const candidate of explicitCandidates) {
      if (isAllowedOfficialExplicitUrl(candidate)) {
        return candidate.trim()
      }
    }
    return getDeviceImageMeta(product)?.url || null
  }

  function isOfficialRender(product) {
    if (!product || typeof product !== 'object') return false
    if (isAllowedOfficialExplicitUrl(product.variant_image_url)) return true
    const meta = getDeviceImageMeta(product)
    return Boolean(meta?.url && meta?.scope === 'official_render_variant')
  }

  function isModelReferenceImage(product) {
    if (!product || typeof product !== 'object') return false
    const meta = getDeviceImageMeta(product)
    return Boolean(meta?.url && meta?.scope === 'model_reference')
  }

  function isTransparentOfficialRender(product) {
    const meta = getDeviceImageMeta(product)
    if (!meta) return false
    return Boolean(meta.transparent)
  }

  function isPortraitOfficialRender(product) {
    const meta = getDeviceImageMeta(product)
    return meta?.orientation === 'portrait'
  }

  function getManifestImagePaths() {
    const paths = []
    for (const raw of [customUserRegistry?.entries || {}, customManifest]) {
      for (const entry of Object.values(raw)) {
        for (const colorMeta of Object.values(entry?.colors || {})) {
          if (isAllowedOfficialExplicitUrl(colorMeta?.url)) {
            paths.push(colorMeta.url)
          }
        }
      }
    }
    for (const ref of Object.values(customReferenceManifest || {})) {
      if (typeof ref?.url === 'string') {
        paths.push(ref.url)
      }
    }
    return [...new Set(paths)]
  }

  function getDeviceImages(product) {
    const meta = getDeviceImageMeta(product)
    if (!meta || !meta.url) return null
    return {
      url: meta.url,
      primary: meta.url,
      color: meta.color,
      orientation: meta.orientation,
      transparent: Boolean(meta.transparent),
      format: meta.format || null,
      width: meta.width || null,
      height: meta.height || null,
      scope: meta.scope
    }
  }

  return {
    getDeviceImageMeta,
    resolveDeviceImage,
    getDeviceImages,
    isOfficialRender,
    isModelReferenceImage,
    isTransparentOfficialRender,
    isPortraitOfficialRender,
    getManifestImagePaths
  }
}

const defaultResolver = createDeviceImageResolver(
  userOfficialRenders,
  DEVICE_MODEL_IMAGE_MANIFEST,
  MODEL_REFERENCE_IMAGE_MANIFEST
)

export function getDeviceImageMeta(product) {
  return defaultResolver.getDeviceImageMeta(product)
}

export function resolveDeviceImage(product) {
  return defaultResolver.resolveDeviceImage(product)
}

export function getDeviceImages(product) {
  return defaultResolver.getDeviceImages(product)
}

export function isOfficialRender(product) {
  return defaultResolver.isOfficialRender(product)
}

export function isModelReferenceImage(product) {
  return defaultResolver.isModelReferenceImage(product)
}

export function isTransparentOfficialRender(product) {
  return defaultResolver.isTransparentOfficialRender(product)
}

export function isPortraitOfficialRender(product) {
  return defaultResolver.isPortraitOfficialRender(product)
}

export function getManifestImagePaths() {
  return defaultResolver.getManifestImagePaths()
}

/**
 * Return all catalog variants matching the same physical device model (grouped by domestic_model_number
 * or smartphone_key / brand+model_name), sorted cleanly by storage_gb then color for capacity/color UI selectors.
 */
export function getAvailableVariantsForProduct(product, catalog = []) {
  if (!product || !Array.isArray(catalog) || catalog.length === 0) return []
  const sid = product.smartphone_id !== undefined && product.smartphone_id !== null
    ? String(product.smartphone_id).trim()
    : ''
  const code = normalizeCode(product.domestic_model_number)
  const skey = String(product.smartphone_key || '').trim().toLowerCase()
  const b = normalizeBrand(product.brand)
  const m = normalizeModelName(product.model_name)

  const matches = catalog.filter(item => {
    if (!item || typeof item !== 'object') return false
    if (sid && item.smartphone_id !== undefined && item.smartphone_id !== null) {
      return String(item.smartphone_id).trim() === sid
    }
    if (skey && String(item.smartphone_key || '').trim().toLowerCase() === skey) return true
    if (code && normalizeCode(item.domestic_model_number) === code) return true
    return b && m && normalizeBrand(item.brand) === b && normalizeModelName(item.model_name) === m
  })

  // Deduplicate by variant_id or storage+color key
  const unique = []
  const seen = new Set()
  for (const v of matches) {
    const sig = String(v.variant_id || v.id || `${v.storage_gb || ''}:${v.color || ''}`)
    if (!seen.has(sig)) {
      seen.add(sig)
      unique.push(v)
    }
  }

  return unique.sort((a, z) => {
    const sa = Number(a.storage_gb || 0)
    const sz = Number(z.storage_gb || 0)
    if (sa !== sz) return sa - sz
    return String(a.color || '').localeCompare(String(z.color || ''), 'ko')
  })
}
