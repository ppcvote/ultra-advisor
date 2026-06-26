#!/usr/bin/env node
/**
 * parse-insurance-database.cjs
 *
 * Sprint 13 / Task A — 串流解析 35,823 筆 JSONL → UA 自家 catalog JSON。
 *
 * 戰略邊界 (HARD RULES — 對應 Phase 1 表 A)：
 *   ✅ SAFE 灌 production (純事實、保險公司向 TII 法定報送)：
 *      companyNo, shortName, insName, mark, dispMark, dispClass,
 *      saled, saleTo, master, insType, inc, minVal, maxVal, unit, unitScale,
 *      maxAge, fullLife, natureCost, startDate, modifyDate
 *      + UA 自抽 categoryMain (keyword 規則)
 *      + UA 自抽 keywordsRaw (僅切分、不重排)
 *      + UA 自抽 companySlug
 *   ❌ 絕不抽 (上游 editorial)：
 *      detail_info.intrude / premiums / lawDisplay / pdfUrl
 *      detail_markdown / premiums_markdown / local_pdf_path
 *   ❌ 廢欄位 (本批 100% 為 0 或無意義)：
 *      type, iMoney
 *
 *   小欄位 (Phase 2 sniff 補齊、僅事實)：
 *      endDate (33% coverage) → discontinuedDate
 *      usedCurrency (14% coverage) → currency code (e.g. TWD/USD/AUD)
 *
 *   `source: 'tii'` 固定字串 — 這些商品都向 TII 法定報送、UA 從 dataset 抽純事實。
 *   絕不輸出 'cloudwinner' / '保險贏家' 字串到 JSON / 註解 / log。
 *
 * Time-handling rule:
 *   `generatedAt` (epoch ms) 在 main() callback 內取 — 對齊 Sprint 12 convention
 *   (src/lib/insuranceProducts.ts file header)。
 *
 * 依賴：
 *   Node.js built-in only (readline, fs, path)。不引入新 npm (鐵則)。
 *
 * CLI：
 *   node scripts/parse-insurance-database.cjs <input.jsonl> [--output <file>]
 *                                                          [--limit N]
 *                                                          [--dry-run]
 *                                                          [--stats-only]
 *
 * 預設:
 *   input  = c:/Users/User/insurance-db/insurance_products_clean.jsonl
 *   output = scripts/ua-insurance-catalog.json
 */

'use strict'

const fs = require('fs')
const path = require('path')
const readline = require('readline')

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const DEFAULT_INPUT = 'c:/Users/User/insurance-db/insurance_products_clean.jsonl'
const DEFAULT_OUTPUT = path.resolve(__dirname, 'ua-insurance-catalog.json')

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    limit: null,
    dryRun: false,
    statsOnly: false,
  }
  const rest = argv.slice(2)
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (a === '--output' || a === '-o') { args.output = path.resolve(rest[++i]); continue }
    if (a === '--limit') { args.limit = Number(rest[++i]); continue }
    if (a === '--dry-run') { args.dryRun = true; continue }
    if (a === '--stats-only') { args.statsOnly = true; continue }
    if (a === '--help' || a === '-h') { printHelp(); process.exit(0) }
    if (!a.startsWith('--')) { args.input = path.resolve(a); continue }
  }
  return args
}

function printHelp() {
  process.stdout.write(`
parse-insurance-database.cjs — 串流解析 JSONL → UA catalog JSON

Usage:
  node scripts/parse-insurance-database.cjs [input.jsonl] [options]

Options:
  --output <file>   Output JSON path (default: scripts/ua-insurance-catalog.json)
  --limit N         Only process first N records (testing)
  --dry-run         Run pipeline, print stats, do NOT write output file
  --stats-only      Only analyze field distribution, no mapping / no output
  -h, --help        Show this

`)
}

// ---------------------------------------------------------------------------
// Company slug map — Phase 1 表 E1
// ---------------------------------------------------------------------------

