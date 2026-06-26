/**
 * 險種名稱自動完成 — Sprint 14 W1 rewrite
 *
 * Data source migration:
 *   v1 (Sprint 12-)  : `productCache` Firestore collection via
 *                      `useProductCache.searchProducts(...)` Cloud Function
 *                      callable. Returned ~few hundred AI-generated rows.
 *   v2 (this file)   : Sprint 13 `insurance_products` Firestore collection
 *                      (35,823 TII catalog rows), read directly by client SDK
 *                      via `searchProductsByCompanySlug(...)`. Cloud Function
 *                      round-trip eliminated for the hot path.
 *
 * Flow:
 *   1. Parent (PolicyForm) already has an insurer picker → forwards the
 *      Chinese name via the `insurer` prop. We resolve it to a `companySlug`
 *      using `resolveCompanySlugByName` (covers TAIWAN_INSURERS + the wider
 *      Sprint 13 COMPANY_SLUG_OPTIONS list).
 *   2. On insurer change, fetch the first 30 active products for that slug
 *      and cache them in component state. We DO NOT refetch on every
 *      keystroke — that would burn one Firestore read per character.
 *   3. Keystrokes (≥1 char) are debounced 200ms, then we run
 *      `fuzzyMatchProductLocal` over the cached batch with `limit: 10`.
 *   4. Selecting a row fires BOTH the legacy `onChange(name, product)`
 *      (backward compat with PolicyForm) AND the new
 *      `onProductSelected(product)` callback so consumers can take the full
 *      `InsuranceProduct` shape without the ProductCache shim.
 *   5. Cache miss path: keep the AI-fallback `lookupInsuranceProduct` Cloud
 *      Function reachable via an explicit "嘗試 AI 補完" button — never on
 *      keystroke debounce. Spending LLM tokens per keystroke would torch
 *      our Gemini quota.
 *
 * Strategic boundaries enforced here:
 *   - No new npm dependencies.
 *   - The legacy `productCache`-shaped `onChange` callback still fires so
 *     PolicyForm continues to write `productCacheId` / `claimSummary` into
 *     existing Firestore policy docs without a migration. We supply a
 *     `ProductCache`-compatible shim built from the `InsuranceProduct` row.
 *   - Wall-clock time stays inside event handler / setTimeout callbacks —
 *     never at module top level.
 *   - We never expose `sourceUrl` or any "資料來源" hint in the dropdown —
 *     Sprint 14 鐵則 forbids surfacing the TII / 保險贏家 / CloudWinner /
 *     昇華科技 origin to advisors.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Loader2, Sparkles } from 'lucide-react';
import { useProductCache } from '../../hooks/useProductCache';
import type { ProductCache, ProductCategory } from '../../types/insurance';
import {
  searchProductsByCompanySlug,
  searchProducts as searchProductsCrossCompany,
  fuzzyMatchProductLocal,
  type InsuranceProduct,
  type InsuranceCategoryMain,
} from '../../lib/insuranceProducts';
import { resolveCompanySlugByName } from '../../lib/companySlugOptions';

interface ProductAutocompleteProps {
  /** Chinese full name of the insurer as picked in PolicyForm. May be the
   *  literal string "其他" or empty — both cases fall back to cross-company
   *  search instead of erroring. */
  insurer: string;
  value: string;
  /** Legacy callback — kept for PolicyForm compat. The second argument is a
   *  best-effort `ProductCache` shim built from the chosen `InsuranceProduct`
   *  so existing consumers continue to write `productCacheId` etc. */
  onChange: (name: string, product?: ProductCache) => void;
  /** New typed callback — receives the full `InsuranceProduct` (or null when
   *  the advisor reverts to free-text). Optional; PolicyForm wires this in
   *  Sprint 14 W1 to populate the catalog-alignment panel. */
  onProductSelected?: (product: InsuranceProduct | null) => void;
}

/**
 * Translate the Sprint 13 8-bucket `categoryMain` into the existing 16-value
 * `ProductCategory` that PolicyForm + downstream analytics already consume.
 * `categorySub` provides extra context for ambiguous buckets (e.g. medical →
 * "日額" picks `medical_daily`, otherwise default to `medical_expense`).
 *
 * Intentionally conservative — we fall back to `'other'` rather than guessing
 * when no clean mapping exists.
 */
