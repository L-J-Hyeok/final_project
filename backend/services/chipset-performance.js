'use strict';

// Include only names with known equivalent CPU and GPU configurations.
const aliases = new Map([
  ['apple a16 bionic (6코어 cpu, 5코어 gpu)', 'apple a16 bionic'],
  ['apple a16 bionic (6코어 cpu, 5코어 gpu, 16코어 neural engine)', 'apple a16 bionic'],
  ['samsung exynos 2400 (데카코어)', 'exynos 2400'],
  ['samsung exynos 2400', 'exynos 2400'],
  ['samsung exynos 2400e (데카코어)', 'exynos 2400e'],
  ['samsung exynos 2400e (10코어)', 'exynos 2400e'],
  ['samsung exynos 2400e', 'exynos 2400e'],
  ['apple a17 pro (6코어 cpu, 6코어 gpu, 16코어 neural engine)', 'apple a17 pro (6-core gpu)'],
  ['apple a18 (6코어 cpu, 5코어 gpu, 16코어 neural engine)', 'apple a18 (5-core gpu)']
]);

const ambiguousAppleChips = new Map([
  ['apple a17 pro', new Map([['A3102', '6-core gpu'], ['A3106', '6-core gpu']])],
  ['apple a18', new Map([['A3287', '5-core gpu'], ['A3290', '5-core gpu'], ['A3409', '4-core gpu']])],
  ['apple a19', new Map([['A3520', '5-core gpu'], ['A3634', '4-core gpu']])],
  ['apple a19 pro', new Map([['A3517', '5-core gpu']])],
  ['apple a20 pro', new Map([
    ['A3714', '6-core cpu, 7-core gpu'], ['A3717', '6-core cpu, 7-core gpu'], ['A3720', '6-core cpu, 7-core gpu']
  ])]
]);

function chipsetKey(label, { model_name: modelName, domestic_model_number: modelNumber } = {}) {
  if (typeof label !== 'string') return null;
  const name = label.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!name) return null;
  // Samsung Korea identifies the SM-S731N retail model as Exynos 2400.
  if (modelNumber === 'SM-S731N' && modelName === 'Galaxy S25 FE' &&
      aliases.get(name) === 'exynos 2400e') return 'exynos 2400';

  const variants = ambiguousAppleChips.get(name);
  if (variants) {
    const configuration = variants.get(modelNumber);
    return configuration ? name + ' (' + configuration + ')' : null;
  }
  return aliases.get(name) ?? name;
}

function performanceDimensions(conditions, profile) {
  const common = profile?.common;
  const usages = conditions?.hard?.usages?.length ? conditions.hard.usages : common?.usages || [];
  const priorities = conditions?.soft?.priorities || [];
  const painPoints = conditions?.upgrade_context?.pain_points || [];
  const base = ['cpu_single', 'cpu_multi', 'gpu'];
  if (usages.includes('gaming') || priorities.includes('performance') || painPoints.includes('performance')) {
    return [...base, 'gaming_fps', 'sustained'];
  }
  if (usages.includes('work') || usages.includes('coding') || common?.spending_style === 'value') return base;
  return [];
}

module.exports = { chipsetKey, performanceDimensions };
