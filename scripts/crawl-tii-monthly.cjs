#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Ultra Advisor — TII monthly diff crawler
 * Sprint 15 / Task B1
 *
 * Role:
 *   Sprint 12 shipped a one-shot crawler. Sprint 15 turns that into a recurring
 *   monthly pipeline that:
 *     1. Crawls TII for every active 壽險 + 產險 company × category.
 *     2. For each product row, downloads the clause PDF, SHA-256-hashes it,
 *        and compares against the canonical Firestore copy.
 *     3. Classifies into { new, revision, discontinued, company-rename, unchanged }
 *        and writes a review-queue doc for the admin UI to triage.
 *     4. Emits a per-run JSON report so the GitHub Action / oncall can read
 *        stats without opening Firestore.
 *
 * Hard rules (Sprint 15 spec):
 *   - No new npm dep. Firebase Admin SDK is pre-installed and only loaded
 *     when --commit is passed.
 *   - All "current time" reads happen inside callbacks. No `Date.now()` /
 *     `new Date()` at module top-level. The monthly run's "as of" timestamp
 *     is captured once inside `main()` and threaded down.
 *   - PDF SHA via Node's built-in `node:crypto` (via `tii-base.cjs`).
 *   - Source string is always lowercase `tii` — closed-union TS guarantee
 *     on the read side (`src/lib/insuranceProducts.ts`).
 *   - 客戶 PII never touched. The lib only ever sees insurer + product
 *     metadata + PDF bytes.
 *   - Admin queue collection (`insurance_review_queue`) is NOT exposed to the
 *     advisor app. Sprint 15 W2 will lock it down in firestore.rules.
 *
 * Resilience:
 *   - TII outage → batch fail (the whole run dies, state preserved).
 *   - CAPTCHA fails 3× in a row on the same query → mark that query partial,
 *     fire Slack stub, continue with the next company.
 *   - Per-product errors are isolated: a busted PDF on one product doesn't
 *     poison the rest of the same company.
 *   - State file is written every 5 *successfully-processed* products so
 *     `--resume` always picks up at a clean cursor.
 *
 * What this script does NOT do (deliberately out of scope for W1):
 *   - Push notifications for clause revisions → Sprint 15 W2.
 *   - Client-side `policies` migration / re-binding → Sprint 15 W2/W3.
 *   - Slack fallback polish — current implementation logs to console; W2
 *     will wire the real webhook.
 *   - Real cron activation — W1 ships the workflow file gated to manual
 *     trigger; W3 enables the schedule.
 *
 * CLI:
 *   node scripts/crawl-tii-monthly.cjs [options]
 *
 *   --dry-run                (default) Don't write Firestore or Storage.
 *   --commit                 Required to write. Inverts --dry-run.
 *   --company CODE           Override company list (comma-separated allowed).
 *   --captcha-mode auto|manual   Default: auto (calls tii-captcha-solver.cjs).
 *   --captcha-code XXXX      Manual one-shot bypass for debugging.
 *   --resume                 Skip product codes already in state.doneProductCodes.
 *   --full                   Process the full active matrix (22 life + 21 P&C).
 *   --state-file PATH        Override state file path (default: scripts/tii-monthly-state.json).
 *   --limit N                Cap number of (company × category) queries this run.
 *   --report-dir DIR         Where to write tii-diff-<yyyy-mm>.json (default: scripts/).
 *   -h, --help               Show this help.
 *
 * Exit codes:
 *   0  success (even with isolated product errors — see report for details)
 *   1  fatal (TII totally unreachable, state corrupt, etc.)
 *   2  partial (some companies skipped due to CAPTCHA exhaustion)
 */

const fs = require('node:fs');
const path = require('node:path');

const base = require('./lib/tii-base.cjs');
// Optional deps — only required when their feature is in use (auto captcha,
// diff classification). Loaded lazily so a smoke `node --check` of this file
// doesn't fail before B2/B3 land.
let _captchaSolver = null;
function getCaptchaSolver() {
  if (_captchaSolver) return _captchaSolver;
  try {
    // Sprint 15 W1 / Task B2 — Gemini Vision solver
    // eslint-disable-next-line global-require
    _captchaSolver = require('./lib/tii-captcha-solver.cjs');
  } catch (_e) {
    _captchaSolver = { unavailable: true };
  }
  return _captchaSolver;
}

