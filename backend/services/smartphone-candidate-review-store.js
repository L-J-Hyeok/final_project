'use strict';

const fs = require('fs');
const path = require('path');
const discovery = require('./smartphone-candidate-discovery');
const verifier = require('./smartphone-candidate-verifier');

const DEFAULT_REPORT_PATH = path.resolve(__dirname, '../data/smartphone-verification-report-2026-11-12.json');
const DEFAULT_STATE_PATH = path.resolve(__dirname, '../data/candidate-review-state.json');

const ACTION_TO_ADMIN_STATUS = Object.freeze({
  approve: verifier.ADMIN_STATUSES.APPROVED,
  hold: verifier.ADMIN_STATUSES.HELD,
  reject: verifier.ADMIN_STATUSES.REJECTED,
});

function createDefaultState() {
  return {
    schema_version: 1,
    storage_kind: 'isolated_json_review_state',
    mysql_catalog_write_enabled: false,
    updated_at: null,
    reviews: {},
  };
}

function readJsonFileOrDefault(filePath, fallback) {
  if (!filePath || !fs.existsSync(filePath)) return fallback();
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw ? JSON.parse(raw) : fallback();
}

function writeJsonAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, filePath);
}

function normalizeReason(reason) {
  if (typeof reason !== 'string') return '';
  return reason.replace(/\s+/g, ' ').trim();
}

