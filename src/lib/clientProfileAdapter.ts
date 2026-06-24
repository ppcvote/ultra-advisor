/**
 * Sprint 7 — 共用 ClientProfile adapter
 *
 * 為什麼存在：Sprint 6 把 7 個 optional 進階欄位加到 WarRoom 那條建客戶 path、
 * 但 ClientManager.tsx 那條另一個建客戶入口沒對齊。兩邊重複 serialize 邏輯
 * 容易 drift（一邊濾 NaN、另一邊忘記濾）→ 把它抽到這裡讓兩條 path 共用
 * 同一份 truth、未來新增 profile 欄位只改一處。
 *
 * 三個 helper：
 *  1. profileFromClient — 從 flat client doc 撈出 ClientProfile（讀）
 *  2. serializeProfileForAdd — addDoc 用：濾掉 undefined/null/''/NaN（寫新）
 *  3. profilePatchForUpdate — updateDoc 用：把未填欄位 explicit 設成 null
 *     （updateDoc 不支援 undefined；用 null 讓「清空已填欄位」也能持久化）
 */
import {
  ClientProfile,
  CLIENT_PROFILE_FIELDS,
} from '../types/clientProfile';

/**
 * 判斷一個 profile 值是否「未填」。
 * undefined / null / 空字串 / NaN 都視為未填。空字串走 any-cast 是因為 ClientProfile
 * 嚴格型別不允許 ''，但 Firestore 上既有 doc 可能殘留 '' 字串（select 切回「未填」
 * 在 Sprint 6 之前沒有過濾）— 這個 helper 是 read-path 的防禦。
 */
function isUnfilled(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if ((v as any) === '') return true;
  if (typeof v === 'number' && Number.isNaN(v)) return true;
  return false;
}

/** 從現有 client doc（flat 結構）撈出 profile 欄位 */
export function profileFromClient(client: any): ClientProfile {
  if (!client) return {};
  const out: ClientProfile = {};
  for (const key of CLIENT_PROFILE_FIELDS) {
    const v = client[key];
    if (isUnfilled(v)) continue;
    (out as any)[key] = v;
  }
  return out;
}

/**
 * addDoc 用：把 ClientProfile 的 undefined / null / '' / NaN 全濾掉。
 * Firestore addDoc 不接受 undefined、會直接噴錯；空字串視為「未填」一併濾掉
 * 避免 select 切回「未填」時殘留空字串污染 doc。
 */
export function serializeProfileForAdd(profile: ClientProfile | undefined): Partial<ClientProfile> {
  if (!profile) return {};
  const out: Partial<ClientProfile> = {};
  for (const key of CLIENT_PROFILE_FIELDS) {
    const v = profile[key];
    if (isUnfilled(v)) continue;
    (out as any)[key] = v;
  }
  return out;
}

/**
 * updateDoc 用：未填的欄位 explicit 設成 null（不是 undefined）
 * 為了讓「把已填的欄位清空」也能持久化到 Firestore。countClientProfileFields
 * 已把 null 視為未填、所以資料完整度徽章不會被誤算成「已填」。
 */
export function profilePatchForUpdate(profile: ClientProfile | undefined): Record<string, any> {
  const patch: Record<string, any> = {};
  for (const key of CLIENT_PROFILE_FIELDS) {
    const v = profile?.[key];
    patch[key] = isUnfilled(v) ? null : v;
  }
  return patch;
}

/** 表單 input → number | undefined（空字串 / NaN 一律 undefined，避免 0 / NaN 混在一起） */
export function parseNumOrUndef(v: string): number | undefined {
  if (v === '' || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
