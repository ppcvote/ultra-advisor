# Ultra Advisor 品牌識別規範 v1.0

> **最後更新：2026-02-08**
> 本文檔定義 Ultra Advisor 的完整品牌視覺識別系統，包含 LOGO、色彩、字體、應用規範等。

---

## 📋 品牌概述

### 品牌定位
- **品牌名稱**：Ultra Advisor
- **中文定位**：專業財務視覺化解決方案
- **英文定位**：Professional Financial Visualization Platform
- **品牌標語**：讓數據替你說話 / 讓複雜數據變成一目了然的圖表

### 核心價值
1. **專業（Professional）** - 符合金融業標準的專業工具
2. **視覺化（Visualization）** - 用圖表取代複雜數字
3. **效率（Efficiency）** - 節省 15 小時試算時間
4. **信賴（Trust）** - 銀行等級資安標準

### 目標受眾
- 台灣財務顧問
- 保險顧問
- 理財規劃師
- 金融從業人員

---

## 🎨 LOGO 設計系統

### 標準 LOGO 結構

Ultra Advisor LOGO 由三條動態曲線組成，形成字母 "U" 和 "A" 的結合：

```
           藍色曲線 ↘
              ╱ ╲
             ╱   ╲
            ╱  紫  ╲
           ╱   線   ╲
          ╱  ━━━━━  ╲
         ╱           ╲
        ╱             ╲
       ╱               ╲
      ↙                 ↘
   紅色曲線
```

#### 1. 藍色曲線（Blue Curve）
- **漸層色**：`#4DA3FF` → `#2E6BFF`
- **路徑**：從左上方優雅彎曲到右下方
- **象徵意義**：理性分析、解決方案、資產成長
- **發光效果**：青藍色光暈 `rgba(46, 107, 255, 0.7)`

#### 2. 紅色曲線（Red Curve）
- **漸層色**：`#FF6A6A` → `#FF3A3A`
- **路徑**：從右上方優雅彎曲到左下方
- **象徵意義**：風險識別、挑戰、問題發現
- **發光效果**：紅色光暈 `rgba(255, 58, 58, 0.7)`

#### 3. 紫色連結線（Purple Bridge）
- **漸層色**：`#8A5CFF` → `#CE4DFF` → `#E8E0FF`（中心最亮）
- **位置**：橫跨藍紅兩條曲線，象徵連結
- **象徵意義**：專業判斷、平衡決策、連結資產與風險
- **發光效果**：橫向拉伸的紫色光暈（科技感）

### LOGO 技術規格

| 屬性 | 規格 |
|------|------|
| **標準尺寸** | 320 x 420 px (SVG) |
| **筆觸寬度** | 14px（藍紅）、10.2px（紫） |
| **筆觸樣式** | `stroke-linecap: round` 圓角 |
| **最小尺寸** | 寬度不得小於 32px |
| **檔案格式** | PNG (透明背景)、SVG |

### LOGO 使用規範

#### ✅ 正確使用
- 深色背景上使用完整彩色版本
- 保持 LOGO 周圍留白至少等於 LOGO 高度的 10%
- 等比例縮放，不可變形

#### ❌ 禁止使用
- 不可改變 LOGO 顏色
- 不可旋轉 LOGO（除非用於動畫）
- 不可拉伸變形
- 不可在複雜背景上使用（影響辨識度）

---

## 🎨 色彩系統

### 主色調（Primary Colors）

| 色碼 | 色名 | 用途 | Tailwind Class |
|------|------|------|----------------|
| `#FF3A3A` | Ultra Red | 品牌識別色、"Ultra" 字樣 | `text-[#FF3A3A]` |
| `#4DA3FF` | Advisor Blue | 品牌識別色、"Advisor" 字樣 | `text-blue-400` |
| `#3B82F6` | Primary Blue | 主要按鈕、連結 | `bg-blue-600` |

### 輔助色調（Secondary Colors）

