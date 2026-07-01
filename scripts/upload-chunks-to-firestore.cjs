#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * upload-chunks-to-firestore.cjs
 * Sprint 14 / Task B3 (Script 2 of 2)
 *
 * 把 B2 輸出的 embeddings.jsonl (chunk + 768d embedding) 灌進 Firestore 子集合：
 *   insurance_products/{productId}/chunks/{chunkId}
 *
 * 每行 input shape (B2 規範):
 *   {
 *     "productId": "tii_204_xxxxx",
 *     "chunkId":   "c0001",
 *     "text":      "...800 字...",
 *     "sectionHeader": "第 3 條 保險範圍",
 *     "pageNum":   12,
 *     "articleNo": "3",                    // 「第 X 條」的 X，純數字字串
 *     "itemNo":    null,                   // 第 N 款 / 項 (可 null)
 *     "charCount": 800,
 *     "citationLabel": "第 3 條 第 2 款 (p.12)",  // 已預生成 (B2 chunking)
 *     "embedding": [0.012, -0.045, ... 768 floats]
 *   }
 *
 * 戰略邊界 (HARD RULES — 對齊 Sprint 14 規格):
 *   - 不引入新 npm 依賴 (用 financial-planner/node_modules/firebase-admin)
 *   - embedding 寫成 Firestore vector field — admin.firestore.FieldValue.vector(arr)
 *   - 不寫 productVersion 欄位 (Sprint 15 才用、目前所有 chunk 默默是 v1)
 *   - 條款內文 (text) 只進 chunks subcollection、絕不出現在 insurance_products
 *     的 user-facing fields
 *   - --dry-run 為預設、--commit 才真寫
 *   - createdAt 在 per-batch callback 內 runtime 取
 *   - 失敗 chunk 寫進 scripts/chunks-upload-failed.json、不 throw 整批
 *
 * CLI:
 *   node scripts/upload-chunks-to-firestore.cjs [options]
 *     --input <path>           Default: scripts/embeddings.jsonl
 *     --batch-size <N>         Default: 80 (Firestore byte cap ~1MB, single chunk ~8.7KB)
 *     --concurrency <N>        Default: 4
 *     --limit <N>              Sample mode
 *     --resume-from <chunkId>  從某 chunkId 開始續傳 (按 productId+chunkId 字典序)
 *     --dry-run                (default) 印計畫
 *     --commit                 真寫
 *
 * 範例:
 *   # dry-run 看 sample
 *   node scripts/upload-chunks-to-firestore.cjs --limit 100
 *
 *   # 真灌
 *   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\sa.json
 *   node scripts/upload-chunks-to-firestore.cjs --commit
 *
 *   # 續傳 (上次卡 tii_204_xxxxx 的 c0042)
 *   node scripts/upload-chunks-to-firestore.cjs --commit --resume-from c0042
 *
 * Vector index hint (做完跑這個！Firebase Console 也行、可能要 10min build):
 *   gcloud firestore indexes composite create \
 *     --collection-group=chunks \
 *     --query-scope=COLLECTION \
 *     --field-config field-path=embedding,vector-config='{"dimension":768,"flat":{}}'
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT_COLLECTION = 'insurance_products';
const SUB_COLLECTION = 'chunks';
const DEFAULT_INPUT = path.resolve(__dirname, 'embeddings.jsonl');
const FAIL_LOG = path.resolve(__dirname, 'chunks-upload-failed.json');
// V3 critic fix: 400 docs * ~8.7KB/doc = ~3.5MB → 撞 Firestore 1MB batch byte limit.
// 單 chunk doc ≈ embedding 6.1KB (768 × 8B) + text 2.4KB + metadata 0.2KB = ~8.7KB.
// Default 80 → ~700KB per batch (safe < 1MB Firestore hard cap).
const DEFAULT_BATCH_SIZE = 80;
const MAX_BATCH_SIZE = 500;           // Firestore doc-count cap (byte cap will hit first)
const DEFAULT_CONCURRENCY = 4;
const EXPECTED_EMBEDDING_DIM = 768;   // Gemini text-embedding-004
const SCHEMA_VERSION = 1;
// Conservative byte budget per batch (Firestore is ~1MiB / commit, leave headroom for SDK overhead).
const BATCH_BYTE_BUDGET = 900 * 1024; // 900 KB

