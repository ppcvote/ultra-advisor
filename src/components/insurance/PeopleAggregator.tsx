/**
 * 人物彙整元件
 * 從已輸入的保單中自動擷取所有人物（要保人、被保險人）
 * 去重後詢問用戶設定關係
 */
import React, { useState, useMemo } from 'react';
import { User, Users, ArrowRight, Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { PolicyInfo, Gender, RelationType } from '../../types/insurance';
import { RELATION_LABELS } from '../../types/insurance';

interface ExtractedPerson {
  name: string;
  birthDate?: string;
  estimatedBirthYear?: number;  // 從投保年齡反推的出生年
  age?: number;                 // 當前年齡（精確或估算）
  gender?: Gender;
  role: 'applicant' | 'insured' | 'both';  // 此人在保單中的角色
  policyIds: string[];  // 出現在哪些保單
}

interface PeopleAggregatorProps {
  policies: PolicyInfo[];
  onComplete: (data: {
    mainPerson: ExtractedPerson;
    people: ExtractedPerson[];
    relationships: Record<string, RelationType>;  // personName -> relationship to mainPerson
  }) => void;
  onBack: () => void;
}

// 民國年轉西元年
function parseRocDate(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  // 已經是西元年格式
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // 民國年格式 (例: 65/12/23 或 087/05/10)
  const match = dateStr.match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/);
  if (match) {
    const rocYear = parseInt(match[1], 10);
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    const westYear = rocYear + 1911;
    return `${westYear}-${month}-${day}`;
  }
  return dateStr;
}

