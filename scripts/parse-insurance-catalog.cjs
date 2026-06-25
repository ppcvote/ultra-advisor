#!/usr/bin/env node
/**
 * parse-insurance-catalog.cjs
 *
 * 解析「朋友給的保險贏家 catalog 資料」、抽 catalog index。
 *
 * 戰略邊界 (鐵則)：
 *   - 這隻 script 只抽 catalog index 欄位 (公司/商品名/代碼/險種/生效日/狀態)
 *   - 絕對不抽：條款內文、保險贏家編輯著作 (分析/比較/註解)
 *   - 條款內文走 scripts/crawl-tii.cjs 從 TII 取
 *   - 輸出 schema 是 UA 自己設計、不照抄保險贏家分類體系
 *   - catalog 是 research only — 不直接寫 Firestore、給 TII crawler 對照用
 *
 * CLI:
 *   node scripts/parse-insurance-catalog.cjs <input-file> [--format auto|csv|json|xlsx]
 *                                                        [--out scripts/insurance-catalog.json]
 *                                                        [--dry-run]
 *                                                        [--limit N]
 *
 * 範例：
 *   node scripts/parse-insurance-catalog.cjs ./tmp/catalog-sample.json
 *   node scripts/parse-insurance-catalog.cjs ./tmp/catalog.csv --format csv
 *   node scripts/parse-insurance-catalog.cjs --self-test            # 跑內建 fixture
 *
 * Sprint 12 / Task B — skeleton 版本，等 user 餵 sample 後微調 normalize 規則。
 */

const fs = require('fs')
const path = require('path')

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    input: null,
    format: 'auto',
    out: path.resolve(__dirname, 'insurance-catalog.json'),
    dryRun: false,
    limit: null,
    selfTest: false,
  }
  const rest = argv.slice(2)
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (a === '--format') { args.format = rest[++i]; continue }
    if (a === '--out') { args.out = path.resolve(rest[++i]); continue }
    if (a === '--dry-run') { args.dryRun = true; continue }
    if (a === '--limit') { args.limit = Number(rest[++i]); continue }
    if (a === '--self-test') { args.selfTest = true; continue }
    if (a === '--help' || a === '-h') { printHelp(); process.exit(0) }
    if (!args.input && !a.startsWith('--')) { args.input = path.resolve(a); continue }
  }
  return args
}

function printHelp() {
  process.stdout.write(`
parse-insurance-catalog.cjs — 抽 catalog index (不抽條款內文 / 不抽他人著作)

Usage:
  node scripts/parse-insurance-catalog.cjs <input-file> [options]

Options:
  --format <auto|csv|json|xlsx>   Input format (default: auto-detect by extension)
  --out <path>                    Output JSON (default: scripts/insurance-catalog.json)
  --dry-run                       Parse + print stats only, no file write
  --limit <N>                     Cap rows processed (debug)
  --self-test                     Run built-in fixture (no input file needed)
  -h, --help                      Show this

`)
}

// ---------------------------------------------------------------------------
// Field aliases — 朋友的欄位名我們不知道、列常見可能性、都認得
// ---------------------------------------------------------------------------

const FIELD_ALIASES = {
  company: [
    'company', 'companyName', '公司', '公司名', '公司名稱', '保險公司',
    'insurer', 'insurerName', '承保公司',
  ],
  productName: [
    'productName', 'product', '商品', '商品名', '商品名稱', '保險商品',
    'name', 'title',
  ],
  productCode: [
    'productCode', 'code', '商品代碼', '代碼', '商品編號', '編號',
    'sku', 'id',
  ],
  categoryMain: [
    'categoryMain', 'category', '險種', '險種大類', '保險類別', '類別',
    'mainCategory', 'type',
  ],
  categorySub: [
    'categorySub', 'subCategory', '險種細類', '細類', '子類', '次類別',
  ],
  effectiveDate: [
    'effectiveDate', 'startDate', '生效日', '生效日期', '販售日', '開賣日',
    'launchDate', 'date',
  ],
  status: [
    'status', '狀態', '銷售狀態', '販售狀態',
  ],
}

// 欄位「絕對不抽」黑名單 — 防止手快誤 map
const FORBIDDEN_FIELD_KEYWORDS = [
  '條款', '條文', 'clause', 'terms', 'fullText', 'content',
  '分析', '比較', '評析', '評論', '建議', '註解', '備註說明',
  'analysis', 'comparison', 'review', 'recommendation', 'comment',
]

