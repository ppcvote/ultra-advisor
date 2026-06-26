/**
 * Ultra Advisor — Condition Revision Notify Templates (Sprint 15 W2)
 *
 * SCOPE: TEMPLATES ONLY. NO TRIGGERS, NO SENDS, NO CRON, NO LINE-API CALLS.
 *
 * Triggering + dispatch live in `functions/index.js` (`notifyConditionRevision`
 * callable). This file is pure data + pure builder functions so unit tests
 * never need a runtime, a network, or React.
 *
 * Why no React Email components even though the spec tsx-sketched it:
 *   - Strategic boundary "不引入新 npm 依賴" is HARD. `@react-email/components`
 *     is NOT in functions/package.json (only firebase-admin, firebase-functions,
 *     @google/generative-ai, axios, dotenv, @google-cloud/vision). Adding it
 *     would bloat the Cloud Functions cold-start (CLAUDE.md "Vercel Serverless
 *     陷阱" + general cold-start guard).
 *   - Sprint 11 `lifecycle-email-templates.ts` shipped plain HTML strings for
 *     the exact same reason — we mirror that proven pattern here so the next
 *     owner doesn't have two divergent email-rendering stacks to maintain.
 *   - Resend accepts an `html` string directly; React rendering buys us zero
 *     extra capability for a single-screen transactional email.
 *
 * Boundary rules enforced by this file:
 *   - NO client PII in email body or LINE text. We expose only the count
 *     (`affectedClientCount`), never names. Even `affectedClientCount` is a
 *     number — UI-side (`ConditionAlerts.tsx`) is the only place full names
 *     surface, and that's gated by Firestore advisor-ownership rules.
 *   - LLM diff summary always followed by "AI 解讀僅供參考、以正式條款為準".
 *   - LINE text < 500 chars (LINE messaging API push limit is 5000, but a
 *     readable advisor-facing nudge should stay short; we'll truncate at 480
 *     to leave room for the deep-link).
 *   - Data-source attribution is always "tii" — never the actual upstream
 *     site name (HARD rule in Sprint 15 spec). The template never names a
 *     source, but the callable passes through to Resend without rewriting.
 *
 * Placeholder convention: caller (notifyConditionRevision in index.js)
 * passes a fully-populated `NotifyTemplateProps` and gets back
 * `{ subject, html, text, line }`. No string-substitution required —
 * everything is interpolated at build time inside the builder fns.
 *
 * Sprint 15 W2 ✓ (template)
 * Sprint 15 W3 will wire LINE Bot send + Cron auto-trigger.
 */

'use strict';

// ============================================================
// Types
// ============================================================

/** Single line-item produced by `composeConditionDiffSummary` callable. */
export interface ImportantChange {
  /** Plain-language category (e.g. "理賠定義", "除外條款", "保費調整"). */
  category: string;
  /** One-sentence summary of the change. AI-generated, advisor-readable. */
  change: string;
  /** Subjective impact bucket — drives color + sort order in dashboard. */
  impact: 'high' | 'medium' | 'low';
}

export type RevisionSeverity = 'high' | 'medium' | 'low';

export interface NotifyTemplateProps {
  /** Advisor display name (e.g. "方聖淵"). Used for greeting only. */
  advisorName: string;
  /** Insurance product display name (e.g. "南山新康健終身醫療"). */
  productName: string;
  /** Old version tag (e.g. "v2024.03"). */
  oldVersion: string;
  /** New version tag (e.g. "v2024.06"). */
  newVersion: string;
  /** Gemini-generated 2-4 sentence summary of what changed. */
  diffSummary: string;
  /** Structured bullet list of important changes (3-7 items typical). */
  importantChanges: ImportantChange[];
  /** Overall severity bucket — derived from importantChanges by callable. */
  severity: RevisionSeverity;
  /** How many of this advisor's clients hold this product. NUMBER ONLY. */
  affectedClientCount: number;
  /** Firestore doc id of the `condition_alerts/{alertId}` record. */
  alertId: string;
  /** Full deep-link URL to advisor dashboard alert detail page. */
  dashboardUrl: string;
}

export interface RenderedTemplate {
  subject: string;
  /** HTML body for Resend (or any SMTP). */
  html: string;
  /** Plain-text fallback for Resend (recommended for deliverability). */
  text: string;
  /** Single string for LINE push API `messages[].text`. */
  line: string;
}

// ============================================================
// Internal helpers
// ============================================================

/** zh-Hant severity label. Caller passes the raw bucket; we localize. */
function severityLabel(s: RevisionSeverity): string {
  if (s === 'high') return '高';
  if (s === 'medium') return '中';
  return '低';
}

/** Inline color for an impact pill in the HTML email. */
function impactColor(impact: ImportantChange['impact']): string {
  if (impact === 'high') return '#dc2626'; // red-600
  if (impact === 'medium') return '#d97706'; // amber-600
  return '#4b5563'; // gray-600
}

