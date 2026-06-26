// Sprint 14 Week 1 — task B7 shared constants
//
// Frozen registry of the 59 insurance companies the Sprint 13 crawler
// recognizes via `COMPANY_SLUG_MAP` (see
// `scripts/parse-insurance-database.cjs`). Mirrored here so client code
// can:
//   1. Build the insurer <select> in PolicyForm without round-tripping to
//      Firestore (35k product docs are too heavy to scan just for a list
//      of distinct company names).
//   2. Translate the raw `companyNo` that survives into OCR results /
//      catalog match payloads back into the zh-TW name the advisor
//      recognizes.
//   3. Group dropdowns by 壽險 vs 產險 line of business — the advisor's
//      mental model is "壽險顧問" vs "產險顧問" and forcing them to scan
//      a 59-row flat list is a UX paper-cut Min Yi flagged in Sprint 12.
//
// Ordering rule (Sprint 14 W1 brief):
//   - 壽險 (life) first, ordered by 2025 Taiwan market share (largest
//     first), because Min Yi's daily caseload skews 80%+ life-side and a
//     scan-from-top dropdown saves ~2s per policy entry.
//   - 海外 / 已歇業 / 簡易壽險 next — these still show up in legacy
//     policies advisors review (Aegon = ING/安泰, Singfor = 三商美邦
//     前身, Chunghwa Post = 郵局簡易壽險). They must remain selectable
//     for OCR confirmation of vintage paperwork even if no new product
//     is written by them.
//   - 產險 (P&C) last, ordered by 2025 P&C market share. P&C work in this
//     app is OCR-only (we don't quote new policies) so reach-frequency is
//     low and ordering accuracy here matters less.
//
// Sync contract (鐵則):
//   - companyNo + companySlug + lineOfBusiness MUST match
//     `COMPANY_SLUG_MAP` in `scripts/parse-insurance-database.cjs`. The
//     crawler writes Firestore doc IDs as `tii_{companyNo}_{markSlug}`
//     and `companySlug` is used in URLs / cache keys downstream. A
//     mismatch here would surface as "unknown company" badges all over
//     the catalog alignment UI.
//   - If a new company appears in TII feeds, the crawler script's
//     COMPANY_SLUG_MAP must be updated FIRST (so existing Firestore docs
//     keep their stable slug), then this registry is appended in the
//     same PR. Sprint 15 admin review queue (insurance_products_pending)
//     will flag any companyNo that isn't in either list.
//   - Sprint 13b critic fix verified: JS=farglory-life,
//     RT=aegon-life, KP=kuobao-life. Do not "fix" these to anglicized
//     spellings — they match the slug map exactly.
//
// Strategic guardrails (Sprint 14 鐵則):
//   - 0 npm dependencies.
//   - `as const` so consumers get string-literal types on companyNo and
//     companySlug — useful for type-narrowing in match payloads.
//   - No wall-clock reads. This module is pure data.

/**
 * One entry per company in `COMPANY_SLUG_MAP`. Field meanings:
 *   - companyNo: TII feed code (2-4 chars). Stable across rebrandings.
 *   - companySlug: kebab-case identifier used in Firestore doc IDs,
 *     URL paths, and cache keys. Derived from `COMPANY_SLUG_MAP`.
 *   - companyName: zh-TW display name as the advisor sees it on policy
 *     paper. NOT the legal entity name (which can be longer, e.g.
 *     "國泰人壽保險股份有限公司" vs the display "國泰人壽").
 *   - lineOfBusiness: 'life' (壽險、含海外/簡易) or 'pnc' (產險).
 *     Drives the dropdown group header in PolicyForm.
 */
export type CompanyOption = {
  companyNo: string;
  companySlug: string;
  companyName: string;
  lineOfBusiness: 'life' | 'pnc';
};

/**
 * 59 companies covering 100% of `COMPANY_SLUG_MAP`:
 *   - 22 active 壽險 (largest market share first)
 *   - 16 海外 / 已歇業 / 簡易壽險 (legacy paper still circulates)
 *   - 21 產險
 *
 * TODO(sync): if `scripts/parse-insurance-database.cjs` COMPANY_SLUG_MAP
 * gets a new key, append it here in the same PR. Sprint 15 admin queue
 * will alert on companyNo drift.
 */
