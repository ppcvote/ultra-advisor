# Sprint 13-15 Deploy Guide

> **這份文件給誰看：** 第一次把 Sprint 13/14/15 從 dev 推上 production 的人。
> 跟著走一次大概 3-5 hr（不含資料 extract / embedding，那兩步背景跑 2-3 hr）。

---

## 目錄

1. [Pipeline overview](#1-pipeline-overview)
2. [前置要求](#2-前置要求)
3. [快速版（one-script）](#3-快速版one-script)
4. [完整版（手動逐步）](#4-完整版手動逐步)
5. [Firebase Console 手動設定（composite indexes）](#5-firebase-console-手動設定composite-indexes)
6. [GitHub Actions secrets](#6-github-actions-secrets)
7. [Deploy 完成後的 smoke tests](#7-deploy-完成後的-smoke-tests)
8. [Troubleshooting](#8-troubleshooting)
9. [Sprint 16 預告](#9-sprint-16-預告)

---

## 1. Pipeline overview

Sprint 13-15 一路堆下來是這樣一套 pipeline：

```
拍照 / 上傳保單
   ↓
Sprint 13: catalog match (33k products)
   ↓
Sprint 14 W1: chunking → embedding → Firestore
   ↓
Sprint 14 W2: RAG agent (multi-turn, citation)
   ↓
Sprint 14 W3: PDF viewer + watermark + LINE relay
   ↓
Sprint 15 W1: monthly crawler (TII) → diff vs versioned schema
   ↓
Sprint 15 W2: admin approve diff → patch products + policies
   ↓
Sprint 15 W3: notify 影響到的客戶（email / LINE）→ 顧問 dashboard
```

每一個 sprint 都有自己的 Firestore collection 跟 Cloud Function、本 deploy guide 把所有需要設定的東西串起來。

### 影響到的 Firestore collections

| Collection | Sprint | 大小估計 |
|---|---|---|
| `products` | 13 | 33k docs |
| `productChunks` | 14 W1 | 180k docs |
| `chatSessions` | 14 W2 | 動態 |
| `policyDocs` | 14 W3 | 22k docs |
| `productVersions` | 15 W1 | 動態（每 diff 一筆） |
| `policyVersions` | 15 W1 | 動態 |
| `pendingDiffs` | 15 W2 | 動態 |
| `clientNotifications` | 15 W3 | 動態 |
| `advisorReviews` | 15 W3 | 動態 |

### 影響到的 Cloud Functions

```
Sprint 13:
  - matchProductFromImage     (callable)
  - getProductDetail          (callable)

Sprint 14:
  - ragQuery                  (callable, RAG agent)
  - generateWatermarkedPDF    (callable, signed URL)
  - lineRelayMessage          (HTTP webhook)

Sprint 15:
  - crawlTII                  (scheduled, monthly)
  - diffProductVersions       (callable, admin)
  - applyApprovedDiff         (callable, admin)
  - notifyAffectedClients     (callable, admin)
```

---

## 2. 前置要求

跑這份 guide 之前先準備：

### 2.1 Firebase project

- Firebase project 已建立、Blaze plan（serverless functions + Storage 需要）
- 區域 `asia-east1`（跟 Ultra Lab 主站一致）
- Authentication 啟用 Email + Google provider
- Firestore 啟用 native mode
- Storage 啟用 default bucket

### 2.2 GCP service account

到 GCP Console → IAM → Service Accounts，建一個 service account：

- 名稱：`financial-planner-deployer`
- Roles：
  - Firebase Admin
  - Cloud Datastore User
  - Storage Admin
  - Cloud Functions Admin
- 下載 JSON key 存在本機（**不要 commit**）

設定環境變數指向它：

```bash
# Linux / macOS
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/key.json

# Windows git-bash
export GOOGLE_APPLICATION_CREDENTIALS=/c/Users/User/secrets/financial-planner-deployer.json
```

### 2.3 環境變數

```bash
# 必要
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json
export GEMINI_API_KEY=AIza...

# 可選（有就會吃，沒有跑 deterministic-only mode）
export OPENAI_API_KEY=sk-...
export RESEND_API_KEY=re_...
export LINE_CHANNEL_ACCESS_TOKEN=...
export LINE_CHANNEL_SECRET=...
```

### 2.4 工具版本

```bash
node --version      # 需要 >= 20.0
python --version    # 需要 >= 3.10
firebase --version  # 需要 >= 13.0
```

如果版本不對：

```bash
# firebase CLI
npm install -g firebase-tools

# Node 用 nvm
nvm install 20
nvm use 20
```

### 2.5 Firebase CLI 登入

```bash
firebase login
firebase use --add   # 選你的 project，alias 設成 default
```

確認登入成功：

```bash
firebase projects:list
```

---

## 3. 快速版（one-script）

如果只想跑一次、不想看細節：

```bash
cd /c/Users/User/financial-planner

# 先 dry-run 看會做什麼
bash scripts/setup-production.sh

# 確定沒問題後真跑
bash scripts/setup-production.sh --commit
```

腳本會依序跑 8 個 step（每個 step 都會印出來）：

```
Step 0/8: Preflight checks
Step 1/8: Extract 22k PDFs           (1-2 hr)
Step 2/8: Build embeddings           (60-90 min, ~NT$50)
Step 3/8: Upload PDFs to Storage     (30 min)
Step 4/8: Upload chunks to Firestore (30 min)
Step 5/8: Ingest catalog (Sprint 13)
Step 6/8: Versioning backfill (Sprint 15 W1)
Step 7/8: Deploy Firestore rules + indexes
Step 8/8: Deploy Cloud Functions
```

### 部分跑

如果 PDF / embedding 已經跑過，可以跳過：

```bash
bash scripts/setup-production.sh --commit \
  --skip-extract \
  --skip-embed
```

可用 flags：

| Flag | 意思 |
|---|---|
| `--commit` | 真寫 Firestore / Storage / Functions（預設 dry-run）|
| `--skip-extract` | 跳過 PDF text extraction |
| `--skip-embed` | 跳過 embeddings build |
| `--skip-upload` | 跳過 PDF + chunks upload |
| `--skip-migrate` | 跳過 catalog ingest + versioning backfill |
| `--skip-deploy` | 跳過 rules / indexes / functions deploy |
| `-h` / `--help` | 看 help |

---

## 4. 完整版（手動逐步）

對自己一個一個跑比較放心、或者要客製某一步的，照這個順序：

### Step 1: Extract PDF text

從 22k 份保單 PDF 抽純文字。耗時 1-2 hr、可 resume。

```bash
cd /c/Users/User/financial-planner
python scripts/extract-pdf-text.py --resume
```

產出：`data/pdf-text/*.txt`

跑完檢查：

```bash
ls data/pdf-text/ | wc -l   # 應該 ≈ 22000
```

### Step 2: Build embeddings

把 PDF text 切 chunks → 算 Gemini embedding。耗時 60-90 min、~NT\$50、可 resume。

```bash
node scripts/build-embeddings.cjs --resume
```

產出：`data/chunks/*.json`（每份 PDF 一個 chunks file）

跑完檢查：

```bash
ls data/chunks/ | wc -l   # 應該 ≈ 22000
node -e "const fs=require('fs'); const f=fs.readdirSync('data/chunks').slice(0,3); for (const x of f) { const j=JSON.parse(fs.readFileSync('data/chunks/'+x)); console.log(x, j.length, 'chunks'); }"
```

### Step 3: Upload PDFs to Firebase Storage

把 22k PDFs 推到 `gs://<project>.appspot.com/policies/`。耗時 30 min。

```bash
# 先 dry-run
node scripts/upload-pdfs-to-storage.cjs --dry-run

# 真跑
node scripts/upload-pdfs-to-storage.cjs --commit
```

跑完檢查（Firebase Console → Storage → `policies/` folder）：

```bash
# 或用 gsutil
gsutil ls "gs://<project>.appspot.com/policies/" | wc -l
```

### Step 4: Upload chunks to Firestore

把 180k chunks 批次寫進 `productChunks` collection。耗時 30 min（batched 500/req）。

```bash
node scripts/upload-chunks-to-firestore.cjs --dry-run
node scripts/upload-chunks-to-firestore.cjs --commit
```

跑完檢查：

```bash
# Firebase Console → Firestore → productChunks → 看 doc count
# 或用 firebase CLI:
firebase firestore:databases:list
```

### Step 5: Ingest Sprint 13 catalog

把 33k 商品 catalog 寫進 `products` collection。

```bash
node scripts/ingest-catalog-to-firestore.cjs --dry-run
node scripts/ingest-catalog-to-firestore.cjs --commit
```

跑完檢查：

```bash
# Firebase Console → Firestore → products
```

### Step 6: Versioning backfill (Sprint 15 W1)

幫 Sprint 13 寫進去的 products + Sprint 14 的 policies 都補一筆初始 version（`v1`）。

```bash
# 先 product
node scripts/migrate-to-versioned-schema.cjs --product-only --dry-run
node scripts/migrate-to-versioned-schema.cjs --product-only --commit

# 再 policy
node scripts/migrate-to-versioned-schema.cjs --policy-only --dry-run
node scripts/migrate-to-versioned-schema.cjs --policy-only --commit
```

跑完檢查：

```bash
# Firebase Console → Firestore → productVersions 應該有 33k docs
# Firebase Console → Firestore → policyVersions 應該有 22k docs
```

### Step 7: Deploy Firestore rules + indexes

```bash
# rules
firebase deploy --only firestore:rules

# indexes (可能要等 5-30 min build)
firebase deploy --only firestore:indexes
```

**注意：** 部分 composite index 需要在 Console 手動建（見 §5），CLI 不會自動建。

### Step 8: Deploy Cloud Functions

```bash
firebase deploy --only functions
```

第一次 deploy 通常需要 5-10 min。

跑完確認：

```bash
firebase functions:list
```

應該看到 Sprint 13-15 全部 functions。

---

## 5. Firebase Console 手動設定（composite indexes）

`firestore.indexes.json` 涵蓋大部分、但有幾個 composite index 因為跨 collection group / 動態欄位需要手動建：

到 **Firebase Console → Firestore → Indexes → Composite → Add Index**：

### Index 1: productChunks 查詢

- Collection: `productChunks`
- Fields:
  - `productId` (Ascending)
  - `chunkIndex` (Ascending)
- Query scope: Collection

### Index 2: pendingDiffs admin 排序

- Collection: `pendingDiffs`
- Fields:
  - `status` (Ascending)
  - `createdAt` (Descending)
- Query scope: Collection

### Index 3: clientNotifications by advisor

- Collection: `clientNotifications`
- Fields:
  - `advisorUid` (Ascending)
  - `sentAt` (Descending)
- Query scope: Collection

### Index 4: productVersions history

- Collection: `productVersions`
- Fields:
  - `productId` (Ascending)
  - `versionNumber` (Descending)
- Query scope: Collection

### Index 5: policyVersions history

- Collection: `policyVersions`
- Fields:
  - `policyId` (Ascending)
  - `versionNumber` (Descending)
- Query scope: Collection

每個 index build 通常 5-30 min（看 collection 大小）。在 console 看到綠勾才是 ready。

---

## 6. GitHub Actions secrets

如果用 GitHub Actions 自動 deploy，到 **Repo → Settings → Secrets and variables → Actions → New repository secret**：

| Secret name | 從哪拿 |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | 整份 service account JSON 內容（Step 2.2 那份） |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `GEMINI_API_KEY` | Google AI Studio |
| `OPENAI_API_KEY` | OpenAI dashboard（可選） |
| `RESEND_API_KEY` | Resend dashboard |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers Console |
| `LINE_CHANNEL_SECRET` | LINE Developers Console |

`.github/workflows/deploy.yml` 範例會吃這幾個（如有）。

---

## 7. Deploy 完成後的 smoke tests

跑完後一條一條打過去確認沒掛：

### 7.1 Auth & login

```
1. 開 https://<project>.web.app/
2. Sign in with Google
3. 進 dashboard 不報錯
```

### 7.2 Sprint 13: 拍照 → catalog match

```
1. 上傳一張保單封面照
2. 應在 5s 內回傳 candidate products
3. 點進去看 detail page 正常
```

### 7.3 Sprint 14 W1: RAG chunks 在 Firestore

```bash
# Firebase Console → Firestore → productChunks 開一筆檢查
# 應看到: { productId, chunkIndex, text, embedding[768], ... }
```

### 7.4 Sprint 14 W2: RAG agent

```
1. 在任一商品 detail page 點「問問看」
2. 問「30 天等待期內有理賠嗎？」
3. 應回引用條款片段 + 來源 PDF 連結
```

### 7.5 Sprint 14 W3: 浮水印 PDF

```
1. 點商品 detail → 「下載條款」
2. 應跳到 viewer、看到自己 email + IP + timestamp 浮水印
3. 不應該能下載原始 PDF (signed URL only)
```

### 7.6 Sprint 15 W1: monthly crawler

```bash
# 手動觸發一次看看（不要等月底）
firebase functions:shell
> crawlTII()
# 應 log 看到 fetched N pages, found M updates
```

### 7.7 Sprint 15 W2: admin approve

```
1. 登入 admin account
2. 進 /admin/pending-diffs
3. 應看到上一步 crawler 抓到的 diff list
4. 點 approve、確認 product/policy 有更新到新 version
```

### 7.8 Sprint 15 W3: client notification

```
1. 上一步 approve 後
2. 進 /admin/notifications
3. 應看到「影響 X 名客戶」、可點 send
4. send 後客戶收到 email + LINE
```

---

## 8. Troubleshooting

### 8.1 `Permission denied` on Firestore writes

→ service account 缺 `Cloud Datastore User` role。回到 GCP IAM 補上。

### 8.2 `Quota exceeded` 在 embedding 階段

→ Gemini API 免費 quota 用完。要嘛等 24h、要嘛開啟 billing。

### 8.3 `INVALID_ARGUMENT: The query requires an index`

→ Firestore 跟你說缺 composite index。錯誤訊息會直接附上一條 Console URL、點進去 Console 直接建。

### 8.4 Cloud Functions deploy 卡在 `Building functions`

→ 通常是 `functions/package.json` 的 deps 跟 Node 版本不合。

```bash
cd functions
npm ci
npm run build
cd ..
firebase deploy --only functions
```

### 8.5 `extract-pdf-text.py` 報 PyMuPDF 錯

```bash
pip install PyMuPDF==1.24.0
```

### 8.6 `build-embeddings.cjs` 卡住、不噴錯

→ 通常是 Gemini API rate limit。腳本有 exponential backoff、等 5 min 通常會自動繼續。
→ 如果一直卡，按 Ctrl+C，跑 `node scripts/build-embeddings.cjs --resume` 從 checkpoint 接。

### 8.7 PDF upload 中斷

```bash
# 重跑 --commit、腳本內建會 skip 已 upload 的
node scripts/upload-pdfs-to-storage.cjs --commit
```

### 8.8 上線後 functions 5xx

```bash
# 看 logs
firebase functions:log --only ragQuery --lines 50

# 通常是環境變數沒設
firebase functions:config:get
firebase functions:config:set gemini.api_key="AIza..." resend.api_key="re_..."
firebase deploy --only functions
```

### 8.9 Storage signed URL 過期

→ Sprint 14 W3 浮水印 PDF signed URL TTL 預設 10 min。客戶開太久會 403。改 `functions/src/pdf/watermark.ts` 的 `expiresIn` 即可。

### 8.10 Admin dashboard 看不到 pendingDiffs

→ 確認登入帳號的 custom claim `admin: true`：

```bash
node -e "
const a = require('firebase-admin');
a.initializeApp();
a.auth().setCustomUserClaims('<UID>', { admin: true })
  .then(() => console.log('done'))
  .catch(console.error);
"
```

---

## 9. Sprint 16 預告

Sprint 15 deploy 後、Sprint 16 主要會碰：

- `ProductCompareView` — 雙商品條款 diff（前端 scaffold，後端 RAG diff 留 Sprint 17）
- `MetricsDashboard` — admin 看 cost / SLA / conversion（先 placeholder，等 cron 跑幾週才有實數）
- `setup-production.sh` 本身（已 ship、就是這份 doc 引用的）

不會做：

- 公司官網 scraper（top 10 商品）
- Churn prediction
- OpenAPI spec

---

**End of guide.** 卡關回頭看 §8，或 ping HQ。
