/**
 * Ultra Advisor - 公開註冊頁面
 * 任何人都可以直接註冊試用會員
 *
 * 檔案位置：src/pages/RegisterPage.tsx
 */

import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff, Gift, User, Mail, Lock, ArrowLeft, Sparkles, MessageCircle } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

import { toast } from '../utils/toast';
import { safeStorage } from '../utils/safeStorage';
import { trackEvent, identify } from '../lib/analytics';
import { EVENTS } from '../lib/events';
import { getUtmAttribution } from '../lib/utm';
interface RegisterPageProps {
  onSuccess?: () => void;
  onBack?: () => void;
  onLogin?: () => void;
}

// Cloud Function API 端點
const API_ENDPOINT = 'https://us-central1-grbt-f87fa.cloudfunctions.net/liffRegister';

// reCAPTCHA v3 Site Key
const RECAPTCHA_SITE_KEY = '6LdpoU4sAAAAAKu2HkuSIfBSPF7w2Ukoqk8QX2z-';

// 宣告 grecaptcha 全域變數
declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

// Ultra Advisor LOGO 元件
const UltraLogo: React.FC<{ size?: number }> = ({ size = 60 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="60 20 200 380"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="regGradBlue" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4DA3FF" />
          <stop offset="100%" stopColor="#2E6BFF" />
        </linearGradient>
        <linearGradient id="regGradRed" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FF6A6A" />
          <stop offset="100%" stopColor="#FF3A3A" />
        </linearGradient>
        <linearGradient id="regGradPurple" gradientUnits="userSpaceOnUse" x1="91.5" y1="0" x2="228.5" y2="0">
          <stop offset="0%" stopColor="#8A5CFF" stopOpacity="0" />
          <stop offset="20%" stopColor="#CE4DFF" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#E8E0FF" stopOpacity="1" />
          <stop offset="80%" stopColor="#CE4DFF" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#8A5CFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Blue Curve (U Left / A Right Leg) */}
      <path
        fill="none"
        stroke="url(#regGradBlue)"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M 90,40 C 90,160 130,220 242,380"
        style={{ filter: 'drop-shadow(0 0 6px rgba(46, 107, 255, 0.7))' }}
      />

      {/* Red Curve (U Right / A Left Leg) */}
      <path
        fill="none"
        stroke="url(#regGradRed)"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M 230,40 C 230,160 190,220 78,380"
        style={{ filter: 'drop-shadow(0 0 6px rgba(255, 58, 58, 0.7))' }}
      />

      {/* Purple Line (Crossbar) */}
      <path
        fill="none"
        stroke="url(#regGradPurple)"
        strokeWidth="10"
        strokeLinecap="round"
        d="M 91.5,314 L 228.5,314"
      />
    </svg>
  );
};

