/**
 * useClientContext — read-only access to the currently selected client
 *
 * Sprint 6: powers "use 王太太's data" chips inside individual tool forms.
 *
 * Source of truth: App.tsx's `currentClient` state, mirrored into
 * `activeClientStore` so deep-tree tool components don't need prop drilling.
 *
 * SSR-safe: useSyncExternalStore takes a `getServerSnapshot` that returns
 * null, so this hook can be imported in any environment.
 */
import { useSyncExternalStore, useMemo } from 'react';
import { activeClientStore } from '../lib/activeClientStore';
import type { ActiveClient, ClientProfile } from '../types/activeClient';
import { computeAgeFromBirthday } from '../types/activeClient';

/** Special derived field key — not in the schema, computed from birthday. */
type DerivedKey = 'age';

/** All keys readable through `hasField` / `getField`. */
export type ClientFieldKey = keyof ClientProfile | DerivedKey | 'name' | 'phone' | 'birthday';

export interface UseClientContextReturn {
  /** null when nothing is selected. */
  activeClient: ActiveClient | null;
  /** true iff the field has a usable value (non-empty, not NaN). */
  hasField: (field: ClientFieldKey) => boolean;
  /**
   * Returns the field value, or null if unavailable.
   *  - 'age' is computed from `birthday`
   *  - Profile fields read from `client.profile`
   *  - 'name' / 'phone' / 'birthday' read from root
   */
  getField: <T = unknown>(field: ClientFieldKey) => T | null;
  /** Convenience: clear the active client (writes through to App via store). */
  clearActive: () => void;
}

function readClient(): ActiveClient | null {
  return activeClientStore.get();
}

/** No server snapshot exists — always null during SSR. */
function readServer(): ActiveClient | null {
  return null;
}

export function useClientContext(): UseClientContextReturn {
  const activeClient = useSyncExternalStore(
    activeClientStore.subscribe,
    readClient,
    readServer,
  );

  // Memo the helper closures so chip components don't re-render unnecessarily.
  return useMemo<UseClientContextReturn>(() => {
    const getField = <T = unknown>(field: ClientFieldKey): T | null => {
      if (!activeClient) return null;

      if (field === 'age') {
        const age = computeAgeFromBirthday(activeClient.birthday);
        return (age as unknown as T) ?? null;
      }

      if (field === 'name' || field === 'phone' || field === 'birthday') {
        const v = activeClient[field];
        return (v ?? null) as T | null;
      }

      const profile = activeClient.profile;
      if (!profile) return null;
      const v = profile[field as keyof ClientProfile];
      return (v as T | undefined) ?? null;
    };

    const hasField = (field: ClientFieldKey): boolean => {
      const v = getField(field);
      if (v === null || v === undefined) return false;
      if (typeof v === 'string' && v.trim() === '') return false;
      if (typeof v === 'number' && Number.isNaN(v)) return false;
      return true;
    };

    return {
      activeClient,
      hasField,
      getField,
      clearActive: () => activeClientStore.set(null),
    };
  }, [activeClient]);
}

export default useClientContext;
