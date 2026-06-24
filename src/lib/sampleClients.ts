/**
 * Sample clients seeded at first-run so a brand-new advisor never sees an
 * empty 戰情室. Without these, the onboarding "新增第一位客戶" mission is the
 * only path to actually using any tool — every tool's empty state was a
 * dead end. The 3 personas span the 3 lifecycle moments most Taiwan IARFC
 * advisors actually pitch: 家庭主婦 (守富), 科技業單身 (創富),
 * 退休前老闆 (傳富).
 *
 * Schema notes:
 * - We write into the same `users/{uid}/clients` subcollection real clients
 *   live in, so the existing onSnapshot listener (WarRoom/index.tsx) picks
 *   them up automatically — no schema change.
 * - `isSample: true` + `createdFrom: 'onboarding-sample'` is the only way
 *   ClientsTab knows to badge them; existing real-client docs lack these
 *   fields and stay un-badged.
 * - Persona fields (age / monthlyIncome / family / assets / riskTolerance /
 *   retirementGoal) are stored as plain top-level fields. They're meta only
 *   right now — the analysis tools (黃金保險箱 / 退休缺口 / 稅務傳承) read
 *   from per-tool nested objects (goldenSafeData / pensionData etc) which
 *   we DO seed with sensible numbers so the advisor sees non-zero output
 *   the moment they tap a sample client.
 */

import { collection, getDocs, writeBatch, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface SamplePersona {
  // Top-level meta (display + persona context only — not consumed by tools yet)
  name: string;
  age: number;
  monthlyIncome: number; // 月收入（新台幣，元）
  family: string[];      // 家庭成員描述
  assets: number;        // 總資產（萬元）
  riskTolerance: 'low' | 'medium' | 'high';
  retirementGoal: string;
  note: string;

  // Per-tool nested state — matches the shape App.tsx's `defaultStates`
  // expects, so opening a tool on this client renders real numbers.
  goldenSafeData?: Record<string, unknown>;
  pensionData?: Record<string, unknown>;
  taxData?: Record<string, unknown>;
  estateData?: Record<string, unknown>;
  reservoirData?: Record<string, unknown>;
}

export const SAMPLE_CLIENTS: SamplePersona[] = [
  {
    name: '示範｜王太太 (45 家庭主婦)',
    age: 45,
    monthlyIncome: 0,
    family: ['配偶 (48 歲、科技業主管)', '長子 (15 歲、高一)', '次子 (12 歲、國一)', '女兒 (8 歲、小二)'],
    assets: 800,
    riskTolerance: 'low',
    retirementGoal: '60 歲退休、月領 6 萬',
    note: '配偶為主要收入來源、無自身收入；資產 800 萬（含房產 500 萬）；3 個小孩教育金缺口大；風險承受度低，偏好保本型。',
    // 守富情境：退休缺口大、保單健診優先
    pensionData: {
      currentAge: 45, retireAge: 60, salary: 0, laborInsYears: 0,
      selfContribution: false, pensionReturnRate: 3, desiredMonthlyIncome: 60000,
    },
    goldenSafeData: {
      mode: 'time', amount: 8, years: 15, rate: 5, isLocked: false,
      medicalLoss: 300, marketLoss: 50, taxLoss: 80,
    },
  },
  {
    name: '示範｜林先生 (32 科技業)',
    age: 32,
    monthlyIncome: 150000,
    family: ['單身'],
    assets: 250,
    riskTolerance: 'high',
    retirementGoal: '50 歲財富自由 + 自用住宅',
    note: '單身、年收 180 萬；目標 3 年內買房（頭期 300 萬）+ 長期投資；風險承受度高、能接受波動。',
    // 創富情境：超積極存錢 + 金融房產
    estateData: {
      loanAmount: 1200, loanTerm: 30, loanRate: 2.2, investReturnRate: 7,
      existingLoanBalance: 0, existingMonthlyPayment: 0,
    },
    pensionData: {
      currentAge: 32, retireAge: 50, salary: 150000, laborInsYears: 35,
      selfContribution: true, pensionReturnRate: 6, desiredMonthlyIncome: 80000,
    },
  },
  {
    name: '示範｜陳老闆 (58 將退休)',
    age: 58,
    monthlyIncome: 350000,
    family: ['配偶 (55 歲)', '長子 (32 歲、已成家、接班候選)', '次女 (28 歲、海外工作)'],
    assets: 4000,
    riskTolerance: 'medium',
    retirementGoal: '65 歲交棒、稅務最小化傳承給下一代',
    note: '中小企業老闆、資產 4,000 萬（含公司股權 2,000 萬、房產 1,500 萬、現金 500 萬）；2 個子女、希望節稅傳承；7 年內交棒。',
    // 傳富情境：稅務傳承 + 大小水庫
    taxData: {
      spouse: true, children: 2, minorYearsTotal: 0, parents: 0,
      cash: 5000, realEstateMarket: 15000, stocks: 20000, insurancePlan: 1000,
    },
    reservoirData: {
      initialCapital: 4000, dividendRate: 5, reinvestRate: 7, years: 10,
    },
  },
];

/**
 * Idempotency contract:
 * - Caller (App.tsx firstRun effect) only invokes this when it has decided
 *   the user is in firstRun window (URL flag OR createdAt < 5min) AND has
 *   no existing clients. We still re-check `users/{uid}/clients` size here
 *   as a belt-and-braces guard — if the user already added their own client
 *   during the 5-minute window we don't want to suddenly drop 3 samples on
 *   top of their work.
 * - Returns true if seeding actually happened (so the caller can fire an
 *   analytics event), false otherwise.
 */
export async function seedSampleClients(uid: string): Promise<boolean> {
  if (!uid) return false;
  try {
    const clientsCol = collection(db, 'users', uid, 'clients');
    const existing = await getDocs(clientsCol);
    if (existing.size > 0) return false;

    // writeBatch is one network round-trip — cheaper than 3 sequential addDoc
    // and atomic (we don't want a half-seeded state if the tab closes mid-write).
    const batch = writeBatch(db);
    const now = Timestamp.now();
    for (const persona of SAMPLE_CLIENTS) {
      const ref = doc(clientsCol); // auto-id
      batch.set(ref, {
        ...persona,
        isSample: true,
        createdFrom: 'onboarding-sample',
        createdAt: now,
        updatedAt: now,
      });
    }
    await batch.commit();
    return true;
  } catch (err) {
    // Never block onboarding on a seed failure — the user can still add
    // their own client. Just log for diagnostics.
    console.warn('[sampleClients] seed failed:', err);
    return false;
  }
}
