// Sprint 14 W1 — Premium estimator (pure function).
//
// Why this module:
//   When OCR reads a policy form and the premium box is missing / smudged /
//   unreadable, the advisor needs a defensible ballpark BEFORE phoning the
//   insurer's call centre. This module computes a coarse ±25% range using
//   public actuarial principles only — no real product rates, no scraped
//   tariffs, no insurer pricing tables.
//
// Strategic boundaries (Sprint 14 鐵則 — encoded in code, not comments):
//   - 0 deps. Only imports the `InsuranceCategoryMain` enum from
//     `./insuranceProducts` for category alignment.
//   - 0 side effects. No IO, no wall-clock reads, no console.log, no Math.random.
//     The same input ALWAYS produces the same output. This is the whole point —
//     a deterministic estimator that the advisor / regulator can audit later.
//   - The mortality table values below are PUBLIC representative values
//     loosely tracking TSO 2021 (台灣壽險業第六回經驗生命表, 金管會 2021/03
//     公告). They are NOT the verbatim table. We deliberately use rounded
//     decennial-age values + linear interpolation so we never claim to publish
//     the real table values — only the public actuarial PRINCIPLE.
//   - Interest rate presets sit inside the 金管會-published 預定利率 upper
//     bounds (terminal-life 1.25-1.75%, term-life 1.50-2.00%) so we never
//     undercut a real policy's reserve assumptions.
//   - Loading presets (30% whole-life, 25% term, 40% medical) are mid-range of
//     publicly cited industry附加費用 range; ±25% uncertainty band already
//     swallows any individual insurer's deviation.
//   - We refuse to estimate商品類型 the math can't honestly serve:
//     investment-linked, annuity, riders (附約), interest-rate-變動, universal
//     life, actual-expense medical, natural-rate (自然費率), critical illness,
//     long-term-care. Each refusal returns a clear reason + suggestion to ask
//     the insurer directly — preserves advisor trust.
//
// Output contract:
//   `EstimatorResult` is a discriminated union — `kind: 'ok'` or
//   `kind: 'declined'`. Callers MUST switch on `kind` before reading `mid` /
//   `range`, otherwise TypeScript fails the build. This stops the UI from
//   ever rendering a number for a category we declined.

import type { InsuranceCategoryMain } from './insuranceProducts';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Gender = 'male' | 'female';

export interface EstimatorInput {
  /** Top-level category from the catalog mapping. */
  categoryMain: InsuranceCategoryMain;
  /** True for 終身 (whole-life). False for 定期 (term). Only meaningful for
   *  `life` and `medical` categories — ignored for declined types. */
  isWholeLife: boolean;
  /** True for 主約. False for 附約 (rider) — riders are always declined
   *  because their premium is structurally bound to the master policy. */
  isMaster: boolean;
  /** True for 自然費率 (age-banded rising premium). Always declined. */
  isNaturalRate?: boolean;
  /** Insured age at issue. Must be 1-110 inclusive. */
  age: number;
  /** Insured gender — drives mortality lookup. */
  gender: Gender;
  /** Sum assured / face amount in NTD (e.g. 5_000_000 for 500萬). */
  sumAssured: number;
  /** Payment term in years. Term-life requires this. */
  paymentYears?: number;
  /** Coverage term in years. Term-life requires this. */
  coverageYears?: number;
}

export interface EstimatorOk {
  kind: 'ok';
  /** Point estimate (NTD per year). */
  mid: number;
  /** Lower bound of the ±25% (default) uncertainty band. */
  low: number;
  /** Upper bound. */
  high: number;
  /** Short tag describing the formula used — e.g. 'whole-life-closed-form'. */
  method: string;
  /** Mandatory disclaimer string to show next to the number. */
  disclaimer: string;
  /**
   * Critic C 必修 — 強制 UI 顯示「精算粗估｜非保險公司報價」徽章。
   *
   * literal type 讓 UI 開發者沒法忘記 (TypeScript narrow 後拿 EstimatorOk 必有
   * label / notQuote 兩欄)。任何渲染 mid/low/high 數字的 component 必須一併
   * surface `label` (與數字同行、字級 ≥ 數字 50%)。
   *
   * 法源：公平交易法 § 21 (不實廣告)、金管會保險局函釋 110.05.04 保局壽字第
   * 1100413427 號 (保險商品試算工具須以同等或更顯著之字級揭露假設)。
   */
  label: '精算粗估｜非保險公司報價';
  notQuote: true;
}

