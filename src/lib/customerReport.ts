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
  | 'million_gift'
  // Sprint 9 A — extending the union to 10 tools. New entries below use the
  // same snake_case convention; URL-facing slugs (kebab-case) are in the
  // SLUG_TO_TOOL / TOOL_TO_SLUG mirror just below.
  | 'fund_time_machine'
  | 'student_loan'
  | 'car_replacement'
  | 'super_active_saving'
  | 'financial_real_estate'
  | 'golden_safe_vault'
  // Sprint 10 A — InsuranceCheckup. Last tool to land in customerReport
  // (11/14 → 14/14). Shape is fundamentally different from the others:
  // multi-member family × multi-coverage-category, hence its own anonymized
  // FamilyRole enum rather than free-text. Strict enum is the PII guardrail
  // — if the slug ever drifts to a free string, advisors will eventually
  // type a real name in, so we lock it at the type system.
  | 'insurance_checkup';

// URL slug ↔ internal tool id. Slug uses kebab-case for friendlier URLs.
// Keep the map tiny + explicit — never accept arbitrary strings from the URL.
const SLUG_TO_TOOL: Record<string, CustomerReportTool> = {
  'labor-pension': 'labor_pension',
  'big-small-reservoir': 'big_small_reservoir',
  'tax-planner': 'tax_planner',
  'million-gift': 'million_gift',
  // Sprint 9 A
  'fund-time-machine': 'fund_time_machine',
  'student-loan': 'student_loan',
  'car-replacement': 'car_replacement',
  'super-active-saving': 'super_active_saving',
  'financial-real-estate': 'financial_real_estate',
  'golden-safe-vault': 'golden_safe_vault',
  // Sprint 10 A
  'insurance-checkup': 'insurance_checkup',
};

