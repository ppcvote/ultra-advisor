/**
 * 自動生成 sitemap.xml
 * 從 src/data/blog/articles/ 讀取所有文章並生成 sitemap
 *
 * 使用方式: node scripts/generate-sitemap.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE_URL = 'https://ultra-advisor.tw';
const TODAY = new Date().toISOString().split('T')[0];

// 靜態頁面配置（lastmod 使用實際最後修改日期，避免虛假 freshness 信號）
const staticPages = [
  { path: '/', priority: 1.0, changefreq: 'weekly', lastmod: TODAY },       // 首頁動態更新
  { path: '/en', priority: 0.9, changefreq: 'weekly', lastmod: TODAY },     // English homepage
  { path: '/calculator', priority: 0.95, changefreq: 'monthly', lastmod: '2026-02-26' },
  { path: '/blog', priority: 0.9, changefreq: 'daily', lastmod: TODAY },    // 知識庫有新文章
  { path: '/register', priority: 0.8, changefreq: 'monthly', lastmod: '2026-01-20' },
  { path: '/booking', priority: 0.75, changefreq: 'monthly', lastmod: '2026-01-20' },
  { path: '/alliance', priority: 0.7, changefreq: 'monthly', lastmod: '2026-01-26' },
  { path: '/login', priority: 0.6, changefreq: 'monthly', lastmod: '2026-01-10' },
];

async function generateSitemap() {
  const articlesDir = path.join(__dirname, '../src/data/blog/articles');

  // 讀取所有文章檔案
  const articleFiles = fs.readdirSync(articlesDir)
    .filter(f => f.endsWith('.ts') && !f.startsWith('_'));

  const articles = [];

  for (const file of articleFiles) {
    const content = fs.readFileSync(path.join(articlesDir, file), 'utf-8');

    // 解析 slug
    const slugMatch = content.match(/slug:\s*['"]([^'"]+)['"]/);
    // 解析 featured
    const featuredMatch = content.match(/featured:\s*(true|false)/);
    // 解析 publishDate
    const publishDateMatch = content.match(/publishDate:\s*['"]([^'"]+)['"]/);
    // 解析 category
    const categoryMatch = content.match(/category:\s*['"]([^'"]+)['"]/);

    if (slugMatch) {
      articles.push({
        slug: slugMatch[1],
        featured: featuredMatch ? featuredMatch[1] === 'true' : false,
        publishDate: publishDateMatch ? publishDateMatch[1] : TODAY,
        category: categoryMatch ? categoryMatch[1] : 'tools',
      });
    }
  }

  // 按發布日期降序排列（最新文章優先被爬取）
  articles.sort((a, b) => b.publishDate.localeCompare(a.publishDate));

  // 分類對應的 OG 圖片
  const categoryImages = {
    mortgage: 'og-mortgage.png',
    retirement: 'og-retirement.png',
    tax: 'og-tax.png',
    investment: 'og-investment.png',
    tools: 'og-tools.png',
    sales: 'og-sales.png',
  };

  // 生成 XML（含 image + xhtml 命名空間，xhtml 用於 hreflang alternate）
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
`;

  // hreflang 配對：首頁 (zh-TW) ↔ /en (en)
  const hreflangPairs = {
    '/': '/en',
    '/en': '/',
  };

  // 靜態頁面
  for (const page of staticPages) {
    xml += `  <url>
    <loc>${SITE_URL}${page.path}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>`;

    // 加入 hreflang alternate（首頁 ↔ 英文版）
    if (page.path === '/') {
      xml += `
    <xhtml:link rel="alternate" hreflang="zh-TW" href="${SITE_URL}/" />
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/en" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}/en" />`;
    } else if (page.path === '/en') {
      xml += `
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/en" />
    <xhtml:link rel="alternate" hreflang="zh-TW" href="${SITE_URL}/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}/en" />`;
    }

    xml += `
  </url>

`;
  }

  xml += `  <!-- ==================== 部落格文章（${articles.length} 篇，按日期降序）==================== -->

`;

  // 文章頁面（含 image sitemap）
  for (const article of articles) {
    const priority = article.featured ? 0.85 : 0.8;
    const lastmod = article.publishDate || TODAY;
    const ogImage = categoryImages[article.category] || 'og-image.png';
    xml += `  <url>
    <loc>${SITE_URL}/blog/${article.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>
    <image:image>
      <image:loc>${SITE_URL}/${ogImage}</image:loc>
    </image:image>
  </url>

`;
  }

  xml += `</urlset>
`;

  // 寫入檔案
  const outputPath = path.join(__dirname, '../public/sitemap.xml');
  fs.writeFileSync(outputPath, xml, 'utf-8');

  console.log(`✅ Sitemap 已生成: ${outputPath}`);
  console.log(`   - 靜態頁面: ${staticPages.length}`);
  console.log(`   - 文章數量: ${articles.length}`);

  // IndexNow: 通知 Bing/Yandex 有新內容（即時索引）
  const INDEXNOW_KEY = 'a19bc88807ef43ca83672de702a684be';
  const allUrls = [
    ...staticPages.map(p => `${SITE_URL}${p.path}`),
    ...articles.slice(0, 20).map(a => `${SITE_URL}/blog/${a.slug}`),
  ];

  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: 'ultra-advisor.tw',
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: allUrls,
      }),
    });
    console.log(`🔔 IndexNow 通知完成: ${response.status} (${allUrls.length} URLs)`);
  } catch (err) {
    console.log(`⚠️ IndexNow 通知失敗（不影響 sitemap）: ${err.message}`);
  }
}

generateSitemap().catch(console.error);
