/**
 * Threads Token 換取助手
 *
 * 4 步驟精靈：
 * Step 1: 輸入 Meta App ID & Secret
 * Step 2: 授權 Threads（開啟 OAuth 視窗）
 * Step 3: 換取長期 Token（呼叫 Cloud Function）
 * Step 4: 完成（自動填入設定）
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, ChevronRight, ChevronLeft, Key, ExternalLink,
  Loader2, Check, AlertCircle, Copy, Shield,
} from 'lucide-react';
import { exchangeThreadsToken } from '../../utils/threadsApi';

const REDIRECT_URI = 'https://ultra-advisor.tw/api/threads/callback';

interface TokenHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: { accessToken: string; userId: string; username: string }) => void;
}

type Step = 1 | 2 | 3 | 4;

const TokenHelperModal: React.FC<TokenHelperModalProps> = ({ isOpen, onClose, onComplete }) => {
  const [step, setStep] = useState<Step>(1);

  // Step 1 fields
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');

  // Step 2 fields
  const [authCode, setAuthCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [isWaitingAuth, setIsWaitingAuth] = useState(false);

  // Step 3 fields
  const [isExchanging, setIsExchanging] = useState(false);
  const [exchangeError, setExchangeError] = useState('');

  // Step 4 result
  const [result, setResult] = useState<{
    accessToken: string;
    userId: string;
    username: string;
    expiresIn: number;
  } | null>(null);

  // 監聽 OAuth popup 回傳的 postMessage
  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type === 'threads-oauth-code') {
      setAuthCode(event.data.code);
      setAuthError('');
      setIsWaitingAuth(false);
      // 自動進入 Step 3
      setStep(3);
    } else if (event.data?.type === 'threads-oauth-error') {
      setAuthError(event.data.error || '授權失敗');
      setIsWaitingAuth(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // 重置狀態
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setAppId('');
      setAppSecret('');
      setAuthCode('');
      setAuthError('');
      setIsWaitingAuth(false);
      setIsExchanging(false);
      setExchangeError('');
      setResult(null);
    }
  }, [isOpen]);

  // Step 2: 開啟 OAuth 授權視窗
  const handleOpenAuth = () => {
    if (!appId.trim()) return;
    setIsWaitingAuth(true);
    setAuthError('');

    const scope = 'threads_basic,threads_content_publish';
    const authUrl = `https://threads.net/oauth/authorize?client_id=${encodeURIComponent(appId.trim())}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${scope}&response_type=code`;

    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    window.open(
      authUrl,
      'threads-oauth',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );
  };

  // Step 3: 換取長期 Token
  const handleExchange = async () => {
    if (!authCode || !appId.trim() || !appSecret.trim()) return;
    setIsExchanging(true);
    setExchangeError('');

    const res = await exchangeThreadsToken({
      appId: appId.trim(),
      appSecret: appSecret.trim(),
      code: authCode,
      redirectUri: REDIRECT_URI,
    });

    if (res.success && res.accessToken && res.userId) {
      setResult({
        accessToken: res.accessToken,
        userId: res.userId,
        username: res.username || '',
        expiresIn: res.expiresIn || 5184000,
      });
      setStep(4);
    } else {
      setExchangeError(res.error || 'Token 換取失敗');
    }
    setIsExchanging(false);
  };

  // Step 4: 完成，自動填入設定
  const handleComplete = () => {
    if (result) {
      onComplete({
        accessToken: result.accessToken,
        userId: result.userId,
        username: result.username,
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  // 步驟進度條
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3, 4].map((s) => (
        <React.Fragment key={s}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              s < step ? 'bg-green-500 text-white'
              : s === step ? 'bg-purple-500 text-white'
              : 'bg-slate-700 text-slate-500'
            }`}
          >
            {s < step ? <Check size={14} /> : s}
          </div>
          {s < 4 && (
            <div className={`w-8 h-0.5 ${s < step ? 'bg-green-500' : 'bg-slate-700'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[220] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h4 className="text-lg font-bold text-white flex items-center gap-2">
            <Key size={20} className="text-purple-400" />
            Token 換取助手
          </h4>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <StepIndicator />

          {/* Step 1: App Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h5 className="text-white font-bold mb-1">Step 1：輸入 Meta App 資訊</h5>
                <p className="text-xs text-slate-400 mb-4">
                  前往{' '}
                  <a
                    href="https://developers.facebook.com/apps/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    Meta for Developers <ExternalLink size={10} />
                  </a>
                  {' '}建立應用程式，取得 App ID 和 App Secret。
                </p>
              </div>

              <div>
                <label className="text-sm text-slate-400 font-bold mb-1.5 block">App ID</label>
                <input
                  type="text"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="例如：123456789012345"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white text-sm
                           focus:border-purple-500 outline-none transition-colors placeholder:text-slate-600 font-mono"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 font-bold mb-1.5 block">App Secret</label>
                <input
                  type="password"
                  value={appSecret}
                  onChange={(e) => setAppSecret(e.target.value)}
                  placeholder="例如：abcdef1234567890abcdef1234567890"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white text-sm
                           focus:border-purple-500 outline-none transition-colors placeholder:text-slate-600 font-mono"
                />
              </div>

              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <Shield size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-blue-300 leading-relaxed">
                  App Secret 僅用於本次 Token 換取，不會被儲存。換取完成後即可在 Meta 後台重設。
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Authorize */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h5 className="text-white font-bold mb-1">Step 2：授權 Threads</h5>
                <p className="text-xs text-slate-400 mb-4">
                  點擊下方按鈕，在彈出視窗中登入並授權你的 Threads 帳號。
                </p>
              </div>

              <button
                onClick={handleOpenAuth}
                disabled={isWaitingAuth}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600
                         hover:from-purple-500 hover:to-blue-500
                         disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500
                         text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {isWaitingAuth ? (
                  <><Loader2 size={18} className="animate-spin" /> 等待授權中...</>
                ) : (
                  <><ExternalLink size={18} /> 開啟 Threads 授權頁面</>
                )}
              </button>

              {isWaitingAuth && (
                <p className="text-xs text-slate-400 text-center">
                  請在彈出的視窗中完成授權，授權後此頁面會自動更新。
                </p>
              )}

              {authCode && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <Check size={14} className="text-green-400 flex-shrink-0" />
                  <p className="text-xs text-green-400 font-bold">已取得授權碼</p>
                </div>
              )}

              {authError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-400">{authError}</p>
                </div>
              )}

              {/* 手動輸入授權碼 fallback */}
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer hover:text-slate-300 transition-colors">
                  彈出視窗被擋？手動貼上授權碼
                </summary>
                <div className="mt-2 space-y-2">
                  <p className="text-slate-400">
                    如果彈出視窗被瀏覽器攔截，請手動開啟以下網址：
                  </p>
                  <div className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-[10px] text-slate-400 break-all font-mono select-all">
                    {`https://threads.net/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=threads_basic,threads_content_publish&response_type=code`}
                  </div>
                  <input
                    type="text"
                    value={authCode}
                    onChange={(e) => { setAuthCode(e.target.value); setAuthError(''); }}
                    placeholder="貼上授權碼..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-white text-sm
                             focus:border-purple-500 outline-none transition-colors placeholder:text-slate-600 font-mono"
                  />
                </div>
              </details>
            </div>
          )}

          {/* Step 3: Exchange */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h5 className="text-white font-bold mb-1">Step 3：換取長期 Token</h5>
                <p className="text-xs text-slate-400 mb-4">
                  已取得授權碼，點擊下方按鈕將授權碼換成長期 Access Token（有效期約 60 天）。
                </p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                <Check size={14} className="text-green-400 flex-shrink-0" />
                <p className="text-xs text-green-400">授權碼已就緒</p>
              </div>

              <button
                onClick={handleExchange}
                disabled={isExchanging}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600
                         hover:from-purple-500 hover:to-blue-500
                         disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500
                         text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {isExchanging ? (
                  <><Loader2 size={18} className="animate-spin" /> 換取中...</>
                ) : (
                  <><Key size={18} /> 換取長期 Token</>
                )}
              </button>

              {exchangeError && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-red-400 font-bold">換取失敗</p>
                    <p className="text-[10px] text-red-400/70 mt-1">{exchangeError}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 4 && result && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check size={32} className="text-green-400" />
                </div>
                <h5 className="text-white font-bold text-lg mb-1">Token 換取成功！</h5>
                <p className="text-xs text-slate-400">
                  已取得長期 Token，點擊下方按鈕自動填入設定。
                </p>
              </div>

              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">帳號</span>
                  <span className="text-sm text-white font-bold">@{result.username}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">User ID</span>
                  <span className="text-sm text-slate-300 font-mono">{result.userId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">有效期</span>
                  <span className="text-sm text-slate-300">約 {Math.floor(result.expiresIn / 86400)} 天</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Access Token</span>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={result.accessToken}
                      readOnly
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-white text-xs font-mono"
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(result.accessToken)}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                      title="複製 Token"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-slate-800">
          {step === 1 && (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!appId.trim() || !appSecret.trim()}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500
                         text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-1"
              >
                下一步 <ChevronRight size={16} />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-colors
                         flex items-center justify-center gap-1"
              >
                <ChevronLeft size={16} /> 上一步
              </button>
              <button
                onClick={() => { if (authCode) setStep(3); }}
                disabled={!authCode}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500
                         text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-1"
              >
                下一步 <ChevronRight size={16} />
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <button
                onClick={() => setStep(2)}
                disabled={isExchanging}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:text-slate-600
                         text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-1"
              >
                <ChevronLeft size={16} /> 上一步
              </button>
            </>
          )}

          {step === 4 && (
            <button
              onClick={handleComplete}
              className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-xl transition-colors
                       flex items-center justify-center gap-2"
            >
              <Check size={16} /> 填入設定並關閉
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenHelperModal;