// 計算年齡（從生日）
function calcAge(birthDate?: string): number | undefined {
  if (!birthDate) return undefined;
  const parsed = parseRocDate(birthDate);
  if (!parsed) return undefined;
  const birth = new Date(parsed);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// 從投保年齡 + 生效日反推出生年
function estimateBirthYear(ageAtIssue: number, effectiveDate: string): number {
  const effectiveYear = new Date(effectiveDate).getFullYear();
  return effectiveYear - ageAtIssue;
}

// 計算當前年齡（從估算的出生年）
function calcAgeFromBirthYear(birthYear: number): number {
  return new Date().getFullYear() - birthYear;
}

export default function PeopleAggregator({ policies, onComplete, onBack }: PeopleAggregatorProps) {
  // 從保單中提取所有人物
  const extractedPeople = useMemo(() => {
    const peopleMap = new Map<string, ExtractedPerson>();

    policies.forEach(policy => {
      // 處理要保人
      if (policy.applicant) {
        const existing = peopleMap.get(policy.applicant);
        if (existing) {
          existing.policyIds.push(policy.id);
          // 優先使用精確生日
          if (policy.applicantBirthDate && !existing.birthDate) {
            existing.birthDate = policy.applicantBirthDate;
            existing.age = calcAge(policy.applicantBirthDate);
          }
          // 若無生日但有投保年齡，用來估算
          if (!existing.birthDate && !existing.estimatedBirthYear && policy.applicantAgeAtIssue && policy.effectiveDate) {
            existing.estimatedBirthYear = estimateBirthYear(policy.applicantAgeAtIssue, policy.effectiveDate);
            existing.age = calcAgeFromBirthYear(existing.estimatedBirthYear);
          }
          if (policy.applicantGender && !existing.gender) {
            existing.gender = policy.applicantGender;
          }
          if (policy.applicant === policy.insured) {
            existing.role = 'both';
          }
        } else {
          const birthDate = policy.applicantBirthDate;
          const estimatedBirthYear = !birthDate && policy.applicantAgeAtIssue && policy.effectiveDate
            ? estimateBirthYear(policy.applicantAgeAtIssue, policy.effectiveDate)
            : undefined;
          const age = birthDate
            ? calcAge(birthDate)
            : estimatedBirthYear
              ? calcAgeFromBirthYear(estimatedBirthYear)
              : undefined;

          peopleMap.set(policy.applicant, {
            name: policy.applicant,
            birthDate,
            estimatedBirthYear,
            age,
            gender: policy.applicantGender,
            role: policy.applicant === policy.insured ? 'both' : 'applicant',
            policyIds: [policy.id],
          });
        }
      }

      // 處理被保險人（如果與要保人不同）
      if (policy.insured && policy.insured !== policy.applicant) {
        const existing = peopleMap.get(policy.insured);
        if (existing) {
          existing.policyIds.push(policy.id);
          // 優先使用精確生日
          if (policy.insuredBirthDate && !existing.birthDate) {
            existing.birthDate = policy.insuredBirthDate;
            existing.age = calcAge(policy.insuredBirthDate);
          }
          // 若無生日但有投保年齡，用來估算
          if (!existing.birthDate && !existing.estimatedBirthYear && policy.insuredAgeAtIssue && policy.effectiveDate) {
            existing.estimatedBirthYear = estimateBirthYear(policy.insuredAgeAtIssue, policy.effectiveDate);
            existing.age = calcAgeFromBirthYear(existing.estimatedBirthYear);
          }
          if (policy.insuredGender && !existing.gender) {
            existing.gender = policy.insuredGender;
          }
        } else {
          const birthDate = policy.insuredBirthDate;
          const estimatedBirthYear = !birthDate && policy.insuredAgeAtIssue && policy.effectiveDate
            ? estimateBirthYear(policy.insuredAgeAtIssue, policy.effectiveDate)
            : undefined;
          const age = birthDate
            ? calcAge(birthDate)
            : estimatedBirthYear
              ? calcAgeFromBirthYear(estimatedBirthYear)
              : undefined;

          peopleMap.set(policy.insured, {
            name: policy.insured,
            birthDate,
            estimatedBirthYear,
            age,
            gender: policy.insuredGender,
            role: 'insured',
            policyIds: [policy.id],
          });
        }
      }
    });

    return Array.from(peopleMap.values());
  }, [policies]);

  // Step 1: 選擇主被保人
  const [mainPersonName, setMainPersonName] = useState<string | null>(null);
  // Step 2: 設定其他人的關係
  const [relationships, setRelationships] = useState<Record<string, RelationType>>({});
  // UI state
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);

  const mainPerson = extractedPeople.find(p => p.name === mainPersonName);
  const otherPeople = extractedPeople.filter(p => p.name !== mainPersonName);

  // 所有關係都設定完成
  const allRelationshipsSet = otherPeople.every(p => relationships[p.name]);

  const handleComplete = () => {
    if (!mainPerson) return;
    onComplete({
      mainPerson,
      people: extractedPeople,
      relationships: {
        [mainPerson.name]: 'self',
        ...relationships,
      },
    });
  };

  // 如果只有一個人，直接跳過選擇
  if (extractedPeople.length === 1) {
    const singlePerson = extractedPeople[0];
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-2">資料確認</h2>
        <p className="text-sm text-slate-500 mb-6">系統已識別到保單中的人物</p>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white ${
              singlePerson.gender === 'female' ? 'bg-pink-500' : 'bg-blue-500'
            }`}>
              {singlePerson.name.charAt(0)}
            </div>
            <div>
              <div className="font-bold text-slate-800">{singlePerson.name}</div>
              <div className="text-sm text-slate-500">
                {singlePerson.gender === 'male' ? '男' : singlePerson.gender === 'female' ? '女' : ''}
                {singlePerson.birthDate && ` · ${parseRocDate(singlePerson.birthDate)}`}
                {singlePerson.age !== undefined && ` (${singlePerson.age}歲${!singlePerson.birthDate ? '約' : ''})`}
              </div>
            </div>
          </div>
          <div className="text-sm text-slate-600">
            共 {singlePerson.policyIds.length} 張保單
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
          >
            返回修改
          </button>
          <button
            onClick={() => onComplete({
              mainPerson: singlePerson,
              people: [singlePerson],
              relationships: { [singlePerson.name]: 'self' },
            })}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            確認並繼續
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  // Step 1: 選擇主被保人
  if (!mainPersonName) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-2">選擇主被保人</h2>
        <p className="text-sm text-slate-500 mb-6">
          系統已從 {policies.length} 張保單中識別出 {extractedPeople.length} 位人物，請選擇這次要健診的主要對象
        </p>

        <div className="space-y-3 mb-6">
          {extractedPeople.map(person => (
            <button
              key={person.name}
              onClick={() => setMainPersonName(person.name)}
              className="w-full p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                  person.gender === 'female' ? 'bg-pink-500' : 'bg-blue-500'
                }`}>
                  {person.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-800">{person.name}</div>
                  <div className="text-xs text-slate-500">
                    {person.gender === 'male' ? '男' : person.gender === 'female' ? '女' : ''}
                    {person.birthDate && ` · ${parseRocDate(person.birthDate)}`}
                    {person.age !== undefined && ` (${!person.birthDate ? '約' : ''}${person.age}歲)`}
                    <span className="ml-2">
                      {person.role === 'both' && '· 要保人兼被保人'}
                      {person.role === 'applicant' && '· 要保人'}
                      {person.role === 'insured' && '· 被保險人'}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-slate-400">
                  {person.policyIds.length} 張保單
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onBack}
          className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
        >
          返回修改保單
        </button>
      </div>
    );
  }

  // Step 2: 設定其他人的關係
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-slate-800 mb-2">設定家庭關係</h2>
      <p className="text-sm text-slate-500 mb-6">
        請設定其他人與 <span className="font-medium text-blue-600">{mainPersonName}</span> 的關係
      </p>

      {/* 主被保人卡片 */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
            mainPerson?.gender === 'female' ? 'bg-pink-500' : 'bg-blue-500'
          }`}>
            {mainPerson?.name.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">{mainPerson?.name}</span>
              <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded">主被保人</span>
            </div>
            <div className="text-xs text-slate-500">
              {mainPerson?.gender === 'male' ? '男' : mainPerson?.gender === 'female' ? '女' : ''}
              {mainPerson?.birthDate && ` · ${calcAge(mainPerson.birthDate)}歲`}
            </div>
          </div>
        </div>
      </div>

      {/* 其他人物關係設定 */}
      <div className="space-y-3 mb-6">
        {otherPeople.map(person => {
          const selectedRelation = relationships[person.name];
          const isExpanded = expandedPerson === person.name;

          return (
            <div key={person.name} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedPerson(isExpanded ? null : person.name)}
                className="w-full p-4 flex items-center gap-3 hover:bg-slate-50"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                  person.gender === 'female' ? 'bg-pink-500' : 'bg-blue-500'
                }`}>
                  {person.name.charAt(0)}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-slate-800">{person.name}</div>
                  <div className="text-xs text-slate-500">
                    {person.gender === 'male' ? '男' : person.gender === 'female' ? '女' : ''}
                    {person.age !== undefined && ` · ${!person.birthDate ? '約' : ''}${person.age}歲`}
                  </div>
                </div>
                {selectedRelation ? (
                  <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full flex items-center gap-1">
                    <Check size={14} />
                    {RELATION_LABELS[selectedRelation]}
                  </span>
                ) : (
                  <span className="text-sm text-slate-400">點擊設定關係</span>
                )}
                {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100">
                  <div className="pt-3 text-sm text-slate-600 mb-2">
                    <span className="font-medium">{person.name}</span> 是 <span className="font-medium text-blue-600">{mainPersonName}</span> 的：
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['spouse', 'father', 'mother', 'son', 'daughter', 'brother', 'sister', 'other'] as RelationType[]).map(rel => (
                      <button
                        key={rel}
                        onClick={() => {
                          setRelationships(prev => ({ ...prev, [person.name]: rel }));
                          setExpandedPerson(null);
                        }}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          selectedRelation === rel
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {RELATION_LABELS[rel]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 按鈕 */}
      <div className="flex gap-3">
        <button
          onClick={() => setMainPersonName(null)}
          className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
        >
          重新選擇
        </button>
        <button
          onClick={handleComplete}
          disabled={!allRelationshipsSet}
          className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2"
        >
          確認並繼續
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
