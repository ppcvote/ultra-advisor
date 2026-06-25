import React, { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  BookOpen, ExternalLink, RefreshCw, Share2, TrendingUp,
  Crown, Users, Wrench, ArrowRight, Newspaper, Zap, Mic, PencilRuler, Target,
  Cake, Clock, FileEdit, Settings
} from 'lucide-react';
import MissionCard from '../MissionCard';
import { useMissions } from '../../hooks/useMissions';
// 移除：dailyMarketReports 改走 /api/market-report，不再 import db / onSnapshot
// 🔧 PERF: 只 import 輕量 metadata（id/slug/title/excerpt/publishDate），不拉 content 全文
// 原本 index.ts ~900KB raw → 改用 metadata.ts ~57KB raw（content 改 BlogPage 動態 import）
import { blogMetadata as blogArticles } from '../../data/blog/metadata';
// PERF: 不要 import 整包 365 筆 dailyQuotes — 改用 build-time prerender 的「今天那筆」
import { todayQuote, todayBackground } from '../../data/_today-quote.generated';
import { formatDateChinese } from '../../utils/dateFormat';
import { ALL_TOOLS } from '../../constants/tools';
// Sprint 8 H: 「今日重點」agenda — 每天打開 UA 第一眼看到「該打開誰的檔案」
// pure helper，nowEpochMs 由 caller runtime 取（對齊 customerReport.ts 鐵則）
import { buildAgenda, type AgendaItem } from '../../lib/clientAgenda';
// Sprint 9 D: 顧問可個別關閉某類 trigger（生日 / stale / 資料不足）
// 走 useSyncExternalStore — 切換立刻 re-render、不靠 useEffect rehydrate
import {
  getAgendaPrefs,
  setAgendaPref,
  subscribeAgendaPrefs,
  type AgendaPrefs,
} from '../../lib/agendaPrefs';
// Sprint 11 Stream 3.A: a11y hook — Esc + click-outside + focus-return.
// Replaces the bespoke mousedown listener with the shared, SR-friendly version.
import { usePopoverDismiss } from '../../hooks/usePopoverDismiss';
import type { ProfileData, WarRoomTab } from './types';

