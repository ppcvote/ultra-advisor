/**
 * usePopoverDismiss — Sprint 11 Stream 3.A
 *
 * Unified a11y dismissal for popovers / dropdowns:
 *   - Esc closes
 *   - click outside container closes (mousedown — fires before click so
 *     button presses inside the popover aren't preempted by the listener)
 *   - return focus to the trigger button on close (keyboard users land
 *     back where they were)
 *   - optional autofocus on first interactive element when opened (gives
 *     keyboard users an immediate tab target; SR-friendly)
 *
 * Why a hook instead of a <Popover> wrapper component:
 *   - existing OverviewTab popover already has its own JSX / styling that
 *     we don't want to rewrite. Extracting only the *behaviour* keeps the
 *     Sprint 9 D diff small and lets us re-use across other popovers
 *     (admin tabs, profile menu) without restructuring their markup.
 *
 * SSR-safe: every browser-only API (window / document / setTimeout) is
 * guarded so this can be imported by SSR-rendered pages without crashing.
 * (Ultra Advisor is currently SPA-only, but the marketing landing pages
 * are pre-rendered in build-seo-pages.js and one of them may pull a
 * shared component that transitively imports this hook later.)
 */

import { useEffect } from 'react';
import type { RefObject } from 'react';

export interface UsePopoverDismissOptions {
  /** Drives all listener registration. Pass the same state that controls the popover render. */
  isOpen: boolean;
  /** Called on Esc / click-outside. Caller sets state to false. */
  onDismiss: () => void;
  /** Ref to the popover root. Click-outside is detected via `containerRef.current.contains(e.target)`. */
  containerRef: RefObject<HTMLElement | null>;
  /** Optional ref to the button that opened the popover. On close, focus is restored here for keyboard users. */
  triggerRef?: RefObject<HTMLElement | null>;
  /** Optional ref to the first interactive element inside the popover. Focused 100ms after open
   *  (delay avoids a race where the element isn't mounted yet — React commits the popover JSX
   *  after the same tick that flips isOpen=true). */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export function usePopoverDismiss(opts: UsePopoverDismissOptions): void {
  const { isOpen, onDismiss, containerRef, triggerRef, initialFocusRef } = opts;

  // ===== open-side effects: listeners + autofocus =====
  useEffect(() => {
    if (!isOpen) return;
    // SSR guard — these globals don't exist on the server. Bail before touching them.
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation(); // don't let a parent modal also close on the same Esc
        onDismiss();
      }
    };

    const handleMousedown = (e: MouseEvent) => {
      const root = containerRef.current;
      if (!root) return;
      if (!root.contains(e.target as Node)) {
        onDismiss();
      }
    };

    // mousedown (not click): fires earlier in the event chain so an inside-button
    // click doesn't first trigger an outside-listener close that unmounts the button.
    document.addEventListener('mousedown', handleMousedown);
    window.addEventListener('keydown', handleKeydown);

    // initialFocusRef: defer one tick (setTimeout 0 isn't enough; React's
    // commit phase + browser paint occasionally beats us. 100ms is the same
    // delay we use in cheat-sheet trigger and is below the perceptual threshold).
    let focusTimer: ReturnType<typeof setTimeout> | null = null;
    if (initialFocusRef?.current) {
      focusTimer = setTimeout(() => {
        // Re-check ref — popover might have closed during the delay (rapid toggle).
        if (initialFocusRef.current && document.contains(initialFocusRef.current)) {
          initialFocusRef.current.focus();
        }
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleMousedown);
      window.removeEventListener('keydown', handleKeydown);
      if (focusTimer !== null) clearTimeout(focusTimer);
    };
  }, [isOpen, onDismiss, containerRef, initialFocusRef]);

  // ===== close-side effect: restore focus to trigger =====
  // Split into its own useEffect so the focus-restore fires AFTER isOpen flips
  // to false (cleanup of the open-side effect happens first; trigger is then
  // safely focusable since the popover has un-mounted).
  useEffect(() => {
    if (isOpen) return;
    if (typeof document === 'undefined') return;
    const trigger = triggerRef?.current;
    if (!trigger) return;
    // Only restore focus if focus is currently nowhere useful — e.g. on <body>
    // because the popover that had focus just un-mounted. Don't steal focus if
    // the user has tabbed elsewhere already.
    if (document.activeElement === document.body || document.activeElement === null) {
      trigger.focus();
    }
    // We intentionally don't depend on triggerRef itself — refs are stable; isOpen drives it.
  }, [isOpen, triggerRef]);
}
