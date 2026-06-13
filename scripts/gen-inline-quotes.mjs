// Generate api/daily-quote.ts with quotes INLINED (no JSON import, no ../src).
// @vercel/node fails both at cold start (FUNCTION_INVOCATION_FAILED). Inline = zero deps.
// Re-run after editing src/data/dailyQuotes.ts: first `gen-quotes-json.mjs`, then this.
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const quotes = JSON.parse(readFileSync(join(here, '..', 'api', '_daily-quotes.json'), 'utf-8'));
const arr = quotes.map((q) => '  ' + JSON.stringify(q)).join(',\n');

const ts = `import type { VercelRequest, VercelResponse } from '@vercel/node';

// 公開端點：回傳「今天的金句」。
// 資料「內聯」在本檔（由 scripts/gen-inline-quotes.mjs 從 dailyQuotes.ts 同步）。
// 不 import JSON、不跨 ../src —— @vercel/node 兩者在 cold start 都會
// FUNCTION_INVOCATION_FAILED（2026-06-13 兩次踩到）。內聯零依賴最穩。

const QUOTES: string[] = [
${arr}
];

const hashDateStr = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  return h;
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const dp = typeof req.query.date === 'string' ? req.query.date : '';
  const date = /^\\d{4}-\\d{2}-\\d{2}$/.test(dp) ? new Date(\`\${dp}T00:00:00Z\`) : new Date();
  if (isNaN(date.getTime())) return res.status(400).json({ error: 'invalid date' });
  const dateStr = date.toISOString().split('T')[0];
  const text = QUOTES[hashDateStr(dateStr) % QUOTES.length];
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
  return res.status(200).json({ data: { date: dateStr, text, total: QUOTES.length, source: 'ultra-advisor.tw' } });
}
`;

writeFileSync(join(here, '..', 'api', 'daily-quote.ts'), ts, 'utf-8');
console.log(`wrote inlined daily-quote.ts with ${quotes.length} quotes`);
