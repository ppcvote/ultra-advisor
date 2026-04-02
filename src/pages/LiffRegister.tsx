import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff, Gift, User, Mail, Lock } from 'lucide-react';

// LIFF SDK 類型
declare global {
  interface Window {
    liff: {
      init: (config: { liffId: string }) => Promise<void>;
      isInClient: () => boolean;
      isLoggedIn: () => boolean;
      login: () => void;
      getProfile: () => Promise<{ userId: string; displayName: string; pictureUrl?: string }>;
      closeWindow: () => void;
    };
  }
}

interface LiffRegisterProps {
  onSuccess?: () => void;
}

// Cloud Function API 端點
const API_ENDPOINT = 'https://us-central1-grbt-f87fa.cloudfunctions.net/liffRegister';

// LIFF ID（需要從 LINE Developers Console 取得後替換）
const LIFF_ID = import.meta.env.VITE_LIFF_ID || '2008863334-CiKr6VBU';

export default function LiffRegister({ onSuccess }: LiffRegisterProps) {
  // 狀態管理
  const [step, setStep] = useState<'loading' | 'form' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // LINE 用戶資料
  const [lineProfile, setLineProfile] = useState<{
    userId: string;
    displayName: string;
    pictureUrl?: string;
  } | null>(null);

  // 表單資料
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    referralCode: ''
  });

  // 表單錯誤
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 註冊成功資料
  const [successData, setSuccessData] = useState<{
    displayName: string;
    email: string;
    trialExpireDate: string;
    referralCode: string;
    points: number;
  } | null>(null);

  // 初始化 LIFF
  useEffect(() => {
    const initLiff = async () => {
      try {
        // 載入 LIFF SDK
        if (!window.liff) {
          const script = document.createElement('script');
          script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
          script.charset = 'utf-8';
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        await window.liff.init({ liffId: LIFF_ID });

        // 檢查是否在 LINE 內開啟（開發時允許瀏覽器測試）
        const isInLine = window.liff.isInClient();
        const isDev = import.meta.env.DEV;

        if (!isInLine && !isDev) {
          setErrorMessage('請從 LINE 應用程式開啟此頁面');
          setStep('error');
          return;
        }

        // 檢查登入狀態
        if (isInLine && !window.liff.isLoggedIn()) {
          window.liff.login();
          return;
        }

        // 取得用戶資料
        if (isInLine) {
          const profile = await window.liff.getProfile();
          setLineProfile(profile);
          setFormData(prev => ({ ...prev, name: profile.displayName || '' }));
        } else {
          // 開發模式：使用假資料
          setLineProfile({
            userId: 'dev-user-' + Date.now(),
            displayName: '測試用戶'
          });
          setFormData(prev => ({ ...prev, name: '測試用戶' }));
        }

        setStep('form');
      } catch (error) {
        console.error('LIFF 初始化失敗:', error);
        setErrorMessage('系統初始化失敗，請稍後再試');
        setStep('error');
      }
    };

    initLiff();
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

  // 提交註冊
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting || !validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          referralCode: formData.referralCode.trim().toUpperCase() || null,
          lineUserId: lineProfile?.userId,
          lineDisplayName: lineProfile?.displayName,
          linePictureUrl: lineProfile?.pictureUrl || null
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccessData(result.data);
        setStep('success');
      } else {
        // 處理特定錯誤
        if (result.error?.includes('Email')) {
          setErrors({ email: result.error });
        } else if (result.error?.includes('LINE')) {
          setErrors({ form: result.error });
        } else {
          setErrors({ form: result.error || '註冊失敗，請稍後再試' });
        }
      }
    } catch (error) {
      console.error('註冊失敗:', error);
      setErrors({ form: '網路連線異常，請稍後再試' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 前往主應用
  const goToApp = () => {
    if (window.liff?.isInClient()) {
      window.liff.closeWindow();
    } else {
      window.location.href = 'https://ultra-advisor.tw';
    }
    onSuccess?.();
  };

  // 複製推薦碼
  const copyReferralCode = () => {
    if (successData?.referralCode) {
      navigator.clipboard.writeText(successData.referralCode);
      alert('推薦碼已複製！');
    }
  };

  // Loading 畫面
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-[#050b14] flex flex-col items-center justify-center p-6">
        {/* Logo 動畫 */}
        <div className="mb-8">
          <svg width="80" height="80" viewBox="0 0 100 100" className="animate-pulse">
            <path
              d="M20 70 L50 20 L80 70"
              stroke="#4DA3FF"
              strokeWidth="4"
              fill="none"
              className="animate-[drawLine_0.6s_ease-out_0.2s_forwards]"
              style={{ strokeDasharray: 200, strokeDashoffset: 200 }}
            />
            <path
              d="M30 55 L50 25 L70 55"
              stroke="#FF6B6B"
              strokeWidth="4"
              fill="none"
              className="animate-[drawLine_0.6s_ease-out_0.8s_forwards]"
              style={{ strokeDasharray: 150, strokeDashoffset: 150 }}
            />
            <path
              d="M40 40 L50 30 L60 40"
              stroke="#A855F7"
              strokeWidth="4"
              fill="none"
              className="animate-[drawLine_0.6s_ease-out_1.4s_forwards]"
              style={{ strokeDasharray: 100, strokeDashoffset: 100 }}
            />
          </svg>
        </div>
        <Loader2 className="w-8 h-8 text-[#4DA3FF] animate-spin mb-4" />
        <p className="text-slate-400">載入中...</p>

        <style>{`
          @keyframes drawLine {
            to { stroke-dashoffset: 0; }
          }
        `}</style>
      </div>
    );
  }

  // 錯誤畫面
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-[#050b14] flex flex-col items-center justify-center p-6">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">無法開啟</h1>
        <p className="text-slate-400 text-center">{errorMessage}</p>
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

        <h1 className="text-2xl font-bold text-white mb-2">🎉 帳號開通成功！</h1>

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

        {/* 提醒 */}
        <div className="w-full max-w-sm mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <p className="text-amber-400 text-sm text-center">
            💡 首次登入時請修改密碼以確保安全
          </p>
        </div>

        {/* CTA 按鈕 */}
        <button
          onClick={goToApp}
          className="w-full max-w-sm mt-6 py-4 bg-gradient-to-r from-[#4DA3FF] to-[#2E6BFF] text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all active:scale-[0.98]"
        >
          🚀 立即前往系統
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
      <div className="pt-8 pb-4 px-6 text-center">
        {/* Logo */}
        <svg width="60" height="60" viewBox="0 0 100 100" className="mx-auto mb-4">
          <path d="M20 70 L50 20 L80 70" stroke="#4DA3FF" strokeWidth="4" fill="none" />
          <path d="M30 55 L50 25 L70 55" stroke="#FF6B6B" strokeWidth="4" fill="none" />
          <path d="M40 40 L50 30 L60 40" stroke="#A855F7" strokeWidth="4" fill="none" />
        </svg>
        <h1 className="text-xl font-bold text-white">Ultra Advisor</h1>
        <p className="text-slate-400 text-sm mt-1">AI 智能理財分析平台</p>
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
          <div className="space-y-2 animate-[fadeInUp_0.5s_ease-out_0.3s_both]">
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
          <div className="space-y-2 animate-[fadeInUp_0.5s_ease-out_0.4s_both]">
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
          <div className="space-y-2 animate-[fadeInUp_0.5s_ease-out_0.5s_both]">
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
          <div className="space-y-2 animate-[fadeInUp_0.5s_ease-out_0.6s_both]">
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

          {/* 提交按鈕 */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 mt-6 bg-gradient-to-r from-[#4DA3FF] to-[#2E6BFF] text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] animate-[fadeInUp_0.5s_ease-out_0.7s_both]"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                處理中...
              </span>
            ) : (
              '🚀 開始 7 天免費試用'
            )}
          </button>

          {/* 試用說明 */}
          <div className="pt-6 border-t border-slate-800 animate-[fadeInUp_0.5s_ease-out_0.8s_both]">
            <p className="text-slate-400 text-sm font-medium mb-3">📋 試用期間享有完整功能：</p>
            <ul className="space-y-2 text-slate-500 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                全部 18 種專業理財工具
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

          {/* 已有帳號 */}
          <div className="text-center pt-4">
            <a
              href="https://ultra-advisor.tw/login"
              className="text-slate-400 text-sm hover:text-[#4DA3FF] transition-colors"
            >
              已有帳號？直接登入
            </a>
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
