/* eslint-disable no-console */
/**
 * Ultra Advisor — TII crawler shared base lib
 * Sprint 15 / Task B1
 *
 * Why this file exists:
 *   Sprint 12 shipped `scripts/crawl-tii.cjs` as a 668-line one-shot. Sprint 15
 *   adds a monthly diff-based crawler (`scripts/crawl-tii-monthly.cjs`) that
 *   needs ~80% of the same primitives — HTTP w/ cookie jar against an expired-
 *   cert TII endpoint, captcha download, query-page parsing, ROC date math,
 *   slugify, the COMPANIES + CATEGORIES tables. Rather than copy-paste (and
 *   then drift), Sprint 15 W1 extracts the shared atoms into this lib.
 *
 * Boundary rules (kept identical to Sprint 12):
 *   - Set `NODE_TLS_REJECT_UNAUTHORIZED=0` at the very top — TII cert is
 *     expired. Isolated to crawler scripts that explicitly `require` this lib,
 *     not the wider Ultra Advisor app.
 *   - No new npm deps. Cookie jar, HTML parse, retries, SHA-256 are all
 *     hand-rolled / Node-builtin (`node:crypto`).
 *   - Never read the wall clock at module top level. `Date.now()` /
 *     `new Date()` only inside per-call callbacks (see `jitterSleep`,
 *     `sha256Hex` callers) so test fixtures stay deterministic and so we
 *     don't accidentally pin a "crawl started at" timestamp to module load.
 *   - Firebase Admin SDK is NOT touched here — keep this lib commit-safe to
 *     `require()` from a dry-run path that never auths.
 *
 * What this lib does NOT own:
 *   - CAPTCHA solving (Gemini Vision) — that's `scripts/lib/tii-captcha-solver.cjs`
 *   - Diff classification — that's `scripts/lib/tii-diff.cjs`
 *   - State file shape for the monthly run — the monthly script owns its own
 *     state schema; this lib only exposes generic helpers.
 *   - The Sprint 12 STATE_FILE path / Sprint 12 main loop — that script keeps
 *     its own copy of the high-level orchestration so its behaviour can't
 *     regress from a lib edit. The atoms below match Sprint 12's behaviour
 *     byte-for-byte where the interface is the same; Sprint 12 will be cleaned
 *     up to `require` this lib in a later sprint when we're confident the
 *     interfaces are stable.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const crypto = require('node:crypto');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TII_BASE = 'https://insprod.tii.org.tw';
const QUERY_URL = `${TII_BASE}/Query.aspx`;
const RESULT_URL = `${TII_BASE}/ResultQueryAll.aspx`;
const CAPTCHA_URL = `${TII_BASE}/bmp.ashx`;

// Sprint 12 探勘 (表 D). The Sprint 15 spec talks about "22 壽險 + 21 產險" —
// that's the *active* subset the monthly run targets by default. The full
// table here is wider (includes 中華郵政 220 and 政策性 314) because the lib
// must be able to address every TII company code; the monthly script filters
// down to the active set itself.
const COMPANIES = {
  pAndC: ['101','102','103','105','106','108','109','111','112','113','115','117','119','120','125','128','130','131','132','133','134','135','141','143','144','146','197'],
  life:  ['204','205','206','208','209','210','211','212','213','214','216','217','218','219','220','252','254','255','256','257','258','259','260','261','262','263','264','265','266','267','268','269','271','272'],
  policy:['314'],
};

// Active set the Sprint 15 monthly run targets by default (from the spec).
// We exclude 政策性 (314) and 中華郵政 (220) because they ship far fewer
// products and break the steady-cadence model; if/when those need a refresh
// the script supports `--company` override.
const COMPANIES_ACTIVE = {
  pAndC: COMPANIES.pAndC.slice(0, 21),  // first 21 active P&C
  life:  COMPANIES.life.filter((c) => c !== '220').slice(0, 22), // 22 active life
};

// 險種大類 (Sprint 12 表 E)
const CATEGORIES = {
  car:               { code: '1_1', cat: '1', uaType: 'car' },
  fire:              { code: '1_2', cat: '1', uaType: 'home' },
  accident_property: { code: '1_4', cat: '1', uaType: 'accident_property' },
  life_traditional:    { code: '2_3', cat: '2', uaType: 'life_traditional' },
  annuity_traditional: { code: '2_4', cat: '2', uaType: 'annuity_traditional' },
  life_ulink:          { code: '2_5', cat: '2', uaType: 'life_ulink' },
  annuity_ulink:       { code: '2_6', cat: '2', uaType: 'annuity_ulink' },
  accident: { code: '3_1', cat: '', uaType: 'accident' },
  health:   { code: '3_2', cat: '', uaType: 'medical' },
};

const USER_AGENT = 'UltraAdvisor-Compliance-Crawler/1.0 (+https://ultra-advisor.tw; contact: risky9763@gmail.com)';

// ---------------------------------------------------------------------------
// CookieJar — minimal, TII only needs ASP.NET_SessionId aligned
// ---------------------------------------------------------------------------

class CookieJar {
  constructor() { this.cookies = new Map(); }
  ingest(setCookieHeaders) {
    if (!setCookieHeaders) return;
    const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (const sc of arr) {
      const m = /^([^=]+)=([^;]*)/.exec(sc);
      if (m) this.cookies.set(m[1], m[2]);
    }
  }
  toHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  clear() { this.cookies.clear(); }
}

// ---------------------------------------------------------------------------
// HTTP helpers — Node 20+ fetch + cookie jar
// ---------------------------------------------------------------------------

async function httpRequest(url, opts = {}, jar) {
  const headers = {
    'User-Agent': USER_AGENT,
    'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
    ...(opts.headers || {}),
  };
  if (jar && jar.toHeader()) headers['Cookie'] = jar.toHeader();

  const res = await fetch(url, { ...opts, headers, redirect: 'manual' });

  if (jar) {
    const setCookies = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : res.headers.get('set-cookie');
    jar.ingest(setCookies);
  }
  return res;
}

/**
 * 1.5–3.0s jitter, EVERY clock read inside the timer callback (not at schedule
 * time). This matches the Sprint 12 / Sprint 15 hard rule on time access.
 */
