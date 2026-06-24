/**
 * useCheatSheetTrigger — 三連點開業務小抄
 *
 * 行為：
 *  - 800ms 內三連點才觸發（避免單點誤觸）
 *  - 只有 advisor 模式才響應（客戶模式下完全 no-op，連 click 都不計）
 *  - 觸發時記 Firestore users/{uid}.cheatSheetUsageCount += 1
 *  - 監聽 ESC：自動關閉
 *
 * 回傳：
 *  - clickHandler：綁在「業務小抄入口 chip」的 onClick
 *  - isOpen：是否顯示業務小抄面板
 *  - close：手動關閉（給 panel 的 backdrop / X 按鈕）
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useViewMode } from './useViewMode';

interface Options {
  /** 三連點累計時限（毫秒），預設 800 */
  windowMs?: number;
  /** 觸發時是否要打 Firestore 計數，預設 true */
  track?: boolean;
}

async function trackUsage() {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { cheatSheetUsageCount: increment(1) });
  } catch (error) {
    console.error('Failed to track cheat sheet usage:', error);
  }
}

export function useCheatSheetTrigger(options: Options = {}) {
  const { windowMs = 800, track = true } = options;
  const { isAdvisor } = useViewMode();

  const [isOpen, setIsOpen] = useState(false);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => setIsOpen(false), []);

  const clickHandler = useCallback(() => {
    if (!isAdvisor) return;
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, windowMs);
    if (clickCountRef.current >= 3) {
      setIsOpen(true);
      clickCountRef.current = 0;
      if (track) trackUsage();
    }
  }, [isAdvisor, windowMs, track]);

  // 切回客戶模式時，如果面板還開著就強制關掉
  useEffect(() => {
    if (!isAdvisor && isOpen) setIsOpen(false);
  }, [isAdvisor, isOpen]);

  // ESC 關閉
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // unmount 清 timer
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  return { clickHandler, isOpen, close };
}