export const COMPANY_OPTIONS: ReadonlyArray<CompanyOption> = [
  // ---- 22 active 壽險 (life, market-share ordered largest → smallest) ----
  { companyNo: 'KT', companySlug: 'cathay-life',        companyName: '國泰人壽',       lineOfBusiness: 'life' },
  { companyNo: 'FP', companySlug: 'fubon-life',         companyName: '富邦人壽',       lineOfBusiness: 'life' },
  { companyNo: 'NS', companySlug: 'nanshan-life',       companyName: '南山人壽',       lineOfBusiness: 'life' },
  { companyNo: 'SK', companySlug: 'shinkong-life',      companyName: '新光人壽',       lineOfBusiness: 'life' },
  { companyNo: 'TW', companySlug: 'taiwan-life',        companyName: '台灣人壽',       lineOfBusiness: 'life' },
  { companyNo: 'CH', companySlug: 'kgi-life',           companyName: '凱基人壽',       lineOfBusiness: 'life' },
  { companyNo: 'SS', companySlug: 'mercuries-life',     companyName: '三商美邦人壽',   lineOfBusiness: 'life' },
  { companyNo: 'PT', companySlug: 'taishin-life',       companyName: '台新人壽',       lineOfBusiness: 'life' },
  { companyNo: 'ML', companySlug: 'transglobe-life',    companyName: '全球人壽',       lineOfBusiness: 'life' },
  { companyNo: 'MR', companySlug: 'ctbc-life',          companyName: '中國信託人壽',   lineOfBusiness: 'life' },
  { companyNo: 'NY', companySlug: 'yuanta-life',        companyName: '元大人壽',       lineOfBusiness: 'life' },
  { companyNo: 'JS', companySlug: 'farglory-life',      companyName: '遠雄人壽',       lineOfBusiness: 'life' },
  { companyNo: 'HF', companySlug: 'hontai-life',        companyName: '宏泰人壽',       lineOfBusiness: 'life' },
  { companyNo: 'AV', companySlug: 'first-life',         companyName: '第一金人壽',     lineOfBusiness: 'life' },
  { companyNo: 'AL', companySlug: 'aia-life',           companyName: '友邦人壽',       lineOfBusiness: 'life' },
  { companyNo: 'TE', companySlug: 'allianz-life',       companyName: '安聯人壽',       lineOfBusiness: 'life' },
  { companyNo: 'AE', companySlug: 'chubb-life',         companyName: '安達人壽',       lineOfBusiness: 'life' },
  { companyNo: 'CD', companySlug: 'bnp-paribas-life',   companyName: '法國巴黎人壽',   lineOfBusiness: 'life' },
  { companyNo: 'CF', companySlug: 'pca-life',           companyName: '保誠人壽',       lineOfBusiness: 'life' },
  { companyNo: 'AN', companySlug: 'ing-life',           companyName: 'ING 安泰人壽',  lineOfBusiness: 'life' },
  { companyNo: 'HK', companySlug: 'tcb-life',           companyName: '合作金庫人壽',   lineOfBusiness: 'life' },
  { companyNo: 'CT', companySlug: 'btli-life',          companyName: '保德信國際人壽', lineOfBusiness: 'life' },

  // ---- 16 海外 / 已歇業 / 簡易壽險 (life, legacy paperwork) ----
  { companyNo: 'PS', companySlug: 'chunghwa-post-life', companyName: '中華郵政簡易壽險', lineOfBusiness: 'life' },
  { companyNo: 'HL', companySlug: 'manulife-life',      companyName: '宏利人壽',       lineOfBusiness: 'life' },
  { companyNo: 'HS', companySlug: 'hsbc-life',          companyName: '匯豐人壽',       lineOfBusiness: 'life' },
  { companyNo: 'CP', companySlug: 'citi-life',          companyName: '花旗人壽',       lineOfBusiness: 'life' },
  { companyNo: 'KI', companySlug: 'axa-life',           companyName: '安盛人壽',       lineOfBusiness: 'life' },
  { companyNo: 'KJ', companySlug: 'cigna-life',         companyName: '信諾人壽',       lineOfBusiness: 'life' },
  { companyNo: 'AG', companySlug: 'aflac-life',         companyName: 'AFLAC 美國家庭人壽', lineOfBusiness: 'life' },
  { companyNo: 'WZ', companySlug: 'zurich-life',        companyName: '蘇黎世人壽',     lineOfBusiness: 'life' },
  { companyNo: 'TR', companySlug: 'transamerica-life',  companyName: '全美人壽',       lineOfBusiness: 'life' },
  { companyNo: 'RT', companySlug: 'aegon-life',         companyName: 'AEGON 人壽',     lineOfBusiness: 'life' },
  { companyNo: 'KP', companySlug: 'kuobao-life',        companyName: '國寶人壽',       lineOfBusiness: 'life' },
  { companyNo: 'KW', companySlug: 'kuo-hua-life',       companyName: '國華人壽',       lineOfBusiness: 'life' },
  { companyNo: 'SF', companySlug: 'singfor-life',       companyName: '幸福人壽',       lineOfBusiness: 'life' },
  { companyNo: 'SN', companySlug: 'chao-yang-life',     companyName: '朝陽人壽',       lineOfBusiness: 'life' },
  { companyNo: 'GR', companySlug: 'georgia-life',       companyName: '佐治亞人壽',     lineOfBusiness: 'life' },
  { companyNo: 'ND', companySlug: 'chubb-tempest',      companyName: '安達國際人壽',   lineOfBusiness: 'life' },

  // ---- 21 產險 (P&C, market-share ordered) ----
  { companyNo: 'AFB',  companySlug: 'fubon-property',            companyName: '富邦產險',         lineOfBusiness: 'pnc' },
  { companyNo: 'AKT',  companySlug: 'cathay-property',           companyName: '國泰世紀產險',     lineOfBusiness: 'pnc' },
  { companyNo: 'ASK',  companySlug: 'shinkong-property',         companyName: '新光產險',         lineOfBusiness: 'pnc' },
  { companyNo: 'AMT',  companySlug: 'mingtai-property',          companyName: '明台產險',         lineOfBusiness: 'pnc' },
  { companyNo: 'AMY',  companySlug: 'nanshan-property',          companyName: '南山產險',         lineOfBusiness: 'pnc' },
  { companyNo: 'AUN',  companySlug: 'wangwang-property',         companyName: '旺旺友聯產險',     lineOfBusiness: 'pnc' },
  { companyNo: 'AWN',  companySlug: 'huanan-property',           companyName: '華南產險',         lineOfBusiness: 'pnc' },
  { companyNo: 'ATN',  companySlug: 'taian-property',            companyName: '泰安產險',         lineOfBusiness: 'pnc' },
  { companyNo: 'ATW',  companySlug: 'taiwan-property',           companyName: '台灣產險',         lineOfBusiness: 'pnc' },
  { companyNo: 'AJF',  companySlug: 'mega-property',             companyName: '兆豐產險',         lineOfBusiness: 'pnc' },
  { companyNo: 'ADE',  companySlug: 'first-property',            companyName: '第一產險',         lineOfBusiness: 'pnc' },
  { companyNo: 'AFP',  companySlug: 'bnp-paribas-property',      companyName: '法巴產險',         lineOfBusiness: 'pnc' },
  { companyNo: 'AIA',  companySlug: 'aig-property',              companyName: 'AIG 美亞產險',     lineOfBusiness: 'pnc' },
  { companyNo: 'ALP',  companySlug: 'long-property',             companyName: '長安產險',         lineOfBusiness: 'pnc' },
  { companyNo: 'AND',  companySlug: 'chubb-property',            companyName: '安達產險',         lineOfBusiness: 'pnc' },
  { companyNo: 'ANS',  companySlug: 'aia-property',              companyName: '友邦產險',         lineOfBusiness: 'pnc' },
  { companyNo: 'ASS',  companySlug: 'hotai-property',            companyName: '和泰產險',         lineOfBusiness: 'pnc' },
  { companyNo: 'ATE',  companySlug: 'uni-allianz-property',      companyName: '統一安聯產險',     lineOfBusiness: 'pnc' },
  { companyNo: 'ATLG', companySlug: 'ctbc-property',             companyName: '中國信託產險',     lineOfBusiness: 'pnc' },
  { companyNo: 'ATY',  companySlug: 'tokio-marine-newa-property', companyName: '東京海上新安產險', lineOfBusiness: 'pnc' },
  { companyNo: 'AWS',  companySlug: 'huashan-property',          companyName: '華山產險',         lineOfBusiness: 'pnc' },
] as const;

/**
 * Convenience lookups. Pre-built so callers don't pay an O(n) scan per
 * lookup when rendering catalog match badges in a list view.
 *
 * Built at module load (no wall-clock dependency), so safe to use in
 * render paths.
 */
export const COMPANY_OPTIONS_BY_NO: ReadonlyMap<string, CompanyOption> = new Map(
  COMPANY_OPTIONS.map((c) => [c.companyNo, c])
);

export const COMPANY_OPTIONS_BY_SLUG: ReadonlyMap<string, CompanyOption> = new Map(
  COMPANY_OPTIONS.map((c) => [c.companySlug, c])
);

/**
 * Get the zh-TW display name for a companyNo or companySlug. Returns
 * `undefined` if the company isn't in the registry — callers should
 * decide whether to show the raw companyNo or "未知保險公司" depending
 * on context (advisor surface vs admin queue).
 */
export function getCompanyName(idOrSlug: string | undefined | null): string | undefined {
  if (!idOrSlug) return undefined;
  return (
    COMPANY_OPTIONS_BY_NO.get(idOrSlug)?.companyName ??
    COMPANY_OPTIONS_BY_SLUG.get(idOrSlug)?.companyName
  );
}
