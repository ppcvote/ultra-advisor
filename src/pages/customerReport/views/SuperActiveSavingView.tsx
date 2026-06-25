import React, { useMemo } from 'react';
import { Rocket } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { formatNT, formatWan, type PayloadOf } from '../_shared';

const SuperActiveSavingView: React.FC<{ payload: PayloadOf<'super_active_saving'> }> = ({ payload }) => {
  const { inputs, outputs } = payload;

  // 重算 40-year 對比曲線（active / passive 兩條 line）。
  // 簡化：active = 前 N 年存錢、後 40-N 年只複利不投入；passive = 整 40 年 DCA
  const chartData = useMemo(() => {
    const TOTAL = 40;
    const r = inputs.investReturnRate / 100 / 12;
    const monthly = inputs.monthlySaving;
    const active = inputs.activeYears;

    const arr: Array<{ year: number; 積極組: number; 消極組: number }> = [];
    let activeAsset = 0;
    let passiveAsset = 0;
    for (let y = 0; y <= TOTAL; y++) {
      // year-end snapshot
      arr.push({
        year: y,
        積極組: Math.round(activeAsset),
        消極組: Math.round(passiveAsset),
      });
      // 下一年的累積：12 期 future value of annuity
      for (let m = 0; m < 12; m++) {
        const activeMonthly = y < active ? monthly : 0; // 積極組：active 年後停扣只複利
        activeAsset = activeAsset * (1 + r) + activeMonthly;
        passiveAsset = passiveAsset * (1 + r) + monthly; // 消極組：每月都扣
      }
    }
    return arr;
  }, [inputs.monthlySaving, inputs.investReturnRate, inputs.activeYears]);

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-200 rounded-2xl p-6 text-center relative overflow-hidden">
        <div className="absolute top-2 right-3 opacity-10 pointer-events-none">
          <Rocket size={80} />
        </div>
        <div className="relative">
          <div className="text-xs font-bold text-violet-700 tracking-wider uppercase mb-1">Super Active Saving</div>
          <div className="text-sm font-bold text-violet-800 mb-1">期滿被動月收入</div>
          <div className="text-5xl md:text-6xl font-black text-violet-600 font-mono leading-none">
            {formatNT(Math.round(outputs.monthlyPassiveIncome))}
          </div>
          <div className="text-[11px] text-violet-600/80 mt-3">
            {40 - inputs.activeYears} 年複利自由 · 積極組期末資產 <span className="font-bold underline">{formatWan(outputs.activeWan)}</span>
          </div>
          <div className="text-[10px] mt-2 text-slate-500 italic">
            ※ 此為基於使用者假設參數之情境模擬，非保證收益，實際結果可能因市場波動而異。
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">40 年資產成長對比</h3>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} unit="年" />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(v) => `${Math.round(v / 10000)}萬`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => formatNT(value)}
                labelFormatter={(label) => `第 ${label} 年`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine
                x={inputs.activeYears}
                stroke="#8b5cf6"
                strokeDasharray="3 3"
                label={{ position: 'top', value: '停扣', fill: '#8b5cf6', fontSize: 11 }}
              />
              <Line type="monotone" dataKey="積極組" stroke="#8b5cf6" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="消極組" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">試算假設</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">月扣金額</div>
            <div className="font-bold text-slate-800">{formatNT(inputs.monthlySaving)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">積極期</div>
            <div className="font-bold text-slate-800">{inputs.activeYears} 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">複利期</div>
            <div className="font-bold text-slate-800">{40 - inputs.activeYears} 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">投資報酬率</div>
            <div className="font-bold text-slate-800">{inputs.investReturnRate}% / 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">積極組本金</div>
            <div className="font-bold text-slate-800">{formatWan(outputs.totalPrincipalActive / 10000)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">消極組本金</div>
            <div className="font-bold text-slate-800">{formatWan(outputs.totalPrincipalPassive / 10000)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">本金省下</div>
            <div className="font-bold text-slate-800">{formatWan(outputs.savedPrincipal / 10000)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">總期長</div>
            <div className="font-bold text-slate-800">40 年</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">積極組期末資產</div>
          <div className="text-lg font-bold text-violet-700 font-mono">{formatWan(outputs.activeWan)}</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">消極組期末資產</div>
          <div className="text-lg font-bold text-slate-700 font-mono">{formatWan(outputs.passiveWan)}</div>
        </div>
      </div>
    </div>
  );
};

export default SuperActiveSavingView;
