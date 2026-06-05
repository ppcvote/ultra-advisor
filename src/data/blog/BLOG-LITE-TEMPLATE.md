# Ultra Advisor 懶人包文章規範（Lite Format v1）

> 對 2026 的讀者,長篇 blog 已死。
> 本格式專為「30 秒掃完、5 分鐘讀完、可分享、可信任」設計。
> **目標**:成為台灣財務知識的「只看這裡就夠」品牌。

---

## 設計哲學

| 原則 | 規則 |
|------|------|
| **唯一** | 一頁回答一個問題,深度勝過廣度 |
| **清楚** | 一個 screen = 一個重點,絕不混疊 |
| **準確** | 每個數字必須有官方來源,但收摺到文末 |
| **簡單** | 手機 5 滑可讀完核心 |

---

## 文章骨架:5 個 Screen + Footer

```
┌─────────────────────────┐
│  Screen 1  HERO         │  大數字 + 一句話問題
├─────────────────────────┤
│  Screen 2  THE CHART    │  視覺化答案 + 一句結論
├─────────────────────────┤
│  Screen 3  CHOICES      │  3 張對比卡
├─────────────────────────┤
│  Screen 4  IMPACT       │  「如果 A vs 如果 C」對照
├─────────────────────────┤
│  Screen 5  ACTION       │  5 步可執行清單
├─────────────────────────┤
│  Footer  · 來源(折疊)   │  完整官方引用 + 免責
└─────────────────────────┘
```

每個 screen 大約佔滿一個手機畫面(< 700px 高度)。

---

## Screen 1 · Hero(吸住眼球)

**目的**:3 秒內讓讀者知道「這篇在講什麼、為什麼跟我有關」。

**HTML 範本**:
```html
<div class="text-center my-8 py-12 bg-gradient-to-b from-yellow-950/20 to-transparent border-y border-yellow-700/20 -mx-4 px-4">
  <div class="text-yellow-400 text-xs font-bold tracking-widest mb-3">{{ subtitle context, ex: 2027 起,單一胎家庭 }}</div>
  <div class="text-6xl md:text-8xl font-black text-yellow-300 leading-none mb-3">{{ HERO NUMBER }}<span class="text-3xl md:text-4xl text-yellow-500 ml-2">{{ 單位 }}</span></div>
  <div class="text-slate-300 text-lg md:text-xl mb-6">{{ what it represents }}</div>
  <div class="text-yellow-400 text-base md:text-lg font-bold tracking-wide">── {{ question hook }} ──</div>
</div>
```

**規則**:
- Hero number ≥ 6xl 桌面 / 5xl 手機
- 只有 1 個數字,不要兩個並排
- Hook 是「問題」不是「結論」(讓讀者想往下看)

---

## Screen 2 · The Chart(視覺化答案)

**目的**:不用讀字,看圖就懂結論。

**規則**:
- 一張 area chart / 對比柱狀圖 / timeline / sankey
- 圖下方一句話 takeaway
- 字級 ≥ 13px(手機友善)
- 用 gradient fill 強化視覺差
- 加 reference line / baseline 當錨點(例如「私立大學 4 年費用 = 120 萬」)
- viewBox 建議 800x500

**範例**(area chart 模式):
- 用 `<linearGradient>` 在 `<defs>` 裡定義 stop-opacity 漸層
- `<path>` 畫填色區、`<polyline>` 畫線條疊在上面
- 終點放大圓泡(`<circle r="22" opacity="0.25">` + `<circle r="7">`)

---

## Screen 3 · Choices(對比卡)

**目的**:3 個選擇並列,讓讀者選邊。