const TOOL_TO_SLUG: Record<CustomerReportTool, string> = {
  labor_pension: 'labor-pension',
  big_small_reservoir: 'big-small-reservoir',
  tax_planner: 'tax-planner',
  million_gift: 'million-gift',
  // Sprint 9 A
  fund_time_machine: 'fund-time-machine',
  student_loan: 'student-loan',
  car_replacement: 'car-replacement',
  super_active_saving: 'super-active-saving',
  financial_real_estate: 'financial-real-estate',
  golden_safe_vault: 'golden-safe-vault',
  // Sprint 10 A
  insurance_checkup: 'insurance-checkup',
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

// ---------- Sprint 9 A — 6 new tool payloads ----------

// Fund Time Machine (基金時光機).
//   - Bimodal: lump-sum (one shot) vs DCA (monthly drip). The amount field
//     used depends on `mode` — renderer reads both, but the unused one is
//     simply ignored. We carry the fund id + name so renderer can label
//     without re-importing the fund dataset.
//   - `fundType` discriminates growth-style (totalReturn the headline) vs
//     income-style (cumulativeDividends the headline). The renderer picks
//     the hero metric off this flag instead of branching on fundId.
export interface FundTimeMachinePayload {
  inputs: {
    mode: 'lump' | 'dca';
    selectedFund: string;     // fund id e.g. 'USDEQ3490'
    amount: number;           // 萬 — lump mode
    monthlyAmount: number;    // 元 — dca mode
  };
  outputs: {
    fundId: string;
    fundName: string;
    fundType: 'growth' | 'income';
    inceptionDate: string;    // ISO date — display-only, never parsed for math
    years: number;
    totalPrincipal: number;
    totalReturn: number;
    cumulativeDividends: number;
    totalReturnRate: number;
    cagr: number;
    growthMultiplier: number;
    maxDrawdown: number;
    avgMonthlyDividend: number;
  };
}

// Student Loan (學貸活化).
//   - loanRate is 政府方案固定 1.775% — not user-editable, so it's NOT in
//     inputs. Encoding a constant just wastes link bytes.
//   - 4 phase boundaries (study / grace / interest-only / amortizing) are
//     carried as year integers so the renderer can draw a 4-bar chart
//     without re-running the simulator.
export interface StudentLoanPayload {
  inputs: {
    loanAmount: number;          // 萬
    investReturnRate: number;
    semesters: number;
    gracePeriod: number;
    interestOnlyPeriod: number;
    isQualified: boolean;
  };
  outputs: {
    finalAsset: number;          // 萬
    coverageRatio: number;
    monthlyInterest: number;
    monthlyPMT: number;
    studyYears: number;
    graceEndYear: number;
    interestOnlyEndYear: number;
    repaymentEndYear: number;
    totalDuration: number;
  };
}

// Car Replacement (5 年換車專案).
//   - 3 cycles modelled in source — we encode the whole array because the
//     renderer's bar chart needs all three side-by-side. Each cycle entry
//     is small (8 numbers) so total payload still fits in budget.
export interface CarReplacementCycle {
  cycle: number;
  carBudget: number;
  investedCapital: number;
  monthlyPay: number;
  monthlyIncome: number;
  netPay: number;
  residualValue: number;
  remainingLoan: number;
  netCashBack: number;
  totalAssetEnd: number;
}

export interface CarReplacementPayload {
  inputs: {
    carPrice: number;          // 萬 — cycle 1
    investReturnRate: number;
    loanRate: number;
    loanTerm: number;
    residualRate: number;      // %
    cycleYears: number;
    carPrice2: number;
    carPrice3: number;
  };
  outputs: {
    cycles: CarReplacementCycle[];   // length = 3
    totalProjectYears: number;
    lastCarResidual: number;
  };
}

// Super Active Saving (超積極存錢法).
//   - totalYears is fixed at 40 in the source tool — kept out of inputs
//     for the same reason as loanRate above.
//   - Comparing 消極 (passive, full 40 yrs DCA) vs 積極 (active, save then
//     compound) → two parallel final assets. Renderer draws both growth
//     curves by re-running deterministic compounding from inputs.
export interface SuperActiveSavingPayload {
  inputs: {
    monthlySaving: number;     // 元
    investReturnRate: number;
    activeYears: number;
  };
  outputs: {
    finalActiveAsset: number;
    finalPassiveAsset: number;
    activeWan: number;
    passiveWan: number;
    totalPrincipalActive: number;
    totalPrincipalPassive: number;
    savedPrincipal: number;
    monthlyPassiveIncome: number;
    assetRatio: number;
  };
}

// Financial Real Estate (金融房產專案).
//   - Two plan modes (newLoan / refinance) share most of the calc surface.
//     We flatten everything `calculations` returns into one shape — fields
//     that don't apply to a given mode are still computed (deterministic +
//     cheap) so the encoded payload is mode-agnostic. Renderer reads
//     `inputs.planMode` to decide which metrics to surface.
//   - 3-scenario sensitivity {low, mid, high} carries pre-computed total-
//     wealth numbers so the renderer can show a "what if return is X%"
//     band without re-running 20+ years of amortization in the browser.
export interface FinancialRealEstateScenario {
  totalWealth: number;
  netCashFlow: number;
}

export interface FinancialRealEstatePayload {
  inputs: {
    loanAmount: number;          // 萬
    loanTerm: number;
    loanRate: number;
    investReturnRate: number;
    existingLoanBalance: number; // 萬
    existingMonthlyPayment: number; // 元
    planMode: 'none' | 'newLoan' | 'refinance';
    configType: string;
    clientAge: number;
  };
  outputs: {
    monthlyPayment: number;
    monthlyIncome: number;
    netCashFlow: number;
    isPositiveCashFlow: boolean;
    monthlyOutOfPocket: number;
    totalOutOfPocket: number;
    rateSpread: number;
    breakEvenRate: number;
    cashOutAmount: number;
    monthlyIncomeFromCashOut: number;
    netNewMonthlyPayment: number;
    monthlySavings: number;
    totalSavingsOverTerm: number;
    cumulativeCashFlow: number;
    totalWealthNewLoan: number;
    totalWealthRefinance: number;
    leverageRatio: number;
    recommendation: string;
    scenarios: {
      low: FinancialRealEstateScenario;
      mid: FinancialRealEstateScenario;
      high: FinancialRealEstateScenario;
    };
  };
}

// Golden Safe Vault (黃金保險箱).
//   - "Lock-in" value = baseValue × 0.9 (insurance 配置守住 90% — the 10%
//     drop is the deliberate hero contrast). All 4 erosion scenarios
//     (medical / market / tax) are absolute 元 numbers so the renderer
//     can draw a 5-bar comparison directly.
//   - `mode` flips meaning of `amount` (time mode: 投入金額萬 ; asset mode:
//     現有資產萬). Renderer surfaces the right label off this flag.
export interface GoldenSafeVaultPayload {
  inputs: {
    mode: 'time' | 'asset';
    amount: number;            // 萬 — meaning depends on mode (see above)
    years: number;
    rate: number;
    age: number;
    annualIncome: number;      // 萬
    medicalLoss: number;       // 萬
    marketLoss: number;        // % drop
    taxLoss: number;           // 萬
  };
  outputs: {
    baseValue: number;         // 元
    principal: number;         // 元
    lockedValue: number;       // 元 — baseValue * 0.9
    medicalAfter: number;
    marketAfter: number;
    taxAfter: number;
  };
}

// ---------- Sprint 10 A — InsuranceCheckup payload ----------
//
// Shape is multi-member × multi-coverage. PII surface area is bigger than any
// other tool, so the type itself enforces anonymization:
//
//   - `role` is a closed enum (FamilyRole). Adding a free-text "label" field
//     was rejected — advisors WILL type real names eventually, and a type-
//     level enum is the only durable barrier.
//   - `age` is a number (not PII). `gender` is omitted — adds no decision-
//     making value at the customer-report stage and is one more PII vector.
//   - No `name`, no `insurer`, no `policyNumber`, no `birthday`. Numbers
//     and category buckets only.
//   - `topPriorities` is free-text BUT must be generated by the encoder using
//     role labels ("配偶醫療缺口" — never "王太太醫療缺口"). The codec can't
//     enforce that at runtime since string is string; the encode caller in
//     ShareToCustomerButton handler is the choke point.

// Closed enum — kebab-style stays out (we have role labels in Chinese in
// renderer; the wire format is English snake-equivalents to keep base64
// shorter and to keep grep-ability across the codebase).
export type FamilyRole =
  | 'self'
  | 'spouse'
  | 'child_1'
  | 'child_2'
  | 'child_3'
  | 'father'
  | 'mother';

// Used by decode sanitizer + by encoder validation. Don't inline as a
// Set<string> elsewhere — single source of truth.
const VALID_FAMILY_ROLES: ReadonlyArray<FamilyRole> = [
  'self',
  'spouse',
  'child_1',
  'child_2',
  'child_3',
  'father',
  'mother',
];

// Coverage bucket — values are 萬 (壽險/重疾/意外/失能 保額) or 元/月 (醫療日額,
// 長照月給付). Renderer knows the unit per category; codec stays unit-agnostic.
// Every field is optional so a member with only 壽險 doesn't carry 5 zeros.
export interface InsuranceCoverageBucket {
  life?: number;
  medical?: number;
  critical?: number;
  accident?: number;
  disability?: number;
  longTermCare?: number;
}

export interface InsuranceCheckupMember {
  role: FamilyRole;             // Strict enum — codec rejects free-text
  age?: number;                 // 數字 OK, not PII
  coverage: InsuranceCoverageBucket;
  gaps?: InsuranceCoverageBucket; // Same shape — gap = needed - has
}

export interface InsuranceCheckupPayload {
  inputs: {
    members: InsuranceCheckupMember[];
    annualBudget?: number;       // 全家年度保費預算 (萬) — optional
  };
  outputs: {
    totalCoverage: InsuranceCoverageBucket;  // sum across members per category
    totalGaps: InsuranceCoverageBucket;
    overallScore?: number;       // 0-100 整體保障評分
    topPriorities?: string[];    // 已 anonymize: e.g. ['配偶醫療缺口', '本人壽險不足']
  };
}

// Sanitizer: drop unknown role enum values from a member object. Used by
// decodeCustomerReport so a tampered link with role: "王太太" is silently
// downgraded (best-effort) rather than crashing the page or rendering PII.
// Why "drop the member" instead of "coerce role to self": coercion would
// invent a fake identity the advisor didn't author. Dropping is the safe
// failure mode — customer sees fewer rows, not wrong rows.
function sanitizeInsuranceMembers(raw: unknown): InsuranceCheckupMember[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((m): InsuranceCheckupMember[] => {
    if (!m || typeof m !== 'object') return [];
    const role = (m as { role?: unknown }).role;
    if (typeof role !== 'string') return [];
    if (!VALID_FAMILY_ROLES.includes(role as FamilyRole)) return [];
    // age + coverage + gaps: type-cast through unknown; renderer treats
    // missing numeric fields as undefined. We don't deep-validate every
    // category — base64 has already been integrity-checked by JSON.parse.
    return [m as InsuranceCheckupMember];
  });
}

// Advisor snippet — what the customer sees as "who sent me this".
// Sprint 9 F: contactLine added. Unlike client PII, the advisor's LINE OA
// id is intentionally public-facing — it's their business identifier. The
// feedback widget on CustomerReportPage opens a LINE deep-link prefilled
// with the tool name; without contactLine the widget falls back to a
// "請直接回覆 LINE 訊息給顧問" static toast.
// Still NO advisor email / phone here: LINE OA id is the one channel they
// publish, anything else stays inside the existing message thread.
export interface AdvisorSnippet {
  name: string;
  licenses?: string; // e.g. "IARFC, 人身保險業務員"
  companyName?: string;
  contactLine?: string; // LINE Official Account id, e.g. '@ginrolladvisor'
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
  | ({ tool: 'million_gift' } & MillionGiftPayload & PayloadBase)
  // Sprint 9 A — 6 new branches. `v: 1` stays the same: the schema framework
  // (encode/decode, base64-url, advisor block, generatedAt) is unchanged.
  // Bumping v would invalidate every link already sent in Sprints 7-8.
  | ({ tool: 'fund_time_machine' } & FundTimeMachinePayload & PayloadBase)
  | ({ tool: 'student_loan' } & StudentLoanPayload & PayloadBase)
  | ({ tool: 'car_replacement' } & CarReplacementPayload & PayloadBase)
  | ({ tool: 'super_active_saving' } & SuperActiveSavingPayload & PayloadBase)
  | ({ tool: 'financial_real_estate' } & FinancialRealEstatePayload & PayloadBase)
  | ({ tool: 'golden_safe_vault' } & GoldenSafeVaultPayload & PayloadBase)
  // Sprint 10 A — same v: 1, framework unchanged.
  | ({ tool: 'insurance_checkup' } & InsuranceCheckupPayload & PayloadBase);

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
    // Sprint 10 A — Insurance Checkup has a PII-sensitive role field. If a
    // tampered link smuggles in "role: '王太太'" we drop that member entry
    // rather than render it. We mutate inputs.members in place because the
    // caller owns the parsed object (we just returned it). The codec stays
    // pure-from-the-outside: same input ⇒ same output, and the only mutation
    // is the defensive scrub of a NEW object we just JSON.parse'd.
    if (parsed.tool === 'insurance_checkup') {
      parsed.inputs.members = sanitizeInsuranceMembers(parsed.inputs.members);
    }
    return parsed as CustomerReportPayload;
  } catch {
    return null;
  }
}