interface OverviewTabProps {
  user: any;
  profileData: ProfileData;
  membership: any;
  clientCount: number;
  /** Sprint 8 H: agenda block 需要實際 client 資料才能算「本週生日 / stale / 不完整」。
   *  父層 WarRoom index 已有 onSnapshot 訂閱、直接 pass-down 避免重複 listener。 */
  clients?: any[];
  onSwitchTab: (tab: WarRoomTab) => void;
  onAddClient?: () => void;
  /** Sprint 8 H: agenda item 點下去要跳到客戶詳情。沿用 ClientsTab 的 onSelectClient callback 模式。 */
  onSelectClient?: (client: any) => void;
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
  user, profileData, membership, clientCount, clients, onSwitchTab, onAddClient, onSelectClient
}) => {
  const [marketReport, setMarketReport] = useState<any>(null);
  const todayBg = todayBackground;
  const isNewUser = clientCount === 0;

  // ===== Sprint 8 H + Sprint 9 D: 「今日重點」agenda =====
  // 鐵則：nowEpochMs 必須 runtime 取（在 useMemo callback 內、不是 module top）
  // 對齊 customerReport.ts pure codec / Sprint 7 timestamp 鐵則。
  // 客戶列表變動或 prefs 變動就重算（useMemo deps = [clients, agendaPrefs]），不另設 setInterval。
  // useSyncExternalStore：prefs 在 module-level store、跨元件即時同步、無需 prop drilling。
  const agendaPrefs: AgendaPrefs = useSyncExternalStore(
    subscribeAgendaPrefs,
    getAgendaPrefs,
    getAgendaPrefs, // server snapshot — SSR-safe（safeStorage 內部已 SSR-guarded）
  );

  const agenda: AgendaItem[] = useMemo(() => {
    if (!clients || clients.length === 0) return [];
    return buildAgenda(clients, Date.now(), { prefs: agendaPrefs });
  }, [clients, agendaPrefs]);

  // 點 agenda item → 跳客戶詳情。沿用 ClientsTab 的 onSelectClient 模式（callback，非 URL routing）。
  const handleAgendaClick = (item: AgendaItem) => {
    const target = clients?.find(c => c.id === item.clientId);
    if (target && onSelectClient) onSelectClient(target);
  };

  // ===== Sprint 9 D: agenda 偏好齒輪 popover =====
  // Sprint 11 Stream 3.A: 換成 usePopoverDismiss — 一次補 Esc + click-outside + focus-return + autofocus。
  // 既有的 mousedown-only listener 沒處理鍵盤、popover 關閉後焦點落到 <body>、SR 用戶迷失。
  const [showPrefsPopover, setShowPrefsPopover] = useState(false);
  const prefsPopoverRef = useRef<HTMLDivElement | null>(null);
  // triggerRef: focus-return target on close (avoids focus falling to <body> after Esc)
  const prefsTriggerRef = useRef<HTMLButtonElement | null>(null);
  // initialFocusRef: autofocus first checkbox on open so keyboard users have an immediate tab target
  const prefsFirstCheckboxRef = useRef<HTMLInputElement | null>(null);

  usePopoverDismiss({
    isOpen: showPrefsPopover,
    onDismiss: () => setShowPrefsPopover(false),
    containerRef: prefsPopoverRef,
    triggerRef: prefsTriggerRef,
    initialFocusRef: prefsFirstCheckboxRef,
  });

  // Onboarding missions list — drives the 8-step "快速上手" panel for new users.
  // Hook auto-fetches on auth; we only consume `missions` + `loading` here.
  const { missions, loading: missionsLoading } = useMissions();
  // Surface only the onboarding bucket on the overview — social/habit/daily
  // missions belong in a dedicated tab so they don't clutter the new-user view.
  const onboardingMissions = missions.filter(m => m.category === 'onboarding');
  const completedCount = onboardingMissions.filter(m =>
    m.repeatType === 'once' ? m.isCompleted : m.isCompletedToday
  ).length;

  useEffect(() => {
    // 🔧 PERF: 改走 /api/market-report（5min CDN s-maxage）取代 onSnapshot
    // 同頁面（UltraWarRoom 也有同一個 listener）兩個 listener 同步同一份全域文件，浪費 Firestore reads
    // 報告每天才更新一次，5min stale 完全夠用
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/market-report', { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) setMarketReport(null);
          return;
        }
        const data = await res.json();
        if (!cancelled) setMarketReport(data);
      } catch {
        if (!cancelled) setMarketReport(null);
      }
    };
    load();
    // 15 分鐘重抓一次（搭配 CDN cache）
    const id = setInterval(load, 15 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
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

      {/* ====== Sprint 8 H: 「今日重點」agenda ======
          顧問每天最該打開 UA 的 trigger — 三類：本週生日 / 近 30 天 stale / 完整度 < 4/8
          - 沒任何命中 → 整 block 不渲染（避免空狀態壓 hero）
          - 同客戶被多個 trigger 命中只列一次（buildAgenda 內 dedupe by clientId，priority 已排好）
          - 點 item → onSelectClient（沿用 ClientsTab 既有路由模式） */}
      {agenda.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-950/60 via-slate-900 to-orange-950/40 border border-amber-500/20 p-5">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Target size={16} className="text-amber-400" />
              <h3 className="text-sm font-bold text-white">今日重點</h3>
              <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full">
                {agenda.length}
              </span>
              {/* Sprint 9 D: 齒輪 — 顧問可關掉某類 trigger（嘮叨感 critic fix）
                  ml-auto 推到 flex 末端；popover 走 absolute、z-20 蓋住下方按鈕列 */}
              <div className="relative ml-auto" ref={prefsPopoverRef}>
                <button
                  type="button"
                  ref={prefsTriggerRef}
                  onClick={() => setShowPrefsPopover(v => !v)}
                  aria-label="調整今日重點顯示"
                  aria-expanded={showPrefsPopover}
                  aria-haspopup="dialog"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                >
                  <Settings size={14} />
                </button>
                {showPrefsPopover && (
                  <div
                    // role=dialog + aria-modal=false: SR announces this as a popover-style
                    // dialog (not a full modal — page is still interactive behind it).
                    role="dialog"
                    aria-modal="false"
                    aria-label="調整今日重點顯示"
                    className="absolute top-full right-0 mt-1 w-56 z-20
                               bg-slate-900 border border-slate-700 rounded-xl shadow-xl
                               p-2 space-y-0.5"
                  >
                    <div className="px-2 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      顯示 trigger
                    </div>
                    {([
                      { key: 'showBirthday',   label: '本週生日',   icon: <Cake size={12} className="text-pink-400" /> },
                      { key: 'showStale',      label: '久未追蹤',   icon: <Clock size={12} className="text-blue-400" /> },
                      { key: 'showIncomplete', label: '資料不足',   icon: <FileEdit size={12} className="text-emerald-400" /> },
                    ] as const).map((row, rowIdx) => (
                      <label
                        key={row.key}
                        className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer
                                   hover:bg-slate-800/60 transition-colors"
                      >
                        <input
                          type="checkbox"
                          // First checkbox gets the autofocus ref so keyboard users land
                          // here when popover opens (Tab navigation starts here).
                          ref={rowIdx === 0 ? prefsFirstCheckboxRef : undefined}
                          checked={agendaPrefs[row.key]}
                          onChange={(e) => setAgendaPref(row.key, e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800
                                     text-amber-500 focus:ring-1 focus:ring-amber-500/40
                                     focus:ring-offset-0 cursor-pointer"
                        />
                        <span className="shrink-0">{row.icon}</span>
                        <span className="text-xs text-slate-200">{row.label}</span>
                      </label>
                    ))}
                    <div className="px-2 pt-1 pb-0.5 text-[10px] text-slate-600">
                      全部關閉 → 隱藏整個區塊
                    </div>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-3">這些客戶今天值得花 5 分鐘</p>

            <div className="space-y-2">
              {agenda.map(item => {
                // emoji-as-icon 太情緒化、跟整體 dashboard 不搭 — 用 lucide icon
                const iconMap = {
                  birthday: <Cake size={14} className="text-pink-400" />,
                  stale: <Clock size={14} className="text-blue-400" />,
                  incomplete: <FileEdit size={14} className="text-emerald-400" />,
                };
                const tagBg = {
                  birthday: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
                  stale: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
                  incomplete: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                };
                return (
                  <button
                    key={`${item.kind}-${item.clientId}`}
                    onClick={() => handleAgendaClick(item)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                               bg-slate-900/60 border border-slate-800/60 hover:border-amber-500/30
                               hover:bg-slate-800/60 transition-all group text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-800/80 flex items-center justify-center shrink-0">
                      {iconMap[item.kind]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{item.clientName}</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${tagBg[item.kind]}`}>
                      {item.detail}
                    </span>
                    <ArrowRight size={14} className="text-slate-600 group-hover:text-amber-400 transition-colors shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ====== P0: 新用戶引導 — 8 步驟任務看板 ======
          原本只有「新增第一位客戶」單一 CTA，留下其他 7 條黏著動作沒有 surface（連 LINE、設大頭貼、第一次試算…）
          改成 missions list 後新用戶有完整可勾選地圖；onAddClient 仍保留為其中一張 mission 的 fallback。 */}
      {(isNewUser || (onboardingMissions.length > 0 && completedCount < onboardingMissions.length)) && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950/80 via-slate-900 to-purple-950/80 border border-blue-500/20 p-5">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Target size={16} className="text-blue-400" />
              <h3 className="text-sm font-bold text-white">快速上手任務</h3>
              {onboardingMissions.length > 0 && (
                <span className="text-[10px] font-bold text-blue-300 bg-blue-500/15 px-2 py-0.5 rounded-full">
                  {completedCount} / {onboardingMissions.length}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-4">
              {onboardingMissions.length || 8} 步驟、預計 10 分鐘，每完成一項可獲得點數
            </p>

            {missionsLoading && onboardingMissions.length === 0 ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-3">
                <Zap size={14} className="animate-pulse" />
                <span>載入任務中…</span>
              </div>
            ) : onboardingMissions.length === 0 ? (
              // 任務系統尚未初始化（functions/initMissions 沒跑）— 退回原本的單一 CTA
              // 保險 fallback：寧可顯示 1 個按鈕也別給空白區塊
              <button
                onClick={onAddClient}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20"
              >
                <Users size={16} /> 新增第一位客戶
              </button>
            ) : (
              <div className="space-y-2">
                {onboardingMissions.map(m => (
                  <MissionCard
                    key={m.id}
                    mission={m}
                    onNavigate={(p) => { window.location.href = p; }}
                  />
                ))}
              </div>
            )}
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

      {/* ====== Repeater 會議重播器 ====== */}
      <a href="https://repeater-app.vercel.app" target="_blank" rel="noopener noreferrer"
        className="w-full rounded-2xl overflow-hidden relative group text-left
                   bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-800/30
                   hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10 transition-all p-5 block">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
            <Mic size={22} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-bold text-white">Repeater</span>
              <span className="text-[9px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full font-bold">NEW</span>
            </div>
            <p className="text-[11px] text-slate-400">會議錄音 → 逐字稿 → AI 摘要 → 簡報，一鍵交差</p>
          </div>
          <ArrowRight size={16} className="text-slate-600 group-hover:text-amber-400 transition-colors shrink-0" />
        </div>
      </a>

      {/* ====== Ultra 白板 ====== */}
      <a href="/whiteboard"
        className="w-full rounded-2xl overflow-hidden relative group text-left
                   bg-gradient-to-br from-sky-950/40 to-slate-900 border border-sky-800/30
                   hover:border-sky-500/40 hover:shadow-lg hover:shadow-sky-500/10 transition-all p-5 block">
        <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-500/15 flex items-center justify-center shrink-0">
            <PencilRuler size={22} className="text-sky-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-bold text-white">Ultra 白板</span>
              <span className="text-[9px] bg-sky-500/15 text-sky-400 px-2 py-0.5 rounded-full font-bold">NEW</span>
            </div>
            <p className="text-[11px] text-slate-400">即時協作白板 · iPad 友善 · 一連結分享給團隊</p>
          </div>
          <ArrowRight size={16} className="text-slate-600 group-hover:text-sky-400 transition-colors shrink-0" />
        </div>
      </a>
    </div>
  );
};

export default OverviewTab;