let _diff = null;
function getDiff() {
  if (_diff) return _diff;
  try {
    // Sprint 15 W1 / Task B3 — diff classifier
    // eslint-disable-next-line global-require
    _diff = require('./lib/tii-diff.cjs');
  } catch (_e) {
    _diff = { unavailable: true };
  }
  return _diff;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_STATE_FILE = path.join(__dirname, 'tii-monthly-state.json');
const DEFAULT_REPORT_DIR = __dirname;
const CHECKPOINT_EVERY = 5;          // products
const CAPTCHA_RETRY_BUDGET = 3;       // per (company × category)
const PARTIAL_EXIT_CODE = 2;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = {
    dryRun: true,
    commit: false,
    resume: false,
    full: false,
    company: null,           // array of strings, or null
    captchaMode: 'auto',
    captchaCode: null,
    stateFile: DEFAULT_STATE_FILE,
    reportDir: DEFAULT_REPORT_DIR,
    limit: null,             // null = no cap
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--commit') { flags.commit = true; flags.dryRun = false; }
    else if (a === '--dry-run') { flags.dryRun = true; flags.commit = false; }
    else if (a === '--resume') { flags.resume = true; }
    else if (a === '--full') { flags.full = true; }
    else if (a === '--company') {
      const v = argv[++i] || '';
      flags.company = v.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (a === '--captcha-mode') {
      const v = (argv[++i] || '').toLowerCase();
      if (v !== 'auto' && v !== 'manual') {
        throw new Error(`--captcha-mode must be auto|manual, got ${v}`);
      }
      flags.captchaMode = v;
    } else if (a === '--captcha-code') {
      flags.captchaCode = argv[++i];
    } else if (a === '--state-file') {
      flags.stateFile = path.resolve(argv[++i]);
    } else if (a === '--report-dir') {
      flags.reportDir = path.resolve(argv[++i]);
    } else if (a === '--limit') {
      flags.limit = parseInt(argv[++i], 10) || null;
    } else if (a === '-h' || a === '--help') {
      flags.help = true;
    }
  }
  return flags;
}

function printHelp() {
  console.log(`
Ultra Advisor — TII Monthly Crawler (Sprint 15)

Usage:
  node scripts/crawl-tii-monthly.cjs [flags]

Flags:
  --dry-run                (default) Parse + diff, do NOT write Firestore
  --commit                 Actually write review-queue + product docs
                           (requires GOOGLE_APPLICATION_CREDENTIALS env)
  --company CODE[,CODE]    Override active company list
  --captcha-mode auto|manual
                           auto = call tii-captcha-solver.cjs (Gemini Vision)
                           manual = require --captcha-code per query
  --captcha-code XXXX      One-shot manual CAPTCHA (debugging)
  --resume                 Skip product codes already in state file
  --full                   Run the full 22 life + 21 P&C active matrix
  --state-file PATH        Default: scripts/tii-monthly-state.json
  --report-dir DIR         Default: scripts/  (writes tii-diff-<yyyy-mm>.json)
  --limit N                Cap to N (company × category) queries this run
  -h, --help               Show this help

Exit codes:
  0 success / 1 fatal / 2 partial (CAPTCHA-exhausted companies)
`.trim() + '\n');
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

function freshState(asOfIso) {
  return {
    schemaVersion: 1,
    createdAt: asOfIso,
    updatedAt: asOfIso,
    phase: 'crawl',
    cursor: { companyIdx: 0, categoryIdx: 0 },
    doneProductCodes: [],
    failed: [],
    partialCompanies: [],
    stats: {
      processedCount: 0,
      newCount: 0,
      revisionCount: 0,
      discontinuedCount: 0,
      companyRenameCount: 0,
      unchangedCount: 0,
      captchaAttempts: 0,
      captchaFails: 0,
      errorCount: 0,
    },
  };
}

function loadOrFreshState(stateFile, resume, asOfIso) {
  if (resume && fs.existsSync(stateFile)) {
    try {
      const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      console.log(`[state] resumed from ${stateFile} (${s.doneProductCodes.length} products done so far)`);
      return s;
    } catch (e) {
      console.warn(`[state] resume failed (${e.message}), starting fresh`);
    }
  }
  return freshState(asOfIso);
}

function saveState(state, stateFile, nowIso) {
  state.updatedAt = nowIso;
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Firebase Admin SDK — lazy, only when --commit
// ---------------------------------------------------------------------------

let _admin = null;
function getFirebase() {
  if (_admin) return _admin;
  // eslint-disable-next-line global-require
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'ultra-advisor.appspot.com',
    });
  }
  _admin = admin;
  return admin;
}

