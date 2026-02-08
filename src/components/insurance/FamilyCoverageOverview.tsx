/**
 * 家庭保障總覽表格
 */
import React from 'react';
import type { MergedCoverage, FamilyMember } from '../../types/insurance';

interface FamilyCoverageOverviewProps {
  members: FamilyMember[];
  coverageMap: Record<string, MergedCoverage>;
}

const fmt = (n: number) => {
  if (n === 0) return '-';
  if (n >= 10000) return `${(n / 10000).toFixed(0)}萬`;
  return n.toLocaleString();
};

const COLUMNS = [
  { key: 'death', label: '壽險' },
  { key: 'accidentDeath', label: '意外' },
  { key: 'criticalIllness', label: '重疾' },
  { key: 'cancer', label: '癌症' },
  { key: 'hospitalDailyIllness', label: '住院日額' },
  { key: 'medicalExpense', label: '實支實付' },
  { key: 'disability', label: '失能' },
  { key: 'longTermCare', label: '長照' },
] as const;

export default function FamilyCoverageOverview({ members, coverageMap }: FamilyCoverageOverviewProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="text-left px-3 py-2 font-medium text-slate-600 sticky left-0 bg-slate-50">成員</th>
            {COLUMNS.map(col => (
              <th key={col.key} className="text-right px-3 py-2 font-medium text-slate-600 whitespace-nowrap">
                {col.label}
              </th>
            ))}
            <th className="text-right px-3 py-2 font-medium text-slate-600">年保費</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {members.map(member => {
            const merged = coverageMap[member.id];
            if (!merged) {
              return (
                <tr key={member.id} className="text-slate-400">
                  <td className="px-3 py-2 sticky left-0 bg-white">{member.name}</td>
                  {COLUMNS.map(col => (
                    <td key={col.key} className="text-right px-3 py-2">-</td>
                  ))}
                  <td className="text-right px-3 py-2">-</td>
                </tr>
              );
            }

            return (
              <tr key={member.id}>
                <td className="px-3 py-2 font-medium text-slate-700 sticky left-0 bg-white">
                  {member.name}
                  {member.isMainInsured && (
                    <span className="ml-1 text-[10px] text-amber-500">主</span>
                  )}
                </td>
                {COLUMNS.map(col => {
                  const value = merged.totalCoverage[col.key as keyof typeof merged.totalCoverage] || 0;
                  return (
                    <td key={col.key} className={`text-right px-3 py-2 ${
                      value === 0 ? 'text-red-300' : 'text-slate-700'
                    }`}>
                      {fmt(value)}
                    </td>
                  );
                })}
                <td className="text-right px-3 py-2 text-blue-600 font-medium">
                  {fmt(merged.premiumSummary.totalAnnual)}
                </td>
              </tr>
            );
          })}
        </tbody>

        {/* 家庭合計 */}
        <tfoot>
          <tr className="bg-blue-50 font-medium">
            <td className="px-3 py-2 text-blue-700 sticky left-0 bg-blue-50">家庭合計</td>
            {COLUMNS.map(col => {
              const total = members.reduce((sum, m) => {
                const merged = coverageMap[m.id];
                return sum + (merged?.totalCoverage[col.key as keyof typeof merged.totalCoverage] || 0);
              }, 0);
              return (
                <td key={col.key} className="text-right px-3 py-2 text-blue-700">
                  {fmt(total)}
                </td>
              );
            })}
            <td className="text-right px-3 py-2 text-blue-700">
              {fmt(members.reduce((sum, m) => sum + (coverageMap[m.id]?.premiumSummary.totalAnnual || 0), 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
