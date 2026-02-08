import React, { useState } from 'react';
import { ChevronLeft, Play, RefreshCw } from 'lucide-react';
import UltraCloudLogo from '../components/UltraCloudLogo';

interface UltraCloudDemoProps {
  onBack: () => void;
}

/**
 * UltraCloud Logo 展示頁面
 * 用於預覽和測試 Logo 動畫效果
 */
const UltraCloudDemo: React.FC<UltraCloudDemoProps> = ({ onBack }) => {
  const [key, setKey] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const handleReplay = () => {
    setKey(prev => prev + 1);
    setIsPlaying(true);
  };

  return (
    <div className="min-h-screen bg-[#050b14] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
            <span>返回</span>
          </button>
          <h1 className="text-white font-bold">UltraCloud Logo 預覽</h1>
          <button
            onClick={handleReplay}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
            重播動畫
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Background Grid */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(77, 163, 255, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(77, 163, 255, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Logo Display Area */}
        <div className="relative z-10 flex flex-col items-center">
          <UltraCloudLogo
            key={key}
            size={320}
            autoPlay={isPlaying}
            showText={true}
            onAnimationComplete={() => console.log('Animation complete!')}
          />
        </div>

        {/* Size Variations */}
        <div className="mt-16 grid grid-cols-3 gap-8">
          <div className="flex flex-col items-center">
            <p className="text-slate-400 text-sm mb-4">小尺寸 (120px)</p>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <UltraCloudLogo
                key={`small-${key}`}
                size={120}
                autoPlay={isPlaying}
                showText={false}
              />
            </div>
          </div>

          <div className="flex flex-col items-center">
            <p className="text-slate-400 text-sm mb-4">中尺寸 (200px)</p>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <UltraCloudLogo
                key={`medium-${key}`}
                size={200}
                autoPlay={isPlaying}
                showText={false}
              />
            </div>
          </div>

          <div className="flex flex-col items-center">
            <p className="text-slate-400 text-sm mb-4">圖示尺寸 (64px)</p>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <UltraCloudLogo
                key={`icon-${key}`}
                size={64}
                autoPlay={isPlaying}
                showText={false}
              />
            </div>
          </div>
        </div>

        {/* Animation Timeline Description */}
        <div className="mt-16 max-w-2xl">
          <h2 className="text-white text-xl font-bold mb-4 text-center">動畫時間軸</h2>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-20 text-right text-slate-500 text-sm">0.2s</div>
                <div className="flex-1 h-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded" />
                <div className="text-slate-300 text-sm">藍色曲線繪製</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-20 text-right text-slate-500 text-sm">0.6s</div>
                <div className="flex-1 h-2 bg-gradient-to-r from-red-500 to-red-600 rounded" />
                <div className="text-slate-300 text-sm">紅色曲線繪製</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-20 text-right text-slate-500 text-sm">1.0s</div>
                <div className="flex-1 h-2 bg-gradient-to-r from-purple-500 to-purple-600 rounded" />
                <div className="text-slate-300 text-sm">紫色橫線繪製</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-20 text-right text-slate-500 text-sm">1.8s</div>
                <div className="flex-1 h-2 bg-gradient-to-r from-slate-600 to-slate-700 rounded" />
                <div className="text-slate-300 text-sm">原始線條淡出</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-20 text-right text-slate-500 text-sm">2.0s</div>
                <div className="flex-1 h-2 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded" />
                <div className="text-slate-300 text-sm">雲朵浮現</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-20 text-right text-slate-500 text-sm">2.8s</div>
                <div className="flex-1 h-2 bg-gradient-to-r from-white/50 to-white/80 rounded" />
                <div className="text-slate-300 text-sm">文字顯示</div>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Code */}
        <div className="mt-8 max-w-2xl w-full">
          <h2 className="text-white text-xl font-bold mb-4 text-center">使用方式</h2>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 overflow-x-auto">
            <pre className="text-sm text-slate-300">
{`import UltraCloudLogo from './components/UltraCloudLogo';

// 基本使用
<UltraCloudLogo />

// 自訂尺寸
<UltraCloudLogo size={200} />

// 不顯示文字（適合作為圖示）
<UltraCloudLogo size={64} showText={false} />

// 動畫完成回呼
<UltraCloudLogo
  onAnimationComplete={() => {
    console.log('動畫播放完成！');
  }}
/>`}
            </pre>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-800">
        <div className="text-center text-slate-500 text-sm">
          UltraCloud Logo - 基於 Ultra Advisor 品牌視覺延伸
        </div>
      </footer>
    </div>
  );
};

export default UltraCloudDemo;
