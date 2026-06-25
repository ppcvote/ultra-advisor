// Sprint 12 — Insurance Products catalog (client-side read helpers).
//
// Why this module:
//   Sprint 12 stands up the long-term plumbing for an in-house insurance
//   product catalog. Two data sources upstream (TII public condition PDFs as
//   the ship source, plus an internal research index used purely offline as a
//   catalog hint), one Firestore collection downstream: `insurance_products`.
//
//   This file is the CLIENT-SIDE read surface only. Writes are owned by the
//   crawler living in `scripts/` (and possibly a future Cloud Function) — the
//   advisor app should never insert/update product docs from the browser, both
//   to keep Firestore rules tight and to keep the source-of-truth pipeline in
//   one place. Hence: no addDoc/setDoc/updateDoc exports here.
//
// Source-policy guardrails (encoded in the type system):
//   - `source` is a CLOSED union of {'tii', 'company_website', 'lia_roc'}.
//     We deliberately do NOT add 'insurance_winner' (or any equivalent) as a
//     valid value. If a future contributor tries to write/query with that
//     string, TypeScript fails the compile. Strategic boundary (Sprint 12
//     鐵則) lives at the type layer, not in a doc comment that gets ignored.
//   - `sourceUrl` is non-optional. Every product row must be defensible — if
//     a regulator or journalist asks "where did this clause come from?", we
//     point at TII / the insurer's own website. No URL → no row.
//
// Time-handling rule:
//   `crawledAt` is caller-supplied (epoch ms). The crawler reads the wall
//   clock inside its per-record loop body — not at module top level, not at
//   batch start. This module never calls Date.now() at all; it only consumes
//   timestamps already on the wire. (Matches the Sprint 7 codec convention
//   and the explicit Sprint 12 rule: "現在時間 must be obtained in callback".)
//
// Why no firebase-admin import:
//   This file is bundled into the browser app. Admin SDK is server-only and
//   would either fail the build or leak service-account creds. The crawler
//   side will use admin SDK in `scripts/` / `functions/` — separate file.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Top-level category. Kept small + stable on purpose — sub-types vary
 *  wildly across insurers, so the granular split goes in `categorySub` as a
 *  free string. This 8-bucket enum is the one we promise to keep stable for
 *  filters / dashboards / analytics.
 */
export type InsuranceCategoryMain =
  | 'life'              // 壽險（含終身、定期）
  | 'medical'           // 醫療（住院、實支實付、手術）
  | 'critical'          // 重大疾病 / 特定傷病
  | 'accident'          // 意外傷害
  | 'disability'        // 失能扶助
  | 'longTermCare'      // 長期照顧
  | 'annuity'           // 年金
  | 'investmentLinked'; // 投資型

/** Product life-cycle state.
 *  - active: currently sold, condition PDF still authoritative
 *  - discontinued: 停售，但已售出保單仍在生效，條款仍須查得到
 *  - revised: 條款修訂中／已被新版本取代（保留舊版供查驗）
 */
export type ProductStatus = 'active' | 'discontinued' | 'revised';

/** Permitted source provenance.
 *  Closed union by design — see file header. Do NOT extend this without
 *  walking through the compliance / messaging implications.
 */
export type InsuranceProductSource = 'tii' | 'company_website' | 'lia_roc';

/** Crawler identity stamp.
 *  Free string so we can bump versions without code changes in this file,
 *  but convention: `<crawler>-v<n>` (e.g. 'tii-v1', 'lia-roc-v2').
 */
export type CrawlerVersion = string;

export interface InsuranceProduct {
  /** Document ID: `{companySlug}_{productCode}`. Stable, human-readable,
   *  collision-safe across insurers because `companySlug` is unique. */
  id: string;

  /** Normalized 公司名稱 (繁中, full form) — e.g. '國泰人壽'. */
  company: string;
  /** kebab-case slug — e.g. 'cathay-life'. Used in `id` and in URLs. */
  companySlug: string;

  /** 商品全名（與 TII / 公司官網一致）. */
  productName: string;
  /** 公司內部商品代碼（TII 公開欄位）. */
  productCode: string;

  categoryMain: InsuranceCategoryMain;
  /** Sub-category as free string — e.g. '終身壽險' / '定期壽險' / '實支實付'.
   *  Intentionally loose because insurer naming varies; we normalize in queries. */
  categorySub?: string;

  /** Condition effective date, ISO `yyyy-mm-dd`. Optional because some legacy
   *  TII rows ship without a clean date stamp. */
  effectiveDate?: string;

  status: ProductStatus;

