/* eslint-disable no-console */
/**
 * Ultra Advisor — TII CAPTCHA solver
 * Sprint 15 / W1 / Task B2
 *
 * 來源: TII Query.aspx 的 4 字元 BMP CAPTCHA (數字+大寫英文混合)
 * 策略: Gemini 2.5 Flash Vision (thinkingBudget:0, temp:0) 跑 3 次
 *       3 次都 fail → Slack webhook 推 (含 base64 圖) → admin 用
 *       /tii-captcha <jobId> <code> 回傳 → 寫 tii_captcha_queue/<jobId>
 *       crawler poll 30s 一次, 最多等 5 分鐘
 *
 * API:
 *   solveCaptcha(imageBuffer, opts?)             → '<4 chars>' or throw
 *   solveCaptchaWithFallback(imageBuffer, opts?) → '<4 chars>' or throw
 *
 * 鐵則:
 *   - 不引入新 npm 依賴 (Node 18+ 內建 fetch + firebase-admin 已在 root)
 *   - 不在 module top-level 取現在時間, 全部在 callback 內
 *   - sanity check regex /^[A-Z0-9]{4}$/i 必跑
 *   - Slack webhook URL: env SLACK_WEBHOOK_TII
 *   - Gemini API key:   env GEMINI_API_KEY
 *   - 顧問端不暴露此 module — 只 crawler / admin queue 用
 */

'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const CAPTCHA_PROMPT =
  'Read the 4 characters in this CAPTCHA image. ' +
  'Respond with ONLY the 4 characters, no explanation, no spaces.';

const CAPTCHA_REGEX = /^[A-Z0-9]{4}$/i;

const DEFAULT_GEMINI_ATTEMPTS = 3;
const DEFAULT_POLL_INTERVAL_MS = 30 * 1000;       // 30s
const DEFAULT_FALLBACK_TIMEOUT_MS = 5 * 60 * 1000; // 5 min
const FIRESTORE_QUEUE_COLLECTION = 'tii_captcha_queue';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowIso() {
  // callback-time only — never call at module load
  return new Date().toISOString();
}

function nowMs() {
  return Date.now();
}

