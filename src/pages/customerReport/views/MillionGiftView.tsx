import React, { useMemo } from 'react';
import { Gift } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { formatWan, type PayloadOf } from '../_shared';

const MillionGiftView: React.FC<{ payload: PayloadOf<'million_gift'> }> = ({ payload }) => {
  const { inputs, outputs } = payload;

  // Three-phase summary bars. We don't replicate the year-by-year curve
  // from the advisor view (would need 21 data points × multiple series →
  // payload bloat). The 3 phase totals communicate the same shape.
  const chartData = useMemo(
    () => [
      {
        phase: `T0-T${inputs.loanTerm}`,
        持有資產: outputs.phase1_Asset,
        累積實付: outputs.totalCashOut_T0_T7_Wan,
      },
      {
        phase: `T${inputs.loanTerm}-T${inputs.loanTerm * 2}`,
        持有資產: outputs.phase2_Asset,
        累積實付:
          outputs.totalCashOut_T0_T7_Wan + outputs.totalCashOut_T7_T14_Wan,
      },
      {
        phase: `T${inputs.loanTerm * 2}-T${inputs.loanTerm * 3}`,
        持有資產: outputs.phase3_Asset,
        累積實付:
          outputs.totalCashOut_T0_T7_Wan +
          outputs.totalCashOut_T7_T14_Wan +
          outputs.totalCashOut_T14_T21_Wan,
      },
    ],
    [
      inputs.loanTerm,
      outputs.phase1_Asset,
      outputs.phase2_Asset,
      outputs.phase3_Asset,
      outputs.totalCashOut_T0_T7_Wan,
      outputs.totalCashOut_T7_T14_Wan,
      outputs.totalCashOut_T14_T21_Wan,
    ],
  );

  // Profit sign drives colour: positive → emerald, negative → rose.
  // Tool can yield negative net profit if interest > return (rare but real).
  const profitPositive = outputs.netProfit_Wan >= 0;

  return (
    <div className="space-y-5">
      {/* Sprint 8 E reorder: headline-first, assumptions sink.
          Spec asks emerald accent — matches positive-profit semantic. If
          netProfit is negative the headline goes rose (sign-aware) and the
          emerald brand chip becomes a brand-only signifier, no spin. */}

      {/* 1. Headline — net profit sign-aware colour. */}
      <div
        className={`${
          profitPositive
            ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'
            : 'bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200'
        } border rounded-2xl p-6 text-center relative overflow-hidden`}
      >
        <div className="absolute top-2 right-3 opacity-10 pointer-events-none">
          <Gift size={80} />
        </div>
        <div className="relative">
          <div className={`text-xs font-bold tracking-wider uppercase mb-1 ${
            profitPositive ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            Leveraged Wealth
          </div>
          <div className={`text-sm font-bold mb-1 ${
            profitPositive ? 'text-emerald-800' : 'text-rose-800'
          }`}>
            {inputs.loanTerm * 3} 年情境模擬：資產與實付差額
          </div>
          <div className={`text-5xl md:text-6xl font-black font-mono leading-none ${
            profitPositive ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            {formatWan(outputs.netProfit_Wan)}
          </div>
          <div className={`text-[11px] mt-3 ${profitPositive ? 'text-emerald-600/80' : 'text-rose-500'}`}>
            總實付 <span className="font-bold underline">{formatWan(outputs.totalProjectCost_Wan)}</span>
            {' '}• 最終資產{' '}
            <span className="font-bold underline">{formatWan(outputs.phase3_Asset)}</span>
          </div>
          {/* 為什麼這行 inline 不能省：金管會「保險業務員管理規則 §15」禁以預期報酬招攬；
              DisclaimerFooter 在頁尾、客戶 LINE in-app 多半不會滾到底、必須在 hero 內 */}
          <div className="text-[10px] mt-2 text-slate-500 italic">
            ※ 此為基於使用者假設參數之情境模擬，非保證收益，實際結果可能因市場波動而異。
          </div>
        </div>
      </div>

      {/* 2. Phase comparison */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">三循環資產 vs 累積實付</h3>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="phase" tick={{ fontSize: 11, fill: '#475569' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="萬" axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => formatWan(value)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="持有資產" fill="#6366f1" radius={[6, 6, 0, 0]} />
              <Bar dataKey="累積實付" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Assumptions — sunk below chart (Sprint 8 E reorder). */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">試算假設</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">首期金額</div>
            <div className="font-bold text-slate-800">{formatWan(inputs.loanAmount)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">每循環年期</div>
            <div className="font-bold text-slate-800">{inputs.loanTerm} 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">借貸利率</div>
            <div className="font-bold text-slate-800">{inputs.loanRate}% / 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">投資報酬率</div>
            <div className="font-bold text-slate-800">{inputs.investReturnRate}% / 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">利差</div>
            <div className="font-bold text-slate-800">{outputs.rateSpread.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">複利模式</div>
            <div className="font-bold text-slate-800">{inputs.isCompoundMode ? '啟用' : '未啟用'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">平均月實付</div>
            <div className="font-bold text-slate-800">{formatWan(outputs.avgMonthlyNetPay / 10000)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">總計畫年期</div>
            <div className="font-bold text-slate-800">{inputs.loanTerm * 3} 年</div>
          </div>
        </div>
      </div>

      {/* 4. Secondary stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">資產倍數</div>
          <div className="text-xl font-bold text-indigo-600 font-mono">
            {outputs.assetMultiplier}×
          </div>
          <div className="text-[11px] text-slate-400 mt-1">最終資產 / 總實付</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">效率倍數</div>
          <div className="text-xl font-bold text-blue-600 font-mono">
            {outputs.efficiencyMultiplier}×
          </div>
          <div className="text-[11px] text-slate-400 mt-1">相對一般存款效率</div>
        </div>
      </div>
    </div>
  );
};

export default MillionGiftView;
