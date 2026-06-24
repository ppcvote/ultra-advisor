/**
 * Sprint 8 — clientAgenda.ts
 *
 * 「今日重點」block 在 OverviewTab 顯示「顧問今天該打開誰的檔案」。
 * 三類 trigger：
 *   1. 本週生日（now ~ now + 7 天）
 *   2. 近 30 天沒被 review（updatedAt < now - 30d）
 *   3. 資料完整度 < 4/8（鼓勵補資料）
 *
 * 設計鐵則（對齊 Sprint 7 / Sprint 8 customerReport.ts）：
 *   - 全部 helper 是 pure function、不在內部呼叫 Date.now() / new Date()
 *   - 由 caller (OverviewTab useEffect callback) 傳 nowEpochMs 進來
 *     原因：可測試 + 跨年 / 時區邊界自己控、避免 codec 在 build-time 被凍結錯誤時間
 *   - 沒 birthday / 沒 updatedAt 的 client 直接 skip（不 throw）
 *
 * 對齊 ClientManager 既有 completeness 算式：
 *   走 countClientProfileFields(client) — 同一份真實來源、避免 drift
 *   (見 src/types/clientProfile.ts CLIENT_PROFILE_FIELDS 8 欄)
 */

import { countClientProfileFields } from '../types/clientProfile';

export interface Client {
  id: string;
  name: string;
  birthday?: string;  // 'YYYY-MM-DD' or 'YYYY/MM/DD'
  updatedAt?: any;    // Firestore Timestamp | undefined
  isSample?: boolean; // 示範客戶（onboarding seed）— agenda 上不顯示，避免假觸發
  [key: string]: any;
}

export type AgendaKind = 'birthday' | 'stale' | 'incomplete';

export interface AgendaItem {
  kind: AgendaKind;
  clientId: string;
  clientName: string;
  /** 顯示用簡述，例如「生日 03/15」「已 35 天未更新」「資料 2/8」 */
  detail: string;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const STALE_THRESHOLD_DAYS = 30;
const BIRTHDAY_LOOKAHEAD_DAYS = 7;

/**
 * 解析 birthday 字串 → [month, day]（1-indexed）
 * 支援 'YYYY-MM-DD' / 'YYYY/MM/DD'。失敗回 null（caller 自行 skip）。
 */
function parseBirthdayMD(raw: string | undefined): [number, number] | null {
  if (!raw || typeof raw !== 'string') return null;
  // normalize 兩種分隔符
  const parts = raw.replace(/\//g, '-').split('-');
  if (parts.length < 3) return null;
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return [m, d];
}

/** 把 Firestore Timestamp / Date / number / undefined 統一抽成 ms。抽不到回 null。 */
function toMillis(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v?.toMillis === 'function') {
    try { return v.toMillis(); } catch { return null; }
  }
  if (v instanceof Date) return v.getTime();
  // Firestore Timestamp 也可能 serialize 成 { seconds, nanoseconds }
  if (typeof v?.seconds === 'number') return v.seconds * 1000;
  return null;
}

function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }

/**
 * 本週生日：birthday 月/日 今年版本落在 [now, now + 7 天]。
 * 跨年邊界（12/30 過完跨到 1/3）也要抓到 — 用「今年生日已過就看明年」的方式：
 *   bdThisYear < now ⇒ 看 bdNextYear；只要任一個落在窗口內就算。
 */
