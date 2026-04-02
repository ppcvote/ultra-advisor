/**
 * 保單健診系統 - 型別定義
 * 涵蓋家庭圖、保單、險種快取、理賠摘要、缺口分析等完整結構
 */

// ============================================================
// 共用型別
// ============================================================

export type CurrencyType = 'TWD' | 'USD' | 'CNY' | 'AUD' | 'EUR' | 'JPY' | 'GBP' | 'HKD';

export type ProductCategory =
  | 'life_term'              // 定期壽險
  | 'life_whole'             // 終身壽險
  | 'medical_expense'        // 實支實付
  | 'medical_daily'          // 住院日額
  | 'surgery'                // 手術險
  | 'critical_illness'       // 重大疾病
  | 'major_injury'           // 重大傷病
  | 'cancer'                 // 癌症險
  | 'accident'               // 意外險
  | 'accident_medical'       // 意外醫療
  | 'disability'             // 失能險
  | 'long_term_care'         // 長照險
  | 'waiver'                 // 豁免附約
  | 'annuity'                // 年金險
  | 'investment'             // 投資型
  | 'other';                 // 其他

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  life_term: '定期壽險',
  life_whole: '終身壽險',
  medical_expense: '實支實付',
  medical_daily: '住院日額',
  surgery: '手術險',
  critical_illness: '重大疾病',
  major_injury: '重大傷病',
  cancer: '癌症險',
  accident: '意外險',
  accident_medical: '意外醫療',
  disability: '失能險',
  long_term_care: '長照險',
  waiver: '豁免附約',
  annuity: '年金險',
  investment: '投資型',
  other: '其他',
};

// ============================================================
// 家庭圖
// ============================================================

export type Gender = 'male' | 'female';

export type RelationType =
  | 'self'           // 本人
  | 'spouse'         // 配偶
  | 'father'         // 父親
  | 'mother'         // 母親
  | 'father_in_law'  // 公公/岳父
  | 'mother_in_law'  // 婆婆/岳母
  | 'son'            // 兒子
  | 'daughter'       // 女兒
  | 'son_in_law'     // 女婿
  | 'daughter_in_law'// 媳婦
  | 'brother'        // 兄弟
  | 'sister'         // 姐妹
  | 'grandfather'    // 祖父/外公
  | 'grandmother'    // 祖母/外婆
  | 'grandson'       // 孫子
  | 'granddaughter'  // 孫女
  | 'uncle'          // 叔伯/舅舅
  | 'aunt'           // 姑姑/阿姨
  | 'nephew'         // 姪子/外甥
  | 'niece'          // 姪女/外甥女
  | 'cousin'         // 表/堂兄弟姐妹
  | 'other';         // 其他

export const RELATION_LABELS: Record<RelationType, string> = {
  self: '本人',
  spouse: '配偶',
  father: '父親',
  mother: '母親',
  father_in_law: '公公/岳父',
  mother_in_law: '婆婆/岳母',
  son: '兒子',
  daughter: '女兒',
  son_in_law: '女婿',
  daughter_in_law: '媳婦',
  brother: '兄弟',
  sister: '姐妹',
  grandfather: '祖父/外公',
  grandmother: '祖母/外婆',
  grandson: '孫子',
  granddaughter: '孫女',
  uncle: '叔伯/舅舅',
  aunt: '姑姑/阿姨',
  nephew: '姪子/外甥',
  niece: '姪女/外甥女',
  cousin: '表/堂兄弟姐妹',
  other: '其他',
};

export interface FamilyMember {
  id: string;
  name: string;
  relationship: RelationType;
  gender: Gender;
  birthDate?: string;              // YYYY-MM-DD
  age?: number;
  isDeceased?: boolean;
  isMainInsured?: boolean;         // 是否為主被保人

  // 關係連結
  spouseId?: string;
  parentIds?: string[];
  childrenIds?: string[];

  // 財務資料（用於規劃工具）
  annualIncome?: number;
  occupation?: string;
  occupationClass?: 1 | 2 | 3 | 4 | 5 | 6;

  // 保單連結
  policyIds?: string[];

  // 規劃選擇
  isSelectedForPlanning?: boolean;
}

