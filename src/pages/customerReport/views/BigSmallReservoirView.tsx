import React, { useMemo } from 'react';
import { Waves } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { formatWan, type PayloadOf } from '../_shared';

const BigSmallReservoirView: React.FC<{ payload: PayloadOf<'big_small_reservoir'> }> = ({ payload }) => {
  const { inputs, outputs } = payload;

  // Growth curve approximation from payload alone.
  //
  // Why we recompute curve here (vs. shipping points in the payload):
  //   - We'd need N+1 data points per year → blows past the URL length
  //     budget (~2KB ceiling we set in customerReport.ts header).
  //   - Math is deterministic given the same inputs, so the curve drawn
  //     here matches the advisor-side curve to the cent.
  //   - useMemo so we don't recompute on every re-render of the parent.
  const chartData = useMemo(() => {
    const initial = inputs.initialCapital;
    const reinvest = outputs.actualReinvest / 100;
    const dividend = outputs.actualDividend / 100;
    const arr: Array<{ year: number; 大水庫: number; 小水庫: number; 總資產: number }> = [];
    let small = 0;
    for (let year = 0; year <= inputs.years; year++) {
      arr.push({
        year,
        大水庫: initial,
        小水庫: Math.round(small),
        總資產: Math.round(initial + small),
      });
      // Same ordinary-annuity sequencing as the source tool (see Sprint 1-2 fix).
      small = small * (1 + reinvest) + initial * dividend;
    }
    return arr;
  }, [inputs.initialCapital, inputs.years, outputs.actualReinvest, outputs.actualDividend]);

  return (
    <div className="space-y-5">
      {/* Sprint 8 E reorder: headline-first, assumptions sink (matches LaborPension).
          Spec requires cyan accent for BigSmall renderer. We pick "{N} 年後總資產"
          as the headline metric — task spec mentions "機會成本" but the positive
          framing "total asset grown" is the more compelling first-screen number
          for this tool (matches advisor-side hero in BigSmallReservoirTool).
          Opportunity cost stays as a secondary stat further down. */}

      {/* 1. Headline — total asset at end of horizon, cyan accent. */}
      <div className="bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200 rounded-2xl p-6 text-center relative overflow-hidden">
        <div className="absolute top-2 right-3 opacity-10 pointer-events-none">
          <Waves size={80} />
        </div>
        <div className="relative">
          <div className="text-xs font-bold text-cyan-700 tracking-wider uppercase mb-1">Asset Allocation</div>
          <div className="text-sm font-bold text-cyan-800 mb-1">{inputs.years} 年後總資產</div>
          <div className="text-5xl md:text-6xl font-black text-cyan-600 font-mono leading-none">
            {formatWan(outputs.totalAsset)}
          </div>
          <div className="text-[11px] text-cyan-600/80 mt-3">
            相較本金 <span className="font-bold">{formatWan(inputs.initialCapital)}</span> 成長{' '}
            <span className="font-bold">{outputs.opportunityCostRate}%</span>
          </div>
        </div>
      </div>

      {/* 2. Growth chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">資產成長路徑</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} unit="年" />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="萬" axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => formatWan(value)}
                labelFormatter={(label) => `第 ${label} 年`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="總資產" fill="#10b981" stroke="#10b981" fillOpacity={0.15} />
              <Line type="monotone" dataKey="大水庫" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="小水庫" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Assumptions — sunk below chart (Sprint 8 E reorder). */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">試算假設</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">本金規模</div>
            <div className="font-bold text-slate-800">{formatWan(inputs.initialCapital)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">投資年期</div>
            <div className="font-bold text-slate-800">{inputs.years} 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">大水庫配息率</div>
            <div className="font-bold text-slate-800">{outputs.actualDividend}% / 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">小水庫成長率</div>
            <div className="font-bold text-slate-800">{outputs.actualReinvest}% / 年</div>
          </div>
        </div>
      </div>

      {/* 4. Secondary stats: time cost. */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">機會成本</div>
          <div className="text-xl font-bold text-rose-600 font-mono">
            {formatWan(outputs.opportunityCost)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">花掉配息所放棄的未來財富</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">小水庫累積</div>
          <div className="text-xl font-bold text-amber-600 font-mono">
            {formatWan(outputs.smallReservoir)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">複利再投入累積</div>
        </div>
      </div>

      {outputs.doubleYear !== null && outputs.doubleYear !== undefined && outputs.doubleYear <= inputs.years && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <div className="text-xs text-amber-700 font-bold mb-1">小水庫翻倍時點</div>
          <div className="text-lg font-bold text-amber-700">第 {outputs.doubleYear} 年達成</div>
        </div>
      )}

      {/* Delay cost — frames "start now" without sales language. */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">延後開始的時間成本</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
            <div className="text-xs text-rose-700 font-bold mb-1">延後 5 年</div>
            <div className="text-lg font-bold text-rose-700 font-mono">
              -{formatWan(outputs.timeCost5)}
            </div>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
            <div className="text-xs text-rose-700 font-bold mb-1">延後 10 年</div>
            <div className="text-lg font-bold text-rose-700 font-mono">
              -{formatWan(outputs.timeCost10)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BigSmallReservoirView;