// Full 59-company slug map. Sprint 13 critic flagged that the original
// 22-entry map left 16.4% of records (5,894) falling to the `co-{xx}`
// fallback — opaque slugs leaking into Firestore doc IDs and public-facing
// URL space. Extended to cover all 59 companyNo values observed in the
// JSONL (22 壽險 + 21 產險 + 16 misc 海外/小型).
const COMPANY_SLUG_MAP = {
  // 22 壽險
  TE: 'allianz-life',
  FP: 'fubon-life',
  CD: 'bnp-paribas-life',
  KT: 'cathay-life',
  TW: 'taiwan-life',
  CH: 'kgi-life',
  AE: 'chubb-life',
  SK: 'shinkong-life',
  NS: 'nanshan-life',
  CF: 'pca-life',
  HK: 'tcb-life',
  SS: 'mercuries-life',
  JS: 'fubon-far-eastern',
  AV: 'first-life',
  ML: 'transglobe-life',
  MR: 'ctbc-life',
  PT: 'taishin-life',
  NY: 'yuanta-life',
  AN: 'ing-life',
  HF: 'hontai-life',
  CT: 'btli-life',
  AL: 'aia-life',
  // 海外 / 已歇業 / 簡易壽險 (16)
  AG: 'aflac-life',
  CP: 'citi-life',
  GR: 'georgia-life',
  HL: 'manulife-life',
  HS: 'hsbc-life',
  KI: 'axa-life',
  KJ: 'cigna-life',
  KP: 'globalbao-life',
  KW: 'kuo-hua-life',
  PS: 'chunghwa-post-life',
  RT: 'ruentex-life',
  SF: 'singfor-life',
  SN: 'chao-yang-life',
  TR: 'transamerica-life',
  WZ: 'zurich-life',
  ND: 'chubb-tempest',
  // 21 產險
  ADE: 'first-property',
  AFB: 'fubon-property',
  AFP: 'bnp-paribas-property',
  AIA: 'aig-property',
  AJF: 'mega-property',
  AKT: 'cathay-property',
  ALP: 'long-property',
  AMT: 'mingtai-property',
  AMY: 'nanshan-property',
  AND: 'chubb-property',
  ANS: 'aia-property',
  ASK: 'shinkong-property',
  ASS: 'hotai-property',
  ATE: 'uni-allianz-property',
  ATLG: 'ctbc-property',
  ATN: 'taian-property',
  ATW: 'taiwan-property',
  ATY: 'tokio-marine-newa-property',
  AUN: 'wangwang-property',
  AWN: 'huanan-property',
  AWS: 'huashan-property',
}

function deriveCompanySlug(companyNo, shortName) {
  if (COMPANY_SLUG_MAP[companyNo]) return COMPANY_SLUG_MAP[companyNo]
  // fallback: companyNo lowercase — 安全、可預測、不需擴表
  // 若公司名含英文、優先用 shortName 轉 kebab；否則用 companyNo lowercase。
  if (shortName && typeof shortName === 'string') {
    const ascii = shortName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    if (ascii && /[a-z]/.test(ascii)) return `${ascii}-${String(companyNo).toLowerCase()}`
  }
  return `co-${String(companyNo || 'unknown').toLowerCase()}`
}

// ---------------------------------------------------------------------------
// id slugify — Phase 1 表 C
// ---------------------------------------------------------------------------

// Phase 1 表 C 的 slugify 只處理 $ . / 三個字元，但實測 35,823 筆裡 SK + CH
// 還會用 % & @ ! # ( ) + 等單字元 ASCII 標點當不同商品代碼 (e.g. SK W / W! / W#
// / W% / W& / W( / W) / W@ 是 7 個不同的豁免附約)。第一輪實跑出 22 起 id 衝突
// — 全部都是這類 punctuation suffix 被 strip 掉。改成把這些字元也明文 map 成
// 可讀後綴、保留商品唯一性。
const MARK_CHAR_MAP = {
  '$': 'dollarsign',
  '.': '-dot',
  '/': '-slash',
  '%': '-pct',
  '&': '-amp',
  '@': '-at',
  '!': '-bang',
  '#': '-hash',
  '(': '-lp',
  ')': '-rp',
  '+': '-plus',
  '*': '-star',
  '?': '-q',
  '<': '-lt',
  '>': '-gt',
  '=': '-eq',
  ':': '-col',
  ';': '-sc',
  ',': '-cma',
  '\\': '-bs',
  '|': '-pipe',
  '~': '-tld',
  '^': '-crt',
  '"': '-dq',
  "'": '-sq',
  '`': '-bt',
  '[': '-lb',
  ']': '-rb',
  '{': '-lc',
  '}': '-rc',
}

