// Customer-facing report — share-link payload codec.
//
// Sprint 7 F: encode a tool's inputs + outputs into a base64 query param so
// the advisor can hand a public URL to a client (LINE / SMS / email). The
// decoded page is read-only — no Firestore writes, no auth, no editing.
//
// Sprint 8 A: extended to 4 tools via discriminated union — labor pension,
// big-small reservoir, tax planner, million-dollar gift. The codec stays
// pure + framework-free; renderers live in pages/CustomerReportPage.tsx
// and switch on `payload.tool` to pick a view.
//
// Why pure base64 (not Firestore):
//   - Zero infra changes (no rules edits, no new collection, no quotas)
//   - Sharing works for non-members the moment the advisor copies the link
//   - Trade-off: link bytes grow with payload; we keep payloads ≤ 1KB
//     (numbers + a tiny advisor snippet) so URL length stays well under
//     the 2048 practical limit. View-tracking + expiration are deferred
//     to Sprint 9 once real usage data justifies the complexity.
//
// Why timestamp is caller-supplied (not Date.now() here):
//   - The encode function is supposed to be pure given its input. The
//     `generatedAt` belongs to the share-button click moment, not the
//     codec module's import-time. Putting Date.now() here would mean
//     every test snapshot drifts + caching impossible.
//   - See Sprint 7 鐵則 (時間戳處理): caller passes a fully-built payload.
//
// PII rule (Sprint 5 ShareButton 教訓):
//   - We deliberately do NOT carry the client's name, phone, birthday, or
//     any identifier from `currentClient` into the payload. The advisor
//     identity (name + licenses) is fine; the customer is the one viewing,
//     they don't need to see their own name read back at them, and a
//     leaked link must not dox the customer.

export type CustomerReportTool =
  | 'labor_pension'
  | 'big_small_reservoir'
  | 'tax_planner'
  | 'million_gift';

// URL slug ↔ internal tool id. Slug uses kebab-case for friendlier URLs.
// Keep the map tiny + explicit — never accept arbitrary strings from the URL.
const SLUG_TO_TOOL: Record<string, CustomerReportTool> = {
  'labor-pension': 'labor_pension',
  'big-small-reservoir': 'big_small_reservoir',
  'tax-planner': 'tax_planner',
  'million-gift': 'million_gift',
};

const TOOL_TO_SLUG: Record<CustomerReportTool, string> = {
  labor_pension: 'labor-pension',
  big_small_reservoir: 'big-small-reservoir',
  tax_planner: 'tax-planner',
  million_gift: 'million-gift',
};

export function slugToTool(slug: string): CustomerReportTool | null {
  return SLUG_TO_TOOL[slug] ?? null;
}

export function toolToSlug(tool: CustomerReportTool): string {
  return TOOL_TO_SLUG[tool];
}

// ---------- Tool-specific payload shapes ----------
//
// Numbers only — UI strings live in renderers so we can re-style without
// breaking already-shared links. Each interface mirrors the fields the
// tool's useMemo `calculations` returns (outputs) plus the user-set inputs
// the renderer needs to display "your assumptions".

// Labor pension (Sprint 7 — unchanged shape, kept stable for old links).
export interface LaborPensionPayload {
  inputs: {
    currentAge: number;
    retireAge: number;
    salary: number;
    laborInsYears: number;
    selfContribution: boolean;
    desiredMonthlyIncome: number;
    inflationRate: number;
    pensionDiscount: number;
  };
  outputs: {
    futureDesiredIncome: number;
    laborInsMonthly: number;
    pensionMonthly: number;
    totalPension: number;
    gap: number;
    monthlySaveNow: number;
    monthlySaveLater: number;
    yearsToRetire: number;
  };
}

// Big-Small Reservoir.
//   - clientAge is user-set ("our 45yo client") and is NOT customer PII —
//     it's just the age slider value, not "this customer is 45".
//   - doubleYear can be null when reinvestment never reaches double.
export interface BigSmallReservoirPayload {
  inputs: {
    initialCapital: number; // 萬
    years: number;
    configMode: string;     // 'none' | 'conservative' | 'balanced' | 'aggressive'
    dividendRate: number;
    reinvestRate: number;
    clientAge: number;
  };
  outputs: {
    actualDividend: number;
    actualReinvest: number;
    annualDividend: number;
    totalAsset: number;
    smallReservoir: number;
    opportunityCost: number;
    opportunityCostRate: string; // .toFixed(0) — already a string in source
    doubleYear: number | null;
    delay5Total: number;
    delay10Total: number;
    timeCost5: number;
    timeCost10: number;
  };
}

