/**
 * 分享工具 - LINE 與 系統原生 share
 *
 * 為什麼建這支：
 *  - 14 工具會需要「分享給客戶」（最後一哩 onboarding）
 *  - mobile Safari / iOS Chrome 的 navigator.share 行為不一致、files 不一定能傳
 *  - 一律先試 navigator.share、失敗 fallback 到 LINE share URL scheme（顧問用戶最常用）
 *
 * 使用：
 *   shareToLine({ text: '我幫你算了一下...', url: 'https://...' });
 *   shareViaSystem({ title, text, url, files }).catch(() => shareToLine({ text, url }));
 *   if (canSystemShare()) { ... }
 */

export interface ShareToLinePayload {
  text: string;
  url?: string;
}

export interface ShareViaSystemPayload {
  title?: string;
  text: string;
  url?: string;
  files?: File[];
}

/**
 * 偵測瀏覽器是否支援 navigator.share
 * canShare 不一定全瀏覽器有（舊版 Android Chrome 只有 share 沒 canShare）
 * 所以這邊只要 navigator.share 是 function 就算可用
 */
export function canSystemShare(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.share === 'function';
}

/**
 * 偵測是否能 share 指定的 files（iOS Safari < 15 即使有 navigator.share 也不收 files）
 */
export function canShareFiles(files?: File[]): boolean {
  if (!files || files.length === 0) return true;
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files });
  } catch {
    return false;
  }
}

/**
 * 開 LINE 分享 URL（社群外掛官方端點，不需要 SDK 或登入）
 * 注意：LINE 的 lineit 只認 url 必填，純文字場景就把文字塞 url 後面 query
 */
export function shareToLine({ text, url }: ShareToLinePayload): Window | null {
  if (typeof window === 'undefined') return null;

  const shareUrl = url || 'https://ultra-advisor.tw';
  // LINE lineit 端點規格：?url=...&text=...
  // 沒有真的 deeplink scheme line:// 因 iOS Safari 對 universal link 跳轉嚴格
  const params = new URLSearchParams();
  params.set('url', shareUrl);
  if (text) params.set('text', text);

  const lineShareUrl = `https://social-plugins.line.me/lineit/share?${params.toString()}`;
  // 新分頁開（避免吃掉當前 SPA state）
  // 回傳 Window ref 給 caller 可偵測 popup-block（window.open 被擋會回 null、不會 throw）
  return window.open(lineShareUrl, '_blank', 'noopener,noreferrer');
}

/**
 * 用 navigator.share 分享，失敗或不支援時 fallback 到 shareToLine
 *
 * 回傳 'shared' | 'fallback-line' | 'cancelled'
 * - 'cancelled' 是用戶按取消（AbortError）
 * - 'shared' 是 system share sheet 成功收下
 * - 'fallback-line' 是退到 LINE 路徑
 */
export async function shareViaSystem(
  payload: ShareViaSystemPayload
): Promise<'shared' | 'fallback-line' | 'cancelled'> {
  const { title, text, url, files } = payload;

  // 沒 share API 直接走 LINE
  if (!canSystemShare()) {
    shareToLine({ text, url });
    return 'fallback-line';
  }

  // 有 files 但裝置不收，就降級成沒 files 的分享
  const useFiles = files && files.length > 0 && canShareFiles(files);

  try {
    const data: ShareData = {};
    if (title) data.title = title;
    if (text) data.text = text;
    if (url) data.url = url;
    if (useFiles) data.files = files;

    await navigator.share(data);
    return 'shared';
  } catch (err) {
    // 用戶按取消不算錯，不要 fallback（會二次跳出 LINE）
    if (err instanceof Error && err.name === 'AbortError') {
      return 'cancelled';
    }
    // 真正失敗才 fallback
    // 常見：iOS Safari 對 files 雖然 canShare 回 true 但 share 時 throw NotAllowedError
    if (useFiles) {
      // 試一次「沒 files 純文字」的 share
      try {
        const dataNoFiles: ShareData = {};
        if (title) dataNoFiles.title = title;
        if (text) dataNoFiles.text = text;
        if (url) dataNoFiles.url = url;
        await navigator.share(dataNoFiles);
        return 'shared';
      } catch (err2) {
        if (err2 instanceof Error && err2.name === 'AbortError') return 'cancelled';
        // 再失敗才 LINE
      }
    }
    shareToLine({ text, url });
    return 'fallback-line';
  }
}
