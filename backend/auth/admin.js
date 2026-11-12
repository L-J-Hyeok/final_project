'use strict';

const connection = require('../db/connection');

function fail(status, code, message) {
  return Object.assign(new Error(message || code), { status, code });
}

function parseAdminEmails(env = process.env) {
  const raw = typeof env?.ADMIN_EMAILS === 'string' ? env.ADMIN_EMAILS : '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isAdminEmail(email, env = process.env) {
  if (typeof email !== 'string' || !email.trim()) return false;
  const allowlist = parseAdminEmails(env);
  if (allowlist.size === 0) return false;
  return allowlist.has(email.trim().toLowerCase());
}

function isIsolatedReviewPersistenceEnabled(env = process.env, options = {}) {
  if (options.persistenceEnabled !== undefined) {
    return Boolean(options.persistenceEnabled);
  }
  if (env.DISABLE_CANDIDATE_REVIEW_PERSISTENCE === 'true') {
    return false;
  }
  if (env.NODE_ENV === 'production') {
    return env.ALLOW_ISOLATED_CANDIDATE_REVIEW === 'true';
  }
  // Development & test persist only to isolated JSON review state (never production MySQL).
  return true;
}

function requireAdmin(options = {}) {
  const getDb = options.getDatabase || (() => connection.getDatabase());
  const getEnv = options.getEnv || (() => process.env);

  return async function adminAuthMiddleware(req, res, next) {
    try {
      if (!req.session || !req.session.user_id) {
        return next(fail(401, 'AUTH_REQUIRED', '로그인이 필요합니다.'));
      }
      const db = getDb();
      const user = await db.models.users.findByPk(req.session.user_id, {
        attributes: ['id', 'email'],
      });
      if (!user) {
        return next(fail(401, 'AUTH_REQUIRED', '세션이 만료되었습니다.'));
      }
      const env = getEnv();
      if (!isAdminEmail(user.email, env)) {
        return next(fail(403, 'ADMIN_REQUIRED', '관리자 권한이 필요합니다.'));
      }
      req.adminUser = {
        id: String(user.id),
        email: user.email,
      };
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = {
  parseAdminEmails,
  isAdminEmail,
  isIsolatedReviewPersistenceEnabled,
  requireAdmin,
};
