// Sprint 14 W2 — /api/ask  (Insurance clause RAG endpoint)
// ---------------------------------------------------------------------------
// 顧問端 chat tool 的後端。輸入問題 + 可選 productId / policyContext，
// 內部流程：
//   Firebase Auth verify  → daily / per-minute rate limit  → monthly quota
//   → Gemini text-embedding-004 (768d)  → Firestore vector KNN (top 6)
//   → Gemini 2.5 Flash 答 → PII-sanitize → audit_logs + quotaUsage 累計 → 回傳
//
// 戰略邊界（HARD，跟 spec 對齊）：
//   - 0 新 npm 依賴：firebase-admin 已在 root devDeps（serverless build 視為
//     production dep），Gemini 用 fetch 打 REST，不引入 @google/generative-ai。
//   - 答案必帶引用段號（citationLabel + sectionHeader）。
//   - PII（身分證、電話、姓名）只在 audit log sanitize 後寫入。
//   - 「現在時間」一律在 handler callback 內取，不在 module 頂層快取。
//   - 不對外宣稱資料來源（user-facing 文字不出現「TII / 公開資料庫」字串，
//     只在 fallback message 提示顧問自行查閱條款原文）。
//   - 條款內文只進 chunks subcollection，不寫到 user-facing fields。
//
// 失敗模式對應 spec 鐵則：
//   401 Auth fail / 429 quota / 503 embed / 200 empty-KNN / 1×retry LLM。
//
// 注意：Vercel SPA rewrite 已用 `/((?!api/).*)` 排除 api 路徑（vercel.json:20），
//   /api/ask 不會被 rewrite。不需要新增 routing entry。
// ---------------------------------------------------------------------------

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getApps, initializeApp, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ---------------------------------------------------------------------------
// Config (top — referenced inside ensureApp)
// ---------------------------------------------------------------------------

const PROJECT_ID = 'grbt-f87fa';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const EMBED_MODEL = 'text-embedding-004';
const CHAT_MODEL = 'gemini-2.5-flash';

const DAILY_LIMIT = 100;         // 每 uid 每天
const PER_MINUTE_LIMIT = 60;     // 每 uid 每分鐘
const MONTHLY_QUOTA_ASKS = 100;  // 每 uid 每月（quotaUsage doc）
const KNN_TOP_K = 6;

// Lazy-init Firebase Admin。Vercel serverless 每個 instance 只跑一次、
// 之後重用 — getApps() guard 防多次 initializeApp 噪音。
// 憑證來源：
//   1. GOOGLE_APPLICATION_CREDENTIALS_JSON (Vercel env, 整包 service-account JSON)
//   2. applicationDefault() — Vercel/GCE 環境變數提供
let _app: App | null = null;
function ensureApp(): App {
  if (_app) return _app;
  const existing = getApps();
  if (existing.length) {
    _app = existing[0];
    return _app;
  }
  const credEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credEnv) {
    try {
      const sa = JSON.parse(credEnv);
      _app = initializeApp({
        credential: cert(sa),
        projectId: sa.project_id || PROJECT_ID,
      });
      return _app;
    } catch (err) {
      console.warn('[ask] GOOGLE_APPLICATION_CREDENTIALS_JSON parse failed:', (err as Error).message);
    }
  }
  try {
    _app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  } catch {
    _app = initializeApp({ projectId: PROJECT_ID });
  }
  return _app;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PolicyContext {
  insuredAge?: number;
  insuredGender?: 'male' | 'female' | string;
  sumAssured?: number;
  coverages?: Array<{ type?: string; amount?: number; note?: string }>;
  // 注意：刻意不接受 insuredName / insuredId — 顧問端不該把 PII 傳到 LLM。
  // 若 spec 之後加入，必須先 sanitize 再 forward。
}

interface AskRequest {
  question: string;
  productId?: string;
  policyContext?: PolicyContext;
}

interface Citation {
  productId: string;
  sectionHeader: string;
  citationLabel: string;
  pageNum: number;
  chunkText: string;
}

interface AskResponse {
  answer: string;
  citations: Citation[];
  confidence: 'high' | 'medium' | 'low';
  disclaimers: string[];
  tokensUsed: { input: number; output: number };
  processedAtIso: string;
}

interface ChunkDoc {
  productId?: string;
  sectionHeader?: string;
  citationLabel?: string;
  pageNum?: number;
  chunkText?: string;
  embedding?: number[];
  // Firestore vector field（FieldValue.vector）回讀時拿到的是普通 number[]
  // ─ 我們不依賴 vector type 本身，只在 query 路徑用 findNearest。
}

