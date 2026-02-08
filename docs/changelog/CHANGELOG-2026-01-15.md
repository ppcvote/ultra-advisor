# 更新日誌 2026-01-15

## 規劃介面大改版

### 側邊欄改造
- **可收合側邊欄**：288px ↔ 72px，狀態自動存入 localStorage
- **Ultra Advisor LOGO**：使用正確的 SVG LOGO（藍紅曲線 + 紫色橫槓）
- **自訂滾動條**：更細、半透明，支援 WebKit 和 Firefox
- **工具分類整理**：
  - 觀念與診斷（黃色）
  - 創富：資產配置（綠色 + PRO 標籤）
  - 守富：風險控管（藍色 + PRO 標籤）
  - 傳富：稅務傳承（紫色 + PRO 標籤）

### 術語調整（合規優化）
- ~~槓桿與套利~~ → **資產配置**
- ~~現金流防禦~~ → **風險控管**

### 存檔機制強化
- **自動存檔**：資料變更後 10 秒自動儲存
- **手動存檔按鈕**：顯示「點擊儲存」時可立即觸發存檔
- **狀態指示器**：
  - 🟢 已同步（綠色）
  - 🟡 點擊儲存（琥珀色，可點擊）
  - 🔵 儲存中...（藍色動畫）
  - 🔴 儲存失敗（紅色，可點擊重試）

### PRO 升級引導
- **PRO 徽章**：取代「已鎖定」字樣，正向心理框架
- **升級 Modal**：點擊鎖定工具時彈出，展示工具效益與價格

---

## 新增檔案

### `src/constants/tools.ts`
- 工具定義：ID、名稱、圖示、說明、效益、免費/付費標記
- 分類定義：四大分類及其工具列表

### `src/utils/membership.ts`
- `canAccessTool()` - 檢查工具權限
- `getMembershipInfo()` - 解析 Firestore 用戶資料
- `defaultMembershipInfo` - 預設會員資訊

### `src/components/PlannerSidebar.tsx`
- 可收合側邊欄元件
- Ultra Advisor SVG LOGO 元件
- 整合存檔狀態指示器

### `src/components/SaveStatusIndicator.tsx`
- 存檔狀態視覺指示器
- 支援手動存檔按鈕功能

### `src/components/NavItem.tsx`
- 導航項目元件（支援收合模式）

### `src/components/UpgradeModal.tsx`
- PRO 升級引導彈窗

---

## 修改檔案

### `src/App.tsx`
- 整合 PlannerSidebar 取代舊側邊欄
- 新增 `hasUnsavedChanges` 狀態追蹤
- 新增 `handleManualSave()` 手動存檔函數
- 整合 UpgradeModal 升級引導

---

## 部署指令

```bash
# 部署前端
npm run build && firebase deploy --only hosting
```

---

## 注意事項

1. **localStorage 新增 key**：
   - `planner-sidebar-collapsed` - 側邊欄收合狀態
   - `ultra_advisor_active_tab` - 當前工具頁籤（重整後保持）

2. **免費工具**：金融房產專案、大小水庫專案、稅務傳承專案 對所有用戶開放

3. **會員權限**：依據 Firestore `membershipTiers/{tierId}.allowedTools` 判斷
