/**
 * 保單資料 → 各工具預填資料映射函數
 * 將健診結果帶入 Ultra Advisor 規劃工具
 */
import type { FamilyMember, MergedCoverage, CoverageGap, PlanningContext } from '../types/insurance';

/**
 * 根據缺口推薦適合的工具
 */
export function getRecommendedTools(
  context: PlanningContext,
): { toolId: string; label: string; reason: string; memberIds: string[] }[] {
  const recommendations: { toolId: string; label: string; reason: string; memberIds: string[] }[] = [];
  const toolMemberMap: Record<string, Set<string>> = {};
  const toolReasons: Record<string, string[]> = {};

  // 分析每位成員的缺口
  Object.entries(context.gaps).forEach(([memberId, gaps]) => {
    gaps.forEach(gap => {
      (gap.suggestedTools || []).forEach(toolId => {
        if (!toolMemberMap[toolId]) toolMemberMap[toolId] = new Set();
        toolMemberMap[toolId].add(memberId);
        if (!toolReasons[toolId]) toolReasons[toolId] = [];
        const memberName = context.selectedMembers.find(m => m.id === memberId)?.name || '';
        toolReasons[toolId].push(`${memberName}：${gap.category}`);
      });
    });
  });

  const TOOL_LABELS: Record<string, string> = {
    reservoir: '大小水庫專案',
    gift: '百萬禮物專案',
    pension: '退休缺口試算',
    estate: '金融房產專案',
    golden_safe: '黃金保險箱理論',
    super_active: '超積極存錢法',
  };

  Object.entries(toolMemberMap).forEach(([toolId, memberIds]) => {
    recommendations.push({
      toolId,
      label: TOOL_LABELS[toolId] || toolId,
      reason: toolReasons[toolId]?.slice(0, 3).join('、') || '',
      memberIds: Array.from(memberIds),
    });
  });

  // 按關聯人數排序
  recommendations.sort((a, b) => b.memberIds.length - a.memberIds.length);

  return recommendations;
}

/**
 * 將保單健診資料映射到特定工具的預填格式
 */
export function mapToPrefillData(
  toolId: string,
  member: PlanningContext['selectedMembers'][0],
  coverage: MergedCoverage | undefined,
): Record<string, any> {
  const base = {
    _fromCheckup: true,
    _memberName: member.name,
    _memberAge: member.age,
  };

  switch (toolId) {
    case 'pension':
      return {
        ...base,
        currentAge: member.age,
        annualIncome: member.annualIncome || 0,
        currentLifeInsurance: coverage?.totalCoverage.death || 0,
      };

    case 'reservoir':
      return {
        ...base,
        currentAge: member.age,
        annualIncome: member.annualIncome || 0,
        existingProtection: coverage?.totalCoverage.death || 0,
        existingMedical: coverage?.totalCoverage.medicalExpense || 0,
      };

    case 'gift':
      return {
        ...base,
        parentAge: member.age,
        existingGiftInsurance: coverage?.premiumSummary.totalAnnual || 0,
      };

    case 'estate':
      return {
        ...base,
        annualIncome: member.annualIncome || 0,
        existingAssets: coverage?.totalCoverage.death || 0,
      };

    case 'golden_safe':
      return {
        ...base,
        totalProtection: coverage?.totalCoverage.death || 0,
        totalSavings: coverage?.premiumSummary.byType.savings || 0,
        annualPremium: coverage?.premiumSummary.totalAnnual || 0,
      };

    default:
      return base;
  }
}
