'use strict';
module.exports = function (env) {
  var production = env.NODE_ENV === 'production';
  var secret = env.SESSION_SECRET;
  var origin = env.APP_ORIGIN || (!production && 'http://localhost:3000');
  function invalid() { throw Object.assign(new Error('AUTH_CONFIG_INVALID'), { code: 'AUTH_CONFIG_INVALID' }); }
  if (!secret || Buffer.byteLength(secret) < 32) invalid();
  try {
    var url = new URL(origin);
    if (url.origin !== origin || url.username || url.password ||
        (production ? url.protocol !== 'https:' : !['http:', 'https:'].includes(url.protocol)) ||
        (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) invalid();
  } catch (_) { invalid(); }
  return { secret: secret, origin: origin, production: production,
    trustProxy: env.TRUST_PROXY_LOOPBACK === 'true',
    cookie: { httpOnly: true, sameSite: 'lax', secure: production || origin.startsWith('https:'), path: '/' } };
};
