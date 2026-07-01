#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * migrate-to-versioned-schema.cjs
 * Sprint 15 W1 / Task B4
 *
 * 把 Sprint 13 灌入的 catalog 升級到 Sprint 15 versioned 結構：
 *   1. insurance_products/{id} → 加 activeVersion='v1' / totalVersions=1 / firstSeenAt / lastModifiedAt
 *   2. insurance_products/{id}/versions/v1 → 新建 subcollection doc，複製 spec + 加 lifecycle fields
 *   3. users/{uid}/insurancePolicies/{pid} → 已 link 的 doc 加 catalogProductVersion='v1'
 *
 * 對齊 functions/index.js 的 backfillProductVersions / backfillClientPolicyVersions callable：
 *   - 同一套邏輯（callable 給 admin UI 點按鈕用；CLI 給 ops 在 terminal 跑用）
 *   - 走 admin SDK 直連 Firestore，無 callable HTTP round-trip、不用 auth token
 *   - 寫進度到 backfill_progress/{runId}，admin UI 可以拉
 *
 * 戰略邊界 (HARD RULES — Sprint 15 spec):
 *   - source 永遠 'tii' (Sprint 13 closed union；連 PDF placeholder path 都對齊)
 *   - epoch ms / runtime ts 在 callback 內取（不在 module top-level）
 *   - idempotent — 重跑安全（已升級的 doc 直接 skip）
 *   - dry-run default — 預設不寫 Firestore、要 --commit 才真寫
 *   - 客戶 PII 嚴禁直接 log（per-doc error 只留 path / message snippet）
 *   - 不引入新 npm 依賴（用 functions/node_modules/firebase-admin）
 *
 * CLI:
 *   node scripts/migrate-to-versioned-schema.cjs
 *     [--dry-run]           # default
 *     [--commit]            # 真寫 Firestore (需 GOOGLE_APPLICATION_CREDENTIALS)
 *     [--product-only]      # 只跑 insurance_products 升級
 *     [--policy-only]       # 只跑 users/.../insurancePolicies 升級
 *     [--limit N]           # 本次最多處理幾筆（default 1000，max 5000）
 *     [--resume-from <id>]  # product: doc id；policy: doc path (users/.../insurancePolicies/...)
 *     [--batch-size N]      # 進度回報間隔（default 100）
 *
 * 範例:
 *   # 預設 dry-run、先看 catalog 會升級幾筆
 *   node scripts/migrate-to-versioned-schema.cjs --product-only
 *
 *   # 真寫 catalog
 *   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\sa.json
 *   node scripts/migrate-to-versioned-schema.cjs --product-only --commit
 *
 *   # 升級客戶端 policies（client policies migration 在 W2 才真上線，這裡保留 dry-run 入口）
 *   node scripts/migrate-to-versioned-schema.cjs --policy-only --limit 50
 *
 *   # 上次跑到 tii_kt_xyz 卡掉、續傳
 *   node scripts/migrate-to-versioned-schema.cjs --product-only --commit --resume-from tii_kt_xyz
 */

'use strict';

const path = require('node:path');
const crypto = require('node:crypto');

// ---------------------------------------------------------------------------
// Constants — 對齊 functions/index.js 的 backfill callable
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;
const PROGRESS_EVERY_DEFAULT = 100;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    dryRun: true,
    commit: false,
    productOnly: false,
    policyOnly: false,
    limit: DEFAULT_LIMIT,
    resumeFrom: null,
    batchSize: PROGRESS_EVERY_DEFAULT,
    help: false,
  };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--dry-run') { args.dryRun = true; args.commit = false; continue; }
    if (a === '--commit') { args.commit = true; args.dryRun = false; continue; }
    if (a === '--product-only') { args.productOnly = true; continue; }
    if (a === '--policy-only') { args.policyOnly = true; continue; }
    if (a === '--limit') {
      const n = Number(rest[++i]);
      args.limit = Math.max(1, Math.min(MAX_LIMIT, n || DEFAULT_LIMIT));
      continue;
    }
    if (a === '--resume-from') { args.resumeFrom = rest[++i]; continue; }
    if (a === '--batch-size') {
      const n = Number(rest[++i]);
      args.batchSize = Math.max(1, n || PROGRESS_EVERY_DEFAULT);
      continue;
    }
    if (a === '-h' || a === '--help') { args.help = true; continue; }
  }
  if (args.productOnly && args.policyOnly) {
    throw new Error('--product-only and --policy-only are mutually exclusive');
  }
  return args;
}

