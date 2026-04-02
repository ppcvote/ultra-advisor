// ==========================================
// Ultra Advisor - 完整 Cloud Functions
// LINE Bot + 會員系統 + UA 點數
// ==========================================

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

// ==========================================
// CORS 白名單設定（資安規格書 1.2）
// ==========================================
const ALLOWED_ORIGINS = [
  'https://ultra-advisor.tw',
  'https://www.ultra-advisor.tw',
  'https://admin.ultra-advisor.tw',
  'https://liff.line.me',  // LIFF 應用程式
];

// 開發環境允許 localhost（僅限開發）
if (process.env.FUNCTIONS_EMULATOR) {
  ALLOWED_ORIGINS.push('http://localhost:5173');
  ALLOWED_ORIGINS.push('http://localhost:3000');
}

/**
 * 設置 CORS 標頭（帶白名單驗證）
 */
function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Credentials', 'true');
}

// ==========================================
// 環境變數配置
// ==========================================

const LINE_CHANNEL_SECRET = functions.config().line?.channel_secret;
const LINE_CHANNEL_ACCESS_TOKEN = functions.config().line?.channel_access_token;
const APP_LOGIN_URL = functions.config().app?.login_url || 'https://ultra-advisor.tw';

// ==========================================
// 工具函數
// ==========================================

/**
 * 🔒 驗證是否為管理員（使用 Firestore admins collection）
 * 移除硬編碼郵件，改用資料庫驗證
 * @param {string} uid - 用戶 UID
 * @returns {Promise<boolean>} 是否為管理員
 */
async function isAdmin(uid) {
  if (!uid) return false;
  try {
    const adminDoc = await db.collection('admins').doc(uid).get();
    return adminDoc.exists;
  } catch (error) {
    console.error('Admin verification error:', error);
    return false;
  }
}

/**
 * 🔒 驗證管理員權限（用於 Callable Functions）
 * @param {Object} context - Firebase Functions context
 * @throws {functions.https.HttpsError} 如果驗證失敗
 */
async function verifyAdminAccess(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  const isUserAdmin = await isAdmin(context.auth.uid);
  if (!isUserAdmin) {
    throw new functions.https.HttpsError('permission-denied', '無管理員權限');
  }

  return true;
}

/**
 * 🔒 Rate Limiting - 防止惡意註冊攻擊
 * 同一 IP 每小時最多 5 次註冊嘗試
 */
async function checkRateLimit(ip, action = 'register') {
  const rateLimitRef = db.collection('rateLimits').doc(`${action}_${ip.replace(/[.:/]/g, '_')}`);
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 小時
  const maxAttempts = 5;

  try {
    const doc = await rateLimitRef.get();

    if (doc.exists) {
      const data = doc.data();
      const windowStart = data.windowStart || 0;

      // 如果還在同一個時間窗口內
      if (now - windowStart < windowMs) {
        if (data.attempts >= maxAttempts) {
          return { allowed: false, remaining: 0, resetIn: Math.ceil((windowStart + windowMs - now) / 1000 / 60) };
        }
        // 增加嘗試次數
        await rateLimitRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
        return { allowed: true, remaining: maxAttempts - data.attempts - 1 };
      }
    }

    // 重置或建立新的時間窗口
    await rateLimitRef.set({ windowStart: now, attempts: 1 });
    return { allowed: true, remaining: maxAttempts - 1 };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // 發生錯誤時允許通過，避免阻擋正常用戶
    return { allowed: true, remaining: maxAttempts };
  }
}

/**
 * 🔒 驗證 reCAPTCHA v3 token
 */
async function verifyRecaptcha(token, expectedAction = 'register') {
  if (!token) {
    return { success: false, score: 0, error: '缺少驗證碼' };
  }

  const secretKey = functions.config().recaptcha?.secret_key;
  if (!secretKey) {
    console.warn('reCAPTCHA secret key not configured, skipping verification');
    return { success: true, score: 1 }; // 未設定時跳過驗證
  }

  try {
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: secretKey,
          response: token
        }
      }
    );

    const data = response.data;

    // 驗證 action 和分數
    if (data.success && data.action === expectedAction && data.score >= 0.5) {
      return { success: true, score: data.score };
    }

    console.warn('reCAPTCHA verification failed:', data);
    return { success: false, score: data.score || 0, error: '驗證失敗，請重試' };
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return { success: false, score: 0, error: '驗證服務暫時無法使用' };
  }
}

/**
 * 取得用戶真實 IP
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         'unknown';
}

/**
 * 生成隨機密碼
 */
function generateRandomPassword() {
  const length = 10;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  if (!/[A-Z]/.test(password)) password = 'A' + password.slice(1);
  if (!/[a-z]/.test(password)) password = password.slice(0, -1) + 'a';
  if (!/[0-9]/.test(password)) password = password.slice(0, -1) + '1';
  return password;
}

/**
 * 生成推薦碼
 */
function generateReferralCode(email) {
  const emailPrefix = email?.split('@')[0]?.substring(0, 6) || 'user';
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${emailPrefix}-${randomSuffix}`;
}

/**
 * 驗證 Email 格式
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ==========================================
// 🆕 防刷機制 - 速率限制
// ==========================================

// 記憶體快取（用於快速檢查，重啟後會清除，但 Firestore 有持久記錄）
const rateLimitCache = new Map();

// 清理過期的快取記錄（每 10 分鐘）
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitCache.entries()) {
    if (now - data.lastAttempt > 3600000) { // 1 小時後清除
      rateLimitCache.delete(key);
    }
  }
}, 600000);

/**
 * 🆕 檢查並記錄速率限制（防止同一 LINE 用戶頻繁註冊）
 * @param {string} lineUserId - LINE 用戶 ID
 * @returns {Promise<{allowed: boolean, message: string, waitMinutes: number}>}
 */
async function checkRateLimit(lineUserId) {
  const now = Date.now();
  const COOLDOWN_MINUTES = 30;  // 註冊冷卻時間（分鐘）
  const MAX_ATTEMPTS_PER_DAY = 3;  // 每天最多嘗試次數

  // 先檢查記憶體快取（快速擋掉重複請求）
  const cached = rateLimitCache.get(lineUserId);
  if (cached) {
    const timeSinceLast = now - cached.lastAttempt;
    if (timeSinceLast < COOLDOWN_MINUTES * 60 * 1000) {
      const waitMinutes = Math.ceil((COOLDOWN_MINUTES * 60 * 1000 - timeSinceLast) / 60000);
      return {
        allowed: false,
        message: `⏳ 請等待 ${waitMinutes} 分鐘後再嘗試註冊`,
        waitMinutes
      };
    }
  }

  // 從 Firestore 讀取該用戶的註冊嘗試記錄
  const rateLimitRef = db.collection('rateLimits').doc(lineUserId);
  const rateLimitDoc = await rateLimitRef.get();

  if (rateLimitDoc.exists) {
    const data = rateLimitDoc.data();
    const lastAttempt = data.lastAttempt?.toMillis() || 0;
    const attemptsToday = data.attemptsToday || 0;
    const lastResetDate = data.lastResetDate || '';

    // 檢查是否需要重置每日計數
    const today = new Date().toISOString().slice(0, 10);
    const shouldResetDaily = lastResetDate !== today;

    // 檢查冷卻時間
    const timeSinceLast = now - lastAttempt;
    if (timeSinceLast < COOLDOWN_MINUTES * 60 * 1000) {
      const waitMinutes = Math.ceil((COOLDOWN_MINUTES * 60 * 1000 - timeSinceLast) / 60000);

      // 更新快取
      rateLimitCache.set(lineUserId, { lastAttempt, attemptsToday });

      return {
        allowed: false,
        message: `⏳ 系統冷卻中，請等待 ${waitMinutes} 分鐘後再嘗試`,
        waitMinutes
      };
    }

    // 檢查每日嘗試次數
    const currentAttempts = shouldResetDaily ? 0 : attemptsToday;
    if (currentAttempts >= MAX_ATTEMPTS_PER_DAY) {
      return {
        allowed: false,
        message: `🚫 今日註冊嘗試次數已達上限（${MAX_ATTEMPTS_PER_DAY}次），請明天再試`,
        waitMinutes: -1  // 表示需要等到明天
      };
    }
  }

  return { allowed: true, message: '', waitMinutes: 0 };
}

/**
 * 🆕 記錄註冊嘗試（不管成功失敗都要記錄）
 */
async function recordRegistrationAttempt(lineUserId, success = false, email = null) {
  const now = admin.firestore.Timestamp.now();
  const today = new Date().toISOString().slice(0, 10);

  const rateLimitRef = db.collection('rateLimits').doc(lineUserId);
  const rateLimitDoc = await rateLimitRef.get();

  let attemptsToday = 1;
  let totalAttempts = 1;

  if (rateLimitDoc.exists) {
    const data = rateLimitDoc.data();
    const lastResetDate = data.lastResetDate || '';
    attemptsToday = lastResetDate === today ? (data.attemptsToday || 0) + 1 : 1;
    totalAttempts = (data.totalAttempts || 0) + 1;
  }

  await rateLimitRef.set({
    lineUserId,
    lastAttempt: now,
    lastResetDate: today,
    attemptsToday,
    totalAttempts,
    lastEmail: email,
    lastSuccess: success,
    updatedAt: now
  }, { merge: true });

  // 更新快取
  rateLimitCache.set(lineUserId, {
    lastAttempt: now.toMillis(),
    attemptsToday
  });
}

// ==========================================
// 🆕 UltraCloud 路由函數
// ==========================================
const ULTRACLOUD_WEBHOOK_URL = 'https://ultracloud-delta.vercel.app/api/webhook';

/**
 * 判斷是否應該路由到 UltraCloud
 * - 檔案類型訊息（file, image, video, audio）
 * - 群組/聊天室的檔案訊息
 * - 特定指令（找 xxx、檔案列表、幫助）
 */
function shouldRouteToUltraCloud(event) {
  console.log('=== UltraCloud Route Check ===');
  console.log('event.type:', event.type);

  if (event.type !== 'message') {
    console.log('Not a message event, skip UltraCloud');
    return false;
  }

  const message = event.message;
  const source = event.source;

  console.log('message.type:', message.type);
  console.log('source.type:', source.type);
  console.log('source.groupId:', source.groupId);
  console.log('source.roomId:', source.roomId);

  // 檔案類型訊息 → 轉給 UltraCloud
  if (['file', 'image', 'video', 'audio'].includes(message.type)) {
    console.log('File type detected');
    // 只有群組或聊天室的檔案才轉發（1對1私訊不轉發）
    if (source.type === 'group' || source.type === 'room') {
      console.log('>>> ROUTING TO ULTRACLOUD: file in group/room');
      return true;
    } else {
      console.log('Not in group/room, skip');
    }
  }

  // 文字指令 → 轉給 UltraCloud
  if (message.type === 'text') {
    const text = message.text.trim();
    console.log('Text message:', text);
    // 群組/聊天室中的 UltraCloud 指令
    if (source.type === 'group' || source.type === 'room') {
      if (text.startsWith('找 ') || text.startsWith('找') ||
          text.startsWith('檔案列表') || text === '列表' ||
          text === '幫助' || text === 'help' || text === '?') {
        console.log('>>> ROUTING TO ULTRACLOUD: command in group/room');
        return true;
      }
    }
  }

  console.log('Not routing to UltraCloud');
  return false;
}

/**
 * 轉發事件到 UltraCloud
 * 對於檔案類型，會先下載檔案內容再轉發
 */
async function forwardToUltraCloud(event) {
  try {
    const message = event.message;
    let payload = { events: [event] };

    // 如果是檔案類型，先下載內容
    if (['file', 'image', 'video', 'audio'].includes(message?.type)) {
      console.log('Downloading file content before forwarding...');

      try {
        // 從 LINE 下載檔案
        const response = await axios.get(
          `https://api-data.line.me/v2/bot/message/${message.id}/content`,
          {
            headers: {
              'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
            },
            responseType: 'arraybuffer',
            timeout: 30000
          }
        );

        // 轉成 base64
        const base64Content = Buffer.from(response.data).toString('base64');
        console.log('File downloaded, size:', response.data.length, 'bytes');

        // 加入檔案內容到 payload
        payload.fileContent = base64Content;
        payload.fileSize = response.data.length;
      } catch (downloadError) {
        console.error('Failed to download file:', downloadError.message);
        // 繼續轉發，讓 UltraCloud 處理錯誤
      }
    }

    await axios.post(ULTRACLOUD_WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 55000, // 55 秒 timeout（Vercel 函數最長 60 秒）
      maxContentLength: 50 * 1024 * 1024, // 50MB
      maxBodyLength: 50 * 1024 * 1024
    });
    console.log('Event forwarded to UltraCloud successfully');
  } catch (error) {
    console.error('Failed to forward to UltraCloud:', error.message);
    // 不拋出錯誤，避免影響主流程
  }
}

/**
 * 驗證 LINE Webhook 簽章
 */
function validateSignature(body, signature) {
  if (!LINE_CHANNEL_SECRET) return false;
  const hash = crypto
    .createHmac('sha256', LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

/**
 * 發送 LINE 訊息
 */
async function sendLineMessage(userId, messages) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    console.log('LINE token not configured, skipping message');
    return;
  }
  try {
    await axios.post(
      'https://api.line.me/v2/bot/message/push',
      { to: userId, messages: messages },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
        }
      }
    );
  } catch (error) {
    console.error('LINE message send error:', error.response?.data || error.message);
    throw error;
  }
}

// ==========================================
// 🆕 LINE Bot 內容載入（從 Firestore）
// ==========================================

// 快取 LINE Bot 內容（避免每次都讀 Firestore）
let lineBotContentCache = {
  welcome: null,
  keywords: null,
  notifications: null,
  lastFetch: 0
};
const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘快取

/**
 * 載入 LINE Bot 歡迎訊息設定
 */
async function getWelcomeMessages() {
  const now = Date.now();
  if (lineBotContentCache.welcome && (now - lineBotContentCache.lastFetch) < CACHE_TTL) {
    return lineBotContentCache.welcome;
  }

  try {
    const doc = await db.collection('lineBotContent').doc('welcome').get();
    if (doc.exists) {
      lineBotContentCache.welcome = doc.data();
      lineBotContentCache.lastFetch = now;
      return lineBotContentCache.welcome;
    }
  } catch (err) {
    console.error('Failed to load welcome messages:', err);
  }

  // 預設值
  return {
    newFollower: '🎉 歡迎加入 Ultra Advisor！\n\n我是你的專屬 AI 財務軍師\n━━━━━━━━━━━━━━\n\n💎 立即獲得 7 天免費試用\n✓ 18 種專業理財工具\n✓ 無限客戶檔案\n✓ AI 智能建議\n\n🎁 推薦好友：完成註冊 +100 UA，付費後雙方各得 1000 UA！\n\n━━━━━━━━━━━━━━\n\n📧 請直接傳送你的 Email 開始試用！',
    newFollowerEnabled: true,
    memberLinked: '🎉 綁定成功！\n\n{{name}} 您好，您的帳號已成功綁定。\n\n現在您可以透過 LINE 接收：\n✅ 會員到期提醒\n✅ 最新功能通知\n✅ 專屬優惠資訊',
    memberLinkedEnabled: true
  };
}

/**
 * 載入關鍵字回覆設定
 */
async function getKeywordReplies() {
  const now = Date.now();
  if (lineBotContentCache.keywords && (now - lineBotContentCache.lastFetch) < CACHE_TTL) {
    return lineBotContentCache.keywords;
  }

  try {
    const doc = await db.collection('lineBotContent').doc('keywords').get();
    if (doc.exists) {
      lineBotContentCache.keywords = doc.data().items || [];
      lineBotContentCache.lastFetch = now;
      return lineBotContentCache.keywords;
    }
  } catch (err) {
    console.error('Failed to load keyword replies:', err);
  }

  return [];
}

/**
 * 載入系統通知設定
 */
async function getNotificationSettings() {
  const now = Date.now();
  if (lineBotContentCache.notifications && (now - lineBotContentCache.lastFetch) < CACHE_TTL) {
    return lineBotContentCache.notifications;
  }

  try {
    const doc = await db.collection('lineBotContent').doc('notifications').get();
    if (doc.exists) {
      lineBotContentCache.notifications = doc.data();
      lineBotContentCache.lastFetch = now;
      return lineBotContentCache.notifications;
    }
  } catch (err) {
    console.error('Failed to load notification settings:', err);
  }

  // 預設值
  return {
    expiryReminder7Days: '⏰ 會員即將到期提醒\n\n{{name}} 您好，\n您的會員資格將在 7 天後到期。\n\n立即續費可享優惠價格！\n👉 https://ultra-advisor.tw/pricing',
    expiryReminder7DaysEnabled: true,
    expiryReminder1Day: '🚨 會員明天到期！\n\n{{name}} 您好，\n您的會員資格將在明天到期。\n\n到期後將無法使用進階工具，請盡快續費！\n👉 https://ultra-advisor.tw/pricing',
    expiryReminder1DayEnabled: true,
    paymentSuccess: '🎉 付款成功！\n\n{{name}} 您好，\n感謝您的支持！您的會員資格已延長。\n\n新到期日：{{expiryDate}}\n\n祝您使用愉快！',
    paymentSuccessEnabled: true
  };
}

/**
 * 替換訊息變數
 */
function replaceMessageVariables(message, variables = {}) {
  if (!message) return '';
  let result = message;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result;
}

/**
 * 檢查關鍵字是否匹配
 */
function matchKeyword(userMessage, keywords, matchType) {
  const msg = userMessage.toLowerCase();
  return keywords.some(keyword => {
    const kw = keyword.toLowerCase();
    switch (matchType) {
      case 'exact':
        return msg === kw;
      case 'startsWith':
        return msg.startsWith(kw);
      case 'contains':
      default:
        return msg.includes(kw);
    }
  });
}

// ==========================================
// 🆕 UA 點數系統 - 工具函數
// ==========================================

/**
 * 取得用戶的點數倍率
 */
async function getUserMultiplier(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return 1.0;
    
    const userData = userDoc.data();
    const primaryTierId = userData.primaryTierId || 'trial';
    
    const tiersSnapshot = await db.collection('membershipTiers')
      .where('slug', '==', primaryTierId)
      .limit(1)
      .get();
    
    if (tiersSnapshot.empty) return 1.0;
    return tiersSnapshot.docs[0].data().pointsMultiplier || 1.0;
  } catch (error) {
    console.error('Error getting user multiplier:', error);
    return 1.0;
  }
}

/**
 * 取得點數規則
 */
async function getPointsRule(actionId) {
  try {
    const rulesSnapshot = await db.collection('pointsRules')
      .where('actionId', '==', actionId)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (rulesSnapshot.empty) return null;
    return { id: rulesSnapshot.docs[0].id, ...rulesSnapshot.docs[0].data() };
  } catch (error) {
    console.error('Error getting points rule:', error);
    return null;
  }
}

/**
 * 檢查每日限制
 */
async function checkDailyLimit(userId, actionId, dailyMax) {
  if (!dailyMax) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const snapshot = await db.collection('pointsLedger')
    .where('userId', '==', userId)
    .where('actionId', '==', actionId)
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
    .get();
  
  return snapshot.size >= dailyMax;
}

/**
 * 檢查每週限制
 */
async function checkWeeklyLimit(userId, actionId, weeklyMax) {
  if (!weeklyMax) return false;
  
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  const snapshot = await db.collection('pointsLedger')
    .where('userId', '==', userId)
    .where('actionId', '==', actionId)
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(weekStart))
    .get();
  
  return snapshot.size >= weeklyMax;
}

/**
 * 檢查總計限制
 */
async function checkTotalLimit(userId, actionId, totalMax) {
  if (!totalMax) return false;
  
  const snapshot = await db.collection('pointsLedger')
    .where('userId', '==', userId)
    .where('actionId', '==', actionId)
    .get();
  
  return snapshot.size >= totalMax;
}

/**
 * 發放點數（核心函數）
 */
