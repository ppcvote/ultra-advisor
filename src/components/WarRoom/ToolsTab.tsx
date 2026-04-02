import React, { useState } from 'react';
import { Sparkles, AlertCircle } from 'lucide-react';
import { TOOL_CATEGORIES } from '../../constants/tools';

interface ToolsTabProps {
  isPaid: boolean;
  onSelectTool: (toolId: string) => void;
  onSelectClient: () => void;
  hasClients: boolean;
}

const ToolsTab: React.FC<ToolsTabProps> = ({ isPaid, onSelectTool, onSelectClient, hasClients }) => {
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  const FREE_ACCESS = ['reservoir', 'estate', 'tax'];

  const canAccess = (toolId: string, isFree: boolean) => {
    if (isPaid) return true;
    if (isFree) return true;
    if (FREE_ACCESS.includes(toolId)) return true;
    return false;
  };

  const handleToolClick = (toolId: string, isFree: boolean) => {
    if (!hasClients) {
      // 顯示 toast 提示，然後跳轉
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      onSelectClient();
      return;
    }
    onSelectTool(toolId);
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast 提示 */}
      {showToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2.5 px-5 py-3 bg-slate-800 border border-blue-500/30 rounded-xl shadow-2xl shadow-black/50">
            <AlertCircle size={16} className="text-blue-400 shrink-0" />
            <p className="text-sm text-white font-medium">請先新增或選擇客戶，再使用分析工具</p>
          </div>
        </div>
      )}

      {TOOL_CATEGORIES.map(category => (
        <div key={category.id}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-sm font-bold ${category.colorClasses.text}`}>
              {category.title}
            </span>
            {category.isFreeCategory && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                免費
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {category.tools.map(tool => {
              const accessible = canAccess(tool.id, tool.isFree);
              const Icon = tool.icon;
              const isHovered = hoveredTool === tool.id;

              return (
                <button
                  key={tool.id}
                  onClick={() => handleToolClick(tool.id, tool.isFree)}
                  onMouseEnter={() => setHoveredTool(tool.id)}
                  onMouseLeave={() => setHoveredTool(null)}
                  className={`relative text-left p-4 rounded-xl border transition-all group ${
                    accessible
                      ? 'bg-slate-900/50 border-slate-800/50 hover:border-blue-500/30 hover:bg-slate-800/50'
                      : 'bg-slate-900/30 border-slate-800/30 hover:border-purple-500/20 hover:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      accessible
                        ? `${category.colorClasses.bg} ${category.colorClasses.border} border`
                        : 'bg-slate-800/50 border border-slate-700/50'
                    }`}>
                      <Icon size={20} className={accessible ? category.colorClasses.text : 'text-slate-500'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-bold truncate ${accessible ? 'text-white' : 'text-slate-400'}`}>
                        {tool.label}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                        {tool.description}
                      </p>
                    </div>
                  </div>

                  {!accessible && isHovered && (
                    <div className="absolute inset-0 bg-slate-900/90 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <div className="text-center px-4">
                        <Sparkles size={20} className="text-purple-400 mx-auto mb-2" />
                        <p className="text-sm text-white font-medium">免費體驗</p>
                        <p className="text-[11px] text-slate-400 mt-1">選擇客戶後即可試用</p>
                      </div>
                    </div>
                  )}

                  {(tool.isFree || FREE_ACCESS.includes(tool.id)) && !isPaid && (
                    <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">
                      免費
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ToolsTab;