// ---------------------------------------------------------------------------
// Format detection + loaders
// ---------------------------------------------------------------------------

function detectFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.json') return 'json'
  if (ext === '.csv') return 'csv'
  if (ext === '.xlsx' || ext === '.xls') return 'xlsx'
  return null
}

function loadJSON(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const data = JSON.parse(raw)
  if (Array.isArray(data)) return data
  // 容錯：{ items: [...] } / { data: [...] } / { rows: [...] }
  for (const key of ['items', 'data', 'rows', 'products', 'catalog']) {
    if (Array.isArray(data[key])) return data[key]
  }
  throw new Error(
    `JSON 結構不認得 — 預期 array 或 { items|data|rows|products|catalog: [...] }，` +
    `實際 top-level keys: ${Object.keys(data).join(', ')}`
  )
}

/**
 * 極簡 CSV parser — 支援 quote、跳脫雙引號 ""、CR/LF。
 * 不引入新 npm 依賴 (鐵則)。
 */
function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0
  // 去 BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += ch; i++; continue
    }
    if (ch === '"') { inQuotes = true; i++; continue }
    if (ch === ',') { row.push(field); field = ''; i++; continue }
    if (ch === '\r') { i++; continue }
    if (ch === '\n') {
      row.push(field); rows.push(row); row = []; field = ''; i++; continue
    }
    field += ch; i++
  }
  // 最後一行
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1)
    .filter((r) => r.some((c) => c && c.trim().length > 0))
    .map((r) => {
      const obj = {}
      headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim() })
      return obj
    })
}

function loadCSV(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  return parseCSV(text)
}

function loadXLSX(_filePath) {
  // XLSX parsing 需要 zip 解壓 + XML parse、無 dep 自己刻不划算
  // 鐵則：不引入新 npm 依賴 (cheerio 已允許但不是 xlsx parser)
  throw new Error(
    'XLSX 暫不支援 (鐵則：不引入新 npm 依賴)。' +
    '請另存 CSV 或 JSON 後重跑：\n' +
    '  Excel → 檔案 → 另存新檔 → CSV (UTF-8)\n' +
    '或：powershell -c "Import-Csv ... | ConvertTo-Json"'
  )
}

// ---------------------------------------------------------------------------
// Schema detection
// ---------------------------------------------------------------------------

function detectSchema(rows) {
  if (!rows.length) throw new Error('input 是空的、無欄位可偵測')
  const sample = rows[0]
  const keys = Object.keys(sample)
  const detected = {}
  const forbidden = []
  for (const key of keys) {
    const lower = key.toLowerCase()
    for (const banned of FORBIDDEN_FIELD_KEYWORDS) {
      if (lower.includes(banned.toLowerCase())) {
        forbidden.push(key)
      }
    }
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (detected[field]) continue
      if (aliases.some((alias) => alias.toLowerCase() === lower)) {
        detected[field] = key
        break
      }
    }
  }
  // 必須有 company + productName 才能 normalize
  if (!detected.company || !detected.productName) {
    throw new Error(
      `欄位偵測失敗 — 找不到 company / productName 欄位。\n` +
      `  輸入欄位: ${keys.join(', ')}\n` +
      `  期望別名 (company): ${FIELD_ALIASES.company.join(', ')}\n` +
      `  期望別名 (productName): ${FIELD_ALIASES.productName.join(', ')}\n` +
      `若朋友資料欄位名不同、加進 FIELD_ALIASES 後重跑。`
    )
  }
  return { detected, forbidden, allKeys: keys }
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

/**
 * 公司名統一 — 「國泰人壽」「國泰人壽保險股份有限公司」「國泰」→ 「國泰人壽」
 *
 * 規則 (skeleton、user 給 sample 後可擴充)：
 *   1. 去除常見後綴 (保險股份有限公司 / 股份有限公司 / 有限公司 / Inc. / Ltd.)
 *   2. 去除空白 + 全形空格
 *   3. 短名 (≤2 字) 對照表補完整名 (避免 user 寫「國泰」歧義)
 *   4. 統一全形/半形括號
 */
