import React, { useState, useEffect, useRef } from 'react';
import {
  Wallet, Building2, Coins, Check, ShieldAlert, Menu, X, LogOut, FileBarChart,
  GraduationCap, Umbrella, Waves, Landmark, Lock, Rocket, Car, Loader2,
  ChevronLeft, Users, ShieldCheck, Activity, History, LayoutDashboard, Flame,
  Sparkles, HeartPulse, GitBranch
} from 'lucide-react';

import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot, Timestamp, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

// 組件匯入
import { LoginPage } from './components/auth/LoginPage';
import { SecretSignupPage } from './components/auth/SecretSignupPage';
import { LandingPage } from './components/LandingPage';

import ReportModal from './components/ReportModal';
import SplashScreen from './components/SplashScreen';

// 🆕 規劃界面改造新元件
import PlannerSidebar from './components/PlannerSidebar';
import UpgradeModal from './components/UpgradeModal';
import { Tool } from './constants/tools';
import { getMembershipInfo, MembershipInfo, defaultMembershipInfo } from './utils/membership'; 

// ✅ 新版戰情室（整合個人資料、密碼修改、客戶管理）
import UltraWarRoom from './components/UltraWarRoom';

import { FinancialRealEstateTool } from './components/FinancialRealEstateTool';
import { StudentLoanTool } from './components/StudentLoanTool';
import { SuperActiveSavingTool } from './components/SuperActiveSavingTool';
import { CarReplacementTool } from './components/CarReplacementTool';
import { LaborPensionTool } from './components/LaborPensionTool';
import { BigSmallReservoirTool } from './components/BigSmallReservoirTool';
import { TaxPlannerTool } from './components/TaxPlannerTool';
import MillionDollarGiftTool from './components/MillionDollarGiftTool';
import FreeDashboardTool from './components/FreeDashboardTool';
import MarketDataZone from './components/MarketDataZone'; 
import GoldenSafeVault from './components/GoldenSafeVault'; 
import FundTimeMachine from './components/FundTimeMachine';
import InsuranceCheckupTool from './components/insurance/InsuranceCheckupTool';
import FamilyTreeTool from './components/insurance/FamilyTreeTool';
import type { InsuranceCheckupData } from './types/insurance';

// 🆕 點數系統與會員權限
import { pointsApi } from './hooks/usePoints';
import { useMembership } from './hooks/useMembership';
import PointsDashboard from './components/PointsDashboard';
import PointsNotification from './components/PointsNotification';
import ToolLockedOverlay from './components/ToolLockedOverlay';

// 🆕 公開計算機（傲創計算機）
import PublicCalculator from './pages/PublicCalculator';

// 🆕 LIFF 註冊頁面
import LiffRegister from './pages/LiffRegister';

// 🆕 公開註冊頁面
import RegisterPage from './pages/RegisterPage';

// 🆕 部落格頁面（SEO 內容行銷）
import BlogPage from './pages/BlogPage';

// 🆕 預約試算頁面
import BookingPage from './pages/BookingPage';

// 🆕 傲創聯盟頁面
import AlliancePage from './pages/AlliancePage';

// 🆕 合作夥伴申請頁面
import PartnerApplicationPage from './pages/PartnerApplicationPage';

// 🆕 UltraCloud Logo 展示頁面
import UltraCloudDemo from './pages/UltraCloudDemo';

// 🆕 主題切換
import { ThemeProvider } from './context/ThemeContext';

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

const Toast = ({ message, type = 'success', onClose }: { message: string, type: string, onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(() => { onClose(); }, 4000); 
    return () => clearTimeout(timer);
  }, [onClose]);
  const bgColors: Record<string, string> = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };
  return (
    <div className={`fixed bottom-6 right-6 ${bgColors[type] || 'bg-blue-600'} text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 animate-bounce-in z-[200] toast-container max-w-[90vw]`}>
      {type === 'success' && <Check size={20} className="shrink-0" />}
      {type === 'error' && <ShieldAlert size={20} className="shrink-0" />}
      <span className="font-bold text-sm md:text-base break-words">{message}</span>
    </div>
  );
};

// 🆕 修改 NavItem 支援 locked 屬性
const NavItem = ({ icon: Icon, label, active, onClick, disabled = false, locked = false }: any) => (
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
);

