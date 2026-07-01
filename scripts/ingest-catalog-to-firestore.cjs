#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * ingest-catalog-to-firestore.cjs
 * Sprint 13 / Task B
 *
 * 把 scripts/ua-insurance-catalog.json (Task A 解析輸出) 灌進 Firestore
 * `insurance_products` collection，對齊 src/lib/insuranceProducts.ts 的
 * `InsuranceProduct` interface。
 *
 * 戰略邊界 (HARD RULES — 對齊 Sprint 13 規格):
 *   - source 固定 'tii' (closed union 不接受其他值；任何 'cloudwinner' /
 *     '保險贏家' 字串都絕對不輸出到 Firestore / log)
 *   - 絕不上傳 PDF 到 Firebase Storage、絕不寫 pdfStoragePath / pdfSha256
 *   - sourceUrl 走 TII 公開查詢 pattern (insprod.tii.org.tw)、不存
 *     Azure SAS expired link
 *   - detail_info.intrude / premiums / *_markdown 來源 dump 即使有也絕不
 *     進 Firestore (Task A 解析時已剔除；本 script 再做一層 schema 白名單)
 *   - crawledAt 在 per-record loop 內取 runtime (Sprint 12 codec convention)
 *
 * CLI:
 *   node scripts/ingest-catalog-to-firestore.cjs
 *     [--input scripts/ua-insurance-catalog.json]
 *     [--dry-run]                # default: dry-run
 *     [--commit]                 # 真的寫 Firestore (要 GOOGLE_APPLICATION_CREDENTIALS)
 *     [--limit N]                # 只灌前 N 筆 (測試)
 *     [--resume-from <id>]       # 從某 doc id (字典序) 開始續傳
 *     [--batch-size N]           # 預設 100，Firestore batch upper bound 是 500
 *     [--crawler-version <str>]  # 預設 'catalog-ingest-v1'
 *
 * 範例:
 *   # dry-run、印前 5 筆 + summary、不寫 Firestore
 *   node scripts/ingest-catalog-to-firestore.cjs --limit 5
 *
 *   # 真正灌 (production)
 *   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\sa.json
 *   node scripts/ingest-catalog-to-firestore.cjs --commit
 *
 *   # 上次 batch 在 tii_sk_dollarsign 卡掉、續傳
 *   node scripts/ingest-catalog-to-firestore.cjs --commit --resume-from tii_sk_dollarsign
 *
 * 鐵則:
 *   - 不引入新 npm 依賴 (用 functions/node_modules/firebase-admin)
 *   - --dry-run 為預設、--commit 才真寫
 *   - 失敗 doc 寫進 scripts/ingest-failed.json、不 throw 整個 batch
 *   - 顧問端 UI 只能引導去 TII 下載；不存 host 過的 PDF 連結
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Constants — 對齊 src/lib/insuranceProducts.ts 的 closed unions
// ---------------------------------------------------------------------------

const COLLECTION = 'insurance_products';
const DEFAULT_INPUT = path.resolve(__dirname, 'ua-insurance-catalog.json');
const FAIL_LOG = path.resolve(__dirname, 'ingest-failed.json');
const CRAWLER_VERSION_DEFAULT = 'catalog-ingest-v1';
const SCHEMA_VERSION = 1;
const DEFAULT_BATCH_SIZE = 100;

// 對齊 InsuranceCategoryMain (8 buckets) — type-system closed union
const VALID_CATEGORIES = new Set([
  'life',
  'medical',
  'critical',
  'accident',
  'disability',
  'longTermCare',
  'annuity',
  'investmentLinked',
]);

// 對齊 ProductStatus
const VALID_STATUS = new Set(['active', 'discontinued', 'revised']);

// 對齊 InsuranceProductSource — 唯一允許值
const FIXED_SOURCE = 'tii';

// TII 公開查詢入口；無公開穩定 deep-link、用 search pattern + fallback
const TII_BASE = 'https://insprod.tii.org.tw';
const TII_SEARCH = `${TII_BASE}/Query.aspx`;

// 嚴禁字串 — 任何包含這些 substring 的欄位值都會被當成洩漏、整筆 reject
const FORBIDDEN_SUBSTRINGS = [
  'cloudwinner',
  'CloudWinner',
  '保險贏家',
  '昇華科技',
  'insurance_winner',
  'insuranceWinner',
];

