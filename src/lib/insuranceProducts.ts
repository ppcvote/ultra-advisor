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

// ---------------------------------------------------------------------------
// Sprint 14 W1 — additional read helpers
// ---------------------------------------------------------------------------
//
// Why these exist (and why not as variants of the originals):
//   Sprint 14 wires OCR -> catalog match + advisor-typed autocomplete. The
//   existing `getProductsByCompany` / `getProductsByCategory` / `searchProducts`
//   contracts are stable and consumed by Sprint 12/13 callers, so we add new
//   helpers rather than mutate signatures (Sprint 14 hard rule: do not change
//   existing helper signatures).
//
//   Two raw fields below — `saled: boolean` and `lineOfBusiness: 'life'|'pnc'`
//   — are present on the catalog Firestore docs (written by
//   `scripts/parse-insurance-database.cjs`) but intentionally NOT lifted onto
//   the `InsuranceProduct` TS interface yet. We query them as raw Firestore
//   fields without widening the public type: that keeps Sprint 12's compliance
//   surface (closed source union, required sourceUrl) the only thing the rest
//   of the app sees, while still letting Sprint 14 filter by sale state and
//   line of business. If/when those fields become part of the user-facing
//   contract we can promote them in a single typed edit.

const DEFAULT_AUTOCOMPLETE_LIMIT = 20;
const MAX_AUTOCOMPLETE_LIMIT = 100;

// Firestore range-upper-bound sentinel: U+F8FF (Private Use Area). Matches the
// existing `searchProducts` idiom — kept as a const here so the new helpers
// don't sprinkle the magic char inline.
const RANGE_UPPER = '';

function clampLimit(n: number | undefined, fallback = DEFAULT_AUTOCOMPLETE_LIMIT): number {
  return Math.max(1, Math.min(n ?? fallback, MAX_AUTOCOMPLETE_LIMIT));
}

/**
 * Lookup by `companySlug` — the kebab-case stable identifier used in doc IDs
 * and URLs. This is the helper ProductAutocomplete should call once the
 * advisor has picked an insurer, because the slug is collision-proof across
 * brand renames (whereas the Chinese full name is not).
 *
 * `activeOnly` defaults to `true` because the picker should hide discontinued
 * products from new-policy entry by default; legacy lookups (existing policy
 * edit) can pass `false` to include all states.
 */
export async function searchProductsByCompanySlug(
  companySlug: string,
  opts?: { limit?: number; activeOnly?: boolean }
): Promise<InsuranceProduct[]> {
  const max = clampLimit(opts?.limit);
  const activeOnly = opts?.activeOnly ?? true;
  const constraints: any[] = [where('companySlug', '==', companySlug)];
  if (activeOnly) constraints.push(where('status', '==', 'active'));
  constraints.push(orderBy('productName', 'asc'));
  constraints.push(fsLimit(max));
  const fq = query(collection(db, COLLECTION), ...constraints);
  const snap = await getDocs(fq);
  const out: InsuranceProduct[] = [];
  snap.forEach((d) => {
    const p = fromDoc(d);
    if (p) out.push(p);
  });
  return out;
}

/**
 * Search by company full name (Chinese). Mirrors `getProductsByCompany` but
 * adds a limit/activeOnly knob so callers can page or restrict to currently
 * sold products without pulling 100+ rows. Kept separate from
 * `getProductsByCompany` to honour the Sprint 14 hard rule (do not change
 * existing helper signatures).
 */
export async function searchProductsByCompany(
  company: string,
  opts?: { limit?: number; activeOnly?: boolean }
): Promise<InsuranceProduct[]> {
  const max = clampLimit(opts?.limit);
  const activeOnly = opts?.activeOnly ?? true;
  const constraints: any[] = [where('company', '==', company)];
  if (activeOnly) constraints.push(where('status', '==', 'active'));
  constraints.push(orderBy('productName', 'asc'));
  constraints.push(fsLimit(max));
  const fq = query(collection(db, COLLECTION), ...constraints);
  const snap = await getDocs(fq);
  const out: InsuranceProduct[] = [];
  snap.forEach((d) => {
    const p = fromDoc(d);
    if (p) out.push(p);
  });
  return out;
}

