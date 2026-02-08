# 傲創聯盟 (Ultra Alliance) 規格書

> **版本**：v1.0
> **最後更新**：2026-01-26
> **狀態**：開發中

---

## 1. 專案概述

### 1.1 定義
傲創聯盟是 Ultra Advisor 的實體店家合作計畫，串聯線下優質場所（咖啡廳、餐廳、商務中心等），為財務顧問會員打造專屬的商務與生活圈。

### 1.2 核心目標
1. **提升品牌形象**：透過優質合作店家提升 Ultra Advisor 的品牌價值
2. **增加會員黏著度**：讓會員有更多理由持續使用平台與續費

### 1.3 第一階段目標
- 達成 **30 家合作店家**
- 覆蓋主要城市（台北、新北、台中、高雄）

---

## 2. 合作店家類型

### 2.1 商務會面場所
適合財務顧問與客戶進行專業洽談：
- 高級咖啡廳
- 商務中心
- 私人包廂
- 共享辦公室

### 2.2 生活休閒場所
提供顧問放鬆、社交的優質選擇：
- 特色餐廳
- 健身房
- 美容美髮
- SPA 會館

---

## 3. 合作模式

### 3.1 店家權益

| 項目 | 說明 | 提供方 |
|------|------|--------|
| **短影音拍攝** | 專業團隊拍攝店家介紹影片，於 Ultra Advisor 平台曝光 | UltraLab（全 AI 網路門面工作站） |
| **3D 渲染影片** | 高品質 3D 店家環境展示影片，提升品牌質感 | UltraLab |
| **平台曝光** | 店家資訊於 APP 內地圖模式展示，導入會員流量 | Ultra Advisor |

### 3.2 店家義務
- **提供會員優惠**：由店家自行決定優惠內容（例如：95 折、滿額折扣、免費升級等）
- **配合驗證**：接受會員出示 APP 會員頁面作為身份驗證

### 3.3 合作條件
- 店家通過 Ultra Advisor 團隊的**實地勘查審核**即可成為合作夥伴
- **免費合作**，不收取任何加盟費或年費

---

## 4. 會員權益

### 4.1 優惠使用方式
1. 會員打開 Ultra Advisor APP
2. 進入戰情室 → 傲創聯盟地圖
3. 查看附近合作店家及優惠資訊
4. 消費時**出示 APP 會員頁面**給店家
5. 店家確認會員身份後提供約定優惠

### 4.2 優惠規則
- 各店家優惠**獨立設定**，依店家公告為準
- 優惠內容由店家自訂，可能包含：
  - 消費折扣（例如 95 折）
  - 滿額折抵（例如滿 500 折 50）
  - 免費升級（例如免費加大飲品）
  - 贈品（例如甜點招待）

### 4.3 會員分級（未來規劃）
> 目前不實作，未來視發展情況調整

可能方向：依會員等級享有不同優惠層級，但具體方案需與店家協商。

---

## 5. 點數整合（未來規劃）

### 5.1 規劃方向
- 會員可使用 UA 點數在合作店家兌換折價券
- 點數兌換機制需與現有點數系統整合

### 5.2 實施時程
- **目前狀態**：暫不實作
- **預計時程**：待店家網絡成熟後再行規劃

---

## 6. 技術實作

### 6.1 資料結構

#### Firestore Collection: `partnerApplications`
```typescript
interface PartnerApplication {
  id: string;

  // 店家資訊
  storeName: string;
  storeType: 'cafe' | 'restaurant' | 'business-center' | 'gym' | 'beauty' | 'other';
  otherStoreType?: string;
  district: string;
  address: string;

  // 聯絡資訊
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactRole?: string;

  // 合作意願
  cooperationInterests: string[];  // ['short-video', '3d-render', 'member-discount', 'tier-system']
  discountOffer?: string;          // 店家願意提供的優惠說明
  additionalInfo?: string;

  // 系統資訊
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  source: 'website';
}
```

