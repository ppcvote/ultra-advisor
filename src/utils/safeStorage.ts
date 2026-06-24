/**
 * Safe localStorage 包裝
 *
 * 為什麼需要：
 *  - Safari private mode：setItem 因 quota 拋 QuotaExceededError → 整支 app 崩
 *  - Disabled storage：getItem 在某些 enterprise / WebView 環境直接拋
 *  - JSON parse 失敗：壞掉的舊資料整支 app 崩
 *
 * 使用：
 *   import { safeStorage } from '@/utils/safeStorage';
 *   safeStorage.get('key', defaultValue);
 *   safeStorage.set('key', value);
 *   safeStorage.remove('key');
 *
 * String / JSON 雙模式：
 *   - safeStorage.get(key)              → string | null
 *   - safeStorage.getJSON<T>(key, fallback) → T
 *   - safeStorage.set(key, 'value')     → 寫 string
 *   - safeStorage.setJSON(key, obj)     → 寫 JSON.stringify
 */

function isAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const probe = '__ua_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const available = isAvailable();

export const safeStorage = {
  available,

  get(key: string): string | null {
    if (!available) return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  set(key: string, value: string): boolean {
    if (!available) return false;
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },

  remove(key: string): void {
    if (!available) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },

  getJSON<T>(key: string, fallback: T): T {
    const raw = this.get(key);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  setJSON(key: string, value: unknown): boolean {
    try {
      return this.set(key, JSON.stringify(value));
    } catch {
      return false;
    }
  },
};
