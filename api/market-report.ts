import type { VercelRequest, VercelResponse } from '@vercel/node';

// Firestore REST API 設定
const PROJECT_ID = 'grbt-f87fa';
const API_KEY = 'AIzaSyAqS6fhHQVyBNr1LCkCaQPyJ13Rkq7bfHA';

// 取得台灣時間的日期字串 YYYY-MM-DD
function getTaiwanDate(): string {
  const now = new Date();
  const twTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return twTime.toISOString().split('T')[0];
}

// 解析 Firestore REST API 回傳的值
function parseFirestoreValue(val: any): any {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('mapValue' in val) return parseFirestoreFields(val.mapValue.fields);
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(parseFirestoreValue);
  }
  return null;
}

function parseFirestoreFields(fields: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(fields)) {
    result[key] = parseFirestoreValue(val);
  }
  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300'); // 5 分鐘快取

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 支援查詢特定日期，預設今天（台灣時間）
    const date = (req.query.date as string) || getTaiwanDate();

    // 透過 Firestore REST API 讀取
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/dailyMarketReports/${date}?key=${API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({
          error: 'No report found',
          date,
          message: `No market report available for ${date}`,
        });
      }
      throw new Error(`Firestore API error: ${response.status}`);
    }

    const doc = await response.json();

    if (!doc.fields) {
      return res.status(404).json({
        error: 'No report found',
        date,
        message: `No market report available for ${date}`,
      });
    }

    // 解析 Firestore 文件
    const data = parseFirestoreFields(doc.fields);

    // 回傳乾淨的 JSON
    return res.status(200).json({
      date: data.date || date,
      type: data.type, // 'pre' | 'post'
      source: data.source,
      aiSummary: data.aiSummary, // { headline, summary, keyPoints, outlook, sentiment }
      marketData: data.marketData, // { twii, sp500, dji, nasdaq, usdtwd, ... }
      createdAt: data.createdAt,
    });
  } catch (error: any) {
    console.error('Market report API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}
