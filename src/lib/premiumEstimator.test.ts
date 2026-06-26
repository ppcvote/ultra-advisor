/**
 * Golden cases for src/lib/premiumEstimator.ts.
 *
 * Run: node --experimental-strip-types --test src/lib/premiumEstimator.test.ts
 *
 * Golden numbers come from deterministic computation of the same formulas
 * (TSO 2021 representative qx + closed-form sums + fixed presets). When a
 * number looks fishy, hand-trace the formula in the module file before
 * changing the expected value here.
 *
 * Tolerance philosophy:
 *   - mid: 5% relative tolerance — protects against unintended drift in the
 *     mortality table or rate presets while allowing trivial rounding moves.
 *   - low/high: implied by mid via ±25% — only need to assert the band shape.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estimatePremium,
  DEFAULT_DISCLAIMER,
  UNSUPPORTED_DISCLAIMER,
  ESTIMATOR_NOT_QUOTE_LABEL,
  type EstimatorResult,
} from './premiumEstimator.ts';

function asOk(r: EstimatorResult) {
  assert.equal(r.kind, 'ok', `expected ok, got declined: ${JSON.stringify(r)}`);
  return r as Extract<EstimatorResult, { kind: 'ok' }>;
}

function asDeclined(r: EstimatorResult) {
  assert.equal(
    r.kind,
    'declined',
    `expected declined, got ok: ${JSON.stringify(r)}`,
  );
  return r as Extract<EstimatorResult, { kind: 'declined' }>;
}

function withinPct(actual: number, expected: number, pct: number) {
  const tol = Math.abs(expected) * pct;
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `expected ${expected} ± ${pct * 100}% (= ±${tol}), got ${actual}`,
  );
}

// ---------------------------------------------------------------------------
// OK cases
// ---------------------------------------------------------------------------

test('whole-life: 35M male / 500萬 → mid ≈ 99,400 (±5%) with ±25% band', () => {
  const r = asOk(
    estimatePremium({
      categoryMain: 'life',
      isWholeLife: true,
      isMaster: true,
      age: 35,
      gender: 'male',
      sumAssured: 5_000_000,
    }),
  );
  withinPct(r.mid, 99_400, 0.05);
  withinPct(r.low, r.mid * 0.75, 0.01);
  withinPct(r.high, r.mid * 1.25, 0.01);
  assert.equal(r.method, 'whole-life-closed-form');
  assert.equal(r.disclaimer, DEFAULT_DISCLAIMER);
});

test('term-life: 30F / 300萬 / 20年 → mid ≈ 2,700 (±20%) with ±25% band', () => {
  // Term life at young female age is small absolute number — generous
  // relative tolerance because rounding-to-100 dominates.
  const r = asOk(
    estimatePremium({
      categoryMain: 'life',
      isWholeLife: false,
      isMaster: true,
      age: 30,
      gender: 'female',
      sumAssured: 3_000_000,
      paymentYears: 20,
      coverageYears: 20,
    }),
  );
  withinPct(r.mid, 2_700, 0.20);
  assert.ok(r.low > 0);
  assert.ok(r.high > r.mid);
  assert.equal(r.method, 'term-life-closed-form');
});

// ---------------------------------------------------------------------------
// Declined: category-based
// ---------------------------------------------------------------------------

test('investment-linked → declined with insurer-quote suggestion', () => {
  const r = asDeclined(
    estimatePremium({
      categoryMain: 'investmentLinked',
      isWholeLife: true,
      isMaster: true,
      age: 40,
      gender: 'male',
      sumAssured: 1_000_000,
    }),
  );
  assert.match(r.reason, /投資型/);
  assert.equal(r.suggestion, UNSUPPORTED_DISCLAIMER);
});

test('annuity → declined (利率變動)', () => {
  const r = asDeclined(
    estimatePremium({
      categoryMain: 'annuity',
      isWholeLife: true,
      isMaster: true,
      age: 55,
      gender: 'female',
      sumAssured: 2_000_000,
    }),
  );
  assert.match(r.reason, /年金|利率|宣告/);
});

// ---------------------------------------------------------------------------
// Declined: structural
// ---------------------------------------------------------------------------

test('rider (isMaster=false) → declined regardless of category', () => {
  const r = asDeclined(
    estimatePremium({
      categoryMain: 'life',
      isWholeLife: true,
      isMaster: false,
      age: 35,
      gender: 'male',
      sumAssured: 1_000_000,
    }),
  );
  assert.match(r.reason, /附約/);
});

test('natural-rate flag → declined even for supported category', () => {
  const r = asDeclined(
    estimatePremium({
      categoryMain: 'life',
      isWholeLife: true,
      isMaster: true,
      isNaturalRate: true,
      age: 35,
      gender: 'male',
      sumAssured: 1_000_000,
    }),
  );
  assert.match(r.reason, /自然費率/);
});

// ---------------------------------------------------------------------------
// Declined: input validation
// ---------------------------------------------------------------------------

test('age=0 → declined (out of range)', () => {
  const r = asDeclined(
    estimatePremium({
      categoryMain: 'life',
      isWholeLife: true,
      isMaster: true,
      age: 0,
      gender: 'male',
      sumAssured: 1_000_000,
    }),
  );
  assert.match(r.reason, /年齡/);
});

test('sumAssured=0 → declined', () => {
  const r = asDeclined(
    estimatePremium({
      categoryMain: 'life',
      isWholeLife: true,
      isMaster: true,
      age: 35,
      gender: 'male',
      sumAssured: 0,
    }),
  );
  assert.match(r.reason, /保額/);
});

test('age=120 → declined (out of range)', () => {
  const r = asDeclined(
    estimatePremium({
      categoryMain: 'life',
      isWholeLife: true,
      isMaster: true,
      age: 120,
      gender: 'male',
      sumAssured: 1_000_000,
    }),
  );
  assert.match(r.reason, /年齡/);
});

// ---------------------------------------------------------------------------
// Determinism — same input twice MUST be identical
// ---------------------------------------------------------------------------

test('determinism: same input → identical output (no wall-clock / no random)', () => {
  const input = {
    categoryMain: 'life' as const,
    isWholeLife: true,
    isMaster: true,
    age: 42,
    gender: 'female' as const,
    sumAssured: 2_500_000,
  };
  const r1 = estimatePremium(input);
  const r2 = estimatePremium(input);
  assert.deepEqual(r1, r2);
});

// ---------------------------------------------------------------------------
// Uncertainty override
// ---------------------------------------------------------------------------

test('uncertainty override: ±15% band tightens vs default ±25%', () => {
  const input = {
    categoryMain: 'life' as const,
    isWholeLife: true,
    isMaster: true,
    age: 35,
    gender: 'male' as const,
    sumAssured: 5_000_000,
  };
  const def = asOk(estimatePremium(input));
  const tight = asOk(estimatePremium(input, { uncertainty: 0.15 }));
  assert.equal(def.mid, tight.mid); // mid unchanged
  assert.ok(tight.high - tight.low < def.high - def.low);
});

// ---------------------------------------------------------------------------
// Critic C 必修 — 法律「非報價」label 強制存在
// ---------------------------------------------------------------------------
//
// 公平交易法 § 21 + 金管會 110.05.04 函釋要求保費試算 UI 必須以同等或更顯著
// 字級顯示「非保險公司報價」。這裡只能保證 contract 層的 label / notQuote
// 一定存在；字級檢核在 PolicyForm.tsx 的 Tailwind class assertions 那層。
test('Critic C: every ok result carries notQuote=true and the literal label', () => {
  const cases: EstimatorResult[] = [
    estimatePremium({
      categoryMain: 'life',
      isWholeLife: true,
      isMaster: true,
      age: 35,
      gender: 'male',
      sumAssured: 5_000_000,
    }),
    estimatePremium({
      categoryMain: 'life',
      isWholeLife: false,
      isMaster: true,
      age: 30,
      gender: 'female',
      sumAssured: 3_000_000,
      paymentYears: 20,
      coverageYears: 20,
    }),
    estimatePremium({
      categoryMain: 'critical',
      isWholeLife: true,
      isMaster: true,
      age: 40,
      gender: 'male',
      sumAssured: 1_000_000,
    }),
  ];
  for (const r of cases) {
    const ok = asOk(r);
    assert.equal(ok.notQuote, true, 'notQuote must be literal true');
    assert.equal(
      ok.label,
      '精算粗估｜非保險公司報價',
      'label must be the exact literal string',
    );
    assert.equal(ok.label, ESTIMATOR_NOT_QUOTE_LABEL);
  }
});