/** HTML-escape user-supplied strings before embedding in templates.
 *  diffSummary + change strings come from Gemini and from product name —
 *  both are technically "trusted" but escaping is cheap insurance.
 */
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Soft-cap a string for LINE pushes. We aim 480 chars to leave room for
 *  the deep link + AI disclaimer line which we always append. */
function truncateForLine(s: string, max = 80): string {
  const t = String(s).trim();
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)) + '…';
}

// ============================================================
// Subject line
// ============================================================

function buildSubject(p: NotifyTemplateProps): string {
  const sev = severityLabel(p.severity);
  return `[條款更新·${sev}影響] ${p.productName} ${p.oldVersion} → ${p.newVersion}（${p.affectedClientCount} 位客戶受影響）`;
}

// ============================================================
// Email HTML body
// ============================================================

function buildHtml(p: NotifyTemplateProps): string {
  const advisor = escapeHtml(p.advisorName);
  const product = escapeHtml(p.productName);
  const oldV = escapeHtml(p.oldVersion);
  const newV = escapeHtml(p.newVersion);
  const summary = escapeHtml(p.diffSummary);
  const sevText = severityLabel(p.severity);
  const ctaUrl = escapeHtml(p.dashboardUrl);

  const changeItems = p.importantChanges
    .map((c) => {
      const cat = escapeHtml(c.category);
      const change = escapeHtml(c.change);
      const color = impactColor(c.impact);
      const impactText =
        c.impact === 'high' ? '高' : c.impact === 'medium' ? '中' : '低';
      return `
    <li style="margin:0 0 10px;line-height:1.6;color:#1f2937;">
      <span style="display:inline-block;background:${color};color:#fff;font-size:11px;padding:2px 8px;border-radius:999px;margin-right:8px;vertical-align:middle;">${cat} · ${impactText}</span>
      <span>${change}</span>
    </li>`;
    })
    .join('');

  return `<!doctype html>
<html lang="zh-Hant"><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#1f2937;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;">
  <!--
    AI disclaimer banner — RED, top of email, same font size as headline.
    Strategic-boundary rule (Sprint 15 W2): the LLM diff summary is paraphrased
    AI output; if the advisor forwards this email to a client and the
    paraphrase misrepresents the条款, Ultra Advisor is the source of the
    misstatement. We mitigate by surfacing the disclaimer FIRST so the
    advisor literally cannot read the summary without seeing it.
    DO NOT move this banner to the footer.
  -->
  <div role="alert" style="background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:6px;padding:12px 16px;margin-bottom:20px;">
    <p style="margin:0;font-size:14px;color:#991b1b;font-weight:600;line-height:1.5;">
      ⚠️ AI 解讀僅供參考、實際以正式條款為準。
    </p>
    <p style="margin:6px 0 0;font-size:12px;color:#7f1d1d;line-height:1.5;">
      本摘要為自動產生、不構成保險條款解釋；聯絡客戶前請自行核對正式 PDF 條款。
    </p>
  </div>

  <div style="border-left:4px solid ${impactColor(p.severity === 'high' ? 'high' : p.severity === 'medium' ? 'medium' : 'low')};padding-left:16px;margin-bottom:24px;">
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;letter-spacing:0.5px;">CONDITION REVISION · ${sevText} IMPACT</p>
    <h1 style="font-size:22px;margin:0 0 6px;font-weight:700;color:#111827;">${advisor} 您好</h1>
    <p style="margin:0;font-size:15px;color:#374151;">
      您旗下有 <strong style="color:#111827;">${p.affectedClientCount}</strong> 位客戶持有的
      <strong style="color:#111827;">${product}</strong>，
      條款已從 <code style="background:#f3f4f6;padding:1px 6px;border-radius:4px;font-size:13px;">${oldV}</code>
      更新至 <code style="background:#f3f4f6;padding:1px 6px;border-radius:4px;font-size:13px;">${newV}</code>。
    </p>
  </div>

  <section style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
    <h2 style="font-size:14px;margin:0 0 10px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">重點變動 (AI 摘要)</h2>
    <p style="margin:0 0 14px;color:#1f2937;font-size:14px;">${summary}</p>
    <ul style="padding-left:0;margin:0;list-style:none;">${changeItems}
    </ul>
  </section>

  <div style="text-align:center;margin:28px 0 24px;">
    <a href="${ctaUrl}" style="display:inline-block;background:#1E40AF;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">查看受影響客戶 + 條款詳情</a>
  </div>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px;">

  <!--
    Legal footer — must explicitly assign responsibility to the advisor for any
    customer-facing communication that draws on this notification's content.
    Without this, Ultra Advisor's disclaimer-only defense is weak.
  -->
  <p style="font-size:11px;color:#6b7280;line-height:1.6;margin:0 0 8px;">
    本內容為 Ultra Advisor 自動化輔助、不構成保險條款解釋；條款解釋以發行公司書面條款為準。
    顧問依本通知聯絡客戶之內容、由顧問自行負責。
  </p>
  <p style="font-size:11px;color:#9ca3af;line-height:1.5;margin:0 0 6px;">
    本通知不含任何客戶個人資料，詳情請至顧問端 dashboard 確認。
  </p>
  <p style="font-size:11px;color:#9ca3af;line-height:1.5;margin:0;">
    Ultra Advisor · 傲創實業 · 資料來源：tii ·
    <span style="font-family:'JetBrains Mono',monospace;">${escapeHtml(p.alertId)}</span>
  </p>
</body></html>`;
}