// 白名單欄位 — 只有這些 key 會被 set 到 Firestore (擋掉任何 detail_info/markdown
// 殘留欄位、即使 Task A parser 不小心放進來)
const WRITE_WHITELIST = new Set([
  'id',
  'company',
  'companySlug',
  'productName',
  'productCode',
  'categoryMain',
  'categorySub',
  'effectiveDate',
  'status',
  'source',
  'sourceUrl',
  // NOTE: pdfStoragePath / pdfSha256 故意省略 — Sprint 13 鐵則：不 host PDF
  'crawledAt',
  'crawlerVersion',
  'schemaVersion',
]);

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    dryRun: true,       // 預設 dry-run
    commit: false,
    limit: null,
    resumeFrom: null,
    batchSize: DEFAULT_BATCH_SIZE,
    crawlerVersion: CRAWLER_VERSION_DEFAULT,
    help: false,
  };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--input') { args.input = path.resolve(rest[++i]); continue; }
    if (a === '--dry-run') { args.dryRun = true; args.commit = false; continue; }
    if (a === '--commit') { args.commit = true; args.dryRun = false; continue; }
    if (a === '--limit') { args.limit = Number(rest[++i]); continue; }
    if (a === '--resume-from') { args.resumeFrom = rest[++i]; continue; }
    if (a === '--batch-size') { args.batchSize = Math.max(1, Math.min(500, Number(rest[++i]) || DEFAULT_BATCH_SIZE)); continue; }
    if (a === '--crawler-version') { args.crawlerVersion = rest[++i]; continue; }
    if (a === '-h' || a === '--help') { args.help = true; continue; }
  }
  // NODE_ENV=test 預設 dry-run 已經是 default、無需特別處理；
  // 但若 commit 同時 NODE_ENV=test，警告 (不阻擋；CI 場景可能想實際 hit emulator)
  if (args.commit && process.env.NODE_ENV === 'test') {
    process.stderr.write('warn: --commit with NODE_ENV=test — proceeding (emulator?)\n');
  }
  return args;
}

function printHelp() {
  process.stdout.write(`
ingest-catalog-to-firestore.cjs — 灌 UA insurance catalog 進 Firestore (source='tii')

Usage:
  node scripts/ingest-catalog-to-firestore.cjs [options]

Options:
  --input <path>            input JSON (default: scripts/ua-insurance-catalog.json)
  --dry-run                 (default) 印行為 + 前 5 筆 sample、不寫 Firestore
  --commit                  真的寫 (需 GOOGLE_APPLICATION_CREDENTIALS env)
  --limit <N>               只灌前 N 筆 (測試用)
  --resume-from <docId>     從某 doc id (字典序) 開始續傳
  --batch-size <N>          每批寫入大小 (default 100, max 500)
  --crawler-version <str>   寫入 doc 的 crawlerVersion 欄位 (default 'catalog-ingest-v1')
  -h, --help                show this

`);
}

// ---------------------------------------------------------------------------
// Validators — 把 Task A entry 轉成 InsuranceProduct doc
// ---------------------------------------------------------------------------

/** sourceUrl 建構 — 用 TII 公開 search pattern。
 *  TII 沒有公開穩定的 product deep-link、Query.aspx 是搜尋表單需 captcha；
 *  我們存的是「給顧問點過去」的 landing page，UI 端會顯示「條款請至 TII 查詢」。
 *  為了 schema 不擋 (sourceUrl 是 required)、用 query string 帶 hint。
 */
function buildSourceUrl(entry) {
  // 容錯：companyNo 可能是 'KT' (字母代碼) 也可能是 TII 的數字代碼 ('204')
  const companyHint = entry.companyNo || entry.companySlug || '';
  const productHint = entry.productCode || entry.mark || '';
  if (companyHint && productHint) {
    // 用 URL encode 把中文/特殊字元安全帶進去
    const params = new URLSearchParams({
      company: String(companyHint),
      product: String(productHint),
    });
    return `${TII_SEARCH}?${params.toString()}`;
  }
  // 完全沒 hint、回 TII 首頁 (UI 文案：「請至 TII 保發中心查詢」)
  return TII_BASE + '/';
}

/** 檢查任何字串欄位是否含禁字 (保險贏家 / cloudwinner / 昇華科技)。
 *  整個 entry 一律掃過、命中就 reject。
 */
function containsForbidden(value) {
  if (value == null) return false;
  if (typeof value !== 'string') return false;
  for (const banned of FORBIDDEN_SUBSTRINGS) {
    if (value.includes(banned)) return banned;
  }
  return false;
}

