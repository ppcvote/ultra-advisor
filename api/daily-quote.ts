import type { VercelRequest, VercelResponse } from '@vercel/node';
import { dailyQuotes, getTodayQuote } from '../src/data/dailyQuotes';

// 公開端點：回傳「今天的金句」。
// index 演算法與前端 getTodayQuote 完全一致（UTC 日期字串 DJB2 hash），
// 確保 Pin / LINE 推播與網站顯示同一句。
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // ?date=YYYY-MM-DD 可預覽指定日期（推播排程預先取明天的句子用）
  const dateParam = typeof req.query.date === 'string' ? req.query.date : '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? new Date(`${dateParam}T00:00:00Z`) : new Date();
  if (isNaN(date.getTime())) {
    return res.status(400).json({ error: 'invalid date' });
  }

  const quote = getTodayQuote(date);
  // 當日句子全平台固定，CDN 快取到整點即可
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
  return res.status(200).json({
    data: {
      date: date.toISOString().split('T')[0],
      text: quote.text,
      total: dailyQuotes.length,
      source: 'ultra-advisor.tw',
    },
  });
}