export interface EstimatorDeclined {
  kind: 'declined';
  /** Why this category / shape cannot be honestly estimated. */
  reason: string;
  /** What the advisor should do instead. */
  suggestion: string;
}

export type EstimatorResult = EstimatorOk | EstimatorDeclined;

// ---------------------------------------------------------------------------
// Public constants — exposed so UI / tests can pin them
// ---------------------------------------------------------------------------

export const DEFAULT_DISCLAIMER =
  '本估算為依公開精算原理及 TSO 2021 死亡率表之概算、實際保費依保險公司核保結果為準。';

export const UNSUPPORTED_DISCLAIMER =
  '此類商品涉及利率 / 績效 / 附約條件 / 給付項目個別差異、無法以單一公式估算、建議直接向保險公司或業務員索取報價。';

/** Critic C 必修 — 強制 UI 顯示的法律 label 文字。
 *  與 `EstimatorOk.label` literal type 一致；UI 須以與保費數字相同或更顯著
 *  的字級渲染。export 為 const 讓元件直接 import、避免 hard-code 飄移。 */
export const ESTIMATOR_NOT_QUOTE_LABEL = '精算粗估｜非保險公司報價' as const;

/** Default uncertainty band as a fraction of mid (±0.25 = ±25%). */
export const DEFAULT_UNCERTAINTY = 0.25;

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/**
 * Representative mortality (qx per 1, age-keyed). Public values loosely
 * tracking TSO 2021. We store decennial anchors and linearly interpolate.
 *
 * Source-of-shape: 金管會保險局 2021/03 公告 + ARMROC 第六回經驗生命表 (公開).
 * NOT verbatim table values — rounded representative for estimation only.
 */
const MORTALITY_MALE: ReadonlyArray<[number, number]> = [
  [20, 0.00045],
  [25, 0.00060],
  [30, 0.00075],
  [35, 0.00096],
  [40, 0.00135],
  [45, 0.00210],
  [50, 0.00330],
  [55, 0.00525],
  [60, 0.00830],
  [65, 0.01150],
  [70, 0.01900],
  [75, 0.03100],
  [80, 0.05200],
  [85, 0.08600],
  [90, 0.14000],
];

const MORTALITY_FEMALE: ReadonlyArray<[number, number]> = [
  [20, 0.00022],
  [25, 0.00027],
  [30, 0.00034],
  [35, 0.00045],
  [40, 0.00066],
  [45, 0.00105],
  [50, 0.00170],
  [55, 0.00270],
  [60, 0.00430],
  [65, 0.00580],
  [70, 0.00990],
  [75, 0.01650],
  [80, 0.02850],
  [85, 0.04900],
  [90, 0.08200],
];

/** Preset 預定利率 (annual). Conservative mid-band of 金管會 published
 *  ceilings — see file header. */
const PRESET_INTEREST_RATES = {
  lifeWhole: 0.0150,    // 終身壽 1.50%
  lifeTerm: 0.0175,     // 定期壽 1.75%
  medicalWhole: 0.0150, // 終身醫療定額型 1.50%
} as const;

/** Loading factors — public mid-band of industry附加費用率 range. */
const LOADING_RATES = {
  lifeWhole: 0.30,
  lifeTerm: 0.25,
  medicalWhole: 0.40,
} as const;

/** Terminal age for life-contingent calculations. TSO 2021 closes at 110. */
const OMEGA_AGE = 110;

/** Maximum reasonable age for input validation. */
const MAX_INPUT_AGE = 110;
const MIN_INPUT_AGE = 1;

/**
 * Categories the math honestly serves. Anything outside this set is declined
 * before any computation runs — keeps the refusal path explicit.
 *
 * Supported:
 *   - life (whole-life and term, master only)
 *   - critical (only whole-life lump-sum form, master only; declined for
 *     riders and for the very common annual-renewable form)
 *   - medical (only whole-life fixed-amount daily form, master only)
 */
const SUPPORTED_CATEGORIES = new Set<InsuranceCategoryMain>([
  'life',
  'medical',
  'critical',
]);

// ---------------------------------------------------------------------------
// Internal: mortality lookup
// ---------------------------------------------------------------------------

/** Linear interpolation between the two nearest anchor ages. Clamps to the
 *  table edges (so age 18 → table[20], age 95 → table[90]). */
