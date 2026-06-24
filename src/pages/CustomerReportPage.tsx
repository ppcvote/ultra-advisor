import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, Gift, Landmark, ShieldCheck, Umbrella, Waves } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import DisclaimerFooter from '../components/DisclaimerFooter';
import {
  CustomerReportPayload,
  decodeCustomerReport,
} from '../lib/customerReport';
import { parseCustomerReportRoute } from '../lib/customerReportRouter';

// Customer-facing read-only report page (Sprint 7 F).
//
// Why we re-render instead of importing LaborPensionTool:
//   - That component is ~600 lines, pulls in ClientDataPanel + ShareButton +
//     Firebase auth. None of that belongs on a public link a non-member opens
//     from LINE. Importing would also negate the lazy chunk + leak the
//     advisor-side UI (chips, hover states, "啟動自提" button that mutates state).
//   - The output payload already contains every number we need. We just draw
//     a chart + 3 stat cards. Re-implementing the chart costs ~30 lines.
//
// Mobile-first: clients open this in LINE in-app browser. Layout collapses
// to a single column under md; chart uses ResponsiveContainer with fixed
// pixel height (300px) so it doesn't go invisible on narrow viewports.

type ViewState =
  | { kind: 'invalid' }
  | { kind: 'unsupported'; rawSlug: string }
  | { kind: 'ok'; payload: CustomerReportPayload };

const formatNT = (n: number) => `$${n.toLocaleString()}`;

const formatGeneratedAt = (epochMs: number): string => {
  try {
    const d = new Date(epochMs);
    if (Number.isNaN(d.getTime())) return '';
    // YYYY/MM/DD — locale-stable, not "X 天前" since clients may view weeks later.
    return d.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return '';
  }
};

// Sprint 8 E: compact AdvisorBar — single row, ≤ 80px total height.
// Why: on a 650px LINE in-app browser viewport, the previous 2-line "您的財務顧問"
// label + name + cert lines + date row was eating ~140px AND pushing the
// gap headline below the fold. Compact = name on left, cert in muted span next
// to it, date timestamp small-right. Removed the "您的財務顧問" prefix label
// (redundant — context makes it obvious whose contact card this is).
const AdvisorBar: React.FC<{ payload: CustomerReportPayload }> = ({ payload }) => {
  const { advisor, generatedAt } = payload;
  const certLine = [advisor.companyName, advisor.licenses].filter(Boolean).join(' · ');
  return (
    <div className="bg-slate-900/70 border border-slate-700/60 rounded-xl px-4 py-2.5 flex items-center gap-3">
      <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-slate-100 font-bold truncate text-sm">{advisor.name || '—'}</span>
        {certLine && (
          <span className="text-[11px] text-slate-400 truncate">{certLine}</span>
        )}
      </div>
      {generatedAt > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono shrink-0">
          <Calendar size={10} />
          {formatGeneratedAt(generatedAt)}
        </div>
      )}
    </div>
  );
};

// Narrowed payload alias — gives the renderer a precise type for its own
// branch of the discriminated union without needing per-branch generics.
type PayloadOf<T extends CustomerReportPayload['tool']> = Extract<
  CustomerReportPayload,
  { tool: T }
>;

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

// ---------------------------------------------------------------------------
// Sprint 8 A: 3 new renderers — Big-Small Reservoir / Tax Planner / Million Gift.
//
// Pattern shared with LaborPensionView (do NOT abstract a base component yet):
//   1. Hero card  — tool-specific colour + headline metric drawn large
//   2. Assumptions card — what the advisor entered (grid 2/4 col)
//   3. Chart card — recharts shape mirroring the advisor-side visualisation
//      so a client who saw the tool in person recognises it
//   4. Secondary stats — 2-col, smaller, supportive numbers only
//
// We intentionally keep each renderer self-contained: the inputs/outputs
// shapes differ enough that a shared <ToolReport> would have to take a config
// object with so many fields it'd be more obscure than just inlining the
// JSX. Re-evaluate if a 5th tool lands with the same hero+chart pattern.
//
// "萬" formatting: BigSmall/Gift work in 萬 units natively; we convert to
// 億 only when ≥ 10,000 萬 for readability (matches advisor-side helper).
// ---------------------------------------------------------------------------

