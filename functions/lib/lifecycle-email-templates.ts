/**
 * Ultra Advisor — Lifecycle Email Templates (D0 / D2 / D4 / D5 / D6)
 *
 * SCOPE: THIS FILE IS TEMPLATES ONLY. NO TRIGGERS, NO SENDS, NO CRON.
 *
 * The triggering logic (Cloud Scheduler / Pub/Sub / onUpdate) lives in
 * `functions/index.js` and is intentionally NOT shipped in this sprint —
 * Cloud Functions cold-starts + per-invocation cost is a risk we'd rather
 * vet with deliberate review (see CLAUDE.md "Vercel Serverless 陷阱" +
 * "成本 + cold-start 風險" guard). Next sprint owner will wire:
 *
 *   1. Cloud Scheduler job → Pub/Sub topic `lifecycle-email-tick` (hourly)
 *   2. functions/index.js subscriber: query `users` where
 *        createdAt ∈ [now-D-1d, now-D]  AND  lastLifecycleStage < D
 *      then render via getLifecycleTemplate() + dispatch via Resend.
 *   3. Set users/{uid}.lifecycleStage = D after each successful send so
 *      we never double-send.
 *
 * Placeholder convention: {{displayName}}, {{daysRemaining}}, {{ctaUrl}}.
 * Caller is responsible for interpolation — keep this file pure data so
 * unit tests don't need a runtime.
 *
 * Tone rule: conservative, no fake urgency, no "限時優惠！" — Min Yi's
 * brand-bomb prune already killed that voice on the marketing site, the
 * email channel must match. If you can't justify a sentence with evidence,
 * delete it.
 */

export type LifecycleStage =
  | 'welcome'         // D0 — register success
  | 'no_client_yet'   // D2 — still 0 clients
  | 'aha_reminder'    // D4 — 14 個工具未啟用過任何一個
  | 'trial_countdown' // D5 — 試用期剩 2 天（假設 7 天試用）
  | 'trial_ending';   // D6 — 試用期最後一天

export interface LifecycleTemplate {
  stage: LifecycleStage;
  subject: string; // 已含 placeholder，由 caller interpolate
  preheader: string; // 信件預覽（Gmail/Outlook inbox 灰字）
  html: string;
  text: string; // 純文字 fallback（Resend 建議同時帶 text）
}

// ============================================================
// D0 — Welcome（註冊成功即時寄）
// ============================================================
const welcome: LifecycleTemplate = {
  stage: 'welcome',
  subject: 'Hi {{displayName}}，Ultra Advisor 帳號已就緒',
  preheader: '3 個示範客戶已建好，你可以直接拿來練手',
  html: `
<!doctype html>
<html lang="zh-Hant"><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:22px;margin:0 0 16px;">Hi {{displayName}}，</h1>
  <p>歡迎加入 Ultra Advisor。為了讓你不用從空白畫面開始，我們已經幫你建好 3 個示範客戶：</p>
  <ul style="padding-left:20px;color:#374151;">
    <li>王太太（45 歲家庭主婦）— 適合練「黃金保險箱」和「退休缺口」</li>
    <li>林先生（32 歲科技業）— 適合練「金融房產」和「超積極存錢」</li>
    <li>陳老闆（58 歲將退休）— 適合練「稅務傳承」</li>
  </ul>
  <p>登入後在戰情室「快速上手任務」可以一步步把帳號跑起來，預計 10 分鐘。</p>
  <p style="margin-top:24px;"><a href="{{ctaUrl}}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">進入戰情室</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">
  <p style="font-size:12px;color:#6b7280;">若這封信不是你預期的，你可以直接忽略；我們不會再寄第二封歡迎信。<br>
  Ultra Advisor · 傲創實業</p>
</body></html>
  `.trim(),
  text: `Hi {{displayName}}，

歡迎加入 Ultra Advisor。為了讓你不用從空白畫面開始，我們已經幫你建好 3 個示範客戶：
- 王太太（45 歲家庭主婦）
- 林先生（32 歲科技業）
- 陳老闆（58 歲將退休）

登入後在戰情室「快速上手任務」可以一步步把帳號跑起來，預計 10 分鐘。

進入戰情室：{{ctaUrl}}

—
Ultra Advisor · 傲創實業`,
};

