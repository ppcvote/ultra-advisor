import React, { useMemo } from 'react';
import { GraduationCap } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { formatNT, formatWan, type PayloadOf } from '../_shared';

const StudentLoanView: React.FC<{ payload: PayloadOf<'student_loan'> }> = ({ payload }) => {
  const { inputs, outputs } = payload;

  // 4 phase: 在學/寬限/只繳息/本息攤還。bar chart 顯示各期月付金 (元)
  // 期滿淨資產 (萬) 在 hero、避免 axis 混單位
  const chartData = useMemo(() => {
    return [
      { phase: '在學', 月付金: 0, 期長: outputs.studyYears },
      { phase: '寬限', 月付金: 0, 期長: Math.max(0, outputs.graceEndYear - outputs.studyYears) },
      { phase: '只繳息', 月付金: Math.round(outputs.monthlyInterest), 期長: Math.max(0, outputs.interestOnlyEndYear - outputs.graceEndYear) },
      { phase: '本息攤還', 月付金: Math.round(outputs.monthlyPMT), 期長: Math.max(0, outputs.repaymentEndYear - outputs.interestOnlyEndYear) },
    ];
  }, [outputs.studyYears, outputs.graceEndYear, outputs.interestOnlyEndYear, outputs.repaymentEndYear, outputs.monthlyInterest, outputs.monthlyPMT]);

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-emerald-50 to-sky-50 border border-emerald-200 rounded-2xl p-6 text-center relative overflow-hidden">
        <div className="absolute top-2 right-3 opacity-10 pointer-events-none">
          <GraduationCap size={80} />
        </div>
        <div className="relative">
          <div className="text-xs font-bold text-emerald-700 tracking-wider uppercase mb-1">Student Loan Plan</div>
          <div className="text-sm font-bold text-emerald-800 mb-1">{outputs.totalDuration} 年後期滿淨資產</div>
          <div className="text-5xl md:text-6xl font-black text-emerald-600 font-mono leading-none">
            {formatWan(outputs.finalAsset)}
          </div>
          <div className="text-[11px] text-emerald-600/80 mt-3">
            學貸覆蓋率 <span className="font-bold underline">{(outputs.coverageRatio * 100).toFixed(0)}%</span>
            {' '}· 利率 1.775% 政府方案
          </div>
          <div className="text-[10px] mt-2 text-slate-500 italic">
            ※ 此為基於使用者假設參數之情境模擬，非保證收益，實際結果可能因市場波動而異。
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">4 段期間月付金</h3>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="phase" tick={{ fontSize: 12, fill: '#475569' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="元" axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => formatNT(value)}
              />
              <Bar dataKey="月付金" fill="#10b981" radius={[6, 6, 0, 0]} barSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">試算假設</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">貸款金額</div>
            <div className="font-bold text-slate-800">{inputs.loanAmount} 萬</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">投資報酬率</div>
            <div className="font-bold text-slate-800">{inputs.investReturnRate}% / 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">就學期</div>
            <div className="font-bold text-slate-800">{inputs.semesters} 學期</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">寬限期</div>
            <div className="font-bold text-slate-800">{inputs.gracePeriod} 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">只繳息期</div>
            <div className="font-bold text-slate-800">{inputs.interestOnlyPeriod} 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">弱勢身分</div>
            <div className="font-bold text-slate-800">{inputs.isQualified ? '是 (免息)' : '一般'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">學貸利率</div>
            <div className="font-bold text-slate-800">1.775%</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">總期長</div>
            <div className="font-bold text-slate-800">{outputs.totalDuration} 年</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">只繳息期月付</div>
          <div className="text-lg font-bold text-slate-800 font-mono">{formatNT(Math.round(outputs.monthlyInterest))}</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">攤還期月付</div>
          <div className="text-lg font-bold text-slate-800 font-mono">{formatNT(Math.round(outputs.monthlyPMT))}</div>
        </div>
      </div>
    </div>
  );
};

export default StudentLoanView;
