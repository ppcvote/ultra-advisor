/**
 * ProductCompareView — Sprint 16 scaffold + Sprint 17 W1 條款對照 (B3)
 * --------------------------------------------------------------------------
 * 顧問端「比較兩張保單」三欄面板。
 *
 *   - Sprint 16 W1: ship 規格對照 (catalog 已有的欄位)
 *   - Sprint 17 W1 (B3): 條款對照 tab 真接 backend
 *     (compareProductConditions callable + Gemini 2.5 Pro 結構化輸出)
 *   - 試算對照仍為 placeholder (Sprint 17 W2-W3 接保費粗估器)
 *
 * 戰略邊界 (HARD — Sprint 16 + 17 W1)
 *   1. 不引入新 npm 依賴 — Tailwind + lucide-react + firebase/functions only。
 *   2. 不對外宣稱資料來源 — 不出現 TII / 保險贏家 / 昇華科技 / cloudwinner /
 *      gouptech / insurance_winner 等任何 source provenance 字串。
 *      catalog 內部欄位 `source` / `sourceUrl` 一律 NOT 顯示。
 *   3. PdfViewer reuse — 點「查條款原文」沿用 Sprint 14 W3 既有 component。
 *      此檔不重新實作 watermark / quota / proxy。
 *   4. Wall-clock time 不在 module top-level 取 — 跟 Sprint 12-14 約定一致，
 *      此檔不用 Date.now() / new Date() 在 render path 外。
 *   5. Mobile responsive — sm 斷點下三欄 stack 為單欄 (A → 對照 → B)。
 *   6. UA 絕不給商品推薦 — 條款對照 callable 回傳 recommendation 永遠 null、
 *      此 UI 也不顯示任何「哪張比較好」的字眼。
 *   7. 「AI 解讀僅供參考」disclaimer sticky bottom — 條款 tab 在 view 時必出現。
 *
 * UX:
 *   - 三欄 layout (lg+): [A 卡片] | [中間 sticky 對照表] | [B 卡片]
 *   - Header: 兩商品名 + 公司 + 「✕ 關閉」
 *   - Sticky tabs: 規格對照 / 條款重點對照 / 試算對照
 *   - 規格對照: 公司 / 商品代碼 / 大分類 / 細類 / 終身/定期 / 主/附約 /
 *               保額範圍 / 最高投保年齡 / 銷售狀態 / 生效日。
 *               同欄不同 → red 框 + ⚠ icon。
 *   - 條款重點對照:
 *      - summary banner top
 *      - differences table: category badge / A 規格 / B 規格 / impact dot / notes
 *      - 「查條款原文 A / B」按鈕 (PdfViewer reuse)
 *      - loading / error / fallback states
 *      - DisclaimerBar sticky bottom
 *   - 試算對照: placeholder「Sprint 17 接保費粗估器」。
 *
 * 不破壞 Sprint 13/14/15/16 — 此 component 自包含、僅多了 callable 呼叫 (lazy on demand)。
 * --------------------------------------------------------------------------
 */
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  X, Loader2, AlertTriangle, FileText, Calculator, ListChecks, ShieldCheck,
  ChevronLeft, RefreshCw, Info,
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import {
  getProductById,
  type InsuranceProduct,
  type InsuranceCategoryMain,
} from '../../lib/insuranceProducts';
import { CATEGORY_LABEL_ZH } from '../../lib/insuranceCategoryLabels';

// PdfViewer 已存在 Sprint 14 W3 — 條款原文 modal、自帶浮水印 + quota
const PdfViewer = lazy(() => import('./PdfViewer'));

// ---------------------------------------------------------------------------
// Sprint 17 W1 — Clause compare callable contract
// 與 functions/index.js compareProductConditions 對齊
// ---------------------------------------------------------------------------

type CompareImpact = 'high' | 'medium' | 'low';
type CompareCategory = '等待期' | '除外責任' | '給付項目' | '金額限額' | '其他';

interface CompareDifference {
  category: CompareCategory | string;
  aValue: string;
  bValue: string;
  impact: CompareImpact;
  notes: string;
}