// 白名單欄位 — 只有這些 key 會被 set 進 chunk doc
const CHUNK_WRITE_WHITELIST = new Set([
  'text',
  'sectionHeader',
  'pageNum',
  'articleNo',
  'itemNo',
  'charCount',
  'citationLabel',
  'embedding',          // 寫成 FieldValue.vector(arr)
  'createdAt',
  'schemaVersion',
]);

// 嚴禁字串 (沿 Sprint 13 規) — 任何 chunk text 含此 substring 一律 reject
const FORBIDDEN_SUBSTRINGS = [
  'cloudwinner',
  'CloudWinner',
  '保險贏家',
  '昇華科技',
  'insurance_winner',
  'insuranceWinner',
];

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    batchSize: DEFAULT_BATCH_SIZE,
    concurrency: DEFAULT_CONCURRENCY,
    limit: null,
    resumeFrom: null,
    dryRun: true,
    commit: false,
    help: false,
  };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--input') { args.input = path.resolve(rest[++i]); continue; }
    if (a === '--batch-size') {
      args.batchSize = Math.max(1, Math.min(MAX_BATCH_SIZE, Number(rest[++i]) || DEFAULT_BATCH_SIZE));
      continue;
    }
    if (a === '--concurrency') {
      args.concurrency = Math.max(1, Math.min(16, Number(rest[++i]) || DEFAULT_CONCURRENCY));
      continue;
    }
    if (a === '--limit') { args.limit = Number(rest[++i]); continue; }
    if (a === '--resume-from') { args.resumeFrom = rest[++i]; continue; }
    if (a === '--dry-run') { args.dryRun = true; args.commit = false; continue; }
    if (a === '--commit') { args.commit = true; args.dryRun = false; continue; }
    if (a === '-h' || a === '--help') { args.help = true; continue; }
  }
  return args;
}

function printHelp() {
  process.stdout.write(`
upload-chunks-to-firestore.cjs — 灌 chunk + embedding 進 Firestore 子集合

Usage:
  node scripts/upload-chunks-to-firestore.cjs [options]

Options:
  --input <path>           input JSONL (default: scripts/embeddings.jsonl)
  --batch-size <N>         每批 chunk 數 (default: ${DEFAULT_BATCH_SIZE}, max: ${MAX_BATCH_SIZE})
                           note: 單 chunk ≈8.7KB (768d embedding + 800 char text),
                           Firestore batch byte limit ~1MB → auto-split if exceeded
  --concurrency <N>        並行 batch 數 (default: ${DEFAULT_CONCURRENCY})
  --limit <N>              只灌前 N 個 chunk (測試)
  --resume-from <chunkId>  從 chunkId 字典序開始
  --dry-run                (default) 印計畫
  --commit                 真寫 (需 GOOGLE_APPLICATION_CREDENTIALS)
  -h, --help               show this

Vector index hint (做完跑！):
  gcloud firestore indexes composite create \\
    --collection-group=chunks \\
    --query-scope=COLLECTION \\
    --field-config field-path=embedding,vector-config='{"dimension":${EXPECTED_EMBEDDING_DIM},"flat":{}}'
`);
}

// ---------------------------------------------------------------------------
// Firebase admin lazy-init
// ---------------------------------------------------------------------------

