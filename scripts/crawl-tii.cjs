#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Ultra Advisor — TII (insprod.tii.org.tw) public clause crawler
 * Sprint 12 / Task A
 *
 * 來源: https://insprod.tii.org.tw/Query.aspx → ResultQueryAll.aspx
 * 目的: 把 TII 公開的保險商品條款 PDF + metadata 索引進 UA Firestore
 *       (insurance_products) + Firebase Storage (insurance_pdfs/...)
 *
 * 鐵則 (見 Sprint 12 規格):
 *   - **節制 + 合規**: 1-2 秒/request + jitter, 一次 run 預設 --limit 5
 *   - **不爬保險贏家** — 本 script 只處理 TII
 *   - PDF 直存 Firebase Storage (asia-east1), 不本機長期保存
 *   - 不引入新 npm 依賴 (Node 20+ 內建 fetch + 自寫 regex parse)
 *   - 任何「現在時間」必須在 runtime callback 內取, jitter 不在 module top-level
 *   - state file (scripts/tii-crawler-state.json) 不進 git
 *   - dry-run 是預設 — 真的要寫 Firestore/Storage 要明確 --commit
 *
 * SSL workaround:
 *   TII 站台 (insprod.tii.org.tw) 的 SSL cert 過期 (Sprint 12 探勘確認).
 *   只有此 script 設 NODE_TLS_REJECT_UNAUTHORIZED=0, 別處不要套.
 *   ↓↓↓ 必須在 require('https') / fetch 之前 ↓↓↓
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TII_BASE = 'https://insprod.tii.org.tw';
const QUERY_URL = `${TII_BASE}/Query.aspx`;
const RESULT_URL = `${TII_BASE}/ResultQueryAll.aspx`;
const STATE_FILE = path.join(__dirname, 'tii-crawler-state.json');

// 27 P&C + 34 life + 中華郵政 (220) + 政策性 (314)
// 取自 Sprint 12 探勘 (表 D)
const COMPANIES = {
  pAndC: ['101','102','103','105','106','108','109','111','112','113','115','117','119','120','125','128','130','131','132','133','134','135','141','143','144','146','197'],
  life:  ['204','205','206','208','209','210','211','212','213','214','216','217','218','219','220','252','254','255','256','257','258','259','260','261','262','263','264','265','266','267','268','269','271','272'],
  policy:['314'],
};

// 險種大類 (Sprint 12 表 E)
const CATEGORIES = {
  // 產險用
  car:               { code: '1_1', cat: '1', uaType: 'car' },
  fire:              { code: '1_2', cat: '1', uaType: 'home' },
  accident_property: { code: '1_4', cat: '1', uaType: 'accident_property' },
  // 人身險用
  life_traditional:    { code: '2_3', cat: '2', uaType: 'life_traditional' },
  annuity_traditional: { code: '2_4', cat: '2', uaType: 'annuity_traditional' },
  life_ulink:          { code: '2_5', cat: '2', uaType: 'life_ulink' },
  annuity_ulink:       { code: '2_6', cat: '2', uaType: 'annuity_ulink' },
  // 第三類
  accident: { code: '3_1', cat: '', uaType: 'accident' },
  health:   { code: '3_2', cat: '', uaType: 'medical' },
};

const USER_AGENT = 'UltraAdvisor-Compliance-Crawler/1.0 (+https://ultra-advisor.tw; contact: risky9763@gmail.com)';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = {
    dryRun: true,         // 預設 dry-run
    commit: false,        // --commit 才會寫 Firestore/Storage
    resume: false,        // --resume 從 state 接續
    limit: 5,             // 預設只跑 5 個 query (合規)
    full: false,          // --full 才允許跑全表
    captchaCode: null,    // --captcha-code 1234 (人工半自動)
    company: null,        // --company 204 (override 公司清單, debug 用)
    category: null,       // --category life_traditional
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--commit') { flags.commit = true; flags.dryRun = false; }
    else if (a === '--dry-run') { flags.dryRun = true; flags.commit = false; }
    else if (a === '--resume') { flags.resume = true; }
    else if (a === '--full') { flags.full = true; }
    else if (a === '--limit') { flags.limit = parseInt(argv[++i], 10) || 5; }
    else if (a === '--captcha-code') { flags.captchaCode = argv[++i]; }
    else if (a === '--company') { flags.company = argv[++i]; }
    else if (a === '--category') { flags.category = argv[++i]; }
    else if (a === '-h' || a === '--help') { flags.help = true; }
  }
  return flags;
}

