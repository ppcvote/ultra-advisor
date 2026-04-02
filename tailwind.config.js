/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'strategy-blue': { light: '#4DA3FF', DEFAULT: '#2E6BFF' },
        'signal-red': { light: '#FF6A6A', DEFAULT: '#FF3A3A' },
        'ultra-purple': { start: '#8A5CFF', mid: '#CE4DFF', center: '#E8E0FF' },
        'amber-gold': '#F59E0B',
        'war-room': '#050b14',
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.3s ease-out',
        'pulse-slow': 'pulse-slow 2s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 4s ease infinite',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        'gradient-shift': {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.05)' },
        },
      },
    },
  },
  safelist: [
    // Landing Page ProductShowcase 動態色彩
    ...[
      'blue', 'emerald', 'purple', 'red', 'rose', 'cyan',
    ].flatMap(c => [
      `bg-${c}-600`, `bg-${c}-600/10`, `bg-${c}-500`,
      `text-${c}-400`,
      `hover:bg-${c}-500`, `hover:border-${c}-500/30`,
    ]),
  ],
  plugins: [],
}