/**
 * Compound filter: company + top-level category. This is the workhorse for
 * the Sprint 14 OCR -> catalog match flow. Once OCR has identified the
 * insurer and the rough category (e.g. Cathay Life + 'medical'), we narrow
 * to the slim subset and let `fuzzyMatchProductLocal` do the rest
 * client-side without burning more Firestore reads.
 *
 * Composite index required: (companySlug ASC, categoryMain ASC, productName ASC),
 * plus the same with `status` if `activeOnly` is true. Firestore will surface
 * a one-click index creation link in the console the first time it runs.
 */
export async function searchProductsByCompanyAndCategory(
  companySlug: string,
  categoryMain: InsuranceCategoryMain,
  opts?: { activeOnly?: boolean; limit?: number }
): Promise<InsuranceProduct[]> {
  const max = clampLimit(opts?.limit);
  const activeOnly = opts?.activeOnly ?? true;
  const constraints: any[] = [
    where('companySlug', '==', companySlug),
    where('categoryMain', '==', categoryMain),
  ];
  if (activeOnly) constraints.push(where('status', '==', 'active'));
  constraints.push(orderBy('productName', 'asc'));
  constraints.push(fsLimit(max));
  const fq = query(collection(db, COLLECTION), ...constraints);
  const snap = await getDocs(fq);
  const out: InsuranceProduct[] = [];
  snap.forEach((d) => {
    const p = fromDoc(d);
    if (p) out.push(p);
  });
  return out;
}

/**
 * Product-code prefix search inside one insurer.
 *
 * Why scoped to companySlug: product codes are NOT globally unique — TII lets
 * each insurer name their codes freely, so 'A123' could exist at three
 * different companies. Forcing the caller to pass companySlug keeps the
 * results unambiguous and lets us use the same range-prefix idiom as
 * `searchProducts`. Empty `codePrefix` returns the first N codes for the
 * insurer (useful debugging path; intentionally not gated).
 */