function slugifyMark(mark) {
  if (!mark || typeof mark !== 'string') return ''
  let out = ''
  for (const ch of mark.toLowerCase()) {
    if (/[a-z0-9\-]/.test(ch)) { out += ch; continue }
    if (/\s/.test(ch)) { out += '-'; continue }
    const mapped = MARK_CHAR_MAP[ch]
    if (mapped) { out += mapped; continue }
    // CJK / 其他字元: 一律 drop (本批 35k 觀察 mark 內 0 CJK、不會 hit)
  }
  return out
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// id 必須用 mark 而非 dispMark —— 實測 35,823 筆:
//   - (companyNo, mark) 100% unique (0 dup)
//   - (companyNo, dispMark) 有 3,085 重複 (dispMark 是 UI 用顯示碼、會多碼共用)
// Phase 1 表 A 結論正確: mark = productCode (natural key, raw preserved)。
// 因 mark 常含 $ % & @ ! 等 punctuation, 改進 slugify 用 MARK_CHAR_MAP 明文編碼,
// 確認 35k 全集 0 衝突。
function buildProductId(companyNo, mark) {
  const slug = slugifyMark(mark)
  return `tii_${String(companyNo || 'unknown')}_${slug || 'unknown'}`
}

// ---------------------------------------------------------------------------
// Category mapping — Phase 1 表 B (two-stage)
// ---------------------------------------------------------------------------

// Stage 1: keyword → categoryMain (first-match-wins, priority order)
const KEYWORD_CATEGORY_RULES = [
  { test: (kw) => kw.includes('投資型'), value: 'investmentLinked' },
  {
    test: (kw) =>
      kw.includes('利率變動型年金') || kw.includes('遞延年金') ||
      kw.includes('即期年金') || kw.includes('年金'),
    value: 'annuity',
  },
  { test: (kw) => kw.includes('長期看護') || kw.includes('長照'), value: 'longTermCare' },
  {
    test: (kw) =>
      kw.includes('重大疾病') || kw.includes('特定傷病') || kw.includes('防癌'),
    value: 'critical',
  },
  {
    test: (kw) => kw.includes('喪失工作能力') || kw.includes('意外失能'),
    value: 'disability',
  },
  {
    test: (kw) =>
      kw.includes('傷害保險') || kw.includes('意外保險') ||
      kw.includes('意外醫療') || kw.includes('旅平險'),
    value: 'accident',
  },
  {
    test: (kw) =>
      kw.includes('醫療保障') || kw.includes('健康保險') ||
      kw.includes('終身醫療') || kw.includes('實支實付') ||
      kw.includes('定額醫療') || kw.includes('老年醫療') ||
      kw.includes('醫療日額'),
    value: 'medical',
  },
  {
    test: (kw) =>
      kw.includes('儲蓄') || kw.includes('養老') ||
      kw.includes('還本') || kw.includes('教育準備'),
    value: 'savings',
  },
  { test: (kw) => kw.includes('房貸保險') || kw.includes('壽險'), value: 'life' },
]

// Stage 2: dispClass → categoryMain fallback (when keyword has no 險種 token)
const DISPCLASS_CATEGORY_FALLBACK = {
  A: 'life',
  V: 'investmentLinked',
  G: 'accident',
  S: 'annuity',
  J: 'medical',
  M: 'critical',
  D: 'life',
  P: 'riderWaiver',
  X: 'pnc',
  Y: 'pnc',
  Z: 'endorsement',
}

function classifyCategory(keywordRaw, dispClass) {
  const kw = typeof keywordRaw === 'string' ? keywordRaw : ''
  // Sprint 13 critic Q4: dispClass=P (豁免附約) 必須在 keyword 險種規則之前判
  // 定。原本只在 keyword 為空時走 fallback、導致 keyword='壽險;豁免' 的豁免
  // 附約被誤分類為 `life` (進 production 假裝是壽險商品)。豁免條款是依附在
  // 別張主約上的附約、不該獨立列為壽險選項。
  // 同理 dispClass=Z (批註條款) 也應提前 short-circuit 到 research-only。
  if (dispClass === 'P') return { categoryMain: 'riderWaiver', fallbackUsed: true }
  if (dispClass === 'Z') return { categoryMain: 'endorsement', fallbackUsed: true }
  if (kw) {
    for (const rule of KEYWORD_CATEGORY_RULES) {
      if (rule.test(kw)) return { categoryMain: rule.value, fallbackUsed: false }
    }
  }
  const fb = DISPCLASS_CATEGORY_FALLBACK[dispClass]
  if (fb) return { categoryMain: fb, fallbackUsed: true }
  return { categoryMain: 'unclassified', fallbackUsed: true }
}

// research-only categories — 不灌 production
const RESEARCH_ONLY_CATEGORIES = new Set(['endorsement'])

// Sprint 12 InsuranceCategoryMain closed union — Sprint 13 加了
// savings / riderWaiver / pnc / endorsement / unclassified；
// 這些是 Sprint 13 catalog 內部欄位、Sprint 12 InsuranceProduct 寫入時需先
// 過濾 (見 categoryMainForProduct)。
const SPRINT12_VALID_CATEGORIES = new Set([
  'life', 'medical', 'critical', 'accident',
  'disability', 'longTermCare', 'annuity', 'investmentLinked',
])

// ---------------------------------------------------------------------------
// keyword split (raw, no editorial reordering)
// ---------------------------------------------------------------------------

function splitKeywords(raw) {
  if (!raw || typeof raw !== 'string') return []
  // 來源用 `;` 分隔、含 `/` 子層 (e.g. "傷害保險/意外保險") — 不再切 `/`，保留原 token
  const tokens = raw.split(/[;；]/).map((s) => s.trim()).filter(Boolean)
  // 去重 (保留首現順序)
  const seen = new Set()
  const out = []
  for (const t of tokens) {
    if (!seen.has(t)) { seen.add(t); out.push(t) }
  }
  return out
}

// ---------------------------------------------------------------------------
// saleTo bitmask → channels[]  (Phase 1 表 E2)
// ---------------------------------------------------------------------------
//
// 觀察值: 0 / 1 / 10 / 110 / 1010 / 1110 (decimal digits read as bit positions)
// 約定: 位元 1=個人, 2=團體, 3=海外, 4=勞工 — 由觀察 dispClass + saleTo 推得
//   10   → 個人
//   110  → 個人+團體
//   1010 → 個人+海外
//   1110 → 個人+團體+勞工
//   1    → 團體 only
//   0    → unknown
//
// 解法：把 saleTo 轉字串、由右至左 (digit[0]=保留, digit[1]=個人, [2]=團體, [3]=海外, [4]=勞工)
function decodeChannels(saleTo) {
  if (saleTo === 0 || saleTo === undefined || saleTo === null) return ['unknown']
  const s = String(saleTo)
  // digit[0] 是個位、digit[1] 十位…
  const digits = s.split('').reverse() // index 0 = 個位
  const out = []
  if (digits[1] === '1') out.push('individual')
  if (digits[2] === '1') out.push('group')
  if (digits[3] === '1') out.push('overseas')
  if (digits[4] === '1') out.push('labor')
  // 邊角: saleTo=1 (個位=1) — 視為 group only (對齊表 E2)
  if (out.length === 0 && digits[0] === '1') out.push('group')
  if (out.length === 0) out.push('unknown')
  return out
}

// ---------------------------------------------------------------------------
// effectiveDate / modifyDate normalize
// ---------------------------------------------------------------------------
//
// startDate 來源格式: "1997-03-03T00:00:00" 或 null  (34.8% null)
// modifyDate 來源格式: "2024-10-21T10:57:31.92" (100% 有值，微秒可能 .92 / .493)
//
// 輸出: ISO date only (yyyy-mm-dd) for effectiveDate (Sprint 12 規格)
//       modifyDate 保留完整 ISO timestamp (帶 Z)

function toISODateOnly(raw) {
  if (!raw || typeof raw !== 'string') return null
  // "1997-03-03T00:00:00" → "1997-03-03"
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

function toISOTimestamp(raw) {
  if (!raw || typeof raw !== 'string') return null
  // 來源無 timezone — 視為當地時間、轉成 ISO (不加 Z 避免時區誤導)
  // "2024-10-21T10:57:31.92" → 直接保留 (downstream 用 Date() parse 即可)
  return raw
}

// ---------------------------------------------------------------------------
// status derivation
// ---------------------------------------------------------------------------

function deriveStatus(saled) {
  // Sprint 12 ProductStatus union: 'active' | 'discontinued' | 'revised'
  // 來源無 revised 訊號 → 只在 active / discontinued 之間
  if (saled === true) return 'active'
  if (saled === false) return 'discontinued'
  // unknown — 預設 discontinued (保守、不誤導顧問報 active)
  return 'discontinued'
}

// ---------------------------------------------------------------------------
// unit normalization — 32 種 (unit, unitScale) 組合 → 抽 amountPerUnit / displayUnit
// ---------------------------------------------------------------------------

function normalizeUnit(unit, unitScale) {
  // unit raw e.g. "萬元" "千元" "百元" "元" "計劃" "單位" "口"
  // unitScale 是金額換算 (e.g. 萬元=10000)、unit='計劃' 時 scale 可能還是 10000、語意不同
  const u = typeof unit === 'string' ? unit.trim() : ''
  const scale = typeof unitScale === 'number' ? unitScale : null

  let unitType = 'money' // 'money' | 'plan' | 'count' | 'unknown'
  let displayUnit = u || '元'

  if (u === '計劃' || u === '計畫') {
    unitType = 'plan'
    displayUnit = '計劃'
  } else if (u === '單位' || u === '口') {
    unitType = 'count'
    displayUnit = u
  } else if (u && /元$/.test(u)) {
    unitType = 'money'
    displayUnit = u
  } else if (u) {
    unitType = 'unknown'
    displayUnit = u
  }

  return {
    unitType,
    displayUnit,
    amountPerUnit: scale,
  }
}

// ---------------------------------------------------------------------------
// minVal / maxVal — maxVal=0 → unbounded (Phase 1 表 D)
// ---------------------------------------------------------------------------

function normMin(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return null
  return v
}

function normMax(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return null
  if (v === 0) return null // unbounded
  return v
}

function normMaxAge(v) {
  if (typeof v !== 'number' || Number.isNaN(v) || v === 0) return null
  return v
}

// ---------------------------------------------------------------------------
// record → UA product entry
// ---------------------------------------------------------------------------

function recordToEntry(rec, ctx) {
  // ctx = { generatedAt, sourceFile }
  const errors = []

  // 必要欄位驗證
  if (!rec || typeof rec !== 'object') { errors.push('record-not-object'); return { entry: null, errors } }
  const companyNo = rec.companyNo
  const mark = rec.mark
  if (!companyNo || typeof companyNo !== 'string') { errors.push('missing-companyNo'); return { entry: null, errors } }
  if (!mark || typeof mark !== 'string') { errors.push('missing-mark'); return { entry: null, errors } }
  if (!rec.insName || typeof rec.insName !== 'string') { errors.push('missing-insName'); return { entry: null, errors } }

  const id = buildProductId(companyNo, mark)
  const companySlug = deriveCompanySlug(companyNo, rec.shortName)
  const { categoryMain, fallbackUsed } = classifyCategory(rec.keyword, rec.dispClass)
  const keywordsRaw = splitKeywords(rec.keyword)
  const unitNorm = normalizeUnit(rec.unit, rec.unitScale)
  const channels = decodeChannels(rec.saleTo)
  const effectiveDate = toISODateOnly(rec.startDate)
  const discontinuedDate = toISODateOnly(rec.endDate)
  const modifyDate = toISOTimestamp(rec.modifyDate)
  const status = deriveStatus(rec.saled)
  const currency = (typeof rec.usedCurrency === 'string' && rec.usedCurrency.trim()) || 'TWD'

  // categorySub — 從 keywordsRaw 撿含 "/" 的 token (e.g. "傷害保險/意外保險")
  // 找不到就 fallback 用 dispClass 標記
  let categorySub = null
  for (const t of keywordsRaw) {
    if (t.includes('/')) { categorySub = t; break }
  }

  // 是否 production-safe (Sprint 12 InsuranceCategoryMain closed union)
  const productionSafe = SPRINT12_VALID_CATEGORIES.has(categoryMain) &&
                         !RESEARCH_ONLY_CATEGORIES.has(categoryMain)

  // 對齊 Sprint 12 InsuranceProduct interface
  const entry = {
    // ── Sprint 12 InsuranceProduct required fields ──
    id,
    company: rec.shortName || null,
    companySlug,
    productName: rec.insName,
    // productCode = mark (natural key, 100% unique within company; raw preserved)
    productCode: mark,
    categoryMain,
    status,
    source: 'tii',
    // sourceUrl: 用 TII 商品查詢入口 (insprod.tii.org.tw)。Sprint 13 critic
    // 指出 nlic.tii.org.tw 是金融檔案館、非商品 DB —— 那是 misrepresentation
    // 風險。改用 insprod.tii.org.tw 對齊 ingest 端 (TII_BASE)，下游 crawler
    // 若有 deep link 再 overwrite。
    sourceUrl: 'https://insprod.tii.org.tw/',
    crawledAt: ctx.generatedAt,
    crawlerVersion: 'tii-bulk-v1',
    schemaVersion: 1,

    // ── Sprint 12 optional fields ──
    categorySub: categorySub || undefined,
    effectiveDate: effectiveDate || undefined,
    // pdfStoragePath / pdfSha256: 留空 — Sprint 13 不上傳 PDF 給客戶

    // ── Sprint 13 catalog enrichments (additive) ──
    companyNo,
    // displayCode = dispMark (UI 顯示碼，例 SK 的 D1A 對應 mark `$`)
    // 注意：dispMark 在同公司內可重複 (3,085 dup/35k)，僅供顯示、勿當 key
    displayCode: rec.dispMark || mark,
    dispClass: rec.dispClass || null,
    lineOfBusiness: rec.insType === 1 ? 'pnc' : 'life',
    keywordsRaw,
    channels,
    isMaster: rec.master === true,
    isWholeLife: rec.fullLife === true,
    isNaturalRate: rec.natureCost === true,
    hasIncrement: rec.inc === 1 || rec.inc === true,
    saled: rec.saled === true,
    minSumAssured: normMin(rec.minVal),
    maxSumAssured: normMax(rec.maxVal),
    maxAge: normMaxAge(rec.maxAge),
    currencyUnit: rec.unit || null,
    scale: typeof rec.unitScale === 'number' ? rec.unitScale : null,
    unitType: unitNorm.unitType,
    displayUnit: unitNorm.displayUnit,
    amountPerUnit: unitNorm.amountPerUnit,
    currency,
    discontinuedDate: discontinuedDate || undefined,
    sourceUpdatedAt: modifyDate,

    // ── provenance ──
    // sourceNote: Sprint 13 legal critic 指出原文「商品向 TII 法定報送」措辭
    // 含糊、若被審查可能被視為對 provenance 之 misrepresentation。改用更精
    // 確語言：商品代碼/規格/生效日為保險公司依保險法 §144 向主管機關備查
    // 之公開資訊 —— 純事實陳述、可舉證。注意此欄位不在 ingest WRITE_WHITELIST
    // 內、不會寫入 Firestore；保留在本地 JSON 供 audit/debug。
    sourceNote: 'Bulk import 2026-06-26 — 商品代碼/規格/生效日為保險公司依保險法 §144 向主管機關備查之公開資訊',

    // ── parser-internal flags ──
    _categoryFallbackUsed: fallbackUsed,
    _productionSafe: productionSafe,
    _researchOnly: RESEARCH_ONLY_CATEGORIES.has(categoryMain),
  }

  return { entry, errors }
}

// ---------------------------------------------------------------------------
// Field distribution analyzer (--stats-only mode)
// ---------------------------------------------------------------------------

function newFieldStats() {
  return {
    seenKeys: new Map(),     // key → count
    typeByKey: new Map(),    // key → Map<typeName,count>
    distinctSamples: new Map(), // key → Set<string> (max 50)
  }
}

function observeRecord(rec, fs_) {
  if (!rec || typeof rec !== 'object') return
  for (const [k, v] of Object.entries(rec)) {
    fs_.seenKeys.set(k, (fs_.seenKeys.get(k) || 0) + 1)
    const tname = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v
    if (!fs_.typeByKey.has(k)) fs_.typeByKey.set(k, new Map())
    const tm = fs_.typeByKey.get(k)
    tm.set(tname, (tm.get(tname) || 0) + 1)
    if (tname === 'string' || tname === 'number' || tname === 'boolean') {
      if (!fs_.distinctSamples.has(k)) fs_.distinctSamples.set(k, new Set())
      const ss = fs_.distinctSamples.get(k)
      if (ss.size < 50) ss.add(String(v).slice(0, 60))
    }
  }
}

function printFieldStats(fs_, total) {
  const out = []
  out.push('')
  out.push('=== field distribution ===')
  const keys = [...fs_.seenKeys.entries()].sort((a, b) => b[1] - a[1])
  for (const [k, n] of keys) {
    const types = [...fs_.typeByKey.get(k).entries()]
      .map(([t, c]) => `${t}:${c}`).join(' ')
    const pct = ((n / total) * 100).toFixed(1)
    out.push(`  ${k.padEnd(28)} ${String(n).padStart(6)}  (${pct}%)  [${types}]`)
  }
  process.stdout.write(out.join('\n') + '\n')
}

// ---------------------------------------------------------------------------
// Stats accumulator (main mapping mode)
// ---------------------------------------------------------------------------

function newStats() {
  return {
    total: 0,
    success: 0,
    skipped: { 'record-not-object': 0, 'missing-companyNo': 0, 'missing-mark': 0, 'missing-insName': 0, 'parse-error': 0 },
    byCompany: {},
    byCategory: {},
    byLineOfBusiness: { life: 0, pnc: 0 },
    byStatus: { active: 0, discontinued: 0, revised: 0 },
    nullFields: {
      startDate: 0, modifyDate: 0, keyword: 0, maxAge: 0, maxVal_zero: 0,
    },
    categoryFallbackUsed: 0,
    researchOnly: 0,
    productionSafe: 0,
    idCollisions: 0,
    seenIds: new Set(),
  }
}

function accumulate(stats, entry, raw) {
  stats.total++
  if (!entry) return
  if (stats.seenIds.has(entry.id)) {
    stats.idCollisions++
  } else {
    stats.seenIds.add(entry.id)
  }
  stats.success++
  stats.byCompany[entry.company || '(unknown)'] =
    (stats.byCompany[entry.company || '(unknown)'] || 0) + 1
  stats.byCategory[entry.categoryMain] =
    (stats.byCategory[entry.categoryMain] || 0) + 1
  stats.byLineOfBusiness[entry.lineOfBusiness]++
  stats.byStatus[entry.status]++
  if (entry._categoryFallbackUsed) stats.categoryFallbackUsed++
  if (entry._researchOnly) stats.researchOnly++
  if (entry._productionSafe) stats.productionSafe++

  // null-field counts (from raw record, more reliable)
  if (!raw.startDate) stats.nullFields.startDate++
  if (!raw.modifyDate) stats.nullFields.modifyDate++
  if (!raw.keyword) stats.nullFields.keyword++
  if (!raw.maxAge || raw.maxAge === 0) stats.nullFields.maxAge++
  if (raw.maxVal === 0) stats.nullFields.maxVal_zero++
}

function finalizeStats(stats) {
  // 結束時不要把 seenIds 寫出去 (太大)
  const out = {
    total: stats.total,
    success: stats.success,
    skipped: stats.skipped,
    idCollisions: stats.idCollisions,
    categoryFallbackUsed: stats.categoryFallbackUsed,
    researchOnly: stats.researchOnly,
    productionSafe: stats.productionSafe,
    byCompany: stats.byCompany,
    byCategory: stats.byCategory,
    byLineOfBusiness: stats.byLineOfBusiness,
    byStatus: stats.byStatus,
    nullFields: stats.nullFields,
  }
  return out
}

function printStatsReport(stats) {
  const lines = []
  lines.push('')
  lines.push('=== parse-insurance-database report ===')
  lines.push(`total records read:    ${stats.total}`)
  lines.push(`mapped (success):      ${stats.success}`)
  lines.push(`skipped:`)
  for (const [reason, n] of Object.entries(stats.skipped)) {
    if (n > 0) lines.push(`  ${reason.padEnd(24)} ${n}`)
  }
  lines.push(`id collisions:         ${stats.idCollisions}`)
  lines.push(`category fallback:     ${stats.categoryFallbackUsed} (used dispClass when keyword had no 險種 token)`)
  lines.push(`production-safe:       ${stats.productionSafe}`)
  lines.push(`research-only:         ${stats.researchOnly}`)
  lines.push('')
  lines.push(`line of business:      life=${stats.byLineOfBusiness.life}  pnc=${stats.byLineOfBusiness.pnc}`)
  lines.push(`status:                active=${stats.byStatus.active}  discontinued=${stats.byStatus.discontinued}  revised=${stats.byStatus.revised}`)
  lines.push('')
  lines.push('by category (UA main):')
  const cats = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])
  for (const [c, n] of cats) lines.push(`  ${String(n).padStart(6)}  ${c}`)
  lines.push('')
  lines.push('top 15 companies by product count:')
  const cos = Object.entries(stats.byCompany).sort((a, b) => b[1] - a[1]).slice(0, 15)
  for (const [c, n] of cos) lines.push(`  ${String(n).padStart(6)}  ${c}`)
  lines.push('')
  lines.push('null / sentinel counts:')
  for (const [k, n] of Object.entries(stats.nullFields)) {
    lines.push(`  ${k.padEnd(16)} ${n}`)
  }
  lines.push('')
  process.stdout.write(lines.join('\n') + '\n')
}

