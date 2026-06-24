/**
 * 產生客戶分享連結按鈕（Sprint 7 F MVF）
 *
 * 為什麼這支獨立於 ShareButton：
 *  - ShareButton 只送 text + URL 到 LINE，客戶端看不到計算結果視覺
 *  - 這支會先把 inputs + outputs 編碼進 /r/<tool> URL，客戶 click 進來看 readonly 試算
 *  - 顧問端 onClick → 取 timestamp → 拉 advisor profile（lineDisplayName/signatureName/licenses）→ 編碼 → 複製 / LINE 分享
 *
 * 為什麼不直接拿 auth.currentUser.displayName：
 *  - Sprint 5 critic-fix 已抓過 PII leak — firebase 本名常是真名 / Email
 *  - 改讀 users/{uid} 的 lineDisplayName / signatureName，顧問自己設過才露出
 *  - 都沒設 → AdvisorBar 退回顯示 '—'，不會 leak 真名
 *
 * 為什麼用 src/lib/customerReport（不是 src/utils/customerReport）：
 *  - CustomerReportPage 的解碼端讀的是 lib 版（含 v: 1 schema version + slug↔tool map）
 *  - 兩支 codec 並存會 silent 對不上、客戶 click 進去看到「連結無效」
 *  - 改寫成 lib 版 = 編碼端、解碼端對齊
 */

import React, { useState } from 'react';
import { Link2, Loader2, Send } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { toast } from '../utils/toast';
import { shareToLine } from '../utils/shareToLine';
import {
  encodeCustomerReport,
  toolToSlug,
  type AdvisorSnippet,
  type CustomerReportPayload,
  type CustomerReportTool,
  type LaborPensionPayload,
} from '../lib/customerReport';

export interface ShareToCustomerButtonProps {
  /** 工具識別（內部 snake_case）；slug 由 codec 自動轉 */
  tool: CustomerReportTool;
  /** 工具輸入；shape 必須對齊 LaborPensionPayload['inputs'] */
  inputs: LaborPensionPayload['inputs'];
  /** 工具計算結果 */
  outputs: LaborPensionPayload['outputs'];
  /**
   * Override advisor 物件；MVF 場景通常不傳，靠內部 getAdvisorProfile 從 Firestore 撈。
   * 已知 advisor 的場景（測試 / 預覽）才會帶。
   */
  advisor?: AdvisorSnippet;
  /** Toast 文案用的工具中文標籤，例 '退休缺口分析' */
  reportLabel?: string;
  /** 'full' 與 Sprint 5 ShareButton 並列；'icon' 簡版 */
  variant?: 'full' | 'icon';
  /** 自訂按鈕文字（只 variant='full' 生效） */
  label?: string;
  className?: string;
}

// URL 太長會被 LINE in-app browser 截斷、Android 也可能爆 intent uri。
// 2000 是 IE 歷史下限、一般瀏覽器其實能撐 ~8000，2000 留 buffer 給之後加欄位。
const URL_WARNING_THRESHOLD = 2000;

// 預設值，AdvisorSnippet.name 強制 string，無設定時退回中性稱呼避免 leak Firebase displayName
const ANON_ADVISOR_NAME = '您的財務顧問';

/**
 * 從 Firestore users/{uid} 撈顧問展示資訊，轉成 AdvisorSnippet shape。
 *
 * 為什麼不從 props 直接灌：避免每個工具呼叫端都要記得手動傳，
 * 且 advisor profile 是顧問層級的設定，不該綁在工具 props 裡。
 *
 * 規則：
 *  - 沒登入 → name 退中性、其他空
 *  - name 優先順序：signatureName > lineDisplayName（這兩個是顧問自己設過的）
 *  - 不 fallback 到 auth.displayName（避免 PII leak）
 *  - licenses 撈 array 後 join ', '（lib codec 用 string 不用 string[]）
 *  - companyName trim 後保留
 */
async function getAdvisorProfile(uid: string): Promise<AdvisorSnippet> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return { name: ANON_ADVISOR_NAME };
    const data = snap.data() as Record<string, unknown>;

    const signatureName =
      typeof data.signatureName === 'string' && data.signatureName.trim()
        ? data.signatureName.trim()
        : undefined;
    const lineDisplayName =
      typeof data.lineDisplayName === 'string' && data.lineDisplayName.trim()
        ? data.lineDisplayName.trim()
        : undefined;
    const name = signatureName || lineDisplayName || ANON_ADVISOR_NAME;

    const licensesArr = Array.isArray(data.licenses)
      ? (data.licenses as unknown[])
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          .map((x) => x.trim())
      : [];
    const licenses = licensesArr.length > 0 ? licensesArr.join(', ') : undefined;

    const companyName =
      typeof data.companyName === 'string' && data.companyName.trim()
        ? data.companyName.trim()
        : undefined;

    return { name, licenses, companyName };
  } catch {
    // silent — 沒抓到就 anonymous，不要阻斷分享流程
    return { name: ANON_ADVISOR_NAME };
  }
}