const COMPANY_SUFFIX_RE = /(保險股份有限公司|股份有限公司|股分有限公司|有限公司|保險公司|人壽保險|Insurance Co\.?,?\s*Ltd\.?|Inc\.?|Ltd\.?)$/i
const COMPANY_SHORT_TO_FULL = {
  '國泰': '國泰人壽',
  '富邦': '富邦人壽',
  '南山': '南山人壽',
  '新光': '新光人壽',
  '台灣': '台灣人壽',
  '中國': '中國人壽',
  '三商美邦': '三商美邦人壽',
  '全球': '全球人壽',
  '宏泰': '宏泰人壽',
  '安聯': '安聯人壽',
  '保誠': '保誠人壽',
  '元大': '元大人壽',
  '遠雄': '遠雄人壽',
  '第一金': '第一金人壽',
  '合作金庫': '合作金庫人壽',
  '法巴': '法國巴黎人壽',
}

function normalizeCompany(raw) {
  if (!raw || typeof raw !== 'string') return null
  let v = raw.trim().replace(/　/g, '').replace(/\s+/g, '')
  // 去後綴
  v = v.replace(COMPANY_SUFFIX_RE, '').trim()
  // 統一括號
  v = v.replace(/（/g, '(').replace(/）/g, ')')
  // 短名補全
  if (COMPANY_SHORT_TO_FULL[v]) v = COMPANY_SHORT_TO_FULL[v]
  return v || null
}

function normalizeProductName(raw) {
  if (!raw || typeof raw !== 'string') return null
  return raw.trim().replace(/　/g, ' ').replace(/\s+/g, ' ') || null
}

/**
 * 商品代碼 — 若無則 generate slug from company + productName。
 * Slug 規則：company-productName 全小寫、非字母數字中文轉 -
 */
