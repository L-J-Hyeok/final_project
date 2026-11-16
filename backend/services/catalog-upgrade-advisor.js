'use strict';

const catalog = require('./smartphone-catalog');
const catalogEngine = require('./catalog-recommendation-engine');
const memberRouter = require('../routes/member');

const UPGRADE_DECISION_MAP = {
  recommend: 'REPLACE',
  keep: 'KEEP',
  defer: 'DEFER',
  clarify: 'CLARIFY'
};

const NEED_LABELS = {
  battery: '배터리·사용 시간',
  camera: '카메라·영상',
  performance: '성능·연산',
  portability: '무게·휴대성',
  display: '화면·주사율',
  storage: '저장 용량(SSD/내장메모리)',
  ram: '메모리(RAM)',
  gpu: '외장 그래픽(GPU)',
  pen: '펜·필기 지원',
  keyboard: '키보드·생산성 연결',
  anc: '액티브 노이즈 캔슬링(ANC)',
  codec: '고음질 오디오 코덱',
  multipoint: '멀티포인트 연결',
  water_resistance: '방수·방진 등급',
  gps: '단독 GPS·운동 센서',
  cellular: '셀룰러(LTE/5G) 단독 통신',
  power: '스피커 정격 출력(W)',
  multipairing: '멀티페어링·스테레오 연결',
  os_ecosystem: '스마트폰 OS·생태계 호환성',
  price: '구매 비용'
};

function isPlainObject(x) {
  return Boolean(x) && typeof x === 'object' && !Array.isArray(x);
}

function parseWaterResistanceRank(ratingStr) {
  if (typeof ratingStr !== 'string' || !ratingStr.trim()) return 0;
  const s = ratingStr.trim().toUpperCase();
  if (/IP68|5ATM.*IP68|10ATM|EN13319/.test(s)) return 5;
  if (/IP67|5ATM/.test(s)) return 4;
  if (/IP57|IP55|IP54|IPX7/.test(s)) return 3;
  if (/IPX5|IPX4/.test(s)) return 2;
  return 1;
}

function validateCatalogUpgradeContextInput(rawContext) {
  if (rawContext === undefined || rawContext === null) return null;
  if (!isPlainObject(rawContext)) throw catalog.fail('INVALID_INPUT', 422);
  catalog.object(rawContext, ['satisfied_aspects', 'pain_points', 'replacement_intent', 'no_pain_confirmed']);

  const allowedAspects = Object.keys(NEED_LABELS);
  const cleanList = val => {
    if (val === undefined || val === null) return [];
    if (!Array.isArray(val) || val.length > 8 || new Set(val).size !== val.length || val.some(v => typeof v !== 'string' || !allowedAspects.includes(v))) {
      throw catalog.fail('INVALID_INPUT', 422);
    }
    return [...val];
  };

  const satisfied_aspects = cleanList(rawContext.satisfied_aspects);
  const pain_points = cleanList(rawContext.pain_points);
  const replacement_intent = rawContext.replacement_intent === undefined || rawContext.replacement_intent === null
    ? 'moderate'
    : ['high', 'moderate', 'low_or_keep_if_okay'].includes(rawContext.replacement_intent)
      ? rawContext.replacement_intent
      : (() => { throw catalog.fail('INVALID_INPUT', 422); })();

  if (rawContext.no_pain_confirmed !== undefined && (typeof rawContext.no_pain_confirmed !== 'boolean' || (rawContext.no_pain_confirmed && pain_points.length > 0))) {
    throw catalog.fail('INVALID_INPUT', 422);
  }

  return {
    satisfied_aspects,
    pain_points,
    replacement_intent,
    ...(rawContext.no_pain_confirmed ? { no_pain_confirmed: true } : {})
  };
}

function inferPainPointsFromReason(category, text, hard = {}) {
  const t = String(text || '');
  const inferred = [];
  const add = code => {
    if (!inferred.includes(code)) inferred.push(code);
  };

  if (/배터리.*(?:부족|짧|빨리)|사용\s*시간.*짧/i.test(t)) add('battery');
  if (/무거|무게|휴대.*불편|가벼운/i.test(t) || hard.max_weight_g != null) add('portability');
  if (/저장\s*공간.*부족|용량.*부족|SSD.*부족/i.test(t) || hard.min_storage_gb != null) add('storage');
  if (/램.*부족|RAM.*부족|메모리.*부족/i.test(t) || hard.min_ram_gb != null) add('ram');
  if (/화면.*작|화면.*답답|주사율/i.test(t) || hard.min_refresh_hz != null) add('display');

  if (category === 'tablet') {
    if (/펜.*(?:안\s*됨|없|미지원|필요|필기)|필기.*불편|S펜|애플\s*펜슬/i.test(t) || hard.require_pen) add('pen');
    if (/키보드.*(?:연결|작업|필요)/i.test(t) || hard.require_keyboard) add('keyboard');
    if (/셀룰러|LTE|데이터.*개통/i.test(t) || hard.require_cellular) add('cellular');
  } else if (category === 'laptop') {
    if (/외장\s*그래픽|GPU|RTX|그래픽.*부족|게임.*끊김|렌더링/i.test(t) || hard.require_discrete_gpu) add('gpu');
    if (/느려|성능.*부족|코딩.*느림|컴파일/i.test(t)) add('performance');
  } else if (category === 'smartwatch') {
    if (/아이폰.*(?:바꾸|기변|전환|연동|호환)|갤럭시.*(?:바꾸|기변|전환|연동|호환)|안드로이드.*(?:바꾸|전환|호환)|호환.*안\s*됨/i.test(t)) add('os_ecosystem');
    if (/GPS|러닝|운동.*측정/i.test(t) || hard.require_gps) add('gps');
    if (/셀룰러|LTE|단독\s*개통/i.test(t) || hard.require_cellular) add('cellular');
    if (/방수|수영/i.test(t) || hard.require_water_resistance) add('water_resistance');
  } else if (category === 'earbuds') {
    if (/노이즈\s*캔슬링|노캔|ANC|소음/i.test(t) || hard.require_anc) add('anc');
    if (/음질|코덱|LDAC|고음질/i.test(t)) add('codec');
    if (/멀티포인트|동시\s*연결/i.test(t)) add('multipoint');
    if (/방수|운동.*땀/i.test(t) || hard.require_water_resistance) add('water_resistance');
  } else if (category === 'speaker') {
    if (/출력.*부족|소리가\s*작|음량.*부족|야외.*소리/i.test(t)) add('power');
    if (/방수|방진|야외|캠핑|물가/i.test(t) || hard.require_water_resistance) add('water_resistance');
    if (/멀티페어링|스테레오/i.test(t)) add('multipairing');
  }

  return inferred;
}

