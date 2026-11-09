'use strict';
var crypto = require('crypto');
var active = 0;
var prefix = 'scrypt$131072$8$1$';
var dummy = prefix + '00'.repeat(16) + '$' + '00'.repeat(64);
function derive(password, salt) {
  if (active >= 2) return Promise.reject(Object.assign(new Error('AUTH_BUSY'), { status: 429, code: 'AUTH_BUSY' }));
  active++;
  return new Promise(function (resolve, reject) {
    crypto.scrypt(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, function (err, key) {
      active--;
      if (err) reject(err); else resolve(key);
    });
  });
}
exports.hash = async function (password) {
  var salt = crypto.randomBytes(16);
  var key = await derive(password, salt);
  return prefix + salt.toString('hex') + '$' + key.toString('hex');
};
exports.verify = async function (password, encoded) {
  var valid = typeof encoded === 'string' && /^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encoded);
  var parts = (valid ? encoded : dummy).split('$');
  var key = await derive(password, Buffer.from(parts[4], 'hex'));
  var equal = crypto.timingSafeEqual(key, Buffer.from(parts[5], 'hex'));
  return valid && equal;
};
