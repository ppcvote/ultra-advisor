import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Calendar,
  Car,
  Gift,
  GraduationCap,
  Landmark,
  LineChart as LineChartIcon,
  MessageCircle,
  Rocket,
  ShieldCheck,
  Umbrella,
  Waves,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Area,
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import DisclaimerFooter from '../components/DisclaimerFooter';
import { getDisplayName } from '../components/ShareToCustomerButton';
import {
  CustomerReportPayload,
  decodeCustomerReport,
  type FamilyRole,
  type InsuranceCoverageBucket,
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

// Tool slug → 中文 label. Shared by the og:title useEffect AND the
// FeedbackBar prefilled message. Single source of truth — adding a new tool
// later requires updating exactly this one map.
// (Sprint 9 A extended to 10 tools.)
const TOOL_LABELS: Record<CustomerReportPayload['tool'], string> = {
  labor_pension: '退休缺口分析',
  big_small_reservoir: '大小水庫專案',
  tax_planner: '稅務傳承規劃',
  million_gift: '百萬禮物計畫',
  fund_time_machine: '基金時光機',
  student_loan: '學貸活化專案',
  car_replacement: '5 年換車專案',
  super_active_saving: '超積極存錢法',
  financial_real_estate: '金融房產專案',
  golden_safe_vault: '黃金保險箱',
};

// Sprint 9 F: sanitize contactLine before opening a LINE URL.
// 顧問可能在 Firestore users/{uid}.contactLine 塞奇怪的東西 (phone / URL / email)。
// 嚴格 regex 只放行 @xxx 或純 alnum/_-/. (LINE OA ID 規範) — 其他丟掉。
// 長度上限 20：LINE OA ID 規範 4-18 字元、留 buffer 給 @ prefix。
function sanitizeContactLine(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // @ prefix 可選；id 主體只接受 alphanumeric / underscore / hyphen / period
  if (!/^@?[a-zA-Z0-9_.-]{2,20}$/.test(trimmed)) return undefined;
  return trimmed;
}

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
  // 為什麼這裡再 sanitize 一次：Sprint 7 / 8 之前產生的舊 link 沒走 sanitize、
  // payload.advisor.name 可能殘留電話/email/LINE id；
  // decode 端跑一次 fallback 防 leak（critic security #2）
  const safeName = advisor.name ? getDisplayName(advisor.name) : '—';
  const certLine = [advisor.companyName, advisor.licenses].filter(Boolean).join(' · ');
  return (
    <div className="bg-slate-900/70 border border-slate-700/60 rounded-xl px-4 py-2.5 flex items-center gap-3">
      <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-slate-100 font-bold truncate text-sm">{safeName}</span>
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

// ---------------------------------------------------------------------------
// Sprint 9 A — 6 new renderers (fund time machine / student loan /
// car replacement / super active saving / financial real estate /
// golden safe vault).
//
// Same gap-first pattern as Sprint 8 renderers:
//   1. Hero card (key metric, tool-specific colour)
//   2. Chart card (recharts, ~280-300px fixed height)
//   3. Assumptions grid (muted bg-slate-50 — sunk below hero)
//   4. Secondary stats (2-col supportive numbers)
//
// 紅線詞合規 (金管會保險業務員管理規則 §15 / 證券投資顧問規則):
//   - NO「保證」「絕對」「淨獲利」「節稅金額」「預期報酬」
//   - 涉投資的 3 個 view (fund / student / super-active / fin-real) hero 內
//     塞 italic 小字「※ 此為情境模擬、非保證收益」(Sprint 8 MillionGift pattern)
//   - 涉保險的 1 個 view (golden-safe-vault) 用「上鎖後資產」中性詞、不講「保本」
//
// 不直接 import 6 個工具元件本身 — 它們各帶 800+ 行 + Firebase 依賴，
// 客戶頁 lazy chunk 鐵則禁止 (Sprint 7 教訓)。每個 renderer 從 payload
// 重新繪圖、避開原工具的 advisor-side UI (chips / share button / etc).
// ---------------------------------------------------------------------------

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

const StudentLoanView: React.FC<{ payload: PayloadOf<'student_loan'> }> = ({ payload }) => {
  const { inputs, outputs } = payload;

  // 4 phase: 在學/寬限/只繳息/本息攤還。bar chart 顯示各期月付金 (元)
  // 期滿淨資產 (萬) 在 hero、避免 axis 混單位
  const chartData = useMemo(() => {
    return [
      { phase: '在學', 月付金: 0, 期長: outputs.studyYears },
      { phase: '寬限', 月付金: 0, 期長: Math.max(0, outputs.graceEndYear - outputs.studyYears) },
      { phase: '只繳息', 月付金: Math.round(outputs.monthlyInterest), 期長: Math.max(0, outputs.interestOnlyEndYear - outputs.graceEndYear) },
      { phase: '本息攤還', 月付金: Math.round(outputs.monthlyPMT), 期長: Math.max(0, outputs.repaymentEndYear - outputs.interestOnlyEndYear) },
    ];
  }, [outputs.studyYears, outputs.graceEndYear, outputs.interestOnlyEndYear, outputs.repaymentEndYear, outputs.monthlyInterest, outputs.monthlyPMT]);

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-emerald-50 to-sky-50 border border-emerald-200 rounded-2xl p-6 text-center relative overflow-hidden">
        <div className="absolute top-2 right-3 opacity-10 pointer-events-none">
          <GraduationCap size={80} />
        </div>
        <div className="relative">
          <div className="text-xs font-bold text-emerald-700 tracking-wider uppercase mb-1">Student Loan Plan</div>
          <div className="text-sm font-bold text-emerald-800 mb-1">{outputs.totalDuration} 年後期滿淨資產</div>
          <div className="text-5xl md:text-6xl font-black text-emerald-600 font-mono leading-none">
            {formatWan(outputs.finalAsset)}
          </div>
          <div className="text-[11px] text-emerald-600/80 mt-3">
            學貸覆蓋率 <span className="font-bold underline">{(outputs.coverageRatio * 100).toFixed(0)}%</span>
            {' '}· 利率 1.775% 政府方案
          </div>
          <div className="text-[10px] mt-2 text-slate-500 italic">
            ※ 此為基於使用者假設參數之情境模擬，非保證收益，實際結果可能因市場波動而異。
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">4 段期間月付金</h3>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="phase" tick={{ fontSize: 12, fill: '#475569' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="元" axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => formatNT(value)}
              />
              <Bar dataKey="月付金" fill="#10b981" radius={[6, 6, 0, 0]} barSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">試算假設</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">貸款金額</div>
            <div className="font-bold text-slate-800">{inputs.loanAmount} 萬</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">投資報酬率</div>
            <div className="font-bold text-slate-800">{inputs.investReturnRate}% / 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">就學期</div>
            <div className="font-bold text-slate-800">{inputs.semesters} 學期</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">寬限期</div>
            <div className="font-bold text-slate-800">{inputs.gracePeriod} 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">只繳息期</div>
            <div className="font-bold text-slate-800">{inputs.interestOnlyPeriod} 年</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">弱勢身分</div>
            <div className="font-bold text-slate-800">{inputs.isQualified ? '是 (免息)' : '一般'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">學貸利率</div>
            <div className="font-bold text-slate-800">1.775%</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">總期長</div>
            <div className="font-bold text-slate-800">{outputs.totalDuration} 年</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">只繳息期月付</div>
          <div className="text-lg font-bold text-slate-800 font-mono">{formatNT(Math.round(outputs.monthlyInterest))}</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">攤還期月付</div>
          <div className="text-lg font-bold text-slate-800 font-mono">{formatNT(Math.round(outputs.monthlyPMT))}</div>
        </div>
      </div>
    </div>
  );
};

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

// ---------------------------------------------------------------------------
// Sprint 10 A — InsuranceCheckupView (多人多保單 readonly 概覽)
// 為什麼結構不同：其他 renderer 是「單一試算結果」、這個是「家庭級保障地圖」
// PII 鐵則：role 是 enum 不是姓名、不渲染任何 m.name / 保單公司 / 保單編號
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<FamilyRole, string> = {
  self: '本人',
  spouse: '配偶',
  child_1: '子女 1',
  child_2: '子女 2',
  child_3: '子女 3',
  father: '父親',
  mother: '母親',
};

const COVERAGE_LABELS: Record<keyof InsuranceCoverageBucket, string> = {
  life: '壽險',
  medical: '醫療',
  critical: '重疾',
  accident: '意外',
  disability: '失能',
  longTermCare: '長照',
};

const InsuranceCheckupView: React.FC<{ payload: PayloadOf<'insurance_checkup'> }> = ({ payload }) => {
  const { inputs, outputs } = payload;
  const score = outputs.overallScore ?? 0;
  const scoreColor =
    score >= 80 ? 'text-emerald-600' :
    score >= 60 ? 'text-amber-600' :
    'text-rose-600';
  const scoreLabel =
    score >= 80 ? '保障完整' :
    score >= 60 ? '尚有缺口' :
    '建議補強';

  return (
    <div className="space-y-5">
      {/* Hero — overallScore 0-100 */}
      <div className="bg-gradient-to-br from-indigo-50 to-sky-100 border border-indigo-200 rounded-2xl p-6 text-center relative overflow-hidden">
        <div className="absolute top-2 right-3 opacity-10 pointer-events-none">
          <ShieldCheck size={80} />
        </div>
        <div className="relative">
          <div className="text-xs font-bold text-indigo-700 tracking-wider uppercase mb-1">Family Insurance Checkup</div>
          <div className="text-sm font-bold text-indigo-800 mb-1">家庭保障整體評分</div>
          <div className={`text-5xl md:text-6xl font-black font-mono leading-none ${scoreColor}`}>
            {score}<span className="text-2xl md:text-3xl text-slate-500"> / 100</span>
          </div>
          <div className={`text-sm font-bold mt-2 ${scoreColor}`}>{scoreLabel}</div>
          {/* inline 合規警語 — 不能單依賴頁尾 footer，LINE 多半不會滾到底 */}
          <div className="text-[10px] mt-2 text-slate-500 italic">
            ※ 此評分為基於您現有保單試算之概覽，實際保障條件以保單條款為準。
          </div>
        </div>
      </div>

      {/* Members grid — 每人匿名 role + 險種 coverage 概覽 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">家庭成員保障概覽（{inputs.members.length} 人）</h3>
        <div className="space-y-3">
          {inputs.members.map((m, idx) => {
            const coverageKeys = (Object.keys(m.coverage) as (keyof InsuranceCoverageBucket)[])
              .filter(k => (m.coverage[k] ?? 0) > 0);
            return (
              <div key={`${m.role}_${idx}`} className="bg-slate-50 rounded-xl p-3">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-bold text-slate-800">{ROLE_LABELS[m.role] || m.role}</span>
                  {m.age != null && <span className="text-xs text-slate-500">{m.age} 歲</span>}
                </div>
                {coverageKeys.length > 0 ? (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {coverageKeys.map(k => (
                      <span key={k} className="text-slate-600">
                        {COVERAGE_LABELS[k]}{' '}
                        <span className="font-mono font-bold text-slate-800">{(m.coverage[k] ?? 0).toLocaleString()}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-rose-500 italic">尚無保障紀錄</div>
                )}
                {m.gaps && (
                  () => {
                    const gapKeys = (Object.keys(m.gaps!) as (keyof InsuranceCoverageBucket)[])
                      .filter(k => (m.gaps![k] ?? 0) > 0);
                    return gapKeys.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-x-2 text-[11px]">
                        {gapKeys.map(k => (
                          <span key={k} className="text-rose-600">
                            {COVERAGE_LABELS[k]} 缺 <span className="font-mono">{(m.gaps![k] ?? 0).toLocaleString()}</span>
                          </span>
                        ))}
                      </div>
                    ) : null;
                  }
                )()}
              </div>
            );
          })}
        </div>
      </div>

      {/* Top priorities — anonymize strings from encoder */}
      {outputs.topPriorities && outputs.topPriorities.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-amber-800 mb-2">建議優先補強</h3>
          <ul className="space-y-1.5">
            {outputs.topPriorities.slice(0, 3).map((p, i) => (
              <li key={i} className="text-sm text-amber-900 flex items-start gap-2">
                <span className="font-bold text-amber-600">{i + 1}.</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Annual budget — optional, 數字無 PII */}
      {inputs.annualBudget != null && inputs.annualBudget > 0 && (
        <div className="bg-slate-50 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-500 mb-1">家庭年度保費</div>
          <div className="text-lg font-bold text-slate-800 font-mono">{inputs.annualBudget.toLocaleString()} 元 / 年</div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sprint 9 F — Customer Feedback Widget (LINE deep-link).
//
// 3 emoji buttons → open LINE chat with prefilled message.
//   - 顧問若有 contactLine: 開 https://line.me/R/ti/p/<contactLine>?text=<msg>
//   - 顧問沒設 contactLine: 按鈕仍顯示但 onClick 改成 toast「請直接回覆 LINE
//     訊息給顧問」、避免顯示「無法反饋」這種讓客戶覺得 dead-end 的 UX
//   - sessionStorage 防重複提交：每連結每 session 只送一次（避免客戶亂連發
//     騷擾顧問、也避免按 3 次跳 3 個 LINE 視窗）
//
// 為什麼 LINE 而非 Firestore write：F 任務鐵則「不改 firestore.rules」、
// 多寫一條 collection 還要再進 critic、所以 LINE 是 lowest-friction path。
//
// PII: 預設訊息 prefill 只有「工具名 + 反饋類型」，沒有客戶任何個資。
// 連結本身的 base64 payload 客戶看完也不會被夾進 LINE 訊息 — 因為 LINE 訊息
// 是另一條對話 channel、URL 不會自動 attach。
// ---------------------------------------------------------------------------

type FeedbackKind = 'understood' | 'know_more' | 'book_meeting';

interface FeedbackOption {
  kind: FeedbackKind;
  emoji: string;
  label: string;
  action: string; // 動詞片語，組進 prefilled message
}

const FEEDBACK_OPTIONS: FeedbackOption[] = [
  { kind: 'understood', emoji: '📖', label: '看得懂', action: '謝謝，我看完了' },
  { kind: 'know_more', emoji: '💬', label: '想了解更多', action: '我想進一步了解' },
  { kind: 'book_meeting', emoji: '📅', label: '想預約諮詢', action: '想預約諮詢，請聯絡我' },
];

const CustomerFeedbackCard: React.FC<{
  reportLabel: string;
  contactLine?: string;
  // session 用 URL pathname 當 key — 不含 query string 的 payload base64，
  // 避免每次 share 同樣的工具給不同客戶都被同一個顧問端的 session 卡住。
  // (顧問也不太可能在同一個 session 看自己給多個客戶的連結，但小心一點)
  sessionKey: string;
}> = ({ reportLabel, contactLine, sessionKey }) => {
  // null → 未送，非 null → 已送的 kind（按鈕顯示「已反饋」）
  const [sent, setSent] = useState<FeedbackKind | null>(() => {
    try {
      if (typeof sessionStorage === 'undefined') return null;
      const v = sessionStorage.getItem(`ua_fb_${sessionKey}`);
      return v && ['understood', 'know_more', 'book_meeting'].includes(v) ? (v as FeedbackKind) : null;
    } catch {
      return null;
    }
  });

  const handleClick = (opt: FeedbackOption) => {
    if (sent) return;
    const prefilled = `【${reportLabel}】${opt.action}`;

    if (contactLine) {
      // LINE OA deep link：用 oaMessage endpoint（canonical 規格、可帶 prefilled）
      // 之前用 `line.me/R/ti/p/~xxx` 是錯的（~ 是舊 lin.ee 短網址 prefix、不是 OA ID prefix）
      // → critic security #1 / engineering #6: 所有 contactLine 設了的 click 在 LINE
      //   in-app browser 都 404、F widget 整套失效
      // 正確：https://line.me/R/oaMessage/<oaId>/?<msg>
      // oaId 接受帶 @ 或不帶 @（LINE 兩種都認），統一去掉 @ 後 encode
      const oaId = contactLine.replace(/^@/, '');
      const lineUrl = `https://line.me/R/oaMessage/${encodeURIComponent('@' + oaId)}/?${encodeURIComponent(prefilled)}`;
      // window.open 返 null 代表被 popup-block（不 throw），fallback alert
      const w = window.open(lineUrl, '_blank', 'noopener,noreferrer');
      if (!w) {
        try { alert('已準備好訊息，請手動開啟 LINE 給顧問：\n\n' + prefilled); } catch { /* ignore */ }
      }
    } else {
      // 沒設 contactLine fallback：用 alert 而非 toast，因為客戶頁沒 toast provider
      // (toast util 在 advisor 端 App 才 mount、CustomerReportPage 是獨立路由)
      try {
        alert('請直接回覆 LINE 訊息給顧問\n\n' + prefilled);
      } catch { /* ignore */ }
    }

    // 不論 LINE 開成功與否都 mark sent — 避免客戶連按 3 次跳 3 視窗
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(`ua_fb_${sessionKey}`, opt.kind);
      }
    } catch { /* sessionStorage 不可用 → state 仍會更新、但下次 reload 會重置 */ }
    setSent(opt.kind);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle size={18} className="text-blue-600" />
        <h3 className="text-sm font-bold text-slate-700">看完了？告訴顧問你的想法</h3>
      </div>
      <p className="text-xs text-slate-500 mb-2">
        點一下對應按鈕，會自動開啟 LINE 並帶入訊息草稿，您只需確認後送出。
      </p>
      {/* 個資法 §19 招攬意向同意條款 — Sprint 9 critic：按下按鈕後送出 = 招攬同意證據 */}
      <p className="text-[10px] text-slate-400 mb-4 leading-snug">
        ※ 按下按鈕後將透過 LINE 聯絡您的顧問，視同您同意顧問就此次諮詢與您進一步聯繫。
      </p>
      <div className="grid grid-cols-3 gap-2">
        {FEEDBACK_OPTIONS.map((opt) => {
          const isThisSent = sent === opt.kind;
          const otherSent = sent !== null && !isThisSent;
          return (
            <button
              key={opt.kind}
              type="button"
              onClick={() => handleClick(opt)}
              disabled={sent !== null}
              aria-label={`反饋：${opt.label}`}
              aria-pressed={isThisSent}
              className={`px-3 py-3 rounded-xl border text-center transition-all ${
                isThisSent
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : otherSent
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:shadow-sm active:scale-[0.98]'
              }`}
            >
              <div className="text-2xl mb-1" aria-hidden="true">{opt.emoji}</div>
              <div className="text-xs font-bold">
                {isThisSent ? '✓ 已反饋' : opt.label}
              </div>
            </button>
          );
        })}
      </div>
      {!contactLine && (
        <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
          ※ 顧問尚未設定 LINE 官方帳號 ID — 按下後會顯示訊息範本，請直接回覆顧問的 LINE 訊息。
        </p>
      )}
    </div>
  );
};

const InvalidView: React.FC = () => (
  <div className="min-h-[60vh] flex items-center justify-center px-5" role="alert" aria-live="polite">
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
  <div className="min-h-[60vh] flex items-center justify-center px-5" role="alert" aria-live="polite">
    <div className="max-w-sm w-full text-center bg-slate-900/60 border border-slate-700/60 rounded-2xl p-8">
      <AlertCircle className="mx-auto mb-3 text-amber-400" size={36} />
      <h2 className="text-lg font-bold text-slate-100 mb-2">不支援的試算類型</h2>
      <p className="text-sm text-slate-400 mb-5">
        此頁面目前不支援這個試算類型，請聯絡您的顧問。
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

    // Tool → display name. Lifted to module-level TOOL_LABELS so the
    // FeedbackBar can reuse the exact same map (DRY — don't drift labels).
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
        {/* Sprint 9 A — 6 new renderers */}
        {payload.tool === 'fund_time_machine' && <FundTimeMachineView payload={payload} />}
        {payload.tool === 'student_loan' && <StudentLoanView payload={payload} />}
        {payload.tool === 'car_replacement' && <CarReplacementView payload={payload} />}
        {payload.tool === 'super_active_saving' && <SuperActiveSavingView payload={payload} />}
        {payload.tool === 'financial_real_estate' && <FinancialRealEstateView payload={payload} />}
        {payload.tool === 'golden_safe_vault' && <GoldenSafeVaultView payload={payload} />}
        {/* Sprint 10 A — InsuranceCheckup (11/11 工具完成) */}
        {payload.tool === 'insurance_checkup' && <InsuranceCheckupView payload={payload} />}

        {/* Sprint 9 F: feedback widget — opens LINE chat with顧問。
            放在既有 ShieldCheck CTA card 上方 (per task spec)。sessionKey 用
            pathname (without payload base64) — 同顧問多份連結還是各自獨立 session */}
        <CustomerFeedbackCard
          reportLabel={TOOL_LABELS[payload.tool] ?? '試算結果'}
          contactLine={sanitizeContactLine(payload.advisor.contactLine)}
          sessionKey={`${payload.tool}_${payload.generatedAt}`}
        />

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
              // Sprint 9: tax_planner and million_gift now multi-scope to
              // address compliance-critic gap (estate+insurance / tax+investment).
              payload.tool === 'labor_pension'
                ? 'calc'
                : payload.tool === 'big_small_reservoir'
                ? 'investment'
                : payload.tool === 'tax_planner'
                ? (['estate', 'insurance'] as const)
                : payload.tool === 'million_gift'
                ? (['tax', 'investment'] as const)
                : // Sprint 9 A — 6 new tools' scope mapping
                payload.tool === 'fund_time_machine'
                ? 'investment'
                : payload.tool === 'student_loan'
                ? (['investment', 'calc'] as const)
                : payload.tool === 'car_replacement'
                ? 'investment'
                : payload.tool === 'super_active_saving'
                ? 'investment'
                : payload.tool === 'financial_real_estate'
                ? 'investment'
                : payload.tool === 'golden_safe_vault'
                ? (['insurance', 'investment'] as const)
                : payload.tool === 'insurance_checkup'
                ? 'insurance'
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