function enrichCatalogProductFields(prod, priceMap = null) {
  if (!prod) return null;
  const specs = prod.specifications || {};
  const opts = prod.options || {};
  const weightG = opts.weight_g != null ? Number(opts.weight_g) : (prod.weight_g != null ? Number(prod.weight_g) : null);
  const currentRefPrice = priceMap && prod.model_id
    ? (prod.sku_id ? priceMap.get(`${prod.model_id}:s:${prod.sku_id}`) : null) || null
    : null;

  return {
    ...prod,
    brand_lower: String(prod.brand || '').toLowerCase(),
    weight_g: weightG,
    screen_inches: specs.screen_inches != null ? Number(specs.screen_inches) : null,
    refresh_hz: specs.refresh_hz != null ? Number(specs.refresh_hz) : null,
    battery_mah: specs.battery_mah != null ? Number(specs.battery_mah) : null,
    battery_wh: specs.battery_wh != null ? Number(specs.battery_wh) : null,
    battery_hours: specs.battery_hours != null ? Number(specs.battery_hours) : null,
    case_battery_hours: specs.case_battery_hours != null ? Number(specs.case_battery_hours) : null,
    case_size_mm: opts.case_size_mm != null ? Number(opts.case_size_mm) : null,
    power_w: specs.power_w != null ? Number(specs.power_w) : null,
    current_reference_price: currentRefPrice
  };
}

async function resolveAndIdentifyOwnedDevice(db, uid, replacementDeviceId, expectedCategory, allCandidates = []) {
  const ownedRow = await db.models.owned_devices.findOne({
    where: { id: replacementDeviceId, user_id: uid }
  });
  if (!ownedRow) {
    throw catalog.fail('NOT_FOUND', 404);
  }

  const devView = await memberRouter.deviceView(ownedRow);
  const normalizedOwnedCategory = devView.category === 'watch' ? 'smartwatch' : devView.category;

  if (expectedCategory && normalizedOwnedCategory !== expectedCategory) {
    return {
      category_mismatch: true,
      owned_category: normalizedOwnedCategory,
      expected_category: expectedCategory,
      owned_device: devView,
      product: null,
      identification_status: 'category_mismatch'
    };
  }

  const priceByModelSku = new Map();
  for (const c of allCandidates) {
    if (c.price) {
      priceByModelSku.set(`${c.model_id}:s:${c.sku_id}`, c.price);
    }
  }

  // 1. Direct catalog-linked device
  if (devView.source === 'catalog' && devView.product && devView.product.verified) {
    const enriched = enrichCatalogProductFields(devView.product, priceByModelSku);
    return {
      category_mismatch: false,
      owned_category: normalizedOwnedCategory,
      expected_category: expectedCategory,
      owned_device: devView,
      product: enriched,
      identification_status: enriched.sku_id ? 'identified_catalog_sku' : 'identified_catalog_model'
    };
  }

  // 2. Manual device: try matching against verified catalog models/SKUs in this category
  const mBrand = String(devView.manual_brand || '').trim().toLowerCase();
  const mName = String(devView.manual_model_name || '').trim().toLowerCase();
  const mNumber = devView.manual_model_number ? String(devView.manual_model_number).trim().toLowerCase() : null;
  const mStorage = devView.manual_storage_gb != null ? Number(devView.manual_storage_gb) : null;
  const mSpecs = devView.manual_specs_json || {};
  const mRam = mSpecs.ram_gb != null ? Number(mSpecs.ram_gb) : null;

  let matchedCandidates = [];
  if (mNumber) {
    matchedCandidates = allCandidates.filter(c =>
      c.brand_lower === mBrand &&
      String(c.model_number || '').trim().toLowerCase() === mNumber
    );
  } else if (mBrand && mName) {
    matchedCandidates = allCandidates.filter(c =>
      c.brand_lower === mBrand &&
      String(c.model_name || '').trim().toLowerCase() === mName
    );
  }

  const distinctModelIds = [...new Set(matchedCandidates.map(c => c.model_id))];
  if (distinctModelIds.length > 1 && !mNumber) {
    return {
      category_mismatch: false,
      owned_category: normalizedOwnedCategory,
      expected_category: expectedCategory,
      owned_device: devView,
      product: null,
      identification_status: 'ambiguous_model_variant'
    };
  }

  if (distinctModelIds.length === 1) {
    let skuMatches = matchedCandidates;
    if (mStorage !== null) {
      const byStorage = skuMatches.filter(c => c.storage_gb === mStorage);
      if (byStorage.length > 0) skuMatches = byStorage;
    }
    if (mRam !== null) {
      const byRam = skuMatches.filter(c => c.ram_gb === mRam);
      if (byRam.length > 0) skuMatches = byRam;
    }
    const chosen = skuMatches[0];
    const product = {
      ...chosen,
      storage_gb: mStorage !== null ? mStorage : chosen.storage_gb,
      ram_gb: mRam !== null ? mRam : chosen.ram_gb,
      verified: true,
      current_reference_price: chosen.price || null
    };
    return {
      category_mismatch: false,
      owned_category: normalizedOwnedCategory,
      expected_category: expectedCategory,
      owned_device: devView,
      product,
      identification_status: mNumber ? 'identified_by_model_number' : 'identified_by_model_name'
    };
  }

  // 3. Unidentified manual device: check if user provided explicit structured specs
  const hasExplicitSpecs = mStorage !== null || Object.keys(mSpecs).some(k => k !== 'note' && mSpecs[k] !== null && mSpecs[k] !== undefined);
  if (!hasExplicitSpecs) {
    return {
      category_mismatch: false,
      owned_category: normalizedOwnedCategory,
      expected_category: expectedCategory,
      owned_device: devView,
      product: null,
      identification_status: 'unidentified_manual_device'
    };
  }

  const manualProduct = {
    category: normalizedOwnedCategory,
    model_id: null,
    sku_id: null,
    sku_code: null,
    brand: devView.manual_brand,
    brand_lower: mBrand,
    model_name: devView.manual_model_name,
    model_number: devView.manual_model_number || null,
    released_on: null,
    storage_gb: mStorage,
    ram_gb: mRam,
    color: null,
    connectivity: mSpecs.connectivity || null,
    weight_g: mSpecs.weight_g != null ? Number(mSpecs.weight_g) : null,
    screen_inches: mSpecs.screen_inches != null ? Number(mSpecs.screen_inches) : null,
    refresh_hz: mSpecs.refresh_hz != null ? Number(mSpecs.refresh_hz) : null,
    battery_mah: mSpecs.battery_mah != null ? Number(mSpecs.battery_mah) : null,
    battery_wh: mSpecs.battery_wh != null ? Number(mSpecs.battery_wh) : null,
    battery_hours: mSpecs.battery_hours != null ? Number(mSpecs.battery_hours) : null,
    case_battery_hours: mSpecs.case_battery_hours != null ? Number(mSpecs.case_battery_hours) : null,
    case_size_mm: mSpecs.case_size_mm != null ? Number(mSpecs.case_size_mm) : null,
    power_w: mSpecs.power_w != null ? Number(mSpecs.power_w) : null,
    specifications: {
      cpu: mSpecs.processor_model || null,
      chipset: mSpecs.processor_model || null,
      gpu: mSpecs.gpu_model || (mSpecs.discrete_gpu === true ? 'NVIDIA GeForce RTX' : null),
      os: mSpecs.os_name || null,
      pen_supported: mSpecs.pen_supported ?? null,
      keyboard_supported: mSpecs.keyboard_supported ?? null,
      anc: mSpecs.anc ?? null,
      transparency_mode: mSpecs.transparency_mode ?? null,
      multipoint: mSpecs.multipoint ?? null,
      codecs: mSpecs.codecs ? [mSpecs.codecs] : null,
      water_resistance: mSpecs.water_resistance || null,
      gps: mSpecs.gps ?? null,
      compatible_os: mSpecs.compatible_os ? [mSpecs.compatible_os] : null,
      multipairing: mSpecs.multipairing || null,
      power_w: mSpecs.power_w != null ? Number(mSpecs.power_w) : null
    },
    options: {
      case_size_mm: mSpecs.case_size_mm != null ? Number(mSpecs.case_size_mm) : null
    },
    verified: false,
    manual_specs_provided: true,
    current_reference_price: null
  };

  return {
    category_mismatch: false,
    owned_category: normalizedOwnedCategory,
    expected_category: expectedCategory,
    owned_device: devView,
    product: manualProduct,
    identification_status: 'manual_structured_specs'
  };
}

