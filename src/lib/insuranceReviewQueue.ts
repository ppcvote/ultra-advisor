// Sprint 15 W1 — Insurance Review Queue (admin-only read/decision surface).
//
// Why this module:
//   Sprint 15 introduces a lifecycle pipeline for the insurance catalog. Three
//   upstream sources feed pending changes (TII monthly crawl, advisor crowd
//   submissions via `MissingProductModal` → `insurance_products_pending`,
//   future per-company scraper), and they all land in a single Firestore-backed
//   queue that admins triage in `/admin/insurance-review-queue`.
//
//   This file is the CLIENT-SIDE read surface only. Mutations (approve /
//   reject / merge / promote into the live `insurance_products` catalog) are
//   intentionally STUBBED in W1 — the merge engine + version backfill live in
//   `functions/` (Sprint 15 W2). We don't want admins half-applying a merge
//   from the browser and leaving the catalog in an inconsistent state, so the
//   decision endpoints throw `NotImplemented` until the callable is wired up.
//
// Boundary rules (encoded in this module):
//   - No new npm deps. We use the existing `firebase/firestore` modular SDK.
//   - The `source` field is a closed union — see `ReviewSource`. Adding a new
//     value requires a code change AND a corresponding rules update. The UI
//     ALWAYS sees `source` as one of these tags; any string outside the union
//     is rejected at the type layer, matching Sprint 12 closed-union policy
//     (we deliberately don't even hint at retired source tags to keep the
//     compliance boundary clean).
//   - Time-handling: this module NEVER calls Date.now() / new Date() at module
//     top-level. `submittedAt`, `reviewedAt`, etc. are all caller-supplied
//     epoch ms read inside Firestore callbacks (the rule from Sprint 12 /
//     Sprint 14 — preserved here).
//   - PII: this queue may carry `ocrPrefillSnapshot` (already sanitized by
//     `MissingProductModal.sanitizeOcrSnapshot()` upstream). We DO NOT carry
//     客戶 PII in this collection. If a future writer leaks PII, the admin UI
//     still won't surface client-identifying fields — see `context` shape.
//   - Admin-only: rules already enforce `isAdmin()` for read/update/delete on
//     `insurance_products_pending`. This module assumes the same for the
//     unified `insurance_review_queue` collection (rules diff lands in W2 when
//     we collapse pending + tii_changes + scrape into one queue).

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  where,
  type Query,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Kind of change being proposed.
 *  - new_product: a商品 not currently in catalog (most advisor crowdsourced
 *    submissions land here)
 *  - version_revision: existing商品 has a新版條款 (TII diff classifier flags
 *    a PDF SHA-256 change → submit as proposed new version)
 *  - discontinued: 停售標記 (TII drops商品 from monthly listing)
 *  - company_metadata_change: 公司中文名 / sourceUrl / 統編 changed
 *  - crowdsourced: advisor 補登 (legacy bucket for items predating typed
 *    sources; kept so existing pending docs render correctly during migration)
 */
export type ReviewType =
  | 'new_product'
  | 'version_revision'
  | 'discontinued'
  | 'company_metadata_change'
  | 'crowdsourced';

/** Where the proposed change came from. Closed union (compliance boundary).
 *  - tii_monthly: scripts/crawl-tii-monthly.cjs (W1 ships skeleton)
 *  - advisor_crowd: MissingProductModal → insurance_products_pending
 *  - company_scrape: future per-insurer scraper (W3+)
 */
export type ReviewSource = 'tii_monthly' | 'advisor_crowd' | 'company_scrape';

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'merged';

/** A single proposed field change. `before` and `after` are deliberately
 *  `unknown` — diffs can be primitives, nested objects, or even arrays of
 *  attachments; the UI is responsible for rendering them safely. */
export interface ReviewFieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface ReviewProposed {
  productId: string;
  productVersion: string;
  changes: ReviewFieldChange[];
  /** Storage path to the supporting PDF, if any. Not the signed URL — that's
   *  fetched on demand by `PdfViewer` via `/api/pdf-proxy`. */
  pdfStoragePath?: string;
  /** SHA-256 of the PDF bytes (hex). Used by the merge engine to detect
   *  duplicate submissions of the same revision. */
  pdfSha256?: string;
}

/** Sanitized context surfaced to the admin reviewer. Anything client-PII is
 *  filtered upstream — this shape is the contract. */
export interface ReviewContext {
  diffSummary: string;
  advisorNote?: string;
  /** Pre-sanitized OCR snapshot (catalog-shape fields only — no client name,
   *  ID number, phone, address, policy number). See
   *  `MissingProductModal.sanitizeOcrSnapshot()` upstream. */
  ocrPrefillSnapshot?: Record<string, unknown>;
  /** Batch tag from the monthly crawler, e.g. `tii-2026-06`. */
  tiiCrawlBatch?: string;
}

