import React, { useMemo } from 'react';
import { Car } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { formatNT, formatWan, type PayloadOf } from '../_shared';

const CarReplacementView: React.FC<{ payload: PayloadOf<'car_replacement'> }> = ({ payload }) => {
  const { inputs, outputs } = payload;

  // 3 cycle 期末資產 + 實質月付折線。Cycle index 從 1 起、x 軸用「第 N 次換車」
  const chartData = useMemo(() => {
    return outputs.cycles.map((c) => ({
      cycle: `第${c.cycle}次`,
      期末資產: c.totalAssetEnd,
      實質月付: Math.round(c.netPay),
    }));
  }, [outputs.cycles]);

  const lastCycle = outputs.cycles[outputs.cycles.length - 1];

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-6 text-center relative overflow-hidden">
        <div className="absolute top-2 right-3 opacity-10 pointer-events-none">
          <Car size={80} />
        </div>
        <div className="relative">
          <div className="text-xs font-bold text-orange-700 tracking-wider uppercase mb-1">Car Cycle Plan</div>
          <div className="text-sm font-bold text-orange-800 mb-1">{outputs.totalProjectYears} 年後資產</div>
          <div className="text-5xl md:text-6xl font-black text-orange-600 font-mono leading-none">
            {formatWan(lastCycle?.totalAssetEnd ?? 0)}
          </div>
          <div className="text-[11px] text-orange-600/80 mt-3">
            最後一台車殘值 <span className="font-bold underline">{formatWan(outputs.lastCarResidual)}</span>
            {' '}· 共 3 次換車循環
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">三循環資產推進</h3>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="cycle" tick={{ fontSize: 12, fill: '#475569' }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: '#64748b' }}
                unit="萬"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: '#64748b' }}
                unit="元"
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number, name: string) =>
                  name === '期末資產' ? formatWan(value) : formatNT(value)
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="期末資產" fill="#f97316" radius={[6, 6, 0, 0]} barSize={50} />
              <Line yAxisId="right" type="monotone" dataKey="實質月付" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">試算假設</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">首台車價</div>
            <div className="font-bold text-slate-800">{inputs.carPrice} 萬</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">第二台</div>
            <div className="font-bold text-slate-800">{inputs.carPrice2} 萬</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">第三台</div>
            <div className="font-bold text-slate-800">{inputs.carPrice3} 萬</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">換車周期</div>
            <div className="font-bold text-slate-800">{inputs.cycleYears} 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">投資報酬率</div>
            <div className="font-bold text-slate-800">{inputs.investReturnRate}% / 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">貸款利率</div>
            <div className="font-bold text-slate-800">{inputs.loanRate}% / 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">貸款年期</div>
            <div className="font-bold text-slate-800">{inputs.loanTerm} 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">殘值率</div>
            <div className="font-bold text-slate-800">{inputs.residualRate}%</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {outputs.cycles.map((c) => (
          <div key={c.cycle} className="bg-slate-50 rounded-xl p-4">
            <div className="text-xs text-slate-500 mb-1">第{c.cycle}台月付</div>
            <div className="text-lg font-bold text-slate-800 font-mono">{formatNT(Math.round(c.monthlyPay))}</div>
            <div className="text-[10px] text-slate-400 mt-1">投資月領 {formatNT(Math.round(c.monthlyIncome))}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CarReplacementView;