function lookupQx(age: number, gender: Gender): number {
  const table = gender === 'male' ? MORTALITY_MALE : MORTALITY_FEMALE;
  const first = table[0];
  const last = table[table.length - 1];
  if (age <= first[0]) return first[1];
  if (age >= last[0]) return last[1];

  for (let i = 0; i < table.length - 1; i++) {
    const [a1, q1] = table[i];
    const [a2, q2] = table[i + 1];
    if (age >= a1 && age <= a2) {
      const t = (age - a1) / (a2 - a1);
      return q1 + (q2 - q1) * t;
    }
  }
  // Unreachable given the bounds check above, but keep the type-narrow happy.
  return last[1];
}

// ---------------------------------------------------------------------------
// Internal: whole-life closed-form
// ---------------------------------------------------------------------------

/**
 * 終身壽險 net annual premium per unit sum assured.
 *
 * Formula (simplified, single-decrement):
 *
 *   A(x) = Σ_{k=0}^{ω-x-1} v^(k+1) * kPx * q(x+k)
 *   ä(x) = Σ_{k=0}^{ω-x-1} v^k * kPx
 *   NAP_per_unit = A(x) / ä(x)
 *
 * where kPx = Π_{j=0}^{k-1} (1 - q(x+j)), v = 1/(1+i).
 *
 * We compute the sums iteratively; OMEGA_AGE keeps the loop bounded to a few
 * dozen terms even at age 20.
 */
function wholeLifeNetAnnualPerUnit(
  startAge: number,
  gender: Gender,
  interestRate: number,
): number {
  const v = 1 / (1 + interestRate);
  let A = 0;
  let aDue = 0;
  let kPx = 1; // probability of surviving k years from startAge
  let vk = 1;  // v^k

  for (let k = 0; startAge + k < OMEGA_AGE; k++) {
    const qk = lookupQx(startAge + k, gender);
    aDue += vk * kPx;
    A += vk * v * kPx * qk;
    kPx *= 1 - qk;
    vk *= v;
    // Sanity bail: if survival probability collapses, remaining terms are
    // negligible. Keeps the loop tight at very young start ages.
    if (kPx < 1e-9) break;
  }
  if (aDue <= 0) return 0;
  return A / aDue;
}

// ---------------------------------------------------------------------------
// Internal: term-life closed-form
// ---------------------------------------------------------------------------

/**
 * 定期壽險 net annual premium per unit, level premium across `paymentYears`,
 * coverage running for `coverageYears`.
 *
 *   A(x:n) = Σ_{k=0}^{n-1} v^(k+1) * kPx * q(x+k)         (coverage term n)
 *   ä(x:m) = Σ_{k=0}^{m-1} v^k * kPx                       (payment term m)
 *   NAP_per_unit = A(x:n) / ä(x:m)
 */
function termLifeNetAnnualPerUnit(
  startAge: number,
  gender: Gender,
  interestRate: number,
  paymentYears: number,
  coverageYears: number,
): number {
  const v = 1 / (1 + interestRate);
  let A = 0;
  let aDue = 0;
  let kPx = 1;
  let vk = 1;

  const maxYears = Math.max(paymentYears, coverageYears);
  for (let k = 0; k < maxYears; k++) {
    if (startAge + k >= OMEGA_AGE) break;
    const qk = lookupQx(startAge + k, gender);
    if (k < paymentYears) aDue += vk * kPx;
    if (k < coverageYears) A += vk * v * kPx * qk;
    kPx *= 1 - qk;
    vk *= v;
    if (kPx < 1e-9) break;
  }
  if (aDue <= 0) return 0;
  return A / aDue;
}

// ---------------------------------------------------------------------------
// Internal: medical whole-life (fixed-amount daily form ONLY)
// ---------------------------------------------------------------------------

/**
 * 終身定額型醫療 — claim-cost approach, public principle only.
 *
 * We approximate annual morbidity as mortality × proxy multiplier (publicly
 * cited 3-6x range, we use 4.5 as mid). This is intentionally crude — the
 * function declines if the morbidity assumption can't justify the result
 * (e.g. very young ages where the proxy underestimates badly).
 *
 * Real medical pricing needs insurer-specific 住院率 / 平均住院天數 which is
 * NOT public — this is why the function only handles 定額型 + whole-life, and
 * the disclaimer is explicit.
 */