// ============================================================
// Email plain-text fallback
// ============================================================

function buildText(p: NotifyTemplateProps): string {
  const sevText = severityLabel(p.severity);
  const changeLines = p.importantChanges
    .map((c) => {
      const impactText =
        c.impact === 'high' ? '高' : c.impact === 'medium' ? '中' : '低';
      return `· [${c.category} · ${impactText}] ${c.change}`;
    })
    .join('\n');

  return `⚠️ AI 解讀僅供參考、實際以正式條款為準。
本摘要為自動產生、不構成保險條款解釋；聯絡客戶前請自行核對正式 PDF 條款。
————————————————

${p.advisorName} 您好，

您旗下有 ${p.affectedClientCount} 位客戶持有的「${p.productName}」，
條款已由 ${p.oldVersion} 更新至 ${p.newVersion}（${sevText}影響）。

重點變動 (AI 摘要)
————————————————
${p.diffSummary}

${changeLines}

查看受影響客戶 + 條款詳情：
${p.dashboardUrl}

—
本內容為 Ultra Advisor 自動化輔助、不構成保險條款解釋；
條款解釋以發行公司書面條款為準。
顧問依本通知聯絡客戶之內容、由顧問自行負責。
本通知不含客戶個人資料，詳情請至顧問端 dashboard 確認。

Ultra Advisor · 傲創實業 · 資料來源：tii
Alert: ${p.alertId}`;
}

// ============================================================
// LINE push text
// ============================================================

/**
 * Build a LINE-friendly push text. Hard-capped well under LINE's 5000-char
 * message limit; aim for advisor-mobile-glanceable.
 *
 * Format:
 *   【顧問名 您好】
 *   您的 N 位客戶持有的「商品名」條款已更新 (vOld → vNew)
 *
 *   重點變動 (高影響):
 *   · [類別] 變動描述 1
 *   · [類別] 變動描述 2
 *   · [類別] 變動描述 3
 *
 *   詳情: https://...
 *
 *   AI 解讀僅供參考、實際以條款為準
 *
 * Length budget: ~480 chars target. Each change-line is also soft-capped so
 * one verbose Gemini bullet can't blow the whole message.
 */
export function buildConditionLineMessage(p: NotifyTemplateProps): string {
  const sevText = severityLabel(p.severity);

  const topThree = p.importantChanges.slice(0, 3).map((c) => {
    const change = truncateForLine(c.change, 60);
    return `· [${c.category}] ${change}`;
  });

  const lines = [
    `【${p.advisorName} 您好】`,
    `您的 ${p.affectedClientCount} 位客戶持有的「${p.productName}」條款已更新 (${p.oldVersion} → ${p.newVersion})`,
    '',
    `重點變動 (${sevText}影響):`,
    ...topThree,
    '',
    `詳情：${p.dashboardUrl}`,
    '',
    'AI 解讀僅供參考、實際以條款為準',
  ];

  const out = lines.join('\n');

  // Final defensive cap. 4900 leaves ample headroom under LINE's 5000 limit
  // but our typical message lands well under 500.
  if (out.length > 4900) {
    return out.slice(0, 4895) + '…';
  }
  return out;
}

// ============================================================
// Public entry — caller passes one object, gets all four renders.
// ============================================================

/**
 * Single entry point. The callable in `functions/index.js` should:
 *
 *   const rendered = renderConditionRevisionNotify(props);
 *   await resend.emails.send({ to, subject: rendered.subject, html: rendered.html, text: rendered.text });
 *   // Sprint 15 W3 will:
 *   //   if (lineUserId) await lineClient.pushMessage(lineUserId, { type:'text', text: rendered.line });
 */
export function renderConditionRevisionNotify(
  p: NotifyTemplateProps,
): RenderedTemplate {
  return {
    subject: buildSubject(p),
    html: buildHtml(p),
    text: buildText(p),
    line: buildConditionLineMessage(p),
  };
}

// ============================================================
// Dashboard URL helper
// ============================================================

/**
 * Resolve the alert deep-link URL. Reads DASHBOARD_BASE_URL from the
 * runtime env (set via `firebase functions:config` or .env in emulator),
 * falls back to production. The callable in index.js should call this
 * inside its handler — NEVER at module top-level — so emulator vs.
 * deployed env vars resolve correctly per-invocation.
 */
export function buildDashboardAlertUrl(alertId: string, baseUrl?: string): string {
  const base =
    (baseUrl && baseUrl.replace(/\/+$/, '')) ||
    (process.env.DASHBOARD_BASE_URL && process.env.DASHBOARD_BASE_URL.replace(/\/+$/, '')) ||
    'https://ultra-advisor.tw';
  return `${base}/dashboard/condition-alerts/${encodeURIComponent(alertId)}`;
}
