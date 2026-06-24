// Customer-report URL parser — kept out of App.tsx so the route-detection
// logic for /r/:tool stays testable and App.tsx's already-crowded
// `handlePopState` block doesn't need another branch with `.split('/r/')`
// inline.
//
// Path shape: /r/<slug>?d=<base64>
//   - slug   → tool id (see customerReport.slugToTool)
//   - d      → base64 payload (see customerReport.decodeCustomerReport)
//
// Both pieces are pulled directly from window.location so this works for
// both initial-load (SSR-rewritten URL) and popstate navigation.

import { CustomerReportTool, slugToTool } from './customerReport';

export interface CustomerReportRoute {
  tool: CustomerReportTool | null; // null = slug present but unknown → "unsupported tool" view
  rawSlug: string;
  encoded: string; // empty string if `d` missing → triggers "invalid link" view
}

export function isCustomerReportPath(pathname: string): boolean {
  return pathname.startsWith('/r/');
}

export function parseCustomerReportRoute(
  pathname: string,
  search: string,
): CustomerReportRoute | null {
  if (!isCustomerReportPath(pathname)) return null;

  // Strip leading "/r/" and everything from the next "/" onward — we don't
  // support nested slugs (no /r/foo/bar). Trailing slash is tolerated.
  const after = pathname.slice(3);
  const rawSlug = after.split('/')[0] ?? '';

  const params = new URLSearchParams(search);
  const encoded = params.get('d') ?? '';

  return {
    tool: rawSlug ? slugToTool(rawSlug) : null,
    rawSlug,
    encoded,
  };
}
