/**
 * 靜態家庭圖元件
 * 固定排列、不可拖動，顯示家庭成員與保單數量
 */
import React from 'react';
import { User, Shield, FileText } from 'lucide-react';
import type { FamilyTree, FamilyMember, PolicyInfo } from '../../types/insurance';
import { RELATION_LABELS } from '../../types/insurance';

interface StaticFamilyTreeProps {
  tree: FamilyTree;
  policies: PolicyInfo[];
}

// 計算成員的保單數
function countPolicies(memberId: string, memberName: string, policies: PolicyInfo[]): number {
  return policies.filter(p =>
    p.familyMemberId === memberId ||
    p.insured === memberName ||
    p.applicant === memberName
  ).length;
}

// 計算成員的年保費
function sumPremium(memberId: string, memberName: string, policies: PolicyInfo[]): number {
  return policies
    .filter(p =>
      p.familyMemberId === memberId ||
      p.insured === memberName
    )
    .reduce((sum, p) => sum + (p.totalAnnualPremium || 0), 0);
}

// 成員卡片
function MemberCard({
  member,
  isMain,
  policyCount,
  premium,
}: {
  member: FamilyMember;
  isMain: boolean;
  policyCount: number;
  premium: number;
}) {
  return (
    <div
      className={`relative p-4 rounded-xl border-2 transition-all ${
        isMain
          ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300 shadow-lg'
          : 'bg-white border-slate-200 hover:border-blue-200'
      }`}
      style={{ minWidth: 140 }}
    >
      {/* 主被保人標籤 */}
      {isMain && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
          主被保人
        </div>
      )}

      {/* 頭像 */}
      <div className="flex justify-center mb-2">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
            member.gender === 'female' ? 'bg-pink-500' : 'bg-blue-500'
          }`}
        >
          {member.name.charAt(0)}
        </div>
      </div>

      {/* 姓名 */}
      <div className="text-center font-medium text-slate-800 mb-0.5">
        {member.name}
      </div>

      {/* 關係 */}
      {!isMain && (
        <div className="text-center text-xs text-slate-500 mb-2">
          {RELATION_LABELS[member.relationship] || member.relationship}
        </div>
      )}

      {/* 保單統計 */}
      <div className="mt-2 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-center gap-1 text-xs text-slate-500">
          <FileText size={12} />
          <span>{policyCount} 張保單</span>
        </div>
        {premium > 0 && (
          <div className="text-center text-xs text-blue-600 mt-1">
            年繳 NT$ {premium.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

// 連線
function Connector({ type }: { type: 'vertical' | 'horizontal' | 'spouse' }) {
  if (type === 'vertical') {
    return (
      <div className="flex justify-center">
        <div className="w-0.5 h-8 bg-slate-300" />
      </div>
    );
  }
  if (type === 'spouse') {
    return (
      <div className="flex items-center justify-center px-2">
        <div className="w-8 h-0.5 bg-pink-300" />
        <div className="text-pink-400 text-xs">♥</div>
        <div className="w-8 h-0.5 bg-pink-300" />
      </div>
    );
  }
  return <div className="w-8 h-0.5 bg-slate-300" />;
}

export default function StaticFamilyTree({ tree, policies }: StaticFamilyTreeProps) {
  const mainMember = tree.members.find(m => m.id === tree.mainInsuredId);
  const spouse = tree.members.find(m => m.spouseId === tree.mainInsuredId || mainMember?.spouseId === m.id);
  const parents = tree.members.filter(m =>
    ['father', 'mother', 'father_in_law', 'mother_in_law'].includes(m.relationship)
  );
  const children = tree.members.filter(m =>
    ['son', 'daughter'].includes(m.relationship)
  );
  const siblings = tree.members.filter(m =>
    ['brother', 'sister'].includes(m.relationship)
  );
  const others = tree.members.filter(m =>
    m.id !== tree.mainInsuredId &&
    m.id !== spouse?.id &&
    !parents.includes(m) &&
    !children.includes(m) &&
    !siblings.includes(m)
  );

  if (!mainMember) return null;

  return (
    <div className="bg-slate-50 rounded-2xl p-6 overflow-x-auto">
      {/* 父母層 */}
      {parents.length > 0 && (
        <>
          <div className="flex justify-center gap-4 mb-2">
            {parents.map(parent => (
              <MemberCard
                key={parent.id}
                member={parent}
                isMain={false}
                policyCount={countPolicies(parent.id, parent.name, policies)}
                premium={sumPremium(parent.id, parent.name, policies)}
              />
            ))}
          </div>
          <Connector type="vertical" />
        </>
      )}

      {/* 主被保人 + 配偶層 */}
      <div className="flex justify-center items-center gap-2 mb-2">
        <MemberCard
          member={mainMember}
          isMain={true}
          policyCount={countPolicies(mainMember.id, mainMember.name, policies)}
          premium={sumPremium(mainMember.id, mainMember.name, policies)}
        />
        {spouse && (
          <>
            <Connector type="spouse" />
            <MemberCard
              member={spouse}
              isMain={false}
              policyCount={countPolicies(spouse.id, spouse.name, policies)}
              premium={sumPremium(spouse.id, spouse.name, policies)}
            />
          </>
        )}
      </div>

      {/* 兄弟姐妹 */}
      {siblings.length > 0 && (
        <div className="flex justify-center gap-4 mb-4">
          {siblings.map(sibling => (
            <MemberCard
              key={sibling.id}
              member={sibling}
              isMain={false}
              policyCount={countPolicies(sibling.id, sibling.name, policies)}
              premium={sumPremium(sibling.id, sibling.name, policies)}
            />
          ))}
        </div>
      )}

      {/* 子女層 */}
      {children.length > 0 && (
        <>
          <Connector type="vertical" />
          <div className="flex justify-center gap-4">
            {children.map(child => (
              <MemberCard
                key={child.id}
                member={child}
                isMain={false}
                policyCount={countPolicies(child.id, child.name, policies)}
                premium={sumPremium(child.id, child.name, policies)}
              />
            ))}
          </div>
        </>
      )}

      {/* 其他成員 */}
      {others.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500 text-center mb-3">其他成員</div>
          <div className="flex justify-center gap-4 flex-wrap">
            {others.map(other => (
              <MemberCard
                key={other.id}
                member={other}
                isMain={false}
                policyCount={countPolicies(other.id, other.name, policies)}
                premium={sumPremium(other.id, other.name, policies)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 總計 */}
      <div className="mt-6 pt-4 border-t border-slate-200 flex justify-center gap-8 text-sm">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-800">{tree.members.length}</div>
          <div className="text-slate-500">家庭成員</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{policies.length}</div>
          <div className="text-slate-500">張保單</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-600">
            {policies.reduce((sum, p) => sum + (p.totalAnnualPremium || 0), 0).toLocaleString()}
          </div>
          <div className="text-slate-500">年繳保費</div>
        </div>
      </div>
    </div>
  );
}