function scanEntryForForbidden(entry) {
  for (const [k, v] of Object.entries(entry || {})) {
    if (typeof v === 'string') {
      const hit = containsForbidden(v);
      if (hit) return { field: k, value: v.slice(0, 80), banned: hit };
    }
  }
  return null;
}

/** 從 Task A entry → Firestore doc payload。
 *  失敗 (schema 違規 / 禁字) 回 { ok:false, reason }。
 *  注意：crawledAt 不在這設 — 留到 ingest loop 內 callback runtime 取。
 */
function buildDoc(entry, crawlerVersion) {
  if (!entry || typeof entry !== 'object') {
    return { ok: false, reason: 'entry not an object' };
  }

  // 禁字檢查 (放最前 — 一旦命中、整筆 reject、不進 sanitization)
  const forbidden = scanEntryForForbidden(entry);
  if (forbidden) {
    return { ok: false, reason: `forbidden substring "${forbidden.banned}" in field "${forbidden.field}"` };
  }

  // 必要欄位
  const id = entry.id || entry._docId || null;
  const company = entry.company || null;
  const companySlug = entry.companySlug || null;
  const productName = entry.productName || entry.name || entry.insName || null;
  const productCode = entry.productCode || entry.mark || null;

  if (!id) return { ok: false, reason: 'missing id (expect tii_{companyNo}_{slug(mark)})' };
  if (!company) return { ok: false, reason: 'missing company' };
  if (!companySlug) return { ok: false, reason: 'missing companySlug' };
  if (!productName) return { ok: false, reason: 'missing productName' };
  if (!productCode) return { ok: false, reason: 'missing productCode' };

  // categoryMain — 必須在 8-bucket closed union；endorsement / riderWaiver / 不認得
  // 一律 skip (Sprint 13 規格：endorsement 走 research-only、不灌 production)
  const cat = entry.categoryMain;
  if (!cat || !VALID_CATEGORIES.has(cat)) {
    return { ok: false, reason: `categoryMain "${cat}" not in 8-bucket union (skip — research only)` };
  }

  // _research_only flag — Task A parser 標的、絕不灌 production
  if (entry._research_only === true) {
    return { ok: false, reason: '_research_only=true → skip (research only)' };
  }

  // status — 預設 active；接受 closed union
  let status = entry.status || 'active';
  if (!VALID_STATUS.has(status)) {
    // 中文 status (e.g. '販售中') → 映射
    if (status === '販售中') status = 'active';
    else if (status === '已停售') status = 'discontinued';
    else if (status === '改版') status = 'revised';
    else status = 'active';
  }

  // effectiveDate — yyyy-mm-dd or null
  const effectiveDate = entry.effectiveDate || entry.startDate || null;

  // sourceUrl — Sprint 12 type 規定 required；用 TII pattern
  const sourceUrl = buildSourceUrl(entry);

  // categorySub — 自由字串、若有就帶 (Task A 可能放 keyword 字串或 dispClass)
  const categorySub = (typeof entry.categorySub === 'string' && entry.categorySub)
    ? entry.categorySub
    : null;

  // 組 doc — 全白名單；任何不在 WRITE_WHITELIST 的欄位都不會出去
  const doc = {
    id,
    company,
    companySlug,
    productName,
    productCode,
    categoryMain: cat,
    status,
    source: FIXED_SOURCE,  // 永遠 'tii' — 絕不接受 entry.source override
    sourceUrl,
    crawlerVersion,
    schemaVersion: SCHEMA_VERSION,
    // crawledAt 留空 — caller (ingest loop) 在 per-record callback runtime 取
  };
  if (effectiveDate) doc.effectiveDate = effectiveDate;
  if (categorySub) doc.categorySub = categorySub;

  // 最後一道：移除 undefined + 確保沒漏白名單
  for (const k of Object.keys(doc)) {
    if (doc[k] === undefined) delete doc[k];
    if (!WRITE_WHITELIST.has(k)) delete doc[k];
  }

  return { ok: true, doc };
}

// ---------------------------------------------------------------------------
// Firebase admin lazy-init
// ---------------------------------------------------------------------------