let _admin = null;
function getFirebase() {
  if (_admin) return _admin;
  // Force resolve from functions/node_modules — root v14 removed admin.firestore()
  let admin;
  try {
    const resolved = require.resolve('firebase-admin', {
      paths: [path.resolve(__dirname, '..', 'functions', 'node_modules')],
    });
    admin = require(resolved);
  } catch (e) {
    admin = require('firebase-admin');
  }
  // firebase-admin v14 removed `admin.apps`; v12 still has it. Support both.
  const existingApps = typeof admin.getApps === 'function' ? admin.getApps() : (admin.apps || []);
  if (existingApps.length === 0) {
    admin.initializeApp({});
  }
  _admin = admin;
  return admin;
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

function containsForbidden(value) {
  if (typeof value !== 'string') return false;
  for (const banned of FORBIDDEN_SUBSTRINGS) {
    if (value.includes(banned)) return banned;
  }
  return false;
}

/** Validate one parsed JSONL row → { ok, payload | reason }. */
function validateChunk(row) {
  if (!row || typeof row !== 'object') {
    return { ok: false, reason: 'row not an object' };
  }
  const { productId, chunkId, text, embedding } = row;

  if (!productId || typeof productId !== 'string') return { ok: false, reason: 'missing productId' };
  if (!chunkId || typeof chunkId !== 'string') return { ok: false, reason: 'missing chunkId' };
  if (!productId.startsWith('tii_')) return { ok: false, reason: `productId must start with tii_ (got "${productId}")` };

  if (typeof text !== 'string' || text.length === 0) {
    return { ok: false, reason: 'missing/empty text' };
  }

  // Forbidden substring sweep — Sprint 13 規
  const hit = containsForbidden(text);
  if (hit) return { ok: false, reason: `forbidden substring "${hit}" in text` };

  if (!Array.isArray(embedding)) {
    return { ok: false, reason: 'embedding not an array' };
  }
  if (embedding.length !== EXPECTED_EMBEDDING_DIM) {
    return { ok: false, reason: `embedding dim=${embedding.length}, expect ${EXPECTED_EMBEDDING_DIM}` };
  }
  for (let i = 0; i < embedding.length; i++) {
    if (typeof embedding[i] !== 'number' || !Number.isFinite(embedding[i])) {
      return { ok: false, reason: `embedding[${i}] not a finite number` };
    }
  }

  // Build chunk payload — only whitelisted fields
  const payload = {
    text,
    embedding,             // 包成 FieldValue.vector 在 write 時做
    schemaVersion: SCHEMA_VERSION,
  };
  if (typeof row.sectionHeader === 'string') payload.sectionHeader = row.sectionHeader;
  if (typeof row.pageNum === 'number') payload.pageNum = row.pageNum;
  if (typeof row.articleNo === 'string') payload.articleNo = row.articleNo;
  if (typeof row.itemNo === 'string') payload.itemNo = row.itemNo;
  if (typeof row.charCount === 'number') payload.charCount = row.charCount;
  else payload.charCount = text.length;
  if (typeof row.citationLabel === 'string') payload.citationLabel = row.citationLabel;

  // Strip non-whitelisted
  for (const k of Object.keys(payload)) {
    if (!CHUNK_WRITE_WHITELIST.has(k) && k !== 'createdAt') delete payload[k];
  }

  return { ok: true, productId, chunkId, payload };
}

// ---------------------------------------------------------------------------
// JSONL streaming load
// ---------------------------------------------------------------------------

/**
 * Streaming batch iterator — yields batches without materializing full array.
 * Critical for 1.24M chunks × ~15KB payload = 18GB memory footprint.
 *
 * Trade-offs vs original loadChunks():
 *  - No global sort (would need full materialization). File is written in
 *    productId order by build-embeddings.cjs so batches stay coherent per-product.
 *  - --resume-from now compares chunkId against opts.resumeFrom as chunks arrive
 *    (skips lines until we hit a chunkId >= resumeFrom).
 *  - Skipped chunks not accumulated as full list — only counted.
 */
async function* iterateBatches(inputPath, opts) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`input not found: ${inputPath}`);
  }
  const rl = readline.createInterface({
    input: fs.createReadStream(inputPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  const batchSize = opts.batchSize;
  const limit = opts.limit;
  const resumeFrom = opts.resumeFrom || null;

  let batch = [];
  let lineNo = 0;
  let validEmitted = 0;
  let skippedCount = 0;
  let skippedSamples = []; // 只保留前 20 個給 debug
  let resumeReached = !resumeFrom;

  for await (const line of rl) {
    lineNo += 1;
    const trimmed = line.trim();
    if (!trimmed) continue;
    let row;
    try {
      row = JSON.parse(trimmed);
    } catch (e) {
      skippedCount++;
      if (skippedSamples.length < 20) skippedSamples.push({ line: lineNo, reason: `JSON parse error: ${e.message}` });
      continue;
    }
    const r = validateChunk(row);
    if (!r.ok) {
      skippedCount++;
      if (skippedSamples.length < 20) skippedSamples.push({ line: lineNo, chunkId: row.chunkId || '(no-id)', reason: r.reason });
      continue;
    }

    if (!resumeReached) {
      if (r.chunkId < resumeFrom) continue;
      resumeReached = true;
    }

    batch.push({ productId: r.productId, chunkId: r.chunkId, payload: r.payload });
    validEmitted++;

    if (batch.length >= batchSize) {
      yield { batch, totalEmitted: validEmitted };
      batch = [];
    }

    if (limit && validEmitted >= limit) break;
  }

  if (batch.length > 0) {
    yield { batch, totalEmitted: validEmitted };
  }

  // Terminal marker — expose stats via property so caller can read after loop
  iterateBatches._stats = { lineNo, validEmitted, skippedCount, skippedSamples };
}

// Backward-compat wrapper for --dry-run sample path.
async function loadChunksSample(inputPath, opts) {
  const sample = [];
  for await (const b of iterateBatches(inputPath, { ...opts, batchSize: 3 })) {
    for (const c of b.batch) {
      sample.push(c);
      if (sample.length >= 3) return { sample, stats: iterateBatches._stats || {} };
    }
  }
  return { sample, stats: iterateBatches._stats || {} };
}

// ---------------------------------------------------------------------------
// Write pipeline
// ---------------------------------------------------------------------------

/** Convert raw float[] to Firestore vector-field FieldValue, falling back to
 *  storing as plain array if the SDK is too old (logs a warning once). */
let _vectorFallbackWarned = false;
function toVectorField(admin, arr) {
  const FV = admin?.firestore?.FieldValue;
  if (FV && typeof FV.vector === 'function') {
    return FV.vector(arr);
  }
  if (!_vectorFallbackWarned) {
    process.stderr.write('warn: firebase-admin SDK lacks FieldValue.vector — storing embedding as plain array (vector index won\'t pick it up; upgrade firebase-admin to >=12.1.0)\n');
    _vectorFallbackWarned = true;
  }
  return arr;
}

/** Rough byte-cost estimate for one chunk doc (vector + text + metadata).
 *  Firestore doubles = 8 B, UTF-8 CJK ≈ 3 B/char. Adds 1 KB SDK overhead. */
function estimateDocBytes(payload) {
  const embBytes = Array.isArray(payload.embedding) ? payload.embedding.length * 8 : 0;
  const textBytes = typeof payload.text === 'string' ? payload.text.length * 3 : 0;
  const headerBytes = typeof payload.sectionHeader === 'string' ? payload.sectionHeader.length * 3 : 0;
  const citeBytes = typeof payload.citationLabel === 'string' ? payload.citationLabel.length * 3 : 0;
  return embBytes + textBytes + headerBytes + citeBytes + 1024;
}

/** Split a slice into byte-budget-respecting sub-slices. */
function splitByByteBudget(slice, byteBudget) {
  const subSlices = [];
  let current = [];
  let currentBytes = 0;
  for (const c of slice) {
    const docBytes = estimateDocBytes(c.payload);
    if (current.length > 0 && currentBytes + docBytes > byteBudget) {
      subSlices.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(c);
    currentBytes += docBytes;
  }
  if (current.length > 0) subSlices.push(current);
  return subSlices;
}

/** Write one batch of chunks (auto-split by byte budget if oversized). */
async function writeBatch(admin, db, slice, dryRun, getNow, summary, failed) {
  if (dryRun) {
    for (const c of slice) {
      summary.wouldWrite += 1;
      summary.byProduct[c.productId] = (summary.byProduct[c.productId] || 0) + 1;
    }
    return;
  }

  // V3 critic fix: split by byte budget so we never exceed Firestore 1MiB batch cap.
  const subSlices = splitByByteBudget(slice, BATCH_BYTE_BUDGET);
  for (const sub of subSlices) {
    await writeSingleBatch(admin, db, sub, getNow, summary, failed);
  }
}

async function writeSingleBatch(admin, db, slice, getNow, summary, failed) {
  const batch = db.batch();
  const stamped = slice.map((c) => {
    const docData = {
      ...c.payload,
      embedding: toVectorField(admin, c.payload.embedding),
      createdAt: getNow(),
    };
    return { productId: c.productId, chunkId: c.chunkId, docData };
  });

  for (const s of stamped) {
    const ref = db
      .collection(ROOT_COLLECTION).doc(s.productId)
      .collection(SUB_COLLECTION).doc(s.chunkId);
    batch.set(ref, s.docData, { merge: true });
  }

  try {
    await batch.commit();
    for (const s of stamped) {
      summary.wrote += 1;
      summary.byProduct[s.productId] = (summary.byProduct[s.productId] || 0) + 1;
    }
  } catch (batchErr) {
    process.stderr.write(`warn: batch commit failed (${batchErr.message}) — falling back to per-doc set\n`);
    for (const s of stamped) {
      try {
        const ref = db
          .collection(ROOT_COLLECTION).doc(s.productId)
          .collection(SUB_COLLECTION).doc(s.chunkId);
        await ref.set(s.docData, { merge: true });
        summary.wrote += 1;
        summary.byProduct[s.productId] = (summary.byProduct[s.productId] || 0) + 1;
      } catch (docErr) {
        failed.push({
          productId: s.productId,
          chunkId: s.chunkId,
          reason: `firestore set failed: ${docErr.message}`,
        });
      }
    }
  }
}

/** Promise-pool — 並行 batch 推送。 */
async function runBatchPool(batches, concurrency, worker, onProgress) {
  let cursor = 0;
  let done = 0;
  const workers = Array.from({ length: Math.min(concurrency, batches.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= batches.length) return;
      try {
        await worker(batches[idx], idx);
      } catch (e) {
        // worker 自己已記錄 fail；這裡 swallow
      }
      done += 1;
      if (onProgress) onProgress(done, batches.length);
    }
  });
  await Promise.all(workers);
}

async function runIngest(args) {
  const startedAt = new Date().toISOString();
  process.stdout.write(`upload-chunks start: input=${args.input} dryRun=${args.dryRun} commit=${args.commit}\n`);
  process.stdout.write(`streaming mode: batchSize=${args.batchSize} concurrency=${args.concurrency}\n`);

  // Dry-run sample (only reads first 3 valid chunks)
  if (args.dryRun) {
    const { sample, stats } = await loadChunksSample(args.input, {
      limit: 3,
      resumeFrom: args.resumeFrom,
    });
    const preview = sample.map((c) => ({
      productId: c.productId,
      chunkId: c.chunkId,
      pageNum: c.payload.pageNum,
      articleNo: c.payload.articleNo,
      citationLabel: c.payload.citationLabel,
      textPreview: c.payload.text.slice(0, 100) + (c.payload.text.length > 100 ? '...' : ''),
      embeddingDim: c.payload.embedding.length,
      embeddingHead: c.payload.embedding.slice(0, 4),
    }));
    process.stdout.write('[dry-run] sample (first 3 chunks):\n');
    process.stdout.write(JSON.stringify(preview, null, 2) + '\n');
    process.stdout.write(`[dry-run] scanned ${stats.lineNo || 0} lines, ${stats.skippedCount || 0} skipped\n`);
    return { summary: { total: 0, wouldWrite: 0, wrote: 0, skipped: stats.skippedCount || 0 }, failed: [], skipped: [] };
  }

  const admin = getFirebase();
  const db = admin.firestore();

  const summary = {
    total: 0,
    wouldWrite: 0,
    wrote: 0,
    skipped: 0,
    byProduct: {},
    startedAt,
  };
  const failed = [];
  const getNow = () => new Date().toISOString();  // runtime callback (Sprint 7/12 規)

  // ── Streaming: 讀一批寫一批、不 materialize 全部 ──
  // 為了 concurrency > 1、我們用「pending batches queue」— 累積到
  // args.concurrency 個 batch 才 flush parallel、避免同時吃太多記憶體。
  const pending = [];
  let batchNo = 0;
  let progressPrinted = 0;

  const flushPending = async () => {
    if (pending.length === 0) return;
    const slices = pending.splice(0, pending.length);
    await Promise.all(slices.map((slice) => writeBatch(admin, db, slice, false, getNow, summary, failed)));
    // Free the reference so GC can reclaim vector buffers
    for (let i = 0; i < slices.length; i++) slices[i] = null;
  };

  for await (const { batch, totalEmitted } of iterateBatches(args.input, {
    batchSize: args.batchSize,
    limit: args.limit,
    resumeFrom: args.resumeFrom,
  })) {
    summary.total = totalEmitted;
    pending.push(batch);
    batchNo += 1;

    if (pending.length >= args.concurrency) {
      await flushPending();
      if (batchNo - progressPrinted >= 5) {
        process.stdout.write(`progress: ${summary.total} chunks streamed, ${summary.wrote} written, ${failed.length} failed\n`);
        progressPrinted = batchNo;
      }
    }
  }
  await flushPending();

  const iterStats = iterateBatches._stats || {};
  summary.skipped = iterStats.skippedCount || 0;

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

  // Summary
  process.stdout.write('\n=== upload-chunks summary ===\n');
  process.stdout.write(`mode:           ${args.dryRun ? 'DRY-RUN' : 'COMMIT'}\n`);
  process.stdout.write(`input:          ${args.input}\n`);
  process.stdout.write(`total valid:    ${summary.total}\n`);
  process.stdout.write(`would write:    ${summary.wouldWrite}\n`);
  process.stdout.write(`wrote:          ${summary.wrote}\n`);
  process.stdout.write(`skipped:        ${summary.skipped}\n`);
  process.stdout.write(`failed:         ${failed.length}\n`);
  process.stdout.write(`unique products: ${Object.keys(summary.byProduct).length}\n`);
  const topProducts = Object.entries(summary.byProduct).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topProducts.length) {
    process.stdout.write('top 5 products by chunk count:\n');
    for (const [p, n] of topProducts) process.stdout.write(`  ${String(n).padStart(5)}  ${p}\n`);
  }

  if (!args.dryRun) {
    process.stdout.write('\nNEXT STEP — build the vector index (one-time, can take 10min):\n');
    process.stdout.write('  gcloud firestore indexes composite create \\\n');
    process.stdout.write('    --collection-group=chunks \\\n');
    process.stdout.write('    --query-scope=COLLECTION \\\n');
    process.stdout.write(`    --field-config field-path=embedding,vector-config='{"dimension":${EXPECTED_EMBEDDING_DIM},"flat":{}}'\n`);
    process.stdout.write('(Firebase Console > Firestore > Indexes > Add 也行)\n');
  }

  return { summary, failed, skipped: iterStats.skippedSamples || [] };
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
    process.stderr.write(`error: upload-chunks failed — ${err.message}\n`);
    if (err.stack) process.stderr.write(err.stack + '\n');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  validateChunk,
  containsForbidden,
  toVectorField,
  iterateBatches,
  loadChunksSample,
  writeBatch,
  writeSingleBatch,
  estimateDocBytes,
  splitByByteBudget,
  runBatchPool,
  CHUNK_WRITE_WHITELIST,
  FORBIDDEN_SUBSTRINGS,
  EXPECTED_EMBEDDING_DIM,
  ROOT_COLLECTION,
  SUB_COLLECTION,
  DEFAULT_BATCH_SIZE,
  BATCH_BYTE_BUDGET,
};