**HTML 範本**:
```html
<div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-8">
  <!-- Bad/Warning -->
  <div class="bg-slate-900/60 border-2 border-slate-700 rounded-2xl p-5 text-center">
    <div class="text-slate-400 text-xs font-bold tracking-widest mb-2">{{ Label A }}</div>
    <div class="text-4xl font-black text-slate-300 mb-1">{{ Number }} <span class="text-lg text-slate-500">{{ 單位 }}</span></div>
    <div class="text-3xl mb-2">❌</div>
    <div class="text-sm text-slate-400 leading-relaxed">{{ 1-3 lines outcome }}</div>
  </div>
  <!-- Neutral -->
  <div class="bg-blue-950/40 border-2 border-blue-700/50 rounded-2xl p-5 text-center">
    <div class="text-blue-400 text-xs font-bold tracking-widest mb-2">{{ Label B }}</div>
    <div class="text-4xl font-black text-blue-300 mb-1">{{ Number }} <span class="text-lg text-blue-500">{{ 單位 }}</span></div>
    <div class="text-3xl mb-2">🟡</div>
    <div class="text-sm text-slate-400 leading-relaxed">{{ outcome }}</div>
  </div>
  <!-- Good/Recommended (with glow) -->
  <div class="bg-yellow-950/40 border-2 border-yellow-600/60 rounded-2xl p-5 text-center shadow-xl shadow-yellow-900/20">
    <div class="text-yellow-400 text-xs font-bold tracking-widest mb-2">{{ Label C }}</div>
    <div class="text-4xl font-black text-yellow-300 mb-1">{{ Number }} <span class="text-lg text-yellow-500">{{ 單位 }}</span></div>
    <div class="text-3xl mb-2">✅</div>
    <div class="text-sm text-slate-300 leading-relaxed">{{ outcome }}</div>
  </div>
</div>
```

**規則**:
- 永遠 3 張(或 2 張、極少 4 張),不要 5+
- 推薦的那張用金色 + shadow glow
- 數字大小一致,emoji 一致大小
- outcome 不超過 3 行

---

## Screen 4 · Impact(對照表)

**目的**:把抽象比較變成「你會 / 你不會」的具體場景。

**HTML 範本**:
```html
<div class="bg-slate-900/40 border border-slate-700 rounded-2xl overflow-hidden my-8">
  <div class="grid grid-cols-3 bg-slate-800/50 text-center">
    <div class="p-3 text-xs font-bold tracking-widest text-slate-400">情境</div>
    <div class="p-3 text-xs font-bold tracking-widest text-slate-400">選 A</div>
    <div class="p-3 text-xs font-bold tracking-widest text-yellow-400">選 C</div>
  </div>
  <!-- repeat rows -->
  <div class="grid grid-cols-3 border-t border-slate-800">
    <div class="p-3 text-sm text-slate-300">{{ 情境 }}</div>
    <div class="p-3 text-sm text-slate-400 text-center">{{ A 結果 }}</div>
    <div class="p-3 text-sm text-yellow-200 text-center font-bold">{{ C 結果 }}</div>
  </div>
</div>
```

**規則**:
- 4-6 行,不要 10+
- 用具體名詞(動退休金、背學貸),不要抽象詞(壓力大、不安心)
- A 跟 C 對比,中間不放 B(B 不是主角)

---

## Screen 5 · Action(5 步行動清單)

**目的**:看完知道接下來做什麼。

**HTML 範本**:
```html
<div class="bg-slate-900/40 border border-slate-700 rounded-2xl p-6 my-8">
  <div class="text-slate-400 text-xs font-bold tracking-widest mb-4">下個月就能做的 5 件事</div>
  <ol class="space-y-3">
    <li class="flex items-start gap-3">
      <span class="flex-shrink-0 w-7 h-7 bg-yellow-500/20 border border-yellow-500/40 rounded-full text-yellow-300 font-bold text-sm flex items-center justify-center">1</span>
      <div class="flex-1 text-slate-300 text-sm leading-relaxed pt-1">
        <strong class="text-slate-100">{{ 動作 }}</strong>{{ 一句補充 }}
      </div>
    </li>
    <!-- repeat to 5 -->
  </ol>
</div>
```