async function awardPoints(userId, actionId, reason, referenceId = null) {
  try {
    const rule = await getPointsRule(actionId);
    if (!rule) {
      console.log(`Rule not found or inactive: ${actionId}`);
      return { success: false, reason: 'rule_not_found' };
    }
    
    const limits = rule.limits || {};
    
    if (limits.dailyMax && await checkDailyLimit(userId, actionId, limits.dailyMax)) {
      return { success: false, reason: 'daily_limit_reached' };
    }
    
    if (limits.weeklyMax && await checkWeeklyLimit(userId, actionId, limits.weeklyMax)) {
      return { success: false, reason: 'weekly_limit_reached' };
    }
    
    if (limits.totalMax && await checkTotalLimit(userId, actionId, limits.totalMax)) {
      return { success: false, reason: 'total_limit_reached' };
    }
    
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return { success: false, reason: 'user_not_found' };
    }
    
    const userData = userDoc.data();
    
    // 檢查身分組是否可獲得點數
    const tiersSnapshot = await db.collection('membershipTiers')
      .where('slug', '==', userData.primaryTierId || 'trial')
      .limit(1)
      .get();
    
    if (!tiersSnapshot.empty) {
      const tierData = tiersSnapshot.docs[0].data();
      if (!tierData.permissions?.canEarnPoints) {
        return { success: false, reason: 'tier_cannot_earn_points' };
      }
    }
    
    const multiplier = await getUserMultiplier(userId);
    const basePoints = rule.basePoints;
    const finalPoints = Math.floor(basePoints * multiplier);
    
    const currentPoints = typeof userData.points === 'object' ? (userData.points?.current || 0) : (userData.points || 0);
    const newBalance = currentPoints + finalPoints;
    
    // 12 個月後過期
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 12);
    
    await db.runTransaction(async (transaction) => {
      const ledgerRef = db.collection('pointsLedger').doc();
      transaction.set(ledgerRef, {
        userId,
        userEmail: userData.email,
        type: 'earn',
        amount: finalPoints,
        balanceBefore: currentPoints,
        balanceAfter: newBalance,
        actionId,
        reason: reason || rule.name,
        referenceType: 'rule',
        referenceId: referenceId || rule.id,
        multiplierApplied: multiplier,
        baseAmount: basePoints,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        isExpired: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'system',
      });
      
      transaction.update(userRef, {
        'points.current': newBalance,
        totalPointsEarned: admin.firestore.FieldValue.increment(finalPoints),
        lastPointsEarnedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    
    console.log(`Awarded ${finalPoints} points to ${userId} for ${actionId}`);
    
    return { success: true, points: finalPoints, multiplier, newBalance };
    
  } catch (error) {
    console.error('Error awarding points:', error);
    return { success: false, reason: 'error', error: error.message };
  }
}

// ==========================================
// LINE Bot - 核心功能
// ==========================================

/**
 * 創建試用帳號（支援推薦碼）
 * @param {string} email - 用戶 Email
 * @param {string} lineUserId - LINE 用戶 ID
 * @param {string|null} inputReferralCode - 輸入的推薦碼（可選）
 */
async function createTrialAccount(email, lineUserId, inputReferralCode = null) {
  try {
    // 🆕 載入動態訊息設定
    const welcomeMessages = await getWelcomeMessages();

    const existingUsers = await auth.getUserByEmail(email).catch(() => null);
    if (existingUsers) {
      throw new Error('此 Email 已經註冊');
    }

    const password = generateRandomPassword();
    const newReferralCode = generateReferralCode(email);

    const userRecord = await auth.createUser({
      email: email,
      password: password,
      emailVerified: false,
      disabled: false
    });

    const now = admin.firestore.Timestamp.now();

    // 🆕 決定身分組（根據是否有推薦碼）
    let tierId = 'trial';
    let referredByUid = null;
    let referrerName = null;

    if (inputReferralCode) {
      const codeDoc = await db.collection('referralCodes').doc(inputReferralCode.toUpperCase()).get();
      if (codeDoc.exists && codeDoc.data().isActive) {
        tierId = 'referral_trial';
        referredByUid = codeDoc.data().ownerId;

        // 取得推薦人名稱
        const referrerDoc = await db.collection('users').doc(referredByUid).get();
        if (referrerDoc.exists) {
          const referrerData = referrerDoc.data();
          referrerName = referrerData.displayName || referrerData.email?.split('@')[0] || '會員';
        }

        // 更新推薦碼使用次數
        await codeDoc.ref.update({
          usageCount: admin.firestore.FieldValue.increment(1),
          updatedAt: now,
        });

        // 更新推薦人的 referralCount
        await db.collection('users').doc(referredByUid).update({
          referralCount: admin.firestore.FieldValue.increment(1),
        });

        // 🆕 推薦好友完成註冊，推薦人獲得 +100 UA
        try {
          await awardPointsSimple(referredByUid, 100, `推薦好友 ${email.split('@')[0]} 完成註冊`);
          console.log(`Referral registration reward: +100 UA to ${referredByUid}`);
        } catch (err) {
          console.error('Referral registration reward error:', err);
        }
      }
    }

    // 🆕 天數制：新用戶有 7 天試用
    await db.collection('users').doc(userRecord.uid).set({
      email: email,
      createdAt: now,
      updatedAt: now,
      lineUserId: lineUserId,
      isActive: true,
      clients: [],
      stats: { trialsCompleted: 0, hoursSaved: 0 },
      // 🆕 天數制會員系統
      primaryTierId: tierId,
      daysRemaining: 7,  // 試用 7 天
      lastDayDeducted: null,
      graceDaysRemaining: 0,
      // 🆕 UA 點數
      points: { current: 0 },
      totalPointsEarned: 0,
      totalPointsSpent: 0,
      totalPointsExpired: 0,
      // 🆕 推薦系統
      referralCode: newReferralCode,
      referredBy: referredByUid,  // 誰推薦我的
      referralCount: 0,
      referralRewardClaimed: false,  // 付款後才發放獎勵
      // 🆕 追蹤
      toolUsageCount: 0,
      loginStreak: 0,
    });

    // 🆕 建立推薦碼索引
    await db.collection('referralCodes').doc(newReferralCode).set({
      code: newReferralCode,
      ownerId: userRecord.uid,
      ownerEmail: email,
      usageCount: 0,
      successCount: 0,
      totalPointsGenerated: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const loginUrl = APP_LOGIN_URL;

    // 🆕 根據身分組顯示不同訊息
    const tierText = tierId === 'referral_trial' ? '轉介紹試用' : '試用會員';
    const discountNote = tierId === 'referral_trial'
      ? `\n\n🎁 轉介紹優惠：購買時使用折扣碼「Miiroll7」可折 $999！`
      : '';
    const referrerNote = referrerName
      ? `\n👥 推薦人：${referrerName}`
      : '';

    // 🆕 使用後台設定的標題
    const accountCreatedTitle = welcomeMessages.accountCreatedTitle || '🎉 帳號開通成功';

    // 🆕 使用後台設定的密碼訊息
    let passwordMessageText = welcomeMessages.passwordMessageEnabled && welcomeMessages.passwordMessage
      ? replaceMessageVariables(welcomeMessages.passwordMessage, {
          password: password,
          referralCode: newReferralCode,
          referrerName: referrerName || '',
        })
      : `🔐 你的登入密碼（請妥善保管）：\n\n${password}\n\n⚠️ 請立即登入並修改密碼以確保安全\n\n📢 分享你的推薦碼「${newReferralCode}」給朋友！\n註冊成功 +100 UA，付費後雙方各得 1000 UA！`;

    // 加上推薦人和折扣資訊（如果後台訊息沒有包含的話）
    if (!passwordMessageText.includes(referrerNote) && referrerNote) {
      passwordMessageText += referrerNote;
    }
    if (!passwordMessageText.includes('折扣碼') && discountNote) {
      passwordMessageText += discountNote;
    }

    await sendLineMessage(lineUserId, [
      {
        type: 'flex',
        altText: accountCreatedTitle,
        contents: {
          type: 'bubble',
          hero: {
            type: 'box',
            layout: 'vertical',
            contents: [{ type: 'text', text: accountCreatedTitle, size: 'xl', weight: 'bold', color: '#ffffff' }],
            backgroundColor: tierId === 'referral_trial' ? '#8b5cf6' : '#3b82f6',
            paddingAll: '20px'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: '登入資訊', weight: 'bold', size: 'md', margin: 'md' },
              {
                type: 'box',
                layout: 'vertical',
                margin: 'lg',
                spacing: 'sm',
                contents: [
                  { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
                    { type: 'text', text: 'Email', color: '#64748b', size: 'sm', flex: 2 },
                    { type: 'text', text: email, wrap: true, color: '#1e293b', size: 'sm', flex: 5 }
                  ]},
                  { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
                    { type: 'text', text: '身分', color: '#64748b', size: 'sm', flex: 2 },
                    { type: 'text', text: tierText, wrap: true, color: tierId === 'referral_trial' ? '#8b5cf6' : '#3b82f6', size: 'sm', flex: 5, weight: 'bold' }
                  ]},
                  { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
                    { type: 'text', text: '試用期', color: '#64748b', size: 'sm', flex: 2 },
                    { type: 'text', text: '7 天', wrap: true, color: '#1e293b', size: 'sm', flex: 5 }
                  ]},
                  { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
                    { type: 'text', text: '推薦碼', color: '#64748b', size: 'sm', flex: 2 },
                    { type: 'text', text: newReferralCode, wrap: true, color: '#f59e0b', size: 'sm', flex: 5, weight: 'bold' }
                  ]}
                ]
              }
            ]
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: [
              { type: 'button', style: 'primary', height: 'sm', action: { type: 'uri', label: '立即登入', uri: loginUrl }, color: tierId === 'referral_trial' ? '#8b5cf6' : '#3b82f6' },
              { type: 'box', layout: 'baseline', contents: [
                { type: 'text', text: '⚠️ 密碼將在下一則訊息單獨傳送', color: '#64748b', size: 'xs', wrap: true }
              ], margin: 'md' }
            ]
          }
        }
      },
      {
        type: 'text',
        text: passwordMessageText
      }
    ]);

    console.log(`Trial account created: ${email}, tier: ${tierId}, referredBy: ${referredByUid || 'none'}`);
    return { success: true, uid: userRecord.uid, email: email, tierId };

  } catch (error) {
    console.error('Create trial account error:', error);
    throw error;
  }
}

// ==========================================
// LINE Webhook
// ==========================================

exports.lineWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const signature = req.headers['x-line-signature'];
  const body = JSON.stringify(req.body);
  
  if (!validateSignature(body, signature)) {
    console.error('Invalid signature');
    return res.status(401).send('Invalid signature');
  }

  const events = req.body.events;

  try {
    await Promise.all(events.map(handleEvent));
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 🆕 用戶狀態暫存（簡易實作，生產環境建議用 Firestore）
const userStates = new Map();

async function handleEvent(event) {
  const lineUserId = event.source.userId;

  // ==========================================
  // 🆕 UltraCloud 路由 - 檔案同步功能
  // ==========================================
  if (shouldRouteToUltraCloud(event)) {
    await forwardToUltraCloud(event);
    return;
  }

  // 🆕 載入動態內容
  const welcomeMessages = await getWelcomeMessages();
  const keywordReplies = await getKeywordReplies();

  if (event.type === 'follow') {
    // 清除舊狀態
    userStates.delete(lineUserId);

    // 🆕 LIFF 註冊按鈕（優先使用 Flex Message）
    // LIFF ID 需要從環境變數或設定中取得
    const LIFF_ID = functions.config().liff?.register_id || '2008863334-CiKr6VBU';
    const liffRegisterUrl = `https://liff.line.me/${LIFF_ID}`;

    // 發送帶有 LIFF 按鈕的 Flex Message
    await sendLineMessage(lineUserId, [
      {
        type: 'flex',
        altText: '🎉 歡迎加入 Ultra Advisor！點擊開通試用',
        contents: {
          type: 'bubble',
          hero: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: '歡迎加入 Ultra Advisor', weight: 'bold', size: 'xl', color: '#ffffff' },
              { type: 'text', text: '財務顧問的秘密武器', size: 'sm', color: '#ffffffcc', margin: 'sm' }
            ],
            backgroundColor: '#2E6BFF',
            paddingAll: '24px',
            paddingTop: '32px',
            paddingBottom: '32px'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '🎁 7 天免費試用包含：',
                weight: 'bold',
                size: 'md',
                margin: 'md'
              },
              {
                type: 'box',
                layout: 'vertical',
                margin: 'lg',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: '✓ 全部 18 種專業理財工具', size: 'sm', color: '#555555' },
                  { type: 'text', text: '✓ 無限客戶檔案', size: 'sm', color: '#555555' },
                  { type: 'text', text: '✓ 報表匯出功能', size: 'sm', color: '#555555' }
                ]
              },
              {
                type: 'separator',
                margin: 'xl'
              },
              {
                type: 'text',
                text: '🎁 推薦好友：註冊 +100，付費 +1000 UA！',
                size: 'xs',
                color: '#f59e0b',
                margin: 'lg',
                weight: 'bold'
              }
            ],
            paddingAll: '20px'
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: [
              {
                type: 'button',
                style: 'primary',
                height: 'md',
                action: {
                  type: 'uri',
                  label: '🚀 立即開通試用',
                  uri: liffRegisterUrl
                },
                color: '#2E6BFF'
              },
              {
                type: 'button',
                style: 'link',
                height: 'sm',
                action: {
                  type: 'uri',
                  label: '已有帳號？直接登入',
                  uri: 'https://ultra-advisor.tw/login'
                }
              }
            ],
            paddingAll: '16px'
          }
        }
      }
    ]);
    return;
  }

  if (event.type === 'message' && event.message.type === 'text') {
    const userMessage = event.message.text.trim();
    const state = userStates.get(lineUserId) || { step: 'IDLE' };

    // 🆕 狀態機處理
    switch (state.step) {
      case 'WAIT_REFERRAL':
        // 用戶回覆推薦碼或「無」
        await handleReferralInput(lineUserId, userMessage, state);
        break;

      default:
        // 🆕 先檢查關鍵字回覆
        const matchedKeyword = keywordReplies.find(kw =>
          kw.enabled && kw.keywords?.length && matchKeyword(userMessage, kw.keywords, kw.matchType)
        );

        if (matchedKeyword) {
          await sendLineMessage(lineUserId, [
            { type: 'text', text: matchedKeyword.reply }
          ]);
          return;
        }

        // IDLE 狀態：等待 Email
        if (isValidEmail(userMessage)) {
          // 儲存 Email，詢問推薦碼
          userStates.set(lineUserId, { step: 'WAIT_REFERRAL', email: userMessage });

          // 🆕 使用後台設定的「收到 Email」訊息
          const emailReceivedMsg = welcomeMessages.emailReceivedEnabled && welcomeMessages.emailReceived
            ? welcomeMessages.emailReceived.replace('{{email}}', userMessage)
            : `✅ Email 確認：${userMessage}\n\n請問有朋友的推薦碼嗎？\n\n有的話請輸入推薦碼，沒有請輸入「無」`;

          await sendLineMessage(lineUserId, [
            { type: 'text', text: emailReceivedMsg + `\n\n📧 Email: ${userMessage}\n\n🎟️ 請問有朋友的推薦碼嗎？\n有的話請輸入，沒有請輸入「無」` }
          ]);
        } else {
          await sendLineMessage(lineUserId, [
            { type: 'text', text: '📧 請傳送你的 Email 來開始試用！\n\n範例：your@email.com' }
          ]);
        }
        break;
    }
  }
}

/**
 * 處理推薦碼輸入
 */
async function handleReferralInput(lineUserId, userMessage, state) {
  const email = state.email;
  let referralCode = null;

  // 🆕 防刷機制：檢查速率限制
  const rateCheck = await checkRateLimit(lineUserId);
  if (!rateCheck.allowed) {
    userStates.delete(lineUserId);
    await sendLineMessage(lineUserId, [
      { type: 'text', text: rateCheck.message }
    ]);
    return;
  }

  if (userMessage.toLowerCase() !== '無' && userMessage.toLowerCase() !== 'no' && userMessage.toLowerCase() !== 'none') {
    // 驗證推薦碼
    const codeDoc = await db.collection('referralCodes').doc(userMessage.toUpperCase()).get();

    if (codeDoc.exists && codeDoc.data().isActive) {
      referralCode = userMessage.toUpperCase();
      await sendLineMessage(lineUserId, [
        { type: 'text', text: `✅ 推薦碼有效！正在為你開通帳號...\n\n🎁 恭喜獲得轉介紹優惠：購買時可折 $999！` }
      ]);
    } else {
      await sendLineMessage(lineUserId, [
        { type: 'text', text: '❌ 推薦碼無效，將以一般試用身分註冊...' }
      ]);
    }
  } else {
    await sendLineMessage(lineUserId, [
      { type: 'text', text: '⏳ 正在為你開通帳號，請稍候...' }
    ]);
  }

  // 清除狀態
  userStates.delete(lineUserId);

  // 創建帳號
  try {
    await createTrialAccount(email, lineUserId, referralCode);
    // 🆕 只有成功註冊才計入冷卻時間（防止同一人用不同 Email 大量刷帳號）
    await recordRegistrationAttempt(lineUserId, true, email);
  } catch (error) {
    console.error('Account creation error:', error);

    // 🆕 失敗不計入冷卻（不管是 Email 重複還是系統錯誤，都不應懲罰用戶）
    let errorMessage = '❌ 帳號開通失敗，請稍後再試';
    if (error.message.includes('已經註冊')) {
      errorMessage = '⚠️ 此 Email 已經註冊過囉！\n\n👉 請直接用這個 Email 登入系統\n👉 或使用其他 Email 重新註冊\n\n如需協助請聯繫客服';
    }
    await sendLineMessage(lineUserId, [{ type: 'text', text: errorMessage }]);
  }
}

// ==========================================
// 🆕 UA 點數系統 - Cloud Functions
// ==========================================

/**
 * 每日登入獎勵
 */
exports.onDailyLogin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }
  
  const userId = context.auth.uid;
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', '用戶不存在');
  }
  
  const userData = userDoc.data();
  const lastLogin = userData.lastLoginAt?.toDate();
  const now = new Date();
  
  let newStreak = 1;
  if (lastLogin) {
    const lastLoginDate = new Date(lastLogin);
    lastLoginDate.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - lastLoginDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      newStreak = (userData.loginStreak || 0) + 1;
    } else if (diffDays === 0) {
      newStreak = userData.loginStreak || 1;
    }
  }
  
  await userRef.update({
    lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    loginStreak: newStreak,
  });
  
  const dailyResult = await awardPoints(userId, 'daily_login', '每日登入獎勵');
  
  let streakResult = null;
  if (newStreak === 7) {
    streakResult = await awardPoints(userId, 'login_streak_7', '連續登入 7 天獎勵');
  } else if (newStreak === 30) {
    streakResult = await awardPoints(userId, 'login_streak_30', '連續登入 30 天獎勵');
  }
  
  return { success: true, loginStreak: newStreak, dailyReward: dailyResult, streakReward: streakResult };
});

/**
 * 工具使用獎勵
 */
exports.onToolUse = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }
  
  const userId = context.auth.uid;
  const { toolName } = data;
  
  await db.collection('users').doc(userId).update({
    toolUsageCount: admin.firestore.FieldValue.increment(1),
  });
  
  return await awardPoints(userId, 'tool_use', `使用工具: ${toolName || '未知工具'}`);
});

/**
 * 建立首位客戶獎勵
 */
exports.onFirstClient = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }
  return await awardPoints(context.auth.uid, 'first_client', '建立首位客戶獎勵');
});

/**
 * 推薦獎勵處理（雙向）
 */
