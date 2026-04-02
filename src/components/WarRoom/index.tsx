import React, { useState, useEffect, useRef } from 'react';
import {
  LogOut, Settings, Bell, X, ChevronDown, Lightbulb,
  LayoutDashboard, Users, Wrench, Share2, Calculator,
  User, Lock, Gift
} from 'lucide-react';
import {
  doc, setDoc, getDoc, collection, addDoc, deleteDoc, updateDoc,
  onSnapshot, query, orderBy, Timestamp
} from 'firebase/firestore';
import { getAuth, updateProfile } from 'firebase/auth';
import { db } from '../../firebase';

import { useMembership } from '../../hooks/useMembership';
import ReferralEngineModal from '../ReferralEngineModal';
import CheckupClientSelector from '../insurance/CheckupClientSelector';

import type { WarRoomTab, ProfileData, WarRoomProps } from './types';
import OverviewTab from './OverviewTab';
import ClientsTab from './ClientsTab';
import ToolsTab from './ToolsTab';
import ShareTab from './ShareTab';
import { AddClientModal, EditClientModal, FeedbackModal, EditProfileModal, ChangePasswordModal } from './modals';

// Tab 定義
const TABS: { id: WarRoomTab; label: string; icon: React.FC<any> }[] = [
  { id: 'overview', label: '總覽', icon: LayoutDashboard },
  { id: 'clients', label: '客戶', icon: Users },
  { id: 'tools', label: '工具', icon: Wrench },
  { id: 'share', label: '分享', icon: Share2 },
];

