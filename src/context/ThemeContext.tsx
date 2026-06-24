import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { safeStorage } from '../utils/safeStorage';
type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'ua_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  // 從 localStorage 讀取，預設為 dark
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = safeStorage.get(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    }
    return 'dark';
  });

  // 當主題變更時，更新 <html> 的 class 和 localStorage
  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    safeStorage.set(STORAGE_KEY, theme);
  }, [theme]);

  // 初始化時立即設定 class（避免閃爍）
  useEffect(() => {
    const saved = safeStorage.get(STORAGE_KEY);
    if (saved === 'dark' || !saved) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
