// src/constants/tools.ts
import {
  LayoutDashboard, ShieldCheck, Activity, History,
  Wallet, Building2, GraduationCap, Rocket,
  Waves, Car, Umbrella, Landmark,
  HeartPulse, GitBranch,
  LucideIcon
} from 'lucide-react';

// 工具介面定義
export interface Tool {
  id: string;
  icon: LucideIcon;
  label: string;
  description: string;      // 工具簡介（用於升級 Modal）
  benefits: string[];       // 功能亮點（用於升級 Modal）
  isFree: boolean;          // 是否為免費工具
}

// 工具分類介面
export interface ToolCategory {
  id: string;
  title: string;
  color: 'yellow' | 'emerald' | 'blue' | 'purple' | 'rose';  // 分類顏色
  colorClasses: {
    text: string;
    bg: string;
    border: string;
  };
  isFreeCategory: boolean;  // 該分類是否全部免費
  tools: Tool[];
}

// 用語規範修正：
// 「槓桿與套利」→「資產配置」
// 「現金流防禦」→「風險控管」

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'diagnosis',
    title: '觀念與診斷',
    color: 'yellow',
    colorClasses: {
      text: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30'
    },
    isFreeCategory: true,
    tools: [
      {
        id: 'free_dashboard',
        icon: LayoutDashboard,
        label: '自由組合戰情室',
        description: '自由組合多種工具，打造客製化諮詢場景',
        benefits: ['拖拉組合任意工具', '多種版面配置', '一鍵切換場景'],
        isFree: true
      },
      {
        id: 'golden_safe',
        icon: ShieldCheck,
        label: '黃金保險箱理論',
        description: '視覺化呈現保險的保障與儲蓄功能',
        benefits: ['保障倍數試算', '儲蓄累積曲線', '專業圖卡匯出'],
        isFree: true
      },
      {
        id: 'market_data',
        icon: Activity,
        label: '市場數據戰情',
        description: '即時市場數據與權威統計資料',
        benefits: ['癌症時鐘數據', '醫療通膨追蹤', '勞保破產倒數'],
        isFree: true
      },
      {
        id: 'fund_machine',
        icon: History,
        label: '基金時光機',
        description: '歷史績效回測，驗證投資策略',
        benefits: ['定期定額回測', '單筆投資模擬', '多基金比較'],
        isFree: true
      }
    ]
  },
  {
    id: 'wealth',
    title: '創富：資產配置',  // 已修正用語
    color: 'emerald',
    colorClasses: {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30'
    },
    isFreeCategory: false,
    tools: [
      {
        id: 'gift',
        icon: Wallet,
        label: '百萬禮物專案',
        description: '利用稅法空間，合法移轉資產給下一代',
        benefits: ['每年 244 萬免稅贈與額度', '10 年贈與策略規劃', '專業贈與報告匯出'],
        isFree: false
      },
      {
        id: 'estate',
        icon: Building2,
        label: '金融房產專案',
        description: '房貸增貸活化，釋放不動產價值',
        benefits: ['房貸增貸試算', '租金投報率分析', '資產活化策略'],
        isFree: false
      },
      {
        id: 'student',
        icon: GraduationCap,
        label: '學貸活化專案',
        description: '將學貸轉化為人生第一筆投資本金',
        benefits: ['學貸利差分析', '投資累積試算', '還款策略規劃'],
        isFree: false
      },
      {
        id: 'super_active',
        icon: Rocket,
        label: '超積極存錢法',
        description: '極致的現金流規劃，加速財富累積',
        benefits: ['收支配比優化', '強制儲蓄機制', '目標達成追蹤'],
        isFree: false
      }
    ]
  },
  {
    id: 'protect',
    title: '守富：風險控管',
    color: 'blue',
    colorClasses: {
      text: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30'
    },
    isFreeCategory: false,
    tools: [
      {
        id: 'reservoir',
        icon: Waves,
        label: '大小水庫專案',
        description: '雙層防護機制，確保緊急預備金與長期儲蓄',
        benefits: ['緊急預備金試算', '定期定額規劃', '風險缺口分析'],
        isFree: false
      },
      {
        id: 'car',
        icon: Car,
        label: '五年換車專案',
        description: '資產配置與生活夢想的平衡點',
        benefits: ['購車預算規劃', '頭期款累積試算', '貸款方案比較'],
        isFree: false
      },
      {
        id: 'pension',
        icon: Umbrella,
        label: '退休缺口試算',
        description: '精算退休金缺口，提前規劃第二人生',
        benefits: ['替代率計算', '勞保勞退整合', '缺口補足方案'],
        isFree: false
      }
    ]
  },
  {
    id: 'legacy',
    title: '傳富：稅務傳承',
    color: 'purple',
    colorClasses: {
      text: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/30'
    },
    isFreeCategory: false,
    tools: [
      {
        id: 'tax',
        icon: Landmark,
        label: '稅務傳承專案',
        description: '遺產稅 & 贈與稅精算，最佳化傳承策略',
        benefits: ['遺產稅試算', '贈與稅規劃', '流動性缺口測試'],
        isFree: false
      }
    ]
  },
  {
    id: 'checkup',
    title: '保單健診',
    color: 'rose',
    colorClasses: {
      text: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30'
    },
    isFreeCategory: false,
    tools: [
      {
        id: 'insurance_checkup',
        icon: HeartPulse,
        label: '保單健診系統',
        description: '家庭保單健檢，缺口分析一目了然',
        benefits: ['OCR 保單辨識', '家庭保障總覽', '缺口分析報告'],
        isFree: false
      },
      {
        id: 'family_tree',
        icon: GitBranch,
        label: '家庭圖管理',
        description: '建立家庭成員關係圖，視覺化家庭保障',
        benefits: ['家庭成員管理', '關係圖視覺化', '保單綁定成員'],
        isFree: false
      }
    ]
  }
];

// 取得所有工具的扁平列表
export const ALL_TOOLS = TOOL_CATEGORIES.flatMap(cat => cat.tools);

// 取得免費工具列表
export const FREE_TOOLS = ALL_TOOLS.filter(tool => tool.isFree);

// 取得 PRO 工具列表
export const PRO_TOOLS = ALL_TOOLS.filter(tool => !tool.isFree);

// 根據 ID 取得工具
export const getToolById = (id: string): Tool | undefined => {
  return ALL_TOOLS.find(tool => tool.id === id);
};

// 根據 ID 取得工具所屬分類
export const getCategoryByToolId = (toolId: string): ToolCategory | undefined => {
  return TOOL_CATEGORIES.find(cat => cat.tools.some(tool => tool.id === toolId));
};