function normalizeProductCode(raw, fallback) {
  const v = raw && typeof raw === 'string' ? raw.trim() : ''
  if (v) return v.toUpperCase().replace(/\s+/g, '')
  if (!fallback) return null
  return fallback
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/**
 * 險種大類正規化 — 統一到 UA 自己的 8 大類。
 * UA 分類體系 (不照抄保險贏家、用財顧實務常用)：
 *   壽險 / 醫療 / 重疾 / 意外 / 失能 / 長照 / 年金 / 投資型
 */
const CATEGORY_MAP = [
  { match: /壽險|終身壽|定期壽|life/i, value: '壽險' },
  { match: /醫療|住院|手術|實支實付|健康險/i, value: '醫療' },
  { match: /重疾|重大疾病|癌症|特定傷病|critical/i, value: '重疾' },
  { match: /意外|傷害|accident/i, value: '意外' },
  { match: /失能|殘廢|失扶|disability/i, value: '失能' },
  { match: /長照|長期照顧|long.?term|LTC/i, value: '長照' },
  { match: /年金|退休|annuity/i, value: '年金' },
  { match: /投資|變額|連結|投資型|investment/i, value: '投資型' },
]

function normalizeCategoryMain(raw) {
  if (!raw || typeof raw !== 'string') return null
  const v = raw.trim()
  for (const { match, value } of CATEGORY_MAP) {
    if (match.test(v)) return value
  }
  return v || null  // 不認得、保留原值給 user 看
}

function normalizeCategorySub(raw) {
  if (!raw || typeof raw !== 'string') return null
  return raw.trim() || null
}

/**
 * 生效日 → yyyy-mm-dd。支援 ROC 年 (民國 113 → 西元 2024)、yyyy/m/d、yyyy-mm-dd。
 */
function normalizeDate(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null
  // 民國 113.05.20 / 民國113-5-20 / 113/05/20 (ROC)
  let m = s.match(/^(?:民國)?\s*(\d{2,3})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/)
  if (m) {
    const rocYear = Number(m[1])
    // 民國年通常 < 200、轉西元
    const year = rocYear < 200 ? rocYear + 1911 : rocYear
    const mo = String(m[2]).padStart(2, '0')
    const da = String(m[3]).padStart(2, '0')
    return `${year}-${mo}-${da}`
  }
  // yyyy-mm-dd / yyyy/mm/dd
  m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (m) {
    return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
  }
  return s  // 看不懂、原樣丟回去給 user 看
}

const STATUS_MAP = [
  { match: /販售中|銷售中|現售|on.?sale|active/i, value: '販售中' },
  { match: /停售|已停售|停|discontinued|inactive/i, value: '已停售' },
  { match: /改版|新版|revised/i, value: '改版' },
]

function normalizeStatus(raw) {
  if (!raw || typeof raw !== 'string') return '販售中'  // 預設
  const v = raw.trim()
  for (const { match, value } of STATUS_MAP) {
    if (match.test(v)) return value
  }
  return v
}

// ---------------------------------------------------------------------------
// Row → catalog entry
// ---------------------------------------------------------------------------

function rowToEntry(row, schema) {
  const get = (field) => {
    const key = schema.detected[field]
    return key ? row[key] : null
  }
  const company = normalizeCompany(get('company'))
  const productName = normalizeProductName(get('productName'))
  if (!company || !productName) return null
  const fallbackForCode = `${company}-${productName}`
  return {
    company,
    productName,
    productCode: normalizeProductCode(get('productCode'), fallbackForCode),
    categoryMain: normalizeCategoryMain(get('categoryMain')),
    categorySub: normalizeCategorySub(get('categorySub')),
    effectiveDate: normalizeDate(get('effectiveDate')),
    status: normalizeStatus(get('status')),
    // schema version + provenance for downstream TII crawler
    _schemaVersion: 1,
    _source: 'catalog-research',  // 提醒：research only、不上 production
  }
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function buildStats(entries) {
  const byCompany = {}
  const byCategory = {}
  const byStatus = {}
  for (const e of entries) {
    byCompany[e.company] = (byCompany[e.company] || 0) + 1
    if (e.categoryMain) byCategory[e.categoryMain] = (byCategory[e.categoryMain] || 0) + 1
    byStatus[e.status] = (byStatus[e.status] || 0) + 1
  }
  // 預估涵蓋率 — 用台灣 22 家壽險公司當分母 (粗估、user 之後可改)
  const TW_LIFE_INSURERS_TOTAL = 22
  const companyCount = Object.keys(byCompany).length
  return {
    totalEntries: entries.length,
    uniqueCompanies: companyCount,
    estimatedCompanyCoverage: `${((companyCount / TW_LIFE_INSURERS_TOTAL) * 100).toFixed(1)}%`,
    byCompany,
    byCategory,
    byStatus,
  }
}

function printStatsReport(stats, schema) {
  const lines = []
  lines.push('')
  lines.push('=== catalog parse report ===')
  lines.push(`total entries:        ${stats.totalEntries}`)
  lines.push(`unique companies:     ${stats.uniqueCompanies}`)
  lines.push(`est. coverage:        ${stats.estimatedCompanyCoverage} (assumes 22 TW life insurers)`)
  lines.push('')
  lines.push('detected schema:')
  for (const [field, key] of Object.entries(schema.detected)) {
    lines.push(`  ${field.padEnd(16)} ← "${key}"`)
  }
  if (schema.forbidden.length) {
    lines.push('')
    lines.push('forbidden fields (ignored — not extracted):')
    for (const k of schema.forbidden) lines.push(`  "${k}"`)
  }
  lines.push('')
  lines.push('by company:')
  for (const [c, n] of Object.entries(stats.byCompany).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${String(n).padStart(4)}  ${c}`)
  }
  lines.push('')
  lines.push('by category:')
  for (const [c, n] of Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${String(n).padStart(4)}  ${c}`)
  }
  lines.push('')
  lines.push('by status:')
  for (const [s, n] of Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${String(n).padStart(4)}  ${s}`)
  }
  lines.push('')
  process.stdout.write(lines.join('\n') + '\n')
}

// ---------------------------------------------------------------------------
// Sample fixture — 假資料 5 筆 (parser self-test 用)
// ---------------------------------------------------------------------------

const SAMPLE_FIXTURE = [
  {
    '公司名': '國泰人壽保險股份有限公司',
    '商品名': '康健平安終身壽險',
    '商品代碼': 'CKWL2024A',
    '險種': '終身壽險',
    '生效日': '民國 113.05.20',
    '狀態': '販售中',
    // 故意混入「應該忽略」的欄位、測 forbidden check
    '條款內文': '本契約所稱被保險人為...',
    '比較分析': '與富邦同類型商品相比、CP 值較高...',
  },
  {
    '公司名': '富邦',
    '商品名': '美好醫靠住院日額醫療保險附約',
    '商品代碼': '',
    '險種': '住院醫療附約',
    '生效日': '2025/01/01',
    '狀態': '販售中',
  },
  {
    '公司名': '南山人壽',
    '商品名': '一生鑽石重大疾病終身健康保險',
    '商品代碼': 'NSRC2023',
    '險種': '重大疾病險',
    '生效日': '112-08-15',
    '狀態': '改版',
  },
  {
    '公司名': '新光人壽保險股份有限公司',
    '商品名': '安心守護長期照顧終身保險',
    '商品代碼': 'SKLTC22',
    '險種': '長期照顧險',
    '生效日': '2022.03.01',
    '狀態': '已停售',
  },
  {
    '公司名': '安聯人壽',
    '商品名': '優利人生變額年金保險',
    '商品代碼': 'ALVA2024',
    '險種': '變額年金',
    '生效日': '113/11/01',
    '狀態': '販售中',
  },
]

function writeSampleFixture() {
  const fixturePath = path.resolve(__dirname, 'sample-fixture.json')
  fs.writeFileSync(fixturePath, JSON.stringify(SAMPLE_FIXTURE, null, 2), 'utf8')
  return fixturePath
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

function runPipeline(rows, opts) {
  const limited = opts.limit ? rows.slice(0, opts.limit) : rows
  const schema = detectSchema(limited)
  const entries = []
  const skipped = []
  for (const row of limited) {
    const entry = rowToEntry(row, schema)
    if (entry) entries.push(entry)
    else skipped.push(row)
  }
  if (skipped.length) {
    process.stderr.write(`warn: ${skipped.length} 筆 row 缺 company 或 productName、已 skip\n`)
  }
  const stats = buildStats(entries)
  return { entries, stats, schema }
}

function main() {
  const args = parseArgs(process.argv)

  if (args.selfTest) {
    process.stdout.write('[self-test] using built-in 5-row fixture\n')
    // 寫 fixture 到 scripts/sample-fixture.json 給 user 看 schema 長相
    const fixturePath = writeSampleFixture()
    process.stdout.write(`[self-test] wrote ${fixturePath}\n`)
    const { entries, stats, schema } = runPipeline(SAMPLE_FIXTURE, args)
    printStatsReport(stats, schema)
    const out = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      source: 'self-test-fixture',
      stats,
      entries,
    }
    if (!args.dryRun) {
      fs.writeFileSync(args.out, JSON.stringify(out, null, 2), 'utf8')
      process.stdout.write(`[self-test] wrote ${args.out} (${entries.length} entries)\n`)
    }
    return
  }

  if (!args.input) {
    process.stderr.write('error: missing <input-file>. Use --self-test to run with fixture.\n')
    printHelp()
    process.exit(1)
  }
  if (!fs.existsSync(args.input)) {
    process.stderr.write(`error: input file 不存在: ${args.input}\n`)
    process.exit(1)
  }

  let format = args.format
  if (format === 'auto') format = detectFormat(args.input)
  if (!format) {
    process.stderr.write(
      `error: 無法自動判斷格式、請加 --format csv|json|xlsx (input: ${args.input})\n`
    )
    process.exit(1)
  }

  let rows
  try {
    if (format === 'json') rows = loadJSON(args.input)
    else if (format === 'csv') rows = loadCSV(args.input)
    else if (format === 'xlsx') rows = loadXLSX(args.input)
    else throw new Error(`不支援的格式: ${format}`)
  } catch (err) {
    process.stderr.write(`error: 載入 input 失敗 — ${err.message}\n`)
    process.exit(1)
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    process.stderr.write('error: input 解析後 rows 是空陣列\n')
    process.exit(1)
  }

  process.stdout.write(`loaded ${rows.length} rows from ${args.input} (format=${format})\n`)

  let result
  try {
    result = runPipeline(rows, args)
  } catch (err) {
    process.stderr.write(`error: pipeline 失敗 — ${err.message}\n`)
    process.exit(1)
  }

  printStatsReport(result.stats, result.schema)

  const out = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: path.basename(args.input),
    stats: result.stats,
    entries: result.entries,
  }

  if (args.dryRun) {
    process.stdout.write('[dry-run] 不寫檔。前 3 筆:\n')
    process.stdout.write(JSON.stringify(result.entries.slice(0, 3), null, 2) + '\n')
    return
  }

  fs.writeFileSync(args.out, JSON.stringify(out, null, 2), 'utf8')
  process.stdout.write(`wrote ${args.out} (${result.entries.length} entries)\n`)
}

if (require.main === module) {
  main()
}

module.exports = {
  parseArgs,
  parseCSV,
  detectSchema,
  normalizeCompany,
  normalizeProductName,
  normalizeProductCode,
  normalizeCategoryMain,
  normalizeCategorySub,
  normalizeDate,
  normalizeStatus,
  rowToEntry,
  runPipeline,
  buildStats,
  SAMPLE_FIXTURE,
  FIELD_ALIASES,
  FORBIDDEN_FIELD_KEYWORDS,
}
