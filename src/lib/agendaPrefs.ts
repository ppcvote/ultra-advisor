/**
 * Sprint 9 D — agendaPrefs.ts
 *
 * 為什麼存在：
 *   Sprint 8 dogfood critic 點名 — 「30 天 stale」「資料 < 4/8」這兩類 agenda
 *   對某些顧問會反感（覺得被嘮叨、或 stale 定義不適合他的 review 週期）。
 *   單純拿掉這兩類 → 失去把「該打電話」客戶 surface 出來的價值。
 *   折衷：讓顧問可個別關掉某類 trigger、預設全開。
 *
 * 持久化：
 *   走 safeStorage（src/utils/safeStorage.ts）— 對齊全站 14 處 safeStorage 用法。
 *   絕對不直接 localStorage（Safari private mode / disabled storage 會崩）。
 *
 * Subscribe pattern：
 *   對齊 activeClientStore 的 module-level Set<Listener> + subscribe() 模式。
 *   OverviewTab 走 useSyncExternalStore — 切換立刻生效、不靠 useEffect rehydrate。
 *
 * 鐵則：
 *   - 不在 module top-level 讀 storage（SSR-safe；getAgendaPrefs() runtime 才呼叫）
 *   - JSON.parse 失敗 / shape mismatch → 退回 DEFAULT_PREFS（不 throw）
 *   - 三類全關 → buildAgenda() 自動回 [] → OverviewTab block 整段不渲染
 */

import { safeStorage } from '../utils/safeStorage';

export interface AgendaPrefs {
  showBirthday: boolean;
  showStale: boolean;
  showIncomplete: boolean;
}

// 預設只開 birthday — 生日 trigger 永遠有用、noise 風險最低
// stale / incomplete 對熟客顧問會被當「嘮叨」(Sprint 8 dogfood critic 警告)
// 想要更積極 reminder 的顧問自己開齒輪打勾、而非反過來要求他關
const DEFAULT_PREFS: AgendaPrefs = {
  showBirthday: true,
  showStale: false,
  showIncomplete: false,
};

// v1 字尾保留：將來欄位 schema 變更可不破舊資料（讀到舊 key 就 fallback default）
const STORAGE_KEY = 'ua_agenda_prefs_v1';

type Listener = (prefs: AgendaPrefs) => void;
const listeners = new Set<Listener>();

/**
 * Shape guard：safeStorage.getJSON 回來的物件可能被使用者改壞或舊 schema 殘留。
 * 三個欄位都必須是 boolean 才採用、缺一個就退預設。
 */
function isValidPrefs(v: any): v is AgendaPrefs {
  return (
    v != null &&
    typeof v === 'object' &&
    typeof v.showBirthday === 'boolean' &&
    typeof v.showStale === 'boolean' &&
    typeof v.showIncomplete === 'boolean'
  );
}

export function getAgendaPrefs(): AgendaPrefs {
  const raw = safeStorage.getJSON<unknown>(STORAGE_KEY, null);
  if (!isValidPrefs(raw)) return DEFAULT_PREFS;
  // 回拷貝避免外部 mutation 污染 — 對齊 React state immutability 慣例
  return { ...raw };
}

export function setAgendaPref<K extends keyof AgendaPrefs>(key: K, value: boolean): void {
  // read-merge-write：每次只動單欄位、不覆寫其他欄位（同步多元件變更時保險）
  const current = getAgendaPrefs();
  const next: AgendaPrefs = { ...current, [key]: value };
  safeStorage.setJSON(STORAGE_KEY, next);
  // broadcast 給所有訂閱者（OverviewTab 走 useSyncExternalStore 會立即 re-render）
  listeners.forEach((fn) => {
    try {
      fn(next);
    } catch (e) {
      console.error('[agendaPrefs] listener error', e);
    }
  });
}

/**
 * 訂閱 prefs 變化、回傳 unsubscribe。
 * 配合 React 18 useSyncExternalStore 使用：
 *   const prefs = useSyncExternalStore(subscribeAgendaPrefs, getAgendaPrefs, getAgendaPrefs);
 */
export function subscribeAgendaPrefs(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