/**
 * Load every existing `insurance_products` doc into an in-memory Map keyed by
 * doc id (= `${companySlug}_${slug(productCode)}`). Required by the diff
 * classifier to detect new / revision / discontinued without per-row reads.
 *
 * For a ~35k-row catalog this is ~10-30MB JS-side; well within Node defaults.
 * Returns an empty Map in dry-run mode (we skip Firestore entirely so the
 * diff lib will treat every row as "new" — that's fine for a smoke run).
 */
async function loadExistingProducts({ flags, log }) {
  if (flags.dryRun) {
    log('[firestore] dry-run → skipping existing-product load');
    return new Map();
  }
  const admin = getFirebase();
  const db = admin.firestore();
  const snap = await db.collection('insurance_products').get();
  const map = new Map();
  snap.forEach((doc) => {
    const data = doc.data();
    if (data && data.source === 'tii') map.set(doc.id, data);
  });
  log(`[firestore] loaded ${map.size} existing tii products`);
  return map;
}

/**
 * Map this crawler's internal `changeKind` (lowercase, hyphenated) to the
 * UI-side `ReviewType` closed union (see `src/lib/insuranceReviewQueue.ts`).
 *
 * The schema mismatch between the two layers was the V1 critic's blocker:
 * docs written with the crawler's native vocab were silently dropped by the
 * admin queue's `fromDoc()` validator (only docs that pass `isValidType` +
 * `isValidSource` survive). This mapper is the contract that keeps the queue
 * populated.
 */
function changeKindToReviewType(changeKind) {
  switch (changeKind) {
    case 'new':            return 'new_product';
    case 'revision':       return 'version_revision';
    case 'discontinued':   return 'discontinued';
    case 'company-rename': return 'company_metadata_change';
    // 'unchanged' is filtered upstream (we don't enqueue noise), but defend
    // the union here anyway — emit a `crowdsourced` tag so the UI still
    // surfaces it (rather than dropping silently) if it ever slips through.
    case 'unchanged':      return 'crowdsourced';
    default:               return 'crowdsourced';
  }
}

/**
 * Build the per-field `changes[]` array surfaced to the admin reviewer.
 *
 * We deliberately only include fields the admin actually triages — pdfSha256
 * (revision trigger), productName (rename trigger), status (discontinued
 * trigger), effectiveDate, endDate. Avoiding a full object diff keeps the
 * queue doc small and the UI table readable; the raw `candidate` and
 * `current` docs are NOT stored in the queue (they'd duplicate
 * `insurance_products` and risk client-PII leakage if shapes diverge later).
 */
function buildChangesArray(currentDoc, candidateDoc) {
  const fields = ['productName', 'pdfSha256', 'status', 'effectiveDate', 'endDate', 'companySlug'];
  const changes = [];
  const cur = currentDoc || {};
  const can = candidateDoc || {};
  for (const f of fields) {
    const before = cur[f];
    const after  = can[f];
    if (before === after) continue;
    if (before === undefined && after === undefined) continue;
    changes.push({ field: f, before: before ?? null, after: after ?? null });
  }
  return changes;
}

/**
 * Write one review-queue entry. Uses a deterministic id so re-runs are
 * idempotent — the same (productId, runMonth, changeKind) collapses.
 *
 * Schema shape MUST match `ReviewQueueItem` in `src/lib/insuranceReviewQueue.ts`
 * (closed-union `source`, `type`, `status` + nested `proposed` and `context`).
 * The UI's `fromDoc()` drops anything that doesn't validate — see V1 critic.
 *
 * Returns the doc id string (or null in dry-run).
 */
