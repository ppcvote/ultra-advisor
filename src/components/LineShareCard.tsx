/**
 * 圖片分享卡 - 包一塊試算結果區、按鈕點下去 html2canvas 截圖 → navigator.share / LINE
 *
 * 用法：
 *   <LineShareCard
 *     title="退休缺口試算"
 *     text="我幫你算了退休缺口，你看看..."
 *     url="https://ultra-advisor.tw"
 *     fileName="retirement.png"
 *   >
 *     <YourSummaryComponent />
 *   </LineShareCard>
 *
 * 為什麼這支獨立於 ShareButton：
 *  - html2canvas 是動態 import（30+ KB，不每個工具都要載）
 *  - 試算結果區需要 ref 包起來，元件 API 比較自然
 */

import React, { useRef, useState } from 'react';
import { Share2, Loader2 } from 'lucide-react';
import { shareViaSystem, canShareFiles } from '../utils/shareToLine';
import { toast } from '../utils/toast';

interface LineShareCardProps {
  /** 試算結果區 React 元件 */
  children: React.ReactNode;
  /** 分享標題（system share sheet 顯示） */
  title?: string;
  /** 分享文字（傳到 LINE 訊息預設文字） */
  text: string;
  /** 分享 URL（fallback 到 LINE 時必填） */
  url?: string;
  /** 截圖檔名 */
  fileName?: string;
  /** 按鈕文字 */
  label?: string;
  /** 額外 className（套在外層 wrapper） */
  className?: string;
  /** 按鈕額外 className */
  buttonClassName?: string;
  /** html2canvas scale，預設 2（圖片清晰、檔案不會太大） */
  scale?: number;
  /** 截圖背景色，預設 null（透明） */
  backgroundColor?: string | null;
}

export default function LineShareCard({
  children,
  title,
  text,
  url,
  fileName = 'ultra-advisor-share.png',
  label = '分享給客戶',
  className = '',
  buttonClassName = '',
  scale = 2,
  backgroundColor = null,
}: LineShareCardProps) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (sharing || !captureRef.current) return;
    setSharing(true);

    try {
      // 動態 import 避免每個工具進場就吃 30 KB
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;

      // 等一格 frame 讓字型 / 圖片就位
      await new Promise((r) => requestAnimationFrame(r));

      const canvas = await html2canvas(captureRef.current, {
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor,
        logging: false,
      });

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
          'image/png',
          0.95
        );
      });

      const file = new File([blob], fileName, { type: 'image/png' });

      // 偵測 iOS Chrome — Web Share API 對 files 有 bug、直接走文字路徑
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isIOSChrome = isIOS && /CriOS/.test(navigator.userAgent);

      const wantFiles = !isIOSChrome && canShareFiles([file]);

      const result = await shareViaSystem({
        title,
        text,
        url,
        files: wantFiles ? [file] : undefined,
      });

      if (result === 'shared') {
        toast.success('已開啟分享');
      } else if (result === 'fallback-line') {
        // 圖片無法跟 LINE share URL 走 — 給用戶下載圖片，文字部分透過 LINE 走
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.download = fileName;
          link.href = dataUrl;
          link.click();
          toast.info('已下載圖片，LINE 對話視窗請手動附上');
        } catch {
          toast.info('已開啟 LINE 分享');
        }
      }
    } catch (err) {
      console.error('[LineShareCard] capture/share failed:', err);
      toast.error('產生分享圖失敗，請稍後再試');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className={className}>
      <div ref={captureRef}>{children}</div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#06C755] to-[#04A847] text-white font-bold text-sm shadow-lg shadow-green-500/20 hover:shadow-green-500/40 transition-all disabled:opacity-60 active:scale-[0.98] ${buttonClassName}`}
        >
          {sharing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              產生分享圖中...
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              {label}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