interface CompareResult {
  summary: string;
  differences: CompareDifference[];
  overlap: string;
  recommendation: null;
  disclaimers: string[];
  tokensUsed: number;
  fallback: boolean;
  fallbackReason?: string;
  fallbackSide?: 'A' | 'B' | 'both' | null;
}

const COMPARE_DISCLAIMER = 'AI 解讀僅供參考、實際以保單條款為準';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ProductCompareViewProps {
  productIdA: string;
  productIdB: string;
  onClose?: () => void;
  /** 顧問 email — 透傳給 PdfViewer 做浮水印。可選；通常 caller 從 auth 帶入。 */
  advisorEmail?: string;
}

type CompareTab = 'spec' | 'clause' | 'estimate';

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

/** TWD 千元 → 萬元 顯示 (catalog `minSumAssured` / `maxSumAssured` 已正規化為元)。
 *  Number formatter only — no I/O, no wall-clock. */
function formatSumRange(min: unknown, max: unknown): string {
  const toW = (v: unknown): string | null => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
    // catalog 內 minVal/maxVal 已是元數；顯示用「萬」做粗略區間
    const w = Math.round(v / 10000);
    if (w >= 10000) return `${(w / 10000).toFixed(1)} 億`;
    return `${w.toLocaleString()} 萬`;
  };
  const lo = toW(min);
  const hi = toW(max);
  if (lo && hi) return `${lo} ~ ${hi}`;
  if (lo) return `${lo} 起`;
  if (hi) return `~ ${hi}`;
  return '—';
}

function formatMaxAge(age: unknown): string {
  if (typeof age !== 'number' || !Number.isFinite(age) || age <= 0) return '—';
  return `${age} 歲`;
}

function formatStatus(status: InsuranceProduct['status']): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'active':
      return { label: '銷售中', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'discontinued':
      return { label: '已停售', className: 'bg-slate-100 text-slate-600 border-slate-200' };
    case 'revised':
      return { label: '條款修訂', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    default:
      return { label: '—', className: 'bg-slate-50 text-slate-500 border-slate-200' };
  }
}

function categoryLabel(c: InsuranceCategoryMain | undefined): string {
  if (!c) return '—';
  return CATEGORY_LABEL_ZH[c] ?? '—';
}

function masterLabel(p: InsuranceProduct | null): string {
  const raw = (p as any)?.isMaster;
  if (raw === true) return '主約';
  if (raw === false) return '附約';
  return '—';
}

function wholeLifeLabel(p: InsuranceProduct | null): string {
  const raw = (p as any)?.isWholeLife;
  if (raw === true) return '終身';
  if (raw === false) return '定期';
  return '—';
}

// ---------------------------------------------------------------------------
// Compare row (regular spec cell vs diff-highlighted)
// ---------------------------------------------------------------------------

interface RowProps {
  label: string;
  valueA: string;
  valueB: string;
}
const Row: React.FC<RowProps> = ({ label, valueA, valueB }) => {
  const diff = valueA !== valueB && valueA !== '—' && valueB !== '—';
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr] gap-2 sm:gap-3 py-2.5 border-b border-slate-100 last:border-b-0 items-center text-sm">
      <div className="text-slate-500 font-medium text-xs sm:text-sm">{label}</div>
      <div
        className={
          'px-2 py-1.5 rounded-md ' +
          (diff
            ? 'bg-red-50 border border-red-200 text-red-700 flex items-center gap-1'
            : 'text-slate-800')
        }
        title={diff ? '兩商品此欄不同' : undefined}
      >
        {diff && <AlertTriangle size={12} className="shrink-0" />}
        <span className="truncate">{valueA}</span>
      </div>
      <div
        className={
          'px-2 py-1.5 rounded-md ' +
          (diff
            ? 'bg-red-50 border border-red-200 text-red-700 flex items-center gap-1'
            : 'text-slate-800')
        }
        title={diff ? '兩商品此欄不同' : undefined}
      >
        {diff && <AlertTriangle size={12} className="shrink-0" />}
        <span className="truncate">{valueB}</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Product header card
