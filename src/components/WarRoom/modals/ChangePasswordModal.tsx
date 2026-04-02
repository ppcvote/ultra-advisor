import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Check, AlertCircle, Loader2, X } from 'lucide-react';
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  isFirstLogin?: boolean;
  userId?: string;
  onPasswordChanged?: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen, onClose, isFirstLogin = false, userId, onPasswordChanged
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (isOpen) {
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      setMessage({ type: '', text: '' });
      setShowOld(false); setShowNew(false); setShowConfirm(false);
    }
  }, [isOpen]);

  const validatePassword = (password: string) =>
    /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/.test(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!validatePassword(newPassword)) {
      setMessage({ type: 'error', text: '密碼必須至少 8 位，包含英文和數字' }); return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '新密碼與確認密碼不符' }); return;
    }
    if (oldPassword === newPassword) {
      setMessage({ type: 'error', text: '新密碼不能與舊密碼相同' }); return;
    }

    setLoading(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('未登入，請重新登入後再試');
      if (!currentUser.email) throw new Error('無法取得用戶 Email');

      const credential = EmailAuthProvider.credential(currentUser.email, oldPassword);
      try {
        await reauthenticateWithCredential(currentUser, credential);
      } catch (reauthError: any) {
        if (reauthError.code === 'auth/wrong-password' || reauthError.code === 'auth/invalid-credential') {
          setMessage({ type: 'error', text: '目前密碼錯誤，請重新輸入' });
        } else if (reauthError.code === 'auth/too-many-requests') {
          setMessage({ type: 'error', text: '嘗試次數過多，請稍後再試' });
        } else {
          setMessage({ type: 'error', text: '驗證失敗：' + reauthError.message });
        }
        setLoading(false); return;
      }

      await updatePassword(currentUser, newPassword);

      if (isFirstLogin && userId) {
        try {
          await setDoc(doc(db, 'users', userId), {
            needsPasswordChange: false, passwordChangedAt: Timestamp.now()
          }, { merge: true });
        } catch (e) { console.error('Failed to update needsPasswordChange flag:', e); }
      }

      setMessage({ type: 'success', text: '✅ 密碼修改成功！3 秒後將重新登入...' });
      if (onPasswordChanged) onPasswordChanged();

      setTimeout(async () => {
        try { await auth.signOut(); window.location.href = '/login'; }
        catch { window.location.reload(); }
      }, 3000);
    } catch (error: any) {
      console.error('Password change failed:', error);
      let errorMessage = '修改失敗，請稍後再試';
      switch (error.code) {
        case 'auth/weak-password': errorMessage = '新密碼強度不足，請使用更複雜的密碼'; break;
        case 'auth/requires-recent-login': errorMessage = '安全驗證已過期，請重新登入後再試'; break;
        case 'auth/network-request-failed': errorMessage = '網路連線失敗，請檢查網路後再試'; break;
        default: errorMessage = error.message || '未知錯誤，請稍後再試';
      }
      setMessage({ type: 'error', text: errorMessage });
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <Lock className="text-amber-400" size={24} />
            {isFirstLogin ? '首次登入 - 請修改密碼' : '修改密碼'}
          </h3>
          {!isFirstLogin && (
            <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
          )}
        </div>

        {isFirstLogin && (
          <div className="mx-6 mt-4 p-4 bg-amber-900/20 border border-amber-500/30 rounded-xl">
            <p className="text-amber-300 text-sm font-bold flex items-center gap-2">
              <AlertCircle size={16} /> 為了帳號安全，首次登入需修改密碼
            </p>
            <p className="text-amber-400/70 text-xs mt-1">請設定一個您自己的密碼，修改後需重新登入</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="text-sm text-slate-400 font-bold mb-2 block">目前密碼</label>
            <div className="relative">
              <input type={showOld ? 'text' : 'password'} value={oldPassword} onChange={e => setOldPassword(e.target.value)}
                required autoComplete="current-password"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 pr-12 text-white focus:border-amber-500 outline-none transition-all" />
              <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                {showOld ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400 font-bold mb-2 block">新密碼</label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="至少 8 位，包含英文和數字" required autoComplete="new-password"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 pr-12 text-white focus:border-amber-500 outline-none transition-all" />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {newPassword && (
              <div className="mt-2 flex items-center gap-2">
                <div className={`h-1 flex-1 rounded ${newPassword.length >= 8 ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                <div className={`h-1 flex-1 rounded ${/[A-Za-z]/.test(newPassword) ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                <div className={`h-1 flex-1 rounded ${/\d/.test(newPassword) ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                <span className="text-[10px] text-slate-500">{validatePassword(newPassword) ? '✓ 符合要求' : '強度不足'}</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm text-slate-400 font-bold mb-2 block">確認新密碼</label>
            <div className="relative">
              <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                required autoComplete="new-password"
                className={`w-full bg-slate-950 border rounded-xl py-3 px-4 pr-12 text-white outline-none transition-all ${
                  confirmPassword && confirmPassword !== newPassword ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-amber-500'
                }`} />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-red-400 text-xs mt-1">密碼不一致</p>
            )}
          </div>

          {message.text && (
            <div className={`p-4 rounded-xl flex items-center gap-3 ${
              message.type === 'success' ? 'bg-emerald-900/20 border border-emerald-500/20 text-emerald-400' : 'bg-red-900/20 border border-red-500/20 text-red-400'
            }`}>
              {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
              <span className="font-bold text-sm">{message.text}</span>
            </div>
          )}

          <button type="submit" disabled={loading || !oldPassword || !newPassword || !confirmPassword}
            className="w-full py-4 bg-amber-600 text-white rounded-xl font-bold text-lg hover:bg-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="animate-spin" size={20} /> 處理中...</> : '修改密碼'}
          </button>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
            <p className="text-xs text-slate-500 font-bold mb-2 flex items-center gap-2"><Lock size={12} /> 安全提示</p>
            <ul className="text-xs text-slate-500 space-y-1">
              <li>• 密碼長度至少 8 位</li>
              <li>• 必須包含英文字母和數字</li>
              <li>• 修改成功後將自動登出</li>
              <li>• 定期更換密碼以確保安全</li>
            </ul>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
