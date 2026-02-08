# UltraCloud 傲創雲端 - 產品規格書

> **版本：1.0**
> **最後更新：2026-01-25**

---

## 📋 產品概述

**UltraCloud 傲創雲端** 是一款專為業務團隊設計的 LINE 群組檔案管理機器人。透過簡單的指令，讓團隊成員在 LINE 群組中即可完成檔案的雲端同步、搜尋與管理，解決「檔案被聊天訊息淹沒」的痛點。

### 核心價值
- **3 秒存檔**：回覆檔案 + 輸入「存」= 自動同步雲端
- **智慧命名**：支援自訂檔名，告別 IMG_20260125.jpg
- **跨平台搜尋**：同時搜尋本地儲存與 Google Drive
- **企業級資安**：Google Cloud 基礎架構，群組隔離機制

---

## 🔧 技術架構

| 層級 | 技術 | 說明 |
|------|------|------|
| **機器人平台** | LINE Messaging API | 處理群組訊息與檔案 |
| **後端運算** | Vercel Serverless | Node.js API 端點 |
| **檔案儲存** | Firebase Storage | 雲端檔案存放 |
| **資料庫** | Firebase Firestore | 檔案 metadata 儲存 |
| **雲端整合** | Google Drive API | 讀取既有雲端資料夾 |

---

## 📁 專案結構

```
C:\Users\User\ultracloud\
├── api/
│   ├── webhook.js        # LINE Webhook 主處理程式
│   ├── files.js          # 檔案列表 API（網頁版）
│   └── test.js           # 環境測試端點
├── lib/
│   ├── firebaseStorage.js  # Firebase Storage 上傳模組
│   ├── firestore.js        # Firestore 資料操作
│   └── googleDriveRead.js  # Google Drive 讀取模組
├── vercel.json           # Vercel 部署設定
└── package.json
```

---

## 🌐 部署資訊

| 項目 | 值 |
|------|-----|
| **Vercel 專案** | ultracloud |
| **Webhook URL** | https://ultracloud.vercel.app/api/webhook |
| **檔案列表頁** | https://ultracloud.vercel.app/api/files?format=html |
| **測試端點** | https://ultracloud.vercel.app/api/test |

---

## 📱 LINE 官方帳號

| 項目 | 值 |
|------|-----|
| **帳號名稱** | UltraCloud |
| **LINE ID** | @783dgvvs |
| **加入連結** | https://line.me/R/ti/p/@783dgvvs |
| **Channel ID** | 2008964033 |

---

## 🔐 環境變數

```env
# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=Sp0spwCA/Diagr0o66x4jQNt5P4bTmabiel+WO4wOaqMW1Q/...
LINE_CHANNEL_SECRET=14ac93255bcc047dc954039118193393

# Firebase
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Google Drive（唯讀存取）
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GOOGLE_DRIVE_ROOT_FOLDER_ID=1gwarGeHauyMIutxuAG7GRQLQ6rK0BphZ
```

---

## 💬 指令列表

### 存檔指令

| 指令 | 說明 | 範例 |
|------|------|------|
| `存` | 回覆檔案後輸入，同步到雲端 | 回覆圖片 → 輸入「存」 |
| `存 [檔名]` | 自訂檔名儲存 | `存 王先生報價單` |
| `儲存` | 同「存」 | - |
| `save` | 英文版 | - |

### 搜尋指令

| 指令 | 說明 | 範例 |
|------|------|------|
| `找 [關鍵字]` | 搜尋已存檔案 | `找 報價單` |
| `搜雲端 [關鍵字]` | 搜尋 Google Drive | `搜雲端 理賠` |
| `雲端 [關鍵字]` | 同「搜雲端」 | `雲端 合約` |

### 列表指令

| 指令 | 說明 | 範例 |
|------|------|------|
| `檔案列表` | 列出最近 10 筆檔案 | - |
| `檔案列表 20` | 列出最近 20 筆檔案 | - |
| `列表` | 同「檔案列表」 | - |
| `雲端資料夾` | 列出 Google Drive 資料夾結構 | - |
| `資料夾` | 同「雲端資料夾」 | - |

### 其他指令

| 指令 | 說明 |
|------|------|
| `幫助` | 顯示指令說明 |
| `help` | 同「幫助」 |
| `?` | 同「幫助」 |

---

## 🔄 運作流程

### 檔案儲存流程

