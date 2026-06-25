import React from 'react';
import { Calendar } from 'lucide-react';
import { getDisplayName } from '../../components/ShareToCustomerButton';
import type { CustomerReportPayload } from '../../lib/customerReport';

// ---------------------------------------------------------------------------
// Sprint 11 Stream 2 — extracted from CustomerReportPage.tsx during chunk split.
// These were sitting at the top of a 2178-line monolith; pulling them into a
// shared module lets each view chunk import only what it needs without
// dragging the recharts + every renderer into one bundle.
// Pure cut-paste: NO behavioural changes from the original — anyone diffing
// has only relocation noise to filter, not semantic deltas.
// ---------------------------------------------------------------------------

// Tool slug → 中文 label. Shared by the og:title useEffect AND the
// FeedbackBar prefilled message. Single source of truth — adding a new tool
// later requires updating exactly this one map.
// (Sprint 9 A extended to 10 tools; Sprint 10 added insurance_checkup.)
export const TOOL_LABELS: Record<CustomerReportPayload['tool'], string> = {
  labor_pension: '退休缺口分析',
  big_small_reservoir: '大小水庫專案',
  tax_planner: '稅務傳承規劃',
  million_gift: '百萬禮物計畫',
  fund_time_machine: '基金時光機',
  student_loan: '學貸活化專案',
  car_replacement: '5 年換車專案',
  super_active_saving: '超積極存錢法',
  financial_real_estate: '金融房產專案',
  golden_safe_vault: '黃金保險箱',
  insurance_checkup: '家庭保障健診',
};

// Sprint 9 F: sanitize contactLine before opening a LINE URL.
// 顧問可能在 Firestore users/{uid}.contactLine 塞奇怪的東西 (phone / URL / email)。
// 嚴格 regex 只放行 @xxx 或純 alnum/_-/. (LINE OA ID 規範) — 其他丟掉。
// 長度上限 20：LINE OA ID 規範 4-18 字元、留 buffer 給 @ prefix。
export function sanitizeContactLine(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // @ prefix 可選；id 主體只接受 alphanumeric / underscore / hyphen / period
  if (!/^@?[a-zA-Z0-9_.-]{2,20}$/.test(trimmed)) return undefined;
  return trimmed;
}

export const formatNT = (n: number) => `$${n.toLocaleString()}`;

export const formatGeneratedAt = (epochMs: number): string => {
  try {
    const d = new Date(epochMs);
    if (Number.isNaN(d.getTime())) return '';
    // YYYY/MM/DD — locale-stable, not "X 天前" since clients may view weeks later.
    return d.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return '';
  }
};

// "萬" formatting: BigSmall/Gift work in 萬 units natively; we convert to
// 億 only when ≥ 10,000 萬 for readability (matches advisor-side helper).
export const formatWan = (val: number): string => {
  const abs = Math.abs(Math.round(val));
  if (abs >= 10000) {
    const yi = Math.floor(abs / 10000);
    const wan = abs % 10000;
    return wan > 0 ? `${yi}億${wan.toLocaleString()}萬` : `${yi}億`;
  }
  return `${abs.toLocaleString()}萬`;
};

// Sprint 8 E: compact AdvisorBar — single row, ≤ 80px total height.
// Why: on a 650px LINE in-app browser viewport, the previous 2-line "您的財務顧問"
// label + name + cert lines + date row was eating ~140px AND pushing the
// gap headline below the fold. Compact = name on left, cert in muted span next
// to it, date timestamp small-right. Removed the "您的財務顧問" prefix label
// (redundant — context makes it obvious whose contact card this is).
export const AdvisorBar: React.FC<{ payload: CustomerReportPayload }> = ({ payload }) => {
  const { advisor, generatedAt } = payload;
  // 為什麼這裡再 sanitize 一次：Sprint 7 / 8 之前產生的舊 link 沒走 sanitize、
  // payload.advisor.name 可能殘留電話/email/LINE id；
  // decode 端跑一次 fallback 防 leak（critic security #2）
  const safeName = advisor.name ? getDisplayName(advisor.name) : '—';
  const certLine = [advisor.companyName, advisor.licenses].filter(Boolean).join(' · ');
  return (
    <div className="bg-slate-900/70 border border-slate-700/60 rounded-xl px-4 py-2.5 flex items-center gap-3">
      <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-slate-100 font-bold truncate text-sm">{safeName}</span>
        {certLine && (
          <span className="text-[11px] text-slate-400 truncate">{certLine}</span>
        )}
      </div>
      {generatedAt > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono shrink-0">
          <Calendar size={10} />
          {formatGeneratedAt(generatedAt)}
        </div>
      )}
    </div>
  );
};

// Narrowed payload alias — gives the renderer a precise type for its own
// branch of the discriminated union without needing per-branch generics.
export type PayloadOf<T extends CustomerReportPayload['tool']> = Extract<
  CustomerReportPayload,
  { tool: T }
>;