#### Firestore Collection: `approvedPartners`（待建立）
```typescript
interface ApprovedPartner {
  id: string;
  applicationId: string;         // 對應原申請 ID

  // 店家資訊
  storeName: string;
  storeType: string;
  district: string;
  address: string;

  // 地理位置（用於地圖顯示）
  location: {
    lat: number;
    lng: number;
  };

  // 展示資訊
  description?: string;
  images: string[];
  videoUrl?: string;             // UltraLab 製作的影片

  // 優惠資訊
  discountOffer: string;
  discountDetails?: string;

  // 營業資訊
  businessHours?: string;
  phone?: string;
  website?: string;

  // 系統資訊
  isActive: boolean;
  approvedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 6.2 前端頁面

| 頁面 | 路徑 | 說明 |
|------|------|------|
| 傲創聯盟介紹 | `/alliance` | 公開頁面，介紹合作計畫 |
| 合作申請表單 | `/partner-apply` | 店家填寫申請資料 |
| 店家地圖（待開發） | 戰情室內 | 會員查看合作店家 |

### 6.3 後台功能

| 功能 | 位置 | 說明 |
|------|------|------|
| 申請管理 | Admin → 申請管理 → 合作申請 | 查看、審核合作申請 |
| 店家管理（待開發） | Admin → 傲創聯盟 | 管理已通過的合作店家 |

### 6.4 Cloud Functions

| Function | 觸發條件 | 說明 |
|----------|----------|------|
| `onNewPartnerApplication` | `partnerApplications` 新增 | 發送 LINE 通知給管理員 |

---

## 7. 申請流程

### 7.1 店家申請流程
```
店家填寫申請表單
       ↓
  系統儲存申請
       ↓
LINE 通知管理員
       ↓
  管理員審核
       ↓
  ┌────┴────┐
  ↓         ↓
通過      拒絕
  ↓         ↓
安排勘查   通知店家
  ↓
簽署合作協議
  ↓
UltraLab 製作影片
  ↓
上架至平台
```

### 7.2 申請狀態流程
```
pending（待處理）
    ↓
reviewing（審核中）
    ↓
┌───┴───┐
↓       ↓
approved rejected
（已通過）（已拒絕）
```

---

## 8. UltraLab 整合

### 8.1 定義
UltraLab 是 Ultra Advisor 旗下的**全 AI 網路門面工作站**，專門為合作店家提供數位內容服務。

### 8.2 服務內容
- **短影音製作**：AI 輔助的店家介紹影片
- **3D 渲染影片**：店家環境的 3D 視覺化展示
- **AI 網頁設計**：為店家建立線上門面（未來功能）

### 8.3 服務對象
- **合作店家專屬**，非一般會員可使用

---

## 9. 開發優先順序

### Phase 1：基礎建設 ✅ 已完成
- [x] 傲創聯盟介紹頁（AlliancePage）
- [x] 合作申請表單（PartnerApplicationPage）
- [x] 後台申請管理（ApplicationsManager）
- [x] 新申請 LINE 通知

### Phase 2：店家展示（待開發）
- [ ] `approvedPartners` Collection 設計
- [ ] 店家地圖元件（整合 Google Maps）
- [ ] 戰情室內的傲創聯盟入口
- [ ] 店家詳情頁面

### Phase 3：店家管理（待開發）
- [ ] 後台店家管理頁面
- [ ] 店家資訊編輯功能
- [ ] 店家上下架管理

### Phase 4：進階功能（未來）
- [ ] 會員分級優惠
- [ ] 點數兌換折價券
- [ ] 消費回饋機制

---

## 10. 安全性考量

### 10.1 Firestore Rules
```javascript
// 合作申請：任何人可提交，管理員可讀寫
match /partnerApplications/{doc} {
  allow read: if isAdmin();
  allow create: if true;
  allow update, delete: if isAdmin();
}

// 已通過店家：公開讀取，管理員可寫
match /approvedPartners/{doc} {
  allow read: if true;  // 會員需要查看店家資訊
  allow write: if isAdmin();
}
```

### 10.2 會員驗證
- 會員身份以 APP 內會員頁面為準
- 店家僅需目視確認，不需查詢系統
- 未來可考慮加入 QR Code 驗證機制

---

## 11. 附錄

### 11.1 相關檔案
- `src/pages/AlliancePage.tsx` - 傲創聯盟介紹頁
- `src/pages/PartnerApplicationPage.tsx` - 合作申請表單
- `admin/src/pages/ApplicationsManager.jsx` - 後台申請管理
- `functions/index.js` → `onNewPartnerApplication` - LINE 通知

### 11.2 相關文章
- `src/data/blog/articles/55-ultra-alliance-maker-island-ecosystem-2026.ts`

### 11.3 設計參考
- 品牌色：紫色漸層（`from-purple-600 to-pink-600`）
- 圖標：Handshake、Building2、Store
