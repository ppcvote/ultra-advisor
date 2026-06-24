import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GridLayout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import {
  LayoutDashboard,
  Plus,
  X,
  Maximize2,
  Minimize2,
  ChevronLeft,
  GripVertical,
  RotateCcw,
  Save,
  FileText,
  Trash2
} from 'lucide-react';

// --- 引入所有工具元件 ---
import GoldenSafeVault from './GoldenSafeVault';
import MarketDataZone from './MarketDataZone';
import FundTimeMachine from './FundTimeMachine';
import MillionDollarGiftTool from './MillionDollarGiftTool';
import { FinancialRealEstateTool } from './FinancialRealEstateTool';
import { StudentLoanTool } from './StudentLoanTool';
import { SuperActiveSavingTool } from './SuperActiveSavingTool';
import { CarReplacementTool } from './CarReplacementTool';
import { LaborPensionTool } from './LaborPensionTool';
import { BigSmallReservoirTool } from './BigSmallReservoirTool';
import { TaxPlannerTool } from './TaxPlannerTool';

import { safeStorage } from '../utils/safeStorage';
import DisclaimerFooter from './DisclaimerFooter';
// 工具定義表
const TOOL_REGISTRY = [
  { id: 'golden_safe', name: '黃金保險箱', component: GoldenSafeVault, dataKey: 'goldenSafeData', color: 'bg-amber-500' },
  { id: 'market_data', name: '市場數據戰情', component: MarketDataZone, dataKey: null, color: 'bg-cyan-500' },
  { id: 'fund_machine', name: '基金時光機', component: FundTimeMachine, dataKey: null, color: 'bg-purple-500' },
  { id: 'pension', name: '退休缺口試算', component: LaborPensionTool, dataKey: 'pensionData', color: 'bg-blue-500' },
  { id: 'gift', name: '百萬禮物專案', component: MillionDollarGiftTool, dataKey: 'giftData', color: 'bg-pink-500' },
  { id: 'estate', name: '金融房產專案', component: FinancialRealEstateTool, dataKey: 'estateData', color: 'bg-emerald-500' },
  { id: 'student', name: '學貸活化專案', component: StudentLoanTool, dataKey: 'studentData', color: 'bg-indigo-500' },
  { id: 'super_active', name: '超積極存錢法', component: SuperActiveSavingTool, dataKey: 'superActiveData', color: 'bg-orange-500' },
  { id: 'car', name: '五年換車專案', component: CarReplacementTool, dataKey: 'carData', color: 'bg-slate-500' },
  { id: 'reservoir', name: '大小水庫專案', component: BigSmallReservoirTool, dataKey: 'reservoirData', color: 'bg-teal-500' },
  { id: 'tax', name: '稅務傳承專案', component: TaxPlannerTool, dataKey: 'taxData', color: 'bg-rose-500' },
];

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

interface FreeDashboardProps {
  allData: any;
  setAllData: any;
  savedLayout?: LayoutItem[];
  onSaveLayout?: (layout: LayoutItem[]) => void;
}

