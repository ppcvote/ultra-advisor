import type { VercelRequest, VercelResponse } from '@vercel/node';
import quotes from './_daily-quotes.json';

// 公開端點：回傳「今天的金句」。
// 自包含：讀同目錄的 _daily-quotes.json（由 scripts/gen-quotes-json.mjs 從
// src/data/dailyQuotes.ts 生成）。不跨 ../src import —— @vercel/node 無法
// bundle 跨目錄的 .ts，會 FUNCTION_INVOCATION_FAILED。
// index 演算法與前端 getTodayQuote 完全一致（UTC 日期字串 DJB2 hash）。

const hashDateStr = (dateStr: string): number => {
  let hash = 5381;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) + hash + dateStr.charCodeAt(i)) & 0x7fffffff;
  }
  return hash;
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // ?date=YYYY-MM-DD 可預覽指定日期（推播排程預先取明天的句子用）
  const dateParam = typeof req.query.date === 'string' ? req.query.date : '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? new Date(`${dateParam}T00:00:00Z`) : new Date();
  if (isNaN(date.getTime())) {
    return res.status(400).json({ error: 'invalid date' });
  }

  const dateStr = date.toISOString().split('T')[0];
  const text = quotes[hashDateStr(dateStr) % quotes.length];

  // 當日句子全平台固定，CDN 快取到整點即可
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
  return res.status(200).json({
    data: {
      date: dateStr,
      text,
      total: quotes.length,
      source: 'ultra-advisor.tw',
    },
  });
}
