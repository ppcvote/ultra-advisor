// Sprint 14 W1 — Company picker options for insurance product autocomplete.
//
// Why this file exists:
//   Sprint 13 ingests TII catalog rows whose `companySlug` is derived from a
//   stable map keyed by TII `companyNo` (見 scripts/parse-insurance-database.cjs
//   `COMPANY_SLUG_MAP`). The client side autocomplete (ProductAutocomplete)
//   needs to filter Firestore queries by `companySlug` — not by the loose
//   Chinese company name that `TAIWAN_INSURERS` exposes today (14 entries,
//   mostly 壽險). To keep the picker accurate we mirror the 22 壽險 + 21 產險
//   + 16 海外/已歇業/簡易 ordering and slugs from the crawler-side map here.
//
// Source of truth invariant:
//   When the crawler-side COMPANY_SLUG_MAP is edited, this file MUST be edited
//   in lockstep. We deliberately keep them as two separate constants instead
//   of importing from `scripts/` (CJS, not bundleable into the browser app).
//
// Naming convention:
//   - `slug` is kebab-case ASCII, matches `insurance_products.companySlug`.
//   - `name` is the 繁中 short name as advisors would see it; for legacy /
//     overseas insurers we keep the colloquial 壽險 / 產險 suffix because the
//     dataset itself stores `shortName` that way.
//   - `displayName` (UI-only) appends 壽險/產險 when name alone is ambiguous.

export type CompanyCategory = 'life' | 'property' | 'overseas';

export interface CompanySlugOption {
  /** kebab-case, matches Firestore `insurance_products.companySlug`. */
  slug: string;
  /** 繁中 short name (matches Firestore `company` field). */
  name: string;
  /** UI label for the picker; sometimes equals `name`. */
  displayName: string;
  category: CompanyCategory;
}

/**
 * Ordered list — 22 壽險 → 21 產險 → 16 海外/已歇業/簡易.
 * Mirrors scripts/parse-insurance-database.cjs COMPANY_SLUG_MAP (Sprint 13).
 */
