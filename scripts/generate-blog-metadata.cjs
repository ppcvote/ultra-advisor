#!/usr/bin/env node
/**
 * 從 src/data/blog/articles/*.ts 生成 metadata.ts
 *
 * 目的：OverviewTab + LandingPage 只需要 metadata（title/excerpt/publishDate 等），
 *      不需要 content 全文。原本一起 import 進主 bundle 浪費 ~300KB gz。
 *
 * 用法：
 *   node scripts/generate-blog-metadata.cjs
 *
 * 生成檔案：src/data/blog/metadata.ts
 */
const fs = require('fs')
const path = require('path')

const ARTICLES_DIR = path.resolve(__dirname, '../src/data/blog/articles')
const OUT_FILE = path.resolve(__dirname, '../src/data/blog/metadata.ts')

const META_FIELDS = [
  'id', 'slug', 'title', 'excerpt', 'category', 'tags', 'readTime',
  'publishDate', 'author', 'featured', 'metaTitle', 'metaDescription',
  'cover', 'coverImage',
]

function extractField(content, fieldName) {
  // 比對如 `fieldName: 'value'` 或 `fieldName: "value"` 或 `fieldName: ['a','b']` 或 `fieldName: true`
  const patterns = [
    new RegExp(`\\b${fieldName}:\\s*'((?:[^'\\\\]|\\\\.)*)'`, 's'),
    new RegExp(`\\b${fieldName}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 's'),
    new RegExp(`\\b${fieldName}:\\s*(\\[[^\\]]*\\])`, 's'),
    new RegExp(`\\b${fieldName}:\\s*(true|false|\\d+(?:\\.\\d+)?)`, 's'),
  ]
  for (const re of patterns) {
    const m = content.match(re)
    if (m) return { type: re.source.includes('true') ? 'literal' : (re.source.includes('\\[') ? 'array' : 'string'), value: m[1] }
  }
  return null
}

function processArticle(file) {
  const content = fs.readFileSync(file, 'utf-8')
  const obj = {}
  for (const f of META_FIELDS) {
    const result = extractField(content, f)
    if (!result) continue
    if (result.type === 'string') {
      // Re-escape for output
      obj[f] = result.value
    } else if (result.type === 'array') {
      // Parse array literal — safe enough for simple string arrays
      try {
        obj[f] = JSON.parse(result.value.replace(/'/g, '"'))
      } catch {
        obj[f] = []
      }
    } else {
      obj[f] = result.value === 'true' ? true : result.value === 'false' ? false : Number(result.value)
    }
  }
  return obj
}

const files = fs.readdirSync(ARTICLES_DIR)
  .filter(f => f.endsWith('.ts') && !f.startsWith('_'))
  .sort()

const metadata = files.map(f => {
  const meta = processArticle(path.join(ARTICLES_DIR, f))
  if (!meta.id) console.warn(`[WARN] no id in ${f}`)
  return meta
}).filter(m => m.id)

const output = `/**
 * Ultra Advisor — 部落格 metadata（自動生成，請勿手改）
 *
 * Source: src/data/blog/articles/*.ts
 * Generator: scripts/generate-blog-metadata.cjs
 *
 * 用途：列表頁面（OverviewTab / LandingPage）import 這個 light file，
 *      取代原本的 index.ts（含 content 全文，浪費 ~300KB gz 進主 bundle）。
 *      只有 BlogPage 真正讀文章內容時才 lazy-import 對應的 articles/NN-*.ts
 */

export interface BlogMeta {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category?: string;
  tags?: string[];
  readTime?: number;
  publishDate: string;
  author?: string;
  featured?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  cover?: string;
  coverImage?: string;
}

export const blogMetadata: BlogMeta[] = ${JSON.stringify(metadata, null, 2)};

export default blogMetadata;
`

fs.writeFileSync(OUT_FILE, output, 'utf-8')
console.log(`✓ 生成 ${OUT_FILE}`)
console.log(`  ${metadata.length} 篇文章 metadata`)
console.log(`  output ${(fs.statSync(OUT_FILE).size / 1024).toFixed(1)} KB`)
