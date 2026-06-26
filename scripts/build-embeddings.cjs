#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Ultra Advisor — Insurance clause chunking + embedding builder
 * Sprint 14 / Week 2 / Task B2
 *
 * Pipeline:
 *   pdf-text.jsonl  →  chunk per 「條 / 項」  →  Gemini text-embedding-004
 *                  →  embeddings.jsonl (chunk + 768d vector)
 *
 * 鐵則 (Sprint 14 W2 prep):
 *   - 不引入新 npm 依賴 — 用 node:readline / node:fs / 內建 fetch
 *   - GEMINI_API_KEY 從 env，不 hard-code
 *   - 任何「現在時間」runtime callback 內取
 *   - resume / budget hard-stop / dry-run 必備
 *   - 完成後不執行 (Phase 2 才 dry-run sample，由 caller 觸發)
 *
 * Output (per line in embeddings.jsonl):
 *   {
 *     chunkId, productId, pageNum, pageRange, sectionHeader,
 *     articleNo, itemNo, chunkIndex, charCount, text,
 *     citationLabel, embedding: [768 floats]
 *   }
 *
 * Cost estimate:
 *   ~22k pdfs × ~8 chunks/pdf ≈ 176k chunks
 *   × ~800 chars/chunk ÷ 4 ≈ 200 tokens/chunk
 *   × $0.00001 / 1k tokens (text-embedding-004) ≈ $0.35 USD ≈ NT$11
 *   Spec 標示 NT$115 estimate — 這個 budget 包含 retries / overhead，掛 hard-stop 在 $15
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    input: 'c:/Users/User/insurance-db/research-only/pdf-text.jsonl',
    output: 'c:/Users/User/insurance-db/research-only/embeddings.jsonl',
    chunkSize: 800,
    overlap: 150,
    concurrency: 20,
    batchSize: 100,
    limit: null,
    resume: false,
    dryRun: false,
    budgetUsd: 15,
  };

  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    switch (flag) {
      case '--input': args.input = next; i++; break;
      case '--output': args.output = next; i++; break;
      case '--chunk-size': args.chunkSize = parseInt(next, 10); i++; break;
      case '--overlap': args.overlap = parseInt(next, 10); i++; break;
      case '--concurrency': args.concurrency = parseInt(next, 10); i++; break;
      case '--batch-size': args.batchSize = parseInt(next, 10); i++; break;
      case '--limit': args.limit = parseInt(next, 10); i++; break;
      case '--resume': args.resume = true; break;
      case '--dry-run': args.dryRun = true; break;
      case '--budget-usd': args.budgetUsd = parseFloat(next); i++; break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (flag.startsWith('--')) {
          console.error(`Unknown flag: ${flag}`);
          process.exit(1);
        }
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Usage: node scripts/build-embeddings.cjs [options]

  --input <path>     pdf-text.jsonl (default: insurance-db/research-only/pdf-text.jsonl)
  --output <path>    embeddings.jsonl (default: insurance-db/research-only/embeddings.jsonl)
  --chunk-size N     target chars per chunk (default: 800)
  --overlap N        overlap chars between chunks (default: 150)
  --concurrency N    parallel Gemini batch calls (default: 20)
  --batch-size N     chunks per Gemini batch request (default: 100)
  --limit N          only first N products (sample mode)
  --resume           skip productId already in output
  --dry-run          chunk only, no API calls, print stats
  --budget-usd N     hard-stop when accumulated cost > N (default: 15)
`);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATE_FILE = path.join(__dirname, 'embeddings-state.json');
const GEMINI_MODEL = 'text-embedding-004';
const GEMINI_BATCH_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:batchEmbedContents`;

// Pricing (USD per 1k tokens) — text-embedding-004 free tier 1500 RPM,
// paid tier 個位數 USD per 1M tokens；保守用 $0.00001/1k tokens 作為估算。
// 1 character ≈ 0.25 token (CJK heavier, ≈ 1 char = 1 token in worst case)
const USD_PER_1K_TOKENS = 0.00001;
const CHARS_PER_TOKEN_ESTIMATE = 1.0; // 對中文偏保守

const MIN_CHUNK_CHARS = 100;
const MAX_CHUNK_BEFORE_ITEM_SPLIT = 1200;

// 條 / 項 regex
//   「第 14 條」or「第十四條」or「第14條」
//   「第 3 項」or「第三項」or「第3項」
const ARTICLE_REGEX = /第\s*([一二三四五六七八九十百零\d]+)\s*條/g;
const ITEM_REGEX = /第\s*([一二三四五六七八九十百零\d]+)\s*項/g;

// 中文數字轉阿拉伯數字 (1-99 夠用)
const CN_NUM = {
  零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 百: 100,
};

function cnToNumber(s) {
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  // 簡易解析：十 = 10, 十一 = 11, 二十 = 20, 二十一 = 21, 一百零三 = 103
  let total = 0;
  let current = 0;
  for (const ch of s) {
    const v = CN_NUM[ch];
    if (v === undefined) continue;
    if (v === 10) {
      total += (current === 0 ? 1 : current) * 10;
      current = 0;
    } else if (v === 100) {
      total += (current === 0 ? 1 : current) * 100;
      current = 0;
    } else {
      current = v;
    }
  }
  return total + current;
}

// ---------------------------------------------------------------------------
// State (resume support)
// ---------------------------------------------------------------------------

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn(`[state] load failed: ${err.message} — starting fresh`);
  }
  return {
    lastCompletedProductId: null,
    totalChunks: 0,
    totalCostUsd: 0,
    lastError: null,
  };
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.warn(`[state] save failed: ${err.message}`);
  }
}