async function writeReviewQueueEntry({
  flags, runMonth, changeKind, productId, currentDoc, candidateDoc, evidence, nowMs,
}) {
  if (flags.dryRun) {
    return null;
  }
  const admin = getFirebase();
  const db = admin.firestore();
  const docId = `${runMonth}__${changeKind}__${productId}`;
  const reviewType = changeKindToReviewType(changeKind);
  const batchTag = `tii-${runMonth}`;
  const proposedVersion = (candidateDoc && candidateDoc.pdfSha256)
    ? `sha-${String(candidateDoc.pdfSha256).slice(0, 12)}`
    : 'unversioned';
  const diffSummary = (evidence && evidence.reason)
    ? `[${changeKind}] ${evidence.reason}`
    : `[${changeKind}] ${productId}`;

  await db.collection('insurance_review_queue').doc(docId).set({
    // UI-required closed-union fields (read by src/lib/insuranceReviewQueue.ts)
    source: 'tii_monthly',
    type: reviewType,
    status: 'pending',
    submittedAt: nowMs,
    submittedBy: batchTag,
    reviewedBy: null,
    reviewedAt: null,
    proposed: {
      productId,
      productVersion: proposedVersion,
      changes: buildChangesArray(currentDoc, candidateDoc),
      pdfStoragePath: (candidateDoc && candidateDoc.pdfStoragePath) || null,
      pdfSha256: (candidateDoc && candidateDoc.pdfSha256) || null,
    },
    context: {
      diffSummary,
      tiiCrawlBatch: batchTag,
    },
    // Internal bookkeeping (W2 merge engine reads these; UI ignores them).
    runMonth,
    changeKind,
    evidence: evidence || null,
    schemaVersion: 2,
  }, { merge: true });
  return docId;
}

/**
 * Upload PDF to Storage. Path mirrors Sprint 12 layout so existing storage
 * rules apply without change.
 */
async function uploadPdf({ flags, pdfBuffer, companyId, productName, beginDateRoc, sha256 }) {
  if (flags.dryRun) return null;
  const admin = getFirebase();
  const bucket = admin.storage().bucket();
  const slug = base.slugify(productName);
  const dateSlug = beginDateRoc ? base.slugify(beginDateRoc) : 'undated';
  // Include SHA prefix so revisions don't clobber the prior version's bytes —
  // we need to keep both around for diff-display in the admin queue.
  const storagePath = `insurance_pdfs/${companyId}/${slug}_${dateSlug}_${sha256.slice(0, 12)}.pdf`;
  const file = bucket.file(storagePath);
  await file.save(pdfBuffer, {
    contentType: 'application/pdf',
    metadata: { cacheControl: 'public, max-age=31536000' },
  });
  return storagePath;
}

// ---------------------------------------------------------------------------
// CAPTCHA solving
// ---------------------------------------------------------------------------

/**
 * Resolve a CAPTCHA according to `captchaMode`. Returns a 4-digit string on
 * success, throws on exhaustion.
 *
 * - manual + --captcha-code: returns the code, single-shot.
 * - manual without code: dumps the bitmap to disk, throws (admin must rerun).
 * - auto: invokes B2's `solve(buffer)` up to `CAPTCHA_RETRY_BUDGET` times,
 *   re-downloading a fresh CAPTCHA each retry (TII rotates the answer on
 *   every Query.aspx GET).
 */
async function resolveCaptcha({ flags, jar, log, captchaDumpDir }) {
  if (flags.captchaCode) {
    log('[captcha] using --captcha-code one-shot value');
    return flags.captchaCode;
  }
  if (flags.captchaMode === 'manual') {
    const buf = await base.withRetry('captcha-fetch', () => base.downloadCaptchaBuffer(jar));
    const ts = Date.now(); // runtime callback
    const dumpPath = path.join(captchaDumpDir, `tii-captcha-${ts}.bmp`);
    fs.writeFileSync(dumpPath, buf);
    throw new Error(`manual captcha mode + no --captcha-code; bitmap saved to ${dumpPath}`);
  }

  // auto mode
  const solver = getCaptchaSolver();
  if (solver.unavailable) {
    throw new Error('auto captcha mode requires scripts/lib/tii-captcha-solver.cjs (Task B2) — not found');
  }
  let lastErr = null;
  for (let i = 0; i < CAPTCHA_RETRY_BUDGET; i++) {
    try {
      const buf = await base.withRetry('captcha-fetch', () => base.downloadCaptchaBuffer(jar));
      const code = await solver.solve(buf, { attempt: i + 1 });
      if (!/^\d{4}$/.test(code)) {
        throw new Error(`solver returned non-4-digit value: ${JSON.stringify(code)}`);
      }
      log(`[captcha] auto-solved on attempt ${i + 1}`);
      return code;
    } catch (e) {
      lastErr = e;
      log(`[captcha] auto attempt ${i + 1}/${CAPTCHA_RETRY_BUDGET} failed: ${e.message}`);
      await base.jitterSleep(500, 500);
    }
  }
  throw new Error(`captcha auto-solve exhausted ${CAPTCHA_RETRY_BUDGET} attempts: ${lastErr && lastErr.message}`);
}

