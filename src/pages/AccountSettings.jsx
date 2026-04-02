import React, { useState } from 'react';
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { Lock, Check, AlertCircle } from 'lucide-react';

export default function AccountSettings() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const validatePassword = (password) => {
    // 至少 8 位，包含英文和數字
    const regex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    return regex.test(password);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    // 驗證
    if (!validatePassword(newPassword)) {
      setMessage({ 
        type: 'error', 
        text: '密碼必須至少 8 位，包含英文和數字' 
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '新密碼與確認密碼不符' });
      return;
    }

    setLoading(true);

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      // 重新驗證用戶
      const credential = EmailAuthProvider.credential(
        user.email,
        oldPassword
      );
      await reauthenticateWithCredential(user, credential);

      // 更新密碼
      await updatePassword(user, newPassword);

      setMessage({ 
        type: 'success', 
        text: '密碼修改成功！請重新登入' 
      });

      // 3 秒後登出並跳轉到登入頁
      setTimeout(() => {
        auth.signOut();
        window.location.href = '/login';
      }, 3000);

    } catch (error) {
      console.error('修改密碼失敗:', error);
      
      let errorMessage = '修改失敗，請稍後再試';
      if (error.code === 'auth/wrong-password') {
        errorMessage = '舊密碼錯誤';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = '新密碼強度不足';
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">帳號設定</h1>

      <form onSubmit={handleChangePassword} className="space-y-4">
        
        {/* 舊密碼 */}
        <div>
          <label className="block text-sm font-bold mb-2">
            目前密碼
          </label>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
            required
          />
        </div>

        {/* 新密碼 */}
        <div>
          <label className="block text-sm font-bold mb-2">
            新密碼
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
            placeholder="至少 8 位，包含英文和數字"
            required
          />
        </div>

        {/* 確認密碼 */}
        <div>
          <label className="block text-sm font-bold mb-2">
            確認新密碼
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
            required
          />
        </div>

        {/* 訊息提示 */}
        {message.text && (
          <div className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800' 
              : 'bg-red-50 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <Check size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* 送出按鈕 */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold
                   hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '處理中...' : '修改密碼'}
        </button>
      </form>

      {/* 安全提示 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          <Lock className="inline mr-2" size={16} />
          安全提示：
        </p>
        <ul className="text-sm text-gray-600 mt-2 space-y-1 ml-6">
          <li>• 密碼長度至少 8 位</li>
          <li>• 必須包含英文字母和數字</li>
          <li>• 不要使用容易猜測的密碼</li>
          <li>• 定期更換密碼以確保安全</li>
        </ul>
      </div>
    </div>
  );
}