const formatWan = (val: number): string => {
  const abs = Math.abs(Math.round(val));
  if (abs >= 10000) {
    const yi = Math.floor(abs / 10000);
    const wan = abs % 10000;
    return wan > 0 ? `${yi}億${wan.toLocaleString()}萬` : `${yi}億`;
  }
  return `${abs.toLocaleString()}萬`;
};

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

const InvalidView: React.FC = () => (
  <div className="min-h-[60vh] flex items-center justify-center px-5">
    <div className="max-w-sm w-full text-center bg-slate-900/60 border border-slate-700/60 rounded-2xl p-8">
      <AlertCircle className="mx-auto mb-3 text-amber-400" size={36} />
      <h2 className="text-lg font-bold text-slate-100 mb-2">此連結無效或已過期</h2>
      <p className="text-sm text-slate-400 mb-5">
        試算連結可能已被更新或已逾 90 天有效期。請聯絡您的顧問索取最新版本。
      </p>
      <a
        href="/"
        className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-100 text-slate-900 text-sm font-bold hover:bg-white transition-colors"
      >
        前往首頁
      </a>
    </div>
  </div>
);

const UnsupportedView: React.FC<{ slug: string }> = ({ slug }) => (
  <div className="min-h-[60vh] flex items-center justify-center px-5">
    <div className="max-w-sm w-full text-center bg-slate-900/60 border border-slate-700/60 rounded-2xl p-8">
      <AlertCircle className="mx-auto mb-3 text-amber-400" size={36} />
      <h2 className="text-lg font-bold text-slate-100 mb-2">不支援的試算類型</h2>
      <p className="text-sm text-slate-400 mb-5">
        此頁面目前僅支援「退休缺口」試算。
        <br />
        <span className="font-mono text-xs">({slug || '未指定'})</span>
      </p>
      <a
        href="/"
        className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-100 text-slate-900 text-sm font-bold hover:bg-white transition-colors"
      >
        前往首頁
      </a>
    </div>
  </div>
);

interface CustomerReportPageProps {
  // Optional override — useful for tests / Storybook. In production these
  // are read from window.location.
  pathname?: string;
  search?: string;
}