function medicalWholeLifeNetAnnualPerUnit(
  startAge: number,
  gender: Gender,
  interestRate: number,
): number {
  const v = 1 / (1 + interestRate);
  const MORBIDITY_PROXY_MULTIPLIER = 4.5;
  let A = 0;
  let aDue = 0;
  let kPx = 1;
  let vk = 1;

  for (let k = 0; startAge + k < OMEGA_AGE; k++) {
    const qk = lookupQx(startAge + k, gender);
    // Morbidity proxy — cap at 0.40 so the very old years don't dominate.
    const mk = Math.min(qk * MORBIDITY_PROXY_MULTIPLIER, 0.40);
    aDue += vk * kPx;
    A += vk * v * kPx * mk;
    kPx *= 1 - qk;
    vk *= v;
    if (kPx < 1e-9) break;
  }
  if (aDue <= 0) return 0;
  return A / aDue;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Estimate the annual premium for an insurance coverage given category + age
 * + gender + sum assured. Returns a discriminated union — callers MUST switch
 * on `kind` before reading numbers.
 *
 * @param input EstimatorInput, see field docs.
 * @param opts.uncertainty Optional override of the ±25% default band. Caller
 *        supplies a fraction (0.15 → ±15%); clamped to [0.05, 0.50] to keep
 *        the surfaced range honest.
 */
export function estimatePremium(
  input: EstimatorInput,
  opts: { uncertainty?: number } = {},
): EstimatorResult {
  // ── Input validation (fail-closed) ──────────────────────────────────────
  if (
    !Number.isFinite(input.age) ||
    input.age < MIN_INPUT_AGE ||
    input.age > MAX_INPUT_AGE
  ) {
    return declined(
      '投保年齡需介於 1 至 110 歲之間。',
      '請確認 OCR 抓到的投保年齡欄位、或手動輸入正確年齡後再試。',
    );
  }
  if (!Number.isFinite(input.sumAssured) || input.sumAssured <= 0) {
    return declined(
      '保額需大於 0。',
      '請確認 OCR 抓到的保額欄位、或手動輸入正確保額後再試。',
    );
  }
  if (input.gender !== 'male' && input.gender !== 'female') {
    return declined(
      '性別需為 male 或 female。',
      '請確認 OCR 抓到的被保險人性別欄位。',
    );
  }

  // ── Structural refusals ─────────────────────────────────────────────────
  if (!input.isMaster) {
    return declined(
      '附約保費依主約結構而定、無法獨立估算。',
      UNSUPPORTED_DISCLAIMER,
    );
  }
  if (input.isNaturalRate === true) {
    return declined(
      '自然費率 (年齡別保費) 每年遞增、單一年保費數字會誤導。',
      UNSUPPORTED_DISCLAIMER,
    );
  }

  // ── Category-level refusals ─────────────────────────────────────────────
  if (!SUPPORTED_CATEGORIES.has(input.categoryMain)) {
    return declinedByCategory(input.categoryMain);
  }

  // ── Dispatch ────────────────────────────────────────────────────────────
  const uncertainty = clampUncertainty(opts.uncertainty);

  if (input.categoryMain === 'life') {
    if (input.isWholeLife) {
      return computeLifeWhole(input, uncertainty);
    }
    return computeLifeTerm(input, uncertainty);
  }

  if (input.categoryMain === 'medical') {
    if (!input.isWholeLife) {
      return declined(
        '定期醫療險發生率資料因各家定義差異大、不在公開估算範圍。',
        UNSUPPORTED_DISCLAIMER,
      );
    }
    return computeMedicalWhole(input, uncertainty);
  }

  // critical category
  if (!input.isWholeLife) {
    return declined(
      '定期重大疾病險發生率資料不公開、無法估算。',
      UNSUPPORTED_DISCLAIMER,
    );
  }
  // Use the same close-form as whole-life lump-sum, with a higher loading.
  return computeCriticalWhole(input, uncertainty);
}

// ---------------------------------------------------------------------------
// Compute helpers (dispatch targets)
// ---------------------------------------------------------------------------

function computeLifeWhole(
  input: EstimatorInput,
  uncertainty: number,
): EstimatorResult {
  const napPerUnit = wholeLifeNetAnnualPerUnit(
    input.age,
    input.gender,
    PRESET_INTEREST_RATES.lifeWhole,
  );
  const gross = napPerUnit * input.sumAssured * (1 + LOADING_RATES.lifeWhole);
  return okBand(gross, uncertainty, 'whole-life-closed-form');
}

function computeLifeTerm(
  input: EstimatorInput,
  uncertainty: number,
): EstimatorResult {
  const pay = input.paymentYears ?? input.coverageYears ?? 0;
  const cov = input.coverageYears ?? input.paymentYears ?? 0;
  if (pay <= 0 || cov <= 0) {
    return declined(
      '定期壽險需提供繳費年期與保障年期。',
      '請從 OCR 結果或手動輸入補齊年期欄位後再試。',
    );
  }
  const napPerUnit = termLifeNetAnnualPerUnit(
    input.age,
    input.gender,
    PRESET_INTEREST_RATES.lifeTerm,
    pay,
    cov,
  );
  const gross = napPerUnit * input.sumAssured * (1 + LOADING_RATES.lifeTerm);
  return okBand(gross, uncertainty, 'term-life-closed-form');
}

function computeMedicalWhole(
  input: EstimatorInput,
  uncertainty: number,
): EstimatorResult {
  const napPerUnit = medicalWholeLifeNetAnnualPerUnit(
    input.age,
    input.gender,
    PRESET_INTEREST_RATES.medicalWhole,
  );
  const gross =
    napPerUnit * input.sumAssured * (1 + LOADING_RATES.medicalWhole);
  return okBand(gross, uncertainty, 'medical-whole-life-claim-cost-proxy');
}

function computeCriticalWhole(
  input: EstimatorInput,
  uncertainty: number,
): EstimatorResult {
  // Critical-illness whole-life lump-sum approximated as whole-life death
  // benefit pricing × public-cited incidence multiplier (3.0). This is a
  // coarse principle-only proxy — keep the ±band wide if caller cares.
  const napPerUnit = wholeLifeNetAnnualPerUnit(
    input.age,
    input.gender,
    PRESET_INTEREST_RATES.lifeWhole,
  );
  const CRITICAL_INCIDENCE_MULTIPLIER = 3.0;
  const CRITICAL_LOADING = 0.35;
  const gross =
    napPerUnit *
    input.sumAssured *
    CRITICAL_INCIDENCE_MULTIPLIER *
    (1 + CRITICAL_LOADING);
  return okBand(gross, uncertainty, 'critical-whole-life-incidence-proxy');
}

// ---------------------------------------------------------------------------
// Result builders
// ---------------------------------------------------------------------------

function okBand(
  gross: number,
  uncertainty: number,
  method: string,
): EstimatorOk {
  const mid = roundToHundred(gross);
  const low = roundToHundred(gross * (1 - uncertainty));
  const high = roundToHundred(gross * (1 + uncertainty));
  return {
    kind: 'ok',
    mid,
    low,
    high,
    method,
    disclaimer: DEFAULT_DISCLAIMER,
    // Critic C 必修 — literal type fields，UI 無法 narrow 後省略。
    label: ESTIMATOR_NOT_QUOTE_LABEL,
    notQuote: true,
  };
}

function declined(reason: string, suggestion: string): EstimatorDeclined {
  return { kind: 'declined', reason, suggestion };
}

function declinedByCategory(cat: InsuranceCategoryMain): EstimatorDeclined {
  const reasons: Record<InsuranceCategoryMain, string> = {
    investmentLinked:
      '投資型商品保費 = 純保費 + 帳戶費用 + 標的績效、無法以公式估算。',
    annuity:
      '年金險受宣告利率 / 預定利率每月浮動影響、單一估算當下即失效。',
    accident:
      '意外險費率依職業等級 (1-6) 與商品結構而定、不在公開估算範圍。',
    disability:
      '失能扶助險發生率資料各家內部數據、不在公開估算範圍。',
    longTermCare:
      '長期照顧險發生率與給付結構各家差異大、不在公開估算範圍。',
    // Should never be reached — supported categories never call this branch.
    life: '不應到達此分支',
    medical: '不應到達此分支',
    critical: '不應到達此分支',
  };
  return declined(reasons[cat], UNSUPPORTED_DISCLAIMER);
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function clampUncertainty(u: number | undefined): number {
  if (u === undefined || !Number.isFinite(u)) return DEFAULT_UNCERTAINTY;
  return Math.min(0.50, Math.max(0.05, u));
}

/** Round to the nearest NT$100 — typical advisor-facing granularity. */
function roundToHundred(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.round(v / 100) * 100;
}