// ---------------------------------------------------------------------------

const ProductCard: React.FC<{
  product: InsuranceProduct | null;
  side: 'A' | 'B';
  onOpenPdf?: () => void;
}> = ({ product, side, onOpenPdf }) => {
  const accent = side === 'A' ? 'border-blue-200 bg-blue-50/40' : 'border-violet-200 bg-violet-50/40';
  const dot = side === 'A' ? 'bg-blue-500' : 'bg-violet-500';
  if (!product) {
    return (
      <div className={`rounded-xl border ${accent} p-4 h-full min-h-[160px] flex items-center justify-center`}>
        <div className="text-sm text-slate-400">商品 {side} 載入中或不存在</div>
      </div>
    );
  }
  const statusInfo = formatStatus(product.status);
  return (
    <div className={`rounded-xl border ${accent} p-4`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
          <span className="text-xs font-mono font-bold text-slate-500">商品 {side}</span>
        </div>
        <span
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${statusInfo.className}`}
        >
          {statusInfo.label}
        </span>
      </div>
      <h3 className="text-base font-bold text-slate-900 leading-snug mb-1 break-all">
        {product.productName}
      </h3>
      <div className="text-xs text-slate-600 mb-3">
        <span>{product.company}</span>
        <span className="mx-1.5 text-slate-300">·</span>
        <span className="font-mono">{product.productCode}</span>
      </div>
      <button
        type="button"
        onClick={onOpenPdf}
        className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
      >
        <FileText size={14} />
        查條款原文
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sprint 17 W1 — Clause compare sub-components
// ---------------------------------------------------------------------------

function impactDotColor(impact: CompareImpact): string {
  switch (impact) {
    case 'high':
      return 'bg-red-500';
    case 'medium':
      return 'bg-amber-500';
    case 'low':
    default:
      return 'bg-emerald-500';
  }
}

function impactLabel(impact: CompareImpact): string {
  switch (impact) {
    case 'high':
      return '高影響';
    case 'medium':
      return '中影響';
    case 'low':
    default:
      return '低影響';
  }
}

function categoryBadgeColor(category: string): string {
  switch (category) {
    case '等待期':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case '除外責任':
      return 'bg-red-50 text-red-700 border-red-200';
    case '給付項目':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case '金額限額':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case '其他':
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
}

const ClauseCompareBody: React.FC<{
  result: CompareResult;
  onOpenPdfA: () => void;
  onOpenPdfB: () => void;
  onRetry: () => void;
}> = ({ result, onOpenPdfA, onOpenPdfB, onRetry }) => {
  const { summary, differences, overlap, fallback, fallbackReason } = result;

  return (
    <div>
      {/* Summary banner */}
      {summary && (
        <div
          className={
            'rounded-lg px-3 py-2.5 mb-4 text-sm leading-relaxed ' +
            (fallback
              ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-slate-50 border border-slate-200 text-slate-700')
          }
        >
          {fallback && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 mb-1">
              <AlertTriangle size={12} />
              {fallbackReason === 'insufficient_chunks_a' ||
              fallbackReason === 'insufficient_chunks_b' ||
              fallbackReason === 'insufficient_chunks_both'
                ? '條款資料不足'
                : 'AI 比對未完成'}
            </div>
          )}
          <div className="whitespace-pre-wrap">{summary}</div>
        </div>
      )}

      {/* Action row — open PDFs */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          type="button"
          onClick={onOpenPdfA}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
        >
          <FileText size={12} />
          查條款原文 A
        </button>
        <button
          type="button"
          onClick={onOpenPdfB}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 transition-colors"
        >
          <FileText size={12} />
          查條款原文 B
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors ml-auto"
          title="重新呼叫 AI 比對（會計入 ask 配額）"
        >
          <RefreshCw size={12} />
          重新比對
        </button>
      </div>

      {/* Differences table */}
      {differences.length > 0 ? (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-[80px_1fr_1fr_72px] gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            <div>類別</div>
            <div className="text-blue-600">商品 A 規格</div>
            <div className="text-violet-600">商品 B 規格</div>
            <div className="text-center">影響</div>
          </div>
          <div>
            {differences.map((d, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[80px_1fr_1fr_72px] gap-2 px-3 py-2.5 border-b border-slate-100 last:border-b-0 text-sm items-start"
              >
                <div>
                  <span
                    className={
                      'inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border ' +
                      categoryBadgeColor(String(d.category))
                    }
                  >
                    {d.category}
                  </span>
                </div>
                <div className="text-slate-700 break-words">
                  <div>{d.aValue}</div>
                  {d.notes && (
                    <div className="mt-1 text-[11px] text-slate-400 leading-snug">
                      {d.notes}
                    </div>
                  )}
                </div>
                <div className="text-slate-700 break-words">{d.bValue}</div>
                <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
                  <span
                    className={
                      'inline-block w-2 h-2 rounded-full ' + impactDotColor(d.impact)
                    }
                    aria-label={impactLabel(d.impact)}
                    title={impactLabel(d.impact)}
                  />
                  <span>{impactLabel(d.impact)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !fallback ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-xs text-slate-500">
          AI 未找出明顯差異 — 可能兩商品條款相近、建議直接看條款原文確認。
        </div>
      ) : null}

      {/* Overlap section */}
      {overlap && (
        <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
          <div className="text-xs font-medium text-emerald-700 mb-1 flex items-center gap-1.5">
            <ShieldCheck size={12} />
            兩商品共同重點
          </div>
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {overlap}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const ProductCompareView: React.FC<ProductCompareViewProps> = ({
  productIdA,
  productIdB,
  onClose,
  advisorEmail,
}) => {
  const [a, setA] = useState<InsuranceProduct | null>(null);
  const [b, setB] = useState<InsuranceProduct | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<CompareTab>('spec');
  const [pdfOpenFor, setPdfOpenFor] = useState<'A' | 'B' | null>(null);

  // Sprint 17 W1 — Clause compare state
  const [clauseResult, setClauseResult] = useState<CompareResult | null>(null);
  const [clauseLoading, setClauseLoading] = useState<boolean>(false);
  const [clauseError, setClauseError] = useState<string | null>(null);
  const [clauseFetched, setClauseFetched] = useState<boolean>(false);

  // Parallel fetch — fail soft (each side renders its own empty state)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getProductById(productIdA).catch(() => null),
      getProductById(productIdB).catch(() => null),
    ])
      .then(([pa, pb]) => {
        if (cancelled) return;
        setA(pa);
        setB(pb);
        if (!pa && !pb) {
          setError('找不到這兩張商品的資料，請確認商品代碼是否正確。');
        } else if (!pa || !pb) {
          setError('其中一張商品找不到資料，已用空白卡片代替。');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[ProductCompareView] fetch failed:', err);
        setError('讀取商品資料時發生錯誤，請稍後重試。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productIdA, productIdB]);

  // ---------------------------------------------------------------------------
  // Sprint 17 W1 — Clause compare fetch (lazy, triggered when tab='clause')
  // ---------------------------------------------------------------------------
  const fetchClauseCompare = useCallback(async () => {
    setClauseLoading(true);
    setClauseError(null);
    try {
      const fn = httpsCallable<
        { productIdA: string; productIdB: string },
        CompareResult
      >(functions, 'compareProductConditions');
      const res = await fn({ productIdA, productIdB });
      setClauseResult(res.data);
      setClauseFetched(true);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      let msg = '條款比對失敗、請稍後重試。';
      if (e?.code === 'functions/resource-exhausted') {
        msg = '本月 AI 詢問配額已用完、請至「配額管理」申請延展。';
      } else if (e?.code === 'functions/unauthenticated') {
        msg = '請先登入後再使用條款比對。';
      } else if (e?.code === 'functions/invalid-argument') {
        msg = '商品代碼格式不正確、無法進行比對。';
      } else if (e?.code === 'functions/failed-precondition') {
        msg = '比對服務暫不可用（AI 設定錯誤）、請通知管理員。';
      }
      setClauseError(msg);
      setClauseFetched(true);
    } finally {
      setClauseLoading(false);
    }
  }, [productIdA, productIdB]);

  // 第一次切到「條款重點對照」tab 時自動 fetch；productId 變動時重置已 fetched 旗標
  useEffect(() => {
    setClauseResult(null);
    setClauseError(null);
    setClauseFetched(false);
  }, [productIdA, productIdB]);

  useEffect(() => {
    if (tab !== 'clause') return;
    if (clauseFetched || clauseLoading) return;
    // 雙商品都已載入完成才允許呼叫 (節省 quota — 缺一邊也會 fallback、不浪費)
    if (!a || !b) return;
    void fetchClauseCompare();
  }, [tab, clauseFetched, clauseLoading, a, b, fetchClauseCompare]);

  const specRows = useMemo<RowProps[]>(() => {
    return [
      { label: '公司', valueA: a?.company ?? '—', valueB: b?.company ?? '—' },
      { label: '商品代碼', valueA: a?.productCode ?? '—', valueB: b?.productCode ?? '—' },
      { label: '大分類', valueA: categoryLabel(a?.categoryMain), valueB: categoryLabel(b?.categoryMain) },
      { label: '細類', valueA: a?.categorySub ?? '—', valueB: b?.categorySub ?? '—' },
      { label: '終身 / 定期', valueA: wholeLifeLabel(a), valueB: wholeLifeLabel(b) },
      { label: '主 / 附約', valueA: masterLabel(a), valueB: masterLabel(b) },
      {
        label: '保額範圍',
        valueA: formatSumRange((a as any)?.minSumAssured, (a as any)?.maxSumAssured),
        valueB: formatSumRange((b as any)?.minSumAssured, (b as any)?.maxSumAssured),
      },
      {
        label: '最高投保年齡',
        valueA: formatMaxAge((a as any)?.maxAge),
        valueB: formatMaxAge((b as any)?.maxAge),
      },
      { label: '銷售狀態', valueA: formatStatus(a?.status ?? 'active').label, valueB: formatStatus(b?.status ?? 'active').label },
      { label: '生效日', valueA: a?.effectiveDate ?? '—', valueB: b?.effectiveDate ?? '—' },
    ];
  }, [a, b]);

  const headerA = a ? `${a.productName}` : `商品 A (${productIdA})`;
  const headerB = b ? `${b.productName}` : `商品 B (${productIdB})`;

  const pdfTarget = pdfOpenFor === 'A' ? a : pdfOpenFor === 'B' ? b : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉比較"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ChevronLeft size={18} />
            <span className="hidden sm:inline">返回</span>
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-400 font-mono">商品比較</div>
            <div className="text-sm font-medium text-slate-800 truncate">
              <span className="text-blue-700">{headerA}</span>
              <span className="text-slate-400 mx-2">vs</span>
              <span className="text-violet-700">{headerB}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sticky tabs */}
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1 border-t border-slate-100">
          {([
            { id: 'spec', label: '規格對照', icon: ListChecks },
            { id: 'clause', label: '條款重點對照', icon: ShieldCheck },
            { id: 'estimate', label: '試算對照', icon: Calculator },
          ] as Array<{ id: CompareTab; label: string; icon: typeof ListChecks }>).map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={
                  'inline-flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ' +
                  (active
                    ? 'border-blue-500 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800')
                }
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {loading && (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" />
            載入商品資料中…
          </div>
        )}

        {!loading && error && (
          <div className="mb-4 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-center gap-2">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_260px] gap-4 lg:gap-6">
            {/* Left card */}
            <ProductCard product={a} side="A" onOpenPdf={() => a && setPdfOpenFor('A')} />

            {/* Middle compare panel */}
            <div className="relative rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              {tab === 'spec' && (
                <>
                  <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <ListChecks size={14} className="text-slate-400" />
                    規格對照
                  </h4>
                  <p className="text-xs text-slate-400 mb-3">
                    同欄不同的資料會用紅框標示，方便快速找出差異。
                  </p>
                  <div className="rounded-lg border border-slate-100">
                    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr] gap-2 sm:gap-3 px-2 py-2 bg-slate-50 border-b border-slate-100 text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                      <div>項目</div>
                      <div className="text-blue-600">商品 A</div>
                      <div className="text-violet-600">商品 B</div>
                    </div>
                    <div className="px-2">
                      {specRows.map((r) => (
                        <Row key={r.label} {...r} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {tab === 'clause' && (
                <div className="pb-14">{/* room for DisclaimerBar */}
                  <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <ShieldCheck size={14} className="text-slate-400" />
                    條款重點對照
                  </h4>
                  <p className="text-xs text-slate-400 mb-4">
                    等待期 / 除外責任 / 給付項目 / 金額限額 — 由 AI 結構化解讀兩商品差異。
                  </p>

                  {/* Loading */}
                  {clauseLoading && (
                    <div className="flex items-center justify-center py-12 text-slate-500">
                      <Loader2 size={20} className="animate-spin mr-2" />
                      <span className="text-sm">AI 正在比對條款重點…（約 5-15 秒）</span>
                    </div>
                  )}

                  {/* Error */}
                  {!clauseLoading && clauseError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-red-700 font-medium mb-1">無法完成條款比對</div>
                          <div className="text-xs text-red-600 mb-2">{clauseError}</div>
                          <button
                            type="button"
                            onClick={() => fetchClauseCompare()}
                            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded border border-red-300 bg-white hover:bg-red-50 text-red-700 transition-colors"
                          >
                            <RefreshCw size={12} />
                            重試
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Result */}
                  {!clauseLoading && !clauseError && clauseResult && (
                    <ClauseCompareBody
                      result={clauseResult}
                      onOpenPdfA={() => a && setPdfOpenFor('A')}
                      onOpenPdfB={() => b && setPdfOpenFor('B')}
                      onRetry={() => fetchClauseCompare()}
                    />
                  )}

                  {/* Idle — happens when products haven't loaded yet but tab opened */}
                  {!clauseLoading && !clauseError && !clauseResult && (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                      <ShieldCheck size={20} className="mx-auto text-slate-400 mb-2" />
                      <div className="text-sm text-slate-600 font-medium mb-1">準備中…</div>
                      <div className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                        等兩張商品資料載入完成後會自動開始 AI 條款比對。
                      </div>
                    </div>
                  )}

                  {/* DisclaimerBar — sticky bottom (within compare panel) */}
                  {(clauseResult || clauseLoading) && (
                    <div className="absolute left-0 right-0 bottom-0 mx-4 sm:mx-5 mb-3">
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800 flex items-center gap-1.5 shadow-sm">
                        <Info size={11} className="shrink-0" />
                        <span>{COMPARE_DISCLAIMER}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'estimate' && (
                <div>
                  <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <Calculator size={14} className="text-slate-400" />
                    試算對照
                  </h4>
                  <p className="text-xs text-slate-400 mb-4">
                    相同年齡 / 性別 / 保額條件下，兩商品的保費估算範圍 (±25%)。
                  </p>
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                    <Calculator size={20} className="mx-auto text-slate-400 mb-2" />
                    <div className="text-sm text-slate-600 font-medium mb-1">Sprint 17 接保費粗估器</div>
                    <div className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                      此頁將串接 Sprint 14 既有的 premiumEstimator，依商品類型自動切換可估算 /
                      須報價兩種顯示狀態。
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right card */}
            <ProductCard product={b} side="B" onOpenPdf={() => b && setPdfOpenFor('B')} />
          </div>
        )}
      </div>

      {/* PDF original viewer — reuse Sprint 14 W3 component */}
      {pdfTarget && (
        <Suspense fallback={null}>
          <PdfViewer
            open
            productId={pdfTarget.id}
            onClose={() => setPdfOpenFor(null)}
            advisorEmail={advisorEmail}
          />
        </Suspense>
      )}
    </div>
  );
};

export default ProductCompareView;
