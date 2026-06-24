/**
 * Sprint 6 — ClientProfile schema
 *
 * 14 個工具是孤島，顧問每次切換客戶都要重 key 年齡 / 收入 / 家庭。
 * 這裡把高頻欄位抽出來放到 client doc 上、下個 phase 工具會用「主動帶入」chip 一次性套用。
 *
 * 設計鐵則：
 *  1. 全部 optional — 不能因為新欄位空白讓既有客戶顯示「資料不完整」紅字
 *  2. 不需要 migration — 既有 client doc 缺欄位 read 時自動 fallback undefined
 *  3. age 不另存（client schema 已有 birthday）— chip 套用時動態算
 *     避免 birthday / age 兩份真實來源 drift。但這裡仍開放 age？欄位
 *     給「顧問只記得年齡、不記得確切生日」的情境，由 UI 二擇一填即可。
 */

export type FamilyStatus =
  | 'single'              // 單身
  | 'married'             // 已婚（無子女）
  | 'married_with_kids'   // 已婚（有子女）
  | 'divorced'            // 離異
  | 'widowed';            // 喪偶

export const FAMILY_STATUS_LABELS: Record<FamilyStatus, string> = {
  single: '單身',
  married: '已婚',
  married_with_kids: '已婚（有子女）',
  divorced: '離異',
  widowed: '喪偶',
};

export type RiskTolerance =
  | 'conservative'  // 保守
  | 'balanced'     // 穩健
  | 'aggressive';  // 積極

export const RISK_TOLERANCE_LABELS: Record<RiskTolerance, string> = {
  conservative: '保守',
  balanced: '穩健',
  aggressive: '積極',
};

/**
 * 新增的進階欄位 — 全部 optional，存在 client doc 的 root。
 * 之所以 flat（不包在 client.profile）是為了 backward compat：
 * 舊讀取 client doc 的程式碼不需要任何改動，看不到也不會壞。
 */
export interface ClientProfile {
  /** 客戶年齡。若同時有 birthday，請以 birthday 算出的為主。 */
  age?: number;

  /** 月收入（NTD）。LaborPensionTool.salary 對映。 */
  monthlyIncome?: number;

  /** 家庭狀況。TaxPlannerTool.spouse + 子女連動參考。 */
  familyStatus?: FamilyStatus;

  /** 子女人數。TaxPlannerTool.children 對映。 */
  childrenCount?: number;

  /** 預期退休年齡（一般預設 65、但顧問常見 55 或 60）。LaborPensionTool.retireAge 對映。 */
  retirementAge?: number;

  /** 風險屬性。SuperActiveSavingTool / FundTimeMachine 帶入用。 */
  riskTolerance?: RiskTolerance;

  /** 期望退休後月所得（NTD）。LaborPensionTool.desiredMonthlyIncome 對映。 */
  desiredMonthlyRetirementIncome?: number;
}

/**
 * 進階欄位 keys —— 用來算「資料完整度」徽章 X/7
 * 順序代表 UI 上的呈現順序
 */
export const CLIENT_PROFILE_FIELDS: readonly (keyof ClientProfile)[] = [
  'age',
  'monthlyIncome',
  'familyStatus',
  'childrenCount',
  'retirementAge',
  'riskTolerance',
  'desiredMonthlyRetirementIncome',
] as const;

export const CLIENT_PROFILE_TOTAL = CLIENT_PROFILE_FIELDS.length;

/**
 * 計算 client doc 上的 profile 完整度（X/7）
 * undefined / null / '' / NaN 都視為「未填」
 * 0 視為「已填」（月收入填 0 也是合理，例如退休客戶）
 */
export function countClientProfileFields(client: any): number {
  if (!client) return 0;
  let n = 0;
  for (const key of CLIENT_PROFILE_FIELDS) {
    const v = client[key];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'number' && Number.isNaN(v)) continue;
    n++;
  }
  return n;
}
