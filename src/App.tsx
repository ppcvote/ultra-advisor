import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import {
  Wallet, Building2, Coins, Check, ShieldAlert, Menu, X, LogOut, FileBarChart,
  GraduationCap, Umbrella, Waves, Landmark, Lock, Rocket, Car, Loader2,
  ChevronLeft, Users, ShieldCheck, Activity, History, LayoutDashboard, Flame,
  Sparkles, HeartPulse, GitBranch
} from 'lucide-react';

import { signOut, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { doc, setDoc, onSnapshot, Timestamp, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

// 組件匯入
import { LoginPage } from './components/auth/LoginPage';
import { SecretSignupPage } from './components/auth/SecretSignupPage';
// 🔧 PERF: LandingPage 2,699 行只給未登入訪客用 → lazy（splash 3 秒夠載入）
const LandingPage = lazy(() =>
  import('./components/LandingPage').then(m => ({ default: m.LandingPage }))
);

import ReportModal from './components/ReportModal';
import SplashScreen from './components/SplashScreen';

// 🆕 規劃界面改造新元件
import PlannerSidebar from './components/PlannerSidebar';
import UpgradeModal from './components/UpgradeModal';
import { Tool } from './constants/tools';
import { getMembershipInfo, MembershipInfo, defaultMembershipInfo } from './utils/membership'; 

// ✅ 新版戰情室（整合個人資料、密碼修改、客戶管理）
// 新版 WarRoom（Tab 架構）
// 🔧 PERF: 登入後才會用到的 WarRoom（含 ShareTab 等子分頁），延後到登入後再載
const UltraWarRoom = lazy(() => import('./components/WarRoom'));

// Lazy-loaded 工具元件（Code Splitting）
const FinancialRealEstateTool = lazy(() => import('./components/FinancialRealEstateTool'));
const StudentLoanTool = lazy(() => import('./components/StudentLoanTool'));
const SuperActiveSavingTool = lazy(() => import('./components/SuperActiveSavingTool').then(m => ({ default: m.SuperActiveSavingTool })));
const CarReplacementTool = lazy(() => import('./components/CarReplacementTool').then(m => ({ default: m.CarReplacementTool })));
const LaborPensionTool = lazy(() => import('./components/LaborPensionTool').then(m => ({ default: m.LaborPensionTool })));
const BigSmallReservoirTool = lazy(() => import('./components/BigSmallReservoirTool'));
const TaxPlannerTool = lazy(() => import('./components/TaxPlannerTool'));
const MillionDollarGiftTool = lazy(() => import('./components/MillionDollarGiftTool'));
const FreeDashboardTool = lazy(() => import('./components/FreeDashboardTool'));
const MarketDataZone = lazy(() => import('./components/MarketDataZone'));
const GoldenSafeVault = lazy(() => import('./components/GoldenSafeVault'));
const FundTimeMachine = lazy(() => import('./components/FundTimeMachine'));
const InsuranceCheckupTool = lazy(() => import('./components/insurance/InsuranceCheckupTool'));
const FamilyTreeTool = lazy(() => import('./components/insurance/FamilyTreeTool'));
import type { InsuranceCheckupData } from './types/insurance';

// 點數系統與會員權限
import { pointsApi } from './hooks/usePoints';
import { useMembership } from './hooks/useMembership';
// 🗑️ PointsDashboard 移除：0 觸發者，已從 UI 拿掉
// const PointsDashboard = lazy(() => import('./components/PointsDashboard'));
import PointsNotification from './components/PointsNotification';
import ToolLockedOverlay from './components/ToolLockedOverlay';

// Lazy-loaded 頁面
const PublicCalculator = lazy(() => import('./pages/PublicCalculator'));
const LiffRegister = lazy(() => import('./pages/LiffRegister'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const BookingPage = lazy(() => import('./pages/BookingPage'));
const ResearchPage = lazy(() => import('./pages/ResearchPage')); // 🆕 研究報告（AI Trust Thesis）
const AlliancePage = lazy(() => import('./pages/AlliancePage'));
const PartnerApplicationPage = lazy(() => import('./pages/PartnerApplicationPage'));
const UltraCloudDemo = lazy(() => import('./pages/UltraCloudDemo'));
const WhiteboardPage = lazy(() => import('./pages/WhiteboardPage'));
const EnglishLandingPage = lazy(() => import('./pages/EnglishLandingPage'));
// Legal pages — lazy so 首頁 cold-start 不背負合規長文的 bundle 體積
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
// Sprint 7 F: customer-facing share link target. Lazy so the public route
// chunk stays isolated from the logged-in advisor bundle.
const CustomerReportPage = lazy(() => import('./pages/CustomerReportPage'));
// Sprint 15 W1 — admin-only insurance review queue. Route gated by an
// `admins/{uid}` Firestore read (rules are the real boundary; the client
// check just avoids loading the admin chunk for non-admins).
const InsuranceReviewQueue = lazy(() => import('./admin/InsuranceReviewQueue'));
// Sprint 15 W2 — advisor-side condition revision alerts dashboard. Surfaced
// at /dashboard/condition-alerts (+ /dashboard/condition-alerts/:alertId for
// deeplinks from email / LINE notifications). Auth-gated like the rest of
// the planner shell; firestore.rules enforce the per-advisor boundary.
const ConditionAlerts = lazy(() => import('./dashboard/ConditionAlerts'));

// 🆕 主題切換
import { ThemeProvider } from './context/ThemeContext';

import { toast } from './utils/toast';
import { safeStorage } from './utils/safeStorage';
// Sprint 6: mirror currentClient → activeClientStore so tool chips can read
// the active client without prop drilling. App.tsx remains the single writer.
import { activeClientStore } from './lib/activeClientStore';
import { trackEvent, identify, resetIdentity } from './lib/analytics';
import { EVENTS } from './lib/events';
const generateSessionId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

const PrintStyles = () => (
  <style>{`
    @media print {
      aside, main, .no-print, .toast-container, .mobile-header, .print-hidden-bar { display: none !important; }
      body { background: white !important; height: auto !important; overflow: visible !important; }
      .print-break-inside { break-inside: avoid; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      #report-modal { position: static !important; overflow: visible !important; height: auto !important; width: 100% !important; z-index: 9999; }
      .absolute { position: static !important; }
      .print\\:block { display: block !important; }
      .print\\:grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
      ::-webkit-scrollbar { display: none; }
    }
  `}</style>
);

// 🗑️ 移除本地 Toast 元件：改用 utils/toast singleton（避免跟 import { toast } 撞名）

// 🆕 修改 NavItem 支援 locked 屬性
const NavItem = ({ icon: Icon, label, active, onClick, disabled = false, locked = false }: any) => (
  <div className="relative group">
    <button
      onClick={locked ? undefined : onClick}
      disabled={disabled || locked}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        locked ? 'opacity-60 cursor-not-allowed text-slate-500' :
        disabled ? 'opacity-50 cursor-not-allowed text-slate-500' :
        active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' :
        'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium flex-1 text-left">{label}</span>
      {locked && <Lock size={14} className="text-amber-500" />}
      {disabled && !locked && <Lock size={14} className="opacity-50" />}
    </button>
    {locked && (
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-800 border border-slate-700
                      rounded-lg text-xs text-amber-400 font-medium whitespace-nowrap opacity-0 group-hover:opacity-100
                      transition-opacity pointer-events-none z-50 shadow-xl">
        升級解鎖此工具
      </div>
    )}
  </div>
);

// 深連結意圖捕捉（Pin「做金句圖卡」→ ?tab=share）：在 auth gate 把未登入用戶
// 導去官網/登入「之前」就先存起來，登入後 WarRoom 讀回去開對的 tab（見 WarRoom/index.tsx）。
try {
  const _dlt = new URLSearchParams(window.location.search).get('tab') || window.location.hash.replace('#', '');
  if (_dlt && ['overview', 'clients', 'tools', 'share'].includes(_dlt)) {
    sessionStorage.setItem('pendingTab', _dlt);
  }
} catch { /* ignore */ }

export default function App() {
  // 網域重導向已移除 - 避免與 CDN 快取衝突造成無限循環

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // 免登入自動進場（Pin pinAuth 帶 ?ct=<Firebase custom token>）：用它登入後清掉 URL，
  // onAuthStateChanged 會設 user → WarRoom 讀 pendingTab 開分享頁。
  const [pinSigningIn, setPinSigningIn] = useState(() => {
    try { return !!new URLSearchParams(window.location.search).get('ct'); } catch { return false; }
  });
  useEffect(() => {
    let ct: string | null = null;
    try { ct = new URLSearchParams(window.location.search).get('ct'); } catch { /* ignore */ }
    if (!ct) return;
    signInWithCustomToken(auth, ct)
      .catch((err) => console.error('[pinAuth] custom-token sign-in failed:', err?.message))
      .finally(() => {
        try { window.history.replaceState({}, '', '/'); } catch { /* ignore */ }
        setPinSigningIn(false);
      });
  }, []);
  // 🆕 SplashScreen 只在這個 session 第一次進入時顯示
  const [minSplashTimePassed, setMinSplashTimePassed] = useState(() => {
    return sessionStorage.getItem('splash_shown') === 'true';
  }); 
  
  // 控制登入頁面顯示邏輯
  // 🆕 修復：重新整理後維持原介面，不跳回登入頁
  // - 如果 sessionStorage 有紀錄 = 這個 session 已經登入過
  // - 如果 localStorage 有 session_id = 曾經登入過（用於跨分頁/重開瀏覽器）
  const [needsLoginInteraction, setNeedsLoginInteraction] = useState(() => {
    const hasLoggedInThisSession = sessionStorage.getItem('last_login_page_shown');
    const hasSessionId = safeStorage.get('my_app_session_id');
    // 只要有任一紀錄，就不再顯示登入頁
    if (hasLoggedInThisSession || hasSessionId) return false;
    return true;
  });
 
  // 路由與同步狀態
  const [isSecretSignupRoute, setIsSecretSignupRoute] = useState(false); 
  const [isLoginRoute, setIsLoginRoute] = useState(false);
  const [isCalculatorRoute, setIsCalculatorRoute] = useState(false); // 🆕 傲創計算機路由
  const [isLiffRegisterRoute, setIsLiffRegisterRoute] = useState(false); // 🆕 LIFF 註冊路由
  const [isRegisterRoute, setIsRegisterRoute] = useState(false); // 🆕 公開註冊路由
  const [isBlogRoute, setIsBlogRoute] = useState(() => window.location.pathname.startsWith('/blog')); // 🆕 部落格路由（初始化時檢查 URL）
  const [isBookingRoute, setIsBookingRoute] = useState(() => window.location.pathname === '/booking'); // 🆕 預約試算路由
  const [isAllianceRoute, setIsAllianceRoute] = useState(() => window.location.pathname === '/alliance'); // 🆕 傲創聯盟路由
  const [isPartnerApplyRoute, setIsPartnerApplyRoute] = useState(() => window.location.pathname === '/partner-apply'); // 🆕 合作夥伴申請路由
  const [isUltraCloudDemoRoute, setIsUltraCloudDemoRoute] = useState(() => window.location.pathname === '/ultracloud'); // 🆕 UltraCloud Demo 路由
  const [isWhiteboardRoute, setIsWhiteboardRoute] = useState(() => window.location.pathname.startsWith('/whiteboard')); // 🆕 Ultra 白板
  const [isEnglishRoute, setIsEnglishRoute] = useState(() => window.location.pathname === '/en'); // 🆕 英文版
  const [isResearchRoute, setIsResearchRoute] = useState(() => window.location.pathname.startsWith('/research')); // 🆕 研究報告
  const [isPrivacyRoute, setIsPrivacyRoute] = useState(() => window.location.pathname === '/privacy'); // 個資法 §8 告知義務頁
  const [isTermsRoute, setIsTermsRoute] = useState(() => window.location.pathname === '/terms');       // 服務條款 / 消保法 §19 冷靜期
  // Sprint 7 F: /r/<tool>?d=<base64> — customer-facing share link.
  // Public (no auth), bypasses splash so the client opening from LINE doesn't
  // see the advisor-side Ultra Advisor splash screen first.
  const [isCustomerReportRoute, setIsCustomerReportRoute] = useState(() => window.location.pathname.startsWith('/r/'));
  // Sprint 15 W1 — /admin/insurance-review-queue (admin-only)
  const [isInsuranceReviewRoute, setIsInsuranceReviewRoute] = useState(() =>
    window.location.pathname === '/admin/insurance-review-queue'
  );
  // Sprint 15 W2 — /dashboard/condition-alerts(/{id}) (advisor-only)
  // Matches both bare path and deeplink form so an email/LINE link can drop
  // the advisor straight into a single alert detail card.
  const [isConditionAlertsRoute, setIsConditionAlertsRoute] = useState(() =>
    window.location.pathname === '/dashboard/condition-alerts' ||
    window.location.pathname.startsWith('/dashboard/condition-alerts/')
  );
  // Cached admin check — null = unknown, false = not admin, true = admin.
  // Populated lazily when entering an /admin/* route to avoid an extra
  // Firestore read for every non-admin session.
  const [isAdminUser, setIsAdminUser] = useState<boolean | null>(null);
  const [clientLoading, setClientLoading] = useState(false); 
  const [currentClient, setCurrentClient] = useState<any>(null);
  // Sprint 6: mirror currentClient → store. Read-only bridge for tool chips.
  // App.tsx is still the single writer; this effect just publishes the value.
  useEffect(() => {
    activeClientStore.set(currentClient ?? null);
  }, [currentClient]);
  // 🆕 activeTab 持久化：重新整理後保持在原工具介面
  const [activeTab, setActiveTab] = useState(() => {
    const saved = safeStorage.get('ultra_advisor_active_tab');
    return saved || 'golden_safe';
  }); 
  // 🗑️ 移除本地 toast state：改用 utils/toast singleton
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false); 
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);  // 🆕 追蹤未儲存狀態
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  // 🆕 點數系統狀態
  // 🗑️ 移除：const [isPointsDashboardOpen, setIsPointsDashboardOpen] = useState(false);
  const [pointsNotification, setPointsNotification] = useState<{points: number, reason: string, streak?: number} | null>(null);

  // 🆕 會員權限
  const { membership } = useMembership(user?.uid || null);

  // 🆕 升級 Modal 狀態
  const [upgradeModalTool, setUpgradeModalTool] = useState<Tool | null>(null);

  // 🆕 會員資訊狀態（用於 PlannerSidebar）
  const [membershipInfo, setMembershipInfo] = useState<MembershipInfo>(defaultMembershipInfo);
  
  const lastSavedDataStr = useRef<string>("");
  const isRegistering = useRef(false);

  // 工具數據狀態
  const defaultStates = {
    golden_safe: { mode: 'time', amount: 6, years: 10, rate: 6, isLocked: false, medicalLoss: 200, marketLoss: 30, taxLoss: 100 }, 
    gift: { loanAmount: 100, loanTerm: 7, loanRate: 2.8, investReturnRate: 6 },
    estate: { loanAmount: 1000, loanTerm: 30, loanRate: 2.2, investReturnRate: 6, existingLoanBalance: 700, existingMonthlyPayment: 38000 },
    student: { loanAmount: 40, investReturnRate: 6, years: 8, gracePeriod: 1, interestOnlyPeriod: 0, isQualified: false },
    super_active: { monthlySaving: 10000, investReturnRate: 6, activeYears: 15 },
    car: { carPrice: 100, investReturnRate: 6, resaleRate: 50, cycleYears: 5 },
    pension: { currentAge: 30, retireAge: 65, salary: 45000, laborInsYears: 35, selfContribution: false, pensionReturnRate: 3, desiredMonthlyIncome: 60000 },
    reservoir: { initialCapital: 1000, dividendRate: 5, reinvestRate: 8, years: 20 },
    tax: { spouse: true, children: 2, minorYearsTotal: 0, parents: 0, cash: 3000, realEstateMarket: 4000, stocks: 1000, insurancePlan: 0 },
    free_dashboard: { layout: [null, null, null, null] },
    insurance_checkup: { activeStep: 1 as const }
  };

  const [goldenSafeData, setGoldenSafeData] = useState(defaultStates.golden_safe); 
  const [giftData, setGiftData] = useState(defaultStates.gift);
  const [estateData, setEstateData] = useState(defaultStates.estate);
  const [studentData, setStudentData] = useState(defaultStates.student);
  const [superActiveData, setSuperActiveData] = useState(defaultStates.super_active);
  const [carData, setCarData] = useState(defaultStates.car);
  const [pensionData, setPensionData] = useState(defaultStates.pension);
  const [reservoirData, setReservoirData] = useState(defaultStates.reservoir);
  const [taxData, setTaxData] = useState(defaultStates.tax);
  const [freeDashboardLayout, setFreeDashboardLayout] = useState<(string | null)[]>(defaultStates.free_dashboard.layout);
  const [insuranceCheckupData, setInsuranceCheckupData] = useState<InsuranceCheckupData>(() => {
    // 從 localStorage 恢復 activeStep
    const savedStep = safeStorage.get('insurance_checkup_step');
    return savedStep ? { activeStep: parseInt(savedStep) as 1 | 2 } : defaultStates.insurance_checkup;
  });

  // 🗑️ 移除本地 showToast：改用 toast.success/.error/.info/.warning

  // ==========================================
  // 1. 安全機制：雙裝置限制邏輯
  // ==========================================
  const registerDeviceSession = async (uid: string) => {
    isRegistering.current = true;
    const newSessionId = generateSessionId();
    safeStorage.set('my_app_session_id', newSessionId);
    
    const metaRef = doc(db, 'users', uid, 'system', 'metadata');
    try {
      const docSnap = await getDoc(metaRef);
      let activeSessions: string[] = [];
      if (docSnap.exists() && docSnap.data().activeSessions) {
        activeSessions = docSnap.data().activeSessions;
      }
      activeSessions.push(newSessionId);
      if (activeSessions.length > 2) activeSessions = activeSessions.slice(-2);
      
      await setDoc(metaRef, { 
        activeSessions, 
        lastLoginTime: Timestamp.now(), 
        deviceInfo: navigator.userAgent 
      }, { merge: true });
    } catch (error) {
      console.error("Session update failed:", error);
    } finally {
      setTimeout(() => { isRegistering.current = false; }, 1500);
    }
  };

  useEffect(() => {
    if (isSecretSignupRoute || !user) return;
    const localSessionId = safeStorage.get('my_app_session_id');
    if (isRegistering.current || !localSessionId) return;

    const userMetaRef = doc(db, 'users', user.uid, 'system', 'metadata');
    const unsubscribe = onSnapshot(userMetaRef, async (docSnap) => {
      if (isRegistering.current) return;
      if (docSnap.exists()) {
        const activeSessions = docSnap.data().activeSessions || [];
        if (activeSessions.length > 0 && !activeSessions.includes(localSessionId)) {
          safeStorage.remove('my_app_session_id');
          await signOut(auth);
          toast.info("裝置數量超過限制：您的帳號已在其他裝置登入，此連線已自動登出。");
          window.location.reload();
        }
      }
    });
    return () => unsubscribe();
  }, [user, isSecretSignupRoute]);

  // ==========================================
  // 2. 性能優化：Firestore 防抖寫入
  // ==========================================
  const cleanDataForFirebase = (obj: any) => {
    return JSON.parse(JSON.stringify(obj, (key, value) => value === undefined ? null : value));
  };

  // 🆕 建立資料 payload（供自動存檔與手動存檔共用）
  const getDataPayload = () => ({
    goldenSafeData, giftData, estateData, studentData, superActiveData,
    carData, pensionData, reservoirData, taxData, freeDashboardLayout,
    insuranceCheckupData
  });

  // 🆕 執行存檔的共用函數
  const performSave = async (dataPayload: ReturnType<typeof getDataPayload>) => {
    if (!user || !currentClient) return;
    if (currentClient.id === 'self-checkup') return; // 虛擬客戶不存檔

    setIsSaving(true);
    setHasUnsavedChanges(false);
    try {
      const cleanedPayload = cleanDataForFirebase(dataPayload);
      await setDoc(doc(db, 'users', user.uid, 'clients', currentClient.id), {
        ...cleanedPayload,
        updatedAt: Timestamp.now()
      }, { merge: true });
      lastSavedDataStr.current = JSON.stringify(dataPayload);
      setTimeout(() => setIsSaving(false), 500);
    } catch (error) {
      console.error("Auto-save failed:", error);
      setIsSaving(false);
      setHasUnsavedChanges(true);  // 儲存失敗，標記為未儲存
    }
  };

  // 🆕 手動存檔函數
  const handleManualSave = () => {
    if (!user || !currentClient || !isDataLoaded) return;
    performSave(getDataPayload());
  };

  // 自動存檔邏輯
  useEffect(() => {
    if (!user || !currentClient || !isDataLoaded) return;

    const dataPayload = getDataPayload();
    const currentDataStr = JSON.stringify(dataPayload);

    // 資料沒變就不處理
    if (currentDataStr === lastSavedDataStr.current) return;

    // 標記為未儲存
    setHasUnsavedChanges(true);

    // 設定自動存檔延遲（10秒後自動儲存）
    const handler = setTimeout(() => {
      performSave(dataPayload);
    }, 10000);

    return () => clearTimeout(handler);
  }, [
    goldenSafeData, giftData, estateData, studentData, superActiveData,
    carData, pensionData, reservoirData, taxData, freeDashboardLayout,
    insuranceCheckupData, user, currentClient, isDataLoaded
  ]);

  // 保存 insurance_checkup 的 activeStep 到 localStorage（即時保存）
  useEffect(() => {
    if (insuranceCheckupData.activeStep) {
      safeStorage.set('insurance_checkup_step', insuranceCheckupData.activeStep.toString());
    }
  }, [insuranceCheckupData.activeStep]);

  // ==========================================
  // 3. UI 修復：手機選單背景滾動鎖定
  // ==========================================
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMobileMenuOpen]);

  // 其他業務邏輯
  const navigateTo = (path: string, action: () => void) => {
    window.history.pushState({ path }, '', path);
    action();
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setIsSecretSignupRoute(path === '/signup-secret');
      setIsLoginRoute(path === '/login');
      setIsCalculatorRoute(path === '/calculator');
      setIsLiffRegisterRoute(path === '/liff/register');
      setIsRegisterRoute(path === '/register'); // 🆕 公開註冊
      setIsBlogRoute(path.startsWith('/blog')); // 🆕 部落格（包含 /blog/xxx 文章頁）
      setIsBookingRoute(path === '/booking'); // 🆕 預約試算
      setIsAllianceRoute(path === '/alliance'); // 🆕 傲創聯盟
      setIsPartnerApplyRoute(path === '/partner-apply'); // 🆕 合作夥伴申請
      setIsUltraCloudDemoRoute(path === '/ultracloud'); // 🆕 UltraCloud Demo
      setIsWhiteboardRoute(path.startsWith('/whiteboard')); // 🆕 Ultra 白板
      setIsEnglishRoute(path === '/en'); // 🆕 英文版
      setIsResearchRoute(path.startsWith('/research')); // 🆕 研究報告
      setIsPrivacyRoute(path === '/privacy');
      setIsTermsRoute(path === '/terms');
      setIsCustomerReportRoute(path.startsWith('/r/')); // Sprint 7 F
      setIsInsuranceReviewRoute(path === '/admin/insurance-review-queue'); // Sprint 15 W1
      setIsConditionAlertsRoute(
        path === '/dashboard/condition-alerts' ||
        path.startsWith('/dashboard/condition-alerts/')
      ); // Sprint 15 W2
      if (path === '/') { setIsSecretSignupRoute(false); setIsLoginRoute(false); setIsCalculatorRoute(false); setIsLiffRegisterRoute(false); setIsRegisterRoute(false); setIsBlogRoute(false); setIsBookingRoute(false); setIsAllianceRoute(false); setIsPartnerApplyRoute(false); setIsUltraCloudDemoRoute(false); setIsWhiteboardRoute(false); setIsEnglishRoute(false); setIsResearchRoute(false); setIsPrivacyRoute(false); setIsTermsRoute(false); setIsCustomerReportRoute(false); setIsInsuranceReviewRoute(false); setIsConditionAlertsRoute(false); }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/signup-secret') setIsSecretSignupRoute(true);
    else if (path === '/login') setIsLoginRoute(true);
    else if (path === '/calculator') setIsCalculatorRoute(true);
    else if (path === '/liff/register') setIsLiffRegisterRoute(true);
    else if (path === '/register') setIsRegisterRoute(true); // 🆕 公開註冊
    else if (path.startsWith('/blog')) setIsBlogRoute(true); // 🆕 部落格（包含 /blog/xxx 文章頁）
    else if (path === '/booking') setIsBookingRoute(true); // 🆕 預約試算
    else if (path === '/alliance') setIsAllianceRoute(true); // 🆕 傲創聯盟
    else if (path === '/partner-apply') setIsPartnerApplyRoute(true); // 🆕 合作夥伴申請
    else if (path === '/ultracloud') setIsUltraCloudDemoRoute(true); // 🆕 UltraCloud Demo
    else if (path.startsWith('/whiteboard')) setIsWhiteboardRoute(true); // 🆕 Ultra 白板
    else if (path === '/en') setIsEnglishRoute(true); // 🆕 英文版
    else if (path === '/privacy') setIsPrivacyRoute(true);
    else if (path === '/terms') setIsTermsRoute(true);
    else if (path.startsWith('/r/')) setIsCustomerReportRoute(true); // Sprint 7 F
    else if (path === '/admin/insurance-review-queue') setIsInsuranceReviewRoute(true); // Sprint 15 W1
    else if (
      path === '/dashboard/condition-alerts' ||
      path.startsWith('/dashboard/condition-alerts/')
    ) setIsConditionAlertsRoute(true); // Sprint 15 W2

    // 🆕 SplashScreen 只在這個 session 第一次進入時顯示
    if (sessionStorage.getItem('splash_shown') !== 'true') {
      const timer = setTimeout(() => {
        setMinSplashTimePassed(true);
        sessionStorage.setItem('splash_shown', 'true');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    // 每個 session 只發一次 first_login，避免重新整理灌水
    let firstLoginEmitted = false;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (!currentUser) {
        setCurrentClient(null);
        setIsDataLoaded(false);
        // 登出時清掉 PostHog identity，避免下個使用者繼承
        resetIdentity();
        firstLoginEmitted = false;
        return;
      }
      // 取得 token 後第一次 → 算 first_login
      if (!firstLoginEmitted) {
        firstLoginEmitted = true;
        identify(currentUser.uid);
        trackEvent(EVENTS.FIRST_LOGIN, { uid: currentUser.uid });
      }
    });
    return () => unsubscribe();
  }, []);

  // 🆕 activeTab 變化時保存到 localStorage（重新整理後保持原介面）
  useEffect(() => {
    safeStorage.set('ultra_advisor_active_tab', activeTab);
    // 同步埋 tool_opened：所有 setActiveTab 入口（NavItem / WarRoom / DeepLink）共用這條路徑，
    // 不必到 ~30 個 onClick 個別埋
    trackEvent(EVENTS.TOOL_OPENED, { tool: activeTab });
  }, [activeTab]);

  // firstRun 偵測 — 觸發條件:
  //   1. URL 帶 ?firstRun=1（註冊頁登入流程附帶；測試也可手動帶）
  //   2. user.metadata.creationTime 在 5 分鐘內（剛 createUserWithEmailAndPassword 完）
  // 行為:
  //   - 強制把 activeTab 帶到 'overview'，避免 user 一進來看到上次 session 殘留的工具頁
  //   - setTimeout 100ms 觸發 onboarding_started analytics（讓 PostHog identify
  //     先呼叫完，這個 timing 跟 first_login 的 fire-and-forget 一致）
  //   - 並 seed 3 個 sample clients；seedSampleClients 內部會自己 idempotent 檢查
  //     existing clients > 0 就跳過，所以重複觸發是安全的
  //   - 同一 uid 只觸發一次：用 sessionStorage 做 latch（不能用 localStorage，
  //     不同瀏覽器要能各自觸發；也不能用 useRef，重新整理後 ref 會重置但 sessionStorage
  //     仍存在，避免 reload 重複 seed）
  useEffect(() => {
    if (!user) return;
    const latchKey = `firstRun_done_${user.uid}`;
    if (sessionStorage.getItem(latchKey)) return;

    // ?firstRun=1 只在 non-prod 允許（被偽造的 URL 不應該注入 sample clients
    // 進已存在的 prod 帳號，會混到顧問真實客戶）
    const urlFlag = !import.meta.env.PROD && (() => {
      try { return new URLSearchParams(window.location.search).get('firstRun') === '1'; }
      catch { return false; }
    })();

    let isWithinFirstRunWindow = urlFlag;
    if (!isWithinFirstRunWindow) {
      const createdAtStr = user.metadata?.creationTime;
      if (createdAtStr) {
        const createdAtMs = new Date(createdAtStr).getTime();
        if (!Number.isNaN(createdAtMs)) {
          isWithinFirstRunWindow = Date.now() - createdAtMs < 5 * 60 * 1000;
        }
      }
    }
    if (!isWithinFirstRunWindow) {
      sessionStorage.setItem(latchKey, '1');
      return;
    }

    sessionStorage.setItem(latchKey, '1');
    setActiveTab('overview');

    // Fire-and-forget seed — 失敗 fallback 為「沒有 sample client」，
    // OverviewTab 的 missions list 仍能用，所以可以 silent
    (async () => {
      try {
        const { seedSampleClients } = await import('./lib/sampleClients');
        await seedSampleClients(user.uid);
      } catch (err) {
        console.warn('[firstRun] seedSampleClients import/exec failed:', err);
      }
    })();

    // 100ms 延後讓 identify() 先 flush
    const t = setTimeout(() => {
      trackEvent('onboarding_started', { uid: user.uid, source: urlFlag ? 'url_flag' : 'createdAt' });
    }, 100);
    return () => clearTimeout(t);
  }, [user]);

  // 🆕 監聽 Firestore 用戶資料，更新會員資訊
  useEffect(() => {
    if (!user) {
      setMembershipInfo(defaultMembershipInfo);
      return;
    }
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setMembershipInfo(getMembershipInfo(docSnap.data()));
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Sprint 15 W1 — lazy admin check (only fires when admin route is active).
  // Reads `admins/{uid}` doc; rules already gate the actual queue data, this
  // client check just avoids rendering the queue UI for non-admins.
  useEffect(() => {
    if (!isInsuranceReviewRoute) return;
    if (!user) { setIsAdminUser(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'admins', user.uid));
        if (!cancelled) setIsAdminUser(snap.exists());
      } catch (err) {
        if (!cancelled) {
          console.warn('[admin] isAdmin check failed:', err);
          setIsAdminUser(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isInsuranceReviewRoute, user]);

  // 🆕 升級引導處理
  const handleUpgradeClick = (tool: Tool) => {
    setUpgradeModalTool(tool);
  };

  const handleUpgradeConfirm = () => {
    // 導向付款頁面
    window.open('https://portaly.cc/ultraadvisor/plans', '_blank');
    setUpgradeModalTool(null);
  };

  // 客戶資料監聽
  useEffect(() => {
      if (!user || !currentClient) { setIsDataLoaded(false); return; }
      // 虛擬客戶（從戰情室直接跳轉工具）不需要載入 Firestore 資料
      if (currentClient.id === 'self-checkup') {
        // 重置所有工具資料為預設值，避免殘留前一個客戶的資料
        setInsuranceCheckupData(defaultStates.insurance_checkup);
        setGoldenSafeData(defaultStates.golden_safe);
        setGiftData(defaultStates.gift);
        setEstateData(defaultStates.estate);
        setStudentData(defaultStates.student);
        setSuperActiveData(defaultStates.super_active);
        setCarData(defaultStates.car);
        setPensionData(defaultStates.pension);
        setReservoirData(defaultStates.reservoir);
        setTaxData(defaultStates.tax);
        setFreeDashboardLayout(defaultStates.free_dashboard.layout);
        setIsDataLoaded(true);
        return;
      }
      setClientLoading(true);
      const clientDocRef = doc(db, 'users', user.uid, 'clients', currentClient.id);
      const unsubscribeClient = onSnapshot(clientDocRef, (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data();
              if (data.goldenSafeData) setGoldenSafeData(prev => ({...prev, ...data.goldenSafeData}));
              if (data.giftData) setGiftData(prev => ({...prev, ...data.giftData}));
              if (data.estateData) setEstateData(prev => ({...prev, ...data.estateData}));
              if (data.studentData) setStudentData(prev => ({...prev, ...data.studentData}));
              if (data.superActiveData) setSuperActiveData(prev => ({...prev, ...data.superActiveData}));
              if (data.carData) setCarData(prev => ({...prev, ...data.carData}));
              if (data.pensionData) setPensionData(prev => ({...prev, ...data.pensionData}));
              if (data.reservoirData) setReservoirData(prev => ({...prev, ...data.reservoirData}));
              if (data.taxData) setTaxData(prev => ({...prev, ...data.taxData}));
              if (data.freeDashboardLayout) setFreeDashboardLayout(data.freeDashboardLayout);
              if (data.insuranceCheckupData) setInsuranceCheckupData(prev => ({...prev, ...data.insuranceCheckupData}));
          }
          setClientLoading(false);
          setIsDataLoaded(true); 
      });
      return () => unsubscribeClient();
  }, [currentClient?.id, user]); 

  const handleLogout = async () => { 
      safeStorage.remove('my_app_session_id');
      await signOut(auth); 
      setCurrentClient(null);
      setIsDataLoaded(false);
      toast.info("已安全登出"); 
  };

  const getCurrentData = () => {
    switch(activeTab) {
      case 'golden_safe': return goldenSafeData; 
      case 'gift': return giftData;
      case 'estate': return estateData;
      case 'student': return studentData;
      case 'super_active': return superActiveData;
      case 'car': return carData;
      case 'reservoir': return reservoirData;
      case 'pension': return pensionData;
      case 'tax': return taxData;
      case 'insurance_checkup': return insuranceCheckupData;
      default: return {};
    }
  };

  // 🆕 工具權限檢查函數
  const canAccessTool = (toolId: string): boolean => {
    if (!membership) return true; // 還沒載入時先放行
    return membership.canAccessTool(toolId);
  };

  // 🆕 渲染工具（帶權限檢查）
  const renderTool = (toolId: string, ToolComponent: React.ReactNode, toolName: string) => {
    if (canAccessTool(toolId)) {
      return ToolComponent;
    }
    return <ToolLockedOverlay toolName={toolName} />;
  };

  // 🆕 LIFF 註冊頁面（不需登入，從 LINE 開啟，跳過 SplashScreen）
  if (isLiffRegisterRoute) {
    return (
      <Suspense fallback={<SplashScreen />}>
      <LiffRegister
        onSuccess={() => {
          setIsLiffRegisterRoute(false);
          window.history.pushState({}, '', '/');
        }}
      />
      </Suspense>
    );
  }

  // 🆕 公開註冊頁面（不需登入，跳過 SplashScreen）
  if (isRegisterRoute) {
    return (
      <Suspense fallback={<SplashScreen />}>
      <RegisterPage
        onSuccess={() => {
          // 註：RegisterPage 內已 auto-signInWithEmailAndPassword 完成、
          // 並透過 goToHome 自己 reload 到 /?firstRun=1（會跳過 Splash 3 秒）。
          // 此 callback 目前是 future-safe 預留（萬一未來 RegisterPage 改流程直接 callback 而非 reload）：
          // 進 /?firstRun=1 + 預設 splash_shown，讓 onAuthStateChanged 直接帶進 WarRoom OverviewTab。
          try { sessionStorage.setItem('splash_shown', 'true'); } catch { /* ignore */ }
          setIsRegisterRoute(false);
          window.history.pushState({}, '', '/?firstRun=1');
          window.location.reload();
        }}
        onBack={() => {
          setIsRegisterRoute(false);
          window.history.pushState({}, '', '/');
        }}
        onLogin={() => {
          setIsRegisterRoute(false);
          setIsLoginRoute(true);
          window.history.pushState({}, '', '/login');
        }}
      />
      </Suspense>
    );
  }

  // 🆕 預約試算頁面（不需登入）
  if (isBookingRoute || window.location.pathname === '/booking') {
    return (
      <Suspense fallback={<SplashScreen />}>
      <BookingPage
        onBack={() => {
          setIsBookingRoute(false);
          window.history.pushState({}, '', '/');
          window.location.reload();
        }}
        onLogin={() => {
          setIsBookingRoute(false);
          setIsLoginRoute(true);
          window.history.pushState({}, '', '/login');
        }}
      />
      </Suspense>
    );
  }

  // 🆕 傲創聯盟頁面（不需登入）
  if (isAllianceRoute || window.location.pathname === '/alliance') {
    return (
      <Suspense fallback={<SplashScreen />}>
      <AlliancePage
        onBack={() => {
          setIsAllianceRoute(false);
          window.history.pushState({}, '', '/');
          window.location.reload();
        }}
        onLogin={() => {
          setIsAllianceRoute(false);
          setIsLoginRoute(true);
          window.history.pushState({}, '', '/login');
        }}
      />
      </Suspense>
    );
  }

  // 🆕 合作夥伴申請頁面（不需登入）
  if (isPartnerApplyRoute || window.location.pathname === '/partner-apply') {
    return (
      <Suspense fallback={<SplashScreen />}>
      <PartnerApplicationPage
        onBack={() => {
          setIsPartnerApplyRoute(false);
          setIsAllianceRoute(true);
          window.history.pushState({}, '', '/alliance');
        }}
      />
      </Suspense>
    );
  }

  // 🆕 UltraCloud Logo 展示頁面（不需登入）
  // 🆕 英文版首頁（不需登入，跳過 SplashScreen）
  if (isEnglishRoute || window.location.pathname === '/en') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#030712]" />}>
        <EnglishLandingPage
          onBack={() => {
            setIsEnglishRoute(false);
            window.history.pushState({}, '', '/');
            window.location.reload();
          }}
        />
      </Suspense>
    );
  }

  // 隱私權政策（公開、不需登入）— 個資法 §8 告知五要項、可直接 link 自註冊頁勾選框
  if (isPrivacyRoute || window.location.pathname === '/privacy') {
    return (
      <Suspense fallback={<SplashScreen />}>
        <PrivacyPage
          onBack={() => {
            setIsPrivacyRoute(false);
            window.history.pushState({}, '', '/');
            window.location.reload();
          }}
        />
      </Suspense>
    );
  }

  // 服務條款（公開、不需登入）
  if (isTermsRoute || window.location.pathname === '/terms') {
    return (
      <Suspense fallback={<SplashScreen />}>
        <TermsPage
          onBack={() => {
            setIsTermsRoute(false);
            window.history.pushState({}, '', '/');
            window.location.reload();
          }}
        />
      </Suspense>
    );
  }

  // Sprint 7 F — customer-facing share link target.
  // Public route: no auth, no splash. Bypasses login/firstRun/onboarding so
  // a client opening the link from LINE sees the report in one screen.
  // Placed before the `if (loading...)` guard and before the auth `if (!user)`
  // gate intentionally.
  if (isCustomerReportRoute || window.location.pathname.startsWith('/r/')) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 px-4">
            <div className="w-10 h-10 border-4 border-slate-700 border-t-blue-400 rounded-full animate-spin mb-4" />
            <div className="text-sm">載入試算結果...</div>
            <div className="text-xs text-slate-500 mt-1">在 LINE 內首次開啟可能需要幾秒</div>
          </div>
        }
      >
        <CustomerReportPage />
      </Suspense>
    );
  }

  if (isUltraCloudDemoRoute || window.location.pathname === '/ultracloud') {
    return (
      <Suspense fallback={<SplashScreen />}>
      <UltraCloudDemo
        onBack={() => {
          setIsUltraCloudDemoRoute(false);
          window.history.pushState({}, '', '/');
          window.location.reload();
        }}
      />
      </Suspense>
    );
  }

  // 🆕 Ultra 白板 — 即時協作白板，iPad 友善
  if (isWhiteboardRoute || window.location.pathname.startsWith('/whiteboard')) {
    return (
      <Suspense fallback={<SplashScreen />}>
        <WhiteboardPage />
      </Suspense>
    );
  }

  // 🆕 部落格頁面（不需登入，跳過 SplashScreen）
  // 使用雙重檢查：state 或直接檢查 URL
  if (isBlogRoute || window.location.pathname.startsWith('/blog')) {
    return (
      <Suspense fallback={<SplashScreen />}>
      <BlogPage
        onBack={() => {
          setIsBlogRoute(false);
          window.history.pushState({}, '', '/');
          window.location.reload();
        }}
        onLogin={() => {
          setIsBlogRoute(false);
          setIsRegisterRoute(true);
          window.history.pushState({}, '', '/register');
        }}
      />
      </Suspense>
    );
  }

  // 🆕 研究報告（公開，不需登入）— /research、/research/:slug
  if (isResearchRoute || window.location.pathname.startsWith('/research')) {
    return (
      <Suspense fallback={<SplashScreen />}>
        <ResearchPage
          onBack={() => {
            setIsResearchRoute(false);
            window.history.pushState({}, '', '/');
            window.location.reload();
          }}
        />
      </Suspense>
    );
  }

  // Sprint 15 W1 — admin-only review queue. Render before splash gate so
  // admins don't sit through the 3-second splash on every navigation.
  if (isInsuranceReviewRoute || window.location.pathname === '/admin/insurance-review-queue') {
    if (loading) return <SplashScreen />;
    if (!user) {
      // Not signed in — bounce to login. Preserve the deep link via pushState
      // so post-login navigation can return here in a future iteration.
      window.history.replaceState({}, '', '/login');
      setIsInsuranceReviewRoute(false);
      setIsLoginRoute(true);
      return <SplashScreen />;
    }
    if (isAdminUser === null) {
      // Check still in flight — short spinner instead of full splash.
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
          <div className="text-center">
            <div className="w-8 h-8 mx-auto mb-3 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
            驗證管理權限…
          </div>
        </div>
      );
    }
    if (isAdminUser === false) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
          <div className="max-w-sm text-center">
            <div className="text-4xl mb-3">🔒</div>
            <h1 className="text-lg font-bold text-slate-800 mb-1">需要管理權限</h1>
            <p className="text-sm text-slate-500 mb-5">此頁面僅限管理員存取。</p>
            <button
              onClick={() => {
                window.history.pushState({}, '', '/');
                setIsInsuranceReviewRoute(false);
                window.location.reload();
              }}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              ← 返回戰情室
            </button>
          </div>
        </div>
      );
    }
    return (
      <Suspense fallback={<SplashScreen />}>
        <InsuranceReviewQueue />
      </Suspense>
    );
  }

  // Sprint 15 W2 — advisor-only condition revision alerts dashboard. Renders
  // before splash so deeplinks from email / LINE notifications open straight
  // into the alert (no 3-second blackout). Unauthed → bounce to /login,
  // preserving the deeplinked id by way of `pendingTab` is overkill for an
  // auth-gated dashboard; we just send them to /login.
  if (isConditionAlertsRoute ||
      window.location.pathname === '/dashboard/condition-alerts' ||
      window.location.pathname.startsWith('/dashboard/condition-alerts/')) {
    if (loading) return <SplashScreen />;
    if (!user) {
      window.history.replaceState({}, '', '/login');
      setIsConditionAlertsRoute(false);
      setIsLoginRoute(true);
      return <SplashScreen />;
    }
    return (
      <Suspense fallback={<SplashScreen />}>
        <ConditionAlerts />
      </Suspense>
    );
  }

  if (loading || !minSplashTimePassed) return <SplashScreen />;

  // 🆕 公開計算機（不需登入，但會員可使用額外功能）
  if (isCalculatorRoute) {
    return (
      <Suspense fallback={<SplashScreen />}>
      <PublicCalculator
        onBack={() => {
          setIsCalculatorRoute(false);
          window.history.pushState({}, '', '/');
        }}
        onLogin={() => {
          setIsCalculatorRoute(false);
          setIsRegisterRoute(true);
          window.history.pushState({}, '', '/register');
        }}
        user={user}
      />
      </Suspense>
    );
  }

  if (isSecretSignupRoute) {
      return <SecretSignupPage onSignupSuccess={() => {
          toast.success("🎉 帳號開通成功！");
          setIsSecretSignupRoute(false);
          window.location.href = '/'; 
      }} />;
  }

  // 免登入自動進場進行中：別閃登入頁，給個過場
  if (pinSigningIn && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-3 border-2 border-slate-600 border-t-teal-400 rounded-full animate-spin" />
          登入中…
        </div>
      </div>
    );
  }

  if (!user || needsLoginInteraction) {
    // 帶深連結意圖（Pin「做金句圖卡」→ ?tab=share）的未登入用戶，直接給登入頁、
    // 別丟去行銷官網 —— 登入後 WarRoom 會用 sessionStorage 的 pendingTab 開對的頁。
    let _hasPendingDeepLink = false;
    try { _hasPendingDeepLink = !!sessionStorage.getItem('pendingTab'); } catch { /* ignore */ }
    if (isLoginRoute || user || _hasPendingDeepLink) {
      return <LoginPage
        user={user}
        onLoginSuccess={async () => {
          sessionStorage.setItem('last_login_page_shown', Date.now().toString());
          setNeedsLoginInteraction(false);
          if (!user && auth.currentUser) {
            registerDeviceSession(auth.currentUser.uid);
          }
          setIsLoginRoute(false);
          window.history.pushState({}, '', '/');
          
          // 🆕 觸發每日登入獎勵
          try {
            const result = await pointsApi.dailyLogin();
            if (result?.dailyReward?.success && result.dailyReward.points) {
              setPointsNotification({
                points: result.dailyReward.points,
                reason: '每日登入獎勵',
                streak: result.loginStreak
              });
            }
            // 連續登入獎勵
            if (result?.streakReward?.success && result.streakReward.points) {
              setTimeout(() => {
                setPointsNotification({
                  points: result.streakReward!.points!,
                  reason: `連續登入 ${result.loginStreak} 天獎勵`,
                  streak: result.loginStreak
                });
              }, 3500);
            }
          } catch (err) {
            console.error('Daily login reward error:', err);
          }
        }} 
      />;
    }
    return (
      <ThemeProvider>
        <Suspense fallback={<SplashScreen />}>
          <LandingPage
            onStart={() => navigateTo('/login', () => setIsLoginRoute(true))}
            onSignup={() => navigateTo('/signup-secret', () => setIsSecretSignupRoute(true))}
            onHome={() => navigateTo('/', () => { setIsLoginRoute(false); setIsSecretSignupRoute(false); })}
          />
        </Suspense>
      </ThemeProvider>
    );
  }

  // ✅ 使用新版 UltraWarRoom 取代舊的 ClientDashboard
  if (!currentClient) {
      return (
          <ThemeProvider>
            {/* 🗑️ 本地 Toast 移除 — toast singleton 自己負責 DOM mount */}
            {/* 🆕 點數獲得通知 */}
            {pointsNotification && (
              <PointsNotification
                points={pointsNotification.points}
                reason={pointsNotification.reason}
                streak={pointsNotification.streak}
                onClose={() => setPointsNotification(null)}
              />
            )}
            {/* 🗑️ PointsDashboard 已移除 — 0 觸發者，僅後端記點 */}
            <Suspense fallback={<SplashScreen />}>
              <UltraWarRoom
                user={user}
                onSelectClient={setCurrentClient}
                onLogout={handleLogout}
                onNavigateToTool={(toolId) => {
                  // 以虛擬客戶進入工具介面，然後跳轉到指定工具
                  setCurrentClient({ id: 'self-checkup', name: '保單健診（個人）', phone: '', note: '' });
                  setActiveTab(toolId);
                }}
                onStartCheckup={(clientId, clientName) => {
                  // 保單健診：綁定真實客戶
                  setCurrentClient({ id: clientId, name: clientName, phone: '', note: '' });
                  setInsuranceCheckupData({ activeStep: 1, clientId });
                  setActiveTab('insurance_checkup');
                }}
              />
            </Suspense>
          </ThemeProvider>
      );
  }

  return (
    <ThemeProvider>
    {/* 規劃系統強制使用淺色背景，不受主題切換影響 */}
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <PrintStyles />
      {/* 🗑️ 本地 Toast 移除 — utils/toast singleton 自己負責 DOM mount */}

      {/* 🆕 點數獲得通知 */}
      {pointsNotification && (
        <PointsNotification
          points={pointsNotification.points}
          reason={pointsNotification.reason}
          streak={pointsNotification.streak}
          onClose={() => setPointsNotification(null)}
        />
      )}

      {/* 🗑️ PointsDashboard 已移除 — setIsPointsDashboardOpen(true) 整個 src/ 0 個呼叫者
          dailyLogin 仍會記點數到 Firestore（用於 backend analytics），但用戶 UI 不顯示。
          要恢復時：sidebar 加觸發按鈕 + 還原 lazy import + state */}

      {clientLoading && (
          <div className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center">
                  <Loader2 className="animate-spin text-blue-600 mx-auto mb-2" size={40}/>
                  <p className="text-slate-600 font-bold">正在讀取 {currentClient.name} 的檔案...</p>
              </div>
          </div>
      )}

      <ReportModal 
        isOpen={isReportOpen} 
        onClose={() => setIsReportOpen(false)} 
        user={user} 
        client={currentClient}
        activeTab={activeTab} 
        data={getCurrentData()} 
      />

      {/* 手機版側邊選單 */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[150] md:hidden">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm animate-fade-in" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-72 bg-slate-900 text-white flex flex-col shadow-2xl animate-slide-in">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <span className="font-bold">選單</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-slate-800 rounded-full"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <button onClick={() => setCurrentClient(null)} className="w-full flex items-center gap-2 text-slate-400 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-lg transition-all mb-4">
                <ChevronLeft size={18}/> 返回戰情室
              </button>
              
              {/* 觀念與診斷 */}
              <div className="text-xs font-bold text-yellow-400 px-4 py-2 uppercase tracking-wider flex items-center gap-2 mt-2">觀念與診斷</div>
              <NavItem icon={LayoutDashboard} label="自由組合戰情室" active={activeTab === 'free_dashboard'} onClick={() => { setActiveTab('free_dashboard'); setIsMobileMenuOpen(false); }} locked={!canAccessTool('free_dashboard')} />
              <NavItem icon={ShieldCheck} label="黃金保險箱理論" active={activeTab === 'golden_safe'} onClick={() => { setActiveTab('golden_safe'); setIsMobileMenuOpen(false); }} locked={!canAccessTool('golden_safe')} />
              <NavItem icon={Activity} label="市場數據戰情室" active={activeTab === 'market_data'} onClick={() => { setActiveTab('market_data'); setIsMobileMenuOpen(false); }} locked={!canAccessTool('market_data')} />
              <NavItem icon={History} label="基金時光機" active={activeTab === 'fund_machine'} onClick={() => { setActiveTab('fund_machine'); setIsMobileMenuOpen(false); }} locked={!canAccessTool('fund_machine')} />
              
              {/* 創富 */}
              <div className="text-xs font-bold text-emerald-400 px-4 py-2 uppercase tracking-wider flex items-center gap-2 mt-4">
                創富：資產配置
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <Sparkles size={10} />PRO
                </span>
              </div>
              <NavItem icon={Wallet} label="百萬禮物專案" active={activeTab === 'gift'} onClick={() => { setActiveTab('gift'); setIsMobileMenuOpen(false); }} locked={!canAccessTool('gift')} />
              <NavItem icon={Building2} label="金融房產專案" active={activeTab === 'estate'} onClick={() => { setActiveTab('estate'); setIsMobileMenuOpen(false); }} locked={!canAccessTool('estate')} />
              <NavItem icon={GraduationCap} label="學貸活化專案" active={activeTab === 'student'} onClick={() => { setActiveTab('student'); setIsMobileMenuOpen(false); }} locked={!canAccessTool('student')} />
              <NavItem icon={Rocket} label="超積極存錢法" active={activeTab === 'super_active'} onClick={() => { setActiveTab('super_active'); setIsMobileMenuOpen(false); }} locked={!canAccessTool('super_active')} />
              
              {/* 守富 */}
              <div className="text-xs font-bold text-blue-400 px-4 py-2 uppercase tracking-wider flex items-center gap-2 mt-4">
                守富：風險控管
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <Sparkles size={10} />PRO
                </span>
              </div>
              <NavItem icon={Waves} label="大小水庫專案" active={activeTab === 'reservoir'} onClick={() => { setActiveTab('reservoir'); setIsMobileMenuOpen(false); }} locked={!canAccessTool('reservoir')} />
              <NavItem icon={Car} label="五年換車專案" active={activeTab === 'car'} onClick={() => { setActiveTab('car'); setIsMobileMenuOpen(false); }} locked={!canAccessTool('car')} />
              <NavItem icon={Umbrella} label="退休缺口試算" active={activeTab === 'pension'} onClick={() => { setActiveTab('pension'); setIsMobileMenuOpen(false); }} locked={!canAccessTool('pension')} />
              
              {/* 傳富 */}
              <div className="text-xs font-bold text-purple-400 px-4 py-2 uppercase tracking-wider flex items-center gap-2 mt-4">
                傳富：稅務傳承
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <Sparkles size={10} />PRO
                </span>
              </div>
              <NavItem icon={Landmark} label="稅務傳承專案" active={activeTab === 'tax'} onClick={() => { setActiveTab('tax'); setIsMobileMenuOpen(false); }} locked={!canAccessTool('tax')} />

              {/* 保單健診 */}
              <div className="text-xs font-bold text-rose-400 px-4 py-2 uppercase tracking-wider flex items-center gap-2 mt-4">
                保單健診
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <Sparkles size={10} />PRO
                </span>
              </div>
              <NavItem icon={HeartPulse} label="保單健診系統" active={activeTab === 'insurance_checkup'} onClick={() => { setActiveTab('insurance_checkup'); setIsMobileMenuOpen(false); }} locked={!canAccessTool('insurance_checkup')} />
              <NavItem icon={GitBranch} label="家庭圖管理" active={activeTab === 'family_tree'} onClick={() => { setActiveTab('family_tree'); setIsMobileMenuOpen(false); }} locked={!canAccessTool('family_tree')} />
            </div>
            <div className="p-4 border-t border-slate-800 space-y-2">
              <button onClick={() => { setIsReportOpen(true); setIsMobileMenuOpen(false); }} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-3 rounded-xl w-full">
                <FileBarChart size={18} /> 生成策略報表
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* 🆕 桌面版側邊欄（使用新的 PlannerSidebar 元件） */}
      <div className="hidden md:block">
        <PlannerSidebar
          client={currentClient}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onBack={() => setCurrentClient(null)}
          onGenerateReport={() => setIsReportOpen(true)}
          saveStatus={isSaving ? 'saving' : (hasUnsavedChanges ? 'unsaved' : 'saved')}
          membershipInfo={membershipInfo}
          onUpgradeClick={handleUpgradeClick}
          onManualSave={handleManualSave}
        />
      </div>

      {/* 🆕 升級引導 Modal */}
      <UpgradeModal
        isOpen={!!upgradeModalTool}
        onClose={() => setUpgradeModalTool(null)}
        tool={upgradeModalTool}
        onUpgrade={handleUpgradeConfirm}
      />

      {/* 主內容區塊 */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center shadow-md shrink-0 print:hidden">
          <div className="font-bold flex items-center gap-2 uppercase tracking-tighter">
              <Users size={20} className="text-blue-400"/>
              <span>{currentClient.name}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsReportOpen(true)} className="p-2 bg-slate-800 rounded-lg active:bg-slate-700"><FileBarChart size={24} /></button>
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-slate-800 rounded-lg active:bg-slate-700"><Menu size={24} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
            <div className="max-w-5xl mx-auto pb-20 md:pb-0">
              <Suspense fallback={<div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-blue-400" /></div>}>
              {/* 帶權限檢查的工具渲染 */}
              {activeTab === 'market_data' && renderTool('market_data', <MarketDataZone />, '市場數據戰情室')}
              {activeTab === 'golden_safe' && renderTool('golden_safe', <GoldenSafeVault data={goldenSafeData} setData={setGoldenSafeData} userId={user?.uid} />, '黃金保險箱理論')}
              {activeTab === 'fund_machine' && renderTool('fund_machine', <FundTimeMachine />, '基金時光機')}
              {activeTab === 'gift' && renderTool('gift', <MillionDollarGiftTool data={giftData} setData={setGiftData} userId={user?.uid} />, '百萬禮物專案')}
              {activeTab === 'estate' && <FinancialRealEstateTool data={estateData} setData={setEstateData} />}
              {activeTab === 'student' && renderTool('student', <StudentLoanTool data={studentData} setData={setStudentData} />, '學貸活化專案')}
              {activeTab === 'super_active' && renderTool('super_active', <SuperActiveSavingTool data={superActiveData} setData={setSuperActiveData} />, '超積極存錢法')}
              {activeTab === 'car' && renderTool('car', <CarReplacementTool data={carData} setData={setCarData} />, '五年換車專案')}
              {activeTab === 'reservoir' && <BigSmallReservoirTool data={reservoirData} setData={setReservoirData} />}
              {activeTab === 'pension' && renderTool('pension', <LaborPensionTool data={pensionData} setData={setPensionData} />, '退休缺口試算')}
              {activeTab === 'tax' && <TaxPlannerTool data={taxData} setData={setTaxData} />}
              {activeTab === 'free_dashboard' && renderTool('free_dashboard', (
                <FreeDashboardTool 
                  allData={{goldenSafeData, giftData, estateData, studentData, superActiveData, carData, pensionData, reservoirData, taxData}} 
                  setAllData={{goldenSafeData: setGoldenSafeData, giftData: setGiftData, estateData: setEstateData, studentData: setStudentData, superActiveData: setSuperActiveData, carData: setCarData, pensionData: setPensionData, reservoirData: setReservoirData, taxData: setTaxData}} 
                  savedLayout={freeDashboardLayout} 
                  onSaveLayout={setFreeDashboardLayout} 
                />
              ), '自由組合戰情室')}
              {activeTab === 'insurance_checkup' && renderTool('insurance_checkup',
                <InsuranceCheckupTool
                  data={insuranceCheckupData}
                  setData={setInsuranceCheckupData}
                  userId={user?.uid}
                  clientId={insuranceCheckupData.clientId || currentClient?.id}
                  clientName={currentClient?.name}
                />,
                '保單健診系統'
              )}
              {activeTab === 'family_tree' && renderTool('family_tree',
                <FamilyTreeTool
                  userId={user?.uid}
                  clientId={currentClient?.id}
                />,
                '家庭圖管理'
              )}
              </Suspense>
            </div>
        </div>
      </main>

      <style>{`
        @keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slide-in 0.3s ease-out forwards; }
        .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
      `}</style>
    </div>
    </ThemeProvider>
  );
}