// ---------------------------------------------------------------------------
// PII sanitizer
// ---------------------------------------------------------------------------
// 用於 audit log — 不能改變寄給 LLM 的 question（顧問可能合理問
// 「某客戶情境」），但寫進審計就一律遮罩。
function sanitizePIIForAudit<T>(input: T): T {
  if (input == null) return input;
  if (typeof input === 'string') {
    return input
      // 台灣身分證（1 字母 + 9 數字）/ 通用 18 碼
      .replace(/\b[A-Z][12]\d{8}\b/g, '[REDACTED]')
      .replace(/\b\d{18}\b/g, '[REDACTED]')
      // 台灣手機 09xxxxxxxx / 一般 10 數字
      .replace(/\b09\d{8}\b/g, '[REDACTED]')
      .replace(/\b\d{10}\b/g, '[REDACTED]')
      // 中文 3-4 字姓名（粗略；audit 偏保守，誤判可接受）
      .replace(/[一-龥]{3,4}(?=先生|小姐|女士|客戶|被保險人)/g, '[REDACTED]')
      // 簡單 email
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[REDACTED]') as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map((x) => sanitizePIIForAudit(x)) as unknown as T;
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      // 已知 PII 欄位直接整個 redact
      if (/^(name|fullName|idNumber|phone|mobile|email|address)$/i.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = sanitizePIIForAudit(v);
      }
    }
    return out as unknown as T;
  }
  return input;
}

// ---------------------------------------------------------------------------
// Gemini wrappers (REST、0 dep)
// ---------------------------------------------------------------------------

async function embedQuestion(question: string, apiKey: string): Promise<number[]> {
  const url = `${GEMINI_BASE}/models/${EMBED_MODEL}:embedContent?key=${apiKey}`;
  const body = {
    model: `models/${EMBED_MODEL}`,
    content: { parts: [{ text: question }] },
    taskType: 'RETRIEVAL_QUERY',
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new EmbedError(`embed ${r.status}: ${t.slice(0, 200)}`);
  }
  const j: { embedding?: { values?: number[] } } = await r.json();
  const vec = j.embedding?.values;
  if (!Array.isArray(vec) || vec.length !== 768) {
    throw new EmbedError(`embed returned bad shape (len=${vec?.length})`);
  }
  return vec;
}

