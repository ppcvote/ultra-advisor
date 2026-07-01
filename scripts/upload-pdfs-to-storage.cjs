#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * upload-pdfs-to-storage.cjs
 * Sprint 14 / Task B3 (Script 1 of 2)
 *
 * 把 c:/Users/User/insurance-db/research-only/pdfs_full/ 下的 22,239 個
 * {COMPANY}_{CODE}.pdf 上傳到 Firebase Storage (private bucket)，路徑：
 *   insurance-conditions/{productId}/v1.pdf
 *
 * 戰略邊界 (HARD RULES — 對齊 Sprint 14 規格):
 *   - 不引入新 npm 依賴 (用 financial-planner/node_modules/firebase-admin)
 *   - PDFs 保持 PRIVATE — 不設 public read、不打 makePublic()。Sprint 14 W3
 *     的 PDF viewer 會用 signed URL (1-min TTL) 訪問。
 *   - 不對外宣稱資料來源 — metadata.sourceNote 是給 console / audit 看的、
 *     不會出現在任何 user-facing field。
 *   - --dry-run 為預設、--commit 才真上傳 (避免誤觸 22k upload 燒頻寬)
 *   - uploadedAt / sha256 在 per-file callback 內 runtime 取
 *   - Resume-friendly: 已存在且 sha256 相符 → skip
 *
 * CLI:
 *   node scripts/upload-pdfs-to-storage.cjs [options]
 *     --input-dir <path>   Default: c:/Users/User/insurance-db/research-only/pdfs_full
 *     --bucket <name>      Default: <projectId>.appspot.com (從 .firebaserc 讀)
 *     --concurrency <N>    Default: 8
 *     --limit <N>          Sample mode (取前 N 個 .pdf)
 *     --resume             Skip already-uploaded (check via remote metadata)
 *     --dry-run            (default) Print plan only
 *     --commit             Required to actually upload
 *
 * 範例:
 *   # 預設 dry-run、印計畫
 *   node scripts/upload-pdfs-to-storage.cjs --limit 10
 *
 *   # 真上傳 (production)
 *   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\sa.json
 *   node scripts/upload-pdfs-to-storage.cjs --commit --resume
 *
 * State file:
 *   scripts/storage-upload-state.json   每次 run 結束會更新；--resume 會讀。
 *
 * 後續手動指令 (Sprint 14 W3 才用):
 *   gsutil iam ch -u allUsers:objectViewer gs://<bucket>   ← 絕不執行
 */

'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_INPUT_DIR = 'c:/Users/User/insurance-db/research-only/pdfs_full';
const DEFAULT_CONCURRENCY = 8;
const STATE_FILE = path.resolve(__dirname, 'storage-upload-state.json');
const FAIL_LOG = path.resolve(__dirname, 'storage-upload-failed.json');
const STORAGE_PREFIX = 'insurance-conditions';
const VERSION_TAG = '1';
const SOURCE_NOTE = 'TII 法定備查商品條款 v1 snapshot';

// 同 parse-insurance-database.cjs 的 MARK_CHAR_MAP — Sprint 13 B1 已定 schema
// (productId = tii_{companyNo}_{slug(productCode)})
const MARK_CHAR_MAP = {
  '$': 'dollarsign',
  '.': '-dot',
  '/': '-slash',
  '%': '-pct',
  '&': '-amp',
  '@': '-at',
  '!': '-bang',
  '#': '-hash',
  '(': '-lp',
  ')': '-rp',
  '+': '-plus',
  '*': '-star',
  '?': '-q',
  '<': '-lt',
  '>': '-gt',
  '=': '-eq',
  ':': '-col',
  ';': '-sc',
  ',': '-cma',
  '\\': '-bs',
  '|': '-pipe',
  '~': '-tld',
  '^': '-crt',
  '"': '-dq',
  "'": '-sq',
  '`': '-bt',
  '[': '-lb',
  ']': '-rb',
  '{': '-lc',
  '}': '-rc',
};

