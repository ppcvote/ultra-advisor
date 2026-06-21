/**
 * 全站 toast 工具
 *
 * 用法：
 *   import { toast } from '@/utils/toast';
 *   toast.success('儲存成功');
 *   toast.error('儲存失敗');
 *   toast.info('提示文字');
 *
 * 設計：用一個 mount 在 body 的 div + 直接操作 DOM
 *      避免依賴第三方 toast 庫、避免要每個 Provider/Context
 *      iOS Safari 不會顯示「ultra-advisor.tw 顯示」對話框
 */

type ToastType = 'success' | 'error' | 'info' | 'warning';

const ICON: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '!',
};

const COLOR: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: 'rgba(16,185,129,.15)', border: 'rgba(16,185,129,.4)', icon: '#10b981' },
  error:   { bg: 'rgba(239,68,68,.15)',  border: 'rgba(239,68,68,.4)',  icon: '#ef4444' },
  info:    { bg: 'rgba(59,130,246,.15)', border: 'rgba(59,130,246,.4)', icon: '#3b82f6' },
  warning: { bg: 'rgba(245,158,11,.15)', border: 'rgba(245,158,11,.4)', icon: '#f59e0b' },
};

let containerEl: HTMLDivElement | null = null;

function ensureContainer(): HTMLDivElement {
  if (containerEl && document.body.contains(containerEl)) return containerEl;
  containerEl = document.createElement('div');
  containerEl.id = 'ultra-toast-container';
  Object.assign(containerEl.style, {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '99999',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    pointerEvents: 'none',
    width: 'max-content',
    maxWidth: 'calc(100vw - 40px)',
  } as CSSStyleDeclaration);
  document.body.appendChild(containerEl);
  return containerEl;
}

function showToast(message: string, type: ToastType = 'info', durationMs = 3000) {
  if (typeof window === 'undefined' || !document?.body) {
    // SSR / 不可用時 fallback 到 console
    console.log(`[toast.${type}]`, message);
    return;
  }
  const container = ensureContainer();
  const color = COLOR[type];

  const el = document.createElement('div');
  el.role = 'alert';
  Object.assign(el.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 18px',
    background: color.bg,
    border: `1px solid ${color.border}`,
    borderRadius: '12px',
    color: '#f8fafc',
    fontSize: '14px',
    fontWeight: '500',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,.4)',
    pointerEvents: 'auto',
    transition: 'opacity .25s ease, transform .25s ease',
    opacity: '0',
    transform: 'translateY(-10px)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  } as CSSStyleDeclaration);

  const iconSpan = document.createElement('span');
  iconSpan.textContent = ICON[type];
  Object.assign(iconSpan.style, {
    color: color.icon,
    fontWeight: '700',
    fontSize: '16px',
    flexShrink: '0',
  } as CSSStyleDeclaration);

  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  textSpan.style.lineHeight = '1.5';

  el.appendChild(iconSpan);
  el.appendChild(textSpan);
  container.appendChild(el);

  // 入場
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });

  // 退場
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-10px)';
    setTimeout(() => el.remove(), 300);
  }, durationMs);
}

export const toast = {
  success: (msg: string, durationMs?: number) => showToast(msg, 'success', durationMs),
  error:   (msg: string, durationMs?: number) => showToast(msg, 'error', durationMs),
  info:    (msg: string, durationMs?: number) => showToast(msg, 'info', durationMs),
  warning: (msg: string, durationMs?: number) => showToast(msg, 'warning', durationMs),
};

export default toast;
