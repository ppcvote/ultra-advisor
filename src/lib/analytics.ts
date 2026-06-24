/**
 * Analytics wrapper — PostHog + type-safe events
 *
 * Why a wrapper instead of calling posthog directly:
 *   - We need a no-op path when VITE_POSTHOG_KEY is missing (dev / preview)
 *   - We want one place to add masking / sampling / migration later
 *   - Callers shouldn't import posthog-js everywhere (bundle bloat)
 *
 * Session replay is enabled with maskAllInputs:true — finance forms contain
 * income / loan balances / client names; we do NOT want raw form values
 * leaving the browser.
 */

import posthog from 'posthog-js';

let initialized = false;
let active = false;

export function initAnalytics(): void {
  if (initialized) return;
  initialized = true;

  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  const host =
    (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ||
    'https://us.i.posthog.com';

  if (!key) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[analytics] VITE_POSTHOG_KEY not set — PostHog disabled (no-op)');
    }
    return;
  }

  try {
    posthog.init(key, {
      api_host: host,
      // 為什麼 autocapture 限制到 a/button：
      //   PostHog 預設 autocapture 會抓所有 click target 的 text，
      //   而工具裡的客戶列表按鈕 (e.g. <button>示範｜王太太</button>) 會把
      //   客戶姓名上傳到 PostHog，是個資外洩風險。限制 elements + 個別點
      //   加 data-ph-no-capture 退路。
      autocapture: {
        element_allowlist: ['a', 'button'],
        css_selector_allowlist: ['[data-ph-track]'],
      },
      capture_pageview: true,
      // Session replay — 為什麼採取 mask-all 策略：
      //   maskAllInputs 只 mask <input>/<textarea> 的 value，
      //   但工具裡客戶姓名 / 金額 / 保單金額是 <div>/<span> 靜態文字，
      //   會被 rrweb 全文 capture → 個資法 §27 風險。改成 maskTextContent
      //   全屏 mask、再用 data-ph-no-mask 標出可解 mask 的 chrome (nav/footer)
      session_recording: {
        maskAllInputs: true,
        maskTextContent: true,
        maskTextSelector: '*',
      },
      disable_session_recording: false,
      loaded: () => {
        active = true;
      },
    });
  } catch (err) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[analytics] init failed:', err);
    }
  }
}

/**
 * Track a discrete event. Safe to call before init — becomes a no-op.
 */
export function trackEvent(name: string, props?: Record<string, unknown>): void {
  if (!active) return;
  try {
    posthog.capture(name, props);
  } catch {
    /* swallow */
  }
}

/**
 * Bind the current Firebase uid (or other stable id) to the PostHog person.
 * Pass a $set object for user properties (acquisition, plan, etc.).
 */
export function identify(
  distinctId: string,
  props?: Record<string, unknown>
): void {
  if (!active) return;
  try {
    posthog.identify(distinctId, props);
  } catch {
    /* swallow */
  }
}

/**
 * Update person-level properties without re-identifying.
 * Useful when membership / plan changes mid-session.
 */
export function setProps(props: Record<string, unknown>): void {
  if (!active) return;
  try {
    posthog.setPersonProperties(props);
  } catch {
    /* swallow */
  }
}

/**
 * Clear identity on logout so the next user doesn't inherit the previous one.
 */
export function resetIdentity(): void {
  if (!active) return;
  try {
    posthog.reset();
  } catch {
    /* swallow */
  }
}