export function getBirthdayThisWeek(clients: Client[], nowEpochMs: number): AgendaItem[] {
  const now = new Date(nowEpochMs);
  const windowEndMs = nowEpochMs + BIRTHDAY_LOOKAHEAD_DAYS * ONE_DAY_MS;
  const items: AgendaItem[] = [];

  for (const c of clients) {
    if (c?.isSample) continue; // 不對示範客戶觸發
    const md = parseBirthdayMD(c?.birthday);
    if (!md) continue;
    const [m, d] = md;
    // 取「日的開始」(00:00)，避免時區/午夜邊界誤差
    const bdThisYear = new Date(now.getFullYear(), m - 1, d, 0, 0, 0, 0).getTime();
    const bdNextYear = new Date(now.getFullYear() + 1, m - 1, d, 0, 0, 0, 0).getTime();
    const hit =
      (bdThisYear >= nowEpochMs && bdThisYear <= windowEndMs) ||
      (bdNextYear >= nowEpochMs && bdNextYear <= windowEndMs);
    if (!hit) continue;
    items.push({
      kind: 'birthday',
      clientId: c.id,
      clientName: c.name,
      detail: `生日 ${pad2(m)}/${pad2(d)}`,
    });
  }
  return items;
}

/**
 * 近 30 天沒被 review：updatedAt 距今超過 30 天。
 * 沒 updatedAt 的 client 不算 stale（剛建檔的也別誤觸發）。
 */
export function getStaleClients(clients: Client[], nowEpochMs: number): AgendaItem[] {
  const threshold = nowEpochMs - STALE_THRESHOLD_DAYS * ONE_DAY_MS;
  const items: AgendaItem[] = [];
  for (const c of clients) {
    if (c?.isSample) continue;
    const ms = toMillis(c?.updatedAt);
    if (ms == null) continue; // 無時間資訊 → skip
    if (ms >= threshold) continue;
    const days = Math.floor((nowEpochMs - ms) / ONE_DAY_MS);
    items.push({
      kind: 'stale',
      clientId: c.id,
      clientName: c.name,
      detail: `已 ${days} 天未更新`,
    });
  }
  // 越久沒更新越優先
  items.sort((a, b) => {
    const am = parseInt(a.detail.match(/\d+/)?.[0] || '0', 10);
    const bm = parseInt(b.detail.match(/\d+/)?.[0] || '0', 10);
    return bm - am;
  });
  return items;
}

/**
 * 資料完整度 < 4/8：走 countClientProfileFields() — 與 ClientsTab 同一份算式。
 * 示範客戶 skip（onboarding seed 完整度多半故意低、不該變成 agenda 噪音）。
 */
export function getIncompleteProfiles(clients: Client[]): AgendaItem[] {
  const items: AgendaItem[] = [];
  for (const c of clients) {
    if (c?.isSample) continue;
    const filled = countClientProfileFields(c);
    if (filled >= 4) continue;
    items.push({
      kind: 'incomplete',
      clientId: c.id,
      clientName: c.name,
      detail: `資料 ${filled}/8`,
    });
  }
  // 越少越優先
  items.sort((a, b) => {
    const af = parseInt(a.detail.match(/\d+/)?.[0] || '0', 10);
    const bf = parseInt(b.detail.match(/\d+/)?.[0] || '0', 10);
    return af - bf;
  });
  return items;
}

/**
 * 合成 agenda：三類各取 top N、dedupe by clientId（同客戶多 trigger 只列一條、kind 取 priority 高的）
 * priority: birthday > stale > incomplete
 *   理由：生日是時效性硬限、stale 是耦合風險、incomplete 是長期 nudge
 *
 * 預設總上限 9 條（每類 3 條）— 避免畫面被淹沒、保持「今日重點」的篩選感。
 */
export function buildAgenda(
  clients: Client[],
  nowEpochMs: number,
  opts?: { perKindLimit?: number }
): AgendaItem[] {
  const perKindLimit = opts?.perKindLimit ?? 3;
  const birthdays = getBirthdayThisWeek(clients, nowEpochMs).slice(0, perKindLimit);
  const stale = getStaleClients(clients, nowEpochMs).slice(0, perKindLimit);
  const incomplete = getIncompleteProfiles(clients).slice(0, perKindLimit);

  // dedupe by clientId — priority order 決定誰勝出
  const seen = new Set<string>();
  const out: AgendaItem[] = [];
  for (const list of [birthdays, stale, incomplete]) {
    for (const item of list) {
      if (seen.has(item.clientId)) continue;
      seen.add(item.clientId);
      out.push(item);
    }
  }
  return out;
}
