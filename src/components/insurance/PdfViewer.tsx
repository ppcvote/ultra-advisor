/**
 * PdfViewer — Sprint 14 W3 條款原文檢視 modal
 * --------------------------------------------------------------------------
 * 顧問端從 AgentChat 的 citation 列表點「查條款原文」、開此 modal、
 * 讀 `/api/pdf-proxy` 拿 short-lived signed URL → blob、塞 iframe 顯示。
 *
 * 戰略邊界（HARD）
 *   1. 不引入新 npm 依賴 — 不用 pdfjs-dist / react-pdf；純 <iframe> + CSS。
 *   2. PDFs 全 private — 不暴露 signed URL 給 client、blob: URL 只活 modal 期間。
 *   3. 浮水印頁腳 1B：「UA 顧問 {advisorEmail} · {ISO short} · do-not-share」
 *      ‑ pointer-events-none、不擋互動、不可被 iframe 內 PDF viewer 蓋掉
 *      （所以放 modal 容器、不放 iframe 內）。
 *   4. iframe sandbox="allow-same-origin"：blob: URL 不在 http origin、
 *      不允許 scripts（瀏覽器內建 PDF viewer 仍可載入）。
 *   5. 顧問每月 50 PDF view — quota header 從 response `X-Quota-Remaining` 讀。
 *   6. Audit log 後端寫（client 不負責、不另發 fetch）。
 *   7. 「現在時間」必須在 fetch callback 內取（runtime now）— rule from Sprint 14。
 *
 * UX：
 *   - Modal overlay z-50、bg-black/60、點 overlay 關閉
 *   - Header：「條款原文」title + citationLabel chip + 「下載」disabled + X
 *   - Body：loading spinner / error retry / iframe
 *   - 浮水印：絕對定位 bottom-2 right-2、bg-white/80 text-xs、pointer-events-none
 *   - Footer：本月已查 X/50 PDF
 *
 * 不破壞 W1/W2 — 此 component 自包含、no side effects。
 * --------------------------------------------------------------------------
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  X, Lock, Loader2, AlertTriangle, RefreshCw, FileText, Download,
} from 'lucide-react';
import { auth } from '../../firebase';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PdfViewerProps {
  /** 是否開啟 modal；caller 也可以用 conditional render 來控制（default true）。 */
  open?: boolean;
  onClose: () => void;
  productId: string;
  version?: string;
  /** 引用標籤、顯示在 header chip，例如「第 17 條」。 */
  citationLabel?: string;
  /** 顧問 email — 印在浮水印；通常從 auth.currentUser.email 帶進來。 */
  advisorEmail?: string;
  /** 預留：初始頁碼（瀏覽器內建 PDF viewer 支援 #page=N anchor）。 */
  initialPage?: number;
  /** 後端 X-Quota-Remaining header 回傳後 callback、給上層同步 quota 顯示 */
  onQuotaUpdate?: (remaining: number) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUOTA_PER_MONTH = 50;
const PDF_PROXY_ENDPOINT = '/api/pdf-proxy';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format epoch ms → "YYYY-MM-DD HH:MM"（local time、給浮水印用）。
 *  注意：呼叫時的 ts 必須是 callback 內取的 Date.now()，不是 module top-level。 */
