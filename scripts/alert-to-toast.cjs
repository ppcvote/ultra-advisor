#!/usr/bin/env node
/**
 * 全站 alert() → toast 批次清掃
 *
 * 規則：
 *  - 成功/已..../完成 → toast.success
 *  - 失敗/錯誤/出錯/無法 → toast.error
 *  - 請../缺少../需要.. → toast.warning
 *  - 其他 → toast.info
 *  - 自動加 import { toast } from '相對路徑/utils/toast'
 *
 * 跳過：UltraWarRoom.tsx 第 5117-5829 行（已驗證為死碼）
 *
 * 用法：node scripts/alert-to-toast.cjs
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')

const SKIP_DEAD_RANGES = {
  'src/components/UltraWarRoom.tsx': [[5117, 5829]], // 死的 EditProfileModal/EditClientModal helpers
}

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f)
    const stat = fs.statSync(p)
    if (stat.isDirectory()) walk(p, out)
    else if (/\.(tsx|ts|jsx)$/.test(f)) out.push(p)
  }
  return out
}

function pickToastType(msg) {
  if (/成功|已存|完成|已新增|已儲存|已刪除|已寄|已送|已加入|已連結/.test(msg)) return 'success'
  if (/失敗|錯誤|出錯|無法|不存在|不能|失效/.test(msg)) return 'error'
  if (/請|缺少|尚未|需要|請先|必須/.test(msg)) return 'warning'
  return 'info'
}

function relPathToToast(filePath) {
  const fileDir = path.dirname(filePath)
  const toastPath = path.join(SRC, 'utils', 'toast')
  let rel = path.relative(fileDir, toastPath).replace(/\\/g, '/')
  if (!rel.startsWith('.')) rel = './' + rel
  return rel
}

let totalReplaced = 0
let filesChanged = 0
const skipDeadCount = []

for (const file of walk(SRC)) {
  const relFile = path.relative(ROOT, file).replace(/\\/g, '/')
  let content = fs.readFileSync(file, 'utf-8')
  const skipRanges = SKIP_DEAD_RANGES[relFile] || []
  const lines = content.split('\n')

  let changedHere = 0
  const newLines = lines.map((line, idx) => {
    const lineNo = idx + 1
    const inSkipRange = skipRanges.some(([s, e]) => lineNo >= s && lineNo <= e)
    if (inSkipRange) {
      if (/\balert\s*\(/.test(line)) skipDeadCount.push(`${relFile}:${lineNo}`)
      return line
    }
    const match = line.match(/(\s*)alert\(\s*([`'"][^`'"]*[`'"]|`[^`]*`)\s*\)\s*;?\s*$/)
    if (match) {
      const indent = match[1]
      const messageRaw = match[2]
      // Take the literal string between the quotes for classification
      const inner = messageRaw.replace(/^[`'"]/, '').replace(/[`'"]$/, '')
      const type = pickToastType(inner)
      changedHere += 1
      return `${indent}toast.${type}(${messageRaw});`
    }
    // Multi-line alert() — fallback (alert + ending `;` 上下行)
    const startMatch = line.match(/^(\s*)alert\($/)
    if (startMatch) {
      // 不處理，留給人手修
      return line
    }
    return line
  })

  if (changedHere === 0) continue

  // 確保 import { toast } 存在
  let newContent = newLines.join('\n')
  if (!/from\s+['"][^'"]*utils\/toast['"]/.test(newContent)) {
    const toastImport = `import { toast } from '${relPathToToast(file)}';`
    // 找到「最後一個完整 import 結尾」的安全插入點
    // 支援多行 import：依序匹配每段 import...from '...';
    const importStmtRe = /^import\s+(?:[^;'"]*?from\s+)?['"][^'"]+['"]\s*;?\s*$/gm
    const matches = [...newContent.matchAll(importStmtRe)]
    if (matches.length > 0) {
      const last = matches[matches.length - 1]
      const insertPos = last.index + last[0].length
      newContent = newContent.slice(0, insertPos) + '\n' + toastImport + newContent.slice(insertPos)
    } else {
      newContent = toastImport + '\n' + newContent
    }
  }

  fs.writeFileSync(file, newContent, 'utf-8')
  totalReplaced += changedHere
  filesChanged += 1
  console.log(`  ✓ ${relFile} — ${changedHere} replaced`)
}

console.log(`\n=== 完成 ===`)
console.log(`檔案: ${filesChanged} 個 / alert(): ${totalReplaced} 個`)
console.log(`跳過死碼: ${skipDeadCount.length} 個`)
skipDeadCount.forEach(s => console.log(`  - ${s}`))
