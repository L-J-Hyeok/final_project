import { request } from './client';

function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value));
    }
  }
  const encoded = qs.toString();
  return encoded ? `?${encoded}` : '';
}

export async function fetchAdminSession() {
  return request('/api/admin/session');
}

export async function fetchAdminCandidates(filters = {}) {
  return request(`/api/admin/candidates${buildQuery(filters)}`);
}

export async function fetchAdminCandidateDetail(candidateId) {
  return request(`/api/admin/candidates/${encodeURIComponent(candidateId)}`);
}

export async function submitCandidateReview(candidateId, { action, reason }) {
  return request(`/api/admin/candidates/${encodeURIComponent(candidateId)}/review`, {
    method: 'POST',
    body: { action, reason },
  });
}

export async function registerAdminCandidate(candidateId, options = {}) {
  return request(`/api/admin/candidates/${encodeURIComponent(candidateId)}/register`, {
    method: 'POST',
    body: options,
  });
}
