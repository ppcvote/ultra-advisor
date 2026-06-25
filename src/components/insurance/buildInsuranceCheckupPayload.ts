/**
 * buildInsuranceCheckupPayload — InsuranceCheckup → ShareToCustomer payload
 *
 * Why this lives in src/components/insurance (not src/lib/):
 *   - It's tightly coupled to CheckupReport's `extractedPeople / coverageByPerson`
 *     shape (those types are file-local in CheckupReport.tsx). Co-locating
 *     keeps the contract close to the producer; lifting to lib/ would force
 *     re-exporting those internal types just to import them back.
 *   - Pure function: zero React, zero Firebase, zero side effects → trivially
 *     testable in isolation. Keep it that way.
 *
 * PII guarantees (Sprint 10 A — codec enforces FamilyRole enum at the type
 * level, but the encoder is the ONLY choke point for free-text PII):
 *   - NEVER reads person.name into the output (anonymized to FamilyRole)
 *   - NEVER reads policy.insurer, policy.policyNumber, claimSummary detail
 *   - NEVER emits real names in topPriorities — uses role-label Chinese
 *     ("配偶醫療缺口" not "王太太醫療缺口")
 *   - We deliberately drop unknown-shaped persons rather than coerce them,
 *     same as sanitizeInsuranceMembers in codec — silent drop > fake data.
 *
 * Role inference heuristic (no FamilyTree available at CheckupReport scope):
 *   - clientName match wins → that person is `self`
 *   - else: by age desc, first adult (>= 18) = self
 *   - spouse = next adult within ±15 of self
 *   - children = anyone with age < 18 OR (self.age - age) >= 20 (assigned _1/_2/_3 by age desc)
 *   - parents = anyone with age >= self.age + 18 (first → father, second → mother)
 *   - unknown-age people slot in as best-effort children after known kids,
 *     and excess people (>7 roles available) are dropped (rare; family size
 *     budget). Dropping a member loses one row but keeps payload valid.
 */

import type {
  FamilyRole,
  InsuranceCheckupMember,
  InsuranceCheckupPayload,
  InsuranceCoverageBucket,
} from '../../lib/customerReport';
import type { Coverage, PolicyInfo, ProductCategory, ClaimSummary } from '../../types/insurance';

// Inputs from CheckupReport's local computation — kept as a structural type
// so we don't have to export the file-local interfaces from CheckupReport.tsx.
// CheckupReport's ExtractedPerson + coverageByPerson have these fields.
export interface BuildInputPerson {
  name: string;          // used ONLY to key into coverageByPerson + role inference; NEVER copied to output
  age?: number;
  totalPremium: number;  // not currently surfaced in payload — kept for future budget split
}

export interface BuildInputCoverageDetail {
  coverage: Coverage;
  lookup?: {
    category?: ProductCategory;
    claimSummary?: ClaimSummary;
  };
}

export interface BuildInputPersonData {
  categories: Record<string, boolean>;
  claimDetails: BuildInputCoverageDetail[];
}

export interface BuildInsuranceCheckupArgs {
  extractedPeople: BuildInputPerson[];
  coverageByPerson: Record<string, BuildInputPersonData>;
  totalAnnualPremium: number;
  averageScore: number;
  clientName?: string;   // if present + matches an extractedPerson, that person → self
}

// Recommended baseline amounts per category — used ONLY to compute `gaps`
// for completely-missing categories. Conservative defaults; renderer treats
// these as "starting point" not "exact target". Units match codec contract:
//   - life/critical/accident/disability = 萬 (10k TWD)
//   - medical = 元/日 (病房費限額)
//   - longTermCare = 元/月
const BASELINE: Required<InsuranceCoverageBucket> = {
  life: 500,           // 萬
  medical: 2000,       // 元/日
  critical: 200,       // 萬
  accident: 300,       // 萬
  disability: 100,     // 萬
  longTermCare: 30000, // 元/月
};

