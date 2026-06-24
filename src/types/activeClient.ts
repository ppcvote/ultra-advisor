/**
 * ActiveClient & ClientProfile types — Sprint 6 client-context bridge
 *
 * Why all fields optional: existing client Firestore docs predate this schema
 * and we don't want to force a migration (CLAUDE.md鐵則).
 *
 * `birthday` lives at the top level (legacy ClientFormData shape).
 * Profile fields added in Sprint 6 live under `.profile` so they're easy to
 * grep + grow without polluting the root namespace.
 */

export interface ClientProfile {
  /** 月收入（NTD），對映 LaborPensionTool.salary */
  monthlyIncome?: number;
  /** 預計退休年齡，對映 LaborPensionTool.retireAge */
  retirementAge?: number;
  /** 已婚，對映 TaxPlannerTool.spouse */
  hasSpouse?: boolean;
  /** 子女人數，對映 TaxPlannerTool.children */
  childrenCount?: number;
  /** 扶養父母人數，對映 TaxPlannerTool.parents */
  dependentParents?: number;
}

export interface ActiveClient {
  id: string;
  name: string;
  phone?: string;
  /** yyyy-mm-dd; chip 用這個算 currentAge / clientAge / age */
  birthday?: string;
  note?: string;
  isSample?: boolean;
  profile?: ClientProfile;
  /** Allow legacy / unknown fields without breaking type checks. */
  [key: string]: unknown;
}

/** 由 birthday yyyy-mm-dd 算出當下年齡，無效輸入回 null。 */
export function computeAgeFromBirthday(birthday: string | undefined | null): number | null {
  if (!birthday || typeof birthday !== 'string') return null;
  // 接受 yyyy-mm-dd 或 yyyy/mm/dd
  const m = birthday.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  // 還沒到生日當天就 -1（顧問報稅時年齡要精確）
  const beforeBirthday =
    now.getMonth() + 1 < mo ||
    (now.getMonth() + 1 === mo && now.getDate() < d);
  if (beforeBirthday) age -= 1;
  if (age < 0 || age > 150) return null;
  return age;
}
