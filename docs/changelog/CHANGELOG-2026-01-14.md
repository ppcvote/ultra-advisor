# 更新日誌 2026-01-14

## LINE Bot 後台功能增強

### 新增訊息設定
- **收到 Email 回覆**：用戶傳送 Email 後的即時回覆訊息
- **帳號開通成功訊息**：包含密碼訊息和 Flex Message 標題
- 支援動態變數：`{{password}}`、`{{referralCode}}`、`{{referrerName}}`

### LINE Bot 防刷機制
- 新增速率限制功能，防止同一 LINE 帳號大量註冊
- **冷卻時間**：成功註冊後需等待 30 分鐘
- **每日上限**：同一 LINE 帳號每天最多嘗試 3 次
- **智慧判斷**：
  - ✅ 成功註冊 → 計入冷卻
  - ❌ Email 已註冊 → 不計入冷卻
  - ❌ 系統錯誤 → 不計入冷卻
- 資料存入 Firestore `rateLimits` 集合

---

## 管理後台用戶管理改進

### 用戶列表優化
- 新增「用戶」欄位：顯示頭像 + 姓名 + Email
- 「到期時間」改為「剩餘天數」(daysRemaining)

### 編輯 Modal 強化
- 新增 `displayName` 和 `photoURL` 欄位
- 新增「剩餘天數」調整功能（+1, +7, +30, +365 天按鈕）
- **Profile 子集合同步**：displayName/photoURL 存入 `users/{uid}/profile/data`，與登入頁面資料結構一致

---

## 檔案變更清單

### `functions/index.js`
- 新增 `checkRateLimit()` 速率限制檢查函數
- 新增 `recordRegistrationAttempt()` 記錄註冊嘗試
- 修改 `handleReferralInput()` 整合防刷機制
- 修改 `handleEvent()` 支援動態 Email 收到訊息

### `admin/src/pages/LineBotEditor.jsx`
- 新增「收到 Email 回覆」卡片
- 新增「帳號開通成功（密碼訊息）」卡片
- 新增對應的 DEFAULT_WELCOME 欄位

### `admin/src/pages/Users.jsx`
- 新增 `getDoc`, `setDoc` imports
- 修改 `fetchUsers()` 載入 profile 子集合
- 修改 `handleSaveEdit()` 同步更新 profile 子集合
- 新增 `adjustDays()` 天數調整函數
- 修改表格欄位和編輯 Modal UI

---

## 部署指令

```bash
# 部署 Cloud Functions（LINE Bot 防刷機制）
cd functions && firebase deploy --only functions

# 部署管理後台
cd admin && npm run build && firebase deploy --only hosting:admin

# 部署主應用
npm run build && firebase deploy --only hosting
```

---

## 注意事項

1. **Firestore 新集合**：`rateLimits` - 用於儲存 LINE 用戶的註冊嘗試記錄
2. **Profile 子集合**：用戶的 displayName/photoURL 現在統一存在 `users/{uid}/profile/data`
3. **LINE Bot 訊息**：需要在後台 LINE Bot 頁面儲存一次才會生效
