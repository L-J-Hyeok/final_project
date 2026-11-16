'use strict';

const { generated_at: reviewedAt, price_collection: { unmatched_details } } =
  require('../data/common-catalog-teammate-report-8-2-5.json');

function identity(row) {
  return JSON.stringify([row.category, row.brand, row.model_number, row.sku_code,
    row.storage_gb == null ? null : Number(row.storage_gb),
    row.ram_gb == null ? null : Number(row.ram_gb), row.connectivity ?? null]);
}

function classify(reasons) {
  const candidates = reasons.flatMap(reason => {
    const codes = reason.match(/ -> \[([^\]]*)\]$/)?.[1];
    return codes ? [codes.split(',').map(code => code.trim())] : [];
  });
  if (!candidates.length) {
    return reasons.some(reason => reason.startsWith('NO_SEARCH_RESULTS:')) &&
      reasons.every(reason => reason.startsWith('NO_SEARCH_RESULTS:')) ? 'no_new_seller' : 'unknown';
  }

  if (candidates.some(codes => codes.length === 1 && codes[0] === 'ABOVE_LAUNCH_PRICE_RATIO')) return 'price_excluded';
  if (candidates.every(codes => codes.some(code => code.startsWith('USED_OR_REFURB_')))) return 'no_new_seller';
  if (candidates.every(codes => codes.some(code => /^(OVERSEAS|CARRIER|CONDITIONAL|BUNDLE)_/.test(code)))) {
    return 'sale_condition_mismatch';
  }
  if (candidates.some(codes => codes.some(code => /MISMATCH/.test(code)))) return 'option_mismatch';
  return 'unknown';
}

const reviews = new Map(unmatched_details.map(item => [identity(item), classify(item.reasons)]));

function priceAvailability(row, price) {
  if (price) return { price_status: 'available' };
  const reason = reviews.get(identity(row));
  return { price_status: reason || 'unknown', ...(reason && reason !== 'unknown' && { price_status_reviewed_at: reviewedAt }) };
}

module.exports = { priceAvailability, classify };