export interface ReviewDecision {
  outcome: 'approved' | 'rejected' | 'need_more_info';
  reason: string;
  mergeStrategy:
    | 'as_new_version'
    | 'update_active'
    | 'create_new_product'
    | 'reject';
}

export interface ReviewQueueItem {
  id: string;
  type: ReviewType;
  source: ReviewSource;
  /** epoch ms — written by upstream submitter (TII crawler, advisor modal,
   *  scraper). Never read from module top-level. */
  submittedAt: number;
  /** Free string — TII batch tag, advisor uid, or scraper id. We don't bind
   *  it to a uid type because the three sources have different identity
   *  shapes and we don't want to over-couple. */
  submittedBy: string;
  status: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: number | null;
  proposed: ReviewProposed;
  context: ReviewContext;
  decision?: ReviewDecision;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Unified queue collection. Sprint 15 W2 will merge
 *  `insurance_products_pending` into this; W1 reads it directly. */
const COLLECTION = 'insurance_review_queue';

// ---------------------------------------------------------------------------
// Filter & options
// ---------------------------------------------------------------------------

export interface ListFilter {
  status?: ReviewStatus | 'all';
  type?: ReviewType;
  source?: ReviewSource;
}

export interface ListOptions {
  /** Page size. Default 25 to match the UI pagination. */
  limit?: number;
  /** Free-text search over company / productName / productCode.
   *  Firestore doesn't natively support contains-search; we fall back to
   *  client-side filtering on the fetched page. Acceptable because admin
   *  queue volume is low (<10k pending typical). */
  search?: string;
}

// ---------------------------------------------------------------------------
// Defensive parse
// ---------------------------------------------------------------------------

/** Validate `source` at read time — compliance critical, see file header. */
function isValidSource(s: unknown): s is ReviewSource {
  return s === 'tii_monthly' || s === 'advisor_crowd' || s === 'company_scrape';
}

function isValidStatus(s: unknown): s is ReviewStatus {
  return (
    s === 'pending' || s === 'approved' || s === 'rejected' || s === 'merged'
  );
}

function isValidType(t: unknown): t is ReviewType {
  return (
    t === 'new_product' ||
    t === 'version_revision' ||
    t === 'discontinued' ||
    t === 'company_metadata_change' ||
    t === 'crowdsourced'
  );
}

/** Convert a Firestore snapshot into a typed `ReviewQueueItem`, or `null` if
 *  the shape is unrecognizable. We err on the side of dropping rather than
 *  surfacing partial / unsafe data to the admin. */
function fromDoc(snap: any): ReviewQueueItem | null {
  const data = snap?.data?.();
  if (!data) return null;

  if (!isValidSource(data.source)) return null;
  if (!isValidStatus(data.status)) return null;
  if (!isValidType(data.type)) return null;

  const proposed = data.proposed || {};
  const context = data.context || {};

  return {
    id: snap.id,
    type: data.type,
    source: data.source,
    submittedAt: Number(data.submittedAt) || 0,
    submittedBy: String(data.submittedBy || ''),
    status: data.status,
    reviewedBy: data.reviewedBy ?? null,
    reviewedAt: data.reviewedAt ?? null,
    proposed: {
      productId: String(proposed.productId || ''),
      productVersion: String(proposed.productVersion || ''),
      changes: Array.isArray(proposed.changes) ? proposed.changes : [],
      pdfStoragePath: proposed.pdfStoragePath,
      pdfSha256: proposed.pdfSha256,
    },
    context: {
      diffSummary: String(context.diffSummary || ''),
      advisorNote: context.advisorNote,
      ocrPrefillSnapshot: context.ocrPrefillSnapshot,
      tiiCrawlBatch: context.tiiCrawlBatch,
    },
    decision: data.decision,
  };
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

/** List items for the admin queue. Sorted by `submittedAt` desc, paginated by
 *  `limit` (default 25). Search is applied client-side over company /
 *  productName / productCode — see `ListOptions.search`.
 *
 *  Rules-protected: rejected reads return `[]` so callers don't have to
 *  branch on auth failure. The UI should still gate the route with `isAdmin`
 *  to avoid a wasted Firestore read.
 */
export async function listReviewQueue(
  filter: ListFilter = {},
  opts: ListOptions = {},
): Promise<ReviewQueueItem[]> {
  const pageSize = Math.max(1, Math.min(opts.limit ?? 25, 200));

  // Build the query incrementally — we only add `where` for non-'all' status
  // so the index requirements stay simple (single-field index on `status` +
  // `submittedAt`).
  let q: Query = collection(db, COLLECTION) as unknown as Query;

  // Important: Firestore requires the orderBy field to also appear in the
  // last `where` inequality if we mix inequality + orderBy. We only use
  // equality filters here, so this is safe.
  const wheres: Array<[string, '==', unknown]> = [];
  if (filter.status && filter.status !== 'all') {
    wheres.push(['status', '==', filter.status]);
  }
  if (filter.type) wheres.push(['type', '==', filter.type]);
  if (filter.source) wheres.push(['source', '==', filter.source]);

  // Compose
  const base = collection(db, COLLECTION);
  const composed =
    wheres.length === 0
      ? query(base, orderBy('submittedAt', 'desc'), fsLimit(pageSize))
      : query(
          base,
          ...wheres.map(([f, op, v]) => where(f, op, v)),
          orderBy('submittedAt', 'desc'),
          fsLimit(pageSize),
        );
  q = composed;

  try {
    const snap = await getDocs(q);
    const items: ReviewQueueItem[] = [];
    snap.forEach((d) => {
      const item = fromDoc(d);
      if (item) items.push(item);
    });

    // Optional client-side search filter.
    if (opts.search && opts.search.trim()) {
      const needle = opts.search.trim().toLowerCase();
      return items.filter((it) => {
        // Search across the productId (which encodes companySlug_productCode)
        // and any catalog-shape strings in the changes array.
        const hay = [
          it.proposed.productId,
          it.proposed.productVersion,
          it.context.diffSummary,
          ...it.proposed.changes
            .flatMap((c) => [
              c.field,
              typeof c.after === 'string' ? c.after : '',
              typeof c.before === 'string' ? c.before : '',
            ])
            .filter(Boolean),
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(needle);
      });
    }

    return items;
  } catch (err) {
    // Most likely cause in dev: missing composite index for (status,
    // submittedAt) or (type, submittedAt). Surface to console so admin can
    // spot it during local QA; return [] so the UI shows the empty state.
    // We deliberately swallow here (vs. throwing) because the queue page is
    // already gated behind `isAdmin` — auth failures here are not actionable
    // for the admin user.
    console.warn('[insuranceReviewQueue] listReviewQueue failed:', err);
    return [];
  }
}

export async function getReviewQueueItem(
  id: string,
): Promise<ReviewQueueItem | null> {
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return fromDoc(snap);
  } catch (err) {
    console.warn('[insuranceReviewQueue] getReviewQueueItem failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Decision endpoints — Sprint 15 W1 stubs, partial wiring in W2
// ---------------------------------------------------------------------------
//
// W1 shipped these as throw-stubs. W2 wires ONLY the
// `version_revision` approve path — that one is handled in the admin UI by
// calling `notifyConditionRevision` directly (the backend callable updates the
// review queue status to 'merged' as part of fanout, so we don't need a
// separate decision callable for this branch).
//
// `new_product`, `discontinued`, `company_metadata_change`, reject, and
// need_more_info STILL throw NotImplemented in W2 — backend `reviewQueueDecision`
// callable lands W3 (catalog promo / company-doc patch / submitter notify).
// We keep these as functions so the UI imports stay stable; admin UI must
// check `item.type === 'version_revision'` before calling `approveReview`.

const NOT_IMPLEMENTED_MSG =
  'Sprint 15 W2：非 version_revision 的決策路徑尚未實作（待 W3 reviewQueueDecision callable）';

/** Sprint 15 W1 stub — throws `NotImplemented`. Admin UI must NOT call this
 *  for `version_revision` items; it should call `notifyConditionRevision`
 *  directly (the fanout callable updates the queue status server-side).
 *
 *  Kept as an explicit function (vs. removed) so other admin tools that import
 *  this don't fail at build — they just fail loudly at runtime when an admin
 *  tries to approve a non-revision item before W3 ships. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function approveReview(
  _id: string,
  _decision: ReviewDecision,
): Promise<void> {
  throw new Error(NOT_IMPLEMENTED_MSG);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function rejectReview(_id: string, _reason: string): Promise<void> {
  throw new Error(NOT_IMPLEMENTED_MSG);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function requestMoreInfo(
  _id: string,
  _message: string,
): Promise<void> {
  throw new Error(NOT_IMPLEMENTED_MSG);
}

// ---------------------------------------------------------------------------
// Sprint 15 W2 condition-revision notification + LLM diff summary
// ---------------------------------------------------------------------------
//
// The "fanout" callable scans all client policies that bind to
// (productId, oldVersion), emails the owning advisor of each, and writes a
// `condition_alerts` doc per (advisor, client) pair. The UI calls this
// AFTER admin confirms the approve dialog on a `version_revision` item.
//
// The LLM diff callable returns a Gemini-generated natural-language summary
// of the chunk-level diff between v1 and v2. The admin sees this in the
// review card so they can sanity-check before approving. It is invoked
// on-demand (button click) — never auto-fetched on list load — because each
// call burns Gemini quota.

export type NotifyConditionRevisionInput = {
  productId: string;
  oldVersion: string;
  newVersion: string;
  /** The originating review queue doc — used for audit + idempotency. */
  reviewQueueId: string;
};

/** Backend return shape — mirrors `notifyConditionRevision` in
 *  `functions/index.js` exactly. Field names match the callable's response
 *  contract; the UI derives `partialFailure` from `writeErrors.length > 0`
 *  rather than asking the backend to set a separate flag. */
export type NotifyConditionRevisionResult = {
  /** Unique fanout run id — useful for cross-referencing audit logs. */
  runId: string;
  /** Number of policy docs scanned (pre-grouping). */
  processed: number;
  /** Number of advisors actually touched (distinct advisor uids). */
  notifiedAdvisors: number;
  /** Total affected client rows across all advisors. */
  totalAffectedClients: number;
  /** Number of `conditionAlerts/{alertId}` docs actually written
   *  (>= notifiedAdvisors when an advisor's clients overflow the per-doc
   *  chunk size and we write multiple `_pN` shards). */
  alertDocsWritten: number;
  /** First few write failures (advisor uid + alert id + message). Used by
   *  the UI to render a retry banner. The fanout intentionally keeps going
   *  past per-doc write failures so a single bad shard doesn't abort the
   *  whole run; partial-failure status is derived from `writeErrors.length`. */
  writeErrors: Array<{ advisorUid: string; alertId: string; message: string }>;
  dryRun: boolean;
};

/** Trigger the condition-revision fanout. Caller must have already
 *  invoked `approveReview` and confirmed the user understood the impact.
 *  Throws on hard backend failure; soft failures arrive as
 *  `result.partialFailure`. */
export async function notifyConditionRevision(
  input: NotifyConditionRevisionInput,
): Promise<NotifyConditionRevisionResult> {
  const fn = httpsCallable<NotifyConditionRevisionInput, NotifyConditionRevisionResult>(
    functions,
    'notifyConditionRevision',
  );
  const res = await fn(input);
  return res.data;
}

export type ComposeConditionDiffSummaryInput = {
  reviewQueueId: string;
};

export type ComposeConditionDiffSummaryResult = {
  ok: boolean;
  /** Natural-language summary, generated by Gemini 2.5 Pro. May be empty
   *  when the backend determines there's no meaningful textual diff (e.g.
   *  metadata-only change). */
  summary: string;
  /** Bullet-point highlights for quick scanning. */
  highlights?: string[];
  /** Always set so the UI can render the mandated disclaimer verbatim. */
  disclaimer: string;
  /** Token / cost telemetry, optional. */
  modelUsed?: string;
};

/** Lazy LLM diff summary fetch. Result is NOT cached client-side — admins
 *  often want a fresh read. Caller is responsible for spinner state. */
export async function composeConditionDiffSummary(
  input: ComposeConditionDiffSummaryInput,
): Promise<ComposeConditionDiffSummaryResult> {
  const fn = httpsCallable<
    ComposeConditionDiffSummaryInput,
    ComposeConditionDiffSummaryResult
  >(functions, 'composeConditionDiffSummary');
  const res = await fn(input);
  return res.data;
}

// ---------------------------------------------------------------------------
// UI helpers (kept here so the UI module stays render-focused)
// ---------------------------------------------------------------------------

/** Human-readable label for a source tag. */
export function describeSource(src: ReviewSource): string {
  switch (src) {
    case 'tii_monthly':
      return 'TII 月排程';
    case 'advisor_crowd':
      return '顧問補登';
    case 'company_scrape':
      return '公司抓取';
  }
}

/** Human-readable label for a type tag. */
export function describeType(t: ReviewType): string {
  switch (t) {
    case 'new_product':
      return '新商品';
    case 'version_revision':
      return '條款修訂';
    case 'discontinued':
      return '停售';
    case 'company_metadata_change':
      return '公司資料變更';
    case 'crowdsourced':
      return '顧問補登';
  }
}

/** Format epoch ms → "YYYY-MM-DD HH:MM" using the local timezone.
 *  Caller passes in a pre-fetched epoch (e.g. from a row's `submittedAt`);
 *  this helper itself does NOT read the wall clock. */
export function formatSubmittedAt(epochMs: number): string {
  if (!epochMs) return '—';
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
