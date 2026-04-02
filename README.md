# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

```
UltraAdvisor
├─ .firebaserc
├─ admin
│  ├─ DAY1-GUIDE.md
│  ├─ index.html
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ postcss.config.js
│  ├─ src
│  │  ├─ App.jsx
│  │  ├─ components
│  │  │  └─ Layout.jsx
│  │  ├─ firebase.js
│  │  ├─ index.css
│  │  ├─ main.jsx
│  │  └─ pages
│  │     ├─ Dashboard.jsx
│  │     ├─ Login.jsx
│  │     └─ Users.jsx
│  ├─ tailwind.config.js
│  ├─ vercel.json
│  └─ vite.config.js
├─ api
│  └─ market.js
├─ eslint.config.js
├─ firebase.json
├─ firebase.json.backup
├─ functions
│  ├─ eslint.config.js
│  ├─ index.js
│  ├─ index.js.backup
│  ├─ lib
│  │  ├─ index.js
│  │  └─ index.js.map
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ src
│  │  └─ index.ts
│  ├─ tsconfig.dev.json
│  └─ tsconfig.json
├─ git-structure.txt
├─ index.html
├─ package-lock.json
├─ package.json
├─ postcss.config.js
├─ project-structure.txt
├─ public
│  ├─ logo.png
│  ├─ manifest.json
│  └─ vite.svg
├─ README.md
├─ repomix-output.xml
├─ src
│  ├─ App.css
│  ├─ App.tsx
│  ├─ assets
│  │  └─ react.svg
│  ├─ components
│  │  ├─ auth
│  │  │  ├─ LoginPage.tsx
│  │  │  └─ SecretSignupPage.tsx
│  │  ├─ BigSmallReservoirTool.tsx
│  │  ├─ CarReplacementTool.tsx
│  │  ├─ ClientDashboard.tsx
│  │  ├─ EstateReport.tsx
│  │  ├─ FinancialRealEstateTool.tsx
│  │  ├─ FreeDashboardTool.tsx
│  │  ├─ FundTimeMachine.tsx
│  │  ├─ GiftReport.tsx
│  │  ├─ GoldenSafeVault.tsx
│  │  ├─ LaborPensionTool.tsx
│  │  ├─ LandingPage.jsx
│  │  ├─ MarketDataZone.tsx
│  │  ├─ MarketWarRoom copy.tsx
│  │  ├─ MarketWarRoom.tsx
│  │  ├─ MillionDollarGiftTool.tsx
│  │  ├─ QuickCalculator.tsx
│  │  ├─ ReportModal.tsx
│  │  ├─ SplashScreen.tsx
│  │  ├─ StudentLoanReport.tsx
│  │  ├─ StudentLoanTool.tsx
│  │  ├─ SuperActiveReport.tsx
│  │  ├─ SuperActiveSavingTool.tsx
│  │  ├─ TaxPlannerTool.tsx
│  │  └─ UltraWarRoom.tsx
│  ├─ data
│  │  └─ fundData.ts
│  ├─ firebase.ts
│  ├─ index.css
│  ├─ main.tsx
│  ├─ pages
│  │  └─ AccountSettings.jsx
│  ├─ types.d.ts
│  ├─ utils
│  └─ utils.ts
├─ src-structure.txt
├─ tailwind.config.js
├─ tsconfig.app.json
├─ tsconfig.json
├─ tsconfig.node.json
├─ vercel.json
└─ vite.config.ts

```