const CustomerReportPage: React.FC<CustomerReportPageProps> = ({ pathname, search }) => {
  // 90-day expiration — 個資法 §27「保有時間應為達成蒐集目的之必要期間」
  // generatedAt 已在 payload 內，無需 schema 變更。
  // 接受顧問拿到 link 後 3 個月內客戶才打開的情境（足夠寬鬆）、超過視為過期。
  const EXPIRY_MS = 90 * 24 * 60 * 60 * 1000;
  const isExpired = (payload: CustomerReportPayload): boolean => {
    if (!payload.generatedAt) return false; // 無時戳 fallback 不 expire
    return Date.now() - payload.generatedAt > EXPIRY_MS;
  };

  // Resolve on every mount; popstate handling lives in App.tsx, which
  // re-mounts this component when the route flag flips, so we don't need
  // our own listener.
  const [view, setView] = useState<ViewState>(() => {
    const path = pathname ?? window.location.pathname;
    const qs = search ?? window.location.search;
    const route = parseCustomerReportRoute(path, qs);
    if (!route) return { kind: 'invalid' };
    if (!route.tool) return { kind: 'unsupported', rawSlug: route.rawSlug };
    const payload = decodeCustomerReport(route.encoded);
    if (!payload) return { kind: 'invalid' };
    if (payload.tool !== route.tool) return { kind: 'invalid' };
    if (isExpired(payload)) return { kind: 'invalid' };
    return { kind: 'ok', payload };
  });

  // 防 Google indexing — payload 含客戶資料、不能進 search cache。
  // 同時 public/robots.txt 也加 Disallow: /r/ 雙重防護。
  //
  // Sprint 8 D: LINE preview card — inject og:* + twitter:* meta so when an
  // advisor pastes the share link into LINE, the chat shows a card (title +
  // description + image) instead of a bare URL. Reality check on crawlability:
  //   - LINE Bot Crawler is server-side fetch — it does NOT execute JS, so
  //     this useEffect won't run for the crawler. The fallback is the static
  //     og:* tags in index.html (Ultra Advisor branded card), which still
  //     yields a usable LINE preview, just not tool-specific.
  //   - This useEffect IS what users (post-click) see in social-share menus
  //     ("Share to..." button) and what some richer link previewers (e.g.
  //     Slack unfurls after user click) pick up.
  //   - Pre-rendering /r/<tool> at build time isn't possible because the
  //     payload arrives via query string (?d=...) — no way to know the tool
  //     before runtime. So index.html static + useEffect dynamic is the best
  //     we can do without server-side rendering.
  //
  // PII rule (Sprint 7 lockdown reaffirmed):
  //   - og:title is generic per-tool ("退休缺口分析" etc.), NEVER includes
  //     the client name, advisor name, or any number from inputs/outputs.
  //   - og:description is a fixed string. No PII can leak into a link preview
  //     that may be forwarded outside the original recipient's view.
  //   - og:image uses the existing generic Ultra Advisor og-image.png — we
  //     deliberately don't generate per-payload OG images (would require
  //     server function + PII risk).
  useEffect(() => {
    // robots noindex (unchanged from Sprint 7)
    const robotsMeta = document.createElement('meta');
    robotsMeta.name = 'robots';
    robotsMeta.content = 'noindex, nofollow, noarchive, nosnippet';
    document.head.appendChild(robotsMeta);

    // Title — also used by browsers as fallback social title
    const prevTitle = document.title;

    // Tool → display name. Map covers all 4 Sprint 8 tools so adding a new
    // tool later only requires extending the discriminated union; this map
    // already routes it. Unknown tool falls back to a generic label rather
    // than crashing or leaking payload internals.
    const TOOL_LABELS: Record<string, string> = {
      labor_pension: '退休缺口分析',
      big_small_reservoir: '大小水庫專案',
      tax_planner: '稅務傳承規劃',
      million_gift: '百萬禮物計畫',
    };
    const toolLabel = view.kind === 'ok'
      ? (TOOL_LABELS[view.payload.tool] ?? 'Ultra Advisor 試算')
      : 'Ultra Advisor';
    const ogTitle = view.kind === 'ok' ? `${toolLabel} · Ultra Advisor` : 'Ultra Advisor';
    const ogDesc = view.kind === 'ok'
      ? '由您的財務顧問使用 Ultra Advisor 產生的試算結果。'
      : 'Ultra Advisor — AI 智能理財分析平台';

    document.title = view.kind === 'ok' ? `${toolLabel} — Ultra Advisor` : 'Ultra Advisor';

    // og:url — drop the ?d=<payload> query string. The payload base64 leaking
    // into a preview-cache canonical URL would partially defeat the noindex
    // (still readable to anyone with the cached page). Strip to pathname only.
    let cleanUrl = '';
    try {
      const u = new URL(window.location.href);
      cleanUrl = `${u.origin}${u.pathname}`;
    } catch { /* ignore — leave blank */ }

    // og-image: reuse existing /og-image.png. Per task note we don't make a
    // new png in this sprint — the generic Ultra Advisor card is acceptable
    // (and avoids per-tool branding drift if we rename tools later).
    const ogImage = `${window.location.origin}/og-image.png`;

    // Build all og + twitter tags as an array so cleanup is a single loop.
    // We use property= for og:* (FB/LINE/most) and name= for twitter:* (X spec).
    type MetaSpec = { key: 'property' | 'name'; value: string; content: string };
    const metaSpecs: MetaSpec[] = [
      { key: 'property', value: 'og:type', content: 'article' },
      { key: 'property', value: 'og:title', content: ogTitle },
      { key: 'property', value: 'og:description', content: ogDesc },
      { key: 'property', value: 'og:image', content: ogImage },
      { key: 'property', value: 'og:url', content: cleanUrl },
      { key: 'property', value: 'og:site_name', content: 'Ultra Advisor' },
      { key: 'name', value: 'twitter:card', content: 'summary_large_image' },
      { key: 'name', value: 'twitter:title', content: ogTitle },
      { key: 'name', value: 'twitter:description', content: ogDesc },
      { key: 'name', value: 'twitter:image', content: ogImage },
    ];
    const injected: HTMLMetaElement[] = metaSpecs.map(spec => {
      const m = document.createElement('meta');
      m.setAttribute(spec.key, spec.value);
      m.setAttribute('content', spec.content);
      // Marker attr so cleanup doesn't accidentally remove the static og:*
      // tags from index.html if our refs were ever lost. (Belt-and-braces;
      // the `injected` array is already the source of truth.)
      m.setAttribute('data-cr-og', '1');
      document.head.appendChild(m);
      return m;
    });

    return () => {
      document.title = prevTitle;
      try { document.head.removeChild(robotsMeta); } catch { /* ignore */ }
      injected.forEach(m => {
        try { document.head.removeChild(m); } catch { /* ignore */ }
      });
    };
  }, [view]);

  // Re-parse if route props change (test path). No-op in production.
  useEffect(() => {
    if (pathname === undefined && search === undefined) return;
    const route = parseCustomerReportRoute(
      pathname ?? window.location.pathname,
      search ?? window.location.search,
    );
    if (!route) return setView({ kind: 'invalid' });
    if (!route.tool) return setView({ kind: 'unsupported', rawSlug: route.rawSlug });
    const payload = decodeCustomerReport(route.encoded);
    if (!payload || payload.tool !== route.tool) return setView({ kind: 'invalid' });
    if (isExpired(payload)) return setView({ kind: 'invalid' });
    setView({ kind: 'ok', payload });
  }, [pathname, search]);

  if (view.kind === 'invalid') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200">
        <InvalidView />
      </div>
    );
  }

  if (view.kind === 'unsupported') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200">
        <UnsupportedView slug={view.rawSlug} />
      </div>
    );
  }

  const { payload } = view;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Print CSS — 60+ 歲客戶常請顧問列印帶回家
          深色 advisorbar 改白底黑字、recharts SVG 保留 */}
      <style>{`
        @media print {
          body { background: white !important; }
          .bg-slate-900, .bg-slate-950, .bg-slate-900\\/70, .bg-slate-800 {
            background: white !important;
            color: black !important;
            border-color: #cbd5e1 !important;
          }
          .text-slate-100, .text-slate-200, .text-slate-300, .text-slate-400 {
            color: black !important;
          }
        }
      `}</style>
      {/* Sprint 8 E: outer padding tightened (py-3 mobile / py-6 desktop, was
          py-6 / py-10) so AdvisorBar + amber notice + Gap headline all fit
          in the first 650px of a LINE in-app browser viewport. */}
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-3 md:py-6 space-y-4">
        <div className="text-slate-200">
          <AdvisorBar payload={payload} />
        </div>

        {/* 防偽溫和提示 — 沒有 server signing 的情況下，page 本身不能宣稱
            「這是被驗證的顧問報告」。誠實揭露「數字由顧問端產生」，
            讓 viewer 知道權威來源是 math + 顧問本人、不是這頁面本身 */}
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-[11px] text-amber-900 leading-relaxed">
          本頁試算結果由顧問端使用 Ultra Advisor 工具產生，數字為顧問依您提供之條件輸入後計算。如需驗證或調整參數，請直接聯絡您的顧問。
        </div>

        {payload.tool === 'labor_pension' && <LaborPensionView payload={payload} />}
        {payload.tool === 'big_small_reservoir' && <BigSmallReservoirView payload={payload} />}
        {payload.tool === 'tax_planner' && <TaxPlannerView payload={payload} />}
        {payload.tool === 'million_gift' && <MillionGiftView payload={payload} />}

        <div className="bg-slate-900 rounded-2xl p-5 md:p-6 text-center">
          <ShieldCheck className="mx-auto mb-2 text-emerald-400" size={28} />
          <h3 className="text-slate-100 font-bold mb-1">想了解如何補足這個缺口？</h3>
          <p className="text-slate-400 text-sm">
            這份試算結果由您的顧問依您的條件產生。
            <br className="hidden sm:block" />
            如需進一步討論調整策略，請直接回覆顧問訊息。
          </p>
        </div>

        <div className="text-slate-300">
          <DisclaimerFooter
            scope={
              // Per-tool legal scope — keeps the disclaimer specific without
              // each renderer rolling its own copy. calc fallback covers any
              // future tool added before this map updates.
              payload.tool === 'labor_pension'
                ? 'calc'
                : payload.tool === 'big_small_reservoir'
                ? 'investment'
                : payload.tool === 'tax_planner'
                ? 'estate'
                : payload.tool === 'million_gift'
                ? 'investment'
                : 'calc'
            }
          />
        </div>

        <div className="text-center text-xs text-slate-400 pt-2">
          Powered by{' '}
          <a href="/" className="font-bold text-slate-600 hover:text-slate-800 transition-colors">
            Ultra Advisor
          </a>
        </div>
      </div>
    </div>
  );
};

export default CustomerReportPage;