function slugifyMark(mark) {
  if (!mark || typeof mark !== 'string') return '';
  let out = '';
  for (const ch of mark.toLowerCase()) {
    if (/[a-z0-9\-]/.test(ch)) { out += ch; continue; }
    if (/\s/.test(ch)) { out += '-'; continue; }
    const mapped = MARK_CHAR_MAP[ch];
    if (mapped) { out += mapped; continue; }
  }
  return out.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function buildProductId(companyNo, productCode) {
  const slug = slugifyMark(productCode);
  return `tii_${String(companyNo || 'unknown')}_${slug || 'unknown'}`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    inputDir: DEFAULT_INPUT_DIR,
    bucket: null,
    concurrency: DEFAULT_CONCURRENCY,
    limit: null,
    resume: false,
    dryRun: true,
    commit: false,
    help: false,
  };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--input-dir') { args.inputDir = path.resolve(rest[++i]); continue; }
    if (a === '--bucket') { args.bucket = rest[++i]; continue; }
    if (a === '--concurrency') { args.concurrency = Math.max(1, Math.min(32, Number(rest[++i]) || DEFAULT_CONCURRENCY)); continue; }
    if (a === '--limit') { args.limit = Number(rest[++i]); continue; }
    if (a === '--resume') { args.resume = true; continue; }
    if (a === '--dry-run') { args.dryRun = true; args.commit = false; continue; }
    if (a === '--commit') { args.commit = true; args.dryRun = false; continue; }
    if (a === '-h' || a === '--help') { args.help = true; continue; }
  }
  return args;
}

function printHelp() {
  process.stdout.write(`
upload-pdfs-to-storage.cjs — 上傳 22k 條款 PDF 到 Firebase Storage (private)

Usage:
  node scripts/upload-pdfs-to-storage.cjs [options]

Options:
  --input-dir <path>    PDF 來源資料夾 (default: ${DEFAULT_INPUT_DIR})
  --bucket <name>       Storage bucket (default: 從 .firebaserc 推導)
  --concurrency <N>     並行上傳數 (default: ${DEFAULT_CONCURRENCY}, max: 32)
  --limit <N>           Sample mode — 只跑前 N 個
  --resume              已存在且 sha256 相符 → skip (檢查 remote metadata)
  --dry-run             (default) 印計畫、不上傳
  --commit              真上傳 (需 GOOGLE_APPLICATION_CREDENTIALS env)
  -h, --help            show this

  PDFs 保持 PRIVATE — Sprint 14 W3 PDF viewer 用 signed URL 訪問。
`);
}

// ---------------------------------------------------------------------------
// Firebase admin lazy-init
// ---------------------------------------------------------------------------

let _admin = null;
function getFirebase(bucketName) {
  if (_admin) return _admin;
  let admin;
  try {
    admin = require('firebase-admin');
  } catch (e) {
    const resolved = require.resolve('firebase-admin', {
      paths: [
        path.resolve(__dirname, '..', 'node_modules'),
        path.resolve(__dirname, '..', 'functions', 'node_modules'),
      ],
    });
    admin = require(resolved);
  }
  // firebase-admin v14 removed `admin.apps`; v12 still has it. Support both.
  const existingApps = typeof admin.getApps === 'function' ? admin.getApps() : (admin.apps || []);
  if (existingApps.length === 0) {
    const init = {};
    if (bucketName) init.storageBucket = bucketName;
    admin.initializeApp(init);
  }
  _admin = admin;
  return admin;
}

function deriveBucketName(explicit) {
  if (explicit) return explicit;
  // 從 .firebaserc 推導 → <projectId>.appspot.com
  const rcPath = path.resolve(__dirname, '..', '.firebaserc');
  if (!fs.existsSync(rcPath)) return null;
  try {
    const rc = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
    const projectId = rc?.projects?.default;
    if (!projectId) return null;
    return `${projectId}.appspot.com`;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// State file (resume)
// ---------------------------------------------------------------------------

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { uploaded: {}, lastRun: null };
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    return { uploaded: {}, lastRun: null };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// File parsing
// ---------------------------------------------------------------------------

/** Parse {COMPANY}_{CODE}.pdf → { companyNo, productCode, productId }.
 *  CODE 可能含 `_` (e.g. "204_A1_B2.pdf" → company=204, code=A1_B2).
 *  Strategy: 第一個 `_` 切 companyNo、其餘是 code。
 */
function parsePdfFilename(filename) {
  if (!filename.toLowerCase().endsWith('.pdf')) return null;
  const stem = filename.slice(0, -4);
  const firstUnderscore = stem.indexOf('_');
  if (firstUnderscore < 1) return null;
  const companyNo = stem.slice(0, firstUnderscore);
  const productCode = stem.slice(firstUnderscore + 1);
  if (!companyNo || !productCode) return null;
  const productId = buildProductId(companyNo, productCode);
  return { companyNo, productCode, productId };
}

async function listPdfFiles(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`input-dir not found: ${dir}`);
  }
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const pdfs = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!e.name.toLowerCase().endsWith('.pdf')) continue;
    const parsed = parsePdfFilename(e.name);
    if (!parsed) continue;
    pdfs.push({
      filename: e.name,
      absPath: path.join(dir, e.name),
      ...parsed,
    });
  }
  // deterministic order — productId 字典序
  pdfs.sort((a, b) => a.productId.localeCompare(b.productId));
  return pdfs;
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Upload pipeline
// ---------------------------------------------------------------------------