let _admin = null;
function getFirebase() {
  if (_admin) return _admin;
  // 用 functions/node_modules/firebase-admin (Sprint 12 鐵則：不引入新依賴)
  let admin;
  try {
    admin = require('firebase-admin');
  } catch (e) {
    // fallback：從 functions/ resolve
    const resolved = require.resolve('firebase-admin', {
      paths: [path.resolve(__dirname, '..', 'functions', 'node_modules')],
    });
    admin = require(resolved);
  }
  // firebase-admin v14 removed `admin.apps`; v12 still has it. Support both.
  const existingApps = typeof admin.getApps === 'function' ? admin.getApps() : (admin.apps || []);
  if (existingApps.length === 0) {
    admin.initializeApp({
      // storageBucket 故意不設 — Sprint 13 不 host PDF、不會用到 Storage
    });
  }
  _admin = admin;
  return admin;
}

// ---------------------------------------------------------------------------
// Ingest pipeline
// ---------------------------------------------------------------------------

function loadCatalog(inputPath) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`input not found: ${inputPath}`);
  }
  const raw = fs.readFileSync(inputPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return { entries: parsed, meta: {} };
  if (Array.isArray(parsed.entries)) {
    return { entries: parsed.entries, meta: {
      schemaVersion: parsed.schemaVersion,
      generatedAt: parsed.generatedAt,
      source: parsed.source,
    } };
  }
  // Sprint 13 ship critic — parse-insurance-database.cjs writes `products`
  // (semantically clearer than `entries` in that context). Accept here so
  // both legacy `entries` shape and Sprint 13 `products` shape feed in.
  if (Array.isArray(parsed.products)) {
    return { entries: parsed.products, meta: {
      schemaVersion: parsed.version,
      generatedAt: parsed.generatedAt,
      source: parsed.source,
    } };
  }
  throw new Error('catalog JSON top-level must be array or { entries: [...] } or { products: [...] }');
}

/** Filter + sort + slice — apply --resume-from + --limit. */
function selectEntries(entries, opts) {
  // sort by id 字典序 — 讓 --resume-from 行為 deterministic
  const withId = entries.filter((e) => e && (e.id || e._docId));
  withId.sort((a, b) => String(a.id || a._docId).localeCompare(String(b.id || b._docId)));
  let filtered = withId;
  if (opts.resumeFrom) {
    filtered = filtered.filter((e) => String(e.id || e._docId) >= opts.resumeFrom);
  }
  if (opts.limit && opts.limit > 0) {
    filtered = filtered.slice(0, opts.limit);
  }
  return filtered;
}

/** 寫一批 — 每 batchSize 筆走 admin.firestore().batch() 一次 commit。
 *  失敗時 fallback 到逐筆 set(...).catch 記 fail log、不 throw。
 */
async function writeBatch(admin, db, slice, dryRun, getNow, summary, failed) {
  if (dryRun) {
    for (const item of slice) {
      const docWithTime = { ...item.doc, crawledAt: getNow() };
      summary.wouldWrite += 1;
      summary.byCompany[docWithTime.companySlug] = (summary.byCompany[docWithTime.companySlug] || 0) + 1;
      summary.byCategory[docWithTime.categoryMain] = (summary.byCategory[docWithTime.categoryMain] || 0) + 1;
    }
    return;
  }

  // 真寫：用 WriteBatch
  const batch = db.batch();
  const stamped = slice.map((item) => ({
    id: item.doc.id,
    doc: { ...item.doc, crawledAt: getNow() },
  }));
  for (const s of stamped) {
    const ref = db.collection(COLLECTION).doc(s.id);
    batch.set(ref, s.doc, { merge: true });
  }
  try {
    await batch.commit();
    for (const s of stamped) {
      summary.wrote += 1;
      summary.byCompany[s.doc.companySlug] = (summary.byCompany[s.doc.companySlug] || 0) + 1;
      summary.byCategory[s.doc.categoryMain] = (summary.byCategory[s.doc.categoryMain] || 0) + 1;
    }
  } catch (batchErr) {
    process.stderr.write(`warn: batch commit failed (${batchErr.message}) — falling back to per-doc set\n`);
    for (const s of stamped) {
      try {
        await db.collection(COLLECTION).doc(s.id).set(s.doc, { merge: true });
        summary.wrote += 1;
        summary.byCompany[s.doc.companySlug] = (summary.byCompany[s.doc.companySlug] || 0) + 1;
        summary.byCategory[s.doc.categoryMain] = (summary.byCategory[s.doc.categoryMain] || 0) + 1;
      } catch (docErr) {
        failed.push({ id: s.id, reason: `firestore set failed: ${docErr.message}` });
      }
    }
  }
}

