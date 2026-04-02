import type { VercelRequest, VercelResponse } from '@vercel/node';

// 傲創計算機的 SEO metadata
const calculatorMeta = {
  title: '傲創計算機 | 免費房貸計算機 - Ultra Advisor',
  description: '免費房貸計算機：支援本息均攤、本金均攤、額外還款試算、通脹貼現分析。專業視覺化圖表，幫你精算每一分利息。',
  ogImage: 'og-tools.png',
  url: 'https://ultra-advisor.tw/calculator'
};

// 爬蟲 User-Agent 檢測
const crawlerPatterns = [
  'facebookexternalhit',
  'Facebot',
  'LinkedInBot',
  'Twitterbot',
  'Slackbot-LinkExpanding',
  'WhatsApp/',
  'TelegramBot',
  'Discordbot',
  'Pinterestbot',
  'Googlebot',
  'bingbot',
];

function isCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  const hasBrowserEngine = ua.includes('safari') || ua.includes('chrome') || ua.includes('firefox');
  const isKnownBot = crawlerPatterns.some(pattern => ua.includes(pattern.toLowerCase()));

  if (hasBrowserEngine && !isKnownBot) {
    return false;
  }

  return isKnownBot;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userAgent = req.headers['user-agent'] || '';

  // 一般用戶：返回 index.html
  if (!isCrawler(userAgent)) {
    try {
      const indexHtmlResponse = await fetch('https://ultra-advisor.tw/index.html');
      let indexHtml = await indexHtmlResponse.text();

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.status(200).send(indexHtml);
    } catch (error) {
      const fallbackHtml = `<!DOCTYPE html>
<html><head>
<meta http-equiv="refresh" content="0;url=/index.html">
<script>window.location.href = '/index.html';</script>
</head><body>正在載入...</body></html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(fallbackHtml);
    }
    return;
  }

  // 爬蟲：返回帶有完整 OG meta + JSON-LD 的靜態 HTML
  const crawlerHtml = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${calculatorMeta.title}</title>
  <meta name="description" content="${calculatorMeta.description}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <meta name="author" content="Ultra Advisor">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${calculatorMeta.url}">
  <meta property="og:title" content="${calculatorMeta.title}">
  <meta property="og:description" content="${calculatorMeta.description}">
  <meta property="og:image" content="https://ultra-advisor.tw/${calculatorMeta.ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Ultra Advisor 傲創計算機 — 免費房貸計算機">
  <meta property="og:locale" content="zh_TW">
  <meta property="og:site_name" content="Ultra Advisor">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${calculatorMeta.url}">
  <meta name="twitter:title" content="${calculatorMeta.title}">
  <meta name="twitter:description" content="${calculatorMeta.description}">
  <meta name="twitter:image" content="https://ultra-advisor.tw/${calculatorMeta.ogImage}">
  <meta name="twitter:image:alt" content="Ultra Advisor 傲創計算機 — 免費房貸計算機">

  <link rel="canonical" href="${calculatorMeta.url}">
  <link rel="alternate" hreflang="zh-TW" href="${calculatorMeta.url}">

  <!-- WebApplication JSON-LD（讓搜尋引擎理解這是互動式工具） -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "傲創計算機",
    "description": "${calculatorMeta.description}",
    "url": "${calculatorMeta.url}",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "browserRequirements": "Requires JavaScript",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "TWD"
    },
    "creator": {
      "@type": "Organization",
      "name": "Ultra Advisor",
      "url": "https://ultra-advisor.tw"
    },
    "dateCreated": "2025-12-01",
    "dateModified": "2026-02-26",
    "featureList": [
      "本息均攤試算",
      "本金均攤試算",
      "額外還款模擬",
      "通脹貼現分析",
      "視覺化還款圖表",
      "PDF 報告匯出"
    ],
    "screenshot": "https://ultra-advisor.tw/og-tools.png",
    "inLanguage": "zh-TW",
    "speakable": {
      "@type": "SpeakableSpecification",
      "cssSelector": ["h1", "meta[name='description']"]
    }
  }
  </script>

  <!-- BreadcrumbList JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "首頁",
        "item": "https://ultra-advisor.tw/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "傲創計算機",
        "item": "${calculatorMeta.url}"
      }
    ]
  }
  </script>
</head>
<body>
  <h1>${calculatorMeta.title}</h1>
  <p>${calculatorMeta.description}</p>
  <h2>功能特色</h2>
  <ul>
    <li>本息均攤 vs 本金均攤 完整比較</li>
    <li>額外還款模擬 — 省多少利息一目了然</li>
    <li>通脹貼現分析 — 考慮通膨後的真實成本</li>
    <li>視覺化圖表 — 專業 Recharts 互動圖表</li>
    <li>PDF 報告匯出 — 一鍵產出專業提案</li>
  </ul>
  <p>前往使用：<a href="${calculatorMeta.url}">${calculatorMeta.url}</a></p>
  <p>更多工具：<a href="https://ultra-advisor.tw">Ultra Advisor 首頁</a></p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(crawlerHtml);
}