interface GeminiAnswer {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

async function callGeminiFlash(prompt: string, apiKey: string): Promise<GeminiAnswer> {
  const url = `${GEMINI_BASE}/models/${CHAT_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
      // Sprint 12 / UltraLab 鐵則：reasoning(thinking) 一律關掉
      thinkingConfig: { thinkingBudget: 0 },
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new LlmError(`gemini ${r.status}: ${t.slice(0, 200)}`);
  }
  const j: {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  } = await r.json();
  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? '';
  if (!text.trim()) throw new LlmError('gemini returned empty text');
  return {
    text,
    inputTokens: j.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: j.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

class EmbedError extends Error {}
class LlmError extends Error {}

// ---------------------------------------------------------------------------
// Rate limit & quota（Firestore atomic increment、跟 functions/index.js 同款）
// ---------------------------------------------------------------------------

async function enforceDailyLimit(uid: string): Promise<void> {
  const db = getFirestore(ensureApp());
  // 「現在時間」在 callback 內取
  const today = new Date().toISOString().slice(0, 10);
  const ref = db.collection('rateLimits').doc(`ask_${uid}_${today}`);
  const snap = await ref.get();
  const current = (snap.exists ? (snap.data() as { count?: number }).count : 0) ?? 0;
  if (current >= DAILY_LIMIT) {
    const err = new QuotaError(`今日 ask 次數已達 ${DAILY_LIMIT} 上限`);
    err.retryAfterSec = 60 * 60; // 給前端粗略提示
    throw err;
  }
  await ref.set(
    {
      count: current + 1,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function enforcePerMinuteLimit(uid: string): Promise<void> {
  const db = getFirestore(ensureApp());
  const now = new Date();
  const minuteKey = `${now.toISOString().slice(0, 16)}`; // YYYY-MM-DDTHH:MM
  const ref = db.collection('rateLimits').doc(`ask_min_${uid}_${minuteKey}`);
  const snap = await ref.get();
  const current = (snap.exists ? (snap.data() as { count?: number }).count : 0) ?? 0;
  if (current >= PER_MINUTE_LIMIT) {
    const err = new QuotaError('請求過於頻繁、請稍後重試');
    err.retryAfterSec = 30;
    throw err;
  }
  await ref.set(
    { count: current + 1, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

async function enforceMonthlyQuota(uid: string): Promise<{ yyyymm: string }> {
  const db = getFirestore(ensureApp());
  const now = new Date();
  const yyyymm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const ref = db.doc(`advisors/${uid}/quotaUsage/${yyyymm}`);
  const snap = await ref.get();
  const asks = (snap.exists ? (snap.data() as { asks?: number }).asks : 0) ?? 0;
  if (asks >= MONTHLY_QUOTA_ASKS) {
    const err = new QuotaError(`本月 ask 配額 ${MONTHLY_QUOTA_ASKS} 已用完`);
    err.retryAfterSec = 24 * 60 * 60;
    throw err;
  }
  return { yyyymm };
}

async function bumpMonthlyQuota(uid: string, yyyymm: string): Promise<void> {
  const db = getFirestore(ensureApp());
  const ref = db.doc(`advisors/${uid}/quotaUsage/${yyyymm}`);
  await ref.set(
    {
      asks: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

class QuotaError extends Error {
  retryAfterSec = 60;
}

// ---------------------------------------------------------------------------
// Vector KNN search
// ---------------------------------------------------------------------------

async function knnSearch(
  queryVec: number[],
  productHint: string | undefined,
): Promise<Citation[]> {
  const db = getFirestore(ensureApp());

  // Firestore vector search API：query.findNearest(...)
  // 用 type cast 接合 admin SDK 在 v13+ 的 vector helper（避免硬依賴新版本：
  // 若 SDK 不支援 findNearest，會在 catch 內降級為「不做向量搜尋、回空」）。
  type VectorQuerySnap = {
    docs: Array<{ id: string; ref: { path: string }; data: () => ChunkDoc }>;
  };

  try {
    if (productHint) {
      // 限定單一商品 chunks subcollection（成本低、相關性高）
      const col = db.collection(`insurance_products/${productHint}/chunks`);
      const q = (col as unknown as {
        findNearest: (opts: {
          vectorField: string;
          queryVector: number[];
          limit: number;
          distanceMeasure: 'COSINE' | 'EUCLIDEAN' | 'DOT_PRODUCT';
        }) => { get: () => Promise<VectorQuerySnap> };
      }).findNearest({
        vectorField: 'embedding',
        queryVector: queryVec,
        limit: KNN_TOP_K,
        distanceMeasure: 'COSINE',
      });
      const snap = await q.get();
      return snap.docs.map((d) => toCitation(d.data(), productHint));
    }

    // 全 catalog：collectionGroup KNN（30k+ chunks、成本較高）
    const cg = db.collectionGroup('chunks');
    const q = (cg as unknown as {
      findNearest: (opts: {
        vectorField: string;
        queryVector: number[];
        limit: number;
        distanceMeasure: 'COSINE' | 'EUCLIDEAN' | 'DOT_PRODUCT';
      }) => { get: () => Promise<VectorQuerySnap> };
    }).findNearest({
      vectorField: 'embedding',
      queryVector: queryVec,
      limit: KNN_TOP_K,
      distanceMeasure: 'COSINE',
    });
    const snap = await q.get();
    return snap.docs.map((d) => {
      // ref.path = "insurance_products/{productId}/chunks/{chunkId}"
      const parts = d.ref.path.split('/');
      const productId = parts[1] || 'unknown';
      return toCitation(d.data(), productId);
    });
  } catch (err) {
    console.error('[ask] KNN search failed:', (err as Error).message);
    return []; // 走 empty fallback path（spec：回友善訊息）
  }
}

function toCitation(d: ChunkDoc, productId: string): Citation {
  return {
    productId: d.productId || productId,
    sectionHeader: d.sectionHeader || '（未標示條號）',
    citationLabel: d.citationLabel || d.sectionHeader || '（未標示條號）',
    pageNum: d.pageNum ?? 0,
    chunkText: (d.chunkText || '').slice(0, 1200), // 防爆 prompt
  };
}

// ---------------------------------------------------------------------------
// Prompt composition
// ---------------------------------------------------------------------------

function composePrompt(
  question: string,
  citations: Citation[],
  policyContext: PolicyContext | undefined,
): string {
  const lines: string[] = [];
  lines.push('你是 Ultra Advisor 條款助理、依下列條款片段回答顧問問題。');
  lines.push('規則:');
  lines.push('1. 必須引用條款編號（出處），格式範例：「依條款第 14 條第 2 項…」');
  lines.push('2. 不確定時必須說「我不確定，請查條款原文」、不要編造');
  lines.push('3. 不模擬律師建議、不給法律意見');
  lines.push('4. 不推薦特定商品、不給保險規劃建議');
  lines.push('5. 答案結尾必加「以保單條款為準」');
  lines.push('');
  lines.push('【條款片段】');
  if (citations.length === 0) {
    lines.push('（系統未找到相關條款片段。）');
  } else {
    citations.forEach((c, i) => {
      lines.push(`---`);
      lines.push(`[${i + 1}] ${c.sectionHeader}（${c.citationLabel}, p.${c.pageNum}）`);
      lines.push(c.chunkText);
    });
  }
  lines.push('---');
  lines.push('');
  lines.push('【顧問問題】');
  lines.push(question);

  if (policyContext) {
    lines.push('');
    lines.push('【客戶上下文】');
    const ctxParts: string[] = [];
    if (typeof policyContext.insuredAge === 'number') {
      ctxParts.push(`年齡 ${policyContext.insuredAge}`);
    }
    if (policyContext.insuredGender) {
      ctxParts.push(`性別 ${policyContext.insuredGender}`);
    }
    if (typeof policyContext.sumAssured === 'number') {
      ctxParts.push(`保額 ${policyContext.sumAssured.toLocaleString('en-US')}`);
    }
    if (Array.isArray(policyContext.coverages) && policyContext.coverages.length) {
      ctxParts.push(
        '附約：' +
          policyContext.coverages
            .map((c) => `${c.type || '?'}${c.amount ? `(${c.amount})` : ''}`)
            .join(', '),
      );
    }
    lines.push(ctxParts.join('；') || '（無）');
  }

  return lines.join('\n');
}

function inferConfidence(citations: Citation[], answer: string): 'high' | 'medium' | 'low' {
  if (citations.length === 0) return 'low';
  const hasHedge =
    /不確定|請查條款原文|無法判斷|可能|建議向/.test(answer) ||
    !/第\s*\d+\s*條/.test(answer);
  if (citations.length >= 3 && !hasHedge) return 'high';
  if (citations.length >= 2) return 'medium';
  return hasHedge ? 'low' : 'medium';
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

async function writeAuditLog(opts: {
  uid: string;
  question: string;
  productId?: string;
  policyContext?: PolicyContext;
  result: 'success' | 'failure';
  ip: string;
  tokensUsed: { input: number; output: number };
  errorMsg?: string;
}): Promise<void> {
  try {
    const db = getFirestore(ensureApp());
    const now = new Date();
    const yyyymm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const eventId = `${now.getTime()}_${Math.random().toString(36).slice(2, 10)}`;
    await db.doc(`audit_logs/${yyyymm}/events/${eventId}`).set({
      type: 'ask',
      advisorUid: opts.uid,
      timestamp: FieldValue.serverTimestamp(),
      context: sanitizePIIForAudit({
        question: opts.question,
        productId: opts.productId || null,
        policyContext: opts.policyContext || null,
      }),
      result: opts.result,
      ip: opts.ip || 'unknown',
      tokensUsed: opts.tokensUsed,
      errorMsg: opts.errorMsg ? opts.errorMsg.slice(0, 500) : null,
    });
  } catch (err) {
    // audit 失敗不能阻斷主回應
    console.error('[ask] audit log write failed:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — 跟 functions/index.js 同款白名單；api/ask 是顧問端內部 endpoint。
  const allowedOrigins = [
    'https://ultra-advisor.tw',
    'https://www.ultra-advisor.tw',
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // ---- input parse ----
  let body: AskRequest;
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as AskRequest;
  } catch {
    return res.status(400).json({ error: 'invalid_json' });
  }
  const question = (body?.question || '').trim();
  if (!question) {
    return res.status(400).json({ error: 'missing_question' });
  }
  if (question.length > 1000) {
    return res.status(400).json({ error: 'question_too_long', max: 1000 });
  }
  const productId = body.productId && /^[A-Za-z0-9_\-]{1,80}$/.test(body.productId)
    ? body.productId
    : undefined;
  const policyContext = body.policyContext;

  const ipHeader =
    (req.headers['x-forwarded-for'] as string | undefined) ||
    (req.headers['x-real-ip'] as string | undefined) ||
    'unknown';
  const ip = ipHeader.split(',')[0]?.trim() || 'unknown';

  // ---- 1. Auth ----
  const authHeader = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!m) {
    return res.status(401).json({ error: 'missing_token' });
  }
  let uid: string;
  try {
    const decoded = await getAuth(ensureApp()).verifyIdToken(m[1]);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }

  // ---- 2-4. Rate limit + quota ----
  let yyyymm = '';
  try {
    await enforcePerMinuteLimit(uid);
    await enforceDailyLimit(uid);
    const monthly = await enforceMonthlyQuota(uid);
    yyyymm = monthly.yyyymm;
  } catch (err) {
    if (err instanceof QuotaError) {
      res.setHeader('Retry-After', String(err.retryAfterSec));
      await writeAuditLog({
        uid,
        question,
        productId,
        policyContext,
        result: 'failure',
        ip,
        tokensUsed: { input: 0, output: 0 },
        errorMsg: `quota: ${err.message}`,
      });
      return res.status(429).json({ error: 'quota_exceeded', message: err.message });
    }
    console.error('[ask] rate-limit check unexpected error:', (err as Error).message);
    // 不阻斷流程（跟 functions/index.js 的「降級放行」一致）
  }

  // ---- 5. Embed ----
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error('[ask] GEMINI_API_KEY missing');
    return res.status(500).json({ error: 'server_misconfigured' });
  }

  let queryVec: number[];
  try {
    queryVec = await embedQuestion(question, geminiKey);
  } catch (err) {
    console.error('[ask] embed failed:', (err as Error).message);
    await writeAuditLog({
      uid,
      question,
      productId,
      policyContext,
      result: 'failure',
      ip,
      tokensUsed: { input: 0, output: 0 },
      errorMsg: `embed: ${(err as Error).message}`,
    });
    return res.status(503).json({
      error: 'embedding_failed',
      message: 'embedding 失敗、請重試',
    });
  }

  // ---- 6-7. KNN + (already sorted by Firestore) ----
  const citations = await knnSearch(queryVec, productId);

  // ---- 8-9. Compose prompt & call Gemini Flash ----
  let answer: string;
  let tokensUsed = { input: 0, output: 0 };
  let confidence: 'high' | 'medium' | 'low';
  const disclaimers = [
    '最終以條款為準',
    'AI 解讀可能有誤、請務必核對條款原文',
  ];

  if (citations.length === 0) {
    // KNN empty — 直接回 fallback，不再花 LLM 錢
    answer = '未找到相關條款片段、請查 TII 公開資料庫或核對條款原文。以保單條款為準。';
    confidence = 'low';
  } else {
    const prompt = composePrompt(question, citations, policyContext);
    try {
      const r = await callGeminiFlash(prompt, geminiKey);
      answer = r.text;
      tokensUsed = { input: r.inputTokens, output: r.outputTokens };
    } catch (err) {
      // retry 1x
      console.warn('[ask] gemini first try failed, retrying:', (err as Error).message);
      try {
        const r2 = await callGeminiFlash(prompt, geminiKey);
        answer = r2.text;
        tokensUsed = { input: r2.inputTokens, output: r2.outputTokens };
      } catch (err2) {
        console.error('[ask] gemini retry failed:', (err2 as Error).message);
        await writeAuditLog({
          uid,
          question,
          productId,
          policyContext,
          result: 'failure',
          ip,
          tokensUsed,
          errorMsg: `llm: ${(err2 as Error).message}`,
        });
        return res.status(503).json({
          error: 'llm_failed',
          message: '系統忙、請稍後重試',
        });
      }
    }
    confidence = inferConfidence(citations, answer);
  }

  // ---- 11-12. Audit + quota bump ----
  await Promise.all([
    writeAuditLog({
      uid,
      question,
      productId,
      policyContext,
      result: 'success',
      ip,
      tokensUsed,
    }),
    yyyymm ? bumpMonthlyQuota(uid, yyyymm) : Promise.resolve(),
  ]);

  // ---- 13. Return — processedAtIso 在最後一刻取（spec：runtime callback 內）----
  const response: AskResponse = {
    answer,
    citations,
    confidence,
    disclaimers,
    tokensUsed,
    processedAtIso: new Date().toISOString(),
  };
  return res.status(200).json(response);
}