export interface FamilyTree {
  id: string;
  userId: string;
  clientId?: string;               // 綁定客戶
  name: string;                    // 家庭名稱（如「王家」）
  mainInsuredId: string;
  members: FamilyMember[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 保單資料
// ============================================================

export type PaymentFrequency = '年繳' | '半年繳' | '季繳' | '月繳' | '躉繳';

export interface PolicyInfo {
  id: string;
  clientId?: string;               // 綁定客戶

  // 基本資料（OCR 抓取）
  insurer: string;
  policyNumber: string;
  applicant: string;               // 要保人
  applicantBirthDate?: string;     // 要保人生日 YYYY-MM-DD 或民國格式
  applicantAgeAtIssue?: number;    // 要保人投保年齡（用於反推生日）
  applicantGender?: Gender;        // 要保人性別
  insured: string;                 // 被保險人
  insuredBirthDate?: string;       // 被保險人生日 YYYY-MM-DD 或民國格式
  insuredAgeAtIssue?: number;      // 被保險人投保年齡（用於反推生日）
  insuredGender?: Gender;          // 被保險人性別
  effectiveDate: string;           // 契約生效日 YYYY-MM-DD
  expiryDate?: string;

  // 繳費資訊
  totalAnnualPremium: number;
  paymentFrequency: PaymentFrequency;

  // 選填（OCR）
  gender?: '男' | '女';
  ageAtIssue?: number;
  declaredInterestRate?: number;   // 宣告利率

  // 幣別
  currency: CurrencyType;
  exchangeRateAtIssue?: number;
  currentExchangeRate?: number;
  exchangeRateDate?: string;

  // 投資型保單
  isInvestmentLinked?: boolean;
  fundCode?: string;
  fundName?: string;
  units?: number;
  nav?: number;
  navDate?: string;
  accountValue?: number;
  totalCost?: number;

  // 險種明細
  coverages: Coverage[];

  // 價值追蹤
  value: {
    contractYears: number;
    contractMonths: number;
    totalMonthsElapsed: number;
    totalPremiumPaid: number;
    remainingPaymentYears?: number;
    surrenderValue?: number;
    surrenderValueDate?: string;
    roi?: number;
  };

  // 連結（Step 2 家庭圖確認時綁定，Step 1 輸入時可為空）
  familyMemberId?: string | null;

  // 提醒
  nextPaymentDate?: string;

  // 系統欄位
  createdAt: string;
  updatedAt: string;
  inputMethod: 'ocr' | 'manual';
}

// 險種明細
export interface Coverage {
  id: string;
  name: string;
  code?: string;
  sumInsured?: number;
  plan?: string;
  annualPremium: number;
  paymentYears?: number;
  coverageYears?: number;
  coverageEndDate?: string;
  isLifetime?: boolean;
  isRider: boolean;
  category?: ProductCategory;
  productCacheId?: string;
  claimSummary?: ClaimSummary;
  // AI 分析結果（存檔用）
  waitingPeriod?: number;
  isCopyReceipt?: boolean;
}

// ============================================================
// 理賠摘要標準化格式
// ============================================================

export interface ClaimSummary {
  // 一次金
  lumpSum?: {
    death?: number;
    accidentDeath?: number;
    totalDisability?: number;
    disability?: Record<string, number>;  // level1 ~ level11
    criticalIllness?: number;
    criticalIllnessLight?: number;
    specificDisease?: number;
    majorInjury?: number;
    cancer?: number;
    cancerLight?: number;
    burn?: number;
    bone?: number;
  };

  // 住院日額
  hospitalDaily?: {
    illness?: number;
    accident?: number;
    icu?: number;
    burn?: number;
    cancer?: number;
    maxDays?: number;
  };

  // 出院療養
  dischargeCare?: {
    daily?: number;
    maxDays?: number;
  };

  // 實支實付
  actualExpense?: {
    roomDaily?: number;
    roomIcu?: number;
    medicalExpense?: number;
    medicalExpenseIncrease?: { days?: number; multiplier?: number };
    surgeryInpatient?: number;
    surgeryOutpatient?: number;
    outpatientLimit?: number;
    emergencyOutpatient?: number;
    beforeAfterClinic?: boolean;
    beforeDays?: number;
    afterDays?: number;
    isCopyReceipt?: boolean;
    nonNhiRatio?: number;
    lifetimeLimit?: number;
    annualLimit?: number;
  };

  // 手術
  surgery?: {
    type: 'table' | 'ratio' | 'actual';
    baseAmount?: number;
    // 倍數範圍
    minMultiplier?: number;  // 最低倍數（如門診小手術 1-5 倍）
    maxMultiplier?: number;  // 最高倍數（如重大手術 80-100 倍）
    outpatientMultiplier?: string;  // 門診手術倍數範圍，如 "1-10"
    inpatientMultiplier?: string;   // 住院手術倍數範圍，如 "5-50"
    majorMultiplier?: string;       // 重大手術倍數範圍，如 "50-100"
    lifetimeLimit?: number;
    includesOutpatient?: boolean;
    // 常見手術範例（含理賠計算）
    examples?: {
      name: string;         // 手術名稱，如「痔瘡切除」
      category: string;     // 分類，如「門診」「住院」「重大」
      multiplier: number;   // 倍數，如 5
      payout?: number;      // 理賠金額（保額 x 倍數）
    }[];
  };

  // 癌症療程
  cancerTreatment?: {
    hospitalization?: number;
    surgery?: number;
    chemo?: number;
    radiation?: number;
    targetDrug?: number;
    outpatient?: number;
    bonemarrow?: number;
  };

  // 意外醫療
  accidentMedical?: {
    actualExpense?: number;
    actualExpenseIcu?: number;
    daily?: number;
    bone?: { complete?: number; incomplete?: number; crack?: number };
    burn?: { level2?: number; level3?: number };
    isCopyReceipt?: boolean;
    nonNhiRatio?: number;
  };

  // 長照/失能照護
  longTermCare?: {
    monthly?: number;
    annually?: number;
    lumpSum?: number;
    maxYears?: number;
    maxAmount?: number;
    trigger: string;
  };

  // 豁免
  waiver?: {
    hasWaiver: boolean;
    trigger: string;
    scope: string;
  };

  // 生存/滿期
  maturity?: {
    type: 'refund' | 'annuity' | 'lumpSum';
    amount?: number;
    description?: string;
  };

  // 其他
  others?: { name: string; description: string; amount?: number }[];
}

// ============================================================
// 險種快取資料庫
// ============================================================

export interface ProductCache {
  id: string;
  insurer: string;
  productName: string;
  productCode?: string;
  category: ProductCategory;
  keywords: string[];
  searchCount: number;
  lastSearched: string;
  status: 'selling' | 'discontinued';
  effectiveDate?: string;
  discontinuedDate?: string;
  waitingPeriod?: number;
  isCopyReceipt?: boolean;
  isGuaranteedRenewal?: boolean;
  claimConditions?: string;
  exclusions?: string;
  claimSummary: ClaimSummary;
  sourceUrl?: string;
  rawDescription?: string;
  lastUpdated: string;
  updatedBy: 'ai' | 'manual';
}

// ============================================================
// 合併計算與缺口分析
// ============================================================

export interface MergedCoverage {
  memberId: string;
  memberName: string;
  totalCoverage: {
    death: number;
    accidentDeath: number;
    criticalIllness: number;
    cancer: number;
    hospitalDailyIllness: number;
    hospitalDailyAccident: number;
    medicalExpense: number;
    surgeryInpatient: number;
    accidentMedical: number;
    disability: number;
    longTermCare: number;
  };
  policies: PolicyInfo[];
  premiumSummary: {
    totalAnnual: number;
    byType: {
      protection: number;
      investment: number;
      savings: number;
    };
    incomeRatio?: number;
  };
}

export interface CoverageGap {
  category: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  recommendation: string;
  suggestedTools?: string[];
}

export interface CoverageGapAnalysis {
  memberId: string;
  memberName: string;
  age: number;
  gaps: CoverageGap[];
  warnings: DuplicateCoverageWarning[];
  score: number;                   // 0-100 分
}

export interface DuplicateCoverageWarning {
  type: 'info' | 'warning';
  category: string;
  policies: string[];
  description: string;
  advice: string;
}

// ============================================================
// 規劃工具串接
// ============================================================

export interface PlanningContext {
  selectedMembers: {
    id: string;
    name: string;
    age: number;
    gender: Gender;
    relationship: RelationType;
    annualIncome?: number;
    occupation?: string;
  }[];
  currentCoverage: Record<string, MergedCoverage>;
  gaps: Record<string, CoverageGap[]>;
  currentPremium: Record<string, number>;
}

// ============================================================
// 保單健診工具 State
// ============================================================

export interface InsuranceCheckupData {
  activeStep: 1 | 2 | 3;
  clientId?: string;               // 綁定客戶
  familyTreeId?: string;
  selectedMemberIds?: string[];
}

// ============================================================
// 保險公司列表
// ============================================================

export const TAIWAN_INSURERS = [
  { code: 'TGL', name: '全球人壽' },
  { code: 'NAN', name: '南山人壽' },
  { code: 'CAT', name: '國泰人壽' },
  { code: 'TWL', name: '台灣人壽' },
  { code: 'FUB', name: '富邦人壽' },
  { code: 'CHN', name: '中國人壽' },
  { code: 'SHK', name: '新光人壽' },
  { code: 'ALZ', name: '安聯人壽' },
  { code: 'MER', name: '三商美邦' },
  { code: 'TAI', name: '台新人壽' },
  { code: 'YUA', name: '元大人壽' },
  { code: 'FAR', name: '遠雄人壽' },
  { code: 'HON', name: '宏泰人壽' },
  { code: 'FGL', name: '第一金人壽' },
] as const;

export const CURRENCY_LABELS: Record<CurrencyType, string> = {
  TWD: '新台幣',
  USD: '美元',
  CNY: '人民幣',
  AUD: '澳幣',
  EUR: '歐元',
  JPY: '日圓',
  GBP: '英鎊',
  HKD: '港幣',
};

// ============================================================
// 相容型別 — InsurancePolicyScanner.tsx / insuranceBenchmarks.ts 使用
// ============================================================

export type PolicyStatus = 'active' | 'lapsed' | 'surrendered';

export type PaymentMethod = 'annual' | 'semi-annual' | 'quarterly' | 'monthly' | 'single';

export type FamilyRelationship = 'self' | 'spouse' | 'child' | 'parent' | 'sibling' | 'other';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  annual: '年繳',
  'semi-annual': '半年繳',
  quarterly: '季繳',
  monthly: '月繳',
  single: '躉繳',
};

export const POLICY_STATUS_LABELS: Record<PolicyStatus, { label: string; color: string }> = {
  active: { label: '有效', color: '#10b981' },
  lapsed: { label: '停效', color: '#f59e0b' },
  surrendered: { label: '已解約', color: '#ef4444' },
};

export type InsuranceCategory = 'life' | 'medical' | 'accident' | 'cancer' | 'disability' | 'savings';

export const CATEGORY_INFO: Record<InsuranceCategory, { label: string; color: string }> = {
  life: { label: '壽險保障', color: '#3b82f6' },
  medical: { label: '醫療保障', color: '#10b981' },
  accident: { label: '意外保障', color: '#f59e0b' },
  cancer: { label: '癌症保障', color: '#ef4444' },
  disability: { label: '失能保障', color: '#8b5cf6' },
  savings: { label: '退休儲蓄規劃', color: '#6366f1' },
};

export interface InsurancePolicy {
  id: string;
  insurer: string;
  productName: string;
  insuredName: string;
  category: InsuranceCategory;
  coverageAmount: number;
  annualPremium: number;
  status: 'active' | 'lapsed' | 'surrendered';
  effectiveDate: string;
  expiryDate?: string;
}

export interface CoverageAnalysis {
  category: InsuranceCategory;
  categoryName: string;
  currentCoverage: number;
  recommendedCoverage: number;
  gapAmount: number;
  gapPercentage: number;
  status: 'sufficient' | 'warning' | 'critical';
}

export interface AnalysisReport {
  clientName: string;
  annualIncome: number;
  dailySalary: number;
  totalPolicies: number;
  totalAnnualPremium: number;
  premiumToIncomeRatio: number;
  coverageByCategory: CoverageAnalysis[];
  recommendations: string[];
  generatedAt: string;
}
