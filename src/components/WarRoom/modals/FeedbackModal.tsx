import React, { useState } from 'react';
import { Lightbulb, Coins, Check, Send, Loader2, X } from 'lucide-react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  userName: string;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, user, userName }) => {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || !user) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'feedbacks'), {
        userId: user.uid,
        userEmail: user.email,
        userName: userName || user.displayName || '匿名用戶',
        content: content.trim(),
        status: 'pending',
        createdAt: Timestamp.now(),
        pointsAwarded: false,
      });
      try {
        const token = await user.getIdToken();
        await fetch('/api/points/award-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ amount: 10, reason: 'feedback_submit' })
        });
      } catch {}
      setSuccess(true);
      setContent('');
      setTimeout(() => { setSuccess(false); onClose(); }, 2000);
    } catch { alert('提交失敗，請重試'); }
    finally { setSubmitting(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <Lightbulb className="text-emerald-400" size={24} /> 功能建議
          </h3>
          <button onClick={() => { onClose(); setContent(''); setSuccess(false); }} className="p-2 text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        <div className="p-6">
          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="text-emerald-400" size={32} />
              </div>
              <h4 className="text-xl font-bold text-white mb-2">感謝您的建議！</h4>
              <p className="text-emerald-400 text-sm">已獲得 +10 UA 點獎勵</p>
            </div>
          ) : (
            <>
              <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-4 mb-4">
                <p className="text-emerald-300 text-sm flex items-center gap-2">
                  <Coins size={16} /> 提交建議即可獲得 <span className="font-bold">+10 UA 點</span> 獎勵！
                </p>
              </div>
              <div>
                <label className="text-sm text-slate-400 font-bold mb-2 block">您希望新增什麼功能？</label>
                <textarea value={content} onChange={e => setContent(e.target.value)}
                  placeholder="請描述您希望新增或改進的功能..." rows={5}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-emerald-500 outline-none resize-none" />
              </div>
            </>
          )}
        </div>
        {!success && (
          <div className="flex gap-3 p-6 border-t border-slate-800">
            <button onClick={() => { onClose(); setContent(''); }}
              className="flex-1 py-3 bg-slate-800 text-slate-400 rounded-xl font-bold hover:bg-slate-700 transition-all">取消</button>
            <button onClick={handleSubmit} disabled={!content.trim() || submitting}
              className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />} 提交建議
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackModal;