function printHelp() {
  process.stdout.write(`
migrate-to-versioned-schema.cjs — Sprint 15 W1 versioned schema backfill

Usage:
  node scripts/migrate-to-versioned-schema.cjs [options]

Options:
  --dry-run             (default) 只統計，不寫 Firestore
  --commit              真寫 (需 GOOGLE_APPLICATION_CREDENTIALS)
  --product-only        只跑 insurance_products → versions/v1 升級
  --policy-only         只跑 users/.../insurancePolicies → catalogProductVersion='v1'
  --limit <N>           本次最多處理幾筆 (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT})
  --resume-from <id>    product: doc id 字典序起點；policy: doc path 起點
  --batch-size <N>      progress 回報間隔 (default ${PROGRESS_EVERY_DEFAULT})
  -h, --help            show this

`);
}

// ---------------------------------------------------------------------------
// Firebase admin lazy-init — 對齊 ingest-catalog-to-firestore.cjs
// ---------------------------------------------------------------------------

let _admin = null;
function getFirebase() {
  if (_admin) return _admin;
  // Force resolve from functions/node_modules (v12) — root v14 removed admin.firestore()
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
// Progress writer — 對齊 callable 的 writeBackfillProgress
// ---------------------------------------------------------------------------

async function writeProgress(db, admin, runId, payload) {
  try {
    await db.collection('backfill_progress').doc(runId).set(
      {
        ...payload,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    process.stderr.write(`warn: progress write failed (${err.message})\n`);
  }
}

// ---------------------------------------------------------------------------
// Product backfill — 對齊 backfillProductVersions callable
// ---------------------------------------------------------------------------

async function backfillProducts(admin, db, args) {
  // runtime ts 在這層 callback 取（不在 top-level module）
  const callbackStartedAtMs = Date.now();
  const runId = `product_cli_${callbackStartedAtMs}_${crypto.randomBytes(4).toString('hex')}`;

  process.stdout.write(`[product] runId=${runId} dryRun=${args.dryRun} limit=${args.limit} resumeFrom=${args.resumeFrom || '(none)'}\n`);

  let processed = 0;
  let migrated = 0;
  let skipped = 0;
  let errorCount = 0;
  let lastDocId = null;
  const errorSamples = [];

  await writeProgress(db, admin, runId, {
    runId,
    kind: 'product',
    status: 'running',
    dryRun: args.dryRun,
    limit: args.limit,
    resumeFrom: args.resumeFrom,
    processed: 0,
    migrated: 0,
    skipped: 0,
    errorCount: 0,
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    startedAtMs: callbackStartedAtMs,
    startedBy: 'cli',
  });

  try {
    let query = db.collection('insurance_products').orderBy(admin.firestore.FieldPath.documentId());
    if (args.resumeFrom) {
      query = query.startAfter(args.resumeFrom);
    }
    query = query.limit(args.limit);

    const snap = await query.get();
    process.stdout.write(`[product] fetched ${snap.size} doc(s)\n`);

    for (const docSnap of snap.docs) {
      processed += 1;
      lastDocId = docSnap.id;
      const productId = docSnap.id;
      const existing = docSnap.data() || {};

      try {
        // Idempotent skip
        if (existing.activeVersion) {
          skipped += 1;
          continue;
        }

        const nowTsServer = admin.firestore.FieldValue.serverTimestamp();
        const firstSeenAt = existing.createdAt || existing.crawledAt || nowTsServer;

        const versionDoc = {
          effectiveFrom: existing.effectiveDate || null,
          effectiveTo: null,
          status: 'active',
          pdfStoragePath: `insurance-conditions/${productId}/v1.pdf`,
          pdfSha256: existing.pdfSha256 || null,
          id: productId,
          company: existing.company || null,
          companySlug: existing.companySlug || null,
          productName: existing.productName || null,
          productCode: existing.productCode || null,
          categoryMain: existing.categoryMain || null,
          categorySub: existing.categorySub || null,
          effectiveDate: existing.effectiveDate || null,
          source: existing.source || 'tii', // 鐵則：永遠 'tii'
          sourceUrl: existing.sourceUrl || null,
          catalogProcessedAt: nowTsServer,
          schemaVersion: 1,
        };

        const rootUpdate = {
          activeVersion: 'v1',
          totalVersions: 1,
          firstSeenAt,
          lastModifiedAt: nowTsServer,
        };

        if (args.dryRun) {
          migrated += 1;
          if (processed <= 5) {
            process.stdout.write(`  [dry-run] WOULD migrate ${productId} (${existing.companySlug || '?'} / ${existing.productCode || '?'})\n`);
          }
        } else {
          const batch = db.batch();
          const versionRef = db
            .collection('insurance_products')
            .doc(productId)
            .collection('versions')
            .doc('v1');
          batch.set(versionRef, versionDoc, { merge: false });
          batch.update(docSnap.ref, rootUpdate);
          await batch.commit();
          migrated += 1;
        }
      } catch (perDocErr) {
        errorCount += 1;
        if (errorSamples.length < 5) {
          errorSamples.push({
            docId: productId,
            message: String(perDocErr.message || perDocErr).slice(0, 200),
          });
        }
        process.stderr.write(`  err ${productId}: ${perDocErr.message}\n`);
      }

      if (processed % args.batchSize === 0) {
        await writeProgress(db, admin, runId, { processed, migrated, skipped, errorCount, lastDocId });
        process.stdout.write(`  ... processed=${processed} migrated=${migrated} skipped=${skipped} err=${errorCount}\n`);
      }
    }

    const done = snap.size < args.limit;
    await writeProgress(db, admin, runId, {
      processed,
      migrated,
      skipped,
      errorCount,
      lastDocId,
      errorSamples,
      status: done ? 'completed' : 'partial',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAtMs: Date.now(),
    });

    return { runId, processed, migrated, skipped, errorCount, lastDocId, done, errorSamples };
  } catch (err) {
    await writeProgress(db, admin, runId, {
      processed,
      migrated,
      skipped,
      errorCount,
      lastDocId,
      status: 'failed',
      error: String(err.message || err).slice(0, 500),
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Policy backfill — 對齊 backfillClientPolicyVersions callable
// ---------------------------------------------------------------------------

async function backfillPolicies(admin, db, args) {
  const callbackStartedAtMs = Date.now();
  const runId = `policy_cli_${callbackStartedAtMs}_${crypto.randomBytes(4).toString('hex')}`;

  process.stdout.write(`[policy] runId=${runId} dryRun=${args.dryRun} limit=${args.limit} resumeFrom=${args.resumeFrom || '(none)'}\n`);

  let processed = 0;
  let migrated = 0;
  let skipped = 0;
  let errorCount = 0;
  let lastDocPath = null;
  const errorSamples = [];

  await writeProgress(db, admin, runId, {
    runId,
    kind: 'policy',
    status: 'running',
    dryRun: args.dryRun,
    limit: args.limit,
    resumeFrom: args.resumeFrom,
    processed: 0,
    migrated: 0,
    skipped: 0,
    errorCount: 0,
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    startedAtMs: callbackStartedAtMs,
    startedBy: 'cli',
  });

  try {
    let query = db
      .collectionGroup('insurancePolicies')
      .orderBy(admin.firestore.FieldPath.documentId());
    if (args.resumeFrom) {
      query = query.startAfter(args.resumeFrom);
    }
    query = query.limit(args.limit);

    const snap = await query.get();
    process.stdout.write(`[policy] fetched ${snap.size} doc(s)\n`);

    for (const docSnap of snap.docs) {
      processed += 1;
      lastDocPath = docSnap.ref.path;
      const existing = docSnap.data() || {};

      try {
        // 客戶 PII：log 不打 existing 內容，只記 path snippet
        if (!existing.catalogProductId) {
          skipped += 1;
          continue;
        }
        if (existing.catalogProductVersion) {
          skipped += 1;
          continue;
        }

        if (args.dryRun) {
          migrated += 1;
          if (processed <= 5) {
            process.stdout.write(`  [dry-run] WOULD migrate ${lastDocPath} → catalogProductVersion='v1'\n`);
          }
        } else {
          await docSnap.ref.update({
            catalogProductVersion: 'v1',
            catalogVersionLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          migrated += 1;
        }
      } catch (perDocErr) {
        errorCount += 1;
        if (errorSamples.length < 5) {
          errorSamples.push({
            docPath: lastDocPath,
            message: String(perDocErr.message || perDocErr).slice(0, 200),
          });
        }
        process.stderr.write(`  err ${lastDocPath}: ${perDocErr.message}\n`);
      }

      if (processed % args.batchSize === 0) {
        await writeProgress(db, admin, runId, { processed, migrated, skipped, errorCount, lastDocPath });
        process.stdout.write(`  ... processed=${processed} migrated=${migrated} skipped=${skipped} err=${errorCount}\n`);
      }
    }

    const done = snap.size < args.limit;
    await writeProgress(db, admin, runId, {
      processed,
      migrated,
      skipped,
      errorCount,
      lastDocPath,
      errorSamples,
      status: done ? 'completed' : 'partial',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAtMs: Date.now(),
    });

    return { runId, processed, migrated, skipped, errorCount, lastDocPath, done, errorSamples };
  } catch (err) {
    await writeProgress(db, admin, runId, {
      processed,
      migrated,
      skipped,
      errorCount,
      lastDocPath,
      status: 'failed',
      error: String(err.message || err).slice(0, 500),
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    printHelp();
    process.exit(2);
  }
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.commit && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    process.stderr.write('error: --commit requires GOOGLE_APPLICATION_CREDENTIALS env var\n');
    process.exit(2);
  }

  const admin = getFirebase();
  const db = admin.firestore();

  const startedAt = new Date().toISOString();
  process.stdout.write(`migrate start: dryRun=${args.dryRun} commit=${args.commit} startedAt=${startedAt}\n`);

  const summary = {};

  if (!args.policyOnly) {
    try {
      summary.product = await backfillProducts(admin, db, args);
    } catch (err) {
      process.stderr.write(`[product] FATAL: ${err.message}\n`);
      summary.product = { error: err.message };
    }
  }

  if (!args.productOnly) {
    try {
      summary.policy = await backfillPolicies(admin, db, args);
    } catch (err) {
      process.stderr.write(`[policy] FATAL: ${err.message}\n`);
      summary.policy = { error: err.message };
    }
  }

  process.stdout.write('\n========== SUMMARY ==========\n');
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');

  const hasError =
    (summary.product && summary.product.error) ||
    (summary.policy && summary.policy.error) ||
    (summary.product && summary.product.errorCount > 0) ||
    (summary.policy && summary.policy.errorCount > 0);
  process.exit(hasError ? 1 : 0);
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`fatal: ${err.stack || err.message}\n`);
    process.exit(1);
  });
}

module.exports = {
  // Exported for testability / reuse from other scripts
  parseArgs,
  backfillProducts,
  backfillPolicies,
};
