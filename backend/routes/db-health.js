'use strict';

var connection = require('../db/connection');

// 자격증명, SQL, 호스트와 드라이버 오류를 HTTP 응답에 노출하지 않는다.
function makeHandler(check) {
  return async function (req, res) {
    res.set('Cache-Control', 'no-store');
    try {
      await check();
      res.status(200).json({ data: { database: 'connected' } });
    } catch (_) {
      res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: '데이터베이스 연결을 사용할 수 없습니다.' } });
    }
  };
}

module.exports = makeHandler(function () { return connection.getDatabase().authenticate(); });
module.exports.makeHandler = makeHandler;