/**
 * Slack fallback stub. Sprint 15 W1 just prints; W2 wires the real webhook.
 * Kept centralised so swapping the implementation is one edit.
 */
function slackNotify(message) {
  console.error(`[slack-stub] ${message}`);
}

// ---------------------------------------------------------------------------
// Diff classification (delegated to tii-diff.cjs in B3)
// ---------------------------------------------------------------------------

/**
 * Wrap B3's classifier. If unavailable, fall back to a trivial classifier:
 * "is the id in the existing map? if yes & sha matches → unchanged; if yes
 * & sha differs → revision; if no → new". That fallback lets B1 ship +
 * `node --check` green while B3 lands in parallel.
 */
function classifyChange({ candidate, existing }) {
  const diff = getDiff();
  if (!diff.unavailable && typeof diff.classify === 'function') {
    return diff.classify({ candidate, existing });
  }
  if (!existing) return { kind: 'new', reason: 'no-existing-doc' };
  if (existing.productName && candidate.productName
      && existing.productName !== candidate.productName
      && existing.companySlug === candidate.companySlug) {
    return { kind: 'company-rename', reason: 'productName changed under same companySlug' };
  }
  if (candidate.status === 'discontinued' && existing.status !== 'discontinued') {
    return { kind: 'discontinued', reason: 'endDate present on new row' };
  }
  if (existing.pdfSha256 && candidate.pdfSha256
      && existing.pdfSha256 !== candidate.pdfSha256) {
    return { kind: 'revision', reason: `sha256 changed: ${existing.pdfSha256.slice(0, 8)} → ${candidate.pdfSha256.slice(0, 8)}` };
  }
  if (existing.pdfSha256 && candidate.pdfSha256
      && existing.pdfSha256 === candidate.pdfSha256) {
    return { kind: 'unchanged', reason: 'sha256 match' };
  }
  return { kind: 'unchanged', reason: 'fallback default' };
}

// ---------------------------------------------------------------------------
// Per-query / per-product processing
// ---------------------------------------------------------------------------

async function processOneQuery({ companyId, categoryKey, flags, jar, state, log, captchaDumpDir }) {
  log(`\n=== Query: company ${companyId} × ${categoryKey} ===`);

  await base.withRetry('query.aspx', () => base.fetchQueryPage(jar));

  let captchaCode;
  // Count one CAPTCHA attempt per (company × category) query so the report's
  // hit-rate denominator reflects real workload. Failures still bump
  // captchaFails — both are tracked so a Gemini-vision degradation surfaces
  // as `captchaHitRate` < 1.0 in the per-month JSON report (V2 critic).
  state.stats.captchaAttempts += 1;
  try {
    captchaCode = await resolveCaptcha({ flags, jar, log, captchaDumpDir });
  } catch (e) {
    state.stats.captchaFails += 1;
    state.partialCompanies.push({ companyId, categoryKey, reason: e.message });
    slackNotify(`CAPTCHA exhausted for company=${companyId} category=${categoryKey}: ${e.message}`);
    return { skipped: 'captcha-exhausted', error: e.message };
  }

  await base.jitterSleep();

  const params = base.buildQueryParams({ companyId, categoryKey, captchaCode });
  const { html, redirected } = await base.withRetry('submit', () => base.submitQuery(jar, params));

  if (redirected || base.isCaptchaReject(html)) {
    state.stats.captchaFails += 1;
    log('[result] captcha rejected by server post-submit');
    return { skipped: 'captcha-reject' };
  }

  if (base.isNoResults(html)) {
    log('[result] 0 products (legitimate empty match)');
    return { products: [] };
  }

  const products = base.parseProducts(html);
  log(`[result] parsed ${products.length} product rows`);
  return { products, html };
}