exports.processReferral = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }
  
  const { referralCode } = data;
  const newUserId = context.auth.uid;
  
  if (!referralCode) {
    throw new functions.https.HttpsError('invalid-argument', '請提供推薦碼');
  }
  
  const codeDoc = await db.collection('referralCodes').doc(referralCode).get();
  if (!codeDoc.exists) {
    throw new functions.https.HttpsError('not-found', '推薦碼不存在');
  }
  
  const codeData = codeDoc.data();
  
  if (codeData.ownerId === newUserId) {
    throw new functions.https.HttpsError('invalid-argument', '不能使用自己的推薦碼');
  }
  
  const newUserDoc = await db.collection('users').doc(newUserId).get();
  if (newUserDoc.exists && newUserDoc.data().referredBy) {
    throw new functions.https.HttpsError('already-exists', '您已經使用過推薦碼');
  }
  
  const referrerId = codeData.ownerId;
  
  await db.runTransaction(async (transaction) => {
    transaction.update(db.collection('users').doc(newUserId), { referredBy: referrerId });
    transaction.update(db.collection('users').doc(referrerId), {
      referralCount: admin.firestore.FieldValue.increment(1),
    });
    transaction.update(db.collection('referralCodes').doc(referralCode), {
      usageCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  
  const referrerReward = await awardPoints(referrerId, 'referral_success', '推薦用戶成功', newUserId);
  const newUserReward = await awardPoints(newUserId, 'referred_bonus', '透過推薦碼註冊獎勵', referrerId);
  
  return { success: true, referrerReward, newUserReward };
});

/**
 * 更新推薦碼
 */
exports.updateReferralCode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }
  
  const userId = context.auth.uid;
  const { newCode } = data;
  
  if (!newCode || newCode.length < 4 || newCode.length > 20) {
    throw new functions.https.HttpsError('invalid-argument', '推薦碼長度需為 4-20 字元');
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(newCode)) {
    throw new functions.https.HttpsError('invalid-argument', '推薦碼只能包含英文、數字、底線和橫線');
  }
  
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  
  const tiersSnapshot = await db.collection('membershipTiers')
    .where('slug', '==', userData.primaryTierId || 'trial')
    .limit(1)
    .get();
  
  if (!tiersSnapshot.empty) {
    const tierData = tiersSnapshot.docs[0].data();
    if (!tierData.permissions?.canCustomReferral) {
      throw new functions.https.HttpsError('permission-denied', '您的會員等級無法自訂推薦碼');
    }
  }
  
  const existingCode = await db.collection('referralCodes').doc(newCode).get();
  if (existingCode.exists) {
    throw new functions.https.HttpsError('already-exists', '此推薦碼已被使用');
  }
  
  const oldCode = userData.referralCode;
  
  await db.runTransaction(async (transaction) => {
    if (oldCode) {
      transaction.delete(db.collection('referralCodes').doc(oldCode));
    }
    transaction.set(db.collection('referralCodes').doc(newCode), {
      ownerId: userId,
      ownerEmail: userData.email,
      usageCount: 0,
      successCount: 0,
      totalPointsGenerated: 0,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.update(db.collection('users').doc(userId), { referralCode: newCode });
  });
  
  return { success: true, newCode };
});

/**
 * 取得用戶點數摘要
 */
exports.getUserPointsSummary = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }
  
  const userId = context.auth.uid;
  const userDoc = await db.collection('users').doc(userId).get();
  
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', '用戶不存在');
  }
  
  const userData = userDoc.data();
  
  const recentLedger = await db.collection('pointsLedger')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();
  
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
  
  const expiringSnapshot = await db.collection('pointsLedger')
    .where('userId', '==', userId)
    .where('type', '==', 'earn')
    .where('isExpired', '==', false)
    .where('expiresAt', '<=', admin.firestore.Timestamp.fromDate(thirtyDaysLater))
    .get();
  
  let expiringPoints = 0;
  expiringSnapshot.docs.forEach((doc) => { expiringPoints += doc.data().amount; });
  
  return {
    currentPoints: typeof userData.points === 'object' ? (userData.points?.current || 0) : (userData.points || 0),
    totalEarned: userData.totalPointsEarned || 0,
    totalSpent: userData.totalPointsSpent || 0,
    totalExpired: userData.totalPointsExpired || 0,
    loginStreak: userData.loginStreak || 0,
    referralCode: userData.referralCode,
    referralCount: userData.referralCount || 0,
    expiringIn30Days: expiringPoints,
    recentTransactions: recentLedger.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
    })),
  };
});

/**
 * 管理員手動發放獎勵
 */
exports.awardActivityPoints = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }
  
  const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', '需要管理員權限');
  }
  
  const { userId, actionId, reason } = data;
  
  if (!userId || !actionId) {
    throw new functions.https.HttpsError('invalid-argument', '請提供 userId 和 actionId');
  }
  
  const result = await awardPoints(userId, actionId, reason || '管理員發放');
  
  await db.collection('auditLogs').add({
    adminId: context.auth.uid,
    adminEmail: context.auth.token.email,
    action: 'user.points.award',
    targetType: 'user',
    targetId: userId,
    changes: { actionId, reason, result, description: `手動發放點數: ${actionId}` },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  return result;
});

// ==========================================
// 🆕 Phase 1：天數制會員系統
// ==========================================

/**
 * 驗證推薦碼
 * 輸入：{ code: "WANG123" }
 * 輸出：{ valid: true, ownerName: "王小明" } 或 { valid: false }
 */
exports.validateReferralCode = functions.https.onCall(async (data, context) => {
  const { code } = data;

  if (!code) {
    return { valid: false, message: '請提供推薦碼' };
  }

  try {
    const codeDoc = await db.collection('referralCodes').doc(code.toUpperCase()).get();

    if (!codeDoc.exists || !codeDoc.data().isActive) {
      return { valid: false, message: '推薦碼無效或已停用' };
    }

    // 取得推薦人名稱
    const ownerDoc = await db.collection('users').doc(codeDoc.data().ownerId).get();
    const ownerData = ownerDoc.data();

    return {
      valid: true,
      ownerId: codeDoc.data().ownerId,
      ownerName: ownerData?.displayName || ownerData?.email?.split('@')[0] || '會員',
    };
  } catch (error) {
    console.error('validateReferralCode error:', error);
    return { valid: false, message: '驗證失敗' };
  }
});

/**
 * 處理付款（Admin 用）
 * 輸入：{ userEmail, days: 365, amount: 8999, notes?: "備註" }
 * 輸出：{ success: true, newDaysRemaining: 372 }
 */
exports.processPayment = functions.https.onCall(async (data, context) => {
  // 驗證是否為 Admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', '需要管理員權限');
  }

  const { userEmail, days, amount, notes } = data;

  if (!userEmail || !days) {
    throw new functions.https.HttpsError('invalid-argument', '請提供用戶 Email 和天數');
  }

  // 1. 找到用戶
  const usersSnapshot = await db.collection('users')
    .where('email', '==', userEmail)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    throw new functions.https.HttpsError('not-found', '找不到此用戶');
  }

  const userDoc = usersSnapshot.docs[0];
  const userData = userDoc.data();
  const userId = userDoc.id;

  // 2. 計算新天數
  const currentDays = userData.daysRemaining || 0;
  const newDaysRemaining = currentDays + days;

  // 3. 更新用戶資料
  const updateData = {
    primaryTierId: 'paid',
    daysRemaining: newDaysRemaining,
    graceDaysRemaining: 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await userDoc.ref.update(updateData);

  // 4. 發放推薦獎勵（如果有推薦人且尚未領取）
  // 🆕 付費獎勵改為 1000 UA（原 500）
  let referralRewardGiven = false;
  if (userData.referredBy && !userData.referralRewardClaimed) {
    try {
      // 推薦人 +1000
      await awardPointsSimple(userData.referredBy, 1000, '推薦好友成功付費');
      // 被推薦人 +1000
      await awardPointsSimple(userId, 1000, '使用推薦碼註冊並付費獎勵');
      // 標記已領取
      await userDoc.ref.update({ referralRewardClaimed: true });

      // 更新推薦碼統計
      if (userData.referralCode) {
        const referrerDoc = await db.collection('users').doc(userData.referredBy).get();
        if (referrerDoc.exists) {
          const referrerCode = referrerDoc.data().referralCode;
          if (referrerCode) {
            await db.collection('referralCodes').doc(referrerCode).update({
              successCount: admin.firestore.FieldValue.increment(1),
              totalPointsGenerated: admin.firestore.FieldValue.increment(2000),  // 雙方各 1000
            });
          }
        }
      }

      referralRewardGiven = true;
    } catch (err) {
      console.error('Referral reward error:', err);
    }
  }

  // 5. 記錄付款歷史
  await db.collection('paymentHistory').add({
    userId,
    userEmail,
    days,
    amount: amount || 0,
    notes: notes || '',
    previousDays: currentDays,
    newDaysRemaining,
    referralRewardGiven,
    processedBy: context.auth.uid,
    processedByEmail: context.auth.token.email,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 6. 發送 LINE 通知（使用後台設定的訊息）
  if (userData.lineUserId) {
    try {
      const notificationSettings = await getNotificationSettings();
      if (notificationSettings.paymentSuccessEnabled) {
        const message = replaceMessageVariables(
          notificationSettings.paymentSuccess || `🎉 付款成功！\n\n已為您加值 ${days} 天\n目前剩餘天數：${newDaysRemaining} 天\n\n感謝您的支持！`,
          {
            name: userData.displayName || userData.email?.split('@')[0] || '用戶',
            days: days.toString(),
            daysRemaining: newDaysRemaining.toString(),
            expiryDate: new Date(Date.now() + newDaysRemaining * 24 * 60 * 60 * 1000).toLocaleDateString('zh-TW')
          }
        );
        await sendLineMessage(userData.lineUserId, [{ type: 'text', text: message }]);
      }
    } catch (err) {
      console.error('LINE notification error:', err);
    }
  }

  console.log(`Payment processed: ${userEmail} +${days} days, total: ${newDaysRemaining}`);

  return {
    success: true,
    newDaysRemaining,
    referralRewardGiven,
    userId,
  };
});

// ==========================================
// 🆕 Admin 重設用戶密碼
// ==========================================

/**
 * Admin 重設用戶密碼
 * 輸入：{ userEmail, newPassword }
 * 輸出：{ success: true }
 */
exports.adminResetPassword = functions.https.onCall(async (data, context) => {
  // 驗證是否為 Admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  // 驗證 Admin 權限（可選：檢查是否在 admins 集合中）
  const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', '需要管理員權限');
  }

  const { userEmail, newPassword } = data;

  if (!userEmail) {
    throw new functions.https.HttpsError('invalid-argument', '請提供用戶 Email');
  }

  if (!newPassword || newPassword.length < 6) {
    throw new functions.https.HttpsError('invalid-argument', '密碼至少需要 6 個字元');
  }

  try {
    // 透過 Email 查找用戶
    const userRecord = await auth.getUserByEmail(userEmail);

    // 更新密碼
    await auth.updateUser(userRecord.uid, {
      password: newPassword,
    });

    // 記錄操作日誌
    await db.collection('auditLogs').add({
      action: 'admin_reset_password',
      targetEmail: userEmail,
      targetUid: userRecord.uid,
      performedBy: context.auth.uid,
      performedByEmail: context.auth.token.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Admin reset password: ${userEmail} by ${context.auth.token.email}`);

    return {
      success: true,
      message: `已成功重設 ${userEmail} 的密碼`,
    };
  } catch (error) {
    console.error('Admin reset password error:', error);
    if (error.code === 'auth/user-not-found') {
      throw new functions.https.HttpsError('not-found', '找不到該用戶');
    }
    throw new functions.https.HttpsError('internal', '重設密碼失敗：' + error.message);
  }
});

/**
 * 簡易發放點數（不經過規則檢查）
 */
async function awardPointsSimple(userId, amount, reason) {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) return;

  const userData = userDoc.data();
  const currentPoints = typeof userData.points === 'object'
    ? (userData.points?.current || 0)
    : (userData.points || 0);
  const newBalance = currentPoints + amount;

  await db.runTransaction(async (transaction) => {
    transaction.update(userRef, {
      'points.current': newBalance,
      totalPointsEarned: admin.firestore.FieldValue.increment(amount),
    });

    transaction.set(db.collection('pointsLedger').doc(), {
      userId,
      userEmail: userData.email,
      type: 'earn',
      amount,
      balanceBefore: currentPoints,
      balanceAfter: newBalance,
      reason,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'system',
    });
  });

  console.log(`Awarded ${amount} points to ${userId}: ${reason}`);
}

/**
 * 每日扣除天數（台灣時間 00:05）
 */
exports.deductDailyDays = functions.pubsub
  .schedule('5 0 * * *')
  .timeZone('Asia/Taipei')
  .onRun(async (context) => {
    console.log('Starting daily days deduction...');

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const notifications = [];

    // 🆕 載入後台通知設定
    const notificationSettings = await getNotificationSettings();

    // 1. 處理付費用戶（排除 founder）
    const paidUsers = await db.collection('users')
      .where('primaryTierId', '==', 'paid')
      .get();

    console.log(`Found ${paidUsers.size} paid users`);

    for (const doc of paidUsers.docs) {
      const data = doc.data();

      // 跳過今天已扣過的
      if (data.lastDayDeducted === today) continue;

      const currentDays = data.daysRemaining || 0;
      const newDays = Math.max(0, currentDays - 1);
      const userName = data.displayName || data.email?.split('@')[0] || '用戶';

      const updateData = {
        daysRemaining: newDays,
        lastDayDeducted: today,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // 🆕 使用後台設定的到期提醒訊息
      if (newDays === 7 && notificationSettings.expiryReminder7DaysEnabled) {
        notifications.push({
          lineUserId: data.lineUserId,
          message: replaceMessageVariables(notificationSettings.expiryReminder7Days, {
            name: userName,
            daysRemaining: '7'
          }),
        });
      } else if (newDays === 1 && notificationSettings.expiryReminder1DayEnabled) {
        notifications.push({
          lineUserId: data.lineUserId,
          message: replaceMessageVariables(notificationSettings.expiryReminder1Day, {
            name: userName,
            daysRemaining: '1'
          }),
        });
      } else if (newDays === 30 || newDays === 3) {
        // 30天和3天仍使用原本的訊息
        notifications.push({
          lineUserId: data.lineUserId,
          message: `⏰ 您的 Ultra Advisor 剩餘 ${newDays} 天，記得續訂喔！\n\n續訂連結：https://portaly.cc/GinRollBT`,
        });
      } else if (newDays <= 0) {
        // 進入寬限期
        updateData.primaryTierId = 'grace';
        updateData.daysRemaining = 0;
        updateData.graceDaysRemaining = 3;

        notifications.push({
          lineUserId: data.lineUserId,
          message: '⚠️ 您的 Ultra Advisor 天數已用完！\n\n已進入 3 天寬限期，部分功能將受限。\n\n立即續訂：https://portaly.cc/GinRollBT',
        });
      }

      await doc.ref.update(updateData);
    }

    // 2. 處理寬限期用戶
    const graceUsers = await db.collection('users')
      .where('primaryTierId', '==', 'grace')
      .get();

    console.log(`Found ${graceUsers.size} grace users`);

    for (const doc of graceUsers.docs) {
      const data = doc.data();
      const currentGraceDays = data.graceDaysRemaining || 0;
      const newGraceDays = Math.max(0, currentGraceDays - 1);

      if (newGraceDays <= 0) {
        // 寬限期結束，變為過期
        await doc.ref.update({
          primaryTierId: 'expired',
          graceDaysRemaining: 0,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        notifications.push({
          lineUserId: data.lineUserId,
          message: '❌ 您的 Ultra Advisor 已過期！\n\n所有進階功能已停用。\n\n立即續訂恢復使用：https://portaly.cc/GinRollBT',
        });
      } else {
        await doc.ref.update({
          graceDaysRemaining: newGraceDays,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    // 3. 處理試用用戶天數
    const trialUsers = await db.collection('users')
      .where('primaryTierId', 'in', ['trial', 'referral_trial'])
      .get();

    console.log(`Found ${trialUsers.size} trial users`);

    for (const doc of trialUsers.docs) {
      const data = doc.data();

      if (data.lastDayDeducted === today) continue;

      const currentDays = data.daysRemaining || 0;
      const newDays = Math.max(0, currentDays - 1);

      const updateData = {
        daysRemaining: newDays,
        lastDayDeducted: today,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (newDays === 3 || newDays === 1) {
        const upgradeLink = data.primaryTierId === 'referral_trial'
          ? 'https://portaly.cc/GinRollBT（使用折扣碼 Miiroll7 可折 $999）'
          : 'https://portaly.cc/GinRollBT';

        notifications.push({
          lineUserId: data.lineUserId,
          message: `⏰ 試用期剩餘 ${newDays} 天！\n\n升級享受完整功能：${upgradeLink}`,
        });
      } else if (newDays <= 0) {
        updateData.primaryTierId = 'expired';

        notifications.push({
          lineUserId: data.lineUserId,
          message: '❌ 試用期已結束！\n\n立即升級繼續使用：https://portaly.cc/GinRollBT',
        });
      }

      await doc.ref.update(updateData);
    }

    // 4. 發送 LINE 通知
    for (const n of notifications) {
      if (n.lineUserId) {
        try {
          await sendLineMessage(n.lineUserId, [{ type: 'text', text: n.message }]);
        } catch (err) {
          console.error('LINE notification error:', err);
        }
      }
    }

    console.log(`Daily deduction completed. Sent ${notifications.length} notifications.`);
    return null;
  });

/**
 * 點數兌換天數
 * 輸入：{ itemId: "7days" }
 * 輸出：{ success: true, newPoints: 1000, newDays: 372 }
 */
exports.redeemPoints = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  const userId = context.auth.uid;
  const { itemId } = data;

  // 兌換項目定義
  const redeemItems = {
    '7days': { points: 500, days: 7, name: '延長 7 天' },
    '30days': { points: 1800, days: 30, name: '延長 30 天' },
  };

  const item = redeemItems[itemId];
  if (!item) {
    throw new functions.https.HttpsError('invalid-argument', '無效的兌換項目');
  }

  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', '用戶不存在');
  }

  const userData = userDoc.data();
  const currentPoints = typeof userData.points === 'object'
    ? (userData.points?.current || 0)
    : (userData.points || 0);

  // 檢查點數
  if (currentPoints < item.points) {
    throw new functions.https.HttpsError('failed-precondition', `點數不足，需要 ${item.points} UA，目前僅有 ${currentPoints} UA`);
  }

  // 執行兌換
  const newPoints = currentPoints - item.points;
  const currentDays = userData.daysRemaining || 0;
  const newDays = currentDays + item.days;

  // 如果是 expired/grace/trial，升級為 paid
  let newTierId = userData.primaryTierId;
  if (['expired', 'grace', 'trial', 'referral_trial'].includes(newTierId)) {
    newTierId = 'paid';
  }

  await db.runTransaction(async (transaction) => {
    transaction.update(userDoc.ref, {
      'points.current': newPoints,
      daysRemaining: newDays,
      primaryTierId: newTierId,
      graceDaysRemaining: 0,
      totalPointsSpent: admin.firestore.FieldValue.increment(item.points),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 記錄點數消費
    transaction.set(db.collection('pointsLedger').doc(), {
      userId,
      userEmail: userData.email,
      type: 'spend',
      amount: -item.points,
      balanceBefore: currentPoints,
      balanceAfter: newPoints,
      reason: `兌換：${item.name}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 記錄兌換訂單
    transaction.set(db.collection('redemptionOrders').doc(), {
      userId,
      userEmail: userData.email,
      itemId,
      itemName: item.name,
      pointsCost: item.points,
      daysAdded: item.days,
      previousDays: currentDays,
      newDaysRemaining: newDays,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  console.log(`Points redeemed: ${userId} spent ${item.points} for ${item.name}`);

  return {
    success: true,
    newPoints,
    newDays,
    itemName: item.name,
  };
});

// ==========================================
// 定時任務
// ==========================================

/**
 * 檢查試用到期（每天早上 9:00）
 */
exports.checkTrialExpiration = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('Asia/Taipei')
  .onRun(async (context) => {
    console.log('Running trial expiration check...');
    const now = admin.firestore.Timestamp.now();
    const threeDaysLater = admin.firestore.Timestamp.fromMillis(now.toMillis() + 3 * 24 * 60 * 60 * 1000);

    try {
      const threeDaysSnapshot = await db.collection('users')
        .where('subscriptionStatus', '==', 'trial')
        .where('trialExpiresAt', '<=', threeDaysLater)
        .where('trialExpiresAt', '>', now)
        .get();

      for (const doc of threeDaysSnapshot.docs) {
        const userData = doc.data();
        const daysRemaining = Math.ceil((userData.trialExpiresAt.toMillis() - now.toMillis()) / (24 * 60 * 60 * 1000));

        if ((daysRemaining === 3 || daysRemaining === 1) && userData.lineUserId) {
          await sendLineMessage(userData.lineUserId, [{
            type: 'text',
            text: `⏰ 試用期剩餘 ${daysRemaining} 天\n\n立即升級：https://portaly.cc/GinRollBT`
          }]);
        }
      }
      console.log(`Sent ${threeDaysSnapshot.size} expiration reminders`);
    } catch (error) {
      console.error('Trial expiration check error:', error);
    }
    return null;
  });

/**
 * 刪除過期帳號（每天凌晨 2:00）
 */
exports.deleteExpiredAccounts = functions.pubsub
  .schedule('0 2 * * *')
  .timeZone('Asia/Taipei')
  .onRun(async (context) => {
    console.log('Running expired accounts deletion...');
    const now = admin.firestore.Timestamp.now();

    try {
      const expiredSnapshot = await db.collection('users')
        .where('subscriptionStatus', '==', 'trial')
        .where('trialExpiresAt', '<=', now)
        .get();

      for (const doc of expiredSnapshot.docs) {
        const userData = doc.data();
        const uid = doc.id;

        try {
          await db.collection('backups').doc(uid).set({
            backedUpAt: now,
            expiresAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + 30 * 24 * 60 * 60 * 1000),
            userData: userData
          });

          await doc.ref.delete();
          await auth.deleteUser(uid);

          if (userData.lineUserId) {
            await sendLineMessage(userData.lineUserId, [{
              type: 'text',
              text: '試用期已結束\n\n立即訂閱：https://portaly.cc/GinRollBT'
            }]);
          }
          console.log(`Deleted expired account: ${userData.email}`);
        } catch (error) {
          console.error(`Error deleting account ${uid}:`, error);
        }
      }
      console.log(`Deleted ${expiredSnapshot.size} expired accounts`);
    } catch (error) {
      console.error('Delete expired accounts error:', error);
    }
    return null;
  });

/**
 * 清理過期備份（每天凌晨 3:00）
 */
exports.cleanupExpiredBackups = functions.pubsub
  .schedule('0 3 * * *')
  .timeZone('Asia/Taipei')
  .onRun(async (context) => {
    console.log('Running expired backups cleanup...');
    const now = admin.firestore.Timestamp.now();

    try {
      const expiredBackups = await db.collection('backups').where('expiresAt', '<=', now).get();
      const batch = db.batch();
      expiredBackups.docs.forEach(doc => { batch.delete(doc.ref); });
      await batch.commit();
      console.log(`Cleaned up ${expiredBackups.size} expired backups`);
    } catch (error) {
      console.error('Cleanup expired backups error:', error);
    }
    return null;
  });

/**
 * 🆕 點數過期檢查（每天凌晨 3:30）
 */
exports.expirePoints = functions.pubsub
  .schedule('30 3 * * *')
  .timeZone('Asia/Taipei')
  .onRun(async (context) => {
    console.log('Starting points expiration check...');
    const now = admin.firestore.Timestamp.now();
    
    const expiredSnapshot = await db.collection('pointsLedger')
      .where('type', '==', 'earn')
      .where('isExpired', '==', false)
      .where('expiresAt', '<=', now)
      .get();
    
    if (expiredSnapshot.empty) {
      console.log('No expired points found');
      return null;
    }
    
    console.log(`Found ${expiredSnapshot.size} expired point entries`);
    
    const userExpiredPoints = {};
    expiredSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (!userExpiredPoints[data.userId]) {
        userExpiredPoints[data.userId] = { totalExpired: 0, entries: [] };
      }
      userExpiredPoints[data.userId].totalExpired += data.amount;
      userExpiredPoints[data.userId].entries.push({ id: doc.id, ...data });
    });
    
    for (const [userId, expiredData] of Object.entries(userExpiredPoints)) {
      try {
        await db.runTransaction(async (transaction) => {
          const userRef = db.collection('users').doc(userId);
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists) return;
          
          const userData = userDoc.data();
          const currentPoints = typeof userData.points === 'object' ? (userData.points?.current || 0) : (userData.points || 0);
          const pointsToExpire = Math.min(expiredData.totalExpired, currentPoints);

          transaction.update(userRef, {
            'points.current': currentPoints - pointsToExpire,
            totalPointsExpired: admin.firestore.FieldValue.increment(pointsToExpire),
          });
          
          for (const entry of expiredData.entries) {
            transaction.update(db.collection('pointsLedger').doc(entry.id), { isExpired: true });
          }
          
          if (pointsToExpire > 0) {
            transaction.set(db.collection('pointsLedger').doc(), {
              userId,
              userEmail: userData.email,
              type: 'expire',
              amount: -pointsToExpire,
              balanceBefore: currentPoints,
              balanceAfter: currentPoints - pointsToExpire,
              actionId: 'points_expired',
              reason: `點數過期`,
              referenceType: 'system',
              isExpired: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              createdBy: 'system',
            });
          }
        });
        console.log(`Expired ${expiredData.totalExpired} points for user ${userId}`);
      } catch (error) {
        console.error(`Error processing expired points for ${userId}:`, error);
      }
    }
    
    console.log('Points expiration check completed');
    return null;
  });

