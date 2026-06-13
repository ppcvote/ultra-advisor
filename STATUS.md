# Advisor → Pin 通知整合 — 部署前置 / BLOCKED 事項

## 需要 HQ 處理（部署前）

### 1. Cloud Functions secret
```bash
firebase functions:config:set \
  pin.webhook_base="https://pin.8338.hk" \
  pin.webhook_secret="<兩邊共用的 HMAC secret>"
firebase deploy --only functions
```
> BLOCKED 此步驟前：connectPinNotifications / disconnectPin / triggerPinDailyQuote 全部會回 `internal: 系統設定不完整`

### 2. Pin 端 advisor skill 宣告 webhooks
Pin 的 advisor skill 需要宣告以下兩個 webhook 事件，才能讓選單出現「🔔 綁定通知」按鈕：
- `_bind` — 接收綁定請求，回傳 `{ pin_user_id, skill_id }`
- `advisor/daily_quote.scheduled` — 接收每日金句推播

> BLOCKED 此步驟前：前端顯示的操作指引（「在 Pin 輸入 /advisor → 🔔 綁定通知」）無效

### 3. 每日推播排程啟用
`functions/index.js` 末尾的 `sendPinDailyQuote` 排程目前被註解掉。
確認 Pin 端 webhook 可收後，取消 `exports.sendPinDailyQuote = ...` 的 4 行註解並重新部署。

---

## 已完成（可驗收）

| 項目 | 狀態 |
|------|------|
| connectPinNotifications callable | ✅ 含 auth + token 驗證 + 10s timeout |
| disconnectPin callable | ✅ |
| triggerPinDailyQuote callable（管理員） | ✅ 可手動驗收推播 |
| _sendPinDailyQuote 邏輯 | ✅ 含 TW 時區日期、簽名、at-least-once |
| pin-helpers.js 純函數 | ✅ |
| 單元測試 19 個（全過） | ✅ `cd functions && node --test pin.test.js` |
| 前端 PinNotificationSection | ✅ build 通過 |
| secret 不進 log；token 不進 log | ✅ |