```
1. 用戶在群組傳送檔案（圖片/影片/文件）
   ↓
2. Webhook 接收，暫存檔案資訊到 pendingFiles Map（5 分鐘過期）
   ↓
3. 用戶「回覆」該檔案，輸入「存」或「存 自訂檔名」
   ↓
4. 系統檢查 quotedMessageId，從 pendingFiles 取得檔案
   ↓
5. 上傳到 Firebase Storage（路徑：groups/{groupId}/{timestamp}_{fileName}）
   ↓
6. 儲存 metadata 到 Firestore（collection: ultracloud_files）
   ↓
7. 回覆成功訊息，附上下載連結
```

### 搜尋流程

```
1. 用戶輸入「找 關鍵字」
   ↓
2. 查詢 Firestore：ultracloud_files
   - where groupId == 當前群組
   - where fileName contains 關鍵字
   ↓
3. 格式化結果，回覆檔案列表與連結
```

---

## 📊 Firestore 資料結構

### ultracloud_files（檔案記錄）

```javascript
{
  groupId: "Cxxxxxxxxxx",      // LINE 群組 ID
  userId: "Uxxxxxxxxxx",       // 上傳者 LINE User ID
  fileName: "報價單.pdf",       // 檔案名稱
  fileType: "file",            // file | image | video | audio
  fileId: "uuid-xxx",          // Firebase Storage 檔案 ID
  fileLink: "https://...",     // 下載連結
  size: 1024000,               // 檔案大小（bytes）
  uploadedAt: Timestamp,       // 上傳時間
}
```

### 索引需求

```
Collection: ultracloud_files
- groupId (ASC) + uploadedAt (DESC)
- groupId (ASC) + fileName (ASC)
```

---

## 🔒 資安機制

### 群組隔離
- 每個 LINE 群組有獨立的 `groupId`
- 查詢時強制帶入 `groupId` 條件
- A 群組無法存取 B 群組的檔案

### 資料加密
- 傳輸：HTTPS / TLS 1.3
- 儲存：Firebase Storage 預設加密（AES-256）

### 存取控制
- LINE Webhook 驗證 Channel Secret
- Firebase Storage 規則限制存取
- Google Drive 使用 Service Account（唯讀）

---

## 📈 效率數據

| 指標 | 傳統方式 | UltraCloud |
|------|---------|------------|
| 單檔存檔時間 | 5-10 分鐘 | **3 秒** |
| 操作步驟 | 5 步驟 | **2 動作** |
| 搜尋舊檔案 | 翻找 30 分鐘 | **即時** |
| 每日節省時間 | - | **30 分鐘/人** |

---

## 🎯 適用對象

| 產業 | 使用情境 |
|------|---------|
| **保險業務** | 保單、理賠文件、客戶資料 |
| **房仲團隊** | 物件照片、合約、成交資料 |
| **汽車銷售** | 報價單、車款規格、交車文件 |
| **B2B 業務** | 提案簡報、報價、合約 |
| **專案團隊** | 設計稿、會議紀錄、進度報告 |

---

## 🛠️ 常用指令

```bash
# 本地開發
cd C:\Users\User\ultracloud
npm install
vercel dev

# 部署到 Vercel
vercel --prod

# 查看 Log
vercel logs ultracloud --follow

# 環境變數管理
vercel env ls
vercel env add LINE_CHANNEL_ACCESS_TOKEN
```

---

## 🐛 常見問題

### Q: 檔案超過 5 分鐘無法儲存？
**A:** pendingFiles 暫存有 5 分鐘過期機制。請重新傳送檔案後再試。

### Q: 搜雲端找不到檔案？
**A:** 確認：
1. Google Drive 資料夾已分享給 Service Account
2. 環境變數 `GOOGLE_DRIVE_ROOT_FOLDER_ID` 正確
3. 檔案名稱包含搜尋關鍵字

### Q: LINE 回覆失敗？
**A:** 可能原因：
1. Channel Access Token 過期
2. 機器人未加入群組
3. 訊息額度用盡

---

## 📝 更新日誌

### v1.0 (2026-01-25)
- 初始版本
- 支援檔案上傳到 Firebase Storage
- 支援自訂檔名
- 支援搜尋本地檔案
- 支援搜尋 Google Drive
- 支援列出雲端資料夾

---

## 📞 聯絡資訊

- **LINE 官方帳號**：@783dgvvs
- **官網**：https://ultra-advisor.tw/#ultracloud
- **技術支援**：support@ultra-advisor.tw

---

*此文件由 Claude Code 自動生成，供 Notion 使用*