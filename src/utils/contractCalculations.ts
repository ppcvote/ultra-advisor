/**
 * 契約計算工具
 * 契約年資、已繳保費、剩餘繳費年數
 */

/**
 * 計算契約年資（年 + 月）
 */
export function calcContractAge(effectiveDate: string): { years: number; months: number; totalMonths: number } {
  const start = new Date(effectiveDate);
  const now = new Date();

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();

  if (months < 0) {
    years--;
    months += 12;
  }
  if (now.getDate() < start.getDate()) {
    months--;
    if (months < 0) {
      years--;
      months += 12;
    }
  }

  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
    totalMonths: Math.max(0, years * 12 + months),
  };
}

/**
 * 計算已繳保費
 */
export function calcTotalPremiumPaid(
  annualPremium: number,
  effectiveDate: string,
  frequency: '年繳' | '半年繳' | '季繳' | '月繳' | '躉繳',
  paymentYears?: number,
): number {
  if (frequency === '躉繳') {
    return annualPremium;
  }

  const { totalMonths } = calcContractAge(effectiveDate);

  // 繳費月數上限
  const maxPaymentMonths = paymentYears ? paymentYears * 12 : Infinity;
  const paidMonths = Math.min(totalMonths, maxPaymentMonths);

  const periodsPerYear: Record<string, number> = {
    '年繳': 1,
    '半年繳': 2,
    '季繳': 4,
    '月繳': 12,
  };

  const periods = periodsPerYear[frequency] || 1;
  const monthsPerPeriod = 12 / periods;
  const completedPeriods = Math.floor(paidMonths / monthsPerPeriod);
  const premiumPerPeriod = annualPremium / periods;

  return Math.round(completedPeriods * premiumPerPeriod);
}

/**
 * 計算剩餘繳費年數
 */
export function calcRemainingPaymentYears(
  effectiveDate: string,
  paymentYears?: number,
): number | null {
  if (!paymentYears) return null;
  const { years, months } = calcContractAge(effectiveDate);
  const remaining = paymentYears - years - (months > 0 ? 1 : 0);
  return Math.max(0, remaining);
}

/**
 * 計算投資報酬率（IRR 簡化版）
 */
export function calcSimpleROI(
  totalPremiumPaid: number,
  surrenderValue: number,
): number {
  if (totalPremiumPaid <= 0) return 0;
  return ((surrenderValue - totalPremiumPaid) / totalPremiumPaid) * 100;
}

/**
 * 格式化契約年資
 */
export function formatContractAge(effectiveDate: string): string {
  const { years, months } = calcContractAge(effectiveDate);
  if (years === 0 && months === 0) return '不足 1 個月';
  if (years === 0) return `${months} 個月`;
  if (months === 0) return `${years} 年`;
  return `${years} 年 ${months} 個月`;
}