/** Build metadata payload — runtime now 在 callback 內取 (Sprint 7/12 規)。 */
function buildMetadata(productId, sha256, getNow) {
  return {
    contentType: 'application/pdf',
    metadata: {
      cacheControl: 'private, max-age=3600',
      metadata: {
        productId,
        version: VERSION_TAG,
        sha256,
        uploadedAt: getNow(),
        sourceNote: SOURCE_NOTE,
      },
    },
  };
}

/** Upload single file. 回 { status: 'uploaded' | 'skipped' | 'failed', reason? } */
async function uploadOne(bucket, item, opts, getNow) {
  const storagePath = `${STORAGE_PREFIX}/${item.productId}/v${VERSION_TAG}.pdf`;
  const remoteFile = bucket.file(storagePath);

  // Compute local sha256 — needed regardless (skip check + metadata)
  const localSha = await sha256File(item.absPath);

  if (opts.resume) {
    try {
      const [exists] = await remoteFile.exists();
      if (exists) {
        const [meta] = await remoteFile.getMetadata();
        const remoteSha = meta?.metadata?.sha256;
        if (remoteSha === localSha) {
          return { status: 'skipped', reason: 'already-uploaded (sha match)', storagePath, localSha };
        }
      }
    } catch (e) {
      // exists/getMetadata 失敗就照樣繼續嘗試上傳
    }
  }

  if (opts.dryRun) {
    return {
      status: 'planned',
      storagePath,
      localSha,
      sizeBytes: fs.statSync(item.absPath).size,
    };
  }

  const md = buildMetadata(item.productId, localSha, getNow);

  try {
    await bucket.upload(item.absPath, {
      destination: storagePath,
      resumable: false,         // < 5MB PDFs，simple upload 更快
      validation: 'crc32c',
      metadata: md,
    });
    return { status: 'uploaded', storagePath, localSha };
  } catch (err) {
    return { status: 'failed', reason: err.message, storagePath, localSha };
  }
}

/** Promise-pool with concurrency — 不引入 p-queue / p-limit。 */
async function runPool(items, concurrency, worker, onProgress) {
  const results = new Array(items.length);
  let cursor = 0;
  let done = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      try {
        results[idx] = await worker(items[idx], idx);
      } catch (e) {
        results[idx] = { status: 'failed', reason: e.message };
      }
      done += 1;
      if (onProgress) onProgress(done, items.length);
    }
  });
  await Promise.all(workers);
  return results;
}