// ============================================================
// D2 — 還沒新增第一位「真正」客戶
// ============================================================
const noClientYet: LifecycleTemplate = {
  stage: 'no_client_yet',
  subject: '{{displayName}}，要不要直接把示範客戶替換成你自己的？',
  preheader: '示範客戶可以隨時刪除；真客戶 30 秒就能加',
  html: `
<!doctype html>
<html lang="zh-Hant"><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:22px;margin:0 0 16px;">把示範客戶換成真的</h1>
  <p>Hi {{displayName}}，</p>
  <p>看到你還在用我們預設的 3 個示範客戶。沒問題，那本來就是讓你練手用的；但如果你有真實客戶資料要處理，建議：</p>
  <ol style="padding-left:20px;color:#374151;">
    <li>戰情室 → 客戶 → 新增客戶（30 秒）</li>
    <li>把示範客戶刪掉（卡片右上 hover → 垃圾桶）</li>
    <li>進工具，跑一份真實情境試算</li>
  </ol>
  <p>真實客戶資料一筆都不會傳給第三方分析、不會用來訓練 AI，這是合約寫明的（<a href="{{privacyUrl}}">隱私權政策</a>）。</p>
  <p style="margin-top:24px;"><a href="{{ctaUrl}}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">新增第一位客戶</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">
  <p style="font-size:12px;color:#6b7280;">不需要這類提醒？<a href="{{unsubscribeUrl}}">點此關閉產品提醒信</a>。</p>
</body></html>
  `.trim(),
  text: `Hi {{displayName}}，

看到你還在用我們預設的 3 個示範客戶。沒問題，那本來就是讓你練手用的；如果你有真實客戶要處理，建議：

1. 戰情室 → 客戶 → 新增客戶
2. 把示範客戶刪掉
3. 進工具跑一份真實情境試算

真實客戶資料不會傳給第三方、不會用來訓練 AI（{{privacyUrl}}）。

新增第一位客戶：{{ctaUrl}}

不需要這類提醒？{{unsubscribeUrl}}`,
};

// ============================================================
// D4 — Aha-moment 提醒（14 個工具都沒打開過）
// ============================================================
const ahaReminder: LifecycleTemplate = {
  stage: 'aha_reminder',
  subject: '{{displayName}}，5 分鐘看一下「黃金保險箱」會發生什麼',
  preheader: '不需要輸入任何敏感資料，純試算',
  html: `
<!doctype html>
<html lang="zh-Hant"><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:22px;margin:0 0 16px;">第一次試算，建議從這個工具開始</h1>
  <p>Hi {{displayName}}，</p>
  <p>我們發現你帳號開通 4 天，但 14 個工具都還沒打開過。Ultra Advisor 的價值 90% 在試算結果，光看介面看不出來。</p>
  <p>建議最快的入門路徑：</p>
  <ul style="padding-left:20px;color:#374151;">
    <li>戰情室 → 點「示範｜王太太」</li>
    <li>左側導覽 → 「黃金保險箱理論」</li>
    <li>什麼都不用改，直接看右側圖表</li>
  </ul>
  <p>大概 5 分鐘。如果跑完還是覺得用不上，這封信就是我們最後一次打擾你。</p>
  <p style="margin-top:24px;"><a href="{{ctaUrl}}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">打開黃金保險箱</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">
  <p style="font-size:12px;color:#6b7280;"><a href="{{unsubscribeUrl}}">關閉產品提醒信</a></p>
</body></html>
  `.trim(),
  text: `Hi {{displayName}}，

我們發現你帳號開通 4 天，但 14 個工具都還沒打開過。Ultra Advisor 的價值 90% 在試算結果，光看介面看不出來。

最快入門路徑：
1. 戰情室 → 點「示範｜王太太」
2. 左側 → 「黃金保險箱理論」
3. 直接看圖表，不用改任何參數

大概 5 分鐘。跑完還是覺得用不上，這封信就是最後一次打擾。

打開黃金保險箱：{{ctaUrl}}

關閉提醒：{{unsubscribeUrl}}`,
};

