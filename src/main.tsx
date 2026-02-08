import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import BlogPage from './pages/BlogPage'

// ============================================
// Service Worker 註冊
// ============================================
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('[SW] Service Worker registered:', registration.scope);

      // 監聽更新
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('[SW] New Service Worker installing...');

        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // 新版本可用，通知用戶
            console.log('[SW] New version available! Refresh to update.');

            // 可選：顯示更新提示
            if (window.confirm('Ultra Advisor 有新版本可用，是否立即更新？')) {
              window.location.reload();
            }
          }
        });
      });

    } catch (error) {
      console.error('[SW] Service Worker registration failed:', error);
    }
  }
};

// 在頁面載入完成後註冊 Service Worker
if (document.readyState === 'complete') {
  registerServiceWorker();
} else {
  window.addEventListener('load', registerServiceWorker);
}

// 根據 URL 決定渲染哪個組件
// 注意：www 重導向已移至 index.html 的 inline script（必須在 React 載入前執行，避免無限循環）
// 優先使用 index.html 設定的 flag（繞過 bundle 快取問題）
const isBlogRoute = (window as any).__BLOG_ROUTE__ === true || window.location.pathname.startsWith('/blog');
console.log('[MAIN.TSX v3] pathname:', window.location.pathname, '| isBlogRoute:', isBlogRoute, '| flag:', (window as any).__BLOG_ROUTE__);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isBlogRoute ? (
      <BlogPage
        onBack={() => {
          window.history.pushState({}, '', '/');
          window.location.reload();
        }}
        onLogin={() => {
          window.history.pushState({}, '', '/register');
          window.location.reload();
        }}
      />
    ) : (
      <App />
    )}
  </StrictMode>,
)