function jitterSleep(minMs = 1500, spreadMs = 1500) {
  return new Promise((resolve) => {
    const delayMs = minMs + Math.floor(Math.random() * spreadMs);
    setTimeout(() => {
      const _now = Date.now(); // runtime clock — captured here, never at schedule
      void _now;
      resolve();
    }, delayMs);
  });
}

/**
 * `withRetry(label, fn, { maxRetries, backoffs })` — exponential backoff with
 * a default 5s/15s/45s schedule. Backoff length is captured at retry time so
 * Date.now() never leaks to module top-level.
 */
async function withRetry(label, fn, opts = {}) {
  const maxRetries = opts.maxRetries ?? 3;
  const backoffs = opts.backoffs || [5000, 15000, 45000];
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > maxRetries) {
        throw new Error(`[${label}] failed after ${maxRetries} retries: ${err.message}`);
      }
      const wait = backoffs[Math.min(attempt - 1, backoffs.length - 1)];
      console.warn(`[${label}] attempt ${attempt}/${maxRetries} failed: ${err.message}. Backing off ${wait}ms.`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

// ---------------------------------------------------------------------------
// HTML parse — no cheerio, regex against UTF-8 markup
// ---------------------------------------------------------------------------

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]+>/g, '').trim());
}

function isCaptchaReject(html) {
  return /識別碼錯誤|alert\("識別碼/.test(html);
}

function isNoResults(html) {
  return /很抱歉，目前並沒有/.test(html);
}

/**
 * Parse product rows out of ResultQueryAll.aspx HTML.
 *
 * The Sprint 12 探勘 couldn't get past CAPTCHA to confirm the exact <table>
 * layout, so the extractor is intentionally tolerant: any <tr> that has
 * (a) ≥3 cells, (b) a Chinese-name-ish cell, (c) an href to a PDF/aspx/ashx
 * resource, counts as a candidate row. Once Sprint 15 W1 lands the captcha
 * solver and we see real markup we can tighten this.
 */
function parseProducts(html) {
  const rows = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = trRegex.exec(html)) !== null) {
    const inner = m[1];
    if (/<th[\s>]/i.test(inner)) continue;
    const cells = [...inner.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => c[1]);
    if (cells.length < 3) continue;

    const text = cells.map(stripTags);
    const hrefMatch = inner.match(/href\s*=\s*['"]([^'"]+\.(?:pdf|aspx\?[^'"]+|ashx\?[^'"]+))['"]/i);
    if (!hrefMatch) continue;

    let productName = '';
    for (const t of text) {
      if (/[一-鿿]/.test(t) && t.length > productName.length) productName = t;
    }
    if (!productName) continue;

    let productCode = '';
    for (const t of text) {
      const codeM = t.match(/\b[A-Z]{1,6}\d{3,12}\b/);
      if (codeM) { productCode = codeM[0]; break; }
    }

    const rocDates = [];
    for (const t of text) {
      const dm = t.match(/(\d{2,3})\/(\d{1,2})\/(\d{1,2})/);
      if (dm) rocDates.push(`${dm[1]}/${dm[2]}/${dm[3]}`);
    }

    const href = hrefMatch[1];
    const pdfUrl = href.startsWith('http') ? href : `${TII_BASE}/${href.replace(/^\//, '')}`;

    rows.push({
      productName,
      productCode: productCode || null,
      beginDateRoc: rocDates[0] || null,
      endDateRoc: rocDates[1] || null,
      pdfUrl,
      rawTextCells: text,
    });
  }
  return rows;
}

function rocToIso(rocStr) {
  if (!rocStr) return null;
  const m = rocStr.match(/(\d{2,3})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  const y = parseInt(m[1], 10) + 1911;
  const mo = m[2].padStart(2, '0');
  const d = m[3].padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

function gregorianToRoc(date) {
  const y = date.getFullYear() - 1911;
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${mo}/${d}`;
}

function slugify(s) {
  return String(s).replace(/[\\/:*?"<>|\s]+/g, '_').replace(/_+/g, '_').slice(0, 80);
}

// ---------------------------------------------------------------------------
// SHA-256 — built-in `node:crypto`, no new dep
// ---------------------------------------------------------------------------

/**
 * SHA-256 hex digest of a Buffer / Uint8Array / string.
 *
 * Sprint 15 W1: used to fingerprint PDF bytes so the diff classifier can tell
 * "same content, re-uploaded" from "real revision". Hex (lowercase, 64 chars)
 * picked over base64 because that's what Firestore queries / human eyeballs
 * compare best.
 */
function sha256Hex(input) {
  const h = crypto.createHash('sha256');
  if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
    h.update(input);
  } else {
    h.update(String(input), 'utf8');
  }
  return h.digest('hex');
}

// ---------------------------------------------------------------------------
// TII flow helpers (raw HTTP — no business logic)
// ---------------------------------------------------------------------------

async function fetchQueryPage(jar) {
  const res = await httpRequest(QUERY_URL, { method: 'GET' }, jar);
  if (!res.ok) throw new Error(`Query.aspx GET ${res.status}`);
  return await res.text();
}

/**
 * Download the CAPTCHA bitmap. Returns the raw Buffer so the caller can
 * either save it (manual mode) or hand it straight to Gemini Vision
 * (auto mode). Sprint 12's variant wrote to disk; Sprint 15 keeps the bytes
 * in memory by default and lets the caller choose.
 */
async function downloadCaptchaBuffer(jar) {
  const res = await httpRequest(CAPTCHA_URL, { method: 'GET' }, jar);
  if (!res.ok) throw new Error(`captcha download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function submitQuery(jar, params) {
  const body = new URLSearchParams(params).toString();
  const res = await httpRequest(RESULT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: QUERY_URL,
      Origin: TII_BASE,
    },
    body,
  }, jar);

  if (res.status === 302) {
    return { html: '', redirected: true, location: res.headers.get('location') };
  }
  if (!res.ok) throw new Error(`ResultQueryAll.aspx POST ${res.status}`);
  const html = await res.text();
  return { html, redirected: false };
}

function buildQueryParams({ companyId, categoryKey, captchaCode, onlySelling = false }) {
  const cat = CATEGORIES[categoryKey];
  if (!cat) throw new Error(`unknown category key ${categoryKey}`);
  const params = {
    categoryId: cat.cat,
    postB: 'Y',
    CompanyID: companyId,
    f_CategoryId1: cat.code,
    qry_beginDate_SD1: '',
    qry_beginDate_SD2: '',
    qry_endDate_ED1: '',
    qry_endDate_ED2: '',
    fQueryAll: '',
    bmpC: captchaCode || '',
    isqry: 'Y',
    isquery: 'Y',
  };
  // Sprint 15 W1: monthly run intentionally pulls BOTH 在售 + 停售 so the
  // diff classifier can see new discontinuations. Sprint 12 (`crawl-tii.cjs`)
  // kept `onlySelling: true` for its narrow probe; we expose the knob.
  if (onlySelling) params.endDate2 = 'Y';
  return params;
}

/**
 * Map crawler's sub-type (`uaType`) to the TS InsuranceCategoryMain union.
 * Kept here so both Sprint 12's main script and Sprint 15's monthly script
 * produce identical category buckets — drift here would cause silent product
 * misclassification.
 */
function mapCategoryToMain(uaType) {
  switch (uaType) {
    case 'life_traditional':    return 'life';
    case 'life_ulink':          return 'investmentLinked';
    case 'annuity_traditional': return 'annuity';
    case 'annuity_ulink':       return 'investmentLinked';
    case 'medical':             return 'medical';
    case 'accident':            return 'accident';
    case 'accident_property':   return 'accident';
    case 'car':
    case 'home':
    default:                    return 'accident';
  }
}

/**
 * Build the canonical Firestore doc shape from a parsed TII row + a chosen
 * `crawledAt` epoch ms. Caller supplies `crawledAt` from inside its own
 * callback (鐵則).
 */
function buildProductDoc({ row, companyId, categoryKey, pdfSha256, crawledAt, crawlerVersion = 'tii-monthly-v1' }) {
  const cat = CATEGORIES[categoryKey];
  if (!cat) throw new Error(`unknown category key ${categoryKey}`);
  const companySlug = `tii_${companyId}`;
  const productCode = row.productCode || slugify(row.productName);
  return {
    id: `${companySlug}_${slugify(productCode)}`,
    company: companyId,
    companySlug,
    productName: row.productName,
    productCode,
    categoryMain: mapCategoryToMain(cat.uaType),
    categorySub: cat.uaType,
    effectiveDate: rocToIso(row.beginDateRoc) || undefined,
    endDate: rocToIso(row.endDateRoc) || undefined,
    status: row.endDateRoc ? 'discontinued' : 'active',
    source: 'tii',
    sourceUrl: row.pdfUrl,
    pdfStoragePath: undefined,
    pdfSha256: pdfSha256 || undefined,
    crawledAt,
    crawlerVersion,
    schemaVersion: 1,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // constants
  TII_BASE,
  QUERY_URL,
  RESULT_URL,
  CAPTCHA_URL,
  COMPANIES,
  COMPANIES_ACTIVE,
  CATEGORIES,
  USER_AGENT,
  // classes
  CookieJar,
  // HTTP
  httpRequest,
  jitterSleep,
  withRetry,
  // parse
  decodeEntities,
  stripTags,
  isCaptchaReject,
  isNoResults,
  parseProducts,
  rocToIso,
  gregorianToRoc,
  slugify,
  // crypto
  sha256Hex,
  // TII flow
  fetchQueryPage,
  downloadCaptchaBuffer,
  submitQuery,
  buildQueryParams,
  mapCategoryToMain,
  buildProductDoc,
};
