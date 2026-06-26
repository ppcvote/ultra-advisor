/**
 * QuotaIndicator — Sprint 14 W3 配額顯示元件
 * --------------------------------------------------------------------------
 * 顯示顧問本月 AI 問答 + 條款 PDF 檢視 用量。
 * 預期掛在 AgentChat header + PdfViewer footer。
 *
 * UX:
 *   - 預設 compact 顯示：「本月: AI 問答 47/100 · 條款 12/50」
 *   - 任一額度 ≥ 80% → 顯示「申請額度」按鈕
 *   - loading 中顯示「— / —」骨架（不閃白）
 *   - 未登入 / 查詢失敗 → 顯示「配額查詢中」灰字、不擋畫面
 *
 * 申請額度動作：採 mailto 信件（與 AgentChat quota 0 處理一致）。
 * --------------------------------------------------------------------------
 */
import React from 'react';
import { useQuotaUsage } from '../../hooks/useQuotaUsage';

export interface QuotaIndicatorProps {
  className?: string;
  /** 是否顯示 missingProductSubmits 用量（PdfViewer 不需要、AgentChat 不需要） */
  showMissingProductSubmits?: boolean;
  /** 80% 提醒閾值 — 可覆寫測試 */
  warnThreshold?: number;
}

const EXTENSION_MAILTO =
  'mailto:support@ultralab.tw' +
  '?subject=' +
  encodeURIComponent('條款助理 - 申請額度') +
  '&body=' +
  encodeURIComponent(
    [
      '您好，',
      '',
      '我希望申請本月額外的條款助理配額（AI 問答 / 條款 PDF 檢視）。',
      '',
      '原因：',
      '',
      '（顧問 Email：）',
    ].join('\n'),
  );

function openExtensionRequest() {
  // 在 callback 內觸發 — 不依賴 module top-level state
  window.location.href = EXTENSION_MAILTO;
}

const QuotaIndicator: React.FC<QuotaIndicatorProps> = ({
  className = '',
  showMissingProductSubmits = false,
  warnThreshold = 0.8,
}) => {
  const { quotas, loading, error } = useQuotaUsage();

  // loading 第一次 + 沒有舊資料 → 骨架
  if (loading && !quotas) {
    return (
      <div className={`text-xs text-gray-400 ${className}`}>
        本月：AI 問答 —/— · 條款 —/—
      </div>
    );
  }

  // 查詢失敗 / 未登入 → 灰字、不擋
  if (!quotas) {
    return (
      <div className={`text-xs text-gray-400 ${className}`}>
        {error ? '配額查詢失敗' : '配額查詢中'}
      </div>
    );
  }

  const { asks, pdfViews, missingProductSubmits } = quotas.quotas;

  const asksRatio = asks.limit > 0 ? asks.used / asks.limit : 0;
  const pdfRatio = pdfViews.limit > 0 ? pdfViews.used / pdfViews.limit : 0;
  const submitRatio =
    missingProductSubmits.limit > 0
      ? missingProductSubmits.used / missingProductSubmits.limit
      : 0;

  const shouldWarn =
    asksRatio >= warnThreshold ||
    pdfRatio >= warnThreshold ||
    (showMissingProductSubmits && submitRatio >= warnThreshold);

  const canRequestExtension = shouldWarn && quotas.extensionRequestable;

  return (
    <div
      className={`text-xs text-gray-500 inline-flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}
    >
      <span>
        本月：AI 問答{' '}
        <span
          className={
            asksRatio >= warnThreshold
              ? 'font-mono font-bold text-amber-700'
              : 'font-mono text-slate-700'
          }
        >
          {asks.used}/{asks.limit}
        </span>{' '}
        ·{' '}
        <span>條款 </span>
        <span
          className={
            pdfRatio >= warnThreshold
              ? 'font-mono font-bold text-amber-700'
              : 'font-mono text-slate-700'
          }
        >
          {pdfViews.used}/{pdfViews.limit}
        </span>
        {showMissingProductSubmits && (
          <>
            {' '}
            · 缺漏回報{' '}
            <span
              className={
                submitRatio >= warnThreshold
                  ? 'font-mono font-bold text-amber-700'
                  : 'font-mono text-slate-700'
              }
            >
              {missingProductSubmits.used}/{missingProductSubmits.limit}
            </span>
          </>
        )}
      </span>
      {canRequestExtension && (
        <button
          type="button"
          onClick={openExtensionRequest}
          className="text-[11px] font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
        >
          申請額度
        </button>
      )}
    </div>
  );
};

export default QuotaIndicator;
