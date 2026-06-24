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
import { shareToLine, canSystemShare } from '../utils/shareToLine';
import {
  encodeCustomerReport,
  toolToSlug,
  type AdvisorSnippet,
  type CustomerReportPayload,
  type CustomerReportTool,
} from '../lib/customerReport';

// Sprint 8 A: extract (inputs, outputs) shape per tool tag from the
// discriminated union. Caller passes tool="big_small_reservoir" →
// inputs/outputs get narrowed to that branch automatically. Distributing
// the props type over the union lets a single export type cover all 4
// tools while keeping tool/inputs/outputs strictly correlated.
type PayloadFor<T extends CustomerReportTool> = Extract<
  CustomerReportPayload,
  { tool: T }
>;

export type ShareToCustomerButtonProps = {
  [T in CustomerReportTool]: {
    /** 工具識別（內部 snake_case）；slug 由 codec 自動轉 */
    tool: T;
    /** 工具輸入 — shape 由 tool tag narrow */
    inputs: PayloadFor<T>['inputs'];
    /** 工具計算結果 — shape 由 tool tag narrow */
    outputs: PayloadFor<T>['outputs'];
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
  };
}[CustomerReportTool];

// URL 太長會被 LINE in-app browser 截斷、Android 也可能爆 intent uri。
// 2000 是 IE 歷史下限、一般瀏覽器其實能撐 ~8000，2000 留 buffer 給之後加欄位。
const URL_WARNING_THRESHOLD = 2000;

// 預設值，AdvisorSnippet.name 強制 string，無設定時退回中性稱呼避免 leak Firebase displayName
const ANON_ADVISOR_NAME = '您的財務顧問';

// 顧問可能在 signatureName / lineDisplayName 裡塞「王大明 0912-xxx-xxx」之類的聯絡資訊
// 一旦這串字進 customerReport.advisor.name → 客戶端 readonly 頁照印 → 顧問的私人號碼/email 被任何拿到 URL 的人看到
// 這支 sanitizer 把常見聯絡資訊 pattern 替成 'X' 後再走後續流程
// 注意：不在 codec 內做（codec 是 pure），讀 Firestore 的入口（getAdvisorProfile）才是攔截點
const NAME_MAX_LEN = 40; // 名片上不會塞超過 40 字、合理上限
// 連字號/空白分隔的電話 (0912-345-678 / 0912 345 678)，至少 8 個 digit 之間只能間 - 或空白
const PHONE_LIKE_RE = /(?:\d[\s-]?){7,}\d/g;
// email：local-part + @ + domain，整段 strip
const EMAIL_LIKE_RE = /[\w.+-]*@\S+/g;
// 為什麼要 \b 跟強制 [:：] 分隔符：critic 抓到 'Pauline / Caroline / Lineage / Aline'
// 名字會誤被 strip。加 \b 確保 'line' 是獨立詞、強制冒號要 'LINE:xxx' 才算 ID
const LINE_ID_RE = /\bline\s*[:：]\s*\S+/gi;
const TEL_PREFIX_RE = /\btel\s*[:：]\s*\S+/gi;

/**
 * sanitizeAdvisorName — 把 advisor 顯示名字裡的聯絡資訊 strip 掉
 *
 * 為什麼這樣處理：
 *  - 顧問 onboarding 的 displayName 欄是 free-text、無 placeholder hint 不踩雷
 *  - 比 strict validation block 提交更友善：他繼續用、我們默默 strip 後再 serialize
 *  - 替成 'X' 而非整段刪除，是為了讓顧問之後看到客戶端結果頁能注意到自己塞了不該塞的
 *
 * @param raw 從 Firestore 撈出的原始字串
 * @returns 清理過的名字；空字串 → fallback ANON_ADVISOR_NAME
 */
export function sanitizeAdvisorName(raw: string): string {
  if (typeof raw !== 'string') return ANON_ADVISOR_NAME;
  try {
    let s = raw;
    // 順序：先 prefix-style（line:/tel:）再 email 再裸電話 — 否則 'line:0912xxxx' 被裸電話正則先吃掉只剩 'line:X'
    s = s.replace(LINE_ID_RE, 'X');
    s = s.replace(TEL_PREFIX_RE, 'X');
    s = s.replace(EMAIL_LIKE_RE, 'X');
    s = s.replace(PHONE_LIKE_RE, 'X');
    // 連續空白合一（前面 replace 可能留下「王大明  X」這種雙空白）
    s = s.replace(/\s+/g, ' ').trim();
    // 截斷 — 不切斷半個 X、長度算字元數
    if (s.length > NAME_MAX_LEN) {
      s = s.slice(0, NAME_MAX_LEN) + '...';
    }
    return s.length > 0 ? s : ANON_ADVISOR_NAME;
  } catch {
    // 正則 / slice 失敗（理論上不會）→ 不阻斷分享流程，退中性稱呼
    return ANON_ADVISOR_NAME;
  }
}