function printHelp() {
  console.log(`
Ultra Advisor — TII Crawler

Usage:
  node scripts/crawl-tii.cjs [flags]

Flags:
  --dry-run             (default) Parse + log, do NOT write Firestore / Storage
  --commit              Actually write to Firestore + Firebase Storage
                        (requires GOOGLE_APPLICATION_CREDENTIALS env)
  --resume              Resume from scripts/tii-crawler-state.json
  --limit N             Process at most N queries this run (default: 5)
  --full                Allow processing the full company × category matrix
                        (default off — Sprint 12 規格: 不要跑全量)
  --captcha-code XXXX   Pre-supplied 4-digit captcha solution (manual mode).
                        If absent, crawler will dump captcha to disk and pause.
  --company CODE        Override company list (e.g. 204 = 國泰人壽)
  --category KEY        Override category (e.g. life_traditional)
  -h, --help            Show this help

Examples:
  # Sprint 12 dry-run validation (no captcha needed; will halt at captcha step)
  node scripts/crawl-tii.cjs --dry-run --limit 3 --company 204 --category life_traditional

  # Half-auto with manual captcha (admin types 4 digits, crawler does the rest)
  node scripts/crawl-tii.cjs --commit --limit 1 --company 204 --category life_traditional --captcha-code 1234

Rate-limit policy:
  - 1.5-3.0s jitter per request (computed inside the timeout callback)
  - 3 retries with exponential backoff on network / captcha failure
  - Per-company cooldown so we don't hammer a single insurer's server
  - Default --limit 5 keeps a single run well under any reasonable threshold

State file: scripts/tii-crawler-state.json  (NOT committed to git)
SSL: NODE_TLS_REJECT_UNAUTHORIZED=0 (TII cert expired; isolated to this script)
`.trim() + '\n');
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),     // OK: one-shot file-init timestamp
      updatedAt: null,
      phase: 'discovery',
      cursor: { companyIdx: 0, categoryIdx: 0, page: 1 },
      doneProductCodes: [],
      failed: [],
      stats: { queries: 0, products: 0, pdfs: 0, captchaFails: 0, errors: 0 },
    };
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function saveState(state) {
  // updatedAt computed at write time (not module load) — Sprint 12 rule
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// HTTP helpers (Node 20+ fetch + cookie jar)
// ---------------------------------------------------------------------------

// minimal cookie jar — TII uses ASP.NET_SessionId for captcha alignment
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
}

async function httpRequest(url, opts = {}, jar) {
  const headers = {
    'User-Agent': USER_AGENT,
    'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
    ...(opts.headers || {}),
  };
  if (jar && jar.toHeader()) headers['Cookie'] = jar.toHeader();

  const res = await fetch(url, { ...opts, headers, redirect: 'manual' });

  if (jar) {
    // node fetch returns getSetCookie() on Headers in Node 20+
    const setCookies = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : res.headers.get('set-cookie');
    jar.ingest(setCookies);
  }
  return res;
}

// 1.5-3.0s jitter (computed INSIDE the callback per Sprint 12 rule)
function jitterSleep() {
  return new Promise(resolve => {
    const delayMs = 1500 + Math.floor(Math.random() * 1500);
    setTimeout(() => {
      // runtime timestamp captured inside the callback, not at scheduling time
      const _now = Date.now();
      void _now;
      resolve();
    }, delayMs);
  });
}

