import React, { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';
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

const GoldenSafeVaultView: React.FC<{ payload: PayloadOf<'golden_safe_vault'> }> = ({ payload }) => {
  const { inputs, outputs } = payload;

  // 5-bar 壓力測試對比：原始預估 → 重大傷病後 → 市場崩盤後 → 稅務後 → 上鎖後
  const chartData = useMemo(() => {
    return [
      { scenario: '預估總資產', 資產: outputs.baseValue, fill: '#f59e0b' },
      { scenario: '重大傷病後', 資產: outputs.medicalAfter, fill: '#fb923c' },
      { scenario: '市場崩盤後', 資產: outputs.marketAfter, fill: '#f87171' },
      { scenario: '稅務後', 資產: outputs.taxAfter, fill: '#fbbf24' },
      { scenario: '上鎖後', 資產: outputs.lockedValue, fill: '#eab308' },
    ];
  }, [outputs.baseValue, outputs.medicalAfter, outputs.marketAfter, outputs.taxAfter, outputs.lockedValue]);

  const lockProtection = outputs.baseValue > 0
    ? ((outputs.lockedValue - Math.min(outputs.medicalAfter, outputs.marketAfter, outputs.taxAfter)) / outputs.baseValue) * 100
    : 0;

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-6 text-center relative overflow-hidden">
        <div className="absolute top-2 right-3 opacity-10 pointer-events-none">
          <ShieldCheck size={80} />
        </div>
        <div className="relative">
          <div className="text-xs font-bold text-amber-700 tracking-wider uppercase mb-1">Golden Safe Vault</div>
          <div className="text-sm font-bold text-amber-800 mb-1">預估總資產 → 上鎖後資產</div>
          <div className="text-3xl md:text-4xl font-black font-mono leading-tight">
            <span className="text-slate-500">{formatNT(outputs.baseValue)}</span>
            <span className="text-amber-700 mx-2">→</span>
            <span className="text-amber-600">{formatNT(outputs.lockedValue)}</span>
          </div>
          <div className="text-[11px] text-amber-600/80 mt-3">
            上鎖後保留 <span className="font-bold underline">90%</span> 預估總資產
            {lockProtection > 0 && (
              <>
                {' '}· 較最壞情境多保留{' '}
                <span className="font-bold underline">{lockProtection.toFixed(0)}%</span>
              </>
            )}
          </div>
          {/* 為什麼這條 inline 不能省：金管會保險業務員管理規則 §15 禁宣稱保障比例 —
              「90%」是工具示意比例（鎖定 10% 試算成本），非任何保險商品實際保障條件 */}
          <div className="text-[10px] mt-2 text-amber-700/70 italic">
            ※ 此 90% 為工具示意比例（鎖定 10% 試算成本），非任何商品實際保障條件，實際應依商品條款為準。
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">五情境壓力測試</h3>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="scenario" tick={{ fontSize: 10, fill: '#475569' }} interval={0} />
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
              <Bar dataKey="資產" barSize={40} radius={[6, 6, 0, 0]}>
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
            <div className="text-xs text-slate-500">模式</div>
            <div className="font-bold text-slate-800">{inputs.mode === 'time' ? '時間累積' : '現有資產'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">{inputs.mode === 'time' ? '投入金額' : '現有資產'}</div>
            <div className="font-bold text-slate-800">{inputs.amount} 萬</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">期間</div>
            <div className="font-bold text-slate-800">{inputs.years} 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">投資報酬率</div>
            <div className="font-bold text-slate-800">{inputs.rate}% / 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">年齡</div>
            <div className="font-bold text-slate-800">{inputs.age} 歲</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">年收入</div>
            <div className="font-bold text-slate-800">{inputs.annualIncome} 萬</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">假設醫療支出</div>
            <div className="font-bold text-slate-800">{inputs.medicalLoss} 萬</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">假設市場跌幅</div>
            <div className="font-bold text-slate-800">{inputs.marketLoss}%</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">投入本金</div>
          <div className="text-lg font-bold text-slate-800 font-mono">{formatNT(outputs.principal)}</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">上鎖差額</div>
          <div className="text-lg font-bold text-amber-700 font-mono">
            -{formatNT(outputs.baseValue - outputs.lockedValue)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoldenSafeVaultView;