function categoryMainToProductCategory(
  main: InsuranceCategoryMain,
  sub?: string
): ProductCategory {
  const s = (sub ?? '').toLowerCase();
  switch (main) {
    case 'life':
      if (s.includes('定期') || s.includes('term')) return 'life_term';
      return 'life_whole';
    case 'medical':
      if (s.includes('日額')) return 'medical_daily';
      if (s.includes('手術')) return 'surgery';
      return 'medical_expense';
    case 'critical':
      if (s.includes('癌')) return 'cancer';
      if (s.includes('重大傷病')) return 'major_injury';
      return 'critical_illness';
    case 'accident':
      if (s.includes('醫療')) return 'accident_medical';
      return 'accident';
    case 'disability':
      return 'disability';
    case 'longTermCare':
      return 'long_term_care';
    case 'annuity':
      return 'annuity';
    case 'investmentLinked':
      return 'investment';
    default:
      return 'other';
  }
}

/**
 * Build a `ProductCache`-shaped shim from an `InsuranceProduct`. We surface
 * only the fields PolicyForm reads today (`id`, `productName`, `insurer`,
 * `category`, `status`). `claimSummary` is intentionally NOT populated — the
 * Sprint 13 catalog has no claim data (Sprint 15 migrates that), and faking
 * it would silently break the policy detail page.
 *
 * NEVER expose `sourceUrl` here.
 */
function toProductCacheShim(p: InsuranceProduct, insurerName: string): ProductCache {
  return {
    id: p.id,
    productName: p.productName,
    insurer: insurerName || p.company,
    category: categoryMainToProductCategory(p.categoryMain, p.categorySub),
    status: p.status === 'active' ? 'selling' : 'discontinued',
    keywords: [],
    searchCount: 0,
    // `lastUpdated` / `lastSearched` deliberately omitted — PolicyForm doesn't
    // read them, and the catalog row's `crawledAt` is not advisor-facing.
    updatedBy: 'ai',
  } as unknown as ProductCache;
}

