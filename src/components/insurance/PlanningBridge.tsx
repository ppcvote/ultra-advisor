/**
 * 規劃橋接模組（Step 4）
 * 成員選擇、工具推薦、預填資料跳轉、PDF 匯出
 */
import React, { useMemo } from 'react';
import {
  Rocket, ArrowLeft, ArrowRight, CheckSquare, Square,
  Waves, Wallet, Umbrella, Building2, ShieldCheck, Zap,
} from 'lucide-react';
import { usePolicies } from '../../hooks/usePolicies';
import { useFamilyTree } from '../../hooks/useFamilyTree';
import { mergeMemberCoverage } from '../../utils/coverageMerger';
import { analyzeCoverageGapsV2, calculateCoverageScore } from '../../utils/insuranceBenchmarks';
import { getRecommendedTools, mapToPrefillData } from '../../utils/planningBridge';
import CheckupReportPdf from './CheckupReportPdf';
import type { MergedCoverage, CoverageGapAnalysis, PlanningContext } from '../../types/insurance';

interface PlanningBridgeProps {
  userId?: string;
  onNavigateToTool?: (toolId: string, prefillData: any) => void;
  onBack: () => void;
}

const TOOL_ICONS: Record<string, any> = {
  reservoir: Waves,
  gift: Wallet,
  pension: Umbrella,
  estate: Building2,
  golden_safe: ShieldCheck,
  super_active: Zap,
};

export default function PlanningBridge({ userId, onNavigateToTool, onBack }: PlanningBridgeProps) {
  const { policies, loading: policiesLoading } = usePolicies(userId || null);
  const { activeTree, loading: treeLoading, togglePlanning } = useFamilyTree(userId || null);

  const members = activeTree?.members || [];
  const loading = policiesLoading || treeLoading;

  // 合併計算
  const coverageMap = useMemo<Record<string, MergedCoverage>>(() => {
    const map: Record<string, MergedCoverage> = {};
    members.forEach(m => {
      const memberPolicies = policies.filter(p => p.familyMemberId === m.id);
      map[m.id] = mergeMemberCoverage(m.id, m.name, memberPolicies, m.annualIncome);
    });
    return map;
  }, [members, policies]);

  // 缺口分析
  const gapAnalysis = useMemo<Record<string, CoverageGapAnalysis>>(() => {
    const result: Record<string, CoverageGapAnalysis> = {};
    members.forEach(m => {
      const merged = coverageMap[m.id];
      if (!merged) return;
      const gaps = analyzeCoverageGapsV2(merged, m);
      result[m.id] = {
        memberId: m.id,
        memberName: m.name,
        age: m.age || 0,
        gaps,
        warnings: [],
        score: calculateCoverageScore(gaps),
      };
    });
    return result;
  }, [members, coverageMap]);

  // 規劃上下文
  const planningContext = useMemo<PlanningContext>(() => {
    const selectedMembers = members
      .filter(m => m.isSelectedForPlanning)
      .map(m => ({
        id: m.id,
        name: m.name,
        age: m.age || 0,
        gender: m.gender,
        relationship: m.relationship,
        annualIncome: m.annualIncome,
        occupation: m.occupation,
      }));

    const currentCoverage: Record<string, MergedCoverage> = {};
    const gaps: Record<string, any[]> = {};
    const currentPremium: Record<string, number> = {};

    selectedMembers.forEach(sm => {
      currentCoverage[sm.id] = coverageMap[sm.id];
      gaps[sm.id] = gapAnalysis[sm.id]?.gaps || [];
      currentPremium[sm.id] = coverageMap[sm.id]?.premiumSummary.totalAnnual || 0;
    });

    return { selectedMembers, currentCoverage, gaps, currentPremium };
  }, [members, coverageMap, gapAnalysis]);

  // 推薦工具
  const recommendedTools = useMemo(
    () => getRecommendedTools(planningContext),
    [planningContext]
  );

  const selectedCount = members.filter(m => m.isSelectedForPlanning).length;
  const familyScore = useMemo(() => {
    const scores = Object.values(gapAnalysis).map(a => a.score);
    return scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
  }, [gapAnalysis]);

  const totalAnnualPremium = policies.reduce((sum, p) => sum + (p.totalAnnualPremium || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-slate-800 mb-2">進入規劃</h2>
      <p className="text-sm text-slate-500 mb-6">
        選擇家庭成員，系統會根據缺口分析推薦適合的規劃工具。
      </p>

      {/* 成員選擇 */}
      <div className="bg-white border rounded-2xl p-5 mb-6">
        <h3 className="font-medium text-slate-700 mb-3">選擇要規劃的成員</h3>
        <div className="space-y-2">
          {members.map(m => {
            const analysis = gapAnalysis[m.id];
            const memberPolicies = policies.filter(p => p.familyMemberId === m.id);
            const hasGaps = (analysis?.gaps.length || 0) > 0;

            return (
              <button
                key={m.id}
                onClick={() => togglePlanning(m.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                  m.isSelectedForPlanning
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  {m.isSelectedForPlanning
                    ? <CheckSquare size={18} className="text-blue-500" />
                    : <Square size={18} className="text-slate-300" />
                  }
                  <div className="text-left">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-slate-400">
                      {memberPolicies.length} 張保單
                      {analysis && ` · ${analysis.score} 分`}
                    </div>
                  </div>
                </div>
                {hasGaps && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                    {analysis?.gaps.length} 個缺口
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 推薦工具 */}
      {selectedCount > 0 && recommendedTools.length > 0 && (
        <div className="bg-white border rounded-2xl p-5 mb-6">
          <h3 className="font-medium text-slate-700 mb-3">推薦規劃工具</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recommendedTools.map(tool => {
              const Icon = TOOL_ICONS[tool.toolId] || Rocket;

              return (
                <button
                  key={tool.toolId}
                  onClick={() => {
                    if (onNavigateToTool) {
                      // 取第一位選中成員的預填資料
                      const firstMember = planningContext.selectedMembers[0];
                      const prefillData = firstMember
                        ? mapToPrefillData(tool.toolId, firstMember, coverageMap[firstMember.id])
                        : {};
                      onNavigateToTool(tool.toolId, prefillData);
                    }
                  }}
                  className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl hover:bg-blue-50 hover:border-blue-300 border border-slate-200 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <Icon size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-700 text-sm">{tool.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{tool.reason}</div>
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-blue-600">
                      開始規劃 <ArrowRight size={12} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 mt-3">
            已選成員資料將自動帶入工具，無需重新輸入。
          </p>
        </div>
      )}

      {/* PDF 匯出 */}
      <div className="flex items-center justify-between bg-white border rounded-2xl p-5 mb-6">
        <div>
          <h3 className="font-medium text-slate-700">匯出健診報告</h3>
          <p className="text-xs text-slate-400 mt-1">將完整分析結果匯出為 PDF 檔案</p>
        </div>
        <CheckupReportPdf
          familyName={activeTree?.name || '家庭'}
          members={members}
          coverageMap={coverageMap}
          gapAnalysis={gapAnalysis}
          totalPolicies={policies.length}
          totalAnnualPremium={totalAnnualPremium}
          familyScore={familyScore}
        />
      </div>

      {/* 導航 */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
        >
          <ArrowLeft size={18} />
          上一步
        </button>
      </div>
    </div>
  );
}