export default function App() {
  // 網域重導向已移除 - 避免與 CDN 快取衝突造成無限循環

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
    const hasSessionId = localStorage.getItem('my_app_session_id');
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
  const [clientLoading, setClientLoading] = useState(false); 
  const [currentClient, setCurrentClient] = useState<any>(null);
  // 🆕 activeTab 持久化：重新整理後保持在原工具介面
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('ultra_advisor_active_tab');
    return saved || 'golden_safe';
  }); 
  const [toast, setToast] = useState<{message: string, type: string} | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false); 
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);  // 🆕 追蹤未儲存狀態
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  // 🆕 點數系統狀態
  const [isPointsDashboardOpen, setIsPointsDashboardOpen] = useState(false);
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
    const savedStep = localStorage.getItem('insurance_checkup_step');
    return savedStep ? { activeStep: parseInt(savedStep) as 1 | 2 } : defaultStates.insurance_checkup;
  });

  const showToast = (message: string, type = 'success') => { setToast({ message, type }); };

  // ==========================================
  // 1. 安全機制：雙裝置限制邏輯
  // ==========================================
  const registerDeviceSession = async (uid: string) => {
    isRegistering.current = true;
    const newSessionId = generateSessionId();
    localStorage.setItem('my_app_session_id', newSessionId);
    
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
    const localSessionId = localStorage.getItem('my_app_session_id');
    if (isRegistering.current || !localSessionId) return;

    const userMetaRef = doc(db, 'users', user.uid, 'system', 'metadata');
    const unsubscribe = onSnapshot(userMetaRef, async (docSnap) => {
      if (isRegistering.current) return;
      if (docSnap.exists()) {
        const activeSessions = docSnap.data().activeSessions || [];
        if (activeSessions.length > 0 && !activeSessions.includes(localSessionId)) {
          localStorage.removeItem('my_app_session_id');
          await signOut(auth);
          alert("裝置數量超過限制：您的帳號已在其他裝置登入，此連線已自動登出。");
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
      localStorage.setItem('insurance_checkup_step', insuranceCheckupData.activeStep.toString());
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
      if (path === '/') { setIsSecretSignupRoute(false); setIsLoginRoute(false); setIsCalculatorRoute(false); setIsLiffRegisterRoute(false); setIsRegisterRoute(false); setIsBlogRoute(false); setIsBookingRoute(false); setIsAllianceRoute(false); setIsPartnerApplyRoute(false); setIsUltraCloudDemoRoute(false); }
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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (!currentUser) { setCurrentClient(null); setIsDataLoaded(false); }
    });
    return () => unsubscribe();
  }, []);

  // 🆕 activeTab 變化時保存到 localStorage（重新整理後保持原介面）
  useEffect(() => {
    localStorage.setItem('ultra_advisor_active_tab', activeTab);
  }, [activeTab]);

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
      localStorage.removeItem('my_app_session_id');
      await signOut(auth); 
      setCurrentClient(null);
      setIsDataLoaded(false);
      showToast("已安全登出", "info"); 
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
      <LiffRegister
        onSuccess={() => {
          setIsLiffRegisterRoute(false);
          window.history.pushState({}, '', '/');
        }}
      />
    );
  }

  // 🆕 公開註冊頁面（不需登入，跳過 SplashScreen）
  if (isRegisterRoute) {
    return (
      <RegisterPage
        onSuccess={() => {
          setIsRegisterRoute(false);
          setIsLoginRoute(true);
          window.history.pushState({}, '', '/login');
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
    );
  }

  // 🆕 預約試算頁面（不需登入）
  if (isBookingRoute || window.location.pathname === '/booking') {
    return (
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
    );
  }

  // 🆕 傲創聯盟頁面（不需登入）
  if (isAllianceRoute || window.location.pathname === '/alliance') {
    return (
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
    );
  }

  // 🆕 合作夥伴申請頁面（不需登入）
  if (isPartnerApplyRoute || window.location.pathname === '/partner-apply') {
    return (
      <PartnerApplicationPage
        onBack={() => {
          setIsPartnerApplyRoute(false);
          setIsAllianceRoute(true);
          window.history.pushState({}, '', '/alliance');
        }}
      />
    );
  }

  // 🆕 UltraCloud Logo 展示頁面（不需登入）
  if (isUltraCloudDemoRoute || window.location.pathname === '/ultracloud') {
    return (
      <UltraCloudDemo
        onBack={() => {
          setIsUltraCloudDemoRoute(false);
          window.history.pushState({}, '', '/');
          window.location.reload();
        }}
      />
    );
  }

  // 🆕 部落格頁面（不需登入，跳過 SplashScreen）
  // 使用雙重檢查：state 或直接檢查 URL
  if (isBlogRoute || window.location.pathname.startsWith('/blog')) {
    return (
      <BlogPage
        onBack={() => {
          setIsBlogRoute(false);
          window.history.pushState({}, '', '/');
          window.location.reload(); // 強制重載以確保狀態正確
        }}
        onLogin={() => {
          setIsBlogRoute(false);
          setIsRegisterRoute(true);
          window.history.pushState({}, '', '/register');
        }}
      />
    );
  }

  if (loading || !minSplashTimePassed) return <SplashScreen />;

  // 🆕 公開計算機（不需登入，但會員可使用額外功能）
  if (isCalculatorRoute) {
    return (
      <PublicCalculator
        onBack={() => {
          setIsCalculatorRoute(false);
          window.history.pushState({}, '', '/');
        }}
        onLogin={() => {
          // 🔥 LINE 免費訊息額度已滿，改導向公開註冊頁
          setIsCalculatorRoute(false);
          setIsRegisterRoute(true);
          window.history.pushState({}, '', '/register');
        }}
        user={user}  // 🆕 傳遞用戶資訊
      />
    );
  }

  if (isSecretSignupRoute) {
      return <SecretSignupPage onSignupSuccess={() => {
          alert("🎉 帳號開通成功！");
          setIsSecretSignupRoute(false);
          window.location.href = '/'; 
      }} />;
  }

  if (!user || needsLoginInteraction) {
    if (isLoginRoute || user) {
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
        <LandingPage
          onStart={() => navigateTo('/login', () => setIsLoginRoute(true))}
          onSignup={() => navigateTo('/signup-secret', () => setIsSecretSignupRoute(true))}
          onHome={() => navigateTo('/', () => { setIsLoginRoute(false); setIsSecretSignupRoute(false); })}
        />
      </ThemeProvider>
    );
  }

  // ✅ 使用新版 UltraWarRoom 取代舊的 ClientDashboard
  if (!currentClient) {
      return (
          <ThemeProvider>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {/* 🆕 點數獲得通知 */}
            {pointsNotification && (
              <PointsNotification
                points={pointsNotification.points}
                reason={pointsNotification.reason}
                streak={pointsNotification.streak}
                onClose={() => setPointsNotification(null)}
              />
            )}
            {/* 🆕 點數儀表板 */}
            <PointsDashboard
              isOpen={isPointsDashboardOpen}
              onClose={() => setIsPointsDashboardOpen(false)}
            />
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
          </ThemeProvider>
      );
  }

  return (
    <ThemeProvider>
    {/* 規劃系統強制使用淺色背景，不受主題切換影響 */}
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <PrintStyles />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* 🆕 點數獲得通知 */}
      {pointsNotification && (
        <PointsNotification
          points={pointsNotification.points}
          reason={pointsNotification.reason}
          streak={pointsNotification.streak}
          onClose={() => setPointsNotification(null)}
        />
      )}

      {/* 🆕 點數儀表板 */}
      <PointsDashboard 
        isOpen={isPointsDashboardOpen} 
        onClose={() => setIsPointsDashboardOpen(false)} 
      />
      
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
              <NavItem icon={Building2} label="金融房產專案" active={activeTab === 'estate'} onClick={() => { setActiveTab('estate'); setIsMobileMenuOpen(false); }} />
              <NavItem icon={GraduationCap} label="學貸活化專案" active={activeTab === 'student'} onClick={() => { setActiveTab('student'); setIsMobileMenuOpen(false); }} locked={!canAccessTool('student')} />
              <NavItem icon={Rocket} label="超積極存錢法" active={activeTab === 'super_active'} onClick={() => { setActiveTab('super_active'); setIsMobileMenuOpen(false); }} locked={!canAccessTool('super_active')} />
              
              {/* 守富 */}
              <div className="text-xs font-bold text-blue-400 px-4 py-2 uppercase tracking-wider flex items-center gap-2 mt-4">
                守富：風險控管
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <Sparkles size={10} />PRO
                </span>
              </div>
              <NavItem icon={Waves} label="大小水庫專案" active={activeTab === 'reservoir'} onClick={() => { setActiveTab('reservoir'); setIsMobileMenuOpen(false); }} />
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
              {/* 🆕 帶權限檢查的工具渲染 */}
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