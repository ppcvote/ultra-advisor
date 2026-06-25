import React, { useState } from 'react';
import { X, Copy, MessageCircle, Check, AlertCircle } from 'lucide-react';
import { getAuth } from 'firebase/auth';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  isReferral: boolean;
}

// LINE 老闆官方帳號 ID（手動開通會員用）
// 為什麼是 ginrolladvisor 而非 ultraadvisor（公司客服 OA）：
//   - 訂單開通是老闆本人處理（不是客服信箱）、走老闆私人 OA 比較快
//   - 顧問付完款 → LINE 老闆 → 老闆在 Portaly 後台確認入帳 → 後台手動 set membershipLevel
const LINE_BOSS_OA_ID = 'ginrolladvisor';
// LINE OA deep link 規格：https://line.me/R/ti/p/@<oaId>（要帶 @）
// 過去寫成 line.me/R/ti/p/~xxx 是錯的（~ 是 lin.ee 短網址 prefix）— 參見 CustomerReportPage.tsx:1784 註解
const LINE_BOSS_URL = `https://line.me/R/ti/p/@${LINE_BOSS_OA_ID}`;
const PORTALY_BACKOFFICE_URL = 'https://portaly.cc/GinRollBT';

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, isReferral }) => {
  // copied 狀態用來顯示「已複製」回饋（2 秒後自動 reset）
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  if (!isOpen) return null;

  const iframeUrl = isReferral
    ? 'https://portaly.cc/embed/GinRollBT/product/hF1hHcEGbsp5VlbRsKWI'
    : 'https://portaly.cc/embed/GinRollBT/product/WsaTvEYOA1yqAQYzVZgy';

  // 取登入 email — runtime 拿（避免 modal mount 時 auth 還沒 ready）
  const getUserEmail = (): string | null => {
    try {
      return getAuth().currentUser?.email ?? null;
    } catch {
      return null;
    }
  };

  // 複製 email + 開 LINE
  // 為什麼一個 button 做兩件事：顧問付完款後最常見路徑就是「貼 email 給老闆」
  // 一鍵幫他複製好、再跳 LINE，省掉切 App 找 email 的步驟
  const handleCopyEmailAndOpenLine = async () => {
    const email = getUserEmail();
    // 預先寫好的訊息模板（顧問貼到 LINE 直接送，不用打字）
    const prefilledMessage = email
      ? `老闆好，我剛完成 Ultra Advisor ${isReferral ? '好友推薦價' : '年度訂閱'} 付款。\n註冊 email：${email}\nPortaly 訂單編號：（請貼上）\n麻煩開通會員，感謝！`
      : `老闆好，我剛完成 Ultra Advisor ${isReferral ? '好友推薦價' : '年度訂閱'} 付款。\n註冊 email：（請貼上）\nPortaly 訂單編號：（請貼上）\n麻煩開通會員，感謝！`;

    // 先試 clipboard（HTTPS + 用戶 gesture 內才行）
    try {
      if (email && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(email);
        setCopyState('copied');
      } else {
        // 沒 email 或不支援 clipboard 也別擋下一步、直接跳 LINE
        setCopyState(email ? 'failed' : 'idle');
      }
    } catch {
      setCopyState('failed');
    }

    // 直開 LINE OA deep link（lineit 端點是「分享到 timeline」、不是「私訊 OA」、無關此情境）
    window.open(LINE_BOSS_URL, '_blank', 'noopener,noreferrer');

    // 2 秒後 reset 複製狀態（避免顧問再點時看到舊狀態）
    setTimeout(() => setCopyState('idle'), 2000);

    // 註：prefilledMessage 目前 LINE OA ti/p 端點不支援預填、暫時只能複製 email
    // 未來若改 oaMessage 路徑（line.me/R/oaMessage/@id/?msg）可以預填
    void prefilledMessage;
  };

  // 直接開 LINE（不複製 email、不關 modal）
  const handleOpenLineOnly = () => {
    window.open(LINE_BOSS_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md overflow-hidden max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <div>
            <h3 className="text-lg font-black text-white">
              {isReferral ? '好友推薦價' : '年度訂閱'}
            </h3>
            <p className="text-xs text-slate-400">
              {isReferral ? '365 天 - $8,000（已折 $999）' : '365 天 - $8,999'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-all" aria-label="關閉">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Portaly 付款 iframe — 既有流程不動
            為什麼 height 用 clamp(360px, 50vh, 620px)：
              - 桌機 (viewport ≥ 1240px) → 50vh ≈ 620px、命中 max 上限、視覺與原本一致
              - 手機 844px viewport → 50vh = 422px、空出底部 ~400px 給 sticky LINE action bar
              - 360px floor 保護橫屏與超小螢幕 (≥ Portaly form 必要最小高度)
            不改 iframe src（任務鐵則）。 */}
        <div className="w-full" style={{ height: 'clamp(360px, 50vh, 620px)' }}>
          <iframe
            src={iframeUrl}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            title="付款頁面"
          />
        </div>

        {/* 開通流程說明 + LINE 引導 — 取代原本「自動開通」謊言
            sticky bottom-0：手機 viewport (844px) 上 iframe 縮短後、底下 action bar 仍貼底可見
            桌機 max-h-[95vh] 容器內 sticky 也不會影響佈局、因為 modal 已是 fixed 定位 */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/95 backdrop-blur sticky bottom-0 z-10 space-y-3">
          {/* 誠實說明：手動開通、24 小時內 */}
          <div className="flex items-start gap-2 p-3 bg-slate-900/60 rounded-xl border border-slate-700">
            <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-300 leading-relaxed">
              付款完成後請 LINE 老闆 <span className="font-mono text-amber-300">@{LINE_BOSS_OA_ID}</span>、
              提供您的<span className="text-white font-semibold">註冊 email</span>
              ＋ <span className="text-white font-semibold">Portaly 訂單編號</span>，
              我們會在 <span className="text-white font-semibold">24 小時內</span>手動為您開通會員權限。
            </p>
          </div>

          {/* 一鍵：複製 email + 開 LINE */}
          <button
            onClick={handleCopyEmailAndOpenLine}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/90 hover:bg-emerald-500 active:bg-emerald-600 text-white font-bold rounded-xl transition-all"
            type="button"
          >
            {copyState === 'copied' ? (
              <>
                <Check size={18} /> 已複製 email、正在開 LINE...
              </>
            ) : copyState === 'failed' ? (
              <>
                <MessageCircle size={18} /> 複製失敗、請手動複製 email
              </>
            ) : (
              <>
                <Copy size={18} /> 複製我的 email + 開啟 LINE
              </>
            )}
          </button>

          {/* 次要：只開 LINE（不複製、給沒登入或想自己貼的人） */}
          <button
            onClick={handleOpenLineOnly}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-sm rounded-xl transition-all"
            type="button"
          >
            <MessageCircle size={14} /> 只開 LINE（不複製 email）
          </button>

          {/* Portaly 後台連結（次要、給想自己查訂單的人） */}
          <a
            href={PORTALY_BACKOFFICE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-[11px] text-slate-500 hover:text-slate-300 underline underline-offset-2"
          >
            前往 Portaly 後台查訂單編號 →
          </a>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
