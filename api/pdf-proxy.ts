// Sprint 14 W3 — /api/pdf-proxy  (Insurance clause PDF binary proxy)
// ---------------------------------------------------------------------------
// 顧問端 PDF viewer 的後端。輸入 productId + version，內部流程：
//   Firebase Auth verify  →  per-minute rate limit  →  monthly PDF view quota
//   →  Firebase Storage signed URL (60s TTL)  →  server-side fetch PDF bytes
//   →  audit_logs/{yyyymm}/events/{eventId} 寫一筆 'pdf_view'
//   →  advisors/{uid}/quotaUsage/{yyyymm} pdfViews++（transaction）
//   →  binary 流式回傳 + X-Quota-Remaining + X-Audit-Event-Id
//
// 戰略邊界（HARD、跟 spec 對齊）：
//   - 0 新 npm 依賴：firebase-admin 已在 root devDeps、PDF fetch 用 global
//     fetch（Node 18+ / @vercel/node runtime 內建），不引 axios。
//   - PDFs 全 private — 用 signed URL（60s）而非 makePublic()。
//   - Auth / Quota / Audit 三道閘 100% 不能繞、不論成敗都記。
//   - 「現在時間」全部在 handler callback 內取，module top-level 0 wall-clock。
//   - CORS 只開自身 origin 白名單。
//   - Audit context 走 PII sanitizer（IP 可能在 UA 帶用戶資訊 → 也 sanitize）。
//   - Cache-Control: no-store（avoid intermediary 緩存 PDF bytes，含 PII 風險）。
//
// 失敗模式對應 spec 鐵則：
//   401 無 auth / 403 quota 超 / 404 PDF 不存在 / 429 per-minute / 500 signed URL.
//
// 注意：Vercel SPA rewrite 已用 `/((?!api/).*)` 排除 api 路徑（vercel.json:20），
//   /api/pdf-proxy 不會被 rewrite。不需要新增 routing entry。
// ---------------------------------------------------------------------------

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getApps, initializeApp, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROJECT_ID = 'grbt-f87fa';
const DEFAULT_BUCKET = `${PROJECT_ID}.appspot.com`;
const STORAGE_PREFIX = 'insurance-conditions';
const SIGNED_URL_TTL_MS = 60 * 1000;          // 60s validity
const MONTHLY_QUOTA_PDF_VIEWS = 50;           // 顧問每月 50 view
const PER_MINUTE_LIMIT = 60;                  // 每 uid 每分鐘 60 次
const FETCH_TIMEOUT_MS = 15_000;              // 上游 Storage fetch 15s timeout
const MAX_PDF_BYTES = 25 * 1024 * 1024;       // 25MB 上限（防 OOM / 異常檔案）

// 允許的 productId / version 字符（防 path traversal、injection）
const PRODUCT_ID_RE = /^[A-Za-z0-9_\-]{1,80}$/;
const VERSION_RE = /^v?[A-Za-z0-9_\-]{1,16}$/;

// ---------------------------------------------------------------------------
// Lazy-init Firebase Admin（跟 api/ask.ts 同款）
// ---------------------------------------------------------------------------

let _app: App | null = null;
function ensureApp(): App {
  if (_app) return _app;
  const existing = getApps();
  if (existing.length) {
    _app = existing[0];
    return _app;
  }
  const bucket = process.env.FIREBASE_STORAGE_BUCKET || DEFAULT_BUCKET;
  const credEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credEnv) {
    try {
      const sa = JSON.parse(credEnv);
      _app = initializeApp({
        credential: cert(sa),
        projectId: sa.project_id || PROJECT_ID,
        storageBucket: bucket,
      });
      return _app;
    } catch (err) {
      console.warn('[pdf-proxy] GOOGLE_APPLICATION_CREDENTIALS_JSON parse failed:', (err as Error).message);
    }
  }
  try {
    _app = initializeApp({
      credential: applicationDefault(),
      projectId: PROJECT_ID,
      storageBucket: bucket,
    });
  } catch {
    _app = initializeApp({
      projectId: PROJECT_ID,
      storageBucket: bucket,
    });
  }
  return _app;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PdfProxyRequest {
  productId: string;
  version?: string;
}