function formatWatermarkTime(tsMs: number): string {
  const d = new Date(tsMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** Build a friendly error message from a fetch Response or thrown Error. */
function describeError(status: number | null, fallback: string): string {
  if (status === 401 || status === 403) return '驗證失敗，請重新登入後再試。';
  if (status === 404) return '找不到此條款 PDF，可能尚未上架。';
  if (status === 429) return '本月 PDF 檢視配額已用完（每月 50 份）。';
  if (status === 503) return '條款檢視服務暫時無法服務，請稍後重試。';
  if (status && status >= 500) return '伺服器錯誤，請稍後重試。';
  return fallback;
}

type ErrorKind = 'auth' | 'notfound' | 'quota' | 'server' | 'network' | 'unknown';

function errorKindFromStatus(status: number | null): ErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'notfound';
  if (status === 429) return 'quota';
  if (status === 503 || (status && status >= 500)) return 'server';
  if (status == null) return 'network';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Watermark — separate sub-component so we can re-stamp 時間 on every open
// ---------------------------------------------------------------------------
const Watermark: React.FC<{ email?: string; openedAtMs: number }> = ({
  email,
  openedAtMs,
}) => {
  const who = email && email.trim() ? email.trim() : '未具名顧問';
  const when = formatWatermarkTime(openedAtMs);
  return (
    <div
      className="
        pointer-events-none select-none
        absolute bottom-2 right-2 z-10
        bg-white/80 backdrop-blur-sm
        border border-slate-200
        rounded px-2 py-1
        text-xs font-mono text-slate-600
        shadow-sm
        max-w-[calc(100%-1rem)]
        truncate
      "
      aria-hidden="true"
    >
      UA 顧問 {who} · {when} · do-not-share
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const PdfViewer: React.FC<PdfViewerProps> = ({
  open = true,
  onClose,
  productId,
  version,
  citationLabel,
  advisorEmail,
  initialPage,
  onQuotaUpdate,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  // openedAtMs — 在 open 變 true 的 callback 內取、給浮水印；
  // 不在 module top-level、符合 Sprint 14 鐵則。
  const [openedAtMs, setOpenedAtMs] = useState<number | null>(null);
  // retry tick — 強制重跑 fetch effect（不改 productId/version 也能 retry）
  const [retryTick, setRetryTick] = useState(0);

  const overlayRef = useRef<HTMLDivElement | null>(null);

  // ── stamp openedAtMs when modal opens ───────────────────────────────────
  useEffect(() => {
    if (open) {
      setOpenedAtMs(Date.now());
    } else {
      // 關閉時清掉、下次重新打開重 stamp
      setOpenedAtMs(null);
      setError(null);
      setErrorKind(null);
      setBlobUrl(null);
      setQuotaRemaining(null);
    }
  }, [open]);

  // ── ESC to close ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // ── Lock body scroll while modal open ───────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ── Fetch PDF blob ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (!productId) {
      setError('缺少 productId、無法載入條款。');
      setErrorKind('unknown');
      return;
    }

    let cancelled = false;
    let blobUrlLocal: string | null = null;

    const fetchPdf = async () => {
      setLoading(true);
      setError(null);
      setErrorKind(null);

      const user = auth.currentUser;
      if (!user) {
        if (!cancelled) {
          setError('請先登入再查條款原文。');
          setErrorKind('auth');
          setLoading(false);
        }
        return;
      }

      let idToken: string;
      try {
        idToken = await user.getIdToken();
      } catch {
        if (!cancelled) {
          setError('無法取得登入憑證，請重新登入。');
          setErrorKind('auth');
          setLoading(false);
        }
        return;
      }

      let res: Response;
      try {
        res = await fetch(PDF_PROXY_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productId,
            version: version || 'v1',
          }),
        });
      } catch {
        if (!cancelled) {
          setError('網路連線異常，請檢查網路後重試。');
          setErrorKind('network');
          setLoading(false);
        }
        return;
      }

      // Quota header — read first so 429 也能更新顯示
      const remainingRaw = res.headers.get('X-Quota-Remaining');
      if (remainingRaw != null) {
        const parsed = parseInt(remainingRaw, 10);
        if (!Number.isNaN(parsed) && !cancelled) {
          setQuotaRemaining(parsed);
          // 通知上層（AgentChat / 父元件）同步 quota 顯示
          if (onQuotaUpdate) {
            onQuotaUpdate(parsed);
          }
        }
      }

      if (!res.ok) {
        const kind = errorKindFromStatus(res.status);
        const msg = describeError(res.status, `載入失敗（${res.status}）。`);
        if (!cancelled) {
          setError(msg);
          setErrorKind(kind);
          setLoading(false);
        }
        return;
      }

      // 成功 → blob
      let blob: Blob;
      try {
        blob = await res.blob();
      } catch {
        if (!cancelled) {
          setError('PDF 內容讀取失敗，請重試。');
          setErrorKind('server');
          setLoading(false);
        }
        return;
      }

      blobUrlLocal = URL.createObjectURL(blob);

      if (cancelled) {
        URL.revokeObjectURL(blobUrlLocal);
        return;
      }

      setBlobUrl(blobUrlLocal);
      setLoading(false);
    };

    fetchPdf();

    return () => {
      cancelled = true;
      if (blobUrlLocal) {
        URL.revokeObjectURL(blobUrlLocal);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId, version, retryTick]);

  // ── Cleanup blob URL on unmount (defensive — 上面 effect 也會清) ──────────
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
    // 只在 unmount 跑、blobUrl 是 ref-like、不放進 deps（避免每次切 URL 多清一次）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = useCallback(() => {
    setRetryTick(t => t + 1);
  }, []);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // 只有點到 overlay 本體（不是 children）才關
      if (e.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  if (!open) return null;

  // iframe src — 帶 #page=N anchor 給瀏覽器內建 PDF viewer
  const iframeSrc = blobUrl
    ? initialPage && initialPage > 0
      ? `${blobUrl}#page=${initialPage}`
      : blobUrl
    : '';

  const quotaText =
    quotaRemaining != null
      ? `本月已查 ${Math.max(0, QUOTA_PER_MONTH - quotaRemaining)}/${QUOTA_PER_MONTH} PDF`
      : `本月配額 ${QUOTA_PER_MONTH} PDF`;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-2 sm:px-4 py-4 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-label="條款原文檢視"
    >
      <div
        className="
          relative bg-white rounded-2xl shadow-2xl
          w-full max-w-5xl
          flex flex-col
          max-h-[95vh] sm:max-h-[92vh]
          overflow-hidden
        "
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <FileText size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold text-slate-800 leading-tight">
                條款原文
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {citationLabel && (
                  <span className="inline-flex items-center text-[11px] font-mono font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
                    {citationLabel}
                  </span>
                )}
                {version && (
                  <span className="text-[10px] font-mono text-slate-400">
                    版本 {version}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* 下載 disabled — 條款 PDF 不開放下載（合規 + 私有保留） */}
            <button
              type="button"
              disabled
              className="
                inline-flex items-center gap-1 text-xs
                text-slate-400 cursor-not-allowed
                px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50
              "
              title="條款原文不開放下載"
              aria-label="下載（已停用）"
            >
              <Lock size={12} />
              <Download size={12} className="hidden sm:inline" />
              <span className="hidden sm:inline">下載</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="
                inline-flex items-center justify-center
                w-8 h-8 rounded-lg
                text-slate-500 hover:text-slate-800 hover:bg-slate-100
                transition-colors
              "
              aria-label="關閉"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="relative flex-1 bg-slate-100 min-h-[50vh]">
          {/* Loading state */}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
              <Loader2 size={28} className="animate-spin text-indigo-600 mb-3" />
              <div className="text-sm">載入條款 PDF 中…</div>
              <div className="text-[11px] text-slate-400 mt-1">
                檔案較大時可能需要 2-3 秒
              </div>
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <AlertTriangle size={32} className="text-rose-500 mb-3" />
              <div className="text-sm font-medium text-slate-800 max-w-md">
                {error}
              </div>
              {errorKind !== 'quota' && errorKind !== 'auth' && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="
                    mt-4 inline-flex items-center gap-1.5
                    text-xs font-medium text-white
                    bg-indigo-600 hover:bg-indigo-700
                    px-3 py-1.5 rounded-lg
                    transition-colors
                  "
                >
                  <RefreshCw size={12} />
                  重試
                </button>
              )}
              {errorKind === 'quota' && (
                <a
                  href="mailto:support@ultralab.tw?subject=%E6%A2%9D%E6%AC%BE%20PDF%20-%20%E7%94%B3%E8%AB%8B%E9%A1%8D%E5%BA%A6"
                  className="
                    mt-4 inline-flex items-center gap-1.5
                    text-xs font-medium text-indigo-700 hover:text-indigo-900 hover:underline
                  "
                >
                  申請額度
                </a>
              )}
            </div>
          )}

          {/* PDF iframe — only when blob is ready */}
          {!loading && !error && blobUrl && (
            <iframe
              src={iframeSrc}
              title="條款原文 PDF"
              className="w-full h-[70vh] sm:h-[80vh] border-0 bg-white"
              sandbox="allow-same-origin"
            />
          )}

          {/* Floating watermark — 永遠 render（除非 modal 沒開）
              在 iframe 之上、pointer-events-none 不擋互動 */}
          {openedAtMs != null && (
            <Watermark email={advisorEmail} openedAtMs={openedAtMs} />
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-2 border-t border-slate-200 bg-white">
          <div className="text-[11px] text-slate-500 leading-tight">
            條款原文僅供顧問內部查閱、請勿轉寄或截圖外流。
          </div>
          <div
            className={`
              text-[11px] font-mono shrink-0
              ${
                quotaRemaining != null && quotaRemaining <= 5
                  ? 'text-rose-600 font-bold'
                  : 'text-slate-500'
              }
            `}
          >
            {quotaText}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfViewer;