| 色碼 | 色名 | 用途 | Tailwind Class |
|------|------|------|----------------|
| `#8A5CFF` ~ `#CE4DFF` | Purple Gradient | 紫色漸層、連結效果 | `from-purple-600 to-purple-400` |
| `#10B981` | Success Green | 正面數據、收益 | `text-emerald-500` |
| `#F59E0B` | Warning Amber | 警示、重要資訊 | `text-amber-500` |

### 背景色系（Background Colors）

| 色碼 | 色名 | 用途 | Tailwind Class |
|------|------|------|----------------|
| `#050B14` | Deep Navy | 主要背景色 | `bg-[#050b14]` |
| `#0F172A` | Slate 900 | 卡片背景 | `bg-slate-900` |
| `#1E293B` | Slate 800 | 次要背景 | `bg-slate-800` |

### 文字色系（Text Colors）

| 色碼 | 色名 | 用途 | Tailwind Class |
|------|------|------|----------------|
| `#FFFFFF` | White | 主要標題 | `text-white` |
| `#CBD5E1` | Slate 300 | 次要文字 | `text-slate-300` |
| `#64748B` | Slate 500 | 輔助文字 | `text-slate-500` |

### 數據視覺化色彩規範 ⭐

**重要原則：負值使用藍色，避免使用紅色造成負面觀感**

| 數據類型 | 顏色 | 說明 |
|---------|------|------|
| **正值/收益** | 綠色 `#10B981` | 資產增長、正面結果 |
| **負值/支出** | 藍色 `#3B82F6` | 避免用紅色，降低負面感受 |
| **中性/基準** | 灰色 `#64748B` | 基準線、參考值 |
| **警示/風險** | 琥珀色 `#F59E0B` | 風險提示、注意事項 |

---

## 📝 字體系統

### 中文字體

| 用途 | 字體 | 字重 | 大小範圍 |
|------|------|------|---------|
| **主標題** | Noto Sans TC | 700-900 | 32-72px |
| **次標題** | Noto Sans TC | 600-700 | 24-32px |
| **內文** | Noto Sans TC | 400-500 | 16-18px |
| **輔助文字** | Noto Sans TC | 300-400 | 12-14px |

### 英文/數字字體

| 用途 | 字體 | 字重 | 大小範圍 |
|------|------|------|---------|
| **品牌名稱** | System UI, Segoe UI | 700-900 | 18-32px |
| **數據呈現** | SF Mono, Consolas | 500-600 | 16-24px |
| **按鈕文字** | System UI | 600-700 | 14-18px |

### 字體使用規範

```css
/* 主標題 */
font-family: 'Noto Sans TC', system-ui, sans-serif;
font-weight: 700;
letter-spacing: 0.02em;

/* 內文 */
font-family: 'Noto Sans TC', system-ui, sans-serif;
font-weight: 400;
line-height: 1.75;

/* 數字/數據 */
font-family: 'SF Mono', 'Consolas', monospace;
font-feature-settings: 'tnum'; /* 等寬數字 */
```

---

## 🎭 視覺風格

### 設計原則

1. **專業但不冰冷** - 使用圓角和漸層增加親和力
2. **數據優先** - 圖表清晰、數字突出
3. **暗色調主導** - 深色背景降低視覺疲勞
4. **科技感** - 適度使用發光效果和動畫

### 圓角規範

| 元素 | 圓角大小 | Tailwind Class |
|------|---------|----------------|
| 按鈕（小） | 12px | `rounded-xl` |
| 按鈕（大） | 16px | `rounded-2xl` |
| 卡片 | 24px | `rounded-[1.5rem]` |
| 大型容器 | 32px | `rounded-[2rem]` |

### 陰影系統

| 層級 | 效果 | 用途 |
|------|------|------|
| **Glow（發光）** | `0 0 20px rgba(59,130,246,0.3)` | 主要按鈕 |
| **Soft（柔和）** | `0 4px 20px rgba(0,0,0,0.2)` | 卡片 |
| **Strong（強烈）** | `0 8px 40px rgba(0,0,0,0.4)` | 彈窗 |

