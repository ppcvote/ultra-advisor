/**
 * 保單 CRUD Hook
 * Firestore 路徑：users/{uid}/insurancePolicies/{policyId}
 */
import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { PolicyInfo } from '../types/insurance';
import { calcContractAge, calcTotalPremiumPaid, calcRemainingPaymentYears } from '../utils/contractCalculations';

export const usePolicies = (userId: string | null, clientId?: string | null) => {
  const [policies, setPolicies] = useState<PolicyInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // 監聽保單列表（client-side 過濾 clientId）
  useEffect(() => {
    if (!userId) {
      console.log('[usePolicies] No userId, skipping');
      setLoading(false);
      return;
    }
    console.log('[usePolicies] Setting up listener for userId:', userId, 'clientId:', clientId);
    const q = query(
      collection(db, 'users', userId, 'insurancePolicies'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      console.log('[usePolicies] Received snapshot with', snap.docs.length, 'policies');
      let data = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as PolicyInfo[];
      // 若有指定 clientId，只顯示該客戶的保單
      if (clientId) {
        const beforeFilter = data.length;
        data = data.filter(p => (p as any).clientId === clientId);
        console.log('[usePolicies] Filtered by clientId:', beforeFilter, '→', data.length);
      }
      setPolicies(data);
      setLoading(false);
    }, (err) => {
      console.error('[usePolicies] Listen error:', err);
      setLoading(false);
    });
    return () => unsub();
  }, [userId, clientId]);

  // 新增保單
  const addPolicy = useCallback(async (policy: Omit<PolicyInfo, 'id' | 'createdAt' | 'updatedAt' | 'value'>) => {
    if (!userId) return null;

    // 自動計算契約年資與已繳保費
    const age = calcContractAge(policy.effectiveDate);
    const totalPaid = calcTotalPremiumPaid(
      policy.totalAnnualPremium,
      policy.effectiveDate,
      policy.paymentFrequency,
    );

    const value: PolicyInfo['value'] = {
      contractYears: age.years,
      contractMonths: age.months,
      totalMonthsElapsed: age.totalMonths,
      totalPremiumPaid: totalPaid,
    };

    const now = new Date().toISOString();
    const ref = await addDoc(
      collection(db, 'users', userId, 'insurancePolicies'),
      {
        ...policy,
        ...(clientId ? { clientId } : {}),
        value,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }
    );
    return ref.id;
  }, [userId, clientId]);

  // 更新保單
  const updatePolicy = useCallback(async (policyId: string, updates: Partial<PolicyInfo>) => {
    if (!userId) return;
    await updateDoc(
      doc(db, 'users', userId, 'insurancePolicies', policyId),
      { ...updates, updatedAt: Timestamp.now() }
    );
  }, [userId]);

  // 刪除保單
  const removePolicy = useCallback(async (policyId: string) => {
    if (!userId) return;
    await deleteDoc(doc(db, 'users', userId, 'insurancePolicies', policyId));
  }, [userId]);

  // 依成員篩選
  const getPoliciesByMember = useCallback((memberId: string) => {
    return policies.filter(p => p.familyMemberId === memberId);
  }, [policies]);

  return {
    policies,
    loading,
    addPolicy,
    updatePolicy,
    removePolicy,
    getPoliciesByMember,
  };
};

export default usePolicies;
