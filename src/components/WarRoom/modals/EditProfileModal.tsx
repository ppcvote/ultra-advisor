import React, { useState, useEffect, useRef } from 'react';
import { User, Camera, Mail, Phone, MessageCircle, Instagram, Info, Save, Loader2, X, Bell, BellOff } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { storage, db, functions } from '../../../firebase';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import type { ProfileData } from '../types';

import { toast } from '../../../utils/toast';
// 推播通知區塊
const PushNotificationSection = ({ userId }: { userId: string | null }) => {
  const {
    isSupported, permission, isSubscribed, isLoading, subscribe, unsubscribe,
  } = usePushNotifications(userId);

  if (!isSupported || permission === 'denied') {
    return (
      <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-700">
            <BellOff size={20} className="text-slate-500" />
          </div>
          <div>
            <h4 className="text-slate-400 font-medium">推播通知</h4>
            <p className="text-slate-500 text-xs">
              {!isSupported ? '您的瀏覽器不支援推播通知' : '通知權限已被封鎖，請在瀏覽器設定中開啟'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleToggle = async () => {
    if (isSubscribed) await unsubscribe();
    else await subscribe();
  };

  return (
    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isSubscribed ? 'bg-purple-600/20' : 'bg-slate-700'}`}>
            {isSubscribed ? <Bell size={20} className="text-purple-400" /> : <BellOff size={20} className="text-slate-400" />}
          </div>
          <div>
            <h4 className="text-white font-medium">推播通知</h4>
            <p className="text-slate-500 text-xs">
              {isSubscribed ? '已開啟 - 會收到新文章、系統通知' : '開啟後可收到重要通知'}
            </p>
          </div>
        </div>
        <button onClick={handleToggle} disabled={isLoading}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
            isSubscribed ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-purple-600 text-white hover:bg-purple-500'
          }`}>
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : isSubscribed ? <><BellOff size={16} /> 關閉</> : <><Bell size={16} /> 開啟</>}
        </button>
      </div>
    </div>
  );
};