**規則**:
- 永遠 5 步(不要 7 步、3 步)
- 每步開頭加粗的「動作」名詞,後面一句補充
- 每步 ≤ 25 字
- 行動順序按時間軸,不按重要性

---

## Footer · 折疊式來源 + 免責

**HTML 範本**:
```html
<details class="my-8 group">
  <summary class="cursor-pointer bg-slate-900/40 border border-slate-700 rounded-xl px-5 py-3 text-slate-300 text-sm font-bold hover:bg-slate-800/50 transition list-none">
    📚 資料來源(政府官方 + 統計 + 媒體報導,點開全部) <span class="float-right group-open:rotate-180 transition inline-block">▾</span>
  </summary>
  <div class="bg-slate-900/30 border border-t-0 border-slate-700 rounded-b-xl px-5 py-4 -mt-1">
    <!-- 完整 sources 列表 -->
  </div>
</details>

<p class="text-slate-500 text-xs mt-8 leading-relaxed">
  {{ 一段免責,合規 footer }}
</p>
```

**規則**:
- 資料來源**全部**收進 `<details>`,需要驗證的人才點開
- ❌ 不要在內文撒「根據 XX 報導」打斷流程
- 免責文字維持完整但縮到 xs 字級

---

## 設計規則總表

### 字級

| 元素 | 桌面 | 手機 |
|------|------|------|
| Hero 主數字 | 8xl | 6xl |
| Section 標題 | 2xl | xl |
| 對比卡數字 | 4xl-5xl | 3xl-4xl |
| Body | base | sm |
| Caption / Footer | sm | xs |

### 色彩(情感編碼)

| 用途 | Tailwind |
|------|---------|
| 警示 / 負面 | `slate-400`, `red-400` |
| 中性 | `blue-400`, `blue-300` |
| 目標 / 推薦 | `yellow-300`, `yellow-400` |
| 成功確認 | `emerald-400` |

### 段落

- **絕對禁止**:連續 > 3 行純文字(手機上)
- 每個 screen 之間必須用一個視覺元素隔開(圖、卡、表、列表、callout)
- 段落寫不完就改 bullet

### 字數預算

| 元素 | 目標 |
|------|------|
| 全文(含圖表說明) | 800-1200 字 |
| 純文字段落總和 | < 600 字 |
| 單一段落最長 | 80 字 |
| readTime | ≤ 5 分鐘 |

---

## metadata 規範

- **title**: 主答案 + 3-5 字補充(15-25 字)
- **excerpt**: 一句結論 + 一句訴求(40-60 字)
- **readTime**: **≤ 5**(超過代表還能砍)
- **featured**: 用此格式的文章預設 `true`(品牌示範意義)
- **tags**: 必須包含 `'懶人包'` 標籤(方便篩選)

---

## 第一篇示範

`articles/66-2027-child-subsidy-three-choices.ts` — 2027 成長津貼三選擇

---

## 發文前 Checklist

- [ ] 標題在 25 字以內,且包含一個具體數字
- [ ] Hero screen 有 big number(≥ 6xl 字級)
- [ ] 至少 1 張 SVG 圖(area / bar / timeline / sankey)
- [ ] 3 張對比卡(grid layout、其中一張金色 glow)
- [ ] 對照表(4-6 行,具體名詞)
- [ ] 5 個行動 bullet(時間軸順序)
- [ ] 所有官方來源在 `<details>` 折疊區
- [ ] 任一段落不超過 3 行(手機 viewport)
- [ ] readTime ≤ 5
- [ ] tags 含 `'懶人包'`
- [ ] 合規免責 footer 完整(xs 字級)

---

## 升級紀錄

| 版本 | 日期 | 修改 |
|------|------|------|
| v1 | 2026-06-05 | 初版,以 article 66 為示範定義 5-screen 架構 |