function scanExistingOutput(outputPath) {
  // 用 productId 集合（resume = skip 已完成的 product）
  const done = new Set();
  if (!fs.existsSync(outputPath)) return done;
  const data = fs.readFileSync(outputPath, 'utf8');
  for (const line of data.split('\n')) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.productId) done.add(obj.productId);
    } catch (_) { /* ignore */ }
  }
  return done;
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

/**
 * pdf-text.jsonl 預期 schema (由 task B1 PDF extract script 寫出):
 * {
 *   productId: 'tii_2801_cancer-rider',
 *   companyNo: '2801',
 *   productCode: 'cancer-rider',
 *   pages: [
 *     { pageNum: 1, text: '...' },
 *     { pageNum: 2, text: '...' },
 *     ...
 *   ],
 *   extractionMethod: 'pdfplumber' | 'gemini-vision',
 *   extractedAt: '2026-06-...',
 * }
 *
 * 目標: 切出每個 chunk 都帶 articleNo / itemNo / pageNum / sectionHeader
 */

/**
 * 把整份 PDF 文字 (含每頁) 攤平成一條時間序、保留每個 offset 對應的 page。
 */
function flattenPages(pages) {
  let fullText = '';
  const pageMap = []; // [{ start, end, pageNum }]
  for (const p of pages) {
    const start = fullText.length;
    const text = (p.text || '').trim();
    if (!text) continue;
    fullText += (fullText.length > 0 ? '\n' : '') + text;
    pageMap.push({ start, end: fullText.length, pageNum: p.pageNum });
  }
  return { fullText, pageMap };
}

function pageNumAt(offset, pageMap) {
  for (const seg of pageMap) {
    if (offset >= seg.start && offset < seg.end) return seg.pageNum;
  }
  return pageMap.length > 0 ? pageMap[pageMap.length - 1].pageNum : 1;
}

function pageRangeFor(start, end, pageMap) {
  const startPage = pageNumAt(start, pageMap);
  const endPage = pageNumAt(Math.max(start, end - 1), pageMap);
  return [startPage, endPage];
}

/**
 * Find all 「第 N 條」 boundaries in fullText.
 * Returns [{ offset, articleNo, raw }]
 */
