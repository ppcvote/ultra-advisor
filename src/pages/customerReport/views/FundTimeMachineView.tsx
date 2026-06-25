import React, { useMemo } from 'react';
import { LineChart as LineChartIcon } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { formatNT, type PayloadOf } from '../_shared';

const FundTimeMachineView: React.FC<{ payload: PayloadOf<'fund_time_machine'> }> = ({ payload }) => {
  const { inputs, outputs } = payload;
  const isGrowth = outputs.fundType === 'growth';

  // 重算成長曲線（理由同 BigSmallReservoirView）：URL 預算 ≤ 2KB、20+ 年逐月點
  // 塞進 payload 會爆；given totalPrincipal + totalReturn + years 直接做線性近似。
  // 完整 NAV 重建需要 fund history（在 advisor-side 是 data/fundData.ts），客戶頁
  // 不該 import 那份 ~MB 級數據。簡化線：本金線（直線）vs 總資產線（CAGR 複利曲線）。
  const chartData = useMemo(() => {
    const yearsTotal = Math.max(1, outputs.years);
    const principal = outputs.totalPrincipal;
    const final = principal + outputs.totalReturn; // totalReturn 是「相對本金的增值絕對額」(growth) 或同 (income)
    // 用 CAGR 重建年度資產：principal * (1 + cagr/100)^year
    // cagr 已 .toFixed 過、會有微小漂移但客戶看的是趨勢、不是逐分錢
    const r = outputs.cagr / 100;
    const arr: Array<{ year: number; 本金: number; 總資產: number }> = [];
    for (let y = 0; y <= yearsTotal; y++) {
      const totalAtY =
        inputs.mode === 'lump'
          ? principal * Math.pow(1 + r, y)
          : // DCA：本金線性累積、總資產用 future value of annuity 近似
            principal * (y / yearsTotal);
      const totalAsset =
        inputs.mode === 'lump'
          ? Math.round(principal * Math.pow(1 + r, y))
          : // 簡化 — y=0 起 principal=0、y=yearsTotal 對齊 final
            Math.round((final * y) / yearsTotal);
      arr.push({
        year: y,
        本金: Math.round(totalAtY < principal ? totalAtY : principal),
        總資產: totalAsset,
      });
    }
    // 確保最後一點與 outputs 對齊（消除 toFixed 漂移）
    if (arr.length > 0) {
      arr[arr.length - 1] = { year: yearsTotal, 本金: principal, 總資產: final };
    }
    return arr;
  }, [inputs.mode, outputs.years, outputs.totalPrincipal, outputs.totalReturn, outputs.cagr]);

  // Hero metric 分支：growth → 總資產，income → 累積配息
  const heroValue = isGrowth ? outputs.totalPrincipal + outputs.totalReturn : outputs.cumulativeDividends;
  const heroLabel = isGrowth ? `${outputs.years} 年後總資產` : `${outputs.years} 年累積配息`;

  const accent = isGrowth
    ? { from: 'from-sky-50', to: 'to-blue-50', border: 'border-sky-200', chip: 'text-sky-700', heading: 'text-sky-800', value: 'text-sky-600', muted: 'text-sky-600/80', stroke: '#0ea5e9' }
    : { from: 'from-emerald-50', to: 'to-teal-50', border: 'border-emerald-200', chip: 'text-emerald-700', heading: 'text-emerald-800', value: 'text-emerald-600', muted: 'text-emerald-600/80', stroke: '#10b981' };

  return (
    <div className="space-y-5">
      <div className={`bg-gradient-to-br ${accent.from} ${accent.to} ${accent.border} border rounded-2xl p-6 text-center relative overflow-hidden`}>
        <div className="absolute top-2 right-3 opacity-10 pointer-events-none">
          <LineChartIcon size={80} />
        </div>
        <div className="relative">
          <div className={`text-xs font-bold ${accent.chip} tracking-wider uppercase mb-1`}>Fund Time Machine</div>
          <div className={`text-sm font-bold ${accent.heading} mb-1`}>{heroLabel}</div>
          <div className={`text-5xl md:text-6xl font-black ${accent.value} font-mono leading-none`}>
            {formatNT(heroValue)}
          </div>
          <div className={`text-[11px] ${accent.muted} mt-3`}>
            {outputs.fundName} · {isGrowth ? `年化 ${outputs.cagr.toFixed(1)}%` : `平均月配息 ${formatNT(Math.round(outputs.avgMonthlyDividend))}`}
          </div>
          {/* 投資類紅線詞 inline disclaimer */}
          <div className="text-[10px] mt-2 text-slate-500 italic">
            ※ 此為基於歷史回測之情境模擬，非保證收益，過去績效不代表未來表現。
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">資產成長曲線</h3>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
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
              <Line type="monotone" dataKey="本金" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              <Line type="monotone" dataKey="總資產" stroke={accent.stroke} strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">試算假設</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">基金類型</div>
            <div className="font-bold text-slate-800">{isGrowth ? '⚡ 成長型' : '💰 配息型'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">投入方式</div>
            <div className="font-bold text-slate-800">{inputs.mode === 'lump' ? '單筆投入' : '定期定額'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">{inputs.mode === 'lump' ? '投入金額' : '月扣金額'}</div>
            <div className="font-bold text-slate-800">
              {inputs.mode === 'lump' ? `${inputs.amount} 萬` : formatNT(inputs.monthlyAmount)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">回測年數</div>
            <div className="font-bold text-slate-800">{outputs.years} 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">成立日</div>
            <div className="font-bold text-slate-800">{outputs.inceptionDate}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">累積本金</div>
            <div className="font-bold text-slate-800">{formatNT(outputs.totalPrincipal)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">年化 (CAGR)</div>
            <div className="font-bold text-slate-800">{outputs.cagr.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">歷史最大回撤</div>
            <div className="font-bold text-slate-800">-{outputs.maxDrawdown.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">資產倍數</div>
          <div className="text-xl font-bold text-slate-800 font-mono">{outputs.growthMultiplier.toFixed(2)}×</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">累積報酬率</div>
          <div className={`text-xl font-bold font-mono ${outputs.totalReturnRate >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {outputs.totalReturnRate >= 0 ? '+' : ''}{outputs.totalReturnRate.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default FundTimeMachineView;