async function runUpload(args) {
  const startedAt = new Date().toISOString();
  process.stdout.write(`upload-pdfs start: input=${args.inputDir} dryRun=${args.dryRun} commit=${args.commit}\n`);

  const bucketName = deriveBucketName(args.bucket);
  if (!args.dryRun && !bucketName) {
    throw new Error('cannot derive bucket name from .firebaserc — pass --bucket <name>');
  }
  process.stdout.write(`bucket: ${bucketName || '(dry-run, no bucket needed)'}\n`);

  const pdfs = await listPdfFiles(args.inputDir);
  process.stdout.write(`found ${pdfs.length} PDFs in input-dir\n`);

  let selected = pdfs;
  if (args.limit && args.limit > 0) {
    selected = selected.slice(0, args.limit);
    process.stdout.write(`--limit ${args.limit} → selected ${selected.length}\n`);
  }

  // Local-state resume (cheaper than remote metadata check for huge runs)
  const state = loadState();
  const stateUploaded = state.uploaded || {};
  if (args.resume) {
    const before = selected.length;
    selected = selected.filter((p) => !stateUploaded[p.productId]);
    process.stdout.write(`--resume (local state): skipped ${before - selected.length} via state file → ${selected.length} remain\n`);
  }

  let admin = null;
  let bucket = null;
  if (!args.dryRun) {
    admin = getFirebase(bucketName);
    bucket = admin.storage().bucket();
  }

  const summary = {
    total: selected.length,
    planned: 0,
    uploaded: 0,
    skipped: 0,
    failed: 0,
    bytes: 0,
    startedAt,
  };
  const failed = [];

  const getNow = () => new Date().toISOString();  // runtime callback (Sprint 7/12 規)

  const results = await runPool(
    selected,
    args.concurrency,
    async (item) => uploadOne(bucket, item, { resume: args.resume, dryRun: args.dryRun }, getNow),
    (done, total) => {
      if (done % 50 === 0 || done === total) {
        process.stdout.write(`progress: ${done}/${total} (${(done * 100 / total).toFixed(1)}%)\n`);
      }
    },
  );

  // Tally + state update
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const item = selected[i];
    if (!r) continue;
    if (r.status === 'uploaded') {
      summary.uploaded += 1;
      summary.bytes += (r.sizeBytes || fs.statSync(item.absPath).size);
      stateUploaded[item.productId] = { storagePath: r.storagePath, sha256: r.localSha, at: getNow() };
    } else if (r.status === 'skipped') {
      summary.skipped += 1;
      stateUploaded[item.productId] = stateUploaded[item.productId] || { storagePath: r.storagePath, sha256: r.localSha, at: getNow() };
    } else if (r.status === 'planned') {
      summary.planned += 1;
      summary.bytes += (r.sizeBytes || 0);
    } else if (r.status === 'failed') {
      summary.failed += 1;
      failed.push({ productId: item.productId, filename: item.filename, reason: r.reason });
    }
  }

  // Dry-run sample print (前 5 個 plan)
  if (args.dryRun) {
    const plannedSample = [];
    for (let i = 0; i < Math.min(5, results.length); i++) {
      const r = results[i];
      if (!r) continue;
      plannedSample.push({
        productId: selected[i].productId,
        filename: selected[i].filename,
        storagePath: r.storagePath,
        sizeBytes: r.sizeBytes,
        localSha: r.localSha?.slice(0, 16) + '...',
      });
    }
    process.stdout.write('[dry-run] sample (first 5 planned uploads):\n');
    process.stdout.write(JSON.stringify(plannedSample, null, 2) + '\n');
  }

  // Persist state (resumes for next run)
  if (!args.dryRun) {
    state.uploaded = stateUploaded;
    state.lastRun = { startedAt, finishedAt: getNow(), summary };
    saveState(state);
    process.stdout.write(`state saved: ${STATE_FILE}\n`);
  }

  // Fail log
  if (failed.length) {
    fs.writeFileSync(FAIL_LOG, JSON.stringify({
      runStartedAt: startedAt,
      runFinishedAt: new Date().toISOString(),
      inputDir: args.inputDir,
      failed,
    }, null, 2), 'utf8');
    process.stderr.write(`wrote fail log: ${FAIL_LOG} (${failed.length} failures)\n`);
  }

  // Summary
  process.stdout.write('\n=== upload-pdfs summary ===\n');
  process.stdout.write(`mode:           ${args.dryRun ? 'DRY-RUN' : 'COMMIT'}\n`);
  process.stdout.write(`bucket:         ${bucketName || '(n/a)'}\n`);
  process.stdout.write(`input-dir:      ${args.inputDir}\n`);
  process.stdout.write(`total:          ${summary.total}\n`);
  process.stdout.write(`planned:        ${summary.planned}\n`);
  process.stdout.write(`uploaded:       ${summary.uploaded}\n`);
  process.stdout.write(`skipped:        ${summary.skipped}\n`);
  process.stdout.write(`failed:         ${summary.failed}\n`);
  process.stdout.write(`bytes:          ${(summary.bytes / 1024 / 1024).toFixed(2)} MB\n`);

  return { summary, failed };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }

  try {
    await runUpload(args);
  } catch (err) {
    process.stderr.write(`error: upload failed — ${err.message}\n`);
    if (err.stack) process.stderr.write(err.stack + '\n');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  parsePdfFilename,
  buildProductId,
  slugifyMark,
  deriveBucketName,
  buildMetadata,
  uploadOne,
  runPool,
  listPdfFiles,
  STORAGE_PREFIX,
  VERSION_TAG,
};
