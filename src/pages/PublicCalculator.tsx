/**
 * Ultra Advisor - 公開計算機（漏斗第一層）
 * 不需登入即可使用，用於引流
 * 包含：智能房貸戰情室、智能計算機
 *
 * 檔案位置：src/pages/PublicCalculator.tsx
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Zap, LogIn, Building2, Calculator, User, TrendingUp } from 'lucide-react';
import MortgageCalculator from '../components/MortgageCalculator';
import SimpleCalculator from '../components/SimpleCalculator';
import CashFlowVisualizer from '../components/CashFlowVisualizer';
import { User as FirebaseUser } from 'firebase/auth';

interface PublicCalculatorProps {
  onBack: () => void;
  onLogin: () => void;
  user?: FirebaseUser | null;  // 🆕 可選的用戶資訊
}

type ToolTab = 'mortgage' | 'calculator' | 'cashflow';

const PublicCalculator: React.FC<PublicCalculatorProps> = ({ onBack, onLogin, user }) => {
  // 🆕 持久化 activeTab：重新整理後保持在原工具
  const [activeTab, setActiveTab] = useState<ToolTab>(() => {
    const saved = localStorage.getItem('public_calculator_tab');
    if (saved === 'mortgage' || saved === 'calculator' || saved === 'cashflow') {
      return saved;
    }
    return 'mortgage';
  });

  // 🆕 當 activeTab 變化時儲存到 localStorage
  useEffect(() => {
    localStorage.setItem('public_calculator_tab', activeTab);
  }, [activeTab]);

  // SEO: 動態更新頁面標題和 Meta
  useEffect(() => {
    const seoConfig = {
      mortgage: {
        title: '智能房貸戰情室 | 免費房貸計算機 - Ultra Advisor',
        description: '免費房貸計算機：支援本息均攤、本金均攤、額外還款試算、通脹貼現分析。視覺化圖表呈現還款結構，精算每一分利息。',
        url: 'https://ultra-advisor.tw/calculator'
      },
      calculator: {
        title: '智能計算機 | 專業理財計算工具 - Ultra Advisor',
        description: '智能理財計算機：快速計算複利、年化報酬率、投資收益。AI 驅動的專業理財計算工具。',
        url: 'https://ultra-advisor.tw/calculator'
      },
      cashflow: {
        title: '收入流 vs 支出流 | 即時金錢流動視覺化 - Ultra Advisor',
        description: '即時視覺化你的收入與支出流動：每秒、每分鐘、每小時賺多少、花多少？一鍵掌握收支平衡。',
        url: 'https://ultra-advisor.tw/calculator'
      }
    };

    const config = seoConfig[activeTab];

    // 更新頁面標題
    document.title = config.title;

    // 更新 meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', config.description);
    }

    // 更新 Open Graph
    let ogTitle = document.querySelector('meta[property="og:title"]');
    let ogDescription = document.querySelector('meta[property="og:description"]');
    let ogUrl = document.querySelector('meta[property="og:url"]');

    if (ogTitle) ogTitle.setAttribute('content', config.title);
    if (ogDescription) ogDescription.setAttribute('content', config.description);
    if (ogUrl) ogUrl.setAttribute('content', config.url);

    // 更新 Twitter Card
    let twitterTitle = document.querySelector('meta[name="twitter:title"]');
    let twitterDescription = document.querySelector('meta[name="twitter:description"]');

    if (twitterTitle) twitterTitle.setAttribute('content', config.title);
    if (twitterDescription) twitterDescription.setAttribute('content', config.description);

    // 更新 canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', config.url);

    // 清理：離開頁面時恢復預設
    return () => {
      document.title = 'Ultra Advisor - 專業財務視覺化解決方案';
    };
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* 頂部導航 */}
      <div className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-3">
          {/* 第一行：返回 + 登入 */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="text-sm">返回首頁</span>
            </button>

            {/* 🆕 依登入狀態顯示：會員顯示頭貼+名稱，非會員顯示免費試用 */}
            {user ? (
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full border-2 border-emerald-500"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
                    <User size={16} className="text-white" />
                  </div>
                )}
                <span className="text-sm text-white font-medium hidden sm:block max-w-[100px] truncate">
                  {user.displayName || user.email?.split('@')[0] || '會員'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 hidden sm:block">
                  想要更多專業工具？
                </span>
                <button
                  onClick={onLogin}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-all"
                >
                  <LogIn size={16} />
                  免費試用
                </button>
              </div>
            )}
          </div>

          {/* 第二行：工具標籤 */}
          <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('mortgage')}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                ${activeTab === 'mortgage'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }
              `}
            >
              <Building2 size={18} />
              <span className="hidden sm:inline">智能房貸戰情室</span>
              <span className="sm:hidden">房貸</span>
            </button>
            <button
              onClick={() => setActiveTab('calculator')}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                ${activeTab === 'calculator'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }
              `}
            >
              <Calculator size={18} />
              <span className="hidden sm:inline">智能計算機</span>
              <span className="sm:hidden">計算機</span>
            </button>
            <button
              onClick={() => setActiveTab('cashflow')}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                ${activeTab === 'cashflow'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }
              `}
            >
              <TrendingUp size={18} />
              <span className="hidden sm:inline">收支流動</span>
              <span className="sm:hidden">收支</span>
            </button>
          </div>
        </div>
      </div>

      {/* 工具主體 */}
      {activeTab === 'mortgage' && <MortgageCalculator />}
      {activeTab === 'calculator' && <SimpleCalculator user={user} onLogin={onLogin} />}
      {activeTab === 'cashflow' && <CashFlowVisualizer />}

      {/* 底部 CTA */}
      <div className="bg-gradient-to-r from-blue-900 to-purple-900 py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Zap className="text-amber-400" size={24} />
            <h3 className="text-xl font-bold text-white">解鎖 18 種專業理財工具</h3>
          </div>
          <p className="text-slate-300 mb-4">
            大小水庫、金融房產、節稅規劃、退休試算...
            <br />
            一站式解決客戶所有理財規劃需求
          </p>
          <button
            onClick={onLogin}
            className="bg-white text-blue-600 font-bold px-8 py-3 rounded-xl hover:bg-blue-50 transition-all shadow-lg"
          >
            立即免費試用 7 天
          </button>
          <p className="text-xs text-slate-400 mt-3">
            無需信用卡 · 隨時可取消
          </p>
        </div>
      </div>
    </div>
  );
};

export default PublicCalculator;
