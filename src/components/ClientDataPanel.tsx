/**
 * ClientDataPanel — top-of-tool batch "use everything for ${client}" panel
 *
 * Sprint 6 MVF (optional): single-click apply for all fields the active client
 * has data for. Individual chips still work next to each input — this just
 * saves three clicks when the advisor is starting fresh.
 *
 * Render rules:
 *  - No activeClient → renders nothing
 *  - No mapped field has a value → renders nothing (don't show empty panel)
 *
 * Why "completeness" indicator: lets advisor see at a glance "I haven't filled
 * in 退休年齡 for this client yet" without leaving the tool.
 */
import React, { useCallback, useMemo } from 'react';
import { Users as UsersIcon, CheckCheck } from 'lucide-react';
import { useClientContext, type ClientFieldKey } from '../hooks/useClientContext';
import { toast } from '../utils/toast';

export interface FieldMapping {
  /** Tool-side field name, e.g. 'salary' or 'spouse'. Used for toast / a11y. */
  toolField: string;
  /** Called with the client value. */
  setter: (value: unknown) => void;
  /** Display label, e.g. '月收入'. */
  label: string;
}

export interface ClientDataPanelProps {
  /** clientField → { toolField, setter, label } */
  mapping: Partial<Record<ClientFieldKey, FieldMapping>>;
  className?: string;
}

export const ClientDataPanel: React.FC<ClientDataPanelProps> = ({ mapping, className }) => {
  const { activeClient, hasField, getField } = useClientContext();

  // Compute available vs. missing — done before any early return so React
  // hook order stays stable when activeClient toggles.
  const { availableEntries, missingLabels } = useMemo(() => {
    const available: Array<[ClientFieldKey, FieldMapping]> = [];
    const missing: string[] = [];
    (Object.entries(mapping) as Array<[ClientFieldKey, FieldMapping | undefined]>).forEach(
      ([k, v]) => {
        if (!v) return;
        if (hasField(k)) {
          available.push([k, v]);
        } else {
          missing.push(v.label);
        }
      },
    );
    return { availableEntries: available, missingLabels: missing };
  }, [mapping, hasField]);

  const handleApplyAll = useCallback(() => {
    if (!activeClient) return;
    const applied: string[] = [];
    availableEntries.forEach(([k, m]) => {
      const v = getField(k);
      if (v === null || v === undefined) return;
      try {
        m.setter(v);
        // 列出實際帶入的「欄位名 + 值」，顧問誤點當下立刻看見並可手動改回。
        // 之前只說「已帶入 3 個欄位」，UX critic 點名為「無 diff、無 undo」blocker。
        const valueStr = typeof v === 'number' ? v.toLocaleString() : String(v);
        applied.push(`${m.label} ${valueStr}`);
      } catch (e) {
        console.error('[ClientDataPanel] setter failed for', m.toolField, e);
      }
    });
    if (applied.length > 0) {
      toast.success(`已帶入 ${activeClient.name}：${applied.join('、')}`);
    }
  }, [activeClient, availableEntries, getField]);

  if (!activeClient) return null;
  if (availableEntries.length === 0) return null;

  const totalFields = availableEntries.length + missingLabels.length;
  const completeness = totalFields > 0 ? Math.round((availableEntries.length / totalFields) * 100) : 0;

  return (
    <div
      className={[
        'flex flex-wrap items-center gap-3',
        'px-4 py-3 rounded-xl',
        'bg-violet-50/60 dark:bg-violet-500/5',
        'border border-violet-200/60 dark:border-violet-500/20',
        className ?? '',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 text-sm">
        <UsersIcon className="w-4 h-4 text-violet-600 dark:text-violet-300" aria-hidden="true" />
        <span className="font-medium text-slate-700 dark:text-slate-200">{activeClient.name}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          資料完整度 {completeness}%（{availableEntries.length}/{totalFields}）
        </span>
      </div>

      {missingLabels.length > 0 && (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          未填：{missingLabels.join('、')}
        </span>
      )}

      <button
        type="button"
        onClick={handleApplyAll}
        className={[
          'ml-auto inline-flex items-center gap-1.5',
          'px-3 py-1.5 rounded-lg',
          'text-xs font-semibold',
          'bg-violet-600 hover:bg-violet-700 text-white',
          'transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-violet-400/50',
        ].join(' ')}
      >
        <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
        全部帶入
      </button>
    </div>
  );
};

export default ClientDataPanel;