// CheckupReport's category labels for topPriorities text. Mirrors COVERAGE_CATEGORIES
// in CheckupReport.tsx — kept duplicated (not imported) because importing would
// pull in lucide icons + react. This module stays pure.
const CATEGORY_LABEL: Record<keyof InsuranceCoverageBucket, string> = {
  life: '壽險',
  medical: '醫療',
  critical: '重疾',
  accident: '意外',
  disability: '失能',
  longTermCare: '長照',
};

// FamilyRole → Chinese label for topPriorities. Keep in sync with codec enum.
const ROLE_LABEL: Record<FamilyRole, string> = {
  self: '本人',
  spouse: '配偶',
  child_1: '子女',
  child_2: '子女',
  child_3: '子女',
  father: '父親',
  mother: '母親',
};

/**
 * Map CheckupReport's 8-category boolean record + claimDetails to the codec's
 * 6-bucket numeric shape. Sums across all coverages for the same person.
 *
 * - cancer (a CheckupReport category) folds into `critical` (closest semantic bucket)
 * - hospital (住院日額) folds into `medical` (both medical-spend categories)
 * - We use coverage.sumInsured (actual policy 保額) NOT claimSummary.lumpSum
 *   (the latter can be AI-extrapolated). Real numbers only.
 */
function buildCoverageBucket(claimDetails: BuildInputCoverageDetail[]): InsuranceCoverageBucket {
  const bucket: InsuranceCoverageBucket = {};

  const add = (key: keyof InsuranceCoverageBucket, amount: number) => {
    if (!amount || amount <= 0) return;
    bucket[key] = (bucket[key] ?? 0) + amount;
  };

  for (const { coverage, lookup } of claimDetails) {
    const category = lookup?.category ?? coverage.category;
    // sumInsured 是元 — 壽險/重疾/意外/失能 bucket 是「萬」單位、要 /10000
    const sumWan = coverage.sumInsured ? Math.round(coverage.sumInsured / 10000) : 0;
    const cs = lookup?.claimSummary ?? coverage.claimSummary;

    switch (category) {
      case 'life_term':
      case 'life_whole':
        add('life', sumWan);
        break;
      case 'critical_illness':
      case 'major_injury':
      case 'cancer':
        // cancer folds into critical (codec bucket has no separate cancer)
        add('critical', sumWan);
        break;
      case 'accident':
        add('accident', sumWan);
        break;
      case 'disability':
        add('disability', sumWan);
        break;
      case 'long_term_care':
        // longTermCare bucket is 元/月 (not 萬). Read from claimSummary.longTermCare.monthly.
        if (cs?.longTermCare?.monthly) add('longTermCare', cs.longTermCare.monthly);
        break;
      case 'medical_expense':
        // medical bucket is 元/日 (病房費限額). Sum across multiple 實支 policies.
        if (cs?.actualExpense?.roomDaily) add('medical', cs.actualExpense.roomDaily);
        break;
      case 'medical_daily':
        // hospital daily folds into medical bucket — both are 元/日 numbers
        if (cs?.hospitalDaily?.illness) add('medical', cs.hospitalDaily.illness);
        break;
      // accident_medical, surgery, waiver, annuity, investment, other → skip
      // (not part of the 6-bucket model; would inflate categories that aren't real coverage)
      default:
        break;
    }
  }

  return bucket;
}

/**
 * Compute gaps as (baseline - has) for each bucket where coverage is 0 or
 * meaningfully below baseline. We only emit gaps for missing/under categories
 * — don't include "no gap" entries (codec bucket fields are all optional).
 *
 * Why baseline (not "needed = X × annual income"): we don't have reliable
 * income data at this codepath. Baselines are conservative industry rules-
 * of-thumb. Renderer treats this as advisory, not prescriptive.
 */
function buildGaps(has: InsuranceCoverageBucket): InsuranceCoverageBucket {
  const gaps: InsuranceCoverageBucket = {};
  (Object.keys(BASELINE) as (keyof InsuranceCoverageBucket)[]).forEach((key) => {
    const have = has[key] ?? 0;
    const need = BASELINE[key];
    if (have < need) {
      gaps[key] = need - have;
    }
  });
  return gaps;
}

