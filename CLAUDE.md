# Ultra Advisor 專案規格書

> **最後更新：2026-04-04**
> 本文檔是給 AI 助手的完整交接規格書，包含專案架構、部署流程、常見問題等。

---

## 📋 專案概述

Ultra Advisor 是一個 **SaaS 平台**，為台灣財務顧問提供 18+ 種數據視覺化工具，幫助顧問快速產出專業提案。

**核心功能：**
- 18+ 種財務視覺化工具（房貸、退休、稅務等）
- CashFlowVisualizer — 即時收支流動視覺化（公開，不需登入）
- WarRoom v2 — Tab-based 客戶管理儀表板（取代舊 ClientDashboard）
- 會員訂閱制（5 種身分組）
- 點數獎勵系統
- SEO 部落格（63 篇文章）
- LINE 官方帳號整合
- English Landing Page（`/en`，NVIDIA Inception + 國際化）
- Market Report API（每日市場報告）

---

## 🔧 技術棧

| 層級 | 技術 | 版本 |
|------|------|------|
| **前端框架** | React + TypeScript | 18.2 + 5.2 |
| **構建工具** | Vite | 5.4 |
| **樣式** | Tailwind CSS | 3.3 |
| **圖表** | Recharts | 2.10 |
| **後台 UI** | Ant Design | 5.12 |
| **視覺化** | ReactFlow | 11.11 |
| **PDF** | jsPDF | 2.5 |
| **截圖** | html2canvas + html-to-image | - |
| **影片** | Remotion | 4.0 |
| **拖放** | react-grid-layout + react-rnd | - |
| **資料庫** | Firebase Firestore | 10.7 |
| **認證** | Firebase Auth | 內建 |
| **後端** | Cloud Functions | Node 20 |
| **部署（主要）** | Vercel | - |
| **部署（備用）** | Firebase Hosting | - |

---

## 📁 專案結構

```
C:\Users\User\financial-planner\
├── src/
│   ├── components/           # 40+ React 元件
│   │   ├── auth/             # 登入、註冊流程
│   │   ├── WarRoom/          # WarRoom v2 儀表板（取代 ClientDashboard）
│   │   │   ├── index.tsx     # 主容器（4 tabs: Overview/Clients/Tools/Share）
│   │   │   ├── OverviewTab.tsx, ClientsTab.tsx, ToolsTab.tsx, ShareTab.tsx
│   │   │   └── modals/       # 7 種 modal（Add/Edit Client, Profile, Password, Payment, Feedback）
│   │   ├── CashFlowVisualizer.tsx  # 即時收支流動（770 行，公開工具）
│   │   └── *.tsx             # 18 種工具組件
│   ├── pages/                # 頁面元件
│   │   ├── BlogPage.tsx      # 部落格引擎 (44KB)
│   │   ├── EnglishLandingPage.tsx  # 英文版 Landing（/en 路由，NVIDIA Inception）
│   │   ├── RegisterPage.tsx  # 公開註冊
│   │   └── LiffRegister.tsx  # LINE LIFF 整合
│   ├── hooks/                # 自訂 Hooks
│   │   ├── usePoints.ts      # 點數系統
│   │   ├── useMembership.ts  # 會員權限
│   │   └── useStore.ts       # 狀態管理
│   ├── data/blog/            # 部落格系統
│   │   ├── articles/         # 63 篇文章 (01-*.ts ~ 63-*.ts)
│   │   ├── index.ts          # 文章匯出
│   │   └── types.ts          # BlogArticle 型別
│   ├── constants/tools.ts    # 18 工具定義
│   ├── firebase.ts           # Firebase 設定
│   ├── App.tsx               # 主應用 (37KB)
│   └── main.tsx              # 路由邏輯
├── api/                      # Vercel Serverless Functions
│   ├── blog/[slug].ts        # 部落格 SEO API
│   ├── calculator/index.ts   # 計算機 SEO API
│   └── market-report.ts      # 每日市場報告 API（GET ?date=YYYY-MM-DD）
├── admin/                    # Admin 後台
│   └── src/pages/            # 後台頁面
├── functions/                # Cloud Functions
│   └── index.js              # 3700+ 行，20+ 個函數
├── public/                   # 靜態資源
│   ├── og-*.png              # 6 個分類 OG 圖片
│   └── sitemap.xml           # 自動生成
├── vercel.json               # Vercel 部署設定
├── firebase.json             # Firebase 設定
└── firestore.rules           # 安全規則
```

