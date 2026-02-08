import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhTW from 'antd/locale/zh_TW';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

// Pages
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Users from './pages/Users.jsx';
import SiteEditor from './pages/SiteEditor.jsx';
import LineBotEditor from './pages/LineBotEditor.jsx';
import NotificationsEditor from './pages/NotificationsEditor.jsx';
import FeedbackManager from './pages/FeedbackManager.jsx';
import ApplicationsManager from './pages/ApplicationsManager.jsx';
import MainLayout from './components/Layout';

// 🆕 會員系統頁面
import MembershipTiers from './pages/membership/MembershipTiers.jsx';
import PointsRules from './pages/membership/PointsRules.jsx';
import RedeemableItems from './pages/membership/RedeemableItems.jsx';
import PointsLedger from './pages/membership/PointsLedger.jsx';
import AuditLogs from './pages/membership/AuditLogs.jsx';
import PaymentHistory from './pages/membership/PaymentHistory.jsx';
import Missions from './pages/membership/Missions.jsx';
import Referrals from './pages/membership/Referrals.jsx';
import StoreOrders from './pages/membership/StoreOrders.jsx';

// ✅ Debug 組件：顯示當前路由
const DebugRoute = () => {
  const location = useLocation();
  console.log('📍 當前路由:', location.pathname);
  return null;
};

// ✅ 受保護的路由
const ProtectedRoute = ({ children }) => {
  const [user, setUser] = useState(undefined);
  const location = useLocation();

  useEffect(() => {
    console.log('🔄 ProtectedRoute useEffect 啟動');
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('🔥 onAuthStateChanged 觸發:', currentUser ? `已登入 (${currentUser.email})` : '未登入');
      setUser(currentUser);
    });

    return () => {
      console.log('🧹 ProtectedRoute cleanup');
      unsubscribe();
    };
  }, []);

  console.log('🎯 ProtectedRoute render, user:', user === undefined ? 'loading' : (user ? user.email : 'null'));

  // 載入中
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-xl text-slate-400">載入中...</div>
        </div>
      </div>
    );
  }

  // 未登入
  if (user === null) {
    return <Navigate to="/secret-admin-ultra-2026" replace />;
  }

  // 已登入
  return children;
};

function App() {
  return (
    <ConfigProvider locale={zhTW}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DebugRoute />
        <Routes>
          {/* 首頁 */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Navigate to="/admin/dashboard" replace />
              </ProtectedRoute>
            } 
          />

          {/* 登入頁 */}
          <Route path="/secret-admin-ultra-2026" element={<Login />} />

          {/* 後台路由 */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="site-editor" element={<SiteEditor />} />
            <Route path="line-bot" element={<LineBotEditor />} />
            <Route path="notifications" element={<NotificationsEditor />} />
            <Route path="feedbacks" element={<FeedbackManager />} />
            <Route path="applications" element={<ApplicationsManager />} />

            {/* 🆕 會員系統路由 */}
            <Route path="membership/tiers" element={<MembershipTiers />} />
            <Route path="membership/points-rules" element={<PointsRules />} />
            <Route path="membership/redeemable-items" element={<RedeemableItems />} />
            <Route path="membership/points-ledger" element={<PointsLedger />} />
            <Route path="membership/audit-logs" element={<AuditLogs />} />
            <Route path="membership/payment-history" element={<PaymentHistory />} />
            <Route path="membership/missions" element={<Missions />} />
            <Route path="membership/referrals" element={<Referrals />} />
            <Route path="membership/store-orders" element={<StoreOrders />} />
          </Route>

          {/* 舊路徑重定向 */}
          <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/users" element={<Navigate to="/admin/users" replace />} />
          <Route path="/login" element={<Navigate to="/secret-admin-ultra-2026" replace />} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/secret-admin-ultra-2026" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
