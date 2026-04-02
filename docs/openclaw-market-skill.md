# OpenClaw 市場動態 Skill 設定指南

> **已開源** → https://github.com/ppcvote/openclaw-market-skill
>
> 以下為歷史文件，最新版本請參考 GitHub repo。

---

## 概述

Ultra Advisor 平台每天自動產出兩份市場報告：
- **盤前報告（pre）**：台灣時間早上 8:00，包含前一晚美股、匯率等
- **盤後報告（post）**：台灣時間下午 2:30，包含當日台股收盤數據

這些報告透過公開 API 提供，OpenClaw 可以用 Skill 來查詢。

---

## API 端點

```
GET https://ultra-advisor.tw/api/market-report
```

### 參數

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `date` | string | 否 | 查詢日期，格式 `YYYY-MM-DD`，預設為今天（台灣時間） |

### 範例請求

```bash
# 取得今天的報告
curl https://ultra-advisor.tw/api/market-report

# 取得特定日期的報告
curl https://ultra-advisor.tw/api/market-report?date=2026-03-21
```

### 回傳格式

```json
{
  "date": "2026-03-21",
  "type": "post",
  "source": "yahoo-finance + gemini-2.0-flash",
  "aiSummary": {
    "headline": "台股 收漲 105 點",
    "summary": "今日市場數據已更新，請查看各指數表現。",
    "keyPoints": [
      "加權指數 22150.32 (+0.48%)",
      "S&P 500 5820.15 (+0.12%)",
      "美元/台幣 32.15 (-0.05%)"
    ],
    "outlook": "台股溫和上漲，關注成交量能否配合。",
    "sentiment": "bullish"
  },
  "marketData": {
    "twii": {
      "name": "加權指數",
      "price": 22150.32,
      "change": 105.23,
      "changePercent": 0.48
    },
    "sp500": {
      "name": "S&P 500",
      "price": 5820.15,
      "change": 6.78,
      "changePercent": 0.12
    },
    "dji": {
      "name": "道瓊工業",
      "price": 42850.00,
      "change": 120.50,
      "changePercent": 0.28
    },
    "nasdaq": {
      "name": "NASDAQ",
      "price": 18520.45,
      "change": 45.30,
      "changePercent": 0.24
    },
    "usdtwd": {
      "name": "美元/台幣",
      "price": 32.15,
      "change": -0.02,
      "changePercent": -0.05
    }
  },
  "createdAt": "2026-03-21T06:30:00.000Z"
}
```

### 錯誤回傳

```json
{
  "error": "No report found",
  "date": "2026-03-22",
  "message": "No market report available for 2026-03-22"
}
```

---

## OpenClaw SKILL.md 設定

在你的 OpenClaw skills 目錄中建立以下檔案：

### 檔案路徑
```
~/.openclaw/skills/market-report/SKILL.md
```

### SKILL.md 內容

```markdown
---
name: market-report
description: 取得台灣股市與國際市場每日動態報告，包含加權指數、美股、匯率及 AI 市場摘要
metadata: {"openclaw":{"emoji":"📊"}}
---

你是一個市場動態助手。當用戶詢問市場相關問題時，使用以下 API 取得最新資料。

## 取得今日市場報告

使用 curl 呼叫 API：

\`\`\`bash
curl -s https://ultra-advisor.tw/api/market-report
\`\`\`

如果用戶問特定日期：

\`\`\`bash
curl -s "https://ultra-advisor.tw/api/market-report?date=YYYY-MM-DD"
\`\`\`

## 回答規則

1. **用繁體中文回答**
2. **重點摘要**：先說 headline（標題），再說 sentiment（市場情緒：bullish=偏多/bearish=偏空/neutral=中性）
3. **關鍵數據**：報告 keyPoints 中的重要指數
4. **展望**：引用 outlook 內容
5. **數據呈現**：漲用 ▲ 綠色表示，跌用 ▼ 表示

## 範例回答格式

📊 **今日市場動態**

**台股收漲 105 點** | 市場情緒：偏多 🟢

▲ 加權指數 22,150 (+0.48%)
▲ S&P 500 5,820 (+0.12%)
▼ 美元/台幣 32.15 (-0.05%)

**展望**：台股溫和上漲，關注成交量能否配合。

## 可回答的問題類型

- 「今天股市怎樣？」「台股漲跌？」
- 「美股昨天表現如何？」（查 type=pre 的報告）
- 「匯率多少？」
- 「市場情緒如何？」
- 「上週五市場？」（帶 date 參數查詢）
```

---

## 安裝步驟

1. 建立目錄：
```bash
mkdir -p ~/.openclaw/skills/market-report
```

2. 將上面的 SKILL.md 內容存入：
```bash
nano ~/.openclaw/skills/market-report/SKILL.md
```

3. 重啟 OpenClaw session（skills 在 session 啟動時載入）

4. 測試：跟 OpenClaw 說「今天股市怎樣？」

---

## 注意事項

- API 有 5 分鐘快取，不會每次都打 Firestore
- 盤前報告通常在 08:00 後可用，盤後報告在 14:30 後可用
- 假日沒有報告，API 會回傳 404
- 資料來源：Yahoo Finance + Gemini AI 分析