  // ── Source provenance ──────────────────────────────────────────────────
  /** Closed union — never accept 'insurance_winner' or unknown providers. */
  source: InsuranceProductSource;
  /** REQUIRED. Canonical URL on TII / insurer's own site. */
  sourceUrl: string;
  /** Firebase Storage object path for the condition PDF
   *  (e.g. `insurance-products/cathay-life/X123.pdf`). Optional because some
   *  rows are catalog-only (no PDF fetched yet). */
  pdfStoragePath?: string;
  /** SHA-256 of the PDF bytes (hex). Lets us detect silent re-publishes and
   *  triggers `revised` status transitions. */
  pdfSha256?: string;

  // ── Metadata ───────────────────────────────────────────────────────────
  /** epoch ms — caller (crawler) supplies this from a callback-scoped Date.now(). */
  crawledAt: number;
  crawlerVersion: CrawlerVersion;
  /** Schema version — bump when shape changes incompatibly. */
  schemaVersion: 1;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const COLLECTION = 'insurance_products';

/** Defensive parse — Firestore returns `any`, but we want callers to get a
 *  typed object. We do NOT validate every field at runtime (too expensive on
 *  hot read paths); the crawler is responsible for shape correctness. We only
 *  guard the source field because that's the compliance-critical one — a
 *  doc with an unknown source is dropped, not surfaced.
 */
function fromDoc(snap: any): InsuranceProduct | null {
  const data = snap?.data?.();
  if (!data) return null;
  const src = data.source;
  if (src !== 'tii' && src !== 'company_website' && src !== 'lia_roc') {
    // Silently drop. Logging at warn level is fine but we keep it quiet to
    // avoid noise during bulk reads — the crawler-side validator is where
    // bad rows should be caught loudly.
    return null;
  }
  return { id: snap.id, ...data } as InsuranceProduct;
}

// ---------------------------------------------------------------------------
// Public read helpers
// ---------------------------------------------------------------------------

/**
 * All products by a given insurer. Ordered by productName for stable UI.
 * `company` must match the normalized 繁中 name (e.g. '國泰人壽') — callers
 * typically already have this from a company-picker, so we don't fuzzy-match.
 */
export async function getProductsByCompany(
  company: string
): Promise<InsuranceProduct[]> {
  const q = query(
    collection(db, COLLECTION),
    where('company', '==', company),
    orderBy('productName', 'asc')
  );
  const snap = await getDocs(q);
  const out: InsuranceProduct[] = [];
  snap.forEach((d) => {
    const p = fromDoc(d);
    if (p) out.push(p);
  });
  return out;
}

/**
 * All products in a top-level category. Ordered by company then product
 * name so the same insurer's products cluster together.
 */
export async function getProductsByCategory(
  cat: InsuranceCategoryMain
): Promise<InsuranceProduct[]> {
  const q = query(
    collection(db, COLLECTION),
    where('categoryMain', '==', cat),
    orderBy('company', 'asc'),
    orderBy('productName', 'asc')
  );
  const snap = await getDocs(q);
  const out: InsuranceProduct[] = [];
  snap.forEach((d) => {
    const p = fromDoc(d);
    if (p) out.push(p);
  });
  return out;
}

/**
 * Single product by ID. Returns null when not found (NOT throws) — callers
 * usually want to render an empty state rather than crash on a stale URL.
 */
export async function getProductById(
  id: string
): Promise<InsuranceProduct | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return fromDoc(snap);
}

/**
 * Substring search across product name. Firestore doesn't have native
 * full-text, so this is a pragmatic prefix-style filter using the
 * `>= q && <= q + ` trick on `productName`. Good enough for a
 * picker UI; if/when we need real search we move to Algolia / Typesense.
 *
 * Empty query returns the first N rows ordered by productName.
 */
export async function searchProducts(
  q: string,
  opts?: { limit?: number }
): Promise<InsuranceProduct[]> {
  const max = Math.max(1, Math.min(opts?.limit ?? 20, 100));
  const term = (q ?? '').trim();
  let fq;
  if (term.length === 0) {
    fq = query(
      collection(db, COLLECTION),
      orderBy('productName', 'asc'),
      fsLimit(max)
    );
  } else {
    // Firestore range-prefix idiom.
    fq = query(
      collection(db, COLLECTION),
      orderBy('productName', 'asc'),
      where('productName', '>=', term),
      where('productName', '<=', term + ''),
      fsLimit(max)
    );
  }
  const snap = await getDocs(fq);
  const out: InsuranceProduct[] = [];
  snap.forEach((d) => {
    const p = fromDoc(d);
    if (p) out.push(p);
  });
  return out;
}
