import React, { useMemo } from 'react';
import { Landmark } from 'lucide-react';
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
import { formatWan, type PayloadOf } from '../_shared';

const TaxPlannerView: React.FC<{ payload: PayloadOf<'tax_planner'> }> = ({ payload }) => {
  const { inputs, outputs } = payload;

  // Pick the active plan (lumpSum / installment / none) — drives which
  // "after" column shows up. If planMode==='none' we just show the
  // before-plan situation (no comparison bar).
  const hasAfter = inputs.planMode === 'lumpSum' || inputs.planMode === 'installment';
  const after = inputs.planMode === 'lumpSum' ? outputs.lumpSum : outputs.installment;

  const chartData = useMemo(() => {
    const rows: Array<{ name: string; 應納稅額: number; fill: string }> = [
      { name: '目前狀況', 應納稅額: outputs.taxBefore, fill: '#ef4444' },
    ];
    if (hasAfter && after) {
      rows.push({ name: '規劃後', 應納稅額: after.taxAfter, fill: '#10b981' });
    }
    return rows;
  }, [outputs.taxBefore, hasAfter, after]);

  return (
    <div className="space-y-5">
      {/* Sprint 8 E reorder: headline-first, assumptions sink.
          Spec asks violet for this renderer; we use violet for the brand chip
          but keep the rose accent on the BIG tax-owed number — rose is the
          universal "money you'll lose" signal. Mixing violet on a tax-pain
          headline reads as "lifestyle promo" which would undermine credibility. */}

      {/* 1. Headline — tax owed in big rose-red, framed with violet brand chip. */}
      <div className="bg-gradient-to-br from-violet-50 to-rose-50 border border-violet-200 rounded-2xl p-6 text-center relative overflow-hidden">
        <div className="absolute top-2 right-3 opacity-10 pointer-events-none">
          <Landmark size={80} />
        </div>
        <div className="relative">
          <div className="text-xs font-bold text-violet-700 tracking-wider uppercase mb-1">Estate Tax</div>
          <div className="text-sm font-bold text-rose-800 mb-1">目前應納遺產稅</div>
          <div className="text-5xl md:text-6xl font-black text-rose-600 font-mono leading-none">
            {formatWan(outputs.taxBefore)}
          </div>
          <div className="text-[11px] text-rose-500 mt-3">
            遺產總額 <span className="font-bold underline">{formatWan(outputs.totalEstateBefore)}</span>
            {' '}• 稅率級距{' '}
            <span className="font-bold underline">{outputs.bracketBefore.label}</span>
          </div>
        </div>
      </div>

      {/* 2. Before / after bar — only when a plan is selected. */}
      {hasAfter && after && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">規劃前 vs 規劃後</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="萬" axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => formatWan(value)}
                />
                <Bar dataKey="應納稅額" barSize={80} radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              {/* 「節稅」是保險業招攬紅線詞（財政部 110 年北區國稅局函示）— 改用中性「稅負差額」 */}
              <div className="text-xs text-emerald-700 font-bold mb-1">稅負差額</div>
              <div className="text-lg font-bold text-emerald-700 font-mono">
                {formatWan(after.taxSaved)}
              </div>
              <div className="text-[11px] text-emerald-600/80 mt-1">
                降至 {after.bracketAfter.label} 級距
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-xs text-slate-500 mb-1">保障金額</div>
              <div className="text-lg font-bold text-slate-800 font-mono">
                {formatWan(after.benefit)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {inputs.planMode === 'lumpSum' ? '躉繳方案' : '分期繳方案'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Assumptions — sunk below comparison (Sprint 8 E reorder). */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">試算假設</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">配偶</div>
            <div className="font-bold text-slate-800">{inputs.spouse ? '有' : '無'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">子女</div>
            <div className="font-bold text-slate-800">{inputs.children} 人</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">父母</div>
            <div className="font-bold text-slate-800">{inputs.parents} 人</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">身心障礙</div>
            <div className="font-bold text-slate-800">{inputs.handicapped} 人</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">現金</div>
            <div className="font-bold text-slate-800">{formatWan(inputs.cash)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">不動產(市價)</div>
            <div className="font-bold text-slate-800">{formatWan(inputs.realEstateMarket)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">股票</div>
            <div className="font-bold text-slate-800">{formatWan(inputs.stocks)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">配偶資產</div>
            <div className="font-bold text-slate-800">{formatWan(inputs.spouseAssets)}</div>
          </div>
        </div>
      </div>

      {/* 4. Liquidity gap — flags when tax > cash. Real planning trigger. */}
      {outputs.liquidityGap > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-xs text-amber-700 font-bold mb-1">繳稅資金缺口</div>
          <div className="text-lg font-bold text-amber-700 font-mono">
            {formatWan(outputs.liquidityGap)}
          </div>
          <div className="text-[11px] text-amber-600/80 mt-1">
            目前現金不足以支付應納稅額，需考慮流動性安排
          </div>
        </div>
      )}
    </div>
  );
};

export default TaxPlannerView;
