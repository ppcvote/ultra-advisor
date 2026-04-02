import React, { useState, useEffect } from 'react';
import {
  BookOpen, ExternalLink, RefreshCw, Share2, TrendingUp,
  Crown, Users, Wrench, ArrowRight, Newspaper, Plus, Zap
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { blogArticles } from '../../data/blog/index';
import { getTodayQuote, getTodayBackground, formatDateChinese } from '../../data/dailyQuotes';
import { ALL_TOOLS } from '../../constants/tools';
import type { ProfileData, WarRoomTab } from './types';

interface OverviewTabProps {
  user: any;
  profileData: ProfileData;
  membership: any;
  clientCount: number;
  onSwitchTab: (tab: WarRoomTab) => void;
  onAddClient?: () => void;
}

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早安';
  if (h < 14) return '午安';
  if (h < 18) return '下午好';
  return '晚安';
};

const OverviewTab: React.FC<OverviewTabProps> = ({
  user, profileData, membership, clientCount, onSwitchTab, onAddClient
}) => {
  const [marketReport, setMarketReport] = useState<any>(null);
  const todayQuote = getTodayQuote();
  const todayBg = getTodayBackground();
  const isNewUser = clientCount === 0;

  useEffect(() => {
    const now = new Date();
    const twDate = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const today = twDate.toISOString().split('T')[0];
    const unsub = onSnapshot(doc(db, 'dailyMarketReports', today), snap => {
      setMarketReport(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, []);

  const displayName = profileData.displayName || user?.displayName || user?.email?.split('@')[0] || '用戶';
  const avatarUrl = profileData.photoURL || user?.photoURL;
  const toolCount = ALL_TOOLS.length;

  return (
    <div className="space-y-5">

      {/* ====== Hero 歡迎區 ====== */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-500/10 via-purple-500/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-emerald-500/5 to-transparent rounded-full translate-y-1/2 -translate-x-1/4" />

        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center overflow-hidden border-2 border-white/10 shadow-lg shadow-blue-500/20 shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-black text-white">{displayName.charAt(0)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-white truncate">
              {getGreeting()}，{displayName}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-slate-400">{formatDateChinese()}</span>
              {membership && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                  style={{
                    backgroundColor: `${membership.tierColor}15`,
                    color: membership.tierColor,
                    border: `1px solid ${membership.tierColor}30`
                  }}
                >
                  {membership.tier === 'founder' && <Crown size={11} />}
                  {membership.tierName}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ====== P0: 新用戶引導 ====== */}
      {isNewUser && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950/80 via-slate-900 to-purple-950/80 border border-blue-500/20 p-5">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-blue-400" />
              <h3 className="text-sm font-bold text-white">開始使用</h3>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              建立第一位客戶後，即可使用 {toolCount} 種分析工具產出專業提案
            </p>
            <button
              onClick={onAddClient}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20"
            >
              <Plus size={16} /> 新增第一位客戶
            </button>
          </div>
        </div>
      )}

      {/* ====== 快捷入口 ====== */}
      <div className="grid grid-cols-3 gap-3">
        {/* 客戶 */}
        <button onClick={() => onSwitchTab('clients')}
          className="relative overflow-hidden rounded-xl p-4 text-left transition-all group
                     bg-gradient-to-br from-blue-950/80 to-slate-900/80 border border-blue-500/20
                     hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <Users size={20} className="text-blue-400 mb-2" />
          <div className="text-2xl font-black text-white">{clientCount}</div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-blue-300/70">客戶檔案</p>
            <ArrowRight size={12} className="text-blue-500/0 group-hover:text-blue-400 transition-all transform group-hover:translate-x-0 -translate-x-2" />
          </div>
        </button>

        {/* 工具 */}
        <button onClick={() => onSwitchTab('tools')}
          className="relative overflow-hidden rounded-xl p-4 text-left transition-all group
                     bg-gradient-to-br from-emerald-950/80 to-slate-900/80 border border-emerald-500/20
                     hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <Wrench size={20} className="text-emerald-400 mb-2" />
          <div className="text-2xl font-black text-white">{toolCount}</div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-emerald-300/70">分析工具</p>
            <ArrowRight size={12} className="text-emerald-500/0 group-hover:text-emerald-400 transition-all transform group-hover:translate-x-0 -translate-x-2" />
          </div>
        </button>

        {/* 分享 — 統一用數字格式 */}
        <button onClick={() => onSwitchTab('share')}
          className="relative overflow-hidden rounded-xl p-4 text-left transition-all group
                     bg-gradient-to-br from-purple-950/80 to-slate-900/80 border border-purple-500/20
                     hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10">
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <Share2 size={20} className="text-purple-400 mb-2" />
          <div className="text-2xl font-black text-white">{blogArticles.length}</div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-purple-300/70">金句 & 快訊</p>
            <ArrowRight size={12} className="text-purple-500/0 group-hover:text-purple-400 transition-all transform group-hover:translate-x-0 -translate-x-2" />
          </div>
        </button>
      </div>

      {/* ====== 今日金句（單列，精緻但不霸佔版面） ====== */}
      <button onClick={() => onSwitchTab('share')}
        className="w-full rounded-2xl overflow-hidden relative group text-left" style={{ height: '140px' }}>
        <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
          style={{
            backgroundImage: todayBg.imageUrl ? `url(${todayBg.imageUrl})` : undefined,
            filter: 'brightness(0.3) grayscale(30%)',
          }} />
        {!todayBg.imageUrl && (
          <div className={`absolute inset-0 bg-gradient-to-br ${todayBg.fallbackGradient}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/30" />
        <div className="relative z-10 h-full flex items-center p-5 gap-5" style={{ height: '140px' }}>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-white/40 font-bold tracking-widest uppercase">Today's Quote</span>
            <p className="text-white font-bold text-sm leading-relaxed line-clamp-2 mt-2 drop-shadow-lg">
              「{todayQuote.text}」
            </p>
            <p className="text-white/40 text-[11px] mt-1.5">— {todayQuote.author}</p>
          </div>
          <div className="shrink-0 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center
                         opacity-0 group-hover:opacity-100 transition-all">
            <ArrowRight size={16} className="text-white/70" />
          </div>
        </div>
      </button>

      {/* ====== 盤後快訊（有資料才顯示，不佔新用戶版面） ====== */}
      {marketReport && (
        <button onClick={() => onSwitchTab('share')}
          className="w-full rounded-2xl overflow-hidden relative group text-left
                     bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50
                     hover:border-blue-500/30 transition-all p-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/5 to-transparent rounded-full" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-blue-500/20 flex items-center justify-center">
                  <Newspaper size={12} className="text-blue-400" />
                </div>
                <span className="text-xs font-bold text-blue-400">
                  {marketReport.type === 'pre' ? '盤前快訊' : '盤後快訊'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  marketReport.aiSummary?.sentiment === 'bullish' ? 'bg-green-500/15 text-green-400' :
                  marketReport.aiSummary?.sentiment === 'bearish' ? 'bg-blue-500/15 text-blue-400' :
                  'bg-white/5 text-white/50'
                }`}>
                  {marketReport.aiSummary?.sentiment === 'bullish' ? '偏多' :
                   marketReport.aiSummary?.sentiment === 'bearish' ? '偏空' : '中性'}
                </span>
              </div>
              <p className="text-sm font-bold text-white leading-snug line-clamp-1">
                {marketReport.aiSummary?.headline}
              </p>
              {marketReport.marketData?.twii && (
                <div className="flex items-center gap-2 mt-1.5">
                  <TrendingUp size={13} className={marketReport.marketData.twii.change >= 0 ? 'text-green-400' : 'text-blue-400'} />
                  <span className="text-xs font-bold text-white">
                    {marketReport.marketData.twii.price?.toLocaleString()}
                  </span>
                  <span className={`text-xs font-bold ${
                    marketReport.marketData.twii.change >= 0 ? 'text-green-400' : 'text-blue-400'
                  }`}>
                    {marketReport.marketData.twii.change >= 0 ? '+' : ''}{marketReport.marketData.twii.changePercent}%
                  </span>
                </div>
              )}
            </div>
            <div className="shrink-0 w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center
                           text-slate-600 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition-all">
              <ArrowRight size={14} />
            </div>
          </div>
        </button>
      )}

      {/* ====== 知識庫 ====== */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-purple-400" />
            <span className="text-sm font-bold text-slate-200">知識庫</span>
            <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full font-medium">{blogArticles.length} 篇</span>
          </div>
          <a href="/blog" target="_blank" rel="noopener noreferrer"
            className="text-[11px] text-slate-500 hover:text-purple-400 flex items-center gap-1 transition-colors">
            查看全部 <ExternalLink size={10} />
          </a>
        </div>

        <div className="divide-y divide-slate-800/30">
          {[...blogArticles]
            .sort((a, b) => {
              const d = new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime();
              return d !== 0 ? d : parseInt(b.id) - parseInt(a.id);
            })
            .slice(0, 4)
            .map((article, i) => (
              <a key={article.id} href={`/blog/${article.slug}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-800/30 transition-colors group">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-black ${
                  i === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800/50 text-slate-600'
                }`}>
                  {i === 0 ? 'N' : (i + 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm line-clamp-1 ${i === 0 ? 'text-white font-bold' : 'text-slate-400'} group-hover:text-white transition-colors`}>
                    {article.title}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5">{article.readTime} 分鐘閱讀</p>
                </div>
                {i === 0 && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold shrink-0">NEW</span>}
              </a>
            ))}
        </div>

        <button
          onClick={() => {
            const r = blogArticles[Math.floor(Math.random() * blogArticles.length)];
            window.open(`/blog/${r.slug}`, '_blank');
          }}
          className="w-full flex items-center justify-center gap-2 py-3 border-t border-slate-800/50
                     hover:bg-purple-500/5 transition-colors group">
          <RefreshCw size={13} className="text-purple-500/50 group-hover:text-purple-400 transition-colors" />
          <span className="text-xs text-slate-500 group-hover:text-purple-300 font-medium transition-colors">隨機一篇</span>
        </button>
      </div>
    </div>
  );
};

export default OverviewTab;
