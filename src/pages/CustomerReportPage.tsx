import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, ShieldCheck, Umbrella } from 'lucide-react';
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

const AdvisorBar: React.FC<{ payload: CustomerReportPayload }> = ({ payload }) => {
  const { advisor, generatedAt } = payload;
  return (
    <div className="bg-slate-900/70 border border-slate-700/60 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-400 mb-0.5">您的財務顧問</div>
        <div className="text-slate-100 font-bold truncate">{advisor.name || '—'}</div>
        {(advisor.licenses || advisor.companyName) && (
          <div className="text-xs text-slate-400 truncate">
            {[advisor.companyName, advisor.licenses].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
      {generatedAt > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono shrink-0">
          <Calendar size={12} />
          產生於 {formatGeneratedAt(generatedAt)}
        </div>
      )}
    </div>
  );
};

const LaborPensionView: React.FC<{ payload: CustomerReportPayload }> = ({ payload }) => {
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
    <div className="space-y-6">
      {/* Hero — restates the headline number first so a glance reveals the gap. */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <Umbrella size={140} />
        </div>
        <div className="relative z-10">
          <span className="bg-white/15 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase backdrop-blur-sm">
            Retirement Planning
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold mt-3 mb-2 tracking-tight">
            您的退休缺口分析
          </h1>
          <p className="text-slate-300 text-sm md:text-base opacity-90">
            這份試算是顧問依您的條件、納入通膨與勞保打折因子後的結果。
          </p>
        </div>
      </div>

      {/* Assumptions card — so the client sees what their advisor used and
          can flag wrong numbers ("我的薪水沒這麼高啊"). Transparency >
          mystique here: a black box that just spits out a gap number reads
          as a sales pitch. */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
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

      {/* Gap headline — biggest number on the page. */}
      <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 text-center">
        <div className="text-sm font-bold text-rose-800 mb-1">退休後每月缺口（通膨調整後）</div>
        <div className="text-4xl md:text-5xl font-black text-rose-600 font-mono">
          {formatNT(outputs.gap)}
        </div>
        <div className="text-xs text-rose-400 mt-3">
          {inputs.retireAge} 歲時，理想月生活費將達{' '}
          <span className="font-bold underline">{formatNT(outputs.futureDesiredIncome)}</span>
        </div>
      </div>

      {/* Chart — recharts already in shared bundle (other tools use it), so
          no additional cost. We use the same stacked-bar shape advisors see
          so the client recognises the picture if they later come in for a
          face-to-face. */}
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

      {/* Coverage stats — small + factual. */}
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

const InvalidView: React.FC = () => (
  <div className="min-h-[60vh] flex items-center justify-center px-5">
    <div className="max-w-sm w-full text-center bg-slate-900/60 border border-slate-700/60 rounded-2xl p-8">
      <AlertCircle className="mx-auto mb-3 text-amber-400" size={36} />
      <h2 className="text-lg font-bold text-slate-100 mb-2">此連結無效或已過期</h2>
      <p className="text-sm text-slate-400 mb-5">
        試算連結可能已被更新。請聯絡您的顧問索取最新版本。
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
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow, noarchive, nosnippet';
    document.head.appendChild(meta);
    const prevTitle = document.title;
    document.title = view.kind === 'ok' ? '退休缺口分析 — Ultra Advisor' : 'Ultra Advisor';
    return () => {
      document.title = prevTitle;
      try { document.head.removeChild(meta); } catch { /* ignore */ }
    };
  }, [view.kind]);

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
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-6">
        <div className="text-slate-200">
          <AdvisorBar payload={payload} />
        </div>

        {/* 防偽溫和提示 — 沒有 server signing 的情況下，page 本身不能宣稱
            「這是被驗證的顧問報告」。誠實揭露「數字由顧問端產生」，
            讓 viewer 知道權威來源是 math + 顧問本人、不是這頁面本身 */}
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900 leading-relaxed">
          本頁試算結果由顧問端使用 Ultra Advisor 工具產生，數字為顧問依您提供之條件輸入後計算。如需驗證或調整參數，請直接聯絡您的顧問。
        </div>

        {payload.tool === 'labor_pension' && <LaborPensionView payload={payload} />}

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
          <DisclaimerFooter scope="calc" />
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
