import React, { useMemo } from 'react';
import { Building2 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { formatNT, type PayloadOf } from '../_shared';

const FinancialRealEstateView: React.FC<{ payload: PayloadOf<'financial_real_estate'> }> = ({ payload }) => {
  const { inputs, outputs } = payload;

  // 3 scenarios (low/mid/high) 總財富 bar chart
  const chartData = useMemo(() => {
    return [
      { scenario: '保守', 總財富: outputs.scenarios.low.totalWealth, 月現金流: outputs.scenarios.low.netCashFlow, fill: '#94a3b8' },
      { scenario: '中性', 總財富: outputs.scenarios.mid.totalWealth, 月現金流: outputs.scenarios.mid.netCashFlow, fill: '#f59e0b' },
      { scenario: '樂觀', 總財富: outputs.scenarios.high.totalWealth, 月現金流: outputs.scenarios.high.netCashFlow, fill: '#10b981' },
    ];
  }, [outputs.scenarios]);

  const cashFlowPositive = outputs.isPositiveCashFlow;

  return (
    <div className="space-y-5">
      <div className={`${cashFlowPositive ? 'bg-gradient-to-br from-amber-50 to-emerald-50 border-amber-200' : 'bg-gradient-to-br from-amber-50 to-sky-50 border-amber-200'} border rounded-2xl p-6 text-center relative overflow-hidden`}>
        <div className="absolute top-2 right-3 opacity-10 pointer-events-none">
          <Building2 size={80} />
        </div>
        <div className="relative">
          <div className="text-xs font-bold text-amber-700 tracking-wider uppercase mb-1">Financial Real Estate</div>
          <div className="text-sm font-bold text-amber-800 mb-1">每月淨現金流</div>
          <div className={`text-5xl md:text-6xl font-black font-mono leading-none ${cashFlowPositive ? 'text-emerald-600' : 'text-sky-600'}`}>
            {cashFlowPositive ? '+' : ''}{formatNT(Math.round(outputs.netCashFlow))}
          </div>
          <div className="text-[11px] text-amber-600/80 mt-3">
            {cashFlowPositive ? '正現金流' : '需補貼'} · 利差{' '}
            <span className="font-bold underline">{outputs.rateSpread.toFixed(2)}%</span>
            {' '}· 槓桿 <span className="font-bold underline">{outputs.leverageRatio.toFixed(1)}x</span>
          </div>
          <div className="text-[10px] mt-2 text-slate-500 italic">
            ※ 此為基於使用者假設參數之情境模擬，非保證收益，實際結果可能因市場波動而異。
          </div>
          {/* Sprint 11 Stream 1.3 — compliance critic P1: 借款投資槓桿風險警語
              金管會「保險業務員管理規則 §15」+ 證券交易法 §155 — 涉槓桿
              的試算必須揭露本金損失/超出原始投資的風險。原 italic 仍保留
              （情境模擬通用）、再加一條紅字、覆蓋槓桿特有風險。 */}
          <div className="text-[10px] mt-1 text-rose-600/80 italic font-medium">
            ※ 借款投資具槓桿風險，可能本金損失甚至超出原始投資。
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">三種報酬情境之總財富</h3>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="scenario" tick={{ fontSize: 12, fill: '#475569' }} />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(v) => `${Math.round(v / 10000)}萬`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => formatNT(value)}
              />
              <Bar dataKey="總財富" barSize={60} radius={[6, 6, 0, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">試算假設</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">方案類型</div>
            <div className="font-bold text-slate-800">
              {inputs.planMode === 'newLoan' ? '新增貸款' : inputs.planMode === 'refinance' ? '增貸轉投' : '單純試算'}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">貸款金額</div>
            <div className="font-bold text-slate-800">{inputs.loanAmount} 萬</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">貸款年期</div>
            <div className="font-bold text-slate-800">{inputs.loanTerm} 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">貸款利率</div>
            <div className="font-bold text-slate-800">{inputs.loanRate}% / 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">投資報酬率</div>
            <div className="font-bold text-slate-800">{inputs.investReturnRate}% / 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">既有貸款餘額</div>
            <div className="font-bold text-slate-800">{inputs.existingLoanBalance} 萬</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">既有月付</div>
            <div className="font-bold text-slate-800">{formatNT(inputs.existingMonthlyPayment)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">損益平衡率</div>
            <div className="font-bold text-slate-800">{outputs.breakEvenRate.toFixed(2)}%</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">月貸款支出</div>
          <div className="text-lg font-bold text-slate-800 font-mono">{formatNT(Math.round(outputs.monthlyPayment))}</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">月投資收入</div>
          <div className="text-lg font-bold text-emerald-700 font-mono">{formatNT(Math.round(outputs.monthlyIncome))}</div>
        </div>
      </div>
    </div>
  );
};

export default FinancialRealEstateView;