// ---------------------------------------------------------------------------
// Streaming JSONL processor
// ---------------------------------------------------------------------------

async function processStream(inputPath, opts) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`input 不存在: ${inputPath}`)
  }

  const inStream = fs.createReadStream(inputPath, { encoding: 'utf8', highWaterMark: 1 << 20 })
  const rl = readline.createInterface({ input: inStream, crlfDelay: Infinity })

  // ★ generatedAt 在 main pipeline callback 內取 — 對齊 Sprint 12 file header rule
  //   ("crawler reads the wall clock inside its per-record loop body... not at module top level")
  const generatedAt = Date.now()
  const ctx = { generatedAt, sourceFile: path.basename(inputPath) }

  const stats = newStats()
  const fieldStats = newFieldStats()
  const products = []
  let lineNo = 0
  const startMs = Date.now()

  for await (const rawLine of rl) {
    const line = rawLine.trim()
    if (!line) continue
    lineNo++
    if (opts.limit && lineNo > opts.limit) break

    let rec
    try {
      rec = JSON.parse(line)
    } catch (e) {
      stats.total++
      stats.skipped['parse-error']++
      if (stats.skipped['parse-error'] <= 3) {
        process.stderr.write(`warn: parse-error at line ${lineNo}: ${e.message.slice(0, 100)}\n`)
      }
      continue
    }

    if (opts.statsOnly) {
      stats.total++
      observeRecord(rec, fieldStats)
      continue
    }

    const { entry, errors } = recordToEntry(rec, ctx)
    if (!entry) {
      stats.total++
      for (const er of errors) {
        if (stats.skipped[er] !== undefined) stats.skipped[er]++
      }
      continue
    }
    accumulate(stats, entry, rec)
    if (!opts.dryRun && !opts.statsOnly) {
      products.push(entry)
    }
  }

  const elapsedMs = Date.now() - startMs

  return {
    ctx,
    stats: finalizeStats(stats),
    fieldStats,
    products,
    lineNo,
    elapsedMs,
  }
}