async function handleProduct({ row, companyId, categoryKey, flags, jar, state, existingMap, runMonth, log }) {
  // 1. Download PDF + SHA (always — even in dry-run, so the report is real).
  await base.jitterSleep();
  const pdfRes = await base.withRetry(`pdf:${row.pdfUrl}`, async () => {
    const r = await base.httpRequest(row.pdfUrl, { method: 'GET' }, jar);
    if (!r.ok) throw new Error(`pdf GET ${r.status}`);
    return r;
  });
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
  const sha = base.sha256Hex(pdfBuffer);

  // 2. Build canonical candidate doc. `crawledAt` captured inside this
  //    callback per the time-handling 鐵則.
  const nowMs = Date.now();
  const candidate = base.buildProductDoc({
    row,
    companyId,
    categoryKey,
    pdfSha256: sha,
    crawledAt: nowMs,
    crawlerVersion: 'tii-monthly-v1',
  });

  // 3. Look up existing.
  const existing = existingMap.get(candidate.id) || null;

  // 4. Classify.
  const decision = classifyChange({ candidate, existing });

  // 5. Bookkeep stats by kind.
  switch (decision.kind) {
    case 'new':              state.stats.newCount += 1; break;
    case 'revision':         state.stats.revisionCount += 1; break;
    case 'discontinued':     state.stats.discontinuedCount += 1; break;
    case 'company-rename':   state.stats.companyRenameCount += 1; break;
    case 'unchanged':        state.stats.unchangedCount += 1; break;
    default: break;
  }
  state.stats.processedCount += 1;

  // 6. Upload PDF + queue review entry — only for interesting deltas.
  if (decision.kind === 'unchanged') {
    log(`[unchanged] ${candidate.id} (sha ${sha.slice(0, 8)})`);
    state.doneProductCodes.push(candidate.id);
    return { decision, candidate };
  }

  const storagePath = await uploadPdf({
    flags,
    pdfBuffer,
    companyId,
    productName: row.productName,
    beginDateRoc: row.beginDateRoc,
    sha256: sha,
  });
  if (storagePath) candidate.pdfStoragePath = storagePath;

  const queueId = await writeReviewQueueEntry({
    flags,
    runMonth,
    changeKind: decision.kind,
    productId: candidate.id,
    currentDoc: existing,
    candidateDoc: candidate,
    evidence: { reason: decision.reason, sha256: sha, pdfBytes: pdfBuffer.length },
    nowMs,
  });

  log(`[${decision.kind}] ${candidate.id} → queue=${queueId || '(dry-run)'} reason=${decision.reason}`);
  state.doneProductCodes.push(candidate.id);
  return { decision, candidate, queueId };
}

// ---------------------------------------------------------------------------
// Work plan
// ---------------------------------------------------------------------------

function buildWorkPlan(flags) {
  // Default = active subset (~22 life + 21 P&C). --company overrides.
  const lifeCompanies = flags.company
    ? flags.company.filter((c) => base.COMPANIES.life.includes(c))
    : base.COMPANIES_ACTIVE.life;
  const pncCompanies = flags.company
    ? flags.company.filter((c) => base.COMPANIES.pAndC.includes(c))
    : base.COMPANIES_ACTIVE.pAndC;
  const policy = flags.company
    ? flags.company.filter((c) => base.COMPANIES.policy.includes(c))
    : [];

  const lifeCats = Object.keys(base.CATEGORIES).filter((k) => base.CATEGORIES[k].cat === '2' || base.CATEGORIES[k].cat === '');
  const pncCats  = Object.keys(base.CATEGORIES).filter((k) => base.CATEGORIES[k].cat === '1' || base.CATEGORIES[k].cat === '');

  const plan = [];
  for (const c of lifeCompanies) {
    for (const k of lifeCats) plan.push({ companyId: c, categoryKey: k });
  }
  for (const c of pncCompanies) {
    for (const k of pncCats) plan.push({ companyId: c, categoryKey: k });
  }
  for (const c of policy) {
    for (const k of Object.keys(base.CATEGORIES)) plan.push({ companyId: c, categoryKey: k });
  }
  return plan;
}