### 動畫規範

```css
/* 標準過渡 */
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

/* 彈性動畫 */
transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);

/* 淡入效果 */
animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1);
```

---

## 🚫 詞彙規範（避免金融敏感詞）

為避免誤觸金融法規，以下詞彙需要替換：

| ❌ 避免使用 | ✅ 替代詞彙 |
|------------|-----------|
| 利差 | 收益差額 |
| 套利 | 資產累積 |
| 槓桿 | 保障倍數 |
| 保證獲利 | 歷史回測結果 |
| 穩賺不賠 | 風險相對較低 |
| 投資建議 | 規劃參考 |
| 推薦商品 | 工具試算 |

---

## 📐 介面元件規範

### 按鈕（Buttons）

#### 主要按鈕（Primary）
```css
background: linear-gradient(to right, #3B82F6, #2563EB);
padding: 12px 32px;
border-radius: 16px;
font-weight: 700;
box-shadow: 0 0 30px rgba(59,130,246,0.4);
```

#### 次要按鈕（Secondary）
```css
background: #1E293B;
border: 1px solid #334155;
padding: 10px 24px;
border-radius: 12px;
font-weight: 600;
```

### 輸入框（Input Fields）

```css
background: #0F172A;
border: 1px solid #334155;
border-radius: 12px;
padding: 12px 16px;
color: #FFFFFF;
focus: border-color: #3B82F6;
```

### 卡片（Cards）

```css
background: rgba(15, 23, 42, 0.5);
border: 1px solid #334155;
border-radius: 24px;
padding: 24px;
backdrop-filter: blur(12px);
```

---

## 🖼️ 應用範例

### 品牌名稱呈現

#### 標準版本
```html
<span style="color: #FF3A3A; font-weight: 900;">Ultra</span>
<span style="color: #4DA3FF; font-weight: 900;">Advisor</span>
```

#### 精簡版本（僅 LOGO）
```
[LOGO 圖示]
```

#### 完整版本（帶標語）
```
UltraAdvisor
專業財務視覺化解決方案
```

### 網址
- 主網址：`ultra-advisor.tw`
- 後台：`admin.ultra-advisor.tw`
- LINE：`@ultraadvisor`

---

## 📱 社群媒體規範

### Facebook / Instagram
- **封面圖尺寸**：1200 x 630 px
- **頭像**：使用 LOGO（正方形裁切）
- **品牌色**：主視覺以藍色為主

### LINE 官方帳號
- **帳號 ID**：`@ultraadvisor`
- **圖文選單**：使用品牌深色背景
- **訊息色調**：專業、友善、不推銷

---

## 📊 檔案資源位置

| 資源 | 檔案位置 |
|------|---------|
| **LOGO PNG** | `public/logo.png` |
| **LOGO Google Drive** | `https://lh3.googleusercontent.com/d/1CEFGRByRM66l-4sMMM78LUBUvAMiAIaJ` |
| **OG 圖片（部落格）** | `public/og-*.png` (6 個分類) |
| **產品截圖** | `public/screenshots/` |

---

## ✅ 檢查清單

在使用品牌元素前，請確認：

- [ ] LOGO 是否保持原始比例？
- [ ] 是否使用正確的品牌色碼？
- [ ] 文字是否使用 Noto Sans TC？
- [ ] 數據是否避免用紅色表示負值？
- [ ] 是否避免使用金融敏感詞彙？
- [ ] 按鈕是否使用標準圓角和陰影？
- [ ] 動畫是否使用 cubic-bezier 緩動？

---

## 📞 聯絡資訊

**品牌識別相關問題**
Email: support@ultra-advisor.tw
LINE: @ultraadvisor

---

**版本歷史**
- v1.0 (2026-02-08): 初版發布
