/**
 * OCR 保單上傳元件
 * 拍照/上傳 → base64 編碼 → Cloud Function (Gemini Vision) 解析
 */
import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import type { PolicyInfo } from '../../types/insurance';

interface OcrUploaderProps {
  userId: string;
  familyMemberId?: string;
  onParsed: (result: Partial<PolicyInfo>) => void;
  onClose: () => void;
}

type OcrStatus = 'idle' | 'preprocessing' | 'uploading' | 'parsing' | 'done' | 'error';

export default function OcrUploader({ userId, familyMemberId, onParsed, onClose }: OcrUploaderProps) {
  const [status, setStatus] = useState<OcrStatus>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // 將 HEIC/HEIF 或其他不支援的格式轉為 JPEG（透過 canvas）
  function convertToJpeg(file: File): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('無法建立 canvas')); return; }
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          const base64 = dataUrl.split(',')[1];
          if (!base64) { reject(new Error('Canvas 轉換失敗')); return; }
          resolve({ base64, mimeType: 'image/jpeg' });
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('無法載入圖片進行格式轉換'));
      };
      img.src = url;
    });
  }

  const processImage = useCallback(async (file: File) => {
    setErrorMsg('');

    // 預覽
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    let currentStep = '';
    try {
      // 1. 讀取圖片為 base64（HEIC/HEIF 自動轉 JPEG）
      currentStep = '讀取圖片';
      setStatus('preprocessing');
      const fileType = file.type?.toLowerCase() || '';
      console.log('[OCR] Step 1: reading file, size:', file.size, 'type:', fileType);

      let base64Data: string;
      let sendMimeType: string;

      if (fileType === 'image/heic' || fileType === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
        // HEIC/HEIF → 用 canvas 轉 JPEG
        console.log('[OCR] Detected HEIC/HEIF, converting to JPEG via canvas');
        try {
          const converted = await convertToJpeg(file);
          base64Data = converted.base64;
          sendMimeType = converted.mimeType;
          console.log('[OCR] HEIC→JPEG conversion done, base64 length:', base64Data.length);
        } catch (convErr) {
          // canvas 無法處理 HEIC（部分瀏覽器不支援），直接送原始資料讓後端處理
          console.warn('[OCR] HEIC canvas conversion failed, sending raw:', convErr);
          base64Data = await fileToBase64(file);
          sendMimeType = 'image/jpeg'; // 告訴 Gemini 當成 JPEG 嘗試
        }
      } else {
        base64Data = await fileToBase64(file);
        sendMimeType = fileType || 'image/jpeg';
      }
      console.log('[OCR] Step 1 done, base64 length:', base64Data.length, 'mimeType:', sendMimeType);

      // 2. 呼叫 Cloud Function（Gemini Vision 直接辨識圖片）
      currentStep = 'AI 辨識解析';
      setStatus('parsing');
      console.log('[OCR] Step 2: calling parseInsuranceOCR with base64');
      const parseOcr = httpsCallable(functions, 'parseInsuranceOCR', { timeout: 120000 });
      const result = await parseOcr({
        imageBase64: base64Data,
        mimeType: sendMimeType,
        familyMemberId,
      });
      const parsed = (result.data as any).policy as Partial<PolicyInfo>;
      console.log('[OCR] Step 2 done, parsed result:', parsed);

      setStatus('done');
      onParsed(parsed);
    } catch (err: any) {
      console.error(`[OCR] Error at step "${currentStep}":`, err?.code, err?.message, err);
      setStatus('error');
      let msg: string;
      if (err?.code === 'functions/unauthenticated') {
        msg = '請先登入後再使用 OCR 功能';
      } else if (err?.code === 'functions/internal') {
        msg = `伺服器解析失敗：${err?.message || '未知錯誤'}`;
      } else if (err?.code === 'storage/unauthorized') {
        msg = '上傳權限不足，請確認已登入';
      } else {
        msg = `[${currentStep}] ${err?.message || 'OCR 解析失敗，請改用手動輸入'}`;
      }
      setErrorMsg(msg);
    }
  }, [userId, familyMemberId, onParsed]);

  // 將檔案讀取為 base64（不含 data:...;base64, 前綴）
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        // 移除 "data:image/jpeg;base64," 前綴，只保留純 base64
        const base64 = dataUrl.split(',')[1];
        if (!base64) {
          reject(new Error('無法轉換檔案為 base64'));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('無法讀取檔案'));
      reader.readAsDataURL(file);
    });
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const statusText: Record<OcrStatus, string> = {
    idle: '',
    preprocessing: '讀取圖片中...',
    uploading: '上傳中...',
    parsing: 'AI 辨識解析中（約 10-20 秒）...',
    done: '解析完成！',
    error: '解析失敗',
  };

  return (
    <div className="p-6">
      <h3 className="text-lg font-bold text-slate-800 mb-4">OCR 保單辨識</h3>

      {/* 上傳區域 */}
      {status === 'idle' && (
        <div className="space-y-4">
          {/* 兩種輸入方式 */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center gap-3 py-8 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-2xl hover:from-blue-100 hover:to-blue-200 transition-all"
            >
              <Camera size={32} className="text-blue-600" />
              <div>
                <p className="text-blue-700 font-medium text-sm">拍照辨識</p>
                <p className="text-xs text-blue-400 mt-0.5">直接拍攝保單</p>
              </div>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-3 py-8 bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-2xl hover:from-purple-100 hover:to-purple-200 transition-all"
            >
              <Upload size={32} className="text-purple-600" />
              <div>
                <p className="text-purple-700 font-medium text-sm">上傳照片</p>
                <p className="text-xs text-purple-400 mt-0.5">從相簿選擇</p>
              </div>
            </button>
          </div>

          <p className="text-center text-xs text-slate-400">支援 JPG、PNG、HEIC 格式</p>

          <button
            onClick={onClose}
            className="w-full py-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 text-sm"
          >
            取消
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* 處理中 */}
      {['preprocessing', 'uploading', 'parsing'].includes(status) && (
        <div className="text-center py-12">
          {preview && (
            <img
              src={preview}
              alt="保單預覽"
              className="max-h-48 mx-auto rounded-xl mb-6 shadow-lg"
            />
          )}
          <Loader2 size={32} className="mx-auto text-blue-500 animate-spin mb-4" />
          <p className="text-slate-600 font-medium">{statusText[status]}</p>
          <p className="text-xs text-slate-400 mt-2">
            使用 Gemini AI 進行結構化解析
          </p>
          <button
            onClick={() => { setStatus('idle'); setPreview(null); }}
            className="mt-6 px-4 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            取消
          </button>
        </div>
      )}

      {/* 完成 */}
      {status === 'done' && (
        <div className="text-center py-12">
          <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" />
          <p className="text-emerald-700 font-medium">解析完成！請確認資料是否正確。</p>
        </div>
      )}

      {/* 錯誤 */}
      {status === 'error' && (
        <div className="text-center py-8">
          <AlertTriangle size={48} className="mx-auto text-amber-500 mb-4" />
          <p className="text-slate-700 font-medium mb-2">辨識失敗</p>
          <p className="text-sm text-slate-500 mb-6">{errorMsg}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setStatus('idle'); setPreview(null); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              重新上傳
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
            >
              改用手動輸入
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
