import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 🔒 SECURITY: production build 移除所有 console / debugger
  // 修掉 216 個 console.log + CheckupReport.tsx:706 PII 外洩
  esbuild: {
    drop: ['console', 'debugger'],
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