// ============================================================
// D5 — 試用倒數（剩 2 天）
// ============================================================
const trialCountdown: LifecycleTemplate = {
  stage: 'trial_countdown',
  subject: '{{displayName}}，試用剩 {{daysRemaining}} 天',
  preheader: '不續訂也沒關係，資料會保留 30 天',
  html: `
<!doctype html>
<html lang="zh-Hant"><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:22px;margin:0 0 16px;">試用剩 {{daysRemaining}} 天</h1>
  <p>Hi {{displayName}}，</p>
  <p>提醒你的試用期還剩 {{daysRemaining}} 天。幾件你可能想知道的：</p>
  <ul style="padding-left:20px;color:#374151;">
    <li>到期不續訂 → 帳號降為免費版，但 14 個工具中的 4 個基礎款仍可用</li>
    <li>已建客戶資料會保留 30 天，期間升級隨時可救回</li>
    <li>付費方案 Beta 階段請 LINE <a href="https://line.me/R/oaMessage/%40ginrolladvisor/?text=想了解付費方案">@ginrolladvisor</a> 詢問，無綁約</li>
  </ul>
  <p>不需要硬推銷，純粹讓你知道時程。</p>
  <p style="margin-top:24px;"><a href="{{ctaUrl}}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">看付費方案</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">
  <p style="font-size:12px;color:#6b7280;"><a href="{{unsubscribeUrl}}">關閉產品提醒信</a></p>
</body></html>
  `.trim(),
  text: `Hi {{displayName}}，

試用剩 {{daysRemaining}} 天。幾件你可能想知道的：

- 不續訂 → 降為免費版，4 個基礎工具仍可用
- 客戶資料保留 30 天，期間升級可救回
- 付費方案 Beta 階段請 LINE @ginrolladvisor 詢問，無綁約

看付費方案：{{ctaUrl}}

關閉提醒：{{unsubscribeUrl}}`,
};

// ============================================================
// D6 — 試用最後一天
// ============================================================
const trialEnding: LifecycleTemplate = {
  stage: 'trial_ending',
  subject: '{{displayName}}，試用今天結束',
  preheader: '不續訂沒關係，資料留 30 天',
  html: `
<!doctype html>
<html lang="zh-Hant"><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:22px;margin:0 0 16px;">試用今天結束</h1>
  <p>Hi {{displayName}}，</p>
  <p>不續訂沒關係，這是最後一封提醒信。明天起：</p>
  <ul style="padding-left:20px;color:#374151;">
    <li>帳號自動降為免費版（4 個基礎工具）</li>
    <li>客戶資料 30 天內升級可救回</li>
    <li>不會自動扣款（我們沒拿到你的信用卡）</li>
  </ul>
  <p>如果這 7 天有任何體驗問題，歡迎直接回信告訴我們。</p>
  <p style="margin-top:24px;"><a href="{{ctaUrl}}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">續訂方案</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">
  <p style="font-size:12px;color:#6b7280;"><a href="{{unsubscribeUrl}}">關閉產品提醒信</a></p>
</body></html>
  `.trim(),
  text: `Hi {{displayName}}，

試用今天結束。不續訂沒關係，這是最後一封提醒信。明天起：

- 自動降為免費版（4 個基礎工具）
- 客戶資料 30 天內升級可救回
- 不會自動扣款（我們沒拿信用卡）

如果這 7 天有體驗問題，歡迎回信告訴我們。

續訂：{{ctaUrl}}

關閉提醒：{{unsubscribeUrl}}`,
};

const TEMPLATES: Record<LifecycleStage, LifecycleTemplate> = {
  welcome,
  no_client_yet: noClientYet,
  aha_reminder: ahaReminder,
  trial_countdown: trialCountdown,
  trial_ending: trialEnding,
};

/**
 * Pure lookup — no side effects, no I/O. Caller (future scheduler) does
 * the interpolation + dispatch.
 */
export function getLifecycleTemplate(stage: LifecycleStage): LifecycleTemplate {
  return TEMPLATES[stage];
}

export const LIFECYCLE_STAGES: LifecycleStage[] = [
  'welcome',
  'no_client_yet',
  'aha_reminder',
  'trial_countdown',
  'trial_ending',
];