// Tax planner.
//   - bracket {rate,label} — we drop the `color` field (UI re-decides; not
//     all renderers use the same palette + colors aren't part of the
//     business meaning of the bracket).
//   - We carry both before-plan and after-plan numbers so the renderer can
//     show a "before/after" bar without recomputing tax math.
export interface TaxPlannerPayload {
  inputs: {
    spouse: boolean;
    children: number;
    parents: number;
    handicapped: number;
    cash: number;
    realEstateMarket: number;
    realEstateRatio: number;
    stocks: number;
    spouseAssets: number;
    age: number;
    planMode: string;            // 'none' | 'lumpSum' | 'installment'
    lumpSumAmount: number;
    lumpSumLeverage: number;
    annualPremium: number;
    paymentYears: number;
    installmentLeverage: number;
  };
  outputs: {
    totalEstateBefore: number;
    spousalRightDeduction: number;
    totalDeductions: number;
    netEstateBefore: number;
    taxBefore: number;
    bracketBefore: { rate: number; label: string };
    lumpSum: {
      benefit: number;
      taxAfter: number;
      taxSaved: number;
      bracketAfter: { rate: number; label: string };
    };
    installment: {
      totalPremium: number;
      benefit: number;
      taxAfter: number;
      taxSaved: number;
      bracketAfter: { rate: number; label: string };
      year1Benefit: number;
      year1Multiple: number;
    };
    optimalLumpSum: number;
    liquidityGap: number;
  };
}

// Million-dollar gift project.
//   - assetMultiplier / efficiencyMultiplier are `.toFixed(1)` strings (or
//     "∞" when divisor is 0) in the source — keep them as `string`.
export interface MillionGiftPayload {
  inputs: {
    loanAmount: number;
    loanTerm: number;
    loanRate: number;
    investReturnRate: number;
    cycle2Loan: number;
    cycle2Rate: number;
    cycle3Loan: number;
    cycle3Rate: number;
    isCompoundMode: boolean;
  };
  outputs: {
    phase1_Asset: number;
    phase2_Asset: number;
    phase3_Asset: number;
    totalCashOut_T0_T7_Wan: number;
    totalCashOut_T7_T14_Wan: number;
    totalCashOut_T14_T21_Wan: number;
    totalProjectCost_Wan: number;
    netProfit_Wan: number;
    assetMultiplier: string;
    efficiencyMultiplier: string;
    avgMonthlyNetPay: number;
    totalInterestWan: number;
    rateSpread: number;
  };
}

// Advisor snippet — what the customer sees as "who sent me this".
// Intentionally NO email / phone / LINE id: those create harassment surface
// area if the link is forwarded. The advisor's own contact channel is the
// LINE message they're already in.
export interface AdvisorSnippet {
  name: string;
  licenses?: string; // e.g. "IARFC, 人身保險業務員"
  companyName?: string;
}

// Discriminated-union payload. The `tool` tag narrows inputs/outputs so a
// CustomerReportPage `switch(payload.tool)` gets the right types for free.
interface PayloadBase {
  advisor: AdvisorSnippet;
  generatedAt: number; // epoch ms — caller-supplied (see header rule)
  v: 1;                // schema version; bump if shape changes incompatibly
}

export type CustomerReportPayload =
  | ({ tool: 'labor_pension' } & LaborPensionPayload & PayloadBase)
  | ({ tool: 'big_small_reservoir' } & BigSmallReservoirPayload & PayloadBase)
  | ({ tool: 'tax_planner' } & TaxPlannerPayload & PayloadBase)
  | ({ tool: 'million_gift' } & MillionGiftPayload & PayloadBase);

// btoa/atob only handle latin1, so we round-trip through UTF-8 first.
// (Advisor names + license labels are Chinese — would explode otherwise.)
function utf8ToBase64(s: string): string {
  // encodeURIComponent → %XX bytes → latin1 string → btoa
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin)
    // URL-safe variant: '+' → '-', '/' → '_', drop '=' padding.
    // We re-pad on decode. Saves ~3-5% length and avoids %-encoding the '='.
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64ToUtf8(b64: string): string {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const bin = atob(padded + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeCustomerReport(payload: CustomerReportPayload): string {
  return utf8ToBase64(JSON.stringify(payload));
}

// Returns null on any parse / shape / version mismatch — caller renders the
// "invalid link" CTA. We never throw across the route boundary so a malformed
// link can't blank the page.
export function decodeCustomerReport(b64: string): CustomerReportPayload | null {
  if (!b64) return null;
  try {
    const json = base64ToUtf8(b64);
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.v !== 1) return null;
    // Tool must be one we know how to render. Unknown slug → null and the
    // page shows "unsupported tool" (still readable error, not blank).
    if (!parsed.tool || !(parsed.tool in TOOL_TO_SLUG)) return null;
    if (!parsed.inputs || !parsed.outputs || !parsed.advisor) return null;
    if (typeof parsed.generatedAt !== 'number') return null;
    return parsed as CustomerReportPayload;
  } catch {
    return null;
  }
}
