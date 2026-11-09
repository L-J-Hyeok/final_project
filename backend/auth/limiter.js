'use strict';
module.exports = function createLimiter() {
  var entries = new Map();
  return {
    take: function (key, limit, duration) {
      var now = Date.now();
      for (var [k, v] of entries) if (v.until <= now) entries.delete(k);
      var item = entries.get(key);
      if (!item) {
        if (entries.size >= 10000) return null;
        item = { count: 0, until: now + duration }; entries.set(key, item);
      }
      if (item.count >= limit) return null;
      item.count++;
      return function release() { item.count = Math.max(0, item.count - 1); };
    }
  };
};
