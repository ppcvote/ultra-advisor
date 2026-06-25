import React, { Suspense, lazy, useEffect, useState } from 'react';
import { AlertCircle, MessageCircle, ShieldCheck } from 'lucide-react';
import DisclaimerFooter from '../components/DisclaimerFooter';
import {
  CustomerReportPayload,
  decodeCustomerReport,
} from '../lib/customerReport';
import { parseCustomerReportRoute } from '../lib/customerReportRouter';
import {
  AdvisorBar,
  TOOL_LABELS,
  sanitizeContactLine,
} from './customerReport/_shared';

// Customer-facing read-only report page (Sprint 7 F).
//
// Why we re-render instead of importing each Tool component:
//   - The original tools are 600-1000 lines each, pull in ClientDataPanel +
//     ShareButton + Firebase auth. None of that belongs on a public link a
//     non-member opens from LINE. Importing would also leak the advisor-side
//     UI (chips, hover states, "啟動自提" button that mutates state).
//   - The output payload already contains every number we need; each view
//     just draws a chart + a few stat cards.
//
// Mobile-first: clients open this in LINE in-app browser. Layout collapses
// to a single column under md; charts use ResponsiveContainer with fixed
// pixel height so they don't go invisible on narrow viewports.
//
// Sprint 11 Stream 2 — chunk split.
// Pre-split this file held all 11 tool renderers inline (~2200 LOC) and the
// main chunk gz size was creeping toward Vite's 500 KB warning. The renderers
// have been moved to ./customerReport/views/*Tool*View.tsx and are now lazy-
// loaded per slug via React.lazy + Suspense. Behaviour is identical — pure
// cut-paste relocation (Sprint 4 MarketDataCard pattern). The only thing in
// this file now is route resolution, expiration/OG meta, the read-only
// fallback views (Invalid/Unsupported), the feedback card, and the lazy
// switch in the render body.

type ViewState =
  | { kind: 'invalid' }
  | { kind: 'unsupported'; rawSlug: string }
  | { kind: 'ok'; payload: CustomerReportPayload };

// Sprint 11 Stream 1.4 — Module-level scope consts for DisclaimerFooter.
// Why: previously inline `(['estate', 'insurance'] as const)` ternaries inside
// the JSX rebuilt a fresh array every render, defeating any downstream
// useMemo / referential-equality optimization inside DisclaimerFooter (sprint
// 9 engineering-critic P3). Hoisting these to module scope gives them a stable
// identity across renders without changing behaviour — pure cleanup, no logic
// touched. Per-tool array literals stay co-located near their owner map below.
const TAX_PLANNER_SCOPE = ['estate', 'insurance'] as const;
const MILLION_GIFT_SCOPE = ['tax', 'investment'] as const;
const STUDENT_LOAN_SCOPE = ['investment', 'calc'] as const;
const GOLDEN_SAFE_VAULT_SCOPE = ['insurance', 'investment'] as const;

// ---------------------------------------------------------------------------
// Lazy view chunks — one per tool slug.
//
// Each view file default-exports the React component, so React.lazy gets a
// pure component reference per chunk. Vite splits each into its own JS chunk
// (and recharts gets hoisted to a shared vendor chunk — same recharts pieces
// appear in multiple views, so Vite's chunking already deduplicates).
//
// Why per-slug instead of a single "views" chunk:
//   - A given client opens exactly ONE tool's report URL. Loading 11 view
//     bundles for a single view is pure waste — the share link includes the
//     tool slug, so we know precisely which chunk to fetch.
//   - Initial bundle no longer carries any chart code; recharts is in a
//     vendor chunk that only downloads when a view that needs it mounts.
// ---------------------------------------------------------------------------
const LaborPensionView = lazy(() => import('./customerReport/views/LaborPensionView'));
const BigSmallReservoirView = lazy(() => import('./customerReport/views/BigSmallReservoirView'));
const TaxPlannerView = lazy(() => import('./customerReport/views/TaxPlannerView'));
const MillionGiftView = lazy(() => import('./customerReport/views/MillionGiftView'));
const FundTimeMachineView = lazy(() => import('./customerReport/views/FundTimeMachineView'));
const StudentLoanView = lazy(() => import('./customerReport/views/StudentLoanView'));
const CarReplacementView = lazy(() => import('./customerReport/views/CarReplacementView'));
const SuperActiveSavingView = lazy(() => import('./customerReport/views/SuperActiveSavingView'));
const FinancialRealEstateView = lazy(() => import('./customerReport/views/FinancialRealEstateView'));
const GoldenSafeVaultView = lazy(() => import('./customerReport/views/GoldenSafeVaultView'));
const InsuranceCheckupView = lazy(() => import('./customerReport/views/InsuranceCheckupView'));