function findArticleBoundaries(fullText) {
  const matches = [];
  ARTICLE_REGEX.lastIndex = 0;
  let m;
  while ((m = ARTICLE_REGEX.exec(fullText)) !== null) {
    matches.push({
      offset: m.index,
      articleNo: cnToNumber(m[1]),
      raw: m[0],
    });
  }
  return matches;
}

function findItemBoundaries(segmentText, baseOffset) {
  const matches = [];
  ITEM_REGEX.lastIndex = 0;
  let m;
  while ((m = ITEM_REGEX.exec(segmentText)) !== null) {
    matches.push({
      offset: baseOffset + m.index,
      relativeOffset: m.index,
      itemNo: cnToNumber(m[1]),
      raw: m[0],
    });
  }
  return matches;
}

/**
 * 從段落第一行抓 sectionHeader title (條的標題、e.g. 「第 14 條 癌症給付」)
 */
function extractArticleTitle(segmentText) {
  // 取「第 X 條」後面到第一個換行 / 句號 之間
  const head = segmentText.slice(0, 80);
  const lineMatch = head.match(/^第\s*[一二三四五六七八九十百零\d]+\s*條\s*[「『]?([^\n。]{0,30})/);
  if (lineMatch && lineMatch[1]) {
    return lineMatch[1].trim().replace(/[」』]$/, '');
  }
  return '';
}

/**
 * 切一份 PDF 成 chunks. 回傳 array of:
 *   { productId, pageNum, pageRange, sectionHeader, articleNo, itemNo,
 *     chunkIndex, charCount, text, citationLabel }
 * 不含 embedding (後續才 call API)
 */
function chunkProduct(record, chunkSize, overlap) {
  const { productId, pages } = record;
  if (!pages || pages.length === 0) return [];

  const { fullText, pageMap } = flattenPages(pages);
  if (fullText.length < MIN_CHUNK_CHARS) return [];

  const articles = findArticleBoundaries(fullText);

  // 若沒抓到任何「條」邊界 → fallback 用固定 chunkSize 切
  if (articles.length === 0) {
    return chunkByFixedSize(productId, fullText, pageMap, chunkSize, overlap);
  }

  // 依條切大段
  const segments = [];
  for (let i = 0; i < articles.length; i++) {
    const start = articles[i].offset;
    const end = i + 1 < articles.length ? articles[i + 1].offset : fullText.length;
    segments.push({
      start,
      end,
      text: fullText.slice(start, end),
      articleNo: articles[i].articleNo,
    });
  }

  const out = [];
  let globalIdx = 0;

  for (const seg of segments) {
    const title = extractArticleTitle(seg.text);
    const baseSectionHeader = `第 ${seg.articleNo} 條${title ? ' ' + title : ''}`;

    if (seg.text.length <= MAX_CHUNK_BEFORE_ITEM_SPLIT) {
      // 整條當一個 chunk (或多個若超過 chunkSize)
      const sub = sliceWithOverlap(seg.text, chunkSize, overlap);
      for (let i = 0; i < sub.length; i++) {
        const localStart = seg.start + sub[i].relStart;
        const localEnd = seg.start + sub[i].relEnd;
        out.push(makeChunk({
          productId,
          chunkIndex: globalIdx++,
          articleNo: seg.articleNo,
          itemNo: null,
          sectionHeader: baseSectionHeader,
          citationLabel: `第 ${seg.articleNo} 條`,
          text: sub[i].text,
          pageRange: pageRangeFor(localStart, localEnd, pageMap),
        }));
      }
      continue;
    }

    // 條 > 1200 字 → 再切「項」
    const items = findItemBoundaries(seg.text, seg.start);

    if (items.length === 0) {
      // 沒「項」邊界 → fallback 用 chunkSize 切
      const sub = sliceWithOverlap(seg.text, chunkSize, overlap);
      for (let i = 0; i < sub.length; i++) {
        const localStart = seg.start + sub[i].relStart;
        const localEnd = seg.start + sub[i].relEnd;
        out.push(makeChunk({
          productId,
          chunkIndex: globalIdx++,
          articleNo: seg.articleNo,
          itemNo: null,
          sectionHeader: baseSectionHeader,
          citationLabel: `第 ${seg.articleNo} 條`,
          text: sub[i].text,
          pageRange: pageRangeFor(localStart, localEnd, pageMap),
        }));
      }
      continue;
    }

    // 切項
    for (let j = 0; j < items.length; j++) {
      const iStart = items[j].offset;
      const iEnd = j + 1 < items.length ? items[j + 1].offset : seg.end;
      const itemText = fullText.slice(iStart, iEnd);
      const sub = sliceWithOverlap(itemText, chunkSize, overlap);
      for (let i = 0; i < sub.length; i++) {
        const localStart = iStart + sub[i].relStart;
        const localEnd = iStart + sub[i].relEnd;
        out.push(makeChunk({
          productId,
          chunkIndex: globalIdx++,
          articleNo: seg.articleNo,
          itemNo: items[j].itemNo,
          sectionHeader: `${baseSectionHeader} → 第 ${items[j].itemNo} 項`,
          citationLabel: `第 ${seg.articleNo} 條第 ${items[j].itemNo} 項`,
          text: sub[i].text,
          pageRange: pageRangeFor(localStart, localEnd, pageMap),
        }));
      }
    }
  }

  // 後處理: 小 chunk 併入前一 chunk
  return mergeSmallChunks(out);
}

