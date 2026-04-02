# 🚀 Day 1：環境設定 + 基礎架構

> **目標**：建立 React 後台專案，完成登入頁和儀表板  
> **時間**：2-3 小時  
> **狀態**：✅ 代碼已準備好

---

## 📦 已提供的文件

```
admin/
├── index.html                      # HTML 入口
├── package.json                    # 專案配置
├── vite.config.js                  # Vite 配置
├── tailwind.config.js              # Tailwind 配置
├── postcss.config.js               # PostCSS 配置
└── src/
    ├── main.jsx                    # React 入口
    ├── App.jsx                     # 主應用
    ├── index.css                   # 全局樣式
    ├── firebase.js                 # Firebase 配置
    ├── components/
    │   └── Layout.jsx              # 主要布局
    └── pages/
        ├── Login.jsx               # 登入頁
        └── Dashboard.jsx           # 儀表板
```

---

## 🔧 Step 1: 準備工作

### 1.1 確認環境

```powershell
# 檢查 Node.js 版本（需要 18+）
node --version

# 檢查 npm 版本
npm --version
```

### 1.2 創建 admin 資料夾

```powershell
# 回到專案根目錄
cd C:\Users\User\UltraAdvisor

# 創建 admin 資料夾
mkdir admin
cd admin
```

---

## 📥 Step 2: 安裝文件

### 2.1 複製所有文件

**將下載的所有文件按照以下結構放置**：

```
C:\Users\User\UltraAdvisor\admin\
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src\
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── firebase.js
    ├── components\
    │   └── Layout.jsx
    └── pages\
        ├── Login.jsx
        └── Dashboard.jsx
```

### 2.2 安裝依賴

```powershell
cd C:\Users\User\UltraAdvisor\admin
npm install
```

**等待 3-5 分鐘安裝完成...**

---

## 🔐 Step 3: 配置 Firebase

### 3.1 獲取 Firebase 配置

1. 前往 **Firebase Console**：https://console.firebase.google.com
2. 選擇你的專案 **grbt-f87fa**
3. 點擊 **專案設定**（齒輪圖示）
4. 往下滑找到 **「您的應用程式」**
5. 點擊 **</> 網頁** 圖示
6. 註冊應用程式名稱：`Ultra Advisor Admin`
7. **複製 Firebase 配置**

### 3.2 更新 firebase.js

**編輯**：`src/firebase.js`

**找到這段**：
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "grbt-f87fa.firebaseapp.com",
  projectId: "grbt-f87fa",
  storageBucket: "grbt-f87fa.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

**替換成你複製的配置**（保持格式）

---

## 👤 Step 4: 創建管理員帳號

### 4.1 在 Firebase Console 創建管理員

1. 前往 **Firebase Console** > **Authentication**
2. 點擊 **「新增使用者」**
3. 輸入：
   - Email: `admin@ultraadvisor.com`（或你想要的）
   - 密碼: 設定一個強密碼（記住它）
4. 點擊 **「新增使用者」**

### 4.2 標記為管理員（未來實作）

**目前先跳過**，我們 Day 5 會加入權限系統

---

## 🚀 Step 5: 啟動開發伺服器

```powershell
cd C:\Users\User\UltraAdvisor\admin
npm run dev
```

**應該看到**：
```
  VITE v5.0.8  ready in 500 ms

  ➜  Local:   http://localhost:3001/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

**打開瀏覽器**：http://localhost:3001

---

## ✅ Step 6: 測試登入

### 6.1 登入頁面

應該看到漂亮的登入頁面：
- 藍紫色漸層背景
- 白色卡片
- Email 和密碼輸入框

### 6.2 登入測試

**輸入**：
- Email: `admin@ultraadvisor.com`
- 密碼: 你剛才設定的密碼

**點擊登入**

### 6.3 成功！

應該會跳轉到儀表板，看到：
- 左側選單（6 個選項）
- 頂部 Header（折疊按鈕、Email、頭像）
- 4 個統計卡片
- 最新用戶表格

---

## 📊 Day 1 完成檢查清單

- [ ] Node.js 環境正確
- [ ] admin 資料夾創建
- [ ] 所有文件已放置
- [ ] npm install 成功
- [ ] Firebase 配置已更新
- [ ] 管理員帳號已創建
- [ ] 開發伺服器啟動成功
- [ ] 登入頁面正常顯示
- [ ] 可以成功登入
- [ ] 儀表板正常顯示

---

## 🎯 預期結果

### 登入頁面
```
┌─────────────────────────────┐
│                             │
│    Ultra Advisor            │
│    後台管理系統              │
│                             │
│    ┌─────────────────┐      │
│    │ Email           │      │
│    └─────────────────┘      │
│                             │
│    ┌─────────────────┐      │
│    │ 密碼            │      │
│    └─────────────────┘      │
│                             │
│    [     登入     ]         │
│                             │
└─────────────────────────────┘
```

### 儀表板
```
┌─────────────────────────────────────┐
│ ☰ Ultra Advisor  admin@...          │
├─────────────────────────────────────┤
│                                     │
│  今日統計                            │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐       │
│  │ 12 │ │ 45 │ │ 23 │ │ 67%│       │
│  │新增│ │試用│ │活躍│ │轉換│       │
│  └────┘ └────┘ └────┘ └────┘       │
│                                     │
│  最新用戶                            │
│  Email | 狀態 | 註冊時間 | 到期     │
│  ────────────────────────────────   │
│  ...                                │
│                                     │
└─────────────────────────────────────┘
```

---

## 🐛 常見問題

### 問題 1：npm install 失敗

**解決**：
```powershell
# 清除 npm 快取
npm cache clean --force

# 重新安裝
npm install
```

### 問題 2：Firebase 配置錯誤

**檢查**：
- apiKey 是否正確
- projectId 是否為 `grbt-f87fa`
- 引號是否正確

### 問題 3：無法登入

**檢查**：
- Firebase Console 中用戶是否已創建
- Email 和密碼是否正確
- 瀏覽器 Console 有無錯誤

### 問題 4：頁面空白

**檢查**：
- 瀏覽器 Console 有無錯誤
- Firebase 配置是否正確
- 文件結構是否正確

---

## 🔜 Day 2 預告

**明天我們會實作**：
- 👥 完整的用戶管理功能
- 🔍 搜尋和篩選
- 📊 用戶詳情頁面
- ⏱️ 延長試用功能
- 🗑️ 刪除用戶功能

**時間**：6-8 小時

---

## 💬 需要幫助？

**遇到問題？**

1. 檢查瀏覽器 Console
2. 檢查終端錯誤訊息
3. 確認文件結構正確
4. 確認 Firebase 配置正確

**告訴我**：
- 遇到什麼錯誤
- 錯誤訊息是什麼
- 在哪個步驟卡住

**我會立即幫你解決！** 🚀

---

**現在立即開始 Day 1 吧！** 💪

**完成後告訴我，我們開始 Day 2！** 🎉
