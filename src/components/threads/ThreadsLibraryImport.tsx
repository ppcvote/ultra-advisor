/**
 * Threads 社群助理 - 批次匯入 Modal
 *
 * 格式：每篇文案用 --- 分隔
 */

import React, { useState, useMemo } from 'react';
import { X, Download, Loader2 } from 'lucide-react';

interface ThreadsLibraryImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (contents: string[]) => Promise<void>;
}

function parseBatchContent(raw: string): string[] {
  return raw
    .split(/^---$/m)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

const ThreadsLibraryImport: React.FC<ThreadsLibraryImportProps> = ({ isOpen, onClose, onImport }) => {
  const [rawText, setRawText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const parsed = useMemo(() => parseBatchContent(rawText), [rawText]);

  const handleImport = async () => {
    if (parsed.length === 0) return;
    setIsImporting(true);
    try {
      await onImport(parsed);
      setRawText('');
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[210] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h4 className="text-lg font-bold text-white flex items-center gap-2">
            <Download size={20} className="text-blue-400" />
            批次匯入文案
          </h4>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-400">
            將文案貼在下方，每篇文案之間用一行 <code className="bg-slate-800 px-1 py-0.5 rounded text-purple-300">---</code> 分隔。
          </p>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={12}
            placeholder={`---\n第一篇貼文內容\n可以有多行\n— @yourname｜簽名檔\n---\n第二篇貼文內容\n— @yourname｜簽名檔\n---`}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white text-sm
                     focus:border-purple-500 outline-none transition-colors resize-none placeholder:text-slate-600
                     leading-relaxed font-mono"
          />

          {rawText.trim() && (
            <p className="text-sm text-slate-300">
              已辨識 <span className="text-purple-400 font-bold">{parsed.length}</span> 篇文案
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-slate-800">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={parsed.length === 0 || isImporting}
            className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500
                     text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isImporting ? (
              <><Loader2 size={16} className="animate-spin" /> 匯入中...</>
            ) : (
              <>確認匯入 {parsed.length > 0 ? `(${parsed.length} 篇)` : ''}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThreadsLibraryImport;
