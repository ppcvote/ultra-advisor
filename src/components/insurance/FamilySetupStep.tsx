/**
 * 家庭設定步驟（Step 2）
 * 整合：人物彙整 → 關係設定 → 自動產生家庭圖
 */
import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Users, Check, Edit2 } from 'lucide-react';
import { usePolicies } from '../../hooks/usePolicies';
import { useFamilyTree } from '../../hooks/useFamilyTree';
import type { PolicyInfo } from '../../types/insurance';
import PeopleAggregator from './PeopleAggregator';
import StaticFamilyTree from './StaticFamilyTree';
import type { Gender, RelationType, FamilyMember } from '../../types/insurance';

interface ExtractedPerson {
  name: string;
  birthDate?: string;
  estimatedBirthYear?: number;
  age?: number;
  gender?: Gender;
  role: 'applicant' | 'insured' | 'both';
  policyIds: string[];
}

interface FamilySetupStepProps {
  userId?: string;
  clientId?: string;
  familyTreeId?: string;
  onTreeCreated: (treeId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

type SetupPhase = 'aggregating' | 'tree_preview';

export default function FamilySetupStep({
  userId,
  clientId,
  familyTreeId,
  onTreeCreated,
  onNext,
  onBack,
}: FamilySetupStepProps) {
  const { policies, loading: policiesLoading, updatePolicy } = usePolicies(userId || null, clientId);
  const {
    trees,
    activeTree,
    loading: treeLoading,
    createTree,
    selectTree,
    addMember,
    linkSpouse,
    linkParentChild,
  } = useFamilyTree(userId || null, clientId);

  const [phase, setPhase] = useState<SetupPhase>('aggregating');
  const [aggregatedData, setAggregatedData] = useState<{
    mainPerson: ExtractedPerson;
    people: ExtractedPerson[];
    relationships: Record<string, RelationType>;
  } | null>(null);

  // 如果已經有家庭圖，直接顯示預覽
  useEffect(() => {
    if (familyTreeId && trees.length > 0) {
      selectTree(familyTreeId);
      setPhase('tree_preview');
    }
  }, [familyTreeId, trees]);

  // 處理人物彙整完成
  const handleAggregationComplete = async (data: {
    mainPerson: ExtractedPerson;
    people: ExtractedPerson[];
    relationships: Record<string, RelationType>;
  }) => {
    setAggregatedData(data);

    if (!userId) return;

    // 自動建立家庭圖
    const mainPerson = data.mainPerson;
    const newTree = await createTree(
      `${mainPerson.name}家`,
      mainPerson.name,
      mainPerson.gender || 'male'
    );

    if (!newTree) return;

    onTreeCreated(newTree.id);

    // 加入其他成員並設定關係
    const memberIdMap = new Map<string, string>();
    memberIdMap.set(mainPerson.name, newTree.mainInsuredId);

    // 依序加入其他成員
    for (const person of data.people) {
      if (person.name === mainPerson.name) continue;

      const relation = data.relationships[person.name];
      const newMember = await addMember({
        name: person.name,
        relationship: relation,
        gender: person.gender || 'male',
        birthDate: person.birthDate,
        isMainInsured: false,
        isSelectedForPlanning: true,
        policyIds: person.policyIds,
        childrenIds: [],
        parentIds: [],
      });

      if (newMember) {
        memberIdMap.set(person.name, newMember.id);

        // 建立關係連結
        if (relation === 'spouse') {
          await linkSpouse(newTree.mainInsuredId, newMember.id);
        } else if (['father', 'mother'].includes(relation)) {
          await linkParentChild(newMember.id, newTree.mainInsuredId);
        } else if (['son', 'daughter'].includes(relation)) {
          await linkParentChild(newTree.mainInsuredId, newMember.id);
        }
      }
    }

    // 更新保單的 familyMemberId（根據被保險人姓名匹配）
    for (const policy of policies) {
      const insuredName = policy.insured || policy.applicant;
      if (insuredName && memberIdMap.has(insuredName)) {
        const memberId = memberIdMap.get(insuredName);
        if (memberId && policy.familyMemberId !== memberId) {
          await updatePolicy(policy.id, { familyMemberId: memberId });
        }
      }
    }

    setPhase('tree_preview');
  };

  // 載入中
  if (policiesLoading || treeLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // 沒有保單
  if (policies.length === 0) {
    return (
      <div className="p-6 text-center">
        <Users size={48} className="mx-auto text-slate-300 mb-4" />
        <p className="text-slate-600 font-medium mb-2">尚未輸入保單</p>
        <p className="text-sm text-slate-400 mb-6">請先返回上一步輸入保單資料</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-medium"
        >
          <ArrowLeft size={18} />
          返回保單輸入
        </button>
      </div>
    );
  }

  // 階段 1：人物彙整與關係設定
  if (phase === 'aggregating') {
    return (
      <PeopleAggregator
        policies={policies}
        onComplete={handleAggregationComplete}
        onBack={onBack}
      />
    );
  }

  // 階段 2：家庭圖預覽
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">家庭圖確認</h2>
          <p className="text-sm text-slate-500 mt-1">
            已自動建立家庭圖，請確認後繼續
          </p>
        </div>
        <button
          onClick={() => setPhase('aggregating')}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
        >
          <Edit2 size={14} />
          重新設定
        </button>
      </div>

      {/* 固定排列家庭圖 */}
      {activeTree && (
        <StaticFamilyTree
          tree={activeTree}
          policies={policies}
        />
      )}

      {/* 按鈕 */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium flex items-center justify-center gap-2"
        >
          <ArrowLeft size={18} />
          返回保單輸入
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          確認，產生報告
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
