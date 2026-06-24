/**
 * Active client store — read-only bridge from App.tsx → tool components
 *
 * Why this exists:
 *   App.tsx owns `currentClient` as local React state (single source of truth).
 *   Tool components are mounted deep in the tree and we don't want to either
 *   (a) prop-drill `currentClient` through 14 tools, or
 *   (b) lift it into a Context — that'd touch the state flow rule says "don't change".
 *
 *   So App.tsx mirrors `currentClient` into this module-level store via a tiny
 *   `useEffect`, and chip components subscribe read-only. App.tsx is still the
 *   single writer.
 *
 * SSR-safe: nothing in this module touches `window` at the top level.
 */
import type { ActiveClient } from '../types/activeClient';

type Listener = (client: ActiveClient | null) => void;

let activeClient: ActiveClient | null = null;
const listeners = new Set<Listener>();

/**
 * 為什麼這裡要做 normalize：
 *   modal 寫入端（WarRoom/AddClientModal/EditClientModal）跟 clientProfile.ts schema 走
 *   flat fields（age, monthlyIncome, familyStatus, childrenCount, retirementAge, ...）
 *   直接 spread 進 client doc 根層。
 *   但 useClientContext / chip 期望 client.profile.{monthlyIncome, retirementAge,
 *   hasSpouse, childrenCount, dependentParents} 這種 nested 結構。
 *   bridge 在這裡轉一次：flat → nested + 衍生 hasSpouse from familyStatus，
 *   兩端 schema 不用同步變更也能對得起來。
 */
function normalizeClient(raw: any): ActiveClient {
  const familyStatus = raw?.familyStatus;
  const hasSpouse =
    familyStatus === 'married' || familyStatus === 'married_with_kids' || undefined;
  return {
    ...raw,
    profile: {
      monthlyIncome: raw?.monthlyIncome,
      retirementAge: raw?.retirementAge,
      hasSpouse,
      childrenCount: raw?.childrenCount,
      // Sprint 7: modal 已補 input；既有客戶讀到 undefined，chip 自動隱藏（ClientDataPanel 行為）
      dependentParents: raw?.dependentParents,
    },
  };
}

export const activeClientStore = {
  /** App.tsx mirrors `currentClient` here via useEffect. Pass null to clear. */
  set(client: ActiveClient | null): void {
    const next = client ? normalizeClient(client) : null;
    // Same-id skip: 兩個 client 物件可能不同 reference 但同 id（App.tsx re-render
    // 重新 spread props 拿到的）— 比 id 才是真實「換 client」訊號
    if (activeClient && next && activeClient.id === next.id) {
      // 仍要更新 in-place reference（newer data wins），但跳過 listener 廣播
      activeClient = next;
      return;
    }
    activeClient = next;
    listeners.forEach((fn) => {
      try { fn(activeClient); } catch (e) { console.error('[activeClientStore] listener error', e); }
    });
  },

  get(): ActiveClient | null {
    return activeClient;
  },

  /** Returns unsubscribe. */
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};
