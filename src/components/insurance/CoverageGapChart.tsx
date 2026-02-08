/**
 * 保障缺口圖表（雷達圖 + 長條圖）
 */
import React, { useMemo } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { MergedCoverage, CoverageGap } from '../../types/insurance';

interface CoverageGapChartProps {
  merged: MergedCoverage;
  gaps: CoverageGap[];
  annualIncome: number;
}

const COVERAGE_LABELS: Record<string, string> = {
  death: '壽險',
  accidentDeath: '意外',
  criticalIllness: '重疾',
  cancer: '癌症',
  hospitalDailyIllness: '住院日額',
  medicalExpense: '實支實付',
  disability: '失能',
  longTermCare: '長照',
};

const BENCHMARKS: Record<string, (income: number) => number> = {
  death: (inc) => inc * 10,
  accidentDeath: (inc) => inc * 10,
  criticalIllness: (inc) => inc * 5,
  cancer: (inc) => inc * 3,
  hospitalDailyIllness: () => 3000,     // 每日
  medicalExpense: () => 300000,         // 單次限額
  disability: (inc) => Math.round(inc / 12 * 200),
  longTermCare: () => 480000,           // 年
};

export default function CoverageGapChart({ merged, gaps, annualIncome }: CoverageGapChartProps) {
  // 雷達圖資料
  const radarData = useMemo(() => {
    return Object.entries(COVERAGE_LABELS).map(([key, label]) => {
      const current = merged.totalCoverage[key as keyof typeof merged.totalCoverage] || 0;
      const benchmarkFn = BENCHMARKS[key];
      const recommended = benchmarkFn ? benchmarkFn(annualIncome) : 1;
      const ratio = recommended > 0 ? Math.min(150, (current / recommended) * 100) : 100;

      return {
        subject: label,
        coverage: Math.round(ratio),
        fullMark: 150,
      };
    });
  }, [merged, annualIncome]);

  // 長條圖資料
  const barData = useMemo(() => {
    return Object.entries(COVERAGE_LABELS).map(([key, label]) => {
      const current = merged.totalCoverage[key as keyof typeof merged.totalCoverage] || 0;
      const benchmarkFn = BENCHMARKS[key];
      const recommended = benchmarkFn ? benchmarkFn(annualIncome) : 0;

      return {
        name: label,
        current: current / 10000,
        recommended: recommended / 10000,
        gap: Math.max(0, (recommended - current)) / 10000,
      };
    });
  }, [merged, annualIncome]);

  return (
    <div className="space-y-6">
      {/* 雷達圖 */}
      <div>
        <h4 className="text-sm font-medium text-slate-700 mb-3">保障覆蓋率（%）</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fontSize: 11, fill: '#64748b' }}
              />
              <PolarRadiusAxis angle={90} domain={[0, 150]} tick={false} />
              <Radar
                name="保障覆蓋率"
                dataKey="coverage"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
          <span>80% 以上 = 充足</span>
          <span>50~79% = 需加強</span>
          <span>50% 以下 = 嚴重不足</span>
        </div>
      </div>

      {/* 缺口長條圖 */}
      <div>
        <h4 className="text-sm font-medium text-slate-700 mb-3">保障金額 vs 建議（萬元）</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ left: 60 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
              <Tooltip
                formatter={(value: number) => `${value.toFixed(0)} 萬`}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="current" name="目前保障" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="gap" name="缺口" stackId="a" fill="#fbbf24" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 缺口列表 */}
      {gaps.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-3">缺口分析</h4>
          <div className="space-y-2">
            {gaps.map((gap, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border-l-4 ${
                  gap.severity === 'critical'
                    ? 'bg-red-50 border-red-400'
                    : gap.severity === 'warning'
                      ? 'bg-amber-50 border-amber-400'
                      : 'bg-blue-50 border-blue-400'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold ${
                    gap.severity === 'critical' ? 'text-red-600' :
                    gap.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'
                  }`}>
                    {gap.severity === 'critical' ? '急需補強' :
                     gap.severity === 'warning' ? '建議加強' : '提醒'}
                  </span>
                  <span className="text-xs text-slate-500">{gap.category}</span>
                </div>
                <p className="text-sm text-slate-700">{gap.description}</p>
                <p className="text-xs text-slate-500 mt-1">{gap.recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