export default function RegisterPage({ onSuccess, onBack, onLogin }: RegisterPageProps) {
  // 狀態管理
  const [step, setStep] = useState<'form' | 'success' | 'error'>('form');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 表單資料
  // lineDisplayName 是顧問識別用（顯示在客戶看到的卡片署名），LINE 沒提供 API 查驗、留 optional
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    referralCode: '',
    lineDisplayName: ''
  });

  // 合規勾選（兩個皆需勾選才能送出）
  // version 跟版本綁定，後端 audit 用 — 改條款內容時要 bump 並重新要勾
  const CONSENT_VERSION = '2026-06-24';
  const [consentTos, setConsentTos] = useState(false);
  const [consentResponsibility, setConsentResponsibility] = useState(false);
  const consentsOk = consentTos && consentResponsibility;

  // 表單錯誤
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 自動登入狀態
  const [autoLoginDone, setAutoLoginDone] = useState(false);
  const [autoLoginError, setAutoLoginError] = useState('');

  // 註冊成功資料
  const [successData, setSuccessData] = useState<{
    displayName: string;
    email: string;
    trialExpireDate: string;
    referralCode: string;
    points: number;
  } | null>(null);

  // 漏斗事件：到達註冊頁（有 UTM/referrer 時帶上，方便 PostHog 拆來源）
  useEffect(() => {
    const attribution = getUtmAttribution();
    trackEvent(EVENTS.REGISTER_START, attribution ? { ...attribution } : undefined);
  }, []);

  // SEO: 更新頁面標題和 Meta
  useEffect(() => {
    const seoConfig = {
      title: '免費註冊 | Ultra Advisor - AI 智能理財分析平台',
      description: '免費試用 Ultra Advisor 7 天！14 種視覺化工具：房貸計算機、退休規劃、稅務傳承、資產配置。無需信用卡，立即開始。',
      url: 'https://ultra-advisor.tw/register'
    };

    // 更新頁面標題
    document.title = seoConfig.title;

    // 更新 meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.setAttribute('content', seoConfig.description);

    // 更新 Open Graph
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogTitle) ogTitle.setAttribute('content', seoConfig.title);
    if (ogDescription) ogDescription.setAttribute('content', seoConfig.description);
    if (ogUrl) ogUrl.setAttribute('content', seoConfig.url);

    // 更新 canonical
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', seoConfig.url);

    return () => {
      document.title = 'Ultra Advisor - 專業財務視覺化解決方案';
    };
  }, []);

  // 表單驗證
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // 姓名驗證
    if (!formData.name.trim()) {
      newErrors.name = '請輸入您的稱呼';
    }

    // Email 驗證
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = '請輸入 Email';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Email 格式不正確';
    }

    // 密碼驗證
    if (!formData.password) {
      newErrors.password = '請設定密碼';
    } else if (formData.password.length < 6) {
      newErrors.password = '密碼至少需要 6 個字元';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 取得 reCAPTCHA token
  const getRecaptchaToken = async (): Promise<string | null> => {
    try {
      if (window.grecaptcha) {
        return new Promise((resolve) => {
          window.grecaptcha.ready(async () => {
            try {
              const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'register' });
              resolve(token);
            } catch (err) {
              console.error('reCAPTCHA execute error:', err);
              resolve(null);
            }
          });
        });
      }
      return null;
    } catch (err) {
      console.error('reCAPTCHA error:', err);
      return null;
    }
  };

  // 提交註冊
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting || !validateForm()) return;

    // 雙重保險：button disabled 已擋一次、但 form submit 也可能被 Enter 鍵或外部觸發
    // 沒勾合規 checkbox 直接 return（不彈 toast，UI 已視覺提示）
    if (!consentsOk) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      // 🔒 取得 reCAPTCHA token
      const recaptchaToken = await getRecaptchaToken();

      // 首次造訪時記下來的 UTM / referrer，跟 user doc 一起存（first-touch attribution）
      const acquisition = getUtmAttribution();

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          referralCode: formData.referralCode.trim().toUpperCase() || null,
          // 網頁註冊不帶 lineUserId（沒走 LIFF），只帶顧問自填的 displayName 當識別
          lineUserId: null,
          lineDisplayName: formData.lineDisplayName.trim() || null,
          linePictureUrl: null,
          // 🔒 reCAPTCHA token
          recaptchaToken,
          // 取得來源（null 代表 direct/internal，後端可選擇忽略）
          acquisition,
          // 合規勾選證據 — version 標記、submit 時 client 時戳；
          // 後端 createUserAccount 預期把 consentVersion 寫進 user doc、
          // 並以 serverTimestamp() 作為 consentAt 寫入（client 時戳僅供 audit 對照）
          consentVersion: CONSENT_VERSION,
          consentSubmittedAt: new Date().toISOString()
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccessData(result.data);
        setStep('success');

        // 漏斗事件：註冊完成（uid 在 auth callback 才有，先帶 email hash-ish 標記）
        // acquisition 整包帶上 — PostHog 可拆 utm_source/medium/campaign 做漏斗 breakdown
        trackEvent(EVENTS.REGISTER_SUCCESS, {
          has_referral: !!formData.referralCode.trim(),
          has_acquisition: !!acquisition,
          acquisition: acquisition || null,
        });

        // 自動登入：用剛註冊的帳密直接登入
        try {
          await signInWithEmailAndPassword(
            auth,
            formData.email.trim().toLowerCase(),
            formData.password
          );
          // 記住帳號（預設開啟）
          safeStorage.set('ua_saved_email', formData.email.trim().toLowerCase());
          safeStorage.set('ua_remember_me', 'true');
          setAutoLoginDone(true);

          // 綁定 PostHog identity，把 acquisition 寫成 person property
          if (auth.currentUser?.uid) {
            identify(auth.currentUser.uid, acquisition ? { acquisition } : undefined);
          }
        } catch (loginErr) {
          // 帳號已創成功、但自動登入這一步 race condition 失敗（極罕見：Firebase token clock drift、
          // 或網路在這 1 秒斷線）。不能讓 user 卡在「註冊成功但進不去」的 limbo，
          // 顯示 UI 提示 + toast、按鈕改成「前往登入頁面」、saved_email 已寫入讓登入頁自動填。
          console.error('自動登入失敗:', loginErr);
          setAutoLoginError('自動登入失敗，請手動登入');
          toast.error('自動登入失敗，請手動登入');
          // 還是把 email 存起來、登入頁會自動帶入（密碼 user 自己記得）
          try {
            safeStorage.set('ua_saved_email', formData.email.trim().toLowerCase());
          } catch { /* ignore */ }
        }
      } else {
        // 處理特定錯誤
        if (result.error?.includes('已經註冊') || result.error?.includes('已註冊')) {
          setErrors({ email: '此 Email 已註冊，請直接登入或使用其他 Email' });
        } else if (result.error?.includes('Email')) {
          setErrors({ email: result.error });
        } else if (result.error?.includes('頻繁') || result.error?.includes('分鐘')) {
          // Rate limit 錯誤
          setErrors({ form: result.error });
        } else {
          setErrors({ form: result.error || '註冊失敗，請稍後再試' });
        }
      }
    } catch (error: unknown) {
      console.error('註冊失敗:', error);
      console.error('錯誤類型:', typeof error);
      console.error('錯誤詳情:', JSON.stringify(error, Object.getOwnPropertyNames(error as object)));

      // 提供更詳細的錯誤訊息
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        setErrors({ form: '無法連線到伺服器，請檢查網路連線或關閉廣告阻擋器後重試' });
      } else if (error instanceof TypeError && error.message.includes('NetworkError')) {
        setErrors({ form: '網路請求被阻擋，請關閉廣告阻擋器或 VPN 後重試' });
      } else if (error instanceof Error) {
        setErrors({ form: `註冊發生錯誤：${error.message}` });
      } else {
        setErrors({ form: '網路連線異常，請稍後再試' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 前往登入
  const goToLogin = () => {
    if (onLogin) {
      onLogin();
    } else {
      window.history.pushState({}, '', '/login');
      window.location.reload();
    }
  };

  // 前往首頁
  // 註：剛註冊完並自動登入成功 → 走 firstRun 入場（?firstRun=1 觸發 App 的 onboarding effect
  //   把 activeTab 強制帶到 'overview'、seed sample clients）；同時預先 set splash_shown
  //   讓 App 跳過 3 秒 Splash 直接進 OverviewTab。
  // 其他情況（autoLoginError、user 自己按返回）→ 一般 reload，Splash 正常 3 秒（既有行為）。
  const goToHome = () => {
    if (onBack) {
      onBack();
    } else {
      // 自動登入成功才 bypass Splash + 帶 firstRun flag
      if (autoLoginDone) {
        try {
          sessionStorage.setItem('splash_shown', 'true');
        } catch { /* ignore quota */ }
        window.history.pushState({}, '', '/?firstRun=1');
      } else {
        window.history.pushState({}, '', '/');
      }
      window.location.reload();
    }
  };

  // 複製推薦碼
  const copyReferralCode = () => {
    if (successData?.referralCode) {
      navigator.clipboard.writeText(successData.referralCode);
      toast.info('推薦碼已複製！');
    }
  };

  // 錯誤畫面
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-[#050b14] flex flex-col items-center justify-center p-6">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">發生錯誤</h1>
        <p className="text-slate-400 text-center mb-6">{errorMessage}</p>
        <button
          onClick={() => setStep('form')}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold"
        >
          重試
        </button>
      </div>
    );
  }

  // 成功畫面
  if (step === 'success' && successData) {
    return (
      <div className="min-h-screen bg-[#050b14] flex flex-col items-center justify-center p-6">
        {/* 成功動畫 */}
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6 animate-bounce">
          <CheckCircle className="w-12 h-12 text-green-500" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">帳號開通成功！</h1>

        {/* 用戶資訊卡片 */}
        <div className="w-full max-w-sm bg-slate-800/50 rounded-2xl p-6 mt-6 border border-slate-700/50">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-slate-400" />
              <span className="text-white">{successData.displayName}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-slate-400" />
              <span className="text-slate-300 text-sm">{successData.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-400">📅</span>
              <span className="text-slate-300 text-sm">試用到期：{successData.trialExpireDate}</span>
            </div>
            <div className="flex items-center gap-3">
              <Gift className="w-5 h-5 text-amber-400" />
              <span className="text-amber-400 font-mono">{successData.referralCode}</span>
              <button
                onClick={copyReferralCode}
                className="ml-auto text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-700 rounded"
              >
                複製
              </button>
            </div>
            {successData.points > 0 && (
              <div className="flex items-center gap-3 text-purple-400">
                <span>🎁</span>
                <span>獲得 {successData.points} UA 點數！</span>
              </div>
            )}
          </div>
        </div>

        {/* 自動登入狀態提示 */}
        {autoLoginDone ? (
          <div className="w-full max-w-sm mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <p className="text-green-400 text-sm text-center">
              已自動登入，點擊下方按鈕直接進入系統
            </p>
          </div>
        ) : autoLoginError ? (
          <div className="w-full max-w-sm mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <p className="text-amber-400 text-sm text-center">
              {autoLoginError}
            </p>
          </div>
        ) : (
          <div className="w-full max-w-sm mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            <p className="text-blue-400 text-sm">自動登入中...</p>
          </div>
        )}

        {/* CTA 按鈕 */}
        <button
          onClick={autoLoginDone ? goToHome : goToLogin}
          className="w-full max-w-sm mt-6 py-4 bg-gradient-to-r from-[#4DA3FF] to-[#2E6BFF] text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {autoLoginDone ? (
            <>
              <Sparkles className="w-5 h-5" />
              進入戰情室
            </>
          ) : autoLoginError ? (
            '前往登入頁面'
          ) : (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              登入中...
            </>
          )}
        </button>

        {/* 分享提示 */}
        <p className="text-slate-500 text-sm mt-6 text-center">
          分享推薦碼給朋友，註冊 +100 UA，付費後雙方各得 1000 UA！
        </p>
      </div>
    );
  }

  // 註冊表單
  return (
    <div className="min-h-screen bg-[#050b14] flex flex-col">
      {/* Header */}
      <div className="pt-6 pb-4 px-6">
        {/* 返回按鈕 */}
        <button
          onClick={goToHome}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft size={20} />
          <span className="text-sm">返回首頁</span>
        </button>

        {/* Logo */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <UltraLogo size={70} />
          </div>
          <h1 className="text-xl font-bold text-white">
            <span style={{ color: '#FF3A3A' }}>Ultra</span>
            <span className="text-blue-400">Advisor</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">AI 智能理財分析平台</p>

          {/* 已有帳號？登入連結 - 放在最醒目的位置 */}
          <div className="mt-4 py-3 px-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <p className="text-slate-300 text-sm">
              已有帳號？
              <button
                type="button"
                onClick={goToLogin}
                className="ml-2 text-[#4DA3FF] font-bold hover:text-[#6db8ff] transition-colors underline underline-offset-2"
              >
                立即登入
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* 表單 */}
      <form onSubmit={handleSubmit} className="flex-1 px-6 pb-8">
        <div className="max-w-sm mx-auto space-y-5">
          {/* 全域錯誤 */}
          {errors.form && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-red-400 text-sm text-center">{errors.form}</p>
            </div>
          )}

          {/* 姓名 */}
          <div className="space-y-2 animate-[fadeInUp_0.5s_ease-out_0.1s_both]">
            <label className="flex items-center gap-2 text-slate-300 text-sm font-medium">
              <User className="w-4 h-4" />
              你的稱呼
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="例：王大明"
              className={`w-full px-4 py-4 bg-slate-800/60 border rounded-xl text-white placeholder-slate-500 text-base focus:outline-none focus:border-[#4DA3FF] focus:shadow-[0_0_20px_rgba(77,163,255,0.4)] transition-all ${
                errors.name ? 'border-red-500' : 'border-slate-700/50'
              }`}
            />
            {errors.name && <p className="text-red-400 text-xs">{errors.name}</p>}
          </div>

          {/* Email */}
          <div className="space-y-2 animate-[fadeInUp_0.5s_ease-out_0.2s_both]">
            <label className="flex items-center gap-2 text-slate-300 text-sm font-medium">
              <Mail className="w-4 h-4" />
              Email（登入帳號）
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="example@gmail.com"
              autoCapitalize="off"
              autoComplete="email"
              className={`w-full px-4 py-4 bg-slate-800/60 border rounded-xl text-white placeholder-slate-500 text-base focus:outline-none focus:border-[#4DA3FF] focus:shadow-[0_0_20px_rgba(77,163,255,0.4)] transition-all ${
                errors.email ? 'border-red-500' : 'border-slate-700/50'
              }`}
            />
            {errors.email && <p className="text-red-400 text-xs">{errors.email}</p>}
          </div>

          {/* 密碼 */}
          <div className="space-y-2 animate-[fadeInUp_0.5s_ease-out_0.3s_both]">
            <label className="flex items-center gap-2 text-slate-300 text-sm font-medium">
              <Lock className="w-4 h-4" />
              設定密碼（至少 6 碼）
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="••••••••"
                autoComplete="new-password"
                className={`w-full px-4 py-4 pr-12 bg-slate-800/60 border rounded-xl text-white placeholder-slate-500 text-base focus:outline-none focus:border-[#4DA3FF] focus:shadow-[0_0_20px_rgba(77,163,255,0.4)] transition-all ${
                  errors.password ? 'border-red-500' : 'border-slate-700/50'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="text-red-400 text-xs">{errors.password}</p>}
          </div>

          {/* 推薦碼 */}
          <div className="space-y-2 animate-[fadeInUp_0.5s_ease-out_0.4s_both]">
            <label className="flex items-center gap-2 text-slate-300 text-sm font-medium">
              <Gift className="w-4 h-4 text-amber-400" />
              推薦碼（選填）
            </label>
            <input
              type="text"
              value={formData.referralCode}
              onChange={(e) => setFormData(prev => ({ ...prev, referralCode: e.target.value.toUpperCase() }))}
              placeholder="有推薦碼可享優惠"
              autoCapitalize="characters"
              className="w-full px-4 py-4 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 text-base focus:outline-none focus:border-amber-500 focus:shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all"
            />
          </div>

          {/* LINE 顯示名稱 - 顧問識別用、不強制、無驗證 */}
          <div className="space-y-2 animate-[fadeInUp_0.5s_ease-out_0.45s_both]">
            <label className="flex items-center gap-2 text-slate-300 text-sm font-medium">
              <MessageCircle className="w-4 h-4 text-[#06C755]" />
              LINE 顯示名稱（選填）
            </label>
            <input
              type="text"
              value={formData.lineDisplayName}
              onChange={(e) => setFormData(prev => ({ ...prev, lineDisplayName: e.target.value }))}
              placeholder="客戶看到的署名，例：林經理"
              maxLength={40}
              className="w-full px-4 py-4 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 text-base focus:outline-none focus:border-[#06C755] focus:shadow-[0_0_20px_rgba(6,199,85,0.3)] transition-all"
            />
            <p className="text-slate-500 text-xs">分享試算結果給客戶時會用這個名稱署名</p>
          </div>

          {/* 合規勾選 — 兩個都要勾 button 才解鎖 */}
          {/* 不用 alert / toast：disabled state 已經明示沒勾就不能送 */}
          <div className="space-y-3 pt-2 animate-[fadeInUp_0.5s_ease-out_0.48s_both]">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={consentTos}
                onChange={(e) => setConsentTos(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#4DA3FF] focus:ring-2 focus:ring-[#4DA3FF] focus:ring-offset-0 cursor-pointer accent-[#4DA3FF]"
              />
              <span className="text-slate-400 text-xs leading-relaxed select-none">
                我已閱讀並同意{' '}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#4DA3FF] hover:text-[#6db8ff] underline underline-offset-2"
                >
                  服務條款
                </a>
                {' '}與{' '}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#4DA3FF] hover:text-[#6db8ff] underline underline-offset-2"
                >
                  隱私權政策
                </a>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={consentResponsibility}
                onChange={(e) => setConsentResponsibility(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#4DA3FF] focus:ring-2 focus:ring-[#4DA3FF] focus:ring-offset-0 cursor-pointer accent-[#4DA3FF]"
              />
              <span className="text-slate-400 text-xs leading-relaxed select-none">
                我了解本平台僅為財務規劃工具，所有建議與決策由我作為持照顧問負責
              </span>
            </label>
          </div>

          {/* 提交按鈕 */}
          <button
            type="submit"
            disabled={isSubmitting || !consentsOk}
            className="w-full py-4 mt-6 bg-gradient-to-r from-[#4DA3FF] to-[#2E6BFF] text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] animate-[fadeInUp_0.5s_ease-out_0.5s_both]"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                處理中...
              </span>
            ) : (
              '開始 7 天免費試用'
            )}
          </button>

          {/* 試用說明 */}
          <div className="pt-6 border-t border-slate-800 animate-[fadeInUp_0.5s_ease-out_0.6s_both]">
            <p className="text-slate-400 text-sm font-medium mb-3">📋 試用期間享有完整功能：</p>
            <ul className="space-y-2 text-slate-500 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                全部 14 種視覺化工具
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                無限客戶檔案
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                報表匯出功能
              </li>
            </ul>
          </div>

          {/* 已有帳號 - 底部再次提醒 */}
          <div className="text-center pt-6 pb-2">
            <div className="inline-flex items-center gap-2 py-2 px-4 bg-slate-800/30 rounded-lg border border-slate-700/30">
              <span className="text-slate-400 text-sm">已是會員？</span>
              <button
                type="button"
                onClick={goToLogin}
                className="text-[#4DA3FF] font-bold text-sm hover:text-[#6db8ff] transition-colors"
              >
                點此登入 →
              </button>
            </div>
          </div>
        </div>
      </form>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