const WarRoom: React.FC<WarRoomProps> = ({ user, onSelectClient, onLogout, onNavigateToTool, onStartCheckup }) => {
  // ===== 核心 Hook =====
  const { membership } = useMembership(user?.uid || null);

  // ===== Tab 狀態 =====
  const [activeTab, setActiveTab] = useState<WarRoomTab>('overview');

  // ===== 客戶 =====
  const [clients, setClients] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);

  // ===== 個人資料 =====
  const [profileData, setProfileData] = useState<ProfileData>({
    displayName: user?.displayName || '',
    photoURL: user?.photoURL || '',
    email: user?.email || '',
    phone: '', lineId: '', instagram: '', lineQrCode: '',
  });

  // ===== Modal 狀態 =====
  const [showAddClient, setShowAddClient] = useState(false);
  const [showEditClient, setShowEditClient] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [showReferralEngine, setShowReferralEngine] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showCheckupSelector, setShowCheckupSelector] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // ===== 通知 =====
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [expandedNotifId, setExpandedNotifId] = useState<string | null>(null);
  const [showAllNotifs, setShowAllNotifs] = useState(false);

  const displayedNotifs = showAllNotifs ? notifications : notifications.slice(0, 3);
  const unreadCount = notifications.slice(0, 3).filter(n => !readNotificationIds.includes(n.id)).length;

  // ===== LOGO 彩蛋 =====
  const [logoClicks, setLogoClicks] = useState(0);
  const logoTimer = useRef<NodeJS.Timeout | null>(null);
  const handleLogoClick = () => {
    setLogoClicks(prev => {
      const next = prev + 1;
      if (next >= 5) { window.open('/secret-admin-ultra-2026', '_blank'); return 0; }
      return next;
    });
    if (logoTimer.current) clearTimeout(logoTimer.current);
    logoTimer.current = setTimeout(() => setLogoClicks(0), 500);
  };

  // ===== 資料載入 =====
  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'profile', 'data'));
        if (snap.exists()) setProfileData(prev => ({ ...prev, ...snap.data() as ProfileData }));
      } catch (e) { console.error('Load profile failed:', e); }
    };
    loadProfile();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'clients'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setClients(list);
      setClientsLoading(false);
    }, () => setClientsLoading(false));
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'siteContent', 'notifications'), snap => {
      if (snap.exists()) {
        const items = (snap.data().items || [])
          .filter((n: any) => n.enabled !== false)
          .sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
        setNotifications(items);
      }
    });
    const readIds = localStorage.getItem('readNotificationIds');
    if (readIds) setReadNotificationIds(JSON.parse(readIds));
    return () => unsub();
  }, []);

  // ===== 操作 =====
  const handleSaveProfile = async (data: ProfileData) => {
    if (!user) return;
    const auth = getAuth();
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: data.displayName, photoURL: data.photoURL });
    }
    await setDoc(doc(db, 'users', user.uid, 'profile', 'data'), { ...data, updatedAt: Timestamp.now() });
    setProfileData(data);
  };

  const handleAddClient = async (name: string, note: string) => {
    if (!user) return;
    await addDoc(collection(db, 'users', user.uid, 'clients'), {
      name, note, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
  };

  const handleEditClient = async (clientId: string, name: string, note: string) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'clients', clientId), { name, note, updatedAt: Timestamp.now() });
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'clients', clientId));
  };

  const markNotifRead = (id: string) => {
    const ids = [...readNotificationIds, id];
    setReadNotificationIds(ids);
    localStorage.setItem('readNotificationIds', JSON.stringify(ids));
  };

  const markAllRead = () => {
    const ids = [...new Set([...readNotificationIds, ...displayedNotifs.map(n => n.id)])];
    setReadNotificationIds(ids);
    localStorage.setItem('readNotificationIds', JSON.stringify(ids));
  };

  const handleToolSelect = (toolId: string) => {
    // 如果有客戶，直接導航到工具
    if (clients.length > 0) {
      onSelectClient(clients[0]); // 預設選第一個客戶
      if (onNavigateToTool) onNavigateToTool(toolId);
    } else {
      setActiveTab('clients');
    }
  };

  return (
    <div
      className="min-h-screen transition-colors duration-300
                 dark:bg-slate-950 bg-slate-50
                 dark:bg-[linear-gradient(rgba(77,163,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(77,163,255,0.02)_1px,transparent_1px)]
                 bg-[length:40px_40px]"
      onClick={() => { setShowNotifications(false); setShowSettingsMenu(false); }}
    >
      {/* ===== Header（極簡） ===== */}
      <header className="sticky top-0 z-40 dark:bg-slate-950/90 bg-white/90 backdrop-blur-xl border-b dark:border-slate-800/50 border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={handleLogoClick}>
            <img src="/logo.png" alt="Ultra Advisor" className="h-8 w-8 rounded-lg object-cover"
              onError={(e: any) => { e.currentTarget.src = 'https://placehold.co/32x32/3b82f6/white?text=UA'; }} />
            <h1 className="text-base font-black dark:text-white text-slate-900">
              <span style={{ color: '#FF3A3A' }}>Ultra</span> <span className="text-blue-500">Advisor</span>
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            {/* 傲創計算機 */}
            <a href="/calculator" className="p-2 text-slate-500 hover:text-emerald-400 hover:bg-slate-800/50 rounded-lg transition-all" title="傲創計算機">
              <Calculator size={18} />
            </a>

            {/* 通知 */}
            <div className="relative">
              <button
                onClick={e => { e.stopPropagation(); setShowNotifications(!showNotifications); }}
                className="p-2 text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-lg transition-all relative"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* 通知面板 */}
              {showNotifications && (
                <div className="fixed md:absolute left-2 right-2 md:left-auto md:right-0 top-14 md:top-full md:mt-1
                               md:w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden"
                  onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between p-3 border-b border-slate-800">
                    <span className="font-bold text-white text-sm">通知</span>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-[11px] text-blue-400 hover:text-blue-300">全部已讀</button>
                      )}
                      <button onClick={() => setShowNotifications(false)} className="md:hidden p-1 text-slate-400"><X size={16} /></button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {displayedNotifs.length > 0 ? displayedNotifs.map(n => (
                      <div key={n.id}
                        onClick={() => { markNotifRead(n.id); setExpandedNotifId(expandedNotifId === n.id ? null : n.id); }}
                        className={`p-3 border-b border-slate-800/50 hover:bg-slate-800/50 cursor-pointer text-sm ${
                          !readNotificationIds.includes(n.id) ? 'bg-blue-900/10' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-white text-xs">{n.title}</p>
                          <ChevronDown size={12} className={`text-slate-500 transition-transform ${expandedNotifId === n.id ? 'rotate-180' : ''}`} />
                        </div>
                        {expandedNotifId === n.id && (
                          <p className="text-slate-400 text-[11px] mt-2 whitespace-pre-wrap">{n.content}</p>
                        )}
                      </div>
                    )) : (
                      <p className="p-4 text-center text-slate-600 text-xs">暫無通知</p>
                    )}
                  </div>
                  {notifications.length > 3 && (
                    <button onClick={() => setShowAllNotifs(!showAllNotifs)}
                      className="w-full p-2 text-center text-[11px] text-blue-400 hover:bg-slate-800/50 border-t border-slate-800">
                      {showAllNotifs ? '收起' : `查看全部 (${notifications.length})`}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 功能建議 */}
            <button onClick={() => setShowFeedback(true)}
              className="p-2 text-slate-500 hover:text-emerald-400 hover:bg-slate-800/50 rounded-lg transition-all" title="功能建議">
              <Lightbulb size={18} />
            </button>

            {/* 設定 */}
            <div className="relative">
              <button onClick={e => { e.stopPropagation(); setShowSettingsMenu(!showSettingsMenu); }}
                className="p-2 text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-lg transition-all" title="設定">
                <Settings size={18} />
              </button>
              {showSettingsMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1"
                  onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setShowEditProfile(true); setShowSettingsMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white transition-all">
                    <User size={16} /> 編輯個人資料
                  </button>
                  <button onClick={() => { setShowChangePassword(true); setShowSettingsMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white transition-all">
                    <Lock size={16} /> 修改密碼
                  </button>
                  <button onClick={() => { setShowReferralEngine(true); setShowSettingsMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white transition-all">
                    <Gift size={16} /> 推薦好友
                  </button>
                </div>
              )}
            </div>

            {/* 登出 */}
            <button onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 rounded-lg text-xs font-medium transition-all">
              <LogOut size={14} />
              <span className="hidden sm:inline">登出</span>
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-1 -mb-px">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                    isActive
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                  {tab.id === 'clients' && clients.length > 0 && (
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 rounded-full">{clients.length}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ===== 主內容 ===== */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <OverviewTab
            user={user}
            profileData={profileData}
            membership={membership}
            clientCount={clients.length}
            onSwitchTab={setActiveTab}
            onAddClient={() => setShowAddClient(true)}
          />
        )}

        {activeTab === 'clients' && (
          <ClientsTab
            clients={clients}
            loading={clientsLoading}
            onSelectClient={onSelectClient}
            onAddClient={() => setShowAddClient(true)}
            onEditClient={c => { setEditingClient(c); setShowEditClient(true); }}
            onDeleteClient={handleDeleteClient}
          />
        )}

        {activeTab === 'tools' && (
          <ToolsTab
            isPaid={membership?.isPaid || false}
            onSelectTool={handleToolSelect}
            onSelectClient={() => setActiveTab('clients')}
            hasClients={clients.length > 0}
          />
        )}

        {activeTab === 'share' && (
          <ShareTab
            userId={user?.uid}
            userDisplayName={profileData.displayName || user?.displayName}
            userPhotoURL={profileData.photoURL || user?.photoURL}
            membership={membership}
          />
        )}
      </main>

      {/* ===== Modals ===== */}
      <AddClientModal isOpen={showAddClient} onClose={() => setShowAddClient(false)} onAdd={handleAddClient} />
      <EditClientModal isOpen={showEditClient} onClose={() => { setShowEditClient(false); setEditingClient(null); }}
        client={editingClient} onSave={handleEditClient} />
      <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} user={user}
        userName={profileData.displayName || user?.displayName || ''} />
      <ReferralEngineModal isOpen={showReferralEngine} onClose={() => setShowReferralEngine(false)} userId={user?.uid || ''} />
      <EditProfileModal isOpen={showEditProfile} onClose={() => setShowEditProfile(false)}
        user={user} profileData={profileData} onSave={handleSaveProfile} />
      <ChangePasswordModal isOpen={showChangePassword} onClose={() => setShowChangePassword(false)}
        userId={user?.uid} />

      {showCheckupSelector && user?.uid && (
        <CheckupClientSelector userId={user.uid}
          onClientSelected={(cId, cName) => { setShowCheckupSelector(false); if (onStartCheckup) onStartCheckup(cId, cName); }}
          onCancel={() => setShowCheckupSelector(false)} />
      )}
    </div>
  );
};

export default WarRoom;