function chunkByFixedSize(productId, fullText, pageMap, chunkSize, overlap) {
  const sub = sliceWithOverlap(fullText, chunkSize, overlap);
  const out = [];
  for (let i = 0; i < sub.length; i++) {
    out.push(makeChunk({
      productId,
      chunkIndex: i,
      articleNo: null,
      itemNo: null,
      sectionHeader: '(unstructured)',
      citationLabel: `第 ${i + 1} 段`,
      text: sub[i].text,
      pageRange: pageRangeFor(sub[i].relStart, sub[i].relEnd, pageMap),
    }));
  }
  return mergeSmallChunks(out);
}

/**
 * 切 text 成 chunks of <= chunkSize chars，每段帶 overlap 字 (從前段尾)
 * 回傳 [{ text, relStart, relEnd }] (relative to input text)
 */
function sliceWithOverlap(text, chunkSize, overlap) {
  if (text.length <= chunkSize) {
    return [{ text, relStart: 0, relEnd: text.length }];
  }
  const out = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const slice = text.slice(start, end);
    out.push({ text: slice, relStart: start, relEnd: end });
    if (end >= text.length) break;
    start = end - overlap;
    if (start <= out[out.length - 1].relStart) start = end; // 防止無窮
  }
  return out;
}

function makeChunk(props) {
  const { productId, chunkIndex, articleNo, itemNo, sectionHeader,
    citationLabel, text, pageRange } = props;
  const articlePart = articleNo != null ? `c${String(articleNo).padStart(3, '0')}` : 'cNA';
  const itemPart = itemNo != null ? `p${itemNo}` : '';
  const idxPart = `i${chunkIndex}`;
  const chunkId = [productId, articlePart, itemPart, idxPart]
    .filter(Boolean).join('_');
  return {
    chunkId,
    productId,
    pageNum: pageRange[0],
    pageRange,
    sectionHeader,
    articleNo,
    itemNo,
    chunkIndex,
    charCount: text.length,
    text,
    citationLabel,
  };
}

