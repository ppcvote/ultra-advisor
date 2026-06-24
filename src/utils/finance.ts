/**
 * Core finance primitives — pure, deterministic, NaN-safe.
 *
 * Convention: rates passed as percent numbers (e.g. 2 means 2%, not 0.02).
 * Matches the existing convention in MortgageCalculator / LaborPensionTool /
 * StudentLoanTool. Do not change to decimals without migrating callers.
 *
 * All functions short-circuit on non-finite / non-positive inputs that would
 * produce NaN or Infinity. Returning 0 (or the obvious degenerate answer) is
 * preferred over throwing — finance UIs partial-input frequently.
 */

const EPSILON = 1e-9;

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

/**
 * Monthly level payment for a fully-amortising loan.
 *
 * @param principal initial loan balance, must be > 0
 * @param annualRate annual interest rate as percent (e.g. 2 = 2%)
 * @param years amortisation period in years, must be > 0
 * @returns monthly payment (positive number), or 0 on invalid input
 */
export function pmt(principal: number, annualRate: number, years: number): number {
  if (!isFiniteNumber(principal) || !isFiniteNumber(annualRate) || !isFiniteNumber(years)) return 0;
  if (principal <= 0 || years <= 0) return 0;

  const n = years * 12;
  if (Math.abs(annualRate) < EPSILON) return principal / n;

  const r = annualRate / 100 / 12;
  const pow = Math.pow(1 + r, n);
  const denom = pow - 1;
  if (Math.abs(denom) < EPSILON) return principal / n;

  return (principal * r * pow) / denom;
}

/**
 * Future value of a level annuity (recurring contribution).
 *
 * @param payment per-period contribution
 * @param annualRate annual rate as percent
 * @param years number of years (n periods = years if annual cashflow)
 * @param when 'end' = ordinary annuity (default), 'begin' = annuity-due
 *
 * Note: this models an ANNUAL-cashflow annuity — payment per year,
 * compounded annually. For monthly cashflow use fvGrowingAnnuity with
 * growthRate = 0 and months as the period count, or compute monthly
 * inline; this stays simple because the common SaaS case (sinking fund
 * projections, education savings) reads annually.
 */
export function fvAnnuity(
  payment: number,
  annualRate: number,
  years: number,
  when: 'end' | 'begin' = 'end',
): number {
  if (!isFiniteNumber(payment) || !isFiniteNumber(annualRate) || !isFiniteNumber(years)) return 0;
  if (years <= 0 || payment === 0) return 0;

  if (Math.abs(annualRate) < EPSILON) return payment * years;

  const i = annualRate / 100;
  const factor = (Math.pow(1 + i, years) - 1) / i;
  const fv = payment * factor;
  return when === 'begin' ? fv * (1 + i) : fv;
}

/**
 * Future value of a growing annuity over `months` periods, paid monthly.
 *
 * Used by LaborPensionTool-style projections where salary (and therefore
 * contribution) grows year over year against a portfolio return.
 *
 * Formula: FV = pmt × [(1+r)^n − (1+g)^n] / (r − g)
 * Limit as g → r: FV = pmt × n × (1+r)^(n−1) (L'Hopital).
 *
 * @param payment first-month contribution
 * @param returnRate annual portfolio return as percent
 * @param growthRate annual contribution growth as percent
 * @param months total months
 */
export function fvGrowingAnnuity(
  payment: number,
  returnRate: number,
  growthRate: number,
  months: number,
): number {
  if (!isFiniteNumber(payment) || !isFiniteNumber(returnRate) || !isFiniteNumber(growthRate)) return 0;
  if (!isFiniteNumber(months) || months <= 0 || payment === 0) return 0;

  const r = returnRate / 100 / 12;
  const g = growthRate / 100 / 12;

  // Both rates zero → flat contribution, no compounding.
  if (Math.abs(r) < EPSILON && Math.abs(g) < EPSILON) {
    return payment * months;
  }

  // r ≈ g: use L'Hopital limit to avoid divide-by-near-zero blow-up.
  if (Math.abs(r - g) < EPSILON) {
    return payment * months * Math.pow(1 + r, months - 1);
  }

  return (payment * (Math.pow(1 + r, months) - Math.pow(1 + g, months))) / (r - g);
}

/**
 * Remaining loan balance after `yearsElapsed` of a level-payment mortgage.
 *
 * Standard prospective formula (cleaner than retrospective for partial months):
 *   B_k = P(1+r)^k − PMT × ((1+r)^k − 1)/r
 * where r is the monthly rate and k = yearsElapsed × 12.
 *
 * @param principal original principal
 * @param annualRate annual rate as percent
 * @param totalYears full amortisation period
 * @param yearsElapsed years already paid; clamped to [0, totalYears]
 */
export function remainingBalance(
  principal: number,
  annualRate: number,
  totalYears: number,
  yearsElapsed: number,
): number {
  if (!isFiniteNumber(principal) || !isFiniteNumber(annualRate)) return 0;
  if (!isFiniteNumber(totalYears) || !isFiniteNumber(yearsElapsed)) return 0;
  if (principal <= 0 || totalYears <= 0) return 0;

  const elapsed = Math.max(0, Math.min(yearsElapsed, totalYears));
  if (elapsed >= totalYears) return 0;
  if (elapsed === 0) return principal;

  const k = elapsed * 12;

  if (Math.abs(annualRate) < EPSILON) {
    const monthlyPmt = principal / (totalYears * 12);
    return Math.max(0, principal - monthlyPmt * k);
  }

  const r = annualRate / 100 / 12;
  const monthlyPmt = pmt(principal, annualRate, totalYears);
  const pow = Math.pow(1 + r, k);
  const bal = principal * pow - monthlyPmt * ((pow - 1) / r);
  return Math.max(0, bal);
}

/**
 * Present value of a single future amount discounted annually.
 *
 * @param future future amount
 * @param annualRate annual discount rate as percent
 * @param years years until receipt
 */
export function presentValue(future: number, annualRate: number, years: number): number {
  if (!isFiniteNumber(future) || !isFiniteNumber(annualRate) || !isFiniteNumber(years)) return 0;
  if (years <= 0) return future;
  if (Math.abs(annualRate) < EPSILON) return future;
  const i = annualRate / 100;
  return future / Math.pow(1 + i, years);
}

/**
 * Future value of a single present amount compounded annually.
 *
 * @param present amount today
 * @param annualRate annual growth rate as percent
 * @param years years to compound
 */
export function futureValue(present: number, annualRate: number, years: number): number {
  if (!isFiniteNumber(present) || !isFiniteNumber(annualRate) || !isFiniteNumber(years)) return 0;
  if (years <= 0) return present;
  if (Math.abs(annualRate) < EPSILON) return present;
  const i = annualRate / 100;
  return present * Math.pow(1 + i, years);
}
