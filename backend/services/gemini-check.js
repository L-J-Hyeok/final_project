'use strict';

require('../config/loadEnv')();
const aiModule = require('./ai-adapter');

// 최소 토큰으로 현재 API 키의 모델 접근 가능 여부만 확인하는 헬스체크 스크립트 (비밀값 출력 0)
async function checkModel(apiKey, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
      generationConfig: { maxOutputTokens: 8, temperature: 0 }
    })
  });
  let body = null;
  try {
    body = await r.json();
  } catch (_) {}
  return {
    model,
    http_status: r.status,
    ok: r.ok,
    usage: body?.usageMetadata || null,
    error_message: r.ok ? null : (body?.error?.message || 'REQUEST_FAILED')
  };
}

async function run() {
  const cfg = aiModule.getAiConfig(process.env);
  if (!cfg.apiKey) {
    console.log(JSON.stringify({
      status: 'AI_KEY_MISSING',
      default_model: aiModule.DEFAULT_GEMINI_MODEL,
      allowed_models: aiModule.ALLOWED_GEMINI_MODELS,
      guide: 'backend/.env 파일에 GEMINI_API_KEY=<발급받은_키> 및 GEMINI_MODEL=gemini-3.5-flash-lite를 설정하세요.'
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const results = [];
  for (const model of aiModule.ALLOWED_GEMINI_MODELS) {
    results.push(await checkModel(cfg.apiKey, model));
  }
  console.log(JSON.stringify({ status: 'CHECKED', results }, null, 2));
}

if (require.main === module) {
  run().catch(() => {
    console.error('GEMINI_CHECK_FAILED');
    process.exitCode = 1;
  });
}

module.exports = { checkModel };
