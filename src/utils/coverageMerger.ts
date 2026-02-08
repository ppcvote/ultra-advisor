/**
 * 多張保單合併計算邏輯
 * 將同一成員的多張保單合併為統一的保障總額
 */
import type { PolicyInfo, MergedCoverage, ClaimSummary } from '../types/insurance';

/**
 * 合併單一成員的所有保單
 */
export function mergeMemberCoverage(
  memberId: string,
  memberName: string,
  policies: PolicyInfo[],
  annualIncome?: number,
): MergedCoverage {
  const totalCoverage: MergedCoverage['totalCoverage'] = {
    death: 0,
    accidentDeath: 0,
    criticalIllness: 0,
    cancer: 0,
    hospitalDailyIllness: 0,
    hospitalDailyAccident: 0,
    medicalExpense: 0,
    surgeryInpatient: 0,
    accidentMedical: 0,
    disability: 0,
    longTermCare: 0,
  };

  let protectionPremium = 0;
  let investmentPremium = 0;
  let savingsPremium = 0;
  let totalAnnual = 0;

  policies.forEach(policy => {
    totalAnnual += policy.totalAnnualPremium || 0;

    policy.coverages.forEach(cov => {
      const cs = cov.claimSummary;
      if (!cs) return;

      // 一次金
      if (cs.lumpSum) {
        totalCoverage.death += cs.lumpSum.death || 0;
        totalCoverage.accidentDeath += cs.lumpSum.accidentDeath || 0;
        totalCoverage.criticalIllness += (cs.lumpSum.criticalIllness || 0) + (cs.lumpSum.majorInjury || 0);
        totalCoverage.cancer += cs.lumpSum.cancer || 0;
        totalCoverage.disability += cs.lumpSum.totalDisability || 0;
      }

      // 住院日額
      if (cs.hospitalDaily) {
        totalCoverage.hospitalDailyIllness += cs.hospitalDaily.illness || 0;
        totalCoverage.hospitalDailyAccident += cs.hospitalDaily.accident || 0;
      }

      // 實支實付
      if (cs.actualExpense) {
        totalCoverage.medicalExpense += cs.actualExpense.medicalExpense || 0;
        totalCoverage.surgeryInpatient += cs.actualExpense.surgeryInpatient || 0;
      }

      // 意外醫療
      if (cs.accidentMedical) {
        totalCoverage.accidentMedical += cs.accidentMedical.actualExpense || 0;
      }

      // 長照
      if (cs.longTermCare) {
        totalCoverage.longTermCare += (cs.longTermCare.monthly || 0) * 12;
      }

      // 保費分類
      const category = cov.category || '';
      if (['investment', 'annuity'].includes(category)) {
        investmentPremium += cov.annualPremium;
      } else if (['life_whole'].includes(category) && (cov.paymentYears || 0) <= 20) {
        savingsPremium += cov.annualPremium;
      } else {
        protectionPremium += cov.annualPremium;
      }
    });
  });

  return {
    memberId,
    memberName,
    totalCoverage,
    policies,
    premiumSummary: {
      totalAnnual,
      byType: {
        protection: protectionPremium,
        investment: investmentPremium,
        savings: savingsPremium,
      },
      incomeRatio: annualIncome && annualIncome > 0
        ? (totalAnnual / annualIncome) * 100
        : undefined,
    },
  };
}
