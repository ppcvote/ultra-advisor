/**
 * useQuotaUsage — Sprint 14 W3 顧問端配額查詢 hook
 * --------------------------------------------------------------------------
 * 呼叫 Cloud Functions `getQuotaUsage` 取得當月配額使用情形。
 *
 * 鐵則 (Sprint 14 W3 戰略邊界)
 *   1. yyyymm 必須在 runtime callback 內取（client 本地時區）— module top-level
 *      不能呼叫 new Date() / Date.now()（HARD rule: 0 wall-clock call）。
 *   2. 用 cancelled flag 防 race（unmount 時不 setState）。
 *   3. 失敗時 quotas 仍為 null、UI 應 graceful degrade（不擋顧問操作）。
 *   4. 不 cache — 每次 hook mount 都打一次（量小、且使用量變化即時）。
 * --------------------------------------------------------------------------
 */
import { useState, useEffect, useCallback } from 'react';
import { httpsCallable, HttpsCallableResult } from 'firebase/functions';
import { functions, auth } from '../firebase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface QuotaSlot {
  used: number;
  limit: number;
}

export interface QuotaUsage {
  yyyymm: string;
  quotas: {
    asks: QuotaSlot;
    pdfViews: QuotaSlot;
    missingProductSubmits: QuotaSlot;
  };
  extensionRequestable: boolean;
}

export interface UseQuotaUsageReturn {
  quotas: QuotaUsage | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helper — 在 callback 內取「當下年月」字串
// 鐵則對齊：禁止在 module top-level 呼叫；callers 必須在 useEffect / event
// callback 內叫此函式。
// ---------------------------------------------------------------------------
function computeYearMonthRuntime(): string {
  // ⚠️ 此函式只能在 runtime callback 內被呼叫（useEffect / 事件處理）。
  // 若被 module top-level 誤呼叫、yyyymm 會在打包當下被凍結 — 嚴禁。
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}${mm}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useQuotaUsage(): UseQuotaUsageReturn {
  const [quotas, setQuotas] = useState<QuotaUsage | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  // refetch trigger — bump 此值會重跑 effect
  const [refetchTick, setRefetchTick] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchQuota() {
      // 未登入直接放棄、UI 應另行處理（QuotaIndicator 會顯示 null）
      if (!auth.currentUser) {
        if (!cancelled) {
          setQuotas(null);
          setLoading(false);
        }
        return;
      }

      // runtime callback 內取年月（鐵則對齊）
      const yyyymm = computeYearMonthRuntime();

      try {
        const fn = httpsCallable<{ yyyymm: string }, QuotaUsage>(
          functions,
          'getQuotaUsage',
        );
        const res: HttpsCallableResult<QuotaUsage> = await fn({ yyyymm });
        if (cancelled) return;
        setQuotas(res.data);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e as Error);
        // 不清 quotas — 保留上一輪資料（refetch fail 時 UI 不該閃空）
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    fetchQuota();

    return () => {
      cancelled = true;
    };
  }, [refetchTick]);

  const refetch = useCallback(async () => {
    setRefetchTick((t) => t + 1);
  }, []);

  return { quotas, loading, error, refetch };
}

export default useQuotaUsage;