function isSameModelOrSku(ownedProduct, candidate) {
  if (!ownedProduct || !candidate) return false;
  if (ownedProduct.sku_id && candidate.sku_id && String(ownedProduct.sku_id) === String(candidate.sku_id)) {
    return true;
  }
  if (ownedProduct.model_id && candidate.model_id && String(ownedProduct.model_id) === String(candidate.model_id)) {
    return true;
  }
  if (
    ownedProduct.model_number &&
    candidate.model_number &&
    String(ownedProduct.model_number).trim().toLowerCase() === String(candidate.model_number).trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

function compareCatalogOwnedAndCandidate(category, ownedProd, candidate, ownedDeviceView = null) {
  const fields = {};
  const improvements = [];
  const improvedNeeds = new Set();
  const comparedNeeds = new Set();
  const tradeoffs = [];
  const cautions = [];
  const insufficientFields = [];

  if (!ownedProd) {
    return {
      comparable: false,
      fields: {},
      improvements: [],
      improved_needs: [],
      tradeoffs: [],
      cautions: ['보유 기기의 사양 정보가 확인되지 않아 정량 사양 비교를 수행할 수 없습니다.'],
      insufficient_data_fields: ['all'],
      cost_analysis: null
    };
  }

  if (!ownedProd.verified) {
    cautions.push('보유 기기가 카탈로그 미등록 수동 입력 기기이므로 사용자가 직접 입력한 사양 항목만 제한적으로 비교했습니다.');
  }

  const curSpecs = ownedProd.specifications || {};
  const nextSpecs = candidate.specifications || {};
  const curOpts = ownedProd.options || {};
  const nextOpts = candidate.options || {};

  function compareNumeric(key, label, curVal, nextVal, unit, higherIsBetter, needCode = null) {
    const c = curVal !== null && curVal !== undefined && Number.isFinite(Number(curVal)) ? Number(curVal) : null;
    const n = nextVal !== null && nextVal !== undefined && Number.isFinite(Number(nextVal)) ? Number(nextVal) : null;
    if (c === null || n === null) {
      fields[key] = { status: 'insufficient_data', current: c, candidate: n, unit };
      insufficientFields.push(key);
      return;
    }
    const diff = Number((n - c).toFixed(2));
    let direction = 'same';
    if (diff > 0) direction = higherIsBetter === null ? 'larger' : (higherIsBetter ? 'improved' : 'tradeoff');
    else if (diff < 0) direction = higherIsBetter === null ? 'smaller' : (higherIsBetter ? 'tradeoff' : 'improved');

    if (needCode) comparedNeeds.add(needCode);
    fields[key] = { status: 'verified_comparison', current: c, candidate: n, diff, unit, direction };
    if (direction === 'improved') {
      if (needCode) improvedNeeds.add(needCode);
      if (higherIsBetter) {
        improvements.push(`${label}: ${c}${unit} → ${n}${unit} (+${diff}${unit} 향상)`);
      } else {
        improvements.push(`${label}: ${c}${unit} → ${n}${unit} (${Math.abs(diff)}${unit} 경량화)`);
      }
    } else if (direction === 'tradeoff') {
      if (higherIsBetter) {
        tradeoffs.push(`${label}: ${c}${unit} → ${n}${unit} (${Math.abs(diff)}${unit} 감소)`);
      } else {
        tradeoffs.push(`${label}: ${c}${unit} → ${n}${unit} (+${diff}${unit} 무거워짐)`);
      }
    }
  }

  function compareRuntime(key, label) {
    const currentCondition = curSpecs.battery_condition;
    const nextCondition = nextSpecs.battery_condition;
    const sameCondition = key === 'battery_hours' && typeof currentCondition === 'string' &&
      typeof nextCondition === 'string' && currentCondition.trim() !== '' &&
      currentCondition.trim() === nextCondition.trim();
    compareNumeric(key, label, ownedProd[key], candidate[key], '시간',
      sameCondition ? true : null, sameCondition ? 'battery' : null);
    if (!sameCondition && fields[key]?.status === 'verified_comparison') {
      cautions.push(`${label}: 동일한 시험 조건이 확인되지 않아 실제 사용 시간 개선으로 판단하지 않았습니다.`);
    }
  }

  // Common weight comparison
  compareNumeric('weight_g', '무게', ownedProd.weight_g, candidate.weight_g, 'g', false, 'portability');

  if (category === 'tablet') {
    compareNumeric('storage_gb', '저장 용량', ownedProd.storage_gb, candidate.storage_gb, 'GB', true, 'storage');
    compareNumeric('ram_gb', 'RAM 용량', ownedProd.ram_gb, candidate.ram_gb, 'GB', true, 'ram');
    compareNumeric('screen_inches', '화면 크기', ownedProd.screen_inches, candidate.screen_inches, '인치', null, null);
    compareNumeric('refresh_hz', '화면 주사율', ownedProd.refresh_hz, candidate.refresh_hz, 'Hz', true, 'display');

    // Battery: compare Wh with Wh, or mAh with mAh (never mix!)
    if (ownedProd.battery_wh != null || candidate.battery_wh != null) {
      compareNumeric('battery_wh', '배터리 정격 용량(Wh)', ownedProd.battery_wh, candidate.battery_wh, 'Wh', null);
      if (fields.battery_wh?.direction === 'larger') {
        cautions.push('배터리 정격 용량(Wh)과 실제 화면 켜짐 시간은 디스플레이·칩셋 전성비에 따라 다를 수 있습니다.');
      }
    }
    if (ownedProd.battery_mah != null || candidate.battery_mah != null) {
      compareNumeric('battery_mah', '배터리 정격 용량(mAh)', ownedProd.battery_mah, candidate.battery_mah, 'mAh', null);
      if (fields.battery_mah?.direction === 'larger') {
        cautions.push('배터리 용량(mAh) 증가가 실제 사용 시간 비례 증가를 보장하지는 않습니다.');
      }
    }

    // Pen support
    const curPen = curSpecs.pen_supported === true || (Array.isArray(curSpecs.ports) && curSpecs.ports.some(p => /S펜|펜/i.test(p)))
      ? true
      : (curSpecs.pen_supported === false ? false : null);
    const nextPen = nextSpecs.pen_supported === true || (Array.isArray(nextSpecs.ports) && nextSpecs.ports.some(p => /S펜|펜/i.test(p)))
      ? true
      : (nextSpecs.pen_supported === false ? false : null);
    fields.pen_supported = { status: nextPen === true ? 'verified_comparison' : 'insufficient_data', current: curPen, candidate: nextPen };
    if (curPen !== true && nextPen === true) {
      improvements.push('스타일러스 펜(Apple Pencil / S펜) 필기·드로잉 공식 지원이 확인되었습니다.');
      improvedNeeds.add('pen');
    }

    // Keyboard support
    const curKb = curSpecs.keyboard_supported === true ? true : (curSpecs.keyboard_supported === false ? false : null);
    const nextKb = nextSpecs.keyboard_supported === true ? true : (nextSpecs.keyboard_supported === false ? false : null);
    fields.keyboard_supported = { status: nextKb === true ? 'verified_comparison' : 'insufficient_data', current: curKb, candidate: nextKb };
    if (curKb !== true && nextKb === true) {
      improvements.push('전용 키보드 연결 생산성 기능이 공식 지원됩니다.');
      improvedNeeds.add('keyboard');
    }

    // Cellular connectivity
    if (ownedProd.connectivity === 'wifi' && candidate.connectivity === 'cellular') {
      improvements.push('Wi-Fi 전용에서 셀룰러(5G/LTE) 데이터 통신 지원 모델로 전환됩니다.');
      improvedNeeds.add('cellular');
    }

    fields.chipset = {
      status: 'insufficient_benchmark_data',
      current: curSpecs.chipset || null,
      candidate: nextSpecs.chipset || null,
      note: '칩셋 명칭만 병기하며 출시 연도나 모델명만으로 임의의 성능 향상률을 생성하지 않습니다.'
    };
    insufficientFields.push('chipset_benchmark');
  } else if (category === 'laptop') {
    compareNumeric('ram_gb', '메모리(RAM)', ownedProd.ram_gb, candidate.ram_gb, 'GB', true, 'ram');
    compareNumeric('storage_gb', 'SSD 저장 용량', ownedProd.storage_gb, candidate.storage_gb, 'GB', true, 'storage');
    compareNumeric('refresh_hz', '화면 주사율', ownedProd.refresh_hz, candidate.refresh_hz, 'Hz', true, 'display');
    compareNumeric('battery_wh', '배터리 용량(Wh)', ownedProd.battery_wh, candidate.battery_wh, 'Wh', null);
    if (fields.battery_wh?.direction === 'larger') {
      cautions.push('배터리 용량(Wh)과 실제 사용 시간은 작업 부하 및 전력 설계에 따라 차이가 있습니다.');
    }

    const curGpu = String(curOpts.gpu || curSpecs.gpu || '');
    const nextGpu = String(nextOpts.gpu || nextSpecs.gpu || '');
    const curHasDgpu = /NVIDIA|RTX|GeForce|Radeon\s+RX/i.test(curGpu);
    const nextHasDgpu = /NVIDIA|RTX|GeForce|Radeon\s+RX/i.test(nextGpu);
    fields.gpu = {
      status: curGpu && nextGpu ? 'verified_comparison' : 'insufficient_data',
      current: curGpu || null,
      candidate: nextGpu || null,
      current_discrete: curHasDgpu,
      candidate_discrete: nextHasDgpu
    };
    if (!curHasDgpu && nextHasDgpu) {
      improvements.push(`내장 그래픽에서 외장 GPU(${nextGpu}) 탑재 구성으로 전환되어 그래픽·영상·고부하 작업 지원이 개선됩니다.`);
      improvedNeeds.add('gpu');
      improvedNeeds.add('performance');
    } else if (curHasDgpu && !nextHasDgpu) {
      tradeoffs.push(`외장 GPU(${curGpu})에서 내장 그래픽(${nextGpu || '내장 GPU'}) 구성으로 변경됩니다.`);
    }

    fields.cpu = {
      status: 'insufficient_benchmark_data',
      current: curOpts.cpu || curSpecs.cpu || null,
      candidate: nextOpts.cpu || nextSpecs.cpu || null,
      note: '동일 시험 기준의 CPU 벤치마크 데이터가 없으므로 프로세서 명칭만 비교하며 임의 성능 향상률(%)을 생성하지 않습니다.'
    };
    insufficientFields.push('cpu_benchmark');
  } else if (category === 'smartwatch') {
    const curOsSet = catalogEngine.inferSmartwatchCompatibleOs(ownedProd, curSpecs);
    const nextOsSet = catalogEngine.inferSmartwatchCompatibleOs(candidate, nextSpecs);
    fields.compatible_os = {
      status: curOsSet.size && nextOsSet.size ? 'verified_comparison' : 'insufficient_data',
      current: [...curOsSet],
      candidate: [...nextOsSet]
    };
    if (curOsSet.size && nextOsSet.size && [...nextOsSet].some(os => !curOsSet.has(os))) {
      const targetOsLabel = nextOsSet.has('ios') ? 'iPhone(iOS)' : 'Android(갤럭시)';
      improvements.push(`스마트폰 OS 호환성 전환: ${targetOsLabel} 생태계와 공식 호환됩니다.`);
      improvedNeeds.add('os_ecosystem');
    }

    // Battery: keep battery_hours and battery_mah strictly separate!
    if (ownedProd.battery_hours != null || candidate.battery_hours != null) {
      compareRuntime('battery_hours', '공식 최대 사용 시간');
    }
    if (ownedProd.battery_mah != null || candidate.battery_mah != null) {
      compareNumeric('battery_mah', '배터리 용량(mAh)', ownedProd.battery_mah, candidate.battery_mah, 'mAh', null);
      if (fields.battery_mah?.direction === 'larger') {
        cautions.push('배터리 용량(mAh)과 실제 사용 시간은 서로 다른 지표이며 AOD·센서 설정에 따라 달라집니다.');
      }
    }

    if (ownedProd.connectivity !== 'cellular' && candidate.connectivity === 'cellular') {
      improvements.push('스마트폰 없이 단독 통신이 가능한 셀룰러(LTE) 기능을 지원합니다.');
      improvedNeeds.add('cellular');
    }
    if (curSpecs.gps !== true && nextSpecs.gps === true) {
      improvements.push('단독 GPS 내장으로 야외 러닝·운동 경로 측정이 가능합니다.');
      improvedNeeds.add('gps');
    }

    const curWaterRank = parseWaterResistanceRank(curSpecs.water_resistance);
    const nextWaterRank = parseWaterResistanceRank(nextSpecs.water_resistance);
    fields.water_resistance = {
      status: curSpecs.water_resistance && nextSpecs.water_resistance ? 'verified_comparison' : 'insufficient_data',
      current: curSpecs.water_resistance || null,
      candidate: nextSpecs.water_resistance || null
    };
    if (nextWaterRank > curWaterRank && nextSpecs.water_resistance) {
      improvements.push(`방수·내구성 등급이 ${curSpecs.water_resistance || '미지원/미확인'}에서 ${nextSpecs.water_resistance}로 향상됩니다.`);
      improvedNeeds.add('water_resistance');
    }
  } else if (category === 'earbuds') {
    const curAnc = curSpecs.anc === true ? true : (curSpecs.anc === false ? false : null);
    const nextAnc = nextSpecs.anc === true ? true : (nextSpecs.anc === false ? false : null);
    fields.anc = {
      status: curAnc !== null && nextAnc !== null ? 'verified_comparison' : 'insufficient_data',
      current: curAnc,
      candidate: nextAnc
    };
    if (curAnc === false && nextAnc === true) {
      improvements.push('액티브 노이즈 캔슬링(ANC) 미지원 모델에서 ANC 지원 모델로 업그레이드됩니다.');
      improvedNeeds.add('anc');
    } else if (curAnc === true && nextAnc === false) {
      tradeoffs.push('기존 기기에서 지원하던 액티브 노이즈 캔슬링(ANC)이 제외됩니다.');
    }

    if (curSpecs.multipoint !== true && nextSpecs.multipoint === true) {
      improvements.push('멀티포인트 다중 기기 동시 연결 기능을 지원합니다.');
      improvedNeeds.add('multipoint');
    }

    const curCodecs = Array.isArray(curSpecs.codecs) ? curSpecs.codecs : [];
    const nextCodecs = Array.isArray(nextSpecs.codecs) ? nextSpecs.codecs : [];
    const curHiRes = curCodecs.some(c => /LDAC|aptX\s*Lossless|aptX\s*Adaptive|SSC-UHQ|SSC\s*Hi-Fi/i.test(c));
    const nextHiResCodec = nextCodecs.find(c => /LDAC|aptX\s*Lossless|aptX\s*Adaptive|SSC-UHQ|SSC\s*Hi-Fi/i.test(c));
    fields.codecs = {
      status: curCodecs.length && nextCodecs.length ? 'verified_comparison' : 'insufficient_data',
      current: curCodecs,
      candidate: nextCodecs
    };
    if (!curHiRes && nextHiResCodec) {
      improvements.push(`고음질 오디오 코덱(${nextHiResCodec}) 지원이 추가됩니다.`);
      improvedNeeds.add('codec');
    }

    compareRuntime('battery_hours', '이어버드 단독 재생 시간');
    compareRuntime('case_battery_hours', '케이스 포함 총 재생 시간');

    const curWaterRank = parseWaterResistanceRank(curSpecs.water_resistance);
    const nextWaterRank = parseWaterResistanceRank(nextSpecs.water_resistance);
    if (nextWaterRank > curWaterRank && nextSpecs.water_resistance) {
      improvements.push(`방수 등급이 ${curSpecs.water_resistance || '미지원'}에서 ${nextSpecs.water_resistance}로 개선됩니다.`);
      improvedNeeds.add('water_resistance');
    }
  } else if (category === 'speaker') {
    compareNumeric('power_w', '정격 출력', ownedProd.power_w, candidate.power_w, 'W', true, 'power');
    compareRuntime('battery_hours', '최대 재생 시간');

    const curWaterRank = parseWaterResistanceRank(curSpecs.water_resistance);
    const nextWaterRank = parseWaterResistanceRank(nextSpecs.water_resistance);
    fields.water_resistance = {
      status: curSpecs.water_resistance || nextSpecs.water_resistance ? 'verified_comparison' : 'insufficient_data',
      current: curSpecs.water_resistance || null,
      candidate: nextSpecs.water_resistance || null
    };
    if (nextWaterRank > curWaterRank && nextSpecs.water_resistance) {
      improvements.push(`방수·방진 등급이 ${curSpecs.water_resistance || '미지원'}에서 ${nextSpecs.water_resistance}로 향상되어 야외·캠핑 사용 적합성이 개선됩니다.`);
      improvedNeeds.add('water_resistance');
    }

    if (!curSpecs.multipairing && nextSpecs.multipairing) {
      improvements.push(`멀티페어링(${nextSpecs.multipairing}) 연결 기능을 지원합니다.`);
      improvedNeeds.add('multipairing');
    }
  }

  const candPriceKrw = candidate.price?.amount_krw ?? null;
  const ownedPurchasePriceKrw = ownedDeviceView?.purchase_info?.purchase_price_krw ?? null;
  const ownedCurrentRefPriceKrw = ownedProd.current_reference_price?.amount_krw ?? null;

  const costAnalysis = {
    candidate_reference_price_krw: candPriceKrw,
    candidate_currency: candidate.price?.currency || 'KRW',
    candidate_seller_name: candidate.price?.seller_name || null,
    candidate_product_url: candidate.price?.product_url || null,
    candidate_observed_at: candidate.price?.observed_at || null,
    candidate_price_scope: candidate.price?.scope || null,
    owned_purchase_price_krw: ownedPurchasePriceKrw,
    owned_current_reference_price_krw: ownedCurrentRefPriceKrw,
    resale_value_estimated: false,
    net_cost_krw: candPriceKrw,
    cost_note: '신규 구매 가격은 다나와 수집 당시 참고 가격이며 실제 결제 금액은 판매처·배송비 조건에 따라 달라질 수 있습니다. 보유 기기의 중고 판매가는 임의 추정·차감하지 않습니다.'
  };

  return Object.defineProperty({
    comparable: true,
    fields,
    improvements,
    improved_needs: [...improvedNeeds],
    tradeoffs,
    cautions,
    insufficient_data_fields: insufficientFields,
    cost_analysis: costAnalysis
  }, 'compared_needs', { value: [...comparedNeeds] });
}

function checkOwnedMeetsHardRequirements(category, ownedProd, hard = {}) {
  if (!ownedProd) return false;
  const specs = ownedProd.specifications || {};
  const opts = ownedProd.options || {};

  if (Array.isArray(hard.allowed_brands) && hard.allowed_brands.length > 0) {
    if (!hard.allowed_brands.includes(ownedProd.brand_lower)) return false;
  }
  if (hard.min_storage_gb != null && (ownedProd.storage_gb == null || ownedProd.storage_gb < hard.min_storage_gb)) {
    return false;
  }
  if (hard.min_ram_gb != null && (ownedProd.ram_gb == null || ownedProd.ram_gb < hard.min_ram_gb)) {
    return false;
  }
  if (hard.max_weight_g != null && (ownedProd.weight_g == null || ownedProd.weight_g > hard.max_weight_g)) {
    return false;
  }
  if (hard.min_refresh_hz != null && (ownedProd.refresh_hz == null || ownedProd.refresh_hz < hard.min_refresh_hz)) {
    return false;
  }
  if (hard.require_pen) {
    const hasPen = specs.pen_supported === true || (Array.isArray(specs.ports) && specs.ports.some(p => /S펜|펜/i.test(p)));
    if (!hasPen) return false;
  }
  if (hard.require_keyboard && specs.keyboard_supported !== true) return false;
  if (hard.require_anc && specs.anc !== true) return false;
  if (hard.require_cellular && ownedProd.connectivity !== 'cellular') return false;
  if (hard.require_water_resistance && (typeof specs.water_resistance !== 'string' || !specs.water_resistance.trim())) return false;
  if (hard.require_gps && specs.gps !== true) return false;
  if (hard.require_discrete_gpu) {
    const gpuStr = String(opts.gpu || specs.gpu || '');
    if (!/NVIDIA|RTX|GeForce|Radeon\s+RX/i.test(gpuStr)) return false;
  }
  if (category === 'smartwatch' && hard.compatible_os) {
    const supportedOs = catalogEngine.inferSmartwatchCompatibleOs(ownedProd, specs);
    if (!supportedOs.has(hard.compatible_os)) return false;
  }
  return true;
}

function evaluateCatalogUpgradeDecision({
  category,
  ownedResolution,
  upgradeContext,
  purchaseReason,
  hard = {},
  soft = {},
  rankedCandidates = [],
  excludedCandidates = []
}) {
  if (!ownedResolution) return null;

  // 1. Category mismatch -> CLARIFY
  if (ownedResolution.category_mismatch) {
    return {
      status: 'clarify',
      upgrade_decision: 'CLARIFY',
      questions: [
        `선택하신 보유 기기의 제품군(${ownedResolution.owned_category})과 추천 요청 제품군(${ownedResolution.expected_category})이 서로 다릅니다. 동일한 제품군의 보유 기기를 선택해 주세요.`
      ],
      reasons: [],
      cautions: [],
      eligible_sku_ids: [],
      comparisons_by_sku_id: new Map()
    };
  }

  // 2. Ambiguous or completely unidentified owned device -> CLARIFY
  if (ownedResolution.identification_status === 'ambiguous_model_variant') {
    return {
      status: 'clarify',
      upgrade_decision: 'CLARIFY',
      questions: [
        '등록하신 보유 기기와 동일한 모델명의 세부 변형이 여러 개 존재합니다. 정확한 모델번호를 입력하거나 카탈로그 SKU로 선택해 주세요.'
      ],
      reasons: [],
      cautions: [],
      eligible_sku_ids: [],
      comparisons_by_sku_id: new Map()
    };
  }

  const ownedProd = ownedResolution.product;
  if (!ownedProd) {
    return {
      status: 'clarify',
      upgrade_decision: 'CLARIFY',
      questions: [
        '보유 기기의 정확한 모델 식별 또는 비교 가능한 핵심 사양 정보가 부족해 업그레이드 실익을 판단할 수 없습니다. 카탈로그 모델을 선택하거나 주요 사양을 입력해 주세요.'
      ],
      reasons: [],
      cautions: [],
      eligible_sku_ids: [],
      comparisons_by_sku_id: new Map()
    };
  }

  const uCtx = upgradeContext || {};
  const deviceMeta = ownedResolution.owned_device?.user_context || {};
  const explicitPainPoints = [
    ...(uCtx.pain_points || []),
    ...(deviceMeta.pain_points || [])
  ];
  const satisfiedAspects = [...new Set([...(uCtx.satisfied_aspects || []), ...(deviceMeta.satisfied_aspects || [])])];
  const replacementIntent = uCtx.replacement_intent || deviceMeta.replacement_intent || 'moderate';
  const noPainConfirmed = Boolean(uCtx.no_pain_confirmed);
  const inferredPainPoints = (noPainConfirmed || (replacementIntent === 'low_or_keep_if_okay' && explicitPainPoints.length === 0))
    ? []
    : inferPainPointsFromReason(category, purchaseReason, hard);
  const painPoints = [...new Set([...explicitPainPoints, ...inferredPainPoints])];

  // If user gave no upgrade context, no pain points, no satisfied aspects, and no purchase reason -> CLARIFY
  if (
    painPoints.length === 0 &&
    satisfiedAspects.length === 0 &&
    !noPainConfirmed &&
    (!purchaseReason || !purchaseReason.trim())
  ) {
    return {
      status: 'clarify',
      upgrade_decision: 'CLARIFY',
      questions: [
        '현재 보유 기기 사용 중 불편한 점(배터리, 용량, 무게, 호환성, 주요 기능 등)이나 교체를 고려하시는 이유를 알려 주세요.'
      ],
      reasons: [],
      cautions: [],
      eligible_sku_ids: [],
      comparisons_by_sku_id: new Map()
    };
  }

  // If manual device is missing the specific spec required to verify the user's stated pain point -> CLARIFY
  if (!ownedProd.verified) {
    const missingManualSpecForNeed = painPoints.some(need => {
      if (need === 'ram') return ownedProd.ram_gb == null;
      if (need === 'storage') return ownedProd.storage_gb == null;
      if (need === 'portability') return ownedProd.weight_g == null;
      if (need === 'battery') return ownedProd.battery_hours == null && ownedProd.battery_wh == null && ownedProd.battery_mah == null;
      if (need === 'power') return ownedProd.power_w == null;
      if (need === 'anc') return ownedProd.specifications?.anc == null;
      if (need === 'pen') return ownedProd.specifications?.pen_supported == null;
      if (need === 'water_resistance') return !ownedProd.specifications?.water_resistance;
      return false;
    });
    if (missingManualSpecForNeed) {
      return {
        status: 'clarify',
        upgrade_decision: 'CLARIFY',
        questions: [
          '수동 등록된 보유 기기에 요청하신 불편 항목을 비교할 핵심 사양 정보가 입력되어 있지 않습니다. 보유 기기의 세부 사양을 입력하거나 카탈로그 모델을 연결해 주세요.'
        ],
        reasons: [],
        cautions: [],
        eligible_sku_ids: [],
        comparisons_by_sku_id: new Map()
      };
    }
  }

  const ownedMeetsHard = checkOwnedMeetsHardRequirements(category, ownedProd, hard);

  // 3. Filter out candidates that are the exact same model or SKU as the owned device
  const distinctCandidates = [];
  for (const entry of rankedCandidates) {
    if (isSameModelOrSku(ownedProd, entry.candidate)) {
      excludedCandidates.push({
        sku_id: String(entry.candidate.sku_id),
        model_id: String(entry.candidate.model_id),
        model_name: entry.candidate.model_name,
        reason: 'SAME_MODEL_OR_SKU_AS_OWNED'
      });
      continue;
    }
    distinctCandidates.push(entry);
  }

  // 4. KEEP check when user has no pain points / low replacement intent and current device meets hard specs
  if (ownedMeetsHard && painPoints.length === 0 && (replacementIntent === 'low_or_keep_if_okay' || noPainConfirmed)) {
    const keepReasons = [
      `현재 보유 기기(${ownedProd.brand} ${ownedProd.model_name})가 요청하신 필수 조건 및 호환성 기준을 이미 충족하고 있습니다.`,
      '현재 사용에 특별한 불편 사항이 없으므로 추가 지출 없이 현 기기를 유지(KEEP)하는 것이 비용 대비 합리적입니다.'
    ];
    if (satisfiedAspects.length > 0) {
      const labels = satisfiedAspects.map(a => NEED_LABELS[a] || a).join(', ');
      keepReasons.push(`현재 만족하고 계신 요소(${labels})를 그대로 유지할 수 있습니다.`);
    }
    return {
      status: 'keep',
      upgrade_decision: 'KEEP',
      questions: [],
      reasons: keepReasons,
      cautions: ['배터리 노후화나 물리적 고장이 발생한 경우에는 공식 서비스센터 점검 비용과 신규 구매 비용을 비교해 보세요.'],
      eligible_sku_ids: [],
      comparisons_by_sku_id: new Map()
    };
  }

  // 5. Evaluate comparisons for all distinct priced candidates
  const comparisonsBySkuId = new Map();
  for (const entry of distinctCandidates) {
    const comp = compareCatalogOwnedAndCandidate(category, ownedProd, entry.candidate, ownedResolution.owned_device);
    comparisonsBySkuId.set(String(entry.candidate.sku_id), comp);
  }

  // If no distinct priced candidates exist within budget/hard conditions
  if (distinctCandidates.length === 0) {
    const hasMissingPriceMatch = excludedCandidates.some(e => e.reason === 'MISSING_PRICE');
    const onlySameModel = excludedCandidates.some(e => e.reason === 'SAME_MODEL_OR_SKU_AS_OWNED') && rankedCandidates.length > 0;
    if (onlySameModel && ownedMeetsHard && painPoints.length === 0) {
      return {
        status: 'keep',
        upgrade_decision: 'KEEP',
        questions: [],
        reasons: [
          `현재 보유하신 ${ownedProd.brand} ${ownedProd.model_name} 모델이 이미 해당 제품군의 필수 조건을 모두 충족하고 있으며, 동일 모델로의 중복 교체는 권장하지 않습니다.`
        ],
        cautions: [],
        eligible_sku_ids: [],
        comparisons_by_sku_id: new Map()
      };
    }
    const deferReasons = [];
    if (onlySameModel) {
      deferReasons.push(`현재 카탈로그 내 적격 후보가 보유 기기(${ownedProd.brand} ${ownedProd.model_name})와 동일한 모델뿐이어서 교체 실익이 없습니다.`);
    } else if (hasMissingPriceMatch) {
      deferReasons.push('요구 조건에 부합하는 후보 모델의 다나와 참고 가격이 아직 확보되지 않아 교체 비용 대비 실익을 확정할 수 없습니다.');
    } else {
      deferReasons.push('현재 예산 및 필수 조건 안에서 보유 기기를 대체할 수 있는 적격 후보가 확인되지 않아 교체 보류(DEFER)를 권장합니다.');
    }
    return {
      status: 'defer',
      upgrade_decision: 'DEFER',
      questions: [],
      reasons: deferReasons,
      cautions: ['가격 미확보 제품의 교체 비용을 임의로 추정하거나 예산 초과 제품을 무리하게 추천하지 않습니다.'],
      eligible_sku_ids: [],
      comparisons_by_sku_id: new Map()
    };
  }

  // 6. Determine target needs to verify
  const targetNeeds = painPoints.length > 0
    ? painPoints
    : (Array.isArray(soft.priorities) && soft.priorities.length > 0 ? soft.priorities : []);

  const hasComparison = (comp, need) => comp.improved_needs.includes(need) ||
    comp.compared_needs.includes(need) ||
    comp.fields[{
      anc: 'anc', pen: 'pen_supported', keyboard: 'keyboard_supported',
      codec: 'codecs', gpu: 'gpu', os_ecosystem: 'compatible_os', water_resistance: 'water_resistance'
    }[need]]?.status === 'verified_comparison';
  const verifiableTargetNeeds = targetNeeds.filter(need =>
    [...comparisonsBySkuId.values()].some(comp => hasComparison(comp, need)));
  const unverifiedTargetNeeds = targetNeeds.filter(need => !verifiableTargetNeeds.includes(need));

  // Filter candidates that actually provide a verified improvement for the user's needs
  const improvingEntries = distinctCandidates.filter(entry => {
    const comp = comparisonsBySkuId.get(String(entry.candidate.sku_id));
    if (!comp || comp.improvements.length === 0) return false;
    if (targetNeeds.length === 0) return true;
    return verifiableTargetNeeds.some(need => comp.improved_needs.includes(need));
  });

  // Prefer candidates that satisfy ALL verifiable target needs if any exist
  const fullyImprovingEntries = verifiableTargetNeeds.length > 1
    ? improvingEntries.filter(entry => {
        const comp = comparisonsBySkuId.get(String(entry.candidate.sku_id));
        return verifiableTargetNeeds.every(need => comp.improved_needs.includes(need));
      })
    : improvingEntries;

  const finalEligibleEntries = fullyImprovingEntries.length > 0 ? fullyImprovingEntries : improvingEntries;

  if (finalEligibleEntries.length === 0) {
    if (targetNeeds.length && ![...comparisonsBySkuId.values()].some(comp =>
      targetNeeds.every(need => hasComparison(comp, need)))) {
      const labels = (unverifiedTargetNeeds.length ? unverifiedTargetNeeds : targetNeeds)
        .map(need => NEED_LABELS[need] || need).join('·');
      return {
        status: 'clarify',
        upgrade_decision: 'CLARIFY',
        questions: [
          `현재 자료로는 요청하신 항목(${labels})을 같은 기준으로 비교하기 어렵습니다.`,
          targetNeeds.includes('battery')
            ? '배터리 사용 시간이 어떤 상황에서 부족한가요? 배터리 외에 함께 개선하고 싶은 기능이 있나요?'
            : '현재 기기에서 어떤 기능이 부족한가요? 교체 후 꼭 개선되어야 하는 사양이나 기능을 구체적으로 알려 주세요.'
        ],
        reasons: [],
        cautions: [],
        eligible_sku_ids: [],
        comparisons_by_sku_id: comparisonsBySkuId
      };
    }
    // If current device already meets all hard requirements and no candidate improves on it -> KEEP (if low/moderate intent) or DEFER
    if (ownedMeetsHard && (painPoints.length === 0 || replacementIntent === 'low_or_keep_if_okay')) {
      return {
        status: 'keep',
        upgrade_decision: 'KEEP',
        questions: [],
        reasons: [
          `현재 보유 기기(${ownedProd.brand} ${ownedProd.model_name})가 이미 주요 사양 기준을 충족하고 있으며, 예산 내 후보들이 기존 기기 대비 검증된 사양 개선을 제공하지 않아 현 기기 유지(KEEP)를 권장합니다.`
        ],
        cautions: [],
        eligible_sku_ids: [],
        comparisons_by_sku_id: comparisonsBySkuId
      };
    }

    const needText = targetNeeds.map(n => NEED_LABELS[n] || n).join('·');
    return {
      status: 'defer',
      upgrade_decision: 'DEFER',
      questions: [],
      reasons: [
        `요청하신 개선 항목(${needText || '성능·사양'})에 대해 현재 예산 내 후보들이 보유 기기(${ownedProd.brand} ${ownedProd.model_name}) 대비 검증 가능한 사양 향상을 제공하지 못해 교체 보류(DEFER)를 권장합니다.`
      ],
      cautions: [
        '신제품이라는 이유만으로 교체를 권장하거나, 확인되지 않은 CPU/GPU 벤치마크 향상률을 임의로 추정하지 않습니다.'
      ],
      eligible_sku_ids: [],
      comparisons_by_sku_id: comparisonsBySkuId
    };
  }

  const topComp = comparisonsBySkuId.get(String(finalEligibleEntries[0].candidate.sku_id));
  const improvedLabels = (topComp?.improved_needs || []).map(n => NEED_LABELS[n] || n).join('·');
  const decisionReasons = [
    `현재 보유 기기(${ownedProd.brand} ${ownedProd.model_name}) 대비 ${improvedLabels || '핵심 사양'} 항목에서 객관적으로 검증된 개선이 확인되어 교체(REPLACE)를 권장합니다.`
  ];
  const unverifiedCautions = [];
  if (unverifiedTargetNeeds.length > 0) {
    const uLabels = unverifiedTargetNeeds.map(n => NEED_LABELS[n] || n).join('·');
    unverifiedCautions.push(`요청하신 항목 중 ${uLabels} 관련 정량 실측 비교 자료는 포함되지 않아 확인된 사양 개선을 기준으로 평가했습니다.`);
  }

  return {
    status: 'recommend',
    upgrade_decision: 'REPLACE',
    questions: [],
    reasons: decisionReasons,
    cautions: unverifiedCautions,
    eligible_sku_ids: finalEligibleEntries.map(e => String(e.candidate.sku_id)),
    comparisons_by_sku_id: comparisonsBySkuId
  };
}

module.exports = {
  UPGRADE_DECISION_MAP,
  NEED_LABELS,
  validateCatalogUpgradeContextInput,
  inferPainPointsFromReason,
  resolveAndIdentifyOwnedDevice,
  isSameModelOrSku,
  compareCatalogOwnedAndCandidate,
  checkOwnedMeetsHardRequirements,
  evaluateCatalogUpgradeDecision
};