/**
 * 🆕 會員到期檢查（每天凌晨 4:00）
 */
exports.checkMembershipExpiry = functions.pubsub
  .schedule('0 4 * * *')
  .timeZone('Asia/Taipei')
  .onRun(async (context) => {
    console.log('Starting membership expiry check...');
    const now = new Date();
    const nowTimestamp = admin.firestore.Timestamp.fromDate(now);
    
    const gracePeriodEnd = new Date(now);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() - 7);
    
    // 付費 → 寬限
    const expiredMembers = await db.collection('users')
      .where('primaryTierId', '==', 'paid')
      .where('membershipExpiresAt', '<=', nowTimestamp)
      .get();
    
    for (const doc of expiredMembers.docs) {
      try {
        const userData = doc.data();
        await doc.ref.update({
          primaryTierId: 'grace',
          membershipTierIds: ['grace'],
          graceStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        if (userData.lineUserId) {
          await sendLineMessage(userData.lineUserId, [{
            type: 'text',
            text: '⚠️ 訂閱已到期，進入 7 天寬限期\n\n續訂：https://portaly.cc/GinRollBT'
          }]);
        }
        console.log(`User ${userData.email} moved to grace period`);
      } catch (error) {
        console.error(`Error:`, error);
      }
    }
    
    // 寬限 → 過期
    const graceExpired = await db.collection('users')
      .where('primaryTierId', '==', 'grace')
      .where('graceStartedAt', '<=', admin.firestore.Timestamp.fromDate(gracePeriodEnd))
      .get();
    
    for (const doc of graceExpired.docs) {
      try {
        await doc.ref.update({
          primaryTierId: 'expired',
          membershipTierIds: ['expired'],
        });
        console.log(`User ${doc.data().email} moved to expired`);
      } catch (error) {
        console.error(`Error:`, error);
      }
    }
    
    console.log('Membership expiry check completed');
    return null;
  });

// ==========================================
// 🆕 LIFF 註冊 API（HTTP Endpoint）
// ==========================================

/**
 * LIFF 註冊 - 一頁式表單提交
 * POST /liffRegister
 * Body: { name, email, password, referralCode?, lineUserId, lineDisplayName, linePictureUrl? }
 */
exports.liffRegister = functions.https.onRequest(async (req, res) => {
  // CORS 處理（使用白名單）
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { name, email, password, referralCode, lineUserId, lineDisplayName, linePictureUrl, recaptchaToken } = req.body;

    // 🔒 Step 1: Rate Limiting 檢查
    const clientIp = getClientIp(req);
    const rateLimit = await checkRateLimit(clientIp, 'register');

    if (!rateLimit.allowed) {
      console.warn(`Rate limit exceeded for IP: ${clientIp}`);
      return res.status(429).json({
        success: false,
        error: `註冊請求過於頻繁，請 ${rateLimit.resetIn} 分鐘後再試`
      });
    }

    // 🔒 Step 2: reCAPTCHA 驗證（僅網頁註冊需要）
    if (!lineUserId && recaptchaToken) {
      const recaptchaResult = await verifyRecaptcha(recaptchaToken, 'register');
      if (!recaptchaResult.success) {
        console.warn(`reCAPTCHA failed for IP: ${clientIp}, score: ${recaptchaResult.score}`);
        return res.status(400).json({
          success: false,
          error: recaptchaResult.error || '人機驗證失敗，請重新整理頁面後再試'
        });
      }
    }

    // 驗證必填欄位
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: '請填寫所有必填欄位' });
    }

    // LINE User ID 驗證（允許網頁註冊跳過）
    // 網頁註冊時 lineUserId 為 null，不需要 LINE 帳號
    const isWebRegister = !lineUserId;

    // 驗證 Email 格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Email 格式不正確' });
    }

    // 驗證密碼長度
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: '密碼至少需要 6 個字元' });
    }

    // 檢查 Email 是否已存在
    const existingUser = await auth.getUserByEmail(email.toLowerCase()).catch(() => null);
    if (existingUser) {
      return res.status(400).json({ success: false, error: '此 Email 已經註冊' });
    }

    // 檢查 LINE User ID 是否已綁定（跳過網頁註冊和開發模式的假 ID）
    if (!isWebRegister && !lineUserId.startsWith('dev-user-')) {
      const existingLineUser = await db.collection('users')
        .where('lineUserId', '==', lineUserId)
        .limit(1)
        .get();

      if (!existingLineUser.empty) {
        return res.status(400).json({ success: false, error: '此 LINE 帳號已綁定其他帳戶' });
      }
    }

    // 處理推薦碼
    let referredByUid = null;
    let referrerName = null;
    let tierId = 'trial';

    if (referralCode) {
      const codeDoc = await db.collection('referralCodes').doc(referralCode.toUpperCase()).get();
      if (codeDoc.exists && codeDoc.data().isActive) {
        tierId = 'referral_trial';
        referredByUid = codeDoc.data().ownerId;

        // 取得推薦人名稱
        const referrerDoc = await db.collection('users').doc(referredByUid).get();
        if (referrerDoc.exists) {
          const referrerData = referrerDoc.data();
          referrerName = referrerData.displayName || referrerData.email?.split('@')[0] || '會員';
        }
      }
    }

    // 創建 Firebase Auth 帳號
    const userRecord = await auth.createUser({
      email: email.toLowerCase(),
      password: password,
      displayName: name,
      emailVerified: false,
      disabled: false
    });

    const now = admin.firestore.Timestamp.now();

    // 計算試用到期時間（7 天後）
    const trialExpires = admin.firestore.Timestamp.fromMillis(
      now.toMillis() + 7 * 24 * 60 * 60 * 1000
    );

    // 生成推薦碼
    const newReferralCode = generateReferralCode(email);

    // 寫入 Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email: email.toLowerCase(),
      displayName: name,
      lineUserId: isWebRegister ? null : (lineUserId.startsWith('dev-user-') ? null : lineUserId),
      lineDisplayName: lineDisplayName || null,
      linePictureUrl: linePictureUrl || null,
      createdAt: now,
      updatedAt: now,
      // 天數制會員系統
      primaryTierId: tierId,
      daysRemaining: 7,
      lastDayDeducted: null,
      graceDaysRemaining: 0,
      trialExpiresAt: trialExpires,
      // UA 點數（被推薦者獲得 50 點）
      points: { current: referredByUid ? 50 : 0 },
      totalPointsEarned: referredByUid ? 50 : 0,
      totalPointsSpent: 0,
      totalPointsExpired: 0,
      // 推薦系統
      referralCode: newReferralCode,
      referredBy: referredByUid,
      referralCount: 0,
      referralRewardClaimed: false,
      // 其他
      isActive: true,
      isFirstLogin: true,
      loginStreak: 0,
      toolUsageCount: 0,
      clients: [],
      stats: { trialsCompleted: 0, hoursSaved: 0 }
    });

    // 建立推薦碼索引
    await db.collection('referralCodes').doc(newReferralCode).set({
      code: newReferralCode,
      ownerId: userRecord.uid,
      ownerEmail: email.toLowerCase(),
      usageCount: 0,
      successCount: 0,
      totalPointsGenerated: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });

    // 如果有推薦人，更新推薦人資料並記錄點數
    if (referredByUid) {
      const batch = db.batch();

      // 更新推薦人的 referralCount
      const referrerRef = db.collection('users').doc(referredByUid);
      batch.update(referrerRef, {
        referralCount: admin.firestore.FieldValue.increment(1)
      });

      // 更新推薦碼使用次數
      const codeRef = db.collection('referralCodes').doc(referralCode.toUpperCase());
      batch.update(codeRef, {
        usageCount: admin.firestore.FieldValue.increment(1),
        updatedAt: now
      });

      // 記錄被推薦者獲得的點數
      const ledgerRef = db.collection('pointsLedger').doc();
      batch.set(ledgerRef, {
        userId: userRecord.uid,
        type: 'earn',
        amount: 50,
        reason: '使用推薦碼註冊獎勵',
        relatedUserId: referredByUid,
        createdAt: now
      });

      await batch.commit();

      // 發送 LINE 通知給推薦人（如果有 LINE ID）
      const referrerDoc = await db.collection('users').doc(referredByUid).get();
      if (referrerDoc.exists && referrerDoc.data().lineUserId) {
        try {
          await sendLineMessage(referrerDoc.data().lineUserId, [{
            type: 'text',
            text: `🎉 好消息！你推薦的朋友 ${name} 已成功註冊！\n\n🎁 你已獲得 +100 UA 推薦獎勵！\n\n當他完成付費後，你們雙方還將各獲得 1000 UA 點數！`
          }]);
        } catch (lineErr) {
          console.error('發送推薦通知失敗:', lineErr);
        }
      }
    }

    // 格式化到期日期
    const expireDate = new Date(trialExpires.toMillis());
    const expireDateStr = `${expireDate.getFullYear()}/${expireDate.getMonth() + 1}/${expireDate.getDate()}`;

    console.log(`LIFF Register success: ${email}, tier: ${tierId}, referredBy: ${referredByUid || 'none'}`);

    // 回傳成功
    return res.status(200).json({
      success: true,
      data: {
        uid: userRecord.uid,
        email: email.toLowerCase(),
        displayName: name,
        trialExpireDate: expireDateStr,
        referralCode: newReferralCode,
        points: referredByUid ? 50 : 0,
        tierId: tierId
      }
    });

  } catch (error) {
    console.error('LIFF Register error:', error);
    return res.status(500).json({
      success: false,
      error: '系統發生錯誤，請稍後再試'
    });
  }
});

// ==========================================
// 🆕 更新點數規則（一次性管理員函數）
// ==========================================
exports.updatePointsRules = functions.https.onCall(async (_data, context) => {
  // 驗證管理員權限（使用 Firestore admins collection）
  await verifyAdminAccess(context);

  const now = admin.firestore.Timestamp.now();
  const batch = db.batch();

  // 更新的規則
  const rulesToUpdate = [
    {
      actionId: 'referral_registration',
      name: '推薦好友註冊',
      description: '推薦好友完成註冊，推薦人獲得點數',
      basePoints: 100,
      isActive: true,
      limits: null,
      category: 'referral',
      triggerType: 'auto',
      icon: '🎁',
      priority: 6,
    },
    {
      actionId: 'referral_success',
      name: '推薦成功',
      description: '推薦新用戶並完成付費（推薦人獎勵）',
      basePoints: 1000,
      isActive: true,
      limits: null,
      category: 'referral',
      triggerType: 'auto',
      icon: '🎁',
      priority: 7,
    },
    {
      actionId: 'referred_bonus',
      name: '被推薦獎勵',
      description: '透過推薦碼註冊並付費（被推薦人獎勵）',
      basePoints: 1000,
      isActive: true,
      limits: { totalMax: 1 },
      category: 'referral',
      triggerType: 'auto',
      icon: '🎉',
      priority: 8,
    },
  ];

  // 批次更新/建立規則
  for (const rule of rulesToUpdate) {
    const docRef = db.collection('pointsRules').doc(rule.actionId);
    batch.set(docRef, {
      ...rule,
      updatedAt: now,
    }, { merge: true });
  }

  await batch.commit();

  // 記錄審計日誌
  await db.collection('auditLogs').add({
    adminId: context.auth.uid,
    adminEmail: userEmail,
    action: 'points_rules.bulk_update',
    description: '批次更新推薦獎勵規則：註冊+100, 付費+1000',
    createdAt: now,
  });

  return {
    success: true,
    message: '點數規則已更新：推薦註冊 +100 UA，推薦付費 +1000 UA（雙方）',
    updatedRules: rulesToUpdate.map(r => r.actionId),
  };
});

// ==========================================
// 任務看板系統
// ==========================================

/**
 * completeMission - 完成任務並發放點數（原子性操作）
 *
 * @param {string} missionId - 任務 ID
 * @returns {Promise<{success: boolean, pointsAwarded?: number, message: string}>}
 */