function createCandidateReviewStore(options = {}) {
  const reportPath = options.reportPath || DEFAULT_REPORT_PATH;
  const statePath = options.statePath || DEFAULT_STATE_PATH;
  const loadReport = options.loadReport || (() => readJsonFileOrDefault(reportPath, () => ({ candidates: [] })));
  const loadState = options.loadState || (() => readJsonFileOrDefault(statePath, createDefaultState));
  const saveState = options.saveState || ((nextState) => writeJsonAtomic(statePath, nextState));

  function mergeCandidateWithReviewState(candidate, reviewOverlay, liveIndex) {
    const overlay = reviewOverlay || null;
    const duplicateCheck = liveIndex
      ? verifier.buildDuplicateCheckResult(candidate, liveIndex)
      : candidate.duplicate_check;
    const history = Array.isArray(overlay?.history)
      ? overlay.history
      : Array.isArray(candidate.admin_review?.history)
        ? candidate.admin_review.history
        : [];
    const adminStatus = overlay?.admin_status || candidate.admin_review?.admin_status || verifier.ADMIN_STATUSES.PENDING;
    const registration = overlay?.registration || candidate.registration || null;

    return {
      ...candidate,
      duplicate_check: duplicateCheck,
      approval_eligible:
        candidate.verification_status === verifier.VERIFICATION_STATUSES.VERIFIED &&
        !duplicateCheck?.is_duplicate,
      admin_review: {
        admin_status: adminStatus,
        latest_reason: overlay?.latest_reason || null,
        reviewed_by: overlay?.reviewed_by || null,
        reviewed_at: overlay?.reviewed_at || null,
        history,
      },
      registration,
    };
  }

  function buildCountsSummary(items) {
    const verificationCounts = { VERIFIED: 0, REVIEW_REQUIRED: 0, REJECTED: 0 };
    const adminCounts = { pending: 0, approved: 0, held: 0, rejected: 0 };
    const registrationCounts = { not_registered: 0, registered: 0, ready_to_register: 0 };
    const kindCounts = {
      new_model: 0,
      new_variant: 0,
      review_model: 0,
      db_pending_model: 0,
      db_pending_variant: 0,
    };

    for (const item of items) {
      verificationCounts[item.verification_status] = (verificationCounts[item.verification_status] || 0) + 1;
      const aStatus = item.admin_review?.admin_status || 'pending';
      adminCounts[aStatus] = (adminCounts[aStatus] || 0) + 1;
      if (kindCounts[item.candidate_kind] !== undefined) {
        kindCounts[item.candidate_kind] += 1;
      }
      if (item.registration?.status === 'registered') {
        registrationCounts.registered += 1;
      } else if (aStatus === 'approved' && item.verification_status === 'VERIFIED') {
        registrationCounts.ready_to_register += 1;
      } else {
        registrationCounts.not_registered += 1;
      }
    }

    return {
      total: items.length,
      by_verification_status: verificationCounts,
      by_admin_status: adminCounts,
      by_registration_status: registrationCounts,
      by_candidate_kind: kindCounts,
    };
  }

  async function listCandidates(filters = {}, liveIndex = null) {
    const report = loadReport();
    const state = loadState();
    const reviews = state.reviews || {};
    const allMerged = (report.candidates || []).map((c) =>
      mergeCandidateWithReviewState(c, reviews[c.candidate_id], liveIndex)
    );

    const kind = filters.kind || 'all';
    const brand = filters.brand || 'all';
    const verificationStatus = filters.verification_status || 'all';
    const adminStatus = filters.admin_status || 'all';
    const registrationStatus = filters.registration_status || 'all';
    const query = typeof filters.q === 'string' ? filters.q.trim().toLowerCase() : '';

    const filtered = allMerged.filter((item) => {
      if (kind !== 'all') {
        if (kind === 'db_pending') {
          if (item.candidate_kind !== 'db_pending_model' && item.candidate_kind !== 'db_pending_variant') {
            return false;
          }
        } else if (item.candidate_kind !== kind) {
          return false;
        }
      }
      if (brand !== 'all' && item.brand !== brand) return false;
      if (verificationStatus !== 'all' && item.verification_status !== verificationStatus) return false;
      if (adminStatus !== 'all' && (item.admin_review?.admin_status || 'pending') !== adminStatus) return false;
      if (registrationStatus !== 'all') {
        const isReg = item.registration?.status === 'registered';
        const isReady = !isReg && item.admin_review?.admin_status === 'approved' && item.verification_status === 'VERIFIED';
        if (registrationStatus === 'registered' && !isReg) return false;
        if (registrationStatus === 'ready_to_register' && !isReady) return false;
        if (registrationStatus === 'not_registered' && isReg) return false;
      }
      if (query) {
        const haystack = [
          item.model_name,
          item.domestic_model_number,
          item.color,
          item.sku_example,
          item.verification_reason,
          item.candidate_id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
    const offset = Math.max(Number(filters.offset) || 0, 0);
    const items = filtered.slice(offset, offset + limit);

    return {
      checked_at: report.checked_at || discovery.DEFAULT_CHECKED_AT,
      mysql_catalog_write_enabled: false,
      overall_summary: buildCountsSummary(allMerged),
      filtered_total: filtered.length,
      limit,
      offset,
      items,
    };
  }

  async function getCandidateById(candidateId, liveIndex = null) {
    const report = loadReport();
    const state = loadState();
    const found = (report.candidates || []).find((c) => c.candidate_id === candidateId);
    if (!found) return null;
    return mergeCandidateWithReviewState(found, state.reviews?.[candidateId], liveIndex);
  }

  async function reviewCandidate({ candidateId, action, reason, adminUser, liveIndex }) {
    const normalizedAction = typeof action === 'string' ? action.trim().toLowerCase() : '';
    const nextAdminStatus = ACTION_TO_ADMIN_STATUS[normalizedAction];
    if (!nextAdminStatus) {
      throw Object.assign(new Error('INVALID_INPUT'), {
        status: 422,
        code: 'INVALID_INPUT',
        message: 'action은 approve, hold, reject 중 하나여야 합니다.',
      });
    }

    const cleanReason = normalizeReason(reason);
    if (cleanReason.length < 2 || cleanReason.length > 500) {
      throw Object.assign(new Error('INVALID_INPUT'), {
        status: 422,
        code: 'INVALID_INPUT',
        message: '검수 사유를 2자 이상 500자 이하로 입력해 주세요.',
      });
    }

    const report = loadReport();
    const rawCandidate = (report.candidates || []).find((c) => c.candidate_id === candidateId);
    if (!rawCandidate) {
      throw Object.assign(new Error('NOT_FOUND'), {
        status: 404,
        code: 'NOT_FOUND',
        message: '후보 항목을 찾을 수 없습니다.',
      });
    }

    const policyCheck =
      normalizedAction === 'approve'
        ? verifier.verifySingleCandidateForApproval(rawCandidate, liveIndex)
        : {
            allowed: true,
            errorCode: null,
            message: '보류/거절 검수 상태가 기록되었습니다.',
            duplicate_check: verifier.buildDuplicateCheckResult(rawCandidate, liveIndex),
          };

    if (!policyCheck.allowed) {
      throw Object.assign(new Error(policyCheck.errorCode), {
        status: 409,
        code: policyCheck.errorCode,
        message: policyCheck.message,
        duplicate_check: policyCheck.duplicate_check,
      });
    }

    const state = loadState();
    const reviews = state.reviews || {};
    const prevOverlay = reviews[candidateId] || {
      admin_status: verifier.ADMIN_STATUSES.PENDING,
      history: [],
    };
    const nowIso = new Date().toISOString();

    const historyEntry = {
      history_id: `rev_${Date.now()}_${(prevOverlay.history?.length || 0) + 1}`,
      action: normalizedAction,
      from_admin_status: prevOverlay.admin_status || verifier.ADMIN_STATUSES.PENDING,
      to_admin_status: nextAdminStatus,
      reason: cleanReason,
      actor_user_id: String(adminUser.id),
      actor_email: adminUser.email,
      reviewed_at: nowIso,
      duplicate_checked_at: nowIso,
      duplicate_found: Boolean(policyCheck.duplicate_check?.is_duplicate),
      duplicate_detail: policyCheck.duplicate_check?.detail || null,
    };

    const nextOverlay = {
      candidate_id: candidateId,
      admin_status: nextAdminStatus,
      latest_reason: cleanReason,
      reviewed_by: {
        id: String(adminUser.id),
        email: adminUser.email,
      },
      reviewed_at: nowIso,
      history: [...(Array.isArray(prevOverlay.history) ? prevOverlay.history : []), historyEntry],
    };

    const nextState = {
      ...state,
      schema_version: 1,
      storage_kind: state.storage_kind || 'isolated_json_review_state',
      mysql_catalog_write_enabled: false,
      updated_at: nowIso,
      reviews: {
        ...reviews,
        [candidateId]: nextOverlay,
      },
    };

    saveState(nextState);

    return {
      candidate: mergeCandidateWithReviewState(rawCandidate, nextOverlay, liveIndex),
      duplicate_check: policyCheck.duplicate_check,
      history_entry: historyEntry,
      mysql_catalog_write_enabled: false,
    };
  }

  async function recordCandidateRegistration({ candidateId, registration, historyEntry }) {
    const report = loadReport();
    const rawCandidate = (report.candidates || []).find((c) => c.candidate_id === candidateId);
    if (!rawCandidate) {
      throw Object.assign(new Error('NOT_FOUND'), {
        status: 404,
        code: 'NOT_FOUND',
        message: '후보 항목을 찾을 수 없습니다.',
      });
    }

    const state = loadState();
    const reviews = state.reviews || {};
    const prevOverlay = reviews[candidateId] || {
      admin_status: verifier.ADMIN_STATUSES.PENDING,
      history: [],
    };
    const nowIso = new Date().toISOString();

    const nextOverlay = {
      ...prevOverlay,
      candidate_id: candidateId,
      registration: {
        ...registration,
        updated_at: nowIso,
      },
      history: [...(Array.isArray(prevOverlay.history) ? prevOverlay.history : []), historyEntry],
    };

    const nextState = {
      ...state,
      schema_version: 1,
      storage_kind: state.storage_kind || 'isolated_json_review_state',
      mysql_catalog_write_enabled: true,
      updated_at: nowIso,
      reviews: {
        ...reviews,
        [candidateId]: nextOverlay,
      },
    };

    saveState(nextState);

    return {
      candidate: mergeCandidateWithReviewState(rawCandidate, nextOverlay, null),
      registration: nextOverlay.registration,
      history_entry: historyEntry,
    };
  }

  return {
    listCandidates,
    getCandidateById,
    reviewCandidate,
    recordCandidateRegistration,
  };
}

module.exports = {
  DEFAULT_REPORT_PATH,
  DEFAULT_STATE_PATH,
  ACTION_TO_ADMIN_STATUS,
  createDefaultState,
  createCandidateReviewStore,
};