// ---------------------------------------------------------------------------
// SkeletonView — Suspense fallback while a lazy view chunk loads.
//
// Sprint 10 critic preferred a layout-matching skeleton over a spinner: the
// shape mirrors what's about to mount (hero band → chart → assumptions grid
// → 2-col secondary stats → CTA), so the visual jump on hydration is small.
// All cards are bg-slate-100 / animate-pulse — no rotating elements, no
// network spinners. Same fixed heights as the real cards (chart 280px etc.)
// so the page doesn't reflow when the real view replaces this.
// ---------------------------------------------------------------------------
const SkeletonView: React.FC = () => (
  <div className="space-y-5" aria-hidden="true">
    <div className="bg-slate-200 rounded-2xl p-6 h-[156px] animate-pulse" />
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="h-3 w-24 bg-slate-200 rounded animate-pulse mb-3" />
      <div className="bg-slate-100 rounded-xl h-[280px] animate-pulse" />
    </div>
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
      <div className="h-3 w-20 bg-slate-200 rounded animate-pulse mb-3" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-slate-100 rounded-xl h-20 animate-pulse" />
      <div className="bg-slate-100 rounded-xl h-20 animate-pulse" />
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Sprint 9 F — Customer Feedback Widget (LINE deep-link).
//
// 3 emoji buttons → open LINE chat with prefilled message.
//   - 顧問若有 contactLine: 開 https://line.me/R/oaMessage/<contactLine>/?text=<msg>
//   - 顧問沒設 contactLine: 按鈕仍顯示但 onClick 改成 alert「請直接回覆 LINE
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

    // Tool → display name. Lifted to module-level TOOL_LABELS (in _shared.tsx)
    // so the FeedbackBar can reuse the exact same map (DRY — don't drift labels).
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

        {/* Sprint 11 Stream 2 — lazy view chunks.
            Each view chunk is its own bundle; Suspense fallback shows a
            skeleton while it loads. Wrapping just the variable view (not the
            AdvisorBar / amber notice / Feedback / CTA / Footer) means the
            stable chrome stays painted across navigation transitions and
            only the renderer area swaps. */}
        <Suspense fallback={<SkeletonView />}>
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
        </Suspense>

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
              // Sprint 11 Stream 1.4: per-tool scope arrays hoisted to module
              // const so identity is stable across renders.
              payload.tool === 'labor_pension'
                ? 'calc'
                : payload.tool === 'big_small_reservoir'
                ? 'investment'
                : payload.tool === 'tax_planner'
                ? TAX_PLANNER_SCOPE
                : payload.tool === 'million_gift'
                ? MILLION_GIFT_SCOPE
                : // Sprint 9 A — 6 new tools' scope mapping
                payload.tool === 'fund_time_machine'
                ? 'investment'
                : payload.tool === 'student_loan'
                ? STUDENT_LOAN_SCOPE
                : payload.tool === 'car_replacement'
                ? 'investment'
                : payload.tool === 'super_active_saving'
                ? 'investment'
                : payload.tool === 'financial_real_estate'
                ? 'investment'
                : payload.tool === 'golden_safe_vault'
                ? GOLDEN_SAFE_VAULT_SCOPE
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