export default function ProductAutocomplete({
  insurer,
  value,
  onChange,
  onProductSelected,
}: ProductAutocompleteProps) {
  const { lookupProduct } = useProductCache();

  const [inputValue, setInputValue] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [catalogBatch, setCatalogBatch] = useState<InsuranceProduct[]>([]);
  const [filtered, setFiltered] = useState<InsuranceProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [aiFallbackOpen, setAiFallbackOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fetchTokenRef = useRef(0);

  // Insurer slug resolution. Recomputed only when the parent's insurer
  // string changes — cheap, but memoized to avoid a fresh lookup on every
  // keystroke render.
  const companySlug = useMemo(() => resolveCompanySlugByName(insurer), [insurer]);

  // Sync controlled `value` from parent.
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close dropdown on outside click.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch the catalog batch when insurer changes. Cross-company fallback when
  // we couldn't resolve a slug (e.g. parent picked "其他" or left blank).
  useEffect(() => {
    // Reset prior batch so a stale dropdown can't leak between insurers.
    setCatalogBatch([]);
    setFiltered([]);
    setAiFallbackOpen(false);
    setAiError(null);

    if (!insurer || insurer === '其他') {
      // Cross-company mode is enabled only after the advisor types — we don't
      // pre-fetch 30 random products. Keeps cost down on the empty case.
      return;
    }

    const token = ++fetchTokenRef.current;
    setSearching(true);

    (async () => {
      try {
        let batch: InsuranceProduct[];
        if (companySlug) {
          batch = await searchProductsByCompanySlug(companySlug, {
            limit: 30,
            activeOnly: true,
          });
        } else {
          // Insurer name didn't match the COMPANY_SLUG_OPTIONS roster (rare —
          // OCR could echo a deprecated brand). Skip prefetch; we'll fall
          // through to per-keystroke cross-company search.
          batch = [];
        }
        if (token !== fetchTokenRef.current) return; // raced — discard
        setCatalogBatch(batch);
      } catch (err) {
        console.error('[ProductAutocomplete] catalog prefetch failed', err);
        if (token === fetchTokenRef.current) setCatalogBatch([]);
      } finally {
        if (token === fetchTokenRef.current) setSearching(false);
      }
    })();
  }, [insurer, companySlug]);

  // Cross-company search path (only used when we couldn't prefetch by slug).
  const runCrossCompanySearch = useCallback(async (keyword: string) => {
    const token = ++fetchTokenRef.current;
    setSearching(true);
    try {
      const rows = await searchProductsCrossCompany(keyword, { limit: 30 });
      if (token !== fetchTokenRef.current) return;
      setCatalogBatch(rows);
      setFiltered(fuzzyMatchProductLocal(keyword, rows, { limit: 10 }));
    } catch (err) {
      console.error('[ProductAutocomplete] cross-company search failed', err);
      if (token === fetchTokenRef.current) {
        setCatalogBatch([]);
        setFiltered([]);
      }
    } finally {
      if (token === fetchTokenRef.current) setSearching(false);
    }
  }, []);

  const handleInputChange = (text: string) => {
    setInputValue(text);
    onChange(text);
    // Free-text edit invalidates any prior catalog selection.
    onProductSelected?.(null);
    setAiError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Debounce kept tight (200ms) per Sprint 14 W1 spec. We do work inside
    // the timeout callback so any wall-clock reads remain runtime-scoped.
    debounceRef.current = setTimeout(() => {
      const trimmed = text.trim();
      if (trimmed.length < 1) {
        setFiltered([]);
        setShowDropdown(false);
        return;
      }

      if (companySlug && catalogBatch.length > 0) {
        // Fast path — local fuzzy over cached batch.
        setFiltered(fuzzyMatchProductLocal(trimmed, catalogBatch, { limit: 10 }));
        setShowDropdown(true);
      } else {
        // No slug or empty batch → fall through to cross-company Firestore
        // query. Still a single read per debounced keystroke, not per char.
        setShowDropdown(true);
        void runCrossCompanySearch(trimmed);
      }
    }, 200);
  };

  const handleSelect = (product: InsuranceProduct) => {
    setInputValue(product.productName);
    const shim = toProductCacheShim(product, insurer);
    onChange(product.productName, shim);
    onProductSelected?.(product);
    setShowDropdown(false);
    setAiFallbackOpen(false);
  };

  // AI fallback — only fires on explicit click. Reuses Sprint 12
  // lookupInsuranceProduct Cloud Function (kept in place until Sprint 15
  // formally migrates productCache → insurance_products).
  const handleAiFallback = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (!insurer || insurer === '其他') {
      setAiError('請先選擇保險公司，再嘗試 AI 補完');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await lookupProduct(insurer, trimmed);
      if (res?.product) {
        // The AI fallback returns a ProductCache row (not InsuranceProduct).
        // Fire only the legacy onChange — onProductSelected stays null
        // because we don't have a real catalog match.
        onChange(res.product.productName, res.product);
        onProductSelected?.(null);
        setInputValue(res.product.productName);
        setShowDropdown(false);
        setAiFallbackOpen(false);
      } else {
        setAiError('AI 也找不到這個商品，請手動填寫類別');
      }
    } catch (err) {
      console.error('[ProductAutocomplete] AI fallback failed', err);
      setAiError('AI 補完失敗，請稍後再試');
    } finally {
      setAiLoading(false);
    }
  };

  const hasResults = filtered.length > 0;
  const trimmedInput = inputValue.trim();
  const showAiFallback =
    showDropdown && trimmedInput.length >= 1 && !hasResults && !searching;

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (hasResults) setShowDropdown(true);
          }}
          placeholder={
            companySlug
              ? '險種名稱（從目錄搜尋）'
              : '險種名稱（輸入後跨公司搜尋）'
          }
          className="w-full px-3 py-1.5 pr-8 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {searching ? (
            <Loader2 size={14} className="text-blue-500 animate-spin" />
          ) : (
            <Search size={14} className="text-slate-300" />
          )}
        </div>
      </div>

      {/* 下拉結果 */}
      {showDropdown && hasResults && (
        <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => handleSelect(product)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-slate-50 last:border-0"
            >
              <div className="font-medium text-slate-700">{product.productName}</div>
              <div className="text-xs text-slate-400">
                {product.company}
                {product.productCode ? ` · ${product.productCode}` : ''}
                {product.status === 'active' ? ' · 在售' : ' · 停售'}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* AI 補完入口 — only when slug query found nothing */}
      {showAiFallback && (
        <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg p-3 text-sm">
          {!aiFallbackOpen ? (
            <button
              type="button"
              onClick={() => setAiFallbackOpen(true)}
              className="w-full text-left flex items-center gap-2 text-slate-600 hover:text-blue-600"
            >
              <Sparkles size={14} className="text-amber-500" />
              <span>目錄裡沒有「{trimmedInput}」？嘗試 AI 補完</span>
            </button>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-slate-500">
                會用 AI 推測類別與基本特性（不產生金額），會花較長時間。
              </div>
              <button
                type="button"
                onClick={handleAiFallback}
                disabled={aiLoading}
                className="w-full px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {aiLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    AI 補完中…
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    確認執行 AI 補完
                  </>
                )}
              </button>
              {aiError && <div className="text-xs text-rose-500">{aiError}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