export async function searchProductsByCodePrefix(
  companySlug: string,
  codePrefix: string,
  opts?: { limit?: number }
): Promise<InsuranceProduct[]> {
  const max = clampLimit(opts?.limit);
  const prefix = (codePrefix ?? '').trim();
  let fq;
  if (prefix.length === 0) {
    fq = query(
      collection(db, COLLECTION),
      where('companySlug', '==', companySlug),
      orderBy('productCode', 'asc'),
      fsLimit(max)
    );
  } else {
    fq = query(
      collection(db, COLLECTION),
      where('companySlug', '==', companySlug),
      orderBy('productCode', 'asc'),
      where('productCode', '>=', prefix),
      where('productCode', '<=', prefix + RANGE_UPPER),
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

/**
 * Filter by raw `saled` boolean (and optionally line of business).
 *
 * `saled: true` mostly mirrors status 'active' on TII rows, but the crawler
 * writes both fields and they CAN diverge (e.g. a doc still flagged
 * `saled: true` by the source feed while we've manually marked it 'revised'
 * locally). Sprint 14 W1 needs a way to ask the raw question — "is the
 * insurer still selling this?" — without that local override, hence this
 * helper exists in parallel to `activeOnly` on the others.
 *
 * `lineOfBusiness` is the raw TII split: 'life' (人身保險) vs 'pnc' (產險).
 * Stays as a string parameter (not enum) because we don't want to lock that
 * union into the public type system until the field graduates onto
 * `InsuranceProduct`.
 */
export async function searchProductsBySaled(
  saled: boolean,
  opts?: { limit?: number; lineOfBusiness?: 'life' | 'pnc' }
): Promise<InsuranceProduct[]> {
  const max = clampLimit(opts?.limit);
  const constraints: any[] = [where('saled', '==', saled)];
  if (opts?.lineOfBusiness) {
    constraints.push(where('lineOfBusiness', '==', opts.lineOfBusiness));
  }
  constraints.push(orderBy('productName', 'asc'));
  constraints.push(fsLimit(max));
  const fq = query(collection(db, COLLECTION), ...constraints);
  const snap = await getDocs(fq);
  const out: InsuranceProduct[] = [];
  snap.forEach((d) => {
    const p = fromDoc(d);
    if (p) out.push(p);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Sprint 14 W1 — client-side fuzzy match
// ---------------------------------------------------------------------------
//
// This runs entirely in memory after a (cheap) Firestore narrow-by-company
// fetch. The point is: ProductAutocomplete should NOT make a new Firestore
// read on every keystroke — pull ~100 products for the picked insurer once,
// debounce keystrokes, then re-rank locally. That's how we keep the 35k-row
// catalog cheap.
//
// Why not Levenshtein / Fuse.js: explicit Sprint 14 hard rule — no new deps.
// We implement a small substring + token-overlap scorer that handles the
// actual cases advisors hit (typo on the long full name, swapped order
// between productName and productCode, lowercase vs uppercase) without the
// kilobytes.

/** Score in [0,1]. Higher = better match. */
function scoreField(query: string, value: string | undefined): number {
  if (!value) return 0;
  const q = query.toLowerCase().trim();
  const v = value.toLowerCase().trim();
  if (q.length === 0 || v.length === 0) return 0;
  // Exact hit — strongest signal.
  if (v === q) return 1;
  // Prefix — second strongest (matches advisor typing left-to-right).
  if (v.startsWith(q)) return 0.9;
  // Substring anywhere — strong but not as strong as prefix.
  if (v.includes(q)) return 0.75;
  // Token overlap — split on whitespace + dashes + CJK punctuation; count
  // shared tokens. Length-normalized so a short query matching a 12-char
  // product name doesn't beat a tight 4-char match. Cheap O(n*m) on small
  // token counts.
  const splitRe = /[\s\-_/,]+/u;
  const qTokens = q.split(splitRe).filter(Boolean);
  const vTokens = v.split(splitRe).filter(Boolean);
  if (qTokens.length === 0 || vTokens.length === 0) return 0;
  let hits = 0;
  for (const qt of qTokens) {
    if (vTokens.some((vt) => vt.includes(qt) || qt.includes(vt))) hits++;
  }
  const overlap = hits / qTokens.length;
  // Cap at 0.6 so token-overlap can never beat a substring hit on a related
  // field — substring is intent-aligned (advisor really typed those chars in
  // a row), tokens are softer signal.
  return Math.min(0.6, overlap * 0.6);
}

/**
 * Pure, in-memory fuzzy match. No Firestore reads, no async, no side effects.
 *
 * Weighting (productName 0.6 / productCode 0.3 / companySlug 0.1) reflects
 * how advisors actually search — they type the product name most often, the
 * code occasionally (when the OCR returned one), and the company name almost
 * never as the discriminator (they already filtered by company elsewhere).
 *
 * `minScore` defaults to 0.2 to filter out near-noise; bump to 0.5+ for
 * "confident match only" use cases (e.g. auto-fill without confirmation).
 */
export function fuzzyMatchProductLocal(
  query: string,
  products: InsuranceProduct[],
  opts?: { limit?: number; minScore?: number }
): InsuranceProduct[] {
  const max = clampLimit(opts?.limit, products.length || DEFAULT_AUTOCOMPLETE_LIMIT);
  const minScore = opts?.minScore ?? 0.2;
  const q = (query ?? '').trim();
  if (q.length === 0) return products.slice(0, max);
  const scored: Array<{ p: InsuranceProduct; s: number }> = [];
  for (const p of products) {
    const sName = scoreField(q, p.productName) * 0.6;
    const sCode = scoreField(q, p.productCode) * 0.3;
    const sSlug = scoreField(q, p.companySlug) * 0.1;
    const s = sName + sCode + sSlug;
    if (s >= minScore) scored.push({ p, s });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, max).map((x) => x.p);
}