function formatRunMonth(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let flags;
  try {
    flags = parseArgs(process.argv);
  } catch (e) {
    console.error(`[args] ${e.message}`);
    process.exit(1);
    return;
  }
  if (flags.help) { printHelp(); return; }

  // Capture the "as of" timestamp once, inside this callback. Everything else
  // that needs a wall-clock value derives from these two (or calls Date.now()
  // inside its own callback).
  const asOfDate = new Date();
  const asOfIso = asOfDate.toISOString();
  const runMonth = formatRunMonth(asOfDate);

  const log = (msg) => console.log(msg);
  log('=== TII Monthly Crawler ===');
  log(`Mode      : ${flags.dryRun ? 'DRY-RUN (no writes)' : 'COMMIT'}`);
  log(`Captcha   : ${flags.captchaMode}${flags.captchaCode ? ' (+code)' : ''}`);
  log(`Resume    : ${flags.resume}`);
  log(`Full      : ${flags.full}`);
  log(`StateFile : ${flags.stateFile}`);
  log(`ReportDir : ${flags.reportDir}`);
  log(`AsOf      : ${asOfIso} (runMonth=${runMonth})`);

  if (!flags.full && !flags.company && !flags.limit) {
    log('[warn] no --full / --company / --limit — defaulting to --limit 3 for safety');
    flags.limit = 3;
  }

  const state = loadOrFreshState(flags.stateFile, flags.resume, asOfIso);
  const doneSet = new Set(state.doneProductCodes);

  // Pre-load existing products. If this fails, treat as fatal — the diff would
  // be unsafe with a partial map (every row would look "new").
  let existingMap;
  try {
    existingMap = await loadExistingProducts({ flags, log });
  } catch (e) {
    console.error(`[fatal] failed to load existing products: ${e.message}`);
    process.exit(1);
    return;
  }

  const plan = buildWorkPlan(flags);
  log(`[plan] ${plan.length} (company × category) queries`);

  const jar = new base.CookieJar();
  const captchaDumpDir = __dirname;
  let queriesProcessed = 0;
  const startedAt = asOfIso;

  outer:
  for (let idx = state.cursor.companyIdx; idx < plan.length; idx++) {
    if (flags.limit && queriesProcessed >= flags.limit) break;
    const { companyId, categoryKey } = plan[idx];

    // Refresh jar per query — TII session resets are cheap and avoid stale
    // ASP.NET cookie alignment with the wrong CAPTCHA.
    jar.clear();

    try {
      const result = await processOneQuery({
        companyId, categoryKey, flags, jar, state, log, captchaDumpDir,
      });
      queriesProcessed += 1;

      if (result.products && result.products.length) {
        for (const row of result.products) {
          // Resume-aware skip
          const guessId = `tii_${companyId}_${base.slugify(row.productCode || row.productName)}`;
          if (flags.resume && doneSet.has(guessId)) {
            log(`[resume-skip] ${guessId}`);
            continue;
          }
          try {
            await handleProduct({
              row, companyId, categoryKey, flags, jar, state, existingMap, runMonth, log,
            });
          } catch (perr) {
            state.failed.push({
              kind: 'product',
              companyId,
              categoryKey,
              product: row.productName,
              error: perr.message,
              ts: new Date().toISOString(),
            });
            state.stats.errorCount += 1;
            console.error(`[product-fail] ${row.productName}: ${perr.message}`);
          }

          if (state.stats.processedCount % CHECKPOINT_EVERY === 0) {
            state.cursor = { companyIdx: idx, categoryIdx: 0 };
            saveState(state, flags.stateFile, new Date().toISOString());
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
      state.stats.errorCount += 1;
      console.error(`[query-fail] ${companyId} × ${categoryKey}: ${qerr.message}`);

      // TII totally down? If the first 3 queries all fail with the same root
      // cause we declare batch-fail and bail out (the workflow re-tries the
      // whole run later rather than burning CAPTCHA budget on a dead host).
      if (queriesProcessed === 0 && idx >= 2) {
        console.error('[fatal] first 3 queries failed — assuming TII outage, bailing');
        saveState(state, flags.stateFile, new Date().toISOString());
        process.exit(1);
        return;
      }
    }
    // continue to next idx (other companies)
    if (false) break outer; // keep label live for future scoping
  }

  // Reset cursor after a clean pass.
  state.cursor = { companyIdx: 0, categoryIdx: 0 };
  saveState(state, flags.stateFile, new Date().toISOString());

  // Write diff report. Filename uses `runMonth` so each calendar month gets
  // one canonical file. Re-runs in the same month overwrite (intentional —
  // we want the latest state, not a history of partials).
  const reportPath = path.join(flags.reportDir, `tii-diff-${runMonth}.json`);
  // CAPTCHA hit-rate — V2 critic must-fix. < 0.7 should trip a GH Action
  // alert / auto-issue (configured in .github/workflows/tii-monthly-crawl.yml).
  // Denominator is the per-query attempt count (one call to resolveCaptcha
  // per company × category), so a `captchaFails / attempts` ratio is the
  // realistic Gemini-vision degradation signal.
  const captchaAttempts = state.stats.captchaAttempts || 0;
  const captchaHitRate = captchaAttempts > 0
    ? Number(((captchaAttempts - state.stats.captchaFails) / captchaAttempts).toFixed(4))
    : 1;
  const report = {
    schemaVersion: 2,
    runMonth,
    startedAt,
    finishedAt: new Date().toISOString(),
    flags: {
      dryRun: flags.dryRun,
      commit: flags.commit,
      captchaMode: flags.captchaMode,
      resume: flags.resume,
      full: flags.full,
      company: flags.company,
      limit: flags.limit,
    },
    stats: state.stats,
    metrics: {
      captchaHitRate,
      captchaAttempts,
      captchaHitRateThreshold: 0.7,
      captchaHealthy: captchaHitRate >= 0.7,
    },
    failed: state.failed,
    partialCompanies: state.partialCompanies,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  log(`\n[report] wrote ${reportPath}`);

  // -------------------------------------------------------------------------
  // Sprint 15 W3 — write `tii_crawl_results/{yyyymm}` so `tiiMonthlyCrawlGuard`
  // (functions/index.js) can detect a missing or failed monthly run on day 5.
  //
  // doc id = `YYYYMM` (no dash) to match the guard's `_tiiGuardFormatYyyymm`.
  // status: 'partial' if any companies were skipped, else 'success'.
  // Dry-run skips the write — the guard would then alert next month anyway,
  // which is correct behaviour for a smoke run.
  // -------------------------------------------------------------------------
  if (!flags.dryRun) {
    try {
      const admin = getFirebase();
      const db = admin.firestore();
      const partial = state.partialCompanies.length > 0;
      const finalStatus = partial ? 'partial' : 'success';
      const guardYyyymm = runMonth.replace(/-/g, '');
      const runId = `tii_monthly_${startedAt}_${guardYyyymm}`;
      await db
        .collection('tii_crawl_results')
        .doc(guardYyyymm)
        .set(
          {
            yyyymm: guardYyyymm,
            runMonth, // 'YYYY-MM' (legacy, kept for human readability)
            runId,
            startedAt,
            ranAt: new Date().toISOString(),
            status: finalStatus,
            errorCount: state.stats.errorCount || 0,
            productsProcessed: state.stats.processedCount || 0,
            newCount: state.stats.newCount || 0,
            revisionCount: state.stats.revisionCount || 0,
            discontinuedCount: state.stats.discontinuedCount || 0,
            partialCompanyCount: state.partialCompanies.length,
            captchaAttempts,
            captchaHitRate,
            schemaVersion: 1,
          },
          { merge: true },
        );
      log(`[firestore] wrote tii_crawl_results/${guardYyyymm} status=${finalStatus}`);
    } catch (e) {
      // Guard 看不到 doc → 下月 5 號會 alert 一次；本步驟失敗不該擋整 cron exit code.
      console.warn(`[firestore] tii_crawl_results write failed: ${e.message}`);
    }
  }

  log('\n=== Done ===');
  log(`Stats: ${JSON.stringify(state.stats)}`);
  if (state.partialCompanies.length) {
    log(`Partial: ${state.partialCompanies.length} companies skipped (see report)`);
    process.exit(PARTIAL_EXIT_CODE);
    return;
  }
  // Process exit happens implicitly with 0.
}

// SIGINT — best-effort flush.
let _shuttingDown = false;
process.on('SIGINT', () => {
  if (_shuttingDown) process.exit(1);
  _shuttingDown = true;
  console.warn('\n[SIGINT] flushing state and exiting...');
  process.exit(0);
});

main().catch((err) => {
  console.error('[fatal]', err && err.stack || err);
  process.exit(1);
});