/**
 * Sum InsuranceCoverageBucket values from multiple members. Used for
 * outputs.totalCoverage / totalGaps. Skips undefined entries — final bucket
 * fields stay undefined (not 0) when no member has that category.
 */
function sumBuckets(buckets: InsuranceCoverageBucket[]): InsuranceCoverageBucket {
  const out: InsuranceCoverageBucket = {};
  for (const b of buckets) {
    (Object.keys(b) as (keyof InsuranceCoverageBucket)[]).forEach((k) => {
      const v = b[k];
      if (typeof v === 'number' && v > 0) {
        out[k] = (out[k] ?? 0) + v;
      }
    });
  }
  return out;
}

/**
 * Role assignment. See header docstring for the heuristic.
 * Returns FamilyRole[] aligned by index to the input persons array, with `null`
 * for persons that couldn't be assigned (caller drops them).
 */
function assignRoles(
  people: BuildInputPerson[],
  clientName?: string,
): (FamilyRole | null)[] {
  const roles: (FamilyRole | null)[] = people.map(() => null);
  const used = new Set<FamilyRole>();
  const take = (role: FamilyRole): FamilyRole | null => {
    if (used.has(role)) return null;
    used.add(role);
    return role;
  };

  // Step 1: clientName match → self
  let selfIdx = -1;
  if (clientName) {
    const trimmed = clientName.trim();
    if (trimmed) {
      selfIdx = people.findIndex((p) => p.name.trim() === trimmed);
      if (selfIdx >= 0) {
        roles[selfIdx] = take('self');
      }
    }
  }

  // Build index list sorted by age desc (unknown ages last). Used both for
  // picking self (when clientName didn't match) and for sibling/parent ranking.
  const byAgeDesc = people
    .map((p, i) => ({ i, age: p.age }))
    .sort((a, b) => {
      if (a.age == null && b.age == null) return a.i - b.i;
      if (a.age == null) return 1;
      if (b.age == null) return -1;
      return b.age - a.age;
    });

  // Step 2: self fallback — first adult by age desc that isn't already self
  if (selfIdx < 0) {
    for (const { i, age } of byAgeDesc) {
      if (age != null && age >= 18) {
        roles[i] = take('self');
        selfIdx = i;
        break;
      }
    }
    // No adult at all? Fallback: index 0
    if (selfIdx < 0 && people.length > 0) {
      roles[0] = take('self');
      selfIdx = 0;
    }
  }

  const selfAge = selfIdx >= 0 ? people[selfIdx].age : undefined;

  // Step 3: classify remaining by age relative to self
  const remainingIdx = byAgeDesc.map((x) => x.i).filter((i) => i !== selfIdx);

  // Buckets: parents first (older than self+18), then peers (spouse candidates),
  // then children (younger than self-20 OR age<18)
  const parents: number[] = [];
  const peers: number[] = [];
  const children: number[] = [];
  const unknown: number[] = [];

  for (const i of remainingIdx) {
    const age = people[i].age;
    if (age == null) {
      unknown.push(i);
      continue;
    }
    if (selfAge != null && age >= selfAge + 18) {
      parents.push(i);
    } else if (selfAge != null && (age < 18 || selfAge - age >= 20)) {
      children.push(i);
    } else {
      peers.push(i);
    }
  }

  // Spouse: first peer (within ±15 of self age, or just first if selfAge unknown)
  if (peers.length > 0) {
    const spouseIdx = peers.shift()!;
    roles[spouseIdx] = take('spouse');
    // Remaining peers fall through to children pool (rare: adult sibling, etc.)
    children.push(...peers);
  }

  // Parents → father, mother (by age desc; older = father by convention; this
  // is a label choice, not gender claim — renderer shows "父親/母親" labels
  // because we have no gender data and the FamilyRole enum forces a pick)
  if (parents[0] != null) roles[parents[0]] = take('father');
  if (parents[1] != null) roles[parents[1]] = take('mother');
  // Excess parents drop (>2)

  // Children → child_1/_2/_3 by age desc
  let childSlot = 1 as 1 | 2 | 3;
  for (const i of children) {
    if (childSlot > 3) break;
    const role = (`child_${childSlot}` as FamilyRole);
    const taken = take(role);
    if (taken) roles[i] = taken;
    childSlot = (childSlot + 1) as 1 | 2 | 3;
  }
  // Unknown-age → fill remaining child slots best-effort
  for (const i of unknown) {
    if (childSlot > 3) break;
    const role = (`child_${childSlot}` as FamilyRole);
    const taken = take(role);
    if (taken) roles[i] = taken;
    childSlot = (childSlot + 1) as 1 | 2 | 3;
  }

  return roles;
}

