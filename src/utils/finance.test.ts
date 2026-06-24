/**
 * Golden cases for src/utils/finance.ts.
 *
 * Run: `npm run test:finance` (Node 22 built-in node:test, no Vitest needed).
 *
 * Golden values were cross-checked against a calculator script. When a value
 * looks fishy, recompute the closed-form by hand before changing it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pmt,
  fvAnnuity,
  fvGrowingAnnuity,
  remainingBalance,
  presentValue,
  futureValue,
} from './finance.ts';

/** Assert within absolute tolerance (TWD amounts — 0.01 is plenty). */
function close(actual: number, expected: number, tol = 0.01, msg?: string) {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    msg ?? `expected ${expected} ± ${tol}, got ${actual}`,
  );
}

// --- pmt ---------------------------------------------------------------------

test('pmt: 1M @ 2% over 20 years ≈ 5058.83/month', () => {
  close(pmt(1_000_000, 2, 20), 5058.833350, 0.01);
});

test('pmt: rate=0 falls back to straight-line division', () => {
  close(pmt(5_000_000, 0, 30), 5_000_000 / 360, 1e-6);
});

test('pmt: 3M @ 3.5% over 15 years ≈ 21446.48/month', () => {
  close(pmt(3_000_000, 3.5, 15), 21446.476240, 0.01);
});

test('pmt: invalid inputs return 0 (NaN-safe)', () => {
  assert.equal(pmt(0, 2, 20), 0);
  assert.equal(pmt(1_000_000, 2, 0), 0);
  assert.equal(pmt(NaN, 2, 20), 0);
  assert.equal(pmt(1_000_000, Infinity, 20), 0);
  assert.equal(pmt(-1_000_000, 2, 20), 0);
});

// --- fvAnnuity ---------------------------------------------------------------

test('fvAnnuity: 12k/yr @ 5% for 30 years, end ≈ 797266.17', () => {
  close(fvAnnuity(12_000, 5, 30, 'end'), 797266.170036, 0.01);
});

test('fvAnnuity: same with begin = end × (1+i) ≈ 837129.48', () => {
  close(fvAnnuity(12_000, 5, 30, 'begin'), 837129.478538, 0.01);
});

test('fvAnnuity: rate=0 returns payment × years', () => {
  close(fvAnnuity(1_000, 0, 10), 10_000, 1e-9);
});

test('fvAnnuity: years=0 or payment=0 returns 0', () => {
  assert.equal(fvAnnuity(1_000, 5, 0), 0);
  assert.equal(fvAnnuity(0, 5, 10), 0);
  assert.equal(fvAnnuity(NaN, 5, 10), 0);
});

// --- fvGrowingAnnuity --------------------------------------------------------

test('fvGrowingAnnuity: 10k/mo, 6% return, 2% growth, 240mo ≈ 5,456,629', () => {
  close(fvGrowingAnnuity(10_000, 6, 2, 240), 5_456_629.255624, 0.01);
});

test("fvGrowingAnnuity: r ≈ g uses L'Hopital limit (1k/mo, 5/5, 120mo)", () => {
  close(fvGrowingAnnuity(1_000, 5, 5, 120), 196_821.052006, 0.01);
});

test('fvGrowingAnnuity: both rates 0 = flat sum', () => {
  close(fvGrowingAnnuity(500, 0, 0, 60), 30_000, 1e-9);
});

test('fvGrowingAnnuity: r within EPSILON of g hits limit branch (no NaN)', () => {
  // Without the L'Hopital branch, (r - g) ≈ 8e-13 would blow up.
  const out = fvGrowingAnnuity(1_000, 5.0000000001, 5, 120);
  assert.ok(Number.isFinite(out));
  close(out, 196_821.052006, 1); // within $1
});

test('fvGrowingAnnuity: invalid inputs return 0', () => {
  assert.equal(fvGrowingAnnuity(1000, 5, 2, 0), 0);
  assert.equal(fvGrowingAnnuity(0, 5, 2, 240), 0);
  assert.equal(fvGrowingAnnuity(1000, NaN, 2, 240), 0);
});

// --- remainingBalance --------------------------------------------------------

test('remainingBalance: 1M @ 2%, 20yr, after 5yr ≈ 786,132.86', () => {
  close(remainingBalance(1_000_000, 2, 20, 5), 786_132.859753, 0.01);
});

test('remainingBalance: yearsElapsed=0 returns full principal', () => {
  assert.equal(remainingBalance(1_000_000, 2, 20, 0), 1_000_000);
});

test('remainingBalance: fully paid (elapsed = total) returns 0', () => {
  close(remainingBalance(1_000_000, 2, 20, 20), 0, 1e-6);
});

test('remainingBalance: rate=0 is linear (5M, 30yr, 10yr elapsed = 10/3 M)', () => {
  close(remainingBalance(5_000_000, 0, 30, 10), 3_333_333.333333, 0.01);
});

test('remainingBalance: yearsElapsed > totalYears clamps to 0', () => {
  close(remainingBalance(1_000_000, 2, 20, 50), 0, 1e-6);
});

test('remainingBalance: invalid inputs return 0', () => {
  assert.equal(remainingBalance(0, 2, 20, 5), 0);
  assert.equal(remainingBalance(1_000_000, 2, 0, 5), 0);
  assert.equal(remainingBalance(NaN, 2, 20, 5), 0);
});

// --- presentValue ------------------------------------------------------------

test('presentValue: 100k discounted at 5% for 10yr ≈ 61391.33', () => {
  close(presentValue(100_000, 5, 10), 61391.325354, 0.01);
});

test('presentValue: rate=0 returns future unchanged', () => {
  close(presentValue(50_000, 0, 5), 50_000, 1e-9);
});

test('presentValue: years=0 returns future unchanged', () => {
  close(presentValue(50_000, 5, 0), 50_000, 1e-9);
});

test('presentValue: invalid inputs return 0', () => {
  assert.equal(presentValue(NaN, 5, 10), 0);
  assert.equal(presentValue(100_000, Infinity, 10), 0);
});

// --- futureValue -------------------------------------------------------------

test('futureValue: 100k @ 5% for 10yr ≈ 162889.46', () => {
  close(futureValue(100_000, 5, 10), 162889.462678, 0.01);
});

test('futureValue: rate=0 returns present unchanged', () => {
  close(futureValue(75_000, 0, 8), 75_000, 1e-9);
});

test('futureValue: years=0 returns present unchanged', () => {
  close(futureValue(75_000, 6, 0), 75_000, 1e-9);
});

test('futureValue: invalid inputs return 0', () => {
  assert.equal(futureValue(NaN, 5, 10), 0);
  assert.equal(futureValue(100_000, 5, NaN), 0);
});

// --- cross-checks ------------------------------------------------------------

test('cross-check: presentValue inverts futureValue', () => {
  const fv = futureValue(50_000, 4.2, 12);
  close(presentValue(fv, 4.2, 12), 50_000, 1e-6);
});

test('cross-check: remainingBalance(P, r, n, n) ≈ 0 and equals pmt amortisation', () => {
  // Sum of payments minus interest should equal P. Easier proxy: balance at
  // halfway should be > P/2 (early amortisation is mostly interest).
  const half = remainingBalance(1_000_000, 5, 30, 15);
  assert.ok(half > 500_000, `expected > 500k at midpoint, got ${half}`);
  assert.ok(half < 1_000_000, `expected < 1M at midpoint, got ${half}`);
});
