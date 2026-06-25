import React, { useMemo } from 'react';
import { Umbrella } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { formatNT, type PayloadOf } from '../_shared';

const LaborPensionView: React.FC<{ payload: PayloadOf<'labor_pension'> }> = ({ payload }) => {
  const { inputs, outputs } = payload;
  const chartData = useMemo(
    () => [
      {
        name: '退休金結構',
        勞保年金: outputs.laborInsMonthly,
        勞退月領: outputs.pensionMonthly,
        財務缺口: outputs.gap,
      },
    ],
    [outputs.laborInsMonthly, outputs.pensionMonthly, outputs.gap],
  );

  const coverageRate = outputs.futureDesiredIncome > 0
    ? Math.round((outputs.totalPension / outputs.futureDesiredIncome) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Sprint 8 E reorder: gap-first.
          Old order placed an oversized hero card + assumptions grid BEFORE the
          gap number, pushing it below the LINE in-app browser fold (~650px).
          New order: gap headline → chart → assumptions → secondary stats →
          action plan. The headline IS the hero now — the giant brand title
          card was vanity, not informational. */}

      {/* 1. Gap headline — biggest number on the page, first impression. */}
      <div className="bg-gradient-to-br from-rose-50 to-rose-100 border border-rose-200 rounded-2xl p-6 text-center relative overflow-hidden">
        <div className="absolute top-2 right-3 opacity-10 pointer-events-none">
          <Umbrella size={80} />
        </div>
        <div className="relative">
          <div className="text-xs font-bold text-rose-700 tracking-wider uppercase mb-1">Retirement Gap</div>
          <div className="text-sm font-bold text-rose-800 mb-1">退休後每月缺口（通膨調整後）</div>
          <div className="text-5xl md:text-6xl font-black text-rose-600 font-mono leading-none">
            {formatNT(outputs.gap)}
          </div>
          <div className="text-[11px] text-rose-500 mt-3">
            {inputs.retireAge} 歲時，理想月生活費將達{' '}
            <span className="font-bold underline">{formatNT(outputs.futureDesiredIncome)}</span>
          </div>
        </div>
      </div>

      {/* 2. Chart — recharts already in shared bundle (other tools use it).
          Same stacked-bar shape advisors see, so a client who saw the tool
          in person recognises the picture. */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">退休所得結構</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={false} axisLine={false} />
              <YAxis unit="元" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => formatNT(value)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine
                y={outputs.futureDesiredIncome}
                stroke="#e11d48"
                strokeDasharray="3 3"
                label={{ position: 'right', value: '真實需求', fill: '#e11d48', fontSize: 11, fontWeight: 'bold' }}
              />
              <Bar dataKey="財務缺口" stackId="a" fill="#f43f5e" barSize={80} name="缺口" radius={[4, 4, 0, 0]} />
              <Bar dataKey="勞退月領" stackId="a" fill={inputs.selfContribution ? '#10b981' : '#3b82f6'} barSize={100} name="勞退月領" />
              <Bar dataKey="勞保年金" stackId="a" fill="#94a3b8" barSize={120} name="勞保年金（折算後）" radius={[0, 0, 4, 4]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Assumptions — sunk below the chart (was above pre-Sprint 8 E).
          Transparency > mystique: client must still be able to flag wrong
          numbers ("我的薪水沒這麼高啊"), but they don't need to read 8 rows
          BEFORE they see the gap. Muted card style signals "supporting
          context", not "headline material". */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">試算假設</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">目前年齡</div>
            <div className="font-bold text-slate-800">{inputs.currentAge} 歲</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">預計退休</div>
            <div className="font-bold text-slate-800">{inputs.retireAge} 歲</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">目前月薪</div>
            <div className="font-bold text-slate-800">{formatNT(inputs.salary)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">理想退休月薪</div>
            <div className="font-bold text-slate-800">{formatNT(inputs.desiredMonthlyIncome)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">勞保年資</div>
            <div className="font-bold text-slate-800">{inputs.laborInsYears} 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">通膨假設</div>
            <div className="font-bold text-slate-800">{inputs.inflationRate}% / 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">勞保給付</div>
            <div className="font-bold text-slate-800">折算為 {inputs.pensionDiscount}%</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">勞退自提</div>
            <div className="font-bold text-slate-800">{inputs.selfContribution ? '6% 自提' : '未自提'}</div>
          </div>
        </div>
      </div>

      {/* 4. Coverage stats — small + factual. */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">政府給付總和</div>
          <div className="text-xl font-bold text-slate-800 font-mono">
            {formatNT(outputs.totalPension)}
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">所得替代率</div>
          <div className="text-xl font-bold text-blue-600 font-mono">{coverageRate}%</div>
        </div>
      </div>

      {/* Action plan — how much/month to close the gap. No product names,
          no insurance pitches. Just the math. */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">補足缺口需每月投入</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <div className="text-xs text-emerald-700 font-bold mb-1">現在開始</div>
            <div className="text-lg font-bold text-emerald-700 font-mono">
              {formatNT(outputs.monthlySaveNow)}
            </div>
            <div className="text-[11px] text-emerald-600/80 mt-1">
              {outputs.yearsToRetire} 年複利
            </div>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
            <div className="text-xs text-rose-700 font-bold mb-1">拖延 10 年</div>
            <div className="text-lg font-bold text-rose-700 font-mono">
              {formatNT(outputs.monthlySaveLater)}
            </div>
            <div className="text-[11px] text-rose-600/80 mt-1">
              {Math.max(0, outputs.yearsToRetire - 10)} 年複利
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaborPensionView;
