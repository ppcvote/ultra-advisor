// Sprint 14 Week 1 — task B7 shared constants
//
// Centralized zh-TW labels for the 8 stable `InsuranceCategoryMain` buckets
// plus an `'other'` fallback for UI surfaces that fold uncategorized rows
// into a visible bucket (catalog match miss flags, OCR low-confidence
// classifications, legacy productCache rows etc.). Keeping these strings in
// one place so the advisor-facing copy stays consistent across PolicyForm,
// catalog alignment panel, ProductAutocomplete dropdown and any future
// dashboard filter.
//
// Why not inline the strings in each component:
//   - 5+ surfaces in Sprint 14 W1 alone (PolicyForm catalog section,
//     MissingProductModal, ProductAutocomplete badge, premiumEstimator
//     reject reason, InsuranceCheckupView summary). Drift between surfaces
//     leaks insurer-internal vs advisor-facing tone if labels diverge.
//   - The premium estimator hard-rule (only life / medical / critical are
//     close-form estimatable; everything else must be rejected with a
//     "needs insurer quote" message) belongs alongside the label table,
//     not buried in premiumEstimator.ts — multiple call sites need to ask
//     "can I estimate this?" before even rendering an estimate UI.
//
// Strategic guardrails (Sprint 14 鐵則):
//   - 0 npm dependencies (this is a const-only module).
//   - Read-only data — `as const` on the Set, `Record<...>` for labels.
//   - No runtime wall-clock reads; this module never calls Date.now().
//   - The estimatable set is intentionally narrow. Investment-linked,
//     annuity, longTermCare, disability, accident all have either
//     market-driven cash values (investmentLinked), unpublished incidence
//     tables (longTermCare, disability), or per-insurer claim-cost models
//     (accident, medical riders) that make a single ±25% range
//     misleading. Adding to this set requires Phase 2 actuarial review.
//   - DO NOT extend `'other'` into `InsuranceCategoryMain` — the closed
//     8-bucket union in `insuranceProducts.ts` is the stable contract for
//     Firestore filters / dashboards. `'other'` is a UI-only fallback.

import type { InsuranceCategoryMain } from './insuranceProducts';

/**
 * zh-TW label for each `InsuranceCategoryMain` bucket plus an `'other'`
 * fallback. Sub-categories (`categorySub`) stay free-form per
 * insuranceProducts.ts and are not translated here — they ride the
 * insurer's wording into the UI verbatim.
 *
 * The advisor-facing wording is the one Min Yi has used on policy review
 * sheets for 10 years; do not soften ("失能扶助" not "失能保障", "重大疾病"
 * not "重疾").
 */
export const CATEGORY_LABEL_ZH: Record<InsuranceCategoryMain | 'other', string> = {
  life: '壽險',
  medical: '醫療',
  critical: '重大疾病',
  accident: '意外傷害',
  disability: '失能扶助',
  longTermCare: '長期照顧',
  annuity: '年金',
  investmentLinked: '投資型',
  other: '其他',
};

/**
 * Categories the premium estimator (`premiumEstimator.ts`) is allowed to
 * produce a ±25% range for. Anything not in this set must be rejected
 * with the "需保險公司報價" message — see Sprint 14 鐵則 "不可估算商品
 * 類型 (投資型 / 年金 / 利變 / 萬能 / 附約 / 實支實付 / 自然費率)".
 *
 * Why only 3 buckets:
 *   - life: traditional whole-life / level-premium term has a clean
 *     close-form expression based on TSO 2021 q(x), predetermined
 *     interest rate, and a published industry loading band. ±25%
 *     covers the loading uncertainty.
 *   - medical: defined-benefit daily-allowance plans only (NOT
 *     reimbursement / 實支實付 — those vary 3x+ across insurers).
 *     The advisor must still confirm the plan type before trusting
 *     the estimate; the UI shows a "definite-benefit only" note.
 *   - critical: lump-sum traditional plans only. Multi-claim /
 *     installment / cancer-specific plans are rejected by sub-type
 *     even though `categoryMain === 'critical'`.
 *
 * `medical` and `critical` are conditional — the estimator does its
 * own sub-type sniff before returning a range. The advisor never sees
 * an estimate for investment-linked, annuity, longTermCare,
 * disability, or accident.
 */
export const PREMIUM_ESTIMATABLE_CATEGORIES: ReadonlySet<InsuranceCategoryMain> = new Set<
  InsuranceCategoryMain
>(['life', 'medical', 'critical']);

/**
 * Convenience predicate so callers don't have to import the Set + the
 * `InsuranceCategoryMain` type just to ask the gating question.
 * Returns false for `undefined` / `'other'` / any unknown string, so
 * UI code can do `if (!isPremiumEstimatable(cat)) return null;`
 * without an explicit narrowing step.
 */
export function isPremiumEstimatable(
  category: InsuranceCategoryMain | 'other' | undefined | null
): category is InsuranceCategoryMain {
  if (!category) return false;
  return PREMIUM_ESTIMATABLE_CATEGORIES.has(category as InsuranceCategoryMain);
}
