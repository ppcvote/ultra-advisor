// src/components/PlannerSidebar.tsx
import React, { useState, useEffect } from 'react';
import {
  PanelLeftClose, PanelLeft,
  FileBarChart, Sparkles
} from 'lucide-react';
import { TOOL_CATEGORIES, Tool, ToolCategory } from '../constants/tools';
import { MembershipInfo, canAccessTool } from '../utils/membership';
import NavItem from './NavItem';
import SaveStatusIndicator, { SaveStatus } from './SaveStatusIndicator';

import { safeStorage } from '../utils/safeStorage';
// Ultra Advisor LOGO 元件（使用正確的 SVG LOGO）
const UltraLogo: React.FC<{ size?: number }> = ({ size = 24 }) => {
  // 原始 viewBox 是 320x420，但我們只需要 LOGO 部分（約 40~380 的區域）
  // 調整 viewBox 讓 LOGO 置中並填滿
  return (
    <svg
      width={size}
      height={size}
      viewBox="60 20 200 380"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="uaGradBlue" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4DA3FF" />
          <stop offset="100%" stopColor="#2E6BFF" />
        </linearGradient>
        <linearGradient id="uaGradRed" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FF6A6A" />
          <stop offset="100%" stopColor="#FF3A3A" />
        </linearGradient>
        <linearGradient id="uaGradPurple" gradientUnits="userSpaceOnUse" x1="91.5" y1="0" x2="228.5" y2="0">
          <stop offset="0%" stopColor="#8A5CFF" stopOpacity="0" />
          <stop offset="20%" stopColor="#CE4DFF" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#E8E0FF" stopOpacity="1" />
          <stop offset="80%" stopColor="#CE4DFF" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#8A5CFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Blue Curve (U Left / A Right Leg) */}
      <path
        fill="none"
        stroke="url(#uaGradBlue)"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M 90,40 C 90,160 130,220 242,380"
        style={{ filter: 'drop-shadow(0 0 6px rgba(46, 107, 255, 0.7))' }}
      />

      {/* Red Curve (U Right / A Left Leg) */}
      <path
        fill="none"
        stroke="url(#uaGradRed)"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M 230,40 C 230,160 190,220 78,380"
        style={{ filter: 'drop-shadow(0 0 6px rgba(255, 58, 58, 0.7))' }}
      />

      {/* Purple Line (Crossbar) */}
      <path
        fill="none"
        stroke="url(#uaGradPurple)"
        strokeWidth="10"
        strokeLinecap="round"
        d="M 91.5,314 L 228.5,314"
      />
    </svg>
  );
};

// ==========================================
// Props 介面
// ==========================================
interface Client {
  id: string;
  name: string;
}

interface PlannerSidebarProps {
  client: Client;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  onBack: () => void;
  onGenerateReport: () => void;
  saveStatus: SaveStatus;
  membershipInfo: MembershipInfo;
  onUpgradeClick: (tool: Tool) => void;
  onManualSave?: () => void;  // 手動存檔回調
}

