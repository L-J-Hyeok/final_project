var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();
require('./config/loadEnv')();
var authConfig = require('./auth/config')(process.env);
if (authConfig.trustProxy) app.set('trust proxy', 'loopback');
app.disable('x-powered-by');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// API query strings may contain credentials; do not log API URLs or bodies.
app.use(logger('dev', { skip: function (req) { return req.originalUrl.split('?')[0].startsWith('/api/'); } }));
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.get('/api/health/db', require('./routes/db-health'));
app.use('/api', require('./auth/middleware')(authConfig));
app.use('/api', require('./routes/member'));
app.use('/api', require('./routes/smartphones'));
app.use('/api', require('./routes/upgrade-offers'));
app.use('/api', require('./routes/recommendations'));
app.use('/api/auth', require('./routes/auth')(authConfig));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    var codes = { INVALID_INPUT: 422, CSRF_INVALID: 403, RATE_LIMITED: 429,
      AUTH_BUSY: 429, REGISTRATION_CONFLICT: 409, INVALID_CREDENTIALS: 401, AUTH_REQUIRED: 401, PROFILE_CHANGED: 409, PROFILE_INCOMPLETE: 409, CANDIDATES_CHANGED: 409, DEVICE_LIMIT: 409,
      NOT_FOUND: 404, VERSION_EXHAUSTED: 409,
      AI_INVALID_RESULT: 502, AI_UNAVAILABLE: 502, AI_TIMEOUT: 504, AI_KEY_MISSING: 503, AI_CONFIG_INVALID: 503, AI_MODEL_NOT_ALLOWED: 503 };
    var status = codes[err.code] || (err.type === 'entity.parse.failed' ? 400 : err.type === 'entity.too.large' ? 413 : err.status === 404 ? 404 : 503);
    var code = codes[err.code] ? err.code : status === 400 ? 'INVALID_JSON' : status === 413 ? 'BODY_TOO_LARGE' : status === 404 ? 'NOT_FOUND' : 'SERVICE_UNAVAILABLE';
    var msg = code === 'AI_KEY_MISSING'
      ? 'AI API 키가 설정되지 않았습니다. backend/.env에 GEMINI_API_KEY를 설정하거나 AI_PROVIDER=mock으로 실행해 주세요.'
      : '요청을 처리할 수 없습니다.';
    res.set('Cache-Control', 'no-store');
    if (status === 429) res.set('Retry-After', '60');
    return res.status(status).json({ error: { code: code, message: msg } });
  }
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
