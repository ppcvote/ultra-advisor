/**
 * UseClientDataChip — small "use ${client.name}'s data" pill next to a tool input
 *
 * Sprint 6 MVF: replaces the "switch client wipes my work" pain point.
 *顧問正在算的東西不會被自動覆蓋；只有按 chip 才一次性帶入單一欄位。
 *
 * Render rules:
 *  - No activeClient → renders nothing
 *  - activeClient exists but field is empty → renders nothing
 *    (don't disable-grey-out — that just adds clutter and false promises)
 *  - Otherwise → small chip showing the value
 *
 * Clicking the chip does NOT remove it — advisor might want to re-apply after
 * tweaking the field manually.
 */
import React, { useCallback } from 'react';
import { User as UserIcon } from 'lucide-react';
import { useClientContext, type ClientFieldKey } from '../hooks/useClientContext';
import { toast } from '../utils/toast';

export interface UseClientDataChipProps {
  /** Which client field to read. e.g. 'age', 'monthlyIncome', 'hasSpouse'. */
  clientField: ClientFieldKey;
  /**
   * Tool-side field name. Currently only used for the toast / a11y label,
   * but kept in the API so future "apply many" wrappers can use it.
   */
  toolField?: string;
  /** Called with the value when chip is clicked. */
  onApply: (value: unknown) => void;
  /** Human label for the toast ("月收入" / "已婚" / "退休年齡"). */
  label?: string;
  /** Optional formatter for the value displayed in the chip. */
  formatValue?: (v: unknown) => string;
  /** Extra Tailwind classes for the chip wrapper. */
  className?: string;
}

function defaultFormat(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? '是' : '否';
  if (typeof v === 'number') {
    // Heuristic: 大數字（收入）逗號分隔；小數字（年齡/人數）直接顯示。
    if (v >= 10000) return v.toLocaleString('zh-TW');
    return String(v);
  }
  return String(v);
}

export const UseClientDataChip: React.FC<UseClientDataChipProps> = ({
  clientField,
  toolField,
  onApply,
  label,
  formatValue,
  className,
}) => {
  const { activeClient, hasField, getField } = useClientContext();

  const handleClick = useCallback(() => {
    const value = getField(clientField);
    if (value === null || value === undefined) return;
    onApply(value);
    const fieldLabel = label ?? toolField ?? String(clientField);
    const clientName = activeClient?.name ?? '客戶';
    toast.success(`已帶入 ${clientName} 的${fieldLabel}`);
  }, [activeClient, clientField, getField, label, onApply, toolField]);

  if (!activeClient) return null;
  if (!hasField(clientField)) return null;

  const rawValue = getField(clientField);
  const display = (formatValue ?? defaultFormat)(rawValue);

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`點擊帶入 ${activeClient.name} 的${label ?? String(clientField)}`}
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'text-xs font-medium',
        'bg-violet-50 dark:bg-violet-500/10',
        'text-violet-700 dark:text-violet-300',
        'border border-violet-200/70 dark:border-violet-500/20',
        'hover:bg-violet-100 dark:hover:bg-violet-500/20',
        'hover:-translate-y-px hover:shadow-sm',
        'transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-violet-400/40',
        className ?? '',
      ].join(' ')}
    >
      <UserIcon className="w-3 h-3 opacity-70" aria-hidden="true" />
      <span className="truncate max-w-[160px]">
        使用 {activeClient.name} 的資料{display ? `（${display}）` : ''}
      </span>
    </button>
  );
};

export default UseClientDataChip;