// ==========================================
// 側邊欄元件
// ==========================================
const PlannerSidebar: React.FC<PlannerSidebarProps> = ({
  client,
  activeTab,
  onTabChange,
  onBack,
  onGenerateReport,
  saveStatus,
  membershipInfo,
  onUpgradeClick,
  onManualSave
}) => {
  // 收合狀態（從 localStorage 讀取偏好）
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = safeStorage.get('planner-sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // 儲存收合狀態偏好
  useEffect(() => {
    safeStorage.set('planner-sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // 處理工具點擊
  const handleToolClick = (tool: Tool) => {
    if (canAccessTool(tool.id, membershipInfo)) {
      onTabChange(tool.id);
    } else {
      onUpgradeClick(tool);
    }
  };

  // 切換收合狀態
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <aside
      className={`
        bg-slate-900 text-white flex flex-col shadow-2xl z-10 print:hidden h-screen
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-16' : 'w-72'}
      `}
    >
      {/* ============================================ */}
      {/* Header 區塊 */}
      {/* ============================================ */}
      <div className="p-4 border-b border-slate-800 shrink-0">
        {/* 收合時：展開按鈕 + LOGO返回 */}
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3">
            {/* 展開按鈕（放在上方） */}
            <button
              onClick={toggleCollapse}
              className="w-full p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-500 hover:text-white flex justify-center"
              title="展開側邊欄"
            >
              <PanelLeft size={18} />
            </button>

            {/* LOGO 返回戰情室按鈕 */}
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-800 rounded-lg transition-all"
              title="返回戰情室"
            >
              <UltraLogo size={28} />
            </button>
          </div>
        ) : (
          /* 展開時：LOGO返回按鈕 + 收合按鈕 */
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-slate-400 hover:text-white hover:bg-slate-800 px-2 py-2 rounded-lg transition-all"
              title="返回戰情室"
            >
              <UltraLogo size={24} />
              <span className="text-sm font-bold">Ultra Advisor</span>
            </button>

            <button
              onClick={toggleCollapse}
              className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-500 hover:text-white"
              title="收合側邊欄"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
        )}

        {/* 客戶資訊卡片 */}
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center mt-3' : 'px-2'}`}>
          {/* 客戶頭像 */}
          <div
            className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-lg shrink-0"
            title={isCollapsed ? client.name : undefined}
          >
            {client.name.charAt(0)}
          </div>

          {/* 客戶名稱（展開時顯示） */}
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-xs text-blue-400 font-bold uppercase">正在規劃</div>
              <div className="font-bold text-sm truncate">{client.name}</div>
            </div>
          )}
        </div>

        {/* 存檔狀態（支援手動存檔） */}
        <div className={`mt-3 ${isCollapsed ? 'flex justify-center' : ''}`}>
          <SaveStatusIndicator
            status={saveStatus}
            isCollapsed={isCollapsed}
            onManualSave={onManualSave}
          />
        </div>
      </div>

      {/* ============================================ */}
      {/* 導航區塊 */}
      {/* ============================================ */}
      <nav
        className="flex-1 p-2 space-y-4 overflow-y-auto sidebar-scrollbar"
        style={{
          minHeight: 0  // 重要：讓 flex-1 正確計算高度
        }}
      >
        {TOOL_CATEGORIES.map(category => (
          <CategorySection
            key={category.id}
            category={category}
            activeTab={activeTab}
            isCollapsed={isCollapsed}
            membershipInfo={membershipInfo}
            onToolClick={handleToolClick}
          />
        ))}
      </nav>

      {/* ============================================ */}
      {/* Footer 區塊 - 生成報表按鈕 */}
      {/* ============================================ */}
      <div className="p-4 border-t border-slate-800 shrink-0">
        <button
          onClick={onGenerateReport}
          className={`
            w-full flex items-center justify-center gap-2
            bg-gradient-to-r from-blue-600 to-blue-500
            hover:from-blue-500 hover:to-blue-400
            text-white font-bold rounded-xl transition-all
            shadow-lg shadow-blue-500/25
            ${isCollapsed ? 'p-3' : 'px-4 py-3'}
          `}
          title={isCollapsed ? '生成策略報表' : undefined}
        >
          <FileBarChart size={18} />
          {!isCollapsed && <span>生成策略報表</span>}
        </button>
      </div>

      {/* 自訂滾動條樣式 */}
      <style>{`
        .sidebar-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .sidebar-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.3);
          border-radius: 4px;
        }
        .sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.5);
        }
        /* Firefox */
        .sidebar-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(100, 116, 139, 0.3) transparent;
        }
      `}</style>
    </aside>
  );
};

// ==========================================
// 分類區塊子元件
// ==========================================
interface CategorySectionProps {
  category: ToolCategory;
  activeTab: string;
  isCollapsed: boolean;
  membershipInfo: MembershipInfo;
  onToolClick: (tool: Tool) => void;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  activeTab,
  isCollapsed,
  membershipInfo,
  onToolClick
}) => {
  const isPro = !category.isFreeCategory;

  return (
    <div>
      {/* 分類標題（展開時顯示） */}
      {!isCollapsed && (
        <div className="flex items-center justify-between px-3 py-2">
          <span className={`text-xs font-bold uppercase tracking-wider ${category.colorClasses.text}`}>
            {category.title}
          </span>

          {/* PRO 徽章 */}
          {isPro && (
            <span className={`
              text-[10px] font-bold px-2 py-0.5 rounded-full
              bg-amber-500/15 text-amber-400 border border-amber-500/30
              flex items-center gap-1
            `}>
              <Sparkles size={10} />
              PRO
            </span>
          )}
        </div>
      )}

      {/* 分隔線（收合時顯示） */}
      {isCollapsed && (
        <div className="h-px bg-slate-800 my-2 mx-2" />
      )}

      {/* 工具列表 */}
      <div className="space-y-1">
        {category.tools.map(tool => {
          const hasAccess = canAccessTool(tool.id, membershipInfo);
          const isActive = activeTab === tool.id;

          return (
            <NavItem
              key={tool.id}
              icon={tool.icon}
              label={tool.label}
              isActive={isActive}
              isPro={!tool.isFree}
              hasAccess={hasAccess}
              isCollapsed={isCollapsed}
              onClick={() => onToolClick(tool)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default PlannerSidebar;
