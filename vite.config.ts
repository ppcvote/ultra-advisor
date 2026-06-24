import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 🔒 SECURITY: production build 移除 debugger
  // 之前 drop 整個 'console' 會把 console.error 也吃掉，Sentry 抓不到
  // → 改 pure，保留 console.error / console.warn 給 Sentry auto-capture，
  //   只移除 log / info / debug / trace（先前 216 個 console.log + CheckupReport.tsx:706 PII 來源）
  esbuild: {
    drop: ['debugger'],
    pure: ['console.log', 'console.info', 'console.debug', 'console.trace'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vendor-recharts': ['recharts'],
          'vendor-reactflow': ['reactflow'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})