export default function ShareToCustomerButton({
  tool,
  inputs,
  outputs,
  advisor: advisorOverride,
  reportLabel,
  variant = 'full',
  label = '產生客戶連結',
  className = '',
}: ShareToCustomerButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;

    // 個資法 §5、§19：顧問把客戶試算資料嵌入公開 URL 前需同意
    // 每個 session 提示一次（sessionStorage、不 localStorage 因為合規角度保守）
    // 顧問點過知道風險後該 session 不再擋
    try {
      if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem('ack_share_consent')) {
        const ok = window.confirm(
          '您即將產生包含客戶試算資料的公開連結（含金額、年齡、退休假設）。\n' +
          '連結可被任何取得網址者查看（無登入保護、90 天後自動失效）。\n\n' +
          '請確認已取得客戶同意分享此資料。確認繼續？'
        );
        if (!ok) return;
        sessionStorage.setItem('ack_share_consent', '1');
      }
    } catch { /* sessionStorage 不可用就跳過 */ }

    setBusy(true);
    try {
      // 1. runtime 取 timestamp（鐵則：不在 codec 內取，這裡才是 click 真實發生時刻）
      const generatedAt = Date.now();

      // 2. 拿 advisor profile — 優先 props override（測試用），否則 Firestore 撈
      let advisor: AdvisorSnippet = advisorOverride ?? { name: ANON_ADVISOR_NAME };
      if (!advisorOverride) {
        const uid = auth.currentUser?.uid;
        if (uid) {
          advisor = await getAdvisorProfile(uid);
        }
      }

      // 3. 組 payload + 連結（lib codec 要求 v: 1）
      const payload: CustomerReportPayload = {
        tool,
        inputs,
        outputs,
        advisor,
        generatedAt,
        v: 1,
      };

      const encoded = encodeCustomerReport(payload);
      const origin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : '';
      if (!origin) {
        toast.error('無法產生連結，請重試');
        return;
      }
      const url = `${origin}/r/${toolToSlug(tool)}?d=${encoded}`;

      // 4. URL 超長警告（仍可分享，只是提醒顧問之後加欄位要瘦身）
      if (url.length > URL_WARNING_THRESHOLD) {
        toast.warning(`連結偏長（${url.length} 字元），LINE 仍可分享`);
      }

      // 5. 複製 — clipboard 失敗（http / 權限）退而求其次給 LINE 分享
      const labelText = reportLabel || '試算結果';
      // toast 訊息列實際資訊（Sprint 6 critic 教訓：誤點當下能看到複製內容）
      const timeStr = new Date(generatedAt).toLocaleTimeString('zh-TW', {
        hour: '2-digit', minute: '2-digit',
      });
      try {
        if (
          typeof navigator !== 'undefined' &&
          navigator.clipboard?.writeText
        ) {
          await navigator.clipboard.writeText(url);
          toast.success(`已複製客戶連結（${labelText}，${timeStr} 產生、90 天有效）`);
        } else {
          throw new Error('clipboard unavailable');
        }
      } catch {
        // 沒 clipboard → 直接開 LINE 分享 sheet
        shareToLine({
          text: `我幫你做了${labelText}，點連結看試算：`,
          url,
        });
        toast.info(`已開啟 LINE 分享（${labelText}，${timeStr} 產生）`);
      }
    } catch (err) {
      // 不要把 err object 整個 log（可能含 closure scope 的 payload → Sentry breadcrumb 風險）
      console.error('[ShareToCustomerButton] failed');
      toast.error('產生連結失敗，請重試');
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-label={label}
        title={label}
        className={`inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:text-white hover:border-[#4DA3FF] transition-all disabled:opacity-50 ${className}`}
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Link2 className="w-4 h-4" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#4DA3FF] to-[#2E6BFF] text-white font-bold text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all disabled:opacity-60 active:scale-[0.98] ${className}`}
    >
      {busy ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          產生中...
        </>
      ) : (
        <>
          <Send className="w-4 h-4" />
          {label}
        </>
      )}
    </button>
  );
}