const FreeDashboardTool: React.FC<FreeDashboardProps> = ({ allData, setAllData, savedLayout, onSaveLayout }) => {
  // 已加入的工具 ID 列表
  const [addedTools, setAddedTools] = useState<string[]>([]);

  // Grid Layout 配置
  const [layout, setLayout] = useState<LayoutItem[]>([]);

  // 工具選擇器開關
  const [showToolPicker, setShowToolPicker] = useState(false);

  // 全螢幕展開的工具 ID
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  // 容器寬度（響應式）
  const [containerWidth, setContainerWidth] = useState(1200);
  const containerRef = useRef<HTMLDivElement>(null);

  // 筆記區域
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(true);

  // 計算容器寬度
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // 載入已儲存的 Layout 和筆記
  useEffect(() => {
    const saved = safeStorage.get('free_dashboard_layout');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.layout && parsed.tools) {
          setLayout(parsed.layout);
          setAddedTools(parsed.tools);
        }
        if (parsed.notes !== undefined) {
          setNotes(parsed.notes);
        }
      } catch (e) {
        console.error('Failed to load saved layout:', e);
      }
    }
  }, []);

  // 儲存 Layout 和筆記
  const saveLayout = useCallback(() => {
    const data = { layout, tools: addedTools, notes };
    safeStorage.set('free_dashboard_layout', JSON.stringify(data));
    if (onSaveLayout) onSaveLayout(layout);
  }, [layout, addedTools, notes, onSaveLayout]);

  // 新增工具
  const handleAddTool = (toolId: string) => {
    if (addedTools.includes(toolId)) return;

    // 計算新工具位置（找到最下方空位）
    const maxY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);

    const newLayoutItem: LayoutItem = {
      i: toolId,
      x: 0,
      y: maxY,
      w: 6, // 預設半寬
      h: 8, // 預設高度
      minW: 3,
      minH: 4,
    };

    setLayout(prev => [...prev, newLayoutItem]);
    setAddedTools(prev => [...prev, toolId]);
    setShowToolPicker(false);
  };

  // 移除工具
  const handleRemoveTool = (toolId: string) => {
    setLayout(prev => prev.filter(item => item.i !== toolId));
    setAddedTools(prev => prev.filter(id => id !== toolId));
  };

  // 重置為預設
  const handleReset = () => {
    const defaultLayout: LayoutItem[] = [
      { i: 'market_data', x: 0, y: 0, w: 6, h: 10, minW: 3, minH: 4 },
      { i: 'pension', x: 6, y: 0, w: 6, h: 10, minW: 3, minH: 4 },
    ];
    setLayout(defaultLayout);
    setAddedTools(['market_data', 'pension']);
  };

  // Layout 變更
  const handleLayoutChange = (newLayout: LayoutItem[]) => {
    setLayout(newLayout);
  };

  // 渲染工具內容
  const renderToolContent = (toolConfig: typeof TOOL_REGISTRY[0]) => {
    if (toolConfig.dataKey) {
      return (
        <toolConfig.component
          data={allData[toolConfig.dataKey]}
          setData={setAllData[toolConfig.dataKey]}
        />
      );
    }
    return <toolConfig.component />;
  };

  // 全螢幕展開模式
  if (expandedTool) {
    const toolConfig = TOOL_REGISTRY.find(t => t.id === expandedTool);
    if (!toolConfig) {
      setExpandedTool(null);
      return null;
    }

    return (
      <div className="animate-fade-in">
        {/* 頂部返回列 */}
        <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setExpandedTool(null)}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold transition-colors"
            >
              <ChevronLeft size={20} />
              <span>返回戰情室</span>
            </button>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${toolConfig.color}`}></div>
              <span className="font-bold text-slate-800">{toolConfig.name}</span>
            </div>
            <button
              onClick={() => setExpandedTool(null)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="縮小"
            >
              <Minimize2 size={20} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* 工具內容 - 全寬顯示 */}
        <div className="p-4 md:p-6 pb-20">
          {renderToolContent(toolConfig)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in font-sans pb-20">
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600">
            <LayoutDashboard size={22} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-800">自由組合戰情室</h1>
            <p className="text-xs text-slate-500">拖曳移動位置・拖曳邊角調整大小・點擊放大操作</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 新增工具按鈕 */}
          <button
            onClick={() => setShowToolPicker(!showToolPicker)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm"
          >
            <Plus size={18} />
            新增工具
          </button>

          {/* 儲存 */}
          <button
            onClick={saveLayout}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl font-bold text-sm transition-all"
            title="儲存佈局"
          >
            <Save size={16} />
          </button>

          {/* 重置 */}
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-all"
            title="重置為預設"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* 工具選擇器 */}
      {showToolPicker && (
        <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-200 animate-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-slate-800">選擇要加入的工具</h3>
            <button onClick={() => setShowToolPicker(false)}>
              <X size={20} className="text-slate-400 hover:text-slate-600" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {TOOL_REGISTRY.map(tool => {
              const isAdded = addedTools.includes(tool.id);
              return (
                <button
                  key={tool.id}
                  onClick={() => handleAddTool(tool.id)}
                  disabled={isAdded}
                  className={`p-3 rounded-xl text-left transition-all text-sm font-medium flex items-center gap-2
                    ${isAdded
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-transparent hover:border-blue-200'
                    }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${tool.color} ${isAdded ? 'opacity-30' : ''}`}></span>
                  <span className="truncate">{tool.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid Layout 區域 */}
      <div ref={containerRef} id="grid-container" className="w-full">
        {addedTools.length === 0 ? (
          // 空狀態
          <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus size={32} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-600 mb-2">開始建立你的戰情室</h3>
            <p className="text-sm text-slate-500 mb-4">點擊「新增工具」按鈕，選擇要加入的理財工具</p>
            <button
              onClick={() => setShowToolPicker(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all"
            >
              新增第一個工具
            </button>
          </div>
        ) : (
          <GridLayout
            className="layout"
            layout={layout}
            width={containerWidth}
            gridConfig={{
              cols: 12,
              rowHeight: 40,
              margin: [16, 16] as const,
              containerPadding: [0, 0] as const,
              maxRows: Infinity,
            }}
            dragConfig={{
              enabled: true,
              handle: '.drag-handle',
            }}
            resizeConfig={{
              enabled: true,
            }}
            onLayoutChange={(newLayout) => handleLayoutChange([...newLayout])}
          >
            {addedTools.map(toolId => {
              const toolConfig = TOOL_REGISTRY.find(t => t.id === toolId);
              if (!toolConfig) return null;

              return (
                <div
                  key={toolId}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col group hover:shadow-lg hover:border-blue-300 transition-all"
                >
                  {/* Tool Header - 可拖曳區域 */}
                  <div className="drag-handle flex justify-between items-center px-3 py-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white cursor-move select-none">
                    <div className="flex items-center gap-2">
                      <GripVertical size={14} className="text-slate-300" />
                      <span className={`w-2 h-2 rounded-full ${toolConfig.color}`}></span>
                      <span className="font-bold text-slate-700 text-sm truncate">{toolConfig.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setExpandedTool(toolId)}
                        className="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-500 rounded transition-colors"
                        title="放大"
                      >
                        <Maximize2 size={14} />
                      </button>
                      <button
                        onClick={() => handleRemoveTool(toolId)}
                        className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-colors"
                        title="移除"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Tool Content */}
                  <div
                    className="flex-1 overflow-auto p-3 cursor-pointer"
                    onClick={() => setExpandedTool(toolId)}
                  >
                    <div className="pointer-events-none">
                      {renderToolContent(toolConfig)}
                    </div>
                  </div>

                  {/* 右下角 Resize 指示 */}
                  <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-slate-300"></div>
                  </div>
                </div>
              );
            })}
          </GridLayout>
        )}
      </div>

      {/* 操作提示 */}
      {addedTools.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <GripVertical size={16} className="text-blue-500" />
            <span className="text-blue-800 font-medium">拖曳標題列移動</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-r-2 border-b-2 border-blue-500"></div>
            <span className="text-blue-800 font-medium">拖曳右下角調整大小</span>
          </div>
          <div className="flex items-center gap-2">
            <Maximize2 size={16} className="text-blue-500" />
            <span className="text-blue-800 font-medium">點擊內容放大操作</span>
          </div>
        </div>
      )}

      {/* 筆記區域 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* 筆記標題列 */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-amber-600" />
            <span className="font-bold text-slate-700">顧問筆記</span>
            <span className="text-xs text-slate-400">（與客戶面談時記錄重點）</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="text-xs px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
            >
              {showNotes ? '收合' : '展開'}
            </button>
            {notes && (
              <button
                onClick={() => setNotes('')}
                className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                title="清除筆記"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* 筆記內容 */}
        {showNotes && (
          <div className="p-4">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="在此輸入會議記錄、客戶需求、重要提醒...&#10;&#10;例如：&#10;• 客戶預算：每月可存 2 萬&#10;• 風險承受度：中等偏保守&#10;• 主要目標：子女教育金 + 退休規劃&#10;• 下次跟進：2026/02/01"
              className="w-full min-h-[200px] p-4 bg-amber-50/50 border border-amber-100 rounded-xl text-slate-700 placeholder-slate-400 resize-y focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition-all"
              style={{ fontFamily: 'inherit', lineHeight: '1.6' }}
            />
            <div className="flex justify-between items-center mt-3 text-xs text-slate-400">
              <span>提示：筆記會在點擊「儲存」時一併保存</span>
              <span>{notes.length} 字</span>
            </div>
          </div>
        )}
      </div>

      <DisclaimerFooter scope="calc" />
    </div>
  );
};

export default FreeDashboardTool;