exports.completeMission = functions.https.onCall(async (data, context) => {
  // 1. 驗證用戶登入
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  const uid = context.auth.uid;
  const { missionId } = data;

  if (!missionId) {
    throw new functions.https.HttpsError('invalid-argument', '缺少任務 ID');
  }

  try {
    // 2. 取得任務資料
    const missionRef = db.collection('missions').doc(missionId);
    const missionDoc = await missionRef.get();

    if (!missionDoc.exists) {
      throw new functions.https.HttpsError('not-found', '任務不存在');
    }

    const mission = missionDoc.data();

    if (!mission.isActive) {
      throw new functions.https.HttpsError('failed-precondition', '此任務目前已停用');
    }

    // 3. 檢查是否已完成
    const completedRef = db
      .collection('users').doc(uid)
      .collection('completedMissions').doc(missionId);

    const completedDoc = await completedRef.get();

    // 一次性任務：只能完成一次
    if (mission.repeatType === 'once' && completedDoc.exists) {
      throw new functions.https.HttpsError('already-exists', '此任務已完成過');
    }

    // 每日任務：每天只能完成一次
    if (mission.repeatType === 'daily' && completedDoc.exists) {
      const completedAt = completedDoc.data().completedAt?.toDate();
      if (completedAt) {
        const today = new Date();
        const taiwanOffset = 8 * 60 * 60 * 1000; // UTC+8
        const todayTaiwan = new Date(today.getTime() + taiwanOffset).toDateString();
        const completedTaiwan = new Date(completedAt.getTime() + taiwanOffset).toDateString();

        if (todayTaiwan === completedTaiwan) {
          throw new functions.https.HttpsError('already-exists', '今日已完成此任務');
        }
      }
    }

    // 4. 取得用戶資料
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', '用戶不存在');
    }

    const userData = userDoc.data();

    // 5. 自動驗證檢查
    if (mission.verificationType === 'auto' && mission.verificationField) {
      const field = mission.verificationField;
      const condition = mission.verificationCondition;

      let verified = false;

      // 簡單欄位檢查（photoURL, displayName, lineUserId）
      if (!condition) {
        // 也檢查 profile 子集合
        let fieldValue = userData[field];
        if (!fieldValue) {
          const profileDoc = await db.collection('users').doc(uid).collection('profile').doc('data').get();
          if (profileDoc.exists) {
            fieldValue = profileDoc.data()[field];
          }
        }
        verified = !!fieldValue;
      }
      // 條件檢查（如 count>=1, count>=3）
      else if (condition.startsWith('count>=')) {
        const requiredCount = parseInt(condition.replace('count>=', ''));

        if (field === 'clients') {
          const clientsSnapshot = await db.collection('users').doc(uid).collection('clients').get();
          verified = clientsSnapshot.size >= requiredCount;
        } else if (field === 'cheatSheetUsageCount') {
          verified = (userData.cheatSheetUsageCount || 0) >= requiredCount;
        }
      }
      // 每日登入檢查
      else if (condition === 'today') {
        const today = new Date();
        const taiwanOffset = 8 * 60 * 60 * 1000;
        const todayStr = new Date(today.getTime() + taiwanOffset).toISOString().split('T')[0];
        verified = userData.lastLoginDate === todayStr;
      }

      console.log(`Mission ${missionId} verification: field=${field}, condition=${condition}, verified=${verified}`);

      if (!verified) {
        throw new functions.https.HttpsError('failed-precondition', '尚未達成任務條件');
      }
    }

    // 6. 執行交易發放點數
    const currentPoints = userData.points?.current || 0;
    const newPoints = currentPoints + mission.points;

    // 計算點數過期時間（12 個月後）
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 12);

    // 7. 執行交易：發放點數 + 記錄完成
    await db.runTransaction(async (transaction) => {
      // 更新用戶點數
      transaction.update(userRef, {
        'points.current': newPoints,
        totalPointsEarned: admin.firestore.FieldValue.increment(mission.points),
        lastPointsEarnedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 記錄完成（使用 set 而不是 update，以便處理每日任務覆蓋）
      transaction.set(completedRef, {
        missionId: missionId,
        missionTitle: mission.title,
        missionCategory: mission.category,
        pointsAwarded: mission.points,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 記錄點數帳本
      const ledgerRef = db.collection('pointsLedger').doc();
      transaction.set(ledgerRef, {
        userId: uid,
        userEmail: userData.email,
        type: 'earn',
        subType: 'mission',
        amount: mission.points,
        balanceBefore: currentPoints,
        balanceAfter: newPoints,
        actionId: 'mission_complete',
        reason: `完成任務：${mission.title}`,
        referenceType: 'mission',
        referenceId: missionId,
        missionCategory: mission.category,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        isExpired: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'system',
      });
    });

    console.log(`User ${uid} completed mission ${missionId}, awarded ${mission.points} points`);

    return {
      success: true,
      pointsAwarded: mission.points,
      newBalance: newPoints,
      message: `🎉 任務完成！獲得 +${mission.points} UA 點`,
    };

  } catch (error) {
    // 如果是 HttpsError，直接拋出
    if (error.code) {
      throw error;
    }
    console.error('completeMission error:', error);
    throw new functions.https.HttpsError('internal', '任務完成處理失敗');
  }
});

/**
 * getMissions - 取得所有啟用的任務（供前台使用）
 *
 * @returns {Promise<{missions: Mission[]}>}
 */
exports.getMissions = functions.https.onCall(async (_data, context) => {
  // 可以不需要登入也能查看任務列表
  try {
    // 先取得所有任務，再在程式碼中過濾和排序（避免索引問題）
    const missionsSnapshot = await db.collection('missions').get();

    // 過濾並排序任務
    let missions = [];
    missionsSnapshot.forEach(doc => {
      const data = doc.data();
      // 只取得啟用的任務
      if (data.isActive === true) {
        missions.push({
          id: doc.id,
          ...data,
        });
      }
    });

    // 依 category 和 order 排序
    const categoryOrder = { 'onboarding': 1, 'social': 2, 'habit': 3, 'daily': 4 };
    missions.sort((a, b) => {
      const catDiff = (categoryOrder[a.category] || 99) - (categoryOrder[b.category] || 99);
      if (catDiff !== 0) return catDiff;
      return (a.order || 0) - (b.order || 0);
    });

    // 如果用戶已登入，附帶完成狀態
    if (context.auth) {
      const uid = context.auth.uid;
      const completedSnapshot = await db
        .collection('users').doc(uid)
        .collection('completedMissions')
        .get();

      const completedMap = {};
      completedSnapshot.forEach(doc => {
        completedMap[doc.id] = {
          completedAt: doc.data().completedAt,
          pointsAwarded: doc.data().pointsAwarded,
        };
      });

      // 附加完成狀態到每個任務
      missions.forEach(mission => {
        const completed = completedMap[mission.id];
        if (completed) {
          // 一次性任務：已完成
          if (mission.repeatType === 'once') {
            mission.isCompleted = true;
            mission.completedAt = completed.completedAt;
          }
          // 每日任務：檢查是否今天已完成
          else if (mission.repeatType === 'daily') {
            const completedAt = completed.completedAt?.toDate();
            if (completedAt) {
              const today = new Date();
              const taiwanOffset = 8 * 60 * 60 * 1000;
              const todayTaiwan = new Date(today.getTime() + taiwanOffset).toDateString();
              const completedTaiwan = new Date(completedAt.getTime() + taiwanOffset).toDateString();
              mission.isCompletedToday = (todayTaiwan === completedTaiwan);
              mission.completedAt = completed.completedAt;
            }
          }
        }
      });
    }

    return { missions };

  } catch (error) {
    console.error('getMissions error:', error);
    throw new functions.https.HttpsError('internal', '取得任務列表失敗');
  }
});

/**
 * initMissions - 初始化預設任務（管理員專用）
 *
 * @returns {Promise<{success: boolean, message: string}>}
 */
exports.initMissions = functions.https.onCall(async (_data, context) => {
  // 驗證管理員權限（使用 Firestore admins collection）
  await verifyAdminAccess(context);

  const now = admin.firestore.Timestamp.now();

  // 預設任務
  const missions = [
    {
      id: 'set_avatar',
      title: '設定個人頭像',
      description: '上傳一張專業的個人照片，讓客戶更認識你',
      icon: '📸',
      points: 20,
      category: 'onboarding',
      order: 1,
      linkType: 'modal',
      linkTarget: 'editProfile',
      verificationType: 'auto',
      verificationField: 'photoURL',
      repeatType: 'once',
      isActive: true,
    },
    {
      id: 'set_display_name',
      title: '設定顯示名稱',
      description: '設定您的顯示名稱，讓系統更好地稱呼您',
      icon: '📝',
      points: 15,
      category: 'onboarding',
      order: 2,
      linkType: 'modal',
      linkTarget: 'editProfile',
      verificationType: 'auto',
      verificationField: 'displayName',
      repeatType: 'once',
      isActive: true,
    },
    {
      id: 'first_client',
      title: '建立第一位客戶',
      description: '新增您的第一位客戶，開始使用理財工具',
      icon: '👤',
      points: 20,
      category: 'onboarding',
      order: 3,
      linkType: 'internal',
      linkTarget: '/clients',
      verificationType: 'auto',
      verificationField: 'clients',
      verificationCondition: 'count>=1',
      repeatType: 'once',
      isActive: true,
    },
    {
      id: 'join_line_official',
      title: '加入 LINE 官方帳號',
      description: '加入 Ultra Advisor 官方 LINE，獲取最新資訊',
      icon: '💬',
      points: 20,
      category: 'social',
      order: 1,
      linkType: 'external',
      linkTarget: 'https://line.me/R/ti/p/@ultraadvisor',
      verificationType: 'auto',
      verificationField: 'lineUserId',
      repeatType: 'once',
      isActive: true,
    },
    {
      id: 'join_line_community',
      title: '加入 LINE 戰友社群',
      description: '加入顧問戰友社群，與同行交流經驗',
      icon: '👥',
      points: 25,
      category: 'social',
      order: 2,
      linkType: 'external',
      linkTarget: 'https://line.me/ti/g2/9Cca20iCP8J0KrmVRg5GOe1n5dSatYKO8ETTHw',
      verificationType: 'manual',
      repeatType: 'once',
      isActive: true,
    },
    {
      id: 'pwa_install',
      title: '將 Ultra 加入主畫面',
      description: '將 Ultra Advisor 加入手機主畫面，隨時快速開啟',
      icon: '📱',
      points: 30,
      category: 'habit',
      order: 1,
      linkType: 'pwa',
      verificationType: 'manual',
      repeatType: 'once',
      isActive: true,
    },
    {
      id: 'use_cheat_sheet_3',
      title: '使用 3 次業務小抄',
      description: '善用業務小抄功能，快速掌握話術要點',
      icon: '📋',
      points: 15,
      category: 'habit',
      order: 2,
      linkType: 'internal',
      linkTarget: '/tools',
      verificationType: 'auto',
      verificationField: 'cheatSheetUsageCount',
      verificationCondition: 'count>=3',
      repeatType: 'once',
      isActive: true,
    },
    {
      id: 'daily_login',
      title: '每日登入',
      description: '每天登入系統，培養使用習慣',
      icon: '📅',
      points: 5,
      category: 'daily',
      order: 1,
      linkType: null,
      verificationType: 'auto',
      verificationField: 'lastLoginDate',
      verificationCondition: 'today',
      repeatType: 'daily',
      isActive: true,
    },
  ];

  const batch = db.batch();

  for (const mission of missions) {
    const { id, ...missionData } = mission;
    const docRef = db.collection('missions').doc(id);
    batch.set(docRef, {
      ...missionData,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  }

  await batch.commit();

  // 記錄審計日誌
  await db.collection('auditLogs').add({
    adminId: context.auth.uid,
    adminEmail: userEmail,
    action: 'missions.init',
    description: `初始化 ${missions.length} 個預設任務`,
    createdAt: now,
  });

  return {
    success: true,
    message: `成功初始化 ${missions.length} 個任務`,
    count: missions.length,
  };
});

/**
 * 重置任務（清除後重新初始化）- 僅限管理員
 * 使用環境變數存放密鑰，不再硬編碼
 */
exports.initMissionsHttp = functions.https.onRequest(async (req, res) => {
  // 使用環境變數中的密鑰
  const secretKey = functions.config().admin?.init_key;
  if (!secretKey || req.query.key !== secretKey) {
    res.status(403).json({ error: '無效的 key 或未設定環境變數 admin.init_key' });
    return;
  }

  try {
    // 先刪除所有現有任務
    const existingMissions = await db.collection('missions').get();
    const deleteBatch = db.batch();
    existingMissions.docs.forEach(doc => {
      deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();
    console.log(`已刪除 ${existingMissions.size} 個舊任務`);

    // 重新建立任務
    const now = admin.firestore.Timestamp.now();
    const missions = [
      { id: 'set_avatar', title: '設定個人頭像', description: '上傳一張專業的個人照片，讓客戶更認識你', icon: '📸', points: 20, category: 'onboarding', order: 1, linkType: 'modal', linkTarget: 'editProfile', verificationType: 'auto', verificationField: 'photoURL', repeatType: 'once', isActive: true },
      { id: 'set_display_name', title: '設定顯示名稱', description: '設定一個專業的顯示名稱', icon: '📝', points: 15, category: 'onboarding', order: 2, linkType: 'modal', linkTarget: 'editProfile', verificationType: 'auto', verificationField: 'displayName', repeatType: 'once', isActive: true },
      { id: 'first_client', title: '建立第一位客戶', description: '新增你的第一位客戶資料', icon: '👤', points: 20, category: 'onboarding', order: 3, linkType: 'internal', linkTarget: '/clients', verificationType: 'auto', verificationField: 'clients', verificationCondition: 'count>=1', repeatType: 'once', isActive: true },
      { id: 'join_line_official', title: '加入 LINE 官方帳號', description: '加入 Ultra Advisor 官方 LINE，獲取最新資訊', icon: '💬', points: 20, category: 'social', order: 1, linkType: 'external', linkTarget: 'https://line.me/R/ti/p/@ultraadvisor', verificationType: 'auto', verificationField: 'lineUserId', repeatType: 'once', isActive: true },
      { id: 'join_line_community', title: '加入 LINE 戰友社群', description: '加入顧問戰友社群，與同行交流經驗', icon: '👥', points: 25, category: 'social', order: 2, linkType: 'external', linkTarget: 'https://line.me/ti/g2/9Cca20iCP8J0KrmVRg5GOe1n5dSatYKO8ETTHw', verificationType: 'manual', repeatType: 'once', isActive: true },
      { id: 'pwa_install', title: '將 Ultra 加入主畫面', description: '將 Ultra Advisor 加入手機主畫面，隨時隨地使用', icon: '📱', points: 30, category: 'habit', order: 1, linkType: 'pwa', verificationType: 'manual', repeatType: 'once', isActive: true },
      { id: 'use_cheat_sheet_3', title: '使用 3 次業務小抄', description: '使用業務小抄功能 3 次，熟悉產品資訊', icon: '📋', points: 15, category: 'habit', order: 2, linkType: 'internal', linkTarget: '/tools', verificationType: 'auto', verificationField: 'cheatSheetUsageCount', verificationCondition: 'count>=3', repeatType: 'once', isActive: true },
      { id: 'daily_login', title: '每日登入', description: '每天登入系統，培養使用習慣', icon: '📅', points: 5, category: 'daily', order: 1, linkType: null, verificationType: 'auto', verificationField: 'lastLoginDate', verificationCondition: 'today', repeatType: 'daily', isActive: true },
    ];

    const createBatch = db.batch();
    for (const mission of missions) {
      const { id, ...missionData } = mission;
      const docRef = db.collection('missions').doc(id);
      createBatch.set(docRef, { ...missionData, createdAt: now, updatedAt: now });
    }
    await createBatch.commit();

    res.json({ success: true, message: `已清除舊任務並重新建立 ${missions.length} 個任務`, deleted: existingMissions.size, created: missions.length });
  } catch (error) {
    console.error('Init missions error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Debug: 查看用戶資料 - 僅限管理員
 * 使用環境變數存放密鑰，不再硬編碼
 */
exports.debugUserData = functions.https.onRequest(async (req, res) => {
  // 使用環境變數中的密鑰
  const secretKey = functions.config().admin?.debug_key;
  if (!secretKey || req.query.key !== secretKey) {
    res.status(403).json({ error: '無效的 key 或未設定環境變數 admin.debug_key' });
    return;
  }

  const email = req.query.email;
  if (!email) {
    res.status(400).json({ error: '請提供 email 參數' });
    return;
  }

  try {
    // 找用戶
    const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
    if (usersSnapshot.empty) {
      res.json({ error: '找不到用戶', email });
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    const uid = userDoc.id;
    const userData = userDoc.data();

    // 取得 profile 子集合
    const profileDoc = await db.collection('users').doc(uid).collection('profile').doc('data').get();
    const profileData = profileDoc.exists ? profileDoc.data() : null;

    // 取得已完成任務
    const completedSnapshot = await db.collection('users').doc(uid).collection('completedMissions').get();
    const completedMissions = completedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({
      uid,
      email,
      userData: {
        photoURL: userData.photoURL,
        displayName: userData.displayName,
        lineUserId: userData.lineUserId,
        lastLoginDate: userData.lastLoginDate,
        cheatSheetUsageCount: userData.cheatSheetUsageCount,
      },
      profileData: profileData ? {
        photoURL: profileData.photoURL,
        displayName: profileData.displayName,
      } : null,
      completedMissions,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 孤立用戶清理功能
// ==========================================

/**
 * 列出孤立的 Auth 用戶（在 Firebase Auth 但不在 Firestore users 集合）
 */
exports.listOrphanAuthUsers = functions.https.onCall(async (_data, context) => {
  // 驗證管理員權限（使用 Firestore admins collection）
  await verifyAdminAccess(context);

  try {
    // 取得所有 Firestore users 的 UID
    const usersSnapshot = await db.collection('users').get();
    const firestoreUids = new Set(usersSnapshot.docs.map(doc => doc.id));

    // 取得所有 Firebase Auth 用戶
    const orphanUsers = [];
    let nextPageToken;

    do {
      const listResult = await auth.listUsers(1000, nextPageToken);

      for (const userRecord of listResult.users) {
        // 如果這個 Auth 用戶不在 Firestore users 集合裡
        if (!firestoreUids.has(userRecord.uid)) {
          orphanUsers.push({
            uid: userRecord.uid,
            email: userRecord.email || '(無 Email)',
            displayName: userRecord.displayName || '',
            createdAt: userRecord.metadata.creationTime,
            lastSignIn: userRecord.metadata.lastSignInTime,
            disabled: userRecord.disabled,
          });
        }
      }

      nextPageToken = listResult.pageToken;
    } while (nextPageToken);

    return {
      success: true,
      totalAuthUsers: firestoreUids.size + orphanUsers.length,
      firestoreUsers: firestoreUids.size,
      orphanCount: orphanUsers.length,
      orphanUsers: orphanUsers,
    };
  } catch (error) {
    console.error('List orphan users error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * 刪除指定的孤立 Auth 用戶
 */
exports.deleteOrphanAuthUsers = functions.https.onCall(async (data, context) => {
  // 驗證管理員權限（使用 Firestore admins collection）
  await verifyAdminAccess(context);

  const { uids } = data;

  if (!uids || !Array.isArray(uids) || uids.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', '請提供要刪除的用戶 UID 列表');
  }

  // 安全檢查：不能刪除管理員帳號（從 Firestore admins collection 獲取）
  const adminsSnapshot = await db.collection('admins').get();
  const adminUids = adminsSnapshot.docs.map(doc => doc.id);

  const safeUids = uids.filter(uid => !adminUids.includes(uid));

  if (safeUids.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', '無法刪除管理員帳號');
  }

  try {
    const deleteResult = await auth.deleteUsers(safeUids);

    // 記錄審計日誌
    await db.collection('auditLogs').add({
      adminId: context.auth.uid,
      adminEmail: context.auth.token.email,
      action: 'auth.deleteOrphanUsers',
      description: `刪除 ${deleteResult.successCount} 個孤立 Auth 用戶`,
      details: {
        requested: safeUids.length,
        success: deleteResult.successCount,
        failed: deleteResult.failureCount,
      },
      createdAt: admin.firestore.Timestamp.now(),
    });

    return {
      success: true,
      message: `成功刪除 ${deleteResult.successCount} 個用戶`,
      successCount: deleteResult.successCount,
      failureCount: deleteResult.failureCount,
      errors: deleteResult.errors?.map(e => ({ uid: e.index, error: e.error.message })) || [],
    };
  } catch (error) {
    console.error('Delete orphan users error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ==========================================
// 🛍️ UA 商城系統
// ==========================================

/**
 * getStoreItems - 取得商城商品列表
 *
 * @returns {Promise<{success: boolean, items: Array}>}
 */
exports.getStoreItems = functions.https.onCall(async (_data, context) => {
  // 需要登入才能查看商城
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  try {
    // 取得上架中的商品，按排序順序
    const itemsSnapshot = await db.collection('redeemableItems')
      .where('isActive', '==', true)
      .orderBy('sortOrder', 'asc')
      .get();

    const items = itemsSnapshot.docs.map(doc => {
      const data = doc.data();
      // 計算剩餘庫存
      const remaining = data.stock === -1 ? -1 : Math.max(0, data.stock - (data.stockUsed || 0));

      return {
        id: doc.id,
        name: data.name,
        description: data.description || '',
        image: data.image || '',
        category: data.category || 'merchandise',
        pointsCost: data.pointsCost || 0,
        stock: data.stock,
        stockUsed: data.stockUsed || 0,
        remaining,
        maxPerUser: data.maxPerUser || -1,
        requiresShipping: data.requiresShipping || false,
        isFeatured: data.isFeatured || false,
        autoAction: data.autoAction || null,
      };
    });

    return {
      success: true,
      items,
    };
  } catch (error) {
    console.error('getStoreItems error:', error);
    throw new functions.https.HttpsError('internal', '載入商品失敗');
  }
});

/**
 * getUserOrders - 取得用戶的兌換訂單
 *
 * @returns {Promise<{success: boolean, orders: Array}>}
 */
exports.getUserOrders = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  const uid = context.auth.uid;

  try {
    const ordersSnapshot = await db.collection('redemptionOrders')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const orders = ordersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        orderNumber: data.orderNumber || doc.id.substring(0, 8).toUpperCase(),
        itemId: data.itemId,
        itemName: data.itemName,
        itemImage: data.itemImage || '',
        variant: data.variant || null,
        pointsCost: data.pointsCost || data.pointsSpent || 0,
        status: data.status || 'pending',
        trackingNumber: data.trackingNumber || null,
        createdAt: data.createdAt?.toDate?.() || null,
        completedAt: data.completedAt?.toDate?.() || null,
      };
    });

    return {
      success: true,
      orders,
    };
  } catch (error) {
    console.error('getUserOrders error:', error);
    throw new functions.https.HttpsError('internal', '載入訂單失敗');
  }
});

/**
 * redeemStoreItem - 兌換商城商品（完整版）
 *
 * @param {string} itemId - 商品 ID
 * @param {string} variant - 規格選項（如尺寸）
 * @param {object} shippingInfo - 收件資訊（實體商品必填）
 * @returns {Promise<{success: boolean, orderNumber: string, message: string}>}
 */
exports.redeemStoreItem = functions.https.onCall(async (data, context) => {
  // 1. 驗證登入
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  const uid = context.auth.uid;
  const { itemId, variant, shippingInfo } = data;

  if (!itemId) {
    throw new functions.https.HttpsError('invalid-argument', '缺少商品 ID');
  }

  try {
    // 2. 取得商品資料
    const itemRef = db.collection('redeemableItems').doc(itemId);
    const itemDoc = await itemRef.get();

    if (!itemDoc.exists) {
      throw new functions.https.HttpsError('not-found', '商品不存在');
    }

    const item = itemDoc.data();

    if (!item.isActive) {
      throw new functions.https.HttpsError('failed-precondition', '商品已下架');
    }

    // 3. 檢查庫存
    const remaining = item.stock === -1 ? Infinity : Math.max(0, item.stock - (item.stockUsed || 0));
    if (remaining <= 0) {
      throw new functions.https.HttpsError('resource-exhausted', '商品已售罄');
    }

    // 4. 取得用戶資料並檢查點數
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', '用戶不存在');
    }

    const userData = userDoc.data();
    const currentPoints = typeof userData.points === 'object'
      ? (userData.points?.current || 0)
      : (userData.points || 0);

    if (currentPoints < item.pointsCost) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `點數不足，需要 ${item.pointsCost} UA，目前僅有 ${currentPoints} UA`
      );
    }

    // 5. 檢查每人限購
    if (item.maxPerUser > 0) {
      const userOrdersSnapshot = await db.collection('redemptionOrders')
        .where('userId', '==', uid)
        .where('itemId', '==', itemId)
        .where('status', 'in', ['pending', 'processing', 'shipped', 'completed'])
        .get();

      if (userOrdersSnapshot.size >= item.maxPerUser) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          `此商品每人限兌換 ${item.maxPerUser} 次，您已達上限`
        );
      }
    }

    // 6. 實體商品檢查收件資訊
    if (item.requiresShipping) {
      if (!shippingInfo || !shippingInfo.name || !shippingInfo.phone || !shippingInfo.address) {
        throw new functions.https.HttpsError('invalid-argument', '請填寫完整收件資訊');
      }
    }

    // 7. 執行兌換交易
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const newPoints = currentPoints - item.pointsCost;
    const now = admin.firestore.Timestamp.now();

    // 判斷是否為虛擬商品（訂閱延長）
    const isSubscription = item.category === 'subscription';
    const autoStatus = isSubscription ? 'completed' : 'pending';

    await db.runTransaction(async (transaction) => {
      // 扣除點數
      transaction.update(userRef, {
        'points.current': newPoints,
        totalPointsSpent: admin.firestore.FieldValue.increment(item.pointsCost),
        updatedAt: now,
      });

      // 扣除庫存
      if (item.stock !== -1) {
        transaction.update(itemRef, {
          stockUsed: admin.firestore.FieldValue.increment(1),
          updatedAt: now,
        });
      }

      // 建立訂單
      const orderRef = db.collection('redemptionOrders').doc();
      transaction.set(orderRef, {
        orderNumber,
        userId: uid,
        userEmail: userData.email || '',
        userName: userData.displayName || '',
        itemId,
        itemName: item.name,
        itemImage: item.image || '',
        category: item.category || 'merchandise',
        variant: variant || null,
        pointsCost: item.pointsCost,
        shippingInfo: item.requiresShipping ? shippingInfo : null,
        status: autoStatus,
        createdAt: now,
        updatedAt: now,
        completedAt: isSubscription ? now : null,
      });

      // 記錄點數帳本
      const ledgerRef = db.collection('pointsLedger').doc();
      transaction.set(ledgerRef, {
        userId: uid,
        userEmail: userData.email || '',
        type: 'spend',
        amount: -item.pointsCost,
        balanceBefore: currentPoints,
        balanceAfter: newPoints,
        reason: `兌換商品：${item.name}${variant ? ` (${variant})` : ''}`,
        orderId: orderRef.id,
        createdAt: now,
      });

      // 虛擬商品：執行自動動作
      if (isSubscription && item.autoAction?.days) {
        const daysToAdd = item.autoAction.days;
        const currentDays = userData.daysRemaining || 0;
        const newDays = currentDays + daysToAdd;

        // 如果是過期/寬限/試用狀態，升級為付費
        let newTierId = userData.primaryTierId;
        if (['expired', 'grace', 'trial', 'referral_trial'].includes(newTierId)) {
          newTierId = 'paid';
        }

        transaction.update(userRef, {
          daysRemaining: newDays,
          primaryTierId: newTierId,
          graceDaysRemaining: 0,
        });
      }
    });

    console.log(`Store redeem success: ${uid} redeemed ${item.name} for ${item.pointsCost} UA`);

    return {
      success: true,
      orderNumber,
      message: isSubscription ? '🎉 兌換成功！訂閱已自動延長' : '🎉 兌換成功！',
      isVirtual: isSubscription,
    };
  } catch (error) {
    if (error.code) {
      throw error; // 重新拋出已知錯誤
    }
    console.error('redeemStoreItem error:', error);
    throw new functions.https.HttpsError('internal', '兌換失敗，請稍後再試');
  }
});

/**
 * updateOrderStatus - 更新訂單狀態（管理員專用）
 *
 * @param {string} orderId - 訂單 ID
 * @param {string} status - 新狀態
 * @param {string} trackingNumber - 物流追蹤號（選填）
 * @param {string} adminNote - 備註（選填）
 */
exports.updateOrderStatus = functions.https.onCall(async (data, context) => {
  // 驗證管理員權限（使用 Firestore admins collection）
  await verifyAdminAccess(context);

  const { orderId, status, trackingNumber, adminNote } = data;

  if (!orderId || !status) {
    throw new functions.https.HttpsError('invalid-argument', '缺少必要參數');
  }

  const validStatuses = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', '無效的訂單狀態');
  }

  try {
    const orderRef = db.collection('redemptionOrders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      throw new functions.https.HttpsError('not-found', '訂單不存在');
    }

    const now = admin.firestore.Timestamp.now();
    const updateData = {
      status,
      updatedAt: now,
    };

    if (trackingNumber !== undefined) {
      updateData.trackingNumber = trackingNumber;
    }

    if (adminNote !== undefined) {
      updateData.adminNote = adminNote;
    }

    if (status === 'completed') {
      updateData.completedAt = now;
    }

    await orderRef.update(updateData);

    // 記錄審計日誌
    await db.collection('auditLogs').add({
      adminId: context.auth.uid,
      adminEmail: userEmail,
      action: 'order.updateStatus',
      targetType: 'order',
      targetId: orderId,
      changes: {
        before: { status: orderDoc.data().status },
        after: { status, trackingNumber, adminNote },
        description: `更新訂單 ${orderId} 狀態為 ${status}`,
      },
      createdAt: now,
    });

    return {
      success: true,
      message: '訂單狀態已更新',
    };
  } catch (error) {
    if (error.code) {
      throw error;
    }
    console.error('updateOrderStatus error:', error);
    throw new functions.https.HttpsError('internal', '更新失敗');
  }
});

// ==========================================
// Blog SEO Prerender（為社交媒體爬蟲提供動態 meta tags）
// ==========================================

// 文章資料對照表（簡化版，僅供 OG meta 使用）
const blogArticles = {
  'mortgage-principal-vs-equal-payment': { title: '房貸還款方式比較：本金均攤 vs 本息均攤', category: 'mortgage', description: '詳細比較本金均攤與本息均攤的利息差異、月付金變化、適合對象。' },
  'retirement-planning-basics': { title: '退休規劃入門：勞保勞退年金怎麼算？', category: 'retirement', description: '台灣勞保、勞退年金詳細解說。計算您的退休金缺口，規劃充足的退休生活。' },
  'estate-tax-planning-2026': { title: '2026 遺產稅節稅完整攻略', category: 'tax', description: '2026年最新遺產稅免稅額1,333萬元。完整說明遺產稅計算方式、扣除額項目、累進稅率。' },
  'compound-interest-power': { title: '複利的威力：25歲開始投資 vs 35歲', category: 'investment', description: '愛因斯坦說複利是世界第八大奇蹟。實際計算差距超過1000萬！' },
  'how-to-use-mortgage-calculator': { title: '傲創計算機完整教學', category: 'tools', description: '3分鐘學會使用傲創計算機。免費試算本金均攤、本息均攤等進階功能。' },
  'gift-tax-annual-exemption': { title: '2026 贈與稅免稅額完整攻略', category: 'tax', description: '2026年贈與稅免稅額244萬元。教您善用夫妻合計488萬免稅額度。' },
  'credit-card-installment-2026': { title: '2026 信用卡分期零利率完整比較表', category: 'tools', description: '2026 年最新 14 家銀行信用卡分期零利率優惠比較。' },
  'labor-insurance-pension-2026': { title: '2026 勞保勞退新制完整攻略', category: 'retirement', description: '2026 年勞保法定退休年齡正式調至 65 歲，基本工資調漲至 29,500 元。' },
  'estate-gift-tax-quick-reference-2026': { title: '2026 遺產稅贈與稅免稅額速查表', category: 'tax', description: '2026 年遺產稅免稅額 1,333 萬、贈與稅免稅額 244 萬，完整整理稅率表。' },
  'property-tax-self-use-residence-2026': { title: '2026 房屋稅地價稅自用住宅攻略', category: 'tax', description: '2026 年房屋稅 2.0 全國單一自住稅率降至 1%，地價稅自用住宅 2‰ 優惠稅率。' },
  'bank-deposit-rates-comparison-2026': { title: '2026 台幣定存利率銀行比較表', category: 'investment', description: '2026 年 1 月最新台幣定存利率比較，最高 1.81%。' },
  'nhi-supplementary-premium-2026': { title: '2026 健保補充保費完整攻略', category: 'tax', description: '健保補充保費費率 2.11%，單筆超過 2 萬就要扣。完整說明六大課徵項目。' },
  'savings-insurance-vs-deposit-2026': { title: '2026 儲蓄險 vs 定存完整比較', category: 'investment', description: '用白話文解釋 IRR 內部報酬率、優缺點比較，幫你判斷什麼情況下儲蓄險比定存划算。' },
  'mortgage-refinance-cost-2026': { title: '2026 房貸轉貸成本試算', category: 'mortgage', description: '房貸轉貸成本約 2.5～3 萬元，利差要多少才划算？' },
  'income-tax-brackets-2026': { title: '2026 所得稅級距與扣除額速查表', category: 'tax', description: '2026 年報稅免稅額 10.1 萬、標準扣除額 13.6 萬、薪資扣除額 22.7 萬。' },
  'high-dividend-etf-calendar-2026': { title: '2026 台股高股息 ETF 配息月曆', category: 'investment', description: '0056、00878、00919 配息時間、殖利率、選股邏輯分析，教你月月領息。' },
  'digital-deposit-vs-insurance-value-2026': { title: '數位存款是什麼？銀行現金 vs 保單價值 vs 投資帳戶', category: 'investment', description: '同樣 100 萬，放銀行、放保單、放投資帳戶結果差很多！一篇搞懂數位存款概念。' },
  'reverse-mortgage-vs-professional-planning-2026': { title: '以房養老該去銀行辦嗎？專業規劃比直接貸款更重要', category: 'retirement', description: '以房養老直接去銀行辦？小心長壽風險讓你老後沒保障！找專業財務顧問規劃，搭配足額壽險才是正解。' },
  'career-change-finance-insurance-salary-2026': { title: '年後轉職潮來了！如何挑選行業？金融保險業薪資到底有多高？', category: 'sales', description: '2026 最新數據：金融保險業平均月薪 82,000 元穩居各行業之首！年後轉職該如何挑選行業？完整分析優缺點。' },
  'social-media-marketing-financial-advisor-2026': { title: '社群媒體經營對財務顧問有多重要？2026 最新數據告訴你', category: 'sales', description: '75% 高資產客戶透過社群認識顧問！2026 最新數據揭密：社群媒體經營已成為財務顧問必備技能，不做社群等於放棄一半客戶。' },
  'financial-advisor-survival-2026': { title: '2026 年財務顧問如何不被淘汰？持續學習 + 善用工具是關鍵', category: 'sales', description: '金融業變化越來越快，AI 工具崛起、客戶要求提高、市場競爭加劇。2026 年，財務顧問該怎麼做才能不被淘汰？' },
  'mindset-financial-advisor-2026': { title: '心態，決定你在這行能走多遠', category: 'sales', description: '技巧可以學，話術可以練，但心態不對，一切都是白搭。為什麼有人做三個月就陣亡，有人卻能做十年以上？' },
  'note-taking-financial-advisor-2026': { title: '為什麼頂尖顧問都在做筆記？', category: 'sales', description: '聽了很多課、看了很多書，但為什麼還是覺得沒進步？因為你只有「學」，沒有「習」。筆記，就是把學變成習的關鍵。' },
  'cash-flow-rich-poor-2026': { title: '窮人、中產、富人的現金流差在哪？一張圖看懂', category: 'investment', description: '同樣在工作賺錢，為什麼有人越來越窮、有人原地踏步、有人越來越有錢？差別不在收入多少，而在錢流向哪裡。' },
  'esbi-cashflow-quadrant-2026': { title: 'ESBI 現金流象限：你在哪個位置？', category: 'investment', description: '羅伯特乙崎的 ESBI 象限，四種人的現金流結構完全不同。你是 E、S、B 還是 I？' },
  'client-procrastination-cost-2026': { title: '客戶說「再考慮看看」？拖延的代價超乎想像', category: 'sales', description: '財務決策的拖延，代價是精神、財富、時間的三重損失。如何幫客戶察覺、修正、改善？' },
  'income-tax-amt-guide-2026': { title: '2026 綜所稅＋最低稅負制完整攻略', category: 'tax', description: '2026 年報稅必看！綜所稅級距、免稅額、扣除額，加上最低稅負制（基本稅額）完整說明。' },
  'allianz-global-income-growth-suspended-2026': { title: '安聯收益成長被買爆！暫停申購要緊嗎？', category: 'investment', description: '安聯全球收益成長基金暫停新申購，不是出問題，是太熱門！已持有的人權益完全不受影響。' },
};

// 分類對應的 OG 圖片
const categoryOgImages = {
  mortgage: 'og-mortgage.png',
  retirement: 'og-retirement.png',
  tax: 'og-tax.png',
  investment: 'og-investment.png',
  tools: 'og-tools.png',
  sales: 'og-sales.png',
};

// 爬蟲 User-Agent 檢測
const crawlerUserAgents = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'LinkedInBot',
  'WhatsApp',
  'Slackbot',
  'TelegramBot',
  'Line',
  'LineBot',
  'line-poker',  // LINE URL Preview
  'Googlebot',
  'bingbot',
  'Discordbot',
  'applebot',
  'PinterestBot',
];

function isCrawler(userAgent) {
  if (!userAgent) return false;
  return crawlerUserAgents.some(crawler => userAgent.toLowerCase().includes(crawler.toLowerCase()));
}

/**
 * 部落格 SEO 預渲染
 * 為社交媒體爬蟲返回帶有正確 meta tags 的 HTML
 */
exports.blogSeo = functions.https.onRequest(async (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const path = req.path;

  // 解析 slug
  const match = path.match(/^\/blog\/([^/]+)\/?$/);
  if (!match) {
    // 不是文章頁面，返回 index.html
    res.redirect('/');
    return;
  }

  const slug = match[1];
  const article = blogArticles[slug];

  // 如果不是爬蟲，從 Firebase Hosting 的備用網址取得 index.html
  if (!isCrawler(userAgent)) {
    try {
      // 使用 Firebase Hosting 的 .web.app 網址（不會觸發 rewrite）
      const response = await axios.get('https://grbt-f87fa.web.app/index.html', {
        timeout: 5000,
      });
      res.set('Content-Type', 'text/html');
      res.set('Cache-Control', 'no-cache');
      res.send(response.data);
      return;
    } catch (error) {
      console.error('Error fetching index.html:', error.message);
      // 失敗時使用 JavaScript redirect
      res.set('Content-Type', 'text/html');
      res.send(`<!DOCTYPE html>
<html><head>
<meta http-equiv="refresh" content="0; url=https://grbt-f87fa.web.app/blog/${slug}">
</head><body></body></html>`);
      return;
    }
  }

  // 如果是爬蟲但文章不存在，使用預設值
  const finalArticle = article || {
    title: 'Ultra Advisor 理財知識庫',
    category: 'tools',
    description: '專業財務顧問工具與理財知識，幫助您做出更好的財務決策。',
  };

  // 為爬蟲返回完整的 meta tags
  const ogImage = categoryOgImages[finalArticle.category] || 'og-image.png';
  const fullUrl = `https://ultra-advisor.tw/blog/${slug}`;

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${finalArticle.title} | Ultra Advisor</title>
  <meta name="description" content="${finalArticle.description}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${fullUrl}">
  <meta property="og:title" content="${finalArticle.title}">
  <meta property="og:description" content="${finalArticle.description}">
  <meta property="og:image" content="https://ultra-advisor.tw/${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="zh_TW">
  <meta property="og:site_name" content="Ultra Advisor">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${fullUrl}">
  <meta name="twitter:title" content="${finalArticle.title}">
  <meta name="twitter:description" content="${finalArticle.description}">
  <meta name="twitter:image" content="https://ultra-advisor.tw/${ogImage}">

  <link rel="canonical" href="${fullUrl}">
</head>
<body>
  <h1>${finalArticle.title}</h1>
  <p>${finalArticle.description}</p>
  <p><a href="${fullUrl}">閱讀完整文章</a></p>
</body>
</html>`;

  res.set('Content-Type', 'text/html');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(html);
});

// ==========================================
// 🖼️ 圖片代理 API（繞過 CORS 限制）
// 用於限時動態功能載入 Firebase Storage 頭貼
// ==========================================
exports.imageProxy = functions.https.onRequest(async (req, res) => {
  // CORS 設定
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin) || origin?.includes('localhost')) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const imageUrl = req.query.url;

  if (!imageUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }

  // 只允許 Firebase Storage 的圖片
  if (!imageUrl.includes('firebasestorage.googleapis.com') &&
      !imageUrl.includes('googleusercontent.com')) {
    res.status(403).send('Only Firebase Storage images are allowed');
    return;
  }

  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });

    // 設定正確的 Content-Type
    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400'); // 快取 1 天
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('Image proxy error:', error.message);
    res.status(500).send('Failed to fetch image');
  }
});

// ==========================================
// 📬 新申請通知（Firestore 觸發器）
// 當有新預約或合作申請時，發送 LINE 通知給管理員
// ==========================================

// 管理員 LINE 用戶 ID（可透過 firebase functions:config:set admin.line_user_id="YOUR_LINE_USER_ID" 設定）
const ADMIN_LINE_USER_ID = functions.config().admin?.line_user_id;

// 需求分類對照表
const NEED_CATEGORY_LABELS = {
  mortgage: '房貸規劃',
  retirement: '退休規劃',
  insurance: '保險檢視',
  tax: '稅務傳承',
  investment: '投資理財',
  other: '其他諮詢',
};

// 店家類型對照表
const STORE_TYPE_LABELS = {
  cafe: '咖啡廳',
  restaurant: '餐廳',
  'business-center': '商務中心',
  gym: '健身房',
  beauty: '美容美髮',
  other: '其他',
};

/**
 * 🔔 新預約諮詢通知
 * 當 bookingRequests 有新文件建立時觸發
 */
exports.onNewBookingRequest = functions.firestore
  .document('bookingRequests/{docId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const docId = context.params.docId;

    console.log(`📬 新預約諮詢: ${docId}`, { name: data.name, phone: data.phone });

    // 如果沒有設定管理員 LINE ID，只記錄 log
    if (!ADMIN_LINE_USER_ID) {
      console.log('⚠️ 未設定 admin.line_user_id，跳過 LINE 通知');
      return null;
    }

    // 準備通知訊息
    const needLabel = NEED_CATEGORY_LABELS[data.needCategory] || data.needCategory || '未指定';
    const familyCount = data.familyMemberCount || data.familyMembers?.length || 0;
    const createdTime = data.createdAt?.toDate?.()?.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) || '剛剛';

    const message = `📋 新預約諮詢！

👤 姓名：${data.name}
📞 電話：${data.phone}
📧 Email：${data.email || '-'}
💼 職業：${data.occupation || '-'}

📌 需求類型：${needLabel}
👨‍👩‍👧‍👦 家庭成員：${familyCount} 人
🕐 方便時間：${data.preferredTime || '未指定'}

⏰ 提交時間：${createdTime}

➡️ 前往後台查看：
https://admin.ultra-advisor.tw/admin/applications`;

    try {
      await sendLineMessage(ADMIN_LINE_USER_ID, [{ type: 'text', text: message }]);
      console.log('✅ LINE 通知已發送');
    } catch (error) {
      console.error('❌ LINE 通知發送失敗:', error);
    }

    return null;
  });

/**
 * 🔔 新合作申請通知
 * 當 partnerApplications 有新文件建立時觸發
 */
exports.onNewPartnerApplication = functions.firestore
  .document('partnerApplications/{docId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const docId = context.params.docId;

    console.log(`📬 新合作申請: ${docId}`, { storeName: data.storeName, contact: data.contactName });

    // 如果沒有設定管理員 LINE ID，只記錄 log
    if (!ADMIN_LINE_USER_ID) {
      console.log('⚠️ 未設定 admin.line_user_id，跳過 LINE 通知');
      return null;
    }

    // 準備通知訊息
    const storeTypeLabel = STORE_TYPE_LABELS[data.storeType] || data.storeType || '未指定';
    const cooperations = data.cooperationInterests?.join('、') || '-';
    const createdTime = data.createdAt?.toDate?.()?.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) || '剛剛';

    const message = `🤝 新合作申請！

🏪 店家名稱：${data.storeName}
📍 類型：${storeTypeLabel}
📍 地區：${data.district || '-'}
📍 地址：${data.address || '-'}

👤 聯絡人：${data.contactName}
📞 電話：${data.contactPhone}
📧 Email：${data.contactEmail || '-'}

✨ 合作項目：${cooperations}
🎁 提供優惠：${data.discountOffer || '-'}

⏰ 提交時間：${createdTime}

➡️ 前往後台查看：
https://admin.ultra-advisor.tw/admin/applications`;

    try {
      await sendLineMessage(ADMIN_LINE_USER_ID, [{ type: 'text', text: message }]);
      console.log('✅ LINE 通知已發送');
    } catch (error) {
      console.error('❌ LINE 通知發送失敗:', error);
    }

    return null;
  });

// ==========================================
// 🔔 推播通知系統 - FCM
// ==========================================

/**
 * 當 siteContent/notifications 被更新時，發送推播給所有訂閱用戶
 * 只有新增的通知（enabled: true）會觸發推播
 */
exports.onNotificationUpdate = functions
  .region('asia-east1')
  .firestore
  .document('siteContent/notifications')
  .onWrite(async (change, context) => {
    console.log('📢 Notifications document changed');

    // 取得更新前後的資料
    const beforeData = change.before.exists ? change.before.data() : null;
    const afterData = change.after.exists ? change.after.data() : null;

    if (!afterData || !afterData.items) {
      console.log('No notification items found');
      return null;
    }

    // 找出新增的通知（比對 ID）
    const beforeIds = beforeData?.items?.map(n => n.id) || [];
    const newNotifications = afterData.items.filter(n =>
      n.enabled !== false && !beforeIds.includes(n.id)
    );

    if (newNotifications.length === 0) {
      console.log('No new enabled notifications to push');
      return null;
    }

    console.log(`📢 Found ${newNotifications.length} new notifications to push`);

    // 取得所有啟用的 FCM tokens
    const tokensSnapshot = await db.collection('fcmTokens')
      .where('enabled', '==', true)
      .get();

    if (tokensSnapshot.empty) {
      console.log('No FCM tokens found');
      return null;
    }

    const tokens = [];
    tokensSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.token) {
        tokens.push({ uid: doc.id, token: data.token });
      }
    });

    console.log(`📱 Sending push to ${tokens.length} devices`);

    // 發送推播
    const messaging = admin.messaging();
    const sendPromises = [];

    for (const notification of newNotifications) {
      const payload = {
        notification: {
          title: notification.title || 'Ultra Advisor 通知',
          body: notification.content?.substring(0, 100) || '',
        },
        data: {
          notificationId: notification.id,
          url: '/',
          priority: String(notification.priority || 50),
        },
        webpush: {
          fcmOptions: {
            link: 'https://ultra-advisor.tw/',
          },
          notification: {
            icon: 'https://ultra-advisor.tw/logo.png',
            badge: 'https://ultra-advisor.tw/logo.png',
            requireInteraction: false,
          },
        },
      };

      // 批量發送給所有設備
      for (const { uid, token } of tokens) {
        sendPromises.push(
          messaging.send({ ...payload, token })
            .then(() => {
              console.log(`✅ Push sent to ${uid}`);
              return { success: true, uid };
            })
            .catch(async (error) => {
              console.error(`❌ Push failed for ${uid}:`, error.code);

              // 如果 token 失效，標記為 disabled
              if (error.code === 'messaging/registration-token-not-registered' ||
                  error.code === 'messaging/invalid-registration-token') {
                await db.collection('fcmTokens').doc(uid).update({
                  enabled: false,
                  error: error.code,
                  errorAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                console.log(`🗑️ Disabled invalid token for ${uid}`);
              }

              return { success: false, uid, error: error.code };
            })
        );
      }
    }

    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`📊 Push results: ${successCount} success, ${failCount} failed`);

    return { successCount, failCount };
  });

/**
 * 手動發送推播通知（管理員專用）
 * 用於測試或發送自訂通知
 */
exports.sendPushNotification = functions
  .region('asia-east1')
  .https.onCall(async (data, context) => {
    // 驗證管理員身分
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '請先登入');
    }

    // 檢查是否為管理員
    const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', '權限不足');
    }

    const { title, body, url, targetUids } = data;

    if (!title) {
      throw new functions.https.HttpsError('invalid-argument', '標題不可為空');
    }

    // 取得目標 tokens
    let tokensQuery = db.collection('fcmTokens').where('enabled', '==', true);

    // 如果指定了目標用戶
    if (targetUids && Array.isArray(targetUids) && targetUids.length > 0) {
      // Firestore 的 in 查詢最多支援 10 個值
      const chunks = [];
      for (let i = 0; i < targetUids.length; i += 10) {
        chunks.push(targetUids.slice(i, i + 10));
      }

      const allTokens = [];
      for (const chunk of chunks) {
        const snapshot = await db.collection('fcmTokens')
          .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
          .where('enabled', '==', true)
          .get();

        snapshot.forEach(doc => {
          allTokens.push({ uid: doc.id, token: doc.data().token });
        });
      }

      return await sendPushToTokens(allTokens, title, body, url);
    }

    // 發送給所有用戶
    const tokensSnapshot = await tokensQuery.get();
    const tokens = [];
    tokensSnapshot.forEach(doc => {
      if (doc.data().token) {
        tokens.push({ uid: doc.id, token: doc.data().token });
      }
    });

    return await sendPushToTokens(tokens, title, body, url);
  });

/**
 * 輔助函數：發送推播給指定的 tokens
 */
async function sendPushToTokens(tokens, title, body, url) {
  if (tokens.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const messaging = admin.messaging();
  const payload = {
    notification: { title, body: body || '' },
    data: { url: url || '/' },
    webpush: {
      fcmOptions: { link: url || 'https://ultra-advisor.tw/' },
      notification: {
        icon: 'https://ultra-advisor.tw/logo.png',
        badge: 'https://ultra-advisor.tw/logo.png',
      },
    },
  };

  const results = await Promise.all(
    tokens.map(({ uid, token }) =>
      messaging.send({ ...payload, token })
        .then(() => ({ success: true, uid }))
        .catch(error => ({ success: false, uid, error: error.code }))
    )
  );

  const sent = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`📊 Manual push: ${sent} sent, ${failed} failed`);

  return { success: true, sent, failed };
}

// ==========================================
// 📰 新文章推播通知
// ==========================================

/**
 * 發送新文章推播通知（管理員專用）
 *
 * @param {string} articleSlug - 文章 slug（用於組成 URL）
 * @param {string} articleTitle - 文章標題
 * @param {string} articleSummary - 文章摘要（選填）
 */
exports.sendNewArticleNotification = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    // 驗證管理員權限
    await verifyAdminAccess(context);

    const { articleSlug, articleTitle, articleSummary } = data;

    if (!articleSlug || !articleTitle) {
      throw new functions.https.HttpsError('invalid-argument', '缺少文章 slug 或標題');
    }

    const articleUrl = `https://ultra-advisor.tw/blog/${articleSlug}`;
    const title = '📚 新文章上線';
    const body = articleTitle + (articleSummary ? `\n${articleSummary}` : '');

    // 取得所有啟用推播的用戶 tokens
    const tokensSnapshot = await db.collection('fcmTokens')
      .where('enabled', '==', true)
      .get();

    const tokens = [];
    tokensSnapshot.forEach(doc => {
      if (doc.data().token) {
        tokens.push({ uid: doc.id, token: doc.data().token });
      }
    });

    if (tokens.length === 0) {
      return { success: true, sent: 0, failed: 0, message: '沒有可通知的用戶' };
    }

    const messaging = admin.messaging();
    const payload = {
      notification: {
        title,
        body,
      },
      data: {
        type: 'new_article',
        url: articleUrl,
        articleSlug,
        articleTitle,
      },
      webpush: {
        fcmOptions: { link: articleUrl },
        notification: {
          icon: 'https://ultra-advisor.tw/logo.png',
          badge: 'https://ultra-advisor.tw/logo.png',
          tag: `article-${articleSlug}`,
          requireInteraction: true,
          actions: [
            { action: 'read', title: '閱讀文章' },
            { action: 'dismiss', title: '稍後再看' },
          ],
        },
      },
    };

    const results = await Promise.all(
      tokens.map(({ uid, token }) =>
        messaging.send({ ...payload, token })
          .then(() => ({ success: true, uid }))
          .catch(async (error) => {
            // 清理無效 token
            if (error.code === 'messaging/registration-token-not-registered' ||
                error.code === 'messaging/invalid-registration-token') {
              await db.collection('fcmTokens').doc(uid).update({
                enabled: false,
                disabledAt: admin.firestore.Timestamp.now(),
                disabledReason: error.code,
              });
            }
            return { success: false, uid, error: error.code };
          })
      )
    );

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    // 記錄推播歷史
    await db.collection('pushNotificationLogs').add({
      type: 'new_article',
      articleSlug,
      articleTitle,
      totalRecipients: tokens.length,
      sent,
      failed,
      sentBy: context.auth.uid,
      createdAt: admin.firestore.Timestamp.now(),
    });

    console.log(`📰 New article push: "${articleTitle}" - ${sent} sent, ${failed} failed`);

    return {
      success: true,
      sent,
      failed,
      message: `已發送給 ${sent} 位用戶`,
    };
  });

// ==========================================
// 🆕 保單健診系統 - OCR 辨識
// ==========================================

exports.processInsuranceOCR = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https.onCall(async (data, context) => {
  // 1. 身份驗證
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  const { imageBase64, storagePath } = data;

  // 支援兩種模式：base64 直傳 或 Storage 路徑
  if (!imageBase64 && !storagePath) {
    throw new functions.https.HttpsError('invalid-argument', '缺少圖片資料');
  }

  const userId = context.auth.uid;

  // 若用 storagePath，需安全檢查
  if (storagePath && !storagePath.startsWith(`insurance-policies/${userId}/`)) {
    throw new functions.https.HttpsError('permission-denied', '無權存取此檔案');
  }

  try {
    const vision = require('@google-cloud/vision');
    const client = new vision.ImageAnnotatorClient();

    let fullText = '';

    if (imageBase64) {
      // 模式 A：直接用 base64 圖片
      // 移除 data URL 前綴 (data:image/jpeg;base64,...)
      const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      console.log(`🔍 OCR 辨識開始 (base64, ${Math.round(imageBuffer.length / 1024)}KB)`);

      const [result] = await client.textDetection({
        image: { content: imageBuffer },
      });
      fullText = result.fullTextAnnotation?.text || '';
    } else {
      // 模式 B：從 Storage 讀取
      const bucket = admin.storage().bucket();
      const gcsUri = `gs://${bucket.name}/${storagePath}`;

      console.log(`🔍 OCR 辨識開始: ${storagePath}`);

      if (storagePath.toLowerCase().endsWith('.pdf')) {
        const [result] = await client.documentTextDetection(gcsUri);
        fullText = result.fullTextAnnotation?.text || '';
      } else {
        const [result] = await client.textDetection(gcsUri);
        fullText = result.fullTextAnnotation?.text || '';
      }
    }

    console.log(`✅ OCR 完成，擷取 ${fullText.length} 字元`);
    // 印出原始文字以便除錯（截斷到 500 字元）
    console.log(`📄 OCR 原始文字: ${fullText.substring(0, 500)}`);

    return {
      success: true,
      rawText: fullText,
      extractedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ OCR 辨識失敗:', error.message);
    throw new functions.https.HttpsError('internal', `OCR 辨識失敗: ${error.message}`);
  }
});

// ==========================================
// 保單健診系統 — Gemini AI 解析 & 險種快取
// ==========================================

const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * parseInsuranceOCR — Gemini Vision 直接辨識保單圖片
 * 輸入：{ imageBase64, mimeType, imageUrl, familyMemberId }
 * 支援兩種模式：
 *   1. imageBase64 + mimeType：前端直接傳 base64（推薦）
 *   2. imageUrl：從 Storage URL 下載後再傳給 Gemini
 * 輸出：{ policy: Partial<PolicyInfo> }
 */
exports.parseInsuranceOCR = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '請先登入');
    }

    const { imageBase64, mimeType, imageUrl, familyMemberId } = data;
    if (!imageBase64 && !imageUrl) {
      throw new functions.https.HttpsError('invalid-argument', '缺少圖片資料');
    }

    try {
      const geminiApiKey = functions.config().gemini?.api_key;
      if (!geminiApiKey) {
        throw new Error('Gemini API key 未設定，請執行 firebase functions:config:set gemini.api_key="YOUR_KEY"');
      }

      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      // 準備圖片資料
      let imgBase64 = imageBase64;
      let imgMimeType = mimeType || 'image/jpeg';

      if (!imgBase64 && imageUrl) {
        // 從 URL 下載圖片轉 base64
        const axios = require('axios');
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
        imgBase64 = Buffer.from(response.data).toString('base64');
        imgMimeType = response.headers['content-type'] || 'image/jpeg';
      }

      if (!imgBase64) {
        throw new Error('無法取得圖片資料');
      }

      // HEIC/HEIF 格式轉換為 JPEG（iPhone 預設格式，Gemini 不支援）
      if (imgMimeType === 'image/heic' || imgMimeType === 'image/heif') {
        console.log('📷 偵測到 HEIC/HEIF 格式，轉換 mimeType 為 image/jpeg');
        imgMimeType = 'image/jpeg';
      }

      console.log(`📷 parseInsuranceOCR: 圖片大小 ${(imgBase64.length / 1024).toFixed(0)} KB, 類型 ${imgMimeType}`);

      // Gemini Vision 直接辨識圖片 + 結構化解析（一步到位）
      const prompt = `你是台灣保險專家。請辨識這張保單圖片中的所有文字，並解析為以下 JSON 格式。

請回傳純 JSON（不要 markdown 程式碼區塊）：

{
  "insurer": "保險公司名稱",
  "policyNumber": "保單號碼",
  "applicant": "要保人姓名",
  "applicantBirthDate": "要保人出生日期 YYYY-MM-DD 或民國格式如 65/12/23",
  "applicantAgeAtIssue": 要保人投保年齡（數字），
  "applicantGender": "要保人性別 male 或 female",
  "insured": "被保險人姓名",
  "insuredBirthDate": "被保險人出生日期 YYYY-MM-DD 或民國格式如 87/05/10",
  "insuredAgeAtIssue": 被保險人投保年齡（數字），
  "insuredGender": "被保險人性別 male 或 female",
  "effectiveDate": "YYYY-MM-DD",
  "totalAnnualPremium": 數字,
  "paymentFrequency": "年繳/半年繳/季繳/月繳/躉繳",
  "currency": "TWD/USD/其他",
  "coverages": [
    {
      "name": "險種名稱",
      "code": "險種代碼（如有）",
      "sumInsured": 保額數字,
      "annualPremium": 保費數字,
      "paymentYears": 繳費年期,
      "coverageYears": 保障年期,
      "isLifetime": 是否終身布林值,
      "isRider": 是否為附約布林值
    }
  ]
}

注意：
- 第一筆通常是主約（isRider: false），後面是附約（isRider: true）
- 金額請用數字，不要帶逗號或「萬」
- 日期格式 YYYY-MM-DD（民國年請保留原始格式如 65/12/23）
- 如果有些欄位看不出來，請填 null
- 幣別預設 TWD
- 如果圖片模糊看不清，盡量辨識能看到的部分
- 性別若無法直接判斷，可以從姓名或稱謂推測（先生/女士）
- 保單面頁常見「投保年齡」欄位，請務必抓取 applicantAgeAtIssue 和 insuredAgeAtIssue`;

      const imagePart = {
        inlineData: {
          data: imgBase64,
          mimeType: imgMimeType,
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const responseText = result.response.text();
      console.log(`🤖 Gemini 回應長度: ${responseText.length}`);

      // 提取 JSON（支援有或沒有 markdown code block）
      let jsonStr = responseText;
      const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      } else {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseErr) {
        console.error('❌ JSON 解析失敗:', jsonStr.substring(0, 200));
        throw new Error('AI 回傳格式錯誤，請重新拍照');
      }

      // 補上 familyMemberId
      parsed.familyMemberId = familyMemberId;
      parsed.inputMethod = 'ocr';

      // 為每個 coverage 補 id
      if (parsed.coverages) {
        parsed.coverages = parsed.coverages.map((c, i) => ({
          ...c,
          id: `ocr-${Date.now()}-${i}`,
          isRider: c.isRider !== false && i > 0,
        }));
      }

      console.log(`✅ Gemini 保單解析完成：${parsed.insurer || '未知'} / ${parsed.coverages?.length || 0} 個險種`);

      return { policy: parsed };
    } catch (error) {
      console.error('❌ parseInsuranceOCR 錯誤:', error.message);
      throw new functions.https.HttpsError('internal', `保單解析失敗: ${error.message}`);
    }
  });

/**
 * lookupInsuranceProduct — 搜尋險種條款 + Gemini 摘要
 * 輸入：{ insurer, productName }
 * 輸出：{ product: ProductCache, claimSummary }
 */
exports.lookupInsuranceProduct = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '請先登入');
    }

    const { insurer, productName } = data;
    if (!productName) {
      throw new functions.https.HttpsError('invalid-argument', '缺少 productName');
    }

    try {
      // 先查快取
      const cacheQuery = await db.collection('productCache')
        .where('insurer', '==', insurer || '')
        .where('productName', '==', productName)
        .limit(1)
        .get();

      if (!cacheQuery.empty) {
        const cached = cacheQuery.docs[0].data();
        // 更新搜尋次數
        await cacheQuery.docs[0].ref.update({
          searchCount: admin.firestore.FieldValue.increment(1),
          lastSearched: new Date().toISOString(),
        });
        console.log(`✅ 快取命中：${insurer} - ${productName}`);
        return { product: { id: cacheQuery.docs[0].id, ...cached }, claimSummary: cached.claimSummary };
      }

      // 快取未命中 → Gemini AI 生成摘要
      const geminiApiKey = functions.config().gemini?.api_key;
      if (!geminiApiKey) {
        throw new Error('Gemini API key 未設定');
      }

      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = `你是台灣保險條款分析專家。請根據你的知識，分析以下保險商品並回傳 JSON 格式。

保險公司：${insurer || '未知'}
商品名稱：${productName}

重要：你只需要回傳「險種分類」和「保障特性」，不要猜測具體金額（因為金額依投保內容而定）。

請回傳以下 JSON 格式（只回傳 JSON，不要其他文字）：

{
  "category": "險種分類，選擇一個：life_term/life_whole/medical_expense/medical_daily/surgery/critical_illness/major_injury/cancer/accident/accident_medical/disability/long_term_care/waiver/annuity/investment/other",
  "status": "selling",
  "waitingPeriod": 等待期天數（如30、90，無則填0）,
  "isCopyReceipt": 是否接受副本理賠（true/false，若不確定填 null）,
  "isGuaranteedRenewal": 是否保證續保（true/false，若不確定填 null）,
  "claimConditions": "簡述理賠條件，50字內",
  "coverageFeatures": ["此險種的保障特色，如：住院雜費、門診手術、骨折未住院、意外身故等"],
  "claimSummary": {},
  "keywords": ["相關關鍵字"]
}

險種分類說明：
- medical_expense：實支實付（住院雜費、手術費等限額給付）
- medical_daily：住院日額（按住院天數給付）
- surgery：手術險（按手術等級表給付）
- accident：意外險（意外身故、失能保障，不含醫療）
- accident_medical：意外醫療（意外實支、意外住院日額、骨折未住院）
- critical_illness：重大疾病（一次金給付）
- cancer：癌症險
- waiver：豁免附約
- life_term/life_whole：壽險

注意：
1. claimSummary 留空物件 {}，實際金額由保單資料提供
2. coverageFeatures 填寫此險種「通常包含」的保障項目
3. 如果是「傷害醫療」類，通常包含：意外實支、意外住院日額、骨折未住院
4. 如果是純「傷害保險」（不含醫療），只有意外身故和失能，沒有醫療給付`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      let productData = {};
      if (jsonMatch) {
        productData = JSON.parse(jsonMatch[0]);
      }

      // 儲存到快取
      const cacheDoc = {
        insurer: insurer || '',
        productName,
        productCode: '',
        category: productData.category || 'other',
        keywords: productData.keywords || [productName],
        searchCount: 1,
        lastSearched: new Date().toISOString(),
        status: productData.status || 'selling',
        claimSummary: productData.claimSummary || {},
        rawDescription: responseText.substring(0, 2000),
        lastUpdated: new Date().toISOString(),
        updatedBy: 'ai',
      };

      const docRef = await db.collection('productCache').add(cacheDoc);
      console.log(`✅ 新增快取：${insurer} - ${productName} (${docRef.id})`);

      return {
        product: { id: docRef.id, ...cacheDoc },
        claimSummary: cacheDoc.claimSummary,
      };
    } catch (error) {
      console.error('❌ lookupInsuranceProduct 錯誤:', error.message);
      throw new functions.https.HttpsError('internal', `險種查詢失敗: ${error.message}`);
    }
  });

