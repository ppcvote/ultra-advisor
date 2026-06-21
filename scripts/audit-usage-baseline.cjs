#!/usr/bin/env node
/**
 * 拉取 UltraAdvisor 使用基準線 — 證實「金句最受歡迎」的猜測 + 抓 tool-usage tracking 啟動前的 baseline
 *
 * 用法：
 *   node scripts/audit-usage-baseline.cjs
 *
 * 需要 admin SDK key 路徑，預設讀 GOOGLE_APPLICATION_CREDENTIALS
 */
const admin = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

const KEY_CANDIDATES = [
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  '/mnt/c/Users/User/Downloads/grbt-f87fa-firebase-adminsdk-fbsvc-74fdc2b010.json',
  'C:/Users/User/Downloads/grbt-f87fa-firebase-adminsdk-fbsvc-74fdc2b010.json',
].filter(Boolean)

let cred = null
let lastErr = null
for (const p of KEY_CANDIDATES) {
  try {
    const path = require('path').resolve(p)
    const sa = require(path)
    cred = admin.cert(sa)
    console.error('Using key:', path)
    break
  } catch (e) { lastErr = e }
}
if (!cred && lastErr) console.error('Last error:', lastErr.message)
if (!cred) {
  console.error('ERROR: no admin SDK key found. Set GOOGLE_APPLICATION_CREDENTIALS')
  process.exit(1)
}

admin.initializeApp({ credential: cred, projectId: 'grbt-f87fa' })
const db = getFirestore()

const fmt = (n) => n.toLocaleString()

;(async () => {
  console.log('=' .repeat(60))
  console.log('UltraAdvisor 使用基準線 — ' + new Date().toISOString().slice(0, 10))
  console.log('='.repeat(60))

  // === 1. Users total ===
  const usersSnap = await db.collection('users').count().get()
  const totalUsers = usersSnap.data().count
  console.log(`\n總用戶數: ${fmt(totalUsers)}`)

  // === 2. dailyStory (金句分享) distribution ===
  console.log('\n--- 金句分享 (dailyStory) ---')
  const dailyStorySnap = await db.collectionGroup('dailyStory').get()
  let usersWithShare = 0
  const totalsBucket = { '0': 0, '1-5': 0, '6-30': 0, '31-90': 0, '91-180': 0, '181+': 0 }
  let topShareDays = 0
  let totalSharedDaysAll = 0
  dailyStorySnap.forEach((d) => {
    const data = d.data()
    const total = Number(data.totalShareDays || 0)
    if (total > 0) usersWithShare++
    totalSharedDaysAll += total
    topShareDays = Math.max(topShareDays, total)
    if (total === 0) totalsBucket['0']++
    else if (total <= 5) totalsBucket['1-5']++
    else if (total <= 30) totalsBucket['6-30']++
    else if (total <= 90) totalsBucket['31-90']++
    else if (total <= 180) totalsBucket['91-180']++
    else totalsBucket['181+']++
  })
  console.log(`  documents: ${fmt(dailyStorySnap.size)}`)
  console.log(`  有分享過的用戶: ${fmt(usersWithShare)} (${((usersWithShare * 100) / totalUsers).toFixed(1)}%)`)
  console.log(`  累計分享總天數: ${fmt(totalSharedDaysAll)}`)
  console.log(`  單一用戶最高 streak: ${topShareDays}`)
  console.log(`  分佈:`)
  for (const [k, v] of Object.entries(totalsBucket)) {
    console.log(`    ${k.padEnd(10)} ${fmt(v).padStart(6)} users`)
  }

  // === 3. clients (顧問 CRM 使用率) ===
  console.log('\n--- 顧問 CRM (clients) ---')
  const clientsSnap = await db.collectionGroup('clients').get()
  const usersWithClients = new Set()
  clientsSnap.forEach((d) => usersWithClients.add(d.ref.parent.parent.id))
  console.log(`  總客戶卡: ${fmt(clientsSnap.size)}`)
  console.log(`  有建立客戶的用戶: ${fmt(usersWithClients.size)} (${((usersWithClients.size * 100) / totalUsers).toFixed(1)}%)`)

  // === 4. Points / activity events (新 toolUse 上線前 baseline) ===
  console.log('\n--- 點數 / 活動事件 ---')
  for (const col of ['pointsTransactions', 'toolUsage', 'events']) {
    try {
      const snap = await db.collection(col).limit(5).get()
      const countSnap = await db.collection(col).count().get()
      console.log(`  ${col}: ${fmt(countSnap.data().count)} docs`)
    } catch (e) {
      console.log(`  ${col}: (collection 不存在或無權限)`)
    }
  }

  // === 5. Tier distribution ===
  console.log('\n--- 會員等級分佈 ---')
  const tierBreakdown = {}
  const usersAll = await db.collection('users').get()
  usersAll.forEach((d) => {
    const tier = d.data().primaryTierId || '(未設)'
    tierBreakdown[tier] = (tierBreakdown[tier] || 0) + 1
  })
  for (const [k, v] of Object.entries(tierBreakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(20)} ${fmt(v).padStart(6)}`)
  }

  // === 6. Top 10 share streak ===
  console.log('\n--- 金句 streak 前 10 名 ---')
  const ranked = []
  dailyStorySnap.forEach((d) => {
    const data = d.data()
    const uid = d.ref.parent.parent.id
    ranked.push({ uid, total: Number(data.totalShareDays || 0), last: data.lastShareDate || '?' })
  })
  ranked.sort((a, b) => b.total - a.total)
  for (const r of ranked.slice(0, 10)) {
    console.log(`  ${r.uid.slice(0, 12).padEnd(14)} streak=${String(r.total).padStart(4)}  last=${r.last}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('結論：保存這份 baseline，明天 toolUse tracking 上線後，比對 tool clicks vs 金句分享次數')
  console.log('='.repeat(60))
  process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
