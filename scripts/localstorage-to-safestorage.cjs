#!/usr/bin/env node
/**
 * 全站 localStorage → safeStorage 批次清掃
 *
 * 為什麼：Safari private mode setItem QuotaExceeded → 整支 app 崩。
 * safeStorage 把 try/catch 包好，失敗回 false / null，不會炸。
 *
 * 規則：
 *  - localStorage.getItem(X)        → safeStorage.get(X)
 *  - localStorage.setItem(X, Y)     → safeStorage.set(X, Y)
 *  - localStorage.removeItem(X)     → safeStorage.remove(X)
 *  - 自動加 import { safeStorage } from '相對路徑/utils/safeStorage'
 *
 * 用法：node scripts/localstorage-to-safestorage.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|jsx)$/.test(f)) out.push(p);
  }
  return out;
}

function relPath(filePath, target) {
  const fileDir = path.dirname(filePath);
  let rel = path.relative(fileDir, target).replace(/\\/g, '/').replace(/\.ts$/, '');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

const SAFE_STORAGE = path.join(SRC, 'utils', 'safeStorage.ts');

let totalReplaced = 0;
let filesChanged = 0;

for (const file of walk(SRC)) {
  if (file === SAFE_STORAGE) continue; // 自己不換自己

  let content = fs.readFileSync(file, 'utf-8');
  const before = content;

  content = content.replace(/\blocalStorage\.getItem\b/g, 'safeStorage.get');
  content = content.replace(/\blocalStorage\.setItem\b/g, 'safeStorage.set');
  content = content.replace(/\blocalStorage\.removeItem\b/g, 'safeStorage.remove');

  if (content === before) continue;

  // 確保 import 存在
  if (!/from\s+['"][^'"]*utils\/safeStorage['"]/.test(content)) {
    const importStmt = `import { safeStorage } from '${relPath(file, SAFE_STORAGE)}';`;
    const importRe = /^import\s+(?:[^;'"]*?from\s+)?['"][^'"]+['"]\s*;?\s*$/gm;
    const matches = [...content.matchAll(importRe)];
    if (matches.length > 0) {
      const last = matches[matches.length - 1];
      const pos = last.index + last[0].length;
      content = content.slice(0, pos) + '\n' + importStmt + content.slice(pos);
    } else {
      content = importStmt + '\n' + content;
    }
  }

  const replaced = (before.match(/\blocalStorage\.(getItem|setItem|removeItem)\b/g) || []).length;
  fs.writeFileSync(file, content, 'utf-8');
  console.log(`  ✓ ${path.relative(ROOT, file).replace(/\\/g, '/')} — ${replaced}`);
  totalReplaced += replaced;
  filesChanged += 1;
}

console.log(`\n=== 完成 ${filesChanged} 檔案 / ${totalReplaced} 處替換 ===`);
