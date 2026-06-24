/**
 * useViewMode — 全域客戶／顧問切換
 *
 * 為什麼 module-level state（不用 Context）：
 *  - 沿用 toast util 的同款模式：少一個 Provider、不污染 tree
 *  - 7 個工具 + sidebar 任一處改、其他處自動 rerender
 *
 * 持久化：safeStorage（key: ua_view_mode）
 * 預設：client（避免新用戶／訪客看到業務小抄入口）
 */

import { useEffect, useState } from 'react';
import { safeStorage } from '../utils/safeStorage';

export type ViewMode = 'client' | 'advisor';

const STORAGE_KEY = 'ua_view_mode';

function readInitial(): ViewMode {
  const raw = safeStorage.get(STORAGE_KEY);
  return raw === 'advisor' ? 'advisor' : 'client';
}

let currentMode: ViewMode = readInitial();
const listeners = new Set<(mode: ViewMode) => void>();

function setModeInternal(next: ViewMode) {
  if (next === currentMode) return;
  currentMode = next;
  safeStorage.set(STORAGE_KEY, next);
  listeners.forEach(l => l(next));
}

export function getViewMode(): ViewMode {
  return currentMode;
}

export function setViewMode(next: ViewMode) {
  setModeInternal(next);
}

export function toggleViewMode() {
  setModeInternal(currentMode === 'advisor' ? 'client' : 'advisor');
}

export function useViewMode() {
  const [mode, setMode] = useState<ViewMode>(currentMode);

  useEffect(() => {
    const listener = (next: ViewMode) => setMode(next);
    listeners.add(listener);
    // 掛載時對齊一次：避免 SSR / lazy mount 時的 stale 值
    if (currentMode !== mode) setMode(currentMode);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    mode,
    setMode: setViewMode,
    isAdvisor: mode === 'advisor',
    toggle: toggleViewMode,
  };
}
