/**
 * ProductCompareView — Sprint 16 scaffold
 * --------------------------------------------------------------------------
 * 顧問端「比較兩張保單」三欄面板。Sprint 16 W1 ship 規格對照 (catalog
 * 已有的欄位、不接 backend)；條款對照 + 試算對照 留 Sprint 17 後接
 * (LLM diff backend / 保費粗估器整合)。
 *
 * 戰略邊界 (Sprint 16 HARD)
 *   1. 不引入新 npm 依賴 — Tailwind + lucide-react only。
 *   2. 純 UI scaffold — 規格對照接 catalog (Sprint 12 `getProductById`)，
 *      條款 / 試算 對照僅 placeholder。Sprint 17 才接 RAG diff。
 *   3. 不對外宣稱資料來源 — 不出現 TII / 保險贏家 / 昇華科技 / cloudwinner /
 *      gouptech / insurance_winner 等任何 source provenance 字串。
 *      catalog 內部欄位 `source` / `sourceUrl` 一律 NOT 顯示。
 *   4. PdfViewer reuse — 點「查條款原文」沿用 Sprint 14 W3 既有 component。
 *      此檔不重新實作 watermark / quota / proxy。
 *   5. Wall-clock time 不在 module top-level 取 — 跟 Sprint 12-14 約定一致，
 *      此檔不用 Date.now() / new Date() 在 render path 外。
 *   6. Mobile responsive — sm 斷點下三欄 stack 為單欄 (A → 對照 → B)。
 *
 * UX:
 *   - 三欄 layout (lg+): [A 卡片] | [中間 sticky 對照表] | [B 卡片]
 *   - Header: 兩商品名 + 公司 + 「✕ 關閉」
 *   - Sticky tabs: 規格對照 / 條款重點對照 / 試算對照
 *   - 規格對照: 公司 / 商品代碼 / 大分類 / 細類 / 終身/定期 / 主/附約 /
 *               保額範圍 / 最高投保年齡 / 銷售狀態 / 生效日。
 *               同欄不同 → red 框 + ⚠ icon。
 *   - 條款重點對照: placeholder「Sprint 17 後即可比較條款」 + 可開 PdfViewer。
 *   - 試算對照: placeholder「Sprint 17 接保費粗估器」。
 *
 * 不破壞 Sprint 13/14/15 — 此 component 自包含、no side effects、不寫 Firestore。
 * --------------------------------------------------------------------------
 */
import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  X, Loader2, AlertTriangle, FileText, Calculator, ListChecks, ShieldCheck,
  ChevronLeft,
} from 'lucide-react';
import {
  getProductById,
  type InsuranceProduct,
  type InsuranceCategoryMain,
} from '../../lib/insuranceProducts';
import { CATEGORY_LABEL_ZH } from '../../lib/insuranceCategoryLabels';

// PdfViewer 已存在 Sprint 14 W3 — 條款原文 modal、自帶浮水印 + quota
const PdfViewer = lazy(() => import('./PdfViewer'));

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
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
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
                <div>
                  <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <ShieldCheck size={14} className="text-slate-400" />
                    條款重點對照
                  </h4>
                  <p className="text-xs text-slate-400 mb-4">
                    等待期 / 除外責任 / 給付條件 / 復效條款 / 解約金 比例。
                  </p>
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                    <ShieldCheck size={20} className="mx-auto text-slate-400 mb-2" />
                    <div className="text-sm text-slate-600 font-medium mb-1">Sprint 17 後即可比較條款</div>
                    <div className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                      條款 diff 需要先把兩張條款 PDF 跑過 RAG pipeline、由 LLM 比對重點段落差異。
                      目前可先點上方「查條款原文」逐張閱讀。
                    </div>
                  </div>
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