interface AuditContext {
  productId: string;
  version: string;
  ip: string;
  userAgent: string;
  storagePath: string;
}

// ---------------------------------------------------------------------------
// PII sanitizer（跟 api/ask.ts 同款、用於 audit log）
// ---------------------------------------------------------------------------

function sanitizePIIForAudit<T>(input: T): T {
  if (input == null) return input;
  if (typeof input === 'string') {
    return input
      .replace(/\b[A-Z][12]\d{8}\b/g, '[REDACTED]')
      .replace(/\b\d{18}\b/g, '[REDACTED]')
      .replace(/\b09\d{8}\b/g, '[REDACTED]')
      .replace(/\b\d{10}\b/g, '[REDACTED]')
      .replace(/[一-龥]{3,4}(?=先生|小姐|女士|客戶|被保險人)/g, '[REDACTED]')
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[REDACTED]') as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map((x) => sanitizePIIForAudit(x)) as unknown as T;
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
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
// Rate limit & quota
// ---------------------------------------------------------------------------

class QuotaError extends Error {
  retryAfterSec = 60;
  httpStatus = 429;
  code = 'quota_exceeded';
}

/** 每 uid 每分鐘 PER_MINUTE_LIMIT 次（與 ask.ts 同模型，但 key 不同）。 */
async function enforcePerMinuteLimit(uid: string): Promise<void> {
  const db = getFirestore(ensureApp());
  // 「現在時間」在 callback 內取
  const now = new Date();
  const minuteKey = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  const ref = db.collection('rateLimits').doc(`pdfview_min_${uid}_${minuteKey}`);
  const snap = await ref.get();
  const current = (snap.exists ? (snap.data() as { count?: number }).count : 0) ?? 0;
  if (current >= PER_MINUTE_LIMIT) {
    const err = new QuotaError('請求過於頻繁、請稍後重試');
    err.retryAfterSec = 30;
    err.httpStatus = 429;
    err.code = 'rate_limited';
    throw err;
  }
  await ref.set(
    { count: current + 1, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

/** 月配額 read-only 檢查（未超過就放行；實際 ++ 在 bumpMonthlyPdfQuota）。 */
async function checkMonthlyPdfQuota(uid: string): Promise<{ yyyymm: string; usedBefore: number }> {
  const db = getFirestore(ensureApp());
  const now = new Date();
  const yyyymm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const ref = db.doc(`advisors/${uid}/quotaUsage/${yyyymm}`);
  const snap = await ref.get();
  const pdfViews = (snap.exists ? (snap.data() as { pdfViews?: number }).pdfViews : 0) ?? 0;
  if (pdfViews >= MONTHLY_QUOTA_PDF_VIEWS) {
    const err = new QuotaError(`本月 PDF 檢視配額 ${MONTHLY_QUOTA_PDF_VIEWS} 已用完`);
    err.retryAfterSec = 24 * 60 * 60;
    err.httpStatus = 403;
    err.code = 'monthly_quota_exhausted';
    throw err;
  }
  return { yyyymm, usedBefore: pdfViews };
}

/** Transaction 增加 pdfViews + lastPdfViewAt。runtime now 在 callback 內取。 */
async function bumpMonthlyPdfQuota(
  uid: string,
  yyyymm: string,
): Promise<{ pdfViewsAfter: number }> {
  const db = getFirestore(ensureApp());
  const ref = db.doc(`advisors/${uid}/quotaUsage/${yyyymm}`);
  const after = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.exists ? (snap.data() as { pdfViews?: number }).pdfViews : 0) ?? 0;
    const next = current + 1;
    tx.set(
      ref,
      {
        pdfViews: next,
        lastPdfViewAt: new Date().toISOString(),  // runtime callback 內取
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return next;
  });
  return { pdfViewsAfter: after };
}

// ---------------------------------------------------------------------------
// Signed URL + Server-side fetch
// ---------------------------------------------------------------------------

class PdfNotFoundError extends Error {}
class SignedUrlError extends Error {}
class FetchPdfError extends Error {
  httpStatus = 500;
}

/** Signed URL（v4、60s TTL）。回 { url, storagePath, sizeBytes? }。
 *  先 file.exists() 檢查；不存在丟 PdfNotFoundError → 404。
 */
async function getSignedPdfUrl(
  productId: string,
  version: string,
): Promise<{ url: string; storagePath: string; sizeBytes?: number }> {
  const storagePath = `${STORAGE_PREFIX}/${productId}/${version}.pdf`;
  let bucket;
  try {
    bucket = getStorage(ensureApp()).bucket();
  } catch (err) {
    throw new SignedUrlError(`bucket access failed: ${(err as Error).message}`);
  }
  const file = bucket.file(storagePath);

  let exists = false;
  let sizeBytes: number | undefined;
  try {
    const [exRes] = await file.exists();
    exists = !!exRes;
    if (exists) {
      try {
        const [meta] = await file.getMetadata();
        const sizeRaw = meta?.size;
        if (typeof sizeRaw === 'string') sizeBytes = Number(sizeRaw);
        else if (typeof sizeRaw === 'number') sizeBytes = sizeRaw;
      } catch {
        // metadata fail 不阻流程
      }
    }
  } catch (err) {
    throw new SignedUrlError(`exists check failed: ${(err as Error).message}`);
  }
  if (!exists) {
    throw new PdfNotFoundError(`storage object not found: ${storagePath}`);
  }

  // V4 signed URL — 「現在時間」基準在 GCS 端、expires 我們算 now+60s
  const expires = Date.now() + SIGNED_URL_TTL_MS;
  let url: string;
  try {
    const [signed] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires,
    });
    url = signed;
  } catch (err) {
    throw new SignedUrlError(`signed URL gen failed: ${(err as Error).message}`);
  }
  return { url, storagePath, sizeBytes };
}

/** Server-side fetch PDF via signed URL → Buffer。
 *  - timeout: FETCH_TIMEOUT_MS
 *  - 大小檢查: MAX_PDF_BYTES
 */
async function fetchPdfBytes(signedUrl: string): Promise<Buffer> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(signedUrl, {
      method: 'GET',
      // signed URL 本身已帶授權、不要送 cookies
      redirect: 'follow',
      signal: ac.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const e = new FetchPdfError(`fetch failed: ${(err as Error).message}`);
    e.httpStatus = 502;
    throw e;
  }
  clearTimeout(timer);

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    const e = new FetchPdfError(`upstream ${resp.status}: ${body.slice(0, 200)}`);
    // 404 from upstream → 視為「資源不存在」（罕見、exists() 之後被刪）
    e.httpStatus = resp.status === 404 ? 404 : 502;
    throw e;
  }

  // Content-Length pre-check（若 upstream 提供）
  const lenHeader = resp.headers.get('content-length');
  if (lenHeader && Number(lenHeader) > MAX_PDF_BYTES) {
    const e = new FetchPdfError(`pdf exceeds max size: ${lenHeader} > ${MAX_PDF_BYTES}`);
    e.httpStatus = 502;
    throw e;
  }

  const ab = await resp.arrayBuffer();
  if (ab.byteLength > MAX_PDF_BYTES) {
    const e = new FetchPdfError(`pdf exceeds max size after read: ${ab.byteLength}`);
    e.httpStatus = 502;
    throw e;
  }
  return Buffer.from(ab);
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

/** Write audit_logs/{yyyymm}/events/{eventId}.
 *  eventId 格式：pdfview_<runtime-epoch-ms>_<uid>_<productId>（為了 dedupe/trace）。
 *  Audit 失敗不能阻斷主回應 — log + 繼續。
 */
async function writeAuditLog(opts: {
  uid: string;
  result: 'success' | 'failure';
  ctx: AuditContext;
  errorMsg?: string;
  bytesServed?: number;
}): Promise<string | null> {
  try {
    const db = getFirestore(ensureApp());
    const now = new Date();  // runtime callback 內取
    const yyyymm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const epoch = now.getTime();
    // productId 已經是 [A-Za-z0-9_-] 限制過、可直接放進 path/id
    const safeProductId = opts.ctx.productId.replace(/[^A-Za-z0-9_\-]/g, '_').slice(0, 60);
    const eventId = `pdfview_${epoch}_${opts.uid}_${safeProductId}`;
    await db.doc(`audit_logs/${yyyymm}/events/${eventId}`).set({
      type: 'pdf_view',
      advisorUid: opts.uid,
      timestamp: FieldValue.serverTimestamp(),
      result: opts.result,
      context: sanitizePIIForAudit({
        productId: opts.ctx.productId,
        version: opts.ctx.version,
        ip: opts.ctx.ip,
        userAgent: opts.ctx.userAgent,
        storagePath: opts.ctx.storagePath,
        bytesServed: opts.bytesServed ?? 0,
      }),
      errorMsg: opts.errorMsg ? opts.errorMsg.slice(0, 500) : null,
    });
    return eventId;
  } catch (err) {
    console.error('[pdf-proxy] audit log write failed:', (err as Error).message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// CORS / origin
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  'https://ultra-advisor.tw',
  'https://www.ultra-advisor.tw',
  'http://localhost:5173',
  'http://localhost:3000',
];

function applyCors(req: VercelRequest, res: VercelResponse): void {
  const origin = (req.headers.origin as string | undefined) || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'X-Quota-Remaining, X-Audit-Event-Id');
  // PDF bytes 含 PII 風險 → 不快取
  res.setHeader('Cache-Control', 'no-store');
  // 內部 API、不公開索引
  res.setHeader('X-Robots-Tag', 'noindex');
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // ---- input parse ----
  let body: PdfProxyRequest;
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as PdfProxyRequest;
  } catch {
    return res.status(400).json({ error: 'invalid_json' });
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'invalid_body' });
  }

  const productId = (body.productId || '').trim();
  const versionRaw = (body.version || 'v1').trim();
  if (!productId || !PRODUCT_ID_RE.test(productId)) {
    return res.status(400).json({ error: 'invalid_product_id' });
  }
  if (!VERSION_RE.test(versionRaw)) {
    return res.status(400).json({ error: 'invalid_version' });
  }
  // Normalize: 接受 "v1" 或 "1"、最終 storage path 統一帶 "v" 前綴
  const version = versionRaw.startsWith('v') ? versionRaw : `v${versionRaw}`;

  // ---- request meta（runtime callback 內取）----
  const ipHeader =
    (req.headers['x-forwarded-for'] as string | undefined) ||
    (req.headers['x-real-ip'] as string | undefined) ||
    'unknown';
  const ip = ipHeader.split(',')[0]?.trim() || 'unknown';
  const userAgent = String(req.headers['user-agent'] || 'unknown').slice(0, 300);

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

  // Audit context 在這裡組（storagePath 在 signed URL 階段補）
  const auditCtx: AuditContext = {
    productId,
    version,
    ip,
    userAgent,
    storagePath: `${STORAGE_PREFIX}/${productId}/${version}.pdf`,
  };

  // ---- 2. Per-minute rate limit ----
  try {
    await enforcePerMinuteLimit(uid);
  } catch (err) {
    if (err instanceof QuotaError) {
      res.setHeader('Retry-After', String(err.retryAfterSec));
      await writeAuditLog({
        uid,
        result: 'failure',
        ctx: auditCtx,
        errorMsg: `rate_limit: ${err.message}`,
      });
      return res.status(err.httpStatus).json({ error: err.code, message: err.message });
    }
    // 非預期錯誤 — 降級放行（跟 ask.ts 一致）、但仍記 audit
    console.error('[pdf-proxy] rate-limit check unexpected error:', (err as Error).message);
  }

  // ---- 3. Monthly quota（read-only check）----
  let yyyymm: string;
  try {
    const quota = await checkMonthlyPdfQuota(uid);
    yyyymm = quota.yyyymm;
  } catch (err) {
    if (err instanceof QuotaError) {
      res.setHeader('Retry-After', String(err.retryAfterSec));
      const eventId = await writeAuditLog({
        uid,
        result: 'failure',
        ctx: auditCtx,
        errorMsg: `quota: ${err.message}`,
      });
      if (eventId) res.setHeader('X-Audit-Event-Id', eventId);
      res.setHeader('X-Quota-Remaining', '0');
      return res.status(err.httpStatus).json({
        error: err.code,
        message: err.message,
        quotaLimit: MONTHLY_QUOTA_PDF_VIEWS,
        quotaRemaining: 0,
      });
    }
    console.error('[pdf-proxy] quota check unexpected error:', (err as Error).message);
    // 不阻流程 — 仍嘗試服務，事後審計可重建
    yyyymm = (() => {
      const n = new Date();
      return `${n.getUTCFullYear()}${String(n.getUTCMonth() + 1).padStart(2, '0')}`;
    })();
  }

  // ---- 4. Signed URL ----
  let signed: { url: string; storagePath: string; sizeBytes?: number };
  try {
    signed = await getSignedPdfUrl(productId, version);
  } catch (err) {
    if (err instanceof PdfNotFoundError) {
      const eventId = await writeAuditLog({
        uid,
        result: 'failure',
        ctx: auditCtx,
        errorMsg: `not_found: ${err.message}`,
      });
      if (eventId) res.setHeader('X-Audit-Event-Id', eventId);
      return res.status(404).json({ error: 'pdf_not_found', productId, version });
    }
    console.error('[pdf-proxy] signed URL error:', (err as Error).message);
    const eventId = await writeAuditLog({
      uid,
      result: 'failure',
      ctx: auditCtx,
      errorMsg: `signed_url: ${(err as Error).message}`,
    });
    if (eventId) res.setHeader('X-Audit-Event-Id', eventId);
    return res.status(500).json({ error: 'signed_url_failed' });
  }
  auditCtx.storagePath = signed.storagePath;

  // ---- 5. Server-side fetch PDF bytes ----
  let pdfBuf: Buffer;
  try {
    pdfBuf = await fetchPdfBytes(signed.url);
  } catch (err) {
    const httpStatus = err instanceof FetchPdfError ? err.httpStatus : 502;
    console.error('[pdf-proxy] fetch PDF failed:', (err as Error).message);
    const eventId = await writeAuditLog({
      uid,
      result: 'failure',
      ctx: auditCtx,
      errorMsg: `fetch: ${(err as Error).message}`,
    });
    if (eventId) res.setHeader('X-Audit-Event-Id', eventId);
    return res.status(httpStatus).json({ error: 'pdf_fetch_failed' });
  }

  // ---- 6. Audit + 7. Quota bump（並行；audit 失敗不阻、quota 失敗回 500 比較安全）----
  let pdfViewsAfter = 0;
  try {
    const bumpRes = await bumpMonthlyPdfQuota(uid, yyyymm!);
    pdfViewsAfter = bumpRes.pdfViewsAfter;
  } catch (err) {
    console.error('[pdf-proxy] quota bump failed:', (err as Error).message);
    // 不回 5xx — 因為 PDF 已 fetch、quota 寫失敗會造成下一次 read 偏差但服務仍可用。
    // 改用 0 表示「unknown」、UI 端會 fallback 顯示 "—"。
  }

  const eventId = await writeAuditLog({
    uid,
    result: 'success',
    ctx: auditCtx,
    bytesServed: pdfBuf.length,
  });

  // ---- 8. Stream PDF bytes ----
  const remaining = Math.max(0, MONTHLY_QUOTA_PDF_VIEWS - pdfViewsAfter);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', String(pdfBuf.length));
  res.setHeader('Content-Disposition', `inline; filename="${productId}_${version}.pdf"`);
  res.setHeader('X-Quota-Remaining', String(remaining));
  res.setHeader('X-Quota-Limit', String(MONTHLY_QUOTA_PDF_VIEWS));
  if (eventId) res.setHeader('X-Audit-Event-Id', eventId);
  // Cache-Control 已在 applyCors 設 no-store

  return res.status(200).send(pdfBuf);
}