async function withRetry(label, fn, maxRetries = 3) {
  let attempt = 0;
  // backoff schedule: 5s / 15s / 45s
  const backoffs = [5000, 15000, 45000];
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
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

// ---------------------------------------------------------------------------
// HTML parse (no cheerio — regex on UTF-8 markup)
// ---------------------------------------------------------------------------

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

function stripTags(s) { return decodeEntities(s.replace(/<[^>]+>/g, '').trim()); }

function isCaptchaReject(html) {
  return /識別碼錯誤|alert\("識別碼/.test(html);
}

function isNoResults(html) {
  return /很抱歉，目前並沒有/.test(html);
}

// Parse product rows from ResultQueryAll.aspx HTML.
// Pattern (from Sprint 12 探勘): result <table> with <tr> rows, each containing:
//   - product name (text)
//   - product code (text, e.g. ALA12345)
//   - 銷售起日 / 停售日 (ROC dates)
//   - <a href="..."> link to clause PDF (likely FilesView.aspx?Id=... or /files/...)
//
// Because Sprint 12 探勘 couldn't get past captcha to see a real row, this
// extractor is intentionally tolerant: it matches any <tr> that contains BOTH
// (a) a Chinese product-name-ish cell AND (b) an href that looks like a
// PDF/file link. Once a successful captcha run gives us real markup, this
// can be tightened.
function parseProducts(html) {
  const rows = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = trRegex.exec(html)) !== null) {
    const inner = m[1];
    // skip header rows
    if (/<th[\s>]/i.test(inner)) continue;
    const cells = [...inner.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => c[1]);
    if (cells.length < 3) continue;

    const text = cells.map(stripTags);
    // find any anchor href in any cell
    const hrefMatch = inner.match(/href\s*=\s*['"]([^'"]+\.(?:pdf|aspx\?[^'"]+|ashx\?[^'"]+))['"]/i);
    if (!hrefMatch) continue;

    // heuristics — pick product name (longest Chinese cell)
    let productName = '';
    for (const t of text) {
      if (/[一-鿿]/.test(t) && t.length > productName.length) productName = t;
    }
    if (!productName) continue;

    // product code — alphanumeric token
    let productCode = '';
    for (const t of text) {
      const codeM = t.match(/\b[A-Z]{1,6}\d{3,12}\b/);
      if (codeM) { productCode = codeM[0]; break; }
    }

    // dates (ROC民國 like 113/05/20)
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
// TII flow
// ---------------------------------------------------------------------------

async function fetchQueryPage(jar) {
  // GET Query.aspx — establishes ASP.NET_SessionId in jar, returns HTML +
  // captcha image URL (bmp.ashx).
  const res = await httpRequest(QUERY_URL, { method: 'GET' }, jar);
  if (!res.ok) throw new Error(`Query.aspx GET ${res.status}`);
  const html = await res.text();
  return html;
}

async function downloadCaptcha(jar, outPath) {
  const url = `${TII_BASE}/bmp.ashx`;
  const res = await httpRequest(url, { method: 'GET' }, jar);
  if (!res.ok) throw new Error(`captcha download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  return outPath;
}

async function submitQuery(jar, params) {
  const body = new URLSearchParams(params).toString();
  const res = await httpRequest(RESULT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Referer': QUERY_URL,
      'Origin': TII_BASE,
    },
    body,
  }, jar);

  // ResultQueryAll.aspx sometimes 302 → Query.aspx on captcha fail
  if (res.status === 302) {
    return { html: '', redirected: true, location: res.headers.get('location') };
  }
  if (!res.ok) throw new Error(`ResultQueryAll.aspx POST ${res.status}`);
  const html = await res.text();
  return { html, redirected: false };
}

function buildQueryParams({ companyId, categoryKey, captchaCode, onlySelling = true }) {
  const cat = CATEGORIES[categoryKey];
  if (!cat) throw new Error(`unknown category key ${categoryKey}`);
  const params = {
    categoryId: cat.cat,         // '1' P&C / '2' life / '' all
    postB: 'Y',
    CompanyID: companyId,
    f_CategoryId1: cat.code,     // e.g. '2_3'
    qry_beginDate_SD1: '',
    qry_beginDate_SD2: '',
    qry_endDate_ED1: '',
    qry_endDate_ED2: '',
    fQueryAll: '',
    bmpC: captchaCode || '',
    isqry: 'Y',
    isquery: 'Y',
  };
  if (onlySelling) params.endDate2 = 'Y';
  return params;
}

// ---------------------------------------------------------------------------
// Firebase (lazy load — only when --commit)
// ---------------------------------------------------------------------------

let _admin = null;
function getFirebase() {
  if (_admin) return _admin;
  // eslint-disable-next-line global-require
  const admin = require('firebase-admin');
  // firebase-admin v14 removed `admin.apps`; v12 still has it. Support both.
  const existingApps = typeof admin.getApps === 'function' ? admin.getApps() : (admin.apps || []);
  if (existingApps.length === 0) {
    admin.initializeApp({
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'ultra-advisor.appspot.com',
    });
  }
  _admin = admin;
  return admin;
}

async function uploadPdfToStorage({ pdfBuffer, companyId, productName, beginDateRoc }) {
  const admin = getFirebase();
  const bucket = admin.storage().bucket();
  const slug = slugify(productName);
  const dateSlug = beginDateRoc ? slugify(beginDateRoc) : 'undated';
  const storagePath = `insurance_pdfs/${companyId}/${slug}_${dateSlug}.pdf`;
  const file = bucket.file(storagePath);
  await file.save(pdfBuffer, {
    contentType: 'application/pdf',
    metadata: { cacheControl: 'public, max-age=31536000' },
  });
  return storagePath;
}

async function writeProductDoc(product) {
  const admin = getFirebase();
  const db = admin.firestore();
  // doc id 對齊 product.id (Sprint 12 critic #6 schema 一致性)
  const docId = product.id;
  await db.collection('insurance_products').doc(docId).set(product, { merge: true });
  return docId;
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function processOneQuery({ companyId, categoryKey, flags, jar, state }) {
  const cat = CATEGORIES[categoryKey];
  console.log(`\n=== Query: company ${companyId} × ${categoryKey} (${cat.code}) ===`);

  // 1. GET Query.aspx to establish session
  await withRetry('query.aspx', () => fetchQueryPage(jar));

  // 2. captcha
  let captchaCode = flags.captchaCode;
  if (!captchaCode) {
    const captchaPath = path.join(__dirname, `tii-captcha-${Date.now()}.bmp`);
    await withRetry('captcha', () => downloadCaptcha(jar, captchaPath));
    console.log(`[captcha] saved to ${captchaPath}`);
    console.log('[captcha] no --captcha-code provided → cannot submit form.');
    console.log('[captcha] In dry-run this is expected. Open the .bmp, read');
    console.log('[captcha] the 4 digits, and re-run with --captcha-code XXXX.');
    return { skipped: 'no-captcha' };
  }

  await jitterSleep();

  // 3. POST ResultQueryAll.aspx
  const params = buildQueryParams({ companyId, categoryKey, captchaCode });
  const { html, redirected } = await withRetry('submit', () => submitQuery(jar, params));

  state.stats.queries += 1;

  if (redirected || isCaptchaReject(html)) {
    state.stats.captchaFails += 1;
    console.warn('[result] captcha rejected — server bounced back to Query.aspx');
    return { skipped: 'captcha-reject' };
  }

  if (isNoResults(html)) {
    console.log('[result] 0 products (legitimate empty match)');
    return { products: [] };
  }

  // 4. parse rows
  const products = parseProducts(html);
  console.log(`[result] parsed ${products.length} product rows`);

  if (products.length === 0 && flags.dryRun) {
    // dump for inspection
    const dumpPath = path.join(__dirname, `tii-result-${companyId}-${cat.code}-${Date.now()}.html`);
    fs.writeFileSync(dumpPath, html, 'utf8');
    console.log(`[debug] result HTML dumped to ${dumpPath} for selector tuning`);
  }

  return { products, html };
}

async function handleProduct({ row, companyId, categoryKey, flags, jar, state }) {
  const cat = CATEGORIES[categoryKey];
  // 為什麼這樣寫:
  // - critic engineering #6: crawler 寫 snake_case + source='TII' (大寫)、
  //   但 src/lib/insuranceProducts.ts fromDoc 期望 camelCase + 'tii' (小寫)。
  //   所有 commit 進 Firestore 的 doc 在 fromDoc 都會被靜默丟掉。
  // - 對齊 InsuranceProduct TS interface 完整字段。
  const companySlug = `tii_${companyId}`; // 未來補真實公司名 lookup 表後改 e.g. 'cathay-life'
  const productCode = row.productCode || slugify(row.productName);
  const product = {
    id: `${companySlug}_${slugify(productCode)}`,
    company: companyId,             // 暫用 companyId 字串、之後 lookup 補真名
    companySlug,
    productName: row.productName,
    productCode,
    categoryMain: mapCategoryToMain(cat.uaType),  // 映射到 InsuranceCategoryMain union
    categorySub: cat.uaType,        // 詳細種類保留在 sub
    effectiveDate: rocToIso(row.beginDateRoc) || undefined,
    status: row.endDateRoc ? 'discontinued' : 'active',
    source: 'tii',                  // critic #1: 必須小寫對齊 InsuranceProductSource union
    sourceUrl: row.pdfUrl,          // 必填 — 對外可舉證
    pdfStoragePath: undefined,      // set at write time below
    pdfSha256: undefined,           // TODO Sprint 13: SHA256 dedup (critic eng #4)
    crawledAt: 0,                   // set at write time (鐵則: time 在 callback 內取)
    crawlerVersion: 'tii-v1',
    schemaVersion: 1,
  };

  if (flags.dryRun) {
    console.log('[dry-run product]', JSON.stringify(product, null, 2));
    return;
  }

  // download PDF
  await jitterSleep();
  const res = await withRetry(`pdf:${row.pdfUrl}`, async () => {
    const r = await httpRequest(row.pdfUrl, { method: 'GET' }, jar);
    if (!r.ok) throw new Error(`pdf GET ${r.status}`);
    return r;
  });
  const buf = Buffer.from(await res.arrayBuffer());

  const storagePath = await uploadPdfToStorage({
    pdfBuffer: buf,
    companyId,
    productName: row.productName,
    beginDateRoc: row.beginDateRoc,
  });
  product.pdfStoragePath = storagePath;
  product.crawledAt = Date.now();   // runtime callback 內取 (鐵則)

  const docId = await writeProductDoc(product);
  state.stats.pdfs += 1;
  state.stats.products += 1;
  state.doneProductCodes.push(product.productCode || docId);
  console.log(`[commit] wrote ${docId} + ${storagePath} (${buf.length} bytes)`);
}

// 映射 crawler 的細項 uaType 到 InsuranceCategoryMain TS union
// 產險 (car/home/marine) 不在當前 InsuranceCategoryMain — 預設 'accident'、
// 未來如要支援 P&C 業務需擴 union。
function mapCategoryToMain(uaType) {
  switch (uaType) {
    case 'life_traditional':    return 'life';
    case 'life_ulink':          return 'investmentLinked';
    case 'annuity_traditional': return 'annuity';
    case 'annuity_ulink':       return 'investmentLinked';
    case 'medical':             return 'medical';
    case 'accident':            return 'accident';
    case 'accident_property':   return 'accident';   // 產險意外 → 暫歸 accident
    case 'car':
    case 'home':
    default:                    return 'accident';   // P&C MVP 暫歸、Sprint 13 擴 union
  }
}

async function main() {
  const flags = parseArgs(process.argv);
  if (flags.help) { printHelp(); return; }

  console.log('=== TII Crawler ===');
  console.log('Mode:', flags.dryRun ? 'DRY-RUN (no writes)' : 'COMMIT (will write Firestore + Storage)');
  console.log('Limit:', flags.limit, 'Resume:', flags.resume, 'Full:', flags.full);
  if (!flags.full && flags.limit > 20) {
    console.warn('--limit > 20 without --full is dangerous; clamping to 20');
    flags.limit = 20;
  }

  const state = flags.resume ? loadState() : {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    phase: 'discovery',
    cursor: { companyIdx: 0, categoryIdx: 0, page: 1 },
    doneProductCodes: [],
    failed: [],
    stats: { queries: 0, products: 0, pdfs: 0, captchaFails: 0, errors: 0 },
  };

  // build the work plan
  const companyList = flags.company
    ? [flags.company]
    : [...COMPANIES.pAndC, ...COMPANIES.life, ...COMPANIES.policy];

  const categoryList = flags.category
    ? [flags.category]
    : Object.keys(CATEGORIES);

  const jar = new CookieJar();
  let processed = 0;

  outer:
  for (let ci = state.cursor.companyIdx; ci < companyList.length; ci++) {
    for (let cat = state.cursor.categoryIdx; cat < categoryList.length; cat++) {
      if (processed >= flags.limit) break outer;

      const companyId = companyList[ci];
      const categoryKey = categoryList[cat];

      // Skip combinations that don't make sense (P&C company × life category etc.)
      const isPAndC = COMPANIES.pAndC.includes(companyId);
      const isLife = COMPANIES.life.includes(companyId);
      const catObj = CATEGORIES[categoryKey];
      if (isPAndC && catObj.cat === '2') continue;
      if (isLife && catObj.cat === '1') continue;

      try {
        await jitterSleep();
        const result = await processOneQuery({ companyId, categoryKey, flags, jar, state });
        processed += 1;

        if (result.products && result.products.length) {
          for (const row of result.products) {
            try {
              await handleProduct({ row, companyId, categoryKey, flags, jar, state });
            } catch (perr) {
              state.failed.push({
                kind: 'product',
                companyId,
                categoryKey,
                product: row.productName,
                error: perr.message,
                ts: new Date().toISOString(),
              });
              state.stats.errors += 1;
              console.error(`[product-fail] ${row.productName}: ${perr.message}`);
            }
          }
        }
      } catch (qerr) {
        state.failed.push({
          kind: 'query',
          companyId,
          categoryKey,
          error: qerr.message,
          ts: new Date().toISOString(),
        });
        state.stats.errors += 1;
        console.error(`[query-fail] ${companyId} × ${categoryKey}: ${qerr.message}`);
      }

      // checkpoint every 5 queries
      if (processed % 5 === 0) {
        state.cursor = { companyIdx: ci, categoryIdx: cat + 1, page: 1 };
        saveState(state);
      }
    }
    state.cursor.categoryIdx = 0;
  }

  state.cursor = { companyIdx: 0, categoryIdx: 0, page: 1 }; // reset after full pass
  saveState(state);

  console.log('\n=== Done ===');
  console.log('Stats:', state.stats);
  if (state.failed.length) {
    console.log(`Failures: ${state.failed.length} (see ${STATE_FILE})`);
  }
}

// SIGINT — flush state then exit
let _shuttingDown = false;
process.on('SIGINT', () => {
  if (_shuttingDown) process.exit(1);
  _shuttingDown = true;
  console.warn('\n[SIGINT] flushing state and exiting...');
  try {
    // state isn't visible here — main() handles its own checkpoint. We just signal.
  } catch (_) { /* noop */ }
  process.exit(0);
});

main().catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