export const COMPANY_SLUG_OPTIONS: readonly CompanySlugOption[] = [
  // ── 22 壽險 ──────────────────────────────────────────────────────────────
  { slug: 'allianz-life', name: '安聯人壽', displayName: '安聯人壽', category: 'life' },
  { slug: 'fubon-life', name: '富邦人壽', displayName: '富邦人壽', category: 'life' },
  { slug: 'bnp-paribas-life', name: '法巴人壽', displayName: '法巴人壽', category: 'life' },
  { slug: 'cathay-life', name: '國泰人壽', displayName: '國泰人壽', category: 'life' },
  { slug: 'taiwan-life', name: '台灣人壽', displayName: '台灣人壽', category: 'life' },
  { slug: 'kgi-life', name: '凱基人壽', displayName: '凱基人壽', category: 'life' },
  { slug: 'chubb-life', name: '安達人壽', displayName: '安達人壽', category: 'life' },
  { slug: 'shinkong-life', name: '新光人壽', displayName: '新光人壽', category: 'life' },
  { slug: 'nanshan-life', name: '南山人壽', displayName: '南山人壽', category: 'life' },
  { slug: 'pca-life', name: '保誠人壽', displayName: '保誠人壽', category: 'life' },
  { slug: 'tcb-life', name: '合作金庫人壽', displayName: '合作金庫人壽', category: 'life' },
  { slug: 'mercuries-life', name: '三商美邦人壽', displayName: '三商美邦人壽', category: 'life' },
  { slug: 'farglory-life', name: '遠雄人壽', displayName: '遠雄人壽', category: 'life' },
  { slug: 'first-life', name: '第一金人壽', displayName: '第一金人壽', category: 'life' },
  { slug: 'transglobe-life', name: '全球人壽', displayName: '全球人壽', category: 'life' },
  { slug: 'ctbc-life', name: '中國信託人壽', displayName: '中國信託人壽', category: 'life' },
  { slug: 'taishin-life', name: '台新人壽', displayName: '台新人壽', category: 'life' },
  { slug: 'yuanta-life', name: '元大人壽', displayName: '元大人壽', category: 'life' },
  { slug: 'ing-life', name: 'ING 安泰人壽', displayName: 'ING 安泰人壽', category: 'life' },
  { slug: 'hontai-life', name: '宏泰人壽', displayName: '宏泰人壽', category: 'life' },
  { slug: 'btli-life', name: '彰銀人壽', displayName: '彰銀人壽', category: 'life' },
  { slug: 'aia-life', name: '友邦人壽', displayName: '友邦人壽', category: 'life' },

  // ── 21 產險 ──────────────────────────────────────────────────────────────
  { slug: 'first-property', name: '第一產物', displayName: '第一產物', category: 'property' },
  { slug: 'fubon-property', name: '富邦產物', displayName: '富邦產物', category: 'property' },
  { slug: 'bnp-paribas-property', name: '法巴產物', displayName: '法巴產物', category: 'property' },
  { slug: 'aig-property', name: 'AIG 產物', displayName: 'AIG 產物', category: 'property' },
  { slug: 'mega-property', name: '兆豐產物', displayName: '兆豐產物', category: 'property' },
  { slug: 'cathay-property', name: '國泰產物', displayName: '國泰產物', category: 'property' },
  { slug: 'long-property', name: '旺旺友聯產物', displayName: '旺旺友聯產物', category: 'property' },
  { slug: 'mingtai-property', name: '明台產物', displayName: '明台產物', category: 'property' },
  { slug: 'nanshan-property', name: '南山產物', displayName: '南山產物', category: 'property' },
  { slug: 'chubb-property', name: '安達產物', displayName: '安達產物', category: 'property' },
  { slug: 'aia-property', name: '友邦產物', displayName: '友邦產物', category: 'property' },
  { slug: 'shinkong-property', name: '新光產物', displayName: '新光產物', category: 'property' },
  { slug: 'hotai-property', name: '和泰產物', displayName: '和泰產物', category: 'property' },
  { slug: 'uni-allianz-property', name: '聯邦安聯產物', displayName: '聯邦安聯產物', category: 'property' },
  { slug: 'ctbc-property', name: '中國信託產物', displayName: '中國信託產物', category: 'property' },
  { slug: 'taian-property', name: '泰安產物', displayName: '泰安產物', category: 'property' },
  { slug: 'taiwan-property', name: '台灣產物', displayName: '台灣產物', category: 'property' },
  { slug: 'tokio-marine-newa-property', name: '東京海上日動產物', displayName: '東京海上日動產物', category: 'property' },
  { slug: 'wangwang-property', name: '旺旺產物', displayName: '旺旺產物', category: 'property' },
  { slug: 'huanan-property', name: '華南產物', displayName: '華南產物', category: 'property' },
  { slug: 'huashan-property', name: '華山產物', displayName: '華山產物', category: 'property' },

  // ── 16 海外 / 已歇業 / 簡易壽險 ─────────────────────────────────────────
  { slug: 'aflac-life', name: 'Aflac 美國保壽', displayName: 'Aflac 美國保壽', category: 'overseas' },
  { slug: 'citi-life', name: '花旗人壽', displayName: '花旗人壽', category: 'overseas' },
  { slug: 'georgia-life', name: '喬治亞人壽', displayName: '喬治亞人壽', category: 'overseas' },
  { slug: 'manulife-life', name: '宏利人壽', displayName: '宏利人壽', category: 'overseas' },
  { slug: 'hsbc-life', name: '匯豐人壽', displayName: '匯豐人壽', category: 'overseas' },
  { slug: 'axa-life', name: '安盛人壽', displayName: '安盛人壽', category: 'overseas' },
  { slug: 'cigna-life', name: 'Cigna 信諾人壽', displayName: 'Cigna 信諾人壽', category: 'overseas' },
  { slug: 'kuobao-life', name: '國寶人壽', displayName: '國寶人壽', category: 'overseas' },
  { slug: 'kuo-hua-life', name: '國華人壽', displayName: '國華人壽', category: 'overseas' },
  { slug: 'chunghwa-post-life', name: '中華郵政簡易壽險', displayName: '中華郵政簡易壽險', category: 'overseas' },
  { slug: 'aegon-life', name: 'Aegon 全球人壽', displayName: 'Aegon 全球人壽', category: 'overseas' },
  { slug: 'singfor-life', name: '幸福人壽', displayName: '幸福人壽', category: 'overseas' },
  { slug: 'chao-yang-life', name: '朝陽人壽', displayName: '朝陽人壽', category: 'overseas' },
  { slug: 'transamerica-life', name: 'Transamerica', displayName: 'Transamerica 環球人壽', category: 'overseas' },
  { slug: 'zurich-life', name: '蘇黎世人壽', displayName: '蘇黎世人壽', category: 'overseas' },
  { slug: 'chubb-tempest', name: '安達 Tempest', displayName: '安達 Tempest', category: 'overseas' },
] as const;

/** Category labels for grouped Select rendering. */
export const COMPANY_CATEGORY_LABELS: Record<CompanyCategory, string> = {
  life: '壽險',
  property: '產險',
  overseas: '海外 / 已歇業 / 簡易壽險',
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a `companySlug` from a Chinese company name. Falls back to a loose
 * prefix/substring match because the inbound name might come from
 * `TAIWAN_INSURERS` (14 entries, slightly different wording) or the OCR
 * parser (which echoes whatever the policy PDF printed).
 *
 * Returns `null` when no confident match exists — callers should treat that
 * as "cross-company search" rather than guessing.
 */
export function resolveCompanySlugByName(name: string | null | undefined): string | null {
  if (!name) return null;
  const needle = name.trim();
  if (!needle) return null;

  // 1. Exact name match.
  const exact = COMPANY_SLUG_OPTIONS.find((o) => o.name === needle);
  if (exact) return exact.slug;

  // 2. displayName match (rare, but safe).
  const display = COMPANY_SLUG_OPTIONS.find((o) => o.displayName === needle);
  if (display) return display.slug;

  // 3. Loose contains — only when needle is reasonably long, to avoid
  //    accidentally matching "人壽" against every life insurer.
  if (needle.length >= 3) {
    const contains = COMPANY_SLUG_OPTIONS.find(
      (o) => o.name.includes(needle) || needle.includes(o.name)
    );
    if (contains) return contains.slug;
  }

  return null;
}

/** Get the full option record (name + category) for a known slug. */
export function getCompanyOptionBySlug(
  slug: string | null | undefined
): CompanySlugOption | null {
  if (!slug) return null;
  return COMPANY_SLUG_OPTIONS.find((o) => o.slug === slug) ?? null;
}