function mergeSmallChunks(chunks) {
  if (chunks.length <= 1) return chunks;
  const out = [chunks[0]];
  for (let i = 1; i < chunks.length; i++) {
    const cur = chunks[i];
    if (cur.charCount < MIN_CHUNK_CHARS && out.length > 0) {
      const prev = out[out.length - 1];
      prev.text = prev.text + '\n' + cur.text;
      prev.charCount = prev.text.length;
      prev.pageRange = [prev.pageRange[0], cur.pageRange[1]];
    } else {
      out.push(cur);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Gemini embedding API (batch)
// ---------------------------------------------------------------------------

async function callGeminiBatchEmbed(texts, apiKey, attempt = 0) {
  const url = `${GEMINI_BATCH_URL}?key=${encodeURIComponent(apiKey)}`;
  const body = {
    requests: texts.map((t) => ({
      model: `models/${GEMINI_MODEL}`,
      content: { parts: [{ text: t }] },
      taskType: 'RETRIEVAL_DOCUMENT',
    })),
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 429 || res.status === 503) {
      if (attempt >= 3) {
        throw new Error(`Gemini ${res.status} after 3 retries`);
      }
      const wait = [1000, 4000, 16000][attempt];
      await sleep(wait);
      return callGeminiBatchEmbed(texts, apiKey, attempt + 1);
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Gemini HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }

    const data = await res.json();
    if (!data.embeddings || !Array.isArray(data.embeddings)) {
      throw new Error(`Gemini response missing embeddings: ${JSON.stringify(data).slice(0, 200)}`);
    }
    return data.embeddings.map((e) => e.values);
  } catch (err) {
    if (attempt < 3 && /fetch failed|ETIMEDOUT|ECONNRESET/i.test(String(err.message))) {
      const wait = [1000, 4000, 16000][attempt];
      await sleep(wait);
      return callGeminiBatchEmbed(texts, apiKey, attempt + 1);
    }
    throw err;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Promise pool (concurrency limit)
// ---------------------------------------------------------------------------

async function runPool(tasks, concurrency) {
  const results = new Array(tasks.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= tasks.length) return;
      results[idx] = await tasks[idx]();
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!args.dryRun && !apiKey) {
    console.error('[fatal] GEMINI_API_KEY env not set (or run with --dry-run)');
    process.exit(1);
  }

  if (!fs.existsSync(args.input)) {
    console.error(`[fatal] input not found: ${args.input}`);
    process.exit(1);
  }

  // 確保 output dir 存在
  const outDir = path.dirname(args.output);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const state = loadState();
  const alreadyDone = args.resume ? scanExistingOutput(args.output) : new Set();

  const startedAt = Date.now();
  console.log(`[start] input=${args.input}`);
  console.log(`[start] output=${args.output}`);
  console.log(`[start] chunkSize=${args.chunkSize} overlap=${args.overlap} ` +
              `concurrency=${args.concurrency} batchSize=${args.batchSize} ` +
              `limit=${args.limit || '∞'} resume=${args.resume} dryRun=${args.dryRun} ` +
              `budgetUsd=${args.budgetUsd}`);
  if (alreadyDone.size > 0) {
    console.log(`[resume] skipping ${alreadyDone.size} already-embedded products`);
  }

  const outStream = args.dryRun
    ? null
    : fs.createWriteStream(args.output, { flags: args.resume ? 'a' : 'w' });

  let productCount = 0;
  let chunkCount = state.totalChunks || 0;
  let costUsd = state.totalCostUsd || 0;
  let tokenEstimate = 0;
  let skippedProducts = 0;
  let lastProgressAt = Date.now();

  const rl = readline.createInterface({
    input: fs.createReadStream(args.input, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    let record;
    try {
      record = JSON.parse(line);
    } catch (err) {
      console.warn(`[warn] bad jsonl line: ${err.message}`);
      continue;
    }

    if (!record.productId) {
      console.warn('[warn] record missing productId, skipping');
      continue;
    }

    if (alreadyDone.has(record.productId)) {
      skippedProducts++;
      continue;
    }

    if (args.limit && productCount >= args.limit) break;
    productCount++;

    // 1) Chunk
    const chunks = chunkProduct(record, args.chunkSize, args.overlap);
    if (chunks.length === 0) {
      console.warn(`[warn] ${record.productId}: no chunks produced`);
      continue;
    }

    // 2) Embed (skip in dry-run)
    if (!args.dryRun) {
      // Batch chunks → tasks
      const batches = [];
      for (let i = 0; i < chunks.length; i += args.batchSize) {
        batches.push(chunks.slice(i, i + args.batchSize));
      }

      const tasks = batches.map((batch) => async () => {
        const texts = batch.map((c) => c.text);
        const vectors = await callGeminiBatchEmbed(texts, apiKey);
        if (vectors.length !== batch.length) {
          throw new Error(`embedding count mismatch: got ${vectors.length}, want ${batch.length}`);
        }
        for (let i = 0; i < batch.length; i++) {
          batch[i].embedding = vectors[i];
        }
        return batch;
      });

      try {
        await runPool(tasks, args.concurrency);
      } catch (err) {
        state.lastError = `${record.productId}: ${err.message}`;
        saveState(state);
        console.error(`[fatal] embedding failed for ${record.productId}: ${err.message}`);
        if (outStream) outStream.end();
        process.exit(2);
      }
    }

    // 3) Write to output (dry-run skips write)
    if (outStream) {
      for (const c of chunks) {
        outStream.write(JSON.stringify(c) + '\n');
      }
    }

    // 4) Accounting
    for (const c of chunks) {
      const t = Math.ceil(c.charCount / CHARS_PER_TOKEN_ESTIMATE);
      tokenEstimate += t;
      costUsd += (t / 1000) * USD_PER_1K_TOKENS;
    }
    chunkCount += chunks.length;

    // 5) State checkpoint (every ~100 chunks)
    state.lastCompletedProductId = record.productId;
    state.totalChunks = chunkCount;
    state.totalCostUsd = costUsd;
    if (chunkCount % 100 < chunks.length) {
      saveState(state);
    }

    // 6) Progress log (every 1000 chunks, or every 30s)
    const elapsed = (Date.now() - startedAt) / 1000;
    if (chunkCount % 1000 < chunks.length || Date.now() - lastProgressAt > 30_000) {
      console.log(
        `[progress] products=${productCount} chunks=${chunkCount} ` +
        `tokens≈${tokenEstimate} cost≈$${costUsd.toFixed(4)} ` +
        `elapsed=${elapsed.toFixed(1)}s ` +
        `rate=${(chunkCount / Math.max(elapsed, 1)).toFixed(1)} chunks/s`
      );
      lastProgressAt = Date.now();
    }

    // 7) Budget hard-stop
    if (costUsd > args.budgetUsd) {
      console.error(
        `[STOP] budget exceeded: $${costUsd.toFixed(4)} > $${args.budgetUsd}; ` +
        `processed ${productCount} products / ${chunkCount} chunks`
      );
      state.lastError = `budget exceeded at $${costUsd.toFixed(4)}`;
      saveState(state);
      if (outStream) outStream.end();
      process.exit(3);
    }
  }

  if (outStream) {
    await new Promise((resolve) => outStream.end(resolve));
  }
  saveState(state);

  const elapsed = (Date.now() - startedAt) / 1000;
  console.log('');
  console.log('[done] ============================================================');
  console.log(`[done] products processed: ${productCount}`);
  console.log(`[done] products skipped (resume): ${skippedProducts}`);
  console.log(`[done] chunks emitted: ${chunkCount}`);
  console.log(`[done] tokens estimated: ${tokenEstimate}`);
  console.log(`[done] cost estimated: $${costUsd.toFixed(4)} USD ≈ NT$${(costUsd * 31.5).toFixed(2)}`);
  console.log(`[done] elapsed: ${elapsed.toFixed(1)}s (${(elapsed / 60).toFixed(1)} min)`);
  console.log(`[done] output: ${args.dryRun ? '(dry-run, nothing written)' : args.output}`);
  console.log('[done] ============================================================');
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

if (require.main === module) {
  main().catch((err) => {
    console.error(`[fatal] ${err.stack || err.message}`);
    process.exit(1);
  });
}

module.exports = {
  // exported for unit tests / Phase 2 sample
  parseArgs,
  cnToNumber,
  chunkProduct,
  sliceWithOverlap,
  mergeSmallChunks,
  flattenPages,
  findArticleBoundaries,
  findItemBoundaries,
  extractArticleTitle,
};