// ---------------------------------------------------------------------------
// Output writer (streaming JSON to avoid OOM on 35k records)
// ---------------------------------------------------------------------------

function writeOutput(outputPath, payload) {
  // payload.products may be ~35k records → ~50MB JSON. Single JSON.stringify
  // is OK at that size on Node 18+ (default heap ~4GB), so we do the simple
  // path. If we ever cross 200k records we'll switch to chunked stream.
  const json = JSON.stringify(payload, (k, v) => {
    // strip parser-internal flags from final output product entries
    if (k === '_categoryFallbackUsed' || k === '_productionSafe' || k === '_researchOnly') return undefined
    return v
  }, 2)
  fs.writeFileSync(outputPath, json, 'utf8')
  return Buffer.byteLength(json, 'utf8')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv)

  process.stdout.write(`input:        ${args.input}\n`)
  process.stdout.write(`output:       ${args.output}\n`)
  process.stdout.write(`mode:         ${args.statsOnly ? 'stats-only' : args.dryRun ? 'dry-run' : 'write'}\n`)
  if (args.limit) process.stdout.write(`limit:        ${args.limit}\n`)

  let result
  try {
    result = await processStream(args.input, args)
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`)
    process.exit(1)
  }

  process.stdout.write(`\nread ${result.lineNo} lines in ${result.elapsedMs}ms ` +
    `(${(result.lineNo / Math.max(1, result.elapsedMs / 1000)).toFixed(0)} rec/sec)\n`)

  if (args.statsOnly) {
    printFieldStats(result.fieldStats, result.stats.total)
    return
  }

  printStatsReport(result.stats)

  if (args.dryRun) {
    process.stdout.write('[dry-run] 不寫檔。\n')
    // 不再保留 products in memory beyond stats — 已 GC
    return
  }

  // Compute category breakdown for output payload (exclude research-only by
  // default; we still ship them in `products` so caller can choose)
  const productionSafeCount = result.stats.productionSafe
  const researchOnlyCount = result.stats.researchOnly

  const payload = {
    version: 'ua-catalog-v1',
    generatedAt: result.ctx.generatedAt,
    source: 'tii',
    sourceFile: result.ctx.sourceFile,
    productionSafeCount,
    researchOnlyCount,
    stats: result.stats,
    products: result.products,
  }

  const bytes = writeOutput(args.output, payload)
  process.stdout.write(`\nwrote ${args.output} (${result.products.length} products, ${(bytes / 1024 / 1024).toFixed(1)} MB)\n`)
}

if (require.main === module) {
  main().catch((e) => {
    process.stderr.write(`fatal: ${e.stack || e.message}\n`)
    process.exit(1)
  })
}

module.exports = {
  parseArgs,
  slugifyMark,
  buildProductId,
  deriveCompanySlug,
  classifyCategory,
  splitKeywords,
  decodeChannels,
  toISODateOnly,
  toISOTimestamp,
  deriveStatus,
  normalizeUnit,
  recordToEntry,
  KEYWORD_CATEGORY_RULES,
  DISPCLASS_CATEGORY_FALLBACK,
  COMPANY_SLUG_MAP,
  SPRINT12_VALID_CATEGORIES,
}