/**
 * searchProductCache — 險種名稱自動完成查詢
 * 輸入：{ keyword }
 * 輸出：{ products: ProductCache[] }
 */
exports.searchProductCache = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  const { keyword } = data;
  if (!keyword || keyword.length < 2) {
    return { products: [] };
  }

  try {
    // Firestore 不支援 LIKE 查詢，使用前綴比對
    const snapshot = await db.collection('productCache')
      .where('productName', '>=', keyword)
      .where('productName', '<=', keyword + '\uf8ff')
      .orderBy('productName')
      .limit(10)
      .get();

    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 也搜尋 keywords 陣列
    if (products.length < 10) {
      const keywordSnapshot = await db.collection('productCache')
        .where('keywords', 'array-contains', keyword)
        .limit(10 - products.length)
        .get();

      const existingIds = new Set(products.map(p => p.id));
      keywordSnapshot.docs.forEach(doc => {
        if (!existingIds.has(doc.id)) {
          products.push({ id: doc.id, ...doc.data() });
        }
      });
    }

    return { products };
  } catch (error) {
    console.error('❌ searchProductCache 錯誤:', error.message);
    return { products: [] };
  }
});

// ==========================================
// [已移除] Threads 功能已遷移至 MindThread.tw
// exchangeThreadsToken + threadsScheduledPublish 已於 2026-03-13 移除
// ==========================================

