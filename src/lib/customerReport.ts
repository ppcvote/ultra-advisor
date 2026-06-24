// Customer-facing report — share-link payload codec.
//
// Sprint 7 F: encode a tool's inputs + outputs into a base64 query param so
// the advisor can hand a public URL to a client (LINE / SMS / email). The
// decoded page is read-only — no Firestore writes, no auth, no editing.
//
// Why pure base64 (not Firestore):
//   - Zero infra changes (no rules edits, no new collection, no quotas)
//   - Sharing works for non-members the moment the advisor copies the link
//   - Trade-off: link bytes grow with payload; we keep payloads ≤ 1KB
//     (numbers + a tiny advisor snippet) so URL length stays well under
//     the 2048 practical limit. View-tracking + expiration are deferred
//     to Sprint 8 once real usage data justifies the complexity.
//
// Why timestamp is caller-supplied (not Date.now() here):
//   - The encode function is supposed to be pure given its input. The
//     `generatedAt` belongs to the share-button click moment, not the
//     codec module's import-time. Putting Date.now() here would mean
//     every test snapshot drifts + caching impossible.
//   - See Sprint 7 鐵則 (時間戳處理): caller passes a fully-built payload.
//
// PII rule (Sprint 5 ShareButton 教訓):
//   - We deliberately do NOT carry the client's name, phone, birthday, or
//     any identifier from `currentClient` into the payload. The advisor
//     identity (name + licenses) is fine; the customer is the one viewing,
//     they don't need to see their own name read back at them, and a
//     leaked link must not dox the customer.

export type CustomerReportTool = 'labor_pension';

// URL slug ↔ internal tool id. Slug uses kebab-case for friendlier URLs.
// Keep the map tiny + explicit — never accept arbitrary strings from the URL.
const SLUG_TO_TOOL: Record<string, CustomerReportTool> = {
  'labor-pension': 'labor_pension',
};

const TOOL_TO_SLUG: Record<CustomerReportTool, string> = {
  labor_pension: 'labor-pension',
};

export function slugToTool(slug: string): CustomerReportTool | null {
  return SLUG_TO_TOOL[slug] ?? null;
}

export function toolToSlug(tool: CustomerReportTool): string {
  return TOOL_TO_SLUG[tool];
}

// Labor-pension specific payload shape. Numbers only — UI strings live in
// the renderer so we can re-style without breaking already-shared links.
export interface LaborPensionPayload {
  inputs: {
    currentAge: number;
    retireAge: number;
    salary: number;
    laborInsYears: number;
    selfContribution: boolean;
    desiredMonthlyIncome: number;
    inflationRate: number;
    pensionDiscount: number;
  };
  outputs: {
    futureDesiredIncome: number;
    laborInsMonthly: number;
    pensionMonthly: number;
    totalPension: number;
    gap: number;
    monthlySaveNow: number;
    monthlySaveLater: number;
    yearsToRetire: number;
  };
}

// Advisor snippet — what the customer sees as "who sent me this".
// Intentionally NO email / phone / LINE id: those create harassment surface
// area if the link is forwarded. The advisor's own contact channel is the
// LINE message they're already in.
export interface AdvisorSnippet {
  name: string;
  licenses?: string; // e.g. "IARFC, 人身保險業務員"
  companyName?: string;
}

export interface CustomerReportPayload {
  tool: CustomerReportTool;
  inputs: LaborPensionPayload['inputs']; // extend with union when more tools land
  outputs: LaborPensionPayload['outputs'];
  advisor: AdvisorSnippet;
  generatedAt: number; // epoch ms — caller-supplied (see header rule)
  v: 1; // schema version; bump if shape changes incompatibly
}

// btoa/atob only handle latin1, so we round-trip through UTF-8 first.
// (Advisor names + license labels are Chinese — would explode otherwise.)
function utf8ToBase64(s: string): string {
  // encodeURIComponent → %XX bytes → latin1 string → btoa
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin)
    // URL-safe variant: '+' → '-', '/' → '_', drop '=' padding.
    // We re-pad on decode. Saves ~3-5% length and avoids %-encoding the '='.
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64ToUtf8(b64: string): string {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const bin = atob(padded + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeCustomerReport(payload: CustomerReportPayload): string {
  return utf8ToBase64(JSON.stringify(payload));
}

// Returns null on any parse / shape / version mismatch — caller renders the
// "invalid link" CTA. We never throw across the route boundary so a malformed
// link can't blank the page.
export function decodeCustomerReport(b64: string): CustomerReportPayload | null {
  if (!b64) return null;
  try {
    const json = base64ToUtf8(b64);
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.v !== 1) return null;
    // Tool must be one we know how to render. Sprint 8 extends the union.
    if (!parsed.tool || !(parsed.tool in TOOL_TO_SLUG)) return null;
    if (!parsed.inputs || !parsed.outputs || !parsed.advisor) return null;
    if (typeof parsed.generatedAt !== 'number') return null;
    return parsed as CustomerReportPayload;
  } catch {
    return null;
  }
}
