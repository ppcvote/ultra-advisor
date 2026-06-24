/**
 * 分享按鈕 - 純文字 / URL 分享
 *
 * 用法：
 *   <ShareButton title="退休缺口" text="..." url="https://..." variant="icon" />
 *   <ShareButton title="退休缺口" text="..." url="https://..." variant="full" />
 *
 * 為何不直接用 navigator.share：14 工具場景顧問常在桌面操作，需要 LINE fallback。
 * 圖片分享走 LineShareCard，這支只做文字 + URL。
 */

import React, { useState } from 'react';
import { Share2, Loader2 } from 'lucide-react';
import { shareViaSystem } from '../utils/shareToLine';
import { toast } from '../utils/toast';

interface ShareButtonProps {
  title?: string;
  text: string;
  url?: string;
  files?: File[];
  variant?: 'icon' | 'full';
  /** 自訂按鈕文字（只在 variant='full' 生效） */
  label?: string;
  /** 額外 className，會 merge 進按鈕 */
  className?: string;
  /** 分享完成後的 callback（不論是否 cancelled 都會呼叫） */
  onShared?: (result: 'shared' | 'fallback-line' | 'cancelled') => void;
}

export default function ShareButton({
  title,
  text,
  url,
  files,
  variant = 'icon',
  label = '分享給客戶',
  className = '',
  onShared,
}: ShareButtonProps) {
  const [sharing, setSharing] = useState(false);

  const handleClick = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const result = await shareViaSystem({ title, text, url, files });
      if (result === 'shared') {
        toast.success('已開啟分享');
      } else if (result === 'fallback-line') {
        toast.info('已開啟 LINE 分享');
      }
      onShared?.(result);
    } catch (err) {
      // shareViaSystem 本身會吞掉錯誤、走 LINE fallback
      // 真的拋出來代表 LINE fallback 都失敗（window.open 被擋等）
      console.error('[ShareButton] share failed:', err);
      toast.error('分享失敗，請手動複製內容');
    } finally {
      setSharing(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={sharing}
        aria-label={label}
        title={label}
        className={`inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:text-white hover:border-[#4DA3FF] transition-all disabled:opacity-50 ${className}`}
      >
        {sharing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Share2 className="w-4 h-4" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={sharing}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#06C755] to-[#04A847] text-white font-bold text-sm shadow-lg shadow-green-500/20 hover:shadow-green-500/40 transition-all disabled:opacity-60 active:scale-[0.98] ${className}`}
    >
      {sharing ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          分享中...
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4" />
          {label}
        </>
      )}
    </button>
  );
}