// [Threads 功能已於 2026-03-13 移除，遷移至 MindThread.tw]
// 原 exchangeThreadsToken + threadsScheduledPublish 已刪除


// ==========================================
// 🤖 AI Financial Insight Engine — 通用 AI 分析引擎
// 支援：房貸分析、保障建議（未來擴充更多工具）
// 公開可用（不需登入），以 IP 限流
// ==========================================

exports.generateFinancialInsight = functions
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data, context) => {
    const { type, payload } = data;
    if (!type || !payload) {
      throw new functions.https.HttpsError('invalid-argument', '缺少分析類型或資料');
    }

    // --- Rate limiting ---
    const uid = context.auth?.uid;
    const ip = context.rawRequest?.ip || context.rawRequest?.headers?.['x-forwarded-for'] || 'unknown';
    const rateLimitKey = uid || ip.replace(/[^a-zA-Z0-9]/g, '_');
    const today = new Date().toISOString().split('T')[0];
    const rateLimitRef = db.collection('rateLimits').doc(`insight_${rateLimitKey}_${today}`);

    try {
      const rlDoc = await rateLimitRef.get();
      const currentCount = rlDoc.exists ? (rlDoc.data().count || 0) : 0;
      const dailyLimit = uid ? 30 : 10; // 登入用戶 30 次，匿名 10 次

      if (currentCount >= dailyLimit) {
        throw new functions.https.HttpsError('resource-exhausted', '今日 AI 分析次數已達上限，請明天再試');
      }

      await rateLimitRef.set({
        count: currentCount + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      if (err.code === 'resource-exhausted') throw err;
      console.warn('⚠️ Rate limit check failed, proceeding:', err.message);
    }

    // --- Build prompt ---
    let prompt = '';

    if (type === 'mortgage') {
      const { loanAmount, annualRate, loanTerm, method, monthlyPayment, totalInterest, totalPayment, interestRatio } = payload;
      prompt = `你是台灣的房貸分析專家。根據以下房貸條件，提供精準的財務分析洞察。

貸款條件：
- 貸款金額：${loanAmount} 萬元（${loanAmount * 10000} 元）
- 年利率：${annualRate}%
- 貸款年限：${loanTerm} 年（${loanTerm * 12} 期）
- 還款方式：${method === 'equal_payment' ? '本息均攤' : '本金均攤'}

計算結果：
- 每月還款：${Math.round(monthlyPayment).toLocaleString()} 元
- 累計利息：${Math.round(totalInterest).toLocaleString()} 元
- 總還款金額：${Math.round(totalPayment).toLocaleString()} 元
- 利息佔比：${interestRatio.toFixed(1)}%

請提供以下分析（用 markdown 格式）：

### 📊 整體評估
一句話點評這筆房貸。

### 💰 利息成本解讀
利息佔比是高是低？與台灣 2026 年市場平均水準比較。

### ⚡ 省息方案
如果每月多還 5,000 元，預估可省下多少利息、提前幾年還清？（用近似計算即可）

### 🎯 具體建議
給一個最實用的行動建議。

要求：
- 繁體中文，語氣像朋友給建議
- 用數字說話，給具體金額
- 總字數 200-300 字
- 不要有推銷語氣`;
    } else if (type === 'insurance') {
      const { memberName, age, annualIncome, gaps, totalPolicies, totalPremium, premiumRatio, coverageScore } = payload;
      prompt = `你是台灣的保險規劃分析專家。根據以下保障現況，提供個人化的保障分析報告。

客戶基本資料：
- 姓名：${memberName || '客戶'}
- 年齡：${age || '未提供'} 歲
- 年收入：${annualIncome ? annualIncome.toLocaleString() : '未提供'} 元

保障現況：
- 持有保單：${totalPolicies} 張
- 年繳總保費：${totalPremium ? totalPremium.toLocaleString() : 0} 元
- 保費佔收入比：${premiumRatio ? premiumRatio.toFixed(1) : 0}%
- 保障分數：${coverageScore}/100

保障缺口：
${gaps && gaps.length > 0 ? gaps.map(g => `- [${g.severity === 'critical' ? '嚴重不足' : '略有不足'}] ${g.category}：${g.description}`).join('\n') : '- 無明顯缺口'}

請提供以下分析（用 markdown 格式）：

### 📊 保障總評
一句話總結保障現況。

### ⚠️ 優先處理
最需要優先補強的 1-2 個項目，說明原因和建議保額。

### 💡 保費優化
保費是否合理？有無重複或可調整的空間？

### 🎯 行動建議
下一步最該做什麼？

要求：
- 繁體中文，語氣專業但親切
- 具體到金額和險種方向
- 總字數 200-300 字
- 客觀中立，不推銷任何產品`;
    } else {
      throw new functions.https.HttpsError('invalid-argument', `不支援的分析類型: ${type}`);
    }

    // --- Call Gemini ---
    try {
      const geminiApiKey = functions.config().gemini?.api_key;
      if (!geminiApiKey) {
        throw new Error('Gemini API key 未設定');
      }

      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      const insight = result.response.text();

      console.log(`✅ AI Insight (${type}): ${insight.length} chars`);

      // 記錄分析使用量
      try {
        await db.collection('aiInsightLogs').add({
          type,
          uid: uid || null,
          charCount: insight.length,
          createdAt: admin.firestore.Timestamp.now(),
        });
      } catch (logErr) {
        // 紀錄失敗不影響主流程
      }

      return { insight };
    } catch (error) {
      console.error(`❌ generateFinancialInsight (${type}):`, error.message);
      throw new functions.https.HttpsError('internal', `AI 分析失敗: ${error.message}`);
    }
  });

// ==========================================
// 每日市場 AI 報告（排程 + 手動觸發）
// 台股盤後 14:00 自動抓取市場數據 → Gemini 產出摘要 → 存 Firestore → FCM 推播
// ==========================================

// 手動觸發版本（用於測試 & 補跑）
exports.generateDailyMarketReport = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data, context) => {
    // 僅限管理員觸發
    if (context.auth) {
      const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
      if (!adminDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', '僅限管理員');
      }
    }

    const targetDate = data?.date || new Date().toISOString().split('T')[0];
    return await _generateMarketReport(targetDate);
  });