function toBase64(imageBuffer) {
  if (!imageBuffer) throw new Error('captcha: empty imageBuffer');
  if (Buffer.isBuffer(imageBuffer)) return imageBuffer.toString('base64');
  if (typeof imageBuffer === 'string') return imageBuffer; // assume already base64
  if (imageBuffer instanceof Uint8Array) return Buffer.from(imageBuffer).toString('base64');
  throw new Error('captcha: imageBuffer must be Buffer | Uint8Array | base64 string');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeAnswer(raw) {
  if (typeof raw !== 'string') return null;
  // Strip whitespace + common noise (`, ', ", -, .)
  const cleaned = raw.replace(/[\s`'"\-.]/g, '').toUpperCase();
  return cleaned;
}

// ---------------------------------------------------------------------------
// Gemini Vision
// ---------------------------------------------------------------------------

async function solveCaptcha(imageBuffer, opts = {}) {
  const apiKey = opts.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('captcha: GEMINI_API_KEY not set');

  const mimeType = opts.mimeType || 'image/bmp';
  const base64 = toBase64(imageBuffer);

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: CAPTCHA_PROMPT },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      thinkingConfig: { thinkingBudget: 0 },
      // 4 chars + safety margin
      maxOutputTokens: 32,
    },
  };

  const url = `${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`captcha: Gemini HTTP ${res.status} — ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const raw =
    json &&
    json.candidates &&
    json.candidates[0] &&
    json.candidates[0].content &&
    json.candidates[0].content.parts &&
    json.candidates[0].content.parts[0] &&
    json.candidates[0].content.parts[0].text;

  const answer = sanitizeAnswer(raw);
  if (!answer || !CAPTCHA_REGEX.test(answer)) {
    throw new Error(
      `captcha: Gemini returned invalid answer (raw=${JSON.stringify(raw)} cleaned=${answer})`
    );
  }
  return answer.toUpperCase();
}

// ---------------------------------------------------------------------------
// Slack fallback
// ---------------------------------------------------------------------------

async function pushSlackFallback({ jobId, imageBuffer, mimeType, webhookUrl, attempts, lastError }) {
  if (!webhookUrl) {
    console.warn('[captcha] SLACK_WEBHOOK_TII not set — fallback notification skipped');
    return;
  }

  const base64 = toBase64(imageBuffer);
  const payload = {
    text:
      `:rotating_light: *TII CAPTCHA fallback*\n` +
      `jobId: \`${jobId}\`\n` +
      `Gemini failed ${attempts}x: ${lastError || 'unknown'}\n` +
      `Reply with: \`/tii-captcha ${jobId} <4chars>\`\n` +
      `mime: ${mimeType} · ts: ${nowIso()}\n` +
      `image (base64): \`\`\`${base64.slice(0, 4000)}\`\`\``,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[captcha] Slack webhook HTTP ${res.status} — ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn(`[captcha] Slack webhook error: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Firestore queue poller
// ---------------------------------------------------------------------------

function getFirestore(opts) {
  if (opts && opts.firestore) return opts.firestore;
  // eslint-disable-next-line global-require
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({
      storageBucket:
        process.env.FIREBASE_STORAGE_BUCKET || 'ultra-advisor.appspot.com',
    });
  }
  return admin.firestore();
}

async function seedQueueDoc({ db, jobId, attempts, lastError }) {
  await db.collection(FIRESTORE_QUEUE_COLLECTION).doc(jobId).set(
    {
      status: 'pending',
      createdAt: nowIso(),
      geminiAttempts: attempts,
      lastError: lastError || null,
      answer: null,
      answeredAt: null,
      answeredBy: null,
    },
    { merge: true }
  );
}

async function pollQueueDoc({ db, jobId, intervalMs, timeoutMs }) {
  const start = nowMs();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await db.collection(FIRESTORE_QUEUE_COLLECTION).doc(jobId).get();
    if (snap.exists) {
      const data = snap.data() || {};
      const answer = sanitizeAnswer(data.answer);
      if (answer && CAPTCHA_REGEX.test(answer)) {
        await snap.ref.set(
          { status: 'consumed', consumedAt: nowIso() },
          { merge: true }
        );
        return answer.toUpperCase();
      }
    }
    if (nowMs() - start > timeoutMs) {
      throw new Error(
        `captcha: fallback timed out after ${Math.round(timeoutMs / 1000)}s waiting on tii_captcha_queue/${jobId}`
      );
    }
    await sleep(intervalMs);
  }
}

// ---------------------------------------------------------------------------
// Public: retry chain + fallback
// ---------------------------------------------------------------------------

async function solveCaptchaWithFallback(imageBuffer, opts = {}) {
  const {
    apiKey = process.env.GEMINI_API_KEY,
    mimeType = 'image/bmp',
    slackWebhook = process.env.SLACK_WEBHOOK_TII,
    geminiAttempts = DEFAULT_GEMINI_ATTEMPTS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    fallbackTimeoutMs = DEFAULT_FALLBACK_TIMEOUT_MS,
    jobId = `tii-captcha-${nowMs()}-${Math.random().toString(36).slice(2, 8)}`,
    onMetric, // optional ({event,jobId,attempts,error}) => void
    firestore, // optional injected Firestore (test)
  } = opts;

  let lastError = null;
  for (let attempt = 1; attempt <= geminiAttempts; attempt += 1) {
    try {
      const answer = await solveCaptcha(imageBuffer, { apiKey, mimeType });
      if (typeof onMetric === 'function') {
        onMetric({ event: 'gemini_hit', jobId, attempts: attempt });
      }
      return answer;
    } catch (err) {
      lastError = err && err.message ? err.message : String(err);
      console.warn(`[captcha] Gemini attempt ${attempt}/${geminiAttempts} failed: ${lastError}`);
    }
  }

  // All Gemini attempts failed → Slack fallback + Firestore queue
  if (typeof onMetric === 'function') {
    onMetric({
      event: 'captcha_fail',
      jobId,
      attempts: geminiAttempts,
      error: lastError,
    });
  }

  await pushSlackFallback({
    jobId,
    imageBuffer,
    mimeType,
    webhookUrl: slackWebhook,
    attempts: geminiAttempts,
    lastError,
  });

  const db = getFirestore({ firestore });
  await seedQueueDoc({ db, jobId, attempts: geminiAttempts, lastError });

  try {
    const answer = await pollQueueDoc({
      db,
      jobId,
      intervalMs: pollIntervalMs,
      timeoutMs: fallbackTimeoutMs,
    });
    if (typeof onMetric === 'function') {
      onMetric({ event: 'slack_hit', jobId, attempts: geminiAttempts });
    }
    return answer;
  } catch (err) {
    if (typeof onMetric === 'function') {
      onMetric({
        event: 'fallback_timeout',
        jobId,
        attempts: geminiAttempts,
        error: err.message,
      });
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  solveCaptcha,
  solveCaptchaWithFallback,
  // Exposed for tests only — not part of stable API
  _internal: {
    CAPTCHA_REGEX,
    FIRESTORE_QUEUE_COLLECTION,
    sanitizeAnswer,
  },
};