async function runIngest(args) {
  const startedAt = new Date().toISOString();
  process.stdout.write(`ingest start: input=${args.input} dryRun=${args.dryRun} commit=${args.commit}\n`);

  const { entries, meta } = loadCatalog(args.input);
  process.stdout.write(`loaded ${entries.length} entries (catalog generatedAt=${meta.generatedAt || 'n/a'})\n`);

  const selected = selectEntries(entries, args);
  process.stdout.write(`selected ${selected.length} entries after --resume-from/--limit filter\n`);

  // Validate + build doc
  const valid = [];
  const skipped = [];
  for (const entry of selected) {
    const r = buildDoc(entry, args.crawlerVersion);
    if (r.ok) valid.push({ doc: r.doc });
    else skipped.push({ id: entry.id || entry._docId || '(no-id)', reason: r.reason });
  }
  process.stdout.write(`validated: ${valid.length} OK, ${skipped.length} skipped (schema / forbidden / research-only)\n`);

  // Dry-run sample print (前 5 筆)
  if (args.dryRun) {
    const sample = valid.slice(0, 5).map((v) => ({
      ...v.doc,
      crawledAt: '<runtime>',
    }));
    process.stdout.write('[dry-run] sample (first 5 docs that WOULD be written):\n');
    process.stdout.write(JSON.stringify(sample, null, 2) + '\n');
    if (skipped.length) {
      process.stdout.write(`[dry-run] skipped reasons (first 5):\n`);
      for (const s of skipped.slice(0, 5)) {
        process.stdout.write(`  ${s.id}: ${s.reason}\n`);
      }
    }
  }

  // Real write path
  let admin = null;
  let db = null;
  if (!args.dryRun) {
    admin = getFirebase();
    db = admin.firestore();
  }

  const summary = {
    total: valid.length,
    wouldWrite: 0,
    wrote: 0,
    byCompany: {},
    byCategory: {},
    skipped: skipped.length,
    startedAt,
  };
  const failed = [];

  // 50/batch is conservative (Firestore hard cap = 500); 100 is the sweet spot.
  for (let i = 0; i < valid.length; i += args.batchSize) {
    const slice = valid.slice(i, i + args.batchSize);
    const getNow = () => Date.now();  // runtime callback (Sprint 7/12 規)
    await writeBatch(admin, db, slice, args.dryRun, getNow, summary, failed);
    if ((i / args.batchSize) % 1 === 0) {
      const done = Math.min(i + args.batchSize, valid.length);
      process.stdout.write(`progress: ${done}/${valid.length} (${(done * 100 / valid.length).toFixed(1)}%)\n`);
    }
  }

  // Fail log
  if (failed.length) {
    fs.writeFileSync(FAIL_LOG, JSON.stringify({
      runStartedAt: startedAt,
      runFinishedAt: new Date().toISOString(),
      input: args.input,
      failed,
    }, null, 2), 'utf8');
    process.stderr.write(`wrote fail log: ${FAIL_LOG} (${failed.length} failures)\n`);
  }

  // Summary report
  process.stdout.write('\n=== ingest summary ===\n');
  process.stdout.write(`mode:           ${args.dryRun ? 'DRY-RUN' : 'COMMIT'}\n`);
  process.stdout.write(`input:          ${args.input}\n`);
  process.stdout.write(`total valid:    ${summary.total}\n`);
  process.stdout.write(`would write:    ${summary.wouldWrite}\n`);
  process.stdout.write(`wrote:          ${summary.wrote}\n`);
  process.stdout.write(`skipped:        ${summary.skipped}\n`);
  process.stdout.write(`failed:         ${failed.length}\n`);
  const topCompanies = Object.entries(summary.byCompany).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (topCompanies.length) {
    process.stdout.write('top 10 companies:\n');
    for (const [c, n] of topCompanies) process.stdout.write(`  ${String(n).padStart(5)}  ${c}\n`);
  }
  const cats = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]);
  if (cats.length) {
    process.stdout.write('by category:\n');
    for (const [c, n] of cats) process.stdout.write(`  ${String(n).padStart(5)}  ${c}\n`);
  }

  return { summary, failed, skipped };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }

  try {
    await runIngest(args);
  } catch (err) {
    process.stderr.write(`error: ingest failed — ${err.message}\n`);
    if (err.stack) process.stderr.write(err.stack + '\n');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  buildDoc,
  buildSourceUrl,
  containsForbidden,
  scanEntryForForbidden,
  selectEntries,
  loadCatalog,
  VALID_CATEGORIES,
  VALID_STATUS,
  FIXED_SOURCE,
  FORBIDDEN_SUBSTRINGS,
  WRITE_WHITELIST,
};
