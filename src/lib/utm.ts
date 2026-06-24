/**
 * UTM capture — record first-touch acquisition for the user doc
 *
 * Why first-touch (not last-touch): finance advisors often arrive from one
 * source (LINE ad, IG bio, blog post) then come back days later via direct
 * URL to register. We want to credit the original referrer, not the
 * direct-traffic final hop.
 *
 * Storage: safeStorage (localStorage-backed) so attribution survives
 * cross-day return visits. sessionStorage would lose it on the second day.
 * The captured payload is small (<200 bytes) so quota is a non-issue.
 */

import { safeStorage } from '../utils/safeStorage';

const ATTR_KEY = 'ua_acquisition';

export interface UtmAttribution {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referrer: string | null;
  landingPath: string | null;
  capturedAt: number;
}

function readQuery(name: string): string | null {
  try {
    const url = new URL(window.location.href);
    const v = url.searchParams.get(name);
    return v && v.length > 0 && v.length < 256 ? v : null;
  } catch {
    return null;
  }
}

/**
 * Idempotent: only writes on the first call that finds an empty slot.
 * Safe to call on every page load.
 */
export function captureUtmIfFirstTouch(): void {
  if (typeof window === 'undefined') return;

  const existingRaw = safeStorage.get(ATTR_KEY);
  if (existingRaw) return; // first-touch lock — never overwrite

  const utm_source = readQuery('utm_source');
  const utm_medium = readQuery('utm_medium');
  const utm_campaign = readQuery('utm_campaign');
  const utm_term = readQuery('utm_term');
  const utm_content = readQuery('utm_content');

  // If there's no UTM AND no external referrer, skip — direct/internal hit
  // isn't worth a doc write.
  let referrer: string | null = null;
  try {
    if (document.referrer && !document.referrer.includes(window.location.host)) {
      referrer = document.referrer.slice(0, 512);
    }
  } catch {
    /* ignore */
  }

  const hasAnySignal =
    utm_source || utm_medium || utm_campaign || utm_term || utm_content || referrer;
  if (!hasAnySignal) return;

  const payload: UtmAttribution = {
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    referrer,
    landingPath: window.location.pathname + window.location.search,
    capturedAt: Date.now(),
  };

  safeStorage.setJSON(ATTR_KEY, payload);
}

/**
 * Read the stored first-touch attribution. Returns null if nothing was
 * captured (direct/internal traffic) — caller should treat null as
 * "no attribution data, don't write the field".
 */
export function getUtmAttribution(): UtmAttribution | null {
  return safeStorage.getJSON<UtmAttribution | null>(ATTR_KEY, null);
}

/**
 * For testing / admin reset only — not wired to user-facing flows.
 */
export function clearUtmAttribution(): void {
  safeStorage.remove(ATTR_KEY);
}