---

## 🌐 網址

| 環境 | 網址 |
|------|------|
| 前端主站 | https://ultra-advisor.tw |
| 前端 www | https://www.ultra-advisor.tw |
| 後台 | https://admin.ultra-advisor.tw/secret-admin-ultra-2026 |
| LINE 官方帳號 | https://line.me/R/ti/p/@ultraadvisor |

**Vercel 專案名稱：** `ultra-advisor`

---

## 🔥 Firebase 設定

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAqS6fhHQVyBNr1LCkCaQPyJ13Rkq7bfHA",
  authDomain: "grbt-f87fa.firebaseapp.com",
  projectId: "grbt-f87fa",
  storageBucket: "grbt-f87fa.firebasestorage.app",
  messagingSenderId: "169700005946",
  appId: "1:169700005946:web:9b0722f31aa9fe7ad13d03",
};
```

---

## 📊 Firestore 資料結構

### users/{uid}
```javascript
{
  email: string,
  displayName: string,
  photoURL: string,

  // 會員系統
  primaryTierId: "founder" | "paid" | "trial" | "grace" | "expired",
  membershipExpiresAt: Timestamp,

  // 點數系統
  points: { current: number },
  totalPointsEarned: number,
  totalPointsSpent: number,
  totalPointsExpired: number,

  // 推薦系統
  referralCode: string,
  referredBy: string,
  referralCount: number,

  // 登入追蹤
  loginStreak: number,
  lastLoginDate: string,  // YYYY-MM-DD

  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

### 其他集合
- `pointsLedger` - 點數帳本
- `referralCodes` - 推薦碼
- `membershipTiers` - 會員身分組定義
- `missions` - 任務系統
- `redemptionOrders` - 兌換訂單
- `feedbacks` - 用戶反饋
- `admins` - 管理員列表

---

## 👥 會員身分組

| ID | 名稱 | 工具權限 | 說明 |
|---|---|---|---|
| `founder` | 創始會員 | 全部 18 工具 | 永久權限 |
| `paid` | 付費會員 | 全部 18 工具 | 訂閱用戶 |
| `trial` | 試用會員 | 3 個免費工具 | 7 天試用 |
| `grace` | 寬限期 | 3 個免費工具 | 到期後 30 天 |
| `expired` | 已過期 | 3 個免費工具 | 需續訂 |

### 免費工具（所有用戶可用）
- `reservoir` - 大小水庫專案
- `estate` - 金融房產專案
- `tax` - 稅務傳承專案

---

## 🎯 點數規則

| 動作 | 點數 | 限制 |
|---|---|---|
| 每日登入 | +5 | 每天 1 次 |
| 使用工具 | +10 | 每天 10 次 |
| 連續 7 天 | +50 | 每週 1 次 |
| 連續 30 天 | +200 | 每月 1 次 |
| 推薦註冊 | +100 | 無限 |
| 推薦付費 | +1000 | 雙方各得 |

---

## ☁️ Cloud Functions

### Callable 函數
| Function | 說明 |
|---|---|
| `onDailyLogin` | 每日登入獎勵 |
| `onToolUse` | 工具使用獎勵 |
| `getUserPointsSummary` | 取得點數摘要 |
| `processReferral` | 處理推薦碼 |
| `updateReferralCode` | 更新推薦碼 |
| `redeemPoints` | 兌換點數 |

### Scheduled 函數
| Function | 排程 | 說明 |
|---|---|---|
| `checkMembershipExpiry` | 每小時 | 檢查會員到期 |
| `expirePoints` | 每天 | 點數過期處理 |
| `deductDailyDays` | 每天 00:00 | 扣除會員天數 |

### HTTP 函數
| Function | 說明 |
|---|---|
| `lineWebhook` | LINE Bot Webhook |
| `liffRegister` | LINE LIFF 註冊 |

---

## 📝 部落格系統

### 文章結構
```
src/data/blog/
├── articles/           # 63 篇文章 (01-*.ts ~ 63-*.ts)
├── index.ts           # 匯出所有文章
└── types.ts           # BlogArticle 型別
```

### 新增文章流程
1. 建立文章檔案：`src/data/blog/articles/{id}-{slug}.ts`
2. 更新匯出：`src/data/blog/index.ts`（import + 加入陣列）
3. 更新 SEO API：`api/blog/[slug].ts` 加入 metadata（爬蟲用的 OG tags）
4. Git commit + push（Vercel 自動部署）

### 文章分類與 OG 圖片
| 分類 ID | 分類名稱 | OG 圖片 |
|---------|---------|---------|
| `mortgage` | 房貸知識 | og-mortgage.png |
| `retirement` | 退休規劃 | og-retirement.png |
| `tax` | 稅務傳承 | og-tax.png |
| `investment` | 投資理財 | og-investment.png |
| `tools` | 工具教學 | og-tools.png |
| `sales` | 銷售技巧 | og-sales.png |

### SEO 機制
- **Vercel API** (`api/blog/[slug].ts`)：偵測社群爬蟲，返回正確 meta tags
- **爬蟲檢測**：FacebookBot、LinkedInBot、WhatsApp、TelegramBot、LINE
- **一般瀏覽器**：返回 SPA，由 React 渲染

### 文章風格（4THINK 風格）
- 開頭直接點破痛點
- 用故事或情境帶入
- 重點用粗體標註
- 善用「一句話總結」
- 結尾給行動建議
- 精煉、少廢話

### 內部連結
每篇文章結尾加入「延伸閱讀」區塊：
```html
<div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
  <h4 class="text-white font-bold mb-4">📚 延伸閱讀</h4>
  <ul class="text-slate-300 mb-0 space-y-2">
    <li>→ <a href="/blog/[slug]" class="text-blue-400 hover:underline">[文章標題]</a></li>
  </ul>
</div>
```

### 文章寫作規範
- **避免業務感**：文章分享給客戶時不能有推銷感
- **禁止詞彙**：「業務話術建議」、「金融從業人員必備」
- **建議替代詞**：「實際省錢試算」、「小提醒」、「幫你」

---

## 🎨 品牌規範

### 詞語修正（避免敏感金融詞彙）
| ❌ 避免 | ✅ 改用 |
|---|---|
| 利差 | 收益差額 |
| 套利 | 資產累積 |
| 槓桿 | 保障倍數 |

### 色彩規範
- 負值使用 **藍色**（不用紅色，避免負面觀感）
- 主色調：紫色漸層 (`from-purple-600 to-blue-600`)
- 背景：深色系 (`slate-900`, `slate-800`)

---

## 🖥️ 常用指令

```bash
# === 前端開發 ===
cd C:\Users\User\UltraAdvisor
npm run dev

# === 前端部署（Vercel，自動）===
git add . && git commit -m "feat: ..." && git push
# Vercel 會自動從 main branch 部署

# === Admin 後台 ===
cd admin && npm run dev

# === Cloud Functions ===
firebase deploy --only functions
firebase functions:log

# === Firestore ===
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes

# === 網域管理（Vercel）===
npx vercel domains ls
npx vercel alias ls
```

---

## 🔑 重要 Hooks

### usePoints.ts
```typescript
import { usePoints, pointsApi } from '../hooks/usePoints';

// Hook 方式
const { triggerDailyLogin, triggerToolUse } = usePoints();

// API 方式（推薦）
await pointsApi.dailyLogin();
await pointsApi.toolUse('mortgage-calculator');
```

### useMembership.ts
```typescript
import { useMembership } from '../hooks/useMembership';

const { tier, canUseTool, isLoading } = useMembership();

if (canUseTool('golden-vault')) {
  // 可以使用
}
```

---

## 🐛 常見問題排查

### Firestore 權限錯誤
- 檢查 `firestore.rules`
- 確認用戶已登入 (`context.auth` 存在)

### Cloud Functions INTERNAL 錯誤
- 通常是缺少 Firestore 複合索引
- Firebase Console → Firestore → 索引 建立

### React Error #31
- 「Objects are not valid as a React child」
- `{points}` 應改為 `{points.current}`

### 本地開發 EPERM 錯誤
```powershell
Remove-Item -Recurse -Force "node_modules\.vite" -ErrorAction SilentlyContinue
npm run dev
```

### www 網域問題
- 兩個網域 (`ultra-advisor.tw` 和 `www.ultra-advisor.tw`) 都已設定在 Vercel
- 都指向同一個 `ultra-advisor` 專案
- 不做 www 重導向，兩個都能用

---

## 🚀 部署檢查清單

### 前端部署
- [ ] `npm run build` 無錯誤
- [ ] `npx vercel --prod --yes` 成功
- [ ] 測試 https://ultra-advisor.tw 正常

### Cloud Functions 部署
- [ ] `firebase deploy --only functions` 成功
- [ ] 環境變數已設定（LINE、reCAPTCHA）
- [ ] `firebase functions:log` 無錯誤

### 新增文章部署
- [ ] 文章檔案已建立
- [ ] `index.ts` 已更新
- [ ] `api/blog/[slug].ts` 已更新 metadata
- [ ] 部署後測試 OG 圖片顯示

---

## 📝 開發注意事項

1. **修改 Cloud Functions 後**：記得 `firebase deploy --only functions`
2. **新增 Firestore 查詢**：檢查是否需要複合索引
3. **點數相關**：`points` 是物件 `{ current: number }`，不是純數字
4. **部落格 SEO**：修改後需重新部署 Vercel
5. **網域設定**：用 `npx vercel domains` 管理，不要用 alias

---

## 📂 重要檔案位置

| 功能 | 檔案 |
|------|------|
| Firebase 設定 | `src/firebase.ts` |
| 工具定義 | `src/constants/tools.ts` |
| 會員權限 | `src/hooks/useMembership.ts` |
| 點數系統 | `src/hooks/usePoints.ts` |
| 部落格引擎 | `src/pages/BlogPage.tsx` |
| 部落格文章 | `src/data/blog/articles/` |
| SEO API | `api/blog/[slug].ts` |
| Cloud Functions | `functions/index.js` |
| 安全規則 | `firestore.rules` |
| 部署設定 | `vercel.json` |
| WarRoom v2 | `src/components/WarRoom/` |
| CashFlowVisualizer | `src/components/CashFlowVisualizer.tsx` |
| English Landing | `src/pages/EnglishLandingPage.tsx` |
| Market Report API | `api/market-report.ts` |

---

## 🆕 Recent Features (2026-04)

### CashFlowVisualizer
- 770 行，即時收支流動視覺化
- 位於 `/calculator` tab 3，公開不需登入
- 功能：每秒/分/時/日收支動畫、自訂支出項目、播放/暫停/重置
- 純 client-side，不存 Firestore

### WarRoom v2
- 取代舊 `ClientDashboard`（App.tsx 內有 `✅ 使用新版 UltraWarRoom 取代舊的 ClientDashboard` 註釋）
- 4 個 Tab：Overview / Clients / Tools / Share
- 7 種 Modal：AddClient, EditClient, EditProfile, ChangePassword, Payment, Feedback
- 整合客戶關係管理、工具使用統計、分享功能

### English Landing Page
- 路由：`/en`，lazy loaded
- 用途：NVIDIA Inception 審查 + 國際受眾
- 定位：AI product company（非財務顧問）
- hreflang tags：zh-TW=/, en=/en, x-default=/en
- 語言切換按鈕（中文版/English）

### Market Report API
- 端點：`GET /api/market-report?date=YYYY-MM-DD`
- 資料源：Firestore `dailyMarketReports/{date}`
- 回傳：aiSummary（headline/summary/keyPoints/outlook/sentiment）+ marketData
- 快取：5 分鐘（public, s-maxage=300）
- 時區：台灣時間 GMT+8

---

## 🚨 注意事項（新增）

### 部署
- `git push` → Vercel 自動部署（使用 `--legacy-peer-deps`）
- 如果 npm install 失敗，加 `--legacy-peer-deps` flag

### html2canvas 限制
- 跨域圖片無法渲染（CORS 限制）
- 用 `html-to-image` 作為備選方案
