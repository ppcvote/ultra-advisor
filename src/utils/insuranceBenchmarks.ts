/**
 * 保單健診系統 - 建議保額標準 & 缺口分析
 *
 * 建議標準（用戶指定）：
 * - 壽險保額 = 年收入 × 10
 * - 醫療險一筆給付保額 = 年收入 × 5
 * - 退休規劃建議 = 年收入 × 20%
 * - 教育基金建議 = 年收入 × 5%
 * - 住院日額+實支實付 > 每日薪資 + 雙人病房費
 */

import {
  InsuranceCategory,
  InsurancePolicy,
  CoverageAnalysis,
  AnalysisReport,
  CATEGORY_INFO,
} from '../types/insurance';

// 建議保額計算公式
export const COVERAGE_BENCHMARKS: Record<InsuranceCategory, {
  label: string;
  formula: (annualIncome: number, dailySalary: number) => number;
  description: string;
}> = {
  life: {
    label: '壽險保障',
    formula: (annualIncome) => annualIncome * 10,
    description: '年收入 × 10 倍',
  },
  medical: {
    label: '醫療保障',
    formula: (annualIncome) => annualIncome * 5,
    description: '年收入 × 5 倍（一筆給付）',
  },
  accident: {
    label: '意外保障',
    formula: (annualIncome) => annualIncome * 10,
    description: '年收入 × 10 倍',
  },
  cancer: {
    label: '癌症保障',
    formula: (annualIncome) => annualIncome * 3,
    description: '年收入 × 3 倍',
  },
  disability: {
    label: '失能保障',
    formula: (annualIncome) => Math.round(annualIncome / 12 * 200),
    description: '月收入 × 200 個月',
  },
  savings: {
    label: '退休儲蓄規劃',
    formula: (annualIncome) => annualIncome * 0.2,
    description: '年收入 × 20%（年繳保費建議）',
  },
};

/**
 * 計算各險種的缺口分析
 */
export const analyzeCoverageGaps = (
  policies: InsurancePolicy[],
  annualIncome: number,
  dailySalary: number,
): CoverageAnalysis[] => {
  const activePolicies = policies.filter(p => p.status === 'active');

  const categories: InsuranceCategory[] = [
    'life', 'medical', 'accident', 'cancer', 'disability', 'savings',
  ];

  return categories.map(category => {
    const categoryPolicies = activePolicies.filter(p => p.category === category);

    // 儲蓄型用年保費加總，其他用保額加總
    const currentCoverage = category === 'savings'
      ? categoryPolicies.reduce((sum, p) => sum + p.annualPremium, 0)
      : categoryPolicies.reduce((sum, p) => sum + p.coverageAmount, 0);

    const benchmark = COVERAGE_BENCHMARKS[category];
    const recommendedCoverage = benchmark.formula(annualIncome, dailySalary);
    const gapAmount = currentCoverage - recommendedCoverage;
    const gapPercentage = recommendedCoverage > 0
      ? Math.round((currentCoverage / recommendedCoverage) * 100)
      : 100;

    let status: 'sufficient' | 'warning' | 'critical';
    if (gapPercentage >= 80) {
      status = 'sufficient';
    } else if (gapPercentage >= 50) {
      status = 'warning';
    } else {
      status = 'critical';
    }

    return {
      category,
      categoryName: CATEGORY_INFO[category].label,
      currentCoverage,
      recommendedCoverage,
      gapAmount,
      gapPercentage,
      status,
    };
  });
};

/**
 * 產生加保建議
 */