// 排程版本：盤後 — 每天台股收盤後 14:30 (UTC+8 = UTC 06:30)
exports.scheduledMarketReport = functions.pubsub
  .schedule('30 6 * * 1-5')  // 週一到週五 UTC 06:30 = 台灣 14:30
  .timeZone('UTC')
  .onRun(async () => {
    const today = _getTaiwanDate();
    console.log(`📊 盤後排程觸發: ${today}`);
    await _generateMarketReport(today, 'post');
    return null;
  });

// 取得台灣時區日期 YYYY-MM-DD
function _getTaiwanDate() {
  const now = new Date();
  const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return tw.toISOString().split('T')[0];
}

// 核心邏輯：抓數據 → Gemini 分析 → 存 Firestore → 推播
// type: 'pre' = 盤前, 'post' = 盤後
async function _generateMarketReport(date, type = 'post') {
  const docId = type === 'pre' ? `${date}-pre` : date;
  const label = type === 'pre' ? '盤前' : '盤後';
  console.log(`📊 開始產出${label}市場報告: ${docId}`);

  // 1. 檢查是否已產出過（避免重複）
  const reportRef = db.collection('dailyMarketReports').doc(docId);
  const existing = await reportRef.get();
  if (existing.exists) {
    console.log(`⏭️ ${docId} 報告已存在，跳過`);
    return { status: 'already_exists', date: docId };
  }

  // 2. 抓取市場數據（Yahoo Finance）
  let marketData;
  try {
    const symbols = ['^TWII', 'TWD=X', '^GSPC', '^TNX', '^DJI', '^IXIC', '0050.TW'];
    const responses = await Promise.allSettled(
      symbols.map(symbol =>
        axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`, {
          params: { interval: '1d', range: '2d' },
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 10000,
        })
      )
    );

    marketData = {};
    const nameMap = {
      '^TWII': { key: 'twii', name: '台股加權指數' },
      'TWD=X': { key: 'usdtwd', name: '美元/台幣' },
      '^GSPC': { key: 'sp500', name: 'S&P 500' },
      '^TNX': { key: 'us10y', name: '美國 10 年期公債殖利率' },
      '^DJI': { key: 'dji', name: '道瓊工業指數' },
      '^IXIC': { key: 'nasdaq', name: 'NASDAQ' },
      '0050.TW': { key: 'etf0050', name: '元大台灣 50 ETF' },
    };

    symbols.forEach((symbol, i) => {
      const res = responses[i];
      if (res.status === 'fulfilled' && res.value?.data?.chart?.result?.[0]) {
        const result = res.value.data.chart.result[0];
        const meta = result.meta;
        const prev = meta.chartPreviousClose || meta.previousClose;
        const curr = meta.regularMarketPrice;
        const change = curr - prev;
        const changePercent = prev ? ((change / prev) * 100) : 0;

        const info = nameMap[symbol];
        marketData[info.key] = {
          name: info.name,
          symbol,
          price: parseFloat(curr?.toFixed(2)),
          change: parseFloat(change?.toFixed(2)),
          changePercent: parseFloat(changePercent?.toFixed(2)),
          previousClose: parseFloat(prev?.toFixed(2)),
        };
      } else {
        const info = nameMap[symbol];
        console.warn(`⚠️ ${info.name} 數據抓取失敗`);
      }
    });

    console.log(`✅ 市場數據抓取完成: ${Object.keys(marketData).length} 個指標`);
  } catch (err) {
    console.error('❌ 市場數據抓取失敗:', err.message);
    throw new functions.https.HttpsError('internal', '市場數據抓取失敗');
  }

  // 3. Gemini AI 分析（盤前/盤後用不同 prompt）
  let aiSummary;
  try {
    const geminiApiKey = functions.config().gemini?.api_key;
    if (!geminiApiKey) throw new Error('Gemini API key 未設定');

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const dataStr = Object.values(marketData).map(d =>
      `${d.name}(${d.symbol}): ${d.price} (${d.change >= 0 ? '+' : ''}${d.change}, ${d.change >= 0 ? '+' : ''}${d.changePercent}%)`
    ).join('\n');

    const prompt = type === 'pre'
      ? `你是專業的台灣市場分析師。根據最新數據，產出一份簡潔的盤前市場快訊，幫助投資人在開盤前掌握國際動態。

最新市場數據（含昨日美股收盤 + 台股前一交易日）：
${dataStr}

請產出以下格式的 JSON（不要 markdown code block，直接回傳 JSON）：

{
  "headline": "10-15字的一句話標題，例如：美股全面收紅 台股開盤看多",
  "summary": "50-80字摘要，聚焦昨夜美股表現、匯率變化，以及對今日台股開盤的影響",
  "keyPoints": [
    "重點1：20-30字",
    "重點2：20-30字",
    "重點3：20-30字"
  ],
  "outlook": "20-30字的今日台股開盤展望",
  "sentiment": "bullish 或 bearish 或 neutral"
}

要求：繁體中文、客觀中立、不做投資建議、語氣專業簡潔、數據要準確引用`
      : `你是專業的台灣市場分析師。根據今日（${date}）收盤數據，產出一份簡潔的盤後市場快訊。

今日收盤數據：
${dataStr}

請產出以下格式的 JSON（不要 markdown code block，直接回傳 JSON）：

{
  "headline": "10-15字的一句話標題，例如：台股量縮反彈 站穩月線",
  "summary": "50-80字的市場重點摘要，提及主要指數表現和關鍵趨勢",
  "keyPoints": [
    "重點1：20-30字",
    "重點2：20-30字",
    "重點3：20-30字"
  ],
  "outlook": "20-30字的明日展望或注意事項",
  "sentiment": "bullish 或 bearish 或 neutral"
}

要求：繁體中文、客觀中立、不做投資建議、語氣專業簡潔、數據要準確引用`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    // 清理可能的 markdown code block
    const cleanJson = responseText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    aiSummary = JSON.parse(cleanJson);
    console.log(`✅ AI 摘要產出: ${aiSummary.headline}`);
  } catch (err) {
    console.error('❌ AI 摘要產出失敗:', err.message);
    // AI 失敗時用基本摘要（根據實際漲跌幅判斷 sentiment）
    const twii = marketData.twii;
    const sp = marketData.sp500;

    // 根據主要指數漲跌幅自動判斷 sentiment
    const autoSentiment = (refData) => {
      if (!refData) return 'neutral';
      const pct = refData.changePercent;
      if (pct >= 0.5) return 'bullish';
      if (pct <= -0.5) return 'bearish';
      return 'neutral';
    };

    // 根據數據生成有意義的 outlook
    const autoOutlook = (type, twiiData, spData) => {
      if (type === 'pre') {
        if (!spData) return '關注國際動態對台股開盤影響。';
        const pct = spData.changePercent;
        if (pct >= 1) return `美股強勢收漲，台股今日開盤偏多看待。`;
        if (pct <= -1) return `美股重挫，台股今日開盤恐有壓力。`;
        if (pct >= 0.3) return `美股小幅走高，台股今日開盤有撐。`;
        if (pct <= -0.3) return `美股偏弱，台股今日開盤留意賣壓。`;
        return `美股平盤整理，台股今日開盤觀望氣氛濃。`;
      } else {
        if (!twiiData) return '關注明日市場動態。';
        const pct = twiiData.changePercent;
        const pts = Math.abs(twiiData.change).toFixed(0);
        if (pct >= 1) return `台股大漲${pts}點，短線留意追高風險。`;
        if (pct <= -1) return `台股重挫${pts}點，留意是否出現止穩訊號。`;
        if (pct >= 0.3) return `台股溫和上漲，關注成交量能否配合。`;
        if (pct <= -0.3) return `台股小幅修正，觀察支撐是否有效。`;
        return `台股窄幅整理，靜待方向選擇。`;
      }
    };

    const primaryRef = type === 'pre' ? sp : twii;

    if (type === 'pre') {
      aiSummary = {
        headline: sp ? `美股${sp.change >= 0 ? '收漲' : '收跌'} 台股開盤關注` : '盤前市場數據',
        summary: '昨夜美股及國際市場數據已更新，請查看各指數表現。',
        keyPoints: Object.values(marketData).filter(d => ['sp500', 'dji', 'nasdaq', 'usdtwd'].includes(Object.keys(marketData).find(k => marketData[k] === d))).slice(0, 3).map(d =>
          `${d.name} ${d.price} (${d.change >= 0 ? '+' : ''}${d.changePercent}%)`
        ),
        outlook: autoOutlook('pre', twii, sp),
        sentiment: autoSentiment(primaryRef),
      };
    } else {
      aiSummary = {
        headline: twii ? `台股 ${twii.change >= 0 ? '收漲' : '收跌'} ${Math.abs(twii.change).toFixed(0)} 點` : '今日市場數據',
        summary: '今日市場數據已更新，請查看各指數表現。',
        keyPoints: Object.values(marketData).slice(0, 3).map(d =>
          `${d.name} ${d.price} (${d.change >= 0 ? '+' : ''}${d.changePercent}%)`
        ),
        outlook: autoOutlook('post', twii, sp),
        sentiment: autoSentiment(primaryRef),
      };
    }
  }

  // 4. 存入 Firestore
  const reportData = {
    date,
    type, // 'pre' or 'post'
    marketData,
    aiSummary,
    createdAt: admin.firestore.Timestamp.now(),
    source: 'yahoo-finance + gemini-2.0-flash',
  };

  await reportRef.set(reportData);
  console.log(`✅ ${label}報告已存入 Firestore: dailyMarketReports/${docId}`);

  // 5. FCM 推播給所有有開啟通知的會員
  try {
    const tokensSnapshot = await db.collection('fcmTokens')
      .where('enabled', '==', true)
      .get();

    if (!tokensSnapshot.empty) {
      const messaging = admin.messaging();
      const tokens = [];
      tokensSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.token) tokens.push({ uid: doc.id, token: data.token });
      });

      const twii = marketData.twii;
      const notifTitle = type === 'pre'
        ? `🌅 盤前快訊｜${aiSummary.headline}`
        : `📊 盤後快訊｜${aiSummary.headline}`;
      const notifBody = twii
        ? `加權 ${twii.price.toLocaleString()} (${twii.change >= 0 ? '+' : ''}${twii.changePercent}%) | ${aiSummary.keyPoints?.[0] || ''}`
        : aiSummary.summary;

      let successCount = 0;
      const sendPromises = tokens.map(async ({ uid, token }) => {
        try {
          await messaging.send({
            token,
            notification: { title: notifTitle, body: notifBody },
            webpush: {
              fcmOptions: { link: 'https://ultra-advisor.tw' },
              notification: { icon: '/logo.png', badge: '/logo.png' },
            },
          });
          successCount++;
        } catch (err) {
          if (err.code === 'messaging/registration-token-not-registered' ||
              err.code === 'messaging/invalid-registration-token') {
            await db.collection('fcmTokens').doc(uid).update({ enabled: false });
          }
        }
      });

      await Promise.allSettled(sendPromises);
      console.log(`✅ FCM 推播完成: ${successCount}/${tokens.length} 成功`);
    }
  } catch (pushErr) {
    console.error('⚠️ FCM 推播失敗（不影響報告）:', pushErr.message);
  }

  return { status: 'success', date: docId, headline: aiSummary.headline };
}

console.log('Ultra Advisor Cloud Functions loaded');