// Pin（Telegram）通知綁定區塊
const PinNotificationSection = ({ userId }: { userId: string | null }) => {
  const [pinUserId, setPinUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) { setChecking(false); return; }
    getDoc(doc(db, 'users', userId))
      .then((snap) => { if (snap.exists()) setPinUserId(snap.data().pinUserId ?? null); })
      .catch(console.error)
      .finally(() => setChecking(false));
  }, [userId]);

  const handleConnect = async () => {
    const trimmed = token.trim();
    if (!trimmed) { setError('請輸入 Token'); return; }
    setLoading(true); setError(null); setSuccess(null);
    try {
      const fn = httpsCallable(functions, 'connectPinNotifications');
      const result = await fn({ token: trimmed }) as { data: { pinUserId: string } };
      setPinUserId(result.data.pinUserId);
      setToken('');
      setSuccess('已成功連結！之後每日金句會推送到你的 Telegram。');
    } catch (err: any) {
      setError(err.message || '連結失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true); setError(null); setSuccess(null);
    try {
      const fn = httpsCallable(functions, 'disconnectPin');
      await fn({});
      setPinUserId(null);
      setSuccess('已解除 Pin 連結');
    } catch (err: any) {
      setError(err.message || '解除失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;

  return (
    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl space-y-3">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${pinUserId ? 'bg-blue-600/20' : 'bg-slate-700'}`}>
          {pinUserId
            ? <Bell size={20} className="text-blue-400" />
            : <BellOff size={20} className="text-slate-400" />}
        </div>
        <div>
          <h4 className="text-white font-medium">Pin 通知（Telegram）</h4>
          <p className="text-slate-500 text-xs">
            {pinUserId
              ? '已連結 — 每日金句會推送到你的 Telegram'
              : '連結後每日金句自動推送到 Telegram'}
          </p>
        </div>
      </div>

      {pinUserId ? (
        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="w-full py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <BellOff size={14} />}
          解除連結
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            在 <strong className="text-slate-300">Pin</strong>（<a href="https://t.me/UltraPinaibot" target="_blank" rel="noreferrer" className="text-teal-400 underline">t.me/UltraPinaibot</a>）選單點「📚 Ultra Advisor」→「🔔 綁定通知」取得 8 碼 Token（10 分鐘內有效），貼到下方
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={token}
              onChange={e => { setToken(e.target.value.trim()); setError(null); }}
              placeholder="貼上 8 碼 Token"
              maxLength={8}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-white text-sm font-mono tracking-widest focus:border-blue-500 outline-none transition-all"
            />
            <button
              onClick={handleConnect}
              disabled={loading || token.length !== 8}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : '連結'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
      {success && <p className="text-blue-400 text-xs">{success}</p>}
    </div>
  );
};

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  profileData: ProfileData;
  onSave: (data: ProfileData) => Promise<void>;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, user, profileData, onSave }) => {
  const [formData, setFormData] = useState<ProfileData>(profileData);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setFormData(profileData); }, [profileData]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `avatars/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setFormData(prev => ({ ...prev, photoURL: downloadURL }));
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('上傳失敗，請稍後再試');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('儲存失敗');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 flex items-center justify-between p-6 border-b border-slate-800 z-10">
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <User className="text-blue-400" size={24} /> 編輯個人資料
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center overflow-hidden border-4 border-slate-700">
                {formData.photoURL ? (
                  <img src={formData.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-black text-white">{formData.displayName?.charAt(0) || 'U'}</span>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="animate-spin text-white" size={24} />
                  </div>
                )}
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-500 transition-colors">
                <Camera size={16} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </div>
            <p className="text-xs text-slate-500 mt-2">點擊上傳大頭貼</p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 font-bold mb-2 block">顧問名稱</label>
              <input type="text" value={formData.displayName}
                onChange={e => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                placeholder="輸入您的名稱"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-blue-500 outline-none transition-all" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 font-bold mb-2 flex items-center gap-2"><Phone size={14} /> 手機</label>
                <input type="tel" value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="0912-345-678"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-blue-500 outline-none transition-all" />
              </div>
              <div>
                <label className="text-sm text-slate-400 font-bold mb-2 flex items-center gap-2"><Mail size={14} /> Email</label>
                <input type="email" value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="your@email.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-blue-500 outline-none transition-all" />
              </div>
              <div>
                <label className="text-sm text-slate-400 font-bold mb-2 flex items-center gap-2"><MessageCircle size={14} className="text-emerald-400" /> LINE ID</label>
                <input type="text" value={formData.lineId}
                  onChange={e => setFormData(prev => ({ ...prev, lineId: e.target.value }))}
                  placeholder="your_line_id"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-emerald-500 outline-none transition-all" />
              </div>
              <div>
                <label className="text-sm text-slate-400 font-bold mb-2 flex items-center gap-2"><Instagram size={14} className="text-pink-400" /> Instagram</label>
                <input type="text" value={formData.instagram}
                  onChange={e => setFormData(prev => ({ ...prev, instagram: e.target.value }))}
                  placeholder="@your_instagram"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-pink-500 outline-none transition-all" />
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-900/20 border border-blue-500/20 rounded-xl">
            <div className="flex gap-3 items-start">
              <Info size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-400 leading-relaxed">
                這些資訊將用於未來的<strong className="text-blue-400">限動產生器</strong>和
                <strong className="text-blue-400">報表產生器</strong>，讓您的品牌一致呈現。
              </p>
            </div>
          </div>

          <PushNotificationSection userId={user?.uid} />

          <PinNotificationSection userId={user?.uid ?? null} />
        </div>

        <div className="sticky bottom-0 bg-slate-900 flex gap-3 p-6 border-t border-slate-800">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 bg-slate-800 text-slate-400 rounded-xl font-bold hover:bg-slate-700 transition-all">取消</button>
          <button type="button" onClick={handleSubmit} disabled={loading}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="animate-spin" size={18} /> 儲存中...</> : <><Save size={18} /> 儲存變更</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProfileModal;