export const generateRecommendations = (
  coverageAnalysis: CoverageAnalysis[],
  annualIncome: number,
): string[] => {
  const recommendations: string[] = [];

  for (const analysis of coverageAnalysis) {
    if (analysis.status === 'critical') {
      const shortfall = Math.abs(analysis.gapAmount);
      const benchmark = COVERAGE_BENCHMARKS[analysis.category];
      if (analysis.category === 'savings') {
        recommendations.push(
          `【急需補強】${analysis.categoryName}：目前年繳保費 ${formatCurrency(analysis.currentCoverage)}，建議至少 ${formatCurrency(analysis.recommendedCoverage)}（${benchmark.description}），缺口 ${formatCurrency(shortfall)}。`
        );
      } else {
        recommendations.push(
          `【急需補強】${analysis.categoryName}：目前保額 ${formatCurrency(analysis.currentCoverage)}，建議至少 ${formatCurrency(analysis.recommendedCoverage)}（${benchmark.description}），缺口 ${formatCurrency(shortfall)}。`
        );
      }
    } else if (analysis.status === 'warning') {
      const shortfall = Math.abs(analysis.gapAmount);
      recommendations.push(
        `【建議加強】${analysis.categoryName}：目前達到建議值的 ${analysis.gapPercentage}%，仍有 ${formatCurrency(shortfall)} 的缺口可考慮補強。`
      );
    }
  }

  // 整體保費佔收入比建議
  const totalPremium = coverageAnalysis.reduce((sum, a) => {
    return sum + (a.category === 'savings' ? a.currentCoverage : 0);
  }, 0);

  if (annualIncome > 0) {
    const ratio = totalPremium / annualIncome * 100;
    if (ratio > 30) {
      recommendations.push(
        `【注意】總保費佔年收入 ${ratio.toFixed(1)}%，超過 30% 可能造成財務壓力，建議檢視是否有重複保障可調整。`
      );
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('保障規劃完善，各險種保額均達建議標準 80% 以上。建議每年定期檢視，確保保障持續足夠。');
  }

  return recommendations;
};

/**
 * 產生完整健診報告
 */
export const generateAnalysisReport = (
  policies: InsurancePolicy[],
  annualIncome: number,
  dailySalary: number,
  clientName: string = '全部保單',
): AnalysisReport => {
  const activePolicies = policies.filter(p => p.status === 'active');
  const totalAnnualPremium = activePolicies.reduce((sum, p) => sum + p.annualPremium, 0);
  const coverageByCategory = analyzeCoverageGaps(policies, annualIncome, dailySalary);
  const recommendations = generateRecommendations(coverageByCategory, annualIncome);

  return {
    clientName,
    annualIncome,
    dailySalary,
    totalPolicies: activePolicies.length,
    totalAnnualPremium,
    premiumToIncomeRatio: annualIncome > 0 ? totalAnnualPremium / annualIncome * 100 : 0,
    coverageByCategory,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
};

// 格式化金額
export const formatCurrency = (amount: number): string => {
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(amount % 10000 === 0 ? 0 : 1)} 萬`;
  }
  return amount.toLocaleString('zh-TW');
};

// ============================================================
// V2 缺口分析（用於保單健診系統 Phase 4）
// ============================================================

import type {
  MergedCoverage, CoverageGap, CoverageGapAnalysis, DuplicateCoverageWarning,
  PolicyInfo, FamilyMember,
} from '../types/insurance';

const BENCHMARKS_V2: Record<string, {
  label: string;
  formula: (income: number, age: number) => number;
  unit: string;
}> = {
  death: {
    label: '壽險保障',
    formula: (inc) => inc * 10,
    unit: '元',
  },
  accidentDeath: {
    label: '意外保障',
    formula: (inc) => inc * 10,
    unit: '元',
  },
  criticalIllness: {
    label: '重大疾病',
    formula: (inc) => inc * 5,
    unit: '元',
  },
  cancer: {
    label: '癌症保障',
    formula: (inc) => inc * 3,
    unit: '元',
  },
  hospitalDailyIllness: {
    label: '住院日額',
    formula: () => 3000,
    unit: '元/日',
  },
  medicalExpense: {
    label: '實支實付',
    formula: () => 300000,
    unit: '元',
  },
  disability: {
    label: '失能保障',
    formula: (inc) => Math.round(inc / 12 * 200),
    unit: '元',
  },
  longTermCare: {
    label: '長照保障',
    formula: () => 480000,
    unit: '元/年',
  },
};

/**
 * V2 缺口分析 — 用於保單健診系統
 */
export function analyzeCoverageGapsV2(
  merged: MergedCoverage,
  member: FamilyMember,
): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  const income = member.annualIncome || 600000; // 預設 60 萬
  const age = member.age || 35;

  Object.entries(BENCHMARKS_V2).forEach(([key, benchmark]) => {
    const current = merged.totalCoverage[key as keyof typeof merged.totalCoverage] || 0;
    const recommended = benchmark.formula(income, age);
    const ratio = recommended > 0 ? current / recommended : 1;

    if (ratio < 0.5) {
      gaps.push({
        category: benchmark.label,
        severity: 'critical',
        description: `${benchmark.label}嚴重不足，目前 ${formatCurrency(current)}，建議至少 ${formatCurrency(recommended)}（達標率 ${Math.round(ratio * 100)}%）`,
        recommendation: `建議增加 ${formatCurrency(recommended - current)} 的${benchmark.label}`,
        suggestedTools: getSuggestedTools(key),
      });
    } else if (ratio < 0.8) {
      gaps.push({
        category: benchmark.label,
        severity: 'warning',
        description: `${benchmark.label}略有不足，目前達標率 ${Math.round(ratio * 100)}%`,
        recommendation: `建議補強 ${formatCurrency(recommended - current)}`,
        suggestedTools: getSuggestedTools(key),
      });
    }
  });

  // 無任何保障的特殊提醒
  const totalCovSum = Object.values(merged.totalCoverage).reduce((s, v) => s + v, 0);
  if (totalCovSum === 0) {
    gaps.unshift({
      category: '整體保障',
      severity: 'critical',
      description: '此成員目前無任何保障，建議優先規劃基本壽險與醫療險',
      recommendation: '建議使用大小水庫專案規劃基本保障',
      suggestedTools: ['reservoir', 'pension'],
    });
  }

  return gaps;
}

function getSuggestedTools(coverageKey: string): string[] {
  const map: Record<string, string[]> = {
    death: ['reservoir', 'gift'],
    accidentDeath: ['reservoir'],
    criticalIllness: ['reservoir'],
    cancer: ['reservoir'],
    hospitalDailyIllness: ['reservoir'],
    medicalExpense: ['reservoir'],
    disability: ['reservoir', 'pension'],
    longTermCare: ['pension'],
  };
  return map[coverageKey] || [];
}

/**
 * 重複保障偵測
 */
export function detectDuplicateCoverage(
  policies: PolicyInfo[],
): DuplicateCoverageWarning[] {
  const warnings: DuplicateCoverageWarning[] = [];

  // 實支實付數量檢查
  const actualExpenseCoverages = policies.flatMap(p =>
    p.coverages.filter(c => c.category === 'medical_expense')
      .map(c => ({ policyId: p.id, insurer: p.insurer, name: c.name, isCopyReceipt: c.claimSummary?.actualExpense?.isCopyReceipt }))
  );

  if (actualExpenseCoverages.length > 2) {
    const names = actualExpenseCoverages.map(c => `${c.insurer} ${c.name}`);
    const nonCopyCount = actualExpenseCoverages.filter(c => !c.isCopyReceipt).length;
    warnings.push({
      type: nonCopyCount > 1 ? 'warning' : 'info',
      category: '實支實付',
      policies: names,
      description: `有 ${actualExpenseCoverages.length} 張實支實付${nonCopyCount > 1 ? `，其中 ${nonCopyCount} 張不接受副本理賠` : ''}`,
      advice: nonCopyCount > 1
        ? '多張不接受副本的實支實付可能造成保費浪費，建議檢視是否需要調整'
        : '目前配置合理，正本 + 副本可提高理賠額度',
    });
  }

  // 壽險重複
  const lifeCoverages = policies.flatMap(p =>
    p.coverages.filter(c => c.category === 'life_whole' || c.category === 'life_term')
      .map(c => `${p.insurer} ${c.name}`)
  );

  if (lifeCoverages.length > 3) {
    warnings.push({
      type: 'info',
      category: '壽險',
      policies: lifeCoverages,
      description: `有 ${lifeCoverages.length} 張壽險保單`,
      advice: '多張壽險可確保保障充足，但也需注意總保費是否合理',
    });
  }

  return warnings;
}

/**
 * 計算保障分數（0-100）
 */
export function calculateCoverageScore(gaps: CoverageGap[]): number {
  let score = 100;
  gaps.forEach(gap => {
    if (gap.severity === 'critical') score -= 15;
    else if (gap.severity === 'warning') score -= 8;
    else score -= 3;
  });
  return Math.max(0, Math.min(100, score));
}