/**
 * Main builder. Pure: same inputs → same outputs, no clock / network reads.
 */
export function buildInsuranceCheckupPayload(
  args: BuildInsuranceCheckupArgs,
): { inputs: InsuranceCheckupPayload['inputs']; outputs: InsuranceCheckupPayload['outputs'] } {
  const { extractedPeople, coverageByPerson, totalAnnualPremium, averageScore, clientName } = args;

  const roles = assignRoles(extractedPeople, clientName);

  // Per-member: build coverage bucket + gaps. Drop members with no role assigned
  // (>7 people in a family — rare; would have been a name leak risk anyway).
  const members: InsuranceCheckupMember[] = [];
  const personBuckets: InsuranceCoverageBucket[] = [];

  for (let i = 0; i < extractedPeople.length; i++) {
    const role = roles[i];
    if (!role) continue; // silently drop — see header

    const person = extractedPeople[i];
    const data = coverageByPerson[person.name];
    if (!data) continue; // person had no coverages → no useful row to share

    const coverage = buildCoverageBucket(data.claimDetails);
    const gaps = buildGaps(coverage);

    members.push({
      role,
      // age is OK (not PII per codec contract)
      ...(person.age != null ? { age: person.age } : {}),
      coverage,
      gaps,
    });
    personBuckets.push(coverage);
  }

  // Aggregate totals across members
  const totalCoverage = sumBuckets(personBuckets);
  const totalGaps = sumBuckets(members.map((m) => m.gaps ?? {}));

  // topPriorities — biggest gaps, anonymized via ROLE_LABEL.
  // Score each (member, category) by raw gap amount; pick top 3 distinct strings.
  // We DO NOT include the gap amount in the string (renderer can show numbers
  // from the bucket fields directly; here we just point to where to look).
  const priorityScores: Array<{ label: string; weight: number }> = [];
  for (const m of members) {
    const gaps = m.gaps ?? {};
    (Object.keys(gaps) as (keyof InsuranceCoverageBucket)[]).forEach((k) => {
      const gap = gaps[k] ?? 0;
      if (gap <= 0) return;
      // Normalize across mixed units (萬 vs 元) — use a category-relative weight
      // (gap / baseline) so a missing 壽險 500萬 outranks a missing 醫療日額 2000元
      const baseline = BASELINE[k];
      const weight = baseline > 0 ? gap / baseline : 0;
      priorityScores.push({
        label: `${ROLE_LABEL[m.role]}${CATEGORY_LABEL[k]}缺口`,
        weight,
      });
    });
  }
  priorityScores.sort((a, b) => b.weight - a.weight);
  // Dedupe while preserving order (multiple kids could both lack 醫療 → one row)
  const seen = new Set<string>();
  const topPriorities: string[] = [];
  for (const { label } of priorityScores) {
    if (seen.has(label)) continue;
    seen.add(label);
    topPriorities.push(label);
    if (topPriorities.length >= 3) break;
  }

  // annualBudget — total annual premium across all policies, converted to 萬
  // (codec contract). Only emit when meaningfully > 0 to avoid leaking "0 萬".
  const annualBudgetWan = totalAnnualPremium > 0
    ? Math.round(totalAnnualPremium / 10000)
    : undefined;

  return {
    inputs: {
      members,
      ...(annualBudgetWan != null ? { annualBudget: annualBudgetWan } : {}),
    },
    outputs: {
      totalCoverage,
      totalGaps,
      overallScore: averageScore,
      ...(topPriorities.length > 0 ? { topPriorities } : {}),
    },
  };
}