/**
 * getDisplayName — 對外 helper，AdvisorBar / 其他元件可直接用
 * 同樣的 sanitize 邏輯、避免散落兩套規則 drift
 */
export function getDisplayName(raw: string): string {
  return sanitizeAdvisorName(raw);
}

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

    // sanitize 顧問可能塞進 displayName 的電話 / email / LINE id（critic#4 Sprint 7）
    // 順序仍是 signatureName > lineDisplayName，兩個都過 sanitize 再 fallback ANON
    const signatureNameRaw =
      typeof data.signatureName === 'string' && data.signatureName.trim()
        ? sanitizeAdvisorName(data.signatureName)
        : '';
    const lineDisplayNameRaw =
      typeof data.lineDisplayName === 'string' && data.lineDisplayName.trim()
        ? sanitizeAdvisorName(data.lineDisplayName)
        : '';
    // sanitizeAdvisorName 在輸入是 PII-heavy 時可能回 ANON_ADVISOR_NAME，視同未設
    const signatureName = signatureNameRaw && signatureNameRaw !== ANON_ADVISOR_NAME ? signatureNameRaw : undefined;
    const lineDisplayName = lineDisplayNameRaw && lineDisplayNameRaw !== ANON_ADVISOR_NAME ? lineDisplayNameRaw : undefined;
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

      // 5. 分享流程（Sprint 8 F：以「直接送出去」為主、clipboard 是最後手段）
      //
      // 為什麼這個順序：dogfood critic 反映 Sprint 7 的「自動複製 → 顧問自己 paste 到 LINE」
      //   比 Sprint 5 ShareButton 還難用（多一個 paste 動作）。
      //
      // 4 段優先順序（fall-through）：
      //   (a) mobile / 支援 navigator.share 的桌機 → 系統 share sheet（LINE 通常在 list 內可直選）
      //   (b) 桌機沒 share API → LINE share URL scheme（新分頁開 LINE 分享頁）
      //   (c) 連 LINE share URL 都打不開（極罕見 popup blocker 全擋）→ clipboard
      //   (d) clipboard 也失敗 → toast.error
      //
      // 鐵則：成功的 share intent 不要再 toast.success — OS 已經接管 UI（顧問會被 share sheet 佔滿螢幕）
      //       toast 只在 fallback path 出現、讓顧問知道「我下一步要做什麼」
      const labelText = reportLabel || '試算結果';
      const timeStr = new Date(generatedAt).toLocaleTimeString('zh-TW', {
        hour: '2-digit', minute: '2-digit',
      });
      const shareTitle = '我為您準備的試算結果';
      const shareText = `我幫你做了${labelText}，點連結看試算：`;

      let handled = false;

      // (a) navigator.share — mobile 走系統 share sheet
      // Sprint 5 教訓：不要傳 files，mobile Safari 對 files 支援不一致
      if (canSystemShare()) {
        try {
          await navigator.share({ title: shareTitle, text: shareText, url });
          handled = true; // share sheet 已彈、OS 接管，不要再 toast
        } catch (shareErr) {
          // AbortError = 使用者按取消，視為已處理（不要再 fallback、不要再彈 LINE）
          if (shareErr instanceof Error && shareErr.name === 'AbortError') {
            handled = true;
          }
          // 其他錯誤（NotAllowedError 等）→ 繼續 fallback 到 (b)
        }
      }

      // (b) LINE share URL scheme — 桌機 / 沒 navigator.share 的環境
      // window.open 被擋會回 null 而非 throw，必須檢查 ref 才算成功
      // (critic engineering #5: 之前 try/catch 永遠 false handled、silent 失敗 clipboard 不會走)
      if (!handled) {
        const w = shareToLine({ text: shareText, url });
        if (w) {
          handled = true;
          toast.info(`已開啟 LINE 分享（${labelText}，${timeStr} 產生）`);
        }
        // null = popup blocked，繼續 (c) clipboard fallback
      }

      // (c) clipboard fallback — 連 LINE 都打不開時最後的手段
      if (!handled) {
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(url);
            handled = true;
            toast.success(`已複製客戶連結（${labelText}，${timeStr} 產生、90 天有效），請貼至 LINE`);
          }
        } catch {
          // clipboard 也失敗 → (d)
        }
      }

      // (d) 全失敗 — 不靜默
      if (!handled) {
        toast.error('無法開啟分享，請手動複製網址列